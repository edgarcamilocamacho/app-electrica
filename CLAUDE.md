# CLAUDE.md

Editor y simulador de circuitos de control eléctrico (símbolos IEC, cableado ortogonal, simulación
lógica por eventos discretos). 100 % client-side; se distribuye como imagen de contenedor (nginx).
**V1 completa** — estado vivo en [STATUS.md](STATUS.md).

Idioma: el usuario y la interfaz, en **español**; el código (identificadores, tipos, commits de
código), en inglés salvo los mensajes de commit, que van en español.

## Dónde está cada cosa

| Necesito… | Leer |
|---|---|
| Qué debe hacer el producto | [electrical_control_simulator_spec.md](electrical_control_simulator_spec.md) (base) **+** [docs/DECISIONES.md](docs/DECISIONES.md) (decisiones de producto vigentes, por tema). Ante contradicción **prevalece DECISIONES.md** |
| Qué significa una etiqueta `R2 §6`, `R3 Q3.4` o `I7` | Buscarla en la columna «Origen» de [docs/DECISIONES.md](docs/DECISIONES.md). Las decisiones técnicas están en [PLAN.md](PLAN.md) §2.2 |
| Por qué el diseño es como es | [PLAN.md](PLAN.md) §4–§17 |
| Estado, limitaciones, desviaciones, decisiones abiertas | [STATUS.md](STATUS.md) — **actualizarlo al cerrar cada tanda de trabajo** |
| Mapa del código | [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) |
| Convenciones · glosario · atajos | [docs/CONVENCIONES.md](docs/CONVENCIONES.md) · [docs/GLOSARIO.md](docs/GLOSARIO.md) · [docs/ATAJOS.md](docs/ATAJOS.md) |

No volver a preguntar decisiones ya registradas en DECISIONES.md salvo que aparezca una contradicción
técnica concreta. Una decisión nueva de producto se agrega ahí con su origen; lo que se decida sin
producto se etiqueta `[Técnica]` y se anota en STATUS.md. Única
decisión abierta: proveedor de despliegue (no afecta el código).

## Comandos

```bash
pnpm install          # pnpm 12 (npm i -g pnpm@12.5.1), Node ≥ 22
pnpm dev              # http://localhost:5173
pnpm check            # typecheck + lint + unit/integración — obligatorio antes de commitear
pnpm e2e              # Playwright, Chromium + Firefox (build + preview automáticos)
pnpm e2e:chromium     # más rápido mientras se itera
pnpm exec vitest run tests/unit/topology    # una carpeta
node scripts/docker-smoke.mjs [--e2e] [--upgrade]   # imagen real: cabeceras, E2E, actualización en caliente
docker compose up --build                            # http://localhost:8080
```

Navegadores de E2E: `pnpm exec playwright install chromium firefox`.

## Invariantes que no se pueden romper

1. **Capas.** `src/core` es TypeScript puro: sin React, zustand, DOM, `app/`, `platform/` ni textos de
   UI (devuelve códigos; la UI traduce). Lo garantizan `tsconfig.core.json` (sin `lib: DOM`) y ESLint.
2. **Conectividad explícita, nunca geométrica.** Dos redes se unen solo si comparten un vértice. Las
   conexiones las crean acciones de autoría (`connectAt`, `landFreeTerminals`), nunca la reparación.
3. **La geometría es dato** (vértices `point`/`terminal` + segmentos). Tras **toda** mutación
   topológica corre `canonicalize` dentro de la operación; nunca cambia la partición en redes.
4. **Operaciones puras** `(doc, args, ctx) → EditResult`. `ctx.ids` inyectado (contador en tests).
   El resultado trae el documento aunque sea inválido (vista previa); solo se confirma si `ok`.
5. **Validez = no agregar violaciones** (V1 solapamiento, V2 punto dentro de otra red, V3 puntos
   coincidentes de redes distintas, V5 diagonal), comparadas por clave geométrica.
6. **Toda mutación del documento pasa por el historial** (`commitDoc` en la tienda). Un clic de goma =
   una entrada; una acción masiva = una entrada; tipear en un campo se coalesce.
7. **Simulación determinista**: el motor nunca lee el reloj; `advanceTo(t)` lo empuja la UI (o el test).
   Las cargas sensan y no conducen; tres cortos (fase-fase, fase-neutro, fase A–neutro B); una carga
   enciende solo con fase y neutro de la misma fuente; los timers no agendan dentro de `settle`.
8. **ERROR congela todo** y solo se sale con «Volver a editar» (ni `E` ni Detener lo abandonan).

## Pruebas

- Cada cambio lleva pruebas en el nivel que corresponda: `tests/unit` (núcleo, sin DOM),
  `tests/integration` (tienda en jsdom, `tests/integration/helpers.ts`), `tests/e2e`.
- Helpers útiles: `tests/fixtures/builder.ts` (documentos a mano), `scenarios.ts` / `circuits.ts`
  (circuitos armados con las operaciones reales), `invariants.ts` (`normalFormViolations`),
  `queries.ts` (`spans`, `sameNet`, `expectValid`).
- E2E sin `sleep`. La app con `?e2e=1` expone `window.__e2e` (`advance(ms)`, `resetView()`,
  `worldToScreen`, `documentJson`, `loadJson`). `openApp()` deja zoom 100 %: usar coordenadas de
  mundo dentro de ±40 o el clic cae fuera del lienzo.
- Commitear **solo si `pnpm check` pasa**: encadenar con `&&`, nunca con `;`.

## Trampas conocidas

- **zustand**: un selector con `useShallow` debe devolver primitivos o referencias estables. Un objeto
  nuevo por lectura (p. ej. `snap(pointer)`) provoca un bucle de render (React #185). Lo mismo para
  props de componentes memoizados: usar constantes (`NO_IDS`), no `?? []`.
- **CSS**: no reutilizar nombres de clase entre el contenedor raíz y componentes. `app--<modo>` es el
  modificador de la raíz; `.mode.mode-<modo>` es el indicador de la barra de estado.
- **Playwright**: una `<line>` SVG vertical u horizontal tiene caja de ancho cero y `toBeVisible()`
  falla; contar elementos o verificar atributos.
- **File System Access**: los selectores nativos no son automatizables; `main.tsx` los tapa en modo
  E2E (están en el prototipo de `Window`: `defineProperty`, no `delete`).
- **Lienzo**: `onPointerDown` hace `preventDefault()` para que el mousedown por defecto no robe el foco
  de un campo recién enfocado (texto de una anotación nueva).
- **Determinismo en tests**: los ids dependen del estado del generador; para comparar dos corridas,
  reconstruir el escenario desde cero en ambas.
- **Shell**: `pkill -f "<patrón>"` puede matar el propio shell si el patrón está en la línea de
  comandos. Matar por PID: `for pid in $(pgrep -f "preview --port N"); do [ "$pid" != "$$" ] && kill $pid; done`.
- **pnpm 12** corta la instalación ante scripts de build no aprobados: `core-js` está denegado en
  `pnpm-workspace.yaml` (`allowBuilds`). Aprobar o denegar con `pnpm approve-builds`.
- **TypeScript fijado en 6.0**: typescript-eslint todavía no soporta TypeScript 7.

## Commits

Un commit por tanda coherente, prefijo del hito o del tema (`M3: …`), en español, con la línea
`Co-Authored-By` que indique el entorno. Repo git local, sin remoto.
