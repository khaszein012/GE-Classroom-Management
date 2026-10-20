// Deno edge function — student login. Runtime-checked by Deno, not the app tsconfig.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createHash, randomUUID } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };

const GENERIC_ERROR = "Wrong username or PIN";
const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 60;

function verifyPin(storedHash: string, pin: string): boolean {
  // Stored format: "s1$<salt-hex>$<sha256-hex>" (matches the teacher-side hashPin)
  const [scheme, salt, expected] = storedHash.split("$");
  if (scheme !== "s1" || !salt || !expected) return false;
  const actual = createHash("sha256").update(`${salt}:${pin}`).digest("hex");
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++) mismatch |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: JSON_HEADERS });
  }

  try {
    const body = await req.json();
    const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
    const pin = typeof body?.pin === "string" ? body.pin : "";

    // Uniform validation error — never hint which part is wrong.
    if (!/^[a-z0-9_]{3,20}$/.test(username) || !/^\d{6}$/.test(pin)) {
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), { status: 401, headers: JSON_HEADERS });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: student, error: findErr } = await admin
      .from("students")
      .select("id, display_name, pin_hash, is_active, user_id, failed_attempts, locked_until")
      .eq("username", username)
      .maybeSingle();

    if (findErr) throw findErr;

    // Unknown or inactive account: identical generic response to a wrong PIN.
    if (!student || !student.is_active) {
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), { status: 401, headers: JSON_HEADERS });
    }

    // Lockout enforced server-side: 60s after 5 failed attempts.
    if (student.locked_until && new Date(student.locked_until).getTime() > Date.now()) {
      const retryAfter = Math.max(
        1,
        Math.ceil((new Date(student.locked_until).getTime() - Date.now()) / 1000),
      );
      return new Response(
        JSON.stringify({ error: `Too many attempts. Try again in ${retryAfter}s.`, retryAfter }),
        { status: 429, headers: { ...JSON_HEADERS, "Retry-After": String(retryAfter) } },
      );
    }

    // No PIN set yet — same generic response as a wrong PIN.
    if (!student.pin_hash) {
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), { status: 401, headers: JSON_HEADERS });
    }

    if (!verifyPin(student.pin_hash, pin)) {
      const failed = (student.failed_attempts ?? 0) + 1;
      const patch: Record<string, unknown> = { failed_attempts: failed };
      if (failed >= MAX_ATTEMPTS) {
        patch.locked_until = new Date(Date.now() + LOCK_SECONDS * 1000).toISOString();
        patch.failed_attempts = 0;
      }
      await admin.from("students").update(patch).eq("id", student.id);
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), { status: 401, headers: JSON_HEADERS });
    }

    // Success — clear lockout state.
    await admin.from("students").update({ failed_attempts: 0, locked_until: null }).eq("id", student.id);

    // Find or create the linked auth user.
    let userId = student.user_id as string | null;

    if (!userId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: `${randomUUID()}@student.local`,
        email_confirm: true,
        app_metadata: { student_id: student.id, provider: "student-pin", providers: ["student-pin"] },
      });
      if (createErr) throw createErr;
      userId = created.user.id;
      const { error: linkErr } = await admin.from("students").update({ user_id: userId }).eq("id", student.id);
      if (linkErr) throw linkErr;
    }

    // Sanity check: the immutable app_metadata claim must match this student row.
    const { data: userData, error: getUserErr } = await admin.auth.admin.getUserById(userId);
    if (getUserErr) throw getUserErr;
    if (userData.user?.app_metadata?.student_id !== student.id) {
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), { status: 401, headers: JSON_HEADERS });
    }

    // Mint a real session: admin generates a magic link, then the anon client
    // exchanges its OTP for access + refresh tokens.
    const { data: link, error: linkErr2 } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email!,
    });
    const otp = link?.properties?.email_otp ?? link?.properties?.token;
    if (linkErr2 || !otp) throw linkErr2 ?? new Error("could not mint sign-in link");

    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: sessionData, error: verifyErr } = await anon.auth.verifyOtp({
      type: "magiclink",
      email: userData.user.email!,
      token: otp,
    });
    if (verifyErr || !sessionData?.session) throw verifyErr ?? new Error("could not start session");

    return new Response(
      JSON.stringify({
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_in: sessionData.session.expires_in,
        student: { id: student.id, displayName: student.display_name },
      }),
      { headers: JSON_HEADERS },
    );
  } catch (err) {
    console.error("student-login error", err);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers: JSON_HEADERS },
    );
  }
});
