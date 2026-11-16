import { CatalogAlbum } from '@/context/CatalogService';

// Discover's Genre and By Decade lists — ranked by the server from real logs
// (most-listend first), topped up with the old hand-picked albums where a
// genre or decade doesn't have enough data yet. See
// /api/discover/genre-charts in listend-server/index.js.

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export type ChartAlbum = CatalogAlbum & {
  genre?: string | null;   // primary genre as tagged ("Latin", not "Reggaeton")
  listeners?: number;      // distinct people who logged it (re-listens +1 max)
  ratingCount?: number;
  avgRating?: number;      // weighted average; 0 = too few ratings to rank on
  handPicked?: boolean;    // a curated top-up, not stat-ranked
};

export type ChartKind = 'genre' | 'decade';

const ENDPOINTS: Record<ChartKind, { charts: string; fallback: string }> = {
  genre:  { charts: '/api/discover/genre-charts',  fallback: '/genres'  },
  decade: { charts: '/api/discover/decade-charts', fallback: '/decades' },
};

const cache: Record<ChartKind, Record<string, ChartAlbum[]> | null> = { genre: null, decade: null };
const inFlight: Partial<Record<ChartKind, Promise<Record<string, ChartAlbum[]>>>> = {};

async function getJson(path: string): Promise<Record<string, ChartAlbum[]>> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

export function cachedChartLists(kind: ChartKind): Record<string, ChartAlbum[]> | null {
  return cache[kind];
}

// Every genre (or decade) list, keyed by label. Shared by all callers so the
// Discover rows, the list screens and My Stats make one request between them.
// Falls back to the hand-picked lists if the chart endpoint is unavailable.
export function loadChartLists(kind: ChartKind): Promise<Record<string, ChartAlbum[]>> {
  if (cache[kind]) return Promise.resolve(cache[kind]!);
  if (inFlight[kind]) return inFlight[kind]!;
  const { charts, fallback } = ENDPOINTS[kind];
  const p = getJson(charts)
    .catch((err) => {
      console.warn(`[chartLists] ${charts} failed, using ${fallback}:`, err?.message ?? err);
      return getJson(fallback);
    })
    .then((data) => { cache[kind] = data; return data; })
    .finally(() => { delete inFlight[kind]; });
  inFlight[kind] = p;
  return p;
}
