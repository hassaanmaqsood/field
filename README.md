# Field

> A vanilla JavaScript library for browser-based parametric 3D modeling using Signed Distance Functions (SDFs)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.3.0-green.svg)](https://github.com/yourhassaanmaqsood/field.js)

## ✨ Features

- **🎯 Pure SDF-based modeling** - Mathematical approach to 3D geometry
- **🔧 Solid primitives** - Sphere, box, cylinder, cone, torus, capsule
- **🔀 Boolean operations** - Union, intersection, difference, smooth blending
- **📐 Transformations** - Translate, rotate, scale, mirror, twist
- **🏗️ Advanced operations** - Shell, fillet, offset, extrusion, revolve
- **🕸️ Lattice structures** - Gyroid, Schwarz P, Diamond, Cubic, Octet
- **📊 Mesh generation** - Proper Marching Cubes with 256-case lookup tables
- **💾 Export formats** - STL (binary), OBJ with correct face normals
- **⚡ Parametric design** - Reactive parameters with automatic updates
- **🎨 Zero dependencies** - Pure vanilla JavaScript, works in any browser

## 🚀 Quick Start

```javascript
import { Primitives, Boolean, Modify, Mesher } from './field.js';

// Create a sphere with holes
const sphere = Primitives.sphere({ x: 0, y: 0, z: 0 }, 50);
const hole1 = Primitives.cylinder(
  { x: -60, y: 0, z: 0 },
  { x: 60, y: 0, z: 0 },
  15
);
const hole2 = Primitives.cylinder(
  { x: 0, y: -60, z: 0 },
  { x: 0, y: 60, z: 0 },
  15
);

// Boolean operations
const withHoles = Boolean.difference(sphere, Boolean.union(hole1, hole2));
const filleted = Modify.fillet(withHoles, 5);

// Generate mesh
const mesh = Mesher.marchingCubes(filleted, {
  resolution: 64,
  onProgress: (percent, msg) => console.log(`${percent}%: ${msg}`)
});

// Export to STL
const stlData = Mesher.toSTL(mesh, 'bracket');
downloadFile('bracket.stl', stlData);
```

## 📦 Installation

```bash
# Download the file
curl -O https://raw.githubusercontent.com/hassaanmaqsood/field/main/field.js

# Or use in browser directly
<script type="module">
  import { Primitives, Boolean, Mesher } from './field.js';
  // Your code here
</script>
```

## 🎓 Examples

### Lattice Sphere

```javascript
import { Primitives, Boolean, Modify, Lattice, Mesher } from './field.js';

const outer = Primitives.sphere({ x: 0, y: 0, z: 0 }, 50);
const shell = Modify.shell(outer, 3);

const latticeBounds = {
  min: { x: -47, y: -47, z: -47 },
  max: { x: 47, y: 47, z: 47 }
};
const lattice = Lattice.gyroid(latticeBounds, 10, 0.3);
const filled = Boolean.union(shell, lattice);

const mesh = Mesher.marchingCubes(filled, { resolution: 128 });
```

### Parametric Design

```javascript
import { Parametric, Primitives, Boolean } from './field.js';

// Create parameters
const diameter = Parametric.param('diameter', 20, 10, 50);
const length = Parametric.param('length', 60, 20, 100);
const headHeight = Parametric.derived('headHeight', (d) => d * 0.7, diameter);

// Build parametric model
const bolt = Parametric.field((d, l, hh) => {
  const shaft = Primitives.cylinder(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: l },
    d / 2
  );
  const head = Primitives.cylinder(
    { x: 0, y: 0, z: l },
    { x: 0, y: 0, z: l + hh },
    d * 0.75
  );
  return Boolean.union(shaft, head);
}, diameter, length, headHeight);

// Change parameters - model updates automatically
diameter.value = 30;
length.value = 80;

// Get current geometry
const mesh = Mesher.marchingCubes(bolt.current, { resolution: 64 });
```

### Sketch & Extrude

```javascript
import { Sketch, Extrude, Mesher } from './field.js';

// Create 2D profile
const sketch = new Sketch();
sketch
  .circle({ x: 0, y: 0 }, 20)
  .close();

// Extrude to 3D
const cylinder = Extrude.linear(
  sketch,
  { x: 0, y: 0, z: 1 },  // Direction
  50                      // Distance
);

const mesh = Mesher.marchingCubes(cylinder, { resolution: 64 });
```

## 📚 API Reference

### Primitives

```javascript
Primitives.sphere(center, radius)
Primitives.box(center, size)
Primitives.cylinder(start, end, radius)
Primitives.cone(base, tip, radius)
Primitives.torus(center, normal, majorRadius, minorRadius)
Primitives.capsule(start, end, radius)
Primitives.plane(point, normal)
```

### Boolean Operations

```javascript
Boolean.union(...fields)              // Combine shapes
Boolean.intersection(...fields)       // Intersect shapes
Boolean.difference(a, b)              // Subtract b from a
Boolean.xor(a, b)                     // Symmetric difference
Boolean.smoothUnion(fields, radius)   // Smooth blend
Boolean.smoothIntersection(fields, r) // Smooth intersect
```

### Transformations

```javascript
Transform.translate(field, offset)
Transform.rotate(field, axis, angle, center)
Transform.scale(field, scale, center)
Transform.mirror(field, planePoint, planeNormal)
Transform.twist(field, axis, amount, center)
```

### Modifications

```javascript
Modify.offset(field, distance)        // Expand/contract
Modify.shell(field, thickness)        // Hollow out
Modify.fillet(field, radius)          // Round edges
Modify.chamfer(field, distance)       // Bevel edges
Modify.blend(field, amount)           // Smooth surface
```

### Lattice Structures

```javascript
Lattice.gyroid(bounds, cellSize, thickness)
Lattice.schwarzP(bounds, cellSize, thickness)
Lattice.diamond(bounds, cellSize, thickness)
Lattice.schwarzD(bounds, cellSize, thickness)
Lattice.cubic(bounds, cellSize, beamThickness)
Lattice.octet(bounds, cellSize, beamThickness)
```

### Meshing

```javascript
const mesh = Mesher.marchingCubes(field, {
  resolution: 64,           // Grid resolution
  maxMemoryMB: 512,        // Memory limit
  onProgress: (pct, msg) => {} // Progress callback
});

const stlData = Mesher.toSTL(mesh, 'model');
const objData = Mesher.toOBJ(mesh, 'model');
const stats = Mesher.analyze(mesh);
```

## ⚙️ Performance Tips

1. **Start with low resolution** (32-64) for testing, increase for final export
2. **Use progress callbacks** for operations over 64³ resolution
3. **Respect memory limits** - 128³ ≈ 8 MB, 256³ ≈ 67 MB, 512³ ≈ 536 MB
4. **Apply modifications before non-uniform scaling** to preserve SDF properties
5. **Bound your lattices** to specific regions for better performance

```javascript
// Good practice
const mesh = Mesher.marchingCubes(field, {
  resolution: 128,
  maxMemoryMB: 512,
  onProgress: (percent, message) => {
    console.log(`${percent}%: ${message}`);
    updateProgressBar(percent);
  }
});
```

## 🐛 Bug Fixes (v3.0.0)

This version includes **13 critical bug fixes**:

- ✅ Proper Marching Cubes with 256-case lookup tables
- ✅ Correct STL face normals (geometric, not averaged)
- ✅ Solid primitives (cylinders/cones now have proper caps)
- ✅ Flat extrusion surfaces (no pillow effect)
- ✅ Bounded lattice structures (no infinite extent)
- ✅ Memory limits with helpful warnings
- ✅ Tight rotation bounds (not 100x oversized)
- ✅ Progress callbacks for long operations

See [BUG-FIX-REPORT.md](BUG-FIX-REPORT.md) for detailed technical documentation.

## 📖 Documentation

- **[Quick Start Guide](QUICK-START-GUIDE.md)** - Examples and tutorials
- **[Bug Fix Report](BUG-FIX-REPORT.md)** - Technical details of all fixes
- **[API Documentation](#api-reference)** - Complete API reference (above)

## 🎯 Use Cases

- **3D Printing** - Generate STL files for FDM/SLA printers
- **Parametric Design** - Create configurable models with reactive parameters
- **Generative Art** - Algorithmic 3D modeling
- **CAD in Browser** - No installation required, works in any modern browser
- **Educational Tools** - Learn SDF-based modeling
- **Game Assets** - Generate procedural 3D content

## 🔧 Browser Compatibility

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Any browser with ES6 module support

## ⚠️ Limitations

- **Non-uniform scaling** breaks SDF properties (warnings issued)
- **Memory usage** scales as O(n³) with resolution
- **No GPU acceleration** (pure CPU, but fast enough for most use cases)
- **Single-threaded** (no Web Workers yet)

## 🗺️ Roadmap

- [ ] Web Worker support for parallel meshing
- [ ] GPU-accelerated ray marching renderer
- [ ] NURBS surface support
- [ ] Advanced chamfer/fillet operations
- [ ] Mesh optimization (decimation, smoothing)
- [ ] Import from STL/OBJ
- [ ] Assembly/constraint system

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- Inspired by [Inigo Quilez's SDF articles](https://iquilezles.org/articles/distfunctions/)
- Marching Cubes algorithm by William E. Lorensen and Harvey E. Cline
- TPMS lattices from mathematical morphology research

## 📧 Contact

- **Issues**: [GitHub Issues](https://github.com/yourhassaanmaqsood/field/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourhassaanmaqsood/field/discussions)

---

**Made with ❤️ for the 3D modeling community**

⭐ Star this repo if you find it useful!