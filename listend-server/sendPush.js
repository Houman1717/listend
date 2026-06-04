const supabase = require('./db');

/**
 * Send an Expo push notification to every device registered for a user.
 * Silently skips if the user has no tokens or if the fetch fails.
 */
async function sendPush(userId, title, body, data = {}) {
  const { data: rows, error } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId);

  if (error || !rows?.length) return;

  const messages = rows.map(({ token }) => ({
    to: token,
    title,
    body,
    data,
    sound: 'default',
    badge: 1,
  }));

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });
}

module.exports = { sendPush };
