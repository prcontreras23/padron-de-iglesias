// POST /api/notificar-permiso
// Envía email al pastor con la decisión (aprobado / rechazado)
import { sendEmail, emailBase, cors } from './_helpers2.js';

const motivoLabel = {
  enfermedad:        'Enfermedad',
  cita_medica:       'Cita Médica',
  asuntos_familiares:'Asuntos Familiares',
  asuntos_oficiales: 'Asuntos Oficiales',
  asuntos_personales:'Asuntos Personales',
};

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

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

  const { ok } = await sendEmail({
    to: email,
    subject: `${icono} Permiso de Ausencia — ${titulo} · Asoc. Dom. Sureste`,
    html: emailBase({ titulo: `${icono} ${titulo}`, cuerpo }),
  });

  if (!ok) return res.status(500).json({ error: 'Error al enviar correo' });
  return res.status(200).json({ ok: true });
}
