'use client';

import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  ChevronUp,
  ChevronDown,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Shield,
  Layers,
  Radio,
  CloudRain,
} from 'lucide-react';
import type { SummaryMetrics } from '@/types/sar';
import { ClimateTab } from './ClimateTab';

interface BottomDrawerProps {
  metrics: SummaryMetrics;
  isOpen: boolean;
  onToggle: () => void;
  activeTab?: 'charts' | 'climate' | 'methodology';
}

export function BottomDrawer({ metrics, isOpen, onToggle, activeTab = 'charts' }: BottomDrawerProps) {
  const [tab, setTab] = useState<'charts' | 'climate' | 'methodology'>(activeTab);

  React.useEffect(() => {
    setTab(activeTab);
  }, [activeTab]);

  const backscatterChartData = [
    {
      name: 'Class 0: Stable Land',
      preHH: -11.5,
      postHH: -11.5,
      delta: 0.0,
      area: metrics.classes['0']?.area_km2 || 0,
      color: '#475569',
    },
    {
      name: 'Class 1: Open Flood',
      preHH: -10.8,
      postHH: -17.5,
      delta: -6.7,
      area: metrics.classes['1']?.area_km2 || 0,
      color: '#00E5FF',
    },
    {
      name: 'Class 2: Flooded Canopy',
      preHH: -8.2,
      postHH: -4.5,
      delta: +3.7,
      area: metrics.classes['2']?.area_km2 || 0,
      color: '#FF2E93',
    },
    {
      name: 'Class 3: Managed Paddy',
      preHH: -11.0,
      postHH: -14.2,
      delta: -3.2,
      area: metrics.classes['3']?.area_km2 || 0,
      color: '#10B981',
    },
    {
      name: 'Class 4: Wetland Drying',
      preHH: -16.5,
      postHH: -10.2,
      delta: +6.3,
      area: metrics.classes['4']?.area_km2 || 0,
      color: '#FFB800',
    },
  ];

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 bg-[#030712]/90 backdrop-blur-2xl border-t border-white/10 text-white/90 transition-all duration-300 shadow-[0_0_40px_rgba(0,0,0,0.85)] rounded-t-3xl ${
        isOpen ? 'h-96' : 'h-11'
      }`}
    >
      {/* Drawer Header Handle */}
      <div
        className="h-11 px-5 flex items-center justify-between border-b border-white/10 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="p-1 rounded-lg text-white/50 hover:text-white"
          >
            {isOpen ? <ChevronDown className="w-4 h-4 text-cyan-400" /> : <ChevronUp className="w-4 h-4 text-cyan-400" />}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 uppercase tracking-wider">
              Scientific Analytics &amp; Methodology
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-cyan-300 border border-white/10">
              NISAR L2 GCOV (24 cm λ)
            </span>
          </div>
        </div>

        {/* Tab switchers in header */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              setTab('charts');
              if (!isOpen) onToggle();
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              tab === 'charts' && isOpen
                ? 'bg-white/20 text-white shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Backscatter Analytics</span>
          </button>

          <button
            onClick={() => {
              setTab('climate');
              if (!isOpen) onToggle();
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              tab === 'climate' && isOpen
                ? 'bg-white/20 text-white shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <CloudRain className="w-3.5 h-3.5 text-sky-400" />
            <span>NASA POWER Climate</span>
          </button>

          <button
            onClick={() => {
              setTab('methodology');
              if (!isOpen) onToggle();
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              tab === 'methodology' && isOpen
                ? 'bg-white/20 text-white shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Algorithm &amp; Attribution</span>
          </button>
        </div>
      </div>

      {/* Drawer Body (Visible when open) */}
      {isOpen && (
        <div className="h-[calc(100%-2.75rem)] overflow-y-auto p-4 bg-[#050811]">
          {tab === 'charts' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
              {/* Chart 1: Pre vs Post HH Backscatter (dB) */}
              <div className="p-3 rounded-xl bg-[#0B1120] border border-sky-500/20 flex flex-col h-64">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-300">
                    Pre vs. Post L-Band HH Backscatter Shift (γ⁰ dB)
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono">Lee 5x5 Filtered (L=4.15)</span>
                </div>
                <div className="flex-1 w-full text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={backscatterChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={0} angle={-15} textAnchor="end" />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[-22, 0]} unit=" dB" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0b1220',
                          borderColor: '#38bdf8',
                          borderRadius: '8px',
                          fontSize: '11px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                      <Bar dataKey="preHH" name="Pre-Event HH (dB)" fill="#64748b" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="postHH" name="Post-Event HH (dB)" fill="#00e5ff" radius={[3, 3, 0, 0]}>
                        {backscatterChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Total Inundated Surface Area (km²) */}
              <div className="p-3 rounded-xl bg-[#0B1120] border border-sky-500/20 flex flex-col h-64">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-300">
                    Surface Area Distribution by DELTA-SAR Class (km²)
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono">Total: {metrics.total_swath_area_km2} km²</span>
                </div>
                <div className="flex-1 w-full text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={backscatterChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={0} angle={-15} textAnchor="end" />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} unit=" km²" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0b1220',
                          borderColor: '#38bdf8',
                          borderRadius: '8px',
                          fontSize: '11px',
                        }}
                      />
                      <Bar dataKey="area" name="Class Footprint (km²)" fill="#10b981" radius={[3, 3, 0, 0]}>
                        {backscatterChartData.map((entry, index) => (
                          <Cell key={`cell-area-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : tab === 'climate' ? (
            /* Live NASA POWER Climate Tab */
            <div className="h-full">
              <ClimateTab regionId={metrics.region_id} />
            </div>
          ) : (
            /* Methodology & Attribution Tab */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
              {/* Col 1: Radar Physics Advantage */}
              <div className="p-3.5 rounded-xl bg-[#0B1120] border border-sky-500/20 space-y-2">
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs border-b border-sky-500/20 pb-1.5">
                  <Radio className="w-4 h-4 text-cyan-400" />
                  <span>Why NISAR L-Band (24 cm λ)?</span>
                </div>
                <p className="leading-relaxed text-[11px] text-slate-300">
                  Unlike optical satellites (blinded by clouds) and C-band radar (e.g. Sentinel-1, λ=5.6 cm, which scatters off the top of tree leaves), NISAR&apos;s <strong>1.25 GHz L-band microwave pulse (24 cm wavelength)</strong> penetrates dense tropical foliage, bamboo, and mangrove canopies.
                </p>
                <p className="leading-relaxed text-[11px] text-slate-300">
                  When standing water floods beneath trees, the water surface and vertical trunks act as a <strong>dihedral corner reflector</strong>, producing an intense <strong>double-bounce signal surge (ΔHH ≥ +2.5 dB)</strong>, exposing hidden under-canopy inundation.
                </p>
              </div>

              {/* Col 2: DELTA-SAR v2.0 Algorithm */}
              <div className="p-3.5 rounded-xl bg-[#0B1120] border border-sky-500/20 space-y-2">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs border-b border-sky-500/20 pb-1.5">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>DELTA-SAR v2.0 Architecture</span>
                </div>
                <ul className="space-y-1.5 text-[11px] text-slate-300">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>5x5 Lee Filter:</strong> Multiplicative speckle filtering in linear power domain (ENL ≈ 4.15).</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Specular Extinction:</strong> ΔHH ≤ -3.5 dB &amp; post_HH &lt; -14.0 dB flags open flood surfaces.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Geometry Lock:</strong> Matches identical Relative Orbit Track and Frame Number to eliminate look-angle distortion.</span>
                  </li>
                </ul>
              </div>

              {/* Col 3: Attribution & Data Sources */}
              <div className="p-3.5 rounded-xl bg-[#0B1120] border border-sky-500/20 space-y-2">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-xs border-b border-sky-500/20 pb-1.5">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span>NASA–ISRO Science Collaboration</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Developed for the <strong>NASA Space Apps Challenge 2026</strong> (&ldquo;Dancing with the SARs&rdquo;).
                </p>
                <div className="space-y-1 text-[10px] font-mono text-slate-400 border-t border-sky-500/20 pt-1.5">
                  <div>• NASA Jet Propulsion Laboratory (JPL) — NISAR L2 GCOV</div>
                  <div>• ISRO NRSC Balanagar — LULC &amp; DEM 2024–25 (AWiFS, 1:250,000)</div>
                  <div>• Spheroid / Datum: GCS WGS-1984 (68°E–98°E, 6°N–38°N)</div>
                  <div>• Terrain Modeling: 1-px Plain Polynomial / 2–3 px Hilly TIN</div>
                  <div>• Ground-Truth Accuracy: 90.07% (Kappa Co-efficients Verified)</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
