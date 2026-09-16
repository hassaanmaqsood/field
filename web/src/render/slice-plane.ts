import * as THREE from 'three';
import { Field, asScalar } from '../protocol/Field';
import { Bounds } from '../protocol/Field';
import { quantizeToneRGB } from './tokens';

// ── Colormaps ──────────────────────────────────────────────────────────────

function clamp01(v: number) { return Math.min(1, Math.max(0, v)); }

function viridis(t: number): [number, number, number] {
  // Piecewise linear approximation of matplotlib viridis
  const stops: [number, [number, number, number]][] = [
    [0.00, [0.267, 0.005, 0.329]],
    [0.25, [0.282, 0.341, 0.608]],
    [0.50, [0.129, 0.566, 0.551]],
    [0.75, [0.369, 0.789, 0.384]],
    [1.00, [0.993, 0.906, 0.144]],
  ];
  t = clamp01(t);
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / (t1 - t0);
      return [c0[0] + f * (c1[0] - c0[0]), c0[1] + f * (c1[1] - c0[1]), c0[2] + f * (c1[2] - c0[2])];
    }
  }
  return [0.993, 0.906, 0.144];
}

function coolwarm(t: number): [number, number, number] {
  t = clamp01(t);
  if (t < 0.5) {
    const f = t * 2;
    return [0.23 + 0.54 * f, 0.30 + 0.42 * f, 0.75 - 0.08 * f];
  } else {
    const f = (t - 0.5) * 2;
    return [0.77 + 0.15 * f, 0.72 - 0.58 * f, 0.67 - 0.60 * f];
  }
}

function plasma(t: number): [number, number, number] {
  const stops: [number, [number, number, number]][] = [
    [0.00, [0.050, 0.030, 0.528]],
    [0.25, [0.491, 0.012, 0.658]],
    [0.50, [0.799, 0.278, 0.470]],
    [0.75, [0.974, 0.546, 0.211]],
    [1.00, [0.940, 0.975, 0.131]],
  ];
  t = clamp01(t);
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / (t1 - t0);
      return [c0[0] + f * (c1[0] - c0[0]), c0[1] + f * (c1[1] - c0[1]), c0[2] + f * (c1[2] - c0[2])];
    }
  }
  return stops[stops.length - 1][1];
}

function grayscale(t: number): [number, number, number] {
  const v = clamp01(t);
  return [v, v, v];
}

export function applyColormap(t: number, name = 'viridis'): [number, number, number] {
  switch (name) {
    case 'coolwarm': return coolwarm(t);
    case 'plasma':   return plasma(t);
    case 'gray':     return grayscale(t);
    default:         return viridis(t);
  }
}

// ── Slice plane builder ────────────────────────────────────────────────────

/**
 * Builds a textured quad representing a scalar field slice along a world axis.
 * The field is sampled on a resolution×resolution grid, values mapped to colour
 * via the chosen colormap, and uploaded as a DataTexture.
 */
export function buildSlicePlane(
  field: Field,
  axis: 'x' | 'y' | 'z',
  value: number,
  box: Bounds[],
  cmapName = 'viridis',
  resolution = 64,
): THREE.Mesh {
  const [bx, by, bz] = box;

  // Build sampling grid in the two non-slice axes
  type Axis3 = 0 | 1 | 2;
  const axisIdx: Record<string, Axis3> = { x: 0, y: 1, z: 2 };
  const sliceAxis = axisIdx[axis];
  const u = ([0, 1, 2] as Axis3[]).filter(a => a !== sliceAxis);
  const bounds = [bx, by, bz];
  const uBounds = u.map(a => bounds[a]);
  const [uB, vB] = uBounds;

  const data = new Uint8Array(resolution * resolution * 4);
  const vals: number[] = [];

  // First pass: collect values to normalise
  for (let row = 0; row < resolution; row++) {
    for (let col = 0; col < resolution; col++) {
      const uu = uB.min + (col / (resolution - 1)) * (uB.max - uB.min);
      const vv = vB.min + (row / (resolution - 1)) * (vB.max - vB.min);
      const p = [0, 0, 0] as [number, number, number];
      p[sliceAxis] = value;
      p[u[0]] = uu;
      p[u[1]] = vv;
      try {
        vals.push(asScalar(field.at(p)));
      } catch {
        vals.push(0);
      }
    }
  }

  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;

  // Second pass: map to RGBA using discrete ink tokens
  for (let i = 0; i < vals.length; i++) {
    const t = (vals[i] - minV) / range;
    const [r, g, b] = quantizeToneRGB(t);
    data[i * 4 + 0] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, resolution, resolution, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.minFilter   = THREE.NearestFilter;
  texture.magFilter   = THREE.NearestFilter;

  // Geometry: a quad in the two non-slice axes
  const width  = uB.max - uB.min;
  const height = vB.max - vB.min;
  const geometry = new THREE.PlaneGeometry(width, height);

  // Rotate to correct orientation
  if (axis === 'x') geometry.rotateY(Math.PI / 2);
  if (axis === 'y') geometry.rotateX(Math.PI / 2);

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);

  // Position the plane at the slice value
  const centre = [
    (bx.min + bx.max) / 2,
    (by.min + by.max) / 2,
    (bz.min + bz.max) / 2,
  ];
  centre[sliceAxis] = value;
  mesh.position.set(centre[0], centre[1], centre[2]);

  return mesh;
}
