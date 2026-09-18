import "./_group.css";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Circle,
  Cloud,
  Headphones,
  HelpCircle,
  Laptop2,
  LockKeyhole,
  Mail,
  Mic,
  Play,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Signal,
  Sparkles,
  Wifi,
} from "lucide-react";
import { useMemo, useState } from "react";

type CheckState = "ready" | "attention" | "pending";
type CheckItem = {
  label: string;
  detail: string;
  state: CheckState;
  icon: typeof ShieldCheck;
};

const checkGroups: { label: string; eyebrow: string; icon: typeof ShieldCheck; items: CheckItem[] }[] = [
  {
    label: "Device",
    eyebrow: "Your calling desk",
    icon: Laptop2,
    items: [
      { label: "Browser", detail: "Chromium desktop · supported", state: "ready", icon: Laptop2 },
      { label: "Microphone / input", detail: "Jabra Evolve2 65 · local voice check", state: "ready", icon: Mic },
      { label: "Audio output", detail: "Jabra Evolve2 65 selected", state: "ready", icon: Headphones },
      { label: "Test sound", detail: "You’ll confirm you can hear a short tone", state: "pending", icon: Play },
    ],
  },
  {
    label: "Connection",
    eyebrow: "The path to a clear call",
    icon: Signal,
    items: [
      { label: "Secure connection", detail: "Encrypted production connection", state: "ready", icon: LockKeyhole },
      { label: "Internet", detail: "Online · stable connection detected", state: "ready", icon: Wifi },
      { label: "Connection path", detail: "Public route available for voice traffic", state: "ready", icon: Signal },
      { label: "SIP", detail: "Transport registration will be verified", state: "pending", icon: Cloud },
    ],
  },
  {
    label: "Account",
    eyebrow: "The tools behind your workspace",
    icon: ShieldCheck,
    items: [
      { label: "Microsoft 365", detail: "Connected account will be checked", state: "pending", icon: Mail },
      { label: "Notifications", detail: "Optional · currently not enabled", state: "attention", icon: Bell },
    ],
  },
];

const flatChecks = checkGroups.flatMap((group) => group.items);

function StatusMark({ state, running }: { state: CheckState; running: boolean }) {
  if (running && state === "pending") {
    return <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#dff5ff] text-[#087ca5]" aria-label="Checking"><span className="h-2 w-2 animate-pulse rounded-full bg-current" /></span>;
  }
  if (state === "ready") {
    return <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#dff8ed] text-[#167653]" aria-label="Ready"><Check className="h-4 w-4" strokeWidth={2.7} /></span>;
  }
  if (state === "attention") {
    return <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fff2d9] text-[#a3650b]" aria-label="Optional attention"><AlertTriangle className="h-4 w-4" /></span>;
  }
  return <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#edf0f6] text-[#6e7e98]" aria-label="Will be checked"><Circle className="h-3.5 w-3.5" /></span>;
}

