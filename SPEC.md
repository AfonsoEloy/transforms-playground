# SPEC — Transforms Playground

An interactive, browser-based tool for converting, composing, and *visualizing* 3D rotations and rigid transforms. Target users: robotics engineers, graphics programmers, aerospace/GNC engineers, and students debugging convention mismatches.

**One-line pitch:** paste or type any rotation representation, see it in 3D instantly, convert to every other representation, and compose frames — with every convention explicit and switchable.

**Delivery:** fully static site (no backend). All computation client-side.

---

## 1. Core principles

1. **Conventions are the product.** Most rotation bugs are convention bugs. Every convention choice (quaternion ordering, Euler sequence, intrinsic/extrinsic, degrees/radians, active/passive) must be visible in the UI and switchable. Never hide a convention behind a default the user can't see.
2. **Instant feedback.** Every input change updates all representations and the 3D view within the same frame. No "Convert" buttons.
3. **Numerical honesty.** Show enough decimal places (user-selectable precision, default 6). Warn on non-unit quaternions, near-singular Euler configurations (gimbal lock), and non-orthonormal matrices — offer one-click normalization/orthonormalization rather than silently fixing.
4. **Zero friction.** No login, no install, loads in under 2 seconds on a mid-range phone. State fully encoded in the URL so any configuration is shareable as a link.

## 2. Conventions (authoritative)

These are the internal standards. UI display is switchable, but internal code MUST follow these without exception:

| Concern | Internal standard | UI |
|---|---|---|
| Quaternion storage | Named fields `{w, x, y, z}` (scalar-first semantics, but access is by name, never by index) | Display order toggle: `w,x,y,z` (Eigen/ROS msg docs style) vs `x,y,z,w` (ROS TF / Three.js style). Toggle is prominent, not buried. |
| Quaternion sign | Canonicalize to `w >= 0` on output; never silently flip user input | Show a note when canonicalizing |
| Angles | Radians everywhere internally | Degrees/radians toggle, default degrees |
| Euler angles | All 12 sequences supported (XYZ, ZYX, ZXZ, ...), both intrinsic and extrinsic | Sequence dropdown + intrinsic/extrinsic toggle; default: intrinsic ZYX (yaw-pitch-roll), matching common robotics usage |
| Rotation semantics | Active rotations (rotate the vector), right-handed frames, column vectors, matrices premultiply (`v' = R v`) | Active/passive explained in a help tooltip; a passive toggle transposes display only |
| Matrices | Row-major in code arrays, but ALWAYS accessed via named helpers; column-vector math convention | Matrix shown as standard math notation |
| Homogeneous transforms | 4×4, rotation top-left, translation last column | — |
| Units for translation | Unitless (user's choice); meters implied in examples | — |

Any new code that touches rotations must state its convention assumptions in a doc comment.

## 3. Architecture

Two packages in one repo (npm workspaces):

```
/packages/rigid-kit      ← pure TypeScript math library. Zero dependencies. Published to npm.
/apps/playground         ← Vite + React + Three.js site. Depends on rigid-kit.
```

- `rigid-kit` has NO knowledge of Three.js, React, or the DOM. It defines its own `Quaternion`, `RotMat3`, `EulerAngles`, `AxisAngle`, `Transform` types (branded/nominal types so a `Vec3` can't be passed where a `Quaternion` is expected).
- Adapters to/from Three.js objects live in the app, not the library.
- All UI state lives in a single serializable object; the URL hash is the source of truth for shareable state.

## 4. Features by phase

### Phase 1 — Conversion core (MVP)
- Input panels for: quaternion, rotation matrix (3×3), Euler angles (any of 12 sequences, intrinsic/extrinsic), axis-angle, rotation vector (axis*angle).
- Editing any panel updates all others live.
- Copy button per representation, with format options (plain, Python/NumPy literal, C++ Eigen literal, ROS YAML).
- Validation with actionable warnings: non-unit quaternion (show norm + "Normalize" button), non-orthonormal matrix (show error metric + "Orthonormalize (SVD)" button), gimbal-lock proximity indicator for Euler output.
- Precision selector (3–12 significant decimals) and degrees/radians toggle.

**Acceptance:** all pairwise conversions round-trip to within 1e-12 (double precision) for 10,000 random rotations; gimbal-lock cases handled without NaN.

### Phase 2 — 3D visualization
- Three.js scene: world frame triad + a rotated frame triad, orbit camera, subtle grid.
- The rotated frame updates live with the inputs. Optional: show rotation axis as an arrow, show the rotation as an animated sweep (slider from identity to target).
- A unit vector "probe" the user can point (drag or numeric input) to see where the rotation sends it.
- Frame labels and axis colors follow RGB=XYZ convention.

**Acceptance:** 60 fps interaction on a mid-range laptop; visual matches numeric output for a documented test set (e.g. 90° about Z maps X̂ to Ŷ).

### Phase 3 — Composition & shareable state
- A "chain" panel: ordered list of transforms (T1 · T2 · ...), each editable in any representation; live composed result; drag to reorder; toggle each on/off; invert button per element.
- Visualize every intermediate frame in the 3D scene (toggleable).
- Full app state (all inputs, chain, view settings, conventions) serialized into the URL hash; "Share" button copies the link.

**Acceptance:** pasting a shared URL reproduces the exact state; chain of 10 transforms recomputes in < 1 ms.

### Phase 4 — Power features
- Paste-parsing: accept raw output of `ros2 run tf2_ros tf2_echo`, `rosrun tf tf_echo`, a NumPy matrix print, or a Python list — auto-detect and import.
- Export chain as code snippet (NumPy/SciPy `Rotation`, Eigen, ROS TF2 static transform publisher command).
- Keyboard-first workflow: tab order, arrow-key nudging of values with modifier keys for step size.

### Non-goals (v1)
- No IK, no URDF loading, no dynamics (future separate project).
- No user accounts, no saved sessions beyond URL state, no analytics beyond privacy-friendly page counts (e.g. Plausible/GoatCounter, optional).
- No WebGL fallback for pre-2018 browsers.

## 5. Quality bar

- `rigid-kit`: 100% of public API covered by tests, including property-based round-trip tests (see CLAUDE.md). Zero runtime dependencies.
- Lighthouse ≥ 95 performance/accessibility on the deployed site.
- Works on mobile (single-column layout; 3D view above inputs).
- Dark mode via `prefers-color-scheme`.

## 6. Launch checklist

- README with animated GIF of the tool, convention documentation table, and link to live site.
- `rigid-kit` published to npm with its own README and typed docs.
- Deployed to GitHub Pages (or Vercel) with a canonical URL.
- Posts: r/robotics, Show HN, LinkedIn. Each post leads with a concrete pain point ("ever lost an afternoon to wxyz vs xyzw?").
