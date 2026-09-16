// =============================================================================
// field-viz.js — a single-module field visualization library.
//
// You define fields in plain JS (a domain + a point→value function). The
// library handles: sampling onto grids of any dimension without blocking the
// UI thread, combining fields with an algebra (gradient, divergence, curl,
// min/max/blend, slicing...), and rendering them into one or more views
// (isosurfaces, vector/tensor glyphs, streamlines, 2D heatmaps) with pan/zoom
// controls that are independent of the field's own mathematical domain.
//
// Dependency: three.js (peer). Everything else is plain JS, in this one file.
//
// Compute is pluggable (see COMPUTE_BACKEND at the bottom of the "compute"
// section) — today it's a time-sliced JS loop so the tab never freezes; a
// WASM/native backend can be dropped in later behind the same interface
// without touching Field, Grid, or View code.
// =============================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// -----------------------------------------------------------------------------
// Grid — an n-dimensional structured sampling grid. Works for 1D, 2D, 3D, 4D+.
// A grid is just "what points do we evaluate a field at" — it doesn't hold
// field values itself (that's DiscreteField, produced by sampling a Grid).
// -----------------------------------------------------------------------------

export class Grid {
  /**
   * @param {{domain: number[][], resolution: number[]}} spec
   *   domain: [[min,max], ...] one pair per axis
   *   resolution: sample count per axis (>=2), same length as domain
   */
  constructor({ domain, resolution }) {
    if (domain.length !== resolution.length) {
      throw new Error(`Grid: domain (${domain.length}D) and resolution (${resolution.length}D) length mismatch`);
    }
    this.domain = domain.map(([min, max]) => ({ min, max }));
    this.resolution = resolution.slice();
    this.rank = domain.length;
    this.totalPoints = resolution.reduce((a, b) => a * b, 1);
  }

  /** Point at integer grid coordinates (one index per axis). */
  pointAt(coords) {
    return coords.map((c, d) => {
      const { min, max } = this.domain[d];
      const res = this.resolution[d];
      return res === 1 ? min : min + (c / (res - 1)) * (max - min);
    });
  }

  /** Flat row-major index from integer grid coordinates. */
  flatIndex(coords) {
    let idx = 0, stride = 1;
    for (let d = this.rank - 1; d >= 0; d--) {
      idx += coords[d] * stride;
      stride *= this.resolution[d];
    }
    return idx;
  }

  /** Integer grid coordinates from a flat row-major index. */
  coordsAt(flat) {
    const coords = new Array(this.rank);
    let rem = flat;
    const strides = new Array(this.rank);
    strides[this.rank - 1] = 1;
    for (let d = this.rank - 2; d >= 0; d--) strides[d] = strides[d + 1] * this.resolution[d + 1];
    for (let d = 0; d < this.rank; d++) {
      coords[d] = Math.floor(rem / strides[d]);
      rem %= strides[d];
    }
    return coords;
  }

  /** Iterate every grid point as {coords, point, flat}. For small grids / tests. */
  *[Symbol.iterator]() {
    for (let flat = 0; flat < this.totalPoints; flat++) {
      const coords = this.coordsAt(flat);
      yield { coords, point: this.pointAt(coords), flat };
    }
  }
}

export function createGrid(spec) {
  return new Grid(spec);
}

// -----------------------------------------------------------------------------
// Field — the core value object. Wraps a domain + point-query function with a
// chainable algebra so users can build new fields from old ones without
// leaving JS: `a.gradient()`, `a.smoothMin(b, 0.5)`, `a.slice({3: 0.2})`, etc.
// -----------------------------------------------------------------------------

const FD_H = 1e-4;

export class Field {
  /**
   * @param {object} spec
   * @param {number[][]} spec.domain  [[min,max], ...] per axis
   * @param {number[]} spec.rankOut   [] scalar | [n] vector | [n,n] tensor
   * @param {(p:number[]) => (number|number[]|number[][])} spec.at
   * @param {(p:number[]) => (number[]|number[][])} [spec.grad] exact derivative; omit for finite-difference fallback
   * @param {'analytic'|'autodiff'|'discrete'} [spec.continuity]
   * @param {string} [spec.label] human-readable name, shown in UI/debug
   */
  constructor(spec) {
    this.domain = spec.domain.map(([min, max]) => ({ min, max }));
    this.rankIn = this.domain.length;
    this.rankOut = spec.rankOut.slice();
    this._at = spec.at;
    this._grad = spec.grad || null;
    this.continuity = spec.continuity || (this._grad ? 'analytic' : 'analytic');
    this.label = spec.label || 'field';
  }

  /** Pure point query. p.length === this.rankIn. */
  at(p) {
    return this._at(p);
  }

  /** Exact derivative if the field has one; otherwise a flagged numerical estimate. */
  grad(p) {
    if (this._grad) return { value: this._grad(p), approximate: false };
    return finiteDifferenceGrad(this, p);
  }

  get shapeLabel() {
    if (this.rankOut.length === 0) return 'scalar';
    if (this.rankOut.length === 1) return 'vector';
    return 'tensor';
  }

  // ---- synchronous algebra (cheap, used for building field graphs) ----

  add(other) { return elementwise(this, other, (x, y) => x + y, 'add'); }
  subtract(other) { return elementwise(this, other, (x, y) => x - y, 'subtract'); }

  scale(k) {
    const scalar = this.rankOut.length === 0;
    return new Field({
      domain: domainToPairs(this.domain),
      rankOut: this.rankOut,
      continuity: this.continuity,
      label: `${this.label}*${k}`,
      at: (p) => (scalar ? this.at(p) * k : asArray(this.at(p)).map((v) => v * k)),
    });
  }

  dot(other) {
    assertSameDomainRank(this, other, 'dot');
    if (this.rankOut.length !== 1 || other.rankOut.length !== 1 || this.rankOut[0] !== other.rankOut[0]) {
      throw new Error(`dot: both fields must be vector fields of matching length (got [${this.rankOut}], [${other.rankOut}])`);
    }
    return new Field({
      domain: intersectDomain(this, other),
      rankOut: [],
      continuity: combineContinuity(this, other),
      label: `dot(${this.label}, ${other.label})`,
      at: (p) => {
        const a = asArray(this.at(p)), b = asArray(other.at(p));
        return a.reduce((s, v, i) => s + v * b[i], 0);
      },
    });
  }

  min(other) { return sdfOp(this, other, Math.min, 'min'); }
  max(other) { return sdfOp(this, other, Math.max, 'max'); }

  smoothMin(other, k = 0.5) {
    assertScalar(this, 'smoothMin');
    assertScalar(other, 'smoothMin');
    assertSameDomainRank(this, other, 'smoothMin');
    return new Field({
      domain: unionDomain(this, other),
      rankOut: [],
      continuity: combineContinuity(this, other),
      label: `smoothMin(${this.label}, ${other.label})`,
      at: (p) => {
        // Bounds early-out: far outside a field's own domain box, its exact
        // value doesn't matter to a min/max-style blend, only that it's "far"
        // — so skip the (possibly expensive) at() and use the cheap
        // distance-to-box estimate instead. Same domain never gets a false
        // early-out since containsPoint is checked per side.
        const a = scalarAtOrBounds(this, p), b = scalarAtOrBounds(other, p);
        const h = Math.max(k - Math.abs(a - b), 0) / k;
        return Math.min(a, b) - h * h * k * 0.25;
      },
    });
  }

