// POST /api/enviar-permiso-email { id, email }
//   Genera PDF de constancia y lo envía por correo al pastor
import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';
import { cors } from './_helpers2.js';

const SB_URL      = process.env.SUPABASE_URL;
const SB_KEY      = process.env.SUPABASE_ANON_KEY;
const GMAIL_EMAIL = process.env.GMAIL_EMAIL;
const GMAIL_PASS  = process.env.GMAIL_APP_PASSWORD;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_EMAIL, pass: GMAIL_PASS },
});

const motivoLabel = {
  enfermedad:        'Enfermedad',
  cita_medica:       'Cita Médica',
  asuntos_familiares:'Asuntos Familiares',
  asuntos_oficiales: 'Asuntos Oficiales',
  asuntos_personales:'Asuntos Personales',
};

async function generarPDF(permiso) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'letter' });
    let buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Encabezado
    doc.fontSize(24).font('Helvetica-Bold').text('Constancia de Permiso', { align: 'center' });
    doc.fontSize(14).font('Helvetica').text('de Ausencia', { align: 'center' });
    doc.fontSize(11).fillColor('#6b7280').text('Asociación Dominicana del Sureste', { align: 'center' });
    doc.moveTo(50, doc.y + 6).lineTo(550, doc.y + 6).stroke('#1e3564').moveDown();
    doc.moveDown();

    // Contenido
    doc.fillColor('#000000').fontSize(11).font('Helvetica-Bold');

    const addField = (label, value) => {
      doc.fontSize(10).fillColor('#6b7280').text(label.toUpperCase(), { continued: false });
      doc.fontSize(12).fillColor('#1a2340').font('Helvetica-Bold').text(value || '—').moveDown();
    };

    addField('Solicitante', permiso.nombre);
    addField('Motivo', motivoLabel[permiso.motivo] || permiso.motivo);
    addField('Fecha de Ausencia', permiso.fecha_ausencia ? new Date(permiso.fecha_ausencia + 'T12:00:00').toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' }) : '—');

    if (permiso.lugar) {
      addField('Lugar de Destino', permiso.lugar);
    }

    // Estado destacado
    doc.moveDown();
    const estadoColor = { pendiente: '#ca8a04', aprobado: '#16a34a', rechazado: '#dc2626' }[permiso.estado] || '#6b7280';
    const estadoBg = { pendiente: '#fef9c3', aprobado: '#dcfce7', rechazado: '#fee2e2' }[permiso.estado] || '#f3f4f6';
    const estadoLabel = { pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado' }[permiso.estado] || permiso.estado;

    doc.rect(50, doc.y, 500, 50).fillAndStroke(estadoBg, estadoColor);
    doc.fontSize(10).fillColor('#6b7280').text('Estado del Permiso', 60, doc.y + 8);
    doc.fontSize(18).fillColor(estadoColor).font('Helvetica-Bold').text(estadoLabel, 60, doc.y + 2);
    doc.moveDown(3.5);

    doc.moveDown();
    addField('Fecha de Solicitud', permiso.fecha_solicitud ? new Date(permiso.fecha_solicitud + 'T12:00:00').toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' }) : '—');
    addField('Procesado el', new Date().toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' }));

    if (permiso.observaciones) {
      doc.moveDown();
      doc.fontSize(10).fillColor('#6b7280').text('OBSERVACIONES');
      doc.fontSize(11).fillColor('#1a2340').text(permiso.observaciones).moveDown();
    }

    // Firma
    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(250, doc.y).stroke('#1a2340');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica-Bold').text('Secretaría Ejecutiva', { align: 'left' });

    // Footer
    doc.moveDown(3);
    doc.fontSize(9).fillColor('#9ca3af').text('Este es un documento oficial de permiso de ausencia del sistema de la Asociación Dominicana del Sureste.', { align: 'center' });
    doc.fontSize(8).text(`Generado: ${new Date().toLocaleString('es-DO')}`, { align: 'center' });

    doc.end();
  });
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { id, email } = req.body || {};
  if (!id || !email) return res.status(400).json({ error: 'Faltan campos: id, email' });

  try {
    // Obtener permiso de Supabase
    const permRes = await fetch(`${SB_URL}/rest/v1/permisos_ausencia?id=eq.${id}&select=*`, {
      headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` },
    });
    const permisos = await permRes.json();
    if (!permisos.length) return res.status(404).json({ error: 'Permiso no encontrado' });
    const permiso = permisos[0];

    // Generar PDF
    console.log('📄 Generando PDF para:', permiso.nombre);
    const pdfBuffer = await generarPDF(permiso);

    // Enviar por correo
    console.log('📧 Enviando PDF a:', email);
    const mailOptions = {
      from: GMAIL_EMAIL,
      to: email,
      subject: `Constancia de Permiso de Ausencia — ${permiso.nombre} · Asoc. Dom. Sureste`,
      html: `<p>Hola <strong>${permiso.nombre}</strong>,</p>
             <p>Adjunto encontrarás la constancia oficial de tu permiso de ausencia.</p>
             <p>Saludos,<br>Secretaría Ejecutiva<br>Asociación Dominicana del Sureste</p>`,
      attachments: [{
        filename: `Constancia-${permiso.nombre.replace(/\s+/g, '-')}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }],
      replyTo: 'prcontreras@adventistassureste.org',
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ PDF enviado exitosamente a', email, '— id:', info.messageId);
    return res.status(200).json({ ok: true, messageId: info.messageId });
  } catch (e) {
    console.error('❌ Error:', e.message);
    return res.status(500).json({ error: 'Error al enviar correo', detail: e.message });
  }
}
