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
  const domain = self.domain();
  const phi = (p: Point): Point => p.map((v, i) => v - offset[i]);
  return precompose(self, phi, domain, m, 'op:pan', { offset });
}

/**
 * rotate2D: rotates the field by angle θ (radians) in the plane spanned by two axes [a0, a1].
 * Recomputes domain bounds tightly from the rotated corners.
 */
export function rotate2D(self: Field, a0 = 0, a1 = 1, theta = 0): Field {
  const m = self.rankIn();
  if (a0 < 0 || a0 >= m || a1 < 0 || a1 >= m) {
    throw new Error(`rotate2D: axis index out of bounds [0, ${m - 1}]`);
  }
  const cosF = Math.cos(theta), sinF = Math.sin(theta);
  const cosI = Math.cos(-theta), sinI = Math.sin(-theta);

  const domain = self.domain();
  const b0 = domain[a0], b1 = domain[a1];
  const corners = [
    [b0.min, b1.min],
    [b0.max, b1.min],
    [b0.min, b1.max],
    [b0.max, b1.max],
  ].map(([x, y]) => [x * cosF - y * sinF, x * sinF + y * cosF]);

  const newDomain = domain.map((b) => ({ ...b }));
  newDomain[a0] = {
    min: Math.min(...corners.map((c) => c[0])),
    max: Math.max(...corners.map((c) => c[0])),
  };
  newDomain[a1] = {
    min: Math.min(...corners.map((c) => c[1])),
    max: Math.max(...corners.map((c) => c[1])),
  };

  const phi = (p: Point): Point => {
    const full = p.slice();
    const p0 = p[a0], p1 = p[a1];
    full[a0] = p0 * cosI - p1 * sinI;
    full[a1] = p0 * sinI + p1 * cosI;
    return full;
  };

  return precompose(self, phi, newDomain, m, 'op:rotate2D', { a0, a1, theta });
}

/**
 * mirror: reflects a single axis across a given plane at (default 0).
 */
export function mirror(self: Field, axis = 0, at = 0): Field {
  const m = self.rankIn();
  if (axis < 0 || axis >= m) {
    throw new Error(`mirror: axis index out of bounds [0, ${m - 1}]`);
  }
  const domain = self.domain();
  const newDomain = domain.map((b, i) => {
    if (i === axis) {
      const minRef = 2 * at - b.max;
      const maxRef = 2 * at - b.min;
      return { min: Math.min(minRef, maxRef), max: Math.max(minRef, maxRef) };
    }
    return { ...b };
  });

  const phi = (p: Point): Point => {
    const full = p.slice();
    full[axis] = 2 * at - full[axis];
    return full;
  };

  return precompose(self, phi, newDomain, m, 'op:mirror', { axis, at });
}

registerOperator('slice', (self) => {
  // compose('slice', self) alone isn't meaningful without axis data; prefer
  // calling slice()/pan() directly. Kept registered for protocol completeness.
  throw new Error('use slice(field, fixedAxes) directly — slice needs axis/value data compose() cannot carry');
});

registerOperator('rotate2D', (self) => rotate2D(self, 0, 1, Math.PI / 4));
registerOperator('mirror', (self) => mirror(self, 0, 0));

