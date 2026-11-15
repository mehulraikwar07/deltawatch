'use client';

import React from 'react';
import {
  Compass,
  Layers,
  Sparkles,
  Wind,
  Navigation,
  ChevronUp,
  ChevronDown,
  Activity,
  Droplets,
  Share2,
} from 'lucide-react';
import type { ClimateData, SearchPlace } from '@/types/google-maps';
import type { SummaryMetrics } from '@/types/sar';

interface GoogleMapsBottomCardProps {
  metrics: SummaryMetrics;
  climate: ClimateData;
  activePlace: SearchPlace | null;
  activeNavTab: 'explore' | 'evidence' | 'report' | 'climate';
  onSelectNavTab: (tab: 'explore' | 'evidence' | 'report' | 'climate') => void;
  onOpenClimateModal: () => void;
  onOpenDirections: () => void;
}

export function GoogleMapsBottomCard({
  metrics,
  climate,
  activePlace,
  activeNavTab,
  onSelectNavTab,
  onOpenClimateModal,
  onOpenDirections,
}: GoogleMapsBottomCardProps) {
  const title = activePlace ? activePlace.name : metrics.region_name;
  const subtitle = activePlace
    ? `${activePlace.description.slice(0, 50)}... • ${activePlace.floodStatus}`
    : `${metrics.flood_event} • Swath: ${metrics.total_swath_area_km2} km² • Track ${metrics.orbit_track}`;

  return (
    <div className="w-full max-w-lg bg-[#1E1F22]/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_16px_50px_rgba(0,0,0,0.85)] text-white font-sans overflow-hidden pointer-events-auto select-none transition-all">
      {/* 1. LOCATION & REAL-TIME WEATHER / AQI HEADER (Matching Google Maps mobile bottom card) */}
      <div className="px-5 pt-3.5 pb-2.5 flex items-center justify-between border-b border-white/5">
        <div className="flex-1 pr-2 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-white truncate tracking-tight">
              {title}
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-400/30 shrink-0">
              NISAR L2
            </span>
          </div>
          <p className="text-[11px] text-white/50 truncate mt-0.5">
            {subtitle}
          </p>
        </div>

        {/* Real-time Weather & AQI Pill (Exact Match with Image 2 in zip) */}
        <button
          onClick={onOpenClimateModal}
          className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-black/40 hover:bg-black/60 border border-white/10 hover:border-cyan-400/40 transition shrink-0 cursor-pointer group"
          title="Open Climate, Weather & Air Quality Report"
        >
          <div className="flex items-center gap-1 text-xs font-bold text-white/90">
            <span className="text-sm">🌧️</span>
            <span>{climate.tempC}°</span>
          </div>
          <div className="w-[1px] h-3 bg-white/20" />
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
            <span>{climate.aqi} AQI</span>
          </div>
        </button>
      </div>

      {/* 2. GOOGLE MAPS BOTTOM NAVIGATION TABS (Explore, Evidence, AI Report, Climate) */}
      <div className="grid grid-cols-4 border-t border-white/5 bg-black/20 text-center py-1">
        {/* Tab 1: Explore */}
        <button
          onClick={() => onSelectNavTab('explore')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 transition cursor-pointer group ${
            activeNavTab === 'explore' ? 'text-cyan-400' : 'text-white/50 hover:text-white'
          }`}
        >
          <div
            className={`w-10 h-7 rounded-full flex items-center justify-center mb-0.5 transition ${
              activeNavTab === 'explore' ? 'bg-cyan-950/80' : 'group-hover:bg-white/5'
            }`}
          >
            <Compass className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-medium tracking-tight">Explore</span>
        </button>

        {/* Tab 2: Evidence Inspector */}
        <button
          onClick={() => onSelectNavTab('evidence')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 transition cursor-pointer group ${
            activeNavTab === 'evidence' ? 'text-cyan-400' : 'text-white/50 hover:text-white'
          }`}
        >
          <div
            className={`w-10 h-7 rounded-full flex items-center justify-center mb-0.5 transition ${
              activeNavTab === 'evidence' ? 'bg-cyan-950/80' : 'group-hover:bg-white/5'
            }`}
          >
            <Activity className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-medium tracking-tight">Evidence</span>
        </button>

        {/* Tab 3: AI Science Report */}
        <button
          onClick={() => onSelectNavTab('report')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 transition cursor-pointer group ${
            activeNavTab === 'report' ? 'text-cyan-400' : 'text-white/50 hover:text-white'
          }`}
        >
          <div
            className={`w-10 h-7 rounded-full flex items-center justify-center mb-0.5 transition ${
              activeNavTab === 'report' ? 'bg-cyan-950/80' : 'group-hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-medium tracking-tight">AI Report</span>
        </button>

        {/* Tab 4: Climate & AQI */}
        <button
          onClick={() => {
            onSelectNavTab('climate');
            onOpenClimateModal();
          }}
          className={`flex flex-col items-center justify-center py-1.5 px-1 transition cursor-pointer group ${
            activeNavTab === 'climate' ? 'text-cyan-400' : 'text-white/50 hover:text-white'
          }`}
        >
          <div
            className={`w-10 h-7 rounded-full flex items-center justify-center mb-0.5 transition ${
              activeNavTab === 'climate' ? 'bg-cyan-950/80' : 'group-hover:bg-white/5'
            }`}
          >
            <Wind className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-medium tracking-tight">Climate</span>
        </button>
      </div>
    </div>
  );
}
