import { useState, useCallback } from "react";
import { Phone, ListChecks, Clock, MessageSquare, User, PhoneOff, PhoneIncoming, Mic, MicOff, PauseCircle, PlayCircle, Hash, ChevronDown, ChevronUp, AlertTriangle, Check, Info, Zap, Loader2, Tag, X, PhoneCall, Mail, Calendar, FileText, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { useCall } from "@/contexts/call-context";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

type MobileTab = "call" | "status" | "callbacks" | "sms" | "card";

interface MobileAgentWorkspaceProps {
  contact: any;
  campaign: any;
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
  onOpenDisposition: () => void;
  onMakeCall: (phone: string) => void;
  isSipRegistered: boolean;
  sipIncomingCall: any;
  onAnswerIncoming: () => void;
  onRejectIncoming: () => void;
  dbStatusList: any[];
  dbSlChecked: Set<string>;
  onSlToggle: (itemId: string, checked: boolean) => void;
  campaignContacts: any[];
  currentCampaignContactId: string | null;
  onSelectContact: (cc: any) => void;
  locale: string;
  contactHistory: any[];
  onSendSms: (data: { to: string[]; message: string }) => void;
  isSendingSms: boolean;
  campaignDispositions: any[];
  isStatusListMode: boolean;
}

function fmtPhone(p: string) {
  return p || "—";
}

const SLU: Record<string, Record<string, string>> = {
  statusListTitle: { sk: "Status list", en: "Status List", cs: "Status list", hu: "Állapotlista", ro: "Status list", it: "Lista stato", de: "Statusliste" },
  options: { sk: "Možnosti", en: "Options", cs: "Možnosti", hu: "Lehetőségek", ro: "Opțiuni", it: "Opzioni", de: "Optionen" },
  noStatusList: { sk: "Status list nie je nakonfigurovaný", en: "Status list not configured", cs: "Status list není nakonfigurován", hu: "Állapotlista nincs konfigurálva", ro: "Lista de stare nu este configurată", it: "Lista stato non configurata", de: "Statusliste nicht konfiguriert" },
  callbacks: { sk: "Callbacks", en: "Callbacks", cs: "Zpětná volání", hu: "Visszahívások", ro: "Apeluri înapoi", it: "Richiamate", de: "Rückrufe" },
  noCallbacks: { sk: "Žiadne naplánované callbacks", en: "No scheduled callbacks", cs: "Žádná zpětná volání", hu: "Nincs ütemezett visszahívás", ro: "Fără apeluri programate", it: "Nessuna richiamata", de: "Keine geplanten Rückrufe" },
  callNow: { sk: "Volať", en: "Call", cs: "Volat", hu: "Hívás", ro: "Sună", it: "Chiama", de: "Anrufen" },
  contactCard: { sk: "Karta", en: "Card", cs: "Karta", hu: "Kártya", ro: "Card", it: "Scheda", de: "Karte" },
  noContact: { sk: "Žiadny kontakt", en: "No contact selected", cs: "Žádný kontakt", hu: "Nincs kiválasztott kontakt", ro: "Niciun contact selectat", it: "Nessun contatto", de: "Kein Kontakt" },
  callTab: { sk: "Hovor", en: "Call", cs: "Hovor", hu: "Hívás", ro: "Apel", it: "Chiama", de: "Anruf" },
  smsTab: { sk: "SMS", en: "SMS", cs: "SMS", hu: "SMS", ro: "SMS", it: "SMS", de: "SMS" },
  answer: { sk: "Prijať", en: "Answer", cs: "Přijmout", hu: "Fogadás", ro: "Răspunde", it: "Rispondi", de: "Annehmen" },
  reject: { sk: "Odmietnuť", en: "Reject", cs: "Odmítnout", hu: "Elutasítás", ro: "Refuză", it: "Rifiuta", de: "Ablehnen" },
  incomingCall: { sk: "Prichádzajúci hovor", en: "Incoming Call", cs: "Příchozí hovor", hu: "Bejövő hívás", ro: "Apel incoming", it: "Chiamata in entrata", de: "Eingehender Anruf" },
  disposition: { sk: "Zatvoriť hovor", en: "Close Call", cs: "Zavřít hovor", hu: "Hívás zárása", ro: "Închide apelul", it: "Chiudi chiamata", de: "Anruf abschließen" },
  overdue: { sk: "Po termíne", en: "Overdue", cs: "Po termínu", hu: "Lejárt", ro: "Depășit", it: "Scaduto", de: "Überfällig" },
  today: { sk: "Dnes", en: "Today", cs: "Dnes", hu: "Ma", ro: "Azi", it: "Oggi", de: "Heute" },
};
const slu = (k: string, locale: string) => SLU[k]?.[locale] ?? SLU[k]?.en ?? k;

export function MobileAgentWorkspace({
  contact, campaign, callState, callDuration, ringDuration, hungUpBy,
  isMuted, isOnHold, callerNumber, onEndCall, onToggleMute, onToggleHold,
  onSendDtmf, onOpenDisposition, onMakeCall, isSipRegistered,
  sipIncomingCall, onAnswerIncoming, onRejectIncoming,
  dbStatusList, dbSlChecked, onSlToggle, campaignContacts,
  currentCampaignContactId, onSelectContact, locale, contactHistory,
  onSendSms, isSendingSms, campaignDispositions, isStatusListMode,
}: MobileAgentWorkspaceProps) {
  const callContext = useCall();
  const [activeTab, setActiveTab] = useState<MobileTab>("call");
  const [dtmfOpen, setDtmfOpen] = useState(false);
  const [smsText, setSmsText] = useState("");

  const hasActiveCall = ["active", "on_hold", "connecting", "ringing", "ended"].includes(callState);
  const isCallActive = ["active", "on_hold", "connecting", "ringing"].includes(callState);
  const dbVisibleItems = dbStatusList.filter((i: any) => !i.isHidden && i.itemType !== "option" && i.confirmationType !== "auto");
  const dbConfirmed = dbVisibleItems.filter((i: any) => dbSlChecked.has(String(i.id))).length;
  const dbTotal = dbVisibleItems.length;
  const progress = dbTotal > 0 ? Math.round((dbConfirmed / dbTotal) * 100) : 0;

  const now = new Date();
  const callbackContacts = campaignContacts.filter((cc: any) => cc.status === "callback_scheduled" && cc.callbackDate);
  const callbacksDue = callbackContacts.filter((cc: any) => new Date(cc.callbackDate) <= now);
  const callbacksUpcoming = callbackContacts.filter((cc: any) => new Date(cc.callbackDate) > now);

  const smsHistory = contactHistory.filter((h: any) => h.type === "sms");

  const tabs: { id: MobileTab; icon: any; label: string; badge?: number }[] = [
    { id: "call", icon: Phone, label: slu("callTab", locale), badge: isCallActive ? 1 : undefined },
    { id: "status", icon: ListChecks, label: slu("statusListTitle", locale), badge: dbTotal > 0 ? dbConfirmed : undefined },
    { id: "callbacks", icon: Clock, label: slu("callbacks", locale), badge: callbacksDue.length > 0 ? callbacksDue.length : undefined },
    { id: "sms", icon: MessageSquare, label: slu("smsTab", locale) },
    { id: "card", icon: User, label: slu("contactCard", locale) },
  ];

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* ── Incoming call overlay ───────────────────────────────── */}
      {sipIncomingCall && (
        <div className="absolute inset-0 z-50 bg-background flex flex-col items-center justify-center gap-6 px-6">
          <div className="flex flex-col items-center gap-3">
            <div className="relative h-24 w-24">
              <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
              <div className="relative h-24 w-24 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center">
                <PhoneIncoming className="h-10 w-10 text-green-500" />
              </div>
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{slu("incomingCall", locale)}</p>
            <p className="text-2xl font-bold text-center">
              {sipIncomingCall.callerName || fmtPhone(sipIncomingCall.callerNumber)}
            </p>
            {sipIncomingCall.callerName && (
              <p className="text-sm text-muted-foreground">{fmtPhone(sipIncomingCall.callerNumber)}</p>
            )}
          </div>
          <div className="flex items-center gap-8 mt-4">
            <button
              onClick={onRejectIncoming}
              className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-red-500/30"
              data-testid="btn-mobile-reject"
            >
              <PhoneOff className="h-7 w-7 text-white" />
            </button>
            <button
              onClick={onAnswerIncoming}
              className="h-20 w-20 rounded-full bg-green-500 hover:bg-green-600 active:scale-95 transition-all flex items-center justify-center shadow-xl shadow-green-500/30"
              data-testid="btn-mobile-answer"
            >
              <Phone className="h-8 w-8 text-white" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            <span className="text-red-500">{slu("reject", locale)}</span>
            {" · "}
            <span className="text-green-500">{slu("answer", locale)}</span>
          </p>
        </div>
      )}

      {/* ── Active call HUD strip (mini, when not on call tab) ── */}
      {isCallActive && activeTab !== "call" && (
        <button
          onClick={() => setActiveTab("call")}
          className="shrink-0 mx-3 mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 transition-all active:scale-[0.98]"
          data-testid="btn-mobile-call-hud-strip"
        >
          <div className="h-7 w-7 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
            <Phone className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-xs font-bold text-blue-700 dark:text-blue-300">
              {callState === "active" ? `● ${fmtDur(callDuration)}` : callState === "on_hold" ? `⏸ ${fmtDur(callDuration)}` : callState === "ringing" ? "🔔 Zvonenie..." : "Pripájanie..."}
            </p>
            <p className="text-[10px] text-muted-foreground">{contact?.firstName ? `${contact.firstName} ${contact.lastName}` : callerNumber}</p>
          </div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">zobraziť</div>
        </button>
      )}

      {/* ── Tab content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {/* CALL TAB */}
        {activeTab === "call" && (
          <div className="flex flex-col h-full">
            {/* Contact info */}
            <div className={`px-4 pt-5 pb-4 flex flex-col items-center gap-2 ${isCallActive ? "bg-gradient-to-b from-blue-500/5 to-transparent" : ""}`}>
              <div className={`h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-lg ${
                isCallActive ? "bg-gradient-to-br from-blue-500 to-blue-600" : "bg-muted"
              }`}>
                {contact?.firstName ? contact.firstName.charAt(0).toUpperCase() : <User className="h-8 w-8 text-muted-foreground" />}
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">
                  {contact ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim() : (callerNumber || "—")}
                </p>
                {contact?.phone && <p className="text-sm text-muted-foreground">{contact.phone}</p>}
                {campaign && <p className="text-xs text-muted-foreground/60 mt-0.5">{campaign.name}</p>}
              </div>

              {/* Call state display */}
              <div className="flex items-center gap-2 mt-1">
                {callState === "idle" && (
                  <span className="text-xs text-muted-foreground/50">Žiadny aktívny hovor</span>
                )}
                {(callState === "connecting" || callState === "ringing") && (
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600 dark:text-green-400">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    {callState === "ringing" ? `Zvonenie ${ringDuration ? ringDuration + "s" : ""}` : "Pripájanie..."}
                  </span>
                )}
                {(callState === "active" || callState === "on_hold") && (
                  <span className="flex items-center gap-1.5 text-sm font-bold text-blue-600 dark:text-blue-400">
                    <span className={`h-2 w-2 rounded-full ${callState === "on_hold" ? "bg-orange-400" : "bg-blue-500 animate-pulse"}`} />
                    {callState === "on_hold" ? "Podržaný" : "Aktívny"} · {fmtDur(callDuration)}
                  </span>
                )}
                {callState === "ended" && (
                  <span className="text-sm text-muted-foreground">{hungUpBy === "customer" ? "Zákazník zavesil" : "Hovor ukončený"}</span>
                )}
              </div>
            </div>

            {/* DTMF keyboard (collapsible) */}
            {isCallActive && dtmfOpen && (
              <div className="mx-4 mb-3 grid grid-cols-3 gap-2 p-3 rounded-xl bg-muted/40 border">
                {["1","2","3","4","5","6","7","8","9","*","0","#"].map(d => (
                  <button
                    key={d}
                    onClick={() => onSendDtmf(d)}
                    className="h-12 rounded-lg bg-background border border-border text-base font-bold hover:bg-muted active:scale-95 transition-all"
                    data-testid={`btn-mobile-dtmf-${d}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}

            {/* Call controls */}
            <div className="px-4 py-4 flex flex-col gap-4">
              {isCallActive ? (
                <>
                  {/* Primary controls */}
                  <div className="flex items-center justify-center gap-6">
                    <button
                      onClick={onToggleMute}
                      className={`h-14 w-14 rounded-full border-2 flex items-center justify-center transition-all active:scale-95 ${
                        isMuted ? "bg-red-500 border-red-500 text-white" : "bg-background border-border text-foreground"
                      }`}
                      data-testid="btn-mobile-mute"
                    >
                      {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                    </button>

                    {/* Big hang up */}
                    <button
                      onClick={() => { onEndCall(); if (!isStatusListMode) onOpenDisposition(); }}
                      className="h-20 w-20 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 transition-all flex items-center justify-center shadow-xl shadow-red-500/30"
                      data-testid="btn-mobile-hangup"
                    >
                      <PhoneOff className="h-8 w-8 text-white" />
                    </button>

                    <button
                      onClick={onToggleHold}
                      className={`h-14 w-14 rounded-full border-2 flex items-center justify-center transition-all active:scale-95 ${
                        isOnHold ? "bg-orange-500 border-orange-500 text-white" : "bg-background border-border text-foreground"
                      }`}
                      data-testid="btn-mobile-hold"
                    >
                      {isOnHold ? <PlayCircle className="h-6 w-6" /> : <PauseCircle className="h-6 w-6" />}
                    </button>
                  </div>

                  {/* DTMF toggle */}
                  <button
                    onClick={() => setDtmfOpen(p => !p)}
                    className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-1"
                    data-testid="btn-mobile-dtmf-toggle"
                  >
                    <Hash className="h-3.5 w-3.5" />
                    Klávesnica
                    {dtmfOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                </>
              ) : callState === "ended" ? (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={onOpenDisposition}
                    className="w-full h-13 py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-primary/25 active:scale-[0.98] transition-all"
                    data-testid="btn-mobile-disposition"
                  >
                    <FileText className="h-5 w-5" />
                    {slu("disposition", locale)}
                  </button>
                  {contact?.phone && isSipRegistered && (
                    <button
                      onClick={() => onMakeCall(contact.phone)}
                      className="w-full h-12 py-3 rounded-2xl bg-green-500 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                      data-testid="btn-mobile-recall"
                    >
                      <Phone className="h-4.5 w-4.5" />
                      Zavolať znova
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {contact?.phone ? (
                    <button
                      onClick={() => onMakeCall(contact.phone)}
                      disabled={!isSipRegistered}
                      className="w-full h-14 rounded-2xl bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white font-bold text-lg flex items-center justify-center gap-2.5 shadow-lg shadow-green-500/25 active:scale-[0.98] transition-all"
                      data-testid="btn-mobile-call"
                    >
                      <Phone className="h-6 w-6" />
                      {contact.phone}
                    </button>
                  ) : (
                    <div className="text-center text-sm text-muted-foreground py-6">
                      {slu("noContact", locale)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recording status */}
            {isCallActive && callContext.isRecording && (
              <div className="mx-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                <div className={`h-2 w-2 rounded-full shrink-0 ${callContext.isRecordingPaused ? "bg-orange-400" : "bg-red-500 animate-pulse"}`} />
                <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                  {callContext.isRecordingPaused ? "NAHRÁVANIE POZASTAVENÉ" : "NAHRÁVANIE"}
                </span>
              </div>
            )}
          </div>
        )}

        {/* STATUS LIST TAB */}
        {activeTab === "status" && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-3 border-b bg-gradient-to-r from-primary/5 to-transparent flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center">
                  <ListChecks className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <span className="text-sm font-bold">{slu("statusListTitle", locale)}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="h-1 w-20 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-500 rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">{progress}%</span>
                  </div>
                </div>
              </div>
              <span className={`inline-flex items-center justify-center min-w-[40px] h-6 px-2.5 rounded-full text-xs font-bold ${
                dbConfirmed === dbTotal && dbTotal > 0 ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {dbConfirmed}/{dbTotal}
              </span>
            </div>

            {dbTotal === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground px-6">
                <div className="h-14 w-14 rounded-2xl bg-muted/50 border flex items-center justify-center">
                  <ListChecks className="h-7 w-7 opacity-30" />
                </div>
                <p className="text-sm font-semibold">{slu("noStatusList", locale)}</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2.5">
                {/* Options */}
                {(() => {
                  const opts = dbStatusList.filter((i: any) => i.itemType === "option" && !i.isHidden);
                  if (opts.length === 0) return null;
                  return (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-gradient-to-br from-amber-50 to-amber-50/30 dark:from-amber-950/30 dark:to-transparent overflow-hidden">
                      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                        <div className="h-5 w-5 rounded-md bg-amber-500/15 flex items-center justify-center">
                          <Zap className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">{slu("options", locale)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 px-3 pb-3">
                        {opts.map((opt: any) => (
                          <button
                            key={opt.id}
                            className="px-4 py-2 rounded-lg text-sm font-bold text-white shadow-md active:scale-95 transition-all"
                            style={{ backgroundColor: opt.color || "#6b7280" }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Items */}
                {dbVisibleItems.map((item: any) => {
                  const isChecked = dbSlChecked.has(String(item.id));
                  const isInfo = item.confirmationType === "info";
                  return (
                    <div
                      key={item.id}
                      className={`relative rounded-xl border transition-all overflow-hidden ${
                        isChecked
                          ? "bg-emerald-50/80 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/60"
                          : "bg-card border-border"
                      }`}
                    >
                      <div className={`absolute inset-y-0 left-0 w-1 rounded-l-xl ${isChecked ? "bg-emerald-500" : isInfo ? "bg-blue-400" : "bg-muted-foreground/15"}`} />
                      <div className="flex items-start gap-3 pl-4 pr-3 py-4">
                        <div className="shrink-0 mt-0.5">
                          {isInfo ? (
                            <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                              <Info className="h-3.5 w-3.5 text-blue-500" />
                            </div>
                          ) : (
                            <button
                              onClick={() => onSlToggle(String(item.id), !isChecked)}
                              className={`h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all ${
                                isChecked
                                  ? "bg-emerald-500 border-emerald-500"
                                  : "border-muted-foreground/30 bg-background"
                              }`}
                              data-testid={`sl-mobile-check-${item.id}`}
                            >
                              {isChecked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                            </button>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm leading-snug ${isChecked ? "font-bold text-emerald-700 dark:text-emerald-300" : "font-semibold"}`}>
                            {item.label}
                            {item.required && <span className="ml-1 text-rose-500 font-bold">*</span>}
                          </div>
                          {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer progress */}
            {dbTotal > 0 && (
              <div className="px-4 py-3 border-t bg-gradient-to-b from-transparent to-muted/20 shrink-0 space-y-1.5">
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${progress}%` }} />
                  </div>
                  <span className={`text-xs font-bold tabular-nums ${progress === 100 ? "text-emerald-600" : "text-muted-foreground"}`}>{progress}%</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CALLBACKS TAB */}
        {activeTab === "callbacks" && (
          <div className="flex flex-col h-full">
            <div className="px-4 py-3 border-b bg-gradient-to-r from-primary/5 to-transparent shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm font-bold">{slu("callbacks", locale)}</span>
                {callbacksDue.length > 0 && (
                  <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                    {callbacksDue.length} {slu("overdue", locale)}
                  </span>
                )}
              </div>
            </div>

            {callbackContacts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground px-6">
                <div className="h-14 w-14 rounded-2xl bg-muted/50 border flex items-center justify-center">
                  <Clock className="h-7 w-7 opacity-30" />
                </div>
                <p className="text-sm font-semibold">{slu("noCallbacks", locale)}</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2">
                {[...callbacksDue, ...callbacksUpcoming].map((cc: any) => {
                  const isOverdue = new Date(cc.callbackDate) <= now;
                  const cbDate = new Date(cc.callbackDate);
                  const isToday = cbDate.toDateString() === now.toDateString();
                  return (
                    <div
                      key={cc.id}
                      className={`relative rounded-xl border overflow-hidden ${
                        isOverdue
                          ? "bg-red-50/80 dark:bg-red-950/20 border-red-200 dark:border-red-800/60"
                          : "bg-card border-border"
                      }`}
                    >
                      <div className={`absolute inset-y-0 left-0 w-1 rounded-l-xl ${isOverdue ? "bg-red-500" : "bg-blue-400"}`} />
                      <div className="pl-4 pr-3 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{cc.customerName || "Neznámy"}</p>
                            <p className={`text-xs font-semibold mt-0.5 ${isOverdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                              {isOverdue ? `⚠ ${slu("overdue", locale)}: ` : isToday ? `${slu("today", locale)}: ` : ""}
                              {format(cbDate, "dd.MM. HH:mm")}
                            </p>
                            {cc.callbackNote && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cc.callbackNote}</p>
                            )}
                          </div>
                          <button
                            onClick={() => onSelectContact(cc)}
                            disabled={!isSipRegistered || isCallActive}
                            className="shrink-0 h-10 w-10 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-40 flex items-center justify-center active:scale-95 transition-all shadow-md shadow-green-500/20"
                            data-testid={`btn-mobile-cb-call-${cc.id}`}
                          >
                            <Phone className="h-5 w-5 text-white" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SMS TAB */}
        {activeTab === "sms" && (
          <div className="flex flex-col h-full">
            <div className="px-4 py-3 border-b bg-gradient-to-r from-primary/5 to-transparent shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm font-bold">{slu("smsTab", locale)}</span>
                {contact?.firstName && <span className="text-xs text-muted-foreground">– {contact.firstName} {contact.lastName}</span>}
              </div>
            </div>

            {/* SMS history */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
              {smsHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 opacity-20" />
                  <p className="text-sm">Žiadne SMS</p>
                </div>
              ) : (
                smsHistory.map((h: any, i: number) => (
                  <div key={i} className={`flex ${h.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                      h.direction === "outbound"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}>
                      <p>{h.content || h.message}</p>
                      <p className={`text-[10px] mt-0.5 ${h.direction === "outbound" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {h.timestamp ? format(new Date(h.timestamp), "dd.MM HH:mm") : ""}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Compose */}
            {contact?.phone && (
              <div className="px-3 pb-3 pt-2 border-t shrink-0">
                <div className="flex gap-2 items-end">
                  <textarea
                    value={smsText}
                    onChange={e => setSmsText(e.target.value)}
                    placeholder="Napísať SMS..."
                    rows={2}
                    className="flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    data-testid="input-mobile-sms-compose"
                  />
                  <button
                    onClick={() => { if (smsText.trim()) { onSendSms({ to: [contact.phone], message: smsText.trim() }); setSmsText(""); } }}
                    disabled={!smsText.trim() || isSendingSms}
                    className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all"
                    data-testid="btn-mobile-sms-send"
                  >
                    {isSendingSms ? <Loader2 className="h-5 w-5 text-primary-foreground animate-spin" /> : <MessageSquare className="h-5 w-5 text-primary-foreground" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CARD TAB */}
        {activeTab === "card" && (
          <div className="flex flex-col h-full overflow-y-auto">
            {!contact ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground px-6">
                <div className="h-14 w-14 rounded-2xl bg-muted/50 border flex items-center justify-center">
                  <User className="h-7 w-7 opacity-30" />
                </div>
                <p className="text-sm font-semibold">{slu("noContact", locale)}</p>
              </div>
            ) : (
              <div className="px-4 py-4 space-y-4">
                {/* Contact header */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-xl font-bold text-primary-foreground shrink-0">
                    {contact.firstName?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold truncate">{contact.firstName} {contact.lastName}</p>
                    {contact.country && <Badge variant="outline" className="text-[10px] mt-0.5">{contact.country}</Badge>}
                    {contact.city && <p className="text-xs text-muted-foreground mt-0.5">{contact.city}</p>}
                  </div>
                </div>

                {/* Quick actions */}
                <div className="grid grid-cols-3 gap-2">
                  {contact.phone && (
                    <button
                      onClick={() => { onMakeCall(contact.phone); setActiveTab("call"); }}
                      disabled={!isSipRegistered}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-green-500/10 border border-green-200 dark:border-green-800 active:scale-95 transition-all disabled:opacity-40"
                    >
                      <Phone className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <span className="text-[10px] font-semibold text-green-700 dark:text-green-300">{slu("callTab", locale)}</span>
                    </button>
                  )}
                  {contact.phone && (
                    <button
                      onClick={() => setActiveTab("sms")}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-orange-500/10 border border-orange-200 dark:border-orange-800 active:scale-95 transition-all"
                    >
                      <MessageSquare className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      <span className="text-[10px] font-semibold text-orange-700 dark:text-orange-300">{slu("smsTab", locale)}</span>
                    </button>
                  )}
                  {contact.email && (
                    <button
                      className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-blue-500/10 border border-blue-200 dark:border-blue-800 active:scale-95 transition-all"
                    >
                      <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300">Email</span>
                    </button>
                  )}
                </div>

                {/* Contact details */}
                <div className="rounded-xl border bg-card overflow-hidden divide-y divide-border">
                  {[
                    { label: "Telefón", value: contact.phone, icon: Phone },
                    { label: "Email", value: contact.email, icon: Mail },
                    { label: "Mesto", value: contact.city, icon: null },
                    { label: "Krajina", value: contact.country, icon: null },
                    { label: "Dátum narodenia", value: contact.birthDate ? format(new Date(contact.birthDate), "dd.MM.yyyy") : null, icon: Calendar },
                  ].filter(f => f.value).map((field, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <span className="text-xs text-muted-foreground w-24 shrink-0">{field.label}</span>
                      <span className="text-sm font-medium flex-1 truncate">{field.value}</span>
                    </div>
                  ))}
                </div>

                {/* Recent history */}
                {contactHistory.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">História</p>
                    <div className="space-y-1.5">
                      {contactHistory.slice(0, 5).map((h: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/40 border border-border">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                            h.type === "call" ? "bg-blue-100 dark:bg-blue-900/40" :
                            h.type === "sms" ? "bg-orange-100 dark:bg-orange-900/40" :
                            h.type === "email" ? "bg-green-100 dark:bg-green-900/40" : "bg-muted"
                          }`}>
                            {h.type === "call" ? <Phone className="h-3 w-3 text-blue-600" /> :
                             h.type === "sms" ? <MessageSquare className="h-3 w-3 text-orange-600" /> :
                             h.type === "email" ? <Mail className="h-3 w-3 text-green-600" /> :
                             <MoreHorizontal className="h-3 w-3 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{h.content || h.message || h.action || "Aktivita"}</p>
                            <p className="text-[10px] text-muted-foreground">{h.timestamp ? format(new Date(h.timestamp), "dd.MM HH:mm") : ""}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom Navigation ────────────────────────────────────── */}
      <div className="shrink-0 border-t bg-background/95 backdrop-blur-sm px-1 pb-safe">
        <div className="flex items-stretch">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const hasCallIndicator = tab.id === "call" && isCallActive;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 px-1 relative transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
                data-testid={`btn-mobile-tab-${tab.id}`}
              >
                <div className="relative">
                  <Icon className={`h-5 w-5 transition-all ${isActive ? "scale-110" : ""}`} />
                  {/* Badge */}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`absolute -top-1.5 -right-1.5 h-4 min-w-4 px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center ${
                      tab.id === "callbacks" && callbacksDue.length > 0 ? "bg-red-500 text-white" : "bg-primary text-primary-foreground"
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                  {/* Call pulse ring */}
                  {hasCallIndicator && (
                    <span className="absolute inset-0 rounded-full border-2 border-blue-500 animate-ping opacity-50" />
                  )}
                </div>
                <span className={`text-[9px] font-semibold tracking-wide ${isActive ? "text-primary" : "text-muted-foreground/70"}`}>
                  {tab.label}
                </span>
                {/* Active indicator */}
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
