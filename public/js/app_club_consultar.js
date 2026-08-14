// ============================================
// 🎫 Club Calletano — Consulta de progreso (página club-consultar.html)
// ============================================
// - El cliente consulta su tarjeta (club_miembros/{documento}) y ve su avance
// - El QR codifica: https://calletano-restaurant.web.app/club-consultar.html?club=<documento>
//   (la app del mozo lo escaneará para registrar visitas)
// - La configuración del club (meta, premio, consumo) es FIJA: ya no se
//   lee de Firestore (contenido/clubConfig fue eliminado).
import { doc, getDoc } from './lib/firebase-bundle.js?v=5';
import { db, track } from './firebase-config.js';
import {
    normalizarDocumento,
    validarDocumento,
    extraerCodigoTarjeta,
    esCodigoLegacy,
    construirUrlTarjeta,
    calcularProgreso,
    enmascararDocumento,
    CLUB_CONFIG,
} from './clubHelpers.js';

// ── Pequeños helpers ──────────────────────────────────────────
function esc(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Consultando…';
    } else {
        btn.innerHTML = btn.dataset.label || 'Ver mi progreso';
    }
}

// ── Mostrar vistas ────────────────────────────────────────────
function mostrarVista(vista) {
    const consulta = document.getElementById('club-vista-consulta');
    const tarjeta = document.getElementById('club-vista-tarjeta');
    if (consulta) consulta.style.display = vista === 'consulta' ? '' : 'none';
    if (tarjeta) tarjeta.classList.toggle('show', vista === 'tarjeta');
}

