# Preguntas abiertas — Ronda 1 · ⚠️ ARCHIVO CERRADO

> **Este archivo quedó superado. No escribas respuestas acá.**
>
> - Lo decidido está en [RESPONSE_ROUND_1.md](RESPONSE_ROUND_1.md).
> - Lo que quedó sin responder se trasladó a [QUESTIONS2.md](QUESTIONS2.md), con el número original
>   indicado como *(antes Pxx)*.
> - Varias recomendaciones de acá fueron **revertidas** por la ronda 1 — en particular P9 (neutro de
>   otra fuente), P14 (extremos sueltos) y P15 (borrado en cascada). El detalle está en el §0 de
>   [PLAN.md](PLAN.md).
>
> Se conserva solo como registro de cómo se llegó a las decisiones.

---

> **Cómo usar este archivo:** escribí tu respuesta en la línea `**Respuesta:**` de cada pregunta.
> No hace falta que las contestes todas de una: las 🔴 son las que bloquean el arranque.
>
> **Atajo:** si estás de acuerdo con todo lo que propongo, alcanza con que escribas
> `Acepto todas las recomendaciones` y solo contestes las que quieras cambiar.
>
> Cada pregunta trae mi recomendación y **por qué**, para que decidas rápido.
> Las referencias `Pxx` aparecen marcadas con ⚠️ en [PLAN.md](PLAN.md).

**Prioridad:** 🔴 bloquea el inicio · 🟡 se necesita antes de su hito · 🟢 puede esperar

---

## Bloque A — Semántica eléctrica
*Las más importantes del documento. Definen el solver entero (M10–M13) y cambiarlas después
implica rehacer el motor de simulación.*

---

### 🔴 P6 — ¿Conectar L directamente con N (sin carga en el medio) es cortocircuito?

**Contexto.** El §9.5 del spec define el corto solo como *"dos identidades de fase distintas en el
mismo nodo"*. No dice nada de fase contra neutro. Pero en la realidad, un cable de L a N sin carga
es el cortocircuito más común que comete un usuario aprendiendo.

**Opciones**
- **a)** Sí, es corto. `Line(X)` y `Neutral(·)` en el mismo nodo → ERROR.
- **b)** No. Solo dos fases distintas producen error; L–N directo simplemente energiza el nodo.
- **c)** No es error pero se muestra una advertencia visual sin detener la simulación.

**Recomendación: (a).** Es lo que el usuario espera de un simulador eléctrico y atrapa el error más
frecuente. Además es gratis de implementar: ya calculamos ambos conjuntos en el mismo nodo. Con el
modelo de "las cargas no conducen" (ver P8), un circuito correcto **nunca** produce este estado, así
que no hay falsos positivos.

**Respuesta:** _(pendiente)_

---

### 🔴 P7 — ¿Fase de la fuente A con neutro de la fuente B en el mismo nodo?

**Contexto.** El §9.3 permite explícitamente unir `N_A` con `N_B`. Si además están unidos, entonces
L(A) tocando N(B) es lo mismo que tocar N(A). Pero si los neutros **no** están unidos, ¿qué pasa?

**Opciones**
- **a)** Mismo tratamiento que P6: si P6 es corto, esto también.
- **b)** Es un caso aparte con su propio mensaje de error ("fase y neutro de fuentes distintas").
- **c)** No es error.

**Recomendación: (a).** Un único concepto de "fase y neutro se tocan" es más simple de explicar al
usuario y de testear. La distinción de qué fuente es cada uno no aporta nada al modelo simplificado.

**Respuesta:** _(pendiente)_

---

### 🔴 P8 — ¿Las cargas (lámpara, bobina, timer) conducen o solo sensan?

**Contexto.** Es **la** decisión estructural del solver. Si una lámpara "conduce" (fusiona sus dos
terminales), entonces la fase atraviesa la lámpara y llega al neutro → todo circuito correcto sería
un cortocircuito. Por eso propongo que las cargas sean **sensores de dos terminales**: leen el
potencial de cada lado y no propagan nada.

