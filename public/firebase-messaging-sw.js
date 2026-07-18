/**
 * Service Worker para notificaciones push — Calletano Restaurant PWA
 * 
 * ⚡ SW mínimo: solo Firebase Messaging, sin cacheo personalizado.
 * El cacheo se eliminó porque interfería con la activación del SW.
 */

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC2RKkuY_aEQaHVDvAt_-T_29sPQ6HUp50",
  authDomain: "calletano-restaurant.firebaseapp.com",
  projectId: "calletano-restaurant",
  storageBucket: "calletano-restaurant.firebasestorage.app",
  messagingSenderId: "1036720006578",
  appId: "1:1036720006578:web:31b305a61a353f324bb0ab",
  measurementId: "G-VBPRFGMZ1J"
});

const messaging = firebase.messaging();

// ============================================
// MANEJO DE NOTIFICACIONES EN BACKGROUND
// ============================================

messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] Notificación en background:', payload.notification?.title);

  const notificationTitle = payload.notification?.title || 'Calletano Restaurant';
  const notificationOptions = {
    body: payload.notification?.body || '¡Tenemos novedades para ti!',
    icon: '/img/fondo.webp',
    badge: '/img/fondo.webp',
    vibrate: [200, 100, 200],
    data: {
      url: payload.data?.url || '/',
      click_action: payload.data?.click_action || 'open_home'
    },
    requireInteraction: true
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// ============================================
// MANEJO DE CLIC EN NOTIFICACIONES
// ============================================

self.addEventListener('notificationclick', function(event) {
  const notification = event.notification;
  notification.close();

  let targetUrl = '/';
  if (notification.data?.url) {
    const candidateUrl = notification.data.url;
    if (candidateUrl.startsWith(self.location.origin) || candidateUrl.startsWith('/')) {
      targetUrl = candidateUrl;
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.navigate(targetUrl);
            return;
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ============================================
// ACTIVACIÓN INMEDIATA
// ============================================

self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});
