const jwt = require('jsonwebtoken');

const rawKey = process.env.APPLE_MUSIC_PRIVATE_KEY || '';
const privateKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;
const teamId = process.env.APPLE_TEAM_ID;
const keyId = process.env.APPLE_KEY_ID;

let cachedToken = null;
let tokenExpiry = null;

// force cache reset
cachedToken = null;
tokenExpiry = null;

function generateAppleToken() {
  console.log('[appleToken] privateKey first 20 chars:', privateKey.slice(0, 20));
  if (cachedToken && tokenExpiry > Date.now()) return cachedToken;
  cachedToken = jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    expiresIn: '180d',
    issuer: teamId,
    header: { alg: 'ES256', kid: keyId }
  });
  tokenExpiry = Date.now() + (179 * 24 * 60 * 60 * 1000);
  return cachedToken;
}

module.exports = generateAppleToken;
