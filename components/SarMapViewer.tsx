'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Map, Marker, setWorkerUrl, type StyleSpecification } from 'maplibre-gl';
import { Sliders, Crosshair } from 'lucide-react';
import type { RegionId, SummaryMetrics, EvidencePolygonProperties } from '@/types/sar';
import type { CompareMode } from './MissionHeader';
import type { BasemapType } from './GoogleMapsLayersModal';
import type { SearchPlace } from '@/types/google-maps';

// Set MapLibre CSP Web Worker URL to prevent worker issues
if (typeof window !== 'undefined') {
  try {
    setWorkerUrl('/maplibre-gl-csp-worker.js');
    (Map as unknown as { workerUrl?: string }).workerUrl = '/maplibre-gl-csp-worker.js';
  } catch (e) {
    console.warn('[MapLibre worker setup]', e);
  }
}

interface SarMapViewerProps {
  regionId: RegionId;
  metrics: SummaryMetrics;
  onSelectPolygon: (poly: EvidencePolygonProperties) => void;
  selectedPolygon: EvidencePolygonProperties | null;
  focusCoords?: [number, number] | null;
  compareMode: CompareMode;
  onSelectCompareMode: (mode: CompareMode) => void;
  basemapMode?: BasemapType;
  showChangeOverlay?: boolean;
  changeOpacity?: number;
  showPrecipitation?: boolean;
  showEvacuationRoutes?: boolean;
  showMangroveFilter?: boolean;
  sarIntensityMode?: boolean;
  is3D?: boolean;
  activeClassFilter?: number | null;
  activePlace?: SearchPlace | null;
  zoomInTrigger?: number;
  zoomOutTrigger?: number;
  recenterTrigger?: number;
  resetNorthTrigger?: number;
  onMapClick?: () => void;
}

