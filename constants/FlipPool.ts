// ─── Flip a Record — static album pool ───────────────────────────────────────
// Albums sourced from the genre & decade seed lists already in the app.
// artworkUrl is intentionally omitted; the flip card uses a colour placeholder.

export type FlipAlbum = {
  id: string;
  title: string;
  artist: string;
  year: number;
  coverColor: string;
};

export const FLIP_POOL: FlipAlbum[] = [
  // ── Rap ──────────────────────────────────────────────────────────────────
  { id: 'flip-damn',            title: 'DAMN.',                              artist: 'Kendrick Lamar',       year: 2017, coverColor: '#8b1a1a' },
  { id: 'flip-take-care',       title: 'Take Care',                          artist: 'Drake',                year: 2011, coverColor: '#1e3a5f' },
  { id: 'flip-tpab',            title: 'To Pimp a Butterfly',                artist: 'Kendrick Lamar',       year: 2015, coverColor: '#2d5a27' },
  { id: 'flip-astroworld',      title: 'ASTROWORLD',                         artist: 'Travis Scott',         year: 2018, coverColor: '#7a4a2e' },
  { id: 'flip-2014-fhd',        title: '2014 Forest Hills Drive',            artist: 'J. Cole',              year: 2014, coverColor: '#3a5a2a' },
  { id: 'flip-mbdtf',           title: 'My Beautiful Dark Twisted Fantasy',  artist: 'Kanye West',           year: 2010, coverColor: '#5c2d82' },
  { id: 'flip-blueprint',       title: 'The Blueprint',                      artist: 'JAY-Z',                year: 2001, coverColor: '#1a5a5a' },
  { id: 'flip-illmatic',        title: 'Illmatic',                           artist: 'Nas',                  year: 1994, coverColor: '#4a2d7a' },
  { id: 'flip-gkmc',            title: 'good kid, m.A.A.d city',             artist: 'Kendrick Lamar',       year: 2012, coverColor: '#2a4a5a' },
  { id: 'flip-mmlp',            title: 'The Marshall Mathers LP',            artist: 'Eminem',               year: 2000, coverColor: '#5a2a2a' },
  { id: 'flip-college-dropout', title: 'The College Dropout',                artist: 'Kanye West',           year: 2004, coverColor: '#d4a017' },
  { id: 'flip-late-reg',        title: 'Late Registration',                  artist: 'Kanye West',           year: 2005, coverColor: '#7a5a17' },
  { id: 'flip-stankonia',       title: 'Stankonia',                          artist: 'OutKast',              year: 2000, coverColor: '#1a3a5a' },
  { id: 'flip-speakerboxxx',    title: 'Speakerboxxx / The Love Below',      artist: 'OutKast',              year: 2003, coverColor: '#5a3a1a' },
  { id: 'flip-chronic',         title: 'The Chronic',                        artist: 'Dr. Dre',              year: 1992, coverColor: '#2d5a27' },
  { id: 'flip-ready-to-die',    title: 'Ready to Die',                       artist: 'The Notorious B.I.G.', year: 1994, coverColor: '#3a1a1a' },
  { id: 'flip-reasonable-doubt',title: 'Reasonable Doubt',                   artist: 'JAY-Z',                year: 1996, coverColor: '#1a2a3a' },
  { id: 'flip-mrmorale',        title: 'Mr. Morale & the Big Steppers',      artist: 'Kendrick Lamar',       year: 2022, coverColor: '#4a3a2a' },

  // ── R&B ──────────────────────────────────────────────────────────────────
  { id: 'flip-after-hours',     title: 'After Hours',                        artist: 'The Weeknd',           year: 2020, coverColor: '#8b1a1a' },
  { id: 'flip-sos',             title: 'SOS',                                artist: 'SZA',                  year: 2022, coverColor: '#1e3a5f' },
  { id: 'flip-lemonade',        title: 'Lemonade',                           artist: 'Beyoncé',              year: 2016, coverColor: '#d4a017' },
  { id: 'flip-channel-orange',  title: 'channel ORANGE',                     artist: 'Frank Ocean',          year: 2012, coverColor: '#c46a00' },
  { id: 'flip-starboy',         title: 'Starboy',                            artist: 'The Weeknd',           year: 2016, coverColor: '#3a1a5a' },
  { id: 'flip-still-over-it',   title: 'Still Over It',                      artist: 'Summer Walker',        year: 2021, coverColor: '#5a2a4a' },
  { id: 'flip-wasteland',       title: 'WASTELAND',                          artist: 'Brent Faiyaz',         year: 2022, coverColor: '#2a2a3a' },
  { id: 'flip-freudian',        title: 'Freudian',                           artist: 'Daniel Caesar',        year: 2017, coverColor: '#3a4a2a' },
  { id: 'flip-seat-at-table',   title: 'A Seat at the Table',                artist: 'Solange',              year: 2016, coverColor: '#4a3a5a' },
  { id: 'flip-get-lifted',      title: 'Get Lifted',                         artist: 'John Legend',          year: 2004, coverColor: '#2a3a4a' },

  // ── Pop ──────────────────────────────────────────────────────────────────
  { id: 'flip-folklore',        title: 'folklore',                           artist: 'Taylor Swift',         year: 2020, coverColor: '#4a4a4a' },
  { id: 'flip-midnights',       title: 'Midnights',                          artist: 'Taylor Swift',         year: 2022, coverColor: '#1a2a4a' },
  { id: 'flip-future-nostalgia',title: 'Future Nostalgia',                   artist: 'Dua Lipa',             year: 2020, coverColor: '#c41a7a' },
  { id: 'flip-harrys-house',    title: "Harry's House",                      artist: 'Harry Styles',         year: 2022, coverColor: '#4a7a2a' },
  { id: 'flip-sour',            title: 'SOUR',                               artist: 'Olivia Rodrigo',       year: 2021, coverColor: '#5a2a7a' },
  { id: 'flip-30',              title: '30',                                 artist: 'Adele',                year: 2021, coverColor: '#3a3a5a' },
  { id: 'flip-thank-u-next',    title: 'thank u, next',                      artist: 'Ariana Grande',        year: 2019, coverColor: '#5a3a4a' },
  { id: 'flip-hollywood-bleed', title: "Hollywood's Bleeding",               artist: 'Post Malone',          year: 2019, coverColor: '#2a1a3a' },
  { id: 'flip-1989',            title: '1989',                               artist: 'Taylor Swift',         year: 2014, coverColor: '#5a6a7a' },
  { id: 'flip-wwafawdwgo',      title: 'When We All Fall Asleep, Where Do We Go?', artist: 'Billie Eilish', year: 2019, coverColor: '#1a3a1a' },

  // ── Rock ─────────────────────────────────────────────────────────────────
  { id: 'flip-am',              title: 'AM',                                 artist: 'Arctic Monkeys',       year: 2013, coverColor: '#1a1a1a' },
  { id: 'flip-ok-computer',     title: 'OK Computer',                        artist: 'Radiohead',            year: 1997, coverColor: '#2a3a5a' },
  { id: 'flip-is-this-it',      title: 'Is This It',                         artist: 'The Strokes',          year: 2001, coverColor: '#4a3a2a' },
  { id: 'flip-currents',        title: 'Currents',                           artist: 'Tame Impala',          year: 2015, coverColor: '#1a4a5a' },
  { id: 'flip-el-camino',       title: 'El Camino',                          artist: 'The Black Keys',       year: 2011, coverColor: '#3a2a1a' },
  { id: 'flip-origin-symmetry', title: 'Origin of Symmetry',                 artist: 'Muse',                 year: 2001, coverColor: '#2a1a4a' },
  { id: 'flip-stadium-arc',     title: 'Stadium Arcadium',                   artist: 'Red Hot Chili Peppers',year: 2006, coverColor: '#4a1a2a' },
  { id: 'flip-nevermind',       title: 'Nevermind',                          artist: 'Nirvana',              year: 1991, coverColor: '#1a4a7a' },
  { id: 'flip-ten',             title: 'Ten',                                artist: 'Pearl Jam',            year: 1991, coverColor: '#3a2a3a' },
  { id: 'flip-achtung-baby',    title: 'Achtung Baby',                       artist: 'U2',                   year: 1991, coverColor: '#2a1a2a' },
  { id: 'flip-jagged-little',   title: 'Jagged Little Pill',                 artist: 'Alanis Morissette',    year: 1995, coverColor: '#5a4a1a' },
  { id: 'flip-funeral',         title: 'Funeral',                            artist: 'Arcade Fire',          year: 2004, coverColor: '#3a1a2a' },
  { id: 'flip-elephant',        title: 'Elephant',                           artist: 'The White Stripes',    year: 2003, coverColor: '#6a1a1a' },

  // ── House / Electronic ────────────────────────────────────────────────────
  { id: 'flip-ram',             title: 'Random Access Memories',             artist: 'Daft Punk',            year: 2013, coverColor: '#7a5a17' },
  { id: 'flip-discovery',       title: 'Discovery',                          artist: 'Daft Punk',            year: 2001, coverColor: '#5a4a2a' },
  { id: 'flip-settle',          title: 'Settle',                             artist: 'Disclosure',           year: 2013, coverColor: '#1a5a4a' },
  { id: 'flip-in-colour',       title: 'In Colour',                          artist: 'Jamie xx',             year: 2015, coverColor: '#2a4a5a' },
  { id: 'flip-black-sands',     title: 'Black Sands',                        artist: 'Bonobo',               year: 2010, coverColor: '#1a2a3a' },

  // ── Jazz ─────────────────────────────────────────────────────────────────
  { id: 'flip-kind-of-blue',    title: 'Kind of Blue',                       artist: 'Miles Davis',          year: 1959, coverColor: '#1e3a5f' },
  { id: 'flip-love-supreme',    title: 'A Love Supreme',                     artist: 'John Coltrane',        year: 1965, coverColor: '#3a2a5a' },
  { id: 'flip-time-out',        title: 'Time Out',                           artist: 'Dave Brubeck Quartet', year: 1959, coverColor: '#2a3a4a' },
  { id: 'flip-head-hunters',    title: 'Head Hunters',                       artist: 'Herbie Hancock',       year: 1973, coverColor: '#4a3a1a' },
  { id: 'flip-waltz-debby',     title: 'Waltz for Debby',                    artist: 'Bill Evans Trio',      year: 1961, coverColor: '#3a4a3a' },

  // ── Soul ─────────────────────────────────────────────────────────────────
  { id: 'flip-whats-going-on',  title: "What's Going On",                    artist: 'Marvin Gaye',          year: 1971, coverColor: '#2d5a27' },
  { id: 'flip-back-to-black',   title: 'Back to Black',                      artist: 'Amy Winehouse',        year: 2006, coverColor: '#3a1a1a' },
  { id: 'flip-miseducation',    title: 'The Miseducation of Lauryn Hill',    artist: 'Lauryn Hill',          year: 1998, coverColor: '#5a3a17' },
  { id: 'flip-songs-key-life',  title: 'Songs in the Key of Life',           artist: 'Stevie Wonder',        year: 1976, coverColor: '#7a4a2e' },
  { id: 'flip-voodoo',          title: 'Voodoo',                             artist: "D'Angelo",             year: 2000, coverColor: '#4a1a3a' },
  { id: 'flip-baduizm',         title: 'Baduizm',                            artist: 'Erykah Badu',          year: 1997, coverColor: '#3a5a3a' },

  // ── All-Time Classics ────────────────────────────────────────────────────
  { id: 'flip-revolver',        title: 'Revolver',                           artist: 'The Beatles',          year: 1966, coverColor: '#2a2a2a' },
  { id: 'flip-pet-sounds',      title: 'Pet Sounds',                         artist: 'The Beach Boys',       year: 1966, coverColor: '#3a5a7a' },
  { id: 'flip-highway-61',      title: 'Highway 61 Revisited',               artist: 'Bob Dylan',            year: 1965, coverColor: '#5a4a2a' },
  { id: 'flip-sgt-pepper',      title: "Sgt. Pepper's Lonely Hearts Club Band", artist: 'The Beatles',       year: 1967, coverColor: '#d41a4a' },
  { id: 'flip-velvets',         title: 'The Velvet Underground & Nico',      artist: 'The Velvet Underground', year: 1967, coverColor: '#f0f0f0' },
  { id: 'flip-abbey-road',      title: 'Abbey Road',                         artist: 'The Beatles',          year: 1969, coverColor: '#2a4a2a' },
  { id: 'flip-dark-side',       title: 'The Dark Side of the Moon',          artist: 'Pink Floyd',           year: 1973, coverColor: '#1a1a2a' },
  { id: 'flip-rumours',         title: 'Rumours',                            artist: 'Fleetwood Mac',         year: 1977, coverColor: '#5a4a5a' },
  { id: 'flip-led-zep-iv',      title: 'Led Zeppelin IV',                   artist: 'Led Zeppelin',         year: 1971, coverColor: '#3a2a1a' },
  { id: 'flip-born-to-run',     title: 'Born to Run',                        artist: 'Bruce Springsteen',    year: 1975, coverColor: '#4a3a2a' },
  { id: 'flip-hotel-california',title: 'Hotel California',                   artist: 'Eagles',               year: 1977, coverColor: '#5a3a1a' },
  { id: 'flip-london-calling',  title: 'London Calling',                     artist: 'The Clash',            year: 1979, coverColor: '#1a1a1a' },
  { id: 'flip-thriller',        title: 'Thriller',                           artist: 'Michael Jackson',      year: 1982, coverColor: '#2a1a3a' },
  { id: 'flip-purple-rain',     title: 'Purple Rain',                        artist: 'Prince',               year: 1984, coverColor: '#3a1a5a' },
  { id: 'flip-joshua-tree',     title: 'The Joshua Tree',                    artist: 'U2',                   year: 1987, coverColor: '#5a4a17' },
  { id: 'flip-appetite',        title: 'Appetite for Destruction',           artist: "Guns N' Roses",        year: 1987, coverColor: '#7a2a1a' },
  { id: 'flip-back-in-black',   title: 'Back in Black',                      artist: 'AC/DC',                year: 1980, coverColor: '#0a0a0a' },
  { id: 'flip-sign-o-times',    title: "Sign 'O' the Times",                 artist: 'Prince',               year: 1987, coverColor: '#4a1a4a' },

  // ── Country ──────────────────────────────────────────────────────────────
  { id: 'flip-golden-hour',     title: 'Golden Hour',                        artist: 'Kacey Musgraves',      year: 2018, coverColor: '#d4a017' },
  { id: 'flip-am-heartbreak',   title: 'American Heartbreak',                artist: 'Zach Bryan',           year: 2022, coverColor: '#7a5a17' },

  // ── Latin ─────────────────────────────────────────────────────────────────
  { id: 'flip-un-verano',       title: 'Un Verano Sin Ti',                   artist: 'Bad Bunny',            year: 2022, coverColor: '#1a5a3a' },
];
