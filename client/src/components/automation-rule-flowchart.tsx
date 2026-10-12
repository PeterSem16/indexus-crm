import { useEffect, useId, useRef, useState, type ReactNode } from "react";
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
    <section className={`indexus-flowchart__node indexus-flowchart__node--${kind}`} aria-label={`${label}: ${step.title}`} data-flow-node={kind}>
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
        <div className="indexus-flowchart__leaf" role="group" aria-label={[condition.field, condition.operator, condition.value].filter(value => value !== undefined).join(" ")}>
          <span className="indexus-flowchart__leaf-field">{condition.field}</span>
          <span className="indexus-flowchart__leaf-operator">{condition.operator}</span>
          {condition.value !== undefined && <span className="indexus-flowchart__leaf-value">{condition.value}</span>}
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

function FlowConnector({ from, to }: { from: string; to: string }) {
  return (
    <div
      className="indexus-flowchart__connector"
      data-flow-connection={`${from}-${to}`}
      data-connection-from={from}
      data-connection-to={to}
      aria-hidden="true"
    />
  );
}

function ActionList({ actions, copy }: { actions: FlowStep[]; copy: ReturnType<typeof getFlowchartCopy> }) {
  if (!actions.length) return <div className="indexus-flowchart__no-action">{copy.noActions}</div>;
  return (
    <ol className="indexus-flowchart__actions" aria-label={copy.actions}>
      {actions.map((action, index) => (
        <li className="indexus-flowchart__action-item" key={`${action.title}-${index}`}>
          <section className="indexus-flowchart__action">
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
          </section>
          {index < actions.length - 1 && (
            <div
              className="indexus-flowchart__action-connector"
              data-flow-connection={`action-${index + 1}-to-${index + 2}`}
              data-connection-from={`action-${index + 1}`}
              data-connection-to={`action-${index + 2}`}
              aria-hidden="true"
            />
          )}
        </li>
      ))}
    </ol>
  );
}

type BranchGeometry = { width: number; height: number; paths: { id: string; d: string }[] };

