# Electrical Control Circuit Simulator — Product & Technical Specification

## 1. Purpose

Build a browser-based simulator for electrical control circuits focused on **logic and control behavior**, not detailed electrical engineering calculations.

The target user understands electrical control diagrams but should not need programming knowledge or electronics simulation expertise.

The simulator should support diagrams built with standard electrical-control symbols such as sources, switches, pushbuttons, contactor coils, auxiliary contacts, timers, lamps, and related components.

The application should behave primarily like a graphical editor plus a discrete-event logic simulator.

---

## 2. Product principles

1. **Simple mental model**: users draw an electrical control diagram, then run it.
2. **Visual clarity over electrical precision**: model energized/floating/neutral/short-circuit states, not current, impedance, transients, or waveform physics.
3. **IEC-style symbols**: use recognizable standard control-diagram notation wherever practical.
4. **Deterministic simulation**: given the same circuit and same user actions, behavior must be reproducible.
5. **Strong error visibility**: shorts and non-converging logical loops must stop the simulation and leave the exact error state inspectable.
6. **Testability is a first-class requirement**: editor behavior, routing, state propagation, timers, undo/redo, short detection, and error handling must all have automated tests.

---

## 3. Runtime architecture

### 3.1 Web application

The product is a web application.

The server is only required to serve the static application assets in V1. The simulation engine, editor state, file loading/saving, and interaction logic run client-side in the browser.

No backend is required for V1.

Future versions may add cloud storage, authentication, collaboration, or account-based persistence, but these are out of scope for V1.

### 3.2 Client-side execution

Once loaded, the application should be self-contained enough to run the editor and simulator entirely in the browser.

### 3.3 Version and cache management

The application must prevent users from remaining on a stale cached version after a deployment.

Requirements:

- Every build must have a unique application version/build identifier.
- Static assets should use hashed filenames or an equivalent cache-busting strategy.
- The application should check its version at startup.
- If a newer deployed version is detected, the client should invalidate stale cached assets and reload cleanly.
- If a Service Worker is used, it must be designed so old clients are not indefinitely pinned to stale code.
- Version/cache-update behavior must be covered by tests where practical.

---

## 4. Global application states

The application has three explicit top-level states.

### 4.1 EDIT mode

Users can:

- add components;
- delete components;
- move components;
- rotate components;
- draw/edit wires;
- select one or multiple objects;
- edit properties;
- import/save circuits;
- undo/redo.

The simulation is not active.

### 4.2 SIMULATION mode

The circuit is running.

The diagram is locked against structural editing.

Users can still perform **runtime interactions**, such as:

- pressing and holding a momentary pushbutton;
- toggling maintained switches;
- observing timer state;
- observing energized/floating/error states.

### 4.3 ERROR mode

The entire simulation stops and freezes at the exact state that caused the error.

Examples:

- short circuit;
- non-converging instantaneous logic loop / oscillation.

While in ERROR mode:

- the circuit cannot continue simulating;
- the full simulation state remains frozen;
- timer elapsed/remaining values remain frozen;
- affected nodes/components/wires are highlighted;
- the user can inspect the problem;
- returning to EDIT mode requires an explicit user action.

The system must **not** automatically drop back to edit mode after an error.

---

## 5. Canvas and editor

### 5.1 Infinite canvas

Use an effectively infinite or very large pannable canvas.

Requirements:

- pan;
- zoom;
- grid;
- snap-to-grid placement;
- stable coordinates independent of zoom level.

### 5.2 Orthogonal wiring only

Wires may only consist of horizontal and vertical segments.

No diagonal wires.

### 5.3 Wire crossing semantics

Two wires that visually cross are **not electrically connected** by default.

They belong to separate electrical nodes unless explicitly joined.

### 5.4 Creating an electrical junction

A junction is created explicitly by starting a new wire from an existing wire or otherwise explicitly joining two wire networks.

If the user starts a new wire from any point on an existing wire:

- that point becomes an electrical junction;
- the new wire belongs to the same electrical node;
- a small junction dot should appear visually.

If two previously separate electrical nodes become joined via an explicit connection, they become one electrical node in the internal model.

### 5.5 Wiring tool

A dedicated connection/wire tool must exist.

Users should be able to:

- select the tool from a toolbar;
- start from a component terminal;
- start from an existing wire;
- route using orthogonal segments;
- terminate at another terminal or existing wire;
- cancel with Escape.

### 5.6 Wire color/state

Visual state should communicate electrical state.

At minimum distinguish:

- neutral-associated node;
- energized node;
- floating/de-energized node;
- short/error node.

