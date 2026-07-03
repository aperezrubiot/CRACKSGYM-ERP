/**
 * CRACKSGYM ERP — charts.js
 * ------------------------------------------------------------------
 * Configuración de gráficas con Chart.js. Centraliza colores y estilo
 * para que todas las gráficas del sistema se vean consistentes sin
 * repetir configuración de tema en cada módulo.
 *
 * Nota: los colores están hardcodeados (no como var(--...)) porque
 * Chart.js dibuja en <canvas>, que no puede leer custom properties
 * de CSS en tiempo de ejecución de forma confiable en todos los casos.
 * Deben mantenerse sincronizados manualmente con los tokens de main.css.
 * ------------------------------------------------------------------
 */

const CHART_COLORS = {
  verde: '#86FF00',
  verdeBrillante: '#9DFF33',
  danger: '#F87171',
  textSecondary: '#9A9AA2',
  grid: 'rgba(255, 255, 255, 0.06)',
  // Paleta para gráficas de categorías (dona / barras horizontales) —
  // ciclo de colores distinguibles entre sí sobre fondo oscuro.
  categorias: [
    '#86FF00', '#0036C5', '#F87171', '#FBBF24',
    '#34D399', '#A78BFA', '#F472B6', '#60A5FA',
    '#FB923C', '#2DD4BF'
  ]
};

/**
 * Crea la gráfica de tendencia Ingresos vs Egresos (últimos N meses).
 * @param {string} canvasId
 * @param {string[]} etiquetas - ej. ["feb", "mar", "abr", ...]
 * @param {number[]} datosIngresos
 * @param {number[]} datosEgresos
 * @returns {Chart} instancia de Chart.js, por si se necesita destruir/actualizar después
 */
