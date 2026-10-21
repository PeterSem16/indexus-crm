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
import { filterStatusListActionVariables, StatusListNativeActionEditor } from "./status-list-native-action-editor";
import { emptyNativeActionConfig, nativeConfigFromLegacy, nativeServiceActionTypes } from "@/lib/status-list-action-draft";
import { statusListNativeActionIssues } from "@shared/status-list-service-config";
import { getAutomationEmailCardRecipientCopy } from "@/i18n/automation-email-card-recipient-translations";
import { getUpdateRecordCopy } from "@/i18n/automation-update-record-copy";
import { UPDATE_RECORD_ENTITIES } from "@shared/automation-update-record";
import "./status-list-service-action-editor.css";

const migrationCopy: Record<string, Record<string, string>> = {
  en: { legacyNativeNotice: "This saved action still uses its original behavior. It changes only if you explicitly convert it.", convertNative: "Convert to modern editor", invalidDraft: "Finish or correct the pending recipient entry before saving." },
  sk: { legacyNativeNotice: "Táto uložená akcia stále používa pôvodné správanie. Zmení sa iba po výslovnom prevedení.", convertNative: "Previesť na moderný editor", invalidDraft: "Pred uložením dokončite alebo opravte rozpracovaného príjemcu." },
  cs: { legacyNativeNotice: "Tato uložená akce stále používá původní chování. Změní se pouze po výslovném převedení.", convertNative: "Převést do moderního editoru", invalidDraft: "Před uložením dokončete nebo opravte rozpracovaného příjemce." },
  hu: { legacyNativeNotice: "Ez a mentett művelet még az eredeti működést használja. Csak kifejezett átalakítás után változik.", convertNative: "Átalakítás a modern szerkesztőre", invalidDraft: "Mentés előtt fejezze be vagy javítsa a függőben lévő címzettet." },
  ro: { legacyNativeNotice: "Această acțiune salvată folosește încă comportamentul inițial. Se schimbă numai după conversia explicită.", convertNative: "Convertește în editorul modern", invalidDraft: "Finalizați sau corectați destinatarul înainte de salvare." },
  it: { legacyNativeNotice: "Questa azione salvata usa ancora il comportamento originale. Cambierà solo dopo una conversione esplicita.", convertNative: "Converti nell’editor moderno", invalidDraft: "Completa o correggi il destinatario in sospeso prima di salvare." },
  de: { legacyNativeNotice: "Diese gespeicherte Aktion verwendet noch das ursprüngliche Verhalten. Sie ändert sich erst nach einer ausdrücklichen Umwandlung.", convertNative: "In den modernen Editor umwandeln", invalidDraft: "Vervollständigen oder korrigieren Sie den Empfänger vor dem Speichern." },
};
const reviewFieldCopy: Record<string, Record<string, string>> = {
  en: { title: "Title", message: "Message", recipient: "Recipients", sender: "Sender", priority: "Priority", deadline: "Deadline", description: "Description", text: "SMS text", gateway: "Gateway", template: "Template", personal: "Manager’s personal account", system: "System account", inherited: "Campaign gateway", target: "Target", mode: "Mode", changedFields: "Changed fields", attachment: "Attachment", clearValue: "Clear value", cc: "CC", bcc: "BCC" },
  sk: { title: "Názov", message: "Správa", recipient: "Príjemcovia", sender: "Odosielateľ", priority: "Priorita", deadline: "Termín", description: "Popis", text: "Text SMS", gateway: "Brána", template: "Šablóna", personal: "Osobný účet manažéra", system: "Systémový účet", inherited: "Brána kampane", target: "Cieľ", mode: "Režim", changedFields: "Zmenené polia", attachment: "Príloha", clearValue: "Vymazať hodnotu", cc: "Kópia", bcc: "Skrytá kópia" },
  cs: { title: "Název", message: "Zpráva", recipient: "Příjemci", sender: "Odesílatel", priority: "Priorita", deadline: "Termín", description: "Popis", text: "Text SMS", gateway: "Brána", template: "Šablona", personal: "Osobní účet manažera", system: "Systémový účet", inherited: "Brána kampaně", target: "Cíl", mode: "Režim", changedFields: "Změněná pole", attachment: "Příloha", clearValue: "Vymazat hodnotu", cc: "Kopie", bcc: "Skrytá kopie" },
  hu: { title: "Cím", message: "Üzenet", recipient: "Címzettek", sender: "Feladó", priority: "Prioritás", deadline: "Határidő", description: "Leírás", text: "SMS-szöveg", gateway: "Átjáró", template: "Sablon", personal: "Vezető személyes fiókja", system: "Rendszerfiók", inherited: "Kampány átjárója", target: "Cél", mode: "Mód", changedFields: "Módosított mezők", attachment: "Melléklet", clearValue: "Érték törlése", cc: "Másolat", bcc: "Titkos másolat" },
  ro: { title: "Titlu", message: "Mesaj", recipient: "Destinatari", sender: "Expeditor", priority: "Prioritate", deadline: "Termen", description: "Descriere", text: "Text SMS", gateway: "Gateway", template: "Șablon", personal: "Contul personal al managerului", system: "Cont de sistem", inherited: "Gateway-ul campaniei", target: "Țintă", mode: "Mod", changedFields: "Câmpuri modificate", attachment: "Atașament", clearValue: "Șterge valoarea", cc: "Copie", bcc: "Copie ascunsă" },
  it: { title: "Titolo", message: "Messaggio", recipient: "Destinatari", sender: "Mittente", priority: "Priorità", deadline: "Scadenza", description: "Descrizione", text: "Testo SMS", gateway: "Gateway", template: "Modello", personal: "Account personale del responsabile", system: "Account di sistema", inherited: "Gateway della campagna", target: "Destinazione", mode: "Modalità", changedFields: "Campi modificati", attachment: "Allegato", clearValue: "Cancella valore", cc: "Copia", bcc: "Copia nascosta" },
  de: { title: "Titel", message: "Nachricht", recipient: "Empfänger", sender: "Absender", priority: "Priorität", deadline: "Frist", description: "Beschreibung", text: "SMS-Text", gateway: "Gateway", template: "Vorlage", personal: "Persönliches Konto der Leitung", system: "Systemkonto", inherited: "Kampagnen-Gateway", target: "Ziel", mode: "Modus", changedFields: "Geänderte Felder", attachment: "Anhang", clearValue: "Wert löschen", cc: "Kopie", bcc: "Blindkopie" },
};
function nativeReviewRows(actionType: string, config: Record<string, any>, locale: string, missionGateway: string | null) {
  const labels = reviewFieldCopy[locale.split("-")[0]] || reviewFieldCopy.en;
  const cardCopy = getAutomationEmailCardRecipientCopy(locale);
  const targets = Array.isArray(config.recipients) ? config.recipients : [];
  const notifyTargets = config.taskGroupId ? [config.taskGroupId] : config.targetRole ? [config.targetRole] : config.userIds || (config.userId ? [config.userId] : []);
  const emailTargets = [
    ...(Array.isArray(config.toTargets) ? config.toTargets.map((item: any) => `${item.kind}:${item.id}`) : []),
    ...String(config.to || "").split(/[;,]/).map(value => value.trim()).filter(Boolean),
  ];
  const text = actionType === "send_sms" ? config.text : ["send_email", "send_email_group", "notify_email", "send_contact_email"].includes(actionType) ? config.body : config.taskText || config.description;
  const rows: string[] = [];
  const add = (label: string, value: unknown) => { if (value != null && String(value).trim()) rows.push(`${label}: ${String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}`); };
  if (actionType === "notify_role") {
    add(labels.title, config.title); add(labels.message, config.message);
    add(labels.recipient, notifyTargets.join(", ")); add(labels.priority, config.priority);
  } else if (["send_email", "send_email_group", "notify_email", "send_contact_email"].includes(actionType)) {
    const cardSourceLines = (field: "to" | "cc" | "bcc") => {
      const configured = config[`${field}CardSources`];
      const legacyMain = String(config[field] || "").split(/[;,]/).some(address => {
        const match = address.trim().match(/^{{\s*([^{}]+?)\s*}}$/);
        return Boolean(match && ["contact.email", "clinic.email", "hospital.email"].includes(match[1].trim().toLowerCase()));
      });
      const sources = Array.isArray(configured)
        ? configured.filter((source: unknown) => source === "main" || source === "persons")
        : legacyMain ? ["main"] : [];
      return sources.map((source: "main" | "persons") => source === "main" ? cardCopy.main : cardCopy.persons);
    };
    const addressSummary = (field: "to" | "cc" | "bcc") => String(config[field] || "").split(/[;,]/).map(address => address.trim()).filter(address => {
      const match = address.match(/^{{\s*([^{}]+?)\s*}}$/);
      return !(cardSourceLines(field).includes(cardCopy.main) && match
        && ["contact.email", "clinic.email", "hospital.email"].includes(match[1].trim().toLowerCase()));
    }).join(", ");
    const toCardSources = cardSourceLines("to");
    const recipientLines = [
      ...emailTargets.filter(target => {
        const match = target.match(/^{{\s*([^{}]+?)\s*}}$/);
        return !(toCardSources.includes(cardCopy.main) && match
          && ["contact.email", "clinic.email", "hospital.email"].includes(match[1].trim().toLowerCase()));
      }),
      ...toCardSources,
      ...(Array.isArray(config.ccTargets) ? config.ccTargets.map((item: any) => `${labels.cc}: ${item.kind}:${item.id}`) : []),
      ...(addressSummary("cc") ? [`${labels.cc}: ${addressSummary("cc")}`] : []),
      ...cardSourceLines("cc").map((source: string) => `${labels.cc}: ${source}`),
      ...(Array.isArray(config.bccTargets) ? config.bccTargets.map((item: any) => `${labels.bcc}: ${item.kind}:${item.id}`) : []),
      ...(addressSummary("bcc") ? [`${labels.bcc}: ${addressSummary("bcc")}`] : []),
      ...cardSourceLines("bcc").map((source: string) => `${labels.bcc}: ${source}`),
    ];
    add(labels.recipient, recipientLines.join(", "));
    add(labels.sender, config.senderMode === "personal" ? labels.personal : labels.system);
    add(labels.title, config.subject); add(labels.message, text);
    if (config.templateId) add(labels.template, config.templateName || config.templateId);
    (Array.isArray(config.attachments) ? config.attachments : []).forEach((attachment: any) => add(labels.attachment, attachment?.name));
  } else if (actionType === "update_record") {
    add(labels.target, `${labels.mode}: ${config.target?.mode || "—"} · ${config.target?.entityType || "—"}${config.target?.recordId ? ` · ${config.target.recordId}` : ""}`);
    const fields = Object.entries(config.fields || {});
    const updateCopy = getUpdateRecordCopy(locale);
    if (fields.length) add(labels.changedFields, fields.map(([key, value]) => {
      const field = UPDATE_RECORD_ENTITIES[config.target?.entityType]?.find(field => field.key === key);
      const name = (updateCopy.field as Record<string, string>)[key] || key;
      const display = value == null ? labels.clearValue
        : field?.kind === "boolean" && typeof value === "boolean" ? (value ? updateCopy.true : updateCopy.false)
        : field?.kind === "enum" ? (updateCopy.option as Record<string, string>)[String(value)] || String(value)
        : String(value);
      return `${name} = ${display}`;
    }).join(" · "));
  } else if (actionType === "send_sms") {
    add(labels.recipient, Array.isArray(config.to) ? config.to.join(", ") : config.to);
    const gateway = config.provider && config.provider !== "default" ? config.provider
      : missionGateway ? `${labels.inherited}: ${missionGateway}` : labels.system;
    add(labels.text, text); add(labels.gateway, gateway);
    if (config.templateId) add(labels.template, config.templateName || config.templateId);
  } else {
    add(labels.title, config.title); add(labels.description, config.description || config.taskText);
    add(labels.recipient, targets.map((item: any) => `${item.kind}:${item.id}`).join(", ") || [config.assignedUserId, config.taskGroupId, config.targetRole].filter(Boolean).join(", "));
    add(labels.priority, config.priority);
    add(labels.deadline, config.dueAt || (config.dueInHours != null ? `${config.dueInHours} h` : ""));
  }
  return rows;
}

