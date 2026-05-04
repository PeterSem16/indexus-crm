import { useState } from "react";
import { CircleDot, Phone, MailIcon, Clock, CheckCircle2, XCircle, ArrowRight, ChevronRight, ChevronLeft, Search, Check } from "lucide-react";

const STATUSES = [
  {
    id: "s1", name: "Zavolať neskôr", color: "blue", icon: "Phone", action: "callback", isFinal: false,
    childrenType: "checklist",
    children: [
      { id: "c1a", name: "Klient chce zavolať ráno (8–10h)" },
      { id: "c1b", name: "Klient chce zavolať popoludní (13–16h)" },
      { id: "c1c", name: "Klient chce zavolať večer (17–19h)" },
    ],
  },
  { id: "s2",  name: "Qualified Partner",        color: "green",  icon: "CheckCircle2", action: "complete",       isFinal: true,  children: [] },
  { id: "s3",  name: "Unqualified Partner",      color: "red",    icon: "XCircle",      action: "none",           isFinal: false, children: [] },
  { id: "s4",  name: "Willing — Full",           color: "green",  icon: "CheckCircle2", action: "none",           isFinal: false, children: [] },
  { id: "s5",  name: "Willing — Partial",        color: "teal",   icon: "CircleDot",    action: "none",           isFinal: false, children: [] },
  { id: "s6",  name: "Not Willing Now",          color: "amber",  icon: "Clock",        action: "callback",       isFinal: false, children: [] },
  { id: "s7",  name: "Definitively Not Willing", color: "red",    icon: "XCircle",      action: "dnd",            isFinal: false, children: [] },
  { id: "s8",  name: "Proposal Sent",            color: "blue",   icon: "MailIcon",     action: "schedule_email", isFinal: false, children: [] },
  { id: "s9",  name: "Proposal Accepted",        color: "green",  icon: "CheckCircle2", action: "convert",        isFinal: true,  children: [] },
  { id: "s10", name: "Proposal Rejected",        color: "red",    icon: "XCircle",      action: "none",           isFinal: false, children: [] },
  {
    id: "s11", name: "Follow-up Needed", color: "amber", icon: "Clock", action: "callback", isFinal: false,
    childrenType: "checklist",
    children: [
      { id: "c11a", name: "Poslať produktový leták" },
      { id: "c11b", name: "Overiť dostupnosť produktu" },
    ],
  },
  { id: "s12", name: "Under Review",  color: "violet", icon: "CircleDot",  action: "none",     isFinal: false, children: [] },
  { id: "s13", name: "Negotiation",   color: "indigo", icon: "ArrowRight", action: "callback", isFinal: false, children: [] },
  { id: "s14", name: "Signed",        color: "green",  icon: "CheckCircle2", action: "complete", isFinal: true, children: [] },
  { id: "s15", name: "On Hold",       color: "gray",   icon: "Clock",      action: "none",     isFinal: false, children: [] },
  { id: "s16", name: "Cancelled",     color: "red",    icon: "XCircle",    action: "dnd",      isFinal: false, children: [] },
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
  gray: "bg-slate-50 hover:bg-slate-100 border-slate-200",
  blue: "bg-sky-50 hover:bg-sky-100 border-sky-200",
  green: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200",
  teal: "bg-teal-50 hover:bg-teal-100 border-teal-200",
  red: "bg-rose-50 hover:bg-rose-100 border-rose-200",
  amber: "bg-amber-50 hover:bg-amber-100 border-amber-200",
  violet: "bg-violet-50 hover:bg-violet-100 border-violet-200",
  indigo: "bg-indigo-50 hover:bg-indigo-100 border-indigo-200",
};
const COLOR_HEADER: Record<string, string> = {
  gray: "bg-slate-100 border-slate-300 text-slate-700",
  blue: "bg-sky-100 border-sky-300 text-sky-800",
  green: "bg-emerald-100 border-emerald-300 text-emerald-800",
  teal: "bg-teal-100 border-teal-300 text-teal-800",
  red: "bg-rose-100 border-rose-300 text-rose-800",
  amber: "bg-amber-100 border-amber-300 text-amber-800",
  violet: "bg-violet-100 border-violet-300 text-violet-800",
  indigo: "bg-indigo-100 border-indigo-300 text-indigo-800",
};
const COLOR_CONFIRM: Record<string, string> = {
  gray: "bg-slate-600 hover:bg-slate-700",
  blue: "bg-sky-600 hover:bg-sky-700",
  green: "bg-emerald-600 hover:bg-emerald-700",
  teal: "bg-teal-600 hover:bg-teal-700",
  red: "bg-rose-600 hover:bg-rose-700",
  amber: "bg-amber-600 hover:bg-amber-700",
  violet: "bg-violet-600 hover:bg-violet-700",
  indigo: "bg-indigo-600 hover:bg-indigo-700",
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

type Status = typeof STATUSES[number];

export default function FlatList() {
  const [search, setSearch] = useState("");
  const [checklistParent, setChecklistParent] = useState<Status | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [confirmed, setConfirmed] = useState<{ parent: Status; selected: string[] } | null>(null);

  const filtered = STATUSES.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  function handleStatusClick(s: Status) {
    if (s.children && s.children.length > 0 && (s as any).childrenType === "checklist") {
      setChecklistParent(s);
      setChecked({});
      setConfirmed(null);
    }
  }

  function toggleCheck(id: string) {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function handleConfirm() {
    if (!checklistParent) return;
    const selected = checklistParent.children
      .filter(c => checked[c.id])
      .map(c => c.name);
    setConfirmed({ parent: checklistParent, selected });
    setChecklistParent(null);
    setChecked({});
  }

  function handleBack() {
    setChecklistParent(null);
    setChecked({});
  }

  const checkedCount = Object.values(checked).filter(Boolean).length;

  // ── STEP 2: checklist panel ──────────────────────────────────────────────
  if (checklistParent) {
    const SIcon = ICONS[checklistParent.icon] || CircleDot;
    const headerCls = COLOR_HEADER[checklistParent.color] || COLOR_HEADER.gray;
    const confirmCls = COLOR_CONFIRM[checklistParent.color] || COLOR_CONFIRM.gray;
    const leftCls = COLOR_LEFT[checklistParent.color] || COLOR_LEFT.gray;

    return (
      <div className="min-h-screen bg-background p-4 flex flex-col">
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: "calc(100vh - 32px)" }}>

          {/* Step header */}
          <div className="px-5 py-3 border-b bg-muted/30 shrink-0 flex items-center gap-2">
            <button onClick={handleBack} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors shrink-0">
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Krok 2 z 2 — Upresnenie</p>
              <p className="font-semibold text-sm truncate">Zaznačte dôvody</p>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {checkedCount}/{checklistParent.children.length}
            </span>
          </div>

          {/* Selected status pill */}
          <div className={`mx-4 mt-3 mb-2 px-4 py-2.5 rounded-xl border-2 border-l-4 ${leftCls} flex items-center gap-3 shrink-0 ${headerCls}`}>
            <SIcon className={`h-5 w-5 shrink-0 ${COLOR_ICON[checklistParent.color]}`} />
            <div>
              <p className="font-bold text-sm">{checklistParent.name}</p>
              <p className="text-xs opacity-70">Vyberte detaily nižšie</p>
            </div>
          </div>

          {/* Checklist items */}
          <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-1.5">
            {checklistParent.children.map(child => {
              const isChecked = !!checked[child.id];
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => toggleCheck(child.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150 ${
                    isChecked
                      ? "bg-primary/5 border-primary/40 shadow-sm"
                      : "bg-background border-border hover:bg-muted/50"
                  }`}
                >
                  {/* Checkbox */}
                  <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                    isChecked ? "bg-primary border-primary" : "border-muted-foreground/40 bg-background"
                  }`}>
                    {isChecked && <Check className="h-3 w-3 text-primary-foreground stroke-[3]" />}
                  </div>
                  <span className={`text-sm flex-1 ${isChecked ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                    {child.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Confirm button */}
          <div className="px-4 pb-4 pt-2 shrink-0 space-y-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={checkedCount === 0}
              className={`w-full h-10 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${confirmCls}`}
            >
              {checkedCount === 0
                ? "Zaznačte aspoň jednu možnosť"
                : `Potvrdiť (${checkedCount} zaznačených)`}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full h-8 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Preskočiť bez upresnenia
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP 1: flat list ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background p-4 flex flex-col">
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: "calc(100vh - 32px)" }}>

        {/* Header */}
        <div className="px-5 py-3.5 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
            <span className="font-semibold text-sm">Call result</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Peter Seman · +421948519438</p>
          <p className="text-xs text-red-500 font-medium">Select result before continuing</p>
        </div>

        {/* Search */}
        <div className="px-4 pt-2.5 pb-1 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Hľadať status..."
              className="w-full h-8 pl-8 pr-3 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Confirmed badge */}
        {confirmed && (
          <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2 shrink-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            <div className="text-xs text-emerald-800">
              <span className="font-semibold">{confirmed.parent.name}</span>
              {confirmed.selected.length > 0 && (
                <span className="text-emerald-700"> — {confirmed.selected.join(", ")}</span>
              )}
            </div>
          </div>
        )}

        {/* Flat list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2 space-y-1">
          {filtered.map(s => {
            const SIcon = ICONS[s.icon] || CircleDot;
            const leftCls = COLOR_LEFT[s.color] || COLOR_LEFT.gray;
            const bgCls = COLOR_BG[s.color] || COLOR_BG.gray;
            const iconCls = COLOR_ICON[s.color] || COLOR_ICON.gray;
            const hasChecklist = s.children && s.children.length > 0 && (s as any).childrenType === "checklist";

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleStatusClick(s)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-l-4 text-left transition-all ${leftCls} ${bgCls} hover:shadow-sm`}
              >
                <SIcon className={`h-4 w-4 shrink-0 ${iconCls}`} />
                <span className="flex-1 text-sm font-medium">{s.name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {s.action !== "none" && ACTION_BADGE[s.action] && (
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${ACTION_BADGE[s.action]}`}>
                      {ACTION_LABEL[s.action]}
                    </span>
                  )}
                  {s.isFinal && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">FINAL</span>
                  )}
                  {hasChecklist && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-0.5">
                      {s.children!.length} <ChevronRight className="h-2 w-2" />
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
          <textarea
            rows={2}
            placeholder="Doplňte krátku poznámku..."
            className="w-full text-sm border rounded-lg px-3 py-1.5 bg-background resize-none text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
    </div>
  );
}
