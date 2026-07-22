# Module authoring

Every interactive work is registered as a `ModuleDefinition` and runs inside `ModuleHost`. The host supplies an isolated root node, viewport updates, storage, input, application state and navigation.

## Standard module shape

Use `ResponsiveModule` when a work owns a full responsive screen:

```ts
class ExampleModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'ExampleModule';

    protected onMount(): void {
        // Initialize state and reusable controllers.
    }

    protected render(viewport: ViewportSnapshot): void {
        // Rebuild layout from viewport dimensions.
    }

    update(dt: number): void {
        // Advance animation or simulation.
    }

    pause(): void {}
    resume(): void {}
    reset(): void {}
}
```

`ResponsiveModule` creates and destroys the module root, subscribes to viewport changes and releases the subscription during unmount.

## Parameters

Describe controls with a `ParameterSchema`, then construct a `ParameterController` with the module storage key. `ParameterController` validates persisted data, clamps numeric values, cycles select values and writes changes through `StorageService`.

Render the controls with `ParameterPanel`. It automatically selects a two-, three- or four-column layout and paginates controls on narrow screens.

## Deterministic simulation

Use `FixedStepClock` for physics or numerical simulations:

```ts
clock.advance(frameDelta, timeScale, (step) => {
    integrate(step);
});
```

The clock caps frame delta and simulation substeps so a delayed frame does not create an uncontrolled update spiral.

## Registration

Export one definition from the module file:

```ts
export const exampleDefinition: ModuleDefinition = {
    id: 'example-module',
    title: 'Example Module',
    description: 'Describe the interaction.',
    category: 'simulation',
    tags: ['example'],
    capabilities: ['pause', 'reset', 'settings'],
    status: 'ready',
    order: 30,
    create: () => new ExampleModule(),
};
```

Import the definition in `AppRoot.ts` and add it to `moduleRegistry.registerAll()`.

## Lifecycle rules

- Create visible nodes below the supplied module root.
- Subscribe to external events during mount and release them during unmount.
- Keep simulation state inside the module instance.
- Store user parameters through `StorageService` with a module-specific key.
- Use `update(dt)` only for active frame work; `ModuleHost` stops it while paused or in the background.
- Throw runtime errors instead of swallowing them; the application overlay isolates the failed module and offers a route home.
