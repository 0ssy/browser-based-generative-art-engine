# Fluxgarden — Browser-Based Generative Art Engine

## Project plan — 10 days

### Project summary

Build a polished, browser-based generative-art playground using **HTML, CSS, and JavaScript**. The app creates animated, organic visuals on an HTML canvas. Users can tune generation parameters in real time, pause or resume the animation, generate a new variation, and export an image. The project runs entirely in the browser: **no backend, account, build service, or server-side rendering is required**.

### Why this project

This project demonstrates a different set of skills from a conventional data-dashboard web app. It emphasizes visual programming, mathematical and procedural techniques, animation, interaction design, rendering performance, and a strong creative presentation. The final result should feel like a small, usable creative tool—not merely a canvas experiment.

### Chosen technical direction

Use a **particle flow field driven by seeded 2D simplex or Perlin-style noise**.

Each particle moves through a vector field derived from noise. Its path is drawn as a short line segment, producing flowing, organic structures over time. This direction is selected instead of an L-system because it naturally supports continuous animation, particle-count controls, live parameter changes, and visible performance work within the 10-day schedule.

- **Rendering:** Canvas 2D API for the first release. WebGL is explicitly out of scope unless Canvas 2D cannot meet the performance target after profiling.
- **Animation:** `requestAnimationFrame`, with elapsed-time-based movement so speed is not tied to display refresh rate.
- **Noise:** Use a small, clearly documented implementation or a lightweight dependency. Avoid pulling in a large creative-coding framework for this focused project.
- **Randomness:** Use a seeded pseudo-random number generator. The seed enables repeatable results and shareable presets.
- **Persistence:** No server. State is held in browser memory; optional URL parameters encode a compact preset.
- **Export:** PNG export from the canvas, with a defined behavior for transparent or opaque backgrounds.

### Product goals

1. Produce distinctive, organic artwork from a compact set of controllable parameters.
2. Make controls understandable and responsive, with no hardcoded-only settings.
3. Keep animation smooth at ordinary desktop sizes and usable on smaller screens.
4. Let users pause, resume, reset, generate a new seed, and save an image.
5. Make the project easy to run, understand, and extend using a clear README and maintainable code.

### Out of scope for the 10-day version

- User accounts, cloud storage, galleries, social feeds, or server-side rendering.
- Full-featured layer editing, undo/redo history, or a complex node graph.
- WebGL shaders, 3D rendering, or a mobile-native application.
- Guaranteed 60 FPS on every device, every canvas size, and every parameter combination. The goal is a stable target configuration plus sensible limits and graceful degradation.
- A multi-generator platform. The first release focuses on one high-quality particle-flow generator.

---

## Definition of done

The project is complete when all of the following are true:

- The application opens locally in a modern browser and displays a rendered generative artwork without requiring a backend.
- The canvas resizes to its container and handles device-pixel ratio without blurry output or excessive memory use.
- The animation starts, pauses, resumes, resets, and responds to the selected controls.
- The same seed and same parameter set produce a repeatable initial composition, to the extent permitted by the chosen implementation.
- The user can change the noise scale, particle count, trail/line appearance, and palette without editing source code.
- Invalid, missing, or out-of-range control values are prevented or safely normalized.
- The app remains usable at the target viewport sizes; controls do not cover the artwork or become inaccessible.
- PNG export works and produces an image at the intended resolution with the selected background behavior.
- A representative normal configuration runs smoothly on the development machine, and a heavier configuration has documented practical limits or a graceful performance fallback.
- The README contains setup instructions, controls, implementation notes, screenshots, known limitations, and project structure.
- The source is organized, commented where the reasoning is non-obvious, and pushed to the chosen Git remote.

## User experience and functional requirements

### Main screen

- A large artwork area is the visual focus.
- A compact control panel is available without obscuring the artwork; on narrow screens it may move below or above the canvas.
- Controls have visible labels, current values, and sensible ranges.
- A status area can show whether the animation is running and, optionally, an approximate frame rate or particle count.
- Essential interactions are usable by keyboard and pointer; form elements retain visible focus states.

