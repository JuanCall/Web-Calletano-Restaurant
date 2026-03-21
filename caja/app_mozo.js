import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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

let mesaSeleccionadaId = null;
let mesasData = []; 

const contenedorMesas = document.getElementById('contenedor-mesas');
const tituloMesa = document.getElementById('titulo-mesa');
const estadoMesa = document.getElementById('estado-mesa');
const btnAgregarProducto = document.getElementById('btn-agregar-producto');
const listaPedidos = document.getElementById('lista-pedidos');
const zonaEnvio = document.getElementById('zona-envio');
const totalCuenta = document.getElementById('total-cuenta');

const btnRefresco = document.getElementById('btn-refresco');
const btnHumita = document.getElementById('btn-humita');
const colRefresco = document.getElementById('col-refresco');
const colHumita = document.getElementById('col-humita');

let modalProductosInstance = null; 

// --- MOTOR MATEMÁTICO ---
function calcularRecargoTaper(modalidad, categoria, nombre) {
    if (modalidad === 'delivery') return 3;
    if (modalidad !== 'llevar') return 0;   
    const cats1Sol = ['Guarniciones', 'Jugos naturales', 'Bebidas heladas', 'Bebidas calientes', 'Cerveza', 'entrada'];
    if (cats1Sol.includes(categoria) || nombre.includes('(Entrada)') || nombre.includes('Humita')) return 1;
    return 2; 
}

function calcularTotalMesa(pedido) {
    let total = 0; let combos = 0; let descuento = 0;
    let no_domingo = new Date().getDay() !== 0;
    let expE = []; let expS = []; let otros = [];

    pedido.forEach(item => {
        if (no_domingo && item.categoria === 'entrada') { for(let i=0; i<item.cantidad; i++) expE.push({...item, cantidad: 1}); } 
        else if (no_domingo && item.categoria === 'segundo') { for(let i=0; i<item.cantidad; i++) expS.push({...item, cantidad: 1}); } 
        else { for(let i=0; i<item.cantidad; i++) otros.push({...item, cantidad: 1}); }
    });

    while (expE.length > 0 && expS.length > 0) {
        combos++; let E = expE.shift(); let S = expS.shift();
        let recargo = 0;
        if (E.modalidad === 'delivery' || S.modalidad === 'delivery') recargo = 3;
        else if (E.modalidad === 'llevar' && S.modalidad === 'llevar') recargo = 2;
        else if (S.modalidad === 'llevar') recargo = 2;
        else if (E.modalidad === 'llevar') recargo = 1;

        total += (15 + recargo);
        let origE = E.precio + (E.modalidad === 'delivery' ? 3 : (E.modalidad === 'llevar' ? 1 : 0));
        let origS = S.precio + (S.modalidad === 'delivery' ? 3 : (S.modalidad === 'llevar' ? 2 : 0));
        descuento += (origE + origS) - (15 + recargo);
    }

    [...expE, ...expS, ...otros].forEach(item => {
        let recargo = calcularRecargoTaper(item.modalidad, item.categoria, item.nombre);
        total += (item.precio + recargo);
    });

    return { total, combos, descuento };
}

function iniciarSistemaMozos() {
    const esDomingo = new Date().getDay() === 0;
    const precioRefresco = esDomingo ? 3.00 : 2.00;
    
    if (btnRefresco) {
        btnRefresco.innerHTML = `<i class="fas fa-glass-whiskey"></i> Refresco S/ ${precioRefresco.toFixed(2)}`;
        btnRefresco.setAttribute('onclick', `agregarAlPedido('Refresco', ${precioRefresco}, 'bebida')`);
    }

    if (esDomingo && colHumita && colRefresco) {
        colHumita.style.display = 'block'; colRefresco.className = 'col-6';
        if (btnHumita) btnHumita.setAttribute('onclick', `agregarAlPedido('Humita', 3, 'entrada')`);
    } else if (colRefresco) { colRefresco.className = 'col-12'; }

    onSnapshot(collection(db, "mesas_pos"), (snapshot) => {
        mesasData = [];
        snapshot.forEach((doc) => { mesasData.push({ id: doc.id, ...doc.data() }); });
        mesasData.sort((a, b) => a.numero - b.numero);
        dibujarMesas(); actualizarComandera(); 
    });
    cargarCartaDesdeWeb();
}

