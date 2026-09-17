import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown, ArrowUp, CalendarClock, Check, ChevronDown, ChevronRight, Copy,
  GripVertical, Layers3, ListFilter, ListOrdered, MapPin, MoreHorizontal,
  Pencil, PhoneCall, RotateCcw, Save, Search, ShieldCheck, SlidersHorizontal,
  Sparkles, Trash2, Users, X,
} from "lucide-react";
import {
  buildPriorityQueueWithFallback, DEFAULT_PRIORITY_VIEW, filterPriorityContacts,
  getPriorityContactCityLocation, getPriorityContactName, isPriorityReferral,
  matchesPrioritySegment, PRIORITY_PRESETS, PRIORITY_SEGMENT_IDS,
  PRIORITY_UNKNOWN_CITY_KEY, type PriorityCitySelectionMode, type PriorityContact,
  type PriorityQueueItem, type PrioritySegmentId, type PrioritySort, type PriorityView,
} from "./_priority-builder";
import { priorityBuilderCopy as copy } from "./_priority-builder-copy";
import { prioritySearchContacts } from "./_fixtures";
import "./_group.css";

export const PRIORITY_BUILDER_DIALOG_CLASS_NAME = "priority-builder-dialog";

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

const sortLabels = copy.sortLabels as Record<PrioritySort, string>;
const segmentNames = copy.groupLabels as Record<PrioritySegmentId, string>;
const presetLabels = copy.presetLabels;

function formatCallbackDateTime(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("sk-SK", {
    timeZone: "Europe/Bratislava", year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  }).format(date);
}

function formatAttemptSummary(value: unknown): string {
  const count = typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  if (count === null) return `${copy.callAttempts}: ${copy.unknownAttempts}`;
  return `${copy.callAttempts}: ${count === 0 ? copy.noAttempts : count}`;
}

function eligibleCityOptions(contacts: PriorityContact[]) {
  const locations = new Map<string, { key: string; city: string; countryCode: string }>();
  let hasUnknown = false;
  contacts.forEach(contact => {
    const location = getPriorityContactCityLocation(contact);
    if (location && location.key) locations.set(location.key, {
      key: location.key, city: location.city || "", countryCode: location.countryCode || "",
    });
    else hasUnknown = true;
  });
  const result = Array.from(locations.values()).sort((a, b) =>
    `${a.city} ${a.countryCode}`.localeCompare(`${b.city} ${b.countryCode}`));
  if (hasUnknown) result.push({ key: PRIORITY_UNKNOWN_CITY_KEY, city: "", countryCode: "" });
  return result;
}

function snapshotCityGrouping(view: PriorityView, contacts: PriorityContact[]): PriorityView {
  if (!view.cityGrouping?.enabled) return view;
  const eligible = new Set(eligibleCityOptions(contacts).map(option => option.key));
  return {
    ...view,
    cityGrouping: {
      ...view.cityGrouping,
      rankedKeys: view.cityGrouping.rankedKeys.filter(key => eligible.has(key)),
      unknownKeys: view.cityGrouping.unknownKeys.filter(key => eligible.has(key)),
    },
  };
}

