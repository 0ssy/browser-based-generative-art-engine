// Particle sim (SoA typed arrays), init, step(), respawn
// Step order per particle: (1) sample field, (2) compute angle, (3) move,
// (4) increment age, (5) if dead or out of bounds, respawn with NO segment drawn;
// otherwise emit segment. Counter-based rand; life independent of order.

import { rand } from "./hash.js";
import { sin, cos } from "./trig.js";
import { simplexNoise2D, noiseSeedOffsetFromHash } from "./noise.js";

const WORLD_HEIGHT = 1000.0;

// Fixed world width based on aspect; caller can pass aspect
export function worldWidthFromAspect(aspect) {
  if (!Number.isFinite(aspect) || aspect <= 0) aspect = 1.0;
  return WORLD_HEIGHT * aspect;
}

// Palette simple strings
export const DEFAULT_PALETTE = [
  "#ff6b6b",
  "#4ecdc4",
  "#45b7d1",
  "#96c93d",
  "#f5a623",
  "#c44569",
];

// Colour is chosen from palette per particle
export function pickColour(seed, particleIndex, respawnCount, palette) {
  const idx = Math.floor(rand(seed, particleIndex, respawnCount, 7) * palette.length);
  return palette[idx % palette.length];
}

// Init state. Each particle gets random starting age so they don't all die together.
export function initState(config, aspect = 1.0) {
  const {
    seed = 12345,
    particleCount = 1000,
    noiseScale = 1.0, // features per 1000 units
    speed = 1.0, // units per step
    strokeWidth = 1.0,
    opacity = 1.0,
    trailLength = 100, // lifetime in steps? spec says "trailLength/lifetime"
    palette = DEFAULT_PALETTE,
    background = "#000000",
    durationInSteps = 0,
  } = config || {};
  const count = Math.max(0, Math.floor(particleCount));
  const worldW = worldWidthFromAspect(aspect);
  const worldH = WORLD_HEIGHT;
  // SoA
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const prevX = new Float32Array(count);
  const prevY = new Float32Array(count);
  const age = new Float32Array(count); // steps alive
  const life = new Float32Array(count); // total life in steps
  const colour = new Array(count).fill(palette[0] || "#fff");

  const seedOffset = noiseSeedOffsetFromHash(rand(seed, 0, 0, 0) * 0xffffffff);
  // Initialize particles
  for (let i = 0; i < count; i++) {
    // Initial position in world (random)
    const px = rand(seed, i, 0, 0) * worldW;
    const py = rand(seed, i, 0, 1) * worldH;
    x[i] = px;
    y[i] = py;
    prevX[i] = px;
    prevY[i] = py;
    // Random starting age
    const startAge = Math.floor(rand(seed, i, 0, 2) * (lifeValue(trailLength) + 1));
    age[i] = startAge;
    life[i] = lifeValue(trailLength);
    colour[i] = pickColour(seed, i, 0, palette);
  }

  return {
    seed,
    particleCount: count,
    noiseScale,
    speed,
    strokeWidth,
    opacity,
    trailLength,
    palette,
    background,
    durationInSteps,
    worldW,
    worldH,
    x,
    y,
    prevX,
    prevY,
    age,
    life,
    colour,
    segments: [], // emitted segments per step? but sim is pure; caller can collect
    stepCount: 0,
    noiseOffset: seedOffset,
  };
}

// trailLength may be "lifetime" - treat as lifetime in steps (positive)
function lifeValue(trailLength) {
  const v = Math.max(1, Math.floor(trailLength || 100));
  return v;
}

// Sample field: 2D simplex noise value at (x,y)
// angle = noise * 2*pi (or scaled as specified by design)
// but spec just says "sample the field, (2) compute angle" - typical flow field: angle = noise * 2pi
export function sampleField(x, y, noiseScale, noiseOffset) {
  // noiseScale is features per 1000 units
  const scale = noiseScale / 1000.0;
  const nx = x * scale;
  const ny = y * scale;
  const n = simplexNoise2D(nx, ny, noiseOffset);
  return n; // [-1,1]
}

// Compute angle from noise value
export function computeAngle(noiseVal) {
  // angle = noiseVal * 2*pi
  const TWO_PI = 2.0 * Math.PI;
  return noiseVal * TWO_PI;
}

// Respawn particle when dead or out of bounds
export function respawnParticle(state, i) {
  const { seed, worldW, worldH, palette, trailLength } = state;
  // Track respawn count? We need to pass respawnCount to rand for determinism
  // Store respawn counts per particle
  if (!state.respawnCount) state.respawnCount = new Uint32Array(state.particleCount);
  const rc = state.respawnCount[i] + 1;
  state.respawnCount[i] = rc;
  // New random position
  const px = rand(seed, i, rc, 0) * worldW;
  const py = rand(seed, i, rc, 1) * worldH;
  state.x[i] = px;
  state.y[i] = py;
  state.prevX[i] = px;
  state.prevY[i] = py;
  // Reset age to random start
  const l = lifeValue(trailLength);
  state.age[i] = Math.floor(rand(seed, i, rc, 2) * (l + 1));
  state.life[i] = l;
  state.colour[i] = pickColour(seed, i, rc, palette);
}

// Step function: advances sim by one fixed 1/60s step conceptually.
// But we just do the math; "fixed timestep" means caller does N steps.
// Per-particle order as specified.
export function step(state) {
  if (!state || state.particleCount <= 0) return [];
  const segments = [];
  const dtFactor = 1.0; // 1/60s step unit
  const stepSpeed = state.speed * dtFactor;
  if (!state.respawnCount) {
    state.respawnCount = new Uint32Array(state.particleCount);
  }

  for (let i = 0; i < state.particleCount; i++) {
    // (1) sample field
    const n = sampleField(state.x[i], state.y[i], state.noiseScale, state.noiseOffset);
    // (2) compute angle
    const angle = computeAngle(n);
    // (3) move
    const vx = stepSpeed * cos(angle);
    const vy = stepSpeed * sin(angle);
    const nx = state.x[i] + vx;
    const ny = state.y[i] + vy;
    // Store prev
    const px = state.x[i];
    const py = state.y[i];
    state.x[i] = nx;
    state.y[i] = ny;
    // (4) increment age
    state.age[i] += 1;
    // (5) check dead or out of bounds
    const dead = state.age[i] >= state.life[i];
    const outOfBounds = nx < 0 || nx > state.worldW || ny < 0 || ny > state.worldH;
    if (dead || outOfBounds) {
      // Respawn with NO segment drawn
      respawnParticle(state, i);
      // Don't emit segment
    } else {
      // Emit segment from (px,py) to (nx,ny)
      segments.push({
        i,
        x0: px,
        y0: py,
        x1: nx,
        y1: ny,
        colour: state.colour[i],
        age: state.age[i],
      });
    }
  }
  state.stepCount += 1;
  return segments;
}
