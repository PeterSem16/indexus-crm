import { useState, useEffect, useRef, useCallback } from "react";
import { useI18n } from "@/i18n";
import { useQuery } from "@tanstack/react-query";
import {
  getRememberedPhoneCard,
  type RememberedPhoneCard,
} from "@/lib/phone-card-preference";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  PhoneIncoming,
  PhoneOff,
  Phone,
  PhoneCall,
  Clock,
  Building2,
  X,
  Users,
  Minimize2,
  Maximize2,
  AlertTriangle,
  PhoneMissed,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

let __indexusCallAlertCtx: AudioContext | null = null;
function playRepeatedCallAlertBeep() {
  try {
    if (typeof window === "undefined") return;
    if (!__indexusCallAlertCtx) {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      __indexusCallAlertCtx = new Ctx();
    }
    const ctx = __indexusCallAlertCtx!;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const playTone = (start: number, freq: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.linearRampToValueAtTime(0, start + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    };
    playTone(now, 880, 0.18);
    playTone(now + 0.22, 1175, 0.22);
  } catch {
    // Audio is best-effort; never break the popup if blocked by browser policy.
  }
}

interface InboundCallData {
  callId: string;
  callerNumber: string;
  callerName?: string;
  queueName: string;
  queueId: string;
  waitTime: number;
  channelId: string;
  didNumber?: string;
  sourceTrunk?: string;
  customerId?: string;
  contactType?: "customer" | "hospital" | "clinic" | "collaborator";
  timestamp: number;
  hasSipInvitation?: boolean;
  isQueueWaiting?: boolean;
}

interface InboundCallPopupProps {
  inboundCalls: InboundCallData[];
  onAccept: (call: InboundCallData) => void;
  onReject: (call: InboundCallData) => void;
  onDismiss: (callId: string) => void;
  agentStatus?: string;
  activeCallState?: string;
}

type PhoneLookupMatch = {
  entityType: string;
  id: string;
  name: string;
  phone: string;
  subtype?: string;
};

/**
 * The card displayed for a duplicate-number inbound call is this agent's
 * remembered choice only while that card remains part of the current lookup.
 */
function useInboundCallDisplayMatch(callerNumber?: string) {
  const { data: phoneMatches = [] } = useQuery<PhoneLookupMatch[]>({
    queryKey: ["/api/phone/lookup-all", callerNumber],
    queryFn: async () => {
      if (!callerNumber) return [];
      const res = await fetch(`/api/phone/lookup-all?phone=${encodeURIComponent(callerNumber)}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!callerNumber,
    staleTime: 30000,
  });

  const preferenceQuery = useQuery<RememberedPhoneCard | null>({
    queryKey: ["/api/phone/preferences", callerNumber],
    queryFn: async () => {
      if (!callerNumber) return null;
      const res = await fetch(`/api/phone/preferences?phone=${encodeURIComponent(callerNumber)}`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!callerNumber,
    staleTime: 30000,
  });

  const lastSelectedMatch = getRememberedPhoneCard(phoneMatches, preferenceQuery.data);
  const mayUseLookupFallback = preferenceQuery.isSuccess || preferenceQuery.isError;
  return {
    phoneMatches,
    // Do not briefly show the lookup's first record while the saved choice is
    // still loading: the first match is arbitrary for duplicate numbers.
    displayMatch: lastSelectedMatch ?? (mayUseLookupFallback ? phoneMatches[0] ?? null : null),
    isLastSelected: !!lastSelectedMatch,
  };
}

function CallTimer({ timestamp }: { timestamp: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - timestamp) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [timestamp]);

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return <span>{m.toString().padStart(2, "0")}:{s.toString().padStart(2, "0")}</span>;
}

function CallCard({ call, onAccept, onReject, onDismiss, isFirst }: {
  call: InboundCallData;
  onAccept: (call: InboundCallData) => void;
  onReject: (call: InboundCallData) => void;
  onDismiss: (callId: string) => void;
  isFirst: boolean;
}) {
  const { t } = useI18n();
  const aw = t.agentWorkspace;
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const acceptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (acceptTimeoutRef.current) clearTimeout(acceptTimeoutRef.current);
    };
  }, []);

  const handleAccept = useCallback(() => {
    if (isAccepting || isRejecting) return;
    setIsAccepting(true);
    if (acceptTimeoutRef.current) clearTimeout(acceptTimeoutRef.current);
    acceptTimeoutRef.current = setTimeout(() => {
      setIsAccepting(false);
    }, 5000);
    onAccept(call);
  }, [call, onAccept, isAccepting, isRejecting]);

  const handleReject = useCallback(() => {
    if (isAccepting || isRejecting) return;
    setIsRejecting(true);
    setTimeout(() => setIsRejecting(false), 3000);
    onReject(call);
  }, [call, onReject, isAccepting, isRejecting]);

  const {
    phoneMatches,
    displayMatch: primaryMatch,
    isLastSelected,
  } = useInboundCallDisplayMatch(call.callerNumber);

  const { data: todayHistory } = useQuery<{
    total: number;
    answered: number;
    missed: number;
    lastWasMissed: boolean;
    recent: Array<{ missed: boolean; answeredAt: string | null; completedAt: string | null }>;
  }>({
    queryKey: ["/api/inbound-call-logs/today-by-number", call.callerNumber],
    queryFn: async () => {
      const res = await fetch(`/api/inbound-call-logs/today-by-number?phone=${encodeURIComponent(call.callerNumber)}`, {
        credentials: "include",
      });
      if (!res.ok) return { total: 0, answered: 0, missed: 0, lastWasMissed: false, recent: [] };
      return res.json();
    },
    enabled: !!call.callerNumber,
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const totalToday = Math.max(0, (todayHistory?.total || 0) - 1);
  const missedToday = todayHistory?.missed || 0;
  const isUrgentRepeatedCaller = totalToday >= 2 && !!todayHistory?.lastWasMissed;

  const beepedRef = useRef(false);
  useEffect(() => {
    if (isFirst && isUrgentRepeatedCaller && !beepedRef.current) {
      beepedRef.current = true;
      playRepeatedCallAlertBeep();
    }
  }, [isFirst, isUrgentRepeatedCaller]);

  const initials = primaryMatch?.name
    ? primaryMatch.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : call.callerNumber.slice(-2);

  // Enable immediately when SIP invite is linked; fall back after 8s for external-phone agents
  // (Asterisk sends INVITE to browser within 1-3s; if it hasn't arrived after 8s the call
  // is being handled by an external device and we just load CRM context without WebRTC audio)
  const [sinceRing, setSinceRing] = useState(Math.floor((Date.now() - call.timestamp) / 1000));
  useEffect(() => {
    const t = setInterval(() => setSinceRing(Math.floor((Date.now() - call.timestamp) / 1000)), 1000);
    return () => clearInterval(t);
  }, [call.timestamp]);
  const SIP_INVITE_TIMEOUT = 8;
  const canAccept = call.hasSipInvitation === true || sinceRing >= SIP_INVITE_TIMEOUT;
  const displayName = primaryMatch?.name || call.callerNumber;
  const entityTypeColors: Record<string, string> = {
    customer: "bg-blue-100 text-blue-700",
    hospital: "bg-purple-100 text-purple-700",
    clinic: "bg-cyan-100 text-cyan-700",
    collaborator: "bg-amber-100 text-amber-700",
  };
  const entityTypeLabels: Record<string, string> = {
    customer: aw.entityTypeCustomer,
    hospital: aw.entityTypeHospital,
    clinic: aw.entityTypeClinic,
    collaborator: aw.entityTypeCollaborator,
  };

  return (
    <div
      className="overflow-hidden rounded-2xl border border-emerald-900/15 bg-card shadow-sm transition-all dark:border-emerald-200/15"
      data-testid={`inbound-call-card-${call.callId}`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex items-start gap-3.5">
            <Avatar className="h-14 w-14 shrink-0 rounded-2xl border border-emerald-700/25">
              <AvatarFallback className="rounded-2xl bg-emerald-100 text-lg font-semibold tracking-wide text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 pt-0.5">
              <span
                className="block break-words text-lg font-semibold leading-tight text-emerald-950 dark:text-emerald-50"
                title={displayName}
                data-testid={`text-caller-${call.callId}`}
              >
                {displayName}
              </span>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {primaryMatch && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${entityTypeColors[primaryMatch.entityType] || "bg-muted text-muted-foreground"}`}>
                    {entityTypeLabels[primaryMatch.entityType] || primaryMatch.entityType}
                  </span>
                )}
                {isLastSelected && phoneMatches.length > 1 && (
                  <Badge variant="secondary" className="h-4 shrink-0 px-1.5 py-0 text-[9px]">
                    {aw.inboundSelectRecommended}
                  </Badge>
                )}
                {phoneMatches.length > 1 && (
                  <Badge variant="secondary" className="h-4 shrink-0 px-1.5 py-0 text-[9px]">
                    +{phoneMatches.length - 1}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2.5 border-t border-emerald-900/10 pt-3.5 text-xs text-muted-foreground dark:border-emerald-100/10">
            <div className="flex items-start gap-2.5">
              <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700/60 dark:text-emerald-300/60" />
              <div className="min-w-0">
                <Badge variant="outline" className="max-w-full px-1.5 py-0 text-[10px] font-medium">
                  <span className="truncate">{call.queueName}</span>
                </Badge>
                {primaryMatch?.subtype && (
                  <div className="mt-1 break-words">{primaryMatch.subtype}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <PhoneIncoming className="h-3.5 w-3.5 shrink-0 text-emerald-700/60 dark:text-emerald-300/60" />
              <span className="break-all font-semibold text-foreground" data-testid={`text-caller-number-${call.callId}`}>
                {call.callerNumber}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <Clock className="h-3.5 w-3.5 shrink-0 text-emerald-700/60 dark:text-emerald-300/60" />
              <span className="font-semibold tabular-nums text-foreground"><CallTimer timestamp={call.timestamp} /></span>
            </div>
          </div>

          {totalToday > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5" data-testid={`today-stats-${call.callId}`}>
              <Badge
                variant="secondary"
                className="h-5 px-1.5 py-0 text-[10px]"
                title={aw.inboundTodayHint}
              >
                <PhoneIncoming className="mr-1 h-3 w-3" />
                {aw.inboundTodayLabel} {totalToday} {totalToday === 1 ? aw.inboundCallSingular : totalToday < 5 ? aw.inboundCallFew : aw.inboundCallMany}
              </Badge>
              {missedToday > 0 && (
                <Badge
                  variant="outline"
                  className="h-5 border-red-300 bg-red-50/50 px-1.5 py-0 text-[10px] text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-300"
                  data-testid={`missed-stats-${call.callId}`}
                >
                  <PhoneMissed className="mr-1 h-3 w-3" />
                  {missedToday} {aw.inboundMissedLabel}
                </Badge>
              )}
            </div>
          )}
        </div>

        <aside className={`flex min-h-[13.5rem] flex-col justify-between border-t p-3.5 sm:border-l sm:border-t-0 ${
          isUrgentRepeatedCaller
            ? "border-red-900/15 bg-red-50/55 dark:border-red-200/15 dark:bg-red-950/15"
            : "border-emerald-900/10 bg-emerald-50/30 dark:border-emerald-100/10 dark:bg-emerald-950/10"
        }`}>
          {isUrgentRepeatedCaller ? (
            <div className="flex items-start gap-2 text-red-800 dark:text-red-200" data-testid={`urgent-alert-${call.callId}`}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="text-[11px] leading-relaxed">
                <div className="font-semibold tracking-wide">{aw.inboundUrgentTitle}</div>
                <div className="mt-1 text-red-900/80 dark:text-red-100/80">
                  {aw.inboundUrgentDesc.replace('{n}', String(totalToday + 1))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-800 dark:text-emerald-200">
              <PhoneIncoming className="h-4 w-4" />
              {aw.inboundCallsTitle}
            </div>
          )}

          <div className="mt-5 grid gap-2">
            <Button
              size="sm"
              onClick={handleAccept}
              disabled={!canAccept || isAccepting || isRejecting}
              title={canAccept ? aw.inboundAcceptTitle : aw.inboundWaitingSip}
              className="h-10 w-full gap-1.5 bg-emerald-700 font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-700 dark:hover:bg-emerald-600"
              data-testid={`btn-accept-${call.callId}`}
            >
              {isAccepting ? (
                <Clock className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Phone className="h-3.5 w-3.5" />
              )}
              {isAccepting ? aw.inboundConnecting : aw.inboundAccept}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReject}
              disabled={isAccepting || isRejecting}
              className="h-9 w-full gap-1.5 border-red-300 bg-transparent font-semibold text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
              data-testid={`btn-reject-${call.callId}`}
            >
              <PhoneOff className="h-3.5 w-3.5" />
              {aw.inboundReject}
            </Button>
          </div>
        </aside>
      </div>

      {call.hasSipInvitation === false && !call.isQueueWaiting && (
        <div className="flex items-center gap-1 border-t border-emerald-900/10 px-4 py-2 text-xs text-muted-foreground dark:border-emerald-100/10">
          <Clock className="h-3 w-3 animate-spin" />
          {aw.inboundConnectingMsg}
        </div>
      )}

      <div className="flex justify-end border-t border-emerald-900/10 px-3 py-1.5 dark:border-emerald-100/10">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-[10px] text-muted-foreground"
          onClick={() => onDismiss(call.callId)}
          data-testid={`btn-dismiss-${call.callId}`}
        >
          <X className="h-3.5 w-3.5" />
          {aw.inboundDismiss}
        </Button>
      </div>
    </div>
  );
}

function MinimizedBadge({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2 duration-200" data-testid="inbound-call-minimized">
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-2 rounded-full bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transition-all cursor-pointer group"
        data-testid="btn-expand-inbound"
      >
        <div className="relative">
          <PhoneIncoming className="h-4 w-4" />
          <span className="absolute -top-1.5 -right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
          </span>
        </div>
        <span className="text-sm font-semibold">{count}</span>
        <Maximize2 className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
      </button>
    </div>
  );
}

function BusyIncomingIndicator({ inboundCalls, hasActiveCall, onAccept, onReject }: {
  inboundCalls: InboundCallData[];
  hasActiveCall: boolean;
  onAccept: (call: InboundCallData) => void;
  onReject: (call: InboundCallData) => void;
}) {
  const { t } = useI18n();
  const aw = t.agentWorkspace;
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const count = inboundCalls.length;
  const firstCall = inboundCalls[0];

  useEffect(() => {
    if (count === 0) setIsExpanded(false);
  }, [count]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    if (isExpanded) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isExpanded]);

  const {
    phoneMatches: pillPhoneMatches,
    displayMatch: pillPrimaryMatch,
    isLastSelected: pillIsLastSelected,
  } = useInboundCallDisplayMatch(firstCall?.callerNumber);

  const [busySinceRing, setBusySinceRing] = useState(firstCall ? Math.floor((Date.now() - firstCall.timestamp) / 1000) : 0);
  useEffect(() => {
    if (!firstCall) return;
    const t = setInterval(() => setBusySinceRing(Math.floor((Date.now() - firstCall.timestamp) / 1000)), 1000);
    return () => clearInterval(t);
  }, [firstCall?.timestamp]);

  if (!firstCall) return null;

  const isQueueWaiting = !!firstCall.isQueueWaiting;
  const canAnswer = !hasActiveCall && !isQueueWaiting && (firstCall.hasSipInvitation === true || busySinceRing >= 8);
  const displayName = pillPrimaryMatch?.name || firstCall.callerNumber;
  const pillColor = hasActiveCall ? "#D97706" : isQueueWaiting ? "#7C3AED" : "#16A34A";
  const pillHoverColor = hasActiveCall ? "#B45309" : isQueueWaiting ? "#6D28D9" : "#15803D";

  const handleAccept = () => {
    if (isAccepting) return;
    setIsAccepting(true);
    onAccept(firstCall);
    setIsExpanded(false);
    setTimeout(() => setIsAccepting(false), 5000);
  };

  const handleReject = () => {
    onReject(firstCall);
    setIsExpanded(false);
  };

  return (
    <div ref={panelRef} className="fixed top-4 right-4 z-[100]" data-testid="busy-incoming-indicator">
      <button
        onClick={() => setIsExpanded(v => !v)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-full text-white shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 select-none"
        style={{ background: pillColor }}
        onMouseEnter={e => (e.currentTarget.style.background = pillHoverColor)}
        onMouseLeave={e => (e.currentTarget.style.background = pillColor)}
        data-testid="btn-busy-incoming-pill"
      >
        <div className="relative">
          <PhoneIncoming className="h-4 w-4" />
          {!hasActiveCall && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
            </span>
          )}
        </div>
        <span className="text-sm font-bold tabular-nums">{count}</span>
        {isExpanded
          ? <ChevronUp className="h-3.5 w-3.5 opacity-80" />
          : <ChevronDown className="h-3.5 w-3.5 opacity-80" />
        }
      </button>

      {isExpanded && (
        <div
          className="absolute top-full mt-2 right-0 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 animate-in slide-in-from-top-2 duration-200 overflow-hidden"
          data-testid="busy-incoming-panel"
        >
          <div
            className="flex items-center justify-between px-3.5 py-2.5 border-b"
            style={{
              background: hasActiveCall ? "#FFFBEB" : isQueueWaiting ? "#F5F3FF" : "#F0FDF4",
              borderColor: hasActiveCall ? "#FDE68A" : isQueueWaiting ? "#DDD6FE" : "#BBF7D0",
            }}
          >
            <div className="flex items-center gap-2">
              <div className="relative">
                <PhoneIncoming className="h-3.5 w-3.5" style={{ color: pillColor }} />
                {!hasActiveCall && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70" style={{ background: pillColor }} />
                    <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: pillColor }} />
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold" style={{ color: hasActiveCall ? "#92400E" : isQueueWaiting ? "#4C1D95" : "#14532D" }}>
                {isQueueWaiting ? aw.inboundQueueTitle : aw.inboundBusyCallTitle}
              </span>
              {count > 1 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{count}</Badge>
              )}
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              data-testid="btn-close-busy-panel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="p-3 space-y-3">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white"
                style={{ background: pillColor }}
              >
                {displayName.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-semibold truncate text-slate-800">{displayName}</p>
                  {pillPrimaryMatch && (
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                      { customer: "bg-blue-100 text-blue-700", hospital: "bg-purple-100 text-purple-700", clinic: "bg-cyan-100 text-cyan-700", collaborator: "bg-amber-100 text-amber-700" }[pillPrimaryMatch.entityType] || "bg-gray-100 text-gray-700"
                    }`}>
                      {({ customer: aw.entityTypeCustomer, hospital: aw.entityTypeHospital, clinic: aw.entityTypeClinic, collaborator: aw.entityTypeCollaborator } as Record<string,string>)[pillPrimaryMatch.entityType] || pillPrimaryMatch.entityType}
                    </span>
                  )}
                  {pillIsLastSelected && pillPhoneMatches.length > 1 && (
                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                      {aw.inboundSelectRecommended}
                    </Badge>
                  )}
                  {pillPhoneMatches.length > 1 && (
                    <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-gray-100 text-gray-600">+{pillPhoneMatches.length - 1}</span>
                  )}
                </div>
                {pillPrimaryMatch?.name && (
                  <p className="text-[11px] text-slate-500 truncate">{firstCall.callerNumber}</p>
                )}
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                  <Clock className="h-3 w-3 shrink-0" />
                  <CallTimer timestamp={firstCall.timestamp} />
                  <span>·</span>
                  <span className="truncate">{firstCall.queueName}</span>
                </div>
              </div>
            </div>

            {hasActiveCall ? (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs" style={{ background: "#FEF3C7", color: "#92400E" }}>
                <PhoneCall className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{aw.inboundOnCallMsg}</span>
              </div>
            ) : isQueueWaiting ? (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs" style={{ background: "#EDE9FE", color: "#4C1D95" }}>
                <PhoneIncoming className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{aw.inboundQueueWaitingMsg}</span>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 h-9 text-xs font-semibold gap-1.5 text-white"
                  style={{ background: "#16A34A" }}
                  onClick={handleAccept}
                  disabled={!canAnswer || isAccepting}
                  data-testid="btn-busy-accept"
                >
                  {isAccepting ? (
                    <Clock className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Phone className="h-3.5 w-3.5" />
                  )}
                  {isAccepting ? aw.inboundConnecting : aw.inboundAccept}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1 h-9 text-xs font-semibold gap-1.5"
                  onClick={handleReject}
                  data-testid="btn-busy-reject"
                >
                  <PhoneOff className="h-3.5 w-3.5" />
                  {aw.inboundReject}
                </Button>
              </div>
            )}

            {count > 1 && (
              <p className="text-[10px] text-slate-400 text-center">
                +{count - 1} {count - 1 === 1 ? aw.inboundMoreSingular : count - 1 < 5 ? aw.inboundMoreFew : aw.inboundMoreMany} {aw.inboundInQueue}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function InboundCallPopup({ inboundCalls, onAccept, onReject, onDismiss, agentStatus, activeCallState }: InboundCallPopupProps) {
  const { t } = useI18n();
  const aw = t.agentWorkspace;
  const isBusy = agentStatus === "busy";
  const hasActiveCall = activeCallState === "active" || activeCallState === "on_hold";

  const [isMinimized, setIsMinimized] = useState(false);
  const prevCountRef = useRef(inboundCalls.length);

  useEffect(() => {
    if (inboundCalls.length > prevCountRef.current && isMinimized && !isBusy) {
      setIsMinimized(false);
    }
    prevCountRef.current = inboundCalls.length;
  }, [inboundCalls.length, isMinimized, isBusy]);

  if (inboundCalls.length === 0) return null;

  if (isBusy) {
    return (
      <BusyIncomingIndicator
        inboundCalls={inboundCalls}
        hasActiveCall={hasActiveCall}
        onAccept={onAccept}
        onReject={onReject}
      />
    );
  }

  if (isMinimized) {
    return <MinimizedBadge count={inboundCalls.length} onClick={() => setIsMinimized(false)} />;
  }

  return (
    <div className="fixed right-4 top-4 z-[100] w-[728px] max-w-[calc(100vw-2rem)] animate-in slide-in-from-top-4 duration-300" data-testid="inbound-call-overlay">
      <Card className="overflow-hidden border border-emerald-900/20 shadow-[0_24px_65px_rgba(27,64,57,0.19)] dark:border-emerald-200/20" data-testid="inbound-call-popup">
        <CardHeader className="border-b border-emerald-900/10 bg-emerald-50/70 px-4 py-3 dark:border-emerald-100/10 dark:bg-emerald-950/30">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="relative">
                <PhoneIncoming className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
              </div>
              {aw.inboundCallsTitle}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {inboundCalls.length} {inboundCalls.length === 1 ? aw.inboundCallSingular : inboundCalls.length < 5 ? aw.inboundCallFew : aw.inboundCallMany}
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setIsMinimized(true)}
                title={aw.inboundMinimize}
                data-testid="btn-minimize-inbound"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          <ScrollArea className={inboundCalls.length > 3 ? "h-[300px]" : ""}>
            <div className="space-y-2">
              {inboundCalls.map((call, idx) => (
                <CallCard
                  key={call.callId}
                  call={call}
                  onAccept={onAccept}
                  onReject={onReject}
                  onDismiss={onDismiss}
                  isFirst={idx === 0}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export function InboundQueueStatus({ userId }: { userId?: string }) {
  const { data: agentQueueStatus } = useQuery<any>({
    queryKey: ["/api/agent/queue-status", userId],
    enabled: !!userId,
    refetchInterval: 5000,
  });

  if (!agentQueueStatus?.queues?.length) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Inbound Queues
      </h4>
      <div className="space-y-1.5">
        {agentQueueStatus.queues.map((q: any) => (
          <div key={q.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-md bg-muted/50">
            <div className="flex items-center gap-2">
              <PhoneIncoming className="h-3 w-3 text-primary" />
              <span className="font-medium">{q.name}</span>
            </div>
            <div className="flex items-center gap-3">
              {q.waiting > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  {q.waiting} waiting
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {q.activeAgents} online
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
