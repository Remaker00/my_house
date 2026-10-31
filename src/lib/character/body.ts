// The body: where he is, how he moves, where he looks, how he holds himself and what his hands are doing.
// It carries out simple commands (walk a path, stand, turn, gaze, posture, an action for the hands) and reports when
// the current one is done. Deciding *what* to do lives in mind.ts. No drawing, no limbs, no DOM.
//
// Adapted from Jimmy's body (The Quiet Grind). The difference: the house has floors and stairs, so he walks a path of
// points (x along the house, y the height of the floor or stair under his feet) instead of along one line. Where the
// path doubles back (the foot of a stair) he stops and turns on the spot before going on.
//
// Positions are house units (figure heights); speeds are units per second along the path.

export type Mode = "walk" | "pause" | "turn";

/** What the hands are doing. The pose turns each into hand positions (and the renderer draws what's held). */
export type Action =
  | "none" // arms hang and swing with the walk
  | "type" // seated, both hands on the keyboard, fingers going
  | "desk" // seated, hands resting on the desk
  | "chin" // seated, elbow on the desk, chin in hand: thinking back
  | "bench" // standing, both hands working on the bench in front of him
  | "show" // standing, a thing held up in both hands in front of his chest
  | "book" // standing, an open book in both hands
  | "point" // the near hand reaching toward `point` (a shelf, the board, the door handle)
  | "wave"; // the near hand up by his head, waving hello

export interface Look {
  x: number; // -1 = over the shoulder, 0 = level ahead, 1 = far ahead
  y: number; // -1 = at the floor, 1 = straight up
}

/** How the body is held, 0..1 each. The pose turns these into joint angles. */
export interface Posture {
  sit: number; // on a chair
  legsOut: number; // legs straight out along the seat (unused here; kept for the pose's sitting maths)
  lie: number; // lying back (unused here)
  lean: number; // leaning in toward the desk (negative: leaning back)
  droop: number; // shoulders and head sink
  lift: number; // chin up
}

export interface PathPoint {
  x: number;
  y: number;
}

export interface Body {
  x: number; // hip x, units from the house's left wall
  y: number; // height of what he stands on (a floor or a stair)
  dir: 1 | -1; // direction of travel (and of facing, once a turn completes)
  facing: number; // -1..1, continuous during a turn
  speed: number; // units/s along the path, never negative
  cruise: number; // units/s the current walk settles at
  path: PathPoint[]; // what's left of the walk, next point first
  mode: Mode;
  timer: number; // pause: seconds left (Infinity = until the next command) · turn: seconds elapsed
  duration: number; // turn length (s)
  look: Look;
  lookTarget: Look;
  lookRate: number; // 1/s, how quickly the gaze follows its target
  posture: Posture;
  postureTarget: Posture;
  seat: number; // seat height above his floor (units) while sitting
  action: Action;
  point: { x: number; h: number }; // where "point" reaches: house x, height above his floor
  actionTime: number; // seconds since the action started
  time: number; // seconds alive
  seed: number;
}

type Rand = () => number;

const ACCEL_RATE = 1.8; // 1/s, how quickly speed settles toward the desired pace
const DECEL = 0.45; // units/s², the braking that sets how early he slows before stopping
const ARRIVE = 0.012; // units, close enough to call it arrived
const LOOK_RATE = 2.6; // 1/s, default gaze smoothing
const POSTURE_RATE = 2.2; // 1/s, sitting down or getting up takes a second
const TURN_TIME = 0.5; // s, turning round on the spot mid-path
const STAIR_PACE = 0.8; // stairs are taken a little slower

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const easeInOut = (t: number) => t * t * (3 - 2 * t);
const POSTURE_KEYS = ["sit", "legsOut", "lie", "lean", "droop", "lift"] as const;

export function createBody(x: number, y: number, rand: Rand = Math.random): Body {
  return {
    x,
    y,
    dir: 1,
    facing: 1,
    speed: 0,
    cruise: 0.7,
    path: [],
    mode: "pause",
    timer: 0, // idle: the mind gives the first command on the first frame
    duration: 0,
    look: { x: 0.4, y: 0 },
    lookTarget: { x: 0.4, y: 0 },
    lookRate: LOOK_RATE,
    posture: { sit: 0, legsOut: 0, lie: 0, lean: 0, droop: 0, lift: 0 },
    postureTarget: { sit: 0, legsOut: 0, lie: 0, lean: 0, droop: 0, lift: 0 },
    seat: 0.26,
    action: "none",
    point: { x, h: 0.6 },
    actionTime: 0,
    time: 0,
    seed: rand() * 100,
  };
}

// ── Commands ────────────────────────────────────────────────────────────────

/** Walk through these points in order. Points with no horizontal step are dropped (nothing walks straight up). */
export function walkPath(b: Body, points: readonly PathPoint[], cruise: number): void {
  const path: PathPoint[] = [];
  let from: PathPoint = b;
  for (const p of points) {
    if (Math.abs(p.x - from.x) < ARRIVE) continue;
    path.push({ x: p.x, y: p.y });
    from = p;
  }
  b.cruise = cruise;
  if (!path.length) {
    pauseFor(b, 0);
    return;
  }
  b.path = path;
  // Mid-turn the turn finishes first; otherwise set off (turning first if the walk starts behind him).
  if (b.mode !== "turn") startLeg(b);
}

/** Stand (or sit) still for a while. Infinity holds until the next command. Drops any walk still under way. */
export function pauseFor(b: Body, seconds: number): void {
  b.mode = "pause";
  b.speed = 0;
  b.timer = seconds;
  b.path = [];
}

