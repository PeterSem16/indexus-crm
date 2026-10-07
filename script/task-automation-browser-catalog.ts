import {
  ACTION_TARGETS, AUTOMATION_SERVICE_DETAILS, FIELD_OPTIONS, MODULE_EVENTS, MODULE_LABELS,
  OPERATORS, RECIPIENT_CAPABILITIES, RECIPIENT_TEMPLATES, SCHEDULE_RECORD_MODULES, fieldsForEvent, hasChangeSnapshot,
} from "../server/lib/automation-capabilities";

// Load the server's real catalog through tsx rather than Playwright's Babel
// parser (the large shared schema has legacy duplicate type declarations).
const modules = Object.keys(MODULE_EVENTS);
console.log(JSON.stringify({
  modules: modules.map(value => ({ value, label: MODULE_LABELS[value] })),
  eventTypes: [...new Set(Object.values(MODULE_EVENTS).flat())].map(value => ({
    value, label: value, availableIn: modules.filter(module => MODULE_EVENTS[module].includes(value)), changeSnapshot: hasChangeSnapshot(value),
  })),
  actionTypes: Object.entries(ACTION_TARGETS).map(([value, targets]) => ({
    value, label: value, availableIn: targets || modules, configSchema: {},
    recipientTypes: [], ...AUTOMATION_SERVICE_DETAILS[value],
  })),
  operators: OPERATORS.map(operator => ({ ...operator, availableIn: modules })),
  fields: FIELD_OPTIONS,
  fieldsByEvent: Object.fromEntries(modules.map(module => [module,
    Object.fromEntries([...MODULE_EVENTS[module], "schedule.tick"].map(event => [event, fieldsForEvent(module, event)])),
  ])),
  recipients: RECIPIENT_CAPABILITIES, recipientTemplatesByEvent: RECIPIENT_TEMPLATES,
  countries: [{ value: "SK", label: "Slovakia" }, { value: "CZ", label: "Czechia" }, { value: "HU", label: "Hungary" }],
  schedule: { perRecordModules: SCHEDULE_RECORD_MODULES, maxMatches: 100 },
  managedServices: [], statusListServices: [], inboundServices: [], outboundServices: [], integrationStatus: [],
}));
