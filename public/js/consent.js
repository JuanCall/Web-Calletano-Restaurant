// ============================================
// 🍪 CONSENTIMIENTO DE COOKIES — Calletano
// ============================================
// Banner que pide permiso para usar las cookies de analítica
// (Google Analytics / Firebase Analytics) + Google Consent Mode v2.
//
// - El <head> de cada página fija gtag('consent','default',...) ANTES de
//   que Firebase cargue, según la decisión guardada en localStorage
//   ("calletano_cookie_consent").
// - Aquí llamamos gtag('consent','update',...) cuando el usuario acepta o
//   rechaza EN ESTA VISITA; Firebase lo respeta aunque el SDK ya esté
//   cargado (Consent Mode v2).
// - Si el usuario ya decidió antes, el banner no se vuelve a mostrar.
// - Con analytics_storage='denied' el SDK no recopila ni envía datos.

const GRANTED = 'granted';
const DENIED = 'denied';

const STORAGE_KEY = 'calletano_cookie_consent';

function getConsent() {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch (_) {
        return null;
    }
}

// ¿El usuario ya tomó alguna decisión (aceptar o rechazar)?
function hasDecision() {
    return getConsent() !== null;
}

function saveConsent(value) {
    try {
        localStorage.setItem(STORAGE_KEY, value);
    } catch (_) {
        /* navegación privada: la decisión solo vale para esta visita */
    }
}

// ── Google Consent Mode v2 — refleja la decisión en gtag/dataLayer ──
// El estado por defecto se fija en el <head> (gtag('consent','default',...))
// ANTES de que Firebase cargue. Aquí lo ACTUALIZAMOS en cuanto el usuario
// decide, para que Analytics respete la elección incluso si ya está cargado.
// Los 4 señales son los oficiales de Consent Mode v2 (ad_user_data y
// ad_personalization son los nuevos de la v2; este sitio no usa anuncios,
// pero se declaran igual para cumplir con el estándar).
function aplicarConsentimiento(decision) {
    const estado = decision === GRANTED ? 'granted' : 'denied';
    const gtag = window.gtag;
    if (typeof gtag === 'function') {
        gtag('consent', 'update', {
            ad_storage: estado,
            ad_user_data: estado,
            ad_personalization: estado,
            analytics_storage: estado,
        });
    }
}

// ── Estilos del banner (auto-contenidos, sin tocar los CSS del sitio) ──
const BANNER_STYLES = `
#cookie-banner {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1080;
    width: min(560px, calc(100vw - 32px));
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px;
    border-radius: 18px;
    background: linear-gradient(160deg, #1d2430 0%, #131923 100%);
    color: #eef1f6;
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    animation: cookie-banner-in 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes cookie-banner-in {
    from { opacity: 0; transform: translate(-50%, 24px); }
    to   { opacity: 1; transform: translate(-50%, 0); }
}
#cookie-banner .cookie-banner-fila {
    display: flex;
    gap: 12px;
    align-items: flex-start;
}
#cookie-banner .cookie-banner-icono {
    font-size: 26px;
    line-height: 1;
    flex-shrink: 0;
    margin-top: 2px;
}
#cookie-banner .cookie-banner-titulo {
    margin: 0 0 4px;
    font-weight: 700;
    font-size: 15px;
}
#cookie-banner .cookie-banner-texto {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.55;
    color: #c7cdd8;
}
#cookie-banner .cookie-banner-texto strong {
    color: #ffffff;
}
#cookie-banner .cookie-banner-acciones {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}
#cookie-banner .cookie-banner-link {
    margin-right: auto;
    font-size: 13px;
    color: #7fd4d8;
    text-decoration: none;
}
#cookie-banner .cookie-banner-link:hover {
    text-decoration: underline;
}
#cookie-banner .cookie-banner-btn {
    border: 0;
    cursor: pointer;
    font-weight: 600;
    font-size: 13.5px;
    padding: 10px 18px;
    border-radius: 999px;
    transition: transform 0.15s ease, filter 0.2s ease;
}
#cookie-banner .cookie-banner-btn:hover {
    filter: brightness(1.08);
}
#cookie-banner .cookie-banner-btn:active {
    transform: scale(0.97);
}
#cookie-banner .cookie-banner-btn-aceptar {
    background: #e8993d;
    color: #1a1f28;
}
#cookie-banner .cookie-banner-btn-rechazar {
    background: transparent;
    color: #d7dce5;
    border: 1px solid rgba(255, 255, 255, 0.22);
}
@media (max-width: 420px) {
    #cookie-banner {
        padding: 16px;
        bottom: 12px;
    }
    #cookie-banner .cookie-banner-acciones {
        flex-direction: column-reverse;
        align-items: stretch;
    }
    #cookie-banner .cookie-banner-acciones .cookie-banner-btn {
        width: 100%;
    }
    #cookie-banner .cookie-banner-link {
        margin-right: 0;
        text-align: center;
    }
}
`;

function injectStyles() {
    if (document.getElementById('cookie-banner-styles')) return;
    const style = document.createElement('style');
    style.id = 'cookie-banner-styles';
    style.textContent = BANNER_STYLES;
    document.head.appendChild(style);
}

function buildBanner() {
    injectStyles();

    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'Aviso de cookies');

    banner.innerHTML = `
        <div class="cookie-banner-fila">
            <span class="cookie-banner-icono" aria-hidden="true">🍪</span>
            <div>
                <p class="cookie-banner-titulo">Valoramos tu privacidad</p>
                <p class="cookie-banner-texto">
                    Este sitio usa <strong>Google Analytics</strong> para conocer de forma
                    anónima y agregada cuántas personas nos visitan y qué secciones les
                    interesan. No te identificamos ni compartimos tus datos con terceros.
                </p>
            </div>
        </div>
        <div class="cookie-banner-acciones">
            <a class="cookie-banner-link" href="privacidad.html">Política de privacidad</a>
            <button type="button" class="cookie-banner-btn cookie-banner-btn-rechazar" data-cookie-rechazar>Rechazar</button>
            <button type="button" class="cookie-banner-btn cookie-banner-btn-aceptar" data-cookie-aceptar>Aceptar</button>
        </div>
    `;

    function cerrar(decision) {
        saveConsent(decision);
        aplicarConsentimiento(decision);
        banner.remove();
    }

    banner.querySelector('[data-cookie-aceptar]').addEventListener('click', () => cerrar(GRANTED));
    banner.querySelector('[data-cookie-rechazar]').addEventListener('click', () => cerrar(DENIED));

    document.body.appendChild(banner);
    banner.querySelector('[data-cookie-aceptar]').focus();
}

// ── Mostrar el banner solo si aún no hay decisión ──
if (!hasDecision() && document.body) {
    buildBanner();
}
