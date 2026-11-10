import * as XLSX from "xlsx";
import { contactKinds, type Candidate, type ContactKind } from "./mission-contact-load-plan";

const fields: Record<string, string[]> = {
  first_name: ["meno","first_name","firstname","krstne_meno","krstné_meno","lekar_meno"],
  last_name: ["priezvisko","last_name","lastname","surname","lekar_priezvisko"],
  name: ["nazov","name","název","názov"],
  phone: ["telefon","telefón","phone","tel","tel_1","telefon_1"],
  mobile2: ["telefon_2","telefón_2","phone_2","tel_2","mobile_2","mobil"],
  email: ["email","e-mail","e_mail","mail"],
  country: ["krajina","country","country_code","land","paese","tara","ország"],
  address: ["adresa","address","ulica_cislo","street_number"],
  city: ["mesto","city","obec"], postal_code: ["psc","postal_code","psč"],
  notes: ["extra_pole_1","extra_1","extra1","poznamka","poznámka","note"],
  full_name: ["plny_nazov","full_name","plný_názov"],
  contact_person: ["kontaktna_osoba","contact_person","kontaktná_osoba"],
  website: ["web","website","www"],
  title: ["lekar_titul","doctor_title","titul","titul_pred","title_before"],
  title_after: ["titul_za","title_after"],
  collaborator_type: ["typ_spoluprace","collaborator_type","typ_spolupráce"],
};
export function fileCandidates(file: { originalname: string; buffer: Buffer }, kind: unknown, defaultCountry: string): Candidate[] {
  if (!contactKinds.includes(kind as ContactKind) || !/\.(csv|txt|xlsx|xls)$/i.test(file.originalname)) throw Error("invalid_input");
  const type = kind as ContactKind;
  const csv = /\.(csv|txt)$/i.test(file.originalname);
  const content = csv ? file.buffer.toString("utf8").replace(/^\uFEFF/, "") : file.buffer;
  const workbook = XLSX.read(content, {
    type: csv ? "string" : "buffer", raw: true, sheetRows: 5002,
    ...(csv ? { FS: String(content).split("\n")[0].includes(";") ? ";" : "," } : {}),
  });
  if (workbook.SheetNames.length !== 1) throw Error("invalid_input");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "", raw: false });
  if (!rows.length || rows.length > 5000) throw Error("invalid_input");
  return rows.map((raw, i) => {
    const row = Object.fromEntries(Object.entries(raw).map(([k,v]) => [k.trim().toLowerCase(), String(v).trim()]));
    const value = (key: string) => fields[key].map(k => row[k]).find(Boolean) || "";
    const country = (value("country") || defaultCountry).toUpperCase();
    const person = type === "customer" || type === "collaborator";
    const name = person ? `${value("first_name")} ${value("last_name")}`.trim() : value("name");
    const data: Record<string, unknown> = {
      ...(person ? { first_name: value("first_name"), last_name: value("last_name") } : { name }),
      [type === "customer" ? "country" : "country_code"]: country,
      phone: value("phone") || null, email: value("email") || null,
    };
    if (type === "customer") Object.assign(data, {
      mobile: value("phone") || null, mobile_2: value("mobile2") || null,
      status: "active", client_status: "potential", lead_status: "cold",
      notes: value("notes") || null,
    });
    if (type === "collaborator") Object.assign(data, {
      country_codes: [country], title_before: value("title") || null,
      title_after: value("title_after") || null, mobile: value("mobile2") || value("phone") || null,
      collaborator_type: value("collaborator_type") || null,
    });
    if (type === "clinic" || type === "hospital") Object.assign(data, {
      [type === "clinic" ? "address" : "street_number"]: value("address") || null,
      city: value("city") || null, postal_code: value("postal_code") || null, is_active: true,
    });
    if (type === "clinic") Object.assign(data, {
      doctor_title: value("title") || null, doctor_first_name: value("first_name") || null,
      doctor_last_name: value("last_name") || null,
      doctor_name: [value("title"), value("first_name"), value("last_name")].filter(Boolean).join(" ") || null,
      website: value("website") || null, notes: value("notes") || null,
    });
    if (type === "hospital") Object.assign(data, { full_name: value("full_name") || name, contact_person: value("contact_person") || null });
    // Due dates must never be silently imported into a customer's birth date.
    const unsupportedDate = ["datum_ocakavaneho_porodu","dátum_očakávaného_pôrodu","expected_delivery_date","due_date","termin_porodu"].some(k => row[k]);
    const email = value("email");
    return { type, name, country, data, row: i + 2,
      ...(!name ? { error: "missing_name" } : email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? { error: "invalid_email" } : unsupportedDate ? { error: "unsupported_date_field" } : {}) };
  });
}
