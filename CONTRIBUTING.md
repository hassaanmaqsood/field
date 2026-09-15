# Contributing to Field Runtime

Thank you for your interest in contributing to Field Runtime! We welcome contributions, bug reports, documentation improvements, and feature suggestions.

---

## Architecture Overview

Field Runtime is structured as a dual-stack project:
1. **Interactive Web Visualizer & Protocol Implementation** (`src/`, `tests/`):
   - Written in TypeScript using Three.js and custom raymarching / vector glyph rendering.
   - Built with Vite and Vitest.
2. **Python Companion Package** (`python/`):
   - Package name: `field-runtime`
   - Provides Jupyter and Google Colab bindings, symbolic expression building, and interactive iframe embedding.

---

## Development Setup

### 1. Prerequisites
- **Node.js**: v18+ (v20+ recommended)
- **npm**: v9+
- **Python**: v3.8+ (v3.10+ recommended)

### 2. Web Visualizer Setup

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev

# Run Vitest test suite
npm run test

# Run type check and production build
npm run build
```

### 3. Python Package Setup

It is recommended to use a virtual environment:

```bash
# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install the Python package in editable mode with development & Jupyter extras
pip install -e "./python[jupyter,dev]"

# Run Python tests
pytest python/tests
# or with standard unittest:
python -m unittest discover -s python/tests
```

---

## Directory Layout

```
├── .github/
│   └── workflows/        # GitHub Actions (CI & GitHub Pages deployment)
├── python/
│   ├── field_runtime/    # Python source package (Field, Viewer, Builder)
│   ├── examples/         # Colab and Jupyter demo notebooks
│   ├── tests/            # Python unit tests
│   ├── pyproject.toml    # Python packaging metadata (PEP 517/518)
│   └── setup.py          # Backward-compatible setuptools script
├── src/
│   ├── algebra/          # Arithmetic, boolean, differential, slicing operators
│   ├── backends/         # AnalyticField and GridField backends
│   ├── compute/          # Worker thread compute pools
│   ├── plugins/          # Discipline plugins (e.g., mechanical stress)
│   ├── presets/          # Pre-configured analytic fields & formulas
│   ├── protocol/         # Core Field interface and base implementations
│   ├── render/           # Three.js scene, raymarching, and glyph visualizers
│   ├── serialize/        # Graph serialization / deserialization
│   ├── ui/               # Controls, CodeMirror formula editor, and inspector
│   ├── main.ts           # Visualizer bootstrap and event loop
│   └── style.css         # UI stylesheet
├── tests/                # TypeScript / Vitest test suite
├── index.html            # Application entrypoint HTML
├── package.json          # Node package definition and scripts
├── tsconfig.json         # TypeScript configuration
└── vite.config.ts        # Vite configuration
```

---

## Pull Request Guidelines

1. **Create a topic branch**: `git checkout -b feature/your-feature-name`
2. **Ensure tests pass**:
   - `npm run test`
   - `npm run build`
   - `pytest python/tests`
3. **Keep changes focused**: One feature or bugfix per PR.
4. **Update documentation**: Add docstrings or update `README.md` if changing public APIs.
5. **Open a PR**: Describe what was changed and why.

---

## Code of Conduct

Please maintain a welcoming, respectful, and collaborative environment. Be kind and constructive in all discussions and code reviews.
