import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  PhoneIncoming,
  PhoneOff,
  Phone,
  User,
  Clock,
  Building2,
  MapPin,
  X,
  Users,
  Minimize2,
  Maximize2,
  AlertTriangle,
  PhoneMissed,
  Bell,
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
  timestamp: number;
  hasSipInvitation?: boolean;
}

interface InboundCallPopupProps {
  inboundCalls: InboundCallData[];
  onAccept: (call: InboundCallData) => void;
  onReject: (call: InboundCallData) => void;
  onDismiss: (callId: string) => void;
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

  const { data: matchedCustomer } = useQuery<any>({
    queryKey: ["/api/customers/lookup-phone", call.callerNumber],
    queryFn: async () => {
      if (!call.callerNumber) return null;
      const res = await fetch(`/api/customers/lookup-phone?phone=${encodeURIComponent(call.callerNumber)}`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!call.callerNumber,
    staleTime: 30000,
  });

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

  // Today's totals exclude the current ringing call (which is also stored as a "queued" row).
  const totalToday = Math.max(0, (todayHistory?.total || 0) - 1);
  const missedToday = todayHistory?.missed || 0;
  const isUrgentRepeatedCaller = totalToday >= 2 && !!todayHistory?.lastWasMissed; // current + ≥2 prior = ≥3 total today

  const beepedRef = useRef(false);
  useEffect(() => {
    if (isFirst && isUrgentRepeatedCaller && !beepedRef.current) {
      beepedRef.current = true;
      playRepeatedCallAlertBeep();
    }
  }, [isFirst, isUrgentRepeatedCaller]);

  const initials = matchedCustomer?.name
    ? matchedCustomer.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : call.callerNumber.slice(-2);

  const canAccept = call.hasSipInvitation === true;
  const displayName = matchedCustomer?.name || call.callerNumber;

  return (
    <div
      className={`p-3 rounded-lg border ${
        isUrgentRepeatedCaller
          ? "border-red-500 bg-red-50 dark:bg-red-950/30 ring-2 ring-red-400/40 animate-pulse"
          : isFirst
            ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20"
            : "border-border bg-card"
      } transition-all`}
      data-testid={`inbound-call-card-${call.callId}`}
    >
      <div className="flex items-start gap-3">
        <Avatar
          className={`h-10 w-10 border-2 shrink-0 ${
            isUrgentRepeatedCaller ? "border-red-300" : isFirst ? "border-green-200" : "border-muted"
          }`}
        >
          <AvatarFallback
            className={`text-sm font-semibold ${
              isUrgentRepeatedCaller
                ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200"
                : isFirst
                  ? "bg-green-100 text-green-700"
                  : "bg-muted"
            }`}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-semibold text-sm break-words"
              title={displayName}
              data-testid={`text-caller-${call.callId}`}
            >
              {displayName}
            </span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
              {call.queueName}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
            {matchedCustomer?.name && (
              <span data-testid={`text-caller-number-${call.callId}`}>{call.callerNumber}</span>
            )}
            {matchedCustomer?.company && (
              <span className="flex items-center gap-0.5">
                <Building2 className="h-3 w-3" />
                {matchedCustomer.company}
              </span>
            )}
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              <CallTimer timestamp={call.timestamp} />
            </span>
          </div>
          {totalToday > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap" data-testid={`today-stats-${call.callId}`}>
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-5"
                title="Počet dnešných prichádzajúcich hovorov od tohto volajúceho (okrem aktuálneho)"
              >
                <PhoneIncoming className="h-3 w-3 mr-1" />
                Dnes: {totalToday} {totalToday === 1 ? "hovor" : totalToday < 5 ? "hovory" : "hovorov"}
              </Badge>
              {missedToday > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-5 border-red-300 text-red-700 dark:text-red-300 dark:border-red-700"
                  data-testid={`missed-stats-${call.callId}`}
                >
                  <PhoneMissed className="h-3 w-3 mr-1" />
                  {missedToday} nedvíhal
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="default"
            onClick={handleAccept}
            disabled={!canAccept || isAccepting || isRejecting}
            title={canAccept ? "Prijať hovor" : "Čakám na SIP pripojenie..."}
            data-testid={`btn-accept-${call.callId}`}
          >
            {isAccepting ? (
              <Clock className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Phone className="h-3.5 w-3.5 mr-1" />
            )}
            {isAccepting ? "Pripájam..." : "Prijať"}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleReject}
            disabled={isAccepting || isRejecting}
            data-testid={`btn-reject-${call.callId}`}
          >
            <PhoneOff className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDismiss(call.callId)}
            data-testid={`btn-dismiss-${call.callId}`}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {isUrgentRepeatedCaller && (
        <div
          className="mt-2 px-2.5 py-2 rounded-md bg-red-600 text-white text-xs font-medium flex items-start gap-2 shadow-sm"
          data-testid={`urgent-alert-${call.callId}`}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5" />
              <span className="font-semibold uppercase tracking-wide">Súrne — opakovaný volajúci</span>
            </div>
            <div className="mt-0.5 text-white/95">
              Tento volajúci dnes volal už {totalToday + 1}× a posledný hovor nebol vybavený. Prijmite hovor prioritne.
            </div>
          </div>
        </div>
      )}
      {!canAccept && (
        <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <Clock className="h-3 w-3 animate-spin" />
          Pripájam hovor...
        </div>
      )}
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

export function InboundCallPopup({ inboundCalls, onAccept, onReject, onDismiss }: InboundCallPopupProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const prevCountRef = useRef(inboundCalls.length);

  useEffect(() => {
    if (inboundCalls.length > prevCountRef.current && isMinimized) {
      setIsMinimized(false);
    }
    prevCountRef.current = inboundCalls.length;
  }, [inboundCalls.length, isMinimized]);

  if (inboundCalls.length === 0) return null;

  if (isMinimized) {
    return <MinimizedBadge count={inboundCalls.length} onClick={() => setIsMinimized(false)} />;
  }

  return (
    <div className="fixed top-4 right-4 z-[100] w-[600px] max-w-[calc(100vw-2rem)] animate-in slide-in-from-top-4 duration-300" data-testid="inbound-call-overlay">
      <Card className="shadow-2xl border-2 border-green-500/50" data-testid="inbound-call-popup">
        <CardHeader className="pb-2 bg-gradient-to-r from-green-600/10 to-green-500/5 border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="relative">
                <PhoneIncoming className="h-4 w-4 text-green-600" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </span>
              </div>
              Prichádzajúce hovory
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {inboundCalls.length} {inboundCalls.length === 1 ? "hovor" : inboundCalls.length < 5 ? "hovory" : "hovorov"}
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setIsMinimized(true)}
                title="Minimalizovať"
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