**Contrapartida conocida:** dos lámparas **en serie** quedan ambas apagadas (en la realidad
brillarían tenues). Con el modelo de sensor, la lámpara 1 ve `L` de un lado y un nodo flotante del
otro; la lámpara 2 ve flotante y `N`. Ninguna cumple la condición de encendido.

**Opciones**
- **a)** Las cargas solo sensan, no conducen. Cargas en serie = ambas apagadas.
- **b)** Las cargas conducen pero se marcan como "conductor con carga", y el corto solo se declara
  cuando L y N se unen por un camino **sin** ninguna carga. Modela mejor la serie, pero complica el
  union-find (hay que etiquetar aristas y distinguir caminos).
- **c)** (a) + una advertencia cuando se detecta una carga con un terminal flotante junto a otra carga
  (patrón típico de "quisiste poner algo en serie").

**Recomendación: (a), y (c) si hay tiempo en M16.** Es simple, determinista, fácil de explicar y de
testear. Las cargas en serie no son un patrón de circuitos de control (ahí todo es
fase→contactos→carga→neutro). Si en el futuro hace falta, (b) es una evolución compatible.

**Respuesta:** _(pendiente)_

---

### 🔴 P9 — Para encender una carga, ¿el neutro tiene que ser de la misma fuente que la fase?

**Contexto.** Si `L_A` llega a un terminal de la lámpara y `N_B` al otro (con neutros **no** unidos),
¿enciende?

**Opciones**
- **a)** Cualquier neutro sirve. Simple y coherente con que el modelo ignora la física.
- **b)** Tiene que ser el neutro de la misma fuente; si no, la carga queda apagada.
- **c)** Tiene que ser el mismo y, si no lo es, se marca como error de cableado.

**Recomendación: (a).** Con el §9.3 permitiendo neutros comunes, exigir coincidencia genera
comportamientos confusos justo en el caso que el spec declara válido. Si querés rigor, (b) también
es defendible — decime cuál.

**Respuesta:** _(pendiente)_

---

### 🟡 P10 — Semántica exacta de los temporizadores

**Contexto.** El §10.4 exige definirla explícitamente. Esta es mi propuesta:

| Tipo | Al energizar | Al desenergizar | Salida |
|---|---|---|---|
| **TON** | arranca el conteo | salida OFF inmediata, cancela el evento, **transcurrido vuelve a cero** | ON al vencer `preset` |
| **TOF** | salida ON inmediata, cancela evento pendiente | agenda apagado en `t+preset`, salida sigue ON | OFF al vencer |
| **TP** (impulso) | si está en reposo: ON durante `preset`. Si ya está contando: **se ignora** | no afecta | OFF al vencer |

**La pregunta concreta:** ¿el TON acumula tiempo entre interrupciones (tipo totalizador/retentivo) o
reinicia siempre desde cero?

**Recomendación: reinicia desde cero.** Es el comportamiento del TON estándar IEC 61131-3 y el que
espera cualquiera que venga de PLC. Si querés un temporizador retentivo, sería un cuarto tipo
aparte, no un modo del TON.

**Respuesta:** _(pendiente)_

---

### 🟡 P13 — ¿Qué pasa con referencias de contacto rotas o bobinas duplicadas?

**Contexto.** Un contacto `K1.1` que apunta a una bobina `K1` que no existe (o que fue renombrada).
O dos bobinas distintas llamadas `K1`.

**Opciones**
- **a)** Advertencia visual (contacto punteado + aviso en el panel), pero la simulación arranca y el
  contacto se comporta como si su bobina estuviera siempre OFF.
- **b)** Bloquea el inicio de la simulación hasta corregirlo.
- **c)** Se ignora silenciosamente.

**Recomendación: (a).** Permite construir el diagrama en cualquier orden (poner el contacto antes que
la bobina es normal al dibujar) sin que la app te frene. Para las bobinas duplicadas sí propongo
bloquear: es ambigüedad real, no un trabajo a medio hacer.

