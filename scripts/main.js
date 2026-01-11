import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import {
    Field,
    Vec2,
    Vec3,
    Bounds,
    Primitives,
    Boolean,
    Transform,
    Modify,
    Lattice,
    Sketch,
    Extrude,
    Parametric,
    Parameter,
    DerivedParameter,
    FeatureTree,
    Query,
    Selection,
    Mesher,
    MarchingCubesTables,
    Examples
} from 'field';

// Initialize CodeMirror
const editor = CodeMirror(document.getElementById('codeEditor'), {
    value: `// field.js Studio - Parametric Engineering Bracket
// Using field.js SDF primitives and boolean operations

// Base plate with rounded edges
const baseBox = Primitives.box(
  Vec3.create(0, 0, 12),
  Vec3.create(70, 50, 24)
);

// Apply fillet to soften edges
const baseRounded = Modify.fillet(baseBox, 2);

// Create mounting holes using cylinders
const hole1 = Primitives.cylinder(
  Vec3.create(-25, -15, 0),
  Vec3.create(-25, -15, 24),
  4
);

const hole2 = Primitives.cylinder(
  Vec3.create(25, -15, 0),
  Vec3.create(25, -15, 24),
  4
);

// Center mounting hole (larger)
const centerHole = Primitives.cylinder(
  Vec3.create(0, 15, 0),
  Vec3.create(0, 15, 24),
  8
);

// Subtract holes from base using boolean difference
let bracket = Boolean.difference(baseRounded, hole1);
bracket = Boolean.difference(bracket, hole2);
bracket = Boolean.difference(bracket, centerHole);

// Add support ribs using boxes
const rib1 = Primitives.box(
  Vec3.create(-20, 0, 12),
  Vec3.create(6, 50, 18)
);

const rib2 = Primitives.box(
  Vec3.create(20, 0, 12),
  Vec3.create(6, 50, 18)
);

// Union ribs to bracket
bracket = Boolean.union(bracket, rib1);
bracket = Boolean.union(bracket, rib2);

// Add boss (raised cylindrical feature)
const boss = Primitives.cylinder(
  Vec3.create(0, -15, 24),
  Vec3.create(0, -15, 29),
  15
);

bracket = Boolean.union(bracket, boss);

// Mesh the final geometry
const mesh = Mesher.marchingCubes(bracket, {
  resolution: 64,
  bounds: Bounds.expand(bracket.bounds(), 2)
});

// Return the mesh for display
return mesh;
`,
    mode: 'javascript',
    theme: 'material-darker',
    lineNumbers: true,
    lineWrapping: true,
    styleActiveLine: true,
    matchBrackets: true,
    autoCloseBrackets: true,
    indentUnit: 2,
    tabSize: 2,
    indentWithTabs: false
});

// Update status bar on cursor activity
editor.on('cursorActivity', () => {
    const cursor = editor.getCursor();
    document.getElementById('statusText').textContent =
        `ln ${cursor.line + 1}, col ${cursor.ch + 1}`;
});

// Three.js Setup
const canvas = document.getElementById('three-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
    50,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    1000
);
camera.position.set(3, 2, 4);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
});
renderer.setSize(canvas.clientWidth, canvas.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
// Distance limits will be set dynamically based on geometry

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
directionalLight2.position.set(-5, -5, -5);
scene.add(directionalLight2);

// Grid
let gridHelper = new THREE.GridHelper(10, 20, 0x222222, 0x111111);
scene.add(gridHelper);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
});

// Panel Resizing
const resizer = document.getElementById('resizer');
const codePanel = document.getElementById('codePanel');
let isResizing = false;

resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const containerWidth = document.querySelector('.main-container').offsetWidth;
    const newWidth = (e.clientX / containerWidth) * 100;

    if (newWidth > 20 && newWidth < 80) {
        codePanel.style.width = newWidth + '%';
    }
});

document.addEventListener('mouseup', () => {
    if (isResizing) {
        isResizing = false;
        resizer.classList.remove('dragging');
        document.body.style.cursor = 'default';

        // Trigger resize for CodeMirror and Three.js
        editor.refresh();
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    }
});

