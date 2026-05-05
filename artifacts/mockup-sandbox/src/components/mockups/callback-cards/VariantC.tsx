import { Phone, Mail, Calendar, ChevronDown, ChevronUp, Circle } from "lucide-react";
import { useState } from "react";

const categories = [
  {
    id: "cat1", name: "Spätné volania", count: 3, accent: "#7C9B78", dot: "#A8C4A4",
    items: [
      { id: "1", name: "Tes Klinika Novum", date: "22.04. 09:00", campaign: "My CB", count: 1, type: "call" },
      { id: "2", name: "Tes Ambulancia Florián", date: "01.05. 11:00", campaign: "My CB", count: 4, type: "call" },
      { id: "3", name: "Tes Ordinácia Salus — MU", date: "11.05. 09:00", campaign: "My CB", count: 3, type: "call" },
    ]
  },
  {
    id: "cat2", name: "Email follow-up", count: 2, accent: "#9B7C5A", dot: "#C4A880",
    items: [
      { id: "4", name: "MUDr. Novák Peter", date: "08.05. 10:00", campaign: "Spring", count: 1, type: "email" },
      { id: "5", name: "Poliklinika Centrum", date: "12.05. 14:00", campaign: "Spring", count: 2, type: "email" },
    ]
  },
];

export function VariantC() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["cat1", "cat2"]));
  const toggle = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="min-h-screen flex items-start justify-center p-6" style={{ background: "#F4F1EA" }}>
      <div className="w-full max-w-sm space-y-3">
        <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: "#998E7E" }}>
          Varianta C — Parchment &amp; Sage
        </p>

        {categories.map(cat => {
          const isOpen = expanded.has(cat.id);
          return (
            <div
              key={cat.id}
              className="rounded-2xl overflow-hidden"
              style={{
                background: "#FDFBF7",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)"
              }}
            >
              <button
                type="button"
                onClick={() => toggle(cat.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                style={{ background: isOpen ? "#F9F5EE" : "#FDFBF7" }}
              >
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${cat.accent}20` }}
                >
                  {cat.id === "cat2"
                    ? <Mail className="h-4 w-4" style={{ color: cat.accent }} />
                    : <Phone className="h-4 w-4" style={{ color: cat.accent }} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm" style={{ color: "#3A3028" }}>{cat.name}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {Array.from({ length: cat.count }).map((_, i) => (
                      <div
                        key={i}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: cat.dot }}
                      />
                    ))}
                  </div>
                </div>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                  style={{ background: `${cat.accent}18`, color: cat.accent }}
                >
                  {cat.count}
                </span>
                {isOpen
                  ? <ChevronUp className="h-4 w-4 shrink-0" style={{ color: "#C4B8A8" }} />
                  : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "#C4B8A8" }} />
                }
              </button>

              {isOpen && (
                <div
                  className="px-3 pb-3 space-y-2"
                  style={{ borderTop: "1px solid #EDE8DF" }}
                >
                  <div className="h-2" />
                  {cat.items.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-200"
                      style={{
                        background: "#F8F5EF",
                        border: "1px solid #EDE8DF"
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = "#F2EDE3";
                        (e.currentTarget as HTMLElement).style.borderColor = `${cat.accent}50`;
                        (e.currentTarget as HTMLElement).style.transform = "translateX(2px)";
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = "#F8F5EF";
                        (e.currentTarget as HTMLElement).style.borderColor = "#EDE8DF";
                        (e.currentTarget as HTMLElement).style.transform = "translateX(0)";
                      }}
                    >
                      <div
                        className="h-2 w-2 rounded-full shrink-0 self-center"
                        style={{ background: cat.dot, flexShrink: 0 }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate" style={{ color: "#2C2318" }}>
                          {item.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Calendar className="h-3 w-3 shrink-0" style={{ color: "#B0A090" }} />
                          <span className="text-xs" style={{ color: "#A09080" }}>{item.date}</span>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                            style={{ background: "#E8E2D8", color: "#847060" }}
                          >
                            {item.campaign}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-medium" style={{ color: "#B0A090" }}>
                          {item.count}×
                        </span>
                        <button
                          type="button"
                          className="h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-200"
                          style={{
                            background: `${cat.accent}20`,
                            color: cat.accent,
                            border: `1px solid ${cat.accent}30`
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.background = cat.accent;
                            (e.currentTarget as HTMLElement).style.color = "#fff";
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.background = `${cat.accent}20`;
                            (e.currentTarget as HTMLElement).style.color = cat.accent;
                          }}
                        >
                          {item.type === "email"
                            ? <Mail className="h-3 w-3" />
                            : <Phone className="h-3 w-3" />
                          }
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