**Respuesta:** _(pendiente)_

---

## Bloque B — Alcance de componentes

---

### 🔴 P1 — ¿Qué temporizadores entran en V1?

El §8.6 pide TON y TOF como mínimo, y deja el de intervalo como opcional.

**Opciones**
- **a)** Solo TON + TOF.
- **b)** TON + TOF + TP (impulso).
- **c)** Los tres + temporizador estrella-triángulo (muy usado en arranque de motores).

**Recomendación: (b).** El motor de eventos es el mismo para los tres; el coste marginal del TP son
un símbolo y un bloque de tests. El estrella-triángulo es en realidad un circuito compuesto que el
usuario puede dibujar con TON + contactos, así que no lo haría como componente primitivo en V1.

**Respuesta:** _(pendiente)_

---

### 🔴 P4 — ¿Algún componente más allá del catálogo mínimo?

El catálogo del §7 del plan cubre lo que exige el spec: fuente CA, interruptores NO/NC, pulsadores
NO/NC, bobina, contactos NO/NC, timers + contactos temporizados, lámpara.

**Candidatos habituales en diagramas de control:**
- Parada de emergencia (hongo, enclavado — es un pulsador NC con retención)
- Selector de 2 o 3 posiciones
- Relé térmico / protección de sobrecarga (contacto auxiliar de disparo)
- Fusible / interruptor magnetotérmico
- Motor trifásico (símbolo de carga)
- Bocina / sirena
- Bornera / punto de conexión etiquetado
- Contacto de final de carrera
- Texto libre / anotaciones y marco de título

**Recomendación:** V1 cerrado al catálogo mínimo **+ parada de emergencia + selector de 3 posiciones
+ anotaciones de texto**. Los tres aparecen en casi cualquier diagrama real y son baratos (reutilizan
comportamientos ya existentes). El resto queda para V1.1. Marcá los que quieras sumar o sacar.

**Respuesta:** _(pendiente)_

---

### 🟡 P5 — ¿Fuentes trifásicas o solo monofásicas L/N?

**Contexto.** El §8.1 define la fuente como par `L`/`N`. Pero los circuitos de potencia reales llevan
L1/L2/L3 y el modelo de "identidad de fase" se extiende de forma natural.

**Opciones**
- **a)** Solo monofásica L/N en V1. Varias fuentes independientes = varias fuentes A, B, C.
- **b)** Sumar una fuente trifásica L1/L2/L3/N. Implica decidir si L1 y L2 de la *misma* fuente
  tocándose es corto (respuesta: sí, en la realidad lo es).
- **c)** (a) ahora, (b) como evolución ya prevista en el modelo.

**Recomendación: (c).** Mantener `SourceIdentity` como está y modelar la fase como
`(sourceId, phaseIndex)` desde el principio, aunque en V1 `phaseIndex` sea siempre 0. Así sumar
trifásica después es agregar un componente, no rehacer el solver. Coste hoy: prácticamente cero.

**Respuesta:** _(pendiente)_

---

## Bloque C — Comportamiento del editor

---

### 🔴 P14 — ¿Se permiten cables con un extremo suelto?

**Contexto.** Mientras dibujás, es cómodo poder dejar un cable "colgando" y conectarlo después.
Pero un extremo suelto no tiene vértice en el grafo y complica el modelo.

**Opciones**
- **a)** No. Un cable siempre termina en un terminal o sobre otro cable. Si soltás en el vacío, el
  cable no se crea (se cancela).
- **b)** Sí, con un endpoint `free` de posición propia, dibujado con un marcador de "extremo libre".
- **c)** Sí, pero solo durante el trazado; al cambiar de herramienta o simular, los sueltos se borran.

**Recomendación: (a).** Mantiene el invariante "el documento solo tiene aristas entre vértices
nombrados", que es lo que hace sólido todo el modelo de conectividad y de ruteo. El costo de UX es
bajo: la vista previa te muestra si vas a poder terminar ahí o no.

