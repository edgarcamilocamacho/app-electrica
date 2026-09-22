# Decisiones de producto

Estado **vigente** de todas las decisiones de producto tomadas después de la especificación. Donde
este documento difiere de [electrical_control_simulator_spec.md](../electrical_control_simulator_spec.md),
**prevalece este documento**.

- Solo se registra la regla final: las decisiones que una ronda posterior revirtió ya no aparecen
  (por ejemplo, el temporizador retentivo RTO o el borrado en cascada).
- La columna **Origen** conserva de dónde salió cada regla: `R1 §n`, `R2 §n` y `R3 Qn` son las secciones
  de las tres rondas de respuestas de producto; `R4 §n`, los pedidos de producto posteriores a V1
  (2026-09-22); `I1`–`I18`, las interpretaciones aceptadas (§11). Las etiquetas que aparecen en
  [PLAN.md](../PLAN.md) y en los comentarios del código remiten a esta columna.
- Los documentos originales de las rondas (`RESPONSE_ROUND_1–3.md`) y sus cuestionarios se retiraron
  del repo; su última versión está en el commit `58324d6` del historial de git.
- Una decisión nueva se agrega acá, con su origen, y se refleja en el registro de [PLAN.md](../PLAN.md) §2.

---

## 1. Semántica eléctrica

| Decisión | Origen |
|---|---|
| Las cargas (lámpara, bobina, temporizador) **no conducen**: solo sensan el potencial de sus dos terminales. Una carga está energizada cuando un terminal recibe fase y el otro, neutro válido | R1 §1 |
| Dos cargas en serie no funcionan en este modelo. Se acepta explícitamente para V1 | R1 §1 |
| **Cortocircuito**: unir L y N sin carga en medio · fase de una fuente con neutro de otra en el mismo nodo · fases de fuentes distintas en el mismo nodo | R1 §1 |
| Ante un corto, **toda** la simulación pasa a ERROR, se congela y no continúa ninguna rama | R1 §1 |
| Carga entre fase de A y neutro de B, con los neutros **sin unir**: **no enciende**; no es corto; no es bloqueante. Para energizar, fase y retorno deben ser de la misma alimentación, teniendo en cuenta las uniones explícitas de neutros | R2 §9 |
| Los neutros de fuentes distintas pueden unirse sin error | Spec §9.3 |
| V1 es **monofásica L/N**, pero la identidad de fase se modela como `(sourceId, phaseIndex)` para que agregar L1/L2/L3 no obligue a rediseñar el solver | R2 §11 |

## 2. Temporizadores

| Decisión | Origen |
|---|---|
| V1 tiene **solo TON y TOF**, cada uno como componente visual propio con su símbolo. No hay retentivo (RTO) ni de impulso (TP) | R2 §1 |
| El `preset` es una propiedad numérica editable en el panel de propiedades | R2 §1 |
| Durante la simulación se puede ver el valor o tiempo actual del temporizador mientras corre | R2 §1 |
| Contactos temporizados: **dos elementos genéricos** en la biblioteca ("Contacto temporizado NO" y "NC"); el símbolo se dibuja según el tipo del temporizador vinculado | R3 Q3.4 |
| Un contacto común solo se vincula a bobinas; uno temporizado, solo a temporizadores. Un vínculo al tipo equivocado es **bloqueante** | R3 Q3.4 |
| Preset en segundos con coma decimal: mínimo 0,1 s, máximo 3600 s, resolución 0,01 s | I15 |

## 3. Simulación

| Decisión | Origen |
|---|---|
| Velocidad **1×** en tiempo real (un timer de 5 s tarda 5 s) y controles **0,25× · 1× · 4×**. Sin pausa ni avance paso a paso en V1 | R2 §15 |
| Durante la simulación se puede: desplazar, hacer zoom, seleccionar para inspeccionar, ver propiedades en solo lectura, ver estados eléctricos y el valor de los temporizadores | R2 §16 |
| Durante la simulación **no** se puede: mover, borrar, rotar, cablear ni cambiar propiedades estructurales | R2 §16 |
| `estadoInicial` de interruptores (y posición inicial del selector) es una **propiedad del documento**, editable en edición y guardada en el archivo. Lo que se haga durante la simulación no la modifica: al detener, todo vuelve al estado inicial | R3 Q3.8 |
| Modo ERROR: toda la simulación se detiene, el tiempo y los temporizadores quedan congelados, se resaltan los componentes o nodos implicados y volver a edición exige una acción explícita. Lista navegable, secuencia de la oscilación y caminos del corto son deseables | R2 §18 |

