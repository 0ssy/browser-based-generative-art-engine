// Custom trig: sin/cos without Math.sin/Math.cos
// Range-reduce to [-pi/2, pi/2] or [0,pi/2] and use 11th-degree Taylor.
// Return sin; cos(x) = sin(x + pi/2) (or derive directly). Use platform-indep ops.
// Note: we want values in a reasonable range; Taylor converges well near 0.

const PI = Math.PI;
const HALF_PI = PI / 2.0;
const TWO_PI = 2.0 * PI;

// Reduce angle to [-PI, PI]
function reduceToPi(angle) {
  // Normalize to [0, 2PI)
  let a = angle % TWO_PI;
  if (a < 0) a += TWO_PI;
  // Now [0,2PI); map to [-PI, PI)
  if (a >= PI) a -= TWO_PI;
  return a;
}

// sin via Taylor around 0; better to range-reduce further to [-pi/2,pi/2] for accuracy
function sinTaylor(x) {
  // x is in [-pi/2, pi/2] roughly; use 11th degree: terms up to x^11/11!
  // Compute powers carefully with normal arithmetic
  const x2 = x * x;
  const x4 = x2 * x2;
  const x6 = x4 * x2;
  const x8 = x4 * x4;
  const x10 = x8 * x2;
  // Terms: x - x^3/6 + x^5/120 - x^7/5040 + x^9/362880 - x^11/39916800
  let term = x;
  // -x^3/6
  term -= (x2 * x) / 6.0;
  // +x^5/120
  term += (x4 * x) / 120.0;
  // -x^7/5040
  term -= (x6 * x) / 5040.0;
  // +x^9/362880
  term += (x8 * x) / 362880.0;
  // -x^11/39916800
  term -= (x10 * x) / 39916800.0;
  return term;
}

// More accurate reduction to [-pi/2, pi/2] with quadrant handling
export function sin(x) {
  let a = reduceToPi(x); // [-PI, PI)
  let sign = 1.0;
  if (a < 0) {
    sign = -1.0;
    a = -a;
  }
  // Now [0, PI], sin(a)=sin(PI-a)
  if (a > HALF_PI) {
    a = PI - a;
  }
  // Now [0, pi/2]
  let s = sinTaylor(a);
  return sign * s;
}

export function cos(x) {
  // cos(x) = sin(x + pi/2)
  return sin(x + HALF_PI);
}
