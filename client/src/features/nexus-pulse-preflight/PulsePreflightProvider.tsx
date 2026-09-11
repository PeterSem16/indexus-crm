import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Activity, ArrowLeft, ArrowRight, Clock3, HeartPulse, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/contexts/permissions-context";
import { useSip } from "@/contexts/sip-context";
import { useCall } from "@/contexts/call-context";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { PulseDiagnostics } from "./PulseDiagnostics";
import { audioDeviceSnapshotsEqual, isPulseReadinessEnvironmentValid, isPulseSessionProtected, normalizeAudioDeviceSnapshot, parseAudioDeviceSnapshot, pulseAudioDeviceBaselineStorageKey, pulseReadinessStorageKey, shouldPresentDeferredRecheck, shouldRetainStoredReadiness } from "./diagnostics";
import { isPulseRecordingPlaybackActive } from "./recording-playback";
import { pulseCopy } from "./translations";

type Props = { children: ReactNode };
type Status = "checking" | "ready" | "warning" | "blocked";

function userKey(user: any) { return String(user?.id ?? user?.userId ?? user?.username ?? "unknown"); }

function readStoredReadiness(key: string, workProtected = false) {
  const hasStoredReadiness = !!sessionStorage.getItem(key);
  if (shouldRetainStoredReadiness(hasStoredReadiness, isPulseReadinessEnvironmentValid(), workProtected)) return true;
  if (!hasStoredReadiness) return false;
  sessionStorage.removeItem(key);
  return false;
}

async function readAudioDeviceSnapshot() {
  const enumerate = navigator.mediaDevices?.enumerateDevices;
  if (!enumerate) return null;
  try {
    return normalizeAudioDeviceSnapshot(await enumerate.call(navigator.mediaDevices));
  } catch {
    // Device enumeration can fail transiently while permissions or a call are changing.
    // Never interpret that as a device change.
    return null;
  }
}

