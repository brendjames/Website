"""Animal portraits (geo/animals/kt_<slug>.webp) as a JSON object of data URIs for the page."""
import base64
import json
from pathlib import Path

ANIMALS = Path(__file__).parent / "animals"


def photos_json():
    out = {}
    for f in sorted(ANIMALS.glob("kt_*.webp")):
        out[f.stem[3:]] = "data:image/webp;base64," + base64.b64encode(f.read_bytes()).decode()
    return json.dumps(out, separators=(",", ":"))


def fill_template(template, payload):
    """Put the sightings data and the portraits into the page template."""
    return (template.replace("/*__DATA__*/", payload.replace("</", r"<\/"))
                    .replace("/*__PHOTOS__*/", photos_json()))
