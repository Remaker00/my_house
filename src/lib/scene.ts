// The scene: wires the mind, body, pose and renderer to one canvas and runs the one animation loop. All per-frame
// state lives in this closure (never in React state). mountScene returns a handle: send him to a room, open or close
// the notebook (the house slides aside for it), and a cleanup that cancels the loop and removes every listener.
//
// It takes its browser APIs as `env` (the window in the app), so scripts/check.ts can drive it with fakes.

import type { ProjectId, RoomId } from "@/content/story";
import { createBody, snapBody } from "./character/body";
import { createMind, goTo, greet, seatAtDesk, settleInto, stepMind } from "./character/mind";
import { computePose, createAnim, settleAnim, updateAnim, type Pose } from "./character/pose";
import { houseX, houseY, itemAt, layoutHouse, mixView, roomAt, screenX, screenY, type Frame, type View } from "./house";
import { drawBubble, drawFigure, drawHeld, drawHouse, figureBounds, type HouseState, type Placement } from "./render";

export type SceneEnv = Pick<Window, "requestAnimationFrame" | "cancelAnimationFrame" | "matchMedia" | "devicePixelRatio" | "location"> & {
  ResizeObserver: typeof ResizeObserver;
};

const MAX_DT = 0.1; // s; after a background tab or a stall, resume instead of leaping ahead
const MAX_DPR = 2;
const SLIDE_RATE = 5; // 1/s, the house sliding over for the notebook
const BUBBLE_FADE = { in: 0.25, out: 0.45 }; // s

/** Screen space the page keeps for itself: the name at the top, the words at the bottom, the notebook. */
export const CHROME = {
  top: 64,
  bottom: 88,
  sideFrom: 900, // px wide and up: the notebook is a column on the right…
  side: (w: number) => Math.min(440, Math.round(w * 0.38)),
  sheet: 0.5, // …narrower: a sheet over the bottom half
};

/** Where the house may go on screen, with the notebook open or closed. Keep in step with Notebook's CSS. */
export function frameFor(width: number, height: number, open: boolean): Frame {
  const top = CHROME.top;
  if (width >= CHROME.sideFrom) {
    return { x: 0, y: top, w: width - (open ? CHROME.side(width) : 0), h: height - top - CHROME.bottom };
  }
  const bottom = open ? Math.round(height * CHROME.sheet) : CHROME.bottom;
  return { x: 0, y: top, w: width, h: Math.max(120, height - top - bottom) };
}

export interface SceneOptions {
  onChoose?: (room: RoomId, project: ProjectId | null) => void; // you clicked a room or a thing in the house
  onSpeak?: (text: string) => void; // he said something (for the aria-live mirror)
}

export interface SceneHandle {
  go(room: RoomId, project?: ProjectId | null): void;
  setOpen(open: boolean): void;
  destroy(): void;
}

const HOVER_PAD = 0.12; // units around his body that still count as pointing at him

