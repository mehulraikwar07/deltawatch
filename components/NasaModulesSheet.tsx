'use client';

import React, { useState } from 'react';
import {
  X,
  Bell,
  BookOpen,
  Download,
  FileText,
  ShieldCheck,
  MapPin,
  Satellite,
} from 'lucide-react';
import {
  DASH,
  dataModeLabel,
  fmtDate,
  fmtDb,
  fmtLatLng,
  fmtNum,
  fmtOrbit,
  fmtPct,
  fmtPct01,
  fmtRange,
  fmtText,
  getClass,
  isNum,
  isRealData,
  normalizePolygonProps,
  provenanceRows,
} from '@/lib/metrics';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { AiReportTab } from './AiReportTab';
import { ClimateTab } from './ClimateTab';
import type { SummaryMetrics, EvidencePolygonProperties, RegionSceneEntry } from '@/types/sar';
import type { ClimateData } from '@/types/google-maps';

export type NasaModuleId =
  | 'overview'
  | 'analytics'
  | 'report'
  | 'climate'
  | 'alerts'
  | 'learn';

interface NasaModulesSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeModule: NasaModuleId;
  onSelectModule: (mod: NasaModuleId) => void;
  metrics: SummaryMetrics;
  climate: ClimateData;
  selectedPolygon: EvidencePolygonProperties | null;
  onSelectPolygon: (poly: EvidencePolygonProperties) => void;
  onFocusPolygon: (coords: [number, number]) => void;
  evidencePolys: EvidencePolygonProperties[];
  onFlyToRegion: (coords: [number, number]) => void;
  /** This region's entry from available_scenes.json (optional). */
  regionCatalog?: RegionSceneEntry | null;
}

