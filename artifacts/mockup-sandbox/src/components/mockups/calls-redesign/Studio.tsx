import { useState } from "react";

const MOCK_CALLS = [
  { id: "1", time: "08:12", duration: "3:47", phone: "+421 903 123 456", name: "Jana Kováčová", direction: "inbound", status: "completed", sentiment: "positive", quality: 9, script: 8, campaign: "Jar 2024", hasRecording: true, analyzed: true, summary: "Zákazníčka si vyžiadala informácie o produkte a prejavila záujem o stretnutie.", topics: ["cord blood", "balíky", "cena"], alerts: [], agent: "Martin K.", actionItems: ["Zaslať email s cenníkom", "Dohodnúť stretnutie"] },
  { id: "2", time: "09:34", duration: "1:12", phone: "+421 911 987 654", name: "Peter Horváth", direction: "outbound", status: "no_answer", sentiment: null, quality: null, script: null, campaign: "Jar 2024", hasRecording: false, analyzed: false, summary: null, topics: [], alerts: [], agent: "Lucia B.", actionItems: [] },
  { id: "3", time: "10:05", duration: "6:22", phone: "+421 905 555 001", name: "Mária Novotná", direction: "inbound", status: "completed", sentiment: "neutral", quality: 6, script: 7, campaign: "VIP", hasRecording: true, analyzed: true, summary: "Zákazníčka sa pýtala na predĺženie zmluvy. Prísľub zavolania naspäť.", topics: ["zmluva", "predĺženie"], alerts: ["zrušiť zmluvu"], agent: "Martin K.", actionItems: ["Zavolať naspäť do 48h", "Pripraviť ponuku predĺženia"] },
  { id: "4", time: "11:18", duration: "2:05", phone: "+421 944 777 333", name: "Ján Sloboda", direction: "outbound", status: "completed", sentiment: "negative", quality: 4, script: 5, campaign: "Jar 2024", hasRecording: true, analyzed: true, summary: "Zákazník nesúhlasí s podmienkami. Vyžaduje ďalšie vysvetlenie.", topics: ["podmienky"], alerts: ["reklamácia"], agent: "Lucia B.", actionItems: ["Eskalovať na manažéra", "Zaslať podmienky písomne"] },
  { id: "5", time: "13:45", duration: "4:30", phone: "+421 918 222 444", name: "Eva Blaho", direction: "inbound", status: "completed", sentiment: "positive", quality: 8, script: 9, campaign: "VIP", hasRecording: true, analyzed: true, summary: "Zákazníčka potvrdila záujem, podpíše zmluvu. Dohodnuté stretnutie na piatok.", topics: ["zmluva", "stretnutie", "cord blood"], alerts: [], agent: "Martin K.", actionItems: ["Odoslať zmluvu emailom", "Potvrdiť piatkové stretnutie"] },
  { id: "6", time: "14:52", duration: "0:47", phone: "+421 903 654 321", name: null, direction: "outbound", status: "failed", sentiment: null, quality: null, script: null, campaign: "Jar 2024", hasRecording: false, analyzed: false, summary: null, topics: [], alerts: [], agent: "Lucia B.", actionItems: [] },
  { id: "7", time: "15:30", duration: "5:15", phone: "+421 907 111 222", name: "Tomáš Kováč", direction: "outbound", status: "completed", sentiment: "positive", quality: 9, script: 9, campaign: "VIP", hasRecording: true, analyzed: true, summary: "Úspešný hovor — zákazník prejavil maximálny záujem a vyžiadal si zmluvu emailom.", topics: ["zmluva", "email", "cord blood"], alerts: [], agent: "Martin K.", actionItems: ["Odoslať zmluvu", "Follow-up o 3 dni"] },
];

const WEEK_DAYS = [
  { label: "Po", date: "13", count: 12 },
  { label: "Ut", date: "14", count: 8 },
  { label: "St", date: "15", count: 15 },
  { label: "Šv", date: "16", count: 11 },
  { label: "Pi", date: "17", count: 7 },
];