Exact color palette can be chosen during implementation, but error should be visually obvious and shorted networks should turn red.

### 5.7 Auto-routing on move

When a wired component is moved:

- its existing electrical connections must remain intact;
- wires must automatically re-route using orthogonal segments;
- the route must remain understandable;
- routing should avoid unnecessary overlaps;
- two unrelated wire segments should not be laid directly on top of each other along the same grid path where that would make node identity ambiguous.

This is required in V1.

A simple deterministic orthogonal router is acceptable initially, but the routing result must be stable and testable.

### 5.8 Manual refinement

It is acceptable for V1 auto-routing to be basic as long as users can later refine routing manually.

---

## 6. Tools and interaction model

### 6.1 Top toolbar

Provide a top toolbar with icons for core tools such as:

- selection;
- wire/connection;
- delete or erase if useful;
- simulation start/stop;
- zoom controls if desired;
- undo/redo.

### 6.2 Direct tool keys

Core tools should also be selectable via single-key shortcuts, not only Ctrl/Cmd combinations.

Example concept:

- V = selection;
- W = wire;
- R = rotate selected/preview component;
- Esc = cancel active placement/tool.

Exact key mapping can be finalized during implementation, but it must be documented and consistent.

### 6.3 Component placement

When the user selects a component from the component library:

- the component becomes a ghost/preview attached to the cursor;
- it snaps to the grid;
- before placement, pressing `R` rotates it 90 degrees;
- clicking places it;
- after placement, the same component remains active for repeated placement;
- the user exits placement mode with Escape or by choosing another tool/component.

### 6.4 Rotation

Rotation is in 90-degree increments only.

`R` rotates:

- the placement preview before the component is placed;
- one selected component after placement.

Multi-selection rotation is not required and should be disabled in V1.

### 6.5 Multi-selection

Support multi-selection for at least:

- moving a group;
- deleting a group.

Selection methods may include:

- selection rectangle;
- Shift-click additive selection.

Group rotation is explicitly out of scope for V1.

---

## 7. Side panels

### 7.1 Left component library

The left side of the UI should contain a component library organized by groups.

Possible groups:

- Sources
- Manual controls
- Contactors / relays
- Contacts
- Timers
- Loads / indicators
- Utility / junction elements

Timer types that use different standard symbols should appear as **different visual components**, even if they reuse shared internal implementation.

### 7.2 Right properties panel

When a component is selected, show an editable properties panel on the right.

Examples:

- identifier (`K1`, `T1`, `S1`, `H1`, etc.);
- label/description;
- timer duration;
- timer type-specific parameters;
- linked coil/contact identifier;
- initial/manual state where relevant;
- other component-specific properties.

---

## 8. Initial component set

V1 must include at least the following categories.

### 8.1 AC source

A logical AC source with two terminals:

- `L` — line/phase;
- `N` — neutral.

The simulation does not need sinusoidal waveform modeling.

Each independent source introduces a unique logical source identity.

Example:

- Source A: `L_A`, `N_A`
- Source B: `L_B`, `N_B`

### 8.2 Maintained switches

Support maintained manual switches.

A click changes their runtime state and the state remains until clicked again.

Support both:

- normally open (NO);
- normally closed (NC).

### 8.3 Momentary pushbuttons

Support momentary pushbuttons.

While the pointer button is held down during simulation, the pushbutton remains actuated.

When released, it returns to its normal state.

Support both:

- normally open (NO);
- normally closed (NC).

### 8.4 Contactor / relay coil

A coil has an identifier such as `K1`.

Its electrical terminals are independent from the graphical locations of its contacts.

### 8.5 Associated contacts

NO and NC contacts may be placed anywhere in the diagram and linked logically to a coil via an identifier/reference.

Example:

- coil `K1`;
- contact `K1.1` NO;
- contact `K1.2` NC.

When coil `K1` energizes, all linked contacts update consistently.

### 8.6 Timers

Timer types must be represented as distinct visual library components when their electrical/control symbols differ.

At minimum consider separate components for:

- on-delay timer (TON / delay on energization);
- off-delay timer (TOF / delay on de-energization);
- interval timer if included in V1.

Their linked timed contacts should also use the correct visual distinction where applicable.

Internal implementation may share a generic timer engine.

### 8.7 Lamp / indicator load

A lamp is considered ON when its terminals see a valid source-to-neutral electrical relationship according to the simplified model.

No power/current calculation is required.

Its visual representation should clearly indicate ON/OFF state.

---

## 9. Electrical abstraction model

