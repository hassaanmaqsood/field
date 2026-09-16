import { Field, assertScalar, assertVector, asScalar } from '../protocol/Field';
import { ComposedField } from './ComposedField';
import { registerOperator } from './registry';

/**
 * Gradient: scalar field -> vector field.
 * Routed entirely through F.grad(p) — the same contract every backend
 * implements (exact analytic/autodiff, or the BaseField finite-difference
 * fallback). Callers of the resulting field cannot tell which path was
 * used except via continuity() (spec §6.3, §8).
 */
export function gradient(self: Field): Field {
  assertScalar(self, 'op:gradient');
  const m = self.rankIn();
  return new ComposedField({
    kind: 'op:gradient',
    domain: self.domain(),
    rankIn: m,
    rankOut: [m],
    continuity: self.continuity() === 'discrete' ? 'discrete' : 'autodiff',
    at: (p) => self.grad(p).value as number[],
    children: [self.serialize()],
  });
}

/** Divergence: vector field (length m, matching domain rank) -> scalar field. */
export function divergence(self: Field): Field {
  assertVector(self, 'op:divergence', self.rankIn());
  return new ComposedField({
    kind: 'op:divergence',
    domain: self.domain(),
    rankIn: self.rankIn(),
    rankOut: [],
    continuity: self.continuity() === 'discrete' ? 'discrete' : 'autodiff',
    at: (p) => {
      const jac = self.grad(p).value as number[][]; // [n][m], n === m here
      let trace = 0;
      for (let i = 0; i < jac.length; i++) trace += jac[i][i];
      return trace;
    },
    children: [self.serialize()],
  });
}

/** Curl: 3D vector field on a 3D domain -> 3D vector field. */
export function curl(self: Field): Field {
  assertVector(self, 'op:curl', 3);
  if (self.rankIn() !== 3) {
    throw new Error('op:curl requires a domain rank-3 vector field');
  }
  return new ComposedField({
    kind: 'op:curl',
    domain: self.domain(),
    rankIn: 3,
    rankOut: [3],
    continuity: self.continuity() === 'discrete' ? 'discrete' : 'autodiff',
    at: (p) => {
      const J = self.grad(p).value as number[][]; // J[i][j] = dF_i/dx_j
      return [
        J[2][1] - J[1][2], // dFz/dy - dFy/dz
        J[0][2] - J[2][0], // dFx/dz - dFz/dx
        J[1][0] - J[0][1], // dFy/dx - dFx/dy
      ];
    },
    children: [self.serialize()],
  });
}

/** Laplacian: scalar field -> scalar field, via direct second-order finite difference. */
export function laplacian(self: Field): Field {
  assertScalar(self, 'op:laplacian');
  const m = self.rankIn();
  const h = 1e-3;
  return new ComposedField({
    kind: 'op:laplacian',
    domain: self.domain(),
    rankIn: m,
    rankOut: [],
    continuity: self.continuity() === 'discrete' ? 'discrete' : 'autodiff',
    at: (p) => {
      const f0 = asScalar(self.at(p));
      let sum = 0;
      for (let i = 0; i < m; i++) {
        const pPlus = p.slice();
        const pMinus = p.slice();
        pPlus[i] += h;
        pMinus[i] -= h;
        const fPlus = asScalar(self.at(pPlus));
        const fMinus = asScalar(self.at(pMinus));
        sum += (fPlus - 2 * f0 + fMinus) / (h * h);
      }
      return sum;
    },
    children: [self.serialize()],
  });
}

/**
 * Standalone finite difference gradient computation on arbitrary closures.
 */
export function finiteDifferenceGrad(
  fn: (p: number[]) => number,
  p: number[],
  h = 1e-4
): number[] {
  const m = p.length;
  const grad: number[] = new Array(m);
  for (let i = 0; i < m; i++) {
    const pPlus = p.slice();
    const pMinus = p.slice();
    pPlus[i] += h;
    pMinus[i] -= h;
    grad[i] = (fn(pPlus) - fn(pMinus)) / (2 * h);
  }
  return grad;
}

registerOperator('gradient', (self) => gradient(self));
registerOperator('divergence', (self) => divergence(self));
registerOperator('curl', (self) => curl(self));
registerOperator('laplacian', (self) => laplacian(self));

