export const dynamic = 'force-dynamic';

import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';
import { NextResponse } from 'next/server';
import type { SummaryMetrics, EvidencePolygonProperties } from '@/types/sar';
import {
  GEMINI_MODEL,
  TEMPLATE_ENGINE,
  buildTemplateReport,
  type ReportResponse,
} from '@/lib/reportTemplate';

// PREVENTS LOCAL MACBOOK NETWORK TIMEOUTS (HTTP 500: fetch failed)
dns.setDefaultResultOrder('ipv4first');

interface ReportRequestBody {
  metrics: SummaryMetrics;
  selectedPolygon?: EvidencePolygonProperties | null;
  prompt?: string;
  customFocus?: string;
}

/** Server-side key only. Reads environment variable with direct .env.local fallback */
function readApiKey(): string {
  let rawKey = process.env.GEMINI_API_KEY || '';
  if (!rawKey) {
    try {
      const envPath = path.join(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        const match = content.match(/GEMINI_API_KEY=["']?([^"'\r\n]+)["']?/);
        if (match) rawKey = match[1];
      }
    } catch {
      // ignore
    }
  }
  return rawKey.replace(/^["']|["']$/g, '').trim();
}

export async function POST(req: Request) {
  try {
    const body: ReportRequestBody = await req.json();
    const { prompt: reqPrompt, customFocus, metrics, selectedPolygon } = body;

    if (!metrics) {
      return NextResponse.json(
        { error: 'Missing summary metrics in request body', status: 400 },
        { status: 400 }
      );
    }

    const userPrompt = (reqPrompt || customFocus || '').trim();
    const apiKey = readApiKey();

    if (!apiKey) {
      const fallbackReason = 'no GEMINI_API_KEY configured on the server (.env.local)';
      return NextResponse.json({
        report: buildTemplateReport(metrics, userPrompt, selectedPolygon, fallbackReason),
        generatedWith: TEMPLATE_ENGINE,
        fallbackReason,
        timestamp: new Date().toISOString(),
      });
    }

    // Structured aerospace system instruction with strictly conditional logic
    const systemInstruction = `You are the Lead Radar Hydrologist for DELTAWATCH, an operational NASA Space Apps Challenge 2026 platform ("Dancing with the SARs").
You analyze active NISAR L-Band (1.25 GHz / 24 cm wavelength) dual-polarimetric (HH+HV) L2 GCOV (Geocoded Co-Polarized Backscatter) observation datasets for Indian delta basins.

CRITICAL RESPONSE RULES:
1. CASUAL GREETINGS (e.g., "hi", "hello", "hey"): Reply with a warm, 1-2 sentence greeting introducing yourself as the Lead Radar Hydrologist. Do NOT generate a structured report.
2. SPECIFIC QUESTIONS (e.g., "what is dihedral double-bounce?", "how much area is flooded?"): Answer concisely in 2-3 sentences using only the relevant telemetry provided below.
3. FULL REPORTS (e.g., "summary", "briefing", "report", or clicked analysis topics): Generate a comprehensive, sectioned Operational Situation Summary with quantitative metrics.

STRICT FORMATTING REQUIREMENTS:
- Output clean, professional Markdown with clear section headings (## or ###), bold highlights, and bullet points (when generating a report).
- NEVER use LaTeX math syntax or delimiters. Do NOT use $, \\Delta, \\text{}, \\approx, \\le, or \\ge.
- Always use standard Unicode symbols instead: ΔHH, ≤, ≥, ~, →, dB, km², and ha.`;

    const c1 = metrics.classes?.['1'] || { area_km2: 0, percentage: 0 };
    const c2 = metrics.classes?.['2'] || { area_km2: 0, percentage: 0 };
    const c3 = metrics.classes?.['3'] || { area_km2: 0, percentage: 0 };
    const c4 = metrics.classes?.['4'] || { area_km2: 0, percentage: 0 };

    const telemetryContext = `ACTIVE NISAR L2 GCOV MISSION TELEMETRY:
- Target Delta / Basin: ${metrics.region_name} (ID: ${metrics.region_id})
- Observation Baseline: ${metrics.before_date?.split('T')[0] || 'Pre-Event'} → ${metrics.after_date?.split('T')[0] || 'Post-Event'}
- Relative Orbit Track: ${metrics.orbit_track}, Frame: ${metrics.frame_number}, Direction: ${metrics.orbit_direction} Orbit
- Total Observed Swath: ${metrics.total_swath_area_km2} km²
- Classification Footprint:
  * Class 1 (Open Floodwater / Specular Extinction): ${c1.area_km2} km² (${c1.percentage}% of swath)
  * Class 2 (Flooded Canopy / Dihedral Double-Bounce): ${c2.area_km2} km² (${c2.percentage}% of swath)
  * Class 3 (Managed Agricultural Inundation / Paddy): ${c3.area_km2} km² (${c3.percentage}% of swath)
  * Class 4 (Wetland Drying / Sandbars): ${c4.area_km2} km² (${c4.percentage}% of swath)
${selectedPolygon ? `- Currently Inspected Feature:
  * Feature ID: ${selectedPolygon.id} (${selectedPolygon.class_name})
  * GPS Coordinates: ${selectedPolygon.centroid?.[1]?.toFixed(5)}°N, ${selectedPolygon.centroid?.[0]?.toFixed(5)}°E
  * Spatial Area: ${selectedPolygon.area_km2} km² (${selectedPolygon.area_hectares} ha)
  * Radiometric Backscatter Shift: Pre-HH ${selectedPolygon.before_hh_db} dB → Post-HH ${selectedPolygon.after_hh_db} dB (ΔHH = ${selectedPolygon.delta_hh_db} dB)
  * Multi-look Confidence: ${selectedPolygon.confidence != null ? (selectedPolygon.confidence * 100).toFixed(0) + '%' : 'N/A'}
  * Hypothesis: ${selectedPolygon.driver_hypothesis}` : '- No individual polygon selected (analyzing full basin swath).'}

USER QUESTION / FOCUS:
${userPrompt || 'Provide an executive science briefing evaluating the flood extent, radar scattering mechanisms, and critical vulnerabilities across this delta.'}`;

    const requestPayload = {
      system_instruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: telemetryContext }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2500,
      },
    };

    // Call Google Gemini REST API via fetch with 'x-goog-api-key' in HTTP headers
    let apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    let res = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestPayload),
    });

    // If Gemini 2.5 Flash returns 404, fall back to Gemini 3.5 Flash / 3.8 Flash
    if (res.status === 404) {
      apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';
      const retryRes = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestPayload),
      });
      res = retryRes;
    }

    if (!res.ok) {
      const errorText = await res.text();
      let errorJson: any = null;
      try {
        errorJson = JSON.parse(errorText);
      } catch {}
      const errorMessage =
        errorJson?.error?.message ||
        errorJson?.message ||
        errorText ||
        `Gemini API request failed with HTTP ${res.status}`;

      console.warn(`Gemini API call failed (HTTP ${res.status}): ${errorMessage}. Falling back to template.`);
      return NextResponse.json({
        report: buildTemplateReport(metrics, userPrompt, selectedPolygon, errorMessage.slice(0, 120)),
        generatedWith: TEMPLATE_ENGINE,
        fallbackReason: errorMessage.slice(0, 120),
        timestamp: new Date().toISOString(),
      });
    }

    const data = await res.json();
    const reportText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reportText || reportText.trim().length === 0) {
      const fallbackReason = 'Gemini returned an empty text payload';
      return NextResponse.json({
        report: buildTemplateReport(metrics, userPrompt, selectedPolygon, fallbackReason),
        generatedWith: TEMPLATE_ENGINE,
        fallbackReason,
        timestamp: new Date().toISOString(),
      });
    }

    const out: ReportResponse = {
      report: reportText,
      generatedWith: GEMINI_MODEL,
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(out);
  } catch (error: any) {
    const detail = error?.cause?.message || error?.cause?.code || error?.message || 'Unknown network error';
    console.error('API /api/report error:', detail);

    return NextResponse.json(
      {
        error: `Network/Server Error: ${detail}`,
        status: 500,
      },
      { status: 500 }
    );
  }
}
