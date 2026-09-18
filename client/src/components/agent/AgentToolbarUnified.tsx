import { useQuery } from "@tanstack/react-query";
import type { AgentBreakType } from "@shared/schema";
import { useAuth } from "@/contexts/auth-context";
import {
  CalendarClock,
  ChevronDown,
  Clock3,
  Coffee,
  FileText,
  Headphones,
  History,
  Inbox,
  Mail,
  MessageSquare,
  PhoneCall,
  PhoneForwarded,
  PhoneMissed,
  PhoneOff,
  Power,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import "./agent-toolbar-unified.css";

export type AgentToolbarStatus = "available" | "busy" | "break" | "wrap_up" | "offline";

interface AgentToolbarUnifiedProps {
  status: AgentToolbarStatus;
  onStatusChange: (status: AgentToolbarStatus) => void;
  stats: { calls: number; emails: number; sms: number };
  quotas: { calls: number | null; emails: number | null; sms: number | null } | null;
  isQuotaBlocked: (type: "calls" | "emails" | "sms") => boolean;
  workTime: string;
  breakTypes: AgentBreakType[];
  onStartBreak: (breakTypeId: string) => void;
  onOpenBreak: () => void;
  breakDialogOpen: boolean;
  isOnBreak: boolean;
  onEndSession: () => void;
  isSessionActive: boolean;
  t: any;
  onOpenScheduledQueue?: () => void;
  scheduledQueueCounts?: { total: number; overdue: number };
  missedCommunicationCounts?: { calls: number; emails: number; sms: number };
  onOpenAbandonedCalls?: () => void;
  onOpenMyActivity?: () => void;
  inboundRingtoneEnabled?: boolean;
  onToggleInboundRingtone?: () => void;
}

export function AgentToolbarUnified({
  status,
  onStatusChange,
  stats,
  quotas,
  isQuotaBlocked,
  workTime,
  breakTypes,
  onStartBreak,
  onOpenBreak,
  breakDialogOpen,
  isOnBreak,
  onEndSession,
  isSessionActive,
  t,
  onOpenScheduledQueue,
  scheduledQueueCounts,
  missedCommunicationCounts,
  onOpenAbandonedCalls,
  onOpenMyActivity,
  inboundRingtoneEnabled,
  onToggleInboundRingtone,
}: AgentToolbarUnifiedProps) {
  const { user } = useAuth();
  const { data: fwdData } = useQuery<{ enabled: boolean; number: string | null }>({
    queryKey: ["/api/users", user?.id, "call-forwarding"],
    queryFn: async () => {
      const response = await fetch(`/api/users/${user!.id}/call-forwarding`, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`Failed to load call forwarding (${response.status})`);
      }
      return response.json();
    },
    enabled: !!user?.id && isSessionActive,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const statusConfig: Record<AgentToolbarStatus, { label: string; hint: string; icon: React.ReactNode; tone: string }> = {
    available: { label: t.agentSession.statusAvailable, hint: t.agentWorkspace.toolbar.availableHint, icon: <Headphones />, tone: "available" },
    busy: { label: t.agentSession.statusBusy, hint: t.agentWorkspace.toolbar.busyHint, icon: <PhoneCall />, tone: "busy" },
    break: { label: t.agentSession.statusBreak, hint: t.agentWorkspace.toolbar.breakHint, icon: <Coffee />, tone: "break" },
    wrap_up: { label: t.agentSession.statusWrapUp, hint: t.agentWorkspace.toolbar.wrapUpHint, icon: <FileText />, tone: "wrap-up" },
    offline: { label: t.agentSession.statusOffline, hint: t.agentWorkspace.toolbar.offlineHint, icon: <PhoneOff />, tone: "offline" },
  };
  const currentStatus = statusConfig[isOnBreak ? "break" : status];
  const callForwardingActive = !!(fwdData?.enabled && fwdData.number);
  const formatCount = (value: number, quota: number | null | undefined) =>
    quota === null || quota === undefined ? String(value) : `${value}/${quota}`;

  return (
    <div className="agent-toolbar-unified" data-testid="agent-toolbar-unified">
      <div className="pta-surface">
        <div className="pta-toolbar pta-control-row" role="group" aria-label={t.agentWorkspace.toolbar.agentControls}>
          {isOnBreak ? (
            <button
              type="button"
              className="pta-control pta-status pta-status-break"
              data-testid="dropdown-agent-status"
              onClick={onOpenBreak}
              title={t.agentWorkspace.breakModal.open}
              aria-label={`${currentStatus.label}: ${t.agentWorkspace.breakModal.open}`}
              aria-haspopup="dialog"
              aria-expanded={breakDialogOpen}
            >
              <span className="pta-status-dot" />
              <span className="pta-control-copy"><strong>{currentStatus.label}</strong><span>{currentStatus.hint}</span></span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>
          ) : <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`pta-control pta-status pta-status-${currentStatus.tone}`}
                data-testid="dropdown-agent-status"
              >
                <span className="pta-status-dot" />
                <span className="pta-status-icon">{currentStatus.icon}</span>
                <span className="pta-control-copy">
                  <strong>{currentStatus.label}</strong>
                  <span>{currentStatus.hint}</span>
                </span>
                <ChevronDown size={15} aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="pta-status-menu w-60">
              {(["available", "busy", "wrap_up"] as AgentToolbarStatus[]).map((key) => {
                const item = statusConfig[key];
                return (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => onStatusChange(key)}
                    className="pta-status-menu-item"
                    data-testid={`menu-item-status-${key}`}
                  >
                    <span className={`pta-menu-dot pta-menu-dot-${item.tone}`} />
                    <span className="pta-menu-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </DropdownMenuItem>
                );
              })}
              {breakTypes.length > 0 && (
                <>
                  <Separator className="my-1" />
                  <div className="pta-menu-heading">{t.agentSession.breaks}</div>
                  {breakTypes.map((breakType) => (
                    <DropdownMenuItem
                      key={breakType.id}
                      onClick={() => onStartBreak(breakType.id)}
                      className="pta-status-menu-item"
                      data-testid={`menu-item-break-${breakType.id}`}
                    >
                      <span className="pta-menu-dot pta-menu-dot-break" />
                      <Coffee className="pta-menu-icon" />
                      <span>{breakType.name}</span>
                      {breakType.maxDurationMinutes ? <span className="pta-menu-duration">{breakType.maxDurationMinutes}m</span> : null}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>}

          {isSessionActive && (
            <button type="button" className="pta-control pta-end" onClick={onEndSession} data-testid="button-end-session">
              <Power size={17} aria-hidden="true" />
              <span className="pta-control-copy">
                <strong>{t.agentSession.endShift}</strong>
                <span>{t.agentWorkspace.toolbar.endShiftHint}</span>
              </span>
            </button>
          )}

          {isSessionActive && onToggleInboundRingtone && (
            <button
              type="button"
              className={`pta-icon-control ${inboundRingtoneEnabled ? "pta-ringtone-on" : ""} ${callForwardingActive ? "pta-forwarding" : ""}`}
              onClick={onToggleInboundRingtone}
              data-testid="button-toggle-inbound-ringtone"
              aria-pressed={!!inboundRingtoneEnabled}
               aria-label={`${callForwardingActive ? `${t.agentSession.callForwardingActive}: ${fwdData?.number}. ` : ""}${inboundRingtoneEnabled ? t.agentWorkspace.inboundRingtoneOn : t.agentWorkspace.inboundRingtoneOff}`}
              title={callForwardingActive
                ? `${t.agentSession.callForwardingActive} → ${fwdData?.number} · ${inboundRingtoneEnabled ? t.agentWorkspace.inboundRingtoneOn : t.agentWorkspace.inboundRingtoneOff}`
                : inboundRingtoneEnabled ? t.agentWorkspace.inboundRingtoneOn : t.agentWorkspace.inboundRingtoneOff}
            >
              {callForwardingActive && <PhoneForwarded size={16} />}
              {callForwardingActive && <span className="pta-forwarding-number">{fwdData?.number}</span>}
              {inboundRingtoneEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          )}

          <span className="pta-divider" aria-hidden="true" />
          <div className="pta-timer">
            <Clock3 size={16} />
            <strong data-testid="text-work-time">{workTime}</strong>
             <span>{isSessionActive ? t.agentWorkspace.toolbar.onShift : t.agentSession.statusOffline}</span>
          </div>

          <div className="pta-micro-counts" aria-label={t.agentWorkspace.toolbar.sessionActivity}>
            <span className={isQuotaBlocked("calls") ? "pta-quota-blocked" : ""} data-testid="stat-calls">
              <PhoneCall size={14} /><b>{formatCount(stats.calls, quotas?.calls)}</b>
            </span>
            <span className={isQuotaBlocked("emails") ? "pta-quota-blocked" : ""} data-testid="stat-emails">
              <Mail size={14} /><b>{formatCount(stats.emails, quotas?.emails)}</b>
            </span>
            <span className={`pta-micro-pending ${isQuotaBlocked("sms") ? "pta-quota-blocked" : ""}`} data-testid="stat-sms">
              <MessageSquare size={14} /><b>{formatCount(stats.sms, quotas?.sms)}</b>
            </span>
          </div>

          {onOpenScheduledQueue && (
            <button
              type="button"
              className={`pta-queue ${(scheduledQueueCounts?.overdue || 0) > 0 ? "pta-queue-overdue" : ""}`}
              onClick={onOpenScheduledQueue}
              data-testid="btn-open-scheduled-queue"
              aria-label={`${t.agentWorkspace.toolbar.scheduledQueue}: ${scheduledQueueCounts?.total || 0}`}
            >
              <CalendarClock size={18} />
              <span className="pta-control-copy">
                <strong>{t.agentWorkspace.queue}</strong>
                <span>{t.agentWorkspace.toolbar.scheduledQueue}</span>
              </span>
              {(scheduledQueueCounts?.total || 0) > 0 && <b data-testid="badge-scheduled-total">{scheduledQueueCounts!.total}</b>}
              {(scheduledQueueCounts?.overdue || 0) > 0 && <span className="pta-urgency-dot" aria-label={t.agentWorkspace.toolbar.overdue} />}
            </button>
          )}
        </div>

        <div className="pta-shortcuts">
          {onOpenAbandonedCalls && (
            <button
              type="button"
              className="pta-button pta-missed"
              onClick={onOpenAbandonedCalls}
              data-testid="btn-open-abandoned-calls"
               aria-label={`${t.agentWorkspace.toolbar.missedCommunications}: ${t.agentWorkspace.missedCallsTab} ${missedCommunicationCounts?.calls || 0}, ${t.agentWorkspace.missedEmailsTab} ${missedCommunicationCounts?.emails || 0}, ${t.agentWorkspace.missedSmsTab} ${missedCommunicationCounts?.sms || 0}`}
            >
              <span className="pta-symbol"><Inbox size={21} strokeWidth={1.7} /></span>
              <span className="pta-copy">
                <strong>{t.agentWorkspace.toolbar.missedCommunications}</strong>
                <span>{t.agentWorkspace.toolbar.missedCommunicationsHint}</span>
              </span>
              <span className="pta-counts">
                 <span className={`pta-counter ${(missedCommunicationCounts?.calls || 0) > 0 ? "pta-pending" : ""}`} title={t.agentWorkspace.missedCallsTab} aria-label={`${t.agentWorkspace.missedCallsTab}: ${missedCommunicationCounts?.calls || 0}`} data-testid="badge-missed-calls">
                  <PhoneMissed size={14} /><b>{missedCommunicationCounts?.calls || 0}</b>
                </span>
                 <span className={`pta-counter ${(missedCommunicationCounts?.emails || 0) > 0 ? "pta-pending" : ""}`} title={t.agentWorkspace.missedEmailsTab} aria-label={`${t.agentWorkspace.missedEmailsTab}: ${missedCommunicationCounts?.emails || 0}`} data-testid="badge-missed-emails">
                  <Mail size={14} /><b>{missedCommunicationCounts?.emails || 0}</b>
                </span>
                 <span className={`pta-counter ${(missedCommunicationCounts?.sms || 0) > 0 ? "pta-pending" : ""}`} title={t.agentWorkspace.missedSmsTab} aria-label={`${t.agentWorkspace.missedSmsTab}: ${missedCommunicationCounts?.sms || 0}`} data-testid="badge-missed-sms">
                  <MessageSquare size={14} /><b>{missedCommunicationCounts?.sms || 0}</b>
                </span>
              </span>
              <span className="pta-open-indicator">{t.agentWorkspace.toolbar.open}</span>
            </button>
          )}
          {onOpenMyActivity && (
            <button type="button" className="pta-button pta-shift" onClick={onOpenMyActivity} data-testid="btn-open-my-activity">
              <span className="pta-symbol"><History size={21} strokeWidth={1.7} /></span>
              <span className="pta-copy">
                <strong>{t.agentWorkspace.todayCallsButtonLabel}</strong>
                <span>{t.agentWorkspace.toolbar.myShiftHint}</span>
              </span>
              <span className="pta-open-indicator">{t.agentWorkspace.toolbar.open}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}