export function Current({ renderIdentity, showSearchCount = false }: {
  renderIdentity?: (contact: PriorityContact, query: string, field: "all" | "name" | "phone" | "email" | "city") => ReactNode;
  showSearchCount?: boolean;
} = {}) {
  const [contacts] = useState<PriorityContact[]>(prioritySearchContacts);
  const [selectedId, setSelectedId] = useState<PrioritySegmentId>("referral");
  const [query, setQuery] = useState("seman");
  const [searchField, setSearchField] = useState<"all" | "name" | "phone" | "email" | "city">("all");
  const [view, setView] = useState<PriorityView>(DEFAULT_PRIORITY_VIEW);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [activeName, setActiveName] = useState<string>(DEFAULT_PRIORITY_VIEW.presetId!);
  const [savedViewsOpen, setSavedViewsOpen] = useState(true);
  const [menuSegmentId, setMenuSegmentId] = useState<PrioritySegmentId | null>(null);
  const [collapsedPreviewCities, setCollapsedPreviewCities] = useState<Set<string>>(new Set());
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

  const effectiveView = useMemo(() => snapshotCityGrouping(view, contacts), [contacts, view]);
  const cityOptions = useMemo(() => eligibleCityOptions(contacts), [contacts]);
  const cityGroupingMode: PriorityCitySelectionMode = view.cityGrouping?.mode === "selected" ? "selected" : "all";
  const selectedCityKeys = useMemo(() => new Set(view.cityGrouping?.selectedKeys || []), [view.cityGrouping?.selectedKeys]);
  const previewQueue = useMemo(
    () => buildPriorityQueueWithFallback(contacts, effectiveView, "demo-agent"),
    [contacts, effectiveView],
  );
  const queue = useMemo(
    () => previewQueue.filter(item => item.segment !== "other"),
    [previewQueue],
  );
  const segmentCounts = useMemo(() => {
    const counts = new Map<PrioritySegmentId, number>();
    queue.forEach(item => {
      if (item.segment !== "other") counts.set(item.segment, (counts.get(item.segment) || 0) + 1);
    });
    return counts;
  }, [queue]);
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
  const overlapCount = useMemo(
    () => contacts.filter(contact =>
      view.segments.filter(segment => matchesPrioritySegment(contact, segment.id, "demo-agent")).length > 1).length,
    [contacts, view.segments],
  );
  const [savedViews, setSavedViews] = useState<PriorityView[]>([
    ...PRIORITY_PRESETS.filter(preset => preset.presetId !== "referral_cities"),
    { version: 1, name: "Trnavský follow-up", segments: [{ id: "new", sort: "created_desc", referralsFirst: true }] },
  ]);

  const activate = (next: PriorityView, id?: string) => {
    setView(next);
    setSavedId(id || null);
    setSelectedId(next.segments[0]?.id || "referral");
    setActiveName(next.presetId || id || next.name);
    setSaved(true);
    setMenuSegmentId(null);
    setDemoNotice("Zobrazenie bolo zmenené iba v lokálnom deme.");
  };
  const makeDraft = (segments: PriorityView["segments"]) => {
    setView(current => ({ ...current, presetId: undefined, segments }));
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
    if (!view.segments.some(segment => segment.id === id)) {
      makeDraft([...view.segments, { id, sort: "priority", referralsFirst: true }]);
    }
  };
  const removeSegment = (id: PrioritySegmentId) => {
    if (view.segments.length <= 1) return;
    const next = view.segments.filter(segment => segment.id !== id);
    makeDraft(next);
    setSelectedId(next[0]?.id || "referral");
    setMenuSegmentId(null);
  };
  const saveView = () => {
    setSaved(true);
    setDemoNotice("Uložené iba v lokálnom deme — žiadne API volanie.");
  };
  const duplicate = () => {
    const duplicateView = { ...view, name: `${view.name} – kópia`, presetId: undefined };
    setView(duplicateView);
    setSavedId(null);
    setActiveName("__draft__");
    setSaved(false);
  };
  const toggleCityGrouping = () => {
    setView(current => ({
      ...current,
      presetId: undefined,
      cityGrouping: current.cityGrouping?.enabled
        ? undefined
        : { enabled: true, rankedKeys: cityOptions.map(option => option.key), unknownKeys: [], mode: "all", selectedKeys: [] },
    }));
    setSaved(false);
  };
  const updateCitySelection = (next: { mode: PriorityCitySelectionMode; selectedKeys: string[] }) => {
    setView(current => ({
      ...current,
      presetId: undefined,
      cityGrouping: {
        enabled: true,
        rankedKeys: current.cityGrouping?.rankedKeys || [],
        unknownKeys: current.cityGrouping?.unknownKeys || [],
        mode: next.mode,
        selectedKeys: Array.from(new Set(next.selectedKeys)),
      },
    }));
    setSaved(false);
  };
  const refreshCityRanking = () => {
    setView(current => ({
      ...current,
      cityGrouping: current.cityGrouping
        ? { ...current.cityGrouping, rankedKeys: cityOptions.map(option => option.key) }
        : current.cityGrouping,
    }));
    setDemoNotice("Poradie miest bolo obnovené lokálne.");
  };
  const renderPreviewCard = ({ contact, segment, cityGroup }: PriorityQueueItem) => {
    const name = getPriorityContactName(contact);
    const callbackDateTime = formatCallbackDateTime(contact.callbackDate);
    const queuePosition = queuePositions.get(contact.id) || 0;
    const groupName = segment === "other" ? copy.otherGroup : segmentNames[segment];
    return (
      <button type="button" className="priority-builder-card" key={contact.id}
        onClick={() => setDemoNotice(`Vybraný kontakt: ${name} (lokálne demo)`)}>
        {renderIdentity ? renderIdentity(contact, query, searchField) : <span className="priority-builder-card-row">
          <span className="priority-builder-avatar">{name.slice(0, 1).toUpperCase()}</span>
          <strong className="priority-builder-card-name">{name}</strong>
        </span>}
        <span className="priority-builder-card-chips">
          <span className="priority-builder-card-chip priority-builder-card-chip-position">
            <span className="priority-builder-card-chip-icon"><ListOrdered size={11} /></span>
            {queuePosition === 1 ? `${copy.nextUp} — ` : ""}{copy.queuePosition} {queuePosition}
          </span>
          <span className="priority-builder-card-chip priority-builder-card-chip-group">
            <span className="priority-builder-card-chip-icon"><Layers3 size={11} /></span>{copy.group}: {groupName}
          </span>
          {isPriorityReferral(contact) && <span className="priority-builder-card-chip priority-builder-card-chip-referral">{copy.referralBadge}</span>}
          {view.cityGrouping?.enabled && <span className="priority-builder-card-chip priority-builder-card-chip-city">
            <span className="priority-builder-card-chip-icon"><MapPin size={11} /></span>
            {cityGroup?.city || copy.unknownCity}{cityGroup?.countryCode ? `${copy.cityCountrySeparator}${cityGroup.countryCode}` : ""}
          </span>}
          <span className="priority-builder-card-chip priority-builder-card-chip-callback">
            <span className="priority-builder-card-chip-icon"><CalendarClock size={11} /></span>
            {copy.scheduledCallback}: {callbackDateTime || copy.notScheduled}
          </span>
          <span className="priority-builder-card-chip priority-builder-card-chip-attempts">
            <span className="priority-builder-card-chip-icon"><PhoneCall size={11} /></span>{formatAttemptSummary(contact.attemptCount)}
          </span>
        </span>
      </button>
    );
  };
  const previewSegmentGroups = useMemo(() => {
    if (!view.cityGrouping?.enabled) return [];
    const segments = new Map<string, PriorityQueueItem[]>();
    filteredQueue.forEach(item => segments.set(item.segment, [...(segments.get(item.segment) || []), item]));
    return Array.from(segments.entries()).map(([segment, items]) => {
      const cities = new Map<string, PriorityQueueItem[]>();
      items.forEach(item => {
        const key = item.cityGroup?.key || PRIORITY_UNKNOWN_CITY_KEY;
        cities.set(key, [...(cities.get(key) || []), item]);
      });
      return {
        segment,
        label: segment === "other" ? copy.otherGroup : segmentNames[segment as PrioritySegmentId],
        items,
        cityGroups: Array.from(cities.entries()).map(([key, cityItems]) => {
          const city = cityItems[0]?.cityGroup;
          return {
            key: `${segment}:${key}`,
            label: city?.city ? `${city.city}${city.countryCode ? copy.cityCountrySeparator + city.countryCode : ""}` : copy.unknownCity,
            items: cityItems,
          };
        }),
      };
    });
  }, [filteredQueue, view.cityGrouping?.enabled]);
  const whyCopy = view.segments.length > 1
    ? `${segmentNames[view.segments[0].id]} ${copy.whyOne} ${segmentNames[view.segments[1].id]}, ${copy.whyMany}`
    : `${segmentNames[view.segments[0]?.id]} ${copy.whyMany}`;

  return (
    <div className="priority-search-sandbox">
      <section className="priority-builder" aria-label="Poradie priorít">
        <aside className="priority-builder-sidebar">
          <div className="priority-builder-brand">INDEXUS</div>
          <div className="priority-builder-side-label">Kontakty</div>
          <div className="priority-builder-side-item active"><Users size={14} />Kontakty<span className="priority-builder-side-count">{previewQueue.length}</span></div>
          <div className="priority-builder-side-group">
            <div className="priority-builder-side-item active"><ListFilter size={12} />{isPreset ? presetLabels[view.presetId!] : view.name}</div>
            <button type="button" className="priority-builder-side-item" onClick={() => setIsAutoMode(current => !current)}>
              <PhoneCall size={12} />{copy.auto}<span className="priority-builder-side-count">{isAutoMode ? copy.autoOn : copy.autoOff}</span>
            </button>
            <button type="button" className="priority-builder-side-item" onClick={() => setDemoNotice("Ďalší kontakt je dostupný iba v lokálnom deme.")}>
              <ChevronRight size={12} />{copy.nextContact}
            </button>
          </div>
          <button type="button" className="priority-builder-side-item" onClick={() => setSavedViewsOpen(open => !open)} aria-expanded={savedViewsOpen}>
            <ChevronDown size={13} style={{ transform: savedViewsOpen ? undefined : "rotate(-90deg)" }} />{copy.savedViews}
          </button>
          {savedViewsOpen && <div className="priority-builder-side-group">
            {PRIORITY_PRESETS.map(preset => (
              <button key={preset.presetId} type="button" className={`priority-builder-side-item ${activeName === preset.presetId ? "active" : ""}`} onClick={() => activate(preset)}>
                {preset.presetId === "referral_first" ? <ShieldCheck size={12} /> : <Sparkles size={12} />}{presetLabels[preset.presetId!]}
              </button>
            ))}
            {savedViews.filter(viewItem => !viewItem.presetId).map((viewItem, index) => (
              <button key={`${viewItem.name}-${index}`} type="button" className={`priority-builder-side-item ${activeName === viewItem.name ? "active" : ""}`} onClick={() => activate(viewItem, viewItem.name)}>
                <ListFilter size={12} />{viewItem.name}
              </button>
            ))}
          </div>}
          <div className="priority-builder-sidebar-foot">Osobné zobrazenie<br /><span>Ukážkové dáta pre návrh rozhrania</span></div>
        </aside>

        <div className="priority-builder-main">
          <div className="priority-builder-top" role="banner">
            <div className="priority-builder-top-icon"><SlidersHorizontal size={18} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="priority-builder-kicker">{copy.contactsSavedView}</div>
              <h1 className="priority-builder-title">Tvorba priorít</h1>
            </div>
            <button type="button" className="priority-builder-button" onClick={() => setDemoNotice("Zatvorenie je deaktivované v lokálnom deme.")} aria-label={copy.close}><X size={15} /></button>
          </div>
          <div className="priority-builder-toolbar">
            <label className="priority-builder-search"><Search size={14} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Hľadať kontakty…" aria-label="Hľadať kontakty" /></label>
            <select className="priority-builder-select" value={searchField} onChange={event => setSearchField(event.target.value as typeof searchField)} aria-label={copy.fieldAll}>
              <option value="all">{copy.fieldAll}</option><option value="name">{copy.fieldName}</option><option value="phone">{copy.fieldPhone}</option><option value="email">{copy.fieldEmail}</option><option value="city">{copy.fieldCity}</option>
            </select>
            <button type="button" className="priority-builder-button" onClick={() => { setView(DEFAULT_PRIORITY_VIEW); setQuery(""); setSaved(true); }}><RotateCcw size={14} />{copy.reset}</button>
            <label className="priority-builder-city-toggle"><input type="checkbox" data-testid="toggle-priority-city-grouping" checked={!!view.cityGrouping?.enabled} onChange={toggleCityGrouping} /><span>{copy.groupByCity}</span></label>
            {view.cityGrouping?.enabled && <>
              <div className="priority-builder-city-selection" data-testid="priority-city-selection">
                <div className="priority-builder-city-modes" role="radiogroup" aria-label={copy.groupByCity}>
                  <label><input type="radio" name="priority-city-mode" checked={cityGroupingMode === "all"} onChange={() => updateCitySelection({ mode: "all", selectedKeys: Array.from(selectedCityKeys) })} /><span>{copy.allCities}</span></label>
                  <label><input type="radio" name="priority-city-mode" checked={cityGroupingMode === "selected"} onChange={() => updateCitySelection({ mode: "selected", selectedKeys: Array.from(selectedCityKeys) })} /><span>{copy.onlySelectedCities}</span></label>
                </div>
                {cityGroupingMode === "selected" && <div className="priority-builder-city-options" data-testid="priority-city-options">
                  {cityOptions.map(option => {
                    const isUnknown = option.key === PRIORITY_UNKNOWN_CITY_KEY;
                    return <label key={option.key} className="priority-builder-city-option"><input type="checkbox" checked={selectedCityKeys.has(option.key)} onChange={() => {
                      const next = new Set(selectedCityKeys); if (next.has(option.key)) next.delete(option.key); else next.add(option.key);
                      updateCitySelection({ mode: "selected", selectedKeys: Array.from(next) });
                    }} /><span>{isUnknown ? copy.unknownCity : `${option.city}${option.countryCode ? copy.cityCountrySeparator + option.countryCode : ""}`}</span></label>;
                  })}
                  {cityOptions.length === 0 && <span className="priority-builder-city-empty">{copy.noSelectedCities}</span>}
                  {cityOptions.length > 0 && selectedCityKeys.size === 0 && <span className="priority-builder-city-empty">{copy.noSelectedCities}</span>}
                  <span className="priority-builder-city-hint">{copy.citySelectionHint}</span>
                </div>}
              </div>
              <button type="button" className="priority-builder-button" onClick={refreshCityRanking}><RotateCcw size={14} />{copy.cityRankingRefresh}</button>
            </>}
          </div>
          <div className="priority-builder-city-status" role="status"><span>{view.cityGrouping?.enabled ? `${copy.cityRankingReady} · ${copy.cityRankingEstimated}: ${eligibleCityOptions(contacts).length} ${copy.cityRankingLocations}` : copy.groupByCityHint}</span></div>
          {demoNotice && <div className="priority-builder-persistence-error" role="status"><span>{demoNotice}</span><button type="button" className="priority-builder-button" onClick={() => setDemoNotice(null)}>OK</button></div>}
          <div className="priority-builder-mobile-controls">
            <select className="priority-builder-select" value={activeName} onChange={event => {
              const preset = PRIORITY_PRESETS.find(item => item.presetId === event.target.value);
              const localView = savedViews.find(item => item.name === event.target.value);
              if (preset) activate(preset); else if (localView) activate(localView, localView.name);
            }}>{PRIORITY_PRESETS.map(preset => <option key={preset.presetId} value={preset.presetId}>{presetLabels[preset.presetId!]}</option>)}{savedViews.filter(item => !item.presetId).map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select>
            <button type="button" className="priority-builder-button" onClick={() => setIsAutoMode(current => !current)}><PhoneCall size={14} />{copy.auto}</button>
            <button type="button" className="priority-builder-button" onClick={() => setDemoNotice("Ďalší kontakt je dostupný iba v lokálnom deme.")}><ChevronRight size={14} />{copy.nextContact}</button>
          </div>

          <div className="priority-builder-body">
            <section className="priority-builder-editor">
              <div className="priority-builder-section-head"><div><h2>{copy.evaluationOrder}</h2><p>{copy.evaluationHint}</p></div><span className="priority-builder-total">{previewQueue.length} {copy.eligibleContacts}</span></div>
              {view.segments.map((segment, index) => {
                const visual = segmentVisuals[segment.id];
                return <article key={segment.id} className={`priority-builder-row ${selectedId === segment.id ? "selected" : ""}`} onClick={() => setSelectedId(segment.id)} role="button" tabIndex={0} aria-label={`${segmentNames[segment.id]}, ${index + 1}`}>
                  <GripVertical size={15} className="priority-builder-drag" /><span className="priority-builder-number">{index + 1}</span><span className="priority-builder-dot" style={{ background: visual.color }}>{visual.icon}</span>
                  <div style={{ minWidth: 0 }}><div className="priority-builder-row-name">{segmentNames[segment.id]}{index === 0 && <ShieldCheck size={12} color="#b5622e" aria-label="Najvyššia priorita" />}</div><div className="priority-builder-detail">Prvý zodpovedajúci segment</div></div>
                  <span className="priority-builder-count">{segmentCounts.get(segment.id) || 0}</span>
                  <div className="priority-builder-actions" onClick={event => event.stopPropagation()}>
                    <span className="priority-builder-actions-label">Zoradiť podľa</span>
                    <select className="priority-builder-sort" value={segment.sort} onChange={event => makeDraft(view.segments.map(item => item.id === segment.id ? { ...item, sort: event.target.value as PrioritySort } : item))} aria-label={`Zoradiť ${segmentNames[segment.id]}`}>{Object.entries(sortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
                    <label className="priority-builder-referral-toggle" title={copy.referralsFirst}><input type="checkbox" checked={segment.referralsFirst !== false} onChange={event => makeDraft(view.segments.map(item => item.id === segment.id ? { ...item, referralsFirst: event.target.checked } : item))} /><span>{copy.referralsFirst}</span></label>
                    <span style={{ marginLeft: "auto", display: "flex" }}><button type="button" className="priority-builder-mini" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Posunúť hore"><ArrowUp size={14} /></button><button type="button" className="priority-builder-mini" onClick={() => move(index, 1)} disabled={index === view.segments.length - 1} aria-label="Posunúť dole"><ArrowDown size={14} /></button><button type="button" className="priority-builder-mini" onClick={() => setMenuSegmentId(menuSegmentId === segment.id ? null : segment.id)} aria-label={copy.moreActions}><MoreHorizontal size={14} /></button></span>
                  </div>
                  {menuSegmentId === segment.id && <div className="priority-builder-menu"><button type="button" onClick={() => removeSegment(segment.id)} disabled={view.segments.length <= 1}>{copy.removeSegment}</button></div>}
                </article>;
              })}
              <select className="priority-builder-add" value="" onChange={event => { if (event.target.value) addSegment(event.target.value as PrioritySegmentId); }} aria-label="Pridať segment"><option value="">+ Pridať segment</option>{PRIORITY_SEGMENT_IDS.filter(id => !view.segments.some(segment => segment.id === id)).map(id => <option key={id} value={id}>{segmentNames[id]}</option>)}</select>
              <div className="priority-builder-detail" style={{ display: "flex", alignItems: "center", gap: 5, margin: "12px 2px" }}><GripVertical size={13} />{copy.dragHint}</div>
            </section>
            <aside className="priority-builder-preview">
              <div className="priority-builder-preview-head"><div><h2>{copy.liveResult}</h2><p>{showSearchCount && query.trim() ? `Výsledky pre „${query.trim()}“` : copy.workNext}</p></div><strong style={{ color: "#b5622e", fontSize: 16 }}>{showSearchCount && query.trim() ? `${filteredQueue.length} z ${previewQueue.length}` : previewQueue.length}</strong></div>
              <div className="priority-builder-impact"><Check size={15} /><span><strong>{copy.dedupActive}</strong><br />{overlapCount} {copy.dedupDetail}</span></div>
              {view.cityGrouping?.enabled ? previewSegmentGroups.map(segment => <div key={segment.segment} className="priority-builder-preview-segment-group">
                <div className="priority-builder-preview-segment-heading"><Layers3 size={12} />{segment.label}<strong>({segment.items.length})</strong></div>
                {segment.cityGroups.map(group => {
                  const expanded = !collapsedPreviewCities.has(group.key);
                  return <div key={group.key} className="priority-builder-preview-city-group"><button type="button" className="priority-builder-preview-city-toggle" onClick={() => setCollapsedPreviewCities(previous => { const next = new Set(previous); if (next.has(group.key)) next.delete(group.key); else next.add(group.key); return next; })} aria-expanded={expanded}><span><MapPin size={12} />{group.label} <strong>({group.items.length})</strong></span>{expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button>{expanded && group.items.map(renderPreviewCard)}</div>;
                })}
              </div>) : filteredQueue.map(renderPreviewCard)}
              {filteredQueue.length === 0 && <p className="priority-builder-detail" style={{ textAlign: "center", padding: "24px 0" }}>{copy.noResults}</p>}
              <div className="priority-builder-rule"><div className="priority-builder-rule-top"><Check size={14} color="#337e7b" /><strong>{copy.whyThisOrder}</strong></div><div className="priority-builder-rule-copy">{whyCopy}</div></div>
            </aside>
          </div>
          <footer className="priority-builder-save">
            <input readOnly={isPreset} value={isPreset ? presetLabels[view.presetId!] : view.name} onChange={event => { setView(current => ({ ...current, name: event.target.value })); setSaved(false); }} aria-label="Názov zobrazenia" />
            <button type="button" className="priority-builder-button primary" onClick={saveView}><Save size={14} />{copy.save}</button>
            <button type="button" className="priority-builder-button" onClick={duplicate}><Copy size={14} />{copy.duplicate}</button>
            <button type="button" className="priority-builder-button" onClick={() => setDemoNotice("Premenovanie je lokálne v tomto deme.")} aria-label={copy.renameView}><Pencil size={14} /></button>
            {savedId && !isPreset && <button type="button" className="priority-builder-button" onClick={() => { setSavedId(null); setDemoNotice("Zobrazenie bolo odstránené iba z dema."); }}><Trash2 size={14} />{copy.delete}</button>}
            <span className={`priority-builder-status ${saved ? "" : "unsaved"}`} role="status">{saved ? <><Check size={12} />{copy.saved}</> : <><Pencil size={12} />{copy.unsaved}</>}</span>
          </footer>
        </div>
      </section>
      <div className="priority-search-demo-hint">Ukážkové dáta pre návrh rozhrania · vyhľadávanie funguje lokálne podľa mena, kliniky, telefónu a e-mailu.</div>
    </div>
  );
}

export default Current;