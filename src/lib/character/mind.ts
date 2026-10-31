// The mind: what he does. Each room has a short script (walk there, sit or pick something up, say a few lines) and
// then something quiet to keep doing there until you choose another room. A script is a queue of beats; the body
// carries out one beat at a time, and the next starts only when it is done (he never walks while still seated, and
// never changes what he's doing mid-stride except when you send him somewhere else).

import { CHAPTERS, HELLO, PROJECTS, type ProjectId, type RoomId } from "@/content/story";
import { FLOORS, FURNITURE, ITEMS, SPOTS, itemSpot, route, type FloorId, type SpotId } from "../house";
import { act, gaze, hold, onFeet, pauseFor, settled, stepBody, turnTo, walkPath, type Action, type Body, type Look } from "./body";

export const ROUTINE = {
  cruise: 1.1, // units/s, a brisk walk between rooms (the house is big for him)
  firstHello: 1.1, // s after arriving before he looks up and waves
  sayBase: 1.6, // s a bubble stays up, plus…
  sayPerWord: 0.3, // …this per word
  holdItem: 7, // s he holds a project up before putting it back on the bench
  pokeGap: 2.5, // s between hellos when you point at him again and again
};

export interface Speech {
  lines: readonly string[];
  age: number; // s since it appeared
  duration: number; // s it stays up (it fades in and out within this)
}

type Spot = { floor: FloorId; x: number; dir: 1 | -1; seat?: number };

type Beat =
  | { kind: "go"; spot: Spot; phase?: "stand" | "walk" | "turn" }
  | { kind: "sit"; seat: number; lean: number; action: Action; look?: Look }
  | { kind: "do"; action: Action; seconds: number; look?: Look; point?: { x: number; h: number }; lean?: number }
  | { kind: "say"; lines: readonly string[]; wait: number } // wait: how long before the next beat (0 = at once)
  | { kind: "turn"; dir: 1 | -1 }
  | { kind: "take"; item: ProjectId }
  | { kind: "put" };

export interface Mind {
  beats: Beat[];
  current: Beat | null;
  wait: number; // s left on the current timed beat
  started: boolean; // the current beat has been given to the body
  room: RoomId; // the room he is in or on his way to
  project: ProjectId | null; // the project he was asked about (the workshop)
  scripted: boolean; // still going through a room's script (asking again would only restart it)
  holding: ProjectId | null; // in his hands, off the bench
  speech: Speech | null;
  onSpeak?: (text: string) => void;
  pokes: number;
  lastPoke: number;
  time: number;
}

const spot = (id: SpotId): Spot => SPOTS[id];
const words = (lines: readonly string[]) => lines.join(" ").split(/\s+/).length;
const sayFor = (lines: readonly string[]) => ROUTINE.sayBase + ROUTINE.sayPerWord * words(lines);
const say = (lines: readonly string[], extra = 0.4): Beat => ({ kind: "say", lines, wait: sayFor(lines) + extra });
const SEATED = 0.25; // leaning in at a desk

export function createMind(): Mind {
  return {
    beats: hello(),
    current: null,
    wait: 0,
    started: false,
    room: "office",
    project: null,
    scripted: false, // the hello isn't a room's script: asking for the office during it starts the office's
    holding: null,
    speech: null,
    pokes: 0,
    lastPoke: -Infinity,
    time: 0,
  };
}

/** How he starts: already at his desk, typing; he looks up, waves and says hello, then gets back to it. */
export function seatAtDesk(b: Body): void {
  const s = SPOTS.office;
  b.x = s.x;
  b.y = FLOORS[s.floor];
  b.dir = s.dir;
  b.facing = s.dir;
  b.seat = s.seat;
  hold(b, { sit: 1, lean: SEATED });
  Object.assign(b.posture, b.postureTarget);
  act(b, "type");
  gaze(b, { x: 0.3, y: -0.25 });
  pauseFor(b, Infinity);
}

