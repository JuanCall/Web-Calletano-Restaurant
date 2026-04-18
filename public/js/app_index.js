import { doc, getDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

async function cargarDocumento(id, cb) { 
    try { const s = await getDoc(doc(db, "contenido", id)); cb(s.exists() ? s.data() : {}); } catch (e) { console.error(e); } 
}
function setHref(id, v) { const e = document.getElementById(id); if (e && v) e.href = v; }
function crearTarjetaPlato(p, c) { return `<div class="${c === 4 ? 'col-md-4' : 'col-md-3'} mb-4"><div class="card h-100 shadow-sm border-0"><img src="${p.img}" class="card-img-top" style="height:${c === 4 ? '200px' : '150px'};object-fit:cover;"><div class="card-body text-center"><h5 class="fw-bold">${p.titulo}</h5><p class="text-muted small">${p.desc}</p></div></div></div>`; }
function generarEstrellasHTML(pts) { let h = ""; for (let i = 1; i <= 5; i++) h += `<i class="${i <= pts ? 'fas' : 'far'} fa-star text-warning"></i>`; return h; }

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

    if (estaAbierto) statusDiv.innerHTML = `<span class="badge rounded-pill bg-success px-3 py-2 shadow animate__animated animate__fadeIn"><i class="fas fa-door-open me-1"></i> ${mensaje}</span>`;
    else statusDiv.innerHTML = `<span class="badge rounded-pill bg-danger px-3 py-2 shadow animate__animated animate__fadeIn"><i class="fas fa-door-closed me-1"></i> ${mensaje}</span>`;
});

cargarDocumento("contacto", (data) => {
    setHref('link-fb', data.facebook); setHref('link-ig', data.instagram); setHref('btn-wsp', `https://wa.me/${data.whatsapp}`);
});

cargarDocumento("menuDiario", (d) => {
    const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt || "No disponible"; };
    setTxt('menu-refresco', d.refresco);
    
    const titleEl = document.getElementById('main-menu-title'); const colEntradas = document.getElementById('col-entradas'); const colSegundos = document.getElementById('col-segundos'); const headerSegundos = document.getElementById('header-segundos'); const listaEntradas = document.getElementById('menu-entradas-list'); const listaSegundos = document.getElementById('menu-segundos-list');
    
    if (titleEl) titleEl.innerText = d.titulo || "Menú del Día 🍽️";

    if (listaEntradas) {
        if (d.entradas && Array.isArray(d.entradas) && d.entradas.length > 0) listaEntradas.innerHTML = d.entradas.map(e => `<li class="fs-5 fw-bold text-dark border-bottom border-warning-subtle py-2"><i class="fas fa-check text-warning me-2 small"></i>${e.nombre}</li>`).join("");
        else listaEntradas.innerHTML = `<li class="fs-5 fw-bold text-dark text-center">${d.entrada || "Por definir"}</li>`;
    }

    if (listaSegundos) {
        if (d.segundos && Array.isArray(d.segundos) && d.segundos.length > 0) {
            let htmlSegundos = ""; const gruposAcomp = {};
            d.segundos.forEach(s => { const acomp = (s.acomp || "").trim(); if (!gruposAcomp[acomp]) gruposAcomp[acomp] = []; gruposAcomp[acomp].push(s.nombre); });

            Object.keys(gruposAcomp).forEach(acomp => {
                const platos = gruposAcomp[acomp];
                platos.forEach((nombre, idx) => {
                    const isLast = (idx === platos.length - 1); const hasAcomp = (acomp !== "");
                    const borderClass = (isLast && hasAcomp) ? "" : "border-bottom border-danger-subtle pb-2";
                    htmlSegundos += `<li class="pt-2 ${borderClass}"><div class="fs-5 fw-bold text-dark"><i class="fas fa-check text-danger me-2 small"></i>${nombre}</div></li>`;
                });
                if (acomp !== "") {
                    let textoPrefijo = "Con:";
                    if (Object.keys(gruposAcomp).length === 1 && platos.length > 1) textoPrefijo = "Todos salen con:";
                    else if (platos.length > 1) textoPrefijo = "Salen con:";
                    htmlSegundos += `<li class="pb-2 mb-2 border-bottom border-danger-subtle"><div class="d-inline-block bg-danger bg-opacity-10 rounded px-2 py-1 mt-1 ms-4 border border-danger-subtle shadow-sm"><span class="small text-danger fw-bold fst-italic"><i class="fas fa-utensils me-1"></i>${textoPrefijo} ${acomp}</span></div></li>`;
                }
            });
            listaSegundos.innerHTML = htmlSegundos;
        } else { listaSegundos.innerHTML = `<li class="fs-5 fw-bold text-dark text-center">${d.segundo || "Por definir"}</li>`; }
    }

    if (d.modoDomingo) {
        if (colEntradas) colEntradas.style.display = 'none';
        if (colSegundos) { colSegundos.className = "col-md-8 mb-4 mx-auto"; if (headerSegundos) headerSegundos.innerHTML = "<h3>PLATOS ESPECIALES</h3>"; }
    } else {
        if (colEntradas) colEntradas.style.display = 'block';
        if (colSegundos) { colSegundos.className = "col-md-5 mb-4"; if (headerSegundos) headerSegundos.innerHTML = "<h3>SEGUNDOS</h3>"; }
    }
});

