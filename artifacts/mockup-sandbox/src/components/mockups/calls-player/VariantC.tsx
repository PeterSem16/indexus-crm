import { useState } from "react";

const BARS = [2,3,5,8,12,18,22,28,32,30,25,35,40,38,30,22,28,35,42,48,45,38,42,50,55,52,45,38,42,35,28,22,25,30,28,22,18,15,12,10,8,12,15,18,22,18,12,8,5,3];

function MiniWave({ progress }: { progress: number }) {
  return (
    <div className="flex items-center gap-[1.5px] h-8">
      {BARS.map((h, i) => {
        const pct = i / BARS.length;
        return (
          <div key={i} className="flex-1 rounded-full"
            style={{ height: `${Math.max(3, h * 0.55)}px`, background: pct < progress ? "#dc2626" : pct < progress + 0.05 ? "#fca5a5" : "#f1f5f9" }} />
        );
      })}
    </div>
  );
}

function QualityBar({ label, value, max = 10, color }: { label: string; value: number; max?: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 text-[11px] text-gray-500 text-right shrink-0">{label}</div>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${(value/max)*100}%`, background: color }} />
      </div>
      <div className="w-6 text-[11px] font-bold shrink-0" style={{ color }}>{value}</div>
    </div>
  );
}

function ActionItem({ done, text }: { done: boolean; text: string }) {
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg ${done ? "bg-emerald-50 border border-emerald-100" : "bg-gray-50 border border-gray-100"}`}>
      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 text-[9px] ${done ? "border-emerald-400 bg-emerald-400 text-white" : "border-gray-300"}`}>
        {done ? "✓" : ""}
      </div>
      <span className={`text-xs ${done ? "text-emerald-700 line-through" : "text-gray-600"}`}>{text}</span>
    </div>
  );
}

export function VariantC() {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  return (
    <div className="min-h-screen bg-white p-6 flex flex-col gap-0 font-sans">
      <div className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-4">Variant C — Dashboard Style</div>

      {/* Top player strip */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 font-bold">P</div>
            <div>
              <div className="text-sm font-semibold text-white">00421948519438</div>
              <div className="text-[10px] text-gray-400">Outbound · 19.05.2026 · 0:32</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPlaying(p => !p)}
              className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors text-sm">
              {playing ? "⏸" : "▶"}
            </button>
          </div>
        </div>
        <MiniWave progress={progress} />
        <div
          className="mt-2 h-1 bg-gray-700 rounded-full cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setProgress((e.clientX - rect.left) / rect.width);
          }}>
          <div className="h-full bg-red-500 rounded-full" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
          <span className="text-red-400">{String(Math.floor(progress * 32 / 60)).padStart(2,"0")}:{String(Math.floor((progress * 32) % 60)).padStart(2,"0")}</span>
          <span>0:32</span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: "Sentiment", value: "Neutrálny", icon: "😐", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100" },
          { label: "Kvalita", value: "3/10", icon: "⭐", bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-100" },
          { label: "Skript", value: "5/10", icon: "📋", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
          { label: "Dĺžka", value: "0:32", icon: "⏱", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-100" },
        ].map(({ label, value, icon, bg, text, border }) => (
          <div key={label} className={`${bg} ${border} border rounded-xl p-3 text-center`}>
            <div className="text-base mb-1">{icon}</div>
            <div className={`text-xs font-bold ${text}`}>{value}</div>
            <div className="text-[9px] text-gray-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Quality breakdown */}
      <div className="border border-gray-100 rounded-2xl p-4 mb-4">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Skóre podrobne</div>
        <div className="space-y-2.5">
          <QualityBar label="Empatia" value={4} color="#6366f1" />
          <QualityBar label="Jasnosť" value={6} color="#6366f1" />
          <QualityBar label="Tempo" value={7} color="#10b981" />
          <QualityBar label="Skript %" value={5} color="#10b981" />
          <QualityBar label="Zákazník" value={7} color="#f59e0b" />
        </div>
      </div>

      {/* Summary + Actions */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-gray-100 rounded-2xl p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">🧠 AI Zhrnutie</div>
          <p className="text-xs text-gray-600 leading-relaxed">Hovor sa skladal prevažne z opakovaného zisťovania záujmu o zmrazenie pupočníkovej krvi.</p>
          <div className="flex flex-wrap gap-1 mt-3">
            {["pupočníková krv","zmrazenie","záujem"].map(t => (
              <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{t}</span>
            ))}
          </div>
        </div>
        <div className="border border-gray-100 rounded-2xl p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">✅ Úlohy</div>
          <div className="space-y-1.5">
            <ActionItem done={true} text="Poslať brožúru" />
            <ActionItem done={false} text="Follow-up hovor o týždeň" />
            <ActionItem done={false} text="Zaslať cenovú ponuku" />
          </div>
        </div>
      </div>
    </div>
  );
}
