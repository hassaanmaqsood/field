import { describe, expect, it } from 'vitest';
import { Grid } from '../src/backends/Grid';
import { guarded, boundsDistance, containsPoint } from '../src/algebra/guarded';
import { rotate2D, mirror } from '../src/algebra/slicing';
import { finiteDifferenceGrad } from '../src/algebra/differential';
import { presetRegistry } from '../src/presets/analyticPresets';
import {
  INK_STEPS,
  INK_RGB,
  HALFTONE_RADII_20,
  ISOLINE_LEVELS,
  ASCII_RAMP,
  quantizeTone,
  quantizeToneRGB,
  quantizeDotRadius,
} from '../src/render/tokens';
import { parseConfig } from '../src/ui/parser';

describe('Discrete Token Architecture — Tokens & Quantization', () => {
  it('has canonical 6-step ink palette and matching RGB triplets', () => {
    expect(INK_STEPS).toHaveLength(6);
    expect(INK_STEPS[0]).toBe('#0D0D0E');
    expect(INK_STEPS[5]).toBe('#D8D6CE');
    expect(INK_RGB).toHaveLength(6);
    expect(INK_RGB[0]).toEqual([13, 13, 14]);
    expect(INK_RGB[5]).toEqual([216, 214, 206]);
  });

  it('quantizes normalized values into discrete ink steps and RGBs', () => {
    expect(quantizeTone(0)).toBe('#0D0D0E');
    expect(quantizeTone(0.05)).toBe('#0D0D0E');
    expect(quantizeTone(0.99)).toBe('#D8D6CE');
    expect(quantizeTone(1.0)).toBe('#D8D6CE');

    expect(quantizeToneRGB(0)).toEqual([13, 13, 14]);
    expect(quantizeToneRGB(1.0)).toEqual([216, 214, 206]);
  });

  it('has 20-tier halftone radii between 1.0 and 10.0', () => {
    expect(HALFTONE_RADII_20).toHaveLength(20);
    expect(HALFTONE_RADII_20[0]).toBe(1.0);
    expect(HALFTONE_RADII_20[19]).toBe(10.0);
    expect(quantizeDotRadius(0)).toBe(1.0);
    expect(quantizeDotRadius(1.0)).toBe(10.0);
  });

  it('has 5 canonical isoline levels and 10-char ASCII ramp', () => {
    expect(ISOLINE_LEVELS).toEqual([0.16, 0.33, 0.50, 0.66, 0.83]);
    expect(ASCII_RAMP).toBe(' .:-=+*#%@');
  });
});

describe('Discrete Token Architecture — N-dimensional Grid', () => {
  it('correctly maps coords to world points and round-trips via fromWorld', () => {
    const grid = new Grid({
      domain: [
        { min: -4, max: 4 },
        { min: 0, max: 10 },
      ],
      resolution: [5, 11],
    });

    expect(grid.rank).toBe(2);
    expect(grid.totalPoints).toBe(55);

    // Min corner (0, 0)
    expect(grid.toWorld([0, 0])).toEqual([-4, 0]);
    // Max corner (4, 10)
    expect(grid.toWorld([4, 10])).toEqual([4, 10]);

    // Center cell (2, 5)
    expect(grid.toWorld([2, 5])).toEqual([0, 5]);

    // fromWorld on exact point
    const { idx, frac } = grid.fromWorld([0, 5]);
    expect(idx).toEqual([2, 5]);
    expect(frac[0]).toBeCloseTo(0, 5);
    expect(frac[1]).toBeCloseTo(0, 5);
  });

  it('computes flat row-major indices and inverse coordsAt', () => {
    const grid = new Grid({
      domain: [
        { min: -1, max: 1 },
        { min: -1, max: 1 },
        { min: -1, max: 1 },
      ],
      resolution: [3, 4, 5],
    });

    expect(grid.totalPoints).toBe(60);

    for (let flat = 0; flat < grid.totalPoints; flat++) {
      const coords = grid.coordsAt(flat);
      expect(grid.flatIndex(coords)).toBe(flat);
    }
  });

  it('iterates through all coordinates with iterCoords without allocation', () => {
    const grid = new Grid({
      domain: [
        { min: 0, max: 1 },
        { min: 0, max: 1 },
      ],
      resolution: [3, 3],
    });

    let count = 0;
    const visited: string[] = [];
    grid.iterCoords((coords, flat) => {
      expect(flat).toBe(count);
      visited.push(`${coords[0]},${coords[1]}`);
      count++;
    });

    expect(count).toBe(9);
    expect(visited[0]).toBe('0,0');
    expect(visited[8]).toBe('2,2');
  });
});

