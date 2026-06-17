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

// ====== FUNCIONES PARA PREPARAR DATOS DEL GRÁFICO ======

function prepararDatosHora() {
    if (gastosSemanalesList.length === 0) {
        return {
            tipo: 'bar',
            data: {
                labels: ['Sin gastos'],
                datasets: [{ label: 'Metros', data: [0], backgroundColor: '#ccc' }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: { y: { beginAtZero: true, max: 1, title: { display: true, text: 'Metros' } } }
            }
        };
    }

    const horas = gastosSemanalesList.map(g => g.hora || '--:--');
    const datos = gastosSemanalesList.map(g => g.cantidad);
    const colores = gastosSemanalesList.map(g => getColorPorTela(g.tela));

    return {
        tipo: 'bar',
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
                y: { beginAtZero: true, title: { display: true, text: 'Metros' }, grid: { color: '#e9ecef' } },
                x: { title: { display: true, text: 'Hora del gasto' }, ticks: { autoSkip: true, maxRotation: 45, minRotation: 30 } }
            }
        }
    };
}

function prepararDatosDiaSemana() {
    const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const acumulado = {};
    
    gastosSemanalesList.forEach(g => {
        if (g.fecha) {
            const fecha = new Date(g.fecha.split('/').reverse().join('-'));
            const dia = fecha.getDay();
            const diaNombre = diasSemana[(dia + 6) % 7];
            if (!acumulado[diaNombre]) acumulado[diaNombre] = {};
            acumulado[diaNombre][g.tela] = (acumulado[diaNombre][g.tela] || 0) + g.cantidad;
        }
    });

    const telas = new Set();
    Object.values(acumulado).forEach(diaData => {
        Object.keys(diaData).forEach(tela => telas.add(tela));
    });
    const listaTelas = Array.from(telas);

    if (listaTelas.length === 0) {
        return {
            tipo: 'bar',
            data: {
                labels: diasSemana,
                datasets: [{ label: 'Metros', data: [0,0,0,0,0,0,0], backgroundColor: '#ccc' }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: { y: { beginAtZero: true, title: { display: true, text: 'Metros' } } }
            }
        };
    }

    const datasets = listaTelas.map(tela => {
        const data = diasSemana.map(dia => acumulado[dia]?.[tela] || 0);
        return {
            label: tela,
            data: data,
            backgroundColor: getColorPorTela(tela),
            borderRadius: 4,
            barPercentage: 0.6
        };
    });

    return {
        tipo: 'bar',
        data: {
            labels: diasSemana,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const label = context.dataset.label || '';
                            const value = context.raw || 0;
                            return `${label}: ${value.toFixed(2)} mts`;
                        },
                        footer: (items) => {
                            const diaIndex = items[0].dataIndex;
                            let total = 0;
                            items.forEach(item => { total += item.raw || 0; });
                            return `Total: ${total.toFixed(2)} mts`;
                        }
                    }
                },
                legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
            },
            scales: {
                x: { stacked: true, title: { display: true, text: 'Día de la semana' }, grid: { display: false } },
                y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Metros' }, grid: { color: '#e9ecef' } }
            }
        }
    };
}

function prepararDatosSemanaMes() {
    const acumulado = {};
    
    gastosSemanalesList.forEach(g => {
        if (g.fecha) {
            const fecha = new Date(g.fecha.split('/').reverse().join('-'));
            const semana = Math.ceil((fecha.getDate() - fecha.getDay() + 1) / 7);
            const mes = fecha.getMonth() + 1;
            const key = `Sem ${semana} (${mes})`;
            if (!acumulado[key]) acumulado[key] = {};
            acumulado[key][g.tela] = (acumulado[key][g.tela] || 0) + g.cantidad;
        }
    });

    const semanas = Object.keys(acumulado).sort((a, b) => {
        const numA = parseInt(a.split(' ')[1]);
        const numB = parseInt(b.split(' ')[1]);
        return numA - numB;
    });

    const telas = new Set();
    Object.values(acumulado).forEach(semanaData => {
        Object.keys(semanaData).forEach(tela => telas.add(tela));
    });
    const listaTelas = Array.from(telas);

    if (listaTelas.length === 0 || semanas.length === 0) {
        return {
            tipo: 'bar',
            data: {
                labels: ['Sin datos'],
                datasets: [{ label: 'Metros', data: [0], backgroundColor: '#ccc' }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false }, tooltip: { enabled: false } }
            }
        };
    }

    const datasets = listaTelas.map(tela => {
        const data = semanas.map(semana => acumulado[semana]?.[tela] || 0);
        return {
            label: tela,
            data: data,
            backgroundColor: getColorPorTela(tela),
            borderRadius: 4,
            barPercentage: 0.6
        };
    });

    return {
        tipo: 'bar',
        data: {
            labels: semanas,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const label = context.dataset.label || '';
                            const value = context.raw || 0;
                            return `${label}: ${value.toFixed(2)} mts`;
                        },
                        footer: (items) => {
                            const semanaIndex = items[0].dataIndex;
                            let total = 0;
                            items.forEach(item => { total += item.raw || 0; });
                            return `Total: ${total.toFixed(2)} mts`;
                        }
                    }
                },
                legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
            },
            scales: {
                x: { stacked: true, title: { display: true, text: 'Semana del mes' }, grid: { display: false } },
                y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Metros' }, grid: { color: '#e9ecef' } }
            }
        }
    };
}