  gradient() {
    assertScalar(this, 'gradient');
    const m = this.rankIn;
    return new Field({
      domain: domainToPairs(this.domain),
      rankOut: [m],
      continuity: this.continuity === 'discrete' ? 'discrete' : 'autodiff',
      label: `grad(${this.label})`,
      at: (p) => this.grad(p).value,
    });
  }

  divergence() {
    assertVector(this, 'divergence', this.rankIn);
    return new Field({
      domain: domainToPairs(this.domain),
      rankOut: [],
      continuity: this.continuity === 'discrete' ? 'discrete' : 'autodiff',
      label: `div(${this.label})`,
      at: (p) => {
        const jac = this.grad(p).value;
        let trace = 0;
        for (let i = 0; i < jac.length; i++) trace += jac[i][i];
        return trace;
      },
    });
  }

  curl() {
    assertVector(this, 'curl', 3);
    if (this.rankIn !== 3) throw new Error('curl: requires a domain-rank-3 vector field');
    return new Field({
      domain: domainToPairs(this.domain),
      rankOut: [3],
      continuity: this.continuity === 'discrete' ? 'discrete' : 'autodiff',
      label: `curl(${this.label})`,
      at: (p) => {
        const J = this.grad(p).value;
        return [J[2][1] - J[1][2], J[0][2] - J[2][0], J[1][0] - J[0][1]];
      },
    });
  }

  laplacian(h = 1e-3) {
    assertScalar(this, 'laplacian');
    const m = this.rankIn;
    return new Field({
      domain: domainToPairs(this.domain),
      rankOut: [],
      continuity: this.continuity === 'discrete' ? 'discrete' : 'autodiff',
      label: `laplacian(${this.label})`,
      at: (p) => {
        const f0 = this.at(p);
        let sum = 0;
        for (let i = 0; i < m; i++) {
          const pp = p.slice(); pp[i] += h;
          const pm = p.slice(); pm[i] -= h;
          sum += (this.at(pp) - 2 * f0 + this.at(pm)) / (h * h);
        }
        return sum;
      },
    });
  }

  /**
   * General precomposition: G(reduced) = F(phi(reduced)). `phi` maps a point
   * in `newDomain` to a point in this field's own domain. This is the one
   * mechanism behind slice, rotate2D, mirror, and any other domain warp —
   * they're all just a choice of `phi` + the domain it needs.
   */
  precompose(phi, newDomain, { label = `precompose(${this.label})` } = {}) {
    return new Field({
      domain: newDomain,
      rankOut: this.rankOut,
      continuity: this.continuity,
      label,
      at: (p) => this.at(phi(p)),
    });
  }

  /**
   * Slice: fix some input axes to constant values, keep the rest as the
   * reduced field's free axes (in original order). `fixed` is an object
   * {axisIndex: value, ...}. One instance of precompose: phi embeds the
   * reduced point back into full-rank space with the fixed axes filled in.
   */
  slice(fixed) {
    const m = this.rankIn;
    const fixedAxes = new Map(Object.entries(fixed).map(([k, v]) => [Number(k), v]));
    const freeAxes = [];
    for (let i = 0; i < m; i++) if (!fixedAxes.has(i)) freeAxes.push(i);
    const newDomain = freeAxes.map((axis) => [this.domain[axis].min, this.domain[axis].max]);
    const phi = (reduced) => {
      const full = new Array(m);
      freeAxes.forEach((axis, i) => (full[axis] = reduced[i]));
      fixedAxes.forEach((value, axis) => (full[axis] = value));
      return full;
    };
    return this.precompose(phi, newDomain, { label: `slice(${this.label})` });
  }

  /**
   * Rotate the field by `angle` radians in the plane spanned by two axes
   * (defaults to the first two). Domain-rank-agnostic — you can rotate two
   * axes of a 4D+ field the same way. Bounds are recomputed by rotating the
   * domain's corners (not padded conservatively), so the result stays tight.
   */
  rotate2D(angle, axes = [0, 1]) {
    const [i, j] = axes;
    const cosF = Math.cos(angle), sinF = Math.sin(angle);   // forward: for bounds
    const cosI = Math.cos(-angle), sinI = Math.sin(-angle); // inverse: for phi (query-space)

    const bi = this.domain[i], bj = this.domain[j];
    const corners = [
      [bi.min, bj.min], [bi.max, bj.min], [bi.min, bj.max], [bi.max, bj.max],
    ].map(([a, b]) => [a * cosF - b * sinF, a * sinF + b * cosF]);
    const newDomain = domainToPairs(this.domain);
    newDomain[i] = [Math.min(...corners.map((c) => c[0])), Math.max(...corners.map((c) => c[0]))];
    newDomain[j] = [Math.min(...corners.map((c) => c[1])), Math.max(...corners.map((c) => c[1]))];

    const phi = (p) => {
      const full = p.slice();
      const pi = p[i], pj = p[j];
      full[i] = pi * cosI - pj * sinI;
      full[j] = pi * sinI + pj * cosI;
      return full;
    };
    return this.precompose(phi, newDomain, { label: `rotate2D(${this.label})` });
  }

  /** Mirror the field across the plane axis = at (domain stays the same shape). */
  mirror(axis, at = 0) {
    const newDomain = domainToPairs(this.domain);
    const phi = (p) => { const full = p.slice(); full[axis] = 2 * at - full[axis]; return full; };
    return this.precompose(phi, newDomain, { label: `mirror(${this.label})` });
  }

  /** Is p within this field's own domain (all axes)? */
  containsPoint(p) {
    return this.domain.every((b, i) => p[i] >= b.min && p[i] <= b.max);
  }

  /** Cheap Euclidean distance from p to this field's domain box (0 if inside). Never calls at(). */
  boundsDistance(p) {
    let sumSq = 0;
    for (let i = 0; i < this.domain.length; i++) {
      const { min, max } = this.domain[i];
      const d = p[i] < min ? min - p[i] : p[i] > max ? p[i] - max : 0;
      sumSq += d * d;
    }
    return Math.sqrt(sumSq);
  }

  /**
   * Wrap this field so out-of-domain queries never reach the (potentially
   * expensive) user `at()` closure. Scalar fields get the SDF-sane default
   * (distance to the domain box, so a shape composed with min()/max() just
   * looks "far away" past its own extent instead of undefined behavior);
   * vector/tensor fields get a zero default. Views apply this automatically
   * when a window is panned/zoomed past a field's own domain.
   */
  guarded() {
    const scalar = this.rankOut.length === 0;
    const zeroVec = scalar ? null : new Array(this.rankOut.length === 1 ? this.rankOut[0] : this.rankOut[0] * this.rankOut[1]).fill(0);
    const zeroValue = scalar
      ? null
      : this.rankOut.length === 1
        ? zeroVec
        : Array.from({ length: this.rankOut[0] }, () => new Array(this.rankOut[1]).fill(0));
    return new Field({
      domain: domainToPairs(this.domain),
      rankOut: this.rankOut,
      continuity: this.continuity,
      label: `guarded(${this.label})`,
      at: (p) => (this.containsPoint(p) ? this.at(p) : (scalar ? this.boundsDistance(p) : zeroValue)),
    });
  }

