import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { demoRules, countries, moduleLabels, whenLabel, conditionLabel, elseLabel, actionLabels,
  isReviewLocked, hasErrors, type PrototypeRule } from "./_fixtures";

export type PrototypeAction = "edit" | "flow" | "history" | "delete" | "review" | "create" | "tags";
export function usePrototypeRules() {
  const [rules, setRules] = useState<PrototypeRule[]>(() => structuredClone(demoRules));
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [country, setCountry] = useState("all");
  const [dialog, setDialog] = useState<{ action: PrototypeAction; rule?: PrototypeRule } | null>(null);
  const [notice, setNotice] = useState("");
  const update = (id: string, patch: Partial<PrototypeRule>) => setRules(list => list.map(rule => rule.id === id ? { ...rule, ...patch } : rule));
  const dispatch = (action: PrototypeAction | "toggle" | "reset", rule?: PrototypeRule) => {
    if (action === "toggle" && rule) { if (!isReviewLocked(rule)) update(rule.id, { enabled: !rule.enabled }); return; }
    if (action === "reset" && rule) {
      update(rule.id, { consecutiveErrorCount: 0, lastErrorMessage: null, disabledReason: null, enabled: rule.disabledReason ? true : rule.enabled });
      setNotice("Chyby boli resetované iba v tomto návrhu."); return;
    }
    setDialog({ action: action as PrototypeAction, rule });
  };
  const filteredRules = rules.filter(rule => {
    const text = [rule.name, rule.description, rule.module, moduleLabels[rule.module], whenLabel(rule),
      ...rule.actions.map(action => actionLabels[action.type] || action.type)].join(" ").toLocaleLowerCase();
    const codes = rule.countryCodes?.length ? rule.countryCodes : rule.countryCode ? [rule.countryCode] : [];
    return text.includes(query.trim().toLocaleLowerCase()) &&
      (country === "all" || !codes.length || codes.includes(country)) &&
      (status === "all" || status === "enabled" && rule.enabled || status === "disabled" && !rule.enabled ||
        status === "issues" && hasErrors(rule) || status === "review" && isReviewLocked(rule));
  });
  const confirm = (name?: string, description?: string) => {
    if (!dialog) return;
    const rule = dialog.rule;
    if (dialog.action === "delete" && rule && !rule.isSystem) setRules(list => list.filter(item => item.id !== rule.id));
    if (dialog.action === "review" && rule) update(rule.id, { enabled: true,
      trigger: { ...rule.trigger, legacySource: { ...rule.trigger.legacySource, reviewActivatedAt: new Date().toISOString() } } });
    if (dialog.action === "edit" && rule) update(rule.id, { name: name?.trim() || rule.name, description: description ?? rule.description });
    if (dialog.action === "create") setRules(list => [...list, { ...structuredClone(demoRules[2]), id: `prototype-${Date.now()}`,
      name: name?.trim() || "Nové pravidlo", description: description || "Ukážkový návrh automatizácie.", enabled: false }]);
    setDialog(null);
    setNotice("Zmena je uložená iba v tomto návrhu.");
  };
  return { rules, filteredRules, query, setQuery, status, setStatus, country, setCountry,
    dialog, closeDialog: () => setDialog(null), dispatch, confirm, notice, update };
}

