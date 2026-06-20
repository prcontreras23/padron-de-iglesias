// GET /api/get-solicitudes — lista todas las solicitudes (para la vista admin)
import { sbFetch, cors } from './_helpers2.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { ok, data } = await sbFetch('solicitudes_iglesias?select=id,created_at,nombre_congregacion,nombre_pastor,zona,distrito,estado,codigo_asignado,token_cesar,token_carlos,token_noemi&order=created_at.desc');
  if (!ok) return res.status(500).json({ error: 'Error al obtener solicitudes' });
  return res.status(200).json(data);
}
