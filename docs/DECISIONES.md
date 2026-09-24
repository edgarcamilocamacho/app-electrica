# Decisiones de producto

Estado **vigente** de todas las decisiones de producto tomadas después de la especificación. Donde
este documento difiere de [electrical_control_simulator_spec.md](../electrical_control_simulator_spec.md),
**prevalece este documento**.

- Solo se registra la regla final: las decisiones que una ronda posterior revirtió ya no aparecen
  (por ejemplo, el temporizador retentivo RTO, el borrado en cascada o, desde R5, los extremos
  libres y los contactos sueltos).
- La columna **Origen** conserva de dónde salió cada regla: `R1 §n`, `R2 §n` y `R3 Qn` son las secciones
  de las tres rondas de respuestas de producto; `R4 §n`, los pedidos posteriores a V1 (2026-09-22);
  `R5 §n`, la ronda de la **vista gráfica de tablero** (2026-09-22), que reemplazó la representación
  dispersa y dejó la versión anterior en el tag `classic`; `R6 §n`, la ronda de los **documentos en
  el servidor** (2026-09-23); `I1`–`I18`, las interpretaciones aceptadas
  (§11). Las etiquetas que aparecen en [PLAN.md](../PLAN.md) y en los comentarios del código remiten
  a esta columna. Los puntos de R5 están listados en [PLAN.md](../PLAN.md) §0.5 y los de R6, en §0.6.
- Los documentos originales de las rondas (`RESPONSE_ROUND_1–3.md`) y sus cuestionarios se retiraron
  del repo; su última versión está en el commit `58324d6` del historial de git.
- Una decisión nueva se agrega acá, con su origen, y se refleja en el registro de [PLAN.md](../PLAN.md) §2.

---

## 1. Semántica eléctrica

| Decisión | Origen |
|---|---|
| Las cargas (lámpara, foco, bobina, temporizador) **no conducen**: solo sensan el potencial de sus dos terminales. Una carga está energizada cuando un terminal recibe fase y el otro, neutro válido | R1 §1 |
| Dos cargas en serie no funcionan en este modelo. Se acepta explícitamente | R1 §1 |
| **Cortocircuito**: unir L y N sin carga en medio · fase de una fuente con neutro de otra en el mismo nodo · fases de fuentes distintas en el mismo nodo | R1 §1 |
| Ante un corto, **toda** la simulación pasa a ERROR, se congela y no continúa ninguna rama | R1 §1, R5 §14 |
| Carga entre fase de A y neutro de B, con los neutros **sin unir**: **no enciende**; no es corto; no es bloqueante. Para energizar, fase y retorno deben ser de la misma alimentación, teniendo en cuenta las uniones explícitas de neutros | R2 §9 |
| Los neutros de fuentes distintas pueden unirse sin error | Spec §9.3 |
| **Acometidas monofásica (L + N), bifásica (L1, L2 + N) y trifásica (L1, L2, L3 + N)**, dibujadas como la bajada de un poste de la calle. Internamente cada fase es una fuente independiente, con identidad `(sourceId, phaseIndex)`, y todas las fases de una misma acometida comparten el neutro | R2 §11, R5 §2 |
| Una carga **entre dos fases no enciende**, aunque sean de la misma acometida: hace falta fase y neutro | R5 §12 |
| **UPS / inversor**: su entrada de alterna se comporta como una carga y solo enciende su indicador. Su salida es una **fuente independiente siempre activa**, con fase y neutro propios; unirla con la red en un mismo nodo es cortocircuito | R5 §11 |
| Sin motores ni relé térmico | R5 §12 |

## 2. Temporizadores

| Decisión | Origen |
|---|---|
| **TON y TOF son dos aparatos independientes** (base de 8 pines), cada uno con su bobina y sus contactos temporizados adentro | R2 §1, R5 §13 |
| El `preset` es una propiedad numérica editable en el panel de propiedades | R2 §1 |
| Durante la simulación se puede ver el tiempo actual del temporizador mientras corre | R2 §1 |
| Preset en segundos con coma decimal: mínimo 0,1 s, máximo 3600 s, resolución 0,01 s | I15 |

## 3. Simulación

