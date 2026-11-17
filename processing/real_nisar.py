#!/usr/bin/env python3
"""
DELTAWATCH - real NISAR L2 GCOV pipeline.

Replaces the synthetic scene generator in discover_and_run.py with real
NASA-ISRO NISAR (NASA-ISRO Synthetic Aperture Radar) Level-2 GCOV
(Geocoded polarimetric COVariance) data, and writes the same files the app
already reads:

    public/processed/<region>/{before_fcc.webp, after_fcc.webp,
        change_overlay.webp, evidence_polygons.geojson, summary_metrics.json}
    public/data/available_scenes.json

Pipeline per region
  1. Resolve the chosen same-track, same-mode granule pair via NASA CMR
     (Common Metadata Repository) - public, no login.
  2. Read ONLY the bbox window of HHHH / HVHV / mask / numberOfLooks from
     each ~6-7 GB HDF5 file using HTTP range requests (Earthdata login via
     ~/.netrc). Fallback: --download the whole file to processing/raw/.
     Cropped windows are cached as processing/raw/<granule>__<region>.npz.
  3. Multilook in the native UTM (Universal Transverse Mercator) grid, then
     resample onto a grid that is UNIFORM IN WEB MERCATOR (EPSG:3857) whose
     outer pixel edges are exactly the bbox corners, so MapLibre's 4-corner
     `image` source lines up exactly.
  4. Classify change with retuned thresholds (see run_delta_sar_real),
     reusing the Lee filter / dB / FCC / overlay functions of the old script.
  5. Vectorise real class outlines (marching squares), compute areas with
     the true Mercator scale factor, and write metrics with provenance.

Run:
    processing/.venv/bin/python processing/real_nisar.py --region majuli
    processing/.venv/bin/python processing/real_nisar.py --region all
    (add --download to fetch full files instead of range-streaming)
"""

import argparse
import json
import math
import os
import re
import sys
import time
from collections import OrderedDict
from datetime import datetime, timezone

import numpy as np
import scipy.ndimage as ndi
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RAW_DIR = os.path.join(HERE, "raw")
sys.path.insert(0, HERE)

# Reused downstream functions from the original (synthetic) script.
from discover_and_run import (  # noqa: E402
    REGIONS,
    CLASS_CONFIG,
    apply_lee_filter_5x5,
    power_to_db,
    create_crisp_fcc_image,
    create_crisp_change_overlay_image,
    chaikin_smooth,
)

CMR_URL = "https://cmr.earthdata.nasa.gov/search/granules.umm_json"
SHORT_NAME = "NISAR_L2_GCOV_V1"
COLLECTION_CONCEPT = "C3622241360-ASF"

# Chosen pairs (same track, same direction, same frame, same mode 4005 DHDH).
REAL_PAIRS = {
    "majuli": {
        "track": 40, "direction": "A", "frame": 15, "mode": "4005_DHDH",
        "before": "20261026", "after": "20261107",
    },
    "nagapattinam": {
        "track": 149, "direction": "D", "frame": 83, "mode": "4005_DHDH",
        "before": "20261022", "after": "20261103",
    },
}

GCOV_GRID = "/science/LSAR/GCOV/grids/frequencyA"
RADARGRID = "/science/LSAR/GCOV/metadata/radarGrid"
IDENT = "/science/LSAR/identification"

MERC_R = 6378137.0


def log(msg):
    print(msg, flush=True)


# --------------------------------------------------------------------------
# 1. CMR granule resolution (public)
# --------------------------------------------------------------------------
GRANULE_RE = re.compile(
    r"NISAR_L2_PR_GCOV_(?P<cycle>\d{3})_(?P<track>\d{3})_(?P<dir>[AD])_(?P<frame>\d{3})_"
    r"(?P<mode>\d{4}_[A-Z]{4})_[A-Z]_(?P<start>\d{8}T\d{6})_(?P<stop>\d{8}T\d{6})_"
)


