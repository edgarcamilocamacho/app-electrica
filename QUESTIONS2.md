# Preguntas abiertas — Ronda 2 · ⚠️ ARCHIVO CERRADO

> **Este archivo quedó superado. No escribas respuestas acá.**
>
> - Lo decidido está en [RESPONSE_ROUND_2.md](RESPONSE_ROUND_2.md).
> - Lo que quedó abierto se trasladó a [QUESTIONS3.md](QUESTIONS3.md).
> - Varias recomendaciones de acá fueron **revertidas o endurecidas** por la ronda 2: Q1/Q2 (RTO
>   eliminado), Q6 (tecla `B`, nueva semántica de la goma), Q7 (solapamiento bloqueante), Q8
>   (normalizar), Q11 (referencias rotas bloquean) y Q14/Q15 (copiar/pegar y exportación entran en V1).
>   El detalle está en el §0 de [PLAN.md](PLAN.md).
>
> Se conserva solo como registro.

---

> **Cómo usar este archivo:** escribí tu respuesta en la línea `**Respuesta:**` de cada pregunta.
>
> **Atajo:** si estás de acuerdo con todo, escribí `Acepto todas las recomendaciones` y contestá solo
> las que quieras cambiar.
>
> Acá **no** se repite nada ya decidido en [RESPONSE_ROUND_1.md](RESPONSE_ROUND_1.md). Hay dos tipos
> de preguntas:
> - **Nuevas**, que aparecieron al rediseñar el modelo de cables según tus decisiones;
> - **Heredadas** de [QUESTIONS1.md](QUESTIONS1.md) que quedaron sin responder (marcadas *antes Pxx*).
>
> Las referencias `Qxx` aparecen marcadas con ⚠️ a lo largo de [PLAN.md](PLAN.md).

**Prioridad:** 🔴 bloquea el inicio · 🟡 se necesita antes de su hito · 🟢 puede esperar

---

## Bloque A — Nuevas, derivadas del rediseño

---

### 🔴 Q1 — ¿Cómo se resetea un RTO?

**Contexto.** El RTO acumula tiempo y **conserva el acumulado cuando se desenergiza**. Esa es toda su
razón de ser. Pero entonces necesita una forma explícita de volver a cero, y esa decisión cambia el
símbolo, la cantidad de terminales y el panel de propiedades. Es la única pregunta que bloquea el
diseño de un componente.

**Opciones**
- **a)** **Segundo par de terminales en el propio símbolo** (entrada de reset). Energizar el reset
  pone el acumulado en cero y apaga la salida. El timer pasa a tener 4 terminales.
- **b)** **Elemento de reset separado, vinculado por referencia** — como los contactos: colocás un
  bloque `RESET T1` en cualquier parte del diagrama y lo energizás. Sigue la misma filosofía de
  vinculación lógica que ya tienen bobina y contacto.
- **c)** **Botón en tiempo de ejecución**: hacer clic en el símbolo del timer durante la simulación lo
  resetea. Sin terminales extra, pero el reset deja de ser parte del circuito.

**Recomendación: (b).** Es coherente con el modelo que ya elegiste: `K1` y `K1.1` no dependen de la
proximidad física, y el reset de `T1` tampoco tendría por qué. Además deja el símbolo del timer con
dos terminales, igual que TON y TOF, lo que mantiene la biblioteca uniforme. La (a) es más fiel a un
temporizador industrial real; si te importa más el realismo del símbolo que la uniformidad, es
igual de defendible — decime cuál.

**Respuesta:** _(pendiente)_

---

### 🔴 Q2 — RTO: ¿la salida queda enclavada al alcanzar el preset?

**Contexto.** Depende de Q1 pero es una decisión aparte. Una vez que el acumulado llega al preset:

**Opciones**
- **a)** La salida se pone en ON y **queda enclavada** hasta que llegue un reset, aunque la entrada se
  caiga. Es el comportamiento estándar del RTO de PLC.
- **b)** La salida sigue a la entrada una vez alcanzado el preset (ON solo mientras esté energizado).

**Además:** ¿el acumulado sobrevive a un ciclo de parar y volver a arrancar la simulación?
**Recomendación:** no. Al arrancar, todo el estado de runtime se reinicia — es lo que garantiza que
cada corrida sea reproducible (§17 del spec).

**Recomendación general: (a) + acumulado que se reinicia al arrancar la simulación.**

**Respuesta:** _(pendiente)_

---

### 🔴 Q3 — Al **mover** un componente, ¿un terminal que aterriza sobre un segmento crea conexión?

