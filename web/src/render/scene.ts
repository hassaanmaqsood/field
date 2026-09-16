import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Bounds } from '../protocol/Field';

export type FrameListener = (dt: number, t: number) => void;

export interface SceneBundle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  /** All current field representation objects (iso mesh, glyphs, etc.) */
  fieldGroup: THREE.Group;
  /** The wireframe sample box — translates independently of fieldGroup */
  boxWire: THREE.LineSegments;
  /** Update the box wireframe to match new bounds */
  updateBoxWire(box: Bounds[]): void;
  /** Scene clock tracking elapsed time */
  clock: THREE.Clock;
  /** Register a callback to be called every animation frame */
  addFrameListener(cb: FrameListener): () => void;
}

export function createScene(canvas: HTMLCanvasElement): SceneBundle {
  const scene = new THREE.Scene();
  // Paper ground background (--ground #F5F4F0)
  scene.background = new THREE.Color(0xF5F4F0);

  const camera = new THREE.PerspectiveCamera(
    50,
    canvas.clientWidth / canvas.clientHeight,
    0.05,
    200
  );
  camera.position.set(9, 7, 11);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  // Ground grid — flat ink lines on paper ground
  const grid = new THREE.GridHelper(20, 20, 0xBCBAB4, 0xD8D6CE);
  if (grid.material && !Array.isArray(grid.material)) {
    grid.material.transparent = true;
    grid.material.opacity = 0.4;
  }
  scene.add(grid);

  // Axes helper — minimal ink lines
  const axes = new THREE.AxesHelper(1);
  if (axes.material && !Array.isArray(axes.material)) {
    axes.material.transparent = true;
    axes.material.opacity = 0.25;
  }
  scene.add(axes);

  // Field representations group
  const fieldGroup = new THREE.Group();
  scene.add(fieldGroup);

  // Sample box wireframe (thin --ink-20 outline)
  const BOX_COLOR = 0xBCBAB4;
  const boxWireGeom = new THREE.BoxGeometry(8, 8, 8);
  const boxEdges = new THREE.EdgesGeometry(boxWireGeom);
  const boxMat = new THREE.LineBasicMaterial({
    color: BOX_COLOR,
    transparent: true,
    opacity: 0.6,
  });
  const boxWire = new THREE.LineSegments(boxEdges, boxMat);
  scene.add(boxWire);

  function updateBoxWire(box: Bounds[]) {
    const DEF = { min: -4, max: 4 };
    const bx = box[0] ?? DEF;
    const by = box[1] ?? DEF;
    const bz = box[2] ?? DEF;
    const sx = bx.max - bx.min;
    const sy = by.max - by.min;
    const sz = bz.max - bz.min;
    boxWire.position.set(
      (bx.min + bx.max) / 2,
      (by.min + by.max) / 2,
      (bz.min + bz.max) / 2
    );
    boxWire.scale.set(
      Math.max(0.01, sx) / 8,
      Math.max(0.01, sy) / 8,
      Math.max(0.01, sz) / 8
    );
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // Animation clock and frame listeners
  const clock = new THREE.Clock();
  const frameListeners = new Set<FrameListener>();

  function addFrameListener(cb: FrameListener): () => void {
    frameListeners.add(cb);
    return () => frameListeners.delete(cb);
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const t = clock.getElapsedTime();
    frameListeners.forEach((cb) => {
      try {
        cb(dt, t);
      } catch (err) {
        console.error('FrameListener error:', err);
      }
    });
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return {
    scene,
    camera,
    renderer,
    controls,
    fieldGroup,
    boxWire,
    updateBoxWire,
    clock,
    addFrameListener,
  };
}