const cargarLista = (docId, containerId, cols) => {
    const el = document.getElementById(containerId);
    if(el) {
        let skeletonHTML = "";
        for(let i=0; i<cols; i++) skeletonHTML += `<div class="${cols === 4 ? 'col-md-3' : 'col-md-4'} mb-4"><div class="skeleton skeleton-img"></div><div class="skeleton skeleton-text mt-2" style="width: 60%"></div><div class="skeleton skeleton-text" style="width: 80%"></div></div>`;
        el.innerHTML = skeletonHTML;
    }
    cargarDocumento(docId, (data) => {
        if (el) {
            if (data.lista && data.lista.length > 0) { el.innerHTML = ""; data.lista.forEach(p => el.innerHTML += crearTarjetaPlato(p, cols)); } 
            else { el.innerHTML = `<div class="col-12 text-center mt-4"><p class="text-muted fst-italic"><i class="fas fa-utensils"></i> Actualizando nuestra lista de platos...</p></div>`; }
        }
    });
};
cargarLista("favoritos", "favoritos-container", 4);
cargarLista("domingo", "domingo-container", 3);

const group1 = document.getElementById('reviews-group-1'); const group2 = document.getElementById('reviews-group-2'); const genericReviewContainer = document.getElementById('reviews-container') || document.getElementById('resenas-container') || document.querySelector('.reviews-section');
const renderContenedorResenas = (html) => {
    if (group1 && group2) { group1.innerHTML = html; group2.innerHTML = html; } else if (group1) { group1.innerHTML = html; } else if (genericReviewContainer) { genericReviewContainer.innerHTML = html; }
};

if (group1 || genericReviewContainer) {
    getDocs(query(collection(db, "resenas"), where("aprobada", "==", true))).then((snapshot) => {
        if (snapshot.empty) { renderContenedorResenas(`<div class="w-100 text-center p-4"><p class="text-muted fst-italic">Aún no hay reseñas publicadas. ¡Sé el primero en visitarnos!</p></div>`); } 
        else {
            let htmlResenas = "";
            snapshot.forEach((doc) => { const d = doc.data(); htmlResenas += `<div class="review-card"><div class="mb-2 fs-5 text-center">${generarEstrellasHTML(d.estrellas || 5)}</div><p class="fst-italic text-muted text-center small">"${d.mensaje}"</p><div class="mt-auto pt-2 border-top text-center"><strong class="text-dark small">${d.autor}</strong></div></div>`; });
            renderContenedorResenas(htmlResenas);
        }
    }).catch(e => { console.error(e); renderContenedorResenas(`<div class="w-100 text-center"><p class="text-danger">Error al cargar opiniones.</p></div>`); });
}