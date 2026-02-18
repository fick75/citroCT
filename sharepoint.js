/**
 * CITRO — SharePoint + Graph API
 * Reemplaza Google Drive/Sheets → SharePoint Lists/Libraries
 */
const GRAPH = 'https://graph.microsoft.com/v1.0';
let _siteId = null;

async function callGraph(endpoint, method='GET', body=null) {
    const tok = await getAccessToken();
    const opt = { method, headers:{ Authorization:`Bearer ${tok}`, 'Content-Type':'application/json', Accept:'application/json' } };
    if (body) opt.body = JSON.stringify(body);
    const r = await fetch(`${GRAPH}${endpoint}`, opt);
    if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.error?.message||`Graph ${r.status}`); }
    return r.status===204 ? null : r.json();
}

async function getSiteId() {
    if (_siteId) return _siteId;
    const u = new URL(CONFIG.sharepoint.siteUrl);
    const d = await callGraph(`/sites/${u.hostname}:${u.pathname}`);
    _siteId = d.id;
    return _siteId;
}

// ── CREAR SOLICITUD ───────────────────────────────────────────
async function createSolicitudEnSharePoint(sol) {
    const siteId = await getSiteId();
    const fd = sol.formData;
    const fields = {
        Title:              sol.folio,
        Folio:              sol.folio,
        TipoTramite:        sol.tipo,
        NombreSolicitante:  fd.nombre_completo||fd.nombre_estudiante||fd.nombre_solicitante||'',
        EmailSolicitante:   fd.correo||fd.correo_solicitante||userState.profile.email,
        EmailUsuarioM365:   userState.profile.email,
        Matricula:          fd.matricula||'',
        MontoSolicitado:    parseFloat(fd.monto_total||0),
        MontoAutorizado:    0,
        Estado:             'Pendiente',
        DatosCompletos:     JSON.stringify(fd),
        FechaSolicitud:     new Date().toISOString(),
        NotasCT:            '',
        URLPdf:             ''
    };
    return callGraph(`/sites/${siteId}/lists/${CONFIG.sharepoint.listName}/items`, 'POST', { fields });
}

// ── SUBIR PDF ─────────────────────────────────────────────────
async function uploadPDFToSharePoint(pdfBlob, folio, tipo) {
    const siteId = await getSiteId();
    const carpetas = {
        apoyo_academico:'01_Apoyo_Academico', aval_institucional:'02_Aval_Institucional',
        apoyo_terceros:'03_Apoyo_Terceros',   comite_tutorial:'04_Comite_Tutorial',
        solicitud_libre:'05_Solicitud_Libre'
    };
    const carpeta = carpetas[tipo]||'06_Otros';
    const fileName = `${folio}.pdf`;
    const tok = await getAccessToken();
    const ab  = await pdfBlob.arrayBuffer();
    const r = await fetch(
        `${GRAPH}/sites/${siteId}/drive/root:/${CONFIG.sharepoint.libraryName}/${carpeta}/${fileName}:/content`,
        { method:'PUT', headers:{ Authorization:`Bearer ${tok}`, 'Content-Type':'application/pdf' }, body:ab }
    );
    if (!r.ok) throw new Error('Error subiendo PDF');
    return (await r.json()).webUrl||null;
}

// ── ACTUALIZAR ITEM (Admin) ────────────────────────────────────
async function updateSolicitudEnSharePoint(itemId, updates) {
    const siteId = await getSiteId();
    const fields = {};
    if (updates.estado!==undefined)          fields.Estado          = updates.estado;
    if (updates.montoAutorizado!==undefined) fields.MontoAutorizado = parseFloat(updates.montoAutorizado||0);
    if (updates.notasCT!==undefined)         fields.NotasCT         = updates.notasCT;
    return callGraph(`/sites/${siteId}/lists/${CONFIG.sharepoint.listName}/items/${itemId}/fields`, 'PATCH', fields);
}

// ── OBTENER SOLICITUDES USUARIO ────────────────────────────────
async function getSolicitudesUsuario() {
    const siteId = await getSiteId();
    const email  = userState.profile.email;
    const data   = await callGraph(
        `/sites/${siteId}/lists/${CONFIG.sharepoint.listName}/items?`+
        `$filter=fields/EmailUsuarioM365 eq '${email}'&$select=id,fields&$expand=fields&$orderby=fields/FechaSolicitud desc`
    );
    return (data.value||[]).map(i=>({ spId:i.id, ...i.fields }));
}

// ── OBTENER TODAS (Admin) ─────────────────────────────────────
async function getAllSolicitudes() {
    const siteId = await getSiteId();
    const data   = await callGraph(
        `/sites/${siteId}/lists/${CONFIG.sharepoint.listName}/items?`+
        `$select=id,fields&$expand=fields&$orderby=fields/FechaSolicitud desc&$top=500`
    );
    return (data.value||[]).map(i=>({ spId:i.id, ...i.fields }));
}

// ── ENVIAR EMAIL vía Graph ─────────────────────────────────────
async function sendEmailViaGraph(to, subject, htmlBody) {
    await callGraph('/me/sendMail', 'POST', {
        message: {
            subject,
            body: { contentType:'HTML', content:htmlBody },
            toRecipients: [{ emailAddress:{ address:to } }]
        },
        saveToSentItems: true
    });
}