export function PulseGate({ children }: Props) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { locale } = useI18n();
  const copy = pulseCopy(locale);
  const { toast } = useToast();
  const { callState } = useCall();
  const { canAccessModule, isLoading } = usePermissions();
  const allowed = !!user && !isLoading && canAccessModule("nexusPulse");
  const key = pulseReadinessStorageKey(userKey(user));
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("checking");
  const [acknowledged, setAcknowledged] = useState(() => readStoredReadiness(key));
  const hasEnteredPulseRef = useRef(acknowledged);
  const [afterCallWorkActive, setAfterCallWorkActive] = useState(false);
  const [recordingPlaybackActive, setRecordingPlaybackActive] = useState(isPulseRecordingPlaybackActive);
  const [showDeferredRecheckIntro, setShowDeferredRecheckIntro] = useState(false);
  const [autoStartDeferredRecheckRequest, setAutoStartDeferredRecheckRequest] = useState(0);
  const ready = allowed && acknowledged;
  const workProtected = isPulseSessionProtected(callState) || afterCallWorkActive || recordingPlaybackActive;
  const diagnosticsBlocked = workProtected;
  const workProtectedRef = useRef(workProtected);
  const deferredInvalidation = useRef(false);
  const deferredInvalidationReasons = useRef(new Set<string>());
  const deferredMediaEpisodeRef = useRef<string | null>(null);
  const validatedMediaEpisodeRef = useRef<string | null>(null);
  const deferredNoticeShown = useRef(false);
  const suppressRequiredOpenRef = useRef(false);
  useLayoutEffect(() => {
    workProtectedRef.current = workProtected;
  }, [workProtected]);
  const { isRegistered } = useSip();
  const isRegisteredRef = useRef(isRegistered);
  useLayoutEffect(() => {
    isRegisteredRef.current = isRegistered;
  }, [isRegistered]);
  useEffect(() => {
    sessionStorage.removeItem(key.replace("nexus-pulse-ready-v2:", "nexus-pulse-ready:"));
  }, [key]);
  const invalidateNow = useCallback(() => {
    suppressRequiredOpenRef.current = false;
    deferredInvalidation.current = false;
    deferredInvalidationReasons.current.clear();
    deferredMediaEpisodeRef.current = null;
    validatedMediaEpisodeRef.current = null;
    deferredNoticeShown.current = false;
    sessionStorage.removeItem(key);
    setAcknowledged(false);
    setStatus("blocked");
    setOpen(true);
    window.dispatchEvent(new Event("nexus-pulse-invalidated"));
  }, [key]);
  const presentDeferredRecheck = useCallback(() => {
    suppressRequiredOpenRef.current = false;
    deferredInvalidation.current = false;
    deferredInvalidationReasons.current.clear();
    deferredMediaEpisodeRef.current = null;
    validatedMediaEpisodeRef.current = null;
    deferredNoticeShown.current = false;
    sessionStorage.removeItem(key);
    setAcknowledged(false);
    setStatus("blocked");
    setOpen(false);
    setShowDeferredRecheckIntro(true);
    window.dispatchEvent(new Event("nexus-pulse-invalidated"));
  }, [key]);
  const requestInvalidation = useCallback((reason = "environment") => {
    if (workProtectedRef.current) {
      deferredInvalidation.current = true;
      deferredInvalidationReasons.current.add(reason);
      setStatus("warning");
      window.dispatchEvent(new Event("nexus-pulse-recheck-deferred"));
      if (!deferredNoticeShown.current) {
        deferredNoticeShown.current = true;
        toast({
          title: copy.recheckDeferredTitle,
          description: (
            <div className="space-y-3">
              <p className="leading-relaxed text-foreground/80">{copy.recheckDeferredDetail}</p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {copy.recheckDeferredCallSafe}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  {copy.recheckDeferredNext}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-amber-500/15">
                <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-emerald-500 via-sky-500 to-amber-500 motion-safe:animate-pulse" />
              </div>
            </div>
          ),
          duration: 12_000,
          className: "border-amber-300/70 bg-gradient-to-br from-background via-background to-amber-50/95 shadow-2xl shadow-amber-950/20 dark:border-amber-700/60 dark:to-amber-950/50",
        });
      }
      return;
    }
    invalidateNow();
  }, [copy.recheckDeferredCallSafe, copy.recheckDeferredDetail, copy.recheckDeferredNext, copy.recheckDeferredTitle, invalidateNow, toast]);
  useEffect(() => {
    if (!allowed || !acknowledged || isRegistered) return;
    setStatus("warning");
    const timer = window.setTimeout(() => {
      if (!isRegisteredRef.current) requestInvalidation("registration");
    }, 14000);
    return () => window.clearTimeout(timer);
  }, [allowed, acknowledged, isRegistered, requestInvalidation]);
  useEffect(() => {
    if (
      !isRegistered ||
      !deferredInvalidation.current ||
      !validatedMediaEpisodeRef.current ||
      deferredMediaEpisodeRef.current !== validatedMediaEpisodeRef.current
    ) return;
    deferredInvalidationReasons.current.delete("registration");
    if (deferredInvalidationReasons.current.size > 0) return;
    deferredInvalidation.current = false;
    deferredMediaEpisodeRef.current = null;
    validatedMediaEpisodeRef.current = null;
    deferredNoticeShown.current = false;
    const storedReady = readStoredReadiness(key);
    setAcknowledged(storedReady);
    setStatus(storedReady ? "ready" : "blocked");
    if (storedReady) window.dispatchEvent(new Event("nexus-pulse-ready"));
  }, [isRegistered, key]);
  useEffect(() => {
    if (!shouldPresentDeferredRecheck(workProtected, deferredInvalidation.current)) return;
    const timer = window.setTimeout(() => {
      if (!shouldPresentDeferredRecheck(workProtectedRef.current, deferredInvalidation.current)) return;
      deferredInvalidation.current = false;
      deferredInvalidationReasons.current.clear();
      deferredMediaEpisodeRef.current = null;
      validatedMediaEpisodeRef.current = null;
      deferredNoticeShown.current = false;
      presentDeferredRecheck();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [presentDeferredRecheck, workProtected]);
  useEffect(() => {
    const openFromHeader = () => {
      if (!workProtectedRef.current) setOpen(true);
    };
    const sync = () => {
      if (!workProtectedRef.current) {
        const storedReady = readStoredReadiness(key);
        if (storedReady) hasEnteredPulseRef.current = true;
        setAcknowledged(storedReady);
      }
    };
    sync();
    window.addEventListener("nexus-pulse-open", openFromHeader);
    window.addEventListener("nexus-pulse-ready", sync);
    return () => { window.removeEventListener("nexus-pulse-open", openFromHeader); window.removeEventListener("nexus-pulse-ready", sync); };
  }, [key]);
  useEffect(() => {
    const updateWorkProtection = (event: Event) => {
      const protectedByWorkspace = !!(event as CustomEvent<{ protected?: boolean }>).detail?.protected;
      workProtectedRef.current = isPulseSessionProtected(callState) || protectedByWorkspace || recordingPlaybackActive;
      setAfterCallWorkActive(protectedByWorkspace);
    };
    window.addEventListener("nexus-pulse-work-protection", updateWorkProtection);
    return () => window.removeEventListener("nexus-pulse-work-protection", updateWorkProtection);
  }, [callState, recordingPlaybackActive]);
  useEffect(() => {
    const updateRecordingProtection = (event: Event) => {
      const active = !!(event as CustomEvent<{ active?: boolean }>).detail?.active;
      workProtectedRef.current = isPulseSessionProtected(callState) || afterCallWorkActive || active;
      setRecordingPlaybackActive(active);
    };
    window.addEventListener("nexus-pulse-recording-playback", updateRecordingProtection);
    return () => window.removeEventListener("nexus-pulse-recording-playback", updateRecordingProtection);
  }, [afterCallWorkActive, callState]);
  useEffect(() => {
    if (allowed && !ready && !workProtected && !showDeferredRecheckIntro && !suppressRequiredOpenRef.current) setOpen(true);
  }, [allowed, ready, showDeferredRecheckIntro, workProtected]);
  useEffect(() => {
    if (!allowed) return;
    const offline = () => {
      if (!workProtectedRef.current) requestInvalidation("network");
    };
    let deviceCheckInFlight = false;
    const checkAudioDevices = async () => {
      if (deviceCheckInFlight) return;
      const baseline = parseAudioDeviceSnapshot(sessionStorage.getItem(pulseAudioDeviceBaselineStorageKey(userKey(user))));
      // A baseline is deliberately absent until a complete readiness run succeeds.
      if (!baseline) return;
      deviceCheckInFlight = true;
      try {
        const current = await readAudioDeviceSnapshot();
        if (current && !audioDeviceSnapshotsEqual(baseline, current)) requestInvalidation("device");
      } finally {
        deviceCheckInFlight = false;
      }
    };
    const deviceChanged = () => { void checkAudioDevices(); };
    const connectionChanged = () => {
      if (!workProtectedRef.current) requestInvalidation("network");
    };
    const mediaInterrupted = (event: Event) => {
      const episodeId = (event as CustomEvent<{ episodeId?: string }>).detail?.episodeId;
      if (!episodeId) return;
      deferredMediaEpisodeRef.current = episodeId;
      requestInvalidation("network");
    };
    const mediaCritical = (event: Event) => {
      const episodeId = (event as CustomEvent<{ episodeId?: string }>).detail?.episodeId;
      if (episodeId) deferredMediaEpisodeRef.current = episodeId;
      requestInvalidation("media");
    };
    const mediaRecovered = (event: Event) => {
      const episodeId = (event as CustomEvent<{ episodeId?: string }>).detail?.episodeId;
      if (!episodeId || deferredMediaEpisodeRef.current !== episodeId) return;
      validatedMediaEpisodeRef.current = episodeId;
      deferredInvalidationReasons.current.delete("network");
      deferredInvalidationReasons.current.delete("media");
      if (!isRegisteredRef.current) {
        setStatus("warning");
        return;
      }
      deferredInvalidationReasons.current.delete("registration");
      if (!deferredInvalidation.current || deferredInvalidationReasons.current.size > 0) return;
      deferredInvalidation.current = false;
      deferredMediaEpisodeRef.current = null;
      validatedMediaEpisodeRef.current = null;
      deferredNoticeShown.current = false;
      const storedReady = readStoredReadiness(key);
      setAcknowledged(storedReady);
      setStatus(storedReady ? (isRegisteredRef.current ? "ready" : "warning") : "blocked");
      if (storedReady) window.dispatchEvent(new Event("nexus-pulse-ready"));
    };
    const mediaDevices = navigator.mediaDevices;
    window.addEventListener("offline", offline); mediaDevices?.addEventListener?.("devicechange", deviceChanged);
    window.addEventListener("nexus-pulse-media-interrupted", mediaInterrupted);
    window.addEventListener("nexus-pulse-media-critical", mediaCritical);
    window.addEventListener("nexus-pulse-media-recovered", mediaRecovered);
    const connection = (navigator as any).connection; connection?.addEventListener?.("change", connectionChanged);
    const lifecycleCheck = () => { void checkAudioDevices(); };
    window.addEventListener("focus", lifecycleCheck);
    document.addEventListener("visibilitychange", lifecycleCheck);
    window.addEventListener("pageshow", lifecycleCheck);
    // Polling is necessary on browsers which do not reliably emit devicechange.
    const lifecycleTimer = window.setInterval(lifecycleCheck, 15000);
    return () => {
      window.removeEventListener("offline", offline);
      mediaDevices?.removeEventListener?.("devicechange", deviceChanged);
      window.removeEventListener("nexus-pulse-media-interrupted", mediaInterrupted);
      window.removeEventListener("nexus-pulse-media-critical", mediaCritical);
      window.removeEventListener("nexus-pulse-media-recovered", mediaRecovered);
      connection?.removeEventListener?.("change", connectionChanged);
      window.removeEventListener("focus", lifecycleCheck);
      document.removeEventListener("visibilitychange", lifecycleCheck);
      window.removeEventListener("pageshow", lifecycleCheck);
      window.clearInterval(lifecycleTimer);
    };
  }, [allowed, key, requestInvalidation]);
  if (isLoading) return <div className="flex min-h-[60dvh] items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />{copy.working}</div>;
  if (!user || !allowed) return <>{children}</>;
  const roleLandingPage = (user as any)?.roleLandingPage || "/";
  const safeExitPage = roleLandingPage === "/agent-workspace" ? "/" : roleLandingPage;
  return <>
    <AlertDialog open={showDeferredRecheckIntro && !workProtected}>
      <AlertDialogContent overlayClassName="z-[10034] bg-slate-950/70 backdrop-blur-md motion-reduce:animate-none" className="z-[10035] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-[2rem] border-amber-300/35 bg-background p-0 shadow-2xl shadow-amber-950/30 motion-reduce:animate-none" data-testid="nexus-pulse-recheck-intro">
        <div className="relative overflow-hidden rounded-[inherit]">
          <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative p-6 text-center sm:p-8">
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-xl shadow-amber-500/25">
              <span className="absolute inset-0 rounded-[1.6rem] bg-amber-300/30 motion-safe:animate-ping motion-reduce:hidden" />
              <HeartPulse className="relative h-10 w-10" aria-hidden="true" />
            </div>
            <div className="mt-5 flex items-center justify-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300"><Sparkles className="h-4 w-4" aria-hidden="true" />{copy.recheckIntroEyebrow}</div>
            <AlertDialogTitle className="mt-2 text-center text-2xl font-bold tracking-tight sm:text-3xl">{copy.recheckIntroTitle}</AlertDialogTitle>
            <AlertDialogDescription className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-muted-foreground">{copy.recheckIntroDetail}</AlertDialogDescription>
            <Button size="lg" className="mt-7 h-14 w-full rounded-2xl bg-gradient-to-r from-primary to-red-600 text-base font-bold text-white shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 hover:shadow-xl" onClick={() => { setAutoStartDeferredRecheckRequest((request) => request + 1); setShowDeferredRecheckIntro(false); invalidateNow(); }} data-testid="button-pulse-start-required-recheck">
              {copy.recheckIntroStart}<ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Button>
            <Button variant="ghost" className="mt-3 h-11 w-full rounded-xl text-muted-foreground hover:text-foreground" onClick={() => { suppressRequiredOpenRef.current = true; setShowDeferredRecheckIntro(false); setOpen(false); setLocation(safeExitPage); }} data-testid="button-pulse-recheck-return">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />{copy.returnToIndexus}
            </Button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
    <PulseDiagnostics open={open && !diagnosticsBlocked && !showDeferredRecheckIntro} required={!ready} keepWakeLock hasValidReadiness={ready} autoStartRequest={autoStartDeferredRecheckRequest} userId={userKey(user)} onClose={() => setOpen(false)} onExit={() => setLocation(safeExitPage)} onReady={() => {
      sessionStorage.setItem(key, "1");
      hasEnteredPulseRef.current = true;
      setAcknowledged(true); setStatus("ready"); setOpen(false);
      void readAudioDeviceSnapshot().then((snapshot) => {
        if (snapshot) sessionStorage.setItem(pulseAudioDeviceBaselineStorageKey(userKey(user)), JSON.stringify(snapshot));
      });
      window.dispatchEvent(new Event("nexus-pulse-ready"));
    }} />
    {hasEnteredPulseRef.current || ready ? children : <div className="flex min-h-[60dvh] items-center justify-center"><div className="text-center text-muted-foreground"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />{copy.working}</div></div>}
  </>;
}

export function PulseHeaderButton() {
  const { user } = useAuth(); const { canAccessModule, isLoading } = usePermissions(); const { isRegistered } = useSip(); const { callState } = useCall(); const { locale } = useI18n(); const t = pulseCopy(locale); const [location, setLocation] = useLocation();
  const allowed = !!user && !isLoading && canAccessModule("nexusPulse"); const key = pulseReadinessStorageKey(userKey(user));
  const [open, setOpen] = useState(false); const [status, setStatus] = useState<Status>("checking");
  const [workspaceProtected, setWorkspaceProtected] = useState(false);
  const [recordingProtected, setRecordingProtected] = useState(isPulseRecordingPlaybackActive);
  const workProtected = isPulseSessionProtected(callState) || workspaceProtected || recordingProtected;
  const workspaceRoute = location.split(/[?#]/, 1)[0].replace(/\/+$/, "") === "/agent-workspace";
  const sync = useCallback(() => {
    const environmentValid = isPulseReadinessEnvironmentValid();
    const ready = readStoredReadiness(key, workProtected);
    setStatus(!environmentValid ? "blocked" : ready ? (isRegistered ? "ready" : "warning") : "checking");
  }, [isRegistered, key, workProtected]);
  useEffect(() => {
    sync();
    const handleReady = () => sync();
    const handleInvalidated = () => setStatus("blocked");
    const handleDeferred = () => setStatus("warning");
    window.addEventListener("nexus-pulse-ready", handleReady);
    window.addEventListener("nexus-pulse-invalidated", handleInvalidated);
    window.addEventListener("nexus-pulse-recheck-deferred", handleDeferred);
    return () => {
      window.removeEventListener("nexus-pulse-ready", handleReady);
      window.removeEventListener("nexus-pulse-invalidated", handleInvalidated);
      window.removeEventListener("nexus-pulse-recheck-deferred", handleDeferred);
    };
  }, [sync]);
  useEffect(() => {
    const handleWorkProtection = (event: Event) => {
      setWorkspaceProtected(!!(event as CustomEvent<{ protected?: boolean }>).detail?.protected);
    };
    const handleRecordingProtection = (event: Event) => {
      setRecordingProtected(!!(event as CustomEvent<{ active?: boolean }>).detail?.active);
    };
    window.addEventListener("nexus-pulse-work-protection", handleWorkProtection);
    window.addEventListener("nexus-pulse-recording-playback", handleRecordingProtection);
    return () => {
      window.removeEventListener("nexus-pulse-work-protection", handleWorkProtection);
      window.removeEventListener("nexus-pulse-recording-playback", handleRecordingProtection);
    };
  }, []);
  useEffect(() => {
    if (workProtected) setOpen(false);
  }, [workProtected]);
  if (!allowed) return null;
  const statusLabel = status === "ready" ? t.ready : status === "warning" ? t.warning : status === "blocked" ? t.blocked : t.working;
  const dotColor = status === "ready" ? "bg-emerald-500" : status === "warning" ? "bg-amber-500" : status === "blocked" ? "bg-destructive" : "bg-muted-foreground";
  return <><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="relative" onClick={() => { if (workProtected) return; if (workspaceRoute) window.dispatchEvent(new Event("nexus-pulse-open")); else setOpen(true); }} aria-label={`${t.title}: ${statusLabel}`} data-testid="button-pulse-status"><Activity className="h-5 w-5" /><span aria-hidden="true" className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-background ${dotColor}`} /></Button></TooltipTrigger><TooltipContent><p>{t.title}: {statusLabel}</p></TooltipContent></Tooltip>{!workspaceRoute && <PulseDiagnostics open={open && !workProtected} hasValidReadiness={readStoredReadiness(key, workProtected)} userId={userKey(user)} onClose={() => { setOpen(false); sync(); }} onReady={() => { sessionStorage.setItem(key, "1"); void readAudioDeviceSnapshot().then((snapshot) => { if (snapshot) sessionStorage.setItem(pulseAudioDeviceBaselineStorageKey(userKey(user)), JSON.stringify(snapshot)); }); window.dispatchEvent(new Event("nexus-pulse-ready")); setOpen(false); setLocation("/agent-workspace"); }} />}</>;
}