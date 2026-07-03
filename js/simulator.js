/**
 * CRACKSGYM ERP — simulator.js
 * ------------------------------------------------------------------
 * Simulador de escenarios de negocio. A DIFERENCIA del resto del ERP,
 * esta pantalla NO refleja datos reales del Sheet — son proyecciones
 * hipotéticas que tú controlas con los inputs. El historial de
 * simulaciones se guarda en localStorage (por navegador), no en Sheets,
 * precisamente para no mezclar proyecciones con contabilidad real.
 *
 * Depende de api.js, auth.js, utils.js, shell.js, charts.js y tabla.js.
 * ------------------------------------------------------------------
 */

document.addEventListener('DOMContentLoaded', async () => {
  requerirSesion();
  pintarUsuarioEnSidebar();
  inicializarSidebarMovil();
  await inicializarSimulador();
});

async function inicializarSimulador() {
  // Prellena "Inscritos" con el conteo real de SOCIOS si ya existe alguno —
  // así el punto de partida de la simulación no es 100% inventado.
  try {
    const socios = await obtenerSocios();
    if (socios.length > 0) {
      document.getElementById('simInscritos').value = socios.length;
    }
  } catch {
    // Sin bloquear: si SOCIOS no existe todavía, el simulador sigue con el default.
  }

  document.getElementById('btnActualizarSimulacion').addEventListener('click', calcularSimulacion);
  document.getElementById('btnGuardarSimulacion').addEventListener('click', guardarSimulacionActual);
  document.getElementById('btnBorrarHistorial').addEventListener('click', () => {
    if (confirm('¿Borrar todo el historial de simulaciones guardadas en este navegador? No afecta tus datos reales de Sheets.')) {
      borrarHistorialSimulaciones();
      renderizarHistorialSimulaciones();
    }
  });

  inicializarTablaGastosSimulados();
  calcularSimulacion();
  renderizarHistorialSimulaciones();
}

function leerInputsSimulador() {
  return {
    inscritos: Number(document.getElementById('simInscritos').value) || 0,
    meta: Number(document.getElementById('simMeta').value) || 0,
    precio: Number(document.getElementById('simPrecio').value) || 0,
    pctDomiciliados: Math.min(100, Math.max(0, Number(document.getElementById('simPctDomiciliados').value) || 0)),
    pctComisionDom: Number(document.getElementById('simPctComisionDom').value) || 0,
    pctComisionNoDom: Number(document.getElementById('simPctComisionNoDom').value) || 0
  };
}

function calcularSimulacion() {
  const inp = leerInputsSimulador();

  const domiciliados = Math.round(inp.inscritos * (inp.pctDomiciliados / 100));
  const noDomiciliados = inp.inscritos - domiciliados;
  const ingresoBruto = inp.inscritos * inp.precio;

  // Comisión bancaria se cobra en TODAS las transacciones (todo pasa por
  // terminal), pero domiciliados y no domiciliados tienen tasas distintas.
  const comisionesDom = domiciliados * inp.precio * (inp.pctComisionDom / 100);
  const comisionesNoDom = noDomiciliados * inp.precio * (inp.pctComisionNoDom / 100);
  const comisiones = comisionesDom + comisionesNoDom;

  const ingresoNeto = ingresoBruto - comisiones;
  const ticketPromedio = inp.inscritos > 0 ? ingresoBruto / inp.inscritos : 0;
  const cumplimientoMeta = inp.meta > 0 ? (inp.inscritos / inp.meta) * 100 : 0;
  const pctNoDomiciliados = inp.inscritos > 0 ? (noDomiciliados / inp.inscritos) * 100 : 0;

  // Gastos fijos/variables ya NO son un número suelto — se suman desde
  // la lista detallada de conceptos (ver renderizarTablaGastosSimulados).
  const gastosSimulados = obtenerGastosSimulados();
  const gastosFijos = gastosSimulados.filter(g => g.tipo === 'Fijo').reduce((s, g) => s + (Number(g.monto) || 0), 0);
  const gastosVariables = gastosSimulados.filter(g => g.tipo === 'Variable').reduce((s, g) => s + (Number(g.monto) || 0), 0);

  const gastosTotales = gastosFijos + gastosVariables;
  const utilidad = ingresoNeto - gastosTotales;
  const pctEquilibrio = gastosTotales > 0 ? (ingresoNeto / gastosTotales) * 100 : (ingresoNeto > 0 ? 100 : 0);
  const ticketNetoPromedio = inp.inscritos > 0 ? ingresoNeto / inp.inscritos : inp.precio;
  const sociosParaEquilibrio = ticketNetoPromedio > 0 ? Math.ceil(gastosTotales / ticketNetoPromedio) : 0;

  const resultado = {
    ...inp, domiciliados, noDomiciliados, ingresoBruto, comisiones, comisionesDom, comisionesNoDom,
    ingresoNeto, ticketPromedio, cumplimientoMeta, pctNoDomiciliados, gastosFijos, gastosVariables,
    gastosTotales, utilidad, pctEquilibrio, sociosParaEquilibrio
  };

  pintarKPIsSimulador(resultado);
  pintarGraficasSimulador(resultado);
  pintarBarrasProgreso(resultado);
  pintarPuntoEquilibrio(resultado);

  return resultado;
}

