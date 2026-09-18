import { useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUpDown, Check, CheckCircle2, ChevronDown, Clock3, Loader2, Mail, MessageSquare, PhoneMissed, RotateCcw, Search, SlidersHorizontal, UserRound, X } from "lucide-react";
import { DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import "./MissedCommunicationsUnified.css";

type Channel = "all" | "calls" | "email" | "sms";
type Status = "all" | "pending" | "handled";
type SearchField = "all" | "name" | "phone" | "email" | "queue";
type SortKey = "date_desc" | "date_asc" | "name_asc" | "unhandled";

interface MissedItem {
  key: string;
  channel: Exclude<Channel, "all">;
  source: any;
  name: string;
  identity: string;
  phone: string;
  email: string;
  queue: string;
  preview: string;
  reason: string;
  timestamp: number;
  handled: boolean;
  handledBy: string;
}

interface Props {
  calls: any[];
  messages: any[];
  loading: boolean;
  errors: unknown[];
  onRetry: () => void;
  channel: Channel;
  onChannelChange: (channel: Channel) => void;
  status: Status;
  onStatusChange: (status: Status) => void;
  query: string;
  onQueryChange: (query: string) => void;
  searchField: SearchField;
  onSearchFieldChange: (field: SearchField) => void;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  openingCallId: string | null;
  plainPreview: (content: string) => string;
  renderCallPreview: (call: any) => ReactNode;
  onOpenCall: (call: any) => Promise<void>;
  onViewEmail: (message: any) => void;
  onReplyMessage: (message: any) => Promise<void>;
  onMarkCallHandled: (call: any) => Promise<void>;
  onMarkMessageHandled: (message: any) => Promise<void>;
}

function ChannelIcon({ channel, size = 15 }: { channel: MissedItem["channel"]; size?: number }) {
  if (channel === "calls") return <PhoneMissed size={size} aria-hidden="true" />;
  if (channel === "email") return <Mail size={size} aria-hidden="true" />;
  return <MessageSquare size={size} aria-hidden="true" />;
}

function timestamp(value: unknown) {
  const time = value ? new Date(String(value)).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

export function MissedCommunicationsUnified(props: Props) {
  const { t, locale } = useI18n();
  const a = t.agentWorkspace;
  const u = a.unified;
  const { channel, status, query, searchField, sort } = props;
  const [searchFocused, setSearchFocused] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const actionInFlight = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const channelLabels = { all: a.filterAll, calls: a.missedCallsTab, email: a.missedEmailsTab, sms: a.missedSmsTab };
  const statusLabels = { all: a.filterAll, pending: a.filterPending, handled: a.filterHandled };
  const searchLabels = { all: a.fieldPickerAllFields, name: a.fieldPickerName, phone: a.fieldPickerPhone, email: a.fieldPickerEmail, queue: a.todayCallsQueue };
  const sortLabels = { date_desc: u.newest, date_asc: u.oldest, name_asc: u.nameAZ, unhandled: u.unhandledFirst };

  const items = useMemo<MissedItem[]>(() => [
    ...props.calls.map(call => ({
      key: `abandoned-call-${call.id}`,
      channel: "calls" as const,
      source: call,
      name: String(call.customerName || call.callerName || call.customerPhone || call.callerNumber || ""),
      identity: String(call.customerPhone || call.callerNumber || ""),
      phone: [call.customerPhone, call.callerNumber].filter(Boolean).join(" "),
      email: String(call.customerEmail || ""),
      queue: String(call.queueName || ""),
      preview: "",
      reason: call.status === "no_agents" ? a.noAgentsStatus : call.status === "timeout" ? a.timeoutStatus
        : call.status === "overflow" ? a.overflowStatus : call.abandonReason === "caller_hangup" ? a.callerHangup : a.missedStatus,
      timestamp: timestamp(call.completedAt || call.enteredQueueAt || call.createdAt),
      handled: !!call.calledBack,
      handledBy: String(call.calledBackByUserName || ""),
    })),
    ...props.messages.filter(message => message.type === "email" || message.type === "sms").map(message => ({
      key: `missed-message-${message.id}`,
      channel: message.type as "email" | "sms",
      source: message,
      name: String(message.contactName || message.senderName || message.sender || message.senderPhone || ""),
      identity: String(message.type === "email" ? (message.sender || message.senderEmail || "") : (message.senderPhone || message.sender || "")),
      phone: String(message.senderPhone || (message.type === "sms" ? message.sender : "") || ""),
      email: String(message.type === "email" ? (message.sender || message.senderEmail || "") : ""),
      // The API supplies a mission/campaign, not a queue. Keep its real name; never invent a queue.
      queue: String(message.queueName || ""),
      preview: props.plainPreview(String(message.content || "")),
      reason: String(message.subject || ""),
      timestamp: timestamp(message.createdAt),
      handled: !!message.handledAt,
      handledBy: String(message.handledByUserName || ""),
    })),
  ], [props.calls, props.messages, props.plainPreview, a]);

  const fieldValue = (item: MissedItem, field: SearchField) => field === "all"
    ? [item.name, item.identity, item.phone, item.email, item.queue, item.source.campaignName, item.reason, item.preview].filter(Boolean).join(" ")
    : item[field];
  const normalized = query.trim().toLocaleLowerCase(locale);
  const visibleItems = items.filter(item => {
    if (channel !== "all" && item.channel !== channel) return false;
    if (status === "pending" && item.handled || status === "handled" && !item.handled) return false;
    return !normalized || fieldValue(item, searchField).toLocaleLowerCase(locale).includes(normalized);
  }).sort((left, right) => {
    if (sort === "name_asc") return left.name.localeCompare(right.name, locale);
    if (sort === "date_asc") return left.timestamp - right.timestamp;
    if (sort === "unhandled") return Number(left.handled) - Number(right.handled) || right.timestamp - left.timestamp;
    return right.timestamp - left.timestamp;
  });
  const inChannel = items.filter(item => channel === "all" || item.channel === channel);
  const counts = { all: inChannel.length, pending: inChannel.filter(item => !item.handled).length, handled: inChannel.filter(item => item.handled).length };
  const hasFilters = channel !== "all" || status !== "all" || !!query || searchField !== "all" || sort !== "date_desc";
  const suggestions = items.filter(item => (channel === "all" || channel === item.channel)
    && !!fieldValue(item, searchField) && (!normalized || fieldValue(item, searchField).toLocaleLowerCase(locale).includes(normalized))).slice(0, 4);
  const scopeNames = Array.from(new Set(items.map(item => item.queue || item.source.campaignName).filter(Boolean)));
  const scope = scopeNames.length ? scopeNames.join(" · ") : [channelLabels.calls, channelLabels.email, channelLabels.sms].join(" · ");
  const today = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date());

  function resetView() {
    props.onChannelChange("all");
    props.onStatusChange("all");
    props.onQueryChange("");
    props.onSearchFieldChange("all");
    props.onSortChange("date_desc");
    setSearchFocused(false);
  }

  async function runAction(key: string, action: () => Promise<void>) {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusyKey(key);
    setActionError("");
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t.common.error);
    } finally {
      actionInFlight.current = false;
      setBusyKey(null);
    }
  }

  return (
    <DialogContent
      className="um-dialog"
      data-testid="missed-unified-dialog"
      overlayClassName="!bg-slate-950/30 backdrop-blur-[1px]"
      hideCloseButton
      onOpenAutoFocus={event => { event.preventDefault(); closeRef.current?.focus({ preventScroll: true }); }}
      onInteractOutside={event => event.preventDefault()}
      onPointerDownOutside={event => event.preventDefault()}
      onFocusOutside={event => event.preventDefault()}
    >
      <div className="um-header">
        <div className="um-title-icon"><PhoneMissed size={20} aria-hidden="true" /></div>
        <div className="um-title-copy">
          <div className="um-kicker">{u.missedKicker}</div>
          <DialogTitle className="um-title">{a.missedTitle}</DialogTitle>
          <DialogDescription className="um-subtitle" title={scope}>{today} · {scope}</DialogDescription>
        </div>
        <div className="um-summary" aria-live="polite"><span className="um-summary-dot" />{items.filter(item => !item.handled).length} {a.missedUnhandledCount}</div>
        <DialogClose asChild><button ref={closeRef} className="um-close" type="button" aria-label={t.common.close}><X size={17} /></button></DialogClose>
      </div>
      <div className="um-search-area">
        <div className="um-toolbar">
          <div className="um-search">
            <Search size={16} aria-hidden="true" />
            <input data-testid="input-missed-search" value={query} onChange={event => props.onQueryChange(event.target.value)}
              onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
              onKeyDown={event => { if (event.key === "Escape" && searchFocused) { event.preventDefault(); event.stopPropagation(); setSearchFocused(false); } }}
              placeholder={u.searchMissed} aria-label={u.searchMissed} />
            {query && <button className="um-search-clear" type="button" onMouseDown={event => event.preventDefault()} onClick={() => props.onQueryChange("")} aria-label={t.common.clear}><X size={13} /></button>}
          </div>
          <label className="um-picker">
            <SlidersHorizontal size={14} aria-hidden="true" />
            <select data-testid="select-missed-search-field" value={searchField} onChange={event => props.onSearchFieldChange(event.target.value as SearchField)} aria-label={a.fieldPickerAll}>
              {Object.entries(searchLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <ChevronDown size={13} aria-hidden="true" />
          </label>
          <label className="um-sort">
            <ArrowUpDown size={14} aria-hidden="true" />
            <select data-testid="select-missed-sort" value={sort} onChange={event => props.onSortChange(event.target.value as SortKey)} aria-label={a.sortByDate}>
              {Object.entries(sortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <ChevronDown size={13} aria-hidden="true" />
          </label>
          {searchFocused && suggestions.length > 0 && <div className="um-suggestions">
            {suggestions.map(item => <button key={item.key} className="um-suggestion" type="button" onMouseDown={event => event.preventDefault()}
              onClick={() => { props.onQueryChange(searchField === "all" ? item.name : fieldValue(item, searchField)); setSearchFocused(false); }}>
              <span className="um-suggestion-avatar"><ChannelIcon channel={item.channel} size={13} /></span>
              <span className="um-suggestion-copy"><strong>{searchField === "all" ? item.name : fieldValue(item, searchField)}</strong><span>{item.identity}{item.queue && ` · ${item.queue}`}</span></span>
              <span className="um-suggestion-hint">{channelLabels[item.channel]}</span>
            </button>)}
          </div>}
        </div>
      </div>
      <div className="um-filters">
        <div className="um-filter-group" role="group" aria-label={u.channel}>
          <span className="um-filter-label">{u.channel}</span>
          {(["all", "calls", "email", "sms"] as const).map(key => <button key={key} type="button" className={`um-chip ${channel === key ? "active" : ""}`}
            data-testid={`missed-channel-${key}`} onClick={() => props.onChannelChange(key)} aria-pressed={channel === key}>
            {key !== "all" && <ChannelIcon channel={key} size={12} />}{channelLabels[key]} <span className="um-chip-count">{key === "all" ? items.length : items.filter(item => item.channel === key).length}</span>
          </button>)}
        </div>
        <span className="um-filter-divider" aria-hidden="true" />
        <div className="um-filter-group" role="group" aria-label={u.status}>
          <span className="um-filter-label">{u.status}</span>
          {(["all", "pending", "handled"] as const).map(key => <button key={key} type="button" className={`um-chip ${status === key ? "active" : ""}`}
            data-testid={`missed-status-${key}`} onClick={() => props.onStatusChange(key)} aria-pressed={status === key}>
            {statusLabels[key]} <span className="um-chip-count">{counts[key]}</span>
          </button>)}
        </div>
      </div>
      <div className="um-list" aria-busy={props.loading}>
        <div className="um-list-head">
          <div className="um-result-count" aria-live="polite">{visibleItems.length} {a.resultsCount} <span>· {sortLabels[sort]}</span></div>
          <div className="um-list-tools">{hasFilters && <button className="um-clear" type="button" onClick={resetView}><RotateCcw size={12} />{u.clearFilters}</button>}</div>
        </div>
        {(props.errors.length > 0 || actionError) && <div className="um-error" role="alert">
          <strong>{t.common.error}</strong>
          {props.errors.map((error, index) => <span key={index}>{error instanceof Error ? error.message : String(error)}</span>)}
          {actionError && <span>{actionError}</span>}
          {props.errors.length > 0 && <button type="button" className="um-secondary" onClick={props.onRetry}><RotateCcw size={12} />{t.common.refresh}</button>}
        </div>}
        {props.loading && <div className="um-loading" role="status"><Loader2 size={20} className="um-spin" />{t.common.loading}</div>}
        {visibleItems.map(item => {
          const minutes = item.timestamp ? Math.max(0, Math.floor((Date.now() - item.timestamp) / 60000)) : null;
          const wait = item.channel === "calls" ? Number(item.source.waitDurationSeconds || 0) : 0;
          const disabled = busyKey !== null || props.openingCallId !== null;
          const opening = busyKey === item.key || item.channel === "calls" && props.openingCallId === String(item.source.id);
          return <div className={`um-row ${item.channel === "email" ? "um-email-row" : ""}`} key={item.key} data-testid={item.key}
            onClick={item.channel === "email" ? () => props.onViewEmail(item.source) : undefined}
            onKeyDown={item.channel === "email" ? event => {
              if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                props.onViewEmail(item.source);
              }
            } : undefined}
            role={item.channel === "email" ? "button" : undefined}
            tabIndex={item.channel === "email" ? 0 : undefined}>
            <div className={`um-avatar ${item.channel === "calls" ? "call" : item.channel}`} aria-hidden="true"><ChannelIcon channel={item.channel} size={17} /></div>
            <div className="um-row-main">
              <div className="um-row-top">
                <strong title={item.name}>{item.name}</strong>
                <span className={`um-badge ${item.handled ? "handled" : "unhandled"}`}>
                  {item.handled ? <Check size={11} /> : <ChannelIcon channel={item.channel} size={10} />}
                  {item.handled ? a.filterHandled : `${channelLabels[item.channel]} · ${a.filterPending}`}
                </span>
              </div>
              <span className="um-identity" title={item.identity}>{item.identity}{(item.queue || item.source.campaignName) && <> <i>·</i> {item.queue || item.source.campaignName}</>}</span>
              <span className="um-context" title={[item.reason, item.preview].filter(Boolean).join(" · ")}>
                {item.channel === "email" && item.reason && <b>{u.subject} · </b>}
                {item.reason && <b>{item.reason}</b>}{item.reason && item.preview && " · "}{item.preview}
              </span>
              {item.channel === "calls" && <div className="um-card-preview">{props.renderCallPreview(item.source)}</div>}
              {item.handled && <span className="um-handled-by"><Check size={11} />{item.handledBy || a.handledBy}</span>}
            </div>
            <div className="um-row-meta">
              <strong>{item.timestamp ? new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(item.timestamp) : ""}</strong>
              <span>{minutes === null ? "" : minutes < 60 ? `${minutes}${a.agoMinutes}` : minutes < 1440 ? `${Math.floor(minutes / 60)}${a.agoHours} ${minutes % 60}${a.agoMinutes}` : new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(item.timestamp)}</span>
              {wait > 0 && <span className="um-wait"><Clock3 size={10} />{wait >= 60 ? `${Math.floor(wait / 60)}m ${wait % 60}s` : `${wait}s`}</span>}
            </div>
            <div className="um-row-actions" onClick={event => event.stopPropagation()}>
              {!item.handled && <button type="button" className="um-primary" disabled={disabled}
                data-testid={item.channel === "calls" ? `btn-callback-${item.source.id}` : `btn-reply-message-${item.source.id}`}
                onClick={() => void runAction(item.key, () => item.channel === "calls" ? props.onOpenCall(item.source) : props.onReplyMessage(item.source))}>
                {opening ? <Loader2 size={13} className="um-spin" /> : item.channel === "email" ? <Mail size={13} /> : <UserRound size={13} />}
                {opening ? a.openingCard : item.channel === "calls" ? a.openCardBtn : a.replyBtn}
              </button>}
              {item.handled && item.channel === "email" && <button type="button" className="um-secondary" onClick={() => props.onViewEmail(item.source)}><Mail size={13} />{t.common.detail}</button>}
              {!item.handled && <button type="button" className="um-secondary" disabled={disabled}
                data-testid={item.channel === "calls" ? `btn-mark-handled-call-${item.source.id}` : `btn-mark-handled-message-${item.source.id}`}
                onClick={() => void runAction(item.key, () => item.channel === "calls" ? props.onMarkCallHandled(item.source) : props.onMarkMessageHandled(item.source))}>
                {a.markHandledBtn}
              </button>}
            </div>
          </div>;
        })}
        {!props.loading && props.errors.length === 0 && visibleItems.length === 0 && <div className="um-empty">
          {items.length ? <Search size={34} aria-hidden="true" /> : <CheckCircle2 size={34} aria-hidden="true" />}
          <strong>{items.length ? u.noMatches : u.noMissed}</strong>
          <span>{items.length ? u.noMatchesHint : u.noMissedHint}</span>
          {hasFilters && <button className="um-empty-reset" type="button" onClick={resetView}>{u.clearFilters}</button>}
        </div>}
      </div>
      <div className="um-footer">
        <span className="um-footer-note"><Search size={13} />{u.footerNote}</span>
        <span className="um-footer-scope" title={scope}>{scope} · {today}</span>
      </div>
    </DialogContent>
  );
}