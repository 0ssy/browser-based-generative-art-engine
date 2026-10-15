// ui/export.js
// Export functionality for the generative art engine

import { initState, step } from "../core/index.js";
import { worldWidthFromAspect } from "../core/sim.js";
import { validateAndClamp } from "../core/config.js";
import { resolvePalette } from "../core/config.js";

/**
 * Export the current canvas as a PNG file.
 * @param {HTMLCanvasElement} canvas - The canvas to export.
 * @param {number} seed - The seed used for the current generation.
 * @returns {Promise<void>}
 */
export function exportPNG(canvas, seed) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas is empty'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flow-field-${seed}.png`;
      a.click();
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
}

/**
 * Export the current canvas as a PNG at 2x resolution by re-running the simulation.
 * @param {HTMLCanvasElement} canvas - The original canvas.
 * @param {Object} config - The validated config object.
 * @param {number} seed - The seed used for the current generation.
 * @param {number} steps - The number of steps to simulate (current step count).
 * @returns {Promise<void>}
 */
export function exportPNGAt2x(canvas, config, seed, steps) {
  return new Promise((resolve, reject) => {
    // Create offscreen canvas at 2x resolution
    const width = canvas.width * 2;
    const height = canvas.height * 2;
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;

    // Create a renderer for the offscreen canvas
    // We need to import the renderer class. Since we don't have direct access, we'll create a simple one.
    // Alternatively, we can reuse the Canvas2DRenderer from the render directory.
    // Let's import it.
    // We'll do a dynamic import to avoid circular dependencies? But we can just import.
    // We'll assume the renderer is available at ../render/canvas2d.js
    import("../render/canvas2d.js").then(({ Canvas2DRenderer }) => {
      const renderer = new Canvas2DRenderer(offscreenCanvas);
      renderer.setBackgroundColor(config.background);
      renderer.setLineWidth(config.strokeWidth);

      // Initialize state for the offscreen canvas
      const aspect = width / height;
      let state = initState(config, aspect);
      state.stepCount = 0;
      if (!state.respawnCount) {
        state.respawnCount = new Uint32Array(state.particleCount);
      }

      // Clear the offscreen canvas with the background color
      renderer.clear();

      // Simulate the specified number of steps
      for (let i = 0; i < steps; i++) {
        const segments = step(state);
        // Draw the segments to the offscreen renderer
        renderer.drawSegments(segments);
      }

      // Export the offscreen canvas as PNG
      offscreenCanvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Offscreen canvas is empty'));
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `flow-field-${seed}-2x.png`;
        a.click();
        URL.revokeObjectURL(url);
        resolve();
      }, 'image/png');
    }).catch(err => {
      reject(new Error(`Failed to load renderer: ${err}`));
    });
  });
}

/**
 * Export the particle paths as an SVG file for plotters.
 * @param {HTMLCanvasElement} canvas - The original canvas (for dimensions).
 * @param {Object} config - The validated config object.
 * @param {number} seed - The seed used for the current generation.
 * @param {number} steps - The number of steps to simulate (current step count).
 * @param {number} [keepEveryK=2] - Keep every k-th point to reduce file size.
 * @returns {Promise<void>}
 */
