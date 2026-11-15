'use client';

import React from 'react';
import {
  X,
  Layers,
  Map as MapIcon,
  Globe2,
  Mountain,
  Bus,
  Activity,
  Flame,
  Wind,
  CloudRain,
  Trees,
  Check,
  Eye,
  EyeOff,
  Radio,
} from 'lucide-react';
import { ISRO_DEM_LULC_METADATA_2024_25 } from '@/lib/demMetadata';

export type BasemapType = 'satellite' | 'dark' | 'terrain';

export interface ActiveLayerDetails {
  showSarSwath: boolean;
  showFloodMask: boolean;
  showAqiClimate: boolean;
  showEvacuationRoutes: boolean;
  showPrecipitation: boolean;
  showMangroveFilter: boolean;
  sarIntensityMode: boolean;
  floodMaskOpacity: number;
}

interface GoogleMapsLayersModalProps {
  isOpen: boolean;
  onClose: () => void;
  basemap: BasemapType;
  onSelectBasemap: (type: BasemapType) => void;
  layers: ActiveLayerDetails;
  onToggleLayer: (layerKey: keyof ActiveLayerDetails) => void;
  onChangeOpacity: (opacity: number) => void;
}

export function GoogleMapsLayersModal({
  isOpen,
  onClose,
  basemap,
  onSelectBasemap,
  layers,
  onToggleLayer,
  onChangeOpacity,
}: GoogleMapsLayersModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full sm:max-w-md bg-[#1F2023] sm:rounded-3xl rounded-t-3xl border border-white/10 shadow-2xl overflow-hidden text-white font-sans animate-in slide-in-from-bottom duration-250 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold tracking-tight text-white">Map type</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. MAP TYPE SELECTOR (Three rounded cards: Default, Satellite, Terrain) */}
        <div className="px-6 py-2">
          <div className="grid grid-cols-3 gap-3">
            {/* Card 1: Default (Dark Topo) */}
            <button
              type="button"
              onClick={() => onSelectBasemap('dark')}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div
                className={`w-full aspect-[4/3] rounded-2xl overflow-hidden border-2 transition-all relative flex items-center justify-center bg-[#151922] ${
                  basemap === 'dark'
                    ? 'border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.35)]'
                    : 'border-white/10 hover:border-white/30'
                }`}
              >
                {/* Visual Icon Illustration */}
                <div className="w-full h-full flex flex-col justify-between p-2 bg-gradient-to-br from-slate-900 to-slate-950">
                  <div className="w-full h-1 bg-white/20 rounded" />
                  <div className="w-3/4 h-1 bg-cyan-400/40 rounded" />
                  <div className="w-1/2 h-1 bg-white/10 rounded" />
                </div>
                {basemap === 'dark' && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-cyan-400 text-black flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
              </div>
              <span
                className={`text-xs font-medium transition ${
                  basemap === 'dark' ? 'text-cyan-400 font-semibold' : 'text-white/70 group-hover:text-white'
                }`}
              >
                Default
              </span>
            </button>

            {/* Card 2: Satellite */}
            <button
              type="button"
              onClick={() => onSelectBasemap('satellite')}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div
                className={`w-full aspect-[4/3] rounded-2xl overflow-hidden border-2 transition-all relative flex items-center justify-center bg-[#0C1A1A] ${
                  basemap === 'satellite'
                    ? 'border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.35)]'
                    : 'border-white/10 hover:border-white/30'
                }`}
              >
                <div className="w-full h-full p-1 bg-gradient-to-tr from-emerald-950 via-teal-900 to-sky-950 flex items-center justify-center">
                  <Globe2 className="w-7 h-7 text-emerald-300/80" />
                </div>
                {basemap === 'satellite' && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-cyan-400 text-black flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
              </div>
              <span
                className={`text-xs font-medium transition ${
                  basemap === 'satellite' ? 'text-cyan-400 font-semibold' : 'text-white/70 group-hover:text-white'
                }`}
              >
                Satellite
              </span>
            </button>

            {/* Card 3: Terrain */}
            <button
              type="button"
              onClick={() => onSelectBasemap('terrain')}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div
                className={`w-full aspect-[4/3] rounded-2xl overflow-hidden border-2 transition-all relative flex items-center justify-center bg-[#1C1815] ${
                  basemap === 'terrain'
                    ? 'border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.35)]'
                    : 'border-white/10 hover:border-white/30'
                }`}
              >
                <div className="w-full h-full p-1 bg-gradient-to-tr from-stone-900 to-amber-950/60 flex items-center justify-center">
                  <Mountain className="w-7 h-7 text-amber-300/80" />
                </div>
                {basemap === 'terrain' && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-cyan-400 text-black flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
              </div>
              <span
                className={`text-xs font-medium transition ${
                  basemap === 'terrain' ? 'text-cyan-400 font-semibold' : 'text-white/70 group-hover:text-white'
                }`}
              >
                Terrain
              </span>
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="my-3 mx-6 h-[1px] bg-white/10" />

        {/* 2. MAP DETAILS & CLIMATE / SAR LAYERS (Grid matching Google Maps) */}
        <div className="px-6 pb-6 pt-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white tracking-tight">Map details</h3>
            <span className="text-[10px] font-mono text-cyan-300">NISAR & Climate Layers</span>
          </div>

          <div className="grid grid-cols-4 gap-3 text-center">
            {/* Detail 1: NISAR SAR Swath */}
            <button
              type="button"
              onClick={() => onToggleLayer('showSarSwath')}
              className="flex flex-col items-center gap-1.5 group cursor-pointer"
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all ${
                  layers.showSarSwath
                    ? 'bg-cyan-950/70 border-cyan-400 text-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                }`}
              >
                <Activity className="w-6 h-6" />
              </div>
              <span className="text-[11px] leading-tight text-white/80 group-hover:text-white">
                NISAR Swath
              </span>
            </button>

            {/* Detail 2: DELTA-SAR Flood Mask */}
            <button
              type="button"
              onClick={() => onToggleLayer('showFloodMask')}
              className="flex flex-col items-center gap-1.5 group cursor-pointer"
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all ${
                  layers.showFloodMask
                    ? 'bg-sky-950/70 border-sky-400 text-sky-400 shadow-md shadow-sky-500/20'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                }`}
              >
                <div className="relative">
                  <Layers className="w-6 h-6" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                </div>
              </div>
              <span className="text-[11px] leading-tight text-white/80 group-hover:text-white">
                Flood Mask
              </span>
            </button>

            {/* Detail 2b: Scientific SAR (Blue) Mode */}
            <button
              type="button"
              onClick={() => onToggleLayer('sarIntensityMode')}
              className="flex flex-col items-center gap-1.5 group cursor-pointer"
              title="Grayscale microwave backscatter with monochromatic blue flood overlay"
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all ${
                  layers.sarIntensityMode
                    ? 'bg-blue-950/80 border-[#0055FF] text-[#3388FF] shadow-lg shadow-blue-500/30 ring-2 ring-[#0055FF]/40'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                }`}
              >
                <Radio className="w-6 h-6" />
              </div>
              <span className="text-[11px] leading-tight text-white/80 group-hover:text-white">
                Scientific SAR (Blue)
              </span>
            </button>

            {/* Detail 3: Air Quality (AQI) Climate Report */}
            <button
              type="button"
              onClick={() => onToggleLayer('showAqiClimate')}
              className="flex flex-col items-center gap-1.5 group cursor-pointer"
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all ${
                  layers.showAqiClimate
                    ? 'bg-emerald-950/70 border-emerald-400 text-emerald-400 shadow-md shadow-emerald-500/20'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                }`}
              >
                <Wind className="w-6 h-6" />
              </div>
              <span className="text-[11px] leading-tight text-white/80 group-hover:text-white">
                Air Quality
              </span>
            </button>

            {/* Detail 4: Public Transport & Evacuation Routes */}
            <button
              type="button"
              onClick={() => onToggleLayer('showEvacuationRoutes')}
              className="flex flex-col items-center gap-1.5 group cursor-pointer"
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all ${
                  layers.showEvacuationRoutes
                    ? 'bg-indigo-950/70 border-indigo-400 text-indigo-400 shadow-md shadow-indigo-500/20'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                }`}
              >
                <Bus className="w-6 h-6" />
              </div>
              <span className="text-[11px] leading-tight text-white/80 group-hover:text-white">
                Evac Routes
              </span>
            </button>

            {/* Detail 5: Monsoon Precipitation Radar */}
            <button
              type="button"
              onClick={() => onToggleLayer('showPrecipitation')}
              className="flex flex-col items-center gap-1.5 group cursor-pointer"
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all ${
                  layers.showPrecipitation
                    ? 'bg-blue-950/70 border-blue-400 text-blue-400 shadow-md shadow-blue-500/20'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                }`}
              >
                <CloudRain className="w-6 h-6" />
              </div>
              <span className="text-[11px] leading-tight text-white/80 group-hover:text-white">
                Rainfall
              </span>
            </button>

            {/* Detail 6: Flooded Mangrove Canopy (Double-Bounce) */}
            <button
              type="button"
              onClick={() => onToggleLayer('showMangroveFilter')}
              className="flex flex-col items-center gap-1.5 group cursor-pointer"
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all ${
                  layers.showMangroveFilter
                    ? 'bg-pink-950/70 border-pink-400 text-pink-400 shadow-md shadow-pink-500/20'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                }`}
              >
                <Trees className="w-6 h-6" />
              </div>
              <span className="text-[11px] leading-tight text-white/80 group-hover:text-white">
                Mangroves
              </span>
            </button>
          </div>

          {/* Opacity Slider for Overlay */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
            <span className="text-white/70">Flood Mask Opacity</span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={layers.floodMaskOpacity}
                onChange={(e) => onChangeOpacity(parseFloat(e.target.value))}
                className="w-24 accent-cyan-400 h-1 bg-white/20 rounded cursor-pointer"
              />
              <span className="font-mono text-cyan-300 tabular-nums w-8">
                {Math.round(layers.floodMaskOpacity * 100)}%
              </span>
            </div>
          </div>

          {/* Official ISRO NRSC DEM & LULC 2024-25 Ground-Truth Metadata Card */}
          <div className="pt-3 border-t border-white/10 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-cyan-300">
              <span className="flex items-center gap-1.5 font-bold">
                <Mountain className="w-3.5 h-3.5 text-amber-400" />
                ISRO NRSC DEM &amp; LULC 2024–25
              </span>
              <span className="text-[10px] text-white/50">{ISRO_DEM_LULC_METADATA_2024_25.spatialReference.scale} • WGS-84</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
              <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                <div className="text-white/40 uppercase text-[9px]">Classification Accuracy</div>
                <div className="font-bold text-emerald-400 mt-0.5">{ISRO_DEM_LULC_METADATA_2024_25.accuracy.overallClassificationAccuracy} (Kappa verified)</div>
              </div>
              <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                <div className="text-white/40 uppercase text-[9px]">Terrain Model Accuracy</div>
                <div className="font-bold text-cyan-400 mt-0.5">1-px Plains • 2–3 px TIN</div>
              </div>
            </div>

            <p className="text-[10px] text-white/60 leading-relaxed font-sans">
              Source: {ISRO_DEM_LULC_METADATA_2024_25.agency.organisation} (Bhuvan Thematic Services). Covers 68°E–98°E, 6°N–38°N with hybrid See5/MXL classifier across Tamil Nadu &amp; Assam.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
