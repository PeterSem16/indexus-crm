import type { TaskAssignmentTriggerTarget } from "@shared/task-automation";
import { UsersRound, UserRound, ListFilter } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AutomationChoicePicker, type AutomationChoice } from "./automation-choice-picker";

export function AutomationTaskAssignmentFilter({
  target, groups, users, onChange,
}: {
  target?: TaskAssignmentTriggerTarget;
  groups: AutomationChoice[];
  users: AutomationChoice[];
  onChange: (target?: TaskAssignmentTriggerTarget) => void;
}) {
  const { t } = useI18n();
  const copy = t.automationServices.taskRules;
  const mode = target?.kind || "all";
  return (
    <div className="col-span-full space-y-2 pt-1" data-testid="task-assignment-trigger-filter">
      <Label>{copy.assignmentTargets}</Label>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={copy.assignmentTargets}>
        {([
          ["all", copy.allAssignments, ListFilter],
          ["groups", t.automationServices.routing.groups, UsersRound],
          ["users", t.automationServices.routing.users, UserRound],
        ] as const).map(([kind, label, Icon]) => (
          <Button key={kind} type="button" size="sm" variant={mode === kind ? "secondary" : "outline"}
            className="h-8 gap-1.5 text-xs" aria-pressed={mode === kind} data-testid={`task-trigger-target-${kind}`}
            onClick={() => { if (kind !== mode) onChange(kind === "all" ? undefined : { kind, ids: [] }); }}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}
          </Button>
        ))}
      </div>
      {target && <AutomationChoicePicker options={target.kind === "groups" ? groups : users}
        values={target.ids} onChange={ids => onChange({ ...target, ids })}
        label={copy.assignmentTargets} placeholder={t.automationServices.routing.choose} testId="task-trigger-target-values" />}
      <p className="text-xs text-muted-foreground">{copy.assignmentHint}</p>
    </div>
  );
}
