// ─────────────────────────────────────────────────────────────────────────────
// Helpers compartidos por todas las funciones API
// ─────────────────────────────────────────────────────────────────────────────

const SB_URL  = process.env.SUPABASE_URL;
const SB_KEY  = process.env.SUPABASE_ANON_KEY;
const SITE    = (process.env.SITE_URL || '').replace(/\/$/, '');
const FROM    = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const RESEND  = process.env.RESEND_API_KEY;

// ── Aprobadores ───────────────────────────────────────────────────────────────
export function getAprobadores() {
  return [1, 2, 3, 4].map(n => {
    const val = process.env[`APROBADOR_${n}`] || '';
    const [nombre, email, telefono, wkey] = val.split('|');
    return { nombre: nombre?.trim(), email: email?.trim(), telefono: telefono?.trim(), wkey: wkey?.trim() };
  }).filter(a => a.nombre && a.email);
}

// ── Supabase REST ─────────────────────────────────────────────────────────────
export async function sbFetch(path, method = 'GET', body = null) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

// ── Email (Resend) ────────────────────────────────────────────────────────────
export async function sendEmail(to, subject, html) {
  if (!RESEND) return { ok: false, error: 'RESEND_API_KEY no configurado' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  return { ok: res.ok, data: await res.json() };
}

// ── WhatsApp (CallMeBot) ──────────────────────────────────────────────────────
export async function sendWhatsApp(telefono, wkey, mensaje) {
  if (!telefono || !wkey) return;
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(telefono)}&text=${encodeURIComponent(mensaje)}&apikey=${wkey}`;
  try { await fetch(url); } catch (e) { console.warn('WhatsApp error:', e.message); }
}

// ── Token único ───────────────────────────────────────────────────────────────
export function genToken() {
  return [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2,'0')).join('');
}

// ── Nombre del sistema ────────────────────────────────────────────────────────
export const SISTEMAS = ['SunPlus', 'Ecclesia', 'Infomac', 'ACMS'];

// ── CORS helper ───────────────────────────────────────────────────────────────
export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
