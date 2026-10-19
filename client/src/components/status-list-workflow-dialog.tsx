import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleHelp, EyeOff, FileText, GitBranch, GitFork, ListFilter, LockKeyhole, Plus, Search, Settings2, Trash2, Workflow, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { isWorkflowNoteAction, workflowActionSupportsTarget, type WorkflowAction, type StatusListWorkflow, type WorkflowAnswer, type WorkflowCatalogItem, type WorkflowCondition, type WorkflowRef } from "@shared/status-list-workflow";
import { groupWorkflowCatalog, isWorkflowBoolean, isWorkflowSupported, isWorkflowYesNo, workflowCatalogPath, workflowDefaultAnswer, workflowNewAction, workflowRefKey, type WorkflowCatalogNode } from "@/lib/status-workflow-catalog";
import { getStatusWorkflowActionCopy } from "./status-list-workflow-action-copy";
import { getStatusListWorkflowCopy } from "./status-list-workflow-copy";
import { getStatusWorkflowDesignCopy } from "./status-list-workflow-design-copy";
import { getStatusListBackgroundCopy } from "./status-list-background-copy";
import { workflowBackgroundTrigger } from "@/lib/status-workflow-catalog";
import "./status-list-workflow-dialog.css";

type Block = "overview" | "when" | "if" | "then" | "else";
type Picker = { purpose: "source" | "condition" | "target"; index?: number; branch?: "thenActions" | "elseActions"; actionType?: WorkflowAction["type"] };
type Copy = ReturnType<typeof getStatusListWorkflowCopy>;
type DesignCopy = ReturnType<typeof getStatusWorkflowDesignCopy>;

function AnswerValue({ item, value, onChange, copy, design, allowFalse = false, testId }: {
  item?: WorkflowCatalogItem; value?: WorkflowAnswer; onChange: (value: WorkflowAnswer) => void;
  copy: Copy; design: DesignCopy; allowFalse?: boolean; testId?: string;
}) {
  if (isWorkflowBoolean(item)) {
    const option = item?.itemType === "option";
    const positive = option ? design.confirmedOption : design.confirmedStep;
    const negative = option ? design.notConfirmedOption : design.notConfirmedStep;
    if (!allowFalse) return <div className="choice-value" data-testid={testId}><span className="value-mark"><Check size={15}/></span><span><strong>{positive}</strong><small>{design.confirmHint}</small></span></div>;
    return <div className="boolean-condition" role="group" aria-label={design.comparisonState} data-testid={testId}>
      {[true, false].map(answer => <button key={String(answer)} type="button" className={value === answer ? "selected" : ""} aria-pressed={value === answer} onClick={() => onChange(answer)}><span className="condition-radio"/><strong>{answer ? positive : negative}</strong></button>)}
    </div>;
  }
  if (isWorkflowYesNo(item)) return <label className="wf-field"><span>{copy.answer}</span><select data-testid={testId} value={String(value ?? "yes")} onChange={e => onChange(e.target.value)}><option value="yes">{copy.yes}</option><option value="no">{copy.no}</option></select></label>;
  return <label className="wf-field"><span>{copy.value}</span><input data-testid={testId} type={item?.fieldType.toLowerCase() === "number" ? "number" : item?.fieldType.toLowerCase() === "date" ? "date" : "text"} value={typeof value === "string" ? value : ""} onChange={e => onChange(e.target.value)}/></label>;
}

