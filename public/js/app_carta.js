import { doc, getDoc, getDocFromServer } from './lib/firebase-bundle.js?v=4';
import { db, track } from "./firebase-config.js?v=4";

// 🛡️ Escapa texto antes de insertarlo con innerHTML (previene XSS en la carta).
// La carta viene de Firestore (contenido/cartaCompleta): nombres, descripciones,
// precios y columnas son editables y podrían contener HTML malicioso.
function esc(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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
}, { threshold: 0.15, rootMargin: '0px 0px -30px 0px' });

const navContainer = document.getElementById('nav-categorias');
const mainContainer = document.getElementById('menu-render');

// Skeleton loading mientras carga Firebase
function mostrarSkeletons() {
    if (!mainContainer) return;
    let html = '';
    for (let i = 0; i < 3; i++) {
        const delay = i * 0.15;
        html += `<div class="skeleton-card" style="--sk-delay: ${delay}s">
            <div style="padding: 25px;">
                <div class="skeleton skeleton-header" style="--sk-delay: ${delay}s"></div>
                <div class="skeleton-items">
                    ${[1,2,3].map(j => `
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: baseline;">
                                <div class="skeleton skeleton-line" style="width: 60%; --sk-delay: ${delay + j * 0.05}s"></div>
                                <div class="skeleton skeleton-price" style="--sk-delay: ${delay + j * 0.05}s"></div>
                            </div>
                            <div class="skeleton skeleton-line-short" style="--sk-delay: ${delay + j * 0.08}s"></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>`;
    }
    mainContainer.innerHTML = html;
}

mostrarSkeletons();

// 🛡️ cartaCompleta se carga desde el servidor para evitar caché corrupta.
// Resiliencia: ante fallas transitorias de red se reintenta UNA vez y, si sigue
// fallando, getDoc() cae automáticamente a la caché local (última versión vista).
const refCarta = doc(db, "contenido", "cartaCompleta");
function cargarCartaDesdeServidor() {
    return getDocFromServer(refCarta)
        .catch(() => new Promise(r => setTimeout(r, 1500)).then(() => getDocFromServer(refCarta)))
        .catch(() => getDoc(refCarta));
}

cargarCartaDesdeServidor()
.then((docSnap) => {
    if (!docSnap.exists() || !docSnap.data().categorias) {
        if (mainContainer) mainContainer.innerHTML = "<p style='text-align:center; padding:20px;' class='text-muted'>Estamos armando nuestra carta virtual. ¡Vuelve pronto!</p>";
        return;
    }
    const categorias = docSnap.data().categorias;
    let navHTML = ""; let bodyHTML = "";

    categorias.forEach((cat, index) => {
        const catId = `cat-${index}`;
        navHTML += `<a href="#${catId}" class="nav-btn">${esc(cat.nombre)}</a>`;
        
        let headerHTML = "";
        if (cat.col1 || cat.col2) headerHTML = `<div class="price-header"><div class="ph-col">${esc(cat.col1)}</div><div class="ph-col">${esc(cat.col2)}</div></div>`;

        let itemsHTML = "";
        cat.items.forEach(item => {
            let preciosHTML = "";
            if (item.precio2) { preciosHTML = `<div class="price-val">${esc(item.precio)}</div><div class="price-val">${esc(item.precio2)}</div>`; } 
            else {
                if (cat.col1 || cat.col2) { preciosHTML = `<div class="price-val">${esc(item.precio)}</div><div class="price-val"></div>`; } 
                else { preciosHTML = `<div class="price-val">${esc(item.precio)}</div>`; }
            }
            const descHTML = item.desc ? `<div class="item-desc">${esc(item.desc)}</div>` : '';
            itemsHTML += `<div class="item-wrapper"><div class="item-row"><div class="item-info"><span class="item-name">${esc(item.nombre)}</span><span class="dots"></span></div><div class="price-wrapper">${preciosHTML}</div></div>${descHTML}</div>`;
        });
        bodyHTML += `<div id="${catId}" class="menu-card"><h3 class="cat-title">${esc(cat.nombre)} <i class="fas fa-utensils" style="font-size:1rem; opacity:0.3;"></i></h3>${headerHTML}${itemsHTML}</div>`;
    });
    if (navContainer) navContainer.innerHTML = navHTML;
    if (mainContainer) {
        mainContainer.innerHTML = bodyHTML;
        // Observar cada tarjeta para scroll reveal
        mainContainer.querySelectorAll('.menu-card').forEach((card, i) => {
            card.style.setProperty('--reveal-delay', `${i * 0.1}s`);
            card.style.transitionDelay = `${i * 0.1}s`;
            revealObserver.observe(card);
        });
    }

    // 🍽️ Schema Menu (datos REALES de Firestore) para rich results de menú en Google.
    // Se genera dinámicamente con los mismos datos que pinta la carta: nada inventado.
    try {
        const menuSections = categorias.map((cat) => {
            const items = (cat.items || [])
                .map((item) => {
                    const ofertas = [];
                    const p1 = parseFloat(String(item.precio || '').replace(/[^0-9.,]/g, '').replace(',', '.'));
                    if (!isNaN(p1)) ofertas.push({ '@type': 'Offer', price: p1, priceCurrency: 'PEN' });
                    const p2 = parseFloat(String(item.precio2 || '').replace(/[^0-9.,]/g, '').replace(',', '.'));
                    if (!isNaN(p2)) ofertas.push({ '@type': 'Offer', price: p2, priceCurrency: 'PEN' });
                    const mi = { '@type': 'MenuItem', name: item.nombre };
                    if (item.desc) mi.description = item.desc;
                    if (ofertas.length === 1) mi.offers = ofertas[0];
                    else if (ofertas.length > 1) mi.offers = ofertas;
                    return mi;
                })
                .filter((mi) => mi && mi.name);
            return { '@type': 'MenuSection', name: cat.nombre, hasMenuItem: items };
        });

        const menuJsonLd = {
            '@context': 'https://schema.org',
            '@type': 'Menu',
            name: 'Carta de Calletano Restaurant',
            inLanguage: 'es',
            hasMenuSection: menuSections
        };
        const scriptLd = document.createElement('script');
        scriptLd.type = 'application/ld+json';
        scriptLd.id = 'schema-carta-menu';
        scriptLd.textContent = JSON.stringify(menuJsonLd);
        document.head.appendChild(scriptLd);
    } catch (err) {
        console.warn('No se pudo generar el schema de menú:', err);
    }
}).catch(e => {
    console.error("Error cargando carta:", e);
    if (mainContainer) mainContainer.innerHTML = "<p style='text-align:center; padding:20px;' class='text-muted'>Error al cargar la carta. <br><small>Verifica tu conexión a internet.</small></p>";
});

// ============================================
// EVENTOS DE CONVERSIÓN (Firebase Analytics)
// ============================================
function rastrearClicksCarta() {
    // Pedir por WhatsApp (FAB)
    const wsp = document.querySelector('.fab-wsp');
    if (wsp) wsp.addEventListener('click', () => track('click_whatsapp', { origen: 'carta' }));

    // Categorías del menú (delegación: los botones se generan por JS)
    if (navContainer) {
        navContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.nav-btn');
            if (btn) track('select_categoria', { categoria: btn.textContent.trim() });
        });
    }
}
rastrearClicksCarta();

// ============================================
// SCROLL PREMIUM — parallax del hero
// (kit web-scrolling integrado al mundo existente)
// ============================================
(function () {
    'use strict';
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hero = document.querySelector('.hero-header');
    const heroContent = document.querySelector('.hero-header .hero-content');
    const waves = document.querySelector('.hero-header .wave-container');

    let ticking = false;

    function update() {
        if (reduceMotion || !hero) return;
        const rect = hero.getBoundingClientRect();
        const scrolled = Math.max(0, -rect.top);

        // Contenido: se eleva y atenúa suavemente al salir del viewport
        if (heroContent) {
            const p = Math.min(scrolled / (rect.height * 0.5), 1);
            heroContent.style.transform = 'translate3d(0, ' + (-p * 24).toFixed(1) + 'px, 0)';
            heroContent.style.opacity = String(1 - p * 0.8);
        }

        // Olas: se quedan un instante (lag) mientras el hero se va
        if (waves) {
            const p = Math.min(scrolled / rect.height, 1);
            waves.style.transform = 'translate3d(0, ' + (p * 40).toFixed(1) + 'px, 0)';
        }
    }

    window.addEventListener('scroll', function () {
        if (!ticking) {
            requestAnimationFrame(function () { update(); ticking = false; });
            ticking = true;
        }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
})();