The simulator models **logical electrical connectivity**, not detailed circuit physics.

### 9.1 Electrical nodes

An electrical node is a connected set of terminals and wire segments.

Node identities are derived from explicit connectivity, not visual proximity or crossing.

### 9.2 Floating nodes

A node can exist with no active source attached.

Such a node is floating/de-energized.

Example:

A lamp may have one terminal connected to a neutral node while its other terminal remains floating until a phase source reaches it through closed contacts.

### 9.3 Neutral behavior

Multiple source neutrals may be connected together.

This is allowed in the simplified V1 logic model.

Example:

- `N_A` and `N_B` both connect to common node `N1`.

This should not itself cause an error.

### 9.4 Phase/source propagation

A floating node becomes energized by a source phase when a conductive path connects that phase to the node.

The node therefore acquires the logical source identity of that phase.

Example:

- `L_A` reaches node X through a closed contact;
- node X becomes energized by Source A.

### 9.5 Short-circuit rule

The primary V1 short-circuit condition is:

> A single electrical node becomes simultaneously energized by line/phase identities from two different independent sources.

Example:

- `L_A` reaches node X;
- later a second closed path connects `L_B` to node X;
- node X now contains two incompatible active phase identities;
- simulation enters ERROR mode.

Important clarification:

The node was not inherently "a phase" before being energized. It may have been floating. The error arises when two independent phases try to energize the same connected node.

### 9.6 Neutral-to-phase behavior

Implementation should use explicit source identity and node classification so invalid active-line relationships can be detected consistently.

The final implementation may formalize source tokens such as:

```text
SourceIdentity = A | B | C | ...
PotentialClass = Neutral | Line(SourceIdentity) | Floating
```

The model intentionally avoids volts, current, impedance, and phase angles in V1.

---

## 10. Simulation engine

### 10.1 Discrete-event model

Use a discrete-event simulation model rather than a fixed 100 ms polling/tick loop.

The simulation advances through:

1. external/user input change;
2. immediate logical propagation;
3. convergence to a stable instantaneous state;
4. scheduled timer events;
5. further immediate propagation after each timer event.

### 10.2 Instantaneous propagation

Relays/contactors and ordinary contacts are logically instantaneous in V1.

When a state change occurs:

- update affected switches/contacts/coils;
- propagate electrical node state;
- continue until no instantaneous state changes remain.

### 10.3 Timer events

Timers schedule future state transitions.

Example:

A 5-second on-delay timer energizes at simulation time `t=0`.

Instead of checking every 100 ms, schedule an event for `t=5s`.

When `t=5s` is reached:

- update the timer output/contact state;
- run instantaneous propagation again until stable.

### 10.4 Timer cancellation/reset

Timer semantics must match the selected timer type.

For each timer type, explicitly define:

- when timing begins;
- whether accumulated time resets when input changes;
- whether a pending event is canceled;
- output state before/during/after timing.

These behaviors require dedicated unit tests.

---

## 11. Detection of non-converging logic / oscillation

An instantaneous control loop may fail to stabilize.

Example:

```text
L ---- [ K1 NC ] ---- ( K1 ) ---- N
```

Behavior:

1. `K1` is OFF, so its NC contact is closed.
2. The coil receives power and turns ON.
3. Its NC contact opens.
4. The coil loses power and turns OFF.
5. Its NC contact closes again.
6. The process repeats indefinitely in zero simulated time.

The simulator must detect this condition rather than hanging.

### 11.1 Detection strategy

A recommended strategy:

- hash or serialize relevant instantaneous simulator state after each propagation step;
- if the same state repeats before convergence, detect a cycle;
- alternatively enforce a high but finite iteration limit as a secondary safety guard.

### 11.2 Oscillation response

On detection:

- stop all simulation;
- enter ERROR mode;
- freeze simulation time;
- freeze timer states;
- highlight participating components/nodes where determinable;
- present a concise error message explaining that an instantaneous logical loop failed to stabilize.

Do not continue unaffected sections of the circuit.

---

## 12. Short-circuit response

When a short is detected:

- stop the entire simulation immediately;
- enter ERROR mode;
- freeze the exact state that caused the short;
- highlight the affected electrical node/wires in red;
- highlight relevant source/components if possible;
- preserve timer elapsed/remaining values at the moment of failure;
- require an explicit action to return to EDIT mode.

---

## 13. Simulation controls

At minimum provide:

- Start simulation;
- Stop simulation;
- Exit error / Return to edit.

During normal simulation, stopping returns to edit mode.

During error mode, use an explicit recovery action.

