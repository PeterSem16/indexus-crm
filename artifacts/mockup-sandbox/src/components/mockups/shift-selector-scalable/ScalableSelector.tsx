import { useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Headphones,
  Info,
  Phone,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";

type Mission = {
  id: string; name: string; channel: string; channelColor: string; country: string;
  dates: string; hours: string; caller: string; version?: string;
};
type Queue = {
  id: string; name: string; did: string; online: number; waiting: number;
  afterHours: boolean; hours: string;
};

const missions: Mission[] = [
  { id: "m1", name: "FMO", channel: "Telefón", channelColor: "#397fe6", country: "SK", dates: "17.02.26 – 31.01.27", hours: "09:00 – 17:00", caller: "0232399030" },
  { id: "m2", name: "Medical Partner Cooperation", channel: "Mix", channelColor: "#9b52db", country: "SK", dates: "30.03.26 – 29.02.28", hours: "09:00 – 17:00", caller: "+421 940 682 394", version: "Aktívna verzia: v1" },
  { id: "m3", name: "Zdravotná poisťovňa Dôvera", channel: "Telefón", channelColor: "#397fe6", country: "SK", dates: "01.04.26 – 31.12.26", hours: "08:00 – 16:00", caller: "02 555 014 40" },
  { id: "m4", name: "Prvá stavebná sporiteľňa", channel: "Mix", channelColor: "#9b52db", country: "SK", dates: "01.01.26 – 31.12.26", hours: "08:00 – 18:00", caller: "02 492 785 11", version: "Aktívna verzia: v3" },
  { id: "m5", name: "CZ Účty a platby", channel: "Telefón", channelColor: "#397fe6", country: "CZ", dates: "15.02.26 – 30.06.26", hours: "09:00 – 17:00", caller: "+420 226 219 400" },
  { id: "m6", name: "HU Customer Care", channel: "Mix", channelColor: "#9b52db", country: "HU", dates: "01.03.26 – 31.08.26", hours: "09:00 – 17:00", caller: "+36 1 445 2900" },
  { id: "m7", name: "Obnova zmlúv 2026", channel: "Telefón", channelColor: "#397fe6", country: "SK", dates: "01.05.26 – 30.09.26", hours: "10:00 – 18:00", caller: "02 321 889 12" },
  { id: "m8", name: "Retencia klientov", channel: "Mix", channelColor: "#9b52db", country: "SK", dates: "10.04.26 – 31.12.26", hours: "08:30 – 16:30", caller: "02 208 440 66", version: "Aktívna verzia: v2" },
];

const queues: Queue[] = [
  { id: "q1", name: "Inbound Medical Partner", did: "+421 940 682 394", online: 2, waiting: 0, afterHours: false, hours: "09:00 – 17:00" },
  { id: "q2", name: "Inbound FMO", did: "023 239 9030", online: 1, waiting: 3, afterHours: false, hours: "09:00 – 17:00" },
  { id: "q3", name: "Inbound Dôvera", did: "02 555 014 40", online: 4, waiting: 0, afterHours: false, hours: "08:00 – 16:00" },
  { id: "q4", name: "Klientská linka – SK", did: "02 492 785 11", online: 7, waiting: 1, afterHours: false, hours: "08:00 – 18:00" },
  { id: "q5", name: "CZ zákaznícka podpora", did: "+420 226 219 400", online: 0, waiting: 0, afterHours: true, hours: "09:00 – 17:00" },
  { id: "q6", name: "Retencia – prioritná linka", did: "02 208 440 66", online: 3, waiting: 5, afterHours: false, hours: "08:30 – 16:30" },
];

const IconBox = ({ children, color }: { children: React.ReactNode; color: string }) => (
  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}13`, color }}>
    {children}
  </span>
);

export function ScalableSelector() {
  const [selectedMissions, setSelectedMissions] = useState<string[]>(["m1", "m2"]);
  const [selectedQueues, setSelectedQueues] = useState<string[]>(["q2"]);
  const [backOffice, setBackOffice] = useState(false);
  const [query, setQuery] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [expanded, setExpanded] = useState<string[]>(["m2", "q2"]);
  const [started, setStarted] = useState(false);

  const visibleMissions = useMemo(() => missions.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()) && (!onlyAvailable || m.hours !== "—")), [query, onlyAvailable]);
  const visibleQueues = useMemo(() => queues.filter((q) => q.name.toLowerCase().includes(query.toLowerCase()) && (!onlyAvailable || !q.afterHours)), [query, onlyAvailable]);
  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const toggleExpand = (id: string) => setExpanded((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const total = selectedMissions.length + selectedQueues.length + (backOffice ? 1 : 0);

  if (started) return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef2f8] p-6 font-sans">
      <div className="w-full max-w-md rounded-2xl border border-[#d7dee9] bg-white p-8 text-center shadow-[0_20px_60px_rgba(30,48,76,.15)]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#e7f6ed] text-[#199653]"><Check size={28} /></div>
        <h2 className="text-xl font-semibold text-[#1d2d43]">Zmena je spustená</h2>
        <p className="mt-2 text-sm text-[#6e7b8d]">{total} pracovných oblastí je pripravených. Môžete začať prijímať kontakty.</p>
        <button onClick={() => setStarted(false)} className="mt-6 rounded-lg border border-[#cfd8e5] px-4 py-2 text-sm font-medium text-[#3a4a60] hover:bg-[#f5f7fa]">Upraviť výber</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#e9eef5] p-3 font-sans text-[#243247] sm:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1180px] flex-col overflow-hidden rounded-2xl border border-[#cfd8e5] bg-white shadow-[0_24px_70px_rgba(40,57,83,.18)]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5e9ef] bg-gradient-to-r from-[#fffaf8] to-[#f5f8fc] px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c8102e] text-white shadow-sm"><Headphones size={20} /></div>
            <div><div className="text-[17px] font-bold tracking-[-.02em] text-[#1d2d43]">Prihlásenie do zmeny</div><div className="text-xs text-[#7d8999]">Vyberte pracovné oblasti pre dnešnú zmenu</div></div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[#dfe5ed] bg-white px-3 py-2">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#dce8f8] text-xs font-bold text-[#386da9]">PR<span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-white bg-[#27a65d]" /></div>
            <div className="leading-tight"><div className="text-sm font-semibold">Peter Repman</div><div className="text-[11px] text-[#8a95a4]">seman@dialcom.sk</div></div>
            <span className="rounded-full border border-[#bce8cc] bg-[#eefbf2] px-2 py-1 text-[11px] font-medium text-[#249251]">Online</span>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="w-full border-b border-[#e5e9ef] bg-[#f8fafc] p-5 lg:w-[32%] lg:border-b-0 lg:border-r lg:p-7">
            <div className="mb-7"><div className="text-[11px] font-bold uppercase tracking-[.14em] text-[#8995a5]">Dnešná zmena</div><h1 className="mt-2 text-2xl font-bold tracking-[-.04em] text-[#243247]">Pripravení na štart?</h1><p className="mt-2 text-sm leading-6 text-[#718094]">Vyberte aspoň jednu Misiu alebo inbound frontu. Výber môžete počas zmeny upraviť.</p></div>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-[#dfe6ee] bg-white px-4 py-3"><span className="text-xs text-[#7b8797]">Vybrané oblasti</span><strong className="text-lg text-[#c8102e]">{total}</strong></div>
              <div className="flex items-center justify-between rounded-xl border border-[#dfe6ee] bg-white px-4 py-3"><span className="text-xs text-[#7b8797]">Misie</span><span className="text-sm font-semibold text-[#3e78d0]">{selectedMissions.length} / {missions.length}</span></div>
              <div className="flex items-center justify-between rounded-xl border border-[#dfe6ee] bg-white px-4 py-3"><span className="text-xs text-[#7b8797]">Inbound fronty</span><span className="text-sm font-semibold text-[#1a9b57]">{selectedQueues.length} / {queues.length}</span></div>
            </div>
            <div className="mt-7 rounded-xl border border-[#ead9d6] bg-[#fff8f6] p-4"><div className="flex gap-2 text-xs font-semibold text-[#9b3c38]"><Info size={15} /> Výber ovplyvní dostupné kontakty</div><p className="mt-2 text-[11px] leading-5 text-[#9b7772]">Misie môžete kombinovať. Pri frontách uvidíte stav čakania a dostupných agentov v reálnom čase.</p></div>
          </aside>

          <main className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-[#e5e9ef] px-5 py-3 sm:px-6">
              <div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa6b5]" size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hľadať Misiu alebo frontu…" className="h-9 w-full rounded-lg border border-[#d8e0ea] bg-[#fafbfd] pl-9 pr-3 text-sm outline-none transition focus:border-[#7ca3db] focus:ring-2 focus:ring-[#dce9fa]" /></div>
              <button onClick={() => setOnlyAvailable(!onlyAvailable)} className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition ${onlyAvailable ? "border-[#9bc9ae] bg-[#eefaf2] text-[#198a4d]" : "border-[#d8e0ea] bg-white text-[#6f7d8e]"}`}><SlidersHorizontal size={14} />{onlyAvailable ? "Len dostupné" : "Všetky oblasti"}</button>
              {query && <button onClick={() => setQuery("")} className="rounded-lg p-2 text-[#8c98a8] hover:bg-[#f1f4f8]"><X size={15} /></button>}
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-5 py-5 sm:px-6">
              <SectionHeader label="Misie" count={`${selectedMissions.length} vybrané`} color="#397fe6" onSelectAll={() => setSelectedMissions(visibleMissions.map((m) => m.id))} />
              <div className="grid gap-2 xl:grid-cols-2">
                {visibleMissions.map((m) => { const selected = selectedMissions.includes(m.id); const open = expanded.includes(m.id); return (
                  <div key={m.id} className={`rounded-xl border transition ${selected ? "border-[#a9c9f4] bg-[#f8fbff]" : "border-[#e2e7ee] bg-white hover:border-[#c6d2e1]"}`}>
                    <div className="flex cursor-pointer items-center gap-3 p-3" onClick={() => toggle(selectedMissions, setSelectedMissions, m.id)}>
                      <div className="h-9 w-1 rounded-full" style={{ background: m.channelColor }} /><IconBox color={m.channelColor}><Phone size={16} /></IconBox>
                      <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-[#26364b]">{m.name}</div><div className="mt-1 flex items-center gap-2 text-[11px] text-[#8793a2]"><span>{m.country}</span><span>·</span><span>{m.channel}</span>{m.version && <span className="rounded bg-[#f1eaff] px-1.5 text-[#8257ba]">{m.version}</span>}</div></div>
                      <button onClick={(e) => { e.stopPropagation(); toggleExpand(m.id); }} className="rounded p-1 text-[#93a0b0] hover:bg-[#edf2f8]">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button><Mark checked={selected} color="#397fe6" />
                    </div>
                    {open && <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[#e7edf4] px-14 py-2.5 text-[10px] text-[#6f7c8d]"><span className="flex items-center gap-1"><Clock3 size={11} />{m.hours}</span><span className="flex items-center gap-1"><Phone size={11} />{m.caller}</span><span>{m.dates}</span></div>}
                  </div>
                );})}
              </div>
              <SectionHeader label="Inbound fronty" count={`${selectedQueues.length} vybrané`} color="#1a9b57" onSelectAll={() => setSelectedQueues(visibleQueues.filter(q => !q.afterHours).map((q) => q.id))} />
              <div className="grid gap-2 xl:grid-cols-2">
                {visibleQueues.map((q) => { const selected = selectedQueues.includes(q.id); const open = expanded.includes(q.id); return (
                  <div key={q.id} className={`rounded-xl border transition ${selected ? "border-[#a9dfbd] bg-[#f7fdf9]" : "border-[#e2e7ee] bg-white hover:border-[#c6d2e1]"}`}>
                    <div className="flex cursor-pointer items-center gap-3 p-3" onClick={() => !q.afterHours && toggle(selectedQueues, setSelectedQueues, q.id)}>
                      <div className="h-9 w-1 rounded-full bg-[#1a9b57]" /><IconBox color="#1a9b57"><Phone size={16} /></IconBox><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-[#26364b]">{q.name}</div><div className="mt-1 flex items-center gap-2 text-[11px] text-[#8793a2]"><span>{q.did}</span><span className="text-[#1a9b57]">{q.online} online</span>{q.waiting > 0 && <span className="font-semibold text-[#d07a22]">{q.waiting} čaká</span>}</div></div>
                      <button onClick={(e) => { e.stopPropagation(); toggleExpand(q.id); }} className="rounded p-1 text-[#93a0b0] hover:bg-[#edf2f8]">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>{q.afterHours ? <span className="rounded bg-[#fff2e8] px-2 py-1 text-[10px] font-medium text-[#b56a2b]">Mimo hodín</span> : <Mark checked={selected} color="#1a9b57" />}
                    </div>
                    {open && <div className="flex flex-wrap gap-x-4 border-t border-[#e7edf4] px-14 py-2.5 text-[10px] text-[#6f7c8d]"><span className="flex items-center gap-1"><Clock3 size={11} />{q.hours}</span><span className={q.waiting ? "font-semibold text-[#d07a22]" : ""}>{q.waiting ? "Čakajúce hovory vyžadujú pozornosť" : "Bez čakania"}</span></div>}
                  </div>
                );})}
              </div>
              <div className="mt-5 rounded-xl border border-[#ded8ed] bg-[#fbfaff]">
                <button onClick={() => setBackOffice(!backOffice)} className="flex w-full items-center gap-3 p-3 text-left"><div className="h-9 w-1 rounded-full bg-[#7c5ac8]" /><IconBox color="#7c5ac8"><BriefcaseBusiness size={16} /></IconBox><div className="flex-1"><div className="text-sm font-semibold text-[#3d3158]">Back Office</div><div className="text-[11px] text-[#887b9e]">Spracovanie úloh a interných požiadaviek</div></div><span className="mr-2 text-[10px] text-[#887b9e]">Dostupné pre vašu rolu</span><Mark checked={backOffice} color="#7c5ac8" /></button>
              </div>
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e9ef] bg-[#fbfcfe] px-5 py-4 sm:px-6"><div className="flex items-center gap-2 text-xs text-[#718094]"><Users size={15} /><span><strong className="text-[#33445a]">{total}</strong> oblastí pripravených na zmenu</span></div><button disabled={total === 0} onClick={() => setStarted(true)} className="flex items-center gap-2 rounded-lg bg-[#c8102e] px-6 py-3 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(200,16,46,.22)] transition hover:bg-[#ad0e29] disabled:cursor-not-allowed disabled:opacity-40">Začať zmenu <ArrowRight size={17} /></button></footer>
          </main>
        </div>
      </div>
    </div>
  );
}

function Mark({ checked, color }: { checked: boolean; color: string }) {
  return <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-2" style={{ background: checked ? color : "transparent", borderColor: checked ? color : "#cbd5e1" }}>{checked && <Check size={12} strokeWidth={3} color="white" />}</span>;
}

function SectionHeader({ label, count, color, onSelectAll }: { label: string; count: string; color: string; onSelectAll: () => void }) {
  return <div className="mb-2 mt-1 flex items-center justify-between"><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-[#748193]"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{label}<span className="normal-case tracking-normal text-[#a0aab8]">· {count}</span></div><button onClick={onSelectAll} className="text-[11px] font-medium text-[#4c75aa] hover:underline">Vybrať dostupné</button></div>;
}