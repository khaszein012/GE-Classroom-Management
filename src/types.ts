export type TransactionType = "behavior" | "achievement" | "spend" | "adjustment";

export interface Student {
  id: string;
  displayName: string;
  avatarEmoji: string;
  avatarColor: number;
  username: string | null;
  hasPin: boolean;
  isActive: boolean;
  createdAt: number;
}

export interface Behavior {
  id: string;
  label: string;
  emoji: string;
  points: number; // positive or negative
  isActive: boolean;
  createdAt: number;
}

export type CurrencyKind = "behavior" | "achievement";

export type CurrencyIconName =
  | "Star"
  | "Ticket"
  | "Gem"
  | "Diamond"
  | "Coins"
  | "DollarSign"
  | "Trophy"
  | "Medal"
  | "Zap"
  | "Heart"
  | "Crown"
  | "Sparkles"
  | "Spark"
  | "Clover"
  | "Leaf"
  | "Flame"
  | "Snowflake"
  | "Droplets"
  | "Rainbow"
  | "Rocket"
  | "Feather"
  | "Shell"
  | "Music"
  | "Gamepad2"
  | "Candy"
  | "Hexagon";

export type CurrencyColor =
  | "amber"
  | "violet"
  | "emerald"
  | "sky"
  | "rose"
  | "orange"
  | "teal"
  | "slate";

export interface CurrencySettings {
  singular: string;
  plural: string;
  icon: CurrencyIconName;
  color: CurrencyColor;
}

export type CurrencyConfig = Record<CurrencyKind, CurrencySettings>;

export interface PointTransaction {
  id: string;
  studentId: string;
  type: TransactionType;
  amount: number; // can be negative
  reason: string;
  behaviorId?: string;
  redemptionId?: string;
  createdAt: number;
  isUndone: boolean;
}

export interface Reward {
  id: string;
  name: string;
  description: string | null;
  cost: number; // positive integer
  currency: RewardCurrency;
  stock: number | null; // null = unlimited
  isActive: boolean;
  isArchived: boolean;
  sortOrder: number;
  createdAt: number;
  imageUrl: string | null;
}

export type RedemptionStatus = "pending" | "approved" | "declined" | "cancelled";

/** Which sealed economy a price or request belongs to. */
export type RewardCurrency = "dollars" | "gems";

export interface Redemption {
  id: string;
  studentId: string;
  rewardId: string;
  rewardName?: string;
  costAtRequest: number;
  currency: RewardCurrency;
  status: RedemptionStatus;
  requestedAt: number;
  decidedAt: number | null;
  note: string | null;
}

// ---------- Quizzes ----------

export type QuizStatus = "draft" | "published" | "closed";
export type QuizQuestionType = "multiple_choice" | "true_false";

export interface Quiz {
  id: string;
  title: string;
  description: string | null;
  maxGems: number;
  dueAt: number;
  status: QuizStatus;
  /** NULL = not archived. Archived quizzes are hidden from students and
   *  filed under the teacher list's Archived section. */
  archivedAt: number | null;
  createdAt: number;
}

/** Quiz row as shown in the teacher list, with aggregated counts. */
export interface QuizSummary extends Quiz {
  questionCount: number;
  assignedCount: number;
  startedCount: number;
  submittedCount: number;
}

export interface QuizOption {
  id: string;
  questionId: string;
  body: string;
  isCorrect: boolean;
  position: number;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  body: string;
  type: QuizQuestionType;
  position: number;
  options: QuizOption[];
}

/** One student's attempt on a quiz. */
export interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  startedAt: number;
  submittedAt: number | null;
  correctCount: number | null;
  totalCount: number | null;
  gemsAwarded: number | null;
}
