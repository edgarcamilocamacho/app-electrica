# Respuesta de producto — Ronda de revisión 1

Este documento reúne las decisiones tomadas después de revisar `PLAN.md` y `QUESTIONS.md`.
Debe usarse para actualizar ambos documentos antes de continuar con la implementación.

## 1. Semántica eléctrica

### Cargas
Se acepta el modelo simplificado propuesto:

- Las cargas (`lámpara`, `bobina`, `timer`) **no conducen**.
- Solo sensan el potencial presente en sus dos terminales.
- Una carga se considera energizada cuando un terminal recibe fase y el otro neutro válido según las reglas del modelo.
- Dos cargas puestas en serie no tienen por qué funcionar en este modelo. Esto se acepta explícitamente para V1.

### Cortocircuitos
Se confirma:

- Conectar directamente `L` y `N` sin una carga en medio es un cortocircuito.
- Conectar fase de una fuente con neutro de otra fuente también se considera cortocircuito.
- Mezclar fases de distintas fuentes en el mismo nodo también es cortocircuito.
- Ante un corto, toda la simulación pasa a modo `ERROR`, se congela y no continúa ninguna rama del circuito.

## 2. Temporizadores

Para V1 se requieren tres tipos:

- `TON`
- `TOF`
- `RTO`

Esto reemplaza cualquier propuesta anterior de usar `TP` como tercer temporizador de V1.

Cada tipo debe ser un componente visual independiente en la biblioteca y usar su símbolo correspondiente.

## 3. Modelo de cables y segmentos

Esta sección modifica de manera importante el modelo de cable propuesto originalmente.

### Segmentos independientes
Un cable puede estar compuesto por varios segmentos ortogonales.

- Cada tramo horizontal o vertical es seleccionable de manera independiente.
- Cada tramo se puede borrar de manera independiente.
- Una esquina de 90° no convierte ambos lados en una sola unidad seleccionable: ambos lados siguen siendo segmentos separados.

Ejemplo:

```text
──────┐
      │
      │
```

El tramo horizontal y el tramo vertical son dos segmentos independientes a efectos de selección y borrado.

### Consecuencia eléctrica al borrar segmentos
Si un segmento era el único enlace eléctrico entre dos partes de una red y se elimina:

```text
A ─── segmento eliminado ─── B
```

la red anterior deja de ser un único nodo eléctrico y se convierte inmediatamente en dos redes eléctricas distintas.

La conectividad debe recalcularse a partir de la nueva topología.

Esto debe tener pruebas específicas.

### Fusión automática de segmentos colineales
Si dos segmentos consecutivos:

- están en la misma línea horizontal o vertical,
- tienen la misma dirección,
- y el punto intermedio no tiene ninguna función eléctrica o geométrica especial,

deben fusionarse automáticamente en un solo segmento.

Ejemplo:

```text
A ─── X ─── B
```

Si `X` no es junction, derivación, terminal, extremo libre u otro punto significativo:

```text
A ───────── B
```

debe quedar representado como un único segmento.

## 4. Inserción de conexiones sobre un segmento existente

Si una nueva conexión nace desde el medio de una línea existente, la línea original debe partirse.

Ejemplo:

Antes:

```text
────────────
```

Después de crear una derivación:

```text
──────●─────
      │
      │
```

La línea horizontal original pasa a ser dos segmentos y aparece un punto de unión explícito.

Esto ocurre si la derivación es creada por:

- un nuevo cable;
- un terminal de un componente;
- cualquier otra conexión eléctrica explícita.

## 5. Colocación de componentes directamente sobre cables

Si un componente se coloca de forma que uno de sus terminales coincide exactamente con un segmento existente:

- la conexión eléctrica se crea automáticamente;
- el segmento existente se divide en el punto de conexión;
- se crea la topología necesaria para representar el nuevo junction;
- no hace falta que el usuario trace manualmente un cable adicional.

Ejemplo conceptual:

```text
────────●────────
        │ pin
      [COMP]
```

El terminal forma parte del mismo nodo eléctrico.

## 6. Movimiento de componentes conectados

Mover un componente **no debe romper las conexiones existentes**.

Ejemplo inicial:

```text
────────●────────
        │
      [COMP]
```

Si el componente se mueve hacia abajo:

```text
────────●────────
        │
        │
        │
      [COMP]
```

el junction original permanece conectado al nodo superior y el editor crea automáticamente los segmentos ortogonales necesarios para alcanzar la nueva posición del terminal.

