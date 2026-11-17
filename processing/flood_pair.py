#!/usr/bin/env python3
"""DELTAWATCH monsoon flood map: dry-season reference vs monsoon pass (real NISAR GCOV).

Unlike real_nisar.py (which judges every pixel on its own and therefore also
paints field-level farming changes), this run builds a FLOOD map:

  1. Dates chosen by river flow, not convenience: a dry-season reference and the
     monsoon pass with the highest GloFAS river discharge (same track/frame/mode).
  2. Normal water  = radar water on the dry-season date.
  3. Open floodwater = water on the monsoon date, not normally water, HH dropped
     >= 3 dB, HAND <= HAND_MAX_M (low enough to be reached by the river), and
     CONNECTED to the main water network: dry-season radar water plus JRC long-term
     water (>= 50 % occurrence), gaps <= 2 px bridged, bodies >= the region's seed size.
     Tested on Majuli: river-connected flood was water in 99% of JRC 1984-2021
     records vs 53% for water connected only via small ponds or isolated.
  3b. New water away from the river = rain ponding / flooded paddy: own class,
     drawn faintly, NOT counted as river flood.
  4. Flooded vegetation = HH rise + HV/HH drop (double bounce), low HAND, and
     within FV_NEAR_M of open floodwater / the river.
  5. Everything else that changed (isolated field-sized patches) is reported as
     'field-scale change, not counted as flood' and is not drawn by default.

Outputs use the same file names/schema the app reads, plus:
  river_overlay.webp  normal-water layer (dry-season river), drawn under the flood.
  flood_timeseries.json  river discharge (GloFAS) or rainfall (ERA5) used to choose the dates.

Run:  processing/.venv/bin/python processing/flood_pair.py --region majuli
"""
import argparse
import json
import os
import sys
import types
from datetime import datetime, timezone

import numpy as np
import requests
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import real_nisar as R          # noqa: E402
import ancillary as A           # noqa: E402

ROOT = R.ROOT
HAND_MAX_M = 10.0          # floodwater above 10 m HAND is implausible (common choice 10-15 m)
SEED_MIN_KM2 = 2.0         # river network = dry-season water bodies >= 2 km2 (ponds are not seeds)
FV_NEAR_M = 1000.0         # flooded vegetation must be within 1 km of open flood / river
MIN_FLOOD_PX = 6

PAIRS = {
    "majuli": {
        "dry": {"collection": "NISAR_L2_GCOV_V1",
                "granule_id": "NISAR_L2_PR_GCOV_035_040_A_015_4005_DHDH_A_20261107T230527_20261107T230602_P05036_N_F_J_001"},
        "flood": {"collection": "NISAR_L2_GCOV_PROVISIONAL_V1",
                  "granule_id": "NISAR_L2_PR_GCOV_025_040_A_015_4005_DHDH_A_20260710T230529_20260710T230603_P05023_N_F_J_001"},
        "context": {"kind": "discharge", "name": "Brahmaputra at Majuli (GloFAS grid cell)", "lat": 26.93, "lon": 94.22},
        "code": "MAJ", "network": "the Brahmaputra", "seed_min_km2": 2.0,
        "mode_label": "Monsoon flood vs dry season", "labels": ["Dry season", "Monsoon"],
        "passes": ["2026-06-16", "2026-06-28", "2026-07-10", "2026-07-22", "2026-08-15", "2026-08-27",
                   "2026-09-08", "2026-09-20", "2026-10-02", "2026-10-14", "2026-10-26", "2026-11-07"],
    },
    "nagapattinam": {
        "dry": {"collection": "NISAR_L2_GCOV_PROVISIONAL_V1",
                "granule_id": "NISAR_L2_PR_GCOV_032_084_A_007_4005_DHDH_A_20261006T001553_20261006T001627_P05023_N_F_J_001"},
        "flood": {"collection": "NISAR_L2_GCOV_V1",
                  "granule_id": "NISAR_L2_PR_GCOV_034_084_A_007_4005_DHDH_A_20261030T001553_20261030T001628_P05036_N_F_J_001"},
        "context": {"kind": "rainfall", "name": "Nagapattinam (ERA5 reanalysis grid cell)", "lat": 10.77, "lon": 79.80},
        "code": "NAG", "network": "the rivers and the sea", "seed_min_km2": 0.5,
        "mode_label": "After heavy northeast-monsoon rain vs before", "labels": ["Before rain", "After rain"],
        "passes": ["2026-06-20", "2026-07-02", "2026-07-14", "2026-07-26", "2026-08-19", "2026-08-31",
                   "2026-09-12", "2026-09-24", "2026-10-06", "2026-10-18", "2026-10-30", "2026-11-11"],
    },
}