// ── TEMPLATES DE EMAIL ────────────────────────────────────────
function buildConfirmationEmailHTML(fd, folio, tipo, pdfUrl) {
    const nombre   = fd.nombre_completo||fd.nombre_estudiante||fd.nombre_solicitante||'Usuario';
    const tipoNom  = FORMS_CONFIG[tipo]?.title||tipo;
    const fecha    = new Date().toLocaleDateString('es-MX',{dateStyle:'full'});
    return `<div style="font-family:Segoe UI,sans-serif;max-width:600px;margin:0 auto;border:1px solid #EDEBE9;border-radius:8px;overflow:hidden">
        <div style="background:#0078D4;padding:28px;text-align:center"><h1 style="color:#fff;margin:0;font-size:20px">✅ Solicitud Recibida</h1><p style="color:#c7e3ff;margin:6px 0 0">CITRO — Universidad Veracruzana</p></div>
        <div style="padding:28px"><p>Estimado/a <strong>${nombre}</strong>,</p><p style="color:#605E5C;line-height:1.6">Su solicitud fue registrada en el <strong>Centro de Investigaciones Tropicales (CITRO)</strong>.</p>
        <div style="background:#EBF3FB;border-left:4px solid #0078D4;padding:18px;border-radius:0 6px 6px 0;margin:20px 0">
            <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 0;font-weight:600;color:#605E5C;width:40%">Folio:</td><td style="color:#0078D4;font-weight:700">${folio}</td></tr>
            <tr><td style="padding:6px 0;font-weight:600;color:#605E5C">Tipo:</td><td>${tipoNom}</td></tr>
            <tr><td style="padding:6px 0;font-weight:600;color:#605E5C">Fecha:</td><td>${fecha}</td></tr>
            <tr><td style="padding:6px 0;font-weight:600;color:#605E5C">Estado:</td><td><span style="background:#FFF4CE;color:#7A4F01;padding:2px 10px;border-radius:10px;font-size:13px">⏳ Pendiente</span></td></tr>
            </table></div>
        ${pdfUrl?`<p style="text-align:center"><a href="${pdfUrl}" style="background:#0078D4;color:#fff;padding:11px 24px;text-decoration:none;border-radius:4px;font-weight:600;display:inline-block">📄 Ver documento en SharePoint</a></p>`:''}
        <p style="color:#605E5C;line-height:1.6">El <strong>H. Consejo Técnico del CITRO</strong> revisará su solicitud. Recibirá una notificación por correo con la resolución.</p></div>
        <div style="background:#FAF9F8;padding:16px;text-align:center;border-top:1px solid #EDEBE9"><p style="margin:0;font-size:12px;color:#888">CITRO · Universidad Veracruzana · Mensaje automático</p></div></div>`;
}

function buildAdminNotificationHTML(fd, folio, tipo, pdfUrl) {
    const nombre  = fd.nombre_completo||fd.nombre_estudiante||fd.nombre_solicitante||'—';
    const email   = fd.correo||fd.correo_solicitante||userState.profile.email;
    const monto   = fd.monto_total?`$${parseFloat(fd.monto_total).toLocaleString('es-MX')} MXN`:'Sin monto';
    const tipoNom = FORMS_CONFIG[tipo]?.title||tipo;
    return `<div style="font-family:Segoe UI,sans-serif;max-width:580px;margin:0 auto;border:1px solid #EDEBE9;border-radius:8px;overflow:hidden">
        <div style="background:#107C10;padding:22px"><h2 style="color:#fff;margin:0;font-size:18px">📬 Nueva Solicitud CITRO</h2></div>
        <div style="padding:24px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr style="background:#F3F2F1"><td style="padding:9px 12px;font-weight:600;width:40%">Folio</td><td style="padding:9px 12px;font-weight:700;color:#0078D4">${folio}</td></tr>
        <tr><td style="padding:9px 12px;font-weight:600">Tipo</td><td style="padding:9px 12px">${tipoNom}</td></tr>
        <tr style="background:#F3F2F1"><td style="padding:9px 12px;font-weight:600">Solicitante</td><td style="padding:9px 12px">${nombre}</td></tr>
        <tr><td style="padding:9px 12px;font-weight:600">Email</td><td style="padding:9px 12px"><a href="mailto:${email}">${email}</a></td></tr>
        <tr style="background:#F3F2F1"><td style="padding:9px 12px;font-weight:600">Monto Solicitado</td><td style="padding:9px 12px">${monto}</td></tr>
        <tr><td style="padding:9px 12px;font-weight:600">Fecha</td><td style="padding:9px 12px">${new Date().toLocaleString('es-MX')}</td></tr>
        </table>
        ${pdfUrl?`<p style="margin-top:20px"><a href="${pdfUrl}" style="background:#0078D4;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;font-weight:600">Ver PDF en SharePoint →</a></p>`:''}
        <details style="margin-top:16px;font-size:12px"><summary style="cursor:pointer;color:#0078D4;font-weight:600">Ver datos completos</summary><pre style="background:#F3F2F1;padding:12px;border-radius:4px;overflow:auto;margin-top:8px">${JSON.stringify(fd,null,2)}</pre></details>
        </div></div>`;
}
