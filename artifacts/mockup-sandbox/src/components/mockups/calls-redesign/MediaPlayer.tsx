import { useState } from "react";

const MOCK_CALLS = [
  { id: "1", time: "08:12", duration: "3:47", phone: "+421 903 123 456", name: "Jana Kováčová", direction: "inbound", status: "completed", sentiment: "positive", quality: 9, script: 8, campaign: "Jar 2024", hasRecording: true, analyzed: true, summary: "Zákazníčka si vyžiadala informácie o produkte a prejavila záujem o stretnutie.", topics: ["cord blood", "balíky", "cena"], alerts: [] },
  { id: "2", time: "09:34", duration: "1:12", phone: "+421 911 987 654", name: "Peter Horváth", direction: "outbound", status: "no_answer", sentiment: null, quality: null, script: null, campaign: "Jar 2024", hasRecording: false, analyzed: false, summary: null, topics: [], alerts: [] },
  { id: "3", time: "10:05", duration: "6:22", phone: "+421 905 555 001", name: "Mária Novotná", direction: "inbound", status: "completed", sentiment: "neutral", quality: 6, script: 7, campaign: "VIP", hasRecording: true, analyzed: true, summary: "Zákazníčka sa pýtala na predĺženie zmluvy. Prísľub zavolania naspäť.", topics: ["zmluva", "predĺženie"], alerts: ["zrušiť zmluvu"] },
  { id: "4", time: "11:18", duration: "2:05", phone: "+421 944 777 333", name: "Ján Sloboda", direction: "outbound", status: "completed", sentiment: "negative", quality: 4, script: 5, campaign: "Jar 2024", hasRecording: true, analyzed: true, summary: "Zákazník nesúhlasí s podmienkami. Vyžaduje ďalšie vysvetlenie.", topics: ["podmienky"], alerts: ["reklamácia"] },
  { id: "5", time: "13:45", duration: "4:30", phone: "+421 918 222 444", name: "Eva Blaho", direction: "inbound", status: "completed", sentiment: "positive", quality: 8, script: 9, campaign: "VIP", hasRecording: true, analyzed: true, summary: "Zákazníčka potvrdila záujem, podpíše zmluvu. Dohodnuté stretnutie na piatok.", topics: ["zmluva", "stretnutie", "cord blood"], alerts: [] },
  { id: "6", time: "14:52", duration: "0:47", phone: "+421 903 654 321", name: null, direction: "outbound", status: "failed", sentiment: null, quality: null, script: null, campaign: "Jar 2024", hasRecording: false, analyzed: false, summary: null, topics: [], alerts: [] },
  { id: "7", time: "15:30", duration: "5:15", phone: "+421 907 111 222", name: "Tomáš Kováč", direction: "outbound", status: "completed", sentiment: "positive", quality: 9, script: 9, campaign: "VIP", hasRecording: true, analyzed: true, summary: "Úspešný hovor — zákazník prejavil maximálny záujem a vyžiadal si zmluvu emailom.", topics: ["zmluva", "email", "cord blood"], alerts: [] },
];

const DAYS = ["Pon", "Uto", "Str", "Štv", "Pia"];
const DATES = ["13.1", "14.1", "15.1", "16.1", "17.1"];
const CALL_COUNTS = [12, 8, 15, 11, 7];

const sentimentColor: Record<string, string> = {
  positive: "text-emerald-400",
  neutral: "text-sky-400",
  negative: "text-amber-400",
  angry: "text-red-400",
};
const sentimentBg: Record<string, string> = {
  positive: "bg-emerald-500/15 border-emerald-500/30",
  neutral: "bg-sky-500/15 border-sky-500/30",
  negative: "bg-amber-500/15 border-amber-500/30",
  angry: "bg-red-500/15 border-red-500/30",
};
const sentimentLabel: Record<string, string> = {
  positive: "Pozitívny", neutral: "Neutrálny", negative: "Negatívny", angry: "Nahnevaný",
};

function ScoreRing({ value, max = 10, color }: { value: number; max?: number; color: string }) {
  const pct = (value / max) * 100;
  const r = 14, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 36 36" className="w-10 h-10">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#ffffff10" strokeWidth="3.5" />
      <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3.5"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 18 18)" />
      <text x="18" y="22" textAnchor="middle" fontSize="9" fill="white" fontWeight="600">{value}</text>
    </svg>
  );
}

