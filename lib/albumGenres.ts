// Genre tags for albums that don't carry their own genre_tags — Want to Listen
// rows store none, unlike logged albums. Same shape as fetchAlbumDurations:
// chunked under the server's 2000-character ids cap, one map back.
//
// Remembered for the session, so reopening the list doesn't ask again.

const IDS_PER_REQUEST = 100;
const known = new Map<string, string[]>();

export async function fetchAlbumGenres(
  ids: string[],
  isCancelled?: () => boolean,
): Promise<Record<string, string[]>> {
  const found: Record<string, string[]> = {};
  const missing: string[] = [];
  for (const id of ids) {
    const tags = known.get(id);
    if (tags) found[id] = tags;
    else missing.push(id);
  }

  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

  for (let i = 0; i < missing.length; i += IDS_PER_REQUEST) {
    if (isCancelled?.()) return found;
    const batch = missing.slice(i, i + IDS_PER_REQUEST);
    try {
      const res = await fetch(`${API_URL}/api/album-genres?ids=${batch.join(',')}`);
      if (!res.ok) continue;
      const data: Record<string, string[]> = await res.json();
      for (const [id, tags] of Object.entries(data)) {
        known.set(id, tags);
        found[id] = tags;
      }
    } catch {
      // Leave this batch untagged — those albums just sit outside every genre.
    }
  }

  return found;
}
