# Respuesta de producto — Ronda 3

> Respondida en la conversación mediante cuestionario el 2026-09-21, sobre el cuestionario de la ronda 3
> (archivo `QUESTIONS3.md`, retirado del repo; queda en el historial de git).
> Registrada por el equipo técnico con las respuestas elegidas, sin agregados.
> Donde contradiga rondas anteriores, **esta ronda prevalece**.

---

## 1. Contactos geométricos ambiguos — Q3.1

**Los tres casos son inválidos**, con el mismo tratamiento que el solapamiento colineal entre redes:

- (a) T sin punto: un punto de conexión de una red apoyado en el interior de un segmento de otra;
- (b) puntos de conexión de redes distintas en la misma posición;
- (c) un cable que pasa justo por un terminal ajeno.

No se pueden crear al editar. Si llegan por importación o por un bug, son diagnóstico **bloqueante**.
El cruce perpendicular sigue siendo válido.

## 2. Stack técnico — Q3.2

**Se aprueba la propuesta completa:** SVG · React + TypeScript + Vite · Zustand · deshacer con copias
inmutables del documento · Vitest + Playwright (E2E en Chromium y Firefox) · Node 20 + pnpm · guardar
con descarga + File System Access API en Chromium · jsPDF + svg2pdf para PDF · git local con un commit
por hito.

**Repositorio remoto:** ninguno por ahora. Solo git local.

## 3. Componente soltado sobre un tramo recto — Q3.3

**Se inserta en serie.** Si los dos terminales de un componente caen sobre el mismo tramo recto, se
elimina exactamente el pedazo entre ellos. Aplica solo cuando ambos terminales están libres.

## 4. Contactos temporizados — Q3.4

- **Biblioteca:** dos elementos genéricos, "Contacto temporizado NO" y "Contacto temporizado NC". El
  símbolo se dibuja según el tipo del timer vinculado (TON o TOF).
- **Vínculos:** un contacto común solo se vincula a bobinas; un contacto temporizado, solo a timers. Un
  vínculo al tipo equivocado es bloqueante.

## 5. Rotación en el lugar inválida — Q3.5

**Se rechaza** y se explica el motivo, sugiriendo usar Mover y rotar mientras se reubica.

## 6. Prioridad de la goma — Q3.6

Orden: junction ● → extremo libre ○ → esquina → **segmento → texto → componente**.
Excepción: en un terminal con un solo cable (sin ●), gana el componente.

## 7. Exportación — Q3.7

- **Alcance:** el diagrama completo, con margen, aunque no entre en pantalla.
- **Colores:** tal como se ve. Durante la simulación o en ERROR se exportan los colores del estado
  eléctrico. Nunca se exportan el grid, la selección ni la vista previa.
- **Formatos:** **PNG, PDF y SVG.**

## 8. Estado inicial de controles manuales — Q3.8

`estadoInicial` es una **propiedad del documento**, editable en modo edición y guardada en el archivo.
Lo que se haga durante la simulación no la modifica: al detener, todo vuelve al estado inicial. Aplica
también a la posición inicial del selector de 3 posiciones.

## 9. Despliegue — Q3.9

**Sigue abierto.** No bloquea hasta el hito M18.

## 10. Interpretaciones I1–I18

**Se aceptan todas.** Son reglas que el equipo propuso por delegación o por inferencia; se citan en el
plan con la etiqueta **[Interpretación]**.

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
| I10 | Mover y vértices | Clic con Mover sobre un junction, esquina o extremo libre no toma nada. Para reconectar un extremo libre se traza un cable desde él | §6.2 |
| I11 | Mover un segmento | Esquinas y extremos libres se desplazan con él; junctions y terminales quedan anclados y se agrega un tramo nuevo. Un grupo de segmentos se mueve en 2D | §5.3 |
| I12 | `Ctrl+Z` con algo tomado | Equivale a `Esc`: suelta sin cambios, no toca el historial | §6.2 |
| I13 | Seleccionar y arrastre | Arrastrar desde un espacio vacío dibuja el rectángulo; arrastrar desde un objeto no lo mueve | §6.1 |
| I14 | Terminal sobre terminal | Se dibuja con punto ●. La goma sobre ese punto borra **los dos** componentes (es la regla del junction aplicada literalmente, y la única coherente) | §4.2, §7 |
| I15 | Preset de temporizadores | En segundos con coma decimal, mínimo 0,1 s, máximo 3600 s, resolución 0,01 s | §10.4 |
| I16 | Autoguardado | Al abrir, se restaura solo, con un aviso y la opción "Empezar uno nuevo" | §14.3 |
| I17 | Grid y zoom | 10 px al 100 %, zoom de 25 % a 400 %, como defaults ajustables (R2 §21 lo permite) | T-11 |
| I18 | Avisos no bloqueantes | `REF_REPETIDA` (dos `H1`), `COMPONENTE_PUENTEADO` (incluye L y N unidos por cable: la simulación arranca y entra en ERROR para mostrar el corto), `SIN_CONTACTOS` (en el código: `REF_REPEATED`, `BYPASSED`, `NO_CONTACTS`) | §8 |

---

## 11. Agregado posterior — Contenedor

> Indicado en la conversación después de cerrar el cuestionario, el 2026-09-21.

**La aplicación debe correr dentro de un contenedor**, para que desplegarla sea fácil.

Consecuencia sobre Q3.9: el proveedor concreto deja de afectar el diseño. La imagen corre en cualquier
host de contenedores, y elegir cuál es una decisión operativa que puede tomarse más adelante.
