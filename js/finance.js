/**
 * CRACKSGYM ERP — finance.js
 * ------------------------------------------------------------------
 * Lógica del módulo de Finanzas. Depende de api.js, auth.js, utils.js,
 * charts.js y tabla.js (deben cargarse antes que este archivo).
 * ------------------------------------------------------------------
 */

document.addEventListener('DOMContentLoaded', async () => {
  requerirSesion();
  pintarUsuarioEnSidebar();
  inicializarSidebarMovil();
  await cargarFinanzas();
});

async function cargarFinanzas() {
  const errorBox = document.getElementById('financeError');

  try {
    // Promise.allSettled en vez de Promise.all: si una hoja falla (ej. BANCOS
    // no existe todavía), el resto del módulo sigue funcionando igual.
    const [ingresosR, egresosR, bancosR, presupuestoR, aportacionesR] = await Promise.allSettled([
      obtenerIngresos(),
      obtenerEgresos(),
      obtenerBancos(),
      obtenerPresupuesto(),
      obtenerAportaciones()
    ]);

    const ingresos = ingresosR.status === 'fulfilled' ? ingresosR.value : [];
    const egresos = egresosR.status === 'fulfilled' ? egresosR.value : [];
    const bancos = bancosR.status === 'fulfilled' ? bancosR.value : [];
    const presupuesto = presupuestoR.status === 'fulfilled' ? presupuestoR.value : [];
    const aportaciones = aportacionesR.status === 'fulfilled' ? aportacionesR.value : [];

    renderizarKPIsFinanzas(ingresos, egresos);
    renderizarCaja(bancos, aportaciones, egresos);
    renderizarGraficaAnual(ingresos, egresos);
    renderizarEstadoResultados(egresos);
    renderizarPresupuesto(presupuesto);
    renderizarMovimientos(ingresos, egresos);
    renderizarCapitalAportado(aportaciones, egresos, bancos);
    renderizarResumenHistoricoGastos(egresos, presupuesto);

    // Avisa (sin bloquear el resto del módulo) si alguna hoja específica falló
    const fallidas = [];
    if (ingresosR.status === 'rejected') fallidas.push('INGRESOS');
    if (egresosR.status === 'rejected') fallidas.push('EGRESOS');
    if (bancosR.status === 'rejected') fallidas.push('BANCOS');
    if (presupuestoR.status === 'rejected') fallidas.push('PRESUPUESTO');
    if (aportacionesR.status === 'rejected') fallidas.push('APORTACIONES');
    if (fallidas.length > 0) {
      mostrarError(errorBox, `No se pudo leer: ${fallidas.join(', ')}. El resto del módulo sigue funcionando.`);
    }

  } catch (error) {
    mostrarError(errorBox, `No se pudo cargar Finanzas: ${error.message}`);
    console.error('Error al cargar finanzas:', error);
  }
}

/* ---------------------------------------------------------------------
   KPIs del mes — mismo cálculo que el dashboard ejecutivo, pero con
   una tarjeta adicional de Punto de equilibrio.
   --------------------------------------------------------------------- */
function renderizarKPIsFinanzas(ingresos, egresos) {
  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const mesActual = hoy.getMonth();

  const fechaMesAnterior = new Date(anioActual, mesActual - 1, 1);
  const anioAnterior = fechaMesAnterior.getFullYear();
  const mesAnterior = fechaMesAnterior.getMonth();

  const ingresosMes = sumarPorMes(ingresos, anioActual, mesActual);
  const ingresosMesAnt = sumarPorMes(ingresos, anioAnterior, mesAnterior);
  const egresosMes = sumarPorMes(egresos, anioActual, mesActual);
  const egresosMesAnt = sumarPorMes(egresos, anioAnterior, mesAnterior);

  const utilidadMes = ingresosMes - egresosMes;
  const utilidadMesAnt = ingresosMesAnt - egresosMesAnt;
  const margenMes = ingresosMes > 0 ? (utilidadMes / ingresosMes) * 100 : 0;

  pintarKPI('kpiIngresos', ingresosMes, calcularDelta(ingresosMes, ingresosMesAnt));
  pintarKPI('kpiEgresos', egresosMes, calcularDelta(egresosMes, egresosMesAnt), true);
  pintarKPI('kpiUtilidad', utilidadMes, calcularDelta(utilidadMes, utilidadMesAnt));
  document.getElementById('kpiMargenContexto').textContent = `Margen: ${margenMes.toFixed(1)}%`;

  // Punto de equilibrio simplificado: no distinguimos costos fijos de
  // variables (esa granularidad no está en el Sheet todavía), así que
  // se aproxima como "ingresos necesarios para cubrir el total de egresos
  // del mes". Es una aproximación, no un cálculo de punto de equilibrio
  // en el sentido estricto de costo-volumen-utilidad.
  const alcanzado = egresosMes > 0 ? (ingresosMes / egresosMes) * 100 : (ingresosMes > 0 ? 100 : 0);
  const valorEl = document.getElementById('kpiEquilibrio-valor');
  const deltaEl = document.getElementById('kpiEquilibrio-delta');
  valorEl.textContent = `${Math.min(alcanzado, 999).toFixed(0)}%`;
  valorEl.classList.remove('loading');
  deltaEl.classList.remove('loading');

  if (alcanzado >= 100) {
    deltaEl.textContent = `Superado por ${formatoMoneda(ingresosMes - egresosMes)}`;
    deltaEl.className = 'kpi-delta kpi-delta-up';
  } else {
    deltaEl.textContent = `Faltan ${formatoMoneda(egresosMes - ingresosMes)} para cubrir egresos`;
    deltaEl.className = 'kpi-delta kpi-delta-down';
  }
}