const sentimentCfg: Record<string, { dot: string; ring: string; bg: string; badge: string; text: string; label: string }> = {
  positive: { dot: "bg-emerald-500", ring: "#10b981", bg: "bg-emerald-50 dark:bg-emerald-950/30", badge: "bg-emerald-100 text-emerald-700", text: "text-emerald-700", label: "Pozitívny" },
  neutral:  { dot: "bg-sky-500",     ring: "#0ea5e9", bg: "bg-sky-50 dark:bg-sky-950/30",         badge: "bg-sky-100 text-sky-700",         text: "text-sky-700",     label: "Neutrálny" },
  negative: { dot: "bg-amber-500",   ring: "#f59e0b", bg: "bg-amber-50 dark:bg-amber-950/30",     badge: "bg-amber-100 text-amber-700",     text: "text-amber-700",   label: "Negatívny" },
  angry:    { dot: "bg-red-500",     ring: "#ef4444", bg: "bg-red-50 dark:bg-red-950/30",         badge: "bg-red-100 text-red-700",         text: "text-red-700",     label: "Nahnevaný" },
};

function ScoreRing({ value, max = 10, color, label, sub }: { value: number; max?: number; color: string; label: string; sub: string }) {
  const r = 26, c = 2 * Math.PI * r;
  const pct = value / max;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 64 64" className="w-16 h-16 drop-shadow-sm">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${pct * c} ${c}`} strokeLinecap="round"
          transform="rotate(-90 32 32)" />
        <text x="32" y="36" textAnchor="middle" fontSize="14" fontWeight="700" fill="#1e293b">{value}</text>
      </svg>
      <div className="text-center">
        <div className="text-xs font-semibold text-slate-700">{label}</div>
        <div className="text-[10px] text-slate-400">{sub}</div>
      </div>
    </div>
  );
}

function MiniBar({ value, max = 10, color }: { value: number; max?: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className="text-[10px] font-bold text-slate-500 w-4 text-right">{value}</span>
    </div>
  );
}

const CAMPAIGNS = ["Všetky", "Jar 2024", "VIP"];
const DIRECTIONS = ["Všetky", "Príchodzí", "Odchodzí"];
const SENTIMENTS = ["Všetky", "Pozitívny", "Neutrálny", "Negatívny"];
const STATUSES = ["Všetky", "Dokončené", "Neprijaté", "Chyba"];

