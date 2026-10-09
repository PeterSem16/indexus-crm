import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Braces, PencilLine } from "lucide-react";
import { useI18n } from "@/i18n";
import { getNotificationCopy } from "@/i18n/automation-notification-copy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Template = { id: string; name: string; language?: string; subject?: string; content?: string; isActive?: boolean };
type Field = "title" | "message";
const clean = (value: string) => value.replace(/^{{\s*|\s*}}$/g, "").trim();
const languageCode = (value?: string) => {
  const normalized = String(value || "").trim().toLowerCase();
  const aliases: Record<string, string> = { english: "en", slovak: "sk", slovenčina: "sk", czech: "cs", čeština: "cs", hungarian: "hu", magyar: "hu", romanian: "ro", română: "ro", italian: "it", italiano: "it", german: "de", deutsch: "de" };
  return aliases[normalized] || normalized.split(/[-_]/)[0];
};
const languageName = (value: string) => ({ en: "English", sk: "Slovenčina", cs: "Čeština", hu: "Magyar", ro: "Română", it: "Italiano", de: "Deutsch" }[languageCode(value)] || value);

export function AutomationNotifyUserAction({
  config, onChange, availableVariables, recipientSelector, index,
}: {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
  availableVariables: Array<{ value: string; label: string }>;
  recipientSelector: ReactNode;
  index: number;
}) {
  const { locale } = useI18n();
  const copy = getNotificationCopy(locale);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ title: "", message: "", templateId: "", templateName: "", templateLanguage: "", templateSnapshot: false });
  const [templateLanguage, setTemplateLanguage] = useState<string>(locale);
  const activeField = useRef<Field>("message");
  const refs = useRef<Record<Field, HTMLInputElement | HTMLTextAreaElement | null>>({ title: null, message: null });
  const selections = useRef<Record<Field, { start: number; end: number }>>({ title: { start: 0, end: 0 }, message: { start: 0, end: 0 } });
  const query = useQuery<Template[]>({
    queryKey: ["/api/message-templates", "notification"],
    queryFn: async () => {
      const response = await fetch("/api/message-templates?type=notification", { credentials: "include" });
      if (!response.ok) throw new Error("notification templates");
      return response.json();
    },
  });
  useEffect(() => setTemplateLanguage(locale), [locale]);
  const templates = query.data || [];
  const languages = useMemo(() => Array.from(new Set([locale, ...templates.map(item => item.language).filter(Boolean) as string[]]))
    .filter((value, index, all) => all.findIndex(candidate => languageCode(candidate) === languageCode(value)) === index), [locale, templates]);
  const visibleTemplates = templates.filter(item => item.isActive !== false &&
    (templateLanguage === "all" || languageCode(item.language) === languageCode(templateLanguage)));
  const selectedTemplate = templates.find(item => item.id === draft.templateId);
  const keepSelectedVisible = Boolean(draft.templateId && !visibleTemplates.some(item => item.id === draft.templateId));
  const supported = new Set(availableVariables.map(item => clean(item.value)));
  const unsupportedIn = (template: Template) => Array.from(new Set(
    [template.subject || "", template.content || ""]
      .flatMap(text => Array.from(text.matchAll(/{{\s*([^{}]+?)\s*}}/g), match => match[1].trim()))
      .filter(value => !supported.has(value)),
  ));
  const used = [draft.title, draft.message].flatMap(text => Array.from(text.matchAll(/{{\s*([^{}]+?)\s*}}/g), match => match[1].trim()));
  const unsupported = Array.from(new Set(used.filter(value => !supported.has(value))));

  const beginEdit = () => {
    const title = String(config.title || "");
    const message = String(config.message || "");
    setDraft({ title, message, templateId: String(config.templateId || ""), templateName: String(config.templateName || ""), templateLanguage: String(config.templateLanguage || ""), templateSnapshot: Boolean(config.templateSnapshot) });
    selections.current = { title: { start: title.length, end: title.length }, message: { start: message.length, end: message.length } };
    setOpen(true);
  };
  const chooseTemplate = (id: string) => {
    if (id === "__custom") {
      setDraft(previous => ({ ...previous, templateId: "", templateName: "", templateLanguage: "", templateSnapshot: false }));
      return;
    }
    const template = templates.find(item => item.id === id);
    if (!template) return;
    const title = template.subject || "";
    const message = template.content || "";
    selections.current = { title: { start: title.length, end: title.length }, message: { start: message.length, end: message.length } };
    setDraft({ title, message, templateId: template.id, templateName: template.name, templateLanguage: template.language || "", templateSnapshot: true });
  };
  const insertVariable = (value: string) => {
    const field = activeField.current;
    const current = draft[field];
    const element = refs.current[field];
    const selection = element ? {
      start: element.selectionStart ?? selections.current[field].start,
      end: element.selectionEnd ?? selections.current[field].end,
    } : selections.current[field];
    const token = `{{${clean(value)}}}`;
    const next = `${current.slice(0, selection.start)}${token}${current.slice(selection.end)}`;
    const caret = selection.start + token.length;
    setDraft(previous => ({ ...previous, [field]: next }));
    selections.current[field] = { start: caret, end: caret };
    requestAnimationFrame(() => {
      refs.current[field]?.focus();
      refs.current[field]?.setSelectionRange(caret, caret);
    });
  };
  const save = () => {
    onChange({
      ...config, title: draft.title, message: draft.message,
      templateId: draft.templateId || undefined,
      templateName: draft.templateId ? draft.templateName : undefined,
      templateLanguage: draft.templateId ? draft.templateLanguage : undefined,
      templateSnapshot: draft.templateId ? true : undefined,
      notificationActionVersion: 2,
    });
    setOpen(false);
  };
  const currentTemplate = config.templateId ? templates.find(item => item.id === config.templateId) : undefined;
  const currentTemplateUnavailable = Boolean(config.templateId && (!currentTemplate || currentTemplate.isActive === false));
  return <section className="space-y-3" data-testid={`notify-user-action-${index}`}>
    <div className="flex items-start gap-3 rounded-lg border bg-background/70 p-3">
      <span className="rounded-md bg-primary/10 p-2 text-primary"><Bell className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><strong className="text-sm">{copy.heading}</strong><p className="text-xs text-muted-foreground">{copy.description}</p></div>
      <Label className="sr-only" htmlFor={`notify-priority-${index}`}>{copy.priority}</Label>
      <Select value={config.priority || "normal"} onValueChange={value => onChange({ ...config, priority: value })}>
        <SelectTrigger id={`notify-priority-${index}`} className="h-8 w-[125px] text-xs" data-testid={`notify-user-priority-${index}`}><SelectValue /></SelectTrigger>
        <SelectContent>
          {(["low", "normal", "high", "urgent"] as const).map(priority => <SelectItem key={priority} value={priority}>{copy.priorityLabels[priority]}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    {recipientSelector}
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0"><p className="truncate text-sm font-medium">{String(config.title || copy.title)}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{String(config.message || copy.message)}</p></div>
        <Button type="button" variant="outline" size="sm" onClick={beginEdit} data-testid={`notify-user-edit-${index}`}><PencilLine className="mr-1.5 h-3.5 w-3.5" />{copy.edit}</Button>
      </div>
      {config.templateId && <p className={`text-xs ${currentTemplateUnavailable ? "text-amber-700" : "text-muted-foreground"}`} data-testid={`notify-user-snapshot-${index}`}>
        {copy.snapshot}: {config.templateName || currentTemplate?.name || config.templateId}
      </p>}
    </div>
    <Dialog open={open} onOpenChange={() => setOpen(false)}>
      <DialogContent
        overlayClassName="task-modern-modal-overlay task-modern-modal-overlay--nested"
        className="task-modern-modal task-modern-modal--nested flex h-[min(760px,calc(100dvh-2rem))] w-[min(900px,calc(100vw-1rem))] max-w-[900px] flex-col gap-0 overflow-hidden p-0"
        data-testid={`notify-user-editor-${index}`}
      >
        <DialogHeader><DialogTitle>{copy.editorTitle}</DialogTitle><DialogDescription>{copy.editorDescription}</DialogDescription></DialogHeader>
        <div className="task-modern-modal-body min-h-0 flex-1">
          <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(260px,.85fr)]">
          <div className="order-2 min-w-0 space-y-4 md:order-2">
          <div className="space-y-2"><Label>{copy.templates}</Label>
            <Select value={templateLanguage} onValueChange={setTemplateLanguage}>
              <SelectTrigger aria-label={copy.allLanguages} data-testid={`notify-user-template-language-${index}`}><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">{copy.allLanguages}</SelectItem>
                {languages.map(language => <SelectItem key={language} value={language}>{languageName(language)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={draft.templateId || "__custom"} onValueChange={chooseTemplate}>
              <SelectTrigger data-testid={`notify-user-template-${index}`}><SelectValue placeholder={copy.chooseTemplate} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__custom">{copy.custom}</SelectItem>
                {draft.templateId && keepSelectedVisible && (() => {
                  const unsupportedVariables = selectedTemplate ? unsupportedIn(selectedTemplate) : unsupported;
                  return <SelectItem value={draft.templateId} disabled={unsupportedVariables.length > 0}
                    data-testid={`notify-template-option-${draft.templateId}`}>
                    {draft.templateName || selectedTemplate?.name || draft.templateId} · {copy.snapshot}
                    {unsupportedVariables.length ? ` · ${copy.unsupportedTemplate}${unsupportedVariables.map(value => `{{${value}}}`).join(", ")}` : ""}
                  </SelectItem>;
                })()}
                {visibleTemplates.map(template => {
                  const unsupportedVariables = unsupportedIn(template);
                  return <SelectItem key={template.id} value={template.id} disabled={unsupportedVariables.length > 0}
                    data-testid={`notify-template-option-${template.id}`}>
                    {template.name}{template.language ? ` · ${languageName(template.language)}` : ""}
                    {unsupportedVariables.length ? ` · ${copy.unsupportedTemplate}${unsupportedVariables.map(value => `{{${value}}}`).join(", ")}` : ""}
                  </SelectItem>;
                })}
              </SelectContent>
            </Select>
            {query.isLoading && <p className="text-xs text-muted-foreground">{copy.loading}</p>}
            {query.isError && <button type="button" className="text-xs text-destructive" onClick={() => query.refetch()}>{copy.templateError}</button>}
          </div>
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-xs font-medium"><Braces className="h-3.5 w-3.5" />{copy.variables}<Badge variant="secondary">{availableVariables.length}</Badge></div>
            <div className="flex flex-wrap gap-1.5">{availableVariables.map(variable => <Button key={variable.value} type="button" variant="outline" size="sm" className="h-7 font-mono text-[11px]" onClick={() => insertVariable(variable.value)} title={variable.label}>{`{{${clean(variable.value)}}}`}</Button>)}
              {!availableVariables.length && <span className="text-xs text-muted-foreground">—</span>}</div>
            {!!unsupported.length && <p role="alert" className="text-xs text-destructive" data-testid={`notify-user-unsupported-${index}`}><strong>{copy.unsupported}:</strong> {unsupported.map(value => `{{${value}}}`).join(", ")}</p>}
          </div>
          </div>
          <div className="order-1 min-w-0 space-y-4 md:order-1">
          <div className="space-y-1.5"><Label htmlFor={`notify-title-${index}`}>{copy.title}</Label>
            <Input id={`notify-title-${index}`} ref={node => { refs.current.title = node; }} value={draft.title} data-testid={`notify-user-title-${index}`}
              onFocus={event => { activeField.current = "title"; selections.current.title = { start: event.currentTarget.selectionStart || 0, end: event.currentTarget.selectionEnd || 0 }; }}
              onSelect={event => { selections.current.title = { start: event.currentTarget.selectionStart || 0, end: event.currentTarget.selectionEnd || 0 }; }}
              onChange={event => setDraft(previous => ({ ...previous, title: event.target.value }))} />
          </div>
          <div className="space-y-1.5"><Label htmlFor={`notify-message-${index}`}>{copy.message}</Label>
            <Textarea id={`notify-message-${index}`} rows={5} ref={node => { refs.current.message = node; }} value={draft.message} data-testid={`notify-user-message-${index}`}
              onFocus={event => { activeField.current = "message"; selections.current.message = { start: event.currentTarget.selectionStart || 0, end: event.currentTarget.selectionEnd || 0 }; }}
              onSelect={event => { selections.current.message = { start: event.currentTarget.selectionStart || 0, end: event.currentTarget.selectionEnd || 0 }; }}
              onChange={event => setDraft(previous => ({ ...previous, message: event.target.value }))} />
          </div>
           {(!draft.title.trim() || !draft.message.trim()) && <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            {!draft.title.trim() && <p className="text-xs text-destructive">{copy.titleRequired}</p>}
            {!draft.message.trim() && <p className="text-xs text-destructive">{copy.messageRequired}</p>}
           </div>}
          </div>
          </div>
        </div>
        <DialogFooter className="task-modern-modal-footer mt-0 gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>{copy.cancel}</Button>
          <Button type="button" onClick={save} disabled={!draft.title.trim() || !draft.message.trim() || unsupported.length > 0}
            data-testid={`notify-user-apply-${index}`}>{copy.apply}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
