// The pose: turns the body's motion, posture and hand action into joint positions. Jimmy's pose (The Quiet Grind),
// with the hand targets for this house's actions.
// Figure space: origin at the hip's x on the floor, +y up, +x forward (the way he faces). 1 = figure height.
//
// Legs and torso come from angles (walking gait, sitting, lying back). Arms swing naturally while walking; for an
// action (typing, a page, a mug) each hand has a target and the arm reaches it with a two-bone solve. The arm *angles*
// ease toward that solve in `Anim` (shortest way round), so switching actions sweeps the arm instead of snapping, and
// the elbow never flips as a hand passes close to the shoulder.

import { DESK_TOP, BENCH_TOP } from "../house";
import type { Action, Body } from "./body";

export interface Point {
  x: number;
  y: number;
}

export interface Limb {
  joint: Point; // knee / elbow
  end: Point; // ankle / hand
  toe?: Point;
}

export interface Pose {
  hip: Point;
  neck: Point;
  shoulder: Point;
  head: Point;
  headR: number;
  legs: [Limb, Limb]; // [near, far]
  arms: [Limb, Limb];
}

/** An arm as two angles from straight down (+ forward): upper arm and forearm. */
export interface ArmAngles {
  upper: number;
  fore: number;
}

/** Animation state that outlives a frame: the walk cycle, breathing, and how the arms are held for an action. */
export interface Anim {
  phase: number; // radians, one full cycle = two steps
  amp: number; // 0 standing → 1 full stride
  breath: number; // seconds
  held: [ArmAngles, ArmAngles]; // arm angles chasing the current action's reach (near, far)
  holding: boolean; // false: the arms just hang and swing
  tap: number; // 0..1, keystrokes fading in or out
  scribble: number; // 0..1, small tool strokes at the bench
  waving: number; // 0..1, the hand waving
}

const THIGH = 0.25;
const SHIN = 0.25;
const UPPER_ARM = 0.17;
const FOREARM = 0.15;
const TORSO = 0.31;
const NECK = 0.09;
const FOOT = 0.065;
const NOMINAL_SPEED = 0.5; // units/s that counts as a full stride
const HAND_RATE = 5; // 1/s, how quickly the arms move to a new action…
const ARM_SPEED = 4; // …and never faster than this (rad/s), so dropping the arms after a stretch takes a moment
const RHYTHM_RATE = 6; // 1/s, keystrokes and pen strokes fading in and out

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Signed difference b − a, the short way round. */
const turn = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export function createAnim(): Anim {
  return { phase: 0, amp: 0, breath: 0, held: [{ upper: 0, fore: 0 }, { upper: 0, fore: 0 }], holding: false, tap: 0, scribble: 0, waving: 0 };
}

const along = (p: Point, angle: number, len: number): Point => ({
  // angle measured from straight down, positive = forward
  x: p.x + Math.sin(angle) * len,
  y: p.y - Math.cos(angle) * len,
});

interface Skeleton {
  hip: Point;
  neck: Point;
  shoulder: Point;
  head: Point;
  lean: number; // torso angle from vertical (+ forward)
  legs: [Limb, Limb];
}

function leg(b: Body, a: Anim, phase: number, side: number): Limb {
  const { sit, legsOut, lie } = b.posture;
  const walkThigh = 0.4 * a.amp * Math.sin(phase);
  // The knee folds while the leg swings forward (cos > 0) and stays nearly straight in stance.
  const walkKnee = 0.06 + 0.9 * a.amp * Math.pow(Math.max(0, Math.cos(phase)), 2);
  // Sitting: thighs forward, shins down; in bed the legs straighten out along the mattress.
  // (Thighs level enough and shins a touch forward, so both feet stay on the floor from the chair.)
  const sitThigh = 1.56 + 0.02 * side;
  const sitKnee = lerp(sitThigh - 0.03, 0.08, Math.max(legsOut, lie));
  const thigh = lerp(walkThigh, sitThigh, sit);
  const knee = lerp(walkKnee, sitKnee, sit);
  const joint = along({ x: 0, y: 0 }, thigh, THIGH);
  const end = along(joint, thigh - knee, SHIN);
  const footAngle = Math.min(0, thigh - knee) * 0.6 * (1 - sit); // toe dips as the foot pushes off
  const toe = { x: end.x + Math.cos(footAngle) * FOOT, y: end.y + Math.sin(footAngle) * FOOT };
  return { joint, end, toe };
}

