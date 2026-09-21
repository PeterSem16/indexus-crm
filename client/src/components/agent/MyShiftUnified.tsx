import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { startOfDay } from "date-fns";
import {
  ArrowDownUp, Calendar, CheckCircle2, ChevronDown, Clock, FileText,
  History, Loader2, LogIn, LogOut, Mail, MessageSquare, PhoneCall,
  PhoneIncoming, PhoneMissed, PhoneOutgoing, RefreshCcw, Search,
  SlidersHorizontal, UserRound, X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { htmlToPlainPreview } from "@/lib/sanitize-html";
import { getAgentBreakIcon } from "@/lib/agent-break-icons";
import "./my-shift-unified.css";

type ActivityType = "all" | "call" | "email" | "sms" | "missed" | "break" | "session";
type SearchField = "all" | "name" | "phone" | "email" | "queue" | "subject";
type SortKey = "newest" | "oldest" | "name" | "missed";

export interface MyActivityPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCampaignId: string | null;
  stats: { calls: number; emails: number; sms: number };
  abandonedCalls?: any[];
  onMakeCall?: (phone: string) => void;
  onCallFromShift?: (item: any) => void;
  onOpenEntity?: (type: string, id: string, campaignContactId?: string | null, campaignId?: string | null) => void;
  onOpenMissed?: (item: any) => void;
}

const MISSED_QUEUE_STATUSES = ["abandoned", "timeout", "overflow", "no_agents"];
const isMissed = (item: any) => item.itemType === "call"
  && (item.status === "no_answer" || item.status === "busy" || MISSED_QUEUE_STATUSES.includes(item.status));
const timestamp = (item: any) => {
  const value = new Date(item.sortTime || item.startedAt || 0).getTime();
  return Number.isFinite(value) ? value : 0;
};
const formatDuration = (seconds: number | null | undefined) => {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const total = Math.max(0, Math.floor(seconds));
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
    .map(value => String(value).padStart(2, "0")).join(":");
};

function ActivityIcon({ type, direction, size = 17, breakIcon }: { type: string; direction?: string; size?: number; breakIcon?: string | null }) {
  if (type === "missed") return <PhoneMissed size={size} aria-hidden="true" />;
  if (type === "call") return direction === "inbound"
    ? <PhoneIncoming size={size} aria-hidden="true" />
    : <PhoneOutgoing size={size} aria-hidden="true" />;
  if (type === "email") return <Mail size={size} aria-hidden="true" />;
  if (type === "sms") return <MessageSquare size={size} aria-hidden="true" />;
  if (type === "break") {
    const BreakIcon = getAgentBreakIcon(breakIcon);
    return <BreakIcon size={size} aria-hidden="true" />;
  }
  return <History size={size} aria-hidden="true" />;
}

