import type { Behavior, CurrencyConfig, PointTransaction, Quiz, QuizAttempt, QuizOption, QuizQuestion, QuizQuestionType, QuizStatus, QuizSummary, Redemption, RedemptionStatus, Reward, RewardCurrency, Student, TransactionType } from "@/types";
import type { ColorTheme } from "@/lib/themes";
import { isColorTheme } from "@/lib/themes";
import { supabase } from "@/lib/supabase";
import { hashPin } from "@/lib/pin";

/**
 * Storage layer — all data access lives here. Backed by Supabase.
 * Every public function returns plain data; components keep calling
 * the same API as the previous localStorage implementation.
 */

// ---------- Row <-> model mapping ----------

interface StudentRow {
  id: string;
  display_name: string;
  avatar_emoji: string;
  avatar_color: number;
  username: string | null;
  pin_hash: string | null;
  is_active: boolean;
  created_at: string;
}

interface BehaviorRow {
  id: string;
  label: string;
  emoji: string;
  points: number;
  is_active: boolean;
  created_at: string;
}

interface TransactionRow {
  id: string;
  student_id: string;
  type: TransactionType;
  amount: number;
  reason: string;
  behavior_id: string | null;
  redemption_id: string | null;
  is_undone: boolean;
  created_at: string;
}

function rowToStudent(r: StudentRow): Student {
  return {
    id: r.id,
    displayName: r.display_name,
    avatarEmoji: r.avatar_emoji,
    avatarColor: r.avatar_color,
    username: r.username,
    hasPin: r.pin_hash !== null,
    isActive: r.is_active,
    createdAt: new Date(r.created_at).getTime(),
  };
}

function rowToBehavior(r: BehaviorRow): Behavior {
  return {
    id: r.id,
    label: r.label,
    emoji: r.emoji,
    points: r.points,
    isActive: r.is_active,
    createdAt: new Date(r.created_at).getTime(),
  };
}

function rowToTransaction(r: TransactionRow): PointTransaction {
  return {
    id: r.id,
    studentId: r.student_id,
    type: r.type,
    amount: r.amount,
    reason: r.reason,
    behaviorId: r.behavior_id ?? undefined,
    redemptionId: r.redemption_id ?? undefined,
    createdAt: new Date(r.created_at).getTime(),
    isUndone: r.is_undone,
  };
}

// ---------- Students ----------

export async function getStudents(): Promise<Student[]> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as StudentRow[]).map(rowToStudent);
}

export async function addStudent(input: {
  displayName: string;
  avatarColor?: number;
  username?: string | null;
  pin?: string | null;
}): Promise<Student> {
  const values: Record<string, unknown> = {
    display_name: input.displayName.trim(),
    avatar_emoji: "",
    avatar_color: input.avatarColor ?? 0,
    username: input.username ?? null,
  };
  if (input.pin) values.pin_hash = await hashPin(input.pin);
  const { data, error } = await supabase
    .from("students")
    .insert(values)
    .select("*")
    .single();
  if (error) throw error;
  return rowToStudent(data as StudentRow);
}

export async function updateStudent(
  id: string,
  patch: Partial<Pick<Student, "displayName" | "avatarColor" | "username">>,
): Promise<void> {
  const values: Record<string, unknown> = {};
  if (patch.displayName !== undefined) values.display_name = patch.displayName.trim();
  if (patch.avatarColor !== undefined) values.avatar_color = patch.avatarColor;
  if (patch.username !== undefined) values.username = patch.username;
  const { error } = await supabase.from("students").update(values).eq("id", id);
  if (error) throw error;
}

export async function setStudentPin(id: string, pin: string): Promise<void> {
  const pin_hash = await hashPin(pin);
  const { error } = await supabase.from("students").update({ pin_hash }).eq("id", id);
  if (error) throw error;
}

export async function deleteStudent(id: string): Promise<void> {
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) throw error;
}

export async function isUsernameTaken(username: string, excludeId?: string): Promise<boolean> {
  let query = supabase.from("students").select("id").eq("username", username).limit(1);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).length > 0;
}

// ---------- Behaviors ----------

export async function getBehaviors(): Promise<Behavior[]> {
  const { data, error } = await supabase
    .from("behaviors")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as BehaviorRow[]).map(rowToBehavior);
}

