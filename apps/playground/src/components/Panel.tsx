/**
 * Card wrapper shared by every representation panel: a title row with an optional
 * format picker + "Copy" button, the panel body, and an optional warning/notes
 * strip. When a panel offers more than one clipboard format (SPEC §4 Phase 1:
 * "Copy button per representation, with format options") a small select appears
 * beside the button; Copy writes the selected format's text.
 */

import { useState, type ReactNode } from 'react';
import type { CopyFormat } from '../copy.js';

interface PanelProps {
  readonly title: string;
  /** Clipboard serializations for this representation; omit to hide the button. */
  readonly copyFormats?: readonly CopyFormat[];
  readonly children: ReactNode;
  /** Warning/notes rendered under the body (e.g. non-unit, gimbal-lock). */
  readonly footer?: ReactNode;
}

export function Panel({ title, copyFormats, children, footer }: PanelProps) {
  const [copied, setCopied] = useState(false);
  const [formatId, setFormatId] = useState<string>('plain');

  const formats = copyFormats ?? [];
  const active = formats.find((f) => f.id === formatId) ?? formats[0];

  async function copy(): Promise<void> {
    if (active === undefined) return;
    try {
      await navigator.clipboard.writeText(active.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard can be blocked (permissions, insecure context); fail quietly.
    }
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>{title}</h2>
        {active !== undefined && (
          <div className="copy-controls">
            {formats.length > 1 && (
              <select
                className="copy-format"
                aria-label={`${title} copy format`}
                value={active.id}
                onChange={(e) => setFormatId(e.target.value)}
              >
                {formats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            )}
            <button type="button" className="copy-btn" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </header>
      <div className="panel-body">{children}</div>
      {footer && <div className="panel-footer">{footer}</div>}
    </section>
  );
}