### Core controls

1. **Noise scale** — Controls the spatial frequency of the flow field. A lower frequency produces broader curves; a higher frequency produces tighter variation.
2. **Particle count** — Controls the number of simultaneously active paths. Use a safe maximum to avoid freezing lower-powered devices.
3. **Movement speed** — Controls how far particles move per unit time.
4. **Trail / stroke length** — Controls the distance represented by each movement segment or the visual persistence of trails, depending on the rendering approach.
5. **Stroke width / opacity** — Controls line weight and accumulation.
6. **Color palette** — Selects from a small curated set of palettes. A custom palette editor is optional and should not delay core functionality.
7. **Seed** — Accepts or displays a seed. A “New variation” action selects a new seed; reusing a seed should reproduce the same setup.
8. **Animation controls** — Pause/resume and reset or clear the canvas.
9. **Export** — Save the current artwork as PNG.

### Interaction behavior

- Controls should update the artwork without a page refresh.
- Expensive changes—such as particle count or seed—may trigger a controlled reset or reinitialization. The interface should make this behavior predictable.
- Small tuning changes should not unexpectedly erase accumulated art unless the chosen design explicitly resets the canvas; choose and document consistent behavior.
- When animation is paused, parameter changes should still be visible after an explicit redraw or safe reinitialization.
- Export should be available while paused and running. If the canvas is scaled for high-resolution export, restore the on-screen rendering state afterward.

---

## Technical design

### Suggested project structure

```text
generative-art-engine/
├── index.html
├── styles.css
├── src/
│   ├── main.js             # App initialization and UI wiring
│   ├── canvas.js           # Canvas sizing, DPR, clear/fill, export helpers
│   ├── engine.js           # Animation lifecycle and render orchestration
│   ├── particles.js        # Particle creation, updates, bounds and respawn
│   ├── noise.js            # Noise implementation or adapter
│   ├── random.js           # Seeded pseudo-random number generator
│   ├── palettes.js         # Named palette definitions and selection
│   ├── controls.js         # Read/write/validate control state
│   └── config.js           # Defaults, ranges and app constants
├── assets/
│   └── screenshots/        # README screenshots
├── README.md
└── LICENSE                 # Optional; add only after selecting a license
```

This is a suggested structure, not a requirement to create every file on Day 1. Keep the first implementation simple; split modules once their responsibilities become clear.

### Core data model

Represent the user’s settings in one configuration object rather than reading DOM values throughout the rendering loop. For example:

```js
{
  seed: 18427,
  particleCount: 1200,
  noiseScale: 0.004,
  speed: 1.0,
  strokeWidth: 1.2,
  opacity: 0.08,
  palette: "deep-ocean",
  background: "#0b1020"
}
```

Values above are starting examples only; tune actual ranges through testing. Validate and clamp values at the UI/config boundary, not repeatedly in the hottest part of the frame loop.

### Rendering lifecycle

1. Initialize the canvas and controls.
2. Measure the canvas container and set CSS dimensions.
3. Set backing-store dimensions using CSS size multiplied by device-pixel ratio (DPR), with a sensible DPR cap to limit memory and fill cost.
4. Initialize the seeded random generator and create particle state.
5. Start one `requestAnimationFrame` loop.
6. For each frame, compute elapsed time, update particles, draw their segments, and schedule the next frame only while animation is enabled.
7. On resize, update canvas dimensions and apply a deliberate policy: preserve the visible artwork if practical or clear and rebuild the composition. Document the selected policy.
8. On teardown or restart, ensure only one active animation loop remains.

### Performance principles

- Avoid unnecessary DOM reads and writes inside the animation loop.
- Avoid allocating new objects, arrays, or style strings for every particle on every frame when practical.
- Cache palette data and convert color formats outside the hot loop.
- Keep particle count, canvas pixel dimensions, and DPR within safe limits.
- Use frame delta time and clamp very large deltas after a background-tab pause to prevent particles from jumping across the canvas.
- Profile before adding complexity. Consider an offscreen canvas, reduced update cadence, or lower-resolution rendering only if profiling identifies a real bottleneck.
- If a performance mode is added, make it understandable and reversible; do not silently change the artwork quality without a clear reason.

