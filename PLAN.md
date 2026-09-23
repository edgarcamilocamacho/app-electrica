# Plan de implementación — Electrical Control Circuit Simulator

> **Implementación:** V1 completa — estado, limitaciones y desviaciones en [STATUS.md](STATUS.md).
> **Estado del plan:** **v0.5 — LISTO PARA IMPLEMENTAR.** Incorpora las rondas 1, 2 y 3, el agregado del contenedor y los pedidos posteriores a V1 (§0.4). **Sin decisiones abiertas que afecten el código.**
> **Fuente de verdad del producto:** [electrical_control_simulator_spec.md](electrical_control_simulator_spec.md), modificada por [docs/DECISIONES.md](docs/DECISIONES.md) (estado vigente de las tres rondas de respuestas). **Ante contradicción prevalece DECISIONES.md.** Las etiquetas `[R1 §n]`, `[R2 §n]` y `[R3 Qn]` de este plan remiten a su columna «Origen».
> **Contexto para sesiones nuevas:** [CLAUDE.md](CLAUDE.md)
> **Rondas de preguntas:** cerradas. Los cuestionarios (`QUESTIONS1–3.md`) y el prompt inicial (`AGENT_PROMPT.md`) se retiraron del repo y quedan en el historial de git; las decisiones están en las respuestas de cada ronda y en el §2.

---

## 0. Trazabilidad y cambios

### 0.1 Origen de cada decisión

La ronda 2 pidió explícitamente no presentar como decisión de producto algo que no se decidió. Por
eso, cada decisión relevante de este plan lleva una etiqueta de origen:

| Etiqueta | Significa |
|---|---|
| **[Spec §n]** | Está en la especificación original |
| **[R1 §n]** / **[R2 §n]** / **[R3 Qx]** | Decidido por producto en la ronda 1, 2 o 3 |
| **[Técnica]** | Propuesta del equipo técnico. **No confirmada por producto.** Puede cambiar sin reabrir decisiones de producto. Las que producto aprobó en la ronda 3 están marcadas en el §2.2 |
| **[Interpretación]** | Algo que producto delegó o que el equipo tuvo que inferir. **Las 18 (I1–I18) fueron aceptadas por producto en la ronda 3** y están listadas en [docs/DECISIONES.md §11](docs/DECISIONES.md); se conserva la etiqueta para que se vea de dónde salió cada regla |
| **[R3 §11]** | Agregado posterior a la ronda 3: la app corre en un contenedor |
| **[R4 §n]** | Pedido de producto posterior a V1 (2026-09-22). Ver §0.4 |

### 0.2 Qué cambia en las v0.4 y v0.5 (ronda 3 y agregado del contenedor)

| Tema | Decisión | Dónde |
|---|---|---|
| T sin punto, puntos coincidentes de redes distintas y cable sobre terminal ajeno | **Inválidos al editar y bloqueantes si existen**, igual que el solapamiento. La validez pasa a ser una propiedad del estado del diagrama | §1.1, §5.5, §8 |
| Stack técnico | **Aprobado completo**; git solo local, sin remoto | §2.2 |
| Soltar un componente con ambos terminales sobre el mismo tramo recto | **Se inserta en serie** | §5.2, §5.6 |
| Contactos temporizados | **Dos genéricos** (NO y NC), símbolo derivado del timer vinculado. Contacto común solo con bobinas; temporizado solo con timers | §8, §11 |
| Rotar en el lugar hacia una posición inválida | **Se rechaza** con motivo | §6.2 |
| Prioridad de la goma | Vértices → **segmento → texto → componente**; en un terminal con un solo cable gana el componente | §7.1 |
| Exportación | **Diagrama completo**, **colores tal como se ven**, formatos **PNG, PDF y SVG** | §15 |
| Estado inicial de controles manuales | **`estadoInicial` es propiedad del documento** | §11 |
| Interpretaciones I1–I18 | **Aceptadas todas** | — |
| Despliegue | **La app corre dentro de un contenedor** [R3 §11]. El proveedor concreto (Q3.9) deja de afectar el diseño: la política de caché viaja dentro de la imagen | §16 |

### 0.3 Qué cambió en la v0.3 respecto de la v0.2 (ronda 2)

| Elemento de la v0.2 | Estado | Ahora | Origen |
|---|---|---|---|
| RTO: runtime, símbolo, contactos, mecanismo de reset, tests | ❌ **Eliminado** | V1 = **TON + TOF**. Cualquier mención a TP o RTO desaparece | R2 §1 |
| Mover componentes arrastrando (estado `DRAGGING`, coalescencia de arrastre) | ❌ **Anulado** | Herramienta **Mover (`M`)**: clic toma, clic coloca. Sin arrastre sostenido | R2 §2 |
| Refinar ruta arrastrando un segmento | 🔄 **Cambiado** | Mismo esquema clic-tomar-clic, restringido al eje perpendicular del segmento | R2 §3 |
| Al mover, cualquier terminal que cae sobre un segmento conecta | 🔄 **Acotado** | Solo conectan terminales **libres**. Un terminal ya conectado no puede caer sobre otro conductor. Un terminal inválido invalida toda la colocación | R2 §2 |
| Goma con `E`; junction no borrable; clic en esquina borra un segmento | 🔄 **Cambiado** | Goma con **`B`**. Clic en junction borra todo lo incidente (y el componente ligado). Clic en esquina borra **los dos** segmentos. Los vértices tienen prioridad | R2 §5 |
| Solapamiento entre redes distintas: término de coste β + aviso | 🔄 **Endurecido** | **Restricción dura**: la posición es inválida al editar; si igual existe, **bloquea** la simulación | R2 §6 |
| Solapamiento colineal dentro de la misma red: se dejaba | 🔄 **Cambiado** | Se **normaliza** automáticamente en la canonicalización (§4.5) | R2 §7 |
| Router sin A* | ⚠️ **Revisado** | La restricción dura hace que una posición sin ruta válida sea inválida. Se amplían las candidatas y el A* vuelve como respaldo (§5.4) | Técnica |
| Referencia de contacto rota → aviso, contacto tratado como OFF | 🔄 **Endurecido** | **Bloquea** la simulación. Nunca se asume OFF | R2 §10 |
| Copiar / pegar "si hay tiempo" | ➕ **Obligatorio** | Entra en V1 | R2 §13 |
| Exportación a PDF / imagen fuera de V1 | ➕ **Agregado** | Entra en V1 | R2 §14 |
| Autoguardado "recomendado" | ➕ **Obligatorio** | Entra en V1 | R2 §28 |
| E2E limitados a los 6 escenarios críticos | ➕ **Ampliado** | E2E amplios desde V1, uno por flujo funcional | R2 §22 |
| Atajos en inglés (`V`, `W`, `E`) | 🔄 **Cambiado** | Atajos coherentes con español. `B` y `M` confirmados, el resto propuesto (§6.4) | R2 §26, §31 |
| Panel de diagnósticos con avisos | 🔄 **Ampliado** | Dos severidades: **aviso** y **error bloqueante** (§8) | R2 §30.2 |
| Stack presentado como ADRs decididos | 🔄 **Re-etiquetado** | Propuestas técnicas pendientes de aprobación (aprobadas después en la ronda 3) | R2 §19 |
| — | ➕ **Nuevo** | Demo incluida, documentación interna, i18n desde el inicio, sin telemetría | R2 §30 |

**Se mantiene sin cambios de la v0.2:** grafo de vértices y segmentos, canonicalización como pieza
central, extremos libres, borrado de componente sin cascada, geometría como dato del documento,
conectividad nunca geométrica, cargas que sensan, las tres reglas de cortocircuito.

### 0.4 Ronda 4 (2026-09-22, después de V1)

| Tema | Decisión | Origen | Dónde |
|---|---|---|---|
| Mover arrastrando | **Se agrega** además de Mover (`M`): arrastrar con Seleccionar mueve lo que está bajo el cursor (o toda la selección). Anula "sin arrastre" de R2 §2 | R4 §1 | §6.1 |
| Soltar un arrastre en una posición inválida | **Vuelve a su lugar**, con el motivo | R4 §1 | §6.1 |
| Arrastrar cables | **Sí**: un tramo solo se desplaza en perpendicular, como con Mover | R4 §2 | §6.1 |
| Mover con el teclado | Flechas desplazan lo tomado (`Mayús`: 5), `Enter` suelta | R4 §3 | §6.2 |
| Barra de herramientas | Cada herramienta muestra su tecla al lado del ícono | R4 §4 | — |
| Texto libre | Solo desde la herramienta Texto (T); se quita la entrada duplicada de la biblioteca | R4 §9 | §6.1 |
| Modo oscuro | Intercambiable desde la barra; por defecto sigue al sistema | R4 §5 | §15 |
| Textos del componente | Referencia, descripción y tiempo del temporizador apilados contra el contorno del símbolo (sin las patas): abajo a la derecha si está vertical; justo debajo y centrados si está horizontal. L y N de la fuente pasan a la izquierda del cable [Técnica] | R4 §7, §8 | — |
| Modo oscuro en el lienzo | El lienzo y los íconos de la biblioteca también se oscurecen (paleta oscura del diagrama); la exportación sigue con la clara | R4 §6 | §15 |

### 0.5 Ronda 5 (2026-09-22, refactor a vista gráfica de tablero)

La versión anterior —esquema IEC con representación dispersa— queda congelada en el tag `classic`.
Los puntos de esta ronda son los que citan las etiquetas `R5 §n` de
[docs/DECISIONES.md](docs/DECISIONES.md) y de los comentarios del código.

| # | Decisión |
|---|---|
| R5 §1 | **Vista gráfica de tablero**: cada aparato se dibuja como su base, con los bornes de tornillo numerados y su esquema IEC adentro. Reemplaza la representación dispersa (bobina y contactos sueltos unidos por referencia). Los aparatos no rotan ni se superponen; la etiqueta va dentro del cuerpo |
| R5 §2 | Acometidas **monofásica, bifásica y trifásica**, dibujadas como la bajada de un poste. Internamente, varias fuentes independientes con el neutro unido |
| R5 §3 | Los cables llevan **su propio color**, un poco oscuro; al energizarse **se iluminan** y proyectan un brillo de su mismo color |
| R5 §4 | Un cable une **exactamente dos bornes**, empieza y termina en un tornillo, y solo puede solaparse con otro de su misma red. Sin empalmes en el aire ni extremos libres |
| R5 §5 | **Tres calibres** de cable |
| R5 §6 | Un **número pequeño** junto al borne indica cuántos cables tiene. Sin límite definido por ahora |
| R5 §7 | **Pulsadores** con un contacto, un borne arriba y otro abajo, como el piloto; adentro solo el símbolo, sin tapa redonda |
| R5 §8 | **Tacos** de uno, dos y tres polos |
| R5 §9 | **Contactor**: tornillos de potencia más grandes; A1 y A2 arriba, entre 1/L1, 3/L2 y 5/L3 y un poco más altos; 1NA + 1NC |
| R5 §10 | **Piloto** sin doble círculo: el círculo del símbolo es el que alumbra. Se agrega una carga con forma de **foco** |
| R5 §11 | **UPS / inversor**: entrada de alterna que solo enciende su indicador y salida de alterna **constante**, como fuente independiente |
| R5 §12 | Fuera de alcance: motores, relé térmico y cargas entre dos fases |
| R5 §13 | **TON y TOF** son dos aparatos independientes |
| R5 §14 | El cortocircuito **sigue congelando todo** en ERROR |
| R5 §15 | **Sin compatibilidad** con los archivos de la versión clásica |
| R5 §16 | **Solo modo claro**, con el lienzo en un fondo tipo hoja, apenas amarillo; la exportación sale con fondo blanco |
| R5 §17 | Un cable puede quedar **con una punta suelta**: se marca como error y bloquea la simulación, pero se deja armar |
| R5 §18 | El **número del borne va dentro del tornillo**; la marcación larga (1/L1, 2/T1) se imprime dentro del cuerpo |
| R5 §19 | Los aparatos **se giran de a 90°** con `R`. **Reemplaza** a «los aparatos no rotan» de R5 §1 |
| R5 §20 | Los tornillos de una base enchufable van **donde están en el zócalo real**, aunque eso ponga bornes en los costados |

Detalle del refactor y sus hitos: §22.

---

## 1. Interpretación del producto

Lo que construimos **no es un simulador de circuitos**. Es un **editor gráfico de diagramas de
control + un evaluador lógico sobre una topología eléctrica explícita**.

- No hay voltaje, corriente ni impedancia: hay **identidades de fuente** que se propagan por nodos.
- No hay paso de tiempo fijo: hay una **cola de eventos discretos**.
- El estado correcto de un circuito es el **punto fijo** de un sistema booleano. Si no existe
  (oscilación), el producto no adivina: **se congela y muestra el error**.
- El editor es **estricto con la ambigüedad**: lo que se ve tiene que significar una sola cosa.

