# Field Runtime

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python: 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/)
[![TypeScript: 5.x](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

An interactive 3D Field Mathematics Runtime and Visualizer with unified continuous-algebra operations, GPU-accelerated raymarching, and companion Jupyter / Google Colab integration.

---

## Highlights

- **Unified Field Algebra**: First-class algebraic and differential operators (gradient, divergence, curl, Laplacian, norm, normalize, slice, bake/fit) defined generically over arbitrary field representations.
- **Continuous & Discrete Parity**: Analytic formulas and discrete sampled grids are consumed interchangeably by renderers and operators without continuity-class branching.
- **GPU Raymarched Visualization**: Interactive real-time 3D isosurfaces, dynamic vector/tensor glyphs, cross-sectional slice planes, and click-to-probe numerical inspection powered by Three.js.
- **Python & Google Colab SDK**: Interactive Jupyter notebook display protocol (`_repr_html_`), enabling instant interactive 3D cell outputs directly from symbolic Python definitions.

---

## Quickstart

### 1. Web Visualizer

```bash
# Clone the repository
git clone https://github.com/hassaanmaqsood/field.git
cd field

# Install dependencies and start development server
npm install
npm run dev

# Run test suite
npm run test

# Production build
npm run build
```

### 2. Python Package (Local Development)

```bash
# Install package in editable mode with Jupyter and test dependencies
pip install -e "./python[jupyter,dev]"

# Run Python test suite
pytest python/tests
```

### 3. Google Colab / Remote Jupyter

Install directly from GitHub in any notebook cell:

```python
!pip install "git+https://github.com/hassaanmaqsood/field.git#subdirectory=python"
```

```python
from field import Field

# Define an analytic field and compute its vector gradient
f = Field.preset("radial").gradient()

# In Jupyter / Colab, evaluating the field automatically embeds the interactive 3D viewer:
f
```

### 4. Custom Vector Expressions & Discrete Fields

You can construct arbitrary scalar and vector expressions:

```python
# Custom scalar field
f_scalar = Field.expr("sin(x) * cos(y)")

# Custom vector field (requires array brackets)
f_vector = Field.vector("[sin(y), cos(x), 0.5*z]")
```

To create and use **discrete fields** (such as voxel grids of data), you can bake any analytic expression into a discrete sampled grid to simulate passing numpy/CSV arrays:

```python
# Creates a 64x64x64 discrete voxel grid representation
f_discrete = Field.expr("x^2 + y^2").bake(res=64)
```

### 5. Plotting Multiple Fields

You can plot multiple fields simultaneously in the same viewer:

```python
import field_runtime as fr

f1 = fr.Field.preset("radial").view.iso(level=0.5, color="#1D4ED8")
f2 = fr.Field.preset("saddle").view.iso(level=0.0, color="#EF4444")

fr.show(f1, f2)
```

---

## Repository Structure

```
├── .github/
│   └── workflows/
│       ├── ci.yml            # CI: Vitest, TypeScript check, and pytest matrix
│       └── deploy.yml        # GitHub Pages deployment workflow
├── python/
│   ├── field_runtime/        # Python library (Field, FieldViewer, Expression Builder)
│   ├── examples/             # Google Colab demo notebooks
│   ├── tests/                # Python unit tests
│   ├── pyproject.toml        # PEP 517/518 build metadata & dependencies
│   └── setup.py              # Backward-compatible setuptools script
├── src/
│   ├── algebra/              # Arithmetic, boolean, differential, slicing operators
│   ├── backends/             # AnalyticField & GridField (multilinear interpolation)
│   ├── compute/              # Web worker evaluation pools
│   ├── plugins/              # Discipline plugins (e.g. mechanical von Mises stress)
│   ├── presets/              # Built-in fields & formula parsers
│   ├── protocol/             # Core Field protocol & BaseField fallback implementations
│   ├── render/               # Three.js scene, raymarching, slice planes, and glyphs
│   ├── serialize/            # Field graph serialization and deserialization
│   ├── ui/                   # Interactive controls, CodeMirror editor, and inspector
│   ├── main.ts               # Application entrypoint
│   └── style.css             # Visualizer styles
├── tests/                    # TypeScript / Vitest test suite
├── index.html                # Visualizer HTML shell
├── package.json              # Web package configuration & dependencies
├── CONTRIBUTING.md           # Contribution guidelines & dev workflow
├── LICENSE                   # MIT License
└── vite.config.ts            # Vite configuration with relative base paths for Pages
```

---

## Architectural Principles

1. **Uniform Interface Over Continuity Classes**: Render and compute code interact with fields solely through `field.at(p)` and `field.grad(p)` regardless of whether the field is analytic, discrete, or composed across operations.
2. **Operator Registry Dispatch**: `compose(op, ...)` resolves through a dynamic operator registry (`src/algebra/registry.ts`), enabling pluggable extensions without modifying the core class hierarchy.
3. **Exact Derivatives on Discrete Fits**: While `GridField.grad()` uses a central finite-difference fallback, `fit()` leverages `GridField.analyticGrad()` to calculate exact multilinear interpolant derivatives.
4. **Isosurface Raymarching**: Uses a baked 3D texture pipeline so both continuous analytic equations and discrete volume samples traverse identical rendering paths.

---

## Verification & Acceptance Criteria

| Criterion | Location | Status |
|---|---|---|
| **Protocol Conformance** | `tests/protocol-conformance.test.ts` | Passing (12/12) |
| **Algebraic Laws** | `tests/algebraic-laws.test.ts` | Passing (2/2) |
| **Gradient Correctness** | `tests/gradient-correctness.test.ts` | Passing (3/3) |
| **Cross-Backend Agreement** | `tests/cross-backend-agreement.test.ts` | Passing (2/2) |
| **End-to-End Pipeline** | `tests/end-to-end-pipeline.test.ts` | Passing (2/2) |
| **Python Runtime Suite** | `python/tests/test_field_runtime.py` | Passing (6/6) |

---

## GitHub Pages Deployment

The web visualizer is configured for GitHub Pages (`base: './'`).

1. Go to repository **Settings** → **Pages**.
2. Set **Build and deployment Source** to **GitHub Actions**.
3. Pushes to `main` will automatically trigger `.github/workflows/deploy.yml`.

---

## Contributing

Contributions are welcome! Please check out [CONTRIBUTING.md](CONTRIBUTING.md) for details on setting up your local environment, coding guidelines, and submitting pull requests.

---

## License

This project is licensed under the [MIT License](LICENSE).
