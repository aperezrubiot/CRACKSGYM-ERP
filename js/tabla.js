/**
 * CRACKSGYM ERP — tabla.js
 * ------------------------------------------------------------------
 * Componente genérico de tabla: búsqueda, ordenamiento por columna,
 * conteo de resultados y estado vacío. Lo usan Socios, Empleados,
 * Inventario y cualquier módulo de listado futuro — ninguno debe
 * construir su propia tabla desde cero.
 *
 * NOTA: este archivo no estaba en la lista original de /js del README,
 * se agregó porque el sistema de tablas es suficientemente grande como
 * para merecer su propio archivo de responsabilidad única, en vez de
 * inflar utils.js. README actualizado para reflejarlo.
 *
 * Uso típico:
 *   crearTabla({
 *     contenedorId: 'tablaSocios',
 *     columnas: [
 *       { clave: 'nombre', etiqueta: 'Nombre' },
 *       { clave: 'estatus', etiqueta: 'Estatus', formato: v => `<span class="badge badge-success">${v}</span>` }
 *     ],
 *     datos: registrosDeSocios
 *   });
 * ------------------------------------------------------------------
 */

function crearTabla(opciones) {
  const {
    contenedorId,
    columnas,
    datos,
    placeholderBusqueda = 'Buscar…',
    mensajeVacio = 'No hay registros para mostrar.'
  } = opciones;

  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) {
    console.error(`crearTabla: no existe un elemento con id "${contenedorId}"`);
    return null;
  }

  let datosActuales = [...datos];
  let columnaOrden = null;
  let direccionOrden = 'asc';
  let filtro = '';

  contenedor.innerHTML = `
    <div class="table-toolbar">
      <input type="text" class="input table-search" id="${contenedorId}-buscar" placeholder="${placeholderBusqueda}">
      <span class="table-count" id="${contenedorId}-conteo"></span>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>${columnas.map(c => `<th data-clave="${c.clave}">${c.etiqueta}</th>`).join('')}</tr>
        </thead>
        <tbody id="${contenedorId}-cuerpo"></tbody>
      </table>
    </div>
  `;

  const inputBuscar = contenedor.querySelector(`#${contenedorId}-buscar`);
  const cuerpo = contenedor.querySelector(`#${contenedorId}-cuerpo`);
  const conteo = contenedor.querySelector(`#${contenedorId}-conteo`);
  const encabezados = contenedor.querySelectorAll('thead th');

  encabezados.forEach((th) => {
    th.addEventListener('click', () => {
      const clave = th.dataset.clave;
      direccionOrden = (columnaOrden === clave && direccionOrden === 'asc') ? 'desc' : 'asc';
      columnaOrden = clave;

      encabezados.forEach((h) => h.classList.remove('sorted-asc', 'sorted-desc'));
      th.classList.add(direccionOrden === 'asc' ? 'sorted-asc' : 'sorted-desc');

      renderizar();
    });
  });

  inputBuscar.addEventListener('input', debounce(() => {
    filtro = inputBuscar.value.trim().toLowerCase();
    renderizar();
  }, 200));

  function filasFiltradas(filas) {
    if (!filtro) return filas;
    return filas.filter((fila) =>
      columnas.some((c) => String(fila[c.clave] ?? '').toLowerCase().includes(filtro))
    );
  }

  function filasOrdenadas(filas) {
    if (!columnaOrden) return filas;

    return [...filas].sort((a, b) => {
      const va = a[columnaOrden];
      const vb = b[columnaOrden];
      const na = Number(va);
      const nb = Number(vb);

      const esNumerico = va !== '' && vb !== '' && !isNaN(na) && !isNaN(nb);
      const comparacion = esNumerico
        ? na - nb
        : String(va ?? '').localeCompare(String(vb ?? ''), 'es');

      return direccionOrden === 'asc' ? comparacion : -comparacion;
    });
  }

  function renderizar() {
    const filas = filasOrdenadas(filasFiltradas(datosActuales));
    conteo.textContent = `${filas.length} de ${datosActuales.length} registros`;

    if (filas.length === 0) {
      cuerpo.innerHTML = `<tr><td colspan="${columnas.length}" class="table-empty">${mensajeVacio}</td></tr>`;
      return;
    }

    cuerpo.innerHTML = filas.map((fila) => `
      <tr>${columnas.map((c) => `<td>${c.formato ? c.formato(fila[c.clave], fila) : (fila[c.clave] ?? '—')}</td>`).join('')}</tr>
    `).join('');
  }

  renderizar();

  // Se regresa una referencia para que el módulo dueño (socios.js, etc.)
  // pueda refrescar la tabla si los datos cambian sin reconstruir todo.
  return {
    actualizarDatos(nuevosDatos) {
      datosActuales = [...nuevosDatos];
      renderizar();
    }
  };
}
