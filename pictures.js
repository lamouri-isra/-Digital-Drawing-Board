// pictures.js
// Line-art pictures for the coloring page.
// Every picture is drawn with black outlines on a TRANSPARENT canvas.
// All shapes are CLOSED, so the fill tool stays inside each shape.

const TAU = Math.PI * 2;
const INK = "#2b2b2b";
const PIC_W = 800;
const PIC_H = 560;

// ---------- Small helpers ----------

// Prepare the canvas before drawing a picture
function prepare(ctx) {
  ctx.clearRect(0, 0, PIC_W, PIC_H);
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = INK;
}

// Draw a closed shape. First we erase the lines that are underneath
// (so shapes drawn later "cover" the earlier ones), then we draw the outline.
function shape(ctx, build) {
  ctx.beginPath();
  build(ctx);
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fill();
  ctx.restore();
  ctx.stroke();
}

// A simple straight line (open shape, never used to enclose a region alone)
function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// Shape builders (each one returns a function that adds a path to the context)
const circle = (x, y, r) => (c) => { c.arc(x, y, r, 0, TAU); };
const oval = (x, y, rx, ry, rot = 0) => (c) => { c.ellipse(x, y, rx, ry, rot, 0, TAU); };

const polygon = (pts) => (c) => {
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
};

const starShape = (cx, cy, R, r) => (c) => {
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + rad * Math.cos(a);
    const y = cy + rad * Math.sin(a);
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.closePath();
};

const cloudShape = (x, y, s) => (c) => {
  const P = (dx, dy) => [x + dx * s, y + dy * s];
  c.moveTo(...P(0, 55));
  c.bezierCurveTo(...P(-40, 55), ...P(-45, 5), ...P(0, 0));
  c.bezierCurveTo(...P(0, -40), ...P(65, -45), ...P(80, -5));
  c.bezierCurveTo(...P(110, -25), ...P(160, -5), ...P(145, 30));
  c.bezierCurveTo(...P(185, 35), ...P(180, 60), ...P(145, 55));
  c.closePath();
};

// A flower: stem, leaf, 5 petals, center
function flower(ctx, x, y) {
  line(ctx, x, y + 28, x, y + 72);
  shape(ctx, oval(x + 18, y + 52, 16, 8, -0.5));
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 5;
    shape(ctx, circle(x + 20 * Math.cos(a), y + 20 * Math.sin(a), 14));
  }
  shape(ctx, circle(x, y, 11));
}

// A fish (facing right, or left when flip = true)
function fish(ctx, x, y, s, flip = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -s : s, s);
  ctx.lineWidth = 5 / s;                    // keep the same line thickness at any size
  shape(ctx, polygon([[-110, 0], [-210, -75], [-190, 0], [-210, 75]]));   // tail
  shape(ctx, polygon([[-30, -75], [20, -150], [80, -70]]));               // top fin
  shape(ctx, polygon([[10, 70], [50, 125], [90, 65]]));                   // bottom fin
  shape(ctx, oval(0, 0, 140, 85));                                        // body
  shape(ctx, circle(75, -20, 17));                                        // eye
  shape(ctx, circle(79, -20, 6));                                         // pupil
  ctx.beginPath(); ctx.arc(78, 12, 26, 0.2, 1.2); ctx.stroke();           // smile
  ctx.beginPath(); ctx.arc(-5, 0, 22, -1.2, 1.2); ctx.stroke();           // scale
  ctx.beginPath(); ctx.arc(-45, 0, 22, -1.2, 1.2); ctx.stroke();          // scale
  ctx.restore();
  ctx.lineWidth = 5;
}

// A seaweed blade
function seaweed(ctx, x, base, h) {
  shape(ctx, (c) => {
    c.moveTo(x - 15, base);
    c.bezierCurveTo(x - 50, base - h * 0.35, x + 30, base - h * 0.7, x + 8, base - h);
    c.bezierCurveTo(x + 60, base - h * 0.7, x - 20, base - h * 0.35, x + 15, base);
    c.closePath();
  });
}

