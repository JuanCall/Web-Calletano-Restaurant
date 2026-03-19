import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, getDoc, updateDoc, addDoc, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyC2RKkuY_aEQaHVDvAt_-T_29sPQ6HUp50",
    authDomain: "calletano-restaurant.firebaseapp.com",
    projectId: "calletano-restaurant",
    storageBucket: "calletano-restaurant.firebasestorage.app",
    messagingSenderId: "1036720006578",
    appId: "1:1036720006578:web:31b305a61a353f324bb0ab"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let mesaSeleccionadaId = null; let mesasData = []; 
const contenedorMesas = document.getElementById('contenedor-mesas'); const tituloMesa = document.getElementById('titulo-mesa'); const estadoMesa = document.getElementById('estado-mesa');
const btnAgregarProducto = document.getElementById('btn-agregar-producto'); const btnTaper1 = document.getElementById('btn-taper-1'); const btnTaper2 = document.getElementById('btn-taper-2');
const btnRefresco = document.getElementById('btn-refresco'); const btnCobrar = document.getElementById('btn-cobrar'); const totalCuenta = document.getElementById('total-cuenta'); const listaPedidos = document.getElementById('lista-pedidos');

let modalProductosInstance = null; let itemsProhibidosDeCarta = []; 

async function cargarItemsProhibidos() {
    try {
        const snapCarta = await getDoc(doc(db, "contenido", "cartaCompleta"));
        if (snapCarta.exists() && snapCarta.data().categorias) {
            const categoriasProhibidas = ['Guarniciones', 'Jugos naturales', 'Bebidas heladas', 'Bebidas calientes', 'Cerveza'];
            snapCarta.data().categorias.forEach(cat => { if (categoriasProhibidas.includes(cat.nombre)) { cat.items.forEach(item => { itemsProhibidosDeCarta.push(item.nombre); if (cat.col1) itemsProhibidosDeCarta.push(`${item.nombre} (${cat.col1})`); if (cat.col2) itemsProhibidosDeCarta.push(`${item.nombre} (${cat.col2})`); }); } });
        }
    } catch (e) { console.error(e); }
}

function esPlatoParaRanking(nombre) {
    const terminosBase = ['Taper', 'Refresco', '(Extra)', '(Entrada)', '(Segundo)'];
    if (terminosBase.some(t => nombre.includes(t))) return false;
    if (itemsProhibidosDeCarta.includes(nombre)) return false; return true; 
}

// --- CEREBRO CAJA: CONVERSIÓN VISUAL CON NOTAS ---
function calcularRecargoTaper(modalidad, categoria, nombre) {
    if (modalidad === 'delivery') return 3; if (modalidad !== 'llevar') return 0;   
    const cats1Sol = ['Guarniciones', 'Jugos naturales', 'Bebidas heladas', 'Bebidas calientes', 'Cerveza', 'entrada'];
    if (cats1Sol.includes(categoria) || nombre.includes('(Entrada)') || nombre.includes('Humita')) return 1; return 2; 
}

function obtenerVistaPedido(pedido_actual) {
    if (!pedido_actual) return { vista: [], total: 0 };
    if (new Date().getDay() === 0) {
        let total = pedido_actual.reduce((a,b)=>a+b.subtotal,0); return { vista: JSON.parse(JSON.stringify(pedido_actual)), total };
    }

    let vista = []; let expE = []; let expS = []; let otros = [];

    pedido_actual.forEach(item => {
        if (item.categoria === 'entrada') { for(let i=0; i<item.cantidad; i++) expE.push({...item, cantidad: 1}); } 
        else if (item.categoria === 'segundo') { for(let i=0; i<item.cantidad; i++) expS.push({...item, cantidad: 1}); } 
        else { for(let i=0; i<item.cantidad; i++) otros.push({...item, cantidad: 1}); }
    });

    expE.sort((a,b) => (a.modalidad||'local').localeCompare(b.modalidad||'local'));
    expS.sort((a,b) => (a.modalidad||'local').localeCompare(b.modalidad||'local'));

    while (expE.length > 0 && expS.length > 0) {
        let E = expE.shift(); let S = expS.shift();
        let recargo = 0; let modName = 'local'; let notaMod = '';

        if (E.modalidad === 'delivery' || S.modalidad === 'delivery') { recargo = 3; modName = 'delivery'; if (E.modalidad !== S.modalidad) notaMod = ` (Mxt)`; } 
        else if (E.modalidad === 'llevar' && S.modalidad === 'llevar') { recargo = 2; modName = 'llevar'; } 
        else if (S.modalidad === 'llevar') { recargo = 2; modName = 'mixto'; notaMod = ` (S/Llevar)`; } 
        else if (E.modalidad === 'llevar') { recargo = 1; modName = 'mixto'; notaMod = ` (E/Llevar)`; }

        // FUSIONAMOS LAS NOTAS
        let notasCombo = [];
        if (E.nota) notasCombo.push(`${E.nombre.replace(' (Entrada)','')}: ${E.nota}`);
        if (S.nota) notasCombo.push(`${S.nombre.replace(' (Segundo)','')}: ${S.nota}`);
        let notaFinal = notasCombo.length > 0 ? notasCombo.join(" | ") : "";

        let nombreCombo = `Menú Completo${notaMod}`;
        let idx = vista.findIndex(v => v.nombre === nombreCombo && (v.modalidad||'local') === modName && (v.nota||'') === notaFinal);
        if (idx > -1) { vista[idx].cantidad++; vista[idx].subtotal += (15 + recargo); } 
        else { vista.push({ nombre: nombreCombo, cantidad: 1, precio: 15, modalidad: modName, categoria: 'menu', subtotal: 15 + recargo, nota: notaFinal }); }
    }

    [...expE, ...expS, ...otros].forEach(item => {
        let recargo = calcularRecargoTaper(item.modalidad, item.categoria, item.nombre);
        let idx = vista.findIndex(v => v.nombre === item.nombre && (v.modalidad||'local') === (item.modalidad||'local') && (v.nota||'') === (item.nota||''));
        if (idx > -1) { vista[idx].cantidad++; vista[idx].subtotal += (item.precio + recargo); } 
        else { vista.push({ ...item, cantidad: 1, subtotal: item.precio + recargo }); }
    });

    let total = vista.reduce((a,b) => a+b.subtotal, 0); return { vista, total };
}

