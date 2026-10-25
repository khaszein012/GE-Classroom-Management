import {
  Coins,
  Crown,
  Diamond,
  DollarSign,
  Gem,
  Heart,
  Medal,
  Sparkles,
  Star,
  Ticket,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { CurrencyIconName, CurrencyKind } from "@/types";
import { CURRENCY_COLORS } from "@/lib/currency";
import { useCurrency } from "@/components/CurrencyProvider";

const ICONS: Record<CurrencyIconName, LucideIcon> = {
  Star,
  Ticket,
  Gem,
  Diamond,
  Coins,
  DollarSign,
  Trophy,
  Medal,
  Zap,
  Heart,
  Crown,
  Sparkles,
  Spark: Sparkles,
};

export function CurrencyIcon({
  name,
  className = "h-4 w-4",
  strokeWidth = 2,
}: {
  name: CurrencyIconName;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = ICONS[name];
  return <Icon className={className} strokeWidth={strokeWidth} />;
}

interface Props {
  amount: number;
  kind?: CurrencyKind;
  /** "compact" = icon + number; "full" = icon + number + name */
  variant?: "compact" | "full";
  signed?: boolean;
  decimals?: number;
  className?: string;
  iconClassName?: string;
}

export function CurrencyAmount({
  amount,
  kind = "behavior",
  variant = "full",
  signed = false,
  decimals,
  className = "",
  iconClassName = "h-4 w-4",
}: Props) {
  const { config } = useCurrency();
  const settings = config[kind];
  const sign = signed && amount > 0 ? "+" : "";
  const number = decimals !== undefined ? amount.toFixed(decimals) : String(amount);
  // Singular only for exactly 1 or -1; plural for everything else, including 0.
  const name = Math.abs(amount) === 1 ? settings.singular : settings.plural;

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <CurrencyIcon
        name={settings.icon}
        className={`shrink-0 ${CURRENCY_COLORS[settings.color].icon} ${iconClassName}`}
        strokeWidth={2.25}
      />
      <span className="font-mono tabular-nums">
        {sign}
        {number}
        {variant === "full" && ` ${name}`}
      </span>
    </span>
  );
}