function pintarKPIsSimulador(r) {
  document.getElementById('simKpiInscritos').textContent = r.inscritos.toLocaleString('es-MX');
  document.getElementById('simKpiInscritosContexto').textContent = `Meta: ${r.meta.toLocaleString('es-MX')} socios`;

  document.getElementById('simKpiPrecio').textContent = formatoMoneda(r.precio);
  document.getElementById('simKpiBruto').textContent = formatoMoneda(r.ingresoBruto);
  document.getElementById('simKpiNeto').textContent = formatoMoneda(r.ingresoNeto);
  document.getElementById('simKpiNetoContexto').textContent =
    `${r.ingresoBruto > 0 ? ((r.ingresoNeto / r.ingresoBruto) * 100).toFixed(1) : 0}% del bruto`;

  document.getElementById('simKpiComisiones').textContent = formatoMoneda(r.comisiones);
  document.getElementById('simKpiDomiciliados').textContent = r.domiciliados.toLocaleString('es-MX');
  document.getElementById('simKpiNoDomiciliados').textContent = r.noDomiciliados.toLocaleString('es-MX');
  document.getElementById('simKpiTicket').textContent = formatoMoneda(r.ticketPromedio);
}

function pintarGraficasSimulador(r) {
  crearGraficaDona('simGraficaDona', ['Domiciliados', 'No domiciliados'], [r.domiciliados, r.noDomiciliados]);

  crearGraficaBarrasVerticales(
    'simGraficaComposicion',
    ['Ingreso bruto', 'Ingreso neto', 'Comisiones'],
    [r.ingresoBruto, r.ingresoNeto, r.comisiones],
    [CHART_COLORS.categorias[1], CHART_COLORS.verde, CHART_COLORS.danger]
  );

  crearGraficaBarrasHorizontales(
    'simGraficaComparativo',
    ['Inscritos', 'Meta', 'Domiciliados', 'No domiciliados'],
    [r.inscritos, r.meta, r.domiciliados, r.noDomiciliados],
    [CHART_COLORS.categorias[1], CHART_COLORS.categorias[3], CHART_COLORS.verde, CHART_COLORS.danger]
  );

  pintarGauge('simGaugeMeta', r.cumplimientoMeta, `${r.inscritos} de ${r.meta} socios`);
}

