import React from "react";
import type { ActionRule, SavedStatusListAction, StatusListActionDraft } from "@/lib/status-list-action-draft";
import type { ServiceActionOption } from "./status-list-service-action-fields";
import {
  actionCopy, catalogCategoryLabel, catalogDescription, catalogFieldLabel,
  catalogOperatorLabel, catalogOptionLabel,
} from "./status-list-service-action-copy";

export type ConditionFieldMetadata = {
  key: string;
  category: string;
  labelSk: string;
  labelEn: string;
  descSk: string;
  descEn: string;
  ops: { value: string; labelSk: string; labelEn: string }[];
  valueType: "text" | "number" | "select" | "bool" | "disp_count";
  options?: { value: string; labelSk: string; labelEn: string }[];
};
export type ConditionsProps = {
  draft: StatusListActionDraft;
  setDraft: React.Dispatch<React.SetStateAction<StatusListActionDraft>>;
  locale: string;
  conditionFields: ConditionFieldMetadata[];
  countries: ServiceActionOption[];
  hospitals: any[];
  clinics: any[];
  originalCondition?: SavedStatusListAction;
  originalConditionJson?: string | null;
};
const localized = (locale: string, sk: string, en: string) => locale === "sk" ? sk : en;
const fieldName = (field: ConditionFieldMetadata, locale: string) => catalogFieldLabel(locale, field.key, localized(locale, field.labelSk, field.labelEn));
const addUnknown = (options: ServiceActionOption[], value: string) => value && !options.some(option => option.value === value) ? [{ value, label: value }, ...options] : options;

