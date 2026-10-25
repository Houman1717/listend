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
// `aliases` on an album or artist adds extra spellings that search should
// match — the displayed title never changes. `isCompilation`, `isMixtape` and `isLive`
// put a record in the Collections, EPs & Mixtapes or Live tab of the artist page;
// without either, running time decides.
//
// To add one: find the release on MusicBrainz, take its release-group id for
// the cover and its release id for the tracklist, and append an entry below.

// Covers Listend hosts itself, for records with no entry in the Cover Art
// Archive. Served from listend-server/public by the /static route.
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL ?? 'https://listend-production.up.railway.app').replace(/\/$/, '');

const MANUAL_ALBUMS = [
  {
    id: 'lst-tin-machine-ii',
    title: 'Tin Machine II',
    artist: 'Tin Machine',
    artistId: '14685821',        // the artist IS on Apple Music — only this record is missing
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
    artistId: '3174628',        // the artist IS on Apple Music — only this record is missing
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
    isMixtape: true,              // billed as a mixtape; files under EPs & Mixtapes
    artistId: '437819641',        // the artist IS on Apple Music — only this record is missing
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
    artistId: '197443',        // the artist IS on Apple Music — only this record is missing
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
  {
    id: 'lst-viva-las-vegas',
    title: 'Viva Las Vegas (Original Soundtrack)',
    artist: 'Elvis Presley',
    artistId: '197443',        // the artist IS on Apple Music — only this record is missing
    year: 1964,
    // only ever issued as a 4-track EP and later collectors' editions, so no
    // streaming service carries the soundtrack itself
    artworkUrl: 'https://coverartarchive.org/release-group/09e28543-c053-43e1-b336-405d647dd399/front-500',
    // The 2003 soundtrack release. Its first 12 tracks are the film's songs —
    // the 13 alternate takes that follow them on that disc are left out, being
    // studio outtakes rather than part of the record people mean.
    musicbrainzReleaseId: 'b1e133dc-a58f-4666-b279-a5cc036cdd93',
    trackCount: 12,
    tracks: [
      { number: 1, id: 'lst-viva-las-vegas-t1', title: 'Viva Las Vegas', durationMs: 145000 },
      { number: 2, id: 'lst-viva-las-vegas-t2', title: 'What’d I Say', durationMs: 183000 },
      { number: 3, id: 'lst-viva-las-vegas-t3', title: 'If You Think I Don’t Need You', durationMs: 125000 },
      { number: 4, id: 'lst-viva-las-vegas-t4', title: 'I Need Somebody to Lean On', durationMs: 177000 },
      { number: 5, id: 'lst-viva-las-vegas-t5', title: 'C’mon Everybody', durationMs: 137000 },
      { number: 6, id: 'lst-viva-las-vegas-t6', title: 'Today, Tomorrow and Forever', durationMs: 205000 },
      { number: 7, id: 'lst-viva-las-vegas-t7', title: 'Santa Lucia', durationMs: 73000 },
      { number: 8, id: 'lst-viva-las-vegas-t8', title: 'Do the Vega', durationMs: 144000 },
      { number: 9, id: 'lst-viva-las-vegas-t9', title: 'Night Life', durationMs: 110000 },
      { number: 10, id: 'lst-viva-las-vegas-t10', title: 'Yellow Rose of Texas / The Eyes of Texas', durationMs: 177000 },
      { number: 11, id: 'lst-viva-las-vegas-t11', title: 'The Lady Loves Me', durationMs: 224000 },
      { number: 12, id: 'lst-viva-las-vegas-t12', title: 'You’re the Boss', durationMs: 167000 },
    ],
  },
  {
    id: 'lst-love-me-tender',
    title: 'Love Me Tender',
    artist: 'Elvis Presley',
    artistId: '197443',        // the artist IS on Apple Music — only this record is missing
    year: 1956,
    // the 1956 debut EP; only later compilations of the same name reached streaming
    artworkUrl: 'https://coverartarchive.org/release-group/d5e19821-e8c6-3d1e-9be1-ec0836218795/front-500',
    musicbrainzReleaseId: 'dfbc35d8-7d00-4d7d-adf6-ddf20ccd10e5',
    trackCount: 4,
    tracks: [
      { number: 1, id: 'lst-love-me-tender-t1', title: 'Love Me Tender', durationMs: 165000 },
      { number: 2, id: 'lst-love-me-tender-t2', title: 'Let Me', durationMs: 128489 },
      { number: 3, id: 'lst-love-me-tender-t3', title: 'Poor Boy', durationMs: 136119 },
      { number: 4, id: 'lst-love-me-tender-t4', title: 'We’re Gonna Move', durationMs: 152129 },
    ],
  },
  {
    id: 'lst-jailhouse-rock',
    title: 'Jailhouse Rock',
    artist: 'Elvis Presley',
    artistId: '197443',        // the artist IS on Apple Music — only this record is missing
    year: 1957,
    // the 1957 EP; streaming only carries modern hits compilations using the name
    artworkUrl: 'https://coverartarchive.org/release-group/214fb8f8-bdee-3a96-ba46-e833f73de94f/front-500',
    musicbrainzReleaseId: 'd6be7b74-e68b-4dfb-b24b-624115979948',
    trackCount: 5,
    tracks: [
      { number: 1, id: 'lst-jailhouse-rock-t1', title: 'Jailhouse Rock', durationMs: 145000 },
      { number: 2, id: 'lst-jailhouse-rock-t2', title: 'Young and Beautiful', durationMs: 120000 },
      { number: 3, id: 'lst-jailhouse-rock-t3', title: 'I Want to Be Free', durationMs: 134000 },
      { number: 4, id: 'lst-jailhouse-rock-t4', title: 'Don’t Leave Me Now', durationMs: 90000 },
      { number: 5, id: 'lst-jailhouse-rock-t5', title: '(You’re So Square) Baby I Don’t Care', durationMs: 110000 },
    ],
  },
  {
    id: 'lst-flaming-star',
    title: 'Elvis by Request: Flaming Star',
    artist: 'Elvis Presley',
    artistId: '197443',        // the artist IS on Apple Music — only this record is missing
    year: 1961,
    // the 1961 EP; "Elvis Sings Flaming Star" on Apple Music is a different 1969 album
    artworkUrl: 'https://coverartarchive.org/release-group/4b4eb9ac-65ec-3542-b7ec-a403cbf55603/front-500',
    musicbrainzReleaseId: 'df68b2c5-ebc9-4d2e-8d1a-7c6b8b0e717f',
    trackCount: 4,
    tracks: [
      { number: 1, id: 'lst-flaming-star-t1', title: 'Flaming Star', durationMs: 147147 },
      { number: 2, id: 'lst-flaming-star-t2', title: 'Summer Kisses, Winter Tears', durationMs: 142244 },
      { number: 3, id: 'lst-flaming-star-t3', title: 'Are You Lonesome Tonight', durationMs: 188273 },
      { number: 4, id: 'lst-flaming-star-t4', title: 'It’s Now or Never', durationMs: 196840 },
    ],
  },
  {
    id: 'lst-tickle-me',
    title: 'Tickle Me',
    artist: 'Elvis Presley',
    artistId: '197443',        // the artist IS on Apple Music — only this record is missing
    year: 1965,
    // the 1965 EP; a Vol. 2 EP followed a month later and is not carried here
    artworkUrl: 'https://coverartarchive.org/release-group/96771b31-0dd0-4e15-ac4b-64db30eaca49/front-500',
    musicbrainzReleaseId: '688d6153-0386-4a08-a0a7-7e860aadafb7',
    trackCount: 5,
    tracks: [
      { number: 1, id: 'lst-tickle-me-t1', title: 'I Feel That I’ve Known You Forever', durationMs: 99000 },
      { number: 2, id: 'lst-tickle-me-t2', title: 'Slowly but Surely', durationMs: 131000 },
      { number: 3, id: 'lst-tickle-me-t3', title: 'Night Rider', durationMs: 127000 },
      { number: 4, id: 'lst-tickle-me-t4', title: 'Put the Blame on Me', durationMs: 120000 },
      { number: 5, id: 'lst-tickle-me-t5', title: 'Dirty, Dirty Feeling', durationMs: 93467 },
    ],
  },
  {
    id: 'lst-kid-galahad',
    title: 'Kid Galahad',
    artist: 'Elvis Presley',
    artistId: '197443',        // the artist IS on Apple Music — only this record is missing
    year: 1962,
    // the 1962 six-track soundtrack EP
    artworkUrl: 'https://coverartarchive.org/release-group/e0022bfc-d10a-472c-9525-b6c786885694/front-500',
    musicbrainzReleaseId: 'd49822d0-7e8c-4f27-b690-27b435180895',
    trackCount: 6,
    tracks: [
      { number: 1, id: 'lst-kid-galahad-t1', title: 'King of the Whole Wide World', durationMs: 163000 },
      { number: 2, id: 'lst-kid-galahad-t2', title: 'This Is Living', durationMs: 105000 },
      { number: 3, id: 'lst-kid-galahad-t3', title: 'Riding the Rainbow', durationMs: 99000 },
      { number: 4, id: 'lst-kid-galahad-t4', title: 'Home Is Where the Heart Is', durationMs: 154000 },
      { number: 5, id: 'lst-kid-galahad-t5', title: 'I Got Lucky', durationMs: 132000 },
      { number: 6, id: 'lst-kid-galahad-t6', title: 'A Whistling Tune', durationMs: 199000 },
    ],
  },
  {
    id: 'lst-easy-come-easy-go',
    title: 'Easy Come, Easy Go',
    artist: 'Elvis Presley',
    artistId: '197443',        // the artist IS on Apple Music — only this record is missing
    year: 1967,
    // the 1967 six-track soundtrack EP
    artworkUrl: 'https://coverartarchive.org/release-group/d76f03ae-a76a-4d5c-99e5-089889d5f703/front-500',
    musicbrainzReleaseId: '5a29f0d7-bb47-429a-bcac-97d28bb51711',
    trackCount: 6,
    tracks: [
      { number: 1, id: 'lst-easy-come-easy-go-t1', title: 'Easy Come, Easy Go', durationMs: 134543 },
      { number: 2, id: 'lst-easy-come-easy-go-t2', title: 'The Love Machine', durationMs: 169560 },
      { number: 3, id: 'lst-easy-come-easy-go-t3', title: 'Yoga Is as Yoga Does', durationMs: 130257 },
      { number: 4, id: 'lst-easy-come-easy-go-t4', title: 'You Gotta Stop', durationMs: 139450 },
      { number: 5, id: 'lst-easy-come-easy-go-t5', title: 'Sing You Children', durationMs: 133667 },
      { number: 6, id: 'lst-easy-come-easy-go-t6', title: 'I’ll Take Love', durationMs: 135751 },
    ],
  },
  {
    id: 'lst-wild-in-the-country',
    title: 'Wild in the Country (Original Soundtrack)',
    artist: 'Elvis Presley',
    artistId: '197443',        // the artist IS on Apple Music — only this record is missing
    year: 1961,
    // the film's five songs; the 2008 collectors' edition appends 22 alternate takes
    artworkUrl: 'https://coverartarchive.org/release-group/628a2f6c-9d0e-47a6-89af-ac3630e80dcf/front-500',
    musicbrainzReleaseId: 'fe0b1414-55ce-4847-9c12-da33cdd26e53',
    trackCount: 5,
    tracks: [
      { number: 1, id: 'lst-wild-in-the-country-t1', title: 'Wild in the Country', durationMs: 115000 },
      { number: 2, id: 'lst-wild-in-the-country-t2', title: 'Lonely Man', durationMs: 166000 },
      { number: 3, id: 'lst-wild-in-the-country-t3', title: 'I Slipped, I Stumbled, I Fell', durationMs: 97000 },
      { number: 4, id: 'lst-wild-in-the-country-t4', title: 'In My Way', durationMs: 85000 },
      { number: 5, id: 'lst-wild-in-the-country-t5', title: 'Forget Me Never', durationMs: 98000 },
    ],
  },
  {
    id: 'lst-live-a-little-love-a-little',
    title: 'Live a Little, Love a Little (Original Soundtrack)',
    artist: 'Elvis Presley',
    artistId: '197443',        // the artist IS on Apple Music — only this record is missing
    year: 1968,
    // the film's four songs; the 2015 collectors' edition appends 17 alternate takes
    artworkUrl: 'https://coverartarchive.org/release-group/beda6f91-4337-499a-8766-2fe826ebc71e/front-500',
    musicbrainzReleaseId: 'b1f16237-b076-4dac-a5f8-016237c1bc28',
    trackCount: 4,
    tracks: [
      { number: 1, id: 'lst-live-a-little-love-a-little-t1', title: 'Wonderful World', durationMs: 134000 },
      { number: 2, id: 'lst-live-a-little-love-a-little-t2', title: 'Edge of Reality', durationMs: 199000 },
      { number: 3, id: 'lst-live-a-little-love-a-little-t3', title: 'A Little Less Conversation', durationMs: 137000 },
      { number: 4, id: 'lst-live-a-little-love-a-little-t4', title: 'Almost in Love', durationMs: 187000 },
    ],
  },
  {
    id: 'lst-stay-away-joe',
    title: 'Stay Away, Joe (Original Soundtrack)',
    artist: 'Elvis Presley',
    artistId: '197443',        // the artist IS on Apple Music — only this record is missing
    year: 1968,
    // the film's seven songs; the 2013 collectors' edition appends 14 alternate takes
    artworkUrl: 'https://coverartarchive.org/release-group/533893ac-ac71-4457-b03c-483c5123913f/front-500',
    musicbrainzReleaseId: '1df133bd-66af-440f-8b26-a68ba6dc36e3',
    trackCount: 7,
    tracks: [
      { number: 1, id: 'lst-stay-away-joe-t1', title: 'Stay Away', durationMs: 144000 },
      { number: 2, id: 'lst-stay-away-joe-t2', title: 'Stay Away, Joe', durationMs: 100000 },
      { number: 3, id: 'lst-stay-away-joe-t3', title: 'Dominic', durationMs: 112000 },
      { number: 4, id: 'lst-stay-away-joe-t4', title: 'All I Needed Was the Rain', durationMs: 109000 },
      { number: 5, id: 'lst-stay-away-joe-t5', title: 'Goin’ Home', durationMs: 150000 },
      { number: 6, id: 'lst-stay-away-joe-t6', title: 'Too Much Monkey Business', durationMs: 153000 },
      { number: 7, id: 'lst-stay-away-joe-t7', title: 'U.S. Male', durationMs: 168000 },
    ],
  },
  {
    id: 'lst-trouble-with-girls',
    title: 'The Trouble with Girls (Original Soundtrack)',
    artist: 'Elvis Presley',
    artistId: '197443',        // the artist IS on Apple Music — only this record is missing
    year: 1969,
    // never released on its own — assembled from the 1995 four-film compilation, whose cover this borrows
    artworkUrl: 'https://coverartarchive.org/release-group/99553396-bf51-3e83-b1e4-a5615932ef2e/front-500',
    musicbrainzReleaseId: '978f0866-8648-4317-ba4c-d1b221b9824e',
    trackCount: 6,
    tracks: [
      { number: 1, id: 'lst-trouble-with-girls-t1', title: 'Clean Up Your Own Backyard', durationMs: 189160 },
      { number: 2, id: 'lst-trouble-with-girls-t2', title: 'Swing Down, Sweet Chariot', durationMs: 136040 },
      { number: 3, id: 'lst-trouble-with-girls-t3', title: 'Signs of the Zodiac', durationMs: 140160 },
      { number: 4, id: 'lst-trouble-with-girls-t4', title: 'Almost', durationMs: 109640 },
      { number: 5, id: 'lst-trouble-with-girls-t5', title: 'The Whiffenpoof Song', durationMs: 31960 },
      { number: 6, id: 'lst-trouble-with-girls-t6', title: 'Violet', durationMs: 52506 },
    ],
  },
  {
    id: 'lst-change-of-habit',
    title: 'Change of Habit (Original Soundtrack)',
    artist: 'Elvis Presley',
    artistId: '197443',        // the artist IS on Apple Music — only this record is missing
    year: 1969,
    // never released on its own — the four songs from the film, off the 2015 compilation of the same name
    artworkUrl: 'https://coverartarchive.org/release-group/c6f35f7c-b454-497e-b042-79f029c41a23/front-500',
    musicbrainzReleaseId: '972a665f-b1da-47c2-9ced-cf0e17e4d28b',
    trackCount: 4,
    tracks: [
      { number: 1, id: 'lst-change-of-habit-t1', title: 'Change of Habit', durationMs: 200000 },
      { number: 2, id: 'lst-change-of-habit-t2', title: 'Have a Happy', durationMs: 143000 },
      { number: 3, id: 'lst-change-of-habit-t3', title: 'Rubberneckin’', durationMs: 134000 },
      { number: 4, id: 'lst-change-of-habit-t4', title: 'Let Us Pray', durationMs: 180000 },
    ],
  },
  {
    id: 'lst-charro',
    title: 'Charro!',
    artist: 'Elvis Presley',
    artistId: '197443',        // the artist IS on Apple Music — only this record is missing
    year: 1969,
    // Charro! and the cut-from-the-film Let's Forget About the Stars were the
    // film's recordings; Memories was the single's other side. Cover is that
    // 1969 single's sleeve — no Charro! film sleeve exists in the Cover Art
    // Archive to use instead.
    artworkUrl: 'https://coverartarchive.org/release-group/5a8ef98c-1f03-44f1-8d92-90232a513888/front-500',
    musicbrainzReleaseId: 'd803dbe8-f4d3-43ad-8f69-d59a7edbe34e',
    trackCount: 3,
    tracks: [
      { number: 1, id: 'lst-charro-t1', title: 'Charro!', durationMs: 167266 },
      { number: 2, id: 'lst-charro-t2', title: 'Let\u2019s Forget About the Stars', durationMs: 150640 },
      { number: 3, id: 'lst-charro-t3', title: 'Memories', durationMs: 186000 },
    ],
  },
  {
    id: 'lst-in-the-panchine',
    title: 'In The Panchine',
    artist: 'In The Panchine',
    artistId: 'lst-artist-in-the-panchine', // not on Apple Music either — see MANUAL_ARTISTS
    year: 2005,
    // Roman rap crew's self-released debut (Truceklan circle); never on streaming.
    // Tracklist from MusicBrainz, where the 2019 vinyl reissue confirms the
    // closing skit. MusicBrainz has no track lengths, so those come from the
    // full-album YouTube upload the suggestion linked (to the nearest 5s).
    artworkUrl: 'https://coverartarchive.org/release-group/a68913ae-35d1-49fb-aecf-252e370cfc9a/front-500',
    musicbrainzReleaseId: '1b22b872-dd0c-471b-8b2f-ee4e4e9a45b3',
    trackCount: 14,
    tracks: [
      { number: 1,  id: 'lst-in-the-panchine-t1',  title: 'Deadly Combination (feat. Noyz Narcos)', durationMs: 315000 },
      { number: 2,  id: 'lst-in-the-panchine-t2',  title: '13 PM', durationMs: 315000 },
      { number: 3,  id: 'lst-in-the-panchine-t3',  title: 'Gemellooo', durationMs: 235000 },
      { number: 4,  id: 'lst-in-the-panchine-t4',  title: 'Mr. G. (feat. Meloni)', durationMs: 305000 },
      { number: 5,  id: 'lst-in-the-panchine-t5',  title: 'Verano Zombi (feat. Noyz Narcos)', durationMs: 250000 },
      { number: 6,  id: 'lst-in-the-panchine-t6',  title: 'Stolen Car (feat. Metal Carter)', durationMs: 385000 },
      { number: 7,  id: 'lst-in-the-panchine-t7',  title: 'Fuori Misura', durationMs: 205000 },
      { number: 8,  id: 'lst-in-the-panchine-t8',  title: 'In the Panchina (feat. Gel)', durationMs: 285000 },
      { number: 9,  id: 'lst-in-the-panchine-t9',  title: 'Never Do the Spia (feat. Evelina)', durationMs: 220000 },
      { number: 10, id: 'lst-in-the-panchine-t10', title: 'Far Away from Problemi (feat. DJ Lollobar)', durationMs: 235000 },
      { number: 11, id: 'lst-in-the-panchine-t11', title: 'I Push My Rap, Dude (Parioli vs Caffarella)', durationMs: 215000 },
      { number: 12, id: 'lst-in-the-panchine-t12', title: 'Chicoria (Dirty)', durationMs: 190000 },
      { number: 13, id: 'lst-in-the-panchine-t13', title: 'Loosin\u2019 Pazienza', durationMs: 405000 },
      { number: 14, id: 'lst-in-the-panchine-t14', title: 'Skit', durationMs: 90000 },
    ],
  },
  {
    id: 'lst-f-sharp-a-sharp-infinity',
    title: 'F♯ A♯ ∞',
    artist: 'Godspeed You! Black Emperor',
    artistId: 'lst-artist-godspeed-you-black-emperor',
    year: 1997,
    // the 1998 CD edition's three-track running order, not the two-side LP
    artworkUrl: 'https://coverartarchive.org/release-group/01d06c6e-a4e6-3d8b-8a45-42a598fe87d7/front-500',
    musicbrainzReleaseId: '771ae005-6f8b-4831-9350-c3a7fdcb2442',
    trackCount: 3,
    tracks: [
      { number: 1, id: 'lst-f-sharp-a-sharp-infinity-t1', title: 'The Dead Flag Blues', durationMs: 987960 },
      { number: 2, id: 'lst-f-sharp-a-sharp-infinity-t2', title: 'East Hastings', durationMs: 1078240 },
      { number: 3, id: 'lst-f-sharp-a-sharp-infinity-t3', title: 'Providence', durationMs: 1742426 },
    ],
  },
  {
    id: 'lst-slow-riot',
    title: 'Slow Riot for New Zerø Kanada',
    artist: 'Godspeed You! Black Emperor',
    artistId: 'lst-artist-godspeed-you-black-emperor',
    year: 1999,
    // two tracks, 28 minutes — an EP by name, album length by the clock
    artworkUrl: 'https://coverartarchive.org/release-group/7a474ed2-8f4a-3295-8943-68818da3af3e/front-500',
    musicbrainzReleaseId: '215c3fe0-faf3-39b8-af0f-29f3918d84aa',
    trackCount: 2,
    tracks: [
      { number: 1, id: 'lst-slow-riot-t1', title: 'Moya', durationMs: 651626 },
      { number: 2, id: 'lst-slow-riot-t2', title: 'BBF3', durationMs: 1065133 },
    ],
  },
  {
    id: 'lst-lift-your-skinny-fists',
    title: 'Lift Your Skinny Fists Like Antennas to Heaven',
    aliases: ['Lift Yr. Skinny Fists Like Antennas to Heaven'],
    artist: 'Godspeed You! Black Emperor',
    artistId: 'lst-artist-godspeed-you-black-emperor',
    year: 2000,
    // double album; the two discs' tracks are numbered 1-4 here. Titled as most people write it — Constellation's own spelling is "Lift Yr. Skinny Fists"
    artworkUrl: 'https://coverartarchive.org/release-group/3822abb6-ca53-3ae1-a4ec-7718cb321e9b/front-500',
    musicbrainzReleaseId: 'e51e1f8b-62ba-388f-8567-0c051b575351',
    trackCount: 4,
    tracks: [
      { number: 1, id: 'lst-lift-your-skinny-fists-t1', title: 'Storm', durationMs: 1352413 },
      { number: 2, id: 'lst-lift-your-skinny-fists-t2', title: 'Static', durationMs: 1355946 },
      { number: 3, id: 'lst-lift-your-skinny-fists-t3', title: 'Sleep', durationMs: 1397746 },
      { number: 4, id: 'lst-lift-your-skinny-fists-t4', title: 'Antennas to Heaven', durationMs: 1137586 },
    ],
  },
  {
    id: 'lst-yanqui-uxo',
    title: 'Yanqui U.X.O.',
    artist: 'Godspeed You! Black Emperor',
    artistId: 'lst-artist-godspeed-you-black-emperor',
    year: 2002,
    artworkUrl: 'https://coverartarchive.org/release-group/fc3cf08c-3273-3af3-84ed-ab9782a72505/front-500',
    musicbrainzReleaseId: '82999f50-b427-4b7a-8dca-947acb143b22',
    trackCount: 3,
    tracks: [
      { number: 1, id: 'lst-yanqui-uxo-t1', title: '09‐15‐00', durationMs: 1363240 },
      { number: 2, id: 'lst-yanqui-uxo-t2', title: 'rockets fall on Rocket Falls', durationMs: 1242973 },
      { number: 3, id: 'lst-yanqui-uxo-t3', title: 'motherfucker=redeemer', durationMs: 1885746 },
    ],
  },
  {
    id: 'lst-allelujah-dont-bend-ascend',
    title: 'ALLELUJAH! DON’T BEND! ASCEND!',
    artist: 'Godspeed You! Black Emperor',
    artistId: 'lst-artist-godspeed-you-black-emperor',
    year: 2012,
    // the band styles it with a leading apostrophe
    artworkUrl: 'https://coverartarchive.org/release-group/62959180-8405-41f9-8fb8-1e18a5e8902d/front-500',
    musicbrainzReleaseId: 'aaffb153-587a-4804-b78e-2072229991d4',
    trackCount: 4,
    tracks: [
      { number: 1, id: 'lst-allelujah-dont-bend-ascend-t1', title: 'Mladic', durationMs: 1199533 },
      { number: 2, id: 'lst-allelujah-dont-bend-ascend-t2', title: 'Their Helicopters’ Sing', durationMs: 390053 },
      { number: 3, id: 'lst-allelujah-dont-bend-ascend-t3', title: 'We Drift Like Worried Fire', durationMs: 1207293 },
      { number: 4, id: 'lst-allelujah-dont-bend-ascend-t4', title: 'Strung Like Lights at Thee Printemps Erable', durationMs: 391880 },
    ],
  },
  {
    id: 'lst-asunder-sweet',
    title: 'Asunder, Sweet and Other Distress',
    artist: 'Godspeed You! Black Emperor',
    artistId: 'lst-artist-godspeed-you-black-emperor',
    year: 2015,
    // the band wraps the title in quotes
    artworkUrl: 'https://coverartarchive.org/release-group/c74035da-e212-4048-abed-40a7b5343e9a/front-500',
    musicbrainzReleaseId: '888586a9-9a76-47c4-a315-9d004220e0ae',
    trackCount: 4,
    tracks: [
      { number: 1, id: 'lst-asunder-sweet-t1', title: 'Peasantry or ‘Light! Inside of Light!’', durationMs: 628000 },
      { number: 2, id: 'lst-asunder-sweet-t2', title: 'Lambs’ Breath', durationMs: 592000 },
      { number: 3, id: 'lst-asunder-sweet-t3', title: 'Asunder, Sweet', durationMs: 373000 },
      { number: 4, id: 'lst-asunder-sweet-t4', title: 'Piss Crowns Are Trebled', durationMs: 830000 },
    ],
  },
  {
    id: 'lst-luciferian-towers',
    title: 'Luciferian Towers',
    artist: 'Godspeed You! Black Emperor',
    artistId: 'lst-artist-godspeed-you-black-emperor',
    year: 2017,
    // the band wraps the title in quotes
    artworkUrl: 'https://coverartarchive.org/release-group/bd835044-cd62-4f30-8447-438232763075/front-500',
    musicbrainzReleaseId: '58d1168f-26bd-456b-8def-a105e67af199',
    trackCount: 4,
    tracks: [
      { number: 1, id: 'lst-luciferian-towers-t1', title: 'Undoing a Luciferian Towers', durationMs: 467000 },
      { number: 2, id: 'lst-luciferian-towers-t2', title: 'Bosses Hang', durationMs: 885000 },
      { number: 3, id: 'lst-luciferian-towers-t3', title: 'Fam/Famine', durationMs: 404000 },
      { number: 4, id: 'lst-luciferian-towers-t4', title: 'Anthem for No State', durationMs: 878000 },
    ],
  },
  {
    id: 'lst-gds-pee-at-states-end',
    title: 'G_d’s Pee AT STATE’S END!',
    artist: 'Godspeed You! Black Emperor',
    artistId: 'lst-artist-godspeed-you-black-emperor',
    year: 2021,
    // tracks 1 and 3 are suites, titled here as the record lists them
    artworkUrl: 'https://coverartarchive.org/release-group/3805cfb2-b333-4ed0-a696-019666cca5d7/front-500',
    musicbrainzReleaseId: 'f14ccc14-d919-419e-b627-f658845f147b',
    trackCount: 4,
    tracks: [
      { number: 1, id: 'lst-gds-pee-at-states-end-t1', title: 'A Military Alphabet (five eyes all blind) (4521.0kHz 6730.0kHz 4109.09kHz) / Job’s Lament / First of the Last Glaciers / where we break how we shine (ROCKETS FOR MARY)', durationMs: 1222320 },
      { number: 2, id: 'lst-gds-pee-at-states-end-t2', title: 'Fire at Static Valley', durationMs: 358413 },
      { number: 3, id: 'lst-gds-pee-at-states-end-t3', title: '“GOVERNMENT CAME” (9980.0kHz 3617.1kHz 4521.0 kHz) / Cliffs Gaze / cliffs’ gaze at empty waters’ rise / ASHES TO SEA or NEARER TO THEE', durationMs: 1187840 },
      { number: 4, id: 'lst-gds-pee-at-states-end-t4', title: 'OUR SIDE HAS TO WIN (for D.H.)', durationMs: 390080 },
    ],
  },
  {
    id: 'lst-no-title-as-of-13-february-2024',
    title: 'NO TITLE AS OF 13 FEBRUARY 2024 28,340 DEAD',
    artist: 'Godspeed You! Black Emperor',
    artistId: 'lst-artist-godspeed-you-black-emperor',
    year: 2024,
    artworkUrl: 'https://coverartarchive.org/release-group/7df4cbb0-30ed-4fed-9383-dd5fe3dbff30/front-500',
    musicbrainzReleaseId: '38b276d0-b05f-48f0-bb4b-19adf8ce3c49',
    trackCount: 6,
    tracks: [
      { number: 1, id: 'lst-no-title-as-of-13-february-2024-t1', title: 'SUN IS A HOLE SUN IS VAPORS', durationMs: 331666 },
      { number: 2, id: 'lst-no-title-as-of-13-february-2024-t2', title: 'BABYS IN A THUNDERCLOUD', durationMs: 816706 },
      { number: 3, id: 'lst-no-title-as-of-13-february-2024-t3', title: 'RAINDROPS CAST IN LEAD', durationMs: 797413 },
      { number: 4, id: 'lst-no-title-as-of-13-february-2024-t4', title: 'BROKEN SPIRES AT DEAD KAPITAL', durationMs: 214693 },
      { number: 5, id: 'lst-no-title-as-of-13-february-2024-t5', title: 'PALE SPECTATOR TAKES PHOTOGRAPHS', durationMs: 677066 },
      { number: 6, id: 'lst-no-title-as-of-13-february-2024-t6', title: 'GREY RUBBLE – GREEN SHOOTS', durationMs: 413960 },
    ],
  },
  {
    id: 'lst-animal-religioso',
    title: 'Animal Religioso',
    artist: 'Genuflexión',
    artistId: '1456200095',        // the band IS on Apple Music — these two records aren't
    year: 2016,
    // Apple Music carries only Apoteosis Fallida and Padre de Todos los
    // Abismos. Dated 2016 on both MusicBrainz and Metal Archives; the 2015 in
    // the suggestion is most likely their Promo 2015 single.
    artworkUrl: 'https://coverartarchive.org/release-group/276eed8e-6976-46f3-8ffc-d3195702750e/front-500',
    musicbrainzReleaseId: 'e4447eb5-0620-44fb-82de-24d954735fe0',
    trackCount: 7,
    tracks: [
      { number: 1, id: 'lst-animal-religioso-t1', title: 'Animal religioso', durationMs: 344000 },
      { number: 2, id: 'lst-animal-religioso-t2', title: 'A imagen y semejanza de mis necesidades', durationMs: 357000 },
      { number: 3, id: 'lst-animal-religioso-t3', title: 'Vulneravilidad emocional de un dios', durationMs: 359000 },
      { number: 4, id: 'lst-animal-religioso-t4', title: 'Esclavo en templos interiores', durationMs: 348000 },
      { number: 5, id: 'lst-animal-religioso-t5', title: 'Adoración de la deidad que creé creyendo', durationMs: 338000 },
      { number: 6, id: 'lst-animal-religioso-t6', title: 'Universo mental', durationMs: 304000 },
      { number: 7, id: 'lst-animal-religioso-t7', title: 'Genuflexión', durationMs: 349000 },
    ],
  },
  {
    id: 'lst-donde-la-razon-posa-su-fuego',
    title: 'Donde La Razón Posa Su Fuego',
    artist: 'Genuflexión',
    artistId: '1456200095',
    year: 2024,
    // MusicBrainz has the tracklist but no lengths for this one; those come
    // from the album's Spotify listing, which matches its running order.
    artworkUrl: 'https://coverartarchive.org/release-group/8a2d4f69-4d74-4a4a-aba5-10dd7bb49e8c/front-500',
    musicbrainzReleaseId: 'c5ad06ac-112e-44c1-8aec-4d51af9c621f',
    trackCount: 7,
    tracks: [
      { number: 1, id: 'lst-donde-la-razon-posa-su-fuego-t1', title: 'Donde la razón posa su fuego', durationMs: 263125 },
      { number: 2, id: 'lst-donde-la-razon-posa-su-fuego-t2', title: 'Teogonía', durationMs: 297375 },
      { number: 3, id: 'lst-donde-la-razon-posa-su-fuego-t3', title: 'La escritura del dios', durationMs: 295616 },
      { number: 4, id: 'lst-donde-la-razon-posa-su-fuego-t4', title: 'Ajna', durationMs: 126250 },
      { number: 5, id: 'lst-donde-la-razon-posa-su-fuego-t5', title: 'Vástago de fuego y penumbra', durationMs: 347625 },
      { number: 6, id: 'lst-donde-la-razon-posa-su-fuego-t6', title: 'Desobediencia del primer hombre', durationMs: 314875 },
      { number: 7, id: 'lst-donde-la-razon-posa-su-fuego-t7', title: 'Fervor de fe', durationMs: 256625 },
    ],
  },
  {
    id: 'lst-elvis-sings-hits-movies-1',
    title: 'Elvis Sings Hits from His Movies, Volume 1',
    artist: 'Elvis Presley',
    artistId: '197443',
    year: 1972,
    isCompilation: true,          // files under Collections, not beside the studio albums
    // the 1972 RCA Camden compilation; Apple Music has the songs only inside other collections
    artworkUrl: 'https://coverartarchive.org/release-group/3ae96b6e-cce9-4ddf-9251-51252b3376a9/front-500',
    musicbrainzReleaseId: '4a176ad6-b9e5-4edc-974f-3f6e32cbc19d',
    trackCount: 10,
    tracks: [
      { number: 1, id: 'lst-elvis-sings-hits-movies-1-t1', title: 'Down by the Riverside / When the Saints Go Marching In', durationMs: 113000 },
      { number: 2, id: 'lst-elvis-sings-hits-movies-1-t2', title: 'They Remind Me Too Much of You', durationMs: 151000 },
      { number: 3, id: 'lst-elvis-sings-hits-movies-1-t3', title: 'Confidence', durationMs: 152000 },
      { number: 4, id: 'lst-elvis-sings-hits-movies-1-t4', title: 'Frankie and Johnny', durationMs: 154000 },
      { number: 5, id: 'lst-elvis-sings-hits-movies-1-t5', title: 'Guitar Man', durationMs: 134000 },
      { number: 6, id: 'lst-elvis-sings-hits-movies-1-t6', title: 'Long Legged Girl (With the Short Dress On)', durationMs: 85000 },
      { number: 7, id: 'lst-elvis-sings-hits-movies-1-t7', title: 'You Don\'t Know Me', durationMs: 148000 },
      { number: 8, id: 'lst-elvis-sings-hits-movies-1-t8', title: 'How Would You Like to Be', durationMs: 204000 },
      { number: 9, id: 'lst-elvis-sings-hits-movies-1-t9', title: 'Big Boss Man', durationMs: 168000 },
      { number: 10, id: 'lst-elvis-sings-hits-movies-1-t10', title: 'Old MacDonald', durationMs: 118000 },
    ],
  },
  {
    id: 'lst-burning-love-hits-movies-2',
    title: 'Burning Love and Hits from His Movies, Volume 2',
    artist: 'Elvis Presley',
    artistId: '197443',
    year: 1972,
    isCompilation: true,          // files under Collections, not beside the studio albums
    // its vinyl listing on MusicBrainz carries no track lengths, so those come from Apple's own data for the same recordings
    artworkUrl: 'https://coverartarchive.org/release-group/1d1c653c-d99f-3e55-86c0-8f867328f650/front-500',
    musicbrainzReleaseId: 'c7eeb999-e3f4-4350-bedb-a12451bb343b',
    trackCount: 10,
    tracks: [
      { number: 1, id: 'lst-burning-love-hits-movies-2-t1', title: 'Burning Love', durationMs: 171498 },
      { number: 2, id: 'lst-burning-love-hits-movies-2-t2', title: 'Tender Feeling', durationMs: 156178 },
      { number: 3, id: 'lst-burning-love-hits-movies-2-t3', title: 'Am I Ready', durationMs: 146616 },
      { number: 4, id: 'lst-burning-love-hits-movies-2-t4', title: 'Tonight Is So Right for Love', durationMs: 135447 },
      { number: 5, id: 'lst-burning-love-hits-movies-2-t5', title: 'Guadalajara', durationMs: 165680 },
      { number: 6, id: 'lst-burning-love-hits-movies-2-t6', title: 'It\'s a Matter of Time', durationMs: 183885 },
      { number: 7, id: 'lst-burning-love-hits-movies-2-t7', title: 'No More', durationMs: 144184 },
      { number: 8, id: 'lst-burning-love-hits-movies-2-t8', title: 'Santa Lucia', durationMs: 74375 },
      { number: 9, id: 'lst-burning-love-hits-movies-2-t9', title: 'We\'ll Be Together', durationMs: 138613 },
      { number: 10, id: 'lst-burning-love-hits-movies-2-t10', title: 'I Love Only One Girl', durationMs: 116460 },
    ],
  },
  {
    id: 'lst-the-sun-sessions',
    title: 'The Sun Sessions',
    artist: 'Elvis Presley',
    artistId: '197443',
    year: 1976,
    isCompilation: true,          // files under Collections, not beside the studio albums
    // the 1976 collection of his 1954-55 Sun recordings; cover comes from the US pressing, the release group having none
    artworkUrl: 'https://coverartarchive.org/release/b37637b5-2d90-4892-93d4-a05c95d18a51/front-500',
    musicbrainzReleaseId: 'ffd6800b-e446-4a89-8db7-bda486845d8a',
    trackCount: 16,
    tracks: [
      { number: 1, id: 'lst-the-sun-sessions-t1', title: 'That’s All Right', durationMs: 117666 },
      { number: 2, id: 'lst-the-sun-sessions-t2', title: 'Blue Moon of Kentucky', durationMs: 124226 },
      { number: 3, id: 'lst-the-sun-sessions-t3', title: 'I Don’t Care If the Sun Don’t Shine', durationMs: 148840 },
      { number: 4, id: 'lst-the-sun-sessions-t4', title: 'Good Rockin’ Tonight', durationMs: 134266 },
      { number: 5, id: 'lst-the-sun-sessions-t5', title: 'Milk Cow Blues', durationMs: 159333 },
      { number: 6, id: 'lst-the-sun-sessions-t6', title: 'You’re a Heartbreaker', durationMs: 132426 },
      { number: 7, id: 'lst-the-sun-sessions-t7', title: 'I’m Left, You’re Right, She’s Gone', durationMs: 157906 },
      { number: 8, id: 'lst-the-sun-sessions-t8', title: 'Baby Let’s Play House', durationMs: 137160 },
      { number: 9, id: 'lst-the-sun-sessions-t9', title: 'Mystery Train', durationMs: 146373 },
      { number: 10, id: 'lst-the-sun-sessions-t10', title: 'I Forgot to Remember to Forget', durationMs: 150600 },
      { number: 11, id: 'lst-the-sun-sessions-t11', title: 'I’ll Never Let You Go (Little Darlin’)', durationMs: 146666 },
      { number: 12, id: 'lst-the-sun-sessions-t12', title: 'Trying to Get to You', durationMs: 153093 },
      { number: 13, id: 'lst-the-sun-sessions-t13', title: 'I Love You Because', durationMs: 164240 },
      { number: 14, id: 'lst-the-sun-sessions-t14', title: 'Blue Moon', durationMs: 161866 },
      { number: 15, id: 'lst-the-sun-sessions-t15', title: 'Just Because', durationMs: 154826 },
      { number: 16, id: 'lst-the-sun-sessions-t16', title: 'I Love You Because (2nd version)', durationMs: 204507 },
    ],
  },
  {
    id: 'lst-nostalgia-ultra',
    title: 'nostalgia, ULTRA',
    artist: 'Frank Ocean',
    isMixtape: true,              // self-released mixtape, not a Def Jam album
    artistId: '442122051',
    year: 2011,
    // the 2011 mixtape, never licensed to streaming over its samples
    artworkUrl: 'https://coverartarchive.org/release-group/c2dde373-d47b-45a9-8b7e-0a9f5f011ed4/front-500',
    musicbrainzReleaseId: '4fe337a7-2e91-4475-be84-af9cf8ad2e3c',
    trackCount: 14,
    tracks: [
      { number: 1, id: 'lst-nostalgia-ultra-t1', title: 'Street Fighter', durationMs: 22000 },
      { number: 2, id: 'lst-nostalgia-ultra-t2', title: 'Strawberry Swing', durationMs: 235000 },
      { number: 3, id: 'lst-nostalgia-ultra-t3', title: 'Novacane', durationMs: 302000 },
      { number: 4, id: 'lst-nostalgia-ultra-t4', title: 'We All Try', durationMs: 171000 },
      { number: 5, id: 'lst-nostalgia-ultra-t5', title: 'Bitches Talkin’', durationMs: 22000 },
      { number: 6, id: 'lst-nostalgia-ultra-t6', title: 'Songs 4 Women', durationMs: 253000 },
      { number: 7, id: 'lst-nostalgia-ultra-t7', title: 'Lovecrimes', durationMs: 240000 },
      { number: 8, id: 'lst-nostalgia-ultra-t8', title: 'Goldeneye', durationMs: 18000 },
      { number: 9, id: 'lst-nostalgia-ultra-t9', title: 'There Will Be Tears', durationMs: 194000 },
      { number: 10, id: 'lst-nostalgia-ultra-t10', title: 'Swim Good', durationMs: 256000 },
      { number: 11, id: 'lst-nostalgia-ultra-t11', title: 'Dust', durationMs: 153000 },
      { number: 12, id: 'lst-nostalgia-ultra-t12', title: 'American Wedding', durationMs: 420000 },
      { number: 13, id: 'lst-nostalgia-ultra-t13', title: 'Soul Calibur', durationMs: 18000 },
      { number: 14, id: 'lst-nostalgia-ultra-t14', title: 'Nature Feels', durationMs: 223000 },
    ],
  },
  {
    id: 'lst-endless',
    title: 'Endless',
    artist: 'Frank Ocean',
    artistId: '442122051',
    year: 2016,
    // the 2016 visual album, in its 19-track audio running order
    artworkUrl: 'https://coverartarchive.org/release-group/b69366e3-8145-405e-9220-c0a575f23474/front-500',
    musicbrainzReleaseId: '52a23fb7-98da-497f-b19c-f70707732142',
    trackCount: 19,
    tracks: [
      { number: 1, id: 'lst-endless-t1', title: 'At Your Best (You Are Love)', durationMs: 320000 },
      { number: 2, id: 'lst-endless-t2', title: 'Alabama', durationMs: 84000 },
      { number: 3, id: 'lst-endless-t3', title: 'Mine', durationMs: 32000 },
      { number: 4, id: 'lst-endless-t4', title: 'Unity', durationMs: 173000 },
      { number: 5, id: 'lst-endless-t5', title: 'A Certain Way', durationMs: 11000 },
      { number: 6, id: 'lst-endless-t6', title: 'Comme des Garçons', durationMs: 58000 },
      { number: 7, id: 'lst-endless-t7', title: 'Xenons', durationMs: 31000 },
      { number: 8, id: 'lst-endless-t8', title: 'Honeybaby', durationMs: 9000 },
      { number: 9, id: 'lst-endless-t9', title: 'Wither', durationMs: 153000 },
      { number: 10, id: 'lst-endless-t10', title: 'Hublots', durationMs: 108000 },
      { number: 11, id: 'lst-endless-t11', title: 'In Here Somewhere', durationMs: 104000 },
      { number: 12, id: 'lst-endless-t12', title: 'Slide on Me', durationMs: 186000 },
      { number: 13, id: 'lst-endless-t13', title: 'Sideways', durationMs: 113000 },
      { number: 14, id: 'lst-endless-t14', title: 'Florida', durationMs: 75000 },
      { number: 15, id: 'lst-endless-t15', title: 'Impietas + Deathwish', durationMs: 115000 },
      { number: 16, id: 'lst-endless-t16', title: 'Rushes', durationMs: 205000 },
      { number: 17, id: 'lst-endless-t17', title: 'Rushes To', durationMs: 132000 },
      { number: 18, id: 'lst-endless-t18', title: 'Higgs', durationMs: 218000 },
      { number: 19, id: 'lst-endless-t19', title: 'Mitsubishi Sony', durationMs: 170000 },
    ],
  },
  {
    id: 'lst-fillet-show',
    title: 'Fillet Show',
    artist: 'Hum',
    artistId: '509823',
    year: 1991,
    // Hum's debut; Apple Music starts at Electra 2000 and has never had this.
    artworkUrl: 'https://coverartarchive.org/release-group/5f9cf186-d48d-3282-968a-b3b477e3cdb4/front-500',
    musicbrainzReleaseId: '2f023580-2736-48da-ba12-33554dcb9a14',
    trackCount: 9,
    tracks: [
      { number: 1, id: 'lst-fillet-show-t1', title: 'Space Fuck', durationMs: 269200 },
      { number: 2, id: 'lst-fillet-show-t2', title: 'Formaldehyde', durationMs: 149360 },
      { number: 3, id: 'lst-fillet-show-t3', title: 'Detassler', durationMs: 155066 },
      { number: 4, id: 'lst-fillet-show-t4', title: 'Staring at the Sun', durationMs: 160266 },
      { number: 5, id: 'lst-fillet-show-t5', title: 'Hortense', durationMs: 215666 },
      { number: 6, id: 'lst-fillet-show-t6', title: 'Kind of Night', durationMs: 167240 },
      { number: 7, id: 'lst-fillet-show-t7', title: 'Lip Saga', durationMs: 246466 },
      { number: 8, id: 'lst-fillet-show-t8', title: 'I Like It', durationMs: 168960 },
      { number: 9, id: 'lst-fillet-show-t9', title: 'Pocket', durationMs: 357774 },
    ],
  },
  {
    id: 'lst-resting-state',
    title: 'Resting State',
    artist: 'HOME',
    artistId: '1800310212',
    year: 2017,
    // Bandcamp-only; Apple Music has Odyssey, Before the Night, Falling into
    // Place and the Hold EP, but not this. Its 35 tracks really are titled "1"
    // through "35" — MusicBrainz and the band's own Bandcamp page agree, and
    // their run times match to the second.
    artworkUrl: 'https://coverartarchive.org/release-group/4b3690a2-08f1-4928-962c-2020918f6e67/front-500',
    musicbrainzReleaseId: '6f2e2406-3dab-4d4b-9d09-959fcf1714ea',
    trackCount: 35,
    tracks: [
      { number: 1, id: 'lst-resting-state-t1', title: '1', durationMs: 81534 },
      { number: 2, id: 'lst-resting-state-t2', title: '2', durationMs: 106794 },
      { number: 3, id: 'lst-resting-state-t3', title: '3', durationMs: 56351 },
      { number: 4, id: 'lst-resting-state-t4', title: '4', durationMs: 81278 },
      { number: 5, id: 'lst-resting-state-t5', title: '5', durationMs: 77058 },
      { number: 6, id: 'lst-resting-state-t6', title: '6', durationMs: 82286 },
      { number: 7, id: 'lst-resting-state-t7', title: '7', durationMs: 86406 },
      { number: 8, id: 'lst-resting-state-t8', title: '8', durationMs: 197146 },
      { number: 9, id: 'lst-resting-state-t9', title: '9', durationMs: 175174 },
      { number: 10, id: 'lst-resting-state-t10', title: '10', durationMs: 83478 },
      { number: 11, id: 'lst-resting-state-t11', title: '11', durationMs: 97255 },
      { number: 12, id: 'lst-resting-state-t12', title: '12', durationMs: 137528 },
      { number: 13, id: 'lst-resting-state-t13', title: '13', durationMs: 72935 },
      { number: 14, id: 'lst-resting-state-t14', title: '14', durationMs: 80914 },
      { number: 15, id: 'lst-resting-state-t15', title: '15', durationMs: 98526 },
      { number: 16, id: 'lst-resting-state-t16', title: '16', durationMs: 32000 },
      { number: 17, id: 'lst-resting-state-t17', title: '17', durationMs: 90566 },
      { number: 18, id: 'lst-resting-state-t18', title: '18', durationMs: 93031 },
      { number: 19, id: 'lst-resting-state-t19', title: '19', durationMs: 84875 },
      { number: 20, id: 'lst-resting-state-t20', title: '20', durationMs: 92897 },
      { number: 21, id: 'lst-resting-state-t21', title: '21', durationMs: 131417 },
      { number: 22, id: 'lst-resting-state-t22', title: '22', durationMs: 85405 },
      { number: 23, id: 'lst-resting-state-t23', title: '23', durationMs: 112941 },
      { number: 24, id: 'lst-resting-state-t24', title: '24', durationMs: 93405 },
      { number: 25, id: 'lst-resting-state-t25', title: '25', durationMs: 54000 },
      { number: 26, id: 'lst-resting-state-t26', title: '26', durationMs: 58039 },
      { number: 27, id: 'lst-resting-state-t27', title: '27', durationMs: 56231 },
      { number: 28, id: 'lst-resting-state-t28', title: '28', durationMs: 26696 },
      { number: 29, id: 'lst-resting-state-t29', title: '29', durationMs: 97067 },
      { number: 30, id: 'lst-resting-state-t30', title: '30', durationMs: 104571 },
      { number: 31, id: 'lst-resting-state-t31', title: '31', durationMs: 50891 },
      { number: 32, id: 'lst-resting-state-t32', title: '32', durationMs: 111552 },
      { number: 33, id: 'lst-resting-state-t33', title: '33', durationMs: 111819 },
      { number: 34, id: 'lst-resting-state-t34', title: '34', durationMs: 97959 },
      { number: 35, id: 'lst-resting-state-t35', title: '35', durationMs: 129695 },
    ],
  },
  {
    id: 'lst-one-night-in-paris',
    title: 'One Night in Paris',
    artist: 'Depeche Mode',
    artistId: '148377',
    year: 2002,
    isLive: true,                 // the Exciter tour concert film; Live tab, not Albums
    // Never issued as an audio album — Apple Music has 101, Songs of Faith and
    // Devotion Live and the rest, but not this. Two discs of the release,
    // numbered straight through here.
    artworkUrl: 'https://coverartarchive.org/release-group/15095ea0-35f8-3f0a-8422-95a9074aaf70/front-500',
    musicbrainzReleaseId: 'c6bb16eb-ab02-4529-9893-bcb62fed6e96',
    trackCount: 20,
    tracks: [
      { number: 1, id: 'lst-one-night-in-paris-t1', title: 'Intro: Easy Tiger / Dream On (instrumental)', durationMs: 215000 },
      { number: 2, id: 'lst-one-night-in-paris-t2', title: 'The Dead of Night', durationMs: 306000 },
      { number: 3, id: 'lst-one-night-in-paris-t3', title: 'The Sweetest Condition', durationMs: 238000 },
      { number: 4, id: 'lst-one-night-in-paris-t4', title: 'Halo', durationMs: 290000 },
      { number: 5, id: 'lst-one-night-in-paris-t5', title: 'Walking in My Shoes', durationMs: 379000 },
      { number: 6, id: 'lst-one-night-in-paris-t6', title: 'Dream On', durationMs: 340000 },
      { number: 7, id: 'lst-one-night-in-paris-t7', title: 'When the Body Speaks', durationMs: 420000 },
      { number: 8, id: 'lst-one-night-in-paris-t8', title: 'Waiting for the Night', durationMs: 365000 },
      { number: 9, id: 'lst-one-night-in-paris-t9', title: 'It Doesn’t Matter Two', durationMs: 227000 },
      { number: 10, id: 'lst-one-night-in-paris-t10', title: 'Breathe', durationMs: 321000 },
      { number: 11, id: 'lst-one-night-in-paris-t11', title: 'Freelove', durationMs: 429000 },
      { number: 12, id: 'lst-one-night-in-paris-t12', title: 'Enjoy the Silence', durationMs: 440000 },
      { number: 13, id: 'lst-one-night-in-paris-t13', title: 'I Feel You', durationMs: 419000 },
      { number: 14, id: 'lst-one-night-in-paris-t14', title: 'In Your Room', durationMs: 327000 },
      { number: 15, id: 'lst-one-night-in-paris-t15', title: 'It’s No Good', durationMs: 292000 },
      { number: 16, id: 'lst-one-night-in-paris-t16', title: 'Personal Jesus', durationMs: 459000 },
      { number: 17, id: 'lst-one-night-in-paris-t17', title: 'Home', durationMs: 376000 },
      { number: 18, id: 'lst-one-night-in-paris-t18', title: 'Condemnation', durationMs: 263000 },
      { number: 19, id: 'lst-one-night-in-paris-t19', title: 'Black Celebration', durationMs: 287000 },
      { number: 20, id: 'lst-one-night-in-paris-t20', title: 'Never Let Me Down Again', durationMs: 679000 },
    ],
  },
  {
    id: 'lst-chez-moi',
    title: 'Chez Moi',
    artist: 'Claudio Montana',
    artistId: '1482389408',
    year: 2022,
    // Taken off streaming; Apple Music has his singles and one EP, not this.
    // Reconstructed from two fan uploads, there being no catalogue entry
    // anywhere — not MusicBrainz, Discogs or Deezer. A podcast upload of the
    // album carries four tracks; the uploader's YouTube channel has three more
    // tagged [Chez Moi], and where the two overlap their run times agree to the
    // second. Order follows that channel's upload sequence, all seven posted
    // within nine minutes on 2022-03-28.
    //
    // 2022 is therefore the latest the record can be, not a confirmed release
    // year — the artist keeps almost nothing online. Worth correcting if the
    // suggester ever answers, though note that reviews match on title+year, so
    // changing it later strands any ratings logged against 2022.
    artworkUrl: `${PUBLIC_BASE_URL}/static/albums/chez-moi.jpg`,
    trackCount: 7,
    tracks: [
      { number: 1, id: 'lst-chez-moi-t1', title: 'Queens', durationMs: 134000 },
      { number: 2, id: 'lst-chez-moi-t2', title: 'Chloë Sevigny', durationMs: 162000 },
      { number: 3, id: 'lst-chez-moi-t3', title: 'NEO 2', durationMs: 123000 },
      { number: 4, id: 'lst-chez-moi-t4', title: 'Billetes de Metro', durationMs: 132000 },
      { number: 5, id: 'lst-chez-moi-t5', title: 'Whoopie Pie', durationMs: 103000 },
      { number: 6, id: 'lst-chez-moi-t6', title: 'I luv BCN', durationMs: 76000 },
      { number: 7, id: 'lst-chez-moi-t7', title: 'Amigas', durationMs: 97000 },
    ],
  },
  {
    id: 'lst-juicewrld-9-9-9',
    title: 'JuiceWRLD 9 9 9',
    artist: 'Juice WRLD',
    isMixtape: true,              // an EP; files under EPs & Mixtapes
    artistId: '1368733420',
    year: 2017,
    // SoundCloud-only EP (the one that broke "Lucid Dreams"), never put out on
    // streaming as a whole. Tracklist and durations from the SoundCloud set,
    // matching MusicBrainz and Wikipedia; an early 9-track version with
    // "Sticks & Stones" has since been pulled back to these 8.
    artworkUrl: 'https://coverartarchive.org/release-group/5892ca63-5f82-401a-ae14-5cf458003190/front-500',
    musicbrainzReleaseId: '75bdef0d-7763-4cab-8ee5-0887ebdc48ca',
    trackCount: 8,
    tracks: [
      { number: 1, id: 'lst-juicewrld-9-9-9-t1', title: 'Moonlight', durationMs: 178070 },
      { number: 2, id: 'lst-juicewrld-9-9-9-t2', title: 'Lucid Dreams', durationMs: 239882 },
      { number: 3, id: 'lst-juicewrld-9-9-9-t3', title: 'Eye Contact (Look Me in My Eyes)', durationMs: 199987 },
      { number: 4, id: 'lst-juicewrld-9-9-9-t4', title: 'Rainbow', durationMs: 234887 },
      { number: 5, id: 'lst-juicewrld-9-9-9-t5', title: 'Lost Her', durationMs: 191680 },
      { number: 6, id: 'lst-juicewrld-9-9-9-t6', title: 'Two Cups (Everything’s Going My Way)', durationMs: 151504 },
      { number: 7, id: 'lst-juicewrld-9-9-9-t7', title: 'Let Me Know (I Wonder Why Freestyle)', durationMs: 215138 },
      { number: 8, id: 'lst-juicewrld-9-9-9-t8', title: 'Until It’s Over (Closure)', durationMs: 216052 },
    ],
  },
  {
    id: 'lst-jester',
    title: 'Jester',
    artist: 'Jester',
    artistId: 'lst-artist-jester',
    year: 1978,
    // A private-press LP (no label, cat. J-151) by a US prog/soul band, never
    // reissued or put on streaming. Year, tracklist and cover from its one
    // Discogs entry (release 5227929); not on MusicBrainz. Discogs has no
    // times, so durations come from the chapter marks of a full-album YouTube
    // upload, to the second; they sum to its 42:28 length.
    artworkUrl: `${PUBLIC_BASE_URL}/static/albums/jester.jpg`,
    trackCount: 10,
    tracks: [
      { number: 1, id: 'lst-jester-t1', title: '(You Can) Find Another Way', durationMs: 248000 },
      { number: 2, id: 'lst-jester-t2', title: 'Little Davey', durationMs: 188000 },
      { number: 3, id: 'lst-jester-t3', title: 'Battle of Five Armies', durationMs: 281000 },
      { number: 4, id: 'lst-jester-t4', title: 'He Put It in the Window', durationMs: 200000 },
      { number: 5, id: 'lst-jester-t5', title: 'Why Rain?', durationMs: 309000 },
      { number: 6, id: 'lst-jester-t6', title: 'The Choice Is Yours', durationMs: 338000 },
      { number: 7, id: 'lst-jester-t7', title: 'Johnny the Rocker', durationMs: 230000 },
      { number: 8, id: 'lst-jester-t8', title: 'Everybody', durationMs: 248000 },
      { number: 9, id: 'lst-jester-t9', title: 'Seven & Seven', durationMs: 220000 },
      { number: 10, id: 'lst-jester-t10', title: 'Lobo', durationMs: 286000 },
    ],
  },
  {
    id: 'lst-gialorgues',
    title: 'Gialorgues',
    artist: 'Shylock',
    artistId: 'lst-artist-shylock',
    year: 1976,
    // French symphonic prog, self-released in 1976 and reissued by CBS in
    // 1977; never on streaming. MusicBrainz and Discogs agree on the
    // tracklist and timings to the second.
    artworkUrl: 'https://coverartarchive.org/release-group/17f01921-089e-313d-8bb9-898d960b3163/front-500',
    musicbrainzReleaseId: '93da7c77-efbb-41ac-a2d1-2b289a20920d',
    trackCount: 3,
    tracks: [
      { number: 1, id: 'lst-gialorgues-t1', title: 'Le Quatrième', durationMs: 785000 },
      { number: 2, id: 'lst-gialorgues-t2', title: 'Le Sixième', durationMs: 230000 },
      { number: 3, id: 'lst-gialorgues-t3', title: 'Le Cinquième', durationMs: 1134000 },
    ],
  },
  {
    id: 'lst-spin',
    title: 'Spin',
    artist: 'Spin',
    artistId: '1686918615',        // Apple has their second album, Whirlwind, under this artist
    year: 1976,
    // The Dutch jazz-rock band's debut on Ariola. Timings from the original
    // Dutch pressing on MusicBrainz, which agree in order with a full-album
    // YouTube upload's chapter marks; the US pressing's entry looks garbled.
    artworkUrl: 'https://coverartarchive.org/release-group/d1085abc-363d-3297-bdca-91c17f15ef2e/front-500',
    musicbrainzReleaseId: '318ea64d-e531-4054-99a8-53e2218f4c6e',
    trackCount: 8,
    tracks: [
      { number: 1, id: 'lst-spin-t1', title: 'Grasshopper', durationMs: 265000 },
      { number: 2, id: 'lst-spin-t2', title: 'Spinning', durationMs: 239000 },
      { number: 3, id: 'lst-spin-t3', title: 'Excenter', durationMs: 311000 },
      { number: 4, id: 'lst-spin-t4', title: 'Sea and Seasons', durationMs: 282000 },
      { number: 5, id: 'lst-spin-t5', title: 'Little Bitch', durationMs: 342000 },
      { number: 6, id: 'lst-spin-t6', title: 'Sunday Afternoon’s Dream', durationMs: 292000 },
      { number: 7, id: 'lst-spin-t7', title: 'Flat Tyre', durationMs: 212000 },
      { number: 8, id: 'lst-spin-t8', title: 'Beautiful Queenie', durationMs: 269000 },
    ],
  },
  {
    id: 'lst-lady-of-shalott',
    title: 'Lady of Shalott',
    artist: 'Atmosphera',
    artistId: 'lst-artist-atmosphera',
    year: 1977,
    // Israeli prog. The two long pieces were recorded in 1977 (℗ Nana Disc)
    // and shelved; the album first came out on CD in 2002 (MIO Records), with
    // two 1975 home recordings and an alternate Cuckoo. 1977 follows
    // MusicBrainz and the suggester. Tracklist and timings from MusicBrainz,
    // the CD's audio disc only (its second disc is a video CD).
    artworkUrl: 'https://coverartarchive.org/release-group/cb7f74f4-a5af-436c-b1f8-d53ba154ef79/front-500',
    musicbrainzReleaseId: '2dd3b9dd-fc82-4b63-b5fd-a396b8bc91ce',
    trackCount: 5,
    tracks: [
      { number: 1, id: 'lst-lady-of-shalott-t1', title: 'Lady of Shalott', durationMs: 983000 },
      { number: 2, id: 'lst-lady-of-shalott-t2', title: 'Cuckoo (Love’s Labour’s Lost)', durationMs: 1006000 },
      { number: 3, id: 'lst-lady-of-shalott-t3', title: 'Tomorrow', durationMs: 644000 },
      { number: 4, id: 'lst-lady-of-shalott-t4', title: 'Love Is Waiting for a Lover', durationMs: 478000 },
      { number: 5, id: 'lst-lady-of-shalott-t5', title: 'Cuckoo (Alternate Version)', durationMs: 983000 },
    ],
  },
  {
    id: 'lst-love-you-less',
    title: 'LOVE YOU LESS',
    artist: 'Joji',
    artistId: '1258279972',
    year: 2026,
    // A four-song EP released ahead of Piss In The Wind; Spotify, Deezer and
    // Tidal carry it, Apple only has the songs on the album. Tracklist and
    // timings from MusicBrainz, matching Spotify to the millisecond.
    artworkUrl: 'https://coverartarchive.org/release-group/5191a62c-bf0f-4fd0-8420-fa774ca1fa0e/front-500',
    musicbrainzReleaseId: '4d8ac963-f81d-48db-ba39-02817ccc9092',
    trackCount: 4,
    tracks: [
      { number: 1, id: 'lst-love-you-less-t1', title: 'LOVE YOU LESS', durationMs: 201186 },
      { number: 2, id: 'lst-love-you-less-t2', title: 'Past Won’t Leave My Bed', durationMs: 166106 },
      { number: 3, id: 'lst-love-you-less-t3', title: 'If It Only Gets Better', durationMs: 68600 },
      { number: 4, id: 'lst-love-you-less-t4', title: 'PIXELATED KISSES', durationMs: 110430 },
    ],
  },
  {
    id: 'lst-korova-milky-bar',
    title: 'Korova Milky Bar',
    artist: 'Myslovitz',
    artistId: '156979662',
    year: 2002,
    // Their best-known album, absent from Apple everywhere though most of
    // their catalogue is there; a 9-track digital release is marked withdrawn
    // on MusicBrainz. The original 2002 Polish CD (Sony), not the 2003
    // English-language version. MusicBrainz and Discogs agree on the
    // tracklist and timings to the second; the last track runs on through a
    // hidden one, hence its 16 minutes.
    artworkUrl: 'https://coverartarchive.org/release-group/223b56fd-337f-3941-8348-21f98b5e8f10/front-500',
    musicbrainzReleaseId: 'a537debd-0c0d-4c63-8c4f-04031dc48adc',
    trackCount: 11,
    tracks: [
      { number: 1, id: 'lst-korova-milky-bar-t1', title: 'Sprzedawcy marzeń', durationMs: 235373 },
      { number: 2, id: 'lst-korova-milky-bar-t2', title: 'Acidland', durationMs: 254226 },
      { number: 3, id: 'lst-korova-milky-bar-t3', title: 'Bar mleczny Korova', durationMs: 184386 },
      { number: 4, id: 'lst-korova-milky-bar-t4', title: 'Wieża melancholii', durationMs: 312093 },
      { number: 5, id: 'lst-korova-milky-bar-t5', title: 'Za zamkniętymi oczami', durationMs: 208173 },
      { number: 6, id: 'lst-korova-milky-bar-t6', title: 'Kilka błędów popełnionych przez dobrych rodziców', durationMs: 235720 },
      { number: 7, id: 'lst-korova-milky-bar-t7', title: 'Siódmy koktajl', durationMs: 258440 },
      { number: 8, id: 'lst-korova-milky-bar-t8', title: 'Nigdy nie znajdziesz sobie przyjaciół jeśli nie będziesz taki jak wszyscy', durationMs: 192560 },
      { number: 9, id: 'lst-korova-milky-bar-t9', title: 'W 10 sekund przez całe życie', durationMs: 319013 },
      { number: 10, id: 'lst-korova-milky-bar-t10', title: 'Chciałbym umrzeć z miłości', durationMs: 414506 },
      { number: 11, id: 'lst-korova-milky-bar-t11', title: 'Szklany człowiek / Pocztówka z lotniska', durationMs: 984333 },
    ],
  },
  {
    id: 'lst-in-tension',
    title: 'In Tension',
    artist: 'Light Asylum',
    artistId: '433559884',
    year: 2011,
    // Their debut EP, which Apple doesn't carry. The Mexican Summer release
    // (digital and 12") that MusicBrainz and Discogs both date 2011; an
    // undated-label 2010 issue exists, and the CD adds a radio mix. Tracklist
    // and timings from MusicBrainz's digital release.
    artworkUrl: 'https://coverartarchive.org/release-group/66745fd5-390e-4feb-b6e0-1549b70061ac/front-500',
    musicbrainzReleaseId: 'e798697e-1184-406e-a9fa-1734deb29d12',
    trackCount: 4,
    tracks: [
      { number: 1, id: 'lst-in-tension-t1', title: 'A Certain Person', durationMs: 268000 },
      { number: 2, id: 'lst-in-tension-t2', title: 'Knights and Week Ends', durationMs: 267000 },
      { number: 3, id: 'lst-in-tension-t3', title: 'Dark Allies', durationMs: 362000 },
      { number: 4, id: 'lst-in-tension-t4', title: 'Skull Fuct', durationMs: 317000 },
    ],
  },
  {
    id: 'lst-nice-day-collection',
    title: 'Nice Day: A Collection of Singles',
    artist: 'Magdalena Bay',
    artistId: '1119954914',
    year: 2026,
    isCompilation: true,          // files under Collections, not beside the studio albums
    // Mom+Pop's four-7" box of the 2025 double singles; Apple Music only has the singles separately.
    // Track lengths come from those Apple Music singles — the vinyl listing on MusicBrainz has none.
    artworkUrl: 'https://coverartarchive.org/release-group/94693eda-0d16-46ce-8436-525305e89e27/front-500',
    musicbrainzReleaseId: '59f1b4be-1829-4633-b8e0-4935bf4e9c6a',
    trackCount: 8,
    tracks: [
      { number: 1, id: 'lst-nice-day-collection-t1', title: 'Second Sleep', durationMs: 288453 },
      { number: 2, id: 'lst-nice-day-collection-t2', title: 'Star Eyes', durationMs: 214587 },
      { number: 3, id: 'lst-nice-day-collection-t3', title: 'Human Happens', durationMs: 243053 },
      { number: 4, id: 'lst-nice-day-collection-t4', title: 'Paint Me a Picture', durationMs: 231720 },
      { number: 5, id: 'lst-nice-day-collection-t5', title: 'Unoriginal', durationMs: 178053 },
      { number: 6, id: 'lst-nice-day-collection-t6', title: 'Black-Eyed Susan Climb', durationMs: 243920 },
      { number: 7, id: 'lst-nice-day-collection-t7', title: 'This Is the World (I Made It for You)', durationMs: 281787 },
      { number: 8, id: 'lst-nice-day-collection-t8', title: 'Nice Day', durationMs: 153173 },
    ],
  },
  {
    id: 'lst-idea-zavalloni',
    title: 'Idea',
    artist: 'Cristina Zavalloni',
    artistId: '136978073',
    year: 2006,
    // Egea Records; on Deezer but not Apple Music. Cover from Deezer, hosted here — the
    // Cover Art Archive has none.
    artworkUrl: `${PUBLIC_BASE_URL}/static/albums/idea-zavalloni.jpg`,
    musicbrainzReleaseId: '311e8485-daf9-4b36-b13a-a3e6d81bcb0f',
    trackCount: 11,
    tracks: [
      { number: 1, id: 'lst-idea-zavalloni-t1', title: 'Nati per adeguarsi', durationMs: 286840 },
      { number: 2, id: 'lst-idea-zavalloni-t2', title: 'Bastava quel cielo', durationMs: 159453 },
      { number: 3, id: 'lst-idea-zavalloni-t3', title: 'Trilha dos caranguejos', durationMs: 296920 },
      { number: 4, id: 'lst-idea-zavalloni-t4', title: 'Bouqueirão', durationMs: 322000 },
      { number: 5, id: 'lst-idea-zavalloni-t5', title: 'Instinti Languidi A Riposo In Attesa', durationMs: 257573 },
      { number: 6, id: 'lst-idea-zavalloni-t6', title: 'Idea', durationMs: 202133 },
      { number: 7, id: 'lst-idea-zavalloni-t7', title: 'Amore mio mannaggiatte\'', durationMs: 309000 },
      { number: 8, id: 'lst-idea-zavalloni-t8', title: 'Cavaquinho', durationMs: 143813 },
      { number: 9, id: 'lst-idea-zavalloni-t9', title: 'But I Love Her!', durationMs: 264400 },
      { number: 10, id: 'lst-idea-zavalloni-t10', title: 'Have Yourself a Merry Little Christmas', durationMs: 275506 },
      { number: 11, id: 'lst-idea-zavalloni-t11', title: 'Per Alfredo', durationMs: 278173 },
    ],
  },
  {
    id: 'lst-inferno-metamorfosi',
    title: 'Inferno',
    artist: 'Metamorfosi',
    artistId: 'lst-artist-metamorfosi',
    year: 1973,
    // the Rome prog band's Dante concept album. Tracklist from the 1989 reissue — the 1973
    // listing on MusicBrainz splits the medleys and lacks most lengths.
    artworkUrl: 'https://coverartarchive.org/release-group/0774ff04-5efe-353d-acaa-90ad9c957ed3/front-500',
    musicbrainzReleaseId: '505565b5-f1e9-4bb5-a3a8-d04ca5363360',
    trackCount: 12,
    tracks: [
      { number: 1, id: 'lst-inferno-metamorfosi-t1', title: 'Introduzione / Selva oscura', durationMs: 470000 },
      { number: 2, id: 'lst-inferno-metamorfosi-t2', title: 'Porta dell\'Inferno', durationMs: 80333 },
      { number: 3, id: 'lst-inferno-metamorfosi-t3', title: 'Caronte', durationMs: 78826 },
      { number: 4, id: 'lst-inferno-metamorfosi-t4', title: 'Spacciatore di droga / Terremoto / Limbo', durationMs: 381506 },
      { number: 5, id: 'lst-inferno-metamorfosi-t5', title: 'Lussuriosi', durationMs: 194666 },
      { number: 6, id: 'lst-inferno-metamorfosi-t6', title: 'Avari', durationMs: 92333 },
      { number: 7, id: 'lst-inferno-metamorfosi-t7', title: 'Violenti', durationMs: 224826 },
      { number: 8, id: 'lst-inferno-metamorfosi-t8', title: 'Malebolge', durationMs: 91840 },
      { number: 9, id: 'lst-inferno-metamorfosi-t9', title: 'Sfruttatori', durationMs: 341333 },
      { number: 10, id: 'lst-inferno-metamorfosi-t10', title: 'Razzisti / Fossa dei giganti', durationMs: 205333 },
      { number: 11, id: 'lst-inferno-metamorfosi-t11', title: 'Lucifero (Politicanti)', durationMs: 152000 },
      { number: 12, id: 'lst-inferno-metamorfosi-t12', title: 'Conclusione', durationMs: 97000 },
    ],
  },
  {
    id: 'lst-mas-alla-mentes-diminutas',
    title: 'Más allá de nuestras mentes diminutas',
    artist: 'CAI',
    artistId: '1308749426',
    year: 1978,
    // their 1978 debut; Apple only has the band's later Noche Abierta and Canción de la Primavera.
    // Lengths from disc 1 of the 2007 two-on-one CD — the 1978 LP listing has none.
    artworkUrl: 'https://coverartarchive.org/release-group/4a63236c-61f3-4a89-a734-c048068ee6ac/front-500',
    musicbrainzReleaseId: '6917ac0f-e618-4c0c-aa0c-1a34e740272a',
    trackCount: 4,
    tracks: [
      { number: 1, id: 'lst-mas-alla-mentes-diminutas-t1', title: 'Alameda', durationMs: 564000 },
      { number: 2, id: 'lst-mas-alla-mentes-diminutas-t2', title: 'Mas allá de nuestras mentes diminutas', durationMs: 444000 },
      { number: 3, id: 'lst-mas-alla-mentes-diminutas-t3', title: 'Solución a un viejo problema', durationMs: 374000 },
      { number: 4, id: 'lst-mas-alla-mentes-diminutas-t4', title: 'Pasa un día', durationMs: 643000 },
    ],
  },
  {
    id: 'lst-elis-1980',
    title: 'Elis',
    artist: 'Elis Regina',
    artistId: '117940',
    year: 1980,
    aliases: ['Elis 1980'],
    // her 1980 EMI album, usually called "Elis 1980" to tell it from her other self-titled LPs —
    // Apple has the 1966/72/73/74/77 ones but not this.
    artworkUrl: 'https://coverartarchive.org/release-group/e3f00603-c147-3810-ae0d-29cb2cc60992/front-500',
    musicbrainzReleaseId: '9df66018-1b7a-41bf-9fc9-1df1d0db05ab',
    trackCount: 9,
    tracks: [
      { number: 1, id: 'lst-elis-1980-t1', title: 'Sai dessa', durationMs: 129000 },
      { number: 2, id: 'lst-elis-1980-t2', title: 'Rebento', durationMs: 312000 },
      { number: 3, id: 'lst-elis-1980-t3', title: 'Nova estação', durationMs: 202000 },
      { number: 4, id: 'lst-elis-1980-t4', title: 'O medo de amar é o medo de ser livre', durationMs: 263000 },
      { number: 5, id: 'lst-elis-1980-t5', title: 'Aprendendo a jogar', durationMs: 250000 },
      { number: 6, id: 'lst-elis-1980-t6', title: 'Só Deus é quem sabe', durationMs: 235000 },
      { number: 7, id: 'lst-elis-1980-t7', title: 'O trem azul', durationMs: 270000 },
      { number: 8, id: 'lst-elis-1980-t8', title: 'Vento de maio', durationMs: 249000 },
      { number: 9, id: 'lst-elis-1980-t9', title: 'Calcanhar de Aquiles', durationMs: 190000 },
    ],
  },
  {
    id: 'lst-imyra-tayra-ipy',
    title: 'Imyra, Tayra, Ipy',
    artist: 'Taiguara',
    artistId: '98230725',
    year: 1976,
    // pulled from shops by the censors soon after release; not on Apple Music or Deezer.
    // Cover from Discogs, hosted here — the Cover Art Archive has none.
    artworkUrl: `${PUBLIC_BASE_URL}/static/albums/imyra-tayra-ipy.jpg`,
    musicbrainzReleaseId: 'ea015e30-c1ff-4958-9008-a21db63c880f',
    trackCount: 14,
    tracks: [
      { number: 1, id: 'lst-imyra-tayra-ipy-t1', title: 'Pianice (Pecinha Sinfônica)', durationMs: 88000 },
      { number: 2, id: 'lst-imyra-tayra-ipy-t2', title: 'Delírio Transatlântico e Chegada no Rio', durationMs: 36000 },
      { number: 3, id: 'lst-imyra-tayra-ipy-t3', title: 'Público', durationMs: 294000 },
      { number: 4, id: 'lst-imyra-tayra-ipy-t4', title: 'Terra das Palmeiras', durationMs: 291000 },
      { number: 5, id: 'lst-imyra-tayra-ipy-t5', title: 'Como em Guernica', durationMs: 211000 },
      { number: 6, id: 'lst-imyra-tayra-ipy-t6', title: 'A Volta do Pássaro Ameríndio', durationMs: 258000 },
      { number: 7, id: 'lst-imyra-tayra-ipy-t7', title: 'Luanda, Violeta Africana', durationMs: 81000 },
      { number: 8, id: 'lst-imyra-tayra-ipy-t8', title: 'Aquarela de um País na Lua', durationMs: 220000 },
      { number: 9, id: 'lst-imyra-tayra-ipy-t9', title: 'Situação', durationMs: 232000 },
      { number: 10, id: 'lst-imyra-tayra-ipy-t10', title: 'Sete Cenas de Imyra', durationMs: 285000 },
      { number: 11, id: 'lst-imyra-tayra-ipy-t11', title: 'Três Pontas', durationMs: 222000 },
      { number: 12, id: 'lst-imyra-tayra-ipy-t12', title: 'Samba das Cinco', durationMs: 165000 },
      { number: 13, id: 'lst-imyra-tayra-ipy-t13', title: 'Primeira Bateria', durationMs: 168000 },
      { number: 14, id: 'lst-imyra-tayra-ipy-t14', title: 'Outra Cena', durationMs: 69000 },
    ],
  },
  {
    id: 'lst-ciclos-canarios',
    title: 'Ciclos',
    artist: 'Canarios',
    artistId: '313845296',
    year: 1974,
    aliases: ['Los Canarios'],
    // the Vivaldi Four Seasons rock opera, four side-long "transmigraciones". Credited as
    // Canarios on the record; often listed as Los Canarios, hence the alias.
    artworkUrl: 'https://coverartarchive.org/release-group/e3de6154-c60b-3ea7-9c59-903ce2d00bee/front-500',
    musicbrainzReleaseId: 'b19a9b07-0ac6-458a-81f8-695ef5d8d99a',
    trackCount: 4,
    tracks: [
      { number: 1, id: 'lst-ciclos-canarios-t1', title: 'Primera transmigración (El paraíso remoto)', durationMs: 1010000 },
      { number: 2, id: 'lst-ciclos-canarios-t2', title: 'Segunda transmigración (El abismo próximo)', durationMs: 1005000 },
      { number: 3, id: 'lst-ciclos-canarios-t3', title: 'Tercera transmigración (El entorno futuro)', durationMs: 1067000 },
      { number: 4, id: 'lst-ciclos-canarios-t4', title: 'Cuarta transmigración (El eslabón recobrado)', durationMs: 1313000 },
    ],
  },
  // ── Tatsuro Yamashita ──
  // He keeps nearly all of his catalogue off streaming; Apple has only Pacific
  // and a handful of later records (Ray of Hope and Softly pinned from jp in
  // index.js). The rest of his studio albums, from MusicBrainz: each the
  // original Japanese release, its first-release year, cover from the Cover
  // Art Archive.
  {
    id: 'lst-tatsuro-circus-town',
    title: 'CIRCUS TOWN',
    artist: 'Tatsuro Yamashita',
    artistId: '74493141',
    year: 1976,
    artworkUrl: 'https://coverartarchive.org/release-group/14f0ae76-256a-4c19-adae-245958d47f27/front-500',
    musicbrainzReleaseId: '463c077f-85eb-4787-a720-3498eb41ed3d',
    trackCount: 8,
    tracks: [
      { number: 1, id: 'lst-tatsuro-circus-town-t1', title: 'Circus Town', durationMs: 248000 },
      { number: 2, id: 'lst-tatsuro-circus-town-t2', title: 'Windy Lady', durationMs: 341000 },
      { number: 3, id: 'lst-tatsuro-circus-town-t3', title: 'Minnie', durationMs: 258000 },
      { number: 4, id: 'lst-tatsuro-circus-town-t4', title: '永遠に', durationMs: 296000 },
      { number: 5, id: 'lst-tatsuro-circus-town-t5', title: 'Last Step', durationMs: 206000 },
      { number: 6, id: 'lst-tatsuro-circus-town-t6', title: 'City Way', durationMs: 217000 },
      { number: 7, id: 'lst-tatsuro-circus-town-t7', title: '迷い込んだ街と', durationMs: 278000 },
      { number: 8, id: 'lst-tatsuro-circus-town-t8', title: '夏の陽', durationMs: 263000 },
    ],
  },
  {
    id: 'lst-tatsuro-spacy',
    title: 'SPACY',
    artist: 'Tatsuro Yamashita',
    artistId: '74493141',
    year: 1977,
    artworkUrl: 'https://coverartarchive.org/release-group/60412b41-65af-4aa8-8838-15c6b57c45fc/front-500',
    musicbrainzReleaseId: '772636ce-1274-4577-bdf7-a0d229168e24',
    trackCount: 10,
    tracks: [
      { number: 1, id: 'lst-tatsuro-spacy-t1', title: 'Love Space', durationMs: 287000 },
      { number: 2, id: 'lst-tatsuro-spacy-t2', title: '翼に乗せて', durationMs: 218000 },
      { number: 3, id: 'lst-tatsuro-spacy-t3', title: '素敵な午後は', durationMs: 234000 },
      { number: 4, id: 'lst-tatsuro-spacy-t4', title: 'Candy', durationMs: 194000 },
      { number: 5, id: 'lst-tatsuro-spacy-t5', title: 'Dancer', durationMs: 280000 },
      { number: 6, id: 'lst-tatsuro-spacy-t6', title: 'アンブレラ', durationMs: 240000 },
      { number: 7, id: 'lst-tatsuro-spacy-t7', title: '言えなかった言葉を', durationMs: 243000 },
      { number: 8, id: 'lst-tatsuro-spacy-t8', title: '朝の様な夕暮れ', durationMs: 134000 },
      { number: 9, id: 'lst-tatsuro-spacy-t9', title: 'きぬずれ', durationMs: 219000 },
      { number: 10, id: 'lst-tatsuro-spacy-t10', title: 'Solid Slider', durationMs: 426000 },
    ],
  },
  {
    id: 'lst-tatsuro-go-ahead',
    title: 'GO AHEAD!',
    artist: 'Tatsuro Yamashita',
    artistId: '74493141',
    year: 1978,
    // Timings from the 1985 CD; the 1978 LP has none on MusicBrainz.
    artworkUrl: 'https://coverartarchive.org/release-group/d8973c75-450b-4f47-8300-deec90f4bc6e/front-500',
    musicbrainzReleaseId: '8703c346-caca-48db-b967-f3c513c80e0b',
    trackCount: 10,
    tracks: [
      { number: 1, id: 'lst-tatsuro-go-ahead-t1', title: 'OVERTURE', durationMs: 48000 },
      { number: 2, id: 'lst-tatsuro-go-ahead-t2', title: 'LOVE CELEBRATION', durationMs: 266000 },
      { number: 3, id: 'lst-tatsuro-go-ahead-t3', title: 'LET’S DANCE BABY', durationMs: 254000 },
      { number: 4, id: 'lst-tatsuro-go-ahead-t4', title: 'MONDAY BLUE', durationMs: 433000 },
      { number: 5, id: 'lst-tatsuro-go-ahead-t5', title: 'ついておいで（FOLLOW ME ALONG）', durationMs: 289000 },
      { number: 6, id: 'lst-tatsuro-go-ahead-t6', title: 'BOMBER', durationMs: 359000 },
      { number: 7, id: 'lst-tatsuro-go-ahead-t7', title: '潮騒（THE WHISPERING SEA）', durationMs: 263000 },
      { number: 8, id: 'lst-tatsuro-go-ahead-t8', title: 'PAPER DOLL', durationMs: 207000 },
      { number: 9, id: 'lst-tatsuro-go-ahead-t9', title: 'THIS COULD BE THE NIGHT', durationMs: 237000 },
      { number: 10, id: 'lst-tatsuro-go-ahead-t10', title: '2000トンの雨（2000t OF RAIN）', durationMs: 185000 },
    ],
  },
  {
    id: 'lst-tatsuro-moonglow',
    title: 'MOONGLOW',
    artist: 'Tatsuro Yamashita',
    artistId: '74493141',
    year: 1979,
    // Timings from the 1984 CD; the 1979 LP has none on MusicBrainz.
    artworkUrl: 'https://coverartarchive.org/release-group/30992faa-082d-4e4b-b105-8f18f90c33e8/front-500',
    musicbrainzReleaseId: 'c7de7d62-29ab-4ff1-b308-df00a3d95db4',
    trackCount: 10,
    tracks: [
      { number: 1, id: 'lst-tatsuro-moonglow-t1', title: '夜の翼', durationMs: 90000 },
      { number: 2, id: 'lst-tatsuro-moonglow-t2', title: '永遠のFULL MOON', durationMs: 266533 },
      { number: 3, id: 'lst-tatsuro-moonglow-t3', title: 'RAINY WALK', durationMs: 309133 },
      { number: 4, id: 'lst-tatsuro-moonglow-t4', title: 'STORM', durationMs: 382840 },
      { number: 5, id: 'lst-tatsuro-moonglow-t5', title: 'FUNKY FLUSHIN\'', durationMs: 338493 },
      { number: 6, id: 'lst-tatsuro-moonglow-t6', title: 'HOT SHOT', durationMs: 353266 },
      { number: 7, id: 'lst-tatsuro-moonglow-t7', title: 'TOUCH ME LIGHTLY', durationMs: 264573 },
      { number: 8, id: 'lst-tatsuro-moonglow-t8', title: 'SUNSHINE−愛の金色−', durationMs: 260826 },
      { number: 9, id: 'lst-tatsuro-moonglow-t9', title: 'YELLOW CAB', durationMs: 289240 },
      { number: 10, id: 'lst-tatsuro-moonglow-t10', title: '愛を描いて -LET\'S KISS THE SUN-', durationMs: 238893 },
    ],
  },
  {
    id: 'lst-tatsuro-ride-on-time',
    title: 'RIDE ON TIME',
    artist: 'Tatsuro Yamashita',
    artistId: '74493141',
    year: 1980,
    artworkUrl: 'https://coverartarchive.org/release-group/74d1b9bc-552c-4b20-ac4d-7ecdb68ea9c3/front-500',
    musicbrainzReleaseId: '8a87b35b-25b3-48ab-8ddf-6bdf025388ee',
    trackCount: 9,
    tracks: [
      { number: 1, id: 'lst-tatsuro-ride-on-time-t1', title: 'いつか（SOMEDAY）', durationMs: 347000 },
      { number: 2, id: 'lst-tatsuro-ride-on-time-t2', title: 'DAYDREAM', durationMs: 268000 },
      { number: 3, id: 'lst-tatsuro-ride-on-time-t3', title: 'SILENT SCREAMER', durationMs: 328000 },
      { number: 4, id: 'lst-tatsuro-ride-on-time-t4', title: 'RIDE ON TIME（アルバム・ヴァージョン）', durationMs: 352000 },
      { number: 5, id: 'lst-tatsuro-ride-on-time-t5', title: '夏への扉（THE DOOR INTO SUMMER）', durationMs: 281000 },
      { number: 6, id: 'lst-tatsuro-ride-on-time-t6', title: 'MY SUGAR BABE', durationMs: 250000 },
      { number: 7, id: 'lst-tatsuro-ride-on-time-t7', title: 'RAINY DAY', durationMs: 319000 },
      { number: 8, id: 'lst-tatsuro-ride-on-time-t8', title: '雲のゆくえに（CLOUDS）', durationMs: 338000 },
      { number: 9, id: 'lst-tatsuro-ride-on-time-t9', title: 'おやすみ（KISSING GOODNIGHT）', durationMs: 94000 },
    ],
  },
  {
    id: 'lst-tatsuro-on-the-street-corner-1',
    title: 'ON THE STREET CORNER 1',
    artist: 'Tatsuro Yamashita',
    artistId: '74493141',
    year: 1980,
    aliases: ['On the Street Corner'],
    artworkUrl: 'https://coverartarchive.org/release-group/5703d2cb-7104-4f4e-8238-a84b9237df1e/front-500',
    musicbrainzReleaseId: 'c125e7bc-4b7e-4ffa-8b54-fdfbd483a962',
    trackCount: 10,
    tracks: [
      { number: 1, id: 'lst-tatsuro-on-the-street-corner-1-t1', title: 'YOU BELONG TO ME', durationMs: 179000 },
      { number: 2, id: 'lst-tatsuro-on-the-street-corner-1-t2', title: 'ALONE', durationMs: 167000 },
      { number: 3, id: 'lst-tatsuro-on-the-street-corner-1-t3', title: 'CLOSE YOUR EYES', durationMs: 153000 },
      { number: 4, id: 'lst-tatsuro-on-the-street-corner-1-t4', title: 'SPANISH HARLEM', durationMs: 217000 },
      { number: 5, id: 'lst-tatsuro-on-the-street-corner-1-t5', title: 'MOST OF ALL', durationMs: 203000 },
      { number: 6, id: 'lst-tatsuro-on-the-street-corner-1-t6', title: 'REMEMBER ME BABY', durationMs: 181000 },
      { number: 7, id: 'lst-tatsuro-on-the-street-corner-1-t7', title: 'BLUE VELVET', durationMs: 158000 },
      { number: 8, id: 'lst-tatsuro-on-the-street-corner-1-t8', title: 'THE WIND', durationMs: 134000 },
      { number: 9, id: 'lst-tatsuro-on-the-street-corner-1-t9', title: 'DRIP DROP', durationMs: 199000 },
      { number: 10, id: 'lst-tatsuro-on-the-street-corner-1-t10', title: 'THAT\'S MY DESIRE', durationMs: 228000 },
    ],
  },
  {
    id: 'lst-tatsuro-for-you',
    title: 'FOR YOU',
    artist: 'Tatsuro Yamashita',
    artistId: '74493141',
    year: 1982,
    artworkUrl: 'https://coverartarchive.org/release-group/1bc1ba12-6114-3ef9-89e6-3f4c8f5e0bb3/front-500',
    musicbrainzReleaseId: 'a2f8424d-552b-4d0d-ba5a-aa43fac1fbc7',
    trackCount: 12,
    tracks: [
      { number: 1, id: 'lst-tatsuro-for-you-t1', title: 'SPARKLE', durationMs: 253000 },
      { number: 2, id: 'lst-tatsuro-for-you-t2', title: 'MUSIC BOOK', durationMs: 308000 },
      { number: 3, id: 'lst-tatsuro-for-you-t3', title: 'INTERLUDE A part I', durationMs: 23000 },
      { number: 4, id: 'lst-tatsuro-for-you-t4', title: 'MORNING GLORY', durationMs: 208000 },
      { number: 5, id: 'lst-tatsuro-for-you-t5', title: 'INTERLUDE A part II', durationMs: 25000 },
      { number: 6, id: 'lst-tatsuro-for-you-t6', title: 'FUTARI', durationMs: 346000 },
      { number: 7, id: 'lst-tatsuro-for-you-t7', title: 'LOVELAND, ISLAND', durationMs: 269000 },
      { number: 8, id: 'lst-tatsuro-for-you-t8', title: 'INTERLUDE B part I', durationMs: 16000 },
      { number: 9, id: 'lst-tatsuro-for-you-t9', title: 'LOVE TALKIN’ (honey it’s you)', durationMs: 350000 },
      { number: 10, id: 'lst-tatsuro-for-you-t10', title: 'HEY REPORTER!', durationMs: 333000 },
      { number: 11, id: 'lst-tatsuro-for-you-t11', title: 'INTERLUDE B part II', durationMs: 17000 },
      { number: 12, id: 'lst-tatsuro-for-you-t12', title: 'YOUR EYES', durationMs: 194000 },
    ],
  },
  {
    id: 'lst-tatsuro-melodies',
    title: 'MELODIES',
    artist: 'Tatsuro Yamashita',
    artistId: '74493141',
    year: 1983,
    artworkUrl: 'https://coverartarchive.org/release-group/e8d2f9e5-9bfe-45e9-bb39-69009bd1ac34/front-500',
    musicbrainzReleaseId: '48ee13a1-bbf6-3084-a92a-e4dae7cde9d3',
    trackCount: 10,
    tracks: [
      { number: 1, id: 'lst-tatsuro-melodies-t1', title: '悲しみのJODY (She Was Crying)', durationMs: 232600 },
      { number: 2, id: 'lst-tatsuro-melodies-t2', title: '高気圧ガール', durationMs: 261800 },
      { number: 3, id: 'lst-tatsuro-melodies-t3', title: '夜翔 (Night‐Fly)', durationMs: 264893 },
      { number: 4, id: 'lst-tatsuro-melodies-t4', title: 'GUESS I’M DUMB', durationMs: 194240 },
      { number: 5, id: 'lst-tatsuro-melodies-t5', title: 'ひととき', durationMs: 242226 },
      { number: 6, id: 'lst-tatsuro-melodies-t6', title: 'メリー・ゴー・ラウンド', durationMs: 379840 },
      { number: 7, id: 'lst-tatsuro-melodies-t7', title: 'BLUE MIDNIGHT', durationMs: 256933 },
      { number: 8, id: 'lst-tatsuro-melodies-t8', title: 'あしおと', durationMs: 236066 },
      { number: 9, id: 'lst-tatsuro-melodies-t9', title: '黙想', durationMs: 92026 },
      { number: 10, id: 'lst-tatsuro-melodies-t10', title: 'クリスマス・イブ', durationMs: 255106 },
    ],
  },
  {
    id: 'lst-tatsuro-big-wave',
    title: 'Big Wave',
    artist: 'Tatsuro Yamashita',
    artistId: '74493141',
    year: 1984,
    artworkUrl: 'https://coverartarchive.org/release-group/646b0788-df08-4935-887c-edf5cb976840/front-500',
    musicbrainzReleaseId: '7ed8abbc-7fbc-47cc-a3eb-14f8c11fc69b',
    trackCount: 12,
    tracks: [
      { number: 1, id: 'lst-tatsuro-big-wave-t1', title: 'THE THEME FROM BIG WAVE', durationMs: 211000 },
      { number: 2, id: 'lst-tatsuro-big-wave-t2', title: 'JODY', durationMs: 229000 },
      { number: 3, id: 'lst-tatsuro-big-wave-t3', title: 'ONLY WITH YOU', durationMs: 221000 },
      { number: 4, id: 'lst-tatsuro-big-wave-t4', title: 'MAGIC WAYS', durationMs: 285000 },
      { number: 5, id: 'lst-tatsuro-big-wave-t5', title: 'YOUR EYES', durationMs: 192000 },
      { number: 6, id: 'lst-tatsuro-big-wave-t6', title: 'I LOVE YOU...PART II', durationMs: 122000 },
      { number: 7, id: 'lst-tatsuro-big-wave-t7', title: 'GIRLS ON THE BEACH', durationMs: 162000 },
      { number: 8, id: 'lst-tatsuro-big-wave-t8', title: 'PLEASE LET ME WONDER', durationMs: 184000 },
      { number: 9, id: 'lst-tatsuro-big-wave-t9', title: 'DARLIN\'', durationMs: 203000 },
      { number: 10, id: 'lst-tatsuro-big-wave-t10', title: 'GUESS I\'M DUMB', durationMs: 189000 },
      { number: 11, id: 'lst-tatsuro-big-wave-t11', title: 'THIS COULD BE THE NIGHT', durationMs: 240000 },
      { number: 12, id: 'lst-tatsuro-big-wave-t12', title: 'I LOVE YOU...PART I', durationMs: 122000 },
    ],
  },
  {
    id: 'lst-tatsuro-pocket-music',
    title: 'POCKET MUSIC',
    artist: 'Tatsuro Yamashita',
    artistId: '74493141',
    year: 1986,
    artworkUrl: 'https://coverartarchive.org/release-group/0ebb8c9d-ae7f-49da-8f8f-98e758bbec1d/front-500',
    musicbrainzReleaseId: 'f01c1e64-eed9-41cb-aacd-e66a0063fa01',
    trackCount: 10,
    tracks: [
      { number: 1, id: 'lst-tatsuro-pocket-music-t1', title: '土曜日の恋人', durationMs: 182000 },
      { number: 2, id: 'lst-tatsuro-pocket-music-t2', title: 'ポケット・ミュージック', durationMs: 323000 },
      { number: 3, id: 'lst-tatsuro-pocket-music-t3', title: 'MERMAID', durationMs: 270000 },
      { number: 4, id: 'lst-tatsuro-pocket-music-t4', title: '十字路', durationMs: 228000 },
      { number: 5, id: 'lst-tatsuro-pocket-music-t5', title: 'メロディー，君の為に', durationMs: 313000 },
      { number: 6, id: 'lst-tatsuro-pocket-music-t6', title: 'The War Song', durationMs: 306000 },
      { number: 7, id: 'lst-tatsuro-pocket-music-t7', title: 'シャンプー', durationMs: 254000 },
      { number: 8, id: 'lst-tatsuro-pocket-music-t8', title: 'ムーンライト', durationMs: 180719 },
      { number: 9, id: 'lst-tatsuro-pocket-music-t9', title: 'Lady Blue', durationMs: 245000 },
      { number: 10, id: 'lst-tatsuro-pocket-music-t10', title: '風の回廊', durationMs: 239000 },
    ],
  },
  {
    id: 'lst-tatsuro-on-the-street-corner-2',
    title: 'ON THE STREET CORNER 2',
    artist: 'Tatsuro Yamashita',
    artistId: '74493141',
    year: 1986,
    artworkUrl: 'https://coverartarchive.org/release-group/0cc37ab2-1a79-40de-8694-a5e639a05741/front-500',
    musicbrainzReleaseId: 'c7e63abe-c6c5-35dc-9219-40966573678b',
    trackCount: 10,
    tracks: [
      { number: 1, id: 'lst-tatsuro-on-the-street-corner-2-t1', title: 'AMAPOLA', durationMs: 206400 },
      { number: 2, id: 'lst-tatsuro-on-the-street-corner-2-t2', title: 'TEN COMMANDMENTS OF LOVE', durationMs: 219426 },
      { number: 3, id: 'lst-tatsuro-on-the-street-corner-2-t3', title: 'SO MUCH IN LOVE', durationMs: 147840 },
      { number: 4, id: 'lst-tatsuro-on-the-street-corner-2-t4', title: 'MAKE IT EASY ON YOURSELF', durationMs: 160333 },
      { number: 5, id: 'lst-tatsuro-on-the-street-corner-2-t5', title: 'MY MEMORIES OF YOU', durationMs: 198160 },
      { number: 6, id: 'lst-tatsuro-on-the-street-corner-2-t6', title: 'CHAPEL OF DREAMS', durationMs: 176840 },
      { number: 7, id: 'lst-tatsuro-on-the-street-corner-2-t7', title: 'YOU MAKE ME FEEL BRAND NEW', durationMs: 307493 },
      { number: 8, id: 'lst-tatsuro-on-the-street-corner-2-t8', title: 'I ONLY HAVE EYES FOR YOU', durationMs: 215000 },
      { number: 9, id: 'lst-tatsuro-on-the-street-corner-2-t9', title: 'SILENT NIGHT', durationMs: 70333 },
      { number: 10, id: 'lst-tatsuro-on-the-street-corner-2-t10', title: 'WHITE CHRISTMAS', durationMs: 146773 },
    ],
  },
  {
    id: 'lst-tatsuro-boku-no-naka-no-shonen',
    title: '僕の中の少年',
    artist: 'Tatsuro Yamashita',
    artistId: '74493141',
    year: 1988,
    aliases: ['Boku no Naka no Shonen', 'Boku no Naka no Shounen'],
    artworkUrl: 'https://coverartarchive.org/release-group/47f99156-d423-36a0-a6ea-3b0bf6e6d767/front-500',
    musicbrainzReleaseId: 'ca692abe-5175-468e-a89f-542da838283b',
    trackCount: 9,
    tracks: [
      { number: 1, id: 'lst-tatsuro-boku-no-naka-no-shonen-t1', title: '新・東京ラプソディー', durationMs: 261760 },
      { number: 2, id: 'lst-tatsuro-boku-no-naka-no-shonen-t2', title: 'ゲット・バック・イン・ラブ', durationMs: 262600 },
      { number: 3, id: 'lst-tatsuro-boku-no-naka-no-shonen-t3', title: 'ザ・ガール・イン・ホワイト', durationMs: 253133 },
      { number: 4, id: 'lst-tatsuro-boku-no-naka-no-shonen-t4', title: '寒い夏', durationMs: 213333 },
      { number: 5, id: 'lst-tatsuro-boku-no-naka-no-shonen-t5', title: '踊ろよ、フィッシュ', durationMs: 291573 },
      { number: 6, id: 'lst-tatsuro-boku-no-naka-no-shonen-t6', title: 'ルミネッセンス', durationMs: 342760 },
      { number: 7, id: 'lst-tatsuro-boku-no-naka-no-shonen-t7', title: 'マーマレイド・グッドバイ', durationMs: 280933 },
      { number: 8, id: 'lst-tatsuro-boku-no-naka-no-shonen-t8', title: '蒼氓', durationMs: 359133 },
      { number: 9, id: 'lst-tatsuro-boku-no-naka-no-shonen-t9', title: '僕の中の少年', durationMs: 293106 },
    ],
  },
  {
    id: 'lst-tatsuro-artisan',
    title: 'ARTISAN',
    artist: 'Tatsuro Yamashita',
    artistId: '74493141',
    year: 1991,
    artworkUrl: 'https://coverartarchive.org/release-group/574bfc9e-9efe-30f4-a1db-c74731ddba2f/front-500',
    musicbrainzReleaseId: 'f08e1899-1981-328f-8111-3d16546bb656',
    trackCount: 11,
    tracks: [
      { number: 1, id: 'lst-tatsuro-artisan-t1', title: 'アトムの子', durationMs: 266000 },
      { number: 2, id: 'lst-tatsuro-artisan-t2', title: 'さよなら夏の日', durationMs: 276000 },
      { number: 3, id: 'lst-tatsuro-artisan-t3', title: 'ターナーの汽罐車', durationMs: 274000 },
      { number: 4, id: 'lst-tatsuro-artisan-t4', title: '片想い', durationMs: 280000 },
      { number: 5, id: 'lst-tatsuro-artisan-t5', title: 'TOKYO\'S A LONELY TOWN', durationMs: 160000 },
      { number: 6, id: 'lst-tatsuro-artisan-t6', title: '飛遊人', durationMs: 109000 },
      { number: 7, id: 'lst-tatsuro-artisan-t7', title: 'スプレンダー', durationMs: 325000 },
      { number: 8, id: 'lst-tatsuro-artisan-t8', title: 'MIGHTY SMILE(魔法の微笑)', durationMs: 194000 },
      { number: 9, id: 'lst-tatsuro-artisan-t9', title: '"QUEEN OF HYPE" BLUES', durationMs: 315000 },
      { number: 10, id: 'lst-tatsuro-artisan-t10', title: 'エンドレス・ゲーム', durationMs: 250000 },
      { number: 11, id: 'lst-tatsuro-artisan-t11', title: 'GROOVIN\'', durationMs: 200000 },
    ],
  },
  {
    id: 'lst-tatsuro-seasons-greetings',
    title: 'Season\'s Greetings',
    artist: 'Tatsuro Yamashita',
    artistId: '74493141',
    year: 1993,
    artworkUrl: 'https://coverartarchive.org/release-group/562ab04d-7160-34b3-a026-7a330412fe54/front-500',
    musicbrainzReleaseId: 'f66aeced-fafd-4222-84cb-aecb9db6abde',
    trackCount: 15,
    tracks: [
      { number: 1, id: 'lst-tatsuro-seasons-greetings-t1', title: 'Acappella Variation On A Theme by Gluck', durationMs: 51160 },
      { number: 2, id: 'lst-tatsuro-seasons-greetings-t2', title: 'Bella Notte', durationMs: 231706 },
      { number: 3, id: 'lst-tatsuro-seasons-greetings-t3', title: 'Be My Love', durationMs: 221533 },
      { number: 4, id: 'lst-tatsuro-seasons-greetings-t4', title: 'Angels We Have Heard On High', durationMs: 61600 },
      { number: 5, id: 'lst-tatsuro-seasons-greetings-t5', title: 'Smoke Gets In Your Eyes', durationMs: 189933 },
      { number: 6, id: 'lst-tatsuro-seasons-greetings-t6', title: 'Silent Night', durationMs: 71000 },
      { number: 7, id: 'lst-tatsuro-seasons-greetings-t7', title: 'My Gift To You', durationMs: 246360 },
      { number: 8, id: 'lst-tatsuro-seasons-greetings-t8', title: 'It\'s All In The Game', durationMs: 204733 },
      { number: 9, id: 'lst-tatsuro-seasons-greetings-t9', title: 'Just A Lonely Christmas', durationMs: 146640 },
      { number: 10, id: 'lst-tatsuro-seasons-greetings-t10', title: 'Happy Holiday', durationMs: 141826 },
      { number: 11, id: 'lst-tatsuro-seasons-greetings-t11', title: 'Blue Christmas', durationMs: 168306 },
      { number: 12, id: 'lst-tatsuro-seasons-greetings-t12', title: 'White Christmas', durationMs: 144360 },
      { number: 13, id: 'lst-tatsuro-seasons-greetings-t13', title: 'Christmas Eve <English Version>', durationMs: 255466 },
      { number: 14, id: 'lst-tatsuro-seasons-greetings-t14', title: 'Have Yourself a Merry Little Christmas', durationMs: 169600 },
      { number: 15, id: 'lst-tatsuro-seasons-greetings-t15', title: 'O Come All Ye Faithful', durationMs: 53266 },
    ],
  },
  {
    id: 'lst-tatsuro-cozy',
    title: 'COZY',
    artist: 'Tatsuro Yamashita',
    artistId: '74493141',
    year: 1998,
    artworkUrl: 'https://coverartarchive.org/release-group/d9830dbe-9af6-399b-9c06-a6ed50d4a8b5/front-500',
    musicbrainzReleaseId: '99a56100-68b0-438d-b301-31cd813b35f0',
    trackCount: 15,
    tracks: [
      { number: 1, id: 'lst-tatsuro-cozy-t1', title: '氷のマニキュア', durationMs: 305160 },
      { number: 2, id: 'lst-tatsuro-cozy-t2', title: 'ヘロン', durationMs: 282840 },
      { number: 3, id: 'lst-tatsuro-cozy-t3', title: 'Fragile', durationMs: 328000 },
      { number: 4, id: 'lst-tatsuro-cozy-t4', title: 'Donut Song', durationMs: 262493 },
      { number: 5, id: 'lst-tatsuro-cozy-t5', title: '月の光', durationMs: 335000 },
      { number: 6, id: 'lst-tatsuro-cozy-t6', title: '群青の炎 -Ultramarine Fire-', durationMs: 303906 },
      { number: 7, id: 'lst-tatsuro-cozy-t7', title: 'Boomerang Baby', durationMs: 147426 },
      { number: 8, id: 'lst-tatsuro-cozy-t8', title: '夏のコラージュ', durationMs: 261506 },
      { number: 9, id: 'lst-tatsuro-cozy-t9', title: 'Lai-La -邂逅-', durationMs: 262333 },
      { number: 10, id: 'lst-tatsuro-cozy-t10', title: 'Stand in the Light -愛の灯- (\'98 Remix)', durationMs: 304626 },
      { number: 11, id: 'lst-tatsuro-cozy-t11', title: 'セールスマンズ・ロンリネス -Salesman\'s Loneliness-', durationMs: 327200 },
      { number: 12, id: 'lst-tatsuro-cozy-t12', title: 'Southbound #9', durationMs: 301666 },
      { number: 13, id: 'lst-tatsuro-cozy-t13', title: 'Dreaming Girl (\'98 Remix)', durationMs: 312466 },
      { number: 14, id: 'lst-tatsuro-cozy-t14', title: 'いつか晴れた日に (Album Remix)', durationMs: 298040 },
      { number: 15, id: 'lst-tatsuro-cozy-t15', title: 'Magic Touch (\'98 Version)', durationMs: 334333 },
    ],
  },
  {
    id: 'lst-tatsuro-on-the-street-corner-3',
    title: 'ON THE STREET CORNER 3',
    artist: 'Tatsuro Yamashita',
    artistId: '74493141',
    year: 1999,
    artworkUrl: 'https://coverartarchive.org/release-group/4c890317-4b72-4995-bcac-79513f762e38/front-500',
    musicbrainzReleaseId: '05e1fa51-2861-4bf7-9729-930a50cb564f',
    trackCount: 12,
    tracks: [
      { number: 1, id: 'lst-tatsuro-on-the-street-corner-3-t1', title: 'DEDICATED TO THE ONE I LOVE', durationMs: 144560 },
      { number: 2, id: 'lst-tatsuro-on-the-street-corner-3-t2', title: 'STAND BY ME', durationMs: 191933 },
      { number: 3, id: 'lst-tatsuro-on-the-street-corner-3-t3', title: 'GLORIA', durationMs: 165306 },
      { number: 4, id: 'lst-tatsuro-on-the-street-corner-3-t4', title: 'ANGEL', durationMs: 188533 },
      { number: 5, id: 'lst-tatsuro-on-the-street-corner-3-t5', title: 'DREAM GIRL', durationMs: 160000 },
      { number: 6, id: 'lst-tatsuro-on-the-street-corner-3-t6', title: 'THEIR HEARTS WERE FULL OF SPRING', durationMs: 149866 },
      { number: 7, id: 'lst-tatsuro-on-the-street-corner-3-t7', title: 'DON\'T ASK ME TO BE LONELY', durationMs: 144400 },
      { number: 8, id: 'lst-tatsuro-on-the-street-corner-3-t8', title: 'LOVE YOU SO', durationMs: 210466 },
      { number: 9, id: 'lst-tatsuro-on-the-street-corner-3-t9', title: 'LOVE T.K.O.', durationMs: 304533 },
      { number: 10, id: 'lst-tatsuro-on-the-street-corner-3-t10', title: 'WHY DO FOOLS FALL IN LOVE', durationMs: 111826 },
      { number: 11, id: 'lst-tatsuro-on-the-street-corner-3-t11', title: 'HEAVENLY FATHER', durationMs: 165440 },
      { number: 12, id: 'lst-tatsuro-on-the-street-corner-3-t12', title: 'LOVE CAN GO THE DISTANCE（Album Remix）', durationMs: 233626 },
    ],
  },
  {
    id: 'lst-tatsuro-sonorite',
    title: 'SONORITE',
    artist: 'Tatsuro Yamashita',
    artistId: '74493141',
    year: 2005,
    artworkUrl: 'https://coverartarchive.org/release-group/a8444fed-5285-4427-813c-f8d922228b6d/front-500',
    musicbrainzReleaseId: '35dd0a4e-56ee-42db-9ca1-2079ca489771',
    trackCount: 13,
    tracks: [
      { number: 1, id: 'lst-tatsuro-sonorite-t1', title: 'MIDAS TOUCH', durationMs: 311626 },
      { number: 2, id: 'lst-tatsuro-sonorite-t2', title: 'KISSからはじまるミステリー', durationMs: 360333 },
      { number: 3, id: 'lst-tatsuro-sonorite-t3', title: 'FOREVER MINE', durationMs: 293000 },
      { number: 4, id: 'lst-tatsuro-sonorite-t4', title: '忘れないで', durationMs: 260066 },
      { number: 5, id: 'lst-tatsuro-sonorite-t5', title: '風がくれたプロペラ', durationMs: 287333 },
      { number: 6, id: 'lst-tatsuro-sonorite-t6', title: 'ラッキー・ガールに花束を', durationMs: 261106 },
      { number: 7, id: 'lst-tatsuro-sonorite-t7', title: 'SECRET LOVER', durationMs: 308466 },
      { number: 8, id: 'lst-tatsuro-sonorite-t8', title: 'フェニックス (2005 REMIX)', durationMs: 299826 },
      { number: 9, id: 'lst-tatsuro-sonorite-t9', title: 'LIGHTNING BOY', durationMs: 360106 },
      { number: 10, id: 'lst-tatsuro-sonorite-t10', title: '白いアンブレラ', durationMs: 193893 },
      { number: 11, id: 'lst-tatsuro-sonorite-t11', title: '太陽のえくぼ (ALBUM REMIX)', durationMs: 357466 },
      { number: 12, id: 'lst-tatsuro-sonorite-t12', title: '2000トンの雨 (2000t of Rain) (2003 NEW VOCAL REMIX)', durationMs: 186600 },
      { number: 13, id: 'lst-tatsuro-sonorite-t13', title: 'WHEN YOU WISH UPON A STAR 〜星に願いを〜', durationMs: 235266 },
    ],
  },
  {
    id: 'lst-violon-passion',
    title: 'Violon Passion',
    artist: 'Various Artists',
    artistId: 'lst-artist-various-artists',
    year: 1993,
    isCompilation: true,
    // EMI Classics' 2-CD violin compilation (Kennedy, Menuhin, Mutter,
    // Milstein, Oistrakh…), issued in France and Canada in 1993 with one
    // tracklist; never on streaming. Tracks and timings from MusicBrainz's
    // Canadian release (the French one on Discogs has no timings), numbered
    // straight through both discs; covers match.
    artworkUrl: 'https://coverartarchive.org/release/021174b0-01c1-4c32-b35d-b6842d04e70c/front-500',
    musicbrainzReleaseId: '021174b0-01c1-4c32-b35d-b6842d04e70c',
    trackCount: 32,
    tracks: [
      { number: 1, id: 'lst-violon-passion-t1', title: 'Concerto en Mi Majeur "La Printemps" (extr. des "Quatre Saisons")', durationMs: 240000 },
      { number: 2, id: 'lst-violon-passion-t2', title: 'Concerto N° 3 en Sol Majeur, KV 216 - Rondo', durationMs: 381000 },
      { number: 3, id: 'lst-violon-passion-t3', title: 'Romance N° 1 pour violon et orchestre en Sol Majeur, Op. 40', durationMs: 433000 },
      { number: 4, id: 'lst-violon-passion-t4', title: 'Moto perpetuo', durationMs: 250000 },
      { number: 5, id: 'lst-violon-passion-t5', title: 'Méditation de Thaïs', durationMs: 301000 },
      { number: 6, id: 'lst-violon-passion-t6', title: 'Intermezzo (extr. de la "Symphonie Espagnole")', durationMs: 379000 },
      { number: 7, id: 'lst-violon-passion-t7', title: 'Légende pour violon et orchestre, Op. 17', durationMs: 410000 },
      { number: 8, id: 'lst-violon-passion-t8', title: 'Pas de deux (extr. du "Lac des Cygnes")', durationMs: 387000 },
      { number: 9, id: 'lst-violon-passion-t9', title: 'Airs Bohémiens, Op. 20', durationMs: 562000 },
      { number: 10, id: 'lst-violon-passion-t10', title: 'Introduction et rondo capriccioso, Op. 28', durationMs: 520000 },
      { number: 11, id: 'lst-violon-passion-t11', title: 'Tzigane', durationMs: 610000 },
      { number: 12, id: 'lst-violon-passion-t12', title: 'Partita N° 3, BWV 1006 - Préludio', durationMs: 212000 },
      { number: 13, id: 'lst-violon-passion-t13', title: 'Salut d\'amour, Op. 12', durationMs: 177000 },
      { number: 14, id: 'lst-violon-passion-t14', title: 'Nigun, improvisation (extr. de \'Baal Shem\')', durationMs: 353000 },
      { number: 15, id: 'lst-violon-passion-t15', title: 'La ronde des Lutins', durationMs: 313000 },
      { number: 16, id: 'lst-violon-passion-t16', title: 'Andante et variations pour violon et piano', durationMs: 200000 },
      { number: 17, id: 'lst-violon-passion-t17', title: 'Caprice n° 9 en mi majeur, Op. 1', durationMs: 158000 },
      { number: 18, id: 'lst-violon-passion-t18', title: 'Caprice n° 24 en la mineur, Op. 1', durationMs: 267000 },
      { number: 19, id: 'lst-violon-passion-t19', title: 'Etude-Caprice en la mineur, Op. 18 n° 4', durationMs: 84000 },
      { number: 20, id: 'lst-violon-passion-t20', title: 'Mouvement perpétuel', durationMs: 164000 },
      { number: 21, id: 'lst-violon-passion-t21', title: 'Poupée valsante', durationMs: 155000 },
      { number: 22, id: 'lst-violon-passion-t22', title: 'Praeludium et allegro dans le style de Pugnani', durationMs: 295000 },
      { number: 23, id: 'lst-violon-passion-t23', title: 'Tombourin de Jean-Marie Leclair', durationMs: 143000 },
      { number: 24, id: 'lst-violon-passion-t24', title: 'Romance andalouse, Op 22 n° 1', durationMs: 251000 },
      { number: 25, id: 'lst-violon-passion-t25', title: 'Chansons russes', durationMs: 363000 },
      { number: 26, id: 'lst-violon-passion-t26', title: 'Danse hongroise n° 2', durationMs: 189000 },
      { number: 27, id: 'lst-violon-passion-t27', title: 'Berceuse, Op 16', durationMs: 205000 },
      { number: 28, id: 'lst-violon-passion-t28', title: 'Valse-scherzo, Op. 34', durationMs: 327000 },
      { number: 29, id: 'lst-violon-passion-t29', title: 'Perpetuum mobile (extr. de la Sonate pour violon & piano)', durationMs: 236000 },
      { number: 30, id: 'lst-violon-passion-t30', title: 'La Fontaine D\'Aréthuse (extr. de \'Mythes\')', durationMs: 321000 },
      { number: 31, id: 'lst-violon-passion-t31', title: 'Cortège', durationMs: 93000 },
      { number: 32, id: 'lst-violon-passion-t32', title: 'Tea For Two (chanson de \'No No Nanette\')', durationMs: 219000 },
    ],
  },
  // ── Little Richard ──
  // Albums on no Apple storefront, from MusicBrainz: each the original
  // release, cover from the Cover Art Archive.
  {
    id: 'lst-little-richard-pray-along-vol-1',
    title: 'Pray Along With Little Richard Vol. 1: I’ll Never Walk Alone',
    artist: 'Little Richard',
    artistId: '1168275',
    year: 1960,
    artworkUrl: 'https://coverartarchive.org/release-group/8a77d0d0-124e-4221-9c48-6f05656950e1/front-500',
    musicbrainzReleaseId: '3f015b54-2f67-4909-acd5-af16751e23ee',
    trackCount: 10,
    tracks: [
      { number: 1, id: 'lst-little-richard-pray-along-vol-1-t1', title: 'Just a Closer Walk With Thee', durationMs: 169786 },
      { number: 2, id: 'lst-little-richard-pray-along-vol-1-t2', title: 'Milky White Way', durationMs: 200114 },
      { number: 3, id: 'lst-little-richard-pray-along-vol-1-t3', title: 'Does Jesus Care', durationMs: 197920 },
      { number: 4, id: 'lst-little-richard-pray-along-vol-1-t4', title: 'Jesus Walked This Lonesome Valley', durationMs: 189665 },
      { number: 5, id: 'lst-little-richard-pray-along-vol-1-t5', title: 'Coming Home', durationMs: 167879 },
      { number: 6, id: 'lst-little-richard-pray-along-vol-1-t6', title: 'I’ve Just Come From the Fountain', durationMs: 107144 },
      { number: 7, id: 'lst-little-richard-pray-along-vol-1-t7', title: 'I’m Trampin’', durationMs: 165188 },
      { number: 8, id: 'lst-little-richard-pray-along-vol-1-t8', title: 'Need Him', durationMs: 151344 },
      { number: 9, id: 'lst-little-richard-pray-along-vol-1-t9', title: 'God Is Real', durationMs: 181489 },
      { number: 10, id: 'lst-little-richard-pray-along-vol-1-t10', title: 'Precious Lord', durationMs: 187575 },
    ],
  },
  {
    id: 'lst-little-richard-pray-along-vol-2',
    title: 'Pray Along With Little Richard Vol. 2: I Believe...',
    artist: 'Little Richard',
    artistId: '1168275',
    year: 1960,
    artworkUrl: 'https://coverartarchive.org/release-group/50c3dfd0-8fae-490f-aec7-d276c3a57bd3/front-500',
    musicbrainzReleaseId: 'd42839ba-f2e4-4f2b-8b17-90e1d6ac60a0',
    trackCount: 10,
    tracks: [
      { number: 1, id: 'lst-little-richard-pray-along-vol-2-t1', title: 'Certainly Lord', durationMs: 119108 },
      { number: 2, id: 'lst-little-richard-pray-along-vol-2-t2', title: 'I Know the Lord', durationMs: 185120 },
      { number: 3, id: 'lst-little-richard-pray-along-vol-2-t3', title: 'I\'m Quittin\' Show Business (Part 1)', durationMs: 160878 },
      { number: 4, id: 'lst-little-richard-pray-along-vol-2-t4', title: 'I\'m Quittin\' Show Business (Part 2)', durationMs: 182377 },
      { number: 5, id: 'lst-little-richard-pray-along-vol-2-t5', title: 'Search Me Lord', durationMs: 133737 },
      { number: 6, id: 'lst-little-richard-pray-along-vol-2-t6', title: 'Lord, I Want to Be a Christian', durationMs: 252072 },
      { number: 7, id: 'lst-little-richard-pray-along-vol-2-t7', title: 'Troubles of the World', durationMs: 158397 },
      { number: 8, id: 'lst-little-richard-pray-along-vol-2-t8', title: 'Everytime I Feel the Spirit', durationMs: 124464 },
      { number: 9, id: 'lst-little-richard-pray-along-vol-2-t9', title: 'Tell God All My Troubles', durationMs: 214873 },
      { number: 10, id: 'lst-little-richard-pray-along-vol-2-t10', title: 'I Want Jesus to Walk With Me', durationMs: 181071 },
    ],
  },
  {
    id: 'lst-little-richard-gods-beautiful-city',
    title: 'God’s Beautiful City',
    artist: 'Little Richard',
    artistId: '1168275',
    year: 1979,
    artworkUrl: 'https://coverartarchive.org/release-group/455b20ad-af01-4db4-a496-399da1ccc0d0/front-500',
    musicbrainzReleaseId: '2de23b09-6f55-4984-b0a7-a1b1ebdc44e5',
    trackCount: 7,
    tracks: [
      { number: 1, id: 'lst-little-richard-gods-beautiful-city-t1', title: 'There Is Someone Worse Off Than I Am', durationMs: 325000 },
      { number: 2, id: 'lst-little-richard-gods-beautiful-city-t2', title: 'If You\'ve Got The Lord on Your Side Everything Will Be All Right', durationMs: 281000 },
      { number: 3, id: 'lst-little-richard-gods-beautiful-city-t3', title: 'It Is No Secret What God Can Do', durationMs: 273000 },
      { number: 4, id: 'lst-little-richard-gods-beautiful-city-t4', title: 'I Surrender All', durationMs: 235000 },
      { number: 5, id: 'lst-little-richard-gods-beautiful-city-t5', title: 'Little Richard\'s Testimony: What Am I Supposed to Do Without Jesus', durationMs: 650000 },
      { number: 6, id: 'lst-little-richard-gods-beautiful-city-t6', title: 'Little Richard\'s Testimony: Come by Here, My Lord', durationMs: 163000 },
      { number: 7, id: 'lst-little-richard-gods-beautiful-city-t7', title: 'God\'s Beautiful City', durationMs: 281000 },
    ],
  },
  {
    id: 'lst-little-richard-shake-it-all-about',
    title: 'Shake It All About',
    artist: 'Little Richard',
    artistId: '1168275',
    year: 1992,
    // A Disney children's album.
    artworkUrl: 'https://coverartarchive.org/release-group/815fcdcc-0ace-3a66-bcf7-086c71ec1065/front-500',
    musicbrainzReleaseId: '2258951b-50b9-4cb3-854c-485cc24b92a2',
    trackCount: 12,
    tracks: [
      { number: 1, id: 'lst-little-richard-shake-it-all-about-t1', title: 'The Hokey Pokey', durationMs: 169000 },
      { number: 2, id: 'lst-little-richard-shake-it-all-about-t2', title: 'On Top of Spaghetti', durationMs: 176000 },
      { number: 3, id: 'lst-little-richard-shake-it-all-about-t3', title: 'Old MacDonald', durationMs: 239000 },
      { number: 4, id: 'lst-little-richard-shake-it-all-about-t4', title: 'She’ll Be Comin’ Around the Mountain', durationMs: 158000 },
      { number: 5, id: 'lst-little-richard-shake-it-all-about-t5', title: 'Zip‐a‐Dee‐Doo‐Dah', durationMs: 186000 },
      { number: 6, id: 'lst-little-richard-shake-it-all-about-t6', title: 'Keep a Knockin’', durationMs: 182000 },
      { number: 7, id: 'lst-little-richard-shake-it-all-about-t7', title: 'Twinkle, Twinkle, Little Star', durationMs: 198000 },
      { number: 8, id: 'lst-little-richard-shake-it-all-about-t8', title: 'If You’re Happy and You Know It', durationMs: 219000 },
      { number: 9, id: 'lst-little-richard-shake-it-all-about-t9', title: 'When the Saints Go Marching In', durationMs: 221000 },
      { number: 10, id: 'lst-little-richard-shake-it-all-about-t10', title: 'He’s Got the Whole World in His Hands', durationMs: 133000 },
      { number: 11, id: 'lst-little-richard-shake-it-all-about-t11', title: 'Here We Go Loopty‐Loo', durationMs: 204000 },
      { number: 12, id: 'lst-little-richard-shake-it-all-about-t12', title: 'Oh Where, Oh Where Has My Little Dog Gone?', durationMs: 134000 },
    ],
  },
  {
    id: 'lst-little-richard-southern-child',
    title: 'Southern Child',
    artist: 'Little Richard',
    artistId: '1168275',
    year: 2020,
    // Recorded for Reprise in 1972 and shelved; first issued on its own by
    // Omnivore in 2020 (some tracks had surfaced in a 2004 box set).
    artworkUrl: 'https://coverartarchive.org/release-group/fddd841e-5284-4544-bf9c-db4866e547c2/front-500',
    musicbrainzReleaseId: '305dabb9-737c-47f7-bcfa-b1ac19d309ae',
    trackCount: 10,
    tracks: [
      { number: 1, id: 'lst-little-richard-southern-child-t1', title: 'California (I\'m Comin\')', durationMs: 196000 },
      { number: 2, id: 'lst-little-richard-southern-child-t2', title: 'If You Pick Her Too Hard (She Comes Out of Tune)', durationMs: 231000 },
      { number: 3, id: 'lst-little-richard-southern-child-t3', title: 'Burning Up With Love', durationMs: 200000 },
      { number: 4, id: 'lst-little-richard-southern-child-t4', title: 'Ain\'t No Tellin\'', durationMs: 353000 },
      { number: 5, id: 'lst-little-richard-southern-child-t5', title: 'Last Year\'s Race Horse (Can\'t Run in This Year\'s Race)', durationMs: 253000 },
      { number: 6, id: 'lst-little-richard-southern-child-t6', title: 'Southern Child', durationMs: 175000 },
      { number: 7, id: 'lst-little-richard-southern-child-t7', title: 'In the Name (version 3)', durationMs: 175000 },
      { number: 8, id: 'lst-little-richard-southern-child-t8', title: 'Over Yonder', durationMs: 234000 },
      { number: 9, id: 'lst-little-richard-southern-child-t9', title: 'I Git a Little Lonely', durationMs: 101000 },
      { number: 10, id: 'lst-little-richard-southern-child-t10', title: 'Puppy Dog Song', durationMs: 515000 },
    ],
  },
  {
    id: 'lst-entranas',
    title: 'Entrañas',
    artist: 'Arca',
    artistId: '948498542',
    year: 2016,
    isMixtape: true,
    // Her 2016 mixtape, a free SoundCloud release (one continuous 25:02 file)
    // with a 14-track download; never on streaming. Tracklist and features
    // from Arca's own SoundCloud description, matching MusicBrainz.
    // Only the total (25:02) and Sin Rumbo (3:34, MusicBrainz) are known;
    // the other timings are a fan YouTube split, scaled to fill the rest, so
    // they're approximate while the album length is exact.
    artworkUrl: 'https://coverartarchive.org/release/25bda7b5-27d5-4471-b3e6-2ae2e5a25f9a/front-500',
    musicbrainzReleaseId: '25bda7b5-27d5-4471-b3e6-2ae2e5a25f9a',
    trackCount: 14,
    tracks: [
      { number: 1, id: 'lst-entranas-t1', title: 'Pérdida', durationMs: 55255 },
      { number: 2, id: 'lst-entranas-t2', title: 'Torero', durationMs: 81041 },
      { number: 3, id: 'lst-entranas-t3', title: 'Culebra', durationMs: 83804 },
      { number: 4, id: 'lst-entranas-t4', title: 'Vicar', durationMs: 84725 },
      { number: 5, id: 'lst-entranas-t5', title: 'Cement Garden interlude', durationMs: 110511 },
      { number: 6, id: 'lst-entranas-t6', title: 'Baby Doll (feat. Mica Levi)', durationMs: 139060 },
      { number: 7, id: 'lst-entranas-t7', title: 'Lulled', durationMs: 102223 },
      { number: 8, id: 'lst-entranas-t8', title: 'Think of (feat. Mica Levi & Massacooramaan)', durationMs: 145506 },
      { number: 9, id: 'lst-entranas-t9', title: 'Clocked', durationMs: 37758 },
      { number: 10, id: 'lst-entranas-t10', title: 'Pargo', durationMs: 89330 },
      { number: 11, id: 'lst-entranas-t11', title: 'Turnt (feat. Total Freedom)', durationMs: 87488 },
      { number: 12, id: 'lst-entranas-t12', title: 'Girasol', durationMs: 134455 },
      { number: 13, id: 'lst-entranas-t13', title: 'Fount', durationMs: 137218 },
      { number: 14, id: 'lst-entranas-t14', title: 'Sin Rumbo', durationMs: 214000 },
    ],
  },
];

// ── Manually curated artists ──────────────────────────────────────────────────
// For the rare record whose artist isn't on Apple Music at all. Without an
// entry here, tapping the artist on the album page runs an Apple Music artist
// search by name and opens whoever ranks first — for In The Panchine that's
// Noyz Narcos, a guest on the record. With one, artist search returns this
// entry first and the artist page shows the albums below via their artistId.
const MANUAL_ARTISTS = [
  {
    // Constellation keeps the catalogue off Apple Music entirely (Bandcamp
    // only), so the band, not just one record, has to live here.
    id: 'lst-artist-godspeed-you-black-emperor',
    name: 'Godspeed You! Black Emperor',
    // What people actually type when they can't find them.
    aliases: ['GY!BE', 'GYBE'],
    genre: 'Rock',
    artworkUrl: 'https://coverartarchive.org/release-group/3822abb6-ca53-3ae1-a4ec-7718cb321e9b/front-500',
  },
  {
    // The 1978 band, absent from Apple Music. Several other Jesters are on it,
    // and without this entry the album page opens whichever ranks first.
    id: 'lst-artist-jester',
    name: 'Jester',
    genre: 'Rock',
    artworkUrl: `${PUBLIC_BASE_URL}/static/albums/jester.jpg`,
  },
  {
    // The 1970s French prog band. Apple's several Shylocks are all other acts.
    id: 'lst-artist-shylock',
    name: 'Shylock',
    genre: 'Rock',
    artworkUrl: 'https://coverartarchive.org/release-group/17f01921-089e-313d-8bb9-898d960b3163/front-500',
  },
  {
    // The 1970s Israeli prog band. Apple's Atmospheras are all other acts.
    id: 'lst-artist-atmosphera',
    name: 'Atmosphera',
    genre: 'Rock',
    artworkUrl: 'https://coverartarchive.org/release-group/cb7f74f4-a5af-436c-b1f8-d53ba154ef79/front-500',
  },
  {
    // For the multi-artist compilations carried here (Violon Passion), so the
    // album page's artist link has somewhere to go.
    id: 'lst-artist-various-artists',
    name: 'Various Artists',
    genre: 'Compilation',
    artworkUrl: 'https://coverartarchive.org/release/021174b0-01c1-4c32-b35d-b6842d04e70c/front-500',
  },
  {
    id: 'lst-artist-in-the-panchine',
    name: 'In The Panchine',
    genre: 'Hip-Hop/Rap',
    artworkUrl: 'https://coverartarchive.org/release-group/a68913ae-35d1-49fb-aecf-252e370cfc9a/front-500',
  },
  {
    // The 1970s Rome prog band. Apple's two Metamorfosis are newer, unrelated acts.
    id: 'lst-artist-metamorfosi',
    name: 'Metamorfosi',
    genre: 'Rock',
    artworkUrl: 'https://coverartarchive.org/release-group/0774ff04-5efe-353d-acaa-90ad9c957ed3/front-500',
  },
];

const byAlbumId = new Map(MANUAL_ALBUMS.map(a => [a.id, a]));
const byArtistId = new Map(MANUAL_ARTISTS.map(a => [a.id, a]));
const byTrackId = new Map(
  MANUAL_ALBUMS.flatMap(a => a.tracks.map(t => [t.id, { ...t, album: a }]))
);

const manualAlbumById = id => byAlbumId.get(id) ?? null;
const manualTrackById = id => byTrackId.get(id) ?? null;
const manualArtistById = id => byArtistId.get(id) ?? null;
const manualAlbumsByArtist = artistId =>
  MANUAL_ALBUMS.filter(a => a.artistId === artistId);

// Shape the artist discography endpoint expects. `runMs` is carried because
// these albums are never in Apple's catalog, so the discography's own run-time
// lookup (which asks Apple) can't resolve them — without it a six-track EP
// like Kid Galahad files as an album purely on track count.
const manualAlbumAsArtistItem = a => ({
  id: a.id,
  title: a.title,
  artworkUrl: a.artworkUrl,
  year: a.year,
  isSingle: false,
  isCompilation: a.isCompilation === true,
  isMixtape: a.isMixtape === true,
  isLive: a.isLive === true,
  trackCount: a.trackCount,
  runMs: a.tracks.reduce((ms, t) => ms + (t.durationMs ?? 0), 0),
  url: '',
  type: 'album',
});

module.exports = {
  MANUAL_ALBUMS,
  MANUAL_ARTISTS,
  manualArtistById,
  manualAlbumById,
  manualTrackById,
  manualAlbumsByArtist,
  manualAlbumAsArtistItem,
};
