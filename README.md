# Cocos Lab

Cocos Lab is a cross-platform collection of code-generated interactive works built with Cocos Creator 3.8.8.

The application may contain games, simulations, mathematical visualizations, generative art, shaders, music interactions and tools. Visible content is generated at runtime with TypeScript, geometry and shaders rather than imported image or model assets.

## Architecture

- `Bootstrap` connects the active scene UI to the persistent application core.
- `AppRoot` owns cross-scene services and survives scene changes.
- `NavigationService` serializes transitions and owns module cleanup.
- `ModuleRegistry` is the catalog used by the generated home screen.
- Feature modules implement `mount()` and `unmount()`; optional capabilities such as pause or reset are separate interfaces.
- Asset Bundles will be introduced only when a feature needs an independent loading or deployment boundary.

Dependency direction:

```text
Cocos Engine
    ↑
Application Core
    ↑
Feature Modules
```

Feature modules must not depend on each other.

## Run the current shell

1. Pull the `cocoslab` branch.
2. Open the project with Cocos Creator 3.8.8.
3. Create and save a 2D scene named `Boot`.
4. Create a UI Canvas using Creator's UI menu so its UI Camera is configured correctly.
5. Attach `assets/app/bootstrap/Bootstrap.ts` to the Canvas.
6. Save the scene and run Browser Preview.

The first screen is generated entirely by code. Open **Architecture Check** to verify navigation and cleanup, then return to the home screen.

Creator will generate `.meta` files for newly imported source files on the first project import. Those `.meta` files and the saved Boot scene must be committed because they contain stable Cocos UUID references.

## Version control

Committed:

- TypeScript and shader source
- scene entry files
- Cocos `.meta` files
- project settings

Ignored:

- `library/`
- `temp/`
- `local/`
- `profiles/`
- `build/`
- `node_modules/`

Web builds are generated outside Git and deployed as static files to Cloudflare Pages.
