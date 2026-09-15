/**
 * Web Worker: receives a SerializedField + box bounds + resolution,
 * reconstructs the field, bakes it to a Float32Array, posts progress and
 * the final buffer back.
 */
import { SerializedField, asScalar } from '../protocol/Field';
import { deserialize } from '../serialize/deserialize';

interface ComputeRequest {
  type: 'compute';
  fieldSpec: SerializedField;
  box: { min: number; max: number }[];
  resolution: number;
}

self.addEventListener('message', (ev: MessageEvent<ComputeRequest>) => {
  const { type, fieldSpec, box, resolution } = ev.data;
  if (type !== 'compute') return;

  try {
    const field = deserialize(fieldSpec);
    const res = resolution;
    const [bx, by, bz] = box;
    const total = res * res * res;
    const data = new Float32Array(total);

    let i = 0;
    for (let zi = 0; zi < res; zi++) {
      const z = bz.min + (zi / (res - 1)) * (bz.max - bz.min);
      for (let yi = 0; yi < res; yi++) {
        const y = by.min + (yi / (res - 1)) * (by.max - by.min);
        for (let xi = 0; xi < res; xi++) {
          const x = bx.min + (xi / (res - 1)) * (bx.max - bx.min);
          try { data[i] = asScalar(field.at([x, y, z])); }
          catch { data[i] = 0; }
          i++;
        }
      }
      if (zi % Math.ceil(res / 40) === 0) {
        self.postMessage({ type: 'progress', value: zi / res });
      }
    }

    (self as any).postMessage({ type: 'done', buffer: data.buffer }, [data.buffer]);
  } catch (e) {
    self.postMessage({ type: 'error', message: (e as Error).message });
  }
});