export function NasaModulesSheet({
  isOpen,
  onClose,
  activeModule,
  onSelectModule,
  metrics,
  climate,
  selectedPolygon,
  onSelectPolygon,
  onFocusPolygon,
  evidencePolys,
  regionCatalog,
}: NasaModulesSheetProps) {
  const [showAllProvenance, setShowAllProvenance] = useState(false);

  if (!isOpen) return null;

  // Only a polygon the user actually selected is inspected; no invented demo target.
  const activePoly: EvidencePolygonProperties | null = selectedPolygon;

  const CLASS_META: Array<{ id: number; fallbackName: string }> = [
    { id: 1, fallbackName: 'Open Floodwater' },
    { id: 2, fallbackName: 'Flooded Vegetation' },
    { id: 3, fallbackName: 'Managed Paddy / Aquaculture' },
    { id: 4, fallbackName: 'Wetland Drying' },
  ];
  const c1 = getClass(metrics, 1);
  const c2 = getClass(metrics, 2);
  const c3 = getClass(metrics, 3);
  const c4 = getClass(metrics, 4);
  const className = (id: number) =>
    getClass(metrics, id)?.name || CLASS_META.find((c) => c.id === id)?.fallbackName || `Class ${id}`;

  // Mean HH backscatter change per class, computed from the evidence polygons
  // actually loaded for this region (replaces the old hard-coded chart values).
  const CLASS_COLORS: Record<number, string> = { 1: '#00F0FF', 2: '#FF2E93', 3: '#10B981', 4: '#FFB800' };
  const backscatterChartData = CLASS_META.map(({ id }) => {
    const deltas = evidencePolys
      .filter((p) => p.class_id === id)
      .map((p) => p.delta_hh_db)
      .filter(isNum);
    const mean = deltas.length ? deltas.reduce((x, y) => x + y, 0) / deltas.length : null;
    return {
      name: className(id).split(/[ /]/)[0],
      delta: mean === null ? null : Math.round(mean * 100) / 100,
      n: deltas.length,
      color: getClass(metrics, id)?.hex || CLASS_COLORS[id],
    };
  }).filter((d) => d.delta !== null);

  // Largest polygons, used by the "Change highlights" module.
  const topPolys = [...evidencePolys]
    .filter((p) => isNum(p.area_km2) && p.class_id >= 1 && p.class_id <= 4)
    .sort((x, y) => (y.area_km2 ?? 0) - (x.area_km2 ?? 0))
    .slice(0, 5);

  const validation = metrics.validation_stats ?? {};
  const validationRows = [
    { label: 'Speckle filter window', value: validation.lee_filter_window ?? null },
    { label: 'Equivalent no. of looks', value: isNum(validation.equivalent_number_of_looks) ? fmtNum(validation.equivalent_number_of_looks, 2) : null },
    { label: 'Speckle suppression idx', value: isNum(validation.speckle_suppression_index) ? fmtNum(validation.speckle_suppression_index, 2) : null },
    { label: 'Co-registration RMSE', value: isNum(validation.coregistration_rmse_m) ? `${fmtNum(validation.coregistration_rmse_m, 2)} m` : null },
    { label: 'Radiometric resolution', value: isNum(validation.radiometric_resolution_db) ? `${fmtNum(validation.radiometric_resolution_db, 2)} dB` : null },
  ].filter((r) => r.value !== null && r.value !== '');

  const provRows = provenanceRows(metrics.provenance);
  const realData = isRealData(metrics);

  // 06. Reports: Export GeoJSON
  const handleExportGeoJson = () => {
    fetch(`/processed/${metrics.region_id}/evidence_polygons.geojson`)
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `NISAR_L2_DELTAWATCH_${metrics.region_id}_polygons.geojson`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((err) => console.error('GeoJSON export error:', err));
  };

  // 06. Reports: Download CSV Telemetry
  const handleDownloadCsv = () => {
    fetch(`/processed/${metrics.region_id}/evidence_polygons.geojson`)
      .then((res) => res.json())
      .then((data) => {
        const rows: Array<Array<string | number>> = [
          ['Feature_ID', 'Class_Name', 'Area_km2', 'Area_Hectares', 'Before_HH_dB', 'After_HH_dB', 'Delta_HH_dB', 'Confidence', 'Longitude', 'Latitude'],
        ];
        (data.features || []).forEach((f: { properties?: Record<string, unknown> }) => {
          const p = normalizePolygonProps(f.properties ?? {});
          rows.push([
            p.id,
            `"${p.class_name}"`,
            p.area_km2 ?? '',
            p.area_hectares ?? '',
            p.before_hh_db ?? '',
            p.after_hh_db ?? '',
            p.delta_hh_db ?? '',
            p.confidence ?? '',
            p.centroid?.[0] ?? '',
            p.centroid?.[1] ?? '',
          ]);
        });
        const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `DELTAWATCH_${metrics.region_id}_telemetry.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      })
      .catch((err) => console.error('CSV export error:', err));
  };

  const handleSelectClassLargest = (classId: number) => {
    const matching = evidencePolys.filter((p) => p.class_id === classId);
    if (matching.length > 0) {
      const largest = matching.reduce((prev, curr) =>
        Number(curr.area_km2) > Number(prev.area_km2) ? curr : prev
      );
      onSelectPolygon(largest);
      if (largest.centroid) onFocusPolygon(largest.centroid);
    }
  };

  return (
    <div className="absolute top-4 right-4 bottom-24 w-[420px] max-w-[calc(100vw-2rem)] z-30 pointer-events-auto flex flex-col animate-in slide-in-from-right duration-250 font-sans select-none">
      <div className="relative flex-1 flex flex-col bg-[#111317]/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden text-white">
        {/* Top Header with Module Title & Close Button */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2.5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">
              {activeModule === 'overview' && '01. Mission Overview'}
              {activeModule === 'analytics' && '04. Radar Analytics & Evidence'}
              {activeModule === 'report' && '05. AI Insights & 06. Reports'}
              {activeModule === 'climate' && 'NASA POWER Climate Telemetry'}
              {activeModule === 'alerts' && '07. Monitoring & Inundation Alerts'}
              {activeModule === 'learn' && '08. Learn About L-Band SAR'}
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                realData
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-400/30'
                  : 'bg-amber-950/60 text-amber-300 border-amber-400/40'
              }`}
              title={dataModeLabel(metrics)}
            >
              {realData ? 'REAL DATA' : 'SYNTHETIC DATA'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition cursor-pointer"
            title="Close Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1-Click Horizontal Module Navigation Pills (All 8 Modules) */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/10 bg-black/30 overflow-x-auto no-scrollbar shrink-0 text-[11px]">
          <button
            onClick={() => onSelectModule('overview')}
            className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${
              activeModule === 'overview'
                ? 'bg-cyan-950 border border-cyan-400 text-cyan-300 font-bold shadow-sm'
                : 'bg-white/5 hover:bg-white/10 text-white/70'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => onSelectModule('analytics')}
            className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${
              activeModule === 'analytics'
                ? 'bg-cyan-950 border border-cyan-400 text-cyan-300 font-bold shadow-sm'
                : 'bg-white/5 hover:bg-white/10 text-white/70'
            }`}
          >
            Analytics & Evidence
          </button>
          <button
            onClick={() => onSelectModule('report')}
            className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${
              activeModule === 'report'
                ? 'bg-cyan-950 border border-cyan-400 text-cyan-300 font-bold shadow-sm'
                : 'bg-white/5 hover:bg-white/10 text-white/70'
            }`}
          >
            AI Report
          </button>
          <button
            onClick={() => onSelectModule('climate')}
            className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${
              activeModule === 'climate'
                ? 'bg-cyan-950 border border-cyan-400 text-cyan-300 font-bold shadow-sm'
                : 'bg-white/5 hover:bg-white/10 text-white/70'
            }`}
          >
            Climate (NASA POWER)
          </button>
          <button
            onClick={() => onSelectModule('alerts')}
            className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${
              activeModule === 'alerts'
                ? 'bg-red-950 border border-red-400 text-red-300 font-bold shadow-sm'
                : 'bg-white/5 hover:bg-white/10 text-white/70'
            }`}
          >
            Alerts
          </button>
          <button
            onClick={() => onSelectModule('learn')}
            className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${
              activeModule === 'learn'
                ? 'bg-indigo-950 border border-indigo-400 text-indigo-300 font-bold shadow-sm'
                : 'bg-white/5 hover:bg-white/10 text-white/70'
            }`}
          >
            Learn SAR
          </button>
        </div>

        {/* Scrollable Module Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {/* ─────────────────────────────────────────────────────────────
              MODULE 01. OVERVIEW
          ───────────────────────────────────────────────────────────── */}
          {activeModule === 'overview' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Satellite className="w-4 h-4" />
                    {dataModeLabel(metrics)}
                  </span>
                  <span>{fmtText(metrics.radar_band)}</span>
                </div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  {metrics.region_name}
                </h3>
                <p className="text-xs text-white/70 leading-relaxed">
                  {fmtText(metrics.flood_event)}
                </p>
                {!realData && (
                  <p className="text-[11px] text-amber-300/90 leading-relaxed">
                    These figures come from synthetic demo data, not real radar observations.
                  </p>
                )}
              </div>

              {/* Scene Metadata Grid (all from summary_metrics.json) */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase">Scene Area Analysed</div>
                  <div className="text-base font-bold text-cyan-400 mt-0.5">
                    {isNum(metrics.total_swath_area_km2) ? `${fmtNum(metrics.total_swath_area_km2, 2)} km²` : DASH}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase">Orbit</div>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5">{fmtOrbit(metrics)}</div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase">Before Date</div>
                  <div className="text-xs font-bold text-white mt-0.5">{fmtDate(metrics.before_date)}</div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase">After Date</div>
                  <div className="text-xs font-bold text-white mt-0.5">{fmtDate(metrics.after_date)}</div>
                </div>
                {isNum(metrics.permanent_water_km2) && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 col-span-2">
                    <div className="text-[10px] text-white/40 uppercase">Permanent Water (both scenes)</div>
                    <div className="text-xs font-bold text-white mt-0.5">{fmtNum(metrics.permanent_water_km2, 2)} km²</div>
                  </div>
                )}
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase">Polarisation</div>
                  <div className="text-xs font-bold text-white mt-0.5">{fmtText(metrics.polarization)}</div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase">Incidence Angles</div>
                  <div className="text-xs font-bold text-white mt-0.5">{fmtRange(metrics.incidence_angles, '°')}</div>
                </div>
              </div>

              {/* Source granules */}
              <div className="p-3 rounded-2xl bg-black/40 border border-white/10 space-y-1.5 text-[10px] font-mono">
                <div className="text-white/40 uppercase font-semibold">Source Granules</div>
                <div className="break-all text-white/80"><span className="text-white/40">Before: </span>{fmtText(metrics.before_granule)}</div>
                <div className="break-all text-white/80"><span className="text-white/40">After: </span>{fmtText(metrics.after_granule)}</div>
                {regionCatalog?.pairs && regionCatalog.pairs.length > 0 && (
                  <div className="pt-1 text-white/50">
                    {regionCatalog.pairs.length} scene pair{regionCatalog.pairs.length === 1 ? '' : 's'} in available_scenes.json
                  </div>
                )}
              </div>

              {/* 4 Classification Quick Metrics */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-white/80">
                  Detected Change Classes
                </div>
                <div className="space-y-1.5 text-xs font-mono">
                  {CLASS_META.map(({ id }) => {
                    const c = getClass(metrics, id);
                    const color = c?.hex || CLASS_COLORS[id];
                    return (
                      <div key={id} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10">
                        <span className="flex items-center gap-2 text-white/80">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          {className(id)}
                        </span>
                        <span className="font-bold">
                          {c && isNum(c.area_km2) ? `${fmtNum(c.area_km2, 2)} km² (${fmtPct(c.percentage)})` : DASH}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-white/40 font-sans">
                  Rule-based backscatter change classes; not validated against ground truth.
                </p>
              </div>

              {/* Processing statistics: only rows the pipeline actually computed */}
              {validationRows.length > 0 && (
                <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-white/80">Processing Statistics</div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    {validationRows.map((r) => (
                      <div key={r.label} className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                        <div className="text-[10px] text-white/40 uppercase">{r.label}</div>
                        <div className="text-xs font-bold text-white mt-0.5">{r.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Provenance (rendered generically; hidden if absent) */}
              {provRows.length > 0 && (
                <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-wider text-white/80 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-cyan-400" />
                      Provenance
                    </div>
                    {provRows.length > 6 && (
                      <button
                        onClick={() => setShowAllProvenance((v) => !v)}
                        className="text-[10px] text-cyan-300 hover:text-cyan-200 font-mono cursor-pointer"
                      >
                        {showAllProvenance ? 'Show less' : `Show all (${provRows.length})`}
                      </button>
                    )}
                  </div>
                  <div className="space-y-1 text-[10px] font-mono">
                    {(showAllProvenance ? provRows : provRows.slice(0, 6)).map((r) => (
                      <div key={r.key} className="flex gap-2">
                        <span className="text-white/40 shrink-0">{r.key}</span>
                        <span className="text-white/80 break-all">{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              MODULE 04. ANALYTICS & EVIDENCE INSPECTOR
          ───────────────────────────────────────────────────────────── */}
          {activeModule === 'analytics' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* 4 Interactive KPI Cards (Zoom on Click) */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 1, c: c1, label: 'OPEN WATER', bg: 'bg-[#090E1F] hover:bg-[#0E1630]', border: 'border-[#00F0FF]/30', text: 'text-[#00F0FF]', sub: 'text-cyan-300/80' },
                  { id: 2, c: c2, label: 'VEGETATION', bg: 'bg-[#17091B] hover:bg-[#250F2C]', border: 'border-[#FF2E93]/30', text: 'text-[#FF2E93]', sub: 'text-pink-300/80' },
                  { id: 3, c: c3, label: 'PADDY', bg: 'bg-[#081812] hover:bg-[#0E241B]', border: 'border-[#10B981]/30', text: 'text-[#10B981]', sub: 'text-emerald-300/80' },
                  { id: 4, c: c4, label: 'DRYING', bg: 'bg-[#191408] hover:bg-[#281F0C]', border: 'border-[#FFB800]/30', text: 'text-[#FFB800]', sub: 'text-amber-300/80' },
                ].map((k) => (
                  <button
                    key={k.id}
                    onClick={() => handleSelectClassLargest(k.id)}
                    className={`p-3 rounded-2xl ${k.bg} border ${k.border} text-left transition group cursor-pointer`}
                    title={className(k.id)}
                  >
                    <div className={`flex items-center justify-between text-[11px] font-bold ${k.text}`}>
                      <span>{k.label}</span>
                      <span className="text-white/40">{k.c && isNum(k.c.percentage) ? `${fmtNum(k.c.percentage, 2)}%` : DASH}</span>
                    </div>
                    <div className="text-xl font-extrabold text-white font-mono mt-0.5">
                      {k.c && isNum(k.c.area_km2) ? `${fmtNum(k.c.area_km2, 2)} km²` : DASH}
                    </div>
                    <div className={`text-[10px] ${k.sub} mt-1`}>Click to zoom to largest polygon</div>
                  </button>
                ))}
              </div>

              {/* Inspected Target Card (only for a polygon the user selected) */}
              {activePoly ? (
                <div className="p-4 rounded-2xl bg-black/50 border border-cyan-500/30 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-cyan-300">{activePoly.id}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-400/30">
                        {activePoly.class_name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-white/60 font-mono">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{fmtLatLng(activePoly.centroid)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                      <div className="text-[10px] text-white/40 uppercase">Surface Area</div>
                      <div className="text-sm font-bold text-white mt-0.5">
                        {isNum(activePoly.area_km2) ? `${fmtNum(activePoly.area_km2, 3)} km²` : DASH}
                        {isNum(activePoly.area_hectares) ? ` (${fmtNum(activePoly.area_hectares, 1)} ha)` : ''}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                      <div className="text-[10px] text-white/40 uppercase" title="Share of the polygon's pixels that pass the class test by at least 1 dB. Not a probability.">Robustness Score</div>
                      <div className="text-sm font-bold text-emerald-400 mt-0.5">{fmtPct01(activePoly.confidence)}</div>
                    </div>
                  </div>

                  {/* Backscatter Shift Radiometry */}
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5 font-mono">
                    <div className="text-[10px] text-white/50 uppercase tracking-wider">HH Backscatter (γ⁰)</div>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="p-1.5 rounded-lg bg-white/5">
                        <div className="text-[9px] text-white/40">BEFORE HH</div>
                        <div className="text-xs font-bold text-white/80">{fmtDb(activePoly.before_hh_db)}</div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white/5">
                        <div className="text-[9px] text-white/40">AFTER HH</div>
                        <div className="text-xs font-bold text-white/80">{fmtDb(activePoly.after_hh_db)}</div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-400/30">
                        <div className="text-[9px] text-cyan-300">ΔHH SHIFT</div>
                        <div className="text-xs font-bold text-cyan-300">{fmtDb(activePoly.delta_hh_db)}</div>
                      </div>
                    </div>
                  </div>

                  {activePoly.driver_hypothesis && (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                      <div className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">Pipeline Note (unverified)</div>
                      <p className="text-[11px] text-white/70 leading-relaxed">{activePoly.driver_hypothesis}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-[11px] text-white/60">
                  Click a polygon on the map, or a class card above, to inspect its backscatter values.
                </div>
              )}

              {/* Mean ΔHH per class, from the loaded evidence polygons */}
              <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">Mean HH Change per Class (dB)</span>
                  <span className="text-[10px] font-mono text-cyan-300">
                    {evidencePolys.length} polygons
                  </span>
                </div>
                {backscatterChartData.length > 0 ? (
                  <div className="w-full h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={backscatterChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={9} tickLine={false} />
                        <YAxis stroke="rgba(255,255,255,0.4)" fontSize={9} tickLine={false} unit=" dB" />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'rgba(10,14,24,0.95)', border: '1px solid rgba(0,229,255,0.4)', borderRadius: '12px', fontSize: '11px' }}
                          formatter={(val: unknown, _name: unknown, item: { payload?: { n?: number } }) => [
                            `${String(val)} dB (n=${item?.payload?.n ?? 0})`,
                            'Mean ΔHH',
                          ]}
                        />
                        <Bar dataKey="delta" radius={[4, 4, 0, 0]}>
                          {backscatterChartData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-[11px] text-white/50">No ΔHH values available in evidence_polygons.geojson.</p>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              MODULE 05. AI INSIGHTS & 06. REPORTS
          ───────────────────────────────────────────────────────────── */}
          {activeModule === 'report' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Working Export Actions Bar */}
              <div className="p-3 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between gap-2">
                <button
                  onClick={handleExportGeoJson}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-white/10 hover:bg-cyan-950/60 border border-white/10 hover:border-cyan-400/40 text-xs text-white font-medium transition cursor-pointer"
                  title="Export High-Resolution Vector GeoJSON"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Export GeoJSON</span>
                </button>

                <button
                  onClick={handleDownloadCsv}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-white/10 hover:bg-emerald-950/60 border border-white/10 hover:border-emerald-400/40 text-xs text-white font-medium transition cursor-pointer"
                  title="Download CSV Polygon Telemetry"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download CSV</span>
                </button>
              </div>

              {/* Direct Browser Gemini AI Report Component */}
              <AiReportTab metrics={metrics} selectedPolygon={selectedPolygon} />
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              MODULE CLIMATE (NASA POWER API)
          ───────────────────────────────────────────────────────────── */}
          {activeModule === 'climate' && (
            <div className="animate-in fade-in duration-150">
              <ClimateTab
                regionId={metrics.region_id}
                regionName={metrics.region_name}
                climate={climate}
                beforeDate={metrics.before_date}
                afterDate={metrics.after_date}
                center={metrics.center}
              />
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              MODULE 07. MONITORING & INUNDATION ALERTS
          ───────────────────────────────────────────────────────────── */}
          {activeModule === 'alerts' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/15 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/70">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Change Highlights</h4>
                  <p className="text-[10px] text-white/60">
                    Largest change polygons in this scene pair. No live monitoring or alert feed is connected.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {topPolys.length === 0 && (
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-[11px] text-white/50">
                    No evidence polygons loaded for this region.
                  </div>
                )}
                {topPolys.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onSelectPolygon(p);
                      if (p.centroid) onFocusPolygon(p.centroid);
                    }}
                    className="w-full text-left p-3.5 rounded-2xl bg-black/40 hover:bg-black/60 border border-white/10 hover:border-cyan-400/40 space-y-1 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-cyan-300">{p.id}</span>
                      <span className="text-[10px] font-mono text-white/50">{p.class_name}</span>
                    </div>
                    <div className="text-xs font-bold text-white">
                      {fmtNum(p.area_km2, 3)} km² • ΔHH {fmtDb(p.delta_hh_db)}
                    </div>
                    <div className="text-[10px] text-white/40 font-mono">{fmtLatLng(p.centroid)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              MODULE 08. LEARN ABOUT L-BAND SAR PHYSICS
          ───────────────────────────────────────────────────────────── */}
          {activeModule === 'learn' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-400/40 flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-indigo-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">How NISAR L-Band Works</h4>
                  <p className="text-[10px] text-white/60">Physics of 24 cm microwaves in flood observation</p>
                </div>
              </div>

              {/* Explainer 1: Penetration */}
              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-1.5">
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>1. Cloud & Canopy Penetration (24 cm λ)</span>
                </div>
                <p className="text-[11px] text-white/70 leading-relaxed">
                  Optical sensors cannot see through monsoon clouds, and C-band radar (5.6 cm) scatters off leaf crowns. NISAR&apos;s long 24 cm wavelength pierces rainclouds and penetrates directly through dense forest crowns to the forest floor.
                </p>
              </div>

              {/* Explainer 2: Specular Reflection */}
              <div className="p-3.5 rounded-2xl bg-black/40 border border-[#00F0FF]/30 space-y-1.5">
                <div className="flex items-center gap-2 text-[#00F0FF] font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-[#00F0FF]" />
                  <span>2. Specular Extinction (Open Floodwater)</span>
                </div>
                <p className="text-[11px] text-white/70 leading-relaxed">
                  Smooth standing floodwater acts like a mirror to radar pulses, deflecting electromagnetic energy away from the satellite antenna. This causes a sharp drop in radar backscatter, so newly flooded open ground appears dark in the radar image (highlighted cyan in the change overlay). Wind-roughened water and some smooth surfaces can confuse this.
                </p>
              </div>

              {/* Explainer 3: Dihedral Double-Bounce */}
              <div className="p-3.5 rounded-2xl bg-black/40 border border-[#FF2E93]/30 space-y-1.5">
                <div className="flex items-center gap-2 text-[#FF2E93] font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-[#FF2E93]" />
                  <span>3. Dihedral Corner Reflection (Flooded Canopy)</span>
                </div>
                <p className="text-[11px] text-white/70 leading-relaxed">
                  When floodwater submerges the base of trees or mangroves, a right-angle corner reflector is formed between vertical tree trunks and the horizontal standing water surface. Radar pulses bounce twice and return directly to the sensor, so flooded vegetation can get brighter (highlighted in magenta).
                </p>
              </div>

              {/* Explainer 4: Lee Speckle Filter */}
              <div className="p-3.5 rounded-2xl bg-black/40 border border-emerald-500/30 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                  <span>4. Speckle Filtering (Linear Power Domain)</span>
                </div>
                <p className="text-[11px] text-white/70 leading-relaxed">
                  Raw SAR contains multiplicative speckle noise. An adaptive (Lee) speckle filter is applied in the linear power domain before conversion to decibels (dB).
                  {metrics.validation_stats?.lee_filter_window ? ` This scene pair used a ${metrics.validation_stats.lee_filter_window} window` : ''}
                  {isNum(metrics.validation_stats?.equivalent_number_of_looks)
                    ? `${metrics.validation_stats?.lee_filter_window ? ', with' : ' Measured'} equivalent number of looks (ENL) ${fmtNum(metrics.validation_stats?.equivalent_number_of_looks, 2)}.`
                    : metrics.validation_stats?.lee_filter_window ? '.' : ''}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
