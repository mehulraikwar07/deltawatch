'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Map, Marker, setWorkerUrl, type StyleSpecification } from 'maplibre-gl';
import { Crosshair, Play, Pause } from 'lucide-react';
import type { RegionId, SummaryMetrics, EvidencePolygonProperties } from '@/types/sar';
import { fmtDate, fmtDb, fmtNum, normalizePolygonProps } from '@/lib/metrics';
import { RiverFlowCard } from './RiverFlowCard';
import { MapLegend } from './MapLegend';
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
  radarOpacity?: number;
  showPrecipitation?: boolean;
  showEvacuationRoutes?: boolean;
  showMangroveFilter?: boolean;
  sarIntensityMode?: boolean;
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
  radarOpacity = 0,
  showPrecipitation = false,
  showEvacuationRoutes = false,
  showMangroveFilter = false,
  sarIntensityMode = false,
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

  // Before → After animation (replaces the old swipe slider).
  // Only the two real scenes are shown: the before image fades into the after image while the
  // change overlay fades in. No in-between frames are invented.
  const ANIM_MS = 4500;
  const [beforeOpacity, setBeforeOpacity] = useState<number>(1);
  const [animProgress, setAnimProgress] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const animStartRef = useRef<number | null>(null);
  const animElapsedRef = useRef<number>(0);
  const overlayReadyRef = useRef<boolean>(false);
  const showChangeOverlayRef = useRef<boolean>(showChangeOverlay);
  const changeOpacityRef = useRef<number>(changeOpacity);
  const radarOpacityRef = useRef<number>(radarOpacity);
  radarOpacityRef.current = radarOpacity;
  showChangeOverlayRef.current = showChangeOverlay;
  changeOpacityRef.current = changeOpacity;

  // Live cursor telemetry readout
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Hovered polygon tooltip
  const [hoveredPoly, setHoveredPoly] = useState<{
    x: number;
    y: number;
    id: string;
    className: string;
    area: number | null;
    delta: number | null;
  } | null>(null);

  const bbox = metrics.bbox; // [west, south, east, north]
  // IMERG tile date: the "after" acquisition date; GIBS "default" (latest) if missing.
  const imergDate = /^\d{4}-\d{2}-\d{2}$/.test(fmtDate(metrics.after_date)) ? fmtDate(metrics.after_date) : 'default';
  const imageCoordinates: [[number, number], [number, number], [number, number], [number, number]] = [
    [bbox[0], bbox[3]], // Top-Left: west, north
    [bbox[2], bbox[3]], // Top-Right: east, north
    [bbox[2], bbox[1]], // Bottom-Right: east, south
    [bbox[0], bbox[1]], // Bottom-Left: west, south
  ];

  // Set the change overlay opacity on the after map (no-op until the layer exists)
  const setOverlayOpacity = (o: number) => {
    const map = mapAfterRef.current;
    if (!map || !overlayReadyRef.current) return;
    const id = map.getLayer('change-layer') ? 'change-layer' : map.getLayer('change-overlay-layer') ? 'change-overlay-layer' : null;
    if (id) map.setPaintProperty(id, 'raster-opacity', o);
    // Outlines fade with the overlay (o is 0..changeOpacity)
    const k = changeOpacityRef.current > 0 ? Math.min(1, o / changeOpacityRef.current) : 0;
    if (map.getLayer('flood-outline-halo')) map.setPaintProperty('flood-outline-halo', 'line-opacity', 0.75 * k);
    if (map.getLayer('flood-outline')) map.setPaintProperty('flood-outline', 'line-opacity', k);
  };

  // Drive the animation / static modes
  useEffect(() => {
    if (compareMode === 'before') {
      setBeforeOpacity(1);
      setAnimProgress(0);
      setOverlayOpacity(0);
      return;
    }
    if (compareMode === 'after' || !isPlaying) {
      if (compareMode === 'after') {
        setBeforeOpacity(0);
        setAnimProgress(1);
        setOverlayOpacity(changeOpacityRef.current);
      }
      return;
    }
    // 'animate': loop of ANIM_MS — hold before (0–20%), crossfade + overlay fade-in (20–60%),
    // hold after (60–92%), quick fade back to before (92–100%).
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    let raf = 0;
    const tick = (now: number) => {
      if (animStartRef.current === null) animStartRef.current = now - animElapsedRef.current;
      const elapsed = (now - animStartRef.current) % ANIM_MS;
      animElapsedRef.current = elapsed;
      const p = elapsed / ANIM_MS;
      let mix: number;
      if (p < 0.2) mix = 0;
      else if (p < 0.6) mix = ease((p - 0.2) / 0.4);
      else if (p < 0.92) mix = 1;
      else mix = 1 - ease((p - 0.92) / 0.08);
      setBeforeOpacity(1 - mix);
      setAnimProgress(mix);
      setOverlayOpacity(showChangeOverlayRef.current ? mix * changeOpacityRef.current : 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      animStartRef.current = null;
    };
  }, [compareMode, isPlaying]);

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
          // Rainfall for the date of the "after" scene (was hard-coded to 2026-06-20).
          `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default/${imergDate}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
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
      maxPitch: 0, // flat 2D view only (3D terrain removed)
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
      maxPitch: 0, // flat 2D view only (3D terrain removed)
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

    // Dry-season river (normal water) drawn on both maps under the flood, when the run produced it
    const riverUrl = `/processed/${regionId}/river_overlay.webp?v=${cacheBuster}`;
    const addRiverLayer = (map: Map) => {
      fetch(riverUrl, { method: 'HEAD' })
        .then((r) => {
          if (!r.ok || map.getSource('river-overlay-source')) return;
          map.addSource('river-overlay-source', { type: 'image', url: riverUrl, coordinates: imageCoordinates });
          const beforeId = map.getLayer('change-overlay-layer') ? 'change-overlay-layer' : undefined;
          map.addLayer(
            { id: 'river-overlay-layer', type: 'raster', source: 'river-overlay-source', paint: { 'raster-opacity': 1, 'raster-resampling': 'nearest' } },
            beforeId
          );
        })
        .catch(() => {});
    };

    // ==========================================
    // MAP 1 (AFTER): AFTER FCC + 6-CLASS FLOOD MASK + POLYGONS + EVACUATION + 15x DEM
    // ==========================================
    mapAfter.on('load', () => {
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
          'raster-opacity': radarOpacityRef.current,
          'raster-resampling': 'linear',
        },
      });

      addRiverLayer(mapAfter);

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
      overlayReadyRef.current = true;

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

      // Always-on class outlines so small flood patches stand out on the satellite basemap:
      // a dark halo underneath for contrast, then the class colour on top.
      mapAfter.addLayer({
        id: 'flood-outline-halo',
        type: 'line',
        source: 'evidence-polygons-source',
        // Outline only the flood classes; class 3 is drawn faintly by the overlay alone when the
        // run is a dry-vs-monsoon flood map (it is 'water away from the river', not flood).
        filter: metrics.comparison_mode === 'dry_reference_vs_monsoon'
          ? ['in', ['get', 'class_id'], ['literal', [1, 2]]]
          : ['has', 'class_id'],
        paint: { 'line-color': '#000000', 'line-width': 4.5, 'line-blur': 1.5, 'line-opacity': 0.75 },
      });
      mapAfter.addLayer({
        id: 'flood-outline',
        type: 'line',
        source: 'evidence-polygons-source',
        // Outline only the flood classes; class 3 is drawn faintly by the overlay alone when the
        // run is a dry-vs-monsoon flood map (it is 'water away from the river', not flood).
        filter: metrics.comparison_mode === 'dry_reference_vs_monsoon'
          ? ['in', ['get', 'class_id'], ['literal', [1, 2]]]
          : ['has', 'class_id'],
        paint: {
          'line-color': ['match', ['get', 'class_id'], 1, '#00F0FF', 2, '#FF2E93', 3, '#10B981', 4, '#FFB800', '#FFFFFF'],
          'line-width': 2.0,
          'line-opacity': 1.0,
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
        const props = normalizePolygonProps((feat.properties ?? {}) as Record<string, unknown>);
        setHoveredPoly({
          x: e.point.x,
          y: e.point.y,
          id: props.id,
          className: props.class_name,
          area: props.area_km2,
          delta: props.delta_hh_db,
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
        // MapLibre stringifies arrays (centroid) and may drop nulls; normalise first.
        const props = normalizePolygonProps((feat.properties ?? {}) as Record<string, unknown>);
        onSelectPolygon(props);
      });
    });

    // ==========================================
    // MAP 2 (BEFORE): ONLY PRE-EVENT BASELINE RADAR (ZERO FLOOD MASK!)
    // ==========================================
    mapBefore.on('load', () => {
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
          'raster-opacity': radarOpacityRef.current,
          'raster-resampling': 'linear',
        },
      });
      addRiverLayer(mapBefore);
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

  // Radar (FCC) image opacity on both maps — 0 by default so the satellite basemap shows through
  useEffect(() => {
    const a = mapAfterRef.current;
    const b = mapBeforeRef.current;
    if (a?.getLayer('after-fcc-layer')) a.setPaintProperty('after-fcc-layer', 'raster-opacity', radarOpacity);
    if (b?.getLayer('before-fcc-layer')) b.setPaintProperty('before-fcc-layer', 'raster-opacity', radarOpacity);
  }, [radarOpacity]);

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
  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-black">
      {/* 1. Base Map: AFTER SCENE (100% full width, background layer) */}
      <div ref={mapContainerAfterRef} className="absolute inset-0 w-full h-full z-0" />

      {/* 2. Top Map: BEFORE SCENE, faded out by the animation */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden z-10"
        style={{ opacity: beforeOpacity }}
      >
        <div ref={mapContainerBeforeRef} className="w-full h-full pointer-events-none" />
      </div>

      {/* 3. Animation player: date label, progress and play/pause */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
        <div className="bg-[#1E1F22]/90 backdrop-blur-xl border border-white/10 pl-2 pr-4 py-1.5 rounded-full flex items-center gap-3 shadow-2xl text-white">
          {compareMode === 'animate' ? (
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className="w-7 h-7 rounded-full bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/50 flex items-center justify-center cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 text-cyan-300" /> : <Play className="w-3.5 h-3.5 text-cyan-300" />}
            </button>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 pl-2">{compareMode}</span>
          )}
          <span className={`text-xs font-mono tabular-nums flex flex-col items-center leading-tight ${animProgress < 0.5 ? 'text-white font-bold' : 'text-white/40'}`}>
            {metrics.comparison_mode === 'dry_reference_vs_monsoon' && <span className="text-[9px] font-sans uppercase tracking-wider text-blue-300">{metrics.before_label ?? 'Dry season'}</span>}
            {fmtDate(metrics.before_date)}
          </span>
          <div className="relative w-28 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${animProgress * 100}%` }} />
          </div>
          <span className={`text-xs font-mono tabular-nums flex flex-col items-center leading-tight ${animProgress >= 0.5 ? 'text-white font-bold' : 'text-white/40'}`}>
            {metrics.comparison_mode === 'dry_reference_vs_monsoon' && <span className="text-[9px] font-sans uppercase tracking-wider text-cyan-300">{metrics.after_label ?? 'Monsoon'}</span>}
            {fmtDate(metrics.after_date)}
          </span>
        </div>
      </div>

      {/* 3b. River flow context: why these two dates */}
      <RiverFlowCard regionId={regionId} metrics={metrics} />
      <MapLegend metrics={metrics} />

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
            {animProgress < 0.5 ? 'Before' : 'After'}
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
              Area: <strong className="font-mono text-emerald-300">{fmtNum(hoveredPoly.area, 3)} km²</strong>
            </span>
            <span>
              ΔHH: <strong className="font-mono text-cyan-300">{fmtDb(hoveredPoly.delta)}</strong>
            </span>
          </div>
          <div className="text-[9px] text-white/40 mt-1">Click to inspect radar evidence</div>
        </div>
      )}
    </div>
  );
}

export default SarMapViewer;

