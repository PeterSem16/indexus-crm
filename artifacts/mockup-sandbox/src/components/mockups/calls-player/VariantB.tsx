import { useState } from "react";

const BARS_AGENT =   [1,2,4,8,14,20,26,30,28,22,18,12,8,4,2,2,2,4,8,12,16,20,24,28,30,28,24,20,16,12,8,4,2,4,8,12,16,14,10,8,6,4,2,1,1,2,3,2,1,1];
const BARS_CUSTOMER = [1,1,1,2,2,2,4,6,4,2,2,8,14,20,26,30,28,24,18,12,8,4,2,2,4,8,12,16,14,10,8,12,16,18,14,10,6,4,2,2,2,2,1,1,2,4,6,4,2,1];

function DualWaveform({ progress, onSeek }: { progress: number; onSeek: (p: number) => void }) {
  return (
    <div className="space-y-1 cursor-pointer select-none" onClick={(e) => {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      onSeek((e.clientX - rect.left) / rect.width);
    }}>
      <div className="text-[9px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Agent</div>
      <div className="flex items-end gap-[2px] h-7">
        {BARS_AGENT.map((h, i) => (
          <div key={i} className="flex-1 rounded-t-sm transition-all"
            style={{ height: `${Math.max(2, h * 0.7)}px`, background: i/BARS_AGENT.length < progress ? "#6366f1" : "#e0e7ff" }} />
        ))}
      </div>
      <div className="flex items-start gap-[2px] h-7 mt-0">
        {BARS_CUSTOMER.map((h, i) => (
          <div key={i} className="flex-1 rounded-b-sm transition-all"
            style={{ height: `${Math.max(2, h * 0.7)}px`, background: i/BARS_CUSTOMER.length < progress ? "#10b981" : "#d1fae5" }} />
        ))}
      </div>
      <div className="text-[9px] text-gray-400 font-semibold uppercase tracking-wide mt-0.5">Zákazník</div>
    </div>
  );
}

function Marker({ pct, label, color }: { pct: number; label: string; color: string }) {
  return (
    <div className="absolute -translate-x-1/2 flex flex-col items-center gap-0.5" style={{ left: `${pct * 100}%` }}>
      <div className="w-0.5 h-3 rounded-full" style={{ background: color }} />
      <div className="text-[8px] font-medium whitespace-nowrap px-1 py-0.5 rounded" style={{ background: color + "20", color }}>{label}</div>
    </div>
  );
}

export function VariantB() {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0.08);

  const talkRatioAgent = 38;

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col gap-4 font-sans">
      <div className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-1">Variant B — Speaker Analysis</div>

      {/* Header + Player */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white font-bold text-sm">P</div>
            <div>
              <div className="text-sm font-semibold">00421948519438</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-sky-200 text-sky-600">↗ Outbound</span>
                <span className="text-[10px] text-gray-400">0:32 · 19.05.2026</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[10px] text-gray-400">Sentiment</div>
              <div className="text-xs font-bold text-amber-600">Neutrálny</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-sm">😐</div>
          </div>
        </div>

        {/* Dual waveform */}
        <div className="px-5 py-4 bg-slate-50/50">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setPlaying(p => !p)}
              className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-sm hover:bg-indigo-700 transition-colors text-sm font-bold">
              {playing ? "⏸" : "▶"}
            </button>
            <span className="text-xs text-gray-400 font-mono">
              {String(Math.floor(progress * 32 / 60)).padStart(2,"0")}:{String(Math.floor((progress * 32) % 60)).padStart(2,"0")} / 0:32
            </span>
            <div className="ml-auto flex gap-2">
              <span className="text-[10px] flex items-center gap-1 text-indigo-500"><span className="w-2 h-2 rounded-full bg-indigo-400 inline-block"/>Agent</span>
              <span className="text-[10px] flex items-center gap-1 text-emerald-500"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/>Zákazník</span>
            </div>
          </div>

          <DualWaveform progress={progress} onSeek={setProgress} />

          {/* Timeline markers */}
          <div className="relative h-6 mt-3">
            <Marker pct={0.15} label="Predstavenie" color="#6366f1" />
            <Marker pct={0.45} label="Otázka" color="#f59e0b" />
            <Marker pct={0.78} label="Záver" color="#10b981" />
          </div>

          {/* Progress bar */}
          <div className="mt-1 h-1 bg-slate-200 rounded-full cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setProgress((e.clientX - rect.left) / rect.width);
          }}>
            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>

        {/* Speaker ratio */}
        <div className="px-5 pb-4 flex items-center gap-3">
          <div className="text-[10px] text-gray-400 whitespace-nowrap">Hovorí:</div>
          <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-slate-100 flex">
            <div className="h-full bg-indigo-400 rounded-l-full" style={{ width: `${talkRatioAgent}%` }} />
            <div className="h-full bg-emerald-400 rounded-r-full" style={{ width: `${100 - talkRatioAgent}%` }} />
          </div>
          <div className="text-[10px] text-indigo-500">{talkRatioAgent}%</div>
          <div className="text-[10px] text-emerald-500">{100 - talkRatioAgent}%</div>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Kvalita", value: 3, max: 10, color: "indigo", bar: 30 },
          { label: "Skript", value: 5, max: 10, color: "emerald", bar: 50 },
          { label: "Zákazník", value: 7, max: 10, color: "amber", bar: 70 },
        ].map(({ label, value, max, color, bar }) => (
          <div key={label} className={`bg-white rounded-xl border border-slate-200 p-3.5 text-center`}>
            <div className={`text-2xl font-black text-${color}-600 mb-0.5`}>{value}</div>
            <div className="text-[10px] text-gray-400 mb-2">{label}</div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full bg-${color}-400 rounded-full`} style={{ width: `${bar}%` }} />
            </div>
            <div className="text-[9px] text-gray-300 mt-1">/ {max}</div>
          </div>
        ))}
      </div>

      {/* Keywords */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Kľúčové témy & výrazy</div>
        <div className="flex flex-wrap gap-1.5">
          {["pupočníková krv","zmrazenie","záujem","informácie","produkt","poistenie"].map(kw => (
            <span key={kw} className="text-[11px] px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">{kw}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
