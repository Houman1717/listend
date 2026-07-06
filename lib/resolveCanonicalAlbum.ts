const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export interface CanonicalAlbumInput {
  id: string;
  title: string;
  artist: string;
  year?: number | string;
  artworkUrl?: string;
}

export interface CanonicalAlbumResult {
  id: string;
  title: string;
  artist: string;
  year: number;
  artworkUrl: string;
}

/**
 * Resolves an album to one pinned canonical Apple Music ID via the server's
 * cache, so the same album always ends up on the same database row
 * regardless of which list/screen it was found through. Falls back to the
 * original input on any failure so logging/navigation never gets blocked.
 */
export async function resolveCanonicalAlbum(album: CanonicalAlbumInput): Promise<CanonicalAlbumResult> {
  try {
    const params = new URLSearchParams({
      title:  album.title,
      artist: album.artist,
      fallbackId: album.id,
    });
    if (album.year)       params.set('fallbackYear', String(album.year));
    if (album.artworkUrl) params.set('fallbackArtworkUrl', album.artworkUrl);

    const res = await fetch(`${API_URL}/api/resolve-album?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.id) {
        return {
          id:         data.id,
          title:      data.title      ?? album.title,
          artist:     data.artist     ?? album.artist,
          year:       data.year       ?? Number(album.year ?? 0),
          artworkUrl: data.artworkUrl ?? album.artworkUrl ?? '',
        };
      }
    }
  } catch {}

  // Fallback: use original data as-is
  return {
    id:         album.id,
    title:      album.title,
    artist:     album.artist,
    year:       Number(album.year ?? 0),
    artworkUrl: album.artworkUrl ?? '',
  };
}
