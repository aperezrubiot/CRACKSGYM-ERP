/**
 * CRACKSGYM ERP — config.js
 * ------------------------------------------------------------------
 * Configuración global del sistema. Este es el ÚNICO archivo donde
 * debería vivir la URL del backend. Cuando migremos a PostgreSQL,
 * solo se cambia API_URL — nada más en el sistema debe tocarse.
 * ------------------------------------------------------------------
 */
const APP_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbzstFGiMWSgLwTsVEgFXBsP6-k1lKIV0CX-DA3M3JwLQFjOBD1XNjRXNGga73MlZ3lYyA/exec',

  // Duración de la sesión en milisegundos (8 horas)
  SESION_DURACION_MS: 8 * 60 * 60 * 1000,

  // Clave usada en sessionStorage para guardar la sesión activa
  SESION_STORAGE_KEY: 'cracksgym_sesion'
};
