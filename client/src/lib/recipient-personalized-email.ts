export type EmailPerson = {
  id: string; email: string; firstName: string; lastName: string;
  titleBefore: string; titleAfter: string;
};
export const normalizeRecipientEmail = (email: string) => email.trim().toLowerCase();
export const uniqueRecipientEmails = (emails: string[]) =>
  Array.from(new Map(emails.map(value => [normalizeRecipientEmail(value), value])).values());
const fields = new Set([
  "clinic.doctorName", "clinic.doctorTitle", "clinic.doctorFirstName", "clinic.doctorLastName",
  "clinic.doctorFullName", "clinic.doctorSalutation", "clinic.doctorSalutationFull", "clinic.doctorSalutationDoc", "clinic.email",
  "hospital.contactPerson", "hospital.contactPersonSalutation", "hospital.contactPersonSalutationFull", "hospital.contactPersonSalutationDoc", "hospital.email",
  "customer.firstName", "customer.lastName", "customer.fullName", "customer.salutation", "customer.salutationFull", "customer.email",
]);
const tokens = () => /{{\s*([^{}]+?)\s*}}/g;
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Resolve sender/institution fields now, but keep recipient fields editable and late-bound. */
export function preserveRecipientFields(source: string, resolveCommon: (value: string) => string): string {
  let prefix = "__PULSE_RECIPIENT_FIELD_";
  while (source.includes(prefix)) prefix += "_";
  const saved: string[] = [];
  const masked = source.replace(tokens(), (token, key: string) => {
    if (!fields.has(key.trim())) return token;
    saved.push(`{{${key.trim()}}}`);
    return `${prefix}${saved.length - 1}__`;
  });
  let resolved = resolveCommon(masked);
  saved.forEach((token, index) => { resolved = resolved.split(`${prefix}${index}__`).join(token); });
  return resolved;
}

export function recipientContext<T extends { contact?: any; clinic?: any; hospital?: any }>(
  base: T, email: string, people: EmailPerson[],
): T {
  const matches = people.filter(person => normalizeRecipientEmail(person.email) === normalizeRecipientEmail(email));
  const identities = new Set(matches.map(person => JSON.stringify([person.firstName, person.lastName, person.titleBefore, person.titleAfter])));
  if (identities.size > 1) throw new Error("ambiguous_recipient_identity");
  const person = matches[0];
  if (!person) return base;
  const name = [person.titleBefore, person.firstName, person.lastName, person.titleAfter].filter(Boolean).join(" ");
  return {
    ...base,
    contact: { ...base.contact, firstName: person.firstName, lastName: person.lastName, email },
    clinic: base.clinic ? { ...base.clinic, doctorTitle: person.titleBefore,
      doctorFirstName: person.firstName, doctorLastName: person.lastName, doctorTitleAfter: person.titleAfter, email } : base.clinic,
    hospital: base.hospital ? { ...base.hospital, contactPerson: name, email } : base.hospital,
  };
}

export function renderRecipientDraft(draft: string, resolve: (token: string) => string, html = false): string {
  return draft.replace(tokens(), (token, key: string) => fields.has(key.trim())
    ? (html ? escapeHtml(resolve(token)) : resolve(token)) : token);
}

/** Preserve untouched bindings; editing a recipient field explicitly turns it into literal text. */
export function editRecipientDraft(draft: string, edited: string, resolve: (token: string) => string, html = false): string {
  const bindings: Array<{ start: number; end: number; token: string }> = [];
  let old = "", offset = 0;
  for (const match of draft.matchAll(tokens())) {
    if (!fields.has(match[1].trim())) continue;
    old += draft.slice(offset, match.index);
    const value = html ? escapeHtml(resolve(match[0])) : resolve(match[0]);
    bindings.push({ start: old.length, end: old.length + value.length, token: match[0] });
    old += value;
    offset = match.index! + match[0].length;
  }
  old += draft.slice(offset);
  let prefix = 0, suffix = 0;
  while (prefix < Math.min(old.length, edited.length) && old[prefix] === edited[prefix]) prefix++;
  while (suffix < Math.min(old.length, edited.length) - prefix &&
    old[old.length - 1 - suffix] === edited[edited.length - 1 - suffix]) suffix++;
  let result = edited;
  for (const binding of bindings.reverse()) {
    const before = binding.end <= prefix;
    const after = binding.start >= old.length - suffix;
    if (!before && !after) continue;
    const delta = before ? 0 : edited.length - old.length;
    result = result.slice(0, binding.start + delta) + binding.token + result.slice(binding.end + delta);
  }
  return result;
}

