import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  statusListActionDraft, statusListActionError, statusListActionPayload, statusListActionDirty,
  type SavedStatusListAction, type StatusListActionDraft,
} from "@/lib/status-list-action-draft";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { StatusListServiceActionFields, type ServiceActionOption, type ServiceTaskTemplate } from "./status-list-service-action-fields";
import { StatusListServiceActionConditions, type ConditionFieldMetadata } from "./status-list-service-action-conditions";
import { actionCopy, catalogFieldLabel, catalogOperatorLabel } from "./status-list-service-action-copy";
import "./status-list-service-action-editor.css";

export type StatusListServiceActionOption = { value: string; label: string; help: string; icon?: React.ReactNode };
export type StatusListServiceActionTranslate = (key: string) => string;
export type StatusListServiceActionEditorProps = {
  campaignId: string;
  itemId: string;
  questionId?: string;
  automation?: SavedStatusListAction;
  initialActionType?: string;
  locale: string;
  sourceLabel: string;
  translate: StatusListServiceActionTranslate;
  actions: StatusListServiceActionOption[];
  roleFallbacks: ServiceActionOption[];
  countries: ServiceActionOption[];
  deadlines: ServiceActionOption[];
  priorities: ServiceActionOption[];
  taskTemplates: ServiceTaskTemplate[];
  variables: { token: string; label: string }[];
  conditionFields: ConditionFieldMetadata[];
  onSaved: () => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};
type Stage = "type" | "details" | "conditions" | "review";
const STAGES: Stage[] = ["type", "details", "conditions", "review"];
const stageTestId: Record<Stage, string> = {
  type: "service-action-stage-type", details: "service-action-stage-details",
  conditions: "service-action-stage-conditions", review: "service-action-stage-review",
};
async function getArray(path: string) {
  const response = await fetch(path, { credentials: "include" });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error("Expected an array response");
  return data;
}
async function getJson(path: string) {
  const response = await fetch(path, { credentials: "include" });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}
