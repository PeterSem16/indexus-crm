import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, ArrowDownLeft, ArrowLeft, ArrowUpRight, Check, ChevronLeft, ChevronRight, Flame, MessageSquare, RefreshCw, Search, Send, Settings2, ShieldAlert, UserRound, X } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/i18n/I18nProvider";
import { apiRequest } from "@/lib/queryClient";
import { useOmniSmsUnread } from "@/hooks/use-omni-sms-unread";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OMNI_SMS_COUNTRIES, type OmniSmsAccess, type OmniSmsMessage, type OmniSmsPage, type OmniSmsPermissionUser, type OmniSmsProvider } from "@shared/omni-sms";
import "./omni-sms-workspace.css";

const PAGE_SIZE = 25;
const PROVIDERS: OmniSmsProvider[] = ["bulkgate", "smstools"];
const COUNTRIES: readonly string[] = [...OMNI_SMS_COUNTRIES];
type DirectionFilter = "all" | "inbound" | "outbound";
type ProviderFilter = "all" | OmniSmsProvider;

async function getJson<T>(url: string): Promise<T> {
  const response = await apiRequest("GET", url);
  return response.json() as Promise<T>;
}

function providerLabel(provider: string | null | undefined, copy: { unknownGateway: string }) {
  if (provider === "bulkgate") return "BulkGate";
  if (provider === "smstools") return "SMSTOOLS";
  return copy.unknownGateway;
}

function readableDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

interface OmniSmsWorkspaceProps {
  directionFilter?: DirectionFilter;
  onDirectionFilterChange?: (direction: DirectionFilter) => void;
  selectedMessageId?: string | null;
  onClearSelectedMessage?: () => void;
}

