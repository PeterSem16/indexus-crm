import { taskStatusTemplateLabel } from "@shared/task-status-labels";

export type ReferenceKind = "user" | "department" | "group" | "customer" | "clinic" | "hospital" | "collaborator" | "campaign" | "queue" | "task" | "contract" | "invoice";
export type ReferenceLookup = (kind: ReferenceKind, id: string, country: string | null) => Promise<string | null>;
export type DisplayValues = ReadonlyMap<string, string>;

const references: Record<string, ReferenceKind> = {
  assignedUserId: "user", createdByUserId: "user", resolvedByUserId: "user",
  representativeId: "user", agentId: "user", assignedAgentId: "user",
  assignedDepartmentId: "department", taskGroupId: "group",
  taskGroupIds: "group", resolvedByGroupIds: "group",
  customerId: "customer", clinicId: "clinic", hospitalId: "hospital",
  collaboratorId: "collaborator", campaignId: "campaign", queueId: "queue",
};
const contactKinds = new Set(["customer", "clinic", "hospital", "collaborator"]);
export function templatePath(ctx: any, path: string): any {
  return path.split(".").reduce((value, key) =>
    ["__proto__", "prototype", "constructor"].includes(key) ? undefined : value?.[key], ctx);
}

/** Resolve only references explicitly used in content, never mutate event IDs. */
export async function automationDisplayValues(ctx: any, content: unknown[], lookup: ReferenceLookup, language?: string): Promise<DisplayValues> {
  const paths = new Set<string>();
  const scan = (value: unknown) => {
    if (typeof value === "string")
      for (const match of value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) paths.add(match[1]);
    else if (Array.isArray(value)) value.forEach(scan);
  };
  content.forEach(scan);
  const result = new Map<string, string>();
  const cache = new Map<string, Promise<string | null>>();
  const country = ctx.event?.countryCode || ctx.countryCode || ctx.newValues?.countryCode || ctx.newValues?.country || null;
  await Promise.all([...paths].map(async path => {
    const match = /^(newValues|oldValues)\.([A-Za-z]+)$/.exec(path);
    if (!match) return;
    const [, scope, field] = match;
    const data = ctx[scope] || {};
    if (field === "status" && ctx.event?.module === "task" && language && data.status != null) {
      result.set(path, taskStatusTemplateLabel(data.status, language));
      return;
    }
    let kind = references[field];
    if (field === "relatedEntityId") {
      const type = data.relatedEntityType || ctx.newValues?.relatedEntityType;
      if (contactKinds.has(type) || ["campaign", "task", "contract", "invoice"].includes(type)) kind = type;
      else if (data[field] != null && data[field] !== "") throw new Error(`Template reference type is unavailable: ${path}`);
      else return;
    }
    const contactType = data.contactType || ctx.newValues?.contactType;
    if (field === "customerId" && ["communication", "call"].includes(ctx.event?.module) && contactType) {
      if (!contactKinds.has(contactType)) throw new Error(`Template reference type is unavailable: ${path}`);
      kind = contactType;
    }
    if (!kind) return; // IDs explicitly labelled as IDs (id, callLogId, etc.) stay technical.
    const raw = templatePath(ctx, path);
    if (raw == null || raw === "" || (Array.isArray(raw) && !raw.length)) {
      result.set(path, "");
      return;
    }
    const ids = Array.isArray(raw) ? raw : [raw];
    const labels = await Promise.all(ids.map(async id => {
      if (typeof id !== "string" || !id.trim()) throw new Error(`Template reference is invalid: ${path}`);
      const key = JSON.stringify([kind, id, country]);
      if (!cache.has(key)) cache.set(key, lookup(kind, id, country));
      const label = await cache.get(key);
      if (!label?.trim() || label.trim() === id.trim()) throw new Error(`Template reference is unavailable: ${path}`);
      return label;
    }));
    result.set(path, [...new Set(labels)].join(", "));
  }));
  return result;
}

export function renderAutomationText(value: unknown, ctx: any, display: DisplayValues, strict = true): string {
  const source = String(value ?? "");
  return source.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_token, path, offset) => {
    const resolved = display.has(path) && !templateTokenInUrl(source, offset) ? display.get(path) : templatePath(ctx, path);
    if (resolved == null && strict) throw new Error(`Task variable is unavailable: ${path}`);
    return resolved == null ? "" : String(resolved);
  });
}

/** Technical URL occurrences remain IDs even when the same token is a label elsewhere. */
export function templateTokenInUrl(source: string, offset: number): boolean {
  return /(?:\bhttps?:\/\/|(?:^|[\s("'=])\/[A-Za-z])[^\s"'<>)]*$/.test(source.slice(0, offset));
}

export function taskDisplayContent(config: any, ctx: any, display: DisplayValues) {
  const result: Record<string, unknown> = {};
  for (const field of ["title", "description", "taskText"])
    if (config[field] !== undefined) result[field] = renderAutomationText(config[field], ctx, display, config.taskText !== undefined);
  if (Array.isArray(config.checklist)) result.checklist = config.checklist.map((item: unknown) =>
    typeof item === "string" ? renderAutomationText(item, ctx, display, config.taskText !== undefined) : item);
  return result;
}
