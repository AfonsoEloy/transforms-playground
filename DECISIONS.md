# DECISIONS.md — Transforms Playground

Append-only log of architectural and convention decisions. Format: date, decision, context, alternatives considered, consequences. Claude Code sessions: read before proposing changes; append, never edit.

---

## 001 — 2026-07-13 — TypeScript + static site, no backend

**Decision:** The product is a fully static web app; all math runs client-side in TypeScript.

**Context:** The tool's core value is instant interactive feedback and zero-friction access. Compute load (composing a handful of 4×4 matrices per frame) is trivial for any modern device.

**Alternatives:** Python backend (adds hosting cost, per-interaction latency, ops burden); Pyodide/WASM Python (≈10 MB runtime download, slow first load); C++→WASM (build complexity with no performance need at this scale).

**Consequences:** Free hosting (GitHub Pages/Vercel), survives traffic spikes, no maintenance. If a future feature genuinely needs a backend, it becomes a separate project.

---

## 002 — 2026-07-13 — Separate zero-dependency math library (`rigid-kit`)

**Decision:** All rotation/transform math lives in a standalone npm package with zero runtime dependencies, no DOM/Three.js/React imports.

**Context:** A tested, documented standalone library is an independent portfolio artifact and keeps the math testable in isolation. Three.js's own math classes exist but bake in graphics conventions (xyzw order, Y-up) and are awkward for exhaustive Euler-sequence support.

**Alternatives:** Use Three.js math directly (couples conventions to a graphics library); use gl-matrix (array-indexed API invites ordering bugs — the exact bug class this tool exists to fight).

**Consequences:** Some duplication with Three.js math; adapters required at the UI boundary (contained in `apps/playground/src/adapters/`). Worth it for type safety and publishability.

---

## 003 — 2026-07-13 — Quaternions stored as named fields `{w,x,y,z}`, display order switchable

**Decision:** Internal quaternion type uses named fields, never positional arrays, in public APIs. UI offers a display-order toggle (wxyz vs xyzw).

**Context:** wxyz-vs-xyzw is the single most common quaternion bug in robotics (Eigen ctor and ROS msg docs read scalar-first; ROS TF tuples and Three.js are scalar-last). Named fields make the ordering question unaskable in code; the toggle makes it explicit in the UI.

**Alternatives:** Pick one array order internally (invites silent bugs); store both (redundant state).

**Consequences:** Slightly more verbose code; hot loops may use flat arrays internally with a declared layout comment.

---

## 004 — 2026-07-13 — Conventions: active rotations, right-handed, column vectors, radians internal, canonical `w ≥ 0`

**Decision:** As stated. Passive interpretation and degrees are display-layer toggles only.

**Context:** Matches the dominant robotics textbook convention (e.g. `v' = R v`) and SciPy's `Rotation`. One internal convention with explicit display toggles beats configurable internals, which multiply test surface and invite inconsistency.

**Alternatives:** Configurable internal conventions (rejected: combinatorial testing burden, high bug risk).

**Consequences:** Every conversion in/out of external formats (ROS TF paste, Three.js scene) is an adapter with a documented convention mapping.

---

## 005 — 2026-07-13 — Property-based testing with fast-check as the primary correctness tool

**Decision:** Round-trip, composition, and inverse properties are verified over randomized rotation samples (target 1e-12 round-trip error), alongside known-answer tests.

**Context:** The conversion matrix (5 representations × 12 Euler sequences × intrinsic/extrinsic) is too large to cover with hand-written cases; properties catch the branch bugs (e.g. matrix→quat Shepperd branches, gimbal lock) that example tests miss. Also disciplines Claude Code output: generated implementations must survive thousands of adversarial samples.

**Alternatives:** Example-based tests only (insufficient coverage); differential testing against SciPy via a Python sidecar (good idea, kept as an optional CI job later, not a dev-loop dependency).

**Consequences:** Slightly slower test suite; tolerance changes are governed (see CLAUDE.md — loosening beyond 1e-10 requires a new entry here).

---

## 006 — 2026-07-13 — Vite + React, single reducer state, URL hash as source of truth

**Decision:** Vite build, React function components, one `useReducer` app-state object, full state serialized to the URL hash. No Redux/Zustand/router.

**Context:** The app is one screen with deeply shared state; a single serializable object makes shareable URLs (a headline feature) nearly free and keeps Claude Code sessions from scattering state.

**Alternatives:** Zustand (fine, but adds a dependency for no need at this size); query-string state libs (hash chosen so GitHub Pages needs no server-side routing).

**Consequences:** URL length grows with chain size — acceptable; compress with a compact encoding if chains exceed ~20 transforms.

---

## 007 — 2026-07-13 — Scene displayed Z-up (robotics convention) over Three.js default Y-up

**Decision:** The 3D view presents a Z-up right-handed world; the fixed corrective rotation lives in exactly one adapter file.

**Context:** The audience is roboticists; a Y-up world view would itself be a convention trap in a tool about avoiding convention traps.

**Alternatives:** Y-up default with a toggle (deferred: possible later; toggle must not touch math, only the scene root).

**Consequences:** Axis-color and label logic must route through the same adapter; forbidden to apply axis fixes anywhere else (see CLAUDE.md gotchas).

---

## 008 — 2026-07-13 — All tooling runs inside Docker containers

**Decision:** Every dependency install, test run, typecheck, lint, and build executes inside a Docker container (via `docker compose run --rm app …` / `docker compose up dev`), never directly on the host. Node is pinned by the container image; the host needs only Docker.

**Context:** Guarantees a reproducible, hermetic toolchain across machines and future Claude Code sessions regardless of host Node version, and keeps host-level global installs out of the loop. The compose file bind-mounts the source and uses named volumes for `node_modules` so the host working tree stays clean and permission-safe.

**Alternatives:** Host-local Node via nvm/Volta (drifts per machine, pollutes host); devcontainers only (heavier, editor-coupled — the plain compose service is enough and CI-friendly).

**Consequences:** A running Docker daemon is a prerequisite. First `npm install` populates the named volumes; commands are marginally more verbose. CI reuses the same image, so "works on my machine" and "works in CI" converge.
