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

let mesaSeleccionadaId = null;
let mesasData = []; 

const contenedorMesas = document.getElementById('contenedor-mesas');
const tituloMesa = document.getElementById('titulo-mesa');
const estadoMesa = document.getElementById('estado-mesa');
const btnAgregarProducto = document.getElementById('btn-agregar-producto');
const btnTaper1 = document.getElementById('btn-taper-1');
const btnTaper2 = document.getElementById('btn-taper-2');
const btnRefresco = document.getElementById('btn-refresco');
const btnCobrar = document.getElementById('btn-cobrar');
const totalCuenta = document.getElementById('total-cuenta');
const listaPedidos = document.getElementById('lista-pedidos');

let modalProductosInstance = null; 

// SISTEMA DE FILTRADO INTELIGENTE PARA RANKING---
let itemsProhibidosDeCarta = []; 

async function cargarItemsProhibidos() {
    try {
        const snapCarta = await getDoc(doc(db, "contenido", "cartaCompleta"));
        if (snapCarta.exists() && snapCarta.data().categorias) {
            // Estas son las categorías que NO queremos en el ranking
            const categoriasProhibidas = ['Guarniciones', 'Jugos naturales', 'Bebidas heladas', 'Bebidas calientes', 'Cerveza'];
            
            snapCarta.data().categorias.forEach(cat => {
                if (categoriasProhibidas.includes(cat.nombre)) {
                    cat.items.forEach(item => {
                        itemsProhibidosDeCarta.push(item.nombre); // Ejemplo: "Chicha Morada"
                        // Si tienen tamaños (Jarra/Vaso), también los agregamos a la lista negra
                        if (cat.col1) itemsProhibidosDeCarta.push(`${item.nombre} (${cat.col1})`);
                        if (cat.col2) itemsProhibidosDeCarta.push(`${item.nombre} (${cat.col2})`);
                    });
                }
            });
        }
    } catch (e) { console.error("Error al leer categorías prohibidas:", e); }
}

function esPlatoParaRanking(nombre) {
    // Palabras base que siempre se ignoran (Tapers, Extras y las Entradas genéricas)
    const terminosBase = ['Taper', 'Refresco', '(Extra)', 'Humita', 'Entrada', 'Segundo'];
    if (terminosBase.some(t => nombre.includes(t))) return false;
    
    // Filtro dinámico: Si el plato es una bebida o guarnición, lo ignora
    if (itemsProhibidosDeCarta.includes(nombre)) return false;

    return true; // Si pasa todos los filtros, sí va al ranking
}

// =========================================================
//  1. ESCUCHAR MESAS Y CONFIGURAR DÍA
// =========================================================
function iniciarSistemaPOS() {
    // Detectar Domingo para Refresco
    const esDomingo = new Date().getDay() === 0;
    const precioRefresco = esDomingo ? 3.00 : 2.00;
    
    btnRefresco.innerHTML = `<i class="fas fa-glass-whiskey"></i> S/ ${precioRefresco}`;
    btnRefresco.setAttribute('onclick', `agregarAlPedido('Refresco', ${precioRefresco})`);

    const mesasRef = collection(db, "mesas_pos");
    onSnapshot(mesasRef, (snapshot) => {
        mesasData = [];
        snapshot.forEach((doc) => {
            mesasData.push({ id: doc.id, ...doc.data() });
        });
        mesasData.sort((a, b) => a.numero - b.numero);
        dibujarMesas();
        actualizarComandera(); 
    });
    cargarItemsProhibidos();
    cargarCartaDesdeWeb();
}

// =========================================================
//  2. DIBUJAR MESAS (3x4)
// =========================================================
function dibujarMesas() {
    contenedorMesas.innerHTML = ""; 
    mesasData.forEach(mesa => {
        const esOcupada = mesa.estado === "ocupada";
        const claseEstado = esOcupada ? "mesa-ocupada" : "mesa-libre";
        const esSeleccionada = mesa.id === mesaSeleccionadaId ? "mesa-seleccionada" : "";
        const div = document.createElement('div');
        div.className = "col-4 mb-3"; 
        div.innerHTML = `
            <div class="card mesa-card shadow-sm ${claseEstado} ${esSeleccionada}" onclick="seleccionarMesa('${mesa.id}')" style="height: 160px;">
                <h3 class="fw-bold mb-1">Mesa ${mesa.numero}</h3>
                <span class="badge bg-white text-dark mb-2">${esOcupada ? 'Ocupada' : 'Libre'}</span>
                <strong class="fs-5">S/ ${mesa.total_consumo.toFixed(2)}</strong>
            </div>
        `;
        contenedorMesas.appendChild(div);
    });
}

