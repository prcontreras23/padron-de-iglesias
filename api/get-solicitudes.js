// GET    /api/get-solicitudes            — lista todas las solicitudes
// GET    /api/get-solicitudes?token=xxx  — retorna una solicitud por cualquiera de sus 4 tokens
// POST   /api/get-solicitudes { accion:'eliminar', id }  — elimina una solicitud
import { sbFetch, cors } from './_helpers2.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET' && req.query?.token) {
    const { token } = req.query;
    const campos = ['token_francis','token_cesar','token_carlos','token_noemi'];
    let sol = null;
    for (const campo of campos) {
      const { ok, data } = await sbFetch(`solicitudes_iglesias?${campo}=eq.${token}&select=*`);
      if (ok && data?.length) { sol = data[0]; break; }
    }
    if (!sol) return res.status(404).json({ error: 'Token no válido' });
    return res.status(200).json(sol);
  }

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
