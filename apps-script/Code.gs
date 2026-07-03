/**
 * CRACKSGYM ERP — Apps Script Web App
 * ------------------------------------------------------------------
 * Expone la mayoría de las hojas del spreadsheet como un endpoint JSON
 * de solo lectura (GET), usando la primera fila como encabezados.
 *
 * Uso desde el navegador o desde api.js:
 *   GET  https://TU_URL_DE_DESPLIEGUE/exec?hoja=INGRESOS
 *   GET  https://TU_URL_DE_DESPLIEGUE/exec?hoja=SOCIOS
 *   POST https://TU_URL_DE_DESPLIEGUE/exec   (accion=login, ver doPost)
 *
 * SEGURIDAD: la hoja USUARIOS está en la lista negra de doGet — jamás
 * se expone completa vía GET. Login se valida server-side en doPost y
 * solo regresa nombre/correo/rol; la contraseña nunca sale de aquí.
 * ------------------------------------------------------------------
 */

// Hojas que jamás se exponen vía doGet, sin importar mayúsculas/minúsculas.
const HOJAS_PROHIBIDAS = ['USUARIOS'];

function doGet(e) {
  try {
    const nombreHoja = e.parameter.hoja;

    if (!nombreHoja) {
      return respuesta({
        error: 'Falta el parámetro "hoja". Ejemplo: ?hoja=Socios'
      });
    }

    if (HOJAS_PROHIBIDAS.indexOf(nombreHoja.toUpperCase()) !== -1) {
      return respuesta({
        error: 'Acceso no permitido a esta hoja por esta vía.'
      });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(nombreHoja);

    if (!hoja) {
      return respuesta({
        error: 'No existe una hoja llamada "' + nombreHoja + '"'
      });
    }

    const datos = hoja.getDataRange().getValues();

    if (datos.length < 2) {
      return respuesta({ hoja: nombreHoja, registros: [] });
    }

    const encabezados = datos[0];
    const filas = datos.slice(1);

    const registros = filas
      .filter(function (fila) {
        return fila.some(function (celda) { return celda !== ''; });
      })
      .map(function (fila) {
        const obj = {};
        encabezados.forEach(function (encabezado, i) {
          obj[encabezado] = fila[i];
        });
        return obj;
      });

    return respuesta({ hoja: nombreHoja, registros: registros });

  } catch (error) {
    return respuesta({ error: error.message });
  }
}

/**
 * doPost — Acciones de escritura / validación.
 * Por ahora solo maneja "login". Etapas futuras agregarán "crearSocio",
 * "registrarPago", etc. como nuevos "case" dentro del mismo switch.
 *
 * Se envía como POST con Content-Type: text/plain (a propósito, para
 * evitar que el navegador dispare una petición preflight OPTIONS, que
 * Apps Script no maneja bien). El body es JSON de todos modos — se
 * parsea manualmente abajo.
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const accion = body.accion;

    if (accion === 'login') {
      return manejarLogin(body.correo, body.contrasena);
    }

    return respuesta({ error: 'Acción "' + accion + '" no reconocida.' });

  } catch (error) {
    return respuesta({ error: error.message });
  }
}

function manejarLogin(correo, contrasena) {
  if (!correo || !contrasena) {
    return respuesta({ ok: false, error: 'Correo y contraseña son obligatorios.' });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName('USUARIOS');

  if (!hoja) {
    return respuesta({ ok: false, error: 'No existe la hoja USUARIOS. Créala primero.' });
  }

  const datos = hoja.getDataRange().getValues();
  const encabezados = datos[0].map(function (h) { return h.toString().trim().toLowerCase(); });

  const idxCorreo = encabezados.indexOf('correo');
  const idxContrasena = encabezados.indexOf('contrasena') !== -1
    ? encabezados.indexOf('contrasena')
    : encabezados.indexOf('contraseña');
  const idxNombre = encabezados.indexOf('nombre');
  const idxRol = encabezados.indexOf('rol');
  const idxEstatus = encabezados.indexOf('estatus');

  if (idxCorreo === -1 || idxContrasena === -1) {
    return respuesta({
      ok: false,
      error: 'La hoja USUARIOS necesita al menos columnas "correo" y "contrasena".'
    });
  }

  const correoBuscado = correo.toString().trim().toLowerCase();
  const filas = datos.slice(1);

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const correoFila = (fila[idxCorreo] || '').toString().trim().toLowerCase();

    if (correoFila === correoBuscado) {
      const contrasenaFila = (fila[idxContrasena] || '').toString();
      const estatusFila = idxEstatus !== -1 ? (fila[idxEstatus] || '').toString().trim().toLowerCase() : 'activo';

      if (estatusFila !== 'activo') {
        return respuesta({ ok: false, error: 'Este usuario está inactivo.' });
      }

      if (contrasenaFila !== contrasena.toString()) {
        return respuesta({ ok: false, error: 'Correo o contraseña incorrectos.' });
      }

      return respuesta({
        ok: true,
        usuario: {
          nombre: idxNombre !== -1 ? fila[idxNombre] : correoFila,
          correo: fila[idxCorreo],
          rol: idxRol !== -1 ? fila[idxRol] : 'usuario'
        }
      });
    }
  }

  return respuesta({ ok: false, error: 'Correo o contraseña incorrectos.' });
}

function respuesta(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}