describe('Discrete Token Architecture — Guarded SDF & Algebra', () => {
  it('guarded field evaluates normally inside domain and returns distance outside', () => {
    const field = presetRegistry.radial(); // domain [-4:4]^3, value = sqrt(x^2+y^2+z^2) - 1.5
    const guardedField = guarded(field);

    // Inside domain point (0, 0, 0)
    expect(guardedField.at([0, 0, 0])).toBeCloseTo(-1.5, 4);

    // Outside point (6, 0, 0) -> distance to box [max is 4] is 2.0
    const outVal = guardedField.at([6, 0, 0]) as number;
    expect(outVal).toBeCloseTo(2.0, 4);
  });

  it('rotate2D rotates coordinates and recomputes tight bounds', () => {
    const field = presetRegistry.radial();
    const rotated = rotate2D(field, 0, 1, Math.PI / 2); // 90 degree rotation in XY

    expect(rotated.rankIn()).toBe(3);
    const bounds = rotated.domain();
    expect(bounds).toHaveLength(3);
    // Rotating square domain [-4, 4] by 90 degrees keeps extent [-4, 4]
    expect(bounds[0].min).toBeCloseTo(-4, 3);
    expect(bounds[0].max).toBeCloseTo(4, 3);
  });

  it('mirror reflects coordinates across plane', () => {
    const field = presetRegistry.radial();
    const mirrored = mirror(field, 0, 0); // mirror X across 0

    expect(mirrored.at([2, 1, 0])).toBeCloseTo(field.at([-2, 1, 0]) as number, 4);
  });

  it('finiteDifferenceGrad computes numerical gradient', () => {
    // fn(x, y) = x^2 + 3*y
    // grad at (2, 1) = [2*x, 3] = [4, 3]
    const grad = finiteDifferenceGrad((p) => p[0] * p[0] + 3 * p[1], [2, 1]);
    expect(grad[0]).toBeCloseTo(4.0, 3);
    expect(grad[1]).toBeCloseTo(3.0, 3);
  });
});

describe('Discrete Token Architecture — DSL Parser Extensions', () => {
  it('parses all new discrete view containers and parameters', () => {
    const code = `
field {
  expr: x*x + y*y - 1
  domain: x[-3:3] y[-3:3]
}
ops {
  rotate2D { a0: 0 a1: 1 angle: 0.785 }
  mirror { axis: 0 value: 0 }
  guarded
}
view {
  density { cellSize: 12 tiers: 20 }
  bands { res: 64 }
  isolines { res: 100 }
  height { res: 32 heightScale: 3.0 }
  terraces { res: 48 heightScale: 2.0 tiers: 6 }
  shells { shells: [-0.5, 0.0, 0.5] res: 64 }
  ascii { cols: 80 rows: 30 fps: 24 }
}
sample {
  box: x[-3:3] y[-3:3] z[-3:3]
  res: 48
}`;

    const config = parseConfig(code);
    expect(config.pipelines).toHaveLength(1);
    const p = config.pipelines[0];

    // Check ops
    expect(p.ops).toHaveLength(3);
    expect(p.ops[0].kind).toBe('rotate2D');
    expect(p.ops[0].angle).toBeCloseTo(0.785);
    expect(p.ops[1].kind).toBe('mirror');
    expect(p.ops[2].kind).toBe('guarded');

    // Check view layers
    expect(p.view).toHaveLength(7);
    expect(p.view[0].kind).toBe('density');
    expect(p.view[0].cellSize).toBe(12);
    expect(p.view[0].tiers).toBe(20);

    expect(p.view[1].kind).toBe('bands');
    expect(p.view[1].res).toBe(64);

    expect(p.view[2].kind).toBe('isolines');
    expect(p.view[2].res).toBe(100);

    expect(p.view[3].kind).toBe('height');
    expect(p.view[3].res).toBe(32);
    expect(p.view[3].heightScale).toBe(3.0);

    expect(p.view[4].kind).toBe('terraces');
    expect(p.view[4].res).toBe(48);
    expect(p.view[4].heightScale).toBe(2.0);
    expect(p.view[4].tiers).toBe(6);

    expect(p.view[5].kind).toBe('shells');
    expect(p.view[5].shells).toEqual([-0.5, 0.0, 0.5]);
    expect(p.view[5].res).toBe(64);

    expect(p.view[6].kind).toBe('ascii');
    expect(p.view[6].cols).toBe(80);
    expect(p.view[6].rows).toBe(30);
    expect(p.view[6].fps).toBe(24);
  });
});
