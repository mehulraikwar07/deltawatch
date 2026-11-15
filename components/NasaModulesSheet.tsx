'use client';

import React, { useState } from 'react';
import {
  X,
  Compass,
  Activity,
  Sparkles,
  CloudRain,
  Bell,
  BookOpen,
  Download,
  FileText,
  ShieldCheck,
  MapPin,
  Satellite,
  Droplets,
  Trees,
  Wheat,
  Sun,
  AlertTriangle,
  Radio,
  ExternalLink,
  Layers,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Users,
  Mountain,
} from 'lucide-react';
import { ISRO_DEM_LULC_METADATA_2024_25 } from '@/lib/demMetadata';
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
import type { SummaryMetrics, EvidencePolygonProperties, RegionId } from '@/types/sar';
import type { ClimateData, SearchPlace } from '@/types/google-maps';

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
  onFlyToRegion,
}: NasaModulesSheetProps) {
  const [followedAlerts, setFollowedAlerts] = useState<Record<string, boolean>>({
    'alert-1': true,
    'alert-2': true,
  });

  if (!isOpen) return null;

  const isNag = metrics.region_id === 'nagapattinam';

  // Fallback demo target
  const activePoly: EvidencePolygonProperties = selectedPolygon || {
    id: isNag ? 'NAG-POLY-001' : 'MAJ-POLY-001',
    class_id: 1,
    class_name: 'New Open Floodwater',
    area_km2: 0.85,
    area_hectares: 85.0,
    before_hh_db: -10.5,
    after_hh_db: -16.2,
    delta_hh_db: -5.7,
    confidence: 0.96,
    centroid: metrics.center,
    driver_hypothesis:
      isNag
        ? 'Severe monsoon runoff & distributary levee overtopping causing specular radar extinction over low-gradient alluvial soil.'
        : 'High-monsoon Brahmaputra crest breaching northern sand embankments into floodplain wetlands.',
    radar_band: 'L-band GCOV (24 cm)',
    geometry_lock: true,
  };

  const c1 = metrics.classes['1'] || { area_km2: 0, percentage: 0 };
  const c2 = metrics.classes['2'] || { area_km2: 0, percentage: 0 };
  const c3 = metrics.classes['3'] || { area_km2: 0, percentage: 0 };
  const c4 = metrics.classes['4'] || { area_km2: 0, percentage: 0 };

  // Demographic and vulnerability exposure profile
  const demographicData = isNag
    ? {
        populationExposed: '1.6 Million',
        populationSubtext: 'Coastal & Delta Alluvial Zones',
        infrastructureRisk: 'Coastal power grid & Samba paddy salinization',
        primaryCause: 'Cyclonic storm surge & Cauvery distributary backup',
        riskLevel: 'CRITICAL HIGH',
        riskColor: 'text-red-400',
        riskBg: 'bg-red-950/40 border-red-500/30',
      }
    : {
        populationExposed: '167,000',
        populationSubtext: 'River Island & Char Settlements',
        infrastructureRisk: '42 km of state highways submerged',
        primaryCause: 'Upstream Brahmaputra flash flooding & levee overtopping',
        riskLevel: 'SEVERE ALERT',
        riskColor: 'text-amber-400',
        riskBg: 'bg-amber-950/40 border-amber-500/30',
      };

  // 04. Analytics: Backscatter shift data
  const backscatterChartData = [
    { name: 'Stable Land', preHH: -11.5, postHH: -11.5, delta: 0.0, color: '#64748B' },
    { name: 'Open Flood', preHH: -10.8, postHH: -17.5, delta: -6.7, color: '#00F0FF' },
    { name: 'Flooded Canopy', preHH: -8.2, postHH: -4.5, delta: +3.7, color: '#FF2E93' },
    { name: 'Managed Paddy', preHH: -11.2, postHH: -15.4, delta: -4.2, color: '#10B981' },
    { name: 'Wetland Drying', preHH: -16.8, postHH: -12.1, delta: +4.7, color: '#FFB800' },
  ];

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
        const rows = [
          ['Feature_ID', 'Class_Name', 'Area_km2', 'Area_Hectares', 'Before_HH_dB', 'After_HH_dB', 'Delta_HH_dB', 'Confidence', 'Longitude', 'Latitude'],
        ];
        (data.features || []).forEach((f: any) => {
          const p = f.properties;
          rows.push([
            p.id,
            `"${p.class_name}"`,
            p.area_km2,
            p.area_hectares,
            p.before_hh_db,
            p.after_hh_db,
            p.delta_hh_db,
            p.confidence,
            p.centroid?.[0] || '',
            p.centroid?.[1] || '',
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
      onFocusPolygon(largest.centroid);
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
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-400/30">
              NASA 2026
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
                    NISAR L2 GCOV (PROVISIONAL)
                  </span>
                  <span>1.25 GHz / 24 cm λ</span>
                </div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  {metrics.region_name}
                </h3>
                <p className="text-xs text-white/70 leading-relaxed">
                  Dual-polarimetric (HH+HV) flood displacement and sub-canopy inundation mapping for the NASA Space Apps Challenge 2026 (&ldquo;Dancing with the SARs&rdquo;).
                </p>
              </div>

              {/* Mission Metadata Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase">Total Swath Area</div>
                  <div className="text-base font-bold text-cyan-400 mt-0.5">{metrics.total_swath_area_km2} km²</div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase">Orbit Geometry Lock</div>
                  <div className="text-base font-bold text-emerald-400 mt-0.5">Track {metrics.orbit_track} • Frame {metrics.frame_number}</div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase">Pre-Event Date</div>
                  <div className="text-xs font-bold text-white mt-0.5">{metrics.before_date.split('T')[0]}</div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase">Post-Event Date</div>
                  <div className="text-xs font-bold text-white mt-0.5">{metrics.after_date.split('T')[0]}</div>
                </div>
              </div>

              {/* Official ISRO NRSC DEM & LULC 2024-25 Metadata Grid */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Mountain className="w-4 h-4 text-amber-400" />
                    ISRO NRSC DEM &amp; LULC 2024–25 (BHUVAN)
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                    {ISRO_DEM_LULC_METADATA_2024_25.accuracy.overallClassificationAccuracy} ACCURACY
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-[10px] text-white/40 uppercase">Datum &amp; Spheroid</div>
                    <div className="text-xs font-bold text-white mt-0.5">{ISRO_DEM_LULC_METADATA_2024_25.spatialReference.datum}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-[10px] text-white/40 uppercase">Scale &amp; Coverage</div>
                    <div className="text-xs font-bold text-cyan-400 mt-0.5">{ISRO_DEM_LULC_METADATA_2024_25.spatialReference.scale} (68°–98°E)</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-[10px] text-white/40 uppercase">Plain Terrain Model</div>
                    <div className="text-xs font-bold text-emerald-400 mt-0.5">1-Pixel (2nd Order Poly)</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-[10px] text-white/40 uppercase">Hilly Terrain Model</div>
                    <div className="text-xs font-bold text-amber-300 mt-0.5">2–3 Pixels (TIN AOI Model)</div>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-[11px] text-white/70 space-y-1 font-sans">
                  <div className="font-mono text-[10px] text-white/40 uppercase font-semibold">Lineage &amp; Sensor Citation</div>
                  <p>
                    {ISRO_DEM_LULC_METADATA_2024_25.agency.division}, {ISRO_DEM_LULC_METADATA_2024_25.agency.organisation}, {ISRO_DEM_LULC_METADATA_2024_25.agency.address}. Multitemporal IRS P6 AWiFS sensor calibrated for Net Sown Area and seasonal delta floodplains across Tamil Nadu and Assam.
                  </p>
                </div>
              </div>

              {/* 4 Classification Quick Metrics */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-white/80">
                  Detected Surface Classification
                </div>
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-cyan-950/30 border border-cyan-400/20">
                    <span className="flex items-center gap-2 text-cyan-300">
                      <span className="w-2 h-2 rounded-full bg-[#00F0FF]" />
                      Open Floodwater
                    </span>
                    <span className="font-bold">{c1.area_km2} km² ({c1.percentage}%)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-pink-950/30 border border-pink-400/20">
                    <span className="flex items-center gap-2 text-pink-300">
                      <span className="w-2 h-2 rounded-full bg-[#FF2E93]" />
                      Flooded Canopy (Mangroves)
                    </span>
                    <span className="font-bold">{c2.area_km2} km² ({c2.percentage}%)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-950/30 border border-emerald-400/20">
                    <span className="flex items-center gap-2 text-emerald-300">
                      <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                      Managed Paddy Inundation
                    </span>
                    <span className="font-bold">{c3.area_km2} km² ({c3.percentage}%)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-amber-950/30 border border-amber-400/20">
                    <span className="flex items-center gap-2 text-amber-300">
                      <span className="w-2 h-2 rounded-full bg-[#FFB800]" />
                      Wetland Drying / Sandbars
                    </span>
                    <span className="font-bold">{c4.area_km2} km² ({c4.percentage}%)</span>
                  </div>
                </div>
              </div>

              {/* Vulnerability & Population Demographics */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/90">
                    <Users className="w-4 h-4 text-cyan-400" />
                    Vulnerability & Demographics
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${demographicData.riskBg} ${demographicData.riskColor}`}>
                    {demographicData.riskLevel}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-[10px] text-white/40 uppercase">Population Exposed</div>
                    <div className="text-lg font-bold text-red-400 mt-0.5">
                      {demographicData.populationExposed}
                    </div>
                    <div className="text-[10px] text-white/50 truncate mt-0.5">
                      {demographicData.populationSubtext}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-[10px] text-white/40 uppercase">Infrastructure Risk</div>
                    <div className="text-xs font-bold text-amber-300 mt-1 line-clamp-2">
                      {demographicData.infrastructureRisk}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <div className="text-[10px] uppercase font-mono text-cyan-300 font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    Primary Cause
                  </div>
                  <p className="text-xs text-white/80 leading-relaxed font-sans">
                    {demographicData.primaryCause}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              MODULE 04. ANALYTICS & EVIDENCE INSPECTOR
          ───────────────────────────────────────────────────────────── */}
          {activeModule === 'analytics' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* 4 Interactive KPI Cards (Zoom on Click) */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSelectClassLargest(1)}
                  className="p-3 rounded-2xl bg-[#090E1F] hover:bg-[#0E1630] border border-[#00F0FF]/30 text-left transition group cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#00F0FF]">
                    <span>OPEN FLOOD</span>
                    <span className="text-white/40">{c1.percentage}%</span>
                  </div>
                  <div className="text-xl font-extrabold text-white font-mono mt-0.5">{c1.area_km2} km²</div>
                  <div className="text-[10px] text-cyan-300/80 mt-1">ΔHH ≤ -3.5 dB • Click Zoom</div>
                </button>

                <button
                  onClick={() => handleSelectClassLargest(2)}
                  className="p-3 rounded-2xl bg-[#17091B] hover:bg-[#250F2C] border border-[#FF2E93]/30 text-left transition group cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#FF2E93]">
                    <span>CANOPY</span>
                    <span className="text-white/40">{c2.percentage}%</span>
                  </div>
                  <div className="text-xl font-extrabold text-white font-mono mt-0.5">{c2.area_km2} km²</div>
                  <div className="text-[10px] text-pink-300/80 mt-1">ΔHH ≥ +2.5 dB • Click Zoom</div>
                </button>

                <button
                  onClick={() => handleSelectClassLargest(3)}
                  className="p-3 rounded-2xl bg-[#081812] hover:bg-[#0E241B] border border-[#10B981]/30 text-left transition group cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#10B981]">
                    <span>PADDY</span>
                    <span className="text-white/40">{c3.percentage}%</span>
                  </div>
                  <div className="text-xl font-extrabold text-white font-mono mt-0.5">{c3.area_km2} km²</div>
                  <div className="text-[10px] text-emerald-300/80 mt-1">Bunds • Click Zoom</div>
                </button>

                <button
                  onClick={() => handleSelectClassLargest(4)}
                  className="p-3 rounded-2xl bg-[#191408] hover:bg-[#281F0C] border border-[#FFB800]/30 text-left transition group cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#FFB800]">
                    <span>DRYING</span>
                    <span className="text-white/40">{c4.percentage}%</span>
                  </div>
                  <div className="text-xl font-extrabold text-white font-mono mt-0.5">{c4.area_km2} km²</div>
                  <div className="text-[10px] text-amber-300/80 mt-1">Sandbars • Click Zoom</div>
                </button>
              </div>

              {/* Inspected Target Card */}
              <div className="p-4 rounded-2xl bg-black/50 border border-cyan-500/30 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-cyan-300">{activePoly.id}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-400/30">
                      {activePoly.class_name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Verified
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-white/60 font-mono">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{activePoly.centroid[1].toFixed(4)}°N, {activePoly.centroid[0].toFixed(4)}°E</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-[10px] text-white/40 uppercase">Surface Area</div>
                    <div className="text-sm font-bold text-white mt-0.5">{activePoly.area_km2} km² ({activePoly.area_hectares} ha)</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-[10px] text-white/40 uppercase">Radar Looks / ENL</div>
                    <div className="text-sm font-bold text-emerald-400 mt-0.5">{(activePoly.confidence * 100).toFixed(0)}% (5x5 Lee)</div>
                  </div>
                </div>

                {/* Backscatter Shift Radiometry */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5 font-mono">
                  <div className="text-[10px] text-white/50 uppercase tracking-wider">L-Band Backscatter Radiometry (γ⁰)</div>
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="p-1.5 rounded-lg bg-white/5">
                      <div className="text-[9px] text-white/40">BEFORE HH</div>
                      <div className="text-xs font-bold text-white/80">{activePoly.before_hh_db} dB</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/5">
                      <div className="text-[9px] text-white/40">AFTER HH</div>
                      <div className="text-xs font-bold text-white/80">{activePoly.after_hh_db} dB</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-400/30">
                      <div className="text-[9px] text-cyan-300">ΔHH SHIFT</div>
                      <div className="text-xs font-bold text-cyan-300">{activePoly.delta_hh_db} dB</div>
                    </div>
                  </div>
                </div>

                {/* Physical vs Human Driver */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <div className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">Physical vs. Human Driver Hypothesis</div>
                  <p className="text-[11px] text-white/70 leading-relaxed">{activePoly.driver_hypothesis}</p>
                </div>
              </div>

              {/* Historical Backscatter Shift Chart */}
              <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">Backscatter Radiometry Shift (γ⁰ dB)</span>
                  <span className="text-[10px] font-mono text-cyan-300">Dual-Pol HH</span>
                </div>
                <div className="w-full h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={backscatterChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={9} tickLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.4)" fontSize={9} tickLine={false} unit=" dB" domain={[-20, 0]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(10,14,24,0.95)', border: '1px solid rgba(0,229,255,0.4)', borderRadius: '12px', fontSize: '11px' }}
                        formatter={(val: any) => [`${val} dB`, 'Backscatter']}
                      />
                      <Bar dataKey="delta" radius={[4, 4, 0, 0]}>
                        {backscatterChartData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
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
              <ClimateTab regionId={metrics.region_id} regionName={metrics.region_name} climate={climate} />
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              MODULE 07. MONITORING & INUNDATION ALERTS
          ───────────────────────────────────────────────────────────── */}
          {activeModule === 'alerts' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-2xl bg-red-950/30 border border-red-500/40 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-400/40 flex items-center justify-center text-red-400">
                    <Bell className="w-4 h-4 animate-bounce" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Live NISAR Threshold Monitor</h4>
                    <p className="text-[10px] text-white/60">Automated levee & canopy anomaly alerts</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/30 text-red-300 font-bold border border-red-400/50">
                  ACTIVE
                </span>
              </div>

              {/* Alert Feed Items */}
              <div className="space-y-2">
                {/* Alert 1 */}
                <div className="p-3.5 rounded-2xl bg-black/40 border border-red-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-red-400 bg-red-950/60 px-2 py-0.5 rounded-full border border-red-500/30">
                      CRITICAL BREACH
                    </span>
                    <button
                      onClick={() => setFollowedAlerts((prev) => ({ ...prev, 'alert-1': !prev['alert-1'] }))}
                      className="text-[10px] text-cyan-300 hover:text-cyan-200 transition font-mono"
                    >
                      {followedAlerts['alert-1'] ? '✓ Subscribed' : '+ Subscribe'}
                    </button>
                  </div>
                  <h5 className="text-xs font-bold text-white">
                    {isNag
                      ? 'ΔHH -6.65 dB Specular Levee Breach at Kaduvaiyar Distributary'
                      : 'ΔHH -7.12 dB Embankment Breach into Garamur Wetlands'}
                  </h5>
                  <p className="text-[11px] text-white/70 leading-relaxed">
                    Overland floodwater sheet expanding at &gt; 12.4 km²/cycle. Depth exceeds vehicular clearance on lower link highways.
                  </p>
                  <div className="text-[10px] text-white/40 font-mono">Location: {metrics.center[1].toFixed(4)}°N, {metrics.center[0].toFixed(4)}°E</div>
                </div>

                {/* Alert 2 */}
                <div className="p-3.5 rounded-2xl bg-black/40 border border-pink-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-pink-400 bg-pink-950/60 px-2 py-0.5 rounded-full border border-pink-500/30">
                      WARNING SURGE
                    </span>
                    <button
                      onClick={() => setFollowedAlerts((prev) => ({ ...prev, 'alert-2': !prev['alert-2'] }))}
                      className="text-[10px] text-cyan-300 hover:text-cyan-200 transition font-mono"
                    >
                      {followedAlerts['alert-2'] ? '✓ Subscribed' : '+ Subscribe'}
                    </button>
                  </div>
                  <h5 className="text-xs font-bold text-white">
                    {isNag
                      ? '+3.8 dB Dihedral Double-Bounce Surge in Muthupet Mangroves'
                      : '+3.4 dB Sub-Canopy Inundation in Salmora Bamboo Forest'}
                  </h5>
                  <p className="text-[11px] text-white/70 leading-relaxed">
                    Radar waves reveal deep stagnant standing floodwater under forest canopy. Severe root pneumatophore asphyxiation hazard if sustained &gt; 7 days.
                  </p>
                  <div className="text-[10px] text-white/40 font-mono">Status: Tidal Regulator Flush Recommended</div>
                </div>

                {/* Alert 3 */}
                <div className="p-3.5 rounded-2xl bg-black/40 border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/30">
                      AGRO ADVISORY
                    </span>
                    <span className="text-[10px] text-white/40 font-mono">72h Threshold</span>
                  </div>
                  <h5 className="text-xs font-bold text-white">
                    {isNag
                      ? 'Samba Paddy Bund Submergence Exceeded 48h Tolerance'
                      : 'Ahu Crop Inundation in Lower Floodplain'}
                  </h5>
                  <p className="text-[11px] text-white/70 leading-relaxed">
                    {c3.area_km2} km² of bunded agricultural parcels submerged. Sluice gate de-siltation required before high tide.
                  </p>
                </div>
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
                  Smooth standing floodwater acts like a mirror to radar pulses, deflecting electromagnetic energy away from the satellite antenna. This causes a dramatic radar backscatter drop (ΔHH ≤ -3.5 dB, down to -17 dB), making open floodwater appear stark black/cyan.
                </p>
              </div>

              {/* Explainer 3: Dihedral Double-Bounce */}
              <div className="p-3.5 rounded-2xl bg-black/40 border border-[#FF2E93]/30 space-y-1.5">
                <div className="flex items-center gap-2 text-[#FF2E93] font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-[#FF2E93]" />
                  <span>3. Dihedral Corner Reflection (Flooded Canopy)</span>
                </div>
                <p className="text-[11px] text-white/70 leading-relaxed">
                  When floodwater submerges the base of trees or mangroves, a right-angle corner reflector is formed between vertical tree trunks and the horizontal standing water surface. Radar pulses bounce twice and return directly to the sensor, creating an intense bright surge (ΔHH ≥ +2.5 dB, highlighted in magenta).
                </p>
              </div>

              {/* Explainer 4: Lee Speckle Filter */}
              <div className="p-3.5 rounded-2xl bg-black/40 border border-emerald-500/30 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                  <span>4. 5x5 Lee Filter (Linear Power Domain)</span>
                </div>
                <p className="text-[11px] text-white/70 leading-relaxed">
                  Raw SAR contains multiplicative speckle noise. DELTA-SAR applies a 5x5 Lee adaptive speckle filter in the linear power domain before logarithmic dB conversion, achieving an Equivalent Number of Looks (ENL) ≈ 4.15 for crisp 20m pixel boundary detection.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
