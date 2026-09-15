"""Unit tests for field_runtime Python module."""

import unittest
from field_runtime import Field, FieldViewer, set_viewer_url, get_viewer_url


class TestFieldRuntime(unittest.TestCase):
    def setUp(self):
        set_viewer_url("https://hassaan.github.io/field-mvp/")

    def test_preset_generation(self):
        f = Field.preset("radial", domain={"x": (-3, 3), "y": (-3, 3), "z": (-3, 3)})
        code = f.to_code()
        self.assertIn("field {", code)
        self.assertIn("preset: radial", code)
        self.assertIn("domain: x[-3:3] y[-3:3] z[-3:3]", code)
        self.assertIn("view {", code)
        self.assertIn("iso {", code)
        self.assertIn("sample {", code)

    def test_expr_and_operators(self):
        f = (
            Field.expr("sin(x)*cos(y)")
            .gradient()
            .combine("dipole", op="add")
            .slice(axis="z", value=0.5)
            .sample(res=64, box={"x": (-5, 5), "y": (-5, 5), "z": (-5, 5)})
        )
        code = f.to_code()
        self.assertIn('expr: "sin(x)*cos(y)"', code)
        self.assertIn("ops {", code)
        self.assertIn("gradient", code)
        self.assertIn("combine { with: dipole  op: add }", code)
        self.assertIn("slice { axis: z  value: 0.5 }", code)
        self.assertIn("res: 64", code)
        self.assertIn("box: x[-5:5] y[-5:5] z[-5:5]", code)

    def test_vector_field(self):
        v = Field.vector("[-y, x, 0.2*z]")
        code = v.to_code()
        self.assertIn('expr: "[-y, x, 0.2*z]"', code)
        self.assertIn("rankOut: [3]", code)
        self.assertIn("streamlines {", code)

    def test_viewer_url_generation(self):
        f = Field.preset("vortex")
        url = f.to_url(hide_inspector=True, hide_pads=True)
        self.assertTrue(url.startswith("https://hassaan.github.io/field-mvp/?"))
        self.assertIn("code=", url)
        self.assertIn("hideInspector=true", url)
        self.assertIn("hidePads=true", url)

    def test_html_representation(self):
        f = Field.preset("saddle")
        html_str = f._repr_html_()
        self.assertIn("<iframe", html_str)
        self.assertIn("Field Runtime", html_str)
        self.assertIn("allow=\"accelerometer; gyroscope; magnetometer\"", html_str)

    def test_from_raw_code(self):
        raw = "field { preset: dipole } view { iso { level: 0.0 } }"
        viewer = Field.from_code(raw)
        self.assertIsInstance(viewer, FieldViewer)
        self.assertIn("dipole", viewer.to_url())


if __name__ == "__main__":
    unittest.main()