function iniciarSistemaPOS() {
    const esDomingo = new Date().getDay() === 0; const precioRefresco = esDomingo ? 3.00 : 2.00;
    btnRefresco.innerHTML = `<i class="fas fa-glass-whiskey"></i> S/ ${precioRefresco}`; btnRefresco.setAttribute('onclick', `agregarAlPedido('Refresco', ${precioRefresco}, 'bebida')`);

    onSnapshot(collection(db, "mesas_pos"), (snapshot) => {
        mesasData = []; snapshot.forEach((doc) => { mesasData.push({ id: doc.id, ...doc.data() }); });
        mesasData.sort((a, b) => a.numero - b.numero); dibujarMesas(); actualizarComandera(); 
    });
    cargarItemsProhibidos(); cargarCartaDesdeWeb();
}

function dibujarMesas() {
    contenedorMesas.innerHTML = ""; 
    mesasData.forEach(mesa => {
        const esOcupada = mesa.estado === "ocupada"; const claseEstado = esOcupada ? "mesa-ocupada" : "mesa-libre"; const esSeleccionada = mesa.id === mesaSeleccionadaId ? "mesa-seleccionada" : "";
        const div = document.createElement('div'); div.className = "col-4 mb-3"; 
        div.innerHTML = `
            <div class="card mesa-card shadow-sm ${claseEstado} ${esSeleccionada}" onclick="seleccionarMesa('${mesa.id}')" style="height: 160px;">
                <h3 class="fw-bold mb-1">Mesa ${mesa.numero}</h3>
                <span class="badge bg-white text-dark mb-2">${esOcupada ? 'Ocupada' : 'Libre'}</span>
                <strong class="fs-5">S/ ${(mesa.total_consumo||0).toFixed(2)}</strong>
            </div>`;
        contenedorMesas.appendChild(div);
    });
}

window.seleccionarMesa = (id) => { mesaSeleccionadaId = id; dibujarMesas(); actualizarComandera(); };

function actualizarComandera() {
    if (!mesaSeleccionadaId) return; 
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa) return;

    tituloMesa.innerText = `Mesa ${mesa.numero}`; btnAgregarProducto.disabled = false; btnTaper1.disabled = false; btnTaper2.disabled = false; btnRefresco.disabled = false;
    
    if (mesa.estado === "libre" || !mesa.pedido_actual || mesa.pedido_actual.length === 0) {
        estadoMesa.className = "badge bg-success mt-2"; estadoMesa.innerText = "Libre";
        listaPedidos.innerHTML = `<div class="text-center text-muted mt-5"><p>Agregue platos para abrir la mesa.</p></div>`; totalCuenta.innerText = "S/ 0.00"; btnCobrar.disabled = true;
    } else {
        estadoMesa.className = "badge bg-danger mt-2"; estadoMesa.innerText = "Ocupada";
        let { vista, total } = obtenerVistaPedido(mesa.pedido_actual);
        let itemsHTML = "";
        
        vista.forEach((item) => {
            const modalidad = item.modalidad || 'local'; const costoTaper = calcularRecargoTaper(modalidad, item.categoria, item.nombre);
            let badgeMod = modalidad === 'llevar' ? `<span class="badge bg-warning text-dark ms-1" style="font-size:0.65rem;">+S/${costoTaper} Llevar</span>` : '';
            let btnColor = modalidad === 'llevar' ? 'btn-warning text-dark' : 'btn-outline-secondary';
            let iconMod = modalidad === 'llevar' ? 'fa-shopping-bag' : 'fa-store'; let textoMod = modalidad === 'llevar' ? 'Llevar' : 'Local';

            if (modalidad === 'delivery') { badgeMod = `<span class="badge bg-info text-dark ms-1" style="font-size:0.65rem;">+S/${costoTaper} Delivery</span>`; btnColor = 'btn-info text-dark'; iconMod = 'fa-motorcycle'; textoMod = 'Delivery'; }

            let txtNota = item.nota ? `<br><span class="text-danger fst-italic mt-1 d-block" style="font-size: 0.75rem;"><i class="fas fa-comment-dots"></i> ${item.nota}</span>` : '';

            itemsHTML += `
            <div class="d-flex flex-column border-bottom py-2">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <div style="width: 70%"><strong class="d-block text-dark small">${item.nombre}</strong>${badgeMod}${txtNota}</div>
                    <strong class="text-primary text-end" style="width: 30%">S/ ${item.subtotal.toFixed(2)}</strong>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-1">
                    <button class="btn btn-sm ${btnColor} px-2 py-0 fw-bold shadow-sm" onclick="cambiarModalidadVista('${item.nombre}', '${modalidad}')" style="border-radius: 12px; font-size: 0.75rem;"><i class="fas ${iconMod}"></i> ${textoMod}</button>
                    <div class="d-flex align-items-center bg-light rounded shadow-sm border">
                        <button class="btn btn-sm text-secondary px-2 py-0 fw-bold border-0" onclick="modificarVistaCantidad('${item.nombre}', '${modalidad}', -1)">-</button>
                        <span class="mx-2 fw-bold" style="min-width: 12px; text-align: center;">${item.cantidad}</span>
                        <button class="btn btn-sm text-primary px-2 py-0 fw-bold border-0" onclick="modificarVistaCantidad('${item.nombre}', '${modalidad}', 1)">+</button>
                        <div class="border-start ms-1 ps-1"><button class="btn btn-sm text-danger border-0 px-2 py-0" onclick="eliminarVistaItem('${item.nombre}', '${modalidad}')"><i class="fas fa-trash-alt"></i></button></div>
                    </div>
                </div>
            </div>`;
        });

        // Agregamos los botones de Pre-Cuenta y Enviar a Cocina para la Cajera
        itemsHTML += `
        <div class="mt-3 mb-2 d-flex gap-2">
            <button class="btn btn-secondary w-50 fw-bold py-2 shadow-sm" onclick="imprimirPreCuenta()" title="Imprimir cuenta de la mesa">
                <i class="fas fa-receipt me-1"></i> Pre-Cuenta
            </button>
            <button class="btn btn-dark w-50 fw-bold py-2 shadow-sm" onclick="imprimirComandasSeparadas()" title="Enviar a cocina/barra">
                <i class="fas fa-fire me-1"></i> Pedido
            </button>
        </div>`;

        listaPedidos.innerHTML = itemsHTML; totalCuenta.innerText = `S/ ${total.toFixed(2)}`; btnCobrar.disabled = false; 
    }
}