export function exportSVG(canvas, config, seed, steps, keepEveryK = 2) {
  return new Promise((resolve, reject) => {
    // Estimate the number of points to avoid huge files
    const { particleCount, trailLength } = config;
    const lifeValue = Math.max(1, Math.floor(trailLength || 100));
    const estimatedPoints = particleCount * Math.ceil(lifeValue / keepEveryK);
    const MAX_POINTS = 100000; // Adjust as needed
    if (estimatedPoints > MAX_POINTS) {
      reject(new Error(`Estimated point count (${estimatedPoints}) is too high for SVG export. Increase 'keepEveryK' or reduce trailLength/particleCount.`));
      return;
    }

    const aspect = canvas.width / canvas.height;
    let state = initState(config, aspect);
    state.stepCount = 0;
    if (!state.respawnCount) {
      state.respawnCount = new Uint32Array(state.particleCount);
    }

    // We'll record trajectories: for each particle, we record points (every k-th step) during its life.
    // We need to know when a particle dies or respawns to finalize the current trajectory.
    // We'll maintain:
    //   trajectories: array of objects, each { color: string, points: Array<{x:number, y:number}> }
    //   currentTrajectoryIndex: for each particle, the index of the trajectory it is currently in (or -1 if not recording)
    //   We'll also need to know the color of the current trajectory for each particle.

    // Instead, we can record points per particle and then split by respawn events.
    // We'll create an array for each particle to record its points (every k-th step).
    // We'll also record the color at the time of each point (since color can change on respawn).
    // But note: color is constant for a particle's life? Actually, when a particle respawns, it gets a new color based on the new respawn count.
    // So we need to record the color for each point.

    // We'll record: for each particle, an array of {x, y, color, step} (but we only want every k-th step).
    // We'll then post-process to split by respawns? Actually, we can detect respawn by checking if the particle's respawn count has increased since the last recorded point.

    // We'll keep track of the last respawn count for each particle when we last recorded a point.
    // If the current respawn count is greater than the last recorded respawn count, then the particle has respawned and we should start a new trajectory.

    // We'll create:
    //   pointsPerParticle: array of length particleCount, each is an array of {x, y, color}
    //   lastRespawnCount: array of length particleCount, initialized to 0

    const pointsPerParticle = new Array(state.particleCount).fill(null).map(() => []);
    const lastRespawnCount = new Array(state.particleCount).fill(0);

    // We'll also need to record the initial point (at step 0) for each particle? Yes, but we only record every k-th step.
    // We'll record at step 0, then every k-th step after that.

    // Helper to record a point for a particle if the step is a multiple of keepEveryK (including 0)
    const recordPoint = (particleIndex, step) => {
      if (step % keepEveryK === 0) {
        const x = state.x[particleIndex];
        const y = state.y[particleIndex];
        const color = state.colour[particleIndex];
        pointsPerParticle[particleIndex].push({ x, y, color });
        lastRespawnCount[particleIndex] = state.respawnCount[particleIndex];
      }
    };

    // Record initial points at step 0
    for (let i = 0; i < state.particleCount; i++) {
      recordPoint(i, 0);
    }

    // Simulate the specified number of steps
    for (let step = 1; step <= steps; step++) {
      const segments = step(state);
      // After stepping, record points for each particle (if step is multiple of keepEveryK)
      for (let i = 0; i < state.particleCount; i++) {
        // Check if the particle has respawned since the last recorded point
        if (state.respawnCount[i] !== lastRespawnCount[i]) {
          // The particle has respawned, so we finalize the current trajectory and start a new one.
          // We don't need to do anything special because we are recording points per particle and will split by respawn later.
          // We'll just continue recording points; the respawn will be reflected in the color change.
          // We'll update the lastRespawnCount when we record the point.
          // Actually, we update lastRespawnCount in recordPoint, so we need to record the point after updating? We'll record the point and then update.
          // But note: the color we record should be the new color after respawn.
          // The step function has already updated the state (including color) when it respawned.
          // So we can record the point now and it will have the new color.
        }
        recordPoint(i, step);
      }
    }

    // Now we have pointsPerParticle, each array of points for a particle (including points after respawns).
    // We need to split each particle's points into trajectories whenever the color changes (or when respawn occurs, which changes color).
    // We'll create a list of trajectories: each trajectory has a color and an array of points.
    const trajectories = []; // each element: { color: string, points: Array<{x:number, y:number}> }

    for (let i = 0; i < state.particleCount; i++) {
      const points = pointsPerParticle[i];
      if (points.length === 0) continue;

      let currentTrajectory = { color: points[0].color, points: [] };
      for (const p of points) {
        if (p.color !== currentTrajectory.color) {
          // Finalize current trajectory and start a new one
          trajectories.push(currentTrajectory);
          currentTrajectory = { color: p.color, points: [] };
        }
        currentTrajectory.points.push({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }); // round to 1 decimal
      }
      // Don't forget to push the last trajectory
      trajectories.push(currentTrajectory);
    }

    // Generate SVG
    const width = canvas.width;
    const height = canvas.height;
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`;
    // Set background to none for plotter mode
    // We'll not draw a background rect.

    // Group trajectories by color
    const trajectoriesByColor = {};
    for (const traj of trajectories) {
      if (!trajectoriesByColor[traj.color]) {
        trajectoriesByColor[traj.color] = [];
      }
      trajectoriesByColor[traj.color].push(traj);
    }

    // For each color, create a <g> with Inkscape layer attributes
    for (const color in trajectoriesByColor) {
      const trajs = trajectoriesByColor[color];
      svgContent += `  <g inkscape:label="${color}" inkscape:groupmode="layer">\n`;
      for (const traj of trajs) {
        if (traj.points.length < 2) continue; // need at least two points for a line
        // Create a polyline for the trajectory
        const pointsStr = traj.points.map(p => `${p.x},${p.y}`).join(' ');
        svgContent += `    <polyline fill="none" stroke="${color}" stroke-width="${config.strokeWidth}" points="${pointsStr}" />\n`;
      }
      svgContent += `  </g>\n`;
    }

    svgContent += `</svg>`;

    // Create a blob and trigger download
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow-field-${seed}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    resolve();
  });
}