export type StatusListServiceActionOption = { value: string; label: string; help: string; icon?: React.ReactNode };
export type StatusListServiceActionTranslate = (key: string) => string;
export type StatusListServiceActionEditorProps = {
  campaignId: string;
  itemId: string;
  questionId?: string;
  automation?: SavedStatusListAction;
  initialActionType?: string;
  initialStage?: "type" | "details";
  presentation?: "dialog" | "inline";
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
  onPendingChange?: (pending: boolean) => void;
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
function missionSettings(settings: unknown): Record<string, any> {
  try {
    const parsed = typeof settings === "string" ? JSON.parse(settings) : settings;
    return parsed && typeof parsed === "object" ? parsed as Record<string, any> : {};
  } catch { return {}; }
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
    campaignId, itemId, questionId, automation, initialActionType, initialStage = "type", presentation = "dialog", locale, sourceLabel, translate,
    actions, roleFallbacks, countries, deadlines, priorities, taskTemplates, variables, conditionFields,
    onSaved, onCancel, onDirtyChange, onPendingChange,
  } = props;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const copy = (key: string) => actionCopy(locale, key);
  const migration = migrationCopy[locale.split("-")[0]] || migrationCopy.en;
  const initialType = initialActionType || "assign_task";
  const [draft, setDraft] = useState<StatusListActionDraft>(() => statusListActionDraft(automation, initialType));
  const [stage, setStage] = useState<Stage>(initialStage);
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [nativeActionError, setNativeActionError] = useState<string | null>(null);
  const [nativeDraftInvalid, setNativeDraftInvalid] = useState(false);
  const [originalConditionJson, setOriginalConditionJson] = useState<string | null>(automation?.conditionJson || null);
  const originalRef = useRef<SavedStatusListAction | undefined>(automation);
  const initializedRef = useRef<string | null>(null);
  const dirtyCallbackRef = useRef(onDirtyChange);
  dirtyCallbackRef.current = onDirtyChange;
  const pendingCallbackRef = useRef(onPendingChange);
  pendingCallbackRef.current = onPendingChange;

  useEffect(() => {
    const recordKey = automation?.id != null ? `saved:${automation.id}` : `new:${campaignId}:${itemId}:${questionId || ""}`;
    if (initializedRef.current === recordKey) return;
    initializedRef.current = recordKey;
    originalRef.current = automation;
    setDraft(statusListActionDraft(automation, initialType));
    setStage(initialStage);
    setOriginalConditionJson(automation?.conditionJson || null);
    setAttemptedSave(false);
  }, [automation?.id, campaignId, itemId, questionId, initialType, initialStage]);

  const needsRole = ["assign_task", "send_email_group", "notify_role"].includes(draft.actionType);
  const needsTaskGroups = draft.actionType === "assign_task";
  const needsEmail = ["send_email", "send_email_group", "notify_email", "send_contact_email"].includes(draft.actionType);
  const needsSms = draft.actionType === "send_sms";
  const needsDisposition = draft.actionType === "set_contact_status";
  const needsHospitals = draft.conditionMode === "field_changed_to" && draft.fieldChangedKey === "contact.hospital_id";
  const needsClinics = draft.conditionMode === "field_changed_to" && draft.fieldChangedKey === "contact.clinic_id";
  const isEdit = automation?.id != null;
  const supportsNativeAction = !!nativeServiceActionTypes[draft.actionType];
  const nativeActionActive = supportsNativeAction && (!isEdit || draft.serviceActionExplicit || automation?.serviceActionConfig != null);
  const legacyNativeAction = isEdit && supportsNativeAction && automation?.serviceActionConfig == null && !draft.serviceActionExplicit;

  const campaignQuery = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId],
    queryFn: () => getJson(`/api/campaigns/${campaignId}`),
    enabled: !!campaignId,
  });
  const contactTypesQuery = useQuery<{ contactTypes?: string[] }>({
    queryKey: ["/api/campaigns", campaignId, "status-list-workflows", "contact-types"],
    queryFn: () => getJson(`/api/campaigns/${campaignId}/status-list-workflows/contact-types`),
    enabled: !!campaignId && ["send_email", "send_email_group", "notify_email", "send_contact_email", "update_record"].includes(draft.actionType),
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
  const campaignSettings = useMemo(() => missionSettings(campaignQuery.data?.settings), [campaignQuery.data?.settings]);
  const normalizeContactType = (value: unknown): string => {
    const type = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (["clinics", "clinic_contact", "clinic_contacts"].includes(type)) return "clinic";
    if (["hospitals", "hospital_contact", "hospital_contacts"].includes(type)) return "hospital";
    if (["customers", "customer_contact", "customer_contacts"].includes(type)) return "customer";
    if (["collaborators", "collaborator_contact", "collaborator_contacts"].includes(type)) return "collaborator";
    return type;
  };
  const campaignContactTypes = Array.from(new Set([
    ...(Array.isArray(contactTypesQuery.data?.contactTypes) ? contactTypesQuery.data.contactTypes : []),
    ...(Array.isArray(campaignSettings.contactTypes) ? campaignSettings.contactTypes : []),
    campaignSettings.contactType,
  ].map(normalizeContactType).filter(Boolean)));
  const uniqueRawSourceType = campaignContactTypes.length === 1 ? campaignContactTypes[0] : undefined;
  const variableSourceType = uniqueRawSourceType && ["clinic", "hospital", "customer", "collaborator"].includes(uniqueRawSourceType)
    ? uniqueRawSourceType : undefined;
  const sourceModule = uniqueRawSourceType === "clinic" || uniqueRawSourceType === "hospital" ? uniqueRawSourceType : undefined;
  const configuredUpdateType = ["clinic", "hospital"].includes(String(draft.serviceActionConfig?.target?.entityType))
    ? draft.serviceActionConfig?.target?.entityType as "clinic" | "hospital" : undefined;
  const resolvedUpdateSource = sourceModule || configuredUpdateType;
  const updateSourceTypeKnown = !!resolvedUpdateSource;
  const sourceTypeOptions: Array<"clinic" | "hospital"> = sourceModule ? [sourceModule] : ["clinic", "hospital"];
  const supportedVariables = filterStatusListActionVariables(variables, locale, variableSourceType || configuredUpdateType);
  const missionContext = {
    defaultEmailTemplateId: String(campaignQuery.data?.defaultEmailTemplateId || campaignSettings.defaultEmailTemplateId || campaignSettings.emailTemplateId || "") || undefined,
    defaultEmailCategoryId: String(campaignQuery.data?.defaultEmailCategoryId || campaignSettings.defaultEmailCategoryId || campaignSettings.emailCategoryId || "") || undefined,
  };
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
      onError: (error: any) => {
      setNativeActionError(error?.message || null);
      const translated = translate("saveErr");
      toast({ title: translated === "saveErr" ? copy("saveError") : translated, description: error?.message, variant: "destructive" });
    },
  });

  useEffect(() => { pendingCallbackRef.current?.(saveMutation.isPending); }, [saveMutation.isPending]);
  useEffect(() => () => { pendingCallbackRef.current?.(false); }, []);

  const selectStage = (next: Stage) => setStage(next);
  const go = (direction: number) => {
    const nextIndex = Math.max(0, Math.min(STAGES.length - 1, STAGES.indexOf(stage) + direction));
    setStage(STAGES[nextIndex]);
  };
  const save = () => {
    setAttemptedSave(true);
    if (nativeActionActive) {
      if (nativeDraftInvalid) {
        setNativeActionError(migration.invalidDraft);
        return;
      }
      const config = draft.serviceActionConfig || {};
      const sharedIssues = statusListNativeActionIssues(draft.actionType, config);
      if (sharedIssues.length) {
        setNativeActionError(sharedIssues.join(" · "));
        return;
      }
      if (draft.actionType === "send_sms" && campaignSmsProvider && config.provider && config.provider !== "default" && config.provider !== campaignSmsProvider) {
        setNativeActionError("The selected SMS gateway conflicts with the campaign gateway.");
        return;
      }
    }
    setNativeActionError(null);
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
  const saveBlocked = saveMutation.isPending || (needsSms && (campaignQuery.isLoading || campaignQuery.isError)) ||
    (nativeActionActive && draft.actionType === "update_record" && (!updateSourceTypeKnown || (contactTypesQuery.isLoading && !configuredUpdateType))) ||
    (nativeActionActive && nativeDraftInvalid) ||
    (nativeActionActive && draft.actionType === "send_sms" && !!campaignSmsProvider && !!draft.serviceActionConfig?.provider
      && draft.serviceActionConfig.provider !== "default" && draft.serviceActionConfig.provider !== campaignSmsProvider);

  return <section className={`slsae${presentation === "inline" ? " slsae-inline" : ""}`} data-presentation={presentation} aria-busy={saveMutation.isPending} data-testid="status-list-service-action-editor">
    <fieldset className="slsae-lock" disabled={saveMutation.isPending}>
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
          <select data-testid="service-action-type" value={draft.actionType} onChange={event => {
            const nextType = event.target.value;
            setNativeActionError(null);
            setNativeDraftInvalid(false);
            setDraft(previous => ({ ...previous, actionType: nextType,
              serviceActionConfig: nativeServiceActionTypes[nextType] ? emptyNativeActionConfig(nextType) : null,
              serviceActionExplicit: !!nativeServiceActionTypes[nextType],
            }));
          }}>
            {availableActions.map(action => <option key={action.value} value={action.value}>{action.label}</option>)}
          </select>
        </label>
        {selectedAction?.icon && <div className="slsae-callout wide" aria-hidden="true">{selectedAction.icon} {selectedAction.label}</div>}
        {selectedAction?.help && <p className="slsae-callout wide">{selectedAction.help}</p>}
        <p className="slsae-callout wide">{copy("safety")}</p>
      </div>}
      {stage === "details" && nativeActionActive && draft.actionType === "update_record" && !sourceModule && contactTypesQuery.isLoading && !configuredUpdateType
        ? <div className="slsae-loading wide" role="status"><div className="slsae-skeleton" /><div className="slsae-skeleton" /></div>
        : null}
      {stage === "details" && nativeActionActive && draft.actionType === "update_record" && contactTypesQuery.isError && !sourceModule
        ? <div className="slsae-error wide" role="alert">{copy("lookupError")} <button className="slsae-button" type="button" onClick={() => void contactTypesQuery.refetch()}>{copy("retry")}</button></div>
        : null}
      {stage === "details" && nativeActionActive && (draft.actionType !== "update_record" || sourceModule || !contactTypesQuery.isLoading || configuredUpdateType) && <StatusListNativeActionEditor draft={draft} setDraft={setDraft} locale={locale}
        countryCodes={Array.isArray(campaignQuery.data?.countryCodes) ? campaignQuery.data.countryCodes : []}
        sourceModule={sourceModule} variableSourceType={variableSourceType} sourceTypeOptions={sourceTypeOptions} missionContext={missionContext}
        missionGateway={campaignSmsProvider} sourceLabel={sourceLabel} variables={supportedVariables} actionId={automation?.id == null ? undefined : String(automation.id)}
        onDraftValidityChange={setNativeDraftInvalid}
        legacyTemplateId={automation && automation.serviceActionConfig == null && draft.serviceActionExplicit && draft.actionType === automation.actionType
          ? draft.actionType === "send_sms" ? automation.smsTemplateId
            : ["send_email_group", "notify_email", "send_contact_email"].includes(draft.actionType) ? automation.emailTemplateId : null
          : null} />}
      {stage === "details" && legacyNativeAction && <>
        <div className="slsae-callout wide" role="note">
          <span>{migration.legacyNativeNotice}</span>
          <button type="button" className="slsae-button" data-testid="service-action-convert-native" onClick={() => {
            setNativeDraftInvalid(false);
            setDraft(previous => ({ ...previous, serviceActionConfig: nativeConfigFromLegacy(originalRef.current), serviceActionExplicit: true }));
          }}>{migration.convertNative}</button>
        </div>
        {lookupLoading && <div className="slsae-loading" aria-label={copy("detailsTitle")}><div className="slsae-skeleton" /><div className="slsae-skeleton" /><div className="slsae-skeleton" /></div>}
        {failedQueries.length > 0 && <div className="slsae-error" role="alert">{copy("lookupError")} <button className="slsae-button" type="button" onClick={retryLookups}>{copy("retry")}</button></div>}
        <StatusListServiceActionFields
          draft={draft} setDraft={setDraft} locale={locale} taskTemplates={taskTemplates} variables={supportedVariables}
          roleFallbacks={roleFallbacks} countries={countries} deadlines={deadlines} priorities={priorities}
          taskGroups={groupsQuery.data || []} roles={rolesQuery.data || []} templates={templates}
          categories={categoriesQuery.data || []} dispositions={dispositions}
          provider={campaignSmsProvider} callbackDisposition={callbackDisposition}
        />
      </>}
      {stage === "details" && !nativeActionActive && !legacyNativeAction && <>
        {lookupLoading && <div className="slsae-loading" aria-label={copy("detailsTitle")}><div className="slsae-skeleton" /><div className="slsae-skeleton" /><div className="slsae-skeleton" /></div>}
        {failedQueries.length > 0 && <div className="slsae-error" role="alert">{copy("lookupError")} <button className="slsae-button" type="button" onClick={retryLookups}>{copy("retry")}</button></div>}
        <StatusListServiceActionFields
          draft={draft} setDraft={setDraft} locale={locale} taskTemplates={taskTemplates} variables={supportedVariables}
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
          <section className="slsae-review-card"><h4>{copy("actionSection")}</h4><p>{selectedAction?.label || draft.actionType}</p>
            {(nativeActionActive ? nativeReviewRows(draft.actionType, draft.serviceActionConfig || {}, locale, campaignSmsProvider) : reviewRows).map(row => <p key={row}>{row}</p>)}</section>
          <section className="slsae-review-card"><h4>{copy("conditionSection")}</h4><p>{condition}</p></section>
          <section className="slsae-review-card"><h4>{copy("scopeSection")}</h4><p>{copy("sourceLine")} · {sourceLabel}</p></section>
        </div>
        <aside className="slsae-review-aside"><strong>{copy("reviewHelp")}</strong>{copy("safety")}<br /><br />{copy("noElse")}</aside>
      </div>}
    </div>
     {nativeActionActive && nativeDraftInvalid && <p className="slsae-error" role="alert">{migration.invalidDraft}</p>}
     {attemptedSave && validationError && <p className="slsae-error" role="alert">{errorMap[validationError]}</p>}
     {(nativeActionError || saveMutation.isError) && <p className="slsae-error" role="alert">{nativeActionError || (saveMutation.error as Error)?.message || copy("saveError")}</p>}
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
    </fieldset>
  </section>;
}
