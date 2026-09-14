import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowDown, ArrowUp, CalendarClock, Check, ChevronDown, ChevronRight, Copy, GripVertical,
  Layers3, ListFilter, ListOrdered, MoreHorizontal, Pencil, PhoneCall, RotateCcw, Save,
  MapPin, Search, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, Users, X,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SavedSearch } from "@shared/schema";
import {
  buildPriorityQueue,
  buildPriorityQueueWithFallback,
  DEFAULT_PRIORITY_VIEW,
  filterPriorityContactsByCity,
  filterPriorityContacts,
  getPriorityContactCityLocation,
  getPriorityCitySelectionMode,
  getPriorityContactName,
  isPriorityReferral,
  matchesPrioritySegment,
  parsePriorityView,
  PRIORITY_BUILDER_MODULE,
  PRIORITY_PRESETS,
  PRIORITY_SEGMENT_IDS,
  PRIORITY_UNKNOWN_CITY_KEY,
  type PriorityCitySelectionMode,
  type PriorityContact,
  type PriorityQueueItem,
  type PriorityQueueSegmentId,
  type PrioritySegment,
  type PrioritySegmentId,
  type PrioritySort,
  type PriorityView,
} from "./priority-builder";
import { priorityBuilderCopy } from "./priority-builder-copy";
import "./priority-builder.css";

/** Shared by the production dialog and the responsive browser fixture. */
export const PRIORITY_BUILDER_DIALOG_CLASS_NAME = "priority-builder-dialog";

interface PriorityBuilderProps {
  /** Already eligibility-filtered contacts. The parent remains the authoritative queue owner. */
  contacts: PriorityContact[];
  currentUserId?: string;
  onSelectContact: (contact: PriorityContact) => void;
  onClose?: () => void;
  onNextContact?: () => void;
  onToggleAutoMode?: () => void;
  isAutoMode?: boolean;
  className?: string;
}
type PriorityWrite = {
  kind: "save";
  id?: string | null;
  next: PriorityView;
  isDefault: boolean;
  /** Use the idempotent first-run lifecycle instead of ordinary user save. */
  initial?: boolean;
} | { kind: "delete"; id: string };

const segmentVisuals: Record<PrioritySegmentId, { icon: string; color: string }> = {
  referral: { icon: "R", color: "#7860b8" },
  scheduled_today: { icon: "T", color: "#b5622e" },
  due: { icon: "D", color: "#b5622e" },
  new: { icon: "N", color: "#337e7b" },
  my_scheduled: { icon: "M", color: "#4c6d96" },
  team_scheduled: { icon: "T", color: "#2e75b6" },
  assigned_others: { icon: "A", color: "#7a6858" },
  unhandled: { icon: "U", color: "#a16e47" },
  never_called: { icon: "N", color: "#5a7a5a" },
  recently_contacted: { icon: "R", color: "#5a7a5a" },
  stale: { icon: "S", color: "#8b6f47" },
};

function savedSearchView(search: SavedSearch): PriorityView | null {
  try {
    return parsePriorityView(JSON.parse(search.filters));
  } catch {
    return null;
  }
}

function formatCallbackDateTime(value: unknown, locale: string): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Bratislava",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatAttemptSummary(
  value: unknown,
  copy: { callAttempts: string; noAttempts: string; unknownAttempts: string },
): string {
  const count = typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  if (count === null) return `${copy.callAttempts}: ${copy.unknownAttempts}`;
  return `${copy.callAttempts}: ${count === 0 ? copy.noAttempts : count}`;
}

function eligibleCityKeys(contacts: PriorityContact[]): string[] {
  return Array.from(new Set(
    contacts
      .map(contact => getPriorityContactCityLocation(contact)?.key)
      .filter((key): key is string => Boolean(key)),
  ));
}

function snapshotCityGrouping(view: PriorityView, contacts: PriorityContact[]): PriorityView {
  if (!view.cityGrouping?.enabled) return view;
  const eligible = new Set(eligibleCityKeys(contacts));
  const known = new Set(view.cityGrouping.rankedKeys.filter(key => eligible.has(key)));
  const unknown = new Set(view.cityGrouping.unknownKeys.filter(key => eligible.has(key) && !known.has(key)));
  return {
    ...view,
    cityGrouping: {
      enabled: true,
      rankedKeys: Array.from(known),
      unknownKeys: Array.from(unknown),
      mode: getPriorityCitySelectionMode(view.cityGrouping),
      selectedKeys: Array.from(new Set(view.cityGrouping.selectedKeys || [])),
    },
  };
}

function eligibleCityOptions(contacts: PriorityContact[]): Array<{ key: string; city: string; countryCode: string }> {
  const locations = new Map<string, { key: string; city: string; countryCode: string }>();
  let hasUnknown = false;
  for (const contact of contacts) {
    const location = getPriorityContactCityLocation(contact);
    if (location) locations.set(location.key, location);
    else hasUnknown = true;
  }
  const result = Array.from(locations.values()).sort((a, b) =>
    `${a.city} ${a.countryCode}`.localeCompare(`${b.city} ${b.countryCode}`, undefined, { sensitivity: "base" }),
  );
  if (hasUnknown) result.push({ key: PRIORITY_UNKNOWN_CITY_KEY, city: "", countryCode: "" });
  return result;
}

