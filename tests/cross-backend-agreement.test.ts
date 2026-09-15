import { describe, expect, it } from 'vitest';
import { radialPreset } from '../src/presets/analyticPresets';
import { bake } from '../src/algebra/bakeFit';
import { asScalar } from '../src/protocol/Field';

describe('cross-backend agreement (grid-convergence style)', () => {
  const analytic = radialPreset();
  const testPoints = Array.from({ length: 15 }, () => analytic.domain().map((b) => b.min + Math.random() * (b.max - b.min)));

  function maxError(resolution: number): number {
    const baked = bake(analytic, { resolution: [resolution, resolution, resolution] });
    let maxErr = 0;
    for (const p of testPoints) {
      const err = Math.abs(asScalar(analytic.at(p)) - asScalar(baked.at(p)));
      maxErr = Math.max(maxErr, err);
    }
    return maxErr;
  }

  it('baked field error shrinks as bake resolution increases', () => {
    const errLow = maxError(12);
    const errMid = maxError(24);
    const errHigh = maxError(48);
    expect(errMid).toBeLessThanOrEqual(errLow + 1e-9);
    expect(errHigh).toBeLessThanOrEqual(errMid + 1e-9);
  });

  it('error at high resolution is small in absolute terms', () => {
    expect(maxError(64)).toBeLessThan(0.05);
  });
});
