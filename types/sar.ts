export type RegionId = 'nagapattinam' | 'majuli';

export interface SceneGranule {
  granule_id: string;
  date: string;
  nominal_looks?: number | null;
  s3_url?: string;
}

export interface ScenePair {
  id: string;
  label: string;
  orbit_track: number | null;
  orbit_direction: string | null;
  frame_number: number | null;
  geometry_lock?: boolean | null;
  radar_band?: string | null;
  polarization?: string | null;
  incidence_angle_range?: [number, number] | null;
  before: SceneGranule;
  after: SceneGranule;
  flood_event: string;
  active: boolean;
}

export interface RegionSceneEntry {
  region_id: RegionId;
  region_name: string;
  bbox: [number, number, number, number];
  center: [number, number];
  zoom: number;
  pairs: ScenePair[];
}

export interface AvailableScenesCatalog {
  generated_at: string;
  description: string;
  regions: Record<string, RegionSceneEntry>;
}

export interface ClassSummaryStat {
  name: string;
  hex: string;
  pixel_count: number | null;
  area_km2: number | null;
  percentage: number | null;
}

/** Any stat the pipeline did not actually compute is null. */
export interface ValidationStats {
  lee_filter_window?: string | null;
  equivalent_number_of_looks?: number | null;
  speckle_suppression_index?: number | null;
  coregistration_rmse_m?: number | null;
  radiometric_resolution_db?: number | null;
}

/**
 * Free-form provenance block written by the processing pipeline
 * (source granules, download URLs, software versions, ...). Shape is not
 * fixed, so the UI renders it generically.
 */
export type Provenance = Record<string, unknown>;

export interface SummaryMetrics {
  region_id: RegionId;
  region_name: string;
  /** 'real_nisar_gcov' for real data; anything else is synthetic / demo. */
  data_mode: 'real_nisar_gcov' | 'live_nisar_gcov' | 'calibrated_baseline' | (string & {});
  processed_at: string;
  bbox: [number, number, number, number];
  center: [number, number];
  zoom: number;
  orbit_track: number | null;
  orbit_direction: string | null;
  frame_number: number | null;
  geometry_lock?: boolean | null;
  radar_band?: string | null;
  polarization?: string | null;
  incidence_angles?: [number, number] | null;
  before_granule: string | null;
  after_granule: string | null;
  before_date: string | null;
  after_date: string | null;
  /** Neutral description, e.g. "Observed change, 26 Oct → 7 Nov 2026". */
  flood_event: string | null;
  total_swath_area_km2: number | null;
  /** Optional: area of water present in both scenes (excluded from change). */
  permanent_water_km2?: number | null;
  classes: Partial<Record<string, ClassSummaryStat>>;
  validation_stats?: ValidationStats | null;
  provenance?: Provenance | null;
  /** 'dry_reference_vs_monsoon' when before = dry-season reference and after = monsoon pass. */
  comparison_mode?: string | null;
  /** Short captions for the two frames, e.g. 'Dry season' / 'Monsoon'. */
  before_label?: string | null;
  after_label?: string | null;
  /** Model river discharge (GloFAS) on the two pass dates, m3/s. */
  river_discharge_m3s?: { dry_date: number | null; flood_date: number | null } | null;
  /** Independent checks of the flood class (JRC history, HAND, release offset). */
  flood_validation?: Record<string, number | null> | null;
}

export interface EvidencePolygonProperties {
  id: string;
  class_id: number;
  class_name: string;
  area_km2: number | null;
  area_hectares: number | null;
  before_hh_db: number | null;
  after_hh_db: number | null;
  delta_hh_db: number | null;
  /**
   * Robustness score 0..1: share of the polygon's pixels that pass the class
   * test by at least 1 dB. Not a probability.
   */
  confidence: number | null;
  centroid: [number, number] | null;
  driver_hypothesis: string | null;
  radar_band: string | null;
  geometry_lock: boolean | null;
}

export interface EvidencePolygonFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: EvidencePolygonProperties;
}

export interface EvidenceGeoJson {
  type: 'FeatureCollection';
  features: EvidencePolygonFeature[];
}

