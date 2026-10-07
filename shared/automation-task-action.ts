export type TaskActionRecipient = { kind: "user" | "group" | "role"; id: string };

export function validTaskActionRecipients(value: unknown): value is TaskActionRecipient[] {
  if (!Array.isArray(value) || !value.length || value.length > 100) return false;
  const keys = new Set<string>();
  return value.every(recipient => {
    if (!recipient || typeof recipient !== "object" ||
        Object.keys(recipient).some(key => !["kind", "id"].includes(key)) ||
        !["user", "group", "role"].includes(recipient.kind) ||
        typeof recipient.id !== "string" || !recipient.id.trim() || recipient.id.length > 200) return false;
    const key = `${recipient.kind}:${recipient.id}`;
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

/** Relative deadlines are elapsed time, not a local clock or a weekday policy. */
export function taskActionDeadline(config: { dueInHours?: unknown; dueAt?: unknown }, now: Date): Date | null {
  if (config.dueAt != null && config.dueAt !== "") {
    if (config.dueInHours != null && config.dueInHours !== "")
      throw new Error("Choose a relative or fixed task deadline, not both");
    const parts = typeof config.dueAt === "string" ? config.dueAt.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/,
    ) : null;
    if (!parts)
      throw new Error("The fixed task deadline must include its time zone");
    const [, year, month, day, hour, minute, second] = parts;
    if (+month < 1 || +month > 12 || +day < 1 ||
        +day > new Date(Date.UTC(+year, +month, 0)).getUTCDate() ||
        +hour > 23 || +minute > 59 || +(second || 0) > 59)
      throw new Error("Invalid fixed task deadline");
    const date = new Date(String(config.dueAt));
    if (!Number.isFinite(date.getTime())) throw new Error("Invalid fixed task deadline");
    return date;
  }
  if (config.dueInHours == null || config.dueInHours === "") return null;
  const hours = Number(config.dueInHours);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24 * 3650)
    throw new Error("Task deadline duration is invalid");
  const result = hours > 0 ? new Date(now.getTime() + hours * 3600_000) : null;
  if (result && !Number.isFinite(result.getTime())) throw new Error("Task deadline duration is invalid");
  return result;
}

/** Existing task cards already display description; keep both parts visible there. */
export function taskActionContent(config: { description?: unknown; taskText?: unknown }): string | null {
  return [config.description, config.taskText]
    .filter((value): value is string => typeof value === "string" && !!value.trim())
    .map(value => value.trim()).join("\n\n") || null;
}
