# Physics Laboratory Standard

Every visible physics experiment must define and verify a physical model before visual polish is added.

## Required model declaration

Each experiment documents:

- modeled bodies and degrees of freedom;
- idealizations and omitted effects;
- coordinate definitions and sign conventions;
- SI units for every physical parameter;
- governing equations;
- initial and boundary conditions;
- numerical integration method and fixed time step.

## Runtime requirements

A physics module must:

1. keep the physical model separate from Cocos rendering code;
2. enforce valid parameter ranges and unit consistency;
3. reset the physical state when a structural parameter changes;
4. expose at least one relevant invariant or constraint diagnostic;
5. stop and report non-finite state values;
6. use a bounded fixed-step simulation clock;
7. describe whether energy loss, forcing or collisions are part of the model.

## Validation

The implementation is accepted only after checking the quantities relevant to its model, such as:

- rigid-link or geometric constraint error;
- total mechanical energy drift for conservative systems;
- monotonic energy loss for damped systems;
- linear or angular momentum for isolated systems;
- expected equilibrium and limiting cases;
- repeatability under different render frame rates.

A visually plausible animation without these checks is not considered a completed physics experiment.

## Double pendulum reference

The current double pendulum is an ideal planar system with two point masses, two massless rigid rods, fixed gravity and frictionless pivots. Its generalized coordinates are the absolute angles of both rods measured from the downward vertical.

The model solves the coupled Lagrange equations as a two-by-two mass-matrix system, integrates the state with fixed-step RK4 at 240 Hz, constructs positions directly from the rigid-link constraints, and displays total energy drift and maximum link-length error at runtime.
