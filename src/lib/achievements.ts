import {
  Award,
  BookOpenCheck,
  CalendarCheck,
  CalendarHeart,
  CalendarRange,
  ClipboardCheck,
  Coins,
  Crown,
  Flame,
  Footprints,
  Gift,
  GraduationCap,
  Rocket,
  Sparkles,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Aggregate stats from my_achievement_stats() plus the client-computed streaks. */
export interface AchievementStats {
  total_awards: number;
  lifetime_earned: number;
  quizzes_taken: number;
  perfect_quizzes: number;
  rewards_redeemed: number;
  /** Local-timezone ISO dates (YYYY-MM-DD) with at least one award. */
  award_days: string[];
  current_streak: number;
  longest_streak: number;
}

/** Consecutive-day streaks from a set of local calendar-day keys. */
function streaksFromDays(dayKeys: string[]): { current: number; longest: number } {
  if (dayKeys.length === 0) return { current: 0, longest: 0 };
  const days = new Set(dayKeys);
  const dayKey = (ts: number) => {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.toDateString();
  };

  // Current streak: walk back from today (or yesterday, so a morning check
  // after yesterday's award doesn't break it).
  let current = 0;
  let cursor = Date.now();
  if (!days.has(dayKey(cursor))) cursor -= 86_400_000;
  while (days.has(dayKey(cursor))) {
    current += 1;
    cursor -= 86_400_000;
  }

  // Longest streak: scan all known days.
  const sorted = [...days].map((s) => new Date(s).getTime()).sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const ts of sorted) {
    run = prev !== null && ts - prev === 86_400_000 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = ts;
  }
  return { current, longest: Math.max(longest, current) };
}

/**
 * Map award timestamps to the viewer's LOCAL calendar day.
 *
 * The RPC used to emit UTC dates; parsed as local midnight those shifted
 * every award before the UTC offset onto the previous day (e.g. before
 * 07:00 in UTC+7), breaking streaks. Bucketing raw timestamps here keeps
 * the day boundary where the teacher and students actually live.
 */
function localDayKey(iso: string | number): string {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.toDateString();
}

/** YYYY-MM-DD in local time, for display and persistence. */
function toLocalIsoDate(dayKey: string): string {
  const d = new Date(dayKey);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function buildAchievementStats(raw: {
  total_awards: number;
  lifetime_earned: number;
  quizzes_taken: number;
  perfect_quizzes: number;
  rewards_redeemed: number;
  /** Preferred: raw award timestamps, bucketed locally. */
  award_times?: string[];
  /** Legacy UTC dates, used only before the 20261031150000 migration. */
  award_days?: string[];
}): AchievementStats {
  const dayKeys = raw.award_times?.length
    ? [...new Set(raw.award_times.map(localDayKey))]
    : (raw.award_days ?? []).map((d) => localDayKey(`${d}T00:00:00`));

  const { current, longest } = streaksFromDays(dayKeys);
  return {
    ...raw,
    award_days: dayKeys.map(toLocalIsoDate).sort(),
    current_streak: current,
    longest_streak: longest,
  };
}

export interface AchievementDef {
  id: string;
  title: string;
  requirement: string;
  icon: LucideIcon;
  have: (s: AchievementStats) => number;
  need: number;
  /** Level-gated badges use the derived level instead of a stat. */
  levelGate?: number;
}

/** Milestone badges — `have/need` drives both unlock state and progress. */
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-award", title: "First Steps", requirement: "Earn your first award", icon: Footprints, have: (s) => s.total_awards, need: 1 },
  { id: "awards-10", title: "On a Roll", requirement: "Earn 10 awards", icon: Zap, have: (s) => s.total_awards, need: 10 },
  { id: "awards-50", title: "Class Legend", requirement: "Earn 50 awards", icon: Flame, have: (s) => s.total_awards, need: 50 },
  { id: "awards-100", title: "Century", requirement: "Earn 100 awards", icon: Rocket, have: (s) => s.total_awards, need: 100 },
  { id: "earned-100", title: "Savings Club", requirement: "Earn 100 in total", icon: Coins, have: (s) => s.lifetime_earned, need: 100 },
  { id: "earned-250", title: "High Earner", requirement: "Earn 250 in total", icon: Crown, have: (s) => s.lifetime_earned, need: 250 },
  { id: "earned-500", title: "Hall of Fame", requirement: "Earn 500 in total", icon: Trophy, have: (s) => s.lifetime_earned, need: 500 },
  { id: "level-3", title: "Rising Star", requirement: "Reach Level 3", icon: Sparkles, have: (s) => s.lifetime_earned, need: 0, levelGate: 3 },
  { id: "level-5", title: "Champion", requirement: "Reach Level 5", icon: Award, have: (s) => s.lifetime_earned, need: 0, levelGate: 5 },
  { id: "quiz-1", title: "Quiz Rookie", requirement: "Submit your first quiz", icon: ClipboardCheck, have: (s) => s.quizzes_taken, need: 1 },
  { id: "quiz-5", title: "Scholar", requirement: "Submit 5 quizzes", icon: GraduationCap, have: (s) => s.quizzes_taken, need: 5 },
  { id: "quiz-perfect", title: "Perfect Score", requirement: "Ace a quiz", icon: BookOpenCheck, have: (s) => s.perfect_quizzes, need: 1 },
  { id: "streak-3", title: "Warming Up", requirement: "3-day earning streak", icon: CalendarCheck, have: (s) => s.current_streak, need: 3 },
  { id: "streak-7", title: "On Fire", requirement: "7-day earning streak", icon: Flame, have: (s) => Math.max(s.current_streak, s.longest_streak), need: 7 },
  { id: "streak-14", title: "Unstoppable", requirement: "14-day earning streak", icon: CalendarRange, have: (s) => Math.max(s.current_streak, s.longest_streak), need: 14 },
  { id: "streak-30", title: "Iron Will", requirement: "30-day earning streak", icon: CalendarHeart, have: (s) => Math.max(s.current_streak, s.longest_streak), need: 30 },
  { id: "redeem-1", title: "First Treat", requirement: "Redeem your first reward", icon: Gift, have: (s) => s.rewards_redeemed, need: 1 },
  { id: "redeem-5", title: "Shopping Spree", requirement: "Redeem 5 rewards", icon: Gift, have: (s) => s.rewards_redeemed, need: 5 },
];

export interface AchievementState extends AchievementDef {
  unlocked: boolean;
  progressPct: number;
  progressText: string;
}

export function evaluateAchievements(
  s: AchievementStats,
  level: number,
): AchievementState[] {
  return ACHIEVEMENTS.map((def) => {
    let have: number;
    let need: number;
    if (def.levelGate) {
      have = level;
      need = def.levelGate;
    } else {
      have = def.have(s);
      need = def.need;
    }
    const unlocked = have >= need;
    return {
      ...def,
      unlocked,
      progressPct: unlocked ? 100 : Math.min(99, Math.round((have / need) * 100)),
      progressText: unlocked ? def.requirement : `${def.requirement} (${Math.min(have, need)}/${need})`,
    };
  });
}
