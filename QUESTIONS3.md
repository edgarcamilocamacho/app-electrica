# Preguntas abiertas — Ronda 3 · ⚠️ ARCHIVO CERRADO

> **Este archivo quedó cerrado.** Las respuestas se dieron en la conversación y están registradas en
> [RESPONSE_ROUND_3.md](RESPONSE_ROUND_3.md) y en cada `**Respuesta:**` de abajo. Las interpretaciones
> I1–I18 fueron **aceptadas todas**. Q3.9 (despliegue) quedó resuelta en la práctica por el agregado
> del contenedor.

---

> **Cómo usar este archivo.** Tiene dos partes:
>
> 1. **Preguntas** (9): escribí tu respuesta en `**Respuesta:**`. Las 🔴 bloquean el arranque.
> 2. **Interpretaciones** (18): cosas que delegaste o que tuve que inferir. Ya están aplicadas en
>    [PLAN.md](PLAN.md). **Solo escribí algo si no estás de acuerdo**; si las dejás en blanco, quedan así.
>
> Atajo: `Acepto todas las recomendaciones` + las excepciones que quieras.
>
> No se repite nada de lo decidido en [RESPONSE_ROUND_1.md](RESPONSE_ROUND_1.md) ni en
> [RESPONSE_ROUND_2.md](RESPONSE_ROUND_2.md). Las referencias `Q3.x` aparecen con ⚠️ en el plan.

**Prioridad:** 🔴 bloquea el inicio · 🟡 se necesita antes de su hito · 🟢 puede esperar

---

## Parte 1 — Preguntas

---

### 🔴 Q3.1 — ¿Otros contactos geométricos ambiguos también son inválidos?

**Contexto.** Decidiste que dos segmentos de redes distintas **superpuestos en línea** son inválidos
al editar y bloquean la simulación si existen. Hay otros tres casos en los que dos redes distintas se
tocan geométricamente sin estar conectadas, y que a la vista se leen igual de ambiguos:

```text
(a) T sin punto               (b) Puntos coincidentes        (c) Cable sobre terminal ajeno

──────────────── red Y         red X ──────┐                         │ red Y
        │                                  │ ← esquina de X          │
        │ red X                red Y ──────┘ ← y esquina de Y      [K1]  ← el cable pasa justo
        │ (termina justo           en el mismo punto                 │     por el terminal A1
           sobre Y, sin ●)                                           │
```

Hoy ninguno de los tres conecta (la conectividad nunca es geométrica), pero tampoco están prohibidos.

**Opciones**
- **A)** Los tres son **inválidos al editar y bloqueantes si existen** — mismo tratamiento que el
  solapamiento en línea.
- **B)** Solo (c) es inválido; (a) y (b) se permiten.
- **C)** Ninguno es inválido: solo el solapamiento en línea, como ya decidiste.
- **D)** Se permiten, pero generan un aviso (no bloqueante).

**Recomendación: A.** Cuatro razones:

1. **Son indistinguibles de conexiones reales.** Para casi cualquier electricista una T es una unión;
   la única diferencia en pantalla sería la ausencia de un punto de pocos píxeles.
2. **Es la misma lógica que ya elegiste** para el solapamiento: el editor no deja crear lo que se ve
   ambiguo.
3. **Simplifica la implementación.** Con A, la validez depende solo de *cómo queda* el diagrama, no de
   *cómo se llegó*: un único validador sirve para la vista previa y para los diagnósticos. Tu regla
   "un terminal ya conectado no puede tocar otro conductor" queda cubierta automáticamente.
4. **Resuelve un hueco.** Mover un segmento nunca crea conexiones (tu §3). Sin A, podrías mover un
   tramo hasta que su extremo libre quede apoyado sobre otra red: una T sin conectar, que parece
   conectada. Con A, esa posición simplemente es inválida.

**Costo:** más posiciones rechazadas, y el router tiene que evitar pasar por terminales ajenos. Está
cubierto en el plan (riesgo R1, candidatas ampliadas + A* de respaldo + motivo visible en la vista
previa).

**Nota sobre un test de la ronda 1.** "Pasar sobre un terminal ajeno no conecta" sigue siendo cierto y
se sigue probando (con un documento importado). Con A se agrega que el editor **impide** crearlo.

**Respuesta:** **A** — los tres casos inválidos y bloqueantes. *(ronda 3, en la conversación)*

---

### 🔴 Q3.2 — ¿Aprobás el stack técnico propuesto?

**Contexto.** La ronda 2 dejó claro que estas decisiones no se tomaron y que no hay que atribuírselas a
producto. No apareció ninguna objeción, pero M0 no puede arrancar sin ellas. Te las junto para que las
apruebes o corrijas de una vez.

