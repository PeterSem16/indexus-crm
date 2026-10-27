import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { SourceEditorCopy } from "./status-list-source-editor-copy";
import "./status-list-source-editor.css";

export type SourceEditorStage = "source" | "mapping" | "evaluation" | "review";
export function StatusListSourceEditor({ copy, context, editing, stage, onStage, onNext, onBack, onSave, onCancel, saving, canSave, saveDisabledReason, children }: {
  copy: SourceEditorCopy; context: string; editing: boolean; stage: SourceEditorStage;
  onStage: (stage: SourceEditorStage) => void; onNext: () => void; onBack: () => void;
  onSave: () => void; onCancel: () => void; saving: boolean; canSave: boolean; saveDisabledReason?: string; children: ReactNode;
}) {
  const stages: SourceEditorStage[] = ["source", "mapping", "evaluation", "review"];
  const labels: Record<SourceEditorStage, string> = { source: copy.source, mapping: copy.mapping, evaluation: copy.evaluation, review: copy.review };
  const descriptions: Record<SourceEditorStage, string> = { source: copy.stageSource, mapping: copy.stageMapping, evaluation: copy.stageEvaluation, review: copy.stageReview };
  const index = stages.indexOf(stage);
  return <div className="slse" data-testid="status-list-source-editor">
    <header className="slse-head"><div><span className="slse-kicker">INDEXUS · STATUS LIST</span><h3>{editing ? copy.edit : copy.create}</h3><p>{descriptions[stage]}</p></div><span className="slse-context">{context}</span></header>
    <nav className="slse-stages" aria-label={copy.reviewTitle}>
      {stages.map((name, i) => <button key={name} type="button" data-testid={`source-editor-stage-${name}`} aria-current={stage === name ? "step" : undefined} onClick={() => onStage(name)}>
        <span className="slse-num">{String(i + 1).padStart(2, "0")}</span>{labels[name]}
      </button>)}
    </nav>
    <div className="slse-body" aria-live="polite">{children}</div>
    <footer className="slse-foot">
      <div className="slse-foot-group"><Button type="button" size="sm" variant="ghost" data-testid="source-editor-cancel" onClick={onCancel} disabled={saving}>{copy.cancel}</Button>
        {index > 0 && <Button type="button" size="sm" variant="outline" data-testid="source-editor-back" onClick={onBack} disabled={saving}>{copy.back}</Button>}</div>
      {stage === "review"
        ? <div className="slse-foot-group"><span className={`slse-foot-note${!canSave && saveDisabledReason ? " text-destructive" : ""}`} role={!canSave && saveDisabledReason ? "status" : undefined}>{saving ? "" : !canSave && saveDisabledReason ? saveDisabledReason : copy.noReplay}</span><Button type="button" size="sm" data-testid="source-editor-save" onClick={onSave} disabled={!canSave || saving}>{saving ? copy.saving : copy.save}</Button></div>
        : <Button type="button" size="sm" data-testid="source-editor-next" onClick={onNext} disabled={saving}>{copy.next}</Button>}
    </footer>
  </div>;
}