## 4. Cableado y topología

| Decisión | Origen |
|---|---|
| Un cable está formado por **segmentos ortogonales independientes**: cada tramo horizontal o vertical se selecciona y se borra por separado. Una esquina de 90° no une los dos lados | R1 §3 |
| Si un segmento era el único enlace entre dos partes de una red y se borra, la red se parte **inmediatamente** en dos | R1 §3 |
| Dos segmentos consecutivos colineales, en la misma dirección y sin punto significativo intermedio (junction, derivación, terminal, extremo libre) se **fusionan** automáticamente | R1 §3 |
| Segmentos colineales **de la misma red** que se solapan se normalizan: no se conserva geometría redundante; los vértices quedan solo donde son significativos | R2 §7 |
| Iniciar una conexión en medio de un segmento lo **parte** y aparece un punto de unión visible, sea la derivación un cable nuevo, un terminal de componente o cualquier otra conexión explícita | R1 §4 |
| Colocar un componente con un terminal **exactamente** sobre un segmento crea la conexión automáticamente y parte el segmento | R1 §5 |
| Dos terminales en la misma posición quedan conectados, sin necesidad de un segmento visible | R2 §8 |
| **La conectividad es explícita, nunca se deduce de la geometría.** No conectan: dos cables que se cruzan, un cable sobre otro, un cable sobre un componente, un cable sobre un terminal. Solo hay conexión con un punto de unión, un extremo compartido o una acción explícita | R1 §7 |
| Un cable puede pasar visualmente por encima de un componente; el router no está obligado a esquivar símbolos. Sí debe conservar la conectividad, mantener rutas ortogonales y evitar ambigüedad entre redes | R1 §8 |
| **Extremos libres permitidos**: al borrar un componente o creados a propósito al dibujar. Se ven como un círculo abierto, no producen error, aviso ni corto, no alteran la simulación salvo cortar la conducción, y pueden reconectarse (colocando un terminal encima, trazando un cable desde él o uniéndolo explícitamente a otra red) | R1 §9, R2 §4 |
| **Solapamiento colineal entre redes distintas**: el editor lo impide (la posición es inválida) y, si llega a existir por importación o por un error, es un diagnóstico **bloqueante** | R2 §6 |
| Con el mismo tratamiento que el solapamiento: T sin punto (un punto de una red en el interior de un segmento de otra), puntos de redes distintas en la misma posición y cable que pasa justo por un terminal ajeno | R3 Q3.1 |
| El cruce perpendicular sigue siendo válido y no conecta | R2 §6 |
| Si los dos terminales **libres** de un componente caen sobre el mismo tramo recto, el componente se **inserta en serie**: se elimina exactamente el pedazo entre ellos | R3 Q3.3 |

## 5. Edición

