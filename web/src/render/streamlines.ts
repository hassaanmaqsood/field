import * as THREE from 'three';
import { Field, asNumberArray } from '../protocol/Field';
import { Bounds } from '../protocol/Field';
import { applyColormap } from './slice-plane';

// ── RK4 integration ────────────────────────────────────────────────────────

function getVelocity(field: Field, p: number[]): number[] | null {
  try {
    const v = asNumberArray(field.at(p)).slice(0, 3);
    while (v.length < 3) v.push(0);
    return v;
  } catch {
    return null;
  }
}

function isInsideBox(p: number[], box: Bounds[]): boolean {
  return box.every((b, i) => p[i] !== undefined && p[i] >= b.min && p[i] <= b.max);
}

function rk4Step(field: Field, p: number[], h: number): number[] | null {
  const k1 = getVelocity(field, p);
  if (!k1) return null;
  const p2 = p.map((v, i) => v + (h / 2) * k1[i]);
  const k2 = getVelocity(field, p2);
  if (!k2) return null;
  const p3 = p.map((v, i) => v + (h / 2) * k2[i]);
  const k3 = getVelocity(field, p3);
  if (!k3) return null;
  const p4 = p.map((v, i) => v + h * k3[i]);
  const k4 = getVelocity(field, p4);
  if (!k4) return null;
  return p.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

function integrateLine(
  field: Field,
  seed: number[],
  steps: number,
  h: number,
  box: Bounds[],
): { pos: number[]; speed: number }[] {
  const pts: { pos: number[]; speed: number }[] = [{ pos: seed.slice(), speed: 0 }];
  let p = seed.slice();
  for (let i = 0; i < steps; i++) {
    const next = rk4Step(field, p, h);
    if (!next || !isInsideBox(next, box)) break;
    const v = getVelocity(field, p)!;
    const speed = Math.hypot(v[0], v[1], v[2]);
    pts.push({ pos: next, speed });
    p = next;
  }
  return pts;
}

// ── Random seed generation ─────────────────────────────────────────────────

function randomSeeds(n: number, box: Bounds[]): number[][] {
  const seeds: number[][] = [];
  for (let i = 0; i < n; i++) {
    seeds.push(box.slice(0, 3).map(b => b.min + Math.random() * (b.max - b.min)));
  }
  return seeds;
}

// ── Builder ────────────────────────────────────────────────────────────────

/**
 * Builds streamlines for a vector field using RK4 integration.
 * Returns a THREE.LineSegments object.
 */
export function buildStreamlines(
  field: Field,
  seeds = 48,
  steps = 150,
  tubeRadius = 0,   // 0 = lines, >0 would be tubes (lines for now)
  box: Bounds[] = field.domain().slice(0, 3),
  cmapName = 'viridis',
): THREE.Object3D {
  const maxBox = box.length >= 3 ? box.slice(0, 3) : [
    { min: -4, max: 4 }, { min: -4, max: 4 }, { min: -4, max: 4 }
  ];

  // Step size: fraction of the smallest box dimension
  const minDim = Math.min(...maxBox.map(b => b.max - b.min));
  const h = minDim / (steps * 0.5);

  const allPts: { pos: number[]; speed: number }[][] = [];
  let maxSpeed = 1e-6;

  for (const seed of randomSeeds(seeds, maxBox)) {
    const pts = integrateLine(field, seed, steps, h, maxBox);
    if (pts.length > 1) {
      allPts.push(pts);
      for (const { speed } of pts) maxSpeed = Math.max(maxSpeed, speed);
    }
  }

  // Build geometry: pairs of consecutive points per segment
  const posArr: number[] = [];
  const colArr: number[] = [];

  for (const line of allPts) {
    for (let i = 0; i < line.length - 1; i++) {
      const { pos: p0, speed: s0 } = line[i];
      const { pos: p1, speed: s1 } = line[i + 1];
      const t = ((s0 + s1) / 2) / maxSpeed;
      const [r, g, b] = applyColormap(t, cmapName);

      posArr.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2]);
      colArr.push(r, g, b, r, g, b);
    }
  }

  if (posArr.length === 0) {
    // No valid streamlines — return empty object
    return new THREE.Object3D();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  geometry.setAttribute('color',    new THREE.Float32BufferAttribute(colArr, 3));

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    linewidth: 1,
  });

  return new THREE.LineSegments(geometry, material);
}
