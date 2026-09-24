# Estado de implementación

> Documento vivo: completado · en curso · tests fallando · limitaciones · decisiones abiertas.
> Se actualiza al cerrar cada tanda de trabajo (ver [CLAUDE.md](CLAUDE.md)).
> Última actualización: 2026-09-24.

## Resumen

**Versión 1.1.0** (tag `v1.1.0`): la 1.0.0 (tag `v1.0.0`: vista de tablero de R5 y tableros en el
servidor de R6) más R7: queda a la vista el cable más grueso y el temporizador mixto.

**Tableros en el servidor (ronda R6) implementados, salvo el despliegue con Tailscale (C6).** Lista
compartida a la izquierda, guardado automático, un editor a la vez con «Editar» para tomar el turno,
papelera, clonar, importar y exportar; API en Node + SQLite detrás de nginx. Diseño en
[PLAN.md](PLAN.md) §24.

**Vista gráfica de tablero (refactor R5) implementada.** Cada aparato se dibuja como su base, con
los bornes de tornillo numerados y su esquema IEC adentro; el cable une exactamente dos bornes. La
versión anterior quedó congelada en el tag **`classic`** (commit `f5ceecc`) y ya no está en el
código. Reglas vigentes en [docs/DECISIONES.md](docs/DECISIONES.md); diseño y hitos en
[PLAN.md](PLAN.md) §0.5 y §22.

| Nivel | Resultado |
|---|---|
| Unitarias + integración (Vitest) | **204 / 204** |
| E2E (Playwright, Chromium + Firefox) | **60 / 60** (30 flujos × 2 navegadores) |
| Humo de contenedores (`docker-smoke.mjs --e2e --upgrade`) | **todo OK** |

| Hito | Contenido |
|---|---|
| G0 | Ronda R5 en DECISIONES.md, PLAN.md §0.5 y §22, invariantes de CLAUDE.md, tag `classic` |
| G1 | Núcleo: documento v2, catálogo declarativo con elementos internos, redes por borne, validador W1–W4, operaciones puras y motor de simulación por elementos |
| G2 | Interfaz: dibujo de los aparatos, lienzo con pan y zoom, herramientas (Seleccionar, Cable, Borrar, Texto), biblioteca, propiedades y estilo del cable |
| G3 | Catálogo completo: acometidas de 1 a 3 fases, tacos 1P/2P/3P, contactor, relés de 8 y 11 pines, TON, TOFF, pulsadores, parada de emergencia, selector, monitor de energía, protector de fase, piloto, foco y UPS |
| G4 | Diagnósticos (bloqueantes y avisos) y panel de ERROR |
| G5 | Archivo v2 con zod, guardar/abrir, autoguardado y exportación PNG/SVG/PDF con fondo blanco (guardar, abrir y el autoguardado local los reemplazó R6) |
| G6 | El tablero es la app: se borró la vista clásica, E2E reescritos y documentación al día |
| R5.2 | Giro de aparatos de a 90° (`R`), con los cables reacomodándose y las marcaciones siempre derechas; zócalo de 11 pines con la disposición real de sus tornillos (bornes también en los costados) |
| R6/C1–C2 | Reglas de los tableros en `src/core/cloud` (nombres únicos, turno, versiones, papelera, límites) y API en `server/` sobre `node:sqlite`, montada también en `pnpm dev` y `pnpm preview` |
| R6/C3–C4 | Controlador de sincronización, solo lectura en la tienda, barra de tableros, título con estado del guardado, franja de solo lectura con «Editar», importar y exportar JSON |
| R6/C5 | Contenedores `web` + `api` endurecidos, datos en la carpeta `datos/` del proyecto (montada, fuera de git) [R6 §15], humo que verifica API, endurecimiento y que los datos sobreviven a `down -v` |
| R7 | Cables superpuestos: queda a la vista y se elige el más grueso. Temporizador mixto (polo 8-6-5 TON, polo 1-3-4 instantáneo). Sin corte en los cruces entre cables de la misma red |
| R5.1 | Pasada de interfaz y dibujo: cableado ortogonal con motivo de rechazo, propiedades del cable seleccionado, selección por rectángulo, zócalo de relé real, marcaciones de borne, rótulos con halo, carátula del temporizador, funda del cable en los cruces y «Involucrados» en el cartel de ERROR |

