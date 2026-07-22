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

---

## 009 — 2026-07-14 — Composition chain is the app model; full 4×4 rigid transforms

**Decision:** Phase 3 composition is built as *the* app model rather than bolted onto the single-rotation editor. State holds an ordered `chain` of `ChainElement`s (each an SE(3) `Transform` = `{rotation, translation}` plus `enabled`/`inverted` flags and a stable `id`), with one `selectedId`. The composed chain result `T1·…·Tn` is the canonical hub that feeds the 3D view, probe, and result readout; the five representation panels edit the currently-selected element. A single-element chain is exactly the old single-rotation editor. Rotations are rotation-*and*-translation (full 4×4 homogeneous transforms in minimal `{rotation, translation}` form), not rotation-only.

**Context:** SPEC §4 Phase 3 calls for an ordered, reorderable, toggle/invertable chain with a live composed result and shareable state, and SPEC §2 lists 4×4 homogeneous transforms as a first-class concern. Making the chain the model (rather than a separate "compose" surface layered over a rotation hub) keeps one source of truth: `deriveViews(state)` produces both the selected-element reps (panels) and the composed result (3D/probe/readout) from the same chain, so there is no second code path to keep in sync. Modeling elements as full SE(3) transforms from the start avoids a later rotation→transform migration.

**Alternatives:** (a) Rotation-only chain with translation deferred — rejected: SPEC §2/§4 want 4×4, and retrofitting translation touches every rep/derive/URL path twice. (b) Separate single-rotation hub + independent chain list that references it — rejected: two sources of truth, ambiguous which one the 3D view follows, and the "edit the selected element in any representation" UX falls out naturally only when the chain *is* the model.

**Consequences:** The old `rotation` hub field is gone; `setRotation`/`setTranslation` retarget the current selection, so panels and `commit.ts` are unchanged. `deriveViews` is O(n) over the chain (chain-of-10 recompute is far under the 1 ms Phase 3 budget). The chain serializes to the URL as a compact `c=` list (`w,x,y,z,tx,ty,tz,en,inv` per element, `;`-separated; both `,` and `;` survive hash-encoding via explicit de-encoding), with selection as an index `sel=` and `inter=` for the intermediate-frames toggle; legacy single-quaternion `q=` URLs are honored as a 1-element chain. Intermediate cumulative frames are drawn from a fixed pool of 16 dim triads (shown/hidden/re-posed per frame, never rebuilt), so chains longer than 16 simply don't draw the overflow frames.

---

## 010 — 2026-07-22 — `rigid-kit` stays unpublished; consumed only as a workspace dependency

**Decision:** `rigid-kit` will NOT be published to npm. SPEC §6's "publish `rigid-kit` to npm with its own README and typed docs" checklist item is dropped. The package keeps its library-grade constraints — zero runtime dependencies, no DOM/React/Three.js imports, 100% public-API test coverage, its own build to `dist/` — but ships only as a workspace dependency of `apps/playground`.

**Context:** Publishing carries ongoing owner cost (registry account and 2FA, semver discipline, release process, issue/PR triage from third-party consumers, deprecation duty) that the project owner does not want to take on. The library's value here is architectural — an enforced boundary that keeps the math testable in isolation and free of graphics conventions (DECISIONS #002) — and that value is fully realized inside the monorepo. Nothing about the code changes; only distribution does.

**Alternatives:** (a) Publish under a scoped name (`@afonsoeloy/rigid-kit`) — same maintenance burden, merely a different name. (b) Publish once and mark it unmaintained — worse than not publishing: it advertises an API that will not be supported. (c) Delete the package boundary and fold the math into the app — rejected: the boundary is the design (DECISIONS #002), and it is worth keeping regardless of distribution.

**Consequences:** `version` stays at `0.0.0` and `private: true` may be set to make an accidental `npm publish` impossible. No `packages/rigid-kit/README.md` is required (the root README's `rigid-kit` section documents it). SPEC §6 and the README are updated to say the library is not distributed. If publishing is ever reconsidered, this entry is superseded by a new one — the code needs no changes, only a version, a README, and a release process.
