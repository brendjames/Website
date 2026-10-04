"""
Geocode sightings onto the real Kruger road network and write viz_data.json
for kruger_tings.html.

Inputs (all in this folder unless noted):
    ../tweets_full.csv       merged sightings (from parse_tweets.py)
    kruger_nominatim.json    park boundary        (OSM, via Nominatim)
    roads.json               roads with H/S refs  (OSM, via Overpass)
    rivers.json              named rivers         (OSM, via Overpass)
    places.json              camps, gates, dams   (OSM, via Overpass)

Placement, best first:
    1. 'H4-2, 1.2km S of S28'  -> junction of H4-2 and S28, moved 1.2 km south,
                                  snapped back onto H4-2
    2. 'H1-3, 2km N of Satara' -> Satara, moved 2 km north, snapped onto H1-3
    3. 'H3, at S110 junction'  -> junction of H3 and S110
    4. 'S28, ...' + 'Near X'   -> point on S28 closest to camp X
    5. only 'Near X'           -> camp X (scattered ~2 km)
    otherwise not mapped (still counted in the charts)
"""
import csv
import difflib
import json
import math
import random
import re
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np          # no pandas: Windows Smart App Control blocks its compiled files here

HERE = Path(__file__).parent
OUT = HERE / "viz_data.json"
HTML_OUT = HERE.parent / "kruger_tings.html"
LAT0 = -24.0
KX, KY = 111.32 * math.cos(math.radians(LAT0)), 110.57   # km per degree
random.seed(7)
np.random.seed(7)

# --------------------------------------------------------------------------- #
# Geometry helpers (work in local km)
# --------------------------------------------------------------------------- #
def to_km(lon, lat):
    return np.column_stack([(np.asarray(lon) - 31.5) * KX, (np.asarray(lat) - LAT0) * KY])


def to_lonlat(p):
    return p[0] / KX + 31.5, p[1] / KY + LAT0


