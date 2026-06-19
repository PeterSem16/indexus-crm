import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, PhoneOff, PhoneIncoming, Mic, MicOff, PauseCircle, PlayCircle,
  Hash, Check, ChevronDown, ChevronUp, Info, Zap, Coffee, LogOut, User,
  Clock, ChevronRight, AlertCircle, FileText, ListChecks,
  Mail, MapPin, Calendar, ArrowLeft, Search, X, Baby, Building2,
  History, PhoneCall, Stethoscope, UserX } from "lucide-react";
import { format } from "date-fns";

/* ── helpers ────────────────────────────────────────────────────────── */
const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function ccName(cc: any): string {
  if (cc.customer) return `${cc.customer.firstName || ""} ${cc.customer.lastName || ""}`.trim() || "—";
  if (cc.hospital) return cc.hospital.name || "Hospital";
  if (cc.clinic) return cc.clinic.clinicName || cc.clinic.name || "Clinic";
  if (cc.collaborator) return `${cc.collaborator.firstName || ""} ${cc.collaborator.lastName || ""}`.trim() || "Collaborator";
  return "—";
}
function ccPhone(cc: any): string {
  if (cc.customer) return cc.customer.phone || cc.customer.mobile || "";
  if (cc.hospital) return cc.hospital.phone || "";
  if (cc.clinic) return cc.clinic.phone || "";
  if (cc.collaborator) return cc.collaborator.phone || cc.collaborator.mobile || "";
  return "";
}
function ccInitials(cc: any): string {
  const n = ccName(cc);
  return n.split(" ").filter(Boolean).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
}
function ccSearchMatch(cc: any, q: string): boolean {
  if (!q.trim()) return true;
  const lower = q.toLowerCase();
  const name = ccName(cc).toLowerCase();
  const phone = ccPhone(cc).replace(/\s/g, "");
  const clinic = (cc.clinic?.clinicName || cc.clinic?.name || "").toLowerCase();
  const hospital = (cc.hospital?.name || "").toLowerCase();
  return name.includes(lower) || phone.includes(lower) || clinic.includes(lower) || hospital.includes(lower);
}

const STATUS_DOT: Record<string, string> = {
  available: "bg-emerald-500",
  busy: "bg-amber-500",
  break: "bg-yellow-500",
  wrap_up: "bg-orange-500",
  offline: "bg-gray-400",
};

/* ── props ──────────────────────────────────────────────────────────── */
export interface MobileAgentWorkspaceProps {
  contact: any;
  contactType?: string;
  campaign: any;
  campaignContacts: any[];
  currentCampaignContactId: string | null;
  onSelectContact: (cc: any) => void;
  onClearContact: () => void;

  callState: string;
  callDuration: number;
  ringDuration: number;
  hungUpBy: "user" | "customer" | null;
  isMuted: boolean;
  isOnHold: boolean;
  callerNumber: string;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleHold: () => void;
  onSendDtmf: (digit: string) => void;
  onMakeCall: (phone: string) => void;
  isSipRegistered: boolean;

  sipIncomingCall: any;
  onAnswerIncoming: () => void;
  onRejectIncoming: () => void;

  onOpenDisposition: () => void;
  isStatusListMode: boolean;

  dbStatusList: any[];
  dbSlChecked: Set<string>;
  onSlToggle: (itemId: string, checked: boolean) => void;

  agentStatus: string;
  isOnBreak: boolean;
  workTime: string;
  breakTypes: Array<{ id: string; name: string; maxDurationMinutes?: number }>;
  onEndSession: () => void;
  onStartBreak: (id: string) => void;
  onEndBreak: () => void;
  onFullLogout: () => void;

  t: any;
  locale: string;
}

