/**
 * Code-snippet export of the composed chain result (SPEC §4 Phase 4). Shows the
 * composed 4×4 transform as ready-to-run NumPy / SciPy / Eigen / ROS 2 code with
 * a format picker, a preview, and a Copy button. Read-only — it reflects the live
 * composed result, so it needs no dispatch.
 */

import { useState } from 'react';
import type { DerivedViews } from '../derive.js';
import type { AppState } from '../state/app-state.js';
import { chainExportFormats } from '../export-chain.js';

interface Props {
  readonly state: AppState;
  readonly views: DerivedViews;
}

export function ChainExport({ state, views }: Props) {
  const c = views.composed;
  const formats = chainExportFormats(c.quaternion, c.translation, c.matrix, state.precision);
  const [formatId, setFormatId] = useState<string>(formats[0]!.id);
  const [copied, setCopied] = useState(false);

  const active = formats.find((f) => f.id === formatId) ?? formats[0]!;

  async function copy(): Promise<void> {
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
        <h2>Export chain as code</h2>
        <div className="copy-controls">
          <select
            className="copy-format"
            aria-label="export format"
            value={active.id}
            onChange={(e) => setFormatId(e.target.value)}
          >
            {formats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <button type="button" className="copy-btn" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </header>
      <div className="panel-body">
        <pre className="export-code" aria-label={`${active.label} export`}>
          {active.text}
        </pre>
      </div>
    </section>
  );
}
