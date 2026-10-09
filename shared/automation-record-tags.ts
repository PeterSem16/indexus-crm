import { UPDATE_RECORD_ENTITIES, UPDATE_RECORD_RELATIONS, type UpdateRecordTarget } from "./automation-update-record";

export const RECORD_TAG_ENTITY_TYPES = Object.keys(UPDATE_RECORD_ENTITIES);
export type RecordTagActionConfig = {
  recordTagActionVersion: 2;
  target: UpdateRecordTarget;
  tags: string[];
  acknowledged: boolean;
};
export const normalizeTagName = (value: string): string =>
  value.normalize("NFKC").trim().replace(/\s+/gu, " ");
export const tagKey = (value: string): string => normalizeTagName(value).toLowerCase();
export const PROTECTED_RECORD_TAG_NAMES = ["status_list", "back_office"];
export const PROTECTED_RECORD_TAG_PREFIXES = ["group_id:", "group:", "source_entity:", "system:", "__"];
export const isProtectedRecordTag = (value: string): boolean =>
  PROTECTED_RECORD_TAG_NAMES.includes(tagKey(value)) || PROTECTED_RECORD_TAG_PREFIXES.some(prefix => tagKey(value).startsWith(prefix));
export function visibleRecordTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  return input.filter((value): value is string => typeof value === "string" && Boolean(normalizeTagName(value)) &&
    !isProtectedRecordTag(value)).map(normalizeTagName).filter(value => {
      const key = tagKey(value);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
}
export function tagActionIssues(config: any, sourceModule: string): string[] {
  if (!config || config.recordTagActionVersion !== 2) return ["version"];
  const issues: string[] = [];
  const target = config.target;
  if (!target || !["event", "related", "selected"].includes(target.mode) ||
    !RECORD_TAG_ENTITY_TYPES.includes(target.entityType)) return ["target"];
  if (target.mode === "event" && target.entityType !== sourceModule) issues.push("eventTarget");
  if (target.mode === "selected" && (typeof target.recordId !== "string" || !target.recordId.trim() ||
    target.recordId.length > 200 || /[{}]/u.test(target.recordId))) issues.push("recordRequired");
  if (target.mode === "related" && !(UPDATE_RECORD_RELATIONS[sourceModule] || []).some(
    item => item.key === target.relation && (item.entityType === target.entityType || item.entityType === "dynamic"),
  )) issues.push("relation");
  if (target.mode !== "selected" && target.recordId) issues.push("target");
  if (config.acknowledged !== true) issues.push("acknowledge");
  if (["entityType", "entityId", "tag"].some(key => Object.hasOwn(config, key))) issues.push("legacy");
  if (!Array.isArray(config.tags) || !config.tags.length || config.tags.length > 20) return [...issues, "tagsRequired"];
  const seen = new Set<string>();
  for (const value of config.tags) {
    if (typeof value !== "string" || !normalizeTagName(value) || normalizeTagName(value).length > 64 ||
      /[{}\u0000-\u001f\u007f]/u.test(value)) { issues.push("tag"); continue; }
    if (isProtectedRecordTag(value)) issues.push("protectedTag");
    const key = tagKey(value);
    if (seen.has(key)) issues.push("duplicateTag");
    seen.add(key);
  }
  return issues;
}
export function recordTagsContain(input: unknown, tag: unknown): boolean {
  return typeof tag === "string" && Boolean(normalizeTagName(tag)) && !isProtectedRecordTag(tag) &&
    visibleRecordTags(input).some(value => tagKey(value) === tagKey(tag));
}
export function recordTagsLack(input: unknown, tag: unknown): boolean {
  return Array.isArray(input) && typeof tag === "string" && Boolean(normalizeTagName(tag)) &&
    !isProtectedRecordTag(tag) && !recordTagsContain(input, tag);
}
