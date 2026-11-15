'use client';

import React, { useState } from 'react';
import {
  X,
  CloudRain,
  Wind,
  Thermometer,
  Droplets,
  AlertTriangle,
  ShieldCheck,
  Activity,
  Gauge,
  Sun,
  BarChart3,
} from 'lucide-react';
import type { ClimateData } from '@/types/google-maps';
import type { RegionId } from '@/types/sar';
import { ClimateTab } from './ClimateTab';

interface GoogleMapsClimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  climate: ClimateData;
  regionName: string;
  regionId: RegionId;
}

export function GoogleMapsClimateModal({
  isOpen,
  onClose,
  climate,
  regionName,
  regionId,
}: GoogleMapsClimateModalProps) {
  const [activeTab, setActiveTab] = useState<'power' | 'aqi'>('power');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-[#1E1F22] border border-white/10 rounded-3xl shadow-2xl overflow-hidden text-white font-sans animate-in zoom-in-95 duration-200 select-none flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
              <CloudRain className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                NASA Climate & Atmosphere Center
              </h2>
              <p className="text-[11px] text-white/50">{regionName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-white/10 bg-black/30 text-xs font-semibold px-6 shrink-0">
          <button
            onClick={() => setActiveTab('power')}
            className={`py-2.5 px-4 flex items-center gap-2 transition border-b-2 cursor-pointer ${
              activeTab === 'power'
                ? 'border-cyan-400 text-cyan-400 font-bold'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>NASA POWER Daily Precipitation & Temp</span>
          </button>
          <button
            onClick={() => setActiveTab('aqi')}
            className={`py-2.5 px-4 flex items-center gap-2 transition border-b-2 cursor-pointer ${
              activeTab === 'aqi'
                ? 'border-emerald-400 text-emerald-400 font-bold'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Wind className="w-4 h-4" />
            <span>Air Quality (AQI) & Flood Alert</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {activeTab === 'power' ? (
            <ClimateTab regionId={regionId} regionName={regionName} climate={climate} />
          ) : (
            <div className="space-y-4">
              {/* Highlight Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Temperature */}
                <div className="p-4 rounded-2xl bg-black/40 border border-white/10 relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs text-white/60 mb-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Thermometer className="w-4 h-4 text-amber-400" />
                      Temperature
                    </span>
                    <span className="text-[10px] text-amber-400/80 font-mono">LIVE</span>
                  </div>
                  <div className="text-3xl font-extrabold text-white tracking-tight font-mono">
                    {climate.tempC}°C
                  </div>
                  <div className="text-xs text-white/50 mt-1 flex items-center justify-between">
                    <span>Feels like {climate.feelsLikeC}°C</span>
                    <span className="text-cyan-300 font-medium">{climate.condition}</span>
                  </div>
                </div>

                {/* AQI */}
                <div className="p-4 rounded-2xl bg-black/40 border border-white/10 relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs text-white/60 mb-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Gauge className="w-4 h-4 text-emerald-400" />
                      Air Quality Index
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">NAQI</span>
                  </div>
                  <div className="text-3xl font-extrabold text-emerald-400 tracking-tight flex items-baseline gap-2 font-mono">
                    <span>{climate.aqi}</span>
                    <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wide">
                      {climate.aqi <= 50 ? 'Good' : climate.aqi <= 100 ? 'Moderate' : 'Poor'}
                    </span>
                  </div>
                  <div className="text-[11px] text-white/50 mt-1 truncate">
                    {climate.aqiStatus}
                  </div>
                </div>
              </div>

              {/* Weather parameters */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  Hydro-Meteorological Telemetry
                </h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <div className="flex items-center justify-center gap-1 text-[11px] text-white/50 mb-0.5">
                      <CloudRain className="w-3.5 h-3.5 text-blue-400" />
                      <span>Rainfall 24h</span>
                    </div>
                    <div className="text-sm font-bold text-blue-300 font-mono">
                      {climate.precipitationMm} mm
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <div className="flex items-center justify-center gap-1 text-[11px] text-white/50 mb-0.5">
                      <Droplets className="w-3.5 h-3.5 text-sky-400" />
                      <span>Humidity</span>
                    </div>
                    <div className="text-sm font-bold text-sky-300 font-mono">
                      {climate.humidity}%
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <div className="flex items-center justify-center gap-1 text-[11px] text-white/50 mb-0.5">
                      <Wind className="w-3.5 h-3.5 text-teal-400" />
                      <span>Wind Speed</span>
                    </div>
                    <div className="text-sm font-bold text-teal-300 font-mono">
                      {climate.windKmh} km/h
                    </div>
                  </div>
                </div>
              </div>

              {/* Flood Risk Warning */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950/40 via-amber-950/30 to-black/40 border border-amber-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Delta Inundation Alert Stage
                    </h4>
                    <p className="text-[11px] text-white/60">
                      Runoff combined with tidal backwater barrier
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-red-500/30 text-red-300 border border-red-400/50">
                  {climate.floodRisk}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