## En curso

- **R6/C6 — despliegue con Tailscale:** `tailscale serve` delante del puerto 8080, política de acceso
  de la tailnet (solo el puerto de la app), script de administración (instalar, actualizar, copias,
  restaurar) y guía del servidor. Falta verificar en un host real que `tailscale serve` pase
  `Tailscale-User-Name` y el host original tal como los espera la API.

Para revisar el dibujo a ojo: `node scripts/shot.mjs <ejemplo> <salida.png> [REF]` levanta la app
compilada, carga un ejemplo del código y captura el lienzo (o un aparato, si se le pasa su
referencia).

## Tests fallando

Ninguno.

## Limitaciones conocidas

- **Respaldo A\* del router no implementado.** El plan lo condicionaba a una tasa de rechazo
  inaceptable; las rutas candidatas logran entre 95 % y 100 % de posiciones aceptadas en las
  fixtures de regresión, así que no hizo falta.
- **Un solo pulsador momentáneo a la vez:** con un mouse no se pueden mantener dos apretados.
- **Sin copiar/pegar todavía** en la vista de tablero (estaba en la clásica).
- **La herramienta Texto crea la anotación vacía**: se escribe desde el panel de propiedades.
- **Sin edición simultánea** [R6 §5]: uno edita, los demás miran. Los cambios llegan a quien mira
  por consulta cada 2 s, no por un canal de empuje; la lista se refresca cada 10 s.
- **Sin cuentas propias:** el nombre de quien edita sale de la red (Tailscale) o de un apodo que cada
  navegador guarda. Es cortesía, no identidad: quien entra puede tomar el turno, renombrar o mandar a
  la papelera cualquier tablero. La papelera (30 días) y las copias diarias lo hacen recuperable.
- **Sin conexión** se puede seguir editando; lo pendiente queda en el navegador y se sube al volver.
  Si se cierra la pestaña sin conexión, se sube al abrir la app de nuevo (o queda como copia si el
  tablero cambió mientras tanto).
- `node:sqlite` todavía figura como experimental en Node 24: el servidor silencia el aviso.
- **Sin soporte táctil ni móvil garantizado.** Por debajo de 800 px de ancho se ocultan los paneles.
- **Selector de 3 posiciones con un común:** las dos salidas comparten alimentación (I3).
- **La numeración de las bases de 8 y 11 pines es de ejemplo**: cambia según el fabricante.
- **Dos cargas en serie quedan apagadas:** limitación aceptada del modelo simplificado (R1 §1).
- **Safari no se prueba:** los navegadores objetivo son Chromium (Chrome, Edge) y Firefox (R2 §25).
- **El historial no sobrevive a una recarga** y empieza vacío cada vez que se toma el turno de
  edición: no se deshace lo que hizo otro.
- **Sin modo oscuro** [R5 §16]: la app es solo clara.
- Los ganchos de prueba (`?e2e=1`) viajan en el bundle de producción, inactivos sin ese parámetro.
  Solo exponen un reloj manual, consultas al documento local y `syncNow()`; con `?e2e=1` la página
  usa un backend de tableros en memoria.

## Decisiones abiertas

Ninguna. El despliegue quedó definido en R6 §11: servidor propio con Docker y acceso por Tailscale.

## Desviaciones técnicas respecto del plan