// Execute Code using Function constructor
function executeCode() {
    const code = editor.getValue();

    try {
        // Clear existing meshes (except lights and grid)
        const objectsToRemove = [];
        scene.children.forEach(child => {
            if (child.isMesh) {
                objectsToRemove.push(child);
            }
        });
        objectsToRemove.forEach(obj => scene.remove(obj));

        // Create a function with all field.js exports and THREE in scope
        const userFunction = new Function(
            'Field',
            'Vec2',
            'Vec3',
            'Bounds',
            'Primitives',
            'Boolean',
            'Transform',
            'Modify',
            'Lattice',
            'Sketch',
            'Extrude',
            'Parametric',
            'Parameter',
            'DerivedParameter',
            'FeatureTree',
            'Query',
            'Selection',
            'Mesher',
            'MarchingCubesTables',
            'Examples',
            'THREE',
            'scene',
            code
        );

        // Execute the function with the proper context
        const result = userFunction(
            Field,
            Vec2,
            Vec3,
            Bounds,
            Primitives,
            Boolean,
            Transform,
            Modify,
            Lattice,
            Sketch,
            Extrude,
            Parametric,
            Parameter,
            DerivedParameter,
            FeatureTree,
            Query,
            Selection,
            Mesher,
            MarchingCubesTables,
            Examples,
            THREE,
            scene
        );

        // If the code returns a mesh object from field.js, convert it to THREE.js
        if (result && result.vertices && result.indices) {
            const geometry = new THREE.BufferGeometry();
            
            // field.js returns Float32Array vertices and Uint32Array indices
            // vertices is already a flat array [x0, y0, z0, x1, y1, z1, ...]
            geometry.setAttribute('position', new THREE.BufferAttribute(result.vertices, 3));
            
            // indices is already a Uint32Array
            geometry.setIndex(new THREE.BufferAttribute(result.indices, 1));
            
            // Use provided normals if available, otherwise compute them
            if (result.normals) {
                geometry.setAttribute('normal', new THREE.BufferAttribute(result.normals, 3));
            } else {
                geometry.computeVertexNormals();
            }
            
            // Compute bounding box for camera positioning
            geometry.computeBoundingBox();
            
            console.log('Geometry bounding box:', geometry.boundingBox);
            
            const material = new THREE.MeshNormalMaterial({
                side: THREE.DoubleSide,
                flatShading: false,
                wireframe: isWireframeMode
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);
            
            // Position camera based on geometry bounds
            if (geometry.boundingBox) {
                const bbox = geometry.boundingBox;
                
                const x = {
                    max: bbox.max.x,
                    min: bbox.min.x,
                    center: (bbox.max.x + bbox.min.x) / 2,
                };
                
                const y = {
                    max: bbox.max.y,
                    min: bbox.min.y,
                    center: (bbox.max.y + bbox.min.y) / 2,
                };
                
                const z = {
                    max: bbox.max.z,
                    min: bbox.min.z,
                    center: (bbox.max.z + bbox.min.z) / 2,
                };
                
                // Calculate bounding sphere radius
                const r = Math.sqrt(
                    Math.pow(x.max - x.min, 2) + 
                    Math.pow(y.max - y.min, 2) + 
                    Math.pow(z.max - z.min, 2)
                );
                
                // Center the mesh at origin
                mesh.position.set(-x.center, -y.center, -z.center);
                
                // Calculate camera distance based on bounding sphere
                // theta must be less than 90deg, higher theta means farther object
                const d = (r / 2) * Math.tan(Math.PI / 2.65);
                
                // Since mesh is centered at origin, camera should be positioned relative to origin
                camera.position.set(d, d, d);
                
                // Look at the origin (where the mesh is now centered)
                camera.lookAt(0, 0, 0);
                
                // Update camera near and far planes
                camera.near = d / 100;
                camera.far = 4 * d;
                camera.updateProjectionMatrix();
                
                // Update controls target to origin
                controls.target.set(0, 0, 0);
                
                // Update orbit controls distance limits
                controls.minDistance = r * 0.5;
                controls.maxDistance = d * 3;
                
                controls.update();
                
                console.log('Camera positioned at:', camera.position, 'Distance:', d, 'Radius:', r);
            }
        }

        // Update triangle count
        let triangles = 0;
        scene.children.forEach(child => {
            if (child.isMesh && child.geometry) {
                const indexCount = child.geometry.index ? 
                    child.geometry.index.count : 
                    child.geometry.attributes.position.count;
                triangles += indexCount / 3;
            }
        });
        document.getElementById('triangleCount').textContent =
            `${Math.floor(triangles)} triangles`;

    } catch (error) {
        console.error('Execution error:', error);
        alert('Error: ' + error.message);
    }
}

// Clear Scene
function clearScene() {
    const objectsToRemove = [];
    scene.children.forEach(child => {
        if (child.isMesh) {
            objectsToRemove.push(child);
        }
    });
    objectsToRemove.forEach(obj => scene.remove(obj));

    document.getElementById('triangleCount').textContent = '0 triangles';
}

// Export STL (placeholder)
function exportSTL() {
    alert('STL export not yet implemented');
}

// Camera Controls
function resetCamera() {
    camera.position.set(3, 2, 4);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
}

function zoomIn() {
    camera.position.multiplyScalar(0.9);
}

function zoomOut() {
    camera.position.multiplyScalar(1.1);
}

function toggleGrid() {
    gridHelper.visible = !gridHelper.visible;
}

// Wireframe toggle
let isWireframeMode = false;

function toggleWireframe() {
    isWireframeMode = !isWireframeMode;
    
    scene.children.forEach(child => {
        if (child.isMesh && child.material) {
            child.material.wireframe = isWireframeMode;
        }
    });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Header buttons
    document.getElementById('clearBtn')?.addEventListener('click', clearScene);
    document.getElementById('exportBtn')?.addEventListener('click', exportSTL);
    document.getElementById('runBtn')?.addEventListener('click', executeCode);
    
    // Viewer controls
    document.getElementById('resetCameraBtn')?.addEventListener('click', resetCamera);
    document.getElementById('toggleGridBtn')?.addEventListener('click', toggleGrid);
    document.getElementById('toggleWireframeBtn')?.addEventListener('click', toggleWireframe);
    document.getElementById('zoomInBtn')?.addEventListener('click', zoomIn);
    document.getElementById('zoomOutBtn')?.addEventListener('click', zoomOut);
    document.getElementById('resetViewBtn')?.addEventListener('click', resetCamera);
    
    // Execute initial code
    executeCode();
});