CLASSES = {
    0: {"name": "No flood signal", "color": [0, 0, 0, 0], "hex": "#00000000"},
    1: {"name": "Floodwater (connected to {network})", "color": [0, 240, 255, 235], "hex": "#00F0FF"},
    2: {"name": "Flooded Vegetation near Water (likely)", "color": [255, 46, 147, 220], "hex": "#FF2E93"},
    3: {"name": "Standing Water away from {network} (rain / paddy)", "color": [255, 196, 64, 120], "hex": "#FFC440"},
    4: {"name": "Field-scale Change (not counted as flood)", "color": [0, 0, 0, 0], "hex": "#10B981"},
    5: {"name": "No Valid Radar Data", "color": [100, 116, 139, 140], "hex": "#64748B"},
}


def log(m):
    print(m, flush=True)


def granule(entry):
    r = requests.get(R.CMR_URL, params={"short_name": entry["collection"],
                                        "granule_ur": entry["granule_id"]}, timeout=60)
    r.raise_for_status()
    it = r.json()["items"][0]
    u = it["umm"]
    https = [x["URL"] for x in u["RelatedUrls"]
             if x.get("Type") == "GET DATA" and x["URL"].startswith("https") and x["URL"].endswith(".h5")][0]
    meta = R.parse_granule_name(entry["granule_id"])
    return {"granule_id": entry["granule_id"], "https_url": https, "size_bytes": None,
            "collection": entry["collection"], "concept_id": it["meta"]["concept-id"], **meta}


def context_series(ctx, start, end):
    """Daily river discharge (GloFAS) or rainfall (ERA5) from Open-Meteo, as {date: value}."""
    if ctx["kind"] == "discharge":
        url, var = "https://flood-api.open-meteo.com/v1/flood", "river_discharge"
    else:
        url, var = "https://archive-api.open-meteo.com/v1/archive", "precipitation_sum"
    for attempt in range(4):
        r = requests.get(url, params={"latitude": ctx["lat"], "longitude": ctx["lon"], "daily": var,
                                      "start_date": start, "end_date": end, "timezone": "UTC"}, timeout=60)
        if r.ok and r.text.startswith("{"):
            d = r.json()["daily"]
            return dict(zip(d["time"], d[var]))
        import time
        time.sleep(3 * (attempt + 1))
    r.raise_for_status()
    raise RuntimeError("context series unavailable")


def lee_db(lin, valid, enl):
    return R.power_to_db(R.apply_lee_filter_5x5(R.fill_invalid(lin, valid), looks=enl))


