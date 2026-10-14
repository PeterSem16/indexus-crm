import { activityTemplateMissingVariables, activityTemplateUsedVariables } from "./automation-activity-template-utils";
import { classifySource, sourceForModule, type AutomationTemplateSource } from "./automation-template-classification";

type Template = { id: string; name: string; subject?: unknown; description?: unknown; content?: unknown; contentHtml?: unknown; isActive?: boolean };
export function templateEligibility(template: Template, variables: { value: string; label: string }[], sourceModule?: string) {
  const missing = activityTemplateMissingVariables(template, variables);
  const used = activityTemplateUsedVariables(template);
  const analyzed = template.id.includes("-analysis-") || used.some(key => key.startsWith("analysis.") || key.startsWith("communication."));
  const family = classifySource(template);
  const requiredSource: AutomationTemplateSource | null = analyzed ? "analysis" : family === "other" || (!template.id.startsWith("indexus-activity-") && family === "records") ? null : family;
  const selected = sourceForModule(sourceModule);
  const parts = template.id.split("-");
  const activityModule = template.id.startsWith("indexus-activity-") && !analyzed ? parts[3] : null;
  const sourceMismatch = Boolean(sourceModule && requiredSource && (analyzed
    ? !variables.some(item => item.value.replace(/[{}]/g, "").trim().startsWith("analysis."))
    : requiredSource !== selected || (requiredSource === "records" && activityModule !== sourceModule)));
  return {
    usable: template.isActive !== false && !sourceMismatch && missing.length === 0,
    missing, requiredSource, sourceMismatch,
    requiredModule: requiredSource === "records" ? activityModule : null,
    analysisRequired: analyzed && (sourceMismatch || missing.some(key => key.startsWith("analysis.") || key.startsWith("communication."))),
  };
}
