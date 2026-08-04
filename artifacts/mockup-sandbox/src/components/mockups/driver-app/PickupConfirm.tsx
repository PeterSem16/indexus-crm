import { useState } from "react";
import {
  ArrowLeft, MapPin, CheckCircle2, Camera, ScanLine,
  Signal, Wifi, Battery, Package, AlertCircle, Loader2
} from "lucide-react";

type State = "idle" | "scanning" | "confirming" | "done";

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-4 py-1 bg-black text-white text-xs" style={{ height: 28 }}>
      <span>10:22</span>
      <div className="flex items-center gap-1.5">
        <Signal className="h-3 w-3" />
        <Wifi className="h-3 w-3" />
        <Battery className="h-3 w-3" />
      </div>
    </div>
  );
}

export function PickupConfirm() {
  const [step, setStep] = useState<State>("idle");
  const [note, setNote] = useState("");

  return (
    <div className="w-[390px] h-[844px] bg-slate-50 flex flex-col overflow-hidden font-sans" style={{ fontFamily: "system-ui, sans-serif" }}>
      <StatusBar />

      {/* Header */}
      <div className="bg-violet-700 text-white px-4 pt-3 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <button className="p-1 rounded-full bg-white/15">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-xs opacity-70">CBC-2026-00841</p>
            <h2 className="font-bold text-base">Potvrdiť prevzatie odberu</h2>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

        {/* Location check */}
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <MapPin className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-sm">Poloha zaznamenaná</p>
              <p className="text-xs text-slate-400">48.1442° N, 17.1265° E · pred 12s</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-emerald-500 ml-auto shrink-0" />
          </div>
        </div>

        {/* Package scan */}
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Identifikácia škatule</p>

          {step === "idle" && (
            <div className="space-y-2">
              <button
                onClick={() => setStep("scanning")}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 text-white rounded-xl py-3 font-medium text-sm"
              >
                <ScanLine className="h-5 w-5" /> Skenovať QR/Čiarový kód
              </button>
              <button className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-700 rounded-xl py-3 font-medium text-sm">
                <Camera className="h-4 w-4" /> Odfotiť škatulu
              </button>
            </div>
          )}

          {step === "scanning" && (
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="w-40 h-40 border-2 border-dashed border-violet-400 rounded-2xl flex items-center justify-center bg-violet-50">
                <div className="text-center">
                  <ScanLine className="h-10 w-10 text-violet-400 mx-auto mb-2 animate-pulse" />
                  <p className="text-xs text-violet-500">Namierte na kód</p>
                </div>
              </div>
              <button
                onClick={() => setStep("confirming")}
                className="text-xs text-slate-500 underline"
              >
                Zadať kód manuálne
              </button>
            </div>
          )}

          {(step === "confirming" || step === "done") && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <Package className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">CBC-BAG-2026-3941</p>
                  <p className="text-xs text-emerald-600">Škatula identifikovaná ✓</p>
                </div>
              </div>

              {/* Checklist */}
              <div className="space-y-2">
                {[
                  "Škatula je nepoškodená",
                  "Uzáver je neporušený",
                  "Štítok zodpovedá objednávke",
                ].map((item, i) => (
                  <label key={i} className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                    <div className="w-5 h-5 rounded border-2 border-emerald-400 bg-emerald-50 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    {item}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Note */}
        {(step === "confirming" || step === "done") && (
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Poznámka (nepovinné)</p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Napr. mierny škrabanec na škatuli, inak v poriadku..."
              className="w-full text-sm rounded-xl border border-slate-200 p-2.5 resize-none outline-none focus:border-violet-400 h-20"
            />
          </div>
        )}

        {step === "done" && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0" />
            <div>
              <p className="font-bold text-emerald-800">Prevzatie potvrdené!</p>
              <p className="text-xs text-emerald-600">10:24 · Odoslané do Indexus CRM</p>
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="px-4 pb-6 pt-3 bg-white border-t shrink-0">
        {step === "confirming" && (
          <button
            onClick={() => setStep("done")}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-sm shadow-md bg-violet-600"
          >
            Potvrdiť prevzatie odberu
          </button>
        )}
        {step === "done" && (
          <button className="w-full py-3.5 rounded-2xl text-white font-bold text-sm shadow-md bg-emerald-600">
            Pokračovať na doručenie →
          </button>
        )}
        {(step === "idle" || step === "scanning") && (
          <button disabled className="w-full py-3.5 rounded-2xl text-slate-400 font-bold text-sm bg-slate-100 cursor-not-allowed">
            Najprv naskenujte škatulu
          </button>
        )}
      </div>
    </div>
  );
}
