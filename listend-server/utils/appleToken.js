const jwt = require('jsonwebtoken');

const privateKey = (process.env.APPLE_MUSIC_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const teamId = process.env.APPLE_TEAM_ID;
const keyId = process.env.APPLE_KEY_ID;

let cachedToken = null;
let tokenExpiry = null;

function generateAppleToken() {
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
