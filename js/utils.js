/**
 * CRACKSGYM ERP — utils.js
 * ------------------------------------------------------------------
 * Funciones utilitarias compartidas por todo el sistema.
 * Sin dependencias de otros archivos del proyecto.
 * ------------------------------------------------------------------
 */

/** Formatea un número como moneda MXN. Ej: 5985 -> "$5,985.00" */
function formatoMoneda(valor) {
  const numero = Number(valor) || 0;
  return numero.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN'
  });
}

/** Formatea una fecha ISO a formato corto legible. Ej: "1 jul 2026" */
function formatoFecha(fechaISO) {
  if (!fechaISO) return '—';
  const fecha = new Date(fechaISO);
  if (isNaN(fecha.getTime())) return String(fechaISO);
  return fecha.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/** Muestra un mensaje de error en un elemento con clase .form-error */
function mostrarError(elemento, mensaje) {
  if (!elemento) return;
  elemento.querySelector('span') ? elemento.querySelector('span').textContent = mensaje : elemento.textContent = mensaje;
  elemento.classList.add('visible');
}

/** Oculta un mensaje de error */
function ocultarError(elemento) {
  if (!elemento) return;
  elemento.classList.remove('visible');
}

/** Debounce simple — útil para buscadores en tablas (etapas futuras) */
function debounce(fn, esperaMs = 300) {
  let temporizador;
  return function (...args) {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => fn.apply(this, args), esperaMs);
  };
}

/**
 * Extrae el monto de un registro de Sheets. Prueba, en orden:
 * "Total" (INGRESOS/EGRESOS), "Monto", "Saldo" (BANCOS), o
 * Cantidad × Precio Unitario como último recurso. Nunca truena
 * si faltan campos — regresa 0.
 */
function extraerMonto(registro) {
  if (registro['Total'] !== undefined && registro['Total'] !== '') {
    return Number(registro['Total']) || 0;
  }
  if (registro['Monto'] !== undefined && registro['Monto'] !== '') {
    return Number(registro['Monto']) || 0;
  }
  if (registro['Saldo'] !== undefined && registro['Saldo'] !== '') {
    return Number(registro['Saldo']) || 0;
  }
  const cantidad = Number(registro['Cantidad']) || 0;
  const precioUnitario = Number(registro['Precio Unitario']) || 0;
  return cantidad * precioUnitario;
}

/** Extrae y parsea el campo Fecha de un registro. Regresa Date o null. */
function extraerFecha(registro) {
  const crudo = registro['Fecha'];
  if (!crudo) return null;
  const fecha = new Date(crudo);
  return isNaN(fecha.getTime()) ? null : fecha;
}

/** Extrae el tipo de gasto (Fijo/Variable) de un registro de EGRESOS. */
function extraerTipo(registro) {
  const tipo = (registro['Tipo'] || '').toString().trim();
  return tipo || 'Sin clasificar';
}

/* ---------------------------------------------------------------------
   Historial de simulaciones — persiste en localStorage (no en Sheets,
   porque son proyecciones hipotéticas, no datos reales del negocio).
   Es por navegador/dispositivo, no compartido entre usuarios.
   --------------------------------------------------------------------- */
const CLAVE_HISTORIAL_SIMULACIONES = 'cracksgym_historial_simulaciones';

function guardarSimulacion(snapshot) {
  const historial = obtenerHistorialSimulaciones();
  historial.unshift({ ...snapshot, fecha: new Date().toISOString() });
  localStorage.setItem(CLAVE_HISTORIAL_SIMULACIONES, JSON.stringify(historial.slice(0, 50)));
  return historial;
}

function obtenerHistorialSimulaciones() {
  try {
    const crudo = localStorage.getItem(CLAVE_HISTORIAL_SIMULACIONES);
    return crudo ? JSON.parse(crudo) : [];
  } catch {
    return [];
  }
}

function borrarHistorialSimulaciones() {
  localStorage.removeItem(CLAVE_HISTORIAL_SIMULACIONES);
}

/* ---------------------------------------------------------------------
   Gastos detallados del Simulador (fijos/variables por concepto) —
   también en localStorage, precargados con tu catálogo real de conceptos.
   Montos en 0 por default: tú los llenas.
   --------------------------------------------------------------------- */