function dibujarMesas() {
    contenedorMesas.innerHTML = ""; 
    mesasData.forEach(mesa => {
        const esOcupada = mesa.estado === "ocupada";
        const claseEstado = esOcupada ? "mesa-ocupada" : "mesa-libre";
        const esSeleccionada = mesa.id === mesaSeleccionadaId ? "mesa-seleccionada" : "";
        const div = document.createElement('div'); div.className = "col-md-6 col-lg-4 mb-3"; 
        
        div.innerHTML = `
            <div class="card mesa-card shadow-sm ${claseEstado} ${esSeleccionada} d-flex flex-column p-3" onclick="seleccionarMesa('${mesa.id}')" style="height: 140px; cursor: pointer;">
                <h3 class="fw-bold mb-1">Mesa ${mesa.numero}</h3>
                <div><span class="badge bg-white text-dark mb-2 border shadow-sm">${esOcupada ? 'Ocupada' : 'Libre'}</span></div>
                <div class="mt-auto border-top pt-2 d-flex justify-content-between align-items-center w-100">
                    <strong class="text-secondary small">${mesa.pedido_actual ? mesa.pedido_actual.length : 0} items</strong>
                    <strong class="text-primary fw-bold">S/ ${(mesa.total_consumo || 0).toFixed(2)}</strong>
                </div>
            </div>`;
        contenedorMesas.appendChild(div);
    });
}

window.seleccionarMesa = (id) => { mesaSeleccionadaId = id; dibujarMesas(); actualizarComandera(); };

