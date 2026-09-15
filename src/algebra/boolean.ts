import { Field, assertSameCodomain, assertSameDomainRank, assertScalar, asScalar } from '../protocol/Field';
import { ComposedField } from './ComposedField';
import { registerOperator } from './registry';

function unionDomain(a: Field, b: Field) {
  return a.domain().map((bd, i) => ({
    min: Math.min(bd.min, b.domain()[i].min),
    max: Math.max(bd.max, b.domain()[i].max),
  }));
}

function combinedContinuity(a: Field, b: Field) {
  if (a.continuity() === 'discrete' || b.continuity() === 'discrete') return 'discrete' as const;
  if (a.continuity() === 'autodiff' || b.continuity() === 'autodiff') return 'autodiff' as const;
  return 'analytic' as const;
}

export function min(self: Field, other: Field): Field {
  assertSameDomainRank(self, other, 'op:min');
  assertSameCodomain(self, other, 'op:min');
  assertScalar(self, 'op:min');
  return new ComposedField({
    kind: 'op:min',
    domain: unionDomain(self, other),
    rankIn: self.rankIn(),
    rankOut: [],
    continuity: combinedContinuity(self, other),
    at: (p) => Math.min(asScalar(self.at(p)), asScalar(other.at(p))),
    children: [self.serialize(), other.serialize()],
  });
}

export function max(self: Field, other: Field): Field {
  assertSameDomainRank(self, other, 'op:max');
  assertSameCodomain(self, other, 'op:max');
  assertScalar(self, 'op:max');
  return new ComposedField({
    kind: 'op:max',
    domain: unionDomain(self, other),
    rankIn: self.rankIn(),
    rankOut: [],
    continuity: combinedContinuity(self, other),
    at: (p) => Math.max(asScalar(self.at(p)), asScalar(other.at(p))),
    children: [self.serialize(), other.serialize()],
  });
}

/** Polynomial smooth-min (Inigo Quilez form), blend radius k. */
export function smoothMin(self: Field, other: Field, k = 0.5): Field {
  assertSameDomainRank(self, other, 'op:smoothMin');
  assertSameCodomain(self, other, 'op:smoothMin');
  assertScalar(self, 'op:smoothMin');
  return new ComposedField({
    kind: 'op:smoothMin',
    domain: unionDomain(self, other),
    rankIn: self.rankIn(),
    rankOut: [],
    continuity: combinedContinuity(self, other),
    at: (p) => {
      const a = asScalar(self.at(p));
      const b = asScalar(other.at(p));
      const h = Math.max(k - Math.abs(a - b), 0) / k;
      return Math.min(a, b) - h * h * k * 0.25;
    },
    payload: { k },
    children: [self.serialize(), other.serialize()],
  });
}

registerOperator('min', (self, other) => min(self, other!));
registerOperator('max', (self, other) => max(self, other!));
registerOperator('smoothMin', (self, other) => smoothMin(self, other!));
