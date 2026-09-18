import "./_group.css";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CircleDot,
  Globe2,
  Headphones,
  MailCheck,
  Mic,
  Play,
  ShieldCheck,
  Signal,
  Wifi,
} from "lucide-react";

const checks = [
  { label: "Supported browser", detail: "Current Chromium desktop browser", state: "pass", icon: Globe2 },
  { label: "Secure connection", detail: "Production connection is encrypted", state: "pass", icon: ShieldCheck },
  { label: "Internet connection", detail: "Connection is available", state: "pass", icon: Wifi },
  { label: "Microphone & input", detail: "Jabra Evolve2 65 · voice detected locally", state: "pass", icon: Mic },
  { label: "Audio output", detail: "Jabra Evolve2 65 selected", state: "pass", icon: Headphones },
  { label: "Test sound", detail: "Play and confirm that you heard it", state: "pending", icon: Play },
  { label: "Connection path", detail: "Public ICE path available", state: "pass", icon: Signal },
  { label: "SIP registration", detail: "SIP transport is registered and ready", state: "pass", icon: Signal },
  { label: "Microsoft 365", detail: "Account connected for email sending", state: "pass", icon: MailCheck },
  { label: "Notifications", detail: "Notifications are not enabled yet", state: "warn", icon: AlertTriangle },
];

export function Current() {
  return (
    <main className="min-h-screen p-4 sm:p-6">
      <section className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-blue-200/70 bg-white/90 shadow-xl shadow-blue-950/10">
        <div className="relative overflow-hidden border-b border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 px-5 py-6 sm:px-8">
          <div className="absolute -right-12 -top-14 h-40 w-40 rounded-full bg-blue-300/20 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">NEXUS Pulse</p>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">NEXUS Pulse readiness</h1>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">A quick check before you start calling. Nothing is recorded or sent to the server.</p>
            </div>
          </div>
        </div>
        <div className="space-y-5 p-5 sm:p-8">
          <div className="relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-100/60 via-blue-50/30 to-white px-5 py-7 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-blue-600 text-white shadow-lg shadow-blue-600/25">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">Before your first call</p>
            <p className="mt-1 text-xs text-slate-500">Usually takes under a minute</p>
            <h2 className="mx-auto mt-4 max-w-lg text-2xl font-bold tracking-tight text-slate-950">Let’s make sure your desk is ready.</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-600">NEXUS Pulse checks your browser, headset, calling connection, and Microsoft 365 account before calls begin.</p>
            <div className="mx-auto mt-5 flex max-w-md items-center justify-center gap-2 rounded-xl border border-blue-200/80 bg-white/70 px-3 py-2.5 text-xs font-semibold text-slate-600">
              <Mic className="h-4 w-4 text-blue-600" /> Your microphone is checked locally. Nothing is recorded.
            </div>
            <button className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 sm:w-auto">
              <Play className="h-4 w-4 fill-current" /> Start readiness check
            </button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-950">What will be checked</h2>
              <p className="mt-1 text-xs text-slate-500">You can review every result after the check.</p>
            </div>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">10 checks</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {checks.map(({ label, detail, state, icon: Icon }) => (
              <div key={label} className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${state === "pass" ? "bg-emerald-100 text-emerald-600" : state === "warn" ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"}`}>
                  {state === "pass" ? <Check className="h-4 w-4" /> : state === "warn" ? <AlertTriangle className="h-4 w-4" /> : <CircleDot className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Icon className="h-3.5 w-3.5 text-slate-400" />{label}</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{detail}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="flex items-center gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Current state shown as a realistic pre-check preview.
          </p>
        </div>
      </section>
    </main>
  );
}