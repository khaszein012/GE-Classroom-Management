/**
 * Which "mood" a student's nameplate is in right now.
 *
 * Dynamic nameplates have two independent layers:
 *   1. ambient — the style's own sheen (owned artwork, always on)
 *   2. earned  — this file: a reaction to something the student did
 *
 * Only one earned state is shown at a time (priority below), because two
 * pulsing things on one name is noise on a projector at the back of a room.
 *
 * Everything here is derived from data the dashboard already holds — no new
 * columns, no RPCs, nothing stored. Rules are positive-only on purpose: a
 * plate is a badge of something good. We deliberately do NOT react to a
 * negative balance or a missed streak; the balance itself already says that,
 * and the teacher dashboard is a shared, often projected surface.
 */

export type NameStateId = "calm" | "close" | "streak" | "goal";

export interface NameStateInput {
  /** The student's personal goal target, if they set one. */
  goalTarget?: number | null;
  /** The balance that goal counts against (tickets, or gems for gem goals). */
  goalBalance?: number;
  /** The class goal target, if the teacher set one. */
  classGoalTarget?: number | null;
  /** How much the class has earned together. */
  classGoalEarned?: number;
  /** Current consecutive-day earning streak. */
  currentStreak?: number;
}

export interface NameState {
  id: NameStateId;
  /** Plain-language equivalent, used as the tooltip. Empty when calm. */
  label: string;
}

export const NAME_STATE_LABEL: Record<NameStateId, string> = {
  goal: "Goal reached",
  streak: "On a streak",
  close: "Almost at your goal",
  calm: "",
};

/** A goal this close to its target reads as motivating, not as a nag. */
const CLOSE_RATIO = 0.8;

/** Matches the "Warming Up" achievement — the first streak worth showing. */
const STREAK_MIN = 3;

export function nameStateFor(input: NameStateInput): NameState {
  const goalTarget = input.goalTarget ?? null;
  const goalBalance = input.goalBalance ?? 0;
  const classTarget = input.classGoalTarget ?? null;
  const classEarned = input.classGoalEarned ?? 0;
  const streak = input.currentStreak ?? 0;

  const personalDone = goalTarget !== null && goalTarget > 0 && goalBalance >= goalTarget;
  const classDone = classTarget !== null && classTarget > 0 && classEarned >= classTarget;

  let id: NameStateId;
  if (personalDone || classDone) {
    id = "goal";
  } else if (streak >= STREAK_MIN) {
    id = "streak";
  } else if (goalTarget !== null && goalTarget > 0 && goalBalance / goalTarget >= CLOSE_RATIO) {
    id = "close";
  } else {
    id = "calm";
  }

  return { id, label: NAME_STATE_LABEL[id] };
}