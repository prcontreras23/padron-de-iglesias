// Helpers para el flujo de nuevas congregaciones
export const SB_URL  = process.env.SUPABASE_URL;
export const SB_KEY  = process.env.SUPABASE_ANON_KEY;
export const SITE    = (process.env.SITE_URL || '').replace(/\/$/, '');
export const FROM    = process.env.FROM_EMAIL || 'onboarding@resend.dev';
export const REPLY_TO = 'prcontreras@adventistassureste.org';
export const RESEND  = process.env.RESEND_API_KEY;

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export async function sbFetch(path, method = 'GET', body = null) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

export async function sendEmail({ to, cc, subject, html }) {
  if (!RESEND) { console.warn('RESEND_API_KEY no configurado'); return { ok: false }; }
  const body = { from: FROM, to: Array.isArray(to) ? to : [to], subject, html, reply_to: REPLY_TO };
  if (cc?.length) body.cc = Array.isArray(cc) ? cc : [cc];
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) console.warn('Resend error:', JSON.stringify(data));
  return { ok: res.ok, data };
}

export async function getFlujoCfg() {
  const { ok, data } = await sbFetch('configuracion?id=eq.flujo_congregacion&select=valor');
  if (!ok || !data?.[0]?.valor) {
    return {
      francis_email: 'prcontreras@adventistassureste.org',
      cesar_email:   '',
      carlos_email:  '',
      noemi_email:   '',
      cc_final:      'prgabrielpaulino@hotmail.com,J.aquino@adventistassureste.org',
    };
  }
  return data[0].valor;
}

export function emailBase({ titulo, cuerpo, boton }) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#f0f2f7;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;">
  <div style="background:#1e3564;padding:24px 28px;border-radius:12px 12px 0 0;">
    <h1 style="color:white;margin:0;font-size:20px;">${titulo}</h1>
    <p style="color:#93c5fd;margin:4px 0 0;font-size:13px;">Asociación Dominicana del Sureste</p>
  </div>
  <div style="background:white;padding:28px;border:1px solid #e8eaf2;border-top:none;border-radius:0 0 12px 12px;">
    ${cuerpo}
    ${boton ? `<div style="text-align:center;margin-top:24px;">
      <a href="${boton.url}" style="display:inline-block;background:#1e3564;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">${boton.texto} &rarr;</a>
    </div>` : ''}
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin:20px 0 0;">Sistema de Gestión — Asoc. Dom. Sureste</p>
  </div>
</div></body></html>`;
}

export function tablaSolicitud(s) {
  const row = (label, val) => val ? `<tr style="border-bottom:1px solid #f0f2f7;"><td style="padding:8px 0;color:#6b7280;width:160px;">${label}</td><td style="padding:8px 0;color:#1a2340;font-weight:500;">${val}</td></tr>` : '';
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
    ${row('Congregación', `<strong style="color:#1e3564;">${s.nombre_congregacion}</strong>`)}
    ${row('Pastor', s.nombre_pastor)}
    ${row('Teléfono', s.telefono_pastor)}
    ${row('Zona', s.zona)}
    ${row('Distrito', s.distrito)}
    ${row('Dirección', s.direccion)}
    ${row('Descripción', s.descripcion)}
  </table>`;
}
