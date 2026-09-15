"""Viewer component for Jupyter notebooks, Google Colab, and standalone HTML export."""

import html
import urllib.parse
from typing import Optional

from .config import get_viewer_url


class FieldViewer:
    """Renders Field Runtime visualisations inside Jupyter / Google Colab or standalone HTML."""

    def __init__(self, code: str, base_url: Optional[str] = None):
        self.code = code.strip()
        self.base_url = (base_url or get_viewer_url()).rstrip("/") + "/"

    def to_url(self, hide_inspector: bool = False, hide_pads: bool = False) -> str:
        """Construct the direct deep-link URL to load this field in the web runtime."""
        params = {"code": self.code}
        if hide_inspector:
            params["hideInspector"] = "true"
        if hide_pads:
            params["hidePads"] = "true"
        query = urllib.parse.urlencode(params)
        return f"{self.base_url}?{query}"

    def to_html(
        self,
        height: int = 650,
        width: str = "100%",
        hide_inspector: bool = False,
        hide_pads: bool = False,
    ) -> str:
        """Generate responsive iframe HTML embeddable in Colab / Jupyter notebooks."""
        url = self.to_url(hide_inspector=hide_inspector, hide_pads=hide_pads)
        safe_url = html.escape(url)
        escaped_code = html.escape(self.code)

        return f"""
<div class="field-runtime-container" style="margin: 12px 0; border: 1px solid #D0C9BC; border-radius: 8px; overflow: hidden; background: #EDE9E0; box-shadow: 0 4px 18px rgba(0,0,0,0.08); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="display: flex; align-items: center; justify-content: space-between; padding: 7px 12px; background: #FAF8F5; border-bottom: 1px solid #E2DDD5; font-size: 11.5px; color: #6B6259;">
    <span style="font-weight: 600; color: #1A1714; font-family: Georgia, serif; font-size: 13px;">Field Runtime</span>
    <div>
      <a href="{safe_url}" target="_blank" rel="noopener noreferrer" style="color: #1D4ED8; text-decoration: none; font-weight: 500; margin-right: 12px;">↗ Open in Full View</a>
      <button onclick="navigator.clipboard.writeText(`{escaped_code}`); this.innerText='Copied!'; setTimeout(()=>this.innerText='Copy Code', 2000);" style="background: #FFFFFF; border: 1px solid #D0C9BC; border-radius: 4px; padding: 2px 8px; font-size: 11px; cursor: pointer; color: #1A1714;">Copy Code</button>
    </div>
  </div>
  <iframe
    src="{safe_url}"
    width="{width}"
    height="{height}px"
    style="border: none; display: block; width: 100%; height: {height}px;"
    allow="accelerometer; gyroscope; magnetometer"
    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
    title="Field Runtime Visualiser"
  ></iframe>
</div>
"""

    def _repr_html_(self) -> str:
        """IPython / Jupyter / Google Colab display protocol hook."""
        return self.to_html()

    def show(
        self,
        height: int = 650,
        width: str = "100%",
        hide_inspector: bool = False,
        hide_pads: bool = False,
    ) -> None:
        """Explicitly display the interactive viewer in a notebook cell."""
        try:
            from IPython.display import HTML, display  # type: ignore[import-not-found] # pyright: ignore[reportMissingImports]
            display(HTML(self.to_html(
                height=height,
                width=width,
                hide_inspector=hide_inspector,
                hide_pads=hide_pads,
            )))
        except ImportError:
            print(f"Interactive viewer URL:\n{self.to_url()}")

    def save_html(self, filepath: str, height: int = 700) -> str:
        """Export the field as a standalone shareable HTML file."""
        html_content = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Field Runtime Export</title>
  <style>
    html, body {{ margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #EDE9E0; }}
    iframe {{ width: 100%; height: 100%; border: none; }}
  </style>
</head>
<body>
  <iframe src="{html.escape(self.to_url())}" allow="accelerometer; gyroscope; magnetometer"></iframe>
</body>
</html>
"""
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html_content)
        return filepath

    def open_browser(self) -> None:
        """Open the interactive viewer in the system default web browser."""
        import webbrowser
        webbrowser.open(self.to_url())
