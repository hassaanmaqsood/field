import { Field, asTensor } from '../protocol/Field';
import { ComposedField } from '../algebra/ComposedField';

/**
 * Discipline plugin example (spec §5, §12): "a discipline plugin can be added
 * without modifying the Field Protocol, Compute Engine, or Render Engine."
 * von Mises stress is a derived scalar field, built purely by consuming a
 * rank-2 stress-tensor field through the ordinary Field interface — nothing
 * here touches protocol, algebra, or render code.
 */
export function vonMisesStress(stressField: Field): Field {
  if (stressField.rankOut().length !== 2 || stressField.rankOut()[0] !== 3 || stressField.rankOut()[1] !== 3) {
    throw new Error('vonMisesStress: expected a 3x3 tensor field');
  }
  return new ComposedField({
    kind: 'plugin:mechanical:vonMises',
    domain: stressField.domain(),
    rankIn: stressField.rankIn(),
    rankOut: [],
    continuity: stressField.continuity() === 'discrete' ? 'discrete' : 'analytic',
    at: (p) => {
      const s = asTensor(stressField.at(p));
      const [sxx, sxy, sxz] = s[0];
      const [, syy, syz] = s[1];
      const [, , szz] = s[2];
      const term =
        0.5 *
        ((sxx - syy) ** 2 + (syy - szz) ** 2 + (szz - sxx) ** 2 + 6 * (sxy ** 2 + syz ** 2 + sxz ** 2));
      return Math.sqrt(Math.max(term, 0));
    },
    children: [stressField.serialize()],
  });
}
