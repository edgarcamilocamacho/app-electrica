# Respuesta de producto — Ronda 2

Este documento reúne las decisiones tomadas después de revisar `PLAN(1).md` y `QUESTIONS2.md`.

Debe usarse para actualizar el plan antes de continuar con la implementación. Donde este documento contradiga decisiones anteriores, **esta ronda prevalece**.

---

## 1. Cambio principal: temporizadores de V1

### Q1 y Q2 — RTO

**Se elimina el RTO de V1.**

La V1 tendrá únicamente:

- **TON** — retardo a la conexión.
- **TOF** — retardo a la desconexión.

Por lo tanto:

- Q1, sobre cómo resetear un RTO, deja de aplicar.
- Q2, sobre si la salida del RTO queda enclavada, deja de aplicar.
- Deben eliminarse del plan el runtime, símbolos, contactos, propiedades y casos de prueba específicos de RTO.
- Cualquier texto que diga que `TP` fue reemplazado por `RTO` debe actualizarse para dejar simplemente **TON + TOF**.

Los temporizadores deben tener su `preset` como propiedad numérica editable en el panel de propiedades.

Durante la simulación debe ser posible inspeccionar **el valor/tiempo actual del temporizador mientras está corriendo**.

---

## 2. Movimiento de componentes

### Q3 — Conexión al mover

Se acepta que un terminal libre pueda conectarse automáticamente al soltar un componente sobre un segmento o terminal compatible, pero con reglas adicionales.

### Mecánica de movimiento

Los componentes **no se mueven arrastrando**.

La interacción debe ser:

1. Activar la herramienta **Mover**.
2. Hacer clic sobre el componente.
3. El componente queda “tomado” y sigue al cursor.
4. Hacer otro clic para intentar colocarlo.

La tecla de la herramienta será:

- **M = Mover**

Durante el movimiento puede mostrarse una vista previa de la posición y de si la colocación es válida o inválida.

### Reglas al colocar después de mover

- Si un terminal está **libre**, puede caer exactamente sobre un segmento, un extremo libre o un terminal compatible y crear la conexión.
- El cuerpo del símbolo puede cruzar cables sin producir conexión.
- Si un terminal **ya está conectado**, no se debe permitir colocar el componente de modo que ese mismo terminal toque un conductor distinto y cree una segunda conexión accidental.
- Si **un solo terminal** del componente queda en una posición inválida, **se rechaza la colocación completa**.
- En una posición inválida, el segundo clic no confirma el movimiento y el componente continúa tomado hasta que el usuario elija una posición válida o cancele.

La conectividad previa debe preservarse durante el movimiento, con reparación ortogonal de los segmentos conectados.

---

## 3. Movimiento y refinamiento manual de segmentos

### Q4 — Mecánica

Se conserva la idea de mover un segmento **perpendicularmente a sí mismo**, pero la interacción debe seguir la misma filosofía que el movimiento de componentes:

1. Activar Mover.
2. Clic sobre el segmento.
3. El segmento queda tomado y sigue al cursor únicamente sobre su eje de movimiento permitido.
4. Segundo clic para colocarlo.

No se requiere arrastre sostenido con el mouse.

Al mover un segmento:

- un segmento horizontal se desplaza verticalmente;
- un segmento vertical se desplaza horizontalmente;
- los segmentos vecinos se estiran, acortan o generan codos adicionales según sea necesario;
- siempre se conserva geometría ortogonal;
- la conectividad eléctrica no debe cambiar como consecuencia de una operación puramente geométrica;
- la canonicalización sigue aplicando después de la operación.

Los ajustes manuales pueden ser reparados localmente posteriormente al mover componentes conectados. No se requiere, por ahora, marcar segmentos como “fijados”.

---

## 4. Cables terminados en el vacío

### Q5

**Sí se permite crear deliberadamente un cable con extremo libre.**

Un extremo libre:

- puede crearse durante el dibujo;
- se representa visualmente como un extremo libre;
- no produce error;
- no produce cortocircuito;
- no impide simular;
- no altera la simulación salvo por terminar la conectividad en ese punto;
- puede conectarse posteriormente a un componente, terminal, cable u otro punto válido.

---

## 5. Herramienta de borrado

### Q6 — Comportamiento

La herramienta de borrado sigue activa y cada borrado ocurre mediante **un clic explícito**.

No existe borrado continuo manteniendo presionado el botón.

La tecla será:

- **B = Borrar**

Toda la interfaz y los atajos deben estar pensados inicialmente en **español**, por lo que se descarta usar `E` para esta herramienta.

