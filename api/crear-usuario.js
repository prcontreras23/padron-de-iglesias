// POST /api/crear-usuario
// Crea un usuario en Supabase Auth con contraseña temporal y envía correo
import { sendEmail, emailBase, cors } from './_helpers2.js';

const SB_URL     = process.env.SUPABASE_URL;
const SB_SERVICE = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2YmtuYWJucmxsaW9mYmNoY3p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMyODcxNywiZXhwIjoyMDk2OTA0NzE3fQ.PapeVOE0xnIA5SijAhBkOVQjOfkbze26xxWBL0JRfMk';
const SITE       = (process.env.SITE_URL || 'https://sureste-iglesias.vercel.app').replace(/\/$/, '');

function generarPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let pass = '';
  for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
}

async function adminFetch(path, method = 'GET', body = null) {
  const res = await fetch(`${SB_URL}/auth/v1/admin/${path}`, {
    method,
    headers: {
      'apikey': SB_SERVICE,
      'Authorization': `Bearer ${SB_SERVICE}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

async function sbInsert(table, body) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SB_SERVICE,
      'Authorization': `Bearer ${SB_SERVICE}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return { ok: res.ok, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, data: text }; }
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { email, nombre, permisos } = req.body || {};
  if (!email) return res.status(400).json({ error: 'El correo es requerido' });

  const password = generarPassword();

  // 1. Crear usuario en Supabase Auth
  const { ok, data } = await adminFetch('users', 'POST', {
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre: nombre || '' },
  });

  if (!ok) {
    const msg = data?.msg || data?.message || JSON.stringify(data);
    return res.status(400).json({ error: msg });
  }

  const uid = data.id;

  // 2. Crear perfil con debe_cambiar_password = true
  await sbInsert('profiles', {
    id: uid,
    email,
    nombre: nombre || '',
    permisos: permisos || {},
    activo: true,
    debe_cambiar_password: true,
  });

  // 3. Enviar correo con contraseña temporal
  await sendEmail({
    to: email,
    subject: 'Tu acceso al Sistema de Iglesias — Asociación Dominicana del Sureste',
    html: emailBase({
      titulo: 'Bienvenido al Sistema de Gestión',
      cuerpo: `
        <p style="color:#374151;margin:0 0 12px;">Hola${nombre ? ' <strong>' + nombre + '</strong>' : ''},</p>
        <p style="color:#374151;margin:0 0 16px;">Se ha creado tu cuenta en el Sistema de Gestión de Iglesias de la Asociación Dominicana del Sureste.</p>
        <div style="background:#f3f4f6;border-radius:8px;padding:16px 20px;margin:0 0 16px;">
          <p style="margin:0 0 6px;color:#6b7280;font-size:13px;">Tus credenciales de acceso:</p>
          <p style="margin:0 0 4px;"><strong>Correo:</strong> ${email}</p>
          <p style="margin:0;"><strong>Contraseña temporal:</strong> <code style="background:#e5e7eb;padding:2px 8px;border-radius:4px;font-size:15px;letter-spacing:1px;">${password}</code></p>
        </div>
        <p style="color:#374151;margin:0 0 4px;">Al iniciar sesión se te pedirá que cambies tu contraseña.</p>
        <p style="color:#ef4444;font-size:13px;margin:0;">No compartas estas credenciales con nadie.</p>
      `,
      boton: { url: SITE, texto: 'Ir al Sistema' },
    }),
  });

  return res.status(200).json({ ok: true, uid });
}