| Plan | Implementación | Motivo |
|---|---|---|
| Node 20 LTS | Node 24 LTS en el contenedor; local ≥ 22 | Node 20 terminó su soporte en abril de 2026 |
| React 18 | React 19 | Versión estable vigente |
| TypeScript (última) | TypeScript 6.0 | typescript-eslint todavía no soporta TypeScript 7 |
| Ejemplos servidos en `/examples/*.json` | Ejemplos construidos en código con las operaciones del editor | Siempre válidos con las reglas vigentes; sin ruta extra que cachear |
| Documentos de producto en `docs/producto/` | Siguen en la raíz del repo | No mover archivos que el equipo de producto edita |
| Núcleo nuevo en `src/core/board` junto al clásico | El clásico se borró al terminar G6; `board/` quedó como está | Mover todo una carpeta arriba solo agregaba ruido en el historial |

## Decisiones técnicas tomadas durante la implementación

- **Tres capas de tornillos** [Técnica]: el catálogo ubica los bornes a una unidad del borde del
  cuerpo, con paso 4, y el dibujo se deriva de esas posiciones. Por eso una base enchufable de 8 o de
  11 pines usa la misma función de dibujo.
- **El cable guarda solo sus codos** [Técnica]: los extremos se calculan desde los bornes, así que
  mover un aparato no obliga a reescribir el documento entero.
- **Al mover, si los dos extremos del cable se mueven, viaja entero**; si se mueve uno solo, los codos
  vecinos se estiran y, si la forma ya no sirve, se vuelve a rutear.
- **`connect()` devuelve el documento aunque sea inválido** (vista previa). Los ejemplos revisan sus
  diagnósticos en una prueba para que siempre se puedan simular.
- **La simulación se lee en el DOM** [Técnica]: `data-energized`, `data-actuated` y `data-live`
  permiten que los E2E verifiquen el estado sin capturas ni esperas.
- **Preset mínimo de 100 ms** y tope de eventos en un mismo instante, para que un lazo temporizado
  nunca cuelgue la simulación.
- **Dos actuadores sobre la misma bobina** [Técnica]: el temporizador mixto declara uno temporizado
  (`T`) y uno instantáneo (`K`) sobre 7–2, y cada polo dice cuál lo mueve. Como las bobinas sensan y
  no conducen, tener dos en paralelo no cambia nada eléctrico.
- **Una sola fuente para la versión** [Técnica]: `package.json`. Vite la inyecta como
  `__APP_VERSION__` en el cliente y en la API, y la agrega a `version.json`. La API la anuncia en su
  registro al arrancar.
- **Las reglas de los tableros viven en el núcleo** [Técnica]: `CloudService` es puro y síncrono;
  el servidor le da SQLite y las pruebas y el modo E2E, un almacenamiento en memoria. El backend de
  prueba no es una imitación.
- **Sesión por pestaña, nueva en cada carga** [Técnica]: dos pestañas de la misma persona son dos
  sesiones. Al cerrar se suelta el turno con `fetch(keepalive)`; si no llega, vence a los 20 s.
- **Si nadie edita, el turno queda para quien mira** [Técnica] (salvo que esté simulando): así un
  tablero abandonado no queda trabado.
- **Protección contra peticiones de otros sitios sin cookies ni tokens** [Técnica]: cabecera propia
  `X-Simulador` (obliga a una consulta CORS que no se autoriza), `Sec-Fetch-Site`, `Content-Type`
  JSON y `Origin` del mismo host en las escrituras.
- **El servidor guarda la forma canónica** [Técnica]: valida con `parseBoard` y guarda
  `serializeBoard`. Un JSON que la app no abre nunca llega a la base.
- **La API se empaqueta con Vite en un solo archivo** [Técnica] y la imagen no lleva `node_modules`
  ni npm. En desarrollo el backend se carga con `runnerImport` para que `vite.config.ts` no lo
  empaquete.
- **La entrada de la UPS es una carga y su salida una fuente independiente**: mezclarlas con la red
  da cortocircuito por la regla de fases de fuentes distintas.