El usuario es un electricista o técnico en control industrial, que trabaja en español. Dibuja como en
papel: símbolos IEC, líneas ortogonales, referencias `K1` / `K1.1` independientes de la proximidad.

### 1.1 Los cuatro invariantes del diseño

1. **La conectividad es explícita, jamás geométrica.** [R1 §7]
   Dos nodos están unidos **si y solo si** comparten un vértice del grafo. La unión la crea siempre
   una acción de autoría (dibujar, derivar, colocar o soltar un terminal libre), nunca un recálculo
   de geometría. Cruzar no conecta. Pasar por encima no conecta.

2. **El editor no permite crear estados visualmente ambiguos.** [R2 §6, R3 Q3.1]
   Dos redes distintas no pueden tocarse geométricamente sin estar conectadas: ni superpuestas en el
   mismo tramo, ni en T sin punto, ni en un mismo punto, ni con un cable pasando por un terminal ajeno.
   Solo el cruce perpendicular está permitido. Si por importación o por un bug llegara a existir alguno
   de esos casos, la simulación no arranca hasta corregirlo.

3. **El núcleo no conoce el DOM.** [Técnica]
   `core/` es TypeScript puro. Todo lo topológico, eléctrico y temporal se prueba sin UI — como pide
   el §22 de la ronda 2.

4. **El tiempo de simulación es un número, no el reloj del navegador.** [Spec §17]
   El motor avanza con `advanceTo(simTimeMs)`. En producción lo empuja la UI; en los tests, el test.

### 1.2 Qué es dato y qué es derivado

| | Dato del documento (persistido, en el historial) | Derivado (recalculado, memoizado) |
|---|---|---|
| **Componentes** | tipo, posición, rotación, propiedades | posición absoluta de cada terminal |
| **Cableado** | vértices y segmentos con sus coordenadas | nodos eléctricos, grado de cada vértice, qué es junction / esquina / extremo libre |
| **Anotaciones** | texto, posición | — |
| **Diagnósticos** | — | todo |
| **Simulación** | — (nada se persiste) | todo |

### 1.3 Fuera de alcance en V1

Además del §21 del spec: sin colaboración ni multiusuario [R2 §30.7], sin backend, sin offline
[R2 §24], sin telemetría ni analítica [R2 §30.6], sin rotación de grupos, sin sub-circuitos, sin marco
de título [R2 §14], sin pausa ni avance paso a paso [R2 §15], sin temporizadores retentivos ni de
impulso [R2 §1], sin fuentes trifásicas (el modelo queda preparado) [R2 §11], sin soporte móvil
garantizado [R2 §25].

---

## 2. Registro de decisiones

Una sola tabla con todo lo decidido, para no tener que reconstruirlo leyendo tres rondas.

### 2.1 Decisiones de producto

| Área | Decisión | Origen |
|---|---|---|
| **Eléctrica** | Las cargas (lámpara, bobina, timer) sensan y no conducen. Dos cargas en serie no funcionan | R1 §1 |
| | Cortocircuito: L–N directo · fase A con neutro B en el mismo nodo · dos fases distintas en el mismo nodo | R1 §1 |
| | Carga con fase A y neutro B, neutros **no** unidos: **no enciende**, no es corto, no bloquea | R2 §9 |
| | Identidad de fase modelada como `(sourceId, phaseIndex)`; V1 monofásica L/N | R2 §11 |
| | Corto u oscilación → modo ERROR global, congelado, salida solo por acción explícita | Spec §4.3, R1 §1 |
| **Timers** | V1 = **TON y TOF**, cada uno componente visual propio | R2 §1 |
| | `preset` numérico editable; valor actual visible durante la simulación | R2 §1 |
| | Velocidad 0,25× / 1× / 4×; a 1× un timer de 5 s tarda 5 s reales; sin pausa ni paso a paso | R2 §15 |
| **Cableado** | Cada tramo H/V es seleccionable y borrable por separado; un codo no une los dos lados | R1 §3 |
| | Borrar el único enlace parte la red en dos | R1 §3 |
| | Colineales consecutivos sin punto significativo se fusionan | R1 §3 |
| | Colineales **solapados de la misma red** se normalizan | R2 §7 |
| | Iniciar una conexión en medio de un segmento lo parte y crea junction visible | R1 §4 |
| | Colocar un terminal exactamente sobre un segmento conecta y lo parte | R1 §5 |
| | Terminal sobre terminal: conectados, sin necesidad de segmento visible | R2 §8 |
| | Cruces y pasos por encima nunca conectan | R1 §7 |
| | Los cables pueden pasar por encima de símbolos | R1 §8 |
| | Extremos libres permitidos, también creados a propósito; no afectan la simulación; reconectables | R1 §9, R2 §4 |
| | Solapamiento colineal de redes distintas: **impedido** al editar; **bloqueante** si existe | R2 §6 |
| | T sin punto, puntos coincidentes de redes distintas y cable sobre terminal ajeno: **mismo tratamiento** que el solapamiento | R3 Q3.1 |
| | Soltar un componente con ambos terminales libres sobre el mismo tramo recto: **se inserta en serie** | R3 Q3.3 |
| **Edición** | Mover = herramienta `M` (clic toma, clic coloca) **o** arrastrar con Seleccionar | R2 §2, R4 §1 |
| | Al soltar: terminal libre puede conectar; terminal conectado no puede tocar otro conductor; un terminal inválido rechaza todo; con `M` el clic inválido no confirma y el objeto sigue tomado; un arrastre inválido vuelve a su lugar | R2 §2, R4 §1 |
| | Mover un segmento: perpendicular a sí mismo, con `M` o arrastrando; vecinos se estiran o generan codos; sin segmentos "fijados" | R2 §3, R4 §2 |
| | Con `M`: flechas desplazan lo tomado (`Mayús`: 5), `Enter` suelta | R4 §3 |
| | Borrar un componente conserva sus cables como extremos libres | R1 §10 |
| | Goma `B`: clic explícito, sigue activa, sin confirmación, sin borrado continuo | R1 §11, R2 §5 |
| | Goma: junction → todo lo incidente + componente ligado · esquina → ambos segmentos · extremo libre → su segmento · segmento → solo él · los vértices tienen prioridad | R2 §5 |
| | Goma, prioridad restante: segmento → texto → componente; en un terminal con un solo cable gana el componente | R3 Q3.6 |
| | Rotar en el lugar hacia una posición inválida: se rechaza con motivo | R3 Q3.5 |
| | Historial: cada clic de goma = una entrada; una acción masiva = una entrada | R1 §12, R2 §5, §30.1 |
| | Copiar / pegar / duplicar: ids nuevos, referencias sin colisión, topología interna preservada | R2 §13 |
| | Multi-selección para mover y borrar; sin rotación de grupo | Spec §6.5 |
| | `R` rota el preview, el elemento tomado o el único seleccionado | Spec §6.4, R2 §31 |
| **Catálogo** | Mínimo + parada de emergencia + selector de 3 posiciones + texto libre | R2 §12 |
| | Contactos temporizados: dos genéricos (NO, NC); el símbolo se deriva del timer vinculado | R3 Q3.4 |
| | `estadoInicial` de interruptores y selector es propiedad del documento; la simulación no lo modifica | R3 Q3.8 |
| **Referencias** | Contacto con referencia rota → **bloquea** simular | R2 §10 |
| | Dos bobinas con la misma referencia → **bloquea** simular | R2 §10 |
| | Contacto común solo se vincula a bobinas; temporizado solo a timers; otro vínculo → **bloquea** | R3 Q3.4 |
| | Diagnósticos con dos severidades: aviso y error bloqueante | R2 §30.2 |
| **Archivos** | JSON legible y versionado; guardar y abrir | Spec §14 |
| | Autoguardado local con recuperación tras recarga o cierre | R2 §28 |
| | Exportar a PDF e imagen, el diagrama tal como se ve, sin metadatos | R2 §14 |
| | Exportación: diagrama completo · colores de estado si se exporta simulando · formatos PNG, PDF y SVG | R3 Q3.7 |
| | Al menos un circuito de ejemplo incluido | R2 §30.4 |
| **Plataforma** | Client-side; detectar versión nueva y no quedar en caché vieja | Spec §3, R2 §23 |
| | Sin requisito offline; no usar Service Worker es compatible | R2 §24 |
| | **Se distribuye como imagen de contenedor**, para desplegarla fácil en cualquier host | R3 §11 |
| | Chrome, Edge y Firefox de escritorio; móvil best-effort | R2 §25 |
| | UI íntegramente en español; atajos coherentes con los nombres; i18n preparada | R2 §26 |
| | Documentación interna en el repo | R2 §30.5 |
| | Accesibilidad avanzada puede esperar, pero sin diseñar en su contra | R2 §30.8 |
| **Pruebas** | Operaciones topológicas probables sin UI; E2E amplios desde V1 | R2 §22 |

### 2.2 Decisiones técnicas

La ronda 3 aprobó el stack en bloque (Q3.2). La columna **Estado** distingue lo aprobado por producto
de lo que sigue siendo criterio técnico sin revisión explícita.

| # | Decisión | Por qué, en una línea | Estado |
|---|---|---|---|
| T-01 | **SVG** para el lienzo | Hit-testing nativo por segmento; E2E consultan el DOM; exportación vectorial casi gratis | ✅ Aprobada [R3 Q3.2] |
| T-02 | **React 18 + TypeScript strict + Vite** | UI declarativa; Vite da assets hasheados y build id | ✅ Aprobada [R3 Q3.2] |
| T-03 | **Zustand** para el estado de UI | Store manipulable desde tests sin montar componentes | ✅ Aprobada [R3 Q3.2] |
| T-04 | **Undo con snapshots inmutables** (Immer) | Restaura geometría exacta por construcción | ✅ Aprobada [R3 Q3.2] |
| T-05 | **Vitest + Playwright** (Chromium y Firefox) | Núcleo sin DOM + E2E reales en los navegadores objetivo | ✅ Aprobada [R3 Q3.2] |
| T-06 | **Node 20 LTS + pnpm**, un solo paquete | Separación de capas garantizada por lint, no por paquetes | ✅ Aprobada [R3 Q3.2] |
| T-07 | **Sin Service Worker**; `version.json` con `no-store` | Elimina la trampa de clientes clavados | ✅ Compatible [R2 §24] |
| T-08 | **Descarga + input** de archivo como base; **File System Access API** como mejora progresiva | Universal y, en Chromium, `Ctrl+S` guarda en el mismo archivo | ✅ Aprobada [R3 Q3.2] |
| T-09 | **i18n propia y tipada**: diccionario `es.ts` + `t(clave)`; claves faltantes = error de compilación | Sin dependencia pesada; lint prohíbe texto literal en JSX | Técnica |
| T-10 | **jsPDF + svg2pdf.js** para PDF vectorial; PNG vía canvas; SVG directo | La exportación reutiliza el SVG del lienzo | ✅ Aprobada [R3 Q3.2] |
| T-11 | Grid de **10 px** a 100 %, zoom **25 %–400 %** | Defaults ajustables | ✅ Aceptada [R3, I17] |
| T-12 | Coordenadas en **enteros de grid** | Comparaciones exactas en geometría y snapshots | Técnica |
| T-13 | `id` interno opaco (nanoid); `ref` (`K1`) es propiedad editable | Renombrar no rompe cables ni historial | Técnica |
| T-14 | **Git local**, un commit por hito, **sin remoto** por ahora | Revisión del avance en partes | ✅ Aprobada [R3 Q3.2] |
| T-15 | Imagen **multi-etapa**: Node 20 para compilar, **nginx sin privilegios** para servir en el puerto 8080; `compose.yaml` para uso local | Imagen chica, sin root, sin Node en producción; la política de caché viaja con la imagen | Técnica, implementa R3 §11 |

---

## 3. Arquitectura de capas

```
┌──────────────────────────────────────────────────────────────┐
│  app/  (React)                                               │
│  canvas · symbols · panels · toolbar · input(FSM) · i18n ·   │
│  export · store                                              │
└───────────────┬──────────────────────────────────────────────┘
                │ despacha transacciones / lee estado derivado
┌───────────────▼──────────────────────────────────────────────┐
│  core/  (TypeScript puro — sin DOM, sin React, sin textos)   │
│                                                              │
│  history/       transacciones, undo/redo                     │
│  model/         Document: componentes + vértices + segmentos │
│                 + anotaciones                                │
│  topology/      operaciones de edición · canonicalización ·  │
│                 reparación (router) · validez · portapapeles │
│  connectivity/  union-find → nodos eléctricos                │
│  diagnostics/   avisos y errores bloqueantes                 │
│  sim/           solver · settle · dispositivos · timers ·    │
│                 cola de eventos · detección de fallas        │
│  registry/      ComponentDefinition por tipo                 │
│  persistence/   esquema zod · serialización · migraciones    │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│  platform/  Clock · File I/O · Autosave · VersionChecker     │
│             (interfaces inyectables, fakes en tests)         │
└──────────────────────────────────────────────────────────────┘
```

