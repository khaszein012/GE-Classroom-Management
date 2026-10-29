import { useEffect } from "react";
import { X } from "lucide-react";
import { useCurrency } from "@/components/CurrencyProvider";

/**
 * Teacher help: a slide-over guide written against the live configuration
 * (currency names come from the teacher's own settings). Sections are
 * native <details> accordions — keyboard accessible with no extra state.
 */
export function HelpPanel({ onClose }: { onClose: () => void }) {
  const { config } = useCurrency();
  const dollars = config.behavior.plural.toLowerCase();
  const gems = config.achievement.plural.toLowerCase();
  const gem = config.achievement.singular.toLowerCase();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm" />
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-md animate-slide-in-right overflow-y-auto bg-warm-ivory shadow-soft-lg dark:bg-ink-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Help and guide"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-100 bg-warm-ivory/95 px-5 py-4 backdrop-blur dark:border-ink-800 dark:bg-ink-900/95">
          <h2 className="font-display text-2xl font-semibold text-ink-900 dark:text-warm-ivory">
            Help &amp; guide
          </h2>
          <button
            onClick={onClose}
            aria-label="Close help"
            className="flex h-11 w-11 items-center justify-center rounded-button text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2 px-4 py-4">
          <HelpSection title="Quick start" open>
            <ol className="list-inside list-decimal space-y-1.5">
              <li>Add your students and give them usernames + PINs.</li>
              <li>Create behaviours — what earns (or costs) {dollars}.</li>
              <li>Stock the shop with rewards they can buy.</li>
              <li>Award on the dashboard: select cards, press Award.</li>
              <li>Build a quiz when you want {gems} in the mix.</li>
            </ol>
          </HelpSection>

          <HelpSection title={`Awarding ${dollars}`}>
            <p>
              Tap student cards to select (or Select all), then <strong>Award</strong>. Pick a
              behaviour or a custom amount — positive and negative both work, and every award can
              be undone in the Activity log. Hovering a student card shows quick +/− buttons for
              your most-used behaviours.
            </p>
          </HelpSection>

          <HelpSection title="Students, PINs and login cards">
            <p>
              Each student can have a username and a 6-digit PIN so they can sign in from any
              device and see only their own page. Reset a PIN from the Students screen anytime —
              the old one stops working immediately and the new one is shown once.{" "}
              <strong>Print login cards</strong> produces handouts with every student's details.
            </p>
          </HelpSection>

          <HelpSection title="The shop: two currencies">
            <p>
              <strong>{config.behavior.plural}</strong> come from behaviours and{" "}
              <strong>{config.achievement.plural}</strong> come from quizzes. They are two sealed
              economies — students can never convert one into the other. Each reward is priced in
              one currency (set when you create or edit it), and a reward's currency can't change
              while requests are pending. You approve or decline each request; approving moves the
              cost out of the matching balance, and Undo puts it back.
            </p>
          </HelpSection>

          <HelpSection title="Quizzes">
            <p>
              Build multiple-choice and true/false questions — one at a time, or import a whole
              set from a spreadsheet with <strong>Import CSV</strong> (the Template button shows
              the format). Assign to Everyone or pick students, then Publish. Students get{" "}
              <strong>one attempt</strong>, their answers save as they go, and scoring plus{" "}
              {gem} awarding happen on the server — they can't see correct answers before
              submitting. Close a quiz to stop submissions; Reopen gives it a new due date;
              Archive tidies it away while keeping the results.
            </p>
          </HelpSection>

          <HelpSection title="Activity log and exports">
            <p>
              The Activity log lists every award, spend and {gem} with filters by student,
              currency and sign. {config.achievement.plural} rows are marked so the two currencies
              never blur together. Settings → <strong>Export class data</strong> downloads
              spreadsheets of students, the full activity ledger, and quiz results.
            </p>
          </HelpSection>

          <HelpSection title="Themes and appearance">
            <p>
              Pick a colour theme in Settings (or on your student page) — four themes, each in
              light and dark mode via the toggle. Your choice is yours alone: it never changes
              what anyone else sees, and the printed login cards stay black-and-white safe.
            </p>
          </HelpSection>

          <HelpSection title="Data safety">
            <p>
              Balances are calculated from the transaction ledger, so they can't drift. Students
              are walled off by the database itself — they can only see their own page and only
              write their own goal, theme and quiz answers. Nightly backups run automatically
              (check your repository's Actions), and Settings can export your data as CSV
              anytime.
            </p>
          </HelpSection>
        </div>
      </aside>
    </div>
  );
}

function HelpSection({
  title,
  children,
  open,
}: {
  title: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details
      open={open}
      className="group rounded-card border border-ink-200/70 bg-warm-ivory shadow-soft dark:border-ink-800/70 dark:bg-ink-900"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-card px-4 py-3 text-sm font-semibold text-ink-900 transition-colors hover:bg-ink-50 [&::-webkit-details-marker]:hidden dark:text-warm-ivory dark:hover:bg-ink-800/60">
        {title}
        <span
          className="text-ink-400 transition-transform group-open:rotate-90"
          aria-hidden
        >
          ›
        </span>
      </summary>
      <div className="border-t border-ink-100 px-4 py-3 text-sm leading-relaxed text-ink-600 dark:border-ink-800 dark:text-ink-300">
        {children}
      </div>
    </details>
  );
}