def parse_granule_name(gid):
    m = GRANULE_RE.search(gid)
    if not m:
        return None
    d = m.groupdict()
    return {
        "cycle": int(d["cycle"]), "track": int(d["track"]), "direction": d["dir"],
        "frame": int(d["frame"]), "mode": d["mode"],
        "start": datetime.strptime(d["start"], "%Y%m%dT%H%M%S").strftime("%Y-%m-%dT%H:%M:%SZ"),
        "stop": datetime.strptime(d["stop"], "%Y%m%dT%H%M%S").strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def resolve_pair(region_key):
    import requests
    bbox = REGIONS[region_key]["bbox"]
    want = REAL_PAIRS[region_key]
    r = requests.get(CMR_URL, params={
        "short_name": SHORT_NAME,
        "bounding_box": ",".join(str(v) for v in bbox),
        "page_size": 100,
    }, timeout=60)
    r.raise_for_status()
    found = {}
    for it in r.json().get("items", []):
        u = it["umm"]
        gid = u["GranuleUR"]
        meta = parse_granule_name(gid)
        if not meta:
            continue
        if (meta["track"], meta["direction"], meta["frame"], meta["mode"]) != (
                want["track"], want["direction"], want["frame"], want["mode"]):
            continue
        day = meta["start"][:10].replace("-", "")
        for role in ("before", "after"):
            if day == want[role]:
                https = [x["URL"] for x in u.get("RelatedUrls", [])
                         if x.get("Type") == "GET DATA" and x["URL"].startswith("https") and x["URL"].endswith(".h5")]
                s3 = [x["URL"] for x in u.get("RelatedUrls", [])
                      if x["URL"].startswith("s3://") and x["URL"].endswith(".h5")]
                sizes = [a.get("SizeInBytes") or 0 for a in
                         u.get("DataGranule", {}).get("ArchiveAndDistributionInformation", [])]
                size = max(sizes) if sizes else None  # the .h5 is by far the largest entry
                found[role] = {"granule_id": gid, "https_url": https[0] if https else None,
                               "s3_url": s3[0] if s3 else None, "size_bytes": size,
                               "concept_id": it["meta"]["concept-id"], **meta}
    for role in ("before", "after"):
        if role not in found or not found[role]["https_url"]:
            raise RuntimeError(f"[{region_key}] could not resolve {role} granule in CMR for {want}")
    return found


# --------------------------------------------------------------------------
# 2. Remote / local HDF5 access
# --------------------------------------------------------------------------
def netrc_has_earthdata():
    import netrc
    path = os.path.expanduser("~/.netrc")
    if not os.path.exists(path):
        return False
    try:
        return netrc.netrc(path).authenticators("urs.earthdata.nasa.gov") is not None
    except Exception:
        return False


class HTTPRangeFile:
    """Read-only, seekable file object over HTTP Range requests with an LRU
    block cache, so h5py only pulls the chunks it needs.

    Earthdata login: requests applies ~/.netrc credentials for
    urs.earthdata.nasa.gov while following the redirect chain (it re-reads
    netrc whenever the host changes). The final pre-signed URL is cached and
    re-resolved when it expires. Credentials and signed URLs are never logged.
    """

    def __init__(self, url, block_size=8 * 1024 * 1024, max_blocks=96, session=None):
        import requests
        self.url = url
        self.block_size = block_size
        self.max_blocks = max_blocks
        self.s = session or requests.Session()
        self.pos = 0
        self.cache = OrderedDict()
        self.bytes_fetched = 0
        self.requests_made = 0
        self._signed = None
        self.size = self._resolve()

    def _resolve(self):
        r = self.s.get(self.url, headers={"Range": "bytes=0-0"}, stream=True,
                       allow_redirects=True, timeout=60)
        if r.status_code in (401, 403) or "urs.earthdata.nasa.gov" in r.url:
            r.close()
            raise PermissionError(
                f"Earthdata login refused (HTTP {r.status_code}). Check ~/.netrc entry for "
                "urs.earthdata.nasa.gov and that the ASF/NISAR EULA is accepted in your Earthdata profile.")
        if r.status_code != 206:
            r.close()
            raise IOError(f"Server did not honour Range request (HTTP {r.status_code})")
        cr = r.headers.get("Content-Range", "")
        r.close()
        self._signed = r.url
        return int(cr.split("/")[-1])

    def _fetch(self, start, end):
        for attempt in range(5):
            try:
                r = self.s.get(self._signed, headers={"Range": f"bytes={start}-{end}"}, timeout=120)
                if r.status_code in (401, 403):
                    self._resolve()
                    continue
                if r.status_code != 206:
                    raise IOError(f"HTTP {r.status_code}")
                self.requests_made += 1
                self.bytes_fetched += len(r.content)
                return r.content
            except Exception as e:  # network hiccup -> retry with backoff
                if attempt == 4:
                    raise
                time.sleep(2 ** attempt)
                if isinstance(e, IOError):
                    try:
                        self._resolve()
                    except Exception:
                        pass
        raise IOError("unreachable")

    def _block(self, idx):
        if idx in self.cache:
            self.cache.move_to_end(idx)
            return self.cache[idx]
        start = idx * self.block_size
        end = min(start + self.block_size, self.size) - 1
        data = self._fetch(start, end)
        self.cache[idx] = data
        if len(self.cache) > self.max_blocks:
            self.cache.popitem(last=False)
        return data

    # file protocol used by h5py
    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, offset, whence=0):
        if whence == 0:
            self.pos = offset
        elif whence == 1:
            self.pos += offset
        else:
            self.pos = self.size + offset
        return self.pos

    def read(self, n=-1):
        if n is None or n < 0:
            n = self.size - self.pos
        n = max(0, min(n, self.size - self.pos))
        if n == 0:
            return b""
        out = bytearray()
        start, end = self.pos, self.pos + n
        b0, b1 = start // self.block_size, (end - 1) // self.block_size
        for b in range(b0, b1 + 1):
            data = self._block(b)
            bs = b * self.block_size
            out += data[max(start, bs) - bs: min(end, bs + len(data)) - bs]
        self.pos = end
        return bytes(out)

    def readinto(self, buf):
        data = self.read(len(buf))
        buf[:len(data)] = data
        return len(data)

    def close(self):
        self.cache.clear()


def download_full(url, dest):
    """Resumable full download (fallback when range streaming is unusable)."""
    import requests
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if os.path.exists(dest):
        return dest
    part = dest + ".part"
    have = os.path.getsize(part) if os.path.exists(part) else 0
    s = requests.Session()
    headers = {"Range": f"bytes={have}-"} if have else {}
    with s.get(url, headers=headers, stream=True, allow_redirects=True, timeout=120) as r:
        if r.status_code in (401, 403) or "urs.earthdata.nasa.gov" in r.url:
            raise PermissionError(f"Earthdata login refused (HTTP {r.status_code})")
        r.raise_for_status()
        total = have + int(r.headers.get("Content-Length", 0))
        mode = "ab" if (have and r.status_code == 206) else "wb"
        done = have if mode == "ab" else 0
        t0 = time.time()
        with open(part, mode) as f:
            for chunk in r.iter_content(chunk_size=8 * 1024 * 1024):
                f.write(chunk)
                done += len(chunk)
                if time.time() - t0 > 15:
                    log(f"    download {done / 1e9:.2f}/{total / 1e9:.2f} GB")
                    t0 = time.time()
    os.replace(part, dest)
    return dest


# --------------------------------------------------------------------------
# 3. GCOV reader (defensive; discovers paths)
# --------------------------------------------------------------------------
def _scalar(v):
    if isinstance(v, np.ndarray):
        v = v.reshape(-1)[0] if v.size else None
    if isinstance(v, bytes):
        v = v.decode(errors="replace")
    if isinstance(v, np.generic):
        v = v.item()
    return v


def describe_grid(h5):
    """Log what is actually in the file (layout discovery)."""
    lines = []
    if GCOV_GRID not in h5:
        cands = []
        h5.visit(lambda n: cands.append(n) if n.endswith("frequencyA") else None)
        raise KeyError(f"{GCOV_GRID} not found; candidates: {cands[:10]}")
    g = h5[GCOV_GRID]
    for k in g.keys():
        obj = g[k]
        if hasattr(obj, "shape"):
            lines.append(f"      {k:24s} shape={obj.shape} dtype={obj.dtype} chunks={obj.chunks}")
    return lines


