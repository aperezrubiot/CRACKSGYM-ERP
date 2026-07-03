/**
 * CRACKSGYM ERP — app.js
 * ------------------------------------------------------------------
 * Bootstrap general. Hoy solo inicializa login.html. A partir de la
 * Etapa 3, dashboard.html tendrá su propio bootstrap en dashboard.js
 * (sidebar, header, carga de módulo activo) — app.js se mantiene
 * enfocado únicamente en arranque de página, no en lógica de negocio.
 * ------------------------------------------------------------------
 */

document.addEventListener('DOMContentLoaded', () => {
  const formLogin = document.getElementById('loginForm');
  if (formLogin) {
    inicializarLogin(formLogin);
  }
});

function inicializarLogin(form) {
  const errorBox = document.getElementById('loginError');
  const boton = document.getElementById('loginSubmit');
  const textoOriginalBoton = boton.textContent;

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    ocultarError(errorBox);

    const correo = document.getElementById('email').value.trim();
    const contrasena = document.getElementById('password').value;

    boton.disabled = true;
    boton.textContent = 'Verificando…';

    try {
      const resultado = await iniciarSesion(correo, contrasena);

      if (!resultado.ok) {
        mostrarError(errorBox, resultado.error);
        return;
      }

      window.location.replace('dashboard.html');

    } catch (error) {
      mostrarError(errorBox, 'No se pudo conectar con el servidor. Intenta de nuevo.');
      console.error('Error de login:', error);
    } finally {
      boton.disabled = false;
      boton.textContent = textoOriginalBoton;
    }
  });
}
