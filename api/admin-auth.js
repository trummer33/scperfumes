const { COOKIE, hasSession, authenticate, sessionToken } = require('./_auth');
const SESSION_TTL = 60 * 60 * 8;

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(hasSession(req) ? 200 : 401).json({ authenticated: hasSession(req) });
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const username = String(req.body?.username || '').trim().toLowerCase();
  const user = authenticate(username, String(req.body?.password || ''));
  if (!user) return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  res.setHeader('Set-Cookie', `${COOKIE}=${sessionToken(user.username)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}`);
  return res.status(200).json({ authenticated: true, username: user.username });
};
