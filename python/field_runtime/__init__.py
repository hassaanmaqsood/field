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
__all__ = [
    "Field",
    "FieldViewer",
    "get_viewer_url",
    "set_viewer_url",
]