| Decisión | Origen |
|---|---|
| **Dos maneras de mover**, con las mismas reglas de conexión y reparación y con vista previa válida o inválida: **arrastrar** con Seleccionar (apretar sobre un objeto, arrastrar, soltar) y la herramienta **Mover (M)** (clic toma, el objeto sigue al cursor, otro clic lo coloca) | R2 §2, R4 §1 |
| Se arrastran componentes, textos y también **cables**: un tramo solo se desplaza en perpendicular, como con Mover. Sobre algo seleccionado se arrastra toda la selección | R4 §2, I9 |
| Soltar un arrastre en una posición **inválida** lo **devuelve a su lugar**, con el motivo en la barra de estado. Un arrastre confirmado es una sola entrada de historial | R4 §1 |
| Con algo tomado con Mover, las **flechas** lo desplazan una casilla (`Mayús`: cinco) y **`Enter`** lo suelta | R4 §3 |
| Al soltar: un terminal **libre** puede conectarse al caer exactamente sobre un segmento, un extremo libre o un terminal; el cuerpo del símbolo cruza cables sin conectar; un terminal **ya conectado** no puede tocar un conductor de otra red | R2 §2, I1 |
| Si un solo terminal queda en posición inválida, se rechaza la colocación completa. Con Mover, el clic no confirma y el objeto sigue tomado hasta una posición válida o hasta cancelar; arrastrando, vuelve a su lugar | R2 §2, R4 §1 |
| Mover un componente **no rompe** sus conexiones: el punto de unión original sigue conectado y se crean o eliminan los segmentos ortogonales necesarios para alcanzar la nueva posición del terminal | R1 §6, R2 §2 |
| Mover un **segmento**: perpendicular a sí mismo, con Mover o arrastrándolo; los vecinos se estiran, se acortan o generan codos; siempre ortogonal; una operación geométrica no cambia la conectividad; luego se normaliza | R2 §3 |
| No hay segmentos "fijados": un ajuste manual puede repararse después al mover componentes conectados | R2 §3 |
| **R** rota 90° el componente a colocar, el tomado o el único seleccionado. Una rotación en el lugar que dejaría una posición inválida se **rechaza** con el motivo. No hay rotación de grupos | Spec §6.4, R2 §31, R3 Q3.5 |
| Borrar un componente **no borra sus cables**: quedan como extremos libres, para poder reemplazarlo | R1 §10 |
| Dos maneras de borrar: seleccionar + `Supr`, o la herramienta Borrar | R1 §11 |
| Herramienta **Borrar (B)**: sigue activa tras cada clic; borra solo con clic explícito (nunca al pasar el mouse ni manteniendo el botón); sin diálogos de confirmación. La recuperación es deshacer | R1 §11, R2 §5 |
| Prioridad de la goma: los vértices visibles primero; después **segmento → texto → componente**. En un terminal con un solo cable gana el componente | R2 §5, R3 Q3.6 |
| Clic sobre un **punto de unión**: borra todos los segmentos incidentes y, si hay un componente conectado directamente en ese punto, también el componente. Todo en una transacción | R2 §5 |
| Clic sobre una **esquina**: borra los dos segmentos completos que la forman | R2 §5 |
| Clic sobre un **extremo libre**: borra el segmento completo hasta el siguiente vértice, esquina, punto de unión o terminal | R2 §5 |
| Clic sobre un **segmento**: borra solo ese segmento | R2 §5 |
| Historial: **cada clic de la goma es una entrada** (cuatro clics, cuatro deshacer). Una acción que por definición borra varias cosas, o una acción masiva sobre una selección múltiple, es **una** entrada | R1 §12, R2 §5, R2 §30.1 |
| Copiar, pegar y duplicar entran en V1: `Ctrl+C`, `Ctrl+V`, `Ctrl+D`. IDs nuevos, referencias sin colisión y la topología interna de lo seleccionado preservada | R2 §13 |

## 6. Catálogo

| Decisión | Origen |
|---|---|
| Catálogo mínimo (fuente, interruptores, pulsadores, bobina, contactos, TON, TOF y sus contactos, lámpara) **más** parada de emergencia, selector de 3 posiciones y texto libre | R2 §12 |
| La semántica del selector la define el equipo y puede refinarse al probar la interacción | R2 §12 |
| Marco de título: para una versión posterior | R2 §14 |

## 7. Referencias y diagnósticos

| Decisión | Origen |
|---|---|
| Un contacto que referencia una bobina inexistente **bloquea** la simulación; nunca se asume que equivale a bobina apagada | R2 §10 |
| Dos bobinas con la misma referencia **bloquean** la simulación | R2 §10 |
| El diagnóstico indica claramente qué referencia corregir | R2 §10 |
| Hay dos severidades: **avisos** y **errores que bloquean** la simulación. Bloquean, entre otros: solapamiento de redes distintas, referencias rotas, referencias duplicadas y cualquier inconsistencia estructural que vuelva ambiguo el circuito | R2 §30.2 |

## 8. Archivos, exportación y ejemplos

| Decisión | Origen |
|---|---|
| Guardar y abrir en JSON legible y versionado. Base universal con descarga e input de archivo; File System Access API como mejora cuando existe | Spec §14, R2 §27, R3 Q3.2 |
| **Autoguardado** local con recuperación tras una recarga o un cierre accidental. No reemplaza el archivo JSON | R2 §28 |
| **Exportar a PDF e imagen**: el diagrama tal como se ve, sin autor, fecha, versión ni metadatos | R2 §14 |
| Exporta el **diagrama completo** con margen, aunque no entre en pantalla; con los colores del estado eléctrico si se exporta en simulación o en ERROR; nunca la grilla, la selección ni la vista previa; formatos **PNG, PDF y SVG** | R3 Q3.7 |
| V1 incluye al menos un **circuito de ejemplo** para abrir, simular y validar visualmente | R2 §30.4 |

## 9. Plataforma

