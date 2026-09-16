import { Bounds, Point } from '../protocol/Field';

export interface GridOptions {
  domain: Bounds[] | [number, number][];
  resolution: number[];
}

/**
 * N-dimensional Grid abstraction.
 * Handles row-major multi-index strides, coordinate mapping, and iteration
 * across arbitrary dimension counts.
 */
export class Grid {
  readonly domain: Bounds[];
  readonly resolution: number[];
  readonly rank: number;
  readonly totalPoints: number;

  constructor(opts: GridOptions) {
    if (opts.domain.length !== opts.resolution.length) {
      throw new Error(
        `Grid: domain (${opts.domain.length}D) and resolution (${opts.resolution.length}D) length mismatch`
      );
    }
    this.domain = opts.domain.map((d) =>
      Array.isArray(d) ? { min: d[0], max: d[1] } : { min: d.min, max: d.max }
    );
    this.resolution = opts.resolution.slice();
    this.rank = this.domain.length;
    this.totalPoints = this.resolution.reduce((a, b) => a * b, 1);
  }

  /**
   * World coordinate point at integer grid coordinates (one index per axis).
   */
  toWorld(coords: number[]): Point {
    return coords.map((c, d) => {
      const { min, max } = this.domain[d];
      const res = this.resolution[d];
      return res === 1 ? min : min + (c / (res - 1)) * (max - min);
    });
  }

  /**
   * Alias for toWorld() for compatibility with field-viz.js.
   */
  pointAt(coords: number[]): Point {
    return this.toWorld(coords);
  }

  /**
   * Maps world point p to integer cell base index and fractional offset [0, 1).
   */
  fromWorld(p: Point): { idx: number[]; frac: number[] } {
    const idx: number[] = new Array(this.rank);
    const frac: number[] = new Array(this.rank);
    for (let d = 0; d < this.rank; d++) {
      const { min, max } = this.domain[d];
      const res = this.resolution[d];
      const span = max - min;
      const t = span === 0 ? 0 : ((p[d] - min) / span) * (res - 1);
      const clamped = Math.min(Math.max(t, 0), res - 1 - 1e-9);
      idx[d] = Math.floor(clamped);
      frac[d] = clamped - idx[d];
    }
    return { idx, frac };
  }

  /**
   * Flat row-major index from integer grid coordinates.
   */
  flatIndex(coords: number[]): number {
    let idx = 0;
    let stride = 1;
    for (let d = this.rank - 1; d >= 0; d--) {
      idx += coords[d] * stride;
      stride *= this.resolution[d];
    }
    return idx;
  }

  /**
   * Integer grid coordinates from a flat row-major index.
   */
  coordsAt(flat: number): number[] {
    const coords = new Array<number>(this.rank);
    let rem = flat;
    const strides = new Array<number>(this.rank);
    strides[this.rank - 1] = 1;
    for (let d = this.rank - 2; d >= 0; d--) {
      strides[d] = strides[d + 1] * this.resolution[d + 1];
    }
    for (let d = 0; d < this.rank; d++) {
      coords[d] = Math.floor(rem / strides[d]);
      rem %= strides[d];
    }
    return coords;
  }

  /**
   * High-performance in-place iteration without per-cell array allocations.
   */
  iterCoords(cb: (coords: number[], flat: number) => void): void {
    const coords = new Array<number>(this.rank).fill(0);
    const res = this.resolution;
    const rank = this.rank;
    const total = this.totalPoints;

    for (let flat = 0; flat < total; flat++) {
      cb(coords, flat);

      // Increment multi-index in row-major order (least significant axis first)
      for (let d = rank - 1; d >= 0; d--) {
        coords[d]++;
        if (coords[d] < res[d] || d === 0) {
          break;
        }
        coords[d] = 0;
      }
    }
  }

  /**
   * Generator for iterating over every grid point with { coords, point, flat }.
   */
  *[Symbol.iterator](): Generator<{ coords: number[]; point: Point; flat: number }> {
    for (let flat = 0; flat < this.totalPoints; flat++) {
      const coords = this.coordsAt(flat);
      yield { coords, point: this.toWorld(coords), flat };
    }
  }
}

export function createGrid(opts: GridOptions): Grid {
  return new Grid(opts);
}
