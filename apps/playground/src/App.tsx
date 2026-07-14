import { IDENTITY_QUATERNION, quaternionToMatrix } from 'rigid-kit';

/**
 * Placeholder shell — proves the rigid-kit ↔ app wiring. Real Phase 1 UI
 * (input panels for every representation) lands on top of this.
 */
export function App() {
  const R = quaternionToMatrix(IDENTITY_QUATERNION);
  const rows: Array<[number, number, number]> = [
    [R.m00, R.m01, R.m02],
    [R.m10, R.m11, R.m12],
    [R.m20, R.m21, R.m22],
  ];

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Transforms Playground</h1>
      <p>Identity quaternion → rotation matrix:</p>
      <pre>{rows.map((row) => row.join('  ')).join('\n')}</pre>
    </main>
  );
}
