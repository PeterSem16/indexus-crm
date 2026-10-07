export type AutomationEmailTarget = { kind: "user" | "group" | "role"; id: string };
export const EMAIL_RECIPIENT_LIMIT = 100;

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

export function emailActionIssues(config: any): string[] {
  if (config?.emailActionVersion !== 2) return [];
  const issues: string[] = [];
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
  if (!config.to && !config.toTargets?.length && !config.taskGroupId && !config.targetRole)
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
