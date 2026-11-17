export const dynamic = 'force-dynamic';

import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import type { SummaryMetrics, EvidencePolygonProperties } from '@/types/sar';
import {
  GEMINI_MODEL,
  GEMINI_TIMEOUT_MS,
  TEMPLATE_ENGINE,
  buildAiPrompt,
  buildTemplateReport,
  type ReportResponse,
} from '@/lib/reportTemplate';

interface ReportRequestBody {
  regionId?: string;
  metrics: SummaryMetrics;
  selectedPolygon?: EvidencePolygonProperties | null;
  customFocus?: string;
  prompt?: string;
}

/** Server-side key only. Never use a NEXT_PUBLIC_ variable for this: it would ship to the browser. */
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
      // ignore: treated as "no key configured"
    }
  }
  return rawKey.replace(/^["']|["']$/g, '').trim();
}

function shortReason(err: unknown): string {
  if (err instanceof Error && (err.name === 'AbortError' || /abort|timed? ?out/i.test(err.message))) {
    return `Gemini timed out after ${GEMINI_TIMEOUT_MS / 1000} s`;
  }
  let msg = err instanceof Error ? err.message : String(err);
  // SDK errors carry a JSON body: {"error":{"code":504,"status":"DEADLINE_EXCEEDED","message":...}}
  try {
    const parsed = JSON.parse(msg.slice(msg.indexOf('{')));
    const e = parsed?.error;
    if (e?.status === 'DEADLINE_EXCEEDED') return `Gemini timed out after ${GEMINI_TIMEOUT_MS / 1000} s`;
    if (e) msg = `${e.code ?? ''} ${e.status ?? ''}${e.message ? ` – ${e.message}` : ''}`.trim();
  } catch {
    // not JSON; use as-is
  }
  // Keep it short and strip anything that looks like a key.
  return `Gemini error: ${msg.replace(/key=[^&\s]+/gi, 'key=***').replace(/\s+/g, ' ').slice(0, 140)}`;
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      const e = new Error('timed out');
      e.name = 'AbortError';
      reject(e);
    }, GEMINI_TIMEOUT_MS);
  });
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await Promise.race([
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          abortSignal: controller.signal,
          httpOptions: { timeout: GEMINI_TIMEOUT_MS },
        },
      }),
      timeout,
    ]);
    const text = response.text?.trim();
    if (!text) throw new Error('empty response');
    return text;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  try {
    const body: ReportRequestBody = await req.json();
    const { prompt: reqPrompt, customFocus, metrics, selectedPolygon } = body;

    if (!metrics) {
      return NextResponse.json({ error: 'Missing summary metrics in request body' }, { status: 400 });
    }

    const userPrompt = (reqPrompt || customFocus || '').trim().slice(0, 1000);
    const apiKey = readApiKey();
    let fallbackReason = 'no GEMINI_API_KEY configured on the server';

    if (apiKey) {
      try {
        const text = await callGemini(apiKey, buildAiPrompt(metrics, userPrompt, selectedPolygon));
        const out: ReportResponse = {
          report: text,
          generatedWith: GEMINI_MODEL,
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(out);
      } catch (geminiError) {
        fallbackReason = shortReason(geminiError);
        console.warn('[api/report] Gemini unavailable, returning template report:', fallbackReason);
      }
    }

    const out: ReportResponse = {
      report: buildTemplateReport(metrics, userPrompt, selectedPolygon, fallbackReason),
      generatedWith: TEMPLATE_ENGINE,
      fallbackReason,
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(out);
  } catch (error) {
    console.error('API /api/report error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