def densify(pts, step=0.1):
    """Insert vertices so no gap exceeds `step` km (nearest-vertex ~= nearest-point)."""
    out = [pts[0]]
    for a, b in zip(pts[:-1], pts[1:]):
        n = int(np.linalg.norm(b - a) // step)
        for i in range(1, n + 1):
            out.append(a + (b - a) * i / (n + 1))
        out.append(b)
    return np.array(out)


def simplify(pts, tol):
    """Douglas-Peucker."""
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    ab = b - a
    L = np.hypot(*ab) or 1e-9
    d = np.abs(ab[0] * (pts[:, 1] - a[1]) - ab[1] * (pts[:, 0] - a[0])) / L
    i = int(np.argmax(d))
    if d[i] > tol:
        return np.vstack([simplify(pts[:i + 1], tol)[:-1], simplify(pts[i:], tol)])
    return np.array([a, b])


DIRS = {"N": (0, 1), "S": (0, -1), "E": (1, 0), "W": (-1, 0),
        "NE": (0.7071, 0.7071), "NW": (-0.7071, 0.7071),
        "SE": (0.7071, -0.7071), "SW": (-0.7071, -0.7071)}

# --------------------------------------------------------------------------- #
# Load OSM layers
# --------------------------------------------------------------------------- #
def norm_ref(r):
    r = r.upper().replace(" ", "")
    m = re.fullmatch(r"([HS])(\d+)(?:-(\d))?", r)
    return f"{m.group(1)}{int(m.group(2))}" + (f"-{m.group(3)}" if m.group(3) else "") if m else None


roads_raw = json.load(open(HERE / "roads.json", encoding="utf-8"))["elements"]
road_lines = {}          # ref -> list of km polylines
for w in roads_raw:
    if "geometry" not in w:
        continue
    pts = to_km([g["lon"] for g in w["geometry"]], [g["lat"] for g in w["geometry"]])
    for part in re.split(r"[/;]", w["tags"].get("ref", "")):
        ref = norm_ref(part.strip())
        if ref:
            road_lines.setdefault(ref, []).append(pts)
road_pts = {ref: np.vstack([densify(l) for l in lines]) for ref, lines in road_lines.items()}
# 'H1' / 'H4' / 'H13' style refs without a segment: fall back to all segments of that road
for ref in list(road_pts):
    base = ref.split("-")[0]
    if base != ref:
        road_pts[base] = np.vstack([road_pts.get(base, np.empty((0, 2))), road_pts[ref]])

places_raw = json.load(open(HERE / "places.json", encoding="utf-8"))["elements"]
PLACES = {}
for e in places_raw:
    n = e["tags"].get("name")
    c = e.get("center") or ({"lat": e["lat"], "lon": e["lon"]} if "lat" in e else None)
    if n and c:
        PLACES.setdefault(n.lower(), (c["lon"], c["lat"]))

# Camps/gates as written in the tweets -> OSM names (or hand-set coordinates)
CAMPS = {
    "skukuza": "skukuza rest camp", "crocodile bridge": "crocodile bridge rest camp",
    "malelane": "malelane gate", "lower sabie": "lower sabie rest camp",
    "satara": "satara rest camp", "pretoriuskop": "pretoriuskop rest camp",
    "orpen": "orpen gate", "jock safari lodge": "jock safari lodge", "jock": "jock safari lodge",
    "letaba": "letaba rest camp", "paul kruger gate": "paul kruger gate",
    "paul kruger": "paul kruger gate", "kruger gate": "paul kruger gate",
    "phalaborwa": "phalaborwa gate", "olifants": "olifants rest camp",
    "biyamiti": "biyamiti bushveld camp", "shingwedzi": "shingwedzi rest camp",
    "mopani": "reception mopani camp", "berg en dal": "berg-en-dal rest camp",
    "berg-en-dal": "berg-en-dal rest camp", "afsaal": "afsaal picnic spot",
    "punda maria": "punda maria rest camp", "numbi": "numbi gate", "pafuri": "pafuri camp",
    "balule": "balule satellite camp", "talamati": "talamati bushveld camp",
    "maroela": "maroela campsite", "tamboti": "tamboti tented camp",
    "sirheni": "sirheni bushveld camp", "bateleur": "bateleur bushveld camp",
    "shimuwini": "shimuwini bushveld camp", "mlondozi": "mlondozi picnic spot",
    "muzandzeni": "muzandzeni picnic site", "timbavati": "timbavati picnic site",
}
HAND_SET = {   # not (or not usefully) in the OSM extract
    "tshokwane": (31.8603, -24.7876), "phabeni": (31.2417, -25.0258),
    "mjejane": (31.7100, -25.4300), "giriyondo": (31.2000, -23.5700),
    "nkhulu": (31.7406, -25.0400), "kruger": None,
}
TYPOS = {"maellane": "malelane", "biaymiti": "biyamiti", "croodile": "crocodile",
         "crrocodile": "crocodile"}


CAMP_KEYS = sorted(set(CAMPS) | {k for k, v in HAND_SET.items() if v}, key=len, reverse=True)


def camp_in_text(text):
    """First camp/gate named anywhere in a location string ('900m from Crocodile Bridge')."""
    t = str(text).lower()
    hits = [(t.find(k), k) for k in CAMP_KEYS if re.search(r"\b" + re.escape(k) + r"\b", t)]
    return camp_xy(min(hits)[1]) if hits else None


def camp_xy(name):
    """'Near Crocodile Bridge' / 'Skukuza' -> km coords, or None."""
    n = re.sub(r"(?i)^near\s+", "", str(name)).replace("\xa0", " ").lower()
    n = re.sub(r"\s+", " ", n).strip(" .,")
    for a, b in TYPOS.items():
        n = n.replace(a, b)
    if not any(n.startswith(k) for k in CAMP_KEYS) and len(n) >= 4:
        close = difflib.get_close_matches(n[:18], CAMP_KEYS, n=1, cutoff=0.75)
        n = close[0] if close else n                 # 'skukzua' -> 'skukuza'
    for key in sorted(set(CAMPS) | set(HAND_SET), key=len, reverse=True):
        if n.startswith(key) or n == key:
            if key in HAND_SET:
                ll = HAND_SET[key]
                return None if ll is None else to_km([ll[0]], [ll[1]])[0]
            ll = PLACES.get(CAMPS[key])
            return None if ll is None else to_km([ll[0]], [ll[1]])[0]
    return None


def place_xy(name):
    """Exact place lookup for relative targets ('Orpen Dam', 'Jock Safari', 'Satara')."""
    n = re.sub(r"\s+", " ", str(name).replace(" ", " ")).strip(" .,").lower()
    n = re.sub(r"^(the)\s+", "", n)
    for cand in (n, n + " rest camp", n + " dam", n + " lodge", n + " picnic site",
                 n + " picnic spot", n + " bushveld camp"):
        if cand in PLACES:
            return to_km([PLACES[cand][0]], [PLACES[cand][1]])[0]
    key = re.sub(r"\b(rest camp|camp|gate)$", "", n).strip()
    if key in CAMPS or key in HAND_SET:
        return camp_xy(key)
    return None


def nearest_on(ref, p):
    pts = road_pts.get(ref)
    if pts is None:
        return None
    return pts[np.argmin(((pts - p) ** 2).sum(1))]


_junctions = {}


def junction(r1, r2):
    key = (r1, r2)
    if key not in _junctions:
        a, b = road_pts.get(r1), road_pts.get(r2)
        if a is None or b is None:
            _junctions[key] = None
        else:
            # coarse-to-fine: subsample, then refine near the best pair
            sa, sb = a[::5], b[::5]
            d = ((sa[:, None, :] - sb[None, :, :]) ** 2).sum(-1)
            i, j = np.unravel_index(np.argmin(d), d.shape)
            if d[i, j] > 1.5 ** 2:          # roads don't meet (within 1.5 km)
                _junctions[key] = None
            else:
                ca = a[np.abs(a - sa[i]).sum(1) < 1.0]
                cb = b[np.abs(b - sb[j]).sum(1) < 1.0]
                d = ((ca[:, None, :] - cb[None, :, :]) ** 2).sum(-1)
                i, j = np.unravel_index(np.argmin(d), d.shape)
                _junctions[key] = (ca[i] + cb[j]) / 2
    return _junctions[key]


ROAD_TOKEN = r"[HS]\s?\d{1,3}(?:-\d)?"
ROAD_ANY_RE = re.compile(r"\b(" + ROAD_TOKEN + r")\b", re.I)
DIR_TOKEN = r"(?:north|south|east|west)(?:[\s-]?(?:east|west))?|[NSEW]{1,2}"
DIR_WORDS = {"NORTH": "N", "SOUTH": "S", "EAST": "E", "WEST": "W", "NORTHEAST": "NE", "NORTHWEST": "NW",
             "SOUTHEAST": "SE", "SOUTHWEST": "SW"}
# "1.2km N of S28", "3,5 km North of X", "2km from H12", "4kms past S29" (the direction is optional)
REL_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*(km|kms|k|m|meters?|metres?)\b\.?\s+(?:(" + DIR_TOKEN + r")\s+)?"
                    r"(?:of|from|past|before|after|away from)\s+(?:the\s+)?(.+)", re.I)
