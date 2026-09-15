import { GridField } from '../backends/GridField';

/**
 * Stand-in for "imported dataset" (spec build prompt: "a small synthetic
 * CSV/JSON grid is sufficient — no need to build a full mesh importer yet").
 * The values below are exactly what a parsed CSV/JSON grid export would look
 * like once flattened row-major — this function is the seam where a real
 * file-loader would plug in; everything downstream (GridField, algebra,
 * render) already treats it identically to a baked analytic field.
 */
export function loadSyntheticDatasetExample(): GridField {
  const resolution = [5, 5, 5]; // 5x5x5 structured grid
  const domain = [
    { min: -2, max: 2 },
    { min: -2, max: 2 },
    { min: -2, max: 2 },
  ];
  const values = new Float64Array(5 * 5 * 5);
  let i = 0;
  for (let zi = 0; zi < 5; zi++) {
    const z = -2 + (zi / 4) * 4;
    for (let yi = 0; yi < 5; yi++) {
      const y = -2 + (yi / 4) * 4;
      for (let xi = 0; xi < 5; xi++) {
        const x = -2 + (xi / 4) * 4;
        // pretend this came from a CSV export of a scalar field measurement
        values[i++] = Math.sin(x) * Math.cos(y) + 0.3 * z;
      }
    }
  }
  return new GridField({ domain, resolution, rankOut: [], values, valueSize: 1 });
}
