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
  | "Spark";

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
  stock: number | null; // null = unlimited
  isActive: boolean;
  isArchived: boolean;
  sortOrder: number;
  createdAt: number;
  imageUrl: string | null;
}

export type RedemptionStatus = "pending" | "approved" | "declined" | "cancelled";

export interface Redemption {
  id: string;
  studentId: string;
  rewardId: string;
  rewardName?: string;
  costAtRequest: number;
  status: RedemptionStatus;
  requestedAt: number;
  decidedAt: number | null;
  note: string | null;
}