**Respuesta:** _(pendiente)_

---

### 🔴 P15 — Al borrar un componente, ¿qué pasa con sus cables?

**Opciones**
- **a)** Se borran los cables conectados (borrado en cascada).
- **b)** Los cables quedan con un extremo suelto (requiere que P14 sea sí).
- **c)** Se borran los cables y, si eso deja junctions de grado ≤ 2, se limpian también.

**Recomendación: (c).** Es la versión de (a) que además deja el documento limpio, sin junctions
huérfanos ni cables partidos sin motivo. Todo dentro de **una sola** transacción de historial, para
que un `Ctrl+Z` lo devuelva todo de una vez.

**Respuesta:** _(pendiente)_

---

### 🟡 P16 — ¿Los junctions de grado 2 se fusionan automáticamente?

**Contexto.** Hacés un junction en el cable A (queda partido en A₁ + A₂ + el cable nuevo). Después
borrás el cable nuevo. Ahora el junction une solo A₁ con A₂: eléctricamente es lo mismo que un cable
entero, pero el documento tiene un vértice y una arista de más, y se sigue dibujando... nada, porque
el punto solo se dibuja con grado ≥ 3.

**Opciones**
- **a)** Sí, se fusionan: A₁ + A₂ vuelven a ser un solo cable A.
- **b)** No, se dejan. Es inofensivo y evita sorpresas si el usuario había ajustado la ruta a mano.

**Recomendación: (a).** Mantiene el documento canónico, que es lo que hace comparables los tests de
undo/redo (§18.5 exige comparación exacta del documento serializado). Sin esto, `crear junction` +
`deshacer` podría dejar un documento distinto del original.

**Respuesta:** _(pendiente)_

---

### 🟡 P17 — Refinamiento manual de rutas: ¿cómo y qué pasa al mover?

**Contexto.** El §5.8 permite que el auto-ruteo sea básico *siempre que el usuario pueda refinarlo a
mano*. Dos sub-preguntas.

**(i) ¿Cómo se edita la ruta?**
- **a)** Arrastrando un segmento entero de forma perpendicular (estilo KiCad/Visio). Más natural.
- **b)** Arrastrando puntos de control individuales.

**(ii) ¿Qué pasa con la ruta manual cuando movés el componente conectado?**
- **a)** Se descarta y se vuelve a rutear automáticamente. Simple, pero perdés tu trabajo.
- **b)** Se conserva y solo se re-conectan los extremos. Respeta tu trabajo, pero puede quedar feo.
- **c)** Se conserva mientras el movimiento sea chico; si es grande, se descarta y se avisa.

**Recomendación: (i)=(a), (ii)=(b) con un botón "restablecer ruta" en el panel de propiedades.**
Nunca destruir trabajo manual sin pedirlo, pero dejar la vía de escape a un click.

**Respuesta:** _(pendiente)_

---

### 🟡 P18 — Tamaño de grid y escala de los componentes

**Contexto.** Hay que fijar una unidad. Propongo: grid = **10 px lógicos** al 100% de zoom, y los
símbolos ocupan múltiplos de grid (por ejemplo, una bobina de 4×6 unidades = 40×60 px). Los
terminales caen siempre en intersecciones de grid.

**La pregunta:** ¿tenés preferencia por diagramas más compactos o más espaciados? ¿Querés que el
tamaño del grid sea configurable por el usuario?

**Recomendación:** grid fijo de 10 px con zoom de 25 % a 400 %. El grid configurable complica el snap
y los tests de ruteo sin aportar mucho.

**Respuesta:** _(pendiente)_

---

### 🟢 P20 — ¿Copiar / pegar / duplicar en V1?

El spec no los menciona, pero es de lo primero que se extraña en un editor.

**Recomendación: sí, en M16 si hay tiempo.** `Ctrl+C`/`Ctrl+V`/`Ctrl+D`, con re-generación de ids y
`ref` auto-incrementado (`K1` → `K2`). Si aprieta el tiempo, se corta sin afectar nada más.

