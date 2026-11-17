// Place names, coordinates and short descriptions are general geography.
// No per-place flood status, temperature or AQI is included: none was measured.
import type { SearchPlace, ClimateData } from '@/types/google-maps';

export const SEARCH_PLACES: SearchPlace[] = [
  // Nagapattinam / Cauvery Delta
  {
    id: 'nag-01',
    name: 'Nagapattinam Port & Town',
    regionId: 'nagapattinam',
    type: 'port',
    coordinates: [79.8427, 10.7656],
    description: 'Coastal district headquarters and ancient port at the mouth of Kaduvaiyar River.',
  },
  {
    id: 'nag-02',
    name: 'Muthupet Mangrove Lagoon',
    regionId: 'nagapattinam',
    type: 'wetland',
    coordinates: [79.5120, 10.3340],
    description: 'Large Avicennia-dominated mangrove wetland on the Palk Strait coast.',
  },
  {
    id: 'nag-03',
    name: 'Vedaranyam Salt Swamp & Estuary',
    regionId: 'nagapattinam',
    type: 'wetland',
    coordinates: [79.8510, 10.3725],
    description: 'Extensive low-gradient salt marshes and shallow tidal estuaries.',
  },
  {
    id: 'nag-04',
    name: 'Thiruvarur Samba Paddy Basin',
    regionId: 'nagapattinam',
    type: 'district',
    coordinates: [79.6360, 10.7725],
    description: 'Heart of the Cauvery delta agricultural plains with bunded paddy submergence.',
  },
  {
    id: 'nag-05',
    name: 'Velankanni Coastal Strip',
    regionId: 'nagapattinam',
    type: 'town',
    coordinates: [79.8500, 10.6800],
    description: 'Pilgrimage shoreline center located south of Nagapattinam along Bay of Bengal coast.',
  },
  {
    id: 'nag-06',
    name: 'Sirkazhi Coleroon Distributary',
    regionId: 'nagapattinam',
    type: 'river',
    coordinates: [79.7333, 11.2333],
    description: 'Northern Cauvery delta distributary (Kollidam / Coleroon) near Sirkazhi.',
  },
  {
    id: 'nag-07',
    name: 'Point Calimere (Kodiakkarai) Sanctuary',
    regionId: 'nagapattinam',
    type: 'landmark',
    coordinates: [79.8660, 10.2974],
    description: 'Ramsar wetland sanctuary on the southern apex of Cauvery delta promontory.',
  },
  {
    id: 'nag-08',
    name: 'Karaikal Estuarine Channel',
    regionId: 'nagapattinam',
    type: 'port',
    coordinates: [79.8380, 10.9254],
    description: 'Riverine port zone intersecting Arasalar river mouth and coastal shipping canal.',
  },
  {
    id: 'nag-09',
    name: 'Mayiladuthurai Agricultural Hub',
    regionId: 'nagapattinam',
    type: 'town',
    coordinates: [79.6524, 11.1075],
    description: 'Upstream delta irrigation distribution nexus with sluice gates on Cauvery main stem.',
  },

  // Majuli / Brahmaputra Basin
  {
    id: 'maj-01',
    name: 'Majuli Island (Garamur Center)',
    regionId: 'majuli',
    type: 'district',
    coordinates: [94.2100, 26.9600],
    description: 'World’s largest inhabited river island, administrative and cultural capital.',
  },
  {
    id: 'maj-02',
    name: 'Kamalabari Ferry Ghat',
    regionId: 'majuli',
    type: 'port',
    coordinates: [94.1780, 26.9020],
    description: 'Southern river port and crucial river crossing connecting Majuli to Jorhat mainland.',
  },
  {
    id: 'maj-03',
    name: 'Salmora Traditional Pottery Village',
    regionId: 'majuli',
    type: 'town',
    coordinates: [94.3400, 26.8850],
    description: 'Southeastern shoreline settlement famous for beat-pottery, vulnerable to active riverbank erosion.',
  },
  {
    id: 'maj-04',
    name: 'Jorhat Brahmaputra South Bank Hub',
    regionId: 'majuli',
    type: 'district',
    coordinates: [94.2037, 26.7509],
    description: 'Major regional logistics base and staging ground for Assam flood relief operations.',
  },
  {
    id: 'maj-05',
    name: 'Kherkatia Suti River Channel',
    regionId: 'majuli',
    type: 'river',
    coordinates: [94.2800, 26.9950],
    description: 'Sub-Brahmaputra overflow channel separating upper island char lands.',
  },
  {
    id: 'maj-06',
    name: 'Auniati Satra Historic Monastic Site',
    regionId: 'majuli',
    type: 'landmark',
    coordinates: [94.1500, 26.9400],
    description: 'Historic 17th-century Vaishnavite cultural center with raised flood-refuge embankments.',
  },
  {
    id: 'maj-07',
    name: 'Brahmaputra Floodplain Char Lands',
    regionId: 'majuli',
    type: 'wetland',
    coordinates: [94.1000, 26.9200],
    description: 'Ephemeral shifting sandbars (chars) along the Brahmaputra channel.',
  },
];

/**
 * Current weather / air-quality / flood-risk values. These used to be
 * hard-coded numbers labelled "LIVE"; no live feed is connected, so they are
 * null and the UI shows "—". Historical rainfall comes from NASA POWER in
 * ClimateTab instead.
 */
const NO_LIVE_FEED: ClimateData = {
  tempC: null,
  feelsLikeC: null,
  condition: null,
  aqi: null,
  aqiStatus: null,
  humidity: null,
  precipitationMm: null,
  windKmh: null,
  floodRisk: null,
  lastUpdated: 'No live weather / AQI feed connected',
};

export const REGION_CLIMATE: Record<string, ClimateData> = {
  nagapattinam: NO_LIVE_FEED,
  majuli: NO_LIVE_FEED,
};
