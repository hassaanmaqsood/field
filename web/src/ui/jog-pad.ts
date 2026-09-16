/**
 * JogPad — touch & pointer controller.
 * Flat monochrome architecture matching strict design tokens:
 *   - 1px --ink-20 (#BCBAB4) stroke circular ring, transparent fill
 *   - Small flat --ink (#0D0D0E) dot marking current orientation (no gradient/shadow)
 *   - Thin --ink-10 (#D8D6CE) linear track with --ink-80 (#2E2E32) fill
 *   - Both BOX and CAM controls use identical monochrome styling.
 */

export interface JogPadCallbacks {
  onXY?:    (x: number, y: number) => void;
  onZ?:     (z: number) => void;
  onReset?: () => void;
}

export class JogPad {
  private diskCanvas: HTMLCanvasElement;
  private stripCanvas: HTMLCanvasElement;
  private dctx: CanvasRenderingContext2D;
  private sctx: CanvasRenderingContext2D;

  // Current thumb position, normalised to [-1, 1]
  private tx = 0;
  private ty = 0;
  private tz = 0; // strip

  // Velocity (carries inertia after release)
  private vx = 0;
  private vy = 0;
  private vz = 0;

  // Dragging state
  private diskDragging = false;
  private stripDragging = false;
  private stripDragY0 = 0;
  private stripDragZ0 = 0;

  private rafId = 0;
  private callbacks: JogPadCallbacks = {};

  constructor(
    diskCanvas: HTMLCanvasElement,
    stripCanvas: HTMLCanvasElement,
    _accent: string,
    _label: string,
    callbacks: JogPadCallbacks = {},
  ) {
    this.diskCanvas  = diskCanvas;
    this.stripCanvas = stripCanvas;
    this.callbacks   = callbacks;
    this.dctx = diskCanvas.getContext('2d')!;
    this.sctx = stripCanvas.getContext('2d')!;
    this.bindEvents();
    this.rafId = requestAnimationFrame(this.loop);
  }

  // ── External API ───────────────────────────────────────────────────────

  updateCallbacks(cb: JogPadCallbacks) { this.callbacks = cb; }

  dispose() {
    cancelAnimationFrame(this.rafId);
    this.diskCanvas.removeEventListener('pointerdown',  this.onDiskDown  as any);
    this.stripCanvas.removeEventListener('pointerdown', this.onStripDown as any);
  }

  // ── Event binding ──────────────────────────────────────────────────────

  private bindEvents() {
    // Disk
    this.diskCanvas.addEventListener('pointerdown',  this.onDiskDown);
    window.addEventListener('pointermove',           this.onDiskMove);
    window.addEventListener('pointerup',             this.onDiskUp);
    window.addEventListener('pointercancel',         this.onDiskUp);

    // Strip
    this.stripCanvas.addEventListener('pointerdown', this.onStripDown);
    window.addEventListener('pointermove',           this.onStripMove);
    window.addEventListener('pointerup',             this.onStripUp);
    window.addEventListener('pointercancel',         this.onStripUp);

    // Centre tap (double-tap disk)
    let lastTap = 0;
    this.diskCanvas.addEventListener('click', () => {
      const now = Date.now();
      if (now - lastTap < 350) this.callbacks.onReset?.();
      lastTap = now;
    });

    // Touch pinch (two-finger) on disk — treat as Z
    this.diskCanvas.addEventListener('touchstart', this.onTouchPinchStart, { passive: false });
    this.diskCanvas.addEventListener('touchmove',  this.onTouchPinchMove,  { passive: false });
  }

  // ── Pointer handlers: Disk ─────────────────────────────────────────────

  private onDiskDown = (e: PointerEvent) => {
    e.preventDefault();
    this.diskCanvas.setPointerCapture(e.pointerId);
    this.diskDragging = true;
    this.updateDiskXY(e);
  };

  private onDiskMove = (e: PointerEvent) => {
    if (!this.diskDragging) return;
    this.updateDiskXY(e);
  };

  private onDiskUp = (_e: PointerEvent) => {
    if (!this.diskDragging) return;
    this.diskDragging = false;
    // Release with velocity equal to current deflection (smooth decay)
    this.vx = this.tx;
    this.vy = this.ty;
    this.tx = 0;
    this.ty = 0;
  };

  private updateDiskXY(e: PointerEvent) {
    const rect = this.diskCanvas.getBoundingClientRect();
    const cx   = rect.width  / 2;
    const cy   = rect.height / 2;
    const px   = e.clientX - rect.left - cx;
    const py   = e.clientY - rect.top  - cy;
    const maxR = Math.min(cx, cy) - 6;

    const dist = Math.hypot(px, py);
    const clampedDist = Math.min(dist, maxR);
    const angle = Math.atan2(py, px);

    this.tx = (Math.cos(angle) * clampedDist) / maxR;
    this.ty = (Math.sin(angle) * clampedDist) / maxR;
  }

