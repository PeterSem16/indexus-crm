import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/contexts/permissions-context";
import { useSip } from "@/contexts/sip-context";
import { useCall } from "@/contexts/call-context";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { PulseDiagnostics } from "./PulseDiagnostics";
import { isPulseReadinessEnvironmentValid, isPulseSessionProtected, pulseReadinessStorageKey } from "./diagnostics";
import { isPulseRecordingPlaybackActive } from "./recording-playback";
import { pulseCopy } from "./translations";

type Props = { children: ReactNode };
type Status = "checking" | "ready" | "warning" | "blocked";

function userKey(user: any) { return String(user?.id ?? user?.userId ?? user?.username ?? "unknown"); }

function readStoredReadiness(key: string) {
  if (!sessionStorage.getItem(key)) return false;
  if (isPulseReadinessEnvironmentValid()) return true;
  sessionStorage.removeItem(key);
  return false;
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
  const [afterCallWorkActive, setAfterCallWorkActive] = useState(false);
  const [recordingPlaybackActive, setRecordingPlaybackActive] = useState(isPulseRecordingPlaybackActive);
  const ready = allowed && acknowledged;
  const workProtected = isPulseSessionProtected(callState) || afterCallWorkActive || recordingPlaybackActive;
  const workProtectedRef = useRef(workProtected);
  const deferredInvalidation = useRef(false);
  const deferredNoticeShown = useRef(false);
  useLayoutEffect(() => {
    workProtectedRef.current = workProtected;
  }, [workProtected]);
  const { isRegistered } = useSip();
  useEffect(() => {
    sessionStorage.removeItem(key.replace("nexus-pulse-ready-v2:", "nexus-pulse-ready:"));
  }, [key]);
  const invalidateNow = useCallback(() => {
    deferredInvalidation.current = false;
    deferredNoticeShown.current = false;
    sessionStorage.removeItem(key);
    setAcknowledged(false);
    setStatus("blocked");
    setOpen(true);
    window.dispatchEvent(new Event("nexus-pulse-invalidated"));
  }, [key]);
  const requestInvalidation = useCallback(() => {
    if (workProtectedRef.current) {
      deferredInvalidation.current = true;
      setStatus("warning");
      window.dispatchEvent(new Event("nexus-pulse-recheck-deferred"));
      if (!deferredNoticeShown.current) {
        deferredNoticeShown.current = true;
        toast({ title: copy.recheckDeferredTitle, description: copy.recheckDeferredDetail });
      }
      return;
    }
    invalidateNow();
  }, [copy.recheckDeferredDetail, copy.recheckDeferredTitle, invalidateNow, toast]);
  useEffect(() => {
    if (!allowed || !acknowledged || isRegistered) return;
    setStatus("warning");
    const timer = window.setTimeout(() => {
      if (!isRegistered) requestInvalidation();
    }, 14000);
    return () => window.clearTimeout(timer);
  }, [allowed, acknowledged, isRegistered, requestInvalidation]);
  useEffect(() => {
    if (workProtected || !deferredInvalidation.current) return;
    const timer = window.setTimeout(() => {
      if (workProtectedRef.current || !deferredInvalidation.current) return;
      deferredInvalidation.current = false;
      deferredNoticeShown.current = false;
      invalidateNow();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [invalidateNow, workProtected]);
  useEffect(() => {
    const openFromHeader = () => setOpen(true);
    const sync = () => {
      if (!workProtectedRef.current) setAcknowledged(readStoredReadiness(key));
    };
    sync();
    window.addEventListener("nexus-pulse-open", openFromHeader);
    window.addEventListener("nexus-pulse-ready", sync);
    return () => { window.removeEventListener("nexus-pulse-open", openFromHeader); window.removeEventListener("nexus-pulse-ready", sync); };
  }, [key]);
  useEffect(() => {
    const updateWorkProtection = (event: Event) => {
      setAfterCallWorkActive(!!(event as CustomEvent<{ protected?: boolean }>).detail?.protected);
    };
    window.addEventListener("nexus-pulse-work-protection", updateWorkProtection);
    return () => window.removeEventListener("nexus-pulse-work-protection", updateWorkProtection);
  }, []);
  useEffect(() => {
    const updateRecordingProtection = (event: Event) => {
      const active = !!(event as CustomEvent<{ active?: boolean }>).detail?.active;
      workProtectedRef.current = isPulseSessionProtected(callState) || afterCallWorkActive || active;
      setRecordingPlaybackActive(active);
    };
    window.addEventListener("nexus-pulse-recording-playback", updateRecordingProtection);
    return () => window.removeEventListener("nexus-pulse-recording-playback", updateRecordingProtection);
  }, [afterCallWorkActive, callState]);
  useEffect(() => { if (allowed && !ready) setOpen(true); }, [allowed, ready]);
  useEffect(() => {
    if (!allowed) return;
    const invalidate = () => requestInvalidation();
    let lastLifecycleCheck = Date.now();
    const mediaDevices = navigator.mediaDevices;
    window.addEventListener("offline", invalidate); mediaDevices?.addEventListener?.("devicechange", invalidate);
    window.addEventListener("online", invalidate);
    const connection = (navigator as any).connection; connection?.addEventListener?.("change", invalidate);
    const lifecycleTimer = window.setInterval(() => {
      const now = Date.now();
      if (now - lastLifecycleCheck > 45000) invalidate();
      lastLifecycleCheck = now;
    }, 15000);
    return () => { window.removeEventListener("offline", invalidate); mediaDevices?.removeEventListener?.("devicechange", invalidate); window.removeEventListener("online", invalidate); connection?.removeEventListener?.("change", invalidate); window.clearInterval(lifecycleTimer); };
  }, [allowed, requestInvalidation]);
  if (isLoading) return <div className="flex min-h-[60dvh] items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />{copy.working}</div>;
  if (!user || !allowed) return <>{children}</>;
  const roleLandingPage = (user as any)?.roleLandingPage || "/";
  const safeExitPage = roleLandingPage === "/agent-workspace" ? "/" : roleLandingPage;
  return <><PulseDiagnostics open={open && !workProtected} required={!ready} keepWakeLock userId={userKey(user)} onClose={() => setOpen(false)} onExit={() => setLocation(safeExitPage)} onReady={() => { sessionStorage.setItem(key, "1"); setAcknowledged(true); setStatus("ready"); setOpen(false); window.dispatchEvent(new Event("nexus-pulse-ready")); }} />{ready || workProtected ? children : <div className="flex min-h-[60dvh] items-center justify-center"><div className="text-center text-muted-foreground"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />{copy.working}</div></div>}</>;
}

export function PulseHeaderButton() {
  const { user } = useAuth(); const { canAccessModule, isLoading } = usePermissions(); const { isRegistered } = useSip(); const { locale } = useI18n(); const t = pulseCopy(locale); const [location, setLocation] = useLocation();
  const allowed = !!user && !isLoading && canAccessModule("nexusPulse"); const key = pulseReadinessStorageKey(userKey(user));
  const [open, setOpen] = useState(false); const [status, setStatus] = useState<Status>("checking");
  const workspaceRoute = location.split(/[?#]/, 1)[0].replace(/\/+$/, "") === "/agent-workspace";
  const sync = useCallback(() => {
    const environmentValid = isPulseReadinessEnvironmentValid();
    const ready = readStoredReadiness(key);
    setStatus(!environmentValid ? "blocked" : ready ? (isRegistered ? "ready" : "warning") : "checking");
  }, [isRegistered, key]);
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
  if (!allowed) return null;
  const statusLabel = status === "ready" ? t.ready : status === "warning" ? t.warning : status === "blocked" ? t.blocked : t.working;
  const dotColor = status === "ready" ? "bg-emerald-500" : status === "warning" ? "bg-amber-500" : status === "blocked" ? "bg-destructive" : "bg-muted-foreground";
  return <><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="relative" onClick={() => { if (workspaceRoute) window.dispatchEvent(new Event("nexus-pulse-open")); else setOpen(true); }} aria-label={`${t.title}: ${statusLabel}`} data-testid="button-pulse-status"><Activity className="h-5 w-5" /><span aria-hidden="true" className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-background ${dotColor}`} /></Button></TooltipTrigger><TooltipContent><p>{t.title}: {statusLabel}</p></TooltipContent></Tooltip>{!workspaceRoute && <PulseDiagnostics open={open} userId={userKey(user)} onClose={() => { setOpen(false); sync(); }} onReady={() => { sessionStorage.setItem(key, "1"); window.dispatchEvent(new Event("nexus-pulse-ready")); setOpen(false); setLocation("/agent-workspace"); }} />}</>;
}