### Prioridad de selección al borrar

Los **vértices visibles** tienen prioridad sobre segmentos u objetos que estén geométricamente cerca.

#### Clic sobre un junction

Si se hace clic sobre un junction:

- se eliminan **todos los segmentos incidentes** al junction;
- si existe un componente cuyo terminal está conectado directamente a ese mismo punto, ese componente también se elimina;
- toda esta operación constituye **una sola transacción de historial**.

Ejemplo conceptual:

```text
      segmento
         |
segmento ● [COMP]
```

Clic sobre `●` elimina las tres conexiones/elementos asociados a ese punto según corresponda.

#### Clic sobre una esquina

Si se hace clic directamente sobre una esquina de 90°:

```text
──────┐
      │
```

se eliminan **los dos segmentos completos** que forman esa esquina.

Esto es diferente de hacer clic directamente sobre uno de los segmentos.

#### Clic sobre un extremo libre

Un extremo libre no tiene “pedacitos” internos.

Al borrarlo, se elimina **el segmento completo hasta el siguiente vértice, esquina, junction o terminal**.

#### Clic sobre un segmento

Si el clic corresponde claramente al segmento y no a un vértice con prioridad, se elimina únicamente ese segmento.

### Undo

Cada clic de la herramienta Borrar continúa siendo una acción independiente de historial.

Si se borran cuatro objetos mediante cuatro clics:

- un `Ctrl+Z` restaura solamente el cuarto;
- otro `Ctrl+Z` restaura el tercero;
- etc.

En cambio, una acción única que por definición borra varias cosas —por ejemplo borrar un junction junto con todo lo incidente— se deshace completa con un solo `Ctrl+Z`.

---

## 6. Segmentos de redes distintas superpuestos

### Q7

La propuesta de solamente mostrar una advertencia **no es suficiente**.

La regla deseada es:

1. El editor debe intentar **impedir** que el usuario cree o mueva segmentos de redes distintas hasta quedar exactamente superpuestos de forma colineal.
2. La operación de creación o movimiento debe considerarse inválida en esa posición.
3. Si por cualquier caso borde, importación, bug o documento antiguo el estado llega a existir:
   - debe aparecer en diagnósticos;
   - debe ser un **error bloqueante**;
   - **no se permite iniciar la simulación** hasta corregirlo.

Un cruce perpendicular sigue siendo válido y no conecta por geometría.

---

## 7. Segmentos colineales solapados de la misma red

### Q8

Si dos segmentos de **la misma red** quedan colineales y se solapan, deben **normalizarse/fusionarse automáticamente**.

No se desea conservar geometría redundante de la misma net.

La canonicalización debe producir una representación limpia, conservando vértices únicamente donde sean significativos eléctricamente o geométricamente.

---

## 8. Terminal sobre terminal

### Q9

**Sí se permite conectar directamente dos terminales que quedan exactamente en la misma posición.**

No es obligatorio dibujar un segmento visible entre ellos.

El modelo interno debe representar que pertenecen al mismo nodo eléctrico, aunque visualmente no exista un tramo de cable con longitud apreciable.

---

## 9. Fase y neutro de fuentes diferentes a través de una carga

### Q10

Caso:

```text
L_A ─── [ CARGA ] ─── N_B
```

con los neutros de A y B **sin estar unidos**.

Resultado:

- **la carga no enciende**;
- no se considera, por ese solo hecho, un cortocircuito;
- no es necesario convertirlo en error bloqueante.

Para energizar una carga, la fase y el retorno deben ser coherentes con la misma referencia de alimentación, teniendo en cuenta las uniones explícitas de neutros que existan en el circuito.

---

## 10. Referencias de bobinas/contactos

### Q11

Se endurece la recomendación inicial.

Ambos casos deben **bloquear el inicio de la simulación**:

1. un contacto referencia una bobina que no existe;
2. existen dos bobinas con la misma referencia y la relación es ambigua.

No se debe asumir silenciosamente que una referencia rota equivale a bobina OFF.

El diagnóstico debe indicar claramente qué referencia debe corregirse.

---

## 11. Fuentes trifásicas

### Q12

V1 seguirá siendo **monofásica L/N**.

Sin embargo, el modelo interno debe quedar preparado desde el inicio para soportar varias fases en una futura versión.

Es aceptable representar la identidad de fase conceptualmente como:

```text
(sourceId, phaseIndex)
```

aunque en V1 `phaseIndex` solo tenga un valor.

La intención es que agregar L1/L2/L3 en el futuro no implique rediseñar el solver.

