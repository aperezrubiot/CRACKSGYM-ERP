/**
 * CRACKSGYM ERP — corrida.js
 * ------------------------------------------------------------------
 * Motor de la Corrida Financiera: modelo de cohortes mes a mes
 * (preventa + operación) para estimar cuándo se recupera la inversión.
 *
 * NUEVO archivo, no estaba en la lista original — es un motor de
 * cálculo con responsabilidad única y suficientemente grande como para
 * no mezclarlo con simulator.js. Documentado en README.
 *
 * SIMPLIFICACIÓN IMPORTANTE (avísale al usuario si el resultado no
 * cuadra con lo que espera): cada cohorte mantiene su precio de
 * entrada durante sus primeros `bloqueoPrecioMeses` PAGOS mensuales
 * (contando desde que empezó a pagar en preventa, no desde la
 * apertura). Después de eso, paga el precio estándar vigente.
 *
 * Depende de utils.js (config), charts.js, tabla.js.
 * ------------------------------------------------------------------
 */

document.addEventListener('DOMContentLoaded', () => {
  inicializarCorrida();
});

function inicializarCorrida() {
  const contenedorCohortes = document.getElementById('corridaCohortesBase');
  if (!contenedorCohortes) return; // esta página no tiene la pestaña de corrida

  cargarConfigEnInputs();
  renderizarTablaCohortesBase();

  document.querySelectorAll('#corridaParametrosForm input').forEach((input) => {
    input.addEventListener('input', () => {
      guardarConfigDesdeInputs();
      ejecutarCorrida();
    });
  });

  document.getElementById('btnRecalcularNuevosConstante').addEventListener('click', () => {
    const cfg = obtenerCorridaFinanciera();
    cfg.nuevosConstante = calcularNuevosConstanteParaMeta(cfg);
    guardarCorridaFinanciera(cfg);
    cargarConfigEnInputs();
    ejecutarCorrida();
  });

  ejecutarCorrida();
}

function cargarConfigEnInputs() {
  const c = obtenerCorridaFinanciera();
  document.getElementById('corridaTasaRenovacion').value = c.tasaRenovacion;
  document.getElementById('corridaNuevosConstante').value = c.nuevosConstante;
  document.getElementById('corridaMetaSociosMes12').value = c.metaSociosMes12;
  document.getElementById('corridaPrecioEstandar').value = c.precioEstandar;
  document.getElementById('corridaBloqueoPrecioMeses').value = c.bloqueoPrecioMeses;
  document.getElementById('corridaPctDomiciliados').value = c.pctDomiciliados;
  document.getElementById('corridaPctGastosPreventa').value = c.pctGastosPreventa;
  document.getElementById('corridaInversionTotal').value = c.inversionTotal;
  document.getElementById('corridaHorizonteMeses').value = c.horizonteMeses;
}

function guardarConfigDesdeInputs() {
  const cfg = obtenerCorridaFinanciera();
  cfg.tasaRenovacion = Number(document.getElementById('corridaTasaRenovacion').value) || 0;
  cfg.nuevosConstante = Number(document.getElementById('corridaNuevosConstante').value) || 0;
  cfg.metaSociosMes12 = Number(document.getElementById('corridaMetaSociosMes12').value) || 0;
  cfg.precioEstandar = Number(document.getElementById('corridaPrecioEstandar').value) || 0;
  cfg.bloqueoPrecioMeses = Number(document.getElementById('corridaBloqueoPrecioMeses').value) || 12;
  cfg.pctDomiciliados = Number(document.getElementById('corridaPctDomiciliados').value) || 0;
  cfg.pctGastosPreventa = Number(document.getElementById('corridaPctGastosPreventa').value) || 0;
  cfg.inversionTotal = Number(document.getElementById('corridaInversionTotal').value) || 0;
  cfg.horizonteMeses = Number(document.getElementById('corridaHorizonteMeses').value) || 36;
  guardarCorridaFinanciera(cfg);
}

/* ---------------------------------------------------------------------
   Tabla editable de cohortes explícitas (los primeros meses que definiste a mano)
   --------------------------------------------------------------------- */
function renderizarTablaCohortesBase() {
  const cfg = obtenerCorridaFinanciera();
  const cuerpo = document.getElementById('corridaCohortesCuerpo');

  cuerpo.innerHTML = cfg.cohortesBase.map((c, idx) => `
    <tr>
      <td>${etiquetaMes(c.mes)}</td>
      <td><input type="number" class="input corrida-cohorte-precio" data-idx="${idx}" value="${c.precio}" style="max-width:120px; height:36px;"></td>
      <td><input type="number" class="input corrida-cohorte-nuevos" data-idx="${idx}" value="${c.nuevos}" style="max-width:120px; height:36px;"></td>
    </tr>
  `).join('');

  cuerpo.querySelectorAll('.corrida-cohorte-precio, .corrida-cohorte-nuevos').forEach((input) => {
    input.addEventListener('change', (e) => {
      const idx = Number(e.target.dataset.idx);
      const config = obtenerCorridaFinanciera();
      const campo = e.target.classList.contains('corrida-cohorte-precio') ? 'precio' : 'nuevos';
      config.cohortesBase[idx][campo] = Number(e.target.value) || 0;
      guardarCorridaFinanciera(config);
      ejecutarCorrida();
    });
  });
}

