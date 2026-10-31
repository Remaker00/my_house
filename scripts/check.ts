// Checks, run with `npm run check`: he says hello, every room's script gets him to the right place in the right
// posture and says its lines, the stairs work both ways, sending him somewhere else on the way (even mid-stair) still
// gets him there, things picked up go back on the bench, a hello mid-task resumes the task, and over hours of random
// requests nothing goes NaN, jumps between frames, walks while seated, leaves the floor or gets stuck.

import { CHAPTERS, PROJECTS, ROOM_ORDER, type ProjectId, type RoomId } from "../src/content/story";
import { createBody, snapBody, type Body } from "../src/lib/character/body";
import { createMind, goTo, greet, restingSpot, seatAtDesk, settleInto, stepMind, type Mind } from "../src/lib/character/mind";
import { computePose, createAnim, settleAnim, updateAnim, type Anim, type Point, type Pose } from "../src/lib/character/pose";
import { FLOORS, WALK, STAIRS, floorOf, itemAt, roomAt, ITEMS } from "../src/lib/house";

let failed = false;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failed = true;
};

interface Sim {
  b: Body;
  m: Mind;
  a: Anim;
  said: string[];
  t: number;
  bad: { nan: number; seatedWalk: number; jump: number; offFloor: number; maxJump: number };
  prev: Point[] | null;
}

function sim(): Sim {
  const b = createBody(0, 0, () => 0.5);
  const m = createMind();
  const s: Sim = { b, m, a: createAnim(), said: [], t: 0, bad: { nan: 0, seatedWalk: 0, jump: 0, offFloor: 0, maxJump: 0 }, prev: null };
  m.onSpeak = (text) => s.said.push(text);
  seatAtDesk(b);
  settleAnim(s.a, b);
  return s;
}

const world = (b: Body, p: Pose): Point[] =>
  [p.hip, p.neck, p.head, ...p.legs.flatMap((l) => [l.joint, l.end]), ...p.arms.flatMap((l) => [l.joint, l.end])].map((q) => ({
    x: b.x + q.x * b.facing,
    y: b.y + q.y,
  }));

/** On a floor (within its walkable span) or on one of the stairs. */
function onGround(b: Body): boolean {
  for (const s of STAIRS) {
    const lo = Math.min(s.bottom, s.top);
    const hi = Math.max(s.bottom, s.top);
    if (b.x < lo - 0.01 || b.x > hi + 0.01) continue;
    const t = (b.x - s.bottom) / (s.top - s.bottom);
    if (Math.abs(b.y - (FLOORS[s.lower] + t * (FLOORS[s.upper] - FLOORS[s.lower]))) < 0.02) return true;
  }
  const f = floorOf(b.y);
  return Math.abs(b.y - FLOORS[f]) < 1e-6 && b.x >= WALK[f][0] - 0.01 && b.x <= WALK[f][1] + 0.01;
}

const DT = 1 / 60;
function run(s: Sim, seconds: number, until?: (s: Sim) => boolean): boolean {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    stepMind(s.m, s.b, DT);
    updateAnim(s.a, s.b, DT);
    s.t += DT;
    const pose = computePose(s.b, s.a);
    const pts = world(s.b, pose);
    if (pts.some((q) => !Number.isFinite(q.x) || !Number.isFinite(q.y)) || !Number.isFinite(s.b.x) || !Number.isFinite(s.b.y)) s.bad.nan++;
    if (s.b.mode === "walk" && s.b.posture.sit > 0.05) s.bad.seatedWalk++;
    if (!onGround(s.b)) s.bad.offFloor++;
    if (s.prev) {
      // A turn swings every point through the body's middle, and a swinging foot moves several times faster than he
      // walks; anything beyond that (3 cm a frame standing still) is a jump.
      const j = Math.max(...pts.map((q, k) => Math.hypot(q.x - s.prev![k].x, q.y - s.prev![k].y)));
      const allowed = 0.03 + 5 * s.b.speed * DT;
      s.bad.maxJump = Math.max(s.bad.maxJump, s.b.mode === "turn" ? 0 : j / allowed);
      if (s.b.mode !== "turn" && j > allowed) s.bad.jump++;
    }
    s.prev = pts;
    if (until?.(s)) return true;
  }
  return false;
}