### Accessibility and responsive behavior

- Use semantic buttons, labels, and form controls.
- Ensure controls are keyboard-operable and have clear focus indicators.
- Do not rely on color alone to communicate state; label pause/running status.
- Respect `prefers-reduced-motion` by providing a paused or reduced-motion default/option. The user can still manually start the animation.
- On smaller screens, stack the controls and canvas rather than squeezing controls into unreadable widths.
- Verify text and controls have readable contrast against the UI background.

---

# 10-day implementation schedule

## Day 1 — Scope, repository, and canvas foundation

**Goal:** Establish the project and display a correctly sized canvas.

### Tasks
- Create the repository and initial project files.
- Decide whether to use plain script tags or ES modules; prefer ES modules if the project structure is split into modules.
- Add a minimal page structure: app shell, title/short description, artwork container, and placeholder controls area.
- Add baseline CSS for full viewport use, responsive layout, typography, and a canvas that fills its container.
- Initialize the canvas through JavaScript and obtain a 2D rendering context.
- Implement a resize handler based on the canvas container’s measured size.
- Set intrinsic pixel dimensions using CSS size × DPR, with a cap (for example, DPR 2) to limit memory.
- Choose initial policies for resize behavior and high-DPI rendering; record the choice in code comments or a development note.
- Confirm that the browser console has no errors and that resizing the browser does not distort the canvas unexpectedly.

### Deliverable
A repository with a responsive page and crisp, correctly sized canvas.

### Acceptance checks
- The canvas is visible at desktop and narrow viewport widths.
- The backing-store resolution is appropriate for the displayed size and device pixel ratio.
- Resizing the viewport updates the canvas without creating duplicate handlers or animation loops.

## Day 2 — Drawing primitives and animation loop

**Goal:** Prove that the rendering pipeline works reliably.

### Tasks
- Implement a single animation-loop owner using `requestAnimationFrame`.
- Add start/stop lifecycle functions and ensure repeated starts do not create multiple loops.
- Track elapsed time with the frame timestamp; clamp unusually large frame deltas after tab suspension.
- Implement small drawing helpers, such as line segment, polyline, circle/point, and clear/fill background.
- Support stroke color, width, and alpha without scattering style mutations throughout the app.
- Add a simple temporary visual test (for example, moving dots or lines) to verify updates and cleanup.
- Decide whether the canvas clears every frame, uses a translucent background fill for trails, or retains accumulated strokes. Document and test the selected visual approach.
- Add a basic pause/resume button if time permits; otherwise preserve it for the interactive-controls milestone.

### Deliverable
A stable draw loop with reusable primitives and a visible test animation.

### Acceptance checks
- Start, stop, and restart behavior is reliable.
- The loop does not multiply after repeated button clicks or resize events.
- Drawing is crisp and uses the expected alpha and stroke width.

## Day 3 — Seeded randomness and noise field

**Goal:** Build the mathematical foundation for organic flow.

### Tasks
- Choose either a small noise implementation or a lightweight, well-maintained dependency; record its source and license if applicable.
- Implement or adapt a seeded pseudo-random number generator.
- Add a deterministic initialization path so a given seed creates the same starting particle distribution.
- Implement a 2D noise sampling function or a simple adapter around the chosen noise library.
- Visualize the noise as a debug field (for example, direction indicators or a grayscale heat map) before adding the full particle system.
- Verify that changing noise scale changes the field’s spatial structure in an understandable way.
- Handle the seed as a validated integer or normalized string; define behavior for blank or invalid seed input.

### Deliverable
Seeded randomness and a noise field that can be inspected independently.

### Acceptance checks
- The same seed yields repeatable debug output.
- Different seeds produce visibly different fields.
- Noise scale changes the field without producing invalid values or console errors.

## Day 4 — Particle flow-field generator

