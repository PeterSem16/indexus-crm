import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ChevronDown, Save, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { getStatusListQuestionStudioCopy } from "./status-list-question-studio-copy";
import { getStatusListWorkspaceCopy } from "./status-list-workspace-copy";
import { isStatusListYesNo } from "@shared/status-list-answer-kind";
import { StatusListRelationshipsEditor } from "./status-list-relationships-editor";
import { getStatusListRelationshipsCopy } from "./status-list-relationships-copy";
import { relationshipSelection, relationshipTargets } from "@/lib/status-list-relationships";
import "./status-list-question-studio.css";

type CanonicalOption = { value: string; label: string; phase: string };
type Props = {
  campaignId: string; locale: string; item: any; questionId?: string | null; allItems: any[];
  canonicalOptions: CanonicalOption[]; resolvedPhase: string | null;
  onSelectItem: (id: string) => void; onSelectQuestion: (itemId: string, questionId: string) => void;
  renderActions: (questionId: string | null) => ReactNode; renderSource: () => ReactNode;
  renderChildren: () => ReactNode; onDeleted: () => void;
  isNew?: boolean; ancestorHidden?: boolean; onSaved?: (record: any) => void; onDirtyChange?: (dirty: boolean) => void;
};
type Stage = "placement" | "content" | "answer" | "relationships" | "actions";
type StepDraft = {
  stepId: string; label: string; description: string; confirmationType: string; required: boolean;
  autoConfirmOnSubQuestion: boolean; questionSelectionMode: "single" | "multiple";
  nextStepId: string; restrictions: string; isHidden: boolean; tab: string | null;
  canonicalClinicStatusKey: string | null;
};
type QuestionDraft = {
  questionText: string; fieldType: string; icon: string; color: string; required: boolean;
  isHidden: boolean; description: string; groupName: string; logicOperator: string; gotoQuestionId: string;
};

const stages: Stage[] = ["placement", "content", "answer", "relationships", "actions"];
const stepKeys: (keyof StepDraft)[] = ["stepId", "label", "description", "confirmationType", "required", "autoConfirmOnSubQuestion", "questionSelectionMode", "nextStepId", "restrictions", "isHidden", "tab", "canonicalClinicStatusKey"];
const questionKeys: (keyof QuestionDraft)[] = ["questionText", "fieldType", "icon", "color", "required", "isHidden", "description", "groupName", "logicOperator", "gotoQuestionId"];
const phaseName = (value: string | null | undefined) => value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
const stepDraftFrom = (item: any): StepDraft => ({
  stepId: item?.stepId ?? "", label: item?.label ?? "", description: item?.description ?? "",
  confirmationType: item?.confirmationType ?? "checkbox", required: !!item?.required,
  autoConfirmOnSubQuestion: !!item?.autoConfirmOnSubQuestion,
  questionSelectionMode: item?.questionSelectionMode === "single" ? "single" : "multiple",
  nextStepId: item?.nextStepId ?? "", restrictions: item?.restrictions ?? "", isHidden: !!item?.isHidden,
  tab: item?.tab ?? null, canonicalClinicStatusKey: item?.canonicalClinicStatusKey ?? null,
});
const questionDraftFrom = (question: any): QuestionDraft => ({
  questionText: question?.questionText ?? "", fieldType: question?.fieldType ?? "checkbox",
  icon: question?.icon ?? "", color: question?.color ?? "", required: !!question?.required,
  isHidden: !!question?.isHidden, description: question?.description ?? "",
  groupName: question?.groupName ?? "", logicOperator: question?.logicOperator ?? "OR",
  gotoQuestionId: question?.gotoQuestionId ?? "",
});
const same = (a: object, b: object, keys: string[]) => keys.every(key => (a as any)[key] === (b as any)[key]);

