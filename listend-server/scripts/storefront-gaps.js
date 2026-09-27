#!/usr/bin/env node
//
// Finds releases an artist has on Apple Music that the `us` storefront — the
// one every catalog lookup in index.js uses — doesn't carry, and prints the
// code to pin them.
//
// Italian bands keep turning this up (Fabri Fibra, Verdena), but it isn't an
// Italian problem: my bloody valentine and Jorge Ben Jor were the same shape.
// A user reports one missing album; usually several are missing.
//
//   node scripts/storefront-gaps.js "Verdena"
//   node scripts/storefront-gaps.js 24329193 --storefronts=it,gb
//   node scripts/storefront-gaps.js "Fabri Fibra" --include-variants
//
// Paste the three printed blocks into index.js (pinStorefront calls, an
// ARTIST_ALBUM_OVERRIDES entry, CANONICAL_ALBUM_OVERRIDES entries), deploy,
// then bust the artist's discography cache:
//   curl '<host>/catalog/artist/<id>/albums?bust=1'
//
// Uses the public iTunes API, so it needs no Apple Music key and runs locally.

const DEFAULT_STOREFRONTS = ['it', 'gb', 'ca', 'fr', 'de', 'jp', 'au', 'br', 'es', 'mx'];

// iTunes rate-limits aggressively; one request at a time, with a gap.
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function itunes(path, tries = 4) {
  for (let i = 0; i < tries; i++) {
    await sleep(1500);
    try {
      const resp = await fetch(`https://itunes.apple.com/${path}`);
      if (resp.ok) return await resp.json();
    } catch { /* retry */ }
  }
  return null;
}

const albumsFor = async (artistId, country) =>
  ((await itunes(`lookup?id=${artistId}&entity=album&limit=200&country=${country}`))?.results ?? []).slice(1);

