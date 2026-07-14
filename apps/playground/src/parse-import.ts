/**
 * Paste-parsing / import (SPEC §4 Phase 4). Auto-detects and parses the common
 * ways a rigid transform shows up in a terminal or a notebook, returning a
 * rigid-kit `Transform` (rotation + translation) plus what it detected:
 *
 *  - ROS `tf2_echo` / `tf_echo` output — a `Translation:` line and a
 *    `Rotation: in Quaternion [...]` line. The ROS quaternion is ALWAYS scalar-
 *    last (x, y, z, w) regardless of the app's display order — that is the ROS
 *    convention, and mis-ordering it is exactly the bug this tool fights.
 *  - A NumPy / Python matrix print: 3×3 (rotation only), 4×4 or 3×4 homogeneous
 *    (rotation + translation). Whitespace- OR comma-separated; `np.array(...)`
 *    wrappers are ignored (only brackets and numbers are read).
 *  - A bare flat list of 4 numbers — a quaternion, read in the CURRENT display
 *    order (`quatOrder`), because a raw list carries no order of its own.
 *
 * Convention note: nothing here normalizes or orthonormalizes (CLAUDE.md rule 3).
 * A pasted non-unit quaternion or slightly non-orthonormal matrix loads as-is and
 * the panels surface the usual Normalize / Orthonormalize affordances. The
 * imported transform is treated as the ACTIVE transform (it becomes the selected
 * element's transform directly); the passive display toggle does not re-interpret
 * imported data.
 */

import type { QuatOrder } from './state/app-state.js';
import type { Transform } from 'rigid-kit';
import { matrixToQuaternion, quat, rotMat3, transform, vec3 } from 'rigid-kit';

/** What the parser recognized the pasted text as. */
export type DetectedFormat = 'ros-tf' | 'matrix-3x3' | 'matrix-4x4' | 'matrix-3x4' | 'quaternion';

/** Result of an import attempt: a transform + how it was read, or a message. */
export type ImportResult =
  | {
      readonly ok: true;
      readonly transform: Transform;
      readonly detected: DetectedFormat;
      /** Human-readable note (e.g. rotation-only, assumed quaternion order). */
      readonly note?: string;
    }
  | { readonly ok: false; readonly error: string };

/** A signed decimal, optionally with a trailing dot (`1.`) or exponent (`1e-3`). */
const NUMBER_RE = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
/** Tokenizer alphabet: a bracket, or a number. Everything else is a separator. */
const TOKEN_RE = /\[|\]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

/** Nested numeric structure: a number, or an array of them, recursively. */
type Nested = number | Nested[];

/** Pull every number out of a string in order (used for the ROS line values). */
function extractNumbers(s: string): number[] {
  return (s.match(NUMBER_RE) ?? []).map(Number);
}

/**
 * Build the nested array structure implied by the brackets, ignoring commas and
 * whitespace so a NumPy print (space-separated) and a Python list (comma-
 * separated) parse identically. Returns null on unbalanced brackets or if no
 * numeric content is present.
 */
function tokenizeNested(text: string): Nested[] | null {
  const tokens = text.match(TOKEN_RE);
  if (!tokens) return null;
  const root: Nested[] = [];
  const stack: Nested[][] = [root];
  let sawNumber = false;
  for (const tok of tokens) {
    if (tok === '[') {
      const arr: Nested[] = [];
      stack[stack.length - 1]!.push(arr);
      stack.push(arr);
    } else if (tok === ']') {
      if (stack.length === 1) return null; // more closes than opens
      stack.pop();
    } else {
      const n = Number(tok);
      if (!Number.isFinite(n)) return null;
      stack[stack.length - 1]!.push(n);
      sawNumber = true;
    }
  }
  if (stack.length !== 1) return null; // unclosed brackets
  return sawNumber ? root : null;
}

/** A rotation matrix from 9 row-major values → a quaternion via rigid-kit. */
function rotationFromRows(rows: readonly (readonly number[])[]): Transform['rotation'] {
  const [r0, r1, r2] = rows as readonly number[][];
  const m = rotMat3(
    r0![0]!,
    r0![1]!,
    r0![2]!,
    r1![0]!,
    r1![1]!,
    r1![2]!,
    r2![0]!,
    r2![1]!,
    r2![2]!,
  );
  return matrixToQuaternion(m);
}

