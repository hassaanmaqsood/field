import { Bounds, Field, Point } from '../protocol/Field';
import { ComposedField } from './ComposedField';
import { registerOperator } from './registry';

/**
 * General precomposition: G = F ∘ φ.
 * φ maps a "reduced" coordinate (length reducedRankIn) to a full coordinate
 * (length self.rankIn()) in self's domain. This is the one mechanism behind
 * both slicing (spec §3) and window/box panning (spec: "reimplemented as the
 * slicing/precomposition operator applied to spatial coordinates, not a
 * separate center hack") — everything below is a specific φ.
 */
export function precompose(
  self: Field,
  phi: (reduced: Point) => Point,
  reducedDomain: Bounds[],
  reducedRankIn: number,
  kind = 'op:precompose',
  payload?: unknown
): Field {
  return new ComposedField({
    kind,
    domain: reducedDomain,
    rankIn: reducedRankIn,
    rankOut: self.rankOut(),
    continuity: self.continuity(),
    at: (p) => self.at(phi(p)),
    payload,
    children: [self.serialize()],
  });
}

export interface FixedAxis {
  axis: number; // index in self's full domain
  value: number;
}

/**
 * Slice: fix k of self's m input coordinates to constant values, leaving the
 * remaining m-k as the free coordinates of the resulting field, in their
 * original relative order. This is the general "4th-dim slider" mechanism —
 * a spatial box-pan is just this same operator with axes 0..2 fixed to a
 * moving center instead of a UI-only special case.
 */
export function slice(self: Field, fixed: FixedAxis[]): Field {
  const m = self.rankIn();
  const fixedAxes = new Set(fixed.map((f) => f.axis));
  const freeAxes: number[] = [];
  for (let i = 0; i < m; i++) if (!fixedAxes.has(i)) freeAxes.push(i);

  const fixedMap = new Map(fixed.map((f) => [f.axis, f.value]));
  const fullDomain = self.domain();
  const reducedDomain = freeAxes.map((axis) => fullDomain[axis]);

  const phi = (reduced: Point): Point => {
    const full = new Array(m).fill(0);
    freeAxes.forEach((axis, i) => (full[axis] = reduced[i]));
    fixedMap.forEach((value, axis) => (full[axis] = value));
    return full;
  };

  return precompose(self, phi, reducedDomain, freeAxes.length, 'op:slice', { fixed });
}

/**
 * Pan: translate a field's spatial window by an offset. Implemented as
 * precomposition with a translation map — the same general operator as
 * slice(), just with an identity-shaped φ shifted by `offset` instead of a
 * dimension-reducing one.
 */
export function pan(self: Field, offset: Point): Field {
  const m = self.rankIn();
  if (offset.length !== m) throw new Error('pan: offset length must match rankIn()');
  const domain = self.domain().map((b, i) => ({ min: b.min - offset[i], max: b.max - offset[i] }));
  const phi = (p: Point): Point => p.map((v, i) => v + offset[i]);
  return precompose(self, phi, domain, m, 'op:pan', { offset });
}

registerOperator('slice', (self) => {
  // compose('slice', self) alone isn't meaningful without axis data; prefer
  // calling slice()/pan() directly. Kept registered for protocol completeness.
  throw new Error('use slice(field, fixedAxes) directly — slice needs axis/value data compose() cannot carry');
});