**Reglas verificadas por lint** [Técnica]:
- `core → app | platform | react | dom` prohibido: rompe el build.
- `core/` **no contiene textos para el usuario.** Devuelve códigos y parámetros
  (`{ code: 'REF_ROTA', ref: 'K3' }`); `app/i18n` los traduce. Así el núcleo es independiente del idioma.
- En `app/`, texto literal en JSX prohibido (`no-literal-string`): todo pasa por `t()`.
- Mutar el documento fuera de `history.commit()` prohibido.

### 3.1 Estructura de carpetas

```
app-electrica/
├─ README.md · STATUS.md · PLAN.md
├─ Dockerfile · .dockerignore · compose.yaml
├─ deploy/
│  └─ nginx.conf       política de caché, cabeceras de seguridad, /healthz
├─ docs/
│  ├─ ARQUITECTURA.md · CONVENCIONES.md · GLOSARIO.md · ATAJOS.md
│  └─ producto/   spec + rondas de preguntas y respuestas
├─ src/
│  ├─ core/
│  │  ├─ model/          types.ts · document.ts · geometry.ts · ids.ts
│  │  ├─ topology/       canonicalize.ts · ops/ · repair.ts · candidates.ts ·
│  │  │                  validity.ts · spatialIndex.ts · clipboard.ts
│  │  ├─ connectivity/   unionFind.ts · nets.ts
│  │  ├─ diagnostics/    rules/ · index.ts
│  │  ├─ sim/            solver.ts · settle.ts · devices.ts · timers.ts ·
│  │  │                  eventQueue.ts · engine.ts · faults.ts
│  │  ├─ registry/       sources · switches · coils · contacts · timers ·
│  │  │                  loads · annotations
│  │  ├─ persistence/    schema.ts · serialize.ts · migrations/
│  │  └─ history/        history.ts · transaction.ts
│  ├─ app/
│  │  ├─ canvas/ · symbols/ · panels/ · toolbar/ · input/ · export/ · store/
│  │  └─ i18n/           es.ts · t.ts · format.ts
│  ├─ platform/          clock.ts · files.ts · autosave.ts · version.ts
│  ├─ examples/          *.json (demo, también usados como fixtures E2E)
│  └─ main.tsx
└─ tests/
   ├─ unit/ · integration/ · e2e/ · fixtures/
```

---

## 4. Modelo de documento y topología

### 4.1 Representación

```ts
type Id = string;
type GridPoint = { x: number; y: number };       // enteros, unidades de grid
type Rotation = 0 | 90 | 180 | 270;

interface CircuitDocument {
  schemaVersion: 1;
  metadata: { name: string; createdAt: string; modifiedAt: string };
  components:  Record<Id, ComponentInstance>;
  vertices:    Record<Id, WireVertex>;
  segments:    Record<Id, WireSegment>;
  annotations: Record<Id, TextAnnotation>;
  view?: { pan: { x: number; y: number }; zoom: number };
}

interface ComponentInstance { id: Id; type: ComponentTypeId; position: GridPoint;
                              rotation: Rotation; props: Record<string, unknown>; }

/** Solo dos clases de vértice; todo lo demás se deriva del grado. */
type WireVertex =
  | { id: Id; kind: 'point';    position: GridPoint }
  | { id: Id; kind: 'terminal'; componentId: Id; terminalId: string };  // posición derivada

/** Un tramo recto horizontal o vertical: la unidad primitiva. */
interface WireSegment { id: Id; a: Id; b: Id; }

interface TextAnnotation { id: Id; position: GridPoint; text: string; }
```

**Anotaciones separadas de componentes** [Técnica]: no tienen terminales, no participan en la
topología ni en la validez, y así ninguna regla eléctrica tiene que excluirlas con casos especiales.
Sí participan en selección, Mover, Borrar, copiar/pegar, historial, persistencia y exportación.

### 4.2 Lo visual se deriva del grado

| Clase | Grado | Qué es | Dibujo |
|---|---|---|---|
| `point` | 1 | **extremo libre** | círculo abierto ○ |
| `point` | 2 no colineal | **esquina** | solo el codo; los dos segmentos siguen siendo independientes |
| `point` | ≥ 3 | **junction** | punto lleno ● |
| `terminal` | 1 | terminal conectado | nada especial |
| `terminal` | ≥ 2 | terminal que es también nodo de unión | punto lleno ● |
| dos `terminal` unidos por segmento de longitud 0 | — | **terminal sobre terminal** [R2 §8] | punto lleno ● [Interpretación] |

`point` de grado 0 o de grado 2 colineal no existen en forma normal: la canonicalización los elimina.

### 4.3 Posición derivada del terminal

```
pos(v) = componente.position + rotar(definición.terminales[v.terminalId].offset, componente.rotation)
```

Mover un componente mueve sus vértices terminales; los segmentos siguen apuntando a los mismos
vértices. La conectividad no puede romperse al mover porque no depende de coordenadas; solo hay que
reparar la ortogonalidad (§5.3).

### 4.4 Terminal sobre terminal [R2 §8]

Un vértice liga un solo terminal. Dos terminales en el mismo punto se representan como **dos vértices
`terminal` unidos por un segmento de longitud cero**: invisible como cable, dibujado como ●. Tiene una
propiedad valiosa: si después se aleja uno de los componentes, la reparación convierte ese segmento
degenerado en un cable real y **la conexión se conserva sola**. [Técnica]

### 4.5 Canonicalización

Corre tras **toda** mutación topológica, dentro de la misma transacción, **hasta punto fijo**.
Garantiza que un circuito tenga una sola representación posible — sin eso, la comparación exacta de
documentos del §18.5 del spec no tiene sentido.

**Solo opera dentro de una misma red.** Nunca resuelve coincidencias entre redes distintas: eso es
trabajo del validador (§5.5).

| Paso | Qué hace | Por qué |
|---|---|---|
| 1 | Segmento de longitud cero → fusiona sus vértices. **Excepción:** si ambos son `terminal`, se conserva (§4.4) | limpieza tras reparaciones |
| 2 | Segmentos duplicados (mismo par de vértices) → se conserva uno | limpieza |
| 3a | Dos vértices **de la misma red** en la misma posición → se fusionan (salvo `terminal`+`terminal`, ver 4.4) | coherencia geometría↔topología |
| 3b | Vértice **de la misma red** en el interior de un segmento → se parte el segmento y se une | coherencia geometría↔topología |
| 4 | Fusión de colineales: se elimina `V` si es `point`, grado 2, colineal y **estrictamente entre** sus vecinos | R1 §3 |
| 5 | Vértices `point` de grado 0 → se eliminan | limpieza |

**Cómo sale el solapamiento de la misma red [R2 §7] sin un paso propio.** Con `A(0,0)–B(5,0)` y
`C(2,0)–D(8,0)` en la misma red: 3b parte `AB` en `C` y `CD` en `B` → aparecen `A–C`, `C–B`, `C–B`,
`B–D`; el paso 2 elimina el duplicado; el paso 4 fusiona en `C` y en `B` → **un único `A(0,0)–D(8,0)`**.
Tres reglas simples producen la normalización pedida.

**Invariante verificado en cada test y en los builds de desarrollo:**

```
particiónDeNodos(canonicalize(g)) === particiónDeNodos(g)
```

Todos los pasos operan dentro de una red, así que nunca unen ni separan redes. La terminación está
garantizada: cada paso reduce una medida finita (segmentos, vértices o incidencias
vértice-en-interior-de-segmento).

---

## 5. Operaciones de edición, reparación y validez

### 5.1 Principio: toda operación produce un borrador que se valida antes de confirmar

```ts
type EditOp = (doc: CircuitDocument, args) => CircuitDocument;         // pura, canonicaliza al final
function validate(before: CircuitDocument, after: CircuitDocument): Validity;

type Validity = { ok: true } | { ok: false; reasons: InvalidReason[] };
```

Mientras un objeto está tomado, la UI calcula el borrador en cada cambio de celda del grid, lo dibuja
como vista previa y, si `validate` falla, lo muestra en rojo con el motivo y resalta el conductor en
conflicto. **El clic solo confirma si el borrador es válido** [R2 §2]. Lo mismo vale para colocar,
cablear, pegar y rotar.

**Detalle importante: la validez se mide sobre lo que la operación introduce.**
Una operación es válida si no **agrega** violaciones:
`violaciones(después) \ violaciones(antes) = ∅`. Sin esto, un documento importado que ya trae un
solapamiento no podría editarse — ni siquiera para arreglarlo. [Técnica]

### 5.2 Catálogo de operaciones (todas puras, en `core/topology/ops/`)

| Operación | Efecto | Origen |
|---|---|---|
| `drawWire(puntos, inicio, fin)` | crea la cadena; si inicio o fin caen sobre un segmento, lo parten (`connectAt`) | R1 §4, R2 §4 |
| `connectAt(punto)` | sobre segmento → lo parte y devuelve el vértice; sobre vértice → lo devuelve; en el vacío → crea `point` | R1 §4 |
| `placeComponent(tipo, pos, rot)` | coloca; cada terminal que cae exactamente sobre un conductor se conecta | R1 §5 |
| `moveSelection(sel, delta, rot?)` | mueve; los terminales **libres** que aterrizan en conductores se conectan; repara lo incidente (§5.3) | R2 §2 |
| `moveSegment(seg, desplazamiento)` | desplaza perpendicularmente; **nunca crea conexiones** | R2 §3 |
| inserción en serie | dentro de `placeComponent`, `moveSelection` y `paste`: si los dos terminales **libres** de un componente caen sobre el mismo tramo recto, se elimina exactamente el pedazo entre ellos (§5.6) | R3 Q3.3 |
| `rotateComponent(id)` | rota 90° en el lugar; si el resultado es inválido, se rechaza | Spec §6.4, R3 Q3.5 |
| `eraseAt(objetivo)` | semántica de la goma (§7) | R2 §5 |
| `deleteSelection(sel)` | borra todo lo seleccionado en una sola transacción | R2 §30.1 |
| `paste(fragmento, delta)` | inserta con ids y referencias nuevas (§12) | R2 §13 |

### 5.3 Reparación al mover (el "router")

**Conjunto movido** = vértices terminales de los componentes seleccionados + vértices de los segmentos
seleccionados. Cada segmento se trata según cuántos extremos se movieron:

| Extremos movidos | Tratamiento |
|---|---|
| ambos | traslación rígida |
| ninguno | intacto |
| uno | **reparación local**: se reemplaza por la mejor cadena ortogonal válida entre el extremo nuevo y el fijo (§5.4) |

Se procesa en orden de `id` para que el resultado sea determinista, y cada segmento reparado entra en
el índice espacial antes de reparar el siguiente. Después, canonicalización.

**Mover un segmento solo** [R2 §3] sigue la misma lógica con un matiz sobre sus extremos
[Interpretación]: **las esquinas y los extremos libres se desplazan con el segmento**; los
**junctions y terminales quedan anclados** y se inserta un tramo perpendicular nuevo entre el ancla y
la nueva posición. Así, mover un tramo no arrastra ramas ajenas ni despega un cable de un componente.
Y como es una operación puramente geométrica, **nunca crea ni rompe conexiones**.

Verificación contra los ejemplos de la ronda 1 §6:
- Bajar un componente desde una T → el tramo vertical se alarga; el junction no se toca. ✓
- Moverlo en diagonal → aparece un codo nuevo. ✓
- Volver a alinearlo → la canonicalización elimina el codo sobrante; no se acumula basura. ✓

### 5.4 Elección de la cadena: candidatas + respaldo

Con la restricción dura del §5.5, que una reparación no encuentre ruta válida significa que **la
posición es inválida**. Si el conjunto de candidatas es chico, el usuario va a ver demasiadas
posiciones rechazadas en diagramas densos. Por eso se amplía respecto de la v0.2: [Técnica]

1. **Candidatas enumeradas**, en orden de coste
   (`longitud + α·codos − γ·salir en la dirección del terminal`):
   recta (si comparten eje) → dos L → **todas** las Z con la línea intermedia en cada coordenada entera
   del rango → U con excursiones de 1 a K celdas fuera del rectángulo, hacia los cuatro lados.
2. **Filtro de validez** (§5.5) sobre cada candidata: no puede solapar otra red, ni pasar por un
   punto de conexión ajeno (terminales incluidos), ni terminar en el interior de otra red. Gana la
   primera válida. Desempate por `id`.
3. **Respaldo A\*** sobre una ventana acotada del grid, con las celdas y aristas conflictivas
   prohibidas, si ninguna candidata sirve. Determinista.
4. Si tampoco hay ruta → posición inválida, con motivo "no hay ruta sin ambigüedad".

