import * as THREE from "three";

import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const container = document.querySelector("#threejs");

let width = window.innerWidth;
let height = window.innerHeight;

const camera = new THREE.PerspectiveCamera(
    35,
    width / height,
    0.01,
    100
);
camera.position.set(3, 3, 3);
const cameraTarget = new THREE.Vector3(0, 0, 0);

const scene = new THREE.Scene();
const axesHelper = new THREE.AxesHelper(width);

scene.add(new THREE.HemisphereLight(0x8d7c7c, 0x494966, 10));
scene.add(new THREE.AmbientLight(0xffd500));
scene.add(axesHelper);


const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setPixelRatio(width / height);
renderer.setSize(width, height);
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

window.addEventListener("resize", () => {
    width = window.innerWidth;
    height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
});
container.appendChild(renderer.domElement);
animate();

// --- ENGINEERING WORKFLOW START ---

// 1. PARAMETERS (Global Variables)
// Just like defining Global Variables or Equations in CAD
const boxLength = 1.0;
const boxWidth = 1.0;
const boxDepth = 1.0;

// 2. SKETCH (Defining the 2D Profile)
// In Three.js, a "Shape" is equivalent to a CAD "Sketch"
const shape = new THREE.Shape();

// Start at origin (0,0) - like clicking the origin in a Sketch
shape.moveTo(0, 0); 

// Draw the lines defined by points (Vector2 logic)
shape.lineTo(boxLength, 0);         // Line to bottom-right
shape.lineTo(boxLength, boxWidth);  // Line to top-right
shape.lineTo(0, boxWidth);          // Line to top-left
// shape.lineTo(0, 0);              // Close the loop (Three.js does this automatically)

// 3. EXTRUSION (Creating the 3D Feature)
// Define the extrusion settings (blind depth, bevels, etc.)
const extrudeSettings = {
    steps: 1,                // Number of subdivision segments along depth
    depth: boxDepth,         // The extrusion distance (Z-axis relative to shape)
    bevelEnabled: false      // Keep edges sharp (like a machined block)
};

// Create the geometry based on the Sketch (shape) and Feature (settings)
const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

// 4. MATERIAL & MESH (The "Part" file)
// A Standard Material reacts to light (like plastic or metal)
const standardMaterial = new THREE.MeshNormalMaterial({ 
    color: 0x00aaff, 
    roughness: 0.5,
    metalness: 0.1 
});

/* A Normal Material visually encodes face normals into RGB colors. 
It's often used for debugging lighting and normal directions.*/
const normalMaterial = new THREE.MeshNormalMaterial();

const cubePart = new THREE.Mesh(geometry, normalMaterial);

// OPTIONAL: Center the geometry pivot (CAD often centers origins differently)
geometry.center(); 

scene.add(cubePart);

// --- ENGINEERING WORKFLOW END ---

function animate() {
    window.requestAnimationFrame(animate);
    render();
    controls.update();
}

function render() {
    camera.lookAt(cameraTarget);
    renderer.render(scene, camera);
}
