// Rendering: draws the night, the house, the posed figure, what he holds and his speech bubble onto a 2D canvas.
// Knows nothing about behaviour; it is handed what to show. House positions are units, converted to pixels here only.
//
// Night-time and cosy: a navy sky with stars and a moon, the house a dark silhouette, every room lit warmly from
// inside by its own lamp. Furniture is dark brown line against the light; the figure is the darkest shape of all, with
// a faint warm rim so he still reads outside in the dark. Glows are added light ("lighter"), drawn before the figure
// so they never wash him out.

import { CHAPTERS, type ProjectId, type RoomId } from "@/content/story";
import type { Action } from "./character/body";
import type { Point, Pose } from "./character/pose";
import { FLOORS, FURNITURE, HOUSE, ITEMS, ITEM_SIZE, ROOMS, SLAB, STAIRS, WALL, roofAt, screenX, screenY, type View } from "./house";

/** The palette. Everything on the canvas is one of these (or a light's own colour). */
export const NIGHT = {
  line: "#2a1a10", // dark brown ink, inside the lit rooms
  lineRGB: "42, 26, 16",
  body: "#191d33", // the house's walls, floors and roof
  rimRGB: "150, 160, 210", // moonlit edges
  ground: "#0a0f1f",
  hillFar: "#141b3b",
  hillNear: "#0f152c",
  figure: "#120b07",
  rimFigure: "rgba(255, 214, 150, 0.38)",
  bubble: "#fff3dc",
  cream: "#f3e6cf",
};
const HAND = `"Noteworthy", "Bradley Hand", "Segoe Print", "Chalkboard SE", cursive`;
const SERIF = `Georgia, "Times New Roman", serif`;

type RGB = readonly [number, number, number];
const rgba = (c: RGB, a: number) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

/** Small, stable pseudo-random numbers for placement and wobble (the same every frame). */
const hash = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** What the house shows besides its furniture. */
export interface HouseState {
  hover: RoomId | null; // the room under the pointer: a little brighter, and its name
  hoverItem: ProjectId | null; // the thing on the bench under the pointer
  holding: ProjectId | null; // off the bench, in his hands
  typed: number; // seconds typed: the lines on his screen grow with it
  typing: boolean; // the screen flickers a little while he types
  time: number; // seconds: stars, smoke, fireflies, a shooting star now and then
}

type Ctx = CanvasRenderingContext2D;

function pen(ctx: Ctx, view: View) {
  const { unit } = view;
  const X = (x: number) => screenX(view, x);
  const Y = (y: number) => screenY(view, y);
  return {
    X,
    Y,
    line(x0: number, y0: number, x1: number, y1: number) {
      ctx.moveTo(X(x0), Y(y0));
      ctx.lineTo(X(x1), Y(y1));
    },
    rect(x0: number, y0: number, x1: number, y1: number) {
      ctx.rect(X(x0), Y(y1), (x1 - x0) * unit, (y1 - y0) * unit);
    },
    poly(points: readonly (readonly [number, number])[]) {
      points.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      ctx.closePath();
    },
    /** Dark brown ink, as Jimmy's faint lines were, but strong enough to read against lamp light. */
    stroke(alpha: number, width = 0.018, color = NIGHT.line) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.lineWidth = Math.max(1, unit * width);
      ctx.stroke();
    },
    fill(color: string, alpha = 1) {
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fill();
    },
    text(s: string, x: number, y: number, size: number, alpha: number, color = NIGHT.line, align: CanvasTextAlign = "left", font = HAND) {
      if (size * unit < 7) return; // too small to read: left out rather than smudged
      ctx.font = `${size * unit}px ${font}`;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillText(s, X(x), Y(y));
    },
    /** Added light: a soft round glow of radius r (units). */
    glow(x: number, y: number, r: number, color: RGB, alpha: number) {
      const g = ctx.createRadialGradient(X(x), Y(y), 0, X(x), Y(y), r * unit);
      g.addColorStop(0, rgba(color, alpha));
      g.addColorStop(0.4, rgba(color, alpha * 0.35));
      g.addColorStop(1, rgba(color, 0));
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(X(x) - r * unit, Y(y) - r * unit, r * unit * 2, r * unit * 2);
      ctx.restore();
    },
  };
}
type Pen = ReturnType<typeof pen>;

// ── The rooms' light ────────────────────────────────────────────────────────

interface Light {
  x: number; // the lamp, house units
  y: number;
  r: number; // how far the light reaches (units)
  inner: RGB; // the wall by the lamp…
  outer: RGB; // …and in the far corners
}

const { first, attic } = FLOORS;
const F = FURNITURE;
const LIGHTS: Record<RoomId, Light> = {
  office: { x: F.lamp.x - 0.1, y: F.lamp.top, r: 4.6, inner: [255, 212, 148], outer: [104, 64, 42] },
  door: { x: F.hallLamp.x, y: F.hallLamp.h, r: 5.4, inner: [255, 198, 136], outer: [96, 58, 40] },
  library: { x: F.readingLamp.x - 0.1, y: first + F.readingLamp.top, r: 5.2, inner: [255, 204, 140], outer: [92, 56, 40] },
  workshop: { x: F.workLamp.x, y: first + F.workLamp.h, r: 5.0, inner: [255, 226, 172], outer: [104, 70, 46] },
  attic: { x: (F.crt.left + F.crt.right) / 2, y: attic + 0.7, r: 4.4, inner: [214, 186, 140], outer: [52, 42, 52] },
};

/** The inside of each room: what gets lit (walls and floor slabs are the house's dark body around these). */
function roomShape(p: Pen, id: RoomId): void {
  const W = HOUSE.width;
  const top1 = first - SLAB;
  const top2 = attic - SLAB;
  switch (id) {
    case "office":
      return p.poly([[WALL, 0], [5.0, 0], [5.0, top1], [WALL, top1]]);
    case "door":
      // To the outer edge of the wall below the door's lintel: the doorway is open.
      return p.poly([[5.0, 0], [W, 0], [W, F.door.top], [W - WALL, F.door.top], [W - WALL, top1], [5.0, top1]]);
    case "library":
      return p.poly([[WALL, first], [5.6, first], [5.6, top2], [WALL, top2]]);
    case "workshop":
      return p.poly([[5.6, first], [W - WALL, first], [W - WALL, top2], [5.6, top2]]);
    case "attic": {
      const inset = 0.13; // the roof's thickness
      const slope = (HOUSE.peak - attic) / (W / 2 + HOUSE.overhang);
      const eave = attic + (WALL + HOUSE.overhang) * slope - inset;
      return p.poly([[WALL, attic], [W - WALL, attic], [W - WALL, Math.max(attic, eave)], [W / 2, HOUSE.peak - inset / Math.cos(Math.atan(slope))], [WALL, Math.max(attic, eave)]]);
    }
  }
}

