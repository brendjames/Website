"""
Rebuild kruger_tings.html from the template and the existing viz_data.json.

Use this after changing only the page design (kruger_tings.template.html).
It needs no pandas; build_viz_data.py regenerates viz_data.json itself.
"""
from pathlib import Path

GEO = Path(__file__).parent
payload = (GEO / "viz_data.json").read_text(encoding="utf-8")
template = (GEO / "kruger_tings.template.html").read_text(encoding="utf-8")
out = GEO.parent / "kruger_tings.html"
from photos import fill_template  # noqa: E402  (same folder)
out.write_text(fill_template(template, payload), encoding="utf-8")
print(f"{out.name}: {out.stat().st_size / 1e6:.2f} MB")