def read_epsg(g):
    proj = g["projection"]
    v = _scalar(proj[()])
    for key in ("epsg_code", "epsg", "EPSG"):
        if key in proj.attrs:
            return int(_scalar(proj.attrs[key]))
    return int(v)


def read_identification(h5):
    out = {}
    if IDENT in h5:
        ident = h5[IDENT]
        for k in ("trackNumber", "frameNumber", "orbitPassDirection", "zeroDopplerStartTime",
                  "zeroDopplerEndTime", "absoluteOrbitNumber", "productVersion", "lookDirection"):
            if k in ident:
                out[k] = _scalar(ident[k][()])
    return out


def utm_window_for_bbox(bbox, epsg, n=50):
    """Densified bbox edges -> projected CRS extent (min/max x, y)."""
    from pyproj import Transformer
    w, s, e, nn = bbox
    t = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
    lons = np.concatenate([np.linspace(w, e, n), np.full(n, e), np.linspace(e, w, n), np.full(n, w)])
    lats = np.concatenate([np.full(n, s), np.linspace(s, nn, n), np.full(n, nn), np.linspace(nn, s, n)])
    x, y = t.transform(lons, lats)
    return float(np.min(x)), float(np.max(x)), float(np.min(y)), float(np.max(y))


def index_slice(coords, lo, hi, pad):
    """Slice of a monotonic coordinate vector covering [lo, hi] plus pad pixels."""
    idx = np.where((coords >= lo) & (coords <= hi))[0]
    if idx.size == 0:
        raise ValueError("bbox does not intersect the granule grid")
    i0 = max(0, int(idx.min()) - pad)
    i1 = min(len(coords), int(idx.max()) + 1 + pad)
    return slice(i0, i1)


def read_incidence_range(h5, bbox, epsg):
    """Min/max incidence angle over the bbox from the radarGrid metadata cube
    (layer nearest 0 m height). Returns None if the cube is absent."""
    try:
        rg = h5[RADARGRID]
        inc = rg["incidenceAngle"]
        x = rg["xCoordinates"][()]
        y = rg["yCoordinates"][()]
        heights = rg["heightAboveEllipsoid"][()] if "heightAboveEllipsoid" in rg else np.array([0.0])
        k = int(np.argmin(np.abs(heights - 0.0))) if inc.ndim == 3 else None
        x0, x1, y0, y1 = utm_window_for_bbox(bbox, epsg)
        xs = index_slice(x, x0, x1, 1)
        ys = index_slice(y, y0, y1, 1)
        layer = inc[k, ys, xs] if k is not None else inc[ys, xs]
        layer = layer[np.isfinite(layer)]
        if layer.size == 0:
            return None
        return [round(float(layer.min()), 2), round(float(layer.max()), 2)]
    except Exception as e:
        log(f"    incidence angle cube not readable ({e}); will report null")
        return None


def read_gcov_crop(h5, bbox, pad=8):
    """Read the bbox window from a GCOV HDF5 handle. Returns a dict of arrays
    (linear gamma0 power) plus geo metadata."""
    g = h5[GCOV_GRID]
    epsg = read_epsg(g)
    x = g["xCoordinates"][()]
    y = g["yCoordinates"][()]
    dx = float(_scalar(g["xCoordinateSpacing"][()])) if "xCoordinateSpacing" in g else float(x[1] - x[0])
    dy = float(_scalar(g["yCoordinateSpacing"][()])) if "yCoordinateSpacing" in g else float(y[1] - y[0])
    x0, x1, y0, y1 = utm_window_for_bbox(bbox, epsg)
    xs = index_slice(x, x0, x1, pad)
    ys = index_slice(y, y0, y1, pad)
    terms = [t.decode() if isinstance(t, bytes) else str(t) for t in g["listOfCovarianceTerms"][()]] \
        if "listOfCovarianceTerms" in g else [k for k in g.keys() if len(k) == 4 and k.isupper()]
    log(f"    EPSG:{epsg}  spacing dx={dx} dy={dy}  terms={terms}  window rows {ys.start}:{ys.stop} cols {xs.start}:{xs.stop}")

    def rd(name, dtype=np.float32):
        ds = g[name]
        a = ds[ys, xs].astype(dtype)
        fv = ds.attrs.get("_FillValue", None)
        if fv is not None and np.issubdtype(dtype, np.floating):
            a[a == float(_scalar(fv))] = np.nan
        return a

    out = {
        "epsg": epsg, "x": x[xs].astype(np.float64), "y": y[ys].astype(np.float64),
        "dx": dx, "dy": dy, "terms": terms,
        "HH": rd("HHHH"), "HV": rd("HVHV"),
        "mask": rd("mask", np.uint8) if "mask" in g else None,
        "looks": rd("numberOfLooks") if "numberOfLooks" in g else None,
        "units": _scalar(g["HHHH"].attrs.get("units", b"")),
        "incidence": read_incidence_range(h5, bbox, epsg),
        "ident": read_identification(h5),
    }
    return out


def valid_from_crop(c):
    """Valid sample: finite, positive power, mask subswath 1..254 (0=invalid,
    255=fill per the GCOV spec)."""
    v = np.isfinite(c["HH"]) & np.isfinite(c["HV"]) & (c["HH"] > 0) & (c["HV"] > 0)
    if c.get("mask") is not None:
        m = c["mask"]
        vm = v & (m >= 1) & (m <= 254)
        if v.mean() > 0.05 and vm.mean() < 0.01 * v.mean():
            log(f"    WARNING: mask marks ~all finite data invalid (values {np.unique(m)[:8]}); "
                "ignoring mask - check mask semantics for this product version")
        else:
            v = vm
    return v


