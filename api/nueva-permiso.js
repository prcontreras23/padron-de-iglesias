// POST /api/nueva-permiso
// Pastor envía solicitud pública → guarda en Supabase
import { cors } from './_helpers2.js';

const SB_URL     = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { nombre, email, fecha_solicitud, fecha_ausencia, motivo, lugar, observaciones } = req.body || {};

  if (!nombre || !email || !fecha_solicitud || !fecha_ausencia || !motivo) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  const r = await fetch(`${SB_URL}/rest/v1/permisos_ausencia`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({ nombre, email, fecha_solicitud, fecha_ausencia, motivo, lugar: lugar||null, observaciones: observaciones||null, estado: 'pendiente' }),
  });

  if (!r.ok) {
    const err = await r.text();
    return res.status(500).json({ error: 'Error al guardar', detail: err });
  }

  return res.status(200).json({ ok: true, mensaje: 'Solicitud recibida.' });
}
