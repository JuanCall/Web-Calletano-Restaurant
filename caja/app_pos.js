import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, getDoc, updateDoc, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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
const btnTaper = document.getElementById('btn-taper');
const btnRefresco = document.getElementById('btn-refresco');
const btnCobrar = document.getElementById('btn-cobrar');
const totalCuenta = document.getElementById('total-cuenta');
const listaPedidos = document.getElementById('lista-pedidos');

let modalProductosInstance = null; 

// =========================================================
//  1. ESCUCHAR MESAS EN TIEMPO REAL
// =========================================================
function iniciarSistemaPOS() {
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

    cargarCartaDesdeWeb();
}

// =========================================================
//  2. DIBUJAR MESAS
// =========================================================
function dibujarMesas() {
    contenedorMesas.innerHTML = ""; 
    
    mesasData.forEach(mesa => {
        const esOcupada = mesa.estado === "ocupada";
        const claseEstado = esOcupada ? "mesa-ocupada" : "mesa-libre";
        const textoEstado = esOcupada ? "Ocupada" : "Libre";
        const icono = esOcupada ? "fa-utensils" : "fa-check-circle";
        const total = esOcupada ? `S/ ${mesa.total_consumo.toFixed(2)}` : "S/ 0.00";
        const esSeleccionada = mesa.id === mesaSeleccionadaId ? "mesa-seleccionada" : "";

        const div = document.createElement('div');
        // Usamos col-4 (12/4 = 3) para forzar siempre 3 columnas por fila
        div.className = "col-4 mb-3"; 
        div.innerHTML = `
            <div class="card mesa-card shadow-sm ${claseEstado} ${esSeleccionada}" onclick="seleccionarMesa('${mesa.id}')">
                <h3 class="fw-bold mb-1">Mesa ${mesa.numero}</h3>
                <span class="badge bg-white text-dark mb-2"><i class="fas ${icono}"></i> ${textoEstado}</span>
                <strong class="fs-5">${total}</strong>
            </div>
        `;
        contenedorMesas.appendChild(div);
    });
}

