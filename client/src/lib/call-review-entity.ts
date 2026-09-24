import type { EntityRef } from "@/components/entity-detail-drawer";

export interface CallReviewEntityIdentity {
  type: "customer" | "clinic" | "hospital" | "collaborator";
  entityId: string | null;
}

export function fullCardEntityFromReview(review: CallReviewEntityIdentity): EntityRef | null {
  if (!review.entityId?.trim()) return null;
  if (review.type !== "customer" && review.type !== "clinic" && review.type !== "hospital") return null;
  return { type: review.type, id: review.entityId };
}