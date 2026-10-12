export type FlowDetail = { label: string; value: string };
export type FlowStep = { title: string; details: FlowDetail[] };
export type FlowCondition =
  | { kind: "leaf"; field: string; operator: string; value?: string }
  | { kind: "all" | "any" | "not"; children: FlowCondition[] };
export type AutomationFlowModel = {
  title: string;
  description?: string;
  enabled: boolean;
  scope: FlowDetail[];
  trigger: FlowStep;
  analysis?: FlowStep;
  conditions: FlowCondition | null;
  conditionsIgnored?: boolean;
  actions: FlowStep[];
};

export type FlowRule = {
  name: string; description?: string | null; module: string; enabled: boolean;
  countryCode?: string | null; countryCodes?: string[] | null;
  trigger: Record<string, any>; conditions?: any; actions?: Array<{ type: string; config?: Record<string, any> }>;
  rateLimitPerHour?: number | null; autoDisableThreshold?: number;
};
export type FlowLabels = {
  field: (key: string) => string;
  operator: (key: string) => string;
  event: (key: string) => string;
  action: (key: string) => string;
  value: (value: unknown, key?: string) => string;
  analysis: string;
  schedule: string;
  allCountries: string;
  yes: string;
  no: string;
  unknown: string;
};
const internalKey = /(?:ActionVersion$|^legacySource$|^acknowledged$|^ownershipAcknowledged$)/;
const secretKey = /password|secret|token|authorization|api[-_]?key/i;
const humanize = (key: string) => key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[._-]/g, " ");

// Pure projection of the saved/draft rule. No evaluation or configuration mutation.
export function buildAutomationFlowModel(rule: FlowRule, labels: FlowLabels): AutomationFlowModel {
  const format = (value: unknown, key?: string): string => {
    if (value == null) return labels.unknown;
    if (typeof value === "boolean") return value ? labels.yes : labels.no;
    return labels.value(value, key);
  };
  const details = (object: Record<string, any>, path: string[] = []): FlowDetail[] =>
    Object.entries(object || {}).flatMap(([key, value]): FlowDetail[] => {
      if ((!path.length && internalKey.test(key)) || value === undefined) return [];
      const name = [...path, key];
      const label = name.map(part => labels.field(part) || humanize(part)).join(" › ");
      if (secretKey.test(key)) return [{ label, value: "••••••••" }];
      if (Array.isArray(value)) {
        if (!value.length) return [{ label, value: labels.unknown }];
        if (value.some(item => item !== null && typeof item === "object"))
          return value.flatMap((item, i) => item !== null && typeof item === "object"
            ? details(item, [...name, String(i + 1)])
            : [{ label: `${label} › ${i + 1}`, value: format(item, key) }]);
        return [{ label, value: value.map(item => format(item, key)).join(", ") }];
      }
      if (value !== null && typeof value === "object") return details(value, name);
      // Render HTML-authored messages as readable text, never as executable HTML.
      const text = typeof value === "string" && /html|body|message|description/i.test(key)
        ? value.replace(/<br\s*\/?>|<\/(?:p|div|li)>/gi, "\n").replace(/<[^>]*>/g, "") : value;
      return [{ label, value: format(text, key) }];
    });
  const condition = (node: any): FlowCondition | null => {
    if (!node) return null;
    // Same precedence as the engine; importantly, NOT is not flattened into AND.
    for (const kind of ["all", "any"] as const) {
      if (Array.isArray(node[kind])) return {
        kind, children: node[kind].map(condition).filter((child: FlowCondition | null): child is FlowCondition => !!child),
      };
    }
    if (node.not) {
      const child = condition(node.not);
      return { kind: "not", children: child ? [child] : [] };
    }
    return { kind: "leaf", field: labels.field(node.field || "") || humanize(node.field || ""),
      operator: labels.operator(node.op || "") || humanize(node.op || ""),
      ...(!["is_null", "is_not_null", "changed", "exists", "not_exists", "is_empty", "not_empty"].includes(node.op)
        ? { value: Array.isArray(node.value) ? node.value.map((v: unknown) => format(v, node.field)).join(", ")
          : node.value !== null && typeof node.value === "object"
            ? details(node.value).map(item => `${item.label}: ${item.value}`).join("; ")
            : format(node.value, node.field) } : {}) };
  };
  const trigger = rule.trigger || {};
  const { analysis, legacySource: _legacySource, ...triggerSettings } = trigger;
  const analysisSettings = analysis ? { ...analysis } : undefined;
  if (analysisSettings?.mailboxMode === "all" && !analysisSettings.mailboxUserIds?.length)
    delete analysisSettings.mailboxUserIds;
  const title = trigger.type === "schedule" ? labels.schedule : labels.event(trigger.eventType || "");
  const countries = rule.countryCodes?.length ? rule.countryCodes : rule.countryCode ? [rule.countryCode] : [];
  const scope: FlowDetail[] = [
    { label: labels.field("module"), value: format(rule.module, "module") },
    { label: labels.field("countryCodes"), value: countries.length ? countries.map(code => format(code, "countryCodes")).join(", ") : labels.allCountries },
    ...(rule.rateLimitPerHour != null ? [{ label: labels.field("rateLimitPerHour"), value: String(rule.rateLimitPerHour) }] : []),
    ...(rule.autoDisableThreshold != null ? [{ label: labels.field("autoDisableThreshold"), value: String(rule.autoDisableThreshold) }] : []),
  ];
  // The engine ignores IF for schedule/once, but retains it in storage.
  // Keep it visible in the preview and mark it as inactive in the view.
  return {
    title: rule.name, description: rule.description || undefined, enabled: rule.enabled, scope,
    trigger: { title, details: details(triggerSettings) },
    ...(analysisSettings ? { analysis: { title: labels.analysis, details: details(analysisSettings)
      .map(detail => detail.label === labels.field("senderEmails") && !analysisSettings.senderEmails?.length
        ? { ...detail, value: labels.value("any_sender", "senderEmails") } : detail) } } : {}),
    conditions: condition(rule.conditions),
    conditionsIgnored: trigger.type === "schedule" && (trigger.mode || "once") === "once",
    actions: (rule.actions || []).map(action => ({ title: labels.action(action.type), details: details(action.config || {}) })),
  };
}
