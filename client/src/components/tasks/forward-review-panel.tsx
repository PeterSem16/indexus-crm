import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, Check, FileText, Loader2, Search, UserRound, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntityDetailDrawer, type EntityRef } from "@/components/entity-detail-drawer";

type Customer = { id: string; label: string; country: string };
type ReviewResponse = {
  review: null | {
    version: 1;
    matchSender: boolean;
    matchStatus: "disabled" | "none" | "unique" | "ambiguous";
    candidateIds: string[];
    invoices: { attachmentId: string; name: string; approvedAt: string | null; approvedBy: string | null }[];
  };
  customer: Customer | null;
  candidates: Customer[];
  canApprove: boolean;
};

export function ForwardReviewPanel({ taskId }: { taskId: number | string }) {
  const { t, locale } = useI18n();
  const copy = t.forwardReview;
  const id = String(taskId);
  const reviewKey = ["/api/tasks", id, "forward-review"];
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState<EntityRef | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  useEffect(() => { setSearch(""); setMutationError(null); setEntity(null); }, [id]);

  const reviewQuery = useQuery<ReviewResponse>({
    queryKey: reviewKey,
    queryFn: async () => (await apiRequest("GET", `/api/tasks/${encodeURIComponent(id)}/forward-review`)).json(),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const normalizedSearch = search.trim();
  const customersQuery = useQuery<{ records: Customer[] }>({
    queryKey: ["/api/tasks", id, "forward-review", "customers", normalizedSearch],
    queryFn: async () => (await apiRequest("GET", `/api/tasks/${encodeURIComponent(id)}/forward-review/customers?q=${encodeURIComponent(normalizedSearch)}`)).json(),
    enabled: normalizedSearch.length >= 2 && !!reviewQuery.data?.review,
  });
  const refreshRelated = () => {
    queryClient.invalidateQueries({ queryKey: reviewKey });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/created"] });
    queryClient.invalidateQueries({ queryKey: ["/api/back-office/tasks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/agent/bo-questions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/back-office/agent-questions"] });
  };
  const assignMutation = useMutation({
    mutationFn: (customerId: string | null) => apiRequest("PATCH", `/api/tasks/${encodeURIComponent(id)}/forward-review/customer`, { customerId }),
    onSuccess: () => { setMutationError(null); setSearch(""); refreshRelated(); },
    onError: () => setMutationError(copy.saveError),
  });
  const approvalMutation = useMutation({
    mutationFn: (attachmentId: string) => apiRequest("POST", `/api/tasks/${encodeURIComponent(id)}/forward-review/approval`, { attachmentId }),
    onSuccess: () => { setMutationError(null); refreshRelated(); },
    onError: () => setMutationError(copy.approvalError),
  });

  if (reviewQuery.isLoading) {
    return <section className="rounded-md border p-3 space-y-3" aria-label={copy.title} data-testid={`forward-review-loading-${id}`}>
      <div className="h-3 w-32 animate-pulse rounded bg-muted" />
      <div className="h-8 animate-pulse rounded bg-muted/70" />
    </section>;
  }
  if (reviewQuery.isError) {
    return <section className="rounded-md border p-3" role="alert">
      <div className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{copy.loadError}</div>
      <Button size="sm" variant="outline" className="mt-2" onClick={() => void reviewQuery.refetch()}>{copy.retry}</Button>
    </section>;
  }
  const data = reviewQuery.data;
  if (!data?.review) return null;
  const busy = assignMutation.isPending || approvalMutation.isPending;
  const matchingCustomers = customersQuery.data?.records ?? [];

  return (
    <section className="rounded-md border bg-muted/10 p-3 space-y-3" aria-label={copy.title} data-testid={`forward-review-${id}`}>
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold">{copy.title}</h3>
        {data.review.matchSender && <span className={`text-[10px] rounded-full px-2 py-1 ${data.review.matchStatus === "unique" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"}`}>
          {data.review.matchStatus === "unique" ? copy.senderMatched : copy.senderNotMatched}
        </span>}
      </header>

      <div className="rounded-md border bg-background p-2.5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{copy.linkedCustomer}</div>
        {data.customer ? (
          <button type="button" onClick={() => setEntity({ type: "customer", id: data.customer!.id })} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline text-left" data-testid={`forward-review-customer-${id}`}>
            <UserRound className="h-3.5 w-3.5 shrink-0" />{data.customer.label}<span className="text-xs text-muted-foreground">· {data.customer.country}</span>
          </button>
        ) : <div className="text-sm text-muted-foreground">{copy.noCustomer}</div>}
        {data.review.matchStatus === "ambiguous" && data.candidates.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="text-[10px] font-medium text-muted-foreground">{copy.ambiguous}</div>
            {data.candidates.filter(candidate => data.review!.candidateIds.includes(candidate.id)).map(candidate => (
              <button type="button" key={candidate.id} disabled={busy} onClick={() => assignMutation.mutate(candidate.id)} className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted disabled:opacity-50">
                {candidate.label}<span className="text-muted-foreground"> · {candidate.country}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor={`forward-review-search-${id}`} className="text-[10px] uppercase tracking-wide text-muted-foreground">{copy.changeCustomer}</label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input id={`forward-review-search-${id}`} className="h-9 pl-8 text-xs" placeholder={copy.searchCustomer} value={search} onChange={event => setSearch(event.target.value)} data-testid={`forward-review-search-${id}`} />
        </div>
        {normalizedSearch && <div className="rounded-md border bg-background p-1">
          {customersQuery.isFetching ? <div className="px-2 py-2 text-xs text-muted-foreground">{copy.loading}</div>
            : customersQuery.isError ? <div className="px-2 py-2 text-xs text-destructive">{copy.loadError}</div>
              : matchingCustomers.length ? <>
                <div className="px-2 py-1 text-[10px] text-muted-foreground">{copy.searchResults}</div>
                {matchingCustomers.map(candidate => <button type="button" key={candidate.id} disabled={busy} onClick={() => assignMutation.mutate(candidate.id)} className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-50">
                  {candidate.label}<span className="text-muted-foreground"> · {candidate.country}</span>
                </button>)}
              </> : <div className="px-2 py-2 text-xs text-muted-foreground">{copy.noSearchResults}</div>}
        </div>}
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={busy || !data.customer} onClick={() => assignMutation.mutate(null)} data-testid={`forward-review-clear-${id}`}>
          {assignMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <X className="mr-1 h-3 w-3" />}{copy.clearCustomer}
        </Button>
      </div>

      {data.review.invoices.length > 0 && <div className="space-y-2 border-t pt-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{copy.invoices}</div>
        {data.review.invoices.map(invoice => <div key={invoice.attachmentId} className="flex items-center justify-between gap-3 rounded-md border bg-background px-2.5 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0"><div className="truncate text-xs font-medium">{invoice.name}</div>
              {invoice.approvedAt && <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300">
                <Check className="h-3 w-3" />{copy.approved} · {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(invoice.approvedAt))}
              </div>}
            </div>
          </div>
          {data.canApprove && !invoice.approvedAt && <Button type="button" size="sm" className="h-7 shrink-0 text-xs" disabled={busy} onClick={() => approvalMutation.mutate(invoice.attachmentId)} data-testid={`forward-review-approve-${invoice.attachmentId}`}>
            {approvalMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}{copy.approve}
          </Button>}
        </div>)}
      </div>}
      {mutationError && <p role="alert" className="text-xs text-destructive">{mutationError}</p>}
      {(assignMutation.isPending || approvalMutation.isPending) && <span className="sr-only" role="status">{copy.loading}</span>}
      <EntityDetailDrawer entity={entity} onClose={() => setEntity(null)} />
    </section>
  );
}
