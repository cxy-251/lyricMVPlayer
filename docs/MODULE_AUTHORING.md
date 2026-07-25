# Module authoring

Every interactive work is registered as a `ModuleDefinition` and runs inside `ModuleHost`. The host supplies an isolated root node, viewport updates, storage, input, application state and navigation.

## Standard feature directory

Each visible feature uses one domain name and one directory:

```text
feature-name/
├── FeatureDefinition.ts
├── FeatureModule.ts
├── FeatureViewModel.ts
├── FeatureModel.ts
├── FeatureView.ts
├── FeatureTypes.ts
├── FeaturePresets.ts      # optional
└── index.ts
```

Use the real domain name in every file and class. A Lissajous feature uses `LissajousModule`, not a broader name such as `ParametricCurveModule`.

Read a feature in this order:

```text
Definition → Module → ViewModel → Model → View
```

## Layer responsibilities

### Definition

Contains catalog metadata and creates the Module. It does not contain runtime state, drawing or domain calculations.

### Module

Adapts the feature to CocosLab lifecycle methods:

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

### View

Owns Cocos nodes, responsive layout, labels, controls and drawing. It receives prepared View state and forwards user actions to the ViewModel through the Module.

### Types

Contains feature-specific contracts shared between Model, ViewModel and View. Keep types close to the feature rather than adding unrelated global interfaces.

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

Export the definition from the feature directory `index.ts`, import it in `AppRoot.ts`, and add it to `moduleRegistry.registerAll()`.

## Dependency rules

- Definition imports Module.
- Module imports ViewModel and View.
- ViewModel imports Model, Types, presets and application services.
- View imports Types, ViewModel contracts and Cocos UI infrastructure.
- Model imports only feature Types or other pure domain utilities.
- Feature modules do not import other feature modules.

## Cleanup rules

- Create visible nodes below the supplied module root.
- Release controllers, timers and subscriptions during unmount.
- Store user parameters with a feature-specific storage key.
- Use `update(dt)` only for active frame work; `ModuleHost` stops it while paused or in the background.
- Remove superseded files and compatibility names after a migration.
- Commit TypeScript files and their Cocos Creator `.meta` files together.
- Throw runtime errors instead of swallowing them; the application overlay isolates the failed module and offers a route home.