export function Studio() {
  const [selected, setSelected] = useState(MOCK_CALLS[0]);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(32);
  const [search, setSearch] = useState("");
  const [activeDay, setActiveDay] = useState(4);
  const [tab, setTab] = useState<"analysis" | "transcript">("analysis");
  const [filterDir, setFilterDir] = useState("Všetky");
  const [filterSentiment, setFilterSentiment] = useState("Všetky");
  const [filterStatus, setFilterStatus] = useState("Všetky");
  const [filterCampaign, setFilterCampaign] = useState("Všetky");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = MOCK_CALLS.filter(c => {
    if (search && !c.phone.includes(search) && !(c.name || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filterDir === "Príchodzí" && c.direction !== "inbound") return false;
    if (filterDir === "Odchodzí" && c.direction !== "outbound") return false;
    if (filterSentiment !== "Všetky") {
      const map: Record<string, string> = { "Pozitívny": "positive", "Neutrálny": "neutral", "Negatívny": "negative" };
      if (c.sentiment !== map[filterSentiment]) return false;
    }
    if (filterStatus === "Dokončené" && c.status !== "completed") return false;
    if (filterStatus === "Neprijaté" && c.status !== "no_answer") return false;
    if (filterStatus === "Chyba" && c.status !== "failed") return false;
    if (filterCampaign !== "Všetky" && c.campaign !== filterCampaign) return false;
    return true;
  });

  const activeFilters = [filterDir, filterSentiment, filterStatus, filterCampaign].filter(f => f !== "Všetky").length;

  const totalCalls = MOCK_CALLS.length;
  const completed = MOCK_CALLS.filter(c => c.status === "completed").length;
  const withAlerts = MOCK_CALLS.filter(c => c.alerts.length > 0).length;
  const avgQ = (MOCK_CALLS.filter(c => c.quality).reduce((s, c) => s + (c.quality || 0), 0) / MOCK_CALLS.filter(c => c.quality).length).toFixed(1);

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden font-sans text-sm select-none">

      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-5 py-2.5 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
          </div>
          <div>
            <div className="text-sm font-semibold leading-none text-slate-800">Calls & Transcripts</div>
            <div className="text-[10px] text-slate-400 mt-0.5">17. januára 2025</div>
          </div>
        </div>

        {/* Week strip */}
        <div className="flex gap-1 mx-auto">
          <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          {WEEK_DAYS.map((d, i) => (
            <button key={i} onClick={() => setActiveDay(i)}
              className={`flex flex-col items-center px-3 py-1.5 rounded-xl transition-all ${
                i === activeDay ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200" : "hover:bg-slate-100 text-slate-500"
              }`}>
              <span className="text-[10px] font-medium">{d.label}</span>
              <span className={`text-sm font-bold leading-tight ${i === activeDay ? "text-white" : "text-slate-700"}`}>{d.date}</span>
              <span className={`text-[9px] mt-0.5 ${i === activeDay ? "text-indigo-200" : "text-slate-400"}`}>{d.count}</span>
            </button>
          ))}
          <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
          <button className="flex items-center gap-1.5 ml-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Rozsah
          </button>
        </div>

        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors shadow-sm shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nahrať
        </button>
      </div>

      {/* ── Stats bar ── */}
      <div className="bg-white border-b border-slate-200 px-5 py-2 flex items-center gap-5 shrink-0">
        {[
          { icon: "📞", label: "Hovory celkom", value: String(totalCalls), color: "text-slate-800" },
          { icon: "✅", label: "Dokončené", value: `${completed}/${totalCalls}`, color: "text-emerald-600" },
          { icon: "⚠️", label: "Alerty", value: String(withAlerts), color: withAlerts > 0 ? "text-red-500" : "text-slate-400" },
          { icon: "⭐", label: "Avg. kvalita", value: `${avgQ}/10`, color: "text-amber-500" },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-base">{s.icon}</span>
            <span className={`text-base font-bold ${s.color}`}>{s.value}</span>
            <span className="text-[10px] text-slate-400">{s.label}</span>
            {i < 3 && <div className="w-px h-4 bg-slate-200 ml-3" />}
          </div>
        ))}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">

        {/* ─── Master list ─── */}
        <div className="w-[300px] bg-white border-r border-slate-200 flex flex-col min-h-0 shrink-0">

          {/* Search + filter toggle */}
          <div className="px-3 pt-2.5 pb-2 border-b border-slate-100 space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input placeholder="Hľadaj…" value={search} onChange={e => setSearch(e.target.value)}
                  className="bg-transparent text-xs text-slate-700 placeholder-slate-400 outline-none flex-1" />
              </div>
              <button onClick={() => setFiltersOpen(!filtersOpen)}
                className={`relative px-2.5 rounded-lg border text-xs font-medium transition-colors ${
                  filtersOpen || activeFilters > 0
                    ? "border-indigo-300 bg-indigo-50 text-indigo-600"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                {activeFilters > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] flex items-center justify-center font-bold">{activeFilters}</span>
                )}
              </button>
            </div>

            {/* Filter panel */}
            {filtersOpen && (
              <div className="space-y-2 pb-1">
                {/* Direction */}
                <div>
                  <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Smer</div>
                  <div className="flex gap-1">
                    {DIRECTIONS.map(d => (
                      <button key={d} onClick={() => setFilterDir(d)}
                        className={`flex-1 text-[10px] py-1 rounded-md transition-colors ${
                          filterDir === d ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}>{d}</button>
                    ))}
                  </div>
                </div>
                {/* Sentiment */}
                <div>
                  <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Sentiment</div>
                  <div className="flex gap-1 flex-wrap">
                    {SENTIMENTS.map(s => (
                      <button key={s} onClick={() => setFilterSentiment(s)}
                        className={`px-2 text-[10px] py-1 rounded-md transition-colors ${
                          filterSentiment === s ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}>{s}</button>
                    ))}
                  </div>
                </div>
                {/* Status + Campaign row */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Stav</div>
                    <div className="flex flex-col gap-0.5">
                      {STATUSES.map(s => (
                        <button key={s} onClick={() => setFilterStatus(s)}
                          className={`text-left text-[10px] px-2 py-1 rounded-md transition-colors ${
                            filterStatus === s ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}>{s}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Kampaň</div>
                    <div className="flex flex-col gap-0.5">
                      {CAMPAIGNS.map(c => (
                        <button key={c} onClick={() => setFilterCampaign(c)}
                          className={`text-left text-[10px] px-2 py-1 rounded-md transition-colors ${
                            filterCampaign === c ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}>{c}</button>
                      ))}
                    </div>
                  </div>
                </div>
                {activeFilters > 0 && (
                  <button onClick={() => { setFilterDir("Všetky"); setFilterSentiment("Všetky"); setFilterStatus("Všetky"); setFilterCampaign("Všetky"); }}
                    className="w-full text-[10px] text-indigo-500 hover:text-indigo-700 py-1 transition-colors">
                    Zrušiť všetky filtre
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Call list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filtered.length === 0 && (
              <div className="py-10 text-center text-slate-400 text-xs">Žiadne hovory nezodpovedajú filtrom</div>
            )}
            {filtered.map(call => {
              const sc = call.sentiment ? sentimentCfg[call.sentiment] : null;
              const isSelected = selected.id === call.id;
              return (
                <button key={call.id} onClick={() => setSelected(call)}
                  className={`w-full text-left px-3.5 py-2.5 transition-all border-l-2 ${
                    isSelected ? "bg-indigo-50 border-l-indigo-500" : "hover:bg-slate-50 border-l-transparent"
                  }`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-bold ${call.direction === "inbound" ? "text-emerald-500" : "text-sky-500"}`}>
                        {call.direction === "inbound" ? "↙" : "↗"}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">{call.time}</span>
                      <span className="text-[10px] text-slate-400">{call.duration}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {call.alerts.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                      {sc && <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />}
                    </div>
                  </div>
                  <div className="text-xs font-medium text-slate-800 truncate">{call.name || call.phone}</div>
                  {call.name && <div className="text-[10px] text-slate-400 truncate">{call.phone}</div>}
                  {call.summary && (
                    <div className="text-[10px] text-slate-400 truncate mt-1">{call.summary.slice(0, 55)}…</div>
                  )}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {call.status === "no_answer" && <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">Neprijaté</span>}
                    {call.status === "failed" && <span className="text-[9px] bg-red-50 text-red-400 px-1.5 py-0.5 rounded-full">Chyba</span>}
                    {call.hasRecording && <span className="text-[9px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-full">🎙</span>}
                    {call.quality != null && (
                      <span className="text-[9px] bg-amber-50 text-amber-500 px-1.5 py-0.5 rounded-full">★ {call.quality}</span>
                    )}
                    {call.campaign && (
                      <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full truncate max-w-[80px]">{call.campaign}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Detail panel ─── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-slate-50">

          {/* Call header + player */}
          <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
                  {(selected.name || selected.phone)[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-800">{selected.name || selected.phone}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {selected.name && <span className="text-xs text-slate-400">{selected.phone}</span>}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${selected.direction === "inbound" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>
                      {selected.direction === "inbound" ? "↙ Príchodzí" : "↗ Odchodzí"}
                    </span>
                    {selected.campaign && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{selected.campaign}</span>}
                    <span className="text-[10px] text-slate-400">{selected.time} · {selected.duration} · {selected.agent}</span>
                  </div>
                </div>
              </div>
              {selected.sentiment && (() => {
                const sc = sentimentCfg[selected.sentiment];
                return (
                  <div className={`px-3 py-2 rounded-xl ${sc.bg} border border-current/10 text-center shrink-0`}>
                    <div className={`text-sm font-bold ${sc.text}`}>{sc.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Sentiment</div>
                  </div>
                );
              })()}
            </div>

            {/* Player */}
            {selected.hasRecording ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <div className="flex items-center gap-3">
                  <button onClick={() => setPlaying(!playing)}
                    className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center shrink-0 shadow-sm transition-colors">
                    {playing
                      ? <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
                      : <svg className="w-3.5 h-3.5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
                  </button>
                  <div className="flex-1 space-y-1">
                    {/* Waveform bars */}
                    <div className="flex items-center gap-px h-6">
                      {Array.from({ length: 60 }, (_, i) => {
                        const h = 40 + Math.sin(i * 0.8) * 30 + Math.sin(i * 1.9) * 20;
                        const played = (i / 60) * 100 < progress;
                        return <div key={i} style={{ height: `${h}%` }}
                          className={`w-1 rounded-full ${played ? "bg-indigo-500" : "bg-slate-200"}`} />;
                      })}
                    </div>
                    <div className="relative h-1 bg-slate-200 rounded-full cursor-pointer"
                      onClick={e => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setProgress(Math.round(((e.clientX - r.left) / r.width) * 100));
                      }}>
                      <div className="absolute left-0 top-0 h-full bg-indigo-500 rounded-full" style={{ width: `${progress}%` }} />
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-indigo-500 rounded-full shadow-sm" style={{ left: `${progress}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-[10px] text-slate-400">
                    <span>1:04 / {selected.duration}</span>
                    <button className="border border-slate-200 px-1.5 py-0.5 rounded text-slate-500 hover:bg-slate-100 transition-colors">1×</button>
                    <button className="p-1.5 hover:bg-slate-100 rounded transition-colors text-slate-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-3.5 text-center text-xs text-slate-400">
                Nahrávka nie je k dispozícii
              </div>
            )}
          </div>

          {/* Tabs + content */}
          {selected.analyzed ? (
            <div className="flex-1 px-6 pt-4 pb-6 space-y-4">
              <div className="flex gap-0 border border-slate-200 rounded-xl overflow-hidden w-fit bg-white">
                {(["analysis", "transcript"] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-4 py-2 text-xs font-medium transition-colors ${
                      tab === t ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50"
                    }`}>
                    {t === "analysis" ? "🧠 AI Analýza" : "📄 Prepis"}
                  </button>
                ))}
              </div>

              {tab === "analysis" && (
                <div className="space-y-4">

                  {/* ── Score rings (grafická analýza ako v tmavom) ── */}
                  {(selected.quality != null || selected.script != null) && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-4">Výsledky analýzy</div>
                      <div className="flex items-start gap-6">
                        <div className="flex gap-8">
                          {selected.quality != null && (
                            <ScoreRing value={selected.quality} color="#6366f1" label="Kvalita hovoru" sub="Quality Score" />
                          )}
                          {selected.script != null && (
                            <ScoreRing value={selected.script} color="#10b981" label="Dodržanie skriptu" sub="Script Compliance" />
                          )}
                        </div>
                        {/* Mini score breakdown */}
                        <div className="flex-1 space-y-2 pt-1">
                          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Detail skóre</div>
                          {selected.quality != null && (
                            <div>
                              <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                <span>Profesionalita</span><span className="font-medium">{selected.quality}/10</span>
                              </div>
                              <MiniBar value={selected.quality} color="bg-indigo-400" />
                            </div>
                          )}
                          {selected.script != null && (
                            <div>
                              <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                <span>Skript</span><span className="font-medium">{selected.script}/10</span>
                              </div>
                              <MiniBar value={selected.script} color="bg-emerald-400" />
                            </div>
                          )}
                          {selected.sentiment && (
                            <div className="mt-2 pt-2 border-t border-slate-100">
                              <div className="text-[10px] text-slate-400 mb-1">Sentiment zákazníka</div>
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${sentimentCfg[selected.sentiment].badge}`}>
                                {sentimentCfg[selected.sentiment].label}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Alerts */}
                  {selected.alerts.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-base">⚠️</span>
                        <span className="text-xs font-semibold text-red-700">Kritické kľúčové slová</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selected.alerts.map((a, i) => (
                          <span key={i} className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-lg border border-red-200">{a}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  {selected.summary && (
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center shrink-0"><span className="text-sm">🧠</span></div>
                        <span className="text-xs font-semibold text-slate-600">AI Zhrnutie</span>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">{selected.summary}</p>
                    </div>
                  )}

                  {/* Topics + Action items */}
                  <div className="grid grid-cols-2 gap-3">
                    {selected.topics.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-xl p-4">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">Hlavné témy</div>
                        <div className="flex flex-wrap gap-1.5">
                          {selected.topics.map((t, i) => (
                            <span key={i} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg border border-indigo-100">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {selected.actionItems.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-xl p-4">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">Akčné kroky</div>
                        <ul className="space-y-1.5">
                          {selected.actionItems.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                              <svg className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === "transcript" && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Prepis hovoru</div>
                  {[
                    { speaker: "Agent", text: "Dobrý deň, volám z Cord Blood Center Slovakia. Môžem hovoriť s pani Kováčovou?" },
                    { speaker: "Zákazník", text: "Áno, tu Kováčová." },
                    { speaker: "Agent", text: "Kontaktujem vás ohľadom informácií o uchovávaní pupočníkovej krvi pre vaše bábätko." },
                    { speaker: "Zákazník", text: "Áno, niekde som o tom čítala. Môžete mi povedať viac?" },
                    { speaker: "Agent", text: "Samozrejme. Ponúkame komplexné služby uchovávania krvotvorných buniek z pupočníkovej krvi…" },
                  ].map((line, i) => (
                    <div key={i} className={`flex gap-3 p-2.5 rounded-lg ${line.speaker === "Zákazník" ? "bg-indigo-50 border border-indigo-100" : ""}`}>
                      <span className={`text-[10px] font-bold shrink-0 mt-0.5 w-16 ${line.speaker === "Agent" ? "text-indigo-500" : "text-emerald-600"}`}>{line.speaker}</span>
                      <span className="text-xs text-slate-700 leading-relaxed">{line.text}</span>
                    </div>
                  ))}
                  <div className="text-center text-slate-300 text-sm pt-2">···</div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
              <div className="text-4xl mb-3">🔇</div>
              <div className="text-sm font-medium text-slate-500">Hovor bez analýzy</div>
              <div className="text-xs text-slate-400 mt-1">Nahrávka nie je dostupná alebo ešte nebola spracovaná</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
