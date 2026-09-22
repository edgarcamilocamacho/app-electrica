# Simulador de control eléctrico

Editor gráfico de diagramas de control eléctrico (símbolos IEC, cableado ortogonal) con simulación
lógica por eventos discretos. Corre íntegramente en el navegador; el servidor solo entrega archivos
estáticos.

- Especificación: [electrical_control_simulator_spec.md](electrical_control_simulator_spec.md) · decisiones de producto vigentes (prevalecen sobre la spec): [docs/DECISIONES.md](docs/DECISIONES.md)
- Plan de implementación: [PLAN.md](PLAN.md)
- Estado actual: [STATUS.md](STATUS.md)
- Contexto para sesiones de Claude Code: [CLAUDE.md](CLAUDE.md)
- Arquitectura: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) · Convenciones: [docs/CONVENCIONES.md](docs/CONVENCIONES.md) ·
  Glosario: [docs/GLOSARIO.md](docs/GLOSARIO.md) · Atajos: [docs/ATAJOS.md](docs/ATAJOS.md)

## Requisitos

- Node.js ≥ 22 (el contenedor usa Node 24 LTS)
- pnpm 12 (`npm install -g pnpm@12.5.1`)
- Docker, para construir y correr la imagen
- Para las pruebas E2E: navegadores de Playwright (`pnpm exec playwright install chromium firefox`)

## Instalar y ejecutar

```bash
pnpm install
pnpm dev            # servidor de desarrollo en http://localhost:5173
```

## Probar

```bash
pnpm typecheck      # TypeScript por capas (el núcleo compila sin tipos del DOM)
pnpm lint           # ESLint: fronteras de capas + ningún texto de UI literal
pnpm test           # unitarias (núcleo, sin DOM) + integración (jsdom)
pnpm e2e            # E2E con Playwright en Chromium y Firefox
pnpm check          # typecheck + lint + test
```

## Compilar

```bash
pnpm build          # genera dist/ con assets hasheados y version.json
pnpm preview        # sirve dist/ en http://localhost:4173
```

## Contenedor

La app se distribuye como imagen de contenedor: nginx sin privilegios sirviendo `dist/` en el puerto
**8080**. La política de caché viaja dentro de la imagen ([deploy/nginx.conf](deploy/nginx.conf)).

```bash
docker compose up --build                  # http://localhost:8080
# o bien
pnpm docker:build                          # BUILD_ID = hash del commit
docker run --rm -p 8080:8080 simulador-control-electrico
```

Prueba de humo sobre la imagen real (construye, levanta, verifica salud y cabeceras de caché):

```bash
pnpm docker:smoke                         # construye y verifica
node scripts/docker-smoke.mjs --e2e       # además corre los E2E (Chromium) contra el contenedor
node scripts/docker-smoke.mjs --upgrade   # reemplaza el contenedor por otro build con la página
                                          # abierta y verifica que el cliente se actualiza
```

**HTTPS** lo resuelve el host o un proxy inverso delante del contenedor.

### Qué no se debe cachear delante del contenedor

Si ponés un proxy o CDN delante, respetá las cabeceras de la imagen. En particular, **nunca** cachear
`/`, `/index.html` ni `/version.json`: son los que permiten que los clientes detecten una versión nueva
y no queden atrapados en una vieja. Los archivos de `/assets/` sí se pueden cachear indefinidamente
(su nombre cambia con su contenido).

## Uso rápido

1. **Ejemplos** → elegí un circuito, o armá uno desde la biblioteca de la izquierda.
2. **C** traza cables (clic en un cable existente crea un punto de unión), **M** mueve (clic toma,
   clic suelta), **B** borra, **R** rota. Todos los atajos: [docs/ATAJOS.md](docs/ATAJOS.md).
3. **Simular** (E): pulsadores con mantener apretado, interruptores con un clic. Un corto o un lazo
   que no se estabiliza detienen todo en modo ERROR hasta «Volver a editar».

## Estructura

```
src/core/       núcleo puro: modelo, topología, conectividad, diagnósticos, simulación
src/app/        interfaz React: lienzo SVG, paneles, herramientas, i18n
src/platform/   reloj, archivos, autoguardado, verificación de versión
src/examples/   circuitos de ejemplo (también usados en E2E)
tests/          unit/ · integration/ · e2e/
deploy/         configuración de nginx para la imagen
```