JUNC_RE = re.compile(r"(" + ROAD_TOKEN + r")\s*(?:&|and|/|x|with)\s*(?:the\s+)?(" + ROAD_TOKEN + r")\b", re.I)
AT_RE = re.compile(r"\b(?:at|near|close to|by|off|past|just past|opposite)\s+(?:the\s+)?(" + ROAD_TOKEN + r")\b", re.I)
ENTRANCE_RE = re.compile(r"^(n|s|e|w|north|south|east|west)(?:ern)?\s+(?:entrance|end|side|turn[\s-]?off)", re.I)
# nicknames used in older tweets
ALIASES = [(r"\bl\.?\s*sabie\b", "lower sabie"), (r"\bcroc\.?\s*brid?ge?\b", "crocodile bridge"),
           (r"\bcroc\b(?!odile)", "crocodile"), (r"\bp\.?\s*kop\b", "pretoriuskop"), (r"\bnk(?:h|u)u?h?lu\b", "nkhulu"),
           (r"\bberg\s+en\s+dal\b", "berg-en-dal"), (r"\bpk\s*gate\b", "paul kruger gate"), (r"\bpafuri\s+border\b", "pafuri")]


def aliased(text):
    t = str(text).lower().replace("\xa0", " ")
    for pat, rep in ALIASES:
        t = re.sub(pat, rep, t)
    return t


# OSM landmarks (dams, koppies, picnic spots...) usable as anchors: longest names first
LANDMARKS = sorted((n for n in PLACES if len(n) >= 6 and not re.search(r"\d", n)
                    and not re.search(r"^(reception|information|tent|chalet|lst)", n)), key=len, reverse=True)


LANDMARK_RE = re.compile(r"([a-z'][a-z'-]{2,24})\s+(dam|koppies?|pan|waterhole|bridge|river|spruit|drift|weir|"
                         r"loop|hide|picnic spot|picnic site|lookout|viewpoint)\b")