export function SarMapViewer({
  regionId,
  metrics,
  onSelectPolygon,
  selectedPolygon,
  focusCoords,
  compareMode,
  onSelectCompareMode,
  basemapMode = 'satellite',
  showChangeOverlay = true,
  changeOpacity = 0.88,
  showPrecipitation = false,
  showEvacuationRoutes = false,
  showMangroveFilter = false,
  sarIntensityMode = false,
  is3D = false,
  activeClassFilter = null,
  activePlace = null,
  zoomInTrigger = 0,
  zoomOutTrigger = 0,
  recenterTrigger = 0,
  resetNorthTrigger = 0,
  onMapClick,
}: SarMapViewerProps) {
  const mapContainerBeforeRef = useRef<HTMLDivElement>(null);
  const mapContainerAfterRef = useRef<HTMLDivElement>(null);
  const mapBeforeRef = useRef<Map | null>(null);
  const mapAfterRef = useRef<Map | null>(null);
  const placeMarkerRef = useRef<Marker | null>(null);

  // Slider position (0% = After only, 50% = Split, 100% = Before only)
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const sliderContainerRef = useRef<HTMLDivElement>(null);

  // Live cursor telemetry readout
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Hovered polygon tooltip
  const [hoveredPoly, setHoveredPoly] = useState<{
    x: number;
    y: number;
    id: string;
    className: string;
    area: number;
    delta: number;
  } | null>(null);

  const bbox = metrics.bbox; // [west, south, east, north]
  const imageCoordinates: [[number, number], [number, number], [number, number], [number, number]] = [
    [bbox[0], bbox[3]], // Top-Left: west, north
    [bbox[2], bbox[3]], // Top-Right: east, north
    [bbox[2], bbox[1]], // Bottom-Right: east, south
    [bbox[0], bbox[1]], // Bottom-Left: west, south
  ];

  // Sync compareMode from parent to sliderPos
  useEffect(() => {
    if (compareMode === 'before') {
      setSliderPos(100);
    } else if (compareMode === 'split') {
      setSliderPos(50);
    } else if (compareMode === 'after') {
      setSliderPos(0);
    }
  }, [compareMode]);

  // Smooth 3D Pitch and Bearing Animation (Pitch: 58°, Bearing: 20°, Duration: 1800ms)
  useEffect(() => {
    const pitch = is3D ? 58 : 0;
    const bearing = is3D ? 20 : 0;
    const duration = is3D ? 1800 : 1200;

    const applyTerrain = (map: Map | null) => {
      if (!map || !map.isStyleLoaded()) return;
      try {
        if (!map.getSource('aws-dem')) {
          map.addSource('aws-dem', {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            minzoom: 0,
            maxzoom: 15,
          });
        }
        if (is3D) {
          map.setTerrain({ source: 'aws-dem', exaggeration: 1.35 });
        } else {
          map.setTerrain(null);
        }
      } catch (err) {
        console.warn('[MapLibre DEM Update]', err);
      }
    };

    applyTerrain(mapAfterRef.current);
    applyTerrain(mapBeforeRef.current);

    if (mapAfterRef.current) {
      mapAfterRef.current.easeTo({ pitch, bearing, duration });
    }
    if (mapBeforeRef.current) {
      mapBeforeRef.current.easeTo({ pitch, bearing, duration });
    }
  }, [is3D]);

  // Handle zoom in trigger
  useEffect(() => {
    if (!zoomInTrigger || !mapAfterRef.current) return;
    mapAfterRef.current.zoomIn();
  }, [zoomInTrigger]);

  // Handle zoom out trigger
  useEffect(() => {
    if (!zoomOutTrigger || !mapAfterRef.current) return;
    mapAfterRef.current.zoomOut();
  }, [zoomOutTrigger]);

  // Handle recenter trigger
  useEffect(() => {
    if (!recenterTrigger || !mapAfterRef.current) return;
    mapAfterRef.current.flyTo({
      center: metrics.center,
      zoom: metrics.zoom,
      essential: true,
      speed: 1.4,
      curve: 1.2,
    });
  }, [recenterTrigger, metrics]);

  // Handle reset North trigger
  useEffect(() => {
    if (!resetNorthTrigger || !mapAfterRef.current) return;
    mapAfterRef.current.resetNorth();
  }, [resetNorthTrigger]);

  // Focus on selected polygon / coords
  useEffect(() => {
    if (!focusCoords || !mapAfterRef.current) return;
    mapAfterRef.current.flyTo({
      center: focusCoords,
      zoom: 12.8,
      essential: true,
      speed: 1.3,
      curve: 1.2,
    });
  }, [focusCoords]);

  // Handle active search place flyTo and Marker
  useEffect(() => {
    if (!mapAfterRef.current) return;
    const map = mapAfterRef.current;

    if (placeMarkerRef.current) {
      placeMarkerRef.current.remove();
      placeMarkerRef.current = null;
    }

    if (activePlace) {
      map.flyTo({
        center: activePlace.coordinates,
        zoom: 12.5,
        essential: true,
        speed: 1.4,
        curve: 1.2,
      });

      // Google Maps style pin
      const el = document.createElement('div');
      el.className = 'google-pin-marker';
      el.innerHTML = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: translate(-50%, -100%);">
          <div style="background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(8px); border: 1px solid rgba(0, 229, 255, 0.5); padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; color: #fff; white-space: nowrap; margin-bottom: 2px; box-shadow: 0 4px 14px rgba(0,0,0,0.7);">
            ${activePlace.name}
          </div>
          <svg width="30" height="40" viewBox="0 0 24 32" fill="none" style="filter: drop-shadow(0 4px 10px rgba(0,0,0,0.6));">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z" fill="#EA4335"/>
            <circle cx="12" cy="11" r="5" fill="#FFFFFF"/>
            <circle cx="12" cy="11" r="3" fill="#00E5FF"/>
          </svg>
        </div>
      `;

      placeMarkerRef.current = new Marker({ element: el, anchor: 'bottom' })
        .setLngLat(activePlace.coordinates)
        .addTo(map);
    }
  }, [activePlace]);

  // Multi-layer Basemap Style: Esri Satellite, Dark Gray, Terrain & NASA GIBS
  const basemapStyle: StyleSpecification = {
    version: 8,
    sources: {
      'esri-imagery': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 17, // Smooth overscaling at z>17, prevents crash
        attribution: '&copy; Esri, Maxar',
      },
      'esri-dark-gray': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 17,
      },
      'esri-boundaries': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 17,
      },
      'esri-dark-ref': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 17,
      },
      'esri-terrain': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 17,
      },
      'nasa-gibs-precip': {
        type: 'raster',
        tiles: [
          'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default/2026-06-20/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png',
        ],
        tileSize: 256,
        maxzoom: 6,
        attribution: '&copy; NASA GIBS / GPM IMERG',
      },
    },
    layers: [
      {
        id: 'esri-imagery-layer',
        type: 'raster',
        source: 'esri-imagery',
        minzoom: 0,
        maxzoom: 20,
        paint: {
          'raster-opacity': 0.95,
          'raster-contrast': 0.1,
          'raster-brightness-max': 0.92,
        },
      },
      {
        id: 'esri-dark-layer',
        type: 'raster',
        source: 'esri-dark-gray',
        minzoom: 0,
        maxzoom: 20,
        layout: { visibility: 'none' },
      },
      {
        id: 'esri-terrain-layer',
        type: 'raster',
        source: 'esri-terrain',
        minzoom: 0,
        maxzoom: 20,
        layout: { visibility: 'none' },
      },
      {
        id: 'nasa-gibs-precip-layer',
        type: 'raster',
        source: 'nasa-gibs-precip',
        minzoom: 0,
        maxzoom: 20,
        paint: {
          'raster-opacity': 0.65,
        },
        layout: { visibility: 'none' },
      },
      {
        id: 'esri-boundaries-layer',
        type: 'raster',
        source: 'esri-boundaries',
        minzoom: 0,
        maxzoom: 20,
        paint: { 'raster-opacity': 0.75 },
      },
      {
        id: 'esri-dark-ref-layer',
        type: 'raster',
        source: 'esri-dark-ref',
        minzoom: 0,
        maxzoom: 20,
        layout: { visibility: 'none' },
      },
    ],
  };

  // Helper to add AWS Terrarium DEM with Natural Smooth Elevation (exaggeration: 1.35)
  const setupDemTerrain = (map: Map, enable: boolean) => {
    try {
      if (!map.getSource('aws-dem')) {
        map.addSource('aws-dem', {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          encoding: 'terrarium',
          tileSize: 256,
          minzoom: 0,
          maxzoom: 15,
        });
      }
      if (enable) {
        map.setTerrain({ source: 'aws-dem', exaggeration: 1.35 });
      } else {
        map.setTerrain(null);
      }
    } catch (err) {
      console.warn('[MapLibre AWS DEM Setup]', err);
    }
  };

  // Initialize both maps (Map 1: After / Base, Map 2: Before / Clipped)
  useEffect(() => {
    if (!mapContainerAfterRef.current || !mapContainerBeforeRef.current) return;

    if (mapAfterRef.current) mapAfterRef.current.remove();
    if (mapBeforeRef.current) mapBeforeRef.current.remove();

    // Map 1: After Map (Primary Interactive Map)
    const mapAfter = new Map({
      container: mapContainerAfterRef.current,
      style: basemapStyle,
      center: metrics.center,
      zoom: metrics.zoom,
      maxZoom: 18,
      minZoom: 6,
      attributionControl: false,
    });

    // Map 2: Before Map (Mirrored Secondary Map, Synchronized with mapAfter)
    const mapBefore = new Map({
      container: mapContainerBeforeRef.current,
      style: basemapStyle,
      center: metrics.center,
      zoom: metrics.zoom,
      maxZoom: 18,
      minZoom: 6,
      attributionControl: false,
      interactive: false,
    });

    mapAfter.on('error', (e) => console.warn('[MapLibre After Error]', e));
    mapBefore.on('error', (e) => console.warn('[MapLibre Before Error]', e));

    // Perfect camera synchronization
    mapAfter.on('move', () => {
      mapBefore.jumpTo({
        center: mapAfter.getCenter(),
        zoom: mapAfter.getZoom(),
        bearing: mapAfter.getBearing(),
        pitch: mapAfter.getPitch(),
      });
    });

    // Click on empty map area
    mapAfter.on('click', (e) => {
      const features = mapAfter.queryRenderedFeatures(e.point, {
        layers: ['evidence-polygons-hitbox'],
      });
      if (!features || features.length === 0) {
        if (onMapClick) onMapClick();
      }
    });

    // Live mouse coordinate tracker
    mapAfter.on('mousemove', (e) => {
      setCursorCoords({
        lat: Number(e.lngLat.lat.toFixed(4)),
        lng: Number(e.lngLat.lng.toFixed(4)),
      });
    });

    const cacheBuster = Date.now();

    // ==========================================
    // MAP 1 (AFTER): AFTER FCC + 6-CLASS FLOOD MASK + POLYGONS + EVACUATION + DEM
    // ==========================================
    mapAfter.on('load', () => {
      // 0. Enable Smooth 3D Micro-Topography when 3D is active
      setupDemTerrain(mapAfter, is3D);

      // 1. After SAR FCC image layer (linear resampling for crisp, unpixelated 20m pixels)
      mapAfter.addSource('after-fcc-source', {
        type: 'image',
        url: `/processed/${regionId}/after_fcc.webp?v=${cacheBuster}`,
        coordinates: imageCoordinates,
      });

      mapAfter.addLayer({
        id: 'after-fcc-layer',
        type: 'raster',
        source: 'after-fcc-source',
        paint: {
          'raster-opacity': 0.98,
          'raster-resampling': 'linear',
        },
      });

      // 2. 6-Class DELTA-SAR Change Mask (linear resampling for smooth anti-aliased gradient edges)
      mapAfter.addSource('change-overlay-source', {
        type: 'image',
        url: `/processed/${regionId}/change_overlay.webp?v=${cacheBuster}`,
        coordinates: imageCoordinates,
      });

      mapAfter.addLayer({
        id: 'change-overlay-layer',
        type: 'raster',
        source: 'change-overlay-source',
        paint: {
          'raster-opacity': changeOpacity,
          'raster-resampling': 'linear',
        },
      });

      // 3. Evidence Polygons GeoJSON layer
      mapAfter.addSource('evidence-polygons-source', {
        type: 'geojson',
        data: `/processed/${regionId}/evidence_polygons.geojson?v=${cacheBuster}`,
      });

      // Invisible interaction hitbox
      mapAfter.addLayer({
        id: 'evidence-polygons-hitbox',
        type: 'fill',
        source: 'evidence-polygons-source',
        paint: {
          'fill-opacity': 0.0,
        },
      });

      // Scientific Blue Flood Fill Layer (Activated in Scientific SAR Mode)
      mapAfter.addLayer({
        id: 'sar-blue-flood-fill',
        type: 'fill',
        source: 'evidence-polygons-source',
        filter: ['in', ['get', 'class_id'], ['literal', [1, 2]]],
        paint: {
          'fill-color': '#0055FF',
          'fill-opacity': 0.75,
        },
        layout: { visibility: sarIntensityMode ? 'visible' : 'none' },
      });

      // Filtered Class Highlight Layer (Glows when a 4-Class filter pill is active)
      mapAfter.addLayer({
        id: 'evidence-polygons-filtered-glow',
        type: 'line',
        source: 'evidence-polygons-source',
        paint: {
          'line-color': [
            'match',
            ['get', 'class_id'],
            1, '#00F0FF',
            2, '#FF2E93',
            3, '#10B981',
            4, '#FFB800',
            '#FFFFFF',
          ],
          'line-width': 4.0,
          'line-blur': 2.5,
          'line-opacity': 0.9,
        },
        filter: ['==', 'id', ''],
      });

      // Glowing Selected Polygon Highlight: Outer Blur Glow
      mapAfter.addLayer({
        id: 'evidence-polygon-highlight-glow',
        type: 'line',
        source: 'evidence-polygons-source',
        paint: {
          'line-color': '#00E5FF',
          'line-width': 8.0,
          'line-blur': 5.0,
          'line-opacity': 0.95,
        },
        filter: ['==', 'id', ''],
      });

      // Glowing Selected Polygon Highlight: Razor-sharp White Core
      mapAfter.addLayer({
        id: 'evidence-polygon-highlight-core',
        type: 'line',
        source: 'evidence-polygons-source',
        paint: {
          'line-color': '#FFFFFF',
          'line-width': 2.0,
          'line-opacity': 1.0,
        },
        filter: ['==', 'id', ''],
      });

      // 4. Evacuation Routes GeoJSON
      mapAfter.addSource('evacuation-routes-source', {
        type: 'geojson',
        data: `/data/evacuation_routes.geojson?v=${cacheBuster}`,
      });

      mapAfter.addLayer({
        id: 'evacuation-routes-line',
        type: 'line',
        source: 'evacuation-routes-source',
        filter: ['==', '$type', 'LineString'],
        paint: {
          'line-color': '#10B981',
          'line-width': 3.5,
          'line-dasharray': [2, 1],
          'line-opacity': 0.9,
        },
        layout: { visibility: showEvacuationRoutes ? 'visible' : 'none' },
      });

      mapAfter.addLayer({
        id: 'evacuation-shelters-point',
        type: 'circle',
        source: 'evacuation-routes-source',
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 7,
          'circle-color': '#00F0FF',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
        },
        layout: { visibility: showEvacuationRoutes ? 'visible' : 'none' },
      });

      // Polygon hover inspection
      mapAfter.on('mousemove', 'evidence-polygons-hitbox', (e) => {
        if (!e.features || e.features.length === 0) return;
        mapAfter.getCanvas().style.cursor = 'pointer';
        const feat = e.features[0];
        const props = feat.properties as any;
        setHoveredPoly({
          x: e.point.x,
          y: e.point.y,
          id: props.id,
          className: props.class_name,
          area: Number(props.area_km2),
          delta: Number(props.delta_hh_db),
        });
      });

      mapAfter.on('mouseleave', 'evidence-polygons-hitbox', () => {
        mapAfter.getCanvas().style.cursor = '';
        setHoveredPoly(null);
      });

      // Polygon click selection
      mapAfter.on('click', 'evidence-polygons-hitbox', (e) => {
        if (!e.features || e.features.length === 0) return;
        const feat = e.features[0];
        const props = feat.properties as EvidencePolygonProperties;
        onSelectPolygon(props);
      });
    });

    // ==========================================
    // MAP 2 (BEFORE): ONLY PRE-EVENT BASELINE RADAR (ZERO FLOOD MASK!)
    // ==========================================
    mapBefore.on('load', () => {
      // 0. Enable Smooth 3D DEM Terrain on mapBefore when 3D is active
      setupDemTerrain(mapBefore, is3D);

      // Clean Before SAR FCC layer: dry baseline, normal channels, NO flood mask overlay!
      mapBefore.addSource('before-fcc-source', {
        type: 'image',
        url: `/processed/${regionId}/before_fcc.webp?v=${cacheBuster}`,
        coordinates: imageCoordinates,
      });

      mapBefore.addLayer({
        id: 'before-fcc-layer',
        type: 'raster',
        source: 'before-fcc-source',
        paint: {
          'raster-opacity': 0.98,
          'raster-resampling': 'linear',
        },
      });
    });

    mapAfterRef.current = mapAfter;
    mapBeforeRef.current = mapBefore;

    return () => {
      mapAfter.remove();
      mapBefore.remove();
      mapAfterRef.current = null;
      mapBeforeRef.current = null;
    };
  }, [regionId]);

  // Switch Basemaps (Esri Satellite, Dark Gray, Terrain)
  useEffect(() => {
    const updateBasemap = (map: Map | null) => {
      if (!map) return;
      const isSat = basemapMode === 'satellite';
      const isDark = basemapMode === 'dark';
      const isTerrain = basemapMode === 'terrain';

      if (map.getLayer('esri-imagery-layer')) {
        map.setLayoutProperty('esri-imagery-layer', 'visibility', isSat ? 'visible' : 'none');
      }
      if (map.getLayer('esri-boundaries-layer')) {
        map.setLayoutProperty('esri-boundaries-layer', 'visibility', isSat ? 'visible' : 'none');
      }
      if (map.getLayer('esri-dark-layer')) {
        map.setLayoutProperty('esri-dark-layer', 'visibility', isDark ? 'visible' : 'none');
      }
      if (map.getLayer('esri-dark-ref-layer')) {
        map.setLayoutProperty('esri-dark-ref-layer', 'visibility', isDark ? 'visible' : 'none');
      }
      if (map.getLayer('esri-terrain-layer')) {
        map.setLayoutProperty('esri-terrain-layer', 'visibility', isTerrain ? 'visible' : 'none');
      }
    };
    updateBasemap(mapAfterRef.current);
    updateBasemap(mapBeforeRef.current);
  }, [basemapMode]);

  // Handle Grayscale SAR Mode + Blue Flood Mapping
  useEffect(() => {
    const applySarGrayscaleAndBlue = (map: Map | null) => {
      if (!map) return;
      const satId = map.getLayer('satellite')
        ? 'satellite'
        : map.getLayer('esri-imagery-layer')
          ? 'esri-imagery-layer'
          : null;

      if (satId) {
        map.setPaintProperty(satId, 'raster-saturation', sarIntensityMode ? -1 : 0);
        map.setPaintProperty(satId, 'raster-contrast', sarIntensityMode ? 0.5 : 0.1);
        map.setPaintProperty(satId, 'raster-brightness-max', sarIntensityMode ? 0.82 : 0.92);
      }
    };

    applySarGrayscaleAndBlue(mapAfterRef.current);
    applySarGrayscaleAndBlue(mapBeforeRef.current);

    const afterMap = mapAfterRef.current;
    if (afterMap) {
      // Toggle Blue Flood vector mask
      if (afterMap.getLayer('sar-blue-flood-fill')) {
        afterMap.setLayoutProperty(
          'sar-blue-flood-fill',
          'visibility',
          sarIntensityMode ? 'visible' : 'none'
        );
      }

      // Tint change_overlay raster layer to monochromatic deep blue
      const changeLayerId = afterMap.getLayer('change-layer')
        ? 'change-layer'
        : afterMap.getLayer('change-overlay-layer')
          ? 'change-overlay-layer'
          : null;

      if (changeLayerId) {
        if (sarIntensityMode) {
          afterMap.setPaintProperty(changeLayerId, 'raster-hue-rotate', 180);
          afterMap.setPaintProperty(changeLayerId, 'raster-contrast', 0.45);
          afterMap.setPaintProperty(changeLayerId, 'raster-saturation', 0.85);
        } else {
          afterMap.setPaintProperty(changeLayerId, 'raster-hue-rotate', 0);
          afterMap.setPaintProperty(changeLayerId, 'raster-contrast', 0.0);
          afterMap.setPaintProperty(changeLayerId, 'raster-saturation', 0.0);
        }
      }
    }
  }, [sarIntensityMode]);

  // Update Flood Mask Visibility & Opacity on mapAfter
  useEffect(() => {
    const map = mapAfterRef.current;
    const changeLayerId = map?.getLayer('change-layer')
      ? 'change-layer'
      : map?.getLayer('change-overlay-layer')
        ? 'change-overlay-layer'
        : null;

    if (!map || !changeLayerId) return;
    map.setLayoutProperty(changeLayerId, 'visibility', showChangeOverlay ? 'visible' : 'none');
    map.setPaintProperty(changeLayerId, 'raster-opacity', changeOpacity);
  }, [showChangeOverlay, changeOpacity]);

  // Update NASA GIBS Precipitation Layer Visibility
  useEffect(() => {
    const map = mapAfterRef.current;
    if (!map || !map.getLayer('nasa-gibs-precip-layer')) return;
    map.setLayoutProperty(
      'nasa-gibs-precip-layer',
      'visibility',
      showPrecipitation ? 'visible' : 'none'
    );
  }, [showPrecipitation]);

  // Update Evacuation Routes Layer Visibility
  useEffect(() => {
    const map = mapAfterRef.current;
    if (!map || !map.getLayer('evacuation-routes-line')) return;
    const vis = showEvacuationRoutes ? 'visible' : 'none';
    map.setLayoutProperty('evacuation-routes-line', 'visibility', vis);
    if (map.getLayer('evacuation-shelters-point')) {
      map.setLayoutProperty('evacuation-shelters-point', 'visibility', vis);
    }
  }, [showEvacuationRoutes]);

  // Update Selected Polygon Highlight
  useEffect(() => {
    const map = mapAfterRef.current;
    if (!map || !map.getLayer('evidence-polygon-highlight-glow')) return;

    if (selectedPolygon) {
      map.setFilter('evidence-polygon-highlight-glow', ['==', 'id', selectedPolygon.id]);
      map.setFilter('evidence-polygon-highlight-core', ['==', 'id', selectedPolygon.id]);
    } else {
      map.setFilter('evidence-polygon-highlight-glow', ['==', 'id', '']);
      map.setFilter('evidence-polygon-highlight-core', ['==', 'id', '']);
    }
  }, [selectedPolygon]);

  // Update 4-Class Filter or Mangrove Filter Highlight
  useEffect(() => {
    const map = mapAfterRef.current;
    if (!map || !map.getLayer('evidence-polygons-filtered-glow')) return;

    const targetClass = showMangroveFilter ? 2 : activeClassFilter;

    if (targetClass !== null && targetClass !== undefined) {
      map.setFilter('evidence-polygons-filtered-glow', ['==', ['get', 'class_id'], targetClass]);
    } else {
      map.setFilter('evidence-polygons-filtered-glow', ['==', 'id', '']);
    }
  }, [activeClassFilter, showMangroveFilter]);

  // Slider Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !sliderContainerRef.current) return;
      const rect = sliderContainerRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percentage = (x / rect.width) * 100;
      setSliderPos(percentage);

      if (percentage > 85) onSelectCompareMode('before');
      else if (percentage < 15) onSelectCompareMode('after');
      else onSelectCompareMode('split');
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove);
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, onSelectCompareMode]);

  return (
    <div ref={sliderContainerRef} className="relative w-full h-full overflow-hidden select-none bg-black">
      {/* 1. Base Map: AFTER SCENE (100% full width, background layer) */}
      <div ref={mapContainerAfterRef} className="absolute inset-0 w-full h-full z-0" />

      {/* 2. Top Clipped Map: BEFORE SCENE (Clipped to left of slider line with inset) */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden z-10"
        style={{
          clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
        }}
      >
        <div ref={mapContainerBeforeRef} className="w-full h-full pointer-events-none" />
      </div>

      {/* 3. Glowing Swipe Slider Divider Line & Center Draggable Handle */}
      {sliderPos > 0.5 && sliderPos < 99.5 && (
        <div
          className="absolute top-0 bottom-0 z-20 pointer-events-auto cursor-ew-resize flex items-center justify-center group"
          style={{ left: `${sliderPos}%`, width: '32px', marginLeft: '-16px' }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {/* Vertical Divider Line with Cyan Neon Glow */}
          <div className="w-[2px] h-full bg-gradient-to-b from-cyan-400 via-sky-300 to-indigo-500 shadow-[0_0_12px_#00F0FF,0_0_24px_rgba(0,240,255,0.7)] group-hover:bg-cyan-200 transition-colors" />

          {/* Central Circular Handle */}
          <div className="absolute w-8 h-8 rounded-full bg-[#090D1A]/95 border-2 border-cyan-400 flex items-center justify-center shadow-[0_0_16px_rgba(0,240,255,0.8)] text-white group-hover:scale-110 transition-transform">
            <Sliders className="w-3.5 h-3.5 text-cyan-300 rotate-90 drop-shadow-[0_0_6px_#00F0FF]" />
          </div>
        </div>
      )}

      {/* 4. Bottom-Left Live Cursor Coordinate & Split Percentage Pill */}
      <div className="absolute bottom-5 left-5 z-20 pointer-events-auto">
        <div className="bg-[#1E1F22]/90 backdrop-blur-xl border border-white/10 px-3.5 py-1.5 rounded-full text-[11px] font-mono tabular-nums text-white/80 flex items-center gap-2 shadow-2xl">
          <Crosshair className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>
            {cursorCoords
              ? `${cursorCoords.lat.toFixed(4)}°N, ${cursorCoords.lng.toFixed(4)}°E`
              : `${metrics.center[1].toFixed(4)}°N, ${metrics.center[0].toFixed(4)}°E`}
          </span>
          <span className="text-white/20">|</span>
          <span className="text-cyan-300 font-semibold">
            {sliderPos > 50 ? `${Math.round(sliderPos)}% Pre` : `${Math.round(100 - sliderPos)}% Post`}
          </span>
        </div>
      </div>

      {/* 5. Hovered Feature Tooltip */}
      {hoveredPoly && (
        <div
          className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-full mb-3 px-4 py-2.5 rounded-2xl bg-[#090D1A]/95 border border-cyan-400/50 shadow-2xl text-xs text-white backdrop-blur-xl"
          style={{ left: `${hoveredPoly.x}px`, top: `${hoveredPoly.y}px` }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-1 mb-1.5">
            <span className="font-mono font-bold text-cyan-300">{hoveredPoly.id}</span>
            <span className="text-[10px] text-white/60">{hoveredPoly.className}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] tabular-nums">
            <span>
              Area: <strong className="font-mono text-emerald-300">{hoveredPoly.area} km²</strong>
            </span>
            <span>
              ΔHH: <strong className="font-mono text-cyan-300">{hoveredPoly.delta > 0 ? `+${hoveredPoly.delta}` : hoveredPoly.delta} dB</strong>
            </span>
          </div>
          <div className="text-[9px] text-white/40 mt-1">Click to inspect radar evidence</div>
        </div>
      )}
    </div>
  );
}

export default SarMapViewer;