function prepararDatosDiaMes() {
    const acumulado = {};
    
    gastosSemanalesList.forEach(g => {
        if (g.fecha) {
            const fecha = new Date(g.fecha.split('/').reverse().join('-'));
            const dia = fecha.getDate();
            const key = `Día ${dia}`;
            if (!acumulado[key]) acumulado[key] = {};
            acumulado[key][g.tela] = (acumulado[key][g.tela] || 0) + g.cantidad;
        }
    });

    const dias = Object.keys(acumulado).sort((a, b) => {
        const numA = parseInt(a.split(' ')[1]);
        const numB = parseInt(b.split(' ')[1]);
        return numA - numB;
    });

    const telas = new Set();
    Object.values(acumulado).forEach(diaData => {
        Object.keys(diaData).forEach(tela => telas.add(tela));
    });
    const listaTelas = Array.from(telas);

    if (listaTelas.length === 0 || dias.length === 0) {
        return {
            tipo: 'bar',
            data: {
                labels: ['Sin datos'],
                datasets: [{ label: 'Metros', data: [0], backgroundColor: '#ccc' }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false }, tooltip: { enabled: false } }
            }
        };
    }

    const datasets = listaTelas.map(tela => {
        const data = dias.map(dia => acumulado[dia]?.[tela] || 0);
        return {
            label: tela,
            data: data,
            backgroundColor: getColorPorTela(tela),
            borderRadius: 4,
            barPercentage: 0.6
        };
    });

    return {
        tipo: 'bar',
        data: {
            labels: dias,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const label = context.dataset.label || '';
                            const value = context.raw || 0;
                            return `${label}: ${value.toFixed(2)} mts`;
                        },
                        footer: (items) => {
                            const diaIndex = items[0].dataIndex;
                            let total = 0;
                            items.forEach(item => { total += item.raw || 0; });
                            return `Total: ${total.toFixed(2)} mts`;
                        }
                    }
                },
                legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
            },
            scales: {
                x: { stacked: true, title: { display: true, text: 'Día del mes' }, grid: { display: false } },
                y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Metros' }, grid: { color: '#e9ecef' } }
            }
        }
    };
}

function prepararDatosTop3() {
    const acumulado = {};
    gastosSemanalesList.forEach(g => {
        acumulado[g.tela] = (acumulado[g.tela] || 0) + g.cantidad;
    });

    const ordenado = Object.entries(acumulado).sort((a, b) => b[1] - a[1]);
    const top3 = ordenado.slice(0, 3);

    if (top3.length === 0) {
        return {
            tipo: 'bar',
            data: {
                labels: ['Sin datos'],
                datasets: [{ label: 'Metros', data: [0], backgroundColor: '#ccc' }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false }, tooltip: { enabled: false } }
            }
        };
    }

    const labels = top3.map(item => item[0]);
    const datos = top3.map(item => item[1]);
    const colores = top3.map(item => getColorPorTela(item[0]));

    return {
        tipo: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Metros consumidos',
                data: datos,
                backgroundColor: colores,
                borderRadius: 8,
                barPercentage: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            return `${ctx.raw.toFixed(2)} mts`;
                        }
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Metros consumidos' }, grid: { color: '#e9ecef' } },
                x: { title: { display: true, text: 'Tela' }, grid: { display: false } }
            }
        }
    };
}

// ====== GENERADOR DE GRÁFICO CON CAMBIO DE VISTA ======

let chartInstance = null;
let vistaActual = 'hora';

