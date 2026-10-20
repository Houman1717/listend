// ─── Shared data types ─────────────────────────────────────────────────────────
// All catalog data now flows through the Railway backend, backed by Apple Music.
// These types describe the normalized shape the backend returns.

export type CatalogAlbum = {
  id: string;
  title: string;
  artist: string;
  year: number;
  artworkUrl: string;
};

export type CatalogTrack = {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string;
  releaseDate?: string;
  /** Present on search results (may be missing from older cached results). */
  albumTitle?: string;
  /** Present on the song charts, which come from song logs. */
  albumId?: string;
  durationMs?: number;
};

export type CatalogArtist = {
  id: string;
  name: string;
  genre: string;
  artworkUrl: string;
};
