import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WorkflowAnswer, WorkflowCatalogItem } from "@shared/status-list-workflow";
import type { StatusListRepresentativeInformation } from "@shared/status-list-representative-information";
import type { RepresentativeCheckConfig } from "@shared/status-list-representative-check";

export type WorkflowContactData = {
  representativeInformation?: StatusListRepresentativeInformation[];
  representativeChecks?: Array<{ questionId: string; config: RepresentativeCheckConfig }>;
  executionIssues?: Array<{ automationId: string; eventKey: string; status: string; createdAt: string; itemLabel?: string }>;
  answers: Record<string, WorkflowAnswer>;
  answerMetadata?: Record<string, { answeredAt: string | null; answeredByName: string | null; actorKind: string | null }>;
  questionNotes?: Record<string, { note: string | null; updatedAt: string | null; updatedByName: string | null }>;
  runs: Array<{ id: string; ruleName: string; branch: string; results: unknown[]; createdAt: string; actorName: string }>;
  catalog: WorkflowCatalogItem[];
};
export const workflowContactKey = (campaignId?: string, contactId?: string | null) =>
  ["/api/campaigns", campaignId, "contacts", contactId, "status-list-workflows"] as const;

export function useStatusListWorkflowContact(campaignId?: string, contactId?: string | null) {
  const queryKey = workflowContactKey(campaignId, contactId);
  const query = useQuery<WorkflowContactData>({
    queryKey, enabled: !!campaignId && !!contactId,
    staleTime: 0, refetchOnMount: "always",
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/contacts/${contactId}/status-list-workflows`, { credentials: "include" });
      if (!response.ok) throw new Error("workflow_load_failed");
      return response.json();
    },
  });
  const save = useCallback(async (questionId: string, value: WorkflowAnswer | null) => {
    if (!campaignId || !contactId) throw new Error("workflow_contact_required");
    await apiRequest("PUT", `/api/campaigns/${campaignId}/contacts/${contactId}/status-list-workflows/answers/${questionId}`, { value });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: workflowContactKey(campaignId, contactId) }),
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "contacts", contactId, "status-list-state"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "contacts", contactId, "history"] }),
    ]);
  }, [campaignId, contactId]);
  return { ...query, save };
}
