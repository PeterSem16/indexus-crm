import { useState } from "react";
import { CircleDot, Phone, CalendarPlus, MailIcon, MessageSquare, CheckCircle2, XCircle, Clock, ArrowRight, Check, ChevronRight } from "lucide-react";

const CATEGORIES = [
  {
    id: "cat-1", name: "Callback / odložené", color: "blue", icon: "Clock",
    statuses: [
      { id: "s1", name: "Zavolať neskôr", color: "blue", icon: "Phone", action: "callback", subCount: 3 },
    ]
  },
  {
    id: "cat-2", name: "Qualified or Unqualified Medical Partner", color: "green", icon: "CheckCircle2",
    statuses: [
      { id: "s2", name: "Qualified Partner", color: "green", icon: "CheckCircle2", action: "complete", subCount: 0 },
      { id: "s3", name: "Unqualified Partner", color: "red", icon: "XCircle", action: "none", subCount: 0 },
    ]
  },
  {
    id: "cat-3", name: "Willingness to provide services", color: "green", icon: "ArrowRight",
    statuses: [
      { id: "s4", name: "Willing — Full", color: "green", icon: "CheckCircle2", action: "none", subCount: 0 },
      { id: "s5", name: "Willing — Partial", color: "teal", icon: "CircleDot", action: "none", subCount: 0 },
      { id: "s6", name: "Not Willing Now", color: "amber", icon: "Clock", action: "callback", subCount: 0 },
      { id: "s7", name: "Definitively Not Willing", color: "red", icon: "XCircle", action: "dnd", subCount: 0 },
    ]
  },
  {
    id: "cat-4", name: "Contract proposal with HCP", color: "red", icon: "MailIcon",
    statuses: [
      { id: "s8", name: "Proposal Sent", color: "blue", icon: "MailIcon", action: "schedule_email", subCount: 0 },
      { id: "s9", name: "Proposal Accepted", color: "green", icon: "CheckCircle2", action: "convert", subCount: 0 },
      { id: "s10", name: "Proposal Rejected", color: "red", icon: "XCircle", action: "none", subCount: 0 },
      { id: "s11", name: "Follow-up Needed", color: "amber", icon: "Clock", action: "callback", subCount: 2 },
      { id: "s12", name: "Under Review", color: "violet", icon: "CircleDot", action: "none", subCount: 0 },
      { id: "s13", name: "Negotiation", color: "indigo", icon: "ArrowRight", action: "callback", subCount: 0 },
      { id: "s14", name: "Signed", color: "green", icon: "CheckCircle2", action: "complete", subCount: 0 },
      { id: "s15", name: "On Hold", color: "gray", icon: "Clock", action: "none", subCount: 0 },
      { id: "s16", name: "Cancelled", color: "red", icon: "XCircle", action: "dnd", subCount: 0 },
    ]
  },
];

