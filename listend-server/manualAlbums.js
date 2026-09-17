// ── Manually curated albums ───────────────────────────────────────────────────
// Records that aren't in Apple Music's catalog at all — not merely missing
// from the `us` storefront (those are pinned via CANONICAL_ALBUM_OVERRIDES in
// index.js and still resolve against `gb`). These have no Apple Music entry
// anywhere, so Listend carries the metadata itself: title, artist, year,
// cover and tracklist, keyed by our own `lst-` ids that can never collide
// with a numeric Apple Music id.
//
// Curated by hand from user suggestions on purpose — there is deliberately no
// user-submission path, since anything self-serve invites junk entries.
// Metadata and tracklists come from MusicBrainz and covers from the Cover Art
// Archive, both of which are free to reuse. Track durations are in ms, so
// duration sort and the album-length display work the same as for real
// Apple Music albums.
//
// To add one: find the release on MusicBrainz, take its release-group id for
// the cover and its release id for the tracklist, and append an entry below.

const MANUAL_ALBUMS = [
  {
    id: 'lst-tin-machine-ii',
    title: 'Tin Machine II',
    artist: 'Tin Machine',
    appleArtistId: '14685821',        // the artist IS on Apple Music — only this record is missing
    year: 1991,
    // not reissued since its original label folded
    artworkUrl: 'https://coverartarchive.org/release-group/8451f040-a435-35c4-860e-14de48a4725a/front-500',
    musicbrainzReleaseId: 'eb37fdab-7655-41f6-8f19-e2ac53f29628',
    trackCount: 13,
    tracks: [
      { number: 1, id: 'lst-tin-machine-ii-t1', title: 'Baby Universal', durationMs: 199026 },
      { number: 2, id: 'lst-tin-machine-ii-t2', title: 'One Shot', durationMs: 311400 },
      { number: 3, id: 'lst-tin-machine-ii-t3', title: 'You Belong in Rock n’ Roll', durationMs: 247240 },
      { number: 4, id: 'lst-tin-machine-ii-t4', title: 'If There Is Something', durationMs: 285226 },
      { number: 5, id: 'lst-tin-machine-ii-t5', title: 'Amlapura', durationMs: 226040 },
      { number: 6, id: 'lst-tin-machine-ii-t6', title: 'Betty Wrong', durationMs: 227626 },
      { number: 7, id: 'lst-tin-machine-ii-t7', title: 'You Can’t Talk', durationMs: 189400 },
      { number: 8, id: 'lst-tin-machine-ii-t8', title: 'Stateside', durationMs: 338200 },
      { number: 9, id: 'lst-tin-machine-ii-t9', title: 'Shopping for Girls', durationMs: 224106 },
      { number: 10, id: 'lst-tin-machine-ii-t10', title: 'A Big Hurt', durationMs: 219160 },
      { number: 11, id: 'lst-tin-machine-ii-t11', title: 'Sorry', durationMs: 219000 },
      { number: 12, id: 'lst-tin-machine-ii-t12', title: 'Goodbye Mr. Ed', durationMs: 203573 },
      { number: 13, id: 'lst-tin-machine-ii-t13', title: 'Hammerhead', durationMs: 58866 },
    ],
  },
  {
    id: 'lst-soul-rebels',
    title: 'Soul Rebels',
    artist: 'Bob Marley & The Wailers',
    appleArtistId: '3174628',        // the artist IS on Apple Music — only this record is missing
    year: 1970,
    // the Lee Perry-era recordings have contested ownership
    artworkUrl: 'https://coverartarchive.org/release-group/58637e09-dec9-4023-80ff-734da967301c/front-500',
    musicbrainzReleaseId: '2501cc89-14e0-3b8f-a1c0-96147f04b105',
    trackCount: 12,
    tracks: [
      { number: 1, id: 'lst-soul-rebels-t1', title: 'Soul Rebel', durationMs: 203106 },
      { number: 2, id: 'lst-soul-rebels-t2', title: 'Try Me', durationMs: 169893 },
      { number: 3, id: 'lst-soul-rebels-t3', title: 'It\'s Alright', durationMs: 159706 },
      { number: 4, id: 'lst-soul-rebels-t4', title: 'No Sympathy', durationMs: 138293 },
      { number: 5, id: 'lst-soul-rebels-t5', title: 'My Cup', durationMs: 218533 },
      { number: 6, id: 'lst-soul-rebels-t6', title: 'Soul Almighty', durationMs: 163173 },
      { number: 7, id: 'lst-soul-rebels-t7', title: 'Rebels Hop', durationMs: 163333 },
      { number: 8, id: 'lst-soul-rebels-t8', title: 'Corner Stone', durationMs: 153333 },
      { number: 9, id: 'lst-soul-rebels-t9', title: '400 Years', durationMs: 154026 },
      { number: 10, id: 'lst-soul-rebels-t10', title: 'No Water', durationMs: 131640 },
      { number: 11, id: 'lst-soul-rebels-t11', title: 'Reaction', durationMs: 165560 },
      { number: 12, id: 'lst-soul-rebels-t12', title: 'My Sympathy', durationMs: 148974 },
    ],
  },
  {
    id: 'lst-exmilitary',
    title: 'Exmilitary',
    artist: 'Death Grips',
    appleArtistId: '437819641',        // the artist IS on Apple Music — only this record is missing
    year: 2011,
    // built on uncleared samples, so it was released free instead
    artworkUrl: 'https://coverartarchive.org/release-group/f1f6c7e2-7848-4554-b36c-2190e1d6bfb0/front-500',
    musicbrainzReleaseId: 'fc8c25cd-555f-43a3-8162-5b7aafc37bf2',
    trackCount: 13,
    tracks: [
      { number: 1, id: 'lst-exmilitary-t1', title: 'Beware', durationMs: 353000 },
      { number: 2, id: 'lst-exmilitary-t2', title: 'Guillotine (It Goes Yah)', durationMs: 223000 },
      { number: 3, id: 'lst-exmilitary-t3', title: 'Spread Eagle Cross the Block', durationMs: 232000 },
      { number: 4, id: 'lst-exmilitary-t4', title: 'Lord of the Game', durationMs: 210000 },
      { number: 5, id: 'lst-exmilitary-t5', title: 'Takyon (Death Yon)', durationMs: 168000 },
      { number: 6, id: 'lst-exmilitary-t6', title: 'Cut Throat (instrumental)', durationMs: 72000 },
      { number: 7, id: 'lst-exmilitary-t7', title: 'Klink', durationMs: 202000 },
      { number: 8, id: 'lst-exmilitary-t8', title: 'Culture Shock', durationMs: 261000 },
      { number: 9, id: 'lst-exmilitary-t9', title: '5D', durationMs: 43000 },
      { number: 10, id: 'lst-exmilitary-t10', title: 'Thru the Walls', durationMs: 236000 },
      { number: 11, id: 'lst-exmilitary-t11', title: 'Known for It', durationMs: 253000 },
      { number: 12, id: 'lst-exmilitary-t12', title: 'I Want It I Need It (Death Heated)', durationMs: 371000 },
      { number: 13, id: 'lst-exmilitary-t13', title: 'Blood Creepin', durationMs: 290000 },
    ],
  },
  {
    id: 'lst-follow-that-dream',
    title: 'Follow That Dream',
    artist: 'Elvis Presley',
    appleArtistId: '197443',        // the artist IS on Apple Music — only this record is missing
    year: 1962,
    // the 1962 EP is on Spotify but was never put on Apple Music
    artworkUrl: 'https://coverartarchive.org/release-group/d5f8a3fb-4a98-440b-9d8f-232040c9526e/front-500',
    musicbrainzReleaseId: '458222b4-13d8-4842-9ab3-a54c6a565037',
    trackCount: 4,
    tracks: [
      { number: 1, id: 'lst-follow-that-dream-t1', title: 'Follow That Dream', durationMs: 98000 },
      { number: 2, id: 'lst-follow-that-dream-t2', title: 'Angel', durationMs: 160000 },
      { number: 3, id: 'lst-follow-that-dream-t3', title: 'What a Wonderful Life', durationMs: 148000 },
      { number: 4, id: 'lst-follow-that-dream-t4', title: 'I’m Not the Marrying Kind', durationMs: 120000 },
    ],
  },
];

const byAlbumId = new Map(MANUAL_ALBUMS.map(a => [a.id, a]));
const byTrackId = new Map(
  MANUAL_ALBUMS.flatMap(a => a.tracks.map(t => [t.id, { ...t, album: a }]))
);

const manualAlbumById = id => byAlbumId.get(id) ?? null;
const manualTrackById = id => byTrackId.get(id) ?? null;
const manualAlbumsByArtist = appleArtistId =>
  MANUAL_ALBUMS.filter(a => a.appleArtistId === appleArtistId);

// Shape the artist discography endpoint expects.
const manualAlbumAsArtistItem = a => ({
  id: a.id,
  title: a.title,
  artworkUrl: a.artworkUrl,
  year: a.year,
  isSingle: false,
  isCompilation: false,
  trackCount: a.trackCount,
  url: '',
  type: 'album',
});

module.exports = {
  MANUAL_ALBUMS,
  manualAlbumById,
  manualTrackById,
  manualAlbumsByArtist,
  manualAlbumAsArtistItem,
};
