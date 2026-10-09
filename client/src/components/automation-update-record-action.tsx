import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { UPDATE_RECORD_ENTITIES, UPDATE_RECORD_RELATIONS, updateRecordIssues, type UpdateField } from "@shared/automation-update-record";
import { useI18n } from "@/i18n";
import { getUpdateRecordCopy } from "@/i18n/automation-update-record-copy";
import { TaskCreateDatePicker } from "@/components/tasks/task-create-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type RecordOption = { id: string; label: string; secondary?: string; country?: string };
type Catalog = { entities: Array<{ value: string; fields: Array<string | { key: string }> }>; relations: typeof UPDATE_RECORD_RELATIONS };
type Props = {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
  sourceModule: string;
  availableVariables: Array<{ value: string; label: string }>;
  countryCodes: string[];
  index: number;
  onDraftValidityChange?: (invalid: boolean) => void;
  scheduleMode?: "once" | "per_record";
};
const LEGACY_KEYS = ["entityId", "EntityId", "entityID", "entity_id", "entityType", "recordId", "rawEntityId", "rawJson", "json", "updates", "values", "fields", "entity"];
const tokenPattern = /^{{\s*([A-Za-z][A-Za-z0-9.]*)\s*}}$/;
const entityNames: Record<string, string> = { task: "Task", customer: "Customer", hospital: "Hospital", clinic: "Clinic", invoice: "Invoice", collection: "Collection", collaborator: "Collaborator", contract: "Contract", campaign: "Campaign", product: "Product", user: "User", department: "Department" };