| Decisión | Origen |
|---|---|
| App client-side: un servidor entrega los assets y la simulación corre en el navegador | R2 §23 |
| El cliente detecta cuándo hay una versión nueva y no queda atado a una versión vieja en caché | R2 §23 |
| La app **corre dentro de un contenedor**, para desplegarla fácil. El proveedor concreto queda abierto: no afecta el código | R3 §11 |
| Sin requisito de funcionamiento offline; no usar Service Worker es compatible | R2 §24 |
| Navegadores objetivo: **Chrome, Edge y Firefox** de escritorio. Móvil best-effort | R2 §25 |
| Lienzo que se siente **infinito**, con desplazamiento, zoom y snap a grilla fluidos | R2 §21, R2 §30.3 |
| Grilla de 10 px al 100 %, zoom de 25 % a 400 %, como valores ajustables | R2 §21, I17 |
| **Toda la interfaz en español**, con atajos coherentes con los nombres en español (`B` Borrar, `M` Mover). Textos centralizados para poder agregar idiomas sin reescribir componentes | R2 §26, R2 §30.8 |
| Cada botón de herramienta muestra **su tecla** al lado del ícono, en gris claro | R4 §4 |
| La referencia de cada componente (y debajo su descripción y el tiempo del temporizador) va **muy pegada al símbolo**: en los verticales, **justo abajo a la derecha**; en los horizontales (rotados 90° o 270°), **justo debajo y centrada** | R4 §7, R4 §8 |
| **Modo oscuro intercambiable** con un botón en la barra; sin elección sigue al sistema y la elección se recuerda. Abarca la interfaz, el **lienzo** y los **íconos de la biblioteca**; la exportación sale siempre con los colores claros | R4 §5, R4 §6 |
| Sin telemetría ni analítica; sin requisitos regulatorios identificados | R2 §30.6 |
| Monousuario y local; sin colaboración en tiempo real | R2 §30.7 |
| La accesibilidad avanzada puede evolucionar después, pero sin diseñar en su contra | R2 §30.8 |
| Documentación interna en el repo: cómo levantar el entorno, ejecutar, probar, la estructura y las convenciones; glosario opcional | R2 §30.5 |
| Stack aprobado: SVG · React + TypeScript + Vite · Zustand · deshacer con copias inmutables · Vitest + Playwright (Chromium y Firefox) · pnpm · git local sin remoto. (Se aprobó Node 20; se usa Node 24 porque el 20 perdió soporte: ver [STATUS.md](../STATUS.md)) | R3 Q3.2 |

Mapa de teclas: [ATAJOS.md](ATAJOS.md). Confirmadas por producto: `B`, `M`, `R`, `Esc`, `Ctrl+Z`,
`Ctrl+Y`, `Ctrl+C`, `Ctrl+V` (R2 §31); el resto es la propuesta aceptada en I7.

## 10. Pruebas exigidas

Las pruebas son un requisito fuerte del producto (R2 §22):

- Las operaciones topológicas deben poder probarse **sin UI**.
- Cobertura de: mover componentes, mover segmentos, rotar, colocar, partir y unir redes, borrar,
  deshacer/rehacer, cortos, oscilaciones, temporizadores, conexiones automáticas, posiciones
  inválidas, exportación e importación, extremos libres, cruces sin conexión, solapamientos
  bloqueantes, copiar/pegar y simulación completa.
- Pruebas **end-to-end completas desde V1**, no solo unos pocos flujos críticos.

Casos obligatorios (R1 §14), además de los de la spec §18:

| Área | Casos |
|---|---|
| Segmentos | una polilínea con un codo tiene dos segmentos seleccionables · borrar solo el horizontal mantiene el vertical · borrar el segmento central de una red lineal la parte en dos · dos colineales consecutivos sin punto significativo se fusionan |
| Derivaciones | iniciar una conexión en medio de un segmento lo divide · aparece un punto de unión visible · la derivación y ambos lados quedan en la misma red |
| Terminal sobre cable | colocar un componente con un terminal sobre un segmento lo conecta · el segmento se divide · el terminal queda en el mismo nodo · deshacer restaura exactamente |
| Movimiento | mover un componente conectado conserva la conectividad · bajarlo desde una T crea el tramo vertical · moverlo lateralmente puede crear varios segmentos · ningún movimiento inventa una conexión con un cable que se cruza · deshacer devuelve posición y geometría |
| Extremos libres | borrar un componente deja extremos libres · se ven marcados · no producen error de simulación · colocar un terminal encima los reconecta · se puede trazar un cable desde ellos · deshacer el borrado restaura componente y conexiones |
| Herramienta Borrar | clic sobre componente = una transacción · clic sobre segmento = una transacción · cuatro clics = cuatro entradas · `Ctrl+Z` restaura solo el último · la herramienta sigue activa · pasar el mouse sin clic no borra |
| Cruces | dos segmentos cruzados sin punto de unión siguen en redes distintas · mover un componente de modo que su cable atraviese otra red no las une · pasar sobre un terminal ajeno no conecta · un punto de unión explícito sí las une |
| Cortos | L–N directo → ERROR · fase de A con neutro de B → ERROR · fases de dos fuentes en un nodo → ERROR · el estado queda congelado para inspección |

