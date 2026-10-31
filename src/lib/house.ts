// The house: a cut-away, two storeys and an attic, seen from the side like a dollhouse with its front wall missing.
// Everything is measured in units (the figure's height) from the house's left wall (x) and the ground (y, up), so a
// resize only changes the view (how many pixels a unit is and where the house sits), never the house.
//
//            attic: where I began
//   first:   library        │ workshop          (stair up to the attic at the back, right)
//   ground:  office         │ hall → front door (stair up to the first floor at the back, left)
//
// Stairs run along the back wall, so he walks in front of them on the floor and only climbs where they start.

import type { PathPoint } from "./character/body";
import type { ProjectId, RoomId } from "@/content/story";

export const HOUSE = {
  width: 11, // wall to wall
  storey: 1.75, // floor to ceiling
  peak: 5.75, // the ridge of the roof
  overhang: 0.45, // eaves past the walls
};

export const FLOORS = { ground: 0, first: 1.75, attic: 3.5 } as const;
export type FloorId = keyof typeof FLOORS;
const ORDER: readonly FloorId[] = ["ground", "first", "attic"];

/** Thickness of the floors between storeys (just under each upper floor) and of the walls, drawn as the house's dark
 * body around the lit rooms. */
export const SLAB = 0.1;
export const WALL = 0.07;

export const DESK_TOP = 0.43; // the office desk and the old desk in the attic (above their floor)
export const BENCH_TOP = 0.55; // the workbench, worked at standing

/** Where his feet may go on each floor (the ground floor runs out past the front door onto the step). */
export const WALK: Record<FloorId, readonly [number, number]> = {
  ground: [0.4, 11.7],
  first: [0.4, 10.6],
  attic: [2.8, 8.3],
};

/** The two stairs: where each starts on the lower floor and where it arrives on the upper one. */
export const STAIRS = [
  { lower: "ground", upper: "first", bottom: 1.0, top: 3.25 }, // rises to the right, behind the office
  { lower: "first", upper: "attic", bottom: 10.3, top: 8.1 }, // rises to the left, behind the workshop
] as const;

/** Where things stand (x from the left wall, heights above their own floor; units). The renderer draws from these. */
export const FURNITURE = {
  // office (ground)
  chair: { left: 3.07, right: 3.39, seat: 0.26, back: 0.62 },
  desk: { left: 3.55, right: 4.65, top: DESK_TOP },
  screen: { left: 3.95, right: 4.33, bottom: 0.52, top: 0.78 },
  lamp: { x: 4.55, top: 0.84 },
  board: { left: 3.6, right: 4.75, bottom: 0.98, top: 1.46 }, // the impact numbers, pinned up
  // hall (ground)
  hallWindow: { left: 6.3, right: 7.2, sill: 0.6, top: 1.3 },
  coats: { x: 9.5 },
  mat: { left: 10.15, right: 10.9 },
  door: { top: 1.3 }, // the opening in the right wall
  hallLamp: { x: 8.2, h: 1.42 }, // a pendant from the ceiling
  plant: { x: 7.75 },
  porch: { x: 11.22, h: 1.42 }, // the light over the front door, outside
  mailbox: { x: 12.6, h: 0.72 },
  // library (first)
  shelf: { left: 0.45, right: 4.3, rows: [0.12, 0.47, 0.82, 1.17], top: 1.52 },
  armchair: { left: 4.62, right: 5.25, seat: 0.3, back: 0.7 }, // back on the right: he sits facing left, reading
  readingLamp: { x: 5.4, top: 1.32 },
  rug: { left: 2.6, right: 5.35 },
  // workshop (first)
  bench: { left: 6.0, right: 8.0, top: BENCH_TOP },
  pegboard: { left: 6.1, right: 7.9, bottom: 0.92, top: 1.45 },
  workLamp: { x: 7.0, h: 1.3 }, // hanging over the bench
  // attic
  oldChair: { left: 3.52, right: 3.84, seat: 0.26, back: 0.62 },
  oldDesk: { left: 4.0, right: 5.0, top: DESK_TOP },
  crt: { left: 4.25, right: 4.72, bottom: 0.47, top: 0.83 },
  roundWindow: { x: 5.5, h: 1.18, r: 0.22 },
  boxes: { left: 6.25, right: 6.95 },
  frame: { left: 6.35, right: 6.85, bottom: 0.92, top: 1.22 }, // the degree on the wall
  chimney: { left: 8.4, right: 8.85, top: 5.55 },
  tree: { x: -1.7 },
  moon: { x: 12.4, h: 6.35, r: 0.34 },
};

