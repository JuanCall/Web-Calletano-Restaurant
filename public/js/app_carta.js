import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

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

getDoc(doc(db, "contenido", "cartaCompleta")).then((docSnap) => {
    if (!docSnap.exists() || !docSnap.data().categorias) {
        if (mainContainer) mainContainer.innerHTML = "<p style='text-align:center; padding:20px;' class='text-muted'>Estamos armando nuestra carta virtual. ¡Vuelve pronto!</p>";
        return;
    }
    const categorias = docSnap.data().categorias;
    let navHTML = ""; let bodyHTML = "";

    categorias.forEach((cat, index) => {
        const catId = `cat-${index}`;
        navHTML += `<a href="#${catId}" class="nav-btn">${cat.nombre}</a>`;
        
        let headerHTML = "";
        if (cat.col1 || cat.col2) headerHTML = `<div class="price-header"><div class="ph-col">${cat.col1 || ''}</div><div class="ph-col">${cat.col2 || ''}</div></div>`;

        let itemsHTML = "";
        cat.items.forEach(item => {
            let preciosHTML = "";
            if (item.precio2) { preciosHTML = `<div class="price-val">${item.precio}</div><div class="price-val">${item.precio2}</div>`; } 
            else {
                if (cat.col1 || cat.col2) { preciosHTML = `<div class="price-val">${item.precio}</div><div class="price-val"></div>`; } 
                else { preciosHTML = `<div class="price-val">${item.precio}</div>`; }
            }
            const descHTML = item.desc ? `<div class="item-desc">${item.desc}</div>` : '';
            itemsHTML += `<div class="item-wrapper"><div class="item-row"><div class="item-info"><span class="item-name">${item.nombre}</span><span class="dots"></span></div><div class="price-wrapper">${preciosHTML}</div></div>${descHTML}</div>`;
        });
        bodyHTML += `<div id="${catId}" class="menu-card"><h3 class="cat-title">${cat.nombre} <i class="fas fa-utensils" style="font-size:1rem; opacity:0.3;"></i></h3>${headerHTML}${itemsHTML}</div>`;
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
}).catch(e => console.error("Error cargando carta:", e));