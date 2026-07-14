/**
 * The 3D visualization (SPEC §4 Phase 2): a Z-up world with a static reference
 * triad and a live rotated triad, orbit camera, and a subtle ground grid. The
 * rotated triad reflects the current rotation and updates the same frame the
 * inputs change (SPEC §1 "instant feedback").
 *
 * Lifecycle discipline (CLAUDE.md): the renderer, scene, camera, controls and
 * both triads are created exactly ONCE when the component mounts and then
 * mutated — the per-rotation effect only writes the rotated group's quaternion,
 * it never rebuilds geometry. All Three.js↔rigid-kit conversion goes through
 * `adapters/`, and the Z-up correction lives solely in `createWorldRoot`.
 */

import { useEffect, useRef } from 'react';
import { Color, GridHelper, PerspectiveCamera, Scene, WebGLRenderer, type Group } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Quaternion } from 'rigid-kit';
import { applyToThreeQuaternion } from '../adapters/quaternion.js';
import { createWorldRoot } from '../adapters/scene-frame.js';
import { buildTriad } from '../adapters/triad.js';

/** Handles retained across renders so effects mutate the scene instead of rebuilding it. */
interface SceneHandles {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly rotatedFrame: Group;
  readonly resizeObserver: ResizeObserver;
}

const BACKGROUND_LIGHT = new Color('#f4f5f7');
const BACKGROUND_DARK = new Color('#141517');
const GRID_LINE = new Color('#c8ccd2');
const GRID_LINE_DARK = new Color('#2a2d31');

function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export interface ViewportProps {
  /** The rotation to visualize (the passive-adjusted, unit quaternion the panels show). */
  readonly rotation: Quaternion;
}

export function Viewport({ rotation }: ViewportProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handlesRef = useRef<SceneHandles | null>(null);

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
    const grid = new GridHelper(
      6,
      12,
      dark ? GRID_LINE_DARK : GRID_LINE,
      dark ? GRID_LINE_DARK : GRID_LINE,
    );
    grid.rotation.x = Math.PI / 2;
    worldRoot.add(grid);

    // Static reference frame (dim, labelled) and the live rotated frame (vivid).
    const referenceFrame = buildTriad({ length: 1.0, opacity: 0.35, labels: true });
    worldRoot.add(referenceFrame);

    const rotatedFrame = buildTriad({ length: 1.2, opacity: 1.0, labels: false });
    worldRoot.add(rotatedFrame);

    renderer.setAnimationLoop(() => {
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

    handlesRef.current = { renderer, scene, camera, controls, rotatedFrame, resizeObserver };

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
      handlesRef.current = null;
    };
  }, []);

  // Reflect the current rotation onto the rotated frame — the only per-update work.
  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles) return;
    applyToThreeQuaternion(rotation, handles.rotatedFrame.quaternion);
  }, [rotation]);

  return (
    <div className="viewport" ref={containerRef} role="img" aria-label="3D view of the rotation">
      <span className="viewport-fallback">Initializing 3D view…</span>
    </div>
  );
}
