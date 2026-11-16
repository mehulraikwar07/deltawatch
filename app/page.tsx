import Link from 'next/link';
import { ArrowRight, Radio, Mountain, Sparkles, Satellite } from 'lucide-react';

export default function Home() {
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#060913] text-white flex flex-col justify-between items-center py-10 px-6 select-none font-sans">
      {/* 1. AEROSPACE RADAR BACKGROUND GLOW & CONCENTRIC RINGS */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        {/* Pulsing cyan/indigo radial gradient simulating radar sweep / Earth curvature */}
        <div className="absolute w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle_at_center,rgba(0,229,255,0.12)_0%,rgba(99,102,241,0.06)_40%,transparent_70%)] blur-3xl animate-pulse duration-[6000ms]" />

        {/* Subtle geometric radar rings */}
        <div className="absolute w-[500px] h-[500px] rounded-full border border-cyan-500/10" />
        <div className="absolute w-[750px] h-[750px] rounded-full border border-cyan-500/[0.06]" />
        <div className="absolute w-[1000px] h-[1000px] rounded-full border border-indigo-500/[0.04]" />

        {/* Horizon curvature glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[140vw] h-[320px] rounded-[100%] bg-gradient-to-t from-cyan-950/20 via-indigo-950/10 to-transparent blur-2xl" />
      </div>

      {/* TOP STATUS PILL */}
      <div className="relative z-10 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] backdrop-blur-md border border-white/10 text-[10px] font-mono tracking-widest text-slate-300 uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 -ml-2.5" />
        <span>PROVISIONAL NISAR L2 GCOV READY</span>
      </div>

      {/* 2. CORE CENTERPIECE & TYPOGRAPHY */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-3xl my-auto space-y-6">
        {/* Pre-title */}
        <div className="inline-flex items-center gap-2 text-[11px] sm:text-xs font-mono tracking-[0.28em] uppercase text-cyan-400 font-semibold drop-shadow-[0_0_12px_rgba(0,229,255,0.6)]">
          <Satellite className="w-3.5 h-3.5 text-cyan-400" />
          <span>NASA SPACE APPS 2026 · TEAM SINGULARITY</span>
        </div>

        {/* Main Title */}
        <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-extrabold tracking-tight text-white drop-shadow-[0_10px_35px_rgba(0,0,0,0.8)]">
          DELTAWATCH
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base md:text-lg text-slate-400 max-w-2xl leading-relaxed font-light">
          Parametric L-Band SAR Intelligence. Volumetric SRTM Flood Modeling. Real-Time AI Science Briefings.
        </p>

        {/* Call To Action Button */}
        <div className="pt-4">
          <Link
            href="/dashboard"
            className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-full bg-[#0A1022]/80 hover:bg-[#0E1630] backdrop-blur-xl border border-cyan-500/50 hover:border-cyan-400 text-white font-medium text-sm tracking-wide shadow-[0_0_24px_rgba(0,229,255,0.22)] hover:shadow-[0_0_36px_rgba(0,229,255,0.45)] hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
          >
            <span className="text-cyan-300 font-semibold tracking-wider uppercase text-xs">
              Launch Mission Control
            </span>
            <ArrowRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>

      {/* 3. THREE MICRO-PILLARS (Bottom grid) */}
      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card 1 */}
        <div className="p-3.5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 hover:border-cyan-500/30 transition-colors text-center flex flex-col justify-center items-center">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-white tracking-wide">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>24cm Penetration</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
            NISAR L-Band canopy backscatter
          </div>
        </div>

        {/* Card 2 */}
        <div className="p-3.5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 hover:border-cyan-500/30 transition-colors text-center flex flex-col justify-center items-center">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-white tracking-wide">
            <Mountain className="w-3.5 h-3.5 text-amber-400" />
            <span>15x Z-Axis Topography</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
            AWS Terrarium volumetric rendering
          </div>
        </div>

        {/* Card 3 */}
        <div className="p-3.5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 hover:border-cyan-500/30 transition-colors text-center flex flex-col justify-center items-center">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-white tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            <span>Flash AI Insights</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
            Grounded geospatial telemetry
          </div>
        </div>
      </div>
    </main>
  );
}
