import { healthcareStates } from "@shared/status-list-healthcare";
import type { ConditionFieldMetadata } from "./status-list-service-action-conditions";
import { getHealthcareCopy } from "./status-list-healthcare-copy";

const en = getHealthcareCopy("en"), sk = getHealthcareCopy("sk");
export const healthcareActionConditionFields: ConditionFieldMetadata[] = [
  { key: "healthcare.state", category: "healthcare", labelSk: sk.title, labelEn: en.title,
    descSk: sk.summary, descEn: en.summary, valueType: "select",
    ops: [{value:"eq",labelSk:"=",labelEn:"="},{value:"neq",labelSk:"≠",labelEn:"≠"}],
    options: healthcareStates.map(state=>({value:state,labelSk:sk.states[state],labelEn:en.states[state]})) },
  { key: "healthcare.failed_attempts", category: "healthcare", labelSk: sk.attempts, labelEn: en.attempts,
    descSk: sk.threshold, descEn: en.threshold, valueType: "number",
    ops: [["eq","="],["neq","≠"],["gt",">"],["gte","≥"],["lt","<"],["lte","≤"]]
      .map(([value,label])=>({value,labelSk:label,labelEn:label})) },
];
