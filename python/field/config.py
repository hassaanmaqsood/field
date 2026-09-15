"""Configuration settings for Field Runtime Python module."""

import os

# Default GitHub Pages deployment URL or local dev server
# Users can override via:
#   1. Environment variable: export FIELD_RUNTIME_URL="https://..."
#   2. In Python: field_runtime.set_viewer_url("https://...")
DEFAULT_VIEWER_URL = os.environ.get(
    "FIELD_RUNTIME_URL",
    "https://hassaanmaqsood.github.io/field/"
)

_viewer_url: str = DEFAULT_VIEWER_URL


def get_viewer_url() -> str:
    """Return the currently configured base viewer URL."""
    return _viewer_url


def set_viewer_url(url: str) -> None:
    """Set the base viewer URL (e.g. your GitHub Pages deployment or localhost).

    Example:
        >>> import field_runtime as fr
        >>> fr.set_viewer_url("https://myusername.github.io/field/")
    """
    global _viewer_url
    _viewer_url = url.rstrip("/") + "/"
