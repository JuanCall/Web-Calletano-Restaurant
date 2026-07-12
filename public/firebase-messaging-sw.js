/**
 * Service Worker para notificaciones push — Calletano Restaurant PWA
 * 
 * Este SW se activa cuando el usuario acepta notificaciones.
 * Firebase Messaging se encarga de inyectar los handlers de push.
 * 
 * Incluye:
 * - Import del SDK de Firebase Messaging SW
 * - Handler de clics en notificaciones
 * - Cacheo básico de assets para funcionalidad offline parcial
 */

// Import Firebase Messaging SW (versión específica para service worker)
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Misma configuración que firebase-config.js
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
  console.log('[firebase-messaging-sw] Notificación en background recibida:', payload);

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
    actions: [
      {
        action: 'open',
        title: 'Ver ahora'
      },
      {
        action: 'close',
        title: 'Cerrar'
      }
    ],
    requireInteraction: true
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// ============================================
// MANEJO DE CLIC EN NOTIFICACIONES
// ============================================

self.addEventListener('notificationclick', function(event) {
  const notification = event.notification;
  const action = event.action;

  notification.close();

  // Determinar URL de destino (solo mismo origen por seguridad)
  let targetUrl = '/';
  if (notification.data?.url) {
    const candidateUrl = notification.data.url;
    // Solo permitir URLs del mismo origen
    if (candidateUrl.startsWith(self.location.origin) || candidateUrl.startsWith('/')) {
      targetUrl = candidateUrl;
    }
  } else if (action === 'open' || !action) {
    targetUrl = notification.data?.url || '/';
    if (!targetUrl.startsWith('/') && !targetUrl.startsWith(self.location.origin)) {
      targetUrl = '/';
    }
  }

  // Enfocar o abrir ventana
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Si ya hay una ventana abierta, enfocarla y navegar
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.navigate(targetUrl);
            return;
          }
        }
        // Si no hay ventana, abrir una nueva
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ============================================
// CACHEO BÁSICO PARA OFFLINE PARCIAL
// ============================================

const CACHE_NAME = 'calletano-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/carta.html',
  '/styles/style.css',
  '/styles/stylecarta.css',
  '/img/fondo.webp',
  '/img/logo.webp'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('[SW] Cacheando assets iniciales...');
        // Cachear uno por uno para que un fallo no bloquee el resto
        return Promise.allSettled(
          ASSETS_TO_CACHE.map(function(asset) {
            return cache.add(asset).catch(function(err) {
              console.warn('[SW] No se pudo cachear:', asset, err.message);
            });
          })
        );
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(name) {
          return name !== CACHE_NAME;
        }).map(function(name) {
          return caches.delete(name);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  // Solo cachear requests GET a recursos estáticos
  if (event.request.method === 'GET' && 
      event.request.url.includes(self.location.origin) &&
      !event.request.url.includes('firestore') &&
      !event.request.url.includes('firebase')) {
    event.respondWith(
      caches.match(event.request)
        .then(function(cached) {
          return cached || fetch(event.request).then(function(response) {
            // Cachear respuesta si es válida
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(function(cache) {
                cache.put(event.request, clone);
              });
            }
            return response;
          }).catch(function() {
            // Si falla la red y está en caché, usar caché
            return cached;
          });
        })
    );
  }
});
