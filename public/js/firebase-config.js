import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// 🚫 [DESACTIVADO] FCM Messaging — no se usan notificaciones push a clientes web
// import { getMessaging, getToken, onMessage, deleteToken } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

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
export const db = getFirestore(app);
export const appFirebase = app;
// 🚫 [DESACTIVADO] No se usa FCM
// export const messaging = getMessaging(app);


// Analytics a prueba de bloqueos
import("https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js")
    .then((module) => {
        module.getAnalytics(app);
        console.log("Analytics activado.");
    })
    .catch(() => {
        console.warn("Analytics bloqueado por privacidad (Safari/AdBlocker).");
    });

// ============================================
// 🚫 [DESACTIVADO] GESTIÓN DE TOKENS FCM PARA NOTIFICACIONES A CLIENTES WEB
// Por decisión del dueño, no se envían notificaciones push a clientes
// por la página web. El código se mantiene comentado para posible reactivación.
// ============================================

// function delay(ms) {
//     return new Promise(resolve => setTimeout(resolve, ms));
// }

// export async function registrarTokenPush() { ... }
// export async function desregistrarTokenPush(token) { ... }
// function mostrarNotificacionLocal(payload) { ... }
// export async function tieneTokenRegistrado() { ... }