function etiquetaMes(m) {
  if (m < 0) return `Preventa — mes ${m}`;
  if (m === 0) return 'Apertura (mes 0)';
  return `Mes ${m}`;
}

/* ---------------------------------------------------------------------
   Motor de cohortes
   --------------------------------------------------------------------- */
/**
 * Motor de cohortes. Cada cohorte se divide en domiciliados y no
 * domiciliados, porque se comportan distinto:
 *   - Domiciliados: contrato forzoso — NO cancelan durante los primeros
 *     `bloqueoPrecioMeses` meses (ni churn ni cambio de precio). Después
 *     del contrato, quedan sujetos a la tasa de renovación normal.
 *   - No domiciliados: sin contrato — la tasa de renovación les aplica
 *     desde el primer mes de operación (mes 1 en adelante).
 */
function correrModeloCohortes(cfg) {
  const meses = [];
  for (let m = -2; m <= cfg.horizonteMeses; m++) meses.push(m);

  const cohortes = cfg.cohortesBase.map(c => ({ ...c }));
  for (let m = 2; m <= cfg.horizonteMeses; m++) {
    cohortes.push({ mes: m, precio: cfg.precioEstandar, nuevos: cfg.nuevosConstante });
  }

  const domActivos = cohortes.map(() => ({}));
  const noDomActivos = cohortes.map(() => ({}));

  cohortes.forEach((c, idx) => {
    const nuevosDom = c.nuevos * (cfg.pctDomiciliados / 100);
    const nuevosNoDom = c.nuevos - nuevosDom;

    let previoDom = 0, previoNoDom = 0;

    meses.forEach((m) => {
      if (m < c.mes) { domActivos[idx][m] = 0; noDomActivos[idx][m] = 0; return; }

      if (m === c.mes) {
        domActivos[idx][m] = nuevosDom;
        noDomActivos[idx][m] = nuevosNoDom;
        previoDom = nuevosDom;
        previoNoDom = nuevosNoDom;
        return;
      }

      // Domiciliados: sin churn mientras dure el contrato forzoso
      const dentroDeContrato = (m - c.mes) < cfg.bloqueoPrecioMeses;
      const valorDom = dentroDeContrato ? previoDom : previoDom * (cfg.tasaRenovacion / 100);
      domActivos[idx][m] = valorDom;
      previoDom = valorDom;

      // No domiciliados: churn desde el mes 1 de operación en adelante
      const retencionNoDom = m >= 1 ? (cfg.tasaRenovacion / 100) : 1;
      const valorNoDom = previoNoDom * retencionNoDom;
      noDomActivos[idx][m] = valorNoDom;
      previoNoDom = valorNoDom;
    });
  });

  let utilidadAcumulada = 0;

  return meses.map((m) => {
    let totalActivos = 0, ingresoBruto = 0, comisiones = 0, nuevosDelMes = 0;

    cohortes.forEach((c, idx) => {
      const dom = domActivos[idx][m];
      const noDom = noDomActivos[idx][m];
      const activosCohorte = dom + noDom;
      totalActivos += activosCohorte;
      if (c.mes === m) nuevosDelMes += c.nuevos;

      if (activosCohorte > 0) {
        const dentroDeBloqueo = (m - c.mes) < cfg.bloqueoPrecioMeses;
        const precio = dentroDeBloqueo ? c.precio : cfg.precioEstandar;
        ingresoBruto += activosCohorte * precio;
        comisiones += dom * precio * (cfg.pctComisionDom / 100) + noDom * precio * (cfg.pctComisionNoDom / 100);
      }
    });

    const ingresoNeto = ingresoBruto - comisiones;

    const gastosBase = obtenerGastosOperativosBase();
    const esPreventa = m < 0;
    const gastosOperativos = esPreventa ? gastosBase * (cfg.pctGastosPreventa / 100) : gastosBase;

    const utilidadMes = ingresoNeto - gastosOperativos;
    utilidadAcumulada += utilidadMes;

    return {
      mes: m, totalActivos: Math.round(totalActivos), nuevosDelMes,
      ingresoBruto, comisiones, ingresoNeto, gastosOperativos, utilidadMes, utilidadAcumulada
    };
  });
}

/** Gastos fijos + variables mensuales, tomados de la lista detallada de Punto de equilibrio */
function obtenerGastosOperativosBase() {
  const gastos = obtenerGastosSimulados();
  return gastos.reduce((s, g) => s + (Number(g.monto) || 0), 0);
}

/**
 * Busca por bisección el número constante de nuevos socios/mes (desde el
 * mes 2) que hace que el total de activos en el mes 12 se acerque a la meta.
 */
