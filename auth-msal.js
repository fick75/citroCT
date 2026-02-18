/**
 * CITRO — Autenticación Microsoft (MSAL 2.x)
 */
const userState = { isLoggedIn:false, isAdmin:false, account:null, token:null, profile:null };
let msalApp = null;

function initMSAL() {
    msalApp = new msal.PublicClientApplication({
        auth: {
            clientId:  CONFIG.azure.clientId,
            authority: `https://login.microsoftonline.com/${CONFIG.azure.tenantId}`,
            redirectUri: window.location.href.split('?')[0].split('#')[0]
        },
        cache: { cacheLocation:'sessionStorage', storeAuthStateInCookie:false }
    });
    msalApp.handleRedirectPromise()
        .then(r => r ? handleLoginSuccess(r) : tryRestoreSession())
        .catch(e => console.error('MSAL',e));
}

function tryRestoreSession() {
    const accs = msalApp.getAllAccounts();
    if (accs.length > 0) { msalApp.setActiveAccount(accs[0]); loadProfile(accs[0]); }
    else document.getElementById('login-required-banner').style.display = 'flex';
}

async function signInWithMicrosoft() {
    try {
        const r = await msalApp.loginPopup({ scopes:CONFIG.azure.scopes, prompt:'select_account' });
        handleLoginSuccess(r);
    } catch(e) { if (e.errorCode !== 'user_cancelled') alert('Error login: '+e.message); }
}

async function handleLoginSuccess(resp) {
    msalApp.setActiveAccount(resp.account);
    await loadProfile(resp.account);
}

async function loadProfile(account) {
    try {
        const tok = await getTokenSilently();
        const me  = await fetch('https://graph.microsoft.com/v1.0/me',
            { headers:{ Authorization:`Bearer ${tok}` } }).then(r=>r.json());
        userState.isLoggedIn = true;
        userState.account    = account;
        userState.token      = tok;
        userState.profile    = {
            id:        me.id,
            nombre:    me.displayName,
            givenName: me.givenName || me.displayName.split(' ')[0],
            email:     me.mail || me.userPrincipalName,
            initials:  getInitials(me.displayName)
        };
        userState.isAdmin = CONFIG.admins.map(e=>e.toLowerCase()).includes(userState.profile.email.toLowerCase());
        if (CONFIG.options.soloUV) {
            if (userState.profile.email.split('@')[1] !== CONFIG.options.dominioPermitido) {
                alert(`Solo cuentas @${CONFIG.options.dominioPermitido}`);
                signOutMicrosoft(); return;
            }
        }
        updateUILoggedIn();
    } catch(e) { console.error('loadProfile',e); }
}

async function signOutMicrosoft() {
    Object.assign(userState, {isLoggedIn:false,isAdmin:false,profile:null,token:null});
    updateUILoggedOut(); goToHome();
    try { await msalApp.logoutPopup(); } catch { msalApp.clearCache(); }
}

async function getTokenSilently() {
    const accs = msalApp.getAllAccounts();
    if (!accs.length) throw new Error('Sin cuenta');
    try {
        return (await msalApp.acquireTokenSilent({ scopes:CONFIG.azure.scopes, account:accs[0] })).accessToken;
    } catch {
        return (await msalApp.acquireTokenPopup({ scopes:CONFIG.azure.scopes })).accessToken;
    }
}

async function getAccessToken() {
    if (!userState.isLoggedIn) throw new Error('No autenticado');
    return getTokenSilently();
}

function updateUILoggedIn() {
    const p = userState.profile;
    document.getElementById('login-container').style.display       = 'none';
    document.getElementById('login-required-banner').style.display = 'none';
    document.getElementById('user-menu').style.display             = 'flex';
    document.getElementById('user-name-short').textContent         = p.givenName;
    document.getElementById('user-name-full').textContent          = p.nombre;
    document.getElementById('user-email-dd').textContent           = p.email;
    document.getElementById('user-initials').textContent           = p.initials;
    document.getElementById('user-avatar-large').textContent       = p.initials;
    if (userState.isAdmin) document.getElementById('admin-panel-btn').style.display = 'block';
}
function updateUILoggedOut() {
    document.getElementById('login-container').style.display       = 'block';
    document.getElementById('user-menu').style.display             = 'none';
    document.getElementById('login-required-banner').style.display = 'flex';
}
function toggleUserDropdown() { document.getElementById('user-dropdown').classList.toggle('show'); }
document.addEventListener('click', e => {
    if (!document.getElementById('user-menu')?.contains(e.target))
        document.getElementById('user-dropdown')?.classList.remove('show');
});
function goToMisSolicitudes() { if (!userState.isLoggedIn) { signInWithMicrosoft(); return; } showSection('mis-solicitudes'); loadUserSolicitudes(); }
function goToAdminPanel()     { if (!userState.isAdmin)    { alert('Acceso denegado.'); return; } showSection('admin-panel'); loadAdminData(); }
function getInitials(name) {
    if (!name) return 'UV';
    const p = name.trim().split(' ').filter(Boolean);
    return p.length===1 ? p[0].substring(0,2).toUpperCase() : (p[0][0]+p[p.length-1][0]).toUpperCase();
}
document.addEventListener('DOMContentLoaded', initMSAL);
