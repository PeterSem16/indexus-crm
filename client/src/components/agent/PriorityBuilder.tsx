import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, Copy, Pencil, Save, ShieldCheck, Trash2, Users } from "lucide-react";
import { useI18n } from "@/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SavedSearch } from "@shared/schema";
import {
  buildPriorityQueue,
  DEFAULT_PRIORITY_VIEW,
  getPriorityContactName,
  parsePriorityView,
  PRIORITY_BUILDER_MODULE,
  PRIORITY_PRESETS,
  PRIORITY_SEGMENT_IDS,
  filterPriorityContacts,
  type PriorityContact,
  type PrioritySegment,
  type PrioritySegmentId,
  type PrioritySort,
  type PriorityView,
} from "./priority-builder";

interface PriorityBuilderProps {
  contacts: PriorityContact[];
  currentUserId?: string;
  onSelectContact: (contact: PriorityContact) => void;
  className?: string;
}

function savedSearchView(search: SavedSearch): PriorityView | null {
  try {
    return parsePriorityView(JSON.parse(search.filters));
  } catch {
    return null;
  }
}

/**
 * Production queue editor. Saved views use the authenticated saved-search endpoint;
 * no browser storage or client-supplied user identity is involved.
 */
export function PriorityBuilder({
  contacts,
  currentUserId,
  onSelectContact,
  className = "",
}: PriorityBuilderProps) {
  const { t } = useI18n();
  const segmentNames = t.agentWorkspace.priorityBuilderSegmentLabels as Record<PrioritySegmentId, string>;
  const sortLabels = t.agentWorkspace.priorityBuilderSortLabels as Record<PrioritySort, string>;
  const presetLabels: Record<string, string> = {
    referral_first: t.agentWorkspace.priorityBuilderPresetReferral,
    todays_callbacks: t.agentWorkspace.priorityBuilderPresetToday,
    fresh_opportunities: t.agentWorkspace.priorityBuilderPresetFresh,
    recovery_desk: t.agentWorkspace.priorityBuilderPresetRecovery,
  };
  const [selectedId, setSelectedId] = useState("referral");
  const [query, setQuery] = useState("");
  const [searchField, setSearchField] = useState<"all" | "name" | "phone" | "email" | "city">("all");
  const [view, setView] = useState<PriorityView>(DEFAULT_PRIORITY_VIEW);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [activeName, setActiveName] = useState<string>(DEFAULT_PRIORITY_VIEW.presetId!);

  const { data: searches = [] } = useQuery<SavedSearch[]>({
    queryKey: ["/api/saved-searches", PRIORITY_BUILDER_MODULE],
    queryFn: async () => {
      const response = await fetch(`/api/saved-searches?module=${PRIORITY_BUILDER_MODULE}`, { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const usableSearches = useMemo(
    () => searches.map(search => ({ search, view: savedSearchView(search) })).filter(
      (entry): entry is { search: SavedSearch; view: PriorityView } => !!entry.view,
    ),
    [searches],
  );

  useEffect(() => {
    const defaultEntry = usableSearches.find(entry => entry.search.isDefault);
    if (defaultEntry) {
      setSavedId(defaultEntry.search.id);
      setView(defaultEntry.view);
      setActiveName(defaultEntry.view.presetId || defaultEntry.search.id);
    }
  }, [usableSearches]);

  const queue = useMemo(() => buildPriorityQueue(contacts, view, currentUserId), [contacts, currentUserId, view]);
  const filteredQueue = useMemo(() => {
    if (!query.trim()) return queue;
    const matching = new Set(filterPriorityContacts(contacts, query, searchField).map(contact => contact.id));
    const queueEntries = queue.filter(entry => matching.has(entry.contact.id));
    const queued = new Set(queueEntries.map(entry => entry.contact.id));
    return [
      ...queueEntries,
      ...filterPriorityContacts(contacts, query, searchField)
        .filter(contact => !queued.has(contact.id))
        .map(contact => ({ contact, segment: "other" as const })),
    ];
  }, [contacts, queue, query, searchField]);
  const isPreset = !!view.presetId;

  const saveMutation = useMutation({
    mutationFn: async ({ id, next, isDefault }: { id?: string | null; next: PriorityView; isDefault: boolean }) => {
      const payload = { name: next.name, module: PRIORITY_BUILDER_MODULE, filters: JSON.stringify(next), isDefault };
      return id ? apiRequest("PATCH", `/api/saved-searches/${id}`, payload) : apiRequest("POST", "/api/saved-searches", payload);
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/saved-searches", PRIORITY_BUILDER_MODULE] });
      if (!variables.id) {
        const fresh = await fetch(`/api/saved-searches?module=${PRIORITY_BUILDER_MODULE}`, { credentials: "include" });
        if (fresh.ok) {
          const values = await fresh.json() as SavedSearch[];
          const match = values.find(item => item.name === variables.next.name);
          if (match) setSavedId(match.id);
        }
      }
      setActiveName(variables.next.presetId || variables.next.name);
      setSaved(true);
    },
  });

  const activateMutation = useMutation({
    mutationFn: (next: PriorityView) => apiRequest("POST", "/api/saved-searches", {
      name: next.name,
      module: PRIORITY_BUILDER_MODULE,
      filters: JSON.stringify(next),
      isDefault: true,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-searches", PRIORITY_BUILDER_MODULE] });
      setSaved(true);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/saved-searches/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/saved-searches", PRIORITY_BUILDER_MODULE] }),
  });

  const updateSegments = (segments: PrioritySegment[]) => {
    setView(current => ({ ...current, segments }));
    setSaved(false);
  };
  const move = (index: number, direction: -1 | 1) => {
    const next = [...view.segments];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateSegments(next);
  };
  const addSegment = (id: PrioritySegmentId) => {
    if (view.segments.some(segment => segment.id === id)) return;
    updateSegments([...view.segments, { id, sort: "priority" }]);
  };
  const activate = (next: PriorityView, id?: string) => {
    setView(next);
    const persisted = id || usableSearches.find(entry => entry.view.presetId === next.presetId)?.search.id;
    setSavedId(persisted || null);
    setActiveName(next.presetId || persisted || next.name);
    if (persisted) saveMutation.mutate({ id: persisted, next, isDefault: true });
    else activateMutation.mutate(next);
  };

  return (
    <section className={`flex min-h-0 flex-col overflow-hidden rounded-xl border bg-background ${className}`} aria-label={t.agentWorkspace.priorityBuilderTitle}>
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Users className="h-5 w-5 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{t.agentWorkspace.priorityBuilderTitle}</h2>
            <p className="text-xs text-muted-foreground">{t.agentWorkspace.priorityBuilderSubtitle}</p>
          </div>
        </div>
        <select
          className="h-9 max-w-[13rem] rounded-md border bg-background px-2 text-sm"
          value={activeName}
          onChange={event => {
            const preset = PRIORITY_PRESETS.find(item => item.presetId === event.target.value);
            const entry = usableSearches.find(item => item.search.id === event.target.value);
            if (preset) activate(preset);
            else if (entry) activate(entry.view, entry.search.id);
          }}
          aria-label={t.agentWorkspace.priorityBuilderActiveView}
        >
          {PRIORITY_PRESETS.map(preset => <option key={preset.presetId} value={preset.presetId}>{presetLabels[preset.presetId!]}</option>)}
          {usableSearches.filter(entry => !entry.view.presetId)
            .map(entry => <option key={entry.search.id} value={entry.search.id}>{entry.view.name}</option>)}
        </select>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(17rem,.75fr)]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{t.agentWorkspace.priorityBuilderSegments}</h3>
            <select
              className="h-8 rounded-md border bg-background px-2 text-xs"
              value=""
              disabled={isPreset}
              onChange={event => { if (event.target.value) addSegment(event.target.value as PrioritySegmentId); }}
              aria-label={t.agentWorkspace.priorityBuilderAddSegment}
            >
              <option value="">{t.agentWorkspace.priorityBuilderAddSegment}</option>
              {PRIORITY_SEGMENT_IDS.filter(id => !view.segments.some(segment => segment.id === id))
                .map(id => <option key={id} value={id}>{segmentNames[id]}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            {view.segments.map((segment, index) => (
              <article
                key={segment.id}
                onClick={() => setSelectedId(segment.id)}
                className={`rounded-lg border p-3 transition-colors ${selectedId === segment.id ? "border-primary bg-primary/5" : "bg-card"}`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary" aria-label={`${index + 1}`}>
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-semibold">{segmentNames[segment.id]}</h4>
                    <p className="text-[11px] text-muted-foreground">{t.agentWorkspace.priorityBuilderFirstMatch}</p>
                  </div>
                  {index === 0 && <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-label={t.agentWorkspace.priorityBuilderHighestPriority} />}
                  <div className="flex items-center gap-1">
                    <button type="button" className="rounded p-1.5 hover:bg-muted disabled:opacity-40" onClick={event => { event.stopPropagation(); move(index, -1); }} disabled={isPreset || index === 0} aria-label={t.agentWorkspace.priorityBuilderMoveUp}><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" className="rounded p-1.5 hover:bg-muted disabled:opacity-40" onClick={event => { event.stopPropagation(); move(index, 1); }} disabled={isPreset || index === view.segments.length - 1} aria-label={t.agentWorkspace.priorityBuilderMoveDown}><ArrowDown className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 pl-11">
                  <label className="text-[11px] text-muted-foreground" htmlFor={`priority-sort-${segment.id}`}>{t.agentWorkspace.priorityBuilderSortBy}</label>
                  <select disabled={isPreset} id={`priority-sort-${segment.id}`} className="h-7 rounded border bg-background px-2 text-xs" value={segment.sort} onChange={event => updateSegments(view.segments.map(item => item.id === segment.id ? { ...item, sort: event.target.value as PrioritySort } : item))}>
                    {Object.entries(sortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </div>
              </article>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-primary" /> {t.agentWorkspace.priorityBuilderDeduplication}
          </div>
        </div>

        <aside className="min-w-0 rounded-lg border bg-card p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{t.agentWorkspace.priorityBuilderLiveResults}</h3>
            <span className="text-sm font-semibold text-primary">{queue.length}</span>
          </div>
          <div className="mb-2 flex gap-1">
            <select className="h-8 rounded-md border bg-background px-1 text-[11px]" value={searchField} onChange={event => setSearchField(event.target.value as typeof searchField)} aria-label={t.agentWorkspace.fieldPickerAllFields}>
              <option value="all">{t.agentWorkspace.fieldPickerAllFields}</option>
              <option value="name">{t.agentWorkspace.fieldPickerName}</option>
              <option value="phone">{t.agentWorkspace.fieldPickerPhone}</option>
              <option value="email">{t.agentWorkspace.fieldPickerEmail}</option>
              <option value="city">{t.agentWorkspace.fieldPickerCity}</option>
            </select>
            <input className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs" value={query} onChange={event => setQuery(event.target.value)} placeholder={t.agentWorkspace.priorityBuilderSearch} aria-label={t.agentWorkspace.priorityBuilderSearch} />
          </div>
          <div className="max-h-[25rem] space-y-1.5 overflow-auto">
            {filteredQueue.map(({ contact, segment }) => (
              <button type="button" key={contact.id} onClick={() => onSelectContact(contact)} className="flex w-full items-center gap-2 rounded-md border p-2 text-left hover:bg-muted">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{getPriorityContactName(contact).slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{getPriorityContactName(contact)}</span>
                <span className="text-[10px] text-muted-foreground">#{segment === "other" ? "—" : view.segments.findIndex(item => item.id === segment) + 1}</span>
              </button>
            ))}
            {filteredQueue.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">{t.agentWorkspace.priorityBuilderNoResults}</p>}
          </div>
        </aside>
      </div>

      <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t px-4 py-3">
        <input readOnly={isPreset} className="h-9 min-w-[10rem] flex-1 rounded-md border bg-background px-2 text-sm" value={isPreset ? (presetLabels[view.presetId!] || view.name) : view.name} onChange={event => { setView(current => ({ ...current, name: event.target.value })); setSaved(false); }} aria-label={t.agentWorkspace.priorityBuilderViewName} />
        <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50" onClick={() => saveMutation.mutate({ id: savedId, next: view, isDefault: true })} disabled={isPreset || !view.name.trim() || saveMutation.isPending}><Save className="h-3.5 w-3.5" />{t.agentWorkspace.priorityBuilderSave}</button>
        <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs" onClick={() => { setSavedId(null); setView(current => ({ ...current, name: `${isPreset ? (presetLabels[current.presetId!] || current.name) : current.name}${t.agentWorkspace.priorityBuilderDuplicateSuffix}`, presetId: undefined })); setSaved(false); }}><Copy className="h-3.5 w-3.5" />{t.agentWorkspace.priorityBuilderDuplicate}</button>
        {savedId && !view.presetId && <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs text-destructive" onClick={() => { deleteMutation.mutate(savedId); setSavedId(null); setView(DEFAULT_PRIORITY_VIEW); }}><Trash2 className="h-3.5 w-3.5" />{t.agentWorkspace.priorityBuilderDelete}</button>}
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground" role="status">
          {saved ? <><Check className="h-3 w-3 text-primary" />{t.agentWorkspace.priorityBuilderSaved}</> : <><Pencil className="h-3 w-3" />{t.agentWorkspace.priorityBuilderUnsaved}</>}
        </span>
      </footer>
    </section>
  );
}

export default PriorityBuilder;