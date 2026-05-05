import { Phone, Mail, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

const categories = [
  {
    id: "cat1", name: "Spätné volania", count: 3, accentColor: "#B5622E",
    items: [
      { id: "1", name: "Tes Klinika Novum", date: "22.04. 09:00", campaign: "My CB", count: 1, type: "call" },
      { id: "2", name: "Tes Ambulancia Florián", date: "01.05. 11:00", campaign: "My CB", count: 4, type: "call" },
      { id: "3", name: "Tes Ordinácia Salus — MU", date: "11.05. 09:00", campaign: "My CB", count: 3, type: "call" },
    ]
  },
  {
    id: "cat2", name: "Email follow-up", count: 2, accentColor: "#5E7A5A",
    items: [
      { id: "4", name: "MUDr. Novák Peter", date: "08.05. 10:00", campaign: "Spring", count: 1, type: "email" },
      { id: "5", name: "Poliklinika Centrum", date: "12.05. 14:00", campaign: "Spring", count: 2, type: "email" },
    ]
  },
];

export function VariantB() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["cat1", "cat2"]));
  const toggle = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="min-h-screen flex items-start justify-center p-6" style={{ background: "#EEEBE4" }}>
      <div className="w-full max-w-sm space-y-4">
        <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: "#8A7E6E" }}>
          Varianta B — Stone &amp; Terracotta
        </p>

        {categories.map(cat => {
          const isOpen = expanded.has(cat.id);
          const ac = cat.accentColor;
          return (
            <div
              key={cat.id}
              className="rounded-2xl overflow-hidden"
              style={{
                background: "#F8F4EE",
                border: `1.5px solid ${ac}40`,
                boxShadow: `0 2px 12px ${ac}18`
              }}
            >
              <button
                type="button"
                onClick={() => toggle(cat.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                style={{
                  background: isOpen ? `${ac}14` : `${ac}08`,
                  borderBottom: isOpen ? `1px solid ${ac}30` : "none"
                }}
              >
                <div
                  className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: ac, boxShadow: `0 2px 8px ${ac}40` }}
                >
                  {cat.id === "cat2"
                    ? <Mail className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
                    : <Phone className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm" style={{ color: "#3D2E20" }}>{cat.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: "#9A8878" }}>{cat.count} kontaktov</div>
                </div>
                <span
                  className="text-xs font-bold min-w-[28px] h-7 flex items-center justify-center rounded-full px-2 shrink-0"
                  style={{ background: ac, color: "#fff" }}
                >
                  {cat.count}
                </span>
                {isOpen
                  ? <ChevronUp className="h-4 w-4 shrink-0" style={{ color: ac }} />
                  : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: ac }} />
                }
              </button>

              {isOpen && (
                <div className="p-3 space-y-2" style={{ background: "#F8F4EE" }}>
                  {cat.items.map(item => (
                    <div
                      key={item.id}
                      className="rounded-xl px-3 py-3 cursor-pointer transition-all duration-200"
                      style={{
                        background: "#FFFFFF",
                        border: `1px solid ${ac}25`,
                        boxShadow: "0 1px 4px rgba(0,0,0,0.05)"
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = `${ac}60`;
                        (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 12px ${ac}20`;
                        (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = `${ac}25`;
                        (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)";
                        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: `${ac}15`, border: `1.5px solid ${ac}30` }}
                        >
                          {item.type === "email"
                            ? <Mail className="h-3.5 w-3.5" style={{ color: ac }} />
                            : <Phone className="h-3.5 w-3.5" style={{ color: ac }} />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate" style={{ color: "#2E2118" }}>
                            {item.name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <Calendar className="h-3 w-3 shrink-0" style={{ color: "#9A8878" }} />
                            <span className="text-xs" style={{ color: "#9A8878" }}>{item.date}</span>
                            <span
                              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                              style={{ background: "#EDE8E0", color: "#7A6858" }}
                            >
                              {item.campaign}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className="text-xs font-bold w-7 h-7 flex items-center justify-center rounded-full"
                            style={{ background: `${ac}18`, color: ac }}
                          >
                            {item.count}x
                          </span>
                          <button
                            type="button"
                            className="h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-200"
                            style={{ background: ac, color: "#fff", boxShadow: `0 2px 6px ${ac}40` }}
                            onMouseEnter={e => (e.currentTarget.style.filter = "brightness(1.1)")}
                            onMouseLeave={e => (e.currentTarget.style.filter = "none")}
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </button>
                        </div>
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
