# Arquitectura

Justificación completa de cada decisión: [PLAN.md](../PLAN.md); el refactor a la vista gráfica de
tablero está en su §22. Este documento describe **lo que existe en el código**.

## Capas

```
src/app/        React: lienzo SVG, paneles, herramientas, i18n, tienda (zustand)
   │  despacha operaciones puras, lee estado derivado
   ▼
src/core/       TypeScript puro, sin DOM ni React ni textos de UI
src/platform/   archivos, almacenamiento, reloj y verificación de versión (inyectables)
src/examples/   tableros de ejemplo construidos con las operaciones del núcleo
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

### Flujo de una edición

```
gesto del usuario → tienda (app/board/store) → operación pura del núcleo → BoardEditResult
   ├─ ok        → historial.commit → autoguardado
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
| `board/files.ts` | Guardar, abrir, autoguardado y exportación a PNG, SVG y PDF con fondo blanco |
| `board/hitTest.ts` | Qué hay bajo el cursor: borne → cable → texto → aparato |
| `board/theme.ts` | Paleta de **solo modo claro**: lienzo color hoja, colores de cable y su versión iluminada |
| `board/testHooks.ts` | Ganchos E2E (solo con `?e2e=1`): tiempo manual, coordenadas y documento |
| `i18n/` | Diccionario `es.ts`, `t()` tipada, formato numérico en español |

## Build, versión y contenedor

- `vite.config.ts` inyecta `__BUILD_ID__` (variable `BUILD_ID`) y emite `dist/version.json`.
- El cliente consulta `version.json` sin caché al abrir, al volver a la pestaña y cada 5 minutos;
  ante un build distinto ofrece recargar.
- `Dockerfile`: compila con Node 24 y sirve con nginx sin privilegios en el puerto 8080.
- `deploy/nginx.conf`: `no-store` para `/`, `index.html`, `version.json` y `/healthz`; `immutable` para
  `/assets/`; 404 real para assets inexistentes; CSP `default-src 'self'` en todas las rutas.
- `scripts/docker-smoke.mjs`: construye la imagen, verifica cabeceras, corre E2E contra ella
  (`--e2e`) y prueba la actualización en caliente reemplazando el contenedor (`--upgrade`).

## Pruebas

| Nivel | Dónde | Qué |
|---|---|---|
| Unit | `tests/unit` | Núcleo completo sin DOM: catálogo, geometría del cable, redes, validador, operaciones, diagnósticos, archivo y simulación |
| Integración | `tests/integration/board` | La tienda del editor: colocar, cablear, mover, borrar, historial y simulación |
| E2E | `tests/e2e` | Flujos por la interfaz real en Chromium y Firefox, también contra el contenedor |
