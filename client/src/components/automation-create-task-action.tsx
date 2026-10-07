import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Check, ChevronDown, Clock3, Search, UsersRound, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskCreateDatePicker } from "@/components/tasks/task-create-controls";
import { useI18n } from "@/i18n";
import { getTaskActionCopy } from "@/i18n/automation-task-action-copy";
import "./automation-create-task-action.css";

type Recipient = { kind: "user" | "group" | "role"; id: string };
type UserOption = { id: string; label: string };
type GroupOption = { id: string; name: string; displayAlias?: string | null; members?: { userId: string }[] };
type RoleOption = { id: string; name: string; description?: string | null; isActive?: boolean };
type Template = { id: string; name: string; type: "task"; subject?: string; description?: string; content?: string; language?: string; isActive?: boolean };

export function AutomationCreateTaskAction({
  config,
  onChange,
  users,
  groups,
  roles,
  availableVariables,
  testId = "create-task-action",
}: {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
  users: UserOption[];
  groups: GroupOption[];
  roles: RoleOption[];
  availableVariables: Array<{ value: string; label: string }>;
  testId?: string;
}) {
  const { locale } = useI18n();
  const copy = getTaskActionCopy(locale);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [activeTextField, setActiveTextField] = useState<"title" | "description" | "taskText">("taskText");
  const [deadlineMode, setDeadlineMode] = useState<"none" | "relative" | "fixed">(
    config.dueAt ? "fixed" : config.dueInHours != null ? "relative" : "none",
  );
  const [durationUnit, setDurationUnit] = useState<"minutes" | "hours" | "days">(
    config.dueInHours != null && config.dueInHours < 1
      ? "minutes"
      : config.dueInHours != null && config.dueInHours >= 24 && config.dueInHours % 24 === 0
        ? "days"
        : "hours",
  );
  const templateQuery = useQuery<Template[]>({
    queryKey: ["/api/message-templates", "task"],
    queryFn: async () => {
      const response = await fetch("/api/message-templates?type=task", { credentials: "include" });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      return response.json();
    },
  });
  const set = (key: string, value: any) => onChange({ ...config, [key]: value });
  const recipients: Recipient[] = useMemo(() => {
    if (Array.isArray(config.recipients)) {
      const seen = new Set<string>();
      return config.recipients.filter((item: any) => {
        if (!item || !["user", "group", "role"].includes(item.kind) || item.id == null) return false;
        const key = `${item.kind}:${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    const legacy: Recipient[] = [];
    if (config.assignedUserId) legacy.push({ kind: "user", id: String(config.assignedUserId) });
    if (config.taskGroupId) legacy.push({ kind: "group", id: String(config.taskGroupId) });
    if (config.targetRole) {
      const roleNameOrId = String(config.targetRole).replace(/^role:/, "");
      const matchingRole = roles.find((role) => role.id === roleNameOrId || role.name === roleNameOrId);
      legacy.push({ kind: "role", id: matchingRole?.id || roleNameOrId });
    }
    return legacy;
  }, [config.recipients, config.assignedUserId, config.taskGroupId, config.targetRole, roles]);

  const userById = useMemo(() => new Map(users.map((user) => [user.id, user.label])), [users]);
  const recipientName = (recipient: Recipient) => recipient.kind === "user"
    ? userById.get(recipient.id) || recipient.id
    : recipient.kind === "group"
      ? groups.find((group) => group.id === recipient.id)?.displayAlias || groups.find((group) => group.id === recipient.id)?.name || recipient.id
      : roles.find((role) => role.id === recipient.id || role.name === recipient.id)?.name || recipient.id;

  const options: Recipient[] = [
    ...users.map((item) => ({ kind: "user" as const, id: item.id })),
    ...groups.map((item) => ({ kind: "group" as const, id: item.id })),
    ...roles.filter((item) => item.isActive !== false).map((item) => ({ kind: "role" as const, id: item.id })),
  ];
  const filteredOptions = options.filter((item) =>
    recipientName(item).toLocaleLowerCase().includes(recipientSearch.trim().toLocaleLowerCase()),
  );
  const legacyDepartment = config.assignedDepartmentId
    ? config.assignedDepartmentName || String(config.assignedDepartmentId)
    : null;

  const toggleRecipient = (item: Recipient) => {
    const exists = recipients.some((recipient) => recipient.kind === item.kind && recipient.id === item.id);
    const next = exists
      ? recipients.filter((recipient) => recipient.kind !== item.kind || recipient.id !== item.id)
      : [...recipients, item];
    const nextConfig = { ...config };
    ["assignedUserId", "assignee_user_id", "assignedDepartmentId", "assignee_department_id", "assignedDepartmentName",
      "userId", "userIds", "taskGroupId", "targetRole"].forEach((key) => delete nextConfig[key]);
    onChange({ ...nextConfig, recipients: next });
  };
  const insertVariable = (variable: string) => {
    const current = String(config[activeTextField] || "");
    set(activeTextField, `${current}${current && !/\s$/.test(current) ? " " : ""}{{${variable}}}`);
  };
  const tokenPattern = /{{\s*([^{}]+?)\s*}}/g;
  const findTokens = (value: string) => {
    const result: string[] = [];
    const matcher = new RegExp(tokenPattern.source, "g");
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(value)) !== null) result.push(match[1]);
    return result;
  };
  const usedVariables = Array.from(new Set([
    ...findTokens(String(config.title || "")),
    ...findTokens(String(config.description || "")),
    ...findTokens(String(config.taskText || "")),
  ]));
  const availableKeys = new Set(availableVariables.map((item) => item.value.replace(/^{{|}}$/g, "")));
  const unsupported = usedVariables.filter((token) => !availableKeys.has(token));
  const deadlineChange = (mode: "none" | "relative" | "fixed") => {
    setDeadlineMode(mode);
    if (mode === "none") onChange({ ...config, dueInHours: undefined, dueAt: undefined });
    if (mode === "relative") onChange({ ...config, dueAt: undefined, dueInHours: config.dueInHours ?? 2 });
    if (mode === "fixed") onChange({ ...config, dueInHours: undefined, dueAt: config.dueAt || undefined });
  };
  const dueHours = Number(config.dueInHours ?? 0);
  const unitFactor = durationUnit === "minutes" ? 1 / 60 : durationUnit === "days" ? 24 : 1;
  const shownDuration = dueHours / unitFactor;
  const localDueAt = config.dueAt ? (() => {
    const date = new Date(config.dueAt);
    return Number.isNaN(date.getTime()) ? "" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  })() : "";
  return (
    <section className="automation-create-task" data-testid={testId}>
      <div className="automation-create-task__intro">
        <span className="automation-create-task__mark"><Check aria-hidden="true" /></span>
        <div><strong>{copy.taskType}</strong><p>{copy.explanation}</p></div>
      </div>

      <div className="automation-create-task__fields">
        <div className="automation-create-task__span">
          <Label htmlFor={`${testId}-title`}>{copy.taskTitle}</Label>
          <Input id={`${testId}-title`} value={config.title || ""} onFocus={() => setActiveTextField("title")}
            onChange={(event) => set("title", event.target.value)} data-testid="input-task-action-title" />
        </div>
        <div className="automation-create-task__span">
          <Label htmlFor={`${testId}-description`}>{copy.description}</Label>
          <Textarea id={`${testId}-description`} rows={2} value={config.description || ""} onFocus={() => setActiveTextField("description")}
            onChange={(event) => set("description", event.target.value)} data-testid="input-task-action-description" />
        </div>

        <div className="automation-create-task__recipient automation-create-task__span">
          <Label>{copy.recipients}</Label>
          {legacyDepartment && <div className="automation-create-task__legacy"><UsersRound />{copy.legacyDepartment}: {legacyDepartment}</div>}
          {recipients.length > 0 && <div className="automation-create-task__chips" aria-label={copy.selected}>
            {recipients.map((item) => <span className={`automation-create-task__chip is-${item.kind}`} key={`${item.kind}:${item.id}`}>
              <span>{recipientName(item)}</span><button type="button" onClick={() => toggleRecipient(item)} aria-label={`${copy.clear}: ${recipientName(item)}`}><X /></button>
            </span>)}
          </div>}
          <div className="automation-create-task__search"><Search aria-hidden="true" /><input value={recipientSearch}
            onChange={(event) => setRecipientSearch(event.target.value)} placeholder={copy.searchRecipients} aria-label={copy.searchRecipients} /></div>
          <div className="automation-create-task__options" role="group" aria-label={copy.recipients}>
            {!filteredOptions.length && <p className="automation-create-task__empty">{copy.noRecipients}</p>}
            {filteredOptions.map((item) => {
              const selected = recipients.some((recipient) => recipient.kind === item.kind && recipient.id === item.id);
              return <button type="button" role="checkbox" aria-checked={selected} aria-label={recipientName(item)}
                key={`${item.kind}:${item.id}`} onClick={() => toggleRecipient(item)}
                className={`automation-create-task__option ${selected ? "is-selected" : ""}`}>
                <span className={`automation-create-task__kind is-${item.kind}`}>{item.kind === "user" ? "P" : item.kind === "group" ? "G" : "R"}</span>
                <span className="automation-create-task__option-name">{recipientName(item)}</span>
                <span className="automation-create-task__option-kind">{item.kind === "user" ? copy.users : item.kind === "group" ? copy.groups : copy.roles}</span>
                {selected && <Check aria-hidden="true" />}
              </button>;
            })}
          </div>
        </div>

        <div>
          <Label>{copy.priority}</Label>
          <Select value={config.priority || "medium"} onValueChange={(value) => set("priority", value)}>
            <SelectTrigger data-testid="select-task-action-priority"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["low", "medium", "high", "urgent"] as const).map((priority) =>
                <SelectItem key={priority} value={priority}>{copy.priorityLabels[priority]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="automation-create-task__span automation-create-task__deadline">
          <Label>{copy.due}</Label>
          <div className="automation-create-task__deadline-tabs" role="group" aria-label={copy.due}>
            <button type="button" className={deadlineMode === "none" ? "is-active" : ""} onClick={() => deadlineChange("none")}>{copy.noDeadline}</button>
            <button type="button" className={deadlineMode === "relative" ? "is-active" : ""} onClick={() => deadlineChange("relative")}><Clock3 />{copy.relative}</button>
            <button type="button" className={deadlineMode === "fixed" ? "is-active" : ""} onClick={() => deadlineChange("fixed")}><CalendarClock />{copy.fixedDate}</button>
          </div>
          {deadlineMode === "relative" && <div className="automation-create-task__duration">
            <span>{copy.duration}</span>
            <Input type="number" min={0} step="any" value={Number.isFinite(shownDuration) ? shownDuration : ""}
              onChange={(event) => set("dueInHours", event.target.value === "" ? undefined : Number(event.target.value) * unitFactor)}
              aria-label={copy.duration} data-testid="input-task-action-due-hours" />
            <Select value={durationUnit} onValueChange={(value: "minutes" | "hours" | "days") => setDurationUnit(value)}>
              <SelectTrigger className="automation-create-task__unit"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">{copy.minutes}</SelectItem>
                <SelectItem value="hours">{copy.hours}</SelectItem>
                <SelectItem value="days">{copy.days}</SelectItem>
              </SelectContent>
            </Select>
            <div className="automation-create-task__presets">{[
              { label: "30 min", hours: 0.5 }, { label: "2 h", hours: 2 }, { label: "24 h", hours: 24 }, { label: "48 h", hours: 48 },
            ].map((preset) => <button type="button" key={preset.hours} onClick={() => set("dueInHours", preset.hours)}>{preset.label}</button>)}</div>
          </div>}
          {deadlineMode === "fixed" && <div className="automation-create-task__fixed-date">
            <TaskCreateDatePicker value={localDueAt.slice(0, 10)} locale={locale} label={copy.due} clearLabel={copy.clear}
              onChange={(date) => {
                if (!date) { set("dueAt", undefined); return; }
                const prior = localDueAt.slice(11) || "09:00";
                set("dueAt", new Date(`${date}T${prior}`).toISOString());
              }} />
            <div className="automation-create-task__time">
              <span>{copy.time}</span>
              <input aria-label={`${copy.due} ${copy.hours}`} type="number" min={0} max={23} value={localDueAt.slice(11, 13) || "09"}
                onChange={(event) => {
                  const date = localDueAt.slice(0, 10) || new Date().toISOString().slice(0, 10);
                  const minute = localDueAt.slice(14, 16) || "00";
                  set("dueAt", new Date(`${date}T${String(Number(event.target.value)).padStart(2, "0")}:${minute}`).toISOString());
                }} />
              <span>:</span>
              <input aria-label={`${copy.due} ${copy.minutes}`} type="number" min={0} max={59} value={localDueAt.slice(14, 16) || "00"}
                onChange={(event) => {
                  const date = localDueAt.slice(0, 10) || new Date().toISOString().slice(0, 10);
                  const hour = localDueAt.slice(11, 13) || "09";
                  set("dueAt", new Date(`${date}T${hour}:${String(Number(event.target.value)).padStart(2, "0")}`).toISOString());
                }} />
            </div>
          </div>}
        </div>

        <div className="automation-create-task__span">
          <div className="automation-create-task__template-heading"><Label>{copy.template}</Label>
            {config.templateId && <button type="button" onClick={() => onChange({ ...config, templateId: undefined })}>{copy.customText}</button>}
          </div>
          <Select value={(templateQuery.data || []).some(template => template.id === config.templateId && template.isActive !== false)
            ? config.templateId : "custom"} onValueChange={(value) => {
            if (value === "custom") { set("templateId", undefined); return; }
            const template = templateQuery.data?.find((item) => item.id === value);
              if (template) onChange({ ...config, templateId: template.id, templateLanguage: template.language,
                title: template.subject || config.title || template.name, taskText: template.content || "" });
          }}>
            <SelectTrigger data-testid="select-task-action-template"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">{copy.customText}</SelectItem>
              {(templateQuery.data || []).filter((template) => template.isActive !== false).map((template) => <SelectItem key={template.id} value={template.id}>{template.name}{template.language ? ` · ${template.language}` : ""}</SelectItem>)}
            </SelectContent>
          </Select>
          {templateQuery.isError && <p className="automation-create-task__error" role="status">{copy.templateLoadError}</p>}
        </div>
        <div className="automation-create-task__span">
          <Label htmlFor={`${testId}-task-text`}>{copy.taskText}</Label>
          <Textarea id={`${testId}-task-text`} rows={4} value={config.taskText || ""} onFocus={() => setActiveTextField("taskText")}
            onChange={(event) => set("taskText", event.target.value)} data-testid="textarea-task-action-text" />
        </div>
        <div className="automation-create-task__span automation-create-task__variables">
          <div className="automation-create-task__variable-heading"><strong>{copy.variables}</strong><span>{availableVariables.length}</span></div>
          <p className="automation-create-task__variables-hint">{copy.taskVariablesHint}</p>
          <div className="automation-create-task__variable-list">
            {availableVariables.map((variable) => <button type="button" key={variable.value}
              title={copy.salutationLabels[variable.value.split(".").pop() || ""] || variable.label}
              onClick={() => insertVariable(variable.value)}>{`{{${variable.value}}}`}</button>)}
            {!availableVariables.length && <span>—</span>}
          </div>
          {!!unsupported.length && <p className="automation-create-task__warning"><strong>{copy.unsupportedVariables}:</strong> {unsupported.map((item) => `{{${item}}}`).join(", ")}</p>}
        </div>
        <div className="automation-create-task__preview automation-create-task__span">
          <div><span className="automation-create-task__preview-label">{copy.preview}</span><span>{copy.eventPreviewNote}</span></div>
          <strong>{config.title || copy.title}</strong>
          {config.description && <p>{config.description}</p>}
          <p>{config.taskText || "—"}</p>
        </div>
        <details className="automation-create-task__checklist automation-create-task__span">
          <summary><span>{copy.checklist}</span><ChevronDown aria-hidden="true" /></summary>
          <p>{copy.checklistHint}</p>
          <Textarea rows={3} value={Array.isArray(config.checklist) ? config.checklist.map((item: any) => typeof item === "string" ? item : item.label).join("\n") : ""}
            onChange={(event) => set("checklist", event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))} />
        </details>
      </div>
    </section>
  );
}
