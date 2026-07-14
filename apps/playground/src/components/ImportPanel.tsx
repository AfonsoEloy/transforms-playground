/**
 * Paste / import panel (SPEC §4 Phase 4). The user pastes raw ROS `tf2_echo` /
 * `tf_echo` output, a NumPy/Python matrix print, or a quaternion list; on Import
 * the parser auto-detects the format and loads it into the selected chain
 * element. Parsing is a deliberate user action (not live-on-keystroke), so the
 * textarea is local state and nothing touches the URL until Import succeeds.
 */

import { useState, type Dispatch } from 'react';
import type { Action, AppState } from '../state/app-state.js';
import { parseImport, type DetectedFormat } from '../parse-import.js';
import { Panel } from './Panel.js';

interface Props {
  readonly state: AppState;
  readonly dispatch: Dispatch<Action>;
}

const FORMAT_LABEL: Record<DetectedFormat, string> = {
  'ros-tf': 'ROS tf/tf2 echo',
  'matrix-3x3': '3×3 rotation matrix',
  'matrix-4x4': '4×4 homogeneous matrix',
  'matrix-3x4': '3×4 matrix',
  quaternion: 'quaternion list',
};

const PLACEHOLDER = `Paste any of:
- Translation: [0.1, 0.2, 0.3]
- Rotation: in Quaternion [0, 0, 0.707, 0.707]

[[1, 0, 0], [0, 0, -1], [0, 1, 0]]

[0.0, 0.0, 0.707, 0.707]`;

type Feedback =
  | { readonly kind: 'ok'; readonly text: string }
  | { readonly kind: 'error'; readonly text: string }
  | null;

export function ImportPanel({ state, dispatch }: Props) {
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);

  function doImport(): void {
    const result = parseImport(text, state.quatOrder);
    if (!result.ok) {
      setFeedback({ kind: 'error', text: result.error });
      return;
    }
    dispatch({ type: 'setSelectedTransform', transform: result.transform });
    const detail = result.note ? ` — ${result.note}` : '';
    setFeedback({ kind: 'ok', text: `Imported ${FORMAT_LABEL[result.detected]}${detail}.` });
  }

  const footer =
    feedback === null ? undefined : (
      <span
        className={feedback.kind === 'error' ? 'import-error' : 'import-ok'}
        role={feedback.kind === 'error' ? 'alert' : 'status'}
      >
        {feedback.text}
      </span>
    );

  return (
    <Panel title="Paste / import" footer={footer}>
      <textarea
        className="import-textarea"
        aria-label="paste a transform to import"
        placeholder={PLACEHOLDER}
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="import-actions">
        <button type="button" onClick={doImport} disabled={text.trim() === ''}>
          Import to selected element
        </button>
        <button
          type="button"
          className="import-clear"
          onClick={() => {
            setText('');
            setFeedback(null);
          }}
        >
          Clear
        </button>
      </div>
    </Panel>
  );
}
