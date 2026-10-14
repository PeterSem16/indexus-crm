/** Prototype-only fixtures. No API calls or real rule execution. */
export type PrototypeRule = {
  id: string; name: string; description: string | null; module: string;
  countryCode: string | null; countryCodes?: string[] | null;
  enabled: boolean; isSystem: boolean; createdByUserId: string;
  trigger: Record<string, any>; conditions: any; actions: { type: string; config: Record<string, any> }[];
  rateLimitPerHour: number | null; updatedAt: string;
  consecutiveErrorCount?: number; disabledReason?: string | null; lastErrorMessage?: string | null;
};

const defaults = { countryCode: null, isSystem: false, enabled: true, createdByUserId: "prototype-owner",
  rateLimitPerHour: 60, updatedAt: "2026-10-14T07:10:00+02:00" };
const notify = { type: "notify_user", config: { notificationActionVersion: 2, title: "Upozornenie tímu" } };
export const demoRules: PrototypeRule[] = [
  { ...defaults, id: "invoice-inbox", name: "Faktúry do Back Office", description: "Rozpozná faktúru v e-maile alebo prílohe a odovzdá ju tímu na kontrolu.",
    module: "communication", countryCodes: ["SK", "CZ"], trigger: { type: "event", eventType: "communication.received", entityType: "communication",
      analysis: { channels: ["email"], analyzeContent: true, analyzeAttachments: true }, noMatchActions: [notify] },
    conditions: { all: [{ field: "analysis.hasInvoice", op: "eq", value: true }] },
    actions: [{ type: "create_task", config: { title: "Skontrolovať prijatý dokument" } }, { type: "forward_message", config: { destination: "back_office" } }] },
  { ...defaults, id: "negative-mail", name: "Negatívny e-mail: upozorniť tím", description: "Dôležitá nespokojnosť nezostane bez odozvy.",
    module: "communication", countryCodes: ["SK"], trigger: { type: "event", eventType: "sentiment.negative", entityType: "communication" },
    conditions: { all: [{ field: "newValues.type", op: "eq", value: "email" }] }, actions: [notify] },
  { ...defaults, id: "task-owner", name: "Oznámenie novému riešiteľovi", description: "Po priradení úlohy informuje zodpovedného kolegu.",
    module: "task", countryCodes: null, trigger: { type: "event", eventType: "task.assigned", entityType: "task" },
    conditions: null, actions: [notify] },
  { ...defaults, id: "overdue", name: "Úlohy po termíne: eskalácia", description: "Upozorní Back Office, keď úloha prekročí svoj termín.",
    module: "task", countryCodes: ["SK", "CZ"], trigger: { type: "event", eventType: "task.overdue", entityType: "task" },
    conditions: null, actions: [{ type: "send_email", config: { subject: "Úloha po termíne" } }],
    consecutiveErrorCount: 2, lastErrorMessage: "Systémová schránka potrebuje opätovné pripojenie." },
  { ...defaults, id: "clinic-welcome", name: "Uvítanie novej kliniky", description: "Pripraví uvítací e-mail pri založení novej kliniky.",
    module: "clinic", countryCodes: ["HU"], enabled: false, trigger: { type: "event", eventType: "created", entityType: "clinic" },
    conditions: null, actions: [{ type: "send_email", config: { subject: "Vitajte v spolupráci s INDEXUS" } }] },
  { ...defaults, id: "daily-summary", name: "Denný prehľad otvorených úloh", description: "Každý deň pripraví prehľad pre zodpovedný tím.",
    module: "task", countryCodes: ["SK"], trigger: { type: "schedule", interval: "daily", mode: "once" },
    conditions: null, actions: [notify], isSystem: true },
  { ...defaults, id: "metric-review", name: "Laboratórium: výsledky čakajú na spracovanie", description: "Návrh náhrady pôvodného pravidla. Vyžaduje kontrolu pred aktiváciou.",
    module: "task", countryCodes: ["SK"], enabled: false, trigger: { type: "event", eventType: "metric.threshold", entityType: "task",
      metric: { metricType: "pending_lab_results", threshold: 10 },
      legacySource: { kind: "metric", id: "prototype-metric-source" } },
    conditions: null, actions: [notify] },
  { ...defaults, id: "missed-call", name: "Zmeškaný hovor: úloha pre Back Office", description: "Zachová nadväzujúci kontakt v správnej Mission.",
    module: "call", countryCodes: ["SK"], enabled: false,
    trigger: { type: "event", eventType: "call.abandoned", entityType: "call" },
    conditions: { all: [{ field: "newValues.missionId", op: "eq", value: "prototype-mission" }] },
    actions: [{ type: "create_task", config: { title: "Kontaktovať volajúceho" } }],
    disabledReason: "Pozastavené po opakovaných chybách", consecutiveErrorCount: 5,
    lastErrorMessage: "Cieľová skupina nie je dostupná." },
];

export const countries = [{ value: "SK", label: "Slovensko" }, { value: "CZ", label: "Česko" }, { value: "HU", label: "Maďarsko" }];
export const moduleLabels: Record<string, string> = { communication: "Komunikácia", task: "Úlohy", clinic: "Kliniky", call: "Hovory" };
export const eventLabels: Record<string, string> = {
  "communication.received": "Prijatá správa", "sentiment.negative": "Negatívna správa",
  "task.assigned": "Priradenie úlohy", "task.overdue": "Úloha po termíne", created: "Vytvorenie záznamu",
  "metric.threshold": "Prekročenie hranice", "call.abandoned": "Zmeškaný hovor",
};
export const actionLabels: Record<string, string> = {
  notify_user: "Upozorniť kolegu", create_task: "Vytvoriť úlohu", forward_message: "Odovzdať správu",
  send_email: "Odoslať e-mail", send_sms: "Odoslať SMS", record_analysis: "Zapísať analýzu",
};
export const isReviewLocked = (rule: PrototypeRule) => !!rule.trigger.legacySource && !rule.trigger.legacySource.reviewActivatedAt;
export const hasErrors = (rule: PrototypeRule) => !!rule.disabledReason || (rule.consecutiveErrorCount || 0) > 0;
export const whenLabel = (rule: PrototypeRule) => rule.trigger.type === "schedule" ? "Denne · plánovane" : eventLabels[rule.trigger.eventType] || rule.trigger.eventType;
export const countryLabel = (rule: PrototypeRule) => (rule.countryCodes?.length ? rule.countryCodes : rule.countryCode ? [rule.countryCode] : [])
  .map(code => countries.find(country => country.value === code)?.label || code).join(", ") || "Všetky krajiny";
export const conditionLabel = (rule: PrototypeRule) => !rule.conditions ? "Bez podmienok"
  : rule.id === "invoice-inbox" ? "Zistená faktúra"
    : rule.id === "negative-mail" ? "Kanál je e-mail" : "Vybraná Mission";
export const elseLabel = (rule: PrototypeRule) => rule.trigger.noMatchActions?.length
  ? rule.trigger.noMatchActions.map((action: any) => actionLabels[action.type] || action.type).join(" + ")
  : rule.trigger.noMatchRuleId ? "Pokračovať iným pravidlom" : "Zastaviť";