**Goal:** Render the first complete generative artwork.

### Tasks
- Define a particle data structure with position, previous position (if required), lifetime/age, and any per-particle visual variation.
- Initialize particles across the canvas using the seeded random generator.
- Sample the noise field at each particle’s position and convert the sample to a movement direction or vector.
- Update position using elapsed time and configured speed.
- Draw each movement as a line segment or trail, using controlled stroke color, width, and opacity.
- Define particle boundary behavior: wrap, respawn, or recycle when leaving the canvas. Choose one behavior and test that it does not introduce distracting artifacts.
- Define reset behavior for a new seed and for canvas resize.
- Add a basic default palette and a background color that gives the artwork sufficient contrast.
- Remove debug overlays from the normal view, retaining a debug switch only if useful.

### Deliverable
The first visually coherent animated flow-field artwork.

### Acceptance checks
- Particles move continuously and follow the noise field rather than appearing random in every frame.
- The composition remains visible over time and does not immediately saturate into an unreadable block.
- Resetting with the same seed and configuration recreates the same initial setup.

## Day 5 — User controls and live tuning

**Goal:** Let a user shape the artwork without editing code.

### Tasks
- Build a control panel with labeled inputs for noise scale, particle count, speed, stroke width, opacity/trail strength, palette, and seed.
- Add pause/resume, reset/clear, new variation, and export buttons; export may be a placeholder until Day 9.
- Define minimum, maximum, and step values for numeric controls. Display current values where sliders alone are ambiguous.
- Centralize control values in an application state object.
- Wire changes into the engine with explicit update policies: update-in-place where safe; regenerate/reset when a value changes the structure of the simulation.
- Debounce expensive rebuilds only if rapid slider movement causes perceptible lag. Keep simple slider feedback immediate.
- Add “New variation” behavior that picks a new seed and reinitializes the composition.
- Add keyboard focus styling, button states, and a visible running/paused label.
- Check control layout at desktop and mobile widths.

### Deliverable
A usable control panel connected to live generator state.

### Acceptance checks
- Every core control has a visible effect and stays within valid bounds.
- A user can pause, resume, reset, and generate a new variation.
- Slider changes do not create multiple loops or freeze the page.
- Controls remain reachable and readable on a narrow screen.

## Day 6 — Palette system, preset behavior, and interface polish

**Goal:** Improve creative range and make parameter behavior coherent.

### Tasks
- Create several curated palettes with names and multiple colors rather than one hardcoded stroke color.
- Define how palette colors are assigned: per particle, by age, by position, or by a deterministic palette index. Pick one initial rule and keep it visually coherent.
- Add palette switching without an unnecessary full-page reload. Decide whether switching clears the canvas or changes only future strokes, then make the behavior clear in the UI.
- Tune default values so the initial screen looks intentional immediately.
- Add a small set of named presets (optional but recommended) if they can be implemented without delaying core controls. A preset should define seed and relevant generation settings together.
- If presets are not added, use this day to improve slider ranges and test combinations instead.
- Review text, spacing, contrast, mobile layout, focus states, reduced-motion behavior, and button labels.
- Capture an early screenshot and note remaining visual issues.

### Deliverable
A more expressive generator with curated palettes and a cohesive control experience.

### Acceptance checks
- Each palette is visually distinct and has readable contrast against the background.
- Palette changes behave consistently with the chosen redraw/accumulation policy.
- Defaults create an attractive composition without requiring user tuning.

## Day 7 — Animation quality and performance profiling

**Goal:** Make animation feel smooth and diagnose expensive work.

### Tasks
- Profile the application with browser developer tools at the default settings and a stress configuration.
- Measure representative frame time or approximate FPS; do not infer performance from visual impressions alone.
- Identify whether cost comes from particle updates, canvas fill rate, style changes, allocations, noise sampling, or UI work.
- Improve the actual bottleneck before adding optimization complexity.
- Batch style work where possible (for example, group particles by color/width if visual quality allows).
- Avoid repeated layout reads, avoid logging inside the animation loop, and reduce avoidable per-frame allocations.
- Ensure the simulation uses elapsed time and remains reasonably consistent across refresh rates.
- Verify behavior after switching tabs and returning; clamp excessive delta time and avoid a large catch-up jump.
- Set practical particle-count and DPR limits based on testing.