  /** Generic escape hatch: wrap this field through an arbitrary JS transform. */
  map(fn, { rankOut = this.rankOut, label = `map(${this.label})` } = {}) {
    return new Field({
      domain: domainToPairs(this.domain),
      rankOut,
      continuity: this.continuity,
      label,
      at: (p) => fn(this.at(p), p),
    });
  }

  /** Synchronous bake — fine for small grids; use sampleAsync for large ones. */
  sample(grid) {
    return bakeSync(this, grid);
  }

  /** Non-blocking bake: time-slices the sampling loop across frames. */
  sampleAsync(grid, opts = {}) {
    return bakeAsync(this, grid, opts);
  }
}

function domainToPairs(domain) {
  return domain.map((b) => [b.min, b.max]);
}
function asArray(v) {
  return Array.isArray(v) ? v : [v];
}
function intersectDomain(a, b) {
  return a.domain.map((bd, i) => [Math.max(bd.min, b.domain[i].min), Math.min(bd.max, b.domain[i].max)]);
}
function unionDomain(a, b) {
  return a.domain.map((bd, i) => [Math.min(bd.min, b.domain[i].min), Math.max(bd.max, b.domain[i].max)]);
}
function combineContinuity(a, b) {
  if (a.continuity === 'discrete' || b.continuity === 'discrete') return 'discrete';
  if (a.continuity === 'autodiff' || b.continuity === 'autodiff') return 'autodiff';
  return 'analytic';
}
function assertSameDomainRank(a, b, op) {
  if (a.rankIn !== b.rankIn) throw new Error(`${op}: domain rank mismatch (${a.rankIn} vs ${b.rankIn})`);
}
function assertSameCodomain(a, b, op) {
  if (a.rankOut.length !== b.rankOut.length || a.rankOut.some((v, i) => v !== b.rankOut[i])) {
    throw new Error(`${op}: codomain shape mismatch ([${a.rankOut}] vs [${b.rankOut}])`);
  }
}
function assertScalar(f, op) {
  if (f.rankOut.length !== 0) throw new Error(`${op}: expected a scalar field, got shape [${f.rankOut}]`);
}
function assertVector(f, op, n) {
  if (f.rankOut.length !== 1 || (n !== undefined && f.rankOut[0] !== n)) {
    throw new Error(`${op}: expected a vector field${n ? ` of length ${n}` : ''}, got shape [${f.rankOut}]`);
  }
}

function elementwise(a, b, op, name) {
  assertSameDomainRank(a, b, name);
  assertSameCodomain(a, b, name);
  const scalar = a.rankOut.length === 0;
  return new Field({
    domain: intersectDomain(a, b),
    rankOut: a.rankOut,
    continuity: combineContinuity(a, b),
    label: `${name}(${a.label}, ${b.label})`,
    at: (p) => {
      if (scalar) return op(a.at(p), b.at(p));
      const av = asArray(a.at(p)), bv = asArray(b.at(p));
      return av.map((v, i) => op(v, bv[i]));
    },
  });
}

/** field.at(p) if p is in the field's own domain, else the cheap bounds-distance estimate — never both. */
function scalarAtOrBounds(field, p) {
  return field.containsPoint(p) ? field.at(p) : field.boundsDistance(p);
}

function sdfOp(a, b, op, name) {
  assertScalar(a, name);
  assertScalar(b, name);
  assertSameDomainRank(a, b, name);
  return new Field({
    domain: unionDomain(a, b),
    rankOut: [],
    continuity: combineContinuity(a, b),
    label: `${name}(${a.label}, ${b.label})`,
    // Bounds early-out (see smoothMin for the full rationale): min/max only
    // need "how far, in which direction" outside a shape's own extent, so
    // skip at() there and use boundsDistance() instead.
    at: (p) => op(scalarAtOrBounds(a, p), scalarAtOrBounds(b, p)),
  });
}

function finiteDifferenceGrad(field, p) {
  const m = field.rankIn;
  const shape = field.rankOut;
  const clamp = (pt) => pt.map((v, i) => Math.min(field.domain[i].max, Math.max(field.domain[i].min, v)));

  if (shape.length === 0) {
    const g = new Array(m);
    for (let i = 0; i < m; i++) {
      const pp = p.slice(); pp[i] += FD_H;
      const pm = p.slice(); pm[i] -= FD_H;
      g[i] = (field.at(clamp(pp)) - field.at(clamp(pm))) / (2 * FD_H);
    }
    return { value: g, approximate: true };
  }
  if (shape.length === 1) {
    const n = shape[0];
    const jac = Array.from({ length: n }, () => new Array(m).fill(0));
    for (let i = 0; i < m; i++) {
      const pp = p.slice(); pp[i] += FD_H;
      const pm = p.slice(); pm[i] -= FD_H;
      const fp = asArray(field.at(clamp(pp))), fm = asArray(field.at(clamp(pm)));
      for (let j = 0; j < n; j++) jac[j][i] = (fp[j] - fm[j]) / (2 * FD_H);
    }
    return { value: jac, approximate: true };
  }
  throw new Error('finiteDifferenceGrad: rank-2+ tensor fields do not define grad() in this library');
}

/** Define a field from a domain + point function. This is the main entry point users call. */
export function defineField(spec) {
  return new Field(spec);
}

// -----------------------------------------------------------------------------
// DiscreteField — grid-backed field with multilinear interpolation. This is
// what sampling produces, and also how you'd load an external dataset (build
// one directly from a typed array of values you parsed yourself).
// -----------------------------------------------------------------------------

export class DiscreteField extends Field {
  /**
   * @param {Grid} grid
   * @param {number[]} rankOut
   * @param {Float64Array} values flat row-major, each cell holding product(rankOut)||1 numbers
   */
  constructor(grid, rankOut, values) {
    const valueSize = rankOut.length === 0 ? 1 : rankOut.reduce((a, b) => a * b, 1);
    super({
      domain: domainToPairs(grid.domain),
      rankOut,
      continuity: 'discrete',
      label: 'discrete',
      at: (p) => this._interpolate(p),
    });
    this.grid = grid;
    this.valueSize = valueSize;
    this.values = values;
  }

  _cellIndexAndFrac(p) {
    const m = this.grid.rank;
    const idx0 = new Array(m), frac = new Array(m);
    for (let d = 0; d < m; d++) {
      const { min, max } = this.grid.domain[d];
      const res = this.grid.resolution[d];
      const t = ((p[d] - min) / (max - min)) * (res - 1);
      const clamped = Math.min(Math.max(t, 0), res - 1 - 1e-9);
      idx0[d] = Math.floor(clamped);
      frac[d] = clamped - idx0[d];
    }
    return { idx0, frac };
  }

