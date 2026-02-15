import { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { COUNTRIES } from "@shared/schema";
import { useI18n } from "@/i18n";
import type { Translations } from "@/i18n";

export interface CriteriaCondition {
  id: string;
  field: string;
  operator: string;
  value: string | string[];
}

export interface CriteriaGroup {
  id: string;
  logic: "AND" | "OR";
  conditions: CriteriaCondition[];
}

interface CriteriaBuilderProps {
  criteria: CriteriaGroup[];
  onChange: (criteria: CriteriaGroup[]) => void;
  readonly?: boolean;
}

const getFieldOptions = (t: Translations) => [
  { value: "country", label: t.campaigns.criteriaBuilder.fields.country, type: "select", options: COUNTRIES.map(c => ({ value: c.code, label: c.name })) },
  { value: "clientStatus", label: t.campaigns.criteriaBuilder.fields.clientStatus, type: "select", options: [
    { value: "potential", label: t.campaigns.filter.clientStatuses.potential },
    { value: "acquired", label: t.campaigns.filter.clientStatuses.acquired },
    { value: "terminated", label: t.campaigns.filter.clientStatuses.terminated },
  ]},
  { value: "status", label: t.campaigns.criteriaBuilder.fields.status, type: "select", options: [
    { value: "active", label: t.campaigns.statuses.active },
    { value: "pending", label: t.campaigns.statuses.paused },
    { value: "inactive", label: t.campaigns.statuses.cancelled },
  ]},
  { value: "serviceType", label: t.campaigns.criteriaBuilder.fields.serviceType, type: "select", options: [
    { value: "cord_blood", label: t.campaigns.filter.serviceTypes.cord_blood },
    { value: "cord_tissue", label: t.campaigns.filter.serviceTypes.cord_tissue },
    { value: "both", label: t.campaigns.filter.serviceTypes.both },
  ]},
  { value: "leadStatus", label: t.campaigns.criteriaBuilder.fields.leadStatus, type: "select", options: [
    { value: "cold", label: t.campaigns.filter.leadStatuses.cold },
    { value: "warm", label: t.campaigns.filter.leadStatuses.warm },
    { value: "hot", label: t.campaigns.filter.leadStatuses.hot },
    { value: "qualified", label: t.campaigns.filter.leadStatuses.qualified },
  ]},
  { value: "newsletter", label: t.campaigns.criteriaBuilder.fields.newsletter, type: "boolean", options: [
    { value: "true", label: t.campaigns.criteriaBuilder.yes },
    { value: "false", label: t.campaigns.criteriaBuilder.no },
  ]},
  { value: "city", label: t.campaigns.criteriaBuilder.fields.city, type: "text" },
  { value: "postalCode", label: t.campaigns.criteriaBuilder.fields.postalCode, type: "text" },
  { value: "trimester", label: t.campaigns.criteriaBuilder.fields.trimester, type: "select", options: [
    { value: "1", label: "1. trimester" },
    { value: "2", label: "2. trimester" },
    { value: "3", label: "3. trimester" },
  ]},
  { value: "expectedDelivery", label: t.campaigns.criteriaBuilder.fields.expectedDelivery, type: "text" },
  { value: "source", label: t.campaigns.criteriaBuilder.fields.source, type: "select", options: [
    { value: "web", label: "Web" },
    { value: "phone", label: t.campaigns.channels.phone },
    { value: "referral", label: t.campaigns.filter.infoSources.friends },
    { value: "hospital", label: t.campaigns.filter.infoSources.hospital },
    { value: "event", label: t.campaigns.filter.infoSources.event },
    { value: "other", label: t.campaigns.filter.infoSources.other },
  ]},
  { value: "ageRange", label: t.campaigns.criteriaBuilder.fields.ageRange, type: "select", options: [
    { value: "18-25", label: "18-25" },
    { value: "26-30", label: "26-30" },
    { value: "31-35", label: "31-35" },
    { value: "36-40", label: "36-40" },
    { value: "40+", label: "40+" },
  ]},
  { value: "hasContract", label: t.campaigns.criteriaBuilder.fields.hasContract, type: "boolean", options: [
    { value: "true", label: t.campaigns.criteriaBuilder.yes },
    { value: "false", label: t.campaigns.criteriaBuilder.no },
  ]},
  { value: "productType", label: t.campaigns.criteriaBuilder.fields.productType, type: "select", options: [
    { value: "standard", label: "Standard" },
    { value: "premium", label: "Premium" },
    { value: "vip", label: "VIP" },
  ]},
  { value: "lastContactDays", label: t.campaigns.criteriaBuilder.fields.lastContactDays, type: "text" },
  { value: "assignedManager", label: t.campaigns.criteriaBuilder.fields.assignedManager, type: "text" },
];

const getOperators = (t: Translations) => ({
  select: [
    { value: "equals", label: t.campaigns.criteriaBuilder.operators.equals },
    { value: "notEquals", label: t.campaigns.criteriaBuilder.operators.notEquals },
    { value: "in", label: t.campaigns.criteriaBuilder.operators.in },
    { value: "notIn", label: t.campaigns.criteriaBuilder.operators.notIn },
  ],
  text: [
    { value: "equals", label: t.campaigns.criteriaBuilder.operators.equals },
    { value: "notEquals", label: t.campaigns.criteriaBuilder.operators.notEquals },
    { value: "contains", label: t.campaigns.criteriaBuilder.operators.contains },
    { value: "startsWith", label: t.campaigns.criteriaBuilder.operators.startsWith },
    { value: "endsWith", label: t.campaigns.criteriaBuilder.operators.endsWith },
  ],
  boolean: [
    { value: "equals", label: t.campaigns.criteriaBuilder.operators.equals },
  ],
});

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function ConditionRow({
  condition,
  onUpdate,
  onRemove,
  readonly,
}: {
  condition: CriteriaCondition;
  onUpdate: (updated: CriteriaCondition) => void;
  onRemove: () => void;
  readonly?: boolean;
}) {
  const { t } = useI18n();
  const fieldOptions = getFieldOptions(t);
  const operators = getOperators(t);
  const fieldConfig = fieldOptions.find(f => f.value === condition.field);
  const fieldType = fieldConfig?.type || "text";
  const fieldOperators = operators[fieldType as keyof typeof operators] || operators.text;

  const handleFieldChange = (field: string) => {
    const newFieldConfig = fieldOptions.find(f => f.value === field);
    const newType = newFieldConfig?.type || "text";
    const newOperators = operators[newType as keyof typeof operators] || operators.text;
    onUpdate({
      ...condition,
      field,
      operator: newOperators[0].value,
      value: "",
    });
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
      {!readonly && (
        <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
      )}
      
      <Select
        value={condition.field}
        onValueChange={handleFieldChange}
        disabled={readonly}
      >
        <SelectTrigger className="w-40" data-testid={`select-condition-field-${condition.id}`}>
          <SelectValue placeholder={t.campaigns.criteriaBuilder.selectField} />
        </SelectTrigger>
        <SelectContent>
          {fieldOptions.map(field => (
            <SelectItem key={field.value} value={field.value}>
              {field.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={condition.operator}
        onValueChange={(operator) => onUpdate({ ...condition, operator })}
        disabled={readonly}
      >
        <SelectTrigger className="w-36" data-testid={`select-condition-operator-${condition.id}`}>
          <SelectValue placeholder={t.campaigns.criteriaBuilder.operators.equals} />
        </SelectTrigger>
        <SelectContent>
          {fieldOperators.map(op => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {fieldConfig?.options ? (
        <Select
          value={Array.isArray(condition.value) ? condition.value[0] : condition.value}
          onValueChange={(value) => onUpdate({ ...condition, value })}
          disabled={readonly}
        >
          <SelectTrigger className="w-40" data-testid={`select-condition-value-${condition.id}`}>
            <SelectValue placeholder={t.campaigns.criteriaBuilder.selectValue} />
          </SelectTrigger>
          <SelectContent>
            {fieldConfig.options.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          value={Array.isArray(condition.value) ? condition.value.join(", ") : condition.value}
          onChange={(e) => onUpdate({ ...condition, value: e.target.value })}
          placeholder={t.campaigns.criteriaBuilder.enterValue}
          className="w-40"
          disabled={readonly}
          data-testid={`input-condition-value-${condition.id}`}
        />
      )}

      {!readonly && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          data-testid={`button-remove-condition-${condition.id}`}
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      )}
    </div>
  );
}

function CriteriaGroupCard({
  group,
  groupIndex,
  onUpdate,
  onRemove,
  readonly,
}: {
  group: CriteriaGroup;
  groupIndex: number;
  onUpdate: (updated: CriteriaGroup) => void;
  onRemove: () => void;
  readonly?: boolean;
}) {
  const { t } = useI18n();

  const addCondition = () => {
    const newCondition: CriteriaCondition = {
      id: generateId(),
      field: "country",
      operator: "equals",
      value: "",
    };
    onUpdate({
      ...group,
      conditions: [...group.conditions, newCondition],
    });
  };

  const updateCondition = (index: number, updated: CriteriaCondition) => {
    const newConditions = [...group.conditions];
    newConditions[index] = updated;
    onUpdate({ ...group, conditions: newConditions });
  };

  const removeCondition = (index: number) => {
    const newConditions = group.conditions.filter((_, i) => i !== index);
    onUpdate({ ...group, conditions: newConditions });
  };

  return (
    <Card className="relative">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{t.campaigns.criteriaBuilder.group} {groupIndex + 1}</Badge>
            <Select
              value={group.logic}
              onValueChange={(logic: "AND" | "OR") => onUpdate({ ...group, logic })}
              disabled={readonly}
            >
              <SelectTrigger className="w-20" data-testid={`select-group-logic-${group.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">AND</SelectItem>
                <SelectItem value="OR">OR</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {group.logic === "AND" ? t.campaigns.detail.matchAll : t.campaigns.detail.matchAny}
            </span>
          </div>
          {!readonly && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              data-testid={`button-remove-group-${group.id}`}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {group.conditions.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            {t.campaigns.criteriaBuilder.noConditions}
          </p>
        ) : (
          group.conditions.map((condition, index) => (
            <div key={condition.id}>
              {index > 0 && (
                <div className="flex justify-center py-1">
                  <Badge variant="secondary" className="text-xs">
                    {group.logic}
                  </Badge>
                </div>
              )}
              <ConditionRow
                condition={condition}
                onUpdate={(updated) => updateCondition(index, updated)}
                onRemove={() => removeCondition(index)}
                readonly={readonly}
              />
            </div>
          ))
        )}
        
        {!readonly && (
          <Button
            variant="outline"
            size="sm"
            onClick={addCondition}
            className="mt-2"
            data-testid={`button-add-condition-${group.id}`}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t.campaigns.criteriaBuilder.addCondition}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function CriteriaBuilder({ criteria, onChange, readonly }: CriteriaBuilderProps) {
  const { t } = useI18n();

  const addGroup = () => {
    const newGroup: CriteriaGroup = {
      id: generateId(),
      logic: "AND",
      conditions: [],
    };
    onChange([...criteria, newGroup]);
  };

  const updateGroup = (index: number, updated: CriteriaGroup) => {
    const newGroups = [...criteria];
    newGroups[index] = updated;
    onChange(newGroups);
  };

  const removeGroup = (index: number) => {
    onChange(criteria.filter((_, i) => i !== index));
  };

  const totalConditions = criteria.reduce((acc, group) => acc + group.conditions.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <Label className="text-base font-medium">{t.campaigns.criteriaBuilder.title}</Label>
          <p className="text-sm text-muted-foreground">
            {t.campaigns.criteriaBuilder.description}
          </p>
        </div>
        <Badge variant="secondary">
          {totalConditions} {t.campaigns.criteriaBuilder.conditionsInGroups} {criteria.length} {t.campaigns.criteriaBuilder.group.toLowerCase()}
        </Badge>
      </div>

      {criteria.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="text-muted-foreground mb-4">
              {t.campaigns.criteriaBuilder.noCriteria} {t.campaigns.criteriaBuilder.noCriteriaDesc}
            </p>
            {!readonly && (
              <Button onClick={addGroup} data-testid="button-add-first-group">
                <Plus className="w-4 h-4 mr-2" />
                {t.campaigns.criteriaBuilder.addFirstGroup}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {criteria.map((group, index) => (
            <div key={group.id}>
              {index > 0 && (
                <div className="flex justify-center py-2">
                  <Badge variant="outline" className="text-xs">
                    AND
                  </Badge>
                </div>
              )}
              <CriteriaGroupCard
                group={group}
                groupIndex={index}
                onUpdate={(updated) => updateGroup(index, updated)}
                onRemove={() => removeGroup(index)}
                readonly={readonly}
              />
            </div>
          ))}
          
          {!readonly && (
            <Button
              variant="outline"
              onClick={addGroup}
              className="w-full"
              data-testid="button-add-group"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t.campaigns.criteriaBuilder.addGroup}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

const getOperatorLabels = (t: Translations): Record<string, string> => ({
  equals: t.campaigns.criteriaBuilder.operators.equals,
  notEquals: t.campaigns.criteriaBuilder.operators.notEquals,
  in: t.campaigns.criteriaBuilder.operators.in,
  notIn: t.campaigns.criteriaBuilder.operators.notIn,
  contains: t.campaigns.criteriaBuilder.operators.contains,
  startsWith: t.campaigns.criteriaBuilder.operators.startsWith,
  endsWith: t.campaigns.criteriaBuilder.operators.endsWith,
});

export function criteriaToDescription(criteria: CriteriaGroup[], t: Translations): string {
  if (criteria.length === 0) return t.campaigns.criteriaBuilder.allCustomers;
  
  const fieldOptions = getFieldOptions(t);
  const operatorLabels = getOperatorLabels(t);

  const groupDescriptions = criteria.map(group => {
    const conditionDescriptions = group.conditions.map(cond => {
      const fieldConfig = fieldOptions.find(f => f.value === cond.field);
      const fieldLabel = fieldConfig?.label || cond.field;
      const operatorLabel = operatorLabels[cond.operator] || cond.operator;
      const valueLabel = fieldConfig?.options?.find(o => o.value === cond.value)?.label || cond.value;
      return `${fieldLabel} ${operatorLabel} "${valueLabel}"`;
    });
    return conditionDescriptions.join(group.logic === "AND" ? ` ${t.campaigns.criteriaBuilder.andAlso} ` : ` ${t.campaigns.criteriaBuilder.or} `);
  });
  
  return groupDescriptions.join(` ${t.campaigns.criteriaBuilder.andAlso} `);
}

export function getDefaultCriteria(): CriteriaGroup[] {
  return [];
}
