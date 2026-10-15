#!/usr/bin/env node
// Simple benchmark: prints ms per step by particle count

import { initState, step } from "./../core/sim.js";
import { DEFAULT_PALETTE } from "./../core/sim.js";

function nowMs() {
  return Date.now();
}

function bench(count, steps) {
  const cfg = {
    seed: 12345,
    particleCount: count,
    noiseScale: 0.01,
    speed: 1,
    trailLength: 200,
    palette: DEFAULT_PALETTE,
  };
  const s = initState(cfg, 1.0);
  const t0 = nowMs();
  for (let i = 0; i < steps; i++) {
    step(s);
  }
  const t1 = nowMs();
  const dt = t1 - t0;
  const msPerStep = dt / steps;
  return { count, steps, dt, msPerStep };
}

const sizes = [100, 500, 1000, 2000];
const steps = 50;
console.log("Benchmark: ms per step (ms)");
for (const c of sizes) {
  const r = bench(c, steps);
  console.log(`${r.count}\t\t${r.msPerStep.toFixed(3)} ms/step`);
}