// =========================================================
//  3. LÓGICA DE LA COMANDERA
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
    btnTaper.disabled = false;
    btnRefresco.disabled = false;
    
    if (mesa.estado === "libre" || !mesa.pedido_actual || mesa.pedido_actual.length === 0) {
        estadoMesa.className = "badge bg-success mt-2";
        estadoMesa.innerText = "Libre";
        listaPedidos.innerHTML = `
            <div class="text-center text-muted mt-5">
                <i class="fas fa-concierge-bell fa-3x mb-3 opacity-25"></i>
                <p>Agregue platos para abrir la mesa.</p>
            </div>
        `;
        totalCuenta.innerText = "S/ 0.00";
        btnCobrar.disabled = true;
    } else {
        estadoMesa.className = "badge bg-danger mt-2";
        estadoMesa.innerText = "Ocupada";
        
        let itemsHTML = "";
        mesa.pedido_actual.forEach((item, index) => {
            itemsHTML += `
            <div class="d-flex justify-content-between align-items-center border-bottom py-2">
                <div>
                    <strong class="d-block text-dark">${item.nombre}</strong>
                    <small class="text-muted fw-bold">${item.cantidad} x S/ ${item.precio.toFixed(2)}</small>
                </div>
                <div class="text-end">
                    <strong class="d-block text-primary">S/ ${item.subtotal.toFixed(2)}</strong>
                    <button class="btn btn-sm btn-outline-danger mt-1 border-0" onclick="eliminarDelPedido(${index})" title="Eliminar"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        });
        listaPedidos.innerHTML = itemsHTML;
        totalCuenta.innerText = `S/ ${mesa.total_consumo.toFixed(2)}`;
        btnCobrar.disabled = false; 
    }
}

// =========================================================
//  4. CATÁLOGO DE PRODUCTOS Y PEDIDOS
// =========================================================
async function cargarCartaDesdeWeb() {
    try {
        const snapCarta = await getDoc(doc(db, "contenido", "cartaCompleta"));
        const snapMenu = await getDoc(doc(db, "contenido", "menuDiario"));
        
        let html = "";

        if(snapMenu.exists() && snapMenu.data().titulo) {
            const tituloMenu = snapMenu.data().titulo || "Menú del Día";
            html += `<h5 class="mt-3 fw-bold text-dark border-bottom pb-2"><i class="fas fa-utensils text-warning"></i> Especiales</h5>`;
            html += `<div class="row g-2 mb-3">
                        <div class="col-12">
                            <button class="btn btn-warning w-100 text-start fw-bold shadow-sm" onclick="agregarAlPedido('${tituloMenu}', 15)">
                                <i class="fas fa-plus-circle"></i> Agregar ${tituloMenu} (S/ 15.00)
                            </button>
                        </div>
                     </div>`;
        }

        if(snapCarta.exists() && snapCarta.data().categorias) {
            snapCarta.data().categorias.forEach(cat => {
                html += `<h5 class="mt-4 fw-bold text-primary border-bottom pb-1">${cat.nombre}</h5>`;
                html += `<div class="row g-2">`;
                
                cat.items.forEach(item => {
                    const precio1 = parseFloat(String(item.precio).replace(/[^0-9.]/g, '')) || 0;
                    if (item.precio2 && item.precio2.trim() !== "" && item.precio2 !== "-") {
                        const precio2 = parseFloat(String(item.precio2).replace(/[^0-9.]/g, '')) || 0;
                        html += `<div class="col-md-6"><button class="btn btn-outline-secondary w-100 text-start" onclick="agregarAlPedido('${item.nombre} (${cat.col1})', ${precio1})"><strong>${item.nombre} (${cat.col1})</strong><br><small>S/ ${precio1.toFixed(2)}</small></button></div>`;
                        html += `<div class="col-md-6"><button class="btn btn-outline-secondary w-100 text-start" onclick="agregarAlPedido('${item.nombre} (${cat.col2})', ${precio2})"><strong>${item.nombre} (${cat.col2})</strong><br><small>S/ ${precio2.toFixed(2)}</small></button></div>`;
                    } else {
                        html += `<div class="col-md-6"><button class="btn btn-outline-secondary w-100 text-start" onclick="agregarAlPedido('${item.nombre}', ${precio1})"><strong>${item.nombre}</strong><br><small>S/ ${precio1.toFixed(2)}</small></button></div>`;
                    }
                });
                html += `</div>`;
            });
        }
        document.getElementById('catalogo-productos').innerHTML = html;
    } catch (error) {
        document.getElementById('catalogo-productos').innerHTML = "<p class='text-danger'>Error al cargar el menú.</p>";
    }
}

btnAgregarProducto.addEventListener('click', () => {
    if (!modalProductosInstance) modalProductosInstance = new bootstrap.Modal(document.getElementById('modalProductos'));
    modalProductosInstance.show();
});

window.agregarAlPedido = async (nombre, precio) => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa) return;

    let nuevoPedido = mesa.pedido_actual ? [...mesa.pedido_actual] : [];
    
    let itemIndex = nuevoPedido.findIndex(i => i.nombre === nombre);
    if (itemIndex > -1) {
        nuevoPedido[itemIndex].cantidad += 1;
        nuevoPedido[itemIndex].subtotal = nuevoPedido[itemIndex].cantidad * nuevoPedido[itemIndex].precio;
    } else {
        nuevoPedido.push({ nombre: nombre, precio: parseFloat(precio), cantidad: 1, subtotal: parseFloat(precio) });
    }

    let nuevoTotal = nuevoPedido.reduce((acc, curr) => acc + curr.subtotal, 0);

    try {
        await updateDoc(doc(db, "mesas_pos", mesa.id), { estado: "ocupada", pedido_actual: nuevoPedido, total_consumo: nuevoTotal });
        if(modalProductosInstance) modalProductosInstance.hide();
    } catch (error) { console.error("Error guardando:", error); }
};

window.eliminarDelPedido = async (index) => {
    const mesa = mesasData.find(m => m.id === mesaSeleccionadaId);
    if (!mesa || !confirm("¿Seguro que deseas eliminar este pedido?")) return;

    let nuevoPedido = [...mesa.pedido_actual];
    nuevoPedido.splice(index, 1); 

    let nuevoTotal = nuevoPedido.reduce((acc, curr) => acc + curr.subtotal, 0);
    let nuevoEstado = nuevoPedido.length === 0 ? "libre" : "ocupada"; 

    try {
        await updateDoc(doc(db, "mesas_pos", mesa.id), { estado: nuevoEstado, pedido_actual: nuevoPedido, total_consumo: nuevoTotal });
    } catch (error) { console.error("Error borrando:", error); }
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
//  6. REGISTRO DE GASTOS Y ARQUEO FINAL
// =========================================================
let modalGastoInstance = null;
const btnNuevoGasto = document.getElementById('btn-nuevo-gasto');
const btnGuardarGasto = document.getElementById('btn-guardar-gasto');

btnNuevoGasto.addEventListener('click', () => {
    if (!modalGastoInstance) modalGastoInstance = new bootstrap.Modal(document.getElementById('modalGasto'));
    document.getElementById('gasto-concepto').value = "";
    document.getElementById('gasto-monto').value = "0";
    modalGastoInstance.show();
});

btnGuardarGasto.addEventListener('click', async () => {
    const concepto = document.getElementById('gasto-concepto').value.trim();
    const categoria = document.getElementById('gasto-categoria').value;
    const monto = parseFloat(document.getElementById('gasto-monto').value) || 0;

    if (!concepto || monto <= 0) return alert("Escribe el concepto y un monto válido.");

    btnGuardarGasto.disabled = true;
    btnGuardarGasto.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        await addDoc(collection(db, "gastos"), { fecha: new Date(), concepto: concepto, categoria: categoria, monto: monto });
        modalGastoInstance.hide();
    } catch (error) {
        console.error("Error:", error);
    } finally {
        btnGuardarGasto.disabled = false;
        btnGuardarGasto.innerHTML = '<i class="fas fa-save"></i> Guardar Gasto';
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
                    // AQUÍ ESTÁ EL FILTRO: Ignorar "Taper" y "Refresco"
                    if (item.nombre !== 'Taper' && item.nombre !== 'Refresco') {
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
        // ¡Contraseña correcta!
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