/** The things on the workbench, left to right (centre x). Picking one up shows that project. */
export const ITEMS: Record<ProjectId, number> = { poweredbyai: 6.45, zaprep: 7.05, envirobyte: 7.65 };
export const ITEM_SIZE = 0.24;

/** Where he goes in each room (x of his hip, the floor, which way he faces, seated or not). */
export const SPOTS = {
  office: { floor: "ground", x: FURNITURE.desk.left - 0.29, dir: 1, seat: FURNITURE.chair.seat },
  door: { floor: "ground", x: 11.45, dir: -1 }, // out on the step, turned back toward you
  doorway: { floor: "ground", x: 10.55, dir: 1 },
  library: { floor: "first", x: 1.95, dir: 1 }, // in front of the shelf
  armchair: { floor: "first", x: FURNITURE.armchair.left + 0.28, dir: -1, seat: FURNITURE.armchair.seat },
  workshop: { floor: "first", x: FURNITURE.bench.left + 0.55, dir: 1 },
  attic: { floor: "attic", x: FURNITURE.oldDesk.left - 0.29, dir: 1, seat: FURNITURE.oldChair.seat },
} as const satisfies Record<string, { floor: FloorId; x: number; dir: 1 | -1; seat?: number }>;
export type SpotId = keyof typeof SPOTS;

/** Where he stands to pick up an item from the bench (just left of it, facing it). */
export const itemSpot = (id: ProjectId) => ITEMS[id] - 0.27;

/** The roof line over x (units above the ground). */
export function roofAt(x: number): number {
  const half = HOUSE.width / 2 + HOUSE.overhang;
  return FLOORS.attic + (HOUSE.peak - FLOORS.attic) * Math.max(0, 1 - Math.abs(x - HOUSE.width / 2) / half);
}

/** The floor he is on: the one whose level is closest below his feet (on a stair, the one he left or reached). */
export function floorOf(y: number): FloorId {
  let best: FloorId = "ground";
  for (const f of ORDER) if (y >= FLOORS[f] - 0.01) best = f;
  return best;
}

const clampTo = (f: FloorId, x: number) => Math.min(WALK[f][1], Math.max(WALK[f][0], x));

/**
 * The way from where he stands to x on a floor: along his floor to the foot (or head) of the stair, up or down it,
 * and on. Starting mid-stair, he first finishes the stair in the direction he's going (`ahead`).
 */
export function route(from: PathPoint, to: { floor: FloorId; x: number }, ahead?: PathPoint): PathPoint[] {
  const path: PathPoint[] = [];
  let at = from;
  if (ahead && Math.abs(ahead.y - from.y) > 1e-6) {
    path.push(ahead);
    at = ahead;
  }
  let floor = floorOf(at.y);
  while (floor !== to.floor) {
    const up = ORDER.indexOf(to.floor) > ORDER.indexOf(floor);
    const stair = STAIRS.find((s) => (up ? s.lower : s.upper) === floor)!;
    const next: FloorId = up ? stair.upper : stair.lower;
    const [startX, endX] = up ? [stair.bottom, stair.top] : [stair.top, stair.bottom];
    path.push({ x: startX, y: FLOORS[floor] }, { x: endX, y: FLOORS[next] });
    floor = next;
  }
  path.push({ x: clampTo(to.floor, to.x), y: FLOORS[to.floor] });
  return path;
}

