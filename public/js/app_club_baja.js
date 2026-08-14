// ============================================
// 📧 Club Calletano — Baja de promociones (página club-baja.html)
// ============================================
// - El socio llega desde el enlace de baja del correo: club-baja.html?doc=<documento>
// - Confirma y escribimos promociones:false en club_contacto/{documento}
//   (colección PRIVADA; la regla de Firestore solo permite a cada socio
//   apagar SUS promociones, sin leer ni modificar el resto de sus datos).
//
// ⚠️ NO se puede leer club_contacto desde la web (reglas: solo isSystem) y
// el bundle de Firebase no exporta updateDoc: usamos setDoc con { merge: true }
// para actualizar SOLO el campo promociones.
import { doc, setDoc } from './lib/firebase-bundle.js?v=5';
import { db } from './firebase-config.js';
import { normalizarDocumento, validarDocumento } from './clubHelpers.js';

function mostrarVista(nombre) {
    ['confirmar', 'exito', 'error'].forEach((v) => {
        const el = document.getElementById(`baja-vista-${v}`);
        if (el) el.style.display = v === nombre ? '' : 'none';
    });
}

function mostrarMsg(el, tipo, texto) {
    if (!el) return;
    el.className = `club-msg club-msg-${tipo}`;
    el.textContent = texto;
}

// ── Procesa la baja ─────────────────────────────────────────────
async function procesarBaja() {
    const msg = document.getElementById('baja-msg');
    const btn = document.getElementById('baja-btn');
    const docNum = normalizarDocumento(new URLSearchParams(location.search).get('doc'));

    if (!validarDocumento('AUTO', docNum)) {
        mostrarMsg(msg, 'error', 'El enlace no es válido. Verifica el correo original.');
        return;
    }

    if (btn) btn.disabled = true;
    mostrarMsg(msg, 'info', 'Procesando…');

    try {
        const ref = doc(db, 'club_contacto', docNum);
        // La regla de Firestore permite este cambio SOLO con promociones → false
        // (setDoc con merge actualiza únicamente ese campo; si no existe el
        // contacto, la regla create lo rechaza y mostramos el error).
        await setDoc(ref, { promociones: false }, { merge: true });
        mostrarVista('exito');
    } catch (err) {
        console.error('Club: error al dar de baja:', err);
        const code = err?.code || '';
        if (code === 'permission-denied') {
            mostrarMsg(msg, 'error', 'No encontramos tu contacto en el club. Avísanos en caja y te ayudamos.');
        } else {
            mostrarMsg(msg, 'error', 'No se pudo procesar la baja. Verifica tu conexión e inténtalo de nuevo.');
        }
        if (btn) btn.disabled = false;
    }
}

// ── Inicialización ──────────────────────────────────────────────
function initBaja() {
    const docNum = normalizarDocumento(new URLSearchParams(location.search).get('doc'));
    if (!validarDocumento('AUTO', docNum)) {
        mostrarVista('error');
        const txt = document.getElementById('baja-error-text');
        if (txt) txt.textContent = 'El enlace de baja no es válido o está incompleto. Abre el correo original y vuelve a intentarlo.';
        return;
    }

    const btn = document.getElementById('baja-btn');
    if (btn) btn.addEventListener('click', procesarBaja);
}

initBaja();
