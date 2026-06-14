// POST /api/admin-usuarios
// action: "crear" | "eliminar"
import { cors } from './_helpers2.js';

const SB_URL     = process.env.SUPABASE_URL;
const SB_SERVICE = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2YmtuYWJucmxsaW9mYmNoY3p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMyODcxNywiZXhwIjoyMDk2OTA0NzE3fQ.PapeVOE0xnIA5SijAhBkOVQjOfkbze26xxWBL0JRfMk';
const SITE       = (process.env.SITE_URL || 'https://sureste-iglesias.vercel.app').replace(/\/$/, '');

async function adminFetch(path, method = 'GET', body = null) {
  const res = await fetch(`${SB_URL}/auth/v1/admin/${path}`, {
    method,
    headers: { 'apikey': SB_SERVICE, 'Authorization': `Bearer ${SB_SERVICE}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

async function sbReq(path, method, body = null) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: { 'apikey': SB_SERVICE, 'Authorization': `Bearer ${SB_SERVICE}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { ok: res.ok, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, data: text }; }
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { action, email, nombre, permisos, uid } = req.body || {};

  if (action === 'crear') {
    if (!email) return res.status(400).json({ error: 'El correo es requerido' });

    // Usar invite en lugar de crear usuario con contraseña temporal.
    // Supabase envía el correo de invitación directamente al usuario.
    const { ok, data } = await adminFetch('invite', 'POST', {
      email,
      data: { nombre: nombre || '' },
      redirect_to: SITE,
    });
    if (!ok) return res.status(400).json({ error: data?.msg || data?.message || JSON.stringify(data) });

    const userId = data.id;
    // Crear perfil. debe_cambiar_password=false porque el usuario establece su propia
    // contraseña al aceptar la invitación.
    await sbReq('profiles', 'POST', {
      id: userId, email, nombre: nombre || '',
      permisos: permisos || {}, activo: true, debe_cambiar_password: false,
    });

    return res.status(200).json({ ok: true, uid: userId, invited: true });
  }

  if (action === 'eliminar') {
    if (!uid) return res.status(400).json({ error: 'uid requerido' });
    await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${uid}`, {
      method: 'DELETE',
      headers: { 'apikey': SB_SERVICE, 'Authorization': `Bearer ${SB_SERVICE}` },
    });
    const r = await adminFetch(`users/${uid}`, 'DELETE');
    if (!r.ok) return res.status(400).json({ error: r.data?.msg || 'Error eliminando usuario' });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Acción no válida' });
}
