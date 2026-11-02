import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Mail, Search, UserRound, X } from "lucide-react";
import { missionEmailExternalAddressSchema } from "@shared/mission-email-schedule";

type User = { id: string; name: string; email: string };
type Copy = {
  internal: string; external: string; externalHint: string; addAddress: string; addressPlaceholder: string;
  invalidAddress: string; invalidAddresses: string; remove: string; selected: string; recipientLimit: string; externalLabel: string;
};
const inputClass = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const validEmail = { test: (email: string) => missionEmailExternalAddressSchema.safeParse(email).success };

export default function MissionEmailRecipientPicker({
  users, userIds, externalEmails, onUserIdsChange, onExternalEmailsChange, onValidityChange, search, onSearchChange, searchLabel, noUsers, copy,
}: {
  users: User[]; userIds: string[]; externalEmails: string[]; onUserIdsChange: (ids: string[]) => void;
  onExternalEmailsChange: (emails: string[]) => void; search: string; onSearchChange: (value: string) => void;
  searchLabel: string; noUsers: string; copy: Copy; onValidityChange: (valid: boolean) => void;
}) {
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState<string[]>([]);
  useEffect(() => { onValidityChange(!draft.trim() && !invalid.length); }, [draft, invalid, onValidityChange]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return users.filter(user => !needle || `${user.name} ${user.email}`.toLocaleLowerCase().includes(needle));
  }, [users, search]);
  const total = userIds.length + externalEmails.length;
  const addEmails = (raw: string) => {
    const tokens = raw.split(/[,\s;]+/).map(item => item.trim()).filter(Boolean);
    const accepted: string[] = [];
    const rejected: string[] = [];
    for (const token of tokens) {
      const email = token.toLocaleLowerCase();
      if (!validEmail.test(email)) rejected.push(token);
      else if (!externalEmails.includes(email) && !accepted.includes(email)) accepted.push(email);
    }
    const available = Math.max(0, 100 - total);
    onExternalEmailsChange([...externalEmails, ...accepted.slice(0, available)]);
    const overflow = accepted.slice(available);
    const remaining = [...new Set([...rejected, ...overflow])];
    setInvalid(remaining);
    setDraft(remaining.join("; "));
  };
  const addDraft = () => { if (draft.trim()) addEmails(draft); };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === "," || event.key === ";") {
      event.preventDefault();
      addDraft();
    }
  };
  const removeExternal = (email: string) => onExternalEmailsChange(externalEmails.filter(item => item !== email));
  return <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
    <section aria-labelledby="mission-internal-recipients" className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 id="mission-internal-recipients" className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">{copy.internal}</h3>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{userIds.length} {copy.selected}</span>
      </div>
      <label className="relative block">
        <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={event => onSearchChange(event.target.value)} aria-label={searchLabel} placeholder={searchLabel} className={`${inputClass} pl-9`} />
      </label>
      <div className="mt-2 max-h-52 overflow-y-auto overscroll-contain rounded-xl border border-border bg-background p-1.5" role="group" aria-label={copy.internal}>
        {filtered.map(user => {
          const checked = userIds.includes(user.id);
          const identity = `${user.name || user.email} ${user.name ? user.email : ""}`.trim();
          return <label key={user.id} className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${checked ? "bg-primary/8" : "hover:bg-muted/70"}`}>
            <input type="checkbox" data-testid={`mission-email-schedule-recipient-${user.id}`} aria-label={identity} checked={checked}
              onChange={event => onUserIdsChange(event.target.checked ? [...userIds, user.id] : userIds.filter(id => id !== user.id))}
              disabled={!checked && total >= 100} className="h-4 w-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><UserRound aria-hidden="true" className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{user.name || user.email}</span>
              {user.name && <span className="block truncate text-xs text-muted-foreground">{user.email}</span>}
            </span>
            {checked && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
          </label>;
        })}
        {!filtered.length && <p className="px-3 py-5 text-center text-xs text-muted-foreground">{noUsers}</p>}
      </div>
    </section>
    <section aria-labelledby="mission-external-recipients" className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 id="mission-external-recipients" className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">{copy.external}</h3>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">{externalEmails.length} {copy.selected}</span>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{copy.externalHint}</p>
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <Mail aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input data-testid="mission-email-external-input" type="text" inputMode="email" autoComplete="email" value={draft}
            onChange={event => { setDraft(event.target.value); if (!event.target.value.trim()) setInvalid([]); }} onKeyDown={onKeyDown} onPaste={event => {
              const text = event.clipboardData.getData("text");
              if (/[,;\s]/.test(text)) { event.preventDefault(); addEmails(text); }
            }} aria-label={copy.external} placeholder={copy.addressPlaceholder} className={`${inputClass} pl-9`} />
        </label>
        <button type="button" data-testid="mission-email-external-add" onClick={addDraft} disabled={!draft.trim() || total >= 100}
          className="shrink-0 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">{copy.addAddress}</button>
      </div>
      {invalid.length > 0 && <div role="alert" className="mt-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
        <p className="mb-1 text-xs font-semibold text-destructive">{copy.invalidAddresses}</p>
        <div className="flex flex-wrap gap-1.5">{invalid.map((item, index) => <span key={`${item}-${index}`} className="inline-flex max-w-full items-center gap-1 rounded-md border border-destructive/30 bg-background px-2 py-1 text-xs text-destructive">
          <span className="max-w-48 truncate">{item}</span><button type="button" aria-label={`${copy.remove} ${item}`} onClick={() => {
            setInvalid(items => items.filter((_, itemIndex) => itemIndex !== index));
            setDraft(value => value.split(/[,\s;]+/).filter(token => token && token !== item).join("; "));
          }} className="rounded p-0.5 hover:bg-destructive/10"><X className="h-3 w-3" /></button>
        </span>)}</div>
      </div>}
      {externalEmails.length > 0 && <div className="mt-3 flex flex-wrap gap-2" aria-label={copy.external}>
        {externalEmails.map(email => <span key={email} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/50 py-1 pl-3 pr-1 text-xs text-foreground">
          <Mail aria-hidden="true" className="h-3 w-3 shrink-0 text-muted-foreground" /><span className="max-w-48 truncate">{email}</span>
          <button type="button" aria-label={`${copy.remove} ${email}`} onClick={() => removeExternal(email)} className="rounded-full p-1 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X aria-hidden="true" className="h-3 w-3" /></button>
        </span>)}
      </div>}
      {total >= 100 && <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">{copy.recipientLimit}</p>}
    </section>
  </div>;
}
