import { Router } from 'expo-router';
import { resolveCanonicalAlbum } from './resolveCanonicalAlbum';

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
  const resolved = await resolveCanonicalAlbum(album);
  router.push({
    pathname: '/album-detail',
    params: {
      id:         resolved.id,
      title:      resolved.title,
      artist:     resolved.artist,
      year:       String(resolved.year || ''),
      artworkUrl: resolved.artworkUrl,
    },
  } as any);
}
