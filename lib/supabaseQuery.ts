// Helpers that keep "I couldn't ask" distinct from "the answer is zero".
//
// The 2026-08-28 Supabase outage turned full accounts into "0 Followers,
// 0 Albums" because the codebase reaches for `count ?? 0` / `data ?? []` — which
// silently converts a failed request into a confident, wrong answer.
//
// The rule these encode:
//   • query failed              → null  ("unknown", render as "—" / keep cache)
//   • query succeeded, no rows  → 0 / [] (a real, trustworthy answer)
//
// Use these anywhere a network result is written to user-visible state. They are
// deliberately not a data-fetching framework — just the honest cast.

type CountResult = { count: number | null; error: unknown | null };
type RowsResult<T> = { data: T[] | null; error: unknown | null };
type RowResult<T> = { data: T | null; error: unknown | null };

/** Count from a `{ count: 'exact', head: true }` query, or null if it failed. */
export function countOrNull(res: CountResult): number | null {
  if (res.error) return null;
  return res.count ?? 0;
}

/** Rows from a select, or null if the query failed. `[]` means genuinely empty. */
export function rowsOrNull<T>(res: RowsResult<T>): T[] | null {
  if (res.error) return null;
  return res.data ?? [];
}

/**
 * Single row from a `.maybeSingle()`, or null if the query failed.
 * Note this collapses "failed" and "no such row" — use only where the caller
 * treats both the same (i.e. "don't update state").
 */
export function rowOrNull<T>(res: RowResult<T>): T | null {
  if (res.error) return null;
  return res.data ?? null;
}

/** Format a possibly-unknown count for display: null → "—". */
export function displayCount(n: number | null | undefined): string {
  return n == null ? '—' : String(n);
}

// ─── Paging ───────────────────────────────────────────────────────────────────

/** PostgREST caps a single select at `db.max_rows` (1000 by default). */
export const PAGE_SIZE = 1000;

/**
 * Runs a select repeatedly with `.range()` until a short page comes back, so a
 * heavy account (900+ logged albums, and more once re-listens are counted)
 * isn't silently truncated at the first 1000 rows.
 *
 * Follows the same rule as the helpers above: a failed page returns null
 * ("couldn't ask"), never a partial list that would read as the whole answer.
 * `maxPages` is always explicit at the call site so a runaway query can't page
 * forever — pick it from how many rows that query could plausibly return.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<RowsResult<T>>,
  maxPages: number,
): Promise<T[] | null> {
  const out: T[] = [];
  for (let i = 0; i < maxPages; i++) {
    const { data, error } = await page(i * PAGE_SIZE, i * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) return null;
    const rows = data ?? [];
    for (const row of rows) out.push(row);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}
