import React from 'react';
import { ShieldAlert, Radio, Activity, Cpu, Layers, Wind, Anchor } from 'lucide-react';

export default function Navbar({ liveStatus, activeTab, setActiveTab }) {
  return (
    <>
      {/* Top Header Bar */}
      <header className="glass-panel sticky top-0 z-50 px-3 sm:px-6 py-2.5 sm:py-3 border-b border-slate-800 flex items-center justify-between">
        {/* System Identity - Logo Emblem + Brand Name & Subtitle */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-xl overflow-hidden bg-white/95 border border-cyan-500/50 p-0.5 shadow-lg shadow-cyan-950/60 shrink-0 flex items-center justify-center transition-all hover:scale-105">
            <img
              src="/sagarnetra_logo.jpeg"
              alt="Garuda Logo Emblem"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight bg-gradient-to-r from-white via-cyan-100 to-cyan-300 bg-clip-text text-transparent">
                Sagar Netra
              </h1>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 sm:hidden">
                v2.0
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 font-mono hidden sm:block">
              SAR Oil Spill Detection • Drift Tracking • Vessel Attribution
            </p>
          </div>
        </div>

        {/* Desktop Navigation Tabs (Visible on large screens) */}
        <div className="hidden lg:flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'map' || activeTab === 'incident' || activeTab === 'forecast'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            Interactive GIS Map
          </button>
          <button
            onClick={() => setActiveTab('vessels')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'vessels'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-4 h-4" />
            Vessel Attribution
          </button>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2 sm:gap-4 text-xs font-mono">
          {/* ML Status (Desktop & Tablet) */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">ML Model:</span>
            <span className="text-emerald-400 font-semibold">SegFormer-B2</span>
          </div>

          {/* Live AIS Status (Desktop/Tablet) */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800">
            <Radio className={`w-3.5 h-3.5 ${liveStatus?.connected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
            <span className="text-slate-400">AIS:</span>
            <span className={liveStatus?.connected ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
              {liveStatus?.connected ? `LIVE (${liveStatus?.vessel_count || 0})` : 'Connecting...'}
            </span>
          </div>

          {/* Compact Mobile Live AIS Indicator */}
          <div className="flex sm:hidden items-center gap-1.5 px-2 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-[10px]">
            <Radio className={`w-3 h-3 ${liveStatus?.connected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
            <span className={liveStatus?.connected ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
              {liveStatus?.connected ? `${liveStatus?.vessel_count || 0} Ships` : 'AIS...'}
            </span>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (< lg screens) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden glass-panel border-t border-slate-800/90 px-2 py-1.5 pb-safe flex items-center justify-around shadow-2xl backdrop-blur-xl bg-slate-950/90">
        <button
          onClick={() => setActiveTab('map')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            activeTab === 'map'
              ? 'text-cyan-400 bg-cyan-500/15 font-semibold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span className="text-[10px] mt-0.5 font-medium">Map</span>
        </button>

        <button
          onClick={() => setActiveTab('incident')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            activeTab === 'incident'
              ? 'text-cyan-400 bg-cyan-500/15 font-semibold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span className="text-[10px] mt-0.5 font-medium">Spill Info</span>
        </button>

        <button
          onClick={() => setActiveTab('forecast')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            activeTab === 'forecast'
              ? 'text-cyan-400 bg-cyan-500/15 font-semibold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wind className="w-4 h-4" />
          <span className="text-[10px] mt-0.5 font-medium">Forecast</span>
        </button>

        <button
          onClick={() => setActiveTab('vessels')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            activeTab === 'vessels'
              ? 'text-cyan-400 bg-cyan-500/15 font-semibold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Anchor className="w-4 h-4" />
          <span className="text-[10px] mt-0.5 font-medium">Vessels</span>
        </button>
      </nav>
    </>
  );
}
