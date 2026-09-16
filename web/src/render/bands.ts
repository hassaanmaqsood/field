import * as THREE from 'three';
import { asScalar, Bounds, Field } from '../protocol/Field';
import { quantizeToneRGB } from './tokens';

export interface BandsOptions {
  resolution?: number; // grid resolution (default 64)
  width?: number;
  height?: number;
  t?: number;
  domain?: Bounds[];
}

/**
 * Quantized 6-step Bands Renderer:
 * Directly maps scalar field values to the 6 discrete ink levels with zero interpolation.
 * Uses NearestFilter to ensure sharp, crisp boundaries between tonal steps.
 */
export function buildBandsMesh(field: Field, opts: BandsOptions = {}): THREE.Mesh {
  const res = opts.resolution ?? 64;
  const domain = opts.domain ?? field.domain();
  const bx = domain[0] ?? { min: -4, max: 4 };
  const by = domain[1] ?? { min: -4, max: 4 };
  const rank = field.rankIn();

  const rawVals: number[] = new Array(res * res);
  let idx = 0;

  for (let r = 0; r < res; r++) {
    for (let c = 0; c < res; c++) {
      const u = c / (res - 1);
      const v = r / (res - 1);
      const wx = bx.min + u * (bx.max - bx.min);
      const wy = by.min + v * (by.max - by.min);
      const p = rank === 2 ? [wx, wy] : [wx, wy, 0];
      try {
        rawVals[idx++] = asScalar(field.at(p));
      } catch {
        rawVals[idx++] = 0;
      }
    }
  }

  let minV = Math.min(...rawVals);
  let maxV = Math.max(...rawVals);
  if (minV === maxV) {
    minV -= 1;
    maxV += 1;
  }
  const range = maxV - minV;

  const data = new Uint8Array(res * res * 4);
  for (let i = 0; i < rawVals.length; i++) {
    const norm = (rawVals[i] - minV) / range;
    const [r, g, b] = quantizeToneRGB(norm);
    const offset = i * 4;
    data[offset + 0] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, res, res, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  const geomWidth = bx.max - bx.min;
  const geomHeight = by.max - by.min;
  const geometry = new THREE.PlaneGeometry(geomWidth, geomHeight);

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set((bx.min + bx.max) / 2, (by.min + by.max) / 2, 0);
  return mesh;
}
