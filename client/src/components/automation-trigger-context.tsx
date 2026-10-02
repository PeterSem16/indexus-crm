import * as React from "react";
import {
  AlertTriangle, Clock3, ClipboardList, Mail, MapPin,
  MessageSquareText, RefreshCw, UserPlus, Zap,
} from "lucide-react";
import type { Translations } from "@/i18n/translations";
import type { AutomationTriggerPreset } from "@/lib/automation-trigger-presets";

export const triggerPresetIcons = {
  newEmail: Mail,
  newSms: MessageSquareText,
  newCustomer: UserPlus,
  statusChange: RefreshCw,
  negativeSentiment: AlertTriangle,
  taskOverdue: Clock3,
  taskAssigned: ClipboardList,
} as const;

export function AutomationTriggerContext({ preset, copy }: {
  preset: AutomationTriggerPreset;
  copy: Translations["automationServices"]["triggerPresets"];
}) {
  const detail = copy.details[preset.id];
  const Icon = triggerPresetIcons[preset.id];

  return (
    <section className="rounded-lg border border-primary/25 bg-primary/[0.04] p-3 sm:p-4" data-testid={`trigger-context-${preset.id}`}>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        {copy.labels[preset.id]}
      </h3>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div className="flex gap-2 rounded-md border border-border/70 bg-background/80 p-2.5">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div><dt className="font-medium text-muted-foreground">{copy.sourceLabel}</dt>
            <dd className="mt-0.5 text-sm text-foreground">{detail.source}</dd></div>
        </div>
        <div className="flex gap-2 rounded-md border border-border/70 bg-background/80 p-2.5">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div><dt className="font-medium text-muted-foreground">{copy.whenLabel}</dt>
            <dd className="mt-0.5 text-sm text-foreground">{detail.when}</dd></div>
        </div>
      </dl>
    </section>
  );
}