// ── Render de la tarjeta digital ──────────────────────────────
// codigoEntrada: código con el que se abrió la tarjeta (token nuevo o DNI legacy)
function renderTarjeta(miembro, codigoEntrada) {
    if (!miembro) return;
    const visitas = parseInt(miembro.visitas || 0, 10) || 0;
    const prog = calcularProgreso(visitas, CLUB_CONFIG.visitas_para_premio);
    // 📊 Evento: alguien abrió su tarjeta (por QR, consulta o recién creada)
    track('club_tarjeta_vista', { completada: !!prog.completado });

    const elNombre = document.getElementById('club-tarjeta-nombre');
    const elDoc = document.getElementById('club-tarjeta-doc');
    const elSede = document.getElementById('club-tarjeta-sede');
    if (elNombre) elNombre.textContent = miembro.nombre || 'Socio Calletano';
    // 🔒 Privacidad: solo se muestran los últimos 4 dígitos del documento
    if (elDoc) elDoc.textContent = `${miembro.tipo_documento || 'DNI'} ${enmascararDocumento(miembro.documento)}`;
    if (elSede) elSede.textContent = CLUB_CONFIG.sede;

    // QR — 🔒 PRIVACIDAD: usa el token opaco de la tarjeta si existe; el
    // documento solo se usa como fallback para tarjetas legacy (sin token).
    const base = location && /^https?:$/.test(location.protocol) ? location.origin : 'https://calletano-restaurant.web.app';
    const codigoTarjeta = (miembro && miembro.token) || codigoEntrada || (miembro && miembro.documento) || '';
    const qrUrl = construirUrlTarjeta(codigoTarjeta, base);
    const qrImg = document.getElementById('club-tarjeta-qr');
    const qrUrlEl = document.getElementById('club-tarjeta-url');
    if (qrImg && window.qrcode) {
        try {
            const qr = window.qrcode(0, 'M');
            qr.addData(qrUrl);
            qr.make();
            qrImg.src = qr.createDataURL(8, 4);
            qrImg.classList.remove('d-none');
        } catch (e) {
            console.error('Club: no se pudo generar el QR:', e);
            qrImg.classList.add('d-none');
        }
    }
    // 🔒 PRIVACIDAD: NO se muestra la URL en texto porque contiene el documento.
    // El QR sí la codifica (es el mecanismo para registrar visitas en caja).
    if (qrUrlEl) qrUrlEl.textContent = 'Preséntala en caja al pagar';

    // Progreso
    const elVisitas = document.getElementById('club-tarjeta-visitas');
    const bar = document.getElementById('club-tarjeta-bar');
    const pct = document.getElementById('club-tarjeta-pct');
    const premio = document.getElementById('club-tarjeta-premio');
    const sellos = document.getElementById('club-sellos');

    if (elVisitas) elVisitas.textContent = `${prog.visitas} de ${prog.meta} visitas`;
    if (bar) {
        bar.style.width = '0%';
        // Pequeña pausa para que la animación de la barra se aprecie
        requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = `${prog.porcentaje}%`; }));
    }
    if (pct) pct.textContent = `${prog.porcentaje}%`;

    // 🎯 Sellos: un círculo por visita acumulada (se llenan con animación escalonada)
    if (sellos) {
        sellos.innerHTML = '';
        for (let i = 0; i < prog.meta; i++) {
            const sello = document.createElement('div');
            sello.setAttribute('aria-hidden', 'true');
            if (i < prog.visitas) {
                sello.className = 'club-sello lleno';
                sello.innerHTML = '<i class="fas fa-check"></i>';
                sello.style.animationDelay = `${i * 0.06}s`;
            } else {
                sello.className = 'club-sello';
            }
            sellos.appendChild(sello);
        }
    }

    if (premio) {
        if (prog.completado) {
            const premioTexto = CLUB_CONFIG.premio ? `<em>${esc(CLUB_CONFIG.premio)}</em>` : 'tu premio';
            premio.innerHTML = `
                <div class="club-premio-celebra"><i class="fas fa-trophy" aria-hidden="true"></i></div>
                <div>
                    <strong>¡Tu premio está listo! 🎉</strong>
                    <span class="d-block mt-1">Pásate por caja con tu <strong>DNI físico</strong> (mayores de 18) y reclama: ${premioTexto}.</span>
                </div>`;
            premio.className = 'club-premio club-premio-completado';
        } else {
            // Aún no llega al premio: mostramos cómo registrar la visita
            premio.textContent = 'Preséntala en caja al pagar: el personal la escanea y tu visita queda registrada.';
            premio.className = 'club-premio';
        }
    }

    // 🎉 Celebración: brillo + confeti cuando el premio está listo
    const wrap = document.getElementById('club-tarjeta-wrap');
    if (wrap) wrap.classList.toggle('club-tarjeta-completada', !!prog.completado);

    const confeti = document.getElementById('club-confetti');
    if (confeti) {
        confeti.innerHTML = '';
        if (prog.completado) {
            const colores = ['#0ff1f3', '#f6d35f', '#fffba4', '#e8993d', '#34d399', '#ffffff', '#ff6b6b'];
            const piezas = 26;
            for (let i = 0; i < piezas; i++) {
                const p = document.createElement('i');
                p.className = 'club-confeti-pieza';
                const size = 8 + Math.random() * 8;
                p.style.left = `${Math.random() * 100}%`;
                p.style.width = `${size}px`;
                p.style.height = `${Math.round(size * (0.5 + Math.random() * 0.7))}px`;
                p.style.background = colores[i % colores.length];
                p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
                p.style.animationDelay = `${(Math.random() * 1.2).toFixed(2)}s`;
                p.style.animationDuration = `${(2.4 + Math.random() * 1.8).toFixed(2)}s`;
                p.style.setProperty('--sway', `${Math.round(Math.random() * 140 - 70)}px`);
                confeti.appendChild(p);
            }
            confeti.classList.add('activo');
        } else {
            confeti.classList.remove('activo');
        }
    }

    // 📲 Compartir por WhatsApp (mensaje con el progreso actual).
    // 🔒 PRIVACIDAD: NO se incluye el link de la tarjeta (?club=<documento>)
    // porque el link contiene el documento completo. El QR de la tarjeta sigue
    // disponible para que el personal escanee las visitas en el local.
    const wspBtn = document.getElementById('club-wsp-btn');
    if (wspBtn) {
        const nombre = String(miembro.nombre || 'un socio').trim();
        let texto;
        if (prog.completado) {
            texto = `🎉 ¡Gané mi premio en el Club Calletano! Completé ${prog.meta} de ${prog.meta} visitas y mi premio (${CLUB_CONFIG.premio}) está listo para canjear. ¿Nos vemos en Máncora?`;
        } else if (prog.visitas === 0) {
            texto = `🎉 ¡Me uní al Club Calletano! Cada visita me acerca a mi premio: ${CLUB_CONFIG.premio}.`;
        } else {
            texto = `🎫 Soy ${nombre} y ya llevo ${prog.visitas} de ${prog.meta} visitas en el Club Calletano. Me faltan ${prog.restantes} para ganar ${CLUB_CONFIG.premio}. ¡Únete también!`;
        }
        wspBtn.href = `https://wa.me/?text=${encodeURIComponent(texto)}`;
        wspBtn.classList.remove('d-none');
    }

}

