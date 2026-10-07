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
    id: 'lst-artist-in-the-panchine',
    name: 'In The Panchine',
    genre: 'Hip-Hop/Rap',
    artworkUrl: 'https://coverartarchive.org/release-group/a68913ae-35d1-49fb-aecf-252e370cfc9a/front-500',
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
