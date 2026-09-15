import { Field } from '../protocol/Field';

export type OperatorFn = (self: Field, ...others: Field[]) => Field;

/**
 * Every built-in algebra operator registers itself here under a name.
 * Field.compose(op, ...others) is purely a lookup + call into this table —
 * this is what makes compose() "the general mechanism every built-in
 * operator is implemented through" (spec §2.3) rather than a parallel
 * bespoke code path per operator.
 */
export const operatorRegistry = new Map<string, OperatorFn>();

export function registerOperator(name: string, fn: OperatorFn): void {
  operatorRegistry.set(name, fn);
}