| Decisión | Origen |
|---|---|
| Velocidad **1×** en tiempo real (un timer de 5 s tarda 5 s) y controles **0,25× · 1× · 4×**. Sin pausa ni avance paso a paso | R2 §15 |
| Durante la simulación se puede: desplazar, hacer zoom, seleccionar para inspeccionar, ver propiedades en solo lectura, ver estados eléctricos y el valor de los temporizadores | R2 §16 |
| Durante la simulación **no** se puede: mover, borrar, cablear ni cambiar propiedades estructurales | R2 §16 |
| `estadoInicial` de interruptores (y posición inicial del selector) es una **propiedad del documento**, editable en edición y guardada en el archivo. Lo que se haga durante la simulación no la modifica: al detener, todo vuelve al estado inicial | R3 Q3.8 |
| El **selector de 3 posiciones** se acciona con un clic, que lo pasa a la siguiente posición en el orden dibujado: I → 0 → II → I. La perilla del aparato apunta a la posición actual | R5 §23 |
| Mientras se simula, al pasar el cursor sobre un aparato de accionamiento manual **se resalta** (halo y cursor de mano) para que se vea qué se puede tocar. En ERROR no se resalta nada: está todo congelado | R5 §21 |
| Modo ERROR: toda la simulación se detiene, el tiempo y los temporizadores quedan congelados, se resaltan los aparatos o nodos implicados y volver a edición exige una acción explícita | R2 §18, R5 §14 |

## 4. Cableado y topología

| Decisión | Origen |
|---|---|
| **Un cable une exactamente dos bornes**: empieza y termina en un tornillo. No hay empalmes en el aire, derivaciones a mitad de cable ni extremos libres | R5 §4 |
| El trazado es **ortogonal**, con codos que pertenecen solo a ese cable | R5 §4 |
| **La conectividad es explícita y pasa solo por los bornes.** No conectan: dos cables que se cruzan, un cable sobre otro, un cable sobre un aparato ni dos bornes que coinciden en la misma posición | R1 §7, R5 §4 |
| Dos cables solo pueden **solaparse si son de la misma red**. El solapamiento colineal entre redes distintas es una posición inválida en el editor y un diagnóstico bloqueante si llega a existir por importación | R2 §6, R5 §4 |
| El cruce perpendicular sigue siendo válido y no conecta | R2 §6 |
| Un cable puede pasar visualmente por encima de un aparato | R1 §8 |
| **Un borne admite varios cables.** Un número pequeño junto al tornillo indica cuántos tiene. Sin límite definido por ahora | R5 §6 |
| Dos aparatos no pueden superponerse | R5 §1 |
| Cada cable tiene **color** (paleta fija) y uno de **tres calibres**. Se eligen en la herramienta Cable, que recuerda lo último usado, y se cambian después en Propiedades | R5 §3, R5 §5 |
| En reposo el cable se ve con su color, un poco oscuro; **al quedar energizado se ilumina y proyecta un brillo de su mismo color**, tanto si lleva fase como si lleva neutro | R5 §3 |
| Borrar un cable lo borra **entero**. Borrar un aparato borra también los cables que llegan a sus bornes | R5 §4 |

## 5. Edición