def load_crop(region_key, role, gran, args):
    """Crop from cache, local file, or remote range-read."""
    import h5py
    os.makedirs(RAW_DIR, exist_ok=True)
    cache = os.path.join(RAW_DIR, f"{gran['granule_id']}__{region_key}.npz")
    if os.path.exists(cache) and not args.refresh:
        log(f"  [{role}] using cached crop {os.path.basename(cache)}")
        z = np.load(cache, allow_pickle=True)
        c = {k: z[k] for k in z.files}
        c["meta"] = json.loads(str(c["meta"]))
        for k, v in c["meta"].items():
            c[k] = v
        if c.get("mask") is not None and c["mask"].dtype == object:
            c["mask"] = None
        return c
    bbox = REGIONS[region_key]["bbox"]
    local = os.path.join(RAW_DIR, gran["granule_id"] + ".h5")
    t0 = time.time()
    if args.download or os.path.exists(local):
        if not os.path.exists(local):
            log(f"  [{role}] downloading full granule ({(gran['size_bytes'] or 0) / 1e9:.1f} GB) -> {local}")
            download_full(gran["https_url"], local)
        with h5py.File(local, "r") as h5:
            log("    layout:\n" + "\n".join(describe_grid(h5)))
            c = read_gcov_crop(h5, bbox)
    else:
        log(f"  [{role}] range-streaming bbox window from {gran['granule_id']}")
        f = HTTPRangeFile(gran["https_url"])
        with h5py.File(f, "r", rdcc_nbytes=64 * 1024 * 1024) as h5:
            log("    layout:\n" + "\n".join(describe_grid(h5)))
            c = read_gcov_crop(h5, bbox)
        log(f"    fetched {f.bytes_fetched / 1e6:.0f} MB in {f.requests_made} requests "
            f"({100.0 * f.bytes_fetched / f.size:.1f}% of file) in {time.time() - t0:.0f}s")
    meta = {"epsg": c["epsg"], "dx": c["dx"], "dy": c["dy"], "terms": c["terms"], "units": c["units"],
            "incidence": c["incidence"], "ident": c["ident"]}
    np.savez_compressed(cache, x=c["x"], y=c["y"], HH=c["HH"], HV=c["HV"],
                        mask=c["mask"] if c["mask"] is not None else np.array(None, dtype=object),
                        looks=c["looks"] if c["looks"] is not None else np.ones_like(c["HH"]),
                        meta=json.dumps(meta, default=str))
    return c


# --------------------------------------------------------------------------
# 4. Web-Mercator output grid + resampling
# --------------------------------------------------------------------------
def lonlat_to_merc(lon, lat):
    lon = np.asarray(lon, dtype=np.float64)
    lat = np.asarray(lat, dtype=np.float64)
    x = MERC_R * np.radians(lon)
    y = MERC_R * np.log(np.tan(np.pi / 4.0 + np.radians(lat) / 2.0))
    return x, y


def merc_to_lonlat(x, y):
    lon = np.degrees(np.asarray(x, dtype=np.float64) / MERC_R)
    lat = np.degrees(2.0 * np.arctan(np.exp(np.asarray(y, dtype=np.float64) / MERC_R)) - np.pi / 2.0)
    return lon, lat


class MercGrid:
    """Grid uniform in EPSG:3857 whose OUTER pixel edges are the bbox corners
    (MapLibre image corners). Pixel (r, c) centre = edge + (i + 0.5) * step."""

    def __init__(self, bbox, long_side=1600):
        w, s, e, n = bbox
        self.bbox = bbox
        self.x0, self.y0 = lonlat_to_merc(w, n)  # top-left
        self.x1, self.y1 = lonlat_to_merc(e, s)  # bottom-right
        self.x0, self.y0, self.x1, self.y1 = map(float, (self.x0, self.y0, self.x1, self.y1))
        wm, hm = self.x1 - self.x0, self.y0 - self.y1
        if wm >= hm:
            self.W = long_side
            self.H = max(1, int(round(long_side * hm / wm)))
        else:
            self.H = long_side
            self.W = max(1, int(round(long_side * wm / hm)))
        self.dx = wm / self.W
        self.dy = hm / self.H

    def centres(self):
        xs = self.x0 + (np.arange(self.W) + 0.5) * self.dx
        ys = self.y0 - (np.arange(self.H) + 0.5) * self.dy
        return xs, ys

    def lonlat_to_pixel(self, lon, lat):
        """Fractional (row, col) of a lon/lat; integer part = containing pixel."""
        x, y = lonlat_to_merc(lon, lat)
        return (self.y0 - y) / self.dy, (x - self.x0) / self.dx

    def pixel_to_lonlat(self, row, col):
        x = self.x0 + (np.asarray(col) + 0.5) * self.dx
        y = self.y0 - (np.asarray(row) + 0.5) * self.dy
        return merc_to_lonlat(x, y)

    def row_pixel_area_km2(self):
        """Ground area of one pixel per row: Mercator scale factor is
        sec(lat) in both axes, so area = dx*dy*cos^2(lat)."""
        _, ys = self.centres()
        _, lat = merc_to_lonlat(np.zeros_like(ys), ys)
        return self.dx * self.dy * np.cos(np.radians(lat)) ** 2 / 1e6

    def ground_pixel_m(self):
        lat = math.radians((self.bbox[1] + self.bbox[3]) / 2.0)
        return self.dx * math.cos(lat)


