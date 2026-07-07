import { supabase } from '@/lib/supabase';
import { CatalogAlbum, CatalogTrack, CatalogArtist } from '@/context/CatalogService';
import { countReviewComments } from '@/lib/reviewComments';

export type PopularReview = {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string | null;
  isPro: boolean;
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

export async function fetchTopAlbumsThisWeek(): Promise<CatalogAlbum[]> {
  const [{ data }, { data: relistenData }] = await Promise.all([
    supabase
      .from('user_albums')
      .select('spotify_id, user_id, title, artist, year, artwork_url')
      .gte('listened_at', weekAgo())
      .limit(500),
    supabase
      .from('re_listens')
      .select('spotify_id, user_id, title, artist, year, artwork_url')
      .gte('listened_at', weekAgo())
      .limit(500),
  ]);

  if (!data?.length && !relistenData?.length) return [];

  // Cap each user's contribution to an album at 2 (one base log + one re-listen
  // bonus) regardless of how many times they actually re-listen — otherwise a
  // single user could spam re-listens to push an album to the top on their own.
  const entries = new Map<string, { album: CatalogAlbum; baseUsers: Set<string>; relistenUsers: Set<string> }>();
  const getEntry = (r: any) => {
    let e = entries.get(r.spotify_id);
    if (!e) {
      e = { album: { id: r.spotify_id, title: r.title ?? '', artist: r.artist ?? '', year: r.year ?? 0, artworkUrl: r.artwork_url ?? '' }, baseUsers: new Set(), relistenUsers: new Set() };
      entries.set(r.spotify_id, e);
    }
    return e;
  };

  for (const r of (data ?? []) as any[]) {
    if (!r.spotify_id || !r.user_id) continue;
    getEntry(r).baseUsers.add(r.user_id);
  }
  for (const r of (relistenData ?? []) as any[]) {
    if (!r.spotify_id || !r.user_id) continue;
    getEntry(r).relistenUsers.add(r.user_id);
  }

  return Array.from(entries.values())
    .sort((a, b) => (b.baseUsers.size + b.relistenUsers.size) - (a.baseUsers.size + a.relistenUsers.size))
    .map(e => e.album);
}

export async function fetchTopSongsThisWeek(): Promise<CatalogTrack[]> {
  const { data } = await supabase
    .from('top5_changes')
    .select('item_id, item_name, item_image_url')
    .eq('category', 'songs')
    .gte('changed_at', weekAgo())
    .limit(300);

  if (!data?.length) return [];

  const counts = new Map<string, { track: CatalogTrack; count: number }>();
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

export async function fetchTopArtistsThisWeek(): Promise<CatalogArtist[]> {
  const since = weekAgo();
  const [{ data: likedRows }, { data: top5Rows }, { data: albumRows }] = await Promise.all([
    supabase.from('liked_artists').select('artist_id, name, artwork_url').gte('created_at', since).limit(300),
    supabase.from('top5_changes').select('item_id, item_name, item_image_url').eq('category', 'artists').gte('changed_at', since).limit(300),
    supabase.from('user_albums').select('artist, artwork_url').not('listened_at', 'is', null).gte('listened_at', since).limit(500),
  ]);

  const counts = new Map<string, { artist: CatalogArtist; count: number }>();

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
  const byName = new Map<string, { artist: CatalogArtist; count: number }>();
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

  // Add album log counts — only artist name available, no artwork (r.artwork_url is album art)
  for (const r of (albumRows ?? []) as any[]) {
    const name = r.artist?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = byName.get(key);
    if (existing) {
      existing.count++;
    } else {
      byName.set(key, { artist: { id: `name:${key}`, name, genre: '', artworkUrl: '' }, count: 1 });
    }
  }

  const ranked = Array.from(byName.values()).sort((a, b) => b.count - a.count).slice(0, 20).map(e => e.artist);

  // Resolve AM artwork for any artist that came only from album logs (no artwork yet)
  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
  const missing = ranked.filter(a => !a.artworkUrl);
  if (missing.length > 0) {
    const resolved = await Promise.allSettled(
      missing.map(a =>
        fetch(`${API_URL}/search?q=${encodeURIComponent(a.name)}&type=artist`)
          .then(r => r.ok ? r.json() : [])
          .then((results: { id: string; artworkUrl: string }[]) => ({ name: a.name, id: results[0]?.id ?? '', artworkUrl: results[0]?.artworkUrl ?? '' }))
          .catch(() => ({ name: a.name, id: '', artworkUrl: '' }))
      )
    );
    const artworkMap: Record<string, { id: string; artworkUrl: string }> = {};
    for (const r of resolved) {
      if (r.status === 'fulfilled' && r.value.artworkUrl) {
        artworkMap[r.value.name.toLowerCase()] = { id: r.value.id, artworkUrl: r.value.artworkUrl };
      }
    }
    for (const artist of ranked) {
      if (!artist.artworkUrl) {
        const hit = artworkMap[artist.name.toLowerCase()];
        if (hit) {
          artist.artworkUrl = hit.artworkUrl;
          if (hit.id) artist.id = hit.id;
        }
      }
    }
  }

  return ranked;
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
    supabase.from('profiles').select('id, username, avatar_url, is_pro').in('id', userIds),
    supabase.from('likes').select('target_id').eq('target_type', 'review').in('target_id', targetIds),
    countReviewComments(targetIds),
  ]);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id as string, { username: p.username as string | null, avatarUrl: p.avatar_url as string | null, isPro: !!(p.is_pro) }]));
  const likeCounts = new Map<string, number>();
  for (const l of (likeRows ?? []) as any[]) {
    likeCounts.set(l.target_id, (likeCounts.get(l.target_id) ?? 0) + 1);
  }

  const reviews: PopularReview[] = (reviewRows as any[]).map(r => {
    const targetId = `${r.user_id}_${r.spotify_id}`;
    const prof = profileMap.get(r.user_id);
    return {
      id: targetId,
      userId: r.user_id,
      username: prof?.username ?? 'user',
      avatarUrl: prof?.avatarUrl ?? null,
      isPro: prof?.isPro ?? false,
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
