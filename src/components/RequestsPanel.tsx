import { useState } from "react";
import { Check, Clock, Inbox, Undo2, X } from "lucide-react";
import type { Store } from "@/lib/useStore";
import { useToast } from "@/components/Toast";
import { relativeTime } from "@/lib/time";
import { useCurrency } from "@/components/CurrencyProvider";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { Monogram } from "@/components/Monogram";

/**
 * Teacher-side pending reward requests with approve / decline (+ note) and
 * undo of approvals. All decisions run server-side (atomic RPCs); failures
 * surface the database's own explanation (e.g. "out of stock").
 */
export function RequestsPanel({ store }: { store: Store }) {
  const toast = useToast();
  const { config } = useCurrency();
  const [noteFor, setNoteFor] = useState<{ id: string; action: "approve" | "decline" } | null>(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [undoBusy, setUndoBusy] = useState<string | null>(null);

  const pending = store.redemptions.filter((r) => r.status === "pending");
  const recentDecided = store.redemptions
    .filter((r) => r.status === "approved" || r.status === "declined")
    .sort((a, b) => (b.decidedAt ?? 0) - (a.decidedAt ?? 0))
    .slice(0, 5);

  const studentMap = new Map(store.students.map((s) => [s.id, s]));
  const rewardName = (id: string) => store.rewards.find((r) => r.id === id)?.name ?? "Removed reward";

  const decide = async (action: "approve" | "decline", id: string, withNote?: string) => {
    setBusyId(id);
    try {
      await store.decideRedemption(id, action, withNote ?? undefined);
      toast.show(action === "approve" ? "Request approved" : "Request declined", "positive");
    } catch (e) {
      // The RPC raises with a plain reason (out of stock, not enough points…).
      toast.show(e instanceof Error ? e.message : "Could not decide the request", "negative");
    } finally {
      setBusyId(null);
      setNoteFor(null);
      setNote("");
    }
  };

  const undo = async (id: string) => {
    setUndoBusy(id);
    try {
      await store.undoRedemptionApproval(id);
      toast.show("Approval undone — refund issued, stock restored", "info");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Could not undo", "negative");
    } finally {
      setUndoBusy(null);
    }
  };

  return (
    <section className="mt-6 rounded-card border border-ink-200/70 bg-warm-ivory p-4 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
      <div className="mb-3 flex items-center gap-2">
        <Inbox className="h-4 w-4 text-ink-500 dark:text-ink-400" />
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-600 dark:text-ink-300">Requests</h2>
        {pending.length > 0 && (
          <span className="rounded-full bg-ivory-dim px-2 py-0.5 text-[10px] font-bold text-deep-gold dark:bg-antique-gold/15 dark:text-antique-gold">
            {pending.length} pending
          </span>
        )}
      </div>

      {pending.length === 0 ? (
        <p className="rounded-button bg-ink-50 px-3 py-5 text-center text-sm text-ink-400 dark:bg-ink-800/50 dark:text-ink-500">
          No pending requests. When a student asks for a reward, it appears here.
        </p>
      ) : (
        <ul className="space-y-2">
          {pending.map((r) => {
            const student = studentMap.get(r.studentId);
            return (
              <li
                key={r.id}
                className={`flex flex-wrap items-center gap-3 rounded-button border border-ink-200 bg-warm-ivory px-3 py-3 dark:border-ink-800 dark:bg-ink-900 ${
                  busyId === r.id ? "opacity-50" : ""
                }`}
              >
                <Monogram
                  name={student?.displayName ?? "?"}
                  colorIndex={student?.avatarColor ?? 0}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink-900 dark:text-ink-100">
                    {student?.displayName ?? "Removed student"}
                  </div>
                  <div className="flex items-center gap-1.5 truncate text-xs text-ink-500 dark:text-ink-400">
                    <Clock className="h-3 w-3 shrink-0" />
                    {rewardName(r.rewardId)} · {relativeTime(r.requestedAt)}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-ivory-dim px-2.5 py-1 text-xs font-bold text-deep-gold dark:bg-antique-gold/15 dark:text-antique-gold">
                  <CurrencyAmount
                    amount={r.costAtRequest}
                    kind={r.currency === "gems" ? "achievement" : "behavior"}
                    iconClassName="h-3.5 w-3.5"
                  />
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => { setNoteFor({ id: r.id, action: "approve" }); setNote(""); }}
                    disabled={busyId !== null}
                    className="flex h-10 items-center gap-1.5 rounded-button bg-deep-gold dark:bg-antique-gold dark:text-obsidian px-3 text-xs font-semibold text-warm-ivory transition-colors hover:bg-ink-700 dark:hover:bg-deep-gold disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Approve
                  </button>
                  <button
                    onClick={() => { setNoteFor({ id: r.id, action: "decline" }); setNote(""); }}
                    disabled={busyId !== null}
                    className="flex h-10 items-center gap-1.5 rounded-button bg-warm-brick dark:bg-brick-light dark:text-obsidian px-3 text-xs font-semibold text-warm-ivory transition-colors hover:bg-warm-brick disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Decline
                  </button>
                </div>
                {noteFor?.id === r.id && (
                  <div className="w-full space-y-2 rounded-button bg-ink-50 p-2.5 dark:bg-ink-800/60">
                    <input
                      autoFocus
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={120}
                      placeholder={
                        noteFor.action === "approve"
                          ? "Optional note to the student…"
                          : "Optional note explaining why…"
                      }
                      className="h-9 w-full rounded-button border border-ink-200 bg-warm-ivory px-3 text-sm outline-none focus:border-antique-gold dark:border-ink-700 dark:bg-ink-900"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => setNoteFor(null)}
                        className="rounded-button px-3 py-1.5 text-xs font-semibold text-ink-500 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => void decide(noteFor.action, r.id, note.trim() || undefined)}
                        disabled={busyId !== null}
                        className={`rounded-button px-3 py-1.5 text-xs font-semibold text-warm-ivory disabled:opacity-50 ${
                          noteFor.action === "approve" ? "bg-deep-gold dark:bg-antique-gold dark:text-obsidian hover:bg-ink-700 dark:hover:bg-deep-gold" : "bg-warm-brick dark:bg-brick-light dark:text-obsidian hover:bg-warm-brick"
                        }`}
                      >
                        {noteFor.action === "approve" ? "Approve request" : "Decline request"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {recentDecided.length > 0 && (
        <div className="mt-4 border-t border-ink-100 pt-3 dark:border-ink-800">
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-600">
            Recently decided
          </h3>
          <ul className="space-y-1.5">
            {recentDecided.map((r) => {
              const student = studentMap.get(r.studentId);
              return (
                <li key={r.id} className="flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      r.status === "approved" ? "bg-deep-gold" : "bg-warm-brick"
                    }`}
                  />
                  <span className="truncate">
                    {student?.displayName ?? "Removed student"} · {rewardName(r.rewardId)} ·{" "}
                    {r.costAtRequest}{" "}
                    {(r.currency === "gems" ? config.achievement.plural : config.behavior.plural).toLowerCase()}
                  </span>
                  <span className="ml-auto flex shrink-0 items-center gap-2">
                    <span className="hidden sm:inline">{relativeTime(r.decidedAt ?? r.requestedAt)}</span>
                    {r.status === "approved" && (
                      <button
                        onClick={() => void undo(r.id)}
                        disabled={undoBusy !== null}
                        className="flex h-8 items-center gap-1 rounded-button bg-ink-100 px-2 text-[11px] font-semibold text-ink-600 transition-colors hover:bg-ink-200 disabled:opacity-50 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"
                      >
                        <Undo2 className="h-3 w-3" />
                        Undo
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
