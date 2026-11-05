import { nameBgById } from "@/lib/nameBackgrounds";
import type { NameStateId } from "@/lib/nameplateState";

/**
 * A student's display name, optionally wearing their purchased nameplate.
 *
 * Shared by the student dashboard, the teacher's student cards and the
 * roster so a name style looks the same everywhere. The free "Classic"
 * style renders the plain name.
 *
 * Two independent layers:
 *   - the style itself (owned artwork: plate colours, and the Epic tier's
 *     ambient sweeping sheen)
 *   - the earned state (goal reached / on a streak / almost there), passed
 *     in as `state`. Only the dashboard supplies it; the teacher roster
 *     stays calm so scanning a class doesn't turn into a light show.
 */
export function Nameplate({
  name,
  bgId = "none",
  state = "calm",
  animate = false,
  title,
  className = "",
  plainClass = "",
}: {
  name: string;
  bgId?: string | null;
  /** Earned reaction; "calm" (the default) renders the plain style. */
  state?: NameStateId;
  /**
   * Opt in to motion. Defaults to false so that a new call site is static
   * unless it asks otherwise — the teacher roster shows 15 of these at once
   * and must never become a light show.
   */
  animate?: boolean;
  /** Hover explanation of the current state (e.g. "Goal reached"). */
  title?: string;
  /** Size/weight classes applied to both the plain name and the plate. */
  className?: string;
  /** Ink colour for the plain (free) name only. */
  plainClass?: string;
}) {
  const bg = nameBgById(bgId);
  const live = animate && state !== "calm";

  if (!bg.plate) {
    // A student who owns nothing can still earn a glow: the reaction belongs
    // to what they did, not what they bought. It takes the same padding as a
    // real plate so it reads as "a plate appeared" rather than as jitter.
    if (!live) {
      return <span className={`inline-block max-w-full truncate ${className} ${plainClass}`}>{name}</span>;
    }
    return (
      <span
        className={`relative inline-block max-w-full truncate rounded-full px-2.5 py-0.5 ${className} ${plainClass}`}
        data-name-state={state}
        title={title}
      >
        {name}
      </span>
    );
  }

  return (
    <span
      className={`relative inline-block max-w-full truncate rounded-full px-2.5 py-0.5 ${bg.plate} ${bg.text} ${className}`}
      data-name-bg={bg.id}
      data-name-state={live ? state : undefined}
      title={title}
    >
      {bg.flourish && (
        <span
          aria-hidden
          className={`absolute inset-0 overflow-hidden rounded-full ${animate ? "avatar-foil-live" : bg.flourish}`}
        />
      )}
      {/* Legendary pattern layer. Sits above the flourish but below the name,
          and is clipped by the plate's own rounded-full, so it can never spill
          outside the pill. */}
      {bg.pattern && (
        <span aria-hidden className={`absolute inset-0 overflow-hidden rounded-full ${bg.pattern}`} />
      )}
      <span className="relative" style={bg.textShadow ? { textShadow: bg.textShadow } : undefined}>
        {name}
      </span>
    </span>
  );
}