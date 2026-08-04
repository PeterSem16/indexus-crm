import { useState } from "react";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Truck, MapPin,
  Signal, Wifi, Battery, Home, Calendar, User, CheckCircle2,
  Plus, Pencil
} from "lucide-react";

const DAYS = ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"];
const DAY_NAMES = ["Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota", "Nedeľa"];

const ZONES = [
  { code: "SK-BA", label: "Bratislavský kraj", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { code: "SK-TN", label: "Trenčín / Martin", color: "bg-teal-100 text-teal-700 border-teal-200" },
  { code: "SK-KE", label: "Košický kraj",      color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { code: "CZ-BRN", label: "Brno a okolie",   color: "bg-orange-100 text-orange-700 border-orange-200" },
];

// availability[dayIndex] = { available, timeFrom, timeTo, zones[] }
const AVAIL: Record<number, { available: boolean; timeFrom: string; timeTo: string; zones: string[] }> = {
  0: { available: true,  timeFrom: "07:00", timeTo: "18:00", zones: ["SK-BA", "SK-TN"] },
  1: { available: false, timeFrom: "", timeTo: "", zones: [] },
  2: { available: true,  timeFrom: "07:00", timeTo: "20:00", zones: ["SK-BA"] },
  3: { available: true,  timeFrom: "06:00", timeTo: "22:00", zones: ["SK-BA", "CZ-BRN"] },
  4: { available: false, timeFrom: "", timeTo: "", zones: [] },
  5: { available: true,  timeFrom: "08:00", timeTo: "14:00", zones: ["SK-BA"] },
  6: { available: false, timeFrom: "", timeTo: "", zones: [] },
};

const UPCOMING = [
  { id: "CBC-2026-00841", day: "Dnes", time: "09:45", hospital: "NsCM Bratislava",   zone: "SK-BA",  urgent: true },
  { id: "CBC-2026-00839", day: "Dnes", time: "13:20", hospital: "UN Martin",         zone: "SK-TN",  urgent: false },
  { id: "CBC-2026-00851", day: "Zajtra", time: "11:10", hospital: "FNsP Nové Zámky", zone: "SK-BA",  urgent: false },
];

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-4 py-1 bg-black text-white text-xs" style={{ height: 28 }}>
      <span>08:42</span>
      <div className="flex items-center gap-1.5">
        <Signal className="h-3 w-3" />
        <Wifi className="h-3 w-3" />
        <Battery className="h-3 w-3" />
      </div>
    </div>
  );
}

