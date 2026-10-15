import { AlertTriangle, Check, Minus } from "lucide-react";
import type { Facility, NormalizedCompany } from "@shared/healthcare-legal-entity";
import { Badge } from "@/components/ui/badge";
import type { HealthcareLegalEntityCopy } from "@/i18n/healthcare-legal-entity-translations";

type SiteValues = Pick<Facility, "name" | "address" | "city" | "postalCode" | "ico">;

type RegistryCompanySiteComparisonProps = {
  site: SiteValues | null | undefined;
  registryCompany: NormalizedCompany | null | undefined;
  c: HealthcareLegalEntityCopy;
  loading?: boolean;
};

const fields = [
  { key: "name", label: "companyName", source: "name" },
  { key: "address", label: "address", source: "registeredAddress" },
  { key: "city", label: "city", source: "city" },
  { key: "postalCode", label: "postalCode", source: "postalCode" },
  { key: "ico", label: "ico", source: "ico" },
] as const;

function displayValue(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned || "—";
}

function comparableValue(value: string | null | undefined, isIco = false) {
  const cleaned = value?.normalize("NFKC").trim().replace(/\s+/gu, isIco ? "" : " ");
  return cleaned ? cleaned.toLowerCase() : null;
}

export function RegistryCompanySiteComparison({
  site,
  registryCompany,
  c,
  loading = false,
}: RegistryCompanySiteComparisonProps) {
  const comparisons = registryCompany
    ? fields.map((field) => {
        const siteValue = site?.[field.key];
        const registryValue = registryCompany[field.source];
        const siteComparable = comparableValue(siteValue, field.key === "ico");
        const registryComparable = comparableValue(registryValue, field.key === "ico");
        const status = siteComparable && registryComparable
          ? siteComparable === registryComparable ? "match" : "different"
          : siteComparable || registryComparable
            ? "missing"
            : "empty";
        return { ...field, siteValue, registryValue, status };
      })
    : [];
  const hasDifferences = comparisons.some((field) => field.status === "different" || field.status === "missing");
  const allEmpty = comparisons.length > 0 && comparisons.every((field) => field.status === "empty");

  return (
    <section
      className="overflow-hidden rounded-lg border"
      aria-label={c.siteComparisonTitle}
      data-testid="registry-company-site-comparison"
    >
      <div className="border-b bg-muted/35 px-3 py-3 sm:px-4">
        <h4 className="text-sm font-semibold">{c.siteComparisonTitle}</h4>
        <p className="mt-1 text-xs text-muted-foreground">{c.siteComparisonNotice}</p>
      </div>

      {loading ? (
        <div className="space-y-3 p-3 sm:p-4" aria-label={c.loading} aria-busy="true">
          <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
          <div className="h-12 animate-pulse rounded bg-muted/70" />
          <div className="h-12 animate-pulse rounded bg-muted/70" />
        </div>
      ) : !site ? (
        <div className="space-y-1 px-3 py-4 text-sm text-muted-foreground sm:px-4">
          <p>{c.siteComparisonSiteUnavailable}</p>
          {!registryCompany && <p>{c.siteComparisonSourceUnavailable}</p>}
        </div>
      ) : !registryCompany ? (
        <p className="px-3 py-4 text-sm text-muted-foreground sm:px-4">{c.siteComparisonSourceUnavailable}</p>
      ) : (
        <>
          {hasDifferences && (
            <div role="status" className="flex items-start gap-2 border-b border-destructive/20 bg-destructive/[0.055] px-3 py-2.5 text-sm text-destructive sm:px-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{c.siteComparisonMismatchWarning}</span>
            </div>
          )}
          {allEmpty && <p className="px-3 py-3 text-xs text-muted-foreground sm:px-4">{c.siteComparisonNoValues}</p>}
          <div className="divide-y px-3 sm:px-4">
            {comparisons.map((field) => (
              <div key={field.key} className="grid gap-x-3 gap-y-2 py-3 sm:grid-cols-[minmax(90px,.55fr)_1fr_1fr_auto] sm:items-center">
                <div className="flex items-center justify-between gap-2 sm:contents">
                  <div className="text-xs font-medium text-muted-foreground">{c[field.label]}</div>
                  <div className="sm:hidden">{renderStatus(field.status, c)}</div>
                </div>
                <div className="grid min-w-0 grid-cols-2 gap-2 sm:contents">
                  <ValueCell label={c.existingValue} value={field.siteValue} missing={!comparableValue(field.siteValue) && field.status === "missing"} />
                  <ValueCell label={c.verifiedValue} value={field.registryValue} missing={!comparableValue(field.registryValue) && field.status === "missing"} />
                </div>
                <div className="hidden sm:block">{renderStatus(field.status, c)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ValueCell({ label, value, missing }: { label: string; value: string | null | undefined; missing: boolean }) {
  return (
    <div className={`min-w-0 rounded-md border px-2 py-1.5 ${missing ? "border-destructive/35 bg-destructive/[0.035]" : "border-transparent bg-muted/30"}`}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 break-words text-xs ${missing ? "text-destructive" : "text-foreground"}`}>{displayValue(value)}</div>
    </div>
  );
}

function renderStatus(status: "match" | "different" | "missing" | "empty", c: HealthcareLegalEntityCopy) {
  if (status === "match") {
    return <Badge variant="secondary" className="gap-1"><Check className="h-3 w-3" aria-hidden="true" />{c.siteComparisonMatch}</Badge>;
  }
  if (status === "different") {
    return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" aria-hidden="true" />{c.siteComparisonDifference}</Badge>;
  }
  if (status === "missing") {
    return <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive"><Minus className="h-3 w-3" aria-hidden="true" />{c.siteComparisonMissing}</Badge>;
  }
  return <Badge variant="outline" className="gap-1 text-muted-foreground"><Minus className="h-3 w-3" aria-hidden="true" />{c.siteComparisonNoValues}</Badge>;
}
