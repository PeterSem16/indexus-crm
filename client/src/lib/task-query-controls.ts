import { MANUAL_PULSE_TASK_TAG } from "@shared/task-provenance";

export type TaskDatePreset = "all" | "today" | "week" | "month" | "custom";
export type TaskDateBasis = "created" | "due" | "resolved";
export type TaskSortField = "created" | "due" | "resolved" | "priority" | "title";
export type DateRange = { from: string; to: string };

type TaskLike = {
  id?: string;
  title?: string | null;
  description?: string | null;
  assignedUserId?: string | null;
  createdByUserId?: string | null;
  resolvedByUserId?: string | null;
  createdAt?: string | Date | null;
  dueDate?: string | Date | null;
  resolvedAt?: string | Date | null;
  priority?: string | null;
};

const bratislavaDate = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bratislava", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value || "01";
  return { year: Number(part("year")), month: Number(part("month")), day: Number(part("day")) };
};

const utcDateOnly = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export function getTaskPresetRange(preset: Exclude<TaskDatePreset, "all" | "custom">, now = new Date()): DateRange {
  const { year, month, day } = bratislavaDate(now);
  const today = new Date(Date.UTC(year, month - 1, day));
  if (preset === "today") return { from: utcDateOnly(year, month, day), to: utcDateOnly(year, month, day) };
  if (preset === "month") return { from: utcDateOnly(year, month, 1), to: utcDateOnly(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate()) };
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: utcDateOnly(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate()), to: utcDateOnly(sunday.getUTCFullYear(), sunday.getUTCMonth() + 1, sunday.getUTCDate()) };
}

function localDateKey(value: unknown): string | null {
  if (!value) return null;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = value instanceof Date ? value : new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const { year, month, day } = bratislavaDate(date);
  return utcDateOnly(year, month, day);
}

export function filterTasksByDate<T extends TaskLike>(
  tasks: T[],
  options: { preset: TaskDatePreset; basis: TaskDateBasis; range: DateRange },
): T[] {
  if (options.preset === "all") return tasks;
  const from = options.preset === "custom" ? options.range.from || "0000-01-01" : getTaskPresetRange(options.preset).from;
  const to = options.preset === "custom" ? options.range.to || "9999-12-31" : getTaskPresetRange(options.preset).to;
  if (options.preset === "custom" && !options.range.from && !options.range.to) return tasks;
  return tasks.filter(task => {
    const dateField = options.basis === "created" ? "createdAt" : options.basis === "due" ? "dueDate" : "resolvedAt";
    const value = localDateKey((task as Record<string, unknown>)[dateField]);
    return !!value && value >= from && value <= to;
  });
}

const priorityRank: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

export function sortTasks<T extends TaskLike>(tasks: T[], field: TaskSortField, direction: "asc" | "desc"): T[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...tasks].sort((a, b) => {
    let result = 0;
    if (field === "title") result = String(a.title || "").localeCompare(String(b.title || ""), undefined, { sensitivity: "base" });
    else if (field === "priority") result = (priorityRank[String(a.priority || "").toLowerCase()] || 0) - (priorityRank[String(b.priority || "").toLowerCase()] || 0);
    else {
      const key = field === "created" ? "createdAt" : field === "due" ? "dueDate" : "resolvedAt";
      const aValue = (a as Record<string, unknown>)[key];
      const bValue = (b as Record<string, unknown>)[key];
      const av = aValue ? new Date(String(aValue)).getTime() : Number.NaN;
      const bv = bValue ? new Date(String(bValue)).getTime() : Number.NaN;
      result = Number.isNaN(av) ? (Number.isNaN(bv) ? 0 : -1) : Number.isNaN(bv) ? 1 : av - bv;
    }
    return result === 0 ? String(a.id || "").localeCompare(String(b.id || "")) : result * sign;
  });
}

export function taskMatchesDatePreset<T extends TaskLike>(
  tasks: T[],
  options: { preset: TaskDatePreset; basis: TaskDateBasis; range: DateRange },
) {
  return filterTasksByDate(tasks, options);
}

export function matchesTaskPeopleAndSearch<T extends TaskLike>(
  task: T,
  options: {
    creatorId?: string;
    resolverId?: string;
    query?: string;
    people: Array<{ id: string; fullName?: string | null; username?: string | null }>;
    formatText?: (value: unknown) => string;
  },
): boolean {
  const record = task as Record<string, unknown>;
  if (options.creatorId && record.createdByUserId !== options.creatorId) return false;
  if (options.resolverId && record.resolvedByUserId !== options.resolverId) return false;
  const query = options.query?.trim().toLocaleLowerCase();
  if (!query) return true;
  const people = new Map(options.people.map(person => [person.id, person]));
  const names = [record.assignedUserId, record.createdByUserId, record.resolvedByUserId]
    .map(id => typeof id === "string" ? people.get(id) : undefined)
    .flatMap(person => person ? [person.fullName, person.username] : []);
  const text = options.formatText || (value => String(value || ""));
  return [text(record.title), text(record.description), ...names]
    .filter(Boolean).join(" ").toLocaleLowerCase().includes(query);
}

export function isPulseStatusListTask(task: { relatedEntityType?: string | null; tags?: string[] | null }) {
  return task.relatedEntityType === "status_list_item" || (task.tags || []).includes("status_list");
}

export function isPulseNotificationTask(task: { relatedEntityType?: string | null; tags?: string[] | null }) {
  return isPulseStatusListTask(task) || (task.tags || []).includes(MANUAL_PULSE_TASK_TAG);
}

export function requiresPulseResolutionForCompletion(
  task: { status?: string | null; relatedEntityType?: string | null; tags?: string[] | null },
  nextStatus: string,
  resolution: string,
): boolean {
  return task.status !== "completed"
    && nextStatus === "completed"
    && isPulseNotificationTask(task)
    && !resolution.trim();
}

export function clampTaskPage(page: number, totalPages: number, activeTab: string): number {
  return activeTab === "tasks" ? Math.min(page, Math.max(0, totalPages - 1)) : page;
}

export function getFreshTaskById<T extends { id: string }>(tasks: T[] | undefined, id: string): T | null {
  return tasks?.find(task => task.id === id) || null;
}

export function getTaskGroupId(tags: string[] = []): string {
  return tags.find(tag => tag.startsWith("group_id:"))?.slice("group_id:".length) || "";
}

export function chooseTaskGroupForSave(latestTags: string[] = [], formGroupId: string, groupWasEdited: boolean): string {
  return groupWasEdited ? formGroupId : getTaskGroupId(latestTags);
}