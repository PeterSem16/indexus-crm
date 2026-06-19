import { useState, useCallback } from "react";
import { Phone, PhoneOff, PhoneIncoming, Mic, MicOff, PauseCircle, PlayCircle,
  Hash, Check, ChevronDown, ChevronUp, Info, Zap, Coffee, LogOut, User,
  Clock, ChevronRight, AlertCircle, FileText, ListChecks, Loader2 } from "lucide-react";
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

/* ── props ──────────────────────────────────────────────────────────── */
export interface MobileAgentWorkspaceProps {
  contact: any;
  campaign: any;
  campaignContacts: any[];
  currentCampaignContactId: string | null;
  onSelectContact: (cc: any) => void;

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

  locale: string;
}

/* ── main component ─────────────────────────────────────────────────── */
export function MobileAgentWorkspace(props: MobileAgentWorkspaceProps) {
  const {
    contact, campaign, campaignContacts, currentCampaignContactId, onSelectContact,
    callState, callDuration, ringDuration, hungUpBy,
    isMuted, isOnHold, callerNumber,
    onEndCall, onToggleMute, onToggleHold, onSendDtmf, onMakeCall, isSipRegistered,
    sipIncomingCall, onAnswerIncoming, onRejectIncoming,
    onOpenDisposition, isStatusListMode,
    dbStatusList, dbSlChecked, onSlToggle,
    agentStatus, isOnBreak, workTime, breakTypes, onEndSession, onStartBreak, onEndBreak,
    locale,
  } = props;

  const [dtmfOpen, setDtmfOpen] = useState(false);
  const [slOpen, setSlOpen] = useState(true);
  const [breakMenuOpen, setBreakMenuOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const isCallActive = ["active", "on_hold", "connecting", "ringing"].includes(callState);
  const isCallEnded = callState === "ended";
  const hasContact = !!contact || !!currentCampaignContactId;

  /* status list */
  const slVisible = dbStatusList.filter((i: any) => !i.isHidden && i.itemType !== "option" && i.confirmationType !== "auto");
  const slOptions = dbStatusList.filter((i: any) => !i.isHidden && i.itemType === "option");
  const slConfirmed = slVisible.filter((i: any) => dbSlChecked.has(String(i.id))).length;
  const slTotal = slVisible.length;
  const slProgress = slTotal > 0 ? Math.round((slConfirmed / slTotal) * 100) : 0;

  /* contact lists */
  const now = new Date();
  const pendingContacts = campaignContacts.filter((cc: any) => cc.status === "pending");
  const callbackContacts = campaignContacts.filter((cc: any) => cc.status === "callback_scheduled" && cc.callbackDate);
  const overdueCallbacks = callbackContacts.filter((cc: any) => new Date(cc.callbackDate) <= now);
  const upcomingCallbacks = callbackContacts.filter((cc: any) => new Date(cc.callbackDate) > now);

  /* contact phone for calling */
  const contactPhone = contact?.phone || (currentCampaignContactId
    ? ccPhone(campaignContacts.find((cc: any) => cc.id === currentCampaignContactId) || {})
    : "");

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
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Prichádzajúci hovor</p>
            <p className="text-3xl font-bold">{sipIncomingCall.callerName || sipIncomingCall.callerNumber || "—"}</p>
            {sipIncomingCall.callerName && (
              <p className="text-base text-muted-foreground mt-1">{sipIncomingCall.callerNumber}</p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-center gap-16">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onRejectIncoming}
              className="h-20 w-20 rounded-full bg-red-500 active:scale-95 transition-all flex items-center justify-center shadow-xl shadow-red-500/40"
              data-testid="btn-mobile-reject"
            >
              <PhoneOff className="h-9 w-9 text-white" />
            </button>
            <span className="text-xs font-semibold text-red-500">Odmietnuť</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onAnswerIncoming}
              className="h-24 w-24 rounded-full bg-green-500 active:scale-95 transition-all flex items-center justify-center shadow-2xl shadow-green-500/40"
              data-testid="btn-mobile-answer"
            >
              <Phone className="h-10 w-10 text-white" />
            </button>
            <span className="text-xs font-semibold text-green-500">Prijať</span>
          </div>
        </div>
      </div>
    );
  }

  /* ── BREAK MENU ─────────────────────────────────────────────────── */
  const BreakMenu = () => (
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
            <p className="text-sm font-bold">Ukončiť prestávku</p>
            <p className="text-xs text-muted-foreground">Vrátiť sa k práci</p>
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

  /* ── LOGOUT CONFIRM ─────────────────────────────────────────────── */
  if (logoutConfirm) {
    return (
      <div className="flex flex-col h-full">
        <MobileHeader {...{ agentStatus, isOnBreak, workTime, breakTypes, onStartBreak, onEndBreak, breakMenuOpen, setBreakMenuOpen }} />
        {breakMenuOpen && <BreakMenu />}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <div className="h-20 w-20 rounded-full bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-800 flex items-center justify-center">
            <LogOut className="h-9 w-9 text-red-500" />
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">Ukončiť zmenu?</p>
            <p className="text-sm text-muted-foreground mt-1">Odhlásite sa zo všetkých misií a frônt.</p>
          </div>
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={() => { onEndSession(); setLogoutConfirm(false); }}
              className="w-full h-14 rounded-2xl bg-red-500 text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-red-500/30"
              data-testid="btn-mobile-confirm-logout"
            >
              <LogOut className="h-5 w-5" />
              Áno, odhlásiť sa
            </button>
            <button
              onClick={() => setLogoutConfirm(false)}
              className="w-full h-14 rounded-2xl bg-muted text-foreground font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              data-testid="btn-mobile-cancel-logout"
            >
              Zrušiť
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
      : callerNumber || "Neznáme číslo";
    const initials = contact?.firstName
      ? (contact.firstName[0] || "") + (contact.lastName?.[0] || "")
      : callerNumber?.substring(0, 2) || "?";

    return (
      <div className="flex flex-col h-full">
        <MobileHeader {...{ agentStatus, isOnBreak, workTime, breakTypes, onStartBreak, onEndBreak, breakMenuOpen, setBreakMenuOpen }} onLogout={() => setLogoutConfirm(true)} />
        {breakMenuOpen && <BreakMenu />}

        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Contact + call state */}
          <div className={`px-4 pt-5 pb-4 flex flex-col items-center gap-3 shrink-0 ${isCallActive ? "bg-gradient-to-b from-blue-500/8 to-transparent" : ""}`}>
            <div className={`h-18 w-18 h-[72px] w-[72px] rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-lg ${
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

            {/* Call state indicator */}
            {callState === "ringing" && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                  Zvonenie{ringDuration ? ` · ${ringDuration}s` : ""}
                </span>
              </div>
            )}
            {callState === "connecting" && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20">
                <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Pripájanie...</span>
              </div>
            )}
            {(callState === "active" || callState === "on_hold") && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20">
                <span className={`h-2 w-2 rounded-full ${callState === "on_hold" ? "bg-orange-400" : "bg-blue-500 animate-pulse"}`} />
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {callState === "on_hold" ? "Podržaný" : "Aktívny"} · {fmtDur(callDuration)}
                </span>
              </div>
            )}
            {callState === "ended" && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted">
                <span className="text-sm text-muted-foreground">
                  {hungUpBy === "customer" ? "Zákazník zavesil" : "Hovor ukončený"} · {fmtDur(callDuration)}
                </span>
              </div>
            )}
          </div>

          {/* Call controls or disposition button */}
          <div className="px-5 pb-4 shrink-0">
            {isCallActive ? (
              <>
                {/* DTMF */}
                {dtmfOpen && (
                  <div className="mb-4 grid grid-cols-3 gap-2.5 p-3 rounded-2xl bg-muted/40 border">
                    {["1","2","3","4","5","6","7","8","9","*","0","#"].map(d => (
                      <button
                        key={d}
                        onClick={() => onSendDtmf(d)}
                        className="h-14 rounded-xl bg-background border text-lg font-bold active:scale-95 transition-all"
                        data-testid={`btn-mobile-dtmf-${d}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                )}

                {/* Main controls */}
                <div className="flex items-center justify-center gap-6">
                  <div className="flex flex-col items-center gap-1.5">
                    <button
                      onClick={onToggleMute}
                      className={`h-16 w-16 rounded-full border-2 flex items-center justify-center transition-all active:scale-95 ${
                        isMuted ? "bg-red-500 border-red-500" : "bg-background border-border"
                      }`}
                      data-testid="btn-mobile-mute"
                    >
                      {isMuted ? <MicOff className="h-7 w-7 text-white" /> : <Mic className="h-7 w-7 text-foreground" />}
                    </button>
                    <span className="text-[10px] font-semibold text-muted-foreground">{isMuted ? "Unmute" : "Mute"}</span>
                  </div>

                  <div className="flex flex-col items-center gap-1.5">
                    <button
                      onClick={() => { onEndCall(); if (!isStatusListMode) onOpenDisposition(); }}
                      className="h-[88px] w-[88px] rounded-full bg-red-500 active:scale-95 transition-all flex items-center justify-center shadow-2xl shadow-red-500/40"
                      data-testid="btn-mobile-hangup"
                    >
                      <PhoneOff className="h-10 w-10 text-white" />
                    </button>
                    <span className="text-[10px] font-semibold text-muted-foreground">Zavesiť</span>
                  </div>

                  <div className="flex flex-col items-center gap-1.5">
                    <button
                      onClick={onToggleHold}
                      className={`h-16 w-16 rounded-full border-2 flex items-center justify-center transition-all active:scale-95 ${
                        isOnHold ? "bg-orange-500 border-orange-500" : "bg-background border-border"
                      }`}
                      data-testid="btn-mobile-hold"
                    >
                      {isOnHold ? <PlayCircle className="h-7 w-7 text-white" /> : <PauseCircle className="h-7 w-7 text-foreground" />}
                    </button>
                    <span className="text-[10px] font-semibold text-muted-foreground">{isOnHold ? "Pokračovať" : "Podržať"}</span>
                  </div>
                </div>

                {/* DTMF toggle */}
                <button
                  onClick={() => setDtmfOpen(p => !p)}
                  className="flex items-center justify-center gap-1.5 mt-3 w-full py-2 text-xs text-muted-foreground"
                  data-testid="btn-mobile-dtmf-toggle"
                >
                  <Hash className="h-3.5 w-3.5" />
                  Klávesnica
                  {dtmfOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </>
            ) : callState === "ended" ? (
              <button
                onClick={onOpenDisposition}
                className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-primary/25 active:scale-[0.98] transition-all"
                data-testid="btn-mobile-disposition"
              >
                <FileText className="h-5 w-5" />
                Hodnotiť hovor
              </button>
            ) : null}
          </div>

          {/* Status list */}
          {slTotal > 0 && (
            <div className="border-t mx-3 mb-3 rounded-xl overflow-hidden border bg-card">
              <button
                onClick={() => setSlOpen(p => !p)}
                className="w-full flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold">Status list</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    slConfirmed === slTotal ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                  }`}>{slConfirmed}/{slTotal}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${slProgress}%` }} />
                  </div>
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
                            <button
                              onClick={() => onSlToggle(String(item.id), !isChecked)}
                              className={`h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all ${
                                isChecked ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/30 bg-background"
                              }`}
                              data-testid={`sl-mobile-check-${item.id}`}
                            >
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
                        <Zap className="h-3 w-3" /> Možnosti
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {slOptions.map((opt: any) => (
                          <button
                            key={opt.id}
                            className="px-3 py-1.5 rounded-lg text-sm font-bold text-white active:scale-95 transition-all"
                            style={{ backgroundColor: opt.color || "#6b7280" }}
                          >
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

  /* ── CONTACT DETAIL VIEW (selected, no active call) ─────────────── */
  if (hasContact && contact) {
    const phone = contact.phone || "";
    return (
      <div className="flex flex-col h-full">
        <MobileHeader {...{ agentStatus, isOnBreak, workTime, breakTypes, onStartBreak, onEndBreak, breakMenuOpen, setBreakMenuOpen }} onLogout={() => setLogoutConfirm(true)} />
        {breakMenuOpen && <BreakMenu />}

        <div className="flex-1 overflow-y-auto flex flex-col gap-3 px-4 pt-4 pb-4">
          {/* Back to list */}
          <button
            onClick={() => onSelectContact(null as any)}
            className="flex items-center gap-1 text-xs text-muted-foreground -mb-1"
            data-testid="btn-mobile-back-to-list"
          >
            <ChevronRight className="h-3.5 w-3.5 rotate-180" />
            Späť na zoznam
          </button>

          {/* Contact card */}
          <div className="rounded-2xl border bg-card p-4 flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-xl font-bold text-primary-foreground shrink-0">
              {((contact.firstName?.[0] || "") + (contact.lastName?.[0] || "")).toUpperCase() || <User className="h-7 w-7" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold truncate">{`${contact.firstName || ""} ${contact.lastName || ""}`.trim() || "—"}</p>
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
              Žiadne telefónne číslo
            </div>
          )}

          {/* Status list */}
          {slTotal > 0 && (
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold">Status list</span>
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
                      <button
                        onClick={() => onSlToggle(String(item.id), !isChecked)}
                        className={`h-7 w-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                          isChecked ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/30"
                        }`}
                        data-testid={`sl-mobile-check-${item.id}`}
                      >
                        {isChecked && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
                      </button>
                      <span className={`text-sm leading-snug ${isChecked ? "font-bold text-emerald-700 dark:text-emerald-300" : "font-semibold"}`}>
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── CONTACT LIST VIEW (default) ─────────────────────────────────── */
  return (
    <div className="flex flex-col h-full">
      <MobileHeader {...{ agentStatus, isOnBreak, workTime, breakTypes, onStartBreak, onEndBreak, breakMenuOpen, setBreakMenuOpen }} onLogout={() => setLogoutConfirm(true)} />
      {breakMenuOpen && <BreakMenu />}

      <div className="flex-1 overflow-y-auto">
        {/* Campaign name */}
        {campaign && (
          <div className="px-4 pt-3 pb-1">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{campaign.name}</p>
          </div>
        )}

        {/* Overdue callbacks */}
        {overdueCallbacks.length > 0 && (
          <section className="px-3 pt-3">
            <div className="flex items-center gap-2 px-1 mb-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                Po termíne ({overdueCallbacks.length})
              </span>
            </div>
            <div className="space-y-2">
              {overdueCallbacks.map((cc: any) => (
                <ContactRow key={cc.id} cc={cc} onSelect={onSelectContact} isOverdue />
              ))}
            </div>
          </section>
        )}

        {/* Upcoming callbacks */}
        {upcomingCallbacks.length > 0 && (
          <section className="px-3 pt-3">
            <div className="flex items-center gap-2 px-1 mb-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Naplánované ({upcomingCallbacks.length})
              </span>
            </div>
            <div className="space-y-2">
              {upcomingCallbacks.map((cc: any) => (
                <ContactRow key={cc.id} cc={cc} onSelect={onSelectContact} callbackDate={cc.callbackDate} />
              ))}
            </div>
          </section>
        )}

        {/* New contacts */}
        {pendingContacts.length > 0 && (
          <section className="px-3 pt-3 pb-3">
            <div className="flex items-center gap-2 px-1 mb-2">
              <User className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Nové ({pendingContacts.length})
              </span>
            </div>
            <div className="space-y-2">
              {pendingContacts.map((cc: any) => (
                <ContactRow key={cc.id} cc={cc} onSelect={onSelectContact} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {pendingContacts.length === 0 && callbackContacts.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-20 px-6 text-muted-foreground">
            <div className="h-20 w-20 rounded-2xl bg-muted/50 border flex items-center justify-center">
              <User className="h-10 w-10 opacity-25" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold">Žiadne kontakty</p>
              <p className="text-sm mt-1 text-muted-foreground/70">
                {campaign ? "V tejto misii nie sú žiadne kontakty na volanie." : "Vyberte misiu vo filtri."}
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
      className={`w-full flex items-center gap-3.5 px-4 py-4 rounded-2xl border text-left active:scale-[0.98] transition-all ${
        isOverdue
          ? "bg-red-50/80 dark:bg-red-950/20 border-red-200 dark:border-red-800/60"
          : "bg-card border-border"
      }`}
      data-testid={`btn-mobile-contact-${cc.id}`}
    >
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 ${
        isOverdue ? "bg-red-500" : "bg-gradient-to-br from-primary/80 to-primary"
      }`}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold truncate">{name}</p>
        {phone && <p className="text-sm text-muted-foreground truncate">{phone}</p>}
        {callbackDate && (
          <p className={`text-xs font-semibold mt-0.5 ${isOverdue ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}>
            {isOverdue ? "⚠ " : "📅 "}{format(new Date(callbackDate), "dd.MM. HH:mm")}
          </p>
        )}
      </div>
      <ChevronRight className={`h-5 w-5 shrink-0 ${isOverdue ? "text-red-400" : "text-muted-foreground/40"}`} />
    </button>
  );
}

/* ── MobileHeader ───────────────────────────────────────────────────── */
const STATUS_DOT: Record<string, string> = {
  available: "bg-green-500",
  busy: "bg-red-500",
  wrap_up: "bg-blue-500",
  break: "bg-yellow-500",
  offline: "bg-gray-400",
};
const STATUS_LABEL: Record<string, string> = {
  available: "Dostupný",
  busy: "Obsadený",
  wrap_up: "Wrap-up",
  break: "Prestávka",
  offline: "Offline",
};

function MobileHeader({
  agentStatus, isOnBreak, workTime, breakTypes,
  onStartBreak, onEndBreak, breakMenuOpen, setBreakMenuOpen, onLogout,
}: {
  agentStatus: string; isOnBreak: boolean; workTime: string;
  breakTypes: Array<{ id: string; name: string; maxDurationMinutes?: number }>;
  onStartBreak: (id: string) => void; onEndBreak: () => void;
  breakMenuOpen: boolean; setBreakMenuOpen: (v: boolean) => void;
  onLogout?: () => void;
}) {
  const statusKey = isOnBreak ? "break" : agentStatus;
  return (
    <div className="shrink-0 h-14 border-b bg-card flex items-center justify-between px-4 gap-3 relative z-40">
      {/* Status */}
      <div className="flex items-center gap-2 min-w-0">
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${STATUS_DOT[statusKey] || "bg-gray-400"} ${statusKey === "available" ? "animate-pulse" : ""}`} />
        <span className="text-sm font-semibold truncate">{STATUS_LABEL[statusKey] || statusKey}</span>
        {workTime && <span className="text-xs text-muted-foreground hidden sm:inline">· {workTime}</span>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Break button */}
        <button
          onClick={() => setBreakMenuOpen(!breakMenuOpen)}
          className={`flex items-center gap-1.5 h-10 px-4 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
            isOnBreak
              ? "bg-yellow-500 text-white shadow-md shadow-yellow-500/30"
              : "bg-muted text-foreground"
          }`}
          data-testid="btn-mobile-break-toggle"
        >
          <Coffee className="h-4 w-4" />
          {isOnBreak ? "Prestávka" : "Pauza"}
        </button>

        {/* End shift */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 h-10 px-4 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-semibold text-sm border border-red-200 dark:border-red-800 active:scale-95 transition-all"
            data-testid="btn-mobile-logout"
          >
            <LogOut className="h-4 w-4" />
            Koniec
          </button>
        )}
      </div>
    </div>
  );
}
