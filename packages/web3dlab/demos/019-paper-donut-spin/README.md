# 019 Toroidal Flow Atlas

An interpretable reconstruction of toroidal motion using parameterized vector fields and numerical streamline integration, inspired by Matt Dennie's visual study:

- Source: https://x.com/Matt_Dennie/status/2075980130254782975?s=20
- This demo does not claim to reproduce the author's unpublished equations or source code.

## Model

The simulation state uses toroidal volume coordinates `(u, v, rho)`:

```text
x = (R + rho cos(v)) cos(u)
y = rho sin(v)
z = (R + rho cos(v)) sin(u)
```

The velocity field combines toroidal and poloidal motion, radial shear, `P:Q` resonance, radial pinch, oscillation, and a deterministic perturbation. A fixed-step RK4 integrator generates every streamline. A fixed seed produces identical buffers.

## Rendering

- Worker integration keeps parameter recomputation outside the render thread.
- All trajectories are expanded into one merged `LineSegments` geometry.
- Static positions remain on the GPU; a shader moves bright heads and fading trails with `aPathT`.
- A transparent structural shell and a Fresnel layer reveal the torus boundary without hiding the volume.
- Performance, Balanced, and Cinematic quality presets use `360x160`, `720x240`, and `1100x320` streamline/sample budgets.

## Controls

- **Experiment** selects a field topology, numerical quality, and deterministic seed.
- **Dynamics** exposes the four parameters with the clearest visual meaning.
- **Appearance** changes GPU trail playback and shell visibility.
- **View** controls automatic orbiting and pause.
- **Actions** randomize the seed, copy a restorable URL, or reset defaults.

Run the project with the repository's normal development command and open `/studio/effects/web3d/toroidal-flow-atlas`.
