import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Cloud,
  Headphones,
  Info,
  Laptop,
  MailCheck,
  Mic,
  Play,
  RotateCcw,
  ShieldCheck,
  Signal,
  Sparkles,
  Volume2,
  Wifi,
} from "lucide-react";
import "./_group.css";

type CheckState = "pass" | "ready" | "pending" | "warn";

type ReadinessCheck = {
  id: string;
  label: string;
  detail: string;
  state: CheckState;
  icon: typeof ShieldCheck;
  signal: number;
  signalLabel: string;
};

const baseChecks: ReadinessCheck[] = [
  {
    id: "browser",
    label: "Browser",
    detail: "Chromium desktop is supported by Pulse.",
    state: "pass",
    icon: Laptop,
    signal: 1,
    signalLabel: "Can your browser connect?",
  },
  {
    id: "secure",
    label: "Secure connection",
    detail: "This workspace is using an encrypted connection.",
    state: "pass",
    icon: ShieldCheck,
    signal: 1,
    signalLabel: "Can your browser connect?",
  },
  {
    id: "internet",
    label: "Internet",
    detail: "Network access is available for calling.",
    state: "pass",
    icon: Wifi,
    signal: 2,
    signalLabel: "Is the line open?",
  },
  {
    id: "microphone",
    label: "Microphone / input",
    detail: "Jabra Evolve2 65 is ready to listen locally.",
    state: "ready",
    icon: Mic,
    signal: 3,
    signalLabel: "Can Pulse hear you?",
  },
  {
    id: "output",
    label: "Audio output",
    detail: "Jabra Evolve2 65 is selected for call audio.",
    state: "ready",
    icon: Headphones,
    signal: 4,
    signalLabel: "Can you hear Pulse?",
  },
  {
    id: "sound",
    label: "Test sound",
    detail: "A quick tone will confirm your speaker output.",
    state: "ready",
    icon: Volume2,
    signal: 4,
    signalLabel: "Can you hear Pulse?",
  },
  {
    id: "path",
    label: "Connection path",
    detail: "A public call path is available.",
    state: "pending",
    icon: Signal,
    signal: 2,
    signalLabel: "Is the line open?",
  },
  {
    id: "sip",
    label: "SIP",
    detail: "The calling transport is registered and ready.",
    state: "pending",
    icon: Signal,
    signal: 5,
    signalLabel: "Is the call path clear?",
  },
  {
    id: "m365",
    label: "Microsoft 365",
    detail: "Connected for email sending and calendar context.",
    state: "pending",
    icon: MailCheck,
    signal: 6,
    signalLabel: "Are your work tools ready?",
  },
  {
    id: "notifications",
    label: "Notifications",
    detail: "Notifications are off — you can enable them later.",
    state: "warn",
    icon: AlertTriangle,
    signal: 6,
    signalLabel: "Are your work tools ready?",
  },
];

const signalLevels = [
  { number: 1, title: "Can your browser connect?", caption: "Your desk has a safe place to start." },
  { number: 2, title: "Is the line open?", caption: "Pulse can find a reliable route to the call." },
  { number: 3, title: "Can Pulse hear you?", caption: "Your voice stays right here on this device." },
  { number: 4, title: "Can you hear Pulse?", caption: "We’ll play one tiny tone in your headset." },
  { number: 5, title: "Is the call path clear?", caption: "The calling service is standing by." },
  { number: 6, title: "Are your work tools ready?", caption: "The finishing checks keep follow-up smooth." },
];

function stateLabel(state: CheckState) {
  if (state === "pass") return "Ready";
  if (state === "warn") return "Review";
  if (state === "ready") return "Ready to check";
  return "Not checked";
}

function StateMark({ state }: { state: CheckState }) {
  if (state === "pass") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c9f9e8] text-[#087a60]" aria-hidden="true">
        <Check className="h-4 w-4 stroke-[3]" />
      </span>
    );
  }
  if (state === "warn") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fff0c7] text-[#9a5b00]" aria-hidden="true">
        <AlertTriangle className="h-4 w-4" />
      </span>
    );
  }
  if (state === "ready") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#62d8ce] bg-[#e9fffd] text-[#087d86]" aria-hidden="true">
        <CircleDot className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#bdd0e5] bg-[#f4f8fc] text-[#7790ad]" aria-hidden="true">
      <span className="h-2 w-2 rounded-full bg-current" />
    </span>
  );
}

