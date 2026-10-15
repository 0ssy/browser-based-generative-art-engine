// Config schema + validation/clamping
// One object, validate/clamp at one boundary
// Parameters with min/max/step/default/int/log/linear/extendedMax

export const CONFIG_SCHEMA = {
  seed: { label: "Seed", min: 0, max: 2**31-1, step: 1, default: 12345, integer: true, log: false, linear: true, extendedMax: 2**53-1 },
  particleCount: { label: "Particle Count", min: 1, max: 100000, step: 1, default: 1000, integer: true, log: true, linear: false, extendedMax: 1000000 },
  noiseScale: { label: "Noise Scale", min: 0.01, max: 10, step: 0.01, default: 1.0, integer: false, log: false, linear: true, extendedMax: 100 },
  speed: { label: "Speed", min: 0.01, max: 20, step: 0.01, default: 1.0, integer: false, log: false, linear: true, extendedMax: 100 },
  strokeWidth: { label: "Stroke Width", min: 0.01, max: 10, step: 0.01, default: 1.0, integer: false, log: false, linear: true, extendedMax: 50 },
  opacity: { label: "Opacity", min: 0.01, max: 1.0, step: 0.01, default: 1.0, integer: false, log: false, linear: true, extendedMax: 1.0 },
  trailLength: { label: "Trail Length/Lifetime", min: 1, max: 10000, step: 1, default: 100, integer: true, log: false, linear: true, extendedMax: 100000 },
  palette: { label: "Palette", min: 0, max: 0, step: 0, default: "default", integer: false, log: false, linear: false, extendedMax: 0 },
  background: { label: "Background", min: 0, max: 0, step: 0, default: "#000000", integer: false, log: false, linear: false, extendedMax: 0 },
  durationInSteps: { label: "Duration In Steps", min: 0, max: 10**7, step: 1, default: 0, integer: true, log: false, linear: true, extendedMax: 10**8 },
};

export const DEFAULT_PALETTE_LIST = [
  "#ff6b6b", "#4ecdc4", "#45b7d1", "#96c93d", "#f5a623", "#c44569"
];

export function clampNumber(v, min, max) {
  if (!Number.isFinite(v)) return min;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

// Validate and clamp at one boundary
export function validateAndClamp(config) {
  const result = {};
  for (const key of Object.keys(CONFIG_SCHEMA)) {
    const schema = CONFIG_SCHEMA[key];
    const v = config ? config[key] : undefined;
    if (v === undefined || v === null || Number.isNaN(v)) {
      // Use default; handle special cases
      if (key === "palette") {
        result[key] = "default";
      } else if (key === "background") {
        result[key] = "#000000";
      } else {
        result[key] = schema.default;
      }
      continue;
    }
    // Numeric params
    if (key !== "palette" && key !== "background") {
      let num = Number(v);
      if (!Number.isFinite(num)) {
        result[key] = schema.default;
        continue;
      }
      num = clampNumber(num, schema.min, schema.max);
      if (schema.integer) {
        num = Math.floor(num);
      }
      result[key] = num;
    } else {
      // strings
      result[key] = String(v);
    }
  }
  return result;
}

// Resolve palette from name or array
export function resolvePalette(palette) {
  if (Array.isArray(palette)) return palette.slice();
  if (typeof palette === "string") {
    if (palette === "default") return DEFAULT_PALETTE_LIST.slice();
    // Could be comma-separated; but simple - return default if not recognized
    return DEFAULT_PALETTE_LIST.slice();
  }
  return DEFAULT_PALETTE_LIST.slice();
}

// URL preset roundtrip conceptually - just validates/clamps
export function applyPreset(preset) {
  return validateAndClamp(preset || {});
}
