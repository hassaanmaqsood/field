# Field — Tutorial & Getting Started

Welcome! This tutorial helps you get started with Field (the `field.js` library) and the Field Studio (browser UI). It covers quick start examples, the major API surfaces, sample code snippets, Studio usage, and **best practices** for smooth and efficient modeling. ✅

---

## 🚀 Quick Start — Minimal Example

1. Include `field.js` in the browser (or import as an ES module):

```html
<script type="module">
  import { Primitives, Boolean, Mesher } from './field.js';

  const sphere = Primitives.sphere({ x: 0, y: 0, z: 0 }, 30);
  const hole = Primitives.cylinder({ x: -20, y: 0, z: -20 }, { x: -20, y: 0, z: 20 }, 6);
  const withHole = Boolean.difference(sphere, hole);

  const mesh = Mesher.marchingCubes(withHole, {
    resolution: 64,
    bounds: withHole.bounds() // helpful to restrict sampling
  });

  const stl = Mesher.toSTL(mesh, 'model');
  // downloadFile('model.stl', stl)  // implement download helper in your app
</script>
```

2. Use low `resolution` for iteration (32–64), raise to 128–256 for final exports.

---

## 🧭 Field Studio — Workflow & Tips

Field Studio lets you write and run field.js code directly in the browser. Key controls:

- **Editor**: Edit your script (uses CodeMirror). Use the `run` button to execute.
- **Viewer**: 3D canvas with camera controls. Use `reset`, `grid`, `wireframe` toggles and zoom controls.
- **Export**: Click `export` to save STL/OBJ of the last mesh result.

Practical tips:
- Start with a **small resolution** (e.g., 32) while working in the Studio to keep feedback quick.
- Use the `bounds` parameter (e.g., `Bounds.expand(field.bounds(), 2)`) to reduce sampling volume and memory use.
- Use progress callbacks in `Mesher.marchingCubes` for long runs:

```javascript
const mesh = Mesher.marchingCubes(field, {
  resolution: 128,
  onProgress: (pct, msg) => console.log(pct, msg)
});
```

- The Studio positions the camera based on the mesh bounding box, centers the mesh, and updates controls automatically (see `scripts/main.js`).

---

## 🧩 Core Concepts & API Overview

This library is SDF-based (Signed Distance Functions). The API groups include:

- **Primitives** — solid shapes (sphere, box, cylinder, capsule, torus, cone, plane)
- **Boolean** — union, intersection, difference, XOR, smooth blends
- **Transform** — translate, rotate, scale, mirror, twist
- **Modify** — offset, shell, fillet, chamfer, blend
- **Lattice** — gyroid, Schwarz-P, Diamond, cubic/octet beams
- **Sketch & Extrude** — 2D sketching and linear/revolve extrusions
- **Parametric** — reactive parameters for interactive models
- **Mesher** — marching cubes, export utilities (STL/OBJ), analysis
- **Utilities** — `Vec2`, `Vec3`, `Bounds`, `Field` base class, sampling helpers

All functions and classes are exported from `field.js`. See the `README.md` API summary for short signatures.

---

## 🔧 Primitives — Examples

Sphere
```javascript
const s = Primitives.sphere(Vec3.create(0, 0, 0), 50);
```

Box
```javascript
const b = Primitives.box(Vec3.create(0, 0, 20), Vec3.create(80, 40, 40));
```

Cylinder (between two points)
```javascript
const c = Primitives.cylinder(
  Vec3.create(-20, 0, 0),
  Vec3.create(20, 0, 0),
  6
);
```

Torus
```javascript
const t = Primitives.torus(Vec3.create(0, 0, 0), Vec3.create(0, 0, 1), 40, 10);
```

Plane (infinite SDF plane)
```javascript
const p = Primitives.plane(Vec3.create(0, 0, 0), Vec3.create(0, 0, 1));
```

Notes:
- All primitives set reasonable `_bounds` for early culling.
- Errors are thrown on invalid parameters (e.g., non-positive radii).

---

## 🔀 Boolean Operations — Examples

Union
```javascript
const combined = Boolean.union(sphere, box);
```

Difference
```javascript
const subtracted = Boolean.difference(sphere, hole);
```

Smooth union (blend radius)
```javascript
const blended = Boolean.smoothUnion(sphere, box, 2.5);
```

Tips:
- Use Boolean operations to build complex geometry incrementally.
- Smooth blends produce gradient transitions but may increase meshing complexity.

---

## 🔁 Transformations — Examples

Translate
```javascript
const t = Transform.translate(field, Vec3.create(10, 0, 0));
```

Rotate (axis + angle)
```javascript
const r = Transform.rotate(field, Vec3.create(0, 0, 1), Math.PI / 4, Vec3.create(0, 0, 0));
```

Scale (uniform or Vec3)
```javascript
const s = Transform.scale(field, Vec3.create(2, 2, 1), field.bounds() && Bounds.center(field.bounds()));
```

Warning: Non-uniform scaling can break SDF distance properties — prefer rebuilding the shape with scaled parameters or apply scale before certain operations and retest.

---

## 🛠 Modify (Fillet, Shell, Offset) — Examples

Fillet (round edges)
```javascript
const soft = Modify.fillet(boxField, 3);
```

Shell (hollowing)
```javascript
const thin = Modify.shell(solidField, 3);
```

Offset (inflate/deflate)
```javascript
const grown = Modify.offset(solidField, 2);
```

