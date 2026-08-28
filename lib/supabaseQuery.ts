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
