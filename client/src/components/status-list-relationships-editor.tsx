import { useId, useMemo, useState } from "react";
import {
  relationshipGroup,
  relationshipSelection,
  relationshipTargets,
  searchRelationshipTargets,
  type RelationshipItem,
  type RelationshipTarget,
} from "@/lib/status-list-relationships";
import { getStatusListRelationshipsCopy } from "./status-list-relationships-copy";
import { getStatusListQuestionStudioCopy } from "./status-list-question-studio-copy";
import { getStatusListWorkspaceCopy } from "./status-list-workspace-copy";
import "./status-list-relationships-editor.css";

type Props = {
  locale: string;
  item: RelationshipItem;
  items: RelationshipItem[];
  questionId: string | null;
  questionText: string;
  questionHidden: boolean;
  groupName: string;
  logicOperator: string;
  referenceValue: string;
  guidance: string;
  onReferenceChange: (value: string) => void;
  onGroupChange: (value: string) => void;
  onLogicChange: (value: string) => void;
  onGuidanceChange: (value: string) => void;
};

type RelationshipTargetCardProps = {
  target: RelationshipTarget;
  selected: boolean;
  locale: string;
  onSelect: (value: string) => void;
};

function RelationshipTargetCard({ target, selected, locale, onSelect }: RelationshipTargetCardProps) {
  const studio = getStatusListQuestionStudioCopy(locale);
  const workspace = getStatusListWorkspaceCopy(locale);
  const copy = getStatusListRelationshipsCopy(locale);
  const phase = target.phase && target.phase in workspace
    ? workspace[target.phase as keyof typeof workspace]
    : studio.sharedPhase;
  const technicalCode = target.kind === "step" ? target.step : target.questionId || target.value;

  return (
    <button
      type="button"
      className={`slre-target${selected ? " is-selected" : ""}`}
      data-testid={`relationship-target-${target.key}`}
      aria-pressed={selected}
      disabled={!target.selectable}
      title={!target.selectable ? target.self ? copy.self : target.ambiguous ? copy.ambiguous : copy.quick : undefined}
      onClick={() => onSelect(target.value)}
    >
      <span className="slre-target-main">
        <span className="slre-target-label">{target.label || studio.questionText}</span>
        {target.kind === "question" && <span className="slre-target-code">{target.parentLabel} · {target.step}</span>}
        <span className="slre-target-code">{technicalCode}</span>
        {!target.selectable && <small>{target.self ? copy.selfLabel : target.ambiguous ? copy.duplicateLabel : copy.quickLabel}</small>}
      </span>
      <span className="slre-target-meta">
        <span>{target.kind === "step" ? copy.steps : copy.questions}</span>
        <span>{studio.phase}: {phase}</span>
        <span className={target.hidden ? "slre-target-hidden" : "slre-target-visible"}>
          {target.hidden ? workspace.hidden : workspace.visible}
        </span>
      </span>
    </button>
  );
}

function SelectedRelationshipSummary({ target, locale }: { target: RelationshipTarget; locale: string }) {
  const studio = getStatusListQuestionStudioCopy(locale);
  const copy = getStatusListRelationshipsCopy(locale);
  const workspace = getStatusListWorkspaceCopy(locale);
  const phase = target.phase && target.phase in workspace
    ? workspace[target.phase as keyof typeof workspace]
    : studio.sharedPhase;
  return (
    <div className="slre-saved-summary">
      <span className="slre-target-label">{target.label || studio.questionText}</span>
      {target.kind === "question" && <span>{target.parentLabel} · {target.step}</span>}
      <code>{target.kind === "step" ? target.step : target.questionId || target.value}</code>
      <span>{target.kind === "step" ? copy.steps : copy.questions}</span>
      <span>{studio.phase}: {phase}</span>
      <span className={target.hidden ? "slre-target-hidden" : "slre-target-visible"}>
        {target.hidden ? workspace.hidden : workspace.visible}
      </span>
    </div>
  );
}

