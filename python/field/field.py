"""Fluent Field object for building, modifying, and visualizing mathematical fields."""

from typing import Dict, List, Optional, Tuple, Union

from .builder import DomainType, build_dsl, format_domain
from .viewer import FieldViewer


class ViewBuilder:
    """Helper to accumulate visualization layers onto a Field."""

    def __init__(self, field: "Field"):
        self._field = field

    def iso(
        self,
        level: Optional[float] = None,
        color: str = "#1D4ED8",
        opacity: float = 0.9,
    ) -> "Field":
        """Add a raymarched isosurface layer f(x,y,z) = level."""
        actual_level = 0.0
        if level is not None:
            actual_level = level
        elif self._field._field_spec.get("rankOut") == "[3]":
            actual_level = 1.0
            
        self._field._view_layers.append(
            f"iso {{ level: {actual_level}  color: {color}  opacity: {opacity} }}"
        )
        return self._field

    def glyphs(
        self,
        count: int = 8,
        scale: str = "auto",
        cmap: str = "viridis",
    ) -> "Field":
        """Add vector direction arrows or tensor ellipsoids."""
        self._field._view_layers.append(
            f"glyphs {{ count: {count}  scale: {scale}  cmap: {cmap} }}"
        )
        return self._field

    def streamlines(
        self,
        seeds: int = 48,
        steps: int = 150,
        tube: float = 0.02,
        cmap: str = "viridis",
    ) -> "Field":
        """Add Runge-Kutta 4 flow trajectory streamlines."""
        self._field._view_layers.append(
            f"streamlines {{ seeds: {seeds}  steps: {steps}  tube: {tube}  cmap: {cmap} }}"
        )
        return self._field

    def slice(
        self,
        axis: str = "z",
        value: float = 0.0,
        cmap: str = "viridis",
    ) -> "Field":
        """Add a 2D planar colormapped slice."""
        self._field._view_layers.append(
            f"slice {{ axis: {axis}  value: {value}  cmap: {cmap} }}"
        )
        return self._field

    def volume(
        self,
        cmap: str = "viridis",
        opacity: float = 0.8,
    ) -> "Field":
        """Add a direct volume density rendering."""
        self._field._view_layers.append(
            f"volume {{ cmap: {cmap}  opacity: {opacity} }}"
        )
        return self._field


