import { useState } from "react";
import {
  Truck, MapPin, Clock, ChevronRight, Bell, CheckCircle2,
  AlertCircle, Package, Home, Calendar, User, Signal, Wifi, Battery,
  Navigation, AlertTriangle
} from "lucide-react";

const STATUS = {
  assigned:    { label: "Priradený",    dot: "bg-amber-400",  text: "text-amber-700",  bg: "bg-amber-50 border-amber-200" },
  acknowledged:{ label: "Akceptovaný", dot: "bg-blue-400",   text: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  collected:   { label: "Prevzatý",    dot: "bg-violet-400", text: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
  delivered:   { label: "Doručený",    dot: "bg-emerald-400",text: "text-emerald-700",bg: "bg-emerald-50 border-emerald-200" },
};

const DISPATCHES = [
  {
    id: "CBC-2026-00841",
    hospital: "Nemocnica sv. Cyrila a Metoda",
    city: "Bratislava",
    zone: "SK-BA",
    zoneColor: "bg-blue-100 text-blue-700",
    scheduledTime: "09:45",
    status: "assigned" as const,
    urgent: true,
    contact: "Dr. Novák (+421 903 111 222)",
  },
  {
    id: "CBC-2026-00839",
    hospital: "Univerzitná nemocnica Martin",
    city: "Martin",
    zone: "SK-TN",
    zoneColor: "bg-teal-100 text-teal-700",
    scheduledTime: "13:20",
    status: "acknowledged" as const,
    urgent: false,
    contact: "Dr. Kováčová (+421 902 333 444)",
  },
  {
    id: "CBC-2026-00837",
    hospital: "FN Brno — Porodnica",
    city: "Brno",
    zone: "CZ-BRN",
    zoneColor: "bg-orange-100 text-orange-700",
    scheduledTime: "16:50",
    status: "collected" as const,
    urgent: false,
    contact: "Dr. Procházka (+420 541 111 333)",
  },
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
    { id: "dashboard", icon: Home, label: "Domov" },
    { id: "dispatch",  icon: Truck, label: "Zvozy" },
    { id: "schedule",  icon: Calendar, label: "Rozvrh" },
    { id: "profile",   icon: User, label: "Profil" },
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

export function DispatchList() {
  const [filter, setFilter] = useState<"all"|"today">("today");

  const todayTotal  = DISPATCHES.length;
  const done        = DISPATCHES.filter(d => d.status === "delivered").length;
  const urgent      = DISPATCHES.filter(d => d.urgent).length;

  return (
    <div className="w-[390px] h-[844px] bg-slate-50 flex flex-col overflow-hidden font-sans" style={{ fontFamily: "system-ui, sans-serif" }}>
      <StatusBar />

      {/* Header */}
      <div className="bg-blue-700 text-white px-4 pt-3 pb-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs opacity-75">INDEXUS Connect · Vodič</p>
            <h1 className="text-lg font-bold leading-tight">Ján Horváth</h1>
          </div>
          <div className="relative">
            <Bell className="h-6 w-6 opacity-90" />
            {urgent > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-bold">
                {urgent}
              </span>
            )}
          </div>
        </div>
        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Dnes", value: todayTotal, icon: Truck },
            { label: "Hotovo", value: done, icon: CheckCircle2 },
            { label: "Urgentné", value: urgent, icon: AlertTriangle },
          ].map(s => (
            <div key={s.label} className="bg-white/15 rounded-xl py-2 px-3 flex flex-col items-center">
              <s.icon className="h-4 w-4 mb-0.5 opacity-80" />
              <span className="text-xl font-bold leading-none">{s.value}</span>
              <span className="text-[10px] opacity-75 mt-0.5">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 px-4 py-3 shrink-0">
        {(["today","all"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filter === f ? "bg-blue-700 text-white border-blue-700" : "bg-white text-slate-600 border-slate-200"}`}>
            {f === "today" ? "Dnes" : "Všetky"}
          </button>
        ))}
      </div>

      {/* Dispatch list */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4">
        {DISPATCHES.map(d => {
          const st = STATUS[d.status];
          return (
            <div key={d.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${d.urgent ? "ring-1 ring-red-400" : ""}`}>
              {d.urgent && (
                <div className="bg-red-500 text-white text-[10px] font-semibold px-3 py-0.5 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> URGENTNÉ
                </div>
              )}
              <div className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-tight truncate">{d.hospital}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                      <span className="text-xs text-slate-500">{d.city}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${d.zoneColor}`}>{d.zone}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300 shrink-0 mt-0.5" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="h-3 w-3" />
                    <span>{d.scheduledTime}</span>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${st.bg} ${st.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                    {st.label}
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 mt-1.5 truncate">{d.id}</p>
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav active="dispatch" />
    </div>
  );
}