function skeleton(b: Body, a: Anim): Skeleton {
  const p = b.posture;
  const near = leg(b, a, a.phase, 1);
  const far = leg(b, a, a.phase + Math.PI, -1);

  // Standing, the lowest foot touches the floor (the walking bob falls out of this); seated, the hip is on the seat.
  const standY = -Math.min(near.end.y, far.end.y, near.toe!.y, far.toe!.y);
  const hip = { x: 0, y: lerp(standY, b.seat, p.sit) };
  for (const l of [near, far]) {
    for (const q of [l.joint, l.end, l.toe!]) q.y += hip.y;
  }

  const still = 1 - a.amp;
  const period = lerp(4.2, 5.6, p.lie); // slower breaths asleep
  const breath = still * lerp(0.004, 0.007, p.lie) * Math.sin((a.breath * Math.PI * 2) / period);
  // Leans into the walk; toward the desk when working; slumps with struggle; a touch back on a breath or looking up.
  const standLean = 0.05 * a.amp + 0.22 * p.lean + 0.12 * p.droop - 0.05 * p.lift - 0.03 * b.look.y * still;
  const sitLean = 0.06 + 0.5 * p.lean + 0.15 * p.droop - 0.06 * p.lift;
  const lean = lerp(lerp(standLean, sitLean, p.sit), -Math.PI / 2 + 0.14, p.lie); // a pillow lifts the head a little
  const neck = { x: hip.x + Math.sin(lean) * TORSO, y: hip.y + Math.cos(lean) * TORSO + breath };
  const shoulder = { x: neck.x - Math.sin(lean) * 0.03, y: neck.y - Math.cos(lean) * 0.03 };

  // The head turns with the gaze: up at the window, down at a page. Struggle bows it; a breath lifts it.
  const awake = 1 - p.lie;
  const tilt = lean + awake * (-0.12 * b.look.y + 0.1 * b.look.x) + 0.5 * p.droop - 0.1 * p.lift;
  const head = {
    x: neck.x + Math.sin(tilt) * NECK + awake * (0.02 * b.look.x - 0.015 * b.look.y + 0.03 * p.droop),
    y: neck.y + Math.cos(tilt) * NECK + awake * (0.008 * b.look.y - 0.025 * p.droop),
  };
  return { hip, neck, shoulder, head, lean, legs: [near, far] };
}

/** Free-hanging arm, swinging against the legs while walking. */
function naturalArm(s: Skeleton, b: Body, phase: number, amp: number, out: ArmAngles): ArmAngles {
  const p = b.posture;
  const lean = p.sit > 0.5 ? s.lean * 0.4 : s.lean;
  out.upper = lean - 0.34 * amp * Math.sin(phase) + 0.04 - 0.05 * p.droop;
  out.fore = out.upper + 0.22 * (1 - 0.6 * p.droop) + 0.35 * amp * Math.max(0, -Math.sin(phase));
  return out;
}

/** The arm angles that put the hand at a target. */
function reachAngles(shoulder: Point, target: Point, out: ArmAngles): ArmAngles {
  const { joint, end } = reach(shoulder, target);
  out.upper = Math.atan2(joint.x - shoulder.x, shoulder.y - joint.y);
  out.fore = Math.atan2(end.x - joint.x, joint.y - end.y);
  return out;
}

function armFrom(shoulder: Point, a: ArmAngles): Limb {
  const joint = along(shoulder, a.upper, UPPER_ARM);
  return { joint, end: along(joint, a.fore, FOREARM) };
}

