import { describe, expect, it } from 'vitest';
import { radialPreset, stressTensorPreset } from '../src/presets/analyticPresets';
import { gradient } from '../src/algebra/differential';
import { vonMisesStress } from '../src/plugins/mechanical';
import { asNumberArray, asScalar, shapeLabel } from '../src/protocol/Field';

describe('end-to-end pipelines', () => {
  it('analytic scalar field -> gradient -> vector field, zero manual conversion', () => {
    const scalar = radialPreset();
    const vector = gradient(scalar);
    expect(shapeLabel(vector.rankOut())).toBe('vector');
    const p = [1, 0.5, -0.3];
    const v = asNumberArray(vector.at(p));
    expect(v.length).toBe(3);
    // gradient of |p|-r0 should point radially outward: grad = p/|p|
    const norm = Math.hypot(...p);
    expect(v[0]).toBeCloseTo(p[0] / norm, 2);
  });

  it('tensor field -> von Mises derived scalar -> renderable, zero manual conversion', () => {
    const stress = stressTensorPreset();
    const vm = vonMisesStress(stress);
    expect(shapeLabel(vm.rankOut())).toBe('scalar');
    const p = [0.5, -0.2, 1.0];
    const value = asScalar(vm.at(p));
    expect(value).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(value)).toBe(true);
  });
});
