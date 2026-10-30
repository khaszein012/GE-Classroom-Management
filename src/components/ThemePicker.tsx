import { Check } from "lucide-react";
import { COLOR_THEMES, type ColorTheme } from "@/lib/themes";

/**
 * Colour-theme picker: labelled swatch previews (ink, surface, accent) with
 * the theme name, and the current selection marked with an icon as well as
 * styling — never colour alone.
 */
export function ThemePicker({
  current,
  onSelect,
}: {
  current: ColorTheme;
  onSelect: (theme: ColorTheme) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Colour theme">
      {COLOR_THEMES.map((t) => {
        const selected = current === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            aria-pressed={selected}
            className={`flex min-h-11 flex-col items-start gap-2 rounded-button border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-900 ${
              selected
                ? "border-antique-gold bg-ivory-dim dark:bg-antique-gold/10"
                : "border-ink-200 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800/60"
            }`}
          >
            <span className="flex w-full items-center justify-between gap-1">
              <span className="flex overflow-hidden rounded-full border border-ink-200 dark:border-ink-700" aria-hidden>
                <span className="h-5 w-5" style={{ background: t.swatch.ink }} />
                <span className="h-5 w-5" style={{ background: t.swatch.surface }} />
                <span className="h-5 w-5" style={{ background: t.swatch.accent }} />
              </span>
              {selected && (
                <Check
                  className="h-4 w-4 shrink-0 text-deep-gold dark:text-antique-gold"
                  aria-label="Current theme"
                />
              )}
            </span>
            <span
              className={`text-xs font-semibold ${
                selected ? "text-deep-gold dark:text-antique-gold" : "text-ink-600 dark:text-ink-300"
              }`}
            >
              {t.name}
              {selected && <span className="sr-only"> (selected)</span>}
            </span>
          </button>
        );
      })}
      <p className="col-span-full mt-1 text-xs leading-snug text-ink-400 dark:text-ink-500">
        Each theme is a full style pack — it changes cards, avatars and currency badges, not just
        colours. Light and dark still work in every one.
      </p>
    </div>
  );
}
