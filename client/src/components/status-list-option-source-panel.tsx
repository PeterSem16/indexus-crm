import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowRight, Plus, RefreshCw, Trash2, Pencil, Info } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Locale } from "@/i18n";
import type { WorkflowCatalogItem } from "@shared/status-list-workflow";
import type { OptionSource, OptionSourceConfig, ReachabilityPolicy } from "@shared/status-list-option-source";
import { defaultReachabilityPolicy } from "@shared/status-list-option-source";
import { isStatusListSourceGroup } from "@shared/status-list-source-group";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { getStatusListOptionSourceCopy } from "./status-list-option-source-copy";

type Coordinator = { id: string; name: string };
type SourceResponse = { sources: OptionSource[]; catalog: WorkflowCatalogItem[]; coordinators: Coordinator[] };
type SourceKind = OptionSourceConfig["source"];
type UserMapping = { userId: string; optionId: string };

const reachabilityKeys = ["not_defined", "waiting", "unreachable", "reachable"] as const;
const coordinatorKeys = ["unassigned", "assigned"] as const;
const sourceKeys: Record<SourceKind, readonly string[]> = {
  reachability: reachabilityKeys,
  coordinator: coordinatorKeys,
};
export const isOptionGroup = (item: WorkflowCatalogItem | undefined, catalog: WorkflowCatalogItem[]) => {
  if (!item || item.kind !== "item") return false;
  const children = catalog.filter(child => child.parentId === item.id);
  if (!isStatusListSourceGroup(item, children)) return false;
  if (catalog.some(child => children.some(parent => child.parentId === parent.id))) return false;
  return !catalog.some(candidate => candidate.kind === "question" && (() => {
    let parentId = candidate.parentId;
    const seen = new Set<string>();
    while (parentId && !seen.has(parentId)) {
      if (parentId === item.id) return true;
      seen.add(parentId);
      parentId = catalog.find(node => node.id === parentId)?.parentId;
    }
    return false;
  })());
};