PLACE_KEYS = list(PLACES)
_place_cache = {}
river_pts = {}
for _w in json.load(open(HERE / "rivers.json", encoding="utf-8"))["elements"]:
    if "geometry" in _w and _w["tags"].get("name"):
        _k = re.sub(r"\s+river$", "", _w["tags"]["name"].lower()).replace("’", "'")
        _p = densify(to_km([g["lon"] for g in _w["geometry"]], [g["lat"] for g in _w["geometry"]]))
        river_pts[_k] = np.vstack([river_pts[_k], _p]) if _k in river_pts else _p


def landmark_in_text(t, road=None):
    """A dam, waterhole, koppie or river crossing named in the text, as km coords."""
    for n in LANDMARKS:
        if n in t and re.search(r"\b" + re.escape(n) + r"\b", t):
            return to_km([PLACES[n][0]], [PLACES[n][1]])[0]
    for m in LANDMARK_RE.finditer(t):
        stem, kind = m.group(1), m.group(2)
        # a bridge / river / drift on the road: where that river crosses it
        if road and kind in ("bridge", "river", "drift", "spruit", "weir"):
            rk = difflib.get_close_matches(stem, list(river_pts), n=1, cutoff=0.8)
            if rk:
                a, b = road_pts[road][::3], river_pts[rk[0]][::2]
                d = ((a[:, None, :] - b[None, :, :]) ** 2).sum(-1)
                i, j = np.unravel_index(np.argmin(d), d.shape)
                if d[i, j] < 1.5 ** 2:
                    return a[i]
        # OSM usually calls the dams "<name> waterhole"; allow small spelling slips
        for cand in (f"{stem} {kind}", f"{stem} waterhole", f"{stem} dam", f"{stem} dam viewpoint",
                     f"{stem} waterhole viewpoint", f"{stem} picnic site", f"{stem} picnic spot", stem):
            if cand not in _place_cache:
                _place_cache[cand] = cand if cand in PLACES else next(
                    iter(difflib.get_close_matches(cand, PLACE_KEYS, n=1, cutoff=0.88)), None)
            hit = _place_cache[cand]
            if hit:
                return to_km([PLACES[hit][0]], [PLACES[hit][1]])[0]
    return None


def valid_road(ref):
    if ref and ref not in road_pts:
        ref = ref.split("-")[0] if ref.split("-")[0] in road_pts else None
    return ref


def road_end(ref, word):
    """The end of a road in a compass direction ('S entrance' of the S28)."""
    pts = road_pts[ref]
    d = word[0].upper()
    i = {"N": np.argmax(pts[:, 1]), "S": np.argmin(pts[:, 1]),
         "E": np.argmax(pts[:, 0]), "W": np.argmin(pts[:, 0])}[d]
    return pts[i]


def along_road_from(ref, start, dist):
    """Point on the road about `dist` km (straight line) from `start`."""
    pts = road_pts[ref]
    return pts[np.argmin(np.abs(np.linalg.norm(pts - start, axis=1) - dist))]


