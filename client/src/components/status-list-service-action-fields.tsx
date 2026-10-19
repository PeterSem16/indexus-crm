import React, { useRef, useState } from "react";
import type { StatusListActionDraft } from "@/lib/status-list-action-draft";
import { actionCopy } from "./status-list-service-action-copy";

export type ServiceActionOption = { value: string; label: string };
export type ServiceTaskTemplate = { id: string; label: string; body: string };
export type ServiceActionFieldProps = {
  draft: StatusListActionDraft;
  setDraft: React.Dispatch<React.SetStateAction<StatusListActionDraft>>;
  locale: string;
  taskTemplates: ServiceTaskTemplate[];
  roleFallbacks: ServiceActionOption[];
  countries: ServiceActionOption[];
  deadlines: ServiceActionOption[];
  priorities: ServiceActionOption[];
  variables: { token: string; label: string }[];
  taskGroups: any[];
  roles: any[];
  templates: any[];
  categories: any[];
  dispositions: any[];
  provider: string | null;
  callbackDisposition: boolean;
};
const idFor = (field: string) => `service-action-${field}`;
const upsert = (options: ServiceActionOption[], value: string, label?: string): ServiceActionOption[] =>
  value && !options.some(option => option.value === value)
    ? [{ value, label: label || value }, ...options]
    : options;

