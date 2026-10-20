import type { CurrencyColor, CurrencyConfig, CurrencyIconName, CurrencyKind, CurrencySettings, TransactionType } from "@/types";

export const CURRENCY_NAME_MAX = 16;

export const CURRENCY_ICONS: CurrencyIconName[] = [
  "Star", "Ticket", "Gem", "Diamond", "Coins", "DollarSign", "Trophy", "Medal", "Zap", "Heart", "Crown", "Sparkles", "Spark",
];

export const CURRENCY_COLORS: Record<CurrencyColor, { icon: string; swatch: string; soft: string }> = {
  amber: { icon: "text-deep-gold dark:text-antique-gold", swatch: "bg-antique-gold", soft: "bg-ivory-dim dark:bg-antique-gold/10" },
  violet: { icon: "text-deep-gold dark:text-antique-gold", swatch: "bg-deep-gold", soft: "bg-ivory-dim dark:bg-antique-gold/10" },
  emerald: { icon: "text-deep-gold dark:text-antique-gold", swatch: "bg-deep-gold", soft: "bg-ivory-dim dark:bg-antique-gold/10" },
  sky: { icon: "text-deep-gold dark:text-antique-gold", swatch: "bg-antique-gold", soft: "bg-ivory-dim dark:bg-antique-gold/10" },
  rose: { icon: "text-warm-brick dark:text-brick-light", swatch: "bg-warm-brick", soft: "bg-warm-brick/10 dark:bg-brick-light/10" },
  orange: { icon: "text-deep-gold dark:text-antique-gold", swatch: "bg-deep-gold", soft: "bg-ivory-dim dark:bg-antique-gold/10" },
  teal: { icon: "text-deep-gold dark:text-antique-gold", swatch: "bg-deep-gold", soft: "bg-ivory-dim dark:bg-antique-gold/10" },
  slate: { icon: "text-obsidian dark:text-warm-ivory", swatch: "bg-obsidian", soft: "bg-ivory-dim dark:bg-ink-800" },
};

export const CURRENCY_PRESETS: { label: string; singular: string; plural: string; icon: CurrencyIconName }[] = [
  { label: "Stars", singular: "Star", plural: "Stars", icon: "Star" },
  { label: "Tickets", singular: "Ticket", plural: "Tickets", icon: "Ticket" },
  { label: "Gems", singular: "Gem", plural: "Gems", icon: "Gem" },
  { label: "Diamonds", singular: "Diamond", plural: "Diamonds", icon: "Diamond" },
  { label: "Coins", singular: "Coin", plural: "Coins", icon: "Coins" },
  { label: "Dollars", singular: "Dollar", plural: "Dollars", icon: "DollarSign" },
  { label: "Trophies", singular: "Trophy", plural: "Trophies", icon: "Trophy" },
  { label: "Points", singular: "Point", plural: "Points", icon: "Zap" },
  { label: "Spark", singular: "Spark", plural: "Sparks", icon: "Spark" },
];

export const DEFAULT_CURRENCY_CONFIG: CurrencyConfig = {
  behavior: { singular: "Star", plural: "Stars", icon: "Star", color: "amber" },
  achievement: { singular: "Gem", plural: "Gems", icon: "Gem", color: "violet" },
};

export function isValidCurrencySettings(value: unknown): value is CurrencySettings {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.singular === "string" && typeof v.plural === "string" && validateCurrencyName(v.singular) === null && validateCurrencyName(v.plural) === null && CURRENCY_ICONS.includes(v.icon as CurrencyIconName) && typeof v.color === "string" && v.color in CURRENCY_COLORS;
}

export function validateCurrencyName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Name cannot be empty";
  if (trimmed.length > CURRENCY_NAME_MAX) return `Max ${CURRENCY_NAME_MAX} characters`;
  return null;
}

export function currencyKindFor(type: TransactionType): CurrencyKind { return type === "achievement" ? "achievement" : "behavior"; }
export function currencyName(settings: CurrencySettings, amount: number): string { return Math.abs(amount) === 1 ? settings.singular : settings.plural; }
export function formatCurrency(settings: CurrencySettings, amount: number, signed = false): string { const sign = signed && amount > 0 ? "+" : ""; return `${sign}${amount} ${currencyName(settings, amount)}`; }
