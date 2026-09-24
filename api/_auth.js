const crypto = require('crypto');
const COOKIE = 'sc_admin_session';

function sameValue(left, right) {
  const a = Buffer.from(left || '');
  const b = Buffer.from(right || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sessionToken() {
  const password = process.env.ADMIN_PASSWORD;
  return password ? crypto.createHmac('sha256', password).update('sc-perfumes-admin-v1').digest('hex') : '';
}

function hasSession(req) {
  if (!process.env.ADMIN_PASSWORD) return false;
  const token = req.headers.cookie?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1];
  return Boolean(token) && sameValue(token, sessionToken());
}

module.exports = { COOKIE, hasSession, sameValue, sessionToken };
