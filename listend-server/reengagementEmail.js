const supabase = require('./db');

// Come-back emails for quiet accounts with no push token. Who gets which
// email is decided by reengagement_candidates(p_channel => 'email'); this
// module renders and sends them through Resend and hands out unsubscribe links.
//
// Links point at listend.uk (the listend-web worker):
//   /open?to=...       opens the app (or the store if it isn't installed)
//   /unsubscribe?t=... confirmation page + one-click POST, flips email_prefs

const RESEND_BATCH_URL = 'https://api.resend.com/emails/batch';
const RESEND_BATCH     = 100;   // Resend's per-request limit
const FROM     = 'Listend <hello@listend.uk>';   // not noreply@: filters trust it less
const REPLY_TO = 'support@listend.uk';
const SITE     = 'https://listend.uk';
const POSTAL   = process.env.EMAIL_POSTAL_ADDRESS || '';   // CAN-SPAM wants one for US recipients

const C = {
  bg: '#F2EBE0', card: '#FFFFFF', ink: '#1A0F0A', sub: '#6B4C35',
  line: '#E6DDCF', gold: '#D4A017',
};

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function openUrl(data) {
  const q = new URLSearchParams({ to: data?.route || 'home' });
  if (data?.route === 'album' && data.albumId) {
    q.set('id', data.albumId);
    if (data.title)  q.set('title', data.title);
    if (data.artist) q.set('artist', data.artist);
  }
  return `${SITE}/open?${q}`;
}

/** Apple Music artwork URLs carry a {w}x{h} template; ask for 600px. */
function artwork(url) {
  if (!url) return null;
  return url.replace('{w}', '600').replace('{h}', '600');
}

// Each kind: subject, preheader (inbox preview line), heading, intro, an
// optional list of { title, text } points, an optional image, and one button.
function content(kind, c) {
  const d = c.data ?? {};
  const first = (c.name || '').split(/\s+/)[0];
  const hi = first ? `Hi ${first},` : 'Hi,';
  switch (kind) {
    case 'welcome_how':
      return {
        subject: "Here's how Listend works",
        preheader: 'Log albums, rate them out of 10, and see what your friends are playing.',
        heading: "Here's how Listend works",
        intro: `${hi} you signed up for Listend but haven't logged an album yet. It only takes a few seconds, and here's what you get:`,
        points: [
          { title: 'Log what you listen to', text: 'Search any album, rate it out of 10 and add a few words if you like. It all builds up into your profile.' },
          { title: 'Flip a Record', text: "Not sure what to play? Flip a Record picks a classic album for you." },
          { title: 'Follow friends', text: "See what the people you follow are listening to, and how they'd rate it." },
        ],
        button: 'Log your first album',
      };
    case 'whats_new':
      return {
        subject: "What's new on Listend",
        preheader: 'Song ratings, your listening in numbers, and people to follow.',
        heading: "Here's what's new on Listend",
        intro: `${hi} a lot has changed since you last logged an album:`,
        points: [
          { title: 'Rate songs, not just albums', text: 'Rate and review individual tracks out of 10.' },
          { title: 'Month and Year in Review', text: 'Your listening in numbers: top artists, ratings and more.' },
          { title: 'People to Follow', text: "Find listeners with your taste, matched on albums you've both logged." },
          { title: 'Profile themes', text: 'Make your profile yours with Listend Pro.' },
        ],
        button: 'Open Listend',
      };
    case 'new_release':
      return {
        subject: `New from ${d.artist}: ${d.title}`,
        preheader: `${d.title} is out now.`,
        heading: `New from ${d.artist}`,
        intro: `${hi} ${d.title} by ${d.artist} is out now. You've logged ${d.artist} before, so give it a listen, then rate it on Listend.`,
        image: artwork(d.artworkUrl),
        imageAlt: `${d.title} by ${d.artist}`,
        button: 'See the album',
      };
    case 'friends_active': {
      const n = Number(d.count) || 1;
      const who = n > 1 ? `${d.friend} and ${n - 1} ${n === 2 ? 'other' : 'others'}` : d.friend;
      return {
        subject: `${who} ${n > 1 ? 'have' : 'has'} been listening`,
        preheader: 'See what your friends logged this week.',
        heading: 'Your friends have been listening',
        intro: `${hi} ${who} logged albums on Listend this week. See what they picked and how they rated it.`,
        button: 'See what they picked',
      };
    }
    case 'first_log':
      return {
        subject: 'What are you listening to?',
        preheader: 'Log your first album on Listend.',
        heading: 'What are you listening to?',
        intro: `${hi} log your first album on Listend. Rate it out of 10 and it's on your profile, the start of your own music diary.`,
        button: 'Log an album',
      };
    case 'flip':
    default:
      return {
        subject: 'Need something new to listen to?',
        preheader: 'Flip a Record picks a classic album for you.',
        heading: 'Need something new to listen to?',
        intro: `${hi} Flip a Record picks a classic album for you to try. Give it a spin, then log what you thought.`,
        button: 'Flip a Record',
      };
  }
}

