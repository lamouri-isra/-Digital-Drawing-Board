// coloring.js
// Coloring book: the child picks a picture and colors it.
//
// IDEA: two canvases are stacked on top of each other
//   - colorLayer (bottom): where the colors are painted
//   - lineLayer  (top)   : the black outlines of the picture (drawn by pictures.js)
// The outlines are never changed, so colors can never destroy the picture.

// ---------- 1. Get the elements ----------
const colorLayer = document.getElementById("colorLayer");
const lineLayer  = document.getElementById("lineLayer");
const colorCtx   = colorLayer.getContext("2d");
const lineCtx    = lineLayer.getContext("2d");
const stack      = document.getElementById("stack");

const pictureButtons = document.querySelectorAll("#pictureButtons button");
const fillBtn   = document.getElementById("fillBtn");
const brushBtn  = document.getElementById("brushBtn");
const eraserBtn = document.getElementById("eraserBtn");
const swatches  = document.querySelectorAll(".swatch");
const colorPicker = document.getElementById("colorPicker");
const sizeSlider  = document.getElementById("sizeSlider");
const sizeValue   = document.getElementById("sizeValue");
const undoBtn   = document.getElementById("undoBtn");
const resetBtn  = document.getElementById("resetBtn");
const saveBtn   = document.getElementById("saveBtn");
const statusBar = document.getElementById("status");
const statusDot = document.querySelector(".dot");
const toolInfo  = document.getElementById("toolInfo");
const colorInfo = document.getElementById("colorInfo");
const toast     = document.getElementById("toast");

// ---------- 2. Application state ----------
const WIDTH  = PIC_W;            // 800 (from pictures.js)
const HEIGHT = PIC_H;            // 560

let currentPicture = "garden";
let currentTool  = "fill";       // "fill", "brush" or "eraser"
let currentColor = colorPicker.value;
let currentSize  = Number(sizeSlider.value);

let boundary = null;             // 1 = black outline pixel, 0 = free pixel
let drawing = false;             // true while the finger/mouse is pressed (brush and eraser)
let previousPoint = null;

const history = [];              // snapshots of the color layer for Undo
const MAX_HISTORY = 20;

const PRAISE = ["Great job! 🌟", "Beautiful! 🎨", "Nice color! 👍", "Wonderful! ✨", "Amazing! 🌈", "Well done! 👏"];

// ---------- 3. Canvas setup ----------
colorLayer.width  = lineLayer.width  = WIDTH;
colorLayer.height = lineLayer.height = HEIGHT;
colorCtx.lineCap  = "round";
colorCtx.lineJoin = "round";

function whitePaper() {
  colorCtx.fillStyle = "#ffffff";
  colorCtx.fillRect(0, 0, WIDTH, HEIGHT);
}

// ---------- 4. Feedback helpers ----------
let toastTimer = null;
function setStatus(message, showToast = false) {
  statusBar.textContent = message;
  if (showToast) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1500);
  }
}

// ---------- 5. Load a picture ----------
function loadPicture(key) {
  currentPicture = key;
  PICTURES[key].draw(lineCtx);             // draw the outlines (pictures.js)

  // Remember where the black lines are: the fill tool must never cross them
  const data = lineCtx.getImageData(0, 0, WIDTH, HEIGHT).data;
  boundary = new Uint8Array(WIDTH * HEIGHT);
  for (let i = 0; i < WIDTH * HEIGHT; i++) {
    boundary[i] = data[i * 4 + 3] > 128 ? 1 : 0;     // alpha > 128 = a line pixel
  }

  whitePaper();
  history.length = 0;
  pictureButtons.forEach((b) => b.classList.toggle("active", b.dataset.picture === key));
  setStatus("New picture: " + PICTURES[key].name + ". Tap inside a shape to color it!");
}

// ---------- 6. Mouse / finger position ----------
// The canvas has a fixed size (800x560) but is displayed at any size,
// so we convert the screen position to canvas pixels.
function getPosition(event) {
  const rect = lineLayer.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) * WIDTH)  / rect.width);
  const y = Math.floor(((event.clientY - rect.top)  * HEIGHT) / rect.height);
  return {
    x: Math.min(WIDTH - 1,  Math.max(0, x)),
    y: Math.min(HEIGHT - 1, Math.max(0, y))
  };
}

