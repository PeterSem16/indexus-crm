import { useState } from "react";

const MOCK_CALLS = [
  { id: "1", time: "08:12", duration: "3:47", phone: "+421 903 123 456", name: "Jana Kováčová", direction: "inbound", status: "completed", sentiment: "positive", quality: 9, script: 8, campaign: "Jar 2024", hasRecording: true, analyzed: true, summary: "Zákazníčka si vyžiadala informácie o produkte a prejavila záujem o stretnutie.", topics: ["cord blood", "balíky", "cena"], alerts: [], agent: "Martin K." },
  { id: "2", time: "09:34", duration: "1:12", phone: "+421 911 987 654", name: "Peter Horváth", direction: "outbound", status: "no_answer", sentiment: null, quality: null, script: null, campaign: "Jar 2024", hasRecording: false, analyzed: false, summary: null, topics: [], alerts: [], agent: "Lucia B." },
  { id: "3", time: "10:05", duration: "6:22", phone: "+421 905 555 001", name: "Mária Novotná", direction: "inbound", status: "completed", sentiment: "neutral", quality: 6, script: 7, campaign: "VIP", hasRecording: true, analyzed: true, summary: "Zákazníčka sa pýtala na predĺženie zmluvy. Prísľub zavolania naspäť.", topics: ["zmluva", "predĺženie"], alerts: ["zrušiť zmluvu"], agent: "Martin K." },
  { id: "4", time: "11:18", duration: "2:05", phone: "+421 944 777 333", name: "Ján Sloboda", direction: "outbound", status: "completed", sentiment: "negative", quality: 4, script: 5, campaign: "Jar 2024", hasRecording: true, analyzed: true, summary: "Zákazník nesúhlasí s podmienkami. Vyžaduje ďalšie vysvetlenie.", topics: ["podmienky"], alerts: ["reklamácia"], agent: "Lucia B." },
  { id: "5", time: "13:45", duration: "4:30", phone: "+421 918 222 444", name: "Eva Blaho", direction: "inbound", status: "completed", sentiment: "positive", quality: 8, script: 9, campaign: "VIP", hasRecording: true, analyzed: true, summary: "Zákazníčka potvrdila záujem, podpíše zmluvu. Dohodnuté stretnutie na piatok.", topics: ["zmluva", "stretnutie", "cord blood"], alerts: [], agent: "Martin K." },
  { id: "6", time: "14:52", duration: "0:47", phone: "+421 903 654 321", name: null, direction: "outbound", status: "failed", sentiment: null, quality: null, script: null, campaign: "Jar 2024", hasRecording: false, analyzed: false, summary: null, topics: [], alerts: [], agent: "Lucia B." },
  { id: "7", time: "15:30", duration: "5:15", phone: "+421 907 111 222", name: "Tomáš Kováč", direction: "outbound", status: "completed", sentiment: "positive", quality: 9, script: 9, campaign: "VIP", hasRecording: true, analyzed: true, summary: "Úspešný hovor — zákazník prejavil maximálny záujem a vyžiadal si zmluvu emailom.", topics: ["zmluva", "email", "cord blood"], alerts: [], agent: "Martin K." },
];

const WEEK_DAYS = [
  { label: "Po", date: "13", count: 12, active: false },
  { label: "Ut", date: "14", count: 8, active: false },
  { label: "St", date: "15", count: 15, active: false },
  { label: "Šv", date: "16", count: 11, active: false },
  { label: "Pi", date: "17", count: 7, active: true },
];

const sentimentCfg: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  positive: { dot: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", label: "Pozitívny" },
  neutral:  { dot: "bg-sky-500",     bg: "bg-sky-50 dark:bg-sky-950/30",         text: "text-sky-700 dark:text-sky-400",         label: "Neutrálny" },
  negative: { dot: "bg-amber-500",   bg: "bg-amber-50 dark:bg-amber-950/30",     text: "text-amber-700 dark:text-amber-400",     label: "Negatívny" },
  angry:    { dot: "bg-red-500",     bg: "bg-red-50 dark:bg-red-950/30",         text: "text-red-700 dark:text-red-400",         label: "Nahnevaný" },
};

function QualityBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value * 10}%`, transition: "width 0.6s ease" }} />
      </div>
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 w-6 text-right">{value}</span>
    </div>
  );
}

export function Studio() {
  const [selected, setSelected] = useState(MOCK_CALLS[0]);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(32);
  const [search, setSearch] = useState("");
  const [activeDay, setActiveDay] = useState(4);
  const [tab, setTab] = useState<"analysis" | "transcript">("analysis");

  const filtered = MOCK_CALLS.filter(c =>
    !search || c.phone.includes(search) || (c.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalCalls = MOCK_CALLS.length;
  const completed = MOCK_CALLS.filter(c => c.status === "completed").length;
  const withAlerts = MOCK_CALLS.filter(c => c.alerts.length > 0).length;
  const avgQ = (MOCK_CALLS.filter(c => c.quality).reduce((s, c) => s + (c.quality || 0), 0) / MOCK_CALLS.filter(c => c.quality).length).toFixed(1);

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans text-sm">

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
          </div>
          <div>
            <div className="text-sm font-semibold leading-none">Calls & Transcripts</div>
            <div className="text-[10px] text-slate-400 mt-0.5">17. januára 2025</div>
          </div>
        </div>

        {/* Week strip */}
        <div className="flex gap-1.5 mx-auto">
          {WEEK_DAYS.map((d, i) => (
            <button
              key={i}
              onClick={() => setActiveDay(i)}
              className={`flex flex-col items-center px-3.5 py-1.5 rounded-xl text-center transition-all ${
                i === activeDay
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              }`}
            >
              <span className="text-[10px] font-medium">{d.label}</span>
              <span className={`text-sm font-bold leading-tight ${i === activeDay ? "text-white" : "text-slate-700 dark:text-slate-200"}`}>{d.date}</span>
              <span className={`text-[9px] mt-0.5 ${i === activeDay ? "text-indigo-200" : "text-slate-400"}`}>{d.count}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2 items-center">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Rozsah
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nahrať
          </button>
        </div>
      </div>

      {/* Stat bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-2.5 flex gap-6">
        {[
          { icon: "📞", label: "Hovory celkom", value: totalCalls, color: "text-slate-700 dark:text-slate-200" },
          { icon: "✅", label: "Dokončené", value: `${completed}/${totalCalls}`, color: "text-emerald-600 dark:text-emerald-400" },
          { icon: "⚠️", label: "Alerty", value: withAlerts, color: withAlerts > 0 ? "text-red-500" : "text-slate-400" },
          { icon: "⭐", label: "Priem. kvalita", value: `${avgQ}/10`, color: "text-amber-500" },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span>{s.icon}</span>
            <div>
              <span className={`text-base font-bold ${s.color}`}>{s.value}</span>
              <span className="text-[10px] text-slate-400 ml-1.5">{s.label}</span>
            </div>
            {i < 3 && <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 ml-4" />}
          </div>
        ))}
      </div>

      {/* Body: master + detail */}
      <div className="flex flex-1 min-h-0">

        {/* Master list */}
        <div className="w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col min-h-0">
          <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5">
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                placeholder="Hľadaj…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-xs text-slate-700 dark:text-slate-300 placeholder-slate-400 outline-none flex-1"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map(call => {
              const sc = call.sentiment ? sentimentCfg[call.sentiment] : null;
              const isSelected = selected.id === call.id;
              return (
                <button
                  key={call.id}
                  onClick={() => setSelected(call)}
                  className={`w-full text-left px-3.5 py-3 transition-all ${
                    isSelected
                      ? "bg-indigo-50 dark:bg-indigo-950/40 border-r-2 border-r-indigo-500"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-bold ${call.direction === "inbound" ? "text-emerald-500" : "text-sky-500"}`}>
                        {call.direction === "inbound" ? "↙" : "↗"}
                      </span>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{call.time}</span>
                      <span className="text-[10px] text-slate-400">{call.duration}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {call.alerts.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                      {sc && <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />}
                    </div>
                  </div>
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">{call.name || call.phone}</div>
                  {call.name && <div className="text-[10px] text-slate-400 truncate">{call.phone}</div>}
                  {call.summary && (
                    <div className="text-[10px] text-slate-400 truncate mt-1">{call.summary.slice(0, 58)}…</div>
                  )}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {call.status === "no_answer" && <span className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full">Neprijaté</span>}
                    {call.status === "failed" && <span className="text-[9px] bg-red-50 dark:bg-red-950/40 text-red-400 px-1.5 py-0.5 rounded-full">Chyba</span>}
                    {call.hasRecording && <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 px-1.5 py-0.5 rounded-full">🎙 Nahrávka</span>}
                    {call.quality && <span className="text-[9px] bg-amber-50 dark:bg-amber-950/40 text-amber-500 px-1.5 py-0.5 rounded-full">★ {call.quality}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-slate-50 dark:bg-slate-950">
          {/* Call header */}
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                    {(selected.name || selected.phone)[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-base font-semibold">{selected.name || selected.phone}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {selected.name && <span className="text-xs text-slate-400">{selected.phone}</span>}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${selected.direction === "inbound" ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" : "bg-sky-100 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400"}`}>
                        {selected.direction === "inbound" ? "↙ Príchodzí" : "↗ Odchodzí"}
                      </span>
                      {selected.campaign && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">{selected.campaign}</span>}
                      <span className="text-[10px] text-slate-400">{selected.time}  ·  {selected.duration}  ·  {selected.agent}</span>
                    </div>
                  </div>
                </div>
              </div>
              {selected.sentiment && (() => {
                const sc = sentimentCfg[selected.sentiment];
                return (
                  <div className={`px-3 py-2 rounded-xl ${sc.bg} text-center`}>
                    <div className={`text-sm font-bold ${sc.text}`}>{sc.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Sentiment</div>
                  </div>
                );
              })()}
            </div>

            {/* Player */}
            {selected.hasRecording ? (
              <div className="mt-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPlaying(!playing)}
                    className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center shrink-0 shadow-sm transition-colors"
                  >
                    {playing
                      ? <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
                      : <svg className="w-3.5 h-3.5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    }
                  </button>
                  <div className="flex-1">
                    <div
                      className="relative h-2 bg-slate-200 dark:bg-slate-600 rounded-full cursor-pointer"
                      onClick={e => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setProgress(Math.round(((e.clientX - r.left) / r.width) * 100));
                      }}
                    >
                      <div className="absolute left-0 top-0 h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-indigo-500 rounded-full shadow-sm"
                        style={{ left: `${progress}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-400 w-10 text-right">1:04</span>
                    <span className="text-[10px] text-slate-300">/</span>
                    <span className="text-[10px] text-slate-400 w-8">{selected.duration}</span>
                    <button className="text-[10px] border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">1×</button>
                    <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors text-slate-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-4 text-center">
                <div className="text-slate-400 text-xs">Nahrávka nie je k dispozícii</div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="px-6 pt-4">
            {selected.analyzed ? (
              <>
                <div className="flex gap-0 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mb-4 w-fit">
                  {(["analysis", "transcript"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`px-4 py-2 text-xs font-medium transition-colors ${
                        tab === t
                          ? "bg-indigo-600 text-white"
                          : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      {t === "analysis" ? "🧠 AI Analýza" : "📄 Prepis"}
                    </button>
                  ))}
                </div>

                {tab === "analysis" && (
                  <div className="space-y-4 pb-6">
                    {/* Scores */}
                    <div className="grid grid-cols-2 gap-3">
                      {selected.quality && (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Kvalita hovoru</div>
                          <QualityBar value={selected.quality} color="bg-indigo-500" />
                        </div>
                      )}
                      {selected.script && (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Dodržanie skriptu</div>
                          <QualityBar value={selected.script} color="bg-emerald-500" />
                        </div>
                      )}
                    </div>

                    {/* Alerts */}
                    {selected.alerts.length > 0 && (
                      <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2.5">
                          <span className="text-base">⚠️</span>
                          <span className="text-xs font-semibold text-red-700 dark:text-red-400">Kritické kľúčové slová</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selected.alerts.map((a, i) => (
                            <span key={i} className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-700">{a}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Summary */}
                    {selected.summary && (
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2.5">
                          <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center">
                            <span className="text-sm">🧠</span>
                          </div>
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">AI Zhrnutie</span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{selected.summary}</p>
                      </div>
                    )}

                    {/* Topics */}
                    {selected.topics.length > 0 && (
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2.5">Hlavné témy</div>
                        <div className="flex flex-wrap gap-2">
                          {selected.topics.map((t, i) => (
                            <span key={i} className="text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-800">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {tab === "transcript" && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 pb-6 space-y-2">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Prepis hovoru</div>
                    {[
                      { speaker: "Agent", text: "Dobrý deň, volám z Cord Blood Center Slovakia. Môžem hovoriť s pani Kováčovou?" },
                      { speaker: "Zákazník", text: "Áno, tu Kováčová." },
                      { speaker: "Agent", text: "Kontaktujem vás ohľadom informácií o uchovávaní pupočníkovej krvi pre vaše bábätko." },
                      { speaker: "Zákazník", text: "Áno, niekde som o tom čítala. Môžete mi povedať viac?" },
                      { speaker: "Agent", text: "Samozrejme. Ponúkame komplexné služby uchovávania krvotvorných buniek z pupočníkovej krvi..." },
                    ].map((line, i) => (
                      <div key={i} className={`flex gap-3 p-2.5 rounded-lg ${line.speaker === "Zákazník" ? "bg-indigo-50 dark:bg-indigo-950/30" : ""}`}>
                        <span className={`text-[10px] font-bold shrink-0 mt-0.5 w-16 ${line.speaker === "Agent" ? "text-indigo-500" : "text-emerald-500"}`}>{line.speaker}</span>
                        <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{line.text}</span>
                      </div>
                    ))}
                    <div className="text-center text-slate-300 pt-2">···</div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <div className="text-4xl mb-3">🔇</div>
                <div className="text-sm font-medium text-slate-500">Hovor bez analýzy</div>
                <div className="text-xs text-slate-400 mt-1">Nahrávka nie je dostupná alebo ešte nebola spracovaná</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