function useRecordSearch(entityType: string, countries: string, query: string, enabled: boolean) {
  const [result, setResult] = useState<{ records: RecordOption[]; truncated: boolean; key: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const currentKey = `${entityType}|${countries}|${query.trim()}`;
  useEffect(() => {
    if (!enabled || query.trim().length < 1 || !entityType) { setResult(null); setLoading(false); setError(false); return; }
    let active = true;
    setResult(null);
    const timer = window.setTimeout(async () => {
      setLoading(true); setError(false);
      try {
        const params = new URLSearchParams({ entityType, q: query.trim(), countries });
        const response = await fetch(`/api/automation/update-record/records?${params}`, { credentials: "include" });
        if (!response.ok) throw new Error("records");
        const data = await response.json();
        if (active) setResult({
          records: Array.isArray(data.records) ? data.records.map((record: RecordOption) => ({ ...record, id: String(record.id) })) : [],
          truncated: Boolean(data.truncated),
          key: currentKey,
        });
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [entityType, countries, query, enabled]);
  return { ...result, records: result?.key === currentKey ? result.records : undefined, truncated: result?.key === currentKey ? result.truncated : false, loading, error, setError };
}

function ReferenceRecordPicker({
  entityType, countries, value, selected, onSelect, onSearch, testId,
}: {
  entityType: string;
  countries: string;
  value: string;
  selected?: RecordOption;
  onSelect: (record: RecordOption) => void;
  onSearch: (value: string) => void;
  testId: string;
}) {
  const { locale } = useI18n();
  const copy = getUpdateRecordCopy(locale);
  const found = useRecordSearch(entityType, countries, value, Boolean(value.trim()));
  return <div className="space-y-2">
    <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={selected?.label || value} placeholder={copy.searchHint} className="pl-9" data-testid={testId} onChange={event => onSearch(event.target.value)} />
    </div>
    {found.loading && <p className="text-xs text-muted-foreground">{copy.loading}</p>}
    {found.error && <button type="button" role="alert" className="text-xs text-destructive underline-offset-2 hover:underline" onClick={() => onSearch(`${value} `)}>{copy.loadError} {copy.retry}</button>}
    {found.records?.length ? <div className="max-h-40 overflow-auto rounded-lg border bg-background p-1">
      {found.records.map(record => <button type="button" key={record.id} onClick={() => onSelect(record)} className="flex w-full flex-col rounded-md px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <span className="text-sm font-medium">{record.label}</span>{record.secondary && <span className="text-xs text-muted-foreground">{record.secondary}</span>}
      </button>)}
    </div> : null}
    {found.records && found.records.length === 0 && <p className="text-xs text-muted-foreground">{copy.noResults}</p>}
    {found.truncated && <p className="text-xs text-muted-foreground">{copy.truncated}</p>}
  </div>;
}

export function AutomationUpdateRecordAction({
  config, onChange, sourceModule, availableVariables, countryCodes, index, onDraftValidityChange, scheduleMode,
}: Props) {
  const { locale } = useI18n();
  const copy = getUpdateRecordCopy(locale);
  const root = `update-record-${index}`;
  const countries = countryCodes.map(code => code.toUpperCase()).join(",");
  const catalogQuery = useQuery<Catalog>({
    queryKey: ["/api/automation/update-record/catalog"],
    queryFn: async () => {
      const response = await fetch("/api/automation/update-record/catalog", { credentials: "include" });
      if (!response.ok) throw new Error("catalog");
      return response.json();
    },
  });
  const isV2 = config.updateRecordVersion === 2 && config.target && typeof config.target === "object";
  const hasLegacyPayload = !isV2 && LEGACY_KEYS.some(key => config[key] !== undefined && config[key] !== null);
  const target = isV2 ? config.target : { mode: scheduleMode === "once" ? "selected" : "event", entityType: scheduleMode === "once" ? "" : sourceModule };
  const fields = isV2 && config.fields && typeof config.fields === "object" && !Array.isArray(config.fields) ? config.fields as Record<string, unknown> : {};
  const [migrating, setMigrating] = useState(false);
  const [migrationConfirmed, setMigrationConfirmed] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RecordOption | null>(null);
  const [selectedVerifiedScope, setSelectedVerifiedScope] = useState("");
  const previousScope = useRef(`${sourceModule}|${countries}`);
  const [targetSearch, setTargetSearch] = useState("");
  const [referenceSearch, setReferenceSearch] = useState<Record<string, string>>({});
  const referenceSearchRef = useRef(referenceSearch);
  referenceSearchRef.current = referenceSearch;
  const [referenceSelections, setReferenceSelections] = useState<Record<string, RecordOption>>({});
  const [referenceVerified, setReferenceVerified] = useState<Record<string, { id: string; scope: string }>>({});
  const [referencePending, setReferencePending] = useState<Record<string, boolean>>({});
  const [optionData, setOptionData] = useState<Record<string, Array<{ value: string | number; label: string }>>>({});
  const [optionLoading, setOptionLoading] = useState<Record<string, boolean>>({});
  const [optionErrors, setOptionErrors] = useState<Record<string, boolean>>({});
  const callbackRef = useRef(onDraftValidityChange);
  callbackRef.current = onDraftValidityChange;
  const entityFields = UPDATE_RECORD_ENTITIES[target.entityType] || [];
  const catalogEntity = catalogQuery.data?.entities?.find(item => item.value === target.entityType);
  const allowedKeys = catalogEntity ? new Set(catalogEntity.fields.map(field => typeof field === "string" ? field : field.key)) : null;
  const supportedFields = entityFields.filter(field => !allowedKeys || allowedKeys.has(field.key));
  const fieldMap = new Map(entityFields.map(field => [field.key, field]));
  const targetRelations = UPDATE_RECORD_RELATIONS[sourceModule] || [];
  const allowedModes = scheduleMode === "once" ? ["selected"] : scheduleMode === "per_record" ? ["event", "related"] : ["event", "related", "selected"];
  const scopeFor = (entityType: string) => `${entityType}|${countries}|${sourceModule}`;
  const relatedEntity = targetRelations.find(relation => relation.key === target.relation);
  const targetTypeValid = Object.hasOwn(UPDATE_RECORD_ENTITIES, target.entityType);
  const currentTargetValid = target.mode === "event" ? target.entityType === sourceModule
    : target.mode === "related" ? Boolean(relatedEntity && (relatedEntity.entityType === target.entityType || relatedEntity.entityType === "dynamic"))
       : target.mode === "selected" ? Boolean(target.recordId && selectedRecord?.id === target.recordId && selectedVerifiedScope === scopeFor(target.entityType)) : false;
  const supportedVariables = useMemo(() => availableVariables.map(item => ({
    value: item.value.replace(/^{{\s*|\s*}}$/g, "").trim(), label: item.label,
  })).filter(item => /^(?:newValues|oldValues)\.[A-Za-z][A-Za-z0-9]*$/.test(item.value)), [availableVariables]);
  const validation = isV2 ? updateRecordIssues(config, sourceModule) : ["version"];
  const localIssues: string[] = [];
  if (!isV2 && !migrating) localIssues.push("version");
  if (isV2 && (!currentTargetValid || !targetTypeValid)) localIssues.push("target");
  if (isV2 && !allowedModes.includes(target.mode)) localIssues.push("scheduleMode");
  if (catalogQuery.isError || catalogQuery.isLoading) localIssues.push("catalog");
  if (isV2 && !catalogQuery.isError && !catalogQuery.isLoading && !catalogEntity) localIssues.push("catalog");
  if (isV2 && Object.keys(fields).some(key => !fieldMap.has(key) || (allowedKeys && !allowedKeys.has(key)))) localIssues.push("field");
  if (isV2) {
    for (const [key, value] of Object.entries(fields)) {
      const field = fieldMap.get(key);
      if (!field) continue;
      if (typeof value === "string" && value.includes("{{")) {
        const match = value.match(tokenPattern);
        if (!match || !supportedVariables.some(variable => variable.value === match[1])) localIssues.push(`token:${key}`);
      }
    }
  }
  if (isV2) {
    for (const [key, value] of Object.entries(fields)) {
      const field = fieldMap.get(key);
      if (field?.kind !== "reference" || value == null || (typeof value === "string" && value.match(tokenPattern))) continue;
      if (typeof value !== "string" && typeof value !== "number") { localIssues.push(`reference:${key}`); continue; }
      const verified = referenceVerified[key];
      if (referencePending[key] || !verified || verified.id !== String(value) || verified.scope !== scopeFor(field.reference || "")) localIssues.push(`reference:${key}`);
    }
  }
  const clearNeedsAcknowledgement = Object.values(fields).some(value => value === null) && config.clearAcknowledged !== true;
  const invalid = !isV2 || validation.length > 0 || localIssues.length > 0 || catalogQuery.isError || catalogQuery.isLoading || clearNeedsAcknowledgement;
  useEffect(() => { callbackRef.current?.(invalid); }, [invalid]);
  useEffect(() => {
    const scope = `${sourceModule}|${countries}`;
    if (previousScope.current === scope) return;
    previousScope.current = scope;
    setSelectedRecord(null); setSelectedVerifiedScope("");
    setReferenceSelections({}); setReferenceVerified({});
    setOptionData({});
    if (config.updateRecordVersion === 2 && (config.acknowledged || config.clearAcknowledged))
      onChange({ ...config, acknowledged: false, clearAcknowledged: false });
  }, [sourceModule, countries]);

  const save = (patch: Record<string, unknown>, resetAcknowledgement = true) => {
    const next: Record<string, any> = { ...config, updateRecordVersion: 2,
      target: isV2 ? config.target : target, fields: isV2 ? config.fields : {}, ...patch };
    if (resetAcknowledgement) { next.acknowledged = false; next.clearAcknowledged = false; }
    onChange(next);
  };
  const saveFields = (nextFields: Record<string, unknown>) => save({ fields: nextFields });
  const setTarget = (nextTarget: Record<string, unknown>) => {
    setSelectedRecord(null); setSelectedVerifiedScope(""); setTargetSearch(""); setReferenceSelections({}); setReferenceSearch({}); setReferenceVerified({}); setReferencePending({});
    setOptionData({}); setOptionLoading({}); setOptionErrors({});
    save({ target: nextTarget, fields: {} });
  };
  const fieldLabel = (key: string) => (copy.field as Record<string, string>)[key] || key;
  const entityLabel = (key: string) => (copy.entity as Record<string, string>)[key] || entityNames[key] || key;
  const relationLabel = (key: string) => (copy.relationLabel as Record<string, string>)[key] || key;
  const legacyFieldKeys = Array.from(new Set(["fields", "updates", "values"]
    .flatMap(key => config[key] && typeof config[key] === "object" && !Array.isArray(config[key]) ? Object.keys(config[key]) : [])));
  const legacyRemoved = [
    ...legacyFieldKeys.map(fieldLabel),
    ...(config.entityId || config.EntityId || config.entityID || config.entity_id || config.rawEntityId || config.recordId ? [copy.legacyRecordId] : []),
  ];
  const targetDescription = target.mode === "event"
    ? `${copy.event} · ${entityLabel(target.entityType)}`
    : target.mode === "related"
      ? `${copy.related} · ${relationLabel(target.relation || "")} · ${entityLabel(target.entityType)}`
      : `${copy.selected} · ${selectedRecord?.label || (target.recordId ? copy.chooseRecord : copy.chooseRecord)}${selectedRecord?.secondary ? ` — ${selectedRecord.secondary}` : ""}`;
  const recordSearch = useRecordSearch(target.entityType, countries, targetSearch, target.mode === "selected");

  useEffect(() => {
    if (!isV2 || target.mode !== "selected" || !target.recordId) return;
    const scope = scopeFor(target.entityType);
    if (selectedRecord?.id === target.recordId && selectedVerifiedScope === scope) return;
    let active = true;
    setSelectedRecord(null);
    setSelectedVerifiedScope("");
    const params = new URLSearchParams({ entityType: target.entityType, id: target.recordId, countries });
    fetch(`/api/automation/update-record/record?${params}`, { credentials: "include" })
      .then(response => { if (!response.ok) throw new Error("record"); return response.json(); })
      .then(data => {
        if (active && data.record?.label && String(data.record.id) === String(target.recordId)) {
          setSelectedRecord({ ...data.record, id: String(data.record.id) });
          setSelectedVerifiedScope(scope);
        }
      })
      .catch(() => { if (active) setSelectedRecord(null); });
    return () => { active = false; };
  }, [isV2, target.mode, target.entityType, target.recordId, countries, sourceModule, selectedRecord?.id, selectedVerifiedScope]);

  const referenceIdentity = JSON.stringify(Object.entries(fields)
    .filter(([key, value]) => fieldMap.get(key)?.kind === "reference" && value != null &&
      (typeof value === "number" || (typeof value === "string" && !value.match(tokenPattern))))
    .map(([key, value]) => [key, String(value)]));
  useEffect(() => {
    if (!isV2 || !referenceIdentity) return;
    let active = true;
    const refs = JSON.parse(referenceIdentity) as Array<[string, string]>;
    refs.forEach(([key, id]) => {
      const field = fieldMap.get(key);
      if (!field?.reference) return;
      const scope = scopeFor(field.reference);
      const params = new URLSearchParams(field.reference === "collection_status"
        ? { entityType: target.entityType, field: field.key, q: id, countries }
        : { entityType: field.reference, id, countries });
      const endpoint = field.reference === "collection_status" ? "options" : "record";
      fetch(`/api/automation/update-record/${endpoint}?${params}`, { credentials: "include" })
        .then(response => { if (!response.ok) throw new Error("reference"); return response.json(); })
        .then(data => {
          if (!active || referenceSearchRef.current[key]) return;
          if (endpoint === "record" && data.record?.label && String(data.record.id) === id) {
            setReferenceSelections(previous => ({ ...previous, [key]: { ...data.record, id: String(data.record.id) } }));
            setReferenceVerified(previous => ({ ...previous, [key]: { id, scope } }));
          } else if (endpoint === "options" && Array.isArray(data.options)) {
            setOptionData(previous => ({ ...previous, [key]: data.options }));
            const option = data.options.find((candidate: { value: string | number }) => String(candidate.value) === id);
            if (option) {
              setReferenceSelections(previous => ({ ...previous, [key]: { id, label: option.label } }));
              setReferenceVerified(previous => ({ ...previous, [key]: { id, scope } }));
            }
          }
        })
        .catch(() => { /* invalid until a real record/option is explicitly selected */ });
    });
    return () => { active = false; };
  }, [isV2, referenceIdentity, target.entityType, countries, sourceModule]);

  const optionRequestIds = useRef<Record<string, number>>({});
  const optionContext = useRef({ entityType: target.entityType, countries, sourceModule, referenceSearch });
  optionContext.current = { entityType: target.entityType, countries, sourceModule, referenceSearch };
  useEffect(() => {
    optionRequestIds.current = {};
    setOptionData({});
    setOptionLoading({});
    setOptionErrors({});
  }, [target.entityType, countries, sourceModule]);
  const fetchOptions = async (key: string, field: UpdateField, query: string) => {
    const requestId = (optionRequestIds.current[key] || 0) + 1;
    optionRequestIds.current[key] = requestId;
    const requestScope = `${target.entityType}|${countries}|${sourceModule}|${query}`;
    const stillCurrent = () => optionRequestIds.current[key] === requestId &&
      `${optionContext.current.entityType}|${optionContext.current.countries}|${optionContext.current.sourceModule}|${optionContext.current.referenceSearch[key] || ""}` === requestScope;
    setOptionLoading(previous => ({ ...previous, [key]: true }));
    setOptionErrors(previous => ({ ...previous, [key]: false }));
    try {
      const params = new URLSearchParams({ entityType: target.entityType, field: field.key, q: query, countries });
      const response = await fetch(`/api/automation/update-record/options?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error("options");
      const data = await response.json();
      if (stillCurrent()) setOptionData(previous => ({ ...previous, [key]: Array.isArray(data.options) ? data.options : [] }));
    } catch { if (stillCurrent()) setOptionErrors(previous => ({ ...previous, [key]: true })); }
    finally { if (stillCurrent()) setOptionLoading(previous => ({ ...previous, [key]: false })); }
  };
  const valueSummary = (field: UpdateField, value: unknown) => {
    if (value === null) return copy.clear;
    if (typeof value === "boolean") return value ? copy.true : copy.false;
    if (typeof value === "string" && value.match(tokenPattern)) {
      const variable = supportedVariables.find(item => item.value === value.match(tokenPattern)?.[1]);
      return variable ? `${copy.variable}: ${variable.label}` : value;
    }
    if (field.kind === "enum") return (copy.option as Record<string, string>)[String(value)] || String(value);
    if (field.kind === "reference") return referenceSelections[field.key]?.label || (value ? copy.chooseRecord : "");
    return String(value ?? "");
  };
  const clearCount = Object.values(fields).filter(value => value === null).length;
  const usedKeys = new Set(Object.keys(fields));
  const optionsField = (key: string, field: UpdateField) => {
    const value = fields[key];
    const variable = typeof value === "string" ? value.match(tokenPattern)?.[1] : undefined;
    const selectedOption = optionData[key]?.find(item => String(item.value) === String(value));
    return <div className="space-y-2">
      {field.kind === "text" && <textarea className="min-h-24 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" maxLength={10000} value={typeof value === "string" && !variable ? value : ""}
        placeholder={copy.enterValue} data-testid={`${root}-value-${key}`} onChange={event => saveFields({ ...fields, [key]: event.target.value })} />}
      {field.kind === "number" && <div>
        <Input type="number" min={field.min} max={field.max} step="any" value={typeof value === "number" ? value : ""} placeholder={copy.enterValue}
          data-testid={`${root}-value-${key}`} onChange={event => saveFields({ ...fields, [key]: event.target.value === "" ? undefined : Number(event.target.value) })} />
        {(field.min != null || field.max != null) && <p className="mt-1 text-xs text-muted-foreground">{copy.limits}: {field.min ?? "−∞"} – {field.max ?? "∞"}</p>}
      </div>}
      {field.kind === "boolean" && <Select value={typeof value === "boolean" ? String(value) : ""} onValueChange={next => saveFields({ ...fields, [key]: next === "true" })}>
        <SelectTrigger data-testid={`${root}-value-${key}`}><SelectValue placeholder={copy.selectValue} /></SelectTrigger>
        <SelectContent><SelectItem value="true">{copy.true}</SelectItem><SelectItem value="false">{copy.false}</SelectItem></SelectContent>
      </Select>}
      {field.kind === "enum" && <Select value={typeof value === "string" ? value : ""} onValueChange={next => saveFields({ ...fields, [key]: next })}>
        <SelectTrigger data-testid={`${root}-value-${key}`}><SelectValue placeholder={copy.selectValue} /></SelectTrigger>
        <SelectContent>{(field.options || []).map(option => <SelectItem key={option} value={option}>{(copy.option as Record<string, string>)[option] || option}</SelectItem>)}</SelectContent>
      </Select>}
      {field.kind === "date" && <div data-testid={`${root}-value-${key}`}>
        <TaskCreateDatePicker value={typeof value === "string" && !variable ? value.slice(0, 10) : ""} onChange={next => saveFields({ ...fields, [key]: next })}
          locale={locale} label={fieldLabel(key)} clearLabel={copy.clear} />
      </div>}
      {field.kind === "reference" && field.reference === "collection_status" && <div className="space-y-2">
        <div className="flex gap-2"><Input value={referenceSearch[key] || ""} placeholder={copy.searchHint} onChange={event => {
          optionRequestIds.current[key] = (optionRequestIds.current[key] || 0) + 1;
          setOptionData(previous => { const next = { ...previous }; delete next[key]; return next; });
          setOptionLoading(previous => ({ ...previous, [key]: false }));
          setOptionErrors(previous => ({ ...previous, [key]: false }));
          setReferencePending(previous => ({ ...previous, [key]: true }));
          setReferenceSearch(previous => ({ ...previous, [key]: event.target.value }));
        }} />
          <Button type="button" variant="outline" onClick={() => fetchOptions(key, field, referenceSearch[key] || "")}>{copy.search}</Button></div>
        {optionLoading[key] && <p className="text-xs text-muted-foreground">{copy.loading}</p>}
        {optionErrors[key] && <button type="button" className="text-xs text-destructive" onClick={() => fetchOptions(key, field, referenceSearch[key] || "")}>{copy.loadError} {copy.retry}</button>}
        {optionData[key]?.length ? <Select value={value == null ? "" : String(value)} onValueChange={next => {
          const option = optionData[key].find(item => String(item.value) === next);
          setReferencePending(previous => ({ ...previous, [key]: false }));
          setReferenceSelections(previous => ({ ...previous, [key]: { id: next, label: option?.label || next } }));
          setReferenceVerified(previous => ({ ...previous, [key]: { id: next, scope: scopeFor(field.reference || "") } }));
          saveFields({ ...fields, [key]: Number(next) });
        }}>
          <SelectTrigger data-testid={`${root}-value-${key}`}><SelectValue placeholder={copy.selectValue}>{selectedOption?.label}</SelectValue></SelectTrigger>
          <SelectContent>{optionData[key].map(option => <SelectItem key={String(option.value)} value={String(option.value)}>{option.label}</SelectItem>)}</SelectContent>
        </Select> : null}
      </div>}
      {field.kind === "reference" && field.reference !== "collection_status" && <ReferenceRecordPicker entityType={field.reference || ""} countries={countries}
        value={referenceSearch[key] || ""} selected={referenceSelections[key]} onSelect={record => {
          setReferenceSelections(previous => ({ ...previous, [key]: record }));
          setReferenceSearch(previous => ({ ...previous, [key]: "" }));
          setReferencePending(previous => ({ ...previous, [key]: false }));
          setReferenceVerified(previous => ({ ...previous, [key]: { id: record.id, scope: scopeFor(field.reference || "") } }));
          saveFields({ ...fields, [key]: record.id });
        }} onSearch={next => {
          setReferenceSelections(previous => { const updated = { ...previous }; delete updated[key]; return updated; });
          setReferenceSearch(previous => ({ ...previous, [key]: next }));
          setReferencePending(previous => ({ ...previous, [key]: Boolean(next) }));
          setReferenceVerified(previous => { const updated = { ...previous }; delete updated[key]; return updated; });
          if (!next) saveFields({ ...fields, [key]: undefined });
        }} testId={`${root}-value-${key}`} />}
      <div className="space-y-2 rounded-lg border border-dashed border-border/80 p-3">
        <Label className="text-xs text-muted-foreground">{copy.variable}</Label>
        {supportedVariables.length ? <Select value={variable || "__literal"} onValueChange={next => {
          setReferencePending(previous => ({ ...previous, [key]: false }));
          saveFields({ ...fields, [key]: next === "__literal" ? (field.kind === "number" ? undefined : "") : `{{${next}}}` });
        }}>
          <SelectTrigger><SelectValue placeholder={copy.variable}>{variable ? supportedVariables.find(item => item.value === variable)?.label || variable : copy.enterValue}</SelectValue></SelectTrigger>
          <SelectContent><SelectItem value="__literal">{copy.enterValue}</SelectItem>{supportedVariables.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
        </Select> : <p className="text-xs text-muted-foreground">{copy.noVariables}</p>}
      </div>
      {field.nullable && <label className="flex items-start gap-2 rounded-md border bg-muted/20 p-3 text-sm transition-colors hover:bg-muted/35">
        <input type="checkbox" className="mt-0.5 accent-primary" checked={value === null} onChange={event => {
          setReferencePending(previous => ({ ...previous, [key]: false }));
          saveFields({ ...fields, [key]: event.target.checked ? null : (field.kind === "boolean" ? false : field.kind === "number" ? undefined : "") });
        }} />
        <span><span className="block font-medium">{copy.clear}</span><span className="block text-xs text-muted-foreground">{copy.clearHelp}</span></span>
      </label>}
    </div>;
  };

  if (hasLegacyPayload && !migrating) return <section className="space-y-3 rounded-xl border border-amber-300/70 bg-amber-50/60 p-4 dark:bg-amber-950/20" data-testid={root}>
    <div className="flex items-start gap-3"><span className="rounded-lg bg-amber-100 p-2 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"><AlertTriangle className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{copy.legacyTitle}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy.legacyHelp}</p></div>
    </div>
    <Button type="button" variant="outline" onClick={() => { setMigrating(true); setMigrationConfirmed(false); }} data-testid={`${root}-migrate`}>{copy.reviewMigrate}</Button>
  </section>;

  return <section className="space-y-4 rounded-xl border bg-background/70 p-4 shadow-sm transition-shadow hover:shadow-md" data-testid={root}>
    <header className="flex items-start gap-3">
      <span className="rounded-lg bg-primary/10 p-2 text-primary"><ShieldCheck className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{copy.heading}</h3><p className="text-xs text-muted-foreground">{copy.description}</p></div>
    </header>
    {migrating && <div className="space-y-3 rounded-lg border border-amber-300/70 bg-amber-50/60 p-3 dark:bg-amber-950/20">
      <p className="text-xs leading-relaxed">{copy.conversionWarning}</p>
      {legacyRemoved.length > 0 && <div className="rounded-md border border-amber-300/60 bg-background/70 p-3">
        <p className="text-xs font-semibold">{copy.changesRemoved}</p>
        <ul className="mt-1 list-inside list-disc space-y-1 text-xs">{legacyRemoved.map((name, itemIndex) => <li key={`${name}-${itemIndex}`}>{name}</li>)}</ul>
      </div>}
      <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={migrationConfirmed} onChange={event => setMigrationConfirmed(event.target.checked)} className="mt-0.5 accent-primary" />{copy.confirmMigration}</label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={!migrationConfirmed} onClick={() => {
          const next: Record<string, any> = { ...config };
          LEGACY_KEYS.forEach(key => { delete next[key]; });
          next.updateRecordVersion = 2;
          next.target = scheduleMode === "once" ? { mode: "selected", entityType: "" } : { mode: "event", entityType: sourceModule };
          next.fields = {};
          next.acknowledged = false;
          delete next.clearAcknowledged;
          onChange(next); setMigrating(false); setSelectedRecord(null); setSelectedVerifiedScope("");
        }}>{copy.convert}</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setMigrating(false)}>{copy.cancel}</Button>
      </div>
    </div>}

    <p className="rounded-lg border border-primary/15 bg-primary/[0.045] px-3 py-2 text-xs leading-relaxed text-muted-foreground">{copy.safetyHelp}</p>
    <div className="grid gap-3 sm:grid-cols-[minmax(180px,.75fr)_minmax(0,1.25fr)]">
      <div className="space-y-1.5"><Label htmlFor={`${root}-mode`}>{copy.mode}</Label>
        <Select value={target.mode} onValueChange={mode => setTarget({ mode, entityType: mode === "event" ? sourceModule : (target.entityType === sourceModule ? "" : target.entityType) })}>
          <SelectTrigger id={`${root}-mode`} data-testid={`${root}-mode`}><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="event" disabled={!allowedModes.includes("event")}>{copy.event}</SelectItem><SelectItem value="related" disabled={!allowedModes.includes("related") || !targetRelations.length}>{copy.related}</SelectItem><SelectItem value="selected" disabled={!allowedModes.includes("selected")}>{copy.selected}</SelectItem></SelectContent>
        </Select>
      </div>
      {target.mode !== "event" && <div className="space-y-1.5"><Label htmlFor={`${root}-type`}>{copy.type}</Label>
        <Select value={target.entityType || "__none"} onValueChange={entityType => setTarget({ ...target, entityType, relation: target.mode === "related" ? undefined : target.relation, recordId: undefined })}>
          <SelectTrigger id={`${root}-type`} data-testid={`${root}-type`}><SelectValue placeholder={copy.type} /></SelectTrigger>
          <SelectContent>{Object.keys(UPDATE_RECORD_ENTITIES).map(entity => <SelectItem key={entity} value={entity}>{entityLabel(entity)}</SelectItem>)}</SelectContent>
        </Select>
      </div>}
    </div>
    {target.mode === "event" && <p className="rounded-lg border border-primary/15 bg-primary/[0.045] px-3 py-2 text-xs leading-relaxed text-muted-foreground">{copy.eventHelp}</p>}
    {target.mode === "related" && <div className="space-y-2">
      <Label htmlFor={`${root}-relation`}>{copy.relation}</Label>
      <Select value={target.relation || "__none"} onValueChange={relation => {
        const spec = targetRelations.find(item => item.key === relation);
        if (!spec) return;
        const entityType = spec.entityType === "dynamic" ? (target.entityType || "") : spec.entityType;
        setTarget({ mode: "related", entityType, relation });
      }}>
        <SelectTrigger id={`${root}-relation`}><SelectValue placeholder={copy.chooseRelation} /></SelectTrigger>
        <SelectContent>{targetRelations.filter(item => item.entityType !== "dynamic" || target.entityType).map(item => <SelectItem key={item.key} value={item.key}>{relationLabel(item.key)}</SelectItem>)}</SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{copy.missingRelation}</p>
    </div>}
    {target.mode === "selected" && <div className="space-y-2">
      <Label htmlFor={`${root}-search`}>{copy.search}</Label>
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input id={`${root}-search`} value={targetSearch || selectedRecord?.label || ""} placeholder={copy.searchHint} className="pl-9" data-testid={`${root}-search`}
          onChange={event => {
            setSelectedRecord(null); setSelectedVerifiedScope(""); setTargetSearch(event.target.value);
            if (target.recordId) save({ target: { ...target, recordId: undefined } });
          }} />
      </div>
      {recordSearch.loading && <p className="text-xs text-muted-foreground">{copy.loading}</p>}
      {recordSearch.error && <button type="button" className="text-xs text-destructive" onClick={() => setTargetSearch(`${targetSearch} `)}>{copy.loadError} {copy.retry}</button>}
      {recordSearch.records && <div className="max-h-48 overflow-auto rounded-lg border bg-background p-1">
        {recordSearch.records.length ? recordSearch.records.map(record => <button type="button" key={record.id}
          data-testid={`update-record-result-${record.id}`} onClick={() => {
            setSelectedRecord(record); setSelectedVerifiedScope(scopeFor(target.entityType)); setTargetSearch("");
            save({ target: { ...target, recordId: record.id } });
          }}
          className="flex w-full flex-col rounded-md px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="text-sm font-medium">{record.label}</span>{record.secondary && <span className="text-xs text-muted-foreground">{record.secondary}</span>}
        </button>) : <p className="px-3 py-2 text-xs text-muted-foreground">{copy.noResults}</p>}
      </div>}
      {recordSearch.truncated && <p className="text-xs text-muted-foreground">{copy.truncated}</p>}
      <p className="rounded-lg border border-amber-300/70 bg-amber-50/60 px-3 py-2 text-xs text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">{copy.fixedWarning}</p>
    </div>}
    {!currentTargetValid && <p role="alert" className="text-xs text-destructive">
      {isV2 && !allowedModes.includes(target.mode) ? copy.scheduleMode : target.mode === "related" ? copy.invalidRelation : target.mode === "selected" ? copy.invalidRecord : copy.invalidTarget}
    </p>}
    <div className="space-y-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-sm font-semibold">{copy.fields}</h4><p className="text-xs text-muted-foreground">{copy.noFields}</p></div>
        <Select disabled={!targetTypeValid || supportedFields.length === 0 || Object.keys(fields).length >= 20} value="__add" onValueChange={key => {
          if (key === "__add") return;
          saveFields({ ...fields, [key]: supportedFields.find(item => item.key === key)?.kind === "boolean" ? false : "" });
        }}>
          <SelectTrigger className="w-auto gap-2" data-testid={`${root}-add-field`}><Plus className="h-4 w-4" /><SelectValue placeholder={copy.addField}>{copy.addField}</SelectValue></SelectTrigger>
          <SelectContent>{supportedFields.filter(field => !usedKeys.has(field.key)).map(field => <SelectItem key={field.key} value={field.key}>{fieldLabel(field.key)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {!Object.keys(fields).length && <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-5 text-center text-xs text-muted-foreground">{copy.empty}</div>}
      {Object.entries(fields).map(([key, value]) => {
        const field = fieldMap.get(key);
        return <article key={key} className="space-y-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/35" data-testid={`${root}-field-row-${key}`}>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1"><Label htmlFor={`${root}-field-${key}`}>{copy.value}</Label>
              <Select value={key} onValueChange={nextKey => {
                const next = { ...fields }; delete next[key]; next[nextKey] = UPDATE_RECORD_ENTITIES[target.entityType].find(item => item.key === nextKey)?.kind === "boolean" ? false : "";
                saveFields(next);
              }}>
                <SelectTrigger id={`${root}-field-${key}`} data-testid={`${root}-field-${key}`}><SelectValue>{field ? fieldLabel(key) : key}</SelectValue></SelectTrigger>
                <SelectContent>{supportedFields.filter(candidate => candidate.key === key || !usedKeys.has(candidate.key)).map(candidate => <SelectItem key={candidate.key} value={candidate.key}>{fieldLabel(candidate.key)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button type="button" variant="ghost" size="icon" className="mt-5 h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive" aria-label={`${copy.remove}: ${fieldLabel(key)}`}
              onClick={() => { const next = { ...fields }; delete next[key]; saveFields(next); }}><Trash2 className="h-4 w-4" /></Button>
          </div>
          {field ? optionsField(key, field) : <p role="alert" className="text-xs text-destructive">{copy.invalidField}</p>}
          {field && validation.includes(`value:${key}`) && <p role="alert" className="text-xs text-destructive">{copy.invalidValue}</p>}
          {localIssues.includes(`reference:${key}`) && <p role="alert" className="text-xs text-destructive">{copy.invalidRecord}</p>}
          {typeof value === "string" && value.includes("{{") && (!value.match(tokenPattern) || !supportedVariables.some(item => item.value === value.match(tokenPattern)?.[1])) && <p role="alert" className="text-xs text-destructive">{copy.invalidToken}</p>}
        </article>;
      })}
    </div>
    <aside className="space-y-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-4" data-testid={`${root}-summary`}>
      <div className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /><h4 className="text-sm font-semibold">{copy.summary}</h4></div>
      <div className="space-y-2 text-xs"><p><span className="font-semibold">{copy.targetSummary}: </span>{targetDescription}</p>
        <ul className="space-y-1.5">{Object.entries(fields).map(([key, value]) => <li key={key} className="flex flex-wrap gap-x-2">
          <span className="font-medium">{fieldLabel(key)}</span><span className="text-muted-foreground">→</span><span className={value === null ? "font-medium text-amber-800 dark:text-amber-200" : "text-foreground"}>{fieldMap.has(key) ? valueSummary(fieldMap.get(key)!, value) : copy.invalidField}</span>
        </li>)}</ul>
        {!Object.keys(fields).length && <p className="text-muted-foreground">{copy.empty}</p>}
      </div>
    </aside>
    <div className="space-y-2">
      <label className="flex cursor-pointer items-start gap-2 rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed transition-colors hover:bg-muted/40">
        <input type="checkbox" className="mt-0.5 accent-primary" checked={config.acknowledged === true} onChange={event => save({ acknowledged: event.target.checked }, false)} data-testid={`${root}-ack`} />
        <span>{copy.acknowledge}</span>
      </label>
      {clearCount > 0 && <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-300/70 bg-amber-50/60 p-3 text-xs leading-relaxed dark:bg-amber-950/20">
        <input type="checkbox" className="mt-0.5 accent-primary" checked={config.clearAcknowledged === true} onChange={event => save({ clearAcknowledged: event.target.checked }, false)} />
        <span>{copy.acknowledgeClear}</span>
      </label>}
    </div>
    {catalogQuery.isLoading && <div className="space-y-2 rounded-lg border bg-muted/20 p-3" aria-label={copy.loading}><div className="h-3 w-1/3 animate-pulse rounded bg-muted" /><div className="h-8 animate-pulse rounded bg-muted" /></div>}
    {catalogQuery.isError && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/25 bg-destructive/[0.045] px-3 py-2 text-xs text-destructive">
      <span>{copy.loadError}</span><Button type="button" size="sm" variant="outline" onClick={() => catalogQuery.refetch()}>{copy.retry}</Button>
    </div>}
    {invalid && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/[0.045] px-3 py-2 text-xs text-destructive">{copy.saveBlocked}</p>}
  </section>;
}
