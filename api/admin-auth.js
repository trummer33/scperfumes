const { COOKIE, hasSession, sameValue, sessionToken } = require('./_auth');
const SESSION_TTL = 60 * 60 * 8;

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(hasSession(req) ? 200 : 401).json({ authenticated: hasSession(req) });
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ error: 'Acesso administrativo não configurado.' });
  if (!sameValue(String(req.body?.password || ''), process.env.ADMIN_PASSWORD)) return res.status(401).json({ error: 'Senha incorreta.' });
  res.setHeader('Set-Cookie', `${COOKIE}=${sessionToken()}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}`);
  return res.status(200).json({ authenticated: true });
};
