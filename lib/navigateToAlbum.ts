import { Router } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export interface AlbumNavInput {
  id: string;
  title: string;
  artist: string;
  year?: number | string;
  artworkUrl?: string;
}

/**
 * Always resolves the canonical Apple Music ID before navigating so every
 * callsite in the app lands on the same album-detail page regardless of
 * which Supabase record the ID came from.
 */
export async function navigateToAlbum(router: Router, album: AlbumNavInput) {
  try {
    const q = encodeURIComponent(`${album.title} ${album.artist}`);
    const res = await fetch(`${API_URL}/search?q=${q}&type=album`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const nt = norm(album.title);
        const na = norm(album.artist);
        // 1. Title + artist exact match
        const match =
          data.find((a: any) => norm(a.title ?? '') === nt && norm(a.artist ?? '') === na) ??
          // 2. Title match only (artist might differ slightly e.g. "feat." stripped)
          data.find((a: any) => norm(a.title ?? '') === nt) ??
          // 3. First result
          data[0];
        if (match?.id) {
          router.push({
            pathname: '/album-detail',
            params: {
              id:         match.id,
              title:      match.title      ?? album.title,
              artist:     match.artist     ?? album.artist,
              year:       String(match.year ?? album.year ?? ''),
              artworkUrl: match.artworkUrl ?? album.artworkUrl ?? '',
            },
          } as any);
          return;
        }
      }
    }
  } catch {}
  // Fallback: use original data as-is
  router.push({
    pathname: '/album-detail',
    params: {
      id:         album.id,
      title:      album.title,
      artist:     album.artist,
      year:       String(album.year ?? ''),
      artworkUrl: album.artworkUrl ?? '',
    },
  } as any);
}