// ── Rooms: where you can point ──────────────────────────────────────────────

/** Each room's box (units): x0..x1 across, y0..y1 up (the attic is also cut by the roof, see roomAt), and where its
 * name is written while you point at it (x, and height above the room's floor). */
export const ROOMS: Record<RoomId, { x0: number; x1: number; y0: number; y1: number; label: { x: number; h: number } }> = {
  attic: { x0: 0.6, x1: 10.4, y0: FLOORS.attic, y1: HOUSE.peak, label: { x: 2.7, h: 1.05 } },
  library: { x0: 0, x1: 5.6, y0: FLOORS.first, y1: FLOORS.attic, label: { x: 0.2, h: 1.6 } },
  workshop: { x0: 5.6, x1: HOUSE.width, y0: FLOORS.first, y1: FLOORS.attic, label: { x: 5.8, h: 1.6 } },
  office: { x0: 0, x1: 5.0, y0: FLOORS.ground, y1: FLOORS.first, label: { x: 0.2, h: 1.6 } },
  door: { x0: 5.0, x1: 13.2, y0: FLOORS.ground, y1: FLOORS.first, label: { x: 5.2, h: 1.6 } },
};

export function roomAt(x: number, y: number): RoomId | null {
  for (const id of Object.keys(ROOMS) as RoomId[]) {
    const r = ROOMS[id];
    if (x < r.x0 || x > r.x1 || y < r.y0 || y > r.y1) continue;
    if (id === "attic" && y > roofAt(x)) continue;
    return id;
  }
  return null;
}

/** The item on the bench under a point, if any (a little generous, for fingers). */
export function itemAt(x: number, y: number): ProjectId | null {
  const base = FLOORS.first + BENCH_TOP;
  if (y < base - 0.06 || y > base + ITEM_SIZE + 0.16) return null;
  for (const id of Object.keys(ITEMS) as ProjectId[]) if (Math.abs(x - ITEMS[id]) < ITEM_SIZE * 0.95) return id;
  return null;
}

// ── The view: units to pixels ───────────────────────────────────────────────

export interface View {
  width: number; // CSS px
  height: number;
  unit: number; // px per unit (the figure's height on screen)
  left: number; // screen x of the house's left wall
  ground: number; // screen y of the ground
}

/** Room left for the house on screen, after the name at the top, the words at the bottom and the notebook. */
export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What has to fit: the house, its step and the mailbox (the tree only when there's room), the chimney, and room for
 * a bubble over the attic. */
const CONTENT = { left: -0.6, right: 13.2, narrowLeft: -0.15, narrowRight: 13.2, bottom: -0.45, top: 6.75 };

export function layoutHouse(width: number, height: number, frame: Frame): View {
  const narrow = frame.w < 720;
  const l = narrow ? CONTENT.narrowLeft : CONTENT.left;
  const r = narrow ? CONTENT.narrowRight : CONTENT.right;
  const unit = Math.max(14, Math.min(110, frame.w / (r - l), frame.h / (CONTENT.top - CONTENT.bottom)));
  return {
    width,
    height,
    unit,
    left: Math.round(frame.x + frame.w / 2 - ((l + r) / 2) * unit),
    ground: Math.round(frame.y + frame.h / 2 + ((CONTENT.top + CONTENT.bottom) / 2) * unit),
  };
}

/** Ease between two views (the house sliding over when the notebook opens). */
export function mixView(a: View, b: View, t: number): View {
  const m = (p: number, q: number) => p + (q - p) * t;
  return { width: b.width, height: b.height, unit: m(a.unit, b.unit), left: m(a.left, b.left), ground: m(a.ground, b.ground) };
}

export const screenX = (v: View, x: number) => v.left + x * v.unit;
export const screenY = (v: View, y: number) => v.ground - y * v.unit;
export const houseX = (v: View, px: number) => (px - v.left) / v.unit;
export const houseY = (v: View, py: number) => (v.ground - py) / v.unit;
