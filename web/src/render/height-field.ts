import * as THREE from 'three';
import { asScalar, Bounds, Field } from '../protocol/Field';

export interface HeightFieldOptions {
  res?: number;         // grid resolution along each axis (default 64)
  size?: number;        // XZ extent in world units (default 8)
  heightScale?: number; // vertical Y scaling factor (default 2.5)
  t?: number;
  wireframe?: boolean;  // default true
  domain?: Bounds[];
}

/**
 * Height Field 3D Renderer:
 * Displaces a horizontal XZ plane wireframe mesh along the Y axis using field values.
 * Uses MeshBasicMaterial with #0D0D0E wireframe — zero Phong/rim lighting.
 */
export function buildHeightFieldMesh(field: Field, opts: HeightFieldOptions = {}): THREE.Mesh {
  const res = opts.res ?? 64;
  const size = opts.size ?? 8;
  const heightScale = opts.heightScale ?? 2.5;
  const wireframe = opts.wireframe ?? true;
  const rank = field.rankIn();

  const geometry = new THREE.PlaneGeometry(size, size, res - 1, res - 1);
  // Lay plane horizontal in XZ plane (normal pointing up along +Y)
  geometry.rotateX(-Math.PI / 2);

  const posAttr = geometry.attributes.position as THREE.BufferAttribute;
  const count = posAttr.count;

  // Sample field at all vertices to find min/max for normalization
  const vals = new Float64Array(count);
  let minV = Infinity;
  let maxV = -Infinity;

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const p = rank === 2 ? [x, z] : [x, 0, z];
    let v = 0;
    try {
      v = asScalar(field.at(p));
    } catch {
      v = 0;
    }
    vals[i] = v;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }

  if (minV === maxV) {
    minV -= 1;
    maxV += 1;
  }
  const range = maxV - minV;

  // Displace Y coordinate
  for (let i = 0; i < count; i++) {
    const norm = (vals[i] - minV) / range;
    const y = (norm - 0.5) * heightScale;
    posAttr.setY(i, y);
  }

  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();

  const material = new THREE.MeshBasicMaterial({
    color: 0x0D0D0E,
    wireframe,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geometry, material);
}