function hello(): Beat[] {
  const [hi, what, look] = HELLO.arrive;
  return [
    { kind: "do", action: "type", seconds: ROUTINE.firstHello, look: { x: 0.3, y: -0.25 } },
    { kind: "do", action: "wave", seconds: 0, look: { x: -0.2, y: 0.1 } },
    say(hi, 0.6),
    { kind: "do", action: "desk", seconds: 0, look: { x: -0.1, y: 0 } },
    say(what),
    say(look),
  ];
}

// ── Scripts ──────────────────────────────────────────────────────────────────

/** Where he ends up in a room (for reduced motion's still frame and for the checks). */
export function restingSpot(room: RoomId, project: ProjectId | null): Spot {
  if (room === "workshop" && project) return { floor: "first", x: itemSpot(project), dir: 1 };
  if (room === "library") return spot("armchair");
  if (room === "door") return spot("door");
  return spot(room);
}

function script(room: RoomId, project: ProjectId | null): Beat[] {
  const lines = CHAPTERS[room].lines;
  const D = FURNITURE;
  switch (room) {
    case "office":
      return [
        { kind: "go", spot: spot("office") },
        { kind: "sit", seat: D.chair.seat, lean: SEATED, action: "type", look: { x: 0.3, y: -0.25 } },
        say(lines[0]),
        { kind: "do", action: "point", seconds: 0, point: { x: (D.board.left + D.board.right) / 2, h: 1.2 }, look: { x: 0.5, y: 0.7 } },
        say(lines[1]),
      ];
    case "attic":
      return [
        { kind: "go", spot: spot("attic") },
        { kind: "sit", seat: D.oldChair.seat, lean: 0.15, action: "desk", look: { x: 0.4, y: 0 } },
        say(lines[0]),
        { kind: "do", action: "chin", seconds: 0, look: { x: 0.2, y: 0.25 } },
        say(lines[1]),
        { kind: "do", action: "desk", seconds: 0, look: { x: 0.5, y: -0.1 } },
        say(lines[2]),
      ];
    case "library":
      return [
        { kind: "go", spot: spot("library") },
        { kind: "do", action: "point", seconds: 0.6, point: { x: 2.55, h: 1.3 }, look: { x: 0.6, y: 0.7 } },
        say(lines[0]),
        { kind: "do", action: "book", seconds: 0, look: { x: 0.3, y: -0.6 } },
        say(lines[1]),
        { kind: "go", spot: spot("armchair") },
        { kind: "sit", seat: D.armchair.seat, lean: 0, action: "book", look: { x: 0.3, y: -0.6 } },
      ];
    case "workshop": {
      if (project) {
        const p = PROJECTS.find((q) => q.id === project)!;
        return [
          { kind: "go", spot: { floor: "first", x: itemSpot(project), dir: 1 } },
          { kind: "do", action: "bench", seconds: 0.5, look: { x: 0.5, y: -0.5 } },
          { kind: "take", item: project },
          { kind: "do", action: "show", seconds: 0, look: { x: 0.2, y: 0.05 } },
          say(p.line, 0.6),
          { kind: "do", action: "show", seconds: ROUTINE.holdItem, look: { x: 0.4, y: -0.25 } },
          { kind: "do", action: "bench", seconds: 0.5, look: { x: 0.5, y: -0.5 } },
          { kind: "put" },
        ];
      }
      return [
        { kind: "go", spot: spot("workshop") },
        { kind: "do", action: "bench", seconds: 1.2, look: { x: 0.5, y: -0.5 } },
        say(lines[0]),
        { kind: "do", action: "point", seconds: 0, point: { x: ITEMS.envirobyte, h: 0.75 }, look: { x: 0.5, y: -0.3 } },
        say(lines[1]),
      ];
    }
    case "door":
      return [
        { kind: "go", spot: spot("doorway") },
        { kind: "go", spot: spot("door") },
        { kind: "do", action: "wave", seconds: 0, look: { x: 0, y: 0.1 } },
        say(lines[0], 0.6),
        { kind: "turn", dir: 1 },
        { kind: "do", action: "point", seconds: 0, point: { x: D.mailbox.x, h: D.mailbox.h }, look: { x: 0.6, y: -0.3 } },
        say(lines[1]),
        { kind: "turn", dir: -1 },
      ];
  }
}