/* ---------------------------------------------------------------------
   Capital aportado por socios — total, desglose por socio, y una
   verificación cruzada contra el saldo real de BANCOS.
   --------------------------------------------------------------------- */
function renderizarCapitalAportado(aportaciones, egresos, bancos) {
  const totalEl = document.getElementById('capitalTotal');
  const checkEl = document.getElementById('capitalVerificacion');
  const contenedor = document.getElementById('capitalDesglose');

  if (aportaciones.length === 0) {
    totalEl.textContent = formatoMoneda(0);
    checkEl.textContent = 'La hoja APORTACIONES todavía no tiene registros.';
    contenedor.innerHTML = '';
    return;
  }

  const totalAportado = aportaciones.reduce((suma, r) => suma + extraerMonto(r), 0);
  totalEl.textContent = formatoMoneda(totalAportado);

  // Desglose por socio
  const porSocio = {};
  aportaciones.forEach((r) => {
    const socio = r['Socio'] || 'Sin especificar';
    porSocio[socio] = (porSocio[socio] || 0) + extraerMonto(r);
  });

  const filas = Object.entries(porSocio)
    .map(([socio, total]) => ({
      socio,
      total,
      porcentaje: totalAportado > 0 ? (total / totalAportado) * 100 : 0
    }))
    .sort((a, b) => b.total - a.total);

  crearTabla({
    contenedorId: 'capitalDesglose',
    columnas: [
      { clave: 'socio', etiqueta: 'Socio' },
      { clave: 'total', etiqueta: 'Aportado', formato: (v) => `<span class="font-mono">${formatoMoneda(v)}</span>` },
      { clave: 'porcentaje', etiqueta: '% del total', formato: (v) => `${v.toFixed(1)}%` }
    ],
    datos: filas,
    placeholderBusqueda: 'Buscar socio…'
  });

  // Verificación cruzada: Aportaciones - Egresos vs. saldo real en BANCOS.
  // No es un cálculo que deba "cuadrar" al centavo (hay redondeos, comisiones,
  // rendimientos bancarios, etc.) — es una señal de alerta si la diferencia es grande.
  const totalEgresos = egresos.reduce((suma, r) => suma + extraerMonto(r), 0);
  const totalBancos = bancos.reduce((suma, r) => suma + extraerMonto(r), 0);
  const teorico = totalAportado - totalEgresos;
  const diferencia = totalBancos - teorico;

  if (bancos.length === 0) {
    checkEl.textContent = 'Tip: cada mes, escribe el saldo real de tu estado de cuenta en BANCOS.Saldo para comparar contra este cálculo automático.';
    checkEl.className = 'kpi-context';
    return;
  }

  const diferenciaAbs = Math.abs(diferencia);
  const porcentajeDiferencia = teorico !== 0 ? (diferenciaAbs / Math.abs(teorico)) * 100 : 0;

  if (diferenciaAbs < 100 || porcentajeDiferencia < 2) {
    checkEl.textContent = `✓ Cuadra con el saldo real (Aportaciones − Egresos ≈ Saldo en BANCOS)`;
    checkEl.className = 'kpi-context text-success';
  } else {
    checkEl.textContent = `⚠ Diferencia de ${formatoMoneda(diferenciaAbs)} vs. saldo real — revisa si falta capturar algún gasto o aportación`;
    checkEl.className = 'kpi-context text-danger';
  }
}