function ruleValueControl(field: ConditionFieldMetadata | undefined, value: string, testId: string, update: (value: string) => void, locale: string, copy: (key: string) => string) {
  if (field?.valueType === "disp_count") {
    const separator = value.indexOf(":");
    const code = separator < 0 ? value : value.slice(0, separator);
    const count = separator < 0 ? "" : value.slice(separator + 1);
    return <div className="slsae-disp-count">
      <input aria-label={copy("dispCode")} data-testid={`${testId}-code`} value={code} placeholder={copy("dispCode")} onChange={event => update(`${event.target.value}:${count}`)} />
      <input aria-label={copy("count")} data-testid={`${testId}-count`} type="number" min="0" value={count} placeholder={copy("count")} onChange={event => update(`${code}:${event.target.value}`)} />
    </div>;
  }
  if (field?.valueType === "bool") return <select aria-label={copy("value")} data-testid={testId} value={value} onChange={event => update(event.target.value)}>
    <option value="">{copy("value")}</option>
    {addUnknown([{ value: "true", label: catalogOptionLabel(locale, "true", "Yes") }, { value: "false", label: catalogOptionLabel(locale, "false", "No") }], value).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>;
  if (field?.valueType === "select" && field.options?.length) return <select aria-label={copy("value")} data-testid={testId} value={value} onChange={event => update(event.target.value)}>
    <option value="">{copy("value")}</option>
    {addUnknown(field.options.map(option => ({ value: option.value, label: catalogOptionLabel(locale, option.value, localized(locale, option.labelSk, option.labelEn)) })), value).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>;
  return <input aria-label={copy("value")} data-testid={testId} type={field?.valueType === "number" ? "number" : "text"} value={value} onChange={event => update(event.target.value)} />;
}

export function StatusListServiceActionConditions({ draft, setDraft, locale, conditionFields, countries, hospitals, clinics, originalCondition, originalConditionJson }: ConditionsProps) {
  const copy = (key: string) => actionCopy(locale, key);
  const update = <K extends keyof StatusListActionDraft>(key: K, value: StatusListActionDraft[K]) => setDraft(previous => ({ ...previous, [key]: value }));
  const hasSavedCondition = !!(originalConditionJson || originalCondition?.conditionField);
  const modes: ServiceActionOption[] = ["always", "country", "answer", "compound", "field_changed_to", ...(hasSavedCondition ? ["stored"] : [])].map(value => ({ value, label: copy(value) }));
  const categories = Array.from(new Set(conditionFields.map(field => field.category)));
  const changedFields = conditionFields.filter(field => ["contact", "campaign"].includes(field.category) || field.key === draft.fieldChangedKey);
  const fieldOptions = Array.from(new Set(changedFields.map(field => field.category))).flatMap(category => [
    { value: `__category:${category}`, label: `— ${catalogCategoryLabel(locale, category)} —` },
    ...changedFields.filter(field => field.category === category).map(field => ({ value: field.key, label: fieldName(field, locale) })),
  ]);
  const selectedChangedField = conditionFields.find(field => field.key === draft.fieldChangedKey);
  const changedOptions = selectedChangedField?.options?.map(option => ({
    value: option.value, label: catalogOptionLabel(locale, option.value, localized(locale, option.labelSk, option.labelEn)),
  })) ?? [];
  const changedSelectOptions = draft.fieldChangedKey === "contact.hospital_id"
    ? hospitals.filter(item => item?.id != null).map(item => ({ value: String(item.id), label: item.name || String(item.id) }))
    : draft.fieldChangedKey === "contact.clinic_id"
      ? clinics.filter(item => item?.id != null).map(item => ({ value: String(item.id), label: item.name || String(item.id) }))
      : changedOptions;
  const changedAsSelect = selectedChangedField?.valueType === "select" || ["contact.hospital_id", "contact.clinic_id"].includes(draft.fieldChangedKey);
  const decodedCondition = (() => {
    const raw = {
      ...(originalCondition?.conditionField != null ? { conditionField: originalCondition.conditionField } : {}),
      ...(originalCondition?.conditionOperator != null ? { conditionOperator: originalCondition.conditionOperator } : {}),
      ...(originalCondition?.conditionValue != null ? { conditionValue: originalCondition.conditionValue } : {}),
      ...(originalConditionJson ? { conditionJson: originalConditionJson } : {}),
    };
    try {
      if (originalConditionJson) raw.conditionJson = JSON.stringify(JSON.parse(originalConditionJson), null, 2);
    } catch { /* retain the exact saved bytes below */ }
    return Object.keys(raw).length ? JSON.stringify(raw, null, 2) : "";
  })();

  return <div className="slsae-field-grid">
    <label className="slsae-field wide"><span>{copy("selectMode")}</span>
      <select data-testid="service-action-condition-mode" value={draft.conditionMode} onChange={event => update("conditionMode", event.target.value as StatusListActionDraft["conditionMode"])}>
        {modes.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
      </select>
    </label>
    <p className="slsae-callout wide">{copy("conditionsHelp")}</p>
    {draft.conditionMode === "country" && <label className="slsae-field wide"><span>{copy("countryValue")}</span>
      <select data-testid="service-action-condition-country" value={draft.conditionCountry} onChange={event => update("conditionCountry", event.target.value)}>
        {addUnknown(countries, draft.conditionCountry).map(country => <option key={country.value} value={country.value}>{country.label}</option>)}
      </select>
    </label>}
    {draft.conditionMode === "answer" && <label className="slsae-field wide"><span>{copy("answerValue")}</span>
      <input data-testid="service-action-condition-answer" value={draft.conditionAnswer} onChange={event => update("conditionAnswer", event.target.value)} placeholder="yes" />
    </label>}
    {draft.conditionMode === "field_changed_to" && <>
      <label className="slsae-field"><span>{copy("field")}</span>
        <select data-testid="service-action-field-changed-key" value={draft.fieldChangedKey} onChange={event => {
          const field = event.target.value;
          setDraft(previous => ({ ...previous, fieldChangedKey: field, fieldChangedValue: "" }));
        }}>
          {fieldOptions.map(option => option.value.startsWith("__category:")
            ? <option key={option.value} value={option.value} disabled>{option.label}</option>
            : <option key={option.value} value={option.value}>{option.label}</option>)}
          {!conditionFields.some(field => field.key === draft.fieldChangedKey) && <option value={draft.fieldChangedKey}>{draft.fieldChangedKey}</option>}
        </select>
      </label>
      <label className="slsae-field"><span>{copy("expectedValue")}</span>
        {changedAsSelect
          ? <select data-testid="service-action-field-changed-value" value={draft.fieldChangedValue} onChange={event => update("fieldChangedValue", event.target.value)}>
            <option value="">{copy("expectedValue")}</option>
            {addUnknown(changedSelectOptions, draft.fieldChangedValue).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          : <input data-testid="service-action-field-changed-value" type={selectedChangedField?.valueType === "number" ? "number" : "text"} value={draft.fieldChangedValue} onChange={event => update("fieldChangedValue", event.target.value)} placeholder={selectedChangedField?.valueType === "disp_count" ? "code:count" : undefined} />}
      </label>
      {selectedChangedField && <p className="slsae-callout wide">{catalogDescription(locale, selectedChangedField.key, localized(locale, selectedChangedField.descSk, selectedChangedField.descEn))} {copy("fieldChangedHelp")}</p>}
    </>}
    {draft.conditionMode === "compound" && <>
      <label className="slsae-field wide"><span>{copy("logic")}</span>
        <select data-testid="service-action-condition-logic" value={draft.conditionLogic} onChange={event => update("conditionLogic", event.target.value)}>
          <option value="AND">{copy("and")}</option><option value="OR">{copy("or")}</option>
        </select>
      </label>
      <div className="slsae-rule-set wide" data-testid="service-action-condition-rules">
        {draft.conditionRules.map((rule, index) => {
          const field = conditionFields.find(item => item.key === rule.field);
          const operators = field?.ops.map(op => ({ value: op.value, label: catalogOperatorLabel(locale, op.value, localized(locale, op.labelSk, op.labelEn)) })) ?? [];
          const operatorOptions = addUnknown(operators, rule.op);
          return <div className="slsae-rule" key={`${index}-${rule.field}`}>
            <div className="slsae-field"><span>{copy("field")}</span><select aria-label={copy("field")} data-testid={`service-action-condition-field-${index}`} value={rule.field} onChange={event => {
              const nextField = event.target.value;
              const nextMeta = conditionFields.find(item => item.key === nextField);
              const nextRule = { ...rule, field: nextField, op: nextMeta?.ops[0]?.value ?? rule.op, value: "" };
              update("conditionRules", draft.conditionRules.map((item, itemIndex) => itemIndex === index ? nextRule : item));
            }}>
              {categories.map(category => <optgroup key={category} label={catalogCategoryLabel(locale, category)}>{conditionFields.filter(item => item.category === category).map(item => <option key={item.key} value={item.key}>{fieldName(item, locale)}</option>)}</optgroup>)}
              {!conditionFields.some(item => item.key === rule.field) && <option value={rule.field}>{rule.field}</option>}
            </select></div>
            <div className="slsae-field"><span>{copy("operator")}</span><select aria-label={copy("operator")} data-testid={`service-action-condition-operator-${index}`} value={rule.op} onChange={event => update("conditionRules", draft.conditionRules.map((item, itemIndex) => itemIndex === index ? { ...item, op: event.target.value } : item))}>
              {operatorOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select></div>
            <div className="slsae-field slsae-value"><span>{copy("value")}</span>
              {ruleValueControl(field, rule.value, `service-action-condition-value-${index}`, value => update("conditionRules", draft.conditionRules.map((item, itemIndex) => itemIndex === index ? { ...item, value } : item)), locale, copy)}
            </div>
            <button type="button" className="slsae-remove" onClick={() => update("conditionRules", draft.conditionRules.filter((_, itemIndex) => itemIndex !== index))}>{copy("remove")}</button>
            {field && <small className="slsae-help" style={{ gridColumn: "1 / -1" }}>{catalogDescription(locale, field.key, localized(locale, field.descSk, field.descEn))}</small>}
          </div>;
        })}
        <div className="slsae-actions">
          <button type="button" className="slsae-button" onClick={() => update("conditionRules", [...draft.conditionRules, { field: conditionFields[0]?.key || "", op: conditionFields[0]?.ops[0]?.value || "eq", value: "" } as ActionRule])}>{copy("addRule")}</button>
        </div>
      </div>
      <p className="slsae-callout wide">{copy("ruleHelp")}</p>
    </>}
    {draft.conditionMode === "stored" && <>
      <p className="slsae-callout wide">{copy("savedUnknown")}</p>
      <label className="slsae-field wide"><span>{copy("stored")}</span><textarea readOnly value={decodedCondition} data-testid="service-action-stored-condition" /></label>
    </>}
    <p className="slsae-callout wide">{copy("noElse")}</p>
  </div>;
}
