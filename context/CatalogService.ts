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
};

export type CatalogArtist = {
  id: string;
  name: string;
  genre: string;
  artworkUrl: string;
};
