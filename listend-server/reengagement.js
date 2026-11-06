const supabase = require('./db');
const { sendReengagementEmails } = require('./reengagementEmail');

// "Come back" pushes for quiet accounts. Who gets one, and which message, is
// decided in Postgres by reengagement_candidates() (supabase/
// add-growth-follows-reengagement.sql): nothing logged for 7 days, no such push
// in 7 days, at most 4 since they were last active, reminders switched on.
// This module only sends what that returns and records it.
//
// The daily cron only runs when REENGAGEMENT_ENABLED=true, so the first send
// is a deliberate switch-on after a dry run, not a side effect of a deploy.
//
// channel 'email' does the same for quiet accounts with no push token
// (reengagementEmail.js), behind its own REENGAGEMENT_EMAILS_ENABLED switch
// and a lower daily limit so the sending domain warms up gradually. Both
// channels log to reengagement_pushes, so the weekly cap covers both.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH    = 100;   // Expo's per-request message limit
const DAILY_LIMIT   = Number(process.env.REENGAGEMENT_DAILY_LIMIT) || 1500;
const EMAIL_DAILY_LIMIT = Number(process.env.REENGAGEMENT_EMAIL_DAILY_LIMIT) || 500;

const running = { push: false, email: false };

// .in() lists go in the URL; 500 uuids made it too long and the request
// failed outright ("fetch failed", 2026-11-05 — no pushes went out). Same
// 100-id rule as fetchAllRowsIn in index.js.
const ID_CHUNK = 100;

