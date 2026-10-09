import { and, eq, isNull } from "drizzle-orm";
import { clinics, hospitals, clinicRepresentativeAssignments, hospitalRepresentativeAssignments } from "@shared/schema";

/** Caller supplies a transaction. Every writer locks the institution before changing its temporal history. */
export async function assignMedicalPartnerRepresentative(tx: any, input: {
  entityType: "clinic" | "hospital"; entityId: string; userId: string;
  assignedBy: string; assignmentType: string; validFrom?: Date; note?: string | null;
}) {
  const entity = input.entityType === "clinic" ? clinics : hospitals;
  const assignments = input.entityType === "clinic" ? clinicRepresentativeAssignments : hospitalRepresentativeAssignments;
  const key = input.entityType === "clinic" ? clinicRepresentativeAssignments.clinicId : hospitalRepresentativeAssignments.hospitalId;
  const [before] = await tx.select().from(entity).where(eq(entity.id, input.entityId)).for("update");
  if (!before) throw new Error("Institution unavailable");
  const current = await tx.select().from(assignments).where(and(eq(key, input.entityId), isNull(assignments.validTo))).for("update");
  if (input.assignmentType === "automation" && current.length === 1 && current[0].userId === input.userId) {
    if (before.representativeId === input.userId) return { before, after: before, assignment: current[0], changed: false };
    const [after] = await tx.update(entity).set({ representativeId: input.userId }).where(eq(entity.id, input.entityId)).returning();
    return { before, after, assignment: current[0], changed: true };
  }
  const now = input.validFrom || new Date();
  if (input.assignmentType === "automation" && current.some((row: any) => row.validFrom > now))
    throw new Error("A future representative assignment needs explicit review; no history was changed");
  await tx.update(assignments).set({ validTo: now }).where(and(eq(key, input.entityId), isNull(assignments.validTo)));
  const [assignment] = await tx.insert(assignments).values({
    [input.entityType === "clinic" ? "clinicId" : "hospitalId"]: input.entityId,
    userId: input.userId, validFrom: now, validTo: null, assignedBy: input.assignedBy,
    assignmentType: input.assignmentType, note: input.note || null,
  }).returning();
  const [after] = await tx.update(entity).set({ representativeId: input.userId }).where(eq(entity.id, input.entityId)).returning();
  return { before, after, assignment, changed: true };
}