---

## 12. Catálogo V1

### Q13

Se acepta el catálogo mínimo propuesto más:

- parada de emergencia;
- selector de 3 posiciones;
- texto libre/anotaciones.

El selector de 3 posiciones puede comenzar con una semántica razonable elegida por el equipo/agente y documentada claramente. Se podrá refinar posteriormente al probar la interacción.

No hace falta incorporar todavía todos los demás candidatos de componentes.

---

## 13. Copiar, pegar y duplicar

### Q14

**Sí se incluye en V1.**

Debe existir soporte para:

- `Ctrl+C`
- `Ctrl+V`
- `Ctrl+D` si el mapa final de teclas lo considera adecuado.

Al copiar:

- se regeneran IDs;
- las referencias deben evitar colisiones;
- una selección compuesta por múltiples elementos se duplica como una operación coherente.

Si el usuario copia una selección que incluye componentes y segmentos, la implementación debe preservar correctamente la topología interna de aquello que efectivamente forme parte de la selección.

---

## 14. Texto, marco y exportación

### Q15 y ampliación de alcance

Se mantiene **texto libre en V1**.

El marco de título puede permanecer para una versión posterior.

### Cambio respecto de la propuesta anterior

**Exportar a PDF e imagen sí debe entrar en V1.**

El exportado debe representar **el diagrama tal como se ve**.

No es necesario agregar automáticamente:

- autor;
- fecha;
- versión;
- bloque adicional de metadatos.

La salida visual debe ser suficiente.

---

## 15. Velocidad de simulación

### Q16

Se acepta:

- tiempo normal **1×**;
- controles de velocidad, por ejemplo:
  - `0.25×`
  - `1×`
  - `4×`

Un temporizador de 5 segundos a 1× tarda 5 segundos reales.

Pausa y avance paso a paso no son requisito de V1.

---

## 16. Navegación durante la simulación

### Q17

Se acepta la propuesta.

Durante la simulación se puede:

- hacer pan;
- hacer zoom;
- seleccionar para inspeccionar;
- consultar propiedades en modo solo lectura;
- consultar estados eléctricos;
- observar el valor actual de los temporizadores.

No se puede:

- mover;
- borrar;
- rotar;
- cablear;
- cambiar propiedades estructurales.

---

## 17. Estado inicial de interruptores

### Q18

**Esta pregunta no quedó cerrada explícitamente en la conversación de esta ronda.**

No debe asumirse una respuesta nueva.

La propuesta del plan —`initialState` como dato del documento y los cambios hechos durante simulación como runtime no persistente— sigue siendo razonable, pero queda pendiente de confirmación final si el equipo considera que bloquea alguna implementación.

---

## 18. Panel de error

### Q19

Ya existen requisitos confirmados previamente:

- ante corto u oscilación toda la simulación se detiene;
- se entra a modo `ERROR`, no directamente a edición;
- el tiempo de simulación queda congelado;
- los temporizadores quedan congelados con su estado/valor del instante del error;
- los componentes o nodos implicados deben resaltarse;
- salir del error y volver a edición requiere una acción explícita.

Los detalles extra propuestos por el equipo —por ejemplo lista navegable, explicación textual de la secuencia de oscilación y caminos del corto— son deseables, pero no fueron revisados individualmente en esta ronda.

---

## 19. Stack técnico

### Q20, Q21 y Q22

Esta ronda **no tomó una decisión nueva explícita** sobre:

- React + TypeScript + Vite + Zustand;
- SVG vs Canvas;
- snapshots inmutables vs command/inverse para undo/redo.

Sin embargo, no apareció ninguna objeción a la arquitectura propuesta y los requisitos funcionales refuerzan varias de esas elecciones, especialmente:

- hit-testing de segmentos independientes;
- undo/redo exacto;
- pruebas automatizadas fuertes.

Si estas decisiones son bloqueantes para arrancar, el equipo puede mantener sus recomendaciones actuales en el siguiente plan, pero debe conservarlas identificadas como decisiones técnicas propuestas y no atribuirlas falsamente a una respuesta de producto que no se dio.

---

## 20. Entorno de desarrollo

### Q23

Node 20 / pnpm / repositorio no se discutieron explícitamente en esta ronda.

Puede mantenerse la recomendación técnica propuesta, pero no debe registrarse como una preferencia explícita del usuario.

---

## 21. Grid y canvas

### Q24

Requisitos confirmados:

- canvas visualmente **infinito**;
- snap a grid;
- símbolos y rutas ortogonales;
- rendimiento suficiente para diagramas normales de control.

