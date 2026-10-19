import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertCircle, History, Loader2, RefreshCw, Workflow } from "lucide-react";
import type { WorkflowCatalogItem } from "@shared/status-list-workflow";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStatusListWorkflowCopy } from "@/components/status-list-workflow-copy";

type WorkflowResult = {
  status?: string;
  reason?: string | null;
  target?: { kind: "item" | "question"; id: string };
  source?: { kind: "item" | "question"; id: string };
  sourceLabel?: string;
  targetLabel?: string;
  previous?: boolean | string | null;
  value?: boolean | string | null;
  cleared?: Array<{ kind?: "item" | "question"; id?: string; label?: string; target?: { kind: "item" | "question"; id: string } } | string>;
};
type WorkflowRun = {
  id: string;
  ruleName: string;
  branch: string;
  results: WorkflowResult[] | WorkflowResult | null;
  createdAt: string;
  actorName: string | null;
  source?: { kind: "item" | "question"; id: string };
  sourceLabel?: string;
};
type ContactWorkflowData = {
  answers: Record<string, boolean | string>;
  runs: WorkflowRun[];
  catalog: WorkflowCatalogItem[];
};
type Props = { campaignId: string; campaignContactId: string; showQuestions?: boolean };

const localeTag: Record<string, string> = { en: "en-GB", sk: "sk-SK", cs: "cs-CZ", hu: "hu-HU", ro: "ro-RO", it: "it-IT", de: "de-DE" };
const fieldType = (item: WorkflowCatalogItem) => item.fieldType.toLowerCase().replace(/[-\s]/g, "_");
const booleanQuestion = (item: WorkflowCatalogItem) => ["checkbox", "radio"].includes(fieldType(item));
const yesNoQuestion = (item: WorkflowCatalogItem) => ["yesno", "yes_no"].includes(fieldType(item));
const supportedQuestion = (item: WorkflowCatalogItem) =>
  booleanQuestion(item) || yesNoQuestion(item) || ["text", "number", "date"].includes(fieldType(item));

function formatAnswer(value: unknown, copy: ReturnType<typeof getStatusListWorkflowCopy>) {
  if (value === null || value === undefined || value === "") return copy.noAnswer;
  if (value === true) return copy.booleanTrue;
  if (value === false) return copy.booleanFalse;
  if (value === "yes") return copy.yes;
  if (value === "no") return copy.no;
  return String(value);
}
function localizedReason(reason: string | null | undefined, copy: ReturnType<typeof getStatusListWorkflowCopy>) {
  if (reason === "unchanged") return copy.unchangedReason;
  if (reason === "not_empty") return copy.notEmptyReason;
  return reason ? copy.otherReason : "";
}
function localizedStatus(status: string | undefined, copy: ReturnType<typeof getStatusListWorkflowCopy>) {
  if (status === "changed") return copy.changed;
  if (status === "skipped") return copy.skipped;
  if (status === "invalid") return copy.invalidResult;
  return copy.otherReason;
}
function statusVariant(status: string | undefined): "default" | "secondary" | "destructive" {
  return status === "changed" ? "default" : status === "invalid" ? "destructive" : "secondary";
}
function asResults(results: WorkflowRun["results"]): WorkflowResult[] {
  if (Array.isArray(results)) return results;
  return results && typeof results === "object" ? [results as WorkflowResult] : [];
}

