/**
 * The 3D visualization (SPEC §4 Phase 2): a Z-up world with a static reference
 * triad and a live rotated triad, the rotation axis, and a probe vector plus
 * where the rotation sends it. Orbit camera, subtle ground grid. Everything
 * updates the same frame the inputs change (SPEC §1 "instant feedback").
 *
 * Lifecycle discipline (CLAUDE.md): the renderer, scene, camera, controls and
 * all markers are created exactly ONCE on mount and then MUTATED. The render
 * loop reads the latest inputs from a ref and re-points/re-scales the existing
 * objects each frame — no geometry is rebuilt on input changes, and there is no
 * effect-dependency churn. All Three.js↔rigid-kit conversion goes through
 * `adapters/`, and the Z-up correction lives solely in `createWorldRoot`.
 *
 * Sweep (0→1) animates the shown rotation from identity to the target via slerp;
 * it affects only this view (it is ephemeral, not part of the shareable state).
 */

import { useEffect, useRef } from 'react';
import {
  Color,
  GridHelper,
  PerspectiveCamera,
  Quaternion as ThreeQuaternion,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Quaternion, Transform, Vec3 } from 'rigid-kit';
import { applyToThreeQuaternion, applyToThreeVec3 } from '../adapters/quaternion.js';
import { createWorldRoot } from '../adapters/scene-frame.js';
import { buildTriad } from '../adapters/triad.js';
import { buildArrow, MARKER_COLORS } from '../adapters/markers.js';

/** The live inputs the render loop reads each frame (mutated in place, no re-subscribe). */
interface ViewInputs {
  rotation: Quaternion;
  translation: Vec3;
  probe: Vec3;
  axis: Vec3;
  angle: number;
  showAxis: boolean;
  sweep: number;
  frames: readonly Transform[];
  showIntermediates: boolean;
}

const BACKGROUND_LIGHT = new Color('#f4f5f7');
const BACKGROUND_DARK = new Color('#141517');
const GRID_LINE = new Color('#c8ccd2');
const GRID_LINE_DARK = new Color('#2a2d31');

/** Below this rotation angle (rad) the axis is undefined, so hide the axis arrow. */
const AXIS_MIN_ANGLE = 1e-6;

// Element lengths (world units). The X/Y/Z labels sit at LABEL_DISTANCE, which is
// kept beyond EVERY arrow below so a label never lands inside an arrow that lines
// up with a world axis (labels are depth-test-free and would show through it).
const REFERENCE_LEN = 1.0;
const ROTATED_LEN = 1.2;
const PROBE_LEN = 1.2;
const AXIS_LEN = 1.25;
const LABEL_DISTANCE = 1.45;

// Intermediate chain frames (SPEC §4 Phase 3): a fixed pool of dim triads shown/
// hidden and re-posed per frame, so the scene never rebuilds geometry as the
// chain length changes. Longer chains beyond the pool simply aren't drawn.
const INTERMEDIATE_LEN = 0.8;
const INTERMEDIATE_OPACITY = 0.5;
const MAX_INTERMEDIATE_FRAMES = 16;

function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export interface ViewportProps {
  /** The composed rotation to visualize (passive-adjusted, unit quaternion). */
  readonly rotation: Quaternion;
  /** The composed translation — where the rotated frame sits (SPEC §4 Phase 3). */
  readonly translation: Vec3;
  /** Unit probe direction (views.probeUnit). */
  readonly probe: Vec3;
  /** Rotation axis (views.composed.axisAngle.axis) — meaningful only when `angle` > 0. */
  readonly axis: Vec3;
  /** Rotation angle in radians (views.composed.axisAngle.angle). */
  readonly angle: number;
  /** Whether to draw the rotation-axis arrow. */
  readonly showAxis: boolean;
  /** Animation scrub in [0,1]: 0 = identity, 1 = the full composed transform. */
  readonly sweep: number;
  /** Cumulative intermediate chain frames (views.frames). */
  readonly frames: readonly Transform[];
  /** Whether to draw the intermediate frames. */
  readonly showIntermediates: boolean;
}