def resample_crop_to_merc(c, grid, valid_frac_min=0.5):
    """Multilook (box-average valid linear power) in the native UTM grid to
    roughly the output ground spacing, then bilinear-sample at the Mercator
    pixel centres. Returns HH, HV (linear), looks, valid (bool)."""
    from pyproj import Transformer
    valid = valid_from_crop(c)
    in_sp = abs(float(c["dx"]))
    k = max(1, int(round(grid.ground_pixel_m() / in_sp)))
    vf = valid.astype(np.float32)
    w = ndi.uniform_filter(vf, size=k, mode="nearest") if k > 1 else vf

    def ml(a):
        a = np.where(valid, a, 0.0).astype(np.float32)
        if k > 1:
            a = ndi.uniform_filter(a, size=k, mode="nearest")
        return np.where(w > 0, a / np.maximum(w, 1e-6), 0.0)

    hh, hv = ml(c["HH"]), ml(c["HV"])
    looks_in = c.get("looks")
    looks_ml = (ml(np.asarray(looks_in, dtype=np.float32)) * k * k) if looks_in is not None else np.full_like(hh, k * k)

    xs, ys = grid.centres()
    XX, YY = np.meshgrid(xs, ys)
    lon, lat = merc_to_lonlat(XX, YY)
    t = Transformer.from_crs("EPSG:4326", f"EPSG:{int(c['epsg'])}", always_xy=True)
    ux, uy = t.transform(lon, lat)
    xv, yv = np.asarray(c["x"]), np.asarray(c["y"])
    col = (ux - xv[0]) / (xv[1] - xv[0])
    row = (uy - yv[0]) / (yv[1] - yv[0])  # works for ascending or descending y
    coords = np.array([row, col])
    samp = lambda a: ndi.map_coordinates(a, coords, order=1, mode="constant", cval=0.0)
    out_w = samp(w)
    ok = out_w >= valid_frac_min
    HH = np.where(ok, samp(hh), np.nan).astype(np.float32)
    HV = np.where(ok, samp(hv), np.nan).astype(np.float32)
    LK = np.where(ok, samp(looks_ml), 0.0).astype(np.float32)
    ok &= np.isfinite(HH) & np.isfinite(HV) & (HH > 0) & (HV > 0)
    return HH, HV, LK, ok, k


# --------------------------------------------------------------------------
# 5. Classification (retuned for real data)
# --------------------------------------------------------------------------
def otsu_threshold(values, lo=-30.0, hi=-5.0, bins=250):
    v = values[(values > lo) & (values < hi)]
    if v.size < 100:
        return None
    hist, edges = np.histogram(v, bins=bins, range=(lo, hi))
    centres = 0.5 * (edges[:-1] + edges[1:])
    w0 = np.cumsum(hist)
    w1 = w0[-1] - w0
    m0 = np.cumsum(hist * centres) / np.maximum(w0, 1)
    m1 = (np.sum(hist * centres) - np.cumsum(hist * centres)) / np.maximum(w1, 1)
    between = w0 * w1 * (m0 - m1) ** 2
    return float(centres[int(np.argmax(between))])


def fill_invalid(a, valid):
    """Replace invalid pixels by the nearest valid value so the Lee filter
    doesn't smear NaNs/zeros; they are masked again afterwards."""
    if valid.all():
        return a
    idx = ndi.distance_transform_edt(~valid, return_distances=False, return_indices=True)
    return a[tuple(idx)]


WATER_T_DEFAULT = -18.0
WATER_T_CLAMP = (-22.0, -15.0)
DELTA_DROP_DB = -3.0      # new open water / moderate decrease
DELTA_RISE_DB = 3.0       # recession
FV_RISE_DB = 2.5          # flooded vegetation HH rise (unchanged)
FV_DR_DROP_DB = -1.5      # flooded vegetation HV/HH ratio drop (unchanged)
MIN_CLUMP_PX = 6          # remove isolated change clumps smaller than this


def run_delta_sar_real(b_hh, b_hv, a_hh, a_hv, valid, looks):
    """DELTA-SAR change classes on real data.

    Changes vs the synthetic run_delta_sar_v2 (whose thresholds were tuned to
    its own fake dB levels):
      * An explicit open-water threshold T (Otsu on the bimodal HH dB
        histogram of both dates, clamped to [-22, -15] dB; default -18) is
        used instead of the fixed "-14 dB" water test. -14 dB is above the
        backscatter of many dry fields/sandbars at L-band and was the reason
        stable land could be called 'water'.
      * Class 1 (new open water) now requires water AFTER and NOT water
        BEFORE, plus a >=3 dB drop. Permanent river/sea water (water on both
        dates) therefore stays class 0, as it physically should.
      * Class 4 (recession) is the mirror: water before, not after, >=3 dB rise.
      * Class 3 (moderate decrease, non-water) keeps the old intent but its
        lower bound is T instead of -15.5 dB and the drop is >=3 dB.
      * Class 2 (double bounce) keeps the old +2.5 dB HH / -1.5 dB ratio
        rule, but excludes pixels that were water before (that is class 4).
      * Class 5 = no valid data in either date, or < 3 looks.
      * Clumps smaller than MIN_CLUMP_PX pixels are reset to 0 (speckle).
    The Lee filter is the original 5x5 one, using the real mean ENL.
    """
    enl = float(np.median(looks[valid])) if valid.any() else 4.0
    f = lambda a: apply_lee_filter_5x5(fill_invalid(a, valid), looks=enl)
    bhh, bhv, ahh, ahv = (power_to_db(f(a)) for a in (b_hh, b_hv, a_hh, a_hv))
    d_hh = ahh - bhh
    d_dr = (ahv - ahh) - (bhv - bhh)

    t_otsu = otsu_threshold(np.concatenate([bhh[valid], ahh[valid]]))
    T = WATER_T_DEFAULT if t_otsu is None else float(np.clip(t_otsu, *WATER_T_CLAMP))
    wb, wa = bhh < T, ahh < T

    cls = np.zeros(bhh.shape, dtype=np.uint8)
    c1 = wa & ~wb & (d_hh <= DELTA_DROP_DB)
    c4 = wb & ~wa & (d_hh >= DELTA_RISE_DB)
    c2 = ~wb & ~c1 & ~c4 & (d_hh >= FV_RISE_DB) & (d_dr <= FV_DR_DROP_DB)
    c3 = ~wa & ~c1 & ~c2 & ~c4 & (d_hh <= DELTA_DROP_DB) & (ahh <= -9.0)
    cls[c1], cls[c2], cls[c3], cls[c4] = 1, 2, 3, 4

    for cid in (1, 2, 3, 4):
        lab, n = ndi.label(cls == cid)
        if n:
            sizes = ndi.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
            small = np.isin(lab, np.where(sizes < MIN_CLUMP_PX)[0] + 1)
            cls[small] = 0
    cls[(~valid) | (looks < 3.0)] = 5

    info = {"water_threshold_db": round(T, 2),
            "water_threshold_otsu_raw_db": None if t_otsu is None else round(t_otsu, 2),
            "lee_enl_used": round(enl, 1),
            "permanent_water_mask": wb & wa & valid}
    return cls, bhh, bhv, ahh, ahv, d_hh, d_dr, info