function actualizarComandera() {
    if (!mesaSeleccionadaId) return; 
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa) return;

    tituloMesa.innerText = `Mesa ${mesa.numero}`;
    btnAgregarProducto.disabled = false;
    if (btnRefresco) btnRefresco.disabled = false;
    if (btnHumita) btnHumita.disabled = false;
    
    const btnEnviar = zonaEnvio.querySelector('button');

    if (mesa.estado === "libre" || !mesa.pedido_actual || mesa.pedido_actual.length === 0) {
        estadoMesa.className = "badge bg-success mt-2"; estadoMesa.innerText = "Libre";
        listaPedidos.innerHTML = `<div class="text-center text-muted mt-5"><p>Agregue platos para abrir la mesa.</p></div>`;
        zonaEnvio.style.display = 'none';
    } else {
        estadoMesa.className = "badge bg-danger mt-2"; estadoMesa.innerText = "Ocupada";
        zonaEnvio.style.display = 'block';
        
        let itemsHTML = ""; let itemsPendientes = 0;
        
        mesa.pedido_actual.forEach((item, index) => {
            if (item.estado_envio === 'enviado') return;
            itemsPendientes++;

            const modalidad = item.modalidad || 'local';
            const costoTaper = calcularRecargoTaper(modalidad, item.categoria, item.nombre);
            
            let badgeMod = modalidad === 'llevar' ? `<span class="badge bg-warning text-dark ms-1" style="font-size:0.65rem;">+S/${costoTaper} Llevar</span>` : '';
            let btnColor = modalidad === 'llevar' ? 'btn-warning text-dark' : 'btn-outline-secondary';
            let iconMod = modalidad === 'llevar' ? 'fa-shopping-bag' : 'fa-store';
            let textoMod = modalidad === 'llevar' ? 'Llevar' : 'Local';

            if (modalidad === 'delivery') {
                badgeMod = `<span class="badge bg-info text-dark ms-1" style="font-size:0.65rem;">+S/${costoTaper} Delivery</span>`;
                btnColor = 'btn-info text-dark'; iconMod = 'fa-motorcycle'; textoMod = 'Delivery';
            }

            let txtNota = item.nota ? `<br><span class="text-danger fst-italic mt-1 d-block" style="font-size: 0.75rem;"><i class="fas fa-comment-dots"></i> ${item.nota}</span>` : '';

            itemsHTML += `
            <div class="d-flex flex-column border-bottom py-2">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <div style="width: 75%"><strong class="d-block text-dark small">${item.nombre}</strong>${badgeMod}${txtNota}</div>
                    <strong class="text-primary text-end" style="width: 25%">S/ ${item.subtotal.toFixed(2)}</strong>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-1">
                    <button class="btn btn-sm ${btnColor} px-2 py-0 fw-bold shadow-sm" onclick="cambiarModalidad(${index})" style="border-radius: 12px; font-size: 0.75rem;"><i class="fas ${iconMod}"></i> ${textoMod}</button>
                    <div class="d-flex align-items-center bg-light rounded shadow-sm border">
                        <button class="btn btn-sm text-info px-3 py-1 fw-bold border-0 fs-5 border-end" onclick="agregarNota(${index})" title="Agregar Nota al plato"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm text-secondary px-3 py-1 fw-bold border-0 fs-5" onclick="modificarCantidad(${index}, -1)">-</button>
                        <span class="mx-2 fw-bold fs-5">${item.cantidad}</span>
                        <button class="btn btn-sm text-primary px-3 py-1 fw-bold border-0 fs-5" onclick="modificarCantidad(${index}, 1)">+</button>
                        <div class="border-start ms-1 ps-1"><button class="btn btn-sm text-danger border-0 px-3 py-1 fs-5" onclick="eliminarDelPedido(${index})"><i class="fas fa-trash-alt"></i></button></div>
                    </div>
                </div>
            </div>`;
        });
        
        let calc = calcularTotalMesa(mesa.pedido_actual);
        totalCuenta.innerText = `S/ ${calc.total.toFixed(2)}`;

        if(calc.combos > 0 && itemsPendientes > 0) {
            itemsHTML += `
            <div class="d-flex justify-content-between align-items-center bg-success bg-opacity-10 text-success p-2 mt-2 rounded border border-success border-opacity-25 shadow-sm">
                <strong><i class="fas fa-gift me-1"></i> Promo: ${calc.combos} Menú(s) Armado(s)</strong>
                <strong class="text-success fw-bold">-S/ ${calc.descuento.toFixed(2)}</strong>
            </div>`;
        }

        if (itemsPendientes === 0) {
            listaPedidos.innerHTML = `<div class="text-center text-success mt-5"><i class="fas fa-check-circle fa-3x mb-3 opacity-50"></i><p class="fw-bold">Pedidos enviados a cocina.</p><p class="text-muted small">Puede agregar más platos a la mesa.</p></div>`;
            if (btnEnviar) btnEnviar.style.display = 'none';
        } else {
            listaPedidos.innerHTML = itemsHTML;
            if (btnEnviar) btnEnviar.style.display = 'block';
        }
    }
}

// FUNCIÓN PARA AGREGAR NOTAS
window.agregarNota = async (index) => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa) return;
    let nuevoPedido = [...mesa.pedido_actual];
    
    let notaActual = nuevoPedido[index].nota || "";
    let nuevaNota = prompt(`Comentario para: ${nuevoPedido[index].nombre}\n(Ej: sin aji, tapers separados, poca sal)`, notaActual);
    
    if (nuevaNota !== null) {
        nuevoPedido[index].nota = nuevaNota.trim();
        try { await updateDoc(doc(db, "mesas_pos", mesa.id), { pedido_actual: nuevoPedido }); } catch (e) { console.error(e); }
    }
};

