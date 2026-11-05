import { useEffect, useState } from "react";
import { FolderOpen, Plus, ShieldCheck, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/I18nProvider";
import type { OmniMailboxGroup } from "@shared/omni-mailbox-groups";

interface Props {
  groups: OmniMailboxGroup[];
  mailboxes: { email: string; displayName?: string; type: string }[];
  onSave: (groups: OmniMailboxGroup[]) => Promise<void>;
}
export function OmniMailboxGroups({ groups, mailboxes, onSave }: Props) {
  const { t } = useI18n();
  const c = t.omniGroups;
  const [draft, setDraft] = useState(groups);
  const [name, setName] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setDraft(groups); }, [groups]);
  const dirty = JSON.stringify(groups) !== JSON.stringify(draft);
  const create = () => {
    if (!name.trim() || draft.length >= 30) return;
    setDraft([...draft, { id: crypto.randomUUID(), name: name.trim(), emails: [] }]); setName("");
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
      <div className="flex items-center gap-2 border-b p-3"><FolderOpen className="h-4 w-4 shrink-0" />
        <Input aria-label={c.name} value={group.name} maxLength={80} disabled={busy}
          onChange={e => setDraft(draft.map(g => g.id === group.id ? { ...g, name: e.target.value } : g))} />
        <span className="text-xs text-muted-foreground">{group.emails.length}</span>
        <Button size="icon" variant="ghost" disabled={busy} aria-label={`${c.remove}: ${group.name}`} onClick={() => setConfirmId(group.id)}><Trash2 className="h-4 w-4" /></Button>
      </div>
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
      <Button variant="outline" disabled={!dirty || busy} onClick={() => { setDraft(groups); setError(""); }}>{c.cancel}</Button>
      <Button disabled={!dirty || busy || draft.some(g => !g.name.trim())} onClick={async () => {
        setBusy(true); setError("");
        try { await onSave(draft); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
      }}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{c.save}</Button>
    </div>
  </section>;
}
