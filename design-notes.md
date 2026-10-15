# Design Notes

## Core Design Decisions

### 1. Canvas 2D First
- **Why**: Broad browser compatibility, simple segment-based trail rendering, low memory overhead, and predictable performance.
- **Rejected alternatives**: WebGL was considered for massive particle counts, but Canvas 2D is sufficient for the target ranges (benchmarked up to 2000 particles) and simpler to keep deterministic in behaviour. WebGL would introduce shader complexity and platform-dependent rendering details.

### 2. Fixed Timestep
- **Why**: Ensures simulation is framerate-independent and reproducible. Same seed + same config always produces identical state evolution.
- **Rejected alternatives**: Variable timestep tied to `requestAnimationFrame` delta causes non-determinism and can introduce numerical instability depending on frame rate.

### 3. Deterministic Core, Isolated from DOM
- **Why**: The core (`core/`) is pure (no DOM, no timers, no Canvas API). This makes it testable in Node, enables golden tests, and guarantees the simulation logic is reference-exact.
- **Rejected alternatives**: Mixing rendering concerns into simulation couples logic to environment and makes cross-platform deterministic testing harder.

### 4. SoA Memory Layout with Typed Arrays
- **Why**: `Float32Array`s for positions/ages/lives and a parallel array for colours give cache-friendly access and lower GC pressure. Good performance for step loops.
- **Rejected alternatives**: Array of objects per particle is easier to mutate but slower for large counts.

### 5. Counter-Based PRNG
- **Why**: All randomness comes from `core/hash.js` with counter-style indexing `(seed, particleIndex, respawnCount, channel)`. This is deterministic, portable, and allows stable respawning without hidden state.
- **Rejected alternatives**: `Math.random()` is non-deterministic and not reproducible across runs/platforms. A global PRNG state is order-dependent and harder to reason about.

### 6. Deterministic Noise (Simplex)
- **Why**: 2D simplex noise with a deterministic seed offset derived from hash gives coherent flow fields while remaining reproducible.
- **Rejected alternatives**: Value noise is simpler but lower quality; unseeded noise breaks determinism.

### 7. Restart-From-0 with Catch-Up Policy
- **Why**: On parameter changes (seed/config), the engine restarts from initial state and catches up to the target step count deterministically. This avoids complex state migration and guarantees the "same inputs → same outputs" invariant holds.
- **Rejected alternatives**: Live parameter interpolation can create ambiguous states and makes golden tests harder. Attempting to preserve trajectories across incompatible config changes breaks determinism.

### 8. Respawn Policy
- **Why**: When a particle dies or goes out of bounds, it respawns at a new random position with new life/colour. The step order is well-defined (sample → angle → move → age → respawn/emit). Respawning happens without drawing a segment for that transition.
- **Rejected alternatives**: Wrapping around edges or clamping velocity changes the flow field appearance but can create artefacts; respawn-on-death keeps lifetime distribution controlled.

### 9. Host/Render/UI Separation
- **Why**: `host/main.js` owns the loop and coordinates; `render/` draws; `ui/controls.js` builds controls; `core/` is environment-agnostic. This separation improves maintainability and testability.
- **Rejected alternatives**: Tightly coupling these layers makes it harder to test the core in Node and harder to swap renderers later.

### 10. Golden Tests for Determinism
- **Why**: A stored hash of typed arrays after N steps from fixed seed (FNV-1a over float32 bytes) catches any regression that breaks reference-exact behaviour.
- **Rejected alternatives**: Visual regression is flaky across platforms; state-level hashing is precise and machine-checkable.

### 11. Worker + OffscreenCanvas Path (Future)
- **Why**: Moving simulation to a Web Worker with OffscreenCanvas keeps the main thread free for UI. The core is already DOM-free, so it can run in a worker with minimal changes.
- **Status**: Not implemented in first release; architecture supports it (core has no DOM deps).

### 12. Honest Limitations: WebGL2 Parity / Device Variability
- **Canvas 2D vs WebGL**: Canvas 2D rendering is not guaranteed to produce pixel-identical output across browsers/devices. WebGL would offer more control but introduces driver variability, shader compilation differences, and precision issues. Neither path gives perfect cross-device pixel parity.
- **Device variability**: GPU drivers, Canvas 2D backends (Skia, Direct2D, Cairo), and OS compositors all affect final pixels. The simulation state is deterministic; rendering is a best-effort mapping.

### 13. Export Width Caps
- **PNG/2× PNG**: Limited by canvas size constraints (browser-dependent, typically ~32k–64k px max dimension). Large exports may fail or be clamped.
- **SVG**: Vector export avoids raster limits but file size grows with segment count (one `<line>` per segment per frame). Practical cap ~50k segments for reasonable file sizes.

## Technical Notes
- **Trail length semantics**: Treated as lifetime in steps (see `lifeValue()` in core). Particles have randomised starting ages to avoid synchronised death.
- **Field sampling**: `noiseScale` is expressed as features per 1000 world units; converted to per-unit scale internally.
- **Exports**: PNG/2× PNG/SVG supported via host/export logic; exports are derived from the current rendered state (deterministic given simulation state).
- **Config validation**: `core/config.js` clamps values to safe ranges (e.g. particle count, speed, noiseScale bounds).
