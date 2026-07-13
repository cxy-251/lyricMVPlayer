# 037 Molten Relief

`Molten Relief` renders an evolving mineral world on one full-screen plane. The fragment shader builds a shared procedural height field from animated Voronoi cells, warped strata, radial crystal blooms, ridges, and erosion. Four finite-difference samples reconstruct a surface normal, so geometry, shadow, heat, fissures, and cold edge light all respond to the same relief.

## Rendering

- Center-cropped square coordinates keep the composition stable across desktop and mobile viewports.
- A continuous time phase moves cell seeds, strata, crystal petals, and erosion without changing random seeds between frames.
- The heat gradient retains near-black red valleys before crossing crimson, orange, gold, and white-hot peaks.
- Cold blue light is restricted by slope, curvature, height, and ridge masks.
- HDR highlights feed a thresholded bloom pass; the shared renderer already caps DPR below `2` and adapts it under load.

## Controls

- `Molten Cells`, `Crystal Bloom`, and `Eroded Inferno` configure coherent material states.
- Structure controls alter the height field and therefore also alter normals and lighting.
- Hold and drag horizontally to rotate the carving light.
- Pause preserves the current phase. Randomize Seed changes the world without changing the active preset.

No textures or pre-rendered animation are used.
