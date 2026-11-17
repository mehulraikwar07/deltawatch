'use client';

import React, { useState } from 'react';
import type { SummaryMetrics } from '@/types/sar';
import { fmtNum } from '@/lib/metrics';

interface Row {
  key: string;
  label: string;
  color: string;
  area?: number | null;
  faint?: boolean;
  outline?: boolean;
}

/** Map key for the colours actually drawn on the map, with the area of each. */
export function MapLegend({ metrics }: { metrics: SummaryMetrics }) {
  const [open, setOpen] = useState(true);
  const isFlood = metrics.comparison_mode === 'dry_reference_vs_monsoon';
  const c = metrics.classes || {};
  const cls = (id: number) => c[String(id)];

  const rows: Row[] = isFlood
    ? [
        { key: 'river', label: 'Normal water (dry-season reference)', color: '#143CAA', area: metrics.permanent_water_km2 },
        { key: '1', label: cls(1)?.name ?? 'Floodwater', color: cls(1)?.hex ?? '#00F0FF', area: cls(1)?.area_km2, outline: true },
        { key: '2', label: cls(2)?.name ?? 'Flooded vegetation', color: cls(2)?.hex ?? '#FF2E93', area: cls(2)?.area_km2, outline: true },
        { key: '3', label: cls(3)?.name ?? 'Standing water away from river', color: cls(3)?.hex ?? '#FFC440', area: cls(3)?.area_km2, faint: true },
      ]
    : [1, 2, 3, 4].map((id) => ({
        key: String(id),
        label: cls(id)?.name ?? `Class ${id}`,
        color: cls(id)?.hex ?? '#FFFFFF',
        area: cls(id)?.area_km2,
        outline: true,
      }));
  const hidden = isFlood ? cls(4) : null;

  return (
    <div className="absolute bottom-16 left-5 z-20 pointer-events-auto w-[284px] bg-[#1E1F22]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-white/85 cursor-pointer"
      >
        <span>Map key</span>
        <span className="text-white/40 text-[10px]">{open ? 'hide' : 'show'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1.5">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-2 text-[11px]">
              <span
                className="w-3.5 h-3.5 rounded-sm shrink-0"
                style={{
                  background: r.color,
                  opacity: r.faint ? 0.55 : 1,
                  boxShadow: r.outline ? '0 0 0 1.5px #000, 0 0 0 2.5px ' + r.color : undefined,
                }}
              />
              <span className="flex-1 text-white/80 leading-tight">{r.label}</span>
              <span className="font-mono tabular-nums text-white/60">{fmtNum(r.area, 1)} km²</span>
            </div>
          ))}
          {hidden && (
            <div className="text-[10px] text-white/40 pt-1 border-t border-white/10 leading-snug">
              Not drawn: {hidden.name} ({fmtNum(hidden.area_km2, 0)} km²): crops and soil changing, not flooding.
            </div>
          )}
          {isFlood && (
            <div className="text-[10px] text-white/40 leading-snug">
              Floodwater counts only water connected to the main river or sea network.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
