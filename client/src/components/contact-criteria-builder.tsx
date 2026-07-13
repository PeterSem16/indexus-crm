import { Plus, Trash2, GripVertical, Users, Building2, Building, Filter, Loader2, Hash, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { COUNTRIES } from "@shared/schema";
import { useI18n } from "@/i18n";

const OP_LABEL_KEYS: Record<string, string> = {
  equals: "opEquals",
  notEquals: "opNotEquals",
  contains: "opContains",
  notContains: "opNotContains",
  startsWith: "opStartsWith",
  endsWith: "opEndsWith",
  isEmpty: "opIsEmpty",
  isNotEmpty: "opIsNotEmpty",
  in: "opIn",
  notIn: "opNotIn",
};

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
  collaborator: ContactSourceConfig;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

const COUNTRY_OPTIONS = COUNTRIES.map(c => ({ value: c.code, label: c.name }));

const YES_NO = [
  { value: "true", label: "Áno" },
  { value: "false", label: "Nie" },
];

const CUSTOMER_FIELDS = [
  { value: "titleBefore", label: "Titul pred menom", type: "text" },
  { value: "firstName", label: "Meno", type: "text" },
  { value: "lastName", label: "Priezvisko", type: "text" },
  { value: "maidenName", label: "Rodné meno", type: "text" },
  { value: "titleAfter", label: "Titul za menom", type: "text" },
  { value: "email", label: "Email", type: "text" },
  { value: "email2", label: "Email 2", type: "text" },
  { value: "phone", label: "Telefón", type: "text" },
  { value: "mobile", label: "Mobil", type: "text" },
  { value: "mobile2", label: "Mobil 2", type: "text" },
  { value: "otherContact", label: "Iný kontakt", type: "text" },
  { value: "nationalId", label: "Rodné číslo", type: "text" },
  { value: "idCardNumber", label: "Číslo OP", type: "text" },
  { value: "country", label: "Krajina", type: "select", options: COUNTRY_OPTIONS },
  { value: "city", label: "Mesto", type: "text" },
  { value: "region", label: "Región", type: "text" },
  { value: "district", label: "Okres", type: "text" },
  { value: "postalCode", label: "PSČ", type: "text" },
  { value: "address", label: "Adresa", type: "text" },
  { value: "useCorrespondenceAddress", label: "Korešpondenčná adresa", type: "select", options: YES_NO },
  { value: "corrCity", label: "Mesto (korešp.)", type: "text" },
  { value: "corrAddress", label: "Adresa (korešp.)", type: "text" },
  { value: "corrPostalCode", label: "PSČ (korešp.)", type: "text" },
  { value: "corrRegion", label: "Oblasť (korešp.)", type: "text" },
  { value: "corrCountry", label: "Krajina (korešp.)", type: "text" },
  { value: "bankAccount", label: "IBAN", type: "text" },
  { value: "bankCode", label: "Kód banky", type: "text" },
  { value: "bankName", label: "Názov banky", type: "text" },
  { value: "bankSwift", label: "SWIFT", type: "text" },
  { value: "gynecologistName", label: "Gynekológ – meno", type: "text" },
  { value: "gynecologistPhone", label: "Gynekológ – telefón", type: "text" },
  { value: "gynecologistEmail", label: "Gynekológ – email", type: "text" },
  { value: "hospitalName", label: "Pôrodnica", type: "text" },
  { value: "registrationSource", label: "Zdroj registrácie", type: "select", options: [
    { value: "web_form", label: "Web formulár" },
    { value: "phone", label: "Telefón" },
    { value: "email", label: "Email" },
    { value: "in_person", label: "Osobne" },
    { value: "referral", label: "Odporúčanie" },
  ]},
  { value: "clientStatus", label: "Stav klienta", type: "select", options: [
    { value: "potential", label: "Potenciálny" },
    { value: "in_process", label: "V procese" },
    { value: "acquired", label: "Získaný" },
    { value: "terminated", label: "Ukončený" },
  ]},
  { value: "leadStatus", label: "Lead status", type: "select", options: [
    { value: "cold", label: "Studený" },
    { value: "warm", label: "Teplý" },
    { value: "hot", label: "Horúci" },
    { value: "qualified", label: "Kvalifikovaný" },
  ]},
  { value: "serviceType", label: "Typ služby", type: "select", options: [
    { value: "cord_blood", label: "Pupočníková krv" },
    { value: "cord_tissue", label: "Pupočníkové tkanivo" },
    { value: "both", label: "Oboje" },
  ]},
  { value: "newsletter", label: "Newsletter", type: "select", options: [
    { value: "true", label: "Prihlásený" },
    { value: "false", label: "Neprihlásený" },
  ]},
  { value: "status", label: "Stav", type: "select", options: [
    { value: "active", label: "Aktívny" },
    { value: "pending", label: "Čakajúci" },
    { value: "inactive", label: "Neaktívny" },
  ]},
  { value: "notes", label: "Poznámky", type: "text" },
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
  { value: "district", label: "Okres", type: "text" },
  { value: "postalCode", label: "PSČ", type: "text" },
  { value: "streetNumber", label: "Ulica a číslo", type: "text" },
  { value: "isActive", label: "Aktívna", type: "select", options: YES_NO },
  { value: "autoRecruiting", label: "Auto-recruiting", type: "select", options: YES_NO },
  { value: "svetZdravia", label: "Svet zdravia", type: "select", options: YES_NO },
];

const CLINIC_FIELDS = [
  { value: "name", label: "Názov", type: "text" },
  { value: "doctorName", label: "Meno lekára", type: "text" },
  { value: "doctorTitle", label: "Titul lekára", type: "text" },
  { value: "doctorFirstName", label: "Krstné meno lekára", type: "text" },
  { value: "doctorLastName", label: "Priezvisko lekára", type: "text" },
  { value: "idZz", label: "ID ZZ", type: "text" },
  { value: "pzsCode", label: "Kód PZS", type: "text" },
  { value: "pzsName", label: "Názov PZS", type: "text" },
  { value: "ico", label: "IČO", type: "text" },
  { value: "email", label: "Email", type: "text" },
  { value: "email2", label: "Email 2", type: "text" },
  { value: "email3", label: "Email 3", type: "text" },
  { value: "phone", label: "Telefón", type: "text" },
  { value: "phone2", label: "Telefón 2", type: "text" },
  { value: "phone3", label: "Telefón 3", type: "text" },
  { value: "website", label: "Web stránka", type: "text" },
  { value: "countryCode", label: "Krajina", type: "select", options: COUNTRY_OPTIONS },
  { value: "city", label: "Mesto", type: "text" },
  { value: "region", label: "Oblasť (Kraj)", type: "text" },
  { value: "district", label: "Okres", type: "text" },
  { value: "postalCode", label: "PSČ", type: "text" },
  { value: "address", label: "Adresa", type: "text" },
  { value: "street", label: "Ulica", type: "text" },
  { value: "streetNumber", label: "Súpisné číslo", type: "text" },
  { value: "orientationNumber", label: "Orientačné číslo", type: "text" },
  { value: "isActive", label: "Aktívna", type: "select", options: YES_NO },
  { value: "leadSource", label: "Zdroj kontaktu", type: "select", options: [
    { value: "new_contact", label: "Nový kontakt" },
    { value: "former_collaborator", label: "Bývalý spolupracovník" },
    { value: "current_collaborator", label: "Súčasný spolupracovník" },
    { value: "doctor_referral", label: "Odporúčanie lekára" },
    { value: "conference", label: "Konferencia" },
  ]},
  { value: "isReferredByDoctor", label: "Odporúčaná lekárom", type: "select", options: YES_NO },
  { value: "isFromConference", label: "Z konferencie", type: "select", options: YES_NO },
  { value: "conferenceName", label: "Názov konferencie", type: "text" },
  { value: "initialStatus", label: "Počiatočný stav", type: "text" },
  { value: "interestCooperation", label: "Záujem o spoluprácu", type: "text" },
  { value: "interestContract", label: "Záujem o zmluvu", type: "text" },
  { value: "contractStatus", label: "Stav zmluvy", type: "text" },
  { value: "lastCallResult", label: "Posledný výsledok hovoru", type: "text" },
  { value: "lastCallNote", label: "Posledná poznámka z hovoru", type: "text" },
  { value: "hasFlyers", label: "Má letáky", type: "select", options: YES_NO },
  { value: "flyersLocation", label: "Umiestnenie letákov", type: "text" },
  { value: "notes", label: "Poznámky", type: "text" },
];

const COLLABORATOR_FIELDS = [
  { value: "titleBefore", label: "Titul pred menom", type: "text" },
  { value: "firstName", label: "Meno", type: "text" },
  { value: "middleName", label: "Stredné meno", type: "text" },
  { value: "lastName", label: "Priezvisko", type: "text" },
  { value: "maidenName", label: "Rodné meno", type: "text" },
  { value: "titleAfter", label: "Titul za menom", type: "text" },
  { value: "email", label: "Email", type: "text" },
  { value: "phone", label: "Telefón", type: "text" },
  { value: "mobile", label: "Mobil", type: "text" },
  { value: "mobile2", label: "Mobil 2", type: "text" },
  { value: "otherContact", label: "Iný kontakt", type: "text" },
  { value: "countryCode", label: "Krajina", type: "select", options: COUNTRY_OPTIONS },
  { value: "birthNumber", label: "Rodné číslo", type: "text" },
  { value: "birthYear", label: "Rok narodenia", type: "text" },
  { value: "birthPlace", label: "Miesto narodenia", type: "text" },
  { value: "maritalStatus", label: "Rodinný stav", type: "select", options: [
    { value: "single", label: "Slobodný/á" },
    { value: "married", label: "Ženatý/Vydatá" },
    { value: "divorced", label: "Rozvedený/á" },
    { value: "widowed", label: "Vdovec/Vdova" },
  ]},
  { value: "professionalClassification", label: "Profesijné zaradenie", type: "text" },
  { value: "highestEducation", label: "Najvyššie vzdelanie", type: "text" },
  { value: "workplaceName", label: "Pracovisko", type: "text" },
  { value: "isManager", label: "Manažér", type: "select", options: YES_NO },
  { value: "collaboratorType", label: "Typ", type: "select", options: [
    { value: "doctor", label: "Lekár" },
    { value: "nurse", label: "Sestra" },
    { value: "midwife", label: "Pôrodná asistentka" },
    { value: "other", label: "Iný" },
  ]},
  { value: "partnerCategory", label: "Kategória partnera", type: "text" },
  { value: "agreementType", label: "Typ zmluvy", type: "text" },
  { value: "leadSource", label: "Zdroj kontaktu", type: "text" },
  { value: "conferenceName", label: "Názov konferencie", type: "text" },
  { value: "isReferredByDoctor", label: "Odporúčaný lekárom", type: "select", options: YES_NO },
  { value: "isFromConference", label: "Z konferencie", type: "select", options: YES_NO },
  { value: "bankAccountIban", label: "IBAN", type: "text" },
  { value: "swiftCode", label: "SWIFT", type: "text" },
  { value: "companyName", label: "Názov spoločnosti", type: "text" },
  { value: "ico", label: "IČO", type: "text" },
  { value: "dic", label: "DIČ", type: "text" },
  { value: "icDph", label: "IČ DPH", type: "text" },
  { value: "isActive", label: "Aktívny", type: "select", options: YES_NO },
  { value: "svetZdravia", label: "Svet zdravia", type: "select", options: YES_NO },
  { value: "clientContact", label: "Kontakt s klientom", type: "select", options: YES_NO },
  { value: "monthRewards", label: "Mesačné odmeny", type: "select", options: YES_NO },
  { value: "rewardType", label: "Typ odmeny", type: "select", options: [
    { value: "fixed", label: "Fixná" },
    { value: "percentage", label: "Percentuálna" },
  ]},
  { value: "mobileAppEnabled", label: "Mobilná app aktívna", type: "select", options: YES_NO },
  { value: "canEditHospitals", label: "Môže upravovať nemocnice", type: "select", options: YES_NO },
  { value: "preferredLanguage", label: "Preferovaný jazyk", type: "select", options: [
    { value: "sk", label: "Slovenčina" },
    { value: "en", label: "Angličtina" },
    { value: "cs", label: "Čeština" },
    { value: "hu", label: "Maďarčina" },
    { value: "ro", label: "Rumunčina" },
    { value: "it", label: "Taliančina" },
  ]},
  { value: "note", label: "Poznámka", type: "text" },
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
  const { t } = useI18n();
  const td = t.campaigns.detail as any;
  const opLabel = (op: { value: string; label: string }) => td[OP_LABEL_KEYS[op.value]] || op.label;
  const optLabel = (o: { value: string; label: string }) =>
    o.label === "Áno" ? td.cbYes || o.label : o.label === "Nie" ? td.cbNo || o.label : o.label;
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
          <SelectValue placeholder={td.cbFieldPlaceholder} />
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
          {ops.map(o => <SelectItem key={o.value} value={o.value}>{opLabel(o)}</SelectItem>)}
        </SelectContent>
      </Select>

      {needsValue && (
        fieldConfig?.options ? (
          <Select value={Array.isArray(condition.value) ? condition.value[0] : condition.value} onValueChange={v => onUpdate({ ...condition, value: v })}>
            <SelectTrigger className="w-[160px]" data-testid={`val-${condition.id}`}>
              <SelectValue placeholder={td.cbValuePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {fieldConfig.options.map(o => <SelectItem key={o.value} value={o.value}>{optLabel(o)}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={Array.isArray(condition.value) ? condition.value.join(", ") : condition.value}
            onChange={e => onUpdate({ ...condition, value: e.target.value })}
            placeholder={td.cbValuePlaceholder}
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
  const { t } = useI18n();
  const td = t.campaigns.detail as any;
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
            <Badge variant="outline" className="text-xs">{td.cbGroup} {index + 1}</Badge>
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
              {group.logic === "AND" ? td.cbAllConditionsMatch : td.cbAnyConditionMatch}
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
          <Plus className="w-3.5 h-3.5 mr-1" /> {td.cbAddCondition}
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
  matchCount,
  matchLoading,
}: {
  entityType: string;
  label: string;
  icon: typeof Users;
  fields: typeof CUSTOMER_FIELDS;
  config: ContactSourceConfig;
  onChange: (config: ContactSourceConfig) => void;
  matchCount?: number;
  matchLoading?: boolean;
}) {
  const { t } = useI18n();
  const td = t.campaigns.detail as any;
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
          {config.enabled && (
            <span className="text-xs font-medium">
              {matchLoading ? (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                </span>
              ) : matchCount !== undefined ? (
                <Badge variant="default" className="text-xs px-2 py-0">
                  <Hash className="w-3 h-3 mr-0.5" />
                  {matchCount}
                </Badge>
              ) : null}
            </span>
          )}
        </div>
        {config.enabled && (
          <div className="flex items-center gap-2">
            {totalConditions > 0 && (
              <Badge variant="secondary" className="text-xs">
                <Filter className="w-3 h-3 mr-1" />
                {totalConditions} {totalConditions === 1 ? td.cbFilter : td.cbFilters}
              </Badge>
            )}
            {totalConditions === 0 && (
              <span className="text-xs text-muted-foreground">{td.cbAllRecords}</span>
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
            <Plus className="w-3.5 h-3.5 mr-1" /> {td.cbAddFilterGroup}
          </Button>
        </div>
      )}
    </div>
  );
}

export interface PreviewCounts {
  counts: Record<string, number>;
  total: number;
}

interface ContactCriteriaBuilderProps {
  config: ContactGenerateConfig;
  onChange: (config: ContactGenerateConfig) => void;
  previewCounts?: PreviewCounts | null;
  previewLoading?: boolean;
}

export function ContactCriteriaBuilder({ config, onChange, previewCounts, previewLoading }: ContactCriteriaBuilderProps) {
  const { t } = useI18n();
  const td = t.campaigns.detail as any;
  const anyEnabled = config.customer.enabled || config.hospital.enabled || config.clinic.enabled || config.collaborator.enabled;
  return (
    <div className="space-y-3">
      <EntityCriteriaSection
        entityType="customer"
        label={td.cbCustomers}
        icon={Users}
        fields={CUSTOMER_FIELDS}
        config={config.customer}
        onChange={customer => onChange({ ...config, customer })}
        matchCount={previewCounts?.counts?.customer}
        matchLoading={config.customer.enabled && previewLoading}
      />
      <EntityCriteriaSection
        entityType="hospital"
        label={td.cbHospitals}
        icon={Building2}
        fields={HOSPITAL_FIELDS}
        config={config.hospital}
        onChange={hospital => onChange({ ...config, hospital })}
        matchCount={previewCounts?.counts?.hospital}
        matchLoading={config.hospital.enabled && previewLoading}
      />
      <EntityCriteriaSection
        entityType="clinic"
        label={td.cbClinics}
        icon={Building}
        fields={CLINIC_FIELDS}
        config={config.clinic}
        onChange={clinic => onChange({ ...config, clinic })}
        matchCount={previewCounts?.counts?.clinic}
        matchLoading={config.clinic.enabled && previewLoading}
      />
      <EntityCriteriaSection
        entityType="collaborator"
        label={td.cbCollaborators}
        icon={UserCheck}
        fields={COLLABORATOR_FIELDS}
        config={config.collaborator}
        onChange={collaborator => onChange({ ...config, collaborator })}
        matchCount={previewCounts?.counts?.collaborator}
        matchLoading={config.collaborator.enabled && previewLoading}
      />
      {anyEnabled && previewCounts && !previewLoading && (
        <div className="flex items-center justify-center p-2 bg-primary/5 rounded-lg border border-primary/20">
          <span className="text-sm font-semibold text-primary">
            {(td.cbTotalContacts as string).replace("{count}", String(previewCounts.total))}
          </span>
        </div>
      )}
    </div>
  );
}

export function getDefaultContactGenerateConfig(): ContactGenerateConfig {
  return {
    customer: { enabled: true, criteria: [] },
    hospital: { enabled: false, criteria: [] },
    clinic: { enabled: false, criteria: [] },
    collaborator: { enabled: false, criteria: [] },
  };
}
