import { doc, getDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { renderMenuDiario } from './menuRenderer.js';

// ============================================
// SCROLL REVEAL - Intersection Observer
// ============================================
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            revealObserver.unobserve(entry.target);
        }
    });
}, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
});

// type="module" es defer, DOM ya está listo
document.querySelectorAll('[data-reveal]').forEach(el => {
    revealObserver.observe(el);
});

async function cargarDocumento(id, cb) { 
    try { const s = await getDoc(doc(db, "contenido", id)); cb(s.exists() ? s.data() : {}); } catch (e) { console.error(e); } 
}
function setHref(id, v) { const e = document.getElementById(id); if (e && v) e.href = v; }
function crearTarjetaPlato(p, c) { return `<div class="${c === 4 ? 'col-md-4' : 'col-md-3'} mb-4"><div class="card h-100 shadow-sm border-0"><img src="${p.img}" class="card-img-top" style="height:${c === 4 ? '200px' : '150px'};object-fit:cover;" alt="${p.titulo}" loading="lazy"><div class="card-body text-center"><h5 class="fw-bold">${p.titulo}</h5><p class="text-muted small">${p.desc}</p></div></div></div>`; }
function generarEstrellasHTML(pts) { let h = ""; for (let i = 1; i <= 5; i++) h += `<i class="${i <= pts ? 'fas' : 'far'} fa-star text-warning" aria-hidden="true"></i>`; return h; }

// ============================================
// 🚫 [DESACTIVADO] BANNER DE NOTIFICACIONES PUSH
// Por decisión del dueño, no se envían notificaciones push a clientes
// por la página web. El código se mantiene comentado.
// ============================================

// async function initBannerNotificaciones() {
//     const banner = document.getElementById('notif-banner');
//     ... código de notificaciones ...
// }
// initBannerNotificaciones();

cargarDocumento("configuracion", (config) => {
    const statusDiv = document.getElementById('status-restaurante');
    if (!statusDiv) return;

    const ahora = new Date(); const horaActual = ahora.getHours(); const fechaHoy = ahora.toISOString().split('T')[0];
    const apertura = config.apertura || 12; const cierre = config.cierre || 22; const cierreForzado = config.cierreForzado || "";

    let estaAbierto = false; let mensaje = "";

    if (cierreForzado === fechaHoy) {
        estaAbierto = false; mensaje = "HOY NO ATENDEMOS";
        const modalEl = document.getElementById('modalCerrado');
        if(modalEl) setTimeout(() => { new bootstrap.Modal(modalEl).show(); }, 500);
    } else {
        if (horaActual >= apertura && horaActual < cierre) { estaAbierto = true; mensaje = "ABIERTO AHORA"; } 
        else { estaAbierto = false; mensaje = "CERRADO POR AHORA"; }
    }

    if (estaAbierto) statusDiv.innerHTML = `<span class="badge rounded-pill bg-success px-3 py-2 shadow animate__animated animate__fadeIn"><i class="fas fa-door-open me-1" aria-hidden="true"></i> ${mensaje}</span>`;
    else statusDiv.innerHTML = `<span class="badge rounded-pill bg-danger px-3 py-2 shadow animate__animated animate__fadeIn"><i class="fas fa-door-closed me-1" aria-hidden="true"></i> ${mensaje}</span>`;
});

cargarDocumento("contacto", (data) => {
    setHref('link-fb', data.facebook); setHref('link-ig', data.instagram); setHref('btn-wsp', `https://wa.me/${data.whatsapp}`);
});

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
});

const cargarLista = (docId, containerId, cols) => {
    const el = document.getElementById(containerId);
    if(el) {
        let skeletonHTML = "";
        for(let i=0; i<cols; i++) {
            const delay = i * 0.12;
            skeletonHTML += `<div class="${cols === 4 ? 'col-md-3' : 'col-md-4'} mb-4">
                <div class="skeleton-card shadow-sm">
                    <div class="skeleton skeleton-img" style="--sk-delay: ${delay}s"></div>
                    <div class="skeleton-card-body">
                        <div class="skeleton skeleton-text" style="width: 70%; --sk-delay: ${delay}s"></div>
                        <div class="skeleton skeleton-text skeleton-text-short" style="--sk-delay: ${delay + 0.1}s"></div>
                    </div>
                </div>
            </div>`;
        }
        el.innerHTML = skeletonHTML;
    }
    cargarDocumento(docId, (data) => {
        if (el) {
            if (data.lista && data.lista.length > 0) { el.innerHTML = ""; data.lista.forEach(p => el.innerHTML += crearTarjetaPlato(p, cols)); } 
            else { el.innerHTML = `<div class="col-12 text-center mt-4"><p class="text-muted fst-italic"><i class="fas fa-utensils" aria-hidden="true"></i> Actualizando nuestra lista de platos...</p></div>`; }
        }
    });
};
cargarLista("favoritos", "favoritos-container", 4);
cargarLista("domingo", "domingo-container", 3);

// ============================================
// RESEÑAS
// ============================================
const group1 = document.getElementById('reviews-group-1'); const group2 = document.getElementById('reviews-group-2'); const genericReviewContainer = document.getElementById('reviews-container') || document.getElementById('resenas-container') || document.querySelector('.reviews-section');
const renderContenedorResenas = (html) => {
    if (group1 && group2) { group1.innerHTML = html; group2.innerHTML = html; } else if (group1) { group1.innerHTML = html; } else if (genericReviewContainer) { genericReviewContainer.innerHTML = html; }
};

// Mostrar skeletons mientras cargan las reseñas
function mostrarSkeletonsResenas() {
    let html = "";
    for (let i = 0; i < 4; i++) {
        const delay = i * 0.15;
        html += `<div class="skeleton-review" style="--sk-delay: ${delay}s">
            <div class="d-flex gap-2">
                <div class="skeleton skeleton-circle" style="--sk-delay: ${delay}s"></div>
                <div class="flex-grow-1" style="padding-top: 4px;">
                    <div class="skeleton skeleton-text" style="width: 50%; --sk-delay: ${delay}s"></div>
                    <div class="skeleton skeleton-text-short" style="--sk-delay: ${delay + 0.08}s"></div>
                </div>
            </div>
            <div class="skeleton skeleton-text" style="width: 90%; --sk-delay: ${delay + 0.05}s"></div>
            <div class="skeleton skeleton-text" style="width: 75%; --sk-delay: ${delay + 0.1}s"></div>
        </div>`;
    }
    renderContenedorResenas(html);
}

if (group1 || genericReviewContainer) {
    mostrarSkeletonsResenas();
    getDocs(query(collection(db, "resenas"), where("aprobada", "==", true))).then((snapshot) => {
        if (snapshot.empty) { renderContenedorResenas(`<div class="w-100 text-center p-4"><p class="text-muted fst-italic">Aún no hay reseñas publicadas. ¡Sé el primero en visitarnos!</p></div>`); } 
        else {
            let htmlResenas = "";
            snapshot.forEach((doc) => { const d = doc.data(); htmlResenas += `<div class="review-card"><div class="mb-2 fs-5 text-center">${generarEstrellasHTML(d.estrellas || 5)}</div><p class="fst-italic text-muted text-center small">"${d.mensaje}"</p><div class="mt-auto pt-2 border-top text-center"><strong class="text-dark small">${d.autor}</strong></div></div>`; });
            renderContenedorResenas(htmlResenas);
        }
    }).catch(e => { console.error(e); renderContenedorResenas(`<div class="w-100 text-center"><p class="text-danger">Error al cargar opiniones.</p></div>`); });
}