/** Two-bone reach from the shoulder to a hand target; the elbow bends down and back (clockwise of the reach). */
export function reach(shoulder: Point, target: Point): Limb {
  const dx = target.x - shoulder.x;
  const dy = target.y - shoulder.y;
  const d = Math.min(UPPER_ARM + FOREARM - 1e-6, Math.max(Math.abs(UPPER_ARM - FOREARM) + 1e-6, Math.hypot(dx, dy)));
  const base = Math.atan2(dy, dx);
  const bend = Math.acos((UPPER_ARM * UPPER_ARM + d * d - FOREARM * FOREARM) / (2 * UPPER_ARM * d));
  const joint = { x: shoulder.x + Math.cos(base - bend) * UPPER_ARM, y: shoulder.y + Math.sin(base - bend) * UPPER_ARM };
  const end = { x: shoulder.x + Math.cos(base) * d, y: shoulder.y + Math.sin(base) * d };
  return { joint, end };
}

const DESK = DESK_TOP + 0.014; // hand height resting on a desk (seated)
const BENCH = BENCH_TOP + 0.014; // …and on the workbench (standing)

/** Where each hand should be for an action (figure space). Small rhythms come from the action's own clock. */
function handTargets(action: Action, s: Skeleton, t: number, out: [Point, Point], b: Body): void {
  const [near, far] = out;
  const set = (q: Point, x: number, y: number) => {
    q.x = x;
    q.y = y;
  };
  const hang = (q: Point) => set(q, s.shoulder.x + 0.03, s.shoulder.y - 0.3);
  switch (action) {
    case "type":
      set(near, 0.37, DESK);
      set(far, 0.34, DESK);
      break;
    case "desk":
      set(near, 0.35, DESK);
      set(far, 0.32, DESK);
      break;
    case "chin":
      set(near, s.head.x + 0.03, s.head.y - 0.075);
      set(far, 0.33, DESK);
      break;
    case "bench":
      // Standing at the bench, both hands on the work; `rhythm` gives the near one small tool strokes.
      set(near, s.shoulder.x + 0.2, BENCH + 0.01 * Math.sin(t * 1.7));
      set(far, s.shoulder.x + 0.15, BENCH);
      break;
    case "show":
      // A thing held up in front of his chest, toward you.
      set(near, s.shoulder.x + 0.2, s.shoulder.y - 0.06);
      set(far, s.shoulder.x + 0.16, s.shoulder.y - 0.02);
      break;
    case "book":
      // An open book in both hands, a little lower than showing, read with the head bowed.
      set(near, s.shoulder.x + 0.19, s.shoulder.y - 0.13);
      set(far, s.shoulder.x + 0.13, s.shoulder.y - 0.11);
      break;
    case "point":
      // Reaching toward b.point (out of reach, the arm points straight at it).
      set(near, (b.point.x - b.x) * b.dir, b.point.h);
      hang(far);
      break;
    case "wave":
      // Hand raised beside his head, palm out; `rhythm` swings the forearm.
      set(near, s.shoulder.x + 0.13, s.shoulder.y + 0.24);
      hang(far);
      break;
    case "none":
      hang(near);
      hang(far);
      break;
  }
}

/**
 * Quick small motions on top of the held arm (forearm angle, radians; + lifts the hand): keystrokes, the scribble of
 * a pen. Added after the easing, so it doesn't smooth them away; `tap` and `scribble` fade them in and out.
 */
function rhythm(a: Anim, t: number, i: 0 | 1): number {
  const k = i * 1.7; // two hands that drift in and out of step
  const keys = 0.16 * Math.max(0, Math.sin(t * 13 + k)) * (0.5 + 0.5 * Math.sin(t * 2.1 + k));
  const pen = i === 0 ? 0.04 * Math.abs(Math.sin(t * 9)) + 0.015 * (1 + Math.sin(t * 15)) : 0;
  const wave = i === 0 ? 0.38 * Math.sin(t * 9) : 0;
  return a.tap * keys + a.scribble * pen + a.waving * wave;
}

const targets: [Point, Point] = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
];
const goal: ArmAngles = { upper: 0, fore: 0 };
const free: [ArmAngles, ArmAngles] = [
  { upper: 0, fore: 0 },
  { upper: 0, fore: 0 },
];

/** Ease an angle toward a goal the short way round, never faster than ARM_SPEED. */
function chase(from: number, to: number, k: number, dt: number): number {
  const step = turn(from, to) * k;
  return from + Math.max(-ARM_SPEED * dt, Math.min(ARM_SPEED * dt, step));
}

