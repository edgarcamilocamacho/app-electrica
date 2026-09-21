# Respuesta de producto — Ronda 3

> Respondida en la conversación mediante cuestionario el 2026-09-21, sobre [QUESTIONS3.md](QUESTIONS3.md).
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

**Se aceptan todas** tal como están en QUESTIONS3.md y en el plan.

---

## 11. Agregado posterior — Contenedor

> Indicado en la conversación después de cerrar el cuestionario, el 2026-09-21.

**La aplicación debe correr dentro de un contenedor**, para que desplegarla sea fácil.

Consecuencia sobre Q3.9: el proveedor concreto deja de afectar el diseño. La imagen corre en cualquier
host de contenedores, y elegir cuál es una decisión operativa que puede tomarse más adelante.
