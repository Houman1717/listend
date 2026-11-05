const supabase = require('./db');

// "Come back" pushes for quiet accounts. Who gets one, and which message, is
// decided in Postgres by reengagement_candidates() (supabase/
// add-growth-follows-reengagement.sql): nothing logged for 7 days, no such push
// in 7 days, at most 4 since they were last active, reminders switched on.
// This module only sends what that returns and records it.
//
// The daily cron only runs when REENGAGEMENT_ENABLED=true, so the first send
// is a deliberate switch-on after a dry run, not a side effect of a deploy.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH    = 100;   // Expo's per-request message limit
const DAILY_LIMIT   = Number(process.env.REENGAGEMENT_DAILY_LIMIT) || 1500;

let running = false;

async function fetchCandidates({ limit = DAILY_LIMIT, userId = null, ignoreCaps = false } = {}) {
  const { data, error } = await supabase.rpc('reengagement_candidates', {
    p_limit: limit,
    p_only_user: userId,
    p_ignore_caps: ignoreCaps,
  });
  if (error) throw new Error(`reengagement_candidates: ${error.message}`);
  return data ?? [];
}

async function fetchTokens(userIds) {
  const tokens = [];
  for (let i = 0; i < userIds.length; i += 500) {
    const { data, error } = await supabase
      .from('push_tokens')
      .select('user_id, token')
      .in('user_id', userIds.slice(i, i + 500));
    if (error) throw new Error(`push_tokens: ${error.message}`);
    tokens.push(...(data ?? []));
  }
  return tokens;
}

/**
 * Send one batch to Expo. Returns the user_ids that got at least one accepted
 * ticket, and the tokens Expo says are dead (app uninstalled / token rotated).
 */
async function sendBatch(messages) {
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(messages.map(m => m.payload)),
  });
  const json = await res.json().catch(() => null);
  const tickets = Array.isArray(json?.data) ? json.data : [];
  const delivered = new Set();
  const dead = [];
  messages.forEach((m, i) => {
    const t = tickets[i];
    if (t?.status === 'ok') delivered.add(m.userId);
    else if (t?.details?.error === 'DeviceNotRegistered') dead.push(m.token);
  });
  if (!res.ok) console.error('[reengagement] Expo HTTP', res.status, JSON.stringify(json)?.slice(0, 300));
  return { delivered, dead };
}

/**
 * Run one pass. dryRun returns who would get what without sending or
 * recording anything. userId + ignoreCaps targets one account (testing).
 */
async function runReengagement({ dryRun = false, limit = DAILY_LIMIT, userId = null, ignoreCaps = false } = {}) {
  if (running) return { skipped: 'already running' };
  running = true;
  try {
    const candidates = await fetchCandidates({ limit, userId, ignoreCaps });
    const byKind = {};
    for (const c of candidates) byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;

    if (dryRun) {
      return { dryRun: true, count: candidates.length, byKind, sample: candidates.slice(0, 5) };
    }
    if (!candidates.length) return { sent: 0, byKind };

    const byUser = new Map(candidates.map(c => [c.user_id, c]));
    const tokens = await fetchTokens([...byUser.keys()]);
    const messages = tokens.map(({ user_id, token }) => {
      const c = byUser.get(user_id);
      // No `type` in the payload: these reach people still on an older app
      // bundle, whose tap handler ignores a push without one (the app just
      // opens) but sends any unknown type to a blank profile. The current
      // bundle routes on `reengage` instead.
      const { type, kind, ...rest } = c.data ?? {};
      return {
        userId: user_id,
        token,
        payload: { to: token, title: c.title, body: c.body, data: { ...rest, reengage: c.kind }, sound: 'default' },
      };
    });

    const delivered = new Set();
    const dead = [];
    for (let i = 0; i < messages.length; i += EXPO_BATCH) {
      try {
        const r = await sendBatch(messages.slice(i, i + EXPO_BATCH));
        r.delivered.forEach(id => delivered.add(id));
        dead.push(...r.dead);
      } catch (err) {
        console.error('[reengagement] batch failed:', err.message ?? err);
      }
    }

    // Record only what Expo accepted, so a failed batch is retried tomorrow
    // instead of silently counting against the cap.
    const rows = [...delivered].map(id => ({ user_id: id, kind: byUser.get(id).kind }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from('reengagement_pushes').insert(rows.slice(i, i + 500));
      if (error) console.error('[reengagement] record failed:', error.message);
    }

    if (dead.length) {
      const { error } = await supabase.from('push_tokens').delete().in('token', dead);
      if (error) console.error('[reengagement] dead-token cleanup failed:', error.message);
    }

    const result = { candidates: candidates.length, sent: delivered.size, deadTokens: dead.length, byKind };
    console.log('[reengagement]', JSON.stringify(result));
    return result;
  } finally {
    running = false;
  }
}

module.exports = { runReengagement };