// ---------- 7. Undo ----------
function saveState() {
  history.push(colorCtx.getImageData(0, 0, WIDTH, HEIGHT));
  if (history.length > MAX_HISTORY) history.shift();
}

function undo() {
  if (history.length === 0) {
    setStatus("Nothing to undo.", true);
    return;
  }
  colorCtx.putImageData(history.pop(), 0, 0);
  setStatus("Last action undone.", true);
}

// ---------- 8. FILL TOOL (flood fill) ----------
// Starts at the tapped pixel and spreads to the neighbours (up, down, left, right)
// until it meets a black line or the edge of the picture.
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function fillShape(start) {
  const startIndex = start.y * WIDTH + start.x;

  // The child tapped exactly on a black line
  if (boundary[startIndex] === 1) {
    setStatus("Oops, that is a line! Tap inside a shape.", true);
    return;
  }

  saveState();

  const image = colorCtx.getImageData(0, 0, WIDTH, HEIGHT);
  const pixels = image.data;
  const [r, g, b] = hexToRgb(currentColor);

  const visited = new Uint8Array(WIDTH * HEIGHT);
  const pending = [startIndex];            // pixels waiting to be painted
  visited[startIndex] = 1;

  while (pending.length > 0) {
    const p = pending.pop();
    const x = p % WIDTH;

    // paint this pixel
    const o = p * 4;
    pixels[o] = r; pixels[o + 1] = g; pixels[o + 2] = b; pixels[o + 3] = 255;

    // look at the 4 neighbours: left, right, up, down
    if (x > 0          && !visited[p - 1]     && !boundary[p - 1])     { visited[p - 1] = 1;     pending.push(p - 1); }
    if (x < WIDTH - 1  && !visited[p + 1]     && !boundary[p + 1])     { visited[p + 1] = 1;     pending.push(p + 1); }
    if (p >= WIDTH     && !visited[p - WIDTH] && !boundary[p - WIDTH]) { visited[p - WIDTH] = 1; pending.push(p - WIDTH); }
    if (p < WIDTH * (HEIGHT - 1) && !visited[p + WIDTH] && !boundary[p + WIDTH]) { visited[p + WIDTH] = 1; pending.push(p + WIDTH); }
  }

  colorCtx.putImageData(image, 0, 0);

  // Encouraging feedback + a small animation
  setStatus(PRAISE[Math.floor(Math.random() * PRAISE.length)], true);
  stack.classList.remove("pop");
  void stack.offsetWidth;                                  // restart the animation
  stack.classList.add("pop");
}

// ---------- 9. BRUSH and ERASER ----------
// Same idea as the drawing board: connect the previous point to the new one.
function strokeColor() {
  return currentTool === "eraser" ? "#ffffff" : currentColor;
}

function drawLineSegment(from, to) {
  colorCtx.strokeStyle = strokeColor();
  colorCtx.lineWidth   = currentSize;
  colorCtx.beginPath();
  colorCtx.moveTo(from.x, from.y);
  colorCtx.lineTo(to.x, to.y);
  colorCtx.stroke();
}

function drawDot(point) {
  colorCtx.fillStyle = strokeColor();
  colorCtx.beginPath();
  colorCtx.arc(point.x, point.y, currentSize / 2, 0, Math.PI * 2);
  colorCtx.fill();
}

// ---------- 10. Pointer events (mouse + finger + pen in one) ----------
lineLayer.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  const point = getPosition(e);

  if (currentTool === "fill") {
    fillShape(point);
    return;
  }

  // brush or eraser: start a stroke
  saveState();
  drawing = true;
  previousPoint = point;
  lineLayer.setPointerCapture(e.pointerId);     // keep receiving events even outside the canvas
  drawDot(point);
  statusDot.classList.add("busy");
  setStatus(currentTool === "eraser" ? "Erasing..." : "Painting...");
});