**Respuesta:** _(pendiente)_

---

### 🟢 P21 — ¿Anotaciones de texto libre y marco de título?

Etiquetas sueltas en el diagrama, nombre del circuito, autor, fecha. Es lo que convierte un dibujo en
un plano presentable.

**Recomendación: solo texto libre en V1** (ya incluido en P4). Marco de título y exportación a PDF
quedan para V1.1.

**Respuesta:** _(pendiente)_

---

## Bloque D — Experiencia de simulación

---

### 🟡 P22 — ¿Un temporizador de 5 s tarda 5 segundos reales?

**Contexto.** El motor usa tiempo de simulación, pero hay que decidir cómo se mapea al tiempo real
para el usuario.

**Opciones**
- **a)** 1:1 en tiempo real. Lo más intuitivo.
- **b)** 1:1 + control de velocidad (0.25× / 1× / 4×) para no esperar temporizadores largos.
- **c)** (b) + botones de pausa y de "saltar al próximo evento".

**Recomendación: (b) en V1, (c) como extra si sobra tiempo.** El control de velocidad cuesta casi
nada (es un multiplicador en `advanceTo`) y evita que probar un temporizador de 10 minutos sea
insoportable. La pausa y el paso a paso son más UI de la que justifican en V1.

**Respuesta:** _(pendiente)_

---

### 🟡 P23 — Durante la simulación, ¿se puede seguir navegando el lienzo?

**Recomendación: sí.** Pan, zoom, seleccionar para inspeccionar propiedades (en solo lectura) y ver
el estado de un nodo. Lo que se bloquea es solo la edición **estructural**: mover, borrar, rotar,
cablear, cambiar propiedades. Confirmame si querés algo más restrictivo.

**Respuesta:** _(pendiente)_

---

### 🟡 P25 — El estado de un interruptor mantenido, ¿se guarda en el archivo?

**Contexto.** Cerrás `S1`, parás la simulación, guardás. Al abrir el archivo, ¿`S1` está cerrado?

**Opciones**
- **a)** Sí. Es una propiedad `initialState` del documento, editable también en modo edición.
- **b)** No. Siempre arranca en su estado normal (NO abierto / NC cerrado); el estado en simulación
  es puramente runtime.
- **c)** Se guarda `initialState` como propiedad editable, pero lo que hagas *durante* la simulación
  no lo modifica; al parar, vuelve al inicial.

**Recomendación: (c).** Separa limpiamente "cómo arranca el circuito" (dato del documento, §14.3 lo
contempla) de "qué hice mientras corría" (runtime, que el §14.3 dice explícitamente no persistir).
Además hace que cada corrida sea reproducible desde el mismo punto de partida, que es el §17.

**Respuesta:** _(pendiente)_

---

### 🟢 P26 — ¿Qué querés ver en el panel de error?

**Recomendación:** tipo de falla, mensaje en castellano llano, lista clickeable de componentes y
nodos involucrados (al hacer click, el lienzo centra y resalta), tiempo de simulación congelado y un
botón "Volver a editar". En el caso de oscilación, además la secuencia de estados que se repite
(`K1 ON → K1.1 abre → K1 OFF → K1.1 cierra → ...`), que es lo que realmente le enseña al usuario
qué hizo mal.

**Respuesta:** _(pendiente)_

---

## Bloque E — Técnicas

---

### 🔴 P27 — ¿React + TypeScript + Vite + Zustand?

**Recomendación: sí.** Justificación en los ADR-02 y ADR-03 del plan. Lo importante: el núcleo
(`core/`) es TypeScript puro sin dependencias de framework, así que si mañana cambiás de opinión
sobre React, se reescribe solo la capa de UI y el simulador queda intacto.

**Si preferís otra cosa** (Svelte, Vue, vanilla), decímelo ahora: cambia M0–M5 pero no el núcleo.

**Respuesta:** _(pendiente)_