// ---------- Picture 1: the garden ----------
function drawGarden(ctx) {
  prepare(ctx);

  // sun rays + sun
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12;
    line(ctx, 680 + 62 * Math.cos(a), 95 + 62 * Math.sin(a),
              680 + 88 * Math.cos(a), 95 + 88 * Math.sin(a));
  }
  shape(ctx, circle(680, 95, 48));

  // clouds
  shape(ctx, cloudShape(70, 80, 1));
  shape(ctx, cloudShape(360, 50, 0.75));

  // ground line
  line(ctx, 0, 440, PIC_W, 440);

  // tree: trunk first, then the crown covers its top
  shape(ctx, polygon([[595, 440], [603, 330], [645, 330], [653, 440]]));
  shape(ctx, circle(624, 280, 80));
  shape(ctx, circle(595, 265, 10));
  shape(ctx, circle(650, 300, 10));
  shape(ctx, circle(620, 235, 10));

  // house: walls, chimney, then roof covers both
  shape(ctx, polygon([[290, 300], [490, 300], [490, 440], [290, 440]]));
  shape(ctx, polygon([[440, 262], [440, 195], [472, 195], [472, 282]]));
  shape(ctx, polygon([[262, 308], [390, 195], [518, 308]]));
  shape(ctx, polygon([[365, 365], [415, 365], [415, 440], [365, 440]]));  // door
  shape(ctx, circle(404, 405, 5));                                         // door knob
  shape(ctx, polygon([[305, 330], [345, 330], [345, 370], [305, 370]]));   // left window
  line(ctx, 325, 330, 325, 370);
  line(ctx, 305, 350, 345, 350);
  shape(ctx, polygon([[435, 330], [475, 330], [475, 370], [435, 370]]));   // right window
  line(ctx, 455, 330, 455, 370);
  line(ctx, 435, 350, 475, 350);

  // flowers in the grass
  flower(ctx, 90, 482);
  flower(ctx, 200, 485);
  flower(ctx, 470, 482);
  flower(ctx, 720, 482);
}

// ---------- Picture 2: the ocean ----------
function drawOcean(ctx) {
  prepare(ctx);

  // sand (curve from the left edge to the right edge)
  ctx.beginPath();
  ctx.moveTo(0, 505);
  ctx.bezierCurveTo(220, 470, 430, 545, PIC_W, 495);
  ctx.stroke();

  // seaweed
  seaweed(ctx, 60, 520, 150);
  seaweed(ctx, 125, 515, 100);
  seaweed(ctx, 705, 515, 140);
  seaweed(ctx, 765, 505, 90);

  // fish
  fish(ctx, 400, 270, 1.05);
  fish(ctx, 560, 432, 0.4, true);
  fish(ctx, 150, 150, 0.35);

  // bubbles
  shape(ctx, circle(640, 150, 15));
  shape(ctx, circle(675, 100, 22));
  shape(ctx, circle(620, 85, 10));

  // starfish on the sand
  shape(ctx, starShape(330, 534, 22, 9));
}

// ---------- Picture 3: space ----------
function drawSpace(ctx) {
  prepare(ctx);

  // stars
  const stars = [[90, 70, 22], [260, 45, 16], [600, 60, 20], [730, 230, 18],
                 [70, 330, 18], [190, 470, 22], [650, 500, 20], [520, 420, 14]];
  stars.forEach(([x, y, R]) => shape(ctx, starShape(x, y, R, R * 0.45)));

  // planet with a ring
  shape(ctx, circle(160, 190, 55));
  ctx.beginPath();
  ctx.ellipse(160, 190, 95, 22, -0.35, 0, TAU);
  ctx.stroke();

  // moon with craters
  shape(ctx, circle(680, 130, 48));
  shape(ctx, circle(665, 115, 9));
  shape(ctx, circle(695, 145, 7));
  shape(ctx, circle(690, 108, 5));

  // rocket: flame and fins first, body covers them
  shape(ctx, polygon([[350, 355], [375, 450], [400, 415], [425, 450], [450, 355]]));  // flame
  shape(ctx, polygon([[335, 270], [245, 385], [335, 365]]));                           // left fin
  shape(ctx, polygon([[465, 270], [555, 385], [465, 365]]));                           // right fin
  shape(ctx, (c) => {                                                                  // body
    c.moveTo(400, 60);
    c.bezierCurveTo(485, 135, 495, 250, 480, 360);
    c.lineTo(320, 360);
    c.bezierCurveTo(305, 250, 315, 135, 400, 60);
    c.closePath();
  });
  shape(ctx, circle(400, 175, 42));    // big window
  shape(ctx, circle(400, 175, 27));    // glass
  shape(ctx, circle(400, 275, 16));    // small window
}

const PICTURES = {
  garden: { name: "Garden", icon: "🏡", draw: drawGarden },
  ocean:  { name: "Ocean",  icon: "🐠", draw: drawOcean },
  space:  { name: "Space",  icon: "🚀", draw: drawSpace }
};

if (typeof module !== "undefined") module.exports = { PICTURES, PIC_W, PIC_H };