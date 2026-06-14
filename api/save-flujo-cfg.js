// POST /api/save-flujo-cfg — guarda config del flujo desde la app
import { sbFetch, cors } from './_helpers2.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  const valor = req.body;
  // Upsert en tabla configuracion
  const { ok, data } = await sbFetch('configuracion', 'POST', { id: 'flujo_congregacion', valor, updated_at: new Date().toISOString() });
  if (!ok) {
    // Si ya existe, hacer PATCH
    const r = await sbFetch('configuracion?id=eq.flujo_congregacion', 'PATCH', { valor, updated_at: new Date().toISOString() });
    return res.status(r.ok ? 200 : 500).json({ ok: r.ok });
  }
  return res.status(200).json({ ok: true });
}
