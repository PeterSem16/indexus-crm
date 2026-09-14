import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, Copy, Pencil, Save, Search, ShieldCheck, Trash2, X } from "lucide-react";
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
  onClose?: () => void;
  className?: string;
}

function savedSearchView(search: SavedSearch): PriorityView | null {
  try {
    return parsePriorityView(JSON.parse(search.filters));
  } catch {
    return null;
  }
}

function formatCallbackTime(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}

/**
 * Production queue editor. Saved views use the authenticated saved-search endpoint;
 * no browser storage or client-supplied user identity is involved.
 */
export function PriorityBuilder({
  contacts,
  currentUserId,
  onSelectContact,
  onClose,
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

  const { data: searches = [], isLoading: searchesLoading } = useQuery<SavedSearch[]>({
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

  const initializedDefaultRef = useRef(false);
  useEffect(() => {
    if (searchesLoading || initializedDefaultRef.current) return;
    const defaultEntry = usableSearches.find(entry => entry.search.isDefault);
    if (defaultEntry) {
      setSavedId(defaultEntry.search.id);
      setView(defaultEntry.view);
      setSelectedId(defaultEntry.view.segments[0]?.id || "");
      setActiveName(defaultEntry.view.presetId || defaultEntry.search.id);
    }
    initializedDefaultRef.current = true;
  }, [searchesLoading, usableSearches]);

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
      let persistedId = variables.id;
      if (!variables.id) {
        const fresh = await fetch(`/api/saved-searches?module=${PRIORITY_BUILDER_MODULE}`, { credentials: "include" });
        if (fresh.ok) {
          const values = await fresh.json() as SavedSearch[];
          const match = values.find(item => item.name === variables.next.name);
          if (match) {
            persistedId = match.id;
            setSavedId(match.id);
          }
        }
      }
      setActiveName(variables.next.presetId || persistedId || "__draft__");
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
    setSelectedId(next.segments[0]?.id || "");
    const persisted = id || usableSearches.find(entry => entry.view.presetId === next.presetId)?.search.id;
    setSavedId(persisted || null);
    setActiveName(next.presetId || persisted || next.name);
    if (persisted) saveMutation.mutate({ id: persisted, next, isDefault: true });
    else activateMutation.mutate(next);
  };

  return (
    <section className={`flex min-h-0 flex-col overflow-hidden rounded-xl border bg-background ${className}`} aria-label={t.agentWorkspace.priorityBuilderSegments}>
      <style>{`
        .priority-builder-shell{width:100%;height:100%;min-width:0;min-height:500px;display:flex;flex:1 1 auto;flex-direction:column;overflow:hidden;background:#fff;color:#292522;font-family:"Open Sans",sans-serif}
        .priority-builder-head{height:58px;min-height:58px;display:flex;flex:none;align-items:center;justify-content:space-between;gap:12px;padding:0 16px;border-bottom:1px solid #e8e4e0}
        .priority-builder-title{font-size:13px;font-weight:800;letter-spacing:-.01em}
        .priority-builder-head-actions{display:flex;align-items:center;gap:12px}
        .priority-builder-add{height:30px;min-width:130px;border:1px solid #e1ddd8;border-radius:6px;background:#fbfaf9;color:#7c746e;font:inherit;font-size:11px;padding:0 9px;outline-color:#bd4f58}
        .priority-builder-close{border:0;background:transparent;color:#827a74;cursor:pointer;padding:4px}
        .priority-builder-close:hover{color:#292522}
        .priority-builder-content{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(270px,.8fr);min-height:0;flex:1 1 auto;overflow:hidden}
        .priority-builder-groups{padding:12px 14px 8px;overflow:auto}
        .priority-builder-results{border-left:1px solid #ece8e4;background:#fbfaf9;padding:12px 11px;overflow:auto}
        .priority-builder-group{border:1px solid #e6e2de;border-radius:8px;background:#fff;margin-bottom:7px;padding:10px 11px 8px;cursor:pointer}
        .priority-builder-group:hover{border-color:#d6b3b4}
        .priority-builder-group.selected{border-color:#d56269;box-shadow:0 0 0 1px #d5626940;background:#fffafa}
        .priority-builder-row{display:flex;align-items:center;gap:8px}
        .priority-builder-number{width:27px;height:27px;border-radius:50%;background:#fae4e4;color:#bf4e57;display:grid;place-items:center;font-size:11px;font-weight:800;flex:none}
        .priority-builder-group-title{font-size:12px;font-weight:800;flex:1}
        .priority-builder-group-detail{font-size:10px;color:#99908a;margin-top:2px}
        .priority-builder-group-actions{display:flex;align-items:center;gap:4px;color:#a69c95}
        .priority-builder-mini{border:0;background:transparent;border-radius:4px;padding:3px;color:inherit;cursor:pointer}
        .priority-builder-mini:hover:not(:disabled){background:#f5eeee;color:#bd4f58}
        .priority-builder-mini:disabled{opacity:.28;cursor:default}
        .priority-builder-sort{display:flex;align-items:center;gap:8px;margin:8px 0 0 35px;font-size:10px;color:#958b84}
        .priority-builder-sort select{height:25px;border:1px solid #e1dcd7;border-radius:5px;background:#fff;color:#766d66;font:inherit;font-size:10px;padding:0 8px;min-width:144px}
        .priority-builder-note{height:27px;min-height:27px;display:flex;flex:none;align-items:center;gap:6px;background:#f6f5f4;color:#8b837d;border-radius:5px;font-size:10px;padding:0 9px;margin:9px 0}
        .priority-builder-results-head{display:flex;align-items:center;justify-content:space-between;margin:0 1px 8px}
        .priority-builder-results-head h3{font-size:13px;margin:0}
        .priority-builder-total{font-size:12px;color:#c4535b;font-weight:800}
        .priority-builder-results-tools{display:flex;gap:5px;margin-bottom:7px}
        .priority-builder-results-tools select,.priority-builder-search{height:29px;border:1px solid #e4ded8;border-radius:5px;background:#fff;color:#706963;font:inherit;font-size:10px;padding:0 7px}
        .priority-builder-search{flex:1;display:flex;align-items:center;gap:5px}
        .priority-builder-search input{border:0;outline:0;width:100%;font:inherit;color:#4e4742;background:transparent}
        .priority-builder-contact{width:100%;height:37px;min-height:37px;display:flex;flex:none;align-items:center;gap:8px;border:1px solid #ebe5e0;background:#fff;border-radius:5px;padding:5px 8px;margin:5px 0;text-align:left}
        .priority-builder-avatar{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#f8e3e4;color:#c1545c;font-size:10px;font-weight:800;flex:none}
        .priority-builder-contact-name{font-size:10px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
        .priority-builder-contact-meta{font-size:9px;color:#9a918b;white-space:nowrap}
        .priority-builder-contact-index{font-size:10px;color:#766b65}
        .priority-builder-footer{height:53px;min-height:53px;display:flex;flex:none;align-items:center;gap:7px;border-top:1px solid #e8e3de;padding:0 14px}
        .priority-builder-footer input{height:32px;border:1px solid #447bd0;border-radius:5px;padding:0 8px;font:inherit;font-size:11px;flex:1;outline:0;box-shadow:0 0 0 1px #c6daf7;min-width:100px}
        .priority-builder-footer button{height:32px;border:1px solid #e3ddd8;border-radius:5px;background:#fff;color:#716963;padding:0 10px;display:inline-flex;align-items:center;gap:5px;font:inherit;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap}
        .priority-builder-footer button:hover{background:#faf5f3}
        .priority-builder-footer .priority-builder-save{background:#dd858b;border-color:#dd858b;color:#fff}
        .priority-builder-footer .priority-builder-save:hover{background:#ce6e76}
        .priority-builder-footer .priority-builder-delete{color:#b54f57}
        .priority-builder-status{font-size:10px;color:#958b84;white-space:nowrap;display:inline-flex;align-items:center;gap:3px}
        .priority-builder-status.saved{color:#478c82}
        @media(max-width:680px){.priority-builder-shell{min-height:0}.priority-builder-content{grid-template-columns:1fr}.priority-builder-results{display:none}.priority-builder-footer{flex-wrap:wrap;height:auto;padding:9px}.priority-builder-footer input{min-width:150px}.priority-builder-status{width:100%}}
      `}</style>
      <section className="priority-builder-shell">
        <div className="priority-builder-head" role="banner">
          <strong className="priority-builder-title">{t.agentWorkspace.priorityBuilderSegments}</strong>
          <div className="priority-builder-head-actions">
            <select
              className="priority-builder-add"
              value=""
              onChange={event => { if (event.target.value) addSegment(event.target.value as PrioritySegmentId); }}
              aria-label={t.agentWorkspace.priorityBuilderAddSegment}
            >
              <option value="">{t.agentWorkspace.priorityBuilderAddSegment}</option>
              {PRIORITY_SEGMENT_IDS.filter(id => !view.segments.some(segment => segment.id === id))
                .map(id => <option key={id} value={id}>{segmentNames[id]}</option>)}
            </select>
            {onClose && <button type="button" className="priority-builder-close" onClick={onClose} aria-label={t.common.close}><X size={16} /></button>}
          </div>
        </div>
        <div className="priority-builder-content">
          <section className="priority-builder-groups">
            {view.segments.map((segment, index) => (
              <article
                key={segment.id}
                onClick={() => setSelectedId(segment.id)}
                onKeyDown={event => { if (event.key === "Enter" || event.key === " ") setSelectedId(segment.id); }}
                className={`priority-builder-group ${selectedId === segment.id ? "selected" : ""}`}
                tabIndex={0}
                role="button"
                aria-pressed={selectedId === segment.id}
              >
                <div className="priority-builder-row">
                  <span className="priority-builder-number" aria-label={`${index + 1}`}>{index + 1}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="priority-builder-group-title">{segmentNames[segment.id]}{index === 0 && <ShieldCheck size={13} color="#c4525b" style={{ verticalAlign: "-2px", marginLeft: 5 }} aria-label={t.agentWorkspace.priorityBuilderHighestPriority} />}</div>
                    <div className="priority-builder-group-detail">{t.agentWorkspace.priorityBuilderFirstMatch}</div>
                  </div>
                  <div className="priority-builder-group-actions">
                    <button type="button" className="priority-builder-mini" onClick={event => { event.stopPropagation(); move(index, -1); }} disabled={index === 0} aria-label={t.agentWorkspace.priorityBuilderMoveUp}><ArrowUp size={14} /></button>
                    <button type="button" className="priority-builder-mini" onClick={event => { event.stopPropagation(); move(index, 1); }} disabled={index === view.segments.length - 1} aria-label={t.agentWorkspace.priorityBuilderMoveDown}><ArrowDown size={14} /></button>
                  </div>
                </div>
                <div className="priority-builder-sort">
                  <label htmlFor={`priority-sort-${segment.id}`}>{t.agentWorkspace.priorityBuilderSortBy}</label>
                  <select id={`priority-sort-${segment.id}`} value={segment.sort} onChange={event => updateSegments(view.segments.map(item => item.id === segment.id ? { ...item, sort: event.target.value as PrioritySort } : item))} onClick={event => event.stopPropagation()}>
                    {Object.entries(sortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </div>
              </article>
            ))}
            <div className="priority-builder-note"><Check size={13} color="#c4545d" /> {t.agentWorkspace.priorityBuilderDeduplication}</div>
          </section>
          <aside className="priority-builder-results">
            <div className="priority-builder-results-head"><h3>{t.agentWorkspace.priorityBuilderLiveResults}</h3><span className="priority-builder-total">{queue.length}</span></div>
            <div className="priority-builder-results-tools">
              <select aria-label={t.agentWorkspace.fieldPickerAllFields} value={searchField} onChange={event => setSearchField(event.target.value as typeof searchField)}>
                <option value="all">{t.agentWorkspace.fieldPickerAllFields}</option>
                <option value="name">{t.agentWorkspace.fieldPickerName}</option>
                <option value="phone">{t.agentWorkspace.fieldPickerPhone}</option>
                <option value="email">{t.agentWorkspace.fieldPickerEmail}</option>
                <option value="city">{t.agentWorkspace.fieldPickerCity}</option>
              </select>
              <label className="priority-builder-search"><Search size={12} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t.agentWorkspace.priorityBuilderSearch} aria-label={t.agentWorkspace.priorityBuilderSearch} /></label>
            </div>
            <div>
              {filteredQueue.map(({ contact, segment }) => {
                const callbackTime = formatCallbackTime(contact.callbackDate);
                return <button type="button" key={contact.id} onClick={() => onSelectContact(contact)} className="priority-builder-contact">
                  <span className="priority-builder-avatar">{getPriorityContactName(contact).slice(0, 1).toUpperCase()}</span>
                  <span className="priority-builder-contact-name">{getPriorityContactName(contact)}</span>
                  <span className="priority-builder-contact-meta">{segment === "other" ? t.agentWorkspace.priorityBuilderOther : segmentNames[segment]}{callbackTime ? ` · ${callbackTime}` : ""}</span>
                  <span className="priority-builder-contact-index">#{segment === "other" ? "—" : view.segments.findIndex(item => item.id === segment) + 1}</span>
                </button>;
              })}
              {filteredQueue.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">{t.agentWorkspace.priorityBuilderNoResults}</p>}
            </div>
          </aside>
        </div>
        <footer className="priority-builder-footer">
          <select
            className="priority-builder-add"
            style={{ minWidth: 145 }}
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
            {activeName === "__draft__" && <option value="__draft__">{view.name}</option>}
            {activeName !== "__draft__"
              && !PRIORITY_PRESETS.some(preset => preset.presetId === activeName)
              && !usableSearches.some(entry => entry.search.id === activeName)
              && !isPreset
              && <option value={activeName}>{view.name}</option>}
          </select>
          <input readOnly={isPreset} value={isPreset ? (presetLabels[view.presetId!] || view.name) : view.name} onChange={event => { setView(current => ({ ...current, name: event.target.value })); setSaved(false); }} aria-label={t.agentWorkspace.priorityBuilderViewName} />
          <button type="button" className="priority-builder-save" onClick={() => saveMutation.mutate({ id: savedId, next: view, isDefault: true })} disabled={isPreset || !view.name.trim() || saveMutation.isPending}><Save size={13} />{t.agentWorkspace.priorityBuilderSave}</button>
          <button type="button" onClick={() => { setSavedId(null); setActiveName("__draft__"); setView(current => ({ ...current, name: `${isPreset ? (presetLabels[current.presetId!] || current.name) : current.name}${t.agentWorkspace.priorityBuilderDuplicateSuffix}`, presetId: undefined })); setSaved(false); }}><Copy size={13} />{t.agentWorkspace.priorityBuilderDuplicate}</button>
          {savedId && !view.presetId && <button type="button" className="priority-builder-delete" onClick={() => { deleteMutation.mutate(savedId); setSavedId(null); setActiveName(PRIORITY_PRESETS[0].presetId!); setView(DEFAULT_PRIORITY_VIEW); }}><Trash2 size={13} />{t.agentWorkspace.priorityBuilderDelete}</button>}
          <span className={`priority-builder-status ${saved ? "saved" : ""}`} role="status">
            {saved ? <><Check size={12} />{t.agentWorkspace.priorityBuilderSaved}</> : <><Pencil size={12} />{t.agentWorkspace.priorityBuilderUnsaved}</>}
          </span>
        </footer>
      </section>
    </section>
  );
}

export default PriorityBuilder;