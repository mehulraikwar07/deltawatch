import type { RegionId } from './sar';

export interface SearchPlace {
  id: string;
  name: string;
  regionId: RegionId;
  type: 'town' | 'wetland' | 'river' | 'district' | 'landmark' | 'port';
  coordinates: [number, number]; // [lng, lat]
  description: string;
  /** Not populated: per-place flood status / weather were never measured. */
  floodStatus?: 'Severe Flood' | 'Flooded Canopy' | 'Managed Inundation' | 'Normal / Safe' | 'Receding';
  tempC?: number | null;
  aqi?: number | null;
}

export interface UserProfile {
  name: string;
  email: string;
  avatarUrl?: string;
  organization: string;
  role: string;
  isSignedIn: boolean;
  isGuest: boolean;
}

/** Current-conditions card. Every field is null until a real feed is connected. */
export interface ClimateData {
  tempC: number | null;
  feelsLikeC: number | null;
  condition: string | null;
  aqi: number | null;
  aqiStatus: string | null;
  humidity: number | null;
  precipitationMm: number | null;
  windKmh: number | null;
  floodRisk: 'High' | 'Severe' | 'Moderate' | 'Low' | null;
  lastUpdated: string;
}