Future possibilities such as pause, step, time scaling, or event stepping can be added later but are not mandatory in V1.

---

## 14. Save/load format

### 14.1 JSON

Circuits must be exportable to and importable from a human-readable JSON file.

### 14.2 Versioned schema

The file format must contain a schema version.

Example:

```json
{
  "schemaVersion": 1,
  "metadata": {
    "name": "Motor starter example"
  },
  "components": [],
  "wires": [],
  "view": {}
}
```

### 14.3 Data to persist

Persist at least:

- component type;
- component unique ID;
- logical reference (`K1`, `T1`, etc.);
- position;
- rotation;
- component properties;
- wires and junctions;
- explicit electrical connectivity;
- viewport position/zoom if desired;
- schema version.

Do not persist transient simulation state unless explicitly required later.

### 14.4 Migration

Design loading so future schema versions can be migrated.

---

## 15. Undo/redo

Undo and redo are required in V1.

Support at least:

- placing component;
- deleting component;
- moving component(s);
- rotating component;
- drawing wire;
- deleting/editing wire;
- property edits;
- junction creation/removal;
- multi-object move/delete.

Undo/redo must be treated as a high-risk subsystem and extensively tested.

A command-pattern or immutable state-history architecture is recommended.

`Ctrl+Z` / `Cmd+Z` should undo.

Redo should use the conventional platform shortcut.

---

## 16. Suggested internal architecture

The implementation should strongly separate these concerns:

### 16.1 Document model

Pure serializable circuit definition.

Contains components, positions, rotations, properties, wires, and references.

### 16.2 Connectivity graph

Derived electrical topology:

- terminals;
- wire segments;
- junctions;
- electrical nodes;
- source identities.

### 16.3 Simulation state

Runtime-only state:

- switch states;
- coil states;
- contact states;
- energized node identities;
- timer state;
- pending events;
- simulation clock;
- error state.

### 16.4 Rendering/editor layer

Canvas/UI interaction only.

Should not contain core electrical logic.

### 16.5 Command/history layer

Editor mutations and undo/redo.

### 16.6 Router

Orthogonal wire routing should be independently testable.

---

## 17. Determinism

For a given:

- document;
- initial simulator state;
- ordered sequence of user actions;
- timer durations;

the resulting simulation state and error behavior must be deterministic.

Avoid behavior based on uncontrolled browser timing.

Use simulation time, not raw wall-clock time, as the authoritative clock for control logic.

---

## 18. Testing requirements

Testing is not optional.

The agent/development team should implement automated tests alongside features.

### 18.1 Unit tests

Required for:

- electrical node construction;
- merging nodes;
- crossing wires without joining;
- explicit junction creation;
- phase propagation;
- common neutral handling;
- short detection;
- coil/contact linkage;
- NO and NC semantics;
- each timer type;
- event scheduling/canceling;
- convergence;
- oscillation detection;
- JSON serialization/deserialization;
- schema migration;
- undo/redo primitives;
- orthogonal routing.

### 18.2 Integration tests

Required for flows such as:

- place a component;
- rotate before placement;
- place multiple copies;
- Escape cancels placement;
- move wired component and keep connectivity;
- route recalculates without electrical break;
- select multiple components and move them;
- draw from an existing wire and create a junction;
- crossing wires remain electrically separate;
- start simulation and lock editing;
- momentary pushbutton follows pointer-down/up;
- maintained switch toggles on click;
- short enters ERROR mode;
- oscillation enters ERROR mode;
- error preserves timer state;
- return from error to edit explicitly;
- undo/redo after complex editing sequences.

### 18.3 End-to-end tests

Use browser automation for critical user workflows.

At minimum:

1. build a basic lamp circuit;
2. run it;
3. operate a switch;
4. observe lamp state;
5. stop and edit again.

Also include:

- contactor seal-in circuit;
- timer circuit;
- short-circuit scenario;
- oscillation scenario;
- save/reload and confirm identical topology.

### 18.4 Routing regression tests

The wire router deserves dedicated fixtures.

For each fixture assert:

- all segments remain orthogonal;
- terminals remain connected;
- no unintended electrical node merge occurs;
- unrelated wires are not unnecessarily stacked on identical grid paths;
- repeated routing of the same input returns the same result.

### 18.5 Undo/redo stress tests

Generate long edit sequences such as:

```text
place -> move -> wire -> move -> rotate -> property edit -> delete -> undo xN -> redo xN
```

Verify that the final document matches the expected serialized document exactly.

---

## 19. Example scenarios

### 19.1 Basic lamp

