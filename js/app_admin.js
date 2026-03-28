import { doc, getDoc, getDocs, setDoc, collection, addDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { db, auth } from "./firebase-config.js";

async function cargarDocumento(id, cb) { try { const s = await getDoc(doc(db, "contenido", id)); cb(s.exists() ? s.data() : {}); } catch (e) { console.error(e); } }

onAuthStateChanged(auth, (user) => {
    if (user) { document.getElementById('login-section').classList.add('d-none'); document.getElementById('admin-panel').classList.remove('d-none'); iniciarPanelAdmin(); } 
    else { document.getElementById('login-section').classList.remove('d-none'); document.getElementById('admin-panel').classList.add('d-none'); }
});

document.getElementById('btn-login')?.addEventListener('click', () => { signInWithEmailAndPassword(auth, document.getElementById('admin-email').value, document.getElementById('admin-pass').value).catch(e => alert(e.message)); });
document.getElementById('btn-logout')?.addEventListener('click', () => signOut(auth));

function iniciarPanelAdmin() {
    // --- HORARIOS ---
    const btnAbierto = document.getElementById('btn-abierto'); const btnCerrado = document.getElementById('btn-cerrado'); const inputApertura = document.getElementById('input-hora-apertura'); const inputCierre = document.getElementById('input-hora-cierre');
    
    cargarDocumento("configuracion", (data) => {
        if (inputApertura) inputApertura.value = data.apertura || 12;
        if (inputCierre) inputCierre.value = data.cierre || 22;
        if (data.cierreForzado === new Date().toISOString().split('T')[0]) { if (btnCerrado) btnCerrado.checked = true; } 
        else { if (btnAbierto) btnAbierto.checked = true; }
    });

    const guardarHorario = async () => {
        const cierreForzado = btnCerrado.checked ? new Date().toISOString().split('T')[0] : "";
        try { await setDoc(doc(db, "contenido", "configuracion"), { apertura: parseInt(inputApertura.value), cierre: parseInt(inputCierre.value), cierreForzado: cierreForzado }, { merge: true }); alert("✅ Configuración actualizada"); } catch (e) { alert("Error: " + e.message); }
    };
    document.getElementById('btn-save-horario')?.addEventListener('click', guardarHorario); btnCerrado?.addEventListener('click', async () => { if(confirm("¿Seguro?")) await guardarHorario(); }); btnAbierto?.addEventListener('click', async () => { await guardarHorario(); });

    // --- MENÚ DIARIO ---
    window.addEntradaRow = (nombre = "", precio = 6) => {
        const container = document.getElementById('admin-entradas-container'); const row = document.createElement('div'); row.className = "d-flex gap-2 mb-2 entrada-item animate__animated animate__fadeIn";
        row.innerHTML = `<input type="text" class="form-control form-control-sm ent-nombre border-warning" placeholder="Nombre (Ej: Ceviche)" value="${nombre}"><div class="input-group input-group-sm" style="width: 100px; flex-shrink:0;"><span class="input-group-text bg-warning text-dark fw-bold border-warning">S/</span><input type="number" class="form-control ent-precio border-warning text-center fw-bold" value="${precio}"></div><button class="btn btn-sm btn-outline-danger border-0" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
        container.appendChild(row);
    };

    window.addSegundoRow = (nombre = "", acomp = "") => {
        const container = document.getElementById('admin-segundos-container'); const row = document.createElement('div'); row.className = "border border-danger-subtle rounded p-2 mb-2 bg-white segundo-item animate__animated animate__fadeIn";
        const precioSugerido = new Date().getDay() === 0 ? 30 : 15;
        row.innerHTML = `<div class="d-flex gap-2 mb-2"><input type="text" class="form-control form-control-sm seg-nombre fw-bold" placeholder="Plato de fondo" value="${nombre}"><div class="input-group input-group-sm" style="width: 100px; flex-shrink:0;"><span class="input-group-text bg-danger text-white border-danger">S/</span><input type="number" class="form-control seg-precio text-center fw-bold text-danger border-danger bg-light" value="${precioSugerido}" disabled></div><button class="btn btn-sm text-danger border-0 px-1" onclick="this.parentElement.parentElement.remove()"><i class="fas fa-times"></i></button></div><input type="text" class="form-control form-control-sm text-muted fst-italic seg-acomp" placeholder="Acompañamiento..." value="${acomp}">`;
        container.appendChild(row);
    };

    window.aplicarAcompGlobal = () => { const text = document.getElementById('batch-acomp').value; document.querySelectorAll('.seg-acomp').forEach(input => input.value = text); };

    cargarDocumento("menuDiario", (d) => {
        if (document.getElementById('input-refresco')) document.getElementById('input-refresco').value = d.refresco || "";
        if (document.getElementById('input-titulo-menu')) document.getElementById('input-titulo-menu').value = d.titulo || "Menú del Día 🍽️";
        if (document.getElementById('check-modo-domingo')) document.getElementById('check-modo-domingo').checked = d.modoDomingo || false;
        if (document.getElementById('admin-col-entradas')) document.getElementById('admin-col-entradas').style.display = (d.modoDomingo || false) ? 'none' : 'block';
        
        document.getElementById('admin-entradas-container').innerHTML = "";
        if (d.entradas && d.entradas.length > 0) d.entradas.forEach(e => addEntradaRow(e.nombre, e.precio)); else addEntradaRow("", 6);
        
        document.getElementById('admin-segundos-container').innerHTML = "";
        if (d.segundos && d.segundos.length > 0) d.segundos.forEach(s => addSegundoRow(s.nombre, s.acomp)); else addSegundoRow("", "");
    });

    const checkDomingo = document.getElementById('check-modo-domingo'); const inputTitulo = document.getElementById('input-titulo-menu'); const colEntradasAdmin = document.getElementById('admin-col-entradas');
    if (checkDomingo && inputTitulo) {
        checkDomingo.addEventListener('change', () => { const activo = checkDomingo.checked; inputTitulo.value = activo ? "ESPECIALES DE DOMINGO 🍽️" : "Menú del Día 🍽️"; if (colEntradasAdmin) colEntradasAdmin.style.display = activo ? 'none' : 'block'; });
    }

    asignarGuardado('btn-save-menu', "menuDiario", () => ({
        entradas: Array.from(document.querySelectorAll('.entrada-item')).map(el => ({ nombre: el.querySelector('.ent-nombre').value.trim(), precio: parseFloat(el.querySelector('.ent-precio').value) || 6 })).filter(e => e.nombre !== ""),
        segundos: Array.from(document.querySelectorAll('.segundo-item')).map(el => ({ nombre: el.querySelector('.seg-nombre').value.trim(), acomp: el.querySelector('.seg-acomp').value.trim(), precio: 15 })).filter(s => s.nombre !== ""),
        refresco: document.getElementById('input-refresco').value, titulo: document.getElementById('input-titulo-menu').value, modoDomingo: document.getElementById('check-modo-domingo').checked, entrada: "", segundo: "" 
    }));

    // --- CONTACTO ---
    cargarDocumento("contacto", (d) => { if (document.getElementById('conf-wsp')) document.getElementById('conf-wsp').value = d.whatsapp || ""; if (document.getElementById('conf-fb')) document.getElementById('conf-fb').value = d.facebook || ""; if (document.getElementById('conf-ig')) document.getElementById('conf-ig').value = d.instagram || ""; });
    asignarGuardado('btn-save-contact', "contacto", () => ({ whatsapp: document.getElementById('conf-wsp').value, facebook: document.getElementById('conf-fb').value, instagram: document.getElementById('conf-ig').value }));

    generarEditorPlatosBase64('editor-favoritos', 'favoritos', 6, 'btn-save-favs'); generarEditorPlatosBase64('editor-domingo', 'domingo', 4, 'btn-save-domingo'); iniciarEditorCartaCompleta();

    // --- RESEÑAS ---
    const cargarResenasAdmin = () => {
        const listContainer = document.getElementById('admin-reviews-list'); if (!listContainer) return;
        getDocs(collection(db, "resenas")).then((snap) => {
            listContainer.innerHTML = ""; let reviews = []; snap.forEach(doc => reviews.push({ id: doc.id, ...doc.data() }));
            reviews.sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
            if (reviews.length === 0) { listContainer.innerHTML = "<p class='text-muted text-center'>No hay reseñas.</p>"; return; }
            reviews.forEach(r => {
                const li = document.createElement('li'); li.className = "list-group-item p-3 mb-2 border rounded";
                const renderDisplay = () => {
                    li.innerHTML = `<div class="d-flex justify-content-between align-items-start mb-2"><div><strong class="text-dark">${r.autor}</strong><div class="text-warning small">${"⭐".repeat(r.estrellas)}</div></div><div><button class="btn btn-sm btn-outline-primary btn-edit me-1"><i class="fas fa-edit"></i></button><button class="btn btn-sm btn-outline-danger btn-delete"><i class="fas fa-trash"></i></button></div></div><p class="text-muted small mb-0 fst-italic">"${r.mensaje}"</p><div class="form-check form-switch mt-2"><input class="form-check-input btn-toggle-status" type="checkbox" ${r.aprobada ? 'checked' : ''}><label class="form-check-label small text-muted">Visible</label></div>`;
                    li.querySelector('.btn-delete').onclick = async () => { if(confirm("¿Eliminar?")) { await deleteDoc(doc(db, "resenas", r.id)); cargarResenasAdmin(); } };
                    li.querySelector('.btn-toggle-status').onchange = async (e) => { await updateDoc(doc(db, "resenas", r.id), { aprobada: e.target.checked }); };
                    li.querySelector('.btn-edit').onclick = () => {
                        li.innerHTML = `<div class="mb-2"><input type="text" class="form-control form-control-sm mb-1 edit-author" value="${r.autor}"><select class="form-select form-select-sm mb-1 edit-stars"><option value="5" ${r.estrellas==5?'selected':''}>5</option><option value="4" ${r.estrellas==4?'selected':''}>4</option><option value="3" ${r.estrellas==3?'selected':''}>3</option></select><textarea class="form-control form-control-sm edit-msg">${r.mensaje}</textarea></div><div class="text-end"><button class="btn btn-sm btn-secondary btn-cancel me-1">Cancel</button><button class="btn btn-sm btn-success btn-save">Guardar</button></div>`;
                        li.querySelector('.btn-cancel').onclick = renderDisplay;
                        li.querySelector('.btn-save').onclick = async () => { await updateDoc(doc(db, "resenas", r.id), { autor: li.querySelector('.edit-author').value, mensaje: li.querySelector('.edit-msg').value, estrellas: parseInt(li.querySelector('.edit-stars').value) }); cargarResenasAdmin(); };
                    };
                };
                renderDisplay(); listContainer.appendChild(li);
            });
        });
    };
    cargarResenasAdmin();

    const btnManual = document.getElementById('btn-add-manual-review');
    if (btnManual) {
        const newBtn = btnManual.cloneNode(true); btnManual.parentNode.replaceChild(newBtn, btnManual);
        newBtn.addEventListener('click', async () => {
            const autor = document.getElementById('manual-author').value.trim(); const msg = document.getElementById('manual-msg').value.trim(); const stars = document.getElementById('manual-stars').value;
            if (!autor || !msg) return alert("Escribe nombre y mensaje.");
            newBtn.disabled = true; newBtn.innerHTML = "Publicando...";
            try { await addDoc(collection(db, "resenas"), { autor: autor, mensaje: msg, estrellas: parseInt(stars), aprobada: true, fecha: new Date() }); alert("✅ Reseña publicada!"); document.getElementById('manual-author').value = ""; document.getElementById('manual-msg').value = ""; cargarResenasAdmin(); } catch (e) { alert("Error: " + e.message); } finally { newBtn.disabled = false; newBtn.innerHTML = '<i class="fas fa-save"></i> Publicar'; }
        });
    }
}

// --- CARTA COMPLETA ---
let cartaLocal = [];
async function iniciarEditorCartaCompleta() {
    const btnAddCat = document.getElementById('btn-add-cat');
    if (btnAddCat) {
        const newBtn = btnAddCat.cloneNode(true); btnAddCat.parentNode.replaceChild(newBtn, btnAddCat);
        newBtn.addEventListener('click', () => { const name = document.getElementById('new-cat-name').value.trim(); if (name) { cartaLocal.push({ nombre: name, col1: "", col2: "", items: [] }); document.getElementById('new-cat-name').value = ""; renderCartaAdmin(); } else { alert("Escribe un nombre."); } });
    }
    const btnSaveFull = document.getElementById('btn-save-full-carta');
    if (btnSaveFull) {
        const newBtnSave = btnSaveFull.cloneNode(true); btnSaveFull.parentNode.replaceChild(newBtnSave, btnSaveFull);
        newBtnSave.addEventListener('click', async () => { newBtnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; newBtnSave.disabled = true; try { await setDoc(doc(db, "contenido", "cartaCompleta"), { categorias: cartaLocal }); alert("✅ Carta Actualizada"); } catch (e) { alert("Error"); } finally { newBtnSave.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios'; newBtnSave.disabled = false; } });
    }
    try { const snap = await getDoc(doc(db, "contenido", "cartaCompleta")); if (snap.exists() && snap.data().categorias) cartaLocal = snap.data().categorias; renderCartaAdmin(); } catch (e) { console.error(e); }
}

function renderCartaAdmin() {
    const container = document.getElementById('accordionCarta'); if (!container) return; container.innerHTML = "";
    cartaLocal.forEach((cat, index) => {
        const catId = `collapse-${index}`; let itemsHTML = `<table class="table table-sm table-striped align-middle"><thead class="table-light"><tr><th style="width:40%">Plato y Descripción</th><th>${cat.col1 || 'Precio 1'}</th><th>${cat.col2 || 'Precio 2'}</th><th style="width:50px"></th></tr></thead><tbody>`;
        cat.items.forEach((item, iItem) => { itemsHTML += `<tr><td><input type="text" class="form-control form-control-sm fw-bold" value="${item.nombre}" onchange="updateItem(${index}, ${iItem}, 'nombre', this.value)" placeholder="Nombre"><input type="text" class="form-control form-control-sm mt-1 text-muted fst-italic" value="${item.desc || ''}" onchange="updateItem(${index}, ${iItem}, 'desc', this.value)" placeholder="Descripción"></td><td><input type="text" class="form-control form-control-sm" value="${item.precio}" onchange="updateItem(${index}, ${iItem}, 'precio', this.value)"></td><td><input type="text" class="form-control form-control-sm" value="${item.precio2 || ''}" placeholder="-" onchange="updateItem(${index}, ${iItem}, 'precio2', this.value)"></td><td><button class="btn btn-outline-danger btn-sm border-0" onclick="deleteItem(${index}, ${iItem})"><i class="fas fa-trash"></i></button></td></tr>`; });
        itemsHTML += `</tbody></table><div class="d-flex gap-2 align-items-start bg-light p-2 rounded"><div class="flex-grow-1"><input type="text" id="new-item-name-${index}" class="form-control form-control-sm mb-1" placeholder="Nuevo plato"><input type="text" id="new-item-desc-${index}" class="form-control form-control-sm text-muted fst-italic" placeholder="Descripción"></div><div style="width:80px"><input type="text" id="new-item-price-${index}" class="form-control form-control-sm" placeholder="S/"></div><div style="width:80px"><input type="text" id="new-item-price2-${index}" class="form-control form-control-sm" placeholder="S/"></div><button class="btn btn-primary btn-sm" onclick="addItem(${index})" style="height:31px"><i class="fas fa-plus"></i></button></div>`;
        const headerConfig = `<div class="mb-3 p-2 border rounded bg-white"><label class="small text-muted fw-bold">Títulos de Columnas:</label><div class="d-flex gap-2"><input type="text" class="form-control form-control-sm" placeholder="Ej: Vaso" value="${cat.col1 || ''}" onchange="updateCatHeader(${index}, 'col1', this.value)"><input type="text" class="form-control form-control-sm" placeholder="Ej: Jarra" value="${cat.col2 || ''}" onchange="updateCatHeader(${index}, 'col2', this.value)"></div></div>`;
        const card = document.createElement('div'); card.className = "accordion-item border mb-2"; card.innerHTML = `<h2 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${catId}"><strong>${cat.nombre}</strong> <span class="badge bg-secondary ms-2">${cat.items.length}</span></button></h2><div id="${catId}" class="accordion-collapse collapse" data-bs-parent="#accordionCarta"><div class="accordion-body"><div class="text-end mb-2"><button class="btn btn-danger btn-sm" onclick="deleteCat(${index})"><i class="fas fa-trash"></i> Borrar Categoría</button></div>${headerConfig}${itemsHTML}</div></div>`; container.appendChild(card);
    });
}

