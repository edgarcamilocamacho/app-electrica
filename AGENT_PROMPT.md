# Prompt for the implementation agent

You are implementing a browser-based electrical control-circuit simulator.

The attached file `electrical_control_simulator_spec.md` is the **source of truth** for product behavior, simulation semantics, UI interactions, architecture constraints, and testing requirements.

Do not begin by coding blindly.

## Phase 1 — Read and challenge the specification

Read the entire specification first.

Then return a concise implementation review containing:

1. your interpretation of the core product;
2. the proposed frontend/editor architecture;
3. the proposed electrical connectivity model;
4. the proposed discrete-event simulation architecture;
5. the proposed orthogonal wire-routing approach;
6. the proposed undo/redo architecture;
7. the proposed persistence/schema design;
8. the testing strategy;
9. architectural or semantic ambiguities you believe need a decision;
10. risks you foresee.

Do **not** change the electrical semantics simply because another simulator behaves differently.

If you think a requirement is technically problematic, explain why and propose an alternative, but wait for approval before changing the specification.

## Phase 2 — Build an implementation plan

After ambiguities are resolved, create an incremental implementation plan.

Prefer vertical slices that are independently testable.

A reasonable dependency order is:

1. application shell + canvas/grid/pan/zoom;
2. document model;
3. component rendering and placement;
4. selection/movement/rotation;
5. wire model + explicit junction behavior;
6. connectivity graph;
7. orthogonal routing and re-routing;
8. undo/redo;
9. JSON save/load with schema versioning;
10. core electrical propagation;
11. switches and pushbuttons;
12. coils and linked contacts;
13. timer/event engine;
14. short-circuit detection;
15. oscillation/convergence detection;
16. SIMULATION / ERROR mode UX;
17. cache/build version handling;
18. E2E stabilization and regression tests.

You may propose a better dependency order if you justify it.

## Phase 3 — Test-first expectations

Automated tests are mandatory and should be added with each subsystem.

Do not postpone all tests until the end.

Pay particular attention to:

- moving wired components;
- routing regressions;
- explicit vs visual wire junctions;
- node merging;
- source identity propagation;
- multi-source short detection;
- coil/contact linkage;
- timer scheduling/canceling;
- non-converging relay loops;
- frozen ERROR state;
- undo/redo after long edit sequences;
- save/load round trips;
- stale-client/cache update behavior.

If a feature cannot be tested reliably because of the current architecture, treat that as an architectural problem and fix the design instead of skipping the test.

## Phase 4 — Technical principles

Keep these layers separated:

- serializable document model;
- derived electrical/connectivity graph;
- simulation runtime state;
- simulation/event engine;
- rendering/editor interaction layer;
- command/history layer;
- orthogonal routing layer.

Core electrical logic should not depend directly on DOM/canvas rendering.

The simulation engine should be deterministic and driven by simulation time, not uncontrolled wall-clock timing.

Use a discrete-event model for timers. Do not implement the entire simulator as a global 100 ms polling loop unless a specific UI animation requires it.

## Phase 5 — UX requirements that must not be lost

Remember these details:

- infinite/large canvas;
- zoom/pan;
- grid snapping;
- orthogonal wires only;
- crossing wires do not connect automatically;
- starting a new wire from an existing wire creates an explicit electrical junction and visible dot;
- component placement follows the cursor as a ghost;
- `R` rotates preview or single selected component by 90°;
- placement remains active for repeated copies;
- Escape cancels placement/tool;
- multi-select may move/delete, but not rotate as a group;
- wired components keep connectivity when moved;
- wires auto-reroute after movement;
- unrelated wires must not become visually ambiguous by stacking on the same grid path where avoidable;
- left component library;
- top tool icons;
- single-key direct tool access;
- right properties panel;
- simulation locks structural editing;
- momentary controls react to pointer-down/pointer-up;
- maintained controls toggle on click;
- ERROR mode freezes the exact failed state instead of returning automatically to edit.

## Phase 6 — Electrical semantics that must not be lost

The model is intentionally simpler than a full circuit simulator.

Important rules:

- AC sources are logical `L/N` pairs;
- multiple neutrals may be tied together;
- a node may be floating;
- a floating node becomes energized by the source line that reaches it;
- a short occurs when line identities from two independent sources energize the same electrical node;
- coil/contact relationships are logical and do not depend on physical proximity;
- immediate logic propagates until stable;
- timers introduce scheduled future events;
- if immediate logic never stabilizes and repeats a state, stop everything and enter ERROR mode.

## Phase 7 — Before implementation starts

Return your review and questions first.

Do not make large irreversible implementation choices until the review is accepted.

Once approved, maintain a short implementation-status document showing:

- completed items;
- current item;
- failing tests;
- known limitations;
- open decisions.