// BOTONES DE EDICIÓN CAJA
window.modificarVistaCantidad = async (nombre, modalidad, cambio) => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa) return; let pedido = [...mesa.pedido_actual];

    if (cambio === -1) {
        if (nombre.startsWith('Menú Completo')) {
            let idxE = pedido.findIndex(i => i.categoria === 'entrada'); if(idxE > -1) { pedido[idxE].cantidad--; if(pedido[idxE].cantidad<=0) pedido.splice(idxE, 1); }
            let idxS = pedido.findIndex(i => i.categoria === 'segundo'); if(idxS > -1) { pedido[idxS].cantidad--; if(pedido[idxS].cantidad<=0) pedido.splice(idxS, 1); }
        } else {
            let idx = pedido.findIndex(i => i.nombre === nombre && (i.modalidad||'local') === modalidad);
            if (idx > -1) { pedido[idx].cantidad--; if(pedido[idx].cantidad <= 0) pedido.splice(idx, 1); }
        }
    } else if (cambio === 1) {
        if (nombre.startsWith('Menú Completo')) {
            pedido.push({nombre: 'Menú Completo', precio: 15, cantidad: 1, modalidad: (modalidad==='mixto'?'local':modalidad), categoria: 'menu', subtotal: 15});
        } else {
            let idx = pedido.findIndex(i => i.nombre === nombre && (i.modalidad||'local') === modalidad);
            if (idx > -1) pedido[idx].cantidad++; else pedido.push({nombre: nombre, precio: 0, cantidad: 1, modalidad: modalidad, subtotal: 0});
        }
    }
    let { total } = obtenerVistaPedido(pedido);
    try { await updateDoc(doc(db, "mesas_pos", mesa.id), { estado: pedido.length === 0 ? "libre" : "ocupada", pedido_actual: pedido, total_consumo: total }); } catch (e) {}
};

window.cambiarModalidadVista = async (nombre, modalidad) => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa) return; let pedido = [...mesa.pedido_actual];
    let nuevaMod = modalidad === 'local' ? 'llevar' : (modalidad === 'llevar' ? 'delivery' : 'local');

    if (nombre.startsWith('Menú Completo')) {
        let idxE = pedido.findIndex(i => i.categoria === 'entrada' && (i.modalidad||'local') === (modalidad==='mixto'?'local':modalidad));
        let idxS = pedido.findIndex(i => i.categoria === 'segundo');
        if (idxE > -1) { if(pedido[idxE].cantidad>1){pedido[idxE].cantidad--; pedido.push({...pedido[idxE], cantidad:1, modalidad:nuevaMod});} else {pedido[idxE].modalidad=nuevaMod;} }
        if (idxS > -1) { if(pedido[idxS].cantidad>1){pedido[idxS].cantidad--; pedido.push({...pedido[idxS], cantidad:1, modalidad:nuevaMod});} else {pedido[idxS].modalidad=nuevaMod;} }
    } else {
        let idx = pedido.findIndex(i => i.nombre === nombre && (i.modalidad||'local') === modalidad);
        if (idx > -1) { if(pedido[idx].cantidad>1){pedido[idx].cantidad--; pedido.push({...pedido[idx], cantidad:1, modalidad:nuevaMod});} else {pedido[idx].modalidad=nuevaMod;} }
    }
    let { total } = obtenerVistaPedido(pedido);
    try { await updateDoc(doc(db, "mesas_pos", mesa.id), { pedido_actual: pedido, total_consumo: total }); } catch (e) {}
};

window.eliminarVistaItem = async (nombre, modalidad) => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa || !confirm("¿Eliminar plato(s)?")) return; let pedido = [...mesa.pedido_actual];
    if (nombre.startsWith('Menú Completo')) {
        let cantE = pedido.filter(i => i.categoria === 'entrada').reduce((a,b)=>a+b.cantidad,0); let cantS = pedido.filter(i => i.categoria === 'segundo').reduce((a,b)=>a+b.cantidad,0);
        let eFormar = Math.min(cantE, cantS); let sFormar = eFormar;
        for(let i=pedido.length-1; i>=0; i--) { if (pedido[i].categoria==='entrada') { let restar = Math.min(pedido[i].cantidad, eFormar); pedido[i].cantidad-=restar; eFormar-=restar; if(pedido[i].cantidad<=0) pedido.splice(i, 1); } }
        for(let i=pedido.length-1; i>=0; i--) { if (pedido[i].categoria==='segundo') { let restar = Math.min(pedido[i].cantidad, sFormar); pedido[i].cantidad-=restar; sFormar-=restar; if(pedido[i].cantidad<=0) pedido.splice(i, 1); } }
    } else { pedido = pedido.filter(i => !(i.nombre === nombre && (i.modalidad||'local') === modalidad)); }
    let { total } = obtenerVistaPedido(pedido);
    try { await updateDoc(doc(db, "mesas_pos", mesa.id), { estado: pedido.length === 0 ? "libre" : "ocupada", pedido_actual: pedido, total_consumo: total }); } catch (e) {}
};