export function OmniSmsWorkspace({ directionFilter, onDirectionFilterChange, selectedMessageId, onClearSelectedMessage }: OmniSmsWorkspaceProps) {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const copy = t.omniSms;
  const queryClient = useQueryClient();
  const actorId = user?.id ?? "anonymous";
  const [country, setCountry] = useState("");
  const [provider, setProvider] = useState<ProviderFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [readState, setReadState] = useState<"all" | "read" | "unread">("all");
  const [readError, setReadError] = useState(false);
  const visibleMessageRef = useRef<string | null>(null);
  const [readRetry, setReadRetry] = useState(0);
  const { unread } = useOmniSmsUnread();
  const [direction, setDirection] = useState<DirectionFilter>(directionFilter ?? "all");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const committedSearchRef = useRef("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [replySuccess, setReplySuccess] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [permissionEdits, setPermissionEdits] = useState<Record<string, OmniSmsProvider[]>>({});
  const [savingUser, setSavingUser] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState("");
  const [permissionSaved, setPermissionSaved] = useState("");
  const clearInitialSelectionRef = useRef(onClearSelectedMessage);
  clearInitialSelectionRef.current = onClearSelectedMessage;
  const directionChangeRef = useRef(onDirectionFilterChange);
  directionChangeRef.current = onDirectionFilterChange;

  const accessQuery = useQuery<OmniSmsAccess>({
    queryKey: ["omni-sms", "access", actorId],
    queryFn: () => getJson<OmniSmsAccess>("/api/omni-sms/access"),
    enabled: Boolean(user?.id),
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 30_000,
  });
  const access = accessQuery.isError ? undefined : accessQuery.data;

  const authorityFingerprint = access
    ? JSON.stringify({
      isAdmin: access.isAdmin,
      countries: [...access.countries].sort(),
      grants: access.grants.map(grant => `${grant.countryCode}:${grant.provider}`).sort(),
    })
    : "";
  const priorGrantFingerprint = useRef<string | null>(null);
  useEffect(() => {
    if (priorGrantFingerprint.current !== null && priorGrantFingerprint.current !== authorityFingerprint) {
      const countryStillAvailable = !!access && access.countries.includes(country);
      if (!countryStillAvailable || (!access?.isAdmin && !(access?.grants.some(grant => grant.countryCode === country)))) {
        setSelectedId(null);
        setMobileDetail(false);
        setReplyText("");
        clearInitialSelectionRef.current?.();
      }
      void queryClient.invalidateQueries({ queryKey: ["omni-sms", "messages", actorId] });
      void queryClient.invalidateQueries({ queryKey: ["omni-sms", "message", actorId] });
    }
    priorGrantFingerprint.current = authorityFingerprint;
  }, [authorityFingerprint, access, country, queryClient, actorId]);

  useEffect(() => {
    if (directionFilter && directionFilter !== direction) {
      setDirection(directionFilter);
      if (directionFilter === "outbound") setReadState("all");
      setPage(0);
      setSelectedId(null);
      setMobileDetail(false);
    }
  }, [directionFilter, direction]);

  useEffect(() => {
    if (selectedMessageId) {
      setSelectedId(selectedMessageId);
      setMobileDetail(true);
    }
  }, [selectedMessageId]);

  useEffect(() => {
    if (!access) return;
    if (!country || !access.countries.includes(country)) setCountry(access.countries[0] ?? "");
  }, [access, country]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextSearch = searchText.trim();
      if (nextSearch !== committedSearchRef.current) {
        committedSearchRef.current = nextSearch;
        setSearch(nextSearch);
        setPage(0);
        setSelectedId(null);
        setMobileDetail(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const countryGrants = useMemo(
    () => access?.grants.filter(grant => grant.countryCode === country).map(grant => grant.provider) ?? [],
    [access?.grants, country],
  );
  const availableGateways = useMemo(() => {
    const listed = access?.gateways.filter(gateway => country === "ALL" || gateway.countries.includes(country)).map(gateway => gateway.provider) ?? [];
    return Array.from(new Set([...listed, ...countryGrants]));
  }, [access?.gateways, country, countryGrants]);
  const canReadCountry = !!access?.isAdmin || (
    countryGrants.length > 0 && (provider === "all" || countryGrants.includes(provider))
  );
  const messageParams = new URLSearchParams({ country, page: String(page), pageSize: String(PAGE_SIZE) });
  if (provider !== "all") messageParams.set("provider", provider);
  if (direction !== "all") messageParams.set("direction", direction);
  if (search) messageParams.set("q", search);
  if (readState !== "all") messageParams.set("readState", readState);
  const listKey = ["omni-sms", "messages", actorId, authorityFingerprint, country, provider, direction, readState, search, page, PAGE_SIZE] as const;
  const messagesQuery = useQuery<OmniSmsPage>({
    queryKey: listKey,
    queryFn: () => getJson<OmniSmsPage>(`/api/omni-sms/messages?${messageParams.toString()}`),
    enabled: Boolean(user?.id && country && access && canReadCountry),
    staleTime: 0,
    refetchInterval: 10_000,
  });

  const detailKey = ["omni-sms", "message", actorId, authorityFingerprint, country, provider, direction, search, selectedId] as const;
  const detailQuery = useQuery<OmniSmsMessage>({
    queryKey: detailKey,
    queryFn: () => getJson<OmniSmsMessage>(`/api/omni-sms/messages/${encodeURIComponent(selectedId ?? "")}`),
    enabled: Boolean(selectedId && access && (access.isAdmin || access.grants.length > 0)),
    staleTime: 0,
  });
  const detailRecord = detailQuery.isError ? undefined : detailQuery.data;
  visibleMessageRef.current = selectedId;
  const readRequests = useRef(new Set<string>());
  useEffect(() => {
    if (!detailRecord || detailRecord.direction !== "inbound" || detailRecord.isRead) return;
    const readKey = `${actorId}:${detailRecord.id}`;
    if (readRequests.current.has(readKey)) return;
    readRequests.current.add(readKey);
    setReadError(false);
    void apiRequest("POST", `/api/omni-sms/messages/${encodeURIComponent(detailRecord.id)}/read`)
      .then(async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["omni-sms", "unread", actorId] }),
          queryClient.invalidateQueries({ queryKey: ["omni-sms", "messages", actorId] }),
          queryClient.invalidateQueries({ queryKey: ["omni-sms", "message", actorId] }),
        ]);
      })
      .catch(() => {
        readRequests.current.delete(readKey);
        if (visibleMessageRef.current === detailRecord.id) setReadError(true);
      });
  }, [detailRecord, actorId, queryClient, readRetry]);
  const detailCountryMatches = !!detailRecord && (country === "ALL" || (country === "UNASSIGNED"
    ? detailRecord.countryCode === null
    : detailRecord.countryCode === country));
  const detailHasAuthority = !!detailRecord && (!!access?.isAdmin || (!!detailRecord.countryCode && !!detailRecord.provider && access?.grants.some(
    grant => grant.countryCode === detailRecord.countryCode && grant.provider === detailRecord.provider,
  )));
  const detail = canReadCountry && detailCountryMatches && detailHasAuthority ? detailRecord : undefined;

  useEffect(() => {
    if (!selectedId || !detailRecord) return;
    const sourceCountry = detailRecord.countryCode ?? "UNASSIGNED";
    if (sourceCountry !== country && country !== "ALL") {
      setCountry(sourceCountry);
      setProvider("all");
      setDirection("all");
      directionChangeRef.current?.("all");
      setSearchText("");
      setSearch("");
      setPage(0);
      setMobileDetail(true);
    }
  }, [selectedId, detailRecord?.id, detailRecord?.countryCode, country]);

  const permissionKey = ["omni-sms", "permissions", actorId, country] as const;
  const permissionsQuery = useQuery<{ users: OmniSmsPermissionUser[] }>({
    queryKey: permissionKey,
    queryFn: () => getJson<{ users: OmniSmsPermissionUser[] }>(`/api/omni-sms/permissions?country=${encodeURIComponent(country)}`),
    enabled: Boolean(manageOpen && access?.isAdmin && COUNTRIES.includes(country)),
    staleTime: 0,
  });

  const changeCountry = (value: string) => {
    setCountry(value);
    setProvider("all");
    if (value === "UNASSIGNED") setManageOpen(false);
    setPermissionEdits({});
    setPage(0);
    setSelectedId(null);
    setMobileDetail(false);
    setReplyText("");
    onClearSelectedMessage?.();
  };
  const changeFilter = (update: () => void) => {
    update();
    setPage(0);
    setSelectedId(null);
    setMobileDetail(false);
    onClearSelectedMessage?.();
  };

  const retryAccess = () => void accessQuery.refetch();
  const retryMessages = () => void messagesQuery.refetch();
  const total = canReadCountry ? messagesQuery.data?.total ?? 0 : 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pageMessages = messagesQuery.isError || !canReadCountry ? [] : (messagesQuery.data?.messages ?? []).filter(message =>
    !!access?.isAdmin || (!!message.countryCode && !!message.provider && access?.grants.some(
      grant => grant.countryCode === message.countryCode && grant.provider === message.provider,
    )),
  );
  const knownCountry = COUNTRIES.includes(detail?.countryCode ?? "");
  const knownProvider = PROVIDERS.includes((detail?.provider ?? "") as OmniSmsProvider);
  const replyPhone = detail?.direction === "inbound" ? detail.senderPhone : detail?.recipientPhone;
  const canReply = !!detail && !!replyPhone && knownCountry && knownProvider;

  const submitReply = async () => {
    if (!detail || !canReply || !replyPhone || !replyText.trim() || sending) return;
    setSending(true);
    setReplyError("");
    setReplySuccess(false);
    try {
      const response = await apiRequest("POST", "/api/send-sms", {
        sourceSmsId: detail.id,
        to: replyPhone,
        message: replyText.trim(),
        gateway: detail.provider,
        customerId: detail.customerId,
        contactType: detail.entityType,
        campaignId: detail.campaignId,
      });
      const data = await response.json() as { success?: boolean; error?: string };
      if (data.success !== true) throw new Error(data.error || copy.replyFailed);
      setReplyText("");
      setReplySuccess(true);
      await queryClient.invalidateQueries({ queryKey: ["omni-sms", "messages", actorId] });
      await queryClient.invalidateQueries({ queryKey: ["omni-sms", "message", actorId] });
    } catch {
      setReplyError(copy.replyFailed);
    } finally {
      setSending(false);
    }
  };

  const users = permissionsQuery.isError ? [] : permissionsQuery.data?.users ?? [];
  const toggleProvider = (user: OmniSmsPermissionUser, gateway: OmniSmsProvider) => {
    const current = permissionEdits[user.id] ?? user.providers;
    setPermissionEdits(previous => ({
      ...previous,
      [user.id]: current.includes(gateway) ? current.filter(item => item !== gateway) : [...current, gateway],
    }));
    setPermissionError("");
    setPermissionSaved("");
  };
  const savePermissions = async (person: OmniSmsPermissionUser) => {
    if (!access?.isAdmin || !country) return;
    setSavingUser(person.id);
    setPermissionError("");
    setPermissionSaved("");
    try {
      const response = await apiRequest("PUT", `/api/omni-sms/permissions/${encodeURIComponent(person.id)}`, {
        countryCode: country,
        providers: permissionEdits[person.id] ?? person.providers,
      });
      await response.json();
      setPermissionSaved(person.id);
      setPermissionEdits(previous => {
        const next = { ...previous };
        delete next[person.id];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["omni-sms", "permissions", actorId, country] });
      await queryClient.invalidateQueries({ queryKey: ["omni-sms", "access", actorId] });
    } catch {
      setPermissionError(copy.saveError);
    } finally {
      setSavingUser(null);
    }
  };

  const contactName = detail?.customer
    ? `${detail.customer.firstName} ${detail.customer.lastName}`
    : detail?.contactName || (detail?.direction === "inbound" ? detail?.senderPhone : detail?.recipientPhone) || copy.unknownContact;
  const aiNeedsAttention = !!detail?.aiAnalyzed && ((!!detail.aiAlertLevel && detail.aiAlertLevel !== "none") || detail.aiSentiment === "negative" || detail.aiSentiment === "angry" || !!detail.aiHasAngryTone);

  if (accessQuery.isLoading || (!accessQuery.data && !accessQuery.isError)) {
    return <div className="nexus-signal-tasks nexus-sms-workspace"><div className="sms-workspace-loading" aria-label={copy.loading}><div className="sms-loading-heading" /><div className="sms-loading-row" /><div className="sms-loading-row" /><div className="sms-loading-row" /></div></div>;
  }
  if (accessQuery.isError) {
    return <div className="nexus-signal-tasks nexus-sms-workspace"><div className="sms-workspace-state" role="alert"><AlertCircle className="h-7 w-7" /><p>{copy.accessError}</p><Button variant="outline" size="sm" onClick={retryAccess}>{copy.retry}</Button></div></div>;
  }
  if (!access) {
    return <div className="nexus-signal-tasks nexus-sms-workspace"><div className="sms-workspace-state" role="alert"><AlertCircle className="h-7 w-7" /><p>{copy.accessError}</p><Button variant="outline" size="sm" onClick={retryAccess}>{copy.retry}</Button></div></div>;
  }

  return (
    <div className="nexus-signal-tasks nexus-sms-workspace" data-testid="omni-sms-workspace">
      <section className={`nexus-signal-queue sms-queue ${mobileDetail ? "sms-mobile-hidden" : ""}`} aria-label={copy.title}>
        <header className="nexus-signal-queue-header sms-queue-header">
          <div className="sms-topline">
            <div className="flex min-w-0 items-center gap-2">
              <MessageSquare className="h-4 w-4 shrink-0" />
              <h2 className="truncate text-sm font-semibold">{copy.title}</h2>
              <Badge variant="secondary" className="text-[10px]">{total}</Badge>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={copy.filters} title={copy.filters} aria-expanded={filtersOpen} aria-controls="sms-filter-controls" onClick={() => setFiltersOpen(value => !value)} data-testid="sms-toggle-filters"><Settings2 className="h-3.5 w-3.5" /></Button>
              {access.isAdmin && <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={copy.manageAccess} title={copy.manageAccess} disabled={!COUNTRIES.includes(country)} onClick={() => setManageOpen(value => !value)}><UserRound className="h-3.5 w-3.5" /></Button>}
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={copy.retry} title={copy.retry} onClick={() => { setSelectedId(null); setMobileDetail(false); onClearSelectedMessage?.(); void accessQuery.refetch(); void messagesQuery.refetch(); }}><RefreshCw className="h-3.5 w-3.5" /></Button>
              <Button type="button" variant="ghost" size="icon" className="sms-mobile-back h-7 w-7" aria-label={copy.close} onClick={() => setMobileDetail(false)}><X className="h-4 w-4" /></Button>
            </div>
          </div>
          {filtersOpen && <div className="sms-filter-grid" id="sms-filter-controls" data-testid="sms-filter-controls">
            <label className="sms-filter-field"><span>{copy.country}</span>
              <Select value={country} onValueChange={changeCountry}>
                <SelectTrigger className="h-8 text-xs" aria-label={copy.country}><SelectValue placeholder={copy.country} /></SelectTrigger>
                <SelectContent>{access.countries.map(code => <SelectItem key={code} value={code}>{code === "ALL" ? copy.allCountries : code === "UNASSIGNED" ? copy.unassignedCountry : code}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="sms-filter-field"><span>{copy.provider}</span>
              <Select value={provider} onValueChange={value => changeFilter(() => setProvider(value as ProviderFilter))}>
                <SelectTrigger className="h-8 text-xs" aria-label={copy.provider}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{copy.all}</SelectItem>
                  {(access.isAdmin ? availableGateways : availableGateways.filter(gateway => countryGrants.includes(gateway))).map(gateway => <SelectItem key={gateway} value={gateway}>{access.gateways.find(item => item.provider === gateway)?.label || providerLabel(gateway, copy)}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className="sms-filter-field"><span>{copy.direction}</span>
              <Select value={direction} onValueChange={value => changeFilter(() => { setDirection(value as DirectionFilter); if (value === "outbound") setReadState("all"); onDirectionFilterChange?.(value as DirectionFilter); })}>
                <SelectTrigger className="h-8 text-xs" aria-label={copy.direction}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">{copy.all}</SelectItem><SelectItem value="inbound">{copy.inbound}</SelectItem><SelectItem value="outbound">{copy.outbound}</SelectItem></SelectContent>
              </Select>
            </label>
          </div>}
          {filtersOpen && <label className="sms-filter-field mb-2"><span>{copy.readState}</span>
            <Select value={readState} onValueChange={value => changeFilter(() => {
              setReadState(value as "all" | "read" | "unread");
              if (value !== "all") { setDirection("inbound"); onDirectionFilterChange?.("inbound"); }
            })}>
              <SelectTrigger className="h-8 text-xs" aria-label={copy.readState} data-testid="sms-read-filter"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">{copy.all}</SelectItem><SelectItem value="unread">{copy.unread}</SelectItem><SelectItem value="read">{copy.read}</SelectItem></SelectContent>
            </Select>
          </label>}
          {unread > 0 && <button type="button" className="sms-new-message-banner" aria-live="polite" onClick={() => changeFilter(() => { setReadState("unread"); setDirection("inbound"); setProvider("all"); setSearchText(""); setSearch(""); if (access.isAdmin) setCountry("ALL"); onDirectionFilterChange?.("inbound"); })} data-testid="sms-new-message-banner"><MessageSquare className="h-4 w-4" />{copy.unread}<strong>{unread}</strong></button>}
          <label className="nexus-signal-queue-search sms-search">
            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <Input value={searchText} onChange={event => { setSearchText(event.target.value); setSelectedId(null); setMobileDetail(false); onClearSelectedMessage?.(); }} placeholder={copy.search} aria-label={copy.search} data-testid="sms-search" />
            {searchText && <button type="button" aria-label={copy.clearFilters} onClick={() => setSearchText("")}><X className="h-3.5 w-3.5" /></button>}
          </label>
          <div className="sms-page-controls">
            <span className="text-[11px] text-muted-foreground">{total ? `${page + 1}/${totalPages}` : "0/0"} · {total}</span>
            <div className="flex items-center gap-0.5">
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={copy.previous} disabled={page <= 0 || messagesQuery.isFetching} onClick={() => { setSelectedId(null); setMobileDetail(false); setPage(value => Math.max(0, value - 1)); onClearSelectedMessage?.(); }}><ChevronLeft className="h-3.5 w-3.5" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={copy.next} disabled={page >= totalPages - 1 || messagesQuery.isFetching} onClick={() => { setSelectedId(null); setMobileDetail(false); setPage(value => value + 1); onClearSelectedMessage?.(); }}><ChevronRight className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        </header>
        {manageOpen && access.isAdmin && COUNTRIES.includes(country) && (
          <div className="sms-permissions-panel">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="text-sm font-semibold">{copy.setup}</h3><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{copy.setupDescription}</p></div>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label={copy.close} onClick={() => setManageOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            {permissionsQuery.isLoading ? <div className="sms-permission-skeleton"><i /><i /></div> : permissionsQuery.isError ? <div role="alert" className="mt-3 text-xs text-destructive">{copy.loadError}<Button variant="ghost" size="sm" onClick={() => void permissionsQuery.refetch()}>{copy.retry}</Button></div> : users.length === 0 ? <p className="mt-3 text-xs text-muted-foreground">{copy.noAgents}</p> : (
              <div className="mt-3 max-h-64 space-y-2 overflow-auto">
                {users.map(person => {
                  const selected = permissionEdits[person.id] ?? person.providers;
                  const changed = !!permissionEdits[person.id];
                  return <div className="sms-permission-user" key={person.id}>
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0"><p className="truncate text-xs font-semibold">{person.name || person.username}</p><p className="truncate text-[10px] text-muted-foreground">@{person.username} · {copy.assignedCountries}: {person.assignedCountries.join(", ") || "—"}</p></div>
                      <Button type="button" size="sm" variant={changed ? "default" : "outline"} className="h-7 shrink-0 px-2 text-[10px]" disabled={savingUser === person.id} onClick={() => void savePermissions(person)}>{savingUser === person.id ? copy.sending : copy.save}</Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {availableGateways.map(gateway => <button key={gateway} type="button" aria-pressed={selected.includes(gateway)} className="sms-provider-toggle" onClick={() => toggleProvider(person, gateway)}>{selected.includes(gateway) && <Check className="mr-1 inline h-3 w-3" />}{providerLabel(gateway, copy)}</button>)}
                    </div>
                    {permissionSaved === person.id && <p className="mt-1 text-[10px] text-emerald-700">{copy.saved}</p>}
                  </div>;
                })}
              </div>
            )}
            {permissionError && <p role="alert" className="mt-2 text-xs text-destructive">{permissionError}</p>}
          </div>
        )}
        <div className="sms-list-body">
          {!country || access.countries.length === 0 ? <div className="sms-workspace-state"><ShieldAlert className="h-7 w-7" /><p>{copy.noCountry}</p></div>
            : !canReadCountry ? <div className="sms-workspace-state"><ShieldAlert className="h-7 w-7" /><p>{copy.noPermission}</p></div>
            : messagesQuery.isLoading ? <div className="sms-list-skeleton" aria-label={copy.loading} aria-busy="true">{[0, 1, 2, 3, 4].map(row => <div className="sms-skeleton-row" key={row}><i /><div><b /><span /></div></div>)}</div>
            : messagesQuery.isError ? <div className="sms-workspace-state" role="alert"><AlertCircle className="h-7 w-7" /><p>{copy.loadError}</p><Button variant="outline" size="sm" onClick={retryMessages}>{copy.retry}</Button></div>
            : pageMessages.length === 0 ? <div className="sms-workspace-state"><MessageSquare className="h-8 w-8 opacity-50" /><p>{copy.noMessages}</p></div>
            : <ScrollArea className="h-full"><div className="divide-y divide-[var(--signal-line)]">
              {pageMessages.map(message => {
                const inbound = message.direction === "inbound";
                const isUnread = inbound && !message.isRead;
                const name = message.customer ? `${message.customer.firstName} ${message.customer.lastName}` : message.contactName || (inbound ? message.senderPhone : message.recipientPhone) || copy.unknownContact;
                const active = selectedId === message.id;
                const attention = !!message.aiAlertLevel && message.aiAlertLevel !== "none";
                return <button type="button" key={message.id} className={`nexus-signal-task-row sms-message-row ${isUnread ? "is-unread" : "is-read"} ${active ? "is-selected bg-accent" : ""}`} onClick={() => { setSelectedId(message.id); setMobileDetail(true); setReplyText(""); setReplyError(""); setReplySuccess(false); setReadError(false); onClearSelectedMessage?.(); }} aria-current={active ? "true" : undefined} data-testid={`sms-message-${message.id}`}>
                  <div className="flex items-start gap-2.5">
                    <span className={`sms-unread-mark ${isUnread ? "is-unread" : ""}`} />
                    <span className={`sms-direction-icon ${inbound ? "is-inbound" : "is-outbound"}`}>{inbound ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{name}</span><time className="shrink-0 text-[10px] text-muted-foreground">{readableDate(message.sentAt || message.createdAt, locale)}</time></span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{message.content}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1">
                        {inbound && <Badge variant="outline" className={isUnread ? "sms-state-unread" : "sms-state-read"}>{isUnread ? copy.unread : copy.read}</Badge>}
                        <Badge variant="outline" className={`sms-gateway-badge ${message.provider === "bulkgate" ? "sms-gateway-bulkgate" : message.provider === "smstools" ? "sms-gateway-smstools" : "sms-gateway-unknown"}`}>{providerLabel(message.provider, copy)}</Badge>
                        <Badge variant="outline" className={inbound ? "sms-direction-in" : "sms-direction-out"}>{inbound ? copy.inbound : copy.outbound}</Badge>
                        {message.countryCode ? <Badge variant="outline" className="sms-country-badge">{message.countryCode}</Badge> : <Badge variant="outline" className="sms-gateway-unknown">{copy.unassignedCountry}</Badge>}
                        {attention ? <Badge variant="outline" className={message.aiAlertLevel === "critical" ? "sms-ai-critical" : "sms-ai-warning"}>{message.aiAlertLevel === "critical" ? <ShieldAlert className="mr-1 h-3 w-3" /> : <AlertTriangle className="mr-1 h-3 w-3" />}{message.aiHasAngryTone ? copy.angry : message.aiWantsToCancel ? copy.cancellation : message.aiAlertLevel === "critical" ? copy.critical : message.aiAlertLevel === "warning" ? copy.warning : copy.negative}</Badge> : message.aiAnalyzed && (message.aiSentiment === "negative" || message.aiSentiment === "angry" || message.aiHasAngryTone) ? <Badge variant="outline" className="sms-ai-negative"><Flame className="mr-1 h-3 w-3" />{copy.negative}</Badge> : null}
                      </span>
                    </span>
                  </div>
                </button>;
              })}
            </div></ScrollArea>}
        </div>
      </section>

      <section className={`nexus-signal-detail sms-detail ${mobileDetail ? "sms-mobile-open" : ""}`} aria-label={copy.title}>
        {selectedId && detailQuery.isLoading ? <div className="sms-detail-loading" aria-label={copy.loading}><div /><div /><div /><div /></div>
          : selectedId && detailQuery.isError ? <div className="sms-workspace-state" role="alert"><AlertCircle className="h-7 w-7" /><p>{copy.loadError}</p><Button variant="outline" size="sm" onClick={() => void detailQuery.refetch()}>{copy.retryDetail}</Button></div>
          : !detail ? <div className="sms-workspace-state sms-detail-empty"><MessageSquare className="h-10 w-10 opacity-40" /><p className="font-medium">{copy.title}</p><p className="text-sm">{copy.selectMessage}</p></div>
          : <div className="sms-detail-content">
            <header className="sms-detail-header">
              <Button type="button" variant="ghost" size="sm" className="sms-mobile-back mb-2 h-7 px-2 text-xs" onClick={() => setMobileDetail(false)}><ArrowLeft className="mr-1 h-3.5 w-3.5" />{copy.allMessages}</Button>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge className="sms-direction-badge">{detail.direction === "inbound" ? copy.receivedMessage : copy.sentMessage}</Badge>
                    <Badge variant="outline" className={`sms-gateway-badge ${knownProvider ? (detail.provider === "bulkgate" ? "sms-gateway-bulkgate" : "sms-gateway-smstools") : "sms-gateway-unknown"}`}>{providerLabel(detail.provider, copy)}</Badge>
                    <Badge variant="outline" className="sms-country-badge">{detail.countryCode || copy.unassignedCountry}</Badge>
                  </div>
                  <h2 className="mt-2 truncate text-lg font-semibold">{contactName}</h2>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className={detail.direction === "inbound" ? "sms-direction-in" : "sms-direction-out"}>{detail.direction === "inbound" ? copy.received : copy.sent}</Badge>
                  {detail.deliveryStatus && <Badge variant="outline" className="text-xs">{detail.deliveryStatus}</Badge>}
                </div>
              </div>
              <div className="sms-meta-grid">
                <p><span>{detail.direction === "inbound" ? copy.from : copy.to}</span>{detail.direction === "inbound" ? detail.senderPhone || "—" : detail.recipientPhone || "—"}</p>
                <p><span>{copy.status}</span>{detail.status || "—"}</p>
                <p><span>{copy.delivery}</span>{detail.deliveryStatus || "—"}</p>
                <p><span>{copy.source}</span>{providerLabel(detail.provider, copy)}</p>
                <p className="sms-date-meta"><span>{readableDate(detail.sentAt || detail.createdAt, locale)}</span></p>
                {detail.campaignId && <p data-testid="sms-campaign-name"><span>{copy.campaign}</span>{detail.campaignName || copy.unknownCampaign}</p>}
              </div>
              {detail.customer?.id && <Link href={`/customers?view=${encodeURIComponent(detail.customer.id)}`} className="sms-customer-link" data-testid="sms-link-customer-detail"><UserRound className="h-4 w-4 shrink-0" /><span>{copy.linkedCustomer}</span><strong>{detail.customer.firstName} {detail.customer.lastName}</strong></Link>}
              {aiNeedsAttention && <div className={`sms-ai-analysis ${detail.aiAlertLevel === "critical" ? "is-critical" : detail.aiAlertLevel === "warning" ? "is-warning" : "is-negative"}`} data-testid="sms-ai-analysis-alert">
                {detail.aiAlertLevel === "critical" ? <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" /> : detail.aiAlertLevel === "warning" ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> : <Flame className="mt-0.5 h-5 w-5 shrink-0" />}
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><strong>{detail.aiAlertLevel === "critical" ? copy.critical : detail.aiAlertLevel === "warning" ? copy.warning : copy.negative}</strong>
                  {detail.aiHasAngryTone && <Badge variant="outline" className="sms-ai-negative">{copy.angry}</Badge>}
                  {detail.aiHasRudeExpressions && <Badge variant="outline" className="sms-ai-warning">{copy.rude}</Badge>}
                  {detail.aiWantsToCancel && <Badge variant="outline" className="sms-ai-critical">{copy.cancellation}</Badge>}
                  {detail.aiWantsConsent && <Badge variant="outline" className="sms-ai-consent">{copy.consent}</Badge>}
                  {detail.aiDoesNotAcceptContract && <Badge variant="outline" className="sms-ai-critical">{copy.contractRejection}</Badge>}
                </div>{detail.aiAnalysisNote && <p className="mt-1 text-xs text-muted-foreground">{detail.aiAnalysisNote}</p>}</div>
              </div>}
            </header>
            {readError && <div role="alert" className="px-4 py-2 text-xs text-destructive">{copy.readError}<Button type="button" variant="ghost" size="sm" onClick={() => setReadRetry(value => value + 1)}>{copy.retry}</Button></div>}
            <ScrollArea className="sms-message-content">
              <div className={`sms-message-bubble ${detail.direction === "inbound" ? "is-inbound" : "is-outbound"}`}><p>{detail.content}</p></div>
              {detail.replies?.map(reply => <div key={reply.id} className="sms-message-bubble is-outbound ml-auto mt-3" data-testid={`sms-reply-${reply.id}`}>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{reply.status === "sent" ? copy.sentMessage : reply.status}</Badge>
                  <Badge variant="outline">{providerLabel(reply.provider, copy)}</Badge>
                  <span>{readableDate(reply.sentAt || reply.createdAt, locale)}</span>
                </div>
                <p>{reply.content}</p>
              </div>)}
            </ScrollArea>
            {replyPhone && <form className="sms-reply-bar" onSubmit={event => { event.preventDefault(); void submitReply(); }} data-testid="sms-reply-bar">
              <div className="min-w-0 flex-1">
                <Input placeholder={`${copy.replyPlaceholder} ${replyPhone}`} value={replyText} onChange={event => { setReplyText(event.target.value); setReplySuccess(false); }} maxLength={160} disabled={!canReply || sending} aria-label={`${copy.replyPlaceholder} ${replyPhone}`} data-testid="sms-reply-input" />
                <div className="mt-1 flex justify-between gap-2 text-[10px]"><span className="text-muted-foreground">{replyError || (!canReply ? copy.replyUnavailable : replySuccess ? copy.replySent : "")}</span><span className="text-muted-foreground">{replyText.length}/160 {copy.characters}</span></div>
              </div>
              <Button type="submit" size="sm" aria-label={copy.sendReply} disabled={!canReply || !replyText.trim() || sending} data-testid="sms-reply-send">{sending ? <span className="text-xs">{copy.sending}</span> : <Send className="h-4 w-4" />}</Button>
            </form>}
          </div>}
      </section>
    </div>
  );
}
