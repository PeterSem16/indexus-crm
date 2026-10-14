import { analysisResultLabel, legacyNegativeTriggerLabel } from "@shared/automation-analysis-triggers";
import { useState, type ReactNode } from "react";
import { Activity, ArrowRight, ChevronDown, ChevronRight, CircleAlert, Clock3, Globe2,
  History, Loader2, RotateCcw, Search, Settings2, ShieldCheck, SlidersHorizontal,
  Trash2, Workflow, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { getFlowchartCopy } from "@/i18n/automation-flowchart-copy";
import { getFlowExtraLabels } from "@/i18n/automation-flow-labels";
import { getRecordEntryCopy } from "@/i18n/automation-record-entry-copy";
import { getForwardCopy } from "@/i18n/automation-forward-copy";
import { getUnifiedAutomationCopy } from "@/lib/automation-unified-copy";
import { matchesRuleState, ruleCountries, ruleHasErrors, ruleNeedsReview,
  type OverviewCatalog, type OverviewRule } from "@/lib/automation-overview-model";
import "./automation-overview.css";

type Props = {
  rules: OverviewRule[]; catalog?: OverviewCatalog; loading: boolean; error: boolean; busy: boolean;
  onRetry: () => void; onCreate: () => void;
  onToggle: (rule: OverviewRule) => void; onEdit: (rule: OverviewRule) => void;
  onFlow: (rule: OverviewRule) => void; onHistory: (rule: OverviewRule) => void;
  onReset: (rule: OverviewRule) => void; onReview: (rule: OverviewRule) => void;
  onDelete: (rule: OverviewRule) => void; children?: ReactNode;
};

export function AutomationRulesOverview(props: Props) {
  const { t, locale } = useI18n();
  const copy = t.automationOverview;
  const flow = getFlowchartCopy(locale);
  const extra = getFlowExtraLabels(locale);
  const unified = getUnifiedAutomationCopy(locale);
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("all");
  const [state, setState] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const resetFilters = () => { setSearch(""); setCountry("all"); setState("all"); };
  const moduleLabel = (key: string) => t.automationServices.editorCatalog.moduleLabels[key]
    || props.catalog?.modules.find(option => option.value === key)?.label || key;
  const eventLabel = (key: string) => (key === "sentiment.negative" ? legacyNegativeTriggerLabel(locale) : analysisResultLabel(locale, key)) || t.automationServices.editorCatalog.eventLabels[key]
    || props.catalog?.eventTypes.find(option => option.value === key)?.label || key;
  const actionLabel = (key: string) => key === "record_analysis" ? getRecordEntryCopy(locale).actionLabel
    : key === "forward_message" ? getForwardCopy(locale).heading
      : (t.automationServices.names as Record<string, string>)[key]
        || props.catalog?.actionTypes.find(option => option.value === key)?.label || key;
  const triggerLabel = (rule: OverviewRule) => rule.trigger?.type === "schedule"
    ? `${flow.schedule}${extra[`value.${rule.trigger.interval}`] ? ` · ${extra[`value.${rule.trigger.interval}`]}` : ""}`
    : eventLabel(rule.trigger?.eventType || rule.module);
  const countriesLabel = (rule: OverviewRule) => ruleCountries(rule).map(code =>
    props.catalog?.countries.find(option => option.value === code)?.label || code).join(", ") || copy.allCountries;
  const filtered = props.rules.filter(rule =>
    [rule.name, rule.description, moduleLabel(rule.module), triggerLabel(rule),
      countriesLabel(rule), ...(rule.actions || []).map(action => actionLabel(action.type))]
      .join(" ").toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
    && (country === "all" || !ruleCountries(rule).length || ruleCountries(rule).includes(country))
    && matchesRuleState(rule, state),
  );
  const flip = (id: string) => setExpanded(current => {
    const next = new Set(current);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const showCount = (value: number) => props.loading ? "—" : value;

  return <main className="elegant-rules automation-production-overview">
    <div className="el-shell">
      <div className="el-heading">
        <div><h2>{copy.rules}</h2><p>{copy.subtitle}</p></div>
      </div>
      <section className="el-summary" aria-label={copy.summary}>
        <div className="el-summary-lead"><span className="el-summary-icon"><Activity size={18}/></span><div><b>{copy.summary}</b><small>{copy.summaryHint}</small></div></div>
        <div className="el-summary-stat"><strong>{showCount(props.rules.filter(rule => rule.enabled).length)}</strong><span>{copy.active}</span></div>
        <div className="el-summary-stat el-stat-alert"><strong>{showCount(props.rules.filter(ruleHasErrors).length)}</strong><span>{copy.attention}</span></div>
        <div className="el-summary-stat"><strong>{showCount(props.rules.filter(ruleNeedsReview).length)}</strong><span>{copy.review}</span></div>
      </section>
      <section className="el-workspace" aria-label={copy.rules}>
        <div className="el-list-heading"><div><h2>{copy.allRules}<span>{showCount(filtered.length)}</span></h2><p>{copy.expandHint}</p></div><div className="el-view-label"><SlidersHorizontal size={14}/>{copy.operational}</div></div>
        <div className="el-filters">
          <label className="el-search"><Search size={16} aria-hidden="true"/><input aria-label={copy.searchRules} placeholder={copy.searchRules} value={search} onChange={event => setSearch(event.target.value)}/>
            {search && <button onClick={() => setSearch("")} aria-label={copy.resetFilters}><X size={13}/></button>}
          </label>
          <label className="el-select-wrap"><Globe2 size={13}/><select aria-label={copy.country} value={country} onChange={event => setCountry(event.target.value)}>
            <option value="all">{copy.allCountries}</option>{props.catalog?.countries.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select></label>
          <label className="el-select-wrap el-status-select"><select aria-label={copy.status} value={state} onChange={event => setState(event.target.value)}>
            {[["all", copy.allStates], ["active", copy.active], ["paused", copy.paused], ["attention", copy.attention], ["review", copy.review]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          {(search || country !== "all" || state !== "all") && <button className="el-clear-filters" onClick={resetFilters}>{copy.resetFilters}</button>}
        </div>
        <div className="el-column-head" aria-hidden="true"><span>{copy.rules}</span><span>{copy.country}</span><span>{copy.trigger}</span><span>{copy.status}</span><span/></div>
        <div className="el-rows">{props.loading ? <div className="el-empty" role="status"><Loader2 className="animate-spin"/><p>{copy.loading}</p></div>
          : props.error ? <div className="el-empty" role="alert"><CircleAlert/><p>{copy.fetchError}</p><button onClick={props.onRetry}>{copy.retry}</button></div>
            : filtered.length ? filtered.map(rule => {
              const open = expanded.has(rule.id);
              const locked = ruleNeedsReview(rule);
              const errored = ruleHasErrors(rule);
              const then = (rule.actions || []).map(action => actionLabel(action.type)).join(" · ") || flow.noActions;
              const otherwise = rule.trigger?.noMatchActions?.length
                ? rule.trigger.noMatchActions.map((action: any) => actionLabel(action.type)).join(" · ")
                : rule.trigger?.noMatchRuleId
                  ? `${copy.otherRule}: ${props.rules.find(other => other.id === rule.trigger.noMatchRuleId)?.name || rule.trigger.noMatchRuleId}`
                  : copy.stop;
              const conditions = rule.trigger?.type === "schedule" && rule.trigger?.mode === "once"
                ? flow.conditionsIgnored : rule.conditions ? copy.conditionsSet : copy.noConditions;
              const errorText = copy.errors.replace("{count}", String(rule.consecutiveErrorCount || 0));
              return <article key={rule.id} className={`el-rule ${open ? "is-expanded" : ""}`} data-rule-id={rule.id} data-testid={`card-rule-${rule.id}`}>
                <div className="el-row">
                  <div className="el-rule-identity">
                    <button className="el-expand" onClick={() => flip(rule.id)} aria-label={`${open ? copy.hideDetails : copy.showDetails}: ${rule.name}`} aria-expanded={open} aria-controls={`rule-details-${rule.id}`}>
                      {open ? <ChevronDown size={17}/> : <ChevronRight size={17}/>}
                    </button>
                    <div className="el-rule-copy"><div className="el-name-line"><h3 title={rule.name}>{rule.name}</h3>{rule.isSystem && <span className="el-system"><ShieldCheck size={11}/>{copy.system}</span>}</div>
                      <p title={rule.description || ""}>{rule.description || moduleLabel(rule.module)}</p><span className="el-module">{moduleLabel(rule.module)}</span>
                    </div>
                  </div>
                  <div className="el-country" title={countriesLabel(rule)}><Globe2 size={13}/><span>{countriesLabel(rule)}</span></div>
                  <div className="el-trigger" title={triggerLabel(rule)}><span className="el-trigger-dot"/><span>{triggerLabel(rule)}</span></div>
                  <div className="el-status">
                    <button role="switch" aria-checked={rule.enabled} aria-label={`${rule.enabled ? copy.paused : copy.active}: ${rule.name}`}
                      className={`el-status-pill ${errored ? "status-error" : locked ? "status-review" : rule.enabled ? "status-on" : "status-off"}`}
                      disabled={locked || props.busy} onClick={() => props.onToggle(rule)} data-testid={`switch-enabled-${rule.id}`}>
                      {errored ? <CircleAlert size={12}/> : locked ? <Clock3 size={12}/> : <span className="el-status-led"/>}
                      {locked ? copy.review : `${rule.enabled ? copy.active : copy.paused}${errored ? ` · ${errorText}` : ""}`}
                    </button>
                  </div>
                  <button className="el-row-open" onClick={() => flip(rule.id)} aria-expanded={open} aria-controls={`rule-details-${rule.id}`} aria-label={`${copy.details}: ${rule.name}`}><span>{copy.details}</span><ChevronRight size={13}/></button>
                </div>
                {rule.disabledReason && <div className="el-alert-line" data-testid={`text-disabled-reason-${rule.id}`}><CircleAlert size={14}/><span><b>{copy.autoDisabled}:</b> {rule.disabledReason}</span></div>}
                {rule.lastErrorMessage && <div className="el-alert-line el-alert-soft" data-testid={`text-last-error-${rule.id}`}><CircleAlert size={14}/><span><b>{copy.lastError}:</b> {rule.lastErrorMessage}</span></div>}
                {open && <div className="el-details" id={`rule-details-${rule.id}`}>
                  <div className="el-flow-preview">
                    {[[copy.when, triggerLabel(rule), moduleLabel(rule.module)], [copy.if, conditions, flow.conditionNote],
                      [copy.then, then, `${flow.actions}: ${(rule.actions || []).length}`], [copy.else, otherwise, copy.ifNotMatched]].map(([label, value, note], index) =>
                      <div key={index} className={`el-flow-step ${index === 2 ? "el-step-then" : index === 3 ? "el-step-else" : ""}`}><span className="el-step-key">{label}</span><b title={value}>{value}</b><small title={note}>{note}</small></div>)}
                  </div>
                  <div className="el-detail-meta">
                    <span><Globe2 size={13}/>{countriesLabel(rule)}</span><span><Settings2 size={13}/>{moduleLabel(rule.module)}</span>
                    {rule.rateLimitPerHour != null && <span><Clock3 size={13}/>{copy.limit}: {rule.rateLimitPerHour}</span>}
                    <span>{copy.updated}: {new Date(rule.updatedAt).toLocaleDateString(locale, { timeZone: "Europe/Bratislava" })}</span>
                    {rule.trigger?.legacySource && <span>{unified.legacy}</span>}
                  </div>
                  <div className="el-detail-footer">
                    {locked && <button className="el-button el-button-review" disabled={props.busy} onClick={() => props.onReview(rule)} data-testid={`button-activate-reviewed-${rule.id}`}>{unified.activateReviewed}<ArrowRight size={14}/></button>}
                    <div className="el-row-actions">
                      {errored && <button className="el-action-button" disabled={props.busy} onClick={() => props.onReset(rule)} data-testid={`button-reset-errors-${rule.id}`}><RotateCcw size={14}/>{copy.resetErrors}</button>}
                      <button className="el-action-button" disabled={!props.catalog} onClick={() => props.onFlow(rule)} data-testid={`button-flowchart-${rule.id}`}><Workflow size={14}/>{copy.flow}</button>
                      <button className="el-action-button" onClick={() => props.onHistory(rule)} data-testid={`button-history-${rule.id}`}><History size={14}/>{copy.history}</button>
                      <button className="el-action-button" disabled={!props.catalog || props.busy} onClick={() => props.onEdit(rule)} data-testid={`button-edit-${rule.id}`}>{copy.edit}</button>
                      {!rule.isSystem && <button className="el-action-button el-action-danger" disabled={props.busy} onClick={() => props.onDelete(rule)} aria-label={`${copy.delete}: ${rule.name}`} data-testid={`button-delete-${rule.id}`}><Trash2 size={14}/>{copy.delete}</button>}
                    </div>
                  </div>
                </div>}
              </article>;
            }) : <div className="el-empty"><span><Search size={18}/></span><h3>{props.rules.length ? copy.noMatches : copy.noRules}</h3><p>{props.rules.length ? copy.noMatchesHint : copy.noRulesHint}</p>
              <button onClick={props.rules.length ? resetFilters : props.onCreate}>{props.rules.length ? copy.resetFilters : copy.addRule}</button>
            </div>}</div>
        <div className="el-list-foot"><span>{filtered.length} / {props.rules.length}</span><button className="el-clear-filters" onClick={props.onRetry} disabled={props.loading}><RotateCcw size={12}/>{copy.refresh}</button></div>
      </section>
      {props.children}
    </div>
  </main>;
}
