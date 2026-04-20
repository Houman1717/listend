const jwt = require('jsonwebtoken');

const privateKey = Buffer.from(process.env.APPLE_MUSIC_PRIVATE_KEY_B64, 'base64').toString('utf8');
const teamId = process.env.APPLE_TEAM_ID;
const keyId = process.env.APPLE_KEY_ID;

let cachedToken = null;
let tokenExpiry = null;

// force cache reset
cachedToken = null;
tokenExpiry = null;

function generateAppleToken() {
  console.log('[appleToken] privateKey length:', privateKey.length);
  console.log('[appleToken] privateKey first 20 chars:', privateKey.slice(0, 20));
  console.log('[appleToken] privateKey last 20 chars:', privateKey.slice(-20));
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