function CatalogPicker({ picker, catalog, value, source, copy, design, onChoose, onClose, restoreFocus }: {
  picker: Picker; catalog: WorkflowCatalogItem[]; value?: WorkflowRef; source: WorkflowRef;
  copy: Copy; design: DesignCopy; onChoose: (ref: WorkflowRef) => void; onClose: () => void; restoreFocus: () => void;
}) {
  const [search, setSearch] = useState("");
  const groups = useMemo(() => groupWorkflowCatalog(catalog, search), [catalog, search]);
  const canChoose = (item: WorkflowCatalogItem) => picker.purpose === "condition" ||
    (picker.purpose === "target" ? workflowActionSupportsTarget(picker.actionType || "set_answer", item) &&
      (isWorkflowNoteAction(picker.actionType || "set_answer") || workflowRefKey(item) !== workflowRefKey(source))
      : (item.writable && isWorkflowSupported(item)) || !!item.backgroundSource);
  const flags = (item: WorkflowCatalogItem) => <span className="target-flags">
    {item.hidden && <span><EyeOff size={12}/>{copy.hidden}</span>}
    {!item.writable && <span><LockKeyhole size={12}/>{copy.readOnly}</span>}
    {picker.purpose === "target" && !isWorkflowNoteAction(picker.actionType || "set_answer") && workflowRefKey(item) === workflowRefKey(source) && <span><LockKeyhole size={12}/>{design.sourceFlag}</span>}
  </span>;
  const choose = (item: WorkflowCatalogItem) => { if (canChoose(item)) onChoose({ kind: item.kind, id: item.id }); };
  const renderChild = (node: WorkflowCatalogNode, depth = 0) => <div key={workflowRefKey(node.item)} className="catalog-child" style={{ paddingLeft: depth ? 14 : undefined }}>
    <button type="button" disabled={!canChoose(node.item)} onClick={() => choose(node.item)} aria-pressed={workflowRefKey(value) === workflowRefKey(node.item)} className={`possibility ${workflowRefKey(value) === workflowRefKey(node.item) ? "is-selected" : ""}`} data-catalog-ref={workflowRefKey(node.item)}>
      <span className="possibility-branch"/><span className="possibility-text">{node.item.kind === "question" && <small className="question-kicker">{design.question}</small>}{node.item.label}{flags(node.item)}</span>
      <span className="possibility-select">{workflowRefKey(value) === workflowRefKey(node.item) ? <Check size={15}/> : <span className="choice-dot"/>}</span>
    </button>{node.children.map(child => renderChild(child, depth + 1))}
  </div>;
  const title = picker.purpose === "source" ? design.sourceTitle : picker.purpose === "target" ? design.targetTitle : design.conditionTitle;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent hideCloseButton className="status-workflow-picker-shell" overlayClassName="status-workflow-picker-overlay" onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(); }}>
      <div className="status-workflow-ui"><div className="picker-window">
        <header className="picker-head"><div className="picker-icon"><ListFilter size={19}/></div><div><p className="eyebrow">{design.breadcrumb}</p><DialogTitle>{title}</DialogTitle><DialogDescription className="picker-intro">{design.pickerIntro}</DialogDescription></div><button type="button" className="icon-button picker-close" aria-label={design.close} onClick={onClose}><X size={18}/></button></header>
        <label className="picker-search"><Search size={17}/><input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={design.search} aria-label={design.search}/></label>
        <div className="picker-list" role="list">
          {!groups.length && <div className="picker-empty"><Search size={20}/><strong>{design.emptySearch}</strong><span>{design.searchHint}</span></div>}
          {groups.map(node => <div role="listitem" className="question-group" key={workflowRefKey(node.item)}>
            <div className="question-heading"><span className="question-glyph"><FileText size={16}/></span><div className="question-heading-copy"><span className="question-kicker">{node.item.kind === "question" ? design.question : node.item.itemType === "option" ? design.option : design.main}</span>{workflowCatalogPath(node.item, catalog) && <small>{workflowCatalogPath(node.item, catalog)}</small>}<strong>{node.item.label}</strong>{flags(node.item)}</div>
              <button type="button" disabled={!canChoose(node.item)} className={`step-choice ${workflowRefKey(value) === workflowRefKey(node.item) ? "is-selected" : ""}`} onClick={() => choose(node.item)} aria-label={`${node.item.kind === "item" && node.item.itemType !== "option" ? design.whole : copy.value}: ${node.item.label}`} aria-pressed={workflowRefKey(value) === workflowRefKey(node.item)} data-catalog-ref={workflowRefKey(node.item)}><span className="choice-dot"/><span>{node.item.kind === "item" && node.item.itemType !== "option" ? design.whole : copy.value}</span>{workflowRefKey(value) === workflowRefKey(node.item) && <Check size={15}/>}</button>
            </div>
            {!!node.children.length && <div className="possibilities"><span className="possibility-label">{design.options}</span>{node.children.map(child => renderChild(child))}</div>}
          </div>)}
        </div>
        <footer className="picker-foot"><span><CircleHelp size={15}/>{design.pickerHint}</span><button type="button" className="text-button" onClick={onClose}>{design.close}</button></footer>
      </div></div>
    </DialogContent>
  </Dialog>;
}