| Decisión | Origen |
|---|---|
| **Dos maneras de mover**, con las mismas reglas de conexión y reparación y con vista previa válida o inválida: **arrastrar** con Seleccionar (apretar sobre un objeto, arrastrar, soltar) y la herramienta **Mover (M)** (clic toma, el objeto sigue al cursor, otro clic lo coloca) | R2 §2, R4 §1 |
| Se arrastran aparatos, textos y también **cables**: un tramo solo se desplaza en perpendicular. Sobre algo seleccionado se arrastra toda la selección | R4 §2, I9 |
| Soltar un arrastre en una posición **inválida** lo **devuelve a su lugar**, con el motivo en la barra de estado. Un arrastre confirmado es una sola entrada de historial | R4 §1 |
| Con algo tomado con Mover, las **flechas** lo desplazan una casilla (`Mayús`: cinco) y **`Enter`** lo suelta | R4 §3 |
| Mover un aparato **no rompe** sus conexiones: sus cables se reacomodan ortogonalmente hasta la nueva posición de cada borne | R1 §6, R2 §2 |
| Mover un **tramo** de un cable: perpendicular a sí mismo; los tramos vecinos del mismo cable se estiran, se acortan o generan codos; siempre ortogonal; la conectividad no cambia | R2 §3 |
| No hay tramos "fijados": un ajuste manual puede repararse después al mover un aparato conectado | R2 §3 |
| Los aparatos **se giran de a 90°** con `R`: gira lo seleccionado o, si hay uno en la mano, el que se está colocando. Cada giro es una entrada de historial y los cables se reacomodan como al mover. Las marcaciones y la etiqueta se siguen leyendo derechas | R5 §19 |
| Dos maneras de borrar: seleccionar + `Supr`, o la herramienta Borrar | R1 §11 |
| Herramienta **Borrar (B)**: sigue activa tras cada clic; borra solo con clic explícito (nunca al pasar el mouse ni manteniendo el botón); sin diálogos de confirmación. La recuperación es deshacer | R1 §11, R2 §5 |
| Prioridad de la goma: **cable → texto → aparato** | R2 §5, R3 Q3.6, R5 §4 |
| Historial: **cada clic de la goma es una entrada** (cuatro clics, cuatro deshacer). Una acción que por definición borra varias cosas, o una acción masiva sobre una selección múltiple, es **una** entrada | R1 §12, R2 §5, R2 §30.1 |
| Copiar, pegar y duplicar: `Ctrl+C`, `Ctrl+V`, `Ctrl+D`. IDs nuevos, etiquetas sin colisión y los cables internos de lo seleccionado preservados | R2 §13 |

## 6. Catálogo

| Decisión | Origen |
|---|---|
| **Cada aparato se dibuja como su base**, con los bornes de tornillo numerados y su esquema IEC adentro (bobina, contactos, lámpara). Los contactos se mueven al conmutar | R5 §1 |
| Catálogo: acometida **monofásica, bifásica y trifásica** · **taco de 1, 2 y 3 polos** (interruptor manual, sin disparo) · **contactor 3P con 1NA y 1NC** · **relé de 8 y de 11 pines** · **temporizador TON** y **temporizador TOF** · **pulsador NA** y **pulsador NC** · **parada de emergencia** · **interruptor mantenido NA/NC** · **selector de 3 posiciones** · **piloto** · **foco** · **UPS / inversor** · **texto libre** | R5 §7–§13 |
| **Contactor**: los tornillos de potencia se dibujan más grandes que los de mando; **A1 y A2 van arriba**, entre 1/L1, 3/L2 y 5/L3, y un poco más altos | R5 §9 |
| **Pulsadores**: un solo contacto, con un borne arriba y otro abajo, como el piloto. Adentro va solo el símbolo, sin tapa redonda, y se accionan con clic sobre el cuerpo | R5 §7 |
| **Piloto**: el círculo del símbolo es el que se enciende; no lleva un lente aparte | R5 §10 |
| En la interfaz el temporizador a la desconexión se llama **TOFF** (con dos efes), no TOF; el tipo interno sigue siendo `timer-tof`. Cada temporizador lleva **TON** o **TOFF** escrito en su carátula: es lo único que los distingue a simple vista | R5 §22 |
| El borne se identifica con su **número dentro del tornillo**; no se imprime la marcación larga (1/L1, 2/T1), que queda como ayuda al pasar el cursor | R5 §18 |
| **Monitor de energía**: cuerpo tipo contactor, cuatro polos (A B C N) de arriba (entrada) hacia abajo (salida), con una flecha que marca el sentido, y **un testigo por fase de entrada contra el neutro de entrada**. Arranca cerrado; un clic abre los cuatro polos, que es como se simula que corta. No mide ni muestra valores | R5 §24 |
| **Protector de fase**: se alimenta por A1–A2, que **solo encienden su testigo** (no conducen), y avisa por un contacto conmutado 11 común, 14 NA, 12 NC. Arranca sano (11–14); un clic simula la falla y pasa a 11–12 | R5 §24 |
| Los tornillos de una **base enchufable** van donde están en el zócalo real. En la de 11 pines: cuatro arriba (8 7 6 5), cuatro abajo (10 11 1 2), el **9 en el costado izquierdo** y el **4 y el 3 en el derecho**, con el 9 y el 3 a la misma altura | R5 §20 |
| Fuera del catálogo: motores, relé térmico y los componentes sueltos de la versión clásica (bobina, contactos, contactos temporizados) | R5 §12 |
| La semántica del selector la define el equipo y puede refinarse al probar la interacción | R2 §12 |
| Marco de título: para una versión posterior | R2 §14 |

