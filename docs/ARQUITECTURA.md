# Arquitectura

Justificación completa de cada decisión: [PLAN.md](../PLAN.md); el refactor a la vista gráfica de
tablero está en su §22. Este documento describe **lo que existe en el código**.

## Capas

```
src/app/        React: lienzo SVG, paneles, herramientas, i18n, tienda (zustand), barra de tableros
   │  despacha operaciones puras, lee estado derivado
   ▼
src/core/       TypeScript puro, sin DOM ni React ni textos de UI
src/platform/   cliente de la API, descargas, almacenamiento, reloj y versión (inyectables)
src/examples/   tableros de ejemplo construidos con las operaciones del núcleo
server/         API de tableros sobre node:http + node:sqlite; usa src/core, nada más
```

Garantías automáticas:
- `tsconfig.core.json` compila `src/core` sin `lib: DOM`: usar `window` o `document` es un error de tipos.
- ESLint prohíbe en `src/core` importar React, zustand, `app/` o `platform/`, y usar globals del navegador.
- ESLint prohíbe texto de UI literal en JSX (`local/no-literal-ui-text`): todo pasa por `t()`.

## Núcleo (`src/core`)

| Módulo | Qué hace |
|---|---|
| `model/` | Tipos base compartidos: punto y rectángulo enteros, geometría ortogonal, ids inyectables |
| `history/` | Deshacer/rehacer por snapshots inmutables, con coalescencia por clave |
| `connectivity/unionFind.ts` | Union-find con compresión de caminos |
| `board/model.ts` | Documento v2: aparatos sin rotación y **cables de dos bornes** con color y calibre |
| `board/registry.ts` · `board/catalog.ts` | Catálogo declarativo: bornes y elementos internos (actuadores, contactos, cargas, fuentes) de cada aparato |
| `board/wireGeometry.ts` | Ruta ortogonal de un cable, normalización de codos, ruteo automático y reacomodo al mover |
| `board/nets.ts` | Redes por union-find sobre los extremos de los cables: un borne se une a otro **solo** si un cable los une |
| `board/validity.ts` | Validador W1–W4 con claves geométricas; una operación es válida si no agrega violaciones |
| `board/ops.ts` | Operaciones puras de edición: colocar, mover, cablear, estilo del cable, mover un tramo, borrar, propiedades y anotaciones. Todas devuelven `BoardEditResult` con el documento (vista previa) |
| `board/diagnostics.ts` | Bloqueantes (W1–W4, cable con borne inexistente) y avisos (etiqueta repetida, sin acometida, aparato sin cables) |
| `board/persistence.ts` | Esquema v2 con zod; un archivo de la versión clásica se rechaza con su propio código |
| `board/sim/model.ts` | Traducción del documento a **elementos**: fuentes (una fase por borne), actuadores, contactos y cargas |
| `board/sim/engine.ts` | `solve` (identidades de fuente y cortos), `settle` (punto fijo y oscilación), cola de eventos de TON/TOF y modo ERROR congelado |
| `cloud/types.ts` · `cloud/protocol.ts` | Contrato de la API de tableros: tipos, códigos de error, límites, rutas y cabeceras |
| `cloud/service.ts` | `CloudService`: nombres únicos, turno de edición con vencimiento, versiones, papelera y límites, sobre un `DocStore` síncrono |
| `cloud/store.ts` · `cloud/memoryApi.ts` | `DocStore` en memoria y `CloudApi` sobre el servicio, para pruebas y E2E |

### Flujo de una edición

```
gesto del usuario → tienda (app/board/store) → operación pura del núcleo → BoardEditResult
   ├─ ok        → historial.commit → el controlador de tableros lo sube (antirrebote)
   └─ inválido  → se muestra como vista previa en rojo; nada se confirma
```

### Flujo de la simulación

```
Simular → cero diagnósticos bloqueantes → new BoardSimEngine(doc) → start() (settle en t = 0)
  requestAnimationFrame → engine.advanceTo(t) → eventos de timers en orden → settle
  pointer-down / pointer-up sobre un aparato → press, release, toggle, setSelector → settle
  corto u oscilación → modo 'error': todo congelado hasta «Volver a editar»
```

## Interfaz (`src/app`)

