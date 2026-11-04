import { avatarColorDef, initialsOf } from "@/lib/avatarColor";
import { avatarById, DEFAULT_AVATAR_ID } from "@/lib/avatars";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<Size, string> = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-20 w-20 text-2xl",
};

/** Glyph scales with the tile so it never collides with the initials. */
const GLYPH_CLASSES: Record<Size, string> = {
  xs: "text-[9px]",
  sm: "text-[11px]",
  md: "text-[13px]",
  lg: "text-[15px]",
  xl: "text-[26px]",
};

const DOT_CLASSES: Record<Size, string> = {
  xs: "h-1 w-1",
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
  lg: "h-2 w-2",
  xl: "h-2.5 w-2.5",
};

/**
 * A student avatar: initials on a rich gradient tile.
 *
 * Two modes:
 *  - default: the classic monogram, coloured from AVATAR_PALETTE by index
 *    (this is the recognition system — teacher-assigned and student-picked).
 *  - premium: a designed style from the avatar catalog. Initials stay
 *    visible and a small glyph sits in the corner, so the roster stays
 *    scannable even when everyone has bought something shiny.
 */
export function Monogram({
  name,
  colorIndex,
  avatarId = DEFAULT_AVATAR_ID,
  size = "md",
  className = "",
  ring = "",
}: {
  name: string;
  colorIndex: number;
  avatarId?: string | null;
  size?: Size;
  className?: string;
  ring?: string;
}) {
  const init = initialsOf(name);
  const premium = avatarId && avatarId !== DEFAULT_AVATAR_ID ? avatarById(avatarId) : null;

  if (premium) {
    return (
      <div
        className={`monogram relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold tracking-tight ${premium.bg} ${premium.text} ${SIZE_CLASSES[size]} ${className} ${ring} ring-1 ${premium.ring}`}
        data-avatar={premium.id}
      >
        <span className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <span className="absolute left-0 right-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent" />
        {premium.flourish && <span className={`absolute inset-0 ${premium.flourish}`} />}
        <span className="relative">{init}</span>
        {premium.glyph && (
          <span
            aria-hidden
            className={`absolute bottom-0 right-1 leading-none opacity-60 ${GLYPH_CLASSES[size]}`}
          >
            {premium.glyph}
          </span>
        )}
      </div>
    );
  }

  const c = avatarColorDef(colorIndex);
  return (
    <div
      className={`monogram relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold tracking-tight ${c.bg} ${c.text} ${SIZE_CLASSES[size]} ${className} ${ring} ring-1 ${c.ring}`}
    >
      <span className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
      <span className="absolute left-0 right-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent" />
      <span className={`absolute bottom-[18%] right-[18%] rounded-full bg-white/30 blur-[0.5px] ${DOT_CLASSES[size]}`} />
      <span className="relative">{init}</span>
    </div>
  );
}