import "./_group.css";
import { useMemo, useState } from "react";
import {
  CalendarDays, Check, ChevronDown, Clock3, Download, FileText, Headphones, ListFilter, Megaphone, Mic2,
  Phone, Play, Search, SlidersHorizontal, Sparkles, Star, Tag, X
} from "lucide-react";
import { calls, CallRecord, Chip, Direction } from "./_shared";

const nav = [
  ["Missions", Megaphone], ["Inbound", Phone], ["Calls & Transcripts", Mic2],
  ["Breaks", Clock3], ["SOP & Procedures", FileText],
] as const;

function SelectBox({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <button className={`group flex h-9 items-center justify-between rounded-lg border border-border bg-card px-3 text-left transition-colors hover:border-primary/40 hover:bg-accent ${wide ? "min-w-[178px]" : "min-w-[150px]"}`}>
    <span><span className="block text-[9px] font-semibold uppercase tracking-[.08em] text-muted-foreground">{label}</span><span className="text-[11px] font-medium text-foreground">{value}</span></span>
    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-y-px" />
  </button>;
}

function RecordRow({ call, selected, onClick }: { call: CallRecord; selected: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`w-full border-b border-border/70 border-l-[3px] px-4 py-3 text-left transition-colors ${selected ? "border-l-primary bg-primary/[.055]" : "border-l-transparent hover:bg-muted/60"}`}>
    <div className="mb-1.5 flex items-center justify-between"><div className="flex items-center gap-2"><Direction call={call}/><span className="text-xs font-bold">{call.time}</span><span className="text-[10px] text-muted-foreground">{call.duration}</span></div><span className={`h-1.5 w-1.5 rounded-full ${call.sentiment === "positive" ? "bg-emerald-500" : call.sentiment === "negative" ? "bg-amber-500" : "bg-sky-500"}`} /></div>
    <div className="truncate text-xs font-semibold">{call.name}</div>
    <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{call.phone}</div>
    <div className="mt-1.5 truncate text-[10px] italic leading-4 text-muted-foreground">{call.summary}</div>
    <div className="mt-2 flex gap-1.5">{call.status && <Chip>{call.status}</Chip>}{call.direction === "inbound" && <Chip tone="green">Inbound</Chip>}{call.important && <Chip tone="orange"><Star className="mr-1 h-2.5 w-2.5 fill-amber-400" /> Dôležité</Chip>}</div>
  </button>;
}

function Detail({ call }: { call: CallRecord }) {
  const [important, setImportant] = useState(!!call.important);
  const [playing, setPlaying] = useState(false);
  return <section className="min-h-0 flex-1 overflow-y-auto bg-background">
    <div className="border-b border-border px-6 py-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-bold">{call.name}</h2><span className="text-[10px] text-muted-foreground">{call.phone}</span><Chip tone={call.direction === "inbound" ? "green" : "blue"}>{call.direction === "inbound" ? "Inbound" : "Outbound"}</Chip></div><p className="mt-1 text-[10px] text-muted-foreground">12. 06. 2025, {call.time} · {call.duration} · {call.agent}</p></div>
        <div className={`rounded-lg px-3 py-1.5 text-center ${call.sentiment === "positive" ? "bg-emerald-50 text-emerald-700" : call.sentiment === "negative" ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"}`}><div className="text-[11px] font-bold capitalize">{call.sentiment}</div><div className="text-[9px] text-muted-foreground">sentiment</div></div>
        <button onClick={() => setImportant(!important)} aria-label="Mark important" className="rounded-lg p-2 transition-colors hover:bg-muted"><Star className={`h-4 w-4 ${important ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`} /></button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5"><Chip tone="red"><Megaphone className="mr-1 h-3 w-3" />{call.campaign}</Chip>{call.queue && <Chip tone="orange"><Phone className="mr-1 h-3 w-3" />{call.queue}</Chip>}<Chip tone="blue"><Tag className="mr-1 h-3 w-3" /> INDEXUS Connect</Chip></div>
    </div>
    <div className="max-w-3xl space-y-3 p-5">
      <div className="flex items-center gap-1 border-b border-border"><button className="border-b-2 border-primary px-3 py-2 text-xs font-semibold text-primary">Analýza hovoru</button><button className="px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">Prepis hovoru</button><button className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted"><Download className="h-3 w-3" /> Stiahnuť</button></div>
      <div className="grid grid-cols-3 gap-2"><div className="rounded-lg border border-border bg-card p-3"><div className="text-[10px] text-muted-foreground">Kvalita hovoru</div><div className="mt-1 text-xl font-bold text-amber-600">8.4 <span className="text-xs font-normal">/ 10</span></div></div><div className="rounded-lg border border-border bg-card p-3"><div className="text-[10px] text-muted-foreground">Dĺžka</div><div className="mt-1 text-xl font-bold">{call.duration}</div></div><div className="rounded-lg border border-border bg-card p-3"><div className="text-[10px] text-muted-foreground">Hodnotenie</div><div className="mt-1 text-xl font-bold text-emerald-600">92%</div></div></div>
      <div className="rounded-xl border border-border bg-card"><div className="flex items-center gap-2 border-b border-border px-4 py-3"><Sparkles className="h-4 w-4 text-primary" /><span className="text-xs font-semibold">Zhrnutie hovoru</span><span className="ml-auto text-[9px] text-muted-foreground">AI analýza</span></div><p className="p-4 text-xs leading-relaxed text-muted-foreground">{call.summary} Agent profesionálne reagoval na otázky a dohodol ďalší postup.</p></div>
      <div className="rounded-xl border border-border bg-card"><div className="flex items-center gap-2 border-b border-border px-4 py-3"><Check className="h-4 w-4 text-emerald-600" /><span className="text-xs font-semibold">Kľúčové témy a akcie</span></div><div className="grid grid-cols-2 gap-4 p-4 text-xs"><div><b>Diskutované témy</b><p className="mt-1 text-muted-foreground">Produktová ponuka, ceny, ďalšie kroky</p></div><div><b>Ďalšia akcia</b><p className="mt-1 text-muted-foreground">Naplánovať spätný hovor do 7 dní</p></div></div></div>
      <div className="rounded-xl border border-border bg-card"><div className="flex items-center gap-2 border-b border-border px-4 py-3"><Headphones className="h-4 w-4 text-primary" /><span className="text-xs font-semibold">Nahrávka hovoru</span><span className="ml-auto rounded-md bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700">Dostupná</span></div><div className="flex items-center gap-3 p-4"><button onClick={() => setPlaying(!playing)} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105">{playing ? <span className="text-xs font-bold">Ⅱ</span> : <Play className="ml-0.5 h-4 w-4 fill-current" />}</button><div className="h-1.5 flex-1 rounded-full bg-muted"><div className={`h-full rounded-full bg-primary transition-all ${playing ? "w-2/3" : "w-1/3"}`} /></div><span className="text-[10px] text-muted-foreground">{call.duration}</span></div></div>
    </div>
  </section>;
}

export function CalmWorkspace() {
  const [activeNav, setActiveNav] = useState("Calls & Transcripts");
  const [activeTab, setActiveTab] = useState<"browse" | "search">("browse");
  const [selected, setSelected] = useState(calls[0].id);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const visible = useMemo(() => calls.filter(c => `${c.name} ${c.phone} ${c.summary}`.toLowerCase().includes(search.toLowerCase())), [search]);
  const selectedCall = calls.find(c => c.id === selected) || calls[0];
  return <main className="flex min-h-[100dvh] flex-col bg-muted/30 font-sans text-foreground">
    <header className="shrink-0 border-b border-border bg-background px-7 pt-4">
      <div className="flex items-start justify-between"><div><div className="mb-1 text-[10px] font-bold uppercase tracking-[.16em] text-primary">INDEXUS / Missions</div><h1 className="text-[22px] font-bold tracking-tight">Calls & Transcripts</h1><p className="mt-1 text-xs text-muted-foreground">Review conversations, outcomes and agent quality in one workspace.</p></div><div className="flex items-center gap-3 pt-1"><div className="text-right"><div className="text-[10px] text-muted-foreground">Today, 12 Jun 2025</div><div className="text-xs font-semibold">Workspace active</div></div><div className="h-2 w-2 rounded-full bg-emerald-500" /></div></div>
      <nav className="mt-4 flex gap-1 overflow-x-auto">{nav.map(([label, Icon]) => <button key={label} onClick={() => setActiveNav(label)} className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${activeNav === label ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}</nav>
    </header>
    <div className="shrink-0 border-b border-border bg-background px-7 py-4"><div className="flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Call review</p><div className="mt-1 flex items-center gap-3"><span className="text-sm font-semibold">June activity</span><span className="text-[11px] text-muted-foreground">128 calls · 7 alerts · quality 8.2 / 10</span></div></div><button onClick={() => setShowFilters(!showFilters)} className={`flex h-8 items-center gap-2 rounded-lg border px-3 text-[11px] font-semibold transition-colors ${showFilters ? "border-primary/30 bg-primary/5 text-primary" : "hover:bg-muted"}`}><SlidersHorizontal className="h-3.5 w-3.5" /> {showFilters ? "Hide filters" : "More filters"}</button></div>
      <div className="mt-3 flex flex-wrap items-center gap-2"><div className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3"><CalendarDays className="h-3.5 w-3.5 text-primary" /><div><span className="mr-2 text-[9px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Exact range</span><span className="text-[11px] font-medium">01 Jun 2025, 00:00 <span className="mx-1 text-muted-foreground">→</span> 30 Jun 2025, 23:59</span></div></div><SelectBox label="Quick range" value="This month" /><SelectBox label="Mission" value="All missions" wide /><SelectBox label="Inbound Queue" value="All queues" wide /><button onClick={() => setShowFilters(!showFilters)} className="flex h-9 items-center gap-2 rounded-lg border border-dashed border-border px-3 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"><ListFilter className="h-3.5 w-3.5" /> Additional filters</button></div>
      {showFilters && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2"><span className="mr-1 text-[10px] font-semibold text-muted-foreground">Filter by</span>{["Direction", "Status", "Sentiment", "Recording"].map(x => <button key={x} className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-[10px] text-muted-foreground hover:text-foreground">{x}<ChevronDown className="h-3 w-3" /></button>)}<button onClick={() => setShowFilters(false)} className="ml-auto p-1 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button></div>}
    </div>
    <div className="flex min-h-0 flex-1 flex-col bg-background md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-border md:w-[315px] md:border-b-0 md:border-r"><div className="border-b border-border px-4 py-3"><div className="flex rounded-lg border border-border bg-muted/35 p-0.5"><button onClick={() => setActiveTab("browse")} className={`flex-1 rounded-md px-3 py-1.5 text-[11px] font-semibold ${activeTab === "browse" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>All calls</button><button onClick={() => setActiveTab("search")} className={`flex-1 rounded-md px-3 py-1.5 text-[11px] font-semibold ${activeTab === "search" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>Search transcripts</button></div>{activeTab === "browse" && <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search calls…" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground" /><span className="text-[10px] text-muted-foreground">{visible.length}</span></div>}</div>{activeTab === "browse" ? <div className="min-h-0 flex-1 overflow-y-auto">{visible.map(c => <RecordRow key={c.id} call={c} selected={selected === c.id} onClick={() => setSelected(c.id)} />)}</div> : <div className="p-4"><div className="text-xs font-semibold">Search across transcripts</div><p className="mt-1 text-[10px] leading-4 text-muted-foreground">Find words, phrases and outcomes in recorded conversations.</p><div className="mt-4 flex items-center gap-2 rounded-lg border border-border px-2.5 py-2"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input autoFocus value={transcriptSearch} onChange={e => setTranscriptSearch(e.target.value)} placeholder="e.g. follow-up, price…" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></div><button className="mt-2 h-8 w-full rounded-lg bg-primary text-[11px] font-semibold text-primary-foreground hover:bg-primary/90">Search transcripts</button></div>}</aside>
      <Detail call={selectedCall} />
    </div>
  </main>;
}