'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Printer,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  FileText,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import type { SummaryMetrics, EvidencePolygonProperties } from '@/types/sar';

interface AiReportTabProps {
  metrics: SummaryMetrics;
  selectedPolygon: EvidencePolygonProperties | null;
}

interface ApiErrorState {
  status: number;
  message: string;
  endpoint?: string;
}

export function AiReportTab({ metrics, selectedPolygon }: AiReportTabProps) {
  const [reportText, setReportText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [engineType, setEngineType] = useState<string | null>(null);
  const [customInquiry, setCustomInquiry] = useState('');
  const [apiError, setApiError] = useState<ApiErrorState | null>(null);

  const quickPills = [
    {
      label: '🌾 Crop & Farmland Loss',
      prompt: 'Analyze agricultural flood inundation, Samba paddy submergence risks, and farmer loss estimates.',
    },
    {
      label: '🌳 Mangrove Double-Bounce',
      prompt: 'Explain L-band penetration, dihedral corner reflection, and mangrove root pneumatophore asphyxiation.',
    },
    {
      label: '🌧️ Monsoon Runoff & Breaches',
      prompt: 'Detail precipitation runoff dynamics, levee breaches, and low-gradient alluvial ponding.',
    },
    {
      label: '🚗 Transport & Evacuation',
      prompt: 'Evaluate road network submergence, cut-off hamlets, and priority amphibious rescue corridors.',
    },
  ];

  const generateReport = async (overridePrompt?: string) => {
    setLoading(true);
    setApiError(null);
    const activePrompt = (overridePrompt !== undefined ? overridePrompt : customInquiry).trim();

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: activePrompt,
          metrics,
          selectedPolygon,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        const errorMsg =
          data.error || `HTTP ${res.status}: Failed to generate Gemini mission briefing.`;
        setApiError({
          status: data.status || res.status,
          message: errorMsg,
          endpoint: data.endpoint,
        });
        setReportText(null);
        setLoading(false);
        return;
      }

      setReportText(data.report);
      setEngineType(data.model || 'gemini-flash');
      setLoading(false);
    } catch (err: any) {
      console.error('[AiReportTab] Failed to call /api/report:', err);
      setApiError({
        status: 0,
        message: err?.message || 'Network error: Failed to communicate with server /api/report endpoint.',
      });
      setReportText(null);
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

  return (
    <div className="flex flex-col h-full space-y-3.5 select-none text-white">
      {/* 1. Control Panel & Quick Prompts */}
      <div className="p-3.5 rounded-2xl bg-[#090D1A]/90 backdrop-blur-2xl border border-white/10 shadow-2xl space-y-2.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-cyan-950/60 border border-cyan-400/40 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <span className="text-xs font-bold tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400">
                NISAR AI Science Synthesis
              </span>
              <p className="text-[10px] text-white/50">
                Live Google AI Studio Gemini API · Telemetry Grounded
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
                title="Print rapid science briefing"
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
              if (e.key === 'Enter') generateReport();
            }}
            placeholder="Ask question (e.g. crop loss, mangrove double-bounce, road blocks)..."
            className="w-full text-xs px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/80 transition-all font-sans"
          />
        </div>

        {/* Quick Topic Pills */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {quickPills.map((pill) => (
            <button
              key={pill.label}
              onClick={() => {
                setCustomInquiry(pill.prompt);
                generateReport(pill.prompt);
              }}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-cyan-950/60 border border-white/10 hover:border-cyan-400/40 text-white/70 hover:text-cyan-300 transition-all flex items-center gap-1 cursor-pointer"
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
              <span>Querying Live Gemini Science Engine...</span>
            </>
          ) : (
            <>
              <FileText className="w-3.5 h-3.5" />
              <span>{reportText ? 'Regenerate Rapid Science Briefing' : 'Generate NISAR Rapid Science Briefing'}</span>
            </>
          )}
        </button>
      </div>

      {/* 2. Response / Error Display Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 rounded-2xl bg-[#090D1A]/85 backdrop-blur-2xl border border-white/10 shadow-2xl relative select-text scrollbar-thin">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center space-y-3 py-16 text-slate-400">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono tracking-wider text-cyan-300">
              COMMUNICATING WITH GEMINI COCKPIT MODEL...
            </span>
          </div>
        ) : apiError ? (
          /* Exact Visible Error Display with HTTP status and server error message */
          <div className="space-y-3 p-4 rounded-2xl bg-red-950/40 border border-red-500/50 text-white animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-red-500/30">
              <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase tracking-wide">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>Gemini API Failure</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-red-900/60 border border-red-500/40 text-red-300 font-bold">
                {apiError.status ? `HTTP ${apiError.status}` : 'NETWORK ERROR'}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="text-[10px] font-mono uppercase text-red-300/70">Server Error Diagnostics:</div>
              <pre className="p-3 rounded-xl bg-black/60 border border-red-500/30 text-xs font-mono text-red-200 whitespace-pre-wrap leading-relaxed break-words">
                {apiError.message}
              </pre>
              {apiError.endpoint && (
                <div className="text-[10px] font-mono text-white/40 pt-1">
                  Target Endpoint: <span className="text-white/60">{apiError.endpoint}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => generateReport()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/50 hover:bg-red-800/70 border border-red-500/40 text-xs font-medium text-white transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
        ) : reportText ? (
          <div id="printable-ai-report" className="space-y-4 text-xs leading-relaxed text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 text-[10px] text-white/40 font-mono no-print">
              <span className="flex items-center gap-1 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                Live Telemetry Verified
              </span>
              <span className="text-cyan-300">Model: {engineType}</span>
            </div>
            <MarkdownRenderer content={reportText} />
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-white/40">
            <FileText className="w-10 h-10 text-cyan-400/30" />
            <p className="text-xs font-medium text-white/70">No Science Briefing Generated Yet</p>
            <p className="text-[11px] max-w-xs text-white/40">
              Click the button above or select a quick topic pill to synthesize an authoritative NISAR flood report.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Sanitizes any stray raw LaTeX delimiters that may occasionally be generated
 */
function cleanStrayLatex(str: string): string {
  return str
    .replace(/\\Delta\s*HH/g, 'ΔHH')
    .replace(/\\Delta\s*DR/g, 'ΔDR')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\approx/g, '≈')
    .replace(/\\le/g, '≤')
    .replace(/\\ge/g, '≥')
    .replace(/\\rightarrow/g, '→')
    .replace(/\\times/g, '×')
    .replace(/\$([^\$]+)\$/g, '$1');
}

/**
 * High-fidelity Markdown renderer for science reports
 */
function MarkdownRenderer({ content }: { content: string }) {
  const sanitizedContent = cleanStrayLatex(content);
  const lines = sanitizedContent.split('\n');

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