El valor concreto de `10 px`, rango exacto de zoom `25%–400%` y demás números sugeridos no fueron confirmados explícitamente.

Pueden adoptarse como defaults razonables y ajustarse más adelante.

---

## 22. Pruebas

### Q25 y requisitos adicionales

Las pruebas son un requisito fuerte del producto.

En particular:

- las operaciones topológicas deben ser probables sin UI;
- mover componentes;
- mover segmentos;
- rotar;
- colocar;
- partir/fusionar nets;
- borrar;
- undo/redo;
- cortos;
- oscilaciones;
- temporizadores;
- conexiones automáticas;
- posiciones inválidas;
- exportación/importación;
- extremos libres;
- cruces sin conexión;
- solapamientos bloqueantes;
- copia/pegado;
- simulación completa.

### End-to-end

Las pruebas **end-to-end deben quedar listas desde V1**, no reducirse únicamente a unos pocos flujos críticos.

El equipo puede seguir usando Vitest + Playwright si considera que es el stack adecuado; lo importante es que la cobertura funcional acordada exista.

---

## 23. Despliegue

### Q26

No se escogió un proveedor concreto en esta ronda.

Requisito conocido:

- la app es client-side;
- un servidor sirve los assets iniciales;
- la lógica de simulación corre en el navegador;
- el cliente debe detectar cuando existe una versión nueva y evitar quedarse permanentemente con una versión vieja en caché.

La plataforma de hosting específica puede seguir pendiente.

---

## 24. Offline / Service Worker

### Q27

No hay un requisito explícito de funcionamiento offline para V1.

La prioridad sigue siendo un manejo robusto de versiones y caché.

Si no usar Service Worker simplifica y evita clientes atrapados en una versión antigua, esa estrategia es compatible con lo solicitado.

---

## 25. Navegadores y dispositivos

### Q28

Se considera suficiente para V1 priorizar navegadores modernos de escritorio.

Durante la conversación se aceptó trabajar principalmente con:

- Chrome;
- Edge;
- Firefox.

El soporte móvil no es prioritario para V1.

Puede dejarse como best-effort y revisarse después.

---

## 26. Idioma

### Q29

**Toda la interfaz de V1 debe estar en español.**

Además:

- los nombres de herramientas visibles deben estar en español;
- los atajos directos deben elegirse, cuando sea razonable, de acuerdo con los nombres en español;
- ejemplos ya decididos:
  - `B` = Borrar
  - `M` = Mover

La aplicación debe quedar estructurada desde el inicio para poder incorporar otros idiomas en el futuro sin reescribir componentes.

Es decir, todos los strings de UI deben centralizarse/prepararse para internacionalización.

---

## 27. Guardar y abrir

### Q30

Requisitos ya confirmados:

- guardar el circuito en un archivo;
- abrir/cargar un archivo;
- formato JSON legible y versionado.

Durante esta ronda se aceptó como suficiente ese esquema de importación/exportación para V1.

La elección concreta entre descarga clásica y File System Access API no quedó cerrada explícitamente.

Puede mantenerse:

- descarga/input de archivo como base universal;
- File System Access API como mejora progresiva cuando exista soporte.

---

## 28. Autoguardado

### Q31

**Sí se incluye en V1.**

Debe existir autoguardado local en el navegador, con recuperación después de una recarga/cierre accidental.

No reemplaza el archivo JSON manual.

---

## 29. Repositorio Git

### Q32

La pregunta real de `QUESTIONS2.md` sobre inicializar Git **no quedó respondida explícitamente en esta conversación**.

No debe confundirse con la conversación posterior sobre exportar el diagrama.

Puede mantenerse como decisión técnica pendiente o adoptar la recomendación del equipo si no bloquea producto.

---

# 30. Requisitos adicionales acordados durante esta ronda

Estos puntos aparecieron durante la conversación y deben incorporarse aunque no correspondan exactamente a una de las Qxx.

## 30.1 Selección múltiple y acciones masivas

Las acciones sobre una selección múltiple están permitidas en V1.

Por ejemplo, borrar múltiples objetos seleccionados.

Una operación masiva iniciada por el usuario cuenta como **una sola acción de historial** y debe poder deshacerse con un único `Ctrl+Z`.

Esto no contradice la goma:

- cuatro clics separados de goma = cuatro acciones;
- borrar una selección de cuatro objetos = una acción.

## 30.2 Diagnósticos bloqueantes

Debe existir una distinción entre:

- warnings;
- errores que bloquean simulación.