async function cargarCartaDesdeWeb() {
    try {
        const snapCarta = await getDoc(doc(db, "contenido", "cartaCompleta"));
        const snapMenu = await getDoc(doc(db, "contenido", "menuDiario"));
        const esDomingo = new Date().getDay() === 0;

        let navHTML = `<div class="d-flex overflow-auto pb-2 mb-3 sticky-top bg-light shadow-sm" style="z-index: 1020; gap: 0.5rem; top: -16px; margin-left: -16px; margin-right: -16px; padding: 16px 16px 10px 16px;">`;
        let bodyHTML = `<button class="btn btn-outline-danger w-100 mb-4 fw-bold shadow-sm" onclick="agregarPlatoPersonalizado()"><i class="fas fa-keyboard"></i> Plato fuera de carta</button>`;

        if(snapMenu.exists()) {
            const d = snapMenu.data();
            navHTML += `<button type="button" class="btn btn-sm btn-dark rounded-pill fw-bold px-3 flex-shrink-0 shadow-sm" onclick="document.getElementById('seccion-menu').scrollIntoView({behavior: 'smooth', block: 'start'})">${esDomingo ? "Almuerzo" : "Menú del Día"}</button>`;
            bodyHTML += `<div id="seccion-menu" style="scroll-margin-top: 80px;">`;

            if (esDomingo) {
                bodyHTML += `<h5 class="fw-bold text-warning border-bottom">Almuerzo Dominical (S/ 30)</h5>`;
                if (d.segundos) d.segundos.forEach(s => bodyHTML += `<button class="btn btn-warning w-100 mb-2 fw-bold text-start shadow-sm" onclick="agregarAlPedido('Almuerzo: ${s.nombre}', 30, 'segundo')"><i class="fas fa-star"></i> ${s.nombre}</button>`);
                bodyHTML += `<button class="btn btn-outline-warning w-100 mb-3 fw-bold text-start shadow-sm" onclick="agregarAlPedido('Humita', 3, 'entrada')"><i class="fas fa-plus-circle"></i> Humita (S/ 3.00)</button>`;
            } else {
                if (d.entradas && d.entradas.length > 0) {
                    const precios = d.entradas.map(e => e.precio); const todosIguales = precios.every(p => p === precios[0]);
                    bodyHTML += `<h5 class="fw-bold text-warning border-bottom">Opciones de Entrada ${todosIguales ? `(S/ ${precios[0]})` : ''}</h5>`;
                    d.entradas.forEach(e => bodyHTML += `<button class="btn btn-outline-warning w-100 mb-2 fw-bold text-start shadow-sm" onclick="agregarAlPedido('${e.nombre} (Entrada)', ${e.precio}, 'entrada')">${e.nombre} ${!todosIguales ? `(S/ ${e.precio})` : ''}</button>`);
                }
                bodyHTML += `<h5 class="fw-bold text-danger border-bottom mt-3">Segundos (S/ 15)</h5>`;
                if (d.segundos) d.segundos.forEach(s => bodyHTML += `<button class="btn btn-danger w-100 mb-4 fw-bold text-start shadow-sm" onclick="agregarAlPedido('${s.nombre} (Segundo)', 15, 'segundo')">${s.nombre}</button>`);
            }
            bodyHTML += `</div>`; 
        }

        if(snapCarta.exists() && snapCarta.data().categorias) {
            snapCarta.data().categorias.forEach((cat, index) => {
                const catId = `seccion-carta-${index}`;
                navHTML += `<button type="button" class="btn btn-sm btn-outline-primary rounded-pill fw-bold px-3 flex-shrink-0 shadow-sm" onclick="document.getElementById('${catId}').scrollIntoView({behavior: 'smooth', block: 'start'})">${cat.nombre}</button>`;
                bodyHTML += `<div id="${catId}" style="scroll-margin-top: 80px;"><h6 class="mt-2 fw-bold text-primary border-bottom">${cat.nombre}</h6><div class="row g-2 mb-4">`;
                
                cat.items.forEach(item => {
                    const p1 = parseFloat(String(item.precio).replace(/[^0-9.]/g, '')) || 0;
                    if (item.precio2 && item.precio2 !== "-") {
                        const p2 = parseFloat(String(item.precio2).replace(/[^0-9.]/g, '')) || 0;
                        bodyHTML += `<div class="col-6"><button class="btn btn-outline-secondary w-100 text-start small shadow-sm h-100" onclick="agregarAlPedido('${item.nombre} (${cat.col1})', ${p1}, '${cat.nombre}')"><small>${item.nombre} <b class="text-primary">(${cat.col1})</b></small><br><strong>S/ ${p1.toFixed(2)}</strong></button></div>
                                     <div class="col-6"><button class="btn btn-outline-secondary w-100 text-start small shadow-sm h-100" onclick="agregarAlPedido('${item.nombre} (${cat.col2})', ${p2}, '${cat.nombre}')"><small>${item.nombre} <b class="text-success">(${cat.col2})</b></small><br><strong>S/ ${p2.toFixed(2)}</strong></button></div>`;
                    } else {
                        bodyHTML += `<div class="col-6"><button class="btn btn-outline-secondary w-100 text-start small shadow-sm h-100" onclick="agregarAlPedido('${item.nombre}', ${p1}, '${cat.nombre}')"><small>${item.nombre}</small><br><strong>S/ ${p1.toFixed(2)}</strong></button></div>`;
                    }
                });
                bodyHTML += `</div></div>`; 
            });
        }
        navHTML += `</div>`; document.getElementById('catalogo-productos').innerHTML = navHTML + bodyHTML;
    } catch (error) { console.error(error); }
}

btnAgregarProducto.addEventListener('click', () => {
    if (!modalProductosInstance) modalProductosInstance = new bootstrap.Modal(document.getElementById('modalProductos'));
    modalProductosInstance.show();
});

window.agregarPlatoPersonalizado = () => {
    const n = prompt("Nombre del plato:"); const p = parseFloat(prompt("Precio (S/):"));
    if (n && !isNaN(p)) agregarAlPedido(n + " (Extra)", p, 'general');
};

window.agregarAlPedido = async (nombre, precio, categoria = 'general') => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa) return; let nuevoPedido = mesa.pedido_actual ? [...mesa.pedido_actual] : [];
    
    // En caja, agrupa si no tiene nota (ya que la caja no suele poner notas)
    let idx = nuevoPedido.findIndex(i => i.nombre === nombre && (i.modalidad || 'local') === 'local' && !i.nota);
    if (idx > -1) { nuevoPedido[idx].cantidad += 1; } 
    else { nuevoPedido.push({ nombre: nombre, precio: parseFloat(precio), cantidad: 1, modalidad: 'local', categoria: categoria, subtotal: 0 }); }
    
    let { total } = obtenerVistaPedido(nuevoPedido);
    try { await updateDoc(doc(db, "mesas_pos", mesa.id), { estado: "ocupada", pedido_actual: nuevoPedido, total_consumo: total });
        if(modalProductosInstance) modalProductosInstance.hide();
    } catch (e) { console.error(e); }
};

