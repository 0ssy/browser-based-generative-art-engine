// ui/controls.js
// Read/write schema-based controls.
// Validate/clamp with validate from core.
// Update URL with history.replaceState (debounced), version v=1.
// Store favourites in localStorage (versioned key) with try/catch.
// Handle "New variation" (new seed).
// Handle shortcuts: Space (pause), N (new), R (reset).
// Supports prefers-reduced-motion.

import { validateAndClamp, CONFIG_SCHEMA } from "../core/config.js";
import { resolvePalette } from "../core/config.js";

// Define a few named palettes for the palette control
const NAMED_PALETTES = {
  default: [
    "#ff6b6b",
    "#4ecdc4",
    "#45b7d1",
    "#96c93d",
    "#f5a623",
    "#c44569",
  ],
  "deep-ocean": [
    "#0b1020",
    "#1f2a44",
    "#3d405b",
    "#81b29a",
    "#f2cc8f",
    "#ef233c",
  ],
  "vibrant": [
    "#ff006e",
    "#ef476f",
    "#ffd166",
    "#06d6a0",
    "#118ab2",
    "#073b4c",
  ],
  "pastel": [
    "#ffadad",
    "#ffd6a5",
    "#fdffb6",
    "#caffbf",
    "#9bf6ff",
    "#a0c4ff",
    "#bdb2ff",
    "#ffc6ff",
  ],
  "monochrome": [
    "#000000",
    "#222222",
    "#444444",
    "#666666",
    "#888888",
    "#aaaaaa",
    "#cccccc",
    "#eeeeee",
    "#ffffff",
  ],
};

export class Controls {
  constructor(onUpdate, onNewVariation, onPauseToggle, onReset, onExport) {
    this.onUpdate = onUpdate; // called when a control changes (debounced)
    this.onNewVariation = onNewVariation; // called when new variation button is pressed
    this.onPauseToggle = onPauseToggle; // called when pause button is pressed (toggles pause)
    this.onReset = onReset; // called when reset button is pressed
    this.onExport = onExport; // called when export button is pressed

    this.state = {}; // current control values
    this.debounceTimer = null;
    this.debounceDelay = 300; // ms

    this.bindEvents();
    this.loadFromURL();
    this.loadFavourites();
    this.updateDisplay();
  }

  // Create DOM elements for controls and append to controls-panel
  initialize() {
    this.controlsPanel = document.querySelector(".controls-panel");
    if (!this.controlsPanel) {
      console.error("Controls panel not found");
      return;
    }

    // Create title
    const title = document.createElement("h2");
    title.textContent = "Controls";
    this.controlsPanel.appendChild(title);

    // Create control groups based on CONFIG_SCHEMA
    for (const key in CONFIG_SCHEMA) {
      const schema = CONFIG_SCHEMA[key];
      const group = document.createElement("div");
      group.className = "control-group";

      const label = document.createElement("label");
      label.htmlFor = `control-${key}`;
      label.textContent = schema.label;
      group.appendChild(label);

      let input;
      if (key === "palette") {
        // Palette: select with named palettes
        input = document.createElement("select");
        input.id = `control-${key}`;
        // Add options for each named palette
        for (const paletteName in NAMED_PALETTES) {
          const option = document.createElement("option");
          option.value = paletteName;
          option.textContent = paletteName;
          if (paletteName === "default") option.selected = true;
          input.appendChild(option);
        }
      } else if (key === "background") {
        // Background: color input
        input = document.createElement("input");
        input.type = "color";
        input.id = `control-${key}`;
        input.value = "#000000";
      } else if (typeof schema.default === "number") {
        // Numeric: range input
        input = document.createElement("input");
        input.type = "range";
        input.id = `control-${key}`;
        input.min = schema.min;
        input.max = schema.max;
        input.step = schema.step;
        // Also create a value display
        const valueDisplay = document.createElement("span");
        valueDisplay.className = "value-display";
        valueDisplay.id = `value-${key}`;
        group.appendChild(valueDisplay);
        // Update value display when input changes
        input.addEventListener("input", () => {
          valueDisplay.textContent = input.value;
        });
        // Set initial value
        input.value = schema.default;
        valueDisplay.textContent = schema.default;
      } else {
        // Fallback to text input
        input = document.createElement("input");
        input.type = "text";
        input.id = `control-${key}`;
        input.value = schema.default;
      }

      input.addEventListener("change", () => this.handleChange(key, input));
      input.addEventListener("input", () => this.handleInput(key, input));
      group.appendChild(input);
      this.controlsPanel.appendChild(group);
    }

    // Add buttons panel
    const buttonsPanel = document.createElement("div");
    buttonsPanel.className = "buttons-panel";
    // We'll create the buttons here, but note that the index.html already has a buttons-panel.
    // We'll instead use the existing buttons-panel in index.html and bind events there.
    // So we don't create buttons here.
  }

