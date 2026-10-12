import { useId, type ReactNode } from "react";
import type { AutomationFlowModel, FlowCondition, FlowDetail, FlowStep } from "../lib/automation-flow-model";
import type { Locale } from "../i18n";
import { getFlowchartCopy } from "../i18n/automation-flowchart-copy";
import "./automation-rule-flowchart.css";

type AutomationRuleFlowchartProps = {
  model: AutomationFlowModel;
  locale: Locale;
  compact?: boolean;
};

function StepDetails({ details }: { details: FlowDetail[] }) {
  if (!details.length) return null;
  return (
    <dl className="indexus-flowchart__step-details">
      {details.map((detail, index) => (
        <div className="indexus-flowchart__detail" key={`${detail.label}-${index}`}>
          <dt className="indexus-flowchart__detail-label">{detail.label}</dt>
          <dd className="indexus-flowchart__detail-value">{detail.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function FlowStepCard({
  step,
  label,
  number,
  kind,
}: {
  step: FlowStep;
  label: string;
  number: string;
  kind: "trigger" | "analysis";
}) {
  return (
    <section className={`indexus-flowchart__node indexus-flowchart__node--${kind}`} aria-label={`${label}: ${step.title}`}>
      <div className="indexus-flowchart__node-head">
        <span className="indexus-flowchart__step-number" aria-hidden="true">{number}</span>
        <div className="indexus-flowchart__node-copy">
          <span className="indexus-flowchart__node-kicker">{label}</span>
          <h3 className="indexus-flowchart__node-title">{step.title}</h3>
        </div>
      </div>
      <StepDetails details={step.details} />
    </section>
  );
}

function ConditionNode({
  condition,
  copy,
}: {
  condition: FlowCondition;
  copy: ReturnType<typeof getFlowchartCopy>;
}): ReactNode {
  if (condition.kind === "leaf") {
    return (
      <div className="indexus-flowchart__condition">
        <div className="indexus-flowchart__leaf" role="group" aria-label={`${condition.field} ${condition.operator} ${condition.value ?? copy.unknown}`}>
          <span className="indexus-flowchart__leaf-field">{condition.field}</span>
          <span className="indexus-flowchart__leaf-operator">{condition.operator}</span>
          <span className="indexus-flowchart__leaf-value">{condition.value ?? copy.unknown}</span>
        </div>
      </div>
    );
  }

  const groupLabel = condition.kind === "all" ? copy.all : condition.kind === "any" ? copy.any : copy.not;
  const explanation = condition.kind === "all" ? copy.allHint : condition.kind === "any" ? copy.anyHint : copy.notHint;
  const hintClass = condition.kind === "any" ? "any" : condition.kind === "not" ? "not" : "all";

  return (
    <section
      className="indexus-flowchart__group"
      role="group"
      aria-label={`${groupLabel}: ${explanation}`}
    >
      <div className="indexus-flowchart__group-head">
        <span className={`indexus-flowchart__logic-badge indexus-flowchart__logic-badge--${hintClass}`}>{groupLabel}</span>
        <span className="indexus-flowchart__group-explainer">{explanation}</span>
      </div>
      <div className="indexus-flowchart__condition-tree">
        {condition.children.length ? condition.children.map((child, index) => (
          <ConditionNode key={`${condition.kind}-${index}`} condition={child} copy={copy} />
        )) : (
          <p className="indexus-flowchart__empty">
            {condition.kind === "all" ? copy.emptyAll : condition.kind === "any" ? copy.emptyAny : copy.emptyNot}
          </p>
        )}
      </div>
    </section>
  );
}

function ScopeItems({ details, label }: { details: FlowDetail[]; label: string }) {
  if (!details.length) return null;
  return (
    <div className="indexus-flowchart__scope" aria-label={label}>
      {details.map((detail, index) => (
        <span className="indexus-flowchart__scope-item" key={`${detail.label}-${index}`}>
          <strong>{detail.label}</strong>
          <span>{detail.value}</span>
        </span>
      ))}
    </div>
  );
}

function ActionList({ actions, copy }: { actions: FlowStep[]; copy: ReturnType<typeof getFlowchartCopy> }) {
  if (!actions.length) return <div className="indexus-flowchart__no-action">{copy.noActions}</div>;
  return (
    <ol className="indexus-flowchart__actions" aria-label={copy.actions}>
      {actions.map((action, index) => (
        <li className="indexus-flowchart__action" key={`${action.title}-${index}`}>
          <span className="indexus-flowchart__action-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <div className="indexus-flowchart__action-content">
            <h4 className="indexus-flowchart__action-title">{action.title}</h4>
            {action.details.length > 0 && (
              <dl className="indexus-flowchart__action-details">
                {action.details.map((detail, detailIndex) => (
                  <div className="indexus-flowchart__detail" key={`${detail.label}-${detailIndex}`}>
                    <dt className="indexus-flowchart__detail-label">{detail.label}</dt>
                    <dd className="indexus-flowchart__detail-value">{detail.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function AutomationRuleFlowchart({ model, locale, compact = false }: AutomationRuleFlowchartProps) {
  const copy = getFlowchartCopy(locale);
  const conditionHeadingId = useId();
  const conditional = model.conditions !== null;
  const conditionsIgnored = "conditionsIgnored" in model && model.conditionsIgnored === true;
  const conditionActive = conditional && !conditionsIgnored;
  const hasAnalysis = Boolean(model.analysis);

  return (
    <article
      className={`indexus-flowchart${compact ? " indexus-flowchart--compact" : ""}`}
      aria-label={`${copy.preview}: ${model.title}`}
    >
      <header className="indexus-flowchart__header">
        <div className="indexus-flowchart__identity">
          <p className="indexus-flowchart__eyebrow">{copy.preview}</p>
          <h2 className="indexus-flowchart__title">{model.title}</h2>
          {model.description && <p className="indexus-flowchart__description">{model.description}</p>}
        </div>
        <span className={`indexus-flowchart__status${model.enabled ? " is-active" : ""}`}>
          {model.enabled ? copy.active : copy.paused}
        </span>
      </header>

      <ScopeItems details={model.scope} label={copy.scope} />

      <div className="indexus-flowchart__sequence">
        <FlowStepCard step={model.trigger} label={copy.trigger} number="01" kind="trigger" />
        <div className="indexus-flowchart__connector" aria-hidden="true" />

        {model.analysis && (
          <>
            <FlowStepCard step={model.analysis} label={copy.analysis} number="02" kind="analysis" />
            <div className="indexus-flowchart__connector" aria-hidden="true" />
          </>
        )}

        {conditional && (
          <section
            className={`indexus-flowchart__node indexus-flowchart__node--condition${conditionsIgnored ? " indexus-flowchart__node--ignored" : ""}`}
            aria-labelledby={conditionHeadingId}
            aria-label={conditionsIgnored ? copy.conditionsIgnored : undefined}
          >
            <div className="indexus-flowchart__condition-heading">
              <span className="indexus-flowchart__condition-icon" aria-hidden="true">{conditionsIgnored ? "i" : "?"}</span>
              <div>
                <h3 className="indexus-flowchart__condition-label" id={conditionHeadingId}>{copy.conditions}</h3>
                <p className="indexus-flowchart__condition-note">
                  {conditionsIgnored ? copy.conditionsIgnored : copy.conditionNote}
                </p>
              </div>
            </div>
            <div className="indexus-flowchart__condition-tree">
              {model.conditions && <ConditionNode condition={model.conditions} copy={copy} />}
            </div>
          </section>
        )}

        {conditionActive ? (
          <div className="indexus-flowchart__branches" aria-label={copy.conditions}>
            <section className="indexus-flowchart__branch indexus-flowchart__branch--yes" aria-label={copy.yes}>
              <p className="indexus-flowchart__branch-label"><span>{copy.yes}</span></p>
              <ActionList actions={model.actions} copy={copy} />
            </section>
            <section className="indexus-flowchart__branch indexus-flowchart__branch--no" aria-label={copy.no}>
              <p className="indexus-flowchart__branch-label"><span>{copy.no}</span></p>
              <div className="indexus-flowchart__no-action">{copy.noAction}</div>
            </section>
          </div>
        ) : (
          <>
            {!conditional && (
              <section className="indexus-flowchart__node indexus-flowchart__node--condition" aria-label={copy.conditions}>
                <div className="indexus-flowchart__condition-heading">
                  <span className="indexus-flowchart__condition-icon" aria-hidden="true">—</span>
                  <div>
                    <h3 className="indexus-flowchart__condition-label">{copy.conditions}</h3>
                    <p className="indexus-flowchart__condition-note">{copy.noConditions}</p>
                  </div>
                </div>
              </section>
            )}
            <div className="indexus-flowchart__connector" aria-hidden="true" />
            <section className="indexus-flowchart__node indexus-flowchart__node--condition" aria-label={copy.actions}>
              <div className="indexus-flowchart__condition-heading">
                <span className="indexus-flowchart__condition-icon" aria-hidden="true">→</span>
                <div>
                  <h3 className="indexus-flowchart__condition-label">{copy.actions}</h3>
                  <p className="indexus-flowchart__condition-note">
                    {conditionsIgnored && conditional ? copy.conditionsIgnored : copy.unconditional}
                  </p>
                </div>
              </div>
              <ActionList actions={model.actions} copy={copy} />
            </section>
          </>
        )}
      </div>

      <p className="indexus-flowchart__definition-note">{copy.definitionNotice}</p>
      <span className="indexus-flowchart__sr-only">
        {hasAnalysis ? `${copy.analysis}: ${model.analysis?.title}. ` : ""}
        {copy.actions}: {model.actions.map((action) => action.title).join(", ") || copy.noActions}.
      </span>
    </article>
  );
}

export default AutomationRuleFlowchart;
