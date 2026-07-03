/**
 * CRACKSGYM ERP — dashboard.js
 * ------------------------------------------------------------------
 * Bootstrap y lógica del dashboard ejecutivo. Depende de api.js,
 * auth.js, utils.js, shell.js y charts.js (deben cargarse antes que
 * este archivo).
 * ------------------------------------------------------------------
 */

document.addEventListener('DOMContentLoaded', async () => {
  requerirSesion();
  pintarUsuarioEnSidebar();
  inicializarSidebarMovil();
  await cargarDashboard();
});

/** Carga datos reales y renderiza KPIs + gráfica. Maneja errores de red. */
async function cargarDashboard() {
  const errorBox = document.getElementById('dashboardError');

  try {
    const [ingresos, egresos] = await Promise.all([
      obtenerIngresos(),
      obtenerEgresos()
    ]);

    renderizarKPIs(ingresos, egresos);
    renderizarTendencia(ingresos, egresos);

  } catch (error) {
    mostrarError(errorBox, `No se pudieron cargar los datos: ${error.message}`);
    console.error('Error al cargar dashboard:', error);
  }
}

/** Calcula y pinta las 3 KPI cards: Ingresos, Egresos, Utilidad neta */
function renderizarKPIs(ingresos, egresos) {
  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const mesActual = hoy.getMonth();

  // Mes anterior, con manejo correcto de enero -> diciembre del año pasado
  const fechaMesAnterior = new Date(anioActual, mesActual - 1, 1);
  const anioAnterior = fechaMesAnterior.getFullYear();
  const mesAnterior = fechaMesAnterior.getMonth();

  const ingresosMesActual = sumarPorMes(ingresos, anioActual, mesActual);
  const ingresosMesAnterior = sumarPorMes(ingresos, anioAnterior, mesAnterior);

  const egresosMesActual = sumarPorMes(egresos, anioActual, mesActual);
  const egresosMesAnterior = sumarPorMes(egresos, anioAnterior, mesAnterior);

  const utilidadMesActual = ingresosMesActual - egresosMesActual;
  const utilidadMesAnterior = ingresosMesAnterior - egresosMesAnterior;
  const margenMesActual = ingresosMesActual > 0 ? (utilidadMesActual / ingresosMesActual) * 100 : 0;

  pintarKPI('kpiIngresos', ingresosMesActual, calcularDelta(ingresosMesActual, ingresosMesAnterior));
  pintarKPI('kpiEgresos', egresosMesActual, calcularDelta(egresosMesActual, egresosMesAnterior), true);
  pintarKPI('kpiUtilidad', utilidadMesActual, calcularDelta(utilidadMesActual, utilidadMesAnterior));

  document.getElementById('kpiMargenContexto').textContent = `Margen: ${margenMesActual.toFixed(1)}%`;
}

/** Construye y pinta la gráfica de tendencia de los últimos 6 meses */
function renderizarTendencia(ingresos, egresos) {
  const meses = obtenerUltimosNMeses(6);

  const datosIngresos = meses.map(m => sumarPorMes(ingresos, m.anio, m.mes));
  const datosEgresos = meses.map(m => sumarPorMes(egresos, m.anio, m.mes));
  const etiquetas = meses.map(m => nombreMesCorto(m.mes));

  crearGraficaTendencia('graficaTendencia', etiquetas, datosIngresos, datosEgresos);
}
