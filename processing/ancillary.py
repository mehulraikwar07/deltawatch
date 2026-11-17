"""Ancillary layers resampled onto the same Web-Mercator grid as the radar.

HAND  - Height Above Nearest Drainage (m), ASF GLO-30 HAND, derived from the
        Copernicus GLO-30 DEM. Low HAND = close in height to a river, so it can flood.
        https://glo-30-hand.s3.us-west-2.amazonaws.com/v1/2021/
JRC   - Global Surface Water occurrence (%), share of 1984-2021 Landsat
        observations in which the pixel was water (Pekel et al. 2016, v1.4).
        https://storage.googleapis.com/global-surface-water/downloads2021/occurrence/

Both are public (no login) and read as windows over HTTP via GDAL /vsicurl/.
"""
import math
import os

import numpy as np

HAND_URL = ("/vsicurl/https://glo-30-hand.s3.us-west-2.amazonaws.com/v1/2021/"
            "Copernicus_DSM_COG_10_{ns}{lat:02d}_00_{ew}{lon:03d}_00_HAND.tif")
JRC_URL = ("/vsicurl/https://storage.googleapis.com/global-surface-water/downloads2021/"
           "occurrence/occurrence_{lon}{ew}_{lat}{ns}v1_4_2021.tif")

os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif")


def _dst(grid):
    from rasterio.transform import Affine
    return Affine(grid.dx, 0.0, grid.x0, 0.0, -grid.dy, grid.y0), (grid.H, grid.W)


def _warp_into(paths, grid, resampling, nodata):
    import rasterio
    from rasterio.warp import reproject
    transform, shape = _dst(grid)
    out = np.full(shape, np.nan, dtype=np.float32)
    for p in paths:
        tmp = np.full(shape, np.nan, dtype=np.float32)
        with rasterio.open(p) as src:
            reproject(source=rasterio.band(src, 1), destination=tmp,
                      src_transform=src.transform, src_crs=src.crs,
                      src_nodata=src.nodata if src.nodata is not None else nodata,
                      dst_transform=transform, dst_crs="EPSG:3857", dst_nodata=np.nan,
                      resampling=resampling)
        fill = np.isnan(out) & np.isfinite(tmp)
        out[fill] = tmp[fill]
    return out


def hand_on_grid(grid):
    """HAND (m) averaged onto the grid. Tiles are 1x1 degree, named by SW corner."""
    from rasterio.enums import Resampling
    w, s, e, n = grid.bbox
    paths = []
    for lat in range(math.floor(s), math.floor(n) + 1):
        for lon in range(math.floor(w), math.floor(e) + 1):
            paths.append(HAND_URL.format(ns="N" if lat >= 0 else "S", lat=abs(lat),
                                         ew="E" if lon >= 0 else "W", lon=abs(lon)))
    return _warp_into(paths, grid, Resampling.average, nodata=None)


def jrc_occurrence_on_grid(grid):
    """JRC occurrence (0-100 %) averaged onto the grid. Tiles are 10x10 degree,
    named by their NW corner (e.g. 90E_30N covers 90-100E, 20-30N)."""
    from rasterio.enums import Resampling
    w, s, e, n = grid.bbox
    paths = []
    for lat_top in range(int(math.ceil(s / 10.0) * 10), int(math.ceil(n / 10.0) * 10) + 1, 10):
        for lon_left in range(int(math.floor(w / 10.0) * 10), int(math.floor(e / 10.0) * 10) + 1, 10):
            if lat_top - 10 >= n or lat_top <= s:
                continue
            paths.append(JRC_URL.format(lon=abs(lon_left), ew="E" if lon_left >= 0 else "W",
                                        lat=abs(lat_top), ns="N" if lat_top >= 0 else "S"))
    occ = _warp_into(paths, grid, Resampling.average, nodata=255)
    return np.where(occ > 100, np.nan, occ)