const settledIn = (s: Sim) => !s.m.scripted && s.m.current?.kind !== "go";
const at = (s: Sim, room: RoomId, project: ProjectId | null = null) => {
  const r = restingSpot(room, project);
  return Math.abs(s.b.x - r.x) < 0.02 && Math.abs(s.b.y - FLOORS[r.floor]) < 1e-6 && s.b.dir === r.dir;
};
const clean = (s: Sim) => s.bad.nan + s.bad.seatedWalk + s.bad.jump + s.bad.offFloor === 0;
const badText = (s: Sim) => `nan ${s.bad.nan}, seated walk ${s.bad.seatedWalk}, jumps ${s.bad.jump}, off floor ${s.bad.offFloor}, worst ${(s.bad.maxJump * 100).toFixed(0)}% of allowed`;

console.log("1. arriving");
{
  const s = sim();
  run(s, 14);
  check("he waves and says hello", s.said[0] === "Hi, I'm Nishant.", s.said[0]);
  check("…says what he does and invites you in", s.said.length === 3, s.said.join(" | "));
  check("…and is still at his desk, seated", at(s, "office") && s.b.posture.sit > 0.95);
  run(s, 6);
  check("then gets back to typing", s.b.action === "type");
  check("no bad frames", clean(s), badText(s));
}

console.log("2. every room from the office");
for (const room of ROOM_ORDER) {
  const s = sim();
  run(s, 12);
  s.said = [];
  goTo(s.m, s.b, room);
  const ok = run(s, 90, settledIn);
  const lines = CHAPTERS[room].lines.map((l) => l.join(" "));
  const seated = restingSpot(room, null).seat !== undefined;
  check(
    `${room}: arrives in ${s.t.toFixed(0)} s`,
    ok && at(s, room) && (seated ? s.b.posture.sit > 0.9 : s.b.posture.sit < 0.05),
    `x ${s.b.x.toFixed(2)} y ${s.b.y.toFixed(2)} sit ${s.b.posture.sit.toFixed(2)}`,
  );
  check(`${room}: says its lines in order`, lines.every((l, i) => s.said[i] === l), s.said.join(" | "));
  check(`${room}: no bad frames`, clean(s), badText(s));
}

console.log("3. from every room to every other");
{
  let arrivals = 0;
  let total = 0;
  let worst = 0;
  const s = sim();
  run(s, 12);
  for (const from of ROOM_ORDER) {
    for (const to of ROOM_ORDER) {
      if (from === to) continue;
      goTo(s.m, s.b, from);
      run(s, 90, settledIn);
      const t0 = s.t;
      goTo(s.m, s.b, to);
      total++;
      if (run(s, 90, settledIn) && at(s, to)) arrivals++;
      worst = Math.max(worst, s.t - t0);
    }
  }
  check("every trip arrives", arrivals === total, `${arrivals}/${total}, slowest ${worst.toFixed(0)} s`);
  check("the slowest trip (with its lines) stays under a minute", worst < 60, `${worst.toFixed(0)} s`);
  check("no bad frames", clean(s), badText(s));
}

console.log("4. changing his mind on the way");
{
  const s = sim();
  run(s, 12);
  goTo(s.m, s.b, "attic");
  const onStair = run(s, 60, (q) => q.b.mode === "walk" && q.b.path.length > 0 && Math.abs(q.b.path[0].y - q.b.y) > 1e-6 && q.b.y > 0.6);
  check("caught him halfway up a stair", onStair, `y ${s.b.y.toFixed(2)}`);
  goTo(s.m, s.b, "office");
  check("…sent back down: he gets to the office", run(s, 90, settledIn) && at(s, "office"));
  goTo(s.m, s.b, "door");
  run(s, 1.5);
  goTo(s.m, s.b, "library");
  check("changed his mind just after getting up: library", run(s, 90, settledIn) && at(s, "library"));
  check("no bad frames", clean(s), badText(s));
}