// =========================================================
//  3. LÓGICA DE LA COMANDERA (+ / -)
// =========================================================
window.seleccionarMesa = (id) => {
    mesaSeleccionadaId = id;
    dibujarMesas(); 
    actualizarComandera(); 
};

function actualizarComandera() {
    if (!mesaSeleccionadaId) return; 
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa) return;

    tituloMesa.innerText = `Mesa ${mesa.numero}`;
    btnAgregarProducto.disabled = false;
    btnTaper1.disabled = false;
    btnTaper2.disabled = false;
    btnRefresco.disabled = false;
    
    if (mesa.estado === "libre" || !mesa.pedido_actual || mesa.pedido_actual.length === 0) {
        estadoMesa.className = "badge bg-success mt-2";
        estadoMesa.innerText = "Libre";
        listaPedidos.innerHTML = `<div class="text-center text-muted mt-5"><p>Agregue platos para abrir la mesa.</p></div>`;
        totalCuenta.innerText = "S/ 0.00";
        btnCobrar.disabled = true;
    } else {
        estadoMesa.className = "badge bg-danger mt-2";
        estadoMesa.innerText = "Ocupada";
        
        let itemsHTML = "";
        mesa.pedido_actual.forEach((item, index) => {
            itemsHTML += `
            <div class="d-flex justify-content-between align-items-center border-bottom py-2">
                <div style="width: 55%">
                    <strong class="d-block text-dark small">${item.nombre}</strong>
                    <strong class="text-primary">S/ ${item.subtotal.toFixed(2)}</strong>
                </div>
                <div class="d-flex align-items-center justify-content-end" style="width: 45%">
                    <button class="btn btn-sm btn-outline-secondary px-2 py-0 fw-bold" onclick="modificarCantidad(${index}, -1)">-</button>
                    <span class="mx-2 fw-bold">${item.cantidad}</span>
                    <button class="btn btn-sm btn-outline-primary px-2 py-0 fw-bold" onclick="modificarCantidad(${index}, 1)">+</button>
                    <button class="btn btn-sm text-danger ms-2 border-0" onclick="eliminarDelPedido(${index})"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>`;
        });
        listaPedidos.innerHTML = itemsHTML;
        totalCuenta.innerText = `S/ ${mesa.total_consumo.toFixed(2)}`;
        btnCobrar.disabled = false; 
    }
}

// Función para sumar o restar cantidades directamente
window.modificarCantidad = async (index, cambio) => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa) return;

    let nuevoPedido = [...mesa.pedido_actual];
    nuevoPedido[index].cantidad += cambio;

    if (nuevoPedido[index].cantidad <= 0) {
        nuevoPedido.splice(index, 1); // Si llega a cero, borramos el plato
    } else {
        nuevoPedido[index].subtotal = nuevoPedido[index].cantidad * nuevoPedido[index].precio;
    }

    let nuevoTotal = nuevoPedido.reduce((acc, curr) => acc + curr.subtotal, 0);
    let nuevoEstado = nuevoPedido.length === 0 ? "libre" : "ocupada";

    try {
        await updateDoc(doc(db, "mesas_pos", mesa.id), {
            estado: nuevoEstado,
            pedido_actual: nuevoPedido,
            total_consumo: nuevoTotal
        });
    } catch (e) { console.error(e); }
};