function pintarBarrasProgreso(r) {
  pintarBarraProgreso('simBarraDomiciliados', r.pctDomiciliados, `${r.domiciliados} de ${r.inscritos} socios con domiciliación`, CHART_COLORS.verde);
  pintarBarraProgreso('simBarraNoDomiciliados', r.pctNoDomiciliados, `${r.noDomiciliados} de ${r.inscritos} socios sin domiciliación`, CHART_COLORS.danger);

  const pctDomText = document.getElementById('simPctDomText');
  const pctNoDomText = document.getElementById('simPctNoDomText');
  if (pctDomText) pctDomText.textContent = `${r.pctDomiciliados.toFixed(1)}%`;
  if (pctNoDomText) pctNoDomText.textContent = `${r.pctNoDomiciliados.toFixed(1)}%`;
}

/** Dibuja una barra de progreso simple (no gauge) dentro de un contenedor */
function pintarBarraProgreso(contenedorId, porcentaje, contexto, color) {
  const el = document.getElementById(contenedorId);
  if (!el) return;
  const pct = Math.min(100, Math.max(0, porcentaje));
  el.innerHTML = `
    <div class="progress-track">
      <div class="progress-fill" style="width:${pct}%; background:${color};"></div>
    </div>
    <p class="progress-row-context">${contexto}</p>
  `;
}

function pintarPuntoEquilibrio(r) {
  document.getElementById('simKpiGastosTotales').textContent = formatoMoneda(r.gastosTotales);
  document.getElementById('simKpiUtilidadProyectada').textContent = formatoMoneda(r.utilidad);
  document.getElementById('simKpiUtilidadProyectada').className =
    'kpi-value ' + (r.utilidad >= 0 ? 'text-success' : 'text-danger');
  document.getElementById('simKpiSociosEquilibrio').textContent = r.sociosParaEquilibrio.toLocaleString('es-MX');

  pintarGauge('simGaugeEquilibrio', r.pctEquilibrio, `${formatoMoneda(r.ingresoNeto)} de ${formatoMoneda(r.gastosTotales)}`);
}

/* ---------------------------------------------------------------------
   Tabla editable de gastos detallados (dentro del <details> colapsable)
   --------------------------------------------------------------------- */
function renderizarTablaGastosSimulados() {
  const gastos = obtenerGastosSimulados();
  const filtro = (document.getElementById('simGastosFiltro')?.value || '').trim().toLowerCase();
  const cuerpo = document.getElementById('simGastosCuerpo');
  const conteo = document.getElementById('simGastosConteo');

  const visibles = filtro
    ? gastos.filter(g => `${g.categoria} ${g.concepto}`.toLowerCase().includes(filtro))
    : gastos;

  conteo.textContent = `${visibles.length} de ${gastos.length} conceptos`;

  cuerpo.innerHTML = visibles.map(g => `
    <tr data-id="${g.id}">
      <td><span class="badge ${g.tipo === 'Fijo' ? 'badge-accent' : 'badge-warning'}">${g.tipo}</span></td>
      <td>${g.categoria}</td>
      <td>${g.concepto}${g.categoria === 'Ventas' && g.concepto === 'Comisión bancaria' ? ' <span class="text-tertiary" style="font-size:var(--text-xs);">(ya incluida arriba, deja en $0)</span>' : ''}</td>
      <td><input type="number" class="input sim-gasto-monto" data-id="${g.id}" value="${g.monto}" min="0" style="max-width:150px; height:36px;"></td>
      <td><button class="btn btn-secondary sim-gasto-eliminar" data-id="${g.id}" style="height:32px; padding:0 10px; font-size:11px;">✕</button></td>
    </tr>
  `).join('');

  const totalFijos = gastos.filter(g => g.tipo === 'Fijo').reduce((s, g) => s + (Number(g.monto) || 0), 0);
  const totalVariables = gastos.filter(g => g.tipo === 'Variable').reduce((s, g) => s + (Number(g.monto) || 0), 0);
  document.getElementById('simGastosTotalFijos').textContent = formatoMoneda(totalFijos);
  document.getElementById('simGastosTotalVariables').textContent = formatoMoneda(totalVariables);
}

