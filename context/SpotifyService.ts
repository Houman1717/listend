// ─── Shared data types ─────────────────────────────────────────────────────────
// All Spotify data now flows through the Railway backend.
// These types describe the normalized shape the backend returns.

export type SpotifyAlbum = {
  id: string;
  title: string;
  artist: string;
  year: number;
  artworkUrl: string;
};

export type SpotifyTrack = {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string;
  releaseDate?: string;
};

export type SpotifyArtist = {
  id: string;
  name: string;
  genre: string;
  artworkUrl: string;
};
