// Construye el workbook ExcelJS del Informe Estadistico GOS (formato oficial
// con colores/negritas, numeracion secuencial de distritos, IGLESIAS/GRUPOS
// separados). Separado de exportar-informe-gos.js para poder probarlo con
// datos de ejemplo sin depender de Supabase ni de una petición HTTP real.
import ExcelJS from 'exceljs';

const COLOR = {
  azulOscuro: 'FF0D2B5E',
  azulMedio: 'FF1A4F8A',
  verdeFondo: 'FF1E7D22',
  rojoFondo: 'FF8B0000',
  gris: 'FF4A4A4A',
  verdeTexto: 'FF1A7C1A',
  blanco: 'FFFFFFFF',
  negro: 'FF000000',
};
const NUMFMT = '#,##0;(#,##0);\\-';
const ORDINAL = { 1: '1er', 2: '2do', 3: '3er', 4: '4to' };
const COL_WIDTHS = [1.66, 2, 49.16, 7.66, 7.5, 9.83, 7.33, 7, 7.83, 6.5, 8.5, 4.5, 7.16];

function fechaDDMMYYYY(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** pastores.nombre se guarda como "Apellido, Nombre"; el informe lo muestra "Nombre Apellido". */
function nombreEnOrden(nombre) {
  if (!nombre || !nombre.includes(',')) return nombre;
  const [apellido, resto] = nombre.split(',').map(s => s.trim());
  return `${resto} ${apellido}`;
}

/**
 * @param {object} datos
 * @param {object} datos.trimestre - { anio, numero_trimestre, fecha_corte }
 * @param {string} datos.asociacionNombre
 * @param {string} datos.nombreUsuario
 * @param {Array}  datos.zonas - { cod, nombre }
 * @param {Array}  datos.distritos - { cod, nombre, codZona }
 * @param {Array}  datos.iglesias - { cod, nombre, tipo, codDistrito }
 * @param {Array}  datos.pastores - { nombre, codDistrito } (solo rol=pastor)
 * @param {Array}  datos.reporte - filas de gos_reporte_iglesia (iglesia_cod, membresia_inicial, bautismos, prof_fe, t_entrada, t_salida, apostasia, muerte, paradero, ajuste, total)
 * @returns {ExcelJS.Workbook}
 */
export function construirWorkbookGos(datos) {
  const { trimestre, asociacionNombre, nombreUsuario, zonas, distritos, iglesias, pastores, reporte } = datos;
  const ordinal = ORDINAL[trimestre.numero_trimestre] || `${trimestre.numero_trimestre}o`;

  const reportePorCod = new Map(reporte.map(r => [r.iglesia_cod, r]));
  const pastorPorDistrito = new Map(pastores.map(p => [p.codDistrito, p.nombre]));

  const filaDe = (igl) => {
    const r = reportePorCod.get(igl.cod);
    const membresiaInicial = r?.membresia_inicial ?? 0;
    return {
      cod: igl.cod, nombre: igl.nombre, tipo: igl.tipo || 'iglesia',
      membresiaInicial,
      bautismos: r?.bautismos ?? 0, profFe: r?.prof_fe ?? 0, tEntrada: r?.t_entrada ?? 0,
      tSalida: r?.t_salida ?? 0, apostasia: r?.apostasia ?? 0, muerte: r?.muerte ?? 0,
      paradero: r?.paradero ?? 0, ajuste: r?.ajuste ?? 0,
      total: r?.total ?? membresiaInicial,
    };
  };
  const sumar = (list) => list.reduce((acc, f) => ({
    membresiaInicial: acc.membresiaInicial + f.membresiaInicial, bautismos: acc.bautismos + f.bautismos,
    profFe: acc.profFe + f.profFe, tEntrada: acc.tEntrada + f.tEntrada, tSalida: acc.tSalida + f.tSalida,
    apostasia: acc.apostasia + f.apostasia, muerte: acc.muerte + f.muerte, paradero: acc.paradero + f.paradero,
    ajuste: acc.ajuste + f.ajuste, total: acc.total + f.total,
  }), { membresiaInicial: 0, bautismos: 0, profFe: 0, tEntrada: 0, tSalida: 0, apostasia: 0, muerte: 0, paradero: 0, ajuste: 0, total: 0 });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Informe ${trimestre.numero_trimestre}T-${trimestre.anio}`, {
    pageSetup: { orientation: 'portrait', margins: { left: 0.2, right: 0.2, top: 0.2, bottom: 0.2, header: 0, footer: 0 } },
  });
  ws.columns = COL_WIDTHS.map(width => ({ width }));

  const setRow = (r, valores) => {
    for (const [col, val] of Object.entries(valores)) {
      ws.getCell(r, Number(col)).value = val;
    }
  };

  let fila = 1;

  // Titulo (filas 1-4)
  ws.mergeCells(1, 1, 1, 13);
  ws.getCell(1, 1).value = asociacionNombre.toUpperCase();
  ws.getCell(1, 1).font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLOR.blanco } };
  ws.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.azulOscuro } };
  ws.getCell(1, 1).alignment = { horizontal: 'center' };

  ws.mergeCells(2, 1, 2, 13);
  ws.getCell(2, 1).value = `INFORME ESTADÍSTICO — ${ordinal} TRIMESTRE ${trimestre.anio}`;
  ws.getCell(2, 1).font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLOR.blanco } };
  ws.getCell(2, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.azulMedio } };
  ws.getCell(2, 1).alignment = { horizontal: 'center' };

  ws.mergeCells(3, 1, 3, 13);
  ws.getCell(3, 1).value = `Trimestre que termina: el ${fechaDDMMYYYY(trimestre.fecha_corte)}`;
  ws.getCell(3, 1).font = { name: 'Calibri', size: 9, color: { argb: COLOR.azulOscuro } };
  ws.getCell(3, 1).alignment = { horizontal: 'center' };

  ws.mergeCells(4, 1, 4, 13);
  const hoy = new Date();
  const hoyStr = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
  ws.getCell(4, 1).value = `Preparado el ${hoyStr}  |  Pr. ${nombreUsuario} — Secretario Ejecutivo`;
  ws.getCell(4, 1).font = { name: 'Calibri', size: 9, italic: true, color: { argb: COLOR.azulOscuro } };
  ws.getCell(4, 1).alignment = { horizontal: 'center' };
  ws.getCell(4, 1).border = { bottom: { style: 'thin' } };

  fila = 6;
  let contadorDistrito = 0;
  const totalesGenerales = [];

  for (const zona of zonas) {
    const distritosZona = distritos.filter(d => d.codZona === zona.cod);
    const distritosConIglesias = distritosZona
      .map(d => ({ ...d, iglesias: iglesias.filter(i => i.codDistrito === d.cod) }))
      .filter(d => d.iglesias.length > 0);
    if (!distritosConIglesias.length) continue;

    // Encabezado de zona
    ws.getCell(fila, 3).value = zona.nombre;
    ws.getCell(fila, 3).font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLOR.blanco } };
    ws.getCell(fila, 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.azulOscuro } };
    ws.mergeCells(fila, 5, fila, 7);
    ws.getCell(fila, 5).value = 'Añadidos en el trimestre';
    ws.getCell(fila, 5).font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLOR.blanco } };
    ws.getCell(fila, 5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.verdeFondo } };
    ws.getCell(fila, 5).alignment = { horizontal: 'center' };
    ws.getCell(fila, 5).border = { bottom: { style: 'thin' } };
    ws.mergeCells(fila, 8, fila, 11);
    ws.getCell(fila, 8).value = 'Despedidos en el trimestre';
    ws.getCell(fila, 8).font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLOR.blanco } };
    ws.getCell(fila, 8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.rojoFondo } };
    ws.getCell(fila, 8).alignment = { horizontal: 'center' };
    ws.getCell(fila, 8).border = { bottom: { style: 'thin' } };
    ws.getCell(fila, 13).value = 'Al final';
    ws.getCell(fila, 13).font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLOR.blanco } };
    ws.getCell(fila, 13).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.azulOscuro } };
    ws.getCell(fila, 13).alignment = { horizontal: 'center' };
    fila++;

    // Encabezado de columnas
    const headers = ['I', 'G', 'IGLESIA / GRUPO', 'Al inicio', 'Bautismos', 'Prof. de Fe', 'T. Entrada', 'T. Salida', 'Apostasía', 'Muerte', 'Parad./Des.', 'Ajuste', 'TOTAL'];
    headers.forEach((h, idx) => {
      const cell = ws.getCell(fila, idx + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLOR.blanco } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.gris } };
      cell.alignment = { horizontal: idx === 2 ? 'left' : 'center', vertical: 'center' };
      cell.border = { bottom: { style: 'thin' } };
    });
    fila++;

    const filasZona = [];
    distritosConIglesias.forEach((distrito, idxDistrito) => {
      contadorDistrito++;
      const iglesiasDistrito = distrito.iglesias.filter(i => i.tipo === 'iglesia').map(filaDe);
      const gruposDistrito = distrito.iglesias.filter(i => i.tipo === 'grupo').map(filaDe);
      const todasDistrito = [...iglesiasDistrito, ...gruposDistrito];
      const totalDistrito = sumar(todasDistrito);
      filasZona.push(...todasDistrito);

      const pastorNombre = nombreEnOrden(pastorPorDistrito.get(distrito.cod)) || 'sin asignar';
      const filaDistritoIdx = fila;
      setRow(filaDistritoIdx, {
        3: `DISTRITO #${contadorDistrito} ${distrito.nombre.toUpperCase()} (Pr. ${pastorNombre})`,
        4: totalDistrito.membresiaInicial, 5: totalDistrito.bautismos, 6: totalDistrito.profFe,
        7: totalDistrito.tEntrada, 8: totalDistrito.tSalida, 9: totalDistrito.apostasia,
        10: totalDistrito.muerte, 11: totalDistrito.paradero, 12: totalDistrito.ajuste, 13: totalDistrito.total,
      });
      for (let c = 3; c <= 13; c++) {
        const cell = ws.getCell(filaDistritoIdx, c);
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLOR.blanco } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.azulMedio } };
        cell.alignment = c === 3 ? { horizontal: 'left' } : { horizontal: 'center' };
        cell.border = { bottom: { style: 'thin' } };
        if (c >= 4) cell.numFmt = NUMFMT;
      }
      fila++;

      const escribirSeccion = (titulo, filasSeccion, marcador) => {
        if (!filasSeccion.length) return;
        const cSub = ws.getCell(fila, 3);
        cSub.value = titulo;
        cSub.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLOR.verdeTexto } };
        cSub.border = { bottom: { style: 'thin' } };
        fila++;
        for (const f of filasSeccion) {
          const marcCell = ws.getCell(fila, marcador === 'A' ? 1 : 2);
          marcCell.value = 1;
          marcCell.font = { name: 'Calibri', size: 9, color: { argb: COLOR.negro } };
          marcCell.alignment = { horizontal: 'center' };
          marcCell.border = { bottom: { style: 'thin' } };

          ws.getCell(fila, 3).value = f.nombre;
          const valores = { 4: f.membresiaInicial, 5: f.bautismos, 6: f.profFe, 7: f.tEntrada, 8: f.tSalida, 9: f.apostasia, 10: f.muerte, 11: f.paradero, 13: f.total };
          if (f.ajuste) valores[12] = f.ajuste;
          for (const [col, val] of Object.entries(valores)) {
            ws.getCell(fila, Number(col)).value = val;
          }
          for (let c = 3; c <= 13; c++) {
            const cell = ws.getCell(fila, c);
            cell.font = { name: 'Calibri', size: 9, color: { argb: COLOR.negro } };
            cell.alignment = c === 3 ? {} : { horizontal: 'center' };
            cell.border = { bottom: { style: 'thin' } };
            if (c >= 4) cell.numFmt = NUMFMT;
          }
          fila++;
        }
      };
      escribirSeccion('IGLESIAS', iglesiasDistrito, 'A');
      escribirSeccion('GRUPOS', gruposDistrito, 'B');

      if (idxDistrito < distritosConIglesias.length - 1) fila++; // fila en blanco entre distritos
    });

    const totalZona = sumar(filasZona);
    totalesGenerales.push(...filasZona);
    setRow(fila, {
      3: `Total ${zona.nombre.toUpperCase().startsWith('ZONA') ? zona.nombre : 'ZONA ' + zona.nombre}`,
      4: totalZona.membresiaInicial, 5: totalZona.bautismos, 6: totalZona.profFe, 7: totalZona.tEntrada,
      8: totalZona.tSalida, 9: totalZona.apostasia, 10: totalZona.muerte, 11: totalZona.paradero,
      12: totalZona.ajuste, 13: totalZona.total,
    });
    for (let c = 3; c <= 13; c++) {
      const cell = ws.getCell(fila, c);
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLOR.blanco } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.azulOscuro } };
      cell.alignment = { horizontal: 'center' };
      cell.border = { bottom: { style: 'thin' } };
      if (c >= 4) cell.numFmt = NUMFMT;
    }
    fila += 3; // 2 filas en blanco antes de la siguiente zona
  }

  // Total general
  fila -= 1; // quitar una fila en blanco sobrante tras la ultima zona
  const totalGeneral = sumar(totalesGenerales);
  setRow(fila, {
    3: `TOTAL GENERAL — ${asociacionNombre.toUpperCase()} ${ordinal} TRIMESTRE ${trimestre.anio}`,
    4: totalGeneral.membresiaInicial, 5: totalGeneral.bautismos, 6: totalGeneral.profFe, 7: totalGeneral.tEntrada,
    8: totalGeneral.tSalida, 9: totalGeneral.apostasia, 10: totalGeneral.muerte, 11: totalGeneral.paradero,
    12: totalGeneral.ajuste, 13: totalGeneral.total,
  });
  for (let c = 3; c <= 13; c++) {
    const cell = ws.getCell(fila, c);
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLOR.blanco } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.azulOscuro } };
    cell.alignment = { horizontal: 'center' };
    cell.border = { bottom: { style: 'thin' } };
    if (c >= 4) cell.numFmt = NUMFMT;
  }
  fila += 2;

  // Resumen
  ws.mergeCells(fila, 1, fila, 13);
  ws.getCell(fila, 1).value = `RESUMEN — ${asociacionNombre.toUpperCase()} ${ordinal} TRIMESTRE ${trimestre.anio}`;
  ws.getCell(fila, 1).font = { name: 'Calibri', size: 9, color: { argb: COLOR.negro } };
  ws.getCell(fila, 1).alignment = { horizontal: 'center' };
  ws.getCell(fila, 1).border = { bottom: { style: 'thin' } };
  fila++;

  const nIglesias = iglesias.filter(i => i.tipo === 'iglesia').length;
  const nGrupos = iglesias.filter(i => i.tipo === 'grupo').length;
  const resumenFilas = [
    ['Distritos', contadorDistrito],
    ['Iglesias', nIglesias],
    ['Grupos', nGrupos],
    ['TOTAL', nIglesias + nGrupos],
  ];
  resumenFilas.forEach(([label, val], idx) => {
    const esUltima = idx === resumenFilas.length - 1;
    ws.getCell(fila, 5).value = label;
    ws.getCell(fila, 5).font = { name: 'Calibri', size: 9, bold: esUltima, color: { argb: COLOR.negro } };
    ws.getCell(fila, 5).border = { bottom: { style: 'thin' } };
    ws.getCell(fila, 6).value = val;
    ws.getCell(fila, 6).font = { name: 'Calibri', size: 9, bold: esUltima, color: { argb: COLOR.negro } };
    ws.getCell(fila, 6).alignment = { horizontal: 'left' };
    ws.getCell(fila, 6).numFmt = NUMFMT;
    ws.getCell(fila, 6).border = { bottom: { style: 'thin' } };
    fila++;
  });

  return wb;
}