function inicializarTablaGastosSimulados() {
  renderizarTablaGastosSimulados();

  document.getElementById('simGastosFiltro').addEventListener('input', renderizarTablaGastosSimulados);

  // Delegación de eventos: un solo listener para todos los inputs/botones de la tabla
  document.getElementById('simGastosCuerpo').addEventListener('change', (e) => {
    if (!e.target.classList.contains('sim-gasto-monto')) return;
    const id = e.target.dataset.id;
    const gastos = obtenerGastosSimulados();
    const gasto = gastos.find(g => g.id === id);
    if (gasto) {
      gasto.monto = Number(e.target.value) || 0;
      guardarGastosSimulados(gastos);
      renderizarTablaGastosSimulados();
      calcularSimulacion();
    }
  });

  document.getElementById('simGastosCuerpo').addEventListener('click', (e) => {
    if (!e.target.classList.contains('sim-gasto-eliminar')) return;
    const id = e.target.dataset.id;
    const gastos = obtenerGastosSimulados().filter(g => g.id !== id);
    guardarGastosSimulados(gastos);
    renderizarTablaGastosSimulados();
    calcularSimulacion();
  });

  document.getElementById('btnAgregarGasto').addEventListener('click', () => {
    const tipo = document.getElementById('simNuevoTipo').value;
    const categoria = document.getElementById('simNuevaCategoria').value.trim();
    const concepto = document.getElementById('simNuevoConcepto').value.trim();
    const monto = Number(document.getElementById('simNuevoMonto').value) || 0;

    if (!categoria || !concepto) {
      alert('Escribe al menos categoría y concepto antes de agregar.');
      return;
    }

    const gastos = obtenerGastosSimulados();
    gastos.push({ id: `custom-${Date.now()}`, tipo, categoria, concepto, monto });
    guardarGastosSimulados(gastos);

    document.getElementById('simNuevaCategoria').value = '';
    document.getElementById('simNuevoConcepto').value = '';
    document.getElementById('simNuevoMonto').value = '';

    renderizarTablaGastosSimulados();
    calcularSimulacion();
  });
}

/* ---------------------------------------------------------------------
   Historial de simulaciones (localStorage)
   --------------------------------------------------------------------- */
function guardarSimulacionActual() {
  const r = calcularSimulacion();
  guardarSimulacion(r);
  renderizarHistorialSimulaciones();
}

function renderizarHistorialSimulaciones() {
  const historial = obtenerHistorialSimulaciones();
  const contenedor = document.getElementById('simHistorial');

  if (historial.length === 0) {
    contenedor.innerHTML = '<p class="table-empty">Todavía no has guardado ninguna simulación. Usa el botón "Guardar en historial" de arriba.</p>';
    return;
  }

  const filas = historial.map(h => ({
    fecha: new Date(h.fecha).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    inscritos: h.inscritos,
    precio: formatoMoneda(h.precio),
    domiciliados: h.domiciliados,
    noDomiciliados: h.noDomiciliados,
    ingresoBruto: h.ingresoBruto,
    comisiones: h.comisiones,
    ingresoNeto: h.ingresoNeto
  }));

  crearTabla({
    contenedorId: 'simHistorial',
    columnas: [
      { clave: 'fecha', etiqueta: 'Fecha de simulación' },
      { clave: 'inscritos', etiqueta: 'Inscritos' },
      { clave: 'precio', etiqueta: 'Precio' },
      { clave: 'domiciliados', etiqueta: 'Domiciliados' },
      { clave: 'noDomiciliados', etiqueta: 'No domiciliados' },
      { clave: 'ingresoBruto', etiqueta: 'Ingreso bruto', formato: (v) => `<span class="font-mono">${formatoMoneda(v)}</span>` },
      { clave: 'comisiones', etiqueta: 'Comisión', formato: (v) => `<span class="font-mono text-danger">− ${formatoMoneda(v)}</span>` },
      { clave: 'ingresoNeto', etiqueta: 'Ingreso neto', formato: (v) => `<span class="font-mono text-success">${formatoMoneda(v)}</span>` }
    ],
    datos: filas,
    placeholderBusqueda: 'Buscar en historial…'
  });
}