| Módulo | Qué hace |
|---|---|
| `board/store.ts` | Tienda del editor: herramientas, selección, vista previa, historial, estilo de cable, simulación |
| `board/BoardCanvas.tsx` | `<svg>` único con desplazamiento, zoom, grilla y los gestos de cada herramienta |
| `board/BoardDiagram.tsx` | Dibujo puro del documento (se reutiliza para exportar) |
| `board/art/` | Piezas de dibujo (cuerpo, tornillo, contacto, bobina, piloto, foco) y una función por familia de aparato |
| `board/BoardApp.tsx` · `board/board.css` | Barra, biblioteca, propiedades, diagnósticos, panel de ERROR y barra de estado |
| `board/files.ts` | Exportación a PNG, SVG y PDF con fondo blanco |
| `cloud/controller.ts` | Sincronización con el servidor [R6]: guardado automático, turno de edición (pedir, latir, tomar), consulta de quien mira, copia de lo no guardado, pendientes sin conexión |
| `cloud/FilesSidebar.tsx` · `cloud/DocBar.tsx` | Barra de tableros (lista, buscador, ejemplos, renombrar, clonar, exportar, papelera, apodo) · nombre y estado del guardado, franja de solo lectura con «Editar», avisos |
| `board/hitTest.ts` | Qué hay bajo el cursor: borne → cable → texto → aparato |
| `board/theme.ts` | Paleta de **solo modo claro**: lienzo color hoja, colores de cable y su versión iluminada |
| `board/testHooks.ts` | Ganchos E2E (solo con `?e2e=1`): tiempo manual, coordenadas y documento |
| `i18n/` | Diccionario `es.ts`, `t()` tipada, formato numérico en español |

## Servidor (`server/`)

| Módulo | Qué hace |
|---|---|
| `sqliteStore.ts` | `DocStore` sobre `node:sqlite`: migraciones por `user_version`, índice único parcial de nombres activos, copias con `VACUUM INTO` |
| `http.ts` | API HTTP sin framework: cabecera `X-Simulador`, `Sec-Fetch-Site`, `Origin` y `Content-Type` en escrituras, cuerpo acotado, validación con zod, errores como código |
| `backend.ts` | Arma SQLite + servicio + manejador + mantenimiento (purga de la papelera, copias) |
| `main.ts` | Servidor de producción; `node server.js backup` deja una copia y sale |
| `devPlugin.ts` | Monta la misma API en `pnpm dev` (base en `.data/`) y `pnpm preview` (en memoria) |

`pnpm build:server` empaqueta todo en `dist-server/server.js`, con zod y el núcleo adentro.

## Build, versión y contenedor

- `vite.config.ts` inyecta `__BUILD_ID__` (variable `BUILD_ID`) y emite `dist/version.json`.
- El cliente consulta `version.json` sin caché al abrir, al volver a la pestaña y cada 5 minutos;
  ante un build distinto ofrece recargar.
- `Dockerfile`: una etapa compila cliente y API con Node 24; de ahí salen dos imágenes. `api`: Node
  24 sin npm, un solo `server.js`, usuario `node`, datos en `/data`. `web` (la última, la de
  `docker build .`): nginx sin privilegios en el puerto 8080.
- `compose.yaml`: proyecto fijo `simulador`, datos en la carpeta `datos/` del proyecto montada en
  `/data` (la API corre con `SIMULADOR_UID`, 1000 por defecto), puerto atado a `127.0.0.1`,
  los dos servicios con `read_only`, `cap_drop: ALL`, `no-new-privileges` y límites de memoria y
  procesos; la API solo en la red `fondo` (`internal: true`), sin salida a internet.
- `deploy/nginx.conf`: `no-store` para `/`, `index.html`, `version.json` y `/healthz`; `immutable` para
  `/assets/`; 404 real para assets inexistentes; CSP `default-src 'self'` en todas las rutas. Proxy de
  `/api` a `api:3000` resuelto en cada petición, con límite por IP (30/s, ráfaga 100), cuerpo de hasta
  5 MB y el host original (puerto incluido) para que la API compare el `Origin`.
- `scripts/docker-smoke.mjs`: levanta el compose en un proyecto aparte y verifica cabeceras, la API a
  través de nginx, el endurecimiento y que los tableros sobreviven a recrear los contenedores; con
  `--e2e` corre los E2E contra ellos y con `--upgrade` cambia el build con la página abierta.

## Pruebas

| Nivel | Dónde | Qué |
|---|---|---|
| Unit | `tests/unit` | Núcleo completo sin DOM: catálogo, geometría del cable, redes, validador, operaciones, diagnósticos, archivo, simulación y reglas de los tableros; la API HTTP real en un puerto libre |
| Integración | `tests/integration` | La tienda del editor (colocar, cablear, mover, borrar, historial, simulación) y el controlador de tableros con dos pestañas |
| E2E | `tests/e2e` | Flujos por la interfaz real en Chromium y Firefox, también contra el contenedor |
