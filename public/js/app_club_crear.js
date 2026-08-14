// ============================================
// 🎫 Club Calletano — Creación de tarjeta (página club-crear.html)
// ============================================
// - El cliente crea su tarjeta en Firestore (club_miembros/{documento})
// - La configuración del club (meta, premio, consumo) es FIJA: ya no se
//   lee de Firestore (contenido/clubConfig fue eliminado).
import { doc, getDoc, setDoc } from './lib/firebase-bundle.js?v=5';
import { db, track } from './firebase-config.js';

// 🔒 PRIVACIDAD: los datos personales (correo, teléfono, preferencias) NO van
// en club_miembros (público). Van en club_contacto, colección privada.
import {
    normalizarDocumento,
    validarDocumento,
    generarTokenTarjeta,
    CLUB_CONFIG,
} from './clubHelpers.js';

let tipoActual = 'DNI'; // DNI | CE

// ── Pequeños helpers ──────────────────────────────────────────
function mostrarMsg(el, tipo, texto) {
    if (!el) return;
    el.className = `club-msg club-msg-${tipo}`;
    el.textContent = texto;
}

function setLoading(btn, on) {
    if (!btn) return;
    btn.disabled = on;
    if (on) {
        btn.dataset.label = btn.dataset.label || btn.textContent.trim();
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Procesando…';
    } else {
        btn.innerHTML = btn.dataset.label || 'Crear mi tarjeta';
    }
}

// ── Crear tarjeta ─────────────────────────────────────────────
async function crearTarjeta(e) {
    e.preventDefault();
    const msg = document.getElementById('club-form-msg');
    const btn = document.getElementById('club-crear-btn');
    const exito = document.getElementById('club-exito');
    if (msg) msg.className = 'club-msg';

    const docNum = normalizarDocumento(document.getElementById('club-num-doc').value);
    const nombre = document.getElementById('club-nombre').value.trim();
    const telefono = document.getElementById('club-telefono').value.trim();
    const correo = document.getElementById('club-correo').value.trim();
    const acepta = document.getElementById('club-acepta').checked;

    if (!validarDocumento(tipoActual, docNum)) {
        return mostrarMsg(msg, 'error', `El ${tipoActual} debe tener ${tipoActual === 'CE' ? 'entre 9 y 12 dígitos' : '8 dígitos'}, sin puntos ni guiones.`);
    }
    if (nombre.length < 2) return mostrarMsg(msg, 'error', 'Escribe tu nombre completo.');
    if (nombre.length > 80) return mostrarMsg(msg, 'error', 'El nombre es demasiado largo.');
    if (telefono && !/^\d{9,12}$/.test(telefono.replace(/[\s-]/g, ''))) {
        return mostrarMsg(msg, 'error', 'El teléfono no parece válido (solo números).');
    }
    if (correo && !/^\S+@\S+\.\S+$/.test(correo)) {
        return mostrarMsg(msg, 'error', 'El correo no parece válido.');
    }
    if (!acepta) return mostrarMsg(msg, 'error', 'Debes aceptar el uso de tus datos para crear tu tarjeta.');

    setLoading(btn, true);
    try {
        const ref = doc(db, 'club_miembros', docNum);
        const existente = await getDoc(ref);

        if (existente.exists()) {
            mostrarMsg(msg, 'info', 'Ya tienes una tarjeta del club. Te llevamos a tu progreso.');
            window.location.href = `club-consultar.html?club=${encodeURIComponent(docNum)}`;
            return;
        }

        // 🔑 Token opaco de la tarjeta: el QR/link ya no llevará el documento.
        // Se escribe el mapeo ANTES que la tarjeta: si falla, la tarjeta se crea
        // sin token y se usa el link legacy (?club=<documento>), que sigue
        // funcionando. Así el campo token de la tarjeta solo existe si su mapeo
        // en club_tokens/{token} está listo.
        const token = generarTokenTarjeta();
        let tokenGuardado = false;
        try {
            await setDoc(doc(db, 'club_tokens', token), {
                documento: docNum,
                creado_en: new Date().toISOString(),
            });
            tokenGuardado = true;
        } catch (errToken) {
            console.warn('Club: no se pudo guardar el token de la tarjeta (se usará el link legacy):', errToken);
        }

        // 🎫 Tarjeta pública (sin datos personales)
        await setDoc(ref, {
            documento: docNum,
            tipo_documento: tipoActual,
            nombre,
            acepta_datos: true,
            sede_registro: CLUB_CONFIG.sede,
            visitas: 0,
            creado_en: new Date().toISOString(),
            ...(tokenGuardado ? { token } : {}),
        });

        // 🔒 Datos personales → club_contacto (colección PRIVADA: solo Dueño/Caja la lee)
        try {
            await setDoc(doc(db, 'club_contacto', docNum), {
                documento: docNum,
                nombre,
                correo: correo || '',
                telefono: telefono || '',
                promociones: document.getElementById('club-promos').checked,
                creado_en: new Date().toISOString(),
            });
        } catch (errContacto) {
            // La tarjeta ya quedó creada; si el contacto falla, avisamos sin bloquear
            console.warn('Club: no se pudo guardar el contacto (solo la tarjeta):', errContacto);
        }

        // ✅ Éxito: ocultamos el formulario y mostramos la caja de felicitación
        const form = document.getElementById('club-form');
        if (form) form.style.display = 'none';
        if (msg) msg.className = 'club-msg';
        if (exito) exito.classList.add('show');
        // 📊 Conversión: tarjeta del club creada
        track('club_registrado', { sede: CLUB_CONFIG.sede });
        // El botón de éxito lleva a la tarjeta recién creada. Si hay token, el
        // link NO lleva el documento (privacidad); si no, cae al link legacy.
        const codigoTarjeta = tokenGuardado ? token : docNum;
        const linkExito = document.getElementById('club-exito-link');
        if (linkExito) linkExito.href = `club-consultar.html?club=${encodeURIComponent(codigoTarjeta)}`;

        // 📲 Compartir la tarjeta recién creada por WhatsApp
        // 🔒 PRIVACIDAD: NO se incluye el link (?club=<documento>) porque el link
        // contiene el documento completo; la tarjeta se muestra en el local por QR.
        const linkWsp = document.getElementById('club-exito-wsp');
        if (linkWsp) {
            const texto = `🎉 ¡Acabo de crear mi tarjeta del Club Calletano! Cada visita me acerca a mi premio: ${CLUB_CONFIG.premio}.`;
            linkWsp.href = `https://wa.me/?text=${encodeURIComponent(texto)}`;
            linkWsp.classList.remove('d-none');
        }

    } catch (err) {
        console.error('Club: error al crear tarjeta:', err);
        mostrarMsg(msg, 'error', 'No se pudo crear tu tarjeta. Revisa tu conexión o inténtalo de nuevo.');
    } finally {
        setLoading(btn, false);
    }
}

