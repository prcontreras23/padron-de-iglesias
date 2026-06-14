// GET /api/get-solicitud?token=xxx
// Retorna los datos de una solicitud por cualquiera de sus tokens
import { sbFetch, cors } from './_helpers2.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Falta token' });

  // Buscar por cualquiera de los 4 tokens
  const campos = ['token_francis','token_cesar','token_carlos','token_noemi'];
  let sol = null;
  for (const campo of campos) {
    const { ok, data } = await sbFetch(`solicitudes_iglesias?${campo}=eq.${token}&select=*`);
    if (ok && data?.length) { sol = data[0]; break; }
  }
  if (!sol) return res.status(404).json({ error: 'Token no válido' });
  return res.status(200).json(sol);
}