## 7. Referencias y diagnósticos

| Decisión | Origen |
|---|---|
| Los contactos viven **dentro del aparato**: ya no existe el vínculo contacto → bobina por referencia, ni sus diagnósticos bloqueantes | R5 §1 |
| Una etiqueta repetida (dos `K1`) es un **aviso**, no un error | R2 §10, R5 §1 |
| Hay dos severidades: **avisos** y **errores que bloquean** la simulación. Bloquean: solapamiento de redes distintas, aparatos superpuestos y cualquier inconsistencia estructural que vuelva ambiguo el circuito | R2 §30.2, R5 §4 |
| El diagnóstico indica claramente qué corregir y permite navegar hasta el objeto | R2 §10, R2 §30.2 |

## 8. Archivos, exportación y ejemplos

| Decisión | Origen |
|---|---|
| Los tableros **viven en el servidor**. Cualquiera que tenga acceso a la app puede ver y editar cualquiera de ellos. Todos van en **una sola lista**, sin carpetas | R6 §1 |
| El guardado es **automático**: no hay botón Guardar | R6 §2 |
| La lista va en una **barra a la izquierda que se puede ocultar**, con buscador, Nuevo, Renombrar, **Clonar** y Borrar | R6 §3, R6 §7 |
| Guardar y abrir pasan a ser **Exportar** (descarga el JSON) e **Importar** (sube un JSON y lo agrega a la lista como tablero nuevo). El JSON sigue legible y versionado | Spec §14, R2 §27, R6 §4 |
| Los archivos de la versión clásica **no se abren**: al detectarlos se avisa con un mensaje claro. Sin migración | R5 §15 |
| **Un editor por tablero a la vez.** Al abrir un tablero que nadie está editando se entra editando; si alguien lo edita, se entra en **solo lectura** y los cambios del otro se ven en vivo. «Editar» toma el turno **al instante** y quien editaba pasa a solo lectura | R6 §5 |
| En solo lectura **se puede simular**: la simulación no modifica el documento | R6 §5 |
| Se muestra **quién está editando**. El nombre sale de la cuenta con la que se entra a la red (Tailscale); sin esa cuenta, de un apodo opcional que se guarda en el navegador | R6 §6 |
| Los nombres de la lista **no se repiten**: si uno ya existe, se le agrega un número al final, «Nombre (2)». Lo mismo al crear, renombrar, clonar, importar o restaurar | R6 §10 |
| Si a quien editaba le toman el turno con cambios todavía sin guardar, esos cambios **no se pierden**: quedan en una copia numerada y se le avisa | R6 §10 |
| Borrar manda el tablero a la **papelera**, desde donde se restaura durante **30 días**; después se elimina solo | R6 §8 |
| Los **ejemplos** no son tableros compartidos: «Nuevo desde ejemplo» crea una copia en la lista | R6 §9 |
| Las copias de seguridad quedan **solo en el servidor**; quien quiera una copia propia exporta el JSON | R6 §12 |
| **Exportar a PDF e imagen**: el diagrama tal como se ve, sin autor, fecha, versión ni metadatos | R2 §14 |
| Exporta el **diagrama completo** con margen, aunque no entre en pantalla; con los colores del estado eléctrico si se exporta en simulación o en ERROR; nunca la grilla ni la selección; formatos **PNG, PDF y SVG** | R3 Q3.7 |
| La exportación sale con **fondo blanco**, no con el color de hoja del lienzo | R5 §16 |
| Al menos un **circuito de ejemplo** para abrir, simular y validar visualmente | R2 §30.4 |

## 9. Plataforma

