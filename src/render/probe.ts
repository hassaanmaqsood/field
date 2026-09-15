import * as THREE from 'three';
import { Field, FieldValue, shapeLabel } from '../protocol/Field';

export interface ProbeResult {
  point: number[]; // domain-space coordinates (spatial axes only, length <=3)
  value: FieldValue;
  label: 'scalar' | 'vector' | 'tensor';
}

/**
 * Builds an invisible box matching a (<=3D) renderable field's domain, used
 * purely as a raycast target. Probing always queries the field currently on
 * screen (post-slice, so rankIn() <= 3 by the time it reaches this layer).
 */
export function buildProbeVolume(field: Field): THREE.Mesh {
  const bounds = field.domain();
  const size = bounds.map((b) => b.max - b.min);
  while (size.length < 3) size.push(0.01);
  const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
  const material = new THREE.MeshBasicMaterial({ visible: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.isProbeVolume = true;
  return mesh;
}

export function probe(
  field: Field,
  probeVolume: THREE.Mesh,
  raycaster: THREE.Raycaster
): ProbeResult | null {
  const hits = raycaster.intersectObject(probeVolume, false);
  if (hits.length === 0) return null;
  const local = probeVolume.worldToLocal(hits[0].point.clone());
  const bounds = field.domain();
  const point = bounds.map((_, i) => {
    if (i === 0) return local.x;
    if (i === 1) return local.y;
    if (i === 2) return local.z;
    return 0;
  });
  const value = field.at(point);
  return { point, value, label: shapeLabel(field.rankOut()) };
}