/** Production graduation of the approved, untouched MyShiftUnified mockup. */
export function MyActivityPanel({
  open, onOpenChange, selectedCampaignId, abandonedCalls, onMakeCall, onCallFromShift, onOpenEntity, onOpenMissed,
}: MyActivityPanelProps) {
  const { t, locale } = useI18n();
  const aw = t.agentWorkspace;
  const copy = aw.unified;
  const closeRef = useRef<HTMLButtonElement>(null);
  const [filterType, setFilterType] = useState<ActivityType>("all");
  const [activitySearch, setActivitySearch] = useState("");
  const [activitySearchField, setActivitySearchField] = useState<SearchField>("all");
  const [activitySort, setActivitySort] = useState<SortKey>("newest");
  const [searchFocused, setSearchFocused] = useState(false);
  const { data: items = [], isLoading, isFetching, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["/api/agent/today-activity", selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];
      const response = await fetch(`/api/agent/today-activity?campaignId=${encodeURIComponent(selectedCampaignId)}`, { credentials: "include" });
      if (!response.ok) throw new Error(`${t.common.error} (${response.status})`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error(t.common.error);
      return data;
    },
    enabled: open && !!selectedCampaignId,
    refetchInterval: open ? 30000 : false,
  });

  // Queue misses have no agent userId and must be merged into the agent's feed.
  // Preserve the existing phone / five-minute-bucket deduplication contract.
  const dayStart = startOfDay(new Date());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const missedKey = (phone: unknown, time: string) =>
    `${String(phone || "").replace(/\D/g, "").slice(-9)}|${Math.floor(new Date(time).getTime() / 300000)}`;
  const existingMissedKeys = new Set(items
    .filter(item => item.itemType === "call" && (item.status === "no_answer" || item.status === "busy") && item.phoneNumber)
    .map(item => missedKey(item.phoneNumber, item.startedAt)));
  const missedQueueItems = (abandonedCalls || []).filter(call => {
    const time = call.enteredQueueAt || call.completedAt || call.createdAt;
    const date = new Date(time);
    return time && date >= dayStart && date < dayEnd
      && !existingMissedKeys.has(missedKey(call.callerNumber, time));
  }).map(call => {
    const time = call.enteredQueueAt || call.completedAt || call.createdAt;
    return {
      ...call,
      id: `missed-${call.id}`,
      itemType: "call",
      direction: "inbound",
      status: call.status || "abandoned",
      phoneNumber: call.callerNumber,
      durationSeconds: null,
      startedAt: time,
      answeredAt: null,
      endedAt: call.completedAt || null,
      sortTime: time,
      customerName: call.customerName || null,
      contactType: call.customerId ? "customer" : null,
      entityId: call.customerId || null,
      campaignContactId: null,
      campaignId: null,
      dispositionCode: null,
      inboundQueueName: call.queueName || null,
      missedCall: call,
    };
  });
  const allItems = [...items, ...missedQueueItems];
  const callItems = allItems.filter(item => item.itemType === "call");
  const emailItems = allItems.filter(item => item.itemType === "email");
  const smsItems = allItems.filter(item => item.itemType === "sms");
  const missedItems = callItems.filter(isMissed);
  const answeredCalls = callItems.filter(item => item.status === "answered" || item.status === "completed");
  const totalDuration = answeredCalls.reduce((sum, item) => sum + (item.durationSeconds || 0), 0);
  const activeSession = allItems.find(item => item.itemType === "session" && !item.endedAt);
  const sessionDuration = activeSession?.startedAt
    ? formatDuration((Date.now() - new Date(activeSession.startedAt).getTime()) / 1000) : null;
  const nameOf = (item: any): string => String(item.customerName || item.entityName || item.breakTypeName
    || (item.itemType === "session" ? aw.myShiftSessionLabel : item.itemType === "break" ? aw.myShiftBreakDefault : ""));
  const identityOf = (item: any): string => String(item.phoneNumber || item.recipientPhone || item.recipientEmail || "");
  const fieldsOf = (item: any): Record<SearchField, string> => {
    const fields = {
      name: nameOf(item),
      phone: [item.phoneNumber, item.recipientPhone].filter(Boolean).join(" "),
      email: [item.recipientEmail, item.sender, item.mailboxEmail].filter(Boolean).join(" "),
      queue: String(item.inboundQueueName || item.queueName || ""),
      subject: String(item.subject || ""),
    };
    return { ...fields, all: [...Object.values(fields), item.content, item.fullContent,
      item.htmlBody ? htmlToPlainPreview(item.htmlBody) : "", item.status].filter(Boolean).join(" ") };
  };
  const typeFiltered = allItems.filter(item => filterType === "all"
    || (filterType === "missed" ? isMissed(item) : item.itemType === filterType));
  const search = activitySearch.trim().toLocaleLowerCase(locale);
  const filtered = typeFiltered.filter(item => fieldsOf(item)[activitySearchField].toLocaleLowerCase(locale).includes(search))
    .sort((a, b) => {
      if (activitySort === "name") return nameOf(a).localeCompare(nameOf(b), locale);
      if (activitySort === "oldest") return timestamp(a) - timestamp(b);
      if (activitySort === "missed") return Number(isMissed(b)) - Number(isMissed(a)) || timestamp(b) - timestamp(a);
      return timestamp(b) - timestamp(a);
    });
  const suggestions = Array.from(new Set(typeFiltered.map(item => {
    const fields = fieldsOf(item);
    return activitySearchField === "all" ? fields.name || identityOf(item) || fields.subject : fields[activitySearchField];
  }).filter(Boolean))).slice(0, 4);
  const searchLabels: Record<SearchField, string> = {
    all: aw.fieldPickerAllFields, name: aw.fieldPickerName, phone: aw.fieldPickerPhone,
    email: aw.fieldPickerEmail, queue: aw.todayCallsQueue, subject: copy.subject,
  };
  const sortLabels: Record<SortKey, string> = {
    newest: copy.newest, oldest: copy.oldest, name: copy.nameAZ, missed: copy.missedFirst,
  };
  const typeLabels: Record<ActivityType, string> = {
    all: copy.allActivity, call: aw.myShiftFilterCalls, email: aw.myShiftFilterEmail,
    sms: aw.myShiftFilterSms, missed: aw.myShiftFilterMissed,
    break: aw.myShiftFilterBreak, session: aw.myShiftFilterSessions,
  };
  const hasFilters = filterType !== "all" || activitySearch !== "" || activitySearchField !== "all" || activitySort !== "newest";
  const resetView = () => {
    setFilterType("all"); setActivitySearch(""); setActivitySearchField("all"); setActivitySort("newest"); setSearchFocused(false);
  };
  const timeOf = (value: string | undefined | null, date = false) => {
    if (!value || !Number.isFinite(new Date(value).getTime())) return "—";
    return date ? new Date(value).toLocaleDateString(locale) : new Date(value).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
  };
  const openEntity = (item: any) => {
    onOpenEntity?.(item.contactType || "customer", item.entityId, item.campaignContactId, item.campaignId);
    onOpenChange(false);
  };
  const callFromShift = (item: any) => {
    if (onCallFromShift) onCallFromShift(item);
    else if (onMakeCall) onMakeCall(item.phoneNumber || item.recipientPhone);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="msu-dialog msu-production"
        overlayClassName="!bg-[#18314d]/30 backdrop-blur-[1px]"
        hideCloseButton
        data-testid="my-shift-unified-dialog"
        onOpenAutoFocus={event => { event.preventDefault(); closeRef.current?.focus({ preventScroll: true }); }}
      >
        <div className="msu-header">
          <div className="msu-title-icon"><History size={20} aria-hidden="true" /></div>
          <div className="msu-title-copy">
            <p className="msu-kicker">{copy.shiftKicker}</p>
            <DialogTitle className="msu-title">{aw.todayCallsPanelTitle}</DialogTitle>
            <DialogDescription>{t.common.today}, {new Date().toLocaleDateString(locale)} · {copy.allQueuesChannels}</DialogDescription>
          </div>
          {activeSession && <div className="msu-summary"><span className="msu-summary-dot" />{aw.myShiftSessionActive}{sessionDuration && ` · ${sessionDuration}`}</div>}
          <button className="msu-close" type="button" onClick={() => refetch()} disabled={isFetching} title={aw.todayCallsRefresh} aria-label={aw.todayCallsRefresh} data-testid="btn-my-activity-refresh">
            <RefreshCcw size={16} className={isFetching ? "animate-spin" : ""} />
          </button>
          <button ref={closeRef} className="msu-close" type="button" onClick={() => onOpenChange(false)} aria-label={t.common.close}><X size={17} /></button>
        </div>

        <div className="msu-metrics">
          <div className="msu-metric"><strong>{callItems.length}</strong><span>{aw.myShiftFilterCalls}</span></div>
          <div className="msu-metric alert"><strong>{missedItems.length}</strong><span>{aw.myShiftFilterMissed}</span></div>
          <div className="msu-metric"><strong>{emailItems.length + smsItems.length}</strong><span>{aw.myShiftFilterEmail} · {aw.myShiftFilterSms}</span></div>
          <div className="msu-metric green"><strong>{formatDuration(totalDuration)}</strong><span>{aw.todayCallsDuration}</span></div>
        </div>

        <div className="msu-search-area">
          <div className="msu-toolbar" onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSearchFocused(false);
          }}>
            <div className="msu-search">
              <Search size={16} aria-hidden="true" />
              <input value={activitySearch} onChange={event => setActivitySearch(event.target.value)}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={event => { if (event.key === "Escape" && searchFocused) { event.stopPropagation(); setSearchFocused(false); } }}
                placeholder={copy.searchShift} aria-label={copy.searchShift} data-testid="input-my-activity-search" />
              {activitySearch && <button className="msu-clear-search" type="button" onMouseDown={event => event.preventDefault()} onClick={() => setActivitySearch("")} aria-label={t.common.clear}><X size={13} /></button>}
            </div>
            <label className="msu-picker">
              <SlidersHorizontal size={14} aria-hidden="true" />
              <select value={activitySearchField} onChange={event => setActivitySearchField(event.target.value as SearchField)} aria-label={aw.fieldPickerAllFields} data-testid="select-my-activity-search-field">
                {Object.entries(searchLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select><ChevronDown size={13} aria-hidden="true" />
            </label>
            <label className="msu-sort">
              <ArrowDownUp size={14} aria-hidden="true" />
              <select value={activitySort} onChange={event => setActivitySort(event.target.value as SortKey)} aria-label={aw.sortByDate} data-testid="select-my-activity-sort">
                {Object.entries(sortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select><ChevronDown size={13} aria-hidden="true" />
            </label>
            {searchFocused && !activitySearch && suggestions.length > 0 && (
              <div className="msu-suggestions" aria-label={copy.searchShift}>
                {suggestions.map(value => <button key={value} className="msu-suggestion" type="button" onMouseDown={event => event.preventDefault()} onClick={() => { setActivitySearch(value); setSearchFocused(false); }}>
                  <span className="msu-suggestion-avatar"><Search size={12} /></span><span className="msu-suggestion-copy"><strong>{value}</strong></span>
                </button>)}
              </div>
            )}
          </div>
        </div>

        <div className="msu-filters">
          <span className="msu-filter-label">{copy.activityType}</span>
          {(Object.keys(typeLabels) as ActivityType[]).map(type => <button key={type} type="button"
            className={`msu-chip ${type === "missed" ? "missed" : ""} ${filterType === type ? "active" : ""}`}
            aria-pressed={filterType === type} onClick={() => setFilterType(type)} data-testid={`my-shift-type-${type}`}>
            {type === "missed" && <PhoneMissed size={12} aria-hidden="true" />}{typeLabels[type]}
            <span className="msu-chip-count">{type === "all" ? allItems.length : type === "missed" ? missedItems.length : allItems.filter(item => item.itemType === type).length}</span>
          </button>)}
        </div>

        <div className="msu-list" aria-busy={isFetching}>
          <div className="msu-list-head">
            <div className="msu-result-count" aria-live="polite">{filtered.length} {aw.resultsCount} <span>· {sortLabels[activitySort]}</span></div>
            {hasFilters && <button className="msu-reset" type="button" onClick={resetView}><RefreshCcw size={12} />{copy.clearFilters}</button>}
          </div>
          {isError && <div className="msu-error" role="alert"><strong>{t.common.error}</strong><span>{error instanceof Error ? error.message : t.common.error}</span><button className="msu-secondary" type="button" onClick={() => refetch()} disabled={isFetching}><RefreshCcw size={12} />{aw.todayCallsRefresh}</button></div>}
          {isLoading ? <div className="msu-empty" role="status"><Loader2 size={28} className="animate-spin" /><span>{t.common.loading}</span></div>
            : filtered.length === 0 ? (!isError && <div className="msu-empty">
              {allItems.length > 0 ? <Search size={34} /> : <CheckCircle2 size={34} />}
              <strong>{allItems.length > 0 ? copy.noMatches : aw.todayCallsEmpty}</strong>
              <span>{allItems.length > 0 ? copy.noMatchesHint : aw.todayCallsEmptyHint}</span>
              {hasFilters && <button className="msu-empty-reset" type="button" onClick={resetView}>{copy.clearFilters}</button>}
            </div>) : filtered.map(item => {
              const missed = isMissed(item);
              const type = missed ? "missed" : item.itemType;
              const name = nameOf(item);
              const identity = identityOf(item);
              const hasEntity = !!(onOpenEntity && item.entityId);
              const isCall = item.itemType === "call";
              const isSession = item.itemType === "session";
              const isBreak = item.itemType === "break";
              const breakColor = item.breakTypeColor || "#EAB308";
              const breakStyle = isBreak
                ? { color: breakColor, backgroundColor: `${breakColor}18` }
                : undefined;
              const isActive = (isSession || isBreak) && !item.endedAt;
              const isIn = item.direction === "inbound";
              const statusLabel = isActive ? (isSession ? aw.myShiftSessionActive : aw.myShiftBreakActive)
                : missed ? aw.myShiftFilterMissed
                : isCall && (item.status === "answered" || item.status === "completed")
                  ? (isIn ? aw.todayCallsInboundBadge : aw.todayCallsOutboundBadge)
                  : (aw.historyStatusLabels as Record<string, string>)[item.status] || item.status || typeLabels[item.itemType as ActivityType];
              const duration = formatDuration((isSession || (isBreak && isActive)) && item.startedAt
                ? Math.round(((item.endedAt ? new Date(item.endedAt).getTime() : Date.now()) - new Date(item.startedAt).getTime()) / 1000) : item.durationSeconds);
              const ringEnd = item.answeredAt || item.endedAt;
              const ring = isCall && item.startedAt && ringEnd
                ? formatDuration(Math.round((new Date(ringEnd).getTime() - new Date(item.startedAt).getTime()) / 1000)) : null;
              const body = item.htmlBody ? htmlToPlainPreview(item.htmlBody) : item.fullContent || item.content;
              return <div className="msu-row" key={`${item.itemType}-${item.id}`} data-testid={`my-shift-${item.itemType}-${item.id}`}>
                <div className={`msu-avatar ${type}`} style={breakStyle} aria-hidden="true">{name && !isSession && !isBreak
                  ? name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toLocaleUpperCase(locale)
                  : <ActivityIcon type={type} direction={item.direction} breakIcon={item.breakTypeIcon} />}</div>
                <div className="msu-row-main">
                  <div className="msu-row-top">
                    {hasEntity ? <button className="msu-name" type="button" onClick={() => openEntity(item)} data-testid={`btn-shift-open-entity-${item.id}`} title={name}><strong>{name || identity || aw.myShiftNoContact}</strong></button>
                      : <strong title={name || identity}>{name || identity || aw.myShiftNoContact}</strong>}
                    <span
                      className={`msu-badge ${missed ? "missed" : isActive || ["answered", "completed", "sent"].includes(item.status) ? "positive" : "neutral"}`}
                      style={breakStyle}
                    >
                      <ActivityIcon type={type} direction={item.direction} size={10} breakIcon={item.breakTypeIcon} />{statusLabel}
                    </span>
                  </div>
                  <span className="msu-identity">
                    {identity || (isSession || isBreak ? t.common.today : "—")}
                    {isCall && <> · {isIn ? aw.todayCallsInboundBadge : aw.todayCallsOutboundBadge}</>}
                    {item.inboundQueueName && <> · {item.inboundQueueName}</>}
                    {isCall && !hasEntity && <> · {aw.myShiftNoContact}</>}
                  </span>
                  {item.subject && <span className="msu-context" title={item.subject}><b>{item.subject}</b></span>}
                  {body && <span className="msu-context" title={body}>{body}</span>}
                  {(isSession || isBreak) && <span className="msu-context">
                    <LogIn size={10} /> {isSession && aw.myShiftSessionLogin} {timeOf(item.startedAt)}
                    {item.endedAt && <> · <LogOut size={10} /> {isSession && aw.myShiftSessionLogout} {timeOf(item.endedAt)}</>}
                  </span>}
                  <div className="msu-row-badges">
                    {ring && <span className="msu-meta-pill"><ActivityIcon type="call" direction={item.direction} size={10} />{aw.myShiftRing} {ring}</span>}
                    {duration && <span className="msu-meta-pill"><Clock size={10} />{isCall && aw.todayCallsDuration} {duration}</span>}
                    {item.workflowMode && item.outcomeBadges?.map((badge: any, index: number) => {
                      const color = badge.color || (badge.kind === "callback" ? "#2563eb" : "#059669");
                      const label = badge.kind === "callback" ? t.nexusPulse.dispCbScheduledTitle : badge.label || badge.code || "—";
                      return <span key={`${badge.kind}-${badge.code || index}`} className="msu-outcome-badge"
                        style={{ backgroundColor: `${color}18`, color, borderColor: `${color}45` }} title={label}>
                        {badge.kind === "callback" ? <Calendar size={10} /> : <FileText size={10} />}{label}
                      </span>;
                    })}
                  </div>
                </div>
                <div className="msu-row-meta"><strong>{timeOf(item.startedAt || item.sortTime)}</strong><span>{timeOf(item.startedAt || item.sortTime, true)}</span></div>
                {(hasEntity || (missed && onOpenMissed) || (isCall && item.phoneNumber && (onCallFromShift || onMakeCall))) && <div className="msu-row-actions">
                  {missed && onOpenMissed && <button className="msu-primary alert" type="button" onClick={() => { onOpenMissed(item.missedCall || item); onOpenChange(false); }}><PhoneMissed size={13} />{aw.myShiftFilterMissed}</button>}
                  {hasEntity && <button className="msu-primary" type="button" onClick={() => openEntity(item)} data-testid={`btn-shift-open-card-${item.id}`}><UserRound size={13} />{aw.myShiftOpenCard}</button>}
                  {isCall && item.phoneNumber && (onCallFromShift || onMakeCall) && <button className="msu-secondary msu-call" type="button" onClick={() => callFromShift(item)} aria-label={aw.callBack} title={aw.callBack} data-testid={`btn-shift-call-${item.id}`}><PhoneCall size={13} /></button>}
                </div>}
              </div>;
            })}
        </div>
        <div className="msu-footer">
          <span className="msu-footer-note"><Search size={13} />{copy.footerNote}</span>
          <span>{answeredCalls.length} {aw.todayCallsAnswered} · {t.common.today} · {copy.allQueuesChannels}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MyActivityPanel;