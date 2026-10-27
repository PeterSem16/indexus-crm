import { useMutation } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getStatusListRefinementCopy } from "@/i18n/status-list-refinement-translations";

type SourceKind = "representative_assigned" | "representative_assignment_type" | "reachability" | "coordinator";
export type SourceTarget = { questionId?: string; itemId?: string; groupId?: string; mapping?: Record<string, string> };
export function StatusListSourceTargetButton({ campaignId, locale, source, parentId, onCreated, disabled = false }: {
  campaignId: string; locale: string; source: SourceKind; parentId?: string; onCreated: (target: SourceTarget) => void; disabled?: boolean;
}) {
  const c = getStatusListRefinementCopy(locale);
  const { toast } = useToast();
  const background = source.startsWith("representative_");
  const create = useMutation({
    mutationFn: async () => {
      const label = source === "representative_assigned" ? c.assignedQuestion : source === "representative_assignment_type" ? c.assignmentQuestion : source === "reachability" ? c.reachabilityGroup : c.coordinatorGroup;
      const options = source === "reachability" ? {not_defined:c.notDefined,waiting:c.waiting,unreachable:c.unreachable,reachable:c.reachable}
        : source === "coordinator" ? {unassigned:c.unassigned,assigned:c.assigned} : undefined;
      const response = await apiRequest("POST", `/api/campaigns/${campaignId}/status-list-workflows/source-targets`, {source,label,...(parentId?{parentId}:{}),...(options?{options}:{})});
      return await response.json() as SourceTarget;
    },
    onSuccess: async target => {
      await Promise.all([
        queryClient.invalidateQueries({queryKey:["/api/campaigns",campaignId,"status-list"]}),
        queryClient.invalidateQueries({queryKey:["/api/campaigns",campaignId,"status-list-workflows"]}),
        queryClient.invalidateQueries({queryKey:[`/api/campaigns/${campaignId}/status-list-workflows/sources`]}),
        queryClient.invalidateQueries({queryKey:[`/api/campaigns/${campaignId}/status-list-workflows/option-sources`]}),
      ]);
      onCreated(target);
    },
    onError: () => toast({title:c.setupError,variant:"destructive"}),
  });
  return <Button type="button" size="sm" variant="outline" className="h-auto max-w-full whitespace-normal text-left" disabled={disabled || create.isPending}
    data-testid="status-list-create-source-target" onClick={() => create.mutate()}>
    {create.isPending ? <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin"/> : <Plus className="mr-2 h-4 w-4 shrink-0"/>}
    {background ? c.createQuestion : c.createGroup}
  </Button>;
}
