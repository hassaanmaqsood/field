/**
 * JogPad — a touch/mouse-friendly joystick controller.
 *
 * Each pad has:
 *   - A circular disk (XY control): reports normalised dx/dy in [-1, 1]
 *   - A vertical strip (Z/zoom):    reports normalised dz in [-1, 1]
 *   - A centre-tap callback
 *
 * Physics: thumbstick springs back to centre on release with configurable damping.
 * Velocity is emitted continuously via requestAnimationFrame while the pad is held
 * OR while the spring is still decaying.
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
  private accent: string;
  private label: string;

  constructor(
    diskCanvas: HTMLCanvasElement,
    stripCanvas: HTMLCanvasElement,
    accent: string,
    label: string,
    callbacks: JogPadCallbacks = {},
  ) {
    this.diskCanvas  = diskCanvas;
    this.stripCanvas = stripCanvas;
    this.accent      = accent;
    this.label       = label;
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
    this.diskCanvas.addEventListener('touchend',   this.onTouchPinchEnd,   { passive: false });
  }

  // ── Disk pointer events ────────────────────────────────────────────────

  private diskCenter = () => {
    const r = this.diskCanvas.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, radius: r.width / 2 - 6 };
  };

  private onDiskDown = (e: PointerEvent) => {
    this.diskDragging = true;
    this.diskCanvas.setPointerCapture(e.pointerId);
  };

  private onDiskMove = (e: PointerEvent) => {
    if (!this.diskDragging) return;
    const { cx, cy, radius } = this.diskCenter();
    const dx = (e.clientX - cx) / radius;
    const dy = (e.clientY - cy) / radius;
    const mag = Math.hypot(dx, dy);
    const clamped = mag > 1 ? 1 / mag : 1;
    this.tx = dx * clamped;
    this.ty = dy * clamped;
  };

  private onDiskUp = (_e: PointerEvent) => {
    if (!this.diskDragging) return;
    this.diskDragging = false;
    // Hand-off velocity to inertia
    this.vx = this.tx;
    this.vy = this.ty;
    this.tx = 0;
    this.ty = 0;
  };

  // ── Strip pointer events ───────────────────────────────────────────────

  private onStripDown = (e: PointerEvent) => {
    this.stripDragging = true;
    this.stripDragY0 = e.clientY;
    this.stripDragZ0 = this.tz;
    this.stripCanvas.setPointerCapture(e.pointerId);
  };

  private onStripMove = (e: PointerEvent) => {
    if (!this.stripDragging) return;
    const r = this.stripCanvas.getBoundingClientRect();
    const delta = (e.clientY - this.stripDragY0) / r.height;
    this.tz = Math.max(-1, Math.min(1, this.stripDragZ0 + delta * 2));
  };

  private onStripUp = () => {
    if (!this.stripDragging) return;
    this.stripDragging = false;
    this.vz = this.tz;
    this.tz = 0;
  };

  // ── Touch pinch (two-finger) → Z ──────────────────────────────────────

  private pinchDist0 = 0;
  private pinchZ0    = 0;

  private onTouchPinchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const t = e.touches;
      this.pinchDist0 = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
      this.pinchZ0 = this.tz;
    }
  };

  private onTouchPinchMove = (e: TouchEvent) => {
    if (e.touches.length === 2 && this.pinchDist0 > 0) {
      e.preventDefault();
      const t = e.touches;
      const dist = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
      const ratio = dist / this.pinchDist0;
      this.tz = Math.max(-1, Math.min(1, this.pinchZ0 + (ratio - 1) * 2));
    }
  };

  private onTouchPinchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) {
      this.vz = this.tz * 0.5;
      this.tz = 0;
      this.pinchDist0 = 0;
    }
  };

  // ── Animation loop ─────────────────────────────────────────────────────

  private loop = () => {
    this.rafId = requestAnimationFrame(this.loop);

    // Active stick values (dragging) + inertia values (released)
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
    const thumbR = 14;

    c.clearRect(0, 0, w, h);

    // Outer ring
    c.beginPath();
    c.arc(cx, cy, outerR, 0, Math.PI * 2);
    c.fillStyle   = 'rgba(250,248,244,0.82)';
    c.fill();
    c.strokeStyle = 'rgba(180,168,148,0.6)';
    c.lineWidth   = 1;
    c.stroke();

    // Cross-hair guides
    c.strokeStyle = 'rgba(180,168,148,0.3)';
    c.lineWidth   = 0.5;
    c.beginPath(); c.moveTo(cx, cy - outerR + 4); c.lineTo(cx, cy + outerR - 4); c.stroke();
    c.beginPath(); c.moveTo(cx - outerR + 4, cy); c.lineTo(cx + outerR - 4, cy); c.stroke();

    // Thumb dot
    const tx = cx + x * (outerR - thumbR - 2);
    const ty = cy + y * (outerR - thumbR - 2);

    const grad = c.createRadialGradient(tx - 3, ty - 3, 1, tx, ty, thumbR);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, this.accent + 'cc');

    c.beginPath();
    c.arc(tx, ty, thumbR, 0, Math.PI * 2);
    c.fillStyle = grad;
    c.fill();
    c.strokeStyle = this.accent;
    c.lineWidth   = 1.5;
    c.stroke();

    // Label
    c.fillStyle   = 'rgba(130,120,110,0.7)';
    c.font        = `500 8px "Inter", sans-serif`;
    c.textAlign   = 'center';
    c.fillText(this.label, cx, h - 4);
  }

  private drawStrip(z: number) {
    const c  = this.sctx;
    const w  = this.stripCanvas.width;
    const h  = this.stripCanvas.height;
    const cx = w / 2;

    c.clearRect(0, 0, w, h);

    // Track
    c.beginPath();
    c.roundRect(cx - 3, 4, 6, h - 8, 3);
    c.fillStyle   = 'rgba(230,225,215,0.82)';
    c.fill();
    c.strokeStyle = 'rgba(180,168,148,0.5)';
    c.lineWidth   = 1;
    c.stroke();

    // Thumb
    const ty  = 4 + (h - 8) * (1 - (z + 1) / 2);
    const seg = h * 0.25;

    c.beginPath();
    c.roundRect(cx - 4, ty - seg / 2, 8, seg, 3);
    c.fillStyle = this.accent + 'bb';
    c.fill();
    c.strokeStyle = this.accent;
    c.lineWidth   = 1;
    c.stroke();
  }
}