export function AutomationRuleFlowchart({ model, locale, compact = false }: AutomationRuleFlowchartProps) {
  const copy = getFlowchartCopy(locale);
  const conditionHeadingId = useId();
  const conditional = model.conditions !== null;
  const conditionsIgnored = "conditionsIgnored" in model && model.conditionsIgnored === true;
  const conditionActive = conditional && !conditionsIgnored;
  const hasAnalysis = Boolean(model.analysis);
  const sequenceRef = useRef<HTMLDivElement>(null);
  const [branchGeometry, setBranchGeometry] = useState<BranchGeometry | null>(null);

  useEffect(() => {
    if (!conditionActive) {
      setBranchGeometry(null);
      return;
    }
    const root = sequenceRef.current;
    if (!root) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const decision = root.querySelector<HTMLElement>('[data-flow-decision="root"]');
        const yes = root.querySelector<HTMLElement>('[data-flow-branch="yes"]');
        const no = root.querySelector<HTMLElement>('[data-flow-branch="no"]');
        if (!decision || !yes || !no) return;
        const bounds = root.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        // Dialog entrance transforms affect screen coordinates, not layout size.
        // Normalize to this SVG's local coordinates before measuring its paths.
        const width = root.clientWidth;
        const height = root.clientHeight;
        const localX = (x: number) => (x - bounds.left) * width / bounds.width;
        const localY = (y: number) => (y - bounds.top) * height / bounds.height;
        const source = decision.getBoundingClientRect();
        const yesBounds = yes.getBoundingClientRect();
        const noBounds = no.getBoundingClientRect();
        const sx = localX(source.left + source.width / 2);
        const sy = localY(source.bottom);
        const yY = localY(yesBounds.top) + 1;
        const nY = localY(noBounds.top) + 1;
        const midY = Math.min(yY, nY) - 12;
        const path = (x: number, y: number) => `M ${sx} ${sy} V ${midY} H ${x} V ${y}`;
        setBranchGeometry({
          width,
          height,
          paths: [
            { id: "decision-yes", d: path(localX(yesBounds.left + yesBounds.width / 2), yY) },
            { id: "decision-no", d: path(localX(noBounds.left + noBounds.width / 2), nY) },
          ],
        });
      });
    };
    const observed = [
      root,
      root.querySelector<HTMLElement>('[data-flow-decision="root"]'),
      root.querySelector<HTMLElement>('[data-flow-branch="yes"]'),
      root.querySelector<HTMLElement>('[data-flow-branch="no"]'),
    ].filter((item): item is HTMLElement => item !== null);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observed.forEach((element) => observer?.observe(element));
    window.addEventListener("resize", measure);
    root.addEventListener("animationend", measure);
    root.addEventListener("transitionend", measure);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      root.removeEventListener("animationend", measure);
      root.removeEventListener("transitionend", measure);
    };
  }, [conditionActive, model.actions.length, hasAnalysis, compact]);

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

      <div className="indexus-flowchart__sequence" ref={sequenceRef}>
        <FlowStepCard step={model.trigger} label={copy.trigger} number="01" kind="trigger" />
        {model.analysis && (
          <>
            <FlowConnector from="trigger" to="analysis" />
            <FlowStepCard step={model.analysis} label={copy.analysis} number="02" kind="analysis" />
          </>
        )}

        {conditionActive && (
          <>
            <FlowConnector from={hasAnalysis ? "analysis" : "trigger"} to="decision" />
            <section
              className="indexus-flowchart__node indexus-flowchart__node--condition"
              aria-labelledby={conditionHeadingId}
              data-flow-decision="root"
              data-flow-node="decision"
            >
              <div className="indexus-flowchart__condition-heading">
                <span className="indexus-flowchart__condition-icon" aria-hidden="true">?</span>
                <div>
                  <h3 className="indexus-flowchart__condition-label" id={conditionHeadingId}>{copy.conditions}</h3>
                  <p className="indexus-flowchart__condition-note">{copy.decisionSummary}</p>
                </div>
              </div>
              <div className="indexus-flowchart__condition-tree">
                {model.conditions && <ConditionNode condition={model.conditions} copy={copy} />}
              </div>
            </section>
            <div className="indexus-flowchart__branches" aria-label={copy.conditions}>
              {branchGeometry && (
                <svg
                  className="indexus-flowchart__branch-wires"
                  width={branchGeometry.width}
                  height={branchGeometry.height}
                  viewBox={`0 0 ${branchGeometry.width} ${branchGeometry.height}`}
                  aria-hidden="true"
                >
                  <defs>
                    <marker id={`${conditionHeadingId}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" />
                    </marker>
                  </defs>
                  {branchGeometry.paths.map(({ id, d }) => (
                    <path
                      key={id}
                      d={d}
                      markerEnd={`url(#${conditionHeadingId}-arrow)`}
                      data-flow-connection={id}
                      data-connection-from="decision"
                      data-connection-to={id.replace("decision-", "")}
                    />
                  ))}
                </svg>
              )}
              <section className="indexus-flowchart__branch indexus-flowchart__branch--yes" aria-label={copy.yes} data-flow-branch="yes">
                <p className="indexus-flowchart__branch-label"><span>{copy.yes}</span></p>
                <ActionList actions={model.actions} copy={copy} />
              </section>
              <section className="indexus-flowchart__branch indexus-flowchart__branch--no" aria-label={copy.no} data-flow-branch="no">
                <p className="indexus-flowchart__branch-label"><span>{copy.no}</span></p>
                <div className="indexus-flowchart__terminal">
                  <strong>{copy.stop}</strong>
                  <span>{copy.noAction}</span>
                </div>
              </section>
            </div>
          </>
        )}

        {!conditionActive && (
          <>
            {!conditional && (
              <>
                <FlowConnector from={hasAnalysis ? "analysis" : "trigger"} to="conditions" />
                <section className="indexus-flowchart__node indexus-flowchart__node--condition">
                  <div className="indexus-flowchart__condition-heading">
                    <span className="indexus-flowchart__condition-icon" aria-hidden="true">—</span>
                    <div>
                      <h3 className="indexus-flowchart__condition-label">{copy.conditions}</h3>
                      <p className="indexus-flowchart__condition-note">{copy.noConditions}</p>
                    </div>
                  </div>
                </section>
                <FlowConnector from="conditions" to="actions" />
              </>
            )}
            {conditional && (
              <FlowConnector from={hasAnalysis ? "analysis" : "trigger"} to="actions" />
            )}
            <section className="indexus-flowchart__node indexus-flowchart__node--condition" data-flow-node="actions">
              <div className="indexus-flowchart__condition-heading">
                <span className="indexus-flowchart__condition-icon" aria-hidden="true">→</span>
                <div>
                  <h3 className="indexus-flowchart__condition-label">{copy.actions}</h3>
                  <p className="indexus-flowchart__condition-note">{copy.unconditional}</p>
                </div>
              </div>
              <ActionList actions={model.actions} copy={copy} />
            </section>
          </>
        )}

        {conditionsIgnored && model.conditions && (
          <aside className="indexus-flowchart__reference" aria-label={copy.conditionsIgnored} data-flow-reference="ignored-conditions">
            <p className="indexus-flowchart__reference-label">{copy.reference}</p>
            <section className="indexus-flowchart__node indexus-flowchart__node--condition indexus-flowchart__node--ignored">
              <div className="indexus-flowchart__condition-heading">
                <span className="indexus-flowchart__condition-icon" aria-hidden="true">i</span>
                <div>
                  <h3 className="indexus-flowchart__condition-label">{copy.conditions}</h3>
                  <p className="indexus-flowchart__condition-note">{copy.conditionsIgnored}</p>
                </div>
              </div>
              <div className="indexus-flowchart__condition-tree"><ConditionNode condition={model.conditions} copy={copy} /></div>
            </section>
          </aside>
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
