# Arquitectura

Justificación completa de cada decisión: [PLAN.md](../PLAN.md). Este documento describe **lo que
existe en el código**.

## Capas

```
src/app/        React: lienzo SVG, paneles, herramientas, i18n, tienda (zustand)
   │  despacha operaciones puras, lee estado derivado
   ▼
src/core/       TypeScript puro, sin DOM ni React ni textos de UI
src/platform/   reloj, archivos, almacenamiento, verificación de versión (inyectables)
src/examples/   circuitos de ejemplo construidos con las operaciones del núcleo
```

Garantías automáticas:
- `tsconfig.core.json` compila `src/core` sin `lib: DOM`: usar `window` o `document` es un error de tipos.
- ESLint prohíbe en `src/core` importar React, zustand, `app/` o `platform/`, y usar globals del navegador.
- ESLint prohíbe texto de UI literal en JSX (`local/no-literal-ui-text`): todo pasa por `t()`.

## Núcleo (`src/core`)

| Módulo | Qué hace |
|---|---|
| `model/` | Tipos del documento, geometría entera, ids inyectables, referencias (`K1`, `K1.1`), selección |
| `registry/` | Catálogo V1: terminales, caja, comportamiento y propiedades de cada tipo |
| `topology/canonicalize.ts` | Forma normal del grafo de cableado (5 pasos hasta punto fijo), sin cambiar nunca la partición en redes |
| `topology/ops/` | Operaciones puras de edición: colocar, mover selección y tramo, rotar, cablear, borrar, propiedades, anotaciones. Todas devuelven `EditResult` con el documento (vista previa) y las ambigüedades que agregarían |
| `topology/repair.ts` + `candidates.ts` | Reparación ortogonal al mover: cable suelto viaja, tramos alineados se estiran, esquinas se deslizan, si no rutas candidatas filtradas por el validador |
| `topology/validity.ts` + `spatialIndex.ts` | Validador V1/V2/V3/V5 con claves geométricas; una operación es válida si no agrega violaciones |
| `topology/clipboard.ts` | Copiar/pegar con topología interna y renumeración de referencias |
| `topology/classify.ts` | Clase visual de cada vértice (junction, esquina, extremo libre) derivada del grado |
| `connectivity/` | Redes por union-find; índice de vínculos contacto → bobina/timer |
| `diagnostics/` | Avisos y errores bloqueantes (simular exige cero bloqueantes) |
| `persistence/` | JSON versionado (zod), validación de consistencia, migraciones en cadena |
| `history/` | Deshacer/rehacer por snapshots inmutables, con coalescencia por clave |
| `sim/` | Modelo de simulación, `solve` (identidades de fuente y cortos), `settle` (punto fijo y oscilación), cola de eventos de TON/TOF |

### Flujo de una edición

```
gesto del usuario → tienda (app/store) → operación pura del núcleo → EditResult
   ├─ ok        → historial.commit → diagnósticos y clases de vértice recalculados → autoguardado
   └─ inválido  → se muestra como vista previa en rojo con el motivo; nada se confirma
```

### Flujo de la simulación

```
Simular → diagnósticos sin bloqueantes → new SimEngine(doc) → start() (settle en t = 0)
  requestAnimationFrame → tiempo de simulación = base + (reloj de pared − t0) × velocidad
                        → engine.advanceTo(t) → eventos de timers en orden → settle
  clic / pointer-down / pointer-up → press, release, toggle, setSelector → settle
  corto u oscilación → modo 'error': todo congelado hasta «Volver a editar»
```

## Interfaz (`src/app`)

| Módulo | Qué hace |
|---|---|
| `store/editorStore.ts` | Tienda con fábrica inyectable: máquina de herramientas, vista previa, historial, simulación, archivos, avisos |
| `canvas/Canvas.tsx` | `<svg>` único con pan/zoom, grilla infinita y eventos de puntero |
| `canvas/Diagram.tsx` | Dibujo puro del documento (se reutiliza para exportar) |
| `symbols/Symbols.tsx` | Símbolos IEC en coordenadas locales |
| `input/` | Detección de clics con prioridades (goma R3 Q3.6), teclado, bucle de simulación |
| `panels/` | Biblioteca, propiedades, diagnósticos, panel de ERROR, barra de estado, avisos |
| `toolbar/` | Barra superior, menús y botón de tema |
| `themeMode.ts` · `ThemeProvider.tsx` · `styles.css` · `theme.ts` | Tema claro/oscuro (R4 §5–§6): elección guardada (`public/theme-init.js` la aplica antes del primer pintado), tokens `light-dark()` para la interfaz y paletas clara/oscura del diagrama. El lienzo toma la del tema por `PaletteContext`; la exportación se dibuja fuera del proveedor y sale con la clara |
| `export/exporter.ts` | SVG estático → PNG (canvas 2×) y PDF vectorial (jsPDF + svg2pdf, carga diferida) |
| `i18n/` | Diccionario `es.ts`, `t()` tipada, formato numérico en español |
| `services.ts` | Arma la tienda con dependencias reales, autoguardado y verificador de versión |
| `testHooks.ts` | Ganchos E2E (solo con `?e2e=1`): reloj manual, coordenadas, documento |

## Build, versión y contenedor

- `vite.config.ts` inyecta `__BUILD_ID__` (variable `BUILD_ID`) y emite `dist/version.json`.
- El cliente consulta `version.json` sin caché al abrir, al volver a la pestaña y cada 5 minutos;
  ante un build distinto ofrece recargar (el autoguardado se escribe antes).
- `Dockerfile`: compila con Node 24 y sirve con nginx sin privilegios en el puerto 8080.
- `deploy/nginx.conf`: `no-store` para `/`, `index.html`, `version.json` y `/healthz`; `immutable` para
  `/assets/`; 404 real para assets inexistentes; CSP `default-src 'self'` en todas las rutas.
- `scripts/docker-smoke.mjs`: construye la imagen, verifica cabeceras, corre E2E contra ella
  (`--e2e`) y prueba la actualización en caliente reemplazando el contenedor (`--upgrade`).

## Pruebas

| Nivel | Dónde | Qué |
|---|---|---|
| Unit | `tests/unit` | Núcleo completo sin DOM, incluidas pruebas de propiedades (400 documentos aleatorios), regresión de ruteo (§18.4), estrés de historial (§18.5) y presupuesto de rendimiento |
| Integración | `tests/integration` | Tienda + máquina de herramientas en jsdom |
| E2E | `tests/e2e` | 41 flujos en Chromium y Firefox, también contra el contenedor |