async function rankEligibleCities(contacts: PriorityContact[], signal: AbortSignal | undefined, tooManyMessage: string, failedMessage: string): Promise<{ rankedKeys: string[]; unknownKeys: string[] }> {
  const cities = Array.from(new Map(
    contacts
      .map(contact => getPriorityContactCityLocation(contact))
      .filter((location): location is NonNullable<typeof location> => Boolean(location))
      .map(location => [location.key, { key: location.key, city: location.city, countryCode: location.countryCode }]),
  ).values());
  if (cities.length > 500) {
    throw new Error(tooManyMessage);
  }
  const response = await fetch("/api/agent/priority-builder/city-ranking", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({ cities }),
  });
  let body: any = null;
  try { body = await response.json(); } catch { /* explicit status below */ }
  if (!response.ok) {
    throw new Error(body?.error || body?.message || failedMessage);
  }
  if (!Array.isArray(body?.rankedKeys) || !Array.isArray(body?.unknownKeys)) throw new Error(failedMessage);
  const rankedKeys: string[] = body.rankedKeys.filter((key: unknown): key is string => typeof key === "string");
  const returnedUnknown: string[] = body.unknownKeys.filter((key: unknown): key is string => typeof key === "string");
  const submitted = new Set(cities.map(city => city.key));
  const rankedSet = new Set<string>(rankedKeys);
  const unknownSet = new Set<string>(returnedUnknown);
  if (rankedSet.size !== rankedKeys.length
    || unknownSet.size !== returnedUnknown.length
    || rankedKeys.some(key => unknownSet.has(key))
    || rankedKeys.length + returnedUnknown.length !== submitted.size
    || [...Array.from(rankedSet), ...Array.from(unknownSet)].some(key => !submitted.has(key))) {
    throw new Error(failedMessage);
  }
  // Never turn an omitted model result into a guessed "unknown" bucket.
  return { rankedKeys, unknownKeys: returnedUnknown };
}