// =========================================================
//  5. EL PROCESO DE COBRO (Pagos Mixtos y Vuelto)
// =========================================================
let modalCobroInstance = null; const modalCobrarTotal = document.getElementById('modal-cobrar-total'); const modalCobrarRestante = document.getElementById('modal-cobrar-restante'); const btnConfirmarCobro = document.getElementById('btn-confirmar-cobro'); const inputsPagos = document.querySelectorAll('.pago-input'); let totalACobrarActual = 0;

btnCobrar.addEventListener('click', () => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId); if (!mesa) return;
    totalACobrarActual = mesa.total_consumo; modalCobrarTotal.innerText = `Total: S/ ${totalACobrarActual.toFixed(2)}`;
    inputsPagos.forEach(input => input.value = ""); document.getElementById('pago-efectivo').value = totalACobrarActual.toFixed(2);
    calcularVuelto();
    if (!modalCobroInstance) modalCobroInstance = new bootstrap.Modal(document.getElementById('modalCobrar'));
    modalCobroInstance.show();
});

inputsPagos.forEach(input => { input.addEventListener('input', calcularVuelto); });

function calcularVuelto() {
    let sumaRecibida = 0; inputsPagos.forEach(input => { sumaRecibida += parseFloat(input.value) || 0; });
    let diferencia = totalACobrarActual - sumaRecibida;
    if (diferencia > 0) { modalCobrarRestante.innerHTML = `<span class="text-danger">Falta: S/ ${diferencia.toFixed(2)}</span>`; btnConfirmarCobro.disabled = true; } 
    else if (Math.abs(diferencia) < 0.01) { modalCobrarRestante.innerHTML = `<span class="text-success"><i class="fas fa-check"></i> Monto Exacto</span>`; btnConfirmarCobro.disabled = false; } 
    else { modalCobrarRestante.innerHTML = `<span class="text-warning"><i class="fas fa-exchange-alt"></i> Dar Vuelto: S/ ${Math.abs(diferencia).toFixed(2)}</span>`; btnConfirmarCobro.disabled = false; }
}

btnConfirmarCobro.addEventListener('click', async () => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId); if (!mesa) return;
    btnConfirmarCobro.disabled = true; btnConfirmarCobro.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';

    try {
        const datosMetodos = { efectivo: parseFloat(document.getElementById('pago-efectivo').value) || 0, yape: parseFloat(document.getElementById('pago-yape').value) || 0, plin: parseFloat(document.getElementById('pago-plin').value) || 0, tarjeta: parseFloat(document.getElementById('pago-tarjeta').value) || 0 };
        let { vista } = obtenerVistaPedido(mesa.pedido_actual);
        
        await addDoc(collection(db, "ventas_historicas"), { mesa: mesa.numero, fecha: new Date(), items: mesa.pedido_actual, total_cobrado: totalACobrarActual, metodos_pago: datosMetodos });
        await updateDoc(doc(db, "mesas_pos", mesa.id), { estado: "libre", pedido_actual: [], total_consumo: 0 });
        
        modalCobroInstance.hide();
        imprimirNotaVentaHTML(mesa.numero, vista, totalACobrarActual, datosMetodos);
    } catch (error) { console.error(error); alert("Error al cobrar."); } 
    finally { btnConfirmarCobro.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar Pago'; btnConfirmarCobro.disabled = false; }
});

// =========================================================
//  6. REGISTRO DE GASTOS Y ARQUEO FINAL
// =========================================================
let modalGastoInstance = null; const btnNuevoGasto = document.getElementById('btn-nuevo-gasto'); const btnGuardarGasto = document.getElementById('btn-guardar-gasto');

async function cargarGastosHoy() {
    const listaGastos = document.getElementById('lista-gastos-hoy'); if (!listaGastos) return;
    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0); 
    const q = query(collection(db, "gastos"), where("fecha", ">=", inicioDia));
    try {
        const snap = await getDocs(q); listaGastos.innerHTML = "";
        if (snap.empty) { listaGastos.innerHTML = "<div class='text-center text-muted small py-2'>No hay gastos registrados hoy.</div>"; return; }
        snap.forEach(documento => {
            const d = documento.data();
            listaGastos.innerHTML += `<div class="d-flex justify-content-between align-items-center bg-white border shadow-sm p-2 rounded mb-1 animate__animated animate__fadeIn"><div><strong class="d-block text-dark small">${d.concepto}</strong><span class="badge bg-secondary mt-1" style="font-size: 0.65rem;">${d.categoria}</span></div><div class="d-flex align-items-center"><strong class="text-danger me-3 fw-bold">S/ ${d.monto.toFixed(2)}</strong><button class="btn btn-sm text-danger border-0 px-2" onclick="eliminarGasto('${documento.id}')"><i class="fas fa-trash-alt"></i></button></div></div>`;
        });
    } catch (error) { console.error(error); }
}

window.eliminarGasto = async (id) => { if (confirm("¿Anular este gasto?")) { try { await deleteDoc(doc(db, "gastos", id)); cargarGastosHoy(); } catch (error) { alert("Error."); } } };

btnNuevoGasto.addEventListener('click', () => {
    if (!modalGastoInstance) modalGastoInstance = new bootstrap.Modal(document.getElementById('modalGasto'));
    document.getElementById('gasto-concepto').value = ""; document.getElementById('gasto-monto').value = "0";
    cargarGastosHoy(); modalGastoInstance.show();
});