// =========================================================
//  4. CATÁLOGO COMPLETO
// =========================================================
async function cargarCartaDesdeWeb() {
    try {
        const snapCarta = await getDoc(doc(db, "contenido", "cartaCompleta"));
        const snapMenu = await getDoc(doc(db, "contenido", "menuDiario"));
        const esDomingo = new Date().getDay() === 0;
        let html = "";

        html += `<button class="btn btn-outline-danger w-100 mb-3 fw-bold" onclick="agregarPlatoPersonalizado()"><i class="fas fa-keyboard"></i> Plato fuera de carta</button>`;

        // 1. LÓGICA DE MENÚ DIARIO / ALMUERZOS
        if(snapMenu.exists()) {
            const d = snapMenu.data();

            if (esDomingo) {
                html += `<h5 class="fw-bold text-warning border-bottom">Almuerzo Dominical (S/ 30)</h5>`;
                if (d.segundos && d.segundos.length > 0) {
                    d.segundos.forEach(s => {
                        html += `
                        <button class="btn btn-warning w-100 mb-2 fw-bold text-start" onclick="agregarAlPedido('Almuerzo: ${s.nombre}', 30)">
                            <i class="fas fa-star"></i> ${s.nombre}
                        </button>`;
                    });
                }
                html += `<button class="btn btn-outline-warning w-100 mb-3 fw-bold text-start" onclick="agregarAlPedido('Humita', 3)">
                            <i class="fas fa-plus-circle"></i> Humita (S/ 3.00)
                         </button>`;
            } else {
                html += `<h5 class="fw-bold text-warning border-bottom">Opciones de Entrada</h5>`;
                if (d.entradas && d.entradas.length > 0) {
                    const precios = d.entradas.map(e => e.precio);
                    const todosIguales = precios.every(p => p === precios[0]);

                    if (todosIguales) {
                        html += `<button class="btn btn-outline-warning w-100 mb-2 fw-bold" onclick="agregarAlPedido('Entrada', ${precios[0]})">
                                    Entrada (S/ ${precios[0]})
                                 </button>`;
                    } else {
                        d.entradas.forEach(e => {
                            html += `<button class="btn btn-outline-warning w-100 mb-2 fw-bold text-start" onclick="agregarAlPedido('${e.nombre} (Entrada)', ${e.precio})">
                                        ${e.nombre} (S/ ${e.precio})
                                     </button>`;
                        });
                    }
                }

                html += `<h5 class="fw-bold text-danger border-bottom mt-3">Segundos (S/ 15)</h5>`;
                if (d.segundos && d.segundos.length > 0) {
                    d.segundos.forEach(s => {
                        html += `<button class="btn btn-danger w-100 mb-2 fw-bold text-start" onclick="agregarAlPedido('${s.nombre} (Segundo)', 15)">
                                    ${s.nombre}
                                 </button>`;
                    });
                }
            }
        }

        // 2. LA CARTA COMPLETA (Platos de fondo, bebidas, etc)
        if(snapCarta.exists() && snapCarta.data().categorias) {
            snapCarta.data().categorias.forEach(cat => {
                html += `<h6 class="mt-4 fw-bold text-primary border-bottom">${cat.nombre}</h6><div class="row g-2">`;
                
                cat.items.forEach(item => {
                    const precio1 = parseFloat(String(item.precio).replace(/[^0-9.]/g, '')) || 0;
                    
                    if (item.precio2 && String(item.precio2).trim() !== "" && item.precio2 !== "-") {
                        const precio2 = parseFloat(String(item.precio2).replace(/[^0-9.]/g, '')) || 0;
                        html += `
                        <div class="col-6">
                            <button class="btn btn-outline-secondary w-100 text-start small" onclick="agregarAlPedido('${item.nombre} (${cat.col1})', ${precio1})">
                                <small>${item.nombre} <b class="text-primary">(${cat.col1})</b></small><br><strong>S/ ${precio1.toFixed(2)}</strong>
                            </button>
                        </div>
                        <div class="col-6">
                            <button class="btn btn-outline-secondary w-100 text-start small" onclick="agregarAlPedido('${item.nombre} (${cat.col2})', ${precio2})">
                                <small>${item.nombre} <b class="text-success">(${cat.col2})</b></small><br><strong>S/ ${precio2.toFixed(2)}</strong>
                            </button>
                        </div>`;
                    } else {
                        html += `
                        <div class="col-6">
                            <button class="btn btn-outline-secondary w-100 text-start small" onclick="agregarAlPedido('${item.nombre}', ${precio1})">
                                <small>${item.nombre}</small><br><strong>S/ ${precio1.toFixed(2)}</strong>
                            </button>
                        </div>`;
                    }
                });
                html += `</div>`;
            });
        }
        
        document.getElementById('catalogo-productos').innerHTML = html;
        
    } catch (error) { 
        console.error("Error cargando carta:", error); 
        document.getElementById('catalogo-productos').innerHTML = "<p class='text-danger text-center'>Error al cargar el menú.</p>";
    }
}

