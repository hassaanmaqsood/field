import { AnalyticField } from '../backends/AnalyticField';
import { Bounds, FieldValue, Point } from '../protocol/Field';
import { loadSyntheticDatasetExample } from './syntheticDataset';

const BOX3: Bounds[] = [
  { min: -4, max: 4 },
  { min: -4, max: 4 },
  { min: -4, max: 4 },
];

/** Radial signed-distance-like scalar field: |p| - r0 */
export function radialPreset(r0 = 1.5): AnalyticField {
  return new AnalyticField({
    name: 'radial',
    domain: BOX3,
    rankIn: 3,
    rankOut: [],
    params: { r0 },
    fn: (p) => Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]) - r0,
  });
}

/** Vortex vector field around the z-axis. */
export function vortexPreset(strength = 1): AnalyticField {
  return new AnalyticField({
    name: 'vortex',
    domain: BOX3,
    rankIn: 3,
    rankOut: [3],
    params: { strength },
    fn: (p): FieldValue => {
      const [x, y, z] = p;
      return [-y * strength, x * strength, 0.15 * Math.sin(z)];
    },
  });
}

/** Two-source dipole-style vector field. */
export function dipolePreset(separation = 2): AnalyticField {
  return new AnalyticField({
    name: 'dipole',
    domain: BOX3,
    rankIn: 3,
    rankOut: [3],
    params: { separation },
    fn: (p): FieldValue => {
      const src = (cx: number): number[] => {
        const dx = p[0] - cx, dy = p[1], dz = p[2];
        const r2 = dx * dx + dy * dy + dz * dz + 0.05;
        const r3 = Math.pow(r2, 1.5);
        return [dx / r3, dy / r3, dz / r3];
      };
      const a = src(-separation / 2);
      const b = src(separation / 2).map((v) => -v);
      return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    },
  });
}

/** Saddle scalar field: x^2 - y^2 + 0.2 z^2 */
export function saddlePreset(): AnalyticField {
  return new AnalyticField({
    name: 'saddle',
    domain: BOX3,
    rankIn: 3,
    rankOut: [],
    fn: (p) => p[0] * p[0] - p[1] * p[1] + 0.2 * p[2] * p[2],
  });
}

/**
 * rotor4d: a scalar field over a 4D domain (space + an extra parameter axis
 * w) — the standing example for domain rank > 3, sliced down via §3's
 * slicing operator for rendering.
 */
export function rotor4dPreset(): AnalyticField {
  const domain: Bounds[] = [...BOX3, { min: -Math.PI, max: Math.PI }];
  return new AnalyticField({
    name: 'rotor4d',
    domain,
    rankIn: 4,
    rankOut: [],
    fn: (p) => {
      const [x, y, z, w] = p;
      const xr = x * Math.cos(w) - y * Math.sin(w);
      const yr = x * Math.sin(w) + y * Math.cos(w);
      return Math.sqrt(xr * xr + yr * yr + z * z) - 1.5 - 0.4 * Math.cos(2 * w);
    },
  });
}

/** A rank-2 (3x3) synthetic stress tensor field, for the tensor-glyph render path
 * and the von Mises discipline-plugin example. */
export function stressTensorPreset(): AnalyticField {
  return new AnalyticField({
    name: 'stressTensor',
    domain: BOX3,
    rankIn: 3,
    rankOut: [3, 3],
    fn: (p): FieldValue => {
      const [x, y, z] = p;
      const sxx = 2 + x * 0.3;
      const syy = 1 - y * 0.2;
      const szz = 0.5 + z * 0.1;
      const sxy = 0.6 * Math.sin(x * y * 0.2);
      const sxz = 0.3 * Math.cos(z * 0.5);
      const syz = 0.2 * Math.sin(y - z);
      return [
        [sxx, sxy, sxz],
        [sxy, syy, syz],
        [sxz, syz, szz],
      ];
    },
  });
}

export type PresetFactory = () => AnalyticField;

export const presetRegistry: Record<string, PresetFactory> = {
  radial: () => radialPreset(),
  vortex: () => vortexPreset(),
  dipole: () => dipolePreset(),
  saddle: () => saddlePreset(),
  rotor4d: () => rotor4dPreset(),
  stressTensor: () => stressTensorPreset(),
};

// Note: the synthetic imported dataset is a discrete GridField, not an
// AnalyticField, so it's kept out of presetRegistry's type and exposed
// separately (see main.ts "Load synthetic dataset" wiring).
export { loadSyntheticDatasetExample };

const ALLOWED_TOKEN = /^[0-9a-zA-Z_+\-*/%.,() \t]*$/;
const SAFE_NAMES = ['sin', 'cos', 'tan', 'sqrt', 'abs', 'pow', 'exp', 'log', 'min', 'max', 'PI'];

/**
 * Arbitrary user-defined scalar formula over x,y,z(,w). Restricted to
 * arithmetic + a Math allow-list — no identifiers besides x/y/z/w and the
 * allow-listed Math members are reachable.
 */
export function userFormulaPreset(expression: string, rankIn: 3 | 4 = 3): AnalyticField {
  if (!ALLOWED_TOKEN.test(expression)) {
    throw new Error('Formula contains disallowed characters. Use only numbers, x, y, z, w, + - * / % ( ) and Math names.');
  }
  const vars = rankIn === 4 ? ['x', 'y', 'z', 'w'] : ['x', 'y', 'z'];
  const mathArgs = SAFE_NAMES;
  const mathVals = SAFE_NAMES.map((n) => (Math as any)[n]);
  // eslint-disable-next-line no-new-func
  const compiled = new Function(...vars, ...mathArgs, `"use strict"; return (${expression});`);
  const domain = rankIn === 4
    ? [...BOX3, { min: -Math.PI, max: Math.PI }]
    : BOX3;
  return new AnalyticField({
    name: 'userFormula',
    domain,
    rankIn,
    rankOut: [],
    params: {},
    formula: expression,
    fn: (p: Point) => compiled(...p, ...mathVals) as number,
  });
}