// ── Inicialización ────────────────────────────────────────────
function initClub() {
    // Selector DNI / CE
    const tipoCont = document.getElementById('club-doc-tipo');
    const numDocInput = document.getElementById('club-num-doc');
    if (tipoCont) {
        tipoCont.addEventListener('click', (e) => {
            const btnEl = e.target.closest('.club-doc-btn');
            if (!btnEl) return;
            tipoActual = btnEl.dataset.tipo || 'DNI';
            tipoCont.querySelectorAll('.club-doc-btn').forEach((b) => b.classList.toggle('active', b === btnEl));
            if (numDocInput) {
                numDocInput.maxLength = tipoActual === 'CE' ? 12 : 8;
                numDocInput.placeholder = tipoActual === 'CE' ? 'Ej: 123456789' : 'Ej: 12345678';
                numDocInput.value = '';
            }
        });
    }

    const form = document.getElementById('club-form');
    if (form) form.addEventListener('submit', crearTarjeta);

    // ⚙️ Config hardcodeada (ya no se lee de Firestore)
    const metaEl = document.getElementById('club-meta-text');
    if (metaEl) metaEl.textContent = `${CLUB_CONFIG.visitas_para_premio} visitas`;
    const premioEl = document.getElementById('club-premio-text');
    if (premioEl) premioEl.textContent = CLUB_CONFIG.premio;
    const consumoEl = document.getElementById('club-consumo-min');
    if (consumoEl) consumoEl.textContent = `S/ ${CLUB_CONFIG.consumo_minimo}`;
}

// Los módulos se ejecutan después de parsear el DOM, así que
// el DOM ya está listo cuando llamamos initClub().
initClub();

// ============================================
// EVENTOS DE CONVERSIÓN (Firebase Analytics)
// ============================================
const wspExito = document.getElementById('club-exito-wsp');
if (wspExito) wspExito.addEventListener('click', () => track('click_whatsapp', { origen: 'club_crear' }));