/* ── MobileHeader ───────────────────────────────────────────────────── */
function MobileHeader({ agentStatus, isOnBreak, workTime, breakTypes, onStartBreak, onEndBreak,
  breakMenuOpen, setBreakMenuOpen, onLogout, t }: {
  agentStatus: string; isOnBreak: boolean; workTime: string;
  breakTypes: Array<{ id: string; name: string; maxDurationMinutes?: number }>;
  onStartBreak: (id: string) => void; onEndBreak: () => void;
  breakMenuOpen: boolean; setBreakMenuOpen: (v: boolean) => void;
  onLogout?: () => void;
  t: any;
}) {
  const np = t?.nexusPulse || {};
  const statusKey = isOnBreak ? "break" : agentStatus;
  const statusLabel: Record<string, string> = {
    available: np.statusAvailable || "Available",
    busy: np.statusBusy || "Busy",
    break: np.statusBreak || "Break",
    wrap_up: np.statusWrapUp || "Wrap-up",
    offline: np.statusOffline || "Offline",
  };

  return (
    <div className="shrink-0 h-14 border-b bg-card flex items-center justify-between px-4 gap-3 relative z-40">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${STATUS_DOT[statusKey] || "bg-gray-400"} ${statusKey === "available" ? "animate-pulse" : ""}`} />
        <span className="text-sm font-semibold truncate">{statusLabel[statusKey] || statusKey}</span>
        {workTime && <span className="text-xs text-muted-foreground hidden sm:inline">· {workTime}</span>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setBreakMenuOpen(!breakMenuOpen)}
          className={`flex items-center gap-1.5 h-10 px-4 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
            isOnBreak ? "bg-yellow-500 text-white shadow-md shadow-yellow-500/30" : "bg-muted text-foreground"
          }`}
          data-testid="btn-mobile-break-toggle"
        >
          <Coffee className="h-4 w-4" />
          {isOnBreak ? np.pauseActive || "Break" : np.pauseBtn || "Break"}
        </button>
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 h-10 px-4 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-semibold text-sm border border-red-200 dark:border-red-800 active:scale-95 transition-all"
            data-testid="btn-mobile-logout"
          >
            <LogOut className="h-4 w-4" />
            {np.endShiftBtn || "End"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── BreakMenu ──────────────────────────────────────────────────────── */
function BreakMenu({ isOnBreak, breakTypes, onStartBreak, onEndBreak, setBreakMenuOpen, t }: {
  isOnBreak: boolean;
  breakTypes: Array<{ id: string; name: string; maxDurationMinutes?: number }>;
  onStartBreak: (id: string) => void; onEndBreak: () => void;
  setBreakMenuOpen: (v: boolean) => void;
  t: any;
}) {
  const np = t?.nexusPulse || {};
  return (
    <div className="absolute top-14 left-0 right-0 z-50 bg-background border-b shadow-lg">
      {isOnBreak ? (
        <button
          onClick={() => { onEndBreak(); setBreakMenuOpen(false); }}
          className="w-full flex items-center gap-3 px-5 py-4 text-left active:bg-muted"
          data-testid="btn-mobile-end-break"
        >
          <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center shrink-0">
            <Phone className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold">{np.endBreak || "End break"}</p>
            <p className="text-xs text-muted-foreground">{np.backToWork || "Back to work"}</p>
          </div>
        </button>
      ) : (
        breakTypes.map((bt) => (
          <button
            key={bt.id}
            onClick={() => { onStartBreak(bt.id); setBreakMenuOpen(false); }}
            className="w-full flex items-center gap-3 px-5 py-4 text-left active:bg-muted border-t first:border-t-0"
            data-testid={`btn-mobile-break-${bt.id}`}
          >
            <div className="h-10 w-10 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center shrink-0">
              <Coffee className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-bold">{bt.name}</p>
              {bt.maxDurationMinutes && (
                <p className="text-xs text-muted-foreground">Max {bt.maxDurationMinutes} min</p>
              )}
            </div>
          </button>
        ))
      )}
    </div>
  );
}

/* ── BackBar ────────────────────────────────────────────────────────── */
function BackBar({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <button
      onClick={onBack}
      className="w-full flex items-center gap-3 px-4 py-3.5 bg-muted/60 border-b active:bg-muted transition-colors"
      data-testid="btn-mobile-back-to-list"
    >
      <div className="h-9 w-9 rounded-xl bg-background border flex items-center justify-center shrink-0">
        <ArrowLeft className="h-5 w-5 text-foreground" />
      </div>
      <span className="text-sm font-bold text-foreground">{label}</span>
    </button>
  );
}

/* ── StatusListPanel — hierarchical, large touch targets ────────────── */
function StatusListPanel({ items, checked, onToggle, np }: {
  items: any[];
  checked: Set<string>;
  onToggle: (id: string, v: boolean) => void;
  np: any;
}) {
  const [open, setOpen] = useState(true);

  const topLevel = items.filter((i: any) => !i.parentId && i.itemType !== "option" && i.confirmationType !== "auto" && !i.isHidden);
  const options = items.filter((i: any) => !i.isHidden && i.itemType === "option");
  const getChildren = (parentId: string) => items.filter((i: any) => String(i.parentId) === String(parentId) && !i.isHidden);

  const confirmed = topLevel.filter((i: any) => checked.has(String(i.id))).length;
  const total = topLevel.length;

  if (total === 0 && options.length === 0) return null;

  return (
    <div className="mx-4 mb-4 rounded-2xl border bg-card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3.5 active:bg-muted"
        onClick={() => setOpen(v => !v)}
        data-testid="btn-mobile-sl-toggle"
      >
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold">{np.statusList || "Status list"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            confirmed === total && total > 0 ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
          }`}>{confirmed}/{total}</span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t">
          {topLevel.map((item: any) => {
            const isChecked = checked.has(String(item.id));
            const isInfo = item.confirmationType === "info";
            const subs = getChildren(String(item.id));

            return (
              <div key={item.id} className="border-b last:border-b-0">
                {/* Parent row — split into icon button + text button so full row is tappable */}
                <div className={`flex items-stretch ${isChecked ? "bg-emerald-50/60 dark:bg-emerald-900/15" : ""}`}>
                  <button
                    disabled={isInfo}
                    onClick={() => !isInfo && onToggle(String(item.id), !isChecked)}
                    className={`shrink-0 flex items-center justify-center w-14 min-h-[56px] ${isInfo ? "cursor-default opacity-60" : "active:bg-muted/60"}`}
                    data-testid={`sl-mobile-check-${item.id}`}
                  >
                    {isInfo ? (
                      <Info className="h-5 w-5 text-blue-500" />
                    ) : (
                      <div className={`h-7 w-7 rounded-lg border-2 flex items-center justify-center transition-all ${
                        isChecked ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/40 bg-background"
                      }`}>
                        {isChecked && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
                      </div>
                    )}
                  </button>
                  <button
                    disabled={isInfo}
                    onClick={() => !isInfo && onToggle(String(item.id), !isChecked)}
                    className="flex-1 py-3.5 pr-4 text-left min-h-[56px]"
                  >
                    <p className={`text-sm leading-snug ${isChecked ? "font-bold text-emerald-700 dark:text-emerald-300" : "font-semibold"}`}>
                      {item.label}
                      {item.required && <span className="ml-1 text-rose-500">*</span>}
                    </p>
                    {item.description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>}
                  </button>
                </div>

                {/* Sub-questions — only visible when parent is checked */}
                {isChecked && subs.length > 0 && (
                  <div className="bg-muted/30 border-t">
                    {subs.map((sub: any) => {
                      const subChecked = checked.has(String(sub.id));
                      const subIsInfo = sub.confirmationType === "info";
                      return (
                        <div key={sub.id} className={`flex items-stretch border-b last:border-b-0 pl-4 ${subChecked ? "bg-emerald-50/40 dark:bg-emerald-900/10" : ""}`}>
                          <button
                            disabled={subIsInfo}
                            onClick={() => !subIsInfo && onToggle(String(sub.id), !subChecked)}
                            className={`shrink-0 flex items-center justify-center w-12 min-h-[48px] ${subIsInfo ? "cursor-default opacity-60" : "active:bg-muted/60"}`}
                            data-testid={`sl-mobile-sub-${sub.id}`}
                          >
                            {subIsInfo ? (
                              <Info className="h-4 w-4 text-blue-400" />
                            ) : (
                              <div className={`h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all ${
                                subChecked ? "bg-emerald-400 border-emerald-400" : "border-muted-foreground/30 bg-background"
                              }`}>
                                {subChecked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                              </div>
                            )}
                          </button>
                          <button
                            disabled={subIsInfo}
                            onClick={() => !subIsInfo && onToggle(String(sub.id), !subChecked)}
                            className="flex-1 py-3 pr-4 text-left min-h-[48px]"
                          >
                            <p className={`text-xs leading-snug ${subChecked ? "font-bold text-emerald-600 dark:text-emerald-400" : "font-medium text-muted-foreground"}`}>
                              ↳ {sub.label}
                              {sub.required && <span className="ml-1 text-rose-500">*</span>}
                            </p>
                            {sub.description && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{sub.description}</p>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {options.length > 0 && (
            <div className="px-4 py-3 bg-amber-50/40 dark:bg-amber-950/10 border-t">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
                <Zap className="h-3 w-3" /> {np.statusListOptions || "Options"}
              </p>
              <div className="flex flex-wrap gap-2">
                {options.map((opt: any) => (
                  <button key={opt.id}
                    className="px-3 py-2 rounded-xl text-sm font-bold text-white active:scale-95 transition-all min-h-[40px]"
                    style={{ backgroundColor: opt.color || "#6b7280" }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── ContactRow ─────────────────────────────────────────────────────── */
function ContactRow({ cc, onSelect, isOverdue, isUpcoming, callbackDate, np }: {
  cc: any; onSelect: (cc: any) => void;
  isOverdue?: boolean; isUpcoming?: boolean;
  callbackDate?: string; np: any;
}) {
  const name = ccName(cc);
  const phone = ccPhone(cc);
  const initials = ccInitials(cc);
  const isCallback = isOverdue || isUpcoming;

  return (
    <button
      onClick={() => onSelect(cc)}
      className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left active:scale-[0.98] transition-all ${
        isOverdue ? "border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/10"
        : isUpcoming ? "border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/10"
        : "bg-card"
      }`}
      data-testid={`btn-contact-row-${cc.id}`}
    >
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 ${
        isOverdue ? "bg-red-400"
        : isUpcoming ? "bg-blue-500"
        : "bg-gradient-to-br from-primary/80 to-primary"
      }`}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">{name}</p>
        {phone && <p className="text-xs text-muted-foreground truncate">{phone}</p>}
        {callbackDate && (
          <div className="flex items-center gap-1 mt-0.5">
            <Calendar className={`h-3 w-3 ${isOverdue ? "text-red-500" : "text-blue-500"}`} />
            <p className={`text-xs font-semibold ${isOverdue ? "text-red-500" : "text-blue-500"}`}>
              {isOverdue ? (np.overdue || "Overdue") + " · " : ""}
              {(() => { try { return format(new Date(callbackDate), "d. M. HH:mm"); } catch { return callbackDate; } })()}
            </p>
          </div>
        )}
      </div>
      {isCallback
        ? <PhoneCall className={`h-4 w-4 shrink-0 ${isOverdue ? "text-red-400" : "text-blue-400"}`} />
        : <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
      }
    </button>
  );
}

/* ── main component ─────────────────────────────────────────────────── */
export function MobileAgentWorkspace(props: MobileAgentWorkspaceProps) {
  const {
    contact, contactType = "customer", campaign, campaignContacts,
    currentCampaignContactId, onSelectContact, onClearContact,
    callState, callDuration, ringDuration, hungUpBy,
    isMuted, isOnHold, callerNumber,
    onEndCall, onToggleMute, onToggleHold, onSendDtmf, onMakeCall, isSipRegistered,
    sipIncomingCall, onAnswerIncoming, onRejectIncoming,
    onOpenDisposition, isStatusListMode,
    dbStatusList, dbSlChecked, onSlToggle,
    agentStatus, isOnBreak, workTime, breakTypes,
    onEndSession, onStartBreak, onEndBreak,
    onFullLogout, t,
  } = props;

  const np = t?.nexusPulse || {};

  const [dtmfOpen, setDtmfOpen] = useState(false);
  const [breakMenuOpen, setBreakMenuOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  const isCallActive = ["active", "on_hold", "connecting", "ringing"].includes(callState);
  const isCallEnded = callState === "ended";
  const hasContact = !!contact || !!currentCampaignContactId;

  const now = new Date();
  const callbackContacts = campaignContacts.filter((cc: any) => cc.status === "callback_scheduled" && cc.callbackDate);
  const overdueCallbacks = callbackContacts.filter((cc: any) => new Date(cc.callbackDate) <= now);
  const upcomingCallbacks = callbackContacts.filter((cc: any) => new Date(cc.callbackDate) > now);
  const pendingContacts = campaignContacts.filter((cc: any) => cc.status === "pending");

  const headerProps = { agentStatus, isOnBreak, workTime, breakTypes, onStartBreak, onEndBreak, breakMenuOpen, setBreakMenuOpen, t };
  const breakMenuProps = { isOnBreak, breakTypes, onStartBreak, onEndBreak, setBreakMenuOpen, t };

  // Fetch call history for current contact
  const seg = contactType === "hospital" ? "hospitals"
    : contactType === "clinic" ? "clinics"
    : contactType === "collaborator" ? "collaborators"
    : "customers";
  const { data: contactHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/entity-history", contact?.id, contactType],
    queryFn: async () => {
      const res = await fetch(`/api/${seg}/${contact!.id}/contact-history`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!contact?.id,
  });
  const recentCalls = contactHistory.filter((e: any) => e.type === "call").slice(0, 8);

  /* ── LOGOUT CONFIRM ─────────────────────────────────────────────── */
  if (logoutConfirm) {
    return (
      <div className="flex flex-col h-full">
        <MobileHeader {...headerProps} />
        {breakMenuOpen && <BreakMenu {...breakMenuProps} />}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <div className="h-20 w-20 rounded-2xl bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
            <LogOut className="h-10 w-10 text-red-500" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold mb-1">{np.logoutConfirmTitle || "End shift?"}</p>
            <p className="text-sm text-muted-foreground">{np.logoutConfirmText || "Choose how you want to end."}</p>
          </div>
          <div className="w-full flex flex-col gap-3">
            <button onClick={() => { setLogoutConfirm(false); onEndSession(); }}
              className="w-full h-14 rounded-2xl bg-amber-500 text-white font-bold text-base active:scale-[0.98] transition-all shadow-lg shadow-amber-500/25"
              data-testid="btn-mobile-end-session">
              {np.endSessionOnly || "End shift (session)"}
            </button>
            <button onClick={() => { setLogoutConfirm(false); onFullLogout(); }}
              className="w-full h-14 rounded-2xl bg-red-500 text-white font-bold text-base active:scale-[0.98] transition-all shadow-lg shadow-red-500/25"
              data-testid="btn-mobile-full-logout">
              {np.fullLogout || "Sign out of INDEXUS"}
            </button>
            <button onClick={() => setLogoutConfirm(false)}
              className="w-full h-12 rounded-2xl bg-muted text-foreground font-semibold text-sm active:scale-[0.98] transition-all"
              data-testid="btn-mobile-cancel-logout">
              {np.cancel || "Cancel"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── INCOMING CALL OVERLAY ─────────────────────────────────────────── */
  if (sipIncomingCall) {
    return (
      <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center gap-8 px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-28 w-28">
            <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
            <div className="absolute inset-2 rounded-full bg-green-500/10 animate-ping" style={{ animationDelay: "0.3s" }} />
            <div className="relative h-28 w-28 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center">
              <PhoneIncoming className="h-12 w-12 text-green-500" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">{np.incomingCall || "Incoming call"}</p>
            <p className="text-3xl font-bold">{sipIncomingCall.callerName || sipIncomingCall.callerNumber || "—"}</p>
            {sipIncomingCall.callerName && <p className="text-base text-muted-foreground mt-1">{sipIncomingCall.callerNumber}</p>}
          </div>
        </div>
        <div className="flex items-center justify-center gap-16">
          <div className="flex flex-col items-center gap-2">
            <button onClick={onRejectIncoming}
              className="h-20 w-20 rounded-full bg-red-500 active:scale-95 transition-all flex items-center justify-center shadow-xl shadow-red-500/40"
              data-testid="btn-mobile-reject">
              <PhoneOff className="h-9 w-9 text-white" />
            </button>
            <span className="text-sm font-semibold text-muted-foreground">{np.reject || "Reject"}</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button onClick={onAnswerIncoming}
              className="h-20 w-20 rounded-full bg-green-500 active:scale-95 transition-all flex items-center justify-center shadow-xl shadow-green-500/40"
              data-testid="btn-mobile-answer">
              <Phone className="h-9 w-9 text-white" />
            </button>
            <span className="text-sm font-semibold text-muted-foreground">{np.answer || "Answer"}</span>
          </div>
        </div>
      </div>
    );
  }

  /* ── ACTIVE CALL VIEW ─────────────────────────────────────────────── */
  if (hasContact && isCallActive) {
    const fullName = contact ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || contact.name || "—" : "—";
    const phone = contact?.phone || callerNumber || "";
    return (
      <div className="flex flex-col h-full">
        <MobileHeader {...headerProps} onLogout={() => setLogoutConfirm(true)} />
        {breakMenuOpen && <BreakMenu {...breakMenuProps} />}
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex flex-col items-center py-8 px-4 gap-4">
            <div className={`h-24 w-24 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-xl ${
              callState === "connecting" || callState === "ringing" ? "bg-amber-500 shadow-amber-500/30 animate-pulse"
              : callState === "on_hold" ? "bg-orange-500 shadow-orange-500/30"
              : "bg-green-500 shadow-green-500/30"
            }`}>
              {contact ? ((contact.firstName?.[0] || "") + (contact.lastName?.[0] || "")).toUpperCase() || <Phone className="h-10 w-10" /> : <Phone className="h-10 w-10" />}
            </div>
            <div className="text-center">
              <p className="text-xl font-bold">{fullName}</p>
              {phone && <p className="text-sm text-muted-foreground mt-0.5">{phone}</p>}
              <p className={`text-sm font-semibold mt-1 ${
                callState === "ringing" || callState === "connecting" ? "text-amber-500"
                : callState === "on_hold" ? "text-orange-500" : "text-green-500"
              }`}>
                {callState === "connecting" ? np.connecting || "Connecting…"
                : callState === "ringing" ? `${np.ringing || "Ringing"} ${fmtDur(ringDuration)}`
                : callState === "on_hold" ? np.onHold || "On hold"
                : fmtDur(callDuration)}
              </p>
            </div>
          </div>
          <div className="px-4 pb-4">
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { icon: isMuted ? MicOff : Mic, label: isMuted ? np.unmute || "Unmute" : np.mute || "Mute", onClick: onToggleMute, active: isMuted, testId: "btn-mobile-mute" },
                { icon: isOnHold ? PlayCircle : PauseCircle, label: isOnHold ? np.resume || "Resume" : np.hold || "Hold", onClick: onToggleHold, active: isOnHold, testId: "btn-mobile-hold" },
                { icon: Hash, label: np.keyboard || "Keys", onClick: () => setDtmfOpen(v => !v), active: dtmfOpen, testId: "btn-mobile-dtmf" },
                { icon: PhoneOff, label: np.hangup || "Hang up", onClick: onEndCall, active: false, testId: "btn-mobile-hangup", red: true },
              ].map(({ icon: Icon, label, onClick, active, testId, red }: any) => (
                <div key={testId} className="flex flex-col items-center gap-1.5">
                  <button onClick={onClick}
                    className={`h-14 w-14 rounded-2xl flex items-center justify-center active:scale-95 transition-all ${
                      red ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                      : active ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-muted text-foreground"
                    }`}
                    data-testid={testId}>
                    <Icon className="h-6 w-6" />
                  </button>
                  <span className="text-[10px] font-semibold text-center leading-tight text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
            {dtmfOpen && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {["1","2","3","4","5","6","7","8","9","*","0","#"].map(d => (
                  <button key={d} onClick={() => onSendDtmf(d)}
                    className="h-12 rounded-xl bg-muted font-bold text-lg active:scale-95 transition-all"
                    data-testid={`btn-dtmf-${d}`}>{d}</button>
                ))}
              </div>
            )}
          </div>
          <StatusListPanel items={dbStatusList} checked={dbSlChecked} onToggle={onSlToggle} np={np} />
        </div>
      </div>
    );
  }

  /* ── CALL ENDED VIEW ─────────────────────────────────────────────── */
  if (hasContact && isCallEnded) {
    return (
      <div className="flex flex-col h-full">
        <MobileHeader {...headerProps} onLogout={() => setLogoutConfirm(true)} />
        {breakMenuOpen && <BreakMenu {...breakMenuProps} />}
        <BackBar onBack={onClearContact} label={np.backToList || "Back to list"} />
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 px-4 pt-3 pb-4">
          <div className="rounded-2xl border bg-card p-4 text-center">
            <div className="h-16 w-16 rounded-full bg-muted mx-auto flex items-center justify-center mb-3">
              <PhoneOff className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-bold">{np.callEnded || "Call ended"}</p>
            {hungUpBy && (
              <p className="text-xs text-muted-foreground mt-1">
                {hungUpBy === "user" ? np.hungUpByAgent || "You hung up" : np.hungUpByCustomer || "Customer hung up"}
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-1">{fmtDur(callDuration)}</p>
          </div>
          {!isStatusListMode && (
            <button onClick={onOpenDisposition}
              className="w-full h-16 rounded-2xl bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-bold text-base flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-all"
              data-testid="btn-mobile-evaluate">
              <FileText className="h-6 w-6" />
              {np.evaluateCall || "Evaluate call"}
            </button>
          )}
          <StatusListPanel items={dbStatusList} checked={dbSlChecked} onToggle={onSlToggle} np={np} />
        </div>
      </div>
    );
  }

  /* ── CONTACT DETAIL VIEW ─────────────────────────────────────────── */
  if (hasContact && contact) {
    const fullName = `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || contact.name || "—";
    const initials = (contact.firstName && contact.lastName)
      ? ((contact.firstName[0] || "") + (contact.lastName[0] || "")).toUpperCase()
      : (fullName[0] || "?").toUpperCase();

    // Collect all phone numbers deduped
    const phoneNumbers: Array<{ label: string; value: string }> = [];
    const seen = new Set<string>();
    const addPhone = (label: string, val: string | null | undefined) => {
      if (val && !seen.has(val)) { seen.add(val); phoneNumbers.push({ label, value: val }); }
    };
    addPhone(np.phone || "Phone", contact.phone);
    addPhone(np.mobile || "Mobile", contact.mobile);
    addPhone(np.phone2 || "Phone 2", contact.phone2 || contact.mobile2);
    addPhone(np.otherContact || "Other", contact.otherContact);

    return (
      <div className="flex flex-col h-full">
        <MobileHeader {...headerProps} onLogout={() => setLogoutConfirm(true)} />
        {breakMenuOpen && <BreakMenu {...breakMenuProps} />}

        <BackBar onBack={onClearContact} label={np.backToList || "Back to list"} />

        <div className="flex-1 overflow-y-auto flex flex-col gap-3 px-4 pt-3 pb-4">
          {/* Contact card */}
          <div className="rounded-2xl border bg-card p-4 flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-xl font-bold text-primary-foreground shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold truncate">{fullName}</p>
              {contact.city && (
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  {contact.city}{contact.country ? `, ${contact.country}` : ""}
                </p>
              )}
              {contactType !== "customer" && (
                <span className="inline-flex items-center gap-1 mt-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium capitalize">
                  <Building2 className="h-3 w-3" />{contactType}
                </span>
              )}
            </div>
          </div>

          {/* Release contact — status list mode */}
          {isStatusListMode && (
            <button onClick={onClearContact}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-dashed border-amber-400 text-amber-600 dark:text-amber-400 text-sm font-semibold bg-amber-50/50 dark:bg-amber-950/10 active:scale-[0.98] transition-all"
              data-testid="btn-mobile-release-contact">
              <UserX className="h-4 w-4" />
              {np.releaseContact || "Release contact / skip"}
            </button>
          )}

          {/* Phone buttons */}
          {phoneNumbers.length > 0 ? (
            <div className="flex flex-col gap-2">
              {phoneNumbers.map(({ label, value }) => (
                <button key={value} onClick={() => onMakeCall(value)}
                  disabled={!isSipRegistered}
                  className="w-full h-14 rounded-2xl bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white font-bold flex items-center justify-center gap-3 shadow-lg shadow-green-500/20 active:scale-[0.98] transition-all"
                  data-testid={`btn-mobile-call-${label.toLowerCase().replace(/\s/g, "-")}`}>
                  <Phone className="h-6 w-6 shrink-0" />
                  <div className="flex flex-col items-start leading-tight">
                    <span className="text-[10px] font-normal opacity-80">{label}</span>
                    <span className="text-base">{value}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="w-full h-14 rounded-2xl bg-muted flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              {np.noPhone || "No phone number"}
            </div>
          )}

          {/* Contact details accordion */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <button onClick={() => setShowDetails(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3.5 active:bg-muted transition-colors"
              data-testid="btn-mobile-view-details">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold">{np.viewDetails || "Contact details"}</span>
              </div>
              {showDetails ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {showDetails && (
              <div className="border-t divide-y text-sm">
                {contact.email && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-semibold truncate">{contact.email}</p>
                    </div>
                  </div>
                )}
                {contact.email2 && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Email 2</p>
                      <p className="font-semibold truncate">{contact.email2}</p>
                    </div>
                  </div>
                )}
                {contact.dateOfBirth && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{np.dateOfBirth || "Date of birth"}</p>
                      <p className="font-semibold">
                        {(() => { try { return format(new Date(contact.dateOfBirth), "d. M. yyyy"); } catch { return contact.dateOfBirth; } })()}
                      </p>
                    </div>
                  </div>
                )}
                {contact.nationalId && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{np.nationalId || "National ID"}</p>
                      <p className="font-semibold">{contact.nationalId}</p>
                    </div>
                  </div>
                )}
                {(contact.address || contact.street || contact.city || contact.country) && (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{np.address || "Address"}</p>
                      <p className="font-semibold leading-snug">
                        {[contact.address || contact.street, contact.city, contact.postalCode, contact.country].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  </div>
                )}
                {contact.gynecologistName && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Stethoscope className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{np.gynecologist || "Gynecologist"}</p>
                      <p className="font-semibold">{contact.gynecologistName}</p>
                      {contact.gynecologistPhone && <p className="text-xs text-muted-foreground mt-0.5">{contact.gynecologistPhone}</p>}
                    </div>
                  </div>
                )}
                {contact.hospitalName && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{np.hospital || "Hospital"}</p>
                      <p className="font-semibold">{contact.hospitalName}</p>
                    </div>
                  </div>
                )}
                {contact.expectedDeliveryDate && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Baby className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{np.expectedDelivery || "Expected delivery"}</p>
                      <p className="font-semibold">
                        {(() => { try { return format(new Date(contact.expectedDeliveryDate), "d. M. yyyy"); } catch { return contact.expectedDeliveryDate; } })()}
                      </p>
                    </div>
                  </div>
                )}
                {contact.notes && (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{np.notes || "Notes"}</p>
                      <p className="leading-relaxed text-sm">{contact.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Call history accordion */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <button onClick={() => setShowHistory(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3.5 active:bg-muted transition-colors"
              data-testid="btn-mobile-call-history">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold">{np.callHistory || "Call history"}</span>
                {recentCalls.length > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{recentCalls.length}</span>
                )}
              </div>
              {showHistory ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {showHistory && (
              <div className="border-t divide-y">
                {recentCalls.length === 0 ? (
                  <div className="px-4 py-5 text-center text-sm text-muted-foreground">{np.noCallHistory || "No call history"}</div>
                ) : recentCalls.map((entry: any, idx: number) => (
                  <div key={idx} className="px-4 py-3 flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <PhoneCall className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-muted-foreground">
                          {(entry.date || entry.createdAt)
                            ? (() => { try { return format(new Date(entry.date || entry.createdAt), "d. M. yyyy HH:mm"); } catch { return "—"; } })()
                            : "—"}
                        </p>
                        {entry.duration != null && (
                          <span className="text-xs text-muted-foreground shrink-0">{fmtDur(Number(entry.duration))}</span>
                        )}
                      </div>
                      {(entry.disposition || entry.outcome || entry.status) && (
                        <p className="text-xs font-bold mt-0.5">{entry.disposition || entry.outcome || entry.status}</p>
                      )}
                      {(entry.notes || entry.callNotes) && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{entry.notes || entry.callNotes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status list */}
          {dbStatusList.length > 0 && (
            <div className="-mx-4">
              <StatusListPanel items={dbStatusList} checked={dbSlChecked} onToggle={onSlToggle} np={np} />
            </div>
          )}

          {/* Disposition button */}
          {!isStatusListMode && (
            <button onClick={onOpenDisposition}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-bold text-base flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-all"
              data-testid="btn-mobile-evaluate">
              <FileText className="h-6 w-6" />
              {np.evaluateCall || "Evaluate call"}
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ── CONTACT LIST VIEW ───────────────────────────────────────────── */
  const filteredOverdue = overdueCallbacks.filter(cc => ccSearchMatch(cc, searchQ));
  const filteredUpcoming = upcomingCallbacks.filter(cc => ccSearchMatch(cc, searchQ));
  const filteredPending = pendingContacts.filter(cc => ccSearchMatch(cc, searchQ));
  const totalFiltered = filteredOverdue.length + filteredUpcoming.length + filteredPending.length;

  return (
    <div className="flex flex-col h-full relative">
      <MobileHeader {...headerProps} onLogout={() => setLogoutConfirm(true)} />
      {breakMenuOpen && <BreakMenu {...breakMenuProps} />}

      <div className="flex-1 overflow-y-auto flex flex-col">
        <div className="shrink-0 px-4 pt-3 pb-2 space-y-2">
          {campaign && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                <Zap className="h-3 w-3" />
                {campaign.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {totalFiltered} {np.contacts || "contacts"}
              </span>
            </div>
          )}
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder={np.searchContacts || "Search by name, phone…"}
              className="w-full h-10 pl-9 pr-9 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="input-mobile-search"
            />
            {searchQ && (
              <button onClick={() => setSearchQ("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-1">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {totalFiltered === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
            <Clock className="h-10 w-10 opacity-30" />
            <div>
              <p className="text-base font-bold">
                {searchQ ? np.noResults || "No results" : np.noContacts || "No contacts"}
              </p>
              <p className="text-sm mt-1 opacity-70">
                {searchQ ? np.tryOtherSearch || "Try a different search term."
                  : campaign ? np.noContactsInCampaign || "No contacts to call in this campaign."
                  : np.noContactsNoCampaign || "Select a campaign in the filter."}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 px-4 pb-4">
            {/* Overdue callbacks */}
            {filteredOverdue.length > 0 && (
              <>
                <div className="flex items-center gap-2 mt-2 mb-1">
                  <div className="h-px flex-1 bg-red-200 dark:bg-red-900/40" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />{np.overdueCallbacks || "Overdue callbacks"}
                  </span>
                  <div className="h-px flex-1 bg-red-200 dark:bg-red-900/40" />
                </div>
                {filteredOverdue.map(cc => (
                  <ContactRow key={cc.id} cc={cc} onSelect={onSelectContact} isOverdue callbackDate={cc.callbackDate} np={np} />
                ))}
              </>
            )}
            {/* Upcoming / planned callbacks */}
            {filteredUpcoming.length > 0 && (
              <>
                <div className="flex items-center gap-2 mt-2 mb-1">
                  <div className="h-px flex-1 bg-blue-200 dark:bg-blue-900/40" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />{np.plannedCallbacks || "Planned calls"}
                  </span>
                  <div className="h-px flex-1 bg-blue-200 dark:bg-blue-900/40" />
                </div>
                {filteredUpcoming.map(cc => (
                  <ContactRow key={cc.id} cc={cc} onSelect={onSelectContact} isUpcoming callbackDate={cc.callbackDate} np={np} />
                ))}
              </>
            )}
            {/* New / pending contacts */}
            {filteredPending.length > 0 && (
              <>
                {(filteredOverdue.length > 0 || filteredUpcoming.length > 0) && (
                  <div className="flex items-center gap-2 mt-2 mb-1">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {np.newContacts || "New contacts"}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
                {filteredPending.map(cc => (
                  <ContactRow key={cc.id} cc={cc} onSelect={onSelectContact} np={np} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
