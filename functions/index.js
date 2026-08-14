/**
 * ⚠️ Functions desactivadas — Calletano Restaurant
 * 
 * Anteriormente contenía Cloud Functions para notificaciones push,
 * pero fueron eliminadas por decisión del dueño.
 *
 * ⚠️ El bloque "functions" se eliminó de firebase.json, así que
 * `firebase deploy` ya no intenta publicarlas (evita el requisito
 * del plan Blaze). La carpeta se conserva solo como referencia.
 *
 * Para reactivar en el futuro:
 *   1. Re-agregar el bloque "functions" en firebase.json
 *      (source: "functions", runtime: "nodejs18", region: "us-central1")
 *   2. Cambiar a plan Blaze en Firebase Console (requisito de functions)
 *   3. cd calletano-web
 *   4. firebase deploy --only functions
 */
console.log('☁️ Cloud Functions desactivadas.');
