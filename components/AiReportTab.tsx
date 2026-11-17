'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Printer,
  Copy,
  Check,
  RefreshCw,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import type { SummaryMetrics, EvidencePolygonProperties } from '@/types/sar';
import {
  GEMINI_MODEL,
  TEMPLATE_ENGINE,
  buildTemplateReport,
  type ReportResponse,
} from '@/lib/reportTemplate';
import { isRealData } from '@/lib/metrics';

interface AiReportTabProps {
  metrics: SummaryMetrics;
  selectedPolygon: EvidencePolygonProperties | null;
}

// Slightly longer than the server's 45 s Gemini timeout so the server can
// answer with its labelled template instead of the browser giving up first.
const CLIENT_TIMEOUT_MS = 55_000;

export function AiReportTab({ metrics, selectedPolygon }: AiReportTabProps) {
  const [reportText, setReportText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [engineType, setEngineType] = useState<string | null>(null);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [customInquiry, setCustomInquiry] = useState('');

  const quickPills = [
    { label: '🌾 Farmland', prompt: 'What do the change classes suggest about agricultural land, and what can this data NOT tell us about crop damage?' },
    { label: '🌳 Flooded vegetation', prompt: 'Explain how L-band double-bounce reveals water under vegetation, and how much area this scene pair flags.' },
    { label: '🌧️ What changed', prompt: 'Summarise what changed between the two acquisitions and the main sources of false alarms.' },
    { label: '🚗 Roads & access', prompt: 'What could this change map be used for in access planning, and what extra data would be needed?' },
  ];

  /**
   * Always goes through the server route (/api/report). The Gemini key lives
   * only on the server (GEMINI_API_KEY); it is never exposed to the browser.
   */
  const generateReport = async (overridePrompt?: string) => {
    setLoading(true);
    const activePrompt = (overridePrompt !== undefined ? overridePrompt : customInquiry).trim();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics, selectedPolygon, prompt: activePrompt }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`report API returned HTTP ${res.status}`);
      const data = (await res.json()) as ReportResponse;
      if (!data?.report) throw new Error('report API returned no report');
      setReportText(data.report);
      setEngineType(data.generatedWith || TEMPLATE_ENGINE);
      setFallbackReason(data.generatedWith === GEMINI_MODEL ? null : data.fallbackReason || 'unknown reason');
    } catch (err) {
      const reason =
        err instanceof Error && err.name === 'AbortError'
          ? `report API timed out after ${CLIENT_TIMEOUT_MS / 1000} s`
          : `report API unreachable (${err instanceof Error ? err.message : String(err)})`;
      setReportText(buildTemplateReport(metrics, activePrompt, selectedPolygon, reason));
      setEngineType(TEMPLATE_ENGINE);
      setFallbackReason(reason);
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!reportText) return;
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const isAi = engineType === GEMINI_MODEL;

  return (
    <div className="flex flex-col h-full space-y-3.5 select-none text-white">
      {/* 1. Control Panel & Quick Prompts */}
      <div className="p-3.5 rounded-2xl bg-[#090D1A]/90 backdrop-blur-2xl border border-white/10 shadow-2xl space-y-2.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-cyan-950/60 border border-cyan-400/40 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div>
              <span className="text-xs font-bold tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400">
                AI Scene Briefing
              </span>
              <p className="text-[10px] text-white/50">
                Gemini summary of this scene pair&apos;s metrics{isRealData(metrics) ? '' : ' (synthetic demo data)'}
              </p>
            </div>
          </div>

          {reportText && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 transition text-[11px] font-mono cursor-pointer"
                title="Copy markdown text"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 transition text-[11px] font-mono cursor-pointer"
                title="Print briefing"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
            </div>
          )}
        </div>

        {/* Custom Inquiry Box */}
        <div className="relative">
          <input
            type="text"
            value={customInquiry}
            onChange={(e) => setCustomInquiry(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) generateReport();
            }}
            placeholder="Ask a question about this scene pair..."
            className="w-full text-xs px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/80 transition-all font-sans"
          />
        </div>

        {/* Quick Topic Pills */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {quickPills.map((pill) => (
            <button
              key={pill.label}
              disabled={loading}
              onClick={() => {
                setCustomInquiry(pill.prompt);
                generateReport(pill.prompt);
              }}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-cyan-950/60 border border-white/10 hover:border-cyan-400/40 text-white/70 hover:text-cyan-300 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <span>{pill.label}</span>
            </button>
          ))}
        </div>

        {/* Primary Action Button */}
        <button
          onClick={() => generateReport()}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-black font-bold text-xs rounded-xl shadow-[0_0_20px_rgba(0,240,255,0.25)] hover:shadow-[0_0_25px_rgba(0,240,255,0.4)] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Generating briefing (up to ~45 s)...</span>
            </>
          ) : (
            <>
              <FileText className="w-3.5 h-3.5" />
              <span>{reportText ? 'Regenerate Briefing' : 'Generate Briefing'}</span>
            </>
          )}
        </button>
      </div>

      {/* 2. Formatted Markdown Briefing Viewer */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 rounded-2xl bg-[#090D1A]/85 backdrop-blur-2xl border border-white/10 shadow-2xl relative select-text scrollbar-thin">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center space-y-3 py-16 text-slate-400">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono tracking-wider text-cyan-300">WAITING FOR MODEL RESPONSE...</span>
          </div>
        ) : reportText ? (
          <div id="printable-ai-report" className="space-y-4 text-xs leading-relaxed text-slate-200">
            {!isAi && (
              <div
                role="status"
                className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-950/50 border border-amber-400/50 text-amber-200 text-[11px]"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  <strong>Template report — AI unavailable:</strong> {fallbackReason || 'unknown reason'}. Only values
                  from summary_metrics.json are quoted below; nothing has been interpreted by a model.
                </span>
              </div>
            )}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 text-[10px] text-white/40 font-mono no-print">
              <span>{isRealData(metrics) ? 'Source: real NISAR L2 GCOV metrics' : 'Source: synthetic / demo metrics'}</span>
              <span>{isAi ? `Model: ${GEMINI_MODEL} (via server)` : 'Template (no AI)'}</span>
            </div>
            <MarkdownRenderer content={reportText} />
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-white/40">
            <FileText className="w-10 h-10 text-cyan-400/30" />
            <p className="text-xs font-medium text-white/70">No briefing generated yet</p>
            <p className="text-[11px] max-w-xs text-white/40">
              Click the button above or pick a topic. The model only sees the metrics shown in this app.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * High-fidelity Markdown renderer for science reports
 */
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <div className="space-y-2.5 font-sans leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        if (trimmed === '---' || trimmed === '***') {
          return <hr key={idx} className="border-t border-white/10 my-3" />;
        }

        if (trimmed.startsWith('# ')) {
          return (
            <h1
              key={idx}
              className="text-sm font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-sky-200 pt-2 pb-1"
            >
              {parseInlineMarkdown(trimmed.replace(/^#\s+/, ''))}
            </h1>
          );
        }

        if (trimmed.startsWith('## ')) {
          return (
            <h2
              key={idx}
              className="text-xs font-bold tracking-wider text-cyan-300 uppercase pt-2 pb-0.5 border-b border-cyan-500/20"
            >
              {parseInlineMarkdown(trimmed.replace(/^##\s+/, ''))}
            </h2>
          );
        }

        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-xs font-bold text-sky-300 pt-1.5">
              {parseInlineMarkdown(trimmed.replace(/^###\s+/, ''))}
            </h3>
          );
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const itemText = trimmed.replace(/^[-*]\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 text-slate-300 text-[11.5px]">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1.5 shadow-[0_0_6px_rgba(0,240,255,0.8)]" />
              <div className="flex-1">{parseInlineMarkdown(itemText)}</div>
            </div>
          );
        }

        return (
          <p key={idx} className="text-slate-300 text-[11.5px] leading-relaxed">
            {parseInlineMarkdown(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function parseInlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2);
      return (
        <strong key={i} className="text-cyan-200 font-semibold drop-shadow-[0_0_8px_rgba(0,240,255,0.2)]">
          {boldText}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      const codeText = part.slice(1, -1);
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded bg-black/60 border border-white/10 font-mono text-cyan-300 text-[11px]"
        >
          {codeText}
        </code>
      );
    }
    return part;
  });
}