El paso 3 se implementa en el hito M3 solo si los fixtures muestran una tasa de rechazo inaceptable;
si no, queda como mejora de M19.

### 5.5 Validador

Predicados geométricos sobre **puntos de conexión** (todos los vértices + las posiciones de
**todos** los terminales, conectados o no) y segmentos, usando un índice espacial por línea de grid:

| # | Condición inválida | Origen |
|---|---|---|
| V1 | Solapamiento colineal entre segmentos de **redes distintas** | R2 §6 |
| V2 | Punto de conexión de una red en el **interior** de un segmento de otra (T sin punto, cable que pasa por un terminal ajeno) | R3 Q3.1 |
| V3 | Puntos de conexión de redes distintas en la **misma posición** | R3 Q3.1 |
| V4 | Terminal ya conectado que aterriza sobre un conductor de **otra red** | R2 §2 — cubierta por V2 y V3 |
| V5 | Segmento no ortogonal (solo por importación o bug) | Spec §5.2 |

Un cruce perpendicular entre interiores de segmentos, sin punto de conexión en la intersección,
**es válido** [R2 §6]. Un cable sobre el cuerpo de un símbolo **es válido** [R1 §8] — mientras no pase
por uno de sus terminales.

**La validez es una propiedad del estado, no de la transición.** Con V2 y V3 confirmadas, V4 deja de
necesitar una regla propia: un terminal ya conectado que cae sobre otra red deja, por definición, un
punto de conexión en el interior de un segmento ajeno (V2) o sobre un punto ajeno (V3). Por eso **un
único validador** sirve para la vista previa de cualquier operación y para los diagnósticos de un
documento importado. Y queda cerrado el hueco de mover un segmento hasta apoyar su extremo libre sobre
otra red: esa posición es inválida por V2. [Técnica, consecuencia de R3 Q3.1]

**"Conductor distinto" = de otra red** [Interpretación de R2 §2]. Un terminal ya conectado que
aterriza sobre un conductor **de su misma red** no crea una conexión nueva en sentido eléctrico: se
permite, y la canonicalización (3a/3b) lo integra.

### 5.6 Colocar sobre un cable

| Caso | Resultado | Origen |
|---|---|---|
| Un terminal libre cae sobre un segmento | se parte el segmento y el terminal queda en ese vértice → junction ● | R1 §5 |
| Un terminal libre cae sobre un extremo libre | lo reconecta | R1 §9 |
| Un terminal libre cae sobre otro terminal | terminal sobre terminal (§4.4) | R2 §8 |
| El cuerpo del símbolo cruza cables | nada | R2 §2 |
| **Los dos terminales libres** caen sobre **el mismo tramo recto** | **inserción en serie**: se parte el tramo en ambos puntos y se elimina exactamente el pedazo entre ellos | R3 Q3.3 |
| Los dos terminales caen sobre la misma red, pero no en el mismo tramo recto | se conectan ambos; el componente queda puenteado → aviso `COMPONENTE_PUENTEADO` | Técnica |

```text
Antes:                    L ─────────────────────── (H1)
Después de soltar S1:     L ─────[S1]───── (H1)
```

La inserción aplica igual al colocar desde la biblioteca, al mover un componente con ambos terminales
libres y al pegar.

---

## 6. Interacción

### 6.1 Herramientas

| Herramienta | Tecla | Qué hace | Origen |
|---|---|---|---|
| **Seleccionar** | `S` | clic selecciona; `Mayús`+clic suma; arrastrar **desde un espacio vacío** dibuja rectángulo; arrastrar **desde un objeto** lo mueve | Tecla: Técnica · R4 §1 |
| **Cable** | `C` | traza cables ortogonales | Tecla: Técnica |
| **Mover** | `M` | clic toma, clic o `Enter` coloca; flechas ajustan | R2 §2, R4 §3 |
| **Borrar** | `B` | goma, un objeto por clic | R2 §5 |
| **Texto** | `T` | clic crea una anotación y abre su edición | Tecla: Técnica |

**Arrastrar con Seleccionar** [R4 §1, §2]. Apretar sobre un objeto lo deja listo para arrastrar; al
superar 4 px de pantalla empieza el arrastre, que reutiliza el mismo "tomado" de Mover (§6.2): misma
vista previa, mismas reglas, un tramo solo en perpendicular, toda la selección si el objeto ya estaba
en ella. Soltar confirma en **una** transacción; en una posición inválida **vuelve a su lugar** con el
motivo. Por debajo del umbral es un clic: selecciona (y, sobre una selección múltiple, al soltar queda
solo ese objeto). Durante el arrastre: `Esc` cancela, `R` rota, `Mayús` fija el eje dominante; si el
navegador interrumpe el gesto (`pointercancel`), se cancela. [Técnica: umbral, `Mayús`, `Esc`/`R`
durante el arrastre]. Arrastrar desde el vacío sigue siendo el rectángulo de selección.

### 6.2 Mover (clic-tomar / clic-colocar) [R2 §2, §3]

- Con `M` activa, clic sobre un objeto → queda **tomado** y sigue al cursor con snap.
- Si el objeto clicado forma parte de la selección actual, se toma **toda la selección**; si no, solo
  ese objeto. [Interpretación]
- Un **segmento solo** se desplaza únicamente sobre su eje perpendicular; un grupo, en 2D. [R2 §3 +
  Interpretación]
- Vista previa en vivo con la geometría reparada; en rojo y con motivo si es inválida.
- Clic en posición válida → **una** transacción; la herramienta sigue activa.
- Clic en posición inválida → no pasa nada; sigue tomado.
- `R` con un solo componente tomado → rota. Con un grupo tomado → desactivado.
- `Esc` → suelta sin cambios. `Ctrl+Z` estando tomado → equivale a `Esc`, no toca el historial.
  [Interpretación] `Ctrl+Y` también cancela antes de rehacer, y `Supr` no hace nada mientras algo
  está tomado o se arrastra: la vista previa se calculó sobre el documento anterior. [Técnica]
- Clic con `M` sobre un vértice (junction, esquina, extremo libre) → no toma nada. [Interpretación]
- Flechas → desplazan lo tomado una casilla (`Mayús`: cinco); el ancla se corre con el objeto, así el
  mouse lo sigue moviendo desde donde quedó. `Enter` → suelta, igual que el clic. [R4 §3]
- Con `M` activa y nada tomado, una flecha toma la selección. Si el cursor no está sobre el lienzo, el
  primer movimiento del mouse fija el ancla sin hacer saltar el objeto. [Técnica]

**`R` sobre un componente seleccionado y no tomado** [R3 Q3.5]: si la rotación en el lugar produce una
posición inválida, **se rechaza**. La barra de estado explica el motivo y sugiere tomarlo con `M` y
rotarlo con `R` mientras se reubica.

### 6.3 Cable [Interpretación de R2 §4]

- Primer clic: sobre terminal, segmento, vértice o vacío. Sobre un segmento, lo parte (junction).
- Clics siguientes en el vacío: fijan codos.
- Clic sobre un conductor o terminal: termina y conecta.
- `Enter` o doble clic en el vacío: termina con extremo libre ○.
- `Retroceso`: deshace el último tramo del trazado en curso.
- `Esc`: descarta todo el trazado en curso.
- Cada tramo propuesto se valida; si solaparía otra red, se marca en rojo y el clic no se acepta.
- El trazado completo es **una** transacción.

### 6.4 Mapa de teclas

Confirmadas por producto [R2 §31]: `B`, `M`, `R`, `Esc`, `Ctrl+Z`, `Ctrl+Y`, `Ctrl+C`, `Ctrl+V`.
El resto es propuesta [Técnica, R2 §31 lo delega], documentada en `docs/ATAJOS.md`:

| Tecla | Acción | | Tecla | Acción |
|---|---|---|---|---|
| `S` | Seleccionar | | `Ctrl+Z` | Deshacer ✔ |
| `C` | Cable | | `Ctrl+Y` · `Ctrl+Mayús+Z` | Rehacer ✔ |
| `M` | Mover ✔ | | `Ctrl+C` / `Ctrl+V` | Copiar / Pegar ✔ |
| `B` | Borrar ✔ | | `Ctrl+D` | Duplicar |
| `T` | Texto | | `Ctrl+A` | Seleccionar todo |
| `R` | Rotar ✔ | | `Ctrl+S` / `Ctrl+O` | Guardar / Abrir |
| `E` | Ejecutar / detener simulación | | `Ctrl+0` | Zoom 100 % |
| `A` | Ajustar la vista al diagrama | | `Supr` · `Retroceso` | Borrar selección |
| `Esc` | Cancelar ✔ | | `Espacio` + arrastrar · botón central | Desplazar la vista |
| Flechas · `Mayús`+flechas | Con `M`: desplazar lo tomado 1 · 5 casillas ✔ | | Rueda | Zoom hacia el cursor |
| `Enter` | Soltar lo tomado ✔ · terminar el cable | | | |

✔ = confirmada por producto. En macOS, `Cmd` reemplaza a `Ctrl`. Los atajos se ignoran mientras el
foco está en un campo de texto. `Ctrl+D`, `Ctrl+S` y `Ctrl+O` anulan la acción por defecto del
navegador solo mientras el foco está en la app.

### 6.5 Máquina de estados de interacción

```
SELECCIONAR ──arrastre desde vacío──▶ RECTÁNGULO ──soltar──▶ SELECCIONAR
            ──apretar sobre objeto──▶ LISTO ──soltar (< 4 px)──▶ SELECCIONAR (clic)
                                            └─mover ≥ 4 px──▶ ARRASTRANDO ──soltar válido──▶ SELECCIONAR (commit)
                                                                          ├─soltar inválido──▶ SELECCIONAR (vuelve)
                                                                          └─Esc · pointercancel──▶ SELECCIONAR (sin cambios)
librería ──▶ COLOCANDO ──clic válido──▶ COLOCANDO (repetida)  ──Esc──▶ SELECCIONAR
                       └─clic inválido──▶ COLOCANDO (muestra motivo)
M ──▶ MOVER ──clic sobre objeto · flecha con selección──▶ TOMADO ──clic · Enter válido──▶ MOVER (commit)
                                         ├─clic · Enter inválido──▶ TOMADO
                                         ├─flechas──▶ TOMADO (desplazado)
                                         ├─R──▶ TOMADO (rotado)
                                         └─Esc──▶ MOVER (sin cambios)
C ──▶ CABLE ──clic──▶ TRAZANDO ──clic en vacío──▶ TRAZANDO (codo)
                               ├─clic en conductor · Enter · doble clic──▶ CABLE (commit)
                               └─Esc──▶ CABLE (descarta)
B ──▶ BORRAR ──clic sobre objeto──▶ BORRAR (commit por clic)
T ──▶ TEXTO ──clic──▶ crea anotación y la edita
E ──▶ (sin bloqueantes) SIMULANDO ──E / Detener──▶ SELECCIONAR
                                 └─falla──▶ ERROR ──Volver a editar──▶ SELECCIONAR
       (con bloqueantes) ──▶ abre el panel de diagnósticos
```

`Esc` desde una herramienta sin nada en curso vuelve a Seleccionar. Máquina explícita, sin banderas
booleanas sueltas.

### 6.6 Durante la simulación [R2 §16]

**Permitido:** pan, zoom, seleccionar para inspeccionar, propiedades en solo lectura, estado
eléctrico de cada nodo, valor actual de los temporizadores, interactuar con los controles manuales.
**Bloqueado:** Mover, Borrar, Rotar, Cable, Texto, pegar y cambiar propiedades.

### 6.7 Código visual

| Estado | Dibujo |
|---|---|
| Flotante | gris |
| Energizado por fase | naranja (tono por fuente si hay varias) |
| Asociado a neutro | azul |
| Cortocircuito | rojo grueso + parpadeo |
| Vista previa inválida | contorno rojo + conductor en conflicto resaltado + motivo en la barra de estado |

El estado nunca se comunica solo por color: grosor e insignias lo acompañan. [R2 §30.8]

---

## 7. Borrado

### 7.1 Herramienta Borrar (`B`) [R2 §5]

Sigue activa tras cada clic. Sin diálogos. Sin borrado al pasar el mouse. Sin borrado en cadena
manteniendo apretado. Cada clic = **una** transacción.

| Clic sobre | Efecto | Origen |
|---|---|---|
| **Junction ●** | se borran **todos** los segmentos incidentes; si el junction es el terminal de un componente, **el componente también**. Todo en una transacción | R2 §5 |
| **Esquina** | se borran **los dos** segmentos que la forman | R2 §5 |
| **Extremo libre ○** | se borra el segmento completo hasta el siguiente vértice significativo | R2 §5 |
| **Segmento** | se borra solo ese segmento | R2 §5 |
| **Componente** | se borra; sus cables quedan con extremos libres | R1 §10 |
| **Texto** | se borra | Interpretación |