function BottomNav({ active }: { active: string }) {
  const tabs = [
    { id: "dashboard", icon: Home,     label: "Domov" },
    { id: "dispatch",  icon: Truck,    label: "Zvozy" },
    { id: "schedule",  icon: Calendar, label: "Rozvrh" },
    { id: "profile",   icon: User,     label: "Profil" },
  ];
  return (
    <div className="flex items-center justify-around border-t bg-white py-2 shrink-0">
      {tabs.map(t => (
        <button key={t.id} className={`flex flex-col items-center gap-0.5 px-3 py-1 ${active === t.id ? "text-blue-700" : "text-slate-400"}`}>
          <t.icon className="h-5 w-5" />
          <span className="text-[10px]">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

export function DriverSchedule() {
  const [selectedDay, setSelectedDay] = useState(0); // Monday selected

  const avail = AVAIL[selectedDay];

  return (
    <div className="w-[390px] h-[844px] bg-slate-50 flex flex-col overflow-hidden font-sans" style={{ fontFamily: "system-ui, sans-serif" }}>
      <StatusBar />

      {/* Header */}
      <div className="bg-blue-700 text-white px-4 pt-3 pb-4 shrink-0">
        <p className="text-xs opacity-70 mb-0.5">INDEXUS Connect · Vodič</p>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base">Môj rozvrh</h2>
          <button className="bg-white/15 rounded-xl px-3 py-1 text-xs font-medium flex items-center gap-1">
            <Pencil className="h-3 w-3" /> Upraviť
          </button>
        </div>
        <p className="text-xs opacity-60 mt-0.5">Júl 2026 · Týždeň 32</p>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* Week row */}
        <div className="bg-white border-b px-4 py-3 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <button><ChevronLeft className="h-4 w-4 text-slate-400" /></button>
            <span className="text-xs font-semibold text-slate-600">4. – 10. august 2026</span>
            <button><ChevronRight className="h-4 w-4 text-slate-400" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {DAYS.map((d, i) => {
              const a = AVAIL[i];
              const isToday = i === 0;
              const isSelected = i === selectedDay;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDay(i)}
                  className={`flex flex-col items-center py-2 rounded-xl transition-colors
                    ${isSelected ? "bg-blue-700 text-white" : isToday ? "bg-blue-50 text-blue-700" : "text-slate-600"}
                  `}
                >
                  <span className="text-[10px] font-medium opacity-80">{d}</span>
                  <span className="text-sm font-bold mt-0.5">{4 + i}</span>
                  {a.available
                    ? <span className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? "bg-emerald-300" : "bg-emerald-400"}`} />
                    : <span className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? "bg-white/30" : "bg-slate-200"}`} />
                  }
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail */}
        <div className="px-4 mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm text-slate-800">{DAY_NAMES[selectedDay]}, {4 + selectedDay}. 8.</p>
            {avail.available
              ? <span className="text-xs text-emerald-600 font-medium bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Dostupný</span>
              : <span className="text-xs text-slate-400 font-medium bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">Nedostupný</span>
            }
          </div>

          {avail.available ? (
            <>
              {/* Time window */}
              <div className="bg-white rounded-2xl border shadow-sm p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Časové okno</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center border">
                    <p className="text-[10px] text-slate-400 mb-1">OD</p>
                    <p className="text-xl font-bold text-slate-800">{avail.timeFrom}</p>
                  </div>
                  <div className="text-slate-300 text-lg">→</div>
                  <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center border">
                    <p className="text-[10px] text-slate-400 mb-1">DO</p>
                    <p className="text-xl font-bold text-slate-800">{avail.timeTo}</p>
                  </div>
                </div>
              </div>

              {/* Zones */}
              <div className="bg-white rounded-2xl border shadow-sm p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pokrývané zóny</p>
                <div className="space-y-2">
                  {ZONES.filter(z => avail.zones.includes(z.code)).map(z => (
                    <div key={z.code} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${z.color}`}>
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <div>
                        <span className="text-xs font-bold">{z.code}</span>
                        <span className="text-xs opacity-75 ml-1.5">{z.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border shadow-sm p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
                <Calendar className="h-6 w-6 text-slate-300" />
              </div>
              <p className="font-semibold text-slate-500 text-sm">Tento deň nie si dostupný</p>
              <p className="text-xs text-slate-400 mt-1">Ak nastane zmena, uprav dostupnosť</p>
              <button className="mt-3 flex items-center gap-1 mx-auto text-blue-600 text-xs font-medium">
                <Plus className="h-3.5 w-3.5" /> Nastaviť dostupnosť
              </button>
            </div>
          )}

          {/* Upcoming dispatches for this day */}
          {selectedDay === 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pridelené zvozy dnes</p>
              <div className="space-y-2">
                {UPCOMING.filter(u => u.day === "Dnes").map(u => (
                  <div key={u.id} className="bg-white rounded-2xl border shadow-sm px-4 py-3 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${u.urgent ? "bg-red-100" : "bg-blue-100"}`}>
                      <Truck className={`h-4 w-4 ${u.urgent ? "text-red-600" : "text-blue-600"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{u.hospital}</p>
                      <p className="text-xs text-slate-400">{u.time} · {u.zone}</p>
                    </div>
                    {u.urgent && <span className="text-[10px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded">!</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="h-4" />
      </div>

      <BottomNav active="schedule" />
    </div>
  );
}
