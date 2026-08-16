import { doc, getDoc, getDocs, collection, query, where, getDocFromServer } from './lib/firebase-bundle.js?v=4';
import { db, track } from "./firebase-config.js?v=4";
import { renderMenuDiario, esc } from './menuRenderer.js?v=4';

// ============================================
// NAVBAR — SCROLL STATE & TOGGLE (vanilla JS)
// ============================================
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');

if (navbar) {
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 80) {
            navbar.classList.add('navbar-scrolled');
        } else {
            navbar.classList.remove('navbar-scrolled');
        }
    }, { passive: true });
}

if (navToggle && navMenu) {
    // El toggle del menú lo gestiona Bootstrap Collapse (data-bs-toggle en el HTML).
    // Aquí solo sincronizamos el estado visual y el bloqueo de scroll con los eventos
    // de Bootstrap, para no pelear con 'aria-expanded' que Bootstrap ya actualiza.
    // (Si se lee 'aria-expanded' en un listener propio, la lógica queda invertida:
    //  al abrir no bloquea el scroll y al cerrar lo deja bloqueado.)
    navMenu.addEventListener('show.bs.collapse', () => {
        navToggle.classList.add('active');
        navMenu.classList.add('active');
        document.body.style.overflow = 'hidden';
    });

    navMenu.addEventListener('hidden.bs.collapse', () => {
        navToggle.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.style.overflow = '';
    });

    // Al elegir un destino, cerrar el menú móvil y liberar el scroll
    navMenu.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            const bsCollapse = window.bootstrap ? window.bootstrap.Collapse.getOrCreateInstance(navMenu) : null;
            if (bsCollapse) {
                bsCollapse.hide();
            } else {
                navToggle.classList.remove('active');
                navMenu.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });

    // Al pasar a escritorio con el menú abierto, liberar el scroll
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 992 && navMenu.classList.contains('active')) {
            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}

// ============================================
// SCROLL REVEAL — Intersection Observer
// ============================================
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

document.querySelectorAll('[data-reveal]').forEach(el => {
    revealObserver.observe(el);
});

// ============================================
// FIREBASE HELPERS
// ============================================
async function cargarDocumento(id, cb, desdeServidor = false) {
    const ref = doc(db, "contenido", id);
    try {
        if (desdeServidor) {
            // 🛡️ Resiliencia: ante fallas transitorias de red (típicas en móviles),
            // reintentamos UNA vez el servidor antes de caer a la caché local.
            let s;
            try {
                s = await getDocFromServer(ref);
            } catch {
                await new Promise(r => setTimeout(r, 1500));
                s = await getDocFromServer(ref);
            }
            cb(s.exists() ? s.data() : {});
        } else {
            const s = await getDoc(ref);
            cb(s.exists() ? s.data() : {});
        }
    } catch (e) {
        console.error(`Error cargando "${id}":`, e);
        if (desdeServidor) {
            try {
                const cacheSnap = await getDoc(ref, { source: 'cache' });
                cb(cacheSnap.exists() ? cacheSnap.data() : {});
            } catch (_) {}
        }
    }
}

function setHref(id, v) {
    const e = document.getElementById(id);
    if (e && v) e.href = v;
}

function generarEstrellasHTML(pts) {
    let h = "";
    for (let i = 1; i <= 5; i++) h += `<i class="${i <= pts ? 'fas' : 'far'} fa-star" aria-hidden="true"></i>`;
    return h;
}

// Formatea una hora entera (ej. 11) como "11:00" para textos y schema.org
function horaTexto(h) {
    return String(h).padStart(2, '0') + ':00';
}

// Actualiza el JSON-LD del Restaurant (id="schema-restaurant") con datos reales
// cargados desde Firestore, para que los horarios y la valoración que ve Google
// coincidan con lo que ve el cliente en la página.
function actualizarSchemaRestaurante(patch) {
    const script = document.getElementById('schema-restaurant');
    if (!script) return;
    try {
        const data = JSON.parse(script.textContent);
        Object.assign(data, patch);
        script.textContent = JSON.stringify(data);
    } catch (e) {
        console.warn('No se pudo actualizar el schema del restaurante:', e);
    }
}

// ============================================
// MODAL — soporta modales de Bootstrap (class="modal")
// y el sistema propio en vanilla JS (class="modal-overlay")
// ============================================
function abrirModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    if (modal.classList.contains('modal') && window.bootstrap) {
        window.bootstrap.Modal.getOrCreateInstance(modal).show();
        return;
    }

    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
        const closeBtn = modal.querySelector('.modal-close-btn, [data-modal-close]');
        if (closeBtn) closeBtn.focus();
    }, 100);
}

function cerrarModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    if (modal.classList.contains('modal') && window.bootstrap) {
        window.bootstrap.Modal.getOrCreateInstance(modal).hide();
        return;
    }

    modal.setAttribute('hidden', '');
    document.body.style.overflow = '';
}

document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) cerrarModal(modal.id);
    });
    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') cerrarModal(modal.id);
    });
});

document.querySelectorAll('.modal-close-btn, [data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-overlay');
        if (modal) cerrarModal(modal.id);
    });
});

// ============================================
// STATUS RESTAURANTE — Abierto/Cerrado
// ============================================
cargarDocumento("configuracion", (config) => {
    const heroStatus = document.getElementById('status-restaurante');
    if (!heroStatus) return;

    const ahora = new Date();
    const horaActual = ahora.getHours();
    const fechaHoy = ahora.toISOString().split('T')[0];
    const apertura = config.apertura || 12;
    const cierre = config.cierre || 22;
    const cierreForzado = config.cierreForzado || "";

    let mensaje = "";
    let clase = "";

    if (cierreForzado === fechaHoy) {
        mensaje = "Hoy no atendemos";
        clase = "badge-closed";
        setTimeout(() => abrirModal('modalCerrado'), 600);
    } else {
        if (horaActual >= apertura && horaActual < cierre) {
            mensaje = `Abierto ahora — ${horaTexto(apertura)} a ${horaTexto(cierre)}`;
            clase = "badge-open";
        } else {
            mensaje = `Cerrado por ahora — Abrimos ${horaTexto(apertura)}`;
            clase = "badge-closed";
        }
    }

    heroStatus.innerHTML = `<span class="hero-status-badge ${clase}">
        <span class="badge-dot"></span> ${mensaje}
    </span>`;

    // Mantiene el horario del schema.org sincronizado con el horario real
    // configurado en Firestore (antes quedaba fijo en "11:00 a 18:00").
    actualizarSchemaRestaurante({
        openingHoursSpecification: [
            {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
                "opens": horaTexto(apertura),
                "closes": horaTexto(cierre)
            }
        ]
    });
});

// ============================================
// CONTACTO — Redes Sociales
// ============================================
cargarDocumento("contacto", (data) => {
    setHref('link-fb', data.facebook);
    setHref('link-ig', data.instagram);
    setHref('btn-wsp', `https://wa.me/${data.whatsapp}`);
});

// ============================================
// MENÚ DEL DÍA (desde servidor)
// ============================================
cargarDocumento("menuDiario", (d) => {
    renderMenuDiario(d, {
        titleEl: document.getElementById('main-menu-title'),
        colEntradas: document.getElementById('col-entradas'),
        colSegundos: document.getElementById('col-segundos'),
        headerSegundos: document.getElementById('header-segundos'),
        listaEntradas: document.getElementById('menu-entradas-list'),
        listaSegundos: document.getElementById('menu-segundos-list'),
        refrescoEl: document.getElementById('menu-refresco'),
    });
}, true);

