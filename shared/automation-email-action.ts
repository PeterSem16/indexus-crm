export type AutomationEmailTarget = { kind: "user" | "group" | "role"; id: string };
export const EMAIL_RECIPIENT_LIMIT = 100;
export const EMAIL_ATTACHMENT_MAX_FILES = 5;
export const EMAIL_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const EMAIL_ATTACHMENT_TOTAL_BYTES = 25 * 1024 * 1024;

/** Snapshots contain bytes, never URLs or caller-selected server paths. */
export function emailAttachmentIssues(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > EMAIL_ATTACHMENT_MAX_FILES) return ["Email accepts at most five attachments"];
  let total = 0;
  for (const item of value) {
    if (!item || typeof item.name !== "string" || !item.name.trim() || item.name.length > 200 ||
        /[\r\n\0]/.test(item.name) || typeof item.contentType !== "string" ||
        !/^[\w.+-]+\/[\w.+-]+$/.test(item.contentType) ||
        typeof item.contentBase64 !== "string" || !item.contentBase64 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(item.contentBase64) ||
        item.url || item.filePath)
      return ["Email attachments must contain copied file content"];
    const size = item.contentBase64.length * 3 / 4 - (item.contentBase64.endsWith("==") ? 2 : item.contentBase64.endsWith("=") ? 1 : 0);
    total += size;
    if (size > EMAIL_ATTACHMENT_MAX_BYTES || total > EMAIL_ATTACHMENT_TOTAL_BYTES)
      return ["Email attachments exceed the permitted size"];
  }
  return [];
}

export function validEmailTargets(value: unknown): value is AutomationEmailTarget[] {
  return Array.isArray(value) && value.length <= EMAIL_RECIPIENT_LIMIT &&
    value.every(target => target && typeof target === "object" &&
      ["user", "group", "role"].includes(target.kind) &&
      typeof target.id === "string" && !!target.id.trim() && target.id.length <= 200 &&
      !/[{}[\]\r\n]/.test(target.id));
}

export function emailAddressList(value: unknown): string[] {
  if (value == null || value === "") return [];
  const parts = (Array.isArray(value) ? value : [value])
    .flatMap(item => String(item).split(/[,;\s]+/)).filter(Boolean);
  if (parts.some(part => !/^[^@\s<>,;{}]+@[^@\s<>,;{}]+\.[^@\s<>,;{}]+$/.test(part)))
    throw new Error("Email recipients contain an invalid or unresolved address");
  return [...new Set(parts.map(part => part.toLowerCase()))];
}

export type EmailCardSource = "main" | "persons";
export function validEmailCardSources(value: unknown): value is EmailCardSource[] {
  return Array.isArray(value) && value.length <= 2 &&
    value.every(source => source === "main" || source === "persons") &&
    new Set(value).size === value.length;
}

export function emailActionIssues(config: any): string[] {
  if (config?.emailActionVersion !== 2) return [];
  const issues: string[] = [];
  issues.push(...emailAttachmentIssues(config.attachments));
  for (const field of ["to", "cc", "bcc"])
    if (config[`${field}CardSources`] !== undefined && !validEmailCardSources(config[`${field}CardSources`]))
      issues.push(`Invalid ${field} card recipients`);
  for (const key of ["toTargets", "ccTargets", "bccTargets"])
    if (config[key] !== undefined && !validEmailTargets(config[key])) issues.push(`Invalid ${key}`);
  if (!["personal", "system"].includes(config.senderMode || "system")) issues.push("Unknown email sender mode");
  if (config.includeSystemSignature != null && typeof config.includeSystemSignature !== "boolean")
    issues.push("System signature must be a boolean");
  if (config.senderMode === "personal" && config.includeSystemSignature) issues.push("Personal email cannot use a country system signature");
  if (config.senderDisplayName != null &&
      (typeof config.senderDisplayName !== "string" || config.senderDisplayName.length > 100 ||
       /[{}\r\n]/.test(config.senderDisplayName))) issues.push("Invalid sender display name");
  if (typeof config.subject !== "string" || !config.subject.trim()) issues.push("Email subject is required");
  if (typeof config.body !== "string" || !config.body.trim()) issues.push("Email body is required");
  if (!config.to && !config.toTargets?.length && !config.toCardSources?.length && !config.taskGroupId && !config.targetRole)
    issues.push("At least one To recipient is required");
  for (const key of ["to", "cc", "bcc"]) {
    if (config[key] != null && typeof config[key] !== "string" &&
        !(Array.isArray(config[key]) && config[key].every((item: unknown) => typeof item === "string")))
      issues.push(`Invalid ${key} addresses`);
    else if (config[key] && !/\{\{/.test(String(config[key]))) {
      try { emailAddressList(config[key]); } catch { issues.push(`Invalid ${key} addresses`); }
    }
  }
  return issues;
}