| # | Propuesta | Por qué, en una línea |
|---|---|---|
| T-01 | **SVG** para el lienzo | Cada segmento es un elemento clicable; los E2E consultan el DOM; exportar a PDF/imagen sale casi gratis |
| T-02 | **React + TypeScript + Vite** | UI declarativa; build con assets hasheados y número de versión |
| T-03 | **Zustand** para el estado | Los tests manipulan el estado sin montar la interfaz |
| T-04 | **Deshacer con copias inmutables** del documento | Restaura geometría exacta por construcción, que es lo que pediste |
| T-05 | **Vitest + Playwright**, E2E en Chromium y Firefox | Núcleo probado sin navegador; E2E reales en tus navegadores objetivo (Edge es Chromium) |
| T-06 | **Node 20 LTS + pnpm**, un solo paquete | — |
| T-08 | Guardar con **descarga + input** en todos lados, y **File System Access API** en Chromium para que `Ctrl+S` guarde sobre el mismo archivo | Funciona en todos y mejora donde se puede |
| T-10 | **jsPDF + svg2pdf.js** para PDF vectorial | Reutiliza el SVG del lienzo |
| T-14 | **Inicializar git** en la carpeta, un commit por hito | Revisás el avance en partes |

**Y una pregunta concreta:** ¿querés que lo suba a un repositorio remoto? Si es así, ¿cuál (GitHub,
GitLab…), con qué nombre y público o privado?

**Respuesta:** Apruebo todo. Remoto: ninguno por ahora, solo git local. *(ronda 3, en la conversación)*

---

### 🟡 Q3.3 — Soltar un componente con sus dos terminales sobre el mismo tramo recto

**Contexto.** Es probablemente la forma más natural de trabajar para un electricista: tirar la línea
primero y después "meter" el interruptor en ella. Con las reglas actuales, pasa esto:

```text
Antes:        L ─────────────────────── (H1)

Soltar S1 encima, con A1 y A2 sobre la línea:

(a) Insertar en serie:   L ─────[S1]───── (H1)     ← el tramo bajo el símbolo se elimina
(b) Literal (hoy):       L ──●──[S1]──●── (H1)     ← S1 queda puenteado por el cable
                             └────────┘               y no puede cortar nada
(c) Posición inválida
```

**Opciones**
- **a)** **Insertar en serie**: si los dos terminales de un componente de dos terminales caen sobre el
  mismo tramo recto, se elimina exactamente el pedazo entre ellos.
- **b)** Aplicar la regla literal: ambos terminales se conectan y el componente queda puenteado (con
  un aviso `COMPONENTE_PUENTEADO` en diagnósticos).
- **c)** Considerarlo una posición inválida.

**Recomendación: (a).** Es lo que el usuario quiere decir con ese gesto casi siempre, y (b) produce un
circuito que "funciona mal" sin que se note a simple vista. Aplicaría solo al colocar, mover o pegar
componentes con **ambos terminales libres**, y solo cuando caen sobre **el mismo** tramo recto. Los
demás casos de puenteo quedan como aviso.

**Respuesta:** **(a)** Insertar en serie. *(ronda 3, en la conversación)*

---

### 🟡 Q3.4 — Contactos temporizados: símbolos y vínculos

**Contexto.** En IEC, un contacto temporizado muestra en su símbolo hacia dónde actúa el retardo. Con
TON y TOF hay cuatro variantes:

| | NO | NC |
|---|---|---|
| **TON** | cierre retardado | apertura retardada |
| **TOF** | apertura retardada | cierre retardado |

**Sub-pregunta 1 — ¿Cómo aparecen en la biblioteca?**
- **a)** Dos elementos genéricos, **"Contacto temporizado NO"** y **"Contacto temporizado NC"**. El
  símbolo se dibuja solo según el tipo del timer al que se vincula (TON o TOF). No hay forma de
  equivocarse.
- **b)** Cuatro elementos distintos. Vincular, por ejemplo, un contacto de TON a un timer TOF es un
  diagnóstico bloqueante.

**Recomendación: (a).** Menos elementos en la biblioteca, imposible de combinar mal, y si cambiás un
timer de TON a TOF, sus contactos se actualizan solos. Mientras no está vinculado, se dibuja con un
símbolo neutro y aparece el diagnóstico `REF_ROTA`.

**Sub-pregunta 2 — ¿Un contacto común (instantáneo) puede vincularse a un timer?** Algunos relés
temporizados reales tienen también contactos instantáneos.
- **Recomendación: no en V1.** Contacto común → solo a bobinas. Contacto temporizado → solo a timers.
  Un vínculo al tipo equivocado es bloqueante (`REF_TIPO`). Mantiene el diagrama sin ambigüedad; se
  puede ampliar después.

**Respuesta:** Sub-pregunta 1: **(a)** dos genéricos. Sub-pregunta 2: **no** en V1. *(ronda 3, en la conversación)*

