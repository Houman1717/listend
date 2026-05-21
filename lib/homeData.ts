import { supabase } from '@/lib/supabase';
import { SpotifyAlbum, SpotifyTrack, SpotifyArtist } from '@/context/SpotifyService';
import { countReviewComments } from '@/lib/reviewComments';

export type PopularReview = {
  id: string;
  username: string;
  avatarUrl?: string | null;
  albumTitle: string;
  albumArtist: string;
  albumYear: string;
  artworkUrl: string;
  rating: number;
  review: string;
  likeCount: number;
  commentCount: number;
};

function weekAgo(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

export async function fetchTopAlbumsThisWeek(): Promise<SpotifyAlbum[]> {
  const { data } = await supabase
    .from('user_albums')
    .select('spotify_id, title, artist, year, artwork_url')
    .gte('listened_at', weekAgo())
    .limit(500);

  if (!data?.length) return [];

  const counts = new Map<string, { album: SpotifyAlbum; count: number }>();
  for (const r of data as any[]) {
    if (!r.spotify_id) continue;
    const e = counts.get(r.spotify_id);
    if (e) e.count++;
    else counts.set(r.spotify_id, {
      album: { id: r.spotify_id, title: r.title ?? '', artist: r.artist ?? '', year: r.year ?? 0, artworkUrl: r.artwork_url ?? '' },
      count: 1,
    });
  }

  return Array.from(counts.values()).sort((a, b) => b.count - a.count).map(e => e.album);
}

export async function fetchTopSongsThisWeek(): Promise<SpotifyTrack[]> {
  const { data } = await supabase
    .from('top5_changes')
    .select('item_id, item_name, item_image_url')
    .eq('category', 'songs')
    .gte('changed_at', weekAgo())
    .limit(300);

  if (!data?.length) return [];

  const counts = new Map<string, { track: SpotifyTrack; count: number }>();
  for (const r of data as any[]) {
    if (!r.item_id) continue;
    const e = counts.get(r.item_id);
    if (e) e.count++;
    else counts.set(r.item_id, {
      track: { id: r.item_id, title: r.item_name ?? '', artist: '', artworkUrl: r.item_image_url ?? '' },
      count: 1,
    });
  }

  return Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 20).map(e => e.track);
}

export async function fetchTopArtistsThisWeek(): Promise<SpotifyArtist[]> {
  const since = weekAgo();
  const [{ data: likedRows }, { data: top5Rows }] = await Promise.all([
    supabase.from('liked_artists').select('artist_id, name, artwork_url').gte('created_at', since).limit(300),
    supabase.from('top5_changes').select('item_id, item_name, item_image_url').eq('category', 'artists').gte('changed_at', since).limit(300),
  ]);

  const counts = new Map<string, { artist: SpotifyArtist; count: number }>();

  for (const r of (likedRows ?? []) as any[]) {
    if (!r.artist_id) continue;
    const e = counts.get(r.artist_id);
    if (e) e.count++;
    else counts.set(r.artist_id, {
      artist: { id: r.artist_id, name: r.name ?? '', genre: '', artworkUrl: r.artwork_url ?? '' },
      count: 1,
    });
  }

  for (const r of (top5Rows ?? []) as any[]) {
    if (!r.item_id) continue;
    const e = counts.get(r.item_id);
    if (e) e.count++;
    else counts.set(r.item_id, {
      artist: { id: r.item_id, name: r.item_name ?? '', genre: '', artworkUrl: r.item_image_url ?? '' },
      count: 1,
    });
  }

  // Secondary dedup by name — sort high→low first so the dominant entry wins,
  // then merge lower-count duplicates in, picking the best artworkUrl from any version.
  const sorted = Array.from(counts.values()).sort((a, b) => b.count - a.count);
  const byName = new Map<string, { artist: SpotifyArtist; count: number }>();
  for (const entry of sorted) {
    const key = entry.artist.name.toLowerCase().trim();
    if (!key) continue;
    const existing = byName.get(key);
    if (existing) {
      existing.count += entry.count;
      if (!existing.artist.artworkUrl && entry.artist.artworkUrl) {
        existing.artist = { ...existing.artist, artworkUrl: entry.artist.artworkUrl };
      }
    } else {
      byName.set(key, { artist: { ...entry.artist }, count: entry.count });
    }
  }

  return Array.from(byName.values()).sort((a, b) => b.count - a.count).slice(0, 20).map(e => e.artist);
}

export async function fetchPopularReviewsThisWeek(): Promise<PopularReview[]> {
  const { data: reviewRows } = await supabase
    .from('user_albums')
    .select('user_id, spotify_id, title, artist, year, artwork_url, rating, review')
    .not('review', 'is', null)
    .neq('review', '')
    .gte('listened_at', weekAgo())
    .limit(200);

  if (!reviewRows?.length) return [];

  const userIds = [...new Set((reviewRows as any[]).map(r => r.user_id as string))];
  const targetIds = (reviewRows as any[]).map(r => `${r.user_id}_${r.spotify_id}`);

  const [{ data: profiles }, { data: likeRows }, commentCounts] = await Promise.all([
    supabase.from('profiles').select('id, username, avatar_url').in('id', userIds),
    supabase.from('likes').select('target_id').eq('target_type', 'review').in('target_id', targetIds),
    countReviewComments(targetIds),
  ]);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id as string, { username: p.username as string | null, avatarUrl: p.avatar_url as string | null }]));
  const likeCounts = new Map<string, number>();
  for (const l of (likeRows ?? []) as any[]) {
    likeCounts.set(l.target_id, (likeCounts.get(l.target_id) ?? 0) + 1);
  }

  const reviews: PopularReview[] = (reviewRows as any[]).map(r => {
    const targetId = `${r.user_id}_${r.spotify_id}`;
    const prof = profileMap.get(r.user_id);
    return {
      id: targetId,
      username: prof?.username ?? 'user',
      avatarUrl: prof?.avatarUrl ?? null,
      albumTitle: r.title ?? '',
      albumArtist: r.artist ?? '',
      albumYear: String(r.year ?? ''),
      artworkUrl: r.artwork_url ?? '',
      rating: r.rating ?? 0,
      review: r.review ?? '',
      likeCount: likeCounts.get(targetId) ?? 0,
      commentCount: commentCounts.get(targetId) ?? 0,
    };
  });

  reviews.sort((a, b) => (b.likeCount + b.commentCount) - (a.likeCount + a.commentCount));
  return reviews.slice(0, 20);
}
