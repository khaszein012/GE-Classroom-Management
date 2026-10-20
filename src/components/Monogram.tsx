import { avatarColor } from "@/lib/avatarColor";
import { initialsOf } from "@/lib/avatarColor";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<Size, string> = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-20 w-20 text-2xl",
};

/**
 * A monogram avatar: the student's initials on a solid colour circle.
 * Renders crisply at every size used in the app.
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
  const colorCls = avatarColor(colorIndex);
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight ${colorCls} ${SIZE_CLASSES[size]} ${className} ${ring}`}
    >
      {init}
    </div>
  );
}