def geocode(location, near):
    """Return ((lon, lat), method) or (None, None)."""
    raw = str(location).replace("\xa0", " ")
    t = aliased(raw)
    roads = [valid_road(norm_ref(m.group(1))) for m in ROAD_ANY_RE.finditer(raw)]
    roads = [r for r in roads if r]
    road1 = roads[0] if roads else None
    camp = camp_xy(near) if near else None
    if camp is None:
        camp = camp_in_text(t)
    landmark = landmark_in_text(t, road1)
    # a named dam/bridge is more precise than "near <camp>", but only trust it when it agrees with the camp
    if landmark is not None and (camp is None or np.linalg.norm(landmark - camp) < 25):
        anchor = landmark
    else:
        anchor = camp
    p, method = None, None

    jm = JUNC_RE.search(raw)                                   # "S114 and S118 junction"
    if jm:
        j = junction(valid_road(norm_ref(jm.group(1))) or "", valid_road(norm_ref(jm.group(2))) or "")
        if j is not None:
            p, method = j, "junction"

    rel = REL_RE.search(raw)
    if p is None and rel:
        dist = float(rel.group(1).replace(",", "."))
        unit = rel.group(2).lower()
        if unit.startswith("m") and not unit.startswith("k"):
            dist /= 1000
        dword = (rel.group(3) or "").replace(" ", "").replace("-", "").upper()
        d = DIRS.get(DIR_WORDS.get(dword, dword)) if dword else None
        target = rel.group(4).strip()
        mt = re.match(r"(" + ROAD_TOKEN + r")\b", target, re.I)
        ent = ENTRANCE_RE.match(target)
        base, snap_from_base = None, False
        if mt and road1:
            base = junction(road1, valid_road(norm_ref(mt.group(1))) or "")
        elif ent and road1:                                     # "11.3 km from S entrance"
            base, snap_from_base = road_end(road1, ent.group(1)), True
        elif not mt:
            name = re.split(r"[,.(]| turn| junction| on the| going| heading| towards", target, flags=re.I)[0]
            base = place_xy(aliased(name)) if name else None
            if base is None and name:
                base = camp_xy(aliased(name))
        if base is not None and dist < 40:
            if d is not None:
                p, method = base + np.array(d) * dist, "offset"
            elif snap_from_base or road1:
                p, method = (along_road_from(road1, base, dist) if road1 else base), "offset"
            else:
                p, method = base, "offset"
    if p is None and road1:
        at = AT_RE.search(raw)
        if at and valid_road(norm_ref(at.group(1))) and valid_road(norm_ref(at.group(1))) != road1:
            j = junction(road1, valid_road(norm_ref(at.group(1))))
            if j is not None:
                p, method = j, "junction"
        elif len(roads) >= 2:                                   # two roads named: their junction
            j = junction(road1, roads[1])
            if j is not None:
                p, method = j, "junction"
    if p is not None and road1:
        snapped = nearest_on(road1, p)
        if np.linalg.norm(snapped - p) < 6:      # trust the road if it's plausibly close
            p = snapped
        elif anchor is not None:                 # offset point is nowhere near its road
            p, method = None, None
    if p is None and road1 and anchor is not None:
        q = nearest_on(road1, anchor)
        if np.linalg.norm(q - anchor) < 35:
            p, method = q, "road+camp"
    if p is None and anchor is not None:
        ang, r = random.random() * 2 * math.pi, 2.0 * math.sqrt(random.random())
        p, method = anchor + np.array([math.cos(ang), math.sin(ang)]) * r, "camp"
    if p is None and road1:                       # only a road: its middle, if the road is short
        pts = road_pts[road1]
        span = np.linalg.norm(pts.max(0) - pts.min(0))
        if span <= 25:
            mid = pts[np.argmin(np.linalg.norm(pts - pts.mean(0), axis=1))]
            p, method = mid + np.random.normal(0, 1.0, 2), "road only"
    if p is None:
        return None, None
    p = p + np.random.normal(0, 0.12, 2)        # ~120 m scatter so stacked tings stay visible
    return to_lonlat(p), method


# --------------------------------------------------------------------------- #
# Species
# --------------------------------------------------------------------------- #
SPECIES = [  # (label, group, regex) - earliest match in the text wins
    ("Lion", 0, r"\blion|\bpride\b"), ("Leopard", 0, r"leopard(?!\s+tortoise)"),
    ("Cheetah", 0, r"cheetah"), ("Wild dog", 1, r"wild\s*dog|painted\s*(dog|wolf)|\bpack of\b"),
    ("Hyena", 1, r"hyena|hyaena|\bclan\b"), ("Elephant", 2, r"elephant|\bellie"),
    ("Buffalo", 2, r"buffalo|dagga"), ("Rhino", 2, r"rhino"), ("Hippo", 2, r"hippo"),
    ("Giraffe", 2, r"giraffe"), ("Zebra", 2, r"zebra"),
    ("Honey badger", 2, r"honey\s*badger|ratel"), ("Jackal", 2, r"jackal"),
    ("Small cats & civets", 2, r"serval|caracal|civet|genet|wild\s*cat|african wildcat"),
    ("Birds", 2, r"eagle|vulture|owl|hornbill|bateleur|kingfisher|stork|heron|ostrich|kori|"
                 r"bustard|roller|hawk|falcon|kite|buzzard|goshawk|crane|pelican|bird|"
                 r"francolin|guineafowl|secretary|flamingo|finfoot|ibis|spoonbill"),
    ("Reptiles", 2, r"snake|python|mamba|cobra|boomslang|adder|crocodile|croc\b|monitor|"
                    r"tortoise|terrapin|chameleon|lizard"),
    ("Antelope & grazers", 2, r"impala|kudu|sable|roan|nyala|eland|waterbuck|wildebeest|"
                              r"antelope|bushbuck|steenbok|duiker|tsessebe|warthog|klipspringer|"
                              r"reedbuck|oribi|grysbok|suni"),
]
SPECIES_RE = [(lab, g, re.compile(rx, re.I)) for lab, g, rx in SPECIES]
GROUPS = ["Big cats", "Wild dogs & hyenas", "Everything else"]


