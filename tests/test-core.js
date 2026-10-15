import { test } from "node:test";
import assert from "node:assert";
import { rand, counterHash, lowbias32 } from "./../core/hash.js";
import { sin, cos } from "./../core/trig.js";
import { simplexNoise2D, noiseSeedOffsetFromHash, permute } from "./../core/noise.js";
import { initState, step, DEFAULT_PALETTE, worldWidthFromAspect, sampleField, computeAngle } from "./../core/sim.js";
import { validateAndClamp, CONFIG_SCHEMA, DEFAULT_PALETTE_LIST } from "./../core/config.js";

// FNV-1a 32-bit hash over the raw bytes of an array of floats.
function fnv1aFloat32(arr) {
  const buf = Buffer.allocUnsafe(arr.length * 4);
  for (let i = 0; i < arr.length; i++) buf.writeFloatLE(arr[i], i * 4);
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < buf.length; i++) {
    h ^= buf[i];
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Hash the full state arrays after N steps from a fixed seed.
function hashState(state) {
  let h = 0x811c9dc5 >>> 0;
  const arrays = [state.x, state.y, state.prevX, state.prevY, state.age, state.life];
  for (const arr of arrays) {
    const buf = Buffer.allocUnsafe(arr.length * 4);
    for (let i = 0; i < arr.length; i++) buf.writeFloatLE(arr[i], i * 4);
    for (let i = 0; i < buf.length; i++) {
      h ^= buf[i];
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}

test("hash: same inputs give same output", () => {
  const a = rand(12345, 0, 0, 0);
  const b = rand(12345, 0, 0, 0);
  assert.strictEqual(a, b);
  const c = rand(12345, 1, 0, 0);
  assert.notStrictEqual(c, a);
});

test("hash: values in [0,1)", () => {
  for (let i = 0; i < 100; i++) {
    const v = rand(12345, i, i, i % 4);
    assert.ok(v >= 0 && v < 1);
  }
});

test("trig: deterministic and reasonable", () => {
  const s1 = sin(1.0);
  const s2 = sin(1.0);
  assert.strictEqual(s1, s2);
  const c1 = cos(1.0);
  const c2 = cos(1.0);
  assert.strictEqual(c1, c2);
  // sin(0)=0, sin(pi/2)~1
  assert.ok(Math.abs(sin(0)) < 1e-6);
  assert.ok(Math.abs(sin(Math.PI / 2) - 1.0) < 1e-4);
});

test("noise: deterministic and in range", () => {
  const n1 = simplexNoise2D(0.1, 0.2, 5);
  const n2 = simplexNoise2D(0.1, 0.2, 5);
  assert.strictEqual(n1, n2);
  const n3 = simplexNoise2D(0.1, 0.2, 6);
  assert.notStrictEqual(n3, n1);
  for (let i = 0; i < 50; i++) {
    const v = simplexNoise2D(i * 0.05, i * 0.03, i % 64);
    assert.ok(v >= -1.0 && v <= 1.0, `noise out of range: ${v}`);
  }
});

test("config: clamping and defaults", () => {
  const c = validateAndClamp({ seed: -5, particleCount: 999999, noiseScale: -1, speed: 10000 });
  assert.ok(c.seed >= 0);
  assert.ok(c.particleCount <= 100000);
  assert.ok(c.noiseScale >= 0.01);
  assert.ok(c.speed <= 20);
  const d = validateAndClamp({});
  assert.strictEqual(d.seed, CONFIG_SCHEMA.seed.default);
  assert.strictEqual(d.particleCount, CONFIG_SCHEMA.particleCount.default);
});

test("sim: deterministic, runs steps", () => {
  const c1 = { seed: 12345, particleCount: 200, noiseScale: 1, speed: 1, trailLength: 50, palette: DEFAULT_PALETTE };
  const s1 = initState(c1, 1.6);
  const c2 = { seed: 12345, particleCount: 200, noiseScale: 1, speed: 1, trailLength: 50, palette: DEFAULT_PALETTE };
  const s2 = initState(c2, 1.6);
  assert.strictEqual(s1.x[0], s2.x[0]);
  const segs = step(s1);
  assert.strictEqual(s1.stepCount, 1);
  for (let i = 0; i < 5; i++) step(s1);
  assert.strictEqual(s1.stepCount, 6);
});

// Golden test: run N steps from a fixed seed, hash the state arrays with
// FNV-1a over the raw float32 bytes, compare against a STORED value.
test("golden: stable seed produces stable baseline hash", () => {
  const cfg = { seed: 42, particleCount: 50, noiseScale: 0.01, speed: 1, trailLength: 30, palette: DEFAULT_PALETTE };
  const s = initState(cfg, 1.0);
  const N = 10;
  for (let i = 0; i < N; i++) step(s);
  const h = hashState(s);
  // STORED: FNV-1a hash of state arrays after 10 steps from seed 42.
  const STORED = 0x0AF9D0BC;
  assert.strictEqual(h, STORED);
});