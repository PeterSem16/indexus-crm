import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { CheckCircle2, Circle, Loader2, UserRound, X } from "lucide-react";

interface ReviewItem {
  id: string;
  label: string;
  description: string | null;
  parentId: string | null;
  itemType: string;
  isHidden: boolean;
  required: boolean;
}

interface ReviewState {
  statusListItemId: string;
  confirmedAt: string;
  confirmedByName: string | null;
  itemNote: string | null;
}

interface ReviewContact {
  type: "customer" | "clinic" | "hospital" | "collaborator";
  name: string;
  fields: Record<string, string | null>;
  campaignContactId: string | null;
  statusItems: ReviewItem[];
  statusState: ReviewState[];
}

export function CallContactReviewPanel({ callLogId, onClose }: {
  callLogId: string;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const ca = t.callAnalysis;
  const { data, isLoading, isError } = useQuery<ReviewContact>({
    queryKey: ["/api/call-logs", callLogId, "review-contact"],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const response = await fetch(`/api/call-logs/${callLogId}/review-contact`, { credentials: "include" });
      if (!response.ok) throw new Error(`Contact review unavailable (${response.status})`);
      return response.json();
    },
  });

  const labels: Record<string, string> = {
    firstName: t.customers.firstName,
    lastName: t.customers.lastName,
    doctorName: ca.reviewDoctor,
    contactPerson: ca.reviewContactPerson,
    fullName: t.common.name,
    phone: t.common.phone,
    phone2: `${t.common.phone} 2`,
    phone3: `${t.common.phone} 3`,
    mobile: ca.reviewMobile,
    mobile2: `${ca.reviewMobile} 2`,
    email: t.common.email,
    email2: `${t.common.email} 2`,
    email3: `${t.common.email} 3`,
    address: t.customers.address,
    city: t.customers.city,
    postalCode: t.customers.postalCode,
    country: t.common.country,
    notes: t.customers.notes,
    status: t.common.status,
  };
  const stateByItem = new Map<string, ReviewState>(
    data?.statusState.map(s => [s.statusListItemId, s] as const) ?? [],
  );

  return (
    <aside role="dialog" aria-label={ca.reviewContactTitle} aria-modal="false"
      className="fixed inset-0 z-[9994] flex min-w-0 flex-col border-l bg-background lg:sticky lg:top-2 lg:z-auto lg:h-[calc(100dvh-1rem)] lg:w-[45%] lg:shrink-0 lg:self-start"
      data-testid="call-contact-review-drawer">
        <header className="shrink-0 border-b px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <UserRound className="h-5 w-5 text-primary" />
            {ca.reviewContactTitle}
            <button type="button" onClick={onClose} aria-label={t.common.close}
              className="ml-auto rounded-md p-1.5 hover:bg-muted" data-testid="close-call-contact-review">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-xs font-normal text-muted-foreground">{ca.reviewReadOnly}</p>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : isError || !data ? (
            <p className="rounded-lg border p-4 text-sm text-muted-foreground" role="alert">{ca.reviewUnavailable}</p>
          ) : (
            <>
              <section className="space-y-3" data-testid="review-contact-fields">
                <h3 className="text-base font-semibold">{data.name}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(data.fields).filter(([key]) => key !== "name" && key !== "firstName" && key !== "lastName")
                    .map(([key, value]) => (
                      <div key={key} className="rounded-lg border bg-muted/20 px-3 py-2 min-w-0">
                        <div className="text-[11px] text-muted-foreground">{labels[key] || key}</div>
                        <div className="text-sm whitespace-pre-wrap break-words">{value || "—"}</div>
                      </div>
                    ))}
                </div>
              </section>
              <section data-testid="review-status-list">
                <h3 className="text-sm font-semibold mb-3">{ca.reviewCurrentStatus}</h3>
                {!data.campaignContactId ? (
                  <p className="text-sm text-muted-foreground">{ca.reviewNoStatus}</p>
                ) : data.statusItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.common.noData}</p>
                ) : (
                  <div className="space-y-2">
                    {data.statusItems.map(item => {
                      const state = stateByItem.get(item.id);
                      return (
                        <div key={item.id} className="rounded-lg border p-3" style={{ marginLeft: item.parentId ? 16 : 0 }}>
                          <div className="flex items-start gap-2">
                            {state ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                              : <Circle className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />}
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{item.label}</div>
                              {item.description && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
                              <p className="text-xs text-muted-foreground mt-1">
                                {state
                                  ? `${ca.reviewConfirmed}${state.confirmedByName ? ` · ${state.confirmedByName}` : ""} · ${new Date(state.confirmedAt).toLocaleString(locale)}`
                                  : ca.reviewUnconfirmed}
                              </p>
                              {state?.itemNote && <p className="text-xs mt-2 whitespace-pre-wrap break-words">{state.itemNote}</p>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
    </aside>
  );
}