export function StatusListWorkflowContact({ campaignId, campaignContactId, showQuestions = true }: Props) {
  const { locale } = useI18n();
  const copy = getStatusListWorkflowCopy(locale);
  const { toast } = useToast();
  const [savingQuestion, setSavingQuestion] = useState<string | null>(null);
  const queryKey = ["/api/campaigns", campaignId, "contacts", campaignContactId, "status-list-workflows"];
  const endpoint = `/api/campaigns/${campaignId}/contacts/${campaignContactId}/status-list-workflows`;
  const query = useQuery<ContactWorkflowData>({
    queryKey,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const response = await fetch(endpoint, { credentials: "include" });
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    },
  });
  const answerMutation = useMutation({
    mutationFn: async ({ questionId, value }: { questionId: string; value: boolean | string | null }) => {
      setSavingQuestion(questionId);
      return apiRequest("PUT", `${endpoint}/answers/${questionId}`, { value });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "contacts", campaignContactId, "status-list-state"] }),
        // Invalidate nested contact history queries without assuming the host's history query key.
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "contacts", campaignContactId] }),
      ]);
      toast({ title: copy.answerSaved });
    },
    onError: () => toast({ title: copy.answerError, variant: "destructive" }),
    onSettled: () => setSavingQuestion(null),
  });
  const saveAnswer = (questionId: string, value: boolean | string | null) => answerMutation.mutate({ questionId, value });
  const catalog = query.data?.catalog || [];
  const itemFor = (ref: WorkflowResult["target"] | WorkflowRun["source"]) =>
    catalog.find(item => item.kind === ref?.kind && item.id === ref?.id);
  const dateFormatLocale = localeTag[locale] || "en-GB";

  return <section className="space-y-4 rounded-xl border border-border/70 bg-card/70 p-4 shadow-sm" data-testid="status-list-workflow-contact">
    {!showQuestions && query.isError && <div role="alert" className="text-sm text-destructive">
      {copy.contactLoadError}<Button variant="ghost" size="sm" onClick={() => void query.refetch()}>{copy.retry}</Button>
    </div>}
    {showQuestions && <div className="space-y-3">
      <div className="flex items-center gap-2"><Workflow className="h-4 w-4 text-primary"/><h2 className="text-sm font-semibold">{copy.answers}</h2></div>
      {query.isLoading && <div className="space-y-2"><div className="h-10 animate-pulse rounded-lg bg-muted/70"/><div className="h-10 w-4/5 animate-pulse rounded-lg bg-muted/70"/></div>}
      {query.isError && <div className="flex items-center justify-between rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm">
        <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4"/>{copy.contactLoadError}</span>
        <Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}><RefreshCw className="mr-1.5 h-3.5 w-3.5"/>{copy.retry}</Button>
      </div>}
      {query.data && <div className="space-y-2">
        {catalog.filter(item => item.kind === "question" && !item.hidden).map(question => {
          const answer = query.data.answers?.[question.id];
          const canEdit = question.writable && supportedQuestion(question);
          return <div key={question.id} className="grid gap-2 rounded-lg border border-border/60 bg-background/60 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.8fr)] sm:items-center">
            <div className="min-w-0"><Label className="text-sm">{question.label}</Label>{question.parentLabel && <p className="mt-0.5 text-xs text-muted-foreground">{question.parentLabel}</p>}</div>
            {!canEdit ? <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{formatAnswer(answer, copy)}</span><Badge variant="outline">{question.writable ? copy.unsupportedType : copy.readOnlyAnswer}</Badge>
            </div> : booleanQuestion(question) ? <label className="flex min-h-9 items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={answer === true} disabled={answerMutation.isPending}
                onChange={event => saveAnswer(question.id, event.target.checked ? true : null)}/>
              {answer === true ? copy.booleanTrue : answer === false ? copy.booleanFalse : copy.noAnswer}
              {savingQuestion === question.id && <Loader2 className="h-3.5 w-3.5 animate-spin"/>}
            </label> : fieldType(question) === "radio" ? <Select value={answer === true ? "true" : "none"} disabled={answerMutation.isPending}
              onValueChange={value => saveAnswer(question.id, value === "none" ? null : true)}>
              <SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">{copy.noAnswer}</SelectItem><SelectItem value="true">{copy.booleanTrue}</SelectItem></SelectContent>
            </Select> : yesNoQuestion(question) ? <Select value={answer === "yes" || answer === "no" ? String(answer) : "none"} disabled={answerMutation.isPending}
              onValueChange={value => saveAnswer(question.id, value === "none" ? null : value)}>
              <SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">{copy.noAnswer}</SelectItem><SelectItem value="yes">{copy.yes}</SelectItem><SelectItem value="no">{copy.no}</SelectItem></SelectContent>
            </Select> : <div className="relative">
              <Input key={`${question.id}:${String(answer ?? "")}`} type={fieldType(question) === "number" ? "number" : fieldType(question) === "date" ? "date" : "text"}
                defaultValue={typeof answer === "string" ? answer : ""}
                disabled={answerMutation.isPending}
                onBlur={event => {
                  const value = event.currentTarget.value;
                  if (value !== answer) saveAnswer(question.id, value === "" ? null : value);
                }}/>
              {savingQuestion === question.id && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground"/>}
            </div>}
          </div>;
        })}
        {catalog.filter(item => item.kind === "question" && !item.hidden).length === 0 &&
          <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">{copy.noQuestions}</p>}
      </div>}
    </div>}
    <div className="space-y-3">
      <div className="flex items-center gap-2"><History className="h-4 w-4 text-primary"/><h2 className="text-sm font-semibold">{copy.history}</h2></div>
      {query.isLoading && !showQuestions && <div className="h-14 animate-pulse rounded-lg bg-muted/70"/>}
      {query.isError && !showQuestions && <div className="flex items-center justify-between rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4"/>{copy.contactLoadError}</span><Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}>{copy.retry}</Button></div>}
      {query.data && query.data.runs.length === 0 && <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">{copy.noRuns}</p>}
      {query.data?.runs.map(run => {
        const firstResult = asResults(run.results)[0];
        const source = run.sourceLabel || itemFor(run.source)?.label || firstResult?.sourceLabel || itemFor(firstResult?.source)?.label;
        let created = run.createdAt;
        try { created = new Intl.DateTimeFormat(dateFormatLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(run.createdAt)); } catch { /* retain server timestamp */ }
        return <article key={run.id} className="overflow-hidden rounded-lg border border-border/70 bg-background/65">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 px-3 py-2.5">
            <div className="min-w-0"><h3 className="text-sm font-semibold">{run.ruleName}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{run.actorName || "—"} · {created}{source ? ` · ${copy.sourceLabel}: ${source}` : ""}</p>
            </div>
            <Badge variant="outline">{run.branch === "else" ? copy.elseBranch : copy.thenBranch}</Badge>
          </div>
          <div className="divide-y divide-border/50">
            {asResults(run.results).map((result, index) => {
              const target = itemFor(result.target);
              const cleared = Array.isArray(result.cleared) ? result.cleared.map(value => typeof value === "string" ? value : value.label || itemFor(value.target || { kind: value.kind || "question", id: value.id || "" })?.label).filter(Boolean) : [];
              const reason = localizedReason(result.reason, copy);
              return <div key={`${result.target?.kind || "result"}-${result.target?.id || index}-${index}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs">
                <span className="min-w-28 font-medium text-foreground">{result.targetLabel || target?.label || copy.sourceLabel}</span>
                <Badge variant={statusVariant(result.status)}>{localizedStatus(result.status, copy)}</Badge>
                {result.previous !== undefined && <span className="text-muted-foreground">{copy.previous}: <strong className="font-medium text-foreground">{formatAnswer(result.previous, copy)}</strong></span>}
                {result.value !== undefined && <span className="flex items-center gap-1 text-muted-foreground"><span aria-hidden="true">→</span>{copy.newValue}: <strong className="font-medium text-foreground">{formatAnswer(result.value, copy)}</strong></span>}
                {reason && <span className="text-muted-foreground">{reason}</span>}
                {cleared.length > 0 && <span className="text-muted-foreground">{copy.cleared}: {cleared.join(", ")}</span>}
              </div>;
            })}
          </div>
        </article>;
      })}
    </div>
  </section>;
}

export default StatusListWorkflowContact;
