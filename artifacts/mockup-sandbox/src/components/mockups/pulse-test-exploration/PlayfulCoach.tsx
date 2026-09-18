import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Globe2,
  Headphones,
  Loader2,
  MailCheck,
  Mic,
  Play,
  RotateCcw,
  ShieldCheck,
  Signal,
  Sparkles,
  Wifi,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type CheckState = "queued" | "checking" | "pass" | "warn";
type Phase = "intro" | "running" | "complete" | "workspace";

type ReadinessCheck = {
  id: string;
  label: string;
  detail: string;
  icon: LucideIcon;
  state: CheckState;
  completeDetail: string;
};

const initialChecks: ReadinessCheck[] = [
  {
    id: "browser",
    label: "Browser",
    detail: "Supported desktop browser",
    completeDetail: "Chromium desktop · up to date",
    icon: Globe2,
    state: "queued",
  },
  {
    id: "secure",
    label: "Secure connection",
    detail: "Encrypted production connection",
    completeDetail: "Connection is encrypted",
    icon: ShieldCheck,
    state: "queued",
  },
  {
    id: "internet",
    label: "Internet",
    detail: "Stable connection to NEXUS",
    completeDetail: "Connection is available",
    icon: Wifi,
    state: "queued",
  },
  {
    id: "microphone",
    label: "Microphone / input",
    detail: "Your voice input",
    completeDetail: "Jabra Evolve2 65 · voice detected locally",
    icon: Mic,
    state: "queued",
  },
  {
    id: "output",
    label: "Audio output",
    detail: "Your selected headset",
    completeDetail: "Jabra Evolve2 65 selected",
    icon: Headphones,
    state: "queued",
  },
  {
    id: "sound",
    label: "Test sound",
    detail: "A short sound you can confirm",
    completeDetail: "Sound confirmed by you",
    icon: Play,
    state: "queued",
  },
  {
    id: "path",
    label: "Connection path",
    detail: "Best route for your call",
    completeDetail: "Public ICE path available",
    icon: Signal,
    state: "queued",
  },
  {
    id: "sip",
    label: "SIP",
    detail: "Calling transport registration",
    completeDetail: "SIP transport registered",
    icon: Signal,
    state: "queued",
  },
  {
    id: "microsoft",
    label: "Microsoft 365",
    detail: "Account and email readiness",
    completeDetail: "Account connected",
    icon: MailCheck,
    state: "queued",
  },
  {
    id: "notifications",
    label: "Notifications",
    detail: "Incoming call reminders",
    completeDetail: "Notifications are optional",
    icon: Bell,
    state: "queued",
  },
];

const cx = (...classes: Array<string | false | undefined>) =>
  classes.filter(Boolean).join(" ");

function statusLabel(state: CheckState) {
  if (state === "pass") return "Ready";
  if (state === "warn") return "Review";
  if (state === "checking") return "Checking";
  return "Up next";
}

function statusTone(state: CheckState) {
  if (state === "pass") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (state === "warn") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (state === "checking") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-500";
}

function CheckIcon({ state }: { state: CheckState }) {
  if (state === "pass") return <Check className="h-3.5 w-3.5" strokeWidth={3} />;
  if (state === "warn") return <AlertTriangle className="h-3.5 w-3.5" />;
  if (state === "checking") return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  return <CircleDot className="h-3.5 w-3.5" />;
}

