# Atajos de teclado

Confirmados por producto ([DECISIONES.md](DECISIONES.md), R2 §31): **B, M, Esc, Ctrl+Z, Ctrl+Y,
Ctrl+C, Ctrl+V**. El resto es propuesta técnica aceptada en la ronda 3 (I7). Cada botón de
herramienta muestra su tecla al lado del nombre. En macOS, **Cmd** reemplaza a **Ctrl**. Los atajos
no actúan mientras el foco está en un campo de texto.

## Herramientas

| Tecla | Acción |
|---|---|
| `S` | Seleccionar |
| `C` | Cable |
| `B` | Borrar (goma: un objeto por clic) |
| `T` | Texto libre |
| `Esc` | Cancelar lo que esté en curso (colocar, cablear, arrastrar) |

## Edición

| Tecla / gesto | Acción |
|---|---|
| Clic en la biblioteca + clic en el lienzo | Coloca un aparato |
| Arrastrar un aparato | Lo mueve con sus cables; soltarlo en una posición inválida lo devuelve |
| Arrastrar un tramo de cable | Lo desplaza en perpendicular; los vecinos se estiran |
| Flechas | Desplazan la selección una casilla |
| `R` | Gira 90° lo seleccionado; con un aparato en la mano, lo gira antes de colocarlo |
| `Supr` · `Retroceso` | Borra la selección (una sola acción de deshacer) |
| `Ctrl+Z` | Deshacer |
| `Ctrl+Y` | Rehacer |

## Simulación

| Gesto | Acción |
|---|---|
| Clic en un pulsador | Lo mantiene apretado mientras el botón esté abajo |
| Clic en un interruptor o en la parada de emergencia | Alterna su estado |
| Clic en el selector de 3 posiciones | Lo pasa a la siguiente posición (I → 0 → II → I) |

## Herramienta Cable

| Gesto | Acción |
|---|---|
| Clic en un tornillo | Empieza el cable |
| Clic en el vacío | Fija un codo |
| Clic en otro tornillo | Termina y conecta. No se puede terminar en el aire [R5 §4] |
| `Esc` | Descarta el trazado en curso |

El color y el calibre del cable se eligen en el panel derecho; con cables seleccionados, se les
aplica a ellos.

## Archivo y vista

| Tecla / gesto | Acción |
|---|---|
| `A` | Ajustar la vista al diagrama |
| Rueda | Zoom hacia el cursor |
| `Mayús` + arrastrar · botón central | Desplazar la vista |

Nuevo, Abrir, Guardar y las exportaciones a PNG y PDF están en la barra superior.

## Simulación

| Tecla / gesto | Acción |
|---|---|
| `E` | Ejecutar / detener la simulación (en ERROR no sale: hay que usar «Volver a editar») |
| Mantener apretado un pulsador | Accionado mientras se mantiene |
| Clic en un taco, interruptor o parada de emergencia | Alterna (la parada de emergencia enclava) |
| Botones 0,25× · 1× · 4× | Velocidad de la simulación |