/**
 * Advance the walk cycle and breathing, and move the arms toward the current action. While an action runs, the held
 * arms chase its reach; afterwards they chase the natural hang and let go once they're there.
 */
export function updateAnim(a: Anim, b: Body, dt: number): void {
  const turning = b.mode === "turn";
  const target = turning ? 0.28 : Math.min(1, b.speed / NOMINAL_SPEED);
  a.amp += (target - a.amp) * (1 - Math.exp(-5 * dt));
  if (turning) {
    a.phase += dt * Math.PI * 2.2; // a couple of small shuffling steps while turning on the spot
  } else {
    // Phase follows distance, so feet don't skate. Slower = shorter steps.
    const stride = 0.35 + 0.4 * a.amp;
    a.phase += ((b.speed * dt) / stride) * Math.PI * 2;
  }
  a.phase %= Math.PI * 4;
  a.breath += dt;

  const s = skeleton(b, a);
  naturalArm(s, b, a.phase + Math.PI, a.amp, free[0]);
  naturalArm(s, b, a.phase, a.amp, free[1]);
  const fade = 1 - Math.exp(-RHYTHM_RATE * dt);
  a.tap += ((b.action === "type" ? 1 : 0) - a.tap) * fade;
  a.scribble += ((b.action === "bench" ? 1 : 0) - a.scribble) * fade;
  a.waving += ((b.action === "wave" ? 1 : 0) - a.waving) * fade;
  if (b.action === "none" && !a.holding) {
    Object.assign(a.held[0], free[0]);
    Object.assign(a.held[1], free[1]);
    return;
  }
  if (b.action !== "none") {
    a.holding = true;
    handTargets(b.action, s, b.actionTime, targets, b);
  }
  const k = 1 - Math.exp(-HAND_RATE * dt);
  let away = 0;
  for (let i = 0; i < 2; i++) {
    const g = b.action === "none" ? free[i] : reachAngles(s.shoulder, targets[i], goal);
    a.held[i].upper = chase(a.held[i].upper, g.upper, k, dt);
    a.held[i].fore = chase(a.held[i].fore, g.fore, k, dt);
    away = Math.max(away, Math.abs(turn(a.held[i].upper, g.upper)), Math.abs(turn(a.held[i].fore, g.fore)));
  }
  // Back at his sides: hand over to the natural swing (the difference is too small to see).
  if (b.action === "none" && away < 0.03 && a.tap + a.scribble + a.waving < 0.01) a.holding = false;
}

/** Put the arms exactly where the action wants them (a still frame for reduced motion). */
export function settleAnim(a: Anim, b: Body): void {
  a.amp = 0;
  const s = skeleton(b, a);
  a.holding = b.action !== "none";
  a.tap = b.action === "type" ? 1 : 0;
  a.scribble = b.action === "bench" ? 1 : 0;
  a.waving = b.action === "wave" ? 1 : 0;
  handTargets(b.action, s, b.actionTime, targets, b);
  for (let i = 0; i < 2; i++) {
    if (a.holding) reachAngles(s.shoulder, targets[i], a.held[i]);
    else naturalArm(s, b, i === 0 ? a.phase + Math.PI : a.phase, 0, a.held[i]);
  }
}

export function computePose(b: Body, a: Anim): Pose {
  const s = skeleton(b, a);
  const arm = (i: 0 | 1, phase: number): Limb => {
    if (!a.holding) return armFrom(s.shoulder, naturalArm(s, b, phase, a.amp, { upper: 0, fore: 0 }));
    const held = a.held[i];
    // The rhythm runs on the body's own continuous clock: an action's clock restarts when the action changes, which
    // would snap a stroke that is still fading out.
    return armFrom(s.shoulder, { upper: held.upper, fore: held.fore + rhythm(a, b.time, i) });
  };
  return {
    hip: s.hip,
    neck: s.neck,
    shoulder: s.shoulder,
    head: s.head,
    headR: 0.068,
    legs: s.legs,
    // Arms swing against the legs: the near arm goes with the far leg.
    arms: [arm(0, a.phase + Math.PI), arm(1, a.phase)],
  };
}
