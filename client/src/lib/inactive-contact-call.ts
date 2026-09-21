export type MissionContactEntityType = "customer" | "hospital" | "clinic" | "collaborator";

export function isMissionContactInactive(
  contactType: MissionContactEntityType | string | null | undefined,
  entity: Record<string, unknown> | null | undefined,
): boolean {
  if (!entity) return false;
  if (contactType === "customer") {
    return String(entity.status || "").toLowerCase() === "inactive";
  }
  if (contactType === "hospital" || contactType === "clinic" || contactType === "collaborator") {
    return entity.isActive === false;
  }
  return false;
}