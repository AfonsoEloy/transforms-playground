# CLAUDE.md — Transforms Playground

Instructions for Claude Code sessions working in this repo. Read SPEC.md before implementing features and DECISIONS.md before proposing architectural changes.

## Project shape

npm workspaces monorepo:

- `packages/rigid-kit` — pure TypeScript rotation/transform math library. **Zero runtime dependencies. No DOM, no Three.js, no React imports. Ever.**
- `apps/playground` — Vite + React + TypeScript + Three.js web app. Adapters between rigid-kit types and Three.js live here, in `apps/playground/src/adapters/`.

## Commands

**All builds, tests, dependency installs, and tooling MUST run inside Docker containers.** Never run `npm`/`node`/`npx` directly on the host. The repo ships a `docker-compose.yml` with an `app` service (Node pinned in the image) plus named volumes for `node_modules` so the host tree stays clean. Canonical invocations:

```bash
docker compose run --rm app npm install          # installs all workspaces
docker compose run --rm app npm run test          # all tests (Vitest), must pass before any commit
docker compose run --rm app npm run test:watch    # watch mode
docker compose run --rm app npm run typecheck     # tsc --noEmit across workspaces
docker compose run --rm app npm run lint          # eslint + prettier check
docker compose run --rm app npm run build         # builds library then app
docker compose up dev                             # playground dev server on http://localhost:5173
```

The npm scripts themselves (`npm install`, `npm run test`, …) are unchanged — the rule is *where* they run, not what they're called. If a command is missing or broken, fix the tooling first and note it in the PR description — do not work around it silently.

## Non-negotiable rules

1. **Math conventions in SPEC.md §2 are law.** Quaternions use named fields `{w,x,y,z}`; angles are radians internally; active rotations, right-handed frames, column vectors, `v' = R v`. Every function that touches a rotation must have a doc comment stating its convention assumptions.
2. **Tests first for math code.** Any new function in `rigid-kit` gets its tests written and shown BEFORE the implementation. Include:
   - Known-answer tests (e.g. 90° about Z sends X̂ to Ŷ; identity quaternion is `{w:1,x:0,y:0,z:0}`).
   - Property-based tests with `fast-check`: round-trips (quat → matrix → quat recovers input up to sign, error < 1e-12), composition associativity, inverse properties, norm preservation.
   - Degenerate cases: identity, 180° rotations, gimbal lock (pitch = ±90°), zero-length axis input (must throw a typed error, never NaN).
3. **No silent numerical fixes.** Do not auto-normalize or clamp inside conversion functions; validation and repair are explicit, separately-named functions (`normalize`, `orthonormalize`) that the UI invokes deliberately.
4. **No new dependencies without asking.** Propose in the plan step with a one-line justification. `rigid-kit` stays at zero runtime deps, period. Dev deps require justification too.
5. **Never use `number[]` indexing for quaternion/matrix element access in public APIs.** Use named fields or named accessor helpers. Internal hot loops may use flat arrays with a comment declaring the layout.
6. **URL state is the single source of truth for shareable settings.** New UI state must be added to the serializer + parser + a round-trip test, or explicitly documented as ephemeral.
7. **Keep the build static.** No server code, no API routes, no environment secrets. If a feature seems to need a backend, stop and flag it — it's probably out of scope (SPEC.md non-goals).
8. **Do not modify DECISIONS.md entries.** Append new entries; never rewrite history. If you disagree with a decision, say so in the session and propose a new entry.

## Code style

- TypeScript strict mode, `noUncheckedIndexedAccess` on.
- Prefer pure functions; rigid-kit types are immutable (functions return new objects).
- Branded types for math primitives (see `packages/rigid-kit/src/types.ts`) so `Vec3`/`Quaternion`/`RGBA` cannot be cross-assigned.
- File names kebab-case; exported symbols camelCase; types PascalCase.
- Comments explain WHY (convention choices, numerical stability tricks like the Shepperd method branch in matrix→quat), not WHAT.
- React: function components + hooks only; state via `useReducer` on the single app-state object; no external state library.
- Three.js objects are created once and mutated per frame; never recreate geometries/materials inside render loops.

## Workflow expectations

- Start every task by restating the plan in 3–6 bullets and identifying which SPEC.md phase/acceptance criteria it serves. Wait for approval only if the plan deviates from SPEC.md.
- Small, reviewable commits with imperative messages (`add euler-to-quat for all 12 sequences`). Commit at natural checkpoints (a green slice: tests + typecheck + lint passing), not one giant commit per session.
- **Commit trailer:** end every commit message with a single `Assisted by <model_name>` line (e.g. `Assisted by Claude Opus 4.8`) naming the model that did the work. Do NOT use `Co-Authored-By` / `Co-authored-by`.
- Before declaring a task done: `npm run test && npm run typecheck && npm run lint` all green, and state which acceptance criteria from SPEC.md are now met.
- If numerical test tolerances need loosening, that is a red flag: investigate the algorithm (e.g. use the stable branch selection in matrix→quaternion) before touching the tolerance. Loosening beyond 1e-10 requires a DECISIONS.md entry.

## Gotchas already known

- Three.js `Quaternion` constructor order is `(x, y, z, w)` — opposite of our display default. All conversion happens in `adapters/`, nowhere else.
- Three.js is right-handed, Y-up by default; our world view uses Z-up (robotics convention) — the scene root applies a fixed rotation, documented in `adapters/scene-frame.ts`. Do not "fix" axes anywhere else.
- `Math.atan2` handles Euler extraction quadrants; never use `Math.asin` alone without clamping its argument to [-1, 1] (floating point can produce 1.0000000000000002).
- Euler sequence naming: "XYZ intrinsic" ≡ "ZYX extrinsic" (reversed). Tests must cover this equivalence explicitly.
