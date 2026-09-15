# Field Runtime — Python Module for Jupyter & Google Colab

Interactive 3D field mathematics visualiser for Jupyter notebooks, Google Colab, and Python workflows.

---

## 🚀 Quickstart in Google Colab / Jupyter

In a Google Colab notebook cell:

```python
# 1. Install directly from GitHub repository
!pip install "git+https://github.com/hassaanmaqsood/field.git#subdirectory=python"

# 2. Import and visualize
from field import Field

# Create a field with differential operators and display it
f = Field.preset("radial").gradient()
f
```

Simply evaluating `f` at the end of any notebook cell will automatically render the interactive 3D viewer via the `_repr_html_()` display hook.

---

## 📖 Features & Usage

### 1. Analytic Presets
```python
from field_runtime import Field

# Radial concentric shells ℝ³→ℝ
f1 = Field.preset("radial")

# Hyperbolic saddle
f2 = Field.preset("saddle")

# 3D rotational vortex
f3 = Field.preset("vortex")

# 4D Hopf torus projection
f4 = Field.preset("rotor4d")

# Symmetric 3x3 stress tensor
f5 = Field.preset("stressTensor")
```

### 2. Custom Mathematical Expressions
```python
# Scalar field
f = Field.expr("sin(x) * cos(y) - 0.3 * z", domain={"x": (-5, 5), "y": (-5, 5), "z": (-5, 5)})

# Vector field
v = Field.vector("[-y, x, 0.2 * z]")
```

### 3. Custom Discrete Fields (Baked Grids)
You can instantiate a discrete field by "baking" an analytic expression onto a voxel grid. This simulates passing a 3D array of discrete data (e.g., from numpy).
```python
# Create a discrete representation of a field by baking it to a 64x64x64 grid
discrete_field = Field.preset("radial").bake(res=64)
```

### 4. Differential Operators
Apply coordinate-free differential operators:
```python
# Gradient ∇f (yields vector field)
f = Field.preset("radial").gradient()

# Divergence ∇·F (yields scalar field)
div = Field.vector("[-y, x, 0.2 * z]").divergence()

# Curl ∇×F
curl = Field.vector("[-y, x, 0]").curl()

# Laplacian ∇²f
lap = Field.preset("saddle").laplacian()
```

### 4. Customizing Visualisation Layers
```python
f = Field.preset("dipole")

# Add isosurface
f.view.iso(level=0.2, color="#1D4ED8", opacity=0.85)

# Add streamlines
f.view.streamlines(seeds=64, steps=180, cmap="viridis")

# Add cross-sectional slice
f.view.slice(axis="z", value=0.0, cmap="plasma")
```

### 5. Custom Domain & Sampling Resolution
```python
f.sample(
    res=64,
    box={"x": (-6, 6), "y": (-6, 6), "z": (-6, 6)}
)
```

### 6. Plotting Multiple Fields
You can combine and plot multiple independent fields in the same view:
```python
import field_runtime as fr

f1 = fr.Field.preset("radial").view.iso(level=0.5, color="#1D4ED8")
f2 = fr.Field.preset("saddle").view.iso(level=0.0, color="#EF4444")

# Renders both fields overlaid in the same interactive viewer
fr.show(f1, f2)
```

### 7. Exporting to Standalone HTML
```python
# Save standalone shareable HTML file
f.save_html("my_field.html")

# Open directly in browser
f.open_browser()

# Inspect generated declarative syntax
print(f.to_code())
```

---

## ⚙️ Configuring Custom Web Viewer URL
By default, the Python module loads the official GitHub Pages deployment. You can point to your own GitHub Pages or a local server:

```python
import field_runtime as fr

# Use your own GitHub Pages deployment:
fr.set_viewer_url("https://<username>.github.io/<repo>/")

# Or local development server:
fr.set_viewer_url("http://localhost:5173/")
```
Or set the environment variable:
```bash
export FIELD_RUNTIME_URL="https://<username>.github.io/<repo>/"
```
