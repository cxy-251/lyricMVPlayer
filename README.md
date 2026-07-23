# Cocos Lab

Cocos Lab is a cross-platform collection of code-generated interactive works built with Cocos Creator 3.8.8. Games, simulations, mathematical visualizations, generative art, shaders, music interactions and tools share one application shell while remaining isolated feature modules.

Visible content is generated at runtime with TypeScript, geometry and shaders.

## Catalog hierarchy

```text
Home
→ Laboratory catalog
→ Module catalog inside one laboratory
→ Interactive module
```

The home page is generated from registered, visible modules. A laboratory appears only when it already contains at least one working module. Internal system modules never appear in the user catalog.

Current visible structure:

```text
Mathematics Laboratory
└── Parametric Curve Lab

Physics Laboratory
└── Double Pendulum
```

## Architecture

- `Bootstrap` connects the active scene Canvas to the persistent application core.
- `AppRoot` owns cross-scene services and module registration.
- `AppShell` separates content, navigation and overlay layers.
- `NavigationService` manages home, laboratory and module routes.
- `ModuleHost` owns module update, pause, reset, cleanup and runtime isolation.
- `ResponsiveModule` is the standard base for full-screen responsive works.
- `ParameterController` and `ParameterPanel` provide validated, persistent controls.
- `FixedStepClock` provides bounded fixed-step simulation updates.

Dependency direction:

```text
Cocos Engine
    ↑
Application Core
    ↑
Feature Modules
```

Feature modules depend on application contracts and reusable infrastructure, never on other feature modules.

## Physics modules

Physics experiments separate the physical model from rendering, use SI units, declare their assumptions and expose numerical diagnostics. See [`docs/PHYSICS_LAB_STANDARD.md`](docs/PHYSICS_LAB_STANDARD.md).

## Run

1. Pull the `cocoslab` branch.
2. Open the project with Cocos Creator 3.8.8.
3. Open the existing `Boot` scene.
4. Wait for Creator to import new TypeScript files.
5. Run Browser Preview.

Keyboard actions:

- `Escape`: return one navigation level
- `Space`: pause or resume the active module
- `R`: reset the active module state

Creator-generated `.meta` files must be committed after importing new source files.

## Module development

See [`docs/MODULE_AUTHORING.md`](docs/MODULE_AUTHORING.md) for the module template, parameters, fixed-step simulation and registration process.

## Version control

Commit TypeScript, shader source, scenes, `.meta` files and project settings. Generated caches and builds remain ignored.
