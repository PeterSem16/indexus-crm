import { ArrowRight, Clock3, Download, GitCompareArrows, ShieldCheck } from "lucide-react";
import { useId, useState } from "react";
import { REGISTRY_REVIEW_NOTE_MAX_LENGTH, type SnapshotReview } from "@shared/healthcare-legal-entity";
import type { RegistryComparison, RegistryChangeField, RegistryPerson, SnapshotSummary } from "@shared/healthcare-legal-entity";
import type { HealthcareLegalEntityCopy } from "@/i18n/healthcare-legal-entity-translations";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { hasRegistryChanges } from "@shared/healthcare-legal-entity-diff";

type RegistryComparisonPanelProps = {
  comparison: RegistryComparison;
  c: HealthcareLegalEntityCopy;
  onReview?: (snapshotId: string, note: string) => void;
  reviewing?: boolean;
  reviewError?: boolean;
  onDownload?: () => void;
  downloadPending?: boolean;
};

const missingValue = "—";

function displayValue(value: string | null | undefined) {
  return value?.trim() ? value : missingValue;
}

function dateLabel(value: string | null | undefined) {
  if (!value) return missingValue;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function fieldLabel(field: RegistryChangeField, c: HealthcareLegalEntityCopy) {
  switch (String(field)) {
    case "name":
      return c.companyName;
    case "registeredAddress":
      return c.address;
    case "city":
      return c.city;
    case "postalCode":
      return c.postalCode;
    case "legalForm":
      return c.legalForm;
    case "status":
      return c.status;
    case "vatRegistered":
      return c.taxRegistered;
    case "taxInactive":
      return c.taxInactive;
  }
}

function fieldValue(field: RegistryChangeField, value: string | null, c: HealthcareLegalEntityCopy) {
  const key = String(field);
  if (key === "vatRegistered" || key === "taxInactive") {
    if (value === "true") return c.yes;
    if (value === "false") return c.no;
    return missingValue;
  }
  if (field === "status") {
    if (value === "active") return c.active;
    if (value === "terminated") return c.terminated;
    if (value === "unknown") return c.unknownStatus;
  }
  return displayValue(value);
}

function SnapshotMeta({ snapshot, label, c, isCurrent }: {
  snapshot: SnapshotSummary;
  label: string;
  c: HealthcareLegalEntityCopy;
  isCurrent?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-background/70 p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${isCurrent ? "bg-primary" : "bg-muted-foreground/40"}`} aria-hidden="true" />
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</h3>
      </div>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5 shrink-0" />{c.checkedAt}</dt>
          <dd className="mt-1 break-words text-sm font-medium tabular-nums">{dateLabel(snapshot.checkedAt)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 shrink-0" />{c.registrySourceTime}</dt>
          <dd className="mt-1 break-words text-sm font-medium tabular-nums">{dateLabel(snapshot.sourceUpdatedAt)}</dd>
        </div>
      </dl>
    </div>
  );
}

function RoleChange({ person, c, change }: { person: RegistryPerson; c: HealthcareLegalEntityCopy; change: "removed" | "added" }) {
  const accent = change === "added"
    ? "border-l-emerald-600/60"
    : "border-l-destructive/55";

  return (
    <article className={`min-w-0 rounded-md border border-border/70 border-l-[3px] ${accent} bg-background px-3 py-3 sm:px-4`}>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h4 className="break-words text-sm font-semibold leading-snug">{displayValue(person.name)}</h4>
          <p className="mt-1 break-words text-sm text-muted-foreground">{displayValue(person.role)}</p>
          <p className="mt-1 break-words text-xs text-muted-foreground">{displayValue(person.kind)}</p>
        </div>
        <Badge variant={person.current ? "secondary" : "outline"} className="w-fit shrink-0">
          {person.current ? c.current : c.ended}
        </Badge>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border/60 pt-3">
        <div className="min-w-0">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{c.validFrom}</dt>
          <dd className="mt-1 break-words text-xs font-medium tabular-nums">{dateLabel(person.validFrom)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{c.validTo}</dt>
          <dd className="mt-1 break-words text-xs font-medium tabular-nums">{dateLabel(person.validTo)}</dd>
        </div>
      </dl>
    </article>
  );
}

export function RegistryReviewDetails({ review, c }: { review: SnapshotReview; c: HealthcareLegalEntityCopy }) {
  return <div>
    <div>{c.reviewedBy}: {review.reviewedByName}</div>
    <div>{c.reviewedAt}: {dateLabel(review.reviewedAt)}</div>
    {review.note && <div className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]" data-testid="registry-review-note">{c.reviewNote}: {review.note}</div>}
  </div>;
}

function RegistryReviewForm({ snapshotId, c, onReview, reviewing }: {
  snapshotId: string; c: HealthcareLegalEntityCopy;
  onReview: NonNullable<RegistryComparisonPanelProps["onReview"]>; reviewing?: boolean;
}) {
  const [note, setNote] = useState("");
  const inputId = useId();
  return <div className="space-y-2">
    <label htmlFor={inputId} className="text-sm font-medium">{c.reviewNoteOptional}</label>
    <Textarea id={inputId} value={note} onChange={event => setNote(event.target.value)}
      disabled={reviewing} maxLength={REGISTRY_REVIEW_NOTE_MAX_LENGTH} rows={3} data-testid="input-registry-review-note" />
    <Button size="sm" variant="outline" data-testid="button-review-registry-changes"
      disabled={reviewing} onClick={() => onReview(snapshotId, note.trim())}>{reviewing ? c.loading : c.markReviewed}</Button>
  </div>;
}

export function RegistryComparisonPanel({ comparison, c, onReview, reviewing, reviewError, onDownload, downloadPending }: RegistryComparisonPanelProps) {
  const hasChanges = hasRegistryChanges(comparison);
  const review = comparison.current.review;

  return (
    <Card className="overflow-hidden border-primary/15" data-testid="registry-comparison-panel">
      <div className="h-1 bg-gradient-to-r from-primary via-primary/50 to-transparent" />
      <CardContent className="space-y-5 p-4 sm:p-5">
        <header className="flex flex-wrap items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold leading-tight">{c.registryChanges}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{c.comparisonReadOnly}</p>
          </div>
          {onDownload && <Button type="button" variant="outline" size="sm" className="sm:ml-auto" onClick={onDownload} disabled={downloadPending} data-testid="button-download-registry-comparison">
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />{downloadPending ? c.downloading : c.downloadComparison}
          </Button>}
        </header>
        {hasChanges && <section className="space-y-2 rounded-lg border p-3" aria-label={c.reviewStatus}>
          <Badge variant={review ? "secondary" : "outline"}>{review ? c.changesReviewed : c.changesPending}</Badge>
          {review ? <div className="text-sm">
            <RegistryReviewDetails review={review} c={c} />
          </div> : <>
            <p className="text-xs text-muted-foreground">{c.reviewExplanation}</p>
            {onReview && <RegistryReviewForm key={comparison.current.id} snapshotId={comparison.current.id}
              c={c} onReview={onReview} reviewing={reviewing} />}
          </>}
          {reviewError && <p role="alert" className="text-sm text-destructive">{c.errors}</p>}
        </section>}

        <section aria-label={c.registryChanges} className={`grid min-w-0 gap-2 sm:items-stretch ${comparison.previous ? "sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]" : "sm:grid-cols-2"}`}>
          {comparison.previous ? (
            <SnapshotMeta snapshot={comparison.previous} label={c.previousSnapshot} c={c} />
          ) : (
            <div className="flex min-h-20 items-center rounded-lg border border-dashed border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground sm:min-h-0">
              {c.firstVerification}
            </div>
          )}
          {comparison.previous && (
            <div className="hidden items-center justify-center text-muted-foreground sm:flex" aria-hidden="true">
              <ArrowRight className="h-4 w-4" />
            </div>
          )}
          <SnapshotMeta snapshot={comparison.current} label={c.newSnapshot} c={c} isCurrent />
        </section>

        {!comparison.previous ? (
          null
        ) : !hasChanges ? (
          <p className="rounded-lg border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {c.registryUnchanged}
          </p>
        ) : (
          <div className="space-y-5">
            {comparison.fields.length > 0 && (
              <section className="min-w-0">
                <h3 className="mb-2 text-sm font-semibold">{c.details}</h3>
                <div className="overflow-hidden rounded-lg border border-border/70">
                  <div className="hidden grid-cols-[minmax(112px,0.75fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 bg-muted/45 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid sm:px-4">
                    <span>{c.details}</span>
                    <span>{c.previousSnapshot}</span>
                    <span>{c.newSnapshot}</span>
                  </div>
                  <div className="divide-y divide-border/70">
                    {comparison.fields.map((change) => (
                      <div key={change.field} className="grid min-w-0 gap-1 px-3 py-3 sm:grid-cols-[minmax(112px,0.75fr)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-3 sm:px-4">
                        <div className="text-xs font-semibold text-muted-foreground sm:pt-1">{fieldLabel(change.field, c)}</div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden">{c.previousSnapshot}</div>
                          <div className="mt-0.5 break-words text-sm">{fieldValue(change.field, change.before, c)}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden">{c.newSnapshot}</div>
                          <div className="mt-0.5 break-words text-sm font-medium">{fieldValue(change.field, change.after, c)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {(comparison.roles.removed.length > 0 || comparison.roles.added.length > 0) && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">{c.corporateRoles}</h3>
                {comparison.roles.removed.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.rolesRemoved}</h4>
                    <div className="grid min-w-0 gap-2 lg:grid-cols-2">
                      {comparison.roles.removed.map((person) => <RoleChange key={`removed-${person.key}`} person={person} c={c} change="removed" />)}
                    </div>
                  </div>
                )}
                {comparison.roles.added.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.rolesAdded}</h4>
                    <div className="grid min-w-0 gap-2 lg:grid-cols-2">
                      {comparison.roles.added.map((person) => <RoleChange key={`added-${person.key}`} person={person} c={c} change="added" />)}
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default RegistryComparisonPanel;