export function MissionControl() {
  const [runState, setRunState] = useState<"idle" | "checking" | "complete">("idle");
  const [progress, setProgress] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  const statusLabel = runState === "complete" ? "Ready for takeoff" : runState === "checking" ? "Running preflight" : "Ready to check";
  const completedCount = runState === "complete" ? flatChecks.length : 0;
  const startCheck = () => {
    setRunState("checking");
    setProgress(0);
    flatChecks.forEach((_, index) => {
      window.setTimeout(() => {
        setProgress(index + 1);
        if (index === flatChecks.length - 1) setRunState("complete");
      }, 260 + index * 270);
    });
  };
  const resetCheck = () => {
    setRunState("idle");
    setProgress(0);
  };

  const ringStyle = useMemo(() => {
    const percentage = runState === "complete" ? 100 : runState === "checking" ? Math.max(8, (progress / flatChecks.length) * 100) : 0;
    return { background: `conic-gradient(#31b8ee ${percentage}%, rgba(105, 130, 173, .2) ${percentage}% 100%)` };
  }, [progress, runState]);

  return (
    <main className="min-h-[100dvh] bg-[#071529] px-3 py-4 text-[#eef5ff] sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex items-center justify-between gap-4 px-1 sm:mb-7">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-[13px] border border-[#3bbbf2]/35 bg-[#112d4f] text-[#66d7ff] shadow-[0_0_28px_rgba(46,182,237,.16)]">
              <ShieldCheck className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#70e4c1] ring-4 ring-[#071529]" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#65d7ff]">NEXUS Pulse</p>
              <p className="mt-0.5 text-sm font-medium text-[#c5d4e9]">Preflight control</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-[#91a7c4] sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#70e4c1]" />
            Workspace standing by
          </div>
        </header>

        <section className="relative overflow-hidden rounded-[28px] border border-[#274267] bg-[#0c203a] shadow-[0_26px_80px_rgba(0,0,0,.28)]">
          <div className="pointer-events-none absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(rgba(92,174,222,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(92,174,222,.055) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#168cc8]/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-96 bg-[#083d67]/35 blur-3xl" />
          <div className="relative grid lg:grid-cols-[minmax(0,1.22fr)_minmax(320px,.78fr)]">
            <div className="border-b border-[#274267] px-5 pb-8 pt-7 sm:px-9 sm:pb-10 sm:pt-9 lg:border-b-0 lg:border-r">
              <div className="mb-7 flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.19em] text-[#66d7ff]"><Sparkles className="h-3.5 w-3.5" /> Mission control</p>
                  <h1 className="max-w-xl text-[2rem] font-semibold leading-[1.06] tracking-[-.045em] text-[#f5f9ff] sm:text-[3.2rem]">Make sure your desk is ready for takeoff.</h1>
                  <p className="mt-4 max-w-lg text-sm leading-6 text-[#a9bdd7] sm:text-[15px]">A quick pre-call check for your browser, headset, connection, and account. We’ll show you what’s happening at every step.</p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#6683a7]">Flight time</p>
                  <p className="mt-1 text-sm font-semibold text-[#d7e8fa]">Under 01:00</p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-7 rounded-[22px] border border-[#315275] bg-[#091a30]/75 px-5 py-7 sm:flex-row sm:justify-between sm:px-8">
                <div className="flex items-center gap-5">
                  <div className="relative h-[142px] w-[142px] shrink-0 rounded-full p-[7px] transition-[background] duration-500" style={ringStyle}>
                    <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#0b2039] text-center">
                      <span className="font-mono text-[10px] uppercase tracking-[.15em] text-[#7d9ab9]">{runState === "checking" ? `${progress}/${flatChecks.length}` : runState === "complete" ? "100%" : "Status"}</span>
                      <span className="mt-1 text-lg font-semibold text-[#f3f8ff]">{runState === "complete" ? "Go" : runState === "checking" ? "Checking" : "Ready"}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#70e4c1]">System status</p>
                    <p className="mt-1 text-xl font-semibold text-[#f5f9ff]">{statusLabel}</p>
                    <p className="mt-2 max-w-[220px] text-xs leading-5 text-[#91a7c4]">{runState === "complete" ? "All required checks are clear. Your calling workspace is unlocked." : runState === "checking" ? "Stay on this screen while we run each check locally." : "One quick pass, then you’re clear to call."}</p>
                  </div>
                </div>
                <div className="w-full sm:w-auto">
                  {runState === "complete" ? (
                    <button type="button" onClick={resetCheck} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#416384] bg-[#102b4b] px-5 text-sm font-bold text-[#dcecff] transition hover:border-[#67ccec] hover:bg-[#16385d] focus:outline-none focus:ring-2 focus:ring-[#6bdbff] focus:ring-offset-2 focus:ring-offset-[#091a30] sm:w-auto">
                      <RefreshCw className="h-4 w-4" /> Run again
                    </button>
                  ) : (
                    <button type="button" onClick={startCheck} disabled={runState === "checking"} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#37b9ee] px-5 text-sm font-bold text-[#062039] shadow-[0_10px_30px_rgba(50,188,240,.2)] transition hover:bg-[#64d1fa] focus:outline-none focus:ring-2 focus:ring-[#a2ebff] focus:ring-offset-2 focus:ring-offset-[#091a30] disabled:cursor-wait disabled:opacity-70 sm:w-auto">
                      {runState === "checking" ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#062039]/30 border-t-[#062039]" /> Checking…</> : <><Play className="h-4 w-4 fill-current" /> Start readiness check</>}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[#254766] bg-[#0d2743]/75 px-4 py-3 text-xs text-[#a9bfd8] sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-2"><Mic className="h-4 w-4 text-[#67d9ff]" /> Your microphone is checked locally. Nothing is recorded.</span>
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[.1em] text-[#6e89a9]"><CheckCircle2 className="h-3.5 w-3.5 text-[#70e4c1]" /> Private by design</span>
              </div>
            </div>

            <aside className="bg-[#091b31]/65 px-5 py-7 sm:px-8 lg:py-9">
              <div className="flex items-end justify-between border-b border-[#284463] pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#6f8cad]">Readiness map</p>
                  <h2 className="mt-1 text-lg font-semibold text-[#edf5ff]">What we’ll check</h2>
                </div>
                <span className="rounded-full border border-[#315475] bg-[#102b49] px-2.5 py-1 font-mono text-[10px] text-[#92b6d7]">{completedCount || 10} points</span>
              </div>
              <div className="mt-5 space-y-6">
                {checkGroups.map((group) => {
                  const GroupIcon = group.icon;
                  return (
                    <section key={group.label} aria-labelledby={`mission-${group.label}`}>
                      <div className="mb-2.5 flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#153657] text-[#66d7ff]"><GroupIcon className="h-3.5 w-3.5" /></span>
                        <div><h3 id={`mission-${group.label}`} className="text-xs font-bold text-[#dcecff]">{group.label}</h3><p className="text-[10px] text-[#7894b3]">{group.eyebrow}</p></div>
                      </div>
                      <div className="space-y-1">
                        {group.items.map((item) => {
                          const ItemIcon = item.icon;
                          const active = runState === "complete" || (runState === "checking" && flatChecks.indexOf(item) < progress);
                          return (
                            <div key={item.label} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[#102b49]">
                              <StatusMark state={active ? "ready" : item.state} running={runState === "checking"} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5"><ItemIcon className="h-3 w-3 text-[#7895b5]" /><p className="text-xs font-semibold text-[#d7e7f8]">{item.label}</p></div>
                                <p className="mt-0.5 truncate text-[10px] text-[#7895b5]">{active ? "Check complete · looking good" : item.detail}</p>
                              </div>
                              {active && <span className="font-mono text-[9px] uppercase tracking-wider text-[#70e4c1]">Pass</span>}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
              <p className="mt-6 flex items-start gap-2 border-t border-[#284463] pt-4 text-[11px] leading-5 text-[#7894b3]"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#e5b354]" /> Notifications are optional. You can continue if they’re off.</p>
            </aside>
          </div>
        </section>

        <div className="mt-4 flex flex-col items-center justify-between gap-3 px-1 text-xs text-[#7894b3] sm:flex-row">
          <button type="button" onClick={() => setShowHelp((current) => !current)} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 font-semibold text-[#a7bdd5] transition hover:bg-[#102a47] hover:text-[#e1efff] focus:outline-none focus:ring-2 focus:ring-[#67d8ff]"><HelpCircle className="h-4 w-4" /> Need help?</button>
          <span className="flex items-center gap-2"><Rocket className="h-3.5 w-3.5 text-[#5fcff8]" /> You’ll enter the calling workspace when required checks pass <ArrowRight className="h-3.5 w-3.5" /></span>
        </div>
        {showHelp && <div className="mx-auto mt-3 max-w-xl rounded-xl border border-[#315273] bg-[#0c213b] px-4 py-3 text-center text-xs leading-5 text-[#adc2d9]" role="status">If a check needs attention, try reconnecting your headset or refreshing this tab. You can retry the readiness check at any time.</div>}
      </div>
    </main>
  );
}