La misma regla se aplica si el componente se mueve lateralmente o en cualquier combinación de ejes.

El reroute:

- puede crear segmentos nuevos;
- puede eliminar segmentos innecesarios;
- debe conservar la conectividad eléctrica;
- solo usa ángulos rectos.

## 7. Cruces visuales

Se reafirma un requisito ya existente y debe mantenerse explícito en especificación, arquitectura y pruebas:

> La conectividad es explícita, nunca se deduce por geometría.

En particular:

- dos cables que se cruzan visualmente **no se conectan**;
- un cable que pasa por encima de otro cable no crea conexión;
- un cable que pasa por encima de un componente no se conecta a ese componente;
- un cable que pasa visualmente por encima de un terminal no se conecta a él;
- solo existe conexión si hay un junction, un endpoint compartido o una acción explícita que cree la unión.

Ejemplo sin conexión:

```text
────────────
      │
      │
```

El cruce por sí solo representa dos redes distintas.

Ejemplo con conexión:

```text
──────●─────
      │
      │
```

El punto indica unión eléctrica.

## 8. Router y obstáculos

Para V1 se acepta que un cable pueda pasar visualmente por encima de un componente.

No es obligatorio que el router evite símbolos o footprints.

Lo importante es:

- conservar la conectividad;
- mantener rutas ortogonales;
- evitar ambigüedad entre segmentos pertenecientes a redes diferentes cuando sea posible;
- recordar que superposición geométrica no implica conexión.

Por lo tanto, cualquier requisito anterior que obligue al router a evitar siempre los componentes debe relajarse.

## 9. Extremos libres

Se modifica la recomendación original que prohibía extremos sueltos.

Los extremos libres **sí están permitidos**.

### Cuándo aparecen
Por ejemplo:

- se borra un componente conectado;
- queda parte de su cableado;
- uno o varios segmentos terminan ahora sin terminal conectado.

### Representación
El modelo necesita soportar explícitamente un endpoint libre con posición propia.

Por ejemplo conceptualmente:

```ts
type Endpoint =
  | { kind: 'terminal'; componentId: Id; terminalId: string }
  | { kind: 'junction'; junctionId: Id }
  | { kind: 'free'; position: GridPoint };
```

La implementación exacta puede variar, pero el comportamiento debe existir.

### Comportamiento visual
El extremo libre debe distinguirse visualmente, por ejemplo mediante un pequeño círculo abierto.

### Simulación
Un extremo libre:

- no genera error;
- no genera advertencia obligatoria;
- no altera la simulación;
- simplemente termina la conducción en ese punto.

### Reconexión
Debe ser posible volver a conectar ese extremo posteriormente.

Por ejemplo:

- colocar un componente de forma que uno de sus terminales coincida con el extremo;
- trazar una nueva conexión desde él;
- conectarlo a otra red mediante una acción explícita.

## 10. Borrado de componentes

Se modifica la propuesta anterior de borrado en cascada.

Al borrar un componente:

- se elimina el componente;
- sus cables **no tienen que desaparecer**;
- los cables previamente conectados al componente pueden quedar como extremos libres.

Esto permite reemplazar un componente sin destruir el cableado que ya fue dibujado.

Todo cambio topológico resultante debe ser coherente con el sistema de segmentos y endpoints.

## 11. Borrado de cables y componentes

Existen dos maneras de borrar.

### Selección + tecla
El usuario puede:

1. seleccionar un componente o un segmento;
2. presionar `Delete` / `Supr`;
3. eliminarlo.

### Herramienta de borrado
Debe existir además una herramienta de borrado en la barra de herramientas.

Mientras esté activa:

- el cursor permanece en modo borrado;
- cada clic sobre un componente lo elimina;
- cada clic sobre un segmento lo elimina;
- no se borra simplemente por pasar el mouse por encima;
- no existe borrado continuo manteniendo el botón presionado;
- cada objeto se borra mediante un clic explícito.

No debe aparecer ningún diálogo de confirmación.

Undo es el mecanismo de recuperación.

## 12. Undo/redo y borrado

Cada clic de la herramienta de borrado es **una transacción de historial independiente**.

Ejemplo:

1. activar herramienta borrar;
2. clic sobre elemento A;
3. clic sobre elemento B;
4. clic sobre elemento C;
5. clic sobre elemento D.