// ── Consultar progreso ────────────────────────────────────────
async function consultarProgreso() {
    const msg = document.getElementById('club-consulta-msg');
    const btn = document.getElementById('club-consulta-btn');
    const input = document.getElementById('club-consulta-doc');
    if (msg) msg.className = 'club-msg';

    const docNum = normalizarDocumento(input.value);
    if (!validarDocumento('AUTO', docNum)) {
        return mostrarMsg(msg, 'error', 'Ingresa un DNI (8 dígitos) o Carné de Extranjería (9 a 12 dígitos), sin puntos ni guiones.');
    }

    setLoading(btn, true);
    try {
        const snap = await getDoc(doc(db, 'club_miembros', docNum));
        if (!snap.exists()) {
            mostrarMsg(msg, 'error', 'Aún no tienes tarjeta del club. ¡Créala gratis en la página de registro!');
            const link = document.getElementById('club-consulta-link');
            if (link) link.classList.remove('d-none');
        } else {
            renderTarjeta(snap.data(), docNum);
            mostrarVista('tarjeta');
        }
    } catch (err) {
        console.error('Club: error al consultar progreso:', err);
        mostrarMsg(msg, 'error', 'No se pudo consultar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
        setLoading(btn, false);
    }
}

// ── Apertura directa desde el QR (?club=<token o documento>) ──
// 🔑 Resuelve el código de la tarjeta a su documento:
// - Código legacy (DNI/CE en el link): se usa directamente.
// - Token opaco: se lee club_tokens/{token} → documento (el DNI no viaja por URL).
async function resolverCodigoTarjeta(codigo) {
    const c = String(codigo || '').trim();
    if (!c) return null;
    if (esCodigoLegacy(c)) return normalizarDocumento(c);
    try {
        const snap = await getDoc(doc(db, 'club_tokens', c.toUpperCase()));
        if (!snap.exists()) return null;
        const documento = String((snap.data() || {}).documento || '').replace(/[^0-9]/g, '');
        return validarDocumento('AUTO', documento) ? documento : null;
    } catch (e) {
        console.warn('Club: no se pudo resolver el token de la tarjeta:', e && e.message ? e.message : e);
        return null;
    }
}

async function manejarParametroClub() {
    const raw = new URLSearchParams(location.search).get('club');
    const codigo = raw ? extraerCodigoTarjeta(raw) : null;
    if (!codigo) return;
    try {
        const documento = await resolverCodigoTarjeta(codigo);
        if (!documento) {
            const msg = document.getElementById('club-consulta-msg');
            if (msg) mostrarMsg(msg, 'error', 'Ese código no corresponde a una tarjeta del club.');
            return;
        }
        const snap = await getDoc(doc(db, 'club_miembros', documento));
        if (snap.exists()) {
            renderTarjeta(snap.data(), codigo);
            mostrarVista('tarjeta');
        } else {
            const msg = document.getElementById('club-consulta-msg');
            if (msg) mostrarMsg(msg, 'error', 'Ese código aún no tiene tarjeta del club.');
        }
    } catch (e) {
        console.warn('Club: no se pudo abrir la tarjeta desde el QR.', e);
    }
}

// ── Inicialización ────────────────────────────────────────────
function initClub() {
    // Textos de config hardcodeada (ya no se lee de Firestore)
    const metaEl = document.getElementById('club-meta-text-prox');
    if (metaEl) metaEl.textContent = `Meta de ${CLUB_CONFIG.visitas_para_premio} visitas y un premio al completarlas.`;

    const consultaBtn = document.getElementById('club-consulta-btn');
    const consultaInput = document.getElementById('club-consulta-doc');
    if (consultaBtn) consultaBtn.addEventListener('click', consultarProgreso);
    if (consultaInput) {
        consultaInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') consultarProgreso();
        });
    }

    const volver = document.getElementById('club-volver-btn');
    if (volver) volver.addEventListener('click', () => mostrarVista('consulta'));

    manejarParametroClub();
}

// Los módulos se ejecutan después de parsear el DOM, así que
// el DOM ya está listo cuando llamamos initClub().
// (La redirección de QRs antiguos con ?club= la maneja index.html inline.)
initClub();

// ============================================
// EVENTOS DE CONVERSIÓN (Firebase Analytics)
// ============================================
const wspBtn = document.getElementById('club-wsp-btn');
if (wspBtn) wspBtn.addEventListener('click', () => track('click_whatsapp', { origen: 'club_tarjeta' }));
