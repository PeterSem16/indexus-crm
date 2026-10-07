import { CircleHelp } from "lucide-react";
import { useId } from "react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function AutomationRuleExecutionSettings({ rateLimit, enabled, disabled, onRateLimitChange, onEnabledChange }: {
  rateLimit: number | null; enabled: boolean; disabled?: boolean;
  onRateLimitChange: (value: number | null) => void; onEnabledChange: (value: boolean) => void;
}) {
  const { t } = useI18n();
  const copy = t.automationExecutionSettings;
  const id = useId();
  const help = (kind: "rate-limit" | "enabled", title: string, paragraphs: string[]) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0 p-0"
          aria-label={`${copy.help}: ${title}`} data-testid={`${kind}-help`}>
          <CircleHelp className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[10041] max-h-[70dvh] w-[min(360px,calc(100vw-2rem))] space-y-2 overflow-y-auto text-sm"
        align="start" data-testid={`${kind}-help-content`}>
        <h3 className="font-semibold">{title}</h3>
        {paragraphs.map((text, index) => <p key={index} className="leading-relaxed text-muted-foreground">{text}</p>)}
      </PopoverContent>
    </Popover>
  );
  return <>
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Label htmlFor={`${id}-limit`}>{copy.rateLimit}</Label>
        {help("rate-limit", copy.rateLimit, [copy.rateLimitDetails, copy.rateLimitExample, copy.rateLimitCount])}
      </div>
      <Input id={`${id}-limit`} type="number" value={rateLimit ?? ""} placeholder={copy.unlimited}
        aria-describedby={`${id}-limit-summary`} data-testid="input-rate-limit"
        onChange={event => onRateLimitChange(event.target.value ? Number(event.target.value) : null)} />
      <p id={`${id}-limit-summary`} className="text-xs leading-relaxed text-muted-foreground">{copy.rateLimitSummary}</p>
    </div>
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Switch id={`${id}-enabled`} checked={enabled} disabled={disabled} onCheckedChange={onEnabledChange}
          aria-describedby={`${id}-enabled-summary`} data-testid="switch-enabled" />
        <Label htmlFor={`${id}-enabled`}>{copy.enabled}</Label>
        {help("enabled", copy.enabled, [copy.enabledDetails])}
      </div>
      <p id={`${id}-enabled-summary`} className="text-xs leading-relaxed text-muted-foreground">{copy.enabledSummary}</p>
    </div>
  </>;
}
