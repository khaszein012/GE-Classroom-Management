import { supabase } from "@/lib/supabase";

const GENERIC_ERROR = "Wrong username or PIN";

export interface StudentSessionInfo {
  id: string;
  displayName: string;
}

/**
 * Sign in as a student via the student-login edge function. The function
 * verifies the PIN server-side (never plaintext), enforces the 60s lockout,
 * and returns a real Supabase session. Throws Error with a user-safe message.
 */
export async function studentLogin(username: string, pin: string): Promise<StudentSessionInfo> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-login`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      body: JSON.stringify({ username, pin }),
    });
  } catch {
    throw new Error("Could not reach the sign-in service. Check your connection.");
  }
  if (!res.ok && res.status !== 401 && res.status !== 429) {
    throw new Error("Something went wrong. Please try again.");
  }
  const data = await res.json().catch(() => null);
  const message: string = data?.error ?? GENERIC_ERROR;
  if (!res.ok || !data?.access_token || !data?.refresh_token) {
    throw new StudentLoginError(message, res.status === 429 ? data?.retryAfter : undefined);
  }
  const { error: setErr } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (setErr) throw new Error("Could not start your session. Please try again.");
  return { id: data.student.id, displayName: data.student.displayName };
}

export class StudentLoginError extends Error {
  retryAfter?: number;
  constructor(message: string, retryAfter?: number) {
    super(message);
    this.retryAfter = retryAfter;
  }
}
