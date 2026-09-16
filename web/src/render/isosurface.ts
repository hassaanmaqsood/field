import * as THREE from 'three';
import { Field } from '../protocol/Field';

export interface IsosurfaceHandle {
  mesh: THREE.Object3D;
  setIso(value: number): void;
  setShells?(shells: number[]): void;
  dispose(): void;
}

export interface IsosurfaceOptions {
  resolution?: number;
  shells?: number[];         // Iso-levels (default [0.0])
  mode?: 'solid' | 'shells'; // 'shells' = concentric wireframe shells
  color?: THREE.Color;
}

type Point3 = [number, number, number];

interface GridNode {
  p: Point3;
  val: number;
}

const TETRAHEDRA: readonly (readonly [number, number, number, number])[] = [
  [0, 5, 1, 6],
  [0, 1, 2, 6],
  [0, 2, 3, 6],
  [0, 3, 7, 6],
  [0, 7, 4, 6],
  [0, 4, 5, 6],
];

/**
 * Linearly interpolate coordinate between two corner nodes based on isovalue.
 */
function interp(n1: GridNode, n2: GridNode, iso: number): Point3 {
  const d = n2.val - n1.val;
  if (Math.abs(d) < 1e-9) {
    return [
      (n1.p[0] + n2.p[0]) * 0.5,
      (n1.p[1] + n2.p[1]) * 0.5,
      (n1.p[2] + n2.p[2]) * 0.5,
    ];
  }
  const t = (iso - n1.val) / d;
  return [
    n1.p[0] + t * (n2.p[0] - n1.p[0]),
    n1.p[1] + t * (n2.p[1] - n1.p[1]),
    n1.p[2] + t * (n2.p[2] - n1.p[2]),
  ];
}

/**
 * Extracts wireframe edges for a single isovalue from a 3D scalar grid using Marching Tetrahedra.
 */
function extractWireframeForIso(
  grid: Float32Array,
  res: number,
  min: Point3,
  max: Point3,
  iso: number
): Float32Array {
  const linePositions: number[] = [];

  const getCorner = (x: number, y: number, z: number, c: number): GridNode => {
    const dx = c === 1 || c === 2 || c === 5 || c === 6 ? 1 : 0;
    const dy = c === 2 || c === 3 || c === 6 || c === 7 ? 1 : 0;
    const dz = c >= 4 ? 1 : 0;

    const ix = x + dx;
    const iy = y + dy;
    const iz = z + dz;

    const flat = iz * res * res + iy * res + ix;
    const wx = min[0] + (ix / (res - 1)) * (max[0] - min[0]);
    const wy = min[1] + (iy / (res - 1)) * (max[1] - min[1]);
    const wz = min[2] + (iz / (res - 1)) * (max[2] - min[2]);

    return { p: [wx, wy, wz], val: grid[flat] };
  };

  const addTriangleEdges = (p0: Point3, p1: Point3, p2: Point3) => {
    linePositions.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2]);
    linePositions.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
    linePositions.push(p2[0], p2[1], p2[2], p0[0], p0[1], p0[2]);
  };

  for (let z = 0; z < res - 1; z++) {
    for (let y = 0; y < res - 1; y++) {
      for (let x = 0; x < res - 1; x++) {
        const corners: GridNode[] = [];
        for (let c = 0; c < 8; c++) {
          corners.push(getCorner(x, y, z, c));
        }

        for (const tet of TETRAHEDRA) {
          const v0 = corners[tet[0]];
          const v1 = corners[tet[1]];
          const v2 = corners[tet[2]];
          const v3 = corners[tet[3]];

          let mask = 0;
          if (v0.val >= iso) mask |= 1;
          if (v1.val >= iso) mask |= 2;
          if (v2.val >= iso) mask |= 4;
          if (v3.val >= iso) mask |= 8;

          if (mask === 0 || mask === 15) continue;

          if (mask === 1 || mask === 14) {
            const p0 = interp(v0, v1, iso);
            const p1 = interp(v0, v2, iso);
            const p2 = interp(v0, v3, iso);
            addTriangleEdges(p0, p1, p2);
          } else if (mask === 2 || mask === 13) {
            const p0 = interp(v1, v0, iso);
            const p1 = interp(v1, v2, iso);
            const p2 = interp(v1, v3, iso);
            addTriangleEdges(p0, p1, p2);
          } else if (mask === 4 || mask === 11) {
            const p0 = interp(v2, v0, iso);
            const p1 = interp(v2, v1, iso);
            const p2 = interp(v2, v3, iso);
            addTriangleEdges(p0, p1, p2);
          } else if (mask === 8 || mask === 7) {
            const p0 = interp(v3, v0, iso);
            const p1 = interp(v3, v1, iso);
            const p2 = interp(v3, v2, iso);
            addTriangleEdges(p0, p1, p2);
          } else if (mask === 3 || mask === 12) {
            const p0 = interp(v0, v2, iso);
            const p1 = interp(v0, v3, iso);
            const p2 = interp(v1, v2, iso);
            const p3 = interp(v1, v3, iso);
            addTriangleEdges(p0, p1, p2);
            addTriangleEdges(p2, p1, p3);
          } else if (mask === 5 || mask === 10) {
            const p0 = interp(v0, v1, iso);
            const p1 = interp(v0, v3, iso);
            const p2 = interp(v2, v1, iso);
            const p3 = interp(v2, v3, iso);
            addTriangleEdges(p0, p1, p2);
            addTriangleEdges(p2, p1, p3);
          } else if (mask === 6 || mask === 9) {
            const p0 = interp(v1, v0, iso);
            const p1 = interp(v1, v3, iso);
            const p2 = interp(v2, v0, iso);
            const p3 = interp(v2, v3, iso);
            addTriangleEdges(p0, p1, p2);
            addTriangleEdges(p2, p1, p3);
          }
        }
      }
    }
  }

  return new Float32Array(linePositions);
}

