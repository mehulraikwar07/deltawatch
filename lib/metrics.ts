/**
 * Helpers for reading summary_metrics.json / evidence polygons safely.
 *
 * Every value that the processing pipeline did not actually compute is `null`
 * in the JSON. These helpers turn null / missing / NaN into an em dash so the
 * UI never shows an invented number and never crashes on a missing field.
 */
import type {
  ClassSummaryStat,
  EvidencePolygonProperties,
  SummaryMetrics,
} from '@/types/sar';

export const DASH = '—';

export function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Coerce number-ish values (MapLibre stringifies some feature properties). */
export function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Format a number, or return an em dash when it is null / missing / NaN. */
export function fmtNum(v: unknown, digits?: number): string {
  const n = toNum(v);
  if (n === null) return DASH;
  if (digits === undefined) return n.toLocaleString('en-US', { maximumFractionDigits: 3 });
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Number with unit; whole thing collapses to an em dash when missing. */
export function fmtUnit(v: unknown, unit: string, digits?: number): string {
  const s = fmtNum(v, digits);
  return s === DASH ? DASH : `${s}${unit.startsWith('%') || unit.startsWith('°') ? '' : ' '}${unit}`;
}

/** Signed dB value (e.g. "+3.2 dB"). */
export function fmtDb(v: unknown, digits = 2): string {
  const n = toNum(v);
  if (n === null) return DASH;
  return `${n > 0 ? '+' : ''}${n.toFixed(digits)} dB`;
}

/** A value that is already a percentage (0..100). */
export function fmtPct(v: unknown, digits = 2): string {
  const s = fmtNum(v, digits);
  return s === DASH ? DASH : `${s}%`;
}

/** 0..1 confidence as a percentage. */
export function fmtPct01(v: unknown, digits = 0): string {
  const n = toNum(v);
  return n === null ? DASH : `${(n * 100).toFixed(digits)}%`;
}

/** ISO timestamp -> YYYY-MM-DD, or em dash. */
export function fmtDate(v: unknown): string {
  if (typeof v !== 'string' || !v) return DASH;
  return v.split('T')[0] || DASH;
}

export function fmtText(v: unknown): string {
  if (v === null || v === undefined) return DASH;
  const s = String(v).trim();
  return s ? s : DASH;
}

export function fmtRange(r: unknown, unit = ''): string {
  if (!Array.isArray(r) || r.length < 2) return DASH;
  const a = toNum(r[0]);
  const b = toNum(r[1]);
  if (a === null || b === null) return DASH;
  return `${a}${unit}–${b}${unit}`;
}

/** Track / frame / direction line, skipping missing parts. */
export function fmtOrbit(m: Pick<SummaryMetrics, 'orbit_track' | 'frame_number' | 'orbit_direction'>): string {
  const parts: string[] = [];
  if (isNum(m.orbit_track)) parts.push(`Track ${String(m.orbit_track).padStart(3, '0')}`);
  if (isNum(m.frame_number)) parts.push(`Frame ${String(m.frame_number).padStart(3, '0')}`);
  if (m.orbit_direction) parts.push(String(m.orbit_direction));
  return parts.length ? parts.join(' • ') : DASH;
}

/** A class entry, or null when the pipeline did not emit it. */
export function getClass(m: SummaryMetrics, id: number | string): ClassSummaryStat | null {
  const c = m.classes?.[String(id)];
  return c ?? null;
}

export function isRealData(m: Pick<SummaryMetrics, 'data_mode'>): boolean {
  return m.data_mode === 'real_nisar_gcov';
}

export function dataModeLabel(m: Pick<SummaryMetrics, 'data_mode'>): string {
  if (isRealData(m)) return 'Real NISAR L2 GCOV';
  if (!m.data_mode) return 'Unknown data source';
  return `Synthetic / demo data (${m.data_mode})`;
}

/**
 * Flatten an arbitrary provenance object into display rows. Only primitives
 * and arrays of primitives are shown verbatim; nested objects are compacted.
 */
export function provenanceRows(p: unknown): Array<{ key: string; value: string }> {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return [];
  const rows: Array<{ key: string; value: string }> = [];
  const walk = (obj: Record<string, unknown>, prefix: string, depth: number) => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v === null || v === undefined) {
        rows.push({ key, value: DASH });
      } else if (Array.isArray(v)) {
        const allPrim = v.every((x) => x === null || ['string', 'number', 'boolean'].includes(typeof x));
        rows.push({ key, value: allPrim ? v.map((x) => fmtText(x)).join(', ') : JSON.stringify(v) });
      } else if (typeof v === 'object') {
        if (depth < 1) walk(v as Record<string, unknown>, key, depth + 1);
        else rows.push({ key, value: JSON.stringify(v) });
      } else {
        rows.push({ key, value: String(v) });
      }
    }
  };
  walk(p as Record<string, unknown>, '', 0);
  return rows;
}

/**
 * Normalise polygon properties coming from GeoJSON or a MapLibre feature
 * (which serialises arrays as JSON strings and may drop nulls).
 */
export function normalizePolygonProps(raw: Record<string, unknown>): EvidencePolygonProperties {
  let centroid: [number, number] | null = null;
  let c: unknown = raw.centroid;
  if (typeof c === 'string') {
    try {
      c = JSON.parse(c);
    } catch {
      c = null;
    }
  }
  if (Array.isArray(c) && c.length >= 2) {
    const lng = toNum(c[0]);
    const lat = toNum(c[1]);
    if (lng !== null && lat !== null) centroid = [lng, lat];
  }
  const geometryLock = raw.geometry_lock;
  return {
    id: fmtText(raw.id),
    class_id: toNum(raw.class_id) ?? -1,
    class_name: fmtText(raw.class_name),
    area_km2: toNum(raw.area_km2),
    area_hectares: toNum(raw.area_hectares),
    before_hh_db: toNum(raw.before_hh_db),
    after_hh_db: toNum(raw.after_hh_db),
    delta_hh_db: toNum(raw.delta_hh_db),
    confidence: toNum(raw.confidence),
    centroid,
    driver_hypothesis:
      typeof raw.driver_hypothesis === 'string' && raw.driver_hypothesis.trim() ? raw.driver_hypothesis : null,
    radar_band: typeof raw.radar_band === 'string' ? raw.radar_band : null,
    geometry_lock: typeof geometryLock === 'boolean' ? geometryLock : geometryLock === 'true' ? true : null,
  };
}

export function fmtLatLng(c: [number, number] | null | undefined, digits = 4): string {
  if (!c || !isNum(c[0]) || !isNum(c[1])) return DASH;
  return `${c[1].toFixed(digits)}°N, ${c[0].toFixed(digits)}°E`;
}
