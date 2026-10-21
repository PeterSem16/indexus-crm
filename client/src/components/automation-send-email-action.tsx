import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Check, Mail, Plus, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutomationEmailContentEditor, type EmailEditorSelections } from "@/components/automation-email-content-editor";
import { AutomationTemplatePicker } from "./automation-template-picker";
import { filterActivityCatalogTemplates } from "@/components/automation-activity-template-utils";
import { statusListEmailActionCopy } from "@/i18n/translations";
import type { EmailCardRecipientSource } from "@/i18n/automation-email-card-recipient-translations";

type Target = { kind: "user" | "group" | "role"; id: string };
type RecipientField = "to" | "cc" | "bcc";
type UserOption = { id: string; fullName: string; email: string };
type GroupOption = { id: string; name: string; displayAlias?: string | null };
type RoleOption = { id: string; name: string; isActive?: boolean };
type EmailTemplate = {
  id: string;
  name: string;
  language?: string;
  subject?: string;
  content?: string;
  contentHtml?: string;
  countryCodes?: string[];
  categoryId?: string | null;
  attachments?: unknown[];
};
type TemplateCategory = { id: string; name: string };
type Mailbox = { connected: boolean; email?: string; displayName?: string; hasSignature?: boolean };

const AUTOMATION_CATEGORY_ID = "indexus-automation-email-category";
const rewriteArtworkForPreview = (html: string) => html.replace(
  /cid:indexus-automation-(state-(?:happy|neutral|concerned|angry|calm|urgent|pending|progress|completed|cancelled)|human-(?:task|call|deadline)|task|attention|success|deadline|phone(?:-(?:positive|negative|urgent|info|deadline))?)/gi,
  (_match, artwork: string) => `/api/automation/email-artwork/${artwork.toLowerCase()}`,
);
const cleanVariable = (value: string) => value.replace(/^{{\s*|\s*}}$/g, "").trim();
const emailPattern = /^[^@\s<>,;{}]+@[^@\s<>,;{}]+\.[^@\s<>,;{}]+$/;
const cardMainTokens = new Set(["contact.email", "clinic.email", "hospital.email"]);
const isLegacyCardMainAddress = (address: string) => {
  const match = address.match(/^{{\s*([^{}]+?)\s*}}$/);
  return Boolean(match && cardMainTokens.has(match[1].trim().toLowerCase()));
};