function calcularNuevosConstanteParaMeta(cfgBase) {
  let lo = 0, hi = 2000;
  const cfg = { ...cfgBase };

  for (let i = 0; i < 40; i++) {
    const medio = (lo + hi) / 2;
    cfg.nuevosConstante = medio;
    const resultados = correrModeloCohortes(cfg);
    const enMes12 = resultados.find(r => r.mes === 12);
    const activosMes12 = enMes12 ? enMes12.totalActivos : 0;

    if (activosMes12 < cfg.metaSociosMes12) lo = medio;
    else hi = medio;
  }

  return Math.round((lo + hi) / 2);
}

/* ---------------------------------------------------------------------
   Render de resultados
   --------------------------------------------------------------------- */
function ejecutarCorrida() {
  const cfg = obtenerCorridaFinanciera();
  const resultados = correrModeloCohortes(cfg);

  pintarKPIsCorrida(cfg, resultados);
  pintarGraficaCorrida(cfg, resultados);
  pintarTablaCorrida(resultados);
}

function pintarKPIsCorrida(cfg, resultados) {
  const enMes12 = resultados.find(r => r.mes === 12);
  document.getElementById('corridaKpiSociosMes12').textContent = enMes12 ? enMes12.totalActivos.toLocaleString('es-MX') : '—';

  const puntoPayback = resultados.find(r => r.utilidadAcumulada >= cfg.inversionTotal);
  const kpiPayback = document.getElementById('corridaKpiPayback');
  const contextoPayback = document.getElementById('corridaKpiPaybackContexto');

  if (puntoPayback) {
    kpiPayback.textContent = etiquetaMes(puntoPayback.mes);
    kpiPayback.className = 'kpi-value text-success';
    const anios = (puntoPayback.mes / 12).toFixed(1);
    contextoPayback.textContent = `≈ ${anios} años desde la apertura`;
  } else {
    kpiPayback.textContent = `No se alcanza en ${cfg.horizonteMeses} meses`;
    kpiPayback.className = 'kpi-value text-danger';
    contextoPayback.textContent = 'Prueba subiendo el horizonte o la tasa de renovación';
  }

  const ultimo = resultados[resultados.length - 1];
  document.getElementById('corridaKpiUtilidadFinal').textContent = formatoMoneda(ultimo.utilidadAcumulada);
  document.getElementById('corridaKpiUtilidadFinal').className =
    'kpi-value ' + (ultimo.utilidadAcumulada >= 0 ? 'text-success' : 'text-danger');
}

function pintarGraficaCorrida(cfg, resultados) {
  const etiquetas = resultados.map(r => etiquetaMes(r.mes));
  const utilidadAcumulada = resultados.map(r => r.utilidadAcumulada);
  const lineaInversion = resultados.map(() => cfg.inversionTotal);

  crearGraficaLineasComparativas('corridaGraficaPayback', etiquetas, [
    { label: 'Utilidad acumulada', data: utilidadAcumulada, color: CHART_COLORS.verde },
    { label: 'Inversión total', data: lineaInversion, color: CHART_COLORS.danger, dashed: true }
  ]);

  crearGraficaLineasComparativas('corridaGraficaSocios', etiquetas, [
    { label: 'Socios activos', data: resultados.map(r => r.totalActivos), color: CHART_COLORS.categorias[1] }
  ]);
}

function pintarTablaCorrida(resultados) {
  const filas = resultados.map(r => ({
    mes: etiquetaMes(r.mes),
    activos: r.totalActivos,
    nuevos: r.nuevosDelMes,
    ingresoBruto: r.ingresoBruto,
    comisiones: r.comisiones,
    ingresoNeto: r.ingresoNeto,
    gastos: r.gastosOperativos,
    utilidadMes: r.utilidadMes,
    utilidadAcumulada: r.utilidadAcumulada
  }));

  crearTabla({
    contenedorId: 'corridaTablaMensual',
    columnas: [
      { clave: 'mes', etiqueta: 'Mes' },
      { clave: 'activos', etiqueta: 'Socios activos' },
      { clave: 'nuevos', etiqueta: 'Nuevos' },
      { clave: 'ingresoBruto', etiqueta: 'Ingreso bruto', formato: (v) => `<span class="font-mono">${formatoMoneda(v)}</span>` },
      { clave: 'comisiones', etiqueta: 'Comisión', formato: (v) => `<span class="font-mono text-danger">− ${formatoMoneda(v)}</span>` },
      { clave: 'ingresoNeto', etiqueta: 'Ingreso neto', formato: (v) => `<span class="font-mono">${formatoMoneda(v)}</span>` },
      { clave: 'gastos', etiqueta: 'Gastos operativos', formato: (v) => `<span class="font-mono text-danger">− ${formatoMoneda(v)}</span>` },
      { clave: 'utilidadMes', etiqueta: 'Utilidad del mes', formato: (v) => `<span class="font-mono ${v >= 0 ? 'text-success' : 'text-danger'}">${formatoMoneda(v)}</span>` },
      { clave: 'utilidadAcumulada', etiqueta: 'Utilidad acumulada', formato: (v) => `<span class="font-mono ${v >= 0 ? 'text-success' : 'text-danger'}">${formatoMoneda(v)}</span>` }
    ],
    datos: filas,
    placeholderBusqueda: 'Buscar mes…'
  });
}