/** Production personal contact ordering editor; data and call actions remain parent-owned. */
export function PriorityBuilder({
  contacts,
  currentUserId,
  onSelectContact,
  onClose,
  onNextContact,
  onToggleAutoMode,
  isAutoMode = false,
  className = "",
}: PriorityBuilderProps) {
  const { t, locale } = useI18n();
  const copy = priorityBuilderCopy[locale];
  const segmentNames = {
    ...(t.agentWorkspace.priorityBuilderSegmentLabels as Record<PrioritySegmentId, string>),
    referral: copy.newReferrals,
  } as Record<PrioritySegmentId, string>;
  const sortLabels = t.agentWorkspace.priorityBuilderSortLabels as Record<PrioritySort, string>;
  const presetLabels: Record<string, string> = {
    referral_cities: copy.referralCitiesPreset,
    referral_first: t.agentWorkspace.priorityBuilderPresetReferral,
    todays_callbacks: t.agentWorkspace.priorityBuilderPresetToday,
    fresh_opportunities: t.agentWorkspace.priorityBuilderPresetFresh,
    recovery_desk: t.agentWorkspace.priorityBuilderPresetRecovery,
  };
  const [selectedId, setSelectedId] = useState(DEFAULT_PRIORITY_VIEW.segments[0].id);
  const [query, setQuery] = useState("");
  const [searchField, setSearchField] = useState<"all" | "name" | "phone" | "email" | "city">("all");
  const [view, setView] = useState<PriorityView>(DEFAULT_PRIORITY_VIEW);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [activeName, setActiveName] = useState<string>(DEFAULT_PRIORITY_VIEW.presetId!);
  const [savedViewsOpen, setSavedViewsOpen] = useState(true);
  const [menuSegmentId, setMenuSegmentId] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const hydratedRef = useRef(false);
  const userSelectedRef = useRef(false);
  const writeInFlightRef = useRef(false);
  const lastWriteRef = useRef<PriorityWrite | null>(null);
  const [persistencePending, setPersistencePending] = useState(false);
  const [persistenceFailed, setPersistenceFailed] = useState(false);
  const [cityRankingPending, setCityRankingPending] = useState(false);
  const [cityRankingError, setCityRankingError] = useState<string | null>(null);
  const cityRankingRequestRef = useRef(0);
  const cityRankingAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const [collapsedPreviewCities, setCollapsedPreviewCities] = useState<Set<string>>(new Set());

  const { data: searches = [], isLoading: searchesLoading, isError: searchesError, refetch: refetchSearches } = useQuery<SavedSearch[]>({
    queryKey: ["/api/saved-searches", PRIORITY_BUILDER_MODULE],
    queryFn: async () => {
      const response = await fetch(`/api/saved-searches?module=${PRIORITY_BUILDER_MODULE}`, { credentials: "include" });
      if (!response.ok) throw new Error(`Unable to load saved priority views (${response.status})`);
      return response.json();
    },
  });
  const usableSearches = useMemo(
    () => searches.map(search => ({ search, view: savedSearchView(search) })).filter(
      (entry): entry is { search: SavedSearch; view: PriorityView } => entry.view !== null,
    ),
    [searches],
  );

  useEffect(() => () => {
    mountedRef.current = false;
    cityRankingRequestRef.current += 1;
    cityRankingAbortRef.current?.abort();
  }, []);

  const viewSignature = useMemo(() => JSON.stringify(view), [view]);
  const contactsSignature = useMemo(() => JSON.stringify(eligibleCityKeys(contacts).sort()), [contacts]);
  const cityRankingScopeRef = useRef<{ view: string; contacts: string } | null>(null);
  useEffect(() => {
    if (!cityRankingPending) return;
    if (cityRankingScopeRef.current?.view === viewSignature
      && cityRankingScopeRef.current.contacts === contactsSignature) return;
    cityRankingRequestRef.current += 1;
    cityRankingAbortRef.current?.abort();
    cityRankingAbortRef.current = null;
    setCityRankingPending(false);
  }, [viewSignature, contactsSignature]);

  // A late saved-search response must never replace a preset/draft the agent selected.
  useEffect(() => {
    if (searchesLoading || searchesError || (hydratedRef.current && !usableSearches.some(entry => entry.search.isDefault))) return;
    const defaultEntry = usableSearches.find(entry => entry.search.isDefault);
    if (defaultEntry && !userSelectedRef.current) {
      setView(defaultEntry.view);
      setSavedId(defaultEntry.search.id);
      setSelectedId(defaultEntry.view.segments[0]?.id || "");
      setActiveName(defaultEntry.view.presetId || defaultEntry.search.id);
      setSaved(true);
    } else if (!defaultEntry && usableSearches[0] && !userSelectedRef.current) {
      // Legacy data can contain saved rows with no active/default row. Keep
      // that data usable and let the agent choose from it; do not seed over
      // the retained personal views.
      const fallbackEntry = usableSearches[0];
      setView(fallbackEntry.view);
      setSavedId(fallbackEntry.search.id);
      setSelectedId(fallbackEntry.view.segments[0]?.id || "");
      setActiveName(fallbackEntry.view.presetId || fallbackEntry.search.id);
      setSaved(true);
    }
    // Keep first-run city views locked until the workspace's idempotent
    // seeding request publishes an active persisted snapshot. With no eligible
    // city there is nothing to rank yet, so the empty-mission editor may still
    // be inspected without claiming queue authority.
    const waitingForInitialSeed = !defaultEntry && usableSearches.length === 0
      && !userSelectedRef.current && eligibleCityKeys(contacts).length > 0;
    hydratedRef.current = !waitingForInitialSeed;
    if (!defaultEntry && !userSelectedRef.current) {
      setSaved(!waitingForInitialSeed && (usableSearches.length > 0 || searches.length === 0));
    }
  }, [contacts, searches, searchesError, searchesLoading, usableSearches]);

  const effectiveView = useMemo(() => snapshotCityGrouping(view, contacts), [contacts, view]);
  const cityOptions = useMemo(() => eligibleCityOptions(contacts), [contacts]);
  const cityGroupingMode: PriorityCitySelectionMode = getPriorityCitySelectionMode(view.cityGrouping);
  const selectedCityKeys = useMemo(
    () => new Set(view.cityGrouping?.selectedKeys || []),
    [view.cityGrouping?.selectedKeys],
  );
  const queue = useMemo(
    () => buildPriorityQueue(contacts, effectiveView, currentUserId),
    [contacts, currentUserId, effectiveView],
  );
  const previewQueue = useMemo(
    () => buildPriorityQueueWithFallback(contacts, effectiveView, currentUserId),
    [contacts, currentUserId, effectiveView],
  );
  const segmentCounts = useMemo(() => {
    const counts = new Map<PrioritySegmentId, number>();
    queue.forEach(item => counts.set(item.segment, (counts.get(item.segment) || 0) + 1));
    return counts;
  }, [queue]);
  const overlapCount = useMemo(
    () => filterPriorityContactsByCity(contacts, view).filter(
      contact => view.segments.filter(segment => matchesPrioritySegment(contact, segment.id, currentUserId)).length > 1,
    ).length,
    [contacts, currentUserId, view],
  );
  const filteredQueue = useMemo(() => {
    if (!query.trim()) return previewQueue;
    const matching = new Set(filterPriorityContacts(contacts, query, searchField).map(contact => contact.id));
    return previewQueue.filter(item => matching.has(item.contact.id));
  }, [contacts, previewQueue, query, searchField]);
  const queuePositions = useMemo(
    () => new Map(previewQueue.map((item, index) => [item.contact.id, index + 1])),
    [previewQueue],
  );
  const isPreset = !!view.presetId;

  const requestCityRanking = async (
    baseView: PriorityView = view,
    persistResult = false,
    persistedId?: string,
    initial = false,
  ) => {
    const requestId = ++cityRankingRequestRef.current;
    cityRankingScopeRef.current = { view: JSON.stringify(baseView), contacts: contactsSignature };
    cityRankingAbortRef.current?.abort();
    const abortController = new AbortController();
    cityRankingAbortRef.current = abortController;
    setCityRankingPending(true);
    setCityRankingError(null);
    try {
      const result = await rankEligibleCities(contacts, abortController.signal, copy.cityRankingTooMany, copy.cityRankingError);
      if (!mountedRef.current || requestId !== cityRankingRequestRef.current) return;
      setCityRankingPending(false);
      userSelectedRef.current = true;
      const rankedView: PriorityView = {
        ...baseView,
        // Referral + cities is a protected built-in whose saved form includes
        // a per-mission AI snapshot. Other drafts become ordinary personal
        // views once their city order is explicitly requested.
        presetId: baseView.presetId === "referral_cities" ? "referral_cities" : undefined,
        cityGrouping: {
          enabled: true,
          rankedKeys: result.rankedKeys,
          unknownKeys: result.unknownKeys,
          mode: getPriorityCitySelectionMode(baseView.cityGrouping),
          selectedKeys: Array.from(new Set(baseView.cityGrouping?.selectedKeys || [])),
        },
      };
      setView(rankedView);
      if (baseView.presetId && baseView.presetId !== "referral_cities") {
        setSavedId(null);
        setActiveName("__draft__");
      }
      setSaved(false);
      if (persistResult) {
        const command: PriorityWrite = {
          kind: "save",
          id: persistedId || null,
          next: rankedView,
          isDefault: true,
          initial,
        };
        writeInFlightRef.current = true;
        lastWriteRef.current = command;
        setPersistencePending(true);
        setPersistenceFailed(false);
        writeMutation.mutate(command);
      }
    } catch (error) {
      if (!mountedRef.current || requestId !== cityRankingRequestRef.current) return;
      setCityRankingError(error instanceof Error ? error.message : String(error));
    } finally {
      if (cityRankingAbortRef.current === abortController) cityRankingAbortRef.current = null;
      if (mountedRef.current && requestId === cityRankingRequestRef.current) setCityRankingPending(false);
    }
  };
  const toggleCityGrouping = () => {
    if (searchesLoading || searchesError || persistencePending) return;
    if (cityRankingError && !view.cityGrouping?.enabled) {
      cityRankingRequestRef.current += 1;
      cityRankingAbortRef.current?.abort();
      cityRankingAbortRef.current = null;
      setCityRankingPending(false);
      setCityRankingError(null);
      return;
    }
    if (view.cityGrouping?.enabled) {
      cityRankingRequestRef.current += 1;
      cityRankingAbortRef.current?.abort();
      cityRankingAbortRef.current = null;
      userSelectedRef.current = true;
      setView(current => ({ ...current, presetId: undefined, cityGrouping: undefined }));
      setSavedId(null);
      setActiveName("__draft__");
      setSaved(false);
      setCityRankingPending(false);
      setCityRankingError(null);
      return;
    }
    if (cityRankingPending) {
      cityRankingRequestRef.current += 1;
      cityRankingAbortRef.current?.abort();
      cityRankingAbortRef.current = null;
      setCityRankingPending(false);
      setCityRankingError(null);
      return;
    }
    void requestCityRanking();
  };

  const updateCitySelection = (next: { mode: PriorityCitySelectionMode; selectedKeys: string[] }) => {
    if (!view.cityGrouping?.enabled || searchesLoading || searchesError || persistencePending || cityRankingPending) return;
    userSelectedRef.current = true;
    const wasPreset = !!view.presetId;
    setView(current => ({
      ...current,
      name: wasPreset
        ? `${presetLabels[current.presetId!] || current.name}${t.agentWorkspace.priorityBuilderDuplicateSuffix}`
        : current.name,
      presetId: undefined,
      cityGrouping: {
        enabled: true,
        rankedKeys: current.cityGrouping?.rankedKeys || [],
        unknownKeys: current.cityGrouping?.unknownKeys || [],
        mode: next.mode,
        selectedKeys: Array.from(new Set(next.selectedKeys)),
      },
    }));
    if (wasPreset) {
      setSavedId(null);
      setActiveName("__draft__");
    }
    setSaved(false);
  };

  const writeMutation = useMutation({
    mutationFn: async (command: PriorityWrite) => {
      if (command.kind === "delete") {
        await apiRequest("DELETE", `/api/saved-searches/${command.id}`);
        return { kind: "delete" as const };
      }
      const payload = {
        name: command.next.name,
        module: PRIORITY_BUILDER_MODULE,
        filters: JSON.stringify(command.next),
        isDefault: command.isDefault,
        ...(command.initial && command.id ? { existingId: command.id } : {}),
      };
      const response = await apiRequest(
        command.initial ? "POST" : (command.id ? "PATCH" : "POST"),
        command.initial
          ? "/api/saved-searches/priority-builder/initial"
          : (command.id ? `/api/saved-searches/${command.id}` : "/api/saved-searches"),
        payload,
      );
      const persisted = response.status === 204
        ? { id: command.id || "", filters: JSON.stringify(command.next) }
        : await response.json() as Pick<SavedSearch, "id" | "filters">;
      if (!persisted?.id) throw new Error("Saved view response did not include an id");
      const persistedView = typeof persisted.filters === "string"
        ? parsePriorityView(JSON.parse(persisted.filters))
        : null;
      return {
        kind: "save" as const,
        persistedId: persisted.id,
        next: persistedView || command.next,
        initial: !!command.initial,
      };
    },
    onSuccess: async (result) => {
      try {
        await queryClient.invalidateQueries({ queryKey: ["/api/saved-searches", PRIORITY_BUILDER_MODULE] });
        if (result.kind === "delete") {
          setView(DEFAULT_PRIORITY_VIEW);
          setSavedId(null);
          setSelectedId(DEFAULT_PRIORITY_VIEW.segments[0].id);
          setActiveName(DEFAULT_PRIORITY_VIEW.presetId!);
        } else {
          setSavedId(result.persistedId);
          setActiveName(result.next.presetId || result.persistedId);
          if (result.initial) {
            setView(result.next);
            setSelectedId(result.next.segments[0]?.id || "");
          }
        }
        setSaved(true);
        setPersistenceFailed(false);
      } catch {
        setSaved(false);
        setPersistenceFailed(true);
      }
    },
    onError: () => {
      setSaved(false);
      setPersistenceFailed(true);
    },
    onSettled: () => {
      writeInFlightRef.current = false;
      setPersistencePending(false);
    },
  });
  // The production workspace also performs this seed so Auto/Next are never
  // enabled on a draft. Keeping the idempotent request here covers a builder
  // opened before that parent effect completes, without creating duplicates.
  useEffect(() => {
    if (searchesLoading || searchesError || persistencePending || cityRankingPending || cityRankingError) return;
    if (searches.length > 0 || usableSearches.some(entry => entry.search.isDefault)) return;
    if (eligibleCityKeys(contacts).length === 0 || userSelectedRef.current) return;
    void requestCityRanking(DEFAULT_PRIORITY_VIEW, true, undefined, true);
  }, [
    cityRankingError,
    cityRankingPending,
    contactsSignature,
    persistencePending,
    searches,
    searchesError,
    searchesLoading,
    usableSearches,
  ]);
  const persist = (command: PriorityWrite) => {
    if (writeInFlightRef.current) return false;
    if (cityRankingPending || cityRankingError) return false;
    const nextCommand = command.kind === "save"
      ? { ...command, next: snapshotCityGrouping(command.next, contacts) }
      : command;
    writeInFlightRef.current = true;
    lastWriteRef.current = nextCommand;
    setPersistencePending(true);
    setPersistenceFailed(false);
    setSaved(false);
    writeMutation.mutate(nextCommand);
    return true;
  };
  const initialSeedPending = !searchesLoading
    && !searchesError
    && (
      (searches.length === 0
        && !usableSearches.some(entry => entry.search.isDefault)
        && !userSelectedRef.current
        && eligibleCityKeys(contacts).length > 0)
      || (searches.length > 0 && usableSearches.length === 0)
    );
  const actionsLocked = searchesLoading || searchesError || initialSeedPending || !saved || persistencePending || cityRankingPending || !!cityRankingError;
  const viewControlsDisabled = searchesLoading || searchesError || initialSeedPending || persistencePending || cityRankingPending || !!cityRankingError;

  const makeDraft = (segments: PrioritySegment[]) => {
    if (writeInFlightRef.current) return;
    userSelectedRef.current = true;
    if (view.presetId) {
      setSavedId(null);
      setActiveName("__draft__");
      setView(current => ({
        ...current,
        name: `${presetLabels[current.presetId!] || current.name}${t.agentWorkspace.priorityBuilderDuplicateSuffix}`,
        presetId: undefined,
        segments,
      }));
    } else {
      setView(current => ({ ...current, segments }));
    }
    setSaved(false);
  };
  const move = (index: number, direction: -1 | 1) => {
    const segments = [...view.segments];
    const next = index + direction;
    if (next < 0 || next >= segments.length) return;
    [segments[index], segments[next]] = [segments[next], segments[index]];
    makeDraft(segments);
  };
  const addSegment = (id: PrioritySegmentId) => {
    if (view.segments.some(segment => segment.id === id)) return;
    makeDraft([...view.segments, { id, sort: "priority", referralsFirst: true }]);
  };
  const removeSegment = (id: PrioritySegmentId) => {
    if (view.segments.length <= 1) return;
    const segments = view.segments.filter(segment => segment.id !== id);
    makeDraft(segments);
    setSelectedId(segments[0]?.id || "");
    setMenuSegmentId(null);
  };
  const activate = (next: PriorityView, id?: string) => {
    if (viewControlsDisabled || writeInFlightRef.current) return;
    userSelectedRef.current = true;
    setView(next);
    setSaved(false);
    setSavedId(id || usableSearches.find(entry => entry.view.presetId === next.presetId)?.search.id || null);
    setSelectedId(next.segments[0]?.id || "");
    setActiveName(next.presetId || id || next.name);
    setMenuSegmentId(null);
    const persistedId = id || usableSearches.find(entry => entry.view.presetId === next.presetId)?.search.id;
    if (next.presetId === "referral_cities"
      && (next.cityGrouping?.rankedKeys.length || 0) === 0
      && eligibleCityKeys(contacts).length > 0) {
      // Explicit selection may reactivate an inactive preset. The initial
      // snapshot endpoint intentionally only updates an already-active view.
      void requestCityRanking(next, true, persistedId);
      return;
    }
    persist({ kind: "save", id: persistedId, next, isDefault: true });
  };
  const reset = () => {
    if (viewControlsDisabled || writeInFlightRef.current) return;
    userSelectedRef.current = true;
    const persistedId = usableSearches.find(entry => entry.view.presetId === DEFAULT_PRIORITY_VIEW.presetId)?.search.id;
    setView(DEFAULT_PRIORITY_VIEW);
    setSavedId(persistedId || null);
    setSelectedId(DEFAULT_PRIORITY_VIEW.segments[0].id);
    setActiveName(DEFAULT_PRIORITY_VIEW.presetId!);
    if (eligibleCityKeys(contacts).length > 0) {
      void requestCityRanking(DEFAULT_PRIORITY_VIEW, true, persistedId);
      return;
    }
    persist({ kind: "save", id: persistedId, next: DEFAULT_PRIORITY_VIEW, isDefault: true });
  };
  const duplicate = () => {
    if (viewControlsDisabled || writeInFlightRef.current) return;
    userSelectedRef.current = true;
    setSavedId(null);
    setActiveName("__draft__");
    setView(current => ({ ...current, name: `${isPreset ? presetLabels[current.presetId!] : current.name}${t.agentWorkspace.priorityBuilderDuplicateSuffix}`, presetId: undefined }));
    setSaved(false);
  };
  const retryLastWrite = () => {
    if (lastWriteRef.current) persist(lastWriteRef.current);
  };
  const whyCopy = view.segments.length > 1
    ? `${segmentNames[view.segments[0].id]} ${copy.whyOne} ${segmentNames[view.segments[1].id]}, ${copy.whyMany}`
    : `${segmentNames[view.segments[0]?.id]} ${copy.whyMany}`;
  const previewSegmentGroups = useMemo(() => {
    if (!view.cityGrouping?.enabled) return [];
    const segments = new Map<PriorityQueueSegmentId, typeof filteredQueue>();
    for (const item of filteredQueue) {
      segments.set(item.segment, [...(segments.get(item.segment) || []), item]);
    }
    return Array.from(segments.entries()).map(([segment, items]) => {
      const cities = new Map<string, typeof filteredQueue>();
      for (const item of items) {
        const key = item.cityGroup?.key || "__unknown__";
        cities.set(key, [...(cities.get(key) || []), item]);
      }
      return {
        segment,
        label: segment === "other" ? copy.otherGroup : segmentNames[segment as PrioritySegmentId],
        items,
        cityGroups: Array.from(cities.entries()).map(([key, cityItems]) => {
          const city = cityItems[0]?.cityGroup;
          return {
            key: `${segment}:${key}`,
            label: city?.city
              ? `${city.city}${city.countryCode ? copy.cityCountrySeparator + city.countryCode : ""}`
              : copy.unknownCity,
            items: cityItems,
          };
        }),
      };
    });
  }, [copy.cityCountrySeparator, copy.otherGroup, copy.unknownCity, filteredQueue, segmentNames, view.cityGrouping?.enabled]);
  const renderPreviewCard = ({ contact, segment, cityGroup }: PriorityQueueItem) => {
    const name = getPriorityContactName(contact);
    const callbackDateTime = formatCallbackDateTime(contact.callbackDate, locale);
    const queuePosition = queuePositions.get(contact.id) || 0;
    const groupName = segment === "other" ? copy.otherGroup : segmentNames[segment];
    const attemptSummary = formatAttemptSummary(contact.attemptCount, copy);
    return <button type="button" className="priority-builder-card" key={contact.id} onClick={() => onSelectContact(contact)}>
      <span className="priority-builder-card-row"><span className="priority-builder-avatar">{name.slice(0, 1).toUpperCase()}</span><strong className="priority-builder-card-name">{name}</strong></span>
      <span className="priority-builder-card-chips">
        <span className="priority-builder-card-chip priority-builder-card-chip-position"><span className="priority-builder-card-chip-icon"><ListOrdered size={11} /></span>{queuePosition === 1 ? `${copy.nextUp} — ` : ""}{copy.queuePosition} {queuePosition}</span>
        <span className="priority-builder-card-chip priority-builder-card-chip-group"><span className="priority-builder-card-chip-icon"><Layers3 size={11} /></span>{copy.group}: {groupName}</span>
        {isPriorityReferral(contact) && <span className="priority-builder-card-chip priority-builder-card-chip-referral">{copy.referralBadge}</span>}
        {view.cityGrouping?.enabled && <span className="priority-builder-card-chip priority-builder-card-chip-city"><span className="priority-builder-card-chip-icon"><MapPin size={11} /></span>{cityGroup?.city || copy.unknownCity}{cityGroup?.countryCode ? `${copy.cityCountrySeparator}${cityGroup.countryCode}` : ""}</span>}
        <span className="priority-builder-card-chip priority-builder-card-chip-callback"><span className="priority-builder-card-chip-icon"><CalendarClock size={11} /></span>{copy.scheduledCallback}: {callbackDateTime || copy.notScheduled}</span>
        <span className="priority-builder-card-chip priority-builder-card-chip-attempts"><span className="priority-builder-card-chip-icon"><PhoneCall size={11} /></span>{attemptSummary}</span>
      </span>
    </button>;
  };

  return (
    <section className={`priority-builder ${className}`} aria-label={t.agentWorkspace.priorityBuilderTitle}>
      <aside className="priority-builder-sidebar">
        <div className="priority-builder-brand">INDEXUS</div>
        <div className="priority-builder-side-label">{t.agentWorkspace.contacts}</div>
        <div className="priority-builder-side-item active">
          <Users size={14} />{t.agentWorkspace.contacts}<span className="priority-builder-side-count">{previewQueue.length}</span>
        </div>
        <div className="priority-builder-side-group">
          <div className="priority-builder-side-item active"><ListFilter size={12} />{isPreset ? presetLabels[view.presetId!] : view.name}</div>
          <button type="button" className="priority-builder-side-item" onClick={onToggleAutoMode} disabled={!onToggleAutoMode || actionsLocked} title={actionsLocked ? copy.queueSyncHint : undefined}><PhoneCall size={12} />{copy.auto}<span className="priority-builder-side-count">{isAutoMode ? copy.autoOn : copy.autoOff}</span></button>
          <button type="button" className="priority-builder-side-item" onClick={onNextContact} disabled={!onNextContact || actionsLocked} title={actionsLocked ? copy.queueSyncHint : undefined}><ChevronRight size={12} />{copy.nextContact}</button>
          {actionsLocked && <p className="priority-builder-queue-hint">{copy.queueSyncHint}</p>}
        </div>
        <button type="button" className="priority-builder-side-item" onClick={() => setSavedViewsOpen(open => !open)} aria-expanded={savedViewsOpen}>
          <ChevronDown size={13} style={{ transform: savedViewsOpen ? undefined : "rotate(-90deg)" }} />{copy.savedViews}
        </button>
        {savedViewsOpen && <div className="priority-builder-side-group">
          {PRIORITY_PRESETS.map(preset => (
            <button key={preset.presetId} type="button" disabled={viewControlsDisabled} className={`priority-builder-side-item ${activeName === preset.presetId ? "active" : ""}`} onClick={() => activate(preset)}>
              {preset.presetId === "referral_first" ? <ShieldCheck size={12} /> : <Sparkles size={12} />}{presetLabels[preset.presetId!]}
            </button>
          ))}
          {usableSearches.filter(entry => !entry.view.presetId).map(entry => (
            <button key={entry.search.id} type="button" disabled={viewControlsDisabled} className={`priority-builder-side-item ${activeName === entry.search.id ? "active" : ""}`} onClick={() => activate(entry.view, entry.search.id)}>
              <ListFilter size={12} />{entry.view.name}
            </button>
          ))}
        </div>}
        <div className="priority-builder-sidebar-foot">{copy.personalView}</div>
      </aside>

      <div className="priority-builder-main">
        <div className="priority-builder-top" role="banner">
          <div className="priority-builder-top-icon"><SlidersHorizontal size={18} /></div>
          <div style={{ flex: 1, minWidth: 0 }}><div className="priority-builder-kicker">{copy.contactsSavedView}</div><h1 className="priority-builder-title">{t.agentWorkspace.priorityBuilderTitle}</h1></div>
          {onClose && <button type="button" className="priority-builder-button" onClick={onClose} aria-label={copy.close}><X size={15} /></button>}
        </div>
        <div className="priority-builder-toolbar">
          <label className="priority-builder-search"><Search size={14} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t.agentWorkspace.priorityBuilderSearch} aria-label={t.agentWorkspace.priorityBuilderSearch} /></label>
          <select className="priority-builder-select" disabled={viewControlsDisabled} aria-label={copy.fieldAll} value={searchField} onChange={event => setSearchField(event.target.value as typeof searchField)}>
            <option value="all">{copy.fieldAll}</option>
            <option value="name">{t.agentWorkspace.fieldPickerName}</option>
            <option value="phone">{t.agentWorkspace.fieldPickerPhone}</option>
            <option value="email">{t.agentWorkspace.fieldPickerEmail}</option>
            <option value="city">{t.agentWorkspace.fieldPickerCity}</option>
          </select>
          <button type="button" className="priority-builder-button" disabled={viewControlsDisabled} onClick={reset}><RotateCcw size={14} />{copy.reset}</button>
          <label className="priority-builder-city-toggle">
            <input
              type="checkbox"
              data-testid="toggle-priority-city-grouping"
              checked={!!view.cityGrouping?.enabled || cityRankingPending || !!cityRankingError}
              onChange={toggleCityGrouping}
              disabled={searchesLoading || !!searchesError || persistencePending}
            />
            <span>{copy.groupByCity}</span>
          </label>
          {view.cityGrouping?.enabled && (
            <div className="priority-builder-city-selection" data-testid="priority-city-selection">
              <div className="priority-builder-city-modes" role="radiogroup" aria-label={copy.groupByCity}>
                <label>
                  <input
                    type="radio"
                    name="priority-city-mode"
                    data-testid="priority-city-mode-all"
                    checked={cityGroupingMode === "all"}
                    onChange={() => updateCitySelection({ mode: "all", selectedKeys: Array.from(selectedCityKeys) })}
                    disabled={searchesLoading || !!searchesError || persistencePending || cityRankingPending}
                  />
                  <span>{copy.allCities}</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="priority-city-mode"
                    data-testid="priority-city-mode-selected"
                    checked={cityGroupingMode === "selected"}
                    onChange={() => updateCitySelection({ mode: "selected", selectedKeys: Array.from(selectedCityKeys) })}
                    disabled={searchesLoading || !!searchesError || persistencePending || cityRankingPending}
                  />
                  <span>{copy.onlySelectedCities}</span>
                </label>
              </div>
              {cityGroupingMode === "selected" && (
                <div className="priority-builder-city-options" data-testid="priority-city-options">
                  {cityOptions.map(option => {
                    const isUnknown = option.key === PRIORITY_UNKNOWN_CITY_KEY;
                    const label = isUnknown
                      ? copy.unknownCity
                      : `${option.city}${option.countryCode ? copy.cityCountrySeparator + option.countryCode : ""}`;
                    return (
                      <label key={option.key} className="priority-builder-city-option">
                        <input
                          type="checkbox"
                          data-testid={`priority-city-option-${option.key}`}
                          checked={selectedCityKeys.has(option.key)}
                          onChange={() => {
                            const next = new Set(selectedCityKeys);
                            if (next.has(option.key)) next.delete(option.key); else next.add(option.key);
                            updateCitySelection({ mode: "selected", selectedKeys: Array.from(next) });
                          }}
                          disabled={searchesLoading || !!searchesError || persistencePending || cityRankingPending}
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                  {cityOptions.length === 0 && <span className="priority-builder-city-empty">{copy.noSelectedCities}</span>}
                  {cityOptions.length > 0 && selectedCityKeys.size === 0 && (
                    <span className="priority-builder-city-empty">{copy.noSelectedCities}</span>
                  )}
                  <span className="priority-builder-city-hint">{copy.citySelectionHint}</span>
                </div>
              )}
            </div>
          )}
          {view.cityGrouping?.enabled && (
            <button
              type="button"
              className="priority-builder-button"
              data-testid="btn-priority-city-rerank"
              disabled={cityRankingPending || persistencePending || searchesLoading || !!searchesError}
              onClick={() => void requestCityRanking(
                view,
                view.presetId === "referral_cities",
                savedId || undefined,
                searches.length === 0,
              )}
            >
              <RotateCcw size={14} />{copy.cityRankingRefresh}
            </button>
          )}
        </div>
        <div className="priority-builder-city-status" role="status" data-testid="priority-city-status">
          {cityRankingPending
            ? <span>{copy.cityRankingPending}</span>
            : cityRankingError
              ? <span role="alert">{copy.cityRankingError} {cityRankingError} <button type="button" data-testid="btn-priority-city-retry" onClick={() => void requestCityRanking(
                view,
                view.presetId === "referral_cities",
                savedId || undefined,
                searches.length === 0,
              )}>{copy.cityRankingRetry}</button></span>
              : view.cityGrouping?.enabled
                ? <span>{copy.cityRankingReady} · {copy.cityRankingEstimated}: {eligibleCityKeys(contacts).length} {copy.cityRankingLocations}</span>
                : <span>{copy.groupByCityHint}</span>}
        </div>
        {(searchesError || persistenceFailed) && <div className="priority-builder-persistence-error" role="alert">
          <span>{searchesError ? copy.loadError : copy.saveError}</span>
          <button type="button" className="priority-builder-button" onClick={() => searchesError ? refetchSearches() : retryLastWrite()}>{copy.retry}</button>
        </div>}
        <div className="priority-builder-mobile-controls">
          <select className="priority-builder-select" aria-label={t.agentWorkspace.priorityBuilderActiveView} value={activeName} disabled={viewControlsDisabled} onChange={event => {
            const preset = PRIORITY_PRESETS.find(item => item.presetId === event.target.value);
            const entry = usableSearches.find(item => item.search.id === event.target.value);
            if (preset) activate(preset);
            else if (entry) activate(entry.view, entry.search.id);
          }}>
            {PRIORITY_PRESETS.map(preset => <option key={preset.presetId} value={preset.presetId}>{presetLabels[preset.presetId!]}</option>)}
            {usableSearches.filter(entry => !entry.view.presetId).map(entry => <option key={entry.search.id} value={entry.search.id}>{entry.view.name}</option>)}
            {activeName === "__draft__" && <option value="__draft__">{view.name}</option>}
          </select>
          <button type="button" className="priority-builder-button" disabled={!onToggleAutoMode || actionsLocked} onClick={onToggleAutoMode} title={actionsLocked ? copy.queueSyncHint : undefined}><PhoneCall size={14} />{copy.auto}</button>
          <button type="button" className="priority-builder-button" disabled={!onNextContact || actionsLocked} onClick={onNextContact} title={actionsLocked ? copy.queueSyncHint : undefined}><ChevronRight size={14} />{copy.nextContact}</button>
          {actionsLocked && <p className="priority-builder-queue-hint">{copy.queueSyncHint}</p>}
        </div>
        <div className="priority-builder-body">
          <section className="priority-builder-editor">
            <div className="priority-builder-section-head"><div><h2>{copy.evaluationOrder}</h2><p>{copy.evaluationHint}</p></div><span className="priority-builder-total">{previewQueue.length} {copy.eligibleContacts}</span></div>
            {view.segments.map((segment, index) => {
              const visual = segmentVisuals[segment.id];
              return <article key={segment.id} className={`priority-builder-row ${selectedId === segment.id ? "selected" : ""}`} onClick={() => setSelectedId(segment.id)} role="button" tabIndex={0} aria-label={`${segmentNames[segment.id]}, ${index + 1}`}>
                <GripVertical size={15} className="priority-builder-drag" />
                <span className="priority-builder-number">{index + 1}</span>
                <span className="priority-builder-dot" style={{ background: visual.color }}>{visual.icon}</span>
                <div style={{ minWidth: 0 }}><div className="priority-builder-row-name">{segmentNames[segment.id]}{index === 0 && <ShieldCheck size={12} color="#b5622e" aria-label={t.agentWorkspace.priorityBuilderHighestPriority} />}</div><div className="priority-builder-detail">{t.agentWorkspace.priorityBuilderFirstMatch}</div></div>
                <span className="priority-builder-count">{segmentCounts.get(segment.id) || 0}</span>
                <div className="priority-builder-actions" onClick={event => event.stopPropagation()}>
                  <span className="priority-builder-actions-label">{t.agentWorkspace.priorityBuilderSortBy}</span>
                  <select className="priority-builder-sort" disabled={viewControlsDisabled} value={segment.sort} onChange={event => makeDraft(view.segments.map(item => item.id === segment.id ? { ...item, sort: event.target.value as PrioritySort } : item))} aria-label={`${t.agentWorkspace.priorityBuilderSortBy} ${segmentNames[segment.id]}`}>
                    {Object.entries(sortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                   <label className="priority-builder-referral-toggle" title={copy.referralsFirst}>
                     <input
                       type="checkbox"
                       checked={segment.referralsFirst !== false}
                       disabled={viewControlsDisabled}
                       onChange={event => makeDraft(view.segments.map(item => item.id === segment.id ? { ...item, referralsFirst: event.target.checked } : item))}
                       aria-label={`${copy.referralsFirst}: ${segmentNames[segment.id]}`}
                     />
                     <span>{copy.referralsFirst}</span>
                   </label>
                  <span style={{ marginLeft: "auto", display: "flex" }}>
                    <button type="button" className="priority-builder-mini" onClick={() => move(index, -1)} disabled={viewControlsDisabled || index === 0} aria-label={t.agentWorkspace.priorityBuilderMoveUp}><ArrowUp size={14} /></button>
                    <button type="button" className="priority-builder-mini" onClick={() => move(index, 1)} disabled={viewControlsDisabled || index === view.segments.length - 1} aria-label={t.agentWorkspace.priorityBuilderMoveDown}><ArrowDown size={14} /></button>
                    <button type="button" className="priority-builder-mini" disabled={viewControlsDisabled} onClick={() => setMenuSegmentId(menuSegmentId === segment.id ? null : segment.id)} aria-label={copy.moreActions}><MoreHorizontal size={14} /></button>
                  </span>
                </div>
                {menuSegmentId === segment.id && <div className="priority-builder-menu"><button type="button" onClick={() => removeSegment(segment.id)} disabled={viewControlsDisabled || view.segments.length <= 1}>{copy.removeSegment}</button></div>}
              </article>;
            })}
            <select className="priority-builder-add" disabled={viewControlsDisabled} value="" onChange={event => { if (event.target.value) addSegment(event.target.value as PrioritySegmentId); }} aria-label={t.agentWorkspace.priorityBuilderAddSegment}>
              <option value="">{`+ ${t.agentWorkspace.priorityBuilderAddSegment}`}</option>
              {PRIORITY_SEGMENT_IDS.filter(id => !view.segments.some(segment => segment.id === id)).map(id => <option key={id} value={id}>{segmentNames[id]}</option>)}
            </select>
            <div className="priority-builder-detail" style={{ display: "flex", alignItems: "center", gap: 5, margin: "12px 2px" }}><GripVertical size={13} />{copy.dragHint}</div>
          </section>
          <aside className="priority-builder-preview">
            <div className="priority-builder-preview-head"><div><h2>{copy.liveResult}</h2><p>{copy.workNext}</p></div><strong style={{ color: "#b5622e", fontSize: 16 }}>{previewQueue.length}</strong></div>
            <div className="priority-builder-impact"><Check size={15} /><span><strong>{copy.dedupActive}</strong><br />{overlapCount} {copy.dedupDetail}</span></div>
            {view.cityGrouping?.enabled
              ? previewSegmentGroups.map(segment => <div key={segment.segment} className="priority-builder-preview-segment-group">
                <div className="priority-builder-preview-segment-heading"><Layers3 size={12} />{segment.label}<strong>({segment.items.length})</strong></div>
                {segment.cityGroups.map(group => {
                  const expanded = !collapsedPreviewCities.has(group.key);
                  return <div key={group.key} className="priority-builder-preview-city-group">
                    <button type="button" className="priority-builder-preview-city-toggle" onClick={() => setCollapsedPreviewCities(previous => {
                      const next = new Set(previous);
                      if (next.has(group.key)) next.delete(group.key); else next.add(group.key);
                      return next;
                    })} aria-expanded={expanded}>
                      <span><MapPin size={12} />{group.label} <strong>({group.items.length})</strong></span>
                      {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                    {expanded && group.items.map(renderPreviewCard)}
                  </div>;
                })}
              </div>)
              : filteredQueue.map(renderPreviewCard)}
            {filteredQueue.length === 0 && <p className="priority-builder-detail" style={{ textAlign: "center", padding: "24px 0" }}>{t.agentWorkspace.priorityBuilderNoResults}</p>}
            <div className="priority-builder-rule"><div className="priority-builder-rule-top"><Check size={14} color="#337e7b" /><strong>{copy.whyThisOrder}</strong></div><div className="priority-builder-rule-copy">{whyCopy}</div></div>
          </aside>
        </div>
        <footer className="priority-builder-save">
          <input ref={nameInputRef} readOnly={isPreset || viewControlsDisabled} value={isPreset ? presetLabels[view.presetId!] : view.name} onChange={event => { userSelectedRef.current = true; setView(current => ({ ...current, name: event.target.value })); setSaved(false); }} aria-label={t.agentWorkspace.priorityBuilderViewName} />
          <button type="button" className="priority-builder-button primary" onClick={() => persist({ kind: "save", id: savedId, next: view, isDefault: true })} disabled={(isPreset && view.presetId !== "referral_cities") || !view.name.trim() || viewControlsDisabled}><Save size={14} />{t.agentWorkspace.priorityBuilderSave}</button>
          <button type="button" className="priority-builder-button" disabled={viewControlsDisabled} onClick={duplicate}><Copy size={14} />{t.agentWorkspace.priorityBuilderDuplicate}</button>
          <button type="button" className="priority-builder-button" onClick={() => nameInputRef.current?.focus()} disabled={isPreset || viewControlsDisabled} aria-label={copy.renameView}><Pencil size={14} /></button>
          {savedId && !isPreset && <button type="button" className="priority-builder-button" onClick={() => persist({ kind: "delete", id: savedId })} disabled={viewControlsDisabled}><Trash2 size={14} />{t.agentWorkspace.priorityBuilderDelete}</button>}
          <span className={`priority-builder-status ${saved ? "" : "unsaved"}`} role="status">{saved ? <><Check size={12} />{t.agentWorkspace.priorityBuilderSaved}</> : <><Pencil size={12} />{t.agentWorkspace.priorityBuilderUnsaved}</>}</span>
        </footer>
      </div>
    </section>
  );
}

export default PriorityBuilder;