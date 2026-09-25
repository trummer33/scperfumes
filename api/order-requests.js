const crypto = require('crypto');
const { get, list, put } = require('@vercel/blob');
const { hasSession } = require('./_auth');

const PREFIX = 'order-requests/';
const MAX_REQUESTS = 100;
const fields = { name: 80, contact: 100, fragrance: 120, details: 600 };

function readText(value, limit, required = false) {
  const text = String(value || '').trim();
  if ((required && !text) || text.length > limit) return null;
  return text;
}

async function readJson(url) {
  const result = await get(url, { access: 'private', useCache: false });
  if (!result) return null;
  const chunks = [];
  for await (const chunk of result.stream) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'POST') {
    if (String(req.body?.website || '').trim()) return res.status(204).end();
    const name = readText(req.body?.name, fields.name, true);
    const contact = readText(req.body?.contact, fields.contact, true);
    const fragrance = readText(req.body?.fragrance, fields.fragrance, true);
    const details = readText(req.body?.details, fields.details);
    if (!name || !contact || !fragrance || details === null) return res.status(400).json({ error: 'Pedido inválido' });

    const request = { id: crypto.randomUUID(), name, contact, fragrance, details, createdAt: new Date().toISOString() };
    await put(`${PREFIX}${request.id}.json`, JSON.stringify(request), { access: 'private', addRandomSuffix: false, contentType: 'application/json' });
    return res.status(201).json({ received: true });
  }

  if (req.method === 'GET') {
    if (!hasSession(req)) return res.status(401).json({ error: 'Não autorizado' });
    const { blobs } = await list({ prefix: PREFIX, limit: MAX_REQUESTS });
    const requests = (await Promise.all(blobs.map((blob) => readJson(blob.url).catch(() => null))))
      .filter(Boolean)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return res.status(200).json(requests);
  }

  return res.status(405).json({ error: 'Método não permitido' });
};
