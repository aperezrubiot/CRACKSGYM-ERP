/**
 * CRACKSGYM ERP — corrida.js
 * ------------------------------------------------------------------
 * Motor de la Corrida Financiera: modelo de cohortes mes a mes
 * (preventa + operación) para estimar cuándo se recupera la inversión.
 *
 * SIMPLIFICADO: en vez de una "Meta de socios" y un "Mes objetivo"
 * arbitrarios que había que adivinar, el tope real ahora es la
 * CAPACIDAD FÍSICA del gimnasio (m² utilizables × clientes por m²).
 * Es un techo duro en el modelo — nunca se admiten más socios de los
 * que el gym físicamente soporta, sin importar qué tan alto pongas
 * "nuevos socios/mes".
 *
 * SIMPLIFICACIÓN DE FACTURACIÓN (avísale al usuario si no cuadra):
 * cada cohorte mantiene su precio de entrada durante sus primeros
 * `bloqueoPrecioMeses` PAGOS mensuales (desde que empezó a pagar en
 * preventa). Después, paga el precio estándar vigente.
 *
 * Depende de utils.js (config), charts.js, tabla.js.
 * ------------------------------------------------------------------
 */

document.addEventListener('DOMContentLoaded', () => {
  inicializarCorrida();
});

function inicializarCorrida() {
  const contenedorCohortes = document.getElementById('corridaCohortesCuerpo');
  if (!contenedorCohortes) return; // esta página no tiene la pestaña de corrida

  cargarConfigEnInputs();
  renderizarTablaCohortesBase();

  document.querySelectorAll('#corridaParametrosForm input, #corridaCapacidadForm input').forEach((input) => {
    input.addEventListener('input', () => {
      guardarConfigDesdeInputs();
      ejecutarCorrida();
    });
  });

  document.getElementById('btnRecalcularNuevosConstante').addEventListener('click', () => {
    const cfg = obtenerCorridaFinanciera();
    cfg.nuevosConstante = calcularNuevosConstanteParaLlenar(cfg);
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
  document.getElementById('corridaPrecioEstandar').value = c.precioEstandar;
  document.getElementById('corridaBloqueoPrecioMeses').value = c.bloqueoPrecioMeses;
  document.getElementById('corridaPctDomiciliados').value = c.pctDomiciliados;
  document.getElementById('corridaPctGastosPreventa').value = c.pctGastosPreventa;
  document.getElementById('corridaInversionTotal').value = c.inversionTotal;
  document.getElementById('corridaHorizonteMeses').value = c.horizonteMeses;
  document.getElementById('corridaAreaRentada').value = c.areaRentada;
  document.getElementById('corridaAreaConstruida').value = c.areaConstruida;
  document.getElementById('corridaDensidad').value = c.densidadClientesM2;
}

function guardarConfigDesdeInputs() {
  const cfg = obtenerCorridaFinanciera();
  cfg.tasaRenovacion = Number(document.getElementById('corridaTasaRenovacion').value) || 0;
  cfg.nuevosConstante = Number(document.getElementById('corridaNuevosConstante').value) || 0;
  cfg.precioEstandar = Number(document.getElementById('corridaPrecioEstandar').value) || 0;
  cfg.bloqueoPrecioMeses = Number(document.getElementById('corridaBloqueoPrecioMeses').value) || 12;
  cfg.pctDomiciliados = Number(document.getElementById('corridaPctDomiciliados').value) || 0;
  cfg.pctGastosPreventa = Number(document.getElementById('corridaPctGastosPreventa').value) || 0;
  cfg.inversionTotal = Number(document.getElementById('corridaInversionTotal').value) || 0;
  cfg.horizonteMeses = Number(document.getElementById('corridaHorizonteMeses').value) || 36;
  cfg.areaRentada = Number(document.getElementById('corridaAreaRentada').value) || 0;
  cfg.areaConstruida = Number(document.getElementById('corridaAreaConstruida').value) || 0;
  cfg.densidadClientesM2 = Number(document.getElementById('corridaDensidad').value) || 0;
  guardarCorridaFinanciera(cfg);
}

/** Capacidad máxima real del gimnasio: (m² rentados + m² construidos) × densidad óptima */
function calcularCapacidadMaxima(cfg) {
  return Math.floor((cfg.areaRentada + cfg.areaConstruida) * cfg.densidadClientesM2);
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
   Motor de cohortes — modelo SECUENCIAL mes a mes con tope de capacidad.
   Cada mes: 1) decae lo que ya estaba activo, 2) intenta admitir a los
   nuevos socios deseados de ese mes, PERO nunca más de lo que quepa en
   la capacidad restante del gimnasio.
   ------------------------------------------------------------------- */
function correrModeloCohortes(cfg) {
  const capacidad = calcularCapacidadMaxima(cfg);
  const meses = [];
  for (let m = -2; m <= cfg.horizonteMeses; m++) meses.push(m);

  const colaBase = cfg.cohortesBase.map(c => ({ ...c }));
  let cohortesActivas = []; // { mesEntrada, precio, dom, noDom }
  let utilidadAcumulada = 0;
  let mesLleno = null;

  const resultados = meses.map((m) => {
    cohortesActivas.forEach((c) => {
      if (m === c.mesEntrada) return;
      const dentroDeContrato = (m - c.mesEntrada) < cfg.bloqueoPrecioMeses;
      c.dom = dentroDeContrato ? c.dom : c.dom * (cfg.tasaRenovacion / 100);
      const retencionNoDom = m >= 1 ? (cfg.tasaRenovacion / 100) : 1;
      c.noDom = c.noDom * retencionNoDom;
    });

    const totalTrasDecay = cohortesActivas.reduce((s, c) => s + c.dom + c.noDom, 0);

    const baseDeEsteMes = colaBase.find(c => c.mes === m);
    const deseados = baseDeEsteMes ? baseDeEsteMes.nuevos : (m >= 2 ? cfg.nuevosConstante : 0);
    const precioEntrada = baseDeEsteMes ? baseDeEsteMes.precio : cfg.precioEstandar;

    const espacioDisponible = Math.max(0, capacidad - totalTrasDecay);
    const admitidos = Math.min(deseados, espacioDisponible);

    if (admitidos > 0) {
      cohortesActivas.push({
        mesEntrada: m,
        precio: precioEntrada,
        dom: admitidos * (cfg.pctDomiciliados / 100),
        noDom: admitidos * (1 - cfg.pctDomiciliados / 100)
      });
    }

    let ingresoBruto = 0, comisiones = 0, totalActivos = 0;
    cohortesActivas.forEach((c) => {
      const activos = c.dom + c.noDom;
      totalActivos += activos;
      if (activos > 0) {
        const dentroDeBloqueo = (m - c.mesEntrada) < cfg.bloqueoPrecioMeses;
        const precio = dentroDeBloqueo ? c.precio : cfg.precioEstandar;
        ingresoBruto += activos * precio;
        comisiones += c.dom * precio * (cfg.pctComisionDom / 100) + c.noDom * precio * (cfg.pctComisionNoDom / 100);
      }
    });

    if (mesLleno === null && totalActivos >= capacidad - 1) mesLleno = m;

    const ingresoNeto = ingresoBruto - comisiones;
    const gastosBase = obtenerGastosOperativosBase();
    const gastosOperativos = m < 0 ? gastosBase * (cfg.pctGastosPreventa / 100) : gastosBase;
    const utilidadMes = ingresoNeto - gastosOperativos;
    utilidadAcumulada += utilidadMes;

    return {
      mes: m, totalActivos: Math.round(totalActivos), nuevosDelMes: Math.round(admitidos),
      capacidad, ingresoBruto, comisiones, ingresoNeto, gastosOperativos, utilidadMes, utilidadAcumulada
    };
  });

  resultados.mesLleno = mesLleno;
  resultados.capacidad = capacidad;
  return resultados;
}

/** Gastos fijos + variables mensuales, tomados de la lista detallada de Punto de equilibrio */
function obtenerGastosOperativosBase() {
  const gastos = obtenerGastosSimulados();
  return gastos.reduce((s, g) => s + (Number(g.monto) || 0), 0);
}

/**
 * Busca por bisección el "nuevos socios/mes" mínimo necesario para llenar
 * la capacidad del gimnasio justo al final del horizonte simulado.
 */
function calcularNuevosConstanteParaLlenar(cfgBase) {
  let lo = 0, hi = 5000;
  const cfg = { ...cfgBase };
  const capacidad = calcularCapacidadMaxima(cfg);

  for (let i = 0; i < 40; i++) {
    const medio = (lo + hi) / 2;
    cfg.nuevosConstante = medio;
    const resultados = correrModeloCohortes(cfg);
    const ultimo = resultados[resultados.length - 1];

    if (ultimo.totalActivos < capacidad - 1) lo = medio;
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

  pintarCapacidad(cfg);
  pintarKPIsCorrida(cfg, resultados);
  pintarGraficaCorrida(cfg, resultados);
  pintarTablaCorrida(resultados);
}

function pintarCapacidad(cfg) {
  const capacidad = calcularCapacidadMaxima(cfg);
  const el = document.getElementById('corridaCapacidadValor');
  if (el) el.textContent = capacidad.toLocaleString('es-MX');
  const contexto = document.getElementById('corridaCapacidadContexto');
  if (contexto) {
    const areaTotal = cfg.areaRentada + cfg.areaConstruida;
    contexto.textContent = `${areaTotal.toLocaleString('es-MX')} m² utilizables × ${cfg.densidadClientesM2} clientes/m²`;
  }
}

function pintarKPIsCorrida(cfg, resultados) {
  const ultimo = resultados[resultados.length - 1];
  const capacidad = resultados.capacidad;

  const kpiFinal = document.getElementById('corridaKpiSociosFinal');
  if (kpiFinal) kpiFinal.textContent = ultimo.totalActivos.toLocaleString('es-MX');

  const pctCapacidad = capacidad > 0 ? (ultimo.totalActivos / capacidad) * 100 : 0;
  const kpiPctCapacidad = document.getElementById('corridaKpiPctCapacidad');
  if (kpiPctCapacidad) kpiPctCapacidad.textContent = `${pctCapacidad.toFixed(1)}%`;

  const kpiMesLleno = document.getElementById('corridaKpiMesLleno');
  if (kpiMesLleno) {
    if (resultados.mesLleno !== null) {
      kpiMesLleno.textContent = etiquetaMes(resultados.mesLleno);
      kpiMesLleno.className = 'kpi-value text-accent';
    } else {
      kpiMesLleno.textContent = 'No se llena en el horizonte';
      kpiMesLleno.className = 'kpi-value text-tertiary';
    }
  }

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
    contextoPayback.textContent = 'Prueba subiendo el horizonte, el ritmo de ventas o la tasa de renovación';
  }

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

  const capacidad = resultados.capacidad;
  crearGraficaLineasComparativas('corridaGraficaSocios', etiquetas, [
    { label: 'Socios activos', data: resultados.map(r => r.totalActivos), color: CHART_COLORS.categorias[1] },
    { label: 'Capacidad máxima', data: resultados.map(() => capacidad), color: CHART_COLORS.danger, dashed: true }
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