---

### 🔴 P28 — ¿SVG o Canvas para el lienzo?

**Recomendación: SVG.** Cada componente y cada cable es un elemento del DOM → los tests E2E pueden
consultarlos directamente en vez de comparar píxeles, el hit-testing es gratis y los estilos salen
por CSS. Canvas solo gana con miles de elementos simultáneos, que no es el caso de un diagrama de
control. Si el rendimiento llegara a ser un problema, se migra solo `app/canvas/`.

**Respuesta:** _(pendiente)_

---

### 🔴 P29 — Undo/redo: ¿snapshots inmutables en vez de comando+inverso?

**Contexto.** El §15 del spec recomienda "patrón comando **o** historial de estado inmutable". Propongo
el segundo.

**Por qué.** El §18.5 exige que tras `deshacer ×N` + `rehacer ×N` el documento serializado coincida
**exactamente** con el esperado. Con snapshots eso es cierto por construcción. Con comandos inversos,
cada comando nuevo es una oportunidad de escribir un inverso incompleto — y esos bugs aparecen meses
después, en secuencias raras. El costo es memoria: con documentos de este tamaño y structural
sharing (Immer), es despreciable.

**Recomendación: snapshots, con límite de 200 entradas.**

**Respuesta:** _(pendiente)_

---

### 🟡 P30 — Entorno: ¿versión de Node, gestor de paquetes, repositorio?

La carpeta todavía no es un repo git.

**Recomendación:** `git init` ahora mismo, Node 20 LTS, **pnpm** (más rápido y estricto con las
dependencias fantasma; si preferís npm, sin problema), un solo paquete (no monorepo — la separación
de capas ya la garantizan las reglas de lint).

**Respuesta:** _(pendiente)_

---

### 🟡 P31 — Router: ¿hasta dónde tiene que llegar la calidad del ruteo en V1?

**Contexto.** El §5.7 pide que *"dos segmentos no relacionados no queden uno sobre otro en el mismo
camino de grid"*. Es el requisito más difícil del spec y el que más esfuerzo puede consumir. Mi plan
lo parte en dos: heurístico simple en M8 (desbloquea todo lo demás) y A* con penalizaciones en M14.

**La pregunta:** ¿cuál es tu umbral de aceptación?
- **a)** Que nunca se solapen cables de nodos distintos, aunque el ruteo dé alguna vuelta fea.
- **b)** Que el ruteo se vea prolijo en los casos típicos, aceptando solapes raros que el usuario
  puede corregir a mano.
- **c)** Que esquive además los componentes (que ningún cable cruce por encima de un símbolo).

**Recomendación: (a) + (c), medido sobre fixtures concretos.** La ambigüedad eléctrica es un problema
de *corrección* (no podés saber si dos cables superpuestos son el mismo nodo), mientras que la vuelta
fea es solo un problema de estética que el refinamiento manual resuelve. Si estás de acuerdo, M14
apunta a "cero solapamiento colineal entre nets distintos" como aserción automatizada.

**Respuesta:** _(pendiente)_

---

### 🟡 P32 — ¿Vitest + Playwright para las pruebas?

**Recomendación: sí.** Vitest comparte configuración con Vite y corre el núcleo puro sin DOM (rápido).
Playwright maneja bien el pointer-down sostenido, que es imprescindible para probar los pulsadores
momentáneos, y corre en los tres motores de navegador.

**Respuesta:** _(pendiente)_

---

### 🟡 P33 — ¿Dónde se va a desplegar?

Afecta cómo se sirve `version.json` con `Cache-Control: no-store` (cada plataforma se configura
distinto).

**Opciones:** Netlify · Vercel · GitHub Pages · Cloudflare Pages · nginx propio · todavía no se sabe.

**Recomendación:** si no tenés preferencia, **Netlify o Cloudflare Pages**: ambos permiten fijar
cabeceras por ruta con un archivo en el repo, que es justo lo que necesitamos. GitHub Pages **no**
permite cabeceras personalizadas, así que ahí habría que resolverlo con un parámetro anti-caché en
la URL.

