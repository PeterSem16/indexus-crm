import { ArrowRight, Check, Minus, Scale } from "lucide-react";
import type { Facility, NormalizedCompany } from "@shared/healthcare-legal-entity";
import type { HealthcareLegalEntityCopy } from "@/i18n/healthcare-legal-entity-translations";
import { registryIdLabel } from "@/lib/healthcare-legal-entity-registry-copy";
import "@/components/healthcare-legal-entity.css";

type SiteValues = Pick<Facility, "name" | "address" | "city" | "postalCode" | "ico">;

type RegistryCompanySiteComparisonProps = {
  site: SiteValues | null | undefined;
  registryCompany: NormalizedCompany | null | undefined;
  c: HealthcareLegalEntityCopy;
  countryCode?: string | null;
  loading?: boolean;
  embedded?: boolean;
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
  const cleaned = value?.normalize("NFKC").trim().replace(/\s+/g, isIco ? "" : " ");
  return cleaned ? cleaned.toLowerCase() : null;
}

export function RegistryCompanySiteComparison({
  site,
  registryCompany,
  c,
  countryCode,
  loading = false,
  embedded = true,
}: RegistryCompanySiteComparisonProps) {
  const comparisons = registryCompany
    ? fields.map((field) => {
        const siteValue = site?.[field.key];
        const registryValue = registryCompany[field.source];
        const siteComparable = comparableValue(siteValue, field.key === "ico");
        const registryComparable = comparableValue(registryValue, field.key === "ico");
        const status: "match" | "different" | "missing" | "empty" = siteComparable && registryComparable
          ? siteComparable === registryComparable ? "match" : "different"
          : siteComparable || registryComparable
            ? "missing"
            : "empty";
        return { ...field, siteValue, registryValue, status };
      })
    : [];
  const hasDifferences = comparisons.some((field) => field.status === "different" || field.status === "missing");
  const allEmpty = comparisons.length > 0 && comparisons.every((field) => field.status === "empty");
  const matchCount = comparisons.filter((field) => field.status === "match").length;
  const differenceCount = comparisons.filter((field) => field.status === "different").length;
  const missingCount = comparisons.filter((field) => field.status === "missing").length;

  return (
    <section
      className={`ler-compare ${embedded ? "is-embedded" : "is-dialog-content"}`}
      aria-label={c.siteComparisonTitle}
      data-testid="registry-company-site-comparison"
    >
      {embedded && <header className="ler-compare-head">
        <span className="ler-compare-mark" aria-hidden="true"><Scale size={16} /></span>
        <div><h3>{c.siteComparisonTitle}</h3><p>{c.siteComparisonNotice}</p></div>
      </header>}

      {loading ? (
        <div className="ler-compare-loading" aria-label={c.loading} aria-busy="true">
          <i /><i /><i />
        </div>
      ) : !site ? (
        <div className="ler-compare-empty">
          <p>{c.siteComparisonSiteUnavailable}</p>
          {!registryCompany && <p>{c.siteComparisonSourceUnavailable}</p>}
        </div>
      ) : !registryCompany ? (
        <p className="ler-compare-empty">{c.siteComparisonSourceUnavailable}</p>
      ) : (
        <>
          <div className="ler-counts" aria-label={c.comparisonSummary}>
            <span className="ler-count-match"><Check size={14} aria-hidden="true" /><b>{matchCount}</b><small>{c.siteComparisonMatch}</small></span>
            <span className="ler-count-different"><Scale size={14} aria-hidden="true" /><b>{differenceCount}</b><small>{c.siteComparisonDifference}</small></span>
            <span className="ler-count-missing"><Minus size={14} aria-hidden="true" /><b>{missingCount}</b><small>{c.siteComparisonMissing}</small></span>
            <span className="ler-count-caption">{c.comparedFields.replace("{count}", String(comparisons.length))}</span>
          </div>
          {hasDifferences && <p role="status" className="sr-only">{c.siteComparisonMismatchWarning}</p>}
          {allEmpty && <p className="ler-compare-empty">{c.siteComparisonNoValues}</p>}
          <div className="ler-compare-list">
            {comparisons.map((field, index) => (
              <article key={field.key} className={`ler-compare-row ler-row-${field.status}`} style={{ animationDelay: `${index * 45}ms` }}>
                <div className="ler-row-heading"><strong>{field.key === "ico" ? registryIdLabel(countryCode, c) : c[field.label]}</strong>{renderStatus(field.status, c)}</div>
                <div className="ler-value-pair">
                  <ValueCell label={c.existingValue} value={field.siteValue} missing={!comparableValue(field.siteValue) && field.status === "missing"} />
                  <ArrowRight className="ler-value-arrow" size={15} aria-hidden="true" />
                  <ValueCell label={c.verifiedValue} value={field.registryValue} missing={!comparableValue(field.registryValue) && field.status === "missing"} />
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ValueCell({ label, value, missing }: { label: string; value: string | null | undefined; missing: boolean }) {
  return (
    <div className={`ler-value-card ${missing ? "is-missing" : ""}`}>
      <small>{label}</small>
      <strong>{displayValue(value)}</strong>
    </div>
  );
}

function renderStatus(status: "match" | "different" | "missing" | "empty", c: HealthcareLegalEntityCopy) {
  if (status === "match") {
    return <span className="ler-status match"><Check size={13} aria-hidden="true" />{c.siteComparisonMatch}</span>;
  }
  if (status === "different") {
    return <span className="ler-status different"><Scale size={13} aria-hidden="true" />{c.siteComparisonDifference}</span>;
  }
  if (status === "missing") {
    return <span className="ler-status missing"><Minus size={13} aria-hidden="true" />{c.siteComparisonMissing}</span>;
  }
  return <span className="ler-status empty"><Minus size={13} aria-hidden="true" />{c.siteComparisonNoValues}</span>;
}