def classify(D, F, valid, looks, hand, grid, seed_min_km2=SEED_MIN_KM2, jrc=None):
    enl = float(np.median(looks[valid])) if valid.any() else 4.0
    dhh, dhv = lee_db(D[0], valid, enl), lee_db(D[1], valid, enl)
    fhh, fhv = lee_db(F[0], valid, enl), lee_db(F[1], valid, enl)

    # Radiometric consistency check: provisional vs final product on stable, dry land
    t_otsu = R.otsu_threshold(np.concatenate([dhh[valid], fhh[valid]]))
    T = R.WATER_T_DEFAULT if t_otsu is None else float(np.clip(t_otsu, *R.WATER_T_CLAMP))
    stable = valid & (dhh > T + 3) & (fhh > T + 3) & (hand > 3)
    offset = float(np.median(fhh[stable] - dhh[stable])) if stable.sum() > 1000 else 0.0

    d_hh = fhh - dhh
    d_dr = (fhv - fhh) - (dhv - dhh)
    normal = valid & (dhh < T)
    wet = valid & (fhh < T)

    cand = wet & ~normal & (d_hh <= R.DELTA_DROP_DB)
    low = np.isfinite(hand) & (hand <= HAND_MAX_M)
    removed_high = float((cand & ~low).sum())
    cand &= low

    # Connectivity: river network = dry-season water bodies >= SEED_MIN_KM2
    st8 = np.ones((3, 3), bool)
    area_px = grid.row_pixel_area_km2()[:, None] * np.ones(cand.shape)
    # Narrow rivers (~100 m) break into fragments in radar (bridges, bank trees), so the network
    # also uses JRC long-term water (occurrence >= 50 %) and bridges gaps of up to 2 pixels.
    net = normal | (np.nan_to_num(jrc, nan=0.0) >= 50) if jrc is not None else normal
    net = ndi.binary_closing(net, structure=st8, iterations=2) | net
    labn, nn = ndi.label(net, structure=st8)
    seeds = np.zeros_like(normal)
    if nn:
        szn = ndi.sum(area_px, labn, index=np.arange(1, nn + 1))
        seeds = np.isin(labn, np.where(szn >= seed_min_km2)[0] + 1)
    lab, _ = ndi.label(cand | seeds, structure=st8)
    seed_labels = np.unique(lab[seeds])
    flood = cand & np.isin(lab, seed_labels[seed_labels > 0])
    away = cand & ~flood

    def drop_small(m):
        l, n = ndi.label(m, structure=st8)
        if not n:
            return m
        sizes = ndi.sum(np.ones_like(l), l, index=np.arange(1, n + 1))
        return m & ~np.isin(l, np.where(sizes < MIN_FLOOD_PX)[0] + 1)

    flood, away = drop_small(flood), drop_small(away)
    connected, standalone = flood, away

    px_m = grid.ground_pixel_m()
    near = ndi.distance_transform_edt(~(flood | seeds)) * px_m <= FV_NEAR_M
    fv = valid & ~normal & ~flood & low & near & (d_hh >= R.FV_RISE_DB) & (d_dr <= R.FV_DR_DROP_DB)
    fv = drop_small(fv)

    field = valid & ~flood & ~away & ~fv & ~normal & ((d_hh <= R.DELTA_DROP_DB) | (d_hh >= R.FV_RISE_DB))
    lost = normal & ~wet

    cls = np.zeros(dhh.shape, np.uint8)
    cls[field], cls[away], cls[fv], cls[flood] = 4, 3, 2, 1
    cls[(~valid) | (looks < 3.0)] = 5
    info = {"T": round(T, 2), "otsu_raw": None if t_otsu is None else round(t_otsu, 2),
            "enl": round(enl, 1), "provisional_minus_final_db_on_stable_land": round(offset, 2),
            "normal": normal, "removed_high_hand_px": removed_high, "lost_normal_water": lost,
            "connected_px": float(connected.sum()), "standalone_px": float(standalone.sum())}
    return cls, dhh, dhv, fhh, fhv, d_hh, d_dr, info


def rgba_overlay(cls):
    rgba = np.zeros(cls.shape + (4,), np.uint8)
    for cid, c in CLASSES.items():
        if c["color"][3]:
            rgba[cls == cid] = c["color"]
    return Image.fromarray(rgba)


