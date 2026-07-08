# Gradient Atlas

Gradient Atlas is a portfolio-grade gradient preset lab for the unified Studio app. It upgrades the uiGradients browsing idea into a designer workflow: preview, inspect, tag, favorite, copy, export, and save gradients locally.

## Route

- Studio page: `http://127.0.0.1:3212/studio/gradient-atlas`

## Run

```bash
pnpm install
pnpm run dev:web
```

For the full local Studio with the library sync API:

```bash
pnpm run dev
```

## Features

- Full-screen animated gradient preview with grain, glow, and vignette overlays.
- 120 built-in gradient presets sourced from uiGradients data.
- Search by gradient name, HEX value, source, or generated tag.
- Tag filters generated from HSL hue, saturation, and lightness rules.
- Previous, next, random, favorite, direction toggle, copy CSS, and PNG export controls.
- Inspector exports CSS, Tailwind config, CSS variables, React inline style, and JSON.
- Custom gradient form with localStorage persistence.
- Favorites, custom gradients, selected preset, and recent browsing are persisted in localStorage.
- Responsive layout that prioritizes preview and copy/export controls on mobile.

## Data And Attribution

The seed gradient names and colors are based on the public uiGradients `gradients.json` structure, where each preset includes a `name` and `colors` array.

Attribution: Inspired by uiGradients. Gradient data source can be attributed if reused: <https://github.com/Ghosh/uiGradients>.

## Main Files

- `src/App.tsx`: state orchestration, persistence, copy/export actions, and page composition.
- `src/data/gradients.ts`: typed preset data and source attribution metadata.
- `src/utils/gradient.ts`: gradient CSS generation, code snippets, HSL tagging, contrast, and local parsing helpers.
- `src/components/GradientCanvas.tsx`: full-screen animated background preview.
- `src/components/GradientLibrary.tsx`: searchable/filterable preset browser.
- `src/components/GradientInspector.tsx`: code export panel and custom gradient form.
- `src/components/Toolbar.tsx`: core interaction controls.
- `src/components/CaseStudy.tsx`: portfolio explanation section.
