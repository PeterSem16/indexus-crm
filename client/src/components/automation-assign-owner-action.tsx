import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, HelpCircle, Search, ShieldCheck, UserRound, X } from "lucide-react";
import { OWNER_STRATEGIES, assignOwnerIssues } from "@shared/automation-assign-owner";
import { UPDATE_RECORD_RELATIONS } from "@shared/automation-update-record";
import { useI18n } from "@/i18n";
import { getUpdateRecordCopy } from "@/i18n/automation-update-record-copy";
import { getAutomationAssignOwnerCopy } from "@/i18n/automation-assign-owner-copy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Target = {
  mode: "event" | "related" | "selected";
  entityType: string;
  relation?: string;
  recordId?: string;
};
type RecordOption = { id: string; label: string; secondary?: string; country?: string };
type UserOption = { id: string; label: string; secondary?: string; country?: string };
export type AutomationAssignOwnerActionProps = {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
  sourceModule: string;
  countryCodes: string[];
  index: number;
  onDraftValidityChange?: (invalid: boolean) => void;
  scheduleMode?: "once" | "per_record";
};

const ASSIGNABLE_TARGETS = ["task", "customer", "clinic", "hospital"] as const;
const REPRESENTATIVE_TARGETS = ["clinic", "hospital"] as const;

function interpolate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

