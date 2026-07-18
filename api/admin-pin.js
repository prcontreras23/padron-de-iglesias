// POST /api/admin-pin  (requiere sesion de administrador)
//   { accion:'list' }               -> lista de todos los empleados con su PIN (visible)
//   { accion:'set', cod, pin }      -> fija/cambia el PIN de 6 digitos de un empleado
//   { accion:'generar_faltantes' }  -> crea PIN a todos los que no tienen (nacimiento MMAAAA o aleatorio)
//   { accion:'regenerar_todos' }    -> regenera el PIN de TODOS (nacimiento MMAAAA o aleatorio)
// El PIN se guarda legible en pastores_pin, tabla sin acceso publico (solo backend/admin).
import { cors, sbAdmin, generarPin, verificarAdmin } from './_portal_helpers.js';

function pinPorDefecto(fecha_nacimiento) {
  if (fecha_nacimiento && /^\d{4}-\d{2}-\d{2}/.test(fecha_nacimiento)) {
    const [y, m] = fecha_nacimiento.split('-');
    return `${m}${y}`; // MMAAAA
  }
  return generarPin();
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });

  const auth = req.headers.authorization || '';
  const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const adminId = await verificarAdmin(accessToken);
  if (!adminId) return res.status(403).json({ error: 'No autorizado' });

  const { accion } = req.body || {};

  // ── Listar todos los accesos ──────────────────────────────────────────────
  if (accion === 'list') {
    const pRes = await sbAdmin('pastores?select=cod,nombre,rol,zona,fecha_nacimiento&order=nombre');
    const pinRes = await sbAdmin('pastores_pin?select=pastor_cod,pin,bloqueado_hasta');
    if (!pRes.ok) return res.status(500).json({ error: 'Error al cargar el personal' });
    const pinMap = {};
    (Array.isArray(pinRes.data) ? pinRes.data : []).forEach(x => { pinMap[x.pastor_cod] = x; });
    const items = (pRes.data || []).map(p => {
      const r = pinMap[p.cod];
      return {
        cod: p.cod, nombre: p.nombre, rol: p.rol, zona: p.zona,
        pin: r ? r.pin : null,
        bloqueado: !!(r && r.bloqueado_hasta && new Date(r.bloqueado_hasta) > new Date()),
        nacimiento: !!p.fecha_nacimiento,
      };
    });
    return res.status(200).json({ ok: true, items });
  }

  // ── Fijar/cambiar un PIN ──────────────────────────────────────────────────
  if (accion === 'set') {
    const { cod, pin } = req.body || {};
    if (!cod) return res.status(400).json({ error: 'Falta el codigo del empleado' });
    if (!/^\d{6}$/.test(String(pin || ''))) return res.status(400).json({ error: 'El PIN debe ser de exactamente 6 digitos.' });
    const check = await sbAdmin(`pastores?cod=eq.${encodeURIComponent(cod)}&select=cod`);
    if (!check.ok || !(Array.isArray(check.data) && check.data[0])) return res.status(404).json({ error: 'Empleado no encontrado' });
    const up = await sbAdmin('pastores_pin', 'POST', {
      pastor_cod: cod, pin: String(pin), intentos_fallidos: 0, bloqueado_hasta: null,
      creado_por: adminId, updated_at: new Date().toISOString(),
    }, { 'Prefer': 'return=minimal,resolution=merge-duplicates' });
    if (!up.ok) return res.status(500).json({ error: 'Error al guardar el PIN', detail: up.data });
    return res.status(200).json({ ok: true, cod, pin: String(pin) });
  }

  // ── Generar PIN a los que no tienen / regenerar todos ─────────────────────
  if (accion === 'generar_faltantes' || accion === 'regenerar_todos') {
    const pRes = await sbAdmin('pastores?select=cod,fecha_nacimiento');
    if (!pRes.ok) return res.status(500).json({ error: 'Error al cargar el personal' });
    let objetivo = pRes.data || [];
    if (accion === 'generar_faltantes') {
      const pinRes = await sbAdmin('pastores_pin?select=pastor_cod');
      const conPin = new Set((Array.isArray(pinRes.data) ? pinRes.data : []).map(x => x.pastor_cod));
      objetivo = objetivo.filter(p => !conPin.has(p.cod));
    }
    if (!objetivo.length) return res.status(200).json({ ok: true, generados: 0 });
    const ahora = new Date().toISOString();
    const filas = objetivo.map(p => ({
      pastor_cod: p.cod, pin: pinPorDefecto(p.fecha_nacimiento),
      intentos_fallidos: 0, bloqueado_hasta: null, creado_por: adminId, updated_at: ahora,
    }));
    const up = await sbAdmin('pastores_pin', 'POST', filas, { 'Prefer': 'return=minimal,resolution=merge-duplicates' });
    if (!up.ok) return res.status(500).json({ error: 'Error al generar los PINs', detail: up.data });
    return res.status(200).json({ ok: true, generados: filas.length });
  }

  return res.status(400).json({ error: 'Accion desconocida' });
}
