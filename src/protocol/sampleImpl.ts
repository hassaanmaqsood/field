import { Field, GridSpec } from './Field';

// BaseField.sample() needs bake() (algebra/bakeFit.ts), but bake() constructs
// a GridField, and GridField extends BaseField — a direct import from
// BaseField into bakeFit would be a 3-module cycle that breaks at class
// definition time (GridField would see `extends undefined`). This holder has
// no dependencies of its own, so both sides can depend on it without a cycle:
// bakeFit.ts registers the real implementation on load; BaseField calls
// whatever is registered by the time sample() is actually invoked.
let impl: ((field: Field, gridSpec: GridSpec) => Field) | null = null;

export function registerSampleImpl(fn: (field: Field, gridSpec: GridSpec) => Field): void {
  impl = fn;
}

export function runSample(field: Field, gridSpec: GridSpec): Field {
  if (!impl) {
    throw new Error('sample()/bake() implementation not loaded — import algebra/bakeFit.ts somewhere in the app entry point');
  }
  return impl(field, gridSpec);
}
