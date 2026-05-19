import { useState } from "react";

const SECTIONS = [
  {
    id: "s1", title: "Úvod a predstavenie", icon: "👋",
    items: [
      { id: "i1", label: "Predstavil som sa zákazníkovi", type: "checkbox", checked: true, answer: null, value: null },
      { id: "i2", label: "Overil som správnosť telefónneho čísla", type: "checkbox", checked: true, answer: null, value: null },
      { id: "i3", label: "Zákazník má záujem", type: "yes_no", checked: false, answer: "yes", value: null },
    ],
  },
  {
    id: "s2", title: "Informácie o produkte", icon: "💡",
    items: [
      { id: "i4", label: "Vysvetlil som výhody", type: "checkbox", checked: true, answer: null, value: null },
      { id: "i5", label: "Zákazník rozumie cene", type: "yes_no", checked: false, answer: "no", value: null },
      { id: "i6", label: "Poznámka ku produktu", type: "text", checked: false, answer: null, value: "Zákazník chce zľavu" },
    ],
  },
  {
    id: "s3", title: "Záver", icon: "✅",
    items: [
      { id: "i7", label: "Dohodnutý ďalší krok", type: "checkbox", checked: false, answer: null, value: null },
      { id: "i8", label: "Odoslané potvrdenie", type: "checkbox", checked: false, answer: null, value: null },
    ],
  },
];

function ProgressRing({ pct, color }: { pct: number; color: string }) {
  const r = 20, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 50 50" className="w-12 h-12 -rotate-90">
      <circle cx="25" cy="25" r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
      <circle cx="25" cy="25" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${pct * c} ${c}`} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 3px ${color}66)` }} />
    </svg>
  );
}

export function VariantA() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["s1", "s2"]));
  const toggle = (id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const allItems = SECTIONS.flatMap(s => s.items);
  const checkedCount = allItems.filter(i => i.checked || i.answer === "yes").length;
  const totalCount = allItems.length;
  const pct = totalCount > 0 ? checkedCount / totalCount : 0;

  return (
    <div className="min-h-screen bg-slate-50 p-5 font-sans flex flex-col gap-3">
      <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Variant A — Card Sections</div>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
        <div className="relative shrink-0">
          <ProgressRing pct={pct} color="#6366f1" />
          <div className="absolute inset-0 flex items-center justify-center rotate-90">
            <span className="text-[11px] font-black text-indigo-600">{Math.round(pct * 100)}%</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-800 mb-0.5">SOP Checklist</div>
          <div className="text-xs text-slate-500">{checkedCount} z {totalCount} položiek splnených</div>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct * 100}%` }} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] text-slate-400">Uložené</div>
          <div className="text-xs font-semibold text-slate-600">dnes 10:24</div>
        </div>
      </div>

      {/* Section cards */}
      {SECTIONS.map(sec => {
        const secChecked = sec.items.filter(i => i.checked || i.answer === "yes").length;
        const isOpen = expanded.has(sec.id);
        return (
          <div key={sec.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Section header */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
              onClick={() => toggle(sec.id)}
            >
              <span className="text-base">{sec.icon}</span>
              <span className="flex-1 text-sm font-semibold text-slate-800 text-left">{sec.title}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${secChecked === sec.items.length ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {secChecked}/{sec.items.length}
                </span>
                <span className="text-slate-400 text-sm">{isOpen ? "▲" : "▼"}</span>
              </div>
            </button>

            {/* Items */}
            {isOpen && (
              <div className="border-t border-slate-100 divide-y divide-slate-50">
                {sec.items.map(item => {
                  const isChecked = item.checked || item.answer === "yes";
                  const isNo = item.answer === "no";
                  const hasText = item.type === "text" && item.value;
                  return (
                    <div key={item.id} className={`flex items-start gap-3 px-4 py-2.5 ${isChecked ? "bg-emerald-50/60" : isNo ? "bg-red-50/60" : hasText ? "bg-blue-50/40" : "bg-white"}`}>
                      {/* Status icon */}
                      <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${isChecked ? "bg-emerald-500 text-white" : isNo ? "bg-red-400 text-white" : hasText ? "bg-blue-400 text-white" : "bg-slate-200 text-slate-400"}`}>
                        {isChecked ? "✓" : isNo ? "✗" : hasText ? "T" : "–"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-medium ${isNo ? "line-through text-slate-400" : "text-slate-700"}`}>{item.label}</div>
                        {hasText && <div className="text-[10px] text-blue-600 mt-0.5 italic">"{item.value}"</div>}
                      </div>
                      {/* Type badge */}
                      <div className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                        item.type === "checkbox" ? "bg-slate-100 text-slate-500" :
                        item.type === "yes_no" ? "bg-violet-100 text-violet-600" : "bg-blue-100 text-blue-600"
                      }`}>
                        {item.type === "checkbox" ? "check" : item.type === "yes_no" ? "áno/nie" : "text"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
