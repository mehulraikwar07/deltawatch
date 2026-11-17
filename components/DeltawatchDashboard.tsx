'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Eye } from 'lucide-react';
import { GoogleMapsSearchBar } from './GoogleMapsSearchBar';
import { GoogleMapsActionControls } from './GoogleMapsActionControls';
import { GoogleMapsBottomCard } from './GoogleMapsBottomCard';
import { GoogleMapsAuthModal } from './GoogleMapsAuthModal';
import { GoogleMapsLayersModal, type BasemapType, type ActiveLayerDetails } from './GoogleMapsLayersModal';
import { GoogleMapsClimateModal } from './GoogleMapsClimateModal';
import { GoogleMapsDirectionsModal } from './GoogleMapsDirectionsModal';
import { NasaModulesSheet, type NasaModuleId } from './NasaModulesSheet';
import { REGION_CLIMATE } from '@/lib/placesData';
import { normalizePolygonProps } from '@/lib/metrics';
import type {
  RegionId,
  AvailableScenesCatalog,
  SummaryMetrics,
  EvidencePolygonProperties,
} from '@/types/sar';
import type { SearchPlace, UserProfile } from '@/types/google-maps';
import type { CompareMode } from './MissionHeader';

// Dynamically import MapLibre viewer to prevent SSR issues with WebGL and auto-retry on stale dev chunks
const SarMapViewer = dynamic(
  () =>
    import('./SarMapViewer').catch((err) => {
      console.warn('[SarMapViewer dynamic load error]', err);
      if (typeof window !== 'undefined') {
        const hasRetried = sessionStorage.getItem('sar_chunk_reload');
        if (!hasRetried) {
          sessionStorage.setItem('sar_chunk_reload', 'true');
          window.location.reload();
        }
      }
      return import('./SarMapViewer');
    }),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#151922] text-slate-400 space-y-3">
        <div className="w-10 h-10 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono tracking-wider text-cyan-300">
          LOADING MAP & RADAR LAYERS...
        </span>
      </div>
    ),
  }
);

interface DeltawatchDashboardProps {
  initialCatalog: AvailableScenesCatalog;
  initialMetrics: Record<RegionId, SummaryMetrics>;
}

