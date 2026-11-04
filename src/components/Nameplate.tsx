import { nameBgById } from "@/lib/nameBackgrounds";

/**
 * A student's display name, optionally wearing their purchased nameplate.
 *
 * Shared by the student dashboard, the teacher's student cards and the
 * roster so a name style looks the same everywhere. The free "Classic"
 * style renders the plain name.
 */
export function Nameplate({
  name,
  bgId = "none",
  className = "",
  plainClass = "",
}: {
  name: string;
  bgId?: string | null;
  /** Size/weight classes applied to both the plain name and the plate. */
  className?: string;
  /** Ink colour for the plain (free) name only. */
  plainClass?: string;
}) {
  const bg = nameBgById(bgId);

  if (!bg.plate) {
    return <span className={`inline-block max-w-full truncate ${className} ${plainClass}`}>{name}</span>;
  }

  return (
    <span
      className={`relative inline-block max-w-full truncate rounded-full px-2.5 py-0.5 ${bg.plate} ${bg.text} ${className}`}
      data-name-bg={bg.id}
    >
      {bg.flourish && (
        <span aria-hidden className={`absolute inset-0 overflow-hidden rounded-full ${bg.flourish}`} />
      )}
      <span className="relative">{name}</span>
    </span>
  );
}