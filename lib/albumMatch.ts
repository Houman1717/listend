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
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/^\W*the\s+/, '')
    .replace(/[\u2000-\u206f\u3000-\u303f]/g, '')
    .replace(/[^\w\u00c0-\uffff]|_/g, '');
}

// Artist credit as words, same folding as loose(), for matching one credit
// inside a fuller one.
function words(s: string): string[] {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[\u2000-\u206f\u3000-\u303f]/g, ' ')
    .split(/[^\w\u00c0-\uffff]+|_/)
    .filter(w => w && w !== 'the');
}

// Artists match when equal (ignoring punctuation and spacing — "Run-D.M.C."
// is "Run-DMC"), or when one credit appears word-for-word inside the other:
// "Prince & The Revolution" contains "Prince", but "Black Sabbath" does not
// contain "ABBA" just because the letters line up.
function artistsMatch(a: string, b: string): boolean {
  const wa = words(a), wb = words(b);
  if (wa.join('') === wb.join('')) return true;
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  if (short.length === 0 || short.join('').length < 3) return false;
  for (let i = 0; i + short.length <= long.length; i++) {
    if (short.every((w, j) => long[i + j] === w)) return true;
  }
  return false;
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
    const artist = a.artist ?? '';
    if (list) list.push(artist); else artistsByTitle.set(t, [artist]);
  }
  return (album) => {
    const artists = artistsByTitle.get(loose(stripEditions(album.title)));
    if (!artists) return false;
    return artists.some(a => artistsMatch(a, album.artist ?? ''));
  };
}