**Contexto.** Hay una asimetría a resolver entre dos decisiones tuyas:

- El §5 de la ronda 1 dice que **colocar** un componente con un terminal exactamente sobre un
  segmento **crea la conexión automáticamente**.
- El §14 dice que **ningún movimiento inventa una conexión con un cable que simplemente se cruza**.

"Simplemente se cruza" (el cuerpo del símbolo pasa por encima de un cable) es claramente distinto de
"un terminal cae exactamente encima de un segmento". Pero hay que escribirlo.

**Opciones**
- **a)** **Simétrico:** mover se comporta igual que colocar. Al **soltar** (no durante el arrastre), si
  un terminal queda exactamente sobre un segmento o sobre un extremo libre, se conecta. Durante el
  arrastre la vista previa resalta qué conexiones se van a crear.
- **b)** **Asimétrico:** solo la colocación inicial conecta. Mover nunca crea conexiones nuevas; para
  conectar después hay que trazar un cable a mano.
- **c)** Simétrico pero con confirmación explícita (una tecla modificadora mientras se suelta).

**Recomendación: (a).** Que "colocar conecta" y "mover no" es una distinción que el usuario no puede
predecir mirando la pantalla: el resultado final es idéntico en ambos casos y la conectividad
dependería de cómo llegaste ahí. Con el resaltado en la vista previa, la (a) nunca sorprende. Y sigue
respetando tu test: el cuerpo del componente cruzando cables no conecta nada — solo un **terminal**
aterrizando **exactamente** sobre un segmento.

**Respuesta:** _(pendiente)_

---

### 🟡 Q4 — Refinamiento manual: ¿cómo se mueve un segmento? *(antes P17, sin responder)*

**Contexto.** Ahora que los segmentos son entidades reales del documento, refinar la ruta es moverlos.
Falta definir la mecánica.

**Opciones**
- **a)** **Arrastre perpendicular.** Arrastrás un segmento horizontal hacia arriba o abajo; sus dos
  vértices suben con él y los segmentos verticales vecinos se estiran. Si un vecino estaba ligado a un
  terminal, se crea un codo nuevo para alcanzarlo. Es el modelo de KiCad y de Visio.
- **b)** **Arrastre de vértices.** Movés los puntos de codo uno por uno. Más control, más tedioso.
- **c)** Las dos.

**Y una sub-pregunta:** ¿qué pasa con un segmento ajustado a mano cuando después movés el componente
conectado?
- **i)** Se repara localmente igual que cualquier otro (puede deshacer parte de tu ajuste).
- **ii)** Los segmentos tocados a mano se marcan como "fijados" y la reparación los respeta, absorbiendo
  el cambio en los segmentos vecinos.

**Recomendación: (a) + (i), con un botón "enderezar" en el panel para rehacer la ruta de un tramo.**
La opción (ii) suena mejor de lo que es: requiere un bit extra de estado por segmento, complica la
canonicalización (¿un segmento fijado se puede fusionar con un colineal?) y en la práctica el usuario
vuelve a ajustar igual. Si preferís (ii), decímelo ahora porque afecta el modelo de datos.

**Respuesta:** _(pendiente)_

---

### 🟡 Q5 — ¿Se puede dibujar a propósito un cable que termina en el vacío?

**Contexto.** Ya decidiste que los extremos libres existen y aparecen al borrar un componente. La
pregunta es si además se pueden crear a propósito mientras dibujás.

**Opciones**
- **a)** Sí. Trazás y terminás con doble clic o `Enter` en cualquier punto vacío; queda un extremo
  libre ○. Útil para dibujar primero el cableado y colocar los componentes después.
- **b)** No. El cable solo se confirma si termina en un terminal, un segmento o un vértice; si no, se
  cancela.

**Recomendación: (a).** Ya tenés que soportar extremos libres igual, así que no cuesta nada, y
habilita un flujo de trabajo natural ("tiro las líneas primero"). Además combina con Q3: después
colocás el componente encima del extremo y se conecta solo.

**Respuesta:** _(pendiente)_

---

### 🟡 Q6 — Herramienta de goma: ¿qué puede borrar?

**Contexto.** Tu §11 dice: clic sobre componente lo borra, clic sobre segmento lo borra. Falta definir
qué pasa al hacer clic sobre los demás objetos visibles.

