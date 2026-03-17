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

let modalProductosInstance = null; 

// --- MOTOR DE CÁLCULO (AUTO-COMBO MATEMÁTICO) ---
function calcularRecargoTaper(modalidad, categoria, nombre) {
    if (modalidad === 'delivery') return 3;
    if (modalidad !== 'llevar') return 0;   
    const cats1Sol = ['Guarnición', 'Jugo Natural', 'Bebida Helada', 'Bebida Caliente', 'Cerveza', 'entrada'];
    if (cats1Sol.includes(categoria) || nombre.includes('(Entrada)') || nombre.includes('Humita')) return 1;
    return 2; 
}

function obtenerVistaPedido(pedido_actual) {
    if (!pedido_actual) return { vista: [], total: 0 };
    if (new Date().getDay() === 0) {
        let total = pedido_actual.reduce((a,b)=>a+b.subtotal,0);
        return { vista: JSON.parse(JSON.stringify(pedido_actual)), total };
    }

    let original = JSON.parse(JSON.stringify(pedido_actual));
    let vista = [];

    let modalidades = ['local', 'llevar', 'delivery'];
    modalidades.forEach(mod => {
        let itemsMod = original.filter(i => (i.modalidad || 'local') === mod);
        let entradas = itemsMod.filter(i => i.categoria === 'entrada').sort((a,b) => b.precio - a.precio);
        let segundos = itemsMod.filter(i => i.categoria === 'segundo');
        let otros = itemsMod.filter(i => i.categoria !== 'entrada' && i.categoria !== 'segundo');

        let expE = []; entradas.forEach(e => { for(let i=0; i<e.cantidad; i++) expE.push({...e, cantidad:1}); });
        let expS = []; segundos.forEach(s => { for(let i=0; i<s.cantidad; i++) expS.push({...s, cantidad:1}); });

        let menusArmados = 0;
        while(expE.length > 0 && expS.length > 0) { expE.shift(); expS.shift(); menusArmados++; }

        let cantMenusReales = otros.filter(i => i.categoria === 'menu').reduce((a,b)=>a+b.cantidad, 0);
        otros = otros.filter(i => i.categoria !== 'menu'); 

        let totalMenus = cantMenusReales + menusArmados;
        if (totalMenus > 0) {
            let recargo = calcularRecargoTaper(mod, 'menu', 'Menú Completo');
            vista.push({ nombre: 'Menú Completo', cantidad: totalMenus, precio: 15, modalidad: mod, categoria: 'menu', subtotal: totalMenus * (15 + recargo) });
        }

        let sobrantes = [...expE, ...expS, ...otros];
        sobrantes.forEach(item => {
            let recargo = calcularRecargoTaper(mod, item.categoria, item.nombre);
            let idx = vista.findIndex(v => v.nombre === item.nombre && v.modalidad === mod);
            if (idx > -1) { vista[idx].cantidad++; vista[idx].subtotal += (item.precio + recargo); } 
            else { vista.push({...item, cantidad: 1, subtotal: (item.precio + recargo)}); }
        });
    });

    let total = vista.reduce((a,b) => a+b.subtotal, 0);
    return { vista, total };
}
// ------------------------------------------------