window.modificarCantidad = async (index, cambio) => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa) return; let nuevoPedido = [...mesa.pedido_actual];
    nuevoPedido[index].cantidad += cambio;
    if (nuevoPedido[index].cantidad <= 0) nuevoPedido.splice(index, 1);
    else {
        const recargo = calcularRecargoTaper(nuevoPedido[index].modalidad, nuevoPedido[index].categoria, nuevoPedido[index].nombre);
        nuevoPedido[index].subtotal = nuevoPedido[index].cantidad * (nuevoPedido[index].precio + recargo);
    }
    let calc = calcularTotalMesa(nuevoPedido);
    try { await updateDoc(doc(db, "mesas_pos", mesa.id), { estado: nuevoPedido.length === 0 ? "libre" : "ocupada", pedido_actual: nuevoPedido, total_consumo: calc.total }); } catch (e) { console.error(e); }
};

window.cambiarModalidad = async (index) => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa) return; let nuevoPedido = [...mesa.pedido_actual];
    let modActual = nuevoPedido[index].modalidad || 'local';
    
    if (modActual === 'local') nuevoPedido[index].modalidad = 'llevar';
    else if (modActual === 'llevar') nuevoPedido[index].modalidad = 'delivery';
    else nuevoPedido[index].modalidad = 'local';

    const recargo = calcularRecargoTaper(nuevoPedido[index].modalidad, nuevoPedido[index].categoria, nuevoPedido[index].nombre);
    nuevoPedido[index].subtotal = nuevoPedido[index].cantidad * (nuevoPedido[index].precio + recargo);

    let idxExistente = nuevoPedido.findIndex((i, pos) => i.nombre === nuevoPedido[index].nombre && (i.modalidad || 'local') === nuevoPedido[index].modalidad && i.estado_envio !== 'enviado' && (i.nota||'') === (nuevoPedido[index].nota||'') && pos !== index);
    if (idxExistente > -1) {
        nuevoPedido[idxExistente].cantidad += nuevoPedido[index].cantidad;
        nuevoPedido[idxExistente].subtotal += nuevoPedido[index].subtotal;
        nuevoPedido.splice(index, 1);
    }
    
    let calc = calcularTotalMesa(nuevoPedido);
    try { await updateDoc(doc(db, "mesas_pos", mesa.id), { pedido_actual: nuevoPedido, total_consumo: calc.total }); } catch (e) {}
};

