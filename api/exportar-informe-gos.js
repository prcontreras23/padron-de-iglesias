// GET /api/exportar-informe-gos?trimestre_id=...
// Header requerido: Authorization: Bearer <access_token de la sesion de Supabase>
// La consulta a Supabase se hace con el JWT del usuario (no la service key),
// para que RLS (fn_mis_asociaciones) siga limitando los datos a lo que ese
// usuario puede ver -- igual que el resto de la app.
import { cors } from './_helpers2.js';
import { construirWorkbookGos } from './_gos-workbook.js';

const SB_URL = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;

async function sbSelect(token, path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_ANON, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Supabase ${path.split('?')[0]}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function getCurrentUser(token) {
  const res = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: SB_ANON, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Token de sesion invalido o expirado');
  return res.json();
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo no permitido' });

  const token = (req.headers.authorization || '').replace(/^Bearer /i, '');
  const trimestreId = req.query.trimestre_id;
  if (!token) return res.status(401).json({ error: 'Falta token de autenticacion' });
  if (!trimestreId) return res.status(400).json({ error: 'Falta trimestre_id' });

  try {
    const [user, trimestres] = await Promise.all([
      getCurrentUser(token),
      sbSelect(token, `gos_trimestres?id=eq.${trimestreId}&select=*`),
    ]);
    const trimestre = trimestres[0];
    if (!trimestre) return res.status(404).json({ error: 'Trimestre no encontrado o sin acceso' });

    const [asociaciones, zonas, distritos, iglesias, pastores, reporte, perfiles] = await Promise.all([
      sbSelect(token, `asociaciones?id=eq.${trimestre.asociacion_id}&select=nombre`),
      sbSelect(token, `zonas?asociacion_id=eq.${trimestre.asociacion_id}&select=cod,nombre&order=cod`),
      sbSelect(token, `distritos?asociacion_id=eq.${trimestre.asociacion_id}&select=cod,nombre,codZona&order=nombre`),
      sbSelect(token, `iglesias?asociacion_id=eq.${trimestre.asociacion_id}&tipo=neq.pendiente_revision&select=cod,nombre,tipo,codZona,codDistrito&order=nombre`),
      sbSelect(token, `pastores?asociacion_id=eq.${trimestre.asociacion_id}&rol=eq.pastor&select=nombre,codDistrito`),
      sbSelect(token, `gos_reporte_iglesia?trimestre_id=eq.${trimestreId}&select=*`),
      sbSelect(token, `profiles?id=eq.${user.id}&select=nombre`),
    ]);

    const wb = construirWorkbookGos({
      trimestre,
      asociacionNombre: asociaciones[0]?.nombre || 'Asociación',
      nombreUsuario: perfiles[0]?.nombre || user.email || '',
      zonas, distritos, iglesias, pastores, reporte,
    });

    const buffer = await wb.xlsx.writeBuffer();
    const nombreArchivo = `Informe_T${trimestre.numero_trimestre}_${trimestre.anio}_ADOSE.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    return res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    console.error('exportar-informe-gos error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
