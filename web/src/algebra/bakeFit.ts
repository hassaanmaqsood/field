import { Field, FieldValue, GradResult, GridSpec, Point } from '../protocol/Field';
import { GridField } from '../backends/GridField';
import { ComposedField } from './ComposedField';
import { registerOperator } from './registry';
import { registerSampleImpl } from '../protocol/sampleImpl';

function product(a: number[]): number {
  return a.reduce((p, v) => p * v, 1);
}

function flattenValue(v: FieldValue): number[] {
  if (typeof v === 'number') return [v];
  if (Array.isArray(v[0])) return (v as number[][]).flat();
  return v as number[];
}

/**
 * Bake: sample a (typically continuous) field over a structured grid,
 * producing a GridField. This is a generic operation over any Field via
 * at() alone — it never inspects how the source field computes its values.
 */
export function bake(self: Field, gridSpec: GridSpec): GridField {
  const domain = self.domain();
  const m = self.rankIn();
  if (gridSpec.resolution.length !== m) {
    throw new Error(`bake: resolution length (${gridSpec.resolution.length}) must equal rankIn() (${m})`);
  }
  const valueSize = self.rankOut().length === 0 ? 1 : product(self.rankOut());
  const totalCells = product(gridSpec.resolution);
  const values = new Float64Array(totalCells * valueSize);

  const coords = new Array(m).fill(0);
  const strides = new Array(m).fill(1);
  for (let d = m - 2; d >= 0; d--) strides[d] = strides[d + 1] * gridSpec.resolution[d + 1];

  for (let flat = 0; flat < totalCells; flat++) {
    let rem = flat;
    for (let d = 0; d < m; d++) {
      coords[d] = Math.floor(rem / strides[d]);
      rem %= strides[d];
    }
    const p: Point = coords.map((c, d) => {
      const { min, max } = domain[d];
      const res = gridSpec.resolution[d];
      return res === 1 ? min : min + (c / (res - 1)) * (max - min);
    });
    const v = flattenValue(self.at(p));
    values.set(v, flat * valueSize);
  }

  return new GridField({
    domain,
    resolution: gridSpec.resolution,
    rankOut: self.rankOut(),
    values,
    valueSize,
  });
}

/**
 * Fit: reconstruct a continuous, differentiable field from a discrete one.
 * This milestone: straightforward multilinear interpolation (already what
 * GridField.at() does) paired with GridField's exact analytic derivative of
 * that same interpolant — so callers get real derivatives, not a numerical
 * fallback, from data that originated as discrete samples.
 *
 * (RBF/neural fitting is future backend work — see build prompt.)
 */
export function fit(self: GridField): Field {
  const rankOut = self.rankOut();
  const scalar = rankOut.length === 0;
  return new ComposedField({
    kind: 'op:fit',
    domain: self.domain(),
    rankIn: self.rankIn(),
    rankOut,
    continuity: 'autodiff',
    at: (p) => self.at(p),
    grad: (p): GradResult => {
      const { jacobian } = self.analyticGrad(p);
      if (scalar) return { value: jacobian[0], approximate: false };
      return { value: jacobian, approximate: false };
    },
    children: [self.serialize()],
  });
}

registerOperator('bake', (self) => bake(self, { resolution: self.rankIn() === 4 ? [16, 16, 16, 16] : [32, 32, 32] }));
registerOperator('fit', (self) => fit(self as GridField));
registerSampleImpl((field, gridSpec) => bake(field, gridSpec));
