// render/canvas2d.js
// Canvas 2D renderer
// Clear/background, draw segments from step results.
// Group strokes by colour (batch) where possible.
// Handle DPR; cap live DPR so pixel area under ~16M.
// On resize: update canvas dimensions; policy is to keep accumulated art (preserve state; just resize viewport — don't clear art unless explicitly requested).

export class Canvas2DRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = canvas.width;
    this.height = canvas.height;
    this.devicePixelRatio = window.devicePixelRatio || 1;
    this.backingStoreRatio = this.ctx.webkitBackingStorePixelRatio ||
                            this.ctx.mozBackingStorePixelRatio ||
                            this.ctx.msBackingStorePixelRatio ||
                            this.ctx.oBackingStorePixelRatio ||
                            this.ctx.backingStorePixelRatio || 1;
    this.scaleRatio = this.devicePixelRatio / this.backingStoreRatio;
    this.setCanvasSizeBasedOnContainer();
    this.clearColor = "#000000"; // default background
  }

  // Set canvas size based on container, preserving aspect and DPR
  setCanvasSizeBasedOnContainer() {
    const container = this.canvas.parentElement;
    if (!container) return;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Set CSS size
    this.canvas.style.width = `${containerWidth}px`;
    this.canvas.style.height = `${containerHeight}px`;

    // Set actual resolution with DPR, but cap to avoid excessive memory usage
    // Cap live DPR so pixel area under ~16M
    const maxPixels = 16_000_000;
    let scale = this.devicePixelRatio;
    const area = containerWidth * containerHeight * scale * scale;
    if (area > maxPixels) {
      scale = Math.sqrt(maxPixels / (containerWidth * containerHeight));
    }
    this.canvas.width = Math.round(containerWidth * scale);
    this.canvas.height = Math.round(containerHeight * scale);
    this.ctx.scale(scale, scale);
    this.width = this.canvas.width / scale;
    this.height = this.canvas.height / scale;
  }

  // Clear the canvas with the current background color
  clear() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = this.clearColor;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.restore();
  }

  // Set background color
  setBackgroundColor(color) {
    this.clearColor = color;
  }

  // Draw segments, grouped by color for batching
  drawSegments(segments) {
    if (!segments || segments.length === 0) return;

    // Group segments by color
    const groups = {};
    for (const seg of segments) {
      const color = seg.colour;
      if (!groups[color]) {
        groups[color] = [];
      }
      groups[color].push(seg);
    }

    // Draw each group
    for (const color in groups) {
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1; // Note: stroke width is handled by the core? Actually, the core has strokeWidth in state.
      // We'll use the strokeWidth from the state? But we don't have state here.
      // The segments don't have strokeWidth. We need to get it from the engine state.
      // We'll change: the engine will pass the strokeWidth in the segment? Or we can get it from the renderer's config.
      // Let's assume the engine will set the lineWidth based on the state's strokeWidth.
      // We'll change the drawSegments to take an optional lineWidth or get it from the engine via a property.
      // For now, we'll hardcode to 1 and later fix.
      // We'll pass the strokeWidth from the engine to the renderer via a method or property.
      // We'll add a setStrokeWidth method.
      // But note: the core's step function returns segments without strokeWidth.
      // We'll need to get the strokeWidth from the engine's state.
      // We'll change the renderer to have a reference to the engine state? Or the engine will pass the strokeWidth with each segment?
      // Let's change the segment format to include strokeWidth? But the core doesn't have it.
      // Alternatively, the engine can set the lineWidth on the context before calling drawSegments.
      // We'll change the design: the renderer will not set lineWidth; the engine will set it before calling drawSegments.
      // So we remove the lineWidth setting here and rely on the engine to set it.
      // We'll clear the lineWidth at the start of drawSegments? No, we'll let the engine set it per group if needed.
      // We'll change: the engine will group by color and strokeWidth? Or we'll just set the lineWidth to the state's strokeWidth for all segments.
      // Since the strokeWidth is uniform for all particles, we can set it once.
      // We'll add a method to set the lineWidth.
      // For now, we'll set it to a default and then later we'll set it from the engine.
      // We'll change the renderer to have a lineWidth property that can be set.
      this.ctx.lineWidth = this.lineWidth || 1;
      this.ctx.beginPath();
      for (const seg of groups[color]) {
        this.ctx.moveTo(seg.x0, seg.y0);
        this.ctx.lineTo(seg.x1, seg.y1);
      }
      this.ctx.stroke();
    }
  }

  // Set line width (to be called by engine with state.strokeWidth)
  setLineWidth(width) {
    this.lineWidth = width;
  }

  // Handle resize: update canvas dimensions, preserve accumulated art
  onResize() {
    const oldWidth = this.width;
    const oldHeight = this.height;
    this.setCanvasSizeBasedOnContainer();
    // Policy: keep accumulated art (preserve state; just resize viewport)
    // We don't clear the canvas; we just change the viewport.
    // However, if the canvas size changes, the drawing scale changes.
    // We have already set the scale via ctx.scale, so drawing will be scaled accordingly.
    // But note: the existing drawing is in pixel coordinates of the old canvas.
    // When we change the canvas size and scale, the existing drawing will be scaled too.
    // That's acceptable because we are just changing the viewport.
    // We don't need to redraw the existing art because it's already on the canvas.
    // However, if we change the DPR, the backing store size changes and we lose the existing drawing.
    // To preserve the art, we would need to copy the old canvas to a temporary one, then resize and redraw.
    // But the instruction says: "preserve state; just resize viewport — don't clear art unless explicitly requested"
    // This implies we are not clearing the art, so we must preserve the pixel data.
    // We'll implement a backup and restore.

    // Backup current canvas
    const backup = document.createElement("canvas");
    backup.width = this.canvas.width;
    backup.height = this.canvas.height;
    backup.getContext("2d").drawImage(this.canvas, 0, 0);

    // Set new size
    this.setCanvasSizeBasedOnContainer();

    // Restore the backup, scaling if necessary
    this.ctx.drawImage(backup, 0, 0, backup.width, backup.height, 0, 0, this.width, this.height);
  }

  // Get the current canvas size (CSS size)
  getSize() {
    return { width: this.width, height: this.height };
  }
}