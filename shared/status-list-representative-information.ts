/** Read-only institution assignment, never the Mission's assigned agent. */
export type StatusListRepresentativeInformation = {
  questionId: string;
  label: string;
  state: "assigned" | "unassigned" | "unknown";
  representativeName: string | null;
  actionState?: "available" | "none" | "pending" | "done" | "blocked" | "failed";
  batchDeferred?: boolean;
};
