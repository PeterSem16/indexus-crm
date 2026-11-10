import { FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";

export type PendingClinicAgreement = {
  id: string; file: File; title: string; contractNumber: string;
  validFrom: string; validTo: string; unlimited: boolean;
};
const today = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bratislava", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(value => value.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
export function ClinicCreateAgreements({ rows, onChange, countryCode, committed = new Set() }: {
  rows: PendingClinicAgreement[]; onChange: (rows: PendingClinicAgreement[]) => void; countryCode: string;
  committed?: ReadonlySet<string>;
}) {
  const { t } = useI18n(), { toast } = useToast();
  const tx = t.clinics.agreements, wx = t.agreementWorkspace;
  const update = (id: string, values: Partial<PendingClinicAgreement>) =>
    onChange(rows.map(row => row.id === id ? { ...row, ...values } : row));
  return <section className="min-w-0 space-y-4" data-testid="clinic-create-agreements">
    <h3 className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4" />{tx.title}</h3>
    <p className="text-sm text-muted-foreground">{t.clinicCreation.pending}</p>
    <Label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
      <Plus className="h-4 w-4" />{wx.newAgreement}
      <Input type="file" multiple className="sr-only" data-testid="input-create-agreement-files"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={event => {
          const files = Array.from(event.target.files || []);
          if (files.some(file => file.size > 20 * 1024 * 1024 || !/\.(pdf|docx?|jpe?g|png)$/i.test(file.name))) {
            toast({ title: tx.uploadError, description: wx.uploadRules, variant: "destructive" });
          } else onChange([...rows, ...files.map(file => ({
            id: crypto.randomUUID(), file, title: file.name.replace(/\.[^.]+$/, "").slice(0, 200),
            contractNumber: "", validFrom: today(), validTo: "", unlimited: false,
          }))]);
          event.target.value = "";
        }} />
    </Label>
    {rows.map(row => <fieldset disabled={committed.has(row.id)} key={row.id} className="min-w-0 space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2"><span className="break-all text-sm">{row.file.name}</span>
        {committed.has(row.id) && <span className="text-xs text-muted-foreground">{t.success.saved}</span>}
        <Button type="button" variant="ghost" size="icon" aria-label={t.common.delete} onClick={() => onChange(rows.filter(item => item.id !== row.id))}><Trash2 className="h-4 w-4" /></Button></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><Label>{tx.agreementTitle} *</Label><Input value={row.title} maxLength={200} onChange={event => update(row.id, { title: event.target.value })} /></div>
        <div><Label>{tx.contractNumber}</Label><Input maxLength={100} value={row.contractNumber} onChange={event => update(row.id, { contractNumber: event.target.value })} /></div>
        <div><Label>{tx.validFrom}</Label><DateTimePicker includeTime={false} countryCode={countryCode} value={row.validFrom} onChange={validFrom => update(row.id, { validFrom })} /></div>
        <div><Label>{tx.validTo}</Label><DateTimePicker includeTime={false} countryCode={countryCode} value={row.validTo} disabled={row.unlimited} onChange={validTo => update(row.id, { validTo })} /></div>
      </div>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={row.unlimited} onCheckedChange={value => update(row.id, { unlimited: value === true, ...(value ? { validTo: "" } : {}) })} />{t.datePicker.noTimeLimit}</label>
      {!row.unlimited && !row.validTo && <p className="text-xs text-destructive">{wx.requiredField.replace("{field}", tx.validTo)}</p>}
    </fieldset>)}
  </section>;
}
