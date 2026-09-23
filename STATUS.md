# Estado de implementación

> Documento vivo: completado · en curso · tests fallando · limitaciones · decisiones abiertas.
> Se actualiza al cerrar cada tanda de trabajo (ver [CLAUDE.md](CLAUDE.md)).
> Última actualización: 2026-09-23.

## Resumen

**Vista gráfica de tablero (refactor R5) implementada.** Cada aparato se dibuja como su base, con
los bornes de tornillo numerados y su esquema IEC adentro; el cable une exactamente dos bornes. La
versión anterior quedó congelada en el tag **`classic`** (commit `f5ceecc`) y ya no está en el
código. Reglas vigentes en [docs/DECISIONES.md](docs/DECISIONES.md); diseño y hitos en
[PLAN.md](PLAN.md) §0.5 y §22.

| Nivel | Resultado |
|---|---|
| Unitarias + integración (Vitest) | **138 / 138** |
| E2E (Playwright, Chromium + Firefox) | **38 / 38** (19 flujos × 2 navegadores) |

| Hito | Contenido |
|---|---|
| G0 | Ronda R5 en DECISIONES.md, PLAN.md §0.5 y §22, invariantes de CLAUDE.md, tag `classic` |
| G1 | Núcleo: documento v2, catálogo declarativo con elementos internos, redes por borne, validador W1–W4, operaciones puras y motor de simulación por elementos |
| G2 | Interfaz: dibujo de los aparatos, lienzo con pan y zoom, herramientas (Seleccionar, Cable, Borrar, Texto), biblioteca, propiedades y estilo del cable |
| G3 | Catálogo completo: acometidas de 1 a 3 fases, tacos 1P/2P/3P, contactor, relés de 8 y 11 pines, TON, TOF, pulsadores, parada de emergencia, selector, piloto, foco y UPS |
| G4 | Diagnósticos (bloqueantes y avisos) y panel de ERROR |
| G5 | Archivo v2 con zod, guardar/abrir, autoguardado y exportación PNG/SVG/PDF con fondo blanco |
| G6 | El tablero es la app: se borró la vista clásica, E2E reescritos y documentación al día |
| R5.2 | Giro de aparatos de a 90° (`R`), con los cables reacomodándose y las marcaciones siempre derechas; zócalo de 11 pines con la disposición real de sus tornillos (bornes también en los costados) |
| R5.1 | Pasada de interfaz y dibujo: cableado ortogonal con motivo de rechazo, propiedades del cable seleccionado, selección por rectángulo, zócalo de relé real, marcaciones de borne, rótulos con halo, carátula del temporizador, funda del cable en los cruces y «Involucrados» en el cartel de ERROR |

## En curso

Nada. A la espera de revisión de producto.

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
- **Autoguardado con dos pestañas:** gana la última que guardó.
- **Sin soporte táctil ni móvil garantizado.** Por debajo de 800 px de ancho se ocultan los paneles.
- **Selector de 3 posiciones con un común:** las dos salidas comparten alimentación (I3).
- **La numeración de las bases de 8 y 11 pines es de ejemplo**: cambia según el fabricante.
- **Dos cargas en serie quedan apagadas:** limitación aceptada del modelo simplificado (R1 §1).
- **Safari no se prueba:** los navegadores objetivo son Chromium (Chrome, Edge) y Firefox (R2 §25).
- **El historial no sobrevive a una recarga:** el autoguardado recupera el documento, no el deshacer.
- **Sin modo oscuro** [R5 §16]: la app es solo clara.
- Los ganchos de prueba (`?e2e=1`) viajan en el bundle de producción, inactivos sin ese parámetro.
  Solo exponen un reloj manual y consultas al documento local.

## Decisiones abiertas

- **Proveedor de despliegue (Q3.9):** no afecta el código. La imagen corre en cualquier host de
  contenedores.

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
- **La entrada de la UPS es una carga y su salida una fuente independiente**: mezclarlas con la red
  da cortocircuito por la regla de fases de fuentes distintas.
