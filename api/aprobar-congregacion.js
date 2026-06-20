// POST /api/aprobar-congregacion
// Francis aprueba o rechaza → si aprueba, email a César
import { sbFetch, sendEmail, getFlujoCfg, emailBase, tablaSolicitud, cors, SITE } from './_helpers2.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { token, decision, notas } = req.body || {};
  if (!token || !decision) return res.status(400).json({ error: 'Faltan token y decision' });
  if (!['aprobar','rechazar'].includes(decision)) return res.status(400).json({ error: 'decision debe ser aprobar o rechazar' });

  // Buscar solicitud
  const { ok, data } = await sbFetch(`solicitudes_iglesias?token_francis=eq.${token}&select=*`);
  if (!ok || !data?.length) return res.status(404).json({ error: 'Token no válido' });
  const sol = data[0];
  if (sol.estado !== 'pendiente_francis') return res.status(400).json({ error: 'Esta solicitud ya fue procesada' });

  if (decision === 'rechazar') {
    await sbFetch(`solicitudes_iglesias?id=eq.${sol.id}`, 'PATCH', {
      estado: 'rechazado_francis', francis_notas: notas, francis_aprobado_at: new Date().toISOString(),
    });
    // Notificar al pastor si tiene email
    if (sol.email_pastor) {
      await sendEmail({
        to: sol.email_pastor,
        subject: `Solicitud de congregación — ${sol.nombre_congregacion}`,
        html: emailBase({
          titulo: 'Solicitud No Aprobada',
          cuerpo: `<p style="color:#374151;">Tu solicitud para la congregación <strong>${sol.nombre_congregacion}</strong> no fue aprobada en esta etapa.</p>
                   ${notas ? `<p style="color:#6b7280;font-size:14px;"><strong>Nota:</strong> ${notas}</p>` : ''}
                   <p style="color:#374151;">Para más información contacta a la Asociación.</p>`,
        }),
      });
    }
    return res.status(200).json({ ok: true, mensaje: 'Solicitud rechazada' });
  }

  // Aprobar → actualizar y notificar a César
  await sbFetch(`solicitudes_iglesias?id=eq.${sol.id}`, 'PATCH', {
    estado: 'pendiente_cesar', francis_notas: notas, francis_aprobado_at: new Date().toISOString(),
  });

  const cfg = await getFlujoCfg();
  if (!cfg.cesar_email) {
    return res.status(200).json({ ok: true, aviso: 'Aprobado pero email de César no configurado. Configúralo en Configuración > Flujo.' });
  }

  const enlace = `${SITE}/paso-cesar.html?token=${sol.token_cesar}`;
  await sendEmail({
    to: cfg.francis_email || 'prcontreras@adventistassureste.org',
    subject: `📋 Paso 1 para César — ${sol.nombre_congregacion}`,
    html: emailBase({
      titulo: 'Paso 1: Confirmar en SunPlus',
      cuerpo: `<p style="color:#374151;margin:0 0 8px;">Aprobaste la solicitud de <strong>${sol.nombre_congregacion}</strong>. Envía el siguiente enlace a <strong>César Cabrera</strong> (${cfg.cesar_email || 'secretariosureste23@gmail.com'}) para que complete el registro en SunPlus:</p>
               ${tablaSolicitud(sol)}
               <p style="margin:16px 0 4px;font-size:13px;color:#6b7280;">Enlace para César:</p>
               <p style="background:#f0f2f7;border-radius:8px;padding:10px 14px;font-size:13px;word-break:break-all;margin:0;"><a href="${enlace}" style="color:#1e3564;">${enlace}</a></p>`,
      boton: { url: enlace, texto: 'Abrir enlace de César' },
    }),
  });

  return res.status(200).json({ ok: true, mensaje: 'Aprobado. César notificado.' });
}
