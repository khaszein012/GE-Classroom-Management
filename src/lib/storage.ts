import type { Behavior, CurrencyConfig, PointTransaction, Redemption, RedemptionStatus, Reward, Student, TransactionType } from "@/types";
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

// ---------- Student self-read (student sessions) ----------

export interface StudentSafeRow {
  id: string;
  display_name: string;
  avatar_emoji: string;
  avatar_color: number;
  behavior_currency: { singular: string; plural: string; icon: string; color: string } | null;
  balance: number;
  lifetime_earned: number;
  goal_target: number | null;
  goal_label: string | null;
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
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data as TransactionRow[];
}

/** Save the signed-in student's personal goal (the only student write). */
export async function saveMyGoal(goal: { target: number | null; label: string | null }): Promise<void> {
  // PostgREST requires a WHERE clause on UPDATE. The RLS policy only permits
  // updating the signed-in student's own row, so scoping by user_id is
  // both required by the API and enforced again by the database.
  const { data: me, error: meErr } = await supabase.from("students_safe").select("id").maybeSingle();
  if (meErr) throw meErr;
  if (!me) throw new Error("Could not find your student record.");
  const { error } = await supabase
    .from("students")
    .update({ goal_target: goal.target, goal_label: goal.label })
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
  stock: number | null;
  imageUrl?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("rewards").insert({
    name: input.name.trim(),
    description: input.description?.trim() || null,
    cost: input.cost,
    stock: input.stock,
    image_url: input.imageUrl ?? null,
  });
  if (error) throw error;
}

export async function updateReward(
  id: string,
  patch: Partial<Pick<Reward, "name" | "description" | "cost" | "stock" | "isActive" | "isArchived" | "sortOrder" | "imageUrl">>,
): Promise<void> {
  const values: Record<string, unknown> = {};
  if (patch.name !== undefined) values.name = patch.name.trim();
  if (patch.description !== undefined) values.description = patch.description?.trim() || null;
  if (patch.cost !== undefined) values.cost = patch.cost;
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
  status: RedemptionStatus;
  requested_at: string;
  decided_at: string | null;
  note: string | null;
  rewards?: { name: string } | null;
}

export async function getMyRedemptions(): Promise<MyRedemptionRow[]> {
  // RLS scopes rows to the signed-in student.
  const { data, error } = await supabase
    .from("redemptions")
    .select("id, reward_id, cost_at_request, status, requested_at, decided_at, note, rewards(name)")
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
