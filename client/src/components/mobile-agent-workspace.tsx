import { useState } from "react";
import { Phone, PhoneOff, PhoneIncoming, Mic, MicOff, PauseCircle, PlayCircle,
  Hash, Check, ChevronDown, ChevronUp, Info, Zap, Coffee, LogOut, User,
  Clock, ChevronRight, AlertCircle, FileText, ListChecks, Loader2,
  Mail, MapPin, Calendar, ArrowLeft } from "lucide-react";
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
  if (cc.customer) return cc.customer.phone || "";
  if (cc.hospital) return cc.hospital.phone || "";
  if (cc.clinic) return cc.clinic.phone || "";
  if (cc.collaborator) return cc.collaborator.phone || cc.collaborator.mobile || "";
  return "";
}
function ccInitials(cc: any): string {
  const n = ccName(cc);
  return n.split(" ").filter(Boolean).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
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

/* ── BackBar — large, easy to tap back button ───────────────────────── */
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

/* ── main component ─────────────────────────────────────────────────── */
export function MobileAgentWorkspace(props: MobileAgentWorkspaceProps) {
  const {
    contact, campaign, campaignContacts, currentCampaignContactId, onSelectContact, onClearContact,
    callState, callDuration, ringDuration, hungUpBy,
    isMuted, isOnHold, callerNumber,
    onEndCall, onToggleMute, onToggleHold, onSendDtmf, onMakeCall, isSipRegistered,
    sipIncomingCall, onAnswerIncoming, onRejectIncoming,
    onOpenDisposition, isStatusListMode,
    dbStatusList, dbSlChecked, onSlToggle,
    agentStatus, isOnBreak, workTime, breakTypes, onEndSession, onStartBreak, onEndBreak,
    onFullLogout, t, locale,
  } = props;

  const np = t?.nexusPulse || {};

  const [dtmfOpen, setDtmfOpen] = useState(false);
  const [slOpen, setSlOpen] = useState(true);
  const [breakMenuOpen, setBreakMenuOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const isCallActive = ["active", "on_hold", "connecting", "ringing"].includes(callState);
  const isCallEnded = callState === "ended";
  const hasContact = !!contact || !!currentCampaignContactId;

  const slVisible = dbStatusList.filter((i: any) => !i.isHidden && i.itemType !== "option" && i.confirmationType !== "auto");
  const slOptions = dbStatusList.filter((i: any) => !i.isHidden && i.itemType === "option");
  const slConfirmed = slVisible.filter((i: any) => dbSlChecked.has(String(i.id))).length;
  const slTotal = slVisible.length;

  const now = new Date();
  const pendingContacts = campaignContacts.filter((cc: any) => cc.status === "pending");
  const callbackContacts = campaignContacts.filter((cc: any) => cc.status === "callback_scheduled" && cc.callbackDate);
  const overdueCallbacks = callbackContacts.filter((cc: any) => new Date(cc.callbackDate) <= now);
  const upcomingCallbacks = callbackContacts.filter((cc: any) => new Date(cc.callbackDate) > now);

  const headerProps = { agentStatus, isOnBreak, workTime, breakTypes, onStartBreak, onEndBreak, breakMenuOpen, setBreakMenuOpen, t };
  const breakMenuProps = { isOnBreak, breakTypes, onStartBreak, onEndBreak, setBreakMenuOpen, t };

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
            {sipIncomingCall.callerName && (
              <p className="text-base text-muted-foreground mt-1">{sipIncomingCall.callerNumber}</p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-center gap-16">
          <div className="flex flex-col items-center gap-2">
            <button onClick={onRejectIncoming}
              className="h-20 w-20 rounded-full bg-red-500 active:scale-95 transition-all flex items-center justify-center shadow-xl shadow-red-500/40"
              data-testid="btn-mobile-reject">
              <PhoneOff className="h-9 w-9 text-white" />
            </button>
            <span className="text-xs font-semibold text-red-500">{np.reject || "Reject"}</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button onClick={onAnswerIncoming}
              className="h-24 w-24 rounded-full bg-green-500 active:scale-95 transition-all flex items-center justify-center shadow-2xl shadow-green-500/40"
              data-testid="btn-mobile-answer">
              <Phone className="h-10 w-10 text-white" />
            </button>
            <span className="text-xs font-semibold text-green-500">{np.answer || "Answer"}</span>
          </div>
        </div>
      </div>
    );
  }

  /* ── LOGOUT CONFIRM ─────────────────────────────────────────────── */
  if (logoutConfirm) {
    return (
      <div className="flex flex-col h-full">
        <MobileHeader {...headerProps} onLogout={() => setLogoutConfirm(true)} />
        {breakMenuOpen && <BreakMenu {...breakMenuProps} />}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <div className="h-20 w-20 rounded-full bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-800 flex items-center justify-center">
            <LogOut className="h-9 w-9 text-red-500" />
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">{np.endShiftTitle || "End shift?"}</p>
            <p className="text-sm text-muted-foreground mt-1">{np.endShiftDesc || "You will be logged out from all campaigns and queues."}</p>
          </div>
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={() => { onEndSession(); setLogoutConfirm(false); }}
              className="w-full h-14 rounded-2xl bg-red-500 text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-red-500/30"
              data-testid="btn-mobile-confirm-logout"
            >
              <LogOut className="h-5 w-5" />
              {np.endShiftConfirm || "Yes, end shift"}
            </button>
            <button
              onClick={() => onFullLogout()}
              className="w-full h-14 rounded-2xl bg-rose-950/20 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all border border-rose-300 dark:border-rose-800"
              data-testid="btn-mobile-full-logout"
            >
              <LogOut className="h-5 w-5" />
              {np.logoutIndexus || "Log out from INDEXUS"}
            </button>
            <button
              onClick={() => setLogoutConfirm(false)}
              className="w-full h-14 rounded-2xl bg-muted text-foreground font-bold text-base flex items-center justify-center active:scale-[0.98] transition-all"
              data-testid="btn-mobile-cancel-logout"
            >
              {np.cancel || "Cancel"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── ACTIVE / ENDED CALL VIEW ─────────────────────────────────── */
  if (isCallActive || isCallEnded) {
    const contactName = contact
      ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || callerNumber
      : callerNumber || "—";
    const initials = contact?.firstName
      ? (contact.firstName[0] || "") + (contact.lastName?.[0] || "")
      : callerNumber?.substring(0, 2) || "?";

    return (
      <div className="flex flex-col h-full">
        <MobileHeader {...headerProps} onLogout={() => setLogoutConfirm(true)} />
        {breakMenuOpen && <BreakMenu {...breakMenuProps} />}

        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className={`px-4 pt-5 pb-4 flex flex-col items-center gap-3 shrink-0 ${isCallActive ? "bg-gradient-to-b from-blue-500/8 to-transparent" : ""}`}>
            <div className={`h-[72px] w-[72px] rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-lg ${
              isCallActive ? "bg-gradient-to-br from-blue-500 to-blue-600" : "bg-muted"
            }`}>
              {initials.toUpperCase()}
            </div>
            <div className="text-center">
              <p className="text-xl font-bold">{contactName}</p>
              {contact?.phone && contact.phone !== contactName && (
                <p className="text-sm text-muted-foreground mt-0.5">{contact.phone}</p>
              )}
              {campaign && <p className="text-xs text-muted-foreground/60 mt-0.5">{campaign.name}</p>}
            </div>

            {callState === "ringing" && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                  {np.callRinging || "Ringing"}{ringDuration ? ` · ${ringDuration}s` : ""}
                </span>
              </div>
            )}
            {callState === "connecting" && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20">
                <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{np.callConnecting || "Connecting..."}</span>
              </div>
            )}
            {(callState === "active" || callState === "on_hold") && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20">
                <span className={`h-2 w-2 rounded-full ${callState === "on_hold" ? "bg-orange-400" : "bg-blue-500 animate-pulse"}`} />
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {callState === "on_hold" ? np.callHeld || "On Hold" : np.callActive || "Active"} · {fmtDur(callDuration)}
                </span>
              </div>
            )}
            {callState === "ended" && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted">
                <span className="text-sm text-muted-foreground">
                  {hungUpBy === "customer" ? np.callerHungUp || "Customer hung up" : np.callEnded || "Call ended"} · {fmtDur(callDuration)}
                </span>
              </div>
            )}
          </div>

          <div className="px-5 pb-4 shrink-0">
            {isCallActive ? (
              <>
                {dtmfOpen && (
                  <div className="mb-4 grid grid-cols-3 gap-2.5 p-3 rounded-2xl bg-muted/40 border">
                    {["1","2","3","4","5","6","7","8","9","*","0","#"].map(d => (
                      <button key={d} onClick={() => onSendDtmf(d)}
                        className="h-14 rounded-xl bg-background border text-xl font-bold active:scale-95 transition-all"
                        data-testid={`btn-dtmf-${d}`}>{d}</button>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { icon: isMuted ? MicOff : Mic, label: isMuted ? np.unmute || "Unmute" : np.mute || "Mute", onClick: onToggleMute, active: isMuted, testId: "btn-mobile-mute" },
                    { icon: isOnHold ? PlayCircle : PauseCircle, label: isOnHold ? np.resume || "Resume" : np.hold || "Hold", onClick: onToggleHold, active: isOnHold, testId: "btn-mobile-hold" },
                    { icon: Hash, label: np.keyboard || "Keyboard", onClick: () => setDtmfOpen(v => !v), active: dtmfOpen, testId: "btn-mobile-dtmf" },
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
              </>
            ) : (
              <button
                onClick={onOpenDisposition}
                className="w-full h-16 rounded-2xl bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-bold text-base flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-all"
                data-testid="btn-mobile-evaluate"
              >
                <FileText className="h-6 w-6" />
                {np.evaluateCall || "Evaluate call"}
              </button>
            )}
          </div>

          {slTotal > 0 && (
            <div className="mx-4 mb-4 rounded-2xl border bg-card overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 active:bg-muted"
                onClick={() => setSlOpen(v => !v)}
                data-testid="btn-mobile-sl-toggle"
              >
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold">{np.statusList || "Status list"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    slConfirmed === slTotal ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                  }`}>{slConfirmed}/{slTotal}</span>
                  {slOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>
              {slOpen && (
                <div className="border-t divide-y">
                  {slVisible.map((item: any) => {
                    const isChecked = dbSlChecked.has(String(item.id));
                    const isInfo = item.confirmationType === "info";
                    return (
                      <div key={item.id} className={`flex items-start gap-3 px-4 py-3.5 ${isChecked ? "bg-emerald-50/60 dark:bg-emerald-900/15" : ""}`}>
                        <div className="shrink-0 mt-0.5">
                          {isInfo ? (
                            <Info className="h-5 w-5 text-blue-500" />
                          ) : (
                            <button onClick={() => onSlToggle(String(item.id), !isChecked)}
                              className={`h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all ${
                                isChecked ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/30 bg-background"
                              }`}
                              data-testid={`sl-mobile-check-${item.id}`}>
                              {isChecked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                            </button>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug ${isChecked ? "font-bold text-emerald-700 dark:text-emerald-300" : "font-semibold"}`}>
                            {item.label}
                            {item.required && <span className="ml-1 text-rose-500">*</span>}
                          </p>
                          {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                        </div>
                      </div>
                    );
                  })}
                  {slOptions.length > 0 && (
                    <div className="px-4 py-3 bg-amber-50/40 dark:bg-amber-950/10">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
                        <Zap className="h-3 w-3" /> {np.statusListOptions || "Options"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {slOptions.map((opt: any) => (
                          <button key={opt.id}
                            className="px-3 py-1.5 rounded-lg text-sm font-bold text-white active:scale-95 transition-all"
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
          )}
        </div>
      </div>
    );
  }

  /* ── CONTACT DETAIL VIEW ─────────────────────────────────────────── */
  if (hasContact && contact) {
    const phone = contact.phone || "";
    const fullName = `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || "—";
    const initials = ((contact.firstName?.[0] || "") + (contact.lastName?.[0] || "")).toUpperCase();

    return (
      <div className="flex flex-col h-full">
        <MobileHeader {...headerProps} onLogout={() => setLogoutConfirm(true)} />
        {breakMenuOpen && <BreakMenu {...breakMenuProps} />}

        <BackBar onBack={() => onClearContact()} label={np.backToList || "Back to list"} />

        <div className="flex-1 overflow-y-auto flex flex-col gap-3 px-4 pt-3 pb-4">
          {/* Contact card */}
          <div className="rounded-2xl border bg-card p-4 flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-xl font-bold text-primary-foreground shrink-0">
              {initials || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold truncate">{fullName}</p>
              {phone && <p className="text-sm text-muted-foreground">{phone}</p>}
              {contact.city && <p className="text-xs text-muted-foreground/70">{contact.city}{contact.country ? `, ${contact.country}` : ""}</p>}
            </div>
          </div>

          {/* Call button */}
          {phone ? (
            <button
              onClick={() => onMakeCall(phone)}
              disabled={!isSipRegistered}
              className="w-full h-16 rounded-2xl bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-green-500/25 active:scale-[0.98] transition-all"
              data-testid="btn-mobile-call"
            >
              <Phone className="h-7 w-7" />
              {phone}
            </button>
          ) : (
            <div className="w-full h-14 rounded-2xl bg-muted flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              {np.noPhone || "No phone number"}
            </div>
          )}

          {/* View Details toggle */}
          <button
            onClick={() => setShowDetails(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border bg-card active:bg-muted transition-colors"
            data-testid="btn-mobile-view-details"
          >
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold">{np.viewDetails || "View details"}</span>
            </div>
            {showDetails ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {showDetails && (
            <div className="rounded-2xl border bg-card overflow-hidden divide-y text-sm">
              {contact.email && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-semibold truncate">{contact.email}</p>
                  </div>
                </div>
              )}
              {(contact.street || contact.city || contact.country) && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Adresa</p>
                    <p className="font-semibold">{[contact.street, contact.city, contact.postalCode, contact.country].filter(Boolean).join(", ")}</p>
                  </div>
                </div>
              )}
              {contact.dateOfBirth && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Dátum narodenia</p>
                    <p className="font-semibold">
                      {(() => { try { return format(new Date(contact.dateOfBirth), "d. M. yyyy"); } catch { return contact.dateOfBirth; } })()}
                    </p>
                  </div>
                </div>
              )}
              {contact.phone2 && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Telefón 2</p>
                    <p className="font-semibold">{contact.phone2}</p>
                  </div>
                </div>
              )}
              {contact.notes && (
                <div className="flex items-start gap-3 px-4 py-3">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Poznámky</p>
                    <p className="leading-relaxed">{contact.notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status list */}
          {slTotal > 0 && (
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold">{np.statusList || "Status list"}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  slConfirmed === slTotal ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                }`}>{slConfirmed}/{slTotal}</span>
              </div>
              <div className="divide-y">
                {slVisible.map((item: any) => {
                  const isChecked = dbSlChecked.has(String(item.id));
                  return (
                    <div key={item.id} className={`flex items-center gap-3 px-4 py-4 ${isChecked ? "bg-emerald-50/60 dark:bg-emerald-900/15" : ""}`}>
                      <button onClick={() => onSlToggle(String(item.id), !isChecked)}
                        className={`h-7 w-7 rounded-xl border-2 flex items-center justify-center transition-all shrink-0 ${
                          isChecked ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/30 bg-background"
                        }`}
                        data-testid={`sl-mobile-check-${item.id}`}>
                        {isChecked && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${isChecked ? "font-bold text-emerald-700 dark:text-emerald-300" : "font-semibold"}`}>
                          {item.label}
                          {item.required && <span className="ml-1 text-rose-500">*</span>}
                        </p>
                        {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                      </div>
                    </div>
                  );
                })}
                {slOptions.length > 0 && (
                  <div className="px-4 py-3 bg-amber-50/40 dark:bg-amber-950/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
                      <Zap className="h-3 w-3" /> {np.statusListOptions || "Options"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {slOptions.map((opt: any) => (
                        <button key={opt.id}
                          className="px-3 py-1.5 rounded-lg text-sm font-bold text-white active:scale-95 transition-all"
                          style={{ backgroundColor: opt.color || "#6b7280" }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── CONTACT LIST VIEW ───────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full">
      <MobileHeader {...headerProps} onLogout={() => setLogoutConfirm(true)} />
      {breakMenuOpen && <BreakMenu {...breakMenuProps} />}

      <div className="flex-1 overflow-y-auto">
        {overdueCallbacks.length > 0 && (
          <section className="px-3 pt-3 pb-1">
            <div className="flex items-center gap-2 px-1 mb-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-red-500">
                {np.sectionOverdue || "Overdue"} ({overdueCallbacks.length})
              </span>
            </div>
            <div className="space-y-2">
              {overdueCallbacks.map((cc: any) => (
                <ContactRow key={cc.id} cc={cc} onSelect={onSelectContact} isOverdue callbackDate={cc.callbackDate} />
              ))}
            </div>
          </section>
        )}

        {upcomingCallbacks.length > 0 && (
          <section className="px-3 pt-3 pb-1">
            <div className="flex items-center gap-2 px-1 mb-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {np.sectionScheduled || "Scheduled"} ({upcomingCallbacks.length})
              </span>
            </div>
            <div className="space-y-2">
              {upcomingCallbacks.map((cc: any) => (
                <ContactRow key={cc.id} cc={cc} onSelect={onSelectContact} callbackDate={cc.callbackDate} />
              ))}
            </div>
          </section>
        )}

        {pendingContacts.length > 0 && (
          <section className="px-3 pt-3 pb-3">
            <div className="flex items-center gap-2 px-1 mb-2">
              <User className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {np.sectionNew || "New"} ({pendingContacts.length})
              </span>
            </div>
            <div className="space-y-2">
              {pendingContacts.map((cc: any) => (
                <ContactRow key={cc.id} cc={cc} onSelect={onSelectContact} />
              ))}
            </div>
          </section>
        )}

        {pendingContacts.length === 0 && callbackContacts.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-20 px-6 text-muted-foreground">
            <div className="h-20 w-20 rounded-2xl bg-muted/50 border flex items-center justify-center">
              <User className="h-10 w-10 opacity-25" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold">{np.noContacts || "No contacts"}</p>
              <p className="text-sm mt-1 text-muted-foreground/70">
                {campaign ? np.noContactsInCampaign || "No contacts to call in this campaign." : np.noContactsNoCampaign || "Select a campaign in the filter."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── ContactRow ─────────────────────────────────────────────────────── */
function ContactRow({ cc, onSelect, isOverdue, callbackDate }: {
  cc: any;
  onSelect: (cc: any) => void;
  isOverdue?: boolean;
  callbackDate?: string;
}) {
  const name = ccName(cc);
  const phone = ccPhone(cc);
  const initials = ccInitials(cc);

  return (
    <button
      onClick={() => onSelect(cc)}
      className={`w-full flex items-center gap-3 p-3 rounded-2xl border bg-card text-left active:scale-[0.98] transition-all ${
        isOverdue ? "border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/10" : ""
      }`}
      data-testid={`btn-contact-row-${cc.id}`}
    >
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 ${
        isOverdue ? "bg-red-400" : "bg-gradient-to-br from-primary/80 to-primary"
      }`}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">{name}</p>
        {phone && <p className="text-xs text-muted-foreground truncate">{phone}</p>}
        {callbackDate && (
          <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
            {(() => { try { return format(new Date(callbackDate), "d. M. HH:mm"); } catch { return callbackDate; } })()}
          </p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
    </button>
  );
}