  // ── Pointer handlers: Strip ────────────────────────────────────────────

  private onStripDown = (e: PointerEvent) => {
    e.preventDefault();
    this.stripCanvas.setPointerCapture(e.pointerId);
    this.stripDragging = true;
    this.stripDragY0 = e.clientY;
    this.stripDragZ0 = this.tz;
  };

  private onStripMove = (e: PointerEvent) => {
    if (!this.stripDragging) return;
    const dy = (e.clientY - this.stripDragY0) / (this.stripCanvas.height / 2);
    this.tz  = Math.max(-1, Math.min(1, this.stripDragZ0 - dy));
  };

  private onStripUp = (_e: PointerEvent) => {
    if (!this.stripDragging) return;
    this.stripDragging = false;
    this.vz = this.tz;
    this.tz = 0;
  };

  // ── Touch pinch (two-finger zoom) ──────────────────────────────────────

  private pinchDist0 = 0;

  private onTouchPinchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const [t1, t2] = [e.touches[0], e.touches[1]];
      this.pinchDist0 = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    }
  };

  private onTouchPinchMove = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const delta = (dist - this.pinchDist0) / 100;
      this.callbacks.onZ?.(Math.max(-1, Math.min(1, delta)));
      this.pinchDist0 = dist;
    }
  };

  // ── Animation / Physics loop ───────────────────────────────────────────

  private loop = () => {
    this.rafId = requestAnimationFrame(this.loop);

    const x = this.diskDragging  ? this.tx : this.vx;
    const y = this.diskDragging  ? this.ty : this.vy;
    const z = this.stripDragging ? this.tz : this.vz;

    // Emit callbacks if non-trivial
    if (Math.abs(x) > 0.005 || Math.abs(y) > 0.005) this.callbacks.onXY?.(x, y);
    if (Math.abs(z) > 0.005) this.callbacks.onZ?.(z);

    // Damping on release
    if (!this.diskDragging)  { this.vx *= 0.88; this.vy *= 0.88; }
    if (!this.stripDragging) { this.vz *= 0.85; }

    this.draw(x, y, z);
  };

  // ── Canvas drawing ─────────────────────────────────────────────────────

  private draw(x: number, y: number, z: number) {
    this.drawDisk(x, y);
    this.drawStrip(z);
  }

  private drawDisk(x: number, y: number) {
    const c = this.dctx;
    const w = this.diskCanvas.width;
    const h = this.diskCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const outerR = Math.min(cx, cy) - 2;

    c.clearRect(0, 0, w, h);

    // 1. Flat circular ring: 1px --ink-20 (#BCBAB4) stroke, transparent fill
    c.beginPath();
    c.arc(cx, cy, outerR, 0, Math.PI * 2);
    c.strokeStyle = '#BCBAB4';
    c.lineWidth   = 1;
    c.stroke();

    // 2. Subtle cross-hair guide (thin --ink-10 #D8D6CE)
    c.strokeStyle = '#D8D6CE';
    c.lineWidth   = 0.5;
    c.beginPath(); c.moveTo(cx, cy - outerR + 4); c.lineTo(cx, cy + outerR - 4); c.stroke();
    c.beginPath(); c.moveTo(cx - outerR + 4, cy); c.lineTo(cx + outerR - 4, cy); c.stroke();

    // 3. Small flat --ink (#0D0D0E) dot marking current orientation (no highlight, no shadow)
    const dotR = 5;
    const maxTravel = outerR - dotR - 3;
    const tx = cx + x * maxTravel;
    const ty = cy + y * maxTravel;

    c.beginPath();
    c.arc(tx, ty, dotR, 0, Math.PI * 2);
    c.fillStyle = '#0D0D0E';
    c.fill();
  }

  private drawStrip(z: number) {
    const c  = this.sctx;
    const w  = this.stripCanvas.width;
    const h  = this.stripCanvas.height;
    const cx = w / 2;

    c.clearRect(0, 0, w, h);

    // 1. Thin --ink-10 (#D8D6CE) rectangular track (no border radius)
    const trackW = 4;
    c.fillStyle = '#D8D6CE';
    c.fillRect(cx - trackW / 2, 4, trackW, h - 8);

    // 2. --ink-80 (#2E2E32) rectangular slider thumb (no border radius)
    const ty  = 4 + (h - 8) * (1 - (z + 1) / 2);
    const segH = Math.max(10, h * 0.22);
    const thumbW = 8;

    c.fillStyle = '#2E2E32';
    c.fillRect(cx - thumbW / 2, ty - segH / 2, thumbW, segH);
  }
}