Best practice:
- Apply `Modify` operations early when possible; avoid large fillet radii relative to geometry features.

---

## 🕸 Lattices — Examples

Create bounded gyroid lattice in a region
```javascript
const bounds = Bounds.fromCenterSize(Vec3.create(0,0,0), Vec3.create(80,80,80));
const lattice = Lattice.gyroid(bounds, 8, 0.4);
const combined = Boolean.union(shelled, lattice);
```

Tip: Always **limit** lattices to bounded regions (use Bounds); infinite lattices are not supported.

---

## ✍️ Sketch & Extrude

Sketch API lets you create 2D paths and extrude them:

```javascript
const sketch = new Sketch();
sketch.circle(Vec2.create(0, 0), 20).close();
const cylinder = Extrude.linear(sketch, Vec3.create(0, 0, 1), 50);
```

Use `Sketch` for 2D profiles; `Extrude` or `Revolve` to make solids.

---

## 🎛 Parametric Models

Parameter (single value that can be changed)
```javascript
const diameter = Parameter('diameter', 20, 10, 50);
```

DerivedParameter (computed from others)
```javascript
const headHeight = DerivedParameter('headHeight', (d) => d * 0.75, diameter);
```

Parametric.field — build reactive model
```javascript
const model = Parametric.field((diameter, length) => {
  const shaft = Primitives.cylinder(Vec3.create(0,0,0), Vec3.create(0,0,length), diameter/2);
  return shaft;
}, diameter, Parameter('length', 60));

// Update parameter values and the model will update on the next evaluation
diameter.value = 30;
```

Tip: Use parametric fields for design exploration and quick iteration in Studio.

---

## ⚙️ Meshing — Marching Cubes & Exports

Basic usage
```javascript
const mesh = Mesher.marchingCubes(field, {
  resolution: 64,
  bounds: Bounds.expand(field.bounds(), 2),
  maxMemoryMB: 512,
  onProgress: (pct, msg) => console.log(`${pct}% ${msg}`)
});

// Exports
const stl = Mesher.toSTL(mesh, 'name');
const obj = Mesher.toOBJ(mesh, 'name');

// Analyze mesh
const stats = Mesher.analyze(mesh);
console.log(stats); // triangles, normals, malformed faces, etc.
```

Key options:
- `resolution` — grid size per axis (higher => more detail, more memory)
- `bounds` — restrict sampling region to reduce memory and speed up computation
- `maxMemoryMB` — cap memory usage with helpful warnings
- `onProgress` — callback for UI progress updates

Performance rules of thumb:
- Prototype at 32–64, produce final outputs at 128–256.
- 128³ is often a good balance for many prints; 256³ is high quality but memory heavy.
- Use `Bounds.expand(field.bounds(), padding)` to add a small margin without sampling sky.

---

## ✅ Best Practices & Troubleshooting

- Use `field.bounds()` where available; if not present, create tight `Bounds` manually.
- Always prototype at a low `resolution` and only increase it for final export.
- Non-uniform scaling can break SDF correctness — prefer rebuilding shapes or using parametric approaches.
- If a mesh is missing caps (e.g., open ends), check that primitives produce proper caps (cylinders/cones in v3 are fixed to be solid).
- Use `sampleBatch` for efficient batch SDF queries.
- For normals, either accept `Mesher`'s computed normals or compute via samples and gradients for special workflows.
- Check `Mesher.analyze(mesh)` to detect malformed geometry before printing.

Common issues
- "Mesh is hollow or has holes": increase resolution or check that boolean unions/differences were applied in the expected order.
- "Too slow or runs out of memory": reduce resolution, shrink bounds, or set a lower `maxMemoryMB`.
- "Gray artifact on surface": recompute normals or export with flat shading turned off.

---

## 🔍 Advanced Topics & Tips

- Use `Field.prototype.sample(point, options)` with `options.computeNormal=false` to speed large sampling loops.
- `clone()` fields when you need to cache or branch modifications without mutating originals.
- Use `Mesher.marchingCubes` `onProgress` to attach a progress bar in the Studio UI.
- Use `Modify.parity` tricks (boolean combinations) to implement complex shelling operations.

---

## 📁 Example Walkthrough: Parametric Bracket (Studio)

1. Start from the Studio example (see `scripts/main.js` demo snippet).
2. Build base with `Primitives.box` and `Modify.fillet`.
3. Make mounting holes with `Primitives.cylinder`, subtract using `Boolean.difference`.
4. Add support ribs and bosses with `Primitives.box` / `Primitives.cylinder` and `Boolean.union`.
5. Mesh with `Mesher.marchingCubes` using `bounds: Bounds.expand(result.bounds(), 2)` and `resolution: 64`.
6. Export via `Mesher.toSTL(mesh, 'bracket')`.

---

## 🧾 Quick Reference / Cheatsheet

- Quick test: `Mesher.marchingCubes(field, { resolution: 32 })`
- Use bounds: `Bounds.expand(field.bounds(), 2)`
- Progress: pass `onProgress` in mesher options
- Export: `Mesher.toSTL(mesh, 'name')`, `Mesher.toOBJ(mesh, 'name')`

---

## 📌 Where to Look Next

- `README.md` — short examples and feature list
- `scripts/main.js` — how Studio runs and displays field.js meshes
- `field.js` — read inline JSDoc for detailed function/class docs