// Abrir el modal del catálogo al hacer clic en "Agregar Pedido"
btnAgregarProducto.addEventListener('click', () => {
    if (!modalProductosInstance) {
        modalProductosInstance = new bootstrap.Modal(document.getElementById('modalProductos'));
    }
    modalProductosInstance.show();
});

window.agregarPlatoPersonalizado = () => {
    const n = prompt("Nombre del plato:");
    const p = parseFloat(prompt("Precio (S/):"));
    if (n && !isNaN(p)) agregarAlPedido(n + " (Extra)", p);
};

window.agregarAlPedido = async (nombre, precio) => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa) return;
    let nuevoPedido = mesa.pedido_actual ? [...mesa.pedido_actual] : [];
    let idx = nuevoPedido.findIndex(i => i.nombre === nombre);
    if (idx > -1) {
        nuevoPedido[idx].cantidad += 1;
        nuevoPedido[idx].subtotal = nuevoPedido[idx].cantidad * nuevoPedido[idx].precio;
    } else {
        nuevoPedido.push({ nombre: nombre, precio: parseFloat(precio), cantidad: 1, subtotal: parseFloat(precio) });
    }
    let total = nuevoPedido.reduce((acc, curr) => acc + curr.subtotal, 0);
    try {
        await updateDoc(doc(db, "mesas_pos", mesa.id), { estado: "ocupada", pedido_actual: nuevoPedido, total_consumo: total });
        if(modalProductosInstance) modalProductosInstance.hide();
    } catch (e) { console.error(e); }
};

window.eliminarDelPedido = async (index) => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa || !confirm("¿Eliminar?")) return;
    let nuevoPedido = [...mesa.pedido_actual];
    nuevoPedido.splice(index, 1);
    let total = nuevoPedido.reduce((acc, curr) => acc + curr.subtotal, 0);
    let est = nuevoPedido.length === 0 ? "libre" : "ocupada";
    await updateDoc(doc(db, "mesas_pos", mesa.id), { estado: est, pedido_actual: nuevoPedido, total_consumo: total });
};

// =========================================================
//  5. EL PROCESO DE COBRO (Pagos Mixtos y Vuelto)
// =========================================================
let modalCobroInstance = null;
const modalCobrarTotal = document.getElementById('modal-cobrar-total');
const modalCobrarRestante = document.getElementById('modal-cobrar-restante');
const btnConfirmarCobro = document.getElementById('btn-confirmar-cobro');
const inputsPagos = document.querySelectorAll('.pago-input');
let totalACobrarActual = 0;

btnCobrar.addEventListener('click', () => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa) return;

    totalACobrarActual = mesa.total_consumo;

    modalCobrarTotal.innerText = `Total: S/ ${totalACobrarActual.toFixed(2)}`;
    
    inputsPagos.forEach(input => input.value = "");
    document.getElementById('pago-efectivo').value = totalACobrarActual.toFixed(2);
    
    calcularVuelto();

    if (!modalCobroInstance) modalCobroInstance = new bootstrap.Modal(document.getElementById('modalCobrar'));
    modalCobroInstance.show();
});

inputsPagos.forEach(input => {
    input.addEventListener('input', calcularVuelto);
});

