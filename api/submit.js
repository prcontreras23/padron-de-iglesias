// POST /api/submit
// Recibe la solicitud, crea registros en Supabase y notifica a los aprobadores.
import { sbFetch, sendEmail, sendWhatsApp, genToken, getAprobadores, SISTEMAS, cors } from './_helpers.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { nombre, email, cargo, sistema, motivo } = req.body || {};
  if (!nombre || !email || !sistema) {
    return res.status(400).json({ error: 'Faltan campos requeridos: nombre, email, sistema' });
  }
  if (!SISTEMAS.includes(sistema)) {
    return res.status(400).json({ error: 'Sistema no válido' });
  }

  // 1. Crear solicitud
  const { ok: okSol, data: solData } = await sbFetch('solicitudes', 'POST', { nombre, email, cargo, sistema, motivo });
  if (!okSol || !solData?.[0]?.id) {
    return res.status(500).json({ error: 'Error al crear la solicitud', detail: solData });
  }
  const sol = solData[0];

  // 2. Crear un registro de aprobación por cada aprobador
  const aprobadores = getAprobadores();
  const registros = aprobadores.map(a => ({
    solicitud_id: sol.id,
    aprobador: a.nombre,
    token: genToken(),
    estado: 'pendiente',
  }));
  const { ok: okAp, data: apData } = await sbFetch('aprobaciones', 'POST', registros);
  if (!okAp) {
    return res.status(500).json({ error: 'Error al crear aprobaciones', detail: apData });
  }

  // 3. Notificar a cada aprobador
  const sitio = process.env.SITE_URL?.replace(/\/$/, '') || '';
  for (let i = 0; i < aprobadores.length; i++) {
    const ap = aprobadores[i];
    const tok = apData[i]?.token || registros[i].token;
    const enlace = `${sitio}/aprobar.html?token=${tok}`;

    const asunto = `Solicitud de acceso a ${sistema} — ${nombre}`;
    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
        <div style="background:#1e3564;padding:24px 28px;border-radius:12px 12px 0 0;">
          <h1 style="color:white;margin:0;font-size:20px;">Solicitud de acceso</h1>
          <p style="color:#93c5fd;margin:4px 0 0;font-size:13px;">Asociación Dominicana del Sureste</p>
        </div>
        <div style="background:#f8f9fc;padding:28px;border:1px solid #e8eaf2;border-top:none;border-radius:0 0 12px 12px;">
          <p style="color:#374151;margin:0 0 16px;">Hola <strong>${ap.nombre}</strong>, se recibió una solicitud de acceso que requiere tu aprobación:</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
            <tr style="border-bottom:1px solid #e8eaf2;"><td style="padding:8px 0;color:#6b7280;width:130px;">Solicitante</td><td style="padding:8px 0;font-weight:600;color:#1a2340;">${nombre}</td></tr>
            <tr style="border-bottom:1px solid #e8eaf2;"><td style="padding:8px 0;color:#6b7280;">Correo</td><td style="padding:8px 0;color:#1a2340;">${email}</td></tr>
            ${cargo ? `<tr style="border-bottom:1px solid #e8eaf2;"><td style="padding:8px 0;color:#6b7280;">Cargo</td><td style="padding:8px 0;color:#1a2340;">${cargo}</td></tr>` : ''}
            <tr style="border-bottom:1px solid #e8eaf2;"><td style="padding:8px 0;color:#6b7280;">Sistema</td><td style="padding:8px 0;font-weight:700;color:#1e3564;">${sistema}</td></tr>
            ${motivo ? `<tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Motivo</td><td style="padding:8px 0;color:#1a2340;">${motivo}</td></tr>` : ''}
          </table>
          <div style="text-align:center;margin-bottom:16px;">
            <a href="${enlace}" style="display:inline-block;background:#1e3564;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Revisar solicitud →</a>
          </div>
          <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;">Los 4 aprobadores deben dar su visto bueno para que el acceso sea concedido.</p>
        </div>
      </div>`;

    const msg = `📋 *Solicitud de acceso a ${sistema}*\n👤 ${nombre}${cargo ? ' — ' + cargo : ''}\n📧 ${email}${motivo ? '\n💬 ' + motivo : ''}\n\n✅ Aprueba o rechaza aquí:\n${enlace}`;

    await Promise.all([
      sendEmail(ap.email, asunto, html),
      sendWhatsApp(ap.telefono, ap.wkey, msg),
    ]);
  }

  return res.status(200).json({ id: sol.id, mensaje: 'Solicitud enviada. Los aprobadores han sido notificados.' });
}