export function PrototypeDialog({ model }: { model: ReturnType<typeof usePrototypeRules> }) {
  const entry = model.dialog;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingKey, setEditingKey] = useState("");
  const key = entry ? `${entry.action}:${entry.rule?.id || ""}` : "";
  if (key !== editingKey) {
    setEditingKey(key);
    setName(entry?.rule?.name || "");
    setDescription(entry?.rule?.description || "");
  }
  const titles: Record<PrototypeAction, string> = { edit: "Upraviť pravidlo", flow: "Priebeh pravidla",
    history: "História pravidla", delete: "Odstrániť pravidlo?", review: "Skontrolovať a aktivovať",
    create: "Nové pravidlo", tags: "Prehľad štítkov záznamov" };
  return <Dialog open={!!entry} onOpenChange={open => !open && model.closeDialog()}>
    <DialogContent className="max-w-xl bg-white text-zinc-900 max-h-[90dvh] overflow-auto">
      <DialogHeader><DialogTitle>{entry && titles[entry.action]}</DialogTitle>
        <DialogDescription>Návrh s ukážkovými údajmi. Žiadne pravidlo v aplikácii sa nezmení ani nespustí.</DialogDescription>
      </DialogHeader>
      {entry && <>
        {(entry.action === "edit" || entry.action === "create") && <div className="space-y-4">
          <label className="block text-sm font-medium">Názov<Input aria-label="Názov pravidla" className="mt-2" value={name} onChange={event => setName(event.target.value)}/></label>
          <label className="block text-sm font-medium">Popis<textarea aria-label="Popis pravidla" className="mt-2 w-full rounded-md border p-3 text-sm" value={description} onChange={event => setDescription(event.target.value)}/></label>
        </div>}
        {entry.action === "flow" && entry.rule && <div className="space-y-3 text-sm">
          {[["KEDY", whenLabel(entry.rule)], ["AK", conditionLabel(entry.rule)],
            ["POTOM", entry.rule.actions.map(action => actionLabels[action.type] || action.type).join(" + ")],
            ["INAK", elseLabel(entry.rule)]].map(([label, value]) => <div key={label} className="rounded-xl border p-4"><small className="font-semibold text-rose-700">{label}</small><p className="mt-1">{value}</p></div>)}
        </div>}
        {entry.action === "history" && <div className="space-y-3 text-sm"><p className="font-medium">{entry.rule?.name}</p>
          <p>Ukážková história na porovnanie návrhu:</p>
          {["Dokončené · podmienky splnené", "Preskočené · podmienky nesplnené", "Dokončené · vykonané akcie"].map((text, index) =>
            <div key={text} className="rounded-lg border p-3">{index + 1}. {text}</div>)}</div>}
        {entry.action === "delete" && <p className="text-sm">Odstráni sa iba ukážkové pravidlo „{entry.rule?.name}“ z tohto návrhu.</p>}
        {entry.action === "review" && <p className="text-sm">Skontrolujte názov, rozsah a priebeh „{entry.rule?.name}“. Táto ukážková aktivácia neovplyvní pôvodné pravidlo v aplikácii.</p>}
        {entry.action === "tags" && <p className="text-sm">Prehľad štítkov zostáva dostupný samostatne. Návrh nemení štítky záznamov.</p>}
        <div className="flex justify-end gap-2 pt-3">
          <Button variant="outline" onClick={model.closeDialog}>Zavrieť</Button>
          {["edit", "create", "delete", "review"].includes(entry.action) && <Button onClick={() => model.confirm(name, description)}>
            {entry.action === "delete" ? "Odstrániť z návrhu" : entry.action === "review" ? "Potvrdiť aktiváciu" : "Uložiť v návrhu"}
          </Button>}
        </div>
      </>}
    </DialogContent>
  </Dialog>;
}

export function PrototypeLegacyReview({ compact = false }: { compact?: boolean }) {
  return <details className="rounded-xl border border-zinc-200 bg-white p-4" open={!compact}>
    <summary className="cursor-pointer text-sm font-semibold">Pôvodné pravidlá · samostatná kontrola</summary>
    <p className="mt-2 text-xs leading-relaxed text-zinc-500">Pôvodné notifikačné a metrické pravidlá zostávajú aktívne do výslovnej kontroly a schválenia náhrady.</p>
    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
      <div className="rounded-lg bg-zinc-50 p-3">Notifikačné pravidlá · pôvodný prehľad</div>
      <div className="rounded-lg bg-zinc-50 p-3">Metrické upozornenia · pôvodný prehľad</div>
    </div>
  </details>;
}
