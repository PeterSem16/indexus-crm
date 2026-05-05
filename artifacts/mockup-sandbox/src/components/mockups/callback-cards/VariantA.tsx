import { Phone, Mail, Calendar, ChevronDown, ChevronUp, FolderOpen } from "lucide-react";
import { useState } from "react";

const categories = [
  {
    id: "cat1", name: "Spätné volania", icon: "phone", count: 3, color: "#C2813A",
    items: [
      { id: "1", name: "Tes Klinika Novum", date: "22.04. 09:00", campaign: "My CB", count: 1, type: "call" },
      { id: "2", name: "Tes Ambulancia Florián", date: "01.05. 11:00", campaign: "My CB", count: 4, type: "call" },
      { id: "3", name: "Tes Ordinácia Salus — MU", date: "11.05. 09:00", campaign: "My CB", count: 3, type: "call" },
    ]
  },
  {
    id: "cat2", name: "Email follow-up", icon: "mail", count: 2, color: "#7A8F6E",
    items: [
      { id: "4", name: "MUDr. Novák Peter", date: "08.05. 10:00", campaign: "Spring", count: 1, type: "email" },
      { id: "5", name: "Poliklinika Centrum", date: "12.05. 14:00", campaign: "Spring", count: 2, type: "email" },
    ]
  },
];

export function VariantA() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["cat1", "cat2"]));
  const toggle = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="min-h-screen flex items-start justify-center p-6" style={{ background: "#F7F0E6" }}>
      <div className="w-full max-w-sm space-y-3">
        <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: "#A0896C" }}>
          Varianta A — Warm Sand
        </p>

        {categories.map(cat => {
          const isOpen = expanded.has(cat.id);
          return (
            <div
              key={cat.id}
              className="rounded-2xl overflow-hidden"
              style={{
                background: "#FDF6EC",
                border: "1.5px solid #EAD9C4",
                boxShadow: "0 2px 8px rgba(180,140,90,0.08)"
              }}
            >
              <button
                type="button"
                onClick={() => toggle(cat.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150"
                style={{ borderLeft: `4px solid ${cat.color}`, background: isOpen ? "#FDF0DC" : "#FDF6EC" }}
              >
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${cat.color}22` }}
                >
                  {cat.type === "email" || cat.icon === "mail"
                    ? <Mail className="h-4 w-4" style={{ color: cat.color }} />
                    : <Phone className="h-4 w-4" style={{ color: cat.color }} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm" style={{ color: "#5C4A35" }}>{cat.name}</div>
                  <div className="text-xs" style={{ color: "#A0896C" }}>{cat.count} kontaktov</div>
                </div>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
                  style={{ background: `${cat.color}22`, color: cat.color }}
                >
                  {cat.count}
                </span>
                {isOpen
                  ? <ChevronUp className="h-4 w-4 shrink-0" style={{ color: cat.color }} />
                  : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: cat.color }} />
                }
              </button>

              {isOpen && (
                <div className="p-3 space-y-2" style={{ borderTop: "1px solid #EAD9C4", background: "#FEFAF5" }}>
                  {cat.items.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-150"
                      style={{
                        background: "#FDF6EC",
                        border: "1px solid #EAD9C4",
                        boxShadow: "0 1px 3px rgba(180,140,90,0.07)"
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = "#FAF0E0";
                        (e.currentTarget as HTMLElement).style.boxShadow = "0 3px 10px rgba(180,140,90,0.14)";
                        (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = "#FDF6EC";
                        (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(180,140,90,0.07)";
                        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                      }}
                    >
                      <div
                        className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${cat.color}18` }}
                      >
                        {item.type === "email"
                          ? <Mail className="h-4 w-4" style={{ color: cat.color }} />
                          : <Phone className="h-4 w-4" style={{ color: cat.color }} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate" style={{ color: "#4A3828" }}>
                          {item.name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Calendar className="h-3 w-3 shrink-0" style={{ color: "#A0896C" }} />
                          <span className="text-xs" style={{ color: "#A0896C" }}>{item.date}</span>
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ background: "#EAD9C4", color: "#8A6E50" }}
                          >
                            {item.campaign}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${cat.color}22`, color: cat.color }}
                        >
                          {item.count}x
                        </span>
                        <button
                          type="button"
                          className="h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-150"
                          style={{ background: `${cat.color}22`, color: cat.color }}
                          onMouseEnter={e => (e.currentTarget.style.background = cat.color) && (e.currentTarget.style.color = "#fff") as any}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${cat.color}22`; (e.currentTarget as HTMLElement).style.color = cat.color; }}
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
