import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, HelpCircle, Plus, Search, ShieldCheck, X } from "lucide-react";
import { RECORD_TAG_ENTITY_TYPES, normalizeTagName, tagActionIssues, visibleRecordTags, isProtectedRecordTag } from "@shared/automation-record-tags";
import { UPDATE_RECORD_RELATIONS } from "@shared/automation-update-record";
import { useI18n } from "@/i18n";
import { getUpdateRecordCopy } from "@/i18n/automation-update-record-copy";
import { getAutomationRecordTagCopy } from "@/i18n/automation-record-tag-copy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type RecordOption = { id: string; label: string; secondary?: string; country?: string };
type Props = {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
  mode: "add" | "remove";
  sourceModule: string;
  countryCodes: string[];
  index: number;
  onDraftValidityChange?: (invalid: boolean) => void;
  scheduleMode?: "once" | "per_record";
};
type Catalog = { entities: Array<{ value: string }>; relations: typeof UPDATE_RECORD_RELATIONS };
type Target = { mode: "event" | "related" | "selected"; entityType: string; recordId?: string; relation?: string };
type RecordTagConditionInputProps = {
  entityType: string;
  countryCodes?: string[];
  value: string;
  onChange: (value: string) => void;
};

const entityNames: Record<string, string> = {
  task: "Task", customer: "Customer", hospital: "Hospital", clinic: "Clinic", invoice: "Invoice",
  collection: "Collection", collaborator: "Collaborator", contract: "Contract", campaign: "Mission", product: "Product",
};