# --------------------------------------------------------------------------
# 6. Images, polygons, metrics
# --------------------------------------------------------------------------
def fcc_image(hh_db, hv_db, valid):
    img = np.array(create_crisp_fcc_image(np.where(valid, hh_db, -30), np.where(valid, hv_db, -35)))
    img[~valid, 3] = 0
    return Image.fromarray(img)


HYPOTHESIS = {
    1: "HH backscatter fell below the open-water threshold after being above it before "
       "(>=3 dB drop): consistent with new standing surface water. Not field-verified.",
    2: "HH rose >=2.5 dB while HV/HH fell >=1.5 dB: consistent with water under vegetation "
       "(double-bounce), but also with crop/structure change. Not field-verified.",
    3: "Moderate (>=3 dB) HH decrease without reaching the open-water level: consistent with "
       "partial inundation (e.g. paddy) but also with soil drying, harvest or tillage. Ambiguous.",
    4: "Water before, not water after (>=3 dB rise): consistent with receding water or "
       "emerging sandbars/vegetation. Not field-verified.",
}


def vectorize_real_polygons(cls, grid, bhh, ahh, d_hh, d_dr, water_t, region_code,
                            min_area_km2=0.05, max_features=600):
    """Real class outlines via marching squares on each connected component.
    Coordinates are converted pixel -> Web Mercator -> lon/lat exactly.
    Confidence = share of the component's pixels whose decisive test passes
    by a >=1 dB margin (a computed robustness score, not a probability)."""
    from skimage.measure import find_contours
    from shapely.geometry import Polygon
    row_area = grid.row_pixel_area_km2()
    cands = []
    for cid in (1, 2, 3, 4):
        lab, n = ndi.label(cls == cid)
        if not n:
            continue
        objs = ndi.find_objects(lab)
        for i, sl in enumerate(objs, start=1):
            sub = lab[sl] == i
            rows = np.nonzero(sub)[0] + sl[0].start
            area = float(row_area[rows].sum())
            if area >= min_area_km2:
                cands.append((area, cid, i, sl, lab))
    cands.sort(key=lambda t: -t[0])
    feats = []
    for area, cid, i, sl, lab in cands[:max_features]:
        r0, c0 = sl[0].start, sl[1].start
        sub = np.pad((lab[sl] == i).astype(np.float32), 1)
        contours = find_contours(sub, 0.5)
        polys = []
        for ct in contours:
            if len(ct) < 4:
                continue
            rr = ct[:, 0] - 1 + r0
            cc = ct[:, 1] - 1 + c0
            lon, lat = grid.pixel_to_lonlat(rr, cc)
            p = Polygon(np.column_stack([lon, lat]))
            if p.is_valid and p.area > 0:
                polys.append(p)
        if not polys:
            continue
        polys.sort(key=lambda p: -p.area)
        outer = polys[0]
        holes = [p for p in polys[1:] if outer.contains(p)]
        tol = 0.25 * grid.dx / 111320.0
        outer_ring = list(outer.simplify(tol).exterior.coords)
        ring = chaikin_smooth([list(map(float, xy)) for xy in outer_ring], iterations=1)
        rings = [[[round(x, 6), round(y, 6)] for x, y in ring]]
        for h in holes:
            hr = chaikin_smooth([list(map(float, xy)) for xy in h.simplify(tol).exterior.coords], iterations=1)
            if len(hr) >= 4:
                rings.append([[round(x, 6), round(y, 6)] for x, y in hr])
        pix = np.zeros(cls.shape, dtype=bool)
        pix[sl] = lab[sl] == i
        if cid == 1:
            margin = (ahh[pix] <= water_t - 1.0) & (d_hh[pix] <= DELTA_DROP_DB - 1.0)
        elif cid == 2:
            margin = (d_hh[pix] >= FV_RISE_DB + 1.0) & (d_dr[pix] <= FV_DR_DROP_DB - 1.0)
        elif cid == 3:
            margin = d_hh[pix] <= DELTA_DROP_DB - 1.0
        else:
            margin = (bhh[pix] <= water_t - 1.0) & (d_hh[pix] >= DELTA_RISE_DB + 1.0)
        cen = outer.centroid
        feats.append({
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": rings},
            "properties": {
                "id": f"{region_code}-POLY-{len(feats) + 1:03d}",
                "class_id": int(cid),
                "class_name": CLASS_CONFIG[cid]["name"],
                "area_km2": round(area, 3),
                "area_hectares": round(area * 100.0, 1),
                "before_hh_db": round(float(np.mean(bhh[pix])), 2),
                "after_hh_db": round(float(np.mean(ahh[pix])), 2),
                "delta_hh_db": round(float(np.mean(d_hh[pix])), 2),
                "confidence": round(float(np.mean(margin)), 2),
                "centroid": [round(cen.x, 5), round(cen.y, 5)],
                "driver_hypothesis": HYPOTHESIS[cid],
                "radar_band": "L-band GCOV (24 cm)",
                "geometry_lock": True,
            },
        })
    return {"type": "FeatureCollection", "features": feats}, len(cands)


def class_stats(cls, grid):
    row_area = grid.row_pixel_area_km2()
    area_map = np.repeat(row_area[:, None], cls.shape[1], axis=1)
    total = cls.size
    out = {}
    for cid, conf in CLASS_CONFIG.items():
        m = cls == cid
        out[str(cid)] = {"name": conf["name"], "hex": conf["hex"], "pixel_count": int(m.sum()),
                         "area_km2": round(float(area_map[m].sum()), 2),
                         "percentage": round(100.0 * m.sum() / total, 2)}
    return out, area_map


# --------------------------------------------------------------------------
# 7. Driver
# --------------------------------------------------------------------------
def fmt_date(iso):
    d = datetime.strptime(iso[:10], "%Y-%m-%d")
    return f"{d.day} {d.strftime('%b')}"


