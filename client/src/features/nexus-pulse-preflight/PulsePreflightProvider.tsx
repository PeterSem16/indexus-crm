import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Activity, AlertTriangle, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/contexts/permissions-context";
import { useSip } from "@/contexts/sip-context";
import { useI18n } from "@/i18n";
import { PulseDiagnostics } from "./PulseDiagnostics";
import { pulseCopy } from "./translations";

type Props = { children: ReactNode };
type Status = "checking" | "ready" | "warning" | "blocked";

function userKey(user: any) { return String(user?.id ?? user?.userId ?? user?.username ?? "unknown"); }

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
  const [acknowledged, setAcknowledged] = useState(() => sessionStorage.getItem(key) === "1");
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
    const sync = () => setAcknowledged(sessionStorage.getItem(key) === "1");
    window.addEventListener("nexus-pulse-open", openFromHeader);
    window.addEventListener("nexus-pulse-ready", sync);
    return () => { window.removeEventListener("nexus-pulse-open", openFromHeader); window.removeEventListener("nexus-pulse-ready", sync); };
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
  return <><PulseDiagnostics open={open} required={!ready} keepWakeLock userId={userKey(user)} onClose={() => setOpen(false)} onExit={() => setLocation("/")} onReady={() => { sessionStorage.setItem(key, "1"); setAcknowledged(true); setStatus("ready"); setOpen(false); window.dispatchEvent(new Event("nexus-pulse-ready")); }} />{ready ? children : <div className="flex min-h-[60dvh] items-center justify-center"><div className="text-center text-muted-foreground"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />{copy.working}</div></div>}</>;
}

export function PulseHeaderButton() {
  const { user } = useAuth(); const { canAccessModule, isLoading } = usePermissions(); const { isRegistered } = useSip(); const { locale } = useI18n(); const t = pulseCopy(locale); const [location] = useLocation();
  const allowed = !!user && !isLoading && canAccessModule("nexusPulse"); const key = `nexus-pulse-ready:${userKey(user)}`;
  const [open, setOpen] = useState(false); const [status, setStatus] = useState<Status>(sessionStorage.getItem(key) === "1" ? "ready" : "checking");
  const sync = useCallback(() => { const ready = sessionStorage.getItem(key) === "1"; setStatus(ready ? (isRegistered ? "ready" : "warning") : "checking"); }, [isRegistered, key]);
  useEffect(() => { sync(); const handler = () => sync(); window.addEventListener("nexus-pulse-ready", handler); window.addEventListener("nexus-pulse-invalidated", handler); return () => { window.removeEventListener("nexus-pulse-ready", handler); window.removeEventListener("nexus-pulse-invalidated", handler); }; }, [sync]);
  if (!allowed) return null;
  const color = status === "ready" ? "text-emerald-600 border-emerald-200" : status === "warning" ? "text-amber-700 border-amber-200" : status === "blocked" ? "text-destructive border-destructive/30" : "text-muted-foreground";
  return <><Button variant="outline" size="sm" className={`gap-1.5 ${color}`} onClick={() => { if (location === "/agent-workspace") window.dispatchEvent(new Event("nexus-pulse-open")); else setOpen(true); }} aria-label={t.title} data-testid="button-pulse-status"><Activity className="h-3.5 w-3.5" /> <span className="hidden md:inline">Pulse</span>{status === "ready" ? <Check className="h-3 w-3" /> : status === "warning" ? <AlertTriangle className="h-3 w-3" /> : null}</Button>{location !== "/agent-workspace" && <PulseDiagnostics open={open} userId={userKey(user)} onClose={() => { setOpen(false); sync(); }} onReady={() => { sessionStorage.setItem(`nexus-pulse-ready:${userKey(user)}`, "1"); window.dispatchEvent(new Event("nexus-pulse-ready")); setOpen(false); sync(); }} />}</>;
}