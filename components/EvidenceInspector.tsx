'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Droplets,
  Trees,
  Wheat,
  Sun,
  Crosshair,
  Sparkles,
  Compass,
  ArrowDownRight,
  ArrowUpRight,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import type { SummaryMetrics, EvidencePolygonProperties } from '@/types/sar';
import { AiReportTab } from './AiReportTab';
import { DASH, fmtDb, fmtLatLng, fmtNum, fmtPct, fmtPct01, normalizePolygonProps } from '@/lib/metrics';

interface EvidenceInspectorProps {
  metrics: SummaryMetrics;
  selectedPolygon: EvidencePolygonProperties | null;
  onSelectPolygon?: (poly: EvidencePolygonProperties) => void;
  onFocusPolygon?: (coords: [number, number]) => void;
}

export function EvidenceInspector({
  metrics,
  selectedPolygon,
  onSelectPolygon,
  onFocusPolygon,
}: EvidenceInspectorProps) {
  const [activeTab, setActiveTab] = useState<'evidence' | 'report'>('evidence');
  const [evidencePolys, setEvidencePolys] = useState<EvidencePolygonProperties[]>([]);

  // Load polygons so KPI cards can select and zoom to the largest polygon of that class
  useEffect(() => {
    let isMounted = true;
    fetch(`/processed/${metrics.region_id}/evidence_polygons.geojson?v=${Date.now()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted || !data.features) return;
        const polys = data.features.map((f: { properties?: Record<string, unknown> }) =>
          normalizePolygonProps(f.properties ?? {})
        );
        setEvidencePolys(polys);
      })
      .catch((err) => console.warn('[EvidenceInspector] polygons fetch failed:', err));
    return () => {
      isMounted = false;
    };
  }, [metrics.region_id]);

  const handleSelectClassLargest = (classId: number) => {
    const matching = evidencePolys.filter((p) => p.class_id === classId);
    if (matching.length > 0) {
      const largest = matching.reduce((prev, curr) =>
        Number(curr.area_km2) > Number(prev.area_km2) ? curr : prev
      );
      if (onSelectPolygon) onSelectPolygon(largest);
      if (onFocusPolygon && largest.centroid) onFocusPolygon(largest.centroid);
    }
  };

  const c1 = metrics.classes['1'] ?? { area_km2: null, percentage: null };
  const c2 = metrics.classes['2'] ?? { area_km2: null, percentage: null };
  const c3 = metrics.classes['3'] ?? { area_km2: null, percentage: null };
  const c4 = metrics.classes['4'] ?? { area_km2: null, percentage: null };

  // No invented demo target: show an empty placeholder until the user selects a polygon.
  const activePoly: EvidencePolygonProperties = selectedPolygon || {
    id: DASH,
    class_id: -1,
    class_name: 'No polygon selected',
    area_km2: null,
    area_hectares: null,
    before_hh_db: null,
    after_hh_db: null,
    delta_hh_db: null,
    confidence: null,
    centroid: null,
    driver_hypothesis: null,
    radar_band: null,
    geometry_lock: null,
  };

  const getClassBadgeStyle = (classId: number) => {
    switch (classId) {
      case 1:
        return 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/40 shadow-sm';
      case 2:
        return 'bg-[#FF2E93]/20 text-[#FF2E93] border-[#FF2E93]/40 shadow-sm';
      case 3:
        return 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40 shadow-sm';
      case 4:
        return 'bg-[#FFB800]/20 text-[#FFB800] border-[#FFB800]/40 shadow-sm';
      default:
        return 'bg-white/10 text-white/70 border-white/10';
    }
  };

  return (
    <aside className="w-[420px] h-full flex flex-col bg-[#030712]/75 backdrop-blur-2xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.8)] rounded-2xl p-5 text-white/90 overflow-hidden select-none shrink-0">
      {/* Top Segmented Tabs */}
      <div className="flex bg-black/60 border border-white/10 rounded-xl p-1 gap-1 shrink-0 mb-3.5">
        <button
          onClick={() => setActiveTab('evidence')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'evidence'
              ? 'text-white bg-white/20 shadow-sm font-semibold'
              : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span>Swath Telemetry</span>
        </button>

        <button
          onClick={() => setActiveTab('report')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'report'
              ? 'text-white bg-white/20 shadow-sm font-semibold'
              : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>AI Science Report</span>
        </button>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto space-y-3.5 min-h-0 pr-1">
        {activeTab === 'report' ? (
          <AiReportTab metrics={metrics} selectedPolygon={selectedPolygon} />
        ) : (
          <>
            {/* 2x2 Clean Interactive KPI Stat Cards */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                  Swath Classification Footprint
                </span>
                <span className="text-[10px] font-mono tabular-nums text-cyan-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
                  Total: {metrics.total_swath_area_km2} km²
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {/* KPI 1: Open Floodwater (Interactive) */}
                <div
                  onClick={() => handleSelectClassLargest(1)}
                  className="p-3 rounded-xl bg-gradient-to-b from-cyan-500/20 via-[#090D1A]/80 to-[#090D1A]/90 border-t-2 border-cyan-400 border-x border-b border-cyan-500/30 text-cyan-300 shadow-[0_4px_20px_rgba(0,240,255,0.1)] hover:border-cyan-400 hover:shadow-[0_0_24px_rgba(0,240,255,0.25)] transition-all cursor-pointer relative overflow-hidden group"
                  title="Click to zoom map to largest Open Flood zone"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-cyan-300 flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-cyan-400" />
                      Open Flood
                    </span>
                    <span className="text-[10px] font-mono tabular-nums font-bold text-cyan-400">{fmtPct(c1.percentage)}</span>
                  </div>
                  <div className="text-xl font-black font-mono tabular-nums text-white">
                    {fmtNum(c1.area_km2, 2)} <span className="text-xs font-normal text-white/40">km²</span>
                  </div>
                  <div className="text-[9px] text-cyan-300/80 flex items-center gap-1 mt-1 font-mono tabular-nums">
                    <ArrowDownRight className="w-3 h-3 text-cyan-400" />
                    <span>ΔHH ≤ -3.5 dB &bull; Zoom</span>
                  </div>
                </div>

                {/* KPI 2: Flooded Canopy (Interactive) */}
                <div
                  onClick={() => handleSelectClassLargest(2)}
                  className="p-3 rounded-xl bg-gradient-to-b from-pink-500/20 via-[#090D1A]/80 to-[#090D1A]/90 border-t-2 border-pink-400 border-x border-b border-pink-500/30 text-pink-300 shadow-[0_4px_20px_rgba(255,46,147,0.1)] hover:border-pink-400 hover:shadow-[0_0_24px_rgba(255,46,147,0.25)] transition-all cursor-pointer relative overflow-hidden group"
                  title="Click to zoom map to largest Flooded Canopy zone"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-pink-300 flex items-center gap-1">
                      <Trees className="w-3 h-3 text-pink-400" />
                      Flooded Canopy
                    </span>
                    <span className="text-[10px] font-mono tabular-nums font-bold text-pink-400">{fmtPct(c2.percentage)}</span>
                  </div>
                  <div className="text-xl font-black font-mono tabular-nums text-white">
                    {fmtNum(c2.area_km2, 2)} <span className="text-xs font-normal text-white/40">km²</span>
                  </div>
                  <div className="text-[9px] text-pink-300/80 flex items-center gap-1 mt-1 font-mono tabular-nums">
                    <ArrowUpRight className="w-3 h-3 text-pink-400" />
                    <span>ΔHH ≥ +2.5 dB &bull; Zoom</span>
                  </div>
                </div>

                {/* KPI 3: Managed Paddy (Interactive) */}
                <div
                  onClick={() => handleSelectClassLargest(3)}
                  className="p-3 rounded-xl bg-gradient-to-b from-emerald-500/20 via-[#090D1A]/80 to-[#090D1A]/90 border-t-2 border-emerald-400 border-x border-b border-emerald-500/30 text-emerald-300 shadow-[0_4px_20px_rgba(16,185,129,0.1)] hover:border-emerald-400 hover:shadow-[0_0_24px_rgba(16,185,129,0.25)] transition-all cursor-pointer relative overflow-hidden group"
                  title="Click to zoom map to largest Managed Paddy zone"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-emerald-300 flex items-center gap-1">
                      <Wheat className="w-3 h-3 text-emerald-400" />
                      Managed Paddy
                    </span>
                    <span className="text-[10px] font-mono tabular-nums font-bold text-emerald-400">{fmtPct(c3.percentage)}</span>
                  </div>
                  <div className="text-xl font-black font-mono tabular-nums text-white">
                    {fmtNum(c3.area_km2, 2)} <span className="text-xs font-normal text-white/40">km²</span>
                  </div>
                  <div className="text-[9px] text-emerald-300/80 mt-1 font-mono">Agricultural bunds &bull; Zoom</div>
                </div>

                {/* KPI 4: Wetland Drying (Interactive) */}
                <div
                  onClick={() => handleSelectClassLargest(4)}
                  className="p-3 rounded-xl bg-gradient-to-b from-amber-500/20 via-[#090D1A]/80 to-[#090D1A]/90 border-t-2 border-amber-400 border-x border-b border-amber-500/30 text-amber-300 shadow-[0_4px_20px_rgba(255,184,0,0.1)] hover:border-amber-400 hover:shadow-[0_0_24px_rgba(255,184,0,0.25)] transition-all cursor-pointer relative overflow-hidden group"
                  title="Click to zoom map to largest Wetland Drying zone"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-amber-300 flex items-center gap-1">
                      <Sun className="w-3 h-3 text-amber-400" />
                      Wetland Drying
                    </span>
                    <span className="text-[10px] font-mono tabular-nums font-bold text-amber-400">{fmtPct(c4.percentage)}</span>
                  </div>
                  <div className="text-xl font-black font-mono tabular-nums text-white">
                    {fmtNum(c4.area_km2, 2)} <span className="text-xs font-normal text-white/40">km²</span>
                  </div>
                  <div className="text-[9px] text-amber-300/80 mt-1 font-mono">Sandbars &amp; char lands &bull; Zoom</div>
                </div>
              </div>
            </div>

            {/* Click-to-Inspect Change Evidence Card */}
            <div className="p-4 rounded-xl bg-[#090D1A]/80 border border-white/10 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crosshair className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                    Change Evidence Inspector
                  </span>
                </div>
                <span className="text-[10px] font-mono text-white/50">
                  {selectedPolygon ? 'Selected' : 'Select a polygon'}
                </span>
              </div>

              {/* Target Header */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-black/50 border border-white/10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white">{activePoly.id}</span>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full border font-semibold ${getClassBadgeStyle(
                        activePoly.class_id
                      )}`}
                    >
                      {activePoly.class_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-white/50 font-mono tabular-nums">
                    <MapPin className="w-3 h-3 text-cyan-400" />
                    <span>
                      {fmtLatLng(activePoly.centroid)}
                    </span>
                  </div>
                </div>

                {onFocusPolygon && activePoly.centroid && (
                  <button
                    onClick={() => activePoly.centroid && onFocusPolygon(activePoly.centroid)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-cyan-500/20 hover:text-cyan-300 text-white/70 transition-all border border-white/10 cursor-pointer"
                    title="Focus map on polygon"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Spatial Area & Multi-Look Confidence */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                  <div className="text-[9px] uppercase font-semibold text-white/50">Surface Extent</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-white">
                    {fmtNum(activePoly.area_km2, 3)} <span className="text-[10px] font-normal text-white/40">km²</span>
                  </div>
                  <div className="text-[9px] text-white/40 font-mono tabular-nums">({fmtNum(activePoly.area_hectares, 1)} ha)</div>
                </div>

                <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                  <div className="text-[9px] uppercase font-semibold text-white/50">Robustness Score</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-emerald-300">
                    {fmtPct01(activePoly.confidence, 1)}
                  </div>
                </div>
              </div>

              {/* Radar Radiometry Profile */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
                <div className="text-[9px] font-bold uppercase tracking-wider text-white/50">
                  L-Band Backscatter Radiometry (γ⁰)
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-[8px] uppercase text-white/40">Before HH</div>
                    <div className="text-[11px] font-mono tabular-nums font-bold text-white/90">{fmtDb(activePoly.before_hh_db)}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-[8px] uppercase text-white/40">After HH</div>
                    <div className="text-[11px] font-mono tabular-nums font-bold text-white/90">{fmtDb(activePoly.after_hh_db)}</div>
                  </div>
                  <div
                    className={`p-2 rounded-lg border ${
                      (activePoly.delta_hh_db ?? 0) < 0
                        ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300'
                        : 'bg-pink-500/20 border-pink-400/40 text-pink-300'
                    }`}
                  >
                    <div className="text-[8px] uppercase font-semibold">ΔHH Shift</div>
                    <div className="text-[11px] font-mono tabular-nums font-bold">
                      {fmtDb(activePoly.delta_hh_db)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Physical vs Human Driver Hypothesis */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5">
                <div className="text-[9px] font-bold uppercase tracking-wider text-amber-300">
                  Pipeline Note (unverified)
                </div>
                <p className="text-[11px] text-white/80 leading-relaxed font-sans">{activePoly.driver_hypothesis ?? DASH}</p>
                <div className="pt-2 flex items-center gap-1.5 text-[9px] text-white/40 border-t border-white/10">
                  <Compass className="w-3 h-3 text-cyan-400" />
                  <span>
                    Rule-based change class; not validated against ground truth.
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
