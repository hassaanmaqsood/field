import * as THREE from 'three';
import { ASCII_RAMP } from './tokens';

export interface AsciiViewportOptions {
  cols?: number; // character columns (default 120)
  rows?: number; // character rows (default 40)
  fps?: number;  // target fps (default 30)
}

/**
 * AsciiViewportRenderer:
 * Renders the Three.js scene to an offscreen low-resolution WebGLRenderTarget,
 * reads back pixel buffer luminance, and converts it into monospace ASCII text
 * using the 10-tier ASCII_RAMP.
 */
export class AsciiViewportRenderer {
  private target: THREE.WebGLRenderTarget;
  private pixelBuffer: Uint8Array;
  private cols: number;
  private rows: number;
  private mountedEl: HTMLElement | null = null;

  constructor(
    private renderer: THREE.WebGLRenderer,
    opts: AsciiViewportOptions = {}
  ) {
    this.cols = opts.cols ?? 120;
    this.rows = opts.rows ?? 40;

    this.target = new THREE.WebGLRenderTarget(this.cols, this.rows, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });

    this.pixelBuffer = new Uint8Array(this.cols * this.rows * 4);
  }

  /**
   * Renders the scene to the offscreen target and maps pixels to ASCII string.
   */
  renderToAscii(scene: THREE.Scene, camera: THREE.Camera): string {
    const prevTarget = this.renderer.getRenderTarget();

    // Render offscreen
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.readRenderTargetPixels(
      this.target,
      0,
      0,
      this.cols,
      this.rows,
      this.pixelBuffer
    );
    this.renderer.setRenderTarget(prevTarget);

    // Map luminance to ASCII chars.
    // OpenGL textures are stored bottom-to-top, so row 0 in pixelBuffer is bottom row.
    const ramp = ASCII_RAMP;
    const rampLen = ramp.length;
    let output = '';

    for (let r = this.rows - 1; r >= 0; r--) {
      let line = '';
      const rowOffset = r * this.cols * 4;
      for (let c = 0; c < this.cols; c++) {
        const idx = rowOffset + c * 4;
        const red = this.pixelBuffer[idx + 0];
        const green = this.pixelBuffer[idx + 1];
        const blue = this.pixelBuffer[idx + 2];

        // Perceptual luminance calculation (0..255)
        const lum = 0.299 * red + 0.587 * green + 0.114 * blue;
        const charIdx = Math.min(rampLen - 1, Math.floor((lum / 255) * rampLen));
        line += ramp[charIdx];
      }
      output += (r < this.rows - 1 ? '\n' : '') + line;
    }

    if (this.mountedEl) {
      this.mountedEl.textContent = output;
    }

    return output;
  }

  /**
   * Mounts the ASCII stream to a DOM element (e.g. <pre id="ascii-viewport">).
   */
  mountToElement(el: HTMLElement): void {
    this.mountedEl = el;
    el.classList.remove('hidden');
    el.style.display = 'block';
  }

  /**
   * Unmounts and hides the ASCII overlay.
   */
  unmount(): void {
    if (this.mountedEl) {
      this.mountedEl.classList.add('hidden');
      this.mountedEl.style.display = 'none';
      this.mountedEl.textContent = '';
      this.mountedEl = null;
    }
  }

  dispose(): void {
    this.unmount();
    this.target.dispose();
  }
}
