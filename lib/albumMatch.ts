// Loose title+artist matching between a curated album list (the Flip a Record
// pool, featured/genre/decade playlists) and a user's Listend library.
//
// The library holds whatever title/artist Apple Music returned when the album
// was logged, which routinely differs from the curated list's spelling:
//   - stacked edition tags:  "The Dark Side of the Moon (50th Anniversary) [Remastered]"
//   - punctuation / "&":     "Either/Or" vs "Either Or", "Hunting High & Low" vs "And"
//   - a leading "The":       "The Beatles" vs "Beatles", "The B-52's" vs "B-52's"
//   - fuller artist credit:  "The Jimi Hendrix Experience" vs "Jimi Hendrix",
//                            "Stan Getz & João Gilberto" vs "Stan Getz"
// An exact compare silently drops all of these from progress counts.

type MatchAlbum = { title: string; artist?: string | null };

// Strips trailing edition/remaster groups in parens or brackets, repeatedly —
// Apple Music often stacks two ("(Deluxe Edition) [2014 Remaster]"). Never
// strips a title down to nothing, e.g. "(Pronounced 'Leh-'Nerd 'Skin-'Nerd)".
function stripEditions(title: string): string {
  let t = title.trim();
  for (;;) {
    const next = t.replace(/\s*[([][^()[\]]*[)\]]\s*$/, '').trim();
    if (next === t || !next) return t;
    t = next;
  }
}

// Accent-folded, lowercased, "&" → "and", leading "the" dropped, and every
// space/punctuation mark removed. Non-Latin letters are kept so titles in
// other scripts don't all collapse to the same empty key.
function loose(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/^\W*the\s+/, '')
    .replace(/[ -⁯　-〿]/g, '')
    .replace(/[^\wÀ-￿]|_/g, '');
}

// Artists match when equal, or when one credit contains the other and the
// shorter one isn't trivially short — "Prince & The Revolution" ⊃ "Prince",
// but "Air" can't match "Fairport Convention".
function artistsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.includes(short);
}

// Builds a matcher over a library. The title must match exactly (after
// normalising) — the artist is the only part allowed to be a partial match —
// so different albums by the same artist ("Harvest Moon" vs "Harvest") or the
// same title by different artists (Pop Smoke's "Faith" vs George Michael's)
// never count.
export function libraryMatcher(library: MatchAlbum[]): (album: MatchAlbum) => boolean {
  const artistsByTitle = new Map<string, string[]>();
  for (const a of library) {
    const t = loose(stripEditions(a.title));
    if (!t) continue;
    const list = artistsByTitle.get(t);
    const artist = loose(a.artist ?? '');
    if (list) list.push(artist); else artistsByTitle.set(t, [artist]);
  }
  return (album) => {
    const artists = artistsByTitle.get(loose(stripEditions(album.title)));
    if (!artists) return false;
    const artist = loose(album.artist ?? '');
    return artists.some(a => artistsMatch(a, artist));
  };
}