function lightRoom(ctx: Ctx, view: View, p: Pen, id: RoomId, brighter: number): void {
  const L = LIGHTS[id];
  const g = ctx.createRadialGradient(p.X(L.x), p.Y(L.y), 0, p.X(L.x), p.Y(L.y), L.r * view.unit);
  const lift = (c: RGB) => c.map((v) => Math.min(255, Math.round(v * (1 + brighter)))) as unknown as RGB;
  const inner = lift(L.inner);
  const outer = lift(L.outer);
  const mid: RGB = [(inner[0] * 2 + outer[0]) / 3, (inner[1] * 2 + outer[1]) / 3, (inner[2] * 2 + outer[2]) / 3];
  g.addColorStop(0, rgba(inner, 1));
  g.addColorStop(0.45, rgba(mid, 1));
  g.addColorStop(1, rgba(outer, 1));
  ctx.beginPath();
  roomShape(p, id);
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.fill();
}

// ── The night outside ───────────────────────────────────────────────────────

/** Stars over the whole sky (screen space, so they don't crowd when the house is small), the moon, a shooting star. */
function drawSky(ctx: Ctx, view: View, p: Pen, time: number): void {
  const horizon = p.Y(0.6);
  ctx.fillStyle = NIGHT.cream;
  for (let i = 0; i < 170; i++) {
    const x = hash(i * 3 + 1) * view.width;
    const y = Math.pow(hash(i * 3 + 2), 1.4) * horizon;
    const twinkle = 0.55 + 0.45 * Math.sin(time * (0.6 + hash(i) * 1.8) + i);
    const size = 0.5 + hash(i * 7) * (hash(i * 11) > 0.92 ? 1.4 : 0.8);
    ctx.globalAlpha = (0.25 + 0.6 * hash(i * 5)) * twinkle;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // The moon: a soft halo, the disc, a couple of faint seas.
  const m = F.moon;
  p.glow(m.x, m.h, m.r * 5, [150, 170, 230], 0.16);
  ctx.beginPath();
  ctx.arc(p.X(m.x), p.Y(m.h), m.r * view.unit, 0, Math.PI * 2);
  p.fill("#f4ecd6", 0.95);
  ctx.beginPath();
  ctx.arc(p.X(m.x - 0.1), p.Y(m.h + 0.08), m.r * 0.28 * view.unit, 0, Math.PI * 2);
  ctx.arc(p.X(m.x + 0.12), p.Y(m.h - 0.1), m.r * 0.18 * view.unit, 0, Math.PI * 2);
  p.fill("#d9cfb4", 0.6);

  // Now and then a shooting star, high up, gone in a second.
  const period = 19;
  const k = Math.floor(time / period);
  const t = time - k * period;
  if (t < 1.1 && k > 0) {
    const sx = (0.15 + 0.7 * hash(k * 13)) * view.width;
    const sy = (0.08 + 0.25 * hash(k * 17)) * horizon;
    const len = 140;
    const u = t / 1.1;
    const hx = sx + len * 1.6 * u;
    const hy = sy + len * 0.55 * u;
    const g = ctx.createLinearGradient(hx - len, hy - len * 0.34, hx, hy);
    g.addColorStop(0, "rgba(243, 230, 207, 0)");
    g.addColorStop(1, `rgba(243, 230, 207, ${0.85 * Math.sin(Math.PI * u)})`);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(hx - len, hy - len * 0.34);
    ctx.lineTo(hx, hy);
    ctx.stroke();
  }
}

/** Hills, the ground and the tree: dark shapes behind and around the house. */
function drawLand(ctx: Ctx, view: View, p: Pen): void {
  const leftEdge = (0 - view.left) / view.unit - 1;
  const rightEdge = (view.width - view.left) / view.unit + 1;
  const hills = (base: number, a: number, b: number, color: string) => {
    ctx.beginPath();
    ctx.moveTo(p.X(leftEdge), p.Y(0));
    for (let i = 0; i <= 60; i++) {
      const x = leftEdge + ((rightEdge - leftEdge) * i) / 60;
      ctx.lineTo(p.X(x), p.Y(base + a * Math.sin(x * 0.33 + 1.2) + b * Math.sin(x * 0.81 + base)));
    }
    ctx.lineTo(p.X(rightEdge), p.Y(0));
    ctx.closePath();
    p.fill(color);
  };
  hills(1.25, 0.45, 0.2, NIGHT.hillFar);
  hills(0.55, 0.25, 0.12, NIGHT.hillNear);
  ctx.globalAlpha = 1;
  ctx.fillStyle = NIGHT.ground;
  ctx.fillRect(0, p.Y(0), view.width, view.height - p.Y(0));
  ctx.beginPath();
  p.line(leftEdge, 0, rightEdge, 0);
  p.stroke(0.25, 0.012, `rgb(${NIGHT.rimRGB})`);

  // The tree: a dark trunk and crown with a moonlit edge.
  const t = F.tree.x;
  ctx.beginPath();
  for (let i = 0; i <= 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const r = 0.62 + 0.06 * Math.sin(a * 5 + 1) + 0.04 * Math.sin(a * 9);
    const x = t + 0.05 + Math.cos(a) * r;
    const y = 1.62 + Math.sin(a) * r * 0.9;
    if (i === 0) ctx.moveTo(p.X(x), p.Y(y));
    else ctx.lineTo(p.X(x), p.Y(y));
  }
  ctx.closePath();
  p.fill("#0c1228");
  p.stroke(0.22, 0.012, `rgb(${NIGHT.rimRGB})`);
  ctx.beginPath();
  p.line(t, 0, t, 1.1);
  p.line(t, 0.8, t + 0.25, 1.15);
  p.stroke(1, 0.05, "#0c1228");
}

/** Out front, after the house: light from the door and the porch, the mailbox, smoke, fireflies. */
function drawFront(ctx: Ctx, view: View, p: Pen, time: number): void {
  const W = HOUSE.width;
  // Light spilling out of the open door onto the ground.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const spill = ctx.createLinearGradient(p.X(W), 0, p.X(W + 1.8), 0);
  spill.addColorStop(0, "rgba(255, 196, 120, 0.22)");
  spill.addColorStop(1, "rgba(255, 196, 120, 0)");
  ctx.beginPath();
  p.poly([[W, 0], [W + 1.9, -0.32], [W + 1.9, -0.05], [W, 0.0]]);
  ctx.fillStyle = spill;
  ctx.fill();
  ctx.restore();

  // The porch light: a little lamp on the wall and its pool of light.
  const po = F.porch;
  ctx.beginPath();
  p.rect(po.x - 0.05, po.h - 0.07, po.x + 0.05, po.h + 0.06);
  p.fill("#ffd796", 0.95);
  p.glow(po.x, po.h, 1.9, [255, 190, 110], 0.42);
  p.glow(po.x, po.h, 0.35, [255, 230, 180], 0.6);

  // The mailbox by the step, lit by the porch, "hello" on it.
  const mb = F.mailbox;
  ctx.beginPath();
  p.rect(mb.x - 0.025, 0, mb.x + 0.025, mb.h);
  p.fill("#3a2a20");
  ctx.beginPath();
  p.rect(mb.x - 0.18, mb.h, mb.x + 0.18, mb.h + 0.21);
  p.fill("#7a4b34");
  p.stroke(0.6, 0.012, "#2a1a10");
  ctx.beginPath();
  p.line(mb.x + 0.18, mb.h + 0.21, mb.x + 0.18, mb.h + 0.34); // the flag, up: there's mail
  p.stroke(0.9, 0.016, "#d9603b");
  ctx.beginPath();
  p.poly([[mb.x + 0.18, mb.h + 0.34], [mb.x + 0.3, mb.h + 0.31], [mb.x + 0.18, mb.h + 0.27]]);
  p.fill("#d9603b");
  p.text("hello", mb.x, mb.h + 0.105, 0.075, 0.9, NIGHT.cream, "center");

  // Smoke from the chimney, drifting up and fading into the dark.
  const c = F.chimney;
  for (let i = 0; i < 4; i++) {
    const u = (time * 0.1 + i / 4) % 1;
    const x = (c.left + c.right) / 2 + u * 0.6 + 0.08 * Math.sin(time * 0.7 + i * 2);
    const y = c.top + 0.1 + u * 0.9;
    ctx.beginPath();
    ctx.arc(p.X(x), p.Y(y), view.unit * (0.06 + u * 0.09), 0, Math.PI * 2);
    p.fill("rgb(170, 180, 215)", 0.12 * (1 - u));
  }

  // Fireflies: by the tree and over the grass by the step, wandering and pulsing.
  for (let i = 0; i < 11; i++) {
    const home = i < 7 ? F.tree.x + (hash(i) - 0.5) * 2.4 : W + 1.0 + hash(i) * 1.8;
    const x = home + 0.35 * Math.sin(time * (0.21 + hash(i + 3) * 0.2) + i * 1.7);
    const y = 0.25 + hash(i + 7) * 1.5 + 0.2 * Math.sin(time * (0.33 + hash(i + 5) * 0.25) + i);
    const pulse = Math.max(0, Math.sin(time * (0.9 + hash(i + 9)) + i * 2.3));
    if (pulse < 0.05) continue;
    p.glow(x, y, 0.18, [210, 255, 140], 0.55 * pulse);
    ctx.beginPath();
    ctx.arc(p.X(x), p.Y(y), Math.max(1, view.unit * 0.012), 0, Math.PI * 2);
    p.fill("#eaffb0", pulse);
  }
  ctx.globalAlpha = 1;
}

// ── The house ───────────────────────────────────────────────────────────────

function drawShell(ctx: Ctx, view: View, p: Pen, state: HouseState): void {
  const W = HOUSE.width;
  const rim = `rgb(${NIGHT.rimRGB})`;

  // The house's dark body: walls and floors, the roof, the chimney, a footing.
  ctx.beginPath();
  p.poly([[0, -0.12], [W, -0.12], [W, attic], [W + HOUSE.overhang, attic], [W / 2, HOUSE.peak], [-HOUSE.overhang, attic], [0, attic]]);
  p.fill(NIGHT.body);
  const c = F.chimney;
  ctx.beginPath();
  p.poly([[c.left, roofAt(c.left) - 0.1], [c.left, c.top], [c.right, c.top], [c.right, roofAt(c.right) - 0.1]]);
  p.fill(NIGHT.body);
  // Moonlight along the roof and the chimney's top.
  ctx.beginPath();
  p.line(-HOUSE.overhang, attic, W / 2, HOUSE.peak);
  p.line(W / 2, HOUSE.peak, W + HOUSE.overhang, attic);
  p.line(c.left, c.top, c.right, c.top);
  p.stroke(0.45, 0.016, rim);

  // Every room lit from inside (the one under the pointer a little brighter).
  for (const id of Object.keys(LIGHTS) as RoomId[]) lightRoom(ctx, view, p, id, id === state.hover ? 0.12 : 0);

  // Inner walls above the doorways (the house's body colour), and a skirting line along each floor.
  ctx.beginPath();
  p.rect(5.0 - WALL / 2, F.door.top, 5.0 + WALL / 2, first - SLAB);
  p.rect(5.6 - WALL / 2, first + 1.3, 5.6 + WALL / 2, attic - SLAB);
  p.fill(NIGHT.body);
  ctx.beginPath();
  p.line(WALL, 0.07, W - WALL, 0.07);
  p.line(WALL, first + 0.07, W - WALL, first + 0.07);
  p.stroke(0.25, 0.01);

  // Stairs along the back wall: treads, and a handrail that stops at the floor above.
  for (const s of STAIRS) {
    const y0 = FLOORS[s.lower];
    const y1 = FLOORS[s.upper];
    const steps = 9;
    ctx.beginPath();
    for (let i = 0; i < steps; i++) {
      const xa = s.bottom + ((s.top - s.bottom) * i) / steps;
      const xb = s.bottom + ((s.top - s.bottom) * (i + 1)) / steps;
      const ya = y0 + ((y1 - y0) * i) / steps;
      const yb = y0 + ((y1 - y0) * (i + 1)) / steps;
      p.line(xa, ya, xa, yb);
      p.line(xa, yb, xb, yb);
    }
    p.stroke(0.45, 0.014);
    const rail = 0.75;
    const end = (y1 - y0 - rail) / (y1 - y0);
    ctx.beginPath();
    p.line(s.bottom, y0 + rail, s.bottom + (s.top - s.bottom) * end, y1 - SLAB);
    p.line(s.bottom, y0, s.bottom, y0 + rail);
    p.stroke(0.3, 0.012);
  }

  // The front door, standing open onto the step: dark wood, its inner edge catching the hall light.
  ctx.beginPath();
  p.poly([[W, 0], [W + 0.32, 0.07], [W + 0.32, F.door.top - 0.03], [W, F.door.top - 0.06]]);
  p.fill("#3b2618");
  ctx.beginPath();
  p.line(W + 0.01, 0.02, W + 0.01, F.door.top - 0.07);
  p.stroke(0.7, 0.014, "#ffcf8a");
  ctx.beginPath();
  p.line(W + 0.27, 0.62, W + 0.27, 0.66); // the handle
  p.stroke(0.9, 0.02, "#e8b766");
  ctx.beginPath();
  p.rect(W, -0.06, W + 0.55, 0); // the step
  p.fill(NIGHT.body);

  // The name of the room under the pointer, written on its wall.
  if (state.hover) {
    const r = ROOMS[state.hover];
    p.text(CHAPTERS[state.hover].name, r.label.x, r.y0 + r.label.h - 0.04, 0.13, 0.75);
  }
}

/** A lamp shade: a small filled trapezoid, bright, with a glow. */
function shade(p: Pen, x: number, y: number, w: number, h: number): void {
  p.poly([[x - w * 0.35, y], [x + w * 0.35, y], [x + w * 0.5, y - h], [x - w * 0.5, y - h]]);
}

const BOOK_COLOURS = ["#7b2f2a", "#2f4a3a", "#2c3a5e", "#8a6a2a", "#5a2f4a", "#3f5a5a", "#7a4a2a"];

function drawRooms(ctx: Ctx, view: View, p: Pen, state: HouseState): void {
  // ── Office: chair, desk, the glowing screen, the desk lamp, the board with the numbers.
  const ch = F.chair;
  ctx.beginPath();
  p.line(ch.left, 0, ch.left, ch.back);
  p.line(ch.left, ch.seat, ch.right, ch.seat);
  p.line(ch.right, ch.seat, ch.right, 0);
  const dk = F.desk;
  p.line(dk.left, dk.top, dk.left, 0);
  p.line(dk.right, dk.top, dk.right, 0);
  p.stroke(0.75);
  ctx.beginPath();
  p.rect(dk.left - 0.05, dk.top - 0.035, dk.right + 0.05, dk.top);
  p.fill("#4a2e1c");
  const sc = F.screen;
  ctx.beginPath();
  p.line((sc.left + sc.right) / 2, dk.top, (sc.left + sc.right) / 2, sc.bottom);
  p.stroke(0.8, 0.02);
  ctx.beginPath();
  p.rect(sc.left - 0.02, sc.bottom - 0.02, sc.right + 0.02, sc.top + 0.02);
  p.fill("#1d2440");
  const flicker = state.typing ? 0.06 * Math.sin(state.time * 23) * Math.sin(state.time * 7.1) : 0;
  ctx.beginPath();
  p.rect(sc.left, sc.bottom, sc.right, sc.top);
  p.fill("#9fc6ff", 0.9 + flicker);
  // Code on the screen: lines that grow while he types.
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const len = 0.08 + 0.2 * hash(i + Math.floor(state.typed / 3) * 5);
    const indent = (i % 3) * 0.03;
    const y = sc.top - 0.045 - i * 0.042;
    p.line(sc.left + 0.04 + indent, y, Math.min(sc.right - 0.04, sc.left + 0.04 + indent + len), y);
  }
  p.stroke(0.7, 0.01, "#24345e");
  ctx.beginPath();
  p.line(F.lamp.x, dk.top, F.lamp.x, F.lamp.top);
  p.line(F.lamp.x, F.lamp.top, F.lamp.x - 0.12, F.lamp.top - 0.05);
  p.stroke(0.8);
  ctx.beginPath();
  shade(p, F.lamp.x - 0.14, F.lamp.top - 0.03, 0.18, 0.09);
  p.fill("#ffe0a6");
  // The board above the desk: what the work did, pinned up on cork.
  const bd = F.board;
  ctx.beginPath();
  p.rect(bd.left, bd.bottom, bd.right, bd.top);
  p.fill("#b98a5a");
  p.stroke(0.7, 0.016);
  ctx.beginPath();
  p.rect(bd.left + 0.05, bd.top - 0.36, bd.left + 0.6, bd.top - 0.05);
  p.fill("#fff4dc", 0.95);
  p.text("62 → 91", bd.left + 0.08, bd.top - 0.14, 0.11, 0.9);
  p.text("−35% load", bd.left + 0.08, bd.top - 0.28, 0.085, 0.75);
  ctx.beginPath();
  p.rect(bd.right - 0.42, bd.bottom + 0.05, bd.right - 0.05, bd.bottom + 0.38);
  p.fill("#ffe58a", 0.95);
  ctx.beginPath();
  p.line(bd.right - 0.36, bd.bottom + 0.1, bd.right - 0.26, bd.bottom + 0.2);
  p.line(bd.right - 0.26, bd.bottom + 0.2, bd.right - 0.18, bd.bottom + 0.15);
  p.line(bd.right - 0.18, bd.bottom + 0.15, bd.right - 0.09, bd.bottom + 0.33); // a line going up
  p.stroke(0.9, 0.013, "#2f6a3a");

  // ── Hall: a window onto the night, a plant, coats, the pendant lamp, the mat by the door.
  const hw = F.hallWindow;
  ctx.beginPath();
  p.rect(hw.left, hw.sill, hw.right, hw.top);
  p.fill("#1a2550");
  ctx.fillStyle = NIGHT.cream;
  for (let i = 0; i < 5; i++) {
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(state.time * (0.7 + i * 0.3) + i);
    ctx.beginPath();
    ctx.arc(p.X(hw.left + 0.1 + hash(i + 40) * 0.7), p.Y(hw.sill + 0.15 + hash(i + 60) * 0.5), 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  p.rect(hw.left, hw.sill, hw.right, hw.top);
  p.line((hw.left + hw.right) / 2, hw.sill, (hw.left + hw.right) / 2, hw.top);
  p.line(hw.left - 0.06, hw.sill - 0.015, hw.right + 0.06, hw.sill - 0.015);
  p.stroke(0.85, 0.022);
  const pl = F.plant.x;
  ctx.beginPath();
  p.poly([[pl - 0.12, 0], [pl + 0.12, 0], [pl + 0.15, 0.24], [pl - 0.15, 0.24]]);
  p.fill("#9a4e2e");
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = -1.2 + (i / 6) * 2.4;
    ctx.moveTo(p.X(pl), p.Y(0.24));
    ctx.quadraticCurveTo(p.X(pl + Math.sin(a) * 0.15), p.Y(0.45), p.X(pl + Math.sin(a) * 0.3), p.Y(0.42 + Math.cos(a) * 0.25));
  }
  p.stroke(0.95, 0.03, "#2f5a33");
  ctx.beginPath();
  p.line(F.coats.x, 0, F.coats.x, 1.32);
  p.line(F.coats.x - 0.12, 1.3, F.coats.x + 0.12, 1.3);
  p.line(F.coats.x - 0.25, 0, F.coats.x, 0.06);
  p.line(F.coats.x + 0.25, 0, F.coats.x, 0.06);
  p.stroke(0.75);
  ctx.beginPath();
  ctx.moveTo(p.X(F.coats.x + 0.06), p.Y(1.28));
  ctx.quadraticCurveTo(p.X(F.coats.x + 0.3), p.Y(1.0), p.X(F.coats.x + 0.2), p.Y(0.66));
  ctx.lineTo(p.X(F.coats.x + 0.06), p.Y(0.7));
  ctx.closePath();
  p.fill("#5a6a8a"); // a blue coat
  ctx.beginPath();
  p.line(F.hallLamp.x, first - SLAB, F.hallLamp.x, F.hallLamp.h + 0.05);
  p.stroke(0.7, 0.01);
  ctx.beginPath();
  shade(p, F.hallLamp.x, F.hallLamp.h + 0.06, 0.24, 0.1);
  p.fill("#ffdca0");
  ctx.beginPath();
  p.rect(F.mat.left, 0, F.mat.right, 0.025);
  p.fill("#7a3a2a");

  // ── Library: tall shelves of coloured books, a rug, an armchair and a reading lamp.
  const sh = F.shelf;
  ctx.beginPath();
  p.rect(sh.left, first, sh.right, first + sh.top);
  p.fill("#5a3a24", 0.35);
  let n = 0;
  for (let ri = 0; ri < sh.rows.length; ri++) {
    let x = sh.left + 0.06;
    while (x < sh.right - 0.1) {
      const w = 0.035 + hash(n * 3 + ri) * 0.05;
      const h = 0.2 + hash(n * 7 + 1) * 0.1;
      const lean = hash(n + 50) > 0.88 ? 0.07 : 0;
      const y = first + sh.rows[ri];
      ctx.beginPath();
      p.poly([[x, y], [x + w, y], [x + w + lean, y + h], [x + lean, y + h]]);
      p.fill(BOOK_COLOURS[Math.floor(hash(n * 13 + 5) * BOOK_COLOURS.length)], 0.92);
      if (hash(n + 21) > 0.6) {
        ctx.beginPath();
        p.line(x + lean * 0.7, y + h * 0.75, x + w + lean * 0.7, y + h * 0.75);
        p.stroke(0.6, 0.008, "#e8c27a"); // a gilt band
      }
      x += w + 0.012 + (hash(n + 90) > 0.9 ? 0.15 : 0);
      n++;
    }
  }
  ctx.beginPath();
  p.line(sh.left, first, sh.left, first + sh.top);
  p.line(sh.right, first, sh.right, first + sh.top);
  for (const r of sh.rows) p.line(sh.left, first + r, sh.right, first + r);
  p.line(sh.left - 0.04, first + sh.top, sh.right + 0.04, first + sh.top);
  p.stroke(0.85, 0.022, "#3a2414");
  const rg = F.rug;
  ctx.beginPath();
  p.rect(rg.left, first, rg.right, first + 0.03);
  p.fill("#8a3b2c");
  const ac = F.armchair;
  ctx.beginPath();
  p.poly([[ac.left, first + ac.seat], [ac.right, first + ac.seat], [ac.right, first + ac.back], [ac.right - 0.1, first + ac.back], [ac.right - 0.1, first + ac.seat + 0.07], [ac.left, first + ac.seat + 0.07]]);
  p.fill("#6a2f3a"); // a plum armchair
  ctx.beginPath();
  p.rect(ac.left - 0.02, first + ac.seat + 0.07, ac.left + 0.07, first + ac.seat + 0.17); // the arm
  p.fill("#6a2f3a");
  ctx.beginPath();
  p.line(ac.left + 0.04, first + ac.seat, ac.left + 0.04, first);
  p.line(ac.right - 0.04, first + ac.seat, ac.right - 0.04, first);
  p.stroke(0.85, 0.02);
  const rl = F.readingLamp;
  ctx.beginPath();
  p.line(rl.x, first, rl.x, first + rl.top);
  p.line(rl.x - 0.1, first, rl.x + 0.1, first);
  p.stroke(0.85, 0.016);
  ctx.beginPath();
  shade(p, rl.x, first + rl.top + 0.12, 0.26, 0.15);
  p.fill("#ffd894");

  // ── Workshop: bench, pegboard of tools, the hanging lamp, and the things he has made.
  const bn = F.bench;
  ctx.beginPath();
  p.line(bn.left + 0.06, first + bn.top, bn.left + 0.06, first);
  p.line(bn.right - 0.06, first + bn.top, bn.right - 0.06, first);
  p.line(bn.left + 0.06, first + 0.14, bn.right - 0.06, first + 0.14);
  p.stroke(0.8, 0.02);
  ctx.beginPath();
  p.rect(bn.left - 0.05, first + bn.top - 0.05, bn.right + 0.05, first + bn.top);
  p.fill("#6a4228");
  const pg = F.pegboard;
  ctx.beginPath();
  p.rect(pg.left, first + pg.bottom, pg.right, first + pg.top);
  p.fill("#c49a68", 0.85);
  p.stroke(0.6, 0.014);
  ctx.fillStyle = NIGHT.line;
  for (let i = 0; i < 18; i++) {
    for (let j = 0; j < 5; j++) {
      ctx.globalAlpha = 0.25;
      ctx.fillRect(p.X(pg.left + 0.08 + i * 0.1), p.Y(first + pg.bottom + 0.07 + j * 0.1), 1.2, 1.2);
    }
  }
  // A hammer, a screwdriver, a wrench, a ruler, hung on the board.
  const tb = first + pg.bottom;
  ctx.beginPath();
  p.line(pg.left + 0.2, tb + 0.08, pg.left + 0.2, tb + 0.4);
  p.line(pg.left + 0.55, tb + 0.06, pg.left + 0.55, tb + 0.3);
  p.line(pg.left + 0.9, tb + 0.08, pg.left + 0.98, tb + 0.38);
  p.stroke(0.9, 0.022, "#3a2414");
  ctx.beginPath();
  p.rect(pg.left + 0.11, tb + 0.37, pg.left + 0.29, tb + 0.44);
  p.fill("#5a5f6a");
  ctx.beginPath();
  p.rect(pg.left + 0.52, tb + 0.3, pg.left + 0.58, tb + 0.44);
  p.fill("#c0392b");
  ctx.beginPath();
  p.rect(pg.left + 1.27, tb + 0.07, pg.left + 1.36, tb + 0.46);
  p.fill("#e0b84a");
  ctx.beginPath();
  for (let i = 0; i < 5; i++) p.line(pg.left + 1.27, tb + 0.1 + i * 0.08, pg.left + 1.31, tb + 0.1 + i * 0.08);
  p.stroke(0.8, 0.008);
  const wl = F.workLamp;
  ctx.beginPath();
  p.line(wl.x, attic - SLAB, wl.x, first + wl.h + 0.12);
  p.stroke(0.7, 0.01);
  ctx.beginPath();
  shade(p, wl.x, first + wl.h, 0.3, 0.13);
  p.fill("#ffe7b0");
  // A cone of light down onto the bench.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const cone = ctx.createLinearGradient(0, p.Y(first + wl.h), 0, p.Y(first + bn.top));
  cone.addColorStop(0, "rgba(255, 232, 180, 0.22)");
  cone.addColorStop(1, "rgba(255, 232, 180, 0.04)");
  ctx.beginPath();
  p.poly([[wl.x - 0.15, first + wl.h - 0.13], [wl.x + 0.15, first + wl.h - 0.13], [wl.x + 0.95, first + bn.top], [wl.x - 0.95, first + bn.top]]);
  ctx.fillStyle = cone;
  ctx.fill();
  ctx.restore();
  for (const id of Object.keys(ITEMS) as ProjectId[]) {
    if (id === state.holding) continue;
    const hovered = id === state.hoverItem;
    if (hovered) p.glow(ITEMS[id], first + bn.top + ITEM_SIZE * 0.5, 0.42, [255, 220, 150], 0.55);
    drawItem(ctx, view, id, screenX(view, ITEMS[id]), screenY(view, first + bn.top), 1, hovered ? 1.12 : 1);
  }

  // ── Attic: the old desk and its first computer, the round window with the moon in it, boxes from college, the
  // degree on the wall.
  const oc = F.oldChair;
  ctx.beginPath();
  p.line(oc.left, attic, oc.left, attic + oc.back);
  p.line(oc.left, attic + oc.seat, oc.right, attic + oc.seat);
  p.line(oc.right, attic + oc.seat, oc.right, attic);
  const od = F.oldDesk;
  p.line(od.left, attic + od.top, od.left, attic);
  p.line(od.right, attic + od.top, od.right, attic);
  p.stroke(0.75);
  ctx.beginPath();
  p.rect(od.left - 0.05, attic + od.top - 0.035, od.right + 0.05, attic + od.top);
  p.fill("#4a2e1c");
  const crt = F.crt;
  ctx.beginPath();
  p.rect(crt.left, attic + crt.bottom, crt.right, attic + crt.top);
  p.fill("#cfc3a6");
  p.stroke(0.7, 0.014);
  ctx.beginPath();
  p.rect(crt.left + 0.05, attic + crt.bottom + 0.06, crt.right - 0.05, attic + crt.top - 0.05);
  p.fill("#8fe0a8", 0.9 + 0.05 * Math.sin(state.time * 2.3));
  p.text(">_", crt.left + 0.09, attic + crt.top - 0.13, 0.07, 0.8, "#1f5a33");
  ctx.beginPath();
  p.line(crt.left + 0.1, attic + od.top, crt.left + 0.06, attic + crt.bottom);
  p.line(crt.right - 0.1, attic + od.top, crt.right - 0.06, attic + crt.bottom);
  p.stroke(0.7);
  const rw = F.roundWindow;
  ctx.beginPath();
  ctx.arc(p.X(rw.x), p.Y(attic + rw.h), rw.r * view.unit, 0, Math.PI * 2);
  p.fill("#24336a");
  ctx.beginPath();
  ctx.arc(p.X(rw.x + 0.07), p.Y(attic + rw.h + 0.06), rw.r * 0.32 * view.unit, 0, Math.PI * 2);
  p.fill("#f4ecd6", 0.9);
  ctx.beginPath();
  ctx.arc(p.X(rw.x), p.Y(attic + rw.h), rw.r * view.unit, 0, Math.PI * 2);
  p.line(rw.x - rw.r, attic + rw.h, rw.x + rw.r, attic + rw.h);
  p.line(rw.x, attic + rw.h - rw.r, rw.x, attic + rw.h + rw.r);
  p.stroke(0.85, 0.024, "#3a2414");
  // Moonlight falling in from the round window.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.beginPath();
  p.poly([[rw.x - rw.r * 0.7, attic + rw.h], [rw.x + rw.r * 0.7, attic + rw.h], [rw.x + 0.9, attic], [rw.x + 0.2, attic]]);
  ctx.fillStyle = "rgba(140, 160, 230, 0.12)";
  ctx.fill();
  ctx.restore();
  const bx = F.boxes;
  ctx.beginPath();
  p.rect(bx.left, attic, bx.right, attic + 0.32);
  p.fill("#a0764a");
  p.stroke(0.7, 0.014);
  ctx.beginPath();
  p.rect(bx.left + 0.08, attic + 0.32, bx.right - 0.12, attic + 0.55);
  p.fill("#8a6038");
  p.stroke(0.7, 0.014);
  p.text("EEE", (bx.left + bx.right) / 2, attic + 0.16, 0.08, 0.85, NIGHT.line, "center");
  const fr = F.frame;
  ctx.beginPath();
  p.rect(fr.left, attic + fr.bottom, fr.right, attic + fr.top);
  p.fill("#f2e6c8");
  p.stroke(0.85, 0.022, "#6a4a22");
  ctx.beginPath();
  p.line(fr.left + 0.08, attic + fr.top - 0.1, fr.right - 0.08, attic + fr.top - 0.1);
  p.line(fr.left + 0.12, attic + fr.top - 0.17, fr.right - 0.12, attic + fr.top - 0.17);
  p.stroke(0.5, 0.009);
  ctx.globalAlpha = 1;
}

/** The lamps' glow, added on top of the rooms (before the figure, so he stays dark). */
function drawGlows(p: Pen, state: HouseState): void {
  const sc = F.screen;
  p.glow(F.lamp.x - 0.14, F.lamp.top - 0.08, 1.1, [255, 200, 120], 0.35);
  p.glow((sc.left + sc.right) / 2, (sc.bottom + sc.top) / 2, 0.75, [120, 170, 255], state.typing ? 0.3 : 0.22);
  p.glow(F.hallLamp.x, F.hallLamp.h, 1.4, [255, 196, 120], 0.3);
  p.glow(F.readingLamp.x, first + F.readingLamp.top + 0.06, 1.2, [255, 196, 120], 0.38);
  p.glow(F.workLamp.x, first + F.workLamp.h - 0.08, 1.3, [255, 220, 150], 0.36);
  p.glow((F.crt.left + F.crt.right) / 2, attic + 0.65, 0.8, [120, 230, 150], 0.22 + 0.03 * Math.sin(state.time * 2.3));
}

/**
 * One of the things on the workbench, standing on (cx, baseY) in screen px: a little robot (PoweredByAI), three
 * cards fanned (Zaprep's three payment providers), a chart with a leaf (EnviroByte).
 */
export function drawItem(ctx: Ctx, view: View, id: ProjectId, cx: number, baseY: number, alpha: number, scale = 1): void {
  const u = view.unit;
  const s = ITEM_SIZE * u * scale;
  const outline = () => {
    ctx.strokeStyle = NIGHT.line;
    ctx.lineWidth = Math.max(1, u * 0.014);
    ctx.stroke();
  };
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (id) {
    case "poweredbyai": {
      // A little robot: teal body, head, antenna with a glowing tip, two lit eyes.
      ctx.beginPath();
      ctx.rect(cx - s * 0.28, baseY - s * 0.42, s * 0.56, s * 0.42);
      ctx.rect(cx - s * 0.22, baseY - s * 0.78, s * 0.44, s * 0.3);
      ctx.fillStyle = "#3f8a8c";
      ctx.fill();
      outline();
      ctx.beginPath();
      ctx.moveTo(cx, baseY - s * 0.78);
      ctx.lineTo(cx, baseY - s * 0.98);
      outline();
      ctx.beginPath();
      ctx.arc(cx, baseY - s * 1.02, s * 0.06, 0, Math.PI * 2);
      ctx.fillStyle = "#ff6b5a";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx - s * 0.09, baseY - s * 0.64, s * 0.045, 0, Math.PI * 2);
      ctx.arc(cx + s * 0.09, baseY - s * 0.64, s * 0.045, 0, Math.PI * 2);
      ctx.fillStyle = "#fff2a8";
      ctx.fill();
      return;
    }
    case "zaprep": {
      // Three cards, fanned: one billing module, three providers.
      const colours = ["#6a5acd", "#2f80ed", "#f2994a"];
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(cx + (i - 1) * s * 0.08, baseY);
        ctx.rotate((i - 1) * 0.28);
        ctx.beginPath();
        ctx.rect(-s * 0.18, -s * 0.62, s * 0.36, s * 0.58);
        ctx.fillStyle = colours[i];
        ctx.fill();
        outline();
        ctx.beginPath();
        ctx.rect(-s * 0.18, -s * 0.52, s * 0.36, s * 0.06);
        ctx.fillStyle = "#1b1a17";
        ctx.fill();
        ctx.restore();
      }
      return;
    }
    case "envirobyte": {
      // A small framed chart, three green bars going down, a leaf on top.
      ctx.beginPath();
      ctx.rect(cx - s * 0.32, baseY - s * 0.62, s * 0.64, s * 0.62);
      ctx.fillStyle = "#f6efdc";
      ctx.fill();
      outline();
      ctx.fillStyle = "#3f9a5a";
      ctx.fillRect(cx - s * 0.24, baseY - s * 0.46, s * 0.12, s * 0.4);
      ctx.fillRect(cx - s * 0.06, baseY - s * 0.34, s * 0.12, s * 0.28);
      ctx.fillRect(cx + s * 0.12, baseY - s * 0.22, s * 0.12, s * 0.16);
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.12, baseY - s * 0.62);
      ctx.quadraticCurveTo(cx + s * 0.4, baseY - s * 0.98, cx + s * 0.04, baseY - s * 0.9);
      ctx.quadraticCurveTo(cx + s * 0.02, baseY - s * 0.72, cx + s * 0.12, baseY - s * 0.62);
      ctx.fillStyle = "#5bbf6a";
      ctx.fill();
      outline();
      return;
    }
  }
}

