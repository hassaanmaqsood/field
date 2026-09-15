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

export interface ComposedFieldSpec {
  kind: string; // serialization tag, e.g. "op:add"
  domain: Bounds[];
  rankIn: number;
  rankOut: Shape;
  continuity: Continuity;
  at: (p: Point) => FieldValue;
  grad?: (p: Point) => GradResult; // omit to use the generic finite-difference fallback
  payload?: unknown;
  children?: SerializedField[];
}

/**
 * Every algebra operator (arithmetic, boolean, differential, slicing, ...)
 * returns one of these. It satisfies the Field Protocol identically to a
 * primitive backend (spec §2.3 closure) — nothing downstream can tell the
 * difference except via continuity().
 */
export class ComposedField extends BaseField {
  constructor(private spec: ComposedFieldSpec) {
    super();
  }

  domain(): Bounds[] {
    return this.spec.domain;
  }
  rankIn(): number {
    return this.spec.rankIn;
  }
  rankOut(): Shape {
    return this.spec.rankOut;
  }
  continuity(): Continuity {
    return this.spec.continuity;
  }
  at(p: Point): FieldValue {
    return this.spec.at(p);
  }
  grad(p: Point): GradResult {
    return this.spec.grad ? this.spec.grad(p) : super.grad(p);
  }
  serialize(): SerializedField {
    return {
      kind: this.spec.kind,
      rankIn: this.spec.rankIn,
      rankOut: this.spec.rankOut,
      continuity: this.spec.continuity,
      domain: this.spec.domain,
      payload: this.spec.payload ?? null,
      children: this.spec.children,
    };
  }
}
