export type ActivityTemplateVariable = { value: string; label: string };
export type ActivityTemplateLike = {
  id: string;
  subject?: unknown;
  description?: unknown;
  content?: unknown;
  contentHtml?: unknown;
};

const VARIABLE_PATTERN = /{{\s*([^{}]+?)\s*}}/g;

export function isActivityCatalogTemplate(id: string): boolean {
  return id.startsWith("indexus-activity-");
}

export function activityTemplateSourceModule(id: string): string | null {
  if (!isActivityCatalogTemplate(id)) return null;
  const parts = id.toLowerCase().split("-");
  if (parts[3] === "analysis") return "analysis";
  return parts[3] || null;
}

export function activityTemplateUsedVariables(template: ActivityTemplateLike): string[] {
  const texts = [template.subject, template.description, template.content, template.contentHtml]
    .filter((text): text is string => typeof text === "string");
  return Array.from(new Set(texts.flatMap(text =>
    Array.from(text.matchAll(VARIABLE_PATTERN), match => match[1].trim()),
  )));
}

export function filterActivityCatalogTemplates<T extends ActivityTemplateLike>(
  templates: T[],
  sourceModule: string | undefined,
  availableVariables: ActivityTemplateVariable[],
): T[] {
  const selectedSource = sourceModule === "communication" ? "analysis" : sourceModule;
  const available = new Set(availableVariables.map(({ value }) => value.replace(/^{{\s*|\s*}}$/g, "").trim()));

  // Never silently hide a catalog entry. Editors label/disable unsupported
  // variables; compatible templates from the selected source appear first.
  const score = (template: T) => {
    const supported = activityTemplateUsedVariables(template).every(variable => available.has(variable));
    const matches = !selectedSource || !isActivityCatalogTemplate(template.id) || activityTemplateSourceModule(template.id) === selectedSource;
    return (supported ? 0 : 2) + (matches ? 0 : 1);
  };
  return [...templates].sort((a, b) => score(a) - score(b));
}
export function activityTemplateMissingVariables(template: ActivityTemplateLike, availableVariables: ActivityTemplateVariable[]): string[] {
  const available = new Set(availableVariables.map(({ value }) => value.replace(/^{{\s*|\s*}}$/g, "").trim()));
  return activityTemplateUsedVariables(template).filter(value => !available.has(value));
}

export type ActivityTemplateIconKind = "phone" | "inbound" | "outbound" | "email" | "message" | "task" | "notification" | "customer" | "clinic" | "hospital" | "contract" | "invoice" | "campaign" | "collection" | "product" | "metric";

export function activityTemplateIconKind(id: string, type?: string): ActivityTemplateIconKind | null {
  if (/call|phone|inbound|outbound/.test(id)) return /outbound/.test(id) ? "outbound" : /inbound/.test(id) ? "inbound" : "phone";
  for (const kind of ["customer", "clinic", "hospital", "contract", "invoice", "campaign", "collection", "product", "metric"] as const)
    if (id.includes(kind)) return kind;
  if (!isActivityCatalogTemplate(id)) {
    if (/task/.test(id) || type === "task") return "task";
    if (/sms|chat/.test(id) || type === "sms") return "message";
    if (/email/.test(id) || type === "email") return "email";
    if (/notification/.test(id) || type === "notification") return "notification";
    return "notification";
  }
  const parts = id.toLowerCase().split("-");
  const sourceModule = activityTemplateSourceModule(id);
  const channel = parts[3] === "analysis" ? parts[4] : "";
  const slug = parts.slice(parts[3] === "analysis" ? 5 : 4, -1).join("-");
  if (sourceModule === "call" || parts[2] === "call" || ["inbound", "outbound", "voice"].includes(channel)) {
    if (channel === "inbound" || /inbound|incoming|received/.test(slug)) return "inbound";
    if (channel === "outbound" || /outbound|outgoing|started/.test(slug)) return "outbound";
    return "phone";
  }
  if (channel === "email" || parts[2] === "email") return "email";
  if (["sms", "chat"].includes(channel) || parts[2] === "sms") return "message";
  if (channel === "task" || parts[2] === "task") return "task";
  if (parts[2] === "notification") return "notification";
  return null;
}