function Field({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  let named = false;
  const namedChildren = React.Children.map(children, child => {
    if (!React.isValidElement(child) || named) return child;
    const control = child.type === Select || child.type === "input" || child.type === "select" || child.type === "textarea";
    if (!control) return child;
    named = true;
    return React.cloneElement(child as React.ReactElement<any>, child.type === Select ? { ariaLabel: label } : { "aria-label": label });
  });
  return <div className={`slsae-field${wide ? " wide" : ""}`}><span>{label}</span>{namedChildren}{hint && <small>{hint}</small>}</div>;
}
function Select({ field, value, onChange, options, placeholder, disabled, ariaLabel }: { field: string; value: string; onChange: (value: string) => void; options: ServiceActionOption[]; placeholder?: string; disabled?: boolean; ariaLabel?: string }) {
  return <select aria-label={ariaLabel || field} data-testid={idFor(field)} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
    {placeholder && <option value="">{placeholder}</option>}
    {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>;
}

export function StatusListServiceActionFields(props: ServiceActionFieldProps) {
  const { draft, setDraft, locale, taskTemplates, roleFallbacks, deadlines, priorities, taskGroups, roles, templates, categories, dispositions, provider, callbackDisposition } = props;
  const copy = (key: string) => actionCopy(locale, key);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [categoryId, setCategoryId] = useState("");
  const set = <K extends keyof StatusListActionDraft>(key: K, value: StatusListActionDraft[K]) => setDraft(previous => ({ ...previous, [key]: value }));
  const activeRoles = roles.filter(role => role?.isActive !== false && role?.name).map(role => ({
    value: `role:${role.name}`,
    label: role.description ? `${role.name} — ${role.description}` : role.name,
  }));
  const roleOptions = [...activeRoles, ...roleFallbacks].filter((option, index, list) => list.findIndex(candidate => candidate.value === option.value) === index);
  const targetOptions = upsert(roleOptions, draft.targetRole);
  const groupOptions = taskGroups.filter(group => group?.id != null && group?.name).map(group => ({
    value: `group:${group.id}`, label: `${group.name}${group.members?.length ? ` · ${group.members.length}` : ""}`,
  }));
  const selectedGroupValue = draft.taskGroupId ? `group:${draft.taskGroupId}` : draft.targetRole;
  const assignmentOptions = upsert([...groupOptions, ...roleOptions], selectedGroupValue, selectedGroupValue);
  const mailTemplates = templates.filter(template => template?.id != null && (!categoryId || String(template.categoryId) === categoryId))
    .map(template => ({ value: String(template.id), label: template.name || template.subject || String(template.id) }));
  const emailTemplateOptions = upsert(mailTemplates, draft.emailTemplateId, String(draft.emailTemplateId || ""));
  const categoryOptions = categories.filter(category => category?.isActive !== false && category?.id != null)
    .map(category => ({ value: String(category.id), label: category.name || String(category.id) }));
  const dispositionOptions = upsert(dispositions.filter(item => item?.id != null).map(item => ({
    value: String(item.id), label: item.name || item.label || String(item.id),
  })), draft.dispositionId);
  const showCallbackBusinessDays = draft.actionType === "set_callback" || (draft.actionType === "set_contact_status" && callbackDisposition);
  const templateSelect = <Field label={copy("template")} wide>
    <Select field="emailTemplateId" value={draft.emailTemplateId} onChange={value => set("emailTemplateId", value)} options={emailTemplateOptions} placeholder={copy("noTemplates")} />
  </Field>;
  const categorySelect = categories.some(category => category?.isActive !== false) ? <Field label={copy("category")}>
    <Select field="emailCategoryId" value={categoryId || "__all__"} onChange={value => {
      const next = value === "__all__" ? "" : value;
      setCategoryId(next);
    }} options={[{ value: "__all__", label: copy("allCategories") }, ...categoryOptions]} />
  </Field> : null;
  const emailRelated = ["send_email_group", "notify_email", "send_contact_email"].includes(draft.actionType);

  return <div className="slsae-field-grid">
    {["assign_task", "send_email_group", "notify_role"].includes(draft.actionType) && <Field label={draft.actionType === "assign_task" ? copy("taskGroup") : copy("role")} wide>
      {draft.actionType === "assign_task"
        ? <Select field={draft.taskGroupId ? "taskGroupId" : "targetRole"} value={selectedGroupValue} onChange={value => value.startsWith("group:")
          ? setDraft(previous => ({ ...previous, taskGroupId: value.slice(6), targetRole: "" }))
          : setDraft(previous => ({ ...previous, taskGroupId: "", targetRole: value }))} options={assignmentOptions} placeholder={copy("role")} />
        : <Select field="targetRole" value={draft.targetRole} onChange={value => set("targetRole", value)} options={targetOptions} placeholder={copy("role")} />}
    </Field>}

    {draft.actionType === "assign_task" && <>
      <Field label={copy("description")} wide>
        <textarea ref={descriptionRef} data-testid={idFor("taskDescription")} value={draft.taskDescription} onChange={event => set("taskDescription", event.target.value)} placeholder={copy("description")} />
        <div className="slsae-actions" aria-label={copy("description")}>
          {taskTemplates.map(template => <button key={template.id} type="button" className="slsae-chip" onClick={() => {
            set("taskDescription", template.body);
            requestAnimationFrame(() => descriptionRef.current?.focus());
          }}>{template.label}</button>)}
        </div>
        <div className="slsae-actions">
          {props.variables?.map(variable => <button key={variable.token} type="button" className="slsae-chip" title={variable.token} onClick={() => {
            const element = descriptionRef.current;
            if (!element) { set("taskDescription", `${draft.taskDescription}${variable.token}`); return; }
            const start = element.selectionStart ?? element.value.length;
            const end = element.selectionEnd ?? element.value.length;
            const next = `${element.value.slice(0, start)}${variable.token}${element.value.slice(end)}`;
            set("taskDescription", next);
            requestAnimationFrame(() => { element.focus(); element.selectionStart = element.selectionEnd = start + variable.token.length; });
          }}>{variable.label}</button>)}
        </div>
      </Field>
      <Field label={copy("deadline")}><Select field="taskDeadlineOffset" value={draft.taskDeadlineOffset} onChange={value => set("taskDeadlineOffset", value)} options={upsert(deadlines, draft.taskDeadlineOffset)} /></Field>
      <Field label={copy("priority")}><Select field="taskPriority" value={draft.taskPriority} onChange={value => set("taskPriority", value)} options={upsert(priorities, draft.taskPriority)} /></Field>
      <label className="slsae-choice wide"><input type="checkbox" data-testid={idFor("assignNotify")} checked={draft.assignNotify} onChange={event => set("assignNotify", event.target.checked)} />{copy("notifyOnAssign")}</label>
      {draft.assignNotify && <Field label={copy("channels")} wide>
        <div className="slsae-actions">
          {(["push", "email", "sms"] as const).map(channel => {
            const checked = draft.assignNotifyChannels.includes(channel);
            return <button type="button" key={channel} className="slsae-chip" aria-pressed={checked} onClick={() => set("assignNotifyChannels", checked ? draft.assignNotifyChannels.filter(value => value !== channel) : [...draft.assignNotifyChannels, channel])}>{channel.toUpperCase()}</button>;
          })}
        </div>
      </Field>}
    </>}

    {emailRelated && <>
      {draft.actionType === "send_contact_email" && <p className="slsae-callout wide">{copy("contactEmailNote")}</p>}
      {["send_email_group", "notify_email"].includes(draft.actionType) && <Field label={copy("emailRecipients")} hint={copy("recipientsHelp")} wide>
        <textarea data-testid={idFor("emailRecipients")} value={draft.emailRecipients} onChange={event => set("emailRecipients", event.target.value)} placeholder="team@example.com" />
      </Field>}
      {categorySelect}
      {templateSelect}
    </>}

    {draft.actionType === "send_sms" && <>
      <Field label={copy("smsGateway")} wide>
      <Select field="smsProvider" value={provider || draft.smsProvider} disabled={!!provider} onChange={value => set("smsProvider", value)} options={[
          { value: "default", label: copy("automatic") }, { value: "bulkgate", label: "BulkGate" }, { value: "smstools", label: "SMSTOOLS (SK)" },
        ]} />
        {provider && <small>{copy("missionGateway")} {provider === "smstools" ? "SMSTOOLS" : "BulkGate"}</small>}
      </Field>
      <Field label={copy("smsText")} wide>
        <textarea data-testid={idFor("taskDescription")} value={draft.taskDescription} onChange={event => set("taskDescription", event.target.value)} placeholder={copy("smsText")} />
      </Field>
      <Field label={copy("template")} wide>
        <Select field="smsTemplateId" value={draft.smsTemplateId} onChange={value => set("smsTemplateId", value)} options={upsert(templates.filter(template => template?.id != null).map(template => ({ value: String(template.id), label: template.name || template.subject || String(template.id) })), draft.smsTemplateId)} placeholder={copy("noTemplates")} />
      </Field>
    </>}

    {draft.actionType === "set_contact_status" && <>
      <Field label={copy("disposition")} wide><Select field="dispositionId" value={draft.dispositionId} onChange={value => set("dispositionId", value)} options={dispositionOptions} placeholder={copy("disposition")} /></Field>
      {callbackDisposition && <>
        <Field label={copy("callbackDays")}><input data-testid={idFor("callbackOffsetDays")} type="number" min="0" step="1" value={draft.callbackOffsetDays} onChange={event => set("callbackOffsetDays", event.target.value)} /></Field>
        <Field label={copy("callbackTime")}><input data-testid={idFor("callbackTime")} type="time" value={draft.callbackTime} onChange={event => set("callbackTime", event.target.value)} /></Field>
        <Field label={copy("callbackExistingPolicy")} wide>
          <select aria-label={copy("callbackExistingPolicy")} data-testid="service-action-callbackExistingPolicy" value={draft.callbackExistingPolicy || "replace"} onChange={event => set("callbackExistingPolicy", event.target.value as StatusListActionDraft["callbackExistingPolicy"])}>
            <option value="replace">{copy("callbackPolicyReplace")}</option>
            <option value="keep_existing">{copy("callbackPolicyKeep")}</option>
          </select>
          <small>{copy("callbackPolicyHelp")}</small>
        </Field>
        <label className="slsae-choice wide"><input type="checkbox" data-testid={idFor("notifyAgentPulse")} checked={draft.notifyAgentPulse} onChange={event => set("notifyAgentPulse", event.target.checked)} />{copy("notifyPulse")}</label>
      </>}
    </>}
    {draft.actionType === "set_callback" && <>
      <Field label={copy("callbackDays")}><input data-testid={idFor("callbackOffsetDays")} type="number" min="0" step="1" value={draft.callbackOffsetDays} onChange={event => set("callbackOffsetDays", event.target.value)} /></Field>
      <Field label={copy("callbackTime")}><input data-testid="service-action-callbackTime" type="time" value={draft.callbackTime} onChange={event => set("callbackTime", event.target.value)} /></Field>
      <Field label={copy("callbackExistingPolicy")} wide>
        <select aria-label={copy("callbackExistingPolicy")} data-testid="service-action-callbackExistingPolicy" value={draft.callbackExistingPolicy || "replace"} onChange={event => set("callbackExistingPolicy", event.target.value as StatusListActionDraft["callbackExistingPolicy"])}>
          <option value="replace">{copy("callbackPolicyReplace")}</option>
          <option value="keep_existing">{copy("callbackPolicyKeep")}</option>
        </select>
        <small>{copy("callbackPolicyHelp")}</small>
      </Field>
    </>}
    {showCallbackBusinessDays && <div className="slsae-field wide">
      <label className="slsae-choice"><input type="checkbox" data-testid="service-action-callbackBusinessDaysOnly" checked={draft.callbackBusinessDaysOnly} onChange={event => set("callbackBusinessDaysOnly", event.target.checked)} />{copy("callbackBusinessDaysOnly")}</label>
      <small>{copy("callbackBusinessDaysHelp")}</small>
    </div>}
    {draft.actionType === "sys_webhook" && <Field label={copy("webhook")} wide><input data-testid={idFor("webhookTarget")} type="url" value={draft.webhookTarget} onChange={event => set("webhookTarget", event.target.value)} placeholder="https://example.com/hooks/..." /></Field>}
  </div>;
}