export async function addBehavior(label: string, emoji: string, points: number): Promise<Behavior> {
  const { data, error } = await supabase
    .from("behaviors")
    .insert({ label: label.trim(), emoji, points })
    .select("*")
    .single();
  if (error) throw error;
  return rowToBehavior(data as BehaviorRow);
}

export async function updateBehavior(
  id: string,
  patch: Partial<Pick<Behavior, "label" | "emoji" | "points">>,
): Promise<void> {
  const values: Record<string, unknown> = {};
  if (patch.label !== undefined) values.label = patch.label.trim();
  if (patch.emoji !== undefined) values.emoji = patch.emoji;
  if (patch.points !== undefined) values.points = patch.points;
  const { error } = await supabase.from("behaviors").update(values).eq("id", id);
  if (error) throw error;
}

export async function deleteBehavior(id: string): Promise<void> {
  // ON DELETE SET NULL keeps past transactions; the log renders them via reason.
  const { error } = await supabase.from("behaviors").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Transactions ----------

export async function getTransactions(): Promise<PointTransaction[]> {
  const { data, error } = await supabase
    .from("point_transactions")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as TransactionRow[]).map(rowToTransaction);
}

export async function addTransactions(
  inputs: {
    studentId: string;
    type: TransactionType;
    amount: number;
    reason: string;
    behaviorId?: string;
  }[],
): Promise<void> {
  const rows = inputs.map((input) => ({
    student_id: input.studentId,
    type: input.type,
    amount: input.amount,
    reason: input.reason,
    behavior_id: input.behaviorId ?? null,
  }));
  const { error } = await supabase.from("point_transactions").insert(rows);
  if (error) throw error;
}

export async function setTransactionUndone(id: string, isUndone: boolean): Promise<void> {
  const { error } = await supabase
    .from("point_transactions")
    .update({ is_undone: isUndone })
    .eq("id", id);
  if (error) throw error;
}

// ---------- Class settings ----------

export async function getClassSettings(): Promise<{
  className: string;
  currencyConfig: CurrencyConfig;
  teacherTheme: ColorTheme;
} | null> {
  const { data, error } = await supabase
    .from("class_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    className: data.class_name,
    currencyConfig: {
      behavior: data.behavior_currency,
      achievement: data.achievement_currency,
    },
    teacherTheme: isColorTheme(data.teacher_theme) ? data.teacher_theme : "genji",
  };
}

export async function createClassSettings(config: CurrencyConfig, className: string): Promise<void> {
  const { error } = await supabase.from("class_settings").insert({
    id: 1,
    class_name: className,
    behavior_currency: config.behavior,
    achievement_currency: config.achievement,
  });
  if (error) throw error;
}

export async function saveCurrencyConfig(config: CurrencyConfig): Promise<void> {
  const { error } = await supabase
    .from("class_settings")
    .update({
      behavior_currency: config.behavior,
      achievement_currency: config.achievement,
    })
    .eq("id", 1);
  if (error) throw error;
}

/** The (single) teacher's console colour theme — a personal preference. */
export async function saveTeacherTheme(theme: ColorTheme): Promise<void> {
  const { error } = await supabase.from("class_settings").update({ teacher_theme: theme }).eq("id", 1);
  if (error) throw error;
}

// ---------- Student self-read (student sessions) ----------

export interface StudentSafeRow {
  id: string;
  display_name: string;
  avatar_emoji: string;
  avatar_color: number;
  behavior_currency: { singular: string; plural: string; icon: string; color: string } | null;
  achievement_currency?: { singular: string; plural: string; icon: string; color: string } | null;
  balance: number;
  lifetime_earned: number;
  goal_target: number | null;
  goal_label: string | null;
  goal_currency?: RewardCurrency | null;
  /** The student's own colour theme preference (null = Genji). */
  theme?: string | null;
  /** Spendable gems (quiz awards minus gem redemptions). */
  gems_balance?: number | null;
  /** Lifetime gems earned from quizzes — never reduced by spending. */
  gems_lifetime?: number | null;
}

export async function getMyStudentRow(): Promise<StudentSafeRow | null> {
  const { data, error } = await supabase.from("students_safe").select("*").maybeSingle();
  if (error) throw error;
  return (data as StudentSafeRow | null) ?? null;
}

