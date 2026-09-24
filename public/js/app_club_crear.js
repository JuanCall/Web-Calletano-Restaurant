// ============================================
// 🎫 Club Calletano — Creación de tarjeta (página club-crear.html)
// ============================================
// - El cliente crea su tarjeta en Firestore (club_miembros/{documento})
// - La configuración del club (meta, premio, consumo) es FIJA: ya no se
//   lee de Firestore (contenido/clubConfig fue eliminado).
import { doc, getDoc, setDoc } from './lib/firebase-bundle.js?v=4';
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

// ── Validación por campo (accesible) ──────────────────────────
// Cada campo tiene su <p class="club-field-err" id="<id>-err">, declarado en el
// aria-describedby del input. Al fallar: se escribe el error JUNTO al campo, se
// marca el contenedor (.club-field-error) y se pone aria-invalid, para que el
// error no dependa solo del color ni del aviso global del formulario.
const CAMPOS_VALIDABLES = ['club-num-doc', 'club-nombre', 'club-telefono', 'club-correo'];

function marcarErrorCampo(input, texto) {
    const err = document.getElementById(`${input.id}-err`);
    const campo = input.closest('.club-field');
    if (err) err.textContent = texto;
    if (campo) campo.classList.add('club-field-error');
    input.setAttribute('aria-invalid', 'true');
}

function limpiarErrorCampo(input) {
    const err = document.getElementById(`${input.id}-err`);
    const campo = input.closest('.club-field');
    if (err) err.textContent = '';
    if (campo) campo.classList.remove('club-field-error');
    input.removeAttribute('aria-invalid');
}

function limpiarErrores() {
    CAMPOS_VALIDABLES.forEach((id) => {
        const el = document.getElementById(id);
        if (el) limpiarErrorCampo(el);
    });
}

// Devuelve true si el campo es válido; si no, marca el error junto al campo.
function validarCampo(input) {
    const raw = input.value.trim();
    let texto = '';
    if (input.id === 'club-num-doc') {
        if (!validarDocumento('AUTO', normalizarDocumento(raw))) {
            texto = 'Ingresa un DNI (8 dígitos) o Carné de Extranjería (9 a 12 dígitos), sin puntos ni guiones.';
        }
    } else if (input.id === 'club-nombre') {
        if (raw.length < 2) texto = 'Escribe tu nombre completo.';
        else if (raw.length > 80) texto = 'El nombre es demasiado largo.';
    } else if (input.id === 'club-telefono') {
        if (raw && !/^\d{9,12}$/.test(raw.replace(/[\s-]/g, ''))) {
            texto = 'El teléfono no parece válido: solo números, 9 a 12 dígitos.';
        }
    } else if (input.id === 'club-correo') {
        if (raw && !/^\S+@\S+\.\S+$/.test(raw)) texto = 'El correo no parece válido.';
    }
    if (texto) {
        marcarErrorCampo(input, texto);
        return false;
    }
    limpiarErrorCampo(input);
    return true;
}

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
        btn.innerHTML = btn.dataset.label || 'Crear mi tarjeta gratis';
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
    const aceptaInput = document.getElementById('club-acepta');
    const acepta = aceptaInput ? aceptaInput.checked : false;

    // ✅ Validación por campo: cada error queda junto a su campo (aria-invalid +
    // aria-describedby) y el foco va al primero con problema. El aviso global se
    // reserva para "revisa los campos marcados" y para los fallos de red.
    limpiarErrores();
    const invalidos = [];
    CAMPOS_VALIDABLES.forEach((id) => {
        const el = document.getElementById(id);
        if (el && !validarCampo(el)) invalidos.push(el);
    });
    if (invalidos.length) {
        mostrarMsg(msg, 'error', 'Revisa los campos marcados.');
        invalidos[0].focus();
        return;
    }
    // 🔎 Tipo efectivo según el largo: 8 = DNI, 9-12 = CE
    const tipoDoc = docNum.length === 8 ? 'DNI' : 'CE';
    if (!acepta) {
        if (aceptaInput) {
            aceptaInput.setAttribute('aria-invalid', 'true');
            aceptaInput.focus();
        }
        return mostrarMsg(msg, 'error', 'Debes aceptar el uso de tus datos para crear tu tarjeta.');
    }
    if (aceptaInput) aceptaInput.removeAttribute('aria-invalid');

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
            tipo_documento: tipoDoc,
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
            // ⚠️ maxLength queda fijo en 12 (HTML) y NO se borra lo escrito:
            // recortar a 8 rompía el CE y limpiar obligaba a reescribir el documento.
            if (numDocInput) {
                numDocInput.placeholder = tipoActual === 'CE' ? 'Ej: 123456789' : 'Ej: 12345678';
            }
        });
    }

    const form = document.getElementById('club-form');
    if (form) form.addEventListener('submit', crearTarjeta);

    // Validación inline: al salir del campo se valida; al escribir, solo se
    // refresca un error YA mostrado (no se regaña mientras se teclea la primera vez).
    CAMPOS_VALIDABLES.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('blur', () => {
            // Un campo VACÍO no se marca al salir: pulsar el botón CE o tabular
            // hacia adelante no debe disparar "falta el documento". Lo obligatorio
            // se reclama al enviar, no mientras el usuario explora el formulario.
            if (el.value.trim()) validarCampo(el);
            else limpiarErrorCampo(el);
        });
        el.addEventListener('input', () => {
            if (el.getAttribute('aria-invalid') === 'true') validarCampo(el);
        });
    });
    // El consentimiento también se marca y se limpia al marcarlo.
    const aceptaEl = document.getElementById('club-acepta');
    if (aceptaEl) aceptaEl.addEventListener('change', () => aceptaEl.removeAttribute('aria-invalid'));

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
