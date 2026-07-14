/**
 * Binds the single app-state reducer to `location.hash`, making the URL the
 * source of truth for shareable state (DECISIONS #006, CLAUDE.md rule #6).
 *
 * - On mount, hydrate the initial state from the current hash.
 * - After every state change, write the serialized state back to the hash
 *   (via `replaceState`, so we don't spam browser history on each keystroke).
 * - When the hash changes externally (back/forward, pasted link), re-hydrate.
 */

import { useEffect, useReducer, useRef, type Dispatch } from 'react';
import { reducer, type Action, type AppState } from './app-state.js';
import { parseState, serializeState } from './url-hash.js';

/** Read current state from the live location hash (safe outside the browser). */
function readHash(): AppState {
  if (typeof window === 'undefined') return parseState('');
  return parseState(window.location.hash);
}

export function useUrlState(): readonly [AppState, Dispatch<Action>] {
  const [state, dispatch] = useReducer(reducer, undefined, readHash);

  // The hash string we last wrote, so an external-change listener can tell our
  // own writes apart from real navigation and avoid a re-hydrate feedback loop.
  const lastWritten = useRef<string | null>(null);

  useEffect(() => {
    const next = serializeState(state);
    if (next === lastWritten.current) return;
    lastWritten.current = next;
    const url = `${window.location.pathname}${window.location.search}#${next}`;
    window.history.replaceState(null, '', url);
  }, [state]);

  useEffect(() => {
    function onHashChange(): void {
      const current = window.location.hash.replace(/^#/, '');
      if (current === lastWritten.current) return; // our own write echoing back
      dispatch({ type: 'hydrate', state: parseState(current) });
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return [state, dispatch] as const;
}
