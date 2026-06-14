// POST /api/eliminar-usuario
import { cors } from './_helpers2.js';

const SB_URL     = process.env.SUPABASE_URL;
const SB_SERVICE = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2YmtuYWJucmxsaW9mYmNoY3p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMyODcxNywiZXhwIjoyMDk2OTA0NzE3fQ.PapeVOE0xnIA5SijAhBkOVQjOfkbze26xxWBL0JRfMk';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { uid } = req.body || {};
  if (!uid) return res.status(400).json({ error: 'uid requerido' });

  // Eliminar perfil
  await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${uid}`, {
    method: 'DELETE',
    headers: { 'apikey': SB_SERVICE, 'Authorization': `Bearer ${SB_SERVICE}` },
  });

  // Eliminar usuario de Auth
  const r = await fetch(`${SB_URL}/auth/v1/admin/users/${uid}`, {
    method: 'DELETE',
    headers: { 'apikey': SB_SERVICE, 'Authorization': `Bearer ${SB_SERVICE}` },
  });

  if (!r.ok) {
    const d = await r.json();
    return res.status(400).json({ error: d?.msg || 'Error eliminando usuario' });
  }

  return res.status(200).json({ ok: true });
}
