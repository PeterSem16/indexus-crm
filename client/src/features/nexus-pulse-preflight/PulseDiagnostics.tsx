import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, AudioLines, Bell, Check, CircleDot, Headphones, MailCheck, Play, ShieldCheck, Volume2, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSip } from "@/contexts/sip-context";
import { useI18n } from "@/i18n";
import { canUseQuickSoundVerification, classify, classifyIceResult, gatherIce, hasCriticalFailure, isChromiumDesktop, isCompletePulseReadinessRun, type DiagnosticResult, type DiagnosticState } from "./diagnostics";
import { pulseCopy } from "./translations";

type Props = { open: boolean; required?: boolean; keepWakeLock?: boolean; hasValidReadiness?: boolean; userId: string; onClose: () => void; onReady: () => void; onExit?: () => void };

export function PulseDiagnostics({ open, required = false, keepWakeLock = false, hasValidReadiness = false, userId, onClose, onReady, onExit }: Props) {
  const { locale } = useI18n();
  const t = pulseCopy(locale);
  const { isRegistered, ensureRegistered } = useSip();
  const [state, setState] = useState<DiagnosticState>("idle");
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [heard, setHeard] = useState(false);
  const [soundPlayed, setSoundPlayed] = useState(false);
  const [soundError, setSoundError] = useState(false);
  const [running, setRunning] = useState(false);
  const [runCompleted, setRunCompleted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressDetail, setProgressDetail] = useState(t.progressStarting);
  const wakeLock = useRef<any>(null);
  const wakeLockGeneration = useRef(0);
  const runGeneration = useRef(0);
  const runAbort = useRef<AbortController | null>(null);
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
    const generation = ++runGeneration.current;
    runAbort.current?.abort();
    const abortController = new AbortController();
    runAbort.current = abortController;
    setRunning(true); setState("checking"); setHeard(false); setSoundPlayed(false); setSoundError(false);
    setRunCompleted(false);
    setProgress(5); setProgressDetail(t.progressStarting);
    const advance = (value: number, detail: string) => {
      if (generation !== runGeneration.current) return;
      setProgress(value);
      setProgressDetail(detail);
    };
    const wakeOk = await acquireWakeLock();
    if (generation !== runGeneration.current) return;
    advance(15, t.progressEnvironment);
    const r: DiagnosticResult[] = [];
    const add = (key: DiagnosticResult["key"], severity: DiagnosticResult["severity"], pass: boolean, detail?: string) => r.push({ key, severity, state: pass ? "pass" : "fail", detail });
    add("browser", "critical", isChromiumDesktop(), t.browserDetail);
    add("secure", "critical", window.isSecureContext || window.location.hostname === "localhost", t.secureDetail);
    add("online", "critical", navigator.onLine !== false, navigator.onLine === false ? t.onlineDetail : undefined);
    advance(28, t.progressAudio);
    let stream: MediaStream | undefined;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); if (generation !== runGeneration.current) { stream.getTracks().forEach((track) => track.stop()); return; } add("microphone", "critical", true); }
    catch { add("microphone", "critical", false, t.micDetail); }
    let devices: MediaDeviceInfo[] = [];
    try { devices = navigator.mediaDevices?.enumerateDevices ? await navigator.mediaDevices.enumerateDevices() : []; } catch { devices = []; }
    finally { stream?.getTracks().forEach((track) => track.stop()); }
    const hasInput = devices.some((d) => d.kind === "audioinput");
    const hasOutput = devices.some((d) => d.kind === "audiooutput");
    add("input", "critical", hasInput, hasInput ? undefined : t.inputDetail);
    add("output", "critical", hasOutput, hasOutput ? undefined : t.outputDetail);
    advance(45, t.progressNetwork);
    const ice = await gatherIce();
    if (generation !== runGeneration.current) return;
    const iceClassification = classifyIceResult(ice);
    r.push({ key: "ice", ...iceClassification, detail: ice.ok && ice.hasPublicCandidate ? t.iceDetail : t.iceFail });
    advance(65, t.progressSip);
    const registered = isRegistered || await ensureRegistered().catch(() => false);
    if (generation !== runGeneration.current) return;
    add("sip", "critical", registered, registered ? t.sipDetail : t.sipFail);
    advance(80, t.progressM365);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(userId)}/ms365-connection`, { credentials: "include", signal: abortController.signal });
      if (generation !== runGeneration.current) return;
      if (!response.ok) throw new Error("MS365 status request failed");
      const connection = await response.json();
      const connected = !!(connection?.isConnected && connection?.hasTokens);
      add("m365Account", "critical", connected, connected ? t.m365Connected : t.m365Required);
    } catch {
      if (generation !== runGeneration.current || abortController.signal.aborted) return;
      add("m365Account", "critical", false, t.m365CheckFailed);
    }
    advance(94, t.progressFinishing);
    r.push({ key: "notifications", severity: "warning", state: typeof Notification !== "undefined" && Notification.permission === "granted" ? "pass" : "warn", detail: t.notificationsDetail });
    const networkType = String((navigator as any).connection?.type || "").toLowerCase();
    r.push({ key: "network", severity: "warning", state: "warn", detail: networkType === "ethernet" ? t.ethernetDetail : t.networkDetail });
    r.push({ key: "wakeLock", severity: "warning", state: wakeOk ? "pass" : "warn", detail: t.wakeDetail });
    const physicalInputs = devices.filter((d) => d.kind === "audioinput" && d.deviceId !== "default" && d.deviceId !== "communications");
    const physicalOutputs = devices.filter((d) => d.kind === "audiooutput" && d.deviceId !== "default" && d.deviceId !== "communications");
    r.push({ key: "devices", severity: "warning", state: "warn", detail: physicalInputs.length > 1 || physicalOutputs.length > 1 ? t.devicesDetail : t.devicesSingleDetail });
    if (generation !== runGeneration.current) return;
    setProgress(100);
    setResults(r); setState(classify(r)); setRunCompleted(true); setRunning(false);
  }, [acquireWakeLock, ensureRegistered, isRegistered, t, userId]);
  useEffect(() => () => {
    runGeneration.current += 1;
    runAbort.current?.abort();
    wakeLockGeneration.current += 1;
    void wakeLock.current?.release?.();
    wakeLock.current = null;
  }, []);
  useEffect(() => {
    if (!open && !keepWakeLock) {
      runGeneration.current += 1;
      runAbort.current?.abort();
      setRunning(false);
      setProgress(0);
      wakeLockGeneration.current += 1;
      void wakeLock.current?.release?.();
      wakeLock.current = null;
    }
  }, [keepWakeLock, open]);
  useEffect(() => {
    runGeneration.current += 1;
    runAbort.current?.abort();
    setState("idle");
    setResults([]);
    setHeard(false);
    setSoundPlayed(false);
    setSoundError(false);
    setRunCompleted(false);
    setRunning(false);
    setProgress(0);
    setProgressDetail(t.progressStarting);
  }, [t.progressStarting, userId]);
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
    let permission: NotificationPermission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    setResults((current) => current.map((item) => item.key === "notifications"
      ? { ...item, state: permission === "granted" ? "pass" : "warn", detail: permission === "granted" ? t.notificationsEnabled : permission === "denied" ? t.notificationsDenied : t.notificationsDetail }
      : item));
  };
  const finalResults = useMemo(() => [...results, { key: "sound" as const, severity: "critical" as const, state: soundError ? "fail" as const : heard ? "pass" as const : "pending" as const, detail: soundError ? t.soundFail : t.soundDetail }], [heard, results, soundError, t.soundDetail, t.soundFail]);
  const diagnosticsComplete = isCompletePulseReadinessRun(results);
  const quickSoundVerified = canUseQuickSoundVerification({ hasValidReadiness, diagnosticState: state, runCompleted, heard, soundError });
  const finalState = quickSoundVerified ? "ready" : diagnosticsComplete && heard ? classify(finalResults) : (state === "blocked" ? "blocked" : "checking");
  const labels: Record<string, string> = Object.fromEntries(["browser","secure","online","microphone","input","output","sound","ice","sip","m365Account","notifications","network","wakeLock","devices"].map((k) => [k, t[k as keyof typeof t] as string]));
  const mainResults = finalResults.filter((item) => item.key !== "network" && item.key !== "devices");
  const advisoryResults = finalResults.filter((item) => item.key === "network" || item.key === "devices");
  const statusText = finalState === "ready" ? t.ready : finalState === "warning" ? t.warning : finalState === "blocked" ? t.blocked : t.working;
  const canContinue = quickSoundVerified || (runCompleted && diagnosticsComplete && heard && !hasCriticalFailure(finalResults) && (finalState === "ready" || finalState === "warning"));
  const acknowledge = () => {
    if (!canContinue) return;
    onReady();
  };
  return <Dialog open={open} onOpenChange={(v) => !required && !v && onClose()}>
     <DialogContent hideCloseButton={required} className="max-w-2xl max-h-[92dvh] overflow-y-auto border-primary/15 bg-background/95 p-0 shadow-2xl shadow-primary/10 backdrop-blur" data-testid="nexus-pulse-dialog">
       <div className="relative overflow-hidden rounded-[inherit]">
         <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
         <div className="pointer-events-none absolute -left-20 top-24 h-32 w-32 rounded-full bg-amber-300/10 blur-3xl" />
         <div className="relative space-y-5 p-5 sm:p-7">
           <DialogHeader><DialogTitle className="flex items-center gap-3 text-xl tracking-tight"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15"><ShieldCheck className="h-5 w-5" /></span><span>{t.title}</span></DialogTitle><DialogDescription className="pl-13">{t.subtitle}</DialogDescription></DialogHeader>
           <div className="flex items-center justify-between rounded-2xl border border-primary/15 bg-primary/[0.06] p-4 transition-colors" aria-live="polite"><div><span className="font-semibold">{statusText}</span></div><Badge className="rounded-full px-3 py-1" variant={finalState === "blocked" ? "destructive" : finalState === "ready" ? "default" : "secondary"}>{statusText}</Badge></div>
            {running && <section className="overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.10] via-primary/[0.04] to-background p-4 shadow-sm" aria-live="polite" aria-label={t.progressTitle}>
              <div className="mb-3 flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3"><span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><span className="absolute inset-0 animate-ping rounded-xl bg-primary/10" /><CircleDot className="relative h-4 w-4 animate-pulse" /></span><div className="min-w-0"><div className="text-sm font-semibold">{t.progressTitle}</div><div className="truncate text-xs text-muted-foreground">{progressDetail}</div></div></div>
                <span className="tabular-nums text-sm font-bold text-primary">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2.5 bg-primary/10 [&>div]:transition-all [&>div]:duration-500" />
            </section>}
             <div className="grid gap-2 sm:grid-cols-2" aria-live="polite">{mainResults.map((item, index) => <div key={item.key} className={`animate-in fade-in slide-in-from-bottom-1 flex gap-3 rounded-xl border bg-card/60 p-3 transition-colors ${item.key === "notifications" || item.key === "m365Account" ? "sm:col-span-2" : ""} ${item.key === "m365Account" && item.state === "fail" ? "border-destructive/40 bg-destructive/[0.06]" : "border-border/70 hover:border-primary/25"}`} style={{ animationDelay: `${Math.min(index * 35, 350)}ms` }}><div className="mt-0.5">{item.key === "m365Account" && item.state === "pass" ? <MailCheck className="h-4 w-4 text-emerald-600" /> : item.state === "pass" ? <Check className="h-4 w-4 text-emerald-600" /> : item.state === "fail" ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <CircleDot className="h-4 w-4 text-amber-600" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-sm font-medium">{labels[item.key]}</div>{item.key === "notifications" && item.state !== "pass" && typeof Notification !== "undefined" && Notification.permission === "default" && <Button variant="outline" size="sm" className="rounded-lg border-primary/30 text-primary" onClick={() => void requestNotifications()} data-testid="button-pulse-notifications"><Bell className="h-4 w-4" />{t.notificationsEnable}</Button>}</div>{item.detail && <div className={`text-xs leading-relaxed ${item.key === "m365Account" && item.state === "fail" ? "font-medium text-destructive" : "text-muted-foreground"}`}>{item.detail}</div>}{item.key === "notifications" && item.state !== "pass" && typeof Notification === "undefined" && <div className="text-xs leading-relaxed text-amber-700">{t.notificationsUnsupported}</div>}{item.key === "notifications" && item.state !== "pass" && typeof Notification !== "undefined" && Notification.permission === "default" && <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.notificationsPrompt}</div>}</div></div>)}</div>
             {advisoryResults.length > 0 && <section className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-4" aria-label={t.advisoryTitle}><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-100"><AlertTriangle className="h-4 w-4 text-amber-600" />{t.advisoryTitle}</div><Badge variant="outline" className="border-amber-500/40 bg-background/50 text-amber-800 dark:text-amber-200">{t.advisoryBadge}</Badge></div><div className="grid gap-3 sm:grid-cols-2">{advisoryResults.map((item) => <div key={item.key} className="rounded-xl border border-amber-500/20 bg-background/70 p-3"><div className="flex items-center gap-2 text-sm font-medium">{item.key === "network" ? <Wifi className="h-4 w-4 text-amber-600" /> : <AudioLines className="h-4 w-4 text-amber-600" />}{labels[item.key]}</div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.detail}</p><p className="mt-2 text-xs font-medium leading-relaxed text-foreground">{item.key === "network" ? t.networkAction : t.devicesAction}</p></div>)}</div></section>}
            <div className="rounded-2xl border border-primary/20 bg-primary/[0.055] p-4"><div className="flex items-center gap-2 font-semibold"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10"><Headphones className="h-4 w-4 text-primary" /></span>{t.sound}</div><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{soundError ? t.soundFail : soundPlayed ? t.soundPlayed : t.soundDetail}</p><div className="mt-3 flex flex-wrap items-center gap-3"><Button variant={soundPlayed ? "secondary" : "default"} className="rounded-xl min-w-40" onClick={() => void play()} data-testid="button-pulse-sound"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-background/20">{soundPlayed ? <Volume2 className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}</span>{soundPlayed ? t.soundPlayed : t.play}</Button><label className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${heard ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/70 bg-background/40"}`}><input className="h-4 w-4 accent-primary" type="checkbox" disabled={!soundPlayed || soundError} checked={heard} onChange={(e) => setHeard(e.target.checked)} />{t.heard}</label></div><div className="mt-2 text-xs text-muted-foreground">{t.soundConfirmHint}</div></div>
              <div className="flex flex-col-reverse gap-2 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-end">{required && onExit && <Button variant="ghost" className="mr-auto justify-start gap-2 text-muted-foreground hover:text-foreground" onClick={onExit} data-testid="button-pulse-return"><ArrowLeft className="h-4 w-4" />{t.returnToIndexus}</Button>}<Button variant="outline" className="rounded-xl" onClick={() => void run()} disabled={running} data-testid="button-pulse-retry">{running ? t.working : state === "idle" ? t.start : t.retry}</Button>{!required && <Button variant="ghost" onClick={onClose}>{t.close}</Button>}<Button className="rounded-xl" onClick={acknowledge} disabled={!canContinue} data-testid="button-pulse-continue">{t.continue}</Button></div>
         </div>
       </div>
    </DialogContent>
  </Dialog>;
}