async function cargarCartaDesdeWeb() {
    try {
        const snapCarta = await getDoc(doc(db, "contenido", "cartaCompleta"));
        const snapMenu = await getDoc(doc(db, "contenido", "menuDiario"));
        const esDomingo = new Date().getDay() === 0;

        let navHTML = `<div class="d-flex overflow-auto pb-2 mb-3 sticky-top bg-light shadow-sm" style="z-index: 1020; gap: 0.5rem; top: -16px; margin-left: -16px; margin-right: -16px; padding: 16px 16px 10px 16px;">`;
        let bodyHTML = `<button class="btn btn-outline-danger w-100 mb-4 fw-bold shadow-sm py-3" onclick="agregarPlatoPersonalizado()"><i class="fas fa-keyboard"></i> Plato fuera de carta</button>`;

        if(snapMenu.exists()) {
            const d = snapMenu.data();
            navHTML += `<button type="button" class="btn btn-dark rounded-pill fw-bold px-4 flex-shrink-0 shadow-sm" onclick="document.getElementById('seccion-menu').scrollIntoView({behavior: 'smooth', block: 'start'})">${esDomingo ? "Almuerzo" : "Menú del Día"}</button>`;
            bodyHTML += `<div id="seccion-menu" style="scroll-margin-top: 80px;">`;

            if (esDomingo) {
                bodyHTML += `<h5 class="fw-bold text-warning border-bottom">Almuerzo Dominical (S/ 30)</h5>`;
                if (d.segundos) d.segundos.forEach(s => bodyHTML += `<button class="btn btn-warning w-100 mb-2 fw-bold text-start shadow-sm py-2" onclick="agregarAlPedido('Almuerzo: ${s.nombre}', 30, 'segundo')"><i class="fas fa-star"></i> ${s.nombre}</button>`);
                bodyHTML += `<button class="btn btn-outline-warning w-100 mb-3 fw-bold text-start shadow-sm py-2" onclick="agregarAlPedido('Humita', 3, 'entrada')"><i class="fas fa-plus-circle"></i> Humita (S/ 3.00)</button>`;
            } else {
                if (d.entradas && d.entradas.length > 0) {
                    const precios = d.entradas.map(e => e.precio); const todosIguales = precios.every(p => p === precios[0]);
                    bodyHTML += `<h5 class="fw-bold text-warning border-bottom">Opciones de Entrada ${todosIguales ? `(S/ ${precios[0]})` : ''}</h5>`;
                    d.entradas.forEach(e => bodyHTML += `<button class="btn btn-warning w-100 mb-2 fw-bold text-start shadow-sm py-2" onclick="agregarAlPedido('${e.nombre} (Entrada)', ${e.precio}, 'entrada')">${e.nombre} ${!todosIguales ? `(S/ ${e.precio})` : ''}</button>`);
                }
                bodyHTML += `<h5 class="fw-bold text-danger border-bottom mt-3">Segundos (S/ 15)</h5>`;
                if (d.segundos) d.segundos.forEach(s => bodyHTML += `<button class="btn btn-danger w-100 mb-4 fw-bold text-start shadow-sm py-2" onclick="agregarAlPedido('${s.nombre} (Segundo)', 15, 'segundo')">${s.nombre}</button>`);
            }
            bodyHTML += `</div>`; 
        }

        if(snapCarta.exists() && snapCarta.data().categorias) {
            snapCarta.data().categorias.forEach((cat, index) => {
                const catId = `seccion-carta-${index}`;
                navHTML += `<button type="button" class="btn btn-outline-primary rounded-pill fw-bold px-4 flex-shrink-0 shadow-sm" onclick="document.getElementById('${catId}').scrollIntoView({behavior: 'smooth', block: 'start'})">${cat.nombre}</button>`;
                bodyHTML += `<div id="${catId}" style="scroll-margin-top: 80px;"><h6 class="mt-2 fw-bold text-primary border-bottom fs-5">${cat.nombre}</h6><div class="row g-2 mb-4">`;
                
                cat.items.forEach(item => {
                    const p1 = parseFloat(String(item.precio).replace(/[^0-9.]/g, '')) || 0;
                    if (item.precio2 && item.precio2 !== "-") {
                        const p2 = parseFloat(String(item.precio2).replace(/[^0-9.]/g, '')) || 0;
                        // Aquí aplicamos fw-bold y text-dark para los nombres de los platos a la carta
                        bodyHTML += `<div class="col-6"><button class="btn btn-outline-secondary w-100 text-start shadow-sm h-100 py-2" onclick="agregarAlPedido('${item.nombre} (${cat.col1})', ${p1}, '${cat.nombre}')"><span class="d-block lh-sm mb-1 fw-bold text-dark">${item.nombre} <b class="text-primary">(${cat.col1})</b></span><strong class="fs-6">S/ ${p1.toFixed(2)}</strong></button></div>
                                     <div class="col-6"><button class="btn btn-outline-secondary w-100 text-start shadow-sm h-100 py-2" onclick="agregarAlPedido('${item.nombre} (${cat.col2})', ${p2}, '${cat.nombre}')"><span class="d-block lh-sm mb-1 fw-bold text-dark">${item.nombre} <b class="text-success">(${cat.col2})</b></span><strong class="fs-6">S/ ${p2.toFixed(2)}</strong></button></div>`;
                    } else {
                        // Lo mismo para los platos de un solo precio
                        bodyHTML += `<div class="col-6"><button class="btn btn-outline-secondary w-100 text-start shadow-sm h-100 py-2" onclick="agregarAlPedido('${item.nombre}', ${p1}, '${cat.nombre}')"><span class="d-block lh-sm mb-1 fw-bold text-dark">${item.nombre}</span><strong class="fs-6">S/ ${p1.toFixed(2)}</strong></button></div>`;
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
    
    let idx = nuevoPedido.findIndex(i => i.nombre === nombre && (i.modalidad || 'local') === 'local' && i.estado_envio !== 'enviado' && !i.nota);
    
    if (idx > -1) { 
        nuevoPedido[idx].cantidad += 1; 
        nuevoPedido[idx].subtotal = nuevoPedido[idx].cantidad * nuevoPedido[idx].precio; 
    } else { 
        nuevoPedido.push({ nombre: nombre, precio: parseFloat(precio), cantidad: 1, modalidad: 'local', categoria: categoria, subtotal: parseFloat(precio), estado_envio: 'pendiente' }); 
    }
    
    let calc = calcularTotalMesa(nuevoPedido);
    try {
        await updateDoc(doc(db, "mesas_pos", mesa.id), { estado: "ocupada", pedido_actual: nuevoPedido, total_consumo: calc.total });
        
        // FEEDBACK VISUAL: Mensaje flotante verde sin cerrar el modal
        const toast = document.createElement('div');
        toast.className = 'position-fixed top-0 start-50 translate-middle-x p-3 mt-5';
        toast.style.zIndex = '9999';
        toast.innerHTML = `<div class="badge bg-success fs-6 shadow px-4 py-2 rounded-pill"><i class="fas fa-check-circle me-1"></i> ${nombre} agregado</div>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 1000); // Desaparece en 1 segundo

    } catch (e) { console.error(e); }
};

window.eliminarDelPedido = async (index) => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa || !confirm("¿Eliminar plato?")) return; let nuevoPedido = [...mesa.pedido_actual];
    nuevoPedido.splice(index, 1); let calc = calcularTotalMesa(nuevoPedido);
    await updateDoc(doc(db, "mesas_pos", mesa.id), { estado: nuevoPedido.length === 0 ? "libre" : "ocupada", pedido_actual: nuevoPedido, total_consumo: calc.total });
};

// =========================================================
// SISTEMA DE IMPRESIÓN EN CASCADA (Evita bloqueos del navegador)
// =========================================================
function enviarAImpresora(htmlContent, callback) {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    
    // Si el navegador bloquea la ventana, le avisamos al mozo/cajera
    if (!printWindow) {
        alert("⚠️ EL NAVEGADOR BLOQUEÓ EL TICKET.\n\nPor favor, ve a la barra de direcciones de Chrome arriba a la derecha, haz clic en el ícono de ventana con una 'X' roja y selecciona 'Permitir siempre ventanas emergentes'.");
        return;
    }

    printWindow.document.write(`
        <html><head><title>Comanda</title>
        <style>
            @page { margin: 0; }
            body { font-family: 'Courier New', Courier, monospace; width: 80mm; padding: 10px; margin: 0; color: #000; font-size: 16px; }
            h2, p { margin: 5px 0; text-align: center; }
            hr { border-top: 1px dashed #000; margin: 10px 0; }
        </style></head><body>${htmlContent}
        <script>
            window.onload = () => { window.print(); };
            window.onafterprint = () => { window.close(); };
        </script>
        </body></html>
    `);
    printWindow.document.close();

    // Si hay un segundo ticket (bebidas), ESPERAMOS a que se cierre el primero
    if (callback) {
        let checkClose = setInterval(() => {
            if (printWindow.closed) {
                clearInterval(checkClose);
                setTimeout(callback, 500); // Medio segundo después lanza el ticket de bebidas
            }
        }, 500);
    }
}

window.imprimirComandasSeparadas = async () => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa || !mesa.pedido_actual || mesa.pedido_actual.length === 0) return;

    const itemsPendientes = mesa.pedido_actual.filter(item => item.estado_envio !== 'enviado');
    if (itemsPendientes.length === 0) return;

    const catBebidas = ['Jugos naturales', 'Bebidas heladas', 'Bebidas calientes', 'Cerveza'];
    const itemsCocina = itemsPendientes.filter(item => !catBebidas.includes(item.categoria) && item.nombre !== 'Refresco');
    const itemsBarra = itemsPendientes.filter(item => catBebidas.includes(item.categoria) || item.nombre === 'Refresco');

    let htmlCocina = ""; let htmlBarra = "";

    // 1. Armamos el ticket de Cocina
    if (itemsCocina.length > 0) {
        htmlCocina = `<h2>** COCINA **</h2><h2>MESA ${mesa.numero}</h2><p>${new Date().toLocaleString()}</p><hr>`;
        itemsCocina.forEach(item => {
            let modLabel = item.modalidad === 'llevar' ? ' <b>[LLEVAR]</b>' : (item.modalidad === 'delivery' ? ' <b>[DELIVERY]</b>' : '');
            htmlCocina += `<div style="margin-top: 8px; font-weight: bold; font-size: 18px;">${item.cantidad}x ${item.nombre}${modLabel}</div>`;
            if (item.nota) htmlCocina += `<div style="font-size: 15px; font-style: italic; font-weight: bold; margin-bottom: 5px;">* NOTA: ${item.nota}</div>`;
        });
        htmlCocina += `<hr><p>---</p>`;
    }
    
    // 2. Armamos el ticket de Barra
    if (itemsBarra.length > 0) {
        htmlBarra = `<h2>** BARRA **</h2><h2>MESA ${mesa.numero}</h2><p>${new Date().toLocaleString()}</p><hr>`;
        itemsBarra.forEach(item => {
            let modLabel = item.modalidad === 'llevar' ? ' <b>[LLEVAR]</b>' : (item.modalidad === 'delivery' ? ' <b>[DELIVERY]</b>' : '');
            htmlBarra += `<div style="margin-top: 8px; font-weight: bold; font-size: 18px;">${item.cantidad}x ${item.nombre}${modLabel}</div>`;
            if (item.nota) htmlBarra += `<div style="font-size: 15px; font-style: italic; font-weight: bold; margin-bottom: 5px;">* NOTA: ${item.nota}</div>`;
        });
        htmlBarra += `<hr><p>---</p>`;
    }

    // 3. ENVIAMOS EN CASCADA (El ticket 2 espera al ticket 1)
    if (itemsCocina.length > 0 && itemsBarra.length > 0) {
        enviarAImpresora(htmlCocina, () => {
            enviarAImpresora(htmlBarra);
        });
    } else if (itemsCocina.length > 0) {
        enviarAImpresora(htmlCocina);
    } else if (itemsBarra.length > 0) {
        enviarAImpresora(htmlBarra);
    }

    let nuevoPedido = mesa.pedido_actual.map(item => ({ ...item, estado_envio: 'enviado' }));
    try { await updateDoc(doc(db, "mesas_pos", mesa.id), { pedido_actual: nuevoPedido }); } catch (e) { console.error(e); }
};

const loginSection = document.getElementById('login-section'); const posSection = document.getElementById('pos-section');
onAuthStateChanged(auth, (user) => {
    if (user) { loginSection.classList.add('d-none'); posSection.classList.remove('d-none'); iniciarSistemaMozos(); } 
    else { loginSection.classList.remove('d-none'); posSection.classList.add('d-none'); mesasData = []; contenedorMesas.innerHTML = ""; }
});

document.getElementById('btn-login').addEventListener('click', () => {
    const email = document.getElementById('pos-email').value; const pass = document.getElementById('pos-pass').value;
    const btn = document.getElementById('btn-login'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
    signInWithEmailAndPassword(auth, email, pass).catch(error => { alert("Acceso denegado."); }).finally(() => { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar'; });
});
document.getElementById('btn-logout').addEventListener('click', () => { if(confirm("¿Cerrar sesión de mozo?")) signOut(auth); });