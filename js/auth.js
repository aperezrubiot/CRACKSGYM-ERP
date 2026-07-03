/**
 * CRACKSGYM ERP — auth.js
 * ------------------------------------------------------------------
 * Manejo de sesión y autenticación. Depende de api.js (iniciarSesionAPI)
 * y config.js (APP_CONFIG). Ningún módulo debe leer/escribir
 * sessionStorage directamente — todos pasan por estas funciones.
 * ------------------------------------------------------------------
 */

/**
 * Calcula la ruta relativa hacia la raíz del proyecto según dónde estemos
 * parados. Necesario porque login.html vive en la raíz, pero varias
 * páginas protegidas viven en /pages/. Sin esto, cerrarSesion() o
 * requerirSesion() llamados desde /pages/algo.html intentarían ir a
 * /pages/login.html (404) en vez de /login.html.
 */
function rutaRaiz() {
  return window.location.pathname.includes('/pages/') ? '../' : '';
}

/**
 * Intenta iniciar sesión contra el backend. Si es exitoso, guarda la
 * sesión en sessionStorage con fecha de expiración.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
async function iniciarSesion(correo, contrasena) {
  const resultado = await iniciarSesionAPI(correo, contrasena);

  if (!resultado.ok) {
    return { ok: false, error: resultado.error || 'No se pudo iniciar sesión.' };
  }

  const sesion = {
    usuario: resultado.usuario,
    expira: Date.now() + APP_CONFIG.SESION_DURACION_MS
  };

  sessionStorage.setItem(APP_CONFIG.SESION_STORAGE_KEY, JSON.stringify(sesion));
  return { ok: true };
}

/** Cierra la sesión activa y manda al usuario a login.html */
function cerrarSesion() {
  sessionStorage.removeItem(APP_CONFIG.SESION_STORAGE_KEY);
  window.location.replace(rutaRaiz() + 'login.html');
}

/**
 * Regresa la sesión activa si es válida y no ha expirado, o null.
 * Limpia automáticamente sesiones vencidas.
 */
function obtenerSesion() {
  const crudo = sessionStorage.getItem(APP_CONFIG.SESION_STORAGE_KEY);
  if (!crudo) return null;

  try {
    const sesion = JSON.parse(crudo);
    if (!sesion.expira || Date.now() > sesion.expira) {
      sessionStorage.removeItem(APP_CONFIG.SESION_STORAGE_KEY);
      return null;
    }
    return sesion;
  } catch {
    sessionStorage.removeItem(APP_CONFIG.SESION_STORAGE_KEY);
    return null;
  }
}

/** Atajo booleano */
function sesionValida() {
  return obtenerSesion() !== null;
}

/**
 * Guardia de página — llamar al inicio de cualquier página protegida
 * (dashboard.html, pages/*.html). Si no hay sesión, redirige a login.
 */
function requerirSesion() {
  if (!sesionValida()) {
    window.location.replace(rutaRaiz() + 'login.html');
  }
}