btnGuardarGasto.addEventListener('click', async () => {
    const concepto = document.getElementById('gasto-concepto').value.trim(); const categoria = document.getElementById('gasto-categoria').value; const monto = parseFloat(document.getElementById('gasto-monto').value) || 0;
    if (!concepto || monto <= 0) return alert("Escribe el concepto y un monto válido.");
    btnGuardarGasto.disabled = true; btnGuardarGasto.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    try {
        await addDoc(collection(db, "gastos"), { fecha: new Date(), concepto: concepto, categoria: categoria, monto: monto });
        document.getElementById('gasto-concepto').value = ""; document.getElementById('gasto-monto').value = "0"; cargarGastosHoy();
        btnGuardarGasto.innerHTML = '<i class="fas fa-check"></i> ¡Guardado!'; btnGuardarGasto.classList.replace('btn-warning', 'btn-success');
        setTimeout(() => { btnGuardarGasto.innerHTML = '<i class="fas fa-save me-2"></i>Guardar Gasto'; btnGuardarGasto.classList.replace('btn-success', 'btn-warning'); btnGuardarGasto.disabled = false; }, 1500);
    } catch (error) { console.error(error); btnGuardarGasto.disabled = false; btnGuardarGasto.innerHTML = '<i class="fas fa-save me-2"></i>Guardar Gasto'; }
});

let modalArqueoInstance = null; const btnArqueo = document.getElementById('btn-arqueo');

btnArqueo.addEventListener('click', async () => {
    if (!modalArqueoInstance) modalArqueoInstance = new bootstrap.Modal(document.getElementById('modalArqueo'));
    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
    const qVentas = query(collection(db, "ventas_historicas"), where("fecha", ">=", inicioDia));
    const qGastos = query(collection(db, "gastos"), where("fecha", ">=", inicioDia));
    
    try {
        const [ventasSnap, gastosSnap] = await Promise.all([getDocs(qVentas), getDocs(qGastos)]);
        let totEfectivo = 0, totYape = 0, totPlin = 0, totTarjeta = 0, totalGastos = 0;

        ventasSnap.forEach((doc) => { const data = doc.data(); if (data.metodos_pago) { totEfectivo += data.metodos_pago.efectivo || 0; totYape += data.metodos_pago.yape || 0; totPlin += data.metodos_pago.plin || 0; totTarjeta += data.metodos_pago.tarjeta || 0; } });
        gastosSnap.forEach((doc) => { totalGastos += doc.data().monto || 0; });
        const totalIngresos = totEfectivo + totYape + totPlin + totTarjeta;
        
        document.getElementById('arq-efectivo').innerText = `S/ ${totEfectivo.toFixed(2)}`; document.getElementById('arq-yape').innerText = `S/ ${totYape.toFixed(2)}`;
        document.getElementById('arq-plin').innerText = `S/ ${totPlin.toFixed(2)}`; document.getElementById('arq-tarjeta').innerText = `S/ ${totTarjeta.toFixed(2)}`;
        document.getElementById('arq-ingresos').innerText = `S/ ${totalIngresos.toFixed(2)}`; document.getElementById('arq-gastos').innerText = `S/ ${totalGastos.toFixed(2)}`;
        document.getElementById('arq-neta').innerText = `S/ ${(totalIngresos - totalGastos).toFixed(2)}`;
        document.getElementById('arq-neta').className = (totalIngresos - totalGastos) < 0 ? "text-danger fw-bold m-0" : "text-white fw-bold m-0";
        
        let conteoPlatosHoy = {};
        ventasSnap.forEach((doc) => { const data = doc.data(); if (data.items) { data.items.forEach(item => { if (esPlatoParaRanking(item.nombre)) conteoPlatosHoy[item.nombre] = (conteoPlatosHoy[item.nombre] || 0) + item.cantidad; }); } });
        let rankingHoy = Object.keys(conteoPlatosHoy).map(n => ({ nombre: n, cant: conteoPlatosHoy[n] })).sort((a, b) => b.cant - a.cant).slice(0, 3);
        const containerTop = document.getElementById('arq-top-platos'); containerTop.innerHTML = rankingHoy.length > 0 ? rankingHoy.map((p, i) => `<div>${i+1}. ${p.nombre} (${p.cant})</div>`).join("") : "Sin ventas registradas hoy.";
        modalArqueoInstance.show();
    } catch (error) { console.error("Error:", error); }
});

// =========================================================
//  7. DASHBOARD GRÁFICO (CHART.JS) Y RANKING
// =========================================================
let modalReportesInstance = null; let chartFinanzasInstance = null; let chartRankingInstance = null; const btnReportes = document.getElementById('btn-reportes'); const inputFiltroMes = document.getElementById('filtro-mes-reporte');
btnReportes.addEventListener('click', () => {
    if (!modalReportesInstance) modalReportesInstance = new bootstrap.Modal(document.getElementById('modalReportes'));
    if (!inputFiltroMes.value) { const hoy = new Date(); const mesStr = (hoy.getMonth() + 1).toString().padStart(2, '0'); inputFiltroMes.value = `${hoy.getFullYear()}-${mesStr}`; }
    cargarDatosDashboard(inputFiltroMes.value); modalReportesInstance.show();
});
inputFiltroMes.addEventListener('change', (e) => { cargarDatosDashboard(e.target.value); });

