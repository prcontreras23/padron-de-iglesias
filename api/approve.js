// POST /api/approve
// Recibe { token, accion: 'aprobar'|'rechazar', comentario? }
// Actualiza la aprobación y, si todos aprobaron, notifica al solicitante.
import { sbFetch, sendEmail, sendWhatsApp, getAprobadores, cors } from './_helpers.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { token, accion, comentario } = req.body || {};
  if (!token || !['aprobar', 'rechazar'].includes(accion)) {
    return res.status(400).json({ error: 'Faltan campos: token, accion (aprobar|rechazar)' });
  }

  // 1. Buscar la aprobación por token
  const { ok, data: apList } = await sbFetch(`aprobaciones?token=eq.${token}&select=*,solicitudes(*)`);
  if (!ok || !apList?.length) {
    return res.status(404).json({ error: 'Enlace no válido o expirado' });
  }
  const ap = apList[0];
  if (ap.estado !== 'pendiente') {
    return res.status(409).json({ error: `Ya ${ap.estado === 'aprobado' ? 'aprobaste' : 'rechazaste'} esta solicitud.`, estado: ap.estado });
  }

  const sol = ap.solicitudes;
  if (sol.estado !== 'pendiente') {
    return res.status(409).json({ error: `Esta solicitud ya fue ${sol.estado}.`, estado: sol.estado });
  }

  // 2. Actualizar la aprobación
  const nuevoEstado = accion === 'aprobar' ? 'aprobado' : 'rechazado';
  await sbFetch(`aprobaciones?id=eq.${ap.id}`, 'PATCH', {
    estado: nuevoEstado,
    comentario: comentario || null,
    ts: new Date().toISOString(),
  });

  // 3. Si rechazo → cerrar solicitud de inmediato
  if (nuevoEstado === 'rechazado') {
    await sbFetch(`solicitudes?id=eq.${sol.id}`, 'PATCH', { estado: 'rechazada' });
    await notificarSolicitante(sol, 'rechazada', ap.aprobador, comentario);
    return res.status(200).json({ resultado: 'rechazada', mensaje: `Solicitud rechazada por ${ap.aprobador}.` });
  }

  // 4. Si aprobó → revisar si ya aprobaron todos
  const { data: todas } = await sbFetch(`aprobaciones?solicitud_id=eq.${sol.id}&select=estado`);
  const pendientes = todas.filter(a => a.estado === 'pendiente').length;
  const rechazadas = todas.filter(a => a.estado === 'rechazado').length;

  if (rechazadas > 0) {
    // Ya había sido rechazada por otro (edge case)
    return res.status(200).json({ resultado: 'rechazada', mensaje: 'La solicitud ya fue rechazada por otro aprobador.' });
  }

  if (pendientes === 0) {
    // Todos aprobaron
    await sbFetch(`solicitudes?id=eq.${sol.id}`, 'PATCH', { estado: 'aprobada' });
    await notificarSolicitante(sol, 'aprobada', null, null);
    return res.status(200).json({ resultado: 'aprobada', mensaje: '¡Todos aprobaron! El solicitante ha sido notificado.' });
  }

  return res.status(200).json({
    resultado: 'aprobado_parcial',
    mensaje: `Aprobación registrada. Faltan ${pendientes} aprobador${pendientes !== 1 ? 'es' : ''}.`,
    pendientes,
  });
}

async function notificarSolicitante(sol, resultado, aprobadorRechazo, comentario) {
  const aprobado = resultado === 'aprobada';
  const asunto = aprobado
    ? `✅ Acceso a ${sol.sistema} aprobado`
    : `❌ Solicitud de acceso a ${sol.sistema} rechazada`;

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
      <div style="background:${aprobado ? '#1e3564' : '#7f1d1d'};padding:24px 28px;border-radius:12px 12px 0 0;">
        <h1 style="color:white;margin:0;font-size:20px;">${aprobado ? '✅ Acceso aprobado' : '❌ Solicitud rechazada'}</h1>
        <p style="color:${aprobado ? '#93c5fd' : '#fca5a5'};margin:4px 0 0;font-size:13px;">Asociación Dominicana del Sureste</p>
      </div>
      <div style="background:#f8f9fc;padding:28px;border:1px solid #e8eaf2;border-top:none;border-radius:0 0 12px 12px;">
        <p style="color:#374151;">Hola <strong>${sol.nombre}</strong>,</p>
        ${aprobado
          ? `<p style="color:#374151;">Tu solicitud de acceso a <strong>${sol.sistema}</strong> fue <strong style="color:#16a34a;">aprobada</strong> por todos los aprobadores. El equipo de soporte te contactará para darte los accesos.</p>`
          : `<p style="color:#374151;">Tu solicitud de acceso a <strong>${sol.sistema}</strong> fue <strong style="color:#dc2626;">rechazada</strong>${aprobadorRechazo ? ` por ${aprobadorRechazo}` : ''}.</p>${comentario ? `<div style="background:#fee2e2;border-radius:8px;padding:12px 16px;margin-top:12px;font-size:13px;color:#7f1d1d;"><strong>Motivo:</strong> ${comentario}</div>` : ''}<p style="color:#6b7280;font-size:13px;margin-top:16px;">Si tienes dudas, comunícate con tu supervisor.</p>`
        }
      </div>
    </div>`;

  await sendEmail(sol.email, asunto, html);
}