function RelationshipGroupDraft({
  locale,
  item,
  questionId,
  questionText,
  questionHidden,
  groupName,
  logicOperator,
  onGroupChange,
  onLogicChange,
}: Pick<Props, "locale" | "item" | "questionId" | "questionText" | "questionHidden" | "groupName" | "logicOperator" | "onGroupChange" | "onLogicChange">) {
  const studio = getStatusListQuestionStudioCopy(locale);
  const copy = getStatusListRelationshipsCopy(locale);
  const workspace = getStatusListWorkspaceCopy(locale);
  const draftQuestion = {
    id: questionId || "__new__",
    questionText,
    groupName,
    logicOperator,
    isHidden: questionHidden,
  };
  const group = relationshipGroup(item, draftQuestion);
  const datalistId = useId();
  const headingId = useId();

  return (
    <section className="slre-group" aria-labelledby={headingId}>
      <h3 id={headingId}>{copy.group}</h3>
      <div className="slre-group-fields">
        <label className="slre-field">
          <span>{studio.group}</span>
          <input
            data-testid="status-list-question-group"
            list={datalistId}
            value={groupName}
            onChange={event => onGroupChange(event.target.value)}
          />
          <datalist id={datalistId}>
            {group.names.map(name => <option key={name} value={name} />)}
          </datalist>
          <small>{copy.groupingHelp}</small>
        </label>
        <label className="slre-field">
          <span>{studio.logic}</span>
          <select
            data-testid="status-list-question-logic"
            value={logicOperator}
            onChange={event => onLogicChange(event.target.value)}
          >
            {!["OR", "AND", "ONE"].includes(logicOperator) && logicOperator && (
              <option value={logicOperator}>{logicOperator}</option>
            )}
            <option value="OR">{studio.logicOr}</option>
            <option value="AND">{studio.logicAnd}</option>
            <option value="ONE">{studio.logicOne}</option>
          </select>
        </label>
      </div>
      <div className="slre-members" data-testid="relationship-group-members">
        <strong>{copy.members}</strong>
        {group.members.length ? (
          <ul>
            {group.members.map((member, index) => (
              <li key={`${member.id}:${index}`}>
                <span>{member.questionText || studio.questionText}</span>
                {member.isHidden && <span className="slre-target-hidden">{workspace.hidden}</span>}
                <span className="slre-member-mode">{member.logicOperator || "OR"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>{copy.ungrouped}</p>
        )}
      </div>
      <div className="slre-warnings" aria-live="polite">
        {group.mixed && <p className="slre-warning" data-testid="relationship-group-mixed">{copy.mixed}</p>}
        {group.unknownLogic && <p className="slre-warning" data-testid="relationship-group-unknown">{copy.unknown}</p>}
        {group.stepSingle && <p className="slre-warning" data-testid="relationship-group-single">{copy.stepSingle}</p>}
      </div>
      <p className="slre-scope-note">{copy.currentOnly}</p>
    </section>
  );
}

function RelationshipTargetPicker({
  locale,
  item,
  items,
  questionId,
  referenceValue,
  onReferenceChange,
}: Pick<Props, "locale" | "item" | "items" | "questionId" | "referenceValue" | "onReferenceChange">) {
  const copy = getStatusListRelationshipsCopy(locale);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | "step" | "question">("all");
  const headingId = useId();
  const isQuestion = questionId !== null;
  const wrapperTestId = isQuestion ? "status-list-question-goto" : "status-list-step-next-step";
  const targets = useMemo(
    () => relationshipTargets(items, item.id, questionId),
    [items, item.id, questionId],
  );
  const selection = relationshipSelection(targets, referenceValue);
  const filteredTargets = searchRelationshipTargets(targets, search, isQuestion ? kind : "step");

  const selectedSummary = selection.target
    ? <SelectedRelationshipSummary target={selection.target} locale={locale} />
    : selection.missing
      ? <div className="slre-saved-raw">
          <strong>{copy.selected}</strong><code>{referenceValue}</code>
        </div>
      : null;

  return (
    <section className="slre-picker" data-testid={wrapperTestId} aria-labelledby={headingId}>
      <div className="slre-picker-heading">
        <h3 id={headingId}>{copy.target}</h3>
        <p>{isQuestion ? copy.reference : copy.manual}</p>
      </div>

      {selectedSummary && (
        <div className="slre-selected" data-testid="relationship-selected">
          <span className="slre-selected-label">{copy.selected}</span>
          {selectedSummary}
          <button type="button" className="slre-clear" data-testid="relationship-clear" onClick={() => onReferenceChange("")}>
            {copy.clear}
          </button>
        </div>
      )}

      <div className="slre-controls">
        <label className="slre-field slre-search">
          <span>{copy.search}</span>
          <input
            data-testid="relationship-target-search"
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </label>
        {isQuestion && (
          <label className="slre-field slre-kind">
            <span>{copy.target}</span>
            <select data-testid="relationship-target-kind" value={kind} onChange={event => setKind(event.target.value as typeof kind)}>
              <option value="all">{copy.all}</option>
              <option value="step">{copy.steps}</option>
              <option value="question">{copy.questions}</option>
            </select>
          </label>
        )}
      </div>

      <div className="slre-warnings" aria-live="polite">
        {selection.missing && <p className="slre-warning" data-testid="relationship-missing">{copy.missing}</p>}
        {!selection.missing && selection.ambiguous && <p className="slre-warning" data-testid="relationship-ambiguous">{copy.ambiguous}</p>}
        {selection.target?.self && <p className="slre-warning">{copy.self}</p>}
        {selection.target?.quickOption && <p className="slre-warning">{copy.quick}</p>}
        {selection.target?.hidden && <p className="slre-warning" data-testid="relationship-hidden">{copy.hidden}</p>}
      </div>

      <div className="slre-target-list" role="group" aria-label={copy.target}>
        <button
          type="button"
          className={`slre-target slre-none${selection.empty ? " is-selected" : ""}`}
          aria-pressed={selection.empty}
          onClick={() => onReferenceChange("")}
        >
          <span className="slre-target-main"><span className="slre-target-label">{copy.none}</span></span>
        </button>
        {filteredTargets.map(target => (
          <RelationshipTargetCard
            key={target.key}
            target={target}
            selected={target.value === referenceValue}
            locale={locale}
            onSelect={onReferenceChange}
          />
        ))}
        {!filteredTargets.length && <p className="slre-no-results">{copy.noResults}</p>}
      </div>
    </section>
  );
}

export function StatusListRelationshipsEditor(props: Props) {
  const isQuestion = props.questionId !== null;
  const studio = getStatusListQuestionStudioCopy(props.locale);
  return (
    <section className="slre" aria-label={studio.relationshipsTitle} data-testid="status-list-relationships-editor">
      {!isQuestion && (
        <label className="slre-field slre-guidance">
          <span>{studio.restrictions}</span>
          <textarea
            data-testid="status-list-step-restrictions"
            rows={4}
            value={props.guidance}
            onChange={event => props.onGuidanceChange(event.target.value)}
            placeholder={studio.restrictionsHelp}
          />
          <small>{studio.restrictionsHelp}</small>
        </label>
      )}
      {isQuestion && (
        <RelationshipGroupDraft
          locale={props.locale}
          item={props.item}
          questionId={props.questionId}
          questionText={props.questionText}
          questionHidden={props.questionHidden}
          groupName={props.groupName}
          logicOperator={props.logicOperator}
          onGroupChange={props.onGroupChange}
          onLogicChange={props.onLogicChange}
        />
      )}
      <RelationshipTargetPicker
        locale={props.locale}
        item={props.item}
        items={props.items}
        questionId={props.questionId}
        referenceValue={props.referenceValue}
        onReferenceChange={props.onReferenceChange}
      />
    </section>
  );
}
