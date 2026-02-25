import { useState } from "react";
import { Plus, Trash2, GripVertical, Users, Building2, Building, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

export interface ContactSourceConfig {
  enabled: boolean;
  criteria: CriteriaGroup[];
}

export interface ContactGenerateConfig {
  customer: ContactSourceConfig;
  hospital: ContactSourceConfig;
  clinic: ContactSourceConfig;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

const COUNTRY_OPTIONS = COUNTRIES.map(c => ({ value: c.code, label: c.name }));

const CUSTOMER_FIELDS = [
  { value: "firstName", label: "Meno", type: "text" },
  { value: "lastName", label: "Priezvisko", type: "text" },
  { value: "email", label: "Email", type: "text" },
  { value: "phone", label: "Telefón", type: "text" },
  { value: "mobile", label: "Mobil", type: "text" },
  { value: "country", label: "Krajina", type: "select", options: COUNTRY_OPTIONS },
  { value: "city", label: "Mesto", type: "text" },
  { value: "region", label: "Región", type: "text" },
  { value: "postalCode", label: "PSČ", type: "text" },
  { value: "address", label: "Adresa", type: "text" },
  { value: "clientStatus", label: "Stav klienta", type: "select", options: [
    { value: "potential", label: "Potenciálny" },
    { value: "acquired", label: "Získaný" },
    { value: "terminated", label: "Ukončený" },
  ]},
  { value: "leadStatus", label: "Lead status", type: "select", options: [
    { value: "cold", label: "Studený" },
    { value: "warm", label: "Teplý" },
    { value: "hot", label: "Horúci" },
    { value: "qualified", label: "Kvalifikovaný" },
  ]},
  { value: "newsletter", label: "Newsletter", type: "select", options: [
    { value: "true", label: "Prihlásený" },
    { value: "false", label: "Neprihlásený" },
  ]},
  { value: "titleBefore", label: "Titul pred menom", type: "text" },
  { value: "nationalId", label: "Rodné číslo", type: "text" },
  { value: "bankAccount", label: "IBAN", type: "text" },
];

const HOSPITAL_FIELDS = [
  { value: "name", label: "Názov", type: "text" },
  { value: "fullName", label: "Celý názov", type: "text" },
  { value: "contactPerson", label: "Kontaktná osoba", type: "text" },
  { value: "email", label: "Email", type: "text" },
  { value: "phone", label: "Telefón", type: "text" },
  { value: "countryCode", label: "Krajina", type: "select", options: COUNTRY_OPTIONS },
  { value: "city", label: "Mesto", type: "text" },
  { value: "region", label: "Región", type: "text" },
  { value: "postalCode", label: "PSČ", type: "text" },
  { value: "streetNumber", label: "Ulica a číslo", type: "text" },
  { value: "isActive", label: "Aktívna", type: "select", options: [
    { value: "true", label: "Áno" },
    { value: "false", label: "Nie" },
  ]},
  { value: "autoRecruiting", label: "Auto-recruiting", type: "select", options: [
    { value: "true", label: "Áno" },
    { value: "false", label: "Nie" },
  ]},
];

const CLINIC_FIELDS = [
  { value: "name", label: "Názov", type: "text" },
  { value: "doctorName", label: "Meno lekára", type: "text" },
  { value: "email", label: "Email", type: "text" },
  { value: "phone", label: "Telefón", type: "text" },
  { value: "website", label: "Web stránka", type: "text" },
  { value: "countryCode", label: "Krajina", type: "select", options: COUNTRY_OPTIONS },
  { value: "city", label: "Mesto", type: "text" },
  { value: "postalCode", label: "PSČ", type: "text" },
  { value: "address", label: "Adresa", type: "text" },
  { value: "isActive", label: "Aktívna", type: "select", options: [
    { value: "true", label: "Áno" },
    { value: "false", label: "Nie" },
  ]},
  { value: "notes", label: "Poznámky", type: "text" },
];

const OPERATORS = {
  text: [
    { value: "equals", label: "je" },
    { value: "notEquals", label: "nie je" },
    { value: "contains", label: "obsahuje" },
    { value: "notContains", label: "neobsahuje" },
    { value: "startsWith", label: "začína na" },
    { value: "endsWith", label: "končí na" },
    { value: "isEmpty", label: "je prázdne" },
    { value: "isNotEmpty", label: "nie je prázdne" },
  ],
  select: [
    { value: "equals", label: "je" },
    { value: "notEquals", label: "nie je" },
    { value: "in", label: "je jedno z" },
    { value: "notIn", label: "nie je jedno z" },
  ],
};

const NO_VALUE_OPERATORS = ["isEmpty", "isNotEmpty"];

function ConditionRow({
  condition,
  fields,
  onUpdate,
  onRemove,
}: {
  condition: CriteriaCondition;
  fields: typeof CUSTOMER_FIELDS;
  onUpdate: (updated: CriteriaCondition) => void;
  onRemove: () => void;
}) {
  const fieldConfig = fields.find(f => f.value === condition.field);
  const fieldType = fieldConfig?.type || "text";
  const ops = OPERATORS[fieldType as keyof typeof OPERATORS] || OPERATORS.text;
  const needsValue = !NO_VALUE_OPERATORS.includes(condition.operator);

  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 flex-wrap">
      <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <Select value={condition.field} onValueChange={field => {
        const newConfig = fields.find(f => f.value === field);
        const newType = newConfig?.type || "text";
        const newOps = OPERATORS[newType as keyof typeof OPERATORS] || OPERATORS.text;
        onUpdate({ ...condition, field, operator: newOps[0].value, value: "" });
      }}>
        <SelectTrigger className="w-[160px]" data-testid={`field-${condition.id}`}>
          <SelectValue placeholder="Pole..." />
        </SelectTrigger>
        <SelectContent>
          {fields.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={condition.operator} onValueChange={op => onUpdate({ ...condition, operator: op })}>
        <SelectTrigger className="w-[140px]" data-testid={`op-${condition.id}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ops.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>

      {needsValue && (
        fieldConfig?.options ? (
          <Select value={Array.isArray(condition.value) ? condition.value[0] : condition.value} onValueChange={v => onUpdate({ ...condition, value: v })}>
            <SelectTrigger className="w-[160px]" data-testid={`val-${condition.id}`}>
              <SelectValue placeholder="Hodnota..." />
            </SelectTrigger>
            <SelectContent>
              {fieldConfig.options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={Array.isArray(condition.value) ? condition.value.join(", ") : condition.value}
            onChange={e => onUpdate({ ...condition, value: e.target.value })}
            placeholder="Hodnota..."
            className="w-[160px]"
            data-testid={`val-${condition.id}`}
          />
        )
      )}

      <Button variant="ghost" size="icon" onClick={onRemove} className="flex-shrink-0" data-testid={`rm-${condition.id}`}>
        <Trash2 className="w-4 h-4 text-destructive" />
      </Button>
    </div>
  );
}

function CriteriaGroupEditor({
  group,
  index,
  fields,
  onUpdate,
  onRemove,
}: {
  group: CriteriaGroup;
  index: number;
  fields: typeof CUSTOMER_FIELDS;
  onUpdate: (g: CriteriaGroup) => void;
  onRemove: () => void;
}) {
  const addCondition = () => {
    onUpdate({
      ...group,
      conditions: [...group.conditions, { id: generateId(), field: fields[0].value, operator: "contains", value: "" }],
    });
  };

  return (
    <Card className="border-l-4 border-l-primary/30">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">Skupina {index + 1}</Badge>
            <Select value={group.logic} onValueChange={(v: "AND" | "OR") => onUpdate({ ...group, logic: v })}>
              <SelectTrigger className="w-20 h-7 text-xs" data-testid={`logic-${group.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">AND</SelectItem>
                <SelectItem value="OR">OR</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {group.logic === "AND" ? "všetky podmienky musia platiť" : "stačí jedna podmienka"}
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove} data-testid={`rm-group-${group.id}`}>
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-3">
        {group.conditions.map((cond, ci) => (
          <div key={cond.id}>
            {ci > 0 && (
              <div className="flex justify-center py-0.5">
                <Badge variant="secondary" className="text-[10px] px-2 py-0">{group.logic}</Badge>
              </div>
            )}
            <ConditionRow
              condition={cond}
              fields={fields}
              onUpdate={updated => {
                const newConds = [...group.conditions];
                newConds[ci] = updated;
                onUpdate({ ...group, conditions: newConds });
              }}
              onRemove={() => onUpdate({ ...group, conditions: group.conditions.filter((_, i) => i !== ci) })}
            />
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addCondition} className="mt-1 h-7 text-xs" data-testid={`add-cond-${group.id}`}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Pridať podmienku
        </Button>
      </CardContent>
    </Card>
  );
}

function EntityCriteriaSection({
  entityType,
  label,
  icon: Icon,
  fields,
  config,
  onChange,
}: {
  entityType: string;
  label: string;
  icon: typeof Users;
  fields: typeof CUSTOMER_FIELDS;
  config: ContactSourceConfig;
  onChange: (config: ContactSourceConfig) => void;
}) {
  const addGroup = () => {
    onChange({
      ...config,
      criteria: [...config.criteria, { id: generateId(), logic: "AND", conditions: [] }],
    });
  };

  const totalConditions = config.criteria.reduce((acc, g) => acc + g.conditions.length, 0);

  return (
    <div className={`border rounded-lg transition-colors ${config.enabled ? "border-primary/40 bg-card" : "border-dashed bg-muted/30"}`}>
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={config.enabled}
            onCheckedChange={(checked: boolean) => onChange({ ...config, enabled: checked })}
            data-testid={`check-source-${entityType}`}
          />
          <Icon className={`w-4 h-4 ${config.enabled ? "text-primary" : "text-muted-foreground"}`} />
          <span className={`font-medium text-sm ${config.enabled ? "" : "text-muted-foreground"}`}>{label}</span>
        </div>
        {config.enabled && (
          <div className="flex items-center gap-2">
            {totalConditions > 0 && (
              <Badge variant="secondary" className="text-xs">
                <Filter className="w-3 h-3 mr-1" />
                {totalConditions} {totalConditions === 1 ? "filter" : "filtrov"}
              </Badge>
            )}
            {totalConditions === 0 && (
              <span className="text-xs text-muted-foreground">všetky záznamy</span>
            )}
          </div>
        )}
      </div>

      {config.enabled && (
        <div className="px-3 pb-3 space-y-2">
          {config.criteria.map((group, gi) => (
            <div key={group.id}>
              {gi > 0 && (
                <div className="flex justify-center py-1">
                  <Badge variant="outline" className="text-[10px] px-2 py-0">AND</Badge>
                </div>
              )}
              <CriteriaGroupEditor
                group={group}
                index={gi}
                fields={fields}
                onUpdate={updated => {
                  const newGroups = [...config.criteria];
                  newGroups[gi] = updated;
                  onChange({ ...config, criteria: newGroups });
                }}
                onRemove={() => onChange({ ...config, criteria: config.criteria.filter((_, i) => i !== gi) })}
              />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addGroup} className="w-full h-8 text-xs border-dashed" data-testid={`add-group-${entityType}`}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Pridať skupinu filtrov
          </Button>
        </div>
      )}
    </div>
  );
}

interface ContactCriteriaBuilderProps {
  config: ContactGenerateConfig;
  onChange: (config: ContactGenerateConfig) => void;
}

export function ContactCriteriaBuilder({ config, onChange }: ContactCriteriaBuilderProps) {
  return (
    <div className="space-y-3">
      <EntityCriteriaSection
        entityType="customer"
        label="Zákazníci"
        icon={Users}
        fields={CUSTOMER_FIELDS}
        config={config.customer}
        onChange={customer => onChange({ ...config, customer })}
      />
      <EntityCriteriaSection
        entityType="hospital"
        label="Nemocnice"
        icon={Building2}
        fields={HOSPITAL_FIELDS}
        config={config.hospital}
        onChange={hospital => onChange({ ...config, hospital })}
      />
      <EntityCriteriaSection
        entityType="clinic"
        label="Kliniky / Ambulancie"
        icon={Building}
        fields={CLINIC_FIELDS}
        config={config.clinic}
        onChange={clinic => onChange({ ...config, clinic })}
      />
    </div>
  );
}

export function getDefaultContactGenerateConfig(): ContactGenerateConfig {
  return {
    customer: { enabled: true, criteria: [] },
    hospital: { enabled: false, criteria: [] },
    clinic: { enabled: false, criteria: [] },
  };
}