export function AutomationSendEmailAction({
  config, onChange, users, groups, roles, countryCodes, ruleId, availableVariables, recipientTemplates, testId, onDraftValidityChange, sourceModule, missionContext, defaultRecipientTemplate,
}: {
  config: any;
  onChange: (config: any) => void;
  users: UserOption[];
  groups: GroupOption[];
  roles: RoleOption[];
  countryCodes: string[];
  ruleId?: string;
  availableVariables: Array<{ value: string; label: string }>;
  recipientTemplates: string[];
  testId: string;
  onDraftValidityChange?: (invalid: boolean) => void;
  sourceModule?: string;
  missionContext?: { defaultEmailTemplateId?: string; defaultEmailCategoryId?: string };
  defaultRecipientTemplate?: string;
}) {
  const { t, locale } = useI18n();
  const copy = t.sendEmailAction;
  const [addressDraft, setAddressDraft] = useState<Record<RecipientField, string>>({ to: "", cc: "", bcc: "" });
  const ownConfig = useRef(config);
  const [activeRecipient, setActiveRecipient] = useState<RecipientField>("to");
  const [activeField, setActiveField] = useState<"subject" | "body">("body");
  const [editorOpen, setEditorOpen] = useState(false);
  const [templateLanguage, setTemplateLanguage] = useState<string>(locale);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [attachmentFailed, setAttachmentFailed] = useState(false);
  const attachmentRequest = useRef(0);
  const mounted = useRef(true);
  const statusCopy = statusListEmailActionCopy[(locale.split("-")[0] as keyof typeof statusListEmailActionCopy)] || statusListEmailActionCopy.en;
  const cardRecipientCopy = t.automationEmailCardRecipients;
  useEffect(() => setTemplateLanguage(locale), [locale]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; attachmentRequest.current += 1; };
  }, []);
  const selectionsRef = useRef<EmailEditorSelections>({
    subject: { start: String(config.subject ?? "").length, end: String(config.subject ?? "").length },
    body: { start: String(config.body ?? "").length, end: String(config.body ?? "").length },
  });
  useEffect(() => {
    if (config !== ownConfig.current) {
      ownConfig.current = config;
      setAddressDraft({ to: "", cc: "", bcc: "" });
      setActiveRecipient("to");
    }
  }, [config]);
  useEffect(() => {
    const configuredCardSources = Array.isArray(config.toCardSources) ? config.toCardSources : null;
    if (!defaultRecipientTemplate || config.to || config.toTargets?.length || config.emailActionVersion !== 2
      || configuredCardSources !== null) return;
    update({ to: `{{${cleanVariable(defaultRecipientTemplate)}}}` });
  // Apply the status-list contact default once when the empty action is first opened.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mailboxQuery = useQuery<{ personal: Mailbox; system: Array<Mailbox & { countryCode: string }> }>({
    queryKey: ["/api/automation/email-mailboxes", ruleId],
    queryFn: async () => {
      const response = await fetch(`/api/automation/email-mailboxes${ruleId ? `?ruleId=${encodeURIComponent(ruleId)}` : ""}`, { credentials: "include" });
      if (!response.ok) throw new Error("mailbox");
      return response.json();
    },
  });
  const templatesQuery = useQuery<EmailTemplate[]>({
    queryKey: ["/api/message-templates", "email", true],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const response = await fetch("/api/message-templates?type=email&isActive=true", { credentials: "include" });
      if (!response.ok) throw new Error("templates");
      return response.json();
    },
  });
  const categoriesQuery = useQuery<TemplateCategory[]>({
    queryKey: ["/api/template-categories"],
    queryFn: async () => {
      const response = await fetch("/api/template-categories", { credentials: "include" });
      if (!response.ok) throw new Error("template categories");
      return response.json();
    },
  });

  const targetsFor = (field: RecipientField): Target[] => {
    const targets = Array.isArray(config[`${field}Targets`]) ? config[`${field}Targets`] : [];
    const legacy: Target[] = [];
    if (field === "to" && !targets.length) {
      if (config.taskGroupId) legacy.push({ kind: "group", id: String(config.taskGroupId) });
      if (config.targetRole) {
        const value = String(config.targetRole).replace(/^role:/, "");
        const role = roles.find((item) => item.id === value || item.name === value);
        legacy.push({ kind: "role", id: role?.name || value });
      }
    }
    return [...targets, ...legacy].filter((target, index, all) =>
      target && ["user", "group", "role"].includes(target.kind) && target.id != null &&
      all.findIndex((other) => other.kind === target.kind && String(other.id) === String(target.id)) === index
    ).map((target) => ({ kind: target.kind, id: String(target.id) }));
  };
  const update = (patch: Record<string, any>) => {
    const legacyTargets = (config.taskGroupId || config.targetRole) && !Array.isArray(config.toTargets)
      ? { toTargets: targetsFor("to") }
      : {};
    const senderMode = patch.senderMode || config.senderMode || "system";
    const next = {
      ...config,
      to: config.to ?? "",
      cc: config.cc ?? "",
      bcc: config.bcc ?? "",
      toTargets: Array.isArray(config.toTargets) ? config.toTargets : [],
      ccTargets: Array.isArray(config.ccTargets) ? config.ccTargets : [],
      bccTargets: Array.isArray(config.bccTargets) ? config.bccTargets : [],
      ...legacyTargets,
      ...patch,
      senderMode,
      emailActionVersion: 2,
      ...(["personal", "agent"].includes(senderMode)
        ? { includeSystemSignature: false }
        : { includeSystemSignature: patch.includeSystemSignature ?? config.includeSystemSignature ?? true }),
    };
    delete next.taskGroupId;
    delete next.targetRole;
    ownConfig.current = next;
    onChange(next);
  };

  const automationCategoryIds = useMemo(() => new Set([
    AUTOMATION_CATEGORY_ID,
    ...(categoriesQuery.data || []).filter(category =>
      ["automatizacia", "automation"].includes(category.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase())
    ).map(category => category.id),
  ]), [categoriesQuery.data]);
  const templates = useMemo(() => {
    const available = (templatesQuery.data || []).filter((template) => {
      const countries = template.countryCodes || [];
      return !countries.length || !countryCodes.length || countries.some((code) => countryCodes.includes(code));
    });
    return available.sort((a, b) => {
      const aMission = a.id === missionContext?.defaultEmailTemplateId ? 0 : a.categoryId === missionContext?.defaultEmailCategoryId ? 1 : 2;
      const bMission = b.id === missionContext?.defaultEmailTemplateId ? 0 : b.categoryId === missionContext?.defaultEmailCategoryId ? 1 : 2;
      if (aMission !== bMission) return aMission - bMission;
      const aAutomation = automationCategoryIds.has(a.categoryId || "") ? 0 : 1;
      const bAutomation = automationCategoryIds.has(b.categoryId || "") ? 0 : 1;
      return aAutomation - bAutomation;
    });
  }, [templatesQuery.data, countryCodes, automationCategoryIds, missionContext?.defaultEmailTemplateId, missionContext?.defaultEmailCategoryId]);
  const languageCode = (value?: string) => {
    const normalized = String(value || "").trim().toLowerCase();
    const aliases: Record<string, string> = { english: "en", slovak: "sk", slovenčina: "sk", czech: "cs", čeština: "cs", hungarian: "hu", magyar: "hu", romanian: "ro", română: "ro", italian: "it", italiano: "it", german: "de", deutsch: "de" };
    return aliases[normalized] || normalized.split(/[-_]/)[0];
  };
  const templateLanguages = Array.from(new Set([locale, ...templates.map(template => template.language).filter(Boolean) as string[]]))
    .filter((language, index, all) => all.findIndex(candidate => languageCode(candidate) === languageCode(language)) === index);
  const filteredTemplates = filterActivityCatalogTemplates(
    templates.filter(template => templateLanguage === "all" || languageCode(template.language) === languageCode(templateLanguage)),
    sourceModule,
    availableVariables,
  );
  const pickerTemplates = useMemo(() => filteredTemplates.map(template => {
    const marker = template.id === missionContext?.defaultEmailTemplateId ? statusCopy.missionDefault
      : template.categoryId === missionContext?.defaultEmailCategoryId ? statusCopy.missionCategory : "";
    return marker ? { ...template, name: `${marker} · ${template.name}` } : template;
  }), [filteredTemplates, missionContext?.defaultEmailTemplateId, missionContext?.defaultEmailCategoryId, statusCopy]);
  const selectedTemplate = templates.find(template => template.id === config.templateId);
  const showSavedSnapshotOption = Boolean(config.templateId && (!filteredTemplates.some(template => template.id === config.templateId)));
  const languageLabel = (code: string) => ({ en: "English", sk: "Slovenčina", cs: "Čeština", hu: "Magyar", ro: "Română", it: "Italiano", de: "Deutsch" }[languageCode(code)] || code);
  const addTarget = (field: RecipientField, value: string) => {
    if (!value) return;
    const [kind, ...parts] = value.split(":");
    const id = parts.join(":");
    const current = targetsFor(field);
    update({ [`${field}Targets`]: current.some((item) => item.kind === kind && item.id === id) ? current : [...current, { kind, id }] });
  };
  const removeTarget = (field: RecipientField, target: Target) =>
    update({ [`${field}Targets`]: targetsFor(field).filter((item) => item.kind !== target.kind || item.id !== target.id) });
  const targetLabel = (target: Target) => target.kind === "user"
    ? users.find((item) => item.id === target.id)?.fullName || target.id
    : target.kind === "group"
      ? groups.find((item) => item.id === target.id)?.displayAlias || groups.find((item) => item.id === target.id)?.name || target.id
      : roles.find((item) => item.name === target.id)?.name || target.id;
  const options = () => [
    ...users.map((item) => ({ value: `user:${item.id}`, label: `${item.fullName} · ${item.email}` })),
    ...groups.map((item) => ({ value: `group:${item.id}`, label: `${item.displayAlias || item.name} · ${copy.group}` })),
    ...roles.filter((item) => item.isActive !== false).map((item) => ({ value: `role:${item.name}`, label: `${item.name} · ${copy.role}` })),
  ];

  const recipientChoices = useMemo(() => {
    const labels = new Map(availableVariables.map((item) => [cleanVariable(item.value), item.label]));
    const seen = new Set<string>();
    return recipientTemplates.flatMap((raw) => {
      const value = cleanVariable(raw);
      const identity = value.toLowerCase();
      if (seen.has(identity)) return [];
      if (!/email$/.test(identity)) return [];
      let label: string | undefined = labels.get(value);
      if (!label && /(^|\.)(creator|createdby|created_by|author|ruleauthor)(\.|$)/.test(identity)) label = copy.creatorEmail;
      else if (/(^|\.)(agent|assignedagent|assigneduser|assignee|triggeringuser)(\.|$)/.test(identity)) label = copy.agentEmail;
      else if (/(^|\.)(customer|contact|client)(\.|$)/.test(identity)) label = copy.customerEmail;
      else if (!label && identity === "newvalues.email") label = copy.customerEmail;
      if (!label) return [];
      seen.add(identity);
      return [{ value, label: labels.get(value) || label }];
    });
  }, [availableVariables, recipientTemplates, copy]);
  const hasInvalidDraft = attachmentLoading || attachmentFailed || Object.values(addressDraft).some(draft =>
    draft.split(/[;,\s]+/).filter(Boolean).some(part =>
      !emailPattern.test(part) && !recipientChoices.some(item => part === `{{${item.value}}}`)));
  useEffect(() => {
    onDraftValidityChange?.(hasInvalidDraft);
  }, [hasInvalidDraft, onDraftValidityChange]);
  const recipientValueLabel = (raw: string) => {
    const value = cleanVariable(raw);
    return recipientChoices.find((choice) => choice.value === value)?.label || value;
  };
  const addressesFor = (field: RecipientField) =>
    String(config[field] ?? "").split(/[;,]/).map((address) => address.trim()).filter(Boolean);
  const cardSourcesFor = (field: RecipientField): EmailCardRecipientSource[] => {
    const configured = config[`${field}CardSources`];
    if (Array.isArray(configured)) return configured.filter((source: unknown): source is EmailCardRecipientSource => source === "main" || source === "persons");
    if (!hasCardRecipients) return [];
    const hasLegacyMain = addressesFor(field).some(isLegacyCardMainAddress);
    return hasLegacyMain ? ["main"] : [];
  };
  const visibleAddressesFor = (field: RecipientField) => cardSourcesFor(field).includes("main")
    ? addressesFor(field).filter(address => !isLegacyCardMainAddress(address))
    : addressesFor(field);
  const addressCount = (field: RecipientField) => visibleAddressesFor(field).length + targetsFor(field).length + cardSourcesFor(field).length;
  const hasCardRecipients = (() => {
    const namespaces = new Set(availableVariables.map(item => cleanVariable(item.value).split(".")[0].toLowerCase()));
    const hasFacilityNamespace = namespaces.has("clinic") || namespaces.has("hospital");
    const isKnownCustomerOnly = sourceModule === "customer"
      || (namespaces.has("customer") && !hasFacilityNamespace && !namespaces.has("collaborator"));
    if (isKnownCustomerOnly) return false;
    if (sourceModule === "clinic" || sourceModule === "hospital") return true;
    if (sourceModule === "status_list") return true;
    return hasFacilityNamespace;
  })();
  const setCardSource = (field: RecipientField, source: EmailCardRecipientSource, enabled: boolean) => {
    const current = cardSourcesFor(field);
    const nextSources = enabled
      ? Array.from(new Set([...current, source]))
      : current.filter(value => value !== source);
    // Legacy institution tokens represented the main card address. Once the user
    // edits these controls, move that intent into the explicit source config.
    const nextAddresses = addressesFor(field).filter(address => !isLegacyCardMainAddress(address));
    update({ [`${field}CardSources`]: nextSources, [field]: nextAddresses.join(", ") });
  };
  const addAddresses = (field: RecipientField, value = addressDraft[field]) => {
    const pieces = value.split(/[;,\s]+/).map((part) => part.trim()).filter(Boolean);
    if (!pieces.length) return { invalid: false };
    const current = addressesFor(field);
    const accepted = pieces.filter((part) => emailPattern.test(part) || recipientChoices.some((item) => part === `{{${item.value}}}`));
    const invalid = pieces.some((part) => !accepted.includes(part));
    if (accepted.length) {
      update({ [field]: Array.from(new Set([...current, ...accepted])).join(", ") });
      const remainder = pieces.filter((part) => !accepted.includes(part)).join(", ");
      setAddressDraft((previous) => ({ ...previous, [field]: remainder }));
    }
    return { invalid };
  };
  const removeAddress = (field: RecipientField, address: string) =>
    update({ [field]: addressesFor(field).filter((item) => item !== address).join(", ") });
  const insertRecipient = (field: RecipientField, value: string) => {
    const token = `{{${value}}}`;
    if (!addressesFor(field).includes(token)) update({ [field]: [...addressesFor(field), token].join(", ") });
  };
  const hasInvalidRecipientVariable = (field: RecipientField) => {
    const allowed = new Set(recipientChoices.map((item) => item.value));
    const matcher = /{{\s*([^{}]+?)\s*}}/g;
    let recipientMatch: RegExpExecArray | null;
    while ((recipientMatch = matcher.exec(String(config[field] ?? ""))) !== null) {
      if (!allowed.has(recipientMatch[1].trim())) return true;
    }
    return false;
  };
  const mailbox = mailboxQuery.data;
  const subject = String(config.subject ?? "");
  const body = String(config.body ?? "");
  const supported = new Set(availableVariables.map((item) => cleanVariable(item.value)));
  const allText = `${subject}\n${body}`;
  const used: string[] = [];
  const matcher = /{{\s*([^{}]+?)\s*}}/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(allText)) !== null) used.push(match[1].trim());
  const unsupported = Array.from(new Set(used.filter((variable) => !supported.has(variable))));
  const commitDraft = (field: RecipientField) => {
    const draft = addressDraft[field];
    if (!draft.trim()) return;
    // A following Save click must see the complete address committed by blur,
    // not the previous parent draft from the same browser interaction.
    flushSync(() => addAddresses(field, draft));
  };
  const changeRecipientTab = (field: string) => {
    if (field === activeRecipient) return;
    // Preserve invalid/incomplete text in its own draft while committing every complete address.
    commitDraft(activeRecipient);
    setActiveRecipient(field as RecipientField);
  };
  const recipientPanel = (field: RecipientField, title: string, description: string) => (
    <TabsContent value={field} className="mt-3 focus-visible:outline-none">
      <section className="space-y-3 rounded-lg border bg-background/70 p-3" aria-label={title}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h3 className="text-sm font-medium">{title}</h3><p className="text-xs text-muted-foreground">{description}</p></div>
          <Badge variant="outline">{addressCount(field)} {copy.recipientsCount}</Badge>
        </div>
        {hasCardRecipients && <fieldset className="space-y-2 rounded-md border bg-muted/20 p-3">
          <legend className="px-1 text-xs font-medium">{cardRecipientCopy.section}</legend>
          {(["main", "persons"] as const).map(source => <label key={source} className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 accent-primary"
              checked={cardSourcesFor(field).includes(source)}
              onChange={event => setCardSource(field, source, event.target.checked)} />
            <span>{cardRecipientCopy[source]}</span>
          </label>)}
          <p className="text-xs leading-relaxed text-muted-foreground">{cardRecipientCopy.help}</p>
        </fieldset>}
        {cardSourcesFor(field).length > 0 && <div className="flex flex-wrap gap-1.5">
          {cardSourcesFor(field).map(source => <Badge key={source} variant="outline">{cardRecipientCopy[source]}</Badge>)}
        </div>}
        <div className="flex flex-wrap gap-1.5">
          {targetsFor(field).map((target) => <Badge key={`${target.kind}:${target.id}`} variant="secondary" className="gap-1">
            <span>{targetLabel(target)}</span>
            <button type="button" aria-label={`${copy.remove} ${targetLabel(target)}`} onClick={() => removeTarget(field, target)}><X className="h-3 w-3" /></button>
          </Badge>)}
          {visibleAddressesFor(field).map((address, index) => {
            const variable = /^\{\{/.test(address);
            const label = variable ? recipientValueLabel(address) : address;
            return <Badge key={`${field}-${address}-${index}`} variant={variable ? "outline" : "secondary"} className="gap-1">
              <span>{label}</span>
              <button type="button" aria-label={`${copy.remove} ${label}`} onClick={() => removeAddress(field, address)}><X className="h-3 w-3" /></button>
            </Badge>;
          })}
          {addressCount(field) === 0 && <p className="text-xs text-muted-foreground">{copy.noRecipients}</p>}
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Select value="" onValueChange={(value) => addTarget(field, value)}>
            <SelectTrigger className="min-w-0"><SelectValue placeholder={copy.choosePerson} /></SelectTrigger>
            <SelectContent className="max-h-64">
              {options().map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${testId}-${field}-address`}>{copy.emailAddress}</Label>
          <div className="flex gap-2">
            <Input id={`${testId}-${field}-address`} type="text" inputMode="email" autoComplete="email"
              value={addressDraft[field]} className="min-w-0 flex-1"
              placeholder={copy.addressPlaceholder}
              aria-describedby={`${testId}-${field}-address-help`}
              onChange={(event) => setAddressDraft((previous) => ({ ...previous, [field]: event.target.value }))}
              onBlur={() => commitDraft(field)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addAddresses(field);
                }
              }} />
            <Button type="button" variant="outline" onClick={() => addAddresses(field)} className="shrink-0">
              <Plus className="mr-1.5 h-4 w-4" />{copy.addEmail}
            </Button>
          </div>
          <p id={`${testId}-${field}-address-help`} className="text-xs text-muted-foreground">{copy.addressHelp}</p>
          {addressDraft[field].trim() && <p role="status" className="text-xs text-amber-700">{copy.addressPending}</p>}
        </div>
        {recipientChoices.length > 0 && <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{copy.eventRecipients}</p>
          <div className="flex flex-wrap gap-1.5">{recipientChoices.map((choice) =>
            <Button key={choice.value} type="button" size="sm" variant="outline" className="h-7 text-xs"
              onClick={() => insertRecipient(field, choice.value)}>{choice.label}</Button>)}</div>
        </div>}
        {hasInvalidRecipientVariable(field) && <p role="alert" className="text-xs text-destructive">{copy.unsupportedVariables}</p>}
      </section>
    </TabsContent>
  );

  const personal = mailbox?.personal;
  const selectedSystem = mailbox?.system?.filter((item) => countryCodes.includes(item.countryCode)) || [];
  const automationCategoryName = categoriesQuery.data?.find((category) => category.id === AUTOMATION_CATEGORY_ID)?.name || copy.automationCategory;
  const templatePicker = <div className="space-y-2">
    <Label htmlFor={`${testId}-editor-template`}>{copy.template}</Label>
    <Select value={templateLanguage} onValueChange={setTemplateLanguage}>
      <SelectTrigger aria-label={t.automationEditorHelp.language} data-testid={`${testId}-editor-template-language`}><SelectValue /></SelectTrigger>
      <SelectContent className="z-[10041]">
        <SelectItem value="all">{t.automationEditorHelp.allLanguages}</SelectItem>
        {templateLanguages.map(language => <SelectItem key={language} value={language}>{languageLabel(language)}</SelectItem>)}
      </SelectContent>
    </Select>
     <AutomationTemplatePicker locale={locale} templates={pickerTemplates} value={config.templateId || "__custom"}
      availableVariables={availableVariables} sourceModule={sourceModule} customLabel={copy.customText}
      onRefresh={() => templatesQuery.refetch()} testId={`${testId}-editor-template`}
      snapshot={config.templateId ? { id: config.templateId, name: config.templateName || selectedTemplate?.name || copy.savedSnapshot } : undefined}
       onSelect={async (value) => {
       const requestId = ++attachmentRequest.current;
       setAttachmentFailed(false);
      if (value === "__custom") {
         setAttachmentLoading(false);
         update({ templateId: undefined, templateSnapshot: undefined, templateName: undefined, templateLanguage: undefined, attachments: [] });
        return;
      }
      const template = templates.find((item) => item.id === value);
      if (!template) return;
       let attachments: Array<{ name: string; contentType: string; contentBase64: string }> = [];
       const hasAttachmentMetadata = Array.isArray(template.attachments) ? template.attachments.length > 0 : Boolean(template.attachments);
       if (hasAttachmentMetadata) {
         setAttachmentLoading(true);
         try {
           const response = await fetch(`/api/message-templates/${encodeURIComponent(template.id)}/automation-attachments`, { credentials: "include" });
           if (!response.ok) throw new Error("attachments");
           const payload = await response.json();
           if (!Array.isArray(payload) || payload.length > 5) throw new Error("attachments");
           attachments = payload.map((file: any) => {
             if (file?.error || typeof file?.contentBase64 !== "string" || !file.contentBase64 || typeof file?.fileName !== "string" || !file.fileName.trim()) throw new Error("attachment");
             const contentBase64 = file.contentBase64.replace(/\s/g, "");
             if (contentBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(contentBase64)) throw new Error("attachment");
             const size = Math.floor(contentBase64.length * 3 / 4) - (contentBase64.endsWith("==") ? 2 : contentBase64.endsWith("=") ? 1 : 0);
             if (size > 10 * 1024 * 1024) throw new Error("attachment");
             return { name: file.fileName, contentType: String(file.mimeType || "application/octet-stream"), contentBase64, size };
           });
           if (attachments.reduce((total, file: any) => total + file.size, 0) > 25 * 1024 * 1024) throw new Error("attachment");
           attachments = attachments.map(({ name, contentType, contentBase64 }) => ({ name, contentType, contentBase64 }));
         } catch {
           if (mounted.current && requestId === attachmentRequest.current) {
             setAttachmentFailed(true);
             setAttachmentLoading(false);
           }
           return;
         }
       }
       if (!mounted.current || requestId !== attachmentRequest.current) return;
      const nextSubject = template.subject ?? "";
      const nextBody = template.contentHtml ?? template.content ?? "";
      selectionsRef.current = {
        subject: { start: nextSubject.length, end: nextSubject.length },
        body: { start: nextBody.length, end: nextBody.length },
      };
      update({
        templateId: template.id, templateSnapshot: true, templateName: template.name, templateLanguage: template.language,
         subject: nextSubject, body: nextBody, attachments,
      });
       setAttachmentLoading(false);
    }} />
     {(missionContext?.defaultEmailTemplateId || missionContext?.defaultEmailCategoryId) && <p className="text-xs text-muted-foreground">
       {missionContext.defaultEmailTemplateId && <span>{statusCopy.missionDefault}</span>}
       {missionContext.defaultEmailTemplateId && missionContext.defaultEmailCategoryId ? " · " : ""}
       {missionContext.defaultEmailCategoryId && <span>{statusCopy.missionCategory}</span>}
     </p>}
    {templatesQuery.isError && <button type="button" className="text-xs text-destructive" onClick={() => templatesQuery.refetch()}>{copy.templatesError}</button>}
     {attachmentLoading && <p role="status" className="text-xs text-muted-foreground">{statusCopy.attaching}</p>}
     {attachmentFailed && <p role="alert" className="text-xs text-destructive">{statusCopy.attachmentError}</p>}
  </div>;
  return <section className="space-y-4" data-testid={testId}>
    <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
      <span className="rounded-md bg-primary/10 p-2 text-primary"><Mail className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><strong className="text-sm">{copy.heading}</strong><p className="text-xs text-muted-foreground">{copy.description}</p></div>
      {mailboxQuery.isLoading ? <span className="text-xs text-muted-foreground">{copy.loading}</span>
        : mailboxQuery.isError ? <button type="button" className="text-xs text-destructive" onClick={() => mailboxQuery.refetch()}>{copy.retry}</button> : null}
    </div>
    <div className="space-y-2">
      <div><h2 className="text-sm font-semibold">{copy.recipientsHeading}</h2><p className="text-xs text-muted-foreground">{copy.recipientsDescription}</p></div>
      <Tabs value={activeRecipient} onValueChange={changeRecipientTab}>
        <TabsList className="grid h-auto w-full grid-cols-3">
          {([
            ["to", copy.toTab, copy.toExplanation],
            ["cc", copy.ccTab, copy.ccExplanation],
            ["bcc", copy.bccTab, copy.bccExplanation],
          ] as const).map(([field, title, description]) =>
            <TabsTrigger key={field} value={field} className="flex min-w-0 flex-col gap-0.5 py-2">
              <span className="flex items-center gap-1.5">{title}<Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{addressCount(field)}</Badge>
                {addressDraft[field].trim() && <span title={copy.addressPending} aria-label={copy.addressPending}>
                  <AlertCircle className="h-3.5 w-3.5 text-amber-700" />
                </span>}</span>
              <span className="hidden text-[10px] font-normal text-muted-foreground sm:block">{description}</span>
            </TabsTrigger>)}
        </TabsList>
        {recipientPanel("to", copy.toTab, copy.toExplanation)}
        {recipientPanel("cc", copy.ccTab, copy.ccExplanation)}
        {recipientPanel("bcc", copy.bccTab, copy.bccExplanation)}
      </Tabs>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1.5">
        <Label>{copy.sender}</Label>
        <Select value={config.senderMode || "system"} onValueChange={(value) => update({
          senderMode: value,
          ...(["personal", "agent"].includes(value) ? { includeSystemSignature: false } : {}),
        })}>
          <SelectTrigger data-testid={`${testId}-sender`}><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="system">{copy.systemSender}</SelectItem><SelectItem value="personal">{copy.personalSender}</SelectItem>
            <SelectItem value="agent">{t.missionCommunication.agentSender}</SelectItem>
            <SelectItem value="mission">{t.missionCommunication.missionSender}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{config.senderMode === "agent" ? t.missionCommunication.agentHelp
          : config.senderMode === "mission" ? t.missionCommunication.missionHelp
          : config.senderMode === "personal" ? copy.authorSender : copy.systemSender}</p>
        {!["agent", "mission"].includes(config.senderMode) && (config.senderMode === "personal"
          ? <MailboxStatus copy={copy} mailbox={personal} loading={mailboxQuery.isLoading} />
          : countryCodes.length
            ? selectedSystem.length
              ? <div className="space-y-1">{countryCodes.map((code) => <div key={code} className="flex items-center gap-2 text-xs">
                <Badge variant="outline">{code}</Badge>
                <MailboxStatus copy={copy} mailbox={selectedSystem.find((item) => item.countryCode === code)} loading={mailboxQuery.isLoading} />
              </div>)}</div>
              : <MailboxStatus copy={copy} loading={mailboxQuery.isLoading} />
            : <MailboxStatus copy={copy} loading={mailboxQuery.isLoading} />)}
      </div>
      <div className="space-y-1.5">
        <Label>{copy.displayName}</Label>
        <Input value={config.senderDisplayName || ""} onChange={(event) => update({ senderDisplayName: event.target.value })} />
        {!["personal", "agent"].includes(config.senderMode) && <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={config.includeSystemSignature !== false} onChange={(event) => update({ includeSystemSignature: event.target.checked })} />
          {copy.includeSignature}
        </label>}
      </div>
    </div>
    <div className="space-y-3">
      {Array.isArray(config.attachments) && config.attachments.length > 0 && <section className="space-y-2 rounded-lg border bg-muted/20 p-3" aria-label={statusCopy.attachments}>
        <h3 className="text-sm font-medium">{statusCopy.attachments} <span className="text-xs text-muted-foreground">({config.attachments.length})</span></h3>
        <ul className="space-y-1">{config.attachments.map((attachment: any, index: number) => <li key={`${attachment.name}-${index}`} className="flex items-center justify-between gap-2 text-xs">
          <span className="min-w-0 truncate">{attachment.name}</span>
          <Button type="button" variant="ghost" size="sm" aria-label={`${statusCopy.removeAttachment}: ${attachment.name}`} onClick={() => update({ attachments: config.attachments.filter((_: any, itemIndex: number) => itemIndex !== index) })}><X className="mr-1 h-3.5 w-3.5" />{statusCopy.removeAttachment}</Button>
        </li>)}</ul>
      </section>}
      {!subject.trim() && <p className="text-xs text-destructive">{copy.subjectRequired}</p>}
      {!String(config.body ?? "").trim() && <p className="text-xs text-destructive">{copy.bodyRequired}</p>}
      {unsupported.length > 0 && <p className="text-xs text-destructive">{copy.unsupportedVariables}: {unsupported.map((item) => `{{${item}}}`).join(", ")}</p>}
      {recipientChoices.length > 0 && <p className="text-xs text-muted-foreground">{copy.recipientVariableNote}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{t.sendEmailEditor.contentReady}</p>
          <p className="truncate text-xs text-muted-foreground">{body ? body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : copy.bodyRequired}</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setEditorOpen(true)} data-testid={`${testId}-open-editor`}>
          {t.sendEmailEditor.openEditor}
        </Button>
      </div>
      <AutomationEmailContentEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        subject={subject}
        body={body}
        onChange={(patch) => update(patch)}
        availableVariables={availableVariables}
        activeField={activeField}
        onActiveFieldChange={setActiveField}
        selectionsRef={selectionsRef}
        rewriteArtworkForPreview={rewriteArtworkForPreview}
        subjectRequired={copy.subjectRequired}
        bodyRequired={copy.bodyRequired}
        unsupportedWarning={unsupported.length ? `${copy.unsupportedVariables}: ${unsupported.map((item) => `{{${item}}}`).join(", ")}` : undefined}
        testId={testId}
        templatePicker={templatePicker}
      />
    </div>
  </section>;
}

function MailboxStatus({ copy, mailbox, loading }: { copy: any; mailbox?: Mailbox; loading: boolean }) {
  if (loading) return <p className="text-xs text-muted-foreground">{copy.loading}</p>;
  if (!mailbox?.connected) return <p className="text-xs text-destructive">{copy.notReady}</p>;
  return <p className="flex items-center gap-1.5 text-xs text-emerald-700"><Check className="h-3.5 w-3.5" />{mailbox.displayName || mailbox.email || copy.ready}{mailbox.email ? ` · ${mailbox.email}` : ""}</p>;
}