export function StatusListOptionSourcePanel({ campaignId, locale, targetGroupId }: { campaignId: string; locale: Locale | string; targetGroupId?: string }) {
  const copy = getStatusListOptionSourceCopy(locale);
  const { toast } = useToast();
  const endpoint = `/api/campaigns/${campaignId}/status-list-workflows/option-sources`;
  const queryKey = [endpoint];
  const catalogQueryKey = ["/api/campaigns", campaignId, "status-list-workflows"];
  const query = useQuery<SourceResponse>({
    queryKey,
    queryFn: async () => {
      const response = await fetch(endpoint, { credentials: "include" });
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    },
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [sourceKind, setSourceKind] = useState<SourceKind>("reachability");
  const [hidden, setHidden] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [policy, setPolicy] = useState<ReachabilityPolicy>({ ...defaultReachabilityPolicy });
  const [users, setUsers] = useState<UserMapping[]>([]);

  const sources = (query.data?.sources || []).filter(entry => !targetGroupId || entry.groupId === targetGroupId);
  const catalog = query.data?.catalog || [];
  const coordinators = query.data?.coordinators || [];
  const groups = useMemo(() => catalog.filter(item => (!targetGroupId || item.id === targetGroupId) && isOptionGroup(item, catalog)), [catalog, targetGroupId]);
  const childrenFor = (id: string) => catalog.filter(item =>
    item.kind === "item" && item.parentId === id
  );
  const requiredCount = sourceKind === "reachability" ? 4 : 2;
  const eligibleGroups = groups.filter(group =>
    childrenFor(group.id).length >= 2 &&
    (!sources.some(item => item.groupId === group.id) || editing === group.id)
  );
  const mappedValues = sourceKeys[sourceKind].map(key => mapping[key] || "");
  const hasDistinctCompleteMapping = mappedValues.every(Boolean) && new Set(mappedValues).size === mappedValues.length &&
    mappedValues.every(value => childrenFor(groupId).some(option => option.id === value));
  const duplicateUsers = new Set(users.map(user => user.userId).filter(Boolean)).size !== users.filter(user => user.userId).length;
  const validUsers = users.every(user => user.userId && user.optionId && childrenFor(groupId).some(option => option.id === user.optionId));
  const channelSelected = policy.calls || policy.email || policy.sms;
  const canSave = !!groupId && hasDistinctCompleteMapping && !duplicateUsers && validUsers &&
    (sourceKind === "coordinator" || channelSelected);

  function reset() {
    setFormOpen(false);
    setEditing(null);
    setGroupId("");
    setSourceKind("reachability");
    setHidden(false);
    setMapping({});
    setPolicy({ ...defaultReachabilityPolicy });
    setUsers([]);
  }

  function startCreate() {
    reset();
    setEditing(null);
    if (targetGroupId) {
      selectGroup(targetGroupId);
      setHidden(!!catalog.find(item => item.id === targetGroupId)?.hidden);
    }
    setFormOpen(true);
  }

  function beginEdit(entry: OptionSource) {
    setFormOpen(true);
    setEditing(entry.groupId);
    setGroupId(entry.groupId);
    setSourceKind(entry.source);
    setHidden(entry.hidden);
    setMapping({ ...entry.mapping });
    if (entry.source === "reachability") {
      setPolicy({ ...entry.policy });
      setUsers([]);
    } else {
      setPolicy({ ...defaultReachabilityPolicy });
      setUsers(entry.users.map(user => ({ ...user })));
    }
  }

  function selectGroup(next: string) {
    setGroupId(next);
    setMapping({});
    setUsers([]);
  }

  function changeSource(next: SourceKind) {
    setSourceKind(next);
    setMapping({});
    setUsers([]);
  }

  const loadedContext = useRef("");
  useEffect(() => {
    if (!targetGroupId || !query.data) return;
    const entry = query.data.sources.find(source => source.groupId === targetGroupId);
    const identity = `${targetGroupId}:${JSON.stringify(entry || null)}`;
    if (loadedContext.current === identity) return;
    loadedContext.current = identity;
    if (entry) beginEdit(entry);
    else reset();
  }, [targetGroupId, query.data]);

  const saveMutation = useMutation({
    mutationFn: async ({ id, config }: { id: string; config: OptionSourceConfig }) => {
      const response = await fetch(`${endpoint}/${encodeURIComponent(id)}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error(String(response.status));
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: catalogQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] }),
      ]);
      toast({ title: copy.saved });
      reset();
    },
    onError: () => toast({ title: copy.saveError, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error(String(response.status));
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: catalogQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] }),
      ]);
      toast({ title: copy.deleted });
      reset();
    },
    onError: () => toast({ title: copy.deleteError, variant: "destructive" }),
  });
  const waitingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${endpoint}/${encodeURIComponent(groupId)}/waiting-option`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: copy.waiting }),
      });
      if (!response.ok) throw new Error(String(response.status));
      return response.json() as Promise<{ id: string }>;
    },
    onSuccess: async row => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: catalogQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] }),
      ]);
      setMapping(previous => ({ ...previous, waiting: row.id }));
    },
    onError: () => toast({ title: copy.saveError, variant: "destructive" }),
  });
  const isBusy = saveMutation.isPending || deleteMutation.isPending || waitingMutation.isPending;

  function submit() {
    if (!canSave) return;
    let config: OptionSourceConfig;
    if (sourceKind === "reachability") {
      config = { source: sourceKind, hidden, mapping: mapping as Record<typeof reachabilityKeys[number], string>, policy };
    } else {
      config = { source: sourceKind, hidden, mapping: mapping as Record<typeof coordinatorKeys[number], string>, users };
    }
    saveMutation.mutate({ id: groupId, config });
  }

  const optionSelect = (key: string, label: string) => {
    const current = mapping[key] || "";
    const childOptions = childrenFor(groupId);
    return <label key={key} className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <select data-testid={`option-source-map-${key}`} className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        value={current} disabled={!groupId || isBusy}
        onChange={event => setMapping(previous => ({ ...previous, [key]: event.target.value }))}>
        <option value="">{copy.option}</option>
        {childOptions.map(option => <option key={option.id} value={option.id} disabled={Object.entries(mapping).some(([otherKey, value]) => otherKey !== key && value === option.id)}>{option.label}</option>)}
      </select>
    </label>;
  };

  return <section className="mt-4 rounded-xl border border-border/70 bg-background/65 p-3" data-testid="status-list-option-source-panel">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-sm font-semibold">{copy.title}</h3><p className="mt-1 max-w-3xl text-xs text-muted-foreground">{copy.subtitle}</p></div>
      {!editing && <Button type="button" size="sm" variant="outline" onClick={startCreate}
        disabled={query.isLoading || query.isFetching || query.isError || !eligibleGroups.length}>
        <Plus className="mr-1.5 h-3.5 w-3.5"/>{copy.add}
      </Button>}
    </header>

    {query.isLoading && <div className="mt-3 flex items-center gap-3 rounded-lg bg-muted/45 p-3" data-testid="option-source-loading">
      <div className="h-8 w-8 animate-pulse rounded-md bg-muted"/><div className="flex-1 space-y-2"><div className="h-3 w-2/5 animate-pulse rounded bg-muted"/><div className="h-3 w-3/5 animate-pulse rounded bg-muted"/></div>
      <span className="sr-only">{copy.loading}</span>
    </div>}
    {query.isError && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm">
      <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4"/>{copy.loadError}</span>
      <Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}><RefreshCw className="mr-1.5 h-3.5 w-3.5"/>{copy.retry}</Button>
    </div>}
    {query.data && !sources.length && !editing && <p className="mt-3 rounded-lg bg-muted/45 p-3 text-sm text-muted-foreground">{copy.none}</p>}
    {!!sources.length && <div className="mt-3 space-y-2">{sources.map(entry => {
      const group = catalog.find(item => item.kind === "item" && item.id === entry.groupId);
      return <div key={entry.groupId} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2">
        <div className="min-w-0 w-full sm:w-auto sm:flex-1">
          <strong className="block break-words text-sm">{group?.label || entry.groupId}</strong>
          <span className="text-xs text-muted-foreground">{entry.source === "reachability" ? copy.configuredReachability : copy.configuredCoordinator}{entry.hidden ? ` · ${copy.hidden}` : ""}</span>
        </div>
        <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">{copy.readonly}</span>
        <Button type="button" size="icon" variant="ghost" aria-label={copy.edit} onClick={() => beginEdit(entry)} disabled={isBusy}><Pencil className="h-4 w-4"/></Button>
        <Button type="button" size="icon" variant="ghost" aria-label={copy.remove} disabled={isBusy}
          onClick={() => { if (window.confirm(copy.confirmRemove)) deleteMutation.mutate(entry.groupId); }}><Trash2 className="h-4 w-4"/></Button>
      </div>;
    })}</div>}

    {formOpen && <div className="mt-3 rounded-lg border border-primary/20 bg-primary/[0.035] p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          <span>{copy.group}</span>
          <select data-testid="option-source-group" className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            value={groupId} disabled={editing !== null || isBusy} onChange={event => selectGroup(event.target.value)}>
            <option value="">{copy.chooseGroup}</option>
            {eligibleGroups.map(group => <option key={group.id} value={group.id}>{group.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          <span>{copy.source}</span>
          <select data-testid="option-source-kind" className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            value={sourceKind} disabled={isBusy} onChange={event => changeSource(event.target.value as SourceKind)}>
            <option value="reachability">{copy.reachability}</option><option value="coordinator">{copy.coordinator}</option>
          </select>
        </label>
      </div>
      {!eligibleGroups.length && editing === null && <p className="mt-2 text-xs text-muted-foreground">{copy.noOptions}</p>}
      {groupId && childrenFor(groupId).length < requiredCount && <p className="mt-2 text-xs text-destructive">{copy.wrongGroup.replace("{count}", String(requiredCount))}</p>}
      {sourceKind === "reachability" && groupId && childrenFor(groupId).length === 3 && editing === null &&
        <Button type="button" size="sm" variant="outline" className="mt-2" data-testid="option-source-add-waiting"
          disabled={waitingMutation.isPending} onClick={() => { if (window.confirm(copy.addWaiting)) waitingMutation.mutate(); }}>
          <Plus className="mr-1.5 h-3.5 w-3.5"/>{copy.addWaiting}
        </Button>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {sourceKeys[sourceKind].map(key => optionSelect(key, copy[key as keyof typeof copy]))}
      </div>
      {!hasDistinctCompleteMapping && groupId && <p className="mt-2 text-xs text-destructive">{copy.mappingRequired}</p>}

      {sourceKind === "reachability" ? <div className="mt-4 space-y-3 border-t border-border/60 pt-3">
        <fieldset>
          <legend className="mb-2 text-xs font-semibold">{copy.channels}</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {(["calls", "email", "sms"] as const).map(channel => <label key={channel} className="flex items-center gap-2 text-sm">
              <input data-testid={`option-source-policy-${channel}`} type="checkbox" className="h-4 w-4 accent-primary" checked={policy[channel]} disabled={isBusy}
                onChange={event => setPolicy(previous => ({ ...previous, [channel]: event.target.checked }))}/>
              {copy[channel]}
            </label>)}
          </div>
          {!channelSelected && <p className="mt-1 text-xs text-destructive">{copy.channelRequired}</p>}
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ["failedAttempts", 1, 100], ["replyWaitHours", 1, 720],
            ["minimumTalkSeconds", 1, 600], ["successValidDays", 0, 3650],
          ] as const).map(([field, min, max]) => <label key={field} className="grid gap-1 text-xs font-medium text-muted-foreground">
            <span>{copy[field]}</span>
            <input data-testid={`option-source-policy-${field}`} type="number" min={min} max={max} step="1" value={policy[field]} disabled={isBusy}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              onChange={event => setPolicy(previous => ({ ...previous, [field]: Math.max(min, Math.min(max, Number(event.target.value) || min)) }))}/>
          </label>)}
        </div>
        <p className="text-xs text-muted-foreground">{copy.neverExpires}</p>
      </div> : <div className="mt-4 space-y-3 border-t border-border/60 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h4 className="text-xs font-semibold">{copy.coordinators}</h4><p className="mt-1 text-xs text-muted-foreground">{copy.fallback}</p></div>
          <Button type="button" size="sm" variant="outline" disabled={isBusy || users.length >= 100 || !coordinators.some(coordinator => !users.some(user => user.userId === coordinator.id))}
            onClick={() => setUsers(previous => [...previous, { userId: "", optionId: "" }])}><Plus className="mr-1.5 h-3.5 w-3.5"/>{copy.addCoordinator}</Button>
        </div>
        {!coordinators.length && <p className="text-xs text-muted-foreground">{copy.noCoordinators}</p>}
        {users.map((user, index) => <div key={`${user.userId}-${index}`} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            <span>{copy.userMappingLabel}</span>
            <select data-testid={`option-source-user-${index}`} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              value={user.userId} disabled={isBusy} onChange={event => setUsers(previous => previous.map((entry, row) => row === index ? { ...entry, userId: event.target.value } : entry))}>
              <option value="">{copy.chooseCoordinator}</option>{coordinators.map(coordinator => <option key={coordinator.id} value={coordinator.id}
                disabled={users.some((entry, row) => row !== index && entry.userId === coordinator.id)}>{coordinator.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            <span>{copy.option}</span>
            <select data-testid={`option-source-user-option-${index}`} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              value={user.optionId} disabled={!groupId || isBusy}
              onChange={event => setUsers(previous => previous.map((entry, row) => row === index ? { ...entry, optionId: event.target.value } : entry))}>
              <option value="">{copy.option}</option>
              {childrenFor(groupId).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <Button type="button" size="icon" variant="ghost" aria-label={copy.removeMapping} disabled={isBusy}
            onClick={() => setUsers(previous => previous.filter((_, row) => row !== index))}><Trash2 className="h-4 w-4"/></Button>
        </div>)}
        {duplicateUsers && <p className="text-xs text-destructive">{copy.coordinatorDuplicate}</p>}
      </div>}

      <label className="mt-3 flex items-center gap-2 text-sm"><Switch checked={hidden} disabled={isBusy} onCheckedChange={setHidden}/>{copy.hidden}</label>
      <div className="mt-3 rounded-lg border border-primary/15 bg-primary/[0.025] p-3">
        <p className="flex items-center gap-2 text-xs font-semibold"><Info className="h-3.5 w-3.5"/>{copy.communicationTitle}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy.communication}</p>
        <p className="mt-2 border-l-2 border-primary/35 pl-2.5 text-xs leading-relaxed text-muted-foreground">{copy.baseline}</p>
        {sourceKind === "coordinator" && <p className="mt-2 text-xs text-muted-foreground">{copy.coordinatorNote}</p>}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={reset} disabled={isBusy}>{copy.cancel}</Button>
        <Button type="button" size="sm" onClick={submit} disabled={!canSave || isBusy}>{saveMutation.isPending ? copy.saving : copy.save}<ArrowRight className="ml-1.5 h-3.5 w-3.5"/></Button>
      </div>
    </div>}
  </section>;
}
