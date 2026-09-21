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
];

// ── Manually curated artists ──────────────────────────────────────────────────
// For the rare record whose artist isn't on Apple Music at all. Without an
// entry here, tapping the artist on the album page runs an Apple Music artist
// search by name and opens whoever ranks first — for In The Panchine that's
// Noyz Narcos, a guest on the record. With one, artist search returns this
// entry first and the artist page shows the albums below via their artistId.
const MANUAL_ARTISTS = [
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
  isCompilation: false,
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
