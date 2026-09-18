// Batch duration lookup for the library grids (My Listend, Want to Listen,
// My Reviews), all of which can be asking about a four-figure number of albums.
//
// /api/album-durations validates `ids` at 2000 characters, so a full library in
// one query is rejected outright — which is how duration sort quietly stopped
// working on big accounts. Chunking keeps each request well inside that, and
// returning one map lets the caller apply the answers in a single state update
// instead of re-rendering the grid once per album.

// ~100 catalog ids is roughly 1.2k characters, comfortably under the cap, and
// bounds how many Apple Music lookups the server fans out on a cold cache.
const IDS_PER_REQUEST = 100;

export async function fetchAlbumDurations(
  ids: string[],
  isCancelled?: () => boolean,
): Promise<Record<string, number>> {
  const found: Record<string, number> = {};
  if (ids.length === 0) return found;

  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

  for (let i = 0; i < ids.length; i += IDS_PER_REQUEST) {
    if (isCancelled?.()) return found;
    const batch = ids.slice(i, i + IDS_PER_REQUEST);
    try {
      const res = await fetch(`${API_URL}/api/album-durations?ids=${batch.join(',')}`);
      if (!res.ok) continue;
      Object.assign(found, await res.json());
    } catch {
      // Leave this batch unhydrated — those albums just sort to the end.
    }
  }

  return found;
}