lineLayer.addEventListener("pointermove", (e) => {
  if (!drawing) return;
  const point = getPosition(e);
  drawLineSegment(previousPoint, point);
  previousPoint = point;
});

function stopDrawing() {
  if (!drawing) return;
  drawing = false;
  previousPoint = null;
  statusDot.classList.remove("busy");
  setStatus("Nice! Keep going.");
}
lineLayer.addEventListener("pointerup", stopDrawing);
lineLayer.addEventListener("pointercancel", stopDrawing);

// ---------- 11. Tools ----------
function selectTool(tool) {
  currentTool = tool;
  fillBtn.classList.toggle("active",   tool === "fill");
  brushBtn.classList.toggle("active",  tool === "brush");
  eraserBtn.classList.toggle("active", tool === "eraser");
  stack.className = "stack tool-" + tool;                   // changes the cursor
  toolInfo.textContent = { fill: "Fill", brush: "Brush", eraser: "Eraser" }[tool];

  const messages = {
    fill:   "Fill: tap inside a shape to color it.",
    brush:  "Brush: draw with your finger or mouse.",
    eraser: "Eraser: rub out the colors you don't want."
  };
  setStatus(messages[tool]);
}
fillBtn.addEventListener("click",   () => selectTool("fill"));
brushBtn.addEventListener("click",  () => selectTool("brush"));
eraserBtn.addEventListener("click", () => selectTool("eraser"));

// ---------- 12. Colors and size ----------
function setColor(color) {
  currentColor = color;
  colorPicker.value = color;
  colorInfo.style.background = color;                       // the badge shows the selected color
  colorInfo.style.color = isDark(color) ? "#fff" : "#111";
  colorInfo.textContent = "Color";
  swatches.forEach((s) => s.classList.toggle("active", s.dataset.color.toLowerCase() === color.toLowerCase()));
  if (currentTool === "eraser") selectTool("fill");         // choosing a color leaves the eraser
  setStatus("Color selected. Now tap a shape!");
}

// Is the color dark? (to choose a readable text color)
function isDark(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

swatches.forEach((s) => s.addEventListener("click", () => setColor(s.dataset.color)));
colorPicker.addEventListener("input", () => setColor(colorPicker.value));

sizeSlider.addEventListener("input", () => {
  currentSize = Number(sizeSlider.value);
  sizeValue.textContent = currentSize + " px";
  setStatus("Brush size: " + currentSize + " px");
});

// ---------- 13. Pictures, Undo, Start over, Save ----------
pictureButtons.forEach((b) => b.addEventListener("click", () => {
  // Changing the picture erases the colors, so ask first (error prevention)
  if (history.length > 0 && !confirm("Change the picture? Your colors will be lost.")) return;
  loadPicture(b.dataset.picture);
}));

undoBtn.addEventListener("click", undo);

resetBtn.addEventListener("click", () => {
  if (!confirm("Start this picture again?")) {
    setStatus("OK, nothing changed.");
    return;
  }
  saveState();                  // Undo can still bring the colors back
  whitePaper();
  setStatus("Fresh picture, ready to color!", true);
});

saveBtn.addEventListener("click", () => {
  // Combine the two layers (colors + outlines) in a temporary canvas
  const output = document.createElement("canvas");
  output.width = WIDTH;
  output.height = HEIGHT;
  const outCtx = output.getContext("2d");
  outCtx.drawImage(colorLayer, 0, 0);
  outCtx.drawImage(lineLayer, 0, 0);

  const link = document.createElement("a");
  link.download = "my-colored-" + currentPicture + ".png";
  link.href = output.toDataURL("image/png");
  link.click();
  setStatus("Saved! 🎉", true);
});

// ---------- 14. Keyboard shortcuts ----------
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === "z") {
    e.preventDefault();
    undo();
  } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.key.toLowerCase() === "f") selectTool("fill");
    if (e.key.toLowerCase() === "b") selectTool("brush");
    if (e.key.toLowerCase() === "e") selectTool("eraser");
  }
});

// ---------- 15. Start ----------
loadPicture("garden");
setColor(currentColor);
setStatus("Choose a color, then tap inside a shape to fill it!");