@AGENTS.md

# Nishant's house

Nishant Sourav's portfolio as a small ink house, cut open like a dollhouse. A tiny figure (him) lives in it. Choose a
room (or point at one) and he walks there, up and down the stairs, and tells that part of the story in speech
bubbles, while a notebook beside the house holds the plain facts and links. Point at him and he waves.

Rooms: attic (where I began) · library (skills as books) · workshop (projects as things on the bench) · office
(ByteQuest and the numbers) · front door (contact). `/story` is the whole story as one plain page.

Built on the engine of The Quiet Grind (`~/Projects/never-ending-search`): body, pose and figure drawing come from
there, adapted for a house with floors and stairs. The facts come from the old "Ship Log" portfolio
(`~/Projects/My_portfolio/frontend/src/content`).

## Stack
Next.js 16 (App Router, `src/`) · TypeScript · Tailwind v4 (CSS-first, tokens in `globals.css`) · Canvas 2D.
No other runtime dependencies.

## Commands
- `npm run dev` starts the dev server
- `npm run build` / `npx tsc --noEmit` / `npm run lint` must stay clean
- `npm run check` runs the headless checks (scripts/check.ts): hello, every room's script, stairs both ways,
  interrupting him (even mid-stair), the workshop's things, pointing at him, three simulated hours of random requests
  (no NaN, no jumps, no walking seated, never off the floor), reduced motion, hit-testing
- `?debug` exposes the live objects as `window.__house`

## Layout
```
src/content/story.ts          ALL the words: profile, chapters (what he says per room), projects, career, skills
src/app/page.tsx              the house page (+ a skip link to /story)
src/app/story/page.tsx        the whole story as text (screen readers, search engines, people in a hurry)
src/components/House.tsx      canvas, name at the top, room words and links at the bottom, aria-live mirror
src/components/Notebook.tsx   the facts of the chosen room: right column ≥ 900 px, bottom sheet below
src/lib/house.ts              the house in units: floors, stairs, furniture, items, spots, rooms; route(); layout
src/lib/character/body.ts     walking a path (floors + stairs), turning where it doubles back, posture, hand action
src/lib/character/pose.ts     joints from the body (Jimmy's pose with this house's hand targets)
src/lib/character/mind.ts     beats: a script per room, then an idle loop; goTo, greet, settleInto (reduced motion)
src/lib/render.ts             sky → land → house body + lit rooms → furniture → glows → porch, smoke, fireflies →
                              figure → held thing → bubble; NIGHT palette
src/lib/scene.ts              mountScene: the one rAF loop, resize + DPR, the house sliding aside for the notebook,
                              pointer hover/click, reduced motion; CHROME/frameFor keep space for the page's words
```

## Design rules
- Night-time and cosy (chosen 2026-10-31, replacing paper and ink): a navy sky with stars and a moon, the house a dark
  silhouette, every room lit warmly from inside by its own lamp (LIGHTS in render.ts). Furniture is dark brown line
  with a few muted colour fills; he is the darkest shape, with a faint warm rim so he reads outside. Glows are added
  light, drawn before the figure. The page's words are cream with lamp-amber accents (`--ink`, `--glow`).
- Words, not buttons with boxes.
- His lines are short and only state facts that are in `story.ts`. Exact details live in the notebook.
- Escape hatches always in reach: résumé, GitHub, LinkedIn, email and "read as text".

## Gotchas
- Per-frame state lives in the mountScene closure, never in React state.
- Behaviour goes in mind.ts beats; he changes what he's doing only when a beat ends (or you send him somewhere).
- Stairs run along the back wall: he walks in front of them and only climbs at their ends (`route` in house.ts).
- Slowing down follows the braking curve exactly (body.ts); easing it would carry him in mid-stride and snap his feet.
- Keep `CHROME` in scene.ts in step with the Notebook's CSS sizes (440px / 38vw column, 50dvh sheet).
- Canvas code must not use `Path2D` (the checks run in Node).
