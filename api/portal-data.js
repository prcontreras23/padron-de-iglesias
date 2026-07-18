// POST /api/portal-data { token, accion, ...payload }
//   Toda accion exige un token de sesion valido (emitido por /api/portal-auth).
//   El pastor_cod SIEMPRE se toma del token, nunca del cuerpo de la peticion:
//   asi un empleado autenticado jamas puede leer ni escribir datos de otro.
import { cors, sbAdmin, verificarToken } from './_portal_helpers.js';

const MOTIVOS_VALIDOS = ['enfermedad', 'cita_medica', 'asuntos_familiares', 'asuntos_oficiales', 'asuntos_personales'];

async function getPerfil(cod) {
  const r = await sbAdmin(`pastores?cod=eq.${encodeURIComponent(cod)}&select=cod,nombre,email,telefono,zona,distrito,rol,fecha_ingreso`);
  return Array.isArray(r.data) ? r.data[0] : null;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });

  const { token, accion } = req.body || {};
  const cod = verificarToken(token);
  if (!cod) return res.status(401).json({ error: 'Sesion invalida o expirada. Vuelve a iniciar sesion.' });

  try {
    if (accion === 'perfil') {
      const perfil = await getPerfil(cod);
      if (!perfil) return res.status(404).json({ error: 'Empleado no encontrado' });
      const balR = await sbAdmin(`vacaciones_balance?pastor_cod=eq.${encodeURIComponent(cod)}&select=*`);
      return res.status(200).json({ ok: true, perfil, balance: (Array.isArray(balR.data) && balR.data[0]) || null });
    }

    if (accion === 'vacaciones_historial') {
      const r = await sbAdmin(`vacaciones_solicitudes?pastor_cod=eq.${encodeURIComponent(cod)}&select=*&order=fecha_solicitud.desc`);
      if (!r.ok) return res.status(500).json({ error: 'Error al cargar el historial' });
      return res.status(200).json({ ok: true, items: r.data || [] });
    }

    if (accion === 'vacaciones_crear') {
      const { email, celular, semanas, feriados, fecha_inicio, fecha_fin, observaciones, confirmo, firma_data_url } = req.body || {};
      const perfil = await getPerfil(cod);
      if (!perfil) return res.status(404).json({ error: 'Empleado no encontrado' });
      const semanasN = parseInt(semanas) || 0, feriadosN = Math.max(0, parseInt(feriados) || 0);
      if (!email) return res.status(400).json({ error: 'El correo electronico es requerido.' });
      if (!celular) return res.status(400).json({ error: 'El celular es requerido.' });
      if (!semanasN) return res.status(400).json({ error: 'Selecciona cuantas semanas de vacaciones tomaras.' });
      if (!fecha_inicio || !fecha_fin) return res.status(400).json({ error: 'Completa las fechas de salida y entrada.' });
      if (confirmo !== true) return res.status(400).json({ error: 'Debes confirmar la autorizacion antes de enviar la solicitud.' });
      if (!firma_data_url) return res.status(400).json({ error: 'Debes firmar la solicitud.' });
      const dias_solicitados = Math.max(0, semanasN * 7 - feriadosN);
      const autoridad_consultada = perfil.rol === 'oficina' ? 'secretario' : 'presidente';
      const payload = {
        pastor_cod: cod, nombre: perfil.nombre, email, celular,
        fecha_solicitud: new Date().toISOString().slice(0, 10),
        fecha_inicio, fecha_fin, dias_solicitados,
        semanas_solicitadas: semanasN, feriados_periodo: feriadosN,
        confirmo_autorizacion_presidente: true, autoridad_consultada,
        firma_data_url, observaciones: observaciones || null, estado: 'pendiente',
      };
      const ins = await sbAdmin('vacaciones_solicitudes', 'POST', payload);
      if (!ins.ok) return res.status(500).json({ error: 'Error al guardar la solicitud', detail: ins.data });
      return res.status(200).json({ ok: true });
    }

    if (accion === 'permisos_historial') {
      const r = await sbAdmin(`permisos_ausencia?pastor_cod=eq.${encodeURIComponent(cod)}&select=*&order=fecha_solicitud.desc`);
      if (!r.ok) return res.status(500).json({ error: 'Error al cargar el historial' });
      return res.status(200).json({ ok: true, items: r.data || [] });
    }

    if (accion === 'permisos_crear') {
      const { email, motivo, lugar, fecha_ausencia, observaciones } = req.body || {};
      const perfil = await getPerfil(cod);
      if (!perfil) return res.status(404).json({ error: 'Empleado no encontrado' });
      if (!MOTIVOS_VALIDOS.includes(motivo)) return res.status(400).json({ error: 'Motivo invalido.' });
      if (!fecha_ausencia) return res.status(400).json({ error: 'La fecha de ausencia es requerida.' });
      const payload = {
        pastor_cod: cod, nombre: perfil.nombre, email: email || perfil.email || null,
        fecha_solicitud: new Date().toISOString().slice(0, 10), fecha_ausencia,
        motivo, lugar: lugar || null, observaciones: observaciones || null, estado: 'pendiente',
      };
      const ins = await sbAdmin('permisos_ausencia', 'POST', payload);
      if (!ins.ok) return res.status(500).json({ error: 'Error al guardar la solicitud', detail: ins.data });
      return res.status(200).json({ ok: true });
    }

    if (accion === 'organizacion_estado') {
      const perfil = await getPerfil(cod);
      if (!perfil) return res.status(404).json({ error: 'Empleado no encontrado' });
      const r = await sbAdmin(`organizacion_iglesias?pastor_asignado=eq.${encodeURIComponent(perfil.nombre)}&select=*&order=created_at.desc`);
      if (!r.ok) return res.status(500).json({ error: 'Error al cargar la organizacion' });
      return res.status(200).json({ ok: true, items: r.data || [] });
    }

    return res.status(400).json({ error: 'Accion desconocida' });
  } catch (e) {
    return res.status(500).json({ error: 'Error inesperado: ' + e.message });
  }
}
