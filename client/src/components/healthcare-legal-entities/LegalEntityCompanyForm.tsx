import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { LegalEntitySummary } from "@shared/healthcare-legal-entity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { HealthcareLegalEntityCopy } from "@/i18n/healthcare-legal-entity-translations";
import { formatLegalForm } from "@/lib/healthcare-legal-entity-format";

type Details = { name?: string | null; legalForm?: string | null; registeredAddress?: string | null; city?: string | null; postalCode?: string | null };
type Entity = LegalEntitySummary & { details?: Details; registryCompany?: Partial<LegalEntitySummary> };
type Props = { entity: Entity; c: HealthcareLegalEntityCopy; canEdit: boolean; pending: boolean; saveVersion: number; onSave: (payload: { details?: Details; notes?: string }) => void; notes: string; setNotes: (v: string) => void };
const displayValue = (key: keyof Details, value: string | null | undefined) => key === "legalForm" ? formatLegalForm(value) : value ?? "";

export function LegalEntityCompanyForm({ entity, c, canEdit, pending, saveVersion, onSave, notes, setNotes }: Props) {
  const registry = entity.registryCompany || entity;
  const [values, setValues] = useState<Record<keyof Details, string>>({ name: "", legalForm: "", registeredAddress: "", city: "", postalCode: "" });
  const [restore, setRestore] = useState<Set<keyof Details>>(new Set());
  const initializedForId = useRef<string | null>(null);
  const [nameError, setNameError] = useState(false);
  useEffect(() => {
    if (initializedForId.current === entity.id) return;
    initializedForId.current = entity.id;
    const d = entity.details || {};
    setValues({ name: displayValue("name", d.name ?? entity.name), legalForm: displayValue("legalForm", d.legalForm ?? entity.legalForm), registeredAddress: displayValue("registeredAddress", d.registeredAddress ?? entity.registeredAddress), city: displayValue("city", d.city ?? entity.city), postalCode: displayValue("postalCode", d.postalCode ?? entity.postalCode) });
    setRestore(new Set());
  }, [entity.id, entity.details, entity.name, entity.legalForm, entity.registeredAddress, entity.city, entity.postalCode]);
  useEffect(() => {
    if (saveVersion === 0) return;
    setRestore((current) => {
      const next = new Set(current);
      let changed = false;
      for (const [key] of names) {
        if (next.has(key)
          && !Object.prototype.hasOwnProperty.call(entity.details || {}, key)
          && values[key] === displayValue(key, registry[key])) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [saveVersion, entity, values]);
  const names: Array<[keyof Details, string, string | null | undefined]> = [
    ["name", c.companyName, registry.name], ["legalForm", c.legalForm, registry.legalForm],
    ["registeredAddress", c.address, registry.registeredAddress], ["city", c.city, registry.city], ["postalCode", c.postalCode, registry.postalCode],
  ];
  const changedDetails = useMemo(() => names.reduce<Details>((acc, [key]) => {
    const persistedValue = displayValue(key, entity[key]);
    const hasStoredOverride = Object.prototype.hasOwnProperty.call(entity.details || {}, key);
    if (restore.has(key) && hasStoredOverride) acc[key] = null;
    else if (values[key] !== persistedValue) acc[key] = values[key];
    return acc;
  }, {}), [values, restore, entity]);
  const dirty = Object.keys(changedDetails).length > 0 || notes !== (entity.notes || "");
  const restoreField = (key: keyof Details) => {
    setValues((v) => ({ ...v, [key]: displayValue(key, registry[key]) }));
    setRestore((current) => {
      const next = new Set(current);
      if (Object.prototype.hasOwnProperty.call(entity.details || {}, key)) next.add(key);
      else next.delete(key);
      return next;
    });
  };
  return <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); const missingName = !values.name.trim(); setNameError(missingName); if (missingName) return; onSave({ ...(Object.keys(changedDetails).length ? { details: changedDetails } : {}), ...(notes !== (entity.notes || "") ? { notes } : {}) }); }}>
    <section className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{c.details}</h3><p className="mt-1 text-xs text-muted-foreground">{c.localFieldsNote}</p></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">{c.localValues}</span></div>
      <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
        <div><Label>{c.ico}</Label><Input className="mt-1.5 bg-muted/50 font-mono" value={entity.ico} readOnly aria-readonly="true" /><p className="mt-1 text-[11px] text-muted-foreground">{c.registryReadOnly}</p></div>
        <div><Label>{c.status}</Label><Input className="mt-1.5 bg-muted/50" value={entity.status === "active" ? c.active : c.terminated} readOnly aria-readonly="true" /></div>
        {names.map(([key, label]) => {
          const differsFromRegistry = values[key] !== displayValue(key, registry[key]);
          return <div key={key} className={key === "registeredAddress" ? "sm:col-span-2" : ""}><div className="mb-1.5 flex items-center justify-between gap-2"><Label htmlFor={`entity-${key}`}>{label}</Label>
          {differsFromRegistry && !restore.has(key) && <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => restoreField(key)}><RotateCcw className="mr-1 h-3 w-3" />{c.restoreRegistryValue}</Button>}</div>
          <Input id={`entity-${key}`} required={key === "name"} data-testid={key === "name" ? "input-legal-entity-name" : undefined} value={values[key]} disabled={!canEdit} aria-invalid={key === "name" && nameError && !values.name.trim()} onChange={(e) => { setRestore((s) => { const n = new Set(s); n.delete(key); return n; }); setValues((v) => ({ ...v, [key]: e.target.value })); if (key === "name" && e.target.value.trim()) setNameError(false); }} />
          {key === "name" && nameError && !values.name.trim() && <p className="mt-1 text-xs text-destructive" role="alert">{c.nameRequired}</p>}
          {restore.has(key) && <p className="mt-1 text-[11px] text-primary">{c.willRestoreRegistry}</p>}
        </div>})}
      </div>
    </section>
    <section className="rounded-xl border bg-card p-4 sm:p-5"><div className="mb-3 flex items-center justify-between"><div><h3 className="font-semibold">{c.notes}</h3><p className="mt-1 text-xs text-muted-foreground">{c.localFieldsNote}</p></div></div><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} className="min-h-24 resize-y" /></section>
    {canEdit && <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-background/95 py-3 backdrop-blur"><span className="text-xs text-muted-foreground">{dirty ? c.unsavedChanges : c.allChangesSaved}</span><Button type="submit" disabled={!dirty || pending} data-testid="button-save-legal-entity">{pending ? c.loading : c.save}</Button></div>}
  </form>;
}
