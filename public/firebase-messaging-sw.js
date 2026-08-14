/**
 * Service Worker — Calletano Restaurant PWA
 * ⚡ SW mínimo sin notificaciones push (desactivadas por decisión del dueño).
 */

self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});
