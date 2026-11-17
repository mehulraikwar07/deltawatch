'use client';

import React, { useState } from 'react';
import {
  Satellite,
  BookOpen,
  Calendar,
  ChevronDown,
  Navigation,
  Sliders,
  Check,
} from 'lucide-react';
import type { RegionId, AvailableScenesCatalog, ScenePair } from '@/types/sar';

export type CompareMode = 'before' | 'animate' | 'after';

interface MissionHeaderProps {
  currentRegion: RegionId;
  onSelectRegion: (id: RegionId) => void;
  catalog: AvailableScenesCatalog | null;
  activePair: ScenePair | null;
  onSelectPair?: (pairId: string) => void;
  onFlyToSwath: () => void;
  compareMode: CompareMode;
  onSelectCompareMode: (mode: CompareMode) => void;
  onOpenMethodology: () => void;
}

export function MissionHeader({
  currentRegion,
  onSelectRegion,
  catalog,
  activePair,
  onSelectPair,
  onFlyToSwath,
  compareMode,
  onSelectCompareMode,
  onOpenMethodology,
}: MissionHeaderProps) {
  const [showPairDropdown, setShowPairDropdown] = useState(false);

  const regionData = catalog?.regions[currentRegion];
  const pairs = regionData?.pairs || [];

  return (
    <header className="h-16 px-6 bg-[#060913]/90 backdrop-blur-xl border-b border-indigo-500/20 flex items-center justify-between text-white/90 z-30 shrink-0 select-none shadow-2xl relative">
      {/* ZONE 1 (LEFT): Glowing Brand Mark + Subtle Sensor Pill */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-cyan-950/40 border border-cyan-400/40 shadow-lg shadow-cyan-500/20">
          <Satellite className="w-5 h-5 text-cyan-400 animate-pulse" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-base font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 drop-shadow-[0_0_16px_rgba(0,240,255,0.4)]">
            DELTAWATCH
          </span>
          <span className="text-[10px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-white/5 text-cyan-300/90 border border-white/10 hidden sm:inline">
            NISAR L-Band SAR
          </span>
        </div>
      </div>

      {/* ZONE 2 (CENTER): Region Switcher + Integrated Event Date Pair Dropdown */}
      <div className="flex items-center gap-3">
        {/* Sleek Segmented Region Switcher */}
        <div className="flex items-center bg-[#090D1A] border border-white/15 rounded-xl p-1 shadow-inner gap-1">
          <button
            onClick={() => onSelectRegion('nagapattinam')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentRegion === 'nagapattinam'
                ? 'bg-gradient-to-r from-cyan-500/25 to-blue-500/25 border border-cyan-400/60 text-white shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            Nagapattinam Delta
          </button>
          <button
            onClick={() => onSelectRegion('majuli')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentRegion === 'majuli'
                ? 'bg-gradient-to-r from-cyan-500/25 to-blue-500/25 border border-cyan-400/60 text-white shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            Majuli Brahmaputra
          </button>
        </div>

        {/* Integrated Event Date Pair Dropdown */}
        {pairs.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowPairDropdown(!showPairDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#090D1A] border border-white/15 text-xs text-white/80 hover:text-white hover:border-cyan-400/40 transition-all shadow-sm"
            >
              <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="font-mono text-[11px] truncate max-w-[210px] text-white/90">
                {activePair ? activePair.label.split('(')[0].trim() : 'Event Timeline'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${showPairDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showPairDropdown && (
              <div className="absolute top-full left-0 mt-2 w-80 rounded-2xl bg-[#070B16]/95 border border-white/15 shadow-[0_12px_36px_rgba(0,0,0,0.8)] backdrop-blur-2xl p-1.5 z-50 text-xs">
                <div className="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider text-white/40 border-b border-white/10 mb-1">
                  NISAR Co-Registered Orbit Pairs
                </div>
                {pairs.map((p) => {
                  const isSelected = p.id === activePair?.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (onSelectPair) onSelectPair(p.id);
                        setShowPairDropdown(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start justify-between gap-2 mb-0.5 ${
                        isSelected
                          ? 'bg-cyan-500/20 border border-cyan-400/50 text-white'
                          : 'hover:bg-white/5 text-white/70 hover:text-white'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-[11px] text-white/95 leading-tight">{p.label}</div>
                        <div className="text-[10px] font-mono text-cyan-300/80">
                          {p.before.date.split('T')[0]} &rarr; {p.after.date.split('T')[0]}
                        </div>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ZONE 3 (RIGHT): Fly to Swath + Compare Mode + Methodology Trigger */}
      <div className="flex items-center gap-2.5">
        {/* Instant Camera Reset to Swath Bounding Box */}
        <button
          onClick={onFlyToSwath}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#090D1A] hover:bg-white/10 text-white/80 hover:text-cyan-300 border border-white/15 transition-all text-xs font-medium cursor-pointer shadow-sm"
          title="Reset map view to the exact NISAR SAR bounding box"
        >
          <Navigation className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden xl:inline text-[11px]">Fly to Swath</span>
        </button>

        {/* Compare Mode Segmented Quick-Toggle */}
        <div className="flex items-center bg-[#090D1A] border border-white/15 rounded-xl p-0.5 shadow-inner">
          <button
            onClick={() => onSelectCompareMode('before')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
              compareMode === 'before'
                ? 'bg-white/20 text-white font-semibold shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            Before
          </button>
          <button
            onClick={() => onSelectCompareMode('animate')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
              compareMode === 'animate'
                ? 'bg-cyan-500/25 border border-cyan-400/50 text-cyan-200 font-semibold shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            50/50 Split
          </button>
          <button
            onClick={() => onSelectCompareMode('after')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
              compareMode === 'after'
                ? 'bg-white/20 text-white font-semibold shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            After + Flood
          </button>
        </div>

        {/* Methodology Trigger */}
        <button
          onClick={onOpenMethodology}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-white/80 hover:text-white border border-white/15 transition-all text-xs font-medium cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline text-[11px]">Methodology</span>
        </button>
      </div>
    </header>
  );
}
