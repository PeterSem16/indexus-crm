import { useEffect, useState } from "react";
import { FolderOpen, Plus, ShieldCheck, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n/I18nProvider";
import type { OmniMailboxGroup } from "@shared/omni-mailbox-groups";
import { AccountIcon, getAccountIcons } from "./nexus-sidebar";
import { OmniGroupMark } from "./omni-group-mark";
import { defaultOmniGroupReplyTemplate, effectiveOmniGroupReplyTemplate } from "./omni-reply-template";

interface Props {
  groups: OmniMailboxGroup[];
  mailboxes: { email: string; displayName?: string; type: string }[];
  onSave: (groups: OmniMailboxGroup[]) => Promise<void>;
}
export function OmniMailboxGroups({ groups, mailboxes, onSave }: Props) {
  const { t } = useI18n();
  const c = t.omniGroups;
  const templateCopy = { replySubjectDefault: c.replySubjectDefault, replyBodyDefault: c.replyBodyDefault };
  const [draft, setDraft] = useState(() => groups.map(group => ({
    ...group,
    replyTemplate: effectiveOmniGroupReplyTemplate(group, templateCopy),
  })));
  const [name, setName] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setDraft(groups.map(group => ({
      ...group,
      replyTemplate: effectiveOmniGroupReplyTemplate(group, templateCopy),
    })));
  }, [groups, c.replySubjectDefault, c.replyBodyDefault]);
  const comparableGroups = groups.map(group => ({
    ...group,
    replyTemplate: effectiveOmniGroupReplyTemplate(group, templateCopy),
  }));
  const dirty = JSON.stringify(comparableGroups) !== JSON.stringify(draft);
  const updateGroup = (groupId: string, update: Partial<OmniMailboxGroup>) =>
    setDraft(current => current.map(group => group.id === groupId ? { ...group, ...update } : group));
  const updateTemplate = (groupId: string, update: Partial<NonNullable<OmniMailboxGroup["replyTemplate"]>>) =>
    setDraft(current => current.map(group => group.id === groupId ? {
      ...group,
      replyTemplate: { ...effectiveOmniGroupReplyTemplate(group, templateCopy), ...update },
    } : group));
  const renameGroup = (groupId: string, nextName: string) =>
    setDraft(current => current.map(group => {
      if (group.id !== groupId) return group;
      const template = effectiveOmniGroupReplyTemplate(group, templateCopy);
      const wasDefaultSubject = template.subject === defaultOmniGroupReplyTemplate(group.name, templateCopy).subject;
      return {
        ...group,
        name: nextName,
        replyTemplate: {
          ...template,
          ...(wasDefaultSubject ? { subject: defaultOmniGroupReplyTemplate(nextName, templateCopy).subject } : {}),
        },
      };
    }));
  const invalidTemplate = (group: OmniMailboxGroup) => {
    const template = effectiveOmniGroupReplyTemplate(group, templateCopy);
    return !template.subject.trim() || /[\r\n]/.test(template.subject) || template.subject.length > 200 ||
      template.body.length > 20000;
  };
  const create = () => {
    if (!name.trim() || draft.length >= 30) return;
    const groupName = name.trim();
    setDraft([...draft, {
      id: crypto.randomUUID(), name: groupName, emails: [],
      replyTemplate: defaultOmniGroupReplyTemplate(groupName, templateCopy),
    }]); setName("");
  };
  return <section className="omni-group-editor" aria-label={c.title}>
    <header><FolderOpen className="h-5 w-5" /><div><h3>{c.title}</h3><p>{c.description}</p></div></header>
    <div className="flex gap-2">
      <Input aria-label={c.name} placeholder={c.name} value={name} maxLength={80} disabled={busy}
        onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); create(); } }} />
      <Button type="button" variant="outline" disabled={busy || !name.trim() || draft.length >= 30} onClick={create}><Plus className="h-4 w-4 mr-1" />{c.create}</Button>
    </div>
    {draft.length >= 30 && <p>{c.maxGroups}</p>}
    {!draft.length && <p className="py-3 text-sm text-muted-foreground">{c.empty}</p>}
    {draft.map(group => <div className="omni-group-card" key={group.id}>
      <div className="flex items-center gap-2 border-b p-3"><OmniGroupMark group={group} />
        <Input aria-label={c.name} value={group.name} maxLength={80} disabled={busy}
          onChange={e => renameGroup(group.id, e.target.value)} />
        <span className="text-xs text-muted-foreground">{group.emails.length}</span>
        <Button size="icon" variant="ghost" disabled={busy} aria-label={`${c.remove}: ${group.name}`} onClick={() => setConfirmId(group.id)}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <div className="omni-group-palette" role="group" aria-label={c.groupIcon}>
        {getAccountIcons(t).map(icon => <button key={icon.key} type="button" disabled={busy} title={icon.label}
          aria-label={icon.label} aria-pressed={(group.icon || "users") === icon.key} onClick={() => updateGroup(group.id, { icon: icon.key })}>
          <AccountIcon iconKey={icon.key} className="h-4 w-4" />
        </button>)}
      </div>
      <div className="omni-group-palette" role="group" aria-label={c.groupColor}>
        {["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#0EA5E9", "#14B8A6", "#F97316", "#6366F1", "#84CC16", "#6B7280"].map(color =>
          <button type="button" key={color} disabled={busy} aria-label={`${c.groupColor} ${color}`} aria-pressed={group.color?.toLowerCase() === color.toLowerCase()}
            style={{ backgroundColor: color }} onClick={() => updateGroup(group.id, { color })} />)}
        <input type="color" aria-label={c.groupColor} disabled={busy} value={group.color || "#346B61"}
          onChange={e => updateGroup(group.id, { color: e.target.value })} />
      </div>
      {(() => {
        const template = effectiveOmniGroupReplyTemplate(group, templateCopy);
        return <div className="space-y-3 border-t px-3 py-3">
          <div>
            <h4 className="text-sm font-semibold">{c.replyTemplateTitle}</h4>
            <p className="mt-0.5 text-xs text-muted-foreground">{c.replyTemplateDescription}</p>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">{c.subject}</span>
            <Input data-testid={`group-template-subject-${group.id}`} aria-label={c.subject} maxLength={200} disabled={busy} value={template.subject}
              onChange={event => updateTemplate(group.id, { subject: event.target.value.replace(/[\r\n]/g, "") })} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">{c.body}</span>
            <Textarea data-testid={`group-template-body-${group.id}`} aria-label={c.body} maxLength={20000} disabled={busy} rows={3} value={template.body}
              onChange={event => updateTemplate(group.id, { body: event.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input data-testid={`group-template-include-signature-${group.id}`} type="checkbox" disabled={busy} checked={template.includeSignature}
              onChange={event => updateTemplate(group.id, { includeSignature: event.target.checked })} />
            <span>{c.includeSignature}</span>
          </label>
        </div>;
      })()}
      {confirmId === group.id && <div className="p-3 bg-muted text-sm" role="alert">
        <p>{c.deleteQuestion}</p><div className="flex gap-2 mt-2">
          <Button size="sm" variant="destructive" disabled={busy} onClick={() => { setDraft(draft.filter(g => g.id !== group.id)); setConfirmId(null); }}>{c.confirm}</Button>
          <Button size="sm" variant="outline" onClick={() => setConfirmId(null)}>{c.cancel}</Button>
        </div>
      </div>}
      <div className="p-2">{mailboxes.map(mailbox => {
        const email = mailbox.email.toLowerCase();
        return <label key={email} className="omni-group-account">
          <input type="checkbox" disabled={busy} checked={group.emails.includes(email)} onChange={e => setDraft(draft.map(g => g.id !== group.id ? g : {
            ...g, emails: e.target.checked ? [...g.emails, email] : g.emails.filter(item => item !== email),
          }))} />
          <span className="min-w-0"><strong>{mailbox.displayName || mailbox.email}</strong><small>{mailbox.email}</small></span>
          <span className="ml-auto text-xs text-muted-foreground">{mailbox.type === "personal" ? t.nexusOmni.settings.personal : t.nexusOmni.settings.shared}</span>
        </label>;
      })}</div>
    </div>)}
    <p className="flex gap-2 text-xs text-muted-foreground my-3"><ShieldCheck className="h-4 w-4 shrink-0" />{c.access}</p>
    {error && <p role="alert" className="text-sm text-destructive mb-2">{error}</p>}
    <div className="flex justify-end gap-2">
      <Button variant="outline" disabled={!dirty || busy} onClick={() => { setDraft(comparableGroups); setError(""); }}>{c.cancel}</Button>
      <Button disabled={!dirty || busy || draft.some(g => !g.name.trim() || invalidTemplate(g))} onClick={async () => {
        setBusy(true); setError("");
        try { await onSave(draft); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
      }}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{c.save}</Button>
    </div>
  </section>;
}