---

### 🟡 Q3.5 — Rotar en el lugar produce una posición inválida

**Contexto.** Con un componente **seleccionado** (no tomado) apretás `R`. Al rotar, sus terminales
cambian de lugar y la reparación de sus cables puede producir un solapamiento con otra red.

**Opciones**
- **a)** Se rechaza la rotación y la barra de estado explica el motivo ("La rotación superpone un cable
  con otra red. Usá Mover (M) y rotalo con R mientras lo reubicás").
- **b)** El componente pasa automáticamente a estado "tomado", ya rotado, para que lo ubiques en un
  lugar válido (o `Esc` para dejarlo como estaba).
- **c)** Se rota igual y el problema queda en diagnósticos.

**Recomendación: (a).** Es predecible y coherente con "una posición inválida no se confirma". La (b) es
cómoda pero sorpresiva: una tecla que normalmente rota, a veces además te "levanta" el componente. La
(c) contradice tu decisión de impedir los solapamientos.

**Respuesta:** **(a)** Rechazar con motivo. *(ronda 3, en la conversación)*

---

### 🟡 Q3.6 — Goma: orden de prioridad entre lo que no es vértice

**Contexto.** Definiste que los vértices visibles (●, esquina, ○) ganan. Falta definir el resto,
porque un cable puede pasar por encima de un símbolo o de un texto.

**Propuesta de orden completo:**

1. Junction ●
2. Extremo libre ○
3. Esquina
4. **Segmento**
5. **Texto**
6. **Componente**

**Consecuencia:** si un cable pasa por encima de un símbolo, un clic justo sobre el cable borra el
cable; para borrar el componente, se hace clic en una parte del símbolo sin cable.

**Caso particular — un terminal con un solo cable** (sin ●). Ahí el extremo del segmento y el terminal
del componente coinciden. **Recomendación: gana el componente**, porque el terminal se dibuja como
parte del símbolo y el cable se puede clicar en cualquier otro punto de su largo.

**Recomendación general:** el orden de arriba, con la excepción del terminal a favor del componente.

**Respuesta:** Orden propuesto (segmento > texto > componente), con la excepción del terminal a favor del componente. *(ronda 3, en la conversación)*

---

### 🟡 Q3.7 — Exportación: ¿qué exactamente?

Pediste "el diagrama tal como se ve", sin metadatos. Quedan cuatro detalles:

1. **¿Qué parte?**
   **Recomendación:** el diagrama completo (todo lo dibujado, con un margen), no solo lo que entra en
   pantalla. Exportar solo lo visible suele cortar partes sin que el usuario lo note.
2. **Si exportás durante la simulación o en modo ERROR, ¿con los colores del estado?**
   **Recomendación: sí.** "Tal como se ve" — y sirve para documentar dónde ocurrió un corto. En modo
   edición, colores neutros.
3. **¿Qué se excluye?**
   **Recomendación:** nunca se exportan el grid, la selección, los resaltados de hover ni la vista
   previa.
4. **Formatos y página.**
   **Recomendación:** PNG, PDF y, ya que es gratis con SVG, también SVG. Para el PDF, un selector
   **A4 / A3 / ajustado al diagrama**, con orientación automática y escala para que entre.

**Respuesta:** Diagrama completo · colores tal como se ven · formatos **PNG, PDF y SVG**. *(ronda 3, en la conversación)*

---

### 🟡 Q3.8 — El estado inicial de un interruptor, ¿se guarda en el archivo? *(antes Q18)*

**Contexto.** La ronda 2 dejó esto explícitamente abierto. Cerrás `S1` durante la simulación, parás y
guardás. Al abrir el archivo, ¿cómo está `S1`?

**Propuesta:**
- `estadoInicial` es una **propiedad del documento**, editable en modo edición y guardada en el archivo.
- Lo que hagas **durante** la simulación no la modifica: al detener, todo vuelve al estado inicial.

Separa "cómo arranca el circuito" (dato) de "qué hice mientras corría" (que el §14.3 del spec dice no
guardar), y hace que cada corrida sea reproducible desde el mismo punto de partida (§17 del spec).
Aplicaría también a la posición inicial del selector de 3 posiciones.

**Recomendación: aprobar la propuesta.**

**Respuesta:** Aprobada: `estadoInicial` como propiedad del documento. *(ronda 3, en la conversación)*

---

### 🟢 Q3.9 — ¿Dónde se va a publicar? *(antes Q26)*

No bloquea hasta el hito M18. El diseño funciona con cualquier proveedor que permita fijar cabeceras
por ruta (Netlify, Cloudflare Pages, Vercel, nginx propio), y tiene un respaldo para los que no
(GitHub Pages).

**Respuesta:** Todavía no se sabe — queda abierta. *(ronda 3, en la conversación)*