```text
L1 ---- [ S1 NO ] ---- ( H1 Lamp ) ---- N1
```

Expected behavior:

- S1 open: H1 off;
- S1 closed: H1 on.

### 19.2 Contactor with auxiliary contact

```text
Control branch:
L1 ---- [ S1 NO ] ---- ( K1 Coil ) ---- N1

Load branch:
L1 ---- [ K1 NO ] ---- ( H1 Lamp ) ---- N1
```

Expected behavior:

- activating S1 energizes K1;
- K1 NO closes;
- H1 turns on.

### 19.3 Shared neutral from multiple sources

```text
Source A: LA ---- ...
          NA ----+---- N_COMMON

Source B: LB ---- ...
          NB ----+
```

Expected behavior:

- common neutral is allowed;
- no error merely because NA and NB are joined.

### 19.4 Floating load node

```text
N_COMMON ---- Lamp ---- X
```

Node X is initially floating.

If LA later reaches X through a closed path, the lamp becomes energized from Source A.

### 19.5 Short between independent phases

```text
LA ---- [ S1 ] ----+
                    +---- X
LB ---- [ S2 ] ----+
```

If only one switch is closed, X is energized by one source.

If both become closed simultaneously, Source A and Source B line identities meet on X.

Expected behavior:

- enter ERROR mode;
- freeze everything;
- highlight X and relevant paths red.

### 19.6 Instantaneous oscillation

```text
L ---- [ K1 NC ] ---- ( K1 ) ---- N
```

Expected behavior:

- simulator detects repeating non-stable state;
- enters ERROR mode;
- highlights K1 and its linked contact.

---

## 20. Example Given/When/Then specifications

### Junction semantics

```gherkin
Given wire A crosses wire B visually
And no explicit junction exists
When the connectivity graph is built
Then A and B belong to different electrical nodes
```

```gherkin
Given wire A and wire B are separate electrical nodes
When the user starts a wire from A and connects it to B
Then A and B become a single electrical node
And a junction marker is rendered
```

### Component movement

```gherkin
Given component K1 is connected by two wires
When the user moves K1 to another grid position
Then both electrical connections remain valid
And the wires are re-routed orthogonally
And no unintended junction is created
```

### Momentary pushbutton

```gherkin
Given a normally-open momentary pushbutton S1
And the application is in SIMULATION mode
When the user holds the pointer down on S1
Then S1 is electrically closed
When the user releases the pointer
Then S1 returns to open
```

### Short circuit

```gherkin
Given node X is energized by Source A line
When Source B line becomes connected to node X
Then the simulation stops
And the application enters ERROR mode
And simulation time is frozen
And the affected node is highlighted as an error
```

### Oscillation

```gherkin
Given an instantaneous relay loop has no stable state
When simulation propagation repeats a previously seen state
Then simulation stops
And the application enters ERROR mode
And the involved components are highlighted
```

---

## 21. Non-goals for V1

Unless explicitly added later, V1 does not need:

- analog voltage calculation;
- amperage/current calculation;
- resistance;
- impedance;
- power factor;
- sinusoidal waveform simulation;
- phase-angle mathematics;
- thermal effects;
- arc modeling;
- breaker trip curves;
- electromagnetic transient behavior;
- SPICE-level simulation;
- collaborative multi-user editing;
- cloud accounts;
- backend persistence;
- arbitrary-angle wiring;
- group rotation.

---

## 22. Open implementation decisions

The development agent may propose options for these, but must document the chosen approach before implementation:

- rendering technology (SVG, Canvas, DOM/SVG hybrid, etc.);
- state management library;
- graph representation;
- orthogonal routing algorithm;
- testing stack;
- exact shortcut mapping;
- exact IEC symbol asset strategy;
- whether to use a Service Worker or hashed assets only;
- exact timer types included in the first shipping slice.

The agent should not silently make architecture-changing assumptions where the specification is ambiguous.

---

## 23. Definition of done for V1

V1 is considered complete only when all of the following are true:

- the editor supports the required placement, wiring, movement, rotation, multiselect, properties, undo/redo, save/load, zoom/pan, and grid behavior;
- required control components exist;
- coil/contact logical references work;
- timer behavior works through discrete events;
- simulation mode locks editing;
- momentary and maintained manual controls work;
- short circuits are detected;
- non-converging instantaneous loops are detected;
- both errors enter frozen ERROR mode;
- auto-routing preserves connections after movement;
- JSON schema is versioned;
- stale-client/cache behavior is addressed;
- automated tests cover the critical requirements above;
- critical E2E scenarios pass consistently.

