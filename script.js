// script.js - Free drawing board
// (Night mode is handled by theme.js, shared with the coloring page.)

// ---------- 1. Get the elements ----------
const canvas       = document.getElementById("board");
const ctx          = canvas.getContext("2d");
const colorPicker  = document.getElementById("colorPicker");
const swatches     = document.querySelectorAll(".swatch");
const sizeSlider   = document.getElementById("sizeSlider");
const sizeValue    = document.getElementById("sizeValue");
const stylePreview = document.getElementById("stylePreview");
const previewCtx   = stylePreview.getContext("2d");
const styleButtons = document.querySelectorAll(".style-btn");
const brushBtn     = document.getElementById("brushBtn");
const eraserBtn    = document.getElementById("eraserBtn");
const undoBtn      = document.getElementById("undoBtn");
const clearBtn     = document.getElementById("clearBtn");
const saveBtn      = document.getElementById("saveBtn");
const statusBar    = document.getElementById("status");
const statusDot    = document.querySelector(".dot");
const toolInfo     = document.getElementById("toolInfo");
const coords       = document.getElementById("coords");
const cursorRing   = document.getElementById("cursorRing");
const toast        = document.getElementById("toast");

// ---------- 2. Application state ----------
let drawing = false;             // true only while the mouse button is held down
let previousPoint = null;        // last (x, y) position
let currentColor = colorPicker.value;
let currentSize  = Number(sizeSlider.value);
let currentTool  = "brush";      // "brush" or "eraser"
let currentStyle = "pen";        // pen, marker, pencil, spray, calligraphy, glow, rainbow

let hue = 0;                     // used by the rainbow brush
let strokePoints = [];           // all the points of the current stroke (used by the marker)
let strokeBase = null;           // the canvas before the current stroke (used by the marker)

const BACKGROUND = "#ffffff";    // paper color (the eraser paints with it)
const history = [];              // saved canvas states for Undo
const MAX_HISTORY = 20;

// ---------- 3. Canvas setup ----------
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width;
  canvas.height = rect.height;
  ctx.lineCap  = "round";
  ctx.lineJoin = "round";
  fillBackground();
}

// Fill the canvas with white (so the saved PNG is not transparent)
function fillBackground() {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

resizeCanvas();

// Convert mouse position (page) to canvas coordinates
function getPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

// ---------- 4. Feedback helpers ----------
let toastTimer = null;
function setStatus(message, showToast = false) {
  statusBar.textContent = message;
  if (showToast) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }
}

// ---------- 5. THE BRUSH STYLES ----------
// Every style is a function paint(c, from, to, o):
//   c    = the canvas context to draw on
//   from = previous point, to = new point
//   o    = options { color, size, points }
// When from and to are the same point, the style draws a single "dot".

function isDot(from, to) {
  return from.x === to.x && from.y === to.y;
}

function fillDot(c, x, y, radius, color) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.fill();
}

// A normal line segment (used by the pen, the eraser and the glow)
function simpleSegment(c, from, to, color, width) {
  if (isDot(from, to)) {
    fillDot(c, from.x, from.y, width / 2, color);
    return;
  }
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(from.x, from.y);
  c.lineTo(to.x, to.y);
  c.stroke();
}

