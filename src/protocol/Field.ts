// Field Protocol — spec §8.
// This is the one contract every backend, every algebra operator, and every
// render/UI consumer is written against. Nothing above the Backend layer may
// assume domain rank, codomain shape, or continuity class (spec §6.3).

export type Point = number[]; // length m, m = rankIn()
export type Shape = number[]; // [] scalar | [n] vector | [n,n] tensor
export type FieldValue = number | number[] | number[][];
export type Continuity = 'analytic' | 'autodiff' | 'discrete';

export interface Bounds {
  min: number;
  max: number;
}

/** Result of grad(). approximate=true means "numerical fallback", per §8. */
export interface GradResult {
  // Jacobian of at() w.r.t. p, in the natural shape for rankOut():
  //  scalar field  -> vector of length m           (the gradient)
  //  vector field  -> [n][m] matrix                 (the Jacobian)
  //  tensor field  -> not required for this milestone
  value: number[] | number[][];
  approximate: boolean;
}

export interface GridSpec {
  // per-dimension sample counts, in domain order, length m
  resolution: number[];
}

export interface SerializedField {
  kind: string; // backend/operator tag, e.g. "analytic", "grid", "op:add"
  rankIn: number;
  rankOut: Shape;
  continuity: Continuity;
  domain: Bounds[];
  // backend/operator-specific payload; children fields are serialized recursively
  payload: unknown;
  children?: SerializedField[];
}

export interface Field {
  domain(): Bounds[];
  rankIn(): number;
  rankOut(): Shape;
  continuity(): Continuity;

  /** The one required, pure, point-query operation. Must be defined for every p in domain(). */
  at(p: Point): FieldValue;

  /** Exact derivative where available; flagged numerical fallback otherwise. */
  grad(p: Point): GradResult;

  /** General composition mechanism (spec §2.3) — every built-in operator is an instance of this. */
  compose(op: string, ...others: Field[]): Field;

  /** Bake: sample this field over a grid, producing a discrete field. */
  sample(gridSpec: GridSpec): Field;

  serialize(): SerializedField;
}

export function shapeEquals(a: Shape, b: Shape): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function shapeLabel(shape: Shape): 'scalar' | 'vector' | 'tensor' {
  if (shape.length === 0) return 'scalar';
  if (shape.length === 1) return 'vector';
  return 'tensor';
}

export class FieldTypeError extends Error {
  constructor(message: string) {
    super(`[FieldTypeError] ${message}`);
    this.name = 'FieldTypeError';
  }
}

export function assertSameCodomain(a: Field, b: Field, op: string): void {
  if (!shapeEquals(a.rankOut(), b.rankOut())) {
    throw new FieldTypeError(
      `${op}: codomain shape mismatch — [${a.rankOut()}] vs [${b.rankOut()}]`
    );
  }
}

export function assertSameDomainRank(a: Field, b: Field, op: string): void {
  if (a.rankIn() !== b.rankIn()) {
    throw new FieldTypeError(
      `${op}: domain rank mismatch — ${a.rankIn()} vs ${b.rankIn()}`
    );
  }
}

export function assertScalar(f: Field, op: string): void {
  if (f.rankOut().length !== 0) {
    throw new FieldTypeError(`${op}: expected a scalar field, got shape [${f.rankOut()}]`);
  }
}

export function assertVector(f: Field, op: string, n?: number): void {
  if (f.rankOut().length !== 1 || (n !== undefined && f.rankOut()[0] !== n)) {
    throw new FieldTypeError(
      `${op}: expected a vector field${n ? ` of length ${n}` : ''}, got shape [${f.rankOut()}]`
    );
  }
}

export function asNumberArray(v: FieldValue): number[] {
  if (typeof v === 'number') return [v];
  if (Array.isArray(v) && typeof v[0] === 'number') return v as number[];
  throw new FieldTypeError('expected scalar or vector value');
}

export function asScalar(v: FieldValue): number {
  if (typeof v === 'number') return v;
  throw new FieldTypeError('expected scalar value');
}

export function asTensor(v: FieldValue): number[][] {
  if (Array.isArray(v) && Array.isArray(v[0])) return v as number[][];
  throw new FieldTypeError('expected tensor value');
}
