import { initializeApp, initializeFirestore, doc, getDoc, setDoc, deleteDoc } from './lib/firebase-bundle.js?v=4';
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
// 📊 Analytics — Google Consent Mode v2
// Cargamos el SDK SIEMPRE, pero el consentimiento lo gobierna gtag:
//  - El <head> de cada página fija gtag('consent','default',...) según lo que
//    el usuario guardó antes (granted/denied) ANTES de que Firebase cargue.
//  - consent.js llama gtag('consent','update',...) cuando el usuario decide
//    aquí en esta visita; Firebase lo respeta aunque el SDK ya esté cargado.
//  - Con analytics_storage='denied' el SDK no recopila ni envía eventos.
// El SDK inyecta gtag.js por su cuenta (no hace falta un <script> estático).
import('./lib/firebase-bundle.js?v=4')
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

