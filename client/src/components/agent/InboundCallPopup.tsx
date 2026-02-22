import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  PhoneIncoming,
  PhoneOff,
  Phone,
  User,
  Clock,
  Building2,
  MapPin,
  X,
} from "lucide-react";

interface InboundCallData {
  callId: string;
  callerNumber: string;
  callerName?: string;
  queueName: string;
  queueId: string;
  waitTime: number;
  channelId: string;
  timestamp: number;
}

interface MatchedCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  country?: string;
}

interface InboundCallPopupProps {
  inboundCall: InboundCallData | null;
  onAccept: (call: InboundCallData) => void;
  onReject: (call: InboundCallData) => void;
  onDismiss: () => void;
}

export function InboundCallPopup({ inboundCall, onAccept, onReject, onDismiss }: InboundCallPopupProps) {
  const [elapsed, setElapsed] = useState(0);
  const [isRinging, setIsRinging] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { data: matchedCustomer } = useQuery<MatchedCustomer | null>({
    queryKey: ["/api/customers/lookup-phone", inboundCall?.callerNumber],
    queryFn: async () => {
      if (!inboundCall?.callerNumber) return null;
      const res = await fetch(`/api/customers/lookup-phone?phone=${encodeURIComponent(inboundCall.callerNumber)}`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!inboundCall?.callerNumber,
    staleTime: 30000,
  });

  useEffect(() => {
    if (inboundCall) {
      setElapsed(0);
      setIsRinging(true);
      timerRef.current = setInterval(() => {
        setElapsed(e => e + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [inboundCall?.callId]);

  if (!inboundCall) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const initials = matchedCustomer?.name
    ? matchedCustomer.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : inboundCall.callerNumber.slice(-2);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" data-testid="inbound-call-overlay">
      <Card className="w-[420px] shadow-2xl border-2 border-green-500/50 animate-in slide-in-from-top-4 duration-300" data-testid="inbound-call-popup">
        <CardHeader className="pb-3 bg-gradient-to-r from-green-600/10 to-green-500/5 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="relative">
                <PhoneIncoming className="h-5 w-5 text-green-600" />
                {isRinging && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                  </span>
                )}
              </div>
              Incoming Call
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs" data-testid="badge-queue-name">
                {inboundCall.queueName}
              </Badge>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDismiss} data-testid="btn-dismiss-call">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border-2 border-green-200">
              <AvatarFallback className="bg-green-100 text-green-700 text-lg font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              {matchedCustomer ? (
                <>
                  <div className="font-semibold text-lg truncate" data-testid="text-caller-name">
                    {matchedCustomer.name}
                  </div>
                  <div className="text-sm text-muted-foreground" data-testid="text-caller-number">
                    {inboundCall.callerNumber}
                  </div>
                  {matchedCustomer.company && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Building2 className="h-3 w-3" />
                      {matchedCustomer.company}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="font-semibold text-lg" data-testid="text-caller-number">
                    {inboundCall.callerNumber}
                  </div>
                  <div className="text-sm text-muted-foreground" data-testid="text-unknown-caller">
                    Unknown caller
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>Ringing: {formatTime(elapsed)}</span>
            </div>
            {inboundCall.waitTime > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>Queue wait: {formatTime(inboundCall.waitTime)}</span>
              </div>
            )}
          </div>

          {matchedCustomer?.country && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>{matchedCustomer.country}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white h-12 text-base"
              onClick={() => onAccept(inboundCall)}
              data-testid="btn-accept-call"
            >
              <Phone className="h-5 w-5 mr-2" />
              Accept
            </Button>
            <Button
              variant="destructive"
              className="flex-1 h-12 text-base"
              onClick={() => onReject(inboundCall)}
              data-testid="btn-reject-call"
            >
              <PhoneOff className="h-5 w-5 mr-2" />
              Reject
            </Button>
          </div>
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