  _interpolate(p) {
    const m = this.grid.rank;
    const { idx0, frac } = this._cellIndexAndFrac(p);
    const size = this.valueSize;
    const out = new Array(size).fill(0);
    const corners = 1 << m;
    for (let c = 0; c < corners; c++) {
      let weight = 1;
      const coords = new Array(m);
      for (let d = 0; d < m; d++) {
        const bit = (c >> d) & 1;
        coords[d] = idx0[d] + bit;
        weight *= bit ? frac[d] : 1 - frac[d];
      }
      if (weight === 0) continue;
      const base = this.grid.flatIndex(coords) * size;
      for (let s = 0; s < size; s++) out[s] += weight * this.values[base + s];
    }
    if (size === 1) return out[0];
    if (this.rankOut.length === 1) return out;
    const n = this.rankOut[0];
    const tensor = [];
    for (let i = 0; i < n; i++) tensor.push(out.slice(i * n, i * n + n));
    return tensor;
  }

  /** Exact derivative of the multilinear interpolant itself (piecewise linear -> exact, constant per cell). */
  _analyticJacobian(p) {
    const m = this.grid.rank;
    const size = this.valueSize;
    const { idx0, frac } = this._cellIndexAndFrac(p);
    const jac = Array.from({ length: size }, () => new Array(m).fill(0));
    const corners = 1 << m;
    for (let c = 0; c < corners; c++) {
      const coords = new Array(m), bits = new Array(m);
      for (let d = 0; d < m; d++) {
        bits[d] = (c >> d) & 1;
        coords[d] = idx0[d] + bits[d];
      }
      const base = this.grid.flatIndex(coords) * size;
      for (let k = 0; k < m; k++) {
        let dweight = bits[k] ? 1 : -1;
        for (let d = 0; d < m; d++) {
          if (d === k) continue;
          dweight *= bits[d] ? frac[d] : 1 - frac[d];
        }
        const { min, max } = this.grid.domain[k];
        const dfracdp = (this.grid.resolution[k] - 1) / (max - min);
        const chain = dweight * dfracdp;
        if (chain === 0) continue;
        for (let s = 0; s < size; s++) jac[s][k] += chain * this.values[base + s];
      }
    }
    return jac;
  }

  /**
   * Reconstruct a continuous, differentiable field from this discrete one.
   * Same multilinear interpolation as at(), but grad() uses the exact
   * derivative of that interpolant instead of a numerical fallback.
   */
  fit() {
    const scalar = this.rankOut.length === 0;
    return new Field({
      domain: domainToPairs(this.domain),
      rankOut: this.rankOut,
      continuity: 'autodiff',
      label: `fit(${this.label})`,
      at: (p) => this._interpolate(p),
      grad: (p) => {
        const jac = this._analyticJacobian(p);
        return scalar ? jac[0] : jac;
      },
    });
  }
}

/**
 * Build a DiscreteField directly from data you already have (e.g. parsed
 * from a CSV/JSON export) — the seam for "imported dataset" use cases.
 * @param {{domain:number[][], resolution:number[], rankOut:number[], values:Float64Array|number[]}} spec
 */
export function fieldFromData({ domain, resolution, rankOut, values }) {
  const grid = new Grid({ domain, resolution });
  return new DiscreteField(grid, rankOut, values instanceof Float64Array ? values : Float64Array.from(values));
}

// -----------------------------------------------------------------------------
// Compute backend — pluggable. Default: a time-sliced JS loop, so sampling a
// large grid never blocks the UI thread for more than one frame budget at a
// time. A WASM/native backend can replace `defaultBackend.sampleGrid` later
// without any caller (Field/View) needing to change — same signature in, same
// Float64Array out.
// -----------------------------------------------------------------------------

function yieldToFrame() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

function now() {
  return (typeof performance !== 'undefined' ? performance : Date).now();
}

export const defaultBackend = {
  name: 'js-time-sliced',

  /**
   * @returns {Promise<Float64Array>} flat row-major values, valueSize per cell
   */
  async sampleGrid(field, grid, { onProgress, frameBudgetMs = 8, signal } = {}) {
    const valueSize = field.rankOut.length === 0 ? 1 : field.rankOut.reduce((a, b) => a * b, 1);
    const values = new Float64Array(grid.totalPoints * valueSize);
    let flat = 0;
    let t0 = now();
    while (flat < grid.totalPoints) {
      if (signal && signal.aborted) throw new DOMException('sampling aborted', 'AbortError');
      const coords = grid.coordsAt(flat);
      const p = grid.pointAt(coords);
      const v = field.at(p);
      if (valueSize === 1) values[flat] = v;
      else {
        const flatV = Array.isArray(v[0]) ? v.flat() : v;
        values.set(flatV, flat * valueSize);
      }
      flat++;
      if (now() - t0 > frameBudgetMs) {
        onProgress && onProgress(flat / grid.totalPoints);
        await yieldToFrame();
        t0 = now();
      }
    }
    onProgress && onProgress(1);
    return values;
  },

  /** Synchronous variant — blocks, but fine for small grids or worker contexts. */
  sampleGridSync(field, grid) {
    const valueSize = field.rankOut.length === 0 ? 1 : field.rankOut.reduce((a, b) => a * b, 1);
    const values = new Float64Array(grid.totalPoints * valueSize);
    for (let flat = 0; flat < grid.totalPoints; flat++) {
      const p = grid.pointAt(grid.coordsAt(flat));
      const v = field.at(p);
      if (valueSize === 1) values[flat] = v;
      else {
        const flatV = Array.isArray(v[0]) ? v.flat() : v;
        values.set(flatV, flat * valueSize);
      }
    }
    return values;
  },
};

let activeBackend = defaultBackend;

/** Swap the compute backend globally (e.g. a future WASM/native one). */
export function setComputeBackend(backend) {
  activeBackend = backend;
}
export function getComputeBackend() {
  return activeBackend;
}

function bakeSync(field, grid) {
  const values = activeBackend.sampleGridSync(field, grid);
  return new DiscreteField(grid, field.rankOut, values);
}

async function bakeAsync(field, grid, opts) {
  const values = await activeBackend.sampleGrid(field, grid, opts);
  return new DiscreteField(grid, field.rankOut, values);
}

// -----------------------------------------------------------------------------
// Parameter / DerivedParameter / reactiveField — dependency-graph reactivity
// for building fields from sliders/controls without imperatively re-baking on
// every event. A Parameter holds a value and notifies dependents when it
// changes; a DerivedParameter computes lazily from other parameters and only
// recomputes when something it depends on actually changed; reactiveField
// wraps a field-builder function so it only rebuilds when a dependency
// changed since the last read, memoizing everything else. Views (below)
// subscribe to these directly instead of rebuilding on every slider event.
// -----------------------------------------------------------------------------

export class Parameter {
  constructor(name, value, { min = -Infinity, max = Infinity } = {}) {
    this.name = name;
    this._value = value;
    this.min = min;
    this.max = max;
    this._dependents = new Set();
    this._listeners = [];
  }

  get value() {
    return this._value;
  }

  set value(v) {
    const clamped = Math.min(this.max, Math.max(this.min, v));
    if (clamped === this._value) return;
    this._value = clamped;
    this._propagate();
  }