function missionProvider(settings: unknown): string | null {
  try {
    const parsed = typeof settings === "string" ? JSON.parse(settings) : settings;
    const value = (parsed as any)?.smsProvider;
    return value === "bulkgate" || value === "smstools" ? value : null;
  } catch { return null; }
}
function conditionSummary(draft: StatusListActionDraft, fields: ConditionFieldMetadata[], locale: string, copy: (key: string) => string) {
  if (draft.conditionMode === "always") return copy("always");
  if (draft.conditionMode === "country") return `${copy("country")}: ${draft.conditionCountry}`;
  if (draft.conditionMode === "answer") return `${copy("answer")}: ${draft.conditionAnswer || "—"}`;
  if (draft.conditionMode === "field_changed_to") {
    const field = fields.find(item => item.key === draft.fieldChangedKey);
    return `${field ? catalogFieldLabel(locale, field.key, locale === "sk" ? field.labelSk : field.labelEn) : draft.fieldChangedKey} = ${draft.fieldChangedValue || "—"}`;
  }
  if (draft.conditionMode === "compound") return draft.conditionRules.length
    ? draft.conditionRules.map(rule => {
      const field = fields.find(item => item.key === rule.field);
      const label = field ? catalogFieldLabel(locale, field.key, locale === "sk" ? field.labelSk : field.labelEn) : rule.field;
      const op = field?.ops.find(item => item.value === rule.op);
      const opLabel = op ? catalogOperatorLabel(locale, op.value, locale === "sk" ? op.labelSk : op.labelEn) : rule.op;
      return `${label} ${opLabel} ${rule.value}`;
    }).join(` ${draft.conditionLogic} `) : copy("conditionSection");
  return copy("stored");
}
type ReviewLookups = {
  roles: any[]; taskGroups: any[]; templates: any[]; dispositions: any[];
  roleFallbacks: ServiceActionOption[]; deadlines: ServiceActionOption[]; priorities: ServiceActionOption[];
  rolesReady: boolean; groupsReady: boolean; templatesReady: boolean; dispositionsReady: boolean;
};
function reviewDetails(draft: StatusListActionDraft, copy: (key: string) => string, provider: string | null, callbackDisposition: boolean, lookups: ReviewLookups) {
  const rows: string[] = [];
  const add = (label: string, value: string) => { if (value) rows.push(`${label}: ${value}`); };
  const lookup = (label: string, value: string, values: any[], ready: boolean, match: (item: any) => boolean, display: (item: any) => string) => {
    if (!value) return;
    const found = values.find(match);
    rows.push(`${label}: ${found ? display(found) : value}${ready && !found ? ` · ${copy("missingReference")}` : ""}`);
  };
  const findRole = (value: string) => {
    const active = lookups.roles.find(role => role?.isActive !== false && `role:${role.name}` === value && role?.name);
    if (active) return active.description ? `${active.name} — ${active.description}` : active.name;
    const fallback = lookups.roleFallbacks.find(role => role.value === value);
    return fallback?.label;
  };
  const roleValue = (label: string, value: string) => {
    if (!value) return;
    const resolved = findRole(value);
    rows.push(`${label}: ${resolved || value}${lookups.rolesReady && !resolved ? ` · ${copy("missingReference")}` : ""}`);
  };
  if (draft.actionType === "assign_task" && draft.taskGroupId) {
    lookup(copy("taskGroup"), draft.taskGroupId, lookups.taskGroups, lookups.groupsReady,
      group => String(group.id) === draft.taskGroupId,
      group => group.displayAlias || group.name || String(group.id));
  } else if (["assign_task", "send_email_group", "notify_role"].includes(draft.actionType)) {
    roleValue(copy(draft.actionType === "assign_task" ? "taskGroup" : "role"), draft.targetRole);
  }
  if (draft.actionType === "assign_task") {
    add(copy("description"), draft.taskDescription);
    lookup(copy("deadline"), draft.taskDeadlineOffset, lookups.deadlines, true, option => option.value === draft.taskDeadlineOffset, option => option.label);
    lookup(copy("priority"), draft.taskPriority, lookups.priorities, true, option => option.value === draft.taskPriority, option => option.label);
    if (draft.assignNotify) add(copy("channels"), draft.assignNotifyChannels.join(", ") || "—");
  }
  if (["send_email_group", "notify_email"].includes(draft.actionType)) add(copy("emailRecipients"), draft.emailRecipients.replace(/\n/g, ", "));
  if (["send_email_group", "notify_email", "send_contact_email"].includes(draft.actionType))
    lookup(copy("template"), draft.emailTemplateId, lookups.templates, lookups.templatesReady,
      template => String(template.id) === draft.emailTemplateId, template => template.name || template.subject || String(template.id));
  if (draft.actionType === "send_sms") {
    lookup(copy("template"), draft.smsTemplateId, lookups.templates, lookups.templatesReady,
      template => String(template.id) === draft.smsTemplateId, template => template.name || template.subject || String(template.id));
    add(copy("smsText"), draft.taskDescription);
    add(copy("smsGateway"), provider ? (provider === "smstools" ? "SMSTOOLS (SK)" : "BulkGate") : draft.smsProvider === "default" ? copy("automatic") : draft.smsProvider);
  }
  if (draft.actionType === "set_contact_status") {
    lookup(copy("disposition"), draft.dispositionId, lookups.dispositions, lookups.dispositionsReady,
      disposition => String(disposition.id) === draft.dispositionId,
      disposition => disposition.code ? `${disposition.code} — ${disposition.name || disposition.label || disposition.id}` : disposition.name || disposition.label || String(disposition.id));
    if (callbackDisposition) {
      add(copy("callbackDays"), draft.callbackOffsetDays);
      add(copy("callbackBusinessDaysOnly"), copy(draft.callbackBusinessDaysOnly ? "callbackBusinessDaysOn" : "callbackBusinessDaysOff"));
      add(copy("callbackTime"), draft.callbackTime);
      add(copy("callbackExistingPolicy"), copy(draft.callbackExistingPolicy === "keep_existing" ? "callbackPolicyKeep" : "callbackPolicyReplace"));
      add(copy("notifyPulse"), copy(draft.notifyAgentPulse ? "enabled" : "disabled"));
    }
  }
  if (draft.actionType === "set_callback") {
    add(copy("callbackDays"), draft.callbackOffsetDays);
    add(copy("callbackBusinessDaysOnly"), copy(draft.callbackBusinessDaysOnly ? "callbackBusinessDaysOn" : "callbackBusinessDaysOff"));
    add(copy("callbackTime"), draft.callbackTime);
    add(copy("callbackExistingPolicy"), copy(draft.callbackExistingPolicy === "keep_existing" ? "callbackPolicyKeep" : "callbackPolicyReplace"));
  }
  if (draft.actionType === "sys_webhook") add(copy("webhook"), draft.webhookTarget);
  return rows;
}

