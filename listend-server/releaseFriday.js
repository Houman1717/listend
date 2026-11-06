const supabase = require('./db');
const crypto = require('crypto');
const { sendPushes, fetchTokens, rpcAll } = require('./reengagement');

// Title test (from 2026-11-13): half get "New Music Friday: …", half
// "Out today: …". The group rides in the push's `reengage` value, which the
// app logs on tap as PostHog reengage_opened { kind }, so taps per group can
// be compared. Same person, same group every week (md5 of the user id), so
// each group's numbers stay comparable; set TITLE_TEST = false to stop it and
// everyone gets the winner in DEFAULT_PREFIX.
const TITLE_TEST = true;
const VARIANTS = {
  nmf: 'New Music Friday: ',
  out: 'Out today: ',
};
const DEFAULT_VARIANT = 'nmf';
function variantFor(userId) {
  if (!TITLE_TEST) return DEFAULT_VARIANT;
  const h = parseInt(crypto.createHash('md5').update(String(userId)).digest('hex').slice(0, 8), 16);
  return h % 2 === 0 ? 'nmf' : 'out';
}

// Release Friday: one push a week, Friday 12:00 London, listing the albums
// added to the curated New Releases list (new_release_albums) since last
// Friday. Each person sees artists they like named first. Tapping opens the
// New Releases list (route 'new-releases'; older bundles just open the app).
//
// Safety:
//  - "This week's" albums are the ones not in last Friday's snapshot
//    (release_fridays.album_ids). If the list wasn't updated, nothing is new
//    and nothing is sent: nobody gets last week's albums twice.
//  - release_fridays.sent_on is the primary key and is claimed BEFORE sending,
//    so a restart or a double cron can't send twice on the same day.
//  - Only people with "Listening reminders" and "Release Friday" both on
//    (supabase/add-release-friday.sql).
//  - Off unless RELEASE_FRIDAY_ENABLED=true in Railway (see index.js).

const FIRST_RUN_NEW = 20;   // no snapshot yet: treat the top of the list as new
const NAMES_SHOWN   = 3;

function londonDate(d = new Date()) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d);
}

async function loadWeek() {
  const { data: list, error } = await supabase
    .from('new_release_albums')
    .select('spotify_id, title, artist, position')
    .order('position', { ascending: true });
  if (error) throw new Error(`new_release_albums: ${error.message}`);

  const today = londonDate();
  const { data: last, error: lastErr } = await supabase
    .from('release_fridays')
    .select('sent_on, album_ids')
    .lt('sent_on', today)
    .order('sent_on', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastErr) throw new Error(`release_fridays: ${lastErr.message}`);

  const seen = new Set(last?.album_ids ?? []);
  const fresh = last
    ? (list ?? []).filter(a => !seen.has(a.spotify_id))
    : (list ?? []).slice(0, FIRST_RUN_NEW);
  return { today, list: list ?? [], fresh, lastSentOn: last?.sent_on ?? null };
}

/** "Drake, Fontaines D.C. and Taylor Swift" */
function joinNames(names) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// Most people only read the title, so it carries the biggest names. Lock
// screens cut a title off at roughly 40 characters: past this, name one.
const TITLE_MAX = 40;

/**
 * { title, body } for one person. Artists they like first (in list order),
 * then the top of the week's list. Title names one or two; the body names
 * the next two and counts the rest (albums, not artists).
 *   New Music Friday: Lil Baby and more
 *   Also new: Rex Orange County and Jack Harlow, plus 4 more. Be the first to rate them.
 */
function messageFor(fresh, likedLower, variant = DEFAULT_VARIANT) {
  const liked = new Set(likedLower);
  const artists = [];
  const seen = new Set();
  const add = a => { const k = a.toLowerCase(); if (!seen.has(k)) { seen.add(k); artists.push(a); } };
  fresh.filter(a => liked.has(a.artist.toLowerCase())).forEach(a => add(a.artist));
  fresh.forEach(a => add(a.artist));

  const rateIt = fresh.length === 1 ? 'Be the first to rate it.' : 'Be the first to rate them.';

  // "New Music Friday: A, B and more". Lock screens cut titles at ~40
  // characters, so fall back to one name, then drop "and more".
  const PREFIX = VARIANTS[variant] ?? VARIANTS[DEFAULT_VARIANT];
  const titleFor = (names, sayMore) => {
    const more = sayMore && artists.length > names.length ? ' and more' : '';
    if (names.length === 1) return `${PREFIX}${names[0]}${more}`;
    return more ? `${PREFIX}${names[0]}, ${names[1]}${more}` : `${PREFIX}${names[0]} and ${names[1]}`;
  };
  const tries = [[artists.slice(0, 2), true], [artists.slice(0, 1), true], [artists.slice(0, 1), false]];
  let [inTitle, sayMore] = tries.find(([n, m]) => titleFor(n, m).length <= TITLE_MAX) ?? tries[2];
  const title = titleFor(inTitle, sayMore);

  const inBody = artists.slice(inTitle.length, inTitle.length + NAMES_SHOWN - 1);
  const namedSet = new Set([...inTitle, ...inBody].map(n => n.toLowerCase()));
  const more = fresh.filter(a => !namedSet.has(a.artist.toLowerCase())).length;
  const body = inBody.length
    ? `Also new: ${joinNames(inBody)}${more > 0 ? `, plus ${more} more` : ''}. ${rateIt}`
    : `${more > 0 ? `Plus ${more} more. ` : ''}${rateIt}`;
  return { title, body };
}