function useRecordResults(entityType: string, countries: string, q: string, enabled: boolean) {
  const [state, setState] = useState<{ key: string; records: RecordOption[]; truncated: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const scope = `${entityType}|${countries}|${q.trim()}`;
  useEffect(() => {
    if (!enabled || !entityType || !q.trim()) {
      setState(null); setLoading(false); setError(false);
      return;
    }
    let active = true;
    setState(null);
    const timer = window.setTimeout(async () => {
      setLoading(true); setError(false);
      try {
        const params = new URLSearchParams({ entityType, q: q.trim(), countries });
        const response = await fetch(`/api/automation/record-tags/records?${params}`, { credentials: "include" });
        if (!response.ok) throw new Error("record search");
        const data = await response.json();
        if (active) setState({
          key: scope,
          records: Array.isArray(data.records) ? data.records.filter((r: any) => r?.label && r?.id != null)
            .map((r: any) => ({ ...r, id: String(r.id), label: String(r.label) })) : [],
          truncated: Boolean(data.truncated),
        });
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [entityType, countries, q, enabled]);
  return {
    records: state?.key === scope ? state.records : undefined,
    truncated: state?.key === scope ? state.truncated : false,
    loading, error, retry: () => { setError(false); setState(null); setLoading(false); },
  };
}

function useTagSuggestions(entityType: string, countries: string, q: string, enabled: boolean) {
  const [state, setState] = useState<{ key: string; tags: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const scope = `${entityType}|${countries}|${q.trim()}`;
  useEffect(() => {
    if (!enabled || !entityType) { setState(null); setLoading(false); setError(false); return; }
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true); setError(false);
      try {
        const params = new URLSearchParams({ entityType, q: q.trim(), countries });
        const response = await fetch(`/api/automation/record-tags/suggestions?${params}`, { credentials: "include" });
        if (!response.ok) throw new Error("tag suggestions");
        const data = await response.json();
        if (active) setState({ key: scope, tags: visibleRecordTags(data.tags) });
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [entityType, countries, q, enabled]);
  return { tags: state?.key === scope ? state.tags : [], loading, error, retry: () => setError(false) };
}

export function AutomationRecordTagAction({
  config, onChange, mode, sourceModule, countryCodes, index, onDraftValidityChange, scheduleMode,
}: Props) {
  const { locale } = useI18n();
  const copy = getAutomationRecordTagCopy(locale);
  const updateCopy = getUpdateRecordCopy(locale);
  const root = `tag-action-${index}`;
  const countries = countryCodes.map(code => code.toUpperCase()).join(",");
  const isV2 = config.recordTagActionVersion === 2 && config.target && typeof config.target === "object";
  const hasLegacy = !isV2 && ["entityType", "entityId", "tag", "tags"].some(key => config[key] !== undefined && config[key] !== null);
  const catalog = useQuery<Catalog>({
    queryKey: ["/api/automation/record-tags/catalog"],
    queryFn: async () => {
      const response = await fetch("/api/automation/record-tags/catalog", { credentials: "include" });
      if (!response.ok) throw new Error("tag catalog");
      return response.json();
    },
  });
  const defaultMode = scheduleMode === "once" ? "selected" : "event";
  const target: Target = isV2 ? config.target : {
    mode: defaultMode, entityType: defaultMode === "event" ? sourceModule : "", ...(defaultMode === "selected" ? {} : {}),
  };
  const tags: string[] = isV2 && Array.isArray(config.tags) ? config.tags : [];
  const allowedModes = scheduleMode === "once" ? ["selected"] : scheduleMode === "per_record" ? ["event", "related"] : ["event", "related", "selected"];
  const relations = UPDATE_RECORD_RELATIONS[sourceModule] || [];
  const selectedRelation = relations.find(item => item.key === target.relation &&
    (item.entityType === target.entityType || item.entityType === "dynamic"));
  const [, setLegacyReview] = useState(false);
  const [legacyResolved, setLegacyResolved] = useState<RecordOption | null>(null);
  const [legacyRequestFailed, setLegacyRequestFailed] = useState(false);
  const [record, setRecord] = useState<RecordOption | null>(null);
  const [verifiedScope, setVerifiedScope] = useState("");
  const [search, setSearch] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [tagMessage, setTagMessage] = useState("");
  const callbackRef = useRef(onDraftValidityChange);
  callbackRef.current = onDraftValidityChange;
  const previousScope = useRef(`${mode}|${sourceModule}|${countries}`);
  const entityLabel = (value: string) => (updateCopy.entity as Record<string, string>)[value] || entityNames[value] || value;
  const relationLabel = (key: string) => (updateCopy.relationLabel as Record<string, string>)[key] || key;
  const identityScope = (entityType: string, recordId: string) => `${entityType}|${recordId}|${countries}`;
  const selectedScope = target.mode === "selected" && target.recordId ? identityScope(target.entityType, target.recordId) : "";
  const results = useRecordResults(target.entityType, countries, search, target.mode === "selected" && Boolean(search.trim()));
  const suggestions = useTagSuggestions(target.entityType, countries, tagDraft, isV2);
  const eventSupported = RECORD_TAG_ENTITY_TYPES.includes(sourceModule);
  const targetValid = target.mode === "event" ? eventSupported && target.entityType === sourceModule
    : target.mode === "related" ? Boolean(selectedRelation)
      : target.mode === "selected" ? Boolean(record && record.id === String(target.recordId || "") && verifiedScope === selectedScope)
        : false;
  const registryValid = !catalog.isLoading && !catalog.isError && Boolean(catalog.data?.entities?.some(item => item.value === target.entityType));
  const issues = isV2 ? tagActionIssues(config, sourceModule) : ["version"];
  const invalid = !isV2 || !targetValid || !registryValid || !allowedModes.includes(target.mode) ||
    issues.length > 0 || catalog.isError || catalog.isLoading;
  useEffect(() => { callbackRef.current?.(invalid); }, [invalid]);
  useEffect(() => {
    const scope = `${mode}|${sourceModule}|${countries}`;
    if (previousScope.current === scope) return;
    previousScope.current = scope;
    setRecord(null); setVerifiedScope(""); setSearch("");
    if (config.recordTagActionVersion === 2 && config.acknowledged === true)
      onChange({ ...config, acknowledged: false });
  }, [mode, sourceModule, countries]);

  const change = (next: Partial<Record<string, any>>, resetAck = true) => {
    const nextConfig: Record<string, any> = {
      ...config,
      recordTagActionVersion: 2,
      target: isV2 ? config.target : target,
      tags: isV2 ? config.tags : [],
      ...next,
    };
    if (resetAck) nextConfig.acknowledged = false;
    onChange(nextConfig);
  };
  const setTarget = (next: Target) => {
    setRecord(null); setVerifiedScope(""); setSearch("");
    change({ target: next });
  };
  const setTags = (next: string[]) => {
    change({ tags: next });
    setTagMessage("");
  };
  const addTag = (value = tagDraft) => {
    const tag = normalizeTagName(value);
    if (!tag) { setTagMessage(copy.tagInput); return; }
    if (tag.length > 64 || /[{}\u0000-\u001f\u007f]/u.test(tag) || isProtectedRecordTag(tag)) {
      setTagMessage(copy.protectedTag); return;
    }
    if (tags.some(existing => normalizeTagName(existing).toLowerCase() === tag.toLowerCase())) {
      setTagMessage(copy.duplicate); return;
    }
    if (tags.length >= 20) { setTagMessage(copy.tagLimit); return; }
    setTags([...tags, tag]); setTagDraft("");
  };

  useEffect(() => {
    if (!isV2 || target.mode !== "selected" || !target.recordId) {
      setRecord(null); setVerifiedScope(""); return;
    }
    const scope = identityScope(target.entityType, String(target.recordId));
    if (record?.id === String(target.recordId) && verifiedScope === scope) return;
    let active = true;
    setRecord(null); setVerifiedScope("");
    const params = new URLSearchParams({ entityType: target.entityType, id: String(target.recordId), countries });
    fetch(`/api/automation/record-tags/record?${params}`, { credentials: "include" })
      .then(response => { if (!response.ok) throw new Error("record identity"); return response.json(); })
      .then(data => {
        if (active && data.record?.label && String(data.record.id) === String(target.recordId)) {
          setRecord({ ...data.record, id: String(data.record.id), label: String(data.record.label) });
          setVerifiedScope(scope);
        }
      }).catch(() => { if (active) { setRecord(null); setVerifiedScope(""); } });
    return () => { active = false; };
  }, [isV2, target.mode, target.entityType, target.recordId, countries]);

  useEffect(() => {
    if (!hasLegacy || !config.entityType || !config.entityId) return;
    let active = true;
    setLegacyResolved(null); setLegacyRequestFailed(false);
    const params = new URLSearchParams({ entityType: String(config.entityType), id: String(config.entityId), countries });
    fetch(`/api/automation/record-tags/record?${params}`, { credentials: "include" })
      .then(response => { if (!response.ok) throw new Error("legacy identity"); return response.json(); })
      .then(data => {
        if (active && data.record?.label && String(data.record.id) === String(config.entityId)) setLegacyResolved({ ...data.record, id: String(data.record.id) });
        else if (active) setLegacyRequestFailed(true);
      }).catch(() => { if (active) setLegacyRequestFailed(true); });
    return () => { active = false; };
  }, [hasLegacy, config.entityType, config.entityId, countries]);

  const legacyRaw = useMemo(() => {
    const input = config.tags ?? config.tag;
    return Array.isArray(input) ? input : typeof input === "string" ? input.split(",").map(tag => tag.trim()).filter(Boolean) : [];
  }, [config.tags, config.tag]);
  const legacyValues = visibleRecordTags(legacyRaw);
  const legacyMalformedCount = legacyRaw.filter(tag => typeof tag !== "string" || !normalizeTagName(tag) ||
    normalizeTagName(tag).length > 64 || /[{}\u0000-\u001f\u007f]/u.test(tag) || isProtectedRecordTag(tag)).length;

  if (hasLegacy) return <section className="space-y-3 rounded-xl border border-amber-300/70 bg-amber-50/50 p-4 dark:bg-amber-950/15" data-testid={root}>
    <header className="flex items-start gap-3">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <div><h3 className="text-sm font-semibold">{copy.legacyTitle}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy.legacyHelp}</p></div>
    </header>
    {legacyValues.length > 0 && <div className="flex flex-wrap gap-1.5" aria-label={copy.tags}>{legacyValues.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div>}
    {config.entityId && <p role="status" className="text-xs text-muted-foreground">
      {legacyResolved ? `${entityLabel(String(config.entityType || ""))} · ${legacyResolved.label} · ${copy.country}: ${legacyResolved.country || "—"}` : legacyRequestFailed ? copy.legacyUnresolved : copy.loading}
    </p>}
    {legacyMalformedCount > 0 && <p className="text-xs text-muted-foreground">{copy.conversionHelp}</p>}
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" data-testid={`${root}-migrate`} onClick={() => {
        const targetForConversion: Target = config.entityId && legacyResolved
          ? { mode: "selected", entityType: String(config.entityType), recordId: legacyResolved.id }
          : scheduleMode === "once" ? { mode: "selected", entityType: "" } : { mode: "event", entityType: sourceModule };
        const converted = legacyValues;
        const next = { ...config };
        ["entityType", "entityId", "EntityId", "entityID", "entity_id", "tag"].forEach(key => delete next[key]);
        next.recordTagActionVersion = 2; next.target = targetForConversion; next.tags = converted; next.acknowledged = false;
        onChange(next); setLegacyReview(true); setRecord(legacyResolved); setVerifiedScope(legacyResolved && targetForConversion.recordId
          ? identityScope(targetForConversion.entityType, targetForConversion.recordId) : "");
      }} disabled={Boolean(config.entityId && !legacyResolved) || legacyMalformedCount > 0 ||
        !legacyValues.length || legacyValues.length > 20}>{copy.legacyConvert}</Button>
      {config.entityId && !legacyResolved && legacyRequestFailed && <span className="text-xs text-destructive">{copy.legacyUnresolved}</span>}
    </div>
  </section>;

  const modeLabel = target.mode === "event" ? copy.event : target.mode === "related" ? copy.related : copy.selected;
  const targetSummary = target.mode === "event" ? `${copy.event} · ${entityLabel(target.entityType)}`
    : target.mode === "related" ? `${copy.related} · ${relationLabel(target.relation || "")} · ${entityLabel(target.entityType)}`
      : `${entityLabel(target.entityType)} · ${record?.label || copy.chooseRecord}${record?.secondary ? ` — ${record.secondary}` : ""} · ${copy.country}: ${record?.country || "—"}`;

  return <section className="space-y-4 rounded-xl border bg-background/70 p-4 shadow-sm" data-testid={root}>
    <header className="flex items-start gap-3">
      <span className="rounded-lg bg-primary/10 p-2 text-primary"><ShieldCheck className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{mode === "add" ? copy.addTitle : copy.removeTitle}</h3><p className="text-xs text-muted-foreground">{copy.description}</p></div>
      <Popover>
        <PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label={copy.helpTitle} className="h-8 w-8 shrink-0"><HelpCircle className="h-4 w-4" /></Button></PopoverTrigger>
        <PopoverContent align="end" className="z-[10050] w-[min(340px,calc(100vw-24px))] space-y-2 text-xs leading-relaxed">
          <h4 className="font-semibold">{copy.helpTitle}</h4><p>{copy.where}</p><p>{copy.automationHelp}</p><p>{copy.tagPurpose}</p><p>{copy.example}</p>
        </PopoverContent>
      </Popover>
    </header>

    {catalog.isLoading && <p className="text-xs text-muted-foreground">{copy.loading}</p>}
    {catalog.isError && <button type="button" className="text-xs text-destructive underline" onClick={() => catalog.refetch()}>{copy.loadError} {copy.retry}</button>}
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>{copy.mode}</Label>
        <Select value={target.mode} onValueChange={(value: Target["mode"]) => setTarget({
          mode: value,
          entityType: value === "event" ? sourceModule : value === "related" ? (relations[0]?.entityType === "dynamic" ? "" : relations[0]?.entityType || "") : "",
          ...(value === "related" && relations[0] ? { relation: relations[0].key } : {}),
        })}>
          <SelectTrigger data-testid={`${root}-mode`}><SelectValue>{modeLabel}</SelectValue></SelectTrigger>
          <SelectContent>{allowedModes.map(value => <SelectItem key={value} value={value}>
            {value === "event" ? copy.event : value === "related" ? copy.related : copy.selected}
          </SelectItem>)}</SelectContent>
        </Select>
      </div>
      {target.mode === "event" && <div className="space-y-1.5"><Label>{copy.type}</Label>
        <div className="flex h-10 items-center rounded-md border bg-muted/35 px-3 text-sm">{entityLabel(sourceModule)}</div>
        <p className="text-xs text-muted-foreground">{copy.eventHelp}</p>
      </div>}
      {target.mode === "related" && <div className="space-y-1.5 sm:col-span-2">
        <Label>{copy.relation}</Label>
        <Select value={target.relation || ""} onValueChange={key => {
          const relation = relations.find(item => item.key === key);
          setTarget({ mode: "related", entityType: relation?.entityType === "dynamic" ? "" : relation?.entityType || "", relation: key });
        }}>
          <SelectTrigger><SelectValue placeholder={copy.chooseRelation} /></SelectTrigger>
          <SelectContent>{relations.map(relation => <SelectItem key={relation.key} value={relation.key}>{relationLabel(relation.key)}{relation.entityType === "dynamic" ? ` · ${copy.type}` : ""}</SelectItem>)}</SelectContent>
        </Select>
        {relations.find(item => item.key === target.relation)?.entityType === "dynamic" && <div className="mt-2 space-y-1.5">
          <Label>{copy.type}</Label>
          <Select value={target.entityType || ""} onValueChange={entityType => setTarget({ ...target, entityType })}>
            <SelectTrigger><SelectValue placeholder={copy.type} /></SelectTrigger>
            <SelectContent>{RECORD_TAG_ENTITY_TYPES.map(type => <SelectItem key={type} value={type}>{entityLabel(type)}</SelectItem>)}</SelectContent>
          </Select>
        </div>}
        <p className="text-xs text-muted-foreground">{copy.relatedHelp}</p>
      </div>}
      {target.mode === "selected" && <div className="space-y-2 sm:col-span-2">
        <Label>{copy.type}</Label>
        <Select value={target.entityType || ""} onValueChange={entityType => setTarget({ mode: "selected", entityType })}>
          <SelectTrigger data-testid={`${root}-type`}><SelectValue placeholder={copy.type} /></SelectTrigger>
          <SelectContent>{RECORD_TAG_ENTITY_TYPES.map(type => <SelectItem key={type} value={type}>{entityLabel(type)}</SelectItem>)}</SelectContent>
        </Select>
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={record?.label && !search ? record.label : search} placeholder={copy.searchHint} disabled={!target.entityType}
            data-testid={`${root}-search`} className="pl-9" onChange={event => {
              setSearch(event.target.value); setRecord(null); setVerifiedScope("");
              if (!event.target.value) setTarget({ mode: "selected", entityType: target.entityType });
            }} />
        </div>
        {results.loading && <p className="text-xs text-muted-foreground">{copy.loading}</p>}
        {results.error && <button type="button" className="text-xs text-destructive underline" onClick={() => setSearch(`${search} `)}>{copy.loadError} {copy.retry}</button>}
        {results.records && <div className="max-h-40 overflow-auto rounded-lg border bg-background p-1">
          {results.records.map(item => <button type="button" key={item.id} data-testid={`${root}-result-${item.id}`}
            className="flex w-full flex-col rounded-md px-3 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => { setRecord(item); setVerifiedScope(identityScope(target.entityType, item.id)); setSearch(""); change({ target: { mode: "selected", entityType: target.entityType, recordId: item.id } }); }}>
            <span className="text-sm font-medium">{item.label}</span>
            {(item.secondary || item.country) && <span className="text-xs text-muted-foreground">{[item.secondary, item.country].filter(Boolean).join(" · ")}</span>}
          </button>)}
          {!results.records.length && <p className="px-3 py-2 text-xs text-muted-foreground">{copy.noResults}</p>}
        </div>}
        {results.truncated && <p className="text-xs text-muted-foreground">{copy.truncated}</p>}
        {record && target.recordId === record.id && <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{record.label}</span>{record.secondary && <span className="text-muted-foreground"> · {record.secondary}</span>}
          <span className="text-muted-foreground"> · {copy.country}: {record.country || "—"}</span>
        </div>}
        <p className="text-xs text-muted-foreground">{copy.selectedHelp}</p>
      </div>}
    </div>

    {target.mode === "selected" && target.recordId && !record && <p role="alert" className="text-xs text-destructive">{copy.invalidTarget}</p>}
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2"><Label>{copy.tags}</Label><span className="text-xs tabular-nums text-muted-foreground">{tags.length}/20</span></div>
      <div className="flex flex-wrap gap-1.5">{tags.map(tag => <Badge key={tag} variant="secondary" className="gap-1 py-1">
        <span>{tag}</span><button type="button" aria-label={`${copy.removeTitle}: ${tag}`} className="rounded-full hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setTags(tags.filter(value => value !== tag))}><X className="h-3 w-3" /></button>
      </Badge>)}</div>
      <div className="flex gap-2">
        <Input value={tagDraft} maxLength={256} placeholder={copy.tagInput} data-testid={`${root}-add-input`}
          list={`${root}-suggestions`} onChange={event => { setTagDraft(event.target.value); setTagMessage(""); }}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} />
        <datalist id={`${root}-suggestions`}>{suggestions.tags.map(tag => <option key={tag} value={tag} />)}</datalist>
        <Button type="button" variant="outline" data-testid={`${root}-add`} disabled={!tagDraft.trim() || tags.length >= 20} onClick={() => addTag()}>
          <Plus className="mr-1 h-4 w-4" />{copy.add}
        </Button>
      </div>
      {tagMessage && <p role="alert" className="text-xs text-destructive">{tagMessage}</p>}
      {suggestions.error && <button type="button" className="text-xs text-destructive underline" onClick={suggestions.retry}>{copy.loadError} {copy.retry}</button>}
      {suggestions.loading && <p className="text-xs text-muted-foreground">{copy.loading}</p>}
      {suggestions.tags.length > 0 && <div className="space-y-1"><p className="text-xs font-medium text-muted-foreground">{copy.suggestions}</p><div className="flex flex-wrap gap-1.5">
        {suggestions.tags.filter(tag => !tags.some(selected => selected.toLowerCase() === tag.toLowerCase())).slice(0, 8).map(tag =>
          <button type="button" key={tag} className="rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-muted"
            onClick={() => { setTagDraft(tag); addTag(tag); }}>{tag}</button>)}
      </div></div>}
      <p className="text-xs leading-relaxed text-muted-foreground">{copy.tagLimit} {mode === "add" ? copy.addHelp : copy.removeHelp}</p>
    </div>

    <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/[0.035] p-3">
      <h4 className="text-xs font-semibold">{copy.summary}</h4>
      <p data-testid={`${root}-summary`} className="text-sm leading-relaxed"><span className="font-medium">{mode === "add" ? copy.summaryAdd : copy.summaryRemove}</span> {tags.length ? tags.map(tag => `“${tag}”`).join(", ") : "—"} {copy.to} <span className="font-medium">{targetSummary}</span></p>
      <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed">
        <input type="checkbox" className="mt-0.5 accent-primary" data-testid={`${root}-ack`} checked={config.acknowledged === true}
          onChange={event => change({ acknowledged: event.target.checked }, false)} />
        <span>{copy.acknowledgment}</span>
      </label>
    </div>
    {(!targetValid || !tags.length || issues.length > 0) && <p role="alert" className="text-xs text-destructive">
      {!eventSupported && target.mode === "event" ? copy.invalidSource : !targetValid ? copy.invalidTarget : copy.invalidTags}
    </p>}
    {!allowedModes.includes(target.mode) && <p role="alert" className="text-xs text-destructive">{copy.scheduleMode}</p>}
    {config.acknowledged !== true && <p className="text-xs text-muted-foreground">{copy.acknowledgeRequired}</p>}
  </section>;
}

export function RecordTagConditionInput({ entityType, countryCodes = [], value, onChange }: RecordTagConditionInputProps) {
  const { locale } = useI18n();
  const copy = getAutomationRecordTagCopy(locale);
  const countries = countryCodes.map(code => code.toUpperCase()).join(",");
  const suggestions = useTagSuggestions(entityType, countries, value, true);
  const id = `record-tag-condition-${entityType}`;
  return <div className="space-y-1.5">
    <Label>{copy.conditionField}</Label>
    <Input value={value} maxLength={64} list={id} placeholder={copy.tagInput} onChange={event => onChange(normalizeTagName(event.target.value))} />
    <datalist id={id}>{suggestions.tags.map(tag => <option key={tag} value={tag} />)}</datalist>
    <p className="text-xs leading-relaxed text-muted-foreground">{copy.conditionHelp}</p>
    {suggestions.error && <p role="status" className="text-xs text-muted-foreground">{copy.loadError}</p>}
  </div>;
}
