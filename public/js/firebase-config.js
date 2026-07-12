import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getMessaging, getToken, onMessage, deleteToken } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

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
export const messaging = getMessaging(app);

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
// GESTIÓN DE TOKENS FCM PARA NOTIFICACIONES
// ============================================

/**
 * Registra el token FCM del dispositivo en Firestore
 * Los tokens se guardan en la colección push_tokens_clientes
 */
export async function registrarTokenPush() {
    try {
        // Pedir permiso de notificación
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('[FCM] Permiso de notificaciones denegado.');
            return null;
        }

        // Obtener token FCM
        // 🔐 VAPID KEY — generada desde Firebase Console > Cloud Messaging
        const currentToken = await getToken(messaging, {
            vapidKey: '_eXwhQ7U_X7_Hr-EsOafVUQ5y0vTH-Er4jBKccJWigo'
        });

        if (currentToken) {
            console.log('[FCM] Token obtenido:', currentToken);
            
            // Guardar en Firestore
            await setDoc(doc(db, 'push_tokens_clientes', currentToken), {
                token: currentToken,
                fecha_registro: new Date(),
                ultimo_activo: new Date(),
                activo: true,
                user_agent: navigator.userAgent
            });

            // Escuchar mensajes en primer plano
            onMessage(messaging, (payload) => {
                console.log('[FCM] Notificación en primer plano:', payload);
                mostrarNotificacionLocal(payload);
            });

            return currentToken;
        } else {
            console.warn('[FCM] No se pudo obtener token.');
            return null;
        }
    } catch (err) {
        console.error('[FCM] Error al registrar token:', err);
        return null;
    }
}

/**
 * Desregistra el token FCM del dispositivo
 */
export async function desregistrarTokenPush(token) {
    try {
        await deleteToken(messaging);
        await deleteDoc(doc(db, 'push_tokens_clientes', token));
        console.log('[FCM] Token eliminado:', token);
        return true;
    } catch (err) {
        console.error('[FCM] Error al eliminar token:', err);
        return false;
    }
}

/**
 * Muestra una notificación local en primer plano (toast in-page)
 */
function mostrarNotificacionLocal(payload) {
    const title = payload.notification?.title || 'Calletano Restaurant';
    const body = payload.notification?.body || '';
    
    // Crear toast personalizado en la página
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.innerHTML = `
        <div class="notification-toast-content">
            <div class="notification-toast-icon">
                <img src="/img/fondo.webp" alt="Calletano" width="40" height="40" style="border-radius:50%;">
            </div>
            <div class="notification-toast-text">
                <strong>${title}</strong>
                <p>${body}</p>
            </div>
            <button class="notification-toast-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
    `;
    document.body.appendChild(toast);
    
    // Auto-eliminar después de 8 segundos
    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 8000);
}

/**
 * Verifica si el usuario ya tiene un token registrado
 */
export async function tieneTokenRegistrado() {
    try {
        const currentToken = await getToken(messaging, {
            vapidKey: '_eXwhQ7U_X7_Hr-EsOafVUQ5y0vTH-Er4jBKccJWigo'
        });
        if (!currentToken) return false;
        
        const snap = await getDoc(doc(db, 'push_tokens_clientes', currentToken));
        return snap.exists() && snap.data().activo === true;
    } catch {
        return false;
    }
}