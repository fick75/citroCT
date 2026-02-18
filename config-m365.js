/**
 * ═══════════════════════════════════════════════════════════════
 * CITRO — Configuración Microsoft 365
 * ⚙️  EDITAR ESTOS VALORES ANTES DE USAR
 * ═══════════════════════════════════════════════════════════════
 */
const CONFIG = {

    // ── AZURE AD ──────────────────────────────────────────────
    azure: {
        // portal.azure.com → App registrations → tu app → Overview
        clientId: a7cf5090-0dbd-4327-8c67-08a11a4a03a5,
    tenantId: 3af6b5a8-d84b-4cfa-9942-c6af8638c3e8
        ,
        scopes: [
            'User.Read',
            'Sites.ReadWrite.All',
            'Calendars.ReadWrite',
            'Mail.Send'
        ]
    },

// ── SHAREPOINT ───────────────────────────────────────────
sharepoint: {
    // URL de tu sitio SharePoint (sin / al final)
    siteUrl: 'https://uvmx.sharepoint.com/sites/CITRO-Fornularios',
        tenant: 'uvmx',          // solo la parte antes de .sharepoint.com
            listName: 'SolicitudesCITRO',  // nombre exacto de la lista
                libraryName: 'PDFs_Solicitudes' // nombre exacto de la biblioteca
},

// ── POWER AUTOMATE (Opcional) ────────────────────────────
powerAutomate: {
    // URL del trigger HTTP del flujo (dejar vacío si no se usa)
    flowUrl: ''
},

// ── ADMINISTRADORES ──────────────────────────────────────
// Emails que tendrán acceso al Panel de Administración
admins: [
    'admin@uv.mx',          // ← Cambiar por emails reales
    'director.citro@uv.mx'
],

    // ── INSTITUCIÓN ──────────────────────────────────────────
    institucion: {
    nombre: 'Centro de Investigaciones Tropicales (CITRO)',
        nombreCorto: 'CITRO',
            universidad: 'Universidad Veracruzana',
                email: 'citro@uv.mx',
                    sitio: 'https://citrouv.com',
                        ciudad: 'Xalapa, Veracruz, México'
},

// ── EMAIL ────────────────────────────────────────────────
email: {
    adminEmail: 'consejo.tecnico@uv.mx',
        enviarConfirmacion: true
},

// ── OPCIONES ─────────────────────────────────────────────
options: {
    soloUV: false,        // true = solo permite @uv.mx
        dominioPermitido: 'uv.mx',
            debug: false
}
};