async function cargarDatosDashboard(anioMes) {
    if (!anioMes) return; const [year, month] = anioMes.split('-'); const inicioMes = new Date(year, parseInt(month) - 1, 1); const finMes = new Date(year, parseInt(month), 0, 23, 59, 59);
    const qVentas = query(collection(db, "ventas_historicas"), where("fecha", ">=", inicioMes), where("fecha", "<=", finMes)); const qGastos = query(collection(db, "gastos"), where("fecha", ">=", inicioMes), where("fecha", "<=", finMes));

    try {
        const [ventasSnap, gastosSnap] = await Promise.all([getDocs(qVentas), getDocs(qGastos)]);
        let totalIngresos = 0; let totalGastos = 0;
        const numDias = finMes.getDate(); const labelsDias = Array.from({length: numDias}, (_, i) => `Día ${i + 1}`); const dataIngresos = new Array(numDias).fill(0); const dataGastos = new Array(numDias).fill(0); let conteoPlatos = {};

        ventasSnap.forEach(doc => {
            const data = doc.data(); const fecha = data.fecha.toDate(); const diaIndex = fecha.getDate() - 1; 
            dataIngresos[diaIndex] += data.total_cobrado || 0; totalIngresos += data.total_cobrado || 0;
            if (data.items && Array.isArray(data.items)) { data.items.forEach(item => { if (esPlatoParaRanking(item.nombre)) { if (conteoPlatos[item.nombre]) conteoPlatos[item.nombre] += item.cantidad; else conteoPlatos[item.nombre] = item.cantidad; } }); }
        });
        gastosSnap.forEach(doc => { const data = doc.data(); const fecha = data.fecha.toDate(); const diaIndex = fecha.getDate() - 1; dataGastos[diaIndex] += data.monto || 0; totalGastos += data.monto || 0; });

        const gananciaNeta = totalIngresos - totalGastos;
        document.getElementById('rep-ingresos').innerText = `S/ ${totalIngresos.toFixed(2)}`; document.getElementById('rep-gastos').innerText = `S/ ${totalGastos.toFixed(2)}`;
        document.getElementById('rep-neta').innerText = `S/ ${gananciaNeta.toFixed(2)}`; document.getElementById('rep-neta').className = gananciaNeta < 0 ? "text-danger fw-bold m-0" : "text-white fw-bold m-0";

        let rankingArray = Object.keys(conteoPlatos).map(nombre => { return { nombre: nombre, cantidad: conteoPlatos[nombre] }; }); rankingArray.sort((a, b) => b.cantidad - a.cantidad);
        const topN = 12; const labelsRanking = rankingArray.slice(0, topN).map(item => item.nombre); const dataRanking = rankingArray.slice(0, topN).map(item => item.cantidad);
        dibujarGraficoFinanzas(labelsDias, dataIngresos, dataGastos); dibujarGraficoRanking(labelsRanking, dataRanking);
    } catch (error) { console.error("Error en dashboard:", error); }
}

function dibujarGraficoFinanzas(labels, dataIngresos, dataGastos) {
    const ctx = document.getElementById('graficoFinanciero').getContext('2d'); if (chartFinanzasInstance) chartFinanzasInstance.destroy();
    chartFinanzasInstance = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [ { label: 'Ingresos (S/)', data: dataIngresos, borderColor: '#198754', backgroundColor: 'rgba(25, 135, 84, 0.15)', borderWidth: 3, fill: true, tension: 0.4 }, { label: 'Gastos (S/)', data: dataGastos, borderColor: '#dc3545', backgroundColor: 'rgba(220, 53, 69, 0.1)', borderWidth: 3, fill: true, tension: 0.4 } ] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { tooltip: { callbacks: { label: function(context) { return ` ${context.dataset.label}: S/ ${context.parsed.y.toFixed(2)}`; } } } } } });
}
function dibujarGraficoRanking(labels, dataCants) {
    const ctx = document.getElementById('graficoRanking').getContext('2d'); if (chartRankingInstance) chartRankingInstance.destroy();
    chartRankingInstance = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [{ label: 'Cantidades Vendidas', data: dataCants, backgroundColor: 'rgba(255, 193, 7, 0.7)', borderColor: '#ffc107', borderWidth: 1, borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(context) { return ` Vendidos: ${context.parsed.x} unidades`; } } } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } }, y: { ticks: { font: { weight: 'bold' } } } } } });
}

