# Demo21 High-Order Rubik Solver

This backend belongs only to:

`packages/web3dlab/demos/021-paper-rubiks-cube`

The 2x2 and 3x3 solvers remain in the browser. This service receives the
current 4x4, 5x5, or 6x6 `URFDLB` facelet state and performs an exact
bidirectional state search. It never reads or reverses the demo's move history.

The solver first searches every layer to depth 6, then searches up to eight
involved layer families to depth 8. Broader or deeper states go directly to
the current 8gwifi NxN reduction pipeline instead of spending a large local
search budget first. The pipeline solves centres, pairs edges, and finishes
the reduced 3x3 state. Only the `URFDLB` sticker string is sent.

Every returned reduction path is replayed against demo21's own permutation
model before the API accepts it. The frontend starts animating only after a
complete, locally verified path exists. Move history order is never sent or
reversed. Transient reduction-service failures are retried once. Short states
use exact shortest-path search; deeper reduction solutions prioritize reliable
completion and are not claimed to be globally shortest.

Middle-slice turns move the complete visible slice, including its centre
stickers. On odd cubes the frontend first applies the shortest whole-cube
orientation correction before solving. Reduction paths are accepted when all
six faces are uniform, even if the final colour orientation is globally
rotated.

## Runtime

The service uses the repository's root `uv` environment and Python 3.12. It
has no nested `pyproject.toml`, no private virtual environment, no lookup-table
downloads, and no dependency on the legacy `rubiks-cube-NxNxN-solver` project.

The regular Vite startup does not launch Python. Clicking **Smart Solve** for a
4x4, 5x5, or 6x6 cube asks the demo21-only Vite bridge to start the service on
`127.0.0.1:3213`. Leaving demo21 stops the process. The 2x2 and 3x3 buttons
remain browser-only.

To run the backend independently from the repository root:

```bash
uv run python backend/web3dlab-rubiks-solver/server.py
```

`POST /api/web3dlab/rubiks/solve` accepts `{dimension, state}`.
