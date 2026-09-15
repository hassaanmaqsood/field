import { describe, expect, it } from 'vitest';
import { radialPreset, saddlePreset } from '../src/presets/analyticPresets';
import { min, max } from '../src/algebra/boolean';
import { add } from '../src/algebra/arithmetic';
import { gradient } from '../src/algebra/differential';
import { asScalar, Field } from '../src/protocol/Field';

function randomPoints(field: Field, n: number): number[][] {
  return Array.from({ length: n }, () => field.domain().map((b) => b.min + Math.random() * (b.max - b.min)));
}

describe('algebraic laws (property-based over randomized points)', () => {
  const f1 = radialPreset();
  const f2 = saddlePreset();

  it('min/max composition is commutative', () => {
    const minAB = min(f1, f2);
    const minBA = min(f2, f1);
    const maxAB = max(f1, f2);
    const maxBA = max(f2, f1);
    for (const p of randomPoints(f1, 40)) {
      expect(asScalar(minAB.at(p))).toBeCloseTo(asScalar(minBA.at(p)), 10);
      expect(asScalar(maxAB.at(p))).toBeCloseTo(asScalar(maxBA.at(p)), 10);
    }
  });

  it('grad(F1 + F2) === grad(F1) + grad(F2) within tolerance', () => {
    const sum = add(f1, f2);
    const gradSum = gradient(sum);
    const gradF1 = gradient(f1);
    const gradF2 = gradient(f2);
    for (const p of randomPoints(f1, 30)) {
      const gs = gradSum.at(p) as number[];
      const g1 = gradF1.at(p) as number[];
      const g2 = gradF2.at(p) as number[];
      for (let i = 0; i < gs.length; i++) {
        expect(gs[i]).toBeCloseTo(g1[i] + g2[i], 3);
      }
    }
  });
});