function crearGraficaTendencia(canvasId, etiquetas, datosIngresos, datosEgresos) {
  const existente = Chart.getChart(canvasId);
  if (existente) existente.destroy();

  const contexto = document.getElementById(canvasId).getContext('2d');

  return new Chart(contexto, {
    type: 'line',
    data: {
      labels: etiquetas,
      datasets: [
        {
          label: 'Ingresos',
          data: datosIngresos,
          borderColor: CHART_COLORS.verdeBrillante,
          backgroundColor: 'rgba(240, 196, 25, 0.08)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: CHART_COLORS.verdeBrillante,
          tension: 0.35,
          fill: true
        },
        {
          label: 'Egresos',
          data: datosEgresos,
          borderColor: CHART_COLORS.danger,
          backgroundColor: 'rgba(248, 113, 113, 0.06)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: CHART_COLORS.danger,
          tension: 0.35,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            color: CHART_COLORS.textSecondary,
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            font: { family: "'Inter', sans-serif", size: 12 }
          }
        },
        tooltip: {
          backgroundColor: '#141417',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#F5F5F4',
          bodyColor: '#9A9AA2',
          padding: 10,
          callbacks: {
            label: (contexto) => `${contexto.dataset.label}: ${formatoMoneda(contexto.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: CHART_COLORS.textSecondary, font: { family: "'Inter', sans-serif", size: 12 } }
        },
        y: {
          grid: { color: CHART_COLORS.grid },
          ticks: {
            color: CHART_COLORS.textSecondary,
            font: { family: "'Inter', sans-serif", size: 12 },
            callback: (valor) => formatoMoneda(valor).replace('.00', '')
          }
        }
      }
    }
  });
}

/**
 * Crea una gráfica de dona (ej. distribución de gastos por categoría).
 * @param {string} canvasId
 * @param {string[]} etiquetas
 * @param {number[]} valores
 */
function crearGraficaDona(canvasId, etiquetas, valores) {
  const existente = Chart.getChart(canvasId);
  if (existente) existente.destroy();

  const contexto = document.getElementById(canvasId).getContext('2d');
  const colores = etiquetas.map((_, i) => CHART_COLORS.categorias[i % CHART_COLORS.categorias.length]);

  return new Chart(contexto, {
    type: 'doughnut',
    data: {
      labels: etiquetas,
      datasets: [{
        data: valores,
        backgroundColor: colores,
        borderColor: '#141417',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: CHART_COLORS.textSecondary,
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            padding: 12,
            font: { family: "'Inter', sans-serif", size: 11 }
          }
        },
        tooltip: {
          backgroundColor: '#141417',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#F5F5F4',
          bodyColor: '#9A9AA2',
          padding: 10,
          callbacks: {
            label: (contexto) => `${contexto.label}: ${formatoMoneda(contexto.parsed)}`
          }
        }
      }
    }
  });
}

/**
 * Crea una gráfica de barras horizontales (ej. Fijos vs Variables,
 * o egresos por categoría).
 * @param {string} canvasId
 * @param {string[]} etiquetas
 * @param {number[]} valores
 * @param {string[]} [colores] - opcional, uno por barra; si se omite usa CHART_COLORS.categorias
 */
function crearGraficaBarrasHorizontales(canvasId, etiquetas, valores, colores) {
  const existente = Chart.getChart(canvasId);
  if (existente) existente.destroy();

  const contexto = document.getElementById(canvasId).getContext('2d');
  const paleta = colores || etiquetas.map((_, i) => CHART_COLORS.categorias[i % CHART_COLORS.categorias.length]);

  return new Chart(contexto, {
    type: 'bar',
    data: {
      labels: etiquetas,
      datasets: [{
        data: valores,
        backgroundColor: paleta,
        borderRadius: 4,
        maxBarThickness: 28
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#141417',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#F5F5F4',
          bodyColor: '#9A9AA2',
          padding: 10,
          callbacks: {
            label: (contexto) => formatoMoneda(contexto.parsed.x)
          }
        }
      },
      scales: {
        x: {
          grid: { color: CHART_COLORS.grid },
          ticks: {
            color: CHART_COLORS.textSecondary,
            font: { family: "'Inter', sans-serif", size: 11 },
            callback: (valor) => formatoMoneda(valor).replace('.00', '')
          }
        },
        y: {
          grid: { display: false },
          ticks: { color: CHART_COLORS.textSecondary, font: { family: "'Inter', sans-serif", size: 12 } }
        }
      }
    }
  });
}

/**
 * Crea una gráfica de barras verticales (ej. Composición de ingresos:
 * Bruto / Neto / Comisión).
 * @param {string} canvasId
 * @param {string[]} etiquetas
 * @param {number[]} valores
 * @param {string[]} [colores]
 */
function crearGraficaBarrasVerticales(canvasId, etiquetas, valores, colores) {
  const existente = Chart.getChart(canvasId);
  if (existente) existente.destroy();

  const contexto = document.getElementById(canvasId).getContext('2d');
  const paleta = colores || etiquetas.map((_, i) => CHART_COLORS.categorias[i % CHART_COLORS.categorias.length]);

  return new Chart(contexto, {
    type: 'bar',
    data: {
      labels: etiquetas,
      datasets: [{
        data: valores,
        backgroundColor: paleta,
        borderRadius: 6,
        maxBarThickness: 70
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#141417',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#F5F5F4',
          bodyColor: '#9A9AA2',
          padding: 10,
          callbacks: { label: (contexto) => formatoMoneda(contexto.parsed.y) }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: CHART_COLORS.textSecondary, font: { family: "'Inter', sans-serif", size: 12 } }
        },
        y: {
          grid: { color: CHART_COLORS.grid },
          ticks: {
            color: CHART_COLORS.textSecondary,
            font: { family: "'Inter', sans-serif", size: 11 },
            callback: (valor) => formatoMoneda(valor).replace('.00', '')
          }
        }
      }
    }
  });
}

/**
 * Dibuja un gauge (medidor semicircular) en SVG puro — no usa Chart.js,
 * así que no compite por el mismo <canvas> ni depende del CDN.
 * @param {string} contenedorId - un <div>, no un <canvas>
 * @param {number} porcentaje - 0 a 100 (se satura si se pasa de 100)
 * @param {string} etiqueta - texto debajo del número, ej. "Presupuesto usado"
 */
function pintarGauge(contenedorId, porcentaje, etiqueta) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return;

  const pct = Math.max(0, Math.min(porcentaje, 100));
  const color = pct >= 100 ? CHART_COLORS.danger : (pct >= 85 ? '#FBBF24' : CHART_COLORS.verde);

  // Arco semicircular: radio 80, centrado en (100,90), de 180° a 0°
  const radio = 80;
  const cx = 100, cy = 90;
  const circunferencia = Math.PI * radio; // longitud del semicírculo
  const relleno = (pct / 100) * circunferencia;

  contenedor.innerHTML = `
    <svg viewBox="0 0 200 110" style="width:100%; max-width:220px; display:block; margin:0 auto;">
      <path d="M ${cx - radio} ${cy} A ${radio} ${radio} 0 0 1 ${cx + radio} ${cy}"
            fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="16" stroke-linecap="round" />
      <path d="M ${cx - radio} ${cy} A ${radio} ${radio} 0 0 1 ${cx + radio} ${cy}"
            fill="none" stroke="${color}" stroke-width="16" stroke-linecap="round"
            stroke-dasharray="${relleno} ${circunferencia}" />
      <text x="${cx}" y="${cy - 8}" text-anchor="middle" fill="#F5F5F4"
            style="font-family:'JetBrains Mono', monospace; font-size:28px; font-weight:600;">${pct.toFixed(0)}%</text>
    </svg>
    <p class="text-tertiary" style="text-align:center; font-size: var(--text-xs); margin-top: -8px;">${etiqueta || ''}</p>
  `;
}