**Sub-preguntas**
1. **¿Clic sobre un punto de junction (●)?** — **Recomendación: no hace nada.** El junction no es una
   entidad borrable: existe porque hay 3 segmentos. Para deshacerlo, borrás el segmento que sobra y la
   canonicalización lo convierte de vuelta en esquina o en recta.
2. **¿Clic sobre un extremo libre (○)?** — **Recomendación: borra el segmento que cuelga de él** (es
   lo que el usuario quiere decir con "borrame esta puntita).
3. **¿Clic sobre una esquina?** — **Recomendación: borra el segmento bajo el cursor**, el que esté
   más cerca. Nunca los dos.
4. **¿Tecla?** — **Recomendación: `E`.** `D` queda libre por si más adelante querés "duplicar".

**Respuesta:** _(pendiente)_

---

### 🟡 Q7 — Segmentos de redes distintas superpuestos: ¿avisar?

**Contexto.** Tu §8 acepta que el router haga lo que pueda, y tu §7 deja claro que superposición
geométrica no implica conexión. Correcto eléctricamente, pero si dos cables de **redes distintas**
quedan exactamente uno encima del otro, el usuario ve una sola línea y no puede saber qué está
mirando.

**Opciones**
- **a)** Detectarlo y listarlo en el panel de diagnósticos, con clic para centrar y resaltar. No
  bloquea nada.
- **b)** Además dibujar un indicador en el lienzo (por ejemplo un patrón de rayas en el tramo ambiguo).
- **c)** No hacer nada: es responsabilidad del usuario acomodar el dibujo.

**Recomendación: (a), y (b) solo si al usarlo resulta molesto no verlo.** Detectarlo es barato (ya
calculamos el mapa de ocupación para el router) y convierte un problema invisible en uno visible sin
interrumpir a nadie.

**Respuesta:** _(pendiente)_

---

### 🟢 Q8 — Segmentos colineales de la misma red que se **solapan**

**Contexto.** Caso raro pero posible: `A(0,0)—B(5,0)` y `C(2,0)—D(8,0)`, misma red, misma línea,
parcialmente encimados. La fusión automática de colineales no los toca, porque no comparten un vértice
intermedio "limpio".

**Opciones**
- **a)** Normalizarlos: reescribirlos como un tramo único de `(0,0)` a `(8,0)`, con vértices en los
  puntos significativos.
- **b)** Dejarlos. No hacen daño eléctrico y el caso es infrecuente.

**Recomendación: (b) en V1, más una comprobación en los tests de que no rompen nada.** Normalizar
solapamientos parciales es un algoritmo con bastantes casos borde para un caso que el usuario casi no
va a producir. Si aparece en la práctica, se agrega como paso 6 de la canonicalización.

**Respuesta:** _(pendiente)_

---

### 🟢 Q9 — Dos terminales exactamente en la misma posición

**Contexto.** Si movés un componente hasta que su terminal queda exactamente sobre el terminal de
otro, el segmento que los une tiene longitud cero. No se pueden fusionar en un solo vértice (un
vértice liga un solo terminal).

**Opciones**
- **a)** Permitirlo: el segmento de longitud cero se conserva y se dibuja como punto de unión ●. Son
  eléctricamente el mismo nodo, que es lo correcto.
- **b)** Impedirlo: el snap no deja soltar un terminal sobre otro terminal.

**Recomendación: (a).** La (b) obliga a validar posiciones en cada movimiento y genera el problema de
"no puedo soltar acá y no entiendo por qué". La (a) es coherente: si están conectados, están
conectados.

**Respuesta:** _(pendiente)_

---

## Bloque B — Semántica eléctrica pendiente

---

### 🔴 Q10 — ¿Una carga entre fase A y neutro B enciende? *(antes P9)*

**Contexto.** Esta quedó sin responder y ahora tiene más filo. Decidiste que `L(A)` y `N(B)` **en el
mismo nodo** son cortocircuito. Pero una carga los ve en nodos **distintos** (uno en cada terminal),
así que no hay corto — y hay que decidir si enciende.

```
L_A ──[ S1 ]── ( H1 ) ──── N_B          ← neutros NO unidos entre sí
```

**Opciones**
- **a)** **Sí enciende.** Cualquier neutro sirve para cerrar el circuito lógico.
- **b)** **No enciende.** La carga necesita el neutro de la misma fuente que la fase.
- **c)** No enciende **y** se marca en el panel de diagnósticos como error de cableado.