def process_region(region_key, args):
    meta = REGIONS[region_key]
    bbox = meta["bbox"]
    out_dir = os.path.join(ROOT, "public", "processed", region_key)
    os.makedirs(out_dir, exist_ok=True)
    log(f"\n[REAL NISAR] {meta['name']}  bbox={bbox}")
    pair = resolve_pair(region_key)
    for role in ("before", "after"):
        log(f"  {role:6s}: {pair[role]['granule_id']}")

    crops = {role: load_crop(region_key, role, pair[role], args) for role in ("before", "after")}
    if crops["before"]["epsg"] != crops["after"]["epsg"]:
        log("  WARNING: before/after EPSG differ; each is reprojected independently")

    grid = MercGrid(bbox, long_side=args.size)
    log(f"  output grid {grid.W}x{grid.H} px, uniform in EPSG:3857, ~{grid.ground_pixel_m():.1f} m ground px")
    b = resample_crop_to_merc(crops["before"], grid)
    a = resample_crop_to_merc(crops["after"], grid)
    valid = b[3] & a[3]
    looks = np.minimum(b[2], a[2])
    log(f"  multilook factor before={b[4]} after={a[4]}; valid pixels both dates: {100 * valid.mean():.1f}%")

    cls, bhh, bhv, ahh, ahv, d_hh, d_dr, info = run_delta_sar_real(b[0], b[1], a[0], a[1], valid, looks)
    log(f"  water threshold T={info['water_threshold_db']} dB (Otsu raw {info['water_threshold_otsu_raw_db']}), "
        f"Lee ENL={info['lee_enl_used']}")

    fcc_image(bhh, bhv, valid).save(os.path.join(out_dir, "before_fcc.webp"), "WEBP", quality=92)
    fcc_image(ahh, ahv, valid).save(os.path.join(out_dir, "after_fcc.webp"), "WEBP", quality=92)
    create_crisp_change_overlay_image(cls).save(os.path.join(out_dir, "change_overlay.webp"), "WEBP",
                                                quality=95, lossless=True)

    code = "NAG" if region_key == "nagapattinam" else "MAJ"
    gj, n_cand = vectorize_real_polygons(cls, grid, bhh, ahh, d_hh, d_dr, info["water_threshold_db"], code)
    with open(os.path.join(out_dir, "evidence_polygons.geojson"), "w") as f:
        json.dump(gj, f)
    log(f"  polygons: {len(gj['features'])} written ({n_cand} components >= 0.05 km2)")

    stats, area_map = class_stats(cls, grid)
    perm_water_km2 = float(area_map[info["permanent_water_mask"]].sum())
    bi, ai = crops["before"].get("ident", {}) or {}, crops["after"].get("ident", {}) or {}
    pb, pa = pair["before"], pair["after"]
    track = int(bi.get("trackNumber", pb["track"]))
    frame = int(bi.get("frameNumber", pb["frame"]))
    direction = str(bi.get("orbitPassDirection", "Ascending" if pb["direction"] == "A" else "Descending")).title()
    inc = crops["before"].get("incidence") or crops["after"].get("incidence")
    if inc and crops["after"].get("incidence"):
        ia = crops["after"]["incidence"]
        inc = [min(inc[0], ia[0]), max(inc[1], ia[1])]
    enl = float(np.median(looks[valid])) if valid.any() else None
    b_date = pb["start"]
    a_date = pa["start"]

    summary = {
        "region_id": region_key,
        "region_name": meta["name"],
        "data_mode": "real_nisar_gcov",
        "processed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "bbox": bbox,
        "center": meta["center"],
        "zoom": meta["zoom"],
        "orbit_track": track,
        "orbit_direction": direction,
        "frame_number": frame,
        "geometry_lock": True,
        "radar_band": "L-band (1.25 GHz / 24 cm λ)",
        "polarization": "Dual-Pol (HH + HV)",
        "incidence_angles": inc,
        "before_granule": pb["granule_id"],
        "after_granule": pa["granule_id"],
        "before_date": b_date,
        "after_date": a_date,
        "flood_event": f"Observed change, {fmt_date(b_date)} → {fmt_date(a_date)} {a_date[:4]}",
        "total_swath_area_km2": round(float(area_map[valid].sum()), 2),
        "classes": stats,
        "permanent_water_km2": round(perm_water_km2, 2),
        "validation_stats": {
            "lee_filter_window": "5x5",
            "equivalent_number_of_looks": None if enl is None else round(enl, 1),
            "speckle_suppression_index": None,
            "coregistration_rmse_m": None,
            "radiometric_resolution_db": None,
        },
        "provenance": {
            "source": "NASA/ASF NISAR L2 GCOV (collection NISAR_L2_GCOV_V1, " + COLLECTION_CONCEPT + ")",
            "before_url": pb["https_url"],
            "after_url": pa["https_url"],
            "before_s3_url": pb["s3_url"],
            "after_s3_url": pa["s3_url"],
            "processing_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "pipeline": "processing/real_nisar.py",
            "source_crs": f"EPSG:{crops['before']['epsg']}",
            "source_pixel_spacing_m": [abs(crops["before"]["dx"]), abs(crops["before"]["dy"])],
            "backscatter_quantity": "gamma0 (RTC, linear power) from HHHH/HVHV; units attr: "
                                    + str(crops["before"].get("units")),
            "grid_crs": "EPSG:3857 (uniform in Web Mercator; outer pixel edges = bbox corners)",
            "grid_size_px": [grid.W, grid.H],
            "ground_pixel_m_approx": round(grid.ground_pixel_m(), 1),
            "multilook_factor_native_px": [b[4], a[4]],
            "water_threshold_db": info["water_threshold_db"],
            "water_threshold_otsu_raw_db": info["water_threshold_otsu_raw_db"],
            "areas": "per-pixel ground area = dx*dy*cos^2(lat) (Web Mercator scale factor)",
            "polygon_confidence": "share of polygon pixels passing the class test by >=1 dB margin "
                                  "(robustness score, not a probability)",
            "notes": [
                "Both dates are the same track/frame/mode; both are geocoded by the producer onto the "
                "same UTM posting, so no extra coregistration was done and none is claimed.",
                "Class labels describe radar backscatter change only; no flood event is asserted "
                "and nothing is field-verified.",
                "Permanent water (water on both dates) is class 0; its area is permanent_water_km2.",
                "Incidence angles are the min/max of the GCOV radarGrid incidenceAngle cube over the "
                "bbox (layer nearest 0 m height); null if the cube was absent.",
            ],
        },
    }
    with open(os.path.join(out_dir, "summary_metrics.json"), "w") as f:
        json.dump(summary, f, indent=2)

    if args.probe:
        probe_outputs(region_key, grid, cls, bhh, ahh, valid, info, stats, perm_water_km2)

    catalog_entry = {
        "region_id": region_key,
        "region_name": meta["name"],
        "bbox": bbox,
        "center": meta["center"],
        "zoom": meta["zoom"],
        "pairs": [{
            "id": f"{code}_PAIR_01_REAL",
            "label": f"NISAR GCOV {fmt_date(b_date)} vs {fmt_date(a_date)} {a_date[:4]} (track {track}, frame {frame})",
            "orbit_track": track,
            "orbit_direction": direction,
            "frame_number": frame,
            "geometry_lock": True,
            "radar_band": "L-band (1.25 GHz / 24 cm λ)",
            "polarization": "Dual-Pol (HH + HV)",
            "incidence_angle_range": inc,
            "before": {"granule_id": pb["granule_id"], "date": b_date,
                       "nominal_looks": None if enl is None else round(enl, 1),
                       "s3_url": pb["s3_url"], "https_url": pb["https_url"]},
            "after": {"granule_id": pa["granule_id"], "date": a_date,
                      "nominal_looks": None if enl is None else round(enl, 1),
                      "s3_url": pa["s3_url"], "https_url": pa["https_url"]},
            "flood_event": summary["flood_event"],
            "active": True,
        }],
        "live_cmr_count": 2,
    }
    return catalog_entry


