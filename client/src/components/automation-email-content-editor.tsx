import { useRef, type ReactNode } from "react";
import { Code2, Eye, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Field = "subject" | "body";
type Selection = { start: number; end: number };
export type EmailEditorSelections = Record<Field, Selection>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: string;
  body: string;
  onChange: (patch: { subject?: string; body?: string }) => void;
  availableVariables: Array<{ value: string; label: string }>;
  activeField: Field;
  onActiveFieldChange: (field: Field) => void;
  selectionsRef: { current: EmailEditorSelections };
  rewriteArtworkForPreview: (html: string) => string;
  subjectRequired: string;
  bodyRequired: string;
  unsupportedWarning?: string;
  testId: string;
  templatePicker: ReactNode;
};

export function AutomationEmailContentEditor({
  open,
  onOpenChange,
  subject,
  body,
  onChange,
  availableVariables,
  activeField,
  onActiveFieldChange,
  selectionsRef,
  rewriteArtworkForPreview,
  subjectRequired,
  bodyRequired,
  unsupportedWarning,
  testId,
  templatePicker,
}: Props) {
  const { t } = useI18n();
  const copy = t.sendEmailEditor;
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const focusedFieldRef = useRef(activeField);
  const values: Record<Field, string> = { subject, body };

  const rememberSelection = (field: Field, target: HTMLInputElement | HTMLTextAreaElement) => {
    selectionsRef.current[field] = {
      start: target.selectionStart ?? target.value.length,
      end: target.selectionEnd ?? target.value.length,
    };
  };

  const insertVariable = (value: string) => {
    const field = activeField;
    const token = `{{${value.replace(/^{{\s*|\s*}}$/g, "").trim()}}}`;
    const current = values[field];
    const selection = selectionsRef.current[field];
    const start = Math.min(selection.start, current.length);
    const end = Math.min(selection.end, current.length);
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
    const caret = start + token.length;
    onChange({ [field]: next });
    selectionsRef.current[field] = { start: caret, end: caret };
    requestAnimationFrame(() => {
      // Do not steal focus if the user already moved to the other editor field.
      if (focusedFieldRef.current !== field) return;
      const target = field === "subject" ? subjectRef.current : bodyRef.current;
      target?.focus();
      target?.setSelectionRange(caret, caret);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        overlayClassName="z-[10029]"
        className="z-[10030] grid h-[min(900px,calc(100dvh-1.5rem))] w-[calc(100vw-1.5rem)] max-w-7xl grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden p-4 sm:p-6"
        data-testid={`${testId}-content-editor`}
        onInteractOutside={(event) => {
          // Keep the draft editor stable; users close it with Escape or the explicit button.
          event.preventDefault();
        }}
      >
        <DialogHeader className="relative pr-12 text-left">
          <div className="flex items-center gap-2 text-primary">
            <span className="rounded-md bg-primary/10 p-2"><Code2 className="h-4 w-4" /></span>
            <DialogTitle>{copy.title}</DialogTitle>
          </div>
          <DialogDescription>{copy.description}</DialogDescription>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-8 w-8 shrink-0 rounded-full p-0"
            aria-label={t.common.close}
            title={t.common.close}
            onClick={() => onOpenChange(false)}
            data-testid={`${testId}-editor-close`}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="grid min-h-0 auto-rows-max grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
          <section className="flex h-fit min-h-[480px] min-w-0 flex-col gap-3 rounded-lg border bg-muted/10 p-3 sm:p-4 lg:h-full lg:min-h-0 lg:overflow-y-auto" aria-label={copy.htmlSource}>
            <div className="shrink-0">{templatePicker}</div>
            <div className="shrink-0 space-y-1.5">
              <Label htmlFor={`${testId}-editor-subject`}>{t.sendEmailAction.subject}</Label>
              <Input
                ref={subjectRef}
                id={`${testId}-editor-subject`}
                value={subject}
                aria-invalid={!subject.trim()}
                onFocus={() => {
                  focusedFieldRef.current = "subject";
                  onActiveFieldChange("subject");
                }}
                onChange={(event) => {
                  rememberSelection("subject", event.currentTarget);
                  onChange({ subject: event.target.value });
                }}
                onSelect={(event) => rememberSelection("subject", event.currentTarget)}
                onClick={(event) => rememberSelection("subject", event.currentTarget)}
                onKeyUp={(event) => rememberSelection("subject", event.currentTarget)}
                data-testid={`${testId}-editor-subject`}
              />
              {!subject.trim() && <p role="alert" className="text-xs text-destructive">{subjectRequired}</p>}
            </div>
            <div className="flex min-h-[320px] flex-1 flex-col gap-1.5">
              <Label htmlFor={`${testId}-editor-body`}>{copy.htmlSource}</Label>
              <Textarea
                ref={bodyRef}
                id={`${testId}-editor-body`}
                value={body}
                aria-invalid={!body.trim()}
                className="min-h-[280px] flex-1 resize-y font-mono text-xs leading-5"
                onChange={(event) => {
                  rememberSelection("body", event.currentTarget);
                  onChange({ body: event.target.value });
                }}
                onFocus={() => {
                  focusedFieldRef.current = "body";
                  onActiveFieldChange("body");
                }}
                onSelect={(event) => rememberSelection("body", event.currentTarget)}
                onClick={(event) => rememberSelection("body", event.currentTarget)}
                onKeyUp={(event) => rememberSelection("body", event.currentTarget)}
                data-testid={`${testId}-editor-body`}
              />
              {!body.trim() && <p role="alert" className="text-xs text-destructive">{bodyRequired}</p>}
            </div>
            {unsupportedWarning && <p role="alert" className="text-xs text-destructive">{unsupportedWarning}</p>}
            {availableVariables.length > 0 && (
              <div className="shrink-0 space-y-2 border-t pt-3">
                <div>
                  <p className="text-xs font-semibold">{copy.variables}</p>
                  <p className="text-xs text-muted-foreground">{copy.variableHelp}</p>
                </div>
                <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                  {availableVariables.map((variable) => (
                    <Button
                      key={variable.value}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertVariable(variable.value)}
                      data-testid={`${testId}-editor-variable-${variable.value.replace(/^{{\s*|\s*}}$/g, "").trim()}`}
                    >
                      {variable.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <p className="shrink-0 text-xs text-muted-foreground">{copy.draftHint}</p>
          </section>

          <section className="flex min-h-[320px] min-w-0 flex-col rounded-lg border bg-muted/10 p-3 sm:p-4 lg:min-h-0" aria-label={copy.livePreview}>
            <div className="mb-3 flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">{copy.livePreview}</h3>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-md border bg-background">
              <iframe
                title={copy.livePreview}
                sandbox=""
                srcDoc={rewriteArtworkForPreview(body)}
                className="h-full w-full"
                data-testid={`${testId}-editor-preview`}
              />
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