const CLAVE_GASTOS_SIMULADOS = 'cracksgym_gastos_simulados';

const GASTOS_SIMULADOS_DEFAULT = [
  ['Fijo', 'Nómina', 'Gerente'],
  ['Fijo', 'Nómina', 'Subgerente'],
  ['Fijo', 'Nómina', 'Recepción'],
  ['Fijo', 'Nómina', 'Entrenadores de piso'],
  ['Fijo', 'Nómina', 'Personal de limpieza'],
  ['Fijo', 'Nómina', 'Mantenimiento'],
  ['Fijo', 'Instalaciones', 'Renta'],
  ['Fijo', 'Instalaciones', 'Mantenimiento del inmueble'],
  ['Fijo', 'Servicios Administrativos', 'Internet'],
  ['Fijo', 'Servicios Administrativos', 'Telefonía'],
  ['Fijo', 'Tecnología', 'Software'],
  ['Fijo', 'Tecnología', 'CRM'],
  ['Fijo', 'Tecnología', 'Sistema de acceso'],
  ['Fijo', 'Tecnología', 'Dominio web'],
  ['Fijo', 'Seguros', 'Seguro del inmueble'],
  ['Fijo', 'Seguros', 'Seguro de responsabilidad civil'],
  ['Fijo', 'Seguros', 'Seguro de equipos'],
  ['Variable', 'Servicios', 'Agua'],
  ['Variable', 'Servicios', 'Luz'],
  ['Variable', 'Servicios', 'Gas'],
  ['Variable', 'Operación', 'Papelería'],
  ['Variable', 'Operación', 'Material de limpieza'],
  ['Variable', 'Operación', 'Consumibles'],
  ['Variable', 'Mantenimiento', 'Preventivo caminadoras'],
  ['Variable', 'Mantenimiento', 'Preventivo bicicletas'],
  ['Variable', 'Mantenimiento', 'Preventivo máquinas'],
  ['Variable', 'Mantenimiento', 'Pintura'],
  ['Variable', 'Mantenimiento', 'Refacciones'],
  ['Variable', 'Marketing', 'Pautas publicitarias'],
  ['Variable', 'Marketing', 'Manejo de redes sociales'],
  ['Variable', 'Ventas', 'Comisión bancaria'],
  ['Variable', 'Ventas', 'Bonos comerciales'],
  ['Variable', 'Impuestos', 'ISR'],
  ['Variable', 'Impuestos', 'IVA trasladado'],
  ['Variable', 'Impuestos', 'IVA acreditable'],
  ['Variable', 'Impuestos', 'Impuesto estatal sobre nómina']
].map(([tipo, categoria, concepto], i) => ({
  id: `default-${i}`, tipo, categoria, concepto, monto: 0
}));

function obtenerGastosSimulados() {
  try {
    const crudo = localStorage.getItem(CLAVE_GASTOS_SIMULADOS);
    if (!crudo) {
      localStorage.setItem(CLAVE_GASTOS_SIMULADOS, JSON.stringify(GASTOS_SIMULADOS_DEFAULT));
      return [...GASTOS_SIMULADOS_DEFAULT];
    }
    return JSON.parse(crudo);
  } catch {
    return [...GASTOS_SIMULADOS_DEFAULT];
  }
}

function guardarGastosSimulados(lista) {
  localStorage.setItem(CLAVE_GASTOS_SIMULADOS, JSON.stringify(lista));
}

/* ---------------------------------------------------------------------
   Parámetros actuales del Simulador — se guardan solos al cambiar
   cualquier input, para que NO se reinicien a cero al navegar entre
   páginas o recargar. Antes de este fix, esto causaba que el Simulador
   se viera "roto" (todo en $0.00) cada vez que volvías a entrar.
   --------------------------------------------------------------------- */
const CLAVE_PARAMETROS_SIMULADOR = 'cracksgym_parametros_simulador';