function calcularVuelto() {
    let sumaRecibida = 0;
    inputsPagos.forEach(input => {
        sumaRecibida += parseFloat(input.value) || 0;
    });

    let diferencia = totalACobrarActual - sumaRecibida;

    if (diferencia > 0) {
        modalCobrarRestante.innerHTML = `<span class="text-danger">Falta: S/ ${diferencia.toFixed(2)}</span>`;
        btnConfirmarCobro.disabled = true; 
    } else if (Math.abs(diferencia) < 0.01) {
        modalCobrarRestante.innerHTML = `<span class="text-success"><i class="fas fa-check"></i> Monto Exacto</span>`;
        btnConfirmarCobro.disabled = false;
    } else {
        modalCobrarRestante.innerHTML = `<span class="text-warning"><i class="fas fa-exchange-alt"></i> Dar Vuelto: S/ ${Math.abs(diferencia).toFixed(2)}</span>`;
        btnConfirmarCobro.disabled = false;
    }
}

btnConfirmarCobro.addEventListener('click', async () => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa) return;

    btnConfirmarCobro.disabled = true;
    btnConfirmarCobro.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';

    try {
        await addDoc(collection(db, "ventas_historicas"), {
            mesa: mesa.numero,
            fecha: new Date(),
            items: mesa.pedido_actual,
            total_cobrado: totalACobrarActual,
            metodos_pago: {
                efectivo: parseFloat(document.getElementById('pago-efectivo').value) || 0,
                yape: parseFloat(document.getElementById('pago-yape').value) || 0,
                plin: parseFloat(document.getElementById('pago-plin').value) || 0,
                tarjeta: parseFloat(document.getElementById('pago-tarjeta').value) || 0
            }
        });

        await updateDoc(doc(db, "mesas_pos", mesa.id), {
            estado: "libre",
            pedido_actual: [],
            total_consumo: 0
        });

        modalCobroInstance.hide();
        
    } catch (error) {
        console.error("Error al registrar venta:", error);
        alert("Ocurrió un error al procesar el cobro.");
    } finally {
        btnConfirmarCobro.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar Pago';
        btnConfirmarCobro.disabled = false;
    }
});

// =========================================================
//  6. REGISTRO DE GASTOS, HISTORIAL Y ARQUEO FINAL
// =========================================================
let modalGastoInstance = null;
const btnNuevoGasto = document.getElementById('btn-nuevo-gasto');
const btnGuardarGasto = document.getElementById('btn-guardar-gasto');