// The Data API hands back at most 1,000 rows per request, RPCs included.
// Release Friday 2026-11-06 only reached the first 1,000 of 4,423 because of
// it. So read RPC results a page at a time. order: a column to sort the
// function's result by, so pages don't overlap or skip (leave it out only to
// continue the unsorted order an earlier un-paged call used). start: skip
// that many rows first.
const PAGE = 1000;
async function rpcAll(fn, args, { order = null, start = 0 } = {}) {
  const rows = [];
  for (let from = start; ; from += PAGE) {
    let q = supabase.rpc(fn, args);
    if (order) q = q.order(order);
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw new Error(`${fn}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function fetchCandidates({ limit, userId = null, ignoreCaps = false, channel = 'push' } = {}) {
  // The function picks and limits the set itself; sorting its result by
  // user_id just keeps the pages stable.
  return rpcAll('reengagement_candidates', {
    p_limit: limit,
    p_only_user: userId,
    p_ignore_caps: ignoreCaps,
    p_channel: channel,
  }, { order: 'user_id' });
}

async function fetchTokens(userIds) {
  const tokens = [];
  for (let i = 0; i < userIds.length; i += ID_CHUNK) {
    const { data, error } = await supabase
      .from('push_tokens')
      .select('user_id, token')
      .in('user_id', userIds.slice(i, i + ID_CHUNK));
    if (error) throw new Error(`push_tokens: ${error.message}`);
    tokens.push(...(data ?? []));
  }
  return tokens;
}

/**
 * Send one batch to Expo. Returns the user_ids that got at least one accepted
 * ticket, and the tokens Expo says are dead (app uninstalled / token rotated).
 */
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Expo accepts about 600 notifications a second per project. Sending 100-message
// batches back to back went over that on 2026-11-06 (Release Friday): only 603
// of ~4,400 went out, the rest were refused. So: pace the batches, and retry a
// refused or failed batch with a growing wait.
const BATCH_GAP_MS = 400;              // 100 per 0.4s = 250/s, well under the limit
const RETRY_WAITS  = [2000, 5000, 15000, 30000];

async function postToExpo(payloads) {
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payloads),
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

async function sendBatch(messages) {
  const delivered = new Set();
  const dead = [];
  let res, json;
  for (let attempt = 0; ; attempt++) {
    try {
      ({ res, json } = await postToExpo(messages.map(m => m.payload)));
    } catch (err) {
      res = null; json = null;
      console.error('[push] Expo request failed:', err.message ?? err);
    }
    const retryable = !res || res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= RETRY_WAITS.length) break;
    console.warn(`[push] Expo ${res?.status ?? 'network error'}, retrying in ${RETRY_WAITS[attempt]}ms`);
    await sleep(RETRY_WAITS[attempt]);
  }

  // Tokens from more than one Expo project in one request: Expo refuses the
  // whole request and lists the tokens per project. Send each group on its own.
  const mixed = json?.errors?.find(e => e.code === 'PUSH_TOO_MANY_EXPERIENCE_IDS');
  if (mixed?.details && typeof mixed.details === 'object') {
    for (const group of Object.values(mixed.details)) {
      const set = new Set(group);
      const part = messages.filter(m => set.has(m.token));
      if (!part.length) continue;
      const r = await sendBatch(part);
      r.delivered.forEach(id => delivered.add(id));
      dead.push(...r.dead);
      await sleep(BATCH_GAP_MS);
    }
    return { delivered, dead };
  }

  const tickets = Array.isArray(json?.data) ? json.data : [];
  messages.forEach((m, i) => {
    const t = tickets[i];
    if (t?.status === 'ok') delivered.add(m.userId);
    else if (t?.details?.error === 'DeviceNotRegistered') dead.push(m.token);
  });
  if (!res?.ok) console.error('[push] Expo HTTP', res?.status, JSON.stringify(json)?.slice(0, 300));
  return { delivered, dead };
}

/**
 * Send prepared messages ({ userId, token, payload }) to Expo in batches,
 * drop tokens Expo says are dead, and return who got at least one.
 * Shared with releaseFriday.js.
 */
async function sendPushes(messages, label) {
  const delivered = new Set();
  const dead = [];
  for (let i = 0; i < messages.length; i += EXPO_BATCH) {
    try {
      const r = await sendBatch(messages.slice(i, i + EXPO_BATCH));
      r.delivered.forEach(id => delivered.add(id));
      dead.push(...r.dead);
    } catch (err) {
      console.error(`[${label}] batch failed:`, err.message ?? err);
    }
    if (i + EXPO_BATCH < messages.length) await sleep(BATCH_GAP_MS);
  }
  const users = new Set(messages.map(m => m.userId)).size;
  console.log(`[${label}] delivered to ${delivered.size}/${users} users, ${dead.length} dead tokens`);
  for (let i = 0; i < dead.length; i += ID_CHUNK) {
    const { error } = await supabase.from('push_tokens').delete().in('token', dead.slice(i, i + ID_CHUNK));
    if (error) console.error(`[${label}] dead-token cleanup failed:`, error.message);
  }
  return { delivered, dead };
}

async function record(userIds, byUser, channel) {
  // Record only what was accepted, so a failed batch is retried tomorrow
  // instead of silently counting against the cap.
  const rows = [...userIds].map(id => ({ user_id: id, kind: byUser.get(id).kind, channel }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('reengagement_pushes').insert(rows.slice(i, i + 500));
    if (error) console.error(`[reengagement:${channel}] record failed:`, error.message);
  }
}

/**
 * Run one pass for a channel ('push' or 'email'). dryRun returns who would
 * get what without sending or recording anything. userId + ignoreCaps
 * targets one account (testing).
 */
async function runReengagement({ channel = 'push', dryRun = false, limit, userId = null, ignoreCaps = false } = {}) {
  if (running[channel]) return { skipped: 'already running' };
  running[channel] = true;
  try {
    const candidates = await fetchCandidates({
      limit: limit ?? (channel === 'email' ? EMAIL_DAILY_LIMIT : DAILY_LIMIT),
      userId, ignoreCaps, channel,
    });
    const byKind = {};
    for (const c of candidates) byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;

    if (dryRun) {
      // never echo email addresses back, even to the admin route
      const sample = candidates.slice(0, 5).map(({ email, ...c }) => c);
      return { channel, dryRun: true, count: candidates.length, byKind, sample };
    }
    if (!candidates.length) return { channel, sent: 0, byKind };

    if (channel === 'email') {
      const byUser = new Map(candidates.map(c => [c.user_id, c]));
      const delivered = await sendReengagementEmails(candidates);
      await record(delivered, byUser, 'email');
      const result = { channel, candidates: candidates.length, sent: delivered.size, byKind };
      console.log('[reengagement:email]', JSON.stringify(result));
      return result;
    }

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

    const { delivered, dead } = await sendPushes(messages, 'reengagement');

    await record(delivered, byUser, 'push');

    const result = { channel, candidates: candidates.length, sent: delivered.size, deadTokens: dead.length, byKind };
    console.log('[reengagement:push]', JSON.stringify(result));
    return result;
  } finally {
    running[channel] = false;
  }
}

module.exports = { runReengagement, sendPushes, fetchTokens, rpcAll };
