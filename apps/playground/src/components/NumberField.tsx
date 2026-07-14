/**
 * Controlled numeric input with a local text draft, so partial entries ("-",
 * "1.", "0.00") don't get clobbered mid-type and every valid keystroke commits
 * live (SPEC §3: no "Convert" button). When not being edited the field shows the
 * canonical `value` formatted to the active precision; the moment focus leaves,
 * the draft is dropped so the field snaps back to the derived value.
 */

import { useState } from 'react';
import { formatNumber } from '../format.js';

interface NumberFieldProps {
  /** Canonical value to display (already in display units). */
  readonly value: number;
  readonly precision: number;
  /** Called with the parsed number on every valid keystroke. */
  readonly onCommit: (next: number) => void;
  readonly ariaLabel: string;
  readonly widthCh?: number;
}

export function NumberField({
  value,
  precision,
  onCommit,
  ariaLabel,
  widthCh = 9,
}: NumberFieldProps) {
  // null ⇒ not editing: show the formatted canonical value.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? formatNumber(value, precision);

  return (
    <input
      className="num-field"
      aria-label={ariaLabel}
      inputMode="decimal"
      style={{ width: `${widthCh}ch` }}
      value={shown}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        const n = Number(text);
        if (text.trim() !== '' && Number.isFinite(n)) onCommit(n);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
