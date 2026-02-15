import { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { COUNTRIES } from "@shared/schema";

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

const FIELD_OPTIONS = [
  { value: "country", label: "Krajina", type: "select", options: COUNTRIES.map(c => ({ value: c.code, label: c.name })) },
  { value: "clientStatus", label: "Status klienta", type: "select", options: [
    { value: "potential", label: "Potenciálny" },
    { value: "acquired", label: "Získaný" },
    { value: "terminated", label: "Ukončený" },
  ]},
  { value: "status", label: "Status záznamu", type: "select", options: [
    { value: "active", label: "Aktívny" },
    { value: "pending", label: "Čakajúci" },
    { value: "inactive", label: "Neaktívny" },
  ]},
  { value: "serviceType", label: "Typ služby", type: "select", options: [
    { value: "cord_blood", label: "Pupočníková krv" },
    { value: "cord_tissue", label: "Pupočníkové tkanivo" },
    { value: "both", label: "Oboje" },
  ]},
  { value: "leadStatus", label: "Status leadu", type: "select", options: [
    { value: "cold", label: "Studený" },
    { value: "warm", label: "Teplý" },
    { value: "hot", label: "Horúci" },
    { value: "qualified", label: "Kvalifikovaný" },
  ]},
  { value: "newsletter", label: "Odoberá newsletter", type: "boolean", options: [
    { value: "true", label: "Áno" },
    { value: "false", label: "Nie" },
  ]},
  { value: "city", label: "Mesto", type: "text" },
  { value: "postalCode", label: "PSČ", type: "text" },
  { value: "trimester", label: "Trimester tehotenstva", type: "select", options: [
    { value: "1", label: "1. trimester" },
    { value: "2", label: "2. trimester" },
    { value: "3", label: "3. trimester" },
  ]},
  { value: "expectedDelivery", label: "Očakávaný termín pôrodu", type: "text" },
  { value: "source", label: "Zdroj kontaktu", type: "select", options: [
    { value: "web", label: "Web" },
    { value: "phone", label: "Telefón" },
    { value: "referral", label: "Odporúčanie" },
    { value: "hospital", label: "Nemocnica" },
    { value: "event", label: "Event" },
    { value: "other", label: "Iné" },
  ]},
  { value: "ageRange", label: "Veková kategória", type: "select", options: [
    { value: "18-25", label: "18-25" },
    { value: "26-30", label: "26-30" },
    { value: "31-35", label: "31-35" },
    { value: "36-40", label: "36-40" },
    { value: "40+", label: "40+" },
  ]},
  { value: "hasContract", label: "Má zmluvu", type: "boolean", options: [
    { value: "true", label: "Áno" },
    { value: "false", label: "Nie" },
  ]},
  { value: "productType", label: "Produkt", type: "select", options: [
    { value: "standard", label: "Standard" },
    { value: "premium", label: "Premium" },
    { value: "vip", label: "VIP" },
  ]},
  { value: "lastContactDays", label: "Posledný kontakt (dní)", type: "text" },
  { value: "assignedManager", label: "Pridelený obchodník", type: "text" },
];

const OPERATORS = {
  select: [
    { value: "equals", label: "je" },
    { value: "notEquals", label: "nie je" },
    { value: "in", label: "je jedným z" },
    { value: "notIn", label: "nie je žiadnym z" },
  ],
  text: [
    { value: "equals", label: "je" },
    { value: "notEquals", label: "nie je" },
    { value: "contains", label: "obsahuje" },
    { value: "startsWith", label: "začína na" },
    { value: "endsWith", label: "končí na" },
  ],
  boolean: [
    { value: "equals", label: "je" },
  ],
};

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
  const fieldConfig = FIELD_OPTIONS.find(f => f.value === condition.field);
  const fieldType = fieldConfig?.type || "text";
  const operators = OPERATORS[fieldType as keyof typeof OPERATORS] || OPERATORS.text;

  const handleFieldChange = (field: string) => {
    const newFieldConfig = FIELD_OPTIONS.find(f => f.value === field);
    const newType = newFieldConfig?.type || "text";
    const newOperators = OPERATORS[newType as keyof typeof OPERATORS] || OPERATORS.text;
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
          <SelectValue placeholder="Vybrať pole" />
        </SelectTrigger>
        <SelectContent>
          {FIELD_OPTIONS.map(field => (
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
          <SelectValue placeholder="Operátor" />
        </SelectTrigger>
        <SelectContent>
          {operators.map(op => (
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
            <SelectValue placeholder="Vybrať hodnotu" />
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
          placeholder="Zadajte hodnotu"
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
            <Badge variant="outline">Skupina {groupIndex + 1}</Badge>
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
              {group.logic === "AND" ? "Splniť všetky podmienky" : "Splniť aspoň jednu podmienku"}
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
            Žiadne podmienky. Pridajte podmienku na filtrovanie zákazníkov.
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
            Pridať podmienku
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function CriteriaBuilder({ criteria, onChange, readonly }: CriteriaBuilderProps) {
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
          <Label className="text-base font-medium">Cieľové kritériá</Label>
          <p className="text-sm text-muted-foreground">
            Definujte ktorí zákazníci majú byť zahrnutí do tejto kampane
          </p>
        </div>
        <Badge variant="secondary">
          {totalConditions} podmienok v {criteria.length} skupinách
        </Badge>
      </div>

      {criteria.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="text-muted-foreground mb-4">
              Žiadne kritériá. Všetci zákazníci budú zahrnutí do tejto kampane.
            </p>
            {!readonly && (
              <Button onClick={addGroup} data-testid="button-add-first-group">
                <Plus className="w-4 h-4 mr-2" />
                Pridať skupinu kritérií
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
              Pridať ďalšiu skupinu
            </Button>
          )}
        </>
      )}
    </div>
  );
}

const OPERATOR_LABELS: Record<string, string> = {
  equals: "je",
  notEquals: "nie je",
  in: "je jedným z",
  notIn: "nie je žiadnym z",
  contains: "obsahuje",
  startsWith: "začína na",
  endsWith: "končí na",
};

export function criteriaToDescription(criteria: CriteriaGroup[]): string {
  if (criteria.length === 0) return "Všetci zákazníci";
  
  const groupDescriptions = criteria.map(group => {
    const conditionDescriptions = group.conditions.map(cond => {
      const fieldConfig = FIELD_OPTIONS.find(f => f.value === cond.field);
      const fieldLabel = fieldConfig?.label || cond.field;
      const operatorLabel = OPERATOR_LABELS[cond.operator] || cond.operator;
      const valueLabel = fieldConfig?.options?.find(o => o.value === cond.value)?.label || cond.value;
      return `${fieldLabel} ${operatorLabel} "${valueLabel}"`;
    });
    return conditionDescriptions.join(group.logic === "AND" ? " a zároveň " : " alebo ");
  });
  
  return groupDescriptions.join(" a zároveň ");
}

export function getDefaultCriteria(): CriteriaGroup[] {
  return [];
}
