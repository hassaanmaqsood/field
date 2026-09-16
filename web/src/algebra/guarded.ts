import { Bounds, Field, FieldValue, Point } from '../protocol/Field';
import { ComposedField } from './ComposedField';
import { registerOperator } from './registry';

/**
 * Returns true if point p is within the bounding box on all axes.
 */
export function containsPoint(domain: Bounds[], p: Point): boolean {
  return domain.every((b, i) => p[i] >= b.min && p[i] <= b.max);
}

/**
 * Cheap Euclidean distance from point p to the domain box (0 if p is inside).
 * Never calls at().
 */
export function boundsDistance(domain: Bounds[], p: Point): number {
  let sumSq = 0;
  for (let i = 0; i < domain.length; i++) {
    const { min, max } = domain[i];
    const d = p[i] < min ? min - p[i] : p[i] > max ? p[i] - max : 0;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq);
}

/**
 * Guarded SDF domain boundary wrapper.
 * Wraps a field so queries outside its domain return signed distance to the
 * domain box (for scalar fields) or zeros (for vector/tensor fields).
 * Inside the domain, queries pass through to field.at(p) unchanged.
 */
export function guarded(field: Field): Field {
  const domain = field.domain();
  const rankOut = field.rankOut();
  const isScalar = rankOut.length === 0;

  let zeroValue: FieldValue = 0;
  if (!isScalar) {
    if (rankOut.length === 1) {
      zeroValue = new Array(rankOut[0]).fill(0);
    } else {
      zeroValue = Array.from({ length: rankOut[0] }, () =>
        new Array(rankOut[1]).fill(0)
      );
    }
  }

  return new ComposedField({
    kind: 'op:guarded',
    domain,
    rankIn: field.rankIn(),
    rankOut,
    continuity: field.continuity(),
    at: (p: Point): FieldValue => {
      if (containsPoint(domain, p)) {
        return field.at(p);
      }
      return isScalar ? boundsDistance(domain, p) : zeroValue;
    },
    children: [field.serialize()],
  });
}

registerOperator('guarded', (self) => guarded(self));
