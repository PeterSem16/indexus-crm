import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/contexts/permissions-context";
import { useSip } from "@/contexts/sip-context";
import { useI18n } from "@/i18n";
import { PulseDiagnostics } from "./PulseDiagnostics";
import { isPulseReadinessEnvironmentValid } from "./diagnostics";
import { pulseCopy } from "./translations";

type Props = { children: ReactNode };
type Status = "checking" | "ready" | "warning" | "blocked";
type MissionRequirements = { campaignId: string | null; requiresUserM365: boolean };

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
  const { canAccessModule, isLoading } = usePermissions();
  const allowed = !!user && !isLoading && canAccessModule("nexusPulse");
  const key = `nexus-pulse-ready:${userKey(user)}`;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("checking");
  const [acknowledged, setAcknowledged] = useState(() => readStoredReadiness(key));
  const [missionRequirements, setMissionRequirements] = useState<MissionRequirements>({ campaignId: null, requiresUserM365: false });
  const ready = allowed && acknowledged;
  const { isRegistered } = useSip();
  useEffect(() => {
    if (!allowed || !acknowledged || isRegistered) return;
    setStatus("warning");
    const timer = window.setTimeout(() => {
      if (!isRegistered) { sessionStorage.removeItem(key); setAcknowledged(false); setStatus("blocked"); setOpen(true); }
    }, 14000);
    return () => window.clearTimeout(timer);
  }, [allowed, acknowledged, isRegistered, key]);
  useEffect(() => {
    const openFromHeader = () => setOpen(true);
    const sync = () => setAcknowledged(readStoredReadiness(key));
    sync();
    window.addEventListener("nexus-pulse-open", openFromHeader);
    window.addEventListener("nexus-pulse-ready", sync);
    return () => { window.removeEventListener("nexus-pulse-open", openFromHeader); window.removeEventListener("nexus-pulse-ready", sync); };
  }, [key]);
  useEffect(() => {
    const updateMissionRequirements = (event: Event) => {
      const detail = (event as CustomEvent<Partial<MissionRequirements>>).detail;
      const next: MissionRequirements = {
        campaignId: detail?.campaignId ? String(detail.campaignId) : null,
        requiresUserM365: !!detail?.requiresUserM365,
      };
      setMissionRequirements((current) => {
        const missionRelevantChange = (current.requiresUserM365 || next.requiresUserM365)
          && (current.campaignId !== next.campaignId || current.requiresUserM365 !== next.requiresUserM365);
        if (missionRelevantChange) {
          sessionStorage.removeItem(key);
          setAcknowledged(false);
          setStatus("blocked");
          setOpen(true);
          window.dispatchEvent(new Event("nexus-pulse-invalidated"));
        }
        return next;
      });
    };
    window.addEventListener("nexus-pulse-mission-requirements", updateMissionRequirements);
    return () => window.removeEventListener("nexus-pulse-mission-requirements", updateMissionRequirements);
  }, [key]);
  useEffect(() => { if (allowed && !ready) setOpen(true); }, [allowed, ready]);
  useEffect(() => {
    if (!allowed) return;
    const invalidate = () => { sessionStorage.removeItem(key); setAcknowledged(false); setStatus("blocked"); setOpen(true); window.dispatchEvent(new Event("nexus-pulse-invalidated")); };
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
  }, [allowed, key]);
  if (isLoading) return <div className="flex min-h-[60dvh] items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />{copy.working}</div>;
  if (!user || !allowed) return <>{children}</>;
  const roleLandingPage = (user as any)?.roleLandingPage || "/";
  const safeExitPage = roleLandingPage === "/agent-workspace" ? "/" : roleLandingPage;
  return <><PulseDiagnostics open={open} required={!ready} keepWakeLock userId={userKey(user)} missionScopeKey={missionRequirements.campaignId || "general"} requiresUserM365={missionRequirements.requiresUserM365} onClose={() => setOpen(false)} onExit={() => setLocation(safeExitPage)} onReady={() => { sessionStorage.setItem(key, JSON.stringify(missionRequirements)); setAcknowledged(true); setStatus("ready"); setOpen(false); window.dispatchEvent(new Event("nexus-pulse-ready")); }} />{ready ? children : <div className="flex min-h-[60dvh] items-center justify-center"><div className="text-center text-muted-foreground"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />{copy.working}</div></div>}</>;
}

export function PulseHeaderButton() {
  const { user } = useAuth(); const { canAccessModule, isLoading } = usePermissions(); const { isRegistered } = useSip(); const { locale } = useI18n(); const t = pulseCopy(locale); const [location] = useLocation();
  const allowed = !!user && !isLoading && canAccessModule("nexusPulse"); const key = `nexus-pulse-ready:${userKey(user)}`;
  const [open, setOpen] = useState(false); const [status, setStatus] = useState<Status>("checking");
  const sync = useCallback(() => {
    const environmentValid = isPulseReadinessEnvironmentValid();
    const ready = readStoredReadiness(key);
    setStatus(!environmentValid ? "blocked" : ready ? (isRegistered ? "ready" : "warning") : "checking");
  }, [isRegistered, key]);
  useEffect(() => {
    sync();
    const handleReady = () => sync();
    const handleInvalidated = () => setStatus("blocked");
    window.addEventListener("nexus-pulse-ready", handleReady);
    window.addEventListener("nexus-pulse-invalidated", handleInvalidated);
    return () => {
      window.removeEventListener("nexus-pulse-ready", handleReady);
      window.removeEventListener("nexus-pulse-invalidated", handleInvalidated);
    };
  }, [sync]);
  if (!allowed) return null;
  const statusLabel = status === "ready" ? t.ready : status === "warning" ? t.warning : status === "blocked" ? t.blocked : t.working;
  const dotColor = status === "ready" ? "bg-emerald-500" : status === "warning" ? "bg-amber-500" : status === "blocked" ? "bg-destructive" : "bg-muted-foreground";
  return <><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="relative" onClick={() => { if (location === "/agent-workspace") window.dispatchEvent(new Event("nexus-pulse-open")); else setOpen(true); }} aria-label={`${t.title}: ${statusLabel}`} data-testid="button-pulse-status"><Activity className="h-5 w-5" /><span aria-hidden="true" className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-background ${dotColor}`} /></Button></TooltipTrigger><TooltipContent><p>{t.title}: {statusLabel}</p></TooltipContent></Tooltip>{location !== "/agent-workspace" && <PulseDiagnostics open={open} userId={userKey(user)} onClose={() => { setOpen(false); sync(); }} onReady={() => { sessionStorage.setItem(`nexus-pulse-ready:${userKey(user)}`, "1"); window.dispatchEvent(new Event("nexus-pulse-ready")); setOpen(false); sync(); }} />}</>;
}