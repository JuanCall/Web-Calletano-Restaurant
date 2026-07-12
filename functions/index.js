/**
 * 🔔 Cloud Functions — Calletano Restaurant
 * 
 * ⚠️  IMPORTANTE: REQUIERE PLAN BLAZE (pago por uso)
 * ═══════════════════════════════════════════════
 * Firebase Cloud Functions NO están disponibles en el plan Spark (gratis).
 * Para activarlas, debes cambiar al plan Blaze en Firebase Console.
 * El costo es mínimo (cents al mes para este volumen).
 * 
 * 🔄 Mientras estés en Spark, las notificaciones a clientes se envían
 *    mediante POLLING desde el backend POS (server.js).
 *    Esto funciona cuando la caja está encendida (horario de atención).
 * 
 * ☁️  Si algún día cambias a Blaze:
 *    1. Desplegar: cd calletano-web && firebase deploy --only functions
 *    2. Desactivar el polling en server.js (buscar "pollearNotificacionesPendientes")
 *    3. Listo — las notificaciones funcionarán 24/7 sin depender de la caja
 * 
 * Envía notificaciones push a los clientes de la PWA cuando el admin
 * publica el menú del día o cambia el estado del restaurante.
 * 
 * Despliegue (solo Blaze):
 *   cd calletano-web
 *   firebase deploy --only functions
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin');
const { getMessaging } = require('firebase-admin/messaging');
const { getFirestore } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');

// Inicializar Firebase Admin (ya tiene credenciales en el entorno de Cloud Functions)
initializeApp();
const db = getFirestore();
const messaging = getMessaging();

/**
 * ⏰ Se ejecuta cada vez que se crea un documento en notificaciones_pendientes.
 * 
 * Lee los tokens activos de push_tokens_clientes y envía FCM a todos.
 * Marca el documento como enviado cuando termina (éxito o error).
 */
exports.enviarNotificacionesClientes = onDocumentCreated(
  {
    document: 'notificaciones_pendientes/{docId}',
    region: 'us-central1',
    // Timeout de 60s para dar tiempo a procesar todos los tokens
    timeoutSeconds: 60,
    // Mínimo de instancias para evitar cold start en horario pico
    minInstances: 0,
    // Máximo 1 instancia concurrente por documento (es secuencial)
    maxInstances: 1
  },
  async (event) => {
    const docId = event.params.docId;
    const data = event.data?.data();

    if (!data) {
      logger.warn(`[FCM-Web] Documento ${docId} sin datos, ignorando.`);
      return;
    }

    // Evitar re-procesar si ya fue enviado (seguridad ante múltiples triggers)
    if (data.enviado === true) {
      logger.log(`[FCM-Web] ${docId} ya fue enviado, saltando.`);
      return;
    }

    // Solo procesar notificaciones de tipo 'cliente'
    if (data.tipo && data.tipo !== 'cliente') {
      logger.log(`[FCM-Web] ${docId} no es tipo cliente (${data.tipo}), saltando.`);
      return;
    }

    const titulo = data.titulo || 'Calletano Restaurant';
    const cuerpo = data.cuerpo || '';
    const url = data.url || '/';

    logger.log(`[FCM-Web] Procesando: "${titulo}"`);

    try {
      // 1. Leer tokens activos de clientes desde Firestore
      const tokensSnapshot = await db
        .collection('push_tokens_clientes')
        .where('activo', '==', true)
        .get();

      const tokens = [];
      tokensSnapshot.forEach(doc => {
        const token = doc.data().token;
        if (token) tokens.push(token);
      });

      if (tokens.length === 0) {
        logger.log('[FCM-Web] No hay tokens de clientes registrados.');
        await marcarEnviado(docId);
        return;
      }

      logger.log(`[FCM-Web] Enviando a ${tokens.length} cliente(s)...`);

      // 2. Construir mensaje FCM
      const message = {
        notification: {
          title: titulo,
          body: cuerpo
        },
        data: {
          url: url,
          click_action: 'open'
        },
        webpush: {
          fcm_options: {
            link: url
          },
          notification: {
            icon: '/img/fondo.webp',
            badge: '/img/fondo.webp',
            vibrate: [200, 100, 200],
            requireInteraction: true
          }
        },
        tokens: tokens
      };

      // 3. Enviar usando multicast (Firebase Admin SDK)
      const response = await messaging.sendEachForMulticast(message);

      const successCount = response.successCount;
      const failCount = response.failureCount;

      logger.log(`[FCM-Web] ✅ ${successCount} enviadas, ❌ ${failCount} fallidas.`);

      // 4. Desactivar tokens inválidos
      if (failCount > 0) {
        const batch = db.batch();
        let desactivados = 0;

        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;
            if (
              errorCode === 'messaging/registration-token-not-registered' ||
              errorCode === 'messaging/invalid-registration-token'
            ) {
              const tokenRef = db.collection('push_tokens_clientes').doc(tokens[idx]);
              batch.update(tokenRef, {
                activo: false,
                motivo_baja: errorCode,
                fecha_baja: new Date()
              });
              desactivados++;
            }
          }
        });

        if (desactivados > 0) {
          await batch.commit();
          logger.log(`[FCM-Web] 🧹 ${desactivados} token(s) inválido(s) desactivado(s).`);
        }
      }

      // 5. Marcar como enviado
      await marcarEnviado(docId);
      logger.log(`[FCM-Web] ✅ ${docId} procesada exitosamente.`);

    } catch (err) {
      logger.error(`[FCM-Web] ❌ Error al enviar notificaciones:`, err);

      // Marcar como enviado aunque falle, para evitar bucles infinitos
      await marcarEnviado(docId, err.message);
    }
  }
);

/**
 * Marca un documento de notificaciones_pendientes como enviado.
 */
async function marcarEnviado(docId, errorMsg = null) {
  try {
    const updateData = {
      enviado: true,
      fecha_envio: new Date()
    };
    if (errorMsg) {
      updateData.error = errorMsg;
    }
    await db.collection('notificaciones_pendientes').doc(docId).update(updateData);
  } catch (err) {
    logger.warn(`[FCM-Web] No se pudo marcar ${docId} como enviado:`, err.message);
  }
}
