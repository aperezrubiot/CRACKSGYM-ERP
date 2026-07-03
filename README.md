# CRACKSGYM ERP

Sistema administrativo modular para CRACKS GYM (Hermosillo, Sonora).

> Frontend 100% estático (HTML5 + CSS3 + JavaScript Vanilla ES6+), desplegado en GitHub Pages,
> con Google Sheets + Apps Script como backend temporal. Diseñado para migrar a PostgreSQL
> sin tocar la capa de presentación.

## Stack

| Capa | Tecnología |
|---|---|
| Estructura | HTML5 semántico |
| Estilos | CSS3 (custom properties, sin frameworks) |
| Lógica | JavaScript ES6+ (módulos, sin frameworks) |
| Gráficas | Chart.js |
| Backend temporal | Google Sheets vía Apps Script (Web App / API REST-like) |
| Backend futuro | PostgreSQL + API REST propia |
| Hosting | GitHub Pages |

## Principio de arquitectura

**Ningún archivo JS contiene datos escritos a mano.** Todo dato viene de `js/api.js`,
que expone funciones (`obtenerIngresos()`, `obtenerSocios()`, etc.) que hoy llaman a
Apps Script y mañana llamarán a una API en PostgreSQL. El resto del sistema nunca
sabe de dónde vienen los datos — solo consume las funciones de `api.js`.

```
UI (dashboard.js, finance.js, ...) → api.js → [Apps Script | API REST futura]
```

Esto significa que cuando migremos el backend, **solo se reescribe api.js**.
Ningún otro archivo debe cambiar.

## Estructura del proyecto

```
CRACKSGYM-ERP/
├── index.html              → Punto de entrada, redirige según sesión
├── login.html               → Pantalla de autenticación
├── dashboard.html            → Dashboard ejecutivo (Etapa 3)
├── README.md
│
├── assets/
│   ├── icons/                → Iconografía SVG del sistema
│   ├── images/                → Imágenes generales
│   └── logo/                  → Logotipo CRACKS GYM (wordmark, isotipo)
│
├── css/
│   ├── main.css               → Design tokens, reset, tipografía, utilidades ✅ Etapa 1
│   ├── sidebar.css            → Estilos del menú lateral (Etapa 3)
│   ├── dashboard.css          → Estilos del dashboard ejecutivo (Etapa 3)
│   ├── forms.css              → Estilos de formularios (Etapa 2)
│   └── tables.css             → Estilos de tablas (Etapa 4)
│
├── js/
│   ├── app.js                  → Bootstrap general de la app (Etapa 2)
│   ├── api.js                  → Capa única de acceso a datos (Etapa 2)
│   ├── auth.js                 → Autenticación y sesión (Etapa 2)
│   ├── dashboard.js            → Lógica del dashboard ejecutivo ✅ Etapa 3
│   ├── shell.js                → Sidebar/KPIs/sub-pestañas compartidos ✅
│   ├── charts.js               → Configuración de gráficas Chart.js ✅ Etapa 3
│   ├── tabla.js                → Motor genérico de tablas (búsqueda/orden) ✅ Etapa 4 — no estaba en la lista original, se agregó por responsabilidad única
│   ├── finance.js              → Lógica del módulo de finanzas ✅ Etapa 5
│   ├── simulator.js            → Simulador de escenarios (proyecciones, no datos reales) ✅
│   ├── corrida.js              → Motor de cohortes mes a mes — corrida financiera / payback ✅ — NUEVO archivo
│   ├── socios.js               → Lógica del módulo de socios (Etapa 6)
│   ├── empleados.js            → Lógica del módulo de empleados (Etapa 7)
│   ├── inventario.js           → Lógica del módulo de inventario (Etapa 8)
│   └── utils.js                → Funciones utilitarias compartidas (Etapa 2)
│
└── pages/
    ├── finanzas.html            → Módulo de finanzas (Etapa 5)
    ├── socios.html              → Módulo de socios (Etapa 6)
    ├── empleados.html           → Módulo de empleados (Etapa 7)
    ├── inventario.html          → Módulo de inventario (Etapa 8)
    ├── sucursales.html          → Módulo de sucursales (Etapa 9)
    └── configuracion.html       → Configuración del sistema (Etapa 10)
```

## Sistema de diseño (resumen)

Definido completo en `css/main.css`. Inspirado en Stripe / Linear / Notion / Apple / Vercel,
adaptado a la identidad de marca de CRACKS GYM (negro mate + acento dorado, ya definida
en el proyecto de fachada — "BREAK YOUR LIMITS").

- **Modo:** oscuro por defecto.
- **Tipografía:** Space Grotesk (display) + Inter (texto) + JetBrains Mono (cifras/datos).
- **Acento de marca:** franja dorada (`--color-gold`), usada como elemento de firma visual
  en headers, logo y estados activos — el mismo lenguaje que la fachada física del gym.
- **Radios, sombras y espaciados:** definidos como tokens en `:root`, nunca hardcodeados
  en componentes individuales.

## Roadmap de etapas

1. ✅ **Arquitectura base** — estructura de carpetas, design system, login visual (esta etapa)
2. Autenticación real (`auth.js`) + capa de datos (`api.js`) + bootstrap (`app.js`)
3. ✅ **Dashboard ejecutivo** — sidebar, header, KPI cards, gráfica de tendencia
4. ✅ **Sistema de tablas reutilizable** — `tabla.js` + `tables.css`, demo en `pages/socios.html`
5. ✅ **Módulo de Finanzas** — KPIs, caja, tendencia anual, estado de resultados, movimientos
6. Módulo de Socios
7. Módulo de Empleados
8. Módulo de Inventario
9. Módulo de Sucursales
10. Configuración del sistema

## Cómo correrlo localmente

No requiere build ni instalación de dependencias. Necesitas un servidor estático simple
porque `fetch()` a Apps Script falla si abres el HTML directo desde el disco (`file://`).

```bash
cd CRACKSGYM-ERP
python3 -m http.server 8000
# abre http://localhost:8000/login.html
```

## Despliegue

GitHub Pages sirve directo desde la raíz del repo o desde `/docs`. No hay paso de build.
