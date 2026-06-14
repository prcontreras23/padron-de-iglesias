// POST /api/paso-cesar
// César confirma SunPlus y asigna código → email a Carlos
import { sbFetch, sendEmail, getFlujoCfg, emailBase, tablaSolicitud, cors, SITE } from './_helpers2.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { token, codigo_asignado, sunplus_confirmado, notas } = req.body || {};
  if (!token || !codigo_asignado) return res.status(400).json({ error: 'Faltan token y codigo_asignado' });

  const { ok, data } = await sbFetch(`solicitudes_iglesias?token_cesar=eq.${token}&select=*`);
  if (!ok || !data?.length) return res.status(404).json({ error: 'Token no válido' });
  const sol = data[0];
  if (sol.estado !== 'pendiente_cesar') return res.status(400).json({ error: 'Este paso ya fue completado' });

  await sbFetch(`solicitudes_iglesias?id=eq.${sol.id}`, 'PATCH', {
    estado: 'pendiente_carlos',
    codigo_asignado,
    sunplus_confirmado: !!sunplus_confirmado,
    cesar_notas: notas,
    cesar_completado_at: new Date().toISOString(),
  });

  const cfg = await getFlujoCfg();
  if (!cfg.carlos_email) {
    return res.status(200).json({ ok: true, aviso: 'Completado pero email de Carlos no configurado.' });
  }

  const enlace = `${SITE}/paso-carlos.html?token=${sol.token_carlos}`;
  await sendEmail({
    to: cfg.carlos_email,
    subject: `📋 Crear cuenta en Ecclesia — ${sol.nombre_congregacion} (${codigo_asignado})`,
    html: emailBase({
      titulo: 'Paso 2: Crear en Ecclesia',
      cuerpo: `<p style="color:#374151;margin:0 0 8px;">Se solicita que crees la cuenta de esta congregación en <strong>Ecclesia</strong>:</p>
               ${tablaSolicitud({ ...sol, codigo_asignado })}
               <p style="color:#6b7280;font-size:13px;margin-top:8px;"><strong>Nota:</strong> Este paso depende de un proceso externo. Completa el formulario cuando tengas confirmación.</p>`,
      boton: { url: enlace, texto: 'Confirmar Ecclesia' },
    }),
  });

  return res.status(200).json({ ok: true, mensaje: 'SunPlus confirmado. Carlos notificado.' });
}
