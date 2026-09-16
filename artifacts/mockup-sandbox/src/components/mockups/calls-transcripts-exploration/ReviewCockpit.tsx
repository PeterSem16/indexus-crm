import "./_group.css";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Headphones,
  LayoutList,
  Menu,
  MessageSquareText,
  Play,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  X,
} from "lucide-react";
import { calls, CallRecord, Chip, Direction } from "./_shared";

const nav = ["Missions", "Inbound", "Calls & Transcripts", "Breaks", "SOP & Procedures"];

function ScopeSelect({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="group flex min-w-[146px] items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left transition hover:border-primary/40 hover:bg-accent">
      <span><span className="block text-[9px] font-semibold uppercase tracking-[.12em] text-muted-foreground">{label}</span><span className="text-[11px] font-semibold">{value}</span></span>
      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition group-hover:text-primary" />
    </button>
  );
}

function RecordRow({ call, selected, onClick }: { call: CallRecord; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full border-b border-border/70 border-l-[3px] px-3.5 py-3 text-left transition ${selected ? "border-l-primary bg-primary/[.07]" : "border-l-transparent hover:bg-accent/70"}`}>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5"><Direction call={call} /><span className="font-mono text-[11px] font-bold">{call.time}</span><span className="text-[10px] text-muted-foreground">{call.duration}</span></div>
        <span className={`h-2 w-2 rounded-full ring-2 ring-background ${call.sentiment === "positive" ? "bg-emerald-500" : call.sentiment === "negative" ? "bg-amber-500" : "bg-sky-500"}`} />
      </div>
      <div className="truncate text-xs font-bold">{call.name}</div>
      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{call.summary}</div>
      <div className="mt-2 flex gap-1.5">{call.status && <Chip>{call.status}</Chip>}{call.queue && <Chip tone="orange">{call.queue}</Chip>}{call.important && <Chip tone="red"><Star className="mr-1 h-2.5 w-2.5 fill-current" />Flagged</Chip>}</div>
    </button>
  );
}

function DetailPane({ call }: { call: CallRecord }) {
  const [tab, setTab] = useState<"analysis" | "transcript">("analysis");
  const [playing, setPlaying] = useState(false);
  const [important, setImportant] = useState(!!call.important);
  return (
    <section className="min-w-0 flex-1 overflow-y-auto bg-background">
      <div className="border-b border-border bg-card px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-bold">{call.name}</h2><Chip tone={call.direction === "inbound" ? "green" : "blue"}>{call.direction}</Chip>{call.status && <Chip>{call.status}</Chip>}</div><p className="mt-1 text-[10px] text-muted-foreground">{call.phone} <span className="px-1">·</span> 12 Jun 2025, {call.time} <span className="px-1">·</span> {call.duration}</p></div>
          <div className={`rounded-lg px-3 py-1.5 text-center ${call.sentiment === "positive" ? "bg-emerald-50 text-emerald-700" : call.sentiment === "negative" ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"}`}><div className="text-xs font-bold capitalize">{call.sentiment}</div><div className="text-[9px] text-muted-foreground">sentiment</div></div>
          <button aria-label="Flag call" onClick={() => setImportant(!important)} className="rounded-lg p-2 transition hover:bg-accent"><Star className={`h-4 w-4 ${important ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`} /></button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5"><Chip tone="red"><Tag className="mr-1 h-3 w-3" />{call.campaign}</Chip><Chip><span className="mr-1 h-1.5 w-1.5 rounded-full bg-sky-500" />{call.agent}</Chip>{call.queue && <Chip tone="orange">{call.queue}</Chip>}</div>
      </div>
      <div className="border-b border-border px-5"><div className="flex gap-5"><button onClick={() => setTab("analysis")} className={`border-b-2 py-3 text-xs font-bold ${tab === "analysis" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}><Sparkles className="mr-1.5 inline h-3.5 w-3.5" />Call analysis</button><button onClick={() => setTab("transcript")} className={`border-b-2 py-3 text-xs font-bold ${tab === "transcript" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}><MessageSquareText className="mr-1.5 inline h-3.5 w-3.5" />Transcript</button></div></div>
      {tab === "analysis" ? <div className="space-y-3 p-5">
        <div className="grid grid-cols-3 gap-2"><div className="rounded-lg border border-border bg-card p-3"><p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Quality score</p><strong className="mt-1 block text-xl text-amber-600">8.4 <small className="text-[10px] font-normal text-muted-foreground">/ 10</small></strong></div><div className="rounded-lg border border-border bg-card p-3"><p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Talk time</p><strong className="mt-1 block text-xl">64%</strong></div><div className="rounded-lg border border-border bg-card p-3"><p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Outcome</p><strong className="mt-1 block text-xl text-emerald-600">92%</strong></div></div>
        <article className="rounded-lg border border-border bg-card"><header className="flex items-center gap-2 border-b border-border px-3.5 py-3"><Sparkles className="h-4 w-4 text-primary" /><b className="text-xs">AI summary</b><span className="ml-auto text-[9px] text-muted-foreground">Updated just now</span></header><p className="p-3.5 text-xs leading-relaxed text-muted-foreground">{call.summary} Agent profesionálne reagoval na otázky, overil potreby klienta a dohodol ďalší postup.</p></article>
        <article className="rounded-lg border border-border bg-card"><header className="flex items-center gap-2 border-b border-border px-3.5 py-3"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><b className="text-xs">Review outcomes</b></header><div className="grid grid-cols-2 gap-4 p-3.5 text-xs"><div><span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Topics</span><p className="mt-1">Product offer, pricing, next steps</p></div><div><span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Next action</span><p className="mt-1">Schedule a follow-up within 7 days</p></div></div></article>
        <article className="rounded-lg border border-border bg-card"><header className="flex items-center gap-2 border-b border-border px-3.5 py-3"><Headphones className="h-4 w-4 text-primary" /><b className="text-xs">Call recording</b><button className="ml-auto flex items-center gap-1 rounded border px-2 py-1 text-[10px] text-muted-foreground transition hover:bg-accent"><Download className="h-3 w-3" />Export</button></header><div className="flex items-center gap-3 p-4"><button onClick={() => setPlaying(!playing)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/85"><Play className={`h-4 w-4 fill-current ${playing ? "ml-0" : "ml-0.5"}`} /></button><div className="flex-1"><div className="relative h-1.5 rounded-full bg-muted"><div className={`h-full rounded-full bg-primary transition-all ${playing ? "w-2/3" : "w-1/3"}`} /></div><div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground"><span>{playing ? "02:51" : "00:00"}</span><span>{call.duration}</span></div></div></div></article>
      </div> : <div className="space-y-2 p-5"><div className="rounded-lg border border-border bg-card p-4 text-xs leading-7"><p><b className="mr-2 text-primary">00:04</b> Dobrý deň, tu je Lucia z INDEXUS.</p><p><b className="mr-2 text-primary">00:17</b> Volám kvôli našej poslednej prezentácii a ďalšiemu termínu.</p><p><b className="mr-2 text-primary">01:26</b> Klient potvrdil záujem o rozšírenie objednávky.</p><p><b className="mr-2 text-primary">03:42</b> Dohodnime teda krátky follow-up budúci týždeň.</p></div></div>}
    </section>
  );
}

export function ReviewCockpit() {
  const [selected, setSelected] = useState(calls[0].id);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("All calls");
  const [filters, setFilters] = useState(false);
  const [range, setRange] = useState("This month");
  const [mission, setMission] = useState("All missions");
  const [queue, setQueue] = useState("All inbound queues");
  const visible = useMemo(() => calls.filter((c) => `${c.name} ${c.phone} ${c.summary} ${c.queue ?? ""}`.toLowerCase().includes(search.toLowerCase())), [search]);
  const selectedCall = calls.find((c) => c.id === selected) ?? calls[0];
  return <main className="flex min-h-[100dvh] flex-col overflow-hidden bg-muted/30 text-foreground font-sans">
    <header className="shrink-0 border-b border-border bg-background">
      <div className="flex items-center gap-4 px-5 pt-3.5"><button className="rounded-md p-1.5 hover:bg-accent md:hidden"><Menu className="h-4 w-4" /></button><div><h1 className="text-lg font-bold tracking-tight">Missions</h1><p className="text-[10px] text-muted-foreground">Review cockpit <span className="px-1">/</span> Calls &amp; Transcripts</p></div><div className="ml-auto flex items-center gap-3 text-[10px]"><span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" /> 7 need review</span><span className="flex items-center gap-1 text-amber-600"><Star className="h-3 w-3 fill-current" /> 8.2 avg quality</span></div></div>
      <nav className="mt-3 flex gap-1 overflow-x-auto px-5">{nav.map((item) => <button key={item} className={`whitespace-nowrap border-b-2 px-3 py-2 text-[11px] font-semibold transition ${item === "Calls & Transcripts" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{item}</button>)}</nav>
    </header>
    <div className="shrink-0 border-b border-border bg-card px-5 py-3">
      <div className="flex flex-wrap items-end gap-2.5"><div className="mr-2"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-primary">Scope</p><p className="text-xs font-bold">Review calls</p></div><div className="flex h-[39px] items-center rounded-lg border border-border bg-muted/40 p-0.5"><button onClick={() => setTab("All calls")} className={`h-full rounded-md px-3 text-[11px] font-bold transition ${tab === "All calls" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>All calls</button><button onClick={() => setTab("Search transcripts")} className={`h-full rounded-md px-3 text-[11px] font-bold transition ${tab === "Search transcripts" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><MessageSquareText className="mr-1.5 inline h-3 w-3" />Search transcripts</button></div><ScopeSelect label="Quick range" value={range} onClick={() => setRange(range === "This month" ? "Last 7 days" : "This month")} /><button className="flex h-[39px] items-center gap-2 rounded-lg border border-border bg-card px-3 text-[11px] font-semibold"><CalendarDays className="h-3.5 w-3.5 text-primary" />01 Jun 2025, 00:00 <span className="text-muted-foreground">→</span> 30 Jun 2025, 23:59</button><ScopeSelect label="Mission" value={mission} onClick={() => setMission(mission === "All missions" ? "Q2 Clinic Expansion" : "All missions")} /><ScopeSelect label="Inbound Queue" value={queue} onClick={() => setQueue(queue === "All inbound queues" ? "SK — Všeobecná linka" : "All inbound queues")} /><button onClick={() => setFilters(!filters)} className={`flex h-[39px] items-center gap-2 rounded-lg border px-3 text-[11px] font-semibold transition ${filters ? "border-primary/30 bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}><SlidersHorizontal className="h-3.5 w-3.5" />Additional filters {filters ? <X className="h-3 w-3" /> : <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px]">4</span>}</button></div>
      {filters && <div className="mt-2.5 flex flex-wrap gap-2 border-t border-border pt-2.5">{["Direction: All", "Status: Any", "Sentiment: Any", "Recording: Available"].map((f) => <button key={f} className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[10px] text-muted-foreground hover:border-primary/40">{f}<ChevronDown className="ml-2 inline h-3 w-3" /></button>)}</div>}
    </div>
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-border bg-background md:w-[320px] md:border-b-0 md:border-r">
        <div className="shrink-0 border-b border-border px-3.5 py-3"><div className="flex items-center gap-2"><div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tab === "Search transcripts" ? "Search words in transcripts…" : "Search calls…"} className="min-w-0 flex-1 bg-transparent text-xs outline-none" /><span className="font-mono text-[9px] text-muted-foreground">⌘K</span></div><button title="Bulk download" className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent"><ArrowDownToLine className="h-3.5 w-3.5" /></button></div><div className="mt-2 flex items-center justify-between"><span className="text-[10px] text-muted-foreground"><b className="text-foreground">{visible.length}</b> of 128 calls</span><span className="flex items-center gap-1 text-[10px] text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Live index</span></div></div>
        <div className="min-h-0 flex-1 overflow-y-auto">{visible.map((call) => <RecordRow key={call.id} call={call} selected={call.id === selected} onClick={() => setSelected(call.id)} />)}</div>
      </aside>
      <DetailPane call={selectedCall} />
      <aside className="hidden w-[190px] shrink-0 border-l border-border bg-card xl:block"><div className="border-b border-border px-3.5 py-3"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-muted-foreground">At a glance</p><p className="mt-1 text-xs font-bold">Today, 12 Jun</p></div><div className="space-y-4 p-3.5"><div><div className="flex items-center justify-between text-[10px]"><span className="text-muted-foreground">Reviewed</span><b>84 / 128</b></div><div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full w-[66%] rounded-full bg-primary" /></div></div><div className="grid grid-cols-2 gap-2"><div className="rounded-md bg-background p-2"><Clock3 className="h-3.5 w-3.5 text-sky-600" /><b className="mt-1 block text-sm">42m</b><span className="text-[9px] text-muted-foreground">review time</span></div><div className="rounded-md bg-background p-2"><BarChart3 className="h-3.5 w-3.5 text-emerald-600" /><b className="mt-1 block text-sm">8.2</b><span className="text-[9px] text-muted-foreground">avg score</span></div></div><div className="border-t border-border pt-3"><p className="mb-2 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Review queue</p><div className="space-y-2 text-[10px]"><div className="flex justify-between"><span>Needs attention</span><b className="text-amber-600">7</b></div><div className="flex justify-between"><span>Flagged calls</span><b>8</b></div><div className="flex justify-between"><span>No recording</span><b>3</b></div></div></div><button className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border py-2 text-[10px] font-semibold transition hover:bg-accent"><Download className="h-3 w-3" />Bulk download</button><div className="flex items-center gap-2 rounded-md bg-primary/[.07] p-2 text-[9px] leading-snug text-primary"><LayoutList className="h-4 w-4 shrink-0" />Select a call to review its full context.</div></div></aside>
    </div>
    <div className="flex shrink-0 items-center justify-between border-t border-border bg-card px-5 py-1.5 text-[9px] text-muted-foreground"><span>INDEXUS Connect <span className="px-1">·</span> Data refreshed 2 min ago</span><span>Use ↑ ↓ to move through calls</span></div>
  </main>;
}