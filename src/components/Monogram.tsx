import { avatarColorDef, initialsOf } from "@/lib/avatarColor";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<Size, string> = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-20 w-20 text-2xl",
};

const DOT_CLASSES: Record<Size, string> = {
  xs: "h-1 w-1",
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
  lg: "h-2 w-2",
  xl: "h-2.5 w-2.5",
};

/**
 * A monogram avatar: the student's initials on a rich gradient tile
 * with a subtle inner highlight and a light dot accent.
 */
export function Monogram({
  name,
  colorIndex,
  size = "md",
  className = "",
  ring = "",
}: {
  name: string;
  colorIndex: number;
  size?: Size;
  className?: string;
  ring?: string;
}) {
  const init = initialsOf(name);
  const c = avatarColorDef(colorIndex);
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold tracking-tight ${c.bg} ${c.text} ${SIZE_CLASSES[size]} ${className} ${ring} ring-1 ${c.ring}`}
    >
      <span className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
      <span className="absolute left-0 right-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent" />
      <span className={`absolute bottom-[18%] right-[18%] rounded-full bg-white/30 blur-[0.5px] ${DOT_CLASSES[size]}`} />
      <span className="relative">{init}</span>
    </div>
  );
}