export async function getMyTransactions(offset = 0, limit = 20): Promise<TransactionRow[]> {
  const { data, error } = await supabase
    .from("point_transactions")
    .select("*")
    // This feed is the Dollars history only. Quiz gems (achievement rows)
    // are a separate score and never appear here — filtered server-side so
    // paging stays consistent.
    .neq("type", "achievement")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data as TransactionRow[];
}

/** Save the signed-in student's personal goal (the only student write). */
export async function saveMyGoal(goal: {
  target: number | null;
  label: string | null;
  currency?: RewardCurrency | null;
}): Promise<void> {
  // PostgREST requires a WHERE clause on UPDATE. The RLS policy only permits
  // updating the signed-in student's own row, so scoping by user_id is
  // both required by the API and enforced again by the database.
  const { data: me, error: meErr } = await supabase.from("students_safe").select("id").maybeSingle();
  if (meErr) throw meErr;
  if (!me) throw new Error("Could not find your student record.");
  const { error } = await supabase
    .from("students")
    .update({
      goal_target: goal.target,
      goal_label: goal.label,
      goal_currency: goal.target === null ? null : (goal.currency ?? "dollars"),
    })
    .eq("id", me.id);
  if (error) throw error;
}

/** Update the signed-in student's own avatar colour (the second student write). */
export async function updateMyAvatarColor(color: number): Promise<void> {
  const { data: me, error: meErr } = await supabase.from("students_safe").select("id").maybeSingle();
  if (meErr) throw meErr;
  if (!me) throw new Error("Could not find your student record.");
  const { error } = await supabase
    .from("students")
    .update({ avatar_color: color })
    .eq("id", me.id);
  if (error) throw error;
}

/** Update the signed-in student's own colour theme (own row only). */
export async function saveMyTheme(theme: ColorTheme): Promise<void> {
  const { data: me, error: meErr } = await supabase.from("students_safe").select("id").maybeSingle();
  if (meErr) throw meErr;
  if (!me) throw new Error("Could not find your student record.");
  const { error } = await supabase.from("students").update({ theme }).eq("id", me.id);
  if (error) throw error;
}

/** Map a raw transaction row (as returned by getMyTransactions) to the app model. */
export function mapTransactionRow(r: TransactionRow): PointTransaction {
  return rowToTransaction(r);
}

// ---------- Migration helper ----------

export async function insertStudentsRaw(rows: {
  display_name: string;
  avatar_emoji: string;
  avatar_color: number;
}[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("students").insert(rows);
  if (error) throw error;
}

// ---------- Reward shop (teacher) ----------

export interface RewardRow {
  id: string;
  name: string;
  description: string | null;
  cost: number;
  currency?: RewardCurrency | null;
  stock: number | null;
  is_active: boolean;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
  image_url: string | null;
}

function rowToReward(r: RewardRow): Reward {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    cost: r.cost,
    currency: r.currency ?? "dollars",
    stock: r.stock,
    isActive: r.is_active,
    isArchived: r.is_archived,
    sortOrder: r.sort_order,
    createdAt: new Date(r.created_at).getTime(),
    imageUrl: r.image_url ?? null,
  };
}

export async function getRewards(): Promise<Reward[]> {
  const { data, error } = await supabase
    .from("rewards")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as RewardRow[]).map(rowToReward);
}

