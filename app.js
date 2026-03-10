import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getFirestore, doc, getDoc, getDocs, setDoc, collection, addDoc, query, where, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- CONFIGURACIÓN ---
const firebaseConfig = {
    apiKey: "AIzaSyC2RKkuY_aEQaHVDvAt_-T_29sPQ6HUp50",
    authDomain: "calletano-restaurant.firebaseapp.com",
    projectId: "calletano-restaurant",
    storageBucket: "calletano-restaurant.firebasestorage.app",
    messagingSenderId: "1036720006578",
    appId: "1:1036720006578:web:31b305a61a353f324bb0ab",
    measurementId: "G-VBPRFGMZ1J"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

console.log("Sistema Calletano V18 (Prevención de BD Vacía)");

const path = window.location.pathname;

// =========================================================
//  LÓGICA: CARTA WEB CLIENTE (carta.html)
// =========================================================
if (path.includes("carta.html")) {
    const navContainer = document.getElementById('nav-categorias');
    const mainContainer = document.getElementById('menu-render');

    getDoc(doc(db, "contenido", "cartaCompleta")).then((docSnap) => {
        if (!docSnap.exists() || !docSnap.data().categorias) {
            if (mainContainer) mainContainer.innerHTML = "<p style='text-align:center; padding:20px;' class='text-muted'>Estamos armando nuestra carta virtual. ¡Vuelve pronto!</p>";
            return;
        }
        const categorias = docSnap.data().categorias;
        let navHTML = "";
        let bodyHTML = "";

        categorias.forEach((cat, index) => {
            const catId = `cat-${index}`;
            navHTML += `<a href="#${catId}" class="nav-btn">${cat.nombre}</a>`;
            
            let headerHTML = "";
            if (cat.col1 || cat.col2) {
                headerHTML = `<div class="price-header"><div class="ph-col">${cat.col1 || ''}</div><div class="ph-col">${cat.col2 || ''}</div></div>`;
            }

            let itemsHTML = "";
            cat.items.forEach(item => {
                let preciosHTML = "";
                if (item.precio2) {
                    preciosHTML = `<div class="price-val">${item.precio}</div><div class="price-val">${item.precio2}</div>`;
                } else {
                    if (cat.col1 || cat.col2) {
                        preciosHTML = `<div class="price-val">${item.precio}</div><div class="price-val"></div>`;
                    } else {
                        preciosHTML = `<div class="price-val">${item.precio}</div>`;
                    }
                }
                const descHTML = item.desc ? `<div class="item-desc">${item.desc}</div>` : '';
                itemsHTML += `<div class="item-wrapper"><div class="item-row"><div class="item-info"><span class="item-name">${item.nombre}</span><span class="dots"></span></div><div class="price-wrapper">${preciosHTML}</div></div>${descHTML}</div>`;
            });
            bodyHTML += `<div id="${catId}" class="menu-card"><h3 class="cat-title">${cat.nombre} <i class="fas fa-utensils" style="font-size:1rem; opacity:0.3;"></i></h3>${headerHTML}${itemsHTML}</div>`;
        });
        if (navContainer) navContainer.innerHTML = navHTML;
        if (mainContainer) mainContainer.innerHTML = bodyHTML;
    }).catch(e => console.error("Error cargando carta:", e));
}

// =========================================================
//  LÓGICA: INICIO (index.html)
// =========================================================
if (path.includes("index.html") || path === "/") {
    
    cargarDocumento("configuracion", (config) => {
        const statusDiv = document.getElementById('status-restaurante');
        if (!statusDiv) return;

        const ahora = new Date();
        const horaActual = ahora.getHours();
        const fechaHoy = ahora.toISOString().split('T')[0];

        const apertura = config.apertura || 12;
        const cierre = config.cierre || 22;
        const cierreForzado = config.cierreForzado || "";

        let estaAbierto = false;
        let mensaje = "";

        if (cierreForzado === fechaHoy) {
            estaAbierto = false;
            mensaje = "HOY NO ATENDEMOS";
            
            const modalEl = document.getElementById('modalCerrado');
            if(modalEl) {
                setTimeout(() => {
                    const modal = new bootstrap.Modal(modalEl);
                    modal.show();
                }, 500);
            }
        } else {
            if (horaActual >= apertura && horaActual < cierre) {
                estaAbierto = true;
                mensaje = "ABIERTO AHORA";
            } else {
                estaAbierto = false;
                mensaje = "CERRADO POR AHORA";
            }
        }

        if (estaAbierto) {
            statusDiv.innerHTML = `<span class="badge rounded-pill bg-success px-3 py-2 shadow animate__animated animate__fadeIn"><i class="fas fa-door-open me-1"></i> ${mensaje}</span>`;
        } else {
            statusDiv.innerHTML = `<span class="badge rounded-pill bg-danger px-3 py-2 shadow animate__animated animate__fadeIn"><i class="fas fa-door-closed me-1"></i> ${mensaje}</span>`;
        }
    });

    cargarDocumento("contacto", (data) => {
        setHref('link-fb', data.facebook);
        setHref('link-ig', data.instagram);
        setHref('btn-wsp', `https://wa.me/${data.whatsapp}`);
    });
    
    cargarDocumento("menuDiario", (d) => {
        const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt || "No disponible"; };
        setTxt('menu-refresco', d.refresco);
        
        const titleEl = document.getElementById('main-menu-title');
        const colEntradas = document.getElementById('col-entradas');
        const colSegundos = document.getElementById('col-segundos');
        const headerSegundos = document.getElementById('header-segundos');
        const listaEntradas = document.getElementById('menu-entradas-list');
        const listaSegundos = document.getElementById('menu-segundos-list');
        
        if (titleEl) titleEl.innerText = d.titulo || "Menú del Día 🍽️";

        // DIBUJAR ENTRADAS (Lista)
        if (listaEntradas) {
            if (d.entradas && Array.isArray(d.entradas) && d.entradas.length > 0) {
                listaEntradas.innerHTML = d.entradas.map(e => `<li class="fs-5 fw-bold text-dark border-bottom border-warning-subtle py-2"><i class="fas fa-check text-warning me-2 small"></i>${e.nombre}</li>`).join("");
            } else {
                // Compatibilidad por si hay texto antiguo
                listaEntradas.innerHTML = `<li class="fs-5 fw-bold text-dark text-center">${d.entrada || "Por definir"}</li>`;
            }
        }

        // DIBUJAR SEGUNDOS (Lista + Guarnición)
        if (listaSegundos) {
            if (d.segundos && Array.isArray(d.segundos) && d.segundos.length > 0) {
                listaSegundos.innerHTML = d.segundos.map(s => `
                    <li class="border-bottom border-danger-subtle py-2">
                        <div class="fs-5 fw-bold text-dark"><i class="fas fa-check text-danger me-2 small"></i>${s.nombre}</div>
                        ${s.acomp ? `<span class="d-block small text-muted fw-normal fst-italic ps-4">Con: ${s.acomp}</span>` : ''}
                    </li>
                `).join("");
            } else {
                listaSegundos.innerHTML = `<li class="fs-5 fw-bold text-dark text-center">${d.segundo || "Por definir"}</li>`;
            }
        }

        // MODO DOMINGO
        if (d.modoDomingo) {
            if (colEntradas) colEntradas.style.display = 'none';
            if (colSegundos) { colSegundos.className = "col-md-8 mb-4 mx-auto"; if (headerSegundos) headerSegundos.innerHTML = "<h3>PLATOS ESPECIALES</h3>"; }
        } else {
            if (colEntradas) colEntradas.style.display = 'block';
            if (colSegundos) { colSegundos.className = "col-md-5 mb-4"; if (headerSegundos) headerSegundos.innerHTML = "<h3>SEGUNDOS</h3>"; }
        }
    });

    // FUNCIÓN CARGAR LISTA
    const cargarLista = (docId, containerId, cols) => {
        const el = document.getElementById(containerId);
        if(el) {
            let skeletonHTML = "";
            for(let i=0; i<cols; i++) {
                skeletonHTML += `<div class="${cols === 4 ? 'col-md-3' : 'col-md-4'} mb-4"><div class="skeleton skeleton-img"></div><div class="skeleton skeleton-text mt-2" style="width: 60%"></div><div class="skeleton skeleton-text" style="width: 80%"></div></div>`;
            }
            el.innerHTML = skeletonHTML;
        }
        cargarDocumento(docId, (data) => {
            if (el) {
                if (data.lista && data.lista.length > 0) {
                    el.innerHTML = "";
                    data.lista.forEach(p => el.innerHTML += crearTarjetaPlato(p, cols));
                } else {
                    // Si no hay datos, quita el esqueleto y avisa.
                    el.innerHTML = `<div class="col-12 text-center mt-4"><p class="text-muted fst-italic"><i class="fas fa-utensils"></i> Actualizando nuestra lista de platos...</p></div>`;
                }
            }
        });
    };
    cargarLista("favoritos", "favoritos-container", 4);
    cargarLista("domingo", "domingo-container", 3);

    // FUNCIÓN RESEÑAS: Busca múltiples contenedores por si acaso
    const group1 = document.getElementById('reviews-group-1');
    const group2 = document.getElementById('reviews-group-2');
    // Buscamos contenedores genéricos en caso de que los IDs en el index.html sean diferentes
    const genericReviewContainer = document.getElementById('reviews-container') || document.getElementById('resenas-container') || document.querySelector('.reviews-section');

    const renderContenedorResenas = (html) => {
        if (group1 && group2) { group1.innerHTML = html; group2.innerHTML = html; } 
        else if (group1) { group1.innerHTML = html; }
        else if (genericReviewContainer) { genericReviewContainer.innerHTML = html; }
    };

    if (group1 || genericReviewContainer) {
        getDocs(query(collection(db, "resenas"), where("aprobada", "==", true))).then((snapshot) => {
            if (snapshot.empty) {
                renderContenedorResenas(`<div class="w-100 text-center p-4"><p class="text-muted fst-italic">Aún no hay reseñas publicadas. ¡Sé el primero en visitarnos!</p></div>`);
            } else {
                let htmlResenas = "";
                snapshot.forEach((doc) => {
                    const d = doc.data();
                    htmlResenas += `<div class="review-card"><div class="mb-2 fs-5 text-center">${generarEstrellasHTML(d.estrellas || 5)}</div><p class="fst-italic text-muted text-center small">"${d.mensaje}"</p><div class="mt-auto pt-2 border-top text-center"><strong class="text-dark small">${d.autor}</strong></div></div>`;
                });
                renderContenedorResenas(htmlResenas);
            }
        }).catch(e => {
            console.error("Error obteniendo reseñas:", e);
            renderContenedorResenas(`<div class="w-100 text-center"><p class="text-danger">Error al cargar opiniones.</p></div>`);
        });
    }
}

