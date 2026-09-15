import { describe, expect, it } from 'vitest';
import { radialPreset, saddlePreset, vortexPreset } from '../src/presets/analyticPresets';
import { asNumberArray, Field } from '../src/protocol/Field';

function centeredFD(field: Field, p: number[], h = 1e-4): number[] | number[][] {
  const m = field.rankIn();
  const shape = field.rankOut();
  if (shape.length === 0) {
    const out: number[] = [];
    for (let i = 0; i < m; i++) {
      const pp = p.slice(); pp[i] += h;
      const pm = p.slice(); pm[i] -= h;
      out.push(((field.at(pp) as number) - (field.at(pm) as number)) / (2 * h));
    }
    return out;
  }
  const n = shape[0];
  const jac: number[][] = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < m; i++) {
    const pp = p.slice(); pp[i] += h;
    const pm = p.slice(); pm[i] -= h;
    const fp = asNumberArray(field.at(pp));
    const fm = asNumberArray(field.at(pm));
    for (let j = 0; j < n; j++) jac[j][i] = (fp[j] - fm[j]) / (2 * h);
  }
  return jac;
}

describe('gradient correctness vs. centered finite difference', () => {
  const cases: Field[] = [radialPreset(), saddlePreset(), vortexPreset()];

  for (const field of cases) {
    it(`grad() matches finite-difference estimate (rankOut=[${field.rankOut()}])`, () => {
      for (let i = 0; i < 20; i++) {
        const p = field.domain().map((b) => b.min + 0.6 * (b.max - b.min) * (0.2 + 0.6 * Math.random()));
        const g = field.grad(p).value;
        const fd = centeredFD(field, p);
        const flat = (Array.isArray(g[0]) ? (g as number[][]).flat() : (g as number[]));
        const flatFd = (Array.isArray(fd[0]) ? (fd as number[][]).flat() : (fd as number[]));
        for (let k = 0; k < flat.length; k++) {
          expect(flat[k]).toBeCloseTo(flatFd[k], 2);
        }
      }
    });
  }
});
