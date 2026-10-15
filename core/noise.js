// 2D simplex noise with permute(x) = mod289((34*x+10)*x)
// Seed with offset derived from hash (< 64), NOT shuffled table.
// Values stay < 2^24 so exact in float32. Output range [-1,1].

import { lowbias32 } from "./hash.js";

const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

// permute(x) = mod289((34*x+10)*x)
function mod289(x) {
  // x can be float/int; take as integer value mod 289
  let n = x % 289;
  if (n < 0) n += 289;
  return Math.floor(n);
}

export function permute(x) {
  const v = mod289((34.0 * x + 10.0) * x);
  return v;
}

// Build permutation table from hash offset
function buildPerm(hashOffset) {
  const p = new Array(512).fill(0);
  const offset = mod289(hashOffset);
  for (let i = 0; i < 512; i++) {
    p[i] = permute(i + offset);
  }
  return p;
}

// Dot products for 2D simplex
function dot2(gx, gy, x, y) {
  return gx * x + gy * y;
}

// 2D simplex noise
// seedHashOffset is < 64 per spec ("offset (< 64) derived from the hash")
// but implementation takes numeric offset; caller passes it.
export function simplexNoise2D(x, y, seedHashOffset) {
  const offset = Math.floor(seedHashOffset) % 64;
  const p = buildPerm(offset);
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const t = (i + j) * G2;
  const X0 = i - t;
  const Y0 = j - t;
  const x0 = x - X0;
  const y0 = y - Y0;
  let i1, j1;
  if (x0 > y0) {
    i1 = 1; j1 = 0;
  } else {
    i1 = 0; j1 = 1;
  }
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1.0 + 2.0 * G2;
  const y2 = y0 - 1.0 + 2.0 * G2;
  const ii = i & 255;
  const jj = j & 255;
  let n0 = 0.0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0.0) {
    const gi0 = p[ii + p[jj]] % 12;
    const gx = (3 - Math.floor(gi0 / 2)) % 3 - 1;
    const gy = (gi0 % 2) * 2 - 1;
    t0 *= t0;
    n0 = t0 * t0 * dot2(gx, gy, x0, y0);
  }
  let n1 = 0.0;
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0.0) {
    const gi1 = p[ii + i1 + p[jj + j1]] % 12;
    const gx = (3 - Math.floor(gi1 / 2)) % 3 - 1;
    const gy = (gi1 % 2) * 2 - 1;
    t1 *= t1;
    n1 = t1 * t1 * dot2(gx, gy, x1, y1);
  }
  let n2 = 0.0;
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0.0) {
    const gi2 = p[ii + 1 + p[jj + 1]] % 12;
    const gx = (3 - Math.floor(gi2 / 2)) % 3 - 1;
    const gy = (gi2 % 2) * 2 - 1;
    t2 *= t2;
    n2 = t2 * t2 * dot2(gx, gy, x2, y2);
  }
  const noise = 70.0 * (n0 + n1 + n2);
  // Clamp to [-1,1] to be safe
  if (noise > 1.0) return 1.0;
  if (noise < -1.0) return -1.0;
  return noise;
}

// Derive noise seed offset from hash (< 64). hash is a 32-bit int.
export function noiseSeedOffsetFromHash(hash) {
  // Take low bits, mod 64
  const h = hash >>> 0;
  return (h & 0x3f); // 0-63
}
