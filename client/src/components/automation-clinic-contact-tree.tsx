import { useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronDown, ChevronRight, CircleDot, Handshake, Users } from "lucide-react";
import { CLINIC_CONTACT_QUESTIONS, CLINIC_CONTACT_TYPES } from "@shared/clinic-contact-type";
import type { UpdateField } from "@shared/automation-update-record";
import { getUpdateRecordCopy } from "@/i18n/automation-update-record-copy";

type Props = {
  fields: Record<string, unknown>;
  supportedFields: UpdateField[];
  onChange: (fields: Record<string, unknown>) => void;
  root: string;
  locale: string;
  renderAdvanced?: (field: UpdateField) => ReactNode;
};

const sourceIcons = {
  new_contact: CircleDot,
  former_collaborator: Users,
  current_collaborator: Handshake,
} as const;

export function AutomationClinicContactTree({
  fields,
  supportedFields,
  onChange,
  root,
  locale,
  renderAdvanced,
}: Props) {
  const copy = getUpdateRecordCopy(locale);
  const copyRecord = copy as unknown as Record<string, any>;
  const fieldMap = copyRecord.field as Record<string, string>;
  const optionMap = copyRecord.option as Record<string, string>;
  const sourceField = supportedFields.find((field) => field.key === "leadSource");

  const sourceOptions = CLINIC_CONTACT_TYPES.filter((source) =>
    sourceField?.options?.includes(source),
  );
  const initialSource =
    typeof fields.leadSource === "string" && sourceOptions.includes(fields.leadSource as typeof sourceOptions[number])
      ? fields.leadSource
      : sourceOptions[0];
  const initialQuestion = CLINIC_CONTACT_QUESTIONS.find((question) =>
    supportedFields.some((field) => field.key === question.fieldKey),
  );

  const [expandedSource, setExpandedSource] = useState<string | undefined>(initialSource);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(
    () => new Set(initialSource && initialQuestion ? [`${initialSource}:${initialQuestion.fieldKey}`] : []),
  );

  const toggleQuestion = (key: string) => {
    setExpandedQuestions((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const labelForField = (fieldKey: string, labelKey?: string) =>
    fieldMap[fieldKey] || (labelKey ? fieldMap[labelKey] : undefined) || fieldKey;
  const labelForOption = (value: string, labelKey?: string) =>
    (labelKey ? optionMap[labelKey] : undefined) || optionMap[value] || value;

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-muted/15 p-3 sm:p-4"
      data-testid={`${root}-contact-tree`}
      aria-label={labelForField("leadSource")}
    >
      <header className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CircleDot className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-5">{labelForField("leadSource")}</h3>
          {copyRecord.contactQuestionsHelp && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {copyRecord.contactQuestionsHelp}
            </p>
          )}
        </div>
      </header>

      <div className="grid gap-2">
        {sourceOptions.map((source) => {
          const Icon = sourceIcons[source];
          const selected = fields.leadSource === source;
          const isExpanded = expandedSource === source;
          const sourceLabel = labelForOption(source);
          const questions = CLINIC_CONTACT_QUESTIONS.flatMap((question) => {
            const field = supportedFields.find((candidate) => candidate.key === question.fieldKey);
            if (!field || field.kind !== "enum") return [];
            const allowed = question.options.filter((option) => field.options?.includes(option.value));
            return allowed.length ? [{ question, field, allowed }] : [];
          });

          return (
            <div key={source} className="overflow-hidden rounded-lg border border-border bg-background">
              <div className={`flex items-center gap-2 px-3 py-2.5 transition-colors ${selected ? "bg-primary/5" : "hover:bg-muted/40"}`}>
                <input
                  type="radio"
                  name={`${root}-contact-source`}
                  value={source}
                  id={`${root}-contact-source-${source}`}
                  checked={selected}
                  aria-label={sourceLabel}
                  className="h-4 w-4 shrink-0 accent-primary"
                  data-testid={`${root}-contact-source-${source}`}
                  onChange={() => {
                    setExpandedSource(source);
                    if (questions[0]) setExpandedQuestions(current => new Set(current).add(`${source}:${questions[0].question.fieldKey}`));
                    onChange({ ...fields, leadSource: source });
                  }}
                />
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <label htmlFor={`${root}-contact-source-${source}`} className="min-w-0 flex-1 cursor-pointer text-sm font-medium">{sourceLabel}</label>
                {selected && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                <button
                  type="button"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`${sourceLabel}: ${isExpanded ? copy.collapse : copy.expand}`}
                  aria-expanded={isExpanded}
                  data-testid={`${root}-contact-source-toggle-${source}`}
                  onClick={() => setExpandedSource(isExpanded ? undefined : source)}
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "" : "-rotate-90"}`} aria-hidden="true" />
                </button>
              </div>

              {isExpanded && (
                <div className="border-t border-border bg-muted/15 p-2 sm:p-3">
                  <div className="space-y-2">
                    {questions.map(({ question, field, allowed }) => {
                      const questionId = `${source}:${question.fieldKey}`;
                      const questionExpanded = expandedQuestions.has(questionId);
                      const questionLabel = labelForField(question.fieldKey, question.labelKey);
                      const currentValue = fields[question.fieldKey];
                      const advanced = renderAdvanced?.(field);

                      return (
                        <div key={question.fieldKey} className="overflow-hidden rounded-lg border border-border bg-background">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                            aria-expanded={questionExpanded}
                            data-testid={`${root}-contact-question-${source}-${question.fieldKey}`}
                            onClick={() => toggleQuestion(questionId)}
                          >
                            <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${questionExpanded ? "rotate-90" : ""}`} aria-hidden="true" />
                            <span className="min-w-0 flex-1 text-sm font-medium">{questionLabel}</span>
                            {typeof currentValue === "string" && allowed.some((option) => option.value === currentValue) && (
                              <span className="max-w-[45%] truncate rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs text-primary">
                                {labelForOption(currentValue, allowed.find((option) => option.value === currentValue)?.labelKey)}
                              </span>
                            )}
                            {currentValue === null && (
                              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                {copy.clear}
                              </span>
                            )}
                          </button>

                          {questionExpanded && (
                            <div className="space-y-2 border-t border-border px-3 py-3">
                              <div className="grid gap-1.5">
                                {allowed.map((option) => {
                                  const answerLabel = labelForOption(option.value, option.labelKey);
                                  const checked = fields.leadSource === source && currentValue === option.value;
                                  return (
                                    <label
                                      key={option.value}
                                      className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors ${
                                        checked
                                          ? "border-primary/30 bg-primary/5 text-foreground"
                                          : "border-transparent hover:border-border hover:bg-muted/40"
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        name={`${root}-contact-answer-${source}-${question.fieldKey}`}
                                        value={option.value}
                                        checked={checked}
                                        aria-label={`${questionLabel}: ${answerLabel}`}
                                        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                                        data-testid={`${root}-contact-answer-${source}-${question.fieldKey}-${option.value}`}
                                        onChange={() => onChange({
                                          ...fields,
                                          leadSource: source,
                                          [question.fieldKey]: option.value,
                                        })}
                                      />
                                      <span className="min-w-0 flex-1">{answerLabel}</span>
                                      {checked && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                                    </label>
                                  );
                                })}
                              </div>

                              <div className="flex flex-wrap gap-2 border-t border-border pt-2">
                                {field.nullable && (
                                  <button
                                    type="button"
                                    className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                      currentValue === null
                                        ? "border-primary/30 bg-primary/5 text-primary"
                                        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                                    }`}
                                    aria-label={`${copy.clear}: ${questionLabel}`}
                                    data-testid={`${root}-contact-clear-${source}-${question.fieldKey}`}
                                    onClick={() => onChange({ ...fields, [question.fieldKey]: null })}
                                  >
                                    {copy.clear}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                    !Object.hasOwn(fields, question.fieldKey)
                                      ? "border-primary/30 bg-primary/5 text-primary"
                                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                                  }`}
                                  aria-label={`${copy.leaveUnchanged}: ${questionLabel}`}
                                  data-testid={`${root}-contact-unchanged-${source}-${question.fieldKey}`}
                                  onClick={() => {
                                    const next = { ...fields };
                                    delete next[question.fieldKey];
                                    onChange(next);
                                  }}
                                >
                                  {copy.leaveUnchanged}
                                </button>
                              </div>

                              {advanced && (
                                <details className="group border-t border-border pt-2">
                                  <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                    <span className="inline-flex items-center gap-1.5">
                                      <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
                                      {copy.advancedValue}
                                    </span>
                                  </summary>
                                  <div className="pt-2">{advanced}</div>
                                </details>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
