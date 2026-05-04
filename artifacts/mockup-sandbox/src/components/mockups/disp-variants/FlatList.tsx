import { useState } from "react";
import { CircleDot, Phone, MailIcon, Clock, CheckCircle2, XCircle, ArrowRight, ChevronRight, Search } from "lucide-react";

const STATUSES = [
  { id: "s1",  name: "Zavolať neskôr",          color: "blue",   icon: "Phone",        action: "callback",       subCount: 3, isFinal: false },
  { id: "s2",  name: "Qualified Partner",        color: "green",  icon: "CheckCircle2", action: "complete",       subCount: 0, isFinal: true  },
  { id: "s3",  name: "Unqualified Partner",      color: "red",    icon: "XCircle",      action: "none",           subCount: 0, isFinal: false },
  { id: "s4",  name: "Willing — Full",           color: "green",  icon: "CheckCircle2", action: "none",           subCount: 0, isFinal: false },
  { id: "s5",  name: "Willing — Partial",        color: "teal",   icon: "CircleDot",    action: "none",           subCount: 0, isFinal: false },
  { id: "s6",  name: "Not Willing Now",          color: "amber",  icon: "Clock",        action: "callback",       subCount: 0, isFinal: false },
  { id: "s7",  name: "Definitively Not Willing", color: "red",    icon: "XCircle",      action: "dnd",            subCount: 0, isFinal: false },
  { id: "s8",  name: "Proposal Sent",            color: "blue",   icon: "MailIcon",     action: "schedule_email", subCount: 0, isFinal: false },
  { id: "s9",  name: "Proposal Accepted",        color: "green",  icon: "CheckCircle2", action: "convert",        subCount: 0, isFinal: true  },
  { id: "s10", name: "Proposal Rejected",        color: "red",    icon: "XCircle",      action: "none",           subCount: 0, isFinal: false },
  { id: "s11", name: "Follow-up Needed",         color: "amber",  icon: "Clock",        action: "callback",       subCount: 2, isFinal: false },
  { id: "s12", name: "Under Review",             color: "violet", icon: "CircleDot",    action: "none",           subCount: 0, isFinal: false },
  { id: "s13", name: "Negotiation",              color: "indigo", icon: "ArrowRight",   action: "callback",       subCount: 0, isFinal: false },
  { id: "s14", name: "Signed",                   color: "green",  icon: "CheckCircle2", action: "complete",       subCount: 0, isFinal: true  },
  { id: "s15", name: "On Hold",                  color: "gray",   icon: "Clock",        action: "none",           subCount: 0, isFinal: false },
  { id: "s16", name: "Cancelled",               color: "red",    icon: "XCircle",      action: "dnd",            subCount: 0, isFinal: false },
];

const COLOR_LEFT: Record<string, string> = {
  gray: "border-l-slate-400", blue: "border-l-sky-500", green: "border-l-emerald-500",
  teal: "border-l-teal-500", red: "border-l-rose-500", amber: "border-l-amber-500",
  violet: "border-l-violet-500", indigo: "border-l-indigo-500",
};
const COLOR_ICON: Record<string, string> = {
  gray: "text-slate-500", blue: "text-sky-600", green: "text-emerald-600",
  teal: "text-teal-600", red: "text-rose-600", amber: "text-amber-600",
  violet: "text-violet-600", indigo: "text-indigo-600",
};
const COLOR_BG: Record<string, string> = {
  gray: "bg-slate-50 hover:bg-slate-100", blue: "bg-sky-50 hover:bg-sky-100",
  green: "bg-emerald-50 hover:bg-emerald-100", teal: "bg-teal-50 hover:bg-teal-100",
  red: "bg-rose-50 hover:bg-rose-100", amber: "bg-amber-50 hover:bg-amber-100",
  violet: "bg-violet-50 hover:bg-violet-100", indigo: "bg-indigo-50 hover:bg-indigo-100",
};

const ACTION_BADGE: Record<string, string> = {
  callback: "bg-blue-100 text-blue-700",
  schedule_email: "bg-cyan-100 text-cyan-700",
  complete: "bg-emerald-100 text-emerald-700",
  convert: "bg-green-100 text-green-700",
  dnd: "bg-red-100 text-red-700",
};
const ACTION_LABEL: Record<string, string> = {
  callback: "Callback", schedule_email: "Email", complete: "Uzatvoriť",
  convert: "Konverzia", dnd: "DND",
};

const ICONS: Record<string, any> = { CircleDot, Phone, MailIcon, Clock, CheckCircle2, XCircle, ArrowRight };

export default function FlatList() {
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const filtered = STATUSES.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col gap-0">
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden flex flex-col" style={{maxHeight:"calc(100vh - 32px)"}}>
        {/* Header */}
        <div className="px-5 py-3.5 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-white"/>
            </div>
            <span className="font-semibold text-sm">Call result</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Peter Seman · +421948519438</p>
          <p className="text-xs text-red-500 font-medium">Select result before continuing</p>
        </div>

        {/* Search */}
        <div className="px-4 pt-2.5 pb-1 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"/>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Hľadať status..."
              className="w-full h-8 pl-8 pr-3 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Flat list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2 space-y-1">
          {filtered.map(s => {
            const SIcon = ICONS[s.icon] || CircleDot;
            const isSelected = selected === s.id;
            const leftCls = COLOR_LEFT[s.color] || COLOR_LEFT.gray;
            const iconCls = COLOR_ICON[s.color] || COLOR_ICON.gray;
            const bgCls = COLOR_BG[s.color] || COLOR_BG.gray;
            return (
              <button key={s.id} type="button"
                onClick={() => setSelected(isSelected ? null : s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border-l-4 border border-transparent text-left transition-all ${leftCls} ${bgCls} ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}`}
              >
                <SIcon className={`h-4 w-4 shrink-0 ${iconCls}`} />
                <span className="flex-1 text-sm font-medium">{s.name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {s.action !== "none" && ACTION_BADGE[s.action] && (
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${ACTION_BADGE[s.action]}`}>
                      {ACTION_LABEL[s.action]}
                    </span>
                  )}
                  {s.isFinal && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">FINAL</span>}
                  {s.subCount > 0 && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-0.5">
                      {s.subCount}<ChevronRight className="h-2 w-2"/>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Žiadny výsledok</p>
          )}
        </div>

        {/* Note */}
        <div className="px-5 py-3 border-t shrink-0">
          <label className="text-xs text-muted-foreground block mb-1">Poznámka k hovoru (voliteľné)</label>
          <textarea rows={2} placeholder="Doplňte krátku poznámku..." className="w-full text-sm border rounded-lg px-3 py-1.5 bg-background resize-none text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"/>
        </div>
      </div>
    </div>
  );
}
