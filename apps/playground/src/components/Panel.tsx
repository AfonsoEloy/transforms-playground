/**
 * Card wrapper shared by every representation panel: a title row with an
 * optional "Copy" button, the panel body, and an optional warning/notes strip.
 */

import { useState, type ReactNode } from 'react';

interface PanelProps {
  readonly title: string;
  /** Plain-text serialization used by the Copy button; omit to hide the button. */
  readonly copyText?: string;
  readonly children: ReactNode;
  /** Warning/notes rendered under the body (e.g. non-unit, gimbal-lock). */
  readonly footer?: ReactNode;
}

export function Panel({ title, copyText, children, footer }: PanelProps) {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    if (copyText === undefined) return;
    try {
      await navigator.clipboard.writeText(copyText);
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
        {copyText !== undefined && (
          <button type="button" className="copy-btn" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </header>
      <div className="panel-body">{children}</div>
      {footer && <div className="panel-footer">{footer}</div>}
    </section>
  );
}
