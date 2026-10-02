import { Sparkles, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { AutomationEventDraftPanel } from "@/components/automation-event-draft-panel";

export function AutomationDraftAssistant() {
  const { t } = useI18n();
  const copy = t.automationDraft;
  return <Card data-testid="automation-draft-assistant" className="overflow-hidden border-primary/20">
    <CardHeader className="border-b bg-primary/[0.04]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary"><Sparkles className="h-4 w-4" /> {copy.assistantEyebrow}</p>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription className="mt-1">{copy.centralIntro}</CardDescription></div>
        <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> {copy.readOnlyBadge}</span>
      </div>
    </CardHeader>
    <CardContent className="space-y-4 p-4 sm:p-6">
      <AutomationEventDraftPanel />
      <div className="border-t pt-4">
        <p className="text-sm font-medium">{t.automationServices.statusList.heading}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t.automationServices.statusList.info}</p>
        <Link href="/campaigns" className="mt-2 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline">{t.automationServices.statusList.source}</Link>
      </div>
    </CardContent>
  </Card>;
}