import { useI18n } from "@/i18n";
import { getRecordEntryCopy } from "@/i18n/automation-record-entry-copy";
import { buildAutomationFlowModel, type FlowRule } from "@/lib/automation-flow-model";
import { getFlowchartCopy } from "@/i18n/automation-flowchart-copy";
import { getUnifiedAutomationCopy, analysisChannelLabel } from "@/lib/automation-unified-copy";
import { getCommunicationAnalysisCopy } from "@/lib/communication-analysis-copy";
import { getFlowExtraLabels } from "@/i18n/automation-flow-labels";
import { getConditionChoiceCopy } from "@/i18n/automation-condition-choice-copy";
import { communicationVariableLabels } from "@/i18n/automation-communication-variable-copy";
import { contentSignalLabels } from "@/i18n/automation-content-signal-copy";
import { getForwardCopy } from "@/i18n/automation-forward-copy";
import { AutomationRuleFlowchart } from "./automation-rule-flowchart";
import { AutomationFlowFullscreen } from "./automation-flow-fullscreen";
import { getAutomationFlowFullscreenCopy } from "@/i18n/automation-flow-fullscreen-copy";

type Option = { value: string; label: string };
type Named = { id: string; name?: string; fullName?: string; email?: string; displayAlias?: string | null };
export type FlowCatalog = {
  modules: Option[]; eventTypes: Option[]; actionTypes: Option[]; countries: Option[];
  fields?: Record<string, Option[]>; operators?: Option[]; metricTypes?: Option[];
};
export function AutomationFlowPreview({ rule, catalog, users = [], taskGroups = [], roles = [], departments = [], rules = [], compact }: {
  rule: FlowRule; catalog: FlowCatalog; users?: Named[]; taskGroups?: Named[]; roles?: Named[];
  departments?: Named[]; rules?: Named[]; compact?: boolean;
}) {
  const { locale, t } = useI18n();
  const copy = getFlowchartCopy(locale);
  const extra = getFlowExtraLabels(locale);
  const unified = getUnifiedAutomationCopy(locale);
  const editor = t.automationServices.editorCatalog;
  const named = new Map([...users, ...taskGroups, ...roles, ...departments, ...rules]
    .map(item => [item.id, item.displayAlias || item.fullName || item.name || item.email || item.id]));
  const moduleLabel = (id: string) => editor.moduleLabels[id] || catalog.modules.find(item => item.value === id)?.label || id;
  const eventLabel = (id: string) => editor.eventLabels[id] || catalog.eventTypes.find(item => item.value === id)?.label || id;
  const fields = Object.values(catalog.fields || {}).flat();
  const model = buildAutomationFlowModel(rule, {
    yes: copy.boolean.yes, no: copy.boolean.no, unknown: copy.unknown,
    allCountries: copy.allCountries, analysis: unified.communication, schedule: copy.schedule,
    field: key => {
      const aliases: Record<string, string> = {
        entityType: copy.fields.recordType, type: copy.fields.mode,
        analyzeContent: unified.content, analyzeAttachments: unified.attachments, channels: unified.channels,
        mailboxUserIds: unified.owners, mailboxMode: unified.owners, senderEmails: unified.senderEmails,
        metricType: unified.metric, checkFrequency: unified.frequency, cooldownMinutes: unified.cooldown,
        rateLimitPerHour: copy.rateLimit, autoDisableThreshold: copy.threshold,
        title: copy.fields.name, taskText: copy.fields.body, recipientType: copy.fields.recipient,
        assignedUserId: copy.fields.userId, targetUserIds: copy.fields.userId,
        assignedDepartmentId: copy.fields.groupId, taskGroupIds: copy.fields.groupId,
        targetRole: extra.role, templateHtml: copy.fields.message,
      };
      return contentSignalLabels(locale)[key] || communicationVariableLabels(locale)[key] || extra[key] || aliases[key] ||
        t.automationServices.taskRules.fieldLabels[key] || editor.fieldLabels[key] ||
        getCommunicationAnalysisCopy(locale).fieldLabels[key] || copy.fields[key] ||
        fields.find(field => field.value === key)?.label || key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[._-]/g, " ");
    },
    operator: key => t.automationServices.conditionEditor.operators[key] ||
      catalog.operators?.find(item => item.value === key)?.label || key,
    event: eventLabel,
    action: key => key === "record_analysis" ? getRecordEntryCopy(locale).actionLabel : key === "forward_message" ? getForwardCopy(locale).heading
      : (t.automationServices.names as Record<string, string>)[key] || catalog.actionTypes.find(item => item.value === key)?.label || key,
    value: (value, key) => {
      const text = String(value);
      if (named.has(text)) return named.get(text)!;
      if (key === "destination" && ["email", "user", "back_office"].includes(text))
        return text === "back_office" ? getForwardCopy(locale).backOffice : getForwardCopy(locale)[text as "email" | "user"];
      if (key === "mode" && ["whole", "attachments"].includes(text)) return getForwardCopy(locale)[text as "whole" | "attachments"];
      if (key === "selection" && ["invoice", "all"].includes(text)) return getForwardCopy(locale)[text as "invoice" | "all"];
      if (key === "module" || key === "entityType" || key === "recordType") return moduleLabel(text);
      if (key === "eventType") return eventLabel(text);
      if (key === "countryCodes" || key === "countryCode") return catalog.countries.find(item => item.value === text)?.label || text;
      if (key && ["analysis.sentiment", "analysis.tone", "newValues.sentiment", "newValues.provider", "newValues.alertLevel", "newValues.type", "communication.type", "communication.provider", "communication.direction"].includes(key)) {
        const option = getConditionChoiceCopy(locale).values[text] || getCommunicationAnalysisCopy(locale).optionLabels[text];
        if (option) return option;
      }
      if (key === "channels" || key === "newValues.type" || key === "communication.type") return analysisChannelLabel(locale, text);
      if (key === "metricType") return catalog.metricTypes?.find(item => item.value === text)?.label || text;
      if (key === "attachmentSelectionMode") return text === "invoices" ? unified.invoicesOnly : text === "all" ? unified.allTrusted : text;
      if (/priority$/.test(key || "")) return (t.tasks.priorities as Record<string, string>)[text] || text;
      if (/status$/.test(key || "")) return (t.tasks.statuses as Record<string, string>)[text] || text;
      if (key === "mailboxMode" && text === "all") return unified.allOwners;
      if ((key === "mode" || key === "type") && text === "event") return extra.event;
      if (key === "mode" && text === "once") return extra.oncePerTick;
      if (key === "mode" && text === "per_record") return copy.perRecord;
      return extra[`value.${text}`] || text;
    },
  });
  return (
    <AutomationFlowFullscreen
      title={model.title}
      copy={getAutomationFlowFullscreenCopy(locale)}
    >
      <AutomationRuleFlowchart model={model} locale={locale} compact={compact} />
    </AutomationFlowFullscreen>
  );
}
