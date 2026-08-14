import { initializeApp, initializeFirestore, doc, getDoc, setDoc, deleteDoc, initializeAppCheck, ReCaptchaV3Provider } from './lib/firebase-bundle.js?v=5';
import './consent.js'; // 🍪 Banner de cookies + actualización de Consent Mode v2
const firebaseConfig = {
    apiKey: "AIzaSyC2RKkuY_aEQaHVDvAt_-T_29sPQ6HUp50",
    authDomain: "calletano-restaurant.firebaseapp.com",
    projectId: "calletano-restaurant",
    storageBucket: "calletano-restaurant.firebasestorage.app",
    messagingSenderId: "1036720006578",
    appId: "1:1036720006578:web:31b305a61a353f324bb0ab",
    measurementId: "G-VBPRFGMZ1J"
};

const app = initializeApp(firebaseConfig);
// ⚡ experimentalForceLongPolling: true — evita que adblockers bloqueen Firebase
// Los adblockers (uBlock, Brave, etc.) suelen bloquear WebSocket/WebChannel.
// Long polling usa HTTP normal, que los adblockers no pueden distinguir.
export const db = initializeFirestore(app, { experimentalForceLongPolling: true });
export const appFirebase = app;

// 🔐 App Check — protección anti-bots (gratis, plan Spark)
// ---------------------------------------------------------------
// Google: https://firebase.google.com/docs/app-check/web/recaptcha-provider
// Cómo activarla (2 pasos, todo gratis):
//   1) Crea una key de reCAPTCHA v3 GRATIS en https://www.google.com/recaptcha/admin
//      (tipo "Score based (v3)", dominios: calletano-restaurant.web.app y *.web.app).
//      La SITE KEY (pública, empieza con "6L...") se pega en RECAPTCHA_SITE_KEY.
//   2) En Firebase Console → Security → App Check → activa la protección
//      ("Enforce") sobre Cloud Firestore.
// Mientras la key sea el placeholder, App Check NO se inicializa y el sitio
// funciona exactamente como antes (sin bloqueos).
export const RECAPTCHA_SITE_KEY = '6LcREYYtAAAAAIPvusdHUfdjao4oDUh9V3jEj9KS';

// Carga el script de reCAPTCHA v3 (necesario para que App Check emita tokens).
function cargarRecaptcha() {
    return new Promise((resolve) => {
        if (typeof window === 'undefined' || window.grecaptcha) return resolve();
        const s = document.createElement('script');
        s.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => resolve(); // nunca bloquear la página si reCAPTCHA falla
        document.head.appendChild(s);
    });
}

const keyReal = RECAPTCHA_SITE_KEY && RECAPTCHA_SITE_KEY.indexOf('PEGA_AQUI') === -1;
if (keyReal) {
    cargarRecaptcha().then(() => {
        try {
            initializeAppCheck(app, {
                provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
                isTokenAutoRefreshEnabled: true,
            });
            console.log('App Check activado (reCAPTCHA v3).');
        } catch (e) {
            console.warn('App Check no se pudo inicializar:', e);
        }
    });
} else {
    console.warn('App Check: falta la SITE KEY de reCAPTCHA v3 (RECAPTCHA_SITE_KEY). La protección anti-bots está desactivada.');
}

// 📊 Analytics — Google Consent Mode v2
// Cargamos el SDK SIEMPRE, pero el consentimiento lo gobierna gtag:
//  - El <head> de cada página fija gtag('consent','default',...) según lo que
//    el usuario guardó antes (granted/denied) ANTES de que Firebase cargue.
//  - consent.js llama gtag('consent','update',...) cuando el usuario decide
//    aquí en esta visita; Firebase lo respeta aunque el SDK ya esté cargado.
//  - Con analytics_storage='denied' el SDK no recopila ni envía eventos.
// El SDK inyecta gtag.js por su cuenta (no hace falta un <script> estático).
import('./lib/firebase-bundle.js?v=5')
    .then((module) => {
        if (module.getAnalytics) {
            module.getAnalytics(app);
            console.log('Analytics cargado (Consent Mode v2).');
        }
    })
    .catch(() => {
        console.warn('Analytics bloqueado por privacidad (Safari/AdBlocker).');
    });

// 🎯 Eventos personalizados de conversión.
// Usamos la API global gtag('event', ...) sobre el dataLayer: funciona con el
// gtag.js que el SDK de Firebase inyecta y respeta el Consent Mode v2
// (si analytics_storage='denied', gtag.js descarta el evento).
// Nunca debe romper la página, por eso todo va dentro de try/catch.
export function track(eventName, params = {}) {
    try {
        if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
            window.gtag('event', eventName, params);
        }
    } catch (e) {
        /* silencioso */
    }
}
