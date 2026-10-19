import { z } from "zod";

export const statusListOrganizationSchema = z.object({
  categories: z.array(z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(60) })).max(50),
  assignments: z.record(z.string(), z.string().uuid()),
});
export type StatusListOrganization = z.infer<typeof statusListOrganizationSchema>;
export const emptyStatusListOrganization: StatusListOrganization = { categories: [], assignments: {} };
export const statusListOrganizationEditSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("create"), name: z.string().trim().min(1).max(60) }).strict(),
  z.object({ operation: z.literal("rename"), id: z.string().uuid(), name: z.string().trim().min(1).max(60) }).strict(),
  z.object({ operation: z.literal("remove"), id: z.string().uuid() }).strict(),
  z.object({ operation: z.literal("assign"), kind: z.enum(["item", "question"]), id: z.string().uuid(), categoryId: z.string().uuid().nullable() }).strict(),
]);

export function remapStatusListOrganization(source: unknown, itemIds: Map<string, string>, nextId: () => string): StatusListOrganization {
  const parsed = statusListOrganizationSchema.parse(source);
  const categoryIds = new Map(parsed.categories.map(category => [category.id, nextId()]));
  return {
    categories: parsed.categories.map(category => ({ ...category, id: categoryIds.get(category.id)! })),
    assignments: Object.fromEntries(Object.entries(parsed.assignments).flatMap(([id, category]) =>
      itemIds.has(id) && categoryIds.has(category) ? [[itemIds.get(id)!, categoryIds.get(category)!]] : [])),
  };
}
