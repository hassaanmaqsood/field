import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Bounds } from '../protocol/Field';

export interface SceneBundle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  /** All current field representation objects (iso mesh, glyphs, etc.) */
  fieldGroup: THREE.Group;
  /** The dashed-wireframe sample box — translates independently of fieldGroup */
  boxWire: THREE.LineSegments;
  /** Update the box wireframe to match new bounds */
  updateBoxWire(box: Bounds[]): void;
}

export function createScene(canvas: HTMLCanvasElement): SceneBundle {
  const scene = new THREE.Scene();
  // Warm paper-white background for academic light theme
  scene.background = new THREE.Color(0xEDE9E0);

  const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.05, 200);
  camera.position.set(9, 7, 11);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  // Lighting — neutral, academic
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  const dir = new THREE.DirectionalLight(0xfff8ee, 1.1);
  dir.position.set(5, 10, 6);
  scene.add(ambient, dir);

  // Ground grid — subtle warm lines
  const grid = new THREE.GridHelper(20, 20, 0xC8C0B4, 0xDDD8D0);
  scene.add(grid);

  // Axes helper — small, unobtrusive
  const axes = new THREE.AxesHelper(1);
  scene.add(axes);

  // Field representations group
  const fieldGroup = new THREE.Group();
  scene.add(fieldGroup);

  // Sample box wireframe (amber/orange, dashed appearance via EdgesGeometry)
  const BOX_COLOR = 0xB45309; // amber
  let boxWireGeom = new THREE.BoxGeometry(8, 8, 8);
  let boxEdges = new THREE.EdgesGeometry(boxWireGeom);
  const boxMat = new THREE.LineBasicMaterial({ color: BOX_COLOR, linewidth: 1.5 });
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
      (bz.min + bz.max) / 2,
    );
    boxWire.scale.set(
      Math.max(0.01, sx) / 8,
      Math.max(0.01, sy) / 8,
      Math.max(0.01, sz) / 8,
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

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return { scene, camera, renderer, controls, fieldGroup, boxWire, updateBoxWire };
}

