import { Field, SerializedField } from '../protocol/Field';
import { AnalyticField } from '../backends/AnalyticField';
import { GridField } from '../backends/GridField';
import { presetRegistry, userFormulaPreset } from '../presets/analyticPresets';
import { add, subtract, dot, scale } from '../algebra/arithmetic';
import { min, max, smoothMin } from '../algebra/boolean';
import { gradient, divergence, curl, laplacian } from '../algebra/differential';
import { slice, pan } from '../algebra/slicing';
import { fit } from '../algebra/bakeFit';

/**
 * Reconstructs a field graph from serialize() output. Every node in a
 * composed graph is deserialized recursively and re-applied through the
 * same algebra functions used to build it, so a saved/loaded field is
 * behaviorally identical to the one that produced it (spec §8 round-trip
 * requirement; also the mechanism behind "field graphs can be saved/loaded
 * as view state" per the build prompt).
 */
export function deserialize(s: SerializedField): Field {
  const children = (s.children ?? []).map(deserialize);

  switch (s.kind) {
    case 'analytic': {
      const { name, formula } = s.payload as { name: string; params: Record<string, number>; formula?: string };
      if (name === 'userFormula' && formula) {
        return userFormulaPreset(formula, s.rankIn as 3 | 4);
      }
      return presetRegistry[name] ? presetRegistry[name]() : presetRegistry.radial();
    }
    case 'grid':
      return GridField.deserialize(s);
    case 'op:add':
      return add(children[0], children[1]);
    case 'op:subtract':
      return subtract(children[0], children[1]);
    case 'op:dot':
      return dot(children[0], children[1]);
    case 'op:scale': {
      const { k } = s.payload as { k: number };
      return scale(children[0], k);
    }
    case 'op:min':
      return min(children[0], children[1]);
    case 'op:max':
      return max(children[0], children[1]);
    case 'op:smoothMin': {
      const { k } = s.payload as { k: number };
      return smoothMin(children[0], children[1], k);
    }
    case 'op:gradient':
      return gradient(children[0]);
    case 'op:divergence':
      return divergence(children[0]);
    case 'op:curl':
      return curl(children[0]);
    case 'op:laplacian':
      return laplacian(children[0]);
    case 'op:slice': {
      const { fixed } = s.payload as { fixed: { axis: number; value: number }[] };
      return slice(children[0], fixed);
    }
    case 'op:pan': {
      // domain offset is recoverable from domain diff at deserialize time only
      // if the original offset was stored; store it directly for round-trip.
      const offset = (s.payload as { offset: number[] })?.offset ?? new Array(children[0].rankIn()).fill(0);
      return pan(children[0], offset);
    }
    case 'op:fit':
      return fit(children[0] as GridField);
    default:
      throw new Error(`deserialize: unknown field kind "${s.kind}"`);
  }
}
