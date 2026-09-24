const { get, put } = require('@vercel/blob');
const { hasSession } = require('./_auth');
const fallbackCatalog = require('../catalog.json');

const PATHNAME = 'catalog/catalog.json';

function validProduct(product) {
  return product && typeof product === 'object' &&
    ['id', 'nome', 'marca', 'categoria', 'img', 'desc'].every((key) => String(product[key] || '').trim()) &&
    ['saida', 'coracao', 'fundo'].every((key) => String(product.notas?.[key] || '').trim());
}

async function readCatalog() {
  try {
    const result = await get(PATHNAME, { access: 'private', useCache: false });
    if (!result) return fallbackCatalog;
    const chunks = [];
    for await (const chunk of result.stream) chunks.push(chunk);
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return Array.isArray(parsed) ? parsed : fallbackCatalog;
  } catch {
    return fallbackCatalog;
  }
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, s-maxage=15, must-revalidate');
    return res.status(200).json(await readCatalog());
  }
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Método não permitido' });
  if (!hasSession(req)) return res.status(401).json({ error: 'Não autorizado' });

  const products = req.body;
  if (!Array.isArray(products) || !products.every(validProduct)) {
    return res.status(400).json({ error: 'Catálogo inválido' });
  }
  if (new Set(products.map((product) => String(product.id))).size !== products.length) {
    return res.status(400).json({ error: 'IDs duplicados' });
  }

  await put(PATHNAME, JSON.stringify(products), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
  return res.status(200).json({ count: products.length });
};
