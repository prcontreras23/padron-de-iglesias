// GET  /api/get-solicitudes — lista todas las solicitudes
// DELETE /api/get-solicitudes  { id } — elimina una solicitud
import { sbFetch, cors } from './_helpers2.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST' && req.body?.accion === 'eliminar') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Falta id' });
    const { ok } = await sbFetch(`solicitudes_iglesias?id=eq.${id}`, 'DELETE');
    if (!ok) return res.status(500).json({ error: 'Error al eliminar' });
    return res.status(200).json({ ok: true });
  }

  const { ok, data } = await sbFetch('solicitudes_iglesias?select=id,created_at,nombre_congregacion,nombre_pastor,zona,distrito,estado,codigo_asignado,token_cesar,token_carlos,token_noemi&order=created_at.desc');
  if (!ok) return res.status(500).json({ error: 'Error al obtener solicitudes' });
  return res.status(200).json(data);
}
