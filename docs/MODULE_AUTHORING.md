# Module authoring

Every interactive demo belongs to exactly one of the three CocosLab laboratories and runs inside `ModuleHost`. The host supplies an isolated root node, viewport updates, storage, input, application state and navigation.

## Standard Lab directory

Each Lab owns one manifest and any number of independent demo directories:

```text
laboratory-name/
├── LaboratoryNameLab.ts
├── demo-one/
├── demo-two/
└── shared/                     # optional
```

The Lab manifest contains:

- Lab id, title, description, order and catalog cover
- the ordered list of visible demo Definitions

Example:

```ts
export const mathematicsLab: LabManifest = {
    definition: {
        id: 'mathematics',
        title: 'Mathematics Laboratory',
        description: 'Interactive curves, geometry and mathematical systems.',
        order: 10,
        cover: 'mathematics',
    },
    modules: [
        lissajousDefinition,
        fourierEpicycleDefinition,
    ],
};
```

`AppRoot` registers Lab manifests. It does not import individual demo Definitions.

## Lab shared code

Demos inside one Lab do not import each other. Code moves into the Lab's `shared/` directory only when at least two demos use the same stable abstraction.

Examples:

```text
mathematics/shared/Plot2D.ts
physics/shared/SimulationDiagnostics.ts
games/shared/ProjectilePool.ts
```

Keep one-demo helpers inside that demo. This prevents speculative frameworks and keeps ownership clear.

## Standard demo directory

Each visible demo uses one domain name and one directory:

```text
feature-name/
├── FeatureDefinition.ts
├── FeatureModule.ts
├── FeatureViewModel.ts
├── FeatureModel.ts
├── FeatureView.ts
├── FeatureTypes.ts
├── FeatureRenderer.ts     # optional
├── FeaturePresets.ts      # optional
└── index.ts
```

Use the real domain name in every file and class. A Lissajous demo uses `LissajousModule`, not a broader name such as `ParametricCurveModule`.

Read a demo in this order:

```text
Definition → Module → ViewModel → Model → View
```

## Layer responsibilities

### Definition

Contains catalog metadata and creates the Module. It does not contain runtime state, drawing or domain calculations.

Every visible Definition provides:

- stable demo id
- title and description
- owning `labId`
- catalog subtitle and cover
- tags, capabilities, status and order

The Lab catalog reads this metadata directly. Catalog UI must not branch on demo ids.

### Module

Adapts the demo to CocosLab lifecycle methods:

- mount and unmount
- viewport layout
- update
- pause and resume
- reset

The Module connects ViewModel output to View rendering. It does not create detailed UI nodes or calculate domain results.

### ViewModel

Owns user parameters, persisted settings, animation state, presets and derived View state. It may use `ParameterController`. It does not import `Node`, `Graphics`, `Label`, `Color` or other Cocos rendering types.

### Model

Contains pure domain rules: mathematics, physics, game rules or numerical integration. Models do not import Cocos Engine types, UI factories, storage or navigation.

A large demo may compose several internal domain implementations. Keep one demo-local `FeatureModel.ts` as the public boundary so the ViewModel does not depend on internal implementation filenames.

### View

Owns Cocos nodes, responsive layout, labels, controls and drawing. It receives prepared View state and forwards user actions to the ViewModel through the Module.

A View owns only the active demo screen. Lab navigation, demo cards and pagination remain in the shared application catalog UI.

### Renderer

An optional Renderer owns a specialized GPU, mesh or shader backend used by the View. It does not own demo lifecycle, navigation or game state.

### Types

Contains demo-specific contracts shared between Model, ViewModel and View. Keep types close to the demo rather than adding unrelated global interfaces.

## Lifecycle template

```ts
class ExampleModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'ExampleModuleRoot';

    private viewModel: ExampleViewModel | null = null;
    private view: ExampleView | null = null;

    protected onMount(): void {
        this.viewModel = new ExampleViewModel(this.requireContext().storage);
        this.view = new ExampleView(this.requireRoot(), this.viewModel, {
            changed: () => this.renderCurrentState(),
        });
    }

    protected render(viewport: ViewportSnapshot): void {
        this.view?.layout(viewport);
        this.renderCurrentState();
    }

    update(dt: number): void {
        if (this.viewModel?.update(dt)) {
            this.renderCurrentState();
        }
    }

    pause(): void {
        this.viewModel?.pause();
    }

    resume(): void {
        this.viewModel?.resume();
    }

    reset(): void {
        this.viewModel?.reset();
        this.renderCurrentState();
    }
}
```

## Parameters

Describe controls with a `ParameterSchema`. The ViewModel owns the `ParameterController`, which validates persisted data, clamps numeric values, cycles select values and writes changes through `StorageService`.

The View renders controls with `ParameterPanel`. Keep presets outside the generic parameter grid when doing so prevents a nearly empty extra page.

## Deterministic simulation

Use `FixedStepClock` for physics or numerical simulations:

```ts
clock.advance(frameDelta, timeScale, (step) => {
    model.step(step);
});
```

The clock caps frame delta and simulation substeps so a delayed frame does not create an uncontrolled update spiral.

## Registration

1. Export the Definition from the demo directory `index.ts`.
2. Import that Definition into the owning Lab manifest.
3. Add it to the manifest's `modules` array in display order.

Adding a demo does not modify `AppRoot`, `HomeModule`, `LabCatalogModule` or another demo.

## Dependency rules

- AppRoot imports the three Lab manifests and internal system modules.
- A Lab manifest imports Definitions from demos in that Lab.
- Definition imports Module.
- Module imports ViewModel and View.
- ViewModel imports the demo-local Model boundary, Types, presets and application services.
- View imports Types, ViewModel contracts and Cocos UI infrastructure.
- Renderer imports Cocos rendering infrastructure and domain display types.
- Model imports only demo Types or other pure domain utilities.
- Demos do not import other demos.
- Lab `shared/` code does not depend on a specific demo.

## Cleanup rules

- Create visible nodes below the supplied module root.
- Release controllers, timers and subscriptions during unmount.
- Store user parameters with a demo-specific storage key.
- Use `update(dt)` only for active frame work; `ModuleHost` stops it while paused or in the background.
- Remove superseded files and compatibility names after a migration.
- Commit TypeScript files and their Cocos Creator `.meta` files together.
- Throw runtime errors instead of swallowing them; the application overlay isolates the failed module and offers a route home.
