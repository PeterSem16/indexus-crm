import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { useEffect, useRef } from "react";
import { CalendarDays, Check, ClipboardCheck, FileText, UserRound, X } from "lucide-react";

interface SelectedOption {
  id: string;
  label: string;
  note: string | null;
  selectedAt: string;
}

interface Reschedule {
  date: string;
  note: string | null;
}

interface ReviewContact {
  type: "customer" | "clinic" | "hospital" | "collaborator";
  name: string;
  fields: Record<string, string | null>;
  campaignContactId: string | null;
  selectedOptions: SelectedOption[];
  reschedule: Reschedule | null;
}

export function CallContactReviewPanel({ callLogId, onClose }: {
  callLogId: string;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const ca = t.callAnalysis;
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
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

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

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
  const formatDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString(locale || undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };
  const fieldEntries = Object.entries(data?.fields ?? {}).filter(
    ([key]) => key !== "name" && key !== "firstName" && key !== "lastName",
  );

  return (
    <aside role="dialog" aria-label={ca.reviewContactTitle} aria-modal="false"
      className="fixed inset-0 z-[9994] flex min-w-0 flex-col overflow-hidden border-l border-border/80 bg-background shadow-2xl shadow-slate-950/10 lg:sticky lg:top-2 lg:z-auto lg:h-[calc(100dvh-1rem)] lg:w-[45%] lg:shrink-0 lg:self-start lg:rounded-l-2xl lg:shadow-none"
      data-testid="call-contact-review-drawer">
      <header className="shrink-0 border-b border-border/70 bg-muted/20 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold tracking-tight">{ca.reviewContactTitle}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{ca.reviewReadOnly}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t.common.close}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            data-testid="close-call-contact-review">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {isLoading ? (
          <div className="space-y-6" aria-busy="true" aria-label={ca.reviewContactTitle}>
            <div className="space-y-2">
              <div className="h-6 w-2/3 animate-pulse rounded-md bg-muted" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[1, 2, 3, 4].map((item) => <div key={item} className="h-[68px] animate-pulse rounded-xl bg-muted/70" />)}
            </div>
            <div className="h-32 animate-pulse rounded-xl bg-muted/60" />
          </div>
          ) : isError || !data ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-muted-foreground" role="alert">
            <p>{ca.reviewUnavailable}</p>
          </div>
          ) : (
          <div className="space-y-7">
            <section className="space-y-3" data-testid="review-contact-fields">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{ca.reviewContactDetails}</p>
                  <h3 className="mt-1 truncate text-xl font-semibold tracking-tight">{data.name}</h3>
                </div>
              </div>
              {fieldEntries.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{t.common.noData}</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {fieldEntries.map(([key, value]) => (
                    <div key={key} className="min-w-0 rounded-xl border border-border/70 bg-muted/20 px-3.5 py-3">
                      <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{labels[key] || key}</div>
                      <div className="mt-1 break-words whitespace-pre-wrap text-sm">{value || "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section data-testid="review-selected-options" className="space-y-3">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                <h3 className="text-sm font-semibold">{ca.reviewSelectedOptions}</h3>
                {data.selectedOptions.length > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{data.selectedOptions.length}</span>}
              </div>
              {data.selectedOptions.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  {data.campaignContactId ? ca.reviewNoOptions : ca.reviewNoStatus}
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border/70">
                  {data.selectedOptions.map((option, index) => (
                    <div key={option.id} className={`flex gap-3 bg-emerald-50/40 px-4 py-3.5 dark:bg-emerald-950/10 ${index ? "border-t border-border/60" : ""}`}>
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug">{option.label}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{ca.reviewDuringCall} · {formatDate(option.selectedAt)}</p>
                        {option.note && <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/80"><span className="font-medium">{ca.reviewAgentNote}:</span> {option.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {data.reschedule && (
              <section data-testid="review-reschedule" className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/15">
                <div className="flex gap-3">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{ca.reviewReschedule}</h3>
                    <p className="mt-1 text-sm font-medium">{formatDate(data.reschedule.date)}</p>
                    {data.reschedule.note && <p className="mt-2 flex gap-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground"><FileText className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" /><span><span className="font-medium text-foreground/80">{ca.reviewAgentNote}:</span> {data.reschedule.note}</span></p>}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}