# Known permanent-water probe points (lon, lat) - checked against both dates.
WATER_PROBES = {
    "majuli": [("Brahmaputra main channel S of Majuli", 94.20, 26.86),
               ("Brahmaputra main channel SW", 94.02, 26.84)],
    "nagapattinam": [("Bay of Bengal E of Nagapattinam", 79.93, 10.77),
                     ("Bay of Bengal NE", 79.94, 10.95)],
}


def probe_outputs(region_key, grid, cls, bhh, ahh, valid, info, stats, perm_km2):
    log("  --- probe ---")
    for cid, s in stats.items():
        log(f"    class {cid} {s['name'][:38]:38s} {s['area_km2']:9.2f} km2 {s['percentage']:6.2f}%")
    log(f"    permanent water (both dates < T): {perm_km2:.2f} km2")
    h, e = np.histogram(bhh[valid], bins=12, range=(-30, 0))
    log("    before HH dB hist: " + " ".join(f"{int(e[i])}:{h[i]}" for i in range(len(h))))
    T = info["water_threshold_db"]
    for name, lon, lat in WATER_PROBES.get(region_key, []):
        r, c = grid.lonlat_to_pixel(lon, lat)
        r, c = int(r), int(c)
        win = (slice(max(r - 3, 0), r + 4), slice(max(c - 3, 0), c + 4))
        vb, va = float(np.nanmedian(bhh[win])), float(np.nanmedian(ahh[win]))
        log(f"    {name:38s} px({r},{c}) before {vb:6.1f} dB after {va:6.1f} dB "
            f"-> water both: {vb < T and va < T}  classes={np.unique(cls[win]).tolist()}")
    lon_tl, lat_tl = grid.pixel_to_lonlat(-0.5, -0.5)
    lon_br, lat_br = grid.pixel_to_lonlat(grid.H - 0.5, grid.W - 0.5)
    log(f"    image outer corners: TL ({float(lon_tl):.6f},{float(lat_tl):.6f}) "
        f"BR ({float(lon_br):.6f},{float(lat_br):.6f}) vs bbox {grid.bbox}")


def main():
    ap = argparse.ArgumentParser(description="DELTAWATCH real NISAR GCOV pipeline")
    ap.add_argument("--region", default="all", choices=["all", "majuli", "nagapattinam"])
    ap.add_argument("--download", action="store_true", help="download full granules instead of range-streaming")
    ap.add_argument("--refresh", action="store_true", help="ignore cached crops in processing/raw/")
    ap.add_argument("--size", type=int, default=1600, help="output long-side pixels")
    ap.add_argument("--no-probe", dest="probe", action="store_false")
    ap.add_argument("--resolve-only", action="store_true", help="only resolve granules via CMR and exit")
    args = ap.parse_args()

    regions = ["majuli", "nagapattinam"] if args.region == "all" else [args.region]
    if args.resolve_only:
        for r in regions:
            p = resolve_pair(r)
            for role in ("before", "after"):
                log(f"{r:13s} {role:6s} {p[role]['granule_id']}  {(p[role]['size_bytes'] or 0) / 1e9:.2f} GB")
        return
    if not netrc_has_earthdata():
        cached = all(os.path.exists(os.path.join(RAW_DIR, f"{resolve_pair(r)[role]['granule_id']}__{r}.npz"))
                     for r in regions for role in ("before", "after"))
        if not cached:
            sys.exit("No ~/.netrc entry for urs.earthdata.nasa.gov - add Earthdata Login credentials "
                     "(machine urs.earthdata.nasa.gov login <user> password <pass>; chmod 600 ~/.netrc).")

    cat_path = os.path.join(ROOT, "public", "data", "available_scenes.json")
    try:
        with open(cat_path) as f:
            catalog = json.load(f)
    except Exception:
        catalog = {"regions": {}}
    for r in regions:
        catalog.setdefault("regions", {})[r] = process_region(r, args)
    catalog["generated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    catalog["description"] = "NASA-ISRO NISAR L2 GCOV same-track scene pairs (real data, NISAR_L2_GCOV_V1)"
    catalog["data_mode"] = "real_nisar_gcov"
    with open(cat_path, "w") as f:
        json.dump(catalog, f, indent=2)
    log("\n[DONE] real NISAR outputs written.")


if __name__ == "__main__":
    main()
