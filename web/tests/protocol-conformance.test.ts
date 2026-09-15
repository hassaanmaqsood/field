import { describe, expect, it } from 'vitest';
import { radialPreset, vortexPreset } from '../src/presets/analyticPresets';
import { loadSyntheticDatasetExample } from '../src/presets/syntheticDataset';
import { bake } from '../src/algebra/bakeFit';
import { deserialize } from '../src/serialize/deserialize';
import { Field } from '../src/protocol/Field';

function randomPointIn(field: Field): number[] {
  return field.domain().map((b) => b.min + Math.random() * (b.max - b.min));
}

describe('protocol conformance', () => {
  const backends: [string, Field][] = [
    ['analytic scalar', radialPreset()],
    ['analytic vector', vortexPreset()],
    ['discrete (baked) scalar', bake(radialPreset(), { resolution: [20, 20, 20] })],
    ['discrete (imported dataset) scalar', loadSyntheticDatasetExample()],
  ];

  for (const [name, field] of backends) {
    it(`${name}: at() is defined across domain()`, () => {
      for (let i = 0; i < 25; i++) {
        const p = randomPointIn(field);
        const v = field.at(p);
        expect(v).toBeDefined();
      }
    });

    it(`${name}: rankIn/rankOut match construction`, () => {
      expect(field.rankIn()).toBe(field.domain().length);
      expect(Array.isArray(field.rankOut())).toBe(true);
    });

    it(`${name}: serialize()/deserialize round-trips`, () => {
      const s = field.serialize();
      const restored = deserialize(s);
      expect(restored.rankIn()).toBe(field.rankIn());
      expect(restored.rankOut()).toEqual(field.rankOut());
      const p = randomPointIn(field);
      expect(restored.at(p)).toEqual(field.at(p));
    });
  }
});
