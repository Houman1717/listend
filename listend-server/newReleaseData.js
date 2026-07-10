// Hardcoded, ordered "New Releases" list — replaces the old AM most-played
// chart, which lags actual release dates. Order is display order.
// Used by /api/admin/populate-new-releases to seed the new_release_albums table via AM search.

const NEW_RELEASE_ALBUMS = [
  { artist: 'Future',                 title: 'The Real Me' },
  { artist: 'Kelela',                 title: 'New Avatar' },
  { artist: 'Jack White',             title: 'Frozen Charlotte' },
  { artist: 'The Rolling Stones',     title: 'Foreign Tongues' },
  { artist: 'Madonna',                title: 'Confessions II' },
  { artist: 'Ken Carson',             title: 'Xperiment' },
  { artist: 'Mary in the Junkyard',   title: 'Role Model Hermit' },
  { artist: 'Slayyyter',              title: 'WORST GIRL IN AMERICA' },
  { artist: 'Olivia Rodrigo',         title: 'you seem pretty sad for a girl so in love' },
  { artist: 'Rick Ross',              title: 'Set In Stone' },
  { artist: 'Lizzo',                  title: 'Bitch' },
  { artist: 'Vince Staples',          title: 'Cry Baby' },
  { artist: 'Chris Brown',            title: 'BROWN' },
  { artist: 'Sabrina Carpenter',      title: 'Man\'s Best Friend' },
  { artist: 'Drake',                  title: 'Iceman' },
  { artist: 'Drake',                  title: 'Habibti' },
  { artist: 'Drake',                  title: 'Maid of Honour' },
  { artist: 'Don Toliver',            title: 'Octane' },
  { artist: 'A$AP Rocky',             title: 'Don\'t Be Dumb' },
  { artist: 'J. Cole',                title: 'The Fall-Off' },
  { artist: 'Harry Styles',           title: 'Kiss All the Time. Disco, Occasionally' },
  { artist: 'Bruno Mars',             title: 'The Romantic' },
  { artist: 'Robbie Williams',        title: 'Britpop' },
  { artist: 'Noah Kahan',             title: 'The Great Divide' },
  { artist: 'Morgan Wallen',          title: 'I\'m the Problem' },
  { artist: 'Bad Bunny',              title: 'Debí Tirar Más Fotos' },
  { artist: 'Zach Bryan',             title: 'With Heaven on Top' },
  { artist: 'Genesis Owusu',          title: 'Redstar Wu & the Worldwide Scourge' },
  { artist: 'BTS',                    title: 'Arirang' },
  { artist: 'JPEGMafia',              title: 'Experimental Rap' },
];

module.exports = { NEW_RELEASE_ALBUMS };
