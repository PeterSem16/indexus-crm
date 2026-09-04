import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, CircleDot, Headphones, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSip } from "@/contexts/sip-context";
import { useI18n } from "@/i18n";
import { classify, classifyIceResult, gatherIce, hasCriticalFailure, isChromiumDesktop, type DiagnosticResult, type DiagnosticState } from "./diagnostics";
import { pulseCopy } from "./translations";

type Props = { open: boolean; required?: boolean; keepWakeLock?: boolean; userId: string; onClose: () => void; onReady: () => void; onExit?: () => void };

export function PulseDiagnostics({ open, required = false, keepWakeLock = false, userId, onClose, onReady, onExit }: Props) {
  const { locale } = useI18n();
  const t = pulseCopy(locale);
  const { isRegistered, ensureRegistered } = useSip();
  const [state, setState] = useState<DiagnosticState>("idle");
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [heard, setHeard] = useState(false);
  const [soundPlayed, setSoundPlayed] = useState(false);
  const [soundError, setSoundError] = useState(false);
  const [running, setRunning] = useState(false);
  const wakeLock = useRef<any>(null);
  const wakeLockGeneration = useRef(0);
  const acquireWakeLock = useCallback(async () => {
    const generation = ++wakeLockGeneration.current;
    await wakeLock.current?.release?.();
    wakeLock.current = null;
    const request = (navigator as any).wakeLock?.request;
    if (!request) return false;
    try {
      const lock = await request.call((navigator as any).wakeLock, "screen");
      if (generation !== wakeLockGeneration.current) {
        await lock?.release?.();
        return false;
      }
      wakeLock.current = lock;
      lock?.addEventListener?.("release", () => {
        if (wakeLock.current === lock) wakeLock.current = null;
      });
      return true;
    } catch {
      return false;
    }
  }, []);
  const run = useCallback(async () => {
    setRunning(true); setState("checking"); setHeard(false); setSoundPlayed(false); setSoundError(false);
    const wakeOk = await acquireWakeLock();
    const r: DiagnosticResult[] = [];
    const add = (key: DiagnosticResult["key"], severity: DiagnosticResult["severity"], pass: boolean, detail?: string) => r.push({ key, severity, state: pass ? "pass" : "fail", detail });
    add("browser", "critical", isChromiumDesktop(), t.browserDetail);
    add("secure", "critical", window.isSecureContext || window.location.hostname === "localhost", t.secureDetail);
    add("online", "critical", navigator.onLine !== false, navigator.onLine === false ? t.onlineDetail : undefined);
    let stream: MediaStream | undefined;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); add("microphone", "critical", true); }
    catch { add("microphone", "critical", false, t.micDetail); }
    let devices: MediaDeviceInfo[] = [];
    try { devices = navigator.mediaDevices?.enumerateDevices ? await navigator.mediaDevices.enumerateDevices() : []; } catch { devices = []; }
    finally { stream?.getTracks().forEach((track) => track.stop()); }
    const hasInput = devices.some((d) => d.kind === "audioinput");
    const hasOutput = devices.some((d) => d.kind === "audiooutput");
    add("input", "critical", hasInput, hasInput ? undefined : t.inputDetail);
    add("output", "critical", hasOutput, hasOutput ? undefined : t.outputDetail);
    const ice = await gatherIce();
    const iceClassification = classifyIceResult(ice);
    r.push({ key: "ice", ...iceClassification, detail: ice.ok && ice.hasPublicCandidate ? t.iceDetail : t.iceFail });
    const registered = isRegistered || await ensureRegistered().catch(() => false);
    add("sip", "critical", registered, registered ? t.sipDetail : t.sipFail);
    r.push({ key: "notifications", severity: "warning", state: typeof Notification !== "undefined" && Notification.permission === "granted" ? "pass" : "warn", detail: t.notificationsDetail });
    const networkType = String((navigator as any).connection?.type || "").toLowerCase();
    r.push({ key: "network", severity: "warning", state: networkType === "ethernet" ? "pass" : "warn", detail: networkType === "ethernet" ? t.ethernetDetail : t.networkDetail });
    r.push({ key: "wakeLock", severity: "warning", state: wakeOk ? "pass" : "warn", detail: t.wakeDetail });
    const physicalInputs = devices.filter((d) => d.kind === "audioinput" && d.deviceId !== "default" && d.deviceId !== "communications");
    const physicalOutputs = devices.filter((d) => d.kind === "audiooutput" && d.deviceId !== "default" && d.deviceId !== "communications");
    r.push({ key: "devices", severity: "warning", state: physicalInputs.length > 1 || physicalOutputs.length > 1 ? "warn" : "pass", detail: t.devicesDetail });
    setResults(r); setState(classify(r)); setRunning(false);
  }, [acquireWakeLock, ensureRegistered, isRegistered, t]);
  useEffect(() => () => {
    wakeLockGeneration.current += 1;
    void wakeLock.current?.release?.();
    wakeLock.current = null;
  }, []);
  useEffect(() => {
    if (!open && !keepWakeLock) {
      wakeLockGeneration.current += 1;
      void wakeLock.current?.release?.();
      wakeLock.current = null;
    }
  }, [keepWakeLock, open]);
  useEffect(() => {
    const onVisible = () => {
      if ((open || keepWakeLock) && document.visibilityState === "visible" && state !== "idle" && !wakeLock.current) {
        void acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [acquireWakeLock, keepWakeLock, open, state]);
  const play = async () => {
    setSoundPlayed(false); setSoundError(false); setHeard(false);
    let ctx: AudioContext | undefined;
    try {
      ctx = new AudioContext();
      await ctx.resume();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.frequency.value = 660; gain.gain.value = 0.08; osc.connect(gain).connect(ctx.destination);
      osc.onended = () => { void ctx?.close(); };
      osc.start(); osc.stop(ctx.currentTime + .22); setSoundPlayed(true);
    } catch { setSoundError(true); if (ctx) void ctx.close(); }
  };
  const requestNotifications = async () => {
    if (typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    setResults((current) => current.map((item) => item.key === "notifications"
      ? { ...item, state: permission === "granted" ? "pass" : "warn" }
      : item));
  };
  const finalResults = useMemo(() => [...results, { key: "sound" as const, severity: "critical" as const, state: soundError ? "fail" as const : heard ? "pass" as const : "pending" as const, detail: soundError ? t.soundFail : t.soundDetail }], [heard, results, soundError, t.soundDetail, t.soundFail]);
  const finalState = heard ? classify(finalResults) : (state === "blocked" ? "blocked" : "checking");
  const labels: Record<string, string> = Object.fromEntries(["browser","secure","online","microphone","input","output","sound","ice","sip","notifications","network","wakeLock","devices"].map((k) => [k, t[k as keyof typeof t] as string]));
  const statusText = finalState === "ready" ? t.ready : finalState === "warning" ? t.warning : finalState === "blocked" ? t.blocked : t.working;
  const acknowledge = () => { sessionStorage.setItem(`nexus-pulse-ready:${userId}`, "1"); onReady(); };
  return <Dialog open={open} onOpenChange={(v) => !required && !v && onClose()}>
     <DialogContent hideCloseButton={required} className="max-w-2xl max-h-[92dvh] overflow-y-auto border-primary/15 bg-background/95 p-0 shadow-2xl shadow-primary/10 backdrop-blur" data-testid="nexus-pulse-dialog">
       <div className="relative overflow-hidden rounded-[inherit]">
         <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
         <div className="pointer-events-none absolute -left-20 top-24 h-32 w-32 rounded-full bg-amber-300/10 blur-3xl" />
         <div className="relative space-y-5 p-5 sm:p-7">
           <DialogHeader><DialogTitle className="flex items-center gap-3 text-xl tracking-tight"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15"><ShieldCheck className="h-5 w-5" /></span><span>{t.title}</span></DialogTitle><DialogDescription className="pl-13">{t.subtitle}</DialogDescription></DialogHeader>
           <div className="flex items-center justify-between rounded-2xl border border-primary/15 bg-primary/[0.06] p-4 transition-colors" aria-live="polite"><div><span className="font-semibold">{statusText}</span></div><Badge className="rounded-full px-3 py-1" variant={finalState === "blocked" ? "destructive" : finalState === "ready" ? "default" : "secondary"}>{statusText}</Badge></div>
           <div className="grid gap-2 sm:grid-cols-2" aria-live="polite">{finalResults.map((item, index) => <div key={item.key} className="animate-in fade-in slide-in-from-bottom-1 flex gap-3 rounded-xl border border-border/70 bg-card/60 p-3 transition-colors hover:border-primary/25" style={{ animationDelay: `${Math.min(index * 35, 350)}ms` }}><div className="mt-0.5">{item.state === "pass" ? <Check className="h-4 w-4 text-emerald-600" /> : item.state === "fail" ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <CircleDot className="h-4 w-4 text-amber-600" />}</div><div className="min-w-0"><div className="text-sm font-medium">{labels[item.key]}</div>{item.detail && <div className="text-xs leading-relaxed text-muted-foreground">{item.detail}</div>}</div></div>)}</div>
           <div className="rounded-2xl border border-primary/20 bg-primary/[0.055] p-4"><div className="flex items-center gap-2 font-semibold"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10"><Headphones className="h-4 w-4 text-primary" /></span>{t.sound}</div><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{soundError ? t.soundFail : t.soundDetail}</p><div className="mt-3 flex flex-wrap items-center gap-3"><Button variant="outline" className="rounded-xl" onClick={() => void play()} data-testid="button-pulse-sound">{t.play}</Button><label className="flex cursor-pointer items-center gap-2 text-sm"><input className="h-4 w-4 accent-primary" type="checkbox" disabled={!soundPlayed || soundError} checked={heard} onChange={(e) => setHeard(e.target.checked)} />{t.heard}</label></div></div>
            <div className="flex flex-col-reverse gap-2 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-end">{required && onExit && <Button variant="ghost" className="mr-auto justify-start gap-2 text-muted-foreground hover:text-foreground" onClick={onExit} data-testid="button-pulse-return"><ArrowLeft className="h-4 w-4" />{t.returnToIndexus}</Button>}<Button variant="outline" className="rounded-xl" onClick={() => void run()} disabled={running} data-testid="button-pulse-retry">{running ? t.working : state === "idle" ? t.start : t.retry}</Button>{typeof Notification !== "undefined" && Notification.permission === "default" && <Button variant="ghost" onClick={() => void requestNotifications()}>{t.notifications}</Button>}{!required && <Button variant="ghost" onClick={onClose}>{t.close}</Button>}<Button className="rounded-xl" onClick={acknowledge} disabled={finalState === "blocked" || finalState === "checking" || !heard || hasCriticalFailure(finalResults)} data-testid="button-pulse-continue">{t.continue}</Button></div>
         </div>
       </div>
    </DialogContent>
  </Dialog>;
}