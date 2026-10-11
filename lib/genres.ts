// The broad genres Listend groups albums by — stats, Month in Review and the
// library genre filter all use this list, so their genre counts agree. Mirrors
// MAIN_GENRES in listend-server/index.js, which maps raw tags onto these.
export const MAIN_GENRES = new Set([
  'Hip-Hop / Rap', 'Pop', 'Rock', 'Latin', 'Afrobeats',
  'R&B / Soul', 'Electronic', 'Indie / Alternative', 'Metal',
  'Country', 'Jazz', 'Classical', 'Folk / Singer-Songwriter', 'Blues',
]);

// An album's genre is its first main tag. Tags list Apple's own primary genre
// first, then looser MusicBrainz ones — counting every tag put OK Computer,
// Blonde and IGOR all under Pop.
export function primaryGenre(album: { genreTags?: string[] }): string | undefined {
  return (album.genreTags ?? []).find(t => MAIN_GENRES.has(t));
}

// Every genre in a library, most albums first.
export function genreCounts(albums: { genreTags?: string[] }[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const album of albums) {
    const genre = primaryGenre(album);
    if (genre) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
