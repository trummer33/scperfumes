const crypto = require('crypto');

const COOKIE = 'sc_admin_session';
const SESSION_TTL = 60 * 60 * 8;

function sameValue(left, right) {
  const a = Buffer.from(left || '');
  const b = Buffer.from(right || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sessionToken() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return '';
  return crypto.createHmac('sha256', password).update('sc-perfumes-admin-v1').digest('hex');
}

function hasSession(req) {
  const token = req.headers.cookie?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1];
  return sameValue(token, sessionToken());
}

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return res.status(hasSession(req) ? 200 : 401).json({ authenticated: hasSession(req) });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
    return res.status(204).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ error: 'Acesso administrativo não configurado.' });

  const password = String(req.body?.password || '');
  if (!sameValue(password, process.env.ADMIN_PASSWORD)) return res.status(401).json({ error: 'Senha incorreta.' });

  res.setHeader('Set-Cookie', `${COOKIE}=${sessionToken()}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}`);
  return res.status(200).json({ authenticated: true });
};
