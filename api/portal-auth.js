// POST /api/portal-auth { cod, pin }
//   Verifica el codigo de empleado + PIN de 6 digitos. Nunca expone datos de otros
//   empleados. Devuelve un token de sesion (45 min) + perfil seguro.
import { cors, sbAdmin, firmarToken } from './_portal_helpers.js';

const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;
const ERROR_GENERICO = { error: 'Codigo o PIN incorrecto.' };

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });

  const { cod, pin } = req.body || {};
  if (!cod || !pin || !/^\d{6}$/.test(String(pin))) return res.status(400).json(ERROR_GENERICO);

  const pinRes = await sbAdmin(`pastores_pin?pastor_cod=eq.${encodeURIComponent(cod)}&select=*`);
  const registro = Array.isArray(pinRes.data) ? pinRes.data[0] : null;
  if (!pinRes.ok || !registro) return res.status(401).json(ERROR_GENERICO);

  if (registro.bloqueado_hasta && new Date(registro.bloqueado_hasta) > new Date()) {
    const min = Math.ceil((new Date(registro.bloqueado_hasta) - new Date()) / 60000);
    return res.status(429).json({ error: `Demasiados intentos fallidos. Intenta de nuevo en ${min} minuto(s).` });
  }

  if (String(pin) !== String(registro.pin)) {
    const intentos = (registro.intentos_fallidos || 0) + 1;
    const patch = { intentos_fallidos: intentos, updated_at: new Date().toISOString() };
    if (intentos >= MAX_INTENTOS) {
      patch.bloqueado_hasta = new Date(Date.now() + BLOQUEO_MINUTOS * 60 * 1000).toISOString();
      patch.intentos_fallidos = 0;
    }
    await sbAdmin(`pastores_pin?pastor_cod=eq.${encodeURIComponent(cod)}`, 'PATCH', patch);
    return res.status(401).json(ERROR_GENERICO);
  }

  // Exito: limpiar intentos y devolver token + perfil seguro (sin el hash)
  await sbAdmin(`pastores_pin?pastor_cod=eq.${encodeURIComponent(cod)}`, 'PATCH', {
    intentos_fallidos: 0, bloqueado_hasta: null, updated_at: new Date().toISOString(),
  });

  const perfilRes = await sbAdmin(`pastores?cod=eq.${encodeURIComponent(cod)}&select=cod,nombre,email,telefono,zona,distrito,rol,fecha_ingreso`);
  const perfil = Array.isArray(perfilRes.data) ? perfilRes.data[0] : null;
  if (!perfilRes.ok || !perfil) return res.status(401).json(ERROR_GENERICO);

  const token = firmarToken(cod);
  return res.status(200).json({ ok: true, token, perfil });
}