/** Turn on the spot to face dir. Facing that way already finishes at once. */
export function turnTo(b: Body, dir: 1 | -1, duration = TURN_TIME): void {
  b.path = [];
  if (dir === b.dir) {
    pauseFor(b, 0);
    return;
  }
  beginTurn(b, dir, duration);
}

export function gaze(b: Body, look: Look, rate = LOOK_RATE): void {
  b.lookTarget.x = look.x;
  b.lookTarget.y = look.y;
  b.lookRate = rate;
}

export function hold(b: Body, p: Partial<Posture>): void {
  Object.assign(b.postureTarget, p);
}

export function act(b: Body, action: Action): void {
  if (action === b.action) return;
  b.action = action;
  b.actionTime = 0;
}

/** True once the posture has (nearly) reached what it was asked for. */
export function settled(b: Body, eps = 0.03): boolean {
  return POSTURE_KEYS.every((k) => Math.abs(b.posture[k] - b.postureTarget[k]) < eps);
}

/** Standing upright on his feet: safe to walk. */
export const onFeet = (b: Body) => b.posture.sit < 0.05 && b.posture.lie < 0.05;

function beginTurn(b: Body, dir: 1 | -1, duration: number): void {
  b.dir = dir;
  b.mode = "turn";
  b.speed = 0;
  b.timer = 0;
  b.duration = duration;
}

/** Head off toward the next point, turning round first if it is behind him. */
function startLeg(b: Body): void {
  const next = b.path[0];
  const dir: 1 | -1 = next.x >= b.x ? 1 : -1;
  if (dir !== b.dir) beginTurn(b, dir, TURN_TIME);
  else b.mode = "walk";
}

/** Distance left (along the path) before he has to stop: the end of the walk or the next place it doubles back. */
function runLeft(b: Body): number {
  let d = 0;
  let from: PathPoint = b;
  for (const p of b.path) {
    if ((p.x - from.x) * b.dir < 0) break;
    d += Math.hypot(p.x - from.x, p.y - from.y);
    from = p;
  }
  return d;
}

// ── Step ────────────────────────────────────────────────────────────────────

/**
 * Advance the body by dt. Returns true while it is idle: the walk has arrived, the pause has run out or the turn has
 * finished. It then stays where it is until given a new command.
 */
export function stepBody(b: Body, dt: number): boolean {
  b.time += dt;
  b.actionTime += dt;
  let idle = false;

  switch (b.mode) {
    case "walk": {
      const next = b.path[0];
      const stair = Math.abs(next.y - b.y) > 1e-6;
      const remaining = runLeft(b);
      // Pace drifts a little over time, so no two crossings look the same.
      const drift = 1 + 0.08 * Math.sin(b.time * 0.53 + b.seed) + 0.04 * Math.sin(b.time * 1.37 + b.seed * 2);
      // Never faster than he could still stop from in the distance left.
      const desired = Math.min(b.cruise * drift * (stair ? STAIR_PACE : 1), Math.sqrt(2 * DECEL * Math.max(0, remaining)));
      // Speeding up eases in; slowing down follows the braking curve exactly, so he is nearly still when he arrives
      // (easing there too would carry him in at a stride and snap his feet together).
      b.speed = desired < b.speed ? desired : b.speed + (desired - b.speed) * (1 - Math.exp(-ACCEL_RATE * dt));
      let step = Math.max(b.speed, 0.04) * dt; // a crawl at the very end, so arriving never stalls
      while (step > 0 && b.path.length) {
        const p = b.path[0];
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        const len = Math.hypot(dx, dy);
        if (len <= step + ARRIVE) {
          b.x = p.x;
          b.y = p.y;
          step -= len;
          b.path.shift();
          // Where the path doubles back, stop and turn round before going on.
          if (b.path.length && (b.path[0].x - b.x) * b.dir < 0) {
            startLeg(b);
            break;
          }
        } else {
          b.x += (dx / len) * step;
          b.y += (dy / len) * step;
          step = 0;
        }
      }
      if (!b.path.length) {
        pauseFor(b, 0);
        idle = true;
      }
      break;
    }
    case "pause": {
      b.timer -= dt;
      idle = b.timer <= 0;
      break;
    }
    case "turn": {
      b.timer += dt;
      const t = clamp(b.timer / b.duration, 0, 1);
      // From -dir through 0 (side-on, mid-turn) to dir.
      b.facing = -b.dir * Math.cos(Math.PI * easeInOut(t));
      if (t >= 1) {
        b.facing = b.dir;
        if (b.path.length) startLeg(b); // a turn on the way somewhere: walk on
        else {
          pauseFor(b, 0);
          idle = true;
        }
      }
      break;
    }
  }

  const k = 1 - Math.exp(-b.lookRate * dt);
  b.look.x += (b.lookTarget.x - b.look.x) * k;
  b.look.y += (b.lookTarget.y - b.look.y) * k;
  const kp = 1 - Math.exp(-POSTURE_RATE * dt);
  for (const key of POSTURE_KEYS) b.posture[key] += (b.postureTarget[key] - b.posture[key]) * kp;
  return idle;
}

/** Jump straight to the requested posture and gaze (a still frame for reduced motion). */
export function snapBody(b: Body): void {
  Object.assign(b.posture, b.postureTarget);
  b.look.x = b.lookTarget.x;
  b.look.y = b.lookTarget.y;
  b.facing = b.dir;
}

/** Put him somewhere at once, standing still (reduced motion, where there is no walking). */
export function placeBody(b: Body, x: number, y: number, dir: 1 | -1): void {
  b.x = x;
  b.y = y;
  b.dir = dir;
  b.facing = dir;
  pauseFor(b, Infinity);
}
