/**
 * Template (non-AI) report and the AI prompt, built ONLY from the values in
 * summary_metrics.json and the selected evidence polygon.
 *
 * The template is what the UI shows when Gemini is unavailable. It must never
 * contain numbers that are not in the metrics passed in, and it is always
 * labelled as a template in the UI (see AiReportTab).
 */
import type { EvidencePolygonProperties, SummaryMetrics } from '@/types/sar';
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
  isNum,
  provenanceRows,
} from './metrics';

export const GEMINI_MODEL = 'gemini-3.8-flash';
export const TEMPLATE_ENGINE = 'template';
export const GEMINI_TIMEOUT_MS = 45_000;

export interface ReportResponse {
  report: string;
  /** GEMINI_MODEL when the AI answered, TEMPLATE_ENGINE otherwise. */
  generatedWith: string;
  /** Short human-readable reason when generatedWith === TEMPLATE_ENGINE. */
  fallbackReason?: string;
  timestamp: string;
}

function classLines(metrics: SummaryMetrics): string[] {
  const entries = Object.entries(metrics.classes ?? {})
    .filter(([, c]) => !!c)
    .sort(([a], [b]) => Number(a) - Number(b));
  if (entries.length === 0) return ['- No class statistics in summary_metrics.json.'];
  return entries.map(([id, c]) => {
    const name = fmtText(c?.name);
    return `- Class ${id} (${name}): ${fmtNum(c?.area_km2, 2)} km² (${fmtPct(c?.percentage)} of scene), ${fmtNum(c?.pixel_count)} pixels`;
  });
}

function validationLines(metrics: SummaryMetrics): string[] {
  const v = metrics.validation_stats ?? {};
  const rows: Array<[string, unknown, string]> = [
    ['Speckle filter window', v.lee_filter_window, ''],
    ['Equivalent number of looks', v.equivalent_number_of_looks, ''],
    ['Speckle suppression index', v.speckle_suppression_index, ''],
    ['Co-registration RMSE (root-mean-square error)', v.coregistration_rmse_m, ' m'],
    ['Radiometric resolution', v.radiometric_resolution_db, ' dB'],
  ];
  return rows
    .filter(([, val]) => val !== null && val !== undefined && val !== '')
    .map(([label, val, unit]) => `- ${label}: ${String(val)}${unit}`);
}

function polygonLines(p: EvidencePolygonProperties): string[] {
  return [
    `- Feature ID: ${fmtText(p.id)} (${fmtText(p.class_name)})`,
    `- Centroid: ${fmtLatLng(p.centroid)}`,
    `- Area: ${fmtNum(p.area_km2, 3)} km² (${fmtNum(p.area_hectares, 1)} ha)`,
    `- HH backscatter: before ${fmtDb(p.before_hh_db)}, after ${fmtDb(p.after_hh_db)}, change ${fmtDb(p.delta_hh_db)}`,
    `- Robustness score (share of pixels passing the class test by ≥1 dB; not a probability): ${fmtPct01(p.confidence)}`,
    ...(p.driver_hypothesis ? [`- Pipeline note: ${p.driver_hypothesis}`] : []),
  ];
}

/** Plain-text facts block shared by the AI prompt and the template. */
export function metricsFactSheet(metrics: SummaryMetrics, selectedPolygon?: EvidencePolygonProperties | null): string {
  const lines = [
    `Region: ${fmtText(metrics.region_name)} (${fmtText(metrics.region_id)})`,
    `Data source: ${dataModeLabel(metrics)}`,
    `Scene pair: ${fmtDate(metrics.before_date)} (before) → ${fmtDate(metrics.after_date)} (after)`,
    `Before granule: ${fmtText(metrics.before_granule)}`,
    `After granule: ${fmtText(metrics.after_granule)}`,
    `Orbit: ${fmtOrbit(metrics)}`,
    `Radar band: ${fmtText(metrics.radar_band)}; polarisation: ${fmtText(metrics.polarization)}`,
    `Incidence angle range: ${fmtRange(metrics.incidence_angles, '°')}`,
    `Description: ${fmtText(metrics.flood_event)}`,
    `Scene area analysed: ${fmtNum(metrics.total_swath_area_km2, 2)} km²`,
    ...(isNum(metrics.permanent_water_km2) ? [`Permanent water (present in both scenes): ${fmtNum(metrics.permanent_water_km2, 2)} km²`] : []),
    'Change classes:',
    ...classLines(metrics),
  ];
  const v = validationLines(metrics);
  if (v.length) lines.push('Processing statistics that were computed:', ...v);
  const prov = provenanceRows(metrics.provenance);
  if (prov.length) lines.push('Provenance:', ...prov.map((r) => `- ${r.key}: ${r.value}`));
  if (selectedPolygon) lines.push('Selected evidence polygon:', ...polygonLines(selectedPolygon));
  return lines.join('\n');
}

