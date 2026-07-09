// POST /api/nueva-congregacion
// Pastor envía solicitud → crea registro en Supabase → email a Francis
import { sbFetch, sendEmail, getFlujoCfg, emailBase, tablaSolicitud, cors, SITE } from './_helpers2.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { nombre_congregacion, nombre_pastor, telefono_pastor, email_pastor,
          zona, cod_zona, distrito, cod_distrito, direccion,
          iglesia_madre, cantidad_miembros, lugar_reunion, lideres_identificados, notas } = req.body || {};

  if (!nombre_congregacion || !nombre_pastor) {
    return res.status(400).json({ error: 'Faltan campos requeridos: nombre_congregacion, nombre_pastor' });
  }

  // 1. Crear solicitud en Supabase
  const { ok, data } = await sbFetch('solicitudes_iglesias', 'POST', {
    nombre_congregacion, nombre_pastor, telefono_pastor, email_pastor,
    zona, cod_zona, distrito, cod_distrito, direccion,
    iglesia_madre, cantidad_miembros, lugar_reunion, lideres_identificados, notas,
  });

  if (!ok || !data?.[0]?.id) {
    return res.status(500).json({ error: 'Error al guardar solicitud', detail: data });
  }
  const sol = data[0];

  // 2. Email a Francis
  const cfg = await getFlujoCfg();
  const enlace = `${SITE}/aprobar-congregacion.html?token=${sol.token_francis}`;

  await sendEmail({
    to: cfg.francis_email,
    subject: `✅ Nueva solicitud de congregación — ${nombre_congregacion}`,
    html: emailBase({
      titulo: 'Nueva Solicitud de Congregación',
      cuerpo: `<p style="color:#374151;margin:0 0 8px;">Se recibió una nueva solicitud. Revísala y aprueba o rechaza:</p>
               ${tablaSolicitud(sol)}`,
      boton: { url: enlace, texto: 'Revisar y aprobar' },
    }),
  });

  return res.status(200).json({ ok: true, id: sol.id, mensaje: 'Solicitud recibida. Francis será notificado.' });
}