**Actualización:** producto agregó después que la app debe correr **dentro de un contenedor**
([RESPONSE_ROUND_3.md §11](RESPONSE_ROUND_3.md)). Con eso, el proveedor concreto deja de afectar el
diseño: queda como decisión operativa, sin impacto en el código.

---

## Parte 2 — Interpretaciones

Ya aplicadas en el plan. **Respondé solo si no estás de acuerdo.**

| # | Tema | Lo que asumí | Plan | Objeción |
|---|---|---|---|---|
| I1 | "Conductor distinto" (R2 §2) | Significa **de otra red**. Un terminal ya conectado que cae sobre un conductor de su **misma** red está permitido: eléctricamente no cambia nada | §5.5 | |
| I2 | Parada de emergencia | NC. Un clic la acciona y **enclava** (contacto abierto, hongo hundido); otro clic la libera. Inicial: liberada | §11 | |
| I3 | Selector de 3 posiciones | I – 0 – II, mantenido, un común y dos salidas. Tres zonas clicables en el símbolo durante la simulación. Inicial: 0. Refinable | §11 | |
| I4 | Texto libre | Sin rotación, tamaño fijo, editable en el panel o con doble clic. No es eléctrico | §4.1, §11 | |
| I5 | Referencias al pegar | `K1` → `K2`. Bobina y sus contactos juntos → `K2`, `K2.1`, `K2.2`. Un contacto solo → nuevo número (`K1.3`) **vinculado a la misma bobina** | §12 | |
| I6 | Pegado | Lo pegado aparece "tomado" y se coloca con un clic, con las mismas reglas que Mover; sus terminales y extremos libres que caen sobre un conductor se conectan | §12 | |
| I7 | Mapa de teclas | `S` Seleccionar · `C` Cable · `T` Texto · `E` Ejecutar/detener simulación · `A` Ajustar vista · `Ctrl+D` Duplicar · `Supr` borrar selección · `Espacio`+arrastrar desplazar | §6.4 | |
| I8 | Gestos de la herramienta Cable | Clics fijan codos; clic sobre conductor termina y conecta; `Enter` o doble clic termina con extremo libre; `Retroceso` deshace el último tramo; `Esc` descarta el trazado | §6.3 | |
| I9 | Mover con selección | Clic sobre algo seleccionado toma toda la selección; si no, solo ese objeto. La herramienta sigue activa tras colocar | §6.2 | |
| I10 | Mover y vértices | Clic con Mover sobre un junction, esquina o extremo libre no toma nada. Para reconectar un extremo libre se traza un cable desde él | §6.2 | |
| I11 | Mover un segmento | Esquinas y extremos libres se desplazan con él; junctions y terminales quedan anclados y se agrega un tramo nuevo. Un grupo de segmentos se mueve en 2D | §5.3 | |
| I12 | `Ctrl+Z` con algo tomado | Equivale a `Esc`: suelta sin cambios, no toca el historial | §6.2 | |
| I13 | Seleccionar y arrastre | Arrastrar desde un espacio vacío dibuja el rectángulo; arrastrar desde un objeto no lo mueve | §6.1 | |
| I14 | Terminal sobre terminal | Se dibuja con punto ●. La goma sobre ese punto borra **los dos** componentes (es la regla del junction aplicada literalmente, y la única coherente) | §4.2, §7 | |
| I15 | Preset de temporizadores | En segundos con coma decimal, mínimo 0,1 s, máximo 3600 s, resolución 0,01 s | §10.4 | |
| I16 | Autoguardado | Al abrir, se restaura solo, con un aviso y la opción "Empezar uno nuevo" | §14.3 | |
| I17 | Grid y zoom | 10 px al 100 %, zoom de 25 % a 400 %, como defaults ajustables (R2 §21 lo permite) | T-11 | |
| I18 | Avisos no bloqueantes | `REF_REPETIDA` (dos `H1`), `COMPONENTE_PUENTEADO` (incluye L y N unidos por cable: la simulación arranca y entra en ERROR para mostrar el corto), `SIN_CONTACTOS` | §8 | |

---

## Lo mínimo para arrancar

| | Pregunta | Recomendación en una línea |
|---|---|---|
| 🔴 | **Q3.1** contactos ambiguos | Los tres casos inválidos y bloqueantes, como el solapamiento |
| 🔴 | **Q3.2** stack técnico + remoto git | Aprobar la tabla; decime si hay remoto |

Con esas dos arranco M0–M4 (andamiaje y todo el núcleo topológico sin UI). Las 🟡 se necesitan recién
a partir de M6.

---

## Bitácora

| Fecha | Cambio |
|---|---|
| 2026-09-21 | Ronda 3: 9 preguntas (6 nuevas, 1 consolidada de stack, 2 heredadas) + 18 interpretaciones |
