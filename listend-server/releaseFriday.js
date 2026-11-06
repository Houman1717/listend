const supabase = require('./db');
const { sendPushes, fetchTokens } = require('./reengagement');

// Release Friday: one push a week, Friday 17:00 London, listing the albums
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
const TITLE         = 'Release Friday';

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

/** Artists they like first (in list order), then the top of the week's list. */
function bodyFor(fresh, likedLower) {
  const liked = new Set(likedLower);
  const artists = [];
  const seen = new Set();
  const add = a => { const k = a.toLowerCase(); if (!seen.has(k)) { seen.add(k); artists.push(a); } };
  fresh.filter(a => liked.has(a.artist.toLowerCase())).forEach(a => add(a.artist));
  fresh.forEach(a => add(a.artist));

  const named = artists.slice(0, NAMES_SHOWN);
  const namedSet = new Set(named.map(n => n.toLowerCase()));
  const more = fresh.filter(a => !namedSet.has(a.artist.toLowerCase())).length;
  return `New from ${joinNames(named)}${more > 0 ? `, plus ${more} more` : ''}. Tap to see what's out.`;
}

/**
 * dryRun: who would get what, nothing sent or recorded.
 * userId: send to that one account only (testing); doesn't claim the week.
 */
async function runReleaseFriday({ dryRun = false, userId = null } = {}) {
  const { today, list, fresh, lastSentOn } = await loadWeek();
  if (!fresh.length) {
    return { skipped: 'nothing new on the list since last Friday', lastSentOn };
  }

  const artistsLower = [...new Set(fresh.map(a => a.artist.toLowerCase()))];
  const { data: targets, error } = await supabase.rpc('release_friday_targets', {
    p_artists: artistsLower, p_only_user: userId,
  });
  if (error) throw new Error(`release_friday_targets: ${error.message}`);

  const byUser = new Map((targets ?? []).map(t => [t.user_id, bodyFor(fresh, t.liked ?? [])]));
  const likedSomething = (targets ?? []).filter(t => (t.liked ?? []).length > 0).length;

  if (dryRun) {
    return {
      dryRun: true, today, lastSentOn,
      newAlbums: fresh.length,
      newPreview: fresh.slice(0, 8).map(a => `${a.artist} – ${a.title}`),
      recipients: byUser.size, withFavouriteArtist: likedSomething,
      sampleBodies: [...new Set(byUser.values())].slice(0, 5),
    };
  }

  // Claim the day first so nothing can send twice. A one-account test
  // doesn't claim it (the real Friday send must still go out).
  if (!userId) {
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
      title: TITLE,
      body: byUser.get(user_id),
      // `reengage` + no `type`: older bundles just open the app on tap
      // instead of sending an unknown type to a blank profile.
      data: { reengage: 'release_friday', route: 'new-releases' },
      sound: 'default',
    },
  }));

  const { delivered, dead } = await sendPushes(messages, 'release-friday');

  if (!userId) {
    const { error: upErr } = await supabase.from('release_fridays')
      .update({ recipients: delivered.size }).eq('sent_on', today);
    if (upErr) console.error('[release-friday] recipients update failed:', upErr.message);
  }

  const result = { today, newAlbums: fresh.length, recipients: byUser.size, sent: delivered.size, deadTokens: dead.length, test: !!userId };
  console.log('[release-friday]', JSON.stringify(result));
  return result;
}

module.exports = { runReleaseFriday, londonDate };
