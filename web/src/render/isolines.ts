import * as THREE from 'three';
import { asScalar, Bounds, Field } from '../protocol/Field';
import { INK_STEPS, ISOLINE_LEVELS } from './tokens';

export interface IsolinesOptions {
  res?: number;      // grid resolution for marching squares (default 128)
  width?: number;    // canvas pixel width (default 512)
  height?: number;   // canvas pixel height (default 512)
  t?: number;
  domain?: Bounds[];
}

type Point2D = [number, number];

/**
 * Linearly interpolate coordinate between two corner points based on isovalue.
 */
function interp(p1: Point2D, p2: Point2D, v1: number, v2: number, iso: number): Point2D {
  if (Math.abs(v2 - v1) < 1e-9) {
    return [(p1[0] + p2[0]) * 0.5, (p1[1] + p2[1]) * 0.5];
  }
  const frac = Math.max(0, Math.min(1, (iso - v1) / (v2 - v1)));
  return [
    p1[0] + frac * (p2[0] - p1[0]),
    p1[1] + frac * (p2[1] - p1[1]),
  ];
}

/**
 * Marching Squares Isolines Renderer:
 * Computes exact discrete contour lines across the 5 canonical thresholds.
 * Renders 1.5px solid ink lines (#0D0D0E) on paper ground (#D8D6CE).
 */
export function buildIsolinesMesh(field: Field, opts: IsolinesOptions = {}): THREE.Mesh {
  const res = opts.res ?? 128;
  const width = opts.width ?? 512;
  const height = opts.height ?? 512;
  const domain = opts.domain ?? field.domain();

  const bx = domain[0] ?? { min: -4, max: 4 };
  const by = domain[1] ?? { min: -4, max: 4 };
  const rank = field.rankIn();

  // 1. Sample field on res x res grid
  const grid: number[][] = Array.from({ length: res }, () => new Array(res));
  let minV = Infinity;
  let maxV = -Infinity;

  for (let r = 0; r < res; r++) {
    for (let c = 0; c < res; c++) {
      const u = c / (res - 1);
      const v = r / (res - 1);
      const wx = bx.min + u * (bx.max - bx.min);
      const wy = by.min + (1 - v) * (by.max - by.min); // Invert Y for canvas orientation
      const p = rank === 2 ? [wx, wy] : [wx, wy, 0];
      let val = 0;
      try {
        val = asScalar(field.at(p));
      } catch {
        val = 0;
      }
      grid[r][c] = val;
      if (val < minV) minV = val;
      if (val > maxV) maxV = val;
    }
  }

  if (minV === maxV) {
    minV -= 1;
    maxV += 1;
  }
  const range = maxV - minV;

  // 2. Setup canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Fill paper ground (#D8D6CE)
    ctx.fillStyle = INK_STEPS[5];
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = INK_STEPS[0];
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';

    const dx = width / (res - 1);
    const dy = height / (res - 1);

    // 3. March squares for each canonical isovalue
    for (const isoNorm of ISOLINE_LEVELS) {
      const isoVal = minV + isoNorm * range;

      ctx.beginPath();

      for (let r = 0; r < res - 1; r++) {
        for (let c = 0; c < res - 1; c++) {
          const x0 = c * dx, x1 = (c + 1) * dx;
          const y0 = r * dy, y1 = (r + 1) * dy;

          const v0 = grid[r][c];         // top-left
          const v1 = grid[r][c + 1];     // top-right
          const v2 = grid[r + 1][c + 1]; // bottom-right
          const v3 = grid[r + 1][c];     // bottom-left

          let mask = 0;
          if (v0 >= isoVal) mask |= 1;
          if (v1 >= isoVal) mask |= 2;
          if (v2 >= isoVal) mask |= 4;
          if (v3 >= isoVal) mask |= 8;

          if (mask === 0 || mask === 15) continue;

          // Midpoints on 4 edges: 0: top, 1: right, 2: bottom, 3: left
          const pTop: Point2D    = interp([x0, y0], [x1, y0], v0, v1, isoVal);
          const pRight: Point2D  = interp([x1, y0], [x1, y1], v1, v2, isoVal);
          const pBottom: Point2D = interp([x0, y1], [x1, y1], v3, v2, isoVal);
          const pLeft: Point2D   = interp([x0, y0], [x0, y1], v0, v3, isoVal);

          const drawSeg = (a: Point2D, b: Point2D) => {
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
          };

          switch (mask) {
            case 1:
            case 14:
              drawSeg(pLeft, pTop);
              break;
            case 2:
            case 13:
              drawSeg(pTop, pRight);
              break;
            case 3:
            case 12:
              drawSeg(pLeft, pRight);
              break;
            case 4:
            case 11:
              drawSeg(pRight, pBottom);
              break;
            case 5:
              drawSeg(pLeft, pTop);
              drawSeg(pRight, pBottom);
              break;
            case 6:
            case 9:
              drawSeg(pTop, pBottom);
              break;
            case 7:
            case 8:
              drawSeg(pLeft, pBottom);
              break;
            case 10:
              drawSeg(pTop, pRight);
              drawSeg(pLeft, pBottom);
              break;
          }
        }
      }

      ctx.stroke();
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
