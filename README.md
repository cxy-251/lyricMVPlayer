# Cocos Lab

Cocos Lab is a cross-platform collection of code-generated interactive works built with Cocos Creator 3.8.8.

The catalog can contain games, simulations, mathematical visualizations, generative art, shaders, music interactions and tools. Visible content is generated at runtime with TypeScript, geometry and shaders.

## Runtime architecture

```text
Boot scene
└── Canvas
    └── AppShell
        ├── ContentLayer
        ├── NavigationLayer
        └── OverlayLayer

Persistent AppRoot
├── ModuleRegistry
├── NavigationService
├── ModuleHost
├── ViewportService
├── InputService
├── StorageService
└── AppState
```

`Bootstrap` finds the active Canvas and attaches it to the persistent `AppRoot`. Its exact scene-node location does not determine the application layout.

`ModuleHost` gives every work an isolated root node and manages its mount, frame updates, pause state, reset behavior and cleanup. Navigation transitions are serialized so two modules cannot mount into the same host concurrently.

`AppShell` separates work content from application navigation and error overlays. Responsive layout data, safe-area insets and orientation changes are distributed through `ViewportService`.

## Module model

Every work exports a `ModuleDefinition` containing its catalog metadata and factory:

```ts
{
    id,
    title,
    description,
    category,
    tags,
    capabilities,
    status,
    order,
    create,
}
```

The required runtime lifecycle is:

```ts
mount(context)
unmount()
```

Modules may additionally implement `update(dt)`, `pause()/resume()` and `reset()`. The application navigation bar derives its controls from the module capability declaration.

Feature modules depend on application contracts and shared services. Feature modules do not depend on each other.

## Current modules

- **Parametric Curve Lab** — an animated, adjustable Lissajous field that validates frame updates, responsive layout, saved settings, pause, reset and cleanup.
- **Architecture Check** — a live view of the application-shell and module-host responsibilities.

## Run

1. Pull the `cocoslab` branch.
2. Open the project with Cocos Creator 3.8.8.
3. Wait for Creator to import new TypeScript files and generate their `.meta` files.
4. Open the existing `Boot` scene.
5. Run Browser Preview.

Keyboard actions:

- `Escape`: return to the catalog
- `Space`: pause or resume the active module
- `R`: reset the active module

Creator-generated `.meta` files are committed because they preserve stable resource UUIDs.

## Version control

Committed source includes TypeScript, shaders, scene entry files, `.meta` files and project settings.

Generated directories remain ignored:

- `library/`
- `temp/`
- `local/`
- `profiles/`
- `build/`
- `node_modules/`

Web builds are produced from the `cocoslab` branch and deployed as static files.
