import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AutomationEditorCopy } from "@/i18n/automation-editor-help-translations";

export function AutomationStepHelp({ step, copy }: { step: "when" | "if" | "then" | "notify" | "call" | "webhook"; copy: AutomationEditorCopy }) {
  const title = copy[`${step}Title`];
  const paragraphs = copy[step];
  return <Popover>
    <PopoverTrigger asChild>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
        aria-label={`${copy.help}: ${title}`} data-testid={`automation-${step}-help`}>
        <CircleHelp className="h-4 w-4" />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="z-[10041] max-h-[70dvh] w-[min(380px,calc(100vw-2rem))] space-y-2 overflow-y-auto text-sm"
      align="start" data-testid={`automation-${step}-help-content`}>
      <h3 className="font-semibold">{title}</h3>
      {paragraphs.map((paragraph, index) => <p key={index} className="leading-relaxed text-muted-foreground">{paragraph}</p>)}
    </PopoverContent>
  </Popover>;
}
