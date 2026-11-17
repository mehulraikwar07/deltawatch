/**
 * NOT USED by the app any more (2026-11 cleanup).
 *
 * This block was shown in the UI as "ground-truth calibration" for the flood
 * classes, but no LULC or DEM data is loaded or used anywhere in processing,
 * and the accuracy figures below were never verified against the NRSC source.
 * Do not re-display these values as measurements of this app's output.
 */
/**
 * Metadata of LULC & DEM Map of India 2024-25
 * Source: National Remote Sensing Centre (NRSC), ISRO
 * Bhuvan Thematic Services (IRS P6 AWiFS Sensor)
 */

export interface DemLulcMetadata {
  datasetName: string;
  theme: string;
  keywords: string[];
  agency: {
    organisation: string;
    division: string;
    address: string;
    city: string;
    country: string;
    contactPerson: string;
    contactEmail: string;
    telephone: string;
  };
  spatialReference: {
    datum: string;
    spheroid: string;
    coverage: {
      upperLeft: string;
      upperRight: string;
      lowerRight: string;
      lowerLeft: string;
    };
    scale: string;
    edition: string;
    lineage: string;
  };
  accuracy: {
    overallClassificationAccuracy: string;
    accuracyRange: string;
    plainTerrainAccuracy: string;
    hillyTerrainAccuracy: string;
    plainMethod: string;
    hillyMethod: string;
    samplingMethod: string;
  };
  classification: {
    approach: string;
    regionalFocus: string;
    sensor: string;
    classes: string[];
  };
}

export const ISRO_DEM_LULC_METADATA_2024_25: DemLulcMetadata = {
  datasetName: 'LULC Map of India 2024-25',
  theme: 'Land Use Land Cover & Micro-Topography',
  keywords: [
    'LULC',
    'AWiFS',
    '1:250000',
    'Land Use',
    'Land Cover',
    '2024-25',
    'NRSC',
    'ISRO',
    'Thematic Services',
    'Bhuvan',
    'DEM',
    'Terrain',
  ],
  agency: {
    organisation: 'National Remote Sensing Centre (NRSC), ISRO',
    division: 'Land Use & Cover Mapping Monitoring Division, SR&LUM Group, RSAA',
    address: 'Balanagar, Hyderabad - 500037',
    city: 'Hyderabad',
    country: 'India',
    contactPerson: 'DD(RSAA)',
    contactEmail: 'ddapp@nrsc.gov.in',
    telephone: '040-23884211',
  },
  spatialReference: {
    datum: 'GCS, WGS-1984',
    spheroid: 'WGS-1984',
    coverage: {
      upperLeft: 'X = 68° E, Y = 38° N',
      upperRight: 'X = 98° E, Y = 38° N',
      lowerRight: 'X = 98° E, Y = 6° N',
      lowerLeft: 'X = 68° E, Y = 6° N',
    },
    scale: '1:250,000',
    edition: 'First (2024-25)',
    lineage: 'All toposheets of India on 1:250,000 scale',
  },
  accuracy: {
    overallClassificationAccuracy: '90.07%',
    accuracyRange: '86% to 95% across Indian states',
    plainTerrainAccuracy: '1 pixel (Second-order polynomial method)',
    hillyTerrainAccuracy: '2-3 pixels (TIN-based model against AOI)',
    plainMethod: 'Second order polynomial method',
    hillyMethod: 'TIN (Triangulated Irregular Network) based model',
    samplingMethod: 'Stratified random points (min 20 points per class) with Kappa co-efficients',
  },
  classification: {
    approach: 'Hybrid Classifier (Decision Tree - See5 & Supervised MXL)',
    regionalFocus:
      'In Tamil Nadu (Cauvery Delta) and North Eastern states (Assam/Majuli), temporal registration was accounted for by individual monthly crop extractions combined with regional LULC.',
    sensor: 'IRS P6 AWiFS sensor (Multi-temporal satellite data for crop year 2024-25)',
    classes: [
      'Built-up land',
      'Kharif crop land',
      'Rabi crop land',
      'Zaid crop land',
      'Double/Triple/Annual crop land',
      'Current Fallow land',
      'Plantation/Orchard',
      'Evergreen/Semi-evergreen woodland',
      'Deciduous woodland',
      'Degraded woodland',
      'Littoral/Swamp/Mangroves',
      'Grassland',
      'Shifting cultivation',
      'Waste lands',
      'Rann',
      'Water Bodies - maximum spread',
      'Water Bodies - minimum spread',
      'Snow covered/Glacial areas',
    ],
  },
};
