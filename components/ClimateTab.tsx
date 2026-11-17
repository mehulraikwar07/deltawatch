'use client';

import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  CloudRain,
  Thermometer,
  Droplets,
  RefreshCw,
  ShieldCheck,
  ExternalLink,
  Waves,
} from 'lucide-react';
import type { RegionId } from '@/types/sar';
import type { ClimateData } from '@/types/google-maps';
import { fmtNum, fmtUnit } from '@/lib/metrics';

interface ClimateTabProps {
  regionId: RegionId;
  regionName?: string;
  climate?: ClimateData;
  /** Scene-pair dates (ISO). The query window is 14 days before → 3 days after. */
  beforeDate?: string | null;
  afterDate?: string | null;
  /** [lng, lat] to query; defaults to the region's main town. */
  center?: [number, number] | null;
}

const DEFAULT_COORDS: Record<string, { lat: number; lon: number }> = {
  nagapattinam: { lat: 10.76, lon: 79.84 },
  majuli: { lat: 26.95, lon: 94.17 },
};

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Window from 14 days before the first scene to 3 days after the second, clipped to yesterday. */
function computeWindow(beforeDate?: string | null, afterDate?: string | null): { start: string; end: string } | null {
  const b = beforeDate ? new Date(beforeDate) : null;
  const a = afterDate ? new Date(afterDate) : null;
  if (!b || !a || isNaN(b.getTime()) || isNaN(a.getTime())) return null;
  const start = new Date(b.getTime() - 14 * 86400000);
  const yesterday = new Date(Date.now() - 86400000);
  const endRaw = new Date(a.getTime() + 3 * 86400000);
  const end = endRaw > yesterday ? yesterday : endRaw;
  if (end <= start) return null;
  return { start: toYmd(start), end: toYmd(end) };
}

interface DailyClimatePoint {
  date: string;
  displayDate: string;
  rainfall: number | null; // PRECTOTCORR in mm/day
  temp: number | null;     // T2M in °C
}

interface DailyDischargePoint {
  date: string;
  displayDate: string;
  discharge: number | null; // m3/s
}

export function ClimateTab(props: ClimateTabProps) {
  return <ClimateTabInner key={`${props.regionId}|${props.beforeDate ?? ''}|${props.afterDate ?? ''}`} {...props} />;
}

function ClimateTabInner({ regionId, beforeDate, afterDate, center }: ClimateTabProps) {
  const [dataPoints, setDataPoints] = useState<DailyClimatePoint[]>([]);
  const [dischargePoints, setDischargePoints] = useState<DailyDischargePoint[]>([]);
  const [loading, setLoading] = useState(true);
  // null = loaded OK; string = why it is unavailable. No synthetic fallback series.
  const [powerError, setPowerError] = useState<string | null>(null);
  const [dischargeError, setDischargeError] = useState<string | null>(null);
  const [peakRainfall, setPeakRainfall] = useState<{ value: number | null; date: string }>({ value: null, date: '' });
  const [peakDischarge, setPeakDischarge] = useState<{ value: number | null; date: string }>({ value: null, date: '' });
  const [meanTemp, setMeanTemp] = useState<number | null>(null);
  const [totalPrecip, setTotalPrecip] = useState<number | null>(null);

  const coords =
    center && Number.isFinite(center[0]) && Number.isFinite(center[1])
      ? { lat: Math.round(center[1] * 100) / 100, lon: Math.round(center[0] * 100) / 100 }
      : DEFAULT_COORDS[regionId] || DEFAULT_COORDS.nagapattinam;
  const queryWindow = computeWindow(beforeDate, afterDate);
  const dateRange = queryWindow
    ? { start: queryWindow.start.replace(/-/g, ''), end: queryWindow.end.replace(/-/g, '') }
    : null;

  function processPoints(points: DailyClimatePoint[]) {
    setDataPoints(points);

    let maxRain: number | null = null;
    let maxRainDate = '';
    let sumTemp = 0;
    let nTemp = 0;
    let sumRain = 0;
    let nRain = 0;

    points.forEach((p) => {
      if (p.rainfall !== null) {
        if (maxRain === null || p.rainfall > maxRain) {
          maxRain = p.rainfall;
          maxRainDate = p.displayDate;
        }
        sumRain += p.rainfall;
        nRain++;
      }
      if (p.temp !== null) {
        sumTemp += p.temp;
        nTemp++;
      }
    });

    setPeakRainfall({ value: maxRain, date: maxRainDate });
    setTotalPrecip(nRain ? Math.round(sumRain) : null);
    setMeanTemp(nTemp ? Math.round((sumTemp / nTemp) * 10) / 10 : null);
  }
  // Fetch from NASA POWER API & Open-Meteo Flood API directly in the browser.
  // On failure the chart shows "unavailable" — never a synthetic series.
  useEffect(() => {
    // State starts fresh for every region / scene pair because the wrapper
    // below re-mounts this component with a new key.
    let isMounted = true;

    const fetchClimateData = async () => {
      if (!queryWindow || !dateRange) {
        if (isMounted) {
          setPowerError('scene dates missing from summary_metrics.json');
          setDischargeError('scene dates missing from summary_metrics.json');
          setLoading(false);
        }
        return;
      }

      // 1. NASA POWER daily precipitation + 2 m temperature
      const powerUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,T2M&community=RE&longitude=${coords.lon}&latitude=${coords.lat}&start=${dateRange.start}&end=${dateRange.end}&format=JSON`;
      try {
        const response = await fetch(powerUrl, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`NASA POWER returned HTTP ${response.status}`);
        const json = await response.json();
        const precData = json?.properties?.parameter?.PRECTOTCORR as Record<string, number> | undefined;
        const tempData = json?.properties?.parameter?.T2M as Record<string, number> | undefined;
        const fill = json?.header?.fill_value ?? -999;

        const points: DailyClimatePoint[] = Object.keys(precData || {})
          .map((dateKey) => {
            const r = Number(precData?.[dateKey]);
            const t = Number(tempData?.[dateKey]);
            const d = new Date(Number(dateKey.slice(0, 4)), Number(dateKey.slice(4, 6)) - 1, Number(dateKey.slice(6, 8)));
            return {
              date: dateKey,
              displayDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              rainfall: Number.isFinite(r) && r !== fill ? Math.round(r * 10) / 10 : null,
              temp: Number.isFinite(t) && t !== fill ? Math.round(t * 10) / 10 : null,
            };
          })
          .filter((p) => p.rainfall !== null || p.temp !== null);

        if (points.length === 0) throw new Error('NASA POWER returned no valid values for this window yet');
        if (isMounted) processPoints(points);
      } catch (err) {
        console.warn('[ClimateTab] NASA POWER unavailable:', err);
        if (isMounted) setPowerError(err instanceof Error ? err.message : String(err));
      }

      // 2. Open-Meteo Flood API (GloFAS modelled river discharge, m³/s)
      const floodUrl = `https://flood-api.open-meteo.com/v1/flood?latitude=${coords.lat}&longitude=${coords.lon}&daily=river_discharge&start_date=${queryWindow.start}&end_date=${queryWindow.end}`;
      try {
        const floodRes = await fetch(floodUrl, { cache: 'force-cache' });
        if (!floodRes.ok) throw new Error(`Open-Meteo flood API returned HTTP ${floodRes.status}`);
        const floodJson = await floodRes.json();
        const times = (floodJson.daily?.time as string[]) || [];
        const discharges = (floodJson.daily?.river_discharge as (number | null)[]) || [];

        let maxQ: number | null = null;
        let maxQDate = '';
        const pts: DailyDischargePoint[] = times.map((t, i) => {
          const raw = discharges[i];
          const q = raw != null && Number.isFinite(raw) ? Math.round(raw * 10) / 10 : null;
          const displayDate = new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          if (q !== null && (maxQ === null || q > maxQ)) {
            maxQ = q;
            maxQDate = displayDate;
          }
          return { date: t, displayDate, discharge: q };
        });

        if (maxQ === null) throw new Error('no modelled discharge at this point for this window');
        if (isMounted) {
          setDischargePoints(pts);
          setPeakDischarge({ value: Math.round(maxQ), date: maxQDate });
        }
      } catch (err) {
        console.warn('[ClimateTab] Open-Meteo flood API unavailable:', err);
        if (isMounted) setDischargeError(err instanceof Error ? err.message : String(err));
      }

      if (isMounted) setLoading(false);
    };

    fetchClimateData();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionId, beforeDate, afterDate, coords.lat, coords.lon]);



  return (
    <div className="flex flex-col space-y-4 font-sans text-white select-none">
      {/* 1. TOP METRICS HEADER & SOURCE BADGES */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
            <CloudRain className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>NASA & GloFAS Hydrological Telemetry</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/70 text-cyan-300 border border-cyan-400/30">
                {coords.lat}°N, {coords.lon}°E
              </span>
            </h3>
            <p className="text-[11px] text-white/50">
              NASA POWER Precipitation & Open-Meteo GloFAS River Discharge
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          <span
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full border ${
              powerError
                ? 'bg-amber-950/60 border-amber-400/40 text-amber-300'
                : 'bg-emerald-950/60 border-emerald-400/40 text-emerald-300'
            }`}
            title={powerError ?? undefined}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{loading ? 'LOADING…' : powerError ? 'NASA POWER UNAVAILABLE' : 'NASA POWER API'}</span>
          </span>
        </div>
      </div>

      {/* 2. FOUR KEY HYDRO-CLIMATE KPI PILLS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* KPI 1: Peak Daily Rainfall */}
        <div className="p-3 rounded-2xl bg-black/40 border border-cyan-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between text-[11px] text-white/60 mb-0.5">
            <span className="flex items-center gap-1 font-medium text-cyan-300">
              <CloudRain className="w-3.5 h-3.5" />
              Peak Rain
            </span>
            <span className="text-[10px] text-white/40 font-mono">{peakRainfall.date}</span>
          </div>
          <div className="text-xl font-extrabold text-cyan-400 font-mono">
            {fmtNum(peakRainfall.value, 1)} <span className="text-xs font-normal text-white/60">mm/day</span>
          </div>
          <p className="text-[10px] text-white/40 mt-0.5">
            Max daily value in window
          </p>
        </div>

        {/* KPI 2: Peak River Discharge Surge */}
        <div className="p-3 rounded-2xl bg-black/40 border border-[#0055FF]/40 relative overflow-hidden">
          <div className="flex items-center justify-between text-[11px] text-white/60 mb-0.5">
            <span className="flex items-center gap-1 font-medium text-cyan-300">
              <Waves className="w-3.5 h-3.5" />
              Peak Discharge
            </span>
            <span className="text-[10px] text-cyan-400 font-mono">{peakDischarge.date}</span>
          </div>
          <div className="text-xl font-extrabold text-[#00E5FF] font-mono">
            {fmtNum(peakDischarge.value, 0)} <span className="text-xs font-normal text-white/60">m³/s</span>
          </div>
          <p className="text-[10px] text-white/40 mt-0.5 truncate">
            GloFAS model, nearest river cell
          </p>
        </div>

        {/* KPI 3: Cumulative Monsoon Rain */}
        <div className="p-3 rounded-2xl bg-black/40 border border-blue-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between text-[11px] text-white/60 mb-0.5">
            <span className="flex items-center gap-1 font-medium text-sky-300">
              <Droplets className="w-3.5 h-3.5" />
              Total Rain
            </span>
            <span className="text-[10px] text-sky-400 font-mono">SUM</span>
          </div>
          <div className="text-xl font-extrabold text-sky-400 font-mono">
            {fmtNum(totalPrecip, 0)} <span className="text-xs font-normal text-white/60">mm</span>
          </div>
          <p className="text-[10px] text-white/40 mt-0.5">
            Observation window total
          </p>
        </div>

        {/* KPI 4: Mean 2m Temperature */}
        <div className="p-3 rounded-2xl bg-black/40 border border-amber-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between text-[11px] text-white/60 mb-0.5">
            <span className="flex items-center gap-1 font-medium text-amber-300">
              <Thermometer className="w-3.5 h-3.5" />
              Mean Temp
            </span>
            <span className="text-[10px] text-amber-400 font-mono">AVG</span>
          </div>
          <div className="text-xl font-extrabold text-amber-400 font-mono">
            {fmtUnit(meanTemp, '°C', 1)}
          </div>
          <p className="text-[10px] text-white/40 mt-0.5">
            Mean 2 m air temperature
          </p>
        </div>
      </div>

      {/* 3a. RECHARTS FLOWING BLUE AREA CHART (GloFAS River Discharge & Water Level Surge) */}
      <div className="p-4 rounded-3xl bg-black/50 border border-white/10 space-y-2">
        <div className="flex items-center justify-between text-xs px-1">
          <div className="flex items-center gap-2">
            <Waves className="w-4 h-4 text-[#00E5FF]" />
            <span className="font-bold text-white">Modelled River Discharge (m³/s)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-950/60 border border-blue-400/30 text-blue-300">
              MAX: {fmtNum(peakDischarge.value, 0)} m³/s{peakDischarge.date ? ` (${peakDischarge.date})` : ''}
            </span>
            <span className="text-[10px] font-mono text-white/40">OPEN-METEO FLOOD API (GLOFAS)</span>
          </div>
        </div>

        <div className="w-full h-52 pt-2">
          {loading && dischargePoints.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center space-y-2 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
              <span className="text-xs font-mono text-cyan-300">LOADING DISCHARGE...</span>
            </div>
          ) : dischargeError ? (
            <div className="w-full h-full flex items-center justify-center text-center text-[11px] text-white/50 px-6">
              Discharge unavailable: {dischargeError}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dischargePoints} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="dischargeBlueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#0055FF" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis
                  dataKey="displayDate"
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={10}
                  tickLine={false}
                  interval={Math.ceil(dischargePoints.length / 7)}
                />
                <YAxis
                  stroke="rgba(0, 229, 255, 0.8)"
                  fontSize={10}
                  tickLine={false}
                  unit=" m³/s"
                  tickFormatter={(val) => val >= 1000 ? `${Math.round(val / 1000)}k` : val}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(9, 13, 26, 0.95)',
                    borderColor: 'rgba(0, 229, 255, 0.4)',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#fff',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.8)',
                  }}
                  formatter={(value: unknown) => [`${fmtNum(value, 0)} m³/s`, 'River Discharge']}
                />
                <Area
                  type="monotone"
                  dataKey="discharge"
                  name="River Discharge (m³/s)"
                  stroke="#00E5FF"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#dischargeBlueGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 3b. RECHARTS COMPOSED BAR & LINE CHART (Precipitation & Temp) */}
      <div className="p-4 rounded-3xl bg-black/50 border border-white/10 space-y-2">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="font-bold text-white flex items-center gap-1.5">
            <CloudRain className="w-4 h-4 text-cyan-400" />
            <span>Daily Rainfall Spikes & Temperature Profile</span>
          </span>
          <span className="text-[10px] font-mono text-white/40">
            Window: {queryWindow ? `${queryWindow.start} → ${queryWindow.end}` : '—'}
          </span>
        </div>

        <div className="w-full h-52 pt-2">
          {loading && dataPoints.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center space-y-2 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
              <span className="text-xs font-mono text-cyan-300">LOADING NASA POWER DAILY DATA...</span>
            </div>
          ) : powerError ? (
            <div className="w-full h-full flex items-center justify-center text-center text-[11px] text-white/50 px-6">
              NASA POWER data unavailable: {powerError}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dataPoints} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis
                  dataKey="displayDate"
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={10}
                  tickLine={false}
                  interval={Math.ceil(dataPoints.length / 7)}
                />
                <YAxis
                  yAxisId="left"
                  stroke="rgba(0, 229, 255, 0.8)"
                  fontSize={10}
                  tickLine={false}
                  unit="mm"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="rgba(245, 158, 11, 0.8)"
                  fontSize={10}
                  tickLine={false}
                  domain={[18, 38]}
                  unit="°C"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(9, 13, 26, 0.95)',
                    borderColor: 'rgba(0, 229, 255, 0.4)',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#fff',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.8)',
                  }}
                  formatter={(value: unknown, name: unknown) => [
                    String(name).includes('Precipitation') ? `${fmtNum(value, 1)} mm/day` : `${fmtNum(value, 1)} °C`,
                    String(name),
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
                  iconSize={10}
                />
                <Bar
                  yAxisId="left"
                  dataKey="rainfall"
                  name="Precipitation Rate (mm/day)"
                  fill="#00E5FF"
                  radius={[4, 4, 0, 0]}
                  opacity={0.85}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="temp"
                  name="2m Temperature (°C)"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 4. ATTRIBUTION & DATA PROTOCOL */}
      <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-[11px] text-white/50 font-mono">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <span>NASA LaRC POWER • Open-Meteo GloFAS River API</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://power.larc.nasa.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-cyan-300 hover:text-cyan-200 transition"
          >
            <span>power.larc.nasa.gov</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <span>•</span>
          <a
            href="https://open-meteo.com/en/docs/flood-api"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-300 hover:text-blue-200 transition"
          >
            <span>flood-api</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
