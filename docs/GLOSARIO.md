# Glosario

| Término | En el código | Significado |
|---|---|---|
| **Documento** | `BoardDocument` | El tablero serializable: aparatos, cables y anotaciones. Lo único que se guarda y lo único que entra al historial |
| **Aparato** | `DeviceInstance` | Un objeto físico colocado: acometida, taco, contactor, relé, temporizador, pulsador, piloto, foco, UPS. No rota |
| **Borne** | `TerminalRef` | Tornillo de un aparato (`K1.A1`). Su posición es la del aparato más el desplazamiento del catálogo |
| **Cable** | `Wire` | Une **exactamente dos bornes**, con sus propios codos, color y calibre. Sin empalmes ni extremos libres |
| **Codo** | `bends` | Punto donde el cable dobla. Pertenece solo a ese cable |
| **Elemento interno** | `internals` | Lo que el aparato lleva adentro: actuador (bobina, temporizador o accionamiento manual), contacto, carga o fuente |
| **Actuador** | `ActuatorDef` | Lo que mueve los contactos de **su mismo aparato**. No hay vínculos por referencia |
| **Red** (net) | `NetId` | Conjunto de bornes unidos por cables. La conectividad pasa solo por los bornes |
| **Nodo eléctrico** | — | Unión de redes a través de los contactos que conducen en un instante dado |
| **Identidad de fase** | `LineId` | `(sourceId, phaseIndex)`: qué fase de qué acometida alcanza un nodo. Las fases de un poste comparten el neutro |
| **Flotante** | — | Nodo sin ninguna fase ni neutro |
| **Carga** | `LoadDef` | Elemento que sensa pero no conduce: piloto, foco, bobina, temporizador |
| **Validez** | `violations` | Una operación es válida si no **agrega** violaciones (W1–W4) al documento |
| **W1** | `WIRE_OVERLAP` | Dos cables de redes distintas comparten recorrido. Prohibido; los de la misma red sí pueden |
| **W2** | `WIRE_ON_TERMINAL` | Un cable pasa justo por un borne ajeno |
| **W3** | `BEND_ON_WIRE` | Un codo cae dentro de un tramo de otra red |
| **W4** | `DEVICE_OVERLAP` | Dos aparatos superpuestos |
| **Reparación** | `repairRoute` | Reacomodo ortogonal de un cable cuando se movió uno de sus bornes |
| **Colocando** | `placing` | Aparato que sigue al cursor hasta el clic que lo coloca |
| **Settle** | `settle` | Búsqueda del punto fijo instantáneo tras cada cambio |
| **Oscilación** | `oscillation` | El punto fijo no existe: el estado se repite sin estabilizarse |
| **Diagnóstico bloqueante** | severidad `blocking` | Impide iniciar la simulación (distinto de una falla de simulación) |
| **Modo ERROR** | `mode: 'error'` | Simulación detenida y congelada por un corto o una oscilación |
