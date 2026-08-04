import { useState } from "react";
import {
  ArrowLeft, MapPin, Clock, Phone, User, Package, Truck,
  CheckCircle2, Navigation, AlertTriangle, ChevronRight,
  Signal, Wifi, Battery, Building2, FileText
} from "lucide-react";

const STEPS = [
  { key: "assigned",     label: "Pridelené",         desc: "Dispečer pridelil zvoz" },
  { key: "acknowledged", label: "Akceptované",       desc: "Vodič prijal úlohu" },
  { key: "collected",    label: "Odber prevzatý",    desc: "Potvrdené v nemocnici" },
  { key: "delivered",    label: "Doručené do lab.",  desc: "Potvrdené laboratóriom" },
];

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-4 py-1 bg-black text-white text-xs" style={{ height: 28 }}>
      <span>10:15</span>
      <div className="flex items-center gap-1.5">
        <Signal className="h-3 w-3" />
        <Wifi className="h-3 w-3" />
        <Battery className="h-3 w-3" />
      </div>
    </div>
  );
}

export function DispatchDetail() {
  const [currentStep, setCurrentStep] = useState<0|1|2|3>(1);

  const stepIdx = currentStep;
  const isLast = stepIdx === 3;

  const actions = [
    null,
    { label: "Akceptovať zvoz",         color: "bg-blue-600", next: 2 },
    { label: "✓  Potvrdenie prevzatia", color: "bg-violet-600", next: 3 },
    { label: "✓  Doručené do laboratória", color: "bg-emerald-600", next: 3 },
  ];

  const action = actions[stepIdx];

  return (
    <div className="w-[390px] h-[844px] bg-slate-50 flex flex-col overflow-hidden font-sans" style={{ fontFamily: "system-ui, sans-serif" }}>
      <StatusBar />

      {/* Header */}
      <div className="bg-blue-700 text-white px-4 pt-3 pb-4 shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <button className="p-1 rounded-full bg-white/15">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-xs opacity-70">Detail zvozu</p>
            <h2 className="font-bold text-base">CBC-2026-00841</h2>
          </div>
          <div className="ml-auto">
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> URGENT
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Progress stepper */}
        <div className="bg-white mx-4 mt-4 rounded-2xl border shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Priebeh zvozu</p>
          <div className="space-y-0">
            {STEPS.map((s, i) => {
              const done    = i < stepIdx;
              const current = i === stepIdx;
              const future  = i > stepIdx;
              return (
                <div key={s.key} className="flex gap-3">
                  {/* line + dot */}
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 ${
                      done ? "bg-emerald-500" : current ? "bg-blue-600" : "bg-slate-200"
                    }`}>
                      {done
                        ? <CheckCircle2 className="h-4 w-4 text-white" />
                        : <span className={`text-xs font-bold ${current ? "text-white" : "text-slate-400"}`}>{i + 1}</span>
                      }
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`w-0.5 h-8 ${done ? "bg-emerald-400" : "bg-slate-200"}`} />
                    )}
                  </div>
                  <div className="pb-4 flex-1 min-w-0">
                    <p className={`text-sm font-semibold leading-none mt-1 ${current ? "text-blue-700" : done ? "text-emerald-700" : "text-slate-400"}`}>{s.label}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{s.desc}</p>
                    {done && <p className="text-[10px] text-emerald-600 mt-0.5 font-medium">✓ 09:52 · GPS zaznamenaný</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hospital info */}
        <div className="bg-white mx-4 mt-3 rounded-2xl border shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Nemocnica</p>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Nemocnica sv. Cyrila a Metoda</p>
              <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                <MapPin className="h-3 w-3" />
                <span>Antolská 11, Bratislava · SK-BA</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                <Clock className="h-3 w-3" />
                <span>Čas odberu: 09:45 · Dnes</span>
              </div>
            </div>
          </div>
          <button className="mt-3 w-full flex items-center justify-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl py-2 text-sm font-medium">
            <Navigation className="h-4 w-4" /> Navigovať
          </button>
        </div>

        {/* Contact */}
        <div className="bg-white mx-4 mt-3 rounded-2xl border shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Kontakt</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <User className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Dr. Novák</p>
                <p className="text-xs text-slate-400">+421 903 111 222</p>
              </div>
            </div>
            <button className="w-9 h-9 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center">
              <Phone className="h-4 w-4 text-emerald-600" />
            </button>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white mx-4 mt-3 mb-4 rounded-2xl border shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Poznámky dispečera</p>
          <p className="text-sm text-slate-600">Odber je v pôrodnici, vstup cez vchod B. Škatula bude pripravená na recepcii.</p>
        </div>
      </div>

      {/* CTA */}
      {!isLast && action && (
        <div className="px-4 pb-6 pt-3 bg-white border-t shrink-0">
          <button
            onClick={() => setCurrentStep((stepIdx + 1) as 0|1|2|3)}
            className={`w-full py-3.5 rounded-2xl text-white font-bold text-sm shadow-md ${action.color}`}
          >
            {action.label}
          </button>
        </div>
      )}
      {isLast && (
        <div className="px-4 pb-6 pt-3 bg-white border-t shrink-0">
          <div className="w-full py-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-700 font-bold text-sm text-center flex items-center justify-center gap-2">
            <CheckCircle2 className="h-5 w-5" /> Zvoz dokončený
          </div>
        </div>
      )}
    </div>
  );
}
