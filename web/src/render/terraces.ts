import * as THREE from 'three';
import { asScalar, Bounds, Field } from '../protocol/Field';
import { INK_RGB } from './tokens';

export interface TerracesOptions {
  res?: number;         // grid resolution (default 48)
  size?: number;        // XZ extent in world units (default 8)
  heightScale?: number; // vertical Y scale (default 2.5)
  steps?: number;       // discrete quantization step count (default 6)
  t?: number;
  domain?: Bounds[];
}

/**
 * Terraces 3D Renderer:
 * Builds discrete stepped plateaus with vertical cliff walls between adjacent quantized levels.
 * Renders each terrace level using discrete flat ink palette tones without Phong or soft shading.
 */
export function buildTerracesMesh(field: Field, opts: TerracesOptions = {}): THREE.Mesh {
  const res = opts.res ?? 48;
  const size = opts.size ?? 8;
  const heightScale = opts.heightScale ?? 2.5;
  const steps = opts.steps ?? 6;
  const rank = field.rankIn();

  const dx = size / res;
  const dz = size / res;
  const halfSize = size * 0.5;

  // 1. Sample field at cell centers
  const vals: number[][] = Array.from({ length: res }, () => new Array(res));
  let minV = Infinity;
  let maxV = -Infinity;

  for (let r = 0; r < res; r++) {
    for (let c = 0; c < res; c++) {
      const x = -halfSize + (c + 0.5) * dx;
      const z = -halfSize + (r + 0.5) * dz;
      const p = rank === 2 ? [x, z] : [x, 0, z];
      let v = 0;
      try {
        v = asScalar(field.at(p));
      } catch {
        v = 0;
      }
      vals[r][c] = v;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
  }

  if (minV === maxV) {
    minV -= 1;
    maxV += 1;
  }
  const range = maxV - minV;

  // 2. Quantize levels: step index k in [0, steps - 1], discrete Y height
  const levelGrid: number[][] = Array.from({ length: res }, () => new Array(res));
  const heightGrid: number[][] = Array.from({ length: res }, () => new Array(res));

  for (let r = 0; r < res; r++) {
    for (let c = 0; c < res; c++) {
      const norm = (vals[r][c] - minV) / range;
      const k = Math.min(steps - 1, Math.floor(Math.max(0, Math.min(1, norm)) * steps));
      levelGrid[r][c] = k;
      heightGrid[r][c] = (k / (steps - 1) - 0.5) * heightScale;
    }
  }

  // 3. Build geometry: horizontal terrace floors + vertical cliff walls
  const positions: number[] = [];
  const colors: number[] = [];

  const addQuad = (
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
    p4: [number, number, number],
    rgb: [number, number, number]
  ) => {
    // Triangle 1: p1, p2, p3
    positions.push(...p1, ...p2, ...p3);
    // Triangle 2: p1, p3, p4
    positions.push(...p1, ...p3, ...p4);

    const r = rgb[0] / 255;
    const g = rgb[1] / 255;
    const b = rgb[2] / 255;
    for (let i = 0; i < 6; i++) {
      colors.push(r, g, b);
    }
  };

  const getStepRGB = (k: number): [number, number, number] => {
    const paletteIdx = Math.min(5, Math.floor((k / (steps - 1)) * 5));
    return [...INK_RGB[paletteIdx]];
  };

  for (let r = 0; r < res; r++) {
    for (let c = 0; c < res; c++) {
      const x0 = -halfSize + c * dx;
      const x1 = x0 + dx;
      const z0 = -halfSize + r * dz;
      const z1 = z0 + dz;
      const h = heightGrid[r][c];
      const k = levelGrid[r][c];
      const rgb = getStepRGB(k);

      // Horizontal floor quad at height h
      addQuad(
        [x0, h, z0],
        [x1, h, z0],
        [x1, h, z1],
        [x0, h, z1],
        rgb
      );

      // Vertical wall to right neighbor (c + 1)
      if (c + 1 < res) {
        const hRight = heightGrid[r][c + 1];
        if (Math.abs(h - hRight) > 1e-4) {
          const wallRGB = getStepRGB(Math.min(k, levelGrid[r][c + 1]));
          addQuad(
            [x1, h, z0],
            [x1, hRight, z0],
            [x1, hRight, z1],
            [x1, h, z1],
            wallRGB
          );
        }
      }

      // Vertical wall to bottom neighbor (r + 1)
      if (r + 1 < res) {
        const hBottom = heightGrid[r + 1][c];
        if (Math.abs(h - hBottom) > 1e-4) {
          const wallRGB = getStepRGB(Math.min(k, levelGrid[r + 1][c]));
          addQuad(
            [x0, h, z1],
            [x1, h, z1],
            [x1, hBottom, z1],
            [x0, hBottom, z1],
            wallRGB
          );
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geometry, material);
}
