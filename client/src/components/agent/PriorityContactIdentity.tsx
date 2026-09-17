import { Building2, Mail, MapPin, Phone, Search, Stethoscope, UserRound } from "lucide-react";
import { useI18n } from "@/i18n";
import type { PriorityContact } from "./priority-builder";
import {
  getPriorityContactSearchDetails,
  getPriorityContactSearchMatches,
  getPriorityTextMatchRanges,
  type PrioritySearchField,
  type PrioritySearchMatchField,
} from "./priority-contact-search";
import "./priority-contact-identity.css";

function Highlight({ value, query, phone = false }: { value: string; query: string; phone?: boolean }) {
  const ranges = getPriorityTextMatchRanges(value, query, phone);
  const parts = [];
  let offset = 0;
  for (const { start, end } of ranges) {
    parts.push(value.slice(offset, start));
    parts.push(<mark key={start}>{value.slice(start, end)}</mark>);
    offset = end;
  }
  parts.push(value.slice(offset));
  return <>{parts}</>;
}

/** Identity, matching, and filtering use the same public-field projection. */
export function PriorityContactIdentity({ contact, query, field }: {
  contact: PriorityContact;
  query: string;
  field: PrioritySearchField;
}) {
  const { t } = useI18n();
  const copy = t.agentWorkspace.priorityBuilderSearchResult;
  const details = getPriorityContactSearchDetails(contact);
  const matches = getPriorityContactSearchMatches(contact, query, field);
  const matchingFields = Array.from(new Set(matches.map(match => match.field)));
  const fieldQuery = (kind: PrioritySearchMatchField) => matchingFields.includes(kind) ? query : "";
  // Keep primary contact information visible; also reveal a matching secondary
  // number/address so a result never conceals the reason it was found.
  const visibleValues = (values: string[], kind: "phone" | "email") =>
    values.filter((value, index) => index === 0 || matches.some(match => match.field === kind && match.value === value));
  const phones = visibleValues(details.phones, "phone");
  const emails = visibleValues(details.emails, "email");

  return <span className="priority-contact-identity">
    <span className="priority-contact-main">
      <span className="priority-builder-avatar"><UserRound size={16} aria-hidden="true" /></span>
      <span className="priority-contact-person">
        <span className="priority-contact-eyebrow">{copy.contactPerson}</span>
        <strong className="priority-builder-card-name">
          <Highlight value={details.name || copy.missingName} query={details.name ? fieldQuery("name") : ""} />
        </strong>
      </span>
    </span>
    {details.organization && <span className="priority-contact-organization">
      <Building2 size={13} aria-hidden="true" />
      <span><Highlight value={details.organization} query={fieldQuery("organization")} /></span>
    </span>}
    {details.specialty && <span className="priority-contact-specialty">
      <Stethoscope size={13} aria-hidden="true" />
      <span><Highlight value={details.specialty} query={fieldQuery("specialty")} /></span>
    </span>}
    <span className="priority-contact-channels">
      {phones.length ? phones.map(phone => <span key={phone} className="priority-contact-channel">
        <Phone size={13} aria-hidden="true" /><span><Highlight value={phone} query={fieldQuery("phone")} phone /></span>
      </span>) : <span className="priority-contact-channel missing"><Phone size={13} aria-hidden="true" /><span>{copy.missingPhone}</span></span>}
      {emails.length ? emails.map(email => <span key={email} className="priority-contact-channel">
        <Mail size={13} aria-hidden="true" /><span><Highlight value={email} query={fieldQuery("email")} /></span>
      </span>) : <span className="priority-contact-channel missing"><Mail size={13} aria-hidden="true" /><span>{copy.missingEmail}</span></span>}
      {matchingFields.includes("city") && <span className="priority-contact-channel">
        <MapPin size={13} aria-hidden="true" /><span><Highlight value={details.city} query={fieldQuery("city")} /></span>
      </span>}
    </span>
    {matchingFields.length > 0 && <span className="priority-contact-match">
      <Search size={11} aria-hidden="true" /><span>{copy.match}: {matchingFields.map(kind => copy[kind]).join(" · ")}</span>
    </span>}
  </span>;
}