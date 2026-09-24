const crypto = require('crypto');
const COOKIE = 'sc_admin_session';

function sameValue(left, right) {
  const a = Buffer.from(left || '');
  const b = Buffer.from(right || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function users() {
  const projectUsers = ['sandra_sc', 'cleber_sc']
    .filter((username) => process.env[username])
    .map((username) => ({ username, password: process.env[username] }));
  try {
    const parsed = JSON.parse(process.env.ADMIN_USERS || '[]');
    const configured = Array.isArray(parsed) ? parsed.filter((user) => user?.username && user?.password) : [];
    return [...projectUsers, ...configured];
  } catch { return projectUsers; }
}

function sessionToken(username) {
  const user = users().find((entry) => entry.username === String(username).toLowerCase());
  return user ? `${username}.${crypto.createHmac('sha256', user.password).update('sc-perfumes-admin-v2').digest('hex')}` : '';
}

function hasSession(req) {
  const token = req.headers.cookie?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1];
  if (!token) return false;
  const [username] = token.split('.', 1);
  return Boolean(username) && sameValue(token, sessionToken(username));
}

function authenticate(username, password) {
  const user = users().find((entry) => entry.username === String(username).toLowerCase());
  return user && sameValue(password, user.password) ? user : null;
}

module.exports = { COOKIE, hasSession, sameValue, sessionToken, authenticate };
