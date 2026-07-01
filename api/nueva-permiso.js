// POST /api/nueva-permiso { accion:'crear', nombre, email, fecha_solicitud, fecha_ausencia, motivo, lugar, observaciones }
//   Pastor envía solicitud pública → guarda en Supabase
// POST /api/nueva-permiso { accion:'notificar', nombre, email, motivo, fecha_ausencia, estado, observaciones }
//   Envía email al pastor con la decisión (aprobado / rechazado)
import { emailBase, cors } from './_helpers2.js';
import nodemailer from 'nodemailer';

const SB_URL      = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendEmailGmail(to, subject, html) {
  console.log('📧 Intentando enviar email a:', to);
  console.log('📧 Desde:', process.env.GMAIL_EMAIL);
  console.log('📧 Credenciales configuradas:', !!process.env.GMAIL_EMAIL && !!process.env.GMAIL_APP_PASSWORD);

  try {
    const info = await transporter.sendMail({
      from: process.env.GMAIL_EMAIL,
      to,
      subject,
      html,
      replyTo: 'prcontreras@adventistassureste.org',
    });
    console.log('✅ Email enviado exitosamente. ID:', info.messageId);
    return { ok: true, id: info.messageId };
  } catch (error) {
    console.error('❌ Error enviando email:', error.message);
    console.error('❌ Código de error:', error.code);
    console.error('❌ Response:', error.response);
    return { ok: false, error: error.message };
  }
}

const motivoLabel = {
  enfermedad:        'Enfermedad',
  cita_medica:       'Cita Médica',
  asuntos_familiares:'Asuntos Familiares',
  asuntos_oficiales: 'Asuntos Oficiales',
  asuntos_personales:'Asuntos Personales',
};

async function crear(req, res) {
  if (!SERVICE_KEY || !SB_URL) {
    return res.status(500).json({ error: 'Error de configuración: variables de entorno no disponibles. Contacta al admin.' });
  }

  const { nombre, email, fecha_solicitud, fecha_ausencia, motivo, lugar, observaciones } = req.body || {};
  if (!nombre || !email || !fecha_solicitud || !fecha_ausencia || !motivo) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  try {
    const url = `${SB_URL}/rest/v1/permisos_ausencia`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ nombre, email, fecha_solicitud, fecha_ausencia, motivo, lugar: lugar||null, observaciones: observaciones||null, estado: 'pendiente' }),
    });

    const text = await r.text();
    if (!r.ok) {
      return res.status(500).json({ error: 'Error al guardar en Supabase', detail: text });
    }

    return res.status(200).json({ ok: true, mensaje: 'Solicitud recibida.' });
  } catch (e) {
    return res.status(500).json({ error: 'Excepción: ' + e.message });
  }
}

async function notificar(req, res) {
  const { nombre, email, motivo, fecha_ausencia, estado, observaciones } = req.body || {};
  if (!email || !estado) return res.status(400).json({ error: 'Faltan campos: email, estado' });

  const aprobado = estado === 'aprobado';
  const icono    = aprobado ? '✅' : '❌';
  const titulo   = aprobado ? 'Permiso Aprobado' : 'Permiso No Aprobado';
  const fAus     = fecha_ausencia ? new Date(fecha_ausencia + 'T12:00:00').toLocaleDateString('es-DO', { day:'2-digit', month:'long', year:'numeric' }) : '—';

  const filas = [
    ['Solicitante', nombre||'—'],
    ['Motivo',      motivoLabel[motivo] || motivo || '—'],
    ['Fecha',       fAus],
    observaciones ? ['Observaciones', observaciones] : null,
  ].filter(Boolean).map(([l,v]) =>
    `<tr style="border-bottom:1px solid #f0f2f7;"><td style="padding:8px 0;color:#6b7280;width:160px;">${l}</td><td style="padding:8px 0;color:#1a2340;font-weight:500;">${v}</td></tr>`
  ).join('');

  const cuerpo = `
    <div style="display:inline-block;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:700;margin-bottom:16px;background:${aprobado?'#dcfce7':'#fee2e2'};color:${aprobado?'#166534':'#991b1b'};">${icono} ${aprobado ? 'APROBADO' : 'NO APROBADO'}</div>
    <p style="color:#374151;margin:0 0 12px;">Hola <strong>${nombre||'Pastor(a)'}</strong>, tu solicitud de permiso de ausencia ha sido <strong>${aprobado?'aprobada':'rechazada'}</strong> por la Secretaría Ejecutiva.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0 16px;">${filas}</table>
    <p style="font-size:13px;color:#6b7280;">Para cualquier consulta, comunícate con la Secretaría Ejecutiva de la Asociación.</p>`;

  const { ok, id, error } = await sendEmailGmail(
    email,
    `${icono} Permiso de Ausencia — ${titulo} · Asoc. Dom. Sureste`,
    emailBase({ titulo: `${icono} ${titulo}`, cuerpo })
  );

  if (!ok) {
    console.error('Error enviando email a', email, ':', error);
    return res.status(500).json({ error: 'Error al enviar correo', detail: error });
  }
  console.log('Email enviado exitosamente a', email, '— id:', id);
  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const accion = req.body?.accion || 'crear';
  if (accion === 'notificar') return notificar(req, res);
  return crear(req, res);
}