/** HTML editing retains provenance even when the browser normalizes the whole document. */
export function recipientEditorHtml(draft: string, resolve: (token: string) => string): string {
  const doc = new DOMParser().parseFromString(draft, "text/html");
  const walker = doc.createTreeWalker(doc.body, 4);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    if (["STYLE", "SCRIPT"].includes(node.parentElement?.tagName || "")) continue;
    const fragment = doc.createDocumentFragment();
    let offset = 0, found = false;
    for (const match of node.data.matchAll(tokens())) {
      if (!fields.has(match[1].trim())) continue;
      found = true;
      fragment.append(doc.createTextNode(node.data.slice(offset, match.index)));
      const span = doc.createElement("span"), value = resolve(match[0]);
      span.setAttribute("data-pulse-recipient-field", match[1].trim());
      span.setAttribute("data-pulse-recipient-value", value);
      span.textContent = value;
      fragment.append(span);
      offset = match.index! + match[0].length;
    }
    if (found) { fragment.append(doc.createTextNode(node.data.slice(offset))); node.replaceWith(fragment); }
  }
  for (const element of doc.querySelectorAll("*")) {
    const attributes: Record<string, { source: string; rendered: string }> = {};
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name.startsWith("data-pulse-")) continue;
      if (!Array.from(attribute.value.matchAll(tokens())).some(match => fields.has(match[1].trim()))) continue;
      const rendered = renderRecipientDraft(attribute.value, resolve);
      attributes[attribute.name] = { source: attribute.value, rendered };
      element.setAttribute(attribute.name, rendered);
    }
    if (Object.keys(attributes).length)
      element.setAttribute("data-pulse-recipient-attributes", JSON.stringify(attributes));
  }
  return doc.head.innerHTML + doc.body.innerHTML;
}

export function readRecipientEditorHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const span of doc.querySelectorAll("span[data-pulse-recipient-field]")) {
    const key = span.getAttribute("data-pulse-recipient-field") || "";
    if (fields.has(key) && span.textContent === span.getAttribute("data-pulse-recipient-value"))
      span.replaceWith(doc.createTextNode(`{{${key}}}`));
    else span.replaceWith(...Array.from(span.childNodes));
  }
  for (const element of doc.querySelectorAll("[data-pulse-recipient-attributes]")) {
    try {
      const attributes = JSON.parse(element.getAttribute("data-pulse-recipient-attributes") || "{}");
      for (const [name, binding] of Object.entries(attributes) as Array<[string, { source: string; rendered: string }]>) {
        if (element.getAttribute(name) === binding.rendered) element.setAttribute(name, binding.source);
      }
    } catch { /* Explicitly edited metadata no longer represents a binding. */ }
    element.removeAttribute("data-pulse-recipient-attributes");
  }
  return doc.head.innerHTML + doc.body.innerHTML;
}

/** Only confirmed recipients are removed on partial failure; retries cannot resend those copies. */
export async function sendRecipientCopies(
  emails: string[], send: (email: string) => Promise<boolean | void>, confirmed: (email: string) => void,
): Promise<boolean> {
  for (const email of uniqueRecipientEmails(emails)) {
    if (await send(email) === false) return false;
    confirmed(email);
  }
  return true;
}