export type { ConditionFieldMetadata };
export function StatusListServiceActionEditor(props: StatusListServiceActionEditorProps) {
  const {
    campaignId, itemId, questionId, automation, initialActionType, locale, sourceLabel, translate,
    actions, roleFallbacks, countries, deadlines, priorities, taskTemplates, variables, conditionFields,
    onSaved, onCancel, onDirtyChange,
  } = props;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const copy = (key: string) => actionCopy(locale, key);
  const initialType = initialActionType || "assign_task";
  const [draft, setDraft] = useState<StatusListActionDraft>(() => statusListActionDraft(automation, initialType));
  const [stage, setStage] = useState<Stage>("type");
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [originalConditionJson, setOriginalConditionJson] = useState<string | null>(automation?.conditionJson || null);
  const originalRef = useRef<SavedStatusListAction | undefined>(automation);
  const initializedRef = useRef<string | null>(null);
  const dirtyCallbackRef = useRef(onDirtyChange);
  dirtyCallbackRef.current = onDirtyChange;

  useEffect(() => {
    const recordKey = automation?.id != null ? `saved:${automation.id}` : `new:${campaignId}:${itemId}:${questionId || ""}`;
    if (initializedRef.current === recordKey) return;
    initializedRef.current = recordKey;
    originalRef.current = automation;
    setDraft(statusListActionDraft(automation, initialType));
    setOriginalConditionJson(automation?.conditionJson || null);
    setAttemptedSave(false);
  }, [automation?.id, campaignId, itemId, questionId, initialType]);

  const isEdit = automation?.id != null;
  const needsRole = ["assign_task", "send_email_group", "notify_role"].includes(draft.actionType);
  const needsTaskGroups = draft.actionType === "assign_task";
  const needsEmail = ["send_email_group", "notify_email", "send_contact_email"].includes(draft.actionType);
  const needsSms = draft.actionType === "send_sms";
  const needsDisposition = draft.actionType === "set_contact_status";
  const needsHospitals = draft.conditionMode === "field_changed_to" && draft.fieldChangedKey === "contact.hospital_id";
  const needsClinics = draft.conditionMode === "field_changed_to" && draft.fieldChangedKey === "contact.clinic_id";

  const campaignQuery = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId],
    queryFn: () => getJson(`/api/campaigns/${campaignId}`),
    enabled: !!campaignId,
  });
  const rolesQuery = useQuery<any[]>({
    queryKey: ["/api/roles"],
    queryFn: () => getArray("/api/roles"),
    enabled: needsRole,
  });
  const groupsQuery = useQuery<any[]>({
    queryKey: ["/api/task-groups"],
    queryFn: () => getArray("/api/task-groups"),
    enabled: needsTaskGroups,
  });
  const emailTemplatesQuery = useQuery<any[]>({
    queryKey: ["/api/message-templates", "email"],
    queryFn: () => getArray("/api/message-templates?type=email"),
    enabled: needsEmail,
  });
  const smsTemplatesQuery = useQuery<any[]>({
    queryKey: ["/api/message-templates", "sms"],
    queryFn: () => getArray("/api/message-templates?type=sms"),
    enabled: needsSms,
  });
  const categoriesQuery = useQuery<any[]>({
    queryKey: ["/api/template-categories"],
    queryFn: () => getArray("/api/template-categories"),
    enabled: needsEmail,
  });
  const dispositionsQuery = useQuery<any[]>({
    queryKey: ["/api/campaigns", campaignId, "dispositions-auto"],
    queryFn: () => getArray(`/api/campaigns/${campaignId}/dispositions`),
    enabled: needsDisposition,
  });
  const hospitalsQuery = useQuery<any[]>({
    queryKey: ["/api/hospitals"],
    queryFn: () => getArray("/api/hospitals"),
    enabled: needsHospitals,
  });
  const clinicsQuery = useQuery<any[]>({
    queryKey: ["/api/clinics"],
    queryFn: () => getArray("/api/clinics"),
    enabled: needsClinics,
  });
  const campaignSmsProvider = useMemo(() => missionProvider(campaignQuery.data?.settings), [campaignQuery.data?.settings]);
  const dispositions = dispositionsQuery.data || [];
  const selectedDisposition = dispositions.find(item => String(item.id) === String(draft.dispositionId));
  const callbackDisposition = !!selectedDisposition && ["callback", "schedule_email", "schedule_sms"].includes(selectedDisposition.actionType);
  const templates = needsSms ? smsTemplatesQuery.data || [] : emailTemplatesQuery.data || [];
  const dataQueries = [
    ...(needsRole ? [rolesQuery] : []), ...(needsTaskGroups ? [groupsQuery] : []),
    ...(needsEmail ? [emailTemplatesQuery, categoriesQuery] : []), ...(needsSms ? [smsTemplatesQuery, campaignQuery] : []),
    ...(needsDisposition ? [dispositionsQuery] : []), ...(needsHospitals ? [hospitalsQuery] : []),
    ...(needsClinics ? [clinicsQuery] : []),
  ];
  const lookupLoading = dataQueries.some(query => query.isLoading);
  const failedQueries = dataQueries.filter(query => query.isError);
  const dirty = statusListActionDirty(draft, originalRef.current, initialType);
  const invalidDispositionCount = draft.conditionMode === "compound" && draft.conditionRules.some(rule => {
    const meta = conditionFields.find(field => field.key === rule.field);
    if (meta?.valueType !== "disp_count") return false;
    const [code, count] = rule.value.split(":");
    return !code?.trim() || !count?.trim() || !Number.isFinite(Number(count)) || Number(count) < 0;
  });
  const changedFieldMeta = conditionFields.find(field => field.key === draft.fieldChangedKey);
  const invalidChangedDispositionCount = draft.conditionMode === "field_changed_to" && changedFieldMeta?.valueType === "disp_count"
    && (() => {
      const [code, count] = draft.fieldChangedValue.split(":");
      return !code?.trim() || !count?.trim() || !Number.isFinite(Number(count)) || Number(count) < 0;
    })();
  const conditionValueInvalid = invalidDispositionCount || invalidChangedDispositionCount;
  const validationError = attemptedSave ? statusListActionError(draft, callbackDisposition) || (conditionValueInvalid ? "condition" : null) : null;

  useEffect(() => { dirtyCallbackRef.current?.(dirty); }, [dirty]);
  useEffect(() => () => { dirtyCallbackRef.current?.(false); }, []);
  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = statusListActionPayload(draft, originalRef.current, campaignSmsProvider, callbackDisposition);
      if (isEdit) return apiRequest("PUT", `/api/campaigns/${campaignId}/status-list/${itemId}/automations/${automation!.id}`, payload);
      if (questionId) return apiRequest("POST", `/api/campaigns/${campaignId}/status-list/${itemId}/questions/${questionId}/automations`, payload);
      return apiRequest("POST", `/api/campaigns/${campaignId}/status-list/${itemId}/automations`, payload);
    },
    onSuccess: result => {
      const normalizedDraft = {
        ...draft,
        emailRecipients: draft.emailRecipients.split(/[\n,;]+/).map(value => value.trim()).filter(Boolean).join("\n"),
        callbackOffsetDays: String(Number(draft.callbackOffsetDays)),
        smsProvider: campaignSmsProvider ? "default" : draft.smsProvider,
      };
      const payload = statusListActionPayload(normalizedDraft, originalRef.current, campaignSmsProvider, callbackDisposition);
      setDraft(normalizedDraft);
      originalRef.current = {
        ...(originalRef.current || {}),
        ...(result && typeof result === "object" ? result as object : {}),
        ...payload,
        actionType: normalizedDraft.actionType,
        targetRole: normalizedDraft.targetRole || null,
        emailTemplateId: normalizedDraft.emailTemplateId || null,
        emailRecipients: normalizedDraft.emailRecipients.split("\n").filter(Boolean),
        smsTemplateId: normalizedDraft.smsTemplateId || null,
        smsProvider: campaignSmsProvider ? null : normalizedDraft.smsProvider,
        callbackOffsetDays: Number(normalizedDraft.callbackOffsetDays),
        callbackTime: normalizedDraft.callbackTime,
        callbackExistingPolicy: normalizedDraft.callbackExistingPolicy || "replace",
        callbackBusinessDaysOnly: normalizedDraft.callbackBusinessDaysOnly,
        notifyAgentPulse: normalizedDraft.notifyAgentPulse,
        taskDescription: normalizedDraft.taskDescription,
        taskDeadlineOffset: normalizedDraft.taskDeadlineOffset,
        taskPriority: normalizedDraft.taskPriority,
        dispositionId: normalizedDraft.dispositionId || null,
        webhookTarget: normalizedDraft.webhookTarget || null,
        taskGroupId: normalizedDraft.taskGroupId || null,
        assignNotify: normalizedDraft.assignNotify,
        assignNotifyChannels: normalizedDraft.assignNotifyChannels,
      } as SavedStatusListAction;
      setOriginalConditionJson(typeof originalRef.current.conditionJson === "string" ? originalRef.current.conditionJson : null);
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      const key = isEdit ? "autoSaved" : "autoAdded";
      const translated = translate(key);
      toast({ title: translated === key ? copy("saved") : translated });
      onSaved();
    },
    onError: () => {
      const translated = translate("saveErr");
      toast({ title: translated === "saveErr" ? copy("saveError") : translated, variant: "destructive" });
    },
  });

  const selectStage = (next: Stage) => setStage(next);
  const go = (direction: number) => {
    const nextIndex = Math.max(0, Math.min(STAGES.length - 1, STAGES.indexOf(stage) + direction));
    setStage(STAGES[nextIndex]);
  };
  const save = () => {
    setAttemptedSave(true);
    if (statusListActionError(draft, callbackDisposition) || conditionValueInvalid) return;
    saveMutation.mutate();
  };
  const selectedAction = actions.find(action => action.value === draft.actionType);
  const availableActions = selectedAction ? actions : [...actions, { value: draft.actionType, label: draft.actionType, help: copy("savedUnknown") }];
  const errorMap: Record<string, string> = {
    target: copy("errorTarget"), status: copy("errorStatus"), callback: copy("errorCallback"),
    email: copy("errorEmail"), template: copy("errorTemplate"), sms: copy("errorSms"),
    webhook: copy("errorWebhook"), condition: copy("errorCondition"),
  };
  const reviewRows = reviewDetails(draft, copy, campaignSmsProvider, callbackDisposition, {
    roles: rolesQuery.data || [], taskGroups: groupsQuery.data || [], templates, dispositions,
    roleFallbacks, deadlines, priorities,
    rolesReady: rolesQuery.isSuccess, groupsReady: groupsQuery.isSuccess,
    templatesReady: needsSms ? smsTemplatesQuery.isSuccess : emailTemplatesQuery.isSuccess,
    dispositionsReady: dispositionsQuery.isSuccess,
  });
  const condition = conditionSummary(draft, conditionFields, locale, copy);
  const stepHeading: Record<Stage, string> = {
    type: copy("chooseAction"), details: copy("detailsTitle"), conditions: copy("conditionsTitle"), review: copy("reviewTitle"),
  };
  const stepHelp: Record<Stage, string> = {
    type: copy("chooseHelp"), details: copy("detailsHelp"), conditions: copy("conditionsHelp"), review: copy("reviewHelp"),
  };
  const retryLookups = () => { failedQueries.forEach(query => { void query.refetch(); }); };
  const saveBlocked = saveMutation.isPending || (needsSms && (campaignQuery.isLoading || campaignQuery.isError));

  return <section className="slsae" data-testid="status-list-service-action-editor">
    <header className="slsae-header">
      <div><span className="slsae-kicker">{copy("title")}</span><h2>{copy("title")}</h2><p>{copy("subtitle")}</p></div>
      <div className="slsae-source"><span className="slsae-kicker">{copy("scopeLabel")}</span>{copy("sourceLine")}<br />{sourceLabel}</div>
    </header>
    <div className="slsae-notice"><span className="slsae-notice-mark">i</span><span><strong>{copy("safety")}</strong></span></div>
    <nav className="slsae-stages" aria-label={copy("title")}>
      {STAGES.map((item, index) => <button key={item} type="button" data-testid={stageTestId[item]} aria-current={stage === item ? "step" : undefined} onClick={() => selectStage(item)}>
        <span className="slsae-stage-no">{String(index + 1).padStart(2, "0")}</span><span>{copy(`stage${item[0].toUpperCase()}${item.slice(1)}`)}</span>
      </button>)}
    </nav>
    <div className="slsae-content" key={stage}>
      <div className="slsae-intro"><span>{String(STAGES.indexOf(stage) + 1).padStart(2, "0")} / 04</span><h3>{stepHeading[stage]}</h3><p>{stepHelp[stage]}</p></div>
      {stage === "type" && <div className="slsae-field-grid">
        <label className="slsae-field wide"><span>{copy("actionLabel")}</span>
          <select data-testid="service-action-type" value={draft.actionType} onChange={event => setDraft(previous => ({ ...previous, actionType: event.target.value }))}>
            {availableActions.map(action => <option key={action.value} value={action.value}>{action.label}</option>)}
          </select>
        </label>
        {selectedAction?.icon && <div className="slsae-callout wide" aria-hidden="true">{selectedAction.icon} {selectedAction.label}</div>}
        {selectedAction?.help && <p className="slsae-callout wide">{selectedAction.help}</p>}
        <p className="slsae-callout wide">{copy("safety")}</p>
      </div>}
      {stage === "details" && <>
        {lookupLoading && <div className="slsae-loading" aria-label={copy("detailsTitle")}><div className="slsae-skeleton" /><div className="slsae-skeleton" /><div className="slsae-skeleton" /></div>}
        {failedQueries.length > 0 && <div className="slsae-error" role="alert">{copy("lookupError")} <button className="slsae-button" type="button" onClick={retryLookups}>{copy("retry")}</button></div>}
        <StatusListServiceActionFields
          draft={draft} setDraft={setDraft} locale={locale} taskTemplates={taskTemplates} variables={variables}
          roleFallbacks={roleFallbacks} countries={countries} deadlines={deadlines} priorities={priorities}
          taskGroups={groupsQuery.data || []} roles={rolesQuery.data || []} templates={templates}
          categories={categoriesQuery.data || []} dispositions={dispositions}
          provider={campaignSmsProvider} callbackDisposition={callbackDisposition}
        />
      </>}
      {stage === "conditions" && <>
        {(needsHospitals && hospitalsQuery.isLoading || needsClinics && clinicsQuery.isLoading) && <div className="slsae-loading"><div className="slsae-skeleton" /><div className="slsae-skeleton" /></div>}
        {(needsHospitals && hospitalsQuery.isError || needsClinics && clinicsQuery.isError) && <div className="slsae-error" role="alert">{copy("lookupError")} <button className="slsae-button" type="button" onClick={retryLookups}>{copy("retry")}</button></div>}
        <StatusListServiceActionConditions draft={draft} setDraft={setDraft} locale={locale} conditionFields={conditionFields}
          countries={countries} hospitals={hospitalsQuery.data || []} clinics={clinicsQuery.data || []}
          originalCondition={originalRef.current} originalConditionJson={originalConditionJson} />
      </>}
      {stage === "review" && <div className="slsae-review" data-testid="service-action-review">
        <div className="slsae-review-main">
          <section className="slsae-review-card"><h4>{copy("actionSection")}</h4><p>{selectedAction?.label || draft.actionType}</p>{reviewRows.map(row => <p key={row}>{row}</p>)}</section>
          <section className="slsae-review-card"><h4>{copy("conditionSection")}</h4><p>{condition}</p></section>
          <section className="slsae-review-card"><h4>{copy("scopeSection")}</h4><p>{copy("sourceLine")} · {sourceLabel}</p></section>
        </div>
        <aside className="slsae-review-aside"><strong>{copy("reviewHelp")}</strong>{copy("safety")}<br /><br />{copy("noElse")}</aside>
      </div>}
    </div>
    {attemptedSave && validationError && <p className="slsae-error" role="alert">{errorMap[validationError]}</p>}
    {saveMutation.isError && <p className="slsae-error" role="alert">{copy("saveError")}</p>}
    <footer className="slsae-footer">
      <div className="slsae-footer-left"><span className="slsae-help">{saveMutation.isPending ? copy("saving") : dirty || !isEdit ? copy("dirty") : copy("saved")}</span>
        <button type="button" className="slsae-button" onClick={onCancel}>{copy("cancel")}</button>
      </div>
      <div className="slsae-footer-right">
        {stage !== "type" && <button type="button" className="slsae-button" onClick={() => go(-1)}>{copy("back")}</button>}
        {stage !== "review"
          ? <button type="button" className="slsae-button primary" onClick={() => go(1)}>{copy("next")}</button>
          : <button type="button" className="slsae-button primary" data-testid="status-list-automation-save" disabled={saveBlocked} onClick={save}>{saveMutation.isPending ? copy("saving") : isEdit ? copy("save") : copy("create")}</button>}
      </div>
    </footer>
  </section>;
}
