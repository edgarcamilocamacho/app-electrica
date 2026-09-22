# Atajos de teclado

Confirmados por producto ([DECISIONES.md](DECISIONES.md), R2 §31): **B, M, R, Esc, Ctrl+Z, Ctrl+Y, Ctrl+C, Ctrl+V**;
flechas y `Enter` con Mover (R4 §3). El resto es propuesta técnica aceptada en la ronda 3 (I7).
Cada botón de herramienta muestra su tecla al lado del ícono. En macOS, **Cmd** reemplaza a **Ctrl**.
Los atajos no actúan mientras el foco está en un campo de texto.

## Herramientas

| Tecla | Acción |
|---|---|
| `S` | Seleccionar |
| `C` | Cable |
| `M` | Mover (clic toma, clic suelta) — también se puede arrastrar con Seleccionar |
| `B` | Borrar (goma: un objeto por clic) |
| `T` | Texto libre |
| `Esc` | Cancelar lo que esté en curso; con nada en curso, volver a Seleccionar |

## Edición

| Tecla | Acción |
|---|---|
| `R` | Rotar 90°: el componente a colocar, el tomado con Mover o el único seleccionado |
| `Supr` · `Retroceso` | Borrar la selección (una sola acción de deshacer) |
| `Ctrl+Z` | Deshacer |
| `Ctrl+Y` · `Ctrl+Mayús+Z` | Rehacer |
| `Ctrl+C` / `Ctrl+V` | Copiar / pegar (lo pegado queda tomado: clic para soltar) |
| `Ctrl+D` | Duplicar la selección |
| `Ctrl+A` | Seleccionar todo |

## Mover y arrastrar

| Tecla / gesto | Acción |
|---|---|
| Arrastrar un objeto (Seleccionar) | Lo mueve; si estaba seleccionado, mueve toda la selección. Un tramo solo se desplaza en perpendicular |
| Soltar el arrastre | Coloca; en una posición inválida, vuelve a su lugar |
| `Mayús` mientras se arrastra o se lleva algo | Limita el movimiento al eje dominante (horizontal o vertical) |
| Flechas (con Mover) | Desplazan lo tomado una casilla; con nada tomado, toman la selección |
| `Mayús` + flechas | Cinco casillas |
| `Enter` (con Mover) | Suelta lo tomado |
| `R` | Rota lo que se lleva (un solo componente) |
| `Esc` | Cancela: todo vuelve a su lugar |

## Herramienta Cable

| Tecla / gesto | Acción |
|---|---|
| Clic en el vacío | Fija un codo |
| Clic sobre un cable, terminal o vértice | Termina y conecta (en el medio de un cable crea un punto de unión) |
| `Enter` · doble clic | Termina con extremo libre |
| `Retroceso` | Deshace el último tramo del trazado en curso |
| `Esc` | Descarta el trazado en curso |

## Archivo y vista

| Tecla | Acción |
|---|---|
| `Ctrl+S` | Guardar (en Chromium, sobre el mismo archivo) |
| `Ctrl+Mayús+S` | Guardar como… |
| `Ctrl+O` | Abrir |
| `A` | Ajustar la vista al diagrama |
| `Ctrl+0` | Zoom 100 % |
| `+` / `-` | Acercar / alejar |
| Rueda | Zoom hacia el cursor |
| `Espacio` + arrastrar · botón central | Desplazar la vista |

## Simulación

| Tecla / gesto | Acción |
|---|---|
| `E` | Ejecutar / detener la simulación (en ERROR no sale: hay que usar «Volver a editar») |
| Mantener apretado un pulsador | Accionado mientras se mantiene |
| Clic en un interruptor o parada de emergencia | Alterna (la parada de emergencia enclava) |
| Clic en un selector | Izquierda: I · centro: 0 · derecha: II |
