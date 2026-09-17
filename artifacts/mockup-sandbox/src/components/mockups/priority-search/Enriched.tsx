import { Building2, Mail, Phone, Search, UserRound, Stethoscope } from "lucide-react";
import { Current } from "./Current";
import type { PriorityContact } from "./_priority-builder";
import "./_enriched.css";

type SearchField = "all" | "name" | "phone" | "email" | "city";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("sk");

/** Render text, not HTML; each match retains its original casing and accents. */
function Mark({ value, query }: { value: string; query: string }) {
  const needle = normalize(query.trim());
  if (!needle) return <>{value}</>;
  const normalized = normalize(value);
  const parts = [];
  let offset = 0;
  let index = normalized.indexOf(needle);
  while (index !== -1) {
    parts.push(value.slice(offset, index));
    parts.push(<mark key={index}>{value.slice(index, index + needle.length)}</mark>);
    offset = index + needle.length;
    index = normalized.indexOf(needle, offset);
  }
  parts.push(value.slice(offset));
  return <>{parts}</>;
}

function ContactIdentity({ contact, query, field }: { contact: PriorityContact; query: string; field: SearchField }) {
  const doctor = String(contact.doctorName || "");
  const clinic = String(contact.clinic?.name || "");
  const specialty = String(contact.role === "General practitioner" ? "Ambulancia všeobecného lekára" : contact.role || "");
  const phone = String(contact.phone || contact.clinic?.phone || "");
  const email = String(contact.email || contact.clinic?.email || "");
  const city = String(contact.clinic?.city || "");
  const fields: Array<{ field: SearchField; label: string; value: string }> = [
    { field: "name", label: "meno kontaktu", value: doctor },
    { field: "name", label: "názov kliniky", value: clinic },
    { field: "phone", label: "telefón", value: phone },
    { field: "email", label: "e-mail", value: email },
    { field: "city", label: "mesto", value: city },
  ];
  const matches = query.trim() ? fields.filter(item =>
    (field === "all" || field === item.field) && normalize(item.value).includes(normalize(query.trim())),
  ).map(item => item.label) : [];
  return <>
    <span className="enriched-card-main">
      <span className="priority-builder-avatar"><UserRound size={16} /></span>
      <span className="enriched-card-ident">
        <span className="enriched-eyebrow">Kontaktná osoba</span>
        <strong className="enriched-person"><Mark value={doctor || "Meno kontaktu neuvedené"} query={query} /></strong>
      </span>
    </span>
    <span className="enriched-clinic"><Building2 size={13} /><Mark value={clinic || "Klinika neuvedená"} query={query} /></span>
    {specialty && <span className="enriched-specialty"><Stethoscope size={13} /><Mark value={specialty} query={query} /></span>}
    <span className="enriched-contact-grid">
      <span className={!phone ? "missing" : ""}><Phone size={13} /><Mark value={phone || "Telefón neuvedený"} query={query} /></span>
      <span className={!email ? "missing" : ""}><Mail size={13} /><Mark value={email || "E-mail neuvedený"} query={query} /></span>
    </span>
    {matches.length > 0 && <span className="enriched-match-line"><Search size={11} />Zhoda: {matches.join(" · ")}</span>}
  </>;
}

export function Enriched() {
  return <div className="priority-search-enriched">
    <Current showSearchCount renderIdentity={(contact, query, field) =>
      <ContactIdentity contact={contact} query={query} field={field} />
    } />
  </div>;
}

export default Enriched;