| Decisión | Origen |
|---|---|
| La simulación y la edición corren en el navegador. El servidor entrega los assets y **guarda los tableros** | R2 §23, R6 §1 |
| El cliente detecta cuándo hay una versión nueva y no queda atado a una versión vieja en caché | R2 §23 |
| La app **corre dentro de un contenedor**, para desplegarla fácil. El proveedor concreto queda abierto: no afecta el código | R3 §11 |
| Sin requisito de funcionamiento offline; no usar Service Worker es compatible | R2 §24 |
| Navegadores objetivo: **Chrome, Edge y Firefox** de escritorio. Móvil best-effort | R2 §25 |
| Lienzo que se siente **infinito**, con desplazamiento, zoom y snap a grilla fluidos | R2 §21, R2 §30.3 |
| Grilla de 10 px al 100 %, zoom de 25 % a 400 %, como valores ajustables | R2 §21, I17 |
| **Toda la interfaz en español**, con atajos coherentes con los nombres en español (`B` Borrar, `M` Mover). Textos centralizados para poder agregar idiomas sin reescribir componentes | R2 §26, R2 §30.8 |
| Cada botón de herramienta muestra **su tecla** al lado del ícono, en gris claro | R4 §4 |
| El texto libre se crea solo con la herramienta **Texto (T)** de la barra; la biblioteca no tiene sección de anotaciones | R4 §9 |
| La **etiqueta del aparato** (`K1`) y su descripción van **dentro del cuerpo** del aparato | R4 §7, R5 §1 |
| **Solo modo claro**: no hay modo oscuro ni botón de tema. El lienzo usa un fondo tipo **hoja, apenas amarillo**, nunca blanco puro | R5 §16 |
| Sin telemetría ni analítica; sin requisitos regulatorios identificados | R2 §30.6 |
| **Sin edición simultánea**: un editor a la vez por tablero, los demás miran en vivo (§8) | R6 §5 |
| **Acceso solo por Tailscale**: la app no queda publicada en internet y las reglas de la red dejan llegar únicamente al puerto de la app. Sin contraseña propia | R6 §11 |
| **Actualizar** es traer el repo al servidor (`git pull`) y relanzar: los tableros y la configuración sobreviven | R6 §13 |
| Todos los datos del servidor (la base y sus copias) viven en la carpeta **`datos/` del proyecto**, montada en el contenedor y fuera de git. Bajar o reconstruir los contenedores no la toca; borrar esa carpeta sí borra los tableros | R6 §15 |
| Se puede levantar entera **en modo desarrollo**, sin Tailscale | R6 §14 |
| La accesibilidad avanzada puede evolucionar después, pero sin diseñar en su contra | R2 §30.8 |
| Documentación interna en el repo: cómo levantar el entorno, ejecutar, probar, la estructura y las convenciones; glosario opcional | R2 §30.5 |
| Stack aprobado: SVG · React + TypeScript + Vite · Zustand · deshacer con copias inmutables · Vitest + Playwright (Chromium y Firefox) · pnpm · git local sin remoto. (Se aprobó Node 20; se usa Node 24 porque el 20 perdió soporte: ver [STATUS.md](../STATUS.md)) | R3 Q3.2 |

Mapa de teclas: [ATAJOS.md](ATAJOS.md). Confirmadas por producto: `B`, `M`, `Esc`, `Ctrl+Z`,
`Ctrl+Y`, `Ctrl+C`, `Ctrl+V` (R2 §31); el resto es la propuesta aceptada en I7.

## 10. Pruebas exigidas

Las pruebas son un requisito fuerte del producto (R2 §22):

- Las operaciones topológicas deben poder probarse **sin UI**.
- Cobertura de: colocar y mover aparatos, trazar y mover cables, partir y unir redes, borrar,
  deshacer/rehacer, cortos, oscilaciones, temporizadores, posiciones inválidas, exportación e
  importación, cruces sin conexión, solapamientos bloqueantes, copiar/pegar y simulación completa.
- Pruebas **end-to-end completas**, no solo unos pocos flujos críticos.

Casos obligatorios (R1 §14), además de los de la spec §18:

