import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Braces, MessageSquareText, PencilLine, Plus, X } from "lucide-react";
import { normalizeSmsRecipient, smsRecipientList } from "@shared/automation-sms-policy";
import { useI18n } from "@/i18n";
import { getSmsActionCopy, smsCountryNames } from "@/i18n/automation-sms-copy";
import { PhoneNumberField, PHONE_COUNTRIES } from "@/components/phone-number-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type SmsTemplate = { id: string; name: string; language?: string; content?: string; isActive?: boolean };
const cleanVariable = (value: string) => value.replace(/^{{\s*|\s*}}$/g, "").trim();
const languageCode = (value?: string) => {
  const normalized = String(value || "").trim().toLowerCase();
  const aliases: Record<string, string> = {
    english: "en", slovak: "sk", slovenčina: "sk", czech: "cs", čeština: "cs",
    hungarian: "hu", magyar: "hu", romanian: "ro", română: "ro", italian: "it",
    italiano: "it", german: "de", deutsch: "de",
  };
  return aliases[normalized] || normalized.split(/[-_]/)[0];
};
const languageName = (value: string) => ({
  en: "English", sk: "Slovenčina", cs: "Čeština", hu: "Magyar", ro: "Română", it: "Italiano", de: "Deutsch",
}[languageCode(value)] || value);
export function AutomationSendSmsAction({
  config, onChange, availableVariables, countryCodes, testId, onDraftValidityChange,
}: {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
  availableVariables: Array<{ value: string; label: string }>;
  countryCodes: string[];
  testId: string;
  onDraftValidityChange?: (invalid: boolean) => void;
}) {
  const { locale } = useI18n();
  const copy = getSmsActionCopy(locale);
  const countryNames = smsCountryNames[(locale in smsCountryNames ? locale : "en") as keyof typeof smsCountryNames];
  const rawRecipients = Array.isArray(config.to)
    ? config.to.map((item: unknown) => String(item))
    : typeof config.to === "string" && config.to.trim() ? [config.to] : [];
  const legacyValue = rawRecipients.join(", ");
  let normalizedExisting: string[] = [];
  let isLegacy = false;
  if (rawRecipients.length) {
    try {
      normalizedExisting = smsRecipientList(rawRecipients);
    } catch {
      isLegacy = true;
    }
  }
  const defaultLocaleCountry: Record<string, string> = { en: "US", sk: "SK", cs: "CZ", hu: "HU", ro: "RO", it: "IT", de: "DE" };
  const requestedCountry = countryCodes.length === 1 ? countryCodes[0].toUpperCase() : defaultLocaleCountry[locale] || "SK";
  const defaultCountryCode = PHONE_COUNTRIES.some(country => country.code === requestedCountry) ? requestedCountry : "SK";
  const [rows, setRows] = useState<string[]>(normalizedExisting.length ? normalizedExisting : [""]);
  const recipientIdentity = JSON.stringify(config.to);
  const lastRecipientIdentity = useRef(recipientIdentity);
  useEffect(() => {
    if (lastRecipientIdentity.current === recipientIdentity) return;
    lastRecipientIdentity.current = recipientIdentity;
    setRows(normalizedExisting.length ? normalizedExisting : [""]);
  }, [recipientIdentity]);
  const [open, setOpen] = useState(false);
  const [templateLanguage, setTemplateLanguage] = useState<string>(locale);
  const [draft, setDraft] = useState({ text: "", templateId: "", templateName: "", templateLanguage: "", templateSnapshot: false });
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const selection = useRef({ start: String(config.text ?? config.message ?? "").length, end: String(config.text ?? config.message ?? "").length });
  const templatesQuery = useQuery<SmsTemplate[]>({
    queryKey: ["/api/message-templates", "sms"],
    queryFn: async () => {
      const response = await fetch("/api/message-templates?type=sms", { credentials: "include" });
      if (!response.ok) throw new Error("SMS templates");
      return response.json();
    },
  });
  useEffect(() => setTemplateLanguage(locale), [locale]);

  const templates = templatesQuery.data || [];
  const languages = useMemo(() => Array.from(new Set([locale, ...templates.map(item => item.language).filter(Boolean) as string[]]))
    .filter((value, index, all) => all.findIndex(candidate => languageCode(candidate) === languageCode(value)) === index), [locale, templates]);
  const visibleTemplates = templates.filter(item => item.isActive !== false &&
    (templateLanguage === "all" || languageCode(item.language) === languageCode(templateLanguage)));
  const supported = new Set(availableVariables.map(item => cleanVariable(item.value)));
  const unsupportedIn = (text: string) => Array.from(new Set(
    Array.from(text.matchAll(/{{\s*([^{}]+?)\s*}}/g), match => match[1].trim()).filter(value => !supported.has(value)),
  ));
  const unsupported = unsupportedIn(draft.text);
  const selectedTemplate = templates.find(item => item.id === draft.templateId);
  const snapshotMissing = Boolean(config.templateId && (!templates.some(item => item.id === config.templateId) ||
    templates.find(item => item.id === config.templateId)?.isActive === false));
  const incompleteRows = rows.some(value => !value.trim());
  const enteredRows = rows.filter(value => value.trim());
  let normalizedRows: string[] = [];
  let uniqueRows: string[] = [];
  let invalidRows = false;
  try {
    normalizedRows = enteredRows.map(normalizeSmsRecipient);
    uniqueRows = smsRecipientList(enteredRows);
  } catch {
    invalidRows = enteredRows.length > 0;
  }
  const duplicateRows = normalizedRows.length !== uniqueRows.length;
  const recipientInvalid = isLegacy ? false : invalidRows || duplicateRows || incompleteRows || uniqueRows.length === 0;
  const visibleMessage = String(config.text ?? config.message ?? "");
  const unsupportedCommitted = Array.from(new Set(
    Array.from(visibleMessage.matchAll(/{{\s*([^{}]+?)\s*}}/g), match => match[1].trim()).filter(value => !supported.has(value)),
  ));
  const invalidMessage = !visibleMessage.trim() || unsupportedCommitted.length > 0;
  const invalidRecipients = recipientInvalid || invalidMessage;
  const validityCallback = useRef(onDraftValidityChange);
  validityCallback.current = onDraftValidityChange;
  useEffect(() => {
    validityCallback.current?.(invalidRecipients);
  }, [invalidRecipients]);

  const update = (patch: Record<string, any>) => {
    const next = { ...config, ...patch };
    delete next.country;
    delete next.legacyRecipient;
    onChange(next);
  };
  const saveRecipients = (nextRows: string[]) => {
    setRows(nextRows);
    if (isLegacy) return;
    const entered = nextRows.filter(value => value.trim());
    try {
      const normalized = entered.length ? smsRecipientList(entered) : [];
      lastRecipientIdentity.current = JSON.stringify(normalized);
      update({ smsActionVersion: 2, to: normalized });
    } catch {
      // Keep invalid and incomplete values visible without replacing the last valid config.
    }
  };
  const startManualList = () => {
    const next = { ...config, smsActionVersion: 2, to: [] };
    delete next.country;
    delete next.legacyRecipient;
    onChange(next);
    setRows([""]);
  };
  const removeRecipient = (index: number) => {
    const next = rows.filter((_, rowIndex) => index !== rowIndex);
    saveRecipients(next.length ? next : [""]);
  };
  const beginEdit = () => {
    const text = String(config.text ?? config.message ?? "");
    setDraft({
      text,
      templateId: String(config.templateId || ""),
      templateName: String(config.templateName || ""),
      templateLanguage: String(config.templateLanguage || ""),
      templateSnapshot: Boolean(config.templateSnapshot),
    });
    selection.current = { start: text.length, end: text.length };
    setOpen(true);
  };
  const chooseTemplate = (id: string) => {
    if (id === "__custom") {
      setDraft(previous => ({ ...previous, templateId: "", templateName: "", templateLanguage: "", templateSnapshot: false }));
      return;
    }
    const template = templates.find(item => item.id === id);
    if (!template) return;
    const text = template.content || "";
    selection.current = { start: text.length, end: text.length };
    setDraft({ text, templateId: template.id, templateName: template.name, templateLanguage: template.language || "", templateSnapshot: true });
  };
  const insertVariable = (value: string) => {
    const start = textRef.current?.selectionStart ?? selection.current.start;
    const end = textRef.current?.selectionEnd ?? selection.current.end;
    const token = `{{${cleanVariable(value)}}}`;
    const text = `${draft.text.slice(0, start)}${token}${draft.text.slice(end)}`;
    const caret = start + token.length;
    setDraft(previous => ({ ...previous, text }));
    selection.current = { start: caret, end: caret };
    requestAnimationFrame(() => {
      textRef.current?.focus();
      textRef.current?.setSelectionRange(caret, caret);
    });
  };
  const apply = () => {
    if (isLegacy) {
      update({
        text: draft.text,
        templateId: draft.templateId || undefined,
        templateName: draft.templateId ? draft.templateName : undefined,
        templateLanguage: draft.templateId ? draft.templateLanguage : undefined,
        templateSnapshot: draft.templateId ? true : undefined,
      });
    } else {
      update({
        smsActionVersion: 2, to: uniqueRows, text: draft.text,
        templateId: draft.templateId || undefined,
        templateName: draft.templateId ? draft.templateName : undefined,
        templateLanguage: draft.templateId ? draft.templateLanguage : undefined,
        templateSnapshot: draft.templateId ? true : undefined,
      });
    }
    setOpen(false);
  };

  return <section className="space-y-4" data-testid={testId}>
    <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
      <span className="rounded-md bg-primary/10 p-2 text-primary"><MessageSquareText className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><strong className="text-sm">{copy.heading}</strong><p className="text-xs text-muted-foreground">{copy.description}</p></div>
    </div>

    <section className="space-y-3 rounded-lg border bg-background/70 p-3" aria-label={copy.recipients}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h3 className="text-sm font-medium">{copy.recipients}</h3><p className="text-xs text-muted-foreground">{copy.recipientsHelp}</p></div>
        {!isLegacy && <Badge variant="outline">{uniqueRows.length} {copy.count}</Badge>}
      </div>
      {isLegacy ? <div className="flex items-start gap-2 rounded-md border border-amber-300/70 bg-amber-50/70 p-3 text-amber-950">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1"><strong className="text-xs">{copy.legacyTitle}</strong>
          <p className="mt-1 break-all text-xs">{legacyValue}</p>
          <p className="mt-1 text-xs">{copy.legacyHelp}</p>
          <Button type="button" size="sm" variant="outline" className="mt-2" onClick={startManualList}
            data-testid={`${testId}-replace-legacy`}>{copy.replace}</Button>
        </div>
      </div> : <>
        <div className="space-y-2">
          {rows.map((value, index) => <div key={index} className="flex items-start gap-2" data-testid={`${testId}-recipient-row-${index}`}>
            <PhoneNumberField
              value={value}
              onChange={next => saveRecipients(rows.map((row, rowIndex) => rowIndex === index ? next : row))}
              placeholder={copy.numberPlaceholder}
              defaultCountryCode={defaultCountryCode}
              className="min-w-0 flex-1"
              data-testid={`${testId}-recipient-${index}`}
              countryNames={countryNames}
              searchPlaceholder={copy.searchCountry}
              noCountryResults={copy.noCountry}
              portalClassName="z-[10050]"
            />
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={`${copy.remove} ${index + 1}`}
              onClick={() => removeRecipient(index)} data-testid={`${testId}-remove-recipient-${index}`}><X className="h-4 w-4" /></Button>
          </div>)}
        </div>
        <Button type="button" variant="outline" size="sm" disabled={rows.length >= 50}
          onClick={() => setRows(previous => [...previous, ""])} data-testid={`${testId}-add-recipient`}>
          <Plus className="mr-1.5 h-4 w-4" />{copy.addRecipient}
        </Button>
        {invalidRows && <p role="alert" className="text-xs text-destructive">{copy.numberInvalid}</p>}
        {duplicateRows && <p role="alert" className="text-xs text-destructive">{copy.duplicate}</p>}
        {incompleteRows && <p role="status" className="text-xs text-muted-foreground">{copy.incomplete}</p>}
      </>}
    </section>

    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${testId}-kind`}>{copy.kind}</Label>
        <Select value={config.kind || "transactional"} onValueChange={value => update({ kind: value })}>
          <SelectTrigger id={`${testId}-kind`} data-testid={`${testId}-kind`}><SelectValue /></SelectTrigger>
          <SelectContent className="z-[10041]">
            <SelectItem value="transactional">{copy.transactional}</SelectItem>
            <SelectItem value="promotional">{copy.promotional}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{copy.kindHelp}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${testId}-gateway`}>{copy.gateway}</Label>
        <Select value={config.provider || "default"} onValueChange={value => update({ provider: value === "default" ? undefined : value })}>
          <SelectTrigger id={`${testId}-gateway`} data-testid={`${testId}-gateway`}><SelectValue /></SelectTrigger>
          <SelectContent className="z-[10041]">
            <SelectItem value="default">{copy.gatewayDefault}</SelectItem>
            <SelectItem value="bulkgate">{copy.bulkgate}</SelectItem>
            <SelectItem value="smstools">{copy.smstools}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{copy.gatewayHelp}</p>
      </div>
    </div>

    <label className="flex items-start gap-2 rounded-md border bg-muted/20 p-3">
      <input type="checkbox" className="mt-0.5 accent-primary" checked={config.unicode === true}
        onChange={event => update({ unicode: event.target.checked })} data-testid={`${testId}-unicode`} />
      <span><span className="block text-sm font-medium">{copy.unicode}</span><span className="block text-xs text-muted-foreground">{copy.unicodeHelp}</span></span>
    </label>

    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0"><p className="text-sm font-medium">{copy.contentReady}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{visibleMessage || copy.emptyMessage}</p></div>
        <Button type="button" variant="outline" size="sm" onClick={beginEdit} data-testid={`${testId}-open-editor`}>
          <PencilLine className="mr-1.5 h-3.5 w-3.5" />{copy.editMessage}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{copy.messageHelp}</p>
      {!visibleMessage.trim() && <p role="alert" className="mt-2 text-xs text-destructive">{copy.messageRequired}</p>}
      {!!unsupportedCommitted.length && <p role="alert" className="mt-2 text-xs text-destructive">
        {copy.unsupported}: {unsupportedCommitted.map(value => `{{${value}}}`).join(", ")}
      </p>}
      {config.templateId && <p className={`mt-2 text-xs ${snapshotMissing ? "text-amber-700" : "text-muted-foreground"}`}
        data-testid={`${testId}-template-snapshot`}>{copy.savedSnapshot}: {String(config.templateName || config.templateId)}</p>}
    </div>

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        overlayClassName="task-modern-modal-overlay task-modern-modal-overlay--nested"
        className="task-modern-modal task-modern-modal--nested flex h-[min(760px,calc(100dvh-2rem))] w-[min(760px,calc(100vw-1rem))] max-w-[760px] flex-col gap-0 overflow-hidden p-0"
        data-testid={`${testId}-editor`}
      >
        <DialogHeader><DialogTitle>{copy.editorTitle}</DialogTitle><DialogDescription>{copy.editorHelp}</DialogDescription></DialogHeader>
        <div className="task-modern-modal-body min-h-0 flex-1 space-y-4">
          <div className="space-y-2">
            <Label>{copy.templates}</Label>
            <Select value={templateLanguage} onValueChange={setTemplateLanguage}>
              <SelectTrigger aria-label={copy.language} data-testid={`${testId}-template-language`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{copy.allLanguages}</SelectItem>
                {languages.map(language => <SelectItem key={language} value={language}>{languageName(language)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={draft.templateId || "__custom"} onValueChange={chooseTemplate}>
              <SelectTrigger data-testid={`${testId}-template`}><SelectValue placeholder={copy.chooseTemplate} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__custom">{copy.custom}</SelectItem>
                {draft.templateId && !visibleTemplates.some(item => item.id === draft.templateId) && <SelectItem value={draft.templateId}>
                  {draft.templateName || selectedTemplate?.name || draft.templateId} · {copy.currentSnapshot}
                </SelectItem>}
                {visibleTemplates.map(template => {
                  const unsupportedVariables = unsupportedIn(template.content || "");
                  return <SelectItem key={template.id} value={template.id} disabled={unsupportedVariables.length > 0}
                    data-testid={`${testId}-template-option-${template.id}`}>
                    {template.name}{template.language ? ` · ${languageName(template.language)}` : ""}
                    {unsupportedVariables.length ? ` · ${copy.unsupportedTemplate}: ${unsupportedVariables.map(value => `{{${value}}}`).join(", ")}` : ""}
                  </SelectItem>;
                })}
              </SelectContent>
            </Select>
            {templatesQuery.isLoading && <p className="text-xs text-muted-foreground">{copy.loading}</p>}
            {templatesQuery.isSuccess && visibleTemplates.length === 0 && <p className="text-xs text-muted-foreground">{copy.noTemplates}</p>}
            {templatesQuery.isError && <button type="button" className="text-xs text-destructive" onClick={() => templatesQuery.refetch()}>{copy.templateError}</button>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${testId}-text`}>{copy.text}</Label>
            <Textarea id={`${testId}-text`} rows={6} ref={textRef} value={draft.text} placeholder={copy.messagePlaceholder}
              data-testid={`${testId}-text`} onFocus={event => {
                selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd };
              }} onSelect={event => {
                selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd };
              }} onChange={event => setDraft(previous => ({ ...previous, text: event.target.value }))} />
          </div>
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-xs font-medium"><Braces className="h-3.5 w-3.5" />{copy.variables}<Badge variant="secondary">{availableVariables.length}</Badge></div>
            <div className="flex flex-wrap gap-1.5">{availableVariables.map(variable => <Button key={variable.value} type="button" variant="outline" size="sm"
              className="h-7 font-mono text-[11px]" onClick={() => insertVariable(variable.value)} title={variable.label}>{`{{${cleanVariable(variable.value)}}}`}</Button>)}</div>
            {!!unsupported.length && <p role="alert" className="text-xs text-destructive" data-testid={`${testId}-unsupported`}>
              <strong>{copy.unsupported}:</strong> {unsupported.map(value => `{{${value}}}`).join(", ")}</p>}
            {!draft.text.trim() && <p className="text-xs text-destructive">{copy.messageRequired}</p>}
            {isLegacy && <p className="text-xs text-muted-foreground">{copy.legacyNotice}</p>}
          </div>
        </div>
        <DialogFooter className="task-modern-modal-footer mt-0 gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid={`${testId}-cancel`}>{copy.cancel}</Button>
          <Button type="button" onClick={apply} disabled={!draft.text.trim() || unsupported.length > 0} data-testid={`${testId}-apply`}>{copy.apply}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