export function mountScene(canvas: HTMLCanvasElement, env: SceneEnv, options: SceneOptions = {}): SceneHandle {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { go() {}, setOpen() {}, destroy() {} };
  const { onChoose, onSpeak } = options;

  const body = createBody(0, 0);
  const mind = createMind();
  mind.onSpeak = onSpeak;
  seatAtDesk(body);
  const anim = createAnim();
  settleAnim(anim, body);

  let dpr = 1;
  let open = false;
  let slide = 0; // 0 closed → 1 open
  let closedView: View = layoutHouse(1, 1, { x: 0, y: 0, w: 1, h: 1 });
  let openView: View = closedView;
  let view: View = closedView;
  let raf = 0;
  let last = 0;
  let time = 0;
  let typed = 0;
  const pointer = { x: -1, y: -1, over: false }; // over: was on him last frame (a hello once per visit)
  const house: HouseState = { hover: null, hoverItem: null, holding: null, typed: 0, typing: false, time: 0 };

  const placement = (): Placement => ({
    x: screenX(view, body.x),
    floorY: screenY(view, body.y),
    unit: view.unit,
    facing: body.facing,
    sit: body.posture.sit,
  });
  const onHim = (pose: Pose) => {
    const b = figureBounds(pose, placement(), HOVER_PAD);
    return pointer.x >= b.x0 && pointer.x <= b.x1 && pointer.y >= b.y0 && pointer.y <= b.y1;
  };
  /** What's under the pointer: him, a thing on the bench, a room. */
  const target = (pose: Pose): { him: boolean; item: ProjectId | null; room: RoomId | null } => {
    if (pointer.x < 0) return { him: false, item: null, room: null };
    const x = houseX(view, pointer.x);
    const y = houseY(view, pointer.y);
    const item = itemAt(x, y);
    return { him: onHim(pose), item, room: item ? "workshop" : roomAt(x, y) };
  };

  const bubbleAlpha = () => {
    const s = mind.speech;
    if (!s) return 0;
    if (!Number.isFinite(s.duration)) return 1;
    return Math.max(0, Math.min(1, s.age / BUBBLE_FADE.in, (s.duration - s.age) / BUBBLE_FADE.out));
  };

  const draw = (pose = computePose(body, anim)) => {
    ctx.clearRect(0, 0, view.width, view.height);
    const t = target(pose);
    house.hover = t.him ? null : t.room;
    house.hoverItem = t.item;
    house.holding = mind.holding;
    house.typed = typed;
    house.typing = body.action === "type";
    house.time = time;
    canvas.style.cursor = t.him || t.room ? "pointer" : "default";
    drawHouse(ctx, view, house);
    const at = placement();
    drawFigure(ctx, pose, at);
    drawHeld(ctx, view, pose, at, body.action, mind.holding);
    const alpha = bubbleAlpha();
    if (mind.speech && alpha > 0) {
      const head: [number, number] = [at.x + pose.head.x * at.facing * at.unit, at.floorY - pose.head.y * at.unit];
      drawBubble(ctx, view, head, mind.speech.lines, alpha);
    }
  };

  const layout = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    closedView = layoutHouse(width, height, frameFor(width, height, false));
    openView = layoutHouse(width, height, frameFor(width, height, true));
    view = mixView(closedView, openView, slide);
  };

  const resize = () => {
    dpr = Math.min(env.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout();
    draw();
  };

  const frame = (stamp: number) => {
    const dt = last ? Math.min(MAX_DT, (stamp - last) / 1000) : 0;
    last = stamp;
    if (Math.min(env.devicePixelRatio || 1, MAX_DPR) !== dpr) resize();
    time += dt;
    stepMind(mind, body, dt);
    updateAnim(anim, body, dt);
    if (body.action === "type") typed += dt;
    const goal = open ? 1 : 0;
    if (slide !== goal) {
      slide += (goal - slide) * (1 - Math.exp(-SLIDE_RATE * dt));
      if (Math.abs(goal - slide) < 0.002) slide = goal;
      view = mixView(closedView, openView, slide);
    }
    const pose = computePose(body, anim);
    // Pointing at him: a hello, once each time the pointer comes onto him.
    const over = pointer.x >= 0 && onHim(pose);
    if (over && !pointer.over) greet(mind, body);
    pointer.over = over;
    draw(pose);
    raf = env.requestAnimationFrame(frame);
  };

  const start = () => {
    if (raf) return;
    last = 0;
    raf = env.requestAnimationFrame(frame);
  };
  const stop = () => {
    if (raf) env.cancelAnimationFrame(raf);
    raf = 0;
  };

  // Reduced motion: no loop. He is put straight into each room you choose, with its first line, in one still frame.
  const reduced = env.matchMedia("(prefers-reduced-motion: reduce)");
  const still = () => {
    snapBody(body);
    settleAnim(anim, body);
    slide = open ? 1 : 0;
    view = mixView(closedView, openView, slide);
    draw();
  };
  const applyMotionPreference = () => {
    if (reduced.matches) {
      stop();
      if (!mind.speech) settleInto(mind, body, mind.room, mind.project);
      still();
    } else start();
  };

  const local = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) * view.width) / Math.max(1, r.width);
    pointer.y = ((e.clientY - r.top) * view.height) / Math.max(1, r.height);
  };
  const onMove = (e: PointerEvent) => {
    local(e);
    if (!raf) draw();
  };
  const onDown = (e: PointerEvent) => {
    local(e);
    const t = target(computePose(body, anim));
    if (t.him) {
      greet(mind, body);
      pointer.over = true;
    } else if (t.room) onChoose?.(t.room, t.item);
    if (!raf) draw();
  };
  const onLeave = () => {
    pointer.x = pointer.y = -1;
    pointer.over = false;
    if (!raf) draw();
  };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerleave", onLeave);

  if (new URLSearchParams(env.location.search).has("debug")) {
    (env as SceneEnv & { __house?: unknown }).__house = { body, mind, anim, view: () => view };
  }

  const observer = new env.ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  applyMotionPreference();
  reduced.addEventListener("change", applyMotionPreference);

  return {
    go(room, project = null) {
      if (raf) goTo(mind, body, room, project);
      else {
        settleInto(mind, body, room, project);
        still();
      }
    },
    setOpen(next) {
      open = next;
      if (!raf) still();
    },
    destroy() {
      stop();
      observer.disconnect();
      reduced.removeEventListener("change", applyMotionPreference);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerleave", onLeave);
    },
  };
}
