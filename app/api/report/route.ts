export const dynamic = 'force-dynamic';

import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import type { SummaryMetrics, EvidencePolygonProperties } from '@/types/sar';

interface ReportRequestBody {
  metrics: SummaryMetrics;
  selectedPolygon?: EvidencePolygonProperties | null;
  prompt?: string;
  customFocus?: string;
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

    // 1. Read GEMINI_API_KEY from environment or directly from .env.local
    let rawKey = process.env.GEMINI_API_KEY || '';
    if (!rawKey) {
      try {
        const envPath = path.join(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, 'utf-8');
          const match = content.match(/GEMINI_API_KEY=["']?([^"'\r\n]+)["']?/);
          if (match) {
            rawKey = match[1];
          }
        }
      } catch (e) {
        console.warn('Could not read .env.local fallback', e);
      }
    }

    const apiKey = rawKey.replace(/^["']|["']$/g, '').trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'GEMINI_API_KEY is missing from environment. Please add your GEMINI_API_KEY to .env.local.',
          status: 401,
        },
        { status: 401 }
      );
    }

    // 2. Build structured aerospace system instruction and dynamic telemetry prompt
    const systemInstruction = `You are the Lead Radar Hydrologist for DELTAWATCH, an operational NASA Space Apps Challenge 2026 platform ("Dancing with the SARs").
You analyze active NISAR L-Band (1.25 GHz / 24 cm wavelength) dual-polarimetric (HH+HV) L2 GCOV (Geocoded Co-Polarized Backscatter) observation datasets for Indian delta basins.

CORE RULES:
1. Directly answer the user's specific question first with actionable, quantitative insights based on the provided calibrated telemetry.
2. Incorporate exact radar scattering physics when relevant:
   - Specular Reflection (ΔHH ≤ -3.5 dB): Smooth open floodwaters acting as a mirror, deflecting pulses away from antenna.
   - Dihedral Double-Bounce (ΔHH ≥ +2.5 dB): Standing floodwater under mangrove/forest canopies reflecting between vertical trunks and horizontal water plane.
   - Volume / Canopy Scattering: Attenuation through vegetation layers.
   - Ground Inundation: Managed agricultural bunds, paddy crop submergence tolerances (48-72h limit).
3. Ground answers with the provided active scene data: region name, swath area, class breakdowns, and inspected polygon metrics if provided.
4. STRICT FORMATTING REQUIREMENTS:
   - Output clean, professional Markdown with clear section headings (## or ###), bold highlights, and bullet points.
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
  * Multi-look Confidence: ${(selectedPolygon.confidence * 100).toFixed(0)}%
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

    // 3. Call Google Gemini REST API via fetch with 'x-goog-api-key' in HTTP headers (no ?key= in URL)
    let apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    let res = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestPayload),
    });

    // If Gemini 2.5 Flash returns 404 (model retired for newly issued Google AI Studio keys), automatically try Gemini 3.5 Flash
    if (res.status === 404) {
      console.log('gemini-2.5-flash returned 404, falling back to gemini-3.5-flash endpoint');
      apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';
      const retryRes = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestPayload),
      });
      if (retryRes.ok) {
        res = retryRes;
      } else {
        // If retry failed as well, capture its error response
        res = retryRes;
      }
    }

    // 4. Return exact error status and message if API fails (NO silent fallback)
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

      console.error(`Gemini API Error (HTTP ${res.status}):`, errorMessage);

      return NextResponse.json(
        {
          error: errorMessage,
          status: res.status,
          endpoint: apiEndpoint,
        },
        { status: res.status }
      );
    }

    const data = await res.json();
    const reportText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reportText || reportText.trim().length === 0) {
      return NextResponse.json(
        {
          error: 'Gemini API returned an empty text payload.',
          status: 502,
        },
        { status: 502 }
      );
    }

    // Return successful AI generation
    return NextResponse.json({
      report: reportText,
      model: data?.modelVersion || 'gemini-flash',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('API /api/report unexpected server error:', error);
    return NextResponse.json(
      {
        error: error?.message || String(error) || 'Internal server error while calling Gemini API',
        status: 500,
      },
      { status: 500 }
    );
  }
}
