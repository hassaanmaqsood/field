import * as THREE from 'three';
import { Field, asNumberArray, asTensor } from '../protocol/Field';

function sampleGridPoints(bounds: { min: number; max: number }[], countPerAxis: number): number[][] {
  const m = bounds.length;
  const axisSamples = bounds.map((b) =>
    Array.from({ length: countPerAxis }, (_, i) => b.min + ((i + 0.5) / countPerAxis) * (b.max - b.min))
  );
  const points: number[][] = [];
  const idx = new Array(m).fill(0);
  const total = Math.pow(countPerAxis, m);
  for (let f = 0; f < total; f++) {
    let rem = f;
    for (let d = 0; d < m; d++) {
      idx[d] = rem % countPerAxis;
      rem = Math.floor(rem / countPerAxis);
    }
    points.push(idx.map((k, d) => axisSamples[d][k]));
  }
  return points;
}

/** Directional glyph field for vector-valued fields (rankOut === [n], n<=3). */
export function buildVectorGlyphs(field: Field, countPerAxis = 6, spatialAxes: [number, number, number] = [0, 1, 2], fixedRestOfDomain: number[] = []): THREE.InstancedMesh {
  const fullBounds = field.domain();
  const spatialBounds = spatialAxes.map((a) => fullBounds[a]);
  const points3 = sampleGridPoints(spatialBounds, countPerAxis);

  const geometry = new THREE.ConeGeometry(0.08, 0.32, 8); // wedge/pyramid-like directional glyph
  geometry.rotateX(Math.PI / 2); // point along +z by default -> we align to +y then rotate to direction
  const material = new THREE.MeshStandardMaterial({ vertexColors: true });
  const mesh = new THREE.InstancedMesh(geometry, material, points3.length);

  const dummy = new THREE.Object3D();
  const colorAttr = new Float32Array(points3.length * 3);
  let maxMag = 1e-6;
  const vecs: number[][] = [];
  const positions: number[][] = [];

  for (const p3 of points3) {
    const full = fullBounds.map((_, i) => {
      const sIdx = spatialAxes.indexOf(i);
      if (sIdx >= 0) return p3[sIdx];
      return fixedRestOfDomain[i] ?? 0;
    });
    const v = asNumberArray(field.at(full)).slice(0, 3);
    while (v.length < 3) v.push(0);
    const mag = Math.hypot(v[0], v[1], v[2]);
    maxMag = Math.max(maxMag, mag);
    vecs.push(v);
    positions.push(p3);
  }

  points3.forEach((p3, i) => {
    const v = vecs[i];
    const mag = Math.hypot(v[0], v[1], v[2]);
    const dir = mag > 1e-9 ? new THREE.Vector3(v[0], v[1], v[2]).normalize() : new THREE.Vector3(0, 1, 0);
    dummy.position.set(p3[0], p3[1], p3[2]);
    dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const scale = 0.5 + 1.5 * (mag / maxMag);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    const t = Math.min(mag / maxMag, 1);
    const color = new THREE.Color().setHSL(0.55 - 0.55 * t, 0.8, 0.55);
    colorAttr[i * 3] = color.r;
    colorAttr[i * 3 + 1] = color.g;
    colorAttr[i * 3 + 2] = color.b;
  });

  mesh.geometry.setAttribute('color', new THREE.InstancedBufferAttribute(colorAttr, 3));
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

/** Symmetric 3x3 eigendecomposition via cyclic Jacobi rotation. */
function jacobiEigen(mIn: number[][]): { values: number[]; vectors: THREE.Matrix3 } {
  const a = [mIn[0].slice(), mIn[1].slice(), mIn[2].slice()];
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let sweep = 0; sweep < 40; sweep++) {
    let off = Math.abs(a[0][1]) + Math.abs(a[0][2]) + Math.abs(a[1][2]);
    if (off < 1e-9) break;
    for (const [p, q] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ] as [number, number][]) {
      if (Math.abs(a[p][q]) < 1e-12) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1)) || 1;
      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;
      const app = a[p][p], aqq = a[q][q], apq = a[p][q];
      a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
      a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
      a[p][q] = a[q][p] = 0;
      for (let k = 0; k < 3; k++) {
        if (k !== p && k !== q) {
          const akp = a[k][p], akq = a[k][q];
          a[k][p] = a[p][k] = c * akp - s * akq;
          a[k][q] = a[q][k] = s * akp + c * akq;
        }
        const vkp = v[k][p], vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq;
        v[k][q] = s * vkp + c * vkq;
      }
    }
  }
  return {
    values: [a[0][0], a[1][1], a[2][2]],
    vectors: new THREE.Matrix3().set(v[0][0], v[0][1], v[0][2], v[1][0], v[1][1], v[1][2], v[2][0], v[2][1], v[2][2]),
  };
}

/** Principal-axis ellipsoid glyph field for rank-2 (3x3) tensor fields. */
export function buildTensorGlyphs(field: Field, countPerAxis = 6, spatialAxes: [number, number, number] = [0, 1, 2], fixedRestOfDomain: number[] = []): THREE.InstancedMesh {
  const fullBounds = field.domain();
  const spatialBounds = spatialAxes.map((a) => fullBounds[a]);
  const points3 = sampleGridPoints(spatialBounds, countPerAxis);

  const geometry = new THREE.SphereGeometry(0.14, 12, 8);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true });
  const mesh = new THREE.InstancedMesh(geometry, material, points3.length);

  const dummy = new THREE.Object3D();
  const colorAttr = new Float32Array(points3.length * 3);
  let maxAbsEig = 1e-6;
  const eigenCache: { values: number[]; vectors: THREE.Matrix3 }[] = [];

  for (const p3 of points3) {
    const full = fullBounds.map((_, i) => {
      const sIdx = spatialAxes.indexOf(i);
      if (sIdx >= 0) return p3[sIdx];
      return fixedRestOfDomain[i] ?? 0;
    });
    const t = asTensor(field.at(full));
    const eig = jacobiEigen(t);
    maxAbsEig = Math.max(maxAbsEig, ...eig.values.map(Math.abs));
    eigenCache.push(eig);
  }

  points3.forEach((p3, i) => {
    const { values, vectors } = eigenCache[i];
    const rotation = new THREE.Matrix4().setFromMatrix3(vectors);
    dummy.position.set(p3[0], p3[1], p3[2]);
    dummy.quaternion.setFromRotationMatrix(rotation);
    dummy.scale.set(
      0.4 + 1.2 * Math.abs(values[0]) / maxAbsEig,
      0.4 + 1.2 * Math.abs(values[1]) / maxAbsEig,
      0.4 + 1.2 * Math.abs(values[2]) / maxAbsEig
    );
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    const meanAbs = (Math.abs(values[0]) + Math.abs(values[1]) + Math.abs(values[2])) / 3;
    const t = Math.min(meanAbs / maxAbsEig, 1);
    const color = new THREE.Color().setHSL(0.02 + 0.1 * (1 - t), 0.75, 0.5);
    colorAttr[i * 3] = color.r;
    colorAttr[i * 3 + 1] = color.g;
    colorAttr[i * 3 + 2] = color.b;
  });

  mesh.geometry.setAttribute('color', new THREE.InstancedBufferAttribute(colorAttr, 3));
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}