def species_of(text):
    best = None
    for lab, g, rx in SPECIES_RE:
        m = rx.search(text)
        if m and (best is None or m.start() < best[0]):
            best = (m.start(), lab, g)
    return (best[1], best[2]) if best else ("Other", 2)


def hour_of(t):
    m = re.match(r"^(\d{1,2})[:.](\d{2})\s*([ap])?", str(t), re.I)
    if not m:
        return -1
    h, ap = int(m.group(1)), (m.group(3) or "").lower()
    if ap:
        return (h % 12) + (12 if ap == "p" else 0)
    if h >= 13 or str(t).startswith("0"):
        return h if h < 24 else -1
    return -1                                   # e.g. '8:45' - am or pm unknown


def rating_of(r):
    m = re.match(r"^(\d)", str(r))
    return int(m.group(1)) if m and int(m.group(1)) <= 5 else -1


# --------------------------------------------------------------------------- #
def main():
    with open(HERE.parent / "tweets_full.csv", encoding="utf-8-sig", newline="") as f:
        records = [{k: (v or "") for k, v in r.items()} for r in csv.DictReader(f)]
    records = [r for r in records if r["Parsed"] == "True"]
    epoch = datetime(2012, 1, 1)
    dates = [datetime.strptime(r["Tweet Date"], "%Y-%m-%d %H:%M:%S") for r in records]

    # No personal data in the page: tinger names and tweet IDs (which link back to
    # the tinger) are deliberately left out.
    dicts = {"species": [s[0] for s in SPECIES] + ["Other"], "near": []}
    idx = {k: {v: i for i, v in enumerate(vs)} for k, vs in dicts.items()}

    def code(kind, v):
        if v not in idx[kind]:
            idx[kind][v] = len(dicts[kind])
            dicts[kind].append(v)
        return idx[kind][v]

    cols = {k: [] for k in ("lon", "lat", "day", "sec", "g", "sp", "rt", "hr", "nr",
                            "title", "loc", "time")}
    methods = {}
    for r, dt in zip(records, dates):
        sp, g = species_of(r["Animal Type and Number"] + " " + r["Title"])
        near = re.sub(r"(?i)^near\s+", "", r["Near"]).replace("\xa0", " ").strip().title()
        ll, how = geocode(r["Location"], r["Near"])
        methods[how] = methods.get(how, 0) + 1
        cols["lon"].append(round(ll[0], 4) if ll else None)
        cols["lat"].append(round(ll[1], 4) if ll else None)
        cols["day"].append((dt - epoch).days)
        cols["sec"].append(dt.hour * 3600 + dt.minute * 60 + dt.second)
        cols["g"].append(g)
        cols["sp"].append(idx["species"][sp])
        cols["rt"].append(rating_of(r["Rating"]))
        cols["hr"].append(hour_of(r["Time"]))
        cols["nr"].append(code("near", near) if near else -1)
        cols["title"].append(r["Title"][:80])
        cols["loc"].append(r["Location"][:90])
        cols["time"].append(r["Time"])

    # map layers, simplified
    b = json.load(open(HERE / "kruger_nominatim.json", encoding="utf-8"))[0]["geojson"]
    rings = [b["coordinates"][0]] if b["type"] == "Polygon" else [p[0] for p in b["coordinates"]]
    outline = [np.round(np.array(r), 4).tolist() for r in rings]

    def lines_ll(lines, tol):
        out = []
        for l in lines:
            s = simplify(l, tol)
            out.append([[round(x, 4) for x in to_lonlat(p)] for p in s])
        return out

    major = {r for r in road_lines if r.startswith("H")}
    roads = {"major": [], "minor": []}
    for ref, lines in road_lines.items():
        roads["major" if ref in major else "minor"] += lines_ll(lines, 0.08)

    RIVERS = re.compile(r"^(olifants|sabie|crocodile|letaba|groot letaba|limpopo|luvuvhu|"
                        r"shingwedzi|timbavati|sand|n'?waswitsontso|mphongolo|nwanedzi|sweni|"
                        r"tsendze|biyamiti|nwaswitshaka|mlondozi|mbyamiti|lower sabie|"
                        r"komati|nsikazi|mutlumuvi)", re.I)
    rivers = []
    for w in json.load(open(HERE / "rivers.json", encoding="utf-8"))["elements"]:
        if "geometry" in w and RIVERS.match(w["tags"].get("name", "")):
            pts = to_km([g["lon"] for g in w["geometry"]], [g["lat"] for g in w["geometry"]])
            rivers += lines_ll([pts], 0.1)

    camps = []
    for label, key in [("Skukuza", "skukuza"), ("Lower Sabie", "lower sabie"),
                       ("Crocodile Bridge", "crocodile bridge"), ("Malelane", "malelane"),
                       ("Berg-en-Dal", "berg-en-dal"), ("Pretoriuskop", "pretoriuskop"),
                       ("Satara", "satara"), ("Orpen", "orpen"), ("Tshokwane", "tshokwane"),
                       ("Olifants", "olifants"), ("Letaba", "letaba"), ("Phalaborwa", "phalaborwa"),
                       ("Mopani", "mopani"), ("Shingwedzi", "shingwedzi"),
                       ("Punda Maria", "punda maria"), ("Pafuri", "pafuri")]:
        p = camp_xy(key)
        if p is not None:
            lon, lat = to_lonlat(p)
            camps.append([label, round(lon, 4), round(lat, 4)])

    # periods covered: collector windows (merged) + the earlier scrape's date span
    spans = []
    state_file = HERE.parent / "collect_state.json"
    if state_file.exists():
        for k in json.load(open(state_file, encoding="utf-8")).get("done_windows", {}):
            a, b = (datetime.fromisoformat(x) for x in k.split("_"))
            spans.append([(a - epoch).days, (b - epoch).days])
    # the profile-timeline pass isn't recorded as windows: use the unbroken run of
    # collected tweets going back from the newest one (no gap longer than 10 days)
    days = sorted({(d - epoch).days for r, d in zip(records, dates) if r["Source"] == "collected"}, reverse=True)
    if days:
        start = days[0]
        for a in days[1:]:
            if start - a > 10:
                break
            start = a
        spans.append([start, days[0] + 1])
    prev = [d for r, d in zip(records, dates) if r["Source"].startswith("cleaned")]
    if prev:
        spans.append([(min(prev) - epoch).days, (max(prev) - epoch).days + 1])
    spans.sort()
    coverage = []
    for a, b in spans:
        if coverage and a <= coverage[-1][1] + 1:
            coverage[-1][1] = max(coverage[-1][1], b)
        else:
            coverage.append([a, b])
    fmt = lambda d: (epoch + timedelta(days=d)).strftime("%d %b %Y")
    if len(coverage) == 1:
        coverage_note = (f"Collected: {fmt(coverage[0][0])} – {fmt(coverage[0][1] - 1)} with no gaps; "
                         f"the earliest tweet found is from {min(dates).strftime('%d %b %Y')}.")
    else:
        coverage_note = ("Collected so far: " + "; ".join(f"{fmt(a)} – {fmt(b - 1)}" for a, b in coverage)
                         + ". Collection is still running, so gaps between these periods are "
                           "'not collected yet', not 'no sightings'.")

    data = {
        "coverage": coverage, "coverage_note": coverage_note,
        "generated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "epoch": "2012-01-01", "groups": GROUPS, "dicts": dicts,
        "species_group": [s[1] for s in SPECIES] + [2],
        "cols": cols, "outline": outline, "roads": roads, "rivers": rivers, "camps": camps,
        "methods": methods,
    }
    payload = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    OUT.write_text(payload, encoding="utf-8")
    html = (HERE / "kruger_tings.template.html").read_text(encoding="utf-8")
    from photos import fill_template   # sightings data + animal portraits into the page
    html = fill_template(html, payload)
    HTML_OUT.write_text(html, encoding="utf-8")
    print(f"{HTML_OUT.name}: {HTML_OUT.stat().st_size / 1e6:.2f} MB")
    n = len(cols["lon"])
    placed = sum(v is not None for v in cols["lon"])
    print(f"{n} sightings, {placed} placed on the map ({placed / n:.1%}); methods: {methods}")
    print(f"viz_data.json: {OUT.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
