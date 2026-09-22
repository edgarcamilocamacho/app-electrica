# Estado de implementación

> Documento vivo: completado · en curso · tests fallando · limitaciones · decisiones abiertas.
> Se actualiza al cerrar cada tanda de trabajo (ver [CLAUDE.md](CLAUDE.md)).
> Última actualización: 2026-09-22.

## Resumen

**Refactor R5 en marcha: vista gráfica de tablero.** Cada aparato pasa a dibujarse como su base, con
los bornes de tornillo numerados y su esquema IEC adentro, y el cable pasa a unir exactamente dos
bornes. El detalle está en [PLAN.md](PLAN.md) §0.5 y §22, y las reglas vigentes en
[docs/DECISIONES.md](docs/DECISIONES.md).

- La versión anterior (esquema IEC disperso, V1 + R4) quedó congelada en el tag **`classic`**, en el
  commit `f5ceecc`. No se mantiene ni se despliega en paralelo.
- Hito **G0 (documentación) terminado**. Sigue **G1**: núcleo del modelo nuevo.
- Referencia visual del estilo: la maqueta que aprobó producto (contactor, relé, temporizador,
  pulsadores, pilotos y cableado iluminado).
- Mientras dure el refactor, lo que sigue abajo describe la versión `classic`, salvo lo que este
  resumen contradiga.

**V1 implementada** (estado del tag `classic`). Los hitos M0–M19 del [PLAN.md](PLAN.md) están
completos, con pruebas en los tres niveles.

| Nivel | Resultado |
|---|---|
| Unitarias + integración (Vitest) | **230 / 230** |
| E2E (Playwright, Chromium + Firefox) | **96 / 96** (48 flujos × 2 navegadores) |
| E2E repetidos 10 veces seguidas | **820 / 820**, sin intermitencias (corrida de V1, 41 flujos) |
| E2E contra el contenedor real | **41 / 41** (corrida de V1) |
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
| R4 | Mover **arrastrando** con Seleccionar (también cables; soltar en posición inválida lo devuelve a su lugar), **flechas y `Enter`** con Mover, tecla visible junto a cada herramienta, ícono de Texto más chico, barra de herramientas que ya no se desborda entre 960 y 1440 px, **modo oscuro** (interfaz, lienzo e íconos de la biblioteca), biblioteca sin la entrada duplicada de texto libre, nombres de los componentes pegados al símbolo (abajo a la derecha si está vertical; debajo y centrados si está horizontal) |

## En curso

**G1 — núcleo de la vista gráfica.** Documento v2 (aparatos + cables de dos extremos), redes por
borne, validador W1–W4, catálogo declarativo con elementos internos y modelo de simulación sobre
esos elementos.

Consecuencias del refactor que ya están decididas y todavía no implementadas:

- Desaparecen los componentes sueltos (bobina, contactos, contactos temporizados) y con ellos los
  diagnósticos de referencia rota o duplicada bloqueante.
- Desaparecen los extremos libres, los empalmes, la inserción en serie, el terminal sobre terminal y
  la rotación de componentes.
- Se quita el **modo oscuro** (R5 §16): queda solo el claro, con el lienzo en color hoja y la
  exportación en blanco.
- Los archivos de la versión clásica dejan de abrirse, con un mensaje claro (R5 §15).

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
- **Arrastre (R4)** [Técnica]: empieza al superar 4 px de pantalla; por debajo es un clic. Durante el
  arrastre `Esc` cancela, `R` rota y `Mayús` fija el eje dominante (también al llevar algo con Mover).
  Un `pointercancel` del navegador cancela el arrastre. Apretar sobre un objeto de una selección
  múltiple arrastra toda la selección; si fue un clic, al soltar queda solo ese objeto.
- **Con algo tomado o arrastrándose** [Técnica], `Supr` no hace nada y `Ctrl+Y` cancela antes de
  rehacer (como `Ctrl+Z`, I12). Antes, borrar o rehacer con algo tomado dejaba una vista previa vieja
  y soltar restauraba lo borrado.
- **Flechas con Mover y nada tomado** [Técnica]: toman la selección. Si el cursor no está sobre el
  lienzo, el primer movimiento del mouse fija el ancla sin hacer saltar el objeto.
- **Textos del componente** [Técnica]: se ubican contra el contorno real de lo dibujado
  (`SYMBOL_BODIES` en `symbols/Symbols.tsx`), no contra la caja de selección, que incluye las patas.
  Un contacto NA termina a la derecha en la pata y uno NC en el gancho, así que sus nombres no
  quedan alineados entre sí. Las letras L y N de la fuente pasaron a la izquierda del cable para
  no leerse junto a la referencia («N G1»).
- **Modo oscuro** [Técnica]: la paleta oscura del diagrama conserva los papeles de la clara (tinta,
  cable, flotante más apagado, fase naranja por fuente, neutro azul, corto rojo). La cruz de una
  lámpara encendida se dibuja en tinta oscura en los dos temas para que se vea sobre el relleno.
  La exportación sigue con la paleta clara (colores literales, R3 Q3.7). Los colores de la interfaz
  usan `light-dark()` (Chrome/Edge 123+, Firefox 120+).
- **Barra de herramientas angosta** [Técnica]: con 1400 px o menos se oculta el título; con 1200 px o
  menos, los menús y la velocidad muestran solo el ícono (el nombre queda como tooltip y para lectores
  de pantalla); con 960 px o menos la barra se desplaza horizontalmente.
- **Preset mínimo de 100 ms** y tope de eventos en un mismo instante, para que un lazo temporizado
  nunca cuelgue la simulación.