**Recomendación: (b).** Cambio respecto de lo que te recomendé en la ronda 1, y el motivo es tu propia
decisión: si declaraste que mezclar fase A con neutro B es tan incompatible como para ser un
cortocircuito, sería contradictorio que esa misma combinación alimente una carga sin problema. La (b)
deja el modelo coherente: las fuentes son independientes salvo que unas sus neutros explícitamente
(que el §9.3 del spec permite, y ahí pasan a ser el mismo nodo y el caso desaparece).

**Respuesta:** _(pendiente)_

---

### 🟡 Q11 — Referencias de contacto rotas y `ref` duplicados *(antes P13)*

**Contexto.** Un contacto `K1.1` que apunta a una bobina `K1` que no existe o que fue renombrada. O
dos bobinas distintas llamadas `K1`.

**Recomendación:**
- **Referencia rota → aviso, no bloqueo.** El contacto se dibuja punteado, aparece en diagnósticos y
  en simulación se comporta como si su bobina estuviera siempre OFF. Permite dibujar en cualquier
  orden (poner el contacto antes que la bobina es normal) sin que la app te frene.
- **`ref` duplicado en dos bobinas → bloquea el arranque de la simulación.** Es ambigüedad real: no
  hay forma de decidir qué bobina manda sobre los contactos.

**Respuesta:** _(pendiente)_

---

### 🟡 Q12 — ¿Fuentes trifásicas? *(antes P5)*

**Contexto.** El spec define la fuente como par `L`/`N`. Los circuitos de potencia reales llevan
L1/L2/L3.

**Recomendación: monofásica en V1, pero modelando la fase como `(sourceId, phaseIndex)` desde el
principio**, con `phaseIndex` siempre 0. Agregar trifásica después es sumar un componente al registro,
no rehacer el solver. Costo hoy: prácticamente cero. (Si entra trifásica, L1 y L2 de la *misma* fuente
tocándose también sería corto — la regla ya lo cubre.)

**Respuesta:** _(pendiente)_

---

## Bloque C — Alcance del catálogo

---

### 🔴 Q13 — ¿Componentes más allá del catálogo mínimo? *(antes P4)*

**Contexto.** El catálogo del §7 del plan es el mínimo que exige el spec: fuente CA, interruptores
NO/NC, pulsadores NO/NC, bobina, contactos NO/NC, TON/TOF/RTO con sus contactos, lámpara, puente.

**Candidatos habituales en diagramas de control:**
parada de emergencia (hongo enclavado) · selector de 2 o 3 posiciones · relé térmico / protección de
sobrecarga · fusible o magnetotérmico · motor trifásico · bocina o sirena · bornera etiquetada ·
final de carrera · texto libre y marco de título.

**Recomendación: el mínimo + parada de emergencia + selector de 3 posiciones + texto libre.** Los tres
aparecen en casi cualquier diagrama real y son baratos: reutilizan comportamientos que ya existen
(la parada de emergencia es un pulsador NC con enclavamiento; el selector son dos contactos
vinculados). El resto, a V1.1. Marcá lo que quieras sumar o sacar.

**Respuesta:** _(pendiente)_

---

### 🟢 Q14 — ¿Copiar / pegar / duplicar? *(antes P20)*

**Recomendación: sí, en M17 si hay tiempo.** `Ctrl+C` / `Ctrl+V` / `Ctrl+D`, regenerando ids y
auto-incrementando `ref` (`K1` → `K2`). Si el cronograma aprieta, se corta sin afectar nada más. Nota:
copiar una selección que incluye segmentos requiere decidir si se copian también los vértices de los
extremos — lo resolvería copiando solo lo que quede completamente dentro de la selección.

**Respuesta:** _(pendiente)_

---

### 🟢 Q15 — ¿Anotaciones de texto y marco de título? *(antes P21)*

**Recomendación: solo texto libre en V1** (ya incluido en Q13). Marco de título y exportación a PDF o
imagen, a V1.1.

**Respuesta:** _(pendiente)_

---

## Bloque D — Experiencia de simulación

---

### 🟡 Q16 — ¿Un temporizador de 5 s tarda 5 segundos reales? *(antes P22)*

**Recomendación: 1:1 con tiempo real, más un control de velocidad (0.25× / 1× / 4×).** El multiplicador
cuesta una línea en `advanceTo` y evita que probar un RTO de 10 minutos sea insoportable. Pausa y paso
a paso quedan fuera de V1: son más UI de la que justifican.

**Respuesta:** _(pendiente)_

---

### 🟡 Q17 — Durante la simulación, ¿se puede seguir navegando? *(antes P23)*

