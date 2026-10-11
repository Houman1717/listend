import { useMemo, useState } from 'react';
import type { FilterSection } from '@/components/SortSheet';

// Labelled like Discover's decade chips: 1990s, 2000s, 2010s…
export function decadeOf(year?: number): string | undefined {
  if (!year || year < 1900) return undefined;
  return `${Math.floor(year / 10) * 10}s`;
}

function countBy<T>(items: T[], keyOf: (item: T) => string | undefined): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

// Keeps the picked option visible (at 0) when the other filter leaves none of
// it, so it can still be seen and tapped off.
function withActive(options: [string, number][], active: string | null): [string, number][] {
  return active && !options.some(([o]) => o === active) ? [...options, [active, 0]] : options;
}

// Genre + decade filters for the library screens (My Listend, My Reviews,
// Want to Listen). Each section's counts reflect the other filter, so "Hip-Hop"
// then shows how many Hip-Hop albums sit in each decade.
//
// genreOf must be stable — a module function or a memoised callback.
export function useLibraryFilters<T extends { year?: number }>(
  source: T[],
  sorted: T[],
  genreOf: (item: T) => string | undefined,
) {
  const [genre, setGenre]   = useState<string | null>(null);
  const [decade, setDecade] = useState<string | null>(null);

  const allGenres  = useMemo(() => countBy(source, genreOf), [source, genreOf]);
  const allDecades = useMemo(() => countBy(source, a => decadeOf(a.year)), [source]);
  // Falls back to All if the last album of a picked option is removed.
  const activeGenre  = genre  && allGenres.has(genre)   ? genre  : null;
  const activeDecade = decade && allDecades.has(decade) ? decade : null;

  const genreOptions = useMemo(() => {
    const pool = activeDecade ? source.filter(a => decadeOf(a.year) === activeDecade) : source;
    const options = [...countBy(pool, genreOf).entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return withActive(options, activeGenre);
  }, [source, genreOf, activeGenre, activeDecade]);

  const decadeOptions = useMemo(() => {
    const pool = activeGenre ? source.filter(a => genreOf(a) === activeGenre) : source;
    const options = [...countBy(pool, a => decadeOf(a.year)).entries()]
      .sort((a, b) => b[0].localeCompare(a[0]));
    return withActive(options, activeDecade);
  }, [source, genreOf, activeGenre, activeDecade]);

  const filtered = useMemo(
    () => (activeGenre || activeDecade
      ? sorted.filter(a =>
          (!activeGenre  || genreOf(a) === activeGenre) &&
          (!activeDecade || decadeOf(a.year) === activeDecade))
      : sorted),
    [sorted, genreOf, activeGenre, activeDecade],
  );

  const filters: FilterSection[] = [
    { title: 'Genre',  options: genreOptions,  active: activeGenre,  onSelect: setGenre },
    { title: 'Decade', options: decadeOptions, active: activeDecade, onSelect: setDecade },
  ].filter(f => f.options.length > 0);

  return {
    filters,
    filtered,
    // "1990s Hip-Hop / Rap", for the count line: "4 1990s Hip-Hop / Rap albums".
    label: [activeDecade, activeGenre].filter(Boolean).join(' '),
    filterActive: !!(activeGenre || activeDecade),
  };
}
