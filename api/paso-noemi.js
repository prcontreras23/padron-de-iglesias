// POST /api/paso-noemi
// Noemí confirma Infomac/ACMS → crea congregación como "grupo" → email final
import { sbFetch, sendEmail, getFlujoCfg, emailBase, tablaSolicitud, cors } from './_helpers2.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { token, infomac_confirmado, acms_confirmado, notas } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Falta token' });

  const { ok, data } = await sbFetch(`solicitudes_iglesias?token_noemi=eq.${token}&select=*`);
  if (!ok || !data?.length) return res.status(404).json({ error: 'Token no válido' });
  const sol = data[0];
  if (sol.estado !== 'pendiente_noemi') return res.status(400).json({ error: 'Este paso ya fue completado' });

  // 1. Crear la congregación en la tabla iglesias como "grupo"
  let iglesia_cod = sol.codigo_asignado || null;
  const { ok: okIg, data: igData } = await sbFetch('iglesias', 'POST', {
    cod:          sol.codigo_asignado || `GRP-${Date.now()}`,
    nombre:       sol.nombre_congregacion,
    pastor:       sol.nombre_pastor,
    tipo:         'grupo',
    codZona:      sol.cod_zona || null,
    zona:         sol.zona || null,
    codDistrito:  sol.cod_distrito || null,
    distrito:     sol.distrito || null,
  });
  if (okIg && igData?.[0]?.cod) iglesia_cod = igData[0].cod;

  // 2. Marcar solicitud como completada
  await sbFetch(`solicitudes_iglesias?id=eq.${sol.id}`, 'PATCH', {
    estado: 'completado',
    infomac_confirmado: !!infomac_confirmado,
    acms_confirmado: !!acms_confirmado,
    noemi_notas: notas,
    noemi_completado_at: new Date().toISOString(),
    iglesia_cod,
  });

  // 3. Email final a Francis + CC
  const cfg = await getFlujoCfg();
  const ccList = (cfg.cc_final || '')
    .split(',').map(e => e.trim()).filter(Boolean);

  const htmlFinal = emailBase({
    titulo: '✅ Nueva Congregación Registrada',
    cuerpo: `<p style="color:#374151;margin:0 0 8px;">El proceso de registro fue completado exitosamente. La congregación ha sido creada en el sistema como <strong style="color:#1e3564;">Grupo</strong>.</p>
             ${tablaSolicitud({ ...sol, codigo_asignado: iglesia_cod || sol.codigo_asignado })}
             <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;margin-top:16px;">
               <p style="margin:0;font-size:13px;color:#166534;">
                 ✓ SunPlus — confirmado &nbsp;|&nbsp;
                 ✓ Ecclesia — confirmado &nbsp;|&nbsp;
                 ✓ Infomac — confirmado &nbsp;|&nbsp;
                 ✓ ACMS — confirmado
               </p>
             </div>`,
  });

  await sendEmail({
    to: cfg.francis_email,
    cc: ccList,
    subject: `✅ Nueva congregación registrada — ${sol.nombre_congregacion} (${iglesia_cod || sol.codigo_asignado || 'sin código'})`,
    html: htmlFinal,
  });

  // 4. Notificar al pastor si tiene email
  if (sol.email_pastor) {
    await sendEmail({
      to: sol.email_pastor,
      subject: `Tu solicitud fue aprobada — ${sol.nombre_congregacion}`,
      html: emailBase({
        titulo: 'Solicitud Completada',
        cuerpo: `<p style="color:#374151;">La congregación <strong>${sol.nombre_congregacion}</strong> ha sido registrada oficialmente en todos los sistemas de la Asociación Dominicana del Sureste.</p>
                 ${sol.codigo_asignado ? `<p style="color:#374151;">Código asignado: <strong style="color:#1e3564;">${sol.codigo_asignado}</strong></p>` : ''}`,
      }),
    });
  }

  return res.status(200).json({ ok: true, mensaje: 'Proceso completado. Congregación creada como grupo.' });
}
