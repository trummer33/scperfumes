const crypto = require('crypto');

const COOKIE = 'sc_admin_session';
const SECRET = process.env.ADMIN_SECRET || 'scperfumes-secret-key-2026';

// Credenciais de acesso com utilizadores diretos
const USERS = {
  'joao_sc': 'admin',
  'sandra_sc': 'admin',
  'cleber_sc': 'admin'
};

const ENVIRONMENT_USERS = {
  sandra_sc: process.env.ADMIN_PASSWORD_SANDRA_SC,
  cleber_sc: process.env.ADMIN_PASSWORD_CLEBER_SC
};

for (const [username, password] of Object.entries(ENVIRONMENT_USERS)) {
  if (password) USERS[username] = password;
}

function hashToken(username) {
  return crypto.createHmac('sha256', SECRET).update(username).digest('hex');
}

function authenticate(username, password) {
  if (!username || !password) return null;
  const cleanUser = String(username).trim().toLowerCase();
  
  if (USERS[cleanUser] && USERS[cleanUser] === String(password)) {
    return { username: cleanUser };
  }
  return null;
}

function sessionToken(username) {
  const hash = hashToken(username);
  return `${username}.${hash}`;
}

function hasSession(req) {
  const cookies = req.headers.cookie || '';
  const match = cookies.split(';').find(c => c.trim().startsWith(`${COOKIE}=`));
  if (!match) return false;

  const value = match.split('=')[1];
  if (!value) return false;

  const [username, hash] = value.split('.');
  if (!username || !hash) return false;

  return hashToken(username) === hash;
}

module.exports = {
  COOKIE,
  authenticate,
  sessionToken,
  hasSession
};