const COLOR: Record<string, { catBg: string; catBorder: string; catLeft: string; catIcon: string; catText: string; catBadge: string; tileBg: string; tileHover: string; tileBorder: string; tileIcon: string; tileText: string }> = {
  gray:   { catBg:"bg-slate-50",   catBorder:"border-slate-200",  catLeft:"border-l-slate-400",  catIcon:"text-slate-500",   catText:"text-slate-700",   catBadge:"bg-slate-200 text-slate-700",   tileBg:"bg-slate-50",   tileHover:"hover:bg-slate-100",   tileBorder:"border-slate-200",  tileIcon:"text-slate-500",   tileText:"text-slate-700" },
  blue:   { catBg:"bg-sky-50",     catBorder:"border-sky-200",    catLeft:"border-l-sky-500",    catIcon:"text-sky-600",     catText:"text-sky-800",     catBadge:"bg-sky-200 text-sky-700",       tileBg:"bg-sky-50",     tileHover:"hover:bg-sky-100",     tileBorder:"border-sky-200",    tileIcon:"text-sky-600",     tileText:"text-sky-800" },
  green:  { catBg:"bg-emerald-50", catBorder:"border-emerald-200",catLeft:"border-l-emerald-500",catIcon:"text-emerald-600", catText:"text-emerald-800", catBadge:"bg-emerald-200 text-emerald-700",tileBg:"bg-emerald-50", tileHover:"hover:bg-emerald-100", tileBorder:"border-emerald-200",tileIcon:"text-emerald-600", tileText:"text-emerald-800" },
  teal:   { catBg:"bg-teal-50",    catBorder:"border-teal-200",   catLeft:"border-l-teal-500",   catIcon:"text-teal-600",    catText:"text-teal-800",    catBadge:"bg-teal-200 text-teal-700",     tileBg:"bg-teal-50",    tileHover:"hover:bg-teal-100",    tileBorder:"border-teal-200",   tileIcon:"text-teal-600",    tileText:"text-teal-800" },
  red:    { catBg:"bg-rose-50",    catBorder:"border-rose-200",   catLeft:"border-l-rose-500",   catIcon:"text-rose-600",    catText:"text-rose-800",    catBadge:"bg-rose-200 text-rose-700",     tileBg:"bg-rose-50",    tileHover:"hover:bg-rose-100",    tileBorder:"border-rose-200",   tileIcon:"text-rose-600",    tileText:"text-rose-800" },
  amber:  { catBg:"bg-amber-50",   catBorder:"border-amber-200",  catLeft:"border-l-amber-500",  catIcon:"text-amber-600",   catText:"text-amber-800",   catBadge:"bg-amber-200 text-amber-700",   tileBg:"bg-amber-50",   tileHover:"hover:bg-amber-100",   tileBorder:"border-amber-200",  tileIcon:"text-amber-600",   tileText:"text-amber-800" },
  violet: { catBg:"bg-violet-50",  catBorder:"border-violet-200", catLeft:"border-l-violet-500", catIcon:"text-violet-600",  catText:"text-violet-800",  catBadge:"bg-violet-200 text-violet-700", tileBg:"bg-violet-50",  tileHover:"hover:bg-violet-100",  tileBorder:"border-violet-200", tileIcon:"text-violet-600",  tileText:"text-violet-800" },
  indigo: { catBg:"bg-indigo-50",  catBorder:"border-indigo-200", catLeft:"border-l-indigo-500", catIcon:"text-indigo-600",  catText:"text-indigo-800",  catBadge:"bg-indigo-200 text-indigo-700", tileBg:"bg-indigo-50",  tileHover:"hover:bg-indigo-100",  tileBorder:"border-indigo-200", tileIcon:"text-indigo-600",  tileText:"text-indigo-800" },
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

const ICONS: Record<string, any> = { CircleDot, Phone, CalendarPlus, MailIcon, MessageSquare, CheckCircle2, XCircle, Clock, ArrowRight };

export default function ExpandedCategories() {
  const [selected, setSelected] = useState<string | null>(null);

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

        {/* Expand/collapse controls */}
        <div className="flex items-center gap-1 px-4 pt-2 pb-1 shrink-0">
          <button className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors">Rozbaliť všetky</button>
          <button className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors">Zbaliť všetky</button>
          <div className="ml-auto">
            <button className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors flex items-center gap-1">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              Zobrazenie
            </button>
          </div>
        </div>

        {/* Categories — always expanded, tile grid */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2.5">
          {CATEGORIES.map(cat => {
            const c = COLOR[cat.color] || COLOR.gray;
            const CatIcon = ICONS[cat.icon] || CircleDot;
            return (
              <div key={cat.id} className={`rounded-xl border-2 ${c.catBorder} overflow-hidden shadow-sm`}>
                {/* Category header */}
                <div className={`flex items-center gap-3 px-4 py-2.5 border-l-4 ${c.catLeft} ${c.catBg}`}>
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center bg-white/60 shrink-0`}>
                    <CatIcon className={`h-4 w-4 ${c.catIcon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-bold text-sm ${c.catText}`}>{cat.name}</div>
                    <div className="text-xs text-muted-foreground">{cat.statuses.length} statusov</div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.catBadge} shrink-0`}>{cat.statuses.length}</span>
                </div>
                {/* Tile grid — always visible */}
                <div className="p-2.5 bg-background/80 border-t border-border/50">
                  <div className="grid grid-cols-2 gap-1.5">
                    {cat.statuses.map(s => {
                      const sc = COLOR[s.color] || COLOR.gray;
                      const SIcon = ICONS[s.icon] || CircleDot;
                      const isSelected = selected === s.id;
                      return (
                        <button key={s.id} type="button"
                          onClick={() => setSelected(isSelected ? null : s.id)}
                          className={`relative p-3 rounded-xl border-2 text-left transition-all duration-150 ${sc.tileBg} ${sc.tileBorder} ${sc.tileHover} hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97] ${isSelected ? "ring-2 ring-primary ring-offset-1 shadow-md" : ""}`}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-white/60`}>
                              <SIcon className={`h-4 w-4 ${sc.tileIcon}`} />
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className={`font-semibold text-xs leading-snug ${sc.tileText}`}>{s.name}</div>
                              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                {s.action !== "none" && ACTION_BADGE[s.action] && (
                                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${ACTION_BADGE[s.action]}`}>
                                    {ACTION_LABEL[s.action]}
                                  </span>
                                )}
                                {s.subCount > 0 && (
                                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${sc.catBadge}`}>
                                    {s.subCount}<ChevronRight className="h-2 w-2"/>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
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
