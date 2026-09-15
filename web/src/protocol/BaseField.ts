import {
  Bounds,
  Continuity,
  Field,
  FieldValue,
  GradResult,
  GridSpec,
  Point,
  SerializedField,
  Shape,
  asNumberArray,
} from './Field';
import { operatorRegistry } from '../algebra/registry';
import { runSample } from './sampleImpl';

/**
 * Shared base every backend/operator extends. Provides:
 *  - a centered-finite-difference grad() fallback so every field is
 *    differentiable even when it has no analytic/autodiff derivative
 *    (spec §8: "when absent, the runtime falls back to a numerical
 *    estimate and flags the result as approximate")
 *  - compose() dispatch through a shared operator registry (spec §2.3:
 *    "the general mechanism every built-in operator is implemented through")
 *  - sample() = bake, generic over any field via point-query (§4)
 */
export abstract class BaseField implements Field {
  abstract domain(): Bounds[];
  abstract rankIn(): number;
  abstract rankOut(): Shape;
  abstract continuity(): Continuity;
  abstract at(p: Point): FieldValue;
  abstract serialize(): SerializedField;

  /** Override in backends with exact analytic/autodiff derivatives. */
  grad(p: Point): GradResult {
    return finiteDifferenceGrad(this, p);
  }

  compose(op: string, ...others: Field[]): Field {
    const fn = operatorRegistry.get(op);
    if (!fn) {
      throw new Error(`compose: unknown operator "${op}". Registered: ${[...operatorRegistry.keys()].join(', ')}`);
    }
    return fn(this, ...others);
  }

  sample(gridSpec: GridSpec): Field {
    return runSample(this, gridSpec);
  }
}

const H = 1e-4;

/** Centered finite-difference Jacobian. Works for any rankIn/rankOut — this is
 * the generic numerical fallback every backend can rely on. */
export function finiteDifferenceGrad(field: Field, p: Point): GradResult {
  const m = field.rankIn();
  const shape = field.rankOut();

  if (shape.length === 0) {
    // scalar -> gradient vector of length m
    const grad: number[] = new Array(m).fill(0);
    for (let i = 0; i < m; i++) {
      const pPlus = p.slice();
      const pMinus = p.slice();
      pPlus[i] += H;
      pMinus[i] -= H;
      const fPlus = field.at(clampToDomain(pPlus, field));
      const fMinus = field.at(clampToDomain(pMinus, field));
      grad[i] = (asScalarNum(fPlus) - asScalarNum(fMinus)) / (2 * H);
    }
    return { value: grad, approximate: true };
  }

  if (shape.length === 1) {
    // vector (length n) -> Jacobian [n][m]
    const n = shape[0];
    const jac: number[][] = Array.from({ length: n }, () => new Array(m).fill(0));
    for (let i = 0; i < m; i++) {
      const pPlus = p.slice();
      const pMinus = p.slice();
      pPlus[i] += H;
      pMinus[i] -= H;
      const fPlus = asNumberArray(field.at(clampToDomain(pPlus, field)));
      const fMinus = asNumberArray(field.at(clampToDomain(pMinus, field)));
      for (let j = 0; j < n; j++) {
        jac[j][i] = (fPlus[j] - fMinus[j]) / (2 * H);
      }
    }
    return { value: jac, approximate: true };
  }

  throw new Error('finiteDifferenceGrad: rank-2+ tensor fields do not define grad() in this milestone');
}

function asScalarNum(v: FieldValue): number {
  if (typeof v === 'number') return v;
  throw new Error('expected scalar value in gradient computation');
}

function clampToDomain(p: Point, field: Field): Point {
  const bounds = field.domain();
  return p.map((v, i) => {
    const b = bounds[i];
    if (!b) return v;
    return Math.min(b.max, Math.max(b.min, v));
  });
}