**Recomendación: sí.** Pan, zoom y seleccionar para inspeccionar propiedades en solo lectura y ver el
estado eléctrico de un nodo. Se bloquea únicamente la edición **estructural**: mover, borrar, rotar,
cablear, cambiar propiedades.

**Respuesta:** _(pendiente)_

---

### 🟡 Q18 — El estado de un interruptor mantenido, ¿se guarda en el archivo? *(antes P25)*

**Contexto.** Cerrás `S1`, parás la simulación, guardás. Al abrir, ¿`S1` está cerrado?

**Recomendación:** `initialState` es una **propiedad del documento** editable en modo edición, y lo que
hagas *durante* la simulación no la modifica: al parar, todo vuelve al estado inicial. Separa
limpiamente "cómo arranca el circuito" (dato, que el §14.3 del spec contempla) de "qué hice mientras
corría" (runtime, que el §14.3 dice explícitamente no persistir), y hace que cada corrida sea
reproducible desde el mismo punto de partida (§17 del spec).

**Respuesta:** _(pendiente)_

---

### 🟢 Q19 — ¿Qué querés ver en el panel de error? *(antes P26)*

**Recomendación:** tipo de falla · mensaje en castellano llano · lista clickeable de componentes y
nodos involucrados (clic → el lienzo centra y resalta) · tiempo de simulación congelado · botón
"Volver a editar". En caso de oscilación, además **la secuencia de estados que se repite**
(`K1 ON → K1.1 abre → K1 OFF → K1.1 cierra → …`), que es lo que realmente le explica al usuario qué
hizo mal. En caso de corto, qué dos identidades chocaron y por qué camino llegaron.

**Respuesta:** _(pendiente)_

---

## Bloque E — Técnicas

---

### 🔴 Q20 — ¿React + TypeScript + Vite + Zustand? *(antes P27)*

**Recomendación: sí.** Lo importante: `core/` es TypeScript puro sin dependencias de framework, así
que si mañana cambiás de opinión sobre React, se reescribe solo la capa de UI y el simulador queda
intacto. Si preferís otra cosa (Svelte, Vue, vanilla), decilo ahora: afecta M0–M5, no el núcleo.

**Respuesta:** _(pendiente)_

---

### 🔴 Q21 — ¿SVG o Canvas? *(antes P28)*

**Recomendación: SVG**, y con el nuevo modelo pesa todavía más: cada segmento es un objeto
seleccionable y borrable por separado, así que el hit-testing nativo del DOM pasa de cómodo a
decisivo — en Canvas habría que escribir a mano la detección de "qué segmento hay bajo el cursor".
Contrapartida: más elementos en el DOM (riesgo R7 del plan), mitigable con culling por viewport.

**Respuesta:** _(pendiente)_

---

### 🔴 Q22 — Undo/redo con snapshots inmutables *(antes P29)*

**Contexto.** El §15 del spec permite "patrón comando **o** historial de estado inmutable". Propongo el
segundo, y tu ronda 1 lo refuerza: ahora el historial también debe restaurar la **geometría** exacta
("undo devuelve tanto la posición como la geometría previa"). Con snapshots eso es cierto por
construcción; con comandos inversos habría que escribir y mantener correcto el inverso de cada
reparación geométrica y de cada paso de canonicalización, que son justo las operaciones con más casos
borde. Costo: memoria, despreciable con structural sharing.

**Recomendación: snapshots, límite de 200 entradas.**

**Respuesta:** _(pendiente)_

---

### 🟡 Q23 — Entorno: Node, gestor de paquetes, repositorio *(antes P30)*

**Recomendación:** Node 20 LTS, **pnpm**, un solo paquete (no monorepo — la separación de capas ya la
garantizan las reglas de lint). Si preferís npm, sin problema.

**Respuesta:** _(pendiente)_

---

### 🟡 Q24 — Tamaño de grid y escala de los símbolos *(antes P18)*

**Recomendación:** grid de **10 px lógicos** al 100 %, zoom de 25 % a 400 %, símbolos en múltiplos
enteros de grid (una bobina, por ejemplo, 4×6 unidades), terminales siempre en intersecciones. Grid
**no** configurable por el usuario: complicaría el snap y los tests de geometría sin aportar mucho.

¿Preferís diagramas más compactos o más espaciados?

**Respuesta:** _(pendiente)_

---

### 🟡 Q25 — ¿Vitest + Playwright? *(antes P32)*

