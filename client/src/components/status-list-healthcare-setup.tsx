import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, Plus, PhoneCall } from "lucide-react";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { healthcarePolicySchema } from "@shared/status-list-healthcare";
import type { OptionSource } from "@shared/status-list-option-source";
import type { WorkflowCatalogItem } from "@shared/status-list-workflow";
import { getHealthcareCopy } from "./status-list-healthcare-copy";
import { StatusListHealthcareSourceSettings } from "./status-list-healthcare-source-settings";

type HealthcareSource = Extract<OptionSource, { source: "healthcare_reachability" }>;
type SourceResponse = { sources: OptionSource[]; catalog: WorkflowCatalogItem[] };

export function StatusListHealthcareSetup({
  campaignId, locale, targetGroupId, onDirtyChange,
}: {
  campaignId: string; locale: string; targetGroupId?: string; onDirtyChange?: (dirty: boolean) => void;
}) {
  const c = getHealthcareCopy(locale);
  const { toast } = useToast();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [dirtyGroups, setDirtyGroups] = useState<Map<string, boolean>>(() => new Map());
  const dirtyHandlers = useRef(new Map<string, (dirty: boolean) => void>());
  const endpoint = `/api/campaigns/${encodeURIComponent(campaignId)}/status-list-workflows`;
  const optionSourcesPath = `${endpoint}/option-sources`;
  const query = useQuery<SourceResponse>({
    queryKey: [optionSourcesPath],
    queryFn: async () => {
      const response = await fetch(optionSourcesPath, { credentials: "include" });
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    },
  });
  const create = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${endpoint}/healthcare`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (!response.ok) throw new Error(String(response.status));
      return response.json() as Promise<{ groupId: string }>;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [optionSourcesPath] }),
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list-workflows"] }),
      ]);
    },
    onError: () => toast({ title: c.error, variant: "destructive" }),
  });
  const allSources = (query.data?.sources || []).filter((source): source is HealthcareSource =>
    source.source === "healthcare_reachability");
  const matchingSources = allSources.filter((source): source is HealthcareSource =>
    !targetGroupId || source.groupId === targetGroupId || Object.values(source.mapping).includes(targetGroupId));
  // Existing older three-answer groups are separate definitions. Keep their
  // Mission's seven-state settings accessible, without silently remapping them.
  const sources = matchingSources.length ? matchingSources : allSources;
  const targeted = !!targetGroupId && matchingSources.length > 0;
  const catalogById = new Map((query.data?.catalog || []).map(item => [item.id, item]));
  const reportDirty = (groupId: string) => {
    let handler = dirtyHandlers.current.get(groupId);
    if (!handler) {
      handler = dirty => setDirtyGroups(current => {
        const next = new Map(current);
        if (dirty) next.set(groupId, true); else next.delete(groupId);
        return next;
      });
      dirtyHandlers.current.set(groupId, handler);
    }
    return handler;
  };
  useEffect(() => {
    onDirtyChange?.(Array.from(dirtyGroups.values()).some(Boolean));
  }, [dirtyGroups, onDirtyChange]);
  if (targetGroupId && !sources.length && !query.isLoading && !query.isError) return null;
  return <section className="mb-4 space-y-3 rounded-xl border border-border bg-muted/20 p-3" data-testid="healthcare-source-setup">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <PhoneCall className="h-4 w-4 text-primary"/>{c.title}
      </h4>
      {!targetGroupId && !allSources.length && <Button type="button" size="sm" variant="outline" data-testid="create-healthcare-source"
        disabled={create.isPending || query.isLoading || query.isError} onClick={() => create.mutate()}>
        <Plus className="mr-1 h-3.5 w-3.5"/>{c.create}
      </Button>}
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">{c.sourceHelp}</p>
    {query.isLoading && <div role="status" aria-label={c.loading} className="grid gap-2 sm:grid-cols-2">
      {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-16 animate-pulse rounded-md bg-muted/60"/>)}
    </div>}
    {query.isError && <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-destructive">
      <span>{c.error}</span><Button type="button" size="sm" variant="outline" onClick={() => query.refetch()}>{c.retryAction}</Button>
    </div>}
    {create.isError && <p role="alert" className="text-xs text-destructive">{c.error}</p>}
    {sources.map((source, index) => {
      const policy = healthcarePolicySchema.parse(source.policy || {});
      const expanded = targeted || expandedGroups.has(source.groupId);
      const label = catalogById.get(source.groupId)?.label || source.groupId;
      return <div key={source.groupId} className="rounded-lg border bg-background p-3" data-testid="healthcare-configured-source">
        <button type="button" aria-expanded={expanded} aria-controls={`healthcare-source-${source.groupId}`} disabled={targeted}
          onClick={() => setExpandedGroups(current => {
            const next = new Set(current);
            if (next.has(source.groupId)) next.delete(source.groupId); else next.add(source.groupId);
            return next;
          })}
          className="flex w-full items-center justify-between gap-3 text-left">
          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <PhoneCall className="h-4 w-4 shrink-0 text-primary"/>
            <span className="min-w-0 break-words">{label}{sources.filter(entry => (catalogById.get(entry.groupId)?.label || entry.groupId) === label).length > 1 ? ` · ${index + 1}` : ""}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{c.title}</span>
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}/>
        </button>
        <div id={`healthcare-source-${source.groupId}`} hidden={!expanded} className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">{c.summary}</p>
          <StatusListHealthcareSourceSettings campaignId={campaignId} locale={locale} source={{ ...source, policy }}
            onDirtyChange={reportDirty(source.groupId)}/>
        </div>
      </div>;
    })}
    {!targetGroupId && !query.isLoading && !sources.length && !query.isError && <p className="text-xs text-muted-foreground">{c.create}</p>}
  </section>;
}
