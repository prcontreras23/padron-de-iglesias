// GET /api/status?id=UUID        → estado de la solicitud (para el solicitante)
// GET /api/status?token=TOKEN    → solicitud + aprobaciones (para el aprobador, marca cuál es la suya)
import { sbFetch, cors } from './_helpers.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, token } = req.query;

  if (token) {
    // El aprobador accede por token
    const { ok, data: apList } = await sbFetch(`aprobaciones?token=eq.${token}&select=*,solicitudes(*)`);
    if (!ok || !apList?.length) return res.status(404).json({ error: 'Enlace no válido o expirado' });

    const ap  = apList[0];
    const sol = ap.solicitudes;

    const { data: todas } = await sbFetch(`aprobaciones?solicitud_id=eq.${sol.id}&select=aprobador,estado,comentario,ts`);
    const aprobaciones = (todas || []).map(a => ({
      ...a,
      _esPropia: a.aprobador === ap.aprobador,
    }));

    return res.status(200).json({
      id: sol.id,
      nombre: sol.nombre,
      email: sol.email,
      cargo: sol.cargo,
      sistema: sol.sistema,
      motivo: sol.motivo,
      estado: sol.estado,
      created_at: sol.created_at,
      aprobaciones,
      _aprobador: ap.aprobador,
      _estadoPropio: ap.estado,
    });
  }

  if (id) {
    // El solicitante revisa por ID
    const { ok, data: solList } = await sbFetch(`solicitudes?id=eq.${id}&select=*`);
    if (!ok || !solList?.length) return res.status(404).json({ error: 'Solicitud no encontrada' });

    const sol = solList[0];
    const { data: aps } = await sbFetch(`aprobaciones?solicitud_id=eq.${id}&select=aprobador,estado,comentario,ts`);

    return res.status(200).json({
      id: sol.id,
      nombre: sol.nombre,
      email: sol.email,
      cargo: sol.cargo,
      sistema: sol.sistema,
      motivo: sol.motivo,
      estado: sol.estado,
      created_at: sol.created_at,
      aprobaciones: aps || [],
    });
  }

  return res.status(400).json({ error: 'Falta el parámetro id o token' });
}