/** The night, the house and everything in it, up to (not including) the figure. */
export function drawHouse(ctx: Ctx, view: View, state: HouseState): void {
  const p = pen(ctx, view);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  drawSky(ctx, view, p, state.time);
  drawLand(ctx, view, p);
  drawShell(ctx, view, p, state);
  drawRooms(ctx, view, p, state);
  drawGlows(p, state);
  drawFront(ctx, view, p, state.time);
  ctx.globalAlpha = 1;
}

// ── The figure ──────────────────────────────────────────────────────────────

export interface Placement {
  x: number; // hip, screen CSS px
  floorY: number; // screen y of what he stands on
  unit: number;
  facing: number; // -1..1
  sit: number; // 0..1: no floor shadow while seated
}

const toScreen = (at: Placement, p: Point): [number, number] => [at.x + p.x * at.facing * at.unit, at.floorY - p.y * at.unit];

export function drawFigure(ctx: Ctx, pose: Pose, at: Placement): void {
  const { x, floorY, unit } = at;
  const P = (p: Point) => toScreen(at, p);
  const stroke = Math.max(1.4, Math.min(3.8, unit * 0.045));

  // Soft contact shadow under his feet when he's standing.
  const standing = 1 - at.sit;
  if (standing > 0.02) {
    ctx.fillStyle = `rgba(20, 10, 5, ${0.28 * standing})`;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.ellipse(x, floorY + 1, unit * 0.2, Math.max(1.2, unit * 0.025), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const limb = (from: Point, l: Pose["legs"][number]) => {
    ctx.beginPath();
    ctx.moveTo(...P(from));
    ctx.lineTo(...P(l.joint));
    ctx.lineTo(...P(l.end));
    if (l.toe) ctx.lineTo(...P(l.toe));
    ctx.stroke();
  };
  const { shoulder } = pose;
  const [hx, hy] = P(pose.head);

  // Two passes: a faint warm rim (so he reads against the dark outside), then the figure itself.
  for (const pass of ["rim", "ink"] as const) {
    const rim = pass === "rim";
    ctx.strokeStyle = rim ? NIGHT.rimFigure : NIGHT.figure;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = rim ? stroke + 2.4 : stroke;
    ctx.globalAlpha = rim ? 1 : 0.6; // far limbs a little lighter, for depth
    limb(pose.hip, pose.legs[1]);
    limb(shoulder, pose.arms[1]);
    ctx.globalAlpha = 1;
    limb(pose.hip, pose.legs[0]);
    ctx.beginPath();
    ctx.moveTo(...P(pose.hip));
    ctx.lineTo(...P(pose.neck));
    ctx.stroke();
    limb(shoulder, pose.arms[0]);
    ctx.beginPath();
    ctx.arc(hx, hy, pose.headR * unit + (rim ? 1.2 : 0), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** What's in his hands: a project off the bench, or an open book. Drawn after the figure. */
export function drawHeld(ctx: Ctx, view: View, pose: Pose, at: Placement, action: Action, holding: ProjectId | null): void {
  const hand = toScreen(at, pose.arms[0].end);
  const other = toScreen(at, pose.arms[1].end);
  const u = view.unit;
  if (holding && action === "show") {
    // Standing on his hands, held up toward you.
    const cx = (hand[0] + other[0]) / 2;
    const cy = Math.min(hand[1], other[1]) + u * 0.02;
    drawItem(ctx, view, holding, cx, cy, 1, 1.15);
  } else if (action === "book") {
    // An open book: two pale pages over a dark red cover.
    const mx = (hand[0] + other[0]) / 2;
    const my = Math.min(hand[1], other[1]) - u * 0.01;
    const f = at.facing;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(mx - u * 0.11 * f, my - u * 0.025);
    ctx.quadraticCurveTo(mx - u * 0.05 * f, my - u * 0.06, mx, my);
    ctx.quadraticCurveTo(mx + u * 0.05 * f, my - u * 0.06, mx + u * 0.11 * f, my - u * 0.025);
    ctx.lineTo(mx + u * 0.11 * f, my);
    ctx.quadraticCurveTo(mx + u * 0.05 * f, my - u * 0.03, mx, my + u * 0.02);
    ctx.quadraticCurveTo(mx - u * 0.05 * f, my - u * 0.03, mx - u * 0.11 * f, my);
    ctx.closePath();
    ctx.fillStyle = "#f6ead0";
    ctx.fill();
    ctx.strokeStyle = "#7b2f2a";
    ctx.lineWidth = Math.max(1, u * 0.014);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** The screen box around his body (for pointing at him), padded by `pad` units. */
export function figureBounds(pose: Pose, at: Placement, pad: number): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const add = (p: Point) => {
    const [x, y] = toScreen(at, p);
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  };
  [pose.hip, pose.neck, pose.head, ...pose.legs.flatMap((l) => [l.joint, l.end]), ...pose.arms.flatMap((l) => [l.joint, l.end])].forEach(add);
  const r = (pose.headR + pad) * at.unit;
  return { x0: x0 - r, y0: y0 - r, x1: x1 + r, y1: y1 + r };
}

/**
 * A speech bubble over his head: warm paper glowing softly in the dark, a small tail toward him, a few lines in an
 * italic serif. Stays inside the screen.
 */
export function drawBubble(ctx: Ctx, view: View, head: [number, number], lines: readonly string[], alpha: number): void {
  if (alpha < 0.01) return;
  const size = Math.round(Math.min(17, Math.max(13, view.unit * 0.17)));
  ctx.font = `italic ${size}px ${SERIF}`;
  const lineH = size * 1.35;
  const padX = size * 0.9;
  const padY = size * 0.6;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + padX * 2;
  const h = lines.length * lineH + padY * 2;
  const tail = size * 0.7;
  const x = Math.min(view.width - 10 - w, Math.max(10, head[0] - w / 2));
  const y = Math.max(10, head[1] - view.unit * 0.18 - tail - h);
  const tx = Math.min(x + w - size, Math.max(x + size, head[0])); // where the tail meets the bubble
  const r = size * 0.7;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.lineTo(tx + tail * 0.5, y + h);
  ctx.lineTo(Math.min(Math.max(head[0], x + 6), x + w - 6), Math.min(y + h + tail, head[1] - view.unit * 0.12));
  ctx.lineTo(tx - tail * 0.5, y + h);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.save();
  ctx.shadowColor = "rgba(255, 190, 110, 0.45)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = NIGHT.bubble;
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = alpha * 0.35;
  ctx.strokeStyle = NIGHT.line;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.globalAlpha = alpha * 0.9;
  ctx.fillStyle = NIGHT.line;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((text, i) => ctx.fillText(text, x + w / 2, y + padY + lineH * (i + 0.5)));
  ctx.globalAlpha = 1;
}
