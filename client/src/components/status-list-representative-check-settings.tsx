import type { Locale } from "@/i18n";
import type { RepresentativeCheckConfig } from "@shared/status-list-representative-check";
import { getRepresentativeCheckCopy } from "@/i18n/status-list-representative-check-copy";
import { getBackgroundActionCopy } from "./status-list-background-action-copy";
import { Switch } from "@/components/ui/switch";

export function StatusListRepresentativeCheckSettings({
  config,
  onChange,
  locale,
  disabled = false,
}: {
  config: RepresentativeCheckConfig;
  onChange: (next: RepresentativeCheckConfig) => void;
  locale: Locale | string;
  disabled?: boolean;
}) {
  const copy = getRepresentativeCheckCopy(locale);
  return (
    <fieldset className="space-y-4 rounded-xl border border-blue-200/80 bg-blue-50/55 p-3 text-blue-950 dark:border-blue-800/60 dark:bg-blue-950/20 dark:text-blue-100 sm:p-4" data-testid="representative-check-settings">
      <legend className="px-1 text-sm font-semibold">{copy.title}</legend>
      <div className="flex items-start gap-3">
        <Switch
          id="representative-check-enabled"
          data-testid="representative-check-enabled"
          checked={config.enabled}
          disabled={disabled}
          onCheckedChange={enabled => onChange({ ...config, enabled })}
          aria-label={copy.enabled}
        />
        <div className="min-w-0">
          <label htmlFor="representative-check-enabled" className="cursor-pointer text-sm font-semibold">{copy.enabled}</label>
          <p className="mt-1 text-xs leading-relaxed text-blue-900/75 dark:text-blue-100/75">{copy.enabledHelp}</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-semibold">
          <span>{copy.triggerLabel}</span>
          <select data-testid="representative-check-trigger" className="h-9 min-w-0 rounded-md border border-blue-300/70 bg-background px-2 text-sm font-normal text-foreground dark:border-blue-800" value={config.trigger} disabled={disabled || !config.enabled} onChange={event => onChange({ ...config, trigger: event.target.value as RepresentativeCheckConfig["trigger"] })}>
            <option value="pulse_open">{copy.trigger.pulse_open}</option>
            <option value="card_open">{copy.trigger.card_open}</option>
            <option value="background_change">{copy.trigger.background_change}</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-semibold">
          <span>{copy.behaviorLabel}</span>
          <select data-testid="representative-check-behavior" className="h-9 min-w-0 rounded-md border border-blue-300/70 bg-background px-2 text-sm font-normal text-foreground dark:border-blue-800" value={config.behavior} disabled={disabled || !config.enabled} onChange={event => onChange({ ...config, behavior: event.target.value as RepresentativeCheckConfig["behavior"] })}>
            <option value="information">{copy.behavior.information}</option>
            <option value="confirm">{copy.behavior.confirm}</option>
            <option value="automatic">{copy.behavior.automatic}</option>
          </select>
        </label>
      </div>
      <p className="rounded-md border-l-2 border-blue-500/60 bg-background/65 px-3 py-2 text-xs leading-relaxed">{copy.scope}</p>
      {config.behavior !== "information" && <div className="rounded-lg border bg-background/70 p-3">
        <label className="flex items-center gap-2 text-xs font-medium"><Switch data-testid="representative-check-assigned-actions" checked={config.assignedActions === true}
          disabled={disabled || !config.enabled} onCheckedChange={value=>onChange({...config,assignedActions:value})}/>{getBackgroundActionCopy(locale).assigned}</label>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{getBackgroundActionCopy(locale).assignedHelp}</p>
      </div>}
      <div className="grid gap-2 sm:grid-cols-2" aria-label={copy.previewTitle}>
        <div className="rounded-lg border border-blue-200/80 bg-blue-100/65 px-3 py-2 text-xs leading-relaxed text-blue-950 dark:border-blue-800/60 dark:bg-blue-900/30 dark:text-blue-100">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide opacity-65">{copy.previewTitle}</span>
          {config.assignedActions ? getBackgroundActionCopy(locale).assignedHelp : copy.assignedPreview}
        </div>
        <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-100">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide opacity-65">{copy.previewTitle}</span>
          {copy.unassignedPreview}
        </div>
      </div>
      {config.behavior !== "information" && (
        <div className="rounded-lg border border-border/70 bg-background/70 p-3 text-xs leading-relaxed">
          <h5 className="font-semibold">{config.assignedActions ? getBackgroundActionCopy(locale).title : copy.actionsTitle}</h5>
          {config.assignedActions ? <p className="mt-2 text-muted-foreground">{getBackgroundActionCopy(locale).assignedHelp}</p> : <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-muted-foreground">
            {copy.actionSteps.map(step => <li key={step}>{step}</li>)}
          </ol>}
          <p className="mt-2 border-t border-border/60 pt-2 text-muted-foreground">{copy.reopening}</p>
        </div>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">{copy.hiddenIndependent}</p>
    </fieldset>
  );
}
