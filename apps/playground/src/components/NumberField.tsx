/**
 * Controlled numeric input with a local text draft, so partial entries ("-",
 * "1.", "0.00") don't get clobbered mid-type and every valid keystroke commits
 * live (SPEC §3: no "Convert" button). When not being edited the field shows the
 * canonical `value` formatted to the active precision; the moment focus leaves,
 * the draft is dropped so the field snaps back to the derived value.
 *
 * Arrow-key nudging (SPEC §4 Phase 4): ArrowUp/ArrowDown add/subtract one `step`;
 * Shift makes it coarse (×10), Alt fine (×0.1). The nudge commits and clears the
 * draft so the field re-derives from the new canonical value.
 */

import { useState, type KeyboardEvent } from 'react';
import { formatNumber } from '../format.js';
import { computeNudge } from '../nudge.js';

interface NumberFieldProps {
  /** Canonical value to display (already in display units). */
  readonly value: number;
  readonly precision: number;
  /** Called with the parsed number on every valid keystroke. */
  readonly onCommit: (next: number) => void;
  readonly ariaLabel: string;
  readonly widthCh?: number;
  /** Base arrow-key nudge increment (display units). Shift ×10, Alt ×0.1. */
  readonly step?: number;
}

export function NumberField({
  value,
  precision,
  onCommit,
  ariaLabel,
  widthCh = 9,
  step = 1,
}: NumberFieldProps) {
  // null ⇒ not editing: show the formatted canonical value.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? formatNumber(value, precision);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    const direction = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
    if (direction === 0) return;
    e.preventDefault(); // don't move the caret or scroll the page
    // Nudge from the in-progress draft if it parses, else the canonical value.
    const parsedDraft = draft === null ? NaN : Number(draft);
    const base = Number.isFinite(parsedDraft) ? parsedDraft : value;
    setDraft(null);
    onCommit(computeNudge(base, step, direction, { shift: e.shiftKey, alt: e.altKey }));
  }

  return (
    <input
      className="num-field"
      aria-label={ariaLabel}
      title="↑/↓ to nudge · Shift = ×10 · Alt = ÷10"
      inputMode="decimal"
      style={{ width: `${widthCh}ch` }}
      value={shown}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        const n = Number(text);
        if (text.trim() !== '' && Number.isFinite(n)) onCommit(n);
      }}
      onKeyDown={onKeyDown}
      onBlur={() => setDraft(null)}
    />
  );
}
