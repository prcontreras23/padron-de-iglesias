// POST /api/paso-carlos
// Carlos confirma Ecclesia → email a Noemí
import { sbFetch, sendEmail, getFlujoCfg, emailBase, tablaSolicitud, cors, SITE } from './_helpers2.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { token, ecclesia_confirmado, notas } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Falta token' });

  const { ok, data } = await sbFetch(`solicitudes_iglesias?token_carlos=eq.${token}&select=*`);
  if (!ok || !data?.length) return res.status(404).json({ error: 'Token no válido' });
  const sol = data[0];
  if (sol.estado !== 'pendiente_carlos') return res.status(400).json({ error: 'Este paso ya fue completado' });

  await sbFetch(`solicitudes_iglesias?id=eq.${sol.id}`, 'PATCH', {
    estado: 'pendiente_noemi',
    ecclesia_confirmado: !!ecclesia_confirmado,
    carlos_notas: notas,
    carlos_completado_at: new Date().toISOString(),
  });

  const cfg = await getFlujoCfg();
  if (!cfg.noemi_email) {
    return res.status(200).json({ ok: true, aviso: 'Completado pero email de Noemí no configurado.' });
  }

  const enlace = `${SITE}/paso-noemi.html?token=${sol.token_noemi}`;
  await sendEmail({
    to: cfg.francis_email || 'prcontreras@adventistassureste.org',
    subject: `📋 Paso 3 para Noemí — ${sol.nombre_congregacion}`,
    html: emailBase({
      titulo: 'Paso 3: Confirmar en Infomac y ACMS',
      cuerpo: `<p style="color:#374151;margin:0 0 8px;">Carlos completó Ecclesia para <strong>${sol.nombre_congregacion}</strong>. Envía el siguiente enlace a <strong>Noemí Vizcaíno</strong> (${cfg.noemi_email || 'nvizcaino@adventistassureste.org'}):</p>
               ${tablaSolicitud({ ...sol })}
               <p style="margin:16px 0 4px;font-size:13px;color:#6b7280;">Enlace para Noemí:</p>
               <p style="background:#f0f2f7;border-radius:8px;padding:10px 14px;font-size:13px;word-break:break-all;margin:0;"><a href="${enlace}" style="color:#1e3564;">${enlace}</a></p>`,
      boton: { url: enlace, texto: 'Abrir enlace de Noemí' },
    }),
  });

  return res.status(200).json({ ok: true, mensaje: 'Ecclesia confirmado. Noemí notificada.' });
}
