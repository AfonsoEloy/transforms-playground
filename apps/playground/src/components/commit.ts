/**
 * Shared write-side helper for the input panels.
 *
 * Panels render from `deriveViews`, which shows the passive (inverse) rotation
 * when `passive` is set. So when a panel converts an edit back to a quaternion,
 * that quaternion is in the *shown* convention. To store it in the hub we undo
 * the passive inversion — the conjugate maps shown → stored, symmetrically with
 * how deriveViews maps stored → shown.
 */

import { conjugate, type Quaternion } from 'rigid-kit';
import type { Action } from '../state/app-state.js';
import type { Dispatch } from 'react';

/** Commit a quaternion expressed in the currently-shown convention to the hub. */
export function commitShown(dispatch: Dispatch<Action>, passive: boolean, shown: Quaternion): void {
  dispatch({ type: 'setRotation', rotation: passive ? conjugate(shown) : shown });
}