**Recomendación: sí.** Vitest comparte configuración con Vite y corre el núcleo puro sin DOM (rápido,
y con el nuevo modelo la mayor parte de los tests son de núcleo puro). Playwright sostiene pointer-down,
imprescindible para los pulsadores momentáneos, y corre en los tres motores.

**Respuesta:** _(pendiente)_

---

### 🟡 Q26 — ¿Dónde se despliega? *(antes P33)*

Afecta cómo se sirve `version.json` con `Cache-Control: no-store`.

**Opciones:** Netlify · Vercel · Cloudflare Pages · GitHub Pages · nginx propio · todavía no se sabe.

**Recomendación:** si no tenés preferencia, **Netlify o Cloudflare Pages**: permiten fijar cabeceras
por ruta con un archivo en el repo, que es justo lo que necesitamos. GitHub Pages **no** admite
cabeceras personalizadas; ahí habría que resolverlo con un parámetro anti-caché en la URL.

**Respuesta:** _(pendiente)_

---

### 🟡 Q27 — ¿Tiene que funcionar sin internet? *(antes P34)*

**Recomendación: sin Service Worker en V1.** El §3.3 del spec advierte que un SW no debe dejar clientes
clavados en código viejo; no usarlo elimina la clase entera de problemas, a cambio de no tener
offline. Si usarlo en un taller sin señal es un requisito real, decímelo: cambia el ADR-08 y suma un
hito.

**Respuesta:** _(pendiente)_

---

### 🟢 Q28 — Navegadores y dispositivos *(antes P35)*

**Recomendación:** Chrome, Edge y Firefox de escritorio actuales + Safari 16+. **Sin soporte táctil ni
móvil en V1**: dibujar diagramas de control en un teléfono no es un caso de uso real y los gestos
táctiles duplicarían el trabajo de la capa de interacción, que con segmentos seleccionables ya es la
parte más cara del editor.

**Respuesta:** _(pendiente)_

---

### 🟢 Q29 — Idioma de la interfaz *(antes P36)*

**Recomendación: castellano, con todos los textos en un único archivo de strings desde el día uno.**
Agregar inglés después es traducir un archivo, no recorrer 40 componentes. El selector completo no
aporta si sos el único usuario por ahora.

**Respuesta:** _(pendiente)_

---

### 🟢 Q30 — Guardar/abrir: ¿descarga o File System Access API? *(antes P38)*

**Recomendación: descarga + input de archivo como base** (funciona en todos lados), **y usar la File
System Access API cuando esté disponible** para que `Ctrl+S` guarde sobre el mismo archivo. Detección
de capacidad, sin romper en Firefox ni Safari.

**Respuesta:** _(pendiente)_

---

### 🟢 Q31 — ¿Autoguardado en el navegador? *(antes P39)*

**Recomendación: sí.** Guardado automático a `localStorage` con antirrebote y oferta de recuperación al
abrir. Es barato y evita perder media hora de dibujo por una recarga accidental. No reemplaza guardar
el archivo JSON.

**Respuesta:** _(pendiente)_

---

### 🟢 Q32 — ¿Inicializo el repositorio git? *(antes P40)*

**Recomendación: sí**, con `.gitignore` y un commit por hito, para que puedas revisar el avance en
pedazos digeribles. Decime también si querés que lo suba a algún remoto.

**Respuesta:** _(pendiente)_

---

## Lo mínimo para arrancar

Nueve respuestas desbloquean M0 y M1 (el cimiento que rediseñamos en esta ronda):

| | Pregunta | Mi recomendación en una línea |
|---|---|---|
| 🔴 | **Q1** reset del RTO | Elemento de reset separado, vinculado por referencia |
| 🔴 | **Q2** salida del RTO | Queda enclavada hasta el reset |
| 🔴 | **Q3** mover sobre un segmento | Igual que colocar: conecta, con resaltado previo |
| 🔴 | **Q10** carga entre fase A y neutro B | No enciende (coherente con tu regla de corto) |
| 🔴 | **Q13** componentes extra | + parada de emergencia, selector 3 posiciones, texto libre |
| 🔴 | **Q20** framework | React + TS + Vite + Zustand |
| 🔴 | **Q21** render | SVG |
| 🔴 | **Q22** undo/redo | Snapshots inmutables |
| 🟡 | **Q23/Q24** entorno y grid | Node 20 + pnpm · grid de 10 px |

---

## Bitácora

| Fecha | Cambio |
|---|---|
| 2026-09-21 | Ronda 2: 9 preguntas nuevas del rediseño + 23 heredadas sin responder de la ronda 1 |
