import type { NormalizedCompany, RegistryComparison, RegistryPerson, SnapshotSummary } from "./healthcare-legal-entity";
import type { HealthcareLegalEntityCopy } from "../client/src/i18n/healthcare-legal-entity-translations";
import { getRegistryCopy, withRegistryCopy } from "../client/src/i18n/healthcare-legal-entity-translations";

// Only explicitly selected public facts become document content. Never serialize
// a snapshot, company, or role object: these may also carry private source data.
const escapeHtml = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function registryComparisonDocument(
  comparison: RegistryComparison,
  company: Pick<NormalizedCompany, "name" | "ico" | "countryCode" | "registryReference">,
  c: HealthcareLegalEntityCopy,
  locale: string,
) {
  c = withRegistryCopy(c, company.countryCode);
  const e = escapeHtml;
  const source = getRegistryCopy(c, company.countryCode);
  const date = (value: string | null) => {
    if (!value) return "—";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : `${new Intl.DateTimeFormat(locale, {
      dateStyle: "medium", timeStyle: "medium", timeZone: "Europe/Bratislava",
    }).format(parsed)} (Europe/Bratislava)`;
  };
  const meta = (summary: SnapshotSummary, title: string) => `<section><h2>${e(title)}</h2>
    <p>${e(c.checkedAt)}: ${e(date(summary.checkedAt))}</p>
    <p>${e(company.countryCode === "SK" ? c.orsrSyncAt : source.sourceTimeLabel)}: ${e(date(summary.sourceUpdatedAt))}</p></section>`;
  const labels = { name: c.companyName, registeredAddress: c.address, city: c.city,
    postalCode: c.postalCode, legalForm: c.legalForm, status: c.status,
    vatRegistered: c.taxRegistered, taxInactive: c.taxInactive };
  const value = (field: string, text: string | null) => e(field === "vatRegistered" || field === "taxInactive"
    ? text === "true" ? c.yes : text === "false" ? c.no : null
    : field === "status"
    ? text === "active" ? c.active : text === "terminated" ? c.terminated : c.unknownStatus
    : text?.trim() ? text : null);
  const roles = (people: RegistryPerson[], title: string) => `<section><h3>${e(title)}</h3>${people.length
    ? people.map(person => `<article><h4>${e(person.name)}</h4><p>${e(person.role)} · ${e(person.kind)} · ${e(person.current ? c.current : c.ended)}</p>
      <p>${e(c.validFrom)}: ${e(date(person.validFrom))}<br>${e(c.validTo)}: ${e(date(person.validTo))}</p></article>`).join("")
    : "<p>—</p>"}</section>`;
  const hasChanges = comparison.fields.length || comparison.roles.removed.length || comparison.roles.added.length;
  const reference = company.registryReference;
  return `<!doctype html>
<html lang="${e(locale)}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${e(c.registryChanges)} · ${e(company.ico)}</title>
<style>body{font:15px/1.5 system-ui,sans-serif;color:#172033;background:#fff;max-width:1050px;margin:32px auto;padding:0 24px}
h1{font-size:24px}h2{font-size:19px;margin-top:24px}h3{font-size:16px}h4,p{margin:8px 0}
header{border-bottom:2px solid #334155;padding-bottom:16px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:24px}
table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #cbd5e1;padding:10px;text-align:left;vertical-align:top;overflow-wrap:anywhere}
th{background:#f1f5f9}article{border:1px solid #cbd5e1;padding:12px;margin:10px 0;break-inside:avoid}
body{overflow-wrap:anywhere}.note{color:#475569}@media(max-width:650px){.meta{grid-template-columns:1fr}}
@media print{body{margin:0;padding:0;font-size:11pt}thead{display:table-header-group}tr{break-inside:avoid}}</style></head>
<body><header><p>INDEXUS · ${e(source.sourceLabel)}</p><h1>${e(c.registryChanges)}</h1>
<h2>${e(company.name)}</h2><p>${e(source.identifierLabel)}: ${e(company.ico)} · ${e(company.countryCode)}</p>
<p>${e(source.referenceLabel)}: ${company.countryCode === "SK" ? `${e(reference.court)} / ${e(reference.section)} / ${e(reference.insertNumber)}` : e(company.ico)}</p>
<p class="note">${e(c.comparisonReadOnly)}</p></header>
<div class="meta">${comparison.previous ? meta(comparison.previous, c.previousSnapshot)
    : `<section><p>${e(c.firstVerification)}</p></section>`}${meta(comparison.current, c.newSnapshot)}</div>
${comparison.previous ? hasChanges ? `<h2>${e(c.details)}</h2>
${comparison.fields.length ? `<table><thead><tr><th>${e(c.details)}</th><th>${e(c.previousSnapshot)}</th><th>${e(c.newSnapshot)}</th></tr></thead><tbody>
${comparison.fields.map(change => `<tr><th scope="row">${e(labels[change.field])}</th><td>${value(change.field, change.before)}</td><td>${value(change.field, change.after)}</td></tr>`).join("")}
</tbody></table>` : ""}
<h2>${e(c.corporateRoles)}</h2>${roles(comparison.roles.removed, c.rolesRemoved)}${roles(comparison.roles.added, c.rolesAdded)}`
    : `<p>${e(c.registryUnchanged)}</p>` : ""}
</body></html>`;
}
