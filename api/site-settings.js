const { get, put } = require('@vercel/blob');
const { hasSession } = require('./_auth');

const PATHNAME = 'site/settings.json';
const defaults = {
  whatsapp: '5567998034726',
  displayPhone: '',
  address: '',
  weekdayOpen: '',
  weekdayClose: '',
  saturdayOpen: '',
  saturdayClose: '',
  instagram: 'https://www.instagram.com/sc._perfumes/',
  facebook: '',
};

function text(value) { return String(value ?? '').trim(); }
function normalize(raw) {
  const whatsapp = text(raw?.whatsapp).replace(/\D/g, '');
  if (whatsapp && !/^\d{10,15}$/.test(whatsapp)) return null;
  for (const key of ['instagram', 'facebook']) {
    const value = text(raw?.[key]);
    if (value && !/^https:\/\//.test(value)) return null;
  }
  return {
    whatsapp,
    displayPhone: text(raw?.displayPhone),
    address: text(raw?.address),
    weekdayOpen: text(raw?.weekdayOpen),
    weekdayClose: text(raw?.weekdayClose),
    saturdayOpen: text(raw?.saturdayOpen),
    saturdayClose: text(raw?.saturdayClose),
    instagram: text(raw?.instagram),
    facebook: text(raw?.facebook),
  };
}

async function readSettings() {
  try {
    const result = await get(PATHNAME, { access: 'private', useCache: false });
    if (!result) return defaults;
    const chunks = [];
    for await (const chunk of result.stream) chunks.push(chunk);
    return { ...defaults, ...JSON.parse(Buffer.concat(chunks).toString('utf8')) };
  } catch { return defaults; }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json(await readSettings());
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Método não permitido' });
  if (!hasSession(req)) return res.status(401).json({ error: 'Não autorizado' });
  const settings = normalize(req.body);
  if (!settings) return res.status(400).json({ error: 'Configurações inválidas' });
  await put(PATHNAME, JSON.stringify(settings), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
  return res.status(200).json(settings);
};
