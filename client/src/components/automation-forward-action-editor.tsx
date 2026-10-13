import { useEffect } from "react";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select";
import { useI18n } from "../i18n";
import { getForwardCopy } from "../i18n/automation-forward-copy";
import { forwardActionIssues } from "../../../shared/automation-forward-action";
import { Checkbox } from "./ui/checkbox";
type Props = { config: any; onChange: (config: any) => void;
  users: { id: string; fullName: string; email: string }[];
  taskGroups: { id: string; name: string; displayAlias?: string | null; isBackOffice?: boolean }[];
  onDraftValidityChange?: (invalid: boolean) => void };
export function AutomationForwardActionEditor({ config, onChange, users, taskGroups, onDraftValidityChange }: Props) {
  const { locale, t } = useI18n();
  const copy = getForwardCopy(locale);
  const invalid = forwardActionIssues(config).length > 0;
  useEffect(() => { onDraftValidityChange?.(invalid); }, [invalid, onDraftValidityChange]);
  useEffect(() => () => onDraftValidityChange?.(false), [onDraftValidityChange]);
  const change = (key: string, value: string) => onChange({ ...config, [key]: value });
  return <div className="space-y-3 text-xs" data-testid="forward-message-editor">
    <p className="text-muted-foreground leading-relaxed">{copy.help}</p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="space-y-1"><Label>{copy.destination}</Label>
        <Select value={config.destination} onValueChange={destination => {
          const { to: _to, userId: _user, taskGroupId: _group, ...rest } = config;
          if (destination === "email") {
            const { matchSender: _matchSender, ...withoutMatchSender } = rest;
          onChange({ ...(destination === "email" ? withoutMatchSender : rest), destination });
          } else {
            onChange({ ...rest, destination });
          }
        }}><SelectTrigger aria-label={copy.destination}><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="back_office">{copy.backOffice}</SelectItem>
          <SelectItem value="user">{copy.user}</SelectItem><SelectItem value="email">{copy.email}</SelectItem>
        </SelectContent></Select>
      </div>
      {config.destination !== "email" && <label className="flex items-center gap-2 text-xs">
        <Checkbox checked={config.matchSender === true} onCheckedChange={checked => onChange({ ...config, matchSender: checked === true })} />
        <span>{t.forwardReview.matchSenderOption}</span>
      </label>}
      <div className="space-y-1"><Label>{copy.mode}</Label>
        <Select value={config.mode} onValueChange={value => change("mode", value)}>
          <SelectTrigger aria-label={copy.mode}><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="whole">{copy.whole}</SelectItem><SelectItem value="attachments">{copy.attachments}</SelectItem>
          </SelectContent></Select></div>
      <div className="space-y-1"><Label>{copy.choose}</Label>
        {config.destination === "email" ? <Input aria-label={copy.email} value={config.to || ""} onChange={event => change("to", event.target.value)} placeholder="office@example.com" />
          : <Select value={(config.destination === "user" ? config.userId : config.taskGroupId) || "__empty__"}
            onValueChange={value => change(config.destination === "user" ? "userId" : "taskGroupId", value)}>
            <SelectTrigger aria-label={copy.choose}><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="__empty__" disabled>{copy.choose}</SelectItem>
              {config.destination === "user" ? users.map(user => <SelectItem key={user.id} value={user.id}>{user.fullName} · {user.email}</SelectItem>)
                : taskGroups.filter(group => group.isBackOffice).map(group => <SelectItem key={group.id} value={group.id}>{group.displayAlias || group.name}</SelectItem>)}
            </SelectContent></Select>}
      </div>
      {config.mode === "attachments" && <div className="space-y-1"><Label>{copy.selection}</Label>
        <Select value={config.selection} onValueChange={value => change("selection", value)}>
          <SelectTrigger aria-label={copy.selection}><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="invoice">{copy.invoice}</SelectItem><SelectItem value="all">{copy.all}</SelectItem>
          </SelectContent></Select></div>}
    </div>
    <p className="text-muted-foreground">{copy.original}</p>
    {invalid && <p role="status" className="text-destructive">{copy.invalid}</p>}
  </div>;
}
