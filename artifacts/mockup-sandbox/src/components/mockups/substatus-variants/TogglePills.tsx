import { useState } from "react";
import { Send, Clock, FileX, FileMinus, CalendarPlus } from "lucide-react";

const items = [
  { id: "not-offered", label: "Návrh neponúknutý", icon: FileMinus, scheduleCall: false },
  { id: "considering", label: "Ponúknutý – zvažuje", icon: Clock, scheduleCall: true },
  { id: "not-sent", label: "Návrh neodoslaný", icon: FileX, scheduleCall: false },
  { id: "sent", label: "Návrh odoslaný", icon: Send, scheduleCall: true },
];

const BRAND = "#C0392B";

export function TogglePills() {
  const [selected, setSelected] = useState<string | null>(null);

  const toggle = (id: string) => setSelected(prev => prev === id ? null : id);

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-start justify-center p-8 pt-10">
      <div className="w-[400px]">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-5 px-1">
          Vyberte sub-status
        </p>

        <div className="flex flex-col gap-2.5">
          {items.map(({ id, label, icon: Icon, scheduleCall }) => {
            const isSelected = selected === id;
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                className="flex items-center gap-3 w-full rounded-full px-5 py-3 border-2 font-medium text-sm transition-all duration-150 focus:outline-none"
                style={{
                  borderColor: isSelected ? BRAND : "#D1D5DB",
                  background: isSelected ? BRAND : "#FFFFFF",
                  color: isSelected ? "#FFFFFF" : "#374151",
                  boxShadow: isSelected ? `0 4px 14px ${BRAND}40` : "0 1px 2px rgba(0,0,0,0.05)",
                  transform: isSelected ? "translateX(4px)" : "translateX(0)",
                }}
              >
                <span
                  className="flex items-center justify-center w-7 h-7 rounded-full shrink-0 transition-all"
                  style={{
                    background: isSelected ? "rgba(255,255,255,0.25)" : "#F3F4F6",
                  }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: isSelected ? "#fff" : "#6B7280" }} />
                </span>
                <span className="flex-1 text-left">{label}</span>
                {scheduleCall && (
                  <span
                    className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      background: isSelected ? "rgba(255,255,255,0.2)" : "#EEF2FF",
                      color: isSelected ? "#fff" : "#6366F1",
                    }}
                  >
                    <CalendarPlus className="w-3 h-3" />
                    Hovor
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-6 px-1">
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