function renderEmail(c, unsubUrl) {
  const k = content(c.kind, c);
  const cta = openUrl(c.data);

  const points = (k.points ?? []).map(p => `
          <tr><td style="padding:0 0 16px 0;">
            <div style="font-size:16px;font-weight:700;color:${C.ink};">${esc(p.title)}</div>
            <div style="font-size:15px;line-height:22px;color:${C.sub};margin-top:2px;">${esc(p.text)}</div>
          </td></tr>`).join('');

  const image = k.image ? `
          <tr><td style="padding:0 0 20px 0;">
            <img src="${esc(k.image)}" width="240" height="240" alt="${esc(k.imageAlt)}"
                 style="display:block;width:240px;height:240px;border-radius:8px;border:0;">
          </td></tr>` : '';

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${esc(k.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(k.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
      <tr><td style="padding:0 4px 20px 4px;font-size:22px;font-weight:800;letter-spacing:-0.4px;color:${C.ink};">Listend</td></tr>
      <tr><td style="background:${C.card};border-radius:16px;padding:28px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:0 0 12px 0;font-size:24px;line-height:30px;font-weight:800;letter-spacing:-0.4px;color:${C.ink};">${esc(k.heading)}</td></tr>
          <tr><td style="padding:0 0 20px 0;font-size:16px;line-height:24px;color:${C.ink};">${esc(k.intro)}</td></tr>
          ${image}${points}
          <tr><td style="padding:8px 0 0 0;">
            <a href="${esc(cta)}" style="display:inline-block;background:${C.gold};color:#FFFFFF;font-size:16px;font-weight:700;text-decoration:none;padding:14px 24px;border-radius:999px;white-space:nowrap;">${esc(k.button)}</a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 4px 0 4px;font-size:12px;line-height:18px;color:${C.sub};">
        You're getting this because you have a Listend account.
        <a href="${esc(unsubUrl)}" style="color:${C.sub};text-decoration:underline;">Unsubscribe from these emails</a>.<br>
        Listend · <a href="${SITE}" style="color:${C.sub};text-decoration:underline;">listend.uk</a>${POSTAL ? ` · ${esc(POSTAL)}` : ''}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const text = [
    k.heading, '', k.intro, '',
    ...(k.points ?? []).map(p => `- ${p.title}: ${p.text}`),
    ...(k.points?.length ? [''] : []),
    `${k.button}: ${cta}`, '',
    '---',
    "You're getting this because you have a Listend account.",
    `Unsubscribe: ${unsubUrl}`,
    `Listend · ${SITE}${POSTAL ? ` · ${POSTAL}` : ''}`,
  ].join('\n');

  return { subject: k.subject, html, text };
}

/** Make sure each user has an email_prefs row, and return their unsubscribe tokens. */
async function unsubTokens(userIds) {
  const tokens = new Map();
  for (let i = 0; i < userIds.length; i += 500) {
    const slice = userIds.slice(i, i + 500);
    const { error: upErr } = await supabase
      .from('email_prefs')
      .upsert(slice.map(id => ({ user_id: id })), { onConflict: 'user_id', ignoreDuplicates: true });
    if (upErr) throw new Error(`email_prefs upsert: ${upErr.message}`);
    const { data, error } = await supabase.from('email_prefs').select('user_id, unsub_token').in('user_id', slice);
    if (error) throw new Error(`email_prefs: ${error.message}`);
    for (const r of data ?? []) tokens.set(r.user_id, r.unsub_token);
  }
  return tokens;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Send one email per candidate. Returns the user_ids Resend accepted.
 * Resend's batch call is all-or-nothing, so a failed batch is simply
 * retried by tomorrow's run (nothing gets recorded for it).
 */
async function sendReengagementEmails(candidates) {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  const tokens = await unsubTokens(candidates.map(c => c.user_id));

  const messages = [];
  for (const c of candidates) {
    const token = tokens.get(c.user_id);
    if (!token || !c.email) continue;
    const unsubUrl = `${SITE}/unsubscribe?t=${token}`;
    const { subject, html, text } = renderEmail(c, unsubUrl);
    messages.push({
      userId: c.user_id,
      payload: {
        from: FROM,
        to: [c.email],
        reply_to: REPLY_TO,
        subject, html, text,
        headers: {
          'List-Unsubscribe': `<${unsubUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
        tags: [{ name: 'kind', value: c.kind }],
      },
    });
  }

  const delivered = new Set();
  for (let i = 0; i < messages.length; i += RESEND_BATCH) {
    const batch = messages.slice(i, i + RESEND_BATCH);
    try {
      const res = await fetch(RESEND_BATCH_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(batch.map(m => m.payload)),
      });
      if (res.ok) batch.forEach(m => delivered.add(m.userId));
      else console.error('[reengagement-email] Resend HTTP', res.status, (await res.text()).slice(0, 300));
    } catch (err) {
      console.error('[reengagement-email] batch failed:', err.message ?? err);
    }
    await sleep(600);   // Resend allows 2 requests a second by default
  }
  return delivered;
}

module.exports = { sendReengagementEmails, renderEmail };
