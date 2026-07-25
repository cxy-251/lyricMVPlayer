# Cocos Lab

Cocos Lab is a cross-platform collection of code-generated interactive works built with Cocos Creator 3.8.8. Mathematics, physics and games share one application shell while remaining isolated feature modules.

Visible content is generated at runtime with TypeScript, geometry and shaders.

## Catalog hierarchy

```text
Home
→ Laboratory catalog
→ Demo catalog inside one laboratory
→ Interactive demo
```

The application has exactly three laboratories. Each laboratory owns a manifest and may contain any number of independent demos. Internal system modules never appear in the user catalog.

Current visible structure:

```text
Mathematics Laboratory
└── Lissajous Curves

Physics Laboratory
└── Double Pendulum

Games Laboratory
└── Cursor Space
```

## Lab organization

```text
features/
├── mathematics/
│   ├── MathematicsLab.ts
│   ├── lissajous/
│   └── shared/                 # only code reused by multiple mathematics demos
├── physics/
│   ├── PhysicsLab.ts
│   ├── double-pendulum/
│   └── shared/                 # only code reused by multiple physics demos
└── games/
    ├── GamesLab.ts
    ├── cursor-space/
    └── shared/                 # only code reused by multiple games
```

A Lab manifest owns its title, description, cover, order and demo list. `AppRoot` registers the three Lab manifests rather than importing individual demos. Adding a demo only changes its own directory and the corresponding Lab manifest.

The Lab catalog reads card subtitle and cover metadata from each demo Definition. Catalog UI contains no demo-id branches, so multiple demos use the same grid and pagination automatically.

## Architecture

- `Bootstrap` connects the active scene Canvas to the persistent application core.
- `AppRoot` owns cross-scene services and registers the three Lab manifests.
- `AppShell` separates content, navigation and overlay layers.
- `NavigationService` manages home, laboratory and demo routes.
- `ModuleHost` owns demo update, pause, reset, cleanup and runtime isolation.
- `ResponsiveModule` adapts a feature to the CocosLab lifecycle and viewport.
- `ParameterController` and `ParameterPanel` provide validated, persistent controls.
- `FixedStepClock` provides bounded fixed-step simulation updates.

Every visible demo uses one readable layer order:

```text
Definition
→ Module
→ ViewModel
→ Model
→ View
```

Large demos may keep additional domain files below the Model layer, while Definition, Module, ViewModel and View retain the same responsibilities.

Dependency direction:

```text
Cocos Engine
    ↑
Application Core
    ↑
Feature Views and Modules
    ↑
ViewModels
    ↑
Domain Models
```

Domain models do not import Cocos Engine types. Views own nodes, layout and drawing. ViewModels own parameters, interaction state and derived view state. Modules only connect lifecycle events between the application shell, ViewModel and View.

Demos inside one Lab remain isolated. Reusable code moves into that Lab's `shared/` directory only after at least two demos require the same abstraction.

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
- `Space`: pause or resume the active demo
- `R`: reset the active demo state

Creator-generated `.meta` files must be committed after importing new source files.

## Module development

See [`docs/MODULE_AUTHORING.md`](docs/MODULE_AUTHORING.md) for Lab manifests, demo structure, responsibilities, lifecycle and registration rules.

## Version control

Commit TypeScript, shader source, scenes, `.meta` files and project settings. Generated caches and builds remain ignored.