function useRecordSearch(entityType: string, countries: string, query: string, enabled: boolean) {
  const [result, setResult] = useState<{ key: string; records: RecordOption[]; truncated: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const currentKey = `${entityType}|${countries}|${query.trim()}`;
  useEffect(() => {
    if (!enabled || !entityType || !query.trim()) {
      setResult(null);
      setLoading(false);
      setError(false);
      return;
    }
    let active = true;
    setResult(null);
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const params = new URLSearchParams({ entityType, q: query.trim(), countries });
        const response = await fetch(`/api/automation/update-record/records?${params}`, { credentials: "include" });
        if (!response.ok) throw new Error("record search");
        const data = await response.json();
        if (active) setResult({
          key: currentKey,
          records: Array.isArray(data.records) ? data.records.filter((record: any) => record?.id != null && record?.label)
            .map((record: any) => ({ ...record, id: String(record.id), label: String(record.label) })) : [],
          truncated: Boolean(data.truncated),
        });
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [entityType, countries, query, enabled, revision]);
  return {
    records: result?.key === currentKey ? result.records : undefined,
    truncated: result?.key === currentKey ? result.truncated : false,
    loading,
    error,
    retry: () => { setError(false); setResult(null); setRevision(value => value + 1); },
  };
}

function useUserSearch(entityType: string, countries: string, assignmentKind: string, query: string, enabled: boolean) {
  const [result, setResult] = useState<{ key: string; users: UserOption[]; truncated: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const currentKey = `${entityType}|${assignmentKind}|${countries}|${query.trim()}`;
  useEffect(() => {
    if (!enabled || !query.trim() || !(ASSIGNABLE_TARGETS as readonly string[]).includes(entityType)) {
      setResult(null);
      setLoading(false);
      setError(false);
      return;
    }
    let active = true;
    setResult(null);
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const params = new URLSearchParams({ entityType, assignmentKind, q: query.trim(), countries });
        const response = await fetch(`/api/automation/assign-owner/people?${params}`, { credentials: "include" });
        if (!response.ok) throw new Error("user search");
        const data = await response.json();
        if (active) setResult({
          key: currentKey,
          users: Array.isArray(data.options) ? data.options
            .filter((option: any) => option?.value != null && option?.label)
            .map((option: any) => ({ id: String(option.value), label: String(option.label) })) : [],
          truncated: Boolean(data.truncated),
        });
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [entityType, countries, assignmentKind, query, enabled, revision]);
  return {
    users: result?.key === currentKey ? result.users : undefined,
    truncated: result?.key === currentKey ? result.truncated : false,
    loading,
    error,
    retry: () => { setError(false); setResult(null); setRevision(value => value + 1); },
  };
}

export function AutomationAssignOwnerAction({
  config, onChange, sourceModule, countryCodes, index, onDraftValidityChange, scheduleMode,
}: AutomationAssignOwnerActionProps) {
  const { locale } = useI18n();
  const copy = getAutomationAssignOwnerCopy(locale);
  const updateCopy = getUpdateRecordCopy(locale);
  const root = `assign-owner-${index}`;
  const countries = countryCodes.map(code => code.toUpperCase()).join(",");
  const supportedSource = (ASSIGNABLE_TARGETS as readonly string[]).includes(sourceModule);
  const relations = useMemo(() => (UPDATE_RECORD_RELATIONS[sourceModule] || []).filter(relation =>
    relation.entityType === "dynamic" || (ASSIGNABLE_TARGETS as readonly string[]).includes(relation.entityType)), [sourceModule]);
  const isV2 = config.assignOwnerVersion === 2 && config.target && typeof config.target === "object";
  const hasLegacy = !isV2 && Object.values(config).some(value => value != null && value !== "" &&
    !(Array.isArray(value) && value.length === 0) &&
    !(typeof value === "object" && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length === 0));
  const defaultTarget = (): Target => {
    if (scheduleMode === "once") return { mode: "selected", entityType: "" };
    if (supportedSource) return { mode: "event", entityType: sourceModule };
    if (scheduleMode === "per_record" && relations[0]) return {
      mode: "related",
      relation: relations[0].key,
      entityType: relations[0].entityType === "dynamic" ? "" : relations[0].entityType,
    };
    return { mode: "selected", entityType: "" };
  };
  const target: Target = isV2 ? config.target as Target : defaultTarget();
  // An omitted assignmentKind on a reviewed v2 action is deliberately the legacy internal-owner mode.
  const assignmentKind = target.entityType === "clinic"
    ? "representative"
    : isV2
      ? (config.assignmentKind ?? "owner")
      : (REPRESENTATIVE_TARGETS as readonly string[]).includes(target.entityType) ? "representative" : "owner";
  const strategy = isV2 && OWNER_STRATEGIES.includes(config.strategy) ? config.strategy : "specific";
  const userIds: string[] = Array.isArray(config.userIds) ? config.userIds.map((id: unknown) => String(id)) : [];
  const replaceExisting = isV2 ? config.replaceExisting === true : false;
  const selectedRelation = relations.find(relation => relation.key === target.relation &&
    (relation.entityType === target.entityType || (relation.entityType === "dynamic" && (ASSIGNABLE_TARGETS as readonly string[]).includes(target.entityType))));
  const allowedTypes = ASSIGNABLE_TARGETS;
  const [recordSearch, setRecordSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [record, setRecord] = useState<RecordOption | null>(null);
  const [verifiedRecordScope, setVerifiedRecordScope] = useState("");
  const [verifiedUsers, setVerifiedUsers] = useState<Record<string, UserOption>>({});
  const [verifiedUsersScope, setVerifiedUsersScope] = useState("");
  const [verificationError, setVerificationError] = useState(false);
  const [legacyStarted, setLegacyStarted] = useState(false);
  const callbackRef = useRef(onDraftValidityChange);
  callbackRef.current = onDraftValidityChange;
  const previousScope = useRef(`${sourceModule}|${countries}|${scheduleMode || ""}`);
  const allowedModes = scheduleMode === "once" ? ["selected"] : scheduleMode === "per_record" ? ["event", "related"] : ["event", "related", "selected"];
  const userIdentity = userIds.join("\u001f");
  const recordScope = `${target.entityType}|${String(target.recordId || "")}|${sourceModule}|${countries}`;
  const selectedScope = `${target.entityType}|${assignmentKind}|${sourceModule}|${countries}`;
  const recordResults = useRecordSearch(target.entityType, countries, recordSearch, target.mode === "selected");
  const userResults = useUserSearch(target.entityType, countries, assignmentKind, userSearch, Boolean(userSearch.trim()));

  const entityLabel = (value: string) => (updateCopy.entity as Record<string, string>)[value] || value;
  const relationLabel = (key: string) => (updateCopy.relationLabel as Record<string, string>)[key] || key;
  const strategyLabel = (value: string) => copy[value as keyof typeof copy] || value;
  const targetValid = target.mode === "event"
    ? supportedSource && target.entityType === sourceModule && (ASSIGNABLE_TARGETS as readonly string[]).includes(sourceModule)
    : target.mode === "related"
      ? Boolean(selectedRelation && (ASSIGNABLE_TARGETS as readonly string[]).includes(target.entityType))
      : target.mode === "selected"
        ? Boolean(target.recordId && record?.id === String(target.recordId) && verifiedRecordScope === recordScope)
        : false;
  const scheduleModeInvalid = !allowedModes.includes(target.mode);
  const selectedUsersVerified = verifiedUsersScope === selectedScope && userIds.every(id => Boolean(verifiedUsers[id]));
  const countValid = strategy === "specific" ? userIds.length === 1 : userIds.length >= 1 && userIds.length <= 50;
  const userListValid = countValid && selectedUsersVerified && !verificationError;
  const targetSearchPending = target.mode === "selected" && Boolean(recordSearch.trim());
  const userSearchPending = Boolean(userSearch.trim());
  const issues = isV2 ? assignOwnerIssues(config, sourceModule) : ["version"];
  const invalid = hasLegacy || !isV2 || !targetValid || scheduleModeInvalid || !userListValid || targetSearchPending || userSearchPending ||
    Boolean(recordResults.loading || recordResults.error || userResults.loading || userResults.error) ||
    issues.length > 0 || config.acknowledged !== true;

  useEffect(() => { callbackRef.current?.(invalid); }, [invalid]);

  useEffect(() => {
    const scope = `${sourceModule}|${countries}|${scheduleMode || ""}`;
    if (previousScope.current === scope) return;
    previousScope.current = scope;
    setRecordSearch("");
    setUserSearch("");
    setRecord(null);
    setVerifiedRecordScope("");
    setVerifiedUsers({});
    setVerifiedUsersScope("");
    setVerificationError(false);
    if (config.assignOwnerVersion === 2 && config.acknowledged === true) onChange({ ...config, acknowledged: false });
  }, [sourceModule, countries, scheduleMode]);

  useEffect(() => {
    if (!isV2 || target.mode !== "selected" || !target.recordId || !target.entityType) {
      setRecord(null);
      setVerifiedRecordScope("");
      return;
    }
    const scope = `${target.entityType}|${String(target.recordId)}|${sourceModule}|${countries}`;
    let active = true;
    setRecord(null);
    setVerifiedRecordScope("");
    const params = new URLSearchParams({ entityType: target.entityType, id: String(target.recordId), countries });
    fetch(`/api/automation/update-record/record?${params}`, { credentials: "include" })
      .then(response => { if (!response.ok) throw new Error("record identity"); return response.json(); })
      .then(data => {
        if (active && data.record?.label && String(data.record.id) === String(target.recordId)) {
          setRecord({ ...data.record, id: String(data.record.id), label: String(data.record.label) });
          setVerifiedRecordScope(scope);
        }
      })
      .catch(() => { if (active) { setRecord(null); setVerifiedRecordScope(""); } });
    return () => { active = false; };
  }, [isV2, target.mode, target.entityType, target.recordId, sourceModule, countries]);

  useEffect(() => {
    if (!isV2 || !userIdentity) {
      setVerifiedUsers({});
      setVerifiedUsersScope("");
      setVerificationError(false);
      return;
    }
    let active = true;
    const scope = `${target.entityType}|${assignmentKind}|${sourceModule}|${countries}`;
    const ids = Array.from(new Set(userIds));
    setVerifiedUsers({});
    setVerifiedUsersScope("");
    setVerificationError(false);
    Promise.all(ids.map(async (id): Promise<{ id: string; user?: UserOption }> => {
      try {
        if (!(ASSIGNABLE_TARGETS as readonly string[]).includes(target.entityType)) throw new Error("assignment target");
        const params = new URLSearchParams({ entityType: target.entityType, assignmentKind, id, countries });
        const response = await fetch(`/api/automation/assign-owner/people?${params}`, { credentials: "include" });
        if (!response.ok) throw new Error("user identity");
        const data = await response.json();
        const option = Array.isArray(data.options) ? data.options.find((candidate: any) => String(candidate?.value) === id) : null;
        if (!option?.label) throw new Error("user identity");
        return { id, user: { id, label: String(option.label) } };
      } catch {
        return { id };
      }
    })).then(results => {
      if (active) {
        const verified: Record<string, UserOption> = {};
        results.forEach(result => { if (result.user) verified[result.id] = result.user; });
        setVerifiedUsers(verified);
        setVerifiedUsersScope(scope);
        setVerificationError(results.some(result => !result.user));
      }
    });
    return () => { active = false; };
  }, [isV2, userIdentity, target.entityType, assignmentKind, sourceModule, countries]);

  const save = (patch: Record<string, unknown>, resetAcknowledgment = true) => {
    const next: Record<string, any> = {
      ...config, assignOwnerVersion: 2, target: isV2 ? config.target : target,
      strategy, userIds, replaceExisting,
      ...(target.entityType === "clinic" ? { assignmentKind: "representative" } : !isV2 ? { assignmentKind } : {}),
      ...patch,
    };
    if (resetAcknowledgment) next.acknowledged = false;
    onChange(next);
  };
  const setTarget = (nextTarget: Target) => {
    setRecordSearch("");
    setRecord(null);
    setVerifiedRecordScope("");
    const nextKind = nextTarget.entityType === "clinic" ? "representative"
      : nextTarget.entityType === "hospital"
        ? (target.entityType === "hospital" ? assignmentKind : "representative")
        : "owner";
    save({ target: nextTarget, assignmentKind: nextKind });
  };
  const addUser = (candidate: UserOption) => {
    if (userIds.includes(candidate.id) || userIds.length >= 50) return;
    const nextIds = strategy === "specific" ? [candidate.id] : [...userIds, candidate.id];
    setVerifiedUsers(previous => ({ ...previous, [candidate.id]: candidate }));
    setVerifiedUsersScope(selectedScope);
    setUserSearch("");
    save({ userIds: nextIds });
  };
  const removeUser = (id: string) => {
    const nextIds = userIds.filter(value => value !== id);
    const nextUsers = { ...verifiedUsers };
    delete nextUsers[id];
    setVerifiedUsers(nextUsers);
    setVerifiedUsersScope(selectedScope);
    save({ userIds: nextIds });
  };
  const targetSummary = `${target.mode === "event"
    ? `${copy.event} · ${entityLabel(target.entityType)}`
    : target.mode === "related"
      ? `${copy.related} · ${relationLabel(target.relation || "")} · ${entityLabel(target.entityType)}`
      : `${copy.selected} · ${entityLabel(target.entityType)} · ${record?.label || copy.chooseRecord}${record?.secondary ? ` — ${record.secondary}` : ""} · ${copy.country}: ${record?.country || "—"}`} · ${assignmentKind === "representative" ? copy.businessRepresentative : copy.internalOwner}`;
  const recipientSummary = strategy === "specific"
    ? verifiedUsers[userIds[0]]?.label || copy.noneSelected
    : `${strategyLabel(strategy)} · ${userIds.map(id => verifiedUsers[id]?.label).filter(Boolean).join(", ") || copy.noneSelected}`;

  if (hasLegacy && !legacyStarted) return <section className="space-y-3 rounded-xl border border-amber-300/70 bg-amber-50/60 p-4 dark:bg-amber-950/20" data-testid={root}>
    <header className="flex items-start gap-3">
      <span className="rounded-lg bg-amber-100 p-2 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"><AlertCircle className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{copy.legacyTitle}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy.legacyHelp}</p></div>
    </header>
    <p className="text-xs leading-relaxed text-muted-foreground">{copy.legacyReviewHelp}</p>
    <Button type="button" variant="outline" data-testid={`${root}-legacy-review`} onClick={() => {
      onChange({
        assignOwnerVersion: 2,
          target: defaultTarget(),
          assignmentKind: (REPRESENTATIVE_TARGETS as readonly string[]).includes(defaultTarget().entityType) ? "representative" : "owner",
        strategy: "specific",
        userIds: [],
        replaceExisting: false,
        acknowledged: false,
      });
      setLegacyStarted(true);
    }}>{copy.legacyReview}</Button>
  </section>;

  return <section className="space-y-4 rounded-xl border bg-background/70 p-4 shadow-sm" data-testid={root} data-schedule-mode={scheduleMode || "default"}>
    <header className="flex items-start gap-3">
      <span className="rounded-lg bg-primary/10 p-2 text-primary"><ShieldCheck className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{copy.title}</h3><p className="text-xs leading-relaxed text-muted-foreground">{copy.description}</p></div>
      <Popover>
        <PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label={copy.helpTitle} className="h-8 w-8 shrink-0"><HelpCircle className="h-4 w-4" /></Button></PopoverTrigger>
        <PopoverContent align="end" className="z-[10050] w-[min(360px,calc(100vw-24px))] space-y-2 text-xs leading-relaxed">
          <h4 className="font-semibold">{copy.helpTitle}</h4>
          <p>{copy.helpWhat}</p><p>{copy.helpWhere}</p><p>{copy.helpWhen}</p><p>{copy.helpStrategies}</p>
          {assignmentKind === "owner" && target.entityType === "task" && <p>{copy.helpLimits}</p>}
        </PopoverContent>
      </Popover>
    </header>

    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label>{copy.target}</Label>
        <Select value={target.mode} onValueChange={(mode: Target["mode"]) => {
          const relation = relations[0];
          if (mode === "event") setTarget({ mode, entityType: sourceModule });
          else if (mode === "related") setTarget({
            mode, relation: relation?.key,
            entityType: relation?.entityType === "dynamic" ? "" : relation?.entityType || "",
          });
          else setTarget({ mode, entityType: "" });
        }}>
          <SelectTrigger data-testid={`${root}-mode`}><SelectValue>{target.mode === "event" ? copy.event : target.mode === "related" ? copy.related : copy.selected}</SelectValue></SelectTrigger>
          <SelectContent>
            {allowedModes.includes("event") && <SelectItem value="event">{copy.event}</SelectItem>}
            {allowedModes.includes("related") && <SelectItem value="related">{copy.related}</SelectItem>}
            {allowedModes.includes("selected") && <SelectItem value="selected">{copy.selected}</SelectItem>}
          </SelectContent>
        </Select>
      </div>
      {scheduleModeInvalid && <p role="alert" className="text-xs text-destructive sm:col-span-2">{copy.scheduleMode}</p>}
      {target.mode === "event" && <div className="space-y-1.5 sm:col-span-2">
        <Label>{copy.recordType}</Label>
        <div className="flex h-10 items-center rounded-md border bg-muted/35 px-3 text-sm">{entityLabel(sourceModule)}</div>
        <p className="text-xs text-muted-foreground">{copy.eventHelp}</p>
        {!supportedSource && <p role="alert" className="text-xs text-destructive">{copy.invalidEvent}</p>}
      </div>}
      {target.entityType === "hospital" && <div className="space-y-1.5 sm:col-span-2">
        <Label>{copy.assignmentKind}</Label>
        <Select value={assignmentKind} onValueChange={value => save({ assignmentKind: value })}>
          <SelectTrigger data-testid={`${root}-kind`}><SelectValue>{assignmentKind === "representative" ? copy.businessRepresentative : copy.internalOwner}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="representative">{copy.businessRepresentative}</SelectItem>
            <SelectItem value="owner">{copy.internalOwner}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs leading-relaxed text-muted-foreground">{copy.hospitalKindHelp}</p>
      </div>}
      {target.entityType === "clinic" && <div className="space-y-1.5 sm:col-span-2">
        <Label>{copy.assignmentKind}</Label>
        <div className="flex h-10 items-center rounded-md border bg-muted/35 px-3 text-sm">{copy.businessRepresentative}</div>
        <p className="text-xs leading-relaxed text-muted-foreground">{copy.clinicKindHelp}</p>
      </div>}
      {target.mode === "related" && <div className="space-y-2 sm:col-span-2">
        <Label>{copy.relationship}</Label>
        <Select value={target.relation || ""} onValueChange={key => {
          const relation = relations.find(item => item.key === key);
          setTarget({ mode: "related", relation: key, entityType: relation?.entityType === "dynamic" ? "" : relation?.entityType || "" });
        }}>
          <SelectTrigger><SelectValue placeholder={copy.chooseRelationship}>{relationLabel(target.relation || "")}</SelectValue></SelectTrigger>
          <SelectContent>{relations.map(relation => <SelectItem key={relation.key} value={relation.key}>{relationLabel(relation.key)}</SelectItem>)}</SelectContent>
        </Select>
        {selectedRelation?.entityType === "dynamic" && <div className="space-y-1.5">
          <Label>{copy.recordType}</Label>
          <Select value={target.entityType || ""} onValueChange={entityType => setTarget({ ...target, entityType })}>
            <SelectTrigger data-testid={`${root}-type`}><SelectValue placeholder={copy.recordType}>{target.entityType ? entityLabel(target.entityType) : copy.recordType}</SelectValue></SelectTrigger>
            <SelectContent>{allowedTypes.map(type => <SelectItem key={type} value={type}>{entityLabel(type)}</SelectItem>)}</SelectContent>
          </Select>
        </div>}
        {!relations.length && <p role="status" className="text-xs text-muted-foreground">{copy.noRelationships}</p>}
        <p className="text-xs text-muted-foreground">{copy.relatedHelp}</p>
      </div>}
      {target.mode === "selected" && <div className="space-y-2 sm:col-span-2">
        <Label>{copy.recordType}</Label>
        <Select value={target.entityType || ""} onValueChange={entityType => setTarget({ mode: "selected", entityType })}>
          <SelectTrigger data-testid={`${root}-type`}><SelectValue placeholder={copy.recordType}>{target.entityType ? entityLabel(target.entityType) : copy.recordType}</SelectValue></SelectTrigger>
          <SelectContent>{allowedTypes.map(type => <SelectItem key={type} value={type}>{entityLabel(type)}</SelectItem>)}</SelectContent>
        </Select>
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={record?.label && !recordSearch ? record.label : recordSearch} placeholder={copy.searchRecord}
            disabled={!target.entityType} className="pl-9" data-testid={`${root}-record-search`}
            onChange={event => { setRecordSearch(event.target.value); setRecord(null); setVerifiedRecordScope(""); }} />
        </div>
        {recordResults.loading && <p className="text-xs text-muted-foreground">{copy.loading}</p>}
        {recordResults.error && <button type="button" role="alert" className="text-xs text-destructive underline" onClick={recordResults.retry}>{copy.loadError} {copy.retrySearch}</button>}
        {recordResults.records && <div className="max-h-40 overflow-auto rounded-lg border bg-background p-1">
          {recordResults.records.map(item => <button type="button" key={item.id} data-testid={`${root}-record-${item.id}`}
            className="flex w-full flex-col rounded-md px-3 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => {
              setRecord(item); setVerifiedRecordScope(`${target.entityType}|${item.id}|${sourceModule}|${countries}`);
              setRecordSearch("");
              save({ target: { mode: "selected", entityType: target.entityType, recordId: item.id } });
            }}>
            <span className="text-sm font-medium">{item.label}</span>
            {(item.secondary || item.country) && <span className="text-xs text-muted-foreground">{[item.secondary, item.country].filter(Boolean).join(" · ")}</span>}
          </button>)}
          {!recordResults.records.length && <p className="px-3 py-2 text-xs text-muted-foreground">{copy.noResults}</p>}
        </div>}
        {recordResults.truncated && <p className="text-xs text-muted-foreground">{copy.truncated}</p>}
        {record && target.recordId === record.id && <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{record.label}</span>{record.secondary && <span className="text-muted-foreground"> · {record.secondary}</span>}
          <span className="text-muted-foreground"> · {copy.country}: {record.country || "—"}</span>
        </div>}
        <p className="text-xs text-muted-foreground">{copy.selectedHelp} {copy.selectedTargetHint}</p>
      </div>}
    </div>

    <div className="space-y-2">
      <Label>{copy.strategy}</Label>
      <Select value={strategy} onValueChange={value => save({ strategy: value })}>
        <SelectTrigger data-testid={`${root}-strategy`}><SelectValue>{strategyLabel(strategy)}</SelectValue></SelectTrigger>
        <SelectContent>{OWNER_STRATEGIES.map(value => <SelectItem key={value} value={value}>{strategyLabel(value)}</SelectItem>)}</SelectContent>
      </Select>
      <p className="text-xs leading-relaxed text-muted-foreground">{assignmentKind === "representative" && strategy === "least_loaded"
        ? interpolate(copy.leastLoadedRepresentativeHelp, { type: entityLabel(target.entityType) })
        : copy[`${strategy}Help` as keyof typeof copy]}</p>
    </div>

    <div className="space-y-2 rounded-lg border border-border/80 bg-muted/15 p-3">
      <div className="flex items-start gap-2">
        <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1"><Label>{assignmentKind === "representative" ? copy.representatives : copy.users}</Label><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{assignmentKind === "representative" ? copy.representativePoolHelp : copy.poolHelp}</p></div>
        <Badge variant="secondary" className="shrink-0">{interpolate(copy.poolCount, { count: userIds.length })}</Badge>
      </div>
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={userSearch} placeholder={copy.userSearch} className="pl-9" data-testid={`${root}-user-search`}
          onChange={event => setUserSearch(event.target.value)} />
      </div>
      {userResults.loading && <p className="text-xs text-muted-foreground">{copy.loading}</p>}
      {userResults.error && <button type="button" role="alert" className="text-xs text-destructive underline" onClick={userResults.retry}>{copy.ownerLoadError} {copy.retry}</button>}
      {userResults.users && <div className="max-h-40 overflow-auto rounded-lg border bg-background p-1">
        {userResults.users.filter(user => !userIds.includes(user.id)).map(user => <button type="button" key={user.id}
          data-testid={`${root}-user-${user.id}`}
          className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => addUser(user)}>
          <span className="min-w-0"><span className="block truncate text-sm font-medium">{user.label}</span>{user.secondary && <span className="block truncate text-xs text-muted-foreground">{user.secondary}</span>}</span>
          <span className="shrink-0 text-xs font-medium text-primary">{copy.addPerson}</span>
        </button>)}
        {!userResults.users.filter(user => !userIds.includes(user.id)).length && <p className="px-3 py-2 text-xs text-muted-foreground">{copy.noPeople}</p>}
      </div>}
      {userResults.truncated && <p className="text-xs text-muted-foreground">{copy.truncated}</p>}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-muted-foreground">{copy.currentPool}</p>
        {userIds.length ? <div className="flex flex-wrap gap-1.5">{userIds.map(id => {
          const person = verifiedUsers[id];
          return <Badge key={id} variant="secondary" className="max-w-full gap-1.5 py-1">
            <span className="max-w-[min(55vw,260px)] truncate">{person?.label || (verifiedUsersScope === selectedScope ? copy.inaccessibleUser : copy.loading)}</span>
            <button type="button" aria-label={`${copy.removePerson}: ${person?.label || copy.person}`}
              data-testid={`${root}-remove-user-${id}`} className="rounded-full hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => removeUser(id)}><X className="h-3 w-3" /></button>
          </Badge>;
        })}</div> : <p className="text-xs text-muted-foreground">{copy.noneSelected}</p>}
      </div>
      {userSearchPending && <p role="status" className="text-xs text-amber-800 dark:text-amber-300">{copy.pendingSearch}</p>}
      {verificationError && <p role="alert" className="text-xs text-destructive">{copy.inaccessibleUser}</p>}
      {strategy !== "specific" && !userIds.length && <p className="text-xs text-muted-foreground">{copy.noPool}</p>}
    </div>

    <label className="flex cursor-pointer items-start gap-2 rounded-lg border bg-muted/15 p-3 text-sm">
      <input type="checkbox" className="mt-0.5 accent-primary" data-testid={`${root}-replace`} checked={replaceExisting}
        onChange={event => save({ replaceExisting: event.target.checked })} />
      <span><span className="block text-sm font-medium">{assignmentKind === "representative" ? copy.replaceRep : copy.replace}</span><span className="block text-xs leading-relaxed text-muted-foreground">{assignmentKind === "representative" ? copy.replaceRepHelp : copy.replaceHelp}</span></span>
    </label>

    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/[0.035] p-3">
      <h4 className="text-xs font-semibold">{copy.summary}</h4>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="min-w-0"><dt className="text-xs text-muted-foreground">{copy.targetSummary}</dt><dd className="mt-0.5 break-words font-medium">{targetSummary}</dd></div>
        <div className="min-w-0"><dt className="text-xs text-muted-foreground">{copy.recipientSummary}</dt><dd className="mt-0.5 break-words font-medium">{recipientSummary}</dd></div>
      </dl>
      <p className="text-xs font-medium leading-relaxed">{assignmentKind === "representative"
        ? (replaceExisting ? copy.replaceRepOutcome : copy.preserveRepOutcome)
        : (replaceExisting ? copy.replaceOutcome : copy.preserveOutcome)}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{copy.helpWhat}</p>
      <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed">
        <input type="checkbox" className="mt-0.5 accent-primary" data-testid={`${root}-ack`} checked={config.acknowledged === true}
          onChange={event => save({ acknowledged: event.target.checked }, false)} />
        <span>{copy.acknowledgment}</span>
      </label>
    </div>
    {(!targetValid || scheduleModeInvalid || !userListValid || targetSearchPending || userSearchPending || issues.some(issue => issue !== "acknowledgment")) && <p role="alert" className="text-xs text-destructive">
      {scheduleModeInvalid ? copy.scheduleMode : !targetValid ? copy.invalidTarget : !userListValid ? copy.invalidUsers : targetSearchPending || userSearchPending ? copy.pendingSearch : copy.invalidUsers}
    </p>}
    {config.acknowledged !== true && <p className="text-xs text-muted-foreground">{copy.acknowledgeRequired}</p>}
  </section>;
}