// =========================================================
//  8. SEGURIDAD Y AUTENTICACIÓN (LOGIN)
// =========================================================
const loginSection = document.getElementById('login-section'); const posSection = document.getElementById('pos-section');
onAuthStateChanged(auth, (user) => {
    if (user) { loginSection.classList.add('d-none'); posSection.classList.remove('d-none'); iniciarSistemaPOS(); } 
    else { loginSection.classList.remove('d-none'); posSection.classList.add('d-none'); mesasData = []; contenedorMesas.innerHTML = ""; }
});
document.getElementById('btn-login').addEventListener('click', () => {
    const email = document.getElementById('pos-email').value; const pass = document.getElementById('pos-pass').value;
    const btn = document.getElementById('btn-login'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
    signInWithEmailAndPassword(auth, email, pass).catch(error => { alert("Acceso denegado."); }).finally(() => { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Abrir Caja'; });
});
document.getElementById('btn-logout').addEventListener('click', () => { if(confirm("¿Cerrar la caja y salir?")) signOut(auth); });

// =========================================================
// SISTEMA DE IMPRESIÓN (Disparo simultáneo antibloqueos)
// =========================================================
function enviarAImpresora(htmlContent, windowName) {
    const printWindow = window.open('', windowName, 'width=400,height=600');
    
    if (!printWindow) {
        alert("⚠️ EL NAVEGADOR BLOQUEÓ EL TICKET.\n\nPor favor, ve a la barra de direcciones de Chrome arriba a la derecha, haz clic en el ícono de ventana con una 'X' roja y selecciona 'Permitir siempre ventanas emergentes'.");
        return;
    }

    printWindow.document.write(`
        <html><head><title>${windowName}</title>
        <style>
            @page { margin: 0; }
            body { font-family: 'Courier New', Courier, monospace; width: 80mm; padding: 10px; margin: 0; color: #000; font-size: 16px; }
            h2, p { margin: 5px 0; text-align: center; }
            hr { border-top: 1px dashed #000; margin: 10px 0; }
            table { width: 100%; font-size: 15px; }
            th, td { padding: 4px 0; }
        </style></head><body>${htmlContent}
        <script>
            window.onload = () => { window.print(); };
            window.onafterprint = () => { window.close(); };
        </script>
        </body></html>
    `);
    printWindow.document.close();
}

window.imprimirPreCuenta = () => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa || !mesa.pedido_actual || mesa.pedido_actual.length === 0) return;

    let { vista, total } = obtenerVistaPedido(mesa.pedido_actual);

    let html = `
        <h2>CALLETANO</h2><p>Restaurante & Cevicheria</p>
        <p>Barrio Nicaragua S/N, Máncora</p>
        <hr><h3>PRE-CUENTA</h3><h2>MESA ${mesa.numero}</h2>
        <p>${new Date().toLocaleString()}</p><hr>
        <table><tr><th style="text-align:left;">Cant</th><th style="text-align:left;">Desc</th><th style="text-align:right;">Monto</th></tr>`;
    
    vista.forEach(item => {
        let modInfo = '';
        if (item.modalidad === 'llevar') modInfo = '<br><small><i>(Llevar)</i></small>';
        if (item.modalidad === 'delivery') modInfo = '<br><small><i>(Delivery)</i></small>';
        if (item.modalidad === 'mixto') modInfo = '<br><small><i>(Taper)</i></small>';
        
        let txtNota = item.nota ? `<br><small style="color: #555;"><i>* ${item.nota}</i></small>` : '';

        html += `<tr><td style="vertical-align:top; text-align:center;">${item.cantidad}</td><td>${item.nombre}${modInfo}${txtNota}</td><td style="text-align:right;">S/${item.subtotal.toFixed(2)}</td></tr>`;
    });

    html += `</table><hr><h2 style="text-align: right;">TOTAL: S/ ${total.toFixed(2)}</h2><hr>
             <p style="text-align: center;">Por favor, verifique su pedido.<br>Este documento no es un comprobante de pago.</p>`;
    
    enviarAImpresora(html, 'Ticket_Pre_Cuenta');
};

window.imprimirComandasSeparadas = async () => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa || !mesa.pedido_actual || mesa.pedido_actual.length === 0) return;

    const itemsPendientes = mesa.pedido_actual.filter(item => item.estado_envio !== 'enviado');
    if (itemsPendientes.length === 0) return;

    const catBebidas = ['Jugos naturales', 'Bebidas heladas', 'Bebidas calientes', 'Cerveza'];
    const itemsCocina = itemsPendientes.filter(item => !catBebidas.includes(item.categoria) && item.nombre !== 'Refresco');
    const itemsBarra = itemsPendientes.filter(item => catBebidas.includes(item.categoria) || item.nombre === 'Refresco');

    let htmlCocina = ""; let htmlBarra = "";

    if (itemsCocina.length > 0) {
        htmlCocina = `<h2>** COCINA **</h2><h2>MESA ${mesa.numero}</h2><p>${new Date().toLocaleString()}</p><hr>`;
        itemsCocina.forEach(item => {
            let modLabel = item.modalidad === 'llevar' ? ' <b>[LLEVAR]</b>' : (item.modalidad === 'delivery' ? ' <b>[DELIVERY]</b>' : '');
            htmlCocina += `<div style="margin-top: 8px; font-weight: bold; font-size: 18px;">${item.cantidad}x ${item.nombre}${modLabel}</div>`;
            if (item.nota) htmlCocina += `<div style="font-size: 15px; font-style: italic; font-weight: bold; margin-bottom: 5px;">* NOTA: ${item.nota}</div>`;
        });
        htmlCocina += `<hr><p>---</p>`;
    }
    
    if (itemsBarra.length > 0) {
        htmlBarra = `<h2>** BARRA **</h2><h2>MESA ${mesa.numero}</h2><p>${new Date().toLocaleString()}</p><hr>`;
        itemsBarra.forEach(item => {
            let modLabel = item.modalidad === 'llevar' ? ' <b>[LLEVAR]</b>' : (item.modalidad === 'delivery' ? ' <b>[DELIVERY]</b>' : '');
            htmlBarra += `<div style="margin-top: 8px; font-weight: bold; font-size: 18px;">${item.cantidad}x ${item.nombre}${modLabel}</div>`;
            if (item.nota) htmlBarra += `<div style="font-size: 15px; font-style: italic; font-weight: bold; margin-bottom: 5px;">* NOTA: ${item.nota}</div>`;
        });
        htmlBarra += `<hr><p>---</p>`;
    }

    if (itemsCocina.length > 0) enviarAImpresora(htmlCocina, 'Ticket_Cocina');
    if (itemsBarra.length > 0) enviarAImpresora(htmlBarra, 'Ticket_Barra');

    let nuevoPedido = mesa.pedido_actual.map(item => ({ ...item, estado_envio: 'enviado' }));
    try { await updateDoc(doc(db, "mesas_pos", mesa.id), { pedido_actual: nuevoPedido }); } catch (e) { console.error(e); }
};

window.imprimirNotaVentaHTML = (mesaNum, itemsVista, total, metodos) => {
    let html = `
        <h2>CALLETANO</h2><p>Restaurante & Cevicheria</p>
        <p>Barrio Nicaragua S/N, Máncora</p>
        <hr><h3>NOTA DE VENTA</h3><h2>MESA ${mesaNum}</h2>
        <p>${new Date().toLocaleString()}</p><hr>
        <table><tr><th style="text-align:left;">Cant</th><th style="text-align:left;">Desc</th><th style="text-align:right;">Monto</th></tr>`;
    
    itemsVista.forEach(item => {
        let modInfo = '';
        if (item.modalidad === 'llevar') modInfo = '<br><small><i>(Llevar)</i></small>';
        if (item.modalidad === 'delivery') modInfo = '<br><small><i>(Delivery)</i></small>';
        if (item.modalidad === 'mixto') modInfo = '<br><small><i>(Taper)</i></small>';
        
        let txtNota = item.nota ? `<br><small style="color: #555;"><i>* ${item.nota}</i></small>` : '';

        html += `<tr><td style="vertical-align:top; text-align:center;">${item.cantidad}</td><td>${item.nombre}${modInfo}${txtNota}</td><td style="text-align:right;">S/${item.subtotal.toFixed(2)}</td></tr>`;
    });

    html += `</table><hr><h2 style="text-align: right;">TOTAL: S/ ${total.toFixed(2)}</h2><hr><div style="text-align: left;">`;
    if (metodos.efectivo > 0) html += `<p>Efectivo: S/ ${metodos.efectivo.toFixed(2)}</p>`;
    if (metodos.yape > 0) html += `<p>Yape: S/ ${metodos.yape.toFixed(2)}</p>`;
    if (metodos.plin > 0) html += `<p>Plin: S/ ${metodos.plin.toFixed(2)}</p>`;
    if (metodos.tarjeta > 0) html += `<p>Tarjeta: S/ ${metodos.tarjeta.toFixed(2)}</p>`;
    html += `</div><hr><p>¡Gracias por su preferencia!</p>
             <p style="font-size: 10px;">* Documento interno. No es comprobante de pago válido para SUNAT *</p>`;
    
    enviarAImpresora(html, 'Ticket_Nota_Venta');
};