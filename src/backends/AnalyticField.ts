import { BaseField } from '../protocol/BaseField';
import { Bounds, Continuity, FieldValue, Point, SerializedField, Shape } from '../protocol/Field';

export interface AnalyticFieldSpec {
  name: string; // preset id, for serialization round-trip via the preset registry
  domain: Bounds[];
  rankIn: number;
  rankOut: Shape;
  fn: (p: Point) => FieldValue;
  params?: Record<string, number>;
  formula?: string; // present only for user-defined formula fields
}

/**
 * Closed-form backend. `fn` is the ground-truth math; exact at() always,
 * and grad() defaults to the shared finite-difference fallback unless a
 * preset supplies an exact derivative (see presets/analyticPresets.ts).
 */
export class AnalyticField extends BaseField {
  constructor(private spec: AnalyticFieldSpec) {
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
    return 'analytic';
  }
  at(p: Point): FieldValue {
    return this.spec.fn(p);
  }

  serialize(): SerializedField {
    return {
      kind: 'analytic',
      rankIn: this.rankIn(),
      rankOut: this.rankOut(),
      continuity: 'analytic',
      domain: this.domain(),
      payload: { name: this.spec.name, params: this.spec.params ?? {}, formula: this.spec.formula },
    };
  }
}
