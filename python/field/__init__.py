"""Field Runtime — Interactive 3D Field Mathematics in Python & Jupyter/Colab.

Quickstart:
    >>> from field_runtime import Field
    >>> f = Field.preset("radial")
    >>> f.gradient()
    >>> f.show()  # Or simply evaluate `f` at the end of a notebook cell
"""

from .config import get_viewer_url, set_viewer_url
from .field import Field
from .viewer import FieldViewer

__version__ = "0.1.0"

def show(*fields: "Field", **kwargs) -> None:
    """Explicitly display multiple fields simultaneously in the interactive viewer."""
    if not fields:
        return
    
    combined_code = "\n\n".join(f.to_dsl() for f in fields)
    viewer = FieldViewer(combined_code)
    viewer.show(**kwargs)

__all__ = [
    "Field",
    "FieldViewer",
    "show",
    "get_viewer_url",
    "set_viewer_url",
]
