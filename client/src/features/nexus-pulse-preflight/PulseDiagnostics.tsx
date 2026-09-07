import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, AudioLines, Bell, Check, CheckCircle2, CircleDot, Globe2, Headphones, Loader2, MailCheck, Mic, Play, Radio, ShieldCheck, Signal, Wifi, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSip } from "@/contexts/sip-context";
import { useI18n } from "@/i18n";
import { classify, classifyIceResult, classifyLatencyQuality, gatherIce, hasCriticalFailure, hasVoiceLevel, isChromiumDesktop, isCompletePulseReadinessRun, isProbableSameHeadset, measureSameOriginLatency, rmsFromTimeDomain, type DiagnosticResult, type DiagnosticState } from "./diagnostics";
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
  const [micRms, setMicRms] = useState(0);
  const [micBands, setMicBands] = useState<number[]>(Array(14).fill(0));
  const [micPhase, setMicPhase] = useState<"idle" | "calibrating" | "listening" | "complete">("idle");
  const [micTesting, setMicTesting] = useState(false);
  const [latencyMetrics, setLatencyMetrics] = useState<{ latency: number; jitter: number; samples: number; quality: "good" | "warning" | "poor" } | null>(null);
  const [quickMicStatus, setQuickMicStatus] = useState<"idle" | "pending" | "pass" | "fail">("idle");
  const [quickSpeakerStatus, setQuickSpeakerStatus] = useState<"idle" | "pending" | "pass" | "fail">("idle");
  const [quickLatencyStatus, setQuickLatencyStatus] = useState<"idle" | "pending" | "pass" | "warn" | "fail">("idle");
  const [quickLatencySamples, setQuickLatencySamples] = useState<number[]>([]);
  const [activeAudioTest, setActiveAudioTest] = useState<"browser" | "microphone" | "output" | "latency" | "progress" | null>(null);
  const successSoundPlayed = useRef(false);
  const wakeLock = useRef<any>(null);
  const wakeLockGeneration = useRef(0);
  const runGeneration = useRef(0);
  const runAbort = useRef<AbortController | null>(null);
  const soundConfirmationResolver = useRef<(() => void) | null>(null);
  const heardRef = useRef(false);
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
    soundConfirmationResolver.current?.();
    soundConfirmationResolver.current = null;
    runAbort.current?.abort();
    const abortController = new AbortController();
    runAbort.current = abortController;
    heardRef.current = false;
    setRunning(true); setState("checking"); setHeard(false); setSoundPlayed(false); setSoundError(false); setResults([]); setLatencyMetrics(null); setQuickLatencySamples([]); setQuickMicStatus("idle"); setQuickSpeakerStatus("idle"); setQuickLatencyStatus("idle");
    setActiveAudioTest("browser");
    setRunCompleted(false);
    setProgress(5); setProgressDetail(t.progressStarting);
    const advance = (value: number, detail: string) => {
      if (generation !== runGeneration.current) return;
      setProgress(value);
      setProgressDetail(detail);
    };
    const pauseForResult = () => new Promise<void>((resolve) => window.setTimeout(resolve, 900));
    const wakeOk = await acquireWakeLock();
    if (generation !== runGeneration.current) return;
    advance(15, t.progressEnvironment);
    const r: DiagnosticResult[] = [];
    const add = (key: DiagnosticResult["key"], severity: DiagnosticResult["severity"], pass: boolean, detail?: string) => {
      r.push({ key, severity, state: pass ? "pass" : "fail", detail });
      if (generation === runGeneration.current) setResults([...r]);
    };
    add("browser", "critical", isChromiumDesktop(), t.browserDetail);
    add("secure", "critical", window.isSecureContext || window.location.hostname === "localhost", t.secureDetail);
    add("online", "critical", navigator.onLine !== false, navigator.onLine === false ? t.onlineDetail : undefined);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 1100));
    if (generation !== runGeneration.current) return;
    advance(28, t.progressAudio);
    setActiveAudioTest("microphone");
    let stream: MediaStream | undefined;
    let microphoneLabel = "";
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (generation !== runGeneration.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      microphoneLabel = stream.getAudioTracks()[0]?.label || "";
      add("microphone", "critical", true, microphoneLabel ? `${t.micCurrent}: ${microphoneLabel}` : t.micCurrentUnavailable);
    }
    catch { add("microphone", "critical", false, t.micDetail); }
    let devices: MediaDeviceInfo[] = [];
    try { devices = navigator.mediaDevices?.enumerateDevices ? await navigator.mediaDevices.enumerateDevices() : []; } catch { devices = []; }
    const selectedInputId = stream?.getAudioTracks()[0]?.getSettings?.().deviceId;
    microphoneLabel ||= devices.find((device) => device.kind === "audioinput" && device.deviceId === selectedInputId)?.label || "";
    const microphone = r.find((result) => result.key === "microphone");
    if (microphone?.state === "pass") microphone.detail = microphoneLabel ? `${t.micCurrent}: ${microphoneLabel}` : t.micCurrentUnavailable;
    const hasInput = devices.some((d) => d.kind === "audioinput");
    const hasOutput = devices.some((d) => d.kind === "audiooutput");
    const inputLabels = devices.filter((d) => d.kind === "audioinput").map((d) => d.label).filter(Boolean);
    const outputLabels = devices.filter((d) => d.kind === "audiooutput").map((d) => d.label).filter(Boolean);
    const defaultOutput = devices.find((device) => device.kind === "audiooutput" && device.deviceId === "default");
    add("input", "critical", hasInput, hasInput ? `${t.availableInputs}: ${inputLabels.join(", ") || t.deviceLabelsUnavailable}` : t.inputDetail);
    add("output", "critical", hasOutput, hasOutput ? `${t.availableOutputs}: ${defaultOutput?.label || t.deviceLabelsUnavailable}; ${outputLabels.join(", ") || t.deviceLabelsUnavailable}` : t.outputDetail);
    let voiceDetected = false;
    let voicedFrames = 0;
    if (stream) {
      let context: AudioContext | undefined;
      let frame: number | undefined;
      try {
        context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.72;
        context.createMediaStreamSource(stream).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        const frequencies = new Uint8Array(analyser.frequencyBinCount);
        let baselineTotal = 0;
        let baselineFrames = 0;
        setMicTesting(true); setMicRms(0); setMicBands(Array(14).fill(0)); setMicPhase("calibrating");
        await new Promise<void>((resolve) => {
          const started = performance.now();
          const update = () => {
            analyser.getByteTimeDomainData(samples);
            analyser.getByteFrequencyData(frequencies);
            const level = rmsFromTimeDomain(samples);
            const elapsed = performance.now() - started;
            if (elapsed < 800) {
              baselineTotal += level;
              baselineFrames += 1;
            } else {
              const noiseFloor = baselineFrames ? baselineTotal / baselineFrames : 0.01;
              const threshold = Math.max(0.035, noiseFloor * 2.4 + 0.008);
              if (level >= threshold) voicedFrames += 1;
              voiceDetected ||= voicedFrames >= 24;
            }
            if (generation === runGeneration.current) {
              setMicRms(level);
              setMicPhase(elapsed < 800 ? "calibrating" : "listening");
              const bucketSize = Math.floor(frequencies.length / 28);
              setMicBands(Array.from({ length: 14 }, (_, index) => {
                let total = 0;
                for (let offset = 0; offset < bucketSize; offset += 1) total += frequencies[index * bucketSize + offset] || 0;
                return total / Math.max(1, bucketSize) / 255;
              }));
            }
            if (elapsed >= 4000 || generation !== runGeneration.current) { resolve(); return; }
            frame = requestAnimationFrame(update);
          };
          update();
        });
      } catch {
        voiceDetected = false;
      } finally {
        if (frame) cancelAnimationFrame(frame);
        setMicTesting(false);
        setMicPhase("complete");
        void context?.close();
        stream.getTracks().forEach((track) => track.stop());
      }
    }
    if (generation !== runGeneration.current) return;
    add("voice", "critical", voiceDetected, voiceDetected ? t.voiceDetected : t.voiceNotDetected);
    await pauseForResult();
    if (generation !== runGeneration.current) return;
    setProgressDetail(t.soundDetail);
    setActiveAudioTest("output");
    if (!heardRef.current) {
      await new Promise<void>((resolve) => {
        soundConfirmationResolver.current = resolve;
      });
    }
    soundConfirmationResolver.current = null;
    if (generation !== runGeneration.current) return;
    setActiveAudioTest("progress");
    await pauseForResult();
    if (generation !== runGeneration.current) return;
    advance(45, t.progressNetwork);
    const ice = await gatherIce();
    if (generation !== runGeneration.current) return;
    const iceClassification = classifyIceResult(ice);
    r.push({ key: "ice", ...iceClassification, detail: ice.ok ? `${t.icePath}: ${ice.pathType === "relay" ? t.iceRelay : ice.pathType === "server-reflexive" ? t.iceServerReflexive : t.iceHost}` : t.iceFail });
    const latency = await measureSameOriginLatency();
    const latencyQuality = latency ? classifyLatencyQuality(latency.latency, latency.jitter) : null;
    if (latency) setLatencyMetrics({ ...latency, quality: latencyQuality! });
    r.push({ key: "latency", severity: "warning", state: latencyQuality === "good" ? "pass" : "warn", detail: latency ? `${t.latencyDetail}: ${latency.latency} ms · ${t.jitterDetail}: ${latency.jitter} ms (${latency.samples}/4)` : t.latencyUnavailable });
    setResults([...r]);
    await pauseForResult();
    if (generation !== runGeneration.current) return;
    advance(65, t.progressSip);
    const registered = isRegistered || await ensureRegistered().catch(() => false);
    if (generation !== runGeneration.current) return;
    add("sip", "critical", registered, registered ? t.sipDetail : t.sipFail);
    await pauseForResult();
    if (generation !== runGeneration.current) return;
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
    await pauseForResult();
    if (generation !== runGeneration.current) return;
    advance(94, t.progressFinishing);
    r.push({ key: "notifications", severity: "warning", state: typeof Notification !== "undefined" && Notification.permission === "granted" ? "pass" : "warn", detail: t.notificationsDetail });
    const networkType = String((navigator as any).connection?.type || "").toLowerCase();
    r.push({ key: "network", severity: "warning", state: "warn", detail: networkType === "ethernet" ? t.ethernetDetail : t.networkDetail });
    r.push({ key: "wakeLock", severity: "warning", state: wakeOk ? "pass" : "warn", detail: t.wakeDetail });
    const physicalInputs = devices.filter((d) => d.kind === "audioinput" && d.deviceId !== "default" && d.deviceId !== "communications");
    const physicalOutputs = devices.filter((d) => d.kind === "audiooutput" && d.deviceId !== "default" && d.deviceId !== "communications");
    const probablePair = physicalInputs.some((input) => physicalOutputs.some((output) => (input.groupId && input.groupId === output.groupId) || isProbableSameHeadset(input.label, output.label)));
    r.push({ key: "devices", severity: "warning", state: "warn", detail: probablePair ? t.devicesProbableMatch : physicalInputs.length > 1 || physicalOutputs.length > 1 ? t.devicesDetail : t.devicesSingleDetail });
    if (generation !== runGeneration.current) return;
    await pauseForResult();
    if (generation !== runGeneration.current) return;
    setProgress(100);
    setResults(r); setState(classify(r)); setRunCompleted(true); setRunning(false); setActiveAudioTest(null);
  }, [acquireWakeLock, ensureRegistered, isRegistered, t, userId]);
  useEffect(() => () => {
    runGeneration.current += 1;
    soundConfirmationResolver.current?.();
    soundConfirmationResolver.current = null;
    runAbort.current?.abort();
    wakeLockGeneration.current += 1;
    void wakeLock.current?.release?.();
    wakeLock.current = null;
  }, []);
  useEffect(() => {
    if (!open && !keepWakeLock) {
      runGeneration.current += 1;
      soundConfirmationResolver.current?.();
      soundConfirmationResolver.current = null;
      runAbort.current?.abort();
      setRunning(false);
      setProgress(0);
      setQuickMicStatus("idle");
      setQuickSpeakerStatus("idle");
      setQuickLatencyStatus("idle");
      setQuickLatencySamples([]);
      setActiveAudioTest(null);
      successSoundPlayed.current = false;
      wakeLockGeneration.current += 1;
      void wakeLock.current?.release?.();
      wakeLock.current = null;
    }
  }, [keepWakeLock, open]);
  useEffect(() => {
    runGeneration.current += 1;
    soundConfirmationResolver.current?.();
    soundConfirmationResolver.current = null;
    runAbort.current?.abort();
    setState("idle");
    setResults([]);
    setHeard(false);
    setSoundPlayed(false);
    setSoundError(false);
    setMicRms(0);
    setMicBands(Array(14).fill(0));
    setMicPhase("idle");
    setMicTesting(false);
    setLatencyMetrics(null);
    setQuickMicStatus("idle");
    setQuickSpeakerStatus("idle");
    setQuickLatencyStatus("idle");
    setQuickLatencySamples([]);
    setActiveAudioTest(null);
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
    heardRef.current = false;
    setSoundPlayed(false); setSoundError(false); setHeard(false); setQuickSpeakerStatus("pending");
    let ctx: AudioContext | undefined;
    try {
      ctx = new AudioContext();
      await ctx.resume();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.frequency.value = 660; gain.gain.value = 0.08; osc.connect(gain).connect(ctx.destination);
      osc.onended = () => { void ctx?.close(); };
      osc.start(); osc.stop(ctx.currentTime + .22);
      await new Promise((resolve) => window.setTimeout(resolve, 320));
      setSoundPlayed(true); setQuickSpeakerStatus("idle");
    } catch { setSoundError(true); setQuickSpeakerStatus("fail"); if (ctx) void ctx.close(); }
  };
  const playConfirmation = async () => {
    let ctx: AudioContext | undefined;
    try {
      ctx = new AudioContext(); await ctx.resume();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.42);
      const first = ctx.createOscillator(); const second = ctx.createOscillator();
      first.frequency.value = 660; second.frequency.value = 880;
      first.connect(gain); second.connect(gain); gain.connect(ctx.destination);
      second.onended = () => { void ctx?.close(); };
      first.start(); first.stop(ctx.currentTime + 0.2);
      second.start(ctx.currentTime + 0.16); second.stop(ctx.currentTime + 0.42);
    } catch { if (ctx) void ctx.close(); }
  };
  const runQuickMic = async () => {
    setActiveAudioTest("microphone");
    setQuickMicStatus("pending"); setMicTesting(true); setMicRms(0);
    let stream: MediaStream | undefined; let context: AudioContext | undefined; let frame: number | undefined; let detected = false; let voicedFrames = 0;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      context = new AudioContext();
      const analyser = context.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.72;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const frequencies = new Uint8Array(analyser.frequencyBinCount);
      let baselineTotal = 0; let baselineFrames = 0;
      setMicBands(Array(14).fill(0)); setMicPhase("calibrating");
      await new Promise<void>((resolve) => {
        const started = performance.now();
        const update = () => {
          analyser.getByteTimeDomainData(samples);
          analyser.getByteFrequencyData(frequencies);
          const level = rmsFromTimeDomain(samples);
          const elapsed = performance.now() - started;
          if (elapsed < 800) {
            baselineTotal += level;
            baselineFrames += 1;
          } else {
            const noiseFloor = baselineFrames ? baselineTotal / baselineFrames : 0.01;
            const threshold = Math.max(0.035, noiseFloor * 2.4 + 0.008);
            if (level >= threshold) voicedFrames += 1;
            detected ||= voicedFrames >= 24;
          }
          setMicRms(level);
          setMicPhase(elapsed < 800 ? "calibrating" : "listening");
          const bucketSize = Math.floor(frequencies.length / 28);
          setMicBands(Array.from({ length: 14 }, (_, index) => {
            let total = 0;
            for (let offset = 0; offset < bucketSize; offset += 1) total += frequencies[index * bucketSize + offset] || 0;
            return total / Math.max(1, bucketSize) / 255;
          }));
          if (elapsed >= 4000) { resolve(); return; }
          frame = requestAnimationFrame(update);
        };
        update();
      });
      const nextStatus = detected ? "pass" : "fail";
      setQuickMicStatus(nextStatus);
      if (runCompleted) setResults((current) => current.map((item) => item.key === "voice" ? { ...item, state: nextStatus, detail: detected ? t.voiceDetected : t.voiceNotDetected } : item));
    } catch {
      setQuickMicStatus("fail");
      if (runCompleted) setResults((current) => current.map((item) => item.key === "voice" ? { ...item, state: "fail", detail: t.voiceNotDetected } : item));
    }
    finally { if (frame) cancelAnimationFrame(frame); stream?.getTracks().forEach((track) => track.stop()); void context?.close(); setMicTesting(false); setMicPhase("complete"); }
  };
  const runQuickLatency = async () => {
    setActiveAudioTest("latency");
    setQuickLatencyStatus("pending"); setLatencyMetrics(null); setQuickLatencySamples([]);
    await new Promise((resolve) => window.setTimeout(resolve, 280));
    const latency = await measureSameOriginLatency(undefined, undefined, 8, 650, (sample) => {
      setQuickLatencySamples((current) => [...current, sample == null ? 0 : Math.round(sample)]);
    });
    if (!latency) { setQuickLatencyStatus("fail"); return; }
    const quality = classifyLatencyQuality(latency.latency, latency.jitter);
    setLatencyMetrics({ ...latency, quality }); setQuickLatencyStatus(quality === "good" ? "pass" : quality === "warning" ? "warn" : "fail");
  };
  const confirmSpeaker = async (confirmed: boolean) => {
    if (!confirmed) {
      heardRef.current = false;
      setHeard(false);
      setQuickSpeakerStatus("fail");
      setSoundError(false);
      setActiveAudioTest(null);
      soundConfirmationResolver.current?.();
      soundConfirmationResolver.current = null;
      return;
    }
    setHeard(false);
    setQuickSpeakerStatus("pending");
    await new Promise((resolve) => window.setTimeout(resolve, 480));
    heardRef.current = true;
    setHeard(true);
    setQuickSpeakerStatus("pass");
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    setActiveAudioTest(null);
    soundConfirmationResolver.current?.();
    soundConfirmationResolver.current = null;
  };
  const requestNotifications = async () => {
    if (typeof Notification === "undefined") return;
    let permission: NotificationPermission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    setResults((current) => current.map((item) => item.key === "notifications"
      ? { ...item, state: permission === "granted" ? "pass" : "warn", detail: permission === "granted" ? t.notificationsEnabled : permission === "denied" ? t.notificationsDenied : t.notificationsDetail }
      : item));
  };
  const finalResults = useMemo(() => [...results, { key: "sound" as const, severity: "critical" as const, state: soundError || quickSpeakerStatus === "fail" ? "fail" as const : heard ? "pass" as const : "pending" as const, detail: soundError ? t.soundFail : quickSpeakerStatus === "fail" ? t.quickSpeakerFailed : t.soundDetail }], [heard, quickSpeakerStatus, results, soundError, t.quickSpeakerFailed, t.soundDetail, t.soundFail]);
  const diagnosticsComplete = isCompletePulseReadinessRun(results);
  const quickSpeakerPassed = hasValidReadiness && !runCompleted && quickSpeakerStatus === "pass" && heard && !soundError;
  const quickChecksPassed = hasValidReadiness && !runCompleted && quickMicStatus === "pass" && quickSpeakerPassed && quickLatencyStatus === "pass";
  const finalState = quickChecksPassed ? "ready" : runCompleted && quickSpeakerStatus === "fail" ? "blocked" : diagnosticsComplete && heard ? classify(finalResults) : (state === "blocked" ? "blocked" : "checking");
  const labels: Record<string, string> = Object.fromEntries(["browser","secure","online","microphone","input","output","voice","sound","ice","sip","m365Account","notifications","network","latency","wakeLock","devices"].map((k) => [k, t[k as keyof typeof t] as string]));
  const mainResults = finalResults.filter((item) => !["network", "devices", "latency", "microphone", "input", "output", "voice", "sound"].includes(item.key));
  const advisoryResults = finalResults.filter((item) => item.key === "network" || item.key === "devices");
  const failedAudioResults = runCompleted
    ? finalResults.filter((item) => ["microphone", "input", "output", "voice", "sound"].includes(item.key) && item.state === "fail")
    : [];
  const statusText = finalState === "ready" ? t.ready : finalState === "warning" ? t.warning : finalState === "blocked" ? t.blocked : t.working;
  const canContinue = quickChecksPassed || (runCompleted && diagnosticsComplete && heard && !hasCriticalFailure(finalResults) && (finalState === "ready" || finalState === "warning"));
  const latencyResult = results.find((item) => item.key === "latency");
  const latencyVerdict = !latencyMetrics ? null : latencyMetrics.quality === "good"
    ? { label: t.latencyGood || t.ready, tone: "text-emerald-700 dark:text-emerald-300", icon: "✓", panel: "border-emerald-500/25 bg-emerald-500/[0.055]" }
    : latencyMetrics.quality === "warning"
      ? { label: t.latencyWarning || t.warning, tone: "text-amber-700 dark:text-amber-300", icon: "!", panel: "border-amber-500/30 bg-amber-500/[0.065]" }
      : { label: t.latencyPoor || t.blocked, tone: "text-destructive", icon: "×", panel: "border-destructive/35 bg-destructive/[0.055]" };
  const phaseItems = [
    { at: 15, label: t.progressEnvironment },
    { at: 28, label: t.progressAudio },
    { at: 45, label: t.progressNetwork },
    { at: 65, label: t.progressSip },
    { at: 80, label: t.progressM365 },
    { at: 94, label: t.progressFinishing },
  ];
  const inputResult = finalResults.find((item) => item.key === "microphone");
  const voiceResult = finalResults.find((item) => item.key === "voice");
  const inputDevicesResult = finalResults.find((item) => item.key === "input");
  const outputResult = finalResults.find((item) => item.key === "output");
  const acknowledge = () => {
    if (!canContinue) return;
    onReady();
  };
  useEffect(() => {
    if (!open) { successSoundPlayed.current = false; return; }
    if ((quickChecksPassed || (runCompleted && (finalState === "ready" || finalState === "warning"))) && !successSoundPlayed.current) {
      successSoundPlayed.current = true;
      void playConfirmation();
    }
  }, [finalState, open, quickChecksPassed, runCompleted]);
  return <Dialog open={open} onOpenChange={(v) => !required && !v && onClose()}>
     <DialogContent hideCloseButton={required} className="max-w-2xl max-h-[92dvh] overflow-y-auto border-primary/15 bg-background/95 p-0 shadow-2xl shadow-primary/10 backdrop-blur" data-testid="nexus-pulse-dialog">
       <div className="relative overflow-hidden rounded-[inherit]">
         <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
         <div className="pointer-events-none absolute -left-20 top-24 h-32 w-32 rounded-full bg-amber-300/10 blur-3xl" />
         <div className="relative space-y-5 p-5 sm:p-7">
            <DialogHeader><DialogTitle className="flex items-center gap-3 text-xl tracking-tight"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15"><ShieldCheck className="h-5 w-5" /></span><span>{t.title}</span></DialogTitle><DialogDescription className="pl-13">{t.subtitle}</DialogDescription></DialogHeader>
            <div className="flex items-center justify-between rounded-2xl border border-primary/15 bg-primary/[0.06] p-4 transition-colors" aria-live="polite"><div><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary/70">NEXUS Pulse</div><span className="font-semibold">{statusText}</span></div><Badge className="rounded-full px-3 py-1" variant={finalState === "blocked" ? "destructive" : finalState === "ready" ? "default" : "secondary"}>{statusText}</Badge></div>
              {hasValidReadiness && state === "idle" && !runCompleted && <section className="rounded-2xl border border-primary/20 bg-primary/[0.045] p-4" aria-labelledby="pulse-quick-title">
                <div className="mb-3 flex items-start justify-between gap-3"><div><h2 id="pulse-quick-title" className="text-sm font-semibold">{t.quickChecksTitle}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.quickChecksDetail}</p></div><Badge variant="outline" className="shrink-0 border-primary/25 text-primary">{t.advisoryBadge}</Badge></div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { key:"mic", label:t.microphone, status:quickMicStatus, pending:t.quickMicPending, pass:t.quickMicPassed, fail:t.quickMicFailed, action:t.quickMicRun, icon:<Mic className="h-4 w-4" />, onClick:runQuickMic },
                    { key:"speaker", label:t.output, status:quickSpeakerStatus, pending:t.quickSpeakerPending, pass:t.quickSpeakerPassed, fail:t.quickSpeakerFailed, action:t.quickSpeakerRun, icon:<Play className="h-4 w-4 fill-current" />, onClick:() => setActiveAudioTest("output") },
                    { key:"latency", label:t.latency, status:quickLatencyStatus, pending:t.quickLatencyPending, pass:t.quickLatencyPassed, fail:quickLatencyStatus === "warn" ? t.quickLatencyWarning : t.quickLatencyFailed, action:t.quickLatencyRun, icon:<Signal className="h-4 w-4" />, onClick:() => void runQuickLatency() },
                  ].map((check) => <div key={check.key} className={`rounded-xl border p-3 transition-colors ${check.status === "pass" ? "border-emerald-500/30 bg-emerald-500/[0.06]" : check.status === "fail" ? "border-destructive/30 bg-destructive/[0.05]" : check.status === "warn" ? "border-amber-500/30 bg-amber-500/[0.06]" : "border-border/70 bg-card/50"}`}>
                    <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{check.label}</span>{check.status === "pending" ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : check.status === "pass" ? <CheckCircle2 className="h-4 w-4 text-emerald-600 motion-safe:animate-pulse" /> : check.status === "fail" ? <AlertTriangle className="h-4 w-4 text-destructive" /> : check.status === "warn" ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <CircleDot className="h-4 w-4 text-muted-foreground" />}</div>
                    <p className="mt-2 min-h-8 text-[11px] leading-relaxed text-muted-foreground">{check.status === "pending" ? check.pending : check.status === "pass" ? check.pass : check.status === "fail" || check.status === "warn" ? check.fail : t.quickChecksDetail}</p>
                    <Button variant={check.status === "pass" ? "outline" : "default"} size="sm" className={`mt-3 h-9 w-full justify-center rounded-lg px-3 text-xs font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${check.status === "pass" ? "border-emerald-500/35 bg-emerald-500/[0.07] text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-800" : ""}`} disabled={check.status === "pending"} onClick={check.onClick}>{check.status === "pending" ? <Loader2 className="h-4 w-4 animate-spin" /> : check.icon}{check.action}</Button>
                  </div>)}
                </div>
                <p className={`mt-3 text-xs font-medium ${quickChecksPassed ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>{quickChecksPassed ? t.deepCheckNotRequired : t.deepCheckRequired}</p>
              </section>}
              {(quickChecksPassed || (runCompleted && (finalState === "ready" || finalState === "warning"))) && <section className="pulse-ready-treatment rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.055] p-5 text-center" aria-live="polite">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/25 motion-safe:animate-pulse"><CheckCircle2 className="h-6 w-6" /></div>
                 <div className="mx-auto mt-3 flex w-fit items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,.8)] motion-safe:animate-pulse" /><h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">{finalState === "warning" ? t.warning : t.callingReadyTitle}</h2></div>
                 <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-emerald-800/75 dark:text-emerald-100/75">{finalState === "warning" ? t.callingReadyWarningDetail : t.callingReadyDetail}</p>
                <p className="mt-2 text-xs text-emerald-800/65 dark:text-emerald-100/65">{t.confirmationSound}</p>
              </section>}
              {failedAudioResults.length > 0 && <section className="rounded-2xl border-2 border-destructive/35 bg-destructive/[0.06] p-4 shadow-sm" aria-live="assertive" aria-label={t.blocked}>
                <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/12 text-destructive"><AlertTriangle className="h-5 w-5" /></span><div><h2 className="font-bold text-destructive">{t.blocked}</h2><p className="mt-0.5 text-xs text-muted-foreground">{t.deepCheckRequired}</p></div></div>
                <div className="mt-4 space-y-2">{failedAudioResults.map((item) => <div key={item.key} className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-background/75 p-3"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"><X className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><div className="text-sm font-bold text-destructive">{labels[item.key]}</div><div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.detail || (item.key === "sound" ? t.quickSpeakerFailed : t.voiceNotDetected)}</div></div></div>)}</div>
                <div className="mt-3 flex flex-wrap gap-2">{failedAudioResults.some((item) => ["microphone", "input", "voice"].includes(item.key)) && <Button size="sm" variant="outline" className="rounded-lg border-destructive/25" onClick={() => void runQuickMic()}><Mic className="h-4 w-4" />{t.quickMicRun}</Button>}{failedAudioResults.some((item) => ["output", "sound"].includes(item.key)) && <Button size="sm" variant="outline" className="rounded-lg border-destructive/25" onClick={() => setActiveAudioTest("output")}><Headphones className="h-4 w-4" />{t.quickSpeakerRun}</Button>}</div>
              </section>}
             {running && <section className="overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.10] via-primary/[0.04] to-background p-4 shadow-sm" aria-live="polite" aria-label={t.progressTitle}>
              <div className="mb-3 flex items-center justify-between gap-4">
                 <div className="flex min-w-0 items-center gap-3"><span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><span className="absolute inset-0 animate-ping rounded-xl bg-primary/10" /><Loader2 className="relative h-4 w-4 animate-spin" /></span><div className="min-w-0"><div className="text-sm font-semibold">{t.progressTitle}</div><div className="truncate text-xs text-muted-foreground">{progressDetail}</div></div></div>
                <span className="tabular-nums text-sm font-bold text-primary">{progress}%</span>
              </div>
               <Progress value={progress} className="h-2.5 bg-primary/10 [&>div]:transition-all [&>div]:duration-500" />
                <div className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-3" aria-label={t.progressTitle}>{phaseItems.map((phase, index) => {
                  const complete = progress > phase.at + 8;
                  const active = progress >= phase.at && !complete;
                  return <div key={phase.at} className={`flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] transition-colors ${active ? "bg-primary/15 font-semibold text-primary" : complete ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "text-muted-foreground/65"}`}>
                    {active ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : complete ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-40" />}<span className="truncate">{phase.label.replace(/…$/, "")}</span>
                  </div>;
                })}</div>
               {micTesting && <div className="mt-3"><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{t.voiceTesting}</span><span>{Math.round(micRms * 100)}%</span></div><Progress value={Math.min(micRms * 1200, 100)} className="h-2 bg-emerald-500/15 [&>div]:bg-emerald-500" /></div>}
            </section>}
              <div className="grid gap-2 sm:grid-cols-2" aria-live="polite">{mainResults.map((item, index) => <div key={item.key} className={`animate-in fade-in slide-in-from-bottom-1 flex gap-3 rounded-xl border p-3 transition-colors ${item.key === "notifications" || item.key === "m365Account" ? "sm:col-span-2" : ""} ${item.state === "pass" ? "border-emerald-500/20 bg-emerald-500/[0.035]" : item.key === "m365Account" && item.state === "fail" ? "border-destructive/40 bg-destructive/[0.06]" : "border-border/70 bg-card/60 hover:border-primary/25"}`} style={{ animationDelay: `${Math.min(index * 35, 350)}ms` }}><div className="mt-0.5">{item.key === "m365Account" && item.state === "pass" ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15"><MailCheck className="h-3.5 w-3.5 text-emerald-600" /></span> : item.state === "pass" ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15"><Check className="h-3.5 w-3.5 text-emerald-600" /></span> : item.state === "fail" ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/10"><AlertTriangle className="h-3.5 w-3.5 text-destructive" /></span> : <CircleDot className="h-4 w-4 text-amber-600" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-sm font-medium">{labels[item.key]}</div>{item.key === "notifications" && item.state !== "pass" && typeof Notification !== "undefined" && Notification.permission === "default" && <Button variant="outline" size="sm" className="rounded-lg border-primary/30 text-primary" onClick={() => void requestNotifications()} data-testid="button-pulse-notifications"><Bell className="h-4 w-4" />{t.notificationsEnable}</Button>}</div>{item.detail && <div className={`text-xs leading-relaxed ${item.key === "m365Account" && item.state === "fail" ? "font-medium text-destructive" : "text-muted-foreground"}`}>{item.detail}</div>}{item.key === "notifications" && item.state !== "pass" && typeof Notification === "undefined" && <div className="text-xs leading-relaxed text-amber-700">{t.notificationsUnsupported}</div>}{item.key === "notifications" && item.state !== "pass" && typeof Notification !== "undefined" && Notification.permission === "default" && <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.notificationsPrompt}</div>}</div></div>)}</div>
             {advisoryResults.length > 0 && <section className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-4" aria-label={t.advisoryTitle}><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-100"><AlertTriangle className="h-4 w-4 text-amber-600" />{t.advisoryTitle}</div><Badge variant="outline" className="border-amber-500/40 bg-background/50 text-amber-800 dark:text-amber-200">{t.advisoryBadge}</Badge></div><div className="grid gap-3 sm:grid-cols-2">{advisoryResults.map((item) => <div key={item.key} className="rounded-xl border border-amber-500/20 bg-background/70 p-3"><div className="flex items-center gap-2 text-sm font-medium">{item.key === "network" || item.key === "latency" ? <Wifi className="h-4 w-4 text-amber-600" /> : <AudioLines className="h-4 w-4 text-amber-600" />}{labels[item.key]}</div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.detail}</p><p className="mt-2 text-xs font-medium leading-relaxed text-foreground">{item.key === "network" || item.key === "latency" ? t.networkAction : t.devicesAction}</p></div>)}</div></section>}
             {latencyResult && <section className={`rounded-2xl border p-4 ${latencyVerdict?.panel || "border-sky-500/20 bg-sky-500/[0.045]"}`} aria-label={t.latency}><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 font-semibold"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300"><Signal className="h-4 w-4" /></span>{t.latency}</div>{latencyVerdict && <span className={`flex items-center gap-1.5 text-xs font-bold ${latencyVerdict.tone}`}><span className="flex h-5 w-5 items-center justify-center rounded-full border-current/30 bg-current/10">{latencyVerdict.icon}</span>{latencyVerdict.label}</span>}</div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-background/65 p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.latencyDetail}</div><div className="mt-1 font-mono text-xl font-bold">{latencyMetrics ? `${latencyMetrics.latency} ms` : "—"}</div></div><div className="rounded-xl bg-background/65 p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.jitterDetail}</div><div className="mt-1 font-mono text-xl font-bold">{latencyMetrics ? `${latencyMetrics.jitter} ms` : "—"}</div></div></div><p className="mt-3 text-xs leading-relaxed text-muted-foreground">{latencyResult.detail || t.latencyUnavailable}</p><p className="mt-2 text-xs font-medium leading-relaxed text-foreground">{t.networkAction}</p></section>}
               <div className="flex flex-col-reverse gap-2 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-end">{required && onExit && <Button variant="ghost" className="mr-auto justify-start gap-2 text-muted-foreground hover:text-foreground" onClick={onExit} data-testid="button-pulse-return"><ArrowLeft className="h-4 w-4" />{t.returnToIndexus}</Button>}<Button variant="outline" className="rounded-xl" onClick={() => void run()} disabled={running} data-testid="button-pulse-retry">{running ? t.working : state === "idle" ? t.start : t.retry}</Button><Button className="rounded-xl" onClick={acknowledge} disabled={!canContinue} data-testid="button-pulse-continue">{t.continue}</Button></div>
               {activeAudioTest && <div className="fixed inset-0 z-[10030] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-label={activeAudioTest === "microphone" ? t.voice : t.sound}>
                 <div className={`relative w-full max-w-md overflow-hidden rounded-3xl border bg-background p-6 text-center shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-3 duration-300 ${activeAudioTest === "output" ? "border-amber-500/45 shadow-amber-500/20" : "border-primary/40 shadow-primary/20"}`}>
                   <div className={`pointer-events-none absolute inset-x-8 top-0 h-24 rounded-full blur-3xl ${activeAudioTest === "microphone" ? "bg-primary/20" : "bg-amber-400/20"}`} />
                   {!running && <button type="button" className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={() => setActiveAudioTest(null)} aria-label={t.close}><X className="h-5 w-5" /></button>}
                   {activeAudioTest === "browser" ? <>
                     <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg shadow-sky-500/30"><span className="absolute inset-0 rounded-full bg-sky-400/35 motion-safe:animate-ping" /><Globe2 className="relative h-9 w-9" /></div>
                     <h2 className="relative mt-5 text-2xl font-bold">{t.browser}</h2>
                     <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.progressEnvironment}</p>
                     <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-sky-500/[0.08] p-4 font-semibold text-sky-700 dark:text-sky-300"><Loader2 className="h-5 w-5 animate-spin" />{t.working}</div>
                   </> : activeAudioTest === "microphone" ? <>
                     <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30"><span className="absolute inset-0 rounded-full bg-primary/30 motion-safe:animate-ping" /><Mic className="relative h-9 w-9" /></div>
                     <h2 className="relative mt-5 text-2xl font-bold">{t.voice}</h2>
                     <p className={`mt-3 rounded-xl px-4 py-3 text-sm font-semibold leading-relaxed ${micPhase === "listening" ? "bg-primary/10 text-primary" : "bg-muted/60 text-muted-foreground"}`}>{micTesting ? micPhase === "calibrating" ? t.micCalibrating || t.voiceTesting : t.micSpeakNow || t.voiceTesting : quickMicStatus === "pass" || voiceResult?.state === "pass" ? t.quickMicPassed : quickMicStatus === "fail" || voiceResult?.state === "fail" ? t.voiceNotDetected : t.micDetail}</p>
                     <div className="relative mx-auto mt-5 flex h-32 items-center justify-center gap-1 overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-b from-primary/[0.08] via-background to-primary/[0.04] px-4" aria-label={t.voiceTesting}><div className="absolute inset-x-4 top-1/2 border-t border-dashed border-primary/15" />{micBands.map((level, i) => <span key={i} className={`relative w-2.5 rounded-full transition-[height,background-color] duration-75 ${quickMicStatus === "pass" || voiceResult?.state === "pass" ? "bg-emerald-500" : micPhase === "calibrating" ? "bg-sky-400" : "bg-primary"}`} style={{ height: `${Math.max(6, Math.min(112, 6 + level * 150))}px`, opacity: micTesting ? 0.72 + level * 0.28 : 0.35 }} />)}{micTesting && <span className="absolute bottom-2 right-3 rounded-full bg-background/85 px-2 py-1 text-[10px] font-bold tabular-nums text-primary shadow-sm">{Math.round(micRms * 1000)}</span>}</div>
                     {(quickMicStatus === "pass" || voiceResult?.state === "pass") && <div className="mt-3 flex items-center justify-center gap-2 font-semibold text-emerald-600 animate-in zoom-in-75"><CheckCircle2 className="h-6 w-6" />{t.quickMicPassed}</div>}
                     {(quickMicStatus === "fail" || voiceResult?.state === "fail") && !running && <Button className="mt-5 w-full rounded-xl" onClick={() => void runQuickMic()}><Mic className="h-4 w-4" />{t.quickMicRun}</Button>}
                   </> : activeAudioTest === "output" ? <>
                     <div className={`relative mx-auto flex h-20 w-20 items-center justify-center rounded-full shadow-lg ${heard ? "bg-emerald-500 text-white shadow-emerald-500/30" : "bg-amber-500 text-white shadow-amber-500/30"}`}>{!heard && <span className="absolute inset-0 rounded-full bg-amber-400/35 motion-safe:animate-ping" />}{heard ? <CheckCircle2 className="relative h-9 w-9" /> : <Headphones className="relative h-9 w-9" />}</div>
                     <h2 className="relative mt-5 text-2xl font-bold">{t.output}</h2>
                     <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{heard ? t.quickSpeakerPassed : soundPlayed ? t.soundPlayed : t.soundDetail}</p>
                     {!heard && <div className="mt-6 space-y-3">
                       <Button size="lg" className="h-12 w-full rounded-xl bg-amber-500 font-bold text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600" onClick={() => void play()} disabled={quickSpeakerStatus === "pending"}>{quickSpeakerStatus === "pending" && !soundPlayed ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-current" />}{t.play}</Button>
                       {soundPlayed && !soundError && <div className="rounded-xl border border-border/70 bg-muted/35 p-3"><div className="mb-2 text-[11px] font-semibold text-muted-foreground">{t.soundConfirmHint}</div><div className="flex flex-col gap-2 sm:flex-row sm:justify-center"><Button size="sm" variant="outline" className="h-10 rounded-lg border-destructive/25 px-4 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={quickSpeakerStatus === "pending"} onClick={() => void confirmSpeaker(false)}><X className="h-4 w-4" />{t.didNotHear || t.quickSpeakerFailed}</Button><Button size="sm" className="h-10 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-emerald-700" disabled={quickSpeakerStatus === "pending"} onClick={() => void confirmSpeaker(true)}><CheckCircle2 className="h-4 w-4" />{quickSpeakerStatus === "pending" ? t.quickSpeakerPending : t.heard}</Button></div></div>}
                     </div>}
                     {heard && <div className="mt-5 flex items-center justify-center gap-2 font-semibold text-emerald-600 animate-in zoom-in-75"><CheckCircle2 className="h-6 w-6" />{t.quickSpeakerPassed}</div>}
                   </> : activeAudioTest === "latency" ? <>
                     <div className={`relative mx-auto flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg ${quickLatencyStatus === "pass" ? "bg-emerald-500 shadow-emerald-500/30" : quickLatencyStatus === "warn" ? "bg-amber-500 shadow-amber-500/30" : quickLatencyStatus === "fail" ? "bg-destructive shadow-destructive/30" : "bg-sky-500 shadow-sky-500/30"}`}><Signal className="relative h-9 w-9" /></div>
                     <h2 className="relative mt-5 text-2xl font-bold">{t.latency}</h2>
                     <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{quickLatencyStatus === "pending" ? t.quickLatencyPending : quickLatencyStatus === "pass" ? t.quickLatencyPassed : quickLatencyStatus === "warn" ? t.quickLatencyWarning : t.quickLatencyFailed}</p>
                     <div className="relative mx-auto mt-7 h-32 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-b from-sky-500/[0.08] to-transparent p-3" aria-label={t.quickLatencyPending}><div className="absolute inset-x-3 bottom-3 border-t border-dashed border-sky-500/20" /><div className="flex h-full items-end gap-1.5">{Array.from({ length: 8 }, (_, index) => { const sample = quickLatencySamples[index]; const height = sample == null ? 8 : Math.max(14, Math.min(100, sample / 3)); return <div key={index} className="flex h-full flex-1 items-end"><span className={`w-full rounded-t-md transition-all duration-500 ${sample == null ? "bg-sky-500/15" : quickLatencyStatus === "fail" ? "bg-destructive" : quickLatencyStatus === "warn" ? "bg-amber-500" : "bg-sky-500"}`} style={{ height: `${height}%` }}>{sample != null && <span className="sr-only">{sample} ms</span>}</span></div>; })}</div>{quickLatencyStatus === "pending" && <div className="absolute inset-x-0 top-0 h-0.5 bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,.9)] motion-safe:animate-pulse" />}<div className="absolute bottom-1 right-3 text-[10px] font-bold tabular-nums text-sky-700 dark:text-sky-300">{quickLatencySamples.length}/8</div></div>
                     {latencyMetrics && <div className="mt-6 grid grid-cols-2 gap-2"><div className="rounded-xl bg-muted/60 p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.latencyDetail}</div><div className="mt-1 font-mono text-xl font-bold">{latencyMetrics.latency} ms</div></div><div className="rounded-xl bg-muted/60 p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.jitterDetail}</div><div className="mt-1 font-mono text-xl font-bold">{latencyMetrics.jitter} ms</div></div></div>}
                   </> : <>
                     <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30"><span className="absolute inset-0 rounded-full bg-primary/30 motion-safe:animate-ping" /><Loader2 className="relative h-9 w-9 animate-spin" /></div>
                     <h2 className="relative mt-5 text-2xl font-bold">{t.progressTitle}</h2>
                     <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{progressDetail}</p>
                     <Progress value={progress} className="mt-6 h-3 bg-primary/10 [&>div]:transition-all [&>div]:duration-500" />
                     <div className="mt-5 space-y-2 text-left">{phaseItems.map((phase) => { const complete = progress > phase.at + 8; const active = progress >= phase.at && !complete; return <div key={phase.at} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${active ? "border-primary/30 bg-primary/[0.08] font-semibold text-primary" : complete ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300" : "border-border/60 text-muted-foreground"}`}>{active ? <Loader2 className="h-4 w-4 animate-spin" /> : complete ? <CheckCircle2 className="h-4 w-4" /> : <CircleDot className="h-4 w-4 opacity-50" />}<span>{phase.label.replace(/…$/, "")}</span></div>; })}</div>
                   </>}
                 </div>
               </div>}
         </div>
       </div>
    </DialogContent>
  </Dialog>;
}