export function DeltawatchDashboard({
  initialCatalog,
  initialMetrics,
}: DeltawatchDashboardProps) {
  // Region & Map state
  const [currentRegion, setCurrentRegion] = useState<RegionId>('majuli');
  const [compareMode, setCompareMode] = useState<CompareMode>('animate');
  const [selectedPolygon, setSelectedPolygon] = useState<EvidencePolygonProperties | null>(null);
  const [focusCoords, setFocusCoords] = useState<[number, number] | null>(null);
  const [activePlace, setActivePlace] = useState<SearchPlace | null>(null);
  const [evidencePolys, setEvidencePolys] = useState<EvidencePolygonProperties[]>([]);

  // Basemap & Layer Toggles (Google Maps style)
  const [basemap, setBasemap] = useState<BasemapType>('satellite');
  const [layerDetails, setLayerDetails] = useState<ActiveLayerDetails>({
    showSarSwath: true,
    showFloodMask: true,
    showAqiClimate: true,
    showEvacuationRoutes: false,
    showPrecipitation: false,
    showMangroveFilter: false,
    sarIntensityMode: false,
    floodMaskOpacity: 1.0,
    radarOpacity: 0,
  });
  const [activeClassFilter, setActiveClassFilter] = useState<number | null>(null);

  // UI Visibility Mode (Hide UI feature)
  const [isUiHidden, setIsUiHidden] = useState(false);

  // Bottom Navigation state
  const [activeNavTab, setActiveNavTab] = useState<'explore' | 'evidence' | 'report' | 'climate'>('explore');

  // Modals & Drawers state
  const [isNasaSheetOpen, setIsNasaSheetOpen] = useState(false);
  const [nasaSheetModule, setNasaSheetModule] = useState<NasaModuleId>('overview');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [isClimateOpen, setIsClimateOpen] = useState(false);
  const [isDirectionsOpen, setIsDirectionsOpen] = useState(false);

  // Action Triggers for MapLibre controls
  const [zoomInTrigger, setZoomInTrigger] = useState(0);
  const [zoomOutTrigger, setZoomOutTrigger] = useState(0);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [resetNorthTrigger, setResetNorthTrigger] = useState(0);

  // User Profile state
  const [profile, setProfile] = useState<UserProfile>({
    // Placeholder local profile; there is no real authentication in this app.
    name: 'Demo User',
    email: 'demo@example.com',
    organization: 'Local demo',
    role: 'Viewer',
    isSignedIn: true,
    isGuest: false,
  });

  const activeMetrics = initialMetrics[currentRegion];
  const activeClimate = REGION_CLIMATE[currentRegion] || REGION_CLIMATE.nagapattinam;

  // Load evidence polygons for active region
  useEffect(() => {
    let isMounted = true;
    fetch(`/processed/${currentRegion}/evidence_polygons.geojson?v=${Date.now()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted || !data.features) return;
        const polys = data.features.map((f: { properties?: Record<string, unknown> }) =>
          normalizePolygonProps(f.properties ?? {})
        );
        setEvidencePolys(polys);
      })
      .catch((err) => console.warn('[DeltawatchDashboard] Polygons fetch failed:', err));
    return () => {
      isMounted = false;
    };
  }, [currentRegion]);

  // Handlers
  const handleSelectRegion = (newRegion: RegionId) => {
    setCurrentRegion(newRegion);
    setSelectedPolygon(null);
    setFocusCoords(null);
    setActivePlace(null);
  };

  const handleSelectPlace = (place: SearchPlace) => {
    setActivePlace(place);
    setFocusCoords(place.coordinates);
  };

  const handleSelectPolygon = (poly: EvidencePolygonProperties) => {
    setSelectedPolygon(poly);
    if (poly.centroid) setFocusCoords(poly.centroid);
    setNasaSheetModule('analytics');
    setIsNasaSheetOpen(true);
    setActiveNavTab('evidence');
  };

  const handleFocusPolygon = (coords: [number, number]) => {
    setFocusCoords(coords);
  };

  const handleToggleCompareMode = () => {
    setCompareMode((prev) => (prev === 'animate' ? 'after' : prev === 'after' ? 'before' : 'animate'));
  };

  const handleToggleClassFilter = (classId: number) => {
    setActiveClassFilter((prev) => (prev === classId ? null : classId));
    if (classId === 2) {
      setLayerDetails((prev) => ({ ...prev, showMangroveFilter: !prev.showMangroveFilter }));
    }
  };

  const handleToggleLayer = (layerKey: keyof ActiveLayerDetails) => {
    setLayerDetails((prev) => ({
      ...prev,
      [layerKey]: !prev[layerKey],
    }));
  };

  const handleSelectNavTab = (tab: 'explore' | 'evidence' | 'report' | 'climate') => {
    setActiveNavTab(tab);
    if (tab === 'explore') {
      setNasaSheetModule('overview');
      setIsNasaSheetOpen(true);
    } else if (tab === 'evidence') {
      setNasaSheetModule('analytics');
      setIsNasaSheetOpen(true);
    } else if (tab === 'report') {
      setNasaSheetModule('report');
      setIsNasaSheetOpen(true);
    } else if (tab === 'climate') {
      setIsClimateOpen(true);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black text-white select-none font-sans">
      {/* 1. FULL-BLEED MAPLIBRE GL WEBGL MAP */}
      <div className="absolute inset-0 w-full h-full z-0">
        <SarMapViewer
          regionId={currentRegion}
          metrics={activeMetrics}
          onSelectPolygon={handleSelectPolygon}
          selectedPolygon={selectedPolygon}
          focusCoords={focusCoords}
          compareMode={compareMode}
          onSelectCompareMode={setCompareMode}
          basemapMode={basemap}
          showChangeOverlay={layerDetails.showFloodMask}
          changeOpacity={layerDetails.floodMaskOpacity}
          radarOpacity={layerDetails.radarOpacity}
          showPrecipitation={layerDetails.showPrecipitation}
          showEvacuationRoutes={layerDetails.showEvacuationRoutes}
          showMangroveFilter={layerDetails.showMangroveFilter}
          sarIntensityMode={layerDetails.sarIntensityMode}
          activeClassFilter={activeClassFilter}
          activePlace={activePlace}
          zoomInTrigger={zoomInTrigger}
          zoomOutTrigger={zoomOutTrigger}
          recenterTrigger={recenterTrigger}
          resetNorthTrigger={resetNorthTrigger}
          onMapClick={() => {
            if (isNasaSheetOpen) setIsNasaSheetOpen(false);
          }}
        />
      </div>

      {/* 2. SHOW UI RESTORE BUTTON (Displayed when UI is hidden) */}
      {isUiHidden && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-auto animate-in fade-in zoom-in duration-200">
          <button
            onClick={() => setIsUiHidden(false)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1E1F22]/90 hover:bg-[#2A2B2F] border border-cyan-400/50 text-cyan-300 text-xs font-bold shadow-2xl backdrop-blur-xl transition-all cursor-pointer group hover:scale-105"
          >
            <Eye className="w-4 h-4 text-cyan-400 group-hover:animate-pulse" />
            <span>Show Google Maps UI</span>
          </button>
        </div>
      )}

      {/* 3. GOOGLE MAPS FLOATING TOP SEARCH BAR & CATEGORY CHIPS */}
      {/* Region switch: one button per study area */}
      <div
        className={`absolute top-4 left-1/2 -translate-x-1/2 z-30 transition-all duration-300 ${
          isUiHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <div className="flex items-center gap-1 p-1 rounded-full bg-[#1E1F22]/95 backdrop-blur-xl border border-white/10 shadow-2xl">
          {([
            ['majuli', 'Majuli'],
            ['nagapattinam', 'Nagapattinam'],
          ] as [RegionId, string][]).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => id !== currentRegion && handleSelectRegion(id)}
              aria-pressed={currentRegion === id}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                currentRegion === id
                  ? 'bg-cyan-500 text-[#06121F] shadow-[0_0_12px_rgba(0,240,255,0.5)]'
                  : 'text-white/75 hover:text-white hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`absolute top-4 left-4 z-30 transition-all duration-300 ${
          isUiHidden ? 'opacity-0 pointer-events-none -translate-y-4' : 'opacity-100'
        }`}
      >
        <GoogleMapsSearchBar
          currentRegion={currentRegion}
          onSelectRegion={handleSelectRegion}
          onSelectPlace={handleSelectPlace}
          onOpenAuth={() => setIsAuthOpen(true)}
          onOpenAiReport={() => {
            setNasaSheetModule('report');
            setIsNasaSheetOpen(true);
            setActiveNavTab('report');
          }}
          onToggleCompareMode={handleToggleCompareMode}
          compareMode={compareMode}
          profile={profile}
          activeFilterClass={activeClassFilter}
          onToggleFilterClass={handleToggleClassFilter}
        />
      </div>

      {/* 4. GOOGLE MAPS FLOATING RIGHT ACTION CONTROLS */}
      <div
        className={`absolute top-4 right-4 z-30 transition-all duration-300 ${
          isUiHidden ? 'opacity-0 pointer-events-none translate-x-4' : 'opacity-100'
        }`}
      >
        <GoogleMapsActionControls
          onOpenLayersModal={() => setIsLayersOpen(true)}
          onRecenter={() => setRecenterTrigger(Date.now())}
          onResetNorth={() => setResetNorthTrigger(Date.now())}
          onZoomIn={() => setZoomInTrigger(Date.now())}
          onZoomOut={() => setZoomOutTrigger(Date.now())}
          onOpenDirections={() => setIsDirectionsOpen(true)}
          isUiHidden={isUiHidden}
          onToggleHideUi={() => setIsUiHidden(!isUiHidden)}
        />
      </div>

      {/* 5. GOOGLE MAPS BOTTOM LOCATION & WEATHER/AQI CARD */}
      <div
        className={`absolute bottom-5 left-1/2 -translate-x-1/2 z-30 w-[92vw] max-w-lg transition-all duration-300 ${
          isUiHidden ? 'opacity-0 pointer-events-none translate-y-6' : 'opacity-100'
        }`}
      >
        <GoogleMapsBottomCard
          metrics={activeMetrics}
          climate={activeClimate}
          activePlace={activePlace}
          activeNavTab={activeNavTab}
          onSelectNavTab={handleSelectNavTab}
          onOpenClimateModal={() => setIsClimateOpen(true)}
          onOpenDirections={() => setIsDirectionsOpen(true)}
        />
      </div>

      {/* 6. SLIDE-OVER NASA MODULES SHEET (Houses 8 NASA Mission Cockpit Modules) */}
      <NasaModulesSheet
        isOpen={isNasaSheetOpen}
        onClose={() => setIsNasaSheetOpen(false)}
        activeModule={nasaSheetModule}
        onSelectModule={setNasaSheetModule}
        metrics={activeMetrics}
        climate={activeClimate}
        selectedPolygon={selectedPolygon}
        onSelectPolygon={handleSelectPolygon}
        onFocusPolygon={handleFocusPolygon}
        evidencePolys={evidencePolys}
        onFlyToRegion={(coords) => setFocusCoords(coords)}
        regionCatalog={initialCatalog?.regions?.[currentRegion] ?? null}
      />

      {/* 7. GOOGLE MAPS LAYERS MODAL */}
      <GoogleMapsLayersModal
        isOpen={isLayersOpen}
        onClose={() => setIsLayersOpen(false)}
        basemap={basemap}
        onSelectBasemap={setBasemap}
        layers={layerDetails}
        onToggleLayer={handleToggleLayer}
        onChangeOpacity={(opacity) =>
          setLayerDetails((prev) => ({ ...prev, floodMaskOpacity: opacity }))
        }
        onChangeRadarOpacity={(opacity) =>
          setLayerDetails((prev) => ({ ...prev, radarOpacity: opacity }))
        }
      />

      {/* 8. GOOGLE MAPS CLIMATE & AQI MODAL */}
      <GoogleMapsClimateModal
        isOpen={isClimateOpen}
        onClose={() => setIsClimateOpen(false)}
        regionId={currentRegion}
        regionName={activeMetrics.region_name}
        climate={activeClimate}
        beforeDate={activeMetrics.before_date}
        afterDate={activeMetrics.after_date}
        center={activeMetrics.center}
      />

      {/* 9. GOOGLE MAPS EVACUATION DIRECTIONS MODAL */}
      <GoogleMapsDirectionsModal
        isOpen={isDirectionsOpen}
        onClose={() => setIsDirectionsOpen(false)}
        currentRegion={currentRegion}
      />

      {/* 10. GOOGLE MAPS AUTH & PROFILE MODAL */}
      <GoogleMapsAuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        profile={profile}
        onUpdateProfile={setProfile}
      />
    </div>
  );
}
