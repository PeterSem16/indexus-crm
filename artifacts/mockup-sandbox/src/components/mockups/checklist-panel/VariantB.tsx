import { useState } from "react";

const ITEMS_FLAT = [
  { id: "i1", section: "Úvod", icon: "👋", label: "Predstavil som sa zákazníkovi", type: "checkbox", checked: true, answer: null, value: null },
  { id: "i2", section: "Úvod", icon: "👋", label: "Overil som správnosť tel. čísla", type: "checkbox", checked: true, answer: null, value: null },
  { id: "i3", section: "Úvod", icon: "👋", label: "Zákazník má záujem", type: "yes_no", checked: false, answer: "yes", value: null },
  { id: "i4", section: "Produkt", icon: "💡", label: "Vysvetlil som výhody", type: "checkbox", checked: true, answer: null, value: null },
  { id: "i5", section: "Produkt", icon: "💡", label: "Zákazník rozumie cene", type: "yes_no", checked: false, answer: "no", value: null },
  { id: "i6", section: "Produkt", icon: "💡", label: "Poznámka ku produktu", type: "text", checked: false, answer: null, value: "Zákazník chce zľavu" },
  { id: "i7", section: "Záver", icon: "✅", label: "Dohodnutý ďalší krok", type: "checkbox", checked: false, answer: null, value: null },
  { id: "i8", section: "Záver", icon: "✅", label: "Odoslané potvrdenie", type: "checkbox", checked: false, answer: null, value: null },
];

const SECTION_COLORS: Record<string, { bg: string; dot: string; text: string }> = {
  "Úvod":    { bg: "bg-indigo-100", dot: "bg-indigo-500", text: "text-indigo-700" },
  "Produkt": { bg: "bg-violet-100", dot: "bg-violet-500", text: "text-violet-700" },
  "Záver":   { bg: "bg-emerald-100", dot: "bg-emerald-500", text: "text-emerald-700" },
};

function StatusChip({ item }: { item: typeof ITEMS_FLAT[0] }) {
  const isChecked = item.checked || item.answer === "yes";
  const isNo = item.answer === "no";
  const hasText = item.type === "text" && item.value;
  if (isChecked) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-sm">
      ✓ Splnené
    </span>
  );
  if (isNo) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">
      ✗ Nie
    </span>
  );
  if (hasText) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 border border-blue-200">
      💬 Poznámka
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">
      — Nevyplnené
    </span>
  );
}

export function VariantB() {
  const [filter, setFilter] = useState<"all" | "done" | "todo">("all");

  const checkedCount = ITEMS_FLAT.filter(i => i.checked || i.answer === "yes").length;
  const total = ITEMS_FLAT.length;

  const filtered = ITEMS_FLAT.filter(i => {
    const done = i.checked || i.answer === "yes" || (i.type === "text" && i.value);
    if (filter === "done") return done;
    if (filter === "todo") return !done;
    return true;
  });

  const sections = [...new Set(ITEMS_FLAT.map(i => i.section))];
  const sectionStats = sections.map(s => ({
    name: s, icon: ITEMS_FLAT.find(i => i.section === s)?.icon || "",
    done: ITEMS_FLAT.filter(i => i.section === s && (i.checked || i.answer === "yes")).length,
    total: ITEMS_FLAT.filter(i => i.section === s).length,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-5 font-sans flex flex-col gap-3">
      <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Variant B — Compact Timeline</div>

      {/* Stats header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-bold text-slate-800">SOP Checklist</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Uložené dnes o 10:24 · Agent: Jana K.</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black" style={{ color: `hsl(${Math.round(pct * 120)}, 60%, 45%)` }}>
              {Math.round((checkedCount / total) * 100)}%
            </div>
            <div className="text-[10px] text-slate-400">{checkedCount}/{total} ok</div>
          </div>
        </div>

        {/* Section pills */}
        <div className="flex flex-wrap gap-1.5">
          {sectionStats.map(s => {
            const col = SECTION_COLORS[s.name] || SECTION_COLORS["Úvod"];
            return (
              <div key={s.name} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${col.bg} ${col.text}`}>
                <span>{s.icon}</span>
                <span>{s.name}</span>
                <span className="opacity-70">{s.done}/{s.total}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
        {(["all", "done", "todo"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter === f ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
          >
            {f === "all" ? `Všetky (${total})` : f === "done" ? `✓ Splnené (${checkedCount})` : `○ Čakajú (${total - checkedCount})`}
          </button>
        ))}
      </div>

      {/* Items list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.map((item, idx) => {
          const col = SECTION_COLORS[item.section] || SECTION_COLORS["Úvod"];
          const isChecked = item.checked || item.answer === "yes";
          const isNo = item.answer === "no";
          return (
            <div key={item.id} className={`flex items-start gap-3 px-4 py-3 ${idx > 0 ? "border-t border-slate-50" : ""} ${isChecked ? "bg-emerald-50/40" : ""}`}>
              {/* Left color dot */}
              <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-xs font-medium leading-relaxed ${isNo ? "line-through text-slate-400" : "text-slate-700"}`}>
                    {item.label}
                  </span>
                  <StatusChip item={item} />
                </div>
                {item.type === "text" && item.value && (
                  <div className="mt-1 text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg inline-block italic">
                    „{item.value}"
                  </div>
                )}
                <div className={`text-[9px] mt-0.5 font-medium ${col.text}`}>{item.icon} {item.section}</div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-slate-400">Žiadne položky</div>
        )}
      </div>
    </div>
  );
}

const pct = ITEMS_FLAT.filter(i => i.checked || i.answer === "yes").length / ITEMS_FLAT.length;
