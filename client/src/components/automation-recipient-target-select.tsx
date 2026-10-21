import { Building2, Mail, UserRound, UsersRound } from "lucide-react";
import { useI18n } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Group = { id: string; name: string; displayAlias?: string | null; color?: string | null; members?: unknown[]; isBackOffice?: boolean };
type Role = { id: string; name: string; description?: string | null; isActive?: boolean };
type UserOption = { id: string; label: string };

export function AutomationRecipientTargetSelect({
  mode, config, userOptions, departments = [], groups, roles, onChange, index,
}: {
  mode: "task" | "notify" | "email";
  config: Record<string, any>;
  userOptions: UserOption[];
  departments?: { id: string; name: string }[];
  groups: Group[];
  roles: Role[];
  onChange: (config: Record<string, any>) => void;
  index: number;
}) {
  const { t } = useI18n();
  const labels = t.automationServices.routing;
  const value = config.taskGroupId ? `group:${config.taskGroupId}`
    : config.targetRole ? `role:${config.targetRole.replace(/^role:/, "")}`
      : mode === "email" ? "address"
        : config.assignedDepartmentId ? `department:${config.assignedDepartmentId}`
          : mode === "notify" && config.userIds?.length ? "multi"
            : (mode === "task" ? config.assignedUserId : config.userId)
              ? `user:${mode === "task" ? config.assignedUserId : config.userId}`
                : "";
  const choose = (selected: string) => {
    if (selected === "multi") return;
    const { assignedUserId, assignee_user_id, assignedDepartmentId, assignee_department_id,
      userId, userIds, taskGroupId, targetRole, to, ...rest } = config;
    const [kind, ...parts] = selected.split(":");
    const id = parts.join(":");
    if (kind === "group") onChange({ ...rest, taskGroupId: id });
    else if (kind === "role") onChange({ ...rest, targetRole: `role:${id}` });
    else if (kind === "department") onChange({ ...rest, assignedDepartmentId: id });
    else if (kind === "user") onChange({ ...rest, [mode === "task" ? "assignedUserId" : "userId"]: id });
    else if (kind === "address") onChange({ ...rest, to: "" });
  };
  const group = groups.find(item => item.id === config.taskGroupId);
  return <div className={mode === "email" ? "md:col-span-2" : ""}>
    <Label className="text-xs">{labels.recipient}</Label>
    <Select value={value} onValueChange={choose}>
      <SelectTrigger className="h-9 text-xs" data-testid={`select-recipient-target-${index}`}>
        <SelectValue placeholder={labels.choose} />
      </SelectTrigger>
      <SelectContent className="automation-rule-select-content">
        {mode === "email" && <SelectItem value="address"><span className="inline-flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-emerald-600" />{labels.emailAddress}</span></SelectItem>}
        {mode !== "email" && userOptions.length > 0 && <>
          <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">{labels.users}</div>
          {mode === "notify" && config.userIds?.length > 0 && <SelectItem value="multi">{labels.users} ({config.userIds.length})</SelectItem>}
          {userOptions.map(user => <SelectItem key={user.id} value={`user:${user.id}`}>
            <span className="inline-flex items-center gap-2"><UserRound className="h-3.5 w-3.5 text-blue-600" />{user.label}</span>
          </SelectItem>)}
        </>}
        {mode === "task" && departments.length > 0 && <>
          <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">{labels.departments}</div>
          {departments.map(department => <SelectItem key={department.id} value={`department:${department.id}`}>
            <span className="inline-flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-cyan-600" />{department.name}</span>
          </SelectItem>)}
        </>}
        <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">{labels.groups}</div>
        {groups.map(item => <SelectItem key={item.id} value={`group:${item.id}`}>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color || "#3b82f6" }} />
            {item.displayAlias || item.name} <span className="text-muted-foreground">({item.members?.length || 0})</span>
            {item.isBackOffice && <Badge variant="secondary" className="text-[9px]">{labels.backOffice}</Badge>}
          </span>
        </SelectItem>)}
        <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">{labels.roles}</div>
        {roles.filter(role => role.isActive !== false).map(role => <SelectItem key={role.id} value={`role:${role.name}`}>
          <span className="inline-flex items-center gap-2"><UsersRound className="h-3.5 w-3.5 shrink-0 text-violet-600" />{role.name}{role.description && <span className="max-w-56 truncate text-muted-foreground" title={role.description}>— {role.description}</span>}</span>
        </SelectItem>)}
      </SelectContent>
    </Select>
    {mode === "task" && group?.isBackOffice && <p className="mt-1 text-[11px] text-muted-foreground">{labels.sharedTask}</p>}
    {mode === "task" && group && !group.isBackOffice && <p className="mt-1 text-[11px] text-muted-foreground">{labels.memberTasks}</p>}
    {mode === "email" && (config.taskGroupId || config.targetRole) && <p className="mt-1 text-[11px] text-muted-foreground">{labels.memberEmail}</p>}
  </div>;
}
