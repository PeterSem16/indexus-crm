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
};
type TemplateCategory = { id: string; name: string };
type Mailbox = { connected: boolean; email?: string; displayName?: string; hasSignature?: boolean };

const AUTOMATION_CATEGORY_ID = "indexus-automation-email-category";
const rewriteArtworkForPreview = (html: string) => html.replace(
  /cid:indexus-automation-(task|attention|success|deadline)/gi,
  (_match, artwork: string) => `/api/automation/email-artwork/${artwork.toLowerCase()}`,
);
const cleanVariable = (value: string) => value.replace(/^{{\s*|\s*}}$/g, "").trim();
const emailPattern = /^[^@\s<>,;{}]+@[^@\s<>,;{}]+\.[^@\s<>,;{}]+$/;

export function AutomationSendEmailAction({
  config, onChange, users, groups, roles, countryCodes, ruleId, availableVariables, recipientTemplates, testId, onDraftValidityChange,
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
}) {
  const { t, locale } = useI18n();
  const copy = t.sendEmailAction;
  const [addressDraft, setAddressDraft] = useState<Record<RecipientField, string>>({ to: "", cc: "", bcc: "" });
  const ownConfig = useRef(config);
  const [activeRecipient, setActiveRecipient] = useState<RecipientField>("to");
  const [activeField, setActiveField] = useState<"subject" | "body">("body");
  const [editorOpen, setEditorOpen] = useState(false);
  const [templateLanguage, setTemplateLanguage] = useState<string>(locale);
  useEffect(() => setTemplateLanguage(locale), [locale]);
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
      ...(senderMode === "personal"
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
      const aAutomation = automationCategoryIds.has(a.categoryId || "") ? 0 : 1;
      const bAutomation = automationCategoryIds.has(b.categoryId || "") ? 0 : 1;
      return aAutomation - bAutomation;
    });
  }, [templatesQuery.data, countryCodes, automationCategoryIds]);
  const languageCode = (value?: string) => {
    const normalized = String(value || "").trim().toLowerCase();
    const aliases: Record<string, string> = { english: "en", slovak: "sk", slovenčina: "sk", czech: "cs", čeština: "cs", hungarian: "hu", magyar: "hu", romanian: "ro", română: "ro", italian: "it", italiano: "it", german: "de", deutsch: "de" };
    return aliases[normalized] || normalized.split(/[-_]/)[0];
  };
  const templateLanguages = Array.from(new Set([locale, ...templates.map(template => template.language).filter(Boolean) as string[]]))
    .filter((language, index, all) => all.findIndex(candidate => languageCode(candidate) === languageCode(language)) === index);
  const filteredTemplates = templates.filter(template =>
    templateLanguage === "all" || languageCode(template.language) === languageCode(templateLanguage));
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
  const hasInvalidDraft = Object.values(addressDraft).some(draft =>
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
  const addressCount = (field: RecipientField) => addressesFor(field).length + targetsFor(field).length;
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
        <div className="flex flex-wrap gap-1.5">
          {targetsFor(field).map((target) => <Badge key={`${target.kind}:${target.id}`} variant="secondary" className="gap-1">
            <span>{targetLabel(target)}</span>
            <button type="button" aria-label={`${copy.remove} ${targetLabel(target)}`} onClick={() => removeTarget(field, target)}><X className="h-3 w-3" /></button>
          </Badge>)}
          {addressesFor(field).map((address, index) => {
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
    <Select value={config.templateId || "__custom"} onValueChange={(value) => {
      if (value === "__custom") {
        update({ templateId: undefined, templateSnapshot: undefined, templateName: undefined, templateLanguage: undefined });
        return;
      }
      const template = templates.find((item) => item.id === value);
      if (!template) return;
      const nextSubject = template.subject ?? "";
      const nextBody = template.contentHtml ?? template.content ?? "";
      selectionsRef.current = {
        subject: { start: nextSubject.length, end: nextSubject.length },
        body: { start: nextBody.length, end: nextBody.length },
      };
      update({
        templateId: template.id, templateSnapshot: true, templateName: template.name, templateLanguage: template.language,
        subject: nextSubject, body: nextBody,
      });
    }}>
      <SelectTrigger id={`${testId}-editor-template`} data-testid={`${testId}-editor-template`}>
        <SelectValue placeholder={copy.chooseTemplate} />
      </SelectTrigger>
      <SelectContent className="z-[10041]">
        <SelectItem value="__custom">{copy.customText}</SelectItem>
        {showSavedSnapshotOption &&
          <SelectItem value={config.templateId}>{config.templateName || selectedTemplate?.name || copy.savedSnapshot} · {t.automationEditorHelp.currentSnapshot}</SelectItem>}
        {filteredTemplates.map((template, index) => <SelectItem key={template.id} value={template.id}>
          {index === 0 || filteredTemplates[index - 1].categoryId !== template.categoryId
            ? `${template.categoryId === AUTOMATION_CATEGORY_ID ? automationCategoryName : categoriesQuery.data?.find((category) => category.id === template.categoryId)?.name || copy.otherTemplates}: `
            : ""}
          {template.name}{template.language ? ` · ${languageLabel(template.language)}` : ""}
        </SelectItem>)}
      </SelectContent>
    </Select>
    {templatesQuery.isError && <button type="button" className="text-xs text-destructive" onClick={() => templatesQuery.refetch()}>{copy.templatesError}</button>}
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
          ...(value === "personal" ? { includeSystemSignature: false } : {}),
        })}>
          <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="system">{copy.systemSender}</SelectItem><SelectItem value="personal">{copy.personalSender}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{config.senderMode === "personal" ? copy.authorSender : copy.systemSender}</p>
        {config.senderMode === "personal"
          ? <MailboxStatus copy={copy} mailbox={personal} loading={mailboxQuery.isLoading} />
          : countryCodes.length
            ? selectedSystem.length
              ? <div className="space-y-1">{countryCodes.map((code) => <div key={code} className="flex items-center gap-2 text-xs">
                <Badge variant="outline">{code}</Badge>
                <MailboxStatus copy={copy} mailbox={selectedSystem.find((item) => item.countryCode === code)} loading={mailboxQuery.isLoading} />
              </div>)}</div>
              : <MailboxStatus copy={copy} loading={mailboxQuery.isLoading} />
            : <MailboxStatus copy={copy} loading={mailboxQuery.isLoading} />}
      </div>
      <div className="space-y-1.5">
        <Label>{copy.displayName}</Label>
        <Input value={config.senderDisplayName || ""} onChange={(event) => update({ senderDisplayName: event.target.value })} />
        {config.senderMode !== "personal" && <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={config.includeSystemSignature !== false} onChange={(event) => update({ includeSystemSignature: event.target.checked })} />
          {copy.includeSignature}
        </label>}
      </div>
    </div>
    <div className="space-y-3">
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