// Mirrors normalizeKey/baseTitle in index.js closely enough to spot a title the
// `us` store already carries under a different edition name.
const TYPOGRAPHIC = /[\s'‘’‛`´"“”«»_.,;:!?()\[\]{}\/\\|@–—‑-]/g;
const normalizeKey = s => {
  const lowered = (s ?? '').toLowerCase();
  const folded  = lowered.replace(TYPOGRAPHIC, '');
  return folded.replace(/[^a-z0-9#+=×÷]/g, '') || folded || lowered.replace(/\s/g, '');
};
// Strips a parenthetical edition suffix — "(Deluxe)", "(20th Anniversary)" —
// but keeps an "- EP" / "- Single" tail, because those mark genuinely different
// releases: Fabri Fibra's Applausi Per Fibra exists as both, and only the EP is
// missing from us.
const baseTitle = t => normalizeKey((t ?? '').replace(/\s*[([].*[)\]]\s*$/, ''));

// A `us` edition carrying one of these while the missing release's title is
// clean means the store has only a reissue of the record — the case most worth
// pinning, since the discography's base-title dedup prefers the clean title and
// will put the original back in the reissue's place (Verdena's Il suicidio dei
// samurai, hidden behind its 2024 remaster; Fabri Fibra's Turbe giovanili).
const EDITION_QUALIFIERS = /\b(remaster(ed)?|anniversary|anniversario|reissue|edition|edizione|deluxe|expanded|versione)\b/i;

const artwork = r => (r.artworkUrl100 ?? '').replace('100x100bb', '500x500bb');
const esc = s => (s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const year = r => (r.releaseDate ?? '').slice(0, 4);

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter(a => a.startsWith('--')));
  const target = args.find(a => !a.startsWith('--'));
  if (!target) {
    console.error('usage: node scripts/storefront-gaps.js "<artist name>" | <artistId> [--storefronts=it,gb] [--include-variants]');
    process.exit(1);
  }
  const sfArg = args.find(a => a.startsWith('--storefronts='));
  const storefronts = sfArg ? sfArg.split('=')[1].split(',') : DEFAULT_STOREFRONTS;
  const includeVariants = flags.has('--include-variants');

  let artistId = /^\d+$/.test(target) ? target : null;
  let artistName = artistId ? null : target;
  if (!artistId) {
    for (const country of ['it', 'us', 'gb']) {
      const hit = ((await itunes(`search?term=${encodeURIComponent(target)}&entity=musicArtist&country=${country}&limit=5`))?.results ?? [])
        .find(a => a.artistName.toLowerCase() === target.toLowerCase());
      if (hit) { artistId = String(hit.artistId); artistName = hit.artistName; break; }
    }
  }
  if (!artistId) { console.error(`No Apple Music artist found for "${target}"`); process.exit(1); }

  const us = await albumsFor(artistId, 'us');
  if (us.length === 0) {
    console.error('Nothing on us for this artist — they may be absent from Apple Music entirely, which is a manualAlbums.js job, not a pin.');
  }
  artistName = artistName ?? us[0]?.artistName ?? String(artistId);
  const usIds        = new Set(us.map(r => r.collectionId));
  const usBaseTitles = new Set(us.map(r => baseTitle(r.collectionName)));
  console.log(`\n${artistName} (${artistId}) — ${us.length} releases on us\n`);

  // First storefront that carries a release wins, so each is pinned once.
  const missing = new Map();
  for (const country of storefronts) {
    for (const r of await albumsFor(artistId, country)) {
      if (usIds.has(r.collectionId) || missing.has(r.collectionId)) continue;
      missing.set(r.collectionId, { ...r, storefront: country });
    }
  }

  // Two pressings of one record (Fabri Fibra's Bugiardo is listed twice on it,
  // 18 and 19 tracks) would pin as two entries and the discography would show
  // the fuller one anyway — so pick that one here and say so.
  const byRecord = new Map();
  for (const r of missing.values()) {
    const key = `${baseTitle(r.collectionName)}::${year(r)}`;
    const rival = byRecord.get(key);
    if (!rival) { byRecord.set(key, r); continue; }
    const [win, lose] = (r.trackCount ?? 0) >= (rival.trackCount ?? 0) ? [r, rival] : [rival, r];
    console.log(`  · ${win.collectionName} (${year(win)}) is listed twice on ${win.storefront}: keeping the ${win.trackCount}-track pressing over the ${lose.trackCount}-track one`);
    byRecord.set(key, win);
  }

  const usEditionsByBase = new Map();
  for (const r of us) {
    const key = baseTitle(r.collectionName);
    if (!usEditionsByBase.has(key)) usEditionsByBase.set(key, []);
    usEditionsByBase.get(key).push(r.collectionName);
  }

  const keep = [], skipped = [], notes = new Map();
  for (const r of [...byRecord.values()].sort((a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''))) {
    // index.js drops singles before bucketing, by flag, track count or title —
    // a two-track "X / Y - Single" is still a single.
    if ((r.trackCount ?? 0) <= 1 || /-\s*single\b/i.test(r.collectionName)) {
      skipped.push([r, 'single — the discography filters these out']); continue;
    }
    const usEditions = usEditionsByBase.get(baseTitle(r.collectionName));
    if (usEditions) {
      // Only a reissue on us, and this one's title is clean → it IS the original.
      const onlyReissues = usEditions.every(t => EDITION_QUALIFIERS.test(t));
      if (onlyReissues && !EDITION_QUALIFIERS.test(r.collectionName)) {
        notes.set(r.collectionId, `the original — us carries only "${usEditions[0]}", which the dedup drops for this`);
        keep.push(r);
        continue;
      }
      if (!includeVariants) { skipped.push([r, `us already carries "${usEditions[0]}"`]); continue; }
    }
    keep.push(r);
  }

  const line = r => `${r.storefront}  ${year(r)}  ${String(r.trackCount).padStart(2)}tr  ${r.collectionName}  [${r.collectionId}]`;
  console.log(`Missing from us — ${keep.length} to pin:`);
  keep.forEach(r => {
    console.log('  ' + line(r));
    if (notes.has(r.collectionId)) console.log(`      ↳ ${notes.get(r.collectionId)}`);
  });
  if (skipped.length) {
    console.log(`\nSkipped (${skipped.length}) — pass --include-variants to keep the edition duplicates:`);
    skipped.forEach(([r, why]) => console.log(`  ${line(r)}\n      ↳ ${why}`));
  }
  if (keep.length === 0) { console.log('\nNothing to pin.\n'); return; }

  // Track ids have to be pinned too, or a tapped song resolves against us and fails.
  const withTracks = [];
  for (const r of keep) {
    const rows = (await itunes(`lookup?id=${r.collectionId}&entity=song&limit=200&country=${r.storefront}`))?.results ?? [];
    const trackIds = rows.slice(1).map(t => String(t.trackId));
    if (trackIds.length !== r.trackCount) {
      console.log(`  ! ${r.collectionName}: ${r.trackCount} tracks but ${trackIds.length} ids — the rest fall back to us`);
    }
    withTracks.push({ ...r, trackIds });
  }

  const chunk = ids => {
    const out = [];
    for (let i = 0; i < ids.length; i += 6) out.push('  ' + ids.slice(i, i + 6).map(id => `'${id}'`).join(', ') + ',');
    return out.join('\n');
  };

  console.log('\n\n──── 1. storefront pins → beside the other pinStorefront calls ────\n');
  for (const r of withTracks) {
    console.log(`// ${artistName} — ${r.collectionName} (${year(r)})`);
    console.log(`pinStorefront('${r.storefront}', [\n  '${r.collectionId}',\n${chunk(r.trackIds)}\n]);`);
  }

  console.log(`\n──── 2. ARTIST_ALBUM_OVERRIDES → so they show in the discography ────\n`);
  console.log(`  '${artistId}': [ // ${artistName} — not licensed for \`us\``);
  for (const r of withTracks) {
    console.log(`    {
      id: '${r.collectionId}', title: '${esc(r.collectionName)}',
      artworkUrl: '${artwork(r)}',
      year: ${year(r)}, isSingle: false, isCompilation: false, trackCount: ${r.trackCount},
      url: '${(r.collectionViewUrl ?? '').split('?')[0]}', type: 'album',
    },`);
  }
  console.log('  ],');

  console.log('\n──── 3. CANONICAL_ALBUM_OVERRIDES → so logging and search find them ────\n');
  for (const r of withTracks) {
    console.log(`  '${normalizeKey(artistName)}::${normalizeKey(r.collectionName)}': {
    id: '${r.collectionId}', title: '${esc(r.collectionName)}', artist: '${esc(artistName)}', year: ${year(r)},
    artworkUrl: '${artwork(r)}',
  },`);
  }
  console.log('');
}

main().catch(err => { console.error(err); process.exit(1); });