class Field:
    """Mathematical field definition with fluent chaining, operator evaluation, and 3D display."""

    def __init__(
        self,
        preset: Optional[str] = None,
        expr: Optional[str] = None,
        domain: Optional[DomainType] = None,
        rank_out: Optional[Union[List[int], Tuple[int, ...]]] = None,
    ):
        self._field_spec: Dict[str, str] = {}
        if preset:
            self._field_spec["preset"] = preset
        if expr:
            self._field_spec["expr"] = expr
        if domain:
            self._field_spec["domain"] = format_domain(domain)
        if rank_out:
            self._field_spec["rankOut"] = str(list(rank_out))

        self._ops_list: List[str] = []
        self._view_layers: List[str] = []
        self._sample_spec: Dict[str, str] = {
            "res": "48",
            "box": "x[-4:4] y[-4:4] z[-4:4]",
        }

        self.view = ViewBuilder(self)

    # ── Factory constructors ─────────────────────────────────────────────────

    @classmethod
    def preset(
        cls,
        name: str = "radial",
        domain: Optional[DomainType] = None,
        rank_out: Optional[Union[List[int], Tuple[int, ...]]] = None,
    ) -> "Field":
        """Create a field from a built-in preset.

        Available presets:
            - 'radial': Concentric spherical shells ℝ³→ℝ
            - 'vortex': 3D rotational whirlpool [-y, x, 0.2*z] ℝ³→ℝ³
            - 'dipole': Opposing electrostatic charges ℝ³→ℝ
            - 'saddle': Hyperbolic saddle x² - y² + 0.5z² ℝ³→ℝ
            - 'rotor4d': Stereographic projection of 4D Hopf torus ℝ³→ℝ
            - 'stressTensor': Symmetric 3x3 stress tensor ℝ³→ℝ³ˣ³
        """
        f = cls(preset=name, domain=domain, rank_out=rank_out)
        if name in ["vortex"]:
            f.view.streamlines()
        elif name in ["stressTensor"]:
            f.view.glyphs()
        else:
            f.view.iso()
        return f

    @classmethod
    def expr(
        cls,
        expression: str,
        domain: Optional[DomainType] = None,
    ) -> "Field":
        """Create a scalar field from an analytic math expression.

        Example:
            >>> f = Field.expr("sin(x) * cos(y) - 0.5 * z")
        """
        f = cls(expr=expression, domain=domain)
        f.view.iso()
        return f

    @classmethod
    def vector(
        cls,
        expression: str,
        domain: Optional[DomainType] = None,
    ) -> "Field":
        """Create a vector field from component expressions.

        Example:
            >>> f = Field.vector("[-y, x, sin(z)]")
        """
        expr = expression.strip()
        if not expr.startswith("["):
            expr = f"[{expr}]"
        f = cls(expr=expr, domain=domain, rank_out=[3])
        f.view.streamlines()
        return f

    @classmethod
    def from_code(cls, code: str) -> FieldViewer:
        """Create a viewer directly from raw Field Runtime DSL code."""
        return FieldViewer(code)

    # ── Differential & Algebraic Operators ────────────────────────────────────

    def gradient(self) -> "Field":
        """Apply gradient operator ∇f (yields vector field ℝ³→ℝ³)."""
        self._ops_list.append("gradient")
        # Automatically adjust view to vector streamlines if only default iso was present
        if len(self._view_layers) == 1 and "iso" in self._view_layers[0]:
            self._view_layers = ["streamlines { seeds: 48  steps: 150  cmap: viridis }"]
        return self

    def divergence(self) -> "Field":
        """Apply divergence operator ∇·F (yields scalar field ℝ³→ℝ)."""
        self._ops_list.append("divergence")
        if len(self._view_layers) == 1 and "streamlines" in self._view_layers[0]:
            self._view_layers = ["iso { level: 0.0  color: #1D4ED8  opacity: 0.9 }"]
        return self

    def curl(self) -> "Field":
        """Apply curl operator ∇×F (yields vector field ℝ³→ℝ³)."""
        self._ops_list.append("curl")
        return self

    def laplacian(self) -> "Field":
        """Apply Laplacian operator ∇²f (yields scalar field ℝ³→ℝ)."""
        self._ops_list.append("laplacian")
        return self

    def combine(self, with_field: str, op: str = "add") -> "Field":
        """Algebraically combine with another field preset (add, subtract, min, max, smoothMin, dot)."""
        self._ops_list.append(f"combine {{ with: {with_field}  op: {op} }}")
        return self

    def slice(self, axis: str = "z", value: float = 0.0) -> "Field":
        """Slice field along axis to 2D hyperplane."""
        self._ops_list.append(f"slice {{ axis: {axis}  value: {value} }}")
        return self

    def pan(self, offset_x: float = 0.0, offset_y: float = 0.0, offset_z: float = 0.0) -> "Field":
        """Pan field spatially by a given offset vector."""
        self._ops_list.append(f"pan {{ offset: [{offset_x}, {offset_y}, {offset_z}] }}")
        return self

    def bake(self, res: int = 24) -> "Field":
        """Pre-evaluate field onto a discrete 3D voxel grid."""
        self._ops_list.append(f"bake {{ res: {res} }}")
        return self

    # ── Sampling Domain ───────────────────────────────────────────────────────

    def sample(
        self,
        res: Optional[int] = None,
        box: Optional[DomainType] = None,
    ) -> "Field":
        """Configure spatial sample box and grid resolution."""
        if res is not None:
            self._sample_spec["res"] = str(res)
        if box is not None:
            self._sample_spec["box"] = format_domain(box)
        return self

    # ── Code & Viewer Output ──────────────────────────────────────────────────

    def to_code(self) -> str:
        """Compile this field into the Field Runtime syntax string."""
        return build_dsl(
            self._field_spec,
            self._ops_list,
            self._view_layers,
            self._sample_spec,
        )

    def to_viewer(self, base_url: Optional[str] = None) -> FieldViewer:
        """Create a FieldViewer instance for this field."""
        return FieldViewer(self.to_code(), base_url=base_url)

    def to_url(self, hide_inspector: bool = False, hide_pads: bool = False) -> str:
        """Return direct link to this field in the web runtime."""
        return self.to_viewer().to_url(
            hide_inspector=hide_inspector,
            hide_pads=hide_pads,
        )

    def to_html(
        self,
        height: int = 650,
        width: str = "100%",
        hide_inspector: bool = False,
        hide_pads: bool = False,
    ) -> str:
        """Generate embeddable iframe HTML."""
        return self.to_viewer().to_html(
            height=height,
            width=width,
            hide_inspector=hide_inspector,
            hide_pads=hide_pads,
        )

    def _repr_html_(self) -> str:
        """Universal Jupyter / Google Colab automatic cell display protocol."""
        return self.to_viewer()._repr_html_()

    def show(
        self,
        height: int = 650,
        width: str = "100%",
        hide_inspector: bool = False,
        hide_pads: bool = False,
    ) -> None:
        """Explicitly display the interactive 3D viewer in a notebook cell."""
        self.to_viewer().show(
            height=height,
            width=width,
            hide_inspector=hide_inspector,
            hide_pads=hide_pads,
        )

    def save_html(self, filepath: str, height: int = 700) -> str:
        """Save this field visualization as a standalone HTML file."""
        return self.to_viewer().save_html(filepath, height=height)

    def open_browser(self) -> None:
        """Open the interactive viewer in your web browser."""
        self.to_viewer().open_browser()

    def __repr__(self) -> str:
        return f"<Field: {self._field_spec.get('preset') or self._field_spec.get('expr', 'custom')}>\n{self.to_code()}"