/** What he keeps doing in a room once its script is done: a few quiet beats, repeated. */
function idle(room: RoomId): Beat[] {
  switch (room) {
    case "office":
      return [
        { kind: "do", action: "type", seconds: 9, look: { x: 0.3, y: -0.25 } },
        { kind: "do", action: "desk", seconds: 3, look: { x: 0.4, y: 0 } },
        { kind: "do", action: "chin", seconds: 4, look: { x: 0.2, y: 0.2 } },
        { kind: "do", action: "type", seconds: 12, look: { x: 0.3, y: -0.25 } },
      ];
    case "attic":
      return [
        { kind: "do", action: "chin", seconds: 6, look: { x: 0.5, y: 0.3 } },
        { kind: "do", action: "desk", seconds: 5, look: { x: 0.4, y: -0.1 } },
      ];
    case "library":
      return [
        { kind: "do", action: "book", seconds: 11, look: { x: 0.3, y: -0.6 } },
        { kind: "do", action: "book", seconds: 2.5, look: { x: 0.2, y: 0.25 } }, // looks up from the page
      ];
    case "workshop":
      return [
        { kind: "do", action: "bench", seconds: 8, look: { x: 0.5, y: -0.5 } },
        { kind: "do", action: "none", seconds: 2.5, look: { x: 0.4, y: 0.6 } }, // the pegboard: which tool next
        { kind: "do", action: "bench", seconds: 10, look: { x: 0.5, y: -0.5 } },
      ];
    case "door":
      return [
        { kind: "do", action: "none", seconds: 5, look: { x: 0.3, y: 0.05 } },
        { kind: "turn", dir: 1 },
        { kind: "do", action: "none", seconds: 4, look: { x: 1, y: 0.15 } }, // out at the street
        { kind: "turn", dir: -1 },
      ];
  }
}

// ── Asking him things ───────────────────────────────────────────────────────

/** Send him to a room (and, in the workshop, to a project). Asking for where he already is does nothing. */
export function goTo(m: Mind, b: Body, room: RoomId, project: ProjectId | null = null): void {
  if (room === m.room && project === m.project && m.scripted) return;
  const next = script(room, project);
  // Something in his hands goes back on the bench first (he's standing at it).
  if (m.holding) next.unshift({ kind: "do", action: "bench", seconds: 0.4 }, { kind: "put" });
  m.beats = next;
  m.current = null;
  m.started = false;
  m.wait = 0;
  m.room = room;
  m.project = project;
  m.scripted = true;
}

/** You pointed at him: a wave and a hello, then back to what he was doing. On the move, just the hello. */
export function greet(m: Mind, b: Body): void {
  if (m.time - m.lastPoke < ROUTINE.pokeGap) return;
  m.lastPoke = m.time;
  const lines = HELLO.poke[m.pokes++ % HELLO.poke.length];
  const moving = b.mode !== "pause" || m.current?.kind === "go";
  if (moving || m.holding) {
    speak(m, lines);
    return;
  }
  const resume = m.current ? [{ ...m.current }] : [];
  m.beats.unshift({ kind: "do", action: "wave", seconds: 0, look: { x: 0, y: 0.1 } }, say(lines, 0.2), ...resume);
  m.current = null;
  m.started = false;
}

function speak(m: Mind, lines: readonly string[]): void {
  m.speech = { lines, age: 0, duration: sayFor(lines) };
  m.onSpeak?.(lines.join(" "));
}

// ── Step ────────────────────────────────────────────────────────────────────

