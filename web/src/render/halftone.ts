import * as THREE from 'three';
import { asScalar, Bounds, Field } from '../protocol/Field';
import { INK_RGB, INK_STEPS, quantizeDotRadius } from './tokens';

export interface HalftoneOptions {
  cellSize?: number; // spacing between dot centers in pixels (default 16)
  width?: number;    // texture resolution width (default 512)
  height?: number;   // texture resolution height (default 512)
  t?: number;        // time parameter for animation
  domain?: Bounds[]; // spatial domain bounds
}

/**
 * Halftone Density Renderer:
 * Quantizes continuous field values into 20-tier discrete dot radii on a paper ground.
 * Produces a crisp THREE.Mesh with zero soft gradient blurring.
 */
export function buildHalftoneMesh(field: Field, opts: HalftoneOptions = {}): THREE.Mesh {
  const cellSize = opts.cellSize ?? 16;
  const width = opts.width ?? 512;
  const height = opts.height ?? 512;
  const domain = opts.domain ?? field.domain();

  const bx = domain[0] ?? { min: -4, max: 4 };
  const by = domain[1] ?? { min: -4, max: 4 };
  const rank = field.rankIn();

  // Create canvas for rendering discrete halftone dots
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Fill paper ground (#D8D6CE)
    ctx.fillStyle = INK_STEPS[5];
    ctx.fillRect(0, 0, width, height);

    // Collect field values across grid
    const cols = Math.floor(width / cellSize);
    const rows = Math.floor(height / cellSize);
    const rawVals: number[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const u = (c + 0.5) / cols;
        const v = (r + 0.5) / rows;
        const wx = bx.min + u * (bx.max - bx.min);
        const wy = by.min + (1 - v) * (by.max - by.min); // Invert Y for canvas orientation
        const p = rank === 2 ? [wx, wy] : [wx, wy, 0];
        try {
          rawVals.push(asScalar(field.at(p)));
        } catch {
          rawVals.push(0);
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

    // Draw solid discrete dots (#0D0D0E)
    ctx.fillStyle = INK_STEPS[0];
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      const cy = (r + 0.5) * cellSize;
      for (let c = 0; c < cols; c++) {
        const cx = (c + 0.5) * cellSize;
        const norm = (rawVals[idx++] - minV) / range;
        // Inverted so high density (high scalar) produces larger ink dots
        const radius = quantizeDotRadius(norm);

        if (radius > 0.5) {
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;

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