**Prioridad de impacto** [R2 §5, R3 Q3.6]:

1. Junction ●
2. Extremo libre ○
3. Esquina
4. Segmento
5. Texto
6. Componente

Si un cable pasa por encima de un símbolo, un clic justo sobre el cable borra el cable; para borrar el
componente se hace clic en una parte del símbolo sin cable. **Excepción:** en un terminal con un solo
cable (sin ●), el extremo del segmento y el terminal coinciden, y **gana el componente**, porque el
terminal se dibuja como parte del símbolo.

**Terminal sobre terminal** [Interpretación]: el punto ● donde se tocan dos componentes es un junction,
así que la regla literal borra **los dos** componentes. Es la única opción coherente: separar la
conexión dejándolos superpuestos crearía un contacto ambiguo (V3). `Ctrl+Z` lo recupera.

Tras cualquier borrado, los vértices que quedan en grado 1 pasan a ser extremos libres; los de grado 0
desaparecen; canonicalización.

### 7.2 Selección + `Supr`

Borra todo lo seleccionado con las mismas reglas por tipo, en **una** transacción [R2 §30.1].

---

## 8. Diagnósticos [R2 §30.2]

Recalculados tras cada cambio del documento. Mostrados en un panel propio y, para los bloqueantes,
en la barra de estado. Clic en un diagnóstico → el lienzo centra y resalta.

| Código | Severidad | Condición | Origen |
|---|---|---|---|
| `SOLAPE_REDES` | 🛑 Bloqueante | V1: segmentos colineales de redes distintas superpuestos | R2 §6 |
| `CONTACTO_AMBIGUO` | 🛑 Bloqueante | V2 / V3: T sin punto, puntos coincidentes de redes distintas, cable sobre terminal ajeno | R3 Q3.1 |
| `REF_ROTA` | 🛑 Bloqueante | contacto sin referencia, o que referencia una bobina o timer inexistente | R2 §10 |
| `REF_DUPLICADA` | 🛑 Bloqueante | dos bobinas o timers con el mismo `ref` | R2 §10 |
| `REF_TIPO` | 🛑 Bloqueante | contacto común vinculado a un timer, o contacto temporizado vinculado a una bobina | R3 Q3.4 |
| `GEOMETRIA_INVALIDA` | 🛑 Bloqueante | V5, u otra inconsistencia estructural llegada por importación | R2 §30.2 |
| `REF_REPETIDA` | ⚠️ Aviso | `ref` repetido en componentes que no son destino de vínculo (dos `H1`) | Técnica |
| `COMPONENTE_PUENTEADO` | ⚠️ Aviso | los dos terminales de un componente están en la misma red por el cableado (un interruptor que no puede cortar nada; una fuente con L y N unidos, que va a entrar en corto al simular) | Técnica |
| `SIN_CONTACTOS` | ℹ️ Info | bobina o timer sin ningún contacto vinculado | Técnica |

**Iniciar la simulación exige cero bloqueantes.** Si hay alguno, `E` o el botón Simular abren el panel
de diagnósticos en vez de arrancar.

**Diagnóstico bloqueante ≠ error de simulación.** El primero impide arrancar; el segundo (corto,
oscilación) ocurre durante la corrida y lleva a ERROR. Un corto *estático* (L y N unidos por cable)
es solo un aviso (`COMPONENTE_PUENTEADO`), para que la simulación arranque, entre en ERROR y el usuario
vea exactamente dónde está el corto, como pide el spec. [Técnica]

Un extremo libre **no** genera diagnóstico [R1 §9].

---

## 9. Modelo eléctrico

### 9.1 Identidades [R2 §11]

```ts
type SourceId = string;                          // derivado del id interno de la fuente
type LineId   = `${SourceId}:${number}`;         // (sourceId, phaseIndex); en V1 phaseIndex = 0
interface Potential { lines: Set<LineId>; neutrals: Set<SourceId>; }
// lines vacío ∧ neutrals vacío ⇒ flotante
```

Agregar trifásica en el futuro es sumar una fuente con `phaseIndex` 0, 1, 2: el solver no cambia.

### 9.2 `solve`

```ts
function solve(nets, deviceStates): NodeSolution {
  const uf = nets.staticUnionFind.clone();
  // 1. Los que CONDUCEN fusionan nodos: contactos cerrados, interruptores cerrados,
  //    pulsadores accionados, selector en su posición. Las CARGAS no conducen.   [R1 §1]
  for (const d of conducting(deviceStates)) uf.union(net(d.t1), net(d.t2));
  // 2. Inyección de identidades en los nodos ya fusionados.
  for (const s of sources) {
    pot(uf.find(net(s.L))).lines.add(`${s.id}:0`);
    pot(uf.find(net(s.N))).neutrals.add(s.id);
  }
  // 3. Las tres reglas de corto.                                               [R1 §1]
  for (const [root, p] of pot) {
    if (p.lines.size > 1)                          return fault('corto', root, 'fases');
    if (p.lines.size >= 1 && p.neutrals.size >= 1) return fault('corto', root, 'fase-neutro');
  }
  return { uf, pot };
}
```

`L1` y `L2` de una misma fuente trifásica futura serían dos `LineId` distintos → corto por la primera
regla, sin tocar el código.

### 9.3 Energización de cargas [R2 §9]

Una carga (lámpara, bobina, timer) está energizada si y solo si:

```
∃ (s, p):  Line(s, p) en un terminal  ∧  Neutral(s) en el otro
```

Es decir, la fase y el neutro tienen que ser **de la misma fuente**. Con neutros unidos (permitido,
spec §9.3) el nodo neutro contiene `{A, B}` y la condición se cumple para cualquiera de las dos fases.
Con `L_A` y `N_B` sin unir: la carga **no enciende**, no hay corto, no hay bloqueo.

