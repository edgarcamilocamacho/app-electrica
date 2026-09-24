# CLAUDE.md

Editor y simulador de circuitos de control eléctrico: **vista gráfica de tablero** (cada aparato con
sus bornes de tornillo y su esquema IEC adentro), cableado ortogonal de borne a borne y simulación
lógica por eventos discretos. La edición y la simulación corren en el navegador; los tableros se
guardan en el servidor (`server/`, Node + SQLite) con guardado automático y un editor a la vez
(ronda R6, [PLAN.md](PLAN.md) §24). Se distribuye como contenedores (nginx + API).

**En refactor (ronda R5).** La versión anterior —esquema IEC con bobinas y contactos sueltos— está
congelada en el tag `classic`; no se mantiene. Plan del refactor: [PLAN.md](PLAN.md) §0.5 y §22.
Estado vivo en [STATUS.md](STATUS.md).

Idioma: el usuario y la interfaz, en **español**; el código (identificadores, tipos, commits de
código), en inglés salvo los mensajes de commit, que van en español.

## Dónde está cada cosa

| Necesito… | Leer |
|---|---|
| Qué debe hacer el producto | [electrical_control_simulator_spec.md](electrical_control_simulator_spec.md) (base) **+** [docs/DECISIONES.md](docs/DECISIONES.md) (decisiones de producto vigentes, por tema). Ante contradicción **prevalece DECISIONES.md** |
| Qué significa una etiqueta `R2 §6`, `R3 Q3.4` o `I7` | Buscarla en la columna «Origen» de [docs/DECISIONES.md](docs/DECISIONES.md). Las decisiones técnicas están en [PLAN.md](PLAN.md) §2.2 |
| Por qué el diseño es como es | [PLAN.md](PLAN.md) §4–§17 y, para la vista de tablero, §22 |
| Estado, limitaciones, desviaciones, decisiones abiertas | [STATUS.md](STATUS.md) — **actualizarlo al cerrar cada tanda de trabajo** |
| Mapa del código | [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) |
| Convenciones · glosario · atajos | [docs/CONVENCIONES.md](docs/CONVENCIONES.md) · [docs/GLOSARIO.md](docs/GLOSARIO.md) · [docs/ATAJOS.md](docs/ATAJOS.md) |

No volver a preguntar decisiones ya registradas en DECISIONES.md salvo que aparezca una contradicción
técnica concreta. Una decisión nueva de producto se agrega ahí con su origen; lo que se decida sin
producto se etiqueta `[Técnica]` y se anota en STATUS.md. No hay
decisiones abiertas: el despliegue es un servidor propio con Docker y acceso por Tailscale (R6 §11).

## Comandos

```bash
pnpm install          # pnpm 12 (npm i -g pnpm@12.5.1), Node ≥ 22
pnpm dev              # http://localhost:5173 — con la API de tableros; base en .data/
pnpm check            # typecheck + lint + unit/integración — obligatorio antes de commitear
pnpm e2e              # Playwright, Chromium + Firefox (build + preview automáticos)
pnpm e2e:chromium     # más rápido mientras se itera
pnpm exec vitest run tests/unit/board       # una carpeta
node scripts/docker-smoke.mjs [--e2e] [--upgrade]   # contenedores reales: cabeceras, API, endurecimiento, persistencia
node scripts/shot.mjs catalogo out.png [REF]         # captura del lienzo para revisar el dibujo a ojo
docker compose up -d --build                         # http://localhost:8080 (web + api, datos en ./datos/)
```

Navegadores de E2E: `pnpm exec playwright install chromium firefox`.

## Invariantes que no se pueden romper

1. **Capas.** `src/core` es TypeScript puro: sin React, zustand, DOM, `app/`, `platform/` ni textos de
   UI (devuelve códigos; la UI traduce). Lo garantizan `tsconfig.core.json` (sin `lib: DOM`) y ESLint.
2. **Conectividad explícita, nunca geométrica.** Dos bornes quedan en la misma red solo si un cable
   los une. Un cable va **de borne a borne**: sin empalmes en el aire, sin derivaciones a mitad de
   cable y sin extremos libres. Cruzarse, solaparse o pasar por encima de un aparato no conecta.
3. **La geometría es dato** (posición y giro del aparato + codos del cable). El giro va en pasos de
   90°: los bornes y el contorno se rotan con `rotateOffset`/`rotateDir`, y los textos se contragiran
   para leerse derechos. Tras **toda** mutación corre la
   normalización de codos dentro de la operación; nunca cambia la partición en redes.
4. **Operaciones puras** `(doc, args, ctx) → EditResult`. `ctx.ids` inyectado (contador en tests).
   El resultado trae el documento aunque sea inválido (vista previa); solo se confirma si `ok`.
5. **Validez = no agregar violaciones** (W1 solapamiento colineal entre redes distintas, W2 cable
   sobre un borne ajeno, W3 codo dentro del tramo de otra red, W4 aparatos superpuestos), comparadas
   por clave geométrica. El cruce perpendicular es válido.