| Área | Casos |
|---|---|
| Cables | un cable une dos bornes y no se puede terminar en el aire · la goma lo borra entero · no puede solaparse con un cable de otra red · dos cables de la misma red sí pueden compartir recorrido |
| Bornes | un borne acepta varios cables · el número junto al tornillo refleja cuántos tiene · dos bornes en la misma posición no quedan conectados |
| Movimiento | mover un aparato conectado conserva la conectividad y reacomoda sus cables · ningún movimiento inventa una conexión con un cable que se cruza · deshacer devuelve posición y geometría |
| Borrado | clic sobre un cable = una transacción · borrar un aparato borra sus cables · cuatro clics = cuatro entradas · `Ctrl+Z` restaura solo el último · la herramienta sigue activa |
| Cruces | dos cables cruzados siguen en redes distintas · un cable que pasa sobre un borne ajeno no conecta |
| Aparatos | los contactos internos conmutan con su bobina · un contacto NC abre al energizar · los temporizados esperan el preset |
| Cortos | L–N directo → ERROR · fase de A con neutro de B → ERROR · fases de dos acometidas en un nodo → ERROR · la salida de la UPS unida a la red → ERROR · el estado queda congelado para inspección |

## 11. Interpretaciones aceptadas (I1–I18)

Reglas que el equipo propuso por delegación o por inferencia y que producto aceptó. En el plan se
citan con la etiqueta **[Interpretación]**. Las que R5 dejó sin efecto (I10, I11 y I14, sobre
vértices y extremos libres) y la que R6 dejó sin efecto (I16, autoguardado local) ya no aparecen; la
numeración de las demás se conserva.

| # | Tema | Regla aceptada | Plan |
|---|---|---|---|
| I1 | "Conductor distinto" (R2 §2) | Significa **de otra red**. Un cable que comparte recorrido con otro de su **misma** red está permitido: eléctricamente no cambia nada | §5.5 |
| I2 | Parada de emergencia | NC. Un clic la acciona y **enclava** (contacto abierto, hongo hundido); otro clic la libera. Inicial: liberada | §11 |
| I3 | Selector de 3 posiciones | I – 0 – II, mantenido, un común y dos salidas. Tres zonas clicables en el aparato durante la simulación. Inicial: 0. Refinable | §11 |
| I4 | Texto libre | Sin rotación, tamaño fijo, editable en el panel o con doble clic. No es eléctrico | §4.1, §11 |
| I5 | Etiquetas al pegar | `K1` → `K2`: cada aparato pegado recibe el siguiente número libre de su prefijo | §12 |
| I6 | Pegado | Lo pegado aparece "tomado" y se coloca con un clic, con las mismas reglas que Mover | §12 |
| I7 | Mapa de teclas | `S` Seleccionar · `C` Cable · `T` Texto · `E` Ejecutar/detener simulación · `A` Ajustar vista · `Ctrl+D` Duplicar · `Supr` borrar selección · `Espacio`+arrastrar desplazar | §6.4 |
| I8 | Gestos de la herramienta Cable | Empieza y termina con un clic **sobre un borne**; los clics intermedios fijan codos; `Retroceso` deshace el último codo; `Esc` descarta el trazado. No se puede terminar en el aire | §6.3 |
| I9 | Mover con selección | Clic sobre algo seleccionado toma toda la selección; si no, solo ese objeto. La herramienta sigue activa tras colocar | §6.2 |
| I12 | `Ctrl+Z` con algo tomado | Equivale a `Esc`: suelta sin cambios, no toca el historial | §6.2 |
| I13 | Seleccionar y arrastre | Arrastrar desde un espacio vacío dibuja el rectángulo; arrastrar desde un objeto lo mueve | §6.1 |
| I15 | Preset de temporizadores | En segundos con coma decimal, mínimo 0,1 s, máximo 3600 s, resolución 0,01 s | §10.4 |
| I17 | Grid y zoom | 10 px al 100 %, zoom de 25 % a 400 %, como valores ajustables | T-11 |
| I18 | Avisos no bloqueantes | Etiqueta repetida (dos `H1`) y aparato puenteado (incluye L y N unidos por un cable: la simulación arranca y entra en ERROR para mostrar el corto). En el código: `REF_REPEATED`, `BYPASSED` | §8 |