const PARAMETROS_SIMULADOR_DEFAULT = {
  inscritos: 0,
  meta: 500,          // Meta de preventa según Brief Ejecutivo (500 en 2 meses)
  precio: 399,         // Precio preventa domiciliado según Brief Ejecutivo
  pctDomiciliados: 81.3,
  pctComisionDom: 2.5,
  pctComisionNoDom: 3.5
};

function guardarParametrosSimulador(parametros) {
  localStorage.setItem(CLAVE_PARAMETROS_SIMULADOR, JSON.stringify(parametros));
}

function obtenerParametrosSimulador() {
  try {
    const crudo = localStorage.getItem(CLAVE_PARAMETROS_SIMULADOR);
    return crudo ? { ...PARAMETROS_SIMULADOR_DEFAULT, ...JSON.parse(crudo) } : { ...PARAMETROS_SIMULADOR_DEFAULT };
  } catch {
    return { ...PARAMETROS_SIMULADOR_DEFAULT };
  }
}

/* ---------------------------------------------------------------------
   Corrida Financiera — modelo de cohortes mes a mes (preventa + operación),
   para estimar cuándo se recupera la inversión. Vive en localStorage,
   separado de los parámetros del Simulador simple.
   --------------------------------------------------------------------- */
const CLAVE_CORRIDA_FINANCIERA = 'cracksgym_corrida_financiera';

const CORRIDA_DEFAULT = {
  // Cohortes explícitas que ya definiste (mes relativo a apertura = 0)
  cohortesBase: [
    { mes: -2, precio: 399, nuevos: 300 },
    { mes: -1, precio: 499, nuevos: 200 },
    { mes: 0, precio: 599, nuevos: 0 },
    { mes: 1, precio: 599, nuevos: 100 }
  ],
  tasaRenovacion: 70,        // % que renueva mes a mes desde la apertura en adelante
  nuevosConstante: 140,      // calculado para llegar a 1500 en el mes 12, con contrato forzoso en domiciliados
  metaSociosMes12: 1500,
  mesMeta: 12,               // mes contra el que se calibra "nuevos socios/mes" al recalcular
  precioEstandar: 599,       // precio de cohortes nuevas desde el mes 2, y precio post-bloqueo
  bloqueoPrecioMeses: 12,    // meses que se respeta el precio de entrada
  pctDomiciliados: 75,
  pctComisionDom: 2.5,
  pctComisionNoDom: 3.5,
  pctGastosPreventa: 30,     // % de los gastos operativos normales durante meses -2 y -1
  inversionTotal: 10000000,
  horizonteMeses: 36
};

function obtenerCorridaFinanciera() {
  try {
    const crudo = localStorage.getItem(CLAVE_CORRIDA_FINANCIERA);
    return crudo ? { ...CORRIDA_DEFAULT, ...JSON.parse(crudo) } : { ...CORRIDA_DEFAULT };
  } catch {
    return { ...CORRIDA_DEFAULT };
  }
}

function guardarCorridaFinanciera(config) {
  localStorage.setItem(CLAVE_CORRIDA_FINANCIERA, JSON.stringify(config));
}

/** Suma los montos de los registros cuyo mes/año coincide con el indicado. */
function sumarPorMes(registros, anio, mes) {
  return registros.reduce((total, registro) => {
    const fecha = extraerFecha(registro);
    if (fecha && fecha.getFullYear() === anio && fecha.getMonth() === mes) {
      return total + extraerMonto(registro);
    }
    return total;
  }, 0);
}

/**
 * Calcula variación porcentual entre dos periodos.
 * Regresa null cuando el periodo anterior es 0 (no hay base de comparación).
 */
function calcularDelta(actual, anterior) {
  if (!anterior) return null;
  return ((actual - anterior) / Math.abs(anterior)) * 100;
}

/** Nombre corto de mes en español. Ej: mes=0 -> "ene" */
function nombreMesCorto(mes) {
  const nombres = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return nombres[mes];
}

/** Regresa un arreglo de {anio, mes} de los últimos N meses, terminando en el actual */
function obtenerUltimosNMeses(n) {
  const hoy = new Date();
  const meses = [];

  for (let i = n - 1; i >= 0; i--) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({ anio: fecha.getFullYear(), mes: fecha.getMonth() });
  }

  return meses;
}
