// Helpers compartidos del Portal del Empleado (autoservicio: vacaciones, permisos, solicitudes)
import crypto from 'crypto';

export const SB_URL = process.env.SUPABASE_URL;
export const SB_ANON_KEY = process.env.SUPABASE_ANON_KEY;
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
// Firma de tokens del portal. Nunca se expone al cliente; reutiliza la service key como secreto.
const TOKEN_SECRET = SERVICE_KEY;
const SESSION_MINUTES = 45;

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Supabase REST con service_role (bypassea RLS) ──────────────────────────────
export async function sbAdmin(path, method = 'GET', body = null, extraHeaders = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'GET' ? '' : 'return=representation',
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

// ── PIN ────────────────────────────────────────────────────────────────────────
export function hashPin(cod, pin) {
  return crypto.createHash('sha256').update(`${cod}:${pin}`).digest('hex');
}
export function generarPin() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

// ── Token de sesion del portal (HMAC, sin dependencias externas) ──────────────
function b64url(buf) { return Buffer.from(buf).toString('base64url'); }
export function firmarToken(cod) {
  const payload = { cod, iat: Date.now(), exp: Date.now() + SESSION_MINUTES * 60 * 1000 };
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadB64).digest('hex');
  return `${payloadB64}.${sig}`;
}
export function verificarToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, sig] = token.split('.');
  const esperado = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadB64).digest('hex');
  const sigBuf = Buffer.from(sig || '', 'hex'), espBuf = Buffer.from(esperado, 'hex');
  if (sigBuf.length !== espBuf.length || !crypto.timingSafeEqual(sigBuf, espBuf)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')); } catch { return null; }
  if (!payload.cod || !payload.exp || Date.now() > payload.exp) return null;
  return payload.cod;
}

// ── Autenticacion de admin (para generar/resetear PIN desde la app interna) ───
export async function verificarAdmin(accessToken) {
  if (!accessToken) return null;
  const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { 'apikey': SB_ANON_KEY, 'Authorization': `Bearer ${accessToken}` },
  });
  if (!userRes.ok) return null;
  const user = await userRes.json();
  if (!user?.id) return null;
  const { ok, data } = await sbAdmin(`profiles?id=eq.${encodeURIComponent(user.id)}&select=permisos,activo`);
  const perfil = Array.isArray(data) ? data[0] : null;
  if (!ok || !perfil || perfil.activo === false) return null;
  const p = perfil.permisos || {};
  if (!p.gestionar_usuarios && !p.editar_pastores) return null;
  return user.id;
}
