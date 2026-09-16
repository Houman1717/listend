// Mirror of the app's lib/userHandle.ts. Keep the two in sync: if the rule for
// what counts as an auto-generated username changes in one, it must change in
// the other, or the same account renders differently depending on whether a
// card came from this endpoint or from an on-device query.
//
// Accounts created through Apple/Google sign-in never pick a username, so the
// app invents one from the email prefix plus the last 12 hex chars of the user
// id. With Apple's private relay that prefix is itself random, producing
// handles like "s6hpjrhf7r_eb990498399b" — noise, not an identity.

const AUTO_SUFFIX = /_[0-9a-f]{12}$/;

/**
 * True when `username` looks auto-generated (or is missing entirely).
 * With `userId` the check is exact — the suffix is the last 12 hex chars of
 * that id — so it can't false-positive on a real username ending in hex.
 */
function isAutoUsername(username, userId) {
  if (!username) return true;
  if (userId) {
    const suffix = String(userId).replace(/-/g, '').slice(-12);
    return suffix.length === 12 && username.endsWith(`_${suffix}`);
  }
  return AUTO_SUFFIX.test(username);
}

/** The real "@handle", or the person's display name when there isn't one. */
function handleOrName(username, displayName, userId, fallback = 'User') {
  if (!isAutoUsername(username, userId)) return `@${username}`;
  const name = typeof displayName === 'string' ? displayName.trim() : '';
  return name || fallback;
}

module.exports = { isAutoUsername, handleOrName };