6. **Toda mutación del documento pasa por el historial** (`commitDoc` en la tienda). Un clic de goma =
   una entrada; una acción masiva = una entrada; tipear en un campo se coalesce.
7. **Simulación determinista**: el motor nunca lee el reloj; `advanceTo(t)` lo empuja la UI (o el test).
   Las cargas sensan y no conducen; tres cortos (fase-fase, fase-neutro, fase A–neutro B); una carga
   enciende solo con fase y neutro de la misma acometida (entre dos fases **no** enciende); los
   timers no agendan dentro de `settle`. Los contactos de un aparato los mueve un actuador **del
   mismo aparato**: no hay vínculos por referencia.
8. **ERROR congela todo** y solo se sale con «Volver a editar» (ni `E` ni Detener lo abandonan).

## Pruebas

- Cada cambio lleva pruebas en el nivel que corresponda: `tests/unit/board` (núcleo, sin DOM),
  `tests/integration/board` (tienda en jsdom), `tests/e2e`.
- API de tableros: `tests/unit/cloud` (reglas), `tests/unit/server` (HTTP real en un puerto libre),
  `tests/integration/cloud` (controlador con dos pestañas y reloj falso).
- Helper principal: `tests/fixtures/board.ts` (`BoardBuilder`, `term`). Comparte su generador de ids
  con las operaciones para que no colisionen.
- E2E sin `sleep`. La app con `?e2e=1` expone `window.__e2e` (`advance(ms)`, `resetView()`,
  `worldToScreen`, `documentJson`, `loadJson`, `state()`, `deviceIdByRef`, `cloud()`, `syncNow()`)
  y no avanza el tiempo sola. `openApp()` deja zoom 100 % con el origen cerca de la esquina: usar
  coordenadas de mundo positivas y menores a ~55 en x. `syncNow()` sube, late o consulta ya, sin
  esperar a los relojes del controlador.
- El estado de la simulación se lee en el DOM: cada aparato lleva `data-ref`, `data-energized` y
  `data-actuated`; cada cable, `data-live`.
- Commitear **solo si `pnpm check` pasa**: encadenar con `&&`, nunca con `;`.

## Trampas conocidas

- **zustand**: un selector con `useShallow` debe devolver primitivos o referencias estables. Un objeto
  nuevo por lectura (p. ej. `snap(pointer)`) provoca un bucle de render (React #185). Lo mismo para
  props de componentes memoizados: usar constantes (`NO_IDS`), no `?? []`.
- **CSS**: las clases del tablero llevan el prefijo `tablero__`; no reutilizar nombres entre el
  contenedor raíz y los componentes.
- **Playwright**: una `<line>` SVG vertical u horizontal tiene caja de ancho cero y `toBeVisible()`
  falla; contar elementos o verificar atributos.
- **Backend en E2E**: con `?e2e=1` cada página usa un backend de tableros **en memoria** propio (mismo
  `CloudService` que el servidor), así las pruebas no se pisan. `&backend=server` usa la API real de
  `pnpm preview`, que es **compartida** entre todas las pruebas: crear un tablero con nombre único y
  dejarlo como último abierto (`tests/e2e/shared.spec.ts`). Antes de tocar el lienzo, `waitIdle()`.
- **Ancho del lienzo en E2E**: la barra de tableros le quita ~250 px; con `resetView()` lo visible va
  de x ≈ −10 a 55 y de y ≈ −10 a 70.
- **Circuitos de ejemplo**: `connect()` devuelve el documento aunque la operación sea inválida. Al
  construir un ejemplo hay que revisar `ok` o, como hace `tests/unit/board/examples.test.ts`, exigir
  cero diagnósticos bloqueantes; si no, el ejemplo no se puede simular.
- **Bornes de las bases enchufables**: el orden de las columnas es NA · común · NC, así que en el
  relé de 8 pines los tornillos de arriba van 7, 6, 8, 5 de izquierda a derecha.
- **Determinismo en tests**: los ids dependen del estado del generador; para comparar dos corridas,
  reconstruir el escenario desde cero en ambas.
- **Shell**: `pkill -f "<patrón>"` puede matar el propio shell si el patrón está en la línea de
  comandos. Matar por PID: `for pid in $(pgrep -f "preview --port N"); do [ "$pid" != "$$" ] && kill $pid; done`.
- **pnpm 12** corta la instalación ante scripts de build no aprobados: `core-js` está denegado en
  `pnpm-workspace.yaml` (`allowBuilds`). Aprobar o denegar con `pnpm approve-builds`.
- **TypeScript fijado en 6.0**: typescript-eslint todavía no soporta TypeScript 7.

## Commits

Un commit por tanda coherente, prefijo del hito o del tema (`R5/G3: …`), en español, con la línea
`Co-Authored-By` que indique el entorno. Remoto `origin` en GitHub
(`git@github.com:edgarcamilocamacho/app-electrica.git`); el push (ramas y tags) se hace cuando el
usuario lo pide.