  /** cb() is called (no args — re-read .value yourself) whenever this parameter, or anything derived from it, changes. */
  onChange(cb) {
    this._listeners.push(cb);
    return () => { this._listeners = this._listeners.filter((f) => f !== cb); };
  }

  _propagate() {
    for (const dep of this._dependents) dep._invalidate();
    for (const cb of this._listeners) cb();
  }
}

export class DerivedParameter extends Parameter {
  /** @param {string} name @param {(...values:number[]) => number} computeFn @param {Parameter[]} deps */
  constructor(name, computeFn, deps) {
    super(name, undefined);
    this.computeFn = computeFn;
    this.deps = deps;
    this._dirty = true;
    for (const d of deps) d._dependents.add(this);
  }

  _invalidate() {
    const wasClean = !this._dirty;
    this._dirty = true;
    if (!wasClean) return; // already dirty (and already propagated) — don't double-notify
    for (const dep of this._dependents) dep._invalidate();
    for (const cb of this._listeners) cb();
  }

  /** Recomputed lazily on read, not on every upstream change. */
  get value() {
    if (this._dirty) {
      this._value = this.computeFn(...this.deps.map((d) => d.value));
      this._dirty = false;
    }
    return this._value;
  }

  set value(_v) {
    throw new Error(`DerivedParameter "${this.name}" is read-only`);
  }
}

export function createParameter(name, value, opts) {
  return new Parameter(name, value, opts);
}
export function createDerivedParameter(name, computeFn, deps) {
  return new DerivedParameter(name, computeFn, deps);
}

/**
 * Wrap a field-builder in a lazily-memoized reactive handle. `buildFn`
 * receives each dep's current .value and must return a Field. The field is
 * only rebuilt the next time `.current` is read after a dependency changed
 * — not synchronously on every change — so binding ten parameters to one
 * slider each and dragging all of them doesn't rebuild the field ten times.
 */
export function reactiveField(buildFn, deps) {
  let cached = null;
  let dirty = true;
  const unsubscribers = deps.map((d) => d.onChange(() => { dirty = true; }));
  const handle = {
    deps,
    get current() {
      if (dirty || !cached) {
        cached = buildFn(...deps.map((d) => d.value));
        dirty = false;
      }
      return cached;
    },
    rebuild() {
      cached = buildFn(...deps.map((d) => d.value));
      dirty = false;
      return cached;
    },
    dispose() {
      for (const u of unsubscribers) u();
    },
  };
  return handle;
}

function isReactiveHandle(x) {
  return x && typeof x === 'object' && 'current' in x && Array.isArray(x.deps);
}

// -----------------------------------------------------------------------------
// Eigendecomposition helper (symmetric 3x3, cyclic Jacobi) — used by tensor glyphs.
// -----------------------------------------------------------------------------

function jacobiEigen3(mIn) {
  const a = [mIn[0].slice(), mIn[1].slice(), mIn[2].slice()];
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 40; sweep++) {
    const off = Math.abs(a[0][1]) + Math.abs(a[0][2]) + Math.abs(a[1][2]);
    if (off < 1e-9) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(a[p][q]) < 1e-12) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = (Math.sign(theta) || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;
      const app = a[p][p], aqq = a[q][q], apq = a[p][q];
      a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
      a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
      a[p][q] = a[q][p] = 0;
      for (let k = 0; k < 3; k++) {
        if (k !== p && k !== q) {
          const akp = a[k][p], akq = a[k][q];
          a[k][p] = a[p][k] = c * akp - s * akq;
          a[k][q] = a[q][k] = s * akp + c * akq;
        }
        const vkp = v[k][p], vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq;
        v[k][q] = s * vkp + c * vkq;
      }
    }
  }
  return {
    values: [a[0][0], a[1][1], a[2][2]],
    vectors: new THREE.Matrix3().set(v[0][0], v[0][1], v[0][2], v[1][0], v[1][1], v[1][2], v[2][0], v[2][1], v[2][2]),
  };
}

// -----------------------------------------------------------------------------
// View — a Three.js viewport. Create as many as you like, each independently
// pointed at whatever fields/representations you add to it. The view's pan
// "window" is its own state — it never mutates the fields it's showing.
// -----------------------------------------------------------------------------

const ISO_VERTEX = /* glsl */ `
  varying vec3 vObjPos;
  void main() {
    vObjPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const ISO_FRAGMENT = /* glsl */ `
  precision highp float;
  precision highp sampler3D;
  uniform sampler3D uVoxels;
  uniform vec3 uBoxMin;
  uniform vec3 uBoxMax;
  uniform float uIso;
  uniform vec3 uCameraObjPos;
  uniform vec3 uColor;
  varying vec3 vObjPos;

  float density(vec3 p) {
    vec3 uv = (p - uBoxMin) / (uBoxMax - uBoxMin);
    return texture(uVoxels, uv).r - uIso;
  }
  vec3 normalAt(vec3 p) {
    float e = 0.01;
    float dx = density(p + vec3(e,0,0)) - density(p - vec3(e,0,0));
    float dy = density(p + vec3(0,e,0)) - density(p - vec3(0,e,0));
    float dz = density(p + vec3(0,0,e)) - density(p - vec3(0,0,e));
    return normalize(vec3(dx, dy, dz) + 1e-6);
  }
  vec2 boxIntersect(vec3 ro, vec3 rd) {
    vec3 inv = 1.0 / rd;
    vec3 t0 = (uBoxMin - ro) * inv;
    vec3 t1 = (uBoxMax - ro) * inv;
    vec3 tmin = min(t0, t1);
    vec3 tmax = max(t0, t1);
    return vec2(max(max(tmin.x, tmin.y), tmin.z), min(min(tmax.x, tmax.y), tmax.z));
  }
  void main() {
    vec3 ro = uCameraObjPos;
    vec3 rd = normalize(vObjPos - uCameraObjPos);
    vec2 tb = boxIntersect(ro, rd);
    if (tb.x > tb.y || tb.y < 0.0) discard;
    float t = max(tb.x, 0.0);
    float tEnd = tb.y;
    const int STEPS = 160;
    float stepSize = (tEnd - t) / float(STEPS);
    float prevD = density(ro + rd * t);
    float hitT = -1.0;
    for (int i = 1; i <= STEPS; i++) {
      float ct = t + float(i) * stepSize;
      float d = density(ro + rd * ct);
      if (prevD > 0.0 && d <= 0.0) {
        float lo = ct - stepSize, hi = ct;
        for (int j = 0; j < 6; j++) {
          float mid = 0.5 * (lo + hi);
          if (density(ro + rd * mid) > 0.0) lo = mid; else hi = mid;
        }
        hitT = 0.5 * (lo + hi);
        break;
      }
      prevD = d;
    }
    if (hitT < 0.0) discard;
    vec3 hitP = ro + rd * hitT;
    vec3 n = normalAt(hitP);
    vec3 lightDir = normalize(vec3(0.5, 0.8, 0.4));
    float diff = max(dot(n, lightDir), 0.0);
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.0);
    gl_FragColor = vec4(uColor * (0.25 + 0.75 * diff) + vec3(0.15) * rim, 1.0);
  }