const BRUSHES = {

  // Solid line
  pen: {
    name: "Pen",
    paint(c, from, to, o) {
      simpleSegment(c, from, to, o.color, o.size);
    }
  },

  // Transparent wide marker (like a highlighter).
  // The whole stroke is redrawn each time, so the overlaps do not get darker.
  marker: {
    name: "Marker",
    redraw: true,
    paint(c, from, to, o) {
      const pts = o.points;
      c.save();
      c.globalAlpha = 0.4;
      c.strokeStyle = o.color;
      c.fillStyle = o.color;
      const width = o.size * 1.8;
      if (pts.length < 2) {
        c.fillRect(pts[0].x - width / 2, pts[0].y - width / 2, width, width);
      } else {
        c.lineWidth = width;
        c.lineCap = "square";
        c.lineJoin = "round";
        c.beginPath();
        c.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
        c.stroke();
      }
      c.restore();
    }
  },

  // Thin, grainy lines that look like a pencil
  pencil: {
    name: "Pencil",
    paint(c, from, to, o) {
      c.save();
      c.strokeStyle = o.color;
      c.lineCap = "round";
      c.globalAlpha = 0.55;
      c.lineWidth = Math.max(1, o.size * 0.3);
      const jitter = () => (Math.random() - 0.5) * o.size * 0.7;   // small random shift
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.moveTo(from.x + jitter(), from.y + jitter());
        c.lineTo(to.x + jitter(), to.y + jitter());
        c.stroke();
      }
      c.restore();
    }
  },

  // Random tiny dots around the mouse (spray can)
  spray: {
    name: "Spray",
    paint(c, from, to, o) {
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      const steps = Math.max(1, Math.ceil(distance / Math.max(2, o.size * 0.3)));
      const radius = o.size;
      const dots = Math.round(o.size * 0.9) + 4;
      c.save();
      c.fillStyle = o.color;
      c.globalAlpha = 0.75;
      for (let s = 0; s < steps; s++) {
        const t = steps === 1 ? 1 : s / (steps - 1);
        const cx = from.x + (to.x - from.x) * t;
        const cy = from.y + (to.y - from.y) * t;
        for (let i = 0; i < dots; i++) {
          const angle = Math.random() * Math.PI * 2;
          const r = radius * Math.sqrt(Math.random());     // sqrt = even spread in the circle
          c.fillRect(cx + r * Math.cos(angle), cy + r * Math.sin(angle), 1.5, 1.5);
        }
      }
      c.restore();
    }
  },

  // Flat nib held at 45 degrees: thick or thin depending on the direction
  calligraphy: {
    name: "Calligraphy",
    paint(c, from, to, o) {
      const angle = -Math.PI / 4;
      const dx = Math.cos(angle) * o.size / 2;
      const dy = Math.sin(angle) * o.size / 2;
      c.save();
      c.fillStyle = o.color;
      c.strokeStyle = o.color;
      c.lineWidth = 1;
      c.lineJoin = "round";
      c.beginPath();
      c.moveTo(from.x - dx, from.y - dy);
      c.lineTo(from.x + dx, from.y + dy);
      c.lineTo(to.x + dx, to.y + dy);
      c.lineTo(to.x - dx, to.y - dy);
      c.closePath();
      c.fill();
      c.stroke();
      c.restore();
    }
  },

  // Line with a soft light around it
  glow: {
    name: "Glow",
    paint(c, from, to, o) {
      c.save();
      c.shadowColor = o.color;
      c.shadowBlur = o.size * 1.2 + 4;
      simpleSegment(c, from, to, o.color, Math.max(2, o.size * 0.5));
      c.restore();
    }
  },

  // The color changes all the time
  rainbow: {
    name: "Rainbow",
    paint(c, from, to, o) {
      hue = (hue + 3) % 360;
      simpleSegment(c, from, to, "hsl(" + hue + ", 90%, 55%)", o.size);
    }
  }
};

// The eraser is a pen that paints with the paper color
const ERASER = {
  name: "Eraser",
  paint(c, from, to, o) {
    simpleSegment(c, from, to, BACKGROUND, o.size);
  }
};

// Which brush is active now?
function activeBrush() {
  return currentTool === "eraser" ? ERASER : BRUSHES[currentStyle];
}

function strokeOptions() {
  return { color: currentColor, size: currentSize, points: strokePoints };
}

// ---------- 6. Undo history ----------
function saveState() {
  history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  if (history.length > MAX_HISTORY) history.shift();
}

function undo() {
  if (history.length === 0) {
    setStatus("Nothing to undo.", true);
    return;
  }
  ctx.putImageData(history.pop(), 0, 0);
  setStatus("Last action undone.", true);
}

// ---------- 7. Mouse events (+ touch for phones) ----------

function startDrawing(point) {
  saveState();
  drawing = true;
  previousPoint = point;
  strokePoints = [point];
  strokeBase = history[history.length - 1];       // the canvas as it was before this stroke

  activeBrush().paint(ctx, point, point, strokeOptions());     // a single dot
  statusDot.classList.add("busy");
  setStatus(currentTool === "eraser" ? "Erasing..." : "Drawing with " + BRUSHES[currentStyle].name + "...");
}

function continueDrawing(point) {
  if (!drawing) return;
  const brush = activeBrush();
  strokePoints.push(point);

  if (brush.redraw) {
    ctx.putImageData(strokeBase, 0, 0);           // go back to the canvas before the stroke...
    brush.paint(ctx, previousPoint, point, strokeOptions());   // ...and draw the whole stroke again
  } else {
    brush.paint(ctx, previousPoint, point, strokeOptions());   // connect previous point to new point
  }
  previousPoint = point;
}

function stopDrawing() {
  if (!drawing) return;
  drawing = false;
  previousPoint = null;
  strokePoints = [];
  strokeBase = null;
  statusDot.classList.remove("busy");
  setStatus("Stroke finished. Press again to continue.");
}

// The size ring that follows the mouse (bigger for the marker and the spray)
function updateRing() {
  let size = currentSize;
  if (currentTool === "brush" && currentStyle === "marker") size = currentSize * 1.8;
  if (currentTool === "brush" && currentStyle === "spray")  size = currentSize * 2;
  size = Math.max(size, 4);
  cursorRing.style.width  = size + "px";
  cursorRing.style.height = size + "px";
}

// --- Mouse ---
canvas.addEventListener("mousedown", (e) => startDrawing(getPosition(e)));
canvas.addEventListener("mousemove", (e) => {
  const p = getPosition(e);
  continueDrawing(p);

  coords.textContent = "x: " + Math.round(p.x) + " · y: " + Math.round(p.y);
  cursorRing.style.left = e.clientX + "px";
  cursorRing.style.top  = e.clientY + "px";
});
canvas.addEventListener("mouseenter", () => { cursorRing.style.display = "block"; });
canvas.addEventListener("mouseleave", () => {
  cursorRing.style.display = "none";
  stopDrawing();
});
canvas.addEventListener("mouseup", stopDrawing);
window.addEventListener("mouseup", stopDrawing);

