// POST /api/admin-pin { cod, pin }
//   Establece (o cambia) el PIN de acceso al Portal del Empleado para un pastor/empleado.
//   Requiere sesion de administrador (Authorization: Bearer <access_token> de Supabase Auth).
//   El PIN son 6 digitos; solo se guarda su hash (nunca el PIN en claro).
import { cors, sbAdmin, hashPin, verificarAdmin } from './_portal_helpers.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });

  const auth = req.headers.authorization || '';
  const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const adminId = await verificarAdmin(accessToken);
  if (!adminId) return res.status(403).json({ error: 'No autorizado' });

  const { cod, pin } = req.body || {};
  if (!cod) return res.status(400).json({ error: 'Falta el codigo del empleado' });
  if (!/^\d{6}$/.test(String(pin || ''))) return res.status(400).json({ error: 'El PIN debe ser de exactamente 6 digitos.' });

  const check = await sbAdmin(`pastores?cod=eq.${encodeURIComponent(cod)}&select=cod,nombre`);
  const pastor = Array.isArray(check.data) ? check.data[0] : null;
  if (!check.ok || !pastor) return res.status(404).json({ error: 'Empleado no encontrado' });

  const pin_hash = hashPin(cod, String(pin));
  const upsert = await sbAdmin('pastores_pin', 'POST', {
    pastor_cod: cod, pin_hash, intentos_fallidos: 0, bloqueado_hasta: null,
    creado_por: adminId, updated_at: new Date().toISOString(),
  }, { 'Prefer': 'return=representation,resolution=merge-duplicates' });

  if (!upsert.ok) return res.status(500).json({ error: 'Error al guardar el PIN', detail: upsert.data });
  return res.status(200).json({ ok: true, cod, nombre: pastor.nombre });
}