export function Viewport(props: ViewportProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Latest inputs for the render loop; updated every render, read every frame.
  const inputsRef = useRef<ViewInputs>({
    rotation: props.rotation,
    translation: props.translation,
    probe: props.probe,
    axis: props.axis,
    angle: props.angle,
    showAxis: props.showAxis,
    sweep: props.sweep,
    frames: props.frames,
    showIntermediates: props.showIntermediates,
  });
  inputsRef.current = {
    rotation: props.rotation,
    translation: props.translation,
    probe: props.probe,
    axis: props.axis,
    angle: props.angle,
    showAxis: props.showAxis,
    sweep: props.sweep,
    frames: props.frames,
    showIntermediates: props.showIntermediates,
  };

  // Build the scene once on mount; tear it down fully on unmount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      // No WebGL (headless/unsupported): leave the placeholder text in place.
      return;
    }

    const dark = prefersDark();
    const width = container.clientWidth || 640;
    const height = container.clientHeight || 420;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const scene = new Scene();
    scene.background = dark ? BACKGROUND_DARK : BACKGROUND_LIGHT;

    const camera = new PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(2.6, 2.0, 2.6);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);

    // World root carries the single Z-up correction (DECISIONS #007). Everything
    // below is authored in our right-handed Z-up coordinates.
    const worldRoot = createWorldRoot();
    scene.add(worldRoot);

    // Ground grid in our world XY plane (Z = 0). GridHelper is authored in its
    // local XZ plane, so tilt it into XY.
    const gridColor = dark ? GRID_LINE_DARK : GRID_LINE;
    const grid = new GridHelper(6, 12, gridColor, gridColor);
    grid.rotation.x = Math.PI / 2;
    worldRoot.add(grid);

    // Static reference frame (dim, labelled) and the live rotated frame (vivid).
    const referenceFrame = buildTriad({
      length: REFERENCE_LEN,
      opacity: 0.35,
      labels: true,
      labelDistance: LABEL_DISTANCE,
    });
    worldRoot.add(referenceFrame);

    const rotatedFrame = buildTriad({ length: ROTATED_LEN, opacity: 1.0, labels: false });
    worldRoot.add(rotatedFrame);

    // Pool of dim triads for the intermediate chain frames (shown on demand).
    const intermediateFrames = Array.from({ length: MAX_INTERMEDIATE_FRAMES }, () => {
      const triad = buildTriad({
        length: INTERMEDIATE_LEN,
        opacity: INTERMEDIATE_OPACITY,
        labels: false,
      });
      triad.visible = false;
      worldRoot.add(triad);
      return triad;
    });

    // Markers: probe direction, where it maps to, and the rotation axis.
    const probeArrow = buildArrow(MARKER_COLORS.probe, PROBE_LEN);
    const mappedArrow = buildArrow(MARKER_COLORS.mapped, PROBE_LEN, 0.85);
    const axisArrow = buildArrow(MARKER_COLORS.axis, AXIS_LEN, 0.9);
    worldRoot.add(probeArrow, mappedArrow, axisArrow);

    // Reusable scratch objects so the frame loop allocates nothing.
    const identityQuat = new ThreeQuaternion();
    const targetQuat = new ThreeQuaternion();
    const scratch = new Vector3();

    function applyInputs(): void {
      const v = inputsRef.current;
      // Shown transform = sweep from identity to the composed target: slerp the
      // rotation, lerp the translation from the origin (sweep = 1 is the full result).
      applyToThreeQuaternion(v.rotation, targetQuat);
      rotatedFrame.quaternion.slerpQuaternions(identityQuat, targetQuat, v.sweep);
      applyToThreeVec3(v.translation, rotatedFrame.position).multiplyScalar(v.sweep);

      // Probe arrow points along the (unit) probe direction.
      probeArrow.setDirection(applyToThreeVec3(v.probe, scratch).normalize());
      // Mapped arrow: the probe carried by the currently-shown (swept) rotation.
      applyToThreeVec3(v.probe, scratch).applyQuaternion(rotatedFrame.quaternion);
      mappedArrow.setDirection(scratch.normalize());

      // Axis arrow: only meaningful when there is a rotation.
      if (v.showAxis && v.angle > AXIS_MIN_ANGLE) {
        axisArrow.visible = true;
        axisArrow.setDirection(applyToThreeVec3(v.axis, scratch).normalize());
      } else {
        axisArrow.visible = false;
      }

      // Intermediate chain frames: draw one triad per cumulative frame, posed at
      // its transform. Hidden when the toggle is off or past the pool size.
      for (let i = 0; i < intermediateFrames.length; i++) {
        const triad = intermediateFrames[i]!;
        const frame = v.showIntermediates ? v.frames[i] : undefined;
        if (frame) {
          triad.visible = true;
          applyToThreeVec3(frame.translation, triad.position);
          applyToThreeQuaternion(frame.rotation, triad.quaternion);
        } else {
          triad.visible = false;
        }
      }
    }

    renderer.setAnimationLoop(() => {
      applyInputs();
      controls.update();
      renderer.render(scene, camera);
    });

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      // Dispose all geometries/materials to release GPU resources.
      scene.traverse((obj) => {
        const asMesh = obj as { geometry?: { dispose(): void }; material?: unknown };
        asMesh.geometry?.dispose();
        const mat = asMesh.material;
        if (Array.isArray(mat)) {
          for (const m of mat) (m as { dispose?: () => void }).dispose?.();
        } else {
          (mat as { dispose?: () => void } | undefined)?.dispose?.();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className="viewport" ref={containerRef} role="img" aria-label="3D view of the rotation">
      <span className="viewport-fallback">Initializing 3D view…</span>
    </div>
  );
}