/* ---------------------------------------------------------------------
   Caja — saldo calculado automáticamente: Aportaciones − Egresos.
   Ya no depende de que captures el saldo a mano en BANCOS; se recalcula
   solo cada vez que agregas un gasto o una aportación nueva.
   --------------------------------------------------------------------- */
function renderizarCaja(bancos, aportaciones, egresos) {
  const contenedor = document.getElementById('cajaResumen');
  const totalEl = document.getElementById('cajaTotal');

  const totalAportaciones = aportaciones.reduce((suma, r) => suma + extraerMonto(r), 0);
  const totalEgresos = egresos.reduce((suma, r) => suma + extraerMonto(r), 0);
  const saldoCalculado = totalAportaciones - totalEgresos;

  const nombreBanco = (bancos.length > 0 && bancos[0]['Banco']) ? bancos[0]['Banco'] : 'Cuenta principal';

  totalEl.textContent = formatoMoneda(saldoCalculado);

  contenedor.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <tbody>
          <tr>
            <td>${nombreBanco}</td>
            <td style="text-align:right;" class="font-mono">${formatoMoneda(saldoCalculado)}</td>
          </tr>
          <tr>
            <td class="text-tertiary" style="font-size:var(--text-xs);">Aportaciones totales</td>
            <td style="text-align:right;" class="font-mono text-tertiary">${formatoMoneda(totalAportaciones)}</td>
          </tr>
          <tr>
            <td class="text-tertiary" style="font-size:var(--text-xs);">Egresos totales</td>
            <td style="text-align:right;" class="font-mono text-tertiary">− ${formatoMoneda(totalEgresos)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

/* ---------------------------------------------------------------------
   Gráfica anual — 12 meses de Ingresos vs Egresos
   --------------------------------------------------------------------- */
function renderizarGraficaAnual(ingresos, egresos) {
  const meses = obtenerUltimosNMeses(12);
  const datosIngresos = meses.map(m => sumarPorMes(ingresos, m.anio, m.mes));
  const datosEgresos = meses.map(m => sumarPorMes(egresos, m.anio, m.mes));
  const etiquetas = meses.map(m => nombreMesCorto(m.mes));

  crearGraficaTendencia('graficaAnual', etiquetas, datosIngresos, datosEgresos);
}

/* ---------------------------------------------------------------------
   Estado de resultados simplificado — Egresos agrupados por Categoría
   --------------------------------------------------------------------- */
function renderizarEstadoResultados(egresos) {
  const contenedor = document.getElementById('estadoResultados');

  if (egresos.length === 0) {
    contenedor.innerHTML = '<p class="table-empty">No hay egresos registrados todavía.</p>';
    return;
  }

  const porCategoria = {};
  egresos.forEach((registro) => {
    const categoria = registro['Categoria'] || registro['Categoría'] || 'Sin categoría';
    porCategoria[categoria] = (porCategoria[categoria] || 0) + extraerMonto(registro);
  });

  const totalGeneral = Object.values(porCategoria).reduce((a, b) => a + b, 0);

  const filas = Object.entries(porCategoria)
    .map(([categoria, total]) => ({
      categoria,
      total,
      porcentaje: totalGeneral > 0 ? (total / totalGeneral) * 100 : 0
    }))
    .sort((a, b) => b.total - a.total);

  crearTabla({
    contenedorId: 'estadoResultados',
    columnas: [
      { clave: 'categoria', etiqueta: 'Categoría' },
      { clave: 'total', etiqueta: 'Total', formato: (v) => `<span class="font-mono">${formatoMoneda(v)}</span>` },
      { clave: 'porcentaje', etiqueta: '% del total', formato: (v) => `${v.toFixed(1)}%` }
    ],
    datos: filas,
    placeholderBusqueda: 'Buscar categoría…'
  });
}

/* ---------------------------------------------------------------------
   Presupuesto vs Real — estado honesto si la hoja está vacía
   --------------------------------------------------------------------- */
function renderizarPresupuesto(presupuesto) {
  const contenedor = document.getElementById('presupuestoContenido');

  if (presupuesto.length === 0) {
    contenedor.innerHTML = `
      <div class="table-empty" style="text-align:left; padding: var(--space-6);">
        <p style="margin-bottom: var(--space-3);">La hoja <strong>PRESUPUESTO</strong> todavía no tiene datos capturados.</p>
        <p class="text-tertiary" style="font-size: var(--text-xs);">
          Cuando la llenes, agrega al menos estas columnas para que esta sección pueda calcular
          Presupuesto vs. Real automáticamente: <code>Categoria</code>, <code>Mes</code>,
          <code>MontoPresupuestado</code>. Avísame cuando la tengas lista y termino esta comparación.
        </p>
      </div>
    `;
    return;
  }

  // Si ya hay datos, se muestran tal cual mientras se define el cálculo real
  // de comparación (depende de qué columnas termines usando).
  const columnas = Object.keys(presupuesto[0]).map(clave => ({ clave, etiqueta: clave }));
  crearTabla({
    contenedorId: 'presupuestoContenido',
    columnas,
    datos: presupuesto,
    placeholderBusqueda: 'Buscar…'
  });
}

/* ---------------------------------------------------------------------
   Tabla de movimientos — Ingresos + Egresos combinados, más recientes primero
   --------------------------------------------------------------------- */
function renderizarMovimientos(ingresos, egresos) {
  const movimientos = [
    ...ingresos.map(r => normalizarMovimiento(r, 'Ingreso')),
    ...egresos.map(r => normalizarMovimiento(r, 'Egreso'))
  ].sort((a, b) => (b.fechaOrden || 0) - (a.fechaOrden || 0));

  crearTabla({
    contenedorId: 'tablaMovimientos',
    columnas: [
      { clave: 'fecha', etiqueta: 'Fecha' },
      {
        clave: 'tipo',
        etiqueta: 'Tipo',
        formato: (v) => `<span class="badge ${v === 'Ingreso' ? 'badge-success' : 'badge-danger'}">${v}</span>`
      },
      { clave: 'descripcion', etiqueta: 'Concepto / Categoría' },
      { clave: 'sucursal', etiqueta: 'Sucursal' },
      { clave: 'monto', etiqueta: 'Monto', formato: (v) => `<span class="font-mono">${formatoMoneda(v)}</span>` }
    ],
    datos: movimientos,
    placeholderBusqueda: 'Buscar movimiento…',
    mensajeVacio: 'No hay movimientos registrados todavía.'
  });
}

/** Normaliza un registro de INGRESOS o EGRESOS a una forma común para la tabla combinada */
function normalizarMovimiento(registro, tipo) {
  const fechaObj = extraerFecha(registro);
  return {
    fecha: fechaObj ? formatoFecha(registro['Fecha']) : '—',
    fechaOrden: fechaObj ? fechaObj.getTime() : 0,
    tipo,
    descripcion: registro['Concepto'] || registro['Categoria'] || registro['Categoría'] || '—',
    sucursal: registro['Sucursal'] || '—',
    monto: extraerMonto(registro)
  };
}

/* ---------------------------------------------------------------------
   Resumen histórico de gastos — todo lo capturado desde la constitución
   de la empresa (no solo el mes actual). Aquí viven los KPIs extra,
   las gráficas de dona/barras y el gauge de presupuesto, al estilo del
   dashboard financiero anterior pero con datos 100% reales.
   --------------------------------------------------------------------- */
function renderizarResumenHistoricoGastos(egresos, presupuesto) {
  const contenedorKpis = document.getElementById('historicoKpis');

  if (egresos.length === 0) {
    contenedorKpis.innerHTML = '<p class="table-empty">No hay egresos capturados todavía.</p>';
    return;
  }

  const totalHistorico = egresos.reduce((s, r) => s + extraerMonto(r), 0);
  const gastosFijos = egresos.filter(r => extraerTipo(r) === 'Fijo').reduce((s, r) => s + extraerMonto(r), 0);
  const gastosVariables = egresos.filter(r => extraerTipo(r) === 'Variable').reduce((s, r) => s + extraerMonto(r), 0);
  const sinClasificar = totalHistorico - gastosFijos - gastosVariables;
  const gastoPromedio = totalHistorico / egresos.length;

  const porCategoria = {};
  egresos.forEach((r) => {
    const cat = r['Categoria'] || r['Categoría'] || 'Sin categoría';
    porCategoria[cat] = (porCategoria[cat] || 0) + extraerMonto(r);
  });
  const categoriaTop = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])[0];

  // --- KPI cards ---
  contenedorKpis.innerHTML = `
    <div class="kpi-grid">
      <div class="card kpi-card">
        <span class="kpi-label">Total de gastos (histórico)</span>
        <span class="kpi-value">${formatoMoneda(totalHistorico)}</span>
        <span class="kpi-context">${egresos.length} movimientos registrados</span>
      </div>
      <div class="card kpi-card">
        <span class="kpi-label">Gastos fijos</span>
        <span class="kpi-value">${formatoMoneda(gastosFijos)}</span>
        <span class="kpi-context">${totalHistorico > 0 ? ((gastosFijos / totalHistorico) * 100).toFixed(1) : 0}% del total</span>
      </div>
      <div class="card kpi-card">
        <span class="kpi-label">Gastos variables</span>
        <span class="kpi-value">${formatoMoneda(gastosVariables)}</span>
        <span class="kpi-context">${totalHistorico > 0 ? ((gastosVariables / totalHistorico) * 100).toFixed(1) : 0}% del total</span>
      </div>
      <div class="card kpi-card">
        <span class="kpi-label">Gasto promedio</span>
        <span class="kpi-value">${formatoMoneda(gastoPromedio)}</span>
        <span class="kpi-context">Por movimiento capturado</span>
      </div>
      <div class="card kpi-card">
        <span class="kpi-label">Categoría con más gasto</span>
        <span class="kpi-value" style="font-size: var(--text-lg);">${categoriaTop ? categoriaTop[0] : '—'}</span>
        <span class="kpi-context">${categoriaTop ? formatoMoneda(categoriaTop[1]) : ''}</span>
      </div>
    </div>
    ${sinClasificar > 0 ? `<p class="kpi-context" style="margin-top:-var(--space-4); margin-bottom:var(--space-4);">⚠ ${formatoMoneda(sinClasificar)} en gastos sin columna "Tipo" (Fijo/Variable) — no se cuentan en el desglose de arriba.</p>` : ''}
  `;

  // --- Gráfica de dona: distribución por categoría ---
  const categorias = Object.keys(porCategoria);
  const valoresCategorias = Object.values(porCategoria);
  crearGraficaDona('graficaDonaCategorias', categorias, valoresCategorias);

  // --- Gráfica de barras: Fijos vs Variables ---
  crearGraficaBarrasHorizontales(
    'graficaFijosVariables',
    ['Fijos', 'Variables'],
    [gastosFijos, gastosVariables],
    [CHART_COLORS.categorias[1], CHART_COLORS.categorias[3]]
  );

  // --- Gauge de presupuesto usado (solo si PRESUPUESTO tiene un total capturado) ---
  const totalPresupuesto = presupuesto.reduce((s, r) => s + (Number(r['MontoPresupuestado']) || Number(r['Monto']) || 0), 0);
  const gaugeCard = document.getElementById('gaugePresupuestoCard');

  if (totalPresupuesto > 0) {
    const pctUsado = (totalHistorico / totalPresupuesto) * 100;
    pintarGauge('gaugePresupuesto', pctUsado, `${formatoMoneda(totalHistorico)} de ${formatoMoneda(totalPresupuesto)}`);
    gaugeCard.style.display = '';
  } else {
    gaugeCard.style.display = 'none';
  }

  // --- Historial detallado de gastos (fila por fila, con Tipo) ---
  const filasHistorial = [...egresos]
    .map(r => ({
      fecha: extraerFecha(r) ? formatoFecha(r['Fecha']) : '—',
      fechaOrden: extraerFecha(r) ? extraerFecha(r).getTime() : 0,
      categoria: r['Categoria'] || r['Categoría'] || 'Sin categoría',
      tipo: extraerTipo(r),
      referencia: r['Concepto'] || r['Proveedor'] || r['Observaciones'] || '—',
      monto: extraerMonto(r),
      porcentaje: totalHistorico > 0 ? (extraerMonto(r) / totalHistorico) * 100 : 0
    }))
    .sort((a, b) => b.fechaOrden - a.fechaOrden);

  crearTabla({
    contenedorId: 'historialGastos',
    columnas: [
      { clave: 'fecha', etiqueta: 'Fecha' },
      { clave: 'categoria', etiqueta: 'Categoría' },
      {
        clave: 'tipo',
        etiqueta: 'Tipo',
        formato: (v) => {
          const clase = v === 'Fijo' ? 'badge-accent' : (v === 'Variable' ? 'badge-warning' : 'badge-danger');
          return `<span class="badge ${clase}">${v}</span>`;
        }
      },
      { clave: 'referencia', etiqueta: 'Proveedor / Referencia' },
      { clave: 'monto', etiqueta: 'Monto', formato: (v) => `<span class="font-mono">${formatoMoneda(v)}</span>` },
      { clave: 'porcentaje', etiqueta: '% del total', formato: (v) => `${v.toFixed(1)}%` }
    ],
    datos: filasHistorial,
    placeholderBusqueda: 'Buscar gasto…'
  });
}