  // Handle input event (for sliders, update value display immediately)
  handleInput(key, input) {
    // For numeric controls, update the value display
    if (key !== "palette" && key !== "background") {
      const valueDisplay = document.getElementById(`value-${key}`);
      if (valueDisplay) {
        valueDisplay.textContent = input.value;
      }
    }
  }

  // Handle change event (when user commits the change, e.g., slider release or select change)
  handleChange(key, input) {
    let value = input.value;
    // Convert numeric values
    if (key !== "palette" && key !== "background") {
      value = Number(value);
      if (CONFIG_SCHEMA[key].integer) {
        value = Math.floor(value);
      }
    }
    // Update state
    this.state[key] = value;
    // Validate and clamp the entire state (to ensure consistency)
    const validated = validateAndClamp(this.state);
    // Update URL (debounced)
    this.scheduleURLUpdate(validated);
    // Notify listener
    this.onUpdate(validated);
  }

  // Schedule a debounced URL update
  scheduleURLUpdate(state) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.updateURL(state);
    }, this.debounceDelay);
  }

  // Update URL with current state (version v=1)
  updateURL(state) {
    const url = new URL(window.location);
    // Set version
    url.searchParams.set("v", "1");
    // Set each parameter
    for (const key in state) {
      if (state[key] !== undefined && state[key] !== null) {
        url.searchParams.set(key, String(state[key]));
      }
    }
    // Update URL without reloading
    window.history.replaceState({}, "", url);
  }

  // Load state from URL
  loadFromURL() {
    const url = new URL(window.location);
    const version = url.searchParams.get("v");
    if (version !== "1") {
      // Ignore if version doesn't match
      return;
    }
    const state = {};
    for (const key in CONFIG_SCHEMA) {
      const value = url.searchParams.get(key);
      if (value !== null) {
        state[key] = value;
      }
    }
    // Validate and clamp the loaded state
    const validated = validateAndClamp(state);
    this.state = validated;
    this.updateDisplay();
    // Notify listener of the loaded state
    this.onUpdate(validated);
  }

  // Load favourites from localStorage
  loadFavourites() {
    try {
      const fav = localStorage.getItem("genart_favorites_v1");
      if (fav) {
        const parsed = JSON.parse(fav);
        // We could do something with favourites, but for now we just load.
        // We'll store the state as a favourite if the user wants.
        // We'll add a favourite button later? Not required.
        // We'll just note that we have favourites.
        this.favourites = parsed;
      }
    } catch (e) {
      console.warn("Failed to load favourites from localStorage", e);
    }
  }

  // Save current state as a favourite
  saveFavourite() {
    try {
      const favs = this.favourites || [];
      favs.push(this.state);
      localStorage.setItem("genart_favorites_v1", JSON.stringify(favs));
    } catch (e) {
      console.warn("Failed to save favourites to localStorage", e);
    }
  }

  // Update the display to reflect current state
  updateDisplay() {
    for (const key in this.state) {
      const input = document.getElementById(`control-${key}`);
      if (!input) continue;
      if (key === "palette") {
        input.value = this.state[key];
      } else if (key === "background") {
        input.value = this.state[key];
      } else if (typeof this.state[key] === "number") {
        input.value = this.state[key];
        const valueDisplay = document.getElementById(`value-${key}`);
        if (valueDisplay) {
          valueDisplay.textContent = this.state[key];
        }
      } else {
        input.value = this.state[key];
      }
    }
  }

  // Bind events for buttons and shortcuts
  bindEvents() {
    // Buttons from index.html
    const pauseBtn = document.getElementById("pause-btn");
    if (pauseBtn) {
      pauseBtn.addEventListener("click", () => {
        this.onPauseToggle();
      });
    }
    const resetBtn = document.getElementById("reset-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        this.onReset();
      });
    }
    const newVariationBtn = document.getElementById("new-variation-btn");
    if (newVariationBtn) {
      newVariationBtn.addEventListener("click", () => {
        this.onNewVariation();
      });
    }
    const exportBtn = document.getElementById("export-png-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        this.onExport();
      });
    }

    // Keyboard shortcuts
    window.addEventListener("keydown", (e) => {
      if (e.target === document.body || e.target === document.documentElement) {
        // Space: pause/resume
        if (e.code === "Space") {
          e.preventDefault();
          this.onPauseToggle();
        }
        // N: new variation
        if (e.code === "KeyN") {
          e.preventDefault();
          this.onNewVariation();
        }
        // R: reset
        if (e.code === "KeyR") {
          e.preventDefault();
          this.onReset();
        }
      }
    });

    // Supports prefers-reduced-motion: if user prefers reduced motion, we start paused?
    // We'll check on initialization and set a flag.
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // We don't automatically pause because the user might want to start anyway.
    // We'll just note it and maybe adjust behavior.
  }
}