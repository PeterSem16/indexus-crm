import { emailAddressList, EMAIL_RECIPIENT_LIMIT, validEmailCardSources } from "../../shared/automation-email-action";

type Query = (text: string, values: any[]) => Promise<{ rows: any[] }>;
const fields = ["to", "cc", "bcc"] as const;

/** Resolve only the event's persisted institution; never accept draft-owned IDs,
 * copied addresses, another Mission contact, or a guessed country. */
export async function resolveAutomationEmailCardRecipients(config: any, context: any, query: Query) {
  for (const field of fields) {
    const sources = config[`${field}CardSources`];
    if (sources !== undefined && !validEmailCardSources(sources))
      throw new Error("Invalid card email recipient sources");
  }
  if (!fields.some(field => config[`${field}CardSources`]?.length)) return config;
  const event = context.event;
  const type = event?.entityType;
  const id = event?.entityId;
  const country = event?.countryCode;
  if (!["clinic", "hospital"].includes(type) ||
      !["string", "number"].includes(typeof id) || !String(id).trim() ||
      typeof country !== "string" || !/^[A-Z]{2}$/.test(country))
    throw new Error("Card email recipients require a verified clinic or hospital event and country");
  if (context.contact && (context.contact.type !== type || String(context.contact.id) !== String(id)))
    throw new Error("Card email event identity conflicts with its contact");
  const table = type === "clinic" ? "clinics" : "hospitals";
  const [card] = (await query(`SELECT email,country_code FROM ${table} WHERE id::text=$1`, [String(id)])).rows;
  if (!card || card.country_code?.toUpperCase() !== country)
    throw new Error("Card email recipients are outside the verified event country or the card no longer exists");
  let persons: string[] = [];
  if (fields.some(field => config[`${field}CardSources`]?.includes("persons"))) {
    const rows = (await query(`SELECT DISTINCT lower(btrim(p.email)) AS email
      FROM contact_assignments a JOIN collaborators p ON p.id=a.person_id
      WHERE a.entity_type=$1 AND a.entity_id=$2 AND a.is_active=true AND p.is_active=true
        AND (a.start_date IS NULL OR a.start_date<=now()) AND (a.end_date IS NULL OR a.end_date>now())
        AND nullif(btrim(p.email),'') IS NOT NULL
      ORDER BY email LIMIT ${EMAIL_RECIPIENT_LIMIT + 1}`, [type, String(id)])).rows;
    if (rows.length > EMAIL_RECIPIENT_LIMIT) throw new Error("Card email recipients exceed the 100-person limit");
    persons = rows.flatMap(row => emailAddressList(row.email));
  }
  const resolved = { ...config };
  for (const field of fields) {
    const sources = config[`${field}CardSources`] || [];
    if (!sources.length) continue;
    const added = [
      ...(sources.includes("main") ? emailAddressList(card.email) : []),
      ...(sources.includes("persons") ? persons : []),
    ];
    if (!added.length) throw new Error("The selected card recipients have no available email addresses");
    // The common planner subsequently deduplicates across To, CC, BCC and
    // internal targets and enforces the combined recipient limit before sending.
    resolved[field] = [...new Set([...emailAddressList(config[field]), ...added])].join(", ");
  }
  return resolved;
}
