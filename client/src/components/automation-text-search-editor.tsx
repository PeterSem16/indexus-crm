import { useEffect, useMemo, useState } from "react";
import type { TextSearchConfig } from "../../../shared/automation-text-search";
import { useI18n } from "../i18n";
import { getTextSearchCopy } from "../i18n/automation-text-search-copy";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";

type Props = {
  value?: TextSearchConfig;
  onChange: (value: TextSearchConfig | undefined) => void;
  attachmentsEnabled: boolean;
  contentEnabled: boolean;
};

export function AutomationTextSearchEditor({ value, onChange, attachmentsEnabled, contentEnabled }: Props) {
  const { locale } = useI18n();
  const copy = getTextSearchCopy(locale);
  const enabled = !!value;
  const terms = value?.terms ?? [];
  const serializedTerms = terms.join("\n");
  const [termsText, setTermsText] = useState(serializedTerms);
  // Preserve a just-typed trailing newline so users can enter the next term.
  useEffect(() => { setTermsText(serializedTerms); }, [serializedTerms, enabled]);

  const errors = useMemo(() => {
    if (!value) return [];
    const issues: string[] = [];
    if (terms.length === 0 || terms.some(term => !term.trim())) issues.push(copy.emptyError);
    if (terms.length > 20) issues.push(copy.tooManyError);
    if (terms.some(term => term.length > 200)) issues.push(copy.tooLongError);
    if ((value.scope === "content" && !contentEnabled) ||
        (value.scope === "attachments" && !attachmentsEnabled) ||
        (value.scope === "all" && (!contentEnabled || !attachmentsEnabled))) issues.push(copy.scopeUnavailable);
    return issues;
  }, [value, terms, copy, contentEnabled, attachmentsEnabled]);

  const update = (patch: Partial<TextSearchConfig>) => {
    if (value) onChange({ ...value, ...patch });
  };

  return (
    <section className="space-y-4 rounded-md border border-border/70 bg-muted/20 p-4 text-sm" data-testid="automation-text-search-editor">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="search-text-enabled" className="font-medium">{copy.enabled}</Label>
        <Switch
          id="search-text-enabled"
          data-testid="search-text-enabled"
          checked={enabled}
          onCheckedChange={checked => onChange(checked ? {
            terms: [],
            scope: contentEnabled ? "content" : "attachments",
            match: "any",
            caseSensitive: false
          } : undefined)}
          aria-label={copy.enabled}
        />
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">{copy.help}</p>

      {enabled && value && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="search-text-terms">{copy.terms}</Label>
            <Textarea
              id="search-text-terms"
              data-testid="search-text-terms"
              value={termsText}
              onChange={event => {
                setTermsText(event.target.value);
                update({ terms: event.target.value.split("\n").filter(term => term.length > 0) });
              }}
              placeholder={copy.termsPlaceholder}
              aria-describedby="search-text-terms-hint"
              className="min-h-24 resize-y font-mono text-sm"
            />
            <p id="search-text-terms-hint" className="text-xs leading-relaxed text-muted-foreground">{copy.termsHint}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="search-text-scope">{copy.scope}</Label>
              <Select value={value.scope} onValueChange={scope => update({ scope: scope as TextSearchConfig["scope"] })}>
                <SelectTrigger id="search-text-scope" data-testid="search-text-scope" aria-label={copy.scope}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="content" disabled={!contentEnabled}>{copy.content}</SelectItem>
                  <SelectItem value="attachments" disabled={!attachmentsEnabled}>{copy.attachments}</SelectItem>
                  <SelectItem value="all" disabled={!contentEnabled || !attachmentsEnabled}>{copy.all}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="search-text-match">{copy.match}</Label>
              <Select value={value.match} onValueChange={match => update({ match: match as TextSearchConfig["match"] })}>
                <SelectTrigger id="search-text-match" data-testid="search-text-match" aria-label={copy.match}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{copy.any}</SelectItem>
                  <SelectItem value="all">{copy.every}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="search-text-case-sensitive">{copy.caseSensitive}</Label>
            <Switch
              id="search-text-case-sensitive"
              data-testid="search-text-case-sensitive"
              checked={value.caseSensitive}
              onCheckedChange={caseSensitive => update({ caseSensitive })}
              aria-label={copy.caseSensitive}
            />
          </div>

          {errors.length > 0 && (
            <div role="alert" className="space-y-1 rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {errors.map(error => <p key={error}>{error}</p>)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