Casos confirmados como bloqueantes incluyen, entre otros:

- solapamiento exacto de segmentos de nets distintas;
- referencias rotas de contactos;
- referencias ambiguas/duplicadas de bobinas;
- otras inconsistencias estructurales que hagan ambiguo el circuito.

## 30.3 Canvas infinito

El lienzo debe sentirse infinito para el usuario.

La implementación interna puede usar cualquier técnica razonable siempre que pan/zoom y trabajo normal con diagramas de control se mantengan fluidos.

## 30.4 Demo / ejemplo incluido

V1 debe incluir al menos un circuito de ejemplo o demo que permita:

- abrirlo rápidamente;
- ejecutar la simulación;
- validar visualmente componentes, conexiones y cambios de estado.

## 30.5 Documentación interna

Debe existir documentación básica dentro del repositorio para:

- levantar el entorno;
- ejecutar la aplicación;
- correr las pruebas;
- entender la estructura general;
- conocer convenciones principales.

También puede existir un glosario sencillo si ayuda a mantener consistencia terminológica.

## 30.6 Privacidad y telemetría

Para V1:

- no hace falta telemetría de uso;
- no hace falta analítica;
- la aplicación es esencialmente local/client-side;
- no hay requisitos regulatorios especiales identificados por ahora.

## 30.7 Multiusuario

V1 es:

- monousuario;
- local en cuanto a estado de trabajo;
- sin colaboración en tiempo real.

No es necesario diseñar un sistema colaborativo desde el inicio.

## 30.8 Accesibilidad e internacionalización

La internacionalización debe quedar preparada desde el inicio.

La accesibilidad avanzada puede evolucionar posteriormente, pero la implementación no debe diseñarse deliberadamente de una forma que la haga imposible.

---

# 31. Mapa inicial de teclas

Por ahora se confirman:

| Acción | Tecla |
|---|---|
| Borrar / herramienta goma | `B` |
| Mover | `M` |
| Rotar elemento tomado o seleccionado | `R` |
| Cancelar herramienta/operación | `Esc` |
| Deshacer | `Ctrl+Z` |
| Rehacer | `Ctrl+Y` o equivalente estándar de plataforma |
| Copiar | `Ctrl+C` |
| Pegar | `Ctrl+V` |

El agente puede proponer el resto de teclas directas durante la implementación.

Condiciones:

- deben ser coherentes con una interfaz en español;
- no deben generar conflictos;
- deben documentarse;
- podrán refinarse después de probar la UX.

---

# 32. Instrucciones para la siguiente iteración

Antes de continuar con la implementación sustancial:

1. Actualizar `PLAN.md` con todas las decisiones de esta ronda.
2. Eliminar RTO y toda la arquitectura que dependa exclusivamente de él.
3. Mantener únicamente TON y TOF en V1.
4. Incorporar la interacción **clic → tomar → clic → colocar** para componentes y segmentos.
5. Añadir reglas explícitas de posición válida/inválida por terminal.
6. Actualizar la semántica de borrado de junctions, esquinas y extremos libres.
7. Hacer que los solapamientos de nets distintas sean prevenidos y, si existen, bloqueantes.
8. Normalizar/fusionar solapamientos colineales de la misma net.
9. Incorporar exportación a PDF e imagen en V1.
10. Incorporar copiar/pegar/duplicar en V1.
11. Incorporar autoguardado y un demo de ejemplo en V1.
12. Mantener toda la UI en español y preparar internacionalización.
13. Mantener pruebas exhaustivas, incluyendo E2E desde V1.
14. Generar una nueva ronda de preguntas únicamente para decisiones que realmente sigan abiertas.
15. No volver a preguntar decisiones ya cerradas salvo que aparezca una contradicción técnica concreta.

## Preguntas que siguen genuinamente abiertas tras esta ronda

Para evitar que se registren respuestas inventadas, estas decisiones no quedaron confirmadas explícitamente y pueden aparecer en la siguiente ronda si realmente bloquean:

- Q18: persistencia exacta de `initialState` de interruptores mantenidos.
- Q20: stack React + TypeScript + Vite + Zustand.
- Q21: SVG vs Canvas.
- Q22: snapshots inmutables como implementación de undo/redo.
- Q23: Node / pnpm / configuración exacta del repo.
- Q24: tamaño exacto del grid y rango de zoom.
- Q26: proveedor concreto de despliegue.
- Q30: uso exacto de File System Access API además de descarga/input.
- Q32: inicialización y remoto de Git.

El resto debe actualizarse conforme a las decisiones anteriores.
