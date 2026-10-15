# Browser-Based Generative Art Engine

A deterministic, fixed-timestep particle flow field engine for generative art in the browser. The simulation core is pure, deterministic, and isolated from the DOM, while the host/render/UI layers provide interactive controls and high-quality exports.

![Screenshot placeholder](assets/screenshots/screenshot.png)
*Add screenshots to `assets/screenshots/` for documentation.*

## Features

- **Deterministic core**: Pure simulation using counter-based PRNG and deterministic noise; same seed produces identical output.
- **Fixed timestep simulation**: Stable, reproducible stepping with no framerate-dependence.
- **SoA memory layout**: Particles stored in typed arrays for performance and cache efficiency.
- **Flow field**: 2D simplex noise drives particle direction.
- **Trail rendering**: Canvas 2D line segments with configurable trail length, stroke width, and opacity.
- **Restart-from-0 with catch-up policy**: Deterministic replay behaviour on parameter changes (core design preserves determinism under restarts).
- **Export options**: PNG, 2× PNG (upscaled), and SVG export support.
- **Configurable**: Seed, particle count, noise scale, speed, trail length, palette, background, and more.
- **Benchmarked**: Performance measured per-step across particle counts.
- **Accessible UI**: Basic controls with clear labelling; works in modern browsers.

## How to Run

This project uses **ES modules** and requires a local server or opening via a modern browser with module support. You cannot open `index.html` directly from the filesystem in some browsers due to CORS/module restrictions.

### Option 1: Using `npx serve` (recommended)

```bash
npx serve .
# then open http://localhost:3000
```

### Option 2: Using Python's built-in HTTP server

```bash
python -m http.server 8080
# then open http://localhost:8080
```

### Option 3: Using the included Node server script

```bash
node scripts/server.js 8080
# then open http://localhost:8080
```

### Option 4: Open via VS Code Live Server / similar

Use any local dev server of your choice. Then open the served `index.html` in a modern browser.

## Controls Explanation

Controls are injected by `ui/controls.js`. The UI provides:

- **Seed**: Base randomness source for deterministic generation.
- **Particle count**: Number of active particles (clamped to schema bounds).
- **Noise scale**: Controls flow field feature density (features per 1000 world units).
- **Speed**: Particle velocity per simulation step.
- **Trail length / lifetime**: How many steps a particle lives; affects trail persistence.
- **Stroke width / opacity**: Visual properties for rendered segments.
- **Palette**: Colour selection per particle (from configurable palette).
- **Background**: Canvas background colour.
- **Pause/Reset/New variation**: Playback control and reseeding/variation.
- **Export**: PNG, 2× PNG, SVG export buttons.

## Technical Overview

### Fixed Timestep
The simulation uses a **fixed timestep**. The core `step()` advances the simulation by one discrete time unit regardless of rendering framerate. This ensures deterministic, stable behaviour independent of display refresh rate.

### Deterministic Core
The simulation core (`core/`) is **pure and has no DOM dependencies**. It operates on typed arrays (SoA layout) and uses:
- A counter-based PRNG (`core/hash.js`) for all randomness.
- Deterministic trigonometry (`core/trig.js`) and noise (`core/noise.js`, simplex).
- Stable field sampling: `sampleField(x,y,noiseScale,noiseOffset)` produces deterministic values in `[-1,1]`.

### Noise & PRNG
- **PRNG**: Deterministic counter hash; same `(seed, particleIndex, respawnCount, channel)` yields identical values in `[0,1)`.
- **Noise**: 2D simplex noise seeded via a deterministic offset derived from the hash. This preserves cross-run reproducibility.

### Rendering
- **Canvas 2D first**: Chosen for broad compatibility, predictable performance characteristics, and straightforward segment-based trail rendering.
- **Host/Render separation**: `host/main.js` coordinates simulation and rendering loop; `render/` handles drawing. The core emits no rendering calls.

## Determinism Note (CPU Core Reference-Exact vs Preview)
- **CPU core reference-exact**: The pure simulation (core + deterministic PRNG/noise) produces byte-for-byte/array-exact results given identical inputs. The included golden test (`tests/test-core.js`) validates this with a stored FNV-1a hash.
- **Preview**: The browser runtime (host/render/UI) renders to Canvas; visual output is deterministic in values but final pixel output depends on the Canvas 2D implementation and GPU/driver details on the platform. The simulation state is reference-exact; rendering is a deterministic mapping from that state.

## Performance Notes (Benchmark Table)

Benchmarks run on Node (core simulation only) using `node bench/bench.js`. Values shown are **milliseconds per step** averaged over 50 steps:

| Particle Count | ms/step (measured) |
|----------------|--------------------|
| 100            | 0.700 ms/step      |
| 500            | 1.780 ms/step      |
| 1000           | 2.560 ms/step      |
| 2000           | 5.340 ms/step      |

These measurements reflect CPU cost of the core step (SoA arrays, noise sampling, movement, respawning) on Node.js. Actual in-browser FPS will vary with rendering overhead and device capabilities.

## Accessibility
- Controls are labelled and structured for basic keyboard navigation in the UI.
- Canvas content is non-interactive visual output; consider providing a textual/alternative view if needed for specific accessibility requirements.

## Known Limitations
- Opening `index.html` directly from the filesystem may fail due to ES module loading; use a local server.
- Determinism of rendered pixels can vary slightly across browser engines/GPU drivers (simulation state remains deterministic).
- Large particle counts increase memory and CPU cost; see benchmark table for guidance.
- Trail rendering is segment-based (Canvas 2D) rather than framebuffer accumulation in this design.

## Credits & License
Created as part of the Browser-Based Generative Art Engine project. ISC License (see `package.json`).