### Deliverable
A measured performance baseline and a smoother animation loop with identified limits.

### Acceptance checks
- Default settings meet the project’s chosen smoothness target on the development machine.
- Stress settings degrade predictably rather than locking up the browser.
- No known duplicate-loop or runaway-particle issue remains.

## Day 8 — Performance refinements, responsive testing, and failure handling

**Goal:** Stabilize the app across common display sizes and edge cases.

### Tasks
- Re-test at small mobile, tablet, and desktop viewport sizes.
- Test browser zoom and high-DPR behavior; confirm memory use remains reasonable for the canvas dimensions.
- Check the resize policy while the animation is running and paused.
- Add an optional low-performance mode or adaptive particle cap only if measurements justify it. Keep the behavior visible and predictable.
- Evaluate an offscreen canvas only if profiling demonstrates a benefit; otherwise document that it was considered and not needed.
- Validate handling of invalid URL parameters, invalid seed input, unavailable canvas context, and export errors.
- Avoid silent failures: show a concise message if canvas initialization or export cannot proceed.
- Test `prefers-reduced-motion` behavior and keyboard-only control usage.
- Remove dead code, temporary debug output, and unused dependencies.

### Deliverable
A responsive, resilient application with known performance boundaries.

### Acceptance checks
- Resizing does not break the rendering state or controls.
- Invalid values are normalized or rejected safely.
- The app remains navigable and understandable with keyboard input and reduced motion.

## Day 9 — PNG export and shareable presets

**Goal:** Make artwork easy to save and reproduce.

### Tasks
- Implement PNG export using `canvas.toBlob()` where supported, with an appropriate fallback if needed. This avoids unnecessarily encoding large images as a long in-memory data URL.
- Create a downloadable link with a meaningful filename, such as `flow-field-<seed>.png`.
- Confirm export includes the intended background. If transparency is supported, expose it as an explicit option; otherwise use the selected opaque background.
- Ensure the exported image uses the intended canvas resolution. If adding high-resolution export, render to a temporary canvas at a controlled scale and avoid changing the on-screen canvas state.
- Test export while paused, while running, after resize, and after changing the palette.
- Implement optional shareable URL parameters for seed and selected settings. Keep the URL compact and validate all values on load.
- Add a “Copy preset link” action only if clipboard access works in the local/browser context; provide a fallback when permission is unavailable.
- Ensure URL-loaded settings cannot request unreasonable particle counts or canvas sizes.

### Deliverable
Working PNG download and, if time allows, a validated shareable preset link.

### Acceptance checks
- Downloaded PNG opens in a standard image viewer and matches the visible artwork and intended background.
- Export does not freeze or permanently resize the application canvas.
- Shared settings load predictably and are clamped to safe ranges.

## Day 10 — Final polish, documentation, and release

**Goal:** Ship a complete, presentable project.

### Tasks
- Run through the full definition-of-done checklist from a clean browser session.
- Fix high-impact visual defects, confusing control labels, layout issues, and console errors.
- Select a strong default seed/palette/settings combination for the first impression.
- Add final screenshots to the README. Capture the application itself, not a mockup; use representative desktop and mobile views if possible.
- Write the README sections listed below.
- Verify setup instructions by following them from a fresh clone or clean project directory.
- Check that no secrets, private files, large generated binaries, or unrelated temporary files are committed.
- Add a license only if the project owner intends to choose one; do not assume a license.
- Commit changes with a clear message and push the finished project to the configured remote.
- Record remaining limitations honestly, especially browser/device performance variability and any unimplemented optional features.

### Deliverable
A polished, documented, version-controlled project ready for demonstration.

### Acceptance checks
- A new reader can understand the project and run it by following the README.
- Screenshots accurately represent the current application.
- The final repository contains the intended source files and no accidental artifacts.
- The pushed commit exists on the configured Git remote.

