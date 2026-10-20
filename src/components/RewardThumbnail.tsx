import { Store } from "lucide-react";

/**
 * Displays a reward image as a consistent-aspect thumbnail (4:3),
 * cropped to fill. Falls back to a placeholder with the reward's
 * first letter or a store icon if no image or image fails to load.
 * Space is always reserved so the grid never jumps.
 */
export function RewardThumbnail({
  imageUrl,
  name,
  className = "",
}: {
  imageUrl: string | null;
  name: string;
  className?: string;
}) {
  if (!imageUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-ivory-dim ${className}`}
      >
        {name.trim() ? (
          <span className="font-display text-3xl font-semibold text-deep-gold dark:text-antique-gold">
            {name.trim()[0].toUpperCase()}
          </span>
        ) : (
          <Store className="h-6 w-6 text-ink-400 dark:text-ink-500" />
        )}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-ink-100 dark:bg-ink-800 ${className}`}>
      <img
        src={imageUrl}
        alt={name}
        loading="lazy"
        className="h-full w-full object-cover"
        onError={(e) => {
          const img = e.currentTarget;
          const parent = img.parentElement;
          if (parent) {
            img.style.display = "none";
            parent.classList.add("flex", "items-center", "justify-center");
            parent.innerHTML = `<span class="font-display text-3xl font-semibold text-deep-gold dark:text-antique-gold">${name.trim()[0]?.toUpperCase() ?? ""}</span>`;
          }
        }}
      />
    </div>
  );
}
