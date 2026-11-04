/**
 * Paging helper for PostgREST reads.
 *
 * Supabase/PostgREST returns at most `max-rows` (default 1000) rows per
 * request and gives no indication that it truncated. A plain `.select()`
 * therefore yields a silent partial result once a table grows past the cap —
 * which for the transaction ledger means wrong balances, wrong lifetime
 * totals, wrong class-goal progress, with no error anywhere.
 *
 * Pure and dependency-free so it can be unit-tested directly.
 */

/** Minimal shape of a PostgREST response, structurally compatible with
 *  supabase-js (which returns a `PostgrestResponse` thenable). */
export interface PagedResponse<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/**
 * Fetch every row by repeatedly requesting successive ranges.
 *
 * `build(from, to)` must apply the inclusive range to its own query, so
 * richer selects (joins, column subsets, extra filters) keep working without
 * this helper knowing about them.
 *
 * Termination: a page shorter than `pageSize` is the last page. A full page
 * always advances `from`, so the loop cannot spin in place.
 *
 * Ordering requirement: the caller MUST order by a unique (or at least
 * stable) column. Postgres does not guarantee row order without ORDER BY,
 * and paging an unordered query can duplicate or skip rows across pages.
 */
export async function fetchAllPaged<T>(
  build: (from: number, to: number) => PromiseLike<PagedResponse<T>>,
  pageSize = 1000,
): Promise<T[]> {
  if (pageSize < 1) throw new Error("pageSize must be at least 1");
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}