export function MediaPlayer() {
  const [selectedDay, setSelectedDay] = useState(2);
  const [selectedCall, setSelectedCall] = useState(MOCK_CALLS[0]);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(28);
  const [searchText, setSearchText] = useState("");
  const [filterSentiment, setFilterSentiment] = useState("all");

  const filtered = MOCK_CALLS.filter(c => {
    if (searchText && !c.phone.includes(searchText) && !(c.name || "").toLowerCase().includes(searchText.toLowerCase())) return false;
    if (filterSentiment !== "all" && c.sentiment !== filterSentiment) return false;
    return true;
  });

  const stats = {
    total: MOCK_CALLS.length,
    completed: MOCK_CALLS.filter(c => c.status === "completed").length,
    avgQuality: (MOCK_CALLS.filter(c => c.quality).reduce((s, c) => s + (c.quality || 0), 0) / MOCK_CALLS.filter(c => c.quality).length).toFixed(1),
    withRecording: MOCK_CALLS.filter(c => c.hasRecording).length,
  };

  return (
    <div className="h-screen flex flex-col bg-[#0d0f14] text-white overflow-hidden font-sans">
      {/* Top nav */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
          </div>
          <span className="text-sm font-semibold tracking-tight">Calls & Transcripts</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span>Dnešný deň</span>
          <span className="font-medium text-white/70">17. januára 2025</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-md bg-white/6 text-xs text-white/60 hover:bg-white/10 transition-colors">Export</button>
          <button className="px-3 py-1.5 rounded-md bg-violet-600/80 text-xs font-medium hover:bg-violet-500 transition-colors">+ Nový hovor</button>
        </div>
      </div>

      {/* Day navigator */}
      <div className="px-5 py-2.5 border-b border-white/8 flex items-center gap-3">
        <button className="p-1.5 rounded hover:bg-white/8 text-white/40 hover:text-white/70 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex gap-1.5 flex-1">
          {DAYS.map((d, i) => (
            <button
              key={i}
              onClick={() => setSelectedDay(i)}
              className={`flex-1 rounded-lg py-2 px-1 text-center transition-all ${
                i === selectedDay
                  ? "bg-violet-600 shadow-lg shadow-violet-900/40"
                  : "bg-white/5 hover:bg-white/8"
              }`}
            >
              <div className={`text-[10px] font-medium ${i === selectedDay ? "text-violet-200" : "text-white/40"}`}>{d}</div>
              <div className={`text-sm font-bold mt-0.5 ${i === selectedDay ? "text-white" : "text-white/60"}`}>{DATES[i]}</div>
              <div className={`text-[10px] mt-0.5 ${i === selectedDay ? "text-violet-200" : "text-white/30"}`}>{CALL_COUNTS[i]} hovorov</div>
            </button>
          ))}
        </div>
        <button className="p-1.5 rounded hover:bg-white/8 text-white/40 hover:text-white/70 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
        <div className="ml-3 flex items-center gap-1.5 bg-white/5 rounded-lg px-3 py-1.5">
          <svg className="w-3.5 h-3.5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span className="text-xs text-white/40">Rozsah</span>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-0 border-b border-white/8">
        {[
          { label: "Celkom hovorov", value: stats.total, icon: "📞", color: "text-white" },
          { label: "Dokončených", value: stats.completed, icon: "✅", color: "text-emerald-400" },
          { label: "S nahrávkou", value: stats.withRecording, icon: "🎙️", color: "text-violet-400" },
          { label: "Avg. kvalita", value: stats.avgQuality + "/10", icon: "⭐", color: "text-amber-400" },
        ].map((s, i) => (
          <div key={i} className="flex-1 px-4 py-2.5 border-r border-white/8 last:border-r-0">
            <div className="flex items-center gap-2">
              <span className="text-base">{s.icon}</span>
              <div>
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-white/30">{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main area: list + player */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Call list */}
        <div className="w-[340px] border-r border-white/8 flex flex-col min-h-0">
          {/* Search + filter */}
          <div className="p-3 border-b border-white/8 space-y-2">
            <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
              <svg className="w-3.5 h-3.5 text-white/30 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                placeholder="Hľadaj meno, číslo..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="bg-transparent text-xs text-white/70 placeholder-white/25 outline-none flex-1"
              />
            </div>
            <div className="flex gap-1">
              {["all", "positive", "neutral", "negative"].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterSentiment(s)}
                  className={`flex-1 text-[10px] py-1 rounded transition-colors ${
                    filterSentiment === s ? "bg-violet-600 text-white" : "bg-white/5 text-white/40 hover:bg-white/8"
                  }`}
                >
                  {s === "all" ? "Všetky" : sentimentLabel[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Call rows */}
          <div className="flex-1 overflow-y-auto">
            {filtered.map(call => (
              <button
                key={call.id}
                onClick={() => setSelectedCall(call)}
                className={`w-full text-left px-3.5 py-2.5 border-b border-white/5 transition-all ${
                  selectedCall.id === call.id ? "bg-violet-600/15 border-l-2 border-l-violet-500" : "hover:bg-white/4 border-l-2 border-l-transparent"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] ${call.direction === "inbound" ? "text-emerald-400" : "text-sky-400"}`}>
                      {call.direction === "inbound" ? "↙" : "↗"}
                    </span>
                    <span className="text-xs font-medium text-white/80">{call.time}</span>
                    <span className="text-[10px] text-white/30">{call.duration}</span>
                  </div>
                  {call.sentiment && (
                    <span className={`text-[10px] ${sentimentColor[call.sentiment]}`}>●</span>
                  )}
                </div>
                <div className="text-xs font-medium text-white/90 truncate">{call.name || call.phone}</div>
                {call.name && <div className="text-[10px] text-white/35 truncate">{call.phone}</div>}
                {call.summary && (
                  <div className="text-[10px] text-white/40 truncate mt-0.5 italic">{call.summary.substring(0, 55)}…</div>
                )}
                <div className="flex gap-1 mt-1">
                  {call.alerts.length > 0 && (
                    <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">⚠ Alert</span>
                  )}
                  {call.hasRecording && (
                    <span className="text-[9px] bg-white/8 text-white/35 px-1.5 py-0.5 rounded">🎙</span>
                  )}
                  {call.campaign && (
                    <span className="text-[9px] bg-white/5 text-white/30 px-1.5 py-0.5 rounded truncate max-w-[80px]">{call.campaign}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Player + Analysis */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {/* Player header */}
          <div className="p-5 border-b border-white/8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-lg font-semibold">{selectedCall.name || selectedCall.phone}</div>
                {selectedCall.name && <div className="text-sm text-white/40 mt-0.5">{selectedCall.phone}</div>}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${selectedCall.direction === "inbound" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-sky-500/15 border-sky-500/30 text-sky-400"}`}>
                    {selectedCall.direction === "inbound" ? "↙ Príchodzí" : "↗ Odchodzí"}
                  </span>
                  {selectedCall.campaign && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/50 border border-white/10">{selectedCall.campaign}</span>
                  )}
                  <span className="text-[10px] text-white/30">{DATES[selectedDay]}  ·  {selectedCall.time}  ·  {selectedCall.duration}</span>
                </div>
              </div>
              {selectedCall.sentiment && (
                <div className={`px-3 py-2 rounded-xl border text-center ${sentimentBg[selectedCall.sentiment]}`}>
                  <div className={`text-sm font-semibold ${sentimentColor[selectedCall.sentiment]}`}>{sentimentLabel[selectedCall.sentiment]}</div>
                  <div className="text-[10px] text-white/30 mt-0.5">Sentiment</div>
                </div>
              )}
            </div>

            {/* Audio waveform + player */}
            {selectedCall.hasRecording ? (
              <div className="bg-white/4 rounded-xl p-4">
                {/* Fake waveform */}
                <div className="flex items-center gap-0.5 h-8 mb-3">
                  {Array.from({ length: 80 }, (_, i) => {
                    const h = 20 + Math.sin(i * 0.7) * 14 + Math.sin(i * 1.3) * 8;
                    const played = (i / 80) * 100 < progress;
                    return (
                      <div key={i} style={{ height: `${h}px` }}
                        className={`w-1 rounded-full transition-colors ${played ? "bg-violet-500" : "bg-white/15"}`} />
                    );
                  })}
                </div>
                <div className="relative h-1 bg-white/10 rounded-full mb-3 cursor-pointer"
                  onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setProgress(Math.round(((e.clientX - rect.left) / rect.width) * 100));
                  }}>
                  <div className="absolute left-0 top-0 h-full bg-violet-500 rounded-full" style={{ width: `${progress}%` }} />
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg shadow-violet-900/50"
                    style={{ left: `${progress}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/40">1:04 / {selectedCall.duration}</span>
                  <div className="flex items-center gap-3">
                    <button className="text-white/40 hover:text-white/70 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.53"/></svg>
                    </button>
                    <button
                      onClick={() => setPlaying(!playing)}
                      className="w-9 h-9 rounded-full bg-violet-600 hover:bg-violet-500 flex items-center justify-center transition-colors shadow-lg shadow-violet-900/40"
                    >
                      {playing
                        ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
                        : <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      }
                    </button>
                    <button className="text-white/40 hover:text-white/70 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-3.53"/></svg>
                    </button>
                    <button className="text-[10px] bg-white/8 px-2 py-1 rounded text-white/50 hover:bg-white/12 transition-colors">1.0×</button>
                  </div>
                  <span className="text-[11px] text-white/40">-{(() => {
                    const [m, s] = selectedCall.duration.split(":").map(Number);
                    const totalSec = m * 60 + s;
                    const rem = Math.round(totalSec * (1 - progress / 100));
                    return `${Math.floor(rem / 60)}:${String(rem % 60).padStart(2, "0")}`;
                  })()}</span>
                </div>
              </div>
            ) : (
              <div className="bg-white/4 rounded-xl p-4 text-center text-white/25 text-sm">
                <div className="text-2xl mb-1">🎙️</div>
                Nahrávka nie je k dispozícii
              </div>
            )}
          </div>

          {/* Analysis section */}
          {selectedCall.analyzed && (
            <div className="p-5 space-y-4">
              {/* Scores */}
              <div className="flex gap-3">
                {selectedCall.quality && (
                  <div className="flex items-center gap-3 bg-white/4 rounded-xl px-4 py-3 flex-1">
                    <ScoreRing value={selectedCall.quality} color="#a78bfa" />
                    <div>
                      <div className="text-xs font-medium text-white/70">Kvalita hovoru</div>
                      <div className="text-[10px] text-white/30 mt-0.5">Quality Score</div>
                    </div>
                  </div>
                )}
                {selectedCall.script && (
                  <div className="flex items-center gap-3 bg-white/4 rounded-xl px-4 py-3 flex-1">
                    <ScoreRing value={selectedCall.script} color="#34d399" />
                    <div>
                      <div className="text-xs font-medium text-white/70">Dodržanie skriptu</div>
                      <div className="text-[10px] text-white/30 mt-0.5">Script Compliance</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Alerts */}
              {selectedCall.alerts.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-red-400 text-sm">⚠️</span>
                    <span className="text-xs font-semibold text-red-400">Kritické kľúčové slová</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCall.alerts.map((a, i) => (
                      <span key={i} className="text-[11px] bg-red-500/20 text-red-300 px-2 py-1 rounded-lg border border-red-500/20">{a}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              {selectedCall.summary && (
                <div className="bg-white/4 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-violet-400 text-sm">🧠</span>
                    <span className="text-xs font-semibold text-white/60">AI Zhrnutie</span>
                  </div>
                  <p className="text-sm text-white/80 leading-relaxed">{selectedCall.summary}</p>
                </div>
              )}

              {/* Topics */}
              {selectedCall.topics.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-white/30 mb-2 uppercase tracking-widest">Témy</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCall.topics.map((t, i) => (
                      <span key={i} className="text-xs bg-white/6 text-white/60 px-2.5 py-1 rounded-full border border-white/10">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Transcript snippet */}
              <div className="bg-white/4 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 text-sm">📄</span>
                    <span className="text-xs font-semibold text-white/50">Prepis hovoru</span>
                  </div>
                  <button className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors">Zobraziť celý</button>
                </div>
                <div className="space-y-1.5">
                  {["Agent: Dobrý deň, volám z Cord Blood Center. Môžem hovoriť s pani Kováčovou?",
                    "Zákazník: Áno, tu Kováčová.",
                    "Agent: Kontaktujem vás ohľadom informácií o uchovávaní krvných buniek…"].map((line, i) => (
                    <div key={i} className={`text-[11px] leading-relaxed py-1 px-2 rounded ${i === 1 ? "bg-violet-500/10 border-l-2 border-violet-500 text-white/80" : "text-white/40"}`}>
                      {line}
                    </div>
                  ))}
                  <div className="text-[10px] text-white/20 text-center pt-1">···</div>
                </div>
              </div>
            </div>
          )}

          {!selectedCall.analyzed && (
            <div className="p-5 text-center text-white/30 mt-8">
              <div className="text-4xl mb-3">🔇</div>
              <div className="text-sm font-medium text-white/50">Hovor bez analýzy</div>
              <div className="text-xs mt-1">Nahrávka nie je dostupná alebo ešte nebola spracovaná</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
