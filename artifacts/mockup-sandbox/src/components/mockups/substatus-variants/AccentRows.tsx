import { useState } from "react";
import { Send, Clock, FileX, FileMinus, CalendarPlus, CheckCircle2, Circle } from "lucide-react";

const items = [
  { id: "not-offered", label: "Návrh zmluvy neponúknutý", desc: "Zákazník nebol oslovený s ponukou", icon: FileMinus, accent: "#6B7280", scheduleCall: false },
  { id: "considering", label: "Ponúknutý – zvažuje", desc: "Zákazník premýšľa, čaká na rozhodnutie", icon: Clock, accent: "#F59E0B", scheduleCall: true },
  { id: "not-sent", label: "Návrh zmluvy neodoslaný", desc: "Zmluva pripravená, ale neodoslaná", icon: FileX, accent: "#EF4444", scheduleCall: false },
  { id: "sent", label: "Návrh zmluvy odoslaný", desc: "Zmluva odoslaná, čaká sa na podpis", icon: Send, accent: "#10B981", scheduleCall: true },
];

export function AccentRows() {
  const [selected, setSelected] = useState<string | null>(null);

  const toggle = (id: string) => setSelected(prev => prev === id ? null : id);

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-start justify-center p-8 pt-10">
      <div className="w-[400px]">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-4 px-1">
          Vyberte sub-status
        </p>

        <div className="flex flex-col gap-2">
          {items.map(({ id, label, desc, icon: Icon, accent, scheduleCall }) => {
            const isSelected = selected === id;
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                className="relative flex items-center gap-4 w-full text-left rounded-xl overflow-hidden transition-all duration-150 focus:outline-none group"
                style={{
                  background: isSelected ? `${accent}0F` : "#FFFFFF",
                  border: `1.5px solid ${isSelected ? accent : "#E5E7EB"}`,
                  boxShadow: isSelected ? `0 2px 8px ${accent}25` : "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                {/* Left accent bar */}
                <div
                  className="w-1 self-stretch shrink-0 rounded-l-xl transition-all"
                  style={{ background: isSelected ? accent : "transparent", minWidth: "4px" }}
                />

                {/* Icon */}
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 my-3 transition-all"
                  style={{
                    background: isSelected ? `${accent}20` : "#F3F4F6",
                  }}
                >
                  <Icon className="w-4.5 h-4.5" style={{ color: isSelected ? accent : "#9CA3AF" }} />
                </div>

                {/* Text */}
                <div className="flex-1 py-3 pr-3">
                  <p
                    className="text-[13px] font-semibold leading-tight"
                    style={{ color: isSelected ? accent : "#1F2937" }}
                  >
                    {label}
                  </p>
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-tight">{desc}</p>
                  {scheduleCall && (
                    <span
                      className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: isSelected ? `${accent}20` : "#EEF2FF",
                        color: isSelected ? accent : "#6366F1",
                      }}
                    >
                      <CalendarPlus className="w-2.5 h-2.5" />
                      Naplánovať hovor
                    </span>
                  )}
                </div>

                {/* Check indicator */}
                <div className="pr-4 shrink-0">
                  {isSelected ? (
                    <CheckCircle2 className="w-5 h-5" style={{ color: accent }} />
                  ) : (
                    <Circle className="w-5 h-5 text-[#D1D5DB] group-hover:text-[#9CA3AF] transition-colors" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 px-1">
          {selected ? (
            <p className="text-[11px] text-[#6B7280]">
              Vybraté:{" "}
              <span className="font-semibold text-[#111827]">
                {items.find(i => i.id === selected)?.label}
              </span>
            </p>
          ) : (
            <p className="text-[11px] text-[#9CA3AF] italic">
              Výber je voliteľný — ak nič nezvolíte, použije sa automatizácia nadriadeného statusu.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