export function PlayfulCoach() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [checks, setChecks] = useState<ReadinessCheck[]>(initialChecks);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [soundConfirmed, setSoundConfirmed] = useState(false);

  const currentCheck = checks[currentIndex];
  const passedCount = checks.filter((check) => check.state === "pass").length;
  const progress = phase === "complete" || phase === "workspace"
    ? 100
    : phase === "intro"
      ? 0
      : Math.round((passedCount / checks.length) * 100);
  const isSoundStep = currentCheck?.id === "sound";

  const currentCopy = useMemo(() => {
    if (phase === "intro") {
      return {
        eyebrow: "First up",
        title: "Let’s make sure your setup can hear you.",
        body: "I’ll guide you through ten small checks, one at a time. Most are finished before you notice.",
      };
    }
    if (phase === "complete") {
      return {
        eyebrow: "Nice work",
        title: "Your calling setup is ready.",
        body: "Everything essential checked out. Notifications can be enabled later if you want the extra nudge.",
      };
    }
    if (phase === "workspace") {
      return {
        eyebrow: "You’re all set",
        title: "Welcome to your calling workspace.",
        body: "This is a mock continuation. Your real calls would open here once the readiness check is complete.",
      };
    }
    return {
      eyebrow: `Check ${currentIndex + 1} of ${checks.length}`,
      title: currentCheck?.label ?? "Checking your setup",
      body: currentCheck?.id === "microphone"
        ? "Say a few words so I can make sure your voice is coming through clearly."
        : currentCheck?.id === "sound"
          ? "I’m sending a short tone to your selected headset. Confirm when you hear it."
          : currentCheck?.detail ?? "I’m taking a quick look at your setup.",
    };
  }, [checks.length, currentCheck, currentIndex, phase]);

  useEffect(() => {
    if (phase !== "running" || !currentCheck || isSoundStep && !soundConfirmed) return;

    setChecks((items) =>
      items.map((item, index) =>
        index === currentIndex ? { ...item, state: "checking" } : item,
      ),
    );

    const timer = window.setTimeout(() => {
      const isLast = currentIndex === checks.length - 1;
      const nextState: CheckState = currentCheck.id === "notifications" ? "warn" : "pass";
      setChecks((items) =>
        items.map((item, index) =>
          index === currentIndex ? { ...item, state: nextState } : item,
        ),
      );
      if (isLast) {
        setPhase("complete");
        return;
      }
      setSoundConfirmed(false);
      setCurrentIndex((index) => index + 1);
    }, 1050);

    return () => window.clearTimeout(timer);
  }, [checks.length, currentCheck, currentIndex, isSoundStep, phase, soundConfirmed]);

  const begin = () => {
    setChecks(initialChecks);
    setSoundConfirmed(false);
    setCurrentIndex(0);
    setPhase("running");
  };

  const retry = () => {
    setChecks(initialChecks);
    setSoundConfirmed(false);
    setCurrentIndex(0);
    setPhase("intro");
  };

  const confirmSound = () => {
    setSoundConfirmed(true);
    setChecks((items) =>
      items.map((item) =>
        item.id === "sound" ? { ...item, state: "checking" } : item,
      ),
    );
  };

  const currentStatus = phase === "intro"
    ? "Ready when you are"
    : phase === "complete"
      ? "Ready to call"
      : phase === "workspace"
        ? "Setup complete"
        : "Checking now";

  return (
    <main className="min-h-[100dvh] bg-[#edf5ff] px-3 py-4 text-slate-950 sm:px-6 sm:py-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#b8d9ff]/50 blur-3xl" />
        <div className="absolute -right-28 bottom-0 h-96 w-96 rounded-full bg-[#d8e9ff]/80 blur-3xl" />
      </div>

      <section className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-blue-100/90 bg-[#fbfdff]/95 shadow-[0_24px_70px_rgba(35,96,168,0.15)]">
        <header className="flex flex-col gap-4 border-b border-blue-100/80 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1769e0] text-white shadow-[0_8px_20px_rgba(23,105,224,0.28)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1769e0]">NEXUS Pulse</p>
              <h1 className="text-lg font-bold tracking-tight text-slate-950 sm:text-xl">Readiness check</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold text-slate-700">{currentStatus}</p>
              <p className="text-[11px] text-slate-500">Before your first call</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-[#1769e0]" aria-label={`${progress}% complete`}>
              <span className="text-[11px] font-bold">{progress}%</span>
            </div>
          </div>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_275px]">
          <div className="space-y-6 p-5 sm:p-8 lg:p-10">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1769e0]" />
              Usually takes under a minute
              <span className="h-px flex-1 bg-blue-100" />
              <span className="text-[#1769e0]">{passedCount}/{checks.length} ready</span>
            </div>

            <section
              className="relative overflow-hidden rounded-[1.75rem] border border-blue-200/90 bg-[linear-gradient(135deg,#e7f2ff_0%,#f9fcff_60%,#e4f4ff_100%)] p-5 sm:p-8"
              aria-live="polite"
              aria-labelledby="coach-title"
            >
              <div className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-[#8bc2ff]/35 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-16 left-20 h-32 w-32 rounded-full bg-white/80 blur-2xl" />
              <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start">
                <div className="relative mx-auto shrink-0 sm:mx-0">
                  <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-[#1769e0] text-white shadow-[0_14px_28px_rgba(23,105,224,0.28)] sm:h-28 sm:w-28">
                    {phase === "running" ? <Loader2 className="h-10 w-10 animate-spin" /> : phase === "complete" || phase === "workspace" ? <CheckCircle2 className="h-11 w-11" /> : <Sparkles className="h-11 w-11" />}
                  </div>
                  <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-4 border-[#e7f2ff] bg-[#f8c84a] text-slate-900" aria-hidden="true">
                    <span className="h-2 w-2 rounded-full bg-slate-900" />
                  </span>
                </div>

                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1769e0]">{currentCopy.eyebrow}</p>
                  <h2 id="coach-title" className="mt-2 max-w-xl text-2xl font-bold leading-tight tracking-tight text-slate-950 sm:text-[2rem]">
                    {currentCopy.title}
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">{currentCopy.body}</p>

                  {phase === "intro" && (
                    <div className="mt-5 flex flex-col items-center gap-3 sm:items-start">
                      <button
                        type="button"
                        onClick={begin}
                        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1769e0] px-6 text-sm font-bold text-white shadow-[0_10px_22px_rgba(23,105,224,0.24)] transition hover:bg-[#0f59c8] focus:outline-none focus:ring-4 focus:ring-blue-300 sm:w-auto"
                      >
                        <Play className="h-4 w-4 fill-current" />
                        Start readiness check
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <p className="flex items-center gap-2 text-xs text-slate-500">
                        <Mic className="h-3.5 w-3.5 text-[#1769e0]" />
                        Your microphone is checked locally. Nothing is recorded.
                      </p>
                    </div>
                  )}

                  {phase === "running" && isSoundStep && (
                    <div className="mt-5 flex flex-col items-center gap-3 sm:items-start">
                      <button
                        type="button"
                        onClick={confirmSound}
                        disabled={soundConfirmed}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#1769e0] bg-white px-5 text-sm font-bold text-[#1769e0] transition hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-default disabled:opacity-60"
                      >
                        <Headphones className="h-4 w-4" />
                        {soundConfirmed ? "Sound confirmed" : "I heard the test sound"}
                      </button>
                      <p className="text-xs text-slate-500">No audio is recorded or sent anywhere.</p>
                    </div>
                  )}

                  {phase === "complete" && (
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => setPhase("workspace")}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1769e0] px-5 text-sm font-bold text-white shadow-[0_9px_20px_rgba(23,105,224,0.22)] transition hover:bg-[#0f59c8] focus:outline-none focus:ring-4 focus:ring-blue-300"
                      >
                        Continue to calling workspace
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={retry}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-200"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Run again
                      </button>
                    </div>
                  )}

                  {phase === "workspace" && (
                    <button
                      type="button"
                      onClick={retry}
                      className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-200"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Run readiness check again
                    </button>
                  )}
                </div>
              </div>
            </section>

            {phase === "running" && (
              <div className="space-y-2" aria-label="Readiness progress">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                  <span>Guided check in progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-blue-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                  <div className="h-full rounded-full bg-[#1769e0] transition-all duration-500" style={{ width: `${Math.max(5, progress)}%` }} />
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-blue-100 bg-white/80 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#1769e0]" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">A quiet, local check</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Pulse only verifies whether your browser can use the device. The microphone check happens locally and nothing is recorded.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <aside className="border-t border-blue-100/90 bg-[#f5f9ff] p-5 sm:p-8 lg:border-l lg:border-t-0">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1769e0]">Your trail</p>
                <h2 className="mt-1 text-base font-bold tracking-tight text-slate-950">What I’ll check</h2>
              </div>
              <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-bold text-[#1769e0]">{checks.length} areas</span>
            </div>

            <ol className="mt-5 space-y-2" aria-label="Readiness areas">
              {checks.map((check, index) => {
                const Icon = check.icon;
                const isCurrent = phase === "running" && index === currentIndex;
                return (
                  <li
                    key={check.id}
                    className={cx(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                      isCurrent ? "border-blue-300 bg-blue-50 shadow-sm" : "border-transparent bg-white/55",
                    )}
                  >
                    <div className={cx(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      check.state === "pass" ? "bg-emerald-100 text-emerald-700" :
                        check.state === "warn" ? "bg-amber-100 text-amber-800" :
                          isCurrent ? "bg-blue-100 text-[#1769e0]" : "bg-slate-100 text-slate-400",
                    )}>
                      {check.state === "queued" || check.state === "checking"
                        ? <Icon className="h-4 w-4" />
                        : <CheckIcon state={check.state} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cx("truncate text-xs font-bold", isCurrent ? "text-[#1353b4]" : "text-slate-800")}>{check.label}</span>
                        <span className={cx("shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold", statusTone(check.state))}>
                          {statusLabel(check.state)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[10px] text-slate-500">
                        {check.state === "pass" || check.state === "warn" ? check.completeDetail : check.detail}
                      </p>
                    </div>
                    {isCurrent && <ChevronRight className="h-4 w-4 shrink-0 text-[#1769e0]" aria-hidden="true" />}
                  </li>
                );
              })}
            </ol>

            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 text-[11px] leading-4 text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <span><strong>Good to know:</strong> notifications are helpful, but they won’t block you from calling.</span>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}