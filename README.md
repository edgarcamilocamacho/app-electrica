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

La app se distribuye como dos contenedores ([compose.yaml](compose.yaml)): **web** (nginx sin
privilegios con `dist/` y el proxy de `/api`) y **api** (Node con la base SQLite en la carpeta
`datos/` del proyecto). Los dos corren sin root y con el sistema de archivos de solo lectura; la API no
tiene salida a internet. La política de caché viaja dentro de la imagen
([deploy/nginx.conf](deploy/nginx.conf)).

```bash
docker compose up -d --build               # http://localhost:8080 (solo en 127.0.0.1)
SIMULADOR_PUERTO=9090 docker compose up -d # otro puerto
docker compose logs -f api                 # registros de la API
docker compose exec api node server.js backup   # copia de la base en /data/copias
```

**Todos los datos quedan en `datos/`**, montada en la API y fuera de git: `datos/tableros.sqlite` y
las copias diarias en `datos/copias/` (guarda las últimas 14). **Actualizar es `git pull` y
relanzar**; bajar, reconstruir o incluso `docker compose down -v` no tocan esa carpeta. Borrarla (o
borrar el clon del repo) sí borra los tableros: para llevarlos a otro lado, copiar la carpeta.

La API corre con el uid 1000, que tiene que ser el dueño de `datos/`. Si en el servidor el usuario
es otro, indicarlo con `SIMULADOR_UID` y `SIMULADOR_GID` (en un `.env` junto a `compose.yaml`); si
no, la API no arranca y dice qué `chown` hacer.

Prueba de humo sobre los contenedores reales, en un proyecto aparte que se borra al terminar:

```bash
pnpm docker:smoke                         # cabeceras, API por nginx, endurecimiento y persistencia
node scripts/docker-smoke.mjs --e2e       # además corre los E2E (Chromium) contra los contenedores
node scripts/docker-smoke.mjs --upgrade   # cambia el build con la página abierta y verifica que el
                                          # cliente se actualiza sin perder los tableros
```

**HTTPS y acceso** los pone Tailscale delante (`tailscale serve`) [R6 §11]. Instalación en el
servidor, actualización, copias y reglas de acceso: [DESPLIEGUE.md](DESPLIEGUE.md).

### Qué no se debe cachear delante del contenedor

Si ponés un proxy o CDN delante, respetá las cabeceras de la imagen. En particular, **nunca** cachear
`/`, `/index.html` ni `/version.json`: son los que permiten que los clientes detecten una versión nueva
y no queden atrapados en una vieja. Los archivos de `/assets/` sí se pueden cachear indefinidamente
(su nombre cambia con su contenido).

## Uso rápido

1. **Ejemplos** → elegí un circuito, o armá uno desde la biblioteca de la izquierda.
2. **C** traza cables (clic en un cable existente crea un punto de unión). Para mover, arrastrá con
   Seleccionar o usá **M** (clic toma, clic o `Enter` suelta, flechas para ajustar). **B** borra,
   **R** rota. Todos los atajos: [docs/ATAJOS.md](docs/ATAJOS.md).
3. **Simular** (E): pulsadores con mantener apretado, interruptores con un clic. Un corto o un lazo
   que no se estabiliza detienen todo en modo ERROR hasta «Volver a editar».

## Estructura

```
src/core/       núcleo puro: modelo, topología, conectividad, diagnósticos, simulación
src/app/        interfaz React: lienzo SVG, paneles, herramientas, i18n
src/platform/   reloj, cliente de la API, descargas, almacenamiento local, verificación de versión
src/examples/   circuitos de ejemplo (también usados en E2E)
tests/          unit/ · integration/ · e2e/
server/         API de tableros: Node sin dependencias en ejecución, node:sqlite
deploy/         configuración de nginx para la imagen
```
