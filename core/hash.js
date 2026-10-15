// lowbias32 mixer + counter-based PRNG
// Counter-based: rand(seed, particleIndex, respawnCount, channel) -> [0,1)
// Top 24 bits taken for float in [0,1). All inputs integer-like.
// lowbias32 is a fast integer mixer (from "small-mixing" style mixing).
// See: http://prng.di.unimi.it/splitmix32.c style? Or specific lowbias32.
// Common lowbias32: sequence of xors/rots/muls designed for low bias.
// We'll use a standard lowbias32 formulation: mix to decorrelate bits.
function lowbias32(x) {
  // Standard lowbias32
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0; // unsigned 32-bit
}

// Counter-based hash combining inputs into a seed for lowbias32.
// Order-independent in effect? We pass all four; same set gives same result.
function counterHash(seed, particleIndex, respawnCount, channel) {
  // Combine with large primes to avoid collisions
  let h = (seed >>> 0) ^ (0x9e3779b9 >>> 0);
  h = Math.imul(h ^ (particleIndex >>> 0), 0x85ebca6b);
  h = Math.imul(h ^ (respawnCount >>> 0), 0xc2b2ae35);
  h = Math.imul(h ^ ((channel >>> 0) & 0xff), 0x27d4eb2f);
  // Final mix
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  return h >>> 0;
}

export function rand(seed, particleIndex, respawnCount, channel) {
  // Counter-based: compute mixed value from inputs
  const h = counterHash(seed, particleIndex, respawnCount, channel >>> 0);
  const mixed = lowbias32(h);
  // Take top 24 bits for float in [0,1)
  // 2^24 is the mask magnitude; divide by 2^24
  const top24 = (mixed >>> 8) & 0xffffff; // top 24
  return top24 / 16777216.0;
}

export { lowbias32, counterHash };
