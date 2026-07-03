/**
 * CRACKSGYM ERP — shell.js
 * ------------------------------------------------------------------
 * Funciones compartidas del "armazón" de la app (sidebar, KPI cards)
 * que usan tanto dashboard.js como finance.js (y los módulos futuros
 * que tengan sidebar). Se separó de dashboard.js porque ya no era
 * lógica exclusiva del dashboard ejecutivo — otra desviación de la
 * lista original de archivos, documentada aquí y en el README.
 * ------------------------------------------------------------------
 */

/** Pinta nombre/rol del usuario activo en el footer del sidebar */
function pintarUsuarioEnSidebar() {
  const sesion = obtenerSesion();
  if (!sesion) return;

  const nombre = sesion.usuario.nombre || sesion.usuario.correo;
  document.getElementById('sidebarUserName').textContent = nombre;
  document.getElementById('sidebarUserRole').textContent = sesion.usuario.rol || 'usuario';
  document.getElementById('sidebarUserAvatar').textContent = nombre.charAt(0).toUpperCase();
}

/** Abre/cierra el sidebar en móvil (bajo 880px) */
function inicializarSidebarMovil() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const boton = document.getElementById('sidebarToggle');

  const abrir = () => { sidebar.classList.add('open'); overlay.classList.add('visible'); };
  const cerrar = () => { sidebar.classList.remove('open'); overlay.classList.remove('visible'); };

  boton.addEventListener('click', abrir);
  overlay.addEventListener('click', cerrar);
}

/**
 * Pinta una card de KPI individual (usado por dashboard.js y finance.js).
 * @param {string} idBase - ej. "kpiIngresos" -> busca #kpiIngresos-valor y #kpiIngresos-delta
 * @param {number} valor
 * @param {number|null} delta - porcentaje, o null si no hay base de comparación
 * @param {boolean} invertirColor - true para Egresos, donde subir es "malo" (rojo)
 */
function pintarKPI(idBase, valor, delta, invertirColor = false) {
  const elementoValor = document.getElementById(`${idBase}-valor`);
  const elementoDelta = document.getElementById(`${idBase}-delta`);

  elementoValor.textContent = formatoMoneda(valor);
  elementoValor.classList.remove('loading');
  elementoDelta.classList.remove('loading');

  if (delta === null) {
    elementoDelta.textContent = 'Sin datos del mes anterior';
    elementoDelta.className = 'kpi-delta kpi-delta-flat';
    return;
  }

  const subio = delta >= 0;
  const esBueno = invertirColor ? !subio : subio;
  const flecha = subio ? '↑' : '↓';

  elementoDelta.textContent = `${flecha} ${Math.abs(delta).toFixed(1)}% vs mes anterior`;
  elementoDelta.className = `kpi-delta ${esBueno ? 'kpi-delta-up' : 'kpi-delta-down'}`;
}

/**
 * Inicializa un grupo de sub-pestañas dentro de una página (Finanzas,
 * Simulador). Espera botones con [data-subtab="clave"] y paneles con
 * [data-subtab-panel="clave"] dentro de un mismo contenedor.
 * @param {string} contenedorId - el <nav> o <div> que envuelve los botones
 */
function inicializarSubtabs(contenedorId) {
  const nav = document.getElementById(contenedorId);
  if (!nav) return;

  const botones = nav.querySelectorAll('[data-subtab]');

  botones.forEach((boton) => {
    boton.addEventListener('click', () => {
      const clave = boton.dataset.subtab;

      botones.forEach((b) => b.classList.remove('active'));
      boton.classList.add('active');

      document.querySelectorAll('[data-subtab-panel]').forEach((panel) => {
        panel.classList.toggle('active', panel.dataset.subtabPanel === clave);
      });

      // Recuerda la última pestaña vista en esta página, por si el usuario recarga
      sessionStorage.setItem(`subtab_${contenedorId}`, clave);
    });
  });

  // Restaura la última pestaña vista, si existe
  const recordada = sessionStorage.getItem(`subtab_${contenedorId}`);
  const botonRecordado = recordada && nav.querySelector(`[data-subtab="${recordada}"]`);
  (botonRecordado || botones[0])?.click();
}