---

## README checklist

The README should include:

1. **Project name and short description** — Explain that it is a browser-based, client-side generative art engine.
2. **Screenshot(s)** — Include one clear hero screenshot and optionally a mobile view.
3. **Features** — Noise-driven particle flow, live controls, animation controls, palettes, seed behavior, and PNG export.
4. **How to run** — State whether users can open `index.html` directly or need a local static server (ES modules and browser security behavior may make a local server preferable).
5. **Controls** — List each control and its effect.
6. **Technical overview** — Describe canvas sizing, noise field, particle movement, seeded randomness, and rendering loop.
7. **Performance notes** — Mention tested browser/device assumptions, practical particle limits, and any adaptive behavior.
8. **Accessibility and responsive behavior** — Document keyboard controls, reduced-motion handling, and mobile layout.
9. **Known limitations** — Be direct about what the project does not do.
10. **Credits and licensing** — Credit any external noise implementation, font, image, or other dependency and preserve its license notices.

## Test checklist

### Functional
- [ ] Loads with a visible generated composition.
- [ ] Noise scale changes the generated structure.
- [ ] Particle count visibly changes density and stays within limits.
- [ ] Speed changes movement behavior.
- [ ] Palette selection changes the artwork as described.
- [ ] Seed can be reused and a new variation can be generated.
- [ ] Pause, resume, reset, and clear behavior are consistent.
- [ ] PNG export works and uses a meaningful filename.
- [ ] URL preset, if implemented, rejects or clamps invalid parameters.

### Rendering and performance
- [ ] Canvas remains sharp at supported DPR values.
- [ ] Resize behavior is deliberate and does not create duplicate loops.
- [ ] Large frame deltas do not cause particles to jump unexpectedly.
- [ ] Default and stress configurations have been profiled.
- [ ] Particle count and canvas resolution have sensible caps.

### Usability
- [ ] Controls have labels and visible current values where needed.
- [ ] All controls work with a keyboard.
- [ ] Focus indicators are visible.
- [ ] Reduced-motion preference is respected.
- [ ] Mobile layout remains readable and usable.
- [ ] Errors are surfaced with concise, useful feedback.

### Release hygiene
- [ ] README setup steps have been tested.
- [ ] Screenshots match the final version.
- [ ] Console contains no known errors or debug spam.
- [ ] No secrets or unrelated temporary files are included.
- [ ] Final changes are committed and pushed.

## Key risks and mitigations

| Risk | Why it matters | Mitigation |
|---|---|---|
| Too many particles or too-large canvas | Canvas fill and noise sampling can become expensive | Set safe caps; profile at target sizes; reduce DPR only when justified |
| Artwork becomes a solid mass | Persistent trails accumulate | Tune opacity, clear/fade behavior, particle lifetime, and reset controls |
| Inconsistent motion across displays | Frame-based movement varies with refresh rate | Use elapsed time, clamp extreme delta values, test at different refresh rates |
| Slider changes feel destructive | Reinitializing may erase accumulated art | Define per-control update behavior and label reset/regenerate actions clearly |
| Seed is not genuinely repeatable | Unseeded randomness can appear in initialization or rendering | Route all generation randomness through the seeded generator and document limits |
| Export differs from the displayed image | Canvas scaling, background, or timing may differ | Test export states; use a temporary render target for high-resolution output |
| Scope expands into a full editor | Too many optional features jeopardize the 10-day ship date | Protect the one-generator scope; treat URL presets and custom palettes as optional |

## Suggested final demo flow

1. Open the page and let the default artwork animate briefly.
2. Explain that the generator is a noise-driven particle flow field.
3. Change noise scale and particle count to demonstrate the field’s behavior.
4. Switch palette and pause the animation to show that controls affect the result.
5. Generate a new seed, then restore the original seed to demonstrate reproducibility.
6. Export a PNG and, if implemented, copy a shareable preset link.
7. Briefly show the README and explain the performance and scope decisions.