// =========================================================
//  LÓGICA: ADMIN (admin-secreto.html)
// =========================================================
if (path.includes("admin")) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            document.getElementById('login-section').classList.add('d-none');
            document.getElementById('admin-panel').classList.remove('d-none');
            iniciarPanelAdmin();
        } else {
            document.getElementById('login-section').classList.remove('d-none');
            document.getElementById('admin-panel').classList.add('d-none');
        }
    });
    document.getElementById('btn-login')?.addEventListener('click', () => {
        signInWithEmailAndPassword(auth, document.getElementById('admin-email').value, document.getElementById('admin-pass').value).catch(e => alert(e.message));
    });
    document.getElementById('btn-logout')?.addEventListener('click', () => signOut(auth));

    function iniciarPanelAdmin() {
        // --- HORARIOS ---
        const btnAbierto = document.getElementById('btn-abierto');
        const btnCerrado = document.getElementById('btn-cerrado');
        const inputApertura = document.getElementById('input-hora-apertura');
        const inputCierre = document.getElementById('input-hora-cierre');
        
        cargarDocumento("configuracion", (data) => {
            if (inputApertura) inputApertura.value = data.apertura || 12;
            if (inputCierre) inputCierre.value = data.cierre || 22;
            const fechaHoy = new Date().toISOString().split('T')[0];
            if (data.cierreForzado === fechaHoy) {
                if (btnCerrado) btnCerrado.checked = true;
            } else {
                if (btnAbierto) btnAbierto.checked = true;
            }
        });

        const guardarHorario = async () => {
            const fechaHoy = new Date().toISOString().split('T')[0];
            const cierreForzado = btnCerrado.checked ? fechaHoy : "";
            try {
                await setDoc(doc(db, "contenido", "configuracion"), {
                    apertura: parseInt(inputApertura.value),
                    cierre: parseInt(inputCierre.value),
                    cierreForzado: cierreForzado
                }, { merge: true });
                alert("✅ Configuración actualizada");
            } catch (e) { alert("Error: " + e.message); }
        };

        document.getElementById('btn-save-horario')?.addEventListener('click', guardarHorario);
        btnCerrado?.addEventListener('click', async () => { if(confirm("¿Seguro?")) await guardarHorario(); });
        btnAbierto?.addEventListener('click', async () => { await guardarHorario(); });

        // --- MENÚ DIARIO ---
        // Funciones Globales para añadir filas
        window.addEntradaRow = (nombre = "", precio = 6) => {
            const container = document.getElementById('admin-entradas-container');
            const row = document.createElement('div');
            row.className = "d-flex gap-2 mb-2 entrada-item animate__animated animate__fadeIn";
            row.innerHTML = `
                <input type="text" class="form-control form-control-sm ent-nombre border-warning" placeholder="Nombre (Ej: Ceviche)" value="${nombre}">
                <div class="input-group input-group-sm" style="width: 100px; flex-shrink:0;">
                    <span class="input-group-text bg-warning text-dark fw-bold border-warning">S/</span>
                    <input type="number" class="form-control ent-precio border-warning text-center fw-bold" value="${precio}">
                </div>
                <button class="btn btn-sm btn-outline-danger border-0" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
            `;
            container.appendChild(row);
        };

        window.addSegundoRow = (nombre = "", acomp = "") => {
            const container = document.getElementById('admin-segundos-container');
            const row = document.createElement('div');
            row.className = "border border-danger-subtle rounded p-2 mb-2 bg-white segundo-item animate__animated animate__fadeIn";
            
            // Detectamos si es domingo para el precio por defecto del admin
            const esHoyDomingo = new Date().getDay() === 0;
            const precioSugerido = esHoyDomingo ? 30 : 15;

            row.innerHTML = `
                <div class="d-flex gap-2 mb-2">
                    <input type="text" class="form-control form-control-sm seg-nombre fw-bold" placeholder="Plato de fondo" value="${nombre}">
                    <div class="input-group input-group-sm" style="width: 100px; flex-shrink:0;">
                        <span class="input-group-text bg-danger text-white border-danger">S/</span>
                        <input type="number" class="form-control seg-precio text-center fw-bold text-danger border-danger bg-light" value="${precioSugerido}" disabled>
                    </div>
                    <button class="btn btn-sm text-danger border-0 px-1" onclick="this.parentElement.parentElement.remove()"><i class="fas fa-times"></i></button>
                </div>
                <input type="text" class="form-control form-control-sm text-muted fst-italic seg-acomp" placeholder="Acompañamiento..." value="${acomp}">
            `;
            container.appendChild(row);
        };

        window.aplicarAcompGlobal = () => {
            const text = document.getElementById('batch-acomp').value;
            document.querySelectorAll('.seg-acomp').forEach(input => input.value = text);
        };

        // Cargar datos al abrir el panel
        cargarDocumento("menuDiario", (d) => {
            if (document.getElementById('input-refresco')) document.getElementById('input-refresco').value = d.refresco || "";
            if (document.getElementById('input-titulo-menu')) document.getElementById('input-titulo-menu').value = d.titulo || "Menú del Día 🍽️";
            const isDomingo = d.modoDomingo || false;
            if (document.getElementById('check-modo-domingo')) document.getElementById('check-modo-domingo').checked = isDomingo;
            
            // Aplicar visibilidad inicial según el estado guardado
            if (colEntradasAdmin) {
                colEntradasAdmin.style.display = isDomingo ? 'none' : 'block';
            }
            
            // Renderizar Entradas
            document.getElementById('admin-entradas-container').innerHTML = "";
            if (d.entradas && d.entradas.length > 0) {
                d.entradas.forEach(e => addEntradaRow(e.nombre, e.precio));
            } else { addEntradaRow("", 6); } // Fila vacía por defecto
            
            // Renderizar Segundos
            document.getElementById('admin-segundos-container').innerHTML = "";
            if (d.segundos && d.segundos.length > 0) {
                d.segundos.forEach(s => addSegundoRow(s.nombre, s.acomp));
            } else { addSegundoRow("", ""); } // Fila vacía por defecto
        });

        const checkDomingo = document.getElementById('check-modo-domingo');
        const inputTitulo = document.getElementById('input-titulo-menu');
        const colEntradasAdmin = document.getElementById('admin-col-entradas'); // Referencia a la columna

        if (checkDomingo && inputTitulo) {
            checkDomingo.addEventListener('change', () => {
                const activo = checkDomingo.checked;
                inputTitulo.value = activo ? "ESPECIALES DE DOMINGO 🍽️" : "Menú del Día 🍽️";
                
                // Ocultar o mostrar la columna de entradas
                if (colEntradasAdmin) {
                    colEntradasAdmin.style.display = activo ? 'none' : 'block';
                }
            });
        }

        // Extraer los datos y guardar
        asignarGuardado('btn-save-menu', "menuDiario", () => {
            // Leer Entradas
            const entradasArray = Array.from(document.querySelectorAll('.entrada-item')).map(el => ({
                nombre: el.querySelector('.ent-nombre').value.trim(),
                precio: parseFloat(el.querySelector('.ent-precio').value) || 6
            })).filter(e => e.nombre !== "");

            // Leer Segundos
            const segundosArray = Array.from(document.querySelectorAll('.segundo-item')).map(el => ({
                nombre: el.querySelector('.seg-nombre').value.trim(),
                acomp: el.querySelector('.seg-acomp').value.trim(),
                precio: 15 // Fijo e inmodificable
            })).filter(s => s.nombre !== "");

            return {
                entradas: entradasArray,
                segundos: segundosArray,
                refresco: document.getElementById('input-refresco').value,
                titulo: document.getElementById('input-titulo-menu').value,
                modoDomingo: document.getElementById('check-modo-domingo').checked,
                // Conservamos los viejos en blanco por si acaso
                entrada: "", segundo: "" 
            };
        });

        // --- CONTACTO ---
        cargarDocumento("contacto", (d) => {
            if (document.getElementById('conf-wsp')) document.getElementById('conf-wsp').value = d.whatsapp || "";
            if (document.getElementById('conf-fb')) document.getElementById('conf-fb').value = d.facebook || "";
            if (document.getElementById('conf-ig')) document.getElementById('conf-ig').value = d.instagram || "";
        });
        asignarGuardado('btn-save-contact', "contacto", () => ({ whatsapp: document.getElementById('conf-wsp').value, facebook: document.getElementById('conf-fb').value, instagram: document.getElementById('conf-ig').value }));

        generarEditorPlatosBase64('editor-favoritos', 'favoritos', 6, 'btn-save-favs');
        generarEditorPlatosBase64('editor-domingo', 'domingo', 4, 'btn-save-domingo');
        iniciarEditorCartaCompleta();

        // --- RESEÑAS (ADMIN) ---
        const listContainer = document.getElementById('admin-reviews-list');
        
        const cargarResenasAdmin = () => {
            if (!listContainer) return;
            getDocs(collection(db, "resenas")).then((snap) => {
                listContainer.innerHTML = "";
                let reviews = [];
                snap.forEach(doc => reviews.push({ id: doc.id, ...doc.data() }));
                reviews.sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
                
                if (reviews.length === 0) { 
                    listContainer.innerHTML = "<p class='text-muted text-center'>No hay reseñas.</p>"; 
                    return; 
                }
                
                reviews.forEach(r => {
                    const li = document.createElement('li');
                    li.className = "list-group-item p-3 mb-2 border rounded";
                    
                    const renderDisplay = () => {
                        li.innerHTML = `<div class="d-flex justify-content-between align-items-start mb-2"><div><strong class="text-dark">${r.autor}</strong><div class="text-warning small">${"⭐".repeat(r.estrellas)}</div></div><div><button class="btn btn-sm btn-outline-primary btn-edit me-1"><i class="fas fa-edit"></i></button><button class="btn btn-sm btn-outline-danger btn-delete"><i class="fas fa-trash"></i></button></div></div><p class="text-muted small mb-0 fst-italic">"${r.mensaje}"</p><div class="form-check form-switch mt-2"><input class="form-check-input btn-toggle-status" type="checkbox" ${r.aprobada ? 'checked' : ''}><label class="form-check-label small text-muted">Visible en la web</label></div>`;
                        
                        li.querySelector('.btn-delete').onclick = async () => { 
                            if(confirm("¿Eliminar?")) {
                                await deleteDoc(doc(db, "resenas", r.id)); 
                                cargarResenasAdmin(); 
                            }
                        };
                        li.querySelector('.btn-toggle-status').onchange = async (e) => { 
                            await updateDoc(doc(db, "resenas", r.id), { aprobada: e.target.checked }); 
                        };
                        li.querySelector('.btn-edit').onclick = renderEditForm;
                    };
                    
                    const renderEditForm = () => {
                        li.innerHTML = `<div class="mb-2"><input type="text" class="form-control form-control-sm mb-1 edit-author" value="${r.autor}"><select class="form-select form-select-sm mb-1 edit-stars"><option value="5" ${r.estrellas==5?'selected':''}>5</option><option value="4" ${r.estrellas==4?'selected':''}>4</option><option value="3" ${r.estrellas==3?'selected':''}>3</option></select><textarea class="form-control form-control-sm edit-msg">${r.mensaje}</textarea></div><div class="text-end"><button class="btn btn-sm btn-secondary btn-cancel me-1">Cancel</button><button class="btn btn-sm btn-success btn-save">Guardar</button></div>`;
                        
                        li.querySelector('.btn-cancel').onclick = renderDisplay;
                        li.querySelector('.btn-save').onclick = async () => { 
                            await updateDoc(doc(db, "resenas", r.id), { 
                                autor: li.querySelector('.edit-author').value, 
                                mensaje: li.querySelector('.edit-msg').value, 
                                estrellas: parseInt(li.querySelector('.edit-stars').value) 
                            }); 
                            cargarResenasAdmin(); 
                        };
                    };
                    renderDisplay();
                    listContainer.appendChild(li);
                });
            });
        };

        cargarResenasAdmin();

        const btnManual = document.getElementById('btn-add-manual-review');
        if (btnManual) {
            const newBtn = btnManual.cloneNode(true);
            btnManual.parentNode.replaceChild(newBtn, btnManual);
            newBtn.addEventListener('click', async () => {
                const autor = document.getElementById('manual-author').value.trim();
                const msg = document.getElementById('manual-msg').value.trim();
                const stars = document.getElementById('manual-stars').value;
                if (!autor || !msg) return alert("Escribe nombre y mensaje.");
                newBtn.disabled = true; newBtn.innerHTML = "Publicando...";
                try {
                    await addDoc(collection(db, "resenas"), { autor: autor, mensaje: msg, estrellas: parseInt(stars), aprobada: true, fecha: new Date() });
                    alert("✅ Reseña publicada!");
                    document.getElementById('manual-author').value = ""; document.getElementById('manual-msg').value = "";
                    cargarResenasAdmin(); 
                } catch (e) { alert("Error: " + e.message); }
                finally { newBtn.disabled = false; newBtn.innerHTML = '<i class="fas fa-save"></i> Publicar'; }
            });
        }
    }
}