export function StatusListQuestionStudio({
  campaignId, locale, item, questionId = null, allItems, canonicalOptions, resolvedPhase,
  onSelectItem, onSelectQuestion, renderActions, renderSource, renderChildren, onDeleted, isNew = false, ancestorHidden = false, onSaved, onDirtyChange,
}: Props) {
  const copy = getStatusListQuestionStudioCopy(locale);
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>("placement");
  const [stepDraft, setStepDraft] = useState<StepDraft>(() => stepDraftFrom(item));
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>(() => questionDraftFrom(item?.questions?.find((q: any) => q.id === questionId)));
  const [baseStep, setBaseStep] = useState<StepDraft>(() => stepDraftFrom(item));
  const [baseQuestion, setBaseQuestion] = useState<QuestionDraft>(() => questionDraftFrom(item?.questions?.find((q: any) => q.id === questionId)));
  const [error, setError] = useState("");
  const dirtyCallbackRef = useRef(onDirtyChange);
  dirtyCallbackRef.current = onDirtyChange;
  const recordKey = `${item?.id || ""}:${questionId || "step"}`;
  const initializedKey = useRef(recordKey);
  const previousSelection = useRef({ itemId: item?.id || "", questionId });
  const question = item?.questions?.find((entry: any) => entry.id === questionId);
  const isCreatingQuestion = questionId === "__new__";
  const isQuestion = isCreatingQuestion || (!!questionId && !!question);
  const stepDirty = !same(stepDraft, baseStep, stepKeys as string[]);
  const questionDirty = isQuestion && !same(questionDraft, baseQuestion, questionKeys as string[]);
  const dirty = isQuestion ? questionDirty : stepDirty;
  useEffect(() => {
    dirtyCallbackRef.current?.(!!dirty);
    return () => dirtyCallbackRef.current?.(false);
  }, [dirty]);
  const activePhase = isQuestion ? (item?.tab || resolvedPhase || null) : (stepDraft.tab || resolvedPhase || null);
  const canonicalByPhase = useMemo(() => canonicalOptions.filter(option => !activePhase || option.phase === activePhase), [canonicalOptions, activePhase]);
  const phaseOptions = ["acquisition", "contract", "retention"];
  const mutation = useMutation({
    mutationFn: async () => {
      if (isQuestion) {
        const payload = {
          questionText: questionDraft.questionText.trim(), fieldType: questionDraft.fieldType || "checkbox",
          icon: questionDraft.icon.trim() || null, color: questionDraft.color.trim() || null,
          required: questionDraft.required, isHidden: questionDraft.isHidden,
          description: questionDraft.description.trim() || null, groupName: questionDraft.groupName.trim() || null,
          logicOperator: questionDraft.logicOperator || "OR",
          gotoQuestionId: questionDraft.gotoQuestionId || null,
          sortOrder: question?.sortOrder ?? item?.questions?.length ?? 0,
        };
        const response = isCreatingQuestion
          ? await apiRequest("POST", `/api/campaigns/${campaignId}/status-list/${item.id}/questions`, payload)
          : await apiRequest("PUT", `/api/campaigns/${campaignId}/status-list/${item.id}/questions/${questionId}`, payload);
        return await response.json();
      }
      const payload = {
        stepId: stepDraft.stepId.trim(), label: stepDraft.label.trim(), description: stepDraft.description.trim() || null,
        confirmationType: stepDraft.confirmationType, required: stepDraft.required,
        autoConfirmOnSubQuestion: stepDraft.autoConfirmOnSubQuestion,
        questionSelectionMode: stepDraft.questionSelectionMode, nextStepId: stepDraft.nextStepId || null,
        restrictions: stepDraft.restrictions.trim() || null, isHidden: stepDraft.isHidden,
        tab: stepDraft.tab, canonicalClinicStatusKey: stepDraft.canonicalClinicStatusKey || null,
        ...(isNew ? { parentId: item.parentId ?? null, itemType: item.itemType || "step", sortOrder: allItems.length } : {}),
      };
      const response = isNew
        ? await apiRequest("POST", `/api/campaigns/${campaignId}/status-list`, payload)
        : await apiRequest("PUT", `/api/campaigns/${campaignId}/status-list/${item.id}`, payload);
      return await response.json();
    },
    onSuccess: record => {
      void queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/status-list-workflows/sources`] });
      void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/status-list-workflows/option-sources`] });
      void queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list-workflows"] });
      if (isQuestion) setBaseQuestion({ ...questionDraft });
      else setBaseStep({ ...stepDraft });
      setError("");
      toast({ title: copy.saved });
      onSaved?.(record);
    },
    onError: () => { setError(copy.error); toast({ title: copy.error, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const path = isQuestion
        ? `/api/campaigns/${campaignId}/status-list/${item.id}/questions/${questionId}`
        : `/api/campaigns/${campaignId}/status-list/${item.id}`;
      await apiRequest("DELETE", path);
      return true;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/status-list-workflows/sources`] });
      void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/status-list-workflows/option-sources`] });
      void queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list-workflows"] });
      onDeleted();
    },
    onError: () => toast({ title: copy.error, variant: "destructive" }),
  });

  useEffect(() => {
    if (initializedKey.current === recordKey) return;
    if (dirty && !window.confirm(copy.selectItemWarning)) {
      if (previousSelection.current.questionId) {
        onSelectQuestion(previousSelection.current.itemId, previousSelection.current.questionId);
      } else onSelectItem(previousSelection.current.itemId);
      return;
    }
    initializedKey.current = recordKey;
    previousSelection.current = { itemId: item?.id || "", questionId };
    const nextStep = stepDraftFrom(item);
    const nextQuestion = questionDraftFrom(item?.questions?.find((q: any) => q.id === questionId));
    setStepDraft(nextStep); setBaseStep(nextStep);
    setQuestionDraft(nextQuestion); setBaseQuestion(nextQuestion);
    setError("");
    setStage("placement");
  }, [recordKey, dirty, copy.selectItemWarning, item, questionId, onSelectItem, onSelectQuestion]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const setStep = <K extends keyof StepDraft>(key: K, value: StepDraft[K]) => setStepDraft(current => ({ ...current, [key]: value }));
  const setQuestion = <K extends keyof QuestionDraft>(key: K, value: QuestionDraft[K]) => setQuestionDraft(current => ({ ...current, [key]: value }));
  const cancelDraft = () => {
    if (!window.confirm(copy.discard)) return;
    setStepDraft({ ...baseStep }); setQuestionDraft({ ...baseQuestion }); setError("");
  };
  const save = () => {
    if (isQuestion && !questionDraft.questionText.trim()) { setError(copy.questionText); return; }
    if (!isQuestion && (!stepDraft.label.trim() || !stepDraft.stepId.trim())) { setError(`${copy.stepName} · ${copy.stepId}`); return; }
    const reference = isQuestion ? questionDraft.gotoQuestionId : stepDraft.nextStepId;
    const previous = isQuestion ? baseQuestion.gotoQuestionId : baseStep.nextStepId;
    // Preserve existing legacy links on unrelated edits, but do not create new
    // ambiguous/self/quick-option links or save a target deleted while editing.
    if (reference !== previous) {
      const selected = relationshipSelection(relationshipTargets(allItems, item.id, isQuestion ? questionId : null), reference);
      if (!selected.empty && (!selected.target?.selectable || selected.ambiguous)) {
        const links = getStatusListRelationshipsCopy(locale);
        setError(selected.missing ? links.missing : selected.ambiguous ? links.ambiguous : selected.target?.self ? links.self : links.quick);
        return;
      }
    }
    mutation.mutate();
  };
  const deleteRecord = () => {
    if (isNew || isCreatingQuestion || !window.confirm(copy.deleteConfirm)) return;
    deleteMutation.mutate();
  };
  const tabLabel = (value: string | null) => phaseName(value) || phaseName(resolvedPhase) || "—";
  const otherStage = (direction: -1 | 1) => {
    const index = stages.indexOf(stage);
    setStage(stages[Math.min(stages.length - 1, Math.max(0, index + direction))]);
  };
  const renderToggle = (label: string, checked: boolean, onChange: (value: boolean) => void, testId?: string) =>
    <label className="slqs-toggle" data-testid={testId}><span><strong>{label}</strong></span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><i aria-hidden="true" /></label>;
  const renderText = (label: string, value: string, onChange: (value: string) => void, testId?: string, placeholder?: string) =>
    <label className="slqs-field"><span>{label}</span><input data-testid={testId} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} /></label>;
  const previewText = isQuestion ? questionDraft.questionText : stepDraft.label;
  const previewHidden = ancestorHidden || stepDraft.confirmationType === "auto" || (isQuestion ? questionDraft.isHidden || !!stepDraft.isHidden : stepDraft.isHidden);
  const phase = isQuestion ? (item?.tab || resolvedPhase) : (stepDraft.tab || resolvedPhase);
  return <section className="slqs" data-testid="status-list-question-studio">
    <header className="slqs-header">
      <div className="slqs-heading"><span className="slqs-kicker">INDEXUS · NEXUS PULSE</span><h2>{copy.title}</h2>
        <p>{isQuestion ? `${copy.question} · ${item?.label || ""}` : `${copy.step} · ${stepDraft.label || item?.label || ""}`}</p></div>
      <div className="slqs-head-controls">
        <span className={`slqs-save-state${dirty ? " is-dirty" : ""}`} role="status"><i />{mutation.isPending ? copy.saving : dirty ? copy.dirty : copy.saved}</span>
        {!isNew && !isCreatingQuestion && <Button type="button" variant="outline" size="sm" data-testid={isQuestion ? `status-list-delete-question-${questionId}` : `status-list-delete-${item.id}`} disabled={deleteMutation.isPending} onClick={deleteRecord}>{copy.delete}</Button>}
      </div>
    </header>
    <div className="slqs-layout">
      <main className="slqs-editor">
        <nav className="slqs-stages" aria-label={copy.title}>
          {stages.map((name, index) => <button key={name} type="button" className={stage === name ? "active" : ""} aria-current={stage === name ? "step" : undefined} data-testid={`studio-stage-${name}`} onClick={() => setStage(name)}>
            <span className="slqs-stage-number">{String(index + 1).padStart(2, "0")}</span><span>{copy[name]}</span>{stage === name && <ChevronDown size={14} />}
          </button>)}
        </nav>
        <section className="slqs-stage-card" aria-live="polite">
          {stage === "placement" && <div className="slqs-stage-content">
            <div className="slqs-intro"><span className="slqs-step-marker">01 / 05</span><h3>{copy.placementTitle}</h3><p>{copy.placementHelp}</p></div>
            {ancestorHidden && <p className="slqs-impact">{getStatusListWorkspaceCopy(locale).parentHidden}</p>}
            {isQuestion ? <div className="slqs-inherit-note"><span className="slqs-inherit-mark">↳</span><div><strong>{copy.inherited}</strong><button type="button" onClick={() => onSelectItem(item.id)}>{copy.goToParent} <ArrowRight size={13} /></button></div></div> :
              <div className="slqs-fields">
                <label className="slqs-field slqs-wide"><span>{copy.phase}</span>
                  <select data-testid="status-list-phase-assignment" value={stepDraft.tab || resolvedPhase || ""} onChange={event => setStep("tab", event.target.value || null)}>
                    <option value="">{copy.sharedPhase}</option>
                    {phaseOptions.map(value => <option value={value} key={value}>{phaseName(value)}</option>)}
                  </select>
                  <small>{!item?.tab && !stepDraft.tab ? (resolvedPhase ? `${copy.inheritedPhase} (${phaseName(resolvedPhase)})` : copy.inferredPhase) : copy.impactPhase}</small>
                </label>
                <div className="slqs-wide">{renderToggle(copy.visible, !stepDraft.isHidden, value => setStep("isHidden", !value), "switch-item-hidden")}</div>
                <p className="slqs-impact slqs-wide">{stepDraft.isHidden ? copy.impactHidden : copy.impactVisible}</p>
              </div>}
          </div>}
          {stage === "content" && <div className="slqs-stage-content">
            <div className="slqs-intro"><span className="slqs-step-marker">02 / 05</span><h3>{copy.contentTitle}</h3><p>{copy.contentHelp}</p></div>
            {isQuestion ? <div className="slqs-fields">
              <label className="slqs-field slqs-wide"><span>{copy.questionText}</span><input data-testid="status-list-question-text" value={questionDraft.questionText} onChange={event => setQuestion("questionText", event.target.value)} placeholder={copy.questionText} /></label>
              <label className="slqs-field slqs-wide"><span>{copy.questionDescription}</span><textarea data-testid="status-list-question-description" rows={3} value={questionDraft.description} onChange={event => setQuestion("description", event.target.value)} placeholder={copy.guidanceExample} /></label>
              <div className="slqs-guidance slqs-wide">{copy.guidanceExample}</div>
            </div> : <div className="slqs-fields">
              {renderText(copy.stepName, stepDraft.label, value => setStep("label", value), "status-list-step-name")}
              <label className="slqs-field slqs-wide"><span>{copy.stepDescription}</span><textarea rows={5} value={stepDraft.description} onChange={event => setStep("description", event.target.value)} placeholder={copy.guidanceExample} /></label>
              <div className="slqs-guidance slqs-wide">{copy.guidanceExample}</div>
              <details className="slqs-advanced slqs-wide"><summary>{copy.advanced}</summary><div>{renderText(copy.stepId, stepDraft.stepId, value => setStep("stepId", value), "status-list-step-id")}</div></details>
            </div>}
          </div>}
          {stage === "answer" && <div className="slqs-stage-content">
            <div className="slqs-intro"><span className="slqs-step-marker">03 / 05</span><h3>{copy.answerTitle}</h3><p>{copy.answerHelp}</p></div>
            {isQuestion ? <div className="slqs-fields">
              <label className="slqs-field"><span>{copy.fieldType}</span><select data-testid="status-list-question-field-type" value={isStatusListYesNo(questionDraft.fieldType) ? "yes_no" : questionDraft.fieldType} onChange={event => setQuestion("fieldType", event.target.value)}>
                {!isStatusListYesNo(questionDraft.fieldType) && !copy.fieldTypeOptions[questionDraft.fieldType] && <option value={questionDraft.fieldType}>{questionDraft.fieldType}</option>}
                {Object.entries(copy.fieldTypeOptions).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select></label>
              <label className="slqs-field"><span>{copy.group}</span><input data-testid="status-list-question-group" value={questionDraft.groupName} onChange={event => setQuestion("groupName", event.target.value)} placeholder={copy.group} /><small>{copy.groupHelp}</small></label>
              <div className="slqs-wide slqs-toggle-pair">
                {renderToggle(copy.required, questionDraft.required, value => setQuestion("required", value), "status-list-question-required")}
                {renderToggle(copy.visible, !questionDraft.isHidden, value => setQuestion("isHidden", !value), "status-list-question-hidden")}
              </div>
              {questionDraft.groupName && <div className="slqs-impact slqs-wide">{copy.impactGroup} {questionDraft.required ? copy.impactRequired : ""}</div>}
              <div className="slqs-source-box slqs-wide"><strong>{copy.stageSource}</strong><p>{copy.sourceOwned}</p>{renderSource()}</div>
            </div> : <div className="slqs-fields">
              <label className="slqs-field"><span>{copy.confirmation}</span><select data-testid="status-list-confirmation-type" value={stepDraft.confirmationType} onChange={event => setStep("confirmationType", event.target.value)}>
                {!copy.confirmationOptions[stepDraft.confirmationType] && <option value={stepDraft.confirmationType}>{stepDraft.confirmationType}</option>}
                {Object.entries(copy.confirmationOptions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select><small>{copy.confirmationHelp}</small></label>
              <label className="slqs-field"><span>{copy.selectionMode}</span><select data-testid="status-list-selection-mode" value={stepDraft.questionSelectionMode} onChange={event => setStep("questionSelectionMode", event.target.value as "single" | "multiple")}>
                <option value="multiple">{copy.selectionMultiple}</option><option value="single">{copy.selectionSingle}</option>
              </select><small>{copy.groupHelp}</small></label>
              <div className="slqs-wide slqs-toggle-pair">
                {renderToggle(copy.required, stepDraft.required, value => setStep("required", value), "status-list-step-required")}
                {renderToggle(copy.autoConfirm, stepDraft.autoConfirmOnSubQuestion, value => setStep("autoConfirmOnSubQuestion", value), "status-list-auto-confirm")}
              </div>
              <small className="slqs-wide text-muted-foreground">{copy.impactRequired}</small>
              <label className="slqs-field slqs-wide"><span>{copy.canonical}</span><select data-testid="status-list-canonical-status" value={stepDraft.canonicalClinicStatusKey || ""} onChange={event => setStep("canonicalClinicStatusKey", event.target.value || null)}>
                <option value="">{copy.noCanonical}</option>{canonicalByPhase.map(option => <option value={option.value} key={`${option.phase}:${option.value}`}>{option.label}</option>)}
                {stepDraft.canonicalClinicStatusKey && !canonicalByPhase.some(option => option.value === stepDraft.canonicalClinicStatusKey) && <option value={stepDraft.canonicalClinicStatusKey}>{canonicalOptions.find(option => option.value === stepDraft.canonicalClinicStatusKey)?.label || stepDraft.canonicalClinicStatusKey}</option>}
              </select><small>{copy.canonicalHelp}</small></label>
              <div className="slqs-source-box slqs-wide"><strong>{copy.stageSource}</strong><p>{copy.sourceOwned}</p>{renderSource()}</div>
            </div>}
          </div>}
          {stage === "relationships" && <div className="slqs-stage-content">
            <div className="slqs-intro"><span className="slqs-step-marker">04 / 05</span><h3>{copy.relationshipsTitle}</h3><p>{copy.relationshipsHelp}</p></div>
            <StatusListRelationshipsEditor
              locale={locale} item={item} items={allItems} questionId={isQuestion ? questionId : null}
              questionText={questionDraft.questionText} questionHidden={questionDraft.isHidden} groupName={questionDraft.groupName} logicOperator={questionDraft.logicOperator}
              referenceValue={isQuestion ? questionDraft.gotoQuestionId : stepDraft.nextStepId} guidance={stepDraft.restrictions}
              onReferenceChange={value => isQuestion ? setQuestion("gotoQuestionId", value) : setStep("nextStepId", value)}
              onGroupChange={value => setQuestion("groupName", value)} onLogicChange={value => setQuestion("logicOperator", value)}
              onGuidanceChange={value => setStep("restrictions", value)}
            />
            {isQuestion && <div className="slqs-fields">
              <div className="slqs-advanced-grid slqs-wide">
                {renderText(copy.icon, questionDraft.icon, value => setQuestion("icon", value))}
                {renderText(copy.color, questionDraft.color, value => setQuestion("color", value))}
              </div>
            </div>}
            <div className="slqs-children">{renderChildren()}</div>
          </div>}
          {stage === "actions" && <div className="slqs-stage-content">
            <div className="slqs-intro"><span className="slqs-step-marker">05 / 05</span><h3>{copy.actionsTitle}</h3><p>{copy.actionsHelp}</p></div>
            <div className="slqs-action-retained"><span>✓</span><p>{copy.actionsHelp}</p></div>
            <div className="slqs-actions-content">{renderActions(questionId || null)}</div>
            {isQuestion && <div className="slqs-fields">
              <div className="slqs-advanced-grid slqs-wide">{renderText(copy.icon, questionDraft.icon, value => setQuestion("icon", value))}{renderText(copy.color, questionDraft.color, value => setQuestion("color", value))}</div>
            </div>}
          </div>}
        </section>
        <footer className="slqs-footer">
          <div className="slqs-footer-left">
            <span className={`slqs-save-state${dirty ? " is-dirty" : ""}`}><i />{mutation.isPending ? copy.saving : dirty ? copy.dirty : copy.saved}</span>
            {dirty && <Button type="button" variant="ghost" size="sm" onClick={cancelDraft}><X size={14} />{copy.cancel}</Button>}
          </div>
          <div className="slqs-footer-right">
            <Button type="button" variant="outline" size="sm" onClick={() => otherStage(-1)} disabled={stage === "placement"}><ArrowLeft size={14} />{copy.placement.split(" · ")[1]}</Button>
            {stage !== "actions" && <Button type="button" variant="outline" size="sm" onClick={() => otherStage(1)}>{stages[stages.indexOf(stage) + 1] === "content" ? copy.content.split(" · ")[1] : stages[stages.indexOf(stage) + 1] === "answer" ? copy.answer.split(" · ")[1] : stages[stages.indexOf(stage) + 1] === "relationships" ? copy.relationships.split(" · ")[1] : copy.actions.split(" · ")[1]}<ArrowRight size={14} /></Button>}
            <Button type="button" size="sm" onClick={save} disabled={!dirty || mutation.isPending} data-testid={isQuestion ? "status-list-question-save" : "status-list-save"}><Save size={14} />{isNew || isCreatingQuestion ? copy.create : copy.save}</Button>
          </div>
        </footer>
        {error && <p role="alert" className="slqs-error">{error}</p>}
      </main>
      <aside className="slqs-preview" aria-label={copy.preview}>
        <div className="slqs-preview-heading"><div><h3>{copy.preview}</h3></div><span className="slqs-preview-label">{copy.previewTag}</span></div>
        <div className="slqs-preview-device">
          <div className="slqs-preview-topline"><span>INDEXUS</span><span>{tabLabel(phase)}</span></div>
          <div className="slqs-preview-body">
            <div className="slqs-preview-progress"><i /></div>
            <span className="slqs-preview-step">{copy.previewStep}</span>
            <h4>{isQuestion ? (item?.label || stepDraft.label) : (stepDraft.label || copy.stepName)}</h4>
            {isQuestion && <div className="slqs-preview-question">
              <strong>{previewText || copy.questionText}{questionDraft.required && <em>*</em>}</strong>
              {questionDraft.description && <p>{questionDraft.description}</p>}
              {questionDraft.fieldType === "checkbox" && <div className="slqs-preview-option"><i /></div>}
              {isStatusListYesNo(questionDraft.fieldType) && <div className="slqs-preview-yesno"><span>{copy.yes}</span><span>{copy.no}</span></div>}
              {questionDraft.fieldType !== "checkbox" && !isStatusListYesNo(questionDraft.fieldType) && <p className="slqs-preview-unsupported">{copy.unsupportedPreview}</p>}
            </div>}
            {!isQuestion && stepDraft.description && <p className="slqs-preview-description">{stepDraft.description}</p>}
            {!isQuestion && stepDraft.required && <span className="slqs-required-chip">{copy.requiredMark}</span>}
            {previewHidden && <span className="slqs-preview-hidden">{copy.hiddenPreview}</span>}
          </div>
          <div className="slqs-preview-bottom"><span>{phaseName(phase) || copy.sharedPhase}</span></div>
        </div>
        <p className="slqs-preview-impact">{previewHidden ? copy.impactHidden : isQuestion ? (questionDraft.required ? copy.impactRequired : copy.impactGroup) : copy.impactVisible}</p>
        {isQuestion && <div className="slqs-preview-inherit"><span>↳</span>{copy.inherited}<button type="button" onClick={() => onSelectItem(item.id)}>{copy.goToParent}</button></div>}
        <div className="slqs-preview-detail"><span>{copy.phase}</span><strong>{tabLabel(phase)}</strong><span>{isQuestion ? copy.fieldType : copy.selectionMode}</span><strong>{isQuestion ? copy.fieldTypeOptions[isStatusListYesNo(questionDraft.fieldType) ? "yes_no" : questionDraft.fieldType] || questionDraft.fieldType : stepDraft.questionSelectionMode === "single" ? copy.selectionSingle : copy.selectionMultiple}</strong></div>
      </aside>
    </div>
  </section>;
}