/**
 * Builds nested wireframe isosurface shells using Marching Tetrahedra.
 * Produces zero polygon fills, zero lighting, zero shading.
 * Differentiates shells by line weight and opacity only.
 */
export function buildIsosurface(
  field: Field,
  optsOrRes: number | IsosurfaceOptions = 36,
  _legacyColor?: THREE.Color
): IsosurfaceHandle {
  let resolution = 36;
  let currentShells = [0.0];

  if (typeof optsOrRes === 'number') {
    resolution = optsOrRes;
  } else if (optsOrRes) {
    if (optsOrRes.resolution !== undefined) resolution = optsOrRes.resolution;
    if (optsOrRes.shells && optsOrRes.shells.length > 0) currentShells = optsOrRes.shells;
  }

  const domain = field.domain();
  const dx = domain[0] ?? { min: -4, max: 4 };
  const dy = domain[1] ?? { min: -4, max: 4 };
  const dz = domain[2] ?? { min: -4, max: 4 };

  const minPoint: Point3 = [dx.min, dy.min, dz.min];
  const maxPoint: Point3 = [dx.max, dy.max, dz.max];

  // Sample field into 3D scalar grid
  const baked = field.sample({ resolution: [resolution, resolution, resolution] });
  const grid = new Float32Array(resolution * resolution * resolution);

  let idx = 0;
  for (let zi = 0; zi < resolution; zi++) {
    const z = dz.min + (zi / (resolution - 1)) * (dz.max - dz.min);
    for (let yi = 0; yi < resolution; yi++) {
      const y = dy.min + (yi / (resolution - 1)) * (dy.max - dy.min);
      for (let xi = 0; xi < resolution; xi++) {
        const x = dx.min + (xi / (resolution - 1)) * (dx.max - dx.min);
        const val = baked.at([x, y, z]);
        if (typeof val === 'number') {
          grid[idx++] = val;
        } else if (Array.isArray(val) && typeof val[0] === 'number') {
          const arr = val as number[];
          grid[idx++] = Math.sqrt(arr.reduce((sum, v) => sum + v * v, 0));
        } else {
          grid[idx++] = 0;
        }
      }
    }
  }

  const group = new THREE.Group();

  function clearGroup() {
    while (group.children.length > 0) {
      const child = group.children[0] as THREE.LineSegments;
      group.remove(child);
      child.geometry?.dispose();
      (child.material as THREE.Material)?.dispose();
    }
  }

  function renderShells(shells: number[]) {
    clearGroup();

    if (shells.length === 0) return;

    // Rank shells by absolute threshold magnitude (closest to 0 = innermost)
    const sortedShells = shells.slice().sort((a, b) => Math.abs(a) - Math.abs(b));

    sortedShells.forEach((iso, rankIndex) => {
      const positions = extractWireframeForIso(grid, resolution, minPoint, maxPoint, iso);
      if (positions.length === 0) return;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

      // Opacity progression: innermost closest to expr=0 is boldest, outer shells thinner/lighter
      let opacity = 0.85;
      if (sortedShells.length > 1) {
        if (rankIndex === 0) {
          opacity = 0.90; // innermost
        } else if (rankIndex === 1 && sortedShells.length > 2) {
          opacity = 0.45; // middle
        } else {
          opacity = 0.22; // outermost
        }
      }

      const material = new THREE.LineBasicMaterial({
        color: 0x0D0D0E, // strictly --ink
        transparent: true,
        opacity,
        depthWrite: false, // allows nested concentric shells to be visible through each other
      });

      const lines = new THREE.LineSegments(geometry, material);
      group.add(lines);

      // For innermost shell, add a subtle micro-offset line pass to achieve a slightly bolder line weight
      if (rankIndex === 0 && sortedShells.length > 1) {
        const boldGeom = geometry.clone();
        const boldMat = new THREE.LineBasicMaterial({
          color: 0x0D0D0E,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        });
        const boldLines = new THREE.LineSegments(boldGeom, boldMat);
        boldLines.scale.setScalar(1.002);
        group.add(boldLines);
      }
    });
  }

  renderShells(currentShells);

  return {
    mesh: group,
    setIso: (value: number) => {
      currentShells = [value];
      renderShells(currentShells);
    },
    setShells: (newShells: number[]) => {
      currentShells = newShells.slice();
      renderShells(currentShells);
    },
    dispose: () => {
      clearGroup();
    },
  };
}
