'use client';

import React, { useState } from 'react';
import {
  X,
  CornerUpRight,
  MapPin,
  Navigation,
  Car,
  Shield,
} from 'lucide-react';
import type { RegionId } from '@/types/sar';

interface GoogleMapsDirectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRegion: RegionId;
}

export function GoogleMapsDirectionsModal({
  isOpen,
  onClose,
  currentRegion,
}: GoogleMapsDirectionsModalProps) {
  const isNag = currentRegion === 'nagapattinam';
  const [fromInput, setFromInput] = useState(
    isNag ? 'Nagapattinam Coastal Fishery Harbor' : 'Kamalabari Ferry Ghat'
  );
  const [toInput, setToInput] = useState(
    isNag ? 'Thiruvarur Central Flood Relief Embankment' : 'Garamur High-Altitude Refugee Mound'
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[#1E1F22] border border-white/10 rounded-3xl shadow-2xl overflow-hidden text-white font-sans animate-in zoom-in-95 duration-200 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-cyan-400 text-black flex items-center justify-center shadow-md">
              <CornerUpRight className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Emergency Evacuation Corridors
              </h2>
              <p className="text-[11px] text-white/50">NISAR Flood-Crossed Road Audit</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inputs */}
        <div className="p-6 space-y-4">
          <div className="space-y-2 bg-black/40 p-3.5 rounded-2xl border border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-cyan-400 shrink-0" />
              <input
                type="text"
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
                className="w-full bg-transparent text-xs text-white placeholder-white/40 focus:outline-none"
                placeholder="Starting location"
              />
            </div>
            <div className="ml-1.5 w-[2px] h-3 bg-white/20" />
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-red-400 shrink-0" />
              <input
                type="text"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                className="w-full bg-transparent text-xs text-white placeholder-white/40 focus:outline-none"
                placeholder="Evacuation shelter"
              />
            </div>
          </div>

          {/* No route analysis exists: the previous "SAFE • 28 MIN" / "IMPASSABLE"
              cards and "NDRF boats deployed" line were invented and are removed. */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">Route Evaluation</h3>
            <p className="text-[11px] text-white/60 leading-relaxed">
              Not available. No road network has been intersected with the change polygons, so this app cannot say
              which roads are passable. Use official district disaster-management advisories for routing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