export function StatusListWorkflowDialog({ open, draft, catalog, locale, editing, pending, validation, onUpdate, onClose, onSave }: {
  open: boolean; draft: StatusListWorkflow; catalog: WorkflowCatalogItem[]; locale: string; editing: boolean;
  pending: boolean; validation: string; onUpdate: (patch: Partial<StatusListWorkflow>) => void; onClose: () => void; onSave: () => void;
}) {
  const copy = getStatusListWorkflowCopy(locale);
  const design = getStatusWorkflowDesignCopy(locale);
  const backgroundCopy = getStatusListBackgroundCopy(locale);
  const actionCopy = getStatusWorkflowActionCopy(locale);
  const [block, setBlock] = useState<Block>("overview");
  const [picker, setPicker] = useState<Picker | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const selected = (ref?: WorkflowRef) => catalog.find(item => workflowRefKey(item) === workflowRefKey(ref));
  const labels: Record<Block, string> = { overview: copy.overview, when: copy.when, if: copy.if, then: copy.then, else: copy.else };
  const branch = block === "else" ? "elseActions" : "thenActions";
  const targets = catalog.filter(item => item.writable && isWorkflowSupported(item) && workflowRefKey(item) !== workflowRefKey(draft.source));
  const allowedTargets = (type: WorkflowAction["type"]) => catalog.filter(item => workflowActionSupportsTarget(type, item) && (isWorkflowNoteAction(type) || workflowRefKey(item) !== workflowRefKey(draft.source)));
  const openPicker = (next: Picker, element: HTMLElement) => { trigger.current = element; setPicker(next); };
  const closePicker = () => setPicker(null);
  const pick = (ref: WorkflowRef) => {
    if (!picker) return;
    if (picker.purpose === "source") onUpdate({ source: ref, sourceValue: undefined, trigger: workflowBackgroundTrigger(selected(ref)) });
    else if (picker.purpose === "condition") onUpdate({ conditions: draft.conditions.map((condition, i) => i === picker.index ? { ...condition, ref, value: ["empty", "not_empty"].includes(condition.op) ? undefined : workflowDefaultAnswer(selected(ref)) } : condition) });
    else {
      const targetBranch = picker.branch!;
      onUpdate({ [targetBranch]: draft[targetBranch].map((action, i) => i === picker.index ? action.type === "set_answer" ? { ...action, target: ref, value: workflowDefaultAnswer(selected(ref)) } : { ...action, target: ref } : action) });
    }
    closePicker();
  };
  const updateCondition = (index: number, patch: Partial<WorkflowCondition>) => onUpdate({ conditions: draft.conditions.map((condition, i) => i === index ? { ...condition, ...patch } : condition) });
  const selection = (ref: WorkflowRef | undefined, label: string, onClick: (element: HTMLElement) => void, testId?: string) => {
    const item = selected(ref);
    return <button type="button" className={`selection-card ${label === design.targetLabel ? "target-select" : ""}`} data-testid={testId} onClick={e => onClick(e.currentTarget)}><span className="selection-icon"><FileText size={17}/></span><span className="selection-copy"><small>{label}</small>{workflowCatalogPath(item, catalog) && <em>{workflowCatalogPath(item, catalog)}</em>}<strong>{item?.label || copy.target}</strong><em>{item?.kind === "question" ? design.question : item?.itemType === "option" ? design.option : design.main}</em></span><ChevronDown size={16}/></button>;
  };
  const currentRef = picker?.purpose === "source" ? draft.source : picker?.purpose === "condition" ? draft.conditions[picker.index!]?.ref : picker?.branch ? draft[picker.branch][picker.index!]?.target : undefined;
  const validationText = validation === "Enter a rule name." ? copy.nameRequired : validation === "Array must contain at least 1 element(s)" ? copy.actionRequired : copy.invalid;
  return <Dialog open={open} onOpenChange={value => { if (!value && !pending) onClose(); }}>
    <DialogContent hideCloseButton className="status-workflow-shell" overlayClassName="status-workflow-overlay">
      <div className="status-workflow-ui"><div className="editor-window">
        <header className="editor-topbar"><div className="brand-lockup"><span className="brand-mark"><Workflow size={20}/></span><span><strong>INDEXUS</strong><small>{design.brandSubtitle}</small></span></div><span className="draft-chip"><span/>{design.draft}</span><button type="button" className="icon-button top-close" disabled={pending} aria-label={copy.cancel} onClick={onClose}><X size={18}/></button></header>
         <div className="editor-title-row"><div><p className="eyebrow">{design.breadcrumb}</p><DialogTitle asChild><h2>{block === "overview" ? editing ? copy.edit : copy.create : labels[block]}</h2></DialogTitle><DialogDescription className="editor-subtitle">{draft.trigger === "background_transition" ? backgroundCopy.workflowSubtitle : copy.subtitle}</DialogDescription></div></div>
        <nav className="block-nav" aria-label={design.parts}>{(["overview", "when", "if", "then", "else"] as Block[]).map((key, index) => <button key={key} type="button" className={`nav-step ${key === block ? "active" : ""}`} onClick={() => setBlock(key)} aria-current={key === block ? "step" : undefined} data-testid={`status-workflow-nav-${key}`}><span className="nav-index">{index === 0 ? <Settings2 size={14}/> : String(index).padStart(2, "0")}</span><span>{labels[key]}</span></button>)}</nav>
        <section className="editor-content">
          {block === "overview" && <div className="overview-content">
            <label className="wf-field name-field"><span>{copy.name}</span><input data-testid="status-workflow-name" value={draft.name} maxLength={180} disabled={pending} onChange={e => onUpdate({ name: e.target.value })}/></label>
            <label className="workflow-enabled"><Switch checked={draft.enabled} disabled={pending} onCheckedChange={enabled => onUpdate({ enabled })}/>{copy.enabled}</label>
            <div className="rule-flow">{(["when", "if", "then", "else"] as const).map((key, i) => <button type="button" key={key} className={`flow-block flow-${key}`} data-testid={`status-workflow-overview-${key}`} onClick={() => setBlock(key)}><span className="flow-icon">{i === 0 ? <Workflow size={17}/> : i === 1 ? <GitBranch size={17}/> : i === 2 ? <ArrowRight size={17}/> : <GitFork size={17}/>}</span><span><small>{labels[key]}</small><strong>{key === "when" ? selected(draft.source)?.label || copy.source : key === "if" ? draft.conditions.length ? copy.conditionCount.replace("{count}", String(draft.conditions.length)) : copy.noConditions : (key === "then" ? draft.thenActions : draft.elseActions).length ? copy.writeCount.replace("{count}", String((key === "then" ? draft.thenActions : draft.elseActions).length)) : copy.noWrites}</strong></span><ArrowRight size={15}/></button>)}</div>
             <p className="subtle-note"><CircleHelp size={15}/>{draft.trigger === "background_transition" ? backgroundCopy.backgroundNotice : copy.writeNotice}</p>
          </div>}
          {block === "when" && <div className="section-stack">
             <div className="section-intro"><span className="section-icon"><Workflow size={19}/></span><div><h3>{draft.trigger === "background_transition" ? backgroundCopy.backgroundMode : copy.source}</h3><p>{design.pickerIntro}</p></div></div>
            {selection(draft.source, design.sourceLabel, element => openPicker({ purpose: "source" }, element), "status-workflow-source")}
            <div className="subtle-note"><span>{selected(draft.source)?.backgroundSource ? backgroundCopy.backgroundMode : backgroundCopy.manualMode}</span><span> · {selected(draft.source)?.backgroundSource ? backgroundCopy.backgroundNotice : backgroundCopy.agentNotice}</span></div>
            {isWorkflowBoolean(selected(draft.source)) || isWorkflowYesNo(selected(draft.source)) ? <label className="wf-field"><span>{copy.sourceValue}</span><select data-testid="status-workflow-source-value" value={draft.sourceValue === undefined ? "any" : String(draft.sourceValue)} onChange={e => onUpdate({ sourceValue: e.target.value === "any" ? undefined : isWorkflowBoolean(selected(draft.source)) ? true : e.target.value })}><option value="any">{copy.optional}</option>{isWorkflowBoolean(selected(draft.source)) ? <option value="true">{selected(draft.source)?.itemType === "option" ? design.confirmedOption : design.confirmedStep}</option> : <><option value="yes">{copy.yes}</option><option value="no">{copy.no}</option></>}</select></label> : <label className="wf-field"><span>{copy.sourceValue}</span><input data-testid="status-workflow-source-value" type={selected(draft.source)?.fieldType === "number" ? "number" : selected(draft.source)?.fieldType === "date" ? "date" : "text"} placeholder={copy.optional} value={typeof draft.sourceValue === "string" ? draft.sourceValue : ""} onChange={e => onUpdate({ sourceValue: e.target.value || undefined })}/></label>}
          </div>}
          {block === "if" && <div className="section-stack">
            <div className="section-intro"><span className="section-icon"><GitBranch size={19}/></span><div><h3>{copy.conditions}</h3><p>{copy.all} / {copy.any}</p></div></div>
            <label className="wf-field"><span>{copy.conditions}</span><select data-testid="status-workflow-condition-logic" value={draft.logic} onChange={e => onUpdate({ logic: e.target.value as "and" | "or" })}><option value="and">{copy.all}</option><option value="or">{copy.any}</option></select></label>
            {!draft.conditions.length && <p className="subtle-note">{design.conditionsEmpty}</p>}
            {draft.conditions.map((condition, index) => <article className="condition-card" key={index}><div className="condition-card-head"><span>{design.conditionNumber} {String(index + 1).padStart(2, "0")}</span><button type="button" className="icon-button danger-icon" aria-label={copy.remove} onClick={() => onUpdate({ conditions: draft.conditions.filter((_, i) => i !== index) })}><Trash2 size={16}/></button></div><div className="condition-grid">
              <label className="wf-field"><span>{copy.field}</span><select data-testid={`status-workflow-condition-field-${index}`} value={condition.field} onChange={e => { const field = e.target.value as WorkflowCondition["field"]; const item = catalog[0]; onUpdate({ conditions: draft.conditions.map((entry, i) => i === index ? { field, op: "equals", ...(field === "answer" ? { ref: item ? { kind: item.kind, id: item.id } : undefined, value: workflowDefaultAnswer(item) } : { value: "" }) } : entry) }); }}>{(["answer", "hospital_id", "clinic_id", "status", "contact_type"] as const).map(field => <option key={field} value={field}>{({ answer: copy.answer, hospital_id: copy.hospital, clinic_id: copy.clinic, status: copy.status, contact_type: copy.contactType })[field]}</option>)}</select></label>
              {condition.field === "answer" && selection(condition.ref, design.refLabel, element => openPicker({ purpose: "condition", index }, element), `status-workflow-condition-ref-${index}`)}
              <label className="wf-field"><span>{design.comparison}</span><select data-testid={`status-workflow-condition-op-${index}`} value={condition.op} onChange={e => updateCondition(index, { op: e.target.value as WorkflowCondition["op"], value: ["empty", "not_empty"].includes(e.target.value) ? undefined : condition.value ?? (condition.field === "answer" ? workflowDefaultAnswer(selected(condition.ref)) : "") })}>{(["equals", "not_equals", "empty", "not_empty"] as const).map(op => <option key={op} value={op}>{({ equals: copy.equals, not_equals: copy.notEquals, empty: copy.opEmpty, not_empty: copy.opNotEmpty })[op]}</option>)}</select></label>
              {["equals", "not_equals"].includes(condition.op) && (condition.field === "answer" ? <AnswerValue allowFalse item={selected(condition.ref)} value={condition.value} onChange={value => updateCondition(index, { value })} copy={copy} design={design} testId={`status-workflow-condition-value-${index}`}/> : <label className="wf-field"><span>{copy.value}</span><input data-testid={`status-workflow-condition-value-${index}`} value={typeof condition.value === "string" ? condition.value : String(condition.value ?? "")} onChange={e => updateCondition(index, { value: e.target.value })}/></label>)}
            </div></article>)}
            <button type="button" className="add-secondary" data-testid="status-workflow-add-condition" disabled={draft.conditions.length >= 20 || !catalog.length} onClick={() => { const item = catalog[0]; onUpdate({ conditions: [...draft.conditions, { field: "answer", ref: { kind: item.kind, id: item.id }, op: "equals", value: workflowDefaultAnswer(item) }] }); }}><Plus size={16}/>{copy.addCondition}</button>
          </div>}
          {(block === "then" || block === "else") && <div className="section-stack">
            <div className="section-intro"><span className={`section-icon ${block === "then" ? "green" : "amber"}`}>{block === "then" ? <ArrowRight size={19}/> : <GitFork size={19}/>}</span><div><h3>{block === "then" ? design.thenTitle : design.elseTitle}</h3><p>{block === "then" ? design.thenHint : design.elseHint}</p></div></div>
            {draft[branch].map((action, index) => { const item = selected(action.target); return <article className="action-card" key={index}><div className="action-card-top"><span className="action-number">{design.actionNumber} {String(index + 1).padStart(2, "0")}</span><span className="action-status"><span/>{actionCopy.labels[action.type]}</span><button type="button" className="icon-button danger-icon" aria-label={copy.remove} onClick={() => onUpdate({ [branch]: draft[branch].filter((_, i) => i !== index) })}><Trash2 size={16}/></button></div>
              <label className="wf-field"><span>{actionCopy.type}</span><select data-testid={`status-workflow-${block}-type-${index}`} value={action.type} disabled={pending} onChange={e => {
                const type = e.target.value as WorkflowAction["type"];
                const candidates = allowedTargets(type);
                const target = candidates.find(entry => workflowRefKey(entry) === workflowRefKey(action.target)) || candidates[0];
                if (target) {
                  const next = workflowNewAction(type, target);
                  if ("text" in next && "text" in action) next.text = action.text;
                  onUpdate({ [branch]: draft[branch].map((entry, i) => i === index ? next : entry) });
                }
              }}>{(Object.keys(actionCopy.labels) as WorkflowAction["type"][]).map(type => <option key={type} value={type} disabled={!allowedTargets(type).length}>{actionCopy.labels[type]}</option>)}</select></label>
              {selection(action.target, design.targetLabel, element => openPicker({ purpose: "target", index, branch, actionType: action.type }, element), `status-workflow-${block}-target-${index}`)}
              {item?.hidden && <span className="meta-pill"><EyeOff size={13}/>{copy.hidden}</span>}{item && !item.writable && <span className="meta-pill"><LockKeyhole size={13}/>{copy.readOnly}</span>}
              {action.type === "set_answer" ? <div className="action-fields"><AnswerValue item={item} value={action.value} onChange={value => onUpdate({ [branch]: draft[branch].map((entry, i) => i === index && entry.type === "set_answer" ? { ...entry, value } : entry) })} copy={copy} design={design} testId={`status-workflow-${block}-answer-${index}`}/>
                <fieldset className="mode-field" data-testid={`status-workflow-${block}-mode-${index}`}><legend>{design.modeQuestion}</legend><div className="mode-options">{(["if_empty", "replace"] as const).map(mode => <label key={mode} className={action.mode === mode ? `mode-selected ${mode === "replace" ? "replace-selected" : ""}` : ""}><input type="radio" name={`workflow-${branch}-${index}`} checked={action.mode === mode} onChange={() => onUpdate({ [branch]: draft[branch].map((entry, i) => i === index ? { ...entry, mode } : entry) })}/><span className="mode-symbol">{mode === "if_empty" ? <LockKeyhole size={16}/> : <ArrowRight size={16}/>}</span><span><strong>{mode === "if_empty" ? copy.ifEmpty : copy.replace}</strong><small>{mode === "if_empty" ? design.ifEmptyHint : design.replaceHint}</small></span></label>)}</div></fieldset>
              </div> : <>
                {(action.type === "replace_note" || action.type === "append_note") && <label className="wf-field"><span>{actionCopy.text}</span><textarea data-testid={`status-workflow-${block}-text-${index}`} maxLength={4000} rows={4} value={action.text} disabled={pending} onChange={e => onUpdate({ [branch]: draft[branch].map((entry, i) => i === index && (entry.type === "replace_note" || entry.type === "append_note") ? { ...entry, text: e.target.value } : entry) })}/></label>}
                <p className="subtle-note">{isWorkflowNoteAction(action.type) ? actionCopy.noteHint : action.type === "add_selection" || action.type === "remove_selection" ? actionCopy.selectionHint : action.type === "confirm_step" ? design.confirmHint : actionCopy.clearHint}</p>
              </>}
            </article>; })}
            {!draft[branch].length && <div className="empty-condition"><GitFork size={21}/><strong>{design.actionsEmpty}</strong><span>{copy.noWrites}</span></div>}
            <button type="button" className="add-secondary" data-testid={`status-workflow-add-${block}-action`} disabled={(!targets.length && !allowedTargets("replace_note").length) || draft[branch].length >= 10} onClick={() => { const target = targets.find(item => !draft[branch].some(action => workflowRefKey(action.target) === workflowRefKey(item))) || targets[0] || allowedTargets("replace_note")[0]; onUpdate({ [branch]: [...draft[branch], workflowNewAction(targets.length ? "set_answer" : "replace_note", target)] }); }}><Plus size={16}/>{copy.addAction}</button>
            <p className="subtle-note"><LockKeyhole size={15}/>{copy.sourceWarning} {design.groupOccupied}</p>
          </div>}
          {validation && <p role="alert" className="workflow-validation">{validationText}</p>}
        </section>
         <footer className="editor-footer"><div className="save-status" role="status"><span className="status-dot"/>{pending ? copy.saving : draft.trigger === "background_transition" ? backgroundCopy.backgroundNotice : copy.writeNotice}</div><div className="footer-actions"><button type="button" className="cancel-button" disabled={pending} onClick={onClose}>{copy.cancel}</button>{block !== "overview" && <button type="button" className="back-button" data-testid="status-workflow-overview-back" onClick={() => setBlock("overview")}><ArrowLeft size={15}/>{copy.backToOverview}</button>}<button type="button" className="save-button" data-testid="status-workflow-save" disabled={pending} onClick={onSave}><Check size={16}/>{pending ? copy.saving : copy.save}</button></div></footer>
        {picker && <CatalogPicker picker={picker} catalog={catalog} value={currentRef} source={draft.source} copy={copy} design={design} onChoose={pick} onClose={closePicker} restoreFocus={() => trigger.current?.focus()}/>}
      </div></div>
    </DialogContent>
  </Dialog>;
}
