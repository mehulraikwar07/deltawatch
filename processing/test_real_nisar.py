#!/usr/bin/env python3
"""Offline tests for real_nisar.py (no Earthdata credentials needed).

Builds a tiny synthetic file with the GCOV layout
(/science/LSAR/GCOV/grids/frequencyA/{HHHH,HVHV,mask,numberOfLooks,
xCoordinates,yCoordinates,projection,...} + metadata/radarGrid cube),
serves it over a local HTTP server that honours Range requests, and checks:
  1. HTTPRangeFile + h5py read only part of the file and get exact values.
  2. Reprojection round trip: a field equal to UTM easting/northing, resampled
     onto the Web-Mercator grid, reproduces the easting/northing of each
     output pixel's lon/lat (sub-pixel), and known lon/lat -> right pixel.
  3. Grid corners equal the bbox; Mercator areas vs geodesic areas.
  4. Classification: permanent river = class 0, new water patch = class 1
     at the right place, fill (mask 255) = class 5.
Run: processing/.venv/bin/python processing/test_real_nisar.py
"""
import http.server
import os
import tempfile
import threading

import h5py
import numpy as np
from pyproj import Geod, Transformer

import real_nisar as rn

BBOX = [93.95, 26.80, 94.45, 27.15]
EPSG = 32646
SP = 20.0
RIVER_LAT = 26.86          # permanent water band (both dates)
NEW_WATER = (94.30, 27.05)  # new water patch centre (after only)
NEW_HALF_M = 1500.0


def make_gcov(path, after=False):
    t = Transformer.from_crs("EPSG:4326", f"EPSG:{EPSG}", always_xy=True)
    x0, x1, y0, y1 = rn.utm_window_for_bbox(BBOX, EPSG)
    x = np.arange(x0 - 2000, x1 + 2000, SP) + SP / 2
    y = np.arange(y1 + 2000, y0 - 2000, -SP) - SP / 2  # north-up, descending
    X, Y = np.meshgrid(x, y)
    tinv = Transformer.from_crs(f"EPSG:{EPSG}", "EPSG:4326", always_xy=True)
    lon, lat = tinv.transform(X, Y)
    rng = np.random.default_rng(1 if after else 0)
    hh_db = np.full(X.shape, -9.0)
    hv_db = np.full(X.shape, -16.0)
    river = np.abs(lat - RIVER_LAT) < 0.01
    hh_db[river], hv_db[river] = -24.0, -30.0
    nx, ny = t.transform(*NEW_WATER)
    patch = (np.abs(X - nx) < NEW_HALF_M) & (np.abs(Y - ny) < NEW_HALF_M)
    if after:
        hh_db[patch], hv_db[patch] = -23.0, -29.0
    speck = rng.gamma(4.0, 0.25, X.shape)
    hh = (10 ** (hh_db / 10) * speck).astype(np.float32)
    hv = (10 ** (hv_db / 10) * rng.gamma(4.0, 0.25, X.shape)).astype(np.float32)
    mask = np.ones(X.shape, np.uint8)
    mask[:, :200] = 255  # fill strip on the west edge
    hh[mask == 255] = np.nan
    hv[mask == 255] = np.nan
    with h5py.File(path, "w", libver="latest") as f:
        g = f.create_group(rn.GCOV_GRID)
        for k, a in (("HHHH", hh), ("HVHV", hv)):
            d = g.create_dataset(k, data=a, chunks=(256, 256), compression="gzip")
            d.attrs["units"] = b"1"
        g.create_dataset("mask", data=mask, chunks=(256, 256), compression="gzip")
        g.create_dataset("numberOfLooks", data=np.full(X.shape, 4.0, np.float32), chunks=(256, 256))
        g.create_dataset("xCoordinates", data=x)
        g.create_dataset("yCoordinates", data=y)
        g.create_dataset("xCoordinateSpacing", data=SP)
        g.create_dataset("yCoordinateSpacing", data=-SP)
        p = g.create_dataset("projection", data=np.uint32(EPSG))
        p.attrs["epsg_code"] = EPSG
        g.create_dataset("listOfCovarianceTerms", data=np.array([b"HHHH", b"HVHV"]))
        rg = f.create_group(rn.RADARGRID)
        cx, cy = x[::100], y[::100]
        rg.create_dataset("xCoordinates", data=cx)
        rg.create_dataset("yCoordinates", data=cy)
        rg.create_dataset("heightAboveEllipsoid", data=np.array([-500.0, 0.0, 500.0]))
        inc = np.broadcast_to(30 + 15 * (cx - cx[0]) / (cx[-1] - cx[0]), (3, len(cy), len(cx)))
        rg.create_dataset("incidenceAngle", data=np.ascontiguousarray(inc, dtype=np.float32))
        idg = f.create_group(rn.IDENT)
        idg.create_dataset("trackNumber", data=40)
        idg.create_dataset("frameNumber", data=15)
        idg.create_dataset("orbitPassDirection", data=b"Ascending")
    return x, y


class RangeHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        path = self.translate_path(self.path)
        size = os.path.getsize(path)
        rng = self.headers.get("Range")
        if not rng:
            self.send_response(200)
            self.send_header("Content-Length", str(size))
            self.end_headers()
            with open(path, "rb") as f:
                self.wfile.write(f.read())
            return
        a, b = rng.split("=")[1].split("-")
        a, b = int(a), min(int(b), size - 1)
        with open(path, "rb") as f:
            f.seek(a)
            data = f.read(b - a + 1)
        self.send_response(206)
        self.send_header("Content-Range", f"bytes {a}-{b}/{size}")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def serve(directory):
    handler = lambda *a, **k: RangeHandler(*a, directory=directory, **k)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def test_all():
    tmp = tempfile.mkdtemp(prefix="gcovtest_")
    pb, pa = os.path.join(tmp, "before.h5"), os.path.join(tmp, "after.h5")
    make_gcov(pb, after=False)
    make_gcov(pa, after=True)
    srv = serve(tmp)
    base = f"http://127.0.0.1:{srv.server_address[1]}"

    # 1. range streaming
    f = rn.HTTPRangeFile(base + "/before.h5", block_size=256 * 1024)
    with h5py.File(f, "r") as h5:
        lines = rn.describe_grid(h5)
        crop_b = rn.read_gcov_crop(h5, BBOX)
    with h5py.File(pb, "r") as h5:
        crop_local = rn.read_gcov_crop(h5, BBOX)
    assert np.array_equal(np.nan_to_num(crop_b["HH"]), np.nan_to_num(crop_local["HH"])), "range read mismatch"
    assert crop_b["epsg"] == EPSG and crop_b["incidence"] is not None
    assert crop_b["ident"]["trackNumber"] == 40
    print(f"[ok] range read: {f.requests_made} requests, {f.bytes_fetched / 1e6:.1f}/{f.size / 1e6:.1f} MB; "
          f"layout lines={len(lines)}; incidence={crop_b['incidence']}")
    with h5py.File(rn.HTTPRangeFile(base + "/after.h5"), "r") as h5:
        crop_a = rn.read_gcov_crop(h5, BBOX)

    # 2. reprojection round trip (field = UTM easting / northing)
    grid = rn.MercGrid(BBOX, long_side=800)
    X, Y = np.meshgrid(crop_b["x"], crop_b["y"])
    fake = dict(crop_b, HH=X.astype(np.float64) - 5e5 + 1e6, HV=Y.astype(np.float64),
                mask=np.ones_like(crop_b["mask"]), looks=None)
    fake["HH"] = fake["HH"].astype(np.float64)
    xs, ys = grid.centres()
    XX, YY = np.meshgrid(xs, ys)
    lon, lat = rn.merc_to_lonlat(XX, YY)
    ex, ey = Transformer.from_crs("EPSG:4326", f"EPSG:{EPSG}", always_xy=True).transform(lon, lat)
    # bypass multilook (k=1) by sampling directly
    col = (ex - fake["x"][0]) / (fake["x"][1] - fake["x"][0])
    row = (ey - fake["y"][0]) / (fake["y"][1] - fake["y"][0])
    from scipy.ndimage import map_coordinates
    got_x = map_coordinates(fake["HH"], [row, col], order=1) - 1e6 + 5e5
    got_y = map_coordinates(fake["HV"], [row, col], order=1)
    err = max(np.abs(got_x - ex)[5:-5, 5:-5].max(), np.abs(got_y - ey)[5:-5, 5:-5].max())
    assert err < 0.5, err
    # known lon/lat -> pixel -> lon/lat
    for lo, la in [(94.2, 26.9), (93.951, 27.149), (94.449, 26.801)]:
        r, c = grid.lonlat_to_pixel(lo, la)
        lo2, la2 = grid.pixel_to_lonlat(int(r), int(c))
        assert abs(lo2 - lo) <= grid.dx / 111320 * 1.01 and abs(la2 - la) < 0.01
    print(f"[ok] reprojection round trip max err {err:.3f} m; lon/lat->pixel checks pass")

    # 3. corners and area
    tl = grid.pixel_to_lonlat(-0.5, -0.5)
    br = grid.pixel_to_lonlat(grid.H - 0.5, grid.W - 0.5)
    assert np.allclose([tl[0], tl[1], br[0], br[1]], [BBOX[0], BBOX[3], BBOX[2], BBOX[1]], atol=1e-9)
    merc_area = grid.row_pixel_area_km2().sum() * grid.W
    g = Geod(ellps="WGS84")
    geo_area = abs(g.polygon_area_perimeter([BBOX[0], BBOX[2], BBOX[2], BBOX[0]],
                                            [BBOX[1], BBOX[1], BBOX[3], BBOX[3]])[0]) / 1e6
    assert abs(merc_area - geo_area) / geo_area < 0.01, (merc_area, geo_area)
    print(f"[ok] corners == bbox; area mercator {merc_area:.1f} vs geodesic {geo_area:.1f} km2")

    # 4. classification end-to-end
    b = rn.resample_crop_to_merc(crop_b, grid)
    a = rn.resample_crop_to_merc(crop_a, grid)
    valid = b[3] & a[3]
    cls, bhh, bhv, ahh, ahv, dhh, ddr, info = rn.run_delta_sar_real(b[0], b[1], a[0], a[1], valid, np.minimum(b[2], a[2]))
    r, c = map(int, grid.lonlat_to_pixel(*NEW_WATER))
    assert cls[r, c] == 1, cls[r - 2:r + 3, c - 2:c + 3]
    rr, cc = map(int, grid.lonlat_to_pixel(94.2, RIVER_LAT))
    assert cls[rr, cc] == 0 and info["permanent_water_mask"][rr, cc]
    stats, _ = rn.class_stats(cls, grid)
    exp_patch = (2 * NEW_HALF_M / 1000) ** 2
    assert abs(stats["1"]["area_km2"] - exp_patch) / exp_patch < 0.15, stats["1"]
    assert stats["2"]["area_km2"] + stats["3"]["area_km2"] + stats["4"]["area_km2"] < 0.5, stats
    gj, _ = rn.vectorize_real_polygons(cls, grid, bhh, ahh, dhh, ddr, info["water_threshold_db"], "TST")
    p1 = [f for f in gj["features"] if f["properties"]["class_id"] == 1]
    assert len(p1) == 1
    cen = p1[0]["properties"]["centroid"]
    assert abs(cen[0] - NEW_WATER[0]) < 0.002 and abs(cen[1] - NEW_WATER[1]) < 0.002, cen
    print(f"[ok] classes: T={info['water_threshold_db']} dB, new water {stats['1']['area_km2']} km2 "
          f"(expected {exp_patch}), class5 {stats['5']['area_km2']} km2 (fill strip), "
          f"polygon centroid {cen} conf {p1[0]['properties']['confidence']}")
    img = rn.fcc_image(bhh, bhv, valid)
    assert np.array(img)[:, :, 3][~valid].max() == 0
    print("[ok] FCC nodata fully transparent")
    srv.shutdown()
    print("ALL TESTS PASSED")


if __name__ == "__main__":
    test_all()