export async function addReward(input: {
  name: string;
  description?: string | null;
  cost: number;
  currency?: RewardCurrency;
  stock: number | null;
  imageUrl?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("rewards").insert({
    name: input.name.trim(),
    description: input.description?.trim() || null,
    cost: input.cost,
    currency: input.currency ?? "dollars",
    stock: input.stock,
    image_url: input.imageUrl ?? null,
  });
  if (error) throw error;
}

export async function updateReward(
  id: string,
  patch: Partial<Pick<Reward, "name" | "description" | "cost" | "currency" | "stock" | "isActive" | "isArchived" | "sortOrder" | "imageUrl">>,
): Promise<void> {
  const values: Record<string, unknown> = {};
  if (patch.name !== undefined) values.name = patch.name.trim();
  if (patch.description !== undefined) values.description = patch.description?.trim() || null;
  if (patch.cost !== undefined) values.cost = patch.cost;
  if (patch.currency !== undefined) values.currency = patch.currency;
  if (patch.stock !== undefined) values.stock = patch.stock;
  if (patch.isActive !== undefined) values.is_active = patch.isActive;
  if (patch.isArchived !== undefined) values.is_archived = patch.isArchived;
  if (patch.sortOrder !== undefined) values.sort_order = patch.sortOrder;
  if (patch.imageUrl !== undefined) values.image_url = patch.imageUrl;
  if (Object.keys(values).length === 0) return;
  const { error } = await supabase.from("rewards").update(values).eq("id", id);
  if (error) throw error;
}

export async function deleteReward(id: string): Promise<void> {
  // Remove any associated image from storage first.
  const { data: row } = await supabase.from("rewards").select("image_url").eq("id", id).maybeSingle();
  if (row?.image_url) {
    const path = row.image_url.split("/reward-images/").pop();
    if (path) await supabase.storage.from("reward-images").remove([path]).catch(() => {});
  }
  const { error } = await supabase.from("rewards").delete().eq("id", id);
  if (error) throw error;
}

export async function rewardHasRedemptions(id: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("redemptions")
    .select("id", { count: "exact", head: true })
    .eq("reward_id", id);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** True while any student still has a pending request for this reward —
 *  the database blocks changing its currency until these are decided. */
export async function rewardHasPendingRequests(id: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("redemptions")
    .select("id", { count: "exact", head: true })
    .eq("reward_id", id)
    .eq("status", "pending");
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function reorderRewards(ids: string[]): Promise<void> {
  // The list is small; write each sort_order in one parallel batch.
  const updates = ids.map((id, index) =>
    supabase.from("rewards").update({ sort_order: index + 1 }).eq("id", id),
  );
  const results = await Promise.all(updates);
  for (const { error } of results) if (error) throw error;
}

export async function setRewardStock(id: string, stock: number | null): Promise<void> {
  const { error } = await supabase.from("rewards").update({ stock }).eq("id", id);
  if (error) throw error;
}

export interface RedemptionRow {
  id: string;
  student_id: string;
  reward_id: string;
  cost_at_request: number;
  currency: RewardCurrency | null;
  status: RedemptionStatus;
  requested_at: string;
  decided_at: string | null;
  note: string | null;
  rewards?: { name: string } | null;
}
function rowToRedemption(r: RedemptionRow): Redemption {
  return {
    id: r.id,
    studentId: r.student_id,
    rewardId: r.reward_id,
    rewardName: r.rewards?.name ?? undefined,
    costAtRequest: r.cost_at_request,
    currency: r.currency ?? "dollars",
    status: r.status,
    requestedAt: new Date(r.requested_at).getTime(),
    decidedAt: r.decided_at ? new Date(r.decided_at).getTime() : null,
    note: r.note,
  };
}
export async function getRedemptions(): Promise<Redemption[]> {
  const { data, error } = await supabase
    .from("redemptions")
    .select("*, rewards(name)")
    .order("requested_at", { ascending: false });
  if (error) throw error;
  return (data as RedemptionRow[]).map(rowToRedemption);
}
// Server-side decisions. The RPC raises with a message on any failed check;
// surface the message so the teacher sees why nothing was approved.
export async function approveRedemption(id: string, note?: string | null): Promise<void> {
  const { error } = await supabase.rpc("approve_redemption", { p_id: id, p_note: note ?? null });
  if (error) throw new Error(error.message);
}

export async function declineRedemption(id: string, note?: string | null): Promise<void> {
  const { error } = await supabase.rpc("decline_redemption", { p_id: id, p_note: note ?? null });
  if (error) throw new Error(error.message);
}

export async function undoRedemption(id: string): Promise<void> {
  const { error } = await supabase.rpc("undo_redemption", { p_id: id });
  if (error) throw new Error(error.message);
}

// ---------- Reward shop (student) ----------

export async function getShopRewards(): Promise<RewardRow[]> {
  // The RLS policy scopes this to active, non-archived rewards for students.
  const { data, error } = await supabase
    .from("rewards")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as RewardRow[];
}

export interface MyRedemptionRow {
  id: string;
  reward_id: string;
  cost_at_request: number;
  currency: RewardCurrency | null;
  status: RedemptionStatus;
  requested_at: string;
  decided_at: string | null;
  note: string | null;
  rewards?: { name: string } | null;
}

export async function getMyRedemptions(): Promise<MyRedemptionRow[]> {
  // RLS scopes rows to the signed-in student. Select * so the currency
  // snapshot arrives as soon as the column exists.
  const { data, error } = await supabase
    .from("redemptions")
    .select("*, rewards(name)")
    .order("requested_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as unknown as MyRedemptionRow[]) ?? [];
}

/** Request a reward. All checks (price snapshot, balance, duplicates) run server-side. */
export async function requestReward(rewardId: string): Promise<void> {
  const { error } = await supabase.rpc("request_reward", { p_reward_id: rewardId });
  if (error) throw new Error(error.message);
}

/** Cancel the signed-in student's own pending request. */
export async function cancelMyRedemption(id: string): Promise<void> {
  const { error } = await supabase.from("redemptions").update({ status: "cancelled" }).eq("id", id);
  if (error) throw error;
}

export async function insertBehaviorsRaw(rows: {
  label: string;
  emoji: string;
  points: number;
}[]): Promise<string[]> {
  if (rows.length === 0) return [];
  const { data, error } = await supabase.from("behaviors").insert(rows).select("id");
  if (error) throw error;
  return (data as { id: string }[]).map((r) => r.id);
}

export async function insertTransactionsRaw(rows: {
  student_id: string;
  type: TransactionType;
  amount: number;
  reason: string;
  is_undone: boolean;
  created_at: string;
}[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("point_transactions").insert(rows);
  if (error) throw error;
}

// ---------- Quizzes (teacher) ----------

export interface QuizRow {
  id: string;
  title: string;
  description: string | null;
  max_gems: number;
  due_at: string;
  status: QuizStatus;
  archived_at: string | null;
  created_at: string;
}

function rowToQuiz(r: QuizRow): Quiz {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    maxGems: r.max_gems,
    dueAt: new Date(r.due_at).getTime(),
    status: r.status,
    archivedAt: r.archived_at ? new Date(r.archived_at).getTime() : null,
    createdAt: new Date(r.created_at).getTime(),
  };
}

export async function getQuizzes(): Promise<QuizSummary[]> {
  const [quizRes, questionRes, assignmentRes, attemptRes] = await Promise.all([
    supabase.from("quizzes").select("*").order("due_at", { ascending: true }),
    supabase.from("quiz_questions").select("quiz_id"),
    supabase.from("quiz_assignments").select("quiz_id"),
    supabase.from("quiz_attempts").select("quiz_id, submitted_at"),
  ]);
  const qErr = quizRes.error ?? questionRes.error ?? assignmentRes.error ?? attemptRes.error;
  if (qErr) throw qErr;

  const questionCounts = new Map<string, number>();
  for (const r of (questionRes.data ?? []) as { quiz_id: string }[])
    questionCounts.set(r.quiz_id, (questionCounts.get(r.quiz_id) ?? 0) + 1);

  const assignedCounts = new Map<string, number>();
  for (const r of (assignmentRes.data ?? []) as { quiz_id: string }[])
    assignedCounts.set(r.quiz_id, (assignedCounts.get(r.quiz_id) ?? 0) + 1);

  const startedCounts = new Map<string, number>();
  const submittedCounts = new Map<string, number>();
  for (const r of (attemptRes.data ?? []) as { quiz_id: string; submitted_at: string | null }[]) {
    startedCounts.set(r.quiz_id, (startedCounts.get(r.quiz_id) ?? 0) + 1);
    if (r.submitted_at) submittedCounts.set(r.quiz_id, (submittedCounts.get(r.quiz_id) ?? 0) + 1);
  }

  return (quizRes.data as QuizRow[]).map((r) => ({
    ...rowToQuiz(r),
    questionCount: questionCounts.get(r.id) ?? 0,
    assignedCount: assignedCounts.get(r.id) ?? 0,
    startedCount: startedCounts.get(r.id) ?? 0,
    submittedCount: submittedCounts.get(r.id) ?? 0,
  }));
}

export interface QuizQuestionDraft {
  body: string;
  type: QuizQuestionType;
  position: number;
  options: { body: string; isCorrect: boolean; position: number }[];
}

export interface QuizDetail {
  quiz: Quiz;
  questions: QuizQuestion[];
  assignedStudentIds: string[];
}

export async function getQuizDetail(quizId: string): Promise<QuizDetail> {
  const [quizRes, questionRes, assignmentRes] = await Promise.all([
    supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle(),
    supabase.from("quiz_questions").select("*").eq("quiz_id", quizId).order("position").order("created_at"),
    supabase.from("quiz_assignments").select("student_id").eq("quiz_id", quizId),
  ]);
  const err0 = quizRes.error ?? questionRes.error ?? assignmentRes.error;
  if (err0) throw err0;
  if (!quizRes.data) throw new Error("Quiz not found");

  const questions = (questionRes.data ?? []) as {
    id: string; quiz_id: string; body: string; type: QuizQuestionType; position: number;
  }[];
  const optionRes = await supabase
    .from("quiz_options")
    .select("*")
    .in(
      "question_id",
      questions.length ? questions.map((q) => q.id) : ["00000000-0000-0000-0000-000000000000"],
    )
    .order("position")
    .order("created_at");
  if (optionRes.error) throw optionRes.error;

  const optionsByQuestion = new Map<string, QuizOption[]>();
  for (const o of (optionRes.data ?? []) as {
    id: string; question_id: string; body: string; is_correct: boolean; position: number;
  }[]) {
    const list = optionsByQuestion.get(o.question_id) ?? [];
    list.push({
      id: o.id,
      questionId: o.question_id,
      body: o.body,
      isCorrect: o.is_correct,
      position: o.position,
    });
    optionsByQuestion.set(o.question_id, list);
  }

  return {
    quiz: rowToQuiz(quizRes.data as QuizRow),
    questions: questions.map((q) => ({
      id: q.id,
      quizId: q.quiz_id,
      body: q.body,
      type: q.type,
      position: q.position,
      options: optionsByQuestion.get(q.id) ?? [],
    })),
    assignedStudentIds: ((assignmentRes.data ?? []) as { student_id: string }[]).map((a) => a.student_id),
  };
}

export async function saveQuizMeta(input: {
  id?: string;
  title: string;
  description: string | null;
  maxGems: number;
  dueAt: number;
}): Promise<string> {
  const values = {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    max_gems: input.maxGems,
    due_at: new Date(input.dueAt).toISOString(),
  };
  if (input.id) {
    const { error } = await supabase.from("quizzes").update(values).eq("id", input.id);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await supabase.from("quizzes").insert(values).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * Replace the quiz's whole question set. Only ever called while the quiz has
 * no attempts (the editor blocks structural edits afterwards), so rewriting
* instead of diffing is safe and keeps ids stable between edits.
 */
export async function saveQuizQuestions(quizId: string, questions: QuizQuestionDraft[]): Promise<void> {
  const { error: delErr } = await supabase.from("quiz_questions").delete().eq("quiz_id", quizId);
  if (delErr) throw delErr;
  if (questions.length === 0) return;

  const { data: inserted, error: qErr } = await supabase
    .from("quiz_questions")
    .insert(
      questions.map((q) => ({
        quiz_id: quizId,
        body: q.body.trim(),
        type: q.type,
        position: q.position,
      })),
    )
    .select("id, position")
    .order("position");
  if (qErr) throw qErr;

  // Rows come back in insert (position) order, matching the draft order.
  const rows = (inserted ?? []) as { id: string }[];
  const optionRows = questions.flatMap((q, i) =>
    q.options.map((o) => ({
      question_id: rows[i]?.id,
      body: o.body.trim(),
      is_correct: o.isCorrect,
      position: o.position,
    })),
  );
  const valid = optionRows.filter((o) => o.question_id);
  if (valid.length > 0) {
    const { error: oErr } = await supabase.from("quiz_options").insert(valid);
    if (oErr) throw oErr;
  }
}

export async function saveQuizAssignments(quizId: string, studentIds: string[]): Promise<void> {
  const { error: delErr } = await supabase.from("quiz_assignments").delete().eq("quiz_id", quizId);
  if (delErr) throw delErr;
  if (studentIds.length === 0) return;
  const { error } = await supabase
    .from("quiz_assignments")
    .insert(studentIds.map((student_id) => ({ quiz_id: quizId, student_id })));
  if (error) throw error;
}

export async function setQuizStatus(id: string, status: QuizStatus): Promise<void> {
  const { error } = await supabase.from("quizzes").update({ status }).eq("id", id);
  if (error) throw error;
}

/** Archive (or restore) a quiz. Archived quizzes are hidden from students
 *  entirely and filed under the teacher list's Archived section. */
export async function setQuizArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await supabase
    .from("quizzes")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}

/** Reopen a closed quiz as published with a fresh future due date. */
export async function reopenQuiz(id: string, dueAt: number): Promise<void> {
  const { error } = await supabase
    .from("quizzes")
    .update({ status: "published", due_at: new Date(dueAt).toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteQuiz(id: string): Promise<void> {
  const { error } = await supabase.from("quizzes").delete().eq("id", id);
  if (error) throw error;
}

export interface QuizAttemptRow {
  id: string;
  quiz_id: string;
  student_id: string;
  started_at: string;
  submitted_at: string | null;
  correct_count: number | null;
  total_count: number | null;
  gems_awarded: number | null;
}

export function rowToAttempt(r: QuizAttemptRow): QuizAttempt {
  return {
    id: r.id,
    quizId: r.quiz_id,
    studentId: r.student_id,
    startedAt: new Date(r.started_at).getTime(),
    submittedAt: r.submitted_at ? new Date(r.submitted_at).getTime() : null,
    correctCount: r.correct_count,
    totalCount: r.total_count,
    gemsAwarded: r.gems_awarded,
  };
}

export async function getQuizAttempts(quizId: string): Promise<QuizAttempt[]> {
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("quiz_id", quizId)
    .order("started_at", { ascending: true });
  if (error) throw error;
  return (data as QuizAttemptRow[]).map(rowToAttempt);
}

/** Every saved answer for one quiz, keyed by (attempt, question). */
export async function getQuizAnswerSheet(quizId: string): Promise<{
  attemptIds: string[];
  answers: { attemptId: string; questionId: string; selectedOptionId: string }[];
}> {
  const { data: attemptRes, error: aErr } = await supabase
    .from("quiz_attempts")
    .select("id")
    .eq("quiz_id", quizId);
  if (aErr) throw aErr;
  const attemptIds = ((attemptRes ?? []) as { id: string }[]).map((r) => r.id);
  if (attemptIds.length === 0) return { attemptIds, answers: [] };
  const { data, error } = await supabase
    .from("quiz_answers")
    .select("attempt_id, question_id, selected_option_id")
    .in("attempt_id", attemptIds);
  if (error) throw error;
  return {
    attemptIds,
    answers: ((data ?? []) as {
      attempt_id: string; question_id: string; selected_option_id: string;
    }[]).map((r) => ({
      attemptId: r.attempt_id,
      questionId: r.question_id,
      selectedOptionId: r.selected_option_id,
    })),
  };
}

// ---------- Quizzes (student) ----------

export interface MyQuizItem {
  quizId: string;
  title: string;
  dueAt: number;
  status: QuizStatus;
  maxGems: number;
  questionCount: number;
  attemptId: string | null;
  submitted: boolean;
  submittedAt: number | null;
  correctCount: number | null;
  totalCount: number | null;
  gemsAwarded: number | null;
  answeredCount: number;
}

export async function getMyQuizList(): Promise<MyQuizItem[]> {
  const { data, error } = await supabase.rpc("my_quiz_list");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as {
    quiz_id: string; title: string; due_at: string; status: QuizStatus; max_gems: number;
    question_count: number; attempt_id: string | null; submitted_at: string | null;
    correct_count: number | null; total_count: number | null; gems_awarded: number | null;
    answered_count: number | null;
  }[];
  return rows.map((r) => ({
    quizId: r.quiz_id,
    title: r.title,
    dueAt: new Date(r.due_at).getTime(),
    status: r.status,
    maxGems: r.max_gems,
    questionCount: r.question_count,
    attemptId: r.attempt_id,
    submitted: r.submitted_at !== null,
    submittedAt: r.submitted_at ? new Date(r.submitted_at).getTime() : null,
    correctCount: r.correct_count,
    totalCount: r.total_count,
    gemsAwarded: r.gems_awarded,
    answeredCount: r.answered_count ?? 0,
  }));
}

export interface MyQuizQuestion {
  id: string;
  body: string;
  type: QuizQuestionType;
  position: number;
  options: { id: string; body: string; position: number }[];
}

/** Questions + options WITHOUT is_correct — the RPC never emits it. */
export async function getMyQuizQuestions(quizId: string): Promise<MyQuizQuestion[]> {
  const { data, error } = await supabase.rpc("my_quiz_questions", { p_quiz_id: quizId });
  if (error) throw new Error(error.message);
  return (data ?? []) as MyQuizQuestion[];
}

/** Start (or resume) the caller's single attempt on a quiz. */
export async function startMyQuizAttempt(quizId: string): Promise<QuizAttempt> {
  const { data: me, error: meErr } = await supabase.from("students_safe").select("id").maybeSingle();
  if (meErr) throw meErr;
  if (!me) throw new Error("Could not find your student record.");
  const { data, error } = await supabase
    .from("quiz_attempts")
    .insert({ quiz_id: quizId, student_id: me.id })
    .select("*")
    .maybeSingle();
  if (error) {
    // Unique violation = attempt already exists (e.g. started on another tab).
    if (error.code === "23505") return getMyAttemptForQuiz(quizId);
    throw new Error(error.message);
  }
  return rowToAttempt(data as QuizAttemptRow);
}

export async function getMyAttemptForQuiz(quizId: string): Promise<QuizAttempt> {
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("quiz_id", quizId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No attempt found for this quiz");
  return rowToAttempt(data as QuizAttemptRow);
}

/** Save one answer immediately (upsert on (attempt, question)). */
export async function saveMyQuizAnswer(
  attemptId: string,
  questionId: string,
  optionId: string,
): Promise<void> {
  const { error } = await supabase
    .from("quiz_answers")
    .upsert(
      { attempt_id: attemptId, question_id: questionId, selected_option_id: optionId },
      { onConflict: "attempt_id,question_id" },
    );
  if (error) throw new Error(error.message);
}

export async function getMyQuizAnswers(attemptId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("quiz_answers")
    .select("question_id, selected_option_id")
    .eq("attempt_id", attemptId);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const r of (data ?? []) as { question_id: string; selected_option_id: string }[])
    map[r.question_id] = r.selected_option_id;
  return map;
}

export interface SubmitResult {
  correctCount: number;
  totalCount: number;
  gemsAwarded: number;
  alreadySubmitted: boolean;
}

/** Server-side scoring + gem award. Idempotent against double submits. */
export async function submitMyQuizAttempt(attemptId: string): Promise<SubmitResult> {
  const { data, error } = await supabase.rpc("submit_quiz_attempt", { p_attempt_id: attemptId });
  if (error) throw new Error(error.message);
  const r = data as {
    correct_count: number; total_count: number; gems_awarded: number; already_submitted: boolean;
  };
  return {
    correctCount: r.correct_count,
    totalCount: r.total_count,
    gemsAwarded: r.gems_awarded,
    alreadySubmitted: r.already_submitted,
  };
}

export interface MyAttemptReview {
  title: string;
  correctCount: number;
  totalCount: number;
  gemsAwarded: number;
  questions: {
    id: string;
    body: string;
    type: string;
    position: number;
    myOptionId: string | null;
    myOptionBody: string | null;
    correctOptionId: string;
    correctOptionBody: string;
    isCorrect: boolean;
  }[];
}

/** Post-submit review — only ever returns the caller's own submitted attempt. */
export async function getMyAttemptReview(attemptId: string): Promise<MyAttemptReview | null> {
  const { data, error } = await supabase.rpc("my_attempt_review", { p_attempt_id: attemptId });
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as {
    title: string; correct_count: number; total_count: number; gems_awarded: number;
    questions: {
      id: string; body: string; type: string; position: number;
      my_option_id: string | null; my_option_body: string | null;
      correct_option_id: string; correct_option_body: string; is_correct: boolean;
    }[];
  };
  return {
    title: r.title,
    correctCount: r.correct_count,
    totalCount: r.total_count,
    gemsAwarded: r.gems_awarded,
    questions: r.questions.map((q) => ({
      id: q.id,
      body: q.body,
      type: q.type,
      position: q.position,
      myOptionId: q.my_option_id,
      myOptionBody: q.my_option_body,
      correctOptionId: q.correct_option_id,
      correctOptionBody: q.correct_option_body,
      isCorrect: q.is_correct,
    })),
  };
}
