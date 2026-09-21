# Glosario

| Término | En el código | Significado |
|---|---|---|
| **Documento** | `CircuitDocument` | El circuito serializable: componentes, vértices, segmentos y anotaciones. Lo único que se guarda y lo único que entra al historial |
| **Componente** | `ComponentInstance` | Un símbolo colocado: fuente, interruptor, bobina, contacto, timer, lámpara… |
| **Terminal** | `terminalId` | Punto de conexión de un componente. Su posición se deriva de la posición y rotación del componente |
| **Vértice** | `WireVertex` | Nodo del grafo de cableado. Dos clases: `point` (con posición propia) y `terminal` (ligado a un terminal de componente) |
| **Segmento** | `WireSegment` | Tramo recto horizontal o vertical entre dos vértices. Unidad mínima que se selecciona y se borra |
| **Grado** | `degree` | Cantidad de segmentos que tocan un vértice |
| **Junction** (punto de unión) | — | Vértice de grado ≥ 3 (o terminal de grado ≥ 2). Se dibuja con un punto lleno ● |
| **Esquina** | — | Vértice `point` de grado 2 donde los segmentos forman 90° |
| **Extremo libre** | — | Vértice `point` de grado 1. Se dibuja con un círculo abierto ○ |
| **Red** (net) | `NetId` | Conjunto de vértices y terminales unidos por segmentos. Lo que el cableado une, sin contar contactos |
| **Nodo eléctrico** | — | Unión de redes a través de dispositivos que conducen en un instante dado (contactos cerrados, etc.) |
| **Canonicalización** | `canonicalize` | Paso que reescribe el grafo a su forma normal única sin cambiar la partición en redes |
| **Forma normal** | — | Sin segmentos de largo cero (salvo terminal–terminal), sin duplicados, sin puntos redundantes, sin coincidencias geométricas dentro de una red |
| **Contacto ambiguo** | `V2`, `V3` | Dos redes distintas que se tocan geométricamente sin estar conectadas (T sin punto, puntos coincidentes, cable sobre terminal ajeno). Prohibido |
| **Solapamiento** | `V1` | Dos segmentos de redes distintas superpuestos en la misma línea. Prohibido |
| **Validez** | `validate` | Una operación es válida si no agrega violaciones al documento |
| **Reparación** | `repair` | Reconstrucción ortogonal de los segmentos que quedaron con un extremo desplazado tras mover |
| **Tomado** | `carrying` | Objeto que sigue al cursor con la herramienta Mover, a la espera del clic que lo coloca |
| **Identidad de fase** | `LineId` | `(sourceId, phaseIndex)`: qué fase de qué fuente alcanza un nodo |
| **Flotante** | — | Nodo sin ninguna fase ni neutro |
| **Carga** | behavior `load` | Dispositivo que sensa pero no conduce: lámpara, bobina, timer |
| **Settle** | `settle` | Búsqueda del punto fijo instantáneo tras cada cambio |
| **Oscilación** | `oscillation` | El punto fijo no existe: el estado se repite sin estabilizarse |
| **Diagnóstico bloqueante** | severidad `blocking` | Impide iniciar la simulación (distinto de un error de simulación) |
| **Modo ERROR** | `mode: 'error'` | Simulación detenida y congelada por un corto o una oscilación |