/** Interpret a ROS `tf`/`tf2` echo paste. Assumes scalar-last (x,y,z,w) quat. */
function parseRos(text: string): ImportResult {
  const quatMatch = /Quaternion[^[]*\[([^\]]*)\]/i.exec(text);
  if (!quatMatch) {
    return { ok: false, error: 'Looks like ROS output but no Quaternion line was found.' };
  }
  const q = extractNumbers(quatMatch[1]!);
  if (q.length !== 4) {
    return { ok: false, error: `Expected 4 quaternion values (x,y,z,w), found ${q.length}.` };
  }
  const [qx, qy, qz, qw] = q as [number, number, number, number];

  const transMatch = /Translation:\s*\[([^\]]*)\]/i.exec(text);
  const t = transMatch ? extractNumbers(transMatch[1]!) : [];
  const [tx = 0, ty = 0, tz = 0] = t;

  return {
    ok: true,
    detected: 'ros-tf',
    transform: transform(quat(qw, qx, qy, qz), vec3(tx, ty, tz)),
    note: transMatch ? 'quaternion read as x,y,z,w (ROS)' : 'no translation line; using 0,0,0',
  };
}

/** Interpret parsed nested numbers as a matrix or a bare quaternion list. */
function parseNested(root: Nested[], quatOrder: QuatOrder): ImportResult {
  // Unwrap a single outer bracket: `[[...],[...]]` → the list of rows.
  const top = root.length === 1 && Array.isArray(root[0]) ? (root[0] as Nested[]) : root;

  const allNumbers = top.every((e) => typeof e === 'number');
  if (allNumbers) {
    const nums = top as number[];
    if (nums.length === 4) {
      const [a, b, c, d] = nums as [number, number, number, number];
      const rotation = quatOrder === 'wxyz' ? quat(a, b, c, d) : quat(d, a, b, c);
      return {
        ok: true,
        detected: 'quaternion',
        transform: transform(rotation, vec3(0, 0, 0)),
        note: `read as a quaternion in ${quatOrder} order`,
      };
    }
    return {
      ok: false,
      error: `A flat list of ${nums.length} numbers is ambiguous. Paste a 4-value quaternion, a 3×3/4×4 matrix, or ROS tf output.`,
    };
  }

  // Otherwise a matrix: every row must be a same-length numeric array.
  if (!top.every((r) => Array.isArray(r) && r.every((v) => typeof v === 'number'))) {
    return { ok: false, error: 'Could not parse a matrix: rows are not uniform numeric lists.' };
  }
  const rows = top as number[][];
  const cols = rows[0]!.length;
  if (!rows.every((r) => r.length === cols)) {
    return { ok: false, error: 'Matrix rows have differing lengths.' };
  }

  try {
    if (rows.length === 3 && cols === 3) {
      return {
        ok: true,
        detected: 'matrix-3x3',
        transform: transform(rotationFromRows(rows), vec3(0, 0, 0)),
        note: 'rotation only (no translation)',
      };
    }
    if (rows.length === 3 && cols === 4) {
      const t = vec3(rows[0]![3]!, rows[1]![3]!, rows[2]![3]!);
      return {
        ok: true,
        detected: 'matrix-3x4',
        transform: transform(rotationFromRows(rows), t),
      };
    }
    if (rows.length === 4 && cols === 4) {
      const t = vec3(rows[0]![3]!, rows[1]![3]!, rows[2]![3]!);
      return {
        ok: true,
        detected: 'matrix-4x4',
        transform: transform(rotationFromRows(rows), t),
      };
    }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Matrix → quaternion failed: ${err.message}`
          : 'Matrix → quaternion failed.',
    };
  }

  return {
    ok: false,
    error: `Unsupported matrix shape ${rows.length}×${cols}. Expected 3×3, 3×4, or 4×4.`,
  };
}

/**
 * Auto-detect and parse a pasted rotation/transform. `quatOrder` only affects a
 * bare 4-number list (which has no order of its own); ROS and matrix inputs carry
 * their own unambiguous conventions.
 */
export function parseImport(text: string, quatOrder: QuatOrder): ImportResult {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false, error: 'Nothing to import.' };

  // ROS tf/tf2 echo has unmistakable line markers; check it first.
  if (/translation:/i.test(trimmed) || /in\s+quaternion/i.test(trimmed)) {
    return parseRos(trimmed);
  }

  const nested = tokenizeNested(trimmed);
  if (!nested) {
    return { ok: false, error: 'Could not find a matrix, quaternion, or ROS transform to import.' };
  }
  return parseNested(nested, quatOrder);
}