/**
 * dryRun: who would get what, nothing sent or recorded.
 * userId: send to that one account only (testing); doesn't claim the week.
 */
// skip (with resend): leave out the first N people in the function's unsorted
// order. 2026-11-06 sends only reached the first 1,000 (row cap); skip:1000
// sends to the rest without repeating it for those.
async function runReleaseFriday({ dryRun = false, userId = null, resend = false, skip = 0 } = {}) {
  const { today, list, fresh, lastSentOn } = await loadWeek();
  // resend: today's send failed part-way (it has to be claimed already).
  // Sends to everyone again; there's no per-person record of who got it.
  if (resend) {
    const { data: claimed } = await supabase.from('release_fridays')
      .select('sent_on').eq('sent_on', today).maybeSingle();
    if (!claimed) return { skipped: `nothing was sent on ${today}, so nothing to resend` };
  }
  if (!fresh.length) {
    return { skipped: 'nothing new on the list since last Friday', lastSentOn };
  }

  const artistsLower = [...new Set(fresh.map(a => a.artist.toLowerCase()))];
  const targets = await rpcAll('release_friday_targets', {
    p_artists: artistsLower, p_only_user: userId,
  }, skip > 0 ? { start: skip } : { order: 'user_id' });

  const byUser = new Map((targets ?? []).map(t => {
    const variant = variantFor(t.user_id);
    return [t.user_id, { ...messageFor(fresh, t.liked ?? [], variant), variant }];
  }));
  const groups = {};
  for (const m of byUser.values()) groups[m.variant] = (groups[m.variant] ?? 0) + 1;
  const likedSomething = (targets ?? []).filter(t => (t.liked ?? []).length > 0).length;

  if (dryRun) {
    return {
      dryRun: true, today, lastSentOn,
      newAlbums: fresh.length,
      newPreview: fresh.slice(0, 8).map(a => `${a.artist} – ${a.title}`),
      recipients: byUser.size, withFavouriteArtist: likedSomething,
      groups,
      samples: [...new Map([...byUser.values()].map(m => [`${m.title} | ${m.body}`, `${m.title} | ${m.body}`])).values()].slice(0, 6),
    };
  }

  // Claim the day first so nothing can send twice. A one-account test
  // doesn't claim it (the real Friday send must still go out).
  if (!userId && !resend) {
    const { error: claimErr } = await supabase.from('release_fridays').insert({
      sent_on: today, album_ids: list.map(a => a.spotify_id), new_count: fresh.length,
    });
    if (claimErr) {
      if (claimErr.code === '23505') return { skipped: `already sent on ${today}` };
      throw new Error(`release_fridays claim: ${claimErr.message}`);
    }
  }

  const tokens = await fetchTokens([...byUser.keys()]);
  const messages = tokens.map(({ user_id, token }) => ({
    userId: user_id,
    token,
    payload: {
      to: token,
      title: byUser.get(user_id).title,
      body: byUser.get(user_id).body,
      // `reengage` + no `type`: older bundles just open the app on tap
      // instead of sending an unknown type to a blank profile.
      // release_friday_nmf / release_friday_out: the title group, for the test
      data: { reengage: `release_friday_${byUser.get(user_id).variant}`, route: 'new-releases' },
      sound: 'default',
    },
  }));

  const { delivered, dead } = await sendPushes(messages, 'release-friday');

  if (!userId) {
    let recipients = delivered.size;
    if (skip > 0) {
      const { data: row } = await supabase.from('release_fridays').select('recipients').eq('sent_on', today).maybeSingle();
      recipients += row?.recipients ?? 0;
    }
    const { error: upErr } = await supabase.from('release_fridays')
      .update({ recipients }).eq('sent_on', today);
    if (upErr) console.error('[release-friday] recipients update failed:', upErr.message);
  }

  const sentByGroup = {};
  for (const id of delivered) { const v = byUser.get(id)?.variant; if (v) sentByGroup[v] = (sentByGroup[v] ?? 0) + 1; }
  const result = { today, newAlbums: fresh.length, recipients: byUser.size, sentByGroup, sent: delivered.size, deadTokens: dead.length, test: !!userId, resend, skip };
  console.log('[release-friday]', JSON.stringify(result));
  return result;
}

module.exports = { runReleaseFriday, londonDate, messageFor, variantFor };
