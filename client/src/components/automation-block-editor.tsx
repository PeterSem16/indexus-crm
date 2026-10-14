import { useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Search, Settings2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import "./automation-block-editor.css";

export function AutomationBlockEditor({ open, title, onCancel, onApply, disabled, children }: {
  open: boolean; title: string; onCancel: () => void; onApply: () => void;
  disabled?: boolean; children: ReactNode;
}) {
  const { t } = useI18n();
  const copy = t.automationBlockEditor;
  return <Dialog open={open} onOpenChange={value => { if (!value) onCancel(); }}>
    <DialogContent className="automation-block-modal" overlayClassName="automation-block-overlay">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{copy.help}</DialogDescription>
      </DialogHeader>
      <div className="automation-block-body">{children}</div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>{copy.cancel}</Button>
        <Button type="button" disabled={disabled} onClick={onApply}>{copy.apply}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

type Action = { type: string; config: Record<string, any> };
export function AutomationBlockActions({ actions, options, onChange, createAction, renderEditor, onEditingChange }: {
  actions: Action[]; options: { value: string; label: string }[];
  onChange: (actions: Action[]) => void; createAction: (type: string) => Action;
  renderEditor: (action: Action, index: number, change: (action: Action) => void, remove: () => void) => ReactNode;
  onEditingChange: (actionType: string | null) => void;
}) {
  const { t } = useI18n();
  const copy = t.automationBlockEditor;
  const [editing, setEditing] = useState<{ index: number; original: Action | null } | null>(null);
  const [catalog, setCatalog] = useState(false);
  const [search, setSearch] = useState("");
  const editingType = editing ? actions[editing.index]?.type || null : null;
  useEffect(() => { onEditingChange(editingType); }, [editingType, onEditingChange]);
  const select = (next: typeof editing, actionType?: string) => {
    setEditing(next);
    onEditingChange(next ? actionType || actions[next.index]?.type || null : null);
  };
  const update = (index: number, action: Action) => onChange(actions.map((item, i) => i === index ? action : item));
  const remove = (index: number) => { onChange(actions.filter((_, i) => i !== index)); select(null); };
  const cancel = () => {
    if (!editing) return;
    if (editing.original) update(editing.index, editing.original); else remove(editing.index);
    select(null);
  };
  if (editing && actions[editing.index]) return <div className="automation-action-focus">
    <div className="automation-action-focus-toolbar">
      <strong>{options.find(option => option.value === actions[editing.index].type)?.label || actions[editing.index].type}</strong>
      <Button type="button" variant="outline" onClick={cancel}>{copy.cancel}</Button>
      <Button type="button" onClick={() => select(null)}>{copy.done}</Button>
    </div>
    {renderEditor(actions[editing.index], editing.index, action => update(editing.index, action), () => remove(editing.index))}
  </div>;
  return <div className="automation-block-actions">
    <h3>{copy.order}</h3>
    {actions.length === 0 && <p className="text-sm text-muted-foreground">{copy.empty}</p>}
    {actions.map((action, index) => <div className="automation-compact-action" key={index}>
      <span className="automation-action-number">{index + 1}</span>
      <div><strong>{options.find(option => option.value === action.type)?.label || action.type}</strong>
        <p>{String(action.config.title || action.config.subject || action.config.taskText || "").replace(/<[^>]*>/g, "").slice(0, 100)}</p></div>
      <div className="automation-action-controls">
        <Button type="button" size="icon" variant="ghost" aria-label={copy.edit} onClick={() => select({ index, original: structuredClone(action) })}><Settings2 size={15}/></Button>
        <Button type="button" size="icon" variant="ghost" aria-label={copy.up} disabled={index === 0} onClick={() => {
          const next = [...actions]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(next);
        }}><ArrowUp size={15}/></Button>
        <Button type="button" size="icon" variant="ghost" aria-label={copy.down} disabled={index === actions.length - 1} onClick={() => {
          const next = [...actions]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; onChange(next);
        }}><ArrowDown size={15}/></Button>
        <Button type="button" size="icon" variant="ghost" aria-label={copy.duplicate} onClick={() => {
          const next = [...actions]; next.splice(index + 1, 0, structuredClone(action)); onChange(next);
        }}><Copy size={15}/></Button>
        <Button type="button" size="icon" variant="ghost" aria-label={copy.remove} onClick={() => remove(index)}><Trash2 size={15}/></Button>
      </div>
    </div>)}
    {catalog && <div className="automation-action-catalog">
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input autoFocus className="pl-9" placeholder={copy.search} value={search} onChange={event => setSearch(event.target.value)}/></div>
      <div>{options.filter(option => option.label.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(option =>
        <Button type="button" key={option.value} variant="outline" onClick={() => {
          const index = actions.length; onChange([...actions, createAction(option.value)]);
          setCatalog(false); select({ index, original: null }, option.value);
        }}><Plus size={14}/>{option.label}</Button>)}</div>
    </div>}
    <div className="automation-actions-add"><Button type="button" onClick={() => { setSearch(""); setCatalog(!catalog); }}><Plus size={14}/>{copy.add}</Button></div>
  </div>;
}
