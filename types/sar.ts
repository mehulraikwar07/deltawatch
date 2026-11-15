export type RegionId = 'nagapattinam' | 'majuli';

export interface SceneGranule {
  granule_id: string;
  date: string;
  nominal_looks: number;
  s3_url?: string;
}

export interface ScenePair {
  id: string;
  label: string;
  orbit_track: number;
  orbit_direction: string;
  frame_number: number;
  geometry_lock: boolean;
  radar_band: string;
  polarization: string;
  incidence_angle_range: [number, number];
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
  pixel_count: number;
  area_km2: number;
  percentage: number;
}

export interface ValidationStats {
  lee_filter_window: string;
  equivalent_number_of_looks: number;
  speckle_suppression_index: number;
  coregistration_rmse_m: number;
  radiometric_resolution_db: number;
}

export interface SummaryMetrics {
  region_id: RegionId;
  region_name: string;
  data_mode: 'live_nisar_gcov' | 'calibrated_baseline';
  processed_at: string;
  bbox: [number, number, number, number];
  center: [number, number];
  zoom: number;
  orbit_track: number;
  orbit_direction: string;
  frame_number: number;
  geometry_lock: boolean;
  radar_band: string;
  polarization: string;
  incidence_angles: [number, number];
  before_granule: string;
  after_granule: string;
  before_date: string;
  after_date: string;
  flood_event: string;
  total_swath_area_km2: number;
  classes: Record<string, ClassSummaryStat>;
  validation_stats: ValidationStats;
}

export interface EvidencePolygonProperties {
  id: string;
  class_id: number;
  class_name: string;
  area_km2: number;
  area_hectares: number;
  before_hh_db: number;
  after_hh_db: number;
  delta_hh_db: number;
  confidence: number;
  centroid: [number, number];
  driver_hypothesis: string;
  radar_band: string;
  geometry_lock: boolean;
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

