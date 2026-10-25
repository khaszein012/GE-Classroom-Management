/**
 * Security regression test suite — GE-Classroom-Management
 *
 * Creates real sessions (teacher, two throwaway students via the actual
 * student-login edge function, anon) and asserts that every forbidden
 * read/write fails. Run:
 *
 *   TEACHER_EMAIL=... TEACHER_PASSWORD=... \
 *     npm run sec-test
 *
 * (env file .env supplies VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
 *
 * All test rows are prefixed ZZSEC and removed afterwards. Exit code is
 * non-zero if any assertion fails. Phase 6.2/7-specific tests auto-skip
 * with a note until their migrations are applied.
 */
import { createClient } from "@supabase/supabase-js";
import { webcrypto as crypto } from "node:crypto";

const URL_ = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const EMAIL = process.env.TEACHER_EMAIL;
const PASSWORD = process.env.TEACHER_PASSWORD;

if (!URL_ || !ANON) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (use --env-file=.env).");
  process.exit(2);
}
if (!EMAIL || !PASSWORD) {
  console.error("Missing TEACHER_EMAIL / TEACHER_PASSWORD environment variables.");
  process.exit(2);
}

// ---------- tiny assert helpers ----------
const results = [];
const pass = (name, detail = "") => results.push({ name, status: "PASS", detail });
const fail = (name, detail = "") => results.push({ name, status: "FAIL", detail });
const skip = (name, detail) => results.push({ name, status: "SKIP", detail });
const note = (name, detail) => results.push({ name, status: "INFO", detail });
const ok = (name, cond, detail = "") => (cond ? pass(name, detail) : fail(name, detail));

// ---------- PIN hashing (mirrors src/lib/pin.ts) ----------
async function hashPin(pin) {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const salt = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${pin}`));
  const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `s1$${salt}$${hash}`;
}

// ---------- session helpers ----------
const teacher = createClient(URL_, ANON);
const studentLogin = async (username, pin) => {
  const res = await fetch(`${URL_}/functions/v1/student-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, pin }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
};
const studentClient = async (username, pin) => {
  const { status, body } = await studentLogin(username, pin);
  if (status !== 200) throw new Error(`studentLogin ${username} -> ${status}: ${body.error}`);
  const c = createClient(URL_, ANON);
  await c.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token });
  return c;
};

const PIN_A = "418322";
const PIN_B = "705194";
const PIN_C = "936471";

async function setupStudent(name, username, pin) {
  const pinHash = await hashPin(pin);
  const { error } = await teacher
    .from("students")
    .insert({ display_name: name, avatar_emoji: "", avatar_color: 0, username, pin_hash: pinHash });
  if (error) throw new Error(`setupStudent ${username}: ${error.message}`);
}

async function makeQuiz({ title, status, dueInMin, assignedTo, maxGems = 9, questions }) {
  const { data: quiz, error } = await teacher
    .from("quizzes")
    .insert({
      title,
      description: null,
      max_gems: maxGems,
      due_at: new Date(Date.now() + dueInMin * 60_000).toISOString(),
      status,
    })
    .select("id")
    .single();
  if (error) throw new Error(`makeQuiz ${title}: ${error.message}`);
  const quizId = quiz.id;
  for (const [qi, q] of questions.entries()) {
    const { data: question, error: qErr } = await teacher
      .from("quiz_questions")
      .insert({ quiz_id: quizId, body: q.body, type: q.type, position: qi + 1 })
      .select("id")
      .single();
    if (qErr) throw new Error(`makeQuiz question: ${qErr.message}`);
    for (const [oi, o] of q.options.entries()) {
      const { error: oErr } = await teacher.from("quiz_options").insert({
        question_id: question.id,
        body: o.body,
        is_correct: o.correct,
        position: oi + 1,
      });
      if (oErr) throw new Error(`makeQuiz option: ${oErr.message}`);
    }
  }
  if (assignedTo.length > 0) {
    const { error: aErr } = await teacher
      .from("quiz_assignments")
      .insert(assignedTo.map((student_id) => ({ quiz_id: quizId, student_id })));
    if (aErr) throw new Error(`makeQuiz assign: ${aErr.message}`);
  }
  return quizId;
}

