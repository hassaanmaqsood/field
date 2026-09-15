import {
  Field,
  FieldValue,
  asNumberArray,
  asScalar,
  assertSameCodomain,
  assertSameDomainRank,
} from '../protocol/Field';
import { ComposedField } from './ComposedField';
import { registerOperator } from './registry';

function intersectDomain(a: Field, b: Field) {
  return a.domain().map((bd, i) => ({
    min: Math.max(bd.min, b.domain()[i].min),
    max: Math.min(bd.max, b.domain()[i].max),
  }));
}

function combinedContinuity(a: Field, b: Field) {
  // discrete "taints" the result: an op touching any discrete input can no
  // longer promise exact analytic derivatives everywhere.
  if (a.continuity() === 'discrete' || b.continuity() === 'discrete') return 'discrete' as const;
  if (a.continuity() === 'autodiff' || b.continuity() === 'autodiff') return 'autodiff' as const;
  return 'analytic' as const;
}

function elementwise(
  kind: string,
  op: (x: number, y: number) => number
) {
  return (self: Field, other: Field): Field => {
    assertSameDomainRank(self, other, kind);
    assertSameCodomain(self, other, kind);
    const scalarShape = self.rankOut().length === 0;
    return new ComposedField({
      kind,
      domain: intersectDomain(self, other),
      rankIn: self.rankIn(),
      rankOut: self.rankOut(),
      continuity: combinedContinuity(self, other),
      at: (p) => {
        if (scalarShape) {
          return op(asScalar(self.at(p)), asScalar(other.at(p)));
        }
        const av = asNumberArray(self.at(p));
        const bv = asNumberArray(other.at(p));
        return av.map((v, i) => op(v, bv[i]));
      },
      children: [self.serialize(), other.serialize()],
    });
  };
}

export const add = elementwise('op:add', (x, y) => x + y);
export const subtract = elementwise('op:subtract', (x, y) => x - y);

export function scale(self: Field, k: number): Field {
  const scalarShape = self.rankOut().length === 0;
  return new ComposedField({
    kind: 'op:scale',
    domain: self.domain(),
    rankIn: self.rankIn(),
    rankOut: self.rankOut(),
    continuity: self.continuity(),
    at: (p) => {
      if (scalarShape) return asScalar(self.at(p)) * k;
      return asNumberArray(self.at(p)).map((v) => v * k);
    },
    payload: { k },
    children: [self.serialize()],
  });
}

/** Vector dot product: two vector fields (matching length) -> scalar field. */
export function dot(self: Field, other: Field): Field {
  assertSameDomainRank(self, other, 'op:dot');
  if (self.rankOut().length !== 1 || other.rankOut().length !== 1 || self.rankOut()[0] !== other.rankOut()[0]) {
    throw new Error(`op:dot requires two vector fields of matching length, got [${self.rankOut()}] and [${other.rankOut()}]`);
  }
  return new ComposedField({
    kind: 'op:dot',
    domain: intersectDomain(self, other),
    rankIn: self.rankIn(),
    rankOut: [],
    continuity: combinedContinuity(self, other),
    at: (p) => {
      const av = asNumberArray(self.at(p));
      const bv = asNumberArray(other.at(p));
      return av.reduce((sum, v, i) => sum + v * bv[i], 0);
    },
    children: [self.serialize(), other.serialize()],
  });
}

registerOperator('add', (self, other) => add(self, other!));
registerOperator('subtract', (self, other) => subtract(self, other!));
registerOperator('dot', (self, other) => dot(self, other!));