// =========================================================
//  LÓGICA EDITOR CARTA
// =========================================================
let cartaLocal = [];
async function iniciarEditorCartaCompleta() {
    const btnAddCat = document.getElementById('btn-add-cat');
    if (btnAddCat) {
        const newBtn = btnAddCat.cloneNode(true);
        btnAddCat.parentNode.replaceChild(newBtn, btnAddCat);
        newBtn.addEventListener('click', () => {
            const nameInput = document.getElementById('new-cat-name');
            const name = nameInput.value.trim();
            if (name) {
                cartaLocal.push({ nombre: name, col1: "", col2: "", items: [] });
                nameInput.value = "";
                renderCartaAdmin();
            } else { alert("Escribe un nombre."); }
        });
    }

    const btnSaveFull = document.getElementById('btn-save-full-carta');
    if (btnSaveFull) {
        const newBtnSave = btnSaveFull.cloneNode(true);
        btnSaveFull.parentNode.replaceChild(newBtnSave, btnSaveFull);
        newBtnSave.addEventListener('click', async () => {
            newBtnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...'; newBtnSave.disabled = true;
            try {
                await setDoc(doc(db, "contenido", "cartaCompleta"), { categorias: cartaLocal });
                alert("✅ Carta Actualizada");
            } catch (e) { alert("Error: " + e.message); } 
            finally { newBtnSave.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios'; newBtnSave.disabled = false; }
        });
    }

    try {
        const snap = await getDoc(doc(db, "contenido", "cartaCompleta"));
        if (snap.exists() && snap.data().categorias) cartaLocal = snap.data().categorias;
        renderCartaAdmin();
    } catch (e) { console.error("Error carta:", e); }
}

function renderCartaAdmin() {
    const container = document.getElementById('accordionCarta');
    if (!container) return;
    container.innerHTML = "";
    cartaLocal.forEach((cat, index) => {
        const catId = `collapse-${index}`;
        let itemsHTML = `<table class="table table-sm table-striped align-middle"><thead class="table-light"><tr><th style="width:40%">Plato y Descripción</th><th>${cat.col1 || 'Precio 1'}</th><th>${cat.col2 || 'Precio 2'}</th><th style="width:50px"></th></tr></thead><tbody>`;
        cat.items.forEach((item, iItem) => {
            itemsHTML += `<tr><td><input type="text" class="form-control form-control-sm fw-bold" value="${item.nombre}" onchange="updateItem(${index}, ${iItem}, 'nombre', this.value)" placeholder="Nombre"><input type="text" class="form-control form-control-sm mt-1 text-muted fst-italic" value="${item.desc || ''}" onchange="updateItem(${index}, ${iItem}, 'desc', this.value)" placeholder="Descripción"></td><td><input type="text" class="form-control form-control-sm" value="${item.precio}" onchange="updateItem(${index}, ${iItem}, 'precio', this.value)"></td><td><input type="text" class="form-control form-control-sm" value="${item.precio2 || ''}" placeholder="-" onchange="updateItem(${index}, ${iItem}, 'precio2', this.value)"></td><td><button class="btn btn-outline-danger btn-sm border-0" onclick="deleteItem(${index}, ${iItem})"><i class="fas fa-trash"></i></button></td></tr>`;
        });
        itemsHTML += `</tbody></table><div class="d-flex gap-2 align-items-start bg-light p-2 rounded"><div class="flex-grow-1"><input type="text" id="new-item-name-${index}" class="form-control form-control-sm mb-1" placeholder="Nuevo plato"><input type="text" id="new-item-desc-${index}" class="form-control form-control-sm text-muted fst-italic" placeholder="Descripción"></div><div style="width:80px"><input type="text" id="new-item-price-${index}" class="form-control form-control-sm" placeholder="S/"></div><div style="width:80px"><input type="text" id="new-item-price2-${index}" class="form-control form-control-sm" placeholder="S/"></div><button class="btn btn-primary btn-sm" onclick="addItem(${index})" style="height:31px"><i class="fas fa-plus"></i></button></div>`;
        const headerConfig = `<div class="mb-3 p-2 border rounded bg-white"><label class="small text-muted fw-bold">Títulos de Columnas:</label><div class="d-flex gap-2"><input type="text" class="form-control form-control-sm" placeholder="Ej: Vaso" value="${cat.col1 || ''}" onchange="updateCatHeader(${index}, 'col1', this.value)"><input type="text" class="form-control form-control-sm" placeholder="Ej: Jarra" value="${cat.col2 || ''}" onchange="updateCatHeader(${index}, 'col2', this.value)"></div></div>`;
        const card = document.createElement('div');
        card.className = "accordion-item border mb-2";
        card.innerHTML = `<h2 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${catId}"><strong>${cat.nombre}</strong> <span class="badge bg-secondary ms-2">${cat.items.length}</span></button></h2><div id="${catId}" class="accordion-collapse collapse" data-bs-parent="#accordionCarta"><div class="accordion-body"><div class="text-end mb-2"><button class="btn btn-danger btn-sm" onclick="deleteCat(${index})"><i class="fas fa-trash"></i> Borrar Categoría</button></div>${headerConfig}${itemsHTML}</div></div>`;
        container.appendChild(card);
    });
}

window.updateCatHeader = (idx, f, v) => { cartaLocal[idx][f] = v; }; 
window.updateItem = (catIdx, itemIdx, f, v) => { cartaLocal[catIdx].items[itemIdx][f] = v; };
window.deleteItem = (catIdx, itemIdx) => { cartaLocal[catIdx].items.splice(itemIdx, 1); renderCartaAdmin(); };
window.deleteCat = (catIdx) => { if (confirm("¿Borrar?")) { cartaLocal.splice(catIdx, 1); renderCartaAdmin(); } };
window.addItem = (catIdx) => {
    const name = document.getElementById(`new-item-name-${catIdx}`).value;
    const desc = document.getElementById(`new-item-desc-${catIdx}`).value;
    const price = document.getElementById(`new-item-price-${catIdx}`).value;
    const price2 = document.getElementById(`new-item-price2-${catIdx}`).value;
    if (name && price) {
        cartaLocal[catIdx].items.push({ nombre: name, desc: desc, precio: price, precio2: price2 });
        renderCartaAdmin();
        setTimeout(() => { const el = document.getElementById(`collapse-${catIdx}`); if (el) new bootstrap.Collapse(el, { show: true }); }, 100);
    }
};

async function cargarDocumento(id, cb) { 
    try { 
        const s = await getDoc(doc(db, "contenido", id)); 
        cb(s.exists() ? s.data() : {}); 
    } catch (e) { 
        console.error(e); 
    } 
}
function setHref(id, v) { 
    const e = document.getElementById(id); 
    if (e && v) 
        e.href = v; 
}

function crearTarjetaPlato(p, c) { 
    return `<div class="${c === 4 ? 'col-md-4' : 'col-md-3'} mb-4"><div class="card h-100 shadow-sm border-0"><img src="${p.img}" class="card-img-top" style="height:${c === 4 ? '200px' : '150px'};object-fit:cover;"><div class="card-body text-center"><h5 class="fw-bold">${p.titulo}</h5><p class="text-muted small">${p.desc}</p></div></div></div>`; 
}
function generarEstrellasHTML(pts) { 
    let h = ""; 
    for (let i = 1; i <= 5; i++)
        h += `<i class="${i <= pts ? 'fas' : 'far'} fa-star text-warning"></i>`; 
    return h; 
}

async function generarEditorPlatosBase64(contId, docId, cant, btnId) { 
    const cont = document.getElementById(contId); if (!cont) return; const snap = await getDoc(doc(db, "contenido", docId)); let list = snap.exists() ? (snap.data().lista || []) : []; while (list.length < cant) list.push({ titulo: "", desc: "", img: "plato1.png" }); let html = ""; list.forEach((it, i) => { if (i < cant) html += `<div class="card p-3 mb-3 item-plato-${docId} border-0 shadow-sm bg-white"><div class="row align-items-center"><div class="col-md-2 text-center"><strong class="d-block mb-2 text-muted">Plato #${i + 1}</strong><div class="upload-box justify-content-center"><img src="${it.img}" class="current-img img-preview-tag"><label class="btn-upload-custom"><i class="fas fa-plus"></i><span>Subir</span><input type="file" class="img-file-input" accept="image/*" onchange="previsualizar(this)"></label><input type="hidden" class="img-url-hidden" value="${it.img}"></div></div><div class="col-md-10"><div class="row g-2"><div class="col-md-6"><label class="small text-muted">Título</label><input type="text" class="form-control title-input" value="${it.titulo}"></div><div class="col-md-6"><label class="small text-muted">Descripción</label><input type="text" class="form-control desc-input" value="${it.desc}"></div></div></div></div></div>`; }); cont.innerHTML = html; const btn = document.getElementById(btnId); if (btn) { const newBtn = btn.cloneNode(true); btn.parentNode.replaceChild(newBtn, btn); newBtn.addEventListener('click', async () => { newBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; newBtn.disabled = true; const items = cont.querySelectorAll(`.item-plato-${docId}`); const newList = []; for (const div of items) { const fileInput = div.querySelector('.img-file-input'); const hiddenInput = div.querySelector('.img-url-hidden'); let finalImg = hiddenInput.value; if (fileInput.files.length > 0) finalImg = await comprimirImagen(fileInput.files[0]); newList.push({ img: finalImg, titulo: div.querySelector('.title-input').value, desc: div.querySelector('.desc-input').value }); } await setDoc(doc(db, "contenido", docId), { lista: newList }); alert("✅ Guardado"); generarEditorPlatosBase64(contId, docId, cant, btnId); newBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Todo'; newBtn.disabled = false; }); }
}

window.previsualizar = function (i) { if (i.files && i.files[0]) { const r = new FileReader(); r.onload = function (e) { i.closest('.upload-box').querySelector('.current-img').src = e.target.result; }; r.readAsDataURL(i.files[0]); } }
function comprimirImagen(f) { 
    return new Promise((res, rej) => { const r = new FileReader(); 
        r.readAsDataURL(f); 
        r.onload = (e) => { 
            const i = new Image(); 
            i.src = e.target.result; 
            i.onload = () => { const c = document.createElement('canvas'); 
                const s = 500 / i.width; 
                c.width = 500; 
                c.height = i.height * s; 
                c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); 
                res(c.toDataURL('image/jpeg', 0.7)); 
            }; 
        }; 
        r.onerror = rej; 
    }); 
}
function asignarGuardado(btnId, docId, getDataCallback) { 
    const btn = document.getElementById(btnId); 
    if (!btn) return; 
    const newBtn = btn.cloneNode(true); 
    btn.parentNode.replaceChild(newBtn, btn); 
    newBtn.addEventListener('click', async (e) => { 
        e.preventDefault(); 
        const originalText = newBtn.innerHTML; 
        newBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...'; 
        newBtn.disabled = true; 
        try { 
            const datos = getDataCallback(); 
            await updateDoc(doc(db, "contenido", docId), datos); 
            alert("✅ Guardado"); 
        } catch (error) { 
            console.error(error); 
            alert("Error: " + error.message); 
        } finally { 
            newBtn.innerHTML = originalText; newBtn.disabled = false; 
        } 
    }); 
}