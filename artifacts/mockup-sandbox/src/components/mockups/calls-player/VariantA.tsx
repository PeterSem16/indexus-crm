import { useState, useRef } from "react";

const DOMAIN = "fc828d39-61cd-41d5-ba8d-20e8af9db227-00-7urdqg8tuo0k.worf.replit.dev";

const BARS = [2,3,5,8,12,18,22,28,32,30,25,35,40,38,30,22,28,35,42,48,45,38,42,50,55,52,45,38,42,35,28,22,25,30,28,22,18,15,12,10,8,12,15,18,22,18,12,8,5,3];

function Waveform({ progress, onSeek }: { progress: number; onSeek: (p: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const handleClick = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    onSeek((e.clientX - rect.left) / rect.width);
  };
  return (
    <div ref={ref} onClick={handleClick} className="flex items-center gap-[2px] h-10 cursor-pointer select-none px-1">
      {BARS.map((h, i) => {
        const pct = i / BARS.length;
        const isPlayed = pct < progress;
        return (
          <div key={i} className="flex-1 rounded-full transition-all"
            style={{ height: `${Math.max(4, h * 0.75)}px`, background: isPlayed ? "#dc2626" : "#e2e8f0" }} />
        );
      })}
    </div>
  );
}

function ScoreArc({ value, max = 10, color, label, sub }: { value: number; max?: number; color: string; label: string; sub: string }) {
  const r = 32, cx = 40, cy = 40;
  const pct = value / max;
  const arc = 2 * Math.PI * r * 0.75;
  const offset = arc * (1 - pct);
  const rotation = -225;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${arc} ${2 * Math.PI * r}`} transform={`rotate(${rotation} ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${arc * pct} ${2 * Math.PI * r}`} transform={`rotate(${rotation} ${cx} ${cy})`}
          style={{ transition: "stroke-dasharray 0.6s ease" }} />
        <text x={cx} y={cy + 6} textAnchor="middle" fontSize="16" fontWeight="700" fill={color}>{value}</text>
      </svg>
      <div className="text-xs font-semibold text-gray-700">{label}</div>
      <div className="text-[10px] text-gray-400">{sub}</div>
    </div>
  );
}

export function VariantA() {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col gap-4 font-sans">
      <div className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-1">Variant A — Clean Modern</div>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 flex items-start justify-between border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white font-bold text-sm">P</div>
            <div>
              <div className="text-sm font-semibold text-gray-900">00421948519438</div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-sky-200 text-sky-600 font-medium">↗ Outbound</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-100 font-medium">📱 Mobile · Pepo Pero</span>
                <span className="text-[10px] text-gray-400">19.05.2026, 01:20 · 0:32</span>
              </div>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-center">
            <div className="text-sm font-bold text-amber-700">Neutral</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Sentiment</div>
          </div>
        </div>

        {/* Player */}
        <div className="px-5 py-4">
          <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3">
            <div className="flex items-center gap-3 mb-3">
              <button className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 text-xs">⏮</button>
              <button onClick={() => setPlaying(p => !p)}
                className="w-8 h-8 rounded-full border border-red-200 bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors">
                {playing ? "⏸" : "▶"}
              </button>
              <button className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 text-xs">⏭</button>
              <div className="ml-auto flex items-center gap-2">
                <button className="text-gray-400 hover:text-gray-600 text-sm">⬇</button>
                <button className="text-gray-400 hover:text-gray-600 text-sm">🧠</button>
              </div>
            </div>
            <Waveform progress={progress} onSeek={setProgress} />
            <div className="flex justify-between text-[10px] text-red-500 font-mono mt-1">
              <span>{String(Math.floor(progress * 32 / 60)).padStart(2,"0")}:{String(Math.floor((progress * 32) % 60)).padStart(2,"0")}</span>
              <span className="text-gray-400">0:32</span>
            </div>
            <div className="flex gap-2 mt-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 border border-amber-100 text-amber-600">Neutrálny</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-50 border border-gray-100 text-gray-500">★ 3/10</span>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Call Analysis</div>
        <div className="flex items-start gap-6">
          <div className="flex gap-5">
            <ScoreArc value={3} color="#6366f1" label="Kvalita" sub="Quality Score" />
            <ScoreArc value={5} color="#10b981" label="Skript" sub="Script Score" />
          </div>
          <div className="flex-1 space-y-3 pt-1">
            {[["Kvalita","#6366f1",30],["Skript","#10b981",50]].map(([label, color, val]) => (
              <div key={label as string}>
                <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>{label as string}</span></div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${val}%`, background: color as string }} />
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-gray-50">
              <div className="text-[10px] text-gray-400 mb-1">Sentiment</div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">Neutrálny</span>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-purple-50 border border-purple-100 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-md bg-purple-100 flex items-center justify-center text-purple-500 text-xs">🧠</div>
            <span className="text-xs font-semibold text-gray-500">AI Zhrnutie</span>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">Hovor sa skladal prevažne z opakovaného zisťovania, či zákazník má záujem o informácie o zmrazení pupočníkovej krvi.</p>
        </div>
      </div>
    </div>
  );
}