// ============================================
// BLUR-UP LAZY LOADING
// ============================================
function initBlurUp() {
    const imgs = document.querySelectorAll('.img-blur');
    imgs.forEach(img => {
        if (img.complete && img.naturalWidth > 0) {
            img.classList.add('img-blur-loaded');
        } else {
            img.addEventListener('load', () => {
                img.classList.add('img-blur-loaded');
            }, { once: true });
            img.addEventListener('error', () => {
                img.classList.add('img-blur-loaded');
            }, { once: true });
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBlurUp);
} else {
    initBlurUp();
}

// ============================================
// RESEÑAS
// ============================================
const track1 = document.getElementById('reviews-group-1');
const track2 = document.getElementById('reviews-group-2');

function mostrarSkeletonsResenas() {
    if (!track1) return;
    let html = "";
    for (let i = 0; i < 4; i++) {
        html += `<div class="review-card">
            <div class="d-flex justify-content-center" style="gap:4px;">
                <div class="skeleton" style="width:18px;height:18px;border-radius:2px;"></div>
                <div class="skeleton" style="width:18px;height:18px;border-radius:2px;"></div>
                <div class="skeleton" style="width:18px;height:18px;border-radius:2px;"></div>
                <div class="skeleton" style="width:18px;height:18px;border-radius:2px;"></div>
            </div>
            <div class="skeleton skeleton-text" style="width:100%;"></div>
            <div class="skeleton skeleton-text-short"></div>
        </div>`;
    }
    track1.innerHTML = html;
    if (track2) track2.innerHTML = html;
}

mostrarSkeletonsResenas();

// Cargar reseñas desde Firebase (colección raíz "resenas", 31 documentos)
// 🛡️ Resiliencia: reintenta UNA vez ante fallas transitorias de red.
async function cargarResenas() {
    try {
        const ref = collection(db, "resenas");
        let snapshot;
        try {
            snapshot = await getDocs(ref);
        } catch {
            await new Promise(r => setTimeout(r, 1500));
            snapshot = await getDocs(ref);
        }
        const docs = [];
        snapshot.forEach(doc => docs.push(doc.data()));
        
        // Filtrar solo aprobadas y ordenar por fecha (más recientes primero)
        const items = docs
            .filter(d => d.aprobada !== false)
            .sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));

        if (items.length === 0) {
            if (track1) track1.innerHTML = '<p class="text-muted text-center">No hay reseñas aún.</p>';
            if (track2) track2.innerHTML = '';
            return;
        }

        // Agrega el rating promedio real al schema.org del restaurante, para
        // que los resultados de búsqueda puedan mostrar estrellas.
        const promedio = items.reduce((suma, d) => suma + (d.estrellas || 5), 0) / items.length;
        actualizarSchemaRestaurante({
            aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: promedio.toFixed(1),
                reviewCount: items.length
            }
        });

        // Mezclar aleatoriamente para variedad en cada carga
        const shuffled = [...items].sort(() => Math.random() - 0.5);
        
        function renderCards(lista) {
            return lista.map(d => `
                <div class="review-card">
                    <div class="review-stars">${generarEstrellasHTML(d.estrellas || 5)}</div>
                    <p class="review-text">"${esc(d.mensaje)}"</p>
                    <div class="review-author">${esc(d.autor) || 'Anónimo'}</div>
                </div>
            `).join('');
        }

        // ⚠️ Ambos tracks deben tener el MISMO contenido para el carrusel infinito
        // Track2 es un clon visual de track1; cuando track1 se desplaza -100%
        // track2 (contenido identico) aparece sin costura en su lugar.
        const html = renderCards(shuffled);
        if (track1) track1.innerHTML = html;
        if (track2) track2.innerHTML = html;
    } catch (e) {
        console.error('Error cargando reseñas:', e);
        if (track1) track1.innerHTML = '<p class="text-muted text-center">Error al cargar reseñas.</p>';
    }
}

cargarResenas();

// ============================================
// EVENTOS DE CONVERSIÓN (Firebase Analytics)
// ============================================
function rastrearClicksLanding() {
    // "VER CARTA Y PRECIOS" (hero y modal) y "NUESTRA CARTA" (nav)
    document.querySelectorAll('a[href="carta.html"].btn-hero, a[href="carta.html"].btn-nav-carta').forEach(el => {
        el.addEventListener('click', () => track('click_ver_carta', { origen: 'landing' }));
    });

    // WhatsApp flotante
    const wsp = document.getElementById('btn-wsp');
    if (wsp) wsp.addEventListener('click', () => track('click_whatsapp', { origen: 'landing' }));

    // Cómo llegar
    const mapa = document.querySelector('.btn-mapa');
    if (mapa) mapa.addEventListener('click', () => track('click_como_llegar', { origen: 'landing' }));

    // Déjanos tu opinión
    const resena = document.querySelector('a[href^="https://g.page/"]');
    if (resena) resena.addEventListener('click', () => track('click_resena', { origen: 'landing' }));

    // Redes sociales
    const fb = document.getElementById('link-fb');
    if (fb) fb.addEventListener('click', () => track('click_social', { red: 'facebook' }));
    const ig = document.getElementById('link-ig');
    if (ig) ig.addEventListener('click', () => track('click_social', { red: 'instagram' }));

    // Club — nav apunta a la sección #club de la landing
    document.querySelectorAll('.nav-link[href="#club"]').forEach(el => {
        el.addEventListener('click', () => track('click_club', { accion: 'seccion' }));
    });

    // Club — botones de la sección: registro y consulta de progreso
    const btnClubCrear = document.querySelector('a[href="club-crear.html"]');
    if (btnClubCrear) btnClubCrear.addEventListener('click', () => track('click_club', { accion: 'crear' }));
    const btnClubConsultar = document.querySelector('a[href="club-consultar.html"]');
    if (btnClubConsultar) btnClubConsultar.addEventListener('click', () => track('click_club', { accion: 'consultar' }));
}
rastrearClicksLanding();