Un único `Ctrl+Z` debe restaurar solamente `D`.

Otro `Ctrl+Z` restaura `C`, y así sucesivamente.

No se debe agrupar toda una sesión de la herramienta de borrado en una sola operación de historial.

## 13. Consecuencias para el modelo topológico

Las nuevas decisiones implican revisar el modelo actual de `Wire`.

La estructura original:

```ts
interface Wire {
  id: Id;
  a: Endpoint;
  b: Endpoint;
  waypoints: GridPoint[];
}
```

puede no ser suficiente si una polilínea completa se trata como una sola arista lógica pero el usuario necesita eliminar cada tramo individualmente.

El nuevo diseño debe garantizar simultáneamente:

1. segmentos horizontales/verticales seleccionables de forma independiente;
2. borrar un segmento puede partir una red en dos;
3. segmentos colineales innecesarios se fusionan;
4. junctions reales siguen siendo explícitos;
5. extremos libres son representables;
6. mover componentes conserva las conexiones;
7. añadir un terminal sobre una línea parte el segmento;
8. cruces geométricos nunca crean conexiones por accidente;
9. undo/redo puede restaurar exactamente cada operación.

La gente de desarrollo debe revisar y, si hace falta, rediseñar la representación de cables antes de implementar esa capa.

## 14. Casos de prueba obligatorios derivados de esta ronda

Además de los tests ya definidos, se deben añadir como mínimo los siguientes:

### Segmentos
- una polilínea con un codo tiene dos segmentos seleccionables;
- borrar solo el segmento horizontal mantiene el vertical si todavía tiene sentido topológico;
- borrar el segmento central de una red lineal parte una net en dos;
- dos segmentos colineales consecutivos sin punto significativo se fusionan automáticamente.

### Derivaciones
- iniciar una conexión en medio de un segmento lo divide;
- se crea un junction visible;
- la nueva derivación y ambos lados del cable pertenecen a la misma net.

### Terminal sobre cable
- colocar un componente con terminal exactamente sobre un segmento crea conexión automática;
- el segmento se divide correctamente;
- el terminal pertenece al mismo nodo;
- undo restaura exactamente la situación anterior.

### Movimiento
- mover un componente conectado conserva la conectividad;
- moverlo hacia abajo desde una T crea el tramo vertical requerido;
- moverlo lateralmente puede crear varios segmentos ortogonales;
- ningún movimiento inventa una conexión con un cable que simplemente se cruza;
- undo devuelve tanto la posición como la geometría previa.

### Extremos libres
- borrar un componente deja extremos libres cuando corresponda;
- esos extremos están marcados visualmente;
- un extremo libre no produce error de simulación;
- colocar posteriormente un terminal sobre él lo reconecta;
- conectar un cable nuevo desde él funciona;
- undo del borrado restaura el componente y sus conexiones originales.

### Herramienta borrar
- clic sobre componente = una transacción;
- clic sobre segmento = una transacción;
- cuatro clics = cuatro entradas de historial;
- `Ctrl+Z` restaura solo el último objeto borrado;
- la herramienta permanece activa tras cada clic;
- hover sin clic no elimina nada.

### Cruces
- dos segmentos cruzados sin junction siguen en nets distintas;
- mover un componente haciendo que su cable atraviese otra red no las fusiona;
- pasar sobre un terminal ajeno no conecta;
- agregar un junction explícito sí las fusiona.

### Cortos
- L–N directo produce `ERROR`;
- fase de fuente A con neutro de fuente B produce `ERROR`;
- fases de dos fuentes distintas en un mismo nodo producen `ERROR`;
- el estado queda congelado para inspección.

## 15. Instrucción para la siguiente iteración

Antes de continuar con implementación de las capas afectadas:

1. actualizar `PLAN.md` incorporando todas estas decisiones;
2. actualizar el modelo de cables/topología según sea necesario;
3. actualizar la estrategia de pruebas;
4. generar un nuevo `QUESTIONS.md` únicamente con decisiones todavía abiertas;
5. no volver a preguntar decisiones ya respondidas en esta ronda salvo que aparezca una contradicción técnica concreta.

El nuevo plan debe señalar explícitamente cualquier parte de la arquitectura previa que haya quedado invalidada por estas decisiones, especialmente:

- `Wire` + `waypoints`;
- política de endpoints libres;
- borrado en cascada;
- TP vs RTO;
- routing respecto de obstáculos;
- granularidad del historial para borrado.