// --- Touch ---
function getTouchPosition(e) {
  return getPosition(e.touches[0]);
}
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  startDrawing(getTouchPosition(e));
}, { passive: false });
canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  continueDrawing(getTouchPosition(e));
}, { passive: false });
canvas.addEventListener("touchend", stopDrawing);
canvas.addEventListener("touchcancel", stopDrawing);

// ---------- 8. Live preview of the brush ----------
// Draws a small wave with the active brush, so the user sees the style before drawing.
function updateStylePreview() {
  const w = stylePreview.width;
  const h = stylePreview.height;
  previewCtx.clearRect(0, 0, w, h);
  previewCtx.fillStyle = "#ffffff";
  previewCtx.fillRect(0, 0, w, h);

  const size = Math.min(currentSize, 22);        // keep the sample inside the small box

  if (currentTool === "eraser") {
    // the eraser shows a circle with its real size
    previewCtx.strokeStyle = "#64748b";
    previewCtx.lineWidth = 1.5;
    previewCtx.setLineDash([4, 3]);
    previewCtx.beginPath();
    previewCtx.arc(w / 2, h / 2, Math.min(size, 21) / 2 + 1, 0, Math.PI * 2);
    previewCtx.stroke();
    previewCtx.setLineDash([]);
    return;
  }

  // a wave of points
  const points = [];
  for (let x = 14; x <= w - 14; x += 3) {
    points.push({ x: x, y: h / 2 + Math.sin(x / 11) * (h * 0.22) });
  }

  const brush = BRUSHES[currentStyle];
  const options = { color: currentColor, size: size, points: points };

  const savedHue = hue;                          // do not disturb the real rainbow
  hue = 0;
  if (brush.redraw) {
    brush.paint(previewCtx, null, null, options);
  } else {
    brush.paint(previewCtx, points[0], points[0], options);
    for (let i = 1; i < points.length; i++) {
      brush.paint(previewCtx, points[i - 1], points[i], options);
    }
  }
  hue = savedHue;
}

// ---------- 9. Color and size ----------
function updateSwatches() {
  swatches.forEach((s) => {
    s.classList.toggle("active", s.dataset.color.toLowerCase() === currentColor.toLowerCase());
  });
}

function setColor(color) {
  currentColor = color;
  colorPicker.value = color;
  updateSwatches();
  if (currentTool === "eraser") selectTool("brush");   // choosing a color switches back to the brush
  updateStylePreview();
  setStatus("Color selected: " + color);
}

swatches.forEach((s) => s.addEventListener("click", () => setColor(s.dataset.color)));
colorPicker.addEventListener("input", () => setColor(colorPicker.value));

sizeSlider.addEventListener("input", () => {
  currentSize = Number(sizeSlider.value);
  sizeValue.textContent = currentSize + " px";
  updateRing();
  updateStylePreview();
  setStatus("Size: " + currentSize + " px");
});

// ---------- 10. Tools and brush styles ----------
function selectTool(tool) {
  currentTool = tool;
  brushBtn.classList.toggle("active", tool === "brush");
  eraserBtn.classList.toggle("active", tool === "eraser");
  toolInfo.textContent = tool === "eraser" ? "Eraser" : BRUSHES[currentStyle].name;
  updateRing();
  updateStylePreview();
  setStatus(tool === "eraser" ? "Eraser selected." : BRUSHES[currentStyle].name + " selected.");
}

function selectStyle(style) {
  currentStyle = style;
  styleButtons.forEach((b) => b.classList.toggle("active", b.dataset.style === style));
  selectTool("brush");                            // choosing a style switches back to the brush
}

brushBtn.addEventListener("click",  () => selectTool("brush"));
eraserBtn.addEventListener("click", () => selectTool("eraser"));
styleButtons.forEach((b) => b.addEventListener("click", () => selectStyle(b.dataset.style)));

// ---------- 11. Actions: Undo / Clear / Save ----------
undoBtn.addEventListener("click", undo);

clearBtn.addEventListener("click", () => {
  // Ask first: prevents accidental loss of the drawing
  if (!confirm("Clear the whole drawing?")) {
    setStatus("Clear cancelled.");
    return;
  }
  saveState();                       // so Undo can bring it back
  fillBackground();
  setStatus("Canvas cleared.", true);
});

saveBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "my-drawing.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
  setStatus("Drawing saved as my-drawing.png", true);
});

// ---------- 12. Keyboard shortcuts ----------
const STYLE_KEYS = ["pen", "marker", "pencil", "spray", "calligraphy", "glow", "rainbow"];

window.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === "z") {
    e.preventDefault();
    undo();
  } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    const key = e.key.toLowerCase();
    if (key === "b") selectTool("brush");
    if (key === "e") selectTool("eraser");
    if (key >= "1" && key <= "7") selectStyle(STYLE_KEYS[Number(key) - 1]);   // 1..7 = brush styles
  }
});

// ---------- 13. Initial state ----------
updateSwatches();
updateRing();
updateStylePreview();