export function buildAiPrompt(
  metrics: SummaryMetrics,
  userQuestion: string,
  selectedPolygon?: EvidencePolygonProperties | null
): string {
  const system = `You are a radar remote-sensing analyst writing a short briefing about a NISAR (NASA-ISRO Synthetic Aperture Radar) L-band before/after scene pair.
Rules:
- Use ONLY the numbers given below. Do not invent statistics, accuracies, populations, road names, depths, discharge values or event names.
- A value shown as "${DASH}" was not computed; say so rather than estimating it.
- The change classes come from a rule-based backscatter change detection with no ground-truth validation; describe them as candidate changes, not confirmed floods.
- General radar physics (specular reflection from calm water, double-bounce from flooded vegetation, speckle) may be explained qualitatively.
- If the data source is synthetic/demo, say clearly that the figures are not real observations.
- Format as concise Markdown with headings and bullet points.`;
  return `${system}

--- METRICS ---
${metricsFactSheet(metrics, selectedPolygon)}
--- END METRICS ---

User question / focus: ${userQuestion || 'General summary of what changed between the two acquisitions and the limitations of this analysis.'}`;
}

/**
 * Deterministic fallback report. Quotes only values from `metrics` and the
 * selected polygon; everything else is generic, qualitative radar physics.
 */
export function buildTemplateReport(
  metrics: SummaryMetrics,
  userQuestion: string,
  selectedPolygon: EvidencePolygonProperties | null | undefined,
  reason: string
): string {
  const c1 = metrics.classes?.['1'];
  const c2 = metrics.classes?.['2'];
  const changed = [c1, c2, metrics.classes?.['3'], metrics.classes?.['4']]
    .map((c) => c?.area_km2)
    .filter(isNum);
  const changedSum = changed.length ? changed.reduce((a, b) => a + b, 0) : null;

  return `# Template summary — ${fmtText(metrics.region_name)}
Not an AI analysis. Generated from summary_metrics.json because the AI model was unavailable (${reason}).

**Data source:** ${dataModeLabel(metrics)}
**Before → after:** ${fmtDate(metrics.before_date)} → ${fmtDate(metrics.after_date)}
**Orbit:** ${fmtOrbit(metrics)}
**Description:** ${fmtText(metrics.flood_event)}

---

### 1. Change classes (from summary_metrics.json)
${classLines(metrics).join('\n')}
- Sum of classes 1–4 (all candidate changes): ${changedSum === null ? DASH : `${changedSum.toFixed(2)} km²`} of ${fmtNum(metrics.total_swath_area_km2, 2)} km² analysed

### 2. How to read the classes (general radar physics)
- **Darkening (backscatter drop):** calm open water reflects the radar pulse away from the sensor, so newly flooded open ground usually gets darker.
- **Brightening under vegetation:** standing water beneath trees or crops can form a "double-bounce" corner reflector between stems and the water surface, so flooded vegetation can get brighter. L-band (about 24 cm wavelength) penetrates canopies better than shorter C-band radar.
- **Caveats:** wind-roughened water, wet soil, crop growth, harvesting and speckle noise can all mimic these signals. These classes have not been checked against ground truth.

${validationLines(metrics).length ? `### 3. Processing statistics reported by the pipeline\n${validationLines(metrics).join('\n')}\n` : ''}${
    selectedPolygon ? `\n### Selected polygon\n${polygonLines(selectedPolygon).join('\n')}\n` : ''
  }${userQuestion ? `\nYour question ("${userQuestion}") was not answered: the template cannot interpret it. Retry when the AI model is available.` : ''}`;
}