/** Start a beat: give the body its command. */
function begin(m: Mind, b: Body, beat: Beat): void {
  switch (beat.kind) {
    case "go":
      beat.phase = "stand";
      hold(b, { sit: 0, lean: 0 });
      act(b, "none");
      break;
    case "sit":
      b.seat = beat.seat;
      hold(b, { sit: 1, lean: beat.lean });
      act(b, beat.action);
      if (beat.look) gaze(b, beat.look);
      pauseFor(b, Infinity);
      break;
    case "do":
      if (beat.point) b.point = { ...beat.point };
      if (beat.lean !== undefined) hold(b, { lean: beat.lean });
      act(b, beat.action);
      if (beat.look) gaze(b, beat.look);
      pauseFor(b, Infinity);
      m.wait = beat.seconds;
      break;
    case "say":
      speak(m, beat.lines);
      m.wait = beat.wait;
      break;
    case "turn":
      act(b, "none");
      turnTo(b, beat.dir);
      break;
    case "take":
      m.holding = beat.item;
      act(b, "show");
      break;
    case "put":
      m.holding = null;
      act(b, "bench");
      break;
  }
}

/** True once a started beat is done. */
function done(m: Mind, b: Body, beat: Beat, idleBody: boolean): boolean {
  switch (beat.kind) {
    case "go": {
      if (beat.phase === "stand") {
        if (!onFeet(b)) return false;
        beat.phase = "walk";
        walkPath(b, route(b, beat.spot, b.path[0]), ROUTINE.cruise);
        return false;
      }
      if (beat.phase === "walk") {
        if (b.mode !== "pause") return false;
        beat.phase = "turn";
        turnTo(b, beat.spot.dir);
        return false;
      }
      return b.mode === "pause";
    }
    case "sit":
      return settled(b, 0.05);
    case "do":
    case "say":
      return m.wait <= 0;
    case "turn":
      return idleBody;
    case "take":
    case "put":
      return true;
  }
}

export function stepMind(m: Mind, b: Body, dt: number): void {
  m.time += dt;
  if (m.speech) {
    m.speech.age += dt;
    if (m.speech.age >= m.speech.duration) m.speech = null;
  }
  const idleBody = stepBody(b, dt);
  m.wait -= dt;
  // Several instant beats (a hand action, then a line) can start in the same frame.
  for (let guard = 0; guard < 8; guard++) {
    if (!m.current) {
      if (!m.beats.length) {
        m.beats = idle(m.room);
        m.scripted = false;
      }
      m.current = m.beats.shift()!;
      m.started = false;
    }
    if (!m.started) {
      begin(m, b, m.current);
      m.started = true;
    }
    if (!done(m, b, m.current, idleBody)) break;
    m.current = null;
  }
}

/** Reduced motion: put him straight into the room's resting pose (no walk), with the room's first line. */
export function settleInto(m: Mind, b: Body, room: RoomId, project: ProjectId | null): void {
  const s = restingSpot(room, project);
  b.x = s.x;
  b.y = FLOORS[s.floor];
  b.dir = s.dir;
  b.facing = s.dir;
  pauseFor(b, Infinity);
  const seat = s.seat;
  b.seat = seat ?? b.seat;
  hold(b, { sit: seat ? 1 : 0, lean: room === "office" ? SEATED : room === "attic" ? 0.15 : 0 });
  const action: Action = { office: "desk", attic: "chin", library: "book", workshop: project ? "show" : "bench", door: "none" }[room] as Action;
  act(b, action);
  gaze(b, room === "library" ? { x: 0.3, y: -0.6 } : { x: 0.3, y: 0 });
  m.holding = room === "workshop" ? project : null;
  m.room = room;
  m.project = project;
  m.beats = [];
  m.scripted = false;
  m.current = { kind: "do", action, seconds: Infinity };
  m.started = true;
  m.wait = Infinity;
  const p = project ? PROJECTS.find((q) => q.id === project) : null;
  speak(m, p ? p.line : CHAPTERS[room].lines[0]);
  m.speech!.duration = Infinity; // a still frame keeps its bubble
}