En la inspección de la carga durante la simulación se puede mostrar el motivo ("fase de A, neutro de
B"). [Técnica, deseable]

---

## 10. Motor de simulación

### 10.1 Estado

```ts
interface SimState {
  clockMs: number;
  manual:  Map<Id, ManualState>;     // interruptor · pulsador · parada de emergencia · selector
  coils:   Map<Id, boolean>;
  timers:  Map<Id, TimerRuntime>;    // { phase: 'reposo'|'contando'|'vencido', startedAt, output }
  queue:   EventQueue;               // orden (time, seq) → determinismo total
  mode:    'running' | 'error';
  fault?:  { kind: 'corto'|'oscilacion'; nodes: Id[]; components: Id[]; detail: FaultDetail };
}
```

Los contactos no están en el estado: se derivan de su bobina o timer. Es imposible que se
desincronicen.

### 10.2 `settle` — punto fijo instantáneo

```
seen ← ∅
repetir hasta 1000 veces:
    sol ← solve(nets, state);          si hay corto → ERROR
    next ← evaluar bobinas y salidas de timer (SIN agendar eventos)
    si next == state → estable; salir
    si hash(next) ∈ seen → ERROR oscilación (participantes = lo que cambia en el ciclo)
    seen ← seen ∪ {hash(next)};  state ← next
al converger: reconciliar la cola de timers (agendar subidas, cancelar bajadas)
```

Los timers **no agendan dentro del bucle**: si lo hicieran, un lazo oscilante llenaría la cola de
eventos basura antes de detectarse.

### 10.3 Avance del tiempo y velocidad [R2 §15]

```ts
advanceTo(tMs) {
  let sameInstant = 0;
  while (queue.peek()?.time <= tMs && mode === 'running') {
    const ev = queue.pop();
    sameInstant = ev.time === clockMs ? sameInstant + 1 : 0;
    if (sameInstant > MAX_EVENTOS_MISMO_INSTANTE) return fault('oscilacion', …);
    clockMs = ev.time; applyEvent(ev); settle();
  }
  if (mode === 'running') clockMs = tMs;
}
```

- La UI llama `advanceTo(base + (ahora − t0) × velocidad)` en cada frame. Cambiar la velocidad
  rebasa `t0` y `base`. Velocidades: 0,25× · 1× · 4×.
- Si la pestaña queda oculta y vuelve, el reloj salta y se procesan en orden todos los eventos
  pendientes: el resultado es idéntico al de haberla mirado. [Técnica]
- **Guardia de lazo temporizado** [Técnica]: un TON cuyo propio contacto NC lo desenergiza, con
  preset cero, generaría infinitos eventos en el mismo instante — un lazo que `settle` no ve porque
  cada `settle` sí converge. Doble protección: preset mínimo (§10.4) y tope de eventos en un mismo
  instante, que se trata como oscilación.

### 10.4 Temporizadores [R2 §1]

| Tipo | Entrada ↑ | Entrada ↓ | Salida |
|---|---|---|---|
| **TON** | arranca el conteo, agenda `t + preset` | salida OFF inmediata, cancela el evento, transcurrido vuelve a cero | OFF mientras cuenta; ON al vencer |
| **TOF** | salida ON inmediata, cancela el evento pendiente | agenda `t + preset`; la salida sigue ON | OFF al vencer |

**Preset** [Técnica]: se edita en segundos con coma decimal (`5,5`), resolución 0,01 s, mínimo
**0,1 s**, máximo 3600 s. Se guarda en milisegundos enteros. Validado en el panel y en el esquema.

**Valor actual visible** [R2 §1]: el símbolo muestra una etiqueta compacta (`3,2 / 5,0 s`) mientras
cuenta; el panel de propiedades, en solo lectura, muestra estado, transcurrido, restante y salida. El
transcurrido se calcula como `clockMs − startedAt`, así que en ERROR queda congelado sin esfuerzo.

### 10.5 Modo ERROR

Congela `clockMs`, congela los timers, descarta el evento en curso, `mode ← 'error'`, no procesa nada
más — ni ramas sanas. Salir exige acción explícita. [Spec §4.3, §11.2, §12]

**Panel de error** — requerido [R2 §18]: tipo de falla, tiempo congelado, componentes y nodos
resaltados, botón "Volver a editar". Deseable, sin revisión de producto: lista clicable de
involucrados, secuencia de estados que se repite en una oscilación, qué dos identidades chocaron y por
qué camino en un corto. Se implementa después de lo requerido, dentro del mismo hito.

---

## 11. Catálogo V1 [R2 §12]

| Grupo | Componente | Terminales | Comportamiento en simulación | Props |
|---|---|---|---|---|
| Fuentes | Fuente CA | `L`, `N` | inyecta `Line(id,0)` y `Neutral(id)` | `ref`, `label` |
| Control manual | Interruptor NO / NC | 2 | clic alterna | `ref`, `label`, `estadoInicial` [R3 Q3.8] |
| | Pulsador NO / NC | 2 | actuado mientras se mantiene apretado | `ref`, `label` |
| | **Parada de emergencia** | 2 | NC con enclavamiento (ver abajo) | `ref`, `label` |
| | **Selector de 3 posiciones** | 3 (`C`, `1`, `2`) | ver abajo | `ref`, `label`, `posicionInicial` |
| Relés | Bobina | `A1`, `A2` | carga | `ref` (`K1`), `label` |
| Contactos | Contacto NO / NC | 2 | sigue a su bobina | `ref`, `vinculo` |
| Temporizadores | **TON**, **TOF** — símbolo propio cada uno | `A1`, `A2` | carga + motor de eventos | `ref` (`T1`), `preset` |
| | **Contacto temporizado NO / NC** (dos genéricos) | 2 | siguen la salida del timer | `ref`, `vinculo` (solo a timers) [R3 Q3.4] |
| Cargas | Lámpara | 2 | carga, ON/OFF visible | `ref` (`H1`), `label`, `color` |
| Anotaciones | **Texto libre** | — | ninguno | `texto` |

**Parada de emergencia** [Interpretación, R2 §12 lo delega]: contacto NC. Un clic la **acciona y
enclava** (el contacto se abre y queda abierto, con el símbolo mostrando el hongo hundido). Otro clic
la **libera** (equivale a girar el hongo). Estado inicial: liberada.

**Selector de 3 posiciones** [Interpretación, R2 §12 lo delega; refinable]: posiciones **I – 0 – II**,
mantenido. Un común `C` y dos salidas: en I conduce `C–1`, en 0 no conduce nada, en II conduce `C–2`.
Durante la simulación el símbolo tiene **tres zonas clicables** (izquierda I, centro 0, derecha II),
marcadas al pasar el mouse; clic en una zona lleva el selector a esa posición. Posición inicial por
defecto: 0. *Limitación conocida:* con un común, las dos salidas comparten alimentación. Si hace falta
que salgan de alimentaciones distintas, la evolución natural es un selector con contactos vinculados
por referencia, como bobina y contactos.

**Texto libre** [Interpretación]: sin rotación en V1; el texto se edita en el panel de propiedades o
con doble clic; tamaño fijo.

**Pulsadores momentáneos** [Técnica]: se usa *pointer capture*, así que soltar el botón fuera del
símbolo igual lo libera; perder el foco de la ventana también lo libera. *Limitación conocida:* con
un solo mouse, solo se puede mantener apretado un pulsador a la vez.

**Vinculación** [R2 §10]: índice derivado `ref → componente`. Referencia rota o ambigua → diagnóstico
**bloqueante** que nombra la referencia a corregir.

**Contactos temporizados** [R3 Q3.4]: la biblioteca ofrece solo **"Contacto temporizado NO"** y
**"Contacto temporizado NC"**. El símbolo IEC se deriva del tipo del timer vinculado:

| | NO | NC |
|---|---|---|
| vinculado a **TON** | cierre retardado | apertura retardada |
| vinculado a **TOF** | apertura retardada | cierre retardado |
| sin vincular | símbolo neutro + `REF_ROTA` | símbolo neutro + `REF_ROTA` |

Si se cambia un timer de TON a TOF, sus contactos se redibujan solos. Un contacto común solo se vincula
a bobinas y uno temporizado solo a timers; cualquier otro vínculo es `REF_TIPO`, bloqueante.

---

## 12. Copiar, pegar y duplicar [R2 §13]

**Fragmento copiado** = componentes, segmentos y anotaciones seleccionados + los vértices de esos
segmentos. Un vértice terminal cuyo componente **no** está en la selección se convierte en `point`: el
cable copiado queda con extremo libre. Así se preserva exactamente la topología interna de lo
seleccionado, y nada más. [Interpretación]

**Pegar** (`Ctrl+V`) y **duplicar** (`Ctrl+D`): el fragmento aparece **tomado**, siguiendo al cursor,
y se coloca con un clic bajo las mismas reglas de validez que Mover. Sus terminales libres y extremos
libres que aterrizan exactamente sobre un conductor se conectan, igual que al colocar. Una pegada = una
transacción.

**Renumeración de referencias** [Interpretación]:

| Qué se copia | Resultado al pegar |
|---|---|
| `K1` | `K2` (próximo libre del mismo prefijo) |
| `K1` junto con `K1.1` y `K1.2` | `K2`, `K2.1`, `K2.2` — los contactos siguen a su bobina copiada |
| `K1.1` solo, sin su bobina | `K1.3` (próximo libre), **sigue vinculado a `K1`**: es otro contacto de la misma bobina |
| `H1`, `S1`, `T1`… | próximo libre del mismo prefijo |

**Portapapeles** [Técnica]: interno en memoria, más una copia en JSON en el portapapeles del sistema
para poder pegar entre pestañas cuando el navegador lo permita.

---

## 13. Historial

```ts
interface Transaction { label: string; mutate(draft: Document): void; coalesceKey?: string; }
commit(tx) · undo() · redo()          // snapshots inmutables — T-04, aprobada en R3 Q3.2
```

| Interacción | Entradas de historial | Origen |
|---|---|---|
| Colocar un componente | 1 por clic | Spec §15 |
| Mover o arrastrar (componente, segmento, grupo o pegado) | 1 al confirmar o al soltar | R2 §2, R4 §1 |
| Rotar | 1 | Spec §15 |
| Trazar un cable completo | 1 | Interpretación |
| **Cada clic de la goma** | **1, nunca agrupadas** | R1 §12, R2 §5 |
| Un clic de goma sobre un junction (borra varias cosas) | 1 | R2 §5 |
| `Supr` sobre una selección múltiple | 1 | R2 §30.1 |
| Pegar / duplicar | 1 | R2 §13 |
| Editar una propiedad | 1 por campo (coalescida al tipear, 500 ms) | Técnica |

**No hay coalescencia de arrastres**: tanto con clic-tomar-clic como arrastrando, el documento no
cambia hasta confirmar, así que un movimiento es una sola confirmación por diseño. Solo queda
coalescencia en la edición de texto de propiedades.

La canonicalización corre dentro de la transacción; el historial solo guarda documentos en forma
normal. La selección forma parte del snapshot. Límite de 200 entradas. El historial **no** se persiste
entre recargas. [Técnica]

---

## 14. Archivos, autoguardado y ejemplos

### 14.1 Formato

```jsonc
{
  "schemaVersion": 1,
  "metadata": { "name": "Arranque directo", "createdAt": "…", "modifiedAt": "…" },
  "components":  { "c1": { "type": "bobina", "position": {"x":10,"y":4}, "rotation": 0,
                           "props": { "ref": "K1" } } },
  "vertices":    { "v1": { "kind": "terminal", "componentId": "c1", "terminalId": "A1" },
                   "v2": { "kind": "point", "position": {"x":14,"y":4} } },
  "segments":    { "s1": { "a": "v1", "b": "v2" } },
  "annotations": { "n1": { "position": {"x":2,"y":1}, "text": "Circuito de mando" } },
  "view": { "pan": {"x":0,"y":0}, "zoom": 1 }
}
```

- Validación con Zod **y** de invariantes (referencias internas existentes, ortogonalidad, forma
  normal). Un problema de forma normal se repara canonicalizando; uno de consistencia se rechaza con
  mensaje legible; uno de ambigüedad (V1–V3) se **carga** pero queda como diagnóstico bloqueante, para
  que el usuario pueda corregirlo. [Técnica]
- Migraciones `v(n) → v(n+1)` en cadena, con fixture por versión.
- No se persiste estado de simulación [Spec §14.3].

### 14.2 Guardar y abrir [Spec §14, T-08]

Descarga de archivo + `<input type=file>` en todos los navegadores. En Chromium, File System Access API
para que `Ctrl+S` guarde sobre el mismo archivo. Indicador de cambios sin guardar.

### 14.3 Autoguardado [R2 §28]

Tras cada `commit`, con antirrebote de 1,5 s, a almacenamiento local. Al abrir la app, si existe un
autoguardado, **se restaura automáticamente** con un aviso no intrusivo ("Se recuperó tu trabajo
anterior · Empezar uno nuevo"). [Interpretación] No reemplaza el archivo JSON.
*Limitación conocida:* con dos pestañas abiertas, gana la última que guardó.

### 14.4 Ejemplos incluidos [R2 §30.4]

Menú **Ejemplos**, con circuitos que también sirven de fixtures E2E [Técnica]:

1. **Lámpara con interruptor** — §19.1 del spec.
2. **Arranque directo con autorretención** — pulsadores de marcha y paro, contactor con contacto de
   retención, parada de emergencia, lámpara de señalización.
3. **Encendido retardado (TON)** y **apagado retardado (TOF)**.

Cada ejemplo lo agrega el hito que hace funcionar su contenido.

---

## 15. Exportación [R2 §14, R3 Q3.7]

Reutiliza el SVG del lienzo — otro motivo a favor de T-01.

| Aspecto | Decisión | Origen |
|---|---|---|
| Alcance | **El diagrama completo** (caja que contiene todo lo dibujado, con margen), aunque no entre en pantalla | R3 Q3.7 |
| Colores | **Tal como se ve.** En edición, colores neutros. Durante la simulación o en ERROR, con los colores del estado eléctrico — sirve para documentar dónde ocurrió un corto | R3 Q3.7 |
| Excluido siempre | grid, selección, hover, vista previa y cualquier UI de edición | R3 Q3.7 |
| Tema | Siempre con la **paleta clara**, aunque la app esté en modo oscuro: el archivo va a documentos e impresiones | R4 §6 |
| Formatos | **PNG** (rasterizado vía canvas, 2×) · **PDF** (vectorial, jsPDF + svg2pdf.js) · **SVG** (el propio SVG limpio) | R3 Q3.7 |
| Página del PDF | selector **A4 / A3 / ajustado al diagrama**, orientación automática, escala para que entre | Técnica |
| Metadatos | ninguno (ni autor, ni fecha, ni versión) | R2 §14 |
| Fuentes | estándar, para no depender de fuentes externas | Técnica |

Se accede desde un menú **Exportar** con las tres opciones.

---

## 16. Contenedor, versión y caché

### 16.1 La app se distribuye como imagen de contenedor [R3 §11]

La app sigue siendo 100 % client-side (spec §3.1): el contenedor **solo sirve archivos estáticos**, no
ejecuta lógica. Lo que aporta es que la configuración del servidor —y con ella la política de caché—
viaja **dentro de la imagen**. Deja de depender del proveedor, y la pregunta Q3.9 pasa a ser una
decisión operativa que no toca el código.

**Imagen multi-etapa** [Técnica]:

```dockerfile
# Etapa 1 — build
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG BUILD_ID=dev                       # hash de commit, pasado al construir
RUN BUILD_ID=$BUILD_ID pnpm build      # emite dist/ con assets hasheados + version.json

# Etapa 2 — runtime
FROM nginxinc/nginx-unprivileged:alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK CMD wget -qO- http://localhost:8080/healthz || exit 1
```

| Aspecto | Decisión | Por qué |
|---|---|---|
| Servidor | **nginx sin privilegios** (Alpine) | Estándar, liviano (~25 MB), corre como usuario no root |
| Puerto | **8080** dentro del contenedor | Un proceso sin root no puede usar el 80; el host lo mapea al que quiera |
| HTTPS | fuera del contenedor (proxy inverso o balanceador del host) | La imagen no gestiona certificados: la hace portable |
| Build id | argumento `BUILD_ID` al construir (hash de commit) | El contexto de build no necesita traer `.git` |
| Runtime | ninguno más allá de nginx: sin Node en la imagen final | Superficie mínima |
| Compatibilidad | imagen OCI estándar: Docker, Podman, Kubernetes, Cloud Run, Fly, etc. | "Fácil de desplegar" en cualquier lado |

**Política de caché en `deploy/nginx.conf`** — el corazón del requisito de versión (spec §3.3):

| Ruta | `Cache-Control` | Motivo |
|---|---|---|
| `/assets/*` (con hash) | `public, max-age=31536000, immutable` | El nombre cambia si cambia el contenido |
| `/index.html`, `/` | `no-store` | Siempre apunta a los assets del build actual |
| `/version.json` | `no-store` | Detección de versión nueva |
| `/examples/*.json` | `no-cache` | Revalidan en cada carga |
| `/healthz` | `no-store` | Chequeo de salud para el orquestador |

Además: compresión gzip, y cabeceras de seguridad. Como la app no carga nada de terceros (§17), se puede
fijar una **Content-Security-Policy estricta** (`default-src 'self'`) sin romper nada. [Técnica]

**Uso local**: `compose.yaml` en la raíz → `docker compose up --build` → `http://localhost:8080`.

### 16.2 Detección de versión nueva

1. Vite emite assets con hash de contenido.
2. `__BUILD_ID__` inyectado en el bundle desde `BUILD_ID`.
3. `version.json` sin hash en el nombre, servido con `no-store` por la configuración de la imagen.
4. El cliente lo consulta al arrancar, al recuperar el foco y cada N minutos, con `cache: 'no-store'`
   y un parámetro anti-caché en la URL, por si hay un proxy intermedio que ignore las cabeceras.
5. Si el build remoto difiere → aviso con botón de recarga; el autoguardado garantiza que recargar no
   pierde trabajo.
6. Sin Service Worker (T-07, compatible con R2 §24).

### 16.3 Pruebas del contenedor

- **Unitario:** `VersionChecker` con fetch simulado.
- **Humo sobre la imagen real**, en CI y en cada hito: construir la imagen, levantarla, verificar
  `/healthz`, verificar las cabeceras `Cache-Control` de cada ruta de la tabla, y correr un
  subconjunto de E2E contra el contenedor.
- **E2E de versión nueva:** levantar la imagen con un `BUILD_ID`, abrir la app, reemplazar el contenedor
  por otro con un `BUILD_ID` distinto, y verificar que aparece el aviso y que al recargar se cargan los
  assets nuevos. Es la prueba más directa posible del requisito "no quedar en caché vieja".

---

## 17. Idioma, accesibilidad, privacidad y documentación

**Idioma** [R2 §26]: toda la UI en español. Todo texto sale de `app/i18n/es.ts` vía `t(clave)` con
claves tipadas. Formato numérico con `Intl` en `es` (coma decimal). El núcleo no tiene textos: devuelve
códigos. Agregar otro idioma = agregar un diccionario.

**Accesibilidad** [R2 §30.8]: botones con `aria-label`, navegación por teclado en barras y paneles,
foco visible, estado nunca solo por color. Sin auditoría formal en V1.

**Privacidad** [R2 §30.6]: sin telemetría, sin analítica, sin fuentes ni recursos de terceros. La
única petición de red tras cargar la app es `version.json` al propio origen.

**Documentación** [R2 §30.5]:

| Archivo | Contenido | Nace en |
|---|---|---|
| `README.md` | requisitos, instalar, ejecutar, probar, compilar, **construir y correr el contenedor** | M0 |
| `docs/ARQUITECTURA.md` | capas, flujo de datos, dónde vive cada cosa | M0, se completa en cada hito |
| `docs/CONVENCIONES.md` | nombres, i18n, tests, commits, reglas de lint | M0 |
| `docs/GLOSARIO.md` | red, nodo, vértice, segmento, junction, extremo libre, canonicalización… | M0 |
| `docs/ATAJOS.md` | mapa de teclas vigente | M4 |
| `STATUS.md` | completado · en curso · tests fallando · limitaciones · decisiones abiertas | M0 |

---

## 18. Estrategia de pruebas

### 18.1 Niveles

| Nivel | Herramienta | Alcance |
|---|---|---|
| Unit | Vitest, sin DOM | todo `core/`: topología, canonicalización, validez, reparación, conectividad, diagnósticos, solver, settle, timers, cola, portapapeles, esquema, migraciones, historial |
| Integración | Vitest + jsdom | store + máquina de estados: cada herramienta, cada transición, entrar y salir de simulación |
| E2E | Playwright, Chromium y Firefox | **un E2E por flujo funcional**, no solo los críticos [R2 §22] |
| Regresión geométrica | fixtures | §18.4 del spec + tasa de rechazo de posiciones |
| Estrés de historial | secuencias generadas | §18.5 del spec: igualdad exacta del documento serializado |

### 18.2 Matriz de cobertura exigida por la ronda 2 (§22)

| Funcionalidad | Unit | Integ. | E2E |
|---|:-:|:-:|:-:|
| Colocar (incluida repetición, rotación previa, `Esc`) | ✓ | ✓ | ✓ |
| Mover componente (clic-tomar-clic, reparación, posición inválida) | ✓ | ✓ | ✓ |
| Arrastrar con Seleccionar (componente, tramo, grupo, umbral, vuelta atrás al soltar inválido) [R4] | — | ✓ | ✓ |
| Mover con flechas y `Enter` [R4] | — | ✓ | ✓ |
| Mover segmento (eje perpendicular, anclas, sin conexiones nuevas) | ✓ | ✓ | ✓ |
| Rotar (incluido el rechazo de una rotación en el lugar inválida) | ✓ | ✓ | ✓ |
| Inserción en serie al soltar sobre un tramo recto | ✓ | ✓ | ✓ |
| Partir y unir redes (derivar, borrar el único enlace) | ✓ | ✓ | ✓ |
| Borrar: goma sobre junction, esquina, extremo libre, segmento, componente | ✓ | ✓ | ✓ |
| Borrar selección múltiple = una entrada de historial | ✓ | ✓ | ✓ |
| Undo / redo (incluida la granularidad de la goma) | ✓ | ✓ | ✓ |
| Conexiones automáticas (terminal libre sobre segmento, extremo, terminal) | ✓ | ✓ | ✓ |
| Posiciones inválidas (solape, T sin punto, puntos coincidentes, cable sobre terminal ajeno, terminal conectado sobre otra red) | ✓ | ✓ | ✓ |
| Extremos libres (crear, marcar, reconectar, no afectan simulación) | ✓ | ✓ | ✓ |
| Cruces sin conexión | ✓ | ✓ | ✓ |
| Solapamientos bloqueantes (impedidos y, si se importan, bloquean simular) | ✓ | ✓ | ✓ |
| Normalización de solapamiento de la misma red | ✓ | ✓ | — |
| Copiar / pegar / duplicar (ids, referencias, topología interna) | ✓ | ✓ | ✓ |
| Guardar / abrir / round-trip exacto | ✓ | ✓ | ✓ |
| Autoguardado y recuperación | ✓ | ✓ | ✓ |
| Exportación PNG, PDF y SVG (diagrama completo, colores de estado, sin UI de edición) | — | ✓ | ✓ |
| Contactos temporizados: símbolo derivado del timer y vínculo de tipo equivocado bloquea | ✓ | ✓ | ✓ |
| Cortocircuitos (los tres tipos) | ✓ | ✓ | ✓ |
| Carga con fase A y neutro B no enciende | ✓ | ✓ | — |
| Oscilación (instantánea y lazo temporizado) | ✓ | ✓ | ✓ |
| Temporizadores TON y TOF (inicio, cancelación, valor visible, congelamiento) | ✓ | ✓ | ✓ |
| Controles manuales (interruptor, pulsador, parada de emergencia, selector) | ✓ | ✓ | ✓ |
| Referencias rotas y duplicadas bloquean | ✓ | ✓ | ✓ |
| Simulación completa de cada ejemplo incluido | — | ✓ | ✓ |
| Versión nueva detectada (incluido el reemplazo del contenedor por otro build) | ✓ | — | ✓ |
| Imagen de contenedor: arranca, `/healthz`, cabeceras de caché por ruta | — | ✓ | ✓ |

### 18.3 Batería de la ronda 1 (§14)

Se conserva íntegra, con dos ajustes que exigen las rondas 2 y 3:
- "Mover un componente" se prueba con clic-tomar-clic en vez de arrastre [R2 §2].
- "Pasar sobre un terminal ajeno no conecta" se sigue probando a nivel de topología (un documento
  importado donde ocurre → las redes siguen separadas). Además se prueba que el editor **impide**
  crear esa situación y que, si se importa, **bloquea** la simulación [R3 Q3.1].

### 18.4 Disciplina

- Ningún hito se cierra sin sus tests de los tres niveles.
- Si algo no se puede testear por cómo está armado, **se cambia el diseño**.
- E2E sin `sleep`: en modo test la app expone un gancho para avanzar el reloj de simulación. Los E2E
  pueden **cargar** un documento de partida por ese gancho, pero la acción bajo prueba siempre se hace
  por la UI real.
- **Test de invariantes transversal:** tras cada operación de cada test de integración se verifica
  automáticamente forma normal, ortogonalidad y que la partición de redes cambió solo como se esperaba.
- Clic-tomar-clic hace los E2E **menos frágiles** que con arrastres: son clics discretos, no
  trayectorias de mouse.

---

## 19. Plan incremental por hitos

### 19.1 Criterio de orden

1. **Primero el núcleo topológico, sin UI (M1–M4).** La ronda 2 pide que las operaciones topológicas
   se prueben sin UI, y es la parte que más cambió en dos rondas. Construirla y blindarla con tests
   antes de que la toque una interfaz es la forma más barata de no rehacerla.
2. **El historial va antes que cualquier herramienta que mute** (M2): es la envoltura de toda
   mutación.
3. **Después la UI, herramienta por herramienta (M5–M12)**, cada una conectada a operaciones ya
   probadas.
4. **El núcleo eléctrico (M13–M16)** puede avanzar en paralelo desde M4 si trabaja más de una persona.

### 19.2 Hitos

**M0 · Andamiaje, i18n y documentación base**
Repo, Vite + React + TS strict, lint de fronteras y de texto literal, Vitest, Playwright
(Chromium + Firefox), CI, `__BUILD_ID__`, infraestructura de `t()` con `es.ts`, `README`, `docs/`,
`STATUS.md`, `git init` local sin remoto, **`Dockerfile` + `nginx.conf` + `compose.yaml` desde el primer
día** — así cada hito se verifica también como imagen y un problema de despliegue no aparece recién al
final.
**Tests:** uno verde por nivel; la imagen construye, arranca y responde `/healthz`.

**M1 · Modelo y canonicalización** *(núcleo)*
Tipos, geometría, ids, índice espacial, canonicalización completa (§4.5), esquema, serialización,
migraciones, registro con tipos de prueba.
**Tests:** cada paso de canonicalización; solapamiento de la misma red normalizado; invariante de
partición; terminal sobre terminal; round-trip.

**M2 · Historial** *(núcleo)*
`commit` / `undo` / `redo`, snapshots, selección en el snapshot, coalescencia por campo.
**Tests:** §18.5 del spec con secuencias generadas.

**M3 · Operaciones, reparación y validez** *(núcleo)*
Todas las operaciones del §5.2, reparación con candidatas (§5.4), validador (§5.5), semántica completa
de la goma (§7) como funciones puras.
**Tests:** los bloques *Segmentos*, *Derivaciones*, *Terminal sobre cable*, *Movimiento*, *Extremos
libres* y *Cruces* de la ronda 1, a nivel de núcleo; cada caso de la goma; posiciones inválidas;
los tres contactos ambiguos (V2/V3) rechazados; inserción en serie al colocar, mover y pegar; primeros
fixtures de regresión con tasa de rechazo.

**M4 · Conectividad y diagnósticos** *(núcleo)*
Union-find, índice de referencias, motor de diagnósticos con las dos severidades (§8).
**Tests:** partición tras cada operación; cada regla de diagnóstico, incluidos `CONTACTO_AMBIGUO` y
`REF_TIPO`; bloqueantes impiden simular.

**M5 · Lienzo y cascarón de la app**
SVG con pan/zoom, grid, sensación de lienzo infinito, barra de herramientas, paneles vacíos, barra de
estado, todo en español.
**Tests:** transformación de coordenadas; E2E de pan y zoom.

**M6 · Símbolos, biblioteca y colocación**
Símbolos IEC del §11, biblioteca izquierda por grupos, ghost con snap, `R`, colocación repetida, `Esc`,
conexión automática al colocar sobre un cable, inserción en serie, vista previa de validez. Primer
ejemplo (lámpara) como documento.
**Tests:** E2E de colocar, rotar antes, repetir, cancelar, colocar sobre un cable, insertar en serie.

**M7 · Seleccionar, Mover y Rotar**
Herramienta `S` con rectángulo y `Mayús`, herramienta `M` completa (§6.2), rotación de uno, bloqueo de
rotación de grupo, `docs/ATAJOS.md`.
**Tests:** E2E de mover componente cableado, mover grupo, mover segmento, posición inválida rechazada,
`Esc` durante el movimiento, rotación en el lugar inválida rechazada con motivo.

**M8 · Cable**
Herramienta `C` completa (§6.3): derivación con junction, extremos libres a propósito, validación de
cada tramo.
**Tests:** E2E de trazar, derivar, terminar en el vacío, intentar solapar otra red.

**M9 · Borrar**
Herramienta `B` con la tabla completa del §7, prioridad de impacto, selección + `Supr`.
**Tests:** E2E de cada caso de la goma y de su orden de prioridad (incluido el terminal con un solo
cable); cuatro clics = cuatro deshacer; selección múltiple = uno.

**M10 · Propiedades, diagnósticos y texto**
Panel derecho generado desde el esquema de cada tipo, panel de diagnósticos, herramienta `T`.
**Tests:** E2E de editar `ref` y `preset`; diagnóstico bloqueante visible y navegable.

**M11 · Archivos, autoguardado y menú de ejemplos**
Guardar, abrir, File System Access progresiva, autoguardado con recuperación, menú Ejemplos.
**Tests:** round-trip exacto; recarga con recuperación; archivo inválido; E2E de cada flujo.

**M12 · Copiar, pegar y duplicar**
§12 completo.
**Tests:** renumeración de referencias; topología interna; pegado inválido rechazado; E2E.

**M13 · Núcleo eléctrico y modo SIMULACIÓN**
`solve`, fuentes, lámpara, interruptores, pulsadores, parada de emergencia, selector, bloqueo de
edición, colores de estado, compuerta de diagnósticos.
**Tests:** propagación; flotante; neutro común; carga con A/B no enciende; extremo libre no afecta;
cada control manual; E2E del ejemplo de lámpara.

**M14 · Bobinas y contactos**
Bobina, contactos, `settle`. Ejemplo de arranque directo con autorretención.
**Tests:** vinculación; NO/NC; convergencia; E2E del ejemplo.

**M15 · Temporizadores TON y TOF**
Cola de eventos, reloj, velocidad, TON, TOF, contactos temporizados, valor visible, guardia de lazo
temporizado. Ejemplos de TON y TOF.
**Tests:** batería por tipo; símbolo del contacto temporizado según TON/TOF; determinismo; cambio de
velocidad; E2E de los ejemplos.

**M16 · Fallas y modo ERROR**
Los tres cortos, oscilación instantánea y temporizada, congelamiento total, resaltado, panel de error
requerido y, después, los extras deseables.
**Tests:** batería *Cortos* de la ronda 1; oscilación no cuelga; timers congelados; E2E de corto y de
oscilación.

**M17 · Exportación**
PNG, PDF y SVG según §15: diagrama completo, colores de estado si se exporta simulando, selector de
página del PDF.
**Tests:** los tres archivos generados; incluyen lo que está fuera de pantalla; sin grid ni UI de
edición; colores de estado en modo ERROR; E2E.

**M18 · Contenedor, versión y caché**
§16 completo: política de caché por ruta, CSP estricta, detección de versión nueva.
**Tests:** los tres niveles del §16.3, incluido el reemplazo del contenedor por otro build.

**M19 · Estabilización**
Toda la matriz del §18.2 en verde en 10 corridas seguidas; presupuesto de rendimiento (200
componentes: pan, zoom y vista previa de Mover fluidos; `settle` < 16 ms); A* de respaldo si los
fixtures lo piden; documentación final; auditoría contra el §21.

---

## 20. Riesgos

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R1 | **La restricción dura contra la ambigüedad deja demasiadas posiciones inválidas** en diagramas densos: el usuario "no puede soltar" y no entiende por qué | **Alto** (subió desde la v0.2) | Candidatas ampliadas + A* de respaldo (§5.4); la vista previa muestra el motivo y resalta el conductor en conflicto; los fixtures miden la tasa de rechazo |
| R2 | Casos borde de la canonicalización, ahora con el paso de coincidencias dentro de la red | Alto | Orden fijo de pasos, punto fijo, invariante de partición en cada test, construida y blindada en M1 antes de que nada la use |
| R3 | Rendimiento del validador durante la vista previa de Mover | Medio | Índice espacial por línea de grid; recálculo solo al cambiar de celda, no en cada movimiento del mouse |
| R4 | Tamaño y fragilidad de una suite E2E amplia | Medio | Clics discretos en vez de arrastres; gancho de reloj; carga de documentos de partida por gancho; ejecución en paralelo |
| R5 | Crecimiento de alcance de V1 (copiar/pegar, exportación, autoguardado, ejemplos, 3 componentes nuevos) | Medio-alto | Hitos acotados, `STATUS.md` al día, nada fuera del §2 entra sin pasar por una ronda de preguntas |
| R6 | Lazos con temporizadores que generan eventos infinitos en el mismo instante | Medio | Preset mínimo + tope de eventos por instante (§10.3) |
| R7 | Fidelidad de la exportación entre navegadores | Medio | Exportación vectorial con fuentes estándar; comparación visual solo en Chromium |
| R8 | La goma sobre un junction borra un componente sin aviso | Bajo | Decisión de producto consciente; `Ctrl+Z` recupera todo de una vez |
| R9 | Rendimiento de SVG con muchos segmentos | Medio | Culling por viewport y memoización en M19 |
| R10 | Autoguardado con dos pestañas | Bajo | Limitación documentada |
| R11 | El modelo simplificado sorprende (cargas en serie, neutros de distintas fuentes) | Medio | Semántica documentada en la ayuda; motivo visible al inspeccionar una carga apagada |
| R12 | Un proxy o CDN delante del contenedor cachea `index.html` o `version.json` pese a las cabeceras | Bajo | Parámetro anti-caché en la consulta de versión; `index.html` con `no-store`; documentado en el README qué no se debe cachear |

---

## 21. Definición de terminado (V1)

- [ ] Editor: colocar, cablear, derivar, Mover (componentes, segmentos, grupos), rotar, seleccionar,
      propiedades, deshacer/rehacer, guardar/abrir, zoom/pan, grid, lienzo infinito
- [ ] Segmentos individualmente seleccionables y borrables
- [ ] Goma con toda la semántica del §7 y una entrada de historial por clic
- [ ] Extremos libres creables, visibles, reconectables y sin efecto en la simulación
- [ ] Documento siempre en forma normal, incluida la normalización de solapamientos de la misma red
- [ ] Posiciones inválidas rechazadas con motivo visible; imposible crear solapamientos, T sin punto,
      puntos coincidentes o cables sobre terminales ajenos entre redes distintas
- [ ] Soltar un componente sobre un tramo recto lo inserta en serie
- [ ] Diagnósticos con avisos y bloqueantes; simular exige cero bloqueantes
- [ ] Catálogo del §11 completo, con TON y TOF como componentes distintos y contactos temporizados
      con símbolo derivado del timer
- [ ] Copiar, pegar y duplicar con renumeración de referencias
- [ ] Autoguardado con recuperación
- [ ] Exportación a PNG, PDF y SVG del diagrama completo, tal como se ve
- [ ] Ejemplos incluidos, cada uno simulable
- [ ] Simulación: bloqueo de edición, controles manuales, temporizadores por eventos con valor visible,
      velocidades 0,25× / 1× / 4×
- [ ] Los tres cortos y la oscilación llevan a ERROR congelado con salida explícita
- [ ] Esquema JSON versionado con migraciones probadas
- [ ] La app se construye y se levanta como imagen de contenedor con un solo comando
- [ ] Versión nueva detectada sin quedar en caché vieja, probado contra la imagen real
- [ ] UI íntegramente en español con i18n preparada; sin telemetría
- [ ] Documentación interna completa
- [ ] Matriz del §18.2 en verde, 10 corridas seguidas sin intermitencias, en Chromium y Firefox
- [ ] `STATUS.md` al día

---

## 22. Refactor a vista gráfica de tablero [R5]

Lo de antes sigue siendo cierto en su mayor parte: capas, pureza del núcleo, operaciones que
devuelven un borrador validado, historial por snapshots, simulación por eventos discretos. Lo que
cambia es **qué se dibuja** y **cómo se conecta**.

### 22.1 El cambio de fondo

| Antes (`classic`) | Ahora |
|---|---|
| Representación **dispersa**: la bobina `K1` y cada contacto `K1` son componentes separados, unidos por una referencia de texto | Representación **integrada**: un contactor es un aparato con sus 12 bornes; bobina y contactos viven adentro |
| Cableado como **grafo** de vértices y tramos, con empalmes, derivaciones y extremos libres | Cable de **dos extremos**: de un borne a otro, con codos propios |
| Conectividad por **vértice compartido** | Conectividad por **borne** |
| Símbolo IEC suelto sobre el papel | Base del aparato + esquema IEC adentro |

### 22.2 Modelo de documento (esquema v2)

```ts
interface DeviceInstance { id; type; position: Point; props }      // sin rotación [R5 §1]
interface Wire {
  id;
  a: TerminalRef; b: TerminalRef;        // { deviceId, terminalId } — siempre dos bornes [R5 §4]
  bends: readonly Point[];               // codos propios del cable, ruta ortogonal
  color: WireColor;                      // paleta fija [R5 §3]
  gauge: 1 | 2 | 3;                      // tres calibres [R5 §5]
}
```

La geometría sigue siendo dato (§1.2), pero el grafo desaparece: no hay `vertices` ni `segments`
compartidos. La **red** es el conjunto de bornes unidos por cables, calculado con union-find sobre
`Wire.a`/`Wire.b`; `connectivity/nets.ts` se vuelve trivial y `topology/canonicalize.ts` se reduce a
normalizar los codos redundantes de **un mismo** cable.

### 22.3 Catálogo declarativo

Cada tipo declara sus bornes, sus **elementos internos** y cómo se dibuja:

```ts
interface DeviceDefinition {
  type; category; refPrefix;
  size: { w; h };                                   // en unidades de grid
  terminals: readonly { id; offset; dir; screw: 'power' | 'control' }[];   // [R5 §9]
  internals: {
    actuators: readonly { id; kind: 'coil' | 'timer' | 'manual'; ... }[];
    contacts:  readonly { a; b; normal: 'NO' | 'NC'; actuator }[];
    loads:     readonly { a; b; look: 'pilot' | 'bulb' | 'indicator' }[];
    sources:   readonly { phases: readonly TerminalId[]; neutral: TerminalId }[];
  };
  art: DeviceArt;                                   // cuerpo, filas de tornillos, posición de cada símbolo
  props: readonly PropSpec[];
}
```

El motor eléctrico trabaja sobre **elementos**, no sobre tipos: un contacto sabe qué actuador lo
mueve dentro de su propio aparato y el índice de vínculos por referencia desaparece (§8).

### 22.4 Modelo eléctrico

- La identidad de fase sigue siendo `(sourceId, phaseIndex)` [R2 §11], que era justamente la
  previsión para esto: una acometida declara **una a tres fases** y un neutro común [R5 §2].
- "Misma alimentación" = mismo `sourceId`, así que una carga entre fase y neutro del mismo poste
  enciende, y entre dos fases **no** [R5 §12].
- La UPS es un aparato con **una carga** (su entrada, que solo enciende el indicador) y **una fuente
  propia siempre activa** (su salida). Unir esa salida con la red es corto por la regla de fases de
  fuentes distintas [R5 §11].
- `solve`, `settle`, la cola de eventos y el modo ERROR no cambian [R5 §14].

### 22.5 Validez y edición

Reglas del validador (reemplazan V1–V5):

| # | Regla |
|---|---|
| W1 | Dos cables de **redes distintas** no pueden solaparse en colineal; los de la misma red sí [R5 §4] |
| W2 | Un cable no puede pasar exactamente por un **borne ajeno** |
| W3 | Un codo de un cable no puede caer **dentro de un tramo** de otro cable de otra red (T sin unión) |
| W4 | Dos **aparatos** no pueden superponerse [R5 §1] |

El cruce perpendicular sigue siendo válido. Una operación es válida si no **agrega** violaciones,
igual que antes (§5.5). Al mover un aparato, cada cable conectado se vuelve a rutear entre sus dos
bornes conservando la forma; es un caso más simple que la reparación actual, porque el cable no
comparte geometría con nadie.

### 22.6 Dibujo

`app/symbols/Symbols.tsx` pasa a ser la **biblioteca de símbolos internos** (bobina, contactos NA/NC,
contactos temporizados, lámpara, foco), y un renderizador único dibuja cualquier aparato a partir de
su `art`: cuerpo, filas de tornillos con su número, etiquetas de borne, símbolos internos y las
partes móviles que conmutan en la simulación. Agregar un aparato es agregar datos, no un componente
React nuevo. Solo modo claro, papel color hoja y fondo blanco al exportar [R5 §16].

### 22.7 Hitos

| Hito | Contenido |
|---|---|
| **G0** | Ronda R5 en DECISIONES.md, este plan, invariantes de CLAUDE.md y STATUS.md. Tag `classic` |
| **G1** | Núcleo: documento v2, cables de dos extremos, nets y validador nuevos, catálogo declarativo con elementos internos, `solve`/`settle` sobre elementos. Aparatos mínimos: acometida monofásica, taco, contactor, pulsador, piloto. Pruebas unitarias |
| **G2** | Interfaz: renderizador declarativo de aparatos, biblioteca, herramienta Cable de borne a borne con color y calibre, propiedades, goma, mover y arrastrar. Pruebas de integración |
| **G3** | Catálogo completo: acometida bifásica y trifásica, tacos 2P y 3P, relés de 8 y 11 pines, TON, TOF, interruptor, selector, parada de emergencia, foco, UPS |
| **G4** | Simulación en la vista nueva: contactos que conmutan, cables que se iluminan, temporizadores con su tiempo, ERROR congelado |
| **G5** | Persistencia v2 sin migración, autoguardado, ejemplos nuevos, exportación con fondo blanco, modo claro único |
| **G6** | E2E completos, limpieza del catálogo disperso y de los restos del grafo, documentación al día |

### 22.8 Qué se conserva del código

Historial, persistencia (zod, versionado), diagnósticos, i18n, exportación, plataforma, contenedor,
tienda y máquina de herramientas, cola de eventos y `settle`, y la disciplina de capas. Se
reescriben: `registry/`, `topology/` (ops, validez, reparación, canonicalize reducida),
`connectivity/`, el armado del modelo de simulación, los símbolos y los ejemplos.

---

## 23. Bitácora

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-21 | v0.1 | Borrador inicial |
| 2026-09-21 | v0.2 | Ronda 1: grafo de vértices y segmentos, canonicalización, extremos libres, borrado sin cascada, goma, router sin obstáculos |
| 2026-09-21 | v0.3 | Ronda 2: RTO eliminado (V1 = TON + TOF); Mover clic-tomar-clic; validador con restricción dura contra solapamientos; semántica completa de la goma; diagnósticos bloqueantes; copiar/pegar, exportación, autoguardado y ejemplos en V1; atajos en español; etiquetas de origen en cada decisión; hitos reordenados con el núcleo topológico primero. Ver §0.3 |
| 2026-09-21 | v0.4 | Ronda 3 (respondida en la conversación): contactos ambiguos inválidos y bloqueantes; stack aprobado, git solo local; inserción en serie; contactos temporizados genéricos; rotación inválida rechazada; prioridad de la goma; exportación PNG/PDF/SVG del diagrama completo; `estadoInicial` en el documento; interpretaciones I1–I18 aceptadas. **Plan listo para implementar.** Ver §0.2 |
| 2026-09-21 | v0.5 | Agregado de producto: la app corre dentro de un contenedor. Imagen multi-etapa con nginx sin privilegios, política de caché dentro de la imagen, `compose.yaml`, contenedor desde M0, pruebas de humo y de versión contra la imagen real. Q3.9 deja de afectar el diseño. Ver §16 |
| 2026-09-22 | v0.6 | Ronda 5: refactor a **vista gráfica de tablero**. Aparatos con sus bornes y su esquema adentro, cable de dos extremos con color y calibre, acometidas de una a tres fases, UPS, solo modo claro. La versión anterior queda en el tag `classic`. Ver §0.5 y §22 |