function generarGrafico() {
    const canvasElement = document.getElementById('graficoGastos');
    if (!canvasElement) {
        console.error('❌ No se encontró el canvas');
        return;
    }

    canvasElement.style.height = '350px';
    canvasElement.style.width = '100%';
    const ctx = canvasElement.getContext('2d');

    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    let data = null;

    switch (vistaActual) {
        case 'hora':
            data = prepararDatosHora();
            break;
        case 'dia-semana':
            data = prepararDatosDiaSemana();
            break;
        case 'semana-mes':
            data = prepararDatosSemanaMes();
            break;
        case 'dia-mes':
            data = prepararDatosDiaMes();
            break;
        case 'top3':
            data = prepararDatosTop3();
            break;
        default:
            data = prepararDatosHora();
    }

    if (vistaActual === 'top3' && data.data.labels.length > 0 && data.data.labels[0] !== 'Sin datos') {
        data.options = data.options || {};
        data.options.plugins = data.options.plugins || {};
        data.options.plugins.afterDraw = (chart) => {
            const { ctx, data, chartArea: { top, bottom, left, right } } = chart;
            const meta = chart.getDatasetMeta(0);
            meta.data.forEach((bar, index) => {
                const value = data.datasets[0].data[index];
                const x = bar.x;
                const y = bar.y - 8;
                ctx.fillStyle = '#333';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`${value.toFixed(0)} mts`, x, y);
            });
        };
    }

    chartInstance = new Chart(ctx, {
        type: data.tipo || 'bar',
        data: data.data,
        options: data.options
    });

    console.log(`📊 Gráfico generado con vista: ${vistaActual}`);
}

// ====== ACTUALIZAR UI ======

function actualizarUI() {
    actualizarSelect();
    actualizarTablaStock();
    actualizarTablaGastos();
    actualizarResumenBonito();
    actualizarHistorialCompleto();
    setTimeout(() => {
        generarGrafico();
    }, 100);
}

// ====== BÚSQUEDA DE TELAS ======

document.getElementById('buscadorTela').addEventListener('input', function() {
    const termino = this.value.toLowerCase().trim();
    const filas = document.querySelectorAll('#cuerpoTablaStock tr');
    
    filas.forEach(fila => {
        const nombreTela = fila.querySelector('td:first-child')?.textContent?.toLowerCase() || '';
        if (nombreTela.includes(termino)) {
            fila.style.display = '';
        } else {
            fila.style.display = 'none';
        }
    });
});

// ====== EDITAR NOMBRE DE TELA ======

document.getElementById('btnEditarNombreTela').addEventListener('click', function() {
    const telas = Object.keys(inventario);
    if (telas.length === 0) {
        mostrarNotificacion('error', 'No hay telas para editar.');
        return;
    }
    
    const telaAntigua = prompt('¿Qué tela quieres renombrar? (escribe el nombre exacto)');
    if (!telaAntigua) return;
    
    if (!inventario[telaAntigua]) {
        mostrarNotificacion('error', `La tela "${telaAntigua}" no existe.`);
        return;
    }
    
    const nuevoNombreTela = prompt(`Nuevo nombre para "${telaAntigua}":`);
    if (!nuevoNombreTela || nuevoNombreTela.trim() === '') {
        mostrarNotificacion('error', 'El nombre no puede estar vacío.');
        return;
    }
    
    if (inventario[nuevoNombreTela] && nuevoNombreTela !== telaAntigua) {
        mostrarNotificacion('error', `Ya existe una tela con el nombre "${nuevoNombreTela}".`);
        return;
    }
    
    const cantidad = inventario[telaAntigua];
    delete inventario[telaAntigua];
    inventario[nuevoNombreTela] = cantidad;
    
    historialMovimientos.forEach(mov => {
        if (mov.tela === telaAntigua) mov.tela = nuevoNombreTela;
    });
    
    gastosSemanalesList.forEach(g => {
        if (g.tela === telaAntigua) g.tela = nuevoNombreTela;
    });
    
    guardarTodo();
    actualizarUI();
    mostrarNotificacion('success', `Tela "${telaAntigua}" renombrada a "${nuevoNombreTela}".`);
});

// ====== GENERADOR DE PDF MULTIPÁGINA ======

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

// ====== EVENTOS ======

document.querySelectorAll('.btn-filtro').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        vistaActual = this.dataset.vista;
        generarGrafico();
    });
});

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

const panels = document.querySelectorAll('.panel');
const optionCards = document.querySelectorAll('.option-card');
optionCards.forEach(card => {
    card.addEventListener('click', () => {
        const target = card.getAttribute('data-panel');
        panels.forEach(p => p.classList.remove('active'));
        document.getElementById(`panel-${target}`).classList.add('active');
        optionCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        if (target === 'estadisticas') {
            setTimeout(() => generarGrafico(), 200);
        }
    });
});

document.querySelector('.option-card[data-panel="movimientos"]').classList.add('active');
document.getElementById('panel-movimientos').classList.add('active');

actualizarUI();