`;

export class View {
  /**
   * @param {HTMLElement} container
   * @param {{dims?: 2|3}} [opts]
   */
  constructor(container, opts = {}) {
    this.container = container;
    this.dims = opts.dims || 3;
    this.representations = []; // { dispose(), refresh() }
    this._probeCallbacks = [];
    this.window = { center: new Array(3).fill(0), size: [8, 8, 8] };
    this._pendingRebuilds = new Set();
    this._rafScheduled = false;

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);
    this.canvas = canvas;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0d10);

    if (this.dims === 2) {
      const aspect = container.clientWidth / Math.max(container.clientHeight, 1);
      this.camera = new THREE.OrthographicCamera(-4 * aspect, 4 * aspect, 4, -4, 0.01, 100);
      this.camera.position.set(0, 0, 5);
      this.camera.lookAt(0, 0, 0);
    } else {
      this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / Math.max(container.clientHeight, 1), 0.05, 200);
      this.camera.position.set(6, 5, 8);
    }

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enableRotate = this.dims === 3;

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(5, 8, 4);
    this.scene.add(ambient, dir);

    this.fieldGroup = new THREE.Group();
    this.scene.add(this.fieldGroup);

    this._windowHelper = new THREE.Box3Helper(new THREE.Box3(), 0x475569);
    this.scene.add(this._windowHelper);
    this._syncWindowHelper();

    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(container);
    this._resize();

    this._raycaster = new THREE.Raycaster();
    this._probeTarget = null; // invisible mesh matching the active field's spatial extent
    canvas.addEventListener('click', (ev) => this._handleClick(ev));

    this._animate();
  }

  _resize() {
    const w = this.container.clientWidth, h = Math.max(this.container.clientHeight, 1);
    this.renderer.setSize(w, h, false);
    if (this.camera.isPerspectiveCamera) {
      this.camera.aspect = w / h;
    } else {
      const aspect = w / h;
      const halfH = (this.camera.top - this.camera.bottom) / 2;
      this.camera.left = -halfH * aspect;
      this.camera.right = halfH * aspect;
    }
    this.camera.updateProjectionMatrix();
  }

  _animate() {
    this._raf = requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Coalesce rebuilds into at most one per animation frame, regardless of how
   * many times it's scheduled in between (slider drag events, several
   * dependency changes in the same tick, a window pan + a param change
   * together, ...). This is what makes Parameter-driven fields and
   * setWindow() cheap to call from an input handler directly.
   */
  _schedule(fn) {
    this._pendingRebuilds.add(fn);
    if (this._rafScheduled) return;
    this._rafScheduled = true;
    requestAnimationFrame(() => {
      this._rafScheduled = false;
      const fns = [...this._pendingRebuilds];
      this._pendingRebuilds.clear();
      for (const f of fns) f();
    });
  }

  /**
   * Pan/resize the *sampling window* — independent of any field's own
   * mathematical domain. Representations re-bake against this window, not
   * against field.domain directly, so "panning" never redefines a field.
   */
  setWindow({ center, size } = {}) {
    if (center) this.window.center = center.slice();
    if (size) this.window.size = size.slice();
    this._syncWindowHelper();
    for (const rep of this.representations) rep.refresh();
  }

  _syncWindowHelper() {
    const [cx, cy, cz] = this.window.center;
    const [sx, sy, sz] = this.window.size;
    const box = new THREE.Box3(
      new THREE.Vector3(cx - sx / 2, cy - sy / 2, cz - (sz ?? sx) / 2),
      new THREE.Vector3(cx + sx / 2, cy + sy / 2, cz + (sz ?? sx) / 2)
    );
    this._windowHelper.box = box;
  }

  /** window as a Grid-compatible domain (3 spatial axes, [min,max] pairs). */
  _windowDomain() {
    const [cx, cy, cz] = this.window.center;
    const [sx, sy, sz] = this.window.size;
    return [[cx - sx / 2, cx + sx / 2], [cy - sy / 2, cy + sy / 2], [cz - (sz ?? sx) / 2, cz + (sz ?? sx) / 2]];
  }

  onProbe(cb) {
    this._probeCallbacks.push(cb);
    return () => { this._probeCallbacks = this._probeCallbacks.filter((f) => f !== cb); };
  }

  _handleClick(ev) {
    if (!this._probeTarget) return;
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1
    );
    this._raycaster.setFromCamera(pointer, this.camera);
    const hits = this._raycaster.intersectObject(this._probeTarget.mesh, false);
    if (hits.length === 0) return;
    const local = this._probeTarget.mesh.worldToLocal(hits[0].point.clone());
    const field = this._probeTarget.field;
    const point = field.domain.map((_, i) => (i === 0 ? local.x : i === 1 ? local.y : i === 2 ? local.z : 0));
    const value = field.at(point);
    for (const cb of this._probeCallbacks) cb({ point, value, shapeLabel: field.shapeLabel, field });
  }

  _setProbeTarget(field, size) {
    if (this._probeTarget) this.fieldGroup.remove(this._probeTarget.mesh);
    const geom = new THREE.BoxGeometry(size[0], size[1], size[2] ?? 0.01);
    const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ visible: false }));
    this.fieldGroup.add(mesh);
    this._probeTarget = { mesh, field };
  }

  // ---- representations ----

  /** Field or reactive handle -> current concrete Field, with guarded() applied (see Field.guarded). */
  _resolveField(fieldOrHandle) {
    const f = isReactiveHandle(fieldOrHandle) ? fieldOrHandle.current : fieldOrHandle;
    return f.guarded();
  }

  /** If fieldOrHandle is a reactive handle, re-run `onChange` (coalesced) whenever a dependency changes. Returns an unsubscribe function. */
  _watchReactive(fieldOrHandle, onChange) {
    if (!isReactiveHandle(fieldOrHandle)) return () => {};
    const unsubs = fieldOrHandle.deps.map((d) => d.onChange(() => this._schedule(onChange)));
    return () => { for (const u of unsubs) u(); };
  }

  /**
   * Isosurface for a scalar field. Bakes (async, non-blocking) into the
   * view's current window and raymarches the result.
   */
  addIsosurface(field, { resolution = 48, level = 0, color = 0x4fd1c5, autoRefresh = true } = {}) {
    let mesh = null, material = null, texture = null, disposed = false, refreshToken = 0;

    const buildGrid = () => new Grid({ domain: this._windowDomain(), resolution: [resolution, resolution, resolution] });

    const rebuild = async () => {
      const myToken = ++refreshToken;
      const current = this._resolveField(field);
      const grid = buildGrid();
      const values = await current.sampleAsync(grid, { frameBudgetMs: 8 });
      if (disposed || myToken !== refreshToken) return;
      if (mesh) { this.fieldGroup.remove(mesh); mesh.geometry.dispose(); material.dispose(); texture.dispose(); }

      const data = new Float32Array(values.length);
      data.set(values);
      texture = new THREE.Data3DTexture(data, resolution, resolution, resolution);
      texture.format = THREE.RedFormat;
      texture.type = THREE.FloatType;
      texture.minFilter = texture.magFilter = THREE.LinearFilter;
      texture.unpackAlignment = 1;
      texture.needsUpdate = true;

      const [dx, dy, dz] = this._windowDomain();
      const size = new THREE.Vector3(dx[1] - dx[0], dy[1] - dy[0], dz[1] - dz[0]);
      const center = new THREE.Vector3((dx[0] + dx[1]) / 2, (dy[0] + dy[1]) / 2, (dz[0] + dz[1]) / 2);
      const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
      const col = new THREE.Color(color);
      material = new THREE.ShaderMaterial({
        vertexShader: ISO_VERTEX,
        fragmentShader: ISO_FRAGMENT,
        uniforms: {
          uVoxels: { value: texture },
          uBoxMin: { value: new THREE.Vector3(-size.x / 2, -size.y / 2, -size.z / 2) },
          uBoxMax: { value: new THREE.Vector3(size.x / 2, size.y / 2, size.z / 2) },
          uIso: { value: level },
          uCameraObjPos: { value: new THREE.Vector3() },
          uColor: { value: new THREE.Vector3(col.r, col.g, col.b) },
        },
        side: THREE.BackSide,
        glslVersion: THREE.GLSL3,
      });
      mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(center);
      mesh.onBeforeRender = (_r, _s, camera) => {
        material.uniforms.uCameraObjPos.value.copy(mesh.worldToLocal(camera.position.clone()));
      };
      this.fieldGroup.add(mesh);
      this._setProbeTarget(current, this.window.size);
    };

    rebuild();
    const unwatch = this._watchReactive(field, rebuild);
    const handle = {
      setLevel(v) { level = v; if (material) material.uniforms.uIso.value = v; },
      refresh: () => { if (autoRefresh) this._schedule(rebuild); },
      dispose: () => { disposed = true; unwatch(); if (mesh) { this.fieldGroup.remove(mesh); mesh.geometry.dispose(); material.dispose(); texture.dispose(); } this.representations = this.representations.filter((r) => r !== handle); },
    };
    this.representations.push(handle);
    return handle;
  }

  /** Directional glyphs for a vector field, or principal-axis ellipsoids for a rank-2 tensor field. */
  addGlyphs(field, { countPerAxis = 6 } = {}) {
    let mesh = null, disposed = false;

    const rebuild = () => {
      const current = this._resolveField(field);
      if (mesh) { this.fieldGroup.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); }
      const domain = this._windowDomain().map((b) => ({ min: b[0], max: b[1] }));
      const grid = new Grid({ domain: domain.map((b) => [b.min, b.max]), resolution: new Array(3).fill(countPerAxis) });
      const points = [...grid].map((g) => g.point);

      if (current.shapeLabel === 'vector') {
        const geometry = new THREE.ConeGeometry(0.08, 0.32, 8);
        const material = new THREE.MeshStandardMaterial({ vertexColors: true });
        mesh = new THREE.InstancedMesh(geometry, material, points.length);
        const dummy = new THREE.Object3D();
        const colors = new Float32Array(points.length * 3);
        const vecs = points.map((p) => { const v = current.at(p); return [v[0] || 0, v[1] || 0, v[2] || 0]; });
        const maxMag = Math.max(1e-6, ...vecs.map((v) => Math.hypot(...v)));
        points.forEach((p, i) => {
          const v = vecs[i];
          const mag = Math.hypot(...v);
          const dir = mag > 1e-9 ? new THREE.Vector3(...v).normalize() : new THREE.Vector3(0, 1, 0);
          dummy.position.set(...p);
          dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          dummy.scale.setScalar(0.5 + 1.5 * (mag / maxMag));
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          const c = new THREE.Color().setHSL(0.55 - 0.55 * (mag / maxMag), 0.8, 0.55);
          colors.set([c.r, c.g, c.b], i * 3);
        });
        mesh.geometry.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 3));
        mesh.instanceMatrix.needsUpdate = true;
      } else if (current.shapeLabel === 'tensor') {
        const geometry = new THREE.SphereGeometry(0.14, 12, 8);
        const material = new THREE.MeshStandardMaterial({ vertexColors: true });
        mesh = new THREE.InstancedMesh(geometry, material, points.length);
        const dummy = new THREE.Object3D();
        const colors = new Float32Array(points.length * 3);
        const eigs = points.map((p) => jacobiEigen3(current.at(p)));
        const maxAbs = Math.max(1e-6, ...eigs.map((e) => Math.max(...e.values.map(Math.abs))));
        points.forEach((p, i) => {
          const { values, vectors } = eigs[i];
          dummy.position.set(...p);
          dummy.quaternion.setFromRotationMatrix(new THREE.Matrix4().setFromMatrix3(vectors));
          dummy.scale.set(...values.map((v) => 0.4 + 1.2 * Math.abs(v) / maxAbs));
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          const meanAbs = values.reduce((s, v) => s + Math.abs(v), 0) / 3;
          const c = new THREE.Color().setHSL(0.02 + 0.1 * (1 - meanAbs / maxAbs), 0.75, 0.5);
          colors.set([c.r, c.g, c.b], i * 3);
        });
        mesh.geometry.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 3));
        mesh.instanceMatrix.needsUpdate = true;
      } else {
        throw new Error('addGlyphs: field must be a vector or tensor field');
      }
      this.fieldGroup.add(mesh);
      this._setProbeTarget(current, this.window.size);
    };

    rebuild();
    const unwatch = this._watchReactive(field, rebuild);
    const handle = {
      refresh: () => this._schedule(rebuild),
      dispose: () => { disposed = true; unwatch(); if (mesh) { this.fieldGroup.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); } this.representations = this.representations.filter((r) => r !== handle); },
    };
    this.representations.push(handle);
    return handle;
  }

  /** Streamlines for a vector field: RK4 integration seeded within the window. */
  addStreamlines(field, { seeds = 40, steps = 120, dt = 0.05, color = 0x38bdf8 } = {}) {
    let lines = null, disposed = false;

    const evalVec = (current, p) => { const v = current.at(p); return new THREE.Vector3(v[0] || 0, v[1] || 0, v[2] || 0); };
    const rk4Step = (current, p, h) => {
      const k1 = evalVec(current, p);
      const k2 = evalVec(current, [p[0] + h / 2 * k1.x, p[1] + h / 2 * k1.y, p[2] + h / 2 * k1.z]);
      const k3 = evalVec(current, [p[0] + h / 2 * k2.x, p[1] + h / 2 * k2.y, p[2] + h / 2 * k2.z]);
      const k4 = evalVec(current, [p[0] + h * k3.x, p[1] + h * k3.y, p[2] + h * k3.z]);
      return [
        p[0] + (h / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
        p[1] + (h / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
        p[2] + (h / 6) * (k1.z + 2 * k2.z + 2 * k3.z + k4.z),
      ];
    };
    const inWindow = (p, dom) => p.every((v, i) => v >= dom[i][0] && v <= dom[i][1]);

    const rebuild = () => {
      const current = this._resolveField(field);
      if (current.shapeLabel !== 'vector') throw new Error('addStreamlines: field must be a vector field');
      if (lines) { this.fieldGroup.remove(lines); lines.geometry.dispose(); lines.material.dispose(); }
      const dom = this._windowDomain();
      const positions = [];
      for (let s = 0; s < seeds; s++) {
        let p = dom.map((b) => b[0] + Math.random() * (b[1] - b[0]));
        for (let i = 0; i < steps; i++) {
          const next = rk4Step(current, p, dt);
          if (!inWindow(next, dom)) break;
          positions.push(p[0], p[1], p[2], next[0], next[1], next[2]);
          p = next;
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const material = new THREE.LineBasicMaterial({ color });
      lines = new THREE.LineSegments(geometry, material);
      this.fieldGroup.add(lines);
      this._setProbeTarget(current, this.window.size);
    };

    rebuild();
    const unwatch = this._watchReactive(field, rebuild);
    const handle = {
      refresh: () => this._schedule(rebuild),
      dispose: () => { disposed = true; unwatch(); if (lines) { this.fieldGroup.remove(lines); lines.geometry.dispose(); lines.material.dispose(); } this.representations = this.representations.filter((r) => r !== handle); },
    };
    this.representations.push(handle);
    return handle;
  }

  /** 2D heatmap for a scalar field over a 2-axis domain (view should be created with dims:2). */
  addHeatmap(field, { resolution = 128, colormap = defaultColormap } = {}) {
    let mesh = null, texture = null, disposed = false, refreshToken = 0;

    const rebuild = async () => {
      const myToken = ++refreshToken;
      const current = this._resolveField(field);
      const [dx, dy] = this._windowDomain();
      const grid = new Grid({ domain: [[dx[0], dx[1]], [dy[0], dy[1]]], resolution: [resolution, resolution] });
      const values = await current.sampleAsync(grid, { frameBudgetMs: 8 });
      if (disposed || myToken !== refreshToken) return;
      if (mesh) { this.fieldGroup.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); texture.dispose(); }

      let min = Infinity, max = -Infinity;
      for (const v of values) { if (v < min) min = v; if (v > max) max = v; }
      const rgba = new Uint8Array(resolution * resolution * 4);
      for (let i = 0; i < values.length; i++) {
        const t = max > min ? (values[i] - min) / (max - min) : 0.5;
        const [r, g, b] = colormap(t);
        rgba.set([r, g, b, 255], i * 4);
      }
      texture = new THREE.DataTexture(rgba, resolution, resolution, THREE.RGBAFormat);
      texture.needsUpdate = true;
      texture.minFilter = texture.magFilter = THREE.LinearFilter;

      const geometry = new THREE.PlaneGeometry(dx[1] - dx[0], dy[1] - dy[0]);
      const material = new THREE.MeshBasicMaterial({ map: texture });
      mesh = new THREE.Mesh(geometry, material);
      mesh.position.set((dx[0] + dx[1]) / 2, (dy[0] + dy[1]) / 2, 0);
      this.fieldGroup.add(mesh);
      this._setProbeTarget(current, [dx[1] - dx[0], dy[1] - dy[0], 0.01]);
    };

    rebuild();
    const unwatch = this._watchReactive(field, rebuild);
    const handle = {
      refresh: () => this._schedule(rebuild),
      dispose: () => { disposed = true; unwatch(); if (mesh) { this.fieldGroup.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); texture.dispose(); } this.representations = this.representations.filter((r) => r !== handle); },
    };
    this.representations.push(handle);
    return handle;
  }

  removeRepresentation(handle) {
    handle.dispose();
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    this._resizeObserver.disconnect();
    for (const rep of [...this.representations]) rep.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.canvas);
  }
}

function defaultColormap(t) {
  // simple viridis-ish ramp
  const stops = [
    [13, 8, 135], [126, 3, 168], [204, 71, 120], [248, 149, 64], [240, 249, 33],
  ];
  const scaled = t * (stops.length - 1);
  const i = Math.min(Math.floor(scaled), stops.length - 2);
  const f = scaled - i;
  const a = stops[i], b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f].map(Math.round);
}

export function createView(container, opts) {
  return new View(container, opts);
}

// -----------------------------------------------------------------------------
// Presets — a few ready-made fields, purely as examples of the defineField API.
// -----------------------------------------------------------------------------

export const presets = {
  radial: (r0 = 1.5) => defineField({
    domain: [[-4, 4], [-4, 4], [-4, 4]],
    rankOut: [],
    label: 'radial',
    at: (p) => Math.hypot(p[0], p[1], p[2]) - r0,
  }),

  saddle: () => defineField({
    domain: [[-4, 4], [-4, 4], [-4, 4]],
    rankOut: [],
    label: 'saddle',
    at: (p) => p[0] * p[0] - p[1] * p[1] + 0.2 * p[2] * p[2],
  }),

  vortex: (strength = 1) => defineField({
    domain: [[-4, 4], [-4, 4], [-4, 4]],
    rankOut: [3],
    label: 'vortex',
    at: ([x, y, z]) => [-y * strength, x * strength, 0.15 * Math.sin(z)],
  }),

  dipole: (separation = 2) => defineField({
    domain: [[-4, 4], [-4, 4], [-4, 4]],
    rankOut: [3],
    label: 'dipole',
    at: (p) => {
      const src = (cx) => {
        const dx = p[0] - cx, dy = p[1], dz = p[2];
        const r3 = Math.pow(dx * dx + dy * dy + dz * dz + 0.05, 1.5);
        return [dx / r3, dy / r3, dz / r3];
      };
      const a = src(-separation / 2), b = src(separation / 2).map((v) => -v);
      return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    },
  }),

  stressTensor: () => defineField({
    domain: [[-4, 4], [-4, 4], [-4, 4]],
    rankOut: [3, 3],
    label: 'stressTensor',
    at: ([x, y, z]) => {
      const sxx = 2 + x * 0.3, syy = 1 - y * 0.2, szz = 0.5 + z * 0.1;
      const sxy = 0.6 * Math.sin(x * y * 0.2), sxz = 0.3 * Math.cos(z * 0.5), syz = 0.2 * Math.sin(y - z);
      return [[sxx, sxy, sxz], [sxy, syy, syz], [sxz, syz, szz]];
    },
  }),

  ripple2d: () => defineField({
    domain: [[-6, 6], [-6, 6]],
    rankOut: [],
    label: 'ripple2d',
    at: ([x, y]) => Math.sin(Math.hypot(x, y) * 1.5) / (1 + 0.3 * Math.hypot(x, y)),
  }),
};

/** von Mises stress: example of building a derived field from a tensor field with plain JS. */
export function vonMisesStress(stressField) {
  if (stressField.rankOut.length !== 2 || stressField.rankOut[0] !== 3 || stressField.rankOut[1] !== 3) {
    throw new Error('vonMisesStress: expected a 3x3 tensor field');
  }
  return stressField.map(
    (s) => {
      const [sxx, sxy, sxz] = s[0], [, syy, syz] = s[1], [, , szz] = s[2];
      const term = 0.5 * ((sxx - syy) ** 2 + (syy - szz) ** 2 + (szz - sxx) ** 2 + 6 * (sxy ** 2 + syz ** 2 + sxz ** 2));
      return Math.sqrt(Math.max(term, 0));
    },
    { rankOut: [], label: `vonMises(${stressField.label})` }
  );
}
