# Estado de implementación

> Documento vivo exigido por la Fase 7 del [AGENT_PROMPT.md](AGENT_PROMPT.md).
> Última actualización: 2026-09-21.

## Resumen

**V1 implementada.** Los hitos M0–M19 del [PLAN.md](PLAN.md) están completos, con pruebas en los tres
niveles.

| Nivel | Resultado |
|---|---|
| Unitarias + integración (Vitest) | **209 / 209** |
| E2E (Playwright, Chromium + Firefox) | **82 / 82** (41 flujos × 2 navegadores) |
| E2E repetidos 10 veces seguidas | **820 / 820**, sin intermitencias |
| E2E contra el contenedor real | **41 / 41** |
| Humo del contenedor + actualización en caliente | todo OK |

## Completado

| Hito | Contenido |
|---|---|
| M0 | Andamiaje, TypeScript por capas, lint de fronteras y de texto literal, i18n, contenedor, documentación base |
| M1 | Modelo de documento, canonicalización (5 pasos, prueba de propiedades con 400 documentos aleatorios), persistencia con migraciones |
| M2 | Historial por snapshots con coalescencia |
| M3 | Operaciones de edición, reparación ortogonal, validador de ambigüedad, semántica completa de la goma, inserción en serie |
| M4 | Índice de vínculos y diagnósticos con dos severidades |
| M5–M11 | Interfaz: lienzo SVG infinito, símbolos IEC, biblioteca, Seleccionar/Cable/Mover/Borrar/Texto, propiedades, diagnósticos, archivos, autoguardado, ejemplos |
| M12 | Copiar / pegar / duplicar con renumeración de referencias |
| M13–M16 | Simulación: fuentes, controles manuales (incl. parada de emergencia y selector), bobinas y contactos, TON y TOF por eventos, los tres cortos y la oscilación en ERROR congelado |
| M17 | Exportación PNG, SVG y PDF (A4 / A3 / ajustada), diagrama completo, colores tal como se ven |
| M18 | Versión y caché: `version.json` sin caché, aviso de versión nueva, contenedor probado en caliente |
| M19 | Estabilización: suite E2E sin intermitencias, presupuesto de rendimiento, documentación |

## En curso

Nada. A la espera de revisión de producto.

## Tests fallando

Ninguno.

## Limitaciones conocidas

- **Respaldo A\* del router no implementado.** El plan lo condicionaba a una tasa de rechazo
  inaceptable; las rutas candidatas logran entre 95 % y 100 % de posiciones aceptadas en las
  fixtures de regresión, así que no hizo falta.
- **Un solo pulsador momentáneo a la vez:** con un mouse no se pueden mantener dos apretados.
- **Autoguardado con dos pestañas:** gana la última que guardó.
- **Sin soporte táctil ni móvil garantizado.** Por debajo de 800 px de ancho se ocultan los paneles.
- **Selector de 3 posiciones con un común:** las dos salidas comparten alimentación (I3).
- **Dos cargas en serie quedan apagadas:** limitación aceptada del modelo simplificado (R1 §1).
- **Safari no se prueba:** los navegadores objetivo son Chromium (Chrome, Edge) y Firefox (R2 §25).
- **El historial no sobrevive a una recarga:** el autoguardado recupera el documento, no el deshacer.
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
| Orden M5 → M19 | Núcleo eléctrico (M13–M16) y copiar/pegar construidos antes que la UI | Permitido por el PLAN §19.1 (el núcleo no depende de la UI) |
| Nombres en español en ejemplos del plan (`bobina`, `estadoInicial`) | Código en inglés (`coil`, `initiallyActuated`) | Convención: código en inglés, UI en español |
| Ejemplos servidos en `/examples/*.json` | Ejemplos construidos en código con las operaciones del editor | Siempre válidos con las reglas vigentes; sin ruta extra que cachear |
| Documentos de producto en `docs/producto/` | Siguen en la raíz del repo | No mover archivos que el equipo de producto edita |
| Anotaciones de ambigüedad en la vista previa | Además del rojo, un círculo en el punto exacto | Hace visible un conflicto de pocos píxeles |

## Decisiones técnicas tomadas durante la implementación

- **Un cable suelto viaja con el componente que se mueve**, pero al mover un *tramo* los vecinos se
  estiran (R2 §3). Un tramo que quedaría recto pero saliendo hacia adentro del propio símbolo se
  reencamina para rodearlo.
- **Después de trazar un cable no queda nada seleccionado**, para que un clic posterior con Mover
  tome solo el tramo clicado.
- **Preset mínimo de 100 ms** y tope de eventos en un mismo instante, para que un lazo temporizado
  nunca cuelgue la simulación.