def river_overlay(normal):
    rgba = np.zeros(normal.shape + (4,), np.uint8)
    rgba[normal] = [20, 60, 170, 165]   # deep blue, semi-transparent
    return Image.fromarray(rgba)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--region", default="majuli", choices=list(PAIRS))
    ap.add_argument("--size", type=int, default=1600)
    a = ap.parse_args()
    region = a.region
    cfg = PAIRS[region]
    meta = R.REGIONS[region]
    bbox = meta["bbox"]
    out_dir = os.path.join(ROOT, "public", "processed", region)
    args = types.SimpleNamespace(download=False, refresh=False)

    g_dry, g_fl = granule(cfg["dry"]), granule(cfg["flood"])
    log(f"[FLOOD] {meta['name']}\n  dry  : {g_dry['granule_id']}\n  flood: {g_fl['granule_id']}")
    c_dry = R.load_crop(region, "dry", g_dry, args)
    c_fl = R.load_crop(region, "flood", g_fl, args)
    grid = R.MercGrid(bbox, long_side=a.size)
    D = R.resample_crop_to_merc(c_dry, grid)
    F = R.resample_crop_to_merc(c_fl, grid)
    valid = D[3] & F[3]
    looks = np.minimum(D[2], F[2])

    anc_cache = os.path.join(R.RAW_DIR, f"ancillary_{region}.npz")
    if os.path.exists(anc_cache):
        z = np.load(anc_cache)
        hand, jrc = z["hand"], z["jrc"]
    else:
        hand, jrc = A.hand_on_grid(grid), A.jrc_occurrence_on_grid(grid)
        np.savez_compressed(anc_cache, hand=hand, jrc=jrc)
    if hand.shape != valid.shape:
        raise RuntimeError("ancillary grid mismatch; delete " + anc_cache)

    for c in CLASSES.values():
        c["name"] = c["name"].replace("{network}", cfg["network"])
    cls, dhh, dhv, fhh, fhv, d_hh, d_dr, info = classify(D, F, valid, looks, hand, grid, cfg["seed_min_km2"], jrc)
    row_area = grid.row_pixel_area_km2()
    area_map = np.repeat(row_area[:, None], cls.shape[1], axis=1)
    stats = {}
    for cid, c in CLASSES.items():
        m = cls == cid
        stats[str(cid)] = {"name": c["name"], "hex": c["hex"], "pixel_count": int(m.sum()),
                           "area_km2": round(float(area_map[m].sum()), 2),
                           "percentage": round(100.0 * m.sum() / cls.size, 2)}
    normal = info["normal"]

    # ---- images
    R.fcc_image(dhh, dhv, valid).save(os.path.join(out_dir, "before_fcc.webp"), "WEBP", quality=92)
    R.fcc_image(fhh, fhv, valid).save(os.path.join(out_dir, "after_fcc.webp"), "WEBP", quality=92)
    rgba_overlay(cls).save(os.path.join(out_dir, "change_overlay.webp"), "WEBP", lossless=True)
    river_overlay(normal).save(os.path.join(out_dir, "river_overlay.webp"), "WEBP", lossless=True)

    # ---- polygons: only the flood classes (1, 2) are drawn
    draw = np.where(np.isin(cls, [1, 2, 3]), cls, 0).astype(np.uint8)
    gj, n_cand = R.vectorize_real_polygons(draw, grid, dhh, fhh, d_hh, d_dr, info["T"], cfg["code"],
                                           min_area_km2=0.02, max_features=800)
    HYP = {1: "Water on the monsoon pass, not on the dry-season pass, low HAND and connected to the "
              "river network: consistent with river floodwater. Not field-verified.",
           2: "HH rose and HV/HH fell next to floodwater on low ground: consistent with water under "
              "vegetation (double bounce). Not field-verified.",
           3: "New water on the monsoon pass that is NOT connected to the river network: more "
              "consistent with rain ponding or flooded paddy than river flooding. Not counted as flood."}
    for ft in gj["features"]:
        p = ft["properties"]
        cid = int(p.get("class_id", 0))
        p["class_name"] = CLASSES[cid]["name"]
        p["driver_hypothesis"] = HYP.get(cid, p.get("driver_hypothesis"))
    with open(os.path.join(out_dir, "evidence_polygons.geojson"), "w") as f:
        json.dump(gj, f)

    # ---- discharge context
    ctx = cfg["context"]
    q = context_series(ctx, "2026-05-01", "2026-11-15")
    d_date, f_date = g_dry["start"], g_fl["start"]
    is_q = ctx["kind"] == "discharge"
    ts = {"kind": ctx["kind"],
          "source": ("GloFAS v4 river discharge via Open-Meteo Flood API (model, not a gauge)" if is_q
                     else "ERA5 reanalysis daily precipitation via Open-Meteo archive (model, not a rain gauge)"),
          "location": ctx, "unit": "m3/s" if is_q else "mm/day",
          "daily": [{"date": k, "discharge": v} for k, v in q.items()],
          "nisar_passes": [{"date": p, "discharge": q.get(p)} for p in cfg["passes"]],
          "dry_date": d_date[:10], "flood_date": f_date[:10]}
    qd, qf = q.get(d_date[:10]), q.get(f_date[:10])
    if not is_q:  # rainfall: report the total that fell between the two passes instead
        rain_between = round(sum(v or 0 for k, v in q.items() if d_date[:10] < k <= f_date[:10]), 1)
        ts["rain_between_passes_mm"] = rain_between
    with open(os.path.join(out_dir, "flood_timeseries.json"), "w") as f:
        json.dump(ts, f)

    # ---- validation against independent layers
    fl = cls == 1
    fl_area = float(area_map[fl].sum())
    jrc_f = jrc[fl & np.isfinite(jrc)]
    val = {
        "flood_area_km2": round(fl_area, 2),
        "flood_share_ever_water_in_JRC_1984_2021_pct": round(100.0 * float((jrc_f > 0).mean()), 1) if jrc_f.size else None,
        "flood_share_jrc_occurrence_ge_10pct_pct": round(100.0 * float((jrc_f >= 10).mean()), 1) if jrc_f.size else None,
        "landscape_share_jrc_occurrence_ge_10pct_pct": round(100.0 * float((jrc[valid & ~normal] >= 10).mean()), 1),
        "flood_hand_median_m": round(float(np.nanmedian(hand[fl])), 2) if fl.any() else None,
        "landscape_hand_median_m": round(float(np.nanmedian(hand[valid])), 2),
        "away_from_river_area_km2": round(float(area_map[cls == 3].sum()), 2),
        "away_from_river_share_ever_water_in_JRC_pct": round(100.0 * float((jrc[(cls == 3) & np.isfinite(jrc)] > 0).mean()), 1) if (cls == 3).any() else None,
        "normal_water_not_seen_on_flood_date_km2": round(float(area_map[info["lost_normal_water"]].sum()), 2),
        "candidates_removed_by_hand_px": int(info["removed_high_hand_px"]),
        "provisional_minus_final_db_on_stable_land": info["provisional_minus_final_db_on_stable_land"],
    }

    bi = c_dry.get("ident", {}) or {}
    enl = info["enl"]
    summary = {
        "region_id": region, "region_name": meta["name"], "data_mode": "real_nisar_gcov",
        "processed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "bbox": bbox, "center": meta["center"], "zoom": meta["zoom"],
        "orbit_track": int(bi.get("trackNumber", g_dry["track"])),
        "orbit_direction": str(bi.get("orbitPassDirection", "Ascending")).title(),
        "frame_number": int(bi.get("frameNumber", g_dry["frame"])),
        "geometry_lock": True,
        "radar_band": "L-band (1.25 GHz / 24 cm λ)", "polarization": "Dual-Pol (HH + HV)",
        "incidence_angles": c_dry.get("incidence") or c_fl.get("incidence"),
        "before_granule": g_dry["granule_id"], "after_granule": g_fl["granule_id"],
        "before_date": d_date, "after_date": f_date,
        "flood_event": ((f"{cfg['mode_label']}: {R.fmt_date(f_date)} {f_date[:4]} "
                         f"(river flow ~{qf:,.0f} m³/s) compared with {R.fmt_date(d_date)} {d_date[:4]} "
                         f"(~{qd:,.0f} m³/s)") if is_q and qd and qf else
                        (f"{cfg['mode_label']}: {R.fmt_date(f_date)} {f_date[:4]} compared with "
                         f"{R.fmt_date(d_date)} {d_date[:4]}; ~{ts.get('rain_between_passes_mm', 0):.0f} mm "
                         f"of rain fell in between") if not is_q else cfg["mode_label"]),
        "comparison_mode": "dry_reference_vs_monsoon",
        "before_label": cfg["labels"][0], "after_label": cfg["labels"][1],
        "total_swath_area_km2": round(float(area_map[valid].sum()), 2),
        "classes": stats,
        "permanent_water_km2": round(float(area_map[normal].sum()), 2),
        "river_discharge_m3s": {"dry_date": qd, "flood_date": qf} if is_q else None,
        "rain_between_passes_mm": None if is_q else ts.get("rain_between_passes_mm"),
        "flood_validation": val,
        "validation_stats": {"lee_filter_window": "5x5", "equivalent_number_of_looks": enl,
                             "speckle_suppression_index": None, "coregistration_rmse_m": None,
                             "radiometric_resolution_db": None},
        "provenance": {
            "source": f"NASA/ASF NISAR L2 GCOV: dry = {g_dry['collection']}, flood = {g_fl['collection']}",
            "before_url": g_dry["https_url"], "after_url": g_fl["https_url"],
            "pipeline": "processing/flood_pair.py",
            "grid_crs": "EPSG:3857 (uniform in Web Mercator; outer pixel edges = bbox corners)",
            "ground_pixel_m_approx": round(grid.ground_pixel_m(), 1),
            "water_threshold_db": info["T"], "water_threshold_otsu_raw_db": info["otsu_raw"],
            "hand_source": "ASF GLO-30 HAND (from Copernicus GLO-30 DEM)",
            "permanent_water_reference": "JRC Global Surface Water occurrence v1.4 (1984-2021), validation only",
            "context_series_source": ts["source"],
            "rules": {"hand_max_m": HAND_MAX_M,
                      "flooded_vegetation_max_distance_m": FV_NEAR_M, "min_flood_clump_px": MIN_FLOOD_PX,
                      "network_seed_min_km2": cfg["seed_min_km2"],
                      "drop_db": R.DELTA_DROP_DB},
            "notes": [
                "'Before' is the dry-season reference and 'after' is the monsoon pass, so the "
                "animation reads 'normal river -> monsoon flood', not calendar order.",
                "The flood date comes from the provisional NISAR release and the dry date from "
                "the final V1 release; their stable-land offset is reported in flood_validation.",
                "Class 3 (water away from the river) is drawn faintly and not counted as river flood; "
                "class 4 (field-scale change) is computed but not drawn.",
                "Nothing is field-verified; discharge/rainfall are model values, not gauge readings.",
            ],
        },
    }
    with open(os.path.join(out_dir, "summary_metrics.json"), "w") as f:
        json.dump(summary, f, indent=2)

    log(f"  T={info['T']} dB (Otsu {info['otsu_raw']}), ENL={enl}, "
        f"provisional-final offset on stable land = {info['provisional_minus_final_db_on_stable_land']} dB")
    for k, v in stats.items():
        log(f"  class {k} {v['name']:45s} {v['area_km2']:8.2f} km2")
    log(f"  normal water (dry date): {summary['permanent_water_km2']} km2")
    log(f"  context ({ctx['kind']}): dry {qd} / flood {qf}; rain between = {ts.get('rain_between_passes_mm')}")
    log("  validation: " + json.dumps(val))
    log(f"  polygons: {len(gj['features'])}")


if __name__ == "__main__":
    main()
