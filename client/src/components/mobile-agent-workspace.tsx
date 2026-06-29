import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Slider } from "@/components/ui/slider";
import { Phone, PhoneOff, PhoneIncoming, Mic, MicOff, PauseCircle, PlayCircle,
  Hash, Check, CheckCircle, ChevronDown, ChevronUp, Info, Zap, Coffee, LogOut, User,
  Clock, ChevronRight, AlertCircle, FileText, ListChecks,
  Mail, MapPin, Calendar, ArrowLeft, Search, X, Baby, Building2, SlidersHorizontal,
  History, PhoneCall, Stethoscope, UserX, Globe, Share2, UserCheck,
  MessageSquare, Send, Volume2 } from "lucide-react";
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
function ccSearchMatch(cc: any, q: string, field = "all"): boolean {
  if (!q.trim()) return true;
  const lower = q.toLowerCase();
  const ql = lower.replace(/\s/g, "");
  const checks: Record<string, boolean> = {
    name:    ccName(cc).toLowerCase().includes(lower),
    phone:   [ccPhone(cc), cc.customer?.mobile||"", cc.collaborator?.mobile||"", cc.clinic?.phone2||"", cc.hospital?.phone2||""].some(p => p.replace(/\s/g,"").includes(ql)),
    email:   (cc.customer?.email || cc.hospital?.email || cc.clinic?.email || cc.collaborator?.email || "").toLowerCase().includes(lower),
    city:    (cc.customer?.city || cc.hospital?.city || cc.clinic?.city || cc.collaborator?.city || "").toLowerCase().includes(lower),
    entity:  [(cc.clinic?.clinicName||cc.clinic?.name||""),(cc.hospital?.name||"")].some(s=>s.toLowerCase().includes(lower)),
    address: (cc.customer?.address || cc.hospital?.address || cc.clinic?.address || "").toLowerCase().includes(lower),
  };
  return field === "all" ? Object.values(checks).some(Boolean) : (checks[field] ?? false);
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
  currentUserId?: string;
  allCampaignContacts?: any[];

  volume?: number;
  micVolume?: number;
  onVolumeChange?: (vol: number) => void;
  onMicVolumeChange?: (vol: number) => void;
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
  const [yesno, setYesno] = useState<Record<string, "yes" | "no">>({});
  const [currentTab, setCurrentTab] = useState<'acquisition' | 'contract' | 'retention'>('acquisition');

  const hasTabAssignment = items.some((i: any) => !i.parentId && i.tab && i.itemType !== "option" && !i.isHidden);

  const allVisible = items.filter((i: any) => i.itemType !== "option" && i.confirmationType !== "auto" && !i.isHidden);
  const topLevelAll = allVisible.filter((i: any) => !i.parentId);
  const topLevel = hasTabAssignment
    ? topLevelAll.filter((i: any) => !i.tab || i.tab === currentTab)
    : topLevelAll;
  const options = items.filter((i: any) => !i.isHidden && i.itemType === "option");
  const childrenOf = (pid: number) => items.filter((i: any) => i.parentId === pid && !i.isHidden);

  const confirmed = allVisible.filter((i: any) => checked.has(String(i.id))).length;
  const total = allVisible.length;

  if (total === 0 && options.length === 0) return null;

  return (
    <div className="mx-4 mb-4 rounded-2xl border bg-card overflow-hidden">
      <div>
          {/* Phase Journey Pipeline */}
          {hasTabAssignment && (() => {
            const mobilePhaseDefs = [
              { key: 'acquisition' as const, label: 'Acquisition', barGradient: 'linear-gradient(90deg,#60a5fa,#2563eb)', labelColor: 'text-blue-600 dark:text-blue-400', dotColor: 'bg-blue-500', cardActive: 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-600 shadow-md ring-1 ring-blue-400/30' },
              { key: 'contract'    as const, label: 'Contract',    barGradient: 'linear-gradient(90deg,#a78bfa,#7c3aed)', labelColor: 'text-violet-600 dark:text-violet-400', dotColor: 'bg-violet-500', cardActive: 'bg-violet-50 dark:bg-violet-950/40 border-violet-300 dark:border-violet-600 shadow-md ring-1 ring-violet-400/30' },
              { key: 'retention'  as const, label: 'Retention',   barGradient: 'linear-gradient(90deg,#34d399,#059669)', labelColor: 'text-emerald-600 dark:text-emerald-400', dotColor: 'bg-emerald-500', cardActive: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-600 shadow-md ring-1 ring-emerald-400/30' },
            ].map(ph => {
              const phItems = allVisible.filter((i: any) => {
                if (i.tab) return i.tab === ph.key;
                if (i.parentId) {
                  const parent = items.find((p: any) => p.id === i.parentId);
                  return (parent?.tab || null) === ph.key;
                }
                return false;
              });
              const phConfirmed = phItems.filter((i: any) => checked.has(String(i.id))).length;
              const pct = phItems.length > 0 ? Math.round((phConfirmed / phItems.length) * 100) : 0;
              return { ...ph, total: phItems.length, confirmed: phConfirmed, pct };
            });
            return (
              <div className="flex items-stretch gap-1 px-3 pt-2.5 pb-1">
                {mobilePhaseDefs.flatMap((ph, idx) => {
                  const isActive = currentTab === ph.key;
                  const isComplete = ph.total > 0 && ph.confirmed === ph.total;
                  const isStarted = ph.confirmed > 0;
                  const nodes: JSX.Element[] = [];
                  if (idx > 0) {
                    nodes.push(
                      <div key={`sep-${ph.key}`} className="flex items-center shrink-0 self-center">
                        <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
                      </div>
                    );
                  }
                  nodes.push(
                    <button
                      key={ph.key}
                      type="button"
                      onClick={() => setCurrentTab(ph.key)}
                      className={`flex-1 rounded-xl border p-2 transition-all duration-200 text-left relative overflow-hidden ${
                        isActive ? ph.cardActive : 'bg-muted/20 dark:bg-muted/10 border-border/40 hover:bg-muted/40'
                      }`}
                      data-testid={`sl-mobile-phase-${ph.key}`}
                    >
                      {isComplete && (
                        <div className="absolute top-1 right-1">
                          <CheckCircle className={`h-3 w-3 ${ph.dotColor}`} />
                        </div>
                      )}
                      <div className="flex items-center gap-1 mb-1.5 pr-3">
                        <div className={`h-1.5 w-1.5 rounded-full shrink-0 transition-colors ${
                          isComplete ? 'bg-emerald-500' : isStarted ? ph.dotColor : 'bg-muted-foreground/20'
                        }`} />
                        <span className={`text-[8px] font-extrabold uppercase tracking-widest leading-none transition-colors ${
                          isActive ? ph.labelColor : 'text-muted-foreground/45'
                        }`}>{ph.label}</span>
                      </div>
                      <div className="h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden mb-1">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: ph.total > 0 ? `${ph.pct}%` : '0%',
                            background: isComplete
                              ? '#10b981'
                              : ph.pct > 0
                              ? ph.barGradient
                              : 'transparent',
                          }}
                        />
                      </div>
                      {ph.total > 0 ? (
                        <div className="flex items-center justify-between gap-0.5">
                          <span className={`text-[8px] tabular-nums font-semibold leading-none ${isActive ? ph.labelColor : 'text-muted-foreground/35'}`}>
                            {ph.confirmed}/{ph.total}
                          </span>
                          <span className={`text-[8px] font-bold tabular-nums leading-none ${isComplete ? 'text-emerald-500' : isActive ? ph.labelColor : 'text-muted-foreground/25'}`}>
                            {ph.pct}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-[8px] text-muted-foreground/25 italic leading-none">—</span>
                      )}
                    </button>
                  );
                  return nodes;
                })}
              </div>
            );
          })()}
          {topLevel.map((item: any) => {
            const isChecked = checked.has(String(item.id));
            const isInfo = item.confirmationType === "info";
            // Sub-questions come from item.questions[] (nested array from API), not flat parentId
            const questions: any[] = Array.isArray(item.questions)
              ? item.questions.filter((q: any) => !q.isHidden)
              : [];

            return (
              <div key={item.id} className="border-b last:border-b-0">
                {/* Parent row */}
                <div className={`flex items-stretch ${
                  isChecked
                    ? "bg-emerald-50/60 dark:bg-emerald-900/15"
                    : item.tab === 'acquisition'
                    ? "bg-blue-50/50 dark:bg-blue-950/20"
                    : item.tab === 'contract'
                    ? "bg-violet-50/50 dark:bg-violet-950/20"
                    : item.tab === 'retention'
                    ? "bg-emerald-50/35 dark:bg-emerald-950/10"
                    : ""
                }`}>
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

                {/* Child items via parentId — always visible */}
                {childrenOf(item.id).length > 0 && (() => {
                  const isSingleChild = item.questionSelectionMode === "single";
                  const siblings = childrenOf(item.id);
                  const handleChildToggle = (childId: string, currentlyChecked: boolean, isInfo: boolean) => {
                    if (isInfo) return;
                    if (isSingleChild && !currentlyChecked) {
                      siblings.forEach((sib: any) => {
                        if (String(sib.id) !== childId && checked.has(String(sib.id))) {
                          onToggle(String(sib.id), false);
                        }
                      });
                    }
                    onToggle(childId, !currentlyChecked);
                  };
                  return (
                  <div className="bg-muted/20 border-t border-dashed">
                    {isSingleChild && (
                      <div className="px-4 pt-2 pb-0 flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-400 bg-blue-100 dark:bg-blue-900/40 shrink-0" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-blue-500 dark:text-blue-400">1×</span>
                      </div>
                    )}
                    {siblings.map((child: any) => {
                      const childChecked = checked.has(String(child.id));
                      const childInfo = child.confirmationType === "info";
                      return (
                        <div key={child.id} className={`flex items-stretch border-b last:border-b-0 pl-4 ${childChecked ? "bg-emerald-50/40 dark:bg-emerald-900/10" : ""}`}>
                          <button
                            disabled={childInfo}
                            onClick={() => handleChildToggle(String(child.id), childChecked, childInfo)}
                            className="shrink-0 flex items-center justify-center w-12 min-h-[48px] active:bg-muted/60"
                            data-testid={`sl-mobile-child-${child.id}`}
                          >
                            {childInfo ? (
                              <Info className="h-4 w-4 text-blue-500" />
                            ) : isSingleChild ? (
                              <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${childChecked ? "bg-emerald-400 border-emerald-400" : "border-muted-foreground/30 bg-background"}`}>
                                {childChecked && <div className="h-2.5 w-2.5 rounded-full bg-white" />}
                              </div>
                            ) : (
                              <div className={`h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all ${childChecked ? "bg-emerald-400 border-emerald-400" : "border-muted-foreground/30 bg-background"}`}>
                                {childChecked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                              </div>
                            )}
                          </button>
                          <button
                            disabled={childInfo}
                            onClick={() => handleChildToggle(String(child.id), childChecked, childInfo)}
                            className="flex-1 py-3 pr-4 text-left min-h-[48px]"
                          >
                            <p className={`text-xs leading-snug ${childChecked ? "font-bold text-emerald-600 dark:text-emerald-400" : "font-medium text-muted-foreground"}`}>
                              ↳ {child.label}
                              {child.required && <span className="ml-1 text-rose-500">*</span>}
                            </p>
                            {child.description && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{child.description}</p>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  );
                })()}

                {/* Sub-questions — from item.questions[], visible when parent is checked */}
                {isChecked && questions.length > 0 && (() => {
                  const isSingleSelect = item.questionSelectionMode === "single";
                  // For single-select: uncheck all other questions in this step first
                  const handleQToggle = (qId: string, currentlyChecked: boolean) => {
                    if (isSingleSelect && !currentlyChecked) {
                      questions.forEach((pq: any) => {
                        if (String(pq.id) !== qId && checked.has(String(pq.id))) {
                          onToggle(String(pq.id), false);
                        }
                      });
                    }
                    onToggle(qId, !currentlyChecked);
                  };
                  return (
                  <div className="bg-muted/30 border-t">
                    {isSingleSelect && (
                      <div className="px-4 pt-2 pb-0.5 flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-400 bg-blue-100 dark:bg-blue-900/40 shrink-0" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-blue-500 dark:text-blue-400">1×</span>
                      </div>
                    )}
                    {questions.map((q: any) => {
                      const ft = q.fieldType || "checkbox";
                      const qChecked = checked.has(String(q.id));
                      const ynAnswer = yesno[q.id];

                      if (ft === "yesno") {
                        return (
                          <div key={q.id} className="pl-6 pr-4 py-3 border-b last:border-b-0">
                            <p className="text-xs font-semibold text-foreground mb-2 leading-snug">
                              ↳ {q.questionText}
                              {q.required && <span className="ml-1 text-rose-500">*</span>}
                            </p>
                            {q.description && <p className="text-[11px] text-muted-foreground/70 mb-2">{q.description}</p>}
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  if (isSingleSelect) {
                                    questions.forEach((pq: any) => {
                                      if (String(pq.id) !== String(q.id) && checked.has(String(pq.id))) {
                                        setYesno(p => { const n = { ...p }; delete n[pq.id]; return n; });
                                        onToggle(String(pq.id), false);
                                      }
                                    });
                                  }
                                  setYesno(p => ({ ...p, [q.id]: "yes" }));
                                  if (!qChecked) onToggle(String(q.id), true);
                                }}
                                className={`flex-1 h-10 rounded-xl text-xs font-bold border-2 transition-all active:scale-95 ${
                                  ynAnswer === "yes" ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/30 text-foreground"
                                }`}
                                data-testid={`sl-mobile-yes-${q.id}`}
                              >Áno</button>
                              <button
                                onClick={() => {
                                  setYesno(p => ({ ...p, [q.id]: "no" }));
                                  if (qChecked) onToggle(String(q.id), false);
                                }}
                                className={`flex-1 h-10 rounded-xl text-xs font-bold border-2 transition-all active:scale-95 ${
                                  ynAnswer === "no" ? "bg-red-500 border-red-500 text-white" : "border-muted-foreground/30 text-foreground"
                                }`}
                                data-testid={`sl-mobile-no-${q.id}`}
                              >Nie</button>
                            </div>
                          </div>
                        );
                      }

                      // Default: checkbox / single-select radio
                      return (
                        <div key={q.id} className={`flex items-stretch border-b last:border-b-0 pl-4 ${qChecked ? "bg-emerald-50/40 dark:bg-emerald-900/10" : ""}`}>
                          <button
                            onClick={() => handleQToggle(String(q.id), qChecked)}
                            className="shrink-0 flex items-center justify-center w-12 min-h-[48px] active:bg-muted/60"
                            data-testid={`sl-mobile-sub-${q.id}`}
                          >
                            {isSingleSelect ? (
                              <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                qChecked ? "bg-emerald-400 border-emerald-400" : "border-muted-foreground/30 bg-background"
                              }`}>
                                {qChecked && <div className="h-2.5 w-2.5 rounded-full bg-white" />}
                              </div>
                            ) : (
                              <div className={`h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all ${
                                qChecked ? "bg-emerald-400 border-emerald-400" : "border-muted-foreground/30 bg-background"
                              }`}>
                                {qChecked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                              </div>
                            )}
                          </button>
                          <button
                            onClick={() => handleQToggle(String(q.id), qChecked)}
                            className="flex-1 py-3 pr-4 text-left min-h-[48px]"
                          >
                            <p className={`text-xs leading-snug ${qChecked ? "font-bold text-emerald-600 dark:text-emerald-400" : "font-medium text-muted-foreground"}`}>
                              ↳ {q.questionText}
                              {q.required && <span className="ml-1 text-rose-500">*</span>}
                            </p>
                            {q.description && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{q.description}</p>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  );
                })()}
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
    </div>
  );
}

/* ── ContactRow ─────────────────────────────────────────────────────── */
function ContactRow({ cc, onSelect, isOverdue, isUpcoming, callbackDate, np, currentUserId }: {
  cc: any; onSelect: (cc: any) => void;
  isOverdue?: boolean; isUpcoming?: boolean;
  callbackDate?: string; np: any;
  currentUserId?: string;
}) {
  const name = ccName(cc);
  const phone = ccPhone(cc);
  const initials = ccInitials(cc);
  const isCallback = isOverdue || isUpcoming;
  const isOtherAgent = !!(cc.assignedTo && cc.assignedTo !== "all" && currentUserId && cc.assignedTo !== currentUserId);

  return (
    <button
      onClick={() => onSelect(cc)}
      className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left active:scale-[0.98] transition-all ${
        isOtherAgent ? "border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/15"
        : isOverdue ? "border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/10"
        : isUpcoming ? "border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/10"
        : "bg-card"
      }`}
      data-testid={`btn-contact-row-${cc.id}`}
    >
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 ${
        isOtherAgent ? "bg-amber-400"
        : isOverdue ? "bg-red-400"
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
            <Calendar className={`h-3 w-3 ${isOtherAgent ? "text-amber-500" : isOverdue ? "text-red-500" : "text-blue-500"}`} />
            <p className={`text-xs font-semibold ${isOtherAgent ? "text-amber-600 dark:text-amber-400" : isOverdue ? "text-red-500" : "text-blue-500"}`}>
              {isOverdue && !isOtherAgent ? (np.overdue || "Overdue") + " · " : ""}
              {(() => { try { return format(new Date(callbackDate), "d. M. HH:mm"); } catch { return callbackDate; } })()}
            </p>
          </div>
        )}
        {isOtherAgent && (
          <div className="flex items-center gap-1 mt-0.5">
            <Share2 className="h-2.5 w-2.5 text-amber-500 shrink-0" />
            <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">{np.otherAgentCallback || "Preplánovaný iným agentom"}</p>
          </div>
        )}
      </div>
      {isCallback
        ? <PhoneCall className={`h-4 w-4 shrink-0 ${isOtherAgent ? "text-amber-400" : isOverdue ? "text-red-400" : "text-blue-400"}`} />
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
    onFullLogout, t, currentUserId, allCampaignContacts,
    volume = 80, micVolume = 100, onVolumeChange, onMicVolumeChange,
  } = props;

  const np = t?.nexusPulse || {};

  const [dtmfOpen, setDtmfOpen] = useState(false);
  const [breakMenuOpen, setBreakMenuOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [showHistory, setShowHistory] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [filterTab, setFilterTab] = useState<"callable"|"callbacks"|"pending"|"all">("callable");
  const [showOnlyMineCallbacks, setShowOnlyMineCallbacks] = useState(false);
  const [searchField, setSearchField] = useState("all");
  const [showFieldPicker, setShowFieldPicker] = useState(false);


  useEffect(() => { setShowHistory(true); setShowNotes(true); }, [contact?.id]);

  const isCallActive = ["active", "on_hold", "connecting", "ringing"].includes(callState);
  const isCallEnded = callState === "ended";
  const hasContact = !!contact || !!currentCampaignContactId;

  const now = new Date();
  const callbackContacts = campaignContacts.filter((cc: any) =>
    cc.status === "callback_scheduled" && cc.callbackDate
  );
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

  const notesEndpoint = contact?.id
    ? (contactType && contactType !== "customer"
        ? `/api/entity-notes/${contactType}/${contact.id}`
        : `/api/customers/${contact.id}/notes`)
    : null;

  const { data: contactNotes = [], refetch: refetchNotes } = useQuery<Array<{ id: string; content: string; userId: string; userName: string; createdAt: string }>>({
    queryKey: [notesEndpoint],
    queryFn: async () => {
      const res = await fetch(notesEndpoint!, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!notesEndpoint,
    staleTime: 0,
  });

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(notesEndpoint!, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to add note");
      return res.json();
    },
    onSuccess: () => {
      setNewNoteText("");
      refetchNotes();
    },
  });

  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Hoist phoneNumbers for reuse across all views ──
  const phoneNumbers: Array<{ label: string; value: string }> = (() => {
    if (!contact) return [];
    const result: Array<{ label: string; value: string }> = [];
    const seen = new Set<string>();
    const add = (label: string, val: string | null | undefined) => {
      if (val && !seen.has(val)) { seen.add(val); result.push({ label, value: val }); }
    };
    add(np.phone || "Phone", contact.phone);
    add(np.mobile || "Mobile", contact.mobile);
    add(np.phone2 || "Phone 2", contact.phone2 || contact.mobile2);
    add(np.otherContact || "Other", contact.otherContact);
    return result;
  })();

  // ── Contact info section — explicit inline styles, no CSS variables ──
  const S = {
    card: { borderRadius: 16, border: "1px solid #e2e8f0", background: "#ffffff", overflow: "hidden" as const, minHeight: 44 },
    hdr: { padding: "10px 16px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", display: "flex" as const, alignItems: "center" as const, gap: 8 },
    hdrTxt: { fontSize: 13, fontWeight: 700, color: "#1e293b" },
    row: { padding: "10px 16px", borderBottom: "1px solid #f1f5f9", display: "flex" as const, alignItems: "center" as const, gap: 10 },
    lbl: { fontSize: 11, color: "#94a3b8", marginBottom: 1 },
    val: { fontSize: 14, fontWeight: 600, color: "#1e293b" },
    btn: { width: "100%", display: "flex" as const, alignItems: "center" as const, justifyContent: "space-between" as const, padding: "12px 16px", background: "transparent", border: "none", cursor: "pointer" as const },
  };
  const contactInfoSection = (
    <>
      <div style={S.card}>
        <div style={S.hdr}>
          <User className="h-4 w-4" style={{color:"#6366f1",flexShrink:0}} />
          <span style={S.hdrTxt}>{np.viewDetails || "Kontaktné detaily"}</span>
        </div>
        <div>
          {phoneNumbers.map(({ label, value }) => (
            <div key={value} style={S.row}>
              <Phone className="h-4 w-4" style={{color:"#94a3b8",flexShrink:0}} />
              <div><div style={S.lbl}>{label}</div><div style={S.val}>{value}</div></div>
            </div>
          ))}
          {contact?.email && <div style={S.row}><Mail className="h-4 w-4" style={{color:"#94a3b8",flexShrink:0}} /><div><div style={S.lbl}>Email</div><div style={{...S.val, wordBreak:"break-all"}}>{contact.email}</div></div></div>}
          {contact?.email2 && <div style={S.row}><Mail className="h-4 w-4" style={{color:"#94a3b8",flexShrink:0}} /><div><div style={S.lbl}>Email 2</div><div style={{...S.val, wordBreak:"break-all"}}>{contact.email2}</div></div></div>}
          {(contact?.address || contact?.street || contact?.city || contact?.country) && <div style={{...S.row,alignItems:"flex-start"}}><MapPin className="h-4 w-4" style={{color:"#94a3b8",flexShrink:0,marginTop:2}} /><div><div style={S.lbl}>{np.address||"Adresa"}</div><div style={S.val}>{[contact?.address||contact?.street,(contact?.postalCode&&contact?.city)?`${contact.postalCode} ${contact.city}`:(contact?.postalCode||contact?.city),contact?.district||null,contact?.country].filter(Boolean).join(", ")}</div></div></div>}
          {contact?.dateOfBirth && <div style={S.row}><Calendar className="h-4 w-4" style={{color:"#94a3b8",flexShrink:0}} /><div><div style={S.lbl}>{np.dateOfBirth||"Dátum nar."}</div><div style={S.val}>{(()=>{try{return format(new Date(contact.dateOfBirth),"d. M. yyyy")}catch{return contact.dateOfBirth}})()}</div></div></div>}
          {contact?.expectedDeliveryDate && <div style={S.row}><Baby className="h-4 w-4" style={{color:"#94a3b8",flexShrink:0}} /><div><div style={S.lbl}>{np.expectedDelivery||"Predp. pôrod"}</div><div style={S.val}>{(()=>{try{return format(new Date(contact.expectedDeliveryDate),"d. M. yyyy")}catch{return contact.expectedDeliveryDate}})()}</div></div></div>}
          {contact?.nationalId && <div style={S.row}><FileText className="h-4 w-4" style={{color:"#94a3b8",flexShrink:0}} /><div><div style={S.lbl}>{np.nationalId||"Rodné číslo"}</div><div style={S.val}>{contact.nationalId}</div></div></div>}
          {contact?.contractNumber && <div style={S.row}><FileText className="h-4 w-4" style={{color:"#6366f1",flexShrink:0}} /><div><div style={S.lbl}>{np.contractNumber||"Číslo zmluvy"}</div><div style={{...S.val,fontFamily:"monospace"}}>{contact.contractNumber}</div></div></div>}
          {contact?.bankAccount && <div style={S.row}><FileText className="h-4 w-4" style={{color:"#94a3b8",flexShrink:0}} /><div><div style={S.lbl}>{np.bankAccount||"Bankový účet"}</div><div style={{...S.val,fontFamily:"monospace",fontSize:12}}>{contact.bankAccount}</div></div></div>}
          {contact?.gynecologistName && <div style={S.row}><Stethoscope className="h-4 w-4" style={{color:"#94a3b8",flexShrink:0}} /><div><div style={S.lbl}>{np.gynecologist||"Gynekológ"}</div><div style={S.val}>{contact.gynecologistName}</div>{contact.gynecologistPhone&&<div style={{...S.lbl,marginTop:2}}>{contact.gynecologistPhone}</div>}</div></div>}
          {contact?.hospitalName && <div style={S.row}><Building2 className="h-4 w-4" style={{color:"#94a3b8",flexShrink:0}} /><div><div style={S.lbl}>{np.hospital||"Nemocnica"}</div><div style={S.val}>{contact.hospitalName}</div></div></div>}
          {contact?.leadSource && <div style={{...S.row,alignItems:"flex-start"}}><Info className="h-4 w-4" style={{color:"#94a3b8",flexShrink:0,marginTop:2}} /><div><div style={S.lbl}>{np.leadSource||"Zdroj leadu"}</div><div style={S.val}>{contact.leadSource}</div>{contact.leadSourceNotes&&<div style={{...S.lbl,marginTop:4,lineHeight:1.4}}>{contact.leadSourceNotes}</div>}</div></div>}
          {contact?.website && <div style={S.row}><Globe className="h-4 w-4" style={{color:"#94a3b8",flexShrink:0}} /><div><div style={S.lbl}>Web</div><a href={String(contact.website).startsWith("http")?String(contact.website):`https://${contact.website}`} target="_blank" rel="noopener noreferrer" style={{...S.val,color:"#6366f1"}} onClick={e=>e.stopPropagation()}>{contact.website}</a></div></div>}
          {contact?.registrationSource && <div style={S.row}><Info className="h-4 w-4" style={{color:"#94a3b8",flexShrink:0}} /><div><div style={S.lbl}>{np.registrationSource||"Zdroj registrácie"}</div><div style={{...S.val,textTransform:"capitalize"}}>{contact.registrationSource}</div></div></div>}
          {contact?.notes && <div style={{...S.row,alignItems:"flex-start"}}><FileText className="h-4 w-4" style={{color:"#6366f1",flexShrink:0,marginTop:2}} /><div><div style={{...S.lbl,fontWeight:600}}>{np.notes||"Poznámky"}</div><div style={{fontSize:13,color:"#334155",marginTop:4,lineHeight:1.5,whiteSpace:"pre-line"}}>{contact.notes}</div></div></div>}
        </div>
      </div>
      <div style={S.card}>
        <button onClick={() => setShowHistory(v => !v)} style={S.btn} data-testid="btn-mobile-call-history">
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <History className="h-4 w-4" style={{color:"#6366f1",flexShrink:0}} />
            <span style={S.hdrTxt}>{np.callHistory||"Call history"}</span>
            {recentCalls.length > 0 && <span style={{fontSize:11,padding:"1px 6px",borderRadius:999,background:"#f1f5f9",color:"#64748b",fontWeight:600}}>{recentCalls.length}</span>}
          </div>
          {showHistory ? <ChevronUp className="h-4 w-4" style={{color:"#94a3b8"}} /> : <ChevronDown className="h-4 w-4" style={{color:"#94a3b8"}} />}
        </button>
        {showHistory && (
          <div style={{borderTop:"1px solid #e2e8f0",maxHeight:280,overflowY:"auto"}}>
            {recentCalls.length === 0
              ? <div style={{padding:"16px",textAlign:"center",fontSize:13,color:"#94a3b8"}}>{np.noCallHistory||"Žiadna história hovorov"}</div>
              : recentCalls.map((entry: any, idx: number) => (
                <div key={idx} style={{padding:"10px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",gap:10,alignItems:"flex-start"}}>
                  <div style={{width:32,height:32,borderRadius:8,background:entry.direction==="inbound"?"#eff6ff":"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <PhoneCall className="h-4 w-4" style={{color:entry.direction==="inbound"?"#3b82f6":"#94a3b8"}} />
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                      <span style={{fontSize:11,color:"#64748b",fontWeight:600}}>{(entry.timestamp||entry.date||entry.createdAt)?(()=>{try{return format(new Date(entry.timestamp||entry.date||entry.createdAt),"d. M. yyyy HH:mm")}catch{return"—"}})():"—"}</span>
                      {entry.duration!=null&&<span style={{fontSize:11,color:"#94a3b8",flexShrink:0}}>{fmtDur(Number(entry.duration))}</span>}
                    </div>
                    {entry.content&&<div style={{fontSize:12,fontWeight:700,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{entry.content}</div>}
                    {entry.status&&<div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{entry.status}</div>}
                    {entry.agentName&&<div style={{fontSize:10,color:"#cbd5e1",marginTop:1}}>{entry.agentName}</div>}
                    {(entry.notes||entry.callNotes)&&<div style={{fontSize:11,color:"#94a3b8",marginTop:2,lineHeight:1.4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{entry.notes||entry.callNotes}</div>}
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>
      {contact?.id && (
        <div style={S.card}>
          <button onClick={() => setShowNotes(v => !v)} style={S.btn} data-testid="btn-mobile-notes">
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <MessageSquare className="h-4 w-4" style={{color:"#6366f1",flexShrink:0}} />
              <span style={S.hdrTxt}>{np.notes||"Poznámky"}</span>
              {contactNotes.length > 0 && <span style={{fontSize:11,padding:"1px 6px",borderRadius:999,background:"#f1f5f9",color:"#64748b",fontWeight:600}}>{contactNotes.length}</span>}
            </div>
            {showNotes ? <ChevronUp className="h-4 w-4" style={{color:"#94a3b8"}} /> : <ChevronDown className="h-4 w-4" style={{color:"#94a3b8"}} />}
          </button>
          {showNotes && (
            <div style={{borderTop:"1px solid #e2e8f0"}}>
              {contactNotes.length === 0
                ? <div style={{padding:"14px",textAlign:"center",fontSize:13,color:"#94a3b8"}}>{np.noNotes||"Žiadne poznámky"}</div>
                : <div style={{maxHeight:256,overflowY:"auto"}}>{contactNotes.map((note: any) => (<div key={note.id} style={{padding:"10px 16px",borderBottom:"1px solid #f1f5f9"}}><div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:4}}><span style={{fontSize:11,fontWeight:700,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{note.userName||"—"}</span><span style={{fontSize:10,color:"#cbd5e1",flexShrink:0}}>{(()=>{try{return format(new Date(note.createdAt),"d. M. yyyy HH:mm")}catch{return""}})()}</span></div><p style={{fontSize:13,color:"#1e293b",lineHeight:1.5,whiteSpace:"pre-wrap",margin:0}}>{note.content}</p></div>))}</div>
              }
              <div style={{padding:"8px 12px 12px",borderTop:"1px solid #e2e8f0",background:"#f8fafc"}}>
                <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                  <textarea ref={noteTextareaRef} value={newNoteText} onChange={e => setNewNoteText(e.target.value)} placeholder={np.addNotePlaceholder||"Napísať poznámku…"} rows={2} style={{flex:1,fontSize:13,borderRadius:12,border:"1px solid #e2e8f0",background:"#fff",padding:"8px 12px",resize:"none",minHeight:56,fontFamily:"inherit",outline:"none"}} data-testid="input-mobile-new-note" onKeyDown={e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)&&newNoteText.trim()){addNoteMutation.mutate(newNoteText.trim())}}} />
                  <button onClick={() => { if(newNoteText.trim()) addNoteMutation.mutate(newNoteText.trim()); }} disabled={!newNoteText.trim()||addNoteMutation.isPending} style={{width:40,height:40,borderRadius:12,background:"#6366f1",color:"#fff",border:"none",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,opacity:(!newNoteText.trim()||addNoteMutation.isPending)?0.4:1,cursor:"pointer"}} data-testid="btn-mobile-send-note"><Send className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );

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
        <div className="flex-1 min-h-0 flex flex-col">
          {/* ── Fixed top: avatar + call controls + sliders ── */}
          <div className="shrink-0">
            <div className="flex flex-col items-center py-6 px-4 gap-3">
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
            <div className="px-4 pb-3">
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
              {/* Volume & mic sliders */}
              <div className="rounded-2xl bg-muted/50 border px-4 py-3 space-y-3">
                <div className="flex items-center gap-3">
                  <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 flex items-center gap-2">
                    <Slider
                      value={[volume]}
                      onValueChange={([v]) => onVolumeChange?.(v)}
                      min={0} max={100} step={1}
                      className="flex-1"
                      data-testid="slider-mobile-volume"
                    />
                    <span className="text-xs font-mono text-muted-foreground w-8 text-right">{volume}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 flex items-center gap-2">
                    <Slider
                      value={[micVolume]}
                      onValueChange={([v]) => onMicVolumeChange?.(v)}
                      min={0} max={100} step={1}
                      className="flex-1"
                      data-testid="slider-mobile-mic"
                    />
                    <span className="text-xs font-mono text-muted-foreground w-8 text-right">{micVolume}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* ── Scroll area: contact info tabs + status list ── */}
          <div className="flex-1 min-h-0 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
            <div className="px-4 pt-3 pb-2 flex flex-col gap-3">
              {contactInfoSection}
            </div>
            {dbStatusList.length > 0 && (
              <StatusListPanel items={dbStatusList} checked={dbSlChecked} onToggle={onSlToggle} np={np} />
            )}
          </div>
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
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 px-4 pt-3 pb-4 touch-pan-y">
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
          {contactInfoSection}
          <StatusListPanel items={dbStatusList} checked={dbSlChecked} onToggle={onSlToggle} np={np} />
          <button onClick={onClearContact}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-dashed border-amber-400 text-amber-600 dark:text-amber-400 text-sm font-semibold bg-amber-50/50 dark:bg-amber-950/10 active:scale-[0.98] transition-all"
            data-testid="btn-mobile-release-contact-ended">
            <UserX className="h-4 w-4" />
            {np.releaseContact || "Release contact / skip"}
          </button>
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

    return (
      <div className="flex flex-col h-full">
        <MobileHeader {...headerProps} onLogout={() => setLogoutConfirm(true)} />
        {breakMenuOpen && <BreakMenu {...breakMenuProps} />}

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 px-4 pt-3 pb-4">
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

          {/* Release contact — always visible */}
          <button onClick={onClearContact}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-dashed border-amber-400 text-amber-600 dark:text-amber-400 text-sm font-semibold bg-amber-50/50 dark:bg-amber-950/10 active:scale-[0.98] transition-all"
            data-testid="btn-mobile-release-contact">
            <UserX className="h-4 w-4" />
            {np.releaseContact || "Release contact / skip"}
          </button>

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

          {contactInfoSection}

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
  const ST = { terra: "#B5622E", sage: "#5E7A5A", sand: "#A0946A" };
  const callableStatuses = ["callback_scheduled", "pending"];

  // When user is actively searching, use allCampaignContacts (all statuses) so search finds
  // previously contacted/completed entries too — matching NexusPulse behavior.
  const searchPool = searchQ.trim() && allCampaignContacts ? allCampaignContacts : campaignContacts;

  const byTab = (() => {
    let base =
      filterTab === "callable"  ? searchPool.filter((cc: any) => callableStatuses.includes(cc.status))
      : filterTab === "callbacks" ? searchPool.filter((cc: any) => cc.status === "callback_scheduled")
      : filterTab === "pending"   ? searchPool.filter((cc: any) => cc.status === "pending")
      : searchPool;
    if (filterTab === "callbacks" && showOnlyMineCallbacks) {
      base = base.filter((cc: any) =>
        !cc.assignedTo || cc.assignedTo === "all" || cc.assignedTo === currentUserId
      );
    }
    return base;
  })();

  const filteredOverdue  = byTab.filter((cc: any) => cc.status === "callback_scheduled" && cc.callbackDate && new Date(cc.callbackDate) <= now).filter(cc => ccSearchMatch(cc, searchQ, searchField));
  const filteredUpcoming = byTab.filter((cc: any) => cc.status === "callback_scheduled" && cc.callbackDate && new Date(cc.callbackDate) > now).filter(cc => ccSearchMatch(cc, searchQ, searchField));
  const filteredPending  = byTab.filter((cc: any) => cc.status === "pending").filter(cc => ccSearchMatch(cc, searchQ, searchField));
  const filteredOthers   = byTab.filter((cc: any) => !callableStatuses.includes(cc.status)).filter(cc => ccSearchMatch(cc, searchQ, searchField));
  const totalFiltered = filteredOverdue.length + filteredUpcoming.length + filteredPending.length + filteredOthers.length;

  const tabCount = (tab: string) =>
    tab === "callable"  ? campaignContacts.filter((cc: any) => callableStatuses.includes(cc.status)).length
    : tab === "callbacks" ? campaignContacts.filter((cc: any) => cc.status === "callback_scheduled").length
    : tab === "pending"   ? campaignContacts.filter((cc: any) => cc.status === "pending").length
    : campaignContacts.length;

  const SEARCH_FIELDS = [
    { value: "all",     label: np.searchFieldAll     || "Všetky polia" },
    { value: "name",    label: np.searchFieldName    || "Meno" },
    { value: "phone",   label: np.searchFieldPhone   || "Telefón" },
    { value: "email",   label: np.searchFieldEmail   || "Email" },
    { value: "city",    label: np.searchFieldCity    || "Mesto" },
    { value: "entity",  label: np.searchFieldEntity  || "Zariadenie" },
    { value: "address", label: np.searchFieldAddress || "Adresa" },
  ];

  return (
    <div className="flex flex-col h-full relative">
      <MobileHeader {...headerProps} onLogout={() => setLogoutConfirm(true)} />
      {breakMenuOpen && <BreakMenu {...breakMenuProps} />}

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        {/* ── Search + filters ─────────────────────────────────── */}
        <div className="shrink-0 px-4 pt-3 pb-2 space-y-2 border-b bg-background">
          {campaign && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: `${ST.terra}15`, color: ST.terra, border: `1px solid ${ST.terra}30` }}>
                <Zap className="h-3 w-3" />{campaign.name}
              </span>
              <span className="text-xs text-muted-foreground">{totalFiltered} {np.contacts || "contacts"}</span>
            </div>
          )}

          {/* Search bar + field picker */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder={searchField === "all"
                  ? (np.searchContacts || "Hľadať meno, tel., email, mesto…")
                  : `${np.searchIn || "Hľadať:"} ${SEARCH_FIELDS.find(f => f.value === searchField)?.label}`}
                className="w-full h-10 pl-9 pr-8 rounded-xl border bg-background text-sm focus:outline-none transition-colors"
                style={{ borderColor: searchQ ? ST.terra : undefined }}
                data-testid="input-mobile-search"
              />
              {searchQ && (
                <button onClick={() => setSearchQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="relative">
              <button
                onClick={() => setShowFieldPicker(v => !v)}
                className="h-10 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors"
                style={searchField !== "all"
                  ? { background: ST.terra, color: "#fff", borderColor: ST.terra }
                  : {}}
                data-testid="btn-search-field-picker"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {searchField === "all" ? (np.searchFieldBtn || "Pole") : SEARCH_FIELDS.find(f => f.value === searchField)?.label?.split(" ")[0]}
              </button>
              {showFieldPicker && (
                <div className="absolute right-0 top-11 z-50 bg-background border rounded-xl shadow-xl py-1 w-44">
                  {SEARCH_FIELDS.map(f => (
                    <button key={f.value}
                      onClick={() => { setSearchField(f.value); setShowFieldPicker(false); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center justify-between"
                      style={searchField === f.value ? { color: ST.terra, fontWeight: 700 } : {}}>
                      {f.label}
                      {searchField === f.value && <span className="w-1.5 h-1.5 rounded-full" style={{ background: ST.terra }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1.5">
            {(["callable","callbacks","pending","all"] as const).map(tab => {
              const labels: Record<string, string> = {
                callable: np.tabCallable||"Na volanie",
                callbacks: np.tabCallbacks||"Callbacky",
                pending: np.tabPending||"Nové",
                all: np.tabAll||"Všetky",
              };
              return (
                <button key={tab} onClick={() => setFilterTab(tab)}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                  style={filterTab === tab
                    ? { background: ST.terra, color: "#fff" }
                    : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
                  data-testid={`btn-tab-${tab}`}>
                  {labels[tab]}
                  <span className="ml-1 text-[10px] opacity-70">({tabCount(tab)})</span>
                </button>
              );
            })}
          </div>
          {filterTab === "callbacks" && (
            <button
              onClick={() => setShowOnlyMineCallbacks(v => !v)}
              data-testid="btn-mobile-only-mine-callbacks"
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "5px 10px",
                borderRadius: 8, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
                background: showOnlyMineCallbacks ? ST.terra : "hsl(var(--muted))",
                color: showOnlyMineCallbacks ? "#fff" : "hsl(var(--muted-foreground))",
              }}>
              <User className="h-3 w-3" />
              {np.onlyAssigned || "Len moje"}
            </button>
          )}
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
          <div className="flex flex-col gap-2 px-4 pb-4 pt-2">
            {filteredOverdue.length > 0 && (
              <>
                <div className="flex items-center gap-2 mt-1 mb-0.5">
                  <div className="h-px flex-1 rounded" style={{ background: `${ST.terra}40` }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: ST.terra }}>
                    <AlertCircle className="h-3 w-3" />{np.overdueCallbacks || "Premeškané callbacky"}
                  </span>
                  <div className="h-px flex-1 rounded" style={{ background: `${ST.terra}40` }} />
                </div>
                {filteredOverdue.map(cc => (
                  <ContactRow key={cc.id} cc={cc} onSelect={onSelectContact} isOverdue callbackDate={cc.callbackDate} np={np} currentUserId={currentUserId} />
                ))}
              </>
            )}
            {filteredUpcoming.length > 0 && (
              <>
                <div className="flex items-center gap-2 mt-1 mb-0.5">
                  <div className="h-px flex-1 rounded" style={{ background: `${ST.sage}40` }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: ST.sage }}>
                    <Calendar className="h-3 w-3" />{np.plannedCallbacks || "Naplánované callbacky"}
                  </span>
                  <div className="h-px flex-1 rounded" style={{ background: `${ST.sage}40` }} />
                </div>
                {filteredUpcoming.map(cc => (
                  <ContactRow key={cc.id} cc={cc} onSelect={onSelectContact} isUpcoming callbackDate={cc.callbackDate} np={np} currentUserId={currentUserId} />
                ))}
              </>
            )}
            {filteredPending.length > 0 && (
              <>
                {(filteredOverdue.length > 0 || filteredUpcoming.length > 0) && (
                  <div className="flex items-center gap-2 mt-1 mb-0.5">
                    <div className="h-px flex-1 rounded" style={{ background: `${ST.sand}40` }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ST.sand }}>
                      {np.newContacts || "Nové kontakty"}
                    </span>
                    <div className="h-px flex-1 rounded" style={{ background: `${ST.sand}40` }} />
                  </div>
                )}
                {filteredPending.map(cc => (
                  <ContactRow key={cc.id} cc={cc} onSelect={onSelectContact} np={np} />
                ))}
              </>
            )}
            {filteredOthers.length > 0 && (
              <>
                <div className="flex items-center gap-2 mt-1 mb-0.5">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {np.otherContacts || "Ostatné kontakty"}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                {filteredOthers.map(cc => (
                  <ContactRow key={cc.id} cc={cc} onSelect={onSelectContact} np={np} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
      <div className="text-center py-2 shrink-0">
        <span className="text-[10px] text-muted-foreground/40 select-none">build 2026-06-29c</span>
      </div>
    </div>
  );
}
