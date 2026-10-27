import React, { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, CheckCircle, ChevronRight, Info, Loader2, Mail, Phone, Save, Tag, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStatusListQuestionColorValue, StatusListQuickOptionIcon } from "@/components/status-list-quick-option-icons";
import { isStatusListYesNo } from "@shared/status-list-answer-kind";
import { translations, type Locale } from "@/i18n/translations";
import { useI18n } from "@/i18n/I18nProvider";
import { statusListOptionLabel } from "@shared/status-list-label-translations";

type Phase = {
  key: "acquisition" | "contract" | "retention";
  label: string;
  total: number;
  confirmed: number;
  pct: number;
  cardActive: string;
  labelColor: string;
  dotColor: string;
  pctColor: string;
  barGradient: string;
};

export type AgentStatusQuestion = {
  id: string; questionText: string; isHidden?: boolean; groupName?: string | null;
  logicOperator?: string; fieldType?: string | null; color?: string | null; icon?: string | null;
  automations?: any[]; noteEnabled?: boolean; previewActions?: boolean; description?: string | null;
};

export function StatusListQuestionHistory({ questionId, locale, metadata, note, pending, onSaveNote, noteEnabled = true }: {
  questionId: string; locale: string;
  metadata?: { answeredAt?: string | null; answeredByName?: string | null; actorKind?: string | null };
  note?: { note?: string | null; updatedAt?: string | null; updatedByName?: string | null };
  pending: boolean; onSaveNote?: (questionId: string, note: string | null) => Promise<void> | void; noteEnabled?: boolean;
}) {
  const { t } = useI18n();
  const copy = t.statusListQuestionHistory;
  const [draft, setDraft] = useState(note?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const lastSavedNote = useRef(note?.note ?? "");
  useEffect(() => {
    const incoming = note?.note ?? "";
    if (incoming !== lastSavedNote.current) {
      setDraft(current => current === lastSavedNote.current ? incoming : current);
      lastSavedNote.current = incoming;
    }
  }, [note?.note, note?.updatedAt]);
  const dirty = draft.trim() !== lastSavedNote.current.trim();
  const stamp = (value?: string | null) => value ? new Date(value).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" }) : "";
  return <div className="mt-1.5 w-full space-y-1.5" data-testid={`sl-question-history-${questionId}`}>
    {pending ? <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" data-testid={`sl-question-pending-${questionId}`}>{copy.pending}</span>
      : metadata?.answeredAt ? <div className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80" data-testid={`sl-question-answered-${questionId}`}>
        {copy.saved} · {stamp(metadata.answeredAt)}{metadata.answeredByName ? ` · ${copy.by} ${metadata.answeredByName}` : ""}
      </div> : null}
    {noteEnabled ? <div className="flex flex-wrap items-center gap-2">
      <input aria-label={copy.note} className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-[10px] font-normal text-foreground placeholder:text-muted-foreground"
        value={draft} placeholder={copy.notePlaceholder} onChange={event => setDraft(event.target.value)} data-testid={`sl-question-note-${questionId}`} />
      {onSaveNote && <button type="button" disabled={!dirty || saving} className="rounded-md border px-2 py-1.5 text-[10px] font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-45"
        onClick={async () => { setSaving(true); setError(false); try { await onSaveNote(questionId, draft.trim() || null); } catch { setError(true); } finally { setSaving(false); } }}
        data-testid={`sl-question-note-save-${questionId}`}>{saving ? copy.saving : error ? copy.saveError : copy.save}</button>}
    </div> : note?.note ? <p className="whitespace-pre-wrap text-[10px] text-muted-foreground">{note.note}</p> : null}
    {note?.updatedAt && <div className="text-[9px] text-muted-foreground">{stamp(note.updatedAt)}{note.updatedByName ? ` · ${note.updatedByName}` : ""}</div>}
  </div>;
}

export function StatusListAgentQuestionChoices({
  itemId, questions, questionSelectionMode, answers, yesLabel, noLabel, onAnswer, renderAction,
  locale = "en", answerMetadata = {}, questionNotes = {}, pendingQuestionIds = new Set<string>(), onSaveQuestionNote, scopeKey = "",
}: {
  itemId: string;
  questions: AgentStatusQuestion[];
  questionSelectionMode?: string | null;
  answers: Record<string, any>;
  yesLabel: string;
  noLabel: string;
  locale?: string;
  answerMetadata?: Record<string, { answeredAt?: string | null; answeredByName?: string | null; actorKind?: string | null }>;
  questionNotes?: Record<string, { note?: string | null; updatedAt?: string | null; updatedByName?: string | null }>;
  pendingQuestionIds?: Set<string>;
  onSaveQuestionNote?: (questionId: string, note: string | null) => Promise<void> | void;
  scopeKey?: string;
  onAnswer: (question: AgentStatusQuestion, value: string | boolean, exclusiveQuestions: AgentStatusQuestion[], groupMode?: string) => void;
  renderAction?: (question: AgentStatusQuestion, exclusiveQuestions: AgentStatusQuestion[], groupMode?: string) => ReactNode | null;
}) {
  const visibleQuestions = questions.filter(question => !question.isHidden);
  if (!visibleQuestions.length) return null;
  const groups = visibleQuestions.reduce<Record<string, AgentStatusQuestion[]>>((result, question) => {
    const groupName = question.groupName || "__ungrouped__";
    (result[groupName] ||= []).push(question);
    return result;
  }, {});
  const stepSingleSelect = questionSelectionMode === "single";
  return <div className="mt-2 pt-1.5 border-t border-dashed space-y-2" data-testid={`sl-questions-${itemId}`}>
    {stepSingleSelect && <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1"><span className="px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">1×</span></p>}
    {Object.entries(groups).map(([groupName, group]) => <div key={groupName}>
      {groupName !== "__ungrouped__" && <div className="flex items-center gap-1.5 mb-1.5">
        <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider">{groupName}</p>
        {!stepSingleSelect && group[0]?.logicOperator === "ONE" && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">1×</span>}
      </div>}
      <div className="flex flex-wrap gap-1">{group.map(question => {
        const fieldType = question.fieldType || "checkbox";
        const groupMode = stepSingleSelect || group[0]?.logicOperator === "ONE" ? "ONE" : undefined;
        const exclusiveQuestions = stepSingleSelect ? visibleQuestions : group;
        const customAction = isStatusListYesNo(fieldType) ? null : renderAction?.(question, exclusiveQuestions, groupMode);
        const questionColor = getStatusListQuestionColorValue(question.color);
        const history = <StatusListQuestionHistory key={`${scopeKey}:${question.id}`} questionId={question.id} locale={locale} metadata={answerMetadata[question.id]}
          note={questionNotes[question.id]} pending={pendingQuestionIds.has(question.id)} onSaveNote={onSaveQuestionNote} noteEnabled={question.noteEnabled !== false} />;
        if (customAction) return <div key={question.id} data-testid={`sl-question-${question.id}`}>{customAction}{question.description && <p className="mt-1 text-[10px] text-muted-foreground">{question.description}</p>}{history}</div>;
        const answered = answers[question.id] != null;
        if (isStatusListYesNo(fieldType)) return <div key={question.id} className="w-full" data-testid={`sl-question-${question.id}`}>
          {question.questionText && <p className="flex items-center gap-1.5 text-[10px] text-foreground/70 mb-1" style={questionColor ? { color: questionColor } : undefined}><StatusListQuickOptionIcon name={question.icon} color={question.color} className="h-3.5 w-3.5 shrink-0" />{question.questionText}</p>}
          <div className="flex gap-1">
            <button type="button" onClick={() => onAnswer(question, "yes", exclusiveQuestions, groupMode)} className={`px-2.5 py-1 text-xs rounded border font-semibold transition-colors ${answers[question.id] === "yes" ? "bg-green-500 border-green-500 text-white" : "border-border hover:bg-green-50 dark:hover:bg-green-950/20 text-foreground"}`} data-testid={`btn-sl-q-yes-${question.id}`}>{yesLabel}</button>
            <button type="button" onClick={() => onAnswer(question, "no", exclusiveQuestions, groupMode)} className={`px-2.5 py-1 text-xs rounded border font-semibold transition-colors ${answers[question.id] === "no" ? "bg-red-500 border-red-500 text-white" : "border-border hover:bg-red-50 dark:hover:bg-red-950/20 text-foreground"}`} data-testid={`btn-sl-q-no-${question.id}`}>{noLabel}</button>
          </div>
          {question.description && <p className="mt-1 text-[10px] text-muted-foreground">{question.description}</p>}
          {history}
        </div>;
        const oneMode = groupMode === "ONE";
        return <div key={question.id} className="w-full" data-testid={`sl-question-${question.id}`}>
          <button type="button" onClick={() => onAnswer(question, true, exclusiveQuestions, groupMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${answered ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50 text-foreground"}`}
            style={questionColor ? (answered ? { backgroundColor: questionColor, borderColor: questionColor, color: "#fff" } : { borderColor: questionColor, color: questionColor }) : undefined}
            data-testid={`btn-sl-q-${question.id}`}>
            {(fieldType === "radio" || oneMode) && <div className={`h-2.5 w-2.5 rounded-full border-2 flex items-center justify-center shrink-0 ${answered ? "border-white" : "border-current"}`}>{answered && <div className="h-1 w-1 rounded-full bg-white" />}</div>}
            {fieldType === "checkbox" && !oneMode && <div className={`h-2.5 w-2.5 rounded border-2 flex items-center justify-center shrink-0 ${answered ? "border-white" : "border-current"}`}>{answered && <Check className="h-1.5 w-1.5 text-white" />}</div>}
            <StatusListQuickOptionIcon name={question.icon} color={question.color} className="h-3.5 w-3.5 shrink-0" />{question.questionText}
          </button>
          {question.description && <p className="mt-1 text-[10px] text-muted-foreground">{question.description}</p>}
          {history}
        </div>;
      })}</div>
    </div>)}
  </div>;
}

export function StatusListPhasePipeline({
  phases, active, onSelect,
}: { phases: Phase[]; active: string; onSelect: (phase: Phase["key"]) => void }) {
  return (
    <div className="flex items-stretch gap-1">
      {phases.flatMap((phase, index) => {
        const isActive = active === phase.key;
        const isComplete = phase.total > 0 && phase.confirmed === phase.total;
        const isStarted = phase.confirmed > 0;
        return [
          ...(index > 0 ? [<div key={`sep-${phase.key}`} className="flex items-center shrink-0 self-center px-0.5"><ChevronRight className="h-3 w-3 text-muted-foreground/30" /></div>] : []),
          <button key={phase.key} type="button" onClick={() => onSelect(phase.key)}
            className={`flex-1 rounded-xl border p-2.5 transition-all duration-200 text-left relative overflow-hidden ${isActive ? phase.cardActive : "bg-muted/20 dark:bg-muted/10 border-border/40 hover:bg-muted/50 hover:border-border/70"}`}
            data-testid={`sl-phase-${phase.key}`}>
            {isComplete && <div className="absolute top-1.5 right-1.5"><CheckCircle className={`h-3 w-3 ${phase.dotColor}`} /></div>}
            <div className="flex items-center gap-1.5 mb-2 pr-4">
              <div className={`h-1.5 w-1.5 rounded-full shrink-0 transition-colors ${isComplete ? "bg-emerald-500" : isStarted ? phase.dotColor : "bg-muted-foreground/20"}`} />
              <span className={`text-[9px] font-extrabold uppercase tracking-widest leading-none transition-colors ${isActive ? phase.labelColor : "text-muted-foreground/50"}`}>{phase.label}</span>
            </div>
            <div className="h-1.5 bg-black/5 dark:bg-white/8 rounded-full overflow-hidden mb-1.5">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: phase.total > 0 ? `${phase.pct}%` : "0%", background: isComplete ? "#10b981" : phase.pct > 0 ? phase.barGradient : "transparent" }} />
            </div>
            {phase.total > 0 ? <div className="flex items-center justify-between gap-1">
              <span className={`text-[9px] tabular-nums font-semibold leading-none transition-colors ${isActive ? phase.labelColor : "text-muted-foreground/40"}`}>{phase.confirmed}/{phase.total}</span>
              <span className={`text-[9px] font-bold tabular-nums leading-none transition-colors ${isComplete ? "text-emerald-500" : isActive ? phase.pctColor : "text-muted-foreground/30"}`}>{phase.pct}%</span>
            </div> : <span className="text-[9px] text-muted-foreground/25 italic leading-none">—</span>}
          </button>,
        ];
      })}
    </div>
  );
}

export function StatusListAgentItemFrame({
  itemId, stepId, tab, selected, info, highlighted, children,
}: {
  itemId: string; stepId: string; tab?: string | null; selected: boolean; info: boolean; highlighted?: boolean; children: ReactNode;
}) {
  const surfaceTone = selected
    ? "bg-emerald-50/80 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/60 shadow-sm"
    : highlighted
      ? "bg-primary/5 border-primary/60 shadow-md ring-2 ring-primary/30"
      : tab === "acquisition"
        ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/40 hover:border-blue-300/60 dark:hover:border-blue-700/50 hover:shadow-sm"
        : tab === "contract"
          ? "bg-violet-50/50 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900/40 hover:border-violet-300/60 dark:hover:border-violet-700/50 hover:shadow-sm"
          : tab === "retention"
            ? "bg-emerald-50/40 dark:bg-emerald-950/15 border-emerald-100 dark:border-emerald-900/30 hover:border-emerald-300/60 dark:hover:border-emerald-700/50 hover:shadow-sm"
            : "bg-card border-border hover:border-primary/25 dark:hover:border-primary/35 hover:shadow-sm";
  const accent = selected ? "bg-emerald-500" : tab === "acquisition" ? "bg-blue-400/70" : tab === "contract" ? "bg-violet-400/70" : tab === "retention" ? "bg-emerald-400/70" : info ? "bg-blue-400" : "bg-muted-foreground/15";
  return <div id={`sl-step-${stepId}`} key={itemId} className={`relative rounded-xl border transition-all duration-200 overflow-hidden ${surfaceTone}`} data-testid={`sl-agent-item-${itemId}`}>
    <div className={`absolute inset-y-0 left-0 w-[3px] rounded-l-xl transition-all duration-300 ${accent}`} />
    {children}
  </div>;
}

export function StatusListAgentItemHeading({ label, selected, required, description, children, icon, color }: {
  label: string; selected: boolean; required?: boolean; description?: string | null; children?: ReactNode; icon?: string | null; color?: string | null;
}) {
  const iconColor = getStatusListQuestionColorValue(color);
  return <>
    <div className={`flex items-center gap-1.5 text-sm leading-snug ${selected ? "font-bold text-emerald-700 dark:text-emerald-300" : "font-semibold"}`}><StatusListQuickOptionIcon name={icon} color={color} className="h-4 w-4 shrink-0" style={iconColor ? { color: iconColor } : undefined} />{label}{required && <span className="ml-1 text-rose-500 text-[10px] font-bold">*</span>}</div>
    {description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
    {children}
  </>;
}

export function StatusListAgentActionRow({ actions, renderAction }: { actions: any[]; renderAction: (automation: any) => ReactNode }) {
  const actionable = (actions || []).filter(action => ["send_email_group", "set_contact_status", "set_callback"].includes(action.actionType));
  if (!actionable.length) return null;
  return <div className="flex flex-wrap items-center gap-1.5 mt-2">{actionable.map(action => <React.Fragment key={action.id}>{renderAction(action)}</React.Fragment>)}</div>;
}

export function StatusListBatchBanner({ title, message, onDismiss, dismissLabel = "Dismiss" }: { title: string; message: string; onDismiss: () => void; dismissLabel?: string }) {
  return <div className="mx-3 mt-2 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/30 flex items-center gap-2.5 px-3 py-2 shrink-0" data-testid="sl-batch-mode-banner">
    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
    <div className="flex-1 min-w-0"><span className="text-xs font-semibold text-blue-800 dark:text-blue-300">{title}</span><span className="text-xs text-blue-700 dark:text-blue-400"> – {message}</span></div>
    <button type="button" aria-label={dismissLabel} onClick={onDismiss} className="shrink-0 rounded-md p-0.5 text-blue-500 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"><X className="h-3.5 w-3.5" /></button>
  </div>;
}

export function StatusListQuickOptionsPanel({ options, label, onSelect, runningId, selectedId, selectedIds, locale = "en" }: {
  options: Array<{ id: string; label: string; labelTranslations?: unknown; color?: string | null; icon?: string | null }>;
  locale?: string;
  label: string; onSelect: (id: string) => void; runningId?: string | null; selectedId?: string | null; selectedIds?: Set<string>;
}) {
  if (!options.length) return null;
  return <div className="mx-3 mt-2 rounded-xl border border-border/70 bg-muted/20 shrink-0 overflow-hidden" data-testid="status-list-options-panel">
    <div className="flex items-center gap-2 px-3 pt-2.5 pb-1"><div className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0"><Zap className="h-3 w-3 text-primary" /></div><span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span></div>
    <div className="flex flex-wrap gap-1.5 px-3 pb-3">{options.map(option => {
      const running = String(option.id) === String(runningId);
      const selected = selectedIds ? selectedIds.has(String(option.id)) : String(option.id) === String(selectedId);
       const accent = option.color || "#687a86";
       return <button key={option.id} type="button" onClick={() => onSelect(option.id)} disabled={running} aria-pressed={selectedId === undefined && !selectedIds ? undefined : selected}
         className={`flex min-h-8 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-55 ${selected ? "border-blue-600 bg-blue-600 text-white ring-2 ring-blue-500/25 ring-offset-1 ring-offset-background" : "text-foreground hover:bg-background"}`}
         style={selected ? undefined : { borderColor: `color-mix(in srgb, ${accent} 45%, hsl(var(--border)))`, backgroundColor: `color-mix(in srgb, ${accent} 8%, hsl(var(--background)))` }}
         data-testid={`option-btn-${option.id}`}>{running ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <StatusListQuickOptionIcon name={option.icon} className="h-3.5 w-3.5 shrink-0" />}{statusListOptionLabel(option, locale)}</button>;
    })}</div>
  </div>;
}

export function StatusListBatchSaveButton({ label, count, onSave, pendingAutomationCount, pendingAutomationLabel, disabled }: { label: string; count: number; onSave: () => void; pendingAutomationCount?: number; pendingAutomationLabel?: string; disabled?: boolean }) {
  return <div className="px-3 py-2 shrink-0"><button type="button" disabled={disabled || count === 0} onClick={onSave}
    className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-bold transition-all shadow-sm ${count > 0 ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200/50 dark:shadow-emerald-900/30" : "bg-muted text-muted-foreground border border-dashed border-border cursor-default opacity-60"}`}
    data-testid="btn-sl-batch-save"><Save className="h-4 w-4" />{label}{count > 0 && <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/25 px-1 text-[11px] font-black">{count}</span>}{(pendingAutomationCount || 0) > 0 && <span className="flex items-center gap-1 rounded-full bg-amber-400/30 px-1.5 text-[10px] font-semibold text-amber-100"><Zap className="h-2.5 w-2.5" />{pendingAutomationCount} {pendingAutomationLabel}</span>}</button></div>;
}

const tr = (key: string, locale: string) => {
  const lang = locale.toLowerCase().split(/[-_]/)[0] as Locale;
  const copy = translations[lang]?.statusListAgentPreview as unknown as Record<string, string> | undefined;
  return copy?.[key] || translations.en.statusListAgentPreview[key as keyof typeof translations.en.statusListAgentPreview] || key;
};
export function readStatusListMode(settings?: string | null): "batch" | "immediate" {
  try {
    return JSON.parse(settings || "{}").statusListMode === "batch" ? "batch" : "immediate";
  } catch {
    return "immediate";
  }
}
type PreviewItem = {
  id: string; stepId: string; label: string; description?: string | null; required?: boolean;
  parentId?: string | null; confirmationType?: string; isHidden?: boolean; itemType?: string; canonicalClinicStatusKey?: string | null;
  color?: string | null; icon?: string | null; tab?: string | null;
  automations?: any[];
  questionSelectionMode?: string | null; questions?: AgentStatusQuestion[];
};

export function StatusListAgentPreview({ items, locale, statusListMode = "immediate" }: { items: PreviewItem[]; locale: string; statusListMode?: "batch" | "immediate" }) {
  const [active, setActive] = useState<Phase["key"]>("acquisition");
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [bannerVisible, setBannerVisible] = useState(true);
  const [selectedQuickOption, setSelectedQuickOption] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const roots = useMemo(() => items.filter(item => !item.isHidden && item.itemType !== "option" && item.confirmationType !== "auto" && !item.parentId), [items]);
  const visibleStatusItems = useMemo(() => items.filter(item => !item.isHidden && item.itemType !== "option" && item.confirmationType !== "auto"), [items]);
  const childrenOf = (parentId: string) => items.filter(item => !item.isHidden && item.parentId === parentId);
  const singleSelectParentIds = new Set(roots.filter(item => item.questionSelectionMode === "single").map(item => item.id));
  const scoreUnits = visibleStatusItems.filter(item => !(item.parentId && singleSelectParentIds.has(item.parentId)));
  const isUnitConfirmed = (item: PreviewItem) => item.questionSelectionMode === "single"
    ? childrenOf(item.id).some(child => checked.has(child.id))
    : checked.has(item.id);
  const options = useMemo(() => items.filter(item => !item.isHidden && item.itemType === "option"), [items]);
  const phaseDefinitions: Array<Omit<Phase, "total" | "confirmed" | "pct">> = [
    { key: "acquisition", label: tr("phaseAcquisition", locale), cardActive: "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-600 shadow-lg ring-1 ring-blue-400/40", labelColor: "text-blue-600 dark:text-blue-400", dotColor: "bg-blue-500", pctColor: "text-blue-500", barGradient: "linear-gradient(90deg, #60a5fa 0%, #2563eb 100%)" },
    { key: "contract", label: tr("phaseContract", locale), cardActive: "bg-violet-50 dark:bg-violet-950/40 border-violet-300 dark:border-violet-600 shadow-lg ring-1 ring-violet-400/40", labelColor: "text-violet-600 dark:text-violet-400", dotColor: "bg-violet-500", pctColor: "text-violet-500", barGradient: "linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%)" },
    { key: "retention", label: tr("phaseRetention", locale), cardActive: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-600 shadow-lg ring-1 ring-emerald-400/40", labelColor: "text-emerald-600 dark:text-emerald-400", dotColor: "bg-emerald-500", pctColor: "text-emerald-500", barGradient: "linear-gradient(90deg, #34d399 0%, #059669 100%)" },
  ];
  const phases: Phase[] = phaseDefinitions.map(phase => {
    const bucket = scoreUnits.filter(item => {
      const tab = item.tab || items.find(parent => parent.id === item.parentId)?.tab || null;
      return tab === phase.key;
    });
    const confirmed = bucket.filter(isUnitConfirmed).length;
    return { ...phase, total: bucket.length, confirmed, pct: bucket.length ? Math.round(confirmed / bucket.length * 100) : 0 };
  });
  const activeItems = roots.filter(item => !item.tab || item.tab === active);
  const toggle = (id: string) => setChecked(previous => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const answer = (question: AgentStatusQuestion, value: string | boolean, exclusiveQuestions: AgentStatusQuestion[], groupMode?: string) => {
    setAnswers(previous => {
      const next = { ...previous };
      const fieldType = question.fieldType || "checkbox";
      if (fieldType === "radio") exclusiveQuestions.filter(entry => (entry.fieldType || "checkbox") === "radio").forEach(entry => { delete next[entry.id]; });
      if (groupMode === "ONE") exclusiveQuestions.forEach(entry => { delete next[entry.id]; });
      if ((fieldType === "checkbox" || fieldType === "radio") && previous[question.id] === value) delete next[question.id];
      else if (groupMode === "ONE" && previous[question.id] !== undefined) { /* remains cleared, mirroring Nexus Pulse */ }
      else next[question.id] = value;
      return next;
    });
  };
  const batchCount = checked.size;
  const totalCount = scoreUnits.length;
  const confirmedCount = scoreUnits.filter(isUnitConfirmed).length;
  const progress = totalCount ? Math.round(confirmedCount / totalCount * 100) : 0;
  const requiredMissing = scoreUnits.filter(item => item.required && !isUnitConfirmed(item));
  return <div className="flex flex-col flex-1 min-h-[360px] overflow-hidden bg-background" style={{ height: "min(720px, 72vh)" }} data-testid="status-list-agent-preview">
    <div className="px-3 pt-2.5 pb-2.5 border-b bg-gradient-to-br from-primary/5 via-background to-background shrink-0"><StatusListPhasePipeline phases={phases} active={active} onSelect={setActive} /></div>
    {statusListMode === "batch" && bannerVisible && <StatusListBatchBanner title={tr("batchTitle", locale)} message={tr("batchMessage", locale)} dismissLabel={tr("dismiss", locale)} onDismiss={() => setBannerVisible(false)} />}
    <div className="mx-3 mt-2 rounded-lg border border-border/60 bg-muted/35 px-2.5 py-2 flex items-start gap-2 text-[10px] leading-snug text-muted-foreground" data-testid="status-list-preview-safety"><Info className="h-3.5 w-3.5 mt-px shrink-0 text-primary/70" />{tr("safePreview", locale)}</div>
    <StatusListQuickOptionsPanel options={options} locale={locale} label={tr("options", locale)} selectedId={selectedQuickOption} onSelect={setSelectedQuickOption} />
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {!activeItems.length ? <div className="py-10 text-center text-sm text-muted-foreground" data-testid="status-list-empty">{tr("previewEmpty", locale)}</div> : activeItems.map(item => {
        const selected = checked.has(item.id);
        const children = childrenOf(item.id);
        return <StatusListAgentItemFrame key={item.id} itemId={item.id} stepId={item.stepId} tab={item.tab} selected={selected} info={item.confirmationType === "info"}>
          <div className="flex items-start gap-3 pl-4 pr-3 py-3">
            <div className="shrink-0 mt-0.5">{item.confirmationType === "info" ? <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center"><Info className="h-3 w-3 text-blue-500" /></div> : <button type="button" onClick={() => toggle(item.id)} className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${selected ? "bg-emerald-500 border-emerald-500 shadow-sm shadow-emerald-200" : "border-muted-foreground/30 bg-background hover:border-emerald-400"}`} aria-pressed={selected} data-testid={`sl-check-${item.id}`}>{selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}</button>}</div>
            <div className="flex-1 min-w-0"><StatusListAgentItemHeading label={item.label} icon={item.icon} selected={selected} required={item.confirmationType!=="info" && item.required} description={item.description} />
              <StatusListAgentQuestionChoices itemId={item.id} questions={item.questions || []} questionSelectionMode={item.questionSelectionMode}
                answers={answers} yesLabel={tr("yes", locale)} noLabel={tr("no", locale)}
                onAnswer={(question, value, exclusiveQuestions, groupMode) => answer(question, value, exclusiveQuestions, groupMode)}
                renderAction={(question, exclusiveQuestions, groupMode) => {
                  const callback = (question.automations || []).some(automation => automation.actionType === "set_callback");
                  const status = (question.automations || []).some(automation => automation.actionType === "set_contact_status");
                  if (!callback && !status) return null;
                  return <Button type="button" variant="outline" size="sm" onClick={() => answer(question, true, exclusiveQuestions, groupMode)} className="h-7 px-2 text-[11px] gap-1" data-testid={`preview-safe-question-action-${question.id}`}>
                    {question.icon ? <StatusListQuickOptionIcon name={question.icon} className="h-3 w-3"/> : callback ? <Phone className="h-3 w-3 text-cyan-600"/> : <Tag className="h-3 w-3 text-purple-600"/>}{question.questionText}
                  </Button>;
                }} />
              <StatusListAgentActionRow actions={item.confirmationType==="info"?[]:item.automations || []} renderAction={automation => {
                const labelKey = automation.actionType === "send_email_group" ? "runEmail" : automation.actionType === "set_callback" ? "runCallback" : "runStatus";
                const selectedActionId = String(automation.id);
                const isSelected = selectedAction === selectedActionId;
                return <Button type="button" variant="outline" size="sm" onClick={() => setSelectedAction(isSelected ? null : selectedActionId)} aria-pressed={isSelected}
                  className={`h-7 px-2 text-[11px] gap-1 ${isSelected ? "ring-2 ring-primary/30" : ""}`}
                  data-testid={`preview-safe-action-${automation.id}`}>
                  {automation.actionType === "send_email_group" ? <Mail className="h-3 w-3 text-green-600" /> : automation.actionType === "set_callback" ? <Phone className="h-3 w-3 text-cyan-600" /> : <Tag className="h-3 w-3 text-purple-600" />}{tr(labelKey, locale)}
                </Button>;
              }} />
              {(item.tab === "retention" || (!item.tab && active === "retention")) && selected && <textarea className="mt-2 w-full text-xs rounded-lg border border-emerald-200 dark:border-emerald-700/50 bg-emerald-50/60 dark:bg-emerald-900/10 p-2 resize-none outline-none focus:ring-1 focus:ring-emerald-400 placeholder:text-muted-foreground/50 min-h-[52px]" placeholder={tr("note", locale)} value={notes[item.id] || ""} rows={2} data-testid={`sl-note-${item.id}`} onChange={event => setNotes(previous => ({ ...previous, [item.id]: event.target.value }))} />}
            </div>
          </div>
          {children.length > 0 && <div className="border-t border-dashed border-border/40 bg-muted/20 px-4 py-2.5 space-y-2">
            {item.questionSelectionMode === "single" && <div className="flex items-center gap-1 pb-0.5"><div className="w-2 h-2 rounded-full border-2 border-blue-400 bg-blue-100 dark:bg-blue-900/40 shrink-0" /><span className="text-[8px] font-bold uppercase tracking-widest text-blue-500 dark:text-blue-400">1×</span></div>}
            {children.map(child => {
              const childSelected = checked.has(child.id);
              return <div key={child.id} className="flex items-start gap-2.5">
                <div className="w-0.5 self-stretch bg-border/40 shrink-0 ml-1 rounded-full" />
                <button type="button" onClick={() => setChecked(previous => {
                  const next = new Set(previous);
                  if (item.questionSelectionMode === "single" && !childSelected) children.forEach(sibling => next.delete(sibling.id));
                  childSelected ? next.delete(child.id) : next.add(child.id);
                  return next;
                })} className={`mt-0.5 h-4 w-4 flex items-center justify-center transition-all shrink-0 ${item.questionSelectionMode === "single" ? `rounded-full border-2 ${childSelected ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/30 bg-background hover:border-emerald-400"}` : `rounded border-2 ${childSelected ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/30 bg-background hover:border-emerald-400"}`} `} aria-pressed={childSelected} data-testid={`sl-check-${child.id}`}>
                  {childSelected && (item.questionSelectionMode === "single" ? <div className="w-1.5 h-1.5 rounded-full bg-white" /> : <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />)}
                </button>
                <div className="flex-1 min-w-0">
                  <span className={`text-xs leading-snug ${childSelected ? "font-semibold text-emerald-700 dark:text-emerald-300" : "text-foreground/90"}`}>{child.label}{child.required && <span className="ml-1 text-rose-500">*</span>}</span>
                  {child.canonicalClinicStatusKey && <span className="ml-1 inline-flex items-center px-1.5 py-px text-[9px] font-mono font-medium rounded border border-border/50 bg-muted/50 text-muted-foreground">{child.canonicalClinicStatusKey.replace(/_/g, " ")}</span>}
                  {child.description && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{child.description}</p>}
                  {(child.tab === "retention" || (!child.tab && active === "retention")) && childSelected && <textarea className="mt-1.5 w-full text-xs rounded-lg border border-emerald-200 dark:border-emerald-700/50 bg-emerald-50/60 dark:bg-emerald-900/10 p-2 resize-none outline-none focus:ring-1 focus:ring-emerald-400 placeholder:text-muted-foreground/50 min-h-[48px]" placeholder={tr("note", locale)} value={notes[child.id] || ""} rows={2} data-testid={`sl-note-${child.id}`} onChange={event => setNotes(previous => ({ ...previous, [child.id]: event.target.value }))} />}
                </div>
              </div>;
            })}
          </div>}
        </StatusListAgentItemFrame>;
      })}
    </div>
    {statusListMode === "batch" && <StatusListBatchSaveButton label={tr("save", locale)} count={batchCount} onSave={() => { setChecked(new Set()); setSelectedQuickOption(null); }} />}
    <div className="px-4 pb-3 pt-2.5 border-t bg-gradient-to-b from-transparent to-muted/20 shrink-0 space-y-2">
      <div className="flex items-center gap-3"><div className="flex-1 bg-muted rounded-full h-2 overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${progress}%` }} /></div><span className={`text-xs font-bold shrink-0 tabular-nums ${progress === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>{progress}%</span></div>
      {requiredMissing.length > 0 && <p className="text-[10px] text-rose-500 font-semibold text-center">{tr("requiredMissing", locale)} {requiredMissing.map(item => item.label).join(", ")}</p>}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 justify-center"><Check className="h-3 w-3 text-emerald-500 shrink-0" />{checked.size > 0 ? `${checked.size} ${tr("localSelected", locale)}` : tr("localNothingSelected", locale)}</div>
    </div>
  </div>;
}
