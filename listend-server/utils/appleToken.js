const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// APPLE_MUSIC_KEY_B64 is the rotated key (Oct 2026). The old name is only a
// fallback: Railway kept serving a stale value under it after rotation.
const privateKey = Buffer.from(process.env.APPLE_MUSIC_KEY_B64 || process.env.APPLE_MUSIC_PRIVATE_KEY_B64, 'base64').toString('utf8');
const teamId = process.env.APPLE_TEAM_ID;
const keyId = process.env.APPLE_KEY_ID;

let cachedToken = null;
let tokenExpiry = null;

// force cache reset
cachedToken = null;
tokenExpiry = null;

// A short hash identifies which .p8 is loaded without revealing it.
console.log('[appleToken] key fingerprint:', crypto.createHash('sha256').update(privateKey).digest('hex').slice(0, 12), 'kid:', keyId, 'team:', teamId);

function generateAppleToken() {
  if (cachedToken && tokenExpiry > Date.now()) return cachedToken;
  cachedToken = jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    expiresIn: '180d',
    issuer: teamId,
    header: { alg: 'ES256', kid: keyId }
  });
  tokenExpiry = Date.now() + (179 * 24 * 60 * 60 * 1000);
  const [h, p] = cachedToken.split('.').slice(0, 2).map(s => JSON.parse(Buffer.from(s, 'base64url').toString('utf8')));
  console.log('[appleToken] JWT header:', JSON.stringify(h));
  console.log('[appleToken] JWT payload:', JSON.stringify(p));
  return cachedToken;
}

module.exports = generateAppleToken;