function iniciarSistemaMozos() {
    onSnapshot(collection(db, "mesas_pos"), (snapshot) => {
        mesasData = [];
        snapshot.forEach(doc => mesasData.push({ id: doc.id, ...doc.data() }));
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
        const div = document.createElement('div');
        div.className = "col-md-6 col-lg-4 mb-3"; 
        
        div.innerHTML = `
            <div class="card mesa-card shadow-sm ${claseEstado} ${esSeleccionada} d-flex flex-column p-3" onclick="seleccionarMesa('${mesa.id}')" style="height: 140px; cursor: pointer;">
                <h3 class="fw-bold mb-1">Mesa ${mesa.numero}</h3>
                <div><span class="badge bg-white text-dark mb-2 border shadow-sm">${esOcupada ? 'Ocupada' : 'Libre'}</span></div>
                <div class="mt-auto border-top pt-2 d-flex justify-content-between align-items-center w-100">
                    <strong class="text-secondary small">${mesa.pedido_actual ? mesa.pedido_actual.length : 0} items</strong>
                    <strong class="text-primary fw-bold">S/ ${(mesa.total_consumo || 0).toFixed(2)}</strong>
                </div>
            </div>
        `;
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
    const btnEnviar = zonaEnvio.querySelector('button');

    if (mesa.estado === "libre" || !mesa.pedido_actual || mesa.pedido_actual.length === 0) {
        estadoMesa.className = "badge bg-success mt-2"; estadoMesa.innerText = "Libre";
        listaPedidos.innerHTML = `<div class="text-center text-muted mt-5"><p>Agregue platos para abrir la mesa.</p></div>`;
        zonaEnvio.style.display = 'none';
    } else {
        estadoMesa.className = "badge bg-danger mt-2"; estadoMesa.innerText = "Ocupada";
        zonaEnvio.style.display = 'block';
        
        let itemsHTML = "";
        let itemsPendientes = 0;
        
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

            itemsHTML += `
            <div class="d-flex flex-column border-bottom py-2">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <div style="width: 75%"><strong class="d-block text-dark small">${item.nombre}</strong>${badgeMod}</div>
                    <strong class="text-primary text-end" style="width: 25%">S/ ${item.subtotal.toFixed(2)}</strong>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-1">
                    <button class="btn btn-sm ${btnColor} px-2 py-0 fw-bold shadow-sm" onclick="cambiarModalidad(${index})" style="border-radius: 12px; font-size: 0.75rem;"><i class="fas ${iconMod}"></i> ${textoMod}</button>
                    <div class="d-flex align-items-center bg-light rounded shadow-sm border">
                        <button class="btn btn-sm text-secondary px-3 py-1 fw-bold border-0 fs-5" onclick="modificarCantidad(${index}, -1)">-</button>
                        <span class="mx-2 fw-bold fs-5">${item.cantidad}</span>
                        <button class="btn btn-sm text-primary px-3 py-1 fw-bold border-0 fs-5" onclick="modificarCantidad(${index}, 1)">+</button>
                        <div class="border-start ms-1 ps-1"><button class="btn btn-sm text-danger border-0 px-3 py-1 fs-5" onclick="eliminarDelPedido(${index})"><i class="fas fa-trash-alt"></i></button></div>
                    </div>
                </div>
            </div>`;
        });
        
        let calculoVirtual = obtenerVistaPedido(mesa.pedido_actual);
        let totalCrudo = mesa.pedido_actual.reduce((a,b)=>a+b.subtotal,0);
        let descuentoArmado = totalCrudo - calculoVirtual.total;
        
        totalCuenta.innerText = `S/ ${calculoVirtual.total.toFixed(2)}`;

        if(descuentoArmado > 0 && itemsPendientes > 0) {
            itemsHTML += `
            <div class="d-flex justify-content-between align-items-center bg-success bg-opacity-10 text-success p-2 mt-2 rounded border border-success border-opacity-25 shadow-sm">
                <strong><i class="fas fa-gift me-1"></i> Descuento Menú Armado</strong>
                <strong class="text-success fw-bold">-S/ ${descuentoArmado.toFixed(2)}</strong>
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

window.modificarCantidad = async (index, cambio) => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa) return;
    let nuevoPedido = [...mesa.pedido_actual];
    nuevoPedido[index].cantidad += cambio;
    if (nuevoPedido[index].cantidad <= 0) nuevoPedido.splice(index, 1);
    else {
        const recargo = calcularRecargoTaper(nuevoPedido[index].modalidad, nuevoPedido[index].categoria, nuevoPedido[index].nombre);
        nuevoPedido[index].subtotal = nuevoPedido[index].cantidad * (nuevoPedido[index].precio + recargo);
    }
    
    let { total } = obtenerVistaPedido(nuevoPedido);
    try { await updateDoc(doc(db, "mesas_pos", mesa.id), { estado: nuevoPedido.length === 0 ? "libre" : "ocupada", pedido_actual: nuevoPedido, total_consumo: total }); } catch (e) { console.error(e); }
};

window.cambiarModalidad = async (index) => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa) return;
    let nuevoPedido = [...mesa.pedido_actual];
    let modActual = nuevoPedido[index].modalidad || 'local';
    
    if (modActual === 'local') nuevoPedido[index].modalidad = 'llevar';
    else if (modActual === 'llevar') nuevoPedido[index].modalidad = 'delivery';
    else nuevoPedido[index].modalidad = 'local';

    const recargo = calcularRecargoTaper(nuevoPedido[index].modalidad, nuevoPedido[index].categoria, nuevoPedido[index].nombre);
    nuevoPedido[index].subtotal = nuevoPedido[index].cantidad * (nuevoPedido[index].precio + recargo);

    let idxExistente = nuevoPedido.findIndex((i, pos) => i.nombre === nuevoPedido[index].nombre && (i.modalidad || 'local') === nuevoPedido[index].modalidad && i.estado_envio !== 'enviado' && pos !== index);
    if (idxExistente > -1) {
        nuevoPedido[idxExistente].cantidad += nuevoPedido[index].cantidad;
        nuevoPedido[idxExistente].subtotal += nuevoPedido[index].subtotal;
        nuevoPedido.splice(index, 1);
    }
    let { total } = obtenerVistaPedido(nuevoPedido);
    try { await updateDoc(doc(db, "mesas_pos", mesa.id), { pedido_actual: nuevoPedido, total_consumo: total }); } catch (e) { console.error(e); }
};

async function cargarCartaDesdeWeb() {
    try {
        const snapCarta = await getDoc(doc(db, "contenido", "cartaCompleta"));
        const snapMenu = await getDoc(doc(db, "contenido", "menuDiario"));
        const esDomingo = new Date().getDay() === 0;

        let navHTML = `<div class="d-flex overflow-auto pb-2 mb-3 sticky-top bg-light shadow-sm" style="z-index: 1020; gap: 0.5rem; top: -16px; margin-left: -16px; margin-right: -16px; padding: 16px 16px 10px 16px;">`;
        let bodyHTML = `<button class="btn btn-outline-danger w-100 mb-4 fw-bold shadow-sm py-3 fs-5" onclick="agregarPlatoPersonalizado()"><i class="fas fa-keyboard"></i> Plato fuera de carta</button>`;

        if(snapMenu.exists()) {
            const d = snapMenu.data();
            navHTML += `<button type="button" class="btn btn-dark rounded-pill fw-bold px-4 flex-shrink-0 shadow-sm" onclick="document.getElementById('seccion-menu').scrollIntoView({behavior: 'smooth', block: 'start'})">${esDomingo ? "Almuerzo" : "Menú del Día"}</button>`;
            bodyHTML += `<div id="seccion-menu" style="scroll-margin-top: 80px;">`;

            if (esDomingo) {
                bodyHTML += `<h5 class="fw-bold text-warning border-bottom">Almuerzo Dominical (S/ 30)</h5>`;
                if (d.segundos) d.segundos.forEach(s => bodyHTML += `<button class="btn btn-warning w-100 mb-2 fw-bold text-start shadow-sm py-3 fs-6" onclick="agregarAlPedido('Almuerzo: ${s.nombre}', 30, 'segundo')"><i class="fas fa-star"></i> ${s.nombre}</button>`);
                bodyHTML += `<button class="btn btn-outline-warning w-100 mb-3 fw-bold text-start shadow-sm py-3 fs-6" onclick="agregarAlPedido('Humita', 3, 'entrada')"><i class="fas fa-plus-circle"></i> Humita (S/ 3.00)</button>`;
            } else {
                if (d.entradas && d.entradas.length > 0) {
                    const precios = d.entradas.map(e => e.precio);
                    const todosIguales = precios.every(p => p === precios[0]);
                    bodyHTML += `<h5 class="fw-bold text-warning border-bottom">Opciones de Entrada ${todosIguales ? `(S/ ${precios[0]})` : ''}</h5>`;
                    d.entradas.forEach(e => bodyHTML += `<button class="btn btn-outline-warning w-100 mb-2 fw-bold text-start shadow-sm py-3 fs-6" onclick="agregarAlPedido('${e.nombre} (Entrada)', ${e.precio}, 'entrada')">${e.nombre} ${!todosIguales ? `(S/ ${e.precio})` : ''}</button>`);
                }
                bodyHTML += `<h5 class="fw-bold text-danger border-bottom mt-3">Segundos (S/ 15)</h5>`;
                if (d.segundos) d.segundos.forEach(s => bodyHTML += `<button class="btn btn-danger w-100 mb-4 fw-bold text-start shadow-sm py-3 fs-6" onclick="agregarAlPedido('${s.nombre} (Segundo)', 15, 'segundo')">${s.nombre}</button>`);
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
                        bodyHTML += `<div class="col-6"><button class="btn btn-outline-secondary w-100 text-start shadow-sm h-100 py-3" onclick="agregarAlPedido('${item.nombre} (${cat.col1})', ${p1}, '${cat.nombre}')"><span class="d-block lh-sm mb-1">${item.nombre} <b class="text-primary">(${cat.col1})</b></span><strong class="fs-6">S/ ${p1.toFixed(2)}</strong></button></div>
                                     <div class="col-6"><button class="btn btn-outline-secondary w-100 text-start shadow-sm h-100 py-3" onclick="agregarAlPedido('${item.nombre} (${cat.col2})', ${p2}, '${cat.nombre}')"><span class="d-block lh-sm mb-1">${item.nombre} <b class="text-success">(${cat.col2})</b></span><strong class="fs-6">S/ ${p2.toFixed(2)}</strong></button></div>`;
                    } else {
                        bodyHTML += `<div class="col-6"><button class="btn btn-outline-secondary w-100 text-start shadow-sm h-100 py-3" onclick="agregarAlPedido('${item.nombre}', ${p1}, '${cat.nombre}')"><span class="d-block lh-sm mb-1">${item.nombre}</span><strong class="fs-6">S/ ${p1.toFixed(2)}</strong></button></div>`;
                    }
                });
                bodyHTML += `</div></div>`; 
            });
        }
        navHTML += `</div>`; 
        document.getElementById('catalogo-productos').innerHTML = navHTML + bodyHTML;
    } catch (error) { console.error(error); }
}

btnAgregarProducto.addEventListener('click', () => {
    if (!modalProductosInstance) modalProductosInstance = new bootstrap.Modal(document.getElementById('modalProductos'));
    modalProductosInstance.show();
});

window.agregarPlatoPersonalizado = () => {
    const n = prompt("Nombre del plato:");
    const p = parseFloat(prompt("Precio (S/):"));
    if (n && !isNaN(p)) agregarAlPedido(n + " (Extra)", p, 'general');
};

window.agregarAlPedido = async (nombre, precio, categoria = 'general') => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa) return;
    let nuevoPedido = mesa.pedido_actual ? [...mesa.pedido_actual] : [];
    
    let idx = nuevoPedido.findIndex(i => i.nombre === nombre && (i.modalidad || 'local') === 'local' && i.estado_envio !== 'enviado');
    
    if (idx > -1) { 
        nuevoPedido[idx].cantidad += 1; 
        nuevoPedido[idx].subtotal = nuevoPedido[idx].cantidad * nuevoPedido[idx].precio; 
    } else { 
        nuevoPedido.push({ nombre: nombre, precio: parseFloat(precio), cantidad: 1, modalidad: 'local', categoria: categoria, subtotal: parseFloat(precio), estado_envio: 'pendiente' }); 
    }
    
    let { total } = obtenerVistaPedido(nuevoPedido);
    try {
        await updateDoc(doc(db, "mesas_pos", mesa.id), { estado: "ocupada", pedido_actual: nuevoPedido, total_consumo: total });
        if(modalProductosInstance) modalProductosInstance.hide();
    } catch (e) { console.error(e); }
};

window.eliminarDelPedido = async (index) => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa || !confirm("¿Eliminar plato?")) return;
    let nuevoPedido = [...mesa.pedido_actual];
    nuevoPedido.splice(index, 1);
    let { total } = obtenerVistaPedido(nuevoPedido);
    await updateDoc(doc(db, "mesas_pos", mesa.id), { estado: nuevoPedido.length === 0 ? "libre" : "ocupada", pedido_actual: nuevoPedido, total_consumo: total });
};

// IMPRESIÓN MOZO
function enviarAImpresora(htmlContent) {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    printWindow.document.write(`
        <html><head><title>Comanda</title>
        <style>
            @page { margin: 0; }
            body { font-family: 'Courier New', Courier, monospace; width: 80mm; padding: 10px; margin: 0; color: #000; font-size: 16px; }
            h2, p { margin: 5px 0; text-align: center; }
            hr { border-top: 1px dashed #000; margin: 10px 0; }
        </style></head><body>${htmlContent}
        <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
        </body></html>
    `);
    printWindow.document.close();
}

window.imprimirComandasSeparadas = async () => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa || !mesa.pedido_actual || mesa.pedido_actual.length === 0) return;

    const itemsPendientes = mesa.pedido_actual.filter(item => item.estado_envio !== 'enviado');
    if (itemsPendientes.length === 0) return;

    const catBebidas = ['Jugo Natural', 'Bebida Helada', 'Bebida Caliente', 'Cerveza'];
    const itemsCocina = itemsPendientes.filter(item => !catBebidas.includes(item.categoria) && item.nombre !== 'Refresco');
    const itemsBarra = itemsPendientes.filter(item => catBebidas.includes(item.categoria) || item.nombre === 'Refresco');

    if (itemsCocina.length > 0) {
        let htmlCocina = `<h2>** COCINA **</h2><h2>MESA ${mesa.numero}</h2><p>${new Date().toLocaleString()}</p><hr>`;
        itemsCocina.forEach(item => {
            let modLabel = item.modalidad === 'llevar' ? ' <b>[LLEVAR]</b>' : (item.modalidad === 'delivery' ? ' <b>[DELIVERY]</b>' : '');
            htmlCocina += `<div style="margin-bottom: 10px; font-weight: bold; font-size: 18px;">${item.cantidad}x ${item.nombre}${modLabel}</div>`;
        });
        htmlCocina += `<hr><p>---</p>`;
        enviarAImpresora(htmlCocina);
    }
    
    if (itemsBarra.length > 0) {
        setTimeout(() => {
            let htmlBarra = `<h2>** BARRA **</h2><h2>MESA ${mesa.numero}</h2><p>${new Date().toLocaleString()}</p><hr>`;
            itemsBarra.forEach(item => {
                let modLabel = item.modalidad === 'llevar' ? ' <b>[LLEVAR]</b>' : (item.modalidad === 'delivery' ? ' <b>[DELIVERY]</b>' : '');
                htmlBarra += `<div style="margin-bottom: 10px; font-weight: bold; font-size: 18px;">${item.cantidad}x ${item.nombre}${modLabel}</div>`;
            });
            htmlBarra += `<hr><p>---</p>`;
            enviarAImpresora(htmlBarra);
        }, itemsCocina.length > 0 ? 1500 : 0); 
    }

    let nuevoPedido = mesa.pedido_actual.map(item => ({ ...item, estado_envio: 'enviado' }));
    try { await updateDoc(doc(db, "mesas_pos", mesa.id), { pedido_actual: nuevoPedido }); } catch (e) { console.error(e); }
};

const loginSection = document.getElementById('login-section');
const posSection = document.getElementById('pos-section');

onAuthStateChanged(auth, (user) => {
    if (user) { loginSection.classList.add('d-none'); posSection.classList.remove('d-none'); iniciarSistemaMozos(); } 
    else { loginSection.classList.remove('d-none'); posSection.classList.add('d-none'); mesasData = []; contenedorMesas.innerHTML = ""; }
});

document.getElementById('btn-login').addEventListener('click', () => {
    const email = document.getElementById('pos-email').value;
    const pass = document.getElementById('pos-pass').value;
    const btn = document.getElementById('btn-login');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
    signInWithEmailAndPassword(auth, email, pass).catch(error => { alert("Acceso denegado."); }).finally(() => { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar'; });
});

document.getElementById('btn-logout').addEventListener('click', () => { if(confirm("¿Cerrar sesión de mozo?")) signOut(auth); });