// NUEVA FUNCIÓN: Cargar el historial de gastos del día
async function cargarGastosHoy() {
    const listaGastos = document.getElementById('lista-gastos-hoy');
    if (!listaGastos) return;

    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0); // Desde las 00:00 de hoy

    const q = query(collection(db, "gastos"), where("fecha", ">=", inicioDia));
    try {
        const snap = await getDocs(q);
        listaGastos.innerHTML = "";
        
        if (snap.empty) {
            listaGastos.innerHTML = "<div class='text-center text-muted small py-2'>No hay gastos registrados hoy.</div>";
            return;
        }

        snap.forEach(documento => {
            const d = documento.data();
            listaGastos.innerHTML += `
                <div class="d-flex justify-content-between align-items-center bg-white border shadow-sm p-2 rounded mb-1 animate__animated animate__fadeIn">
                    <div>
                        <strong class="d-block text-dark small">${d.concepto}</strong>
                        <span class="badge bg-secondary mt-1" style="font-size: 0.65rem;">${d.categoria}</span>
                    </div>
                    <div class="d-flex align-items-center">
                        <strong class="text-danger me-3 fw-bold">S/ ${d.monto.toFixed(2)}</strong>
                        <button class="btn btn-sm text-danger border-0 px-2" onclick="eliminarGasto('${documento.id}')" title="Eliminar este gasto">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error("Error al cargar gastos:", error);
        listaGastos.innerHTML = "<div class='text-danger small'>Error al cargar el historial.</div>";
    }
}

// NUEVA FUNCIÓN: Eliminar un gasto por error
window.eliminarGasto = async (id) => {
    if (confirm("¿Seguro que deseas anular este gasto? El monto volverá a tu caja.")) {
        try {
            await deleteDoc(doc(db, "gastos", id));
            cargarGastosHoy(); // Recargamos la lista automáticamente
        } catch (error) {
            console.error("Error al eliminar:", error);
            alert("No se pudo eliminar el gasto.");
        }
    }
};

// Abrir Modal de Gastos
btnNuevoGasto.addEventListener('click', () => {
    if (!modalGastoInstance) modalGastoInstance = new bootstrap.Modal(document.getElementById('modalGasto'));
    document.getElementById('gasto-concepto').value = "";
    document.getElementById('gasto-monto').value = "0";
    cargarGastosHoy(); // Cargamos la lista antes de que aparezca la ventana
    modalGastoInstance.show();
});

// Guardar Nuevo Gasto
btnGuardarGasto.addEventListener('click', async () => {
    const concepto = document.getElementById('gasto-concepto').value.trim();
    const categoria = document.getElementById('gasto-categoria').value;
    const monto = parseFloat(document.getElementById('gasto-monto').value) || 0;

    if (!concepto || monto <= 0) return alert("Escribe el concepto y un monto válido.");

    btnGuardarGasto.disabled = true;
    btnGuardarGasto.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        await addDoc(collection(db, "gastos"), { fecha: new Date(), concepto: concepto, categoria: categoria, monto: monto });
        
        // Limpiamos los cuadros de texto por si quiere agregar otro gasto
        document.getElementById('gasto-concepto').value = "";
        document.getElementById('gasto-monto').value = "0";
        
        // Recargamos la lista para que vea el nuevo gasto abajo
        cargarGastosHoy();
        
        // Le mostramos un check verde temporal
        btnGuardarGasto.innerHTML = '<i class="fas fa-check"></i> ¡Guardado!';
        btnGuardarGasto.classList.replace('btn-warning', 'btn-success');
        
        setTimeout(() => {
            btnGuardarGasto.innerHTML = '<i class="fas fa-save me-2"></i>Guardar Gasto';
            btnGuardarGasto.classList.replace('btn-success', 'btn-warning');
            btnGuardarGasto.disabled = false;
        }, 1500);

    } catch (error) {
        console.error("Error:", error);
        btnGuardarGasto.disabled = false;
        btnGuardarGasto.innerHTML = '<i class="fas fa-save me-2"></i>Guardar Gasto';
    }
});

let modalArqueoInstance = null;
const btnArqueo = document.getElementById('btn-arqueo');

btnArqueo.addEventListener('click', async () => {
    if (!modalArqueoInstance) modalArqueoInstance = new bootstrap.Modal(document.getElementById('modalArqueo'));
    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
    const qVentas = query(collection(db, "ventas_historicas"), where("fecha", ">=", inicioDia));
    const qGastos = query(collection(db, "gastos"), where("fecha", ">=", inicioDia));
    
    try {
        const [ventasSnap, gastosSnap] = await Promise.all([getDocs(qVentas), getDocs(qGastos)]);
        let totEfectivo = 0, totYape = 0, totPlin = 0, totTarjeta = 0, totalGastos = 0;

        ventasSnap.forEach((doc) => {
            const data = doc.data();
            if (data.metodos_pago) {
                totEfectivo += data.metodos_pago.efectivo || 0;
                totYape += data.metodos_pago.yape || 0;
                totPlin += data.metodos_pago.plin || 0;
                totTarjeta += data.metodos_pago.tarjeta || 0;
            }
        });
        gastosSnap.forEach((doc) => { totalGastos += doc.data().monto || 0; });

        const totalIngresos = totEfectivo + totYape + totPlin + totTarjeta;
        
        document.getElementById('arq-efectivo').innerText = `S/ ${totEfectivo.toFixed(2)}`;
        document.getElementById('arq-yape').innerText = `S/ ${totYape.toFixed(2)}`;
        document.getElementById('arq-plin').innerText = `S/ ${totPlin.toFixed(2)}`;
        document.getElementById('arq-tarjeta').innerText = `S/ ${totTarjeta.toFixed(2)}`;
        document.getElementById('arq-ingresos').innerText = `S/ ${totalIngresos.toFixed(2)}`;
        document.getElementById('arq-gastos').innerText = `S/ ${totalGastos.toFixed(2)}`;
        document.getElementById('arq-neta').innerText = `S/ ${(totalIngresos - totalGastos).toFixed(2)}`;
        
        document.getElementById('arq-neta').className = (totalIngresos - totalGastos) < 0 ? "text-danger fw-bold m-0" : "text-white fw-bold m-0";
        
        let conteoPlatosHoy = {};
        ventasSnap.forEach((doc) => {
            const data = doc.data();
            if (data.items) {
                data.items.forEach(item => {
                    // FILTRO APLICADO AQUÍ
                    if (esPlatoParaRanking(item.nombre)) {
                        conteoPlatosHoy[item.nombre] = (conteoPlatosHoy[item.nombre] || 0) + item.cantidad;
                    }
                });
            }
        });

        // Ordenar y sacar Top 3
        let rankingHoy = Object.keys(conteoPlatosHoy)
            .map(n => ({ nombre: n, cant: conteoPlatosHoy[n] }))
            .sort((a, b) => b.cant - a.cant)
            .slice(0, 5);

        const containerTop = document.getElementById('arq-top-platos');
        containerTop.innerHTML = rankingHoy.length > 0 
            ? rankingHoy.map((p, i) => `<div>${i+1}. ${p.nombre} (${p.cant})</div>`).join("")
            : "Sin ventas registradas hoy.";

        modalArqueoInstance.show();
    } catch (error) { console.error("Error:", error); }
});

// =========================================================
//  7. DASHBOARD GRÁFICO (CHART.JS) Y RANKING
// =========================================================
let modalReportesInstance = null;
let chartFinanzasInstance = null;
let chartRankingInstance = null; 
const btnReportes = document.getElementById('btn-reportes');
const inputFiltroMes = document.getElementById('filtro-mes-reporte');

btnReportes.addEventListener('click', () => {
    if (!modalReportesInstance) modalReportesInstance = new bootstrap.Modal(document.getElementById('modalReportes'));
    if (!inputFiltroMes.value) {
        const hoy = new Date();
        const mesStr = (hoy.getMonth() + 1).toString().padStart(2, '0');
        inputFiltroMes.value = `${hoy.getFullYear()}-${mesStr}`; 
    }
    cargarDatosDashboard(inputFiltroMes.value);
    modalReportesInstance.show();
});

inputFiltroMes.addEventListener('change', (e) => {
    cargarDatosDashboard(e.target.value);
});

async function cargarDatosDashboard(anioMes) {
    if (!anioMes) return;
    const [year, month] = anioMes.split('-');
    
    const inicioMes = new Date(year, parseInt(month) - 1, 1);
    const finMes = new Date(year, parseInt(month), 0, 23, 59, 59);

    const qVentas = query(collection(db, "ventas_historicas"), where("fecha", ">=", inicioMes), where("fecha", "<=", finMes));
    const qGastos = query(collection(db, "gastos"), where("fecha", ">=", inicioMes), where("fecha", "<=", finMes));

    try {
        const [ventasSnap, gastosSnap] = await Promise.all([getDocs(qVentas), getDocs(qGastos)]);
        
        let totalIngresos = 0;
        let totalGastos = 0;
        
        const numDias = finMes.getDate(); 
        const labelsDias = Array.from({length: numDias}, (_, i) => `Día ${i + 1}`);
        const dataIngresos = new Array(numDias).fill(0);
        const dataGastos = new Array(numDias).fill(0);

        let conteoPlatos = {};

        ventasSnap.forEach(doc => {
            const data = doc.data();
            const fecha = data.fecha.toDate();
            const diaIndex = fecha.getDate() - 1; 
            
            dataIngresos[diaIndex] += data.total_cobrado || 0;
            totalIngresos += data.total_cobrado || 0;

            if (data.items && Array.isArray(data.items)) {
                data.items.forEach(item => {
                    // Ignorar "Taper" y "Refresco"
                    if (esPlatoParaRanking(item.nombre)) {
                        if (conteoPlatos[item.nombre]) {
                            conteoPlatos[item.nombre] += item.cantidad;
                        } else {
                            conteoPlatos[item.nombre] = item.cantidad;
                        }
                    }
                });
            }
        });

        gastosSnap.forEach(doc => {
            const data = doc.data();
            const fecha = data.fecha.toDate();
            const diaIndex = fecha.getDate() - 1;
            
            dataGastos[diaIndex] += data.monto || 0;
            totalGastos += data.monto || 0;
        });

        const gananciaNeta = totalIngresos - totalGastos;

        document.getElementById('rep-ingresos').innerText = `S/ ${totalIngresos.toFixed(2)}`;
        document.getElementById('rep-gastos').innerText = `S/ ${totalGastos.toFixed(2)}`;
        document.getElementById('rep-neta').innerText = `S/ ${gananciaNeta.toFixed(2)}`;
        document.getElementById('rep-neta').className = gananciaNeta < 0 ? "text-danger fw-bold m-0" : "text-white fw-bold m-0";

        let rankingArray = Object.keys(conteoPlatos).map(nombre => {
            return { nombre: nombre, cantidad: conteoPlatos[nombre] };
        });
        rankingArray.sort((a, b) => b.cantidad - a.cantidad);

        const topN = 12;
        const labelsRanking = rankingArray.slice(0, topN).map(item => item.nombre);
        const dataRanking = rankingArray.slice(0, topN).map(item => item.cantidad);

        dibujarGraficoFinanzas(labelsDias, dataIngresos, dataGastos);
        dibujarGraficoRanking(labelsRanking, dataRanking);
        
    } catch (error) {
        console.error("Error en dashboard:", error);
    }
}

function dibujarGraficoFinanzas(labels, dataIngresos, dataGastos) {
    const ctx = document.getElementById('graficoFinanciero').getContext('2d');
    if (chartFinanzasInstance) chartFinanzasInstance.destroy();

    chartFinanzasInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Ingresos (S/)', data: dataIngresos, borderColor: '#198754', backgroundColor: 'rgba(25, 135, 84, 0.15)', borderWidth: 3, fill: true, tension: 0.4 },
                { label: 'Gastos (S/)', data: dataGastos, borderColor: '#dc3545', backgroundColor: 'rgba(220, 53, 69, 0.1)', borderWidth: 3, fill: true, tension: 0.4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            plugins: { tooltip: { callbacks: { label: function(context) { return ` ${context.dataset.label}: S/ ${context.parsed.y.toFixed(2)}`; } } } }
        }
    });
}

function dibujarGraficoRanking(labels, dataCants) {
    const ctx = document.getElementById('graficoRanking').getContext('2d');
    if (chartRankingInstance) chartRankingInstance.destroy();

    chartRankingInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cantidades Vendidas',
                data: dataCants,
                backgroundColor: 'rgba(255, 193, 7, 0.7)', 
                borderColor: '#ffc107',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', 
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: function(context) { return ` Vendidos: ${context.parsed.x} unidades`; } } }
            },
            scales: {
                x: { beginAtZero: true, ticks: { stepSize: 1 } }, 
                y: { ticks: { font: { weight: 'bold' } } }
            }
        }
    });
}

// =========================================================
//  8. SEGURIDAD Y AUTENTICACIÓN (LOGIN)
// =========================================================
const loginSection = document.getElementById('login-section');
const posSection = document.getElementById('pos-section');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');

// Escuchar cambios: Si entra, mostramos POS. Si sale, mostramos Login.
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Contraseña correcta
        loginSection.classList.add('d-none');
        posSection.classList.remove('d-none');
        iniciarSistemaPOS(); // Arrancamos el motor de mesas
    } else {
        // Bloqueado
        loginSection.classList.remove('d-none');
        posSection.classList.add('d-none');
        
        // Limpiamos la pantalla por seguridad
        mesasData = [];
        contenedorMesas.innerHTML = "";
    }
});

// Botón de Ingresar
btnLogin.addEventListener('click', () => {
    const email = document.getElementById('pos-email').value;
    const pass = document.getElementById('pos-pass').value;
    
    btnLogin.disabled = true;
    btnLogin.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';

    signInWithEmailAndPassword(auth, email, pass)
        .catch(error => {
            alert("Acceso denegado. Verifica tu correo y contraseña.");
            console.error(error);
        })
        .finally(() => {
            btnLogin.disabled = false;
            btnLogin.innerHTML = '<i class="fas fa-sign-in-alt"></i> Abrir Caja';
        });
});

// Botón de Salir
btnLogout.addEventListener('click', () => {
    if(confirm("¿Seguro que deseas cerrar la caja y salir?")) {
        signOut(auth);
    }
});