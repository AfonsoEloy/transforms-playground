# Transforms Playground

**Paste or type any 3D rotation, see it in 3D instantly, convert it to every other
representation, and compose frames — with every convention explicit and switchable.**

Most rotation bugs are *convention* bugs: `wxyz` vs `xyzw`, intrinsic vs extrinsic
Euler, active vs passive, degrees vs radians, Y-up vs Z-up. This tool makes every one
of those choices visible and toggleable, so you can debug the mismatch instead of
guessing at it.

> **Live demo:** _coming soon_ &nbsp;·&nbsp; Fully static, client-side, no login, no backend.

<!-- TODO(launch): replace with an animated GIF of the tool in use (SPEC §6). -->
<!-- ![Transforms Playground](docs/demo.gif) -->

---

## Features

- **Five interconvertible representations** — quaternion, 3×3 rotation matrix, Euler
  angles (all 12 sequences, intrinsic *and* extrinsic), axis–angle, and rotation
  vector. Edit any one; the rest update live (no "Convert" button).
- **3D visualization** — a Z-up world triad + the rotated frame, orbit camera, the
  rotation axis, an identity→target animated sweep, and a unit **probe** vector that
  shows where your rotation sends a direction. Axis colors follow RGB = XYZ.
- **Composition chain** — an ordered list of full 4×4 rigid transforms
  (`T₁ · T₂ · …`), each editable in any representation, reorderable, toggleable, and
  invertible. The live composed result drives the 3D view; intermediate frames are
  drawable.
- **Numerical honesty** — user-selectable precision, non-unit-quaternion and
  non-orthonormal-matrix warnings with one-click `Normalize` / `Orthonormalize (SVD)`,
  and a gimbal-lock proximity indicator. Nothing is silently "fixed".
- **Paste / import** — auto-detects and imports raw ROS `tf2_echo` / `tf_echo`
  output, NumPy/Python matrix prints (3×3, 4×4, 3×4), and quaternion lists.
- **Code export** — the composed transform as ready-to-run NumPy, SciPy `Rotation`,
  Eigen `Affine3d`, or a ROS 2 `static_transform_publisher` command — each in the
  target library's own quaternion order.
- **Keyboard-friendly** — arrow-key value nudging (`Shift` = ×10, `Alt` = ÷10).
- **Shareable** — the entire app state (chain, conventions, view settings) lives in
  the URL hash. Copy the link, share the exact state.

## Conventions (the product)

Internally the math follows one fixed standard; the UI lets you *display* things any
way you like. These internal standards are authoritative (see [`SPEC.md`](SPEC.md) §2):

| Concern | Internal standard | UI toggle |
|---|---|---|
| Quaternion storage | Named fields `{w, x, y, z}`, never index access | Display order `w,x,y,z` ↔ `x,y,z,w` |
| Quaternion sign | Canonicalized to `w ≥ 0` on output | Note shown when canonicalizing |
| Angles | Radians internally | Degrees / radians (default degrees) |
| Euler | All 12 sequences, intrinsic & extrinsic | Sequence + frame dropdown (default intrinsic ZYX) |
| Rotation semantics | Active, right-handed, column vectors, `v' = R v` | Passive toggle (transposes display only) |
| Homogeneous transforms | 4×4, rotation top-left, translation last column | — |
| World view | Z-up (robotics), one fixed corrective rotation in an adapter | — |

## Architecture

An npm-workspaces monorepo with a hard boundary between pure math and the app:

```
packages/rigid-kit   Pure TypeScript rotation & transform math.
                     Zero runtime dependencies. No DOM, React, or Three.js. Publishable.
apps/playground      Vite + React + Three.js static site. Depends on rigid-kit.
                     All Three.js ↔ rigid-kit adapters live in src/adapters/.
```

- All UI state is a single serializable object reduced with `useReducer`; the URL
  hash is the source of truth for shareable state (no router, no state library).
- `rigid-kit` uses branded/nominal types so a `Vec3` can't be passed where a
  `Quaternion` is expected — the exact class of bug this project exists to fight.

See [`DECISIONS.md`](DECISIONS.md) for the architectural decision log and
[`CLAUDE.md`](CLAUDE.md) for contributor conventions.

## Getting started

All tooling runs inside Docker (Node is pinned in the image); the host only needs
Docker + Docker Compose.

```bash
docker compose run --rm app npm install     # install all workspaces (first run)
docker compose up dev                        # dev server → http://localhost:5173
```

### Development commands

```bash
docker compose run --rm app npm run test        # all tests (Vitest)
docker compose run --rm app npm run typecheck    # tsc --noEmit across workspaces
docker compose run --rm app npm run lint         # eslint + prettier check
docker compose run --rm app npm run build        # build rigid-kit, then the app
```

> Tip: don't run `build`/`test` while `docker compose up dev` is running — they share
> the `node_modules` / `dist` volumes and the dev container can exit. Restart it with
> `docker compose up dev` afterward.

## `rigid-kit`

The math library stands alone: five representations interconverting through a
canonical quaternion hub, SE(3) rigid transforms, explicit validation
(`isUnit`, `orthonormalityError`, `gimbalProximity`) and explicit repair
(`normalize`, `orthonormalize`) — never silent. Correctness is enforced with
known-answer tests plus `fast-check` property tests (round-trips to < 1e-12,
composition associativity, inverse and norm-preservation properties).

```ts
import { quat, eulerToQuaternion, quaternionToMatrix, composeChain } from 'rigid-kit';
```

## Quality bar

- `rigid-kit`: 100% of the public API covered by tests, zero runtime dependencies.
- Works on mobile (single-column; 3D view above the inputs) and honors
  `prefers-color-scheme` for dark mode.

## License

MIT.
