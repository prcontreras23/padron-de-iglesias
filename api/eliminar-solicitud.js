// POST /api/eliminar-solicitud
import { sbFetch, cors } from './_helpers2.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Falta id' });

  const { ok } = await sbFetch(`solicitudes_iglesias?id=eq.${id}`, 'DELETE');
  if (!ok) return res.status(500).json({ error: 'Error al eliminar' });

  return res.status(200).json({ ok: true });
}
