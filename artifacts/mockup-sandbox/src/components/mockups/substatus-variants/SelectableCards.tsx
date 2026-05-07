import { useState } from "react";
import { Check, Send, Clock, FileX, FileMinus } from "lucide-react";

const items = [
  { id: "not-offered", label: "Návrh zmluvy neponúknutý", icon: FileMinus, color: "#6B7280", scheduleCall: false },
  { id: "considering", label: "Návrh ponúknutý – zvažuje", icon: Clock, color: "#F59E0B", scheduleCall: true },
  { id: "not-sent", label: "Návrh zmluvy neodoslaný", icon: FileX, color: "#EF4444", scheduleCall: false },
  { id: "sent", label: "Návrh zmluvy odoslaný", icon: Send, color: "#10B981", scheduleCall: true },
];

export function SelectableCards() {
  const [selected, setSelected] = useState<string | null>(null);

  const toggle = (id: string) => setSelected(prev => prev === id ? null : id);

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-start justify-center p-8 pt-10">
      <div className="w-[400px]">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-4 px-1">
          Vyberte sub-status
        </p>
        <div className="grid grid-cols-2 gap-3">
          {items.map(({ id, label, icon: Icon, color, scheduleCall }) => {
            const isSelected = selected === id;
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                className="relative text-left rounded-xl border-2 p-4 transition-all duration-150 focus:outline-none"
                style={{
                  borderColor: isSelected ? color : "#E5E7EB",
                  background: isSelected ? `${color}12` : "#FFFFFF",
                  boxShadow: isSelected ? `0 0 0 3px ${color}22` : "0 1px 3px rgba(0,0,0,0.06)",
                  transform: isSelected ? "scale(1.02)" : "scale(1)",
                }}
              >
                {isSelected && (
                  <span
                    className="absolute top-2.5 right-2.5 flex items-center justify-center w-5 h-5 rounded-full"
                    style={{ background: color }}
                  >
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </span>
                )}
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-lg mb-3"
                  style={{ background: isSelected ? `${color}22` : "#F3F4F6" }}
                >
                  <Icon className="w-5 h-5" style={{ color: isSelected ? color : "#9CA3AF" }} />
                </div>
                <p
                  className="text-[12px] font-semibold leading-tight"
                  style={{ color: isSelected ? color : "#374151" }}
                >
                  {label}
                </p>
                {scheduleCall && (
                  <span className="inline-block mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#6366F1]">
                    Naplánovať hovor
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {selected && (
          <div className="mt-4 px-1 text-[11px] text-[#6B7280]">
            Vybraté: <span className="font-semibold text-[#111827]">{items.find(i => i.id === selected)?.label}</span>
          </div>
        )}
        {!selected && (
          <p className="mt-4 px-1 text-[11px] text-[#9CA3AF] italic">
            Výber je voliteľný — ak nič nezvolíte, použije sa automatizácia nadriadeného statusu.
          </p>
        )}
      </div>
    </div>
  );
}
