'use client';

import React from 'react';
import {
  Layers,
  Compass,
  Navigation,
  Plus,
  Minus,
  Eye,
  EyeOff,
  CornerUpRight,
  Maximize2,
} from 'lucide-react';

interface GoogleMapsActionControlsProps {
  onOpenLayersModal: () => void;
  onRecenter: () => void;
  onResetNorth: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onOpenDirections: () => void;
  isUiHidden: boolean;
  onToggleHideUi: () => void;
  is3D?: boolean;
  onToggle3D?: () => void;
}

export function GoogleMapsActionControls({
  onOpenLayersModal,
  onRecenter,
  onResetNorth,
  onZoomIn,
  onZoomOut,
  onOpenDirections,
  isUiHidden,
  onToggleHideUi,
  is3D = false,
  onToggle3D,
}: GoogleMapsActionControlsProps) {
  return (
    <div className="flex flex-col items-center gap-2.5 pointer-events-auto select-none">
      {/* 1. LAYERS BUTTON (Stacked Diamonds icon matching Google Maps) */}
      <button
        onClick={onOpenLayersModal}
        className="w-10 h-10 rounded-full bg-[#1E1F22]/95 hover:bg-[#2A2B2F] border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.6)] flex items-center justify-center text-white/80 hover:text-cyan-300 transition-all cursor-pointer group"
        title="Map type & details"
      >
        <Layers className="w-5 h-5 group-hover:scale-110 transition-transform" />
      </button>

      {/* 2. HIDE UI / CLEAN MAP BUTTON (Requested by user) */}
      <button
        onClick={onToggleHideUi}
        className={`w-10 h-10 rounded-full border shadow-[0_4px_20px_rgba(0,0,0,0.6)] flex items-center justify-center transition-all cursor-pointer group ${
          isUiHidden
            ? 'bg-cyan-500 text-black border-cyan-400 font-bold'
            : 'bg-[#1E1F22]/95 hover:bg-[#2A2B2F] text-white/80 hover:text-cyan-300 border-white/10'
        }`}
        title={isUiHidden ? 'Show UI Overlays' : 'Hide UI (Clean Map View)'}
      >
        {isUiHidden ? (
          <Eye className="w-5 h-5" />
        ) : (
          <EyeOff className="w-5 h-5 group-hover:scale-110 transition-transform" />
        )}
      </button>

      {/* 2b. 3D DEM TERRAIN TOGGLE BUTTON (Animates to 75° pitch & 25° bearing) */}
      <button
        onClick={onToggle3D}
        className={`w-10 h-10 rounded-full border shadow-[0_4px_20px_rgba(0,0,0,0.6)] flex items-center justify-center transition-all cursor-pointer group ${
          is3D
            ? 'bg-gradient-to-tr from-cyan-600 to-blue-600 text-white border-cyan-400 font-bold shadow-[0_0_15px_rgba(0,240,255,0.5)] ring-2 ring-cyan-400/40'
            : 'bg-[#1E1F22]/95 hover:bg-[#2A2B2F] text-white/80 hover:text-cyan-300 border-white/10'
        }`}
        title={is3D ? 'Flatten View (2D Nadir)' : 'Enable Extreme 3D DEM Terrain (75° Pitch)'}
      >
        <span className="text-xs font-black tracking-tight font-mono">3D</span>
      </button>

      {/* 3. COMPASS / RESET NORTH */}
      <button
        onClick={onResetNorth}
        className="w-10 h-10 rounded-full bg-[#1E1F22]/95 hover:bg-[#2A2B2F] border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.6)] flex items-center justify-center text-white/80 hover:text-cyan-300 transition-all cursor-pointer group"
        title="Reset North orientation"
      >
        <Compass className="w-5 h-5 text-red-400 group-hover:scale-110 transition-transform" />
      </button>

      {/* 4. RECENTER / MY LOCATION BUTTON */}
      <button
        onClick={onRecenter}
        className="w-10 h-10 rounded-full bg-[#1E1F22]/95 hover:bg-[#2A2B2F] border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.6)] flex items-center justify-center text-white/80 hover:text-cyan-300 transition-all cursor-pointer group"
        title="Re-center on active SAR Swath"
      >
        <Navigation className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
      </button>

      {/* 5. ZOOM IN / ZOOM OUT STACK */}
      <div className="flex flex-col rounded-2xl bg-[#1E1F22]/95 border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.6)] overflow-hidden">
        <button
          onClick={onZoomIn}
          className="w-10 h-9 hover:bg-[#2A2B2F] text-white/70 hover:text-white flex items-center justify-center transition border-b border-white/10 cursor-pointer"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={onZoomOut}
          className="w-10 h-9 hover:bg-[#2A2B2F] text-white/70 hover:text-white flex items-center justify-center transition cursor-pointer"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* 6. GOOGLE MAPS DIRECTIONS FAB (Cyan circle matching image 2 in zip) */}
      <button
        onClick={onOpenDirections}
        className="w-12 h-12 rounded-2xl bg-[#00E5FF] hover:bg-[#33EAFF] text-black shadow-[0_6px_25px_rgba(0,229,255,0.4)] flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 cursor-pointer mt-1"
        title="Evacuation & Transport Directions"
      >
        <CornerUpRight className="w-6 h-6 stroke-[2.5]" />
      </button>
    </div>
  );
}
