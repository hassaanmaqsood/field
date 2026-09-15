import { BaseField } from '../protocol/BaseField';
import {
  Bounds,
  Continuity,
  FieldValue,
  GradResult,
  Point,
  SerializedField,
  Shape,
} from '../protocol/Field';

export interface GridFieldData {
  domain: Bounds[]; // length m
  resolution: number[]; // length m, samples per axis (>= 2)
  rankOut: Shape;
  // flat row-major values; each cell holds rankOut-shaped data flattened too
  values: Float64Array;
  valueSize: number; // product(rankOut) or 1 for scalar
}

/**
 * Structured-grid discrete field. This is what sample()/bake() produces, and
 * the format an "imported dataset" (synthetic CSV/JSON grid) loads into.
 * Multilinear interpolation gives at() for any point in domain(); derivatives
 * fall back to the generic finite-difference estimate (flagged approximate),
 * satisfying the identical grad() contract analytic fields use.
 */
export class GridField extends BaseField {
  constructor(private data: GridFieldData) {
    super();
  }

  domain(): Bounds[] {
    return this.data.domain;
  }
  rankIn(): number {
    return this.data.domain.length;
  }
  rankOut(): Shape {
    return this.data.rankOut;
  }
  continuity(): Continuity {
    return 'discrete';
  }

  at(p: Point): FieldValue {
    const v = this.interpolate(p);
    if (this.data.valueSize === 1) return v[0];
    if (this.data.rankOut.length === 1) return v;
    const n = this.data.rankOut[0];
    const out: number[][] = [];
    for (let i = 0; i < n; i++) out.push(v.slice(i * n, i * n + n));
    return out;
  }

  private cellIndexAndFrac(p: Point): { idx0: number[]; frac: number[] } {
    const m = this.rankIn();
    const idx0: number[] = new Array(m);
    const frac: number[] = new Array(m);
    for (let d = 0; d < m; d++) {
      const { min, max } = this.data.domain[d];
      const res = this.data.resolution[d];
      const t = ((p[d] - min) / (max - min)) * (res - 1);
      const clamped = Math.min(Math.max(t, 0), res - 1 - 1e-9);
      idx0[d] = Math.floor(clamped);
      frac[d] = clamped - idx0[d];
    }
    return { idx0, frac };
  }

  private flatIndex(coords: number[]): number {
    const res = this.data.resolution;
    let idx = 0;
    let stride = 1;
    for (let d = res.length - 1; d >= 0; d--) {
      idx += coords[d] * stride;
      stride *= res[d];
    }
    return idx * this.data.valueSize;
  }

  /** Multilinear interpolation over the 2^m surrounding grid corners. */
  private interpolate(p: Point): number[] {
    const m = this.rankIn();
    const { idx0, frac } = this.cellIndexAndFrac(p);
    const size = this.data.valueSize;
    const out = new Array(size).fill(0);
    const corners = 1 << m;
    for (let c = 0; c < corners; c++) {
      let weight = 1;
      const coords: number[] = new Array(m);
      for (let d = 0; d < m; d++) {
        const bit = (c >> d) & 1;
        coords[d] = idx0[d] + bit;
        weight *= bit ? frac[d] : 1 - frac[d];
      }
      if (weight === 0) continue;
      const base = this.flatIndex(coords);
      for (let s = 0; s < size; s++) out[s] += weight * this.data.values[base + s];
    }
    return out;
  }

  grad(p: Point): GradResult {
    return super.grad(p);
  }

  /**
   * Exact analytic derivative of the multilinear interpolant itself (piecewise
   * linear, so the derivative is exact and constant within a cell). Used by
   * fit() (spec §4: "reconstruct an interpolated continuous field ... with
   * analytic derivatives") instead of the generic finite-difference fallback.
   */
  analyticGrad(p: Point): { jacobian: number[][]; valueSize: number } {
    const m = this.rankIn();
    const size = this.data.valueSize;
    const { idx0, frac } = this.cellIndexAndFrac(p);
    const jac: number[][] = Array.from({ length: size }, () => new Array(m).fill(0));
    const corners = 1 << m;
    for (let c = 0; c < corners; c++) {
      const coords: number[] = new Array(m);
      const bits: number[] = new Array(m);
      for (let d = 0; d < m; d++) {
        const bit = (c >> d) & 1;
        bits[d] = bit;
        coords[d] = idx0[d] + bit;
      }
      const base = this.flatIndex(coords);
      for (let k = 0; k < m; k++) {
        // d(weight_c)/d(frac_k)
        let dweight = bits[k] ? 1 : -1;
        for (let d = 0; d < m; d++) {
          if (d === k) continue;
          dweight *= bits[d] ? frac[d] : 1 - frac[d];
        }
        const { min, max } = this.data.domain[k];
        const dfracdp = (this.data.resolution[k] - 1) / (max - min);
        const chain = dweight * dfracdp;
        if (chain === 0) continue;
        for (let s = 0; s < size; s++) jac[s][k] += chain * this.data.values[base + s];
      }
    }
    return { jacobian: jac, valueSize: size };
  }

  serialize(): SerializedField {
    return {
      kind: 'grid',
      rankIn: this.rankIn(),
      rankOut: this.rankOut(),
      continuity: 'discrete',
      domain: this.domain(),
      payload: {
        resolution: this.data.resolution,
        valueSize: this.data.valueSize,
        values: Array.from(this.data.values),
      },
    };
  }

  static deserialize(s: SerializedField): GridField {
    const payload = s.payload as { resolution: number[]; valueSize: number; values: number[] };
    return new GridField({
      domain: s.domain,
      resolution: payload.resolution,
      rankOut: s.rankOut,
      values: Float64Array.from(payload.values),
      valueSize: payload.valueSize,
    });
  }
}