**Respuesta:** _(pendiente)_

---

### 🟡 P34 — ¿Hace falta que funcione sin internet (PWA/offline)?

**Contexto.** El §3.3 advierte que si se usa un Service Worker, no debe dejar clientes clavados en
código viejo. Mi propuesta es **no usar Service Worker en absoluto**: elimina la clase entera de
problemas, a cambio de no tener offline.

**Recomendación: sin Service Worker en V1.** Si el uso offline es un requisito real (por ejemplo,
usarlo en un taller sin señal), decímelo ahora, porque cambia el ADR-08 y suma un hito.

**Respuesta:** _(pendiente)_

---

### 🟢 P35 — Navegadores y dispositivos objetivo

**Recomendación:** Chrome, Edge y Firefox de escritorio actuales + Safari 16+. **Sin soporte táctil ni
móvil en V1** (dibujar diagramas de control en un teléfono no es un caso de uso real, y los gestos
táctiles duplicarían el trabajo de la capa de interacción). Tablet con mouse/lápiz funcionaría de
casualidad, sin garantía.

**Respuesta:** _(pendiente)_

---

### 🟢 P36 — ¿Idioma de la interfaz?

**Opciones:** solo castellano · solo inglés · ambos con selector.

**Recomendación: castellano, con todos los textos centralizados en un único archivo de strings desde
el día uno.** Así agregar inglés después es traducir un archivo, no recorrer 40 componentes. Poner el
selector completo en V1 no aporta si sos el único usuario por ahora.

**Respuesta:** _(pendiente)_

---

### 🟢 P38 — Guardar/abrir: ¿descarga clásica o File System Access API?

**Contexto.** La API moderna permite "Guardar" sobre el mismo archivo sin volver a descargarlo, pero
solo funciona en navegadores basados en Chromium.

**Recomendación: descarga + input de archivo como base (funciona en todos lados), y usar la File
System Access API cuando esté disponible** para que `Ctrl+S` guarde en el sitio de siempre. Detección
de capacidad, sin romper en Firefox/Safari.

**Respuesta:** _(pendiente)_

---

### 🟢 P39 — ¿Autoguardado en el navegador?

**Recomendación: sí.** Guardado automático a `localStorage` con antirrebote, y al abrir la app,
ofrecer recuperar el último trabajo. Es barato y evita perder media hora de dibujo por una recarga
accidental. No reemplaza guardar el archivo JSON.

**Respuesta:** _(pendiente)_

---

### 🟢 P40 — ¿Inicializo el repositorio git?

**Recomendación: sí**, con `.gitignore`, y commits por hito para que puedas revisar el avance en
pedazos digeribles. Confirmame también si querés que lo suba a algún remoto.

**Respuesta:** _(pendiente)_

---

## Resumen: lo mínimo para arrancar

Si solo querés contestar lo imprescindible para que empiece M0–M1, son estas nueve:

| | Pregunta | Mi recomendación en una línea |
|---|---|---|
| 🔴 | **P6** L–N directo | Sí, es corto |
| 🔴 | **P7** L(A) con N(B) | Mismo trato que P6 |
| 🔴 | **P8** ¿las cargas conducen? | No, solo sensan |
| 🔴 | **P9** ¿neutro de la misma fuente? | Cualquier neutro sirve |
| 🔴 | **P1** temporizadores | TON + TOF + TP |
| 🔴 | **P4** componentes extra | + parada de emergencia, selector 3 posiciones, texto |
| 🔴 | **P14** extremos sueltos | No se permiten |
| 🔴 | **P15** borrado en cascada | Sí, con limpieza de junctions |
| 🔴 | **P27/P28/P29** stack | React+TS+Vite+Zustand · SVG · snapshots |

---

## Bitácora

| Fecha | Cambio |
|---|---|
| 2026-09-21 | Versión inicial, 30 preguntas. Pendiente de respuestas. |