console.log("5. the workshop");
{
  const s = sim();
  run(s, 12);
  goTo(s.m, s.b, "workshop", "zaprep");
  const held = run(s, 60, (q) => q.m.holding === "zaprep");
  check("goes to the bench and picks it up", held && s.b.x < ITEMS.zaprep && s.b.y === FLOORS.first);
  run(s, 5);
  check("…holds it up and says its line", s.b.action === "show" && s.said.includes(PROJECTS.find((p) => p.id === "zaprep")!.line.join(" ")));
  goTo(s.m, s.b, "workshop", "envirobyte");
  run(s, 0.6);
  check("asked about another: puts the first back before going", s.m.holding === null);
  run(s, 30, (q) => q.m.holding === "envirobyte");
  check("…and picks up the next", s.m.holding === "envirobyte" && at(s, "workshop", "envirobyte"));
  run(s, 20);
  check("puts it back after a while", s.m.holding === null && s.b.action === "bench");
  goTo(s.m, s.b, "workshop", "poweredbyai");
  run(s, 30, (q) => q.m.holding === "poweredbyai");
  goTo(s.m, s.b, "door");
  run(s, 1);
  check("sent away holding something: it goes back on the bench", s.m.holding === null);
  check("no bad frames", clean(s), badText(s));
}

console.log("6. pointing at him");
{
  const s = sim();
  run(s, 25);
  s.said = [];
  greet(s.m, s.b);
  run(s, 0.1);
  check("seated at work: he waves", s.b.action === "wave" && s.said.length === 1, s.said[0]);
  run(s, 6);
  check("…then goes back to what he was doing", s.b.action === "type" || s.b.action === "desk" || s.b.action === "chin", s.b.action);
  greet(s.m, s.b);
  check("again at once: nothing (no hello every frame)", s.said.length === 1);
  goTo(s.m, s.b, "attic");
  run(s, 4);
  run(s, 3);
  const before = s.said.length;
  greet(s.m, s.b);
  check("walking: just a hello, no wave", s.said.length === before + 1 && s.b.action !== "wave" && s.m.current?.kind === "go");
  check("…and he keeps going", run(s, 90, settledIn) && at(s, "attic"));
  check("no bad frames", clean(s), badText(s));
}

console.log("7. three hours of random requests");
{
  const s = sim();
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const projects = PROJECTS.map((p) => p.id);
  let requests = 0;
  while (s.t < 3 * 3600) {
    run(s, rand() < 0.3 ? rand() * 2 : rand() * 40);
    const room = ROOM_ORDER[Math.floor(rand() * ROOM_ORDER.length)];
    const project = room === "workshop" && rand() < 0.7 ? projects[Math.floor(rand() * projects.length)] : null;
    if (rand() < 0.15) greet(s.m, s.b);
    else goTo(s.m, s.b, room, project);
    requests++;
  }
  const last = s.m.room;
  const arrived = run(s, 90, settledIn) && at(s, last, s.m.project);
  check(`${requests} requests: he still arrives at the last one`, arrived, `${last}`);
  check("no NaNs, no walking seated, never off the floor or stairs", s.bad.nan + s.bad.seatedWalk + s.bad.offFloor === 0, badText(s));
  check("no jumps between frames", s.bad.jump === 0, `worst ${(s.bad.maxJump * 100).toFixed(0)}% of allowed`);
}

console.log("8. reduced motion and the house");
{
  for (const room of ROOM_ORDER) {
    const s = sim();
    settleInto(s.m, s.b, room, room === "workshop" ? "poweredbyai" : null);
    snapBody(s.b);
    settleAnim(s.a, s.b);
    const p = world(s.b, computePose(s.b, s.a));
    const seated = restingSpot(room, null).seat !== undefined && room !== "workshop";
    check(
      `${room}: a still frame in place, with a line`,
      at(s, room, room === "workshop" ? "poweredbyai" : null) && p.every((q) => Number.isFinite(q.x)) && !!s.m.speech && (seated ? s.b.posture.sit === 1 : true),
    );
  }
  check("rooms are where you point", roomAt(2, 0.8) === "office" && roomAt(8, 0.8) === "door" && roomAt(2, 2.5) === "library" && roomAt(7, 2.5) === "workshop" && roomAt(5.5, 4.2) === "attic");
  check("nothing above the roof is the attic", roomAt(0.8, 5) === null && roomAt(10.2, 5) === null);
  check("the things on the bench are where you point", (Object.keys(ITEMS) as ProjectId[]).every((id) => itemAt(ITEMS[id], FLOORS.first + 0.65) === id));
}

console.log(failed ? "\nsome checks failed" : "\nall checks passed");
if (failed) process.exitCode = 1;
