/**
 * CRACKSGYM ERP — api.js
 * ------------------------------------------------------------------
 * ÚNICA capa de acceso a datos de todo el sistema.
 * Ningún otro archivo (dashboard.js, finance.js, socios.js, etc.)
 * debe usar fetch() directamente — todos pasan por aquí.
 *
 * Hoy habla con Google Sheets vía Apps Script. El día que migremos a
 * PostgreSQL + API REST propia, solo se reescribe ESTE archivo — la
 * firma de las funciones (nombre y lo que regresan) no cambia, así
 * que el resto del sistema sigue funcionando sin tocarse.
 * ------------------------------------------------------------------
 */

/**
 * Función base de lectura — todas las funciones obtenerX() la usan.
 * @param {string} nombreHoja - nombre exacto de la pestaña en el Sheet
 * @returns {Promise<Array<Object>>} arreglo de registros
 */
async function obtenerHoja(nombreHoja) {
  const url = `${APP_CONFIG.API_URL}?hoja=${encodeURIComponent(nombreHoja)}`;

  const respuesta = await fetch(url);

  if (!respuesta.ok) {
    throw new Error(`Error de red al consultar "${nombreHoja}" (HTTP ${respuesta.status})`);
  }

  const datos = await respuesta.json();

  if (datos.error) {
    throw new Error(datos.error);
  }

  return datos.registros;
}

/**
 * POST genérico para acciones (login, y en el futuro escritura de datos).
 * Usa Content-Type: text/plain a propósito — evita el preflight CORS
 * que Apps Script no maneja bien. El body sigue siendo JSON real.
 */
async function enviarAccion(payload) {
  const respuesta = await fetch(APP_CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });

  if (!respuesta.ok) {
    throw new Error(`Error de red (HTTP ${respuesta.status})`);
  }

  return respuesta.json();
}

/* ---------------------------------------------------------------------
   Funciones específicas por módulo — nombres alineados a tus pestañas
   reales del Sheet. Cada una es solo un atajo sobre obtenerHoja().
   --------------------------------------------------------------------- */

function obtenerIngresos()         { return obtenerHoja('INGRESOS'); }
function obtenerEgresos()          { return obtenerHoja('EGRESOS'); }
function obtenerSocios()           { return obtenerHoja('SOCIOS'); }
function obtenerEmpleados()        { return obtenerHoja('EMPLEADOS'); }
function obtenerInventario()       { return obtenerHoja('INVENTARIO'); }
function obtenerSucursales()       { return obtenerHoja('SUCURSALES'); }
function obtenerBancos()           { return obtenerHoja('BANCOS'); }
function obtenerCategorias()       { return obtenerHoja('CATEGORIAS'); }
function obtenerPresupuesto()      { return obtenerHoja('PRESUPUESTO'); }
function obtenerEstadoResultados() { return obtenerHoja('ESTADORESULTADOS'); }
function obtenerAportaciones()     { return obtenerHoja('APORTACIONES'); }

/**
 * Login — NO usa obtenerHoja(). Pasa por doPost en el servidor, que
 * valida ahí mismo y nunca regresa la contraseña al navegador.
 */
async function iniciarSesionAPI(correo, contrasena) {
  return enviarAccion({ accion: 'login', correo, contrasena });
}