async function quizDetails(quizId) {
  const { data: questions } = await teacher
    .from("quiz_questions")
    .select("id, body, type, quiz_options(id, body, is_correct)")
    .eq("quiz_id", quizId)
    .order("position");
  return questions ?? [];
}

const cleanup = async () => {
  await teacher.from("quizzes").delete().like("title", "ZZSEC%");
  await teacher.from("rewards").delete().like("name", "ZZSEC%");
  await teacher.from("students").delete().like("username", "zzsec%");
};

// ---------- run ----------
const summary = { PASS: 0, FAIL: 0, SKIP: 0, INFO: 0 };
try {
  console.log("Signing in as teacher…");
  const { error: signInErr } = await teacher.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (signInErr) throw signInErr;
  pass("teacher sign-in");

  // Remove any leftovers from a previous failed run first.
  await cleanup();

  console.log("Creating throwaway students…");
  await setupStudent("ZZSEC Student A", "zzseca", PIN_A);
  await setupStudent("ZZSEC Student B", "zzsecb", PIN_B);
  await setupStudent("ZZSEC Student C", "zzsecc", PIN_C);
  const { data: roster } = await teacher.from("students").select("id, username").like("username", "zzsec%");
  const A_ID = roster.find((s) => s.username === "zzseca").id;
  const B_ID = roster.find((s) => s.username === "zzsecb").id;
  const A = await studentClient("zzseca", PIN_A);
  const B = await studentClient("zzsecb", PIN_B);
  pass("student sessions via edge function (A, B)");

  // ===== anon access =====
  const anon = createClient(URL_, ANON);
  for (const table of ["students", "point_transactions", "rewards", "redemptions", "class_settings", "quizzes", "quiz_questions", "quiz_options"]) {
    const { data, error } = await anon.from(table).select("*").limit(5);
    ok(`anon cannot read ${table}`, !!error || (data ?? []).length === 0, error ? error.code : "empty");
  }
  {
    const { error } = await anon.rpc("my_quiz_list");
    ok("anon cannot call my_quiz_list", !!error, error?.code ?? error?.message);
  }

  // ===== quiz lifecycle =====
  const QUESTIONS = [
    { body: "2 + 2?", type: "multiple_choice", options: [{ body: "3", correct: false }, { body: "4", correct: true }] },
    { body: "Capital of France?", type: "multiple_choice", options: [{ body: "Berlin", correct: false }, { body: "Paris", correct: true }] },
    { body: "The Sun is a star.", type: "true_false", options: [{ body: "True", correct: true }, { body: "False", correct: false }] },
  ];
  // Q1: starts as DRAFT, assigned to A only
  const Q1 = await makeQuiz({ title: "ZZSEC Q1", status: "draft", dueInMin: 120, assignedTo: [A_ID], questions: QUESTIONS });
  // Q2: published but overdue
  const Q2 = await makeQuiz({ title: "ZZSEC Q2", status: "published", dueInMin: -60, assignedTo: [A_ID], questions: QUESTIONS.slice(0, 1) });
  // Q3: closed
  const Q3 = await makeQuiz({ title: "ZZSEC Q3", status: "closed", dueInMin: 120, assignedTo: [A_ID], questions: QUESTIONS.slice(0, 1) });
  // Q4: published, assigned to A and B (cross-attempt tests)
  const Q4 = await makeQuiz({ title: "ZZSEC Q4", status: "published", dueInMin: 120, assignedTo: [A_ID, B_ID], questions: QUESTIONS.slice(0, 2) });

  // --- draft invisibility ---
  {
    const { data } = await A.from("quizzes").select("id").eq("id", Q1);
    ok("assigned student cannot see DRAFT quiz row", (data ?? []).length === 0);
    const { data: list } = await A.rpc("my_quiz_list");
    ok("draft quiz absent from my_quiz_list", !JSON.stringify(list).includes(Q1));
    const { data: qs } = await A.rpc("my_quiz_questions", { p_quiz_id: Q1 });
    ok("my_quiz_questions(draft) returns no questions", JSON.stringify(qs) === "[]" || (qs ?? []).length === 0);
  }

  // --- publish, then positive visibility for A ---
  await teacher.from("quizzes").update({ status: "published" }).eq("id", Q1);
  {
    const { data: list } = await A.rpc("my_quiz_list");
    ok("published quiz appears for assigned student", JSON.stringify(list).includes(Q1));
    const raw = await A.rpc("my_quiz_questions", { p_quiz_id: Q1 });
    ok("my_quiz_questions payload contains no is_correct", !JSON.stringify(raw.data).includes("is_correct"));
    const { data: opts } = await A.from("quiz_options").select("id, is_correct");
    ok("student cannot read quiz_options table", (opts ?? []).length === 0);
    const { data: qs } = await A.from("quiz_questions").select("id");
    ok("student cannot read quiz_questions table", (qs ?? []).length === 0);
  }

  // --- unassigned student sees nothing ---
  {
    const { data } = await B.from("quizzes").select("id").eq("id", Q1);
    ok("unassigned student cannot see published quiz", (data ?? []).length === 0);
    const { data: list } = await B.rpc("my_quiz_list");
    ok("unassigned student's list excludes quiz", !JSON.stringify(list).includes(Q1));
    const { data: qs } = await B.rpc("my_quiz_questions", { p_quiz_id: Q1 });
    ok("unassigned student gets no questions", JSON.stringify(qs) === "[]" || (qs ?? []).length === 0);
  }

  // --- attempt guards ---
  {
    const { error } = await B.from("quiz_attempts").insert({ quiz_id: Q1, student_id: B_ID });
    ok("unassigned student cannot start attempt", !!error, error?.code);
  }
  {
    const { data: att, error } = await A.from("quiz_attempts").insert({ quiz_id: Q1, student_id: A_ID }).select("id").single();
    ok("assigned student starts attempt", !error, error?.message);
    var A_ATTEMPT = att?.id;
    const { error: dup } = await A.from("quiz_attempts").insert({ quiz_id: Q1, student_id: A_ID });
    ok("second attempt on same quiz rejected", !!dup, dup?.code);
  }
  {
    const { error } = await A.from("quiz_attempts").insert({ quiz_id: Q2, student_id: A_ID });
    ok("overdue quiz attempt rejected", !!error, error?.code);
  }
  {
    const { error } = await A.from("quiz_attempts").insert({ quiz_id: Q3, student_id: A_ID });
    ok("closed quiz attempt rejected", !!error, error?.code);
  }

  // --- answer guards ---
  const q1Details = await quizDetails(Q1);
  const q4Details = await quizDetails(Q4);
  {
    // correct answers for Q1
    for (const q of q1Details) {
      const correct = q.quiz_options.find((o) => o.is_correct);
      const { error } = await A.from("quiz_answers").upsert(
        { attempt_id: A_ATTEMPT, question_id: q.id, selected_option_id: correct.id },
        { onConflict: "attempt_id,question_id" },
      );
      if (error) fail("student saves own answer", error.message);
    }
    pass("student saves own answers");
    // option from a different question
    const { error } = await A.from("quiz_answers").upsert(
      { attempt_id: A_ATTEMPT, question_id: q1Details[0].id, selected_option_id: q1Details[1].quiz_options[0].id },
      { onConflict: "attempt_id,question_id" },
    );
    ok("answer with foreign option rejected", !!error, error?.code);
  }
  {
    const { data: bAtt, error } = await B.from("quiz_attempts").insert({ quiz_id: Q4, student_id: B_ID }).select("id").single();
    ok("B starts own attempt on shared quiz", !error, error?.message);
    const { error: cross } = await A.from("quiz_answers").upsert(
      { attempt_id: bAtt.id, question_id: q4Details[0].id, selected_option_id: q4Details[0].quiz_options[1].id },
      { onConflict: "attempt_id,question_id" },
    );
    ok("A cannot write into B's attempt", !!cross, cross?.code);
    const { data: bSees } = await B.from("quiz_answers").select("attempt_id").eq("attempt_id", A_ATTEMPT);
    ok("B cannot read A's answers", (bSees ?? []).length === 0);
    const { data: aSees } = await A.from("quiz_attempts").select("id").eq("student_id", B_ID);
    ok("A cannot read B's attempt rows", (aSees ?? []).length === 0);
  }

  // --- scoring integrity ---
  // NOTE: for UPDATE/DELETE on tables where RLS filters every row,
  // PostgREST returns success with 0 rows — so the assertion must check
  // the DATA did not change (read back as teacher), not the error flag.
  {
    await A.from("quiz_attempts").update({ gems_awarded: 999, correct_count: 99 }).eq("id", A_ATTEMPT);
    const att = (await teacher.from("quiz_attempts").select("gems_awarded, correct_count").eq("id", A_ATTEMPT).single()).data;
    ok("student cannot tamper with own attempt scores", att?.gems_awarded === null && att?.correct_count === null, JSON.stringify(att));

    const { error: tx } = await A.from("point_transactions").insert({
      student_id: A_ID, type: "achievement", amount: 50, reason: "self-award",
    });
    ok("student cannot insert point_transactions", !!tx, tx?.code);
    const { error: subB } = await A.rpc("submit_quiz_attempt", { p_attempt_id: (await teacher.from("quiz_attempts").select("id").eq("quiz_id", Q4).eq("student_id", B_ID).maybeSingle()).data?.id });
    ok("student cannot submit another's attempt", !!subB, subB?.message);
    const { error: tSub } = await teacher.rpc("submit_quiz_attempt", { p_attempt_id: A_ATTEMPT });
    ok("teacher cannot call submit_quiz_attempt", !!tSub, tSub?.message);

    const before = (await A.from("students_safe").select("balance, gems_balance, gems_lifetime").single()).data;
    ok("pre-submit dollar balance is 0", before.balance === 0);
    const first = await A.rpc("submit_quiz_attempt", { p_attempt_id: A_ATTEMPT });
    ok("submit succeeds", !first.error, first.error?.message);
    ok("score computed server-side (3/3, 9 gems)",
      first.data?.correct_count === 3 && first.data?.total_count === 3 && first.data?.gems_awarded === 9,
      JSON.stringify(first.data));
    const second = await A.rpc("submit_quiz_attempt", { p_attempt_id: A_ATTEMPT });
    ok("duplicate submit is idempotent",
      !second.error && second.data?.already_submitted === true && second.data?.gems_awarded === 9,
      JSON.stringify(second.data));
    const after = (await A.from("students_safe").select("balance, gems_balance, gems_lifetime").single()).data;
    ok("gems award leaves dollar balance untouched", after.balance === 0, `balance=${after.balance}`);
    ok("gems_balance and gems_lifetime both 9", after.gems_balance === 9 && after.gems_lifetime === 9, JSON.stringify(after));
    const { data: txns } = await A.from("point_transactions").select("id").eq("reason", "Quiz: ZZSEC Q1");
    ok("exactly one gems transaction awarded", (txns ?? []).length === 1);
  }

  // --- review privacy ---
  {
    const { data: reviewB } = await B.rpc("my_attempt_review", { p_attempt_id: A_ATTEMPT });
    ok("B cannot review A's attempt", reviewB === null);
    const { data: reviewA } = await A.rpc("my_attempt_review", { p_attempt_id: A_ATTEMPT });
    ok("A can review own submitted attempt", reviewA?.correct_count === 3);
  }

  // --- teacher-data walls for students ---
  {
    const { data: students } = await A.from("students").select("*");
    ok("students table shows the caller only their own row",
      (students ?? []).length === 1 && students[0]?.username === "zzseca");
    note("own row exposes pin_hash column (informational)",
      "a student can read their own salted PIN hash; own-data-only, accepted — narrow with column grants if desired");

    const { data: settings } = await A.from("class_settings").select("id");
    ok("student cannot read class_settings", (settings ?? []).length === 0);

    await A.from("rewards").update({ name: "HACKED" }).like("name", "%");
    const anyRenamed = (await teacher.from("rewards").select("name").ilike("name", "HACKED")).data;
    ok("student cannot rename rewards", (anyRenamed ?? []).length === 0);

    await A.from("quizzes").delete().like("title", "ZZSEC%");
    const { count: qLeft } = await teacher.from("quizzes").select("id", { count: "exact", head: true }).like("title", "ZZSEC%");
    ok("student cannot delete quizzes", qLeft === 4, `${qLeft} remain`);

    const { error: appr } = await A.rpc("approve_redemption", { p_id: "00000000-0000-0000-0000-000000000000", p_note: null });
    ok("student cannot approve redemptions", !!appr && /Not authorized/i.test(appr.message ?? ""), appr?.message);
    const { error: nameChange } = await A.from("students").update({ display_name: "Hacked" }).eq("id", A_ID);
    ok("student cannot write display_name (column grant)", !!nameChange, nameChange?.code);
    const { error: goalChange } = await A.from("students").update({ goal_target: 100, goal_label: "ok" }).eq("id", A_ID);
    ok("student CAN write own goal (positive control)", !goalChange, goalChange?.message);
  }

  // ===== Phase 6.2 gem-reward sealing (auto-skip if migration pending) =====
  const { error: currencyProbe } = await teacher.from("rewards").select("currency").limit(1);
  const has62 = !currencyProbe;
  if (!has62) {
    skip("gem-priced reward checks", "rewards.currency missing — run the Phase 6.2 migration, then re-run");
  } else {
    const { data: gemReward } = await teacher
      .from("rewards")
      .insert({ name: "ZZSEC Gem Reward", cost: 999999, currency: "gems", stock: null })
      .select("id")
      .single();
    const { error: reqErr } = await A.rpc("request_reward", { p_reward_id: gemReward.id });
    ok("gem purchase beyond gems balance rejected", !!reqErr && /gem/i.test(reqErr.message ?? ""), reqErr?.message);
    const afterReq = (await A.from("students_safe").select("balance, gems_balance").single()).data;
    ok("failed gem request leaves both balances untouched", afterReq.balance === 0 && afterReq.gems_balance === 9);
    // dollar reward the student cannot afford (balance 0)
    const { error: dollarErr } = await A.rpc("request_reward", { p_reward_id: null });
    ok("bogus reward request rejected", !!dollarErr);
  }

  // ===== Phase 7 theme field (auto-skip if migration pending) =====
  const { error: themeProbe } = await teacher.from("students").select("theme").limit(1);
  if (themeProbe) {
    skip("student theme write", "students.theme missing — run the Phase 7 migration, then re-run");
  } else {
    const { error } = await A.from("students").update({ theme: "sage" }).eq("id", A_ID);
    ok("student CAN write own theme (positive control)", !error, error?.message);
    await A.from("students").update({ theme: "plum" }).eq("id", B_ID);
    const bTheme = (await teacher.from("students").select("theme").eq("id", B_ID).single()).data?.theme;
    ok("student cannot write ANOTHER student's theme", bTheme === null, `B.theme=${bTheme}`);
  }

  // ===== edge-function login hardening (uses throwaway student C) =====
  {
    const wrong = await studentLogin("zzsecc", "000000");
    ok("wrong PIN → generic 401", wrong.status === 401 && wrong.body.error === "Wrong username or PIN", JSON.stringify(wrong.body));
    const unknown = await studentLogin("zzsec_nobody", "123456");
    ok("unknown user → same generic 401", unknown.status === 401 && unknown.body.error === "Wrong username or PIN");
    for (let i = 0; i < 5; i++) await studentLogin("zzsecc", "000000");
    const locked = await studentLogin("zzsecc", PIN_C);
    ok("lockout after 5 failures (429 + retry hint)", locked.status === 429 && /Too many/i.test(locked.body.error ?? ""), `${locked.status} ${locked.body.error}`);
  }
} catch (err) {
  fail("suite crashed", err instanceof Error ? err.message : String(err));
} finally {
  console.log("Cleaning up test rows…");
  await cleanup().catch((e) => console.error("cleanup failed:", e.message));
}

for (const r of results) {
  summary[r.status] += 1;
  const icon = { PASS: "✓", FAIL: "✗", SKIP: "-", INFO: "ℹ" }[r.status] ?? "?";
  console.log(`${icon} [${r.status}] ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
}
console.log(`\n${summary.PASS} passed, ${summary.FAIL} failed, ${summary.SKIP} skipped, ${summary.INFO} informational`);
process.exit(summary.FAIL > 0 ? 1 : 0);
