import type { RegionId } from './sar';

export interface SearchPlace {
  id: string;
  name: string;
  regionId: RegionId;
  type: 'town' | 'wetland' | 'river' | 'district' | 'landmark' | 'port';
  coordinates: [number, number]; // [lng, lat]
  description: string;
  floodStatus: 'Severe Flood' | 'Flooded Canopy' | 'Managed Inundation' | 'Normal / Safe' | 'Receding';
  tempC: number;
  aqi: number;
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

export interface ClimateData {
  tempC: number;
  feelsLikeC: number;
  condition: string;
  aqi: number;
  aqiStatus: string;
  humidity: number;
  precipitationMm: number;
  windKmh: number;
  floodRisk: 'High' | 'Severe' | 'Moderate' | 'Low';
  lastUpdated: string;
}