## 11. Interpretaciones aceptadas (I1–I18)

Reglas que el equipo propuso por delegación o por inferencia y que producto aceptó en la ronda 3. En
el plan se citan con la etiqueta **[Interpretación]**.

| # | Tema | Regla aceptada | Plan |
|---|---|---|---|
| I1 | "Conductor distinto" (R2 §2) | Significa **de otra red**. Un terminal ya conectado que cae sobre un conductor de su **misma** red está permitido: eléctricamente no cambia nada | §5.5 |
| I2 | Parada de emergencia | NC. Un clic la acciona y **enclava** (contacto abierto, hongo hundido); otro clic la libera. Inicial: liberada | §11 |
| I3 | Selector de 3 posiciones | I – 0 – II, mantenido, un común y dos salidas. Tres zonas clicables en el símbolo durante la simulación. Inicial: 0. Refinable | §11 |
| I4 | Texto libre | Sin rotación, tamaño fijo, editable en el panel o con doble clic. No es eléctrico | §4.1, §11 |
| I5 | Referencias al pegar | `K1` → `K2`. Bobina y sus contactos juntos → `K2`, `K2.1`, `K2.2`. Un contacto solo → nuevo número (`K1.3`) **vinculado a la misma bobina** | §12 |
| I6 | Pegado | Lo pegado aparece "tomado" y se coloca con un clic, con las mismas reglas que Mover; sus terminales y extremos libres que caen sobre un conductor se conectan | §12 |
| I7 | Mapa de teclas | `S` Seleccionar · `C` Cable · `T` Texto · `E` Ejecutar/detener simulación · `A` Ajustar vista · `Ctrl+D` Duplicar · `Supr` borrar selección · `Espacio`+arrastrar desplazar | §6.4 |
| I8 | Gestos de la herramienta Cable | Clics fijan codos; clic sobre conductor termina y conecta; `Enter` o doble clic termina con extremo libre; `Retroceso` deshace el último tramo; `Esc` descarta el trazado | §6.3 |
| I9 | Mover con selección | Clic sobre algo seleccionado toma toda la selección; si no, solo ese objeto. La herramienta sigue activa tras colocar | §6.2 |
| I10 | Mover y vértices | Clic con Mover sobre un punto de unión, esquina o extremo libre no toma nada. Para reconectar un extremo libre se traza un cable desde él | §6.2 |
| I11 | Mover un segmento | Esquinas y extremos libres se desplazan con él; puntos de unión y terminales quedan anclados y se agrega un tramo nuevo. Un grupo de segmentos se mueve en 2D | §5.3 |
| I12 | `Ctrl+Z` con algo tomado | Equivale a `Esc`: suelta sin cambios, no toca el historial | §6.2 |
| I13 | Seleccionar y arrastre | Arrastrar desde un espacio vacío dibuja el rectángulo. (Arrastrar desde un objeto ahora **lo mueve**: R4 §1) | §6.1 |
| I14 | Terminal sobre terminal | Se dibuja con punto ●. La goma sobre ese punto borra **los dos** componentes (es la regla del punto de unión aplicada literalmente, y la única coherente) | §4.2, §7 |
| I15 | Preset de temporizadores | En segundos con coma decimal, mínimo 0,1 s, máximo 3600 s, resolución 0,01 s | §10.4 |
| I16 | Autoguardado | Al abrir, se restaura solo, con un aviso y la opción "Empezar uno nuevo" | §14.3 |
| I17 | Grid y zoom | 10 px al 100 %, zoom de 25 % a 400 %, como valores ajustables | T-11 |
| I18 | Avisos no bloqueantes | Referencia repetida (dos `H1`), componente puenteado (incluye L y N unidos por cable: la simulación arranca y entra en ERROR para mostrar el corto) y bobina sin contactos. En el código: `REF_REPEATED`, `BYPASSED`, `NO_CONTACTS` | §8 |
