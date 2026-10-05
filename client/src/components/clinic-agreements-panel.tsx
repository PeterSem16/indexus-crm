import { useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Download, Plus, Pencil, X, Check, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/contexts/auth-context";
import { canEditClinicAgreements } from "@shared/clinic-agreement-permissions";

type ClinicAgreement = {
  id: string; clinicId: string; title: string; contractNumber: string | null;
  validFrom: string | null; validTo: string | null; active: boolean; endedAt: string | null;
  fileName: string; contentType: string; fileSize: number; createdAt: string; updatedAt: string;
};
type AgreementResponse = { agreements: ClinicAgreement[]; canManage: boolean };
type AgreementDraft = { title: string; contractNumber: string; validFrom: string; validTo: string; active: boolean };
const queryKey = (id: string, userId: string, campaignId?: string, readOnly = false, allowReadOnlyEdit = false) =>
  ["/api/clinics", id, "agreements", userId, campaignId || null, readOnly, allowReadOnlyEdit] as const;

async function checkedJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    let message = body || response.statusText;
    try { message = JSON.parse(body).error || message; } catch { /* plain server response */ }
    throw new Error(message);
  }
  const text = await response.text();
  return text ? JSON.parse(text) as T : undefined as T;
}

function effectiveState(row: ClinicAgreement, today: string) {
  if (row.validFrom && row.validFrom > today) return "future";
  if (row.validTo && row.validTo < today) return "expired";
  return "current";
}

function bratislavaDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bratislava", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function ClinicAgreementsPanel({ clinicId, readOnly = false, allowReadOnlyEdit = false, campaignId, countryCode = "SK" }: { clinicId?: string | null; readOnly?: boolean; allowReadOnlyEdit?: boolean; campaignId?: string; countryCode?: string }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const tx = { ...t.clinics.agreements, noTimeLimit: t.datePicker.noTimeLimit };
  const userId = String(user?.id ?? "anonymous");
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [newFrom, setNewFrom] = useState(bratislavaDateKey);
  const [newTo, setNewTo] = useState("");
  const [newUnlimited, setNewUnlimited] = useState(false);
  const [editUnlimited, setEditUnlimited] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AgreementDraft | null>(null);
  const scopedKey = queryKey(clinicId || "unsaved", userId, campaignId, readOnly, allowReadOnlyEdit);
  const agreementUrl = (agreementId?: string) =>
    `/api/clinics/${encodeURIComponent(clinicId!)}/agreements${agreementId ? `/${encodeURIComponent(agreementId)}` : ""}${campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : ""}`;
  const { data, isLoading, isError, refetch } = useQuery<AgreementResponse>({
    queryKey: scopedKey,
    enabled: !!clinicId,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => checkedJson<AgreementResponse>(await fetch(agreementUrl(), { credentials: "include" })),
  });
  const canManage = canEditClinicAgreements(data?.canManage, readOnly, allowReadOnlyEdit);
  const invalidate = async () => { if (clinicId) await queryClient.invalidateQueries({ queryKey: ["/api/clinics", clinicId, "agreements", userId] }); };
  const startEdit = (row: ClinicAgreement) => {
    if (!canManage) return;
    setError(""); setEditingId(row.id);
    setEditUnlimited(!row.validTo);
    setDraft({ title: row.title, contractNumber: row.contractNumber || "", validFrom: row.validFrom || "", validTo: row.validTo || "", active: row.active });
  };
  const patch = async (row: ClinicAgreement, values: Partial<AgreementDraft>) => {
    if (!clinicId || !canManage) return;
    const payload: Partial<AgreementDraft> = {};
    (Object.keys(values) as Array<keyof AgreementDraft>).forEach(key => {
      const current = key === "contractNumber" ? (row.contractNumber || "") : key === "validFrom" ? (row.validFrom || "") : key === "validTo" ? (row.validTo || "") : row[key];
      if (values[key] !== current) payload[key] = values[key] as never;
    });
    if (Object.keys(payload).length === 0) { setEditingId(null); setDraft(null); return; }
    if (busyRef.current) return;
    busyRef.current = true;
    setError(""); setBusyId(row.id);
    try {
      await checkedJson(await fetch(agreementUrl(row.id), {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      }));
      await invalidate();
      if (values.title !== undefined) { setEditingId(null); setDraft(null); }
    } catch { setError(tx.saveError); }
    finally { busyRef.current = false; setBusyId(null); }
  };
  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canManage || !clinicId || !file || !newTitle.trim() || (!newUnlimited && !newTo) || busyId) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "doc", "docx", "jpg", "jpeg", "png"].includes(extension || "")) { setError(tx.invalidFile); return; }
    if (file.size > 20 * 1024 * 1024) { setError(tx.fileTooLarge); return; }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyId("upload"); setError("");
    const form = new FormData();
    form.append("file", file); form.append("title", newTitle.trim());
    if (newNumber.trim()) form.append("contractNumber", newNumber.trim());
    if (newFrom) form.append("validFrom", newFrom);
    if (newTo && !newUnlimited) form.append("validTo", newTo);
    form.append("active", "true");
    try {
      await checkedJson(await fetch(agreementUrl(), { method: "POST", credentials: "include", body: form }));
      await invalidate();
      setFile(null); setNewTitle(""); setNewNumber(""); setNewFrom(bratislavaDateKey()); setNewTo(""); setNewUnlimited(false);
      const input = document.getElementById(`agreement-file-${clinicId}`) as HTMLInputElement | null;
      if (input) input.value = "";
    } catch { setError(tx.uploadError); }
    finally { busyRef.current = false; setBusyId(null); }
  };

  if (!clinicId) return (
    <div className="mx-auto my-8 max-w-lg rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center">
      <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <h3 className="font-semibold">{tx.saveFirstTitle}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{tx.saveFirstDescription}</p>
    </div>
  );

  const today = bratislavaDateKey();
  const isBusy = !!busyId;
  return (
    <section className="space-y-5" aria-label={tx.title} data-testid="clinic-agreements-panel">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold"><FileText className="h-4 w-4 text-primary" />{tx.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{tx.description}</p>
        </div>
        {!canManage && data && <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground"><ShieldAlert className="h-3.5 w-3.5" />{tx.viewOnly}</span>}
      </header>
      {error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}
      {isLoading && <div className="space-y-3" aria-label={t.common.loading}>{[0, 1].map(x => <div key={x} className="h-24 animate-pulse rounded-lg border bg-muted/40" />)}</div>}
      {isError && <div className="rounded-lg border border-destructive/25 p-5 text-center">
        <p className="mb-3 text-sm text-muted-foreground">{tx.loadError}</p>
        <Button type="button" variant="outline" onClick={() => { setError(""); void refetch(); }}>{tx.retry}</Button>
      </div>}
      {!isLoading && !isError && data && data.agreements.length === 0 && (
        <div className="rounded-xl border border-dashed bg-muted/15 px-5 py-8 text-center">
          <FileText className="mx-auto mb-2 h-7 w-7 text-muted-foreground/60" />
          <p className="font-medium">{tx.emptyTitle}</p><p className="mt-1 text-sm text-muted-foreground">{tx.emptyDescription}</p>
        </div>
      )}
      {!isLoading && !isError && data?.agreements.map(row => {
        const state = effectiveState(row, today);
        const stateText = state === "expired" ? tx.expired : state === "future" ? tx.future : tx.inValidity;
        return <article key={row.id} className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary"><FileText className="h-4 w-4" /></div>
              <div className="min-w-0">
                {canManage && editingId === row.id && draft ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2"><Label htmlFor={`title-${row.id}`}>{tx.agreementTitle}</Label><Input disabled={isBusy} id={`title-${row.id}`} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
                    <div><Label htmlFor={`number-${row.id}`}>{tx.contractNumber}</Label><Input disabled={isBusy} id={`number-${row.id}`} value={draft.contractNumber} onChange={e => setDraft({ ...draft, contractNumber: e.target.value })} /></div>
                    <div><Label htmlFor={`from-${row.id}`}>{tx.validFrom}</Label><DateTimePicker disabled={isBusy} id={`from-${row.id}`} includeTime={false} countryCode={countryCode} placeholder={tx.validFrom} value={draft.validFrom} onChange={value => setDraft({ ...draft, validFrom: value })} /></div>
                    <div className="space-y-2"><Label htmlFor={`to-${row.id}`}>{tx.validTo}</Label><DateTimePicker disabled={isBusy || editUnlimited} id={`to-${row.id}`} includeTime={false} countryCode={countryCode} placeholder={tx.validTo} value={draft.validTo} onChange={value => setDraft({ ...draft, validTo: value })} />
                      <div className="flex items-start gap-2"><Checkbox id={`unlimited-${row.id}`} disabled={isBusy} checked={editUnlimited} onCheckedChange={checked => { setEditUnlimited(checked === true); if (checked === true) setDraft({ ...draft, validTo: "" }); }} /><Label htmlFor={`unlimited-${row.id}`} className="text-xs leading-4">{tx.noTimeLimit}</Label></div>
                    </div>
                  </div>
                ) : <>
                  <h4 className="truncate font-semibold">{row.title}</h4>
                  <p className="mt-0.5 break-all text-xs text-muted-foreground">{row.fileName}{row.contractNumber ? ` · ${tx.contractNumber}: ${row.contractNumber}` : ""} · {(row.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {(!row.active || state === "current") && <span className={`rounded-full px-2 py-0.5 ${row.active ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-muted text-muted-foreground"}`}>{row.active ? tx.active : tx.inactive}</span>}
                    {row.active && <span className={`rounded-full px-2 py-0.5 ${state === "current" ? "bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200" : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200"}`}>{stateText}</span>}
                    {(row.validFrom || row.validTo) && <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{row.validFrom || "…"} – {row.validTo || "…"}</span>}
                    {!row.validTo && <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{tx.noTimeLimit}</span>}
                  </div>
                </>}
              </div>
            </div>
            <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">
              <a aria-label={`${tx.download}: ${row.fileName}`} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted" href={`/api/clinics/${encodeURIComponent(clinicId)}/agreements/${encodeURIComponent(row.id)}/download`} download>
                <Download className="h-4 w-4" /><span>{tx.download}</span>
              </a>
              {canManage && editingId !== row.id && <Button type="button" variant="ghost" size="sm" aria-label={tx.edit} disabled={isBusy} onClick={() => startEdit(row)}><Pencil className="mr-2 h-4 w-4" />{tx.edit}</Button>}
              {canManage && editingId === row.id && draft && <>
                <Button type="button" variant="ghost" size="sm" aria-label={tx.cancel} disabled={isBusy} onClick={() => { setEditingId(null); setDraft(null); }}><X className="mr-2 h-4 w-4" />{tx.cancel}</Button>
                <Button type="button" size="sm" aria-label={tx.save} disabled={!draft.title.trim() || (!editUnlimited && !draft.validTo) || isBusy} onClick={() => void patch(row, draft)}>{busyId === row.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}{tx.save}</Button>
              </>}
            </div>
          </div>
          {canManage && editingId !== row.id && <div className="mt-3 flex items-center gap-2 border-t pt-3">
            <Switch checked={row.active} disabled={isBusy} onCheckedChange={active => void patch(row, { active })} aria-label={row.active ? tx.endValidity : tx.reactivate} />
            <span className="text-sm text-muted-foreground">{row.active ? tx.endValidity : tx.reactivate}</span>
            {busyId === row.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>}
        </article>;
      })}
      {canManage && <form onSubmit={upload} className="rounded-xl border bg-muted/15 p-4">
        <div className="mb-4 flex items-center gap-2 font-semibold"><Plus className="h-4 w-4 text-primary" />{tx.addAgreement}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label htmlFor={`agreement-title-${clinicId}`}>{tx.agreementTitle} *</Label><Input disabled={isBusy} id={`agreement-title-${clinicId}`} value={newTitle} onChange={e => setNewTitle(e.target.value)} required maxLength={240} /></div>
          <div><Label htmlFor={`agreement-number-${clinicId}`}>{tx.contractNumber}</Label><Input disabled={isBusy} id={`agreement-number-${clinicId}`} value={newNumber} onChange={e => setNewNumber(e.target.value)} /></div>
          <div><Label htmlFor={`agreement-from-${clinicId}`}>{tx.validFrom}</Label><DateTimePicker disabled={isBusy} id={`agreement-from-${clinicId}`} data-testid="agreement-valid-from" includeTime={false} countryCode={countryCode} placeholder={tx.validFrom} value={newFrom} onChange={setNewFrom} /></div>
          <div className="space-y-2"><Label htmlFor={`agreement-to-${clinicId}`}>{tx.validTo}</Label><DateTimePicker required={!newUnlimited} disabled={isBusy || newUnlimited} id={`agreement-to-${clinicId}`} data-testid="agreement-valid-to" includeTime={false} countryCode={countryCode} placeholder={tx.validTo} value={newTo} onChange={setNewTo} />
            <div className="flex items-start gap-2"><Checkbox id={`agreement-unlimited-${clinicId}`} disabled={isBusy} checked={newUnlimited} onCheckedChange={checked => { setNewUnlimited(checked === true); if (checked === true) setNewTo(""); }} /><Label htmlFor={`agreement-unlimited-${clinicId}`} className="text-xs leading-4">{tx.noTimeLimit}</Label></div>
          </div>
          <div className="sm:col-span-2"><Label htmlFor={`agreement-file-${clinicId}`}>{tx.file} *</Label><Input disabled={isBusy} id={`agreement-file-${clinicId}`} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png" required onChange={e => { setError(""); const selected = e.target.files?.[0] || null; const ext = selected?.name.split(".").pop()?.toLowerCase(); if (selected && !["pdf", "doc", "docx", "jpg", "jpeg", "png"].includes(ext || "")) { setFile(null); setError(tx.invalidFile); e.target.value = ""; } else if (selected && selected.size > 20 * 1024 * 1024) { setFile(null); setError(tx.fileTooLarge); e.target.value = ""; } else setFile(selected); }} /><p className="mt-1 text-xs text-muted-foreground">{tx.fileRules}</p></div>
        </div>
        <div className="mt-4 flex justify-end"><Button type="submit" disabled={!file || !newTitle.trim() || (!newUnlimited && !newTo) || isBusy}>{busyId === "upload" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busyId === "upload" ? tx.uploading : tx.upload}</Button></div>
      </form>}
    </section>
  );
}

export default ClinicAgreementsPanel;