window.updateCatHeader = (idx, f, v) => { cartaLocal[idx][f] = v; }; window.updateItem = (catIdx, itemIdx, f, v) => { cartaLocal[catIdx].items[itemIdx][f] = v; }; window.deleteItem = (catIdx, itemIdx) => { cartaLocal[catIdx].items.splice(itemIdx, 1); renderCartaAdmin(); }; window.deleteCat = (catIdx) => { if (confirm("¿Borrar?")) { cartaLocal.splice(catIdx, 1); renderCartaAdmin(); } };
window.addItem = (catIdx) => { const name = document.getElementById(`new-item-name-${catIdx}`).value; const desc = document.getElementById(`new-item-desc-${catIdx}`).value; const price = document.getElementById(`new-item-price-${catIdx}`).value; const price2 = document.getElementById(`new-item-price2-${catIdx}`).value; if (name && price) { cartaLocal[catIdx].items.push({ nombre: name, desc: desc, precio: price, precio2: price2 }); renderCartaAdmin(); setTimeout(() => { const el = document.getElementById(`collapse-${catIdx}`); if (el) new bootstrap.Collapse(el, { show: true }); }, 100); } };

async function generarEditorPlatosBase64(contId, docId, cant, btnId) { 
    const cont = document.getElementById(contId); if (!cont) return; const snap = await getDoc(doc(db, "contenido", docId)); let list = snap.exists() ? (snap.data().lista || []) : []; while (list.length < cant) list.push({ titulo: "", desc: "", img: "plato1.png" }); let html = ""; list.forEach((it, i) => { if (i < cant) html += `<div class="card p-3 mb-3 item-plato-${docId} border-0 shadow-sm bg-white"><div class="row align-items-center"><div class="col-md-2 text-center"><strong class="d-block mb-2 text-muted">Plato #${i + 1}</strong><div class="upload-box justify-content-center"><img src="${it.img}" class="current-img img-preview-tag"><label class="btn-upload-custom"><i class="fas fa-plus"></i><span>Subir</span><input type="file" class="img-file-input" accept="image/*" onchange="previsualizar(this)"></label><input type="hidden" class="img-url-hidden" value="${it.img}"></div></div><div class="col-md-10"><div class="row g-2"><div class="col-md-6"><label class="small text-muted">Título</label><input type="text" class="form-control title-input" value="${it.titulo}"></div><div class="col-md-6"><label class="small text-muted">Descripción</label><input type="text" class="form-control desc-input" value="${it.desc}"></div></div></div></div></div>`; }); cont.innerHTML = html; const btn = document.getElementById(btnId); if (btn) { const newBtn = btn.cloneNode(true); btn.parentNode.replaceChild(newBtn, btn); newBtn.addEventListener('click', async () => { newBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; newBtn.disabled = true; const items = cont.querySelectorAll(`.item-plato-${docId}`); const newList = []; for (const div of items) { const fileInput = div.querySelector('.img-file-input'); const hiddenInput = div.querySelector('.img-url-hidden'); let finalImg = hiddenInput.value; if (fileInput.files.length > 0) finalImg = await comprimirImagen(fileInput.files[0]); newList.push({ img: finalImg, titulo: div.querySelector('.title-input').value, desc: div.querySelector('.desc-input').value }); } await setDoc(doc(db, "contenido", docId), { lista: newList }); alert("✅ Guardado"); generarEditorPlatosBase64(contId, docId, cant, btnId); newBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Todo'; newBtn.disabled = false; }); }
}

window.previsualizar = function (i) { if (i.files && i.files[0]) { const r = new FileReader(); r.onload = function (e) { i.closest('.upload-box').querySelector('.current-img').src = e.target.result; }; r.readAsDataURL(i.files[0]); } }
function comprimirImagen(f) { return new Promise((res, rej) => { const r = new FileReader(); r.readAsDataURL(f); r.onload = (e) => { const i = new Image(); i.src = e.target.result; i.onload = () => { const c = document.createElement('canvas'); const s = 500 / i.width; c.width = 500; c.height = i.height * s; c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.7)); }; }; r.onerror = rej; }); }
function asignarGuardado(btnId, docId, getDataCallback) { const btn = document.getElementById(btnId); if (!btn) return; const newBtn = btn.cloneNode(true); btn.parentNode.replaceChild(newBtn, btn); newBtn.addEventListener('click', async (e) => { e.preventDefault(); const originalText = newBtn.innerHTML; newBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; newBtn.disabled = true; try { const datos = getDataCallback(); await updateDoc(doc(db, "contenido", docId), datos); alert("✅ Guardado"); } catch (error) { alert("Error: " + error.message); } finally { newBtn.innerHTML = originalText; newBtn.disabled = false; } }); }