export function SignalArcade() {
  const [checks, setChecks] = useState(baseChecks);
  const [running, setRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [heardTone, setHeardTone] = useState(false);
  const [showContinue, setShowContinue] = useState(false);

  const checkedSignals = useMemo(
    () => {
      const complete = new Set<number>();
      signalLevels.forEach((level) => {
        const levelChecks = checks.filter((check) => check.signal === level.number);
        const isComplete = levelChecks.every(
          (check) => check.state === "pass" || (check.id === "notifications" && check.state === "warn"),
        );
        if (isComplete) complete.add(level.number);
      });
      return complete;
    },
    [checks],
  );

  const activeSignal = useMemo(() => {
    const firstUnfinished = signalLevels.find((level) => !checkedSignals.has(level.number));
    return firstUnfinished?.number ?? 6;
  }, [checkedSignals]);

  useEffect(() => {
    if (!running) return;
    const pending = checks.find((check) => check.state === "pending" || check.state === "ready");
    if (!pending) {
      setRunning(false);
      setShowContinue(true);
      return;
    }
    if (pending.id === "sound") {
      setRunning(false);
      setExpanded(pending.signal);
      return;
    }
    const timer = window.setTimeout(() => {
      setChecks((current) =>
        current.map((check) =>
          check.id === pending.id
            ? { ...check, state: check.id === "notifications" ? "warn" : "pass" }
            : check,
        ),
      );
      setExpanded(pending.signal);
    }, 620);
    return () => window.clearTimeout(timer);
  }, [checks, running]);

  const startCheck = () => {
    setHasStarted(true);
    setShowContinue(false);
    setRunning(true);
    setExpanded(activeSignal);
  };

  const resetCheck = () => {
    setChecks(baseChecks);
    setRunning(false);
    setHasStarted(false);
    setHeardTone(false);
    setShowContinue(false);
    setExpanded(null);
  };

  const confirmTone = () => {
    setHeardTone(true);
    setChecks((current) =>
      current.map((check) => (check.id === "sound" ? { ...check, state: "pass" } : check)),
    );
    setRunning(true);
    setExpanded(4);
  };

  const continueToWorkspace = () => {
    setShowContinue(true);
  };

  return (
    <main className="min-h-[100dvh] bg-[#edf5fc] px-3 py-5 text-[#102c4e] sm:px-6 sm:py-8">
      <section className="mx-auto max-w-[1080px] overflow-hidden rounded-[28px] border border-[#c8dcef] bg-[#fbfdff] shadow-[0_22px_70px_rgba(25,72,122,0.15)]">
        <header className="relative overflow-hidden border-b border-[#d8e7f5] bg-[#0c5fbd] px-5 py-6 text-white sm:px-9 sm:py-7">
          <div className="absolute -right-12 -top-28 h-64 w-64 rounded-full border-[34px] border-[#27d8cf]/20" />
          <div className="absolute -bottom-24 right-32 h-44 w-44 rounded-full bg-[#27d8cf]/15 blur-2xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                <Sparkles className="h-5 w-5 text-[#9cfff0]" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#a3fff1]">NEXUS Pulse</div>
                <h1 className="mt-1 text-xl font-semibold tracking-[-0.02em] sm:text-2xl">Signal check before you call</h1>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-blue-100">
                  Six small signals make one confident start. No recordings, no surprises.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-blue-50">
              <span className="h-2 w-2 rounded-full bg-[#70f4b8]" />
              Preflight
            </div>
          </div>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 px-5 py-6 sm:px-9 sm:py-8">
            <section className="relative overflow-hidden rounded-[24px] border border-[#bcdcf3] bg-[linear-gradient(135deg,#e6f5ff_0%,#f8fcff_56%,#e7fffb_100%)] p-5 sm:p-7">
              <div className="absolute -right-16 -top-20 h-44 w-44 rounded-full bg-[#7cded5]/20 blur-2xl" />
              <div className="relative">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#0b75a7]">
                      <Signal className="h-4 w-4" />
                      Signal arcade
                    </div>
                    <h2 className="mt-2 max-w-lg text-2xl font-bold leading-tight tracking-[-0.035em] text-[#102c4e] sm:text-[30px]">
                      A quick tune-up for your calling desk.
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#53708f]">
                      We’ll walk through the parts that make a call feel clear. Most of the green lights are already waiting.
                    </p>
                  </div>
                  <div className="shrink-0 rounded-2xl border border-[#b9dde7] bg-white/75 px-4 py-3 text-left shadow-sm sm:min-w-[148px]">
                    <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#54809c]">Progress</div>
                    <div className="mt-1 text-2xl font-bold tracking-tight text-[#087d86]">
                      {checkedSignals.size}<span className="text-base font-semibold text-[#7d9bad]">/6</span>
                    </div>
                    <div className="text-xs font-medium text-[#53708f]">signals checked</div>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-1.5" aria-label={`${checkedSignals.size} of 6 signals checked`}>
                  {signalLevels.map((level) => (
                    <span
                      key={level.number}
                      className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
                        checkedSignals.has(level.number) ? "bg-[#18b79c]" : level.number === activeSignal ? "bg-[#1b82d1]" : "bg-[#cce1ef]"
                      }`}
                    />
                  ))}
                </div>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                  {!hasStarted ? (
                    <button
                      type="button"
                      onClick={startCheck}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0c67c7] px-5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(12,103,199,0.23)] transition-transform hover:-translate-y-0.5 hover:bg-[#0759ad] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#70ded8]/60"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      Start the signal check
                    </button>
                  ) : running ? (
                    <div className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#d7f7f1] px-5 text-sm font-bold text-[#087d6c]" role="status" aria-live="polite">
                      <span className="h-4 w-4 animate-pulse rounded-full border-2 border-[#1ba990] border-t-transparent" />
                      Listening for the next signal…
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startCheck}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0c67c7] px-5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(12,103,199,0.23)] transition-transform hover:-translate-y-0.5 hover:bg-[#0759ad] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#70ded8]/60"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Run again
                    </button>
                  )}
                  {hasStarted && !running && (
                    <button
                      type="button"
                      onClick={resetCheck}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#54708f] transition-colors hover:bg-[#eaf3fa] hover:text-[#173e68] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#70ded8]/50"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-[#53708f]">
                  <Mic className="mt-0.5 h-4 w-4 shrink-0 text-[#0c8d91]" />
                  <span><strong className="font-semibold text-[#315677]">Privacy note:</strong> your microphone is checked locally on this device. Nothing is recorded or sent to Pulse.</span>
                </p>
              </div>
            </section>

            <div className="mt-8 flex items-end justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#6a89a6]">Your signal path</div>
                <h2 className="mt-1 text-lg font-bold tracking-tight text-[#15385d]">Six friendly checks, one clear next step</h2>
              </div>
              <div className="hidden items-center gap-1.5 text-xs font-medium text-[#6e8aa4] sm:flex">
                <CheckCircle2 className="h-4 w-4 text-[#18a98e]" />
                Ready means safe to continue
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {signalLevels.map((level) => {
                const levelChecks = checks.filter((check) => check.signal === level.number);
                const isComplete = checkedSignals.has(level.number);
                const isActive = expanded === level.number;
                return (
                  <article
                    key={level.number}
                    className={`overflow-hidden rounded-2xl border transition-colors ${
                      isActive ? "border-[#7edbd8] bg-[#f3fffd]" : "border-[#d7e5f1] bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpanded(isActive ? null : level.number)}
                      aria-expanded={isActive}
                      className="flex w-full items-center gap-3 px-4 py-4 text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#71d8d0]/50 sm:px-5"
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                        isComplete ? "bg-[#c9f9e8] text-[#087a60]" : isActive ? "bg-[#d8f5f7] text-[#087d86]" : "bg-[#eaf2fa] text-[#4b7498]"
                      }`}>
                        {isComplete ? <Check className="h-5 w-5 stroke-[3]" /> : `0${level.number}`}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-[#173b60]">{level.title}</span>
                        <span className="mt-0.5 block text-xs text-[#6885a0]">{level.caption}</span>
                      </span>
                      <span className={`hidden rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] sm:inline-flex ${
                        isComplete ? "bg-[#e0fbf2] text-[#087a60]" : "bg-[#edf3f8] text-[#6c87a1]"
                      }`}>
                        {isComplete ? "Checked" : isActive ? "In focus" : "Up next"}
                      </span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-[#7894ad] transition-transform ${isActive ? "rotate-180" : ""}`} />
                    </button>
                    {isActive && (
                      <div className="border-t border-[#dcece9] px-4 pb-4 pt-2 sm:px-5">
                        <div className="divide-y divide-[#e1edf3]">
                          {levelChecks.map((check) => {
                            const Icon = check.icon;
                            const isSound = check.id === "sound";
                            return (
                              <div key={check.id} className="flex items-start gap-3 py-3 first:pt-2 last:pb-1">
                                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#e7f3fb] text-[#0b72a9]">
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="text-sm font-semibold text-[#214665]">{check.label}</span>
                                    <span className={`text-[10px] font-bold uppercase tracking-[0.08em] ${
                                      check.state === "pass" ? "text-[#087a60]" : check.state === "warn" ? "text-[#9a5b00]" : "text-[#39728f]"
                                    }`}>
                                      {stateLabel(check.state)}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs leading-relaxed text-[#6a849d]">{check.detail}</p>
                                  {isSound && check.state !== "pass" && (
                                    <button
                                      type="button"
                                      onClick={confirmTone}
                                      className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#86d9d2] bg-white px-3 text-xs font-bold text-[#087d86] transition-colors hover:bg-[#e9fffc] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#71d8d0]/50"
                                    >
                                      <Volume2 className="h-3.5 w-3.5" />
                                      {heardTone ? "I heard it" : "Play test sound"}
                                    </button>
                                  )}
                                </div>
                                <StateMark state={check.state} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <div className="mt-5 flex items-start gap-2 rounded-xl border border-[#d7e5f1] bg-[#f5f9fc] px-3.5 py-3 text-xs leading-relaxed text-[#64819a]">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#3c84ae]" />
              <span>Notifications are optional. If they’re off, Pulse will still let you continue — you can turn them on from your browser settings.</span>
            </div>
          </div>

          <aside className="border-t border-[#d8e7f5] bg-[#f4f9fd] px-5 py-6 sm:px-8 lg:border-l lg:border-t-0 lg:px-7 lg:py-8">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.17em] text-[#5b83a0]">
              <Cloud className="h-4 w-4 text-[#0a80a3]" />
              What’s happening
            </div>
            <h2 className="mt-2 text-lg font-bold tracking-tight text-[#173b60]">A little context goes a long way.</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#66829b]">
              Pulse checks the essentials in a calm order: browser, route, audio, then the tools around your call.
            </p>
            <div className="mt-6 space-y-2.5">
              {signalLevels.map((level) => (
                <div key={level.number} className="flex items-center gap-3 rounded-xl border border-[#deebf4] bg-white/75 px-3 py-2.5">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    checkedSignals.has(level.number) ? "bg-[#d8f8ed] text-[#087a60]" : "bg-[#e8f1f8] text-[#5c7e9e]"
                  }`}>
                    {checkedSignals.has(level.number) ? <Check className="h-4 w-4 stroke-[3]" /> : level.number}
                  </span>
                  <span className="min-w-0 flex-1 text-xs font-semibold text-[#365a79]">{level.title}</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-[#7e9ab1]">
                    {checkedSignals.has(level.number) ? "Done" : "Next"}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-7 rounded-2xl border border-[#b9e3dd] bg-[#eafff9] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#c8f6e7] text-[#087d6c]">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#176053]">Built for a confident first hello</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#4e8177]">Nothing here records your voice. We only need to know the signal is strong enough to call.</p>
                </div>
              </div>
            </div>
            <div className="mt-6">
              {showContinue ? (
                <button
                  type="button"
                  onClick={continueToWorkspace}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0c67c7] px-4 text-sm font-bold text-white shadow-[0_8px_18px_rgba(12,103,199,0.2)] transition-transform hover:-translate-y-0.5 hover:bg-[#0759ad] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#70ded8]/60"
                >
                  Continue to calling workspace
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : checkedSignals.size === 6 ? (
                <button
                  type="button"
                  onClick={continueToWorkspace}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0c67c7] px-4 text-sm font-bold text-white shadow-[0_8px_18px_rgba(12,103,199,0.2)] transition-transform hover:-translate-y-0.5 hover:bg-[#0759ad] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#70ded8]/60"
                >
                  Continue to calling workspace
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <p className="flex items-center gap-2 text-xs font-medium text-[#6987a1]">
                  <CircleDot className="h-4 w-4 text-[#1a9f98]" />
                  Start when your headset is on.
                </p>
              )}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}