// --- DATOS INICIALES Y LOCALSTORAGE ---
const stockInicial = { "Algodón": 150.0, "Lino": 80.0, "Poliéster": 200.0, "Mezclilla (Jeans)": 95.0 };
let inventario = JSON.parse(localStorage.getItem('textil_inventario')) || stockInicial;
let historialMovimientos = JSON.parse(localStorage.getItem('textil_historial')) || [];
let gastosSemanalesList = JSON.parse(localStorage.getItem('textil_gastos_list')) || [];

// --- SISTEMA DE NOTIFICACIONES (TOAST) ---
function mostrarNotificacion(tipo, mensaje) {
    const container = document.getElementById('toast-container');
    const iconos = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    const clases = {
        success: 'toast-success',
        error: 'toast-error',
        warning: 'toast-warning',
        info: 'toast-info'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${clases[tipo]}`;
    toast.innerHTML = `
        <span class="toast-icon">${iconos[tipo]}</span>
        <span class="toast-message">${mensaje}</span>
        <button class="toast-close">✕</button>
    `;
    
    container.appendChild(toast);
    
    const timeout = setTimeout(() => {
        eliminarToast(toast);
    }, 5000);
    
    toast.querySelector('.toast-close').addEventListener('click', () => {
        clearTimeout(timeout);
        eliminarToast(toast);
    });
}

function eliminarToast(toast) {
    toast.style.opacity = '0';
    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 300);
}

// --- FUNCIÓN PARA ASEGURAR TIMESTAMP VÁLIDO ---
function normalizarMovimientos(lista) {
    return lista.map(mov => {
        if (!mov.timestamp) {
            let fechaObj;
            if (mov.fecha && mov.hora) {
                const fechaStr = mov.fecha.split('/').reverse().join('-');
                const horaStr = mov.hora.replace(/[ap]\. m\./g, '').trim();
                fechaObj = new Date(`${fechaStr}T${horaStr}`);
                if (isNaN(fechaObj)) fechaObj = new Date();
            } else {
                fechaObj = new Date();
            }
            mov.timestamp = fechaObj.getTime();
        }
        if (!mov.fecha || !mov.hora) {
            const d = new Date(mov.timestamp);
            mov.fecha = d.toLocaleDateString();
            mov.hora = d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
        }
        return mov;
    });
}

historialMovimientos = normalizarMovimientos(historialMovimientos);
gastosSemanalesList = normalizarMovimientos(gastosSemanalesList);
guardarTodo();

// --- COLORES PASTEL PARA TELAS ---
function getColorPorTela(tela) {
    const base = { "Algodón":"#FFB3BA","Lino":"#C5E99B","Poliéster":"#B5EAD7","Mezclilla (Jeans)":"#FFDAC1" };
    if (base[tela]) return base[tela];
    let hash = 0;
    for (let i=0; i<tela.length; i++) hash = ((hash<<5)-hash)+tela.charCodeAt(i);
    return `hsl(${Math.abs(hash%360)}, 70%, 75%)`;
}

function guardarTodo() {
    localStorage.setItem('textil_inventario', JSON.stringify(inventario));
    localStorage.setItem('textil_historial', JSON.stringify(historialMovimientos));
    localStorage.setItem('textil_gastos_list', JSON.stringify(gastosSemanalesList));
}

// --- CÁLCULO DE ROTACIÓN ---
function calcularRotacion(tela) {
    const salidas = historialMovimientos.filter(m => m.tela === tela && m.tipo === 'salida');
    if (salidas.length === 0) return { lastSaleDate: null, daysSince: null, hasSales: false };
    const masReciente = [...salidas].sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
    const lastTimestamp = masReciente.timestamp;
    if (!lastTimestamp) return { lastSaleDate: null, daysSince: null, hasSales: false };
    const lastDate = new Date(lastTimestamp);
    const diffDays = Math.floor((Date.now() - lastDate) / (1000*60*60*24));
    return { lastSaleDate: lastDate, daysSince: diffDays, hasSales: true };
}

// --- ACTUALIZAR TABLA DE STOCK ---
function actualizarTablaStock() {
    const tbody = document.getElementById('cuerpoTablaStock');
    tbody.innerHTML = '';
    for (const [tela, cant] of Object.entries(inventario)) {
        const rot = calcularRotacion(tela);
        let ultimaSalida = 'Nunca', diasStr = 'Sin salidas', claseRot = 'sin-movimientos';
        if (rot.hasSales) {
            ultimaSalida = rot.lastSaleDate.toLocaleDateString();
            const dias = rot.daysSince;
            diasStr = `${dias} día${dias !== 1 ? 's' : ''}`;
            if (dias <= 7) claseRot = 'rotacion-verde';
            else if (dias <= 30) claseRot = 'rotacion-amarillo';
            else claseRot = 'rotacion-rojo';
        }
        const stockBajo = cant < 10 ? 'stock-bajo' : '';
        tbody.innerHTML += `
            <tr class="${claseRot}">
                <td><strong>${tela}</strong></td>
                <td class="${stockBajo}">${cant.toFixed(2)} mts ${cant < 10 ? '<span class="badge-stock-bajo">⚠️ Stock bajo</span>' : ''}</td>
                <td>${ultimaSalida}</td>
                <td>${diasStr}</td>
                <td><button class="btn-eliminar" data-tela="${tela}">🗑️ Eliminar</button></td>
            </tr>
        `;
    }
    document.querySelectorAll('.btn-eliminar').forEach(btn => {
        btn.addEventListener('click', (e) => eliminarTela(btn.getAttribute('data-tela')));
    });
}

function eliminarTela(tela) {
    if (!inventario[tela]) return;
    if (!confirm(`¿Eliminar "${tela}"? Los movimientos históricos se conservan.`)) return;
    delete inventario[tela];
    guardarTodo();
    actualizarUI();
    mostrarNotificacion('success', `Tela "${tela}" eliminada.`);
}

function actualizarSelect() {
    const select = document.getElementById('telaSelect');
    const anterior = select.value;
    select.innerHTML = '';
    Object.keys(inventario).forEach(t => select.innerHTML += `<option value="${t}">${t}</option>`);
    if (anterior && inventario[anterior]) select.value = anterior;
    else if (Object.keys(inventario).length > 0) select.value = Object.keys(inventario)[0];
}

function actualizarTablaGastos() {
    const tbody = document.getElementById('cuerpoTablaGastos');
    tbody.innerHTML = '';
    if (gastosSemanalesList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#999;">No hay gastos registrados esta semana.</td></tr>';
        return;
    }
    gastosSemanalesList.forEach((g, idx) => {
        tbody.innerHTML += `
            <tr>
                <td>${idx+1}</td><td>${g.tela}</td>
                <td>${g.cantidad.toFixed(2)} mts</td>
                <td>${g.hora || '--:--:--'}</td><td>${g.fecha || ''}</td>
            </tr>
        `;
    });
}

function actualizarResumenBonito() {
    const cont = document.getElementById('resumenBonito');
    const acum = {};
    let total = 0;
    gastosSemanalesList.forEach(g => {
        acum[g.tela] = (acum[g.tela] || 0) + g.cantidad;
        total += g.cantidad;
    });
    if (Object.keys(acum).length === 0) {
        cont.innerHTML = '<p style="text-align:center">No hay gastos esta semana.</p>';
        return;
    }
    let html = '';
    for (const [tela, cant] of Object.entries(acum)) {
        const color = getColorPorTela(tela);
        html += `
            <div class="resumen-card" style="border-left-color: ${color}">
                <h4>${tela}</h4>
                <div class="cantidad">${cant.toFixed(2)} mts</div>
            </div>
        `;
    }
    html += `<div class="resumen-card total-card"><h4>📦 Total gastado</h4><div class="cantidad">${total.toFixed(2)} mts</div></div>`;
    cont.innerHTML = html;
}

function actualizarHistorialCompleto() {
    const tbody = document.getElementById('cuerpoHistorialCompleto');
    tbody.innerHTML = '';
    const movs = [...historialMovimientos].reverse();
    if (movs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No hay movimientos registrados.</td></tr>';
        return;
    }
    movs.forEach(mov => {
        const badge = mov.tipo === 'entrada' ? '<span class="badge-entrada">ENTRADA</span>' : '<span class="badge-salida">SALIDA</span>';
        tbody.innerHTML += `
            <tr>
                <td>${mov.tela}</td><td>${badge}</td>
                <td>${mov.cantidad.toFixed(2)} mts</td>
                <td>${mov.fecha}</td><td>${mov.hora || '--:--:--'}</td>
            </tr>
        `;
    });
}

// --- GRÁFICO DE BARRAS (CORREGIDO Y CON VERIFICACIÓN) ---
let chartInstance = null;

function generarGrafico() {
    const canvasElement = document.getElementById('graficoGastos');
    if (!canvasElement) {
        console.error('❌ No se encontró el canvas con id "graficoGastos"');
        return;
    }
    
    // Asegurar que el canvas tenga un tamaño visible
    canvasElement.style.height = '350px';
    canvasElement.style.width = '100%';
    
    const ctx = canvasElement.getContext('2d');
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
    
    // Si no hay datos, mostrar un gráfico vacío con mensaje
    if (gastosSemanalesList.length === 0) {
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Sin gastos'],
                datasets: [{
                    label: 'Metros consumidos',
                    data: [0],
                    backgroundColor: '#cccccc',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                scales: {
                    y: { beginAtZero: true, max: 1, title: { display: true, text: 'Metros' } },
                    x: { title: { display: true, text: 'Hora del gasto' } }
                }
            }
        });
        console.log('📊 Gráfico generado sin datos (mensaje vacío)');
        return;
    }
    
    // Preparar datos
    const horas = gastosSemanalesList.map(g => g.hora || '--:--');
    const datos = gastosSemanalesList.map(g => g.cantidad);
    const colores = gastosSemanalesList.map(g => getColorPorTela(g.tela));
    
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: horas,
            datasets: [{
                label: 'Metros consumidos',
                data: datos,
                backgroundColor: colores,
                borderRadius: 8,
                barPercentage: 0.7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const g = gastosSemanalesList[ctx.dataIndex];
                            return [
                                `📅 Fecha: ${g.fecha}`,
                                `⏰ Hora: ${g.hora}`,
                                `🧵 Tela: ${g.tela}`,
                                `📏 Cantidad: ${g.cantidad.toFixed(2)} mts`
                            ];
                        }
                    }
                },
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Metros' },
                    grid: { color: '#e9ecef' }
                },
                x: {
                    title: { display: true, text: 'Hora del gasto' },
                    ticks: { autoSkip: true, maxRotation: 45, minRotation: 30 }
                }
            }
        }
    });
    console.log(`📊 Gráfico generado con ${gastosSemanalesList.length} gastos`);
}

// --- ACTUALIZAR UI ---
function actualizarUI() {
    actualizarSelect();
    actualizarTablaStock();
    actualizarTablaGastos();
    actualizarResumenBonito();
    actualizarHistorialCompleto();
    // Generar gráfico con un pequeño retraso para asegurar que el DOM esté listo
    setTimeout(() => {
        generarGrafico();
    }, 100);
}

// --- GENERADOR DE PDF MULTIPÁGINA ---
async function generarPDFMultipagina(elemento, titulo, nombreArchivo) {
    if (!elemento) return;
    const originalDisplay = elemento.style.display;
    elemento.style.display = 'block';

    const clone = elemento.cloneNode(true);
    const botones = clone.querySelectorAll('button, .btn-eliminar, .btn-danger, .btn-primary');
    botones.forEach(btn => btn.remove());
    
    clone.style.width = '700px';
    clone.style.margin = '0 auto';
    clone.style.backgroundColor = 'white';
    clone.style.padding = '20px';
    clone.style.fontFamily = 'Arial, sans-serif';
    
    const tablas = clone.querySelectorAll('table');
    tablas.forEach(tabla => {
        tabla.style.width = '100%';
        tabla.style.borderCollapse = 'collapse';
        const celdas = tabla.querySelectorAll('th, td');
        celdas.forEach(celda => {
            celda.style.border = '1px solid #999';
            celda.style.padding = '6px';
            celda.style.fontSize = '10px';
        });
        const headers = tabla.querySelectorAll('th');
        headers.forEach(th => {
            th.style.backgroundColor = '#2b2d42';
            th.style.color = 'white';
        });
    });
    
    document.body.appendChild(clone);
    
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('portrait', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const contentWidth = pageWidth - margin * 2;
        
        const canvas = await html2canvas(clone, { scale: 1.2, backgroundColor: '#ffffff', logging: false });
        const imgData = canvas.toDataURL('image/png');
        const imgHeight = (canvas.height * contentWidth) / canvas.width;
        let remainingHeight = imgHeight;
        let yOffset = 0;
        let page = 1;
        
        while (remainingHeight > 0) {
            if (page > 1) pdf.addPage();
            const sliceHeight = Math.min(pageHeight - margin * 2, remainingHeight);
            const canvasSlice = document.createElement('canvas');
            canvasSlice.width = canvas.width;
            canvasSlice.height = (sliceHeight / imgHeight) * canvas.height;
            const ctxSlice = canvasSlice.getContext('2d');
            ctxSlice.drawImage(canvas, 0, yOffset, canvas.width, canvasSlice.height, 0, 0, canvasSlice.width, canvasSlice.height);
            const sliceData = canvasSlice.toDataURL('image/png');
            pdf.addImage(sliceData, 'PNG', margin, margin, contentWidth, sliceHeight);
            remainingHeight -= sliceHeight;
            yOffset += canvasSlice.height;
            page++;
        }
        pdf.save(nombreArchivo);
        mostrarNotificacion('success', `PDF "${titulo}" generado correctamente.`);
    } catch (error) {
        console.error(error);
        mostrarNotificacion('error', `Error al generar PDF: ${error.message}`);
    } finally {
        document.body.removeChild(clone);
        elemento.style.display = originalDisplay;
    }
}

// --- EVENTOS ---
document.getElementById('btnReiniciarSemana').addEventListener('click', () => {
    if (confirm("¿Reiniciar la semana? Se borrarán los gastos individuales.")) {
        gastosSemanalesList = [];
        guardarTodo();
        actualizarUI();
        mostrarNotificacion('success', 'Semana reiniciada.');
    }
});

document.getElementById('movimientoForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const tela = document.getElementById('telaSelect').value;
    const tipo = document.getElementById('tipoMovimiento').value;
    const cantidad = parseFloat(document.getElementById('cantidad').value);
    const ahora = new Date();
    const fecha = ahora.toLocaleDateString();
    const hora = ahora.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    const timestamp = ahora.getTime();
    
    if (tipo === 'salida') {
        if (inventario[tela] < cantidad) {
            mostrarNotificacion('error', `Stock insuficiente de ${tela}. Disponible: ${inventario[tela]} mts`);
            return;
        }
        inventario[tela] -= cantidad;
        gastosSemanalesList.push({ id: Date.now(), tela, cantidad, fecha, hora, timestamp });
        if (inventario[tela] < 10) {
            mostrarNotificacion('warning', `⚠️ ALERTA: Stock bajo de ${tela}. Quedan ${inventario[tela].toFixed(2)} mts`);
        }
    } else {
        inventario[tela] += cantidad;
    }
    historialMovimientos.push({ tela, tipo, cantidad, fecha, hora, timestamp });
    guardarTodo();
    document.getElementById('cantidad').value = '';
    actualizarUI();
    mostrarNotificacion('success', `Movimiento registrado: ${tipo === 'salida' ? 'Salida' : 'Entrada'} de ${cantidad} mts.`);
});

document.getElementById('nuevaTelaForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const nueva = document.getElementById('nuevaTelaInput').value.trim();
    const stockIni = parseFloat(document.getElementById('stockInicialInput').value);
    if (inventario[nueva]) {
        mostrarNotificacion('error', 'Esta tela ya existe.');
        return;
    }
    inventario[nueva] = stockIni;
    const ahora = new Date();
    const fecha = ahora.toLocaleDateString();
    const hora = ahora.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    historialMovimientos.push({ tela: nueva, tipo: 'entrada', cantidad: stockIni, fecha, hora, timestamp: ahora.getTime() });
    guardarTodo();
    actualizarUI();
    document.getElementById('nuevaTelaInput').value = '';
    document.getElementById('stockInicialInput').value = '';
    mostrarNotificacion('success', `Tela "${nueva}" agregada con ${stockIni} mts. Movimiento registrado.`);
});

document.getElementById('btnBorrarHistorial').addEventListener('click', () => {
    if (confirm("¿Borrar TODO el historial? No se puede deshacer.")) {
        historialMovimientos = [];
        guardarTodo();
        actualizarUI();
        mostrarNotificacion('info', 'Historial borrado.');
    }
});

// --- EXPORTAR HISTORIAL PDF ---
document.getElementById('btnExportarHistorialPDF').addEventListener('click', async () => {
    const tabla = document.getElementById('tablaHistorialCompleta');
    if (!tabla || tabla.querySelectorAll('tbody tr').length === 0 || tabla.querySelector('td[colspan]')) {
        mostrarNotificacion('error', 'No hay datos en el historial para exportar.');
        return;
    }
    const contenedor = document.createElement('div');
    contenedor.style.backgroundColor = 'white';
    const titulo = document.createElement('h2');
    titulo.innerText = 'Historial de Movimientos';
    titulo.style.textAlign = 'center';
    const fecha = document.createElement('p');
    fecha.innerText = `Generado: ${new Date().toLocaleString()}`;
    fecha.style.textAlign = 'center';
    contenedor.appendChild(titulo);
    contenedor.appendChild(fecha);
    const cloneTabla = tabla.cloneNode(true);
    contenedor.appendChild(cloneTabla);
    await generarPDFMultipagina(contenedor, 'Historial', `historial_${Date.now()}.pdf`);
});

// --- EXPORTAR REPORTE SEMANAL PDF ---
document.getElementById('btnExportarReportePDF').addEventListener('click', async () => {
    const resumenDiv = document.getElementById('resumenBonito');
    const tablaGastos = document.getElementById('tablaGastos');
    const graficoCanvas = document.getElementById('graficoGastos');
    if (!tablaGastos || tablaGastos.querySelectorAll('tbody tr').length === 0) {
        mostrarNotificacion('error', 'No hay gastos esta semana para generar el reporte.');
        return;
    }
    const contenedor = document.createElement('div');
    const titulo = document.createElement('h2');
    titulo.innerText = 'Reporte de gastos semanales';
    titulo.style.textAlign = 'center';
    const fecha = document.createElement('p');
    fecha.innerText = `Generado: ${new Date().toLocaleString()}`;
    fecha.style.textAlign = 'center';
    contenedor.appendChild(titulo);
    contenedor.appendChild(fecha);
    const cloneResumen = resumenDiv.cloneNode(true);
    const cloneTabla = tablaGastos.cloneNode(true);
    contenedor.appendChild(cloneResumen);
    contenedor.appendChild(cloneTabla);
    const img = document.createElement('img');
    img.src = graficoCanvas.toDataURL();
    img.style.width = '100%';
    img.style.marginTop = '20px';
    contenedor.appendChild(img);
    await generarPDFMultipagina(contenedor, 'Reporte Semanal', `reporte_semanal_${Date.now()}.pdf`);
});

// --- EXPORTAR STOCK A EXCEL ---
document.getElementById('btnExportarStockExcel').addEventListener('click', () => {
    const data = [];
    data.push(['Tela', 'Disponible (mts)', 'Última Salida', 'Días sin uso']);
    for (const [tela, cant] of Object.entries(inventario)) {
        const rot = calcularRotacion(tela);
        let ultimaSalida = 'Nunca';
        let dias = 'Sin salidas';
        if (rot.hasSales) {
            ultimaSalida = rot.lastSaleDate.toLocaleDateString();
            dias = `${rot.daysSince} día${rot.daysSince !== 1 ? 's' : ''}`;
        }
        data.push([tela, cant.toFixed(2), ultimaSalida, dias]);
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Stock');
    XLSX.writeFile(wb, `stock_${new Date().toISOString().slice(0,10)}.xlsx`);
    mostrarNotificacion('success', 'Stock exportado a Excel correctamente.');
});

// --- EXPORTAR HISTORIAL A EXCEL ---
document.getElementById('btnExportarHistorialExcel').addEventListener('click', () => {
    if (historialMovimientos.length === 0) {
        mostrarNotificacion('error', 'No hay movimientos para exportar.');
        return;
    }
    const data = [];
    data.push(['Tela', 'Tipo', 'Cantidad (mts)', 'Fecha', 'Hora']);
    const movs = [...historialMovimientos].reverse();
    movs.forEach(mov => {
        data.push([
            mov.tela,
            mov.tipo === 'entrada' ? 'ENTRADA' : 'SALIDA',
            mov.cantidad.toFixed(2),
            mov.fecha,
            mov.hora || '--:--:--'
        ]);
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Historial');
    XLSX.writeFile(wb, `historial_${new Date().toISOString().slice(0,10)}.xlsx`);
    mostrarNotificacion('success', 'Historial exportado a Excel correctamente.');
});

// --- EXPORTAR REPORTE SEMANAL A EXCEL ---
document.getElementById('btnExportarReporteExcel').addEventListener('click', () => {
    if (gastosSemanalesList.length === 0) {
        mostrarNotificacion('error', 'No hay gastos esta semana para exportar.');
        return;
    }
    const data = [];
    data.push(['#', 'Tela', 'Cantidad (mts)', 'Hora', 'Fecha']);
    gastosSemanalesList.forEach((g, idx) => {
        data.push([
            idx+1,
            g.tela,
            g.cantidad.toFixed(2),
            g.hora || '--:--:--',
            g.fecha || ''
        ]);
    });
    const total = gastosSemanalesList.reduce((sum, g) => sum + g.cantidad, 0);
    data.push([]);
    data.push(['TOTAL GASTADO', '', total.toFixed(2), '', '']);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte Semanal');
    XLSX.writeFile(wb, `reporte_semanal_${new Date().toISOString().slice(0,10)}.xlsx`);
    mostrarNotificacion('success', 'Reporte semanal exportado a Excel correctamente.');
});

// --- MENÚ ACORDEÓN ---
document.querySelectorAll('.menu-titulo').forEach(titulo => {
    titulo.addEventListener('click', function() {
        const categoria = this.dataset.categoria;
        const submenu = document.getElementById(`submenu-${categoria}`);
        const flecha = this.querySelector('.menu-flecha');
        if (submenu) {
            submenu.classList.toggle('mostrar');
            if (flecha) flecha.classList.toggle('abierto');
        }
    });
});

// --- NAVEGACIÓN ENTRE PANELES (CON ACTUALIZACIÓN DE GRÁFICO) ---
const panels = document.querySelectorAll('.panel');
const optionCards = document.querySelectorAll('.option-card');
optionCards.forEach(card => {
    card.addEventListener('click', () => {
        const target = card.getAttribute('data-panel');
        panels.forEach(p => p.classList.remove('active'));
        document.getElementById(`panel-${target}`).classList.add('active');
        optionCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        // Si se activa el panel de estadísticas, forzar la actualización del gráfico
        if (target === 'estadisticas') {
            setTimeout(() => generarGrafico(), 200);
        }
    });
});
document.querySelector('.option-card[data-panel="movimientos"]').classList.add('active');
document.getElementById('panel-movimientos').classList.add('active');

// Inicializar la interfaz (incluye el gráfico)
actualizarUI();