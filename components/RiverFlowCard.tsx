'use client';

import React, { useEffect, useState } from 'react';
import type { SummaryMetrics } from '@/types/sar';
import { fmtNum } from '@/lib/metrics';

interface FlowSeries {
  kind?: 'discharge' | 'rainfall';
  unit?: string;
  rain_between_passes_mm?: number;
  source: string;
  location: { name: string };
  daily: { date: string; discharge: number | null }[];
  nisar_passes: { date: string; discharge: number | null }[];
  dry_date: string;
  flood_date: string;
}

const fmtShort = (d: string) =>
  new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Small chart of model river discharge with the NISAR passes marked; shown only when the
 * pipeline wrote flood_timeseries.json for this region. */
export function RiverFlowCard({ regionId, metrics }: { regionId: string; metrics: SummaryMetrics }) {
  const [series, setSeries] = useState<FlowSeries | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/processed/${regionId}/flood_timeseries.json?v=${metrics.processed_at}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && setSeries(j))
      .catch(() => alive && setSeries(null));
    return () => {
      alive = false;
    };
  }, [regionId, metrics.processed_at]);

  if (!series || !series.daily?.length) return null;
  const pts = series.daily.filter((d) => typeof d.discharge === 'number') as { date: string; discharge: number }[];
  if (pts.length < 2) return null;

  const W = 260, H = 84, P = 6;
  const t0 = Date.parse(pts[0].date), t1 = Date.parse(pts[pts.length - 1].date);
  const qMax = Math.max(...pts.map((p) => p.discharge));
  const x = (d: string) => P + ((Date.parse(d) - t0) / (t1 - t0)) * (W - 2 * P);
  const y = (q: number) => H - P - (q / qMax) * (H - 2 * P);
  const isRain = series.kind === 'rainfall';
  const barW = Math.max(1, (W - 2 * P) / pts.length - 0.4);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.discharge).toFixed(1)}`).join(' ');
  const area = `${path} L${x(pts[pts.length - 1].date).toFixed(1)},${H - P} L${x(pts[0].date).toFixed(1)},${H - P} Z`;
  const flood = metrics.classes?.['1']?.area_km2;
  const qd = metrics.river_discharge_m3s?.dry_date;
  const qf = metrics.river_discharge_m3s?.flood_date;
  const mark = (d: string, color: string) => {
    const q = series.daily.find((p) => p.date === d)?.discharge;
    return typeof q === 'number' ? { cx: x(d), cy: y(q), color } : null;
  };
  const dry = mark(series.dry_date, '#60A5FA');
  const fl = mark(series.flood_date, '#00F0FF');

  return (
    <div className="absolute top-28 left-5 z-20 pointer-events-auto w-[284px] bg-[#1E1F22]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-2xl text-white hidden md:block">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold text-white/85">{isRain ? 'Daily rainfall, 2026' : 'River flow, 2026'}</span>
        <span className="text-[9px] text-white/40">{isRain ? 'ERA5 model, mm/day' : 'GloFAS model, m³/s'}</span>
      </div>
      <svg width={W} height={H} className="mt-1 block">
        {isRain ? (
          pts.map((p) => (
            <rect key={p.date} x={x(p.date) - barW / 2} y={y(p.discharge)} width={barW} height={H - P - y(p.discharge)} fill="#38BDF8" opacity={0.8} />
          ))
        ) : (
          <>
            <path d={area} fill="rgba(0,240,255,0.12)" />
            <path d={path} fill="none" stroke="#38BDF8" strokeWidth={1.4} />
          </>
        )}
        {[series.dry_date, series.flood_date].map((d, i) => (
          <line key={d} x1={x(d)} x2={x(d)} y1={P} y2={H - P} stroke={i ? '#00F0FF' : '#60A5FA'} strokeWidth={1} strokeDasharray="2 2" />
        ))}
        {!isRain && series.nisar_passes.map((p) =>
          typeof p.discharge === 'number' ? (
            <circle key={p.date} cx={x(p.date)} cy={y(p.discharge)} r={1.8} fill="rgba(255,255,255,0.55)" />
          ) : null
        )}
        {!isRain && dry && <circle cx={dry.cx} cy={dry.cy} r={4} fill={dry.color} stroke="#000" strokeWidth={1} />}
        {!isRain && fl && <circle cx={fl.cx} cy={fl.cy} r={4.5} fill={fl.color} stroke="#000" strokeWidth={1} />}
      </svg>
      {isRain ? (
        <div className="text-[10px] text-white/60 mt-1">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1" />
          {fmtShort(series.dry_date)} → <span className="inline-block w-2 h-2 rounded-full bg-cyan-300 mx-1" />
          {fmtShort(series.flood_date)}:{' '}
          <strong className="text-white/85">{fmtNum(series.rain_between_passes_mm, 0)} mm</strong> of rain in between
        </div>
      ) : (
        <div className="flex justify-between text-[10px] text-white/60 mt-1 tabular-nums">
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-300 mr-1" />
            {fmtShort(series.flood_date)}: {fmtNum(qf, 0)}
          </span>
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1" />
            {fmtShort(series.dry_date)}: {fmtNum(qd, 0)}
          </span>
        </div>
      )}
      {typeof flood === 'number' && (
        <div className="mt-2 pt-2 border-t border-white/10 text-[11px] text-white/80">
          Floodwater on {fmtShort(series.flood_date)}:{' '}
          <strong className="text-cyan-300 font-mono">{fmtNum(flood, 0)} km²</strong>
        </div>
      )}
      <div className="text-[9px] text-white/35 mt-1">{isRain ? 'Dashed lines = the two NISAR passes' : 'White dots = NISAR passes on this track'}</div>
    </div>
  );
}
