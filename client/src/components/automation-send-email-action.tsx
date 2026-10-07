import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Mail, Plus, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Target = { kind: "user" | "group" | "role"; id: string };
type UserOption = { id: string; fullName: string; email: string };
type GroupOption = { id: string; name: string; displayAlias?: string | null };
type RoleOption = { id: string; name: string; isActive?: boolean };
type EmailTemplate = {
  id: string; name: string; language?: string; subject?: string; content?: string; contentHtml?: string;
  countryCodes?: string[];
};
type Mailbox = { connected: boolean; email?: string; displayName?: string; hasSignature?: boolean };
const rewriteArtworkForPreview = (html: string) => html.replace(
  /cid:indexus-automation-(task|attention|success|deadline)/gi,
  (_match, artwork: string) => `/api/automation/email-artwork/${artwork.toLowerCase()}`,
);

export function AutomationSendEmailAction({
  config, onChange, users, groups, roles, countryCodes, ruleId, availableVariables, recipientTemplates, testId,
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
}) {
  const { t } = useI18n();
  const copy = t.sendEmailAction;
  const [addressDraft, setAddressDraft] = useState<Record<string, string>>({});
  const [activeField, setActiveField] = useState<"subject" | "body">("body");
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
  const targetsFor = (field: "to" | "cc" | "bcc"): Target[] => {
    const key = `${field}Targets`;
    const targets = Array.isArray(config[key]) ? config[key] : [];
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
    onChange(next);
  };
  const templates = useMemo(() => (templatesQuery.data || []).filter((template) => {
    const countries = template.countryCodes || [];
    return !countries.length || !countryCodes.length || countries.some((code) => countryCodes.includes(code));
  }), [templatesQuery.data, countryCodes]);
  const addTarget = (field: "to" | "cc" | "bcc", value: string) => {
    if (!value) return;
    const [kind, ...parts] = value.split(":");
    const id = parts.join(":");
    const current = targetsFor(field);
    update({ [`${field}Targets`]: current.some((item) => item.kind === kind && item.id === id) ? current : [...current, { kind, id }] });
  };
  const removeTarget = (field: "to" | "cc" | "bcc", target: Target) =>
    update({ [`${field}Targets`]: targetsFor(field).filter((item) => item.kind !== target.kind || item.id !== target.id) });
  const targetLabel = (target: Target) => target.kind === "user"
    ? users.find((item) => item.id === target.id)?.fullName || target.id
    : target.kind === "group"
      ? groups.find((item) => item.id === target.id)?.displayAlias || groups.find((item) => item.id === target.id)?.name || target.id
      : roles.find((item) => item.name === target.id)?.name || target.id;
  const options = (field: "to" | "cc" | "bcc") => [
    ...users.map((item) => ({ value: `user:${item.id}`, label: `${item.fullName} · ${item.email}` })),
    ...groups.map((item) => ({ value: `group:${item.id}`, label: `${item.displayAlias || item.name} · ${copy.group}` })),
    ...roles.filter((item) => item.isActive !== false).map((item) => ({ value: `role:${item.name}`, label: `${item.name} · ${copy.role}` })),
  ];
  const recipientVariables = new Set(recipientTemplates.map((item) => item.replace(/^{{|}}$/g, "")));
  const hasInvalidRecipientVariable = (field: "to" | "cc" | "bcc") => {
    const matcher = /{{\s*([^{}]+?)\s*}}/g;
    const value = String(config[field] ?? "");
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(value)) !== null) if (!recipientVariables.has(match[1].trim())) return true;
    return false;
  };
  const mailbox = mailboxQuery.data;
  const insertVariable = (value: string) => {
    const field = activeField;
    update({ [field]: `${String(config[field] ?? "")}${config[field] ? " " : ""}{{${value.replace(/^{{|}}$/g, "")}}}` });
  };
  const addAddresses = (field: "to" | "cc" | "bcc") => {
    const draft = (addressDraft[field] || "").trim();
    if (!draft) return;
    const current = String(config[field] || "").split(/[;,]/).map((item: string) => item.trim()).filter(Boolean);
    update({ [field]: Array.from(new Set([...current, ...draft.split(/[;,\s]+/).map((item) => item.trim()).filter(Boolean)])).join(", ") });
    setAddressDraft((previous) => ({ ...previous, [field]: "" }));
  };
  const recipientField = (field: "to" | "cc" | "bcc", title: string) => (
    <section className="space-y-2 rounded-lg border bg-background/70 p-3" key={field}>
      <div className="flex items-center justify-between">
        <Label>{title}</Label>
        <Badge variant="outline">{targetsFor(field).length} {copy.targets}</Badge>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {targetsFor(field).map((target) => <Badge key={`${target.kind}:${target.id}`} variant="secondary" className="gap-1">
          <span>{targetLabel(target)}</span><button type="button" aria-label={`${copy.remove} ${targetLabel(target)}`} onClick={() => removeTarget(field, target)}><X className="h-3 w-3" /></button>
        </Badge>)}
      </div>
      <div className="flex gap-2">
        <Select value="" onValueChange={(value) => addTarget(field, value)}>
          <SelectTrigger className="h-9 min-w-0 flex-1 text-xs"><SelectValue placeholder={copy.addRecipient} /></SelectTrigger>
          <SelectContent className="max-h-64">
            {options(field).map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input aria-label={copy.directAddresses} value={addressDraft[field] || ""} className="h-9 min-w-0 flex-1 text-xs"
          placeholder={copy.addressPlaceholder} onChange={(event) => setAddressDraft((previous) => ({ ...previous, [field]: event.target.value }))}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addAddresses(field); } }} />
        <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => addAddresses(field)} aria-label={copy.addAddress}><Plus className="h-4 w-4" /></Button>
      </div>
      <Input aria-label={copy.directAddresses} className="h-8 text-xs" value={config[field] ?? ""}
        placeholder={copy.directAddresses} onChange={(event) => update({ [field]: event.target.value })} />
      {recipientTemplates.length > 0 && <div className="flex flex-wrap gap-1">
        {recipientTemplates.map((variable) => <Button key={variable} type="button" size="sm" variant="ghost" className="h-6 px-1.5 font-mono text-[10px]"
          onClick={() => update({ [field]: `${String(config[field] || "")}${config[field] ? ", " : ""}{{${variable}}}` })}>{`{{${variable}}}`}</Button>)}
      </div>}
      {hasInvalidRecipientVariable(field) && <p className="text-xs text-destructive">{copy.unsupportedVariables}</p>}
    </section>
  );
  const personal = mailbox?.personal;
  const selectedSystem = mailbox?.system?.filter((item) => countryCodes.includes(item.countryCode)) || [];
  return <section className="space-y-4" data-testid={testId}>
    <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
      <span className="rounded-md bg-primary/10 p-2 text-primary"><Mail className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><strong className="text-sm">{copy.heading}</strong><p className="text-xs text-muted-foreground">{copy.description}</p></div>
      {mailboxQuery.isLoading ? <span className="text-xs text-muted-foreground">{copy.loading}</span>
        : mailboxQuery.isError ? <button type="button" className="text-xs text-destructive" onClick={() => mailboxQuery.refetch()}>{copy.retry}</button> : null}
    </div>
    {(["to", "cc", "bcc"] as const).map((field) => recipientField(field, field.toUpperCase()))}
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
    <div className="space-y-1.5">
      <Label>{copy.template}</Label>
      <Select value={config.templateId || "__custom"} onValueChange={(value) => {
        if (value === "__custom") {
          update({ templateId: undefined, templateSnapshot: undefined, templateName: undefined, templateLanguage: undefined });
          return;
        }
        const template = templates.find((item) => item.id === value);
        if (!template) return;
        update({
          templateId: template.id, templateSnapshot: true, templateName: template.name, templateLanguage: template.language,
          subject: template.subject ?? "", body: template.contentHtml ?? template.content ?? "",
        });
      }}>
        <SelectTrigger><SelectValue placeholder={copy.chooseTemplate} /></SelectTrigger><SelectContent>
          <SelectItem value="__custom">{copy.customText}</SelectItem>
          {config.templateId && !templates.some((item) => item.id === config.templateId) &&
            <SelectItem value={config.templateId}>{config.templateName || copy.savedSnapshot}</SelectItem>}
          {templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}{template.language ? ` · ${template.language}` : ""}</SelectItem>)}
        </SelectContent>
      </Select>
      {templatesQuery.isError && <button type="button" className="text-xs text-destructive" onClick={() => templatesQuery.refetch()}>{copy.templatesError}</button>}
    </div>
    <div className="space-y-3">
      <div><Label htmlFor={`${testId}-subject`}>{copy.subject}</Label><Input id={`${testId}-subject`} required aria-invalid={!String(config.subject ?? "").trim()} value={config.subject ?? ""} onFocus={() => setActiveField("subject")} onChange={(event) => update({ subject: event.target.value })} />
        {!String(config.subject ?? "").trim() && <p className="mt-1 text-xs text-destructive">{copy.subjectRequired}</p>}</div>
      <div><Label htmlFor={`${testId}-body`}>{copy.body}</Label><Textarea id={`${testId}-body`} required aria-invalid={!String(config.body ?? "").trim()} rows={6} value={config.body ?? ""} onFocus={() => setActiveField("body")} onChange={(event) => update({ body: event.target.value })} />
        {!String(config.body ?? "").trim() && <p className="mt-1 text-xs text-destructive">{copy.bodyRequired}</p>}</div>
      {(() => {
        const supported = new Set(availableVariables.map((item) => item.value.replace(/^{{|}}$/g, "")));
        const allText = `${String(config.subject ?? "")}\n${String(config.body ?? "")}`;
        const used: string[] = [];
        const matcher = /{{\s*([^{}]+?)\s*}}/g;
        let match: RegExpExecArray | null;
        while ((match = matcher.exec(allText)) !== null) used.push(match[1].trim());
        const unsupported = Array.from(new Set(used.filter((variable) => !supported.has(variable))));
        return unsupported.length ? <p className="text-xs text-destructive">{copy.unsupportedVariables}: {unsupported.map((item) => `{{${item}}}`).join(", ")}</p> : null;
      })()}
      {availableVariables.length > 0 && <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{copy.insertVariable}</p>
        <div className="flex flex-wrap gap-1.5">{availableVariables.map((variable) => <Button key={variable.value} type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => insertVariable(variable.value)}>{variable.label}</Button>)}</div>
      </div>}
      {recipientTemplates.length > 0 && <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{copy.recipientVariables}</p>
        <div className="flex flex-wrap gap-1.5">{recipientTemplates.map((variable) => <Badge key={variable} variant="outline" className="font-mono">{`{{${variable}}}`}</Badge>)}</div>
      </div>}
      <details className="rounded-lg border bg-muted/20 p-3">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium"><ChevronDown className="h-4 w-4" />{copy.preview}</summary>
        <div className="mt-3 rounded-md border bg-background p-2">
          <iframe title={copy.preview} sandbox="" srcDoc={rewriteArtworkForPreview(String(config.body ?? ""))} className="h-56 w-full rounded" />
        </div>
      </details>
    </div>
  </section>;
}

function MailboxStatus({ copy, mailbox, loading }: { copy: any; mailbox?: Mailbox; loading: boolean }) {
  if (loading) return <p className="text-xs text-muted-foreground">{copy.loading}</p>;
  if (!mailbox?.connected) return <p className="text-xs text-destructive">{copy.notReady}</p>;
  return <p className="flex items-center gap-1.5 text-xs text-emerald-700"><Check className="h-3.5 w-3.5" />{mailbox.displayName || mailbox.email || copy.ready}{mailbox.email ? ` · ${mailbox.email}` : ""}</p>;
}
