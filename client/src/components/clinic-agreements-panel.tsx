import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Archive, CalendarDays, Check, ChevronDown, Download, Eye, FileImage, FileText, Loader2, Plus, Search, ShieldAlert, Trash2, UploadCloud, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/contexts/auth-context";
import { canEditClinicAgreements } from "@shared/clinic-agreement-permissions";

type ClinicAgreement = {
  id: string; clinicId: string; title: string; contractNumber: string | null;
  validFrom: string | null; validTo: string | null; active: boolean; endedAt: string | null;
  fileName: string; contentType: string; fileSize: number; createdAt: string; updatedAt: string;
  groupId: string; version: number; reason: string | null; archivedAt: string | null;
  fileDeletedAt: string | null; fileDeletedBy: string | null; fileDeleteReason: string | null;
  filePurgedAt: string | null;
  createdByName: string | null;
};
type AgreementResponse = { agreements: ClinicAgreement[]; canManage: boolean; canDelete: boolean };
type AgreementDraft = { title: string; contractNumber: string; validFrom: string; validTo: string; active: boolean };
type FormMode = "new" | "version";
type ConfirmTarget = { kind: "archive"; row: ClinicAgreement } | { kind: "file"; row: ClinicAgreement } | null;

const queryKey = (entityType: "clinic" | "hospital", id: string, userId: string, campaignId?: string, readOnly = false, allowReadOnlyEdit = false) =>
  [`/api/${entityType === "clinic" ? "clinics" : "hospitals"}`, id, "agreements", userId, campaignId || null, readOnly, allowReadOnlyEdit] as const;
const allowedExtensions = ["pdf", "doc", "docx", "jpg", "jpeg", "png"];

async function checkedJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    let message = body || response.statusText;
    try { message = JSON.parse(body).error || message; } catch { /* server may return plain text */ }
    throw new Error(message);
  }
  const text = await response.text();
  return text ? JSON.parse(text) as T : undefined as T;
}

function effectiveState(row: ClinicAgreement, today: string) {
  if (row.validFrom && row.validFrom.slice(0, 10) > today) return "future";
  if (row.validTo && row.validTo.slice(0, 10) < today) return "expired";
  return "current";
}
function dateKey(timeZone = "Europe/Bratislava") {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
function displayDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Europe/Bratislava" }).format(parsed);
}
function displayDateTime(value: string, locale: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Bratislava" }).format(parsed);
}
function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`;
}

export function ClinicAgreementsPanel({ clinicId, readOnly = false, allowReadOnlyEdit = false, campaignId, countryCode = "SK", entityType = "clinic" }: { clinicId?: string | null; readOnly?: boolean; allowReadOnlyEdit?: boolean; campaignId?: string; countryCode?: string; entityType?: "clinic" | "hospital" }) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const tx = entityType === "hospital" ? t.hospitals.agreements : t.clinics.agreements;
  const wx = t.agreementWorkspace as Required<typeof t.agreementWorkspace>;
  const userId = String(user?.id ?? "anonymous");
  const queryClient = useQueryClient();
  const entityPath = entityType === "clinic" ? "clinics" : "hospitals";
  const scopedKey = queryKey(entityType, clinicId || "unsaved", userId, campaignId, readOnly, allowReadOnlyEdit);
  const agreementUrl = (agreementId?: string, action?: string) => {
    const query = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : "";
    return `/api/${entityPath}/${encodeURIComponent(String(clinicId))}/agreements${agreementId ? `/${encodeURIComponent(agreementId)}${action ? `/${action}` : ""}` : ""}${query}`;
  };
  const { data, isLoading, isError, refetch } = useQuery<AgreementResponse>({
    queryKey: scopedKey, enabled: !!clinicId, staleTime: 0, refetchOnMount: "always",
    queryFn: async () => checkedJson<AgreementResponse>(await fetch(agreementUrl(), { credentials: "include" })),
  });
  const canManage = entityType === "clinic"
    ? canEditClinicAgreements(data?.canManage, readOnly, allowReadOnlyEdit)
    : !!data?.canManage && (!readOnly || allowReadOnlyEdit);
  const canDelete = !!data?.canDelete && canManage;
  const invalidate = async () => { if (clinicId) await queryClient.invalidateQueries({ queryKey: [`/api/${entityPath}`, clinicId, "agreements", userId] }); };
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [expandedVersions, setExpandedVersions] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AgreementDraft | null>(null);
  const [editUnlimited, setEditUnlimited] = useState(false);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [number, setNumber] = useState("");
  const [validFrom, setValidFrom] = useState(dateKey);
  const [validTo, setValidTo] = useState("");
  const [unlimited, setUnlimited] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);
  const [confirmReason, setConfirmReason] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<ClinicAgreement | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewType, setPreviewType] = useState("");
  const [previewError, setPreviewError] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewRequest = useRef<AbortController | null>(null);
  const busyRef = useRef(false);

  const rows = data?.agreements || [];
  const groups = useMemo(() => {
    const map = new Map<string, ClinicAgreement[]>();
    for (const row of rows) {
      const list = map.get(row.groupId) || [];
      list.push(row); map.set(row.groupId, list);
    }
    return Array.from(map.entries()).map(([groupId, versions]) => ({
      groupId,
      versions: versions.sort((a, b) => b.version - a.version),
      latest: [...versions].sort((a, b) => b.version - a.version)[0],
      archived: versions.every(version => !!version.archivedAt),
    })).sort((a, b) => new Date(b.latest.updatedAt || b.latest.createdAt).getTime() - new Date(a.latest.updatedAt || a.latest.createdAt).getTime());
  }, [rows]);
  const visibleGroups = groups.filter(group => group.archived === archiveOpen && `${group.latest.title} ${group.latest.contractNumber || ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const selected = visibleGroups.find(group => group.groupId === selectedGroup) || visibleGroups[0] || null;
  const today = dateKey();
  const latestState = (row: ClinicAgreement) => !row.active ? wx.inactive : ({ future: wx.future, expired: wx.expired, current: wx.current }[effectiveState(row, today)]);

  useEffect(() => {
    if (selected && selectedGroup !== selected.groupId) setSelectedGroup(selected.groupId);
    if (!selected && selectedGroup) setSelectedGroup(null);
  }, [selected?.groupId, selectedGroup]);
  useEffect(() => {
    previewRequest.current?.abort();
    if (!previewTarget) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(""); setPreviewType(""); setPreviewLoading(false); setPreviewError(false);
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const controller = new AbortController();
    previewRequest.current = controller;
    setPreviewLoading(true); setPreviewError(false); setPreviewUrl(""); setPreviewType("");
    fetch(agreementUrl(previewTarget.id, "preview"), { credentials: "include", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        setPreviewType(response.headers.get("content-type") || blob.type);
        setPreviewUrl(URL.createObjectURL(blob));
      })
      .catch(() => { if (!controller.signal.aborted) setPreviewError(true); })
      .finally(() => { if (!controller.signal.aborted) setPreviewLoading(false); });
    return () => controller.abort();
  // The selected record identity determines the preview request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewTarget?.id, clinicId, entityType, userId, campaignId, previewAttempt]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => {
    setFormOpen(false); setConfirmTarget(null); setPreviewTarget(null); setEditingId(null); setDraft(null);
    setFile(null); setFormError(""); setError(""); setSearch(""); setArchiveOpen(false);
    setSelectedGroup(null); setExpandedVersions([]);
  }, [clinicId, entityType, campaignId, userId]);

  const receiveFile = (selectedFile?: File) => {
    setFormError("");
    if (!selectedFile) return;
    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (!allowedExtensions.includes(ext || "")) { setFile(null); setFormError(tx.invalidFile); if (fileInput.current) fileInput.current.value = ""; return; }
    if (selectedFile.size > 20 * 1024 * 1024) { setFile(null); setFormError(tx.fileTooLarge); if (fileInput.current) fileInput.current.value = ""; return; }
    setFile(selectedFile);
    if (!title.trim()) setTitle(selectedFile.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); receiveFile(event.dataTransfer.files?.[0]); };
  const openForm = (mode: FormMode, group?: typeof selected) => {
    setFormMode(mode); setError(""); setFormError(""); setFile(null); setChangeReason(""); setFormOpen(true);
    if (mode === "version" && group) {
      const current = group.latest;
      setTitle(current.title); setNumber(current.contractNumber || "");
      setValidFrom(current.validTo ? (() => { const date = new Date(`${current.validTo.slice(0, 10)}T12:00:00`); date.setDate(date.getDate() + 1); return date.toISOString().slice(0, 10); })() : dateKey());
      setValidTo(""); setUnlimited(false);
    } else { setTitle(""); setNumber(""); setValidFrom(dateKey()); setValidTo(""); setUnlimited(false); setArchiveOpen(false); }
  };
  const patch = async (row: ClinicAgreement, values: Partial<AgreementDraft>) => {
    if (!clinicId || !canManage || busyRef.current) return;
    if (values.title !== undefined && values.validFrom && values.validTo && values.validFrom.slice(0, 10) > values.validTo.slice(0, 10)) {
      setError(wx.dateRangeError || tx.saveError);
      return;
    }
    busyRef.current = true; setBusy(true); setError("");
    try {
      await checkedJson(await fetch(agreementUrl(row.id), { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }));
      await invalidate();
      if (values.title !== undefined) { setEditingId(null); setDraft(null); }
    } catch { setError(tx.saveError); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const startEdit = (row: ClinicAgreement) => {
    setEditingId(row.id); setEditUnlimited(!row.validTo);
    setDraft({ title: row.title, contractNumber: row.contractNumber || "", validFrom: row.validFrom?.slice(0, 10) || "", validTo: row.validTo?.slice(0, 10) || "", active: row.active });
  };
  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clinicId || !canManage || !file || !title.trim() || (!unlimited && !validTo) || (formMode === "version" && !changeReason.trim())) return;
    if (validFrom && validTo && !unlimited && validFrom > validTo) { setFormError(wx.dateRangeError || tx.saveError); return; }
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setFormError(""); setError("");
    const form = new FormData();
    form.append("file", file); form.append("title", title.trim());
    if (number.trim()) form.append("contractNumber", number.trim());
    if (validFrom) form.append("validFrom", validFrom);
    if (validTo && !unlimited) form.append("validTo", validTo);
    form.append("active", "true");
    if (formMode === "version" && selected) {
      form.append("parentId", selected.latest.id);
      form.append("reason", changeReason.trim());
    }
    try {
      await checkedJson(await fetch(agreementUrl(), { method: "POST", credentials: "include", body: form }));
      await invalidate(); setFormOpen(false); setFile(null); setTitle(""); setNumber(""); setChangeReason("");
      if (fileInput.current) fileInput.current.value = "";
    } catch { setFormError(tx.uploadError); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const commitConfirm = async () => {
    if (!confirmTarget || !clinicId || !canDelete || !confirmReason.trim() || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const route = confirmTarget.kind === "archive" ? "archive" : "file";
      await checkedJson(await fetch(agreementUrl(confirmTarget.row.id, route), { method: confirmTarget.kind === "archive" ? "POST" : "DELETE", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: confirmReason.trim() }) }));
      await invalidate(); setConfirmTarget(null); setConfirmReason("");
    } catch {
      if (confirmTarget.kind === "file") await invalidate();
      setFormError(confirmTarget.kind === "file" ? wx.purgeRetryError : tx.saveError);
    }
    finally { busyRef.current = false; setBusy(false); }
  };
  const downloadHref = (row: ClinicAgreement) => agreementUrl(row.id, "download");

  if (!clinicId) return <div className="mx-auto my-8 max-w-lg rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center">
    <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h3 className="font-semibold">{tx.saveFirstTitle}</h3><p className="mt-1 text-sm text-muted-foreground">{tx.saveFirstDescription}</p>
  </div>;

  return <section className="space-y-4" aria-label={tx.title} data-testid={`${entityType}-agreements-panel`}>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="flex items-center gap-2 text-base font-semibold"><FileText className="h-4 w-4 text-primary" />{tx.title}</h3><p className="mt-1 text-sm text-muted-foreground">{tx.description}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        {!canManage && data && <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground"><ShieldAlert className="h-3.5 w-3.5" />{tx.viewOnly}</span>}
      </div>
    </header>
    {error && <div role="status" className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" /><span>{error}</span><button type="button" className="ml-auto" aria-label={wx.close} onClick={() => setError("")}><X className="h-4 w-4" /></button></div>}
    {isLoading && <div className="grid gap-3" aria-label={t.common.loading}><div className="h-16 animate-pulse rounded-lg border bg-muted/40" /><div className="h-56 animate-pulse rounded-lg border bg-muted/40" /></div>}
    {isError && <div role="alert" className="rounded-lg border border-destructive/25 p-5 text-center"><p className="mb-3 text-sm text-muted-foreground">{tx.loadError}</p><Button type="button" variant="outline" onClick={() => void refetch()}>{tx.retry}</Button></div>}
    {!isLoading && !isError && data && <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border bg-muted/30 p-1" role="group" aria-label={tx.title}>
          <button type="button" aria-pressed={!archiveOpen} onClick={() => { setArchiveOpen(false); setSelectedGroup(null); }} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${!archiveOpen ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{wx.activeView}<span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px]">{groups.filter(group => !group.archived).length}</span></button>
          <button type="button" aria-pressed={archiveOpen} onClick={() => { setArchiveOpen(true); setSelectedGroup(null); }} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${archiveOpen ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{wx.archive}<span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px]">{groups.filter(group => group.archived).length}</span></button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder={wx.search} aria-label={wx.search} className="h-9 w-[min(260px,55vw)] pl-8" /></div>
          {canManage && <Button size="sm" className="gap-1.5" onClick={() => openForm("new")}><Plus className="h-4 w-4" />{wx.newAgreement}</Button>}
        </div>
      </div>
      {groups.length === 0 ? <div className="rounded-xl border border-dashed bg-muted/10 px-5 py-9 text-center"><FileText className="mx-auto mb-2 h-7 w-7 text-muted-foreground/60" /><p className="font-medium">{tx.emptyTitle}</p><p className="mt-1 text-sm text-muted-foreground">{tx.emptyDescription}</p></div> :
      visibleGroups.length === 0 ? <div className="rounded-xl border border-dashed bg-muted/10 px-5 py-9 text-center"><p className="font-medium">{wx.noResults}</p></div> :
      <div className="grid min-h-[390px] overflow-hidden rounded-xl border bg-card md:grid-cols-[minmax(220px,290px)_minmax(0,1fr)]">
        <aside aria-label={archiveOpen ? wx.archive : wx.activeView} className="flex min-w-0 flex-col border-b bg-muted/10 md:border-b-0 md:border-r">
          <div className="flex items-center justify-between border-b px-3 py-2 text-[10px] font-bold tracking-[.08em] text-muted-foreground"><span>{archiveOpen ? wx.archiveCount : wx.activeCount}</span><CalendarDays className="h-3.5 w-3.5" /></div>
          <div className="max-h-[245px] overflow-y-auto md:max-h-[540px]">
            {visibleGroups.map(group => <button key={group.groupId} type="button" aria-current={selected?.groupId === group.groupId ? "true" : undefined} onClick={() => { setSelectedGroup(group.groupId); setEditingId(null); setDraft(null); }} className={`relative grid w-full grid-cols-[28px_minmax(0,1fr)] items-start gap-2 border-b px-3 py-3 text-left hover:bg-muted/40 ${selected?.groupId === group.groupId ? "bg-primary/5" : ""}`}>
              {selected?.groupId === group.groupId && <span className="absolute inset-y-0 left-0 w-[3px] bg-primary" />}
              <span className="grid h-7 w-7 place-items-center rounded-md border bg-background text-primary"><FileText className="h-4 w-4" /></span>
              <span className="min-w-0"><b className="line-clamp-2 text-xs leading-5">{group.latest.title}</b><small className="mt-0.5 block truncate text-[10px] text-muted-foreground">{group.latest.contractNumber || "—"}</small><small className="mt-1 block text-[10px] text-muted-foreground">v{group.latest.version} · {displayDate(group.latest.validFrom, locale)}</small><span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] ${group.archived ? "bg-muted text-muted-foreground" : group.latest.active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-muted text-muted-foreground"}`}>{group.archived ? wx.archived : latestState(group.latest)}</span></span>
            </button>)}
          </div>
          <p className="mt-auto border-t px-3 py-2 text-[10px] text-muted-foreground">{wx.fileRemoved} ≠ {tx.title}</p>
        </aside>
        <div className="min-w-0 p-3 sm:p-5">
          {!selected ? <div className="flex min-h-[260px] items-center justify-center text-center text-sm text-muted-foreground">{wx.selectRecord}</div> : <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
              <div className="flex min-w-0 items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-primary/15 bg-primary/5 text-primary"><FileText className="h-5 w-5" /></span><div className="min-w-0"><span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{tx.title} · {selected.latest.contractNumber || "—"}</span><h4 className="mt-1 break-words text-sm font-semibold">{selected.latest.title}</h4><p className="mt-1 text-xs text-muted-foreground">{selected.versions.length} {wx.versions} · {wx.latest.toLocaleLowerCase()}: {displayDateTime(selected.latest.updatedAt || selected.latest.createdAt, locale)}</p></div></div>
              <div className="flex flex-wrap items-center gap-2">
                {canManage && !selected.archived && <Button type="button" size="sm" variant="outline" onClick={() => openForm("version", selected)}><Plus className="mr-1.5 h-3.5 w-3.5" />{wx.addVersion}</Button>}
                {canManage && !selected.archived && <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(selected.latest)}>{tx.edit}</Button>}
                {canDelete && !selected.archived && <Button type="button" size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => { setConfirmTarget({ kind: "archive", row: selected.latest }); setConfirmReason(""); setFormError(""); }}><Archive className="mr-1.5 h-3.5 w-3.5" />{wx.archiveAction}</Button>}
              </div>
            </div>
            {editingId === selected.latest.id && draft && <form className="my-3 rounded-lg border bg-muted/15 p-3" onSubmit={event => { event.preventDefault(); void patch(selected.latest, draft); }}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><Label htmlFor={`agreement-edit-title-${selected.latest.id}`}>{tx.agreementTitle}</Label><Input id={`agreement-edit-title-${selected.latest.id}`} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} maxLength={200} required disabled={busy} /></div>
                <div><Label htmlFor={`agreement-edit-number-${selected.latest.id}`}>{tx.contractNumber}</Label><Input id={`agreement-edit-number-${selected.latest.id}`} value={draft.contractNumber} maxLength={100} onChange={event => setDraft({ ...draft, contractNumber: event.target.value })} disabled={busy} /></div>
                <div><Label>{tx.validFrom}</Label><DateTimePicker disabled={busy} includeTime={false} countryCode={countryCode} placeholder={tx.validFrom} value={draft.validFrom} onChange={value => setDraft({ ...draft, validFrom: value })} /></div>
                <div className="space-y-2"><Label>{tx.validTo}</Label><DateTimePicker disabled={busy || editUnlimited} includeTime={false} countryCode={countryCode} placeholder={tx.validTo} value={draft.validTo} onChange={value => setDraft({ ...draft, validTo: value })} /><div className="flex items-center gap-2"><Checkbox id={`agreement-edit-unlimited-${selected.latest.id}`} checked={editUnlimited} disabled={busy} onCheckedChange={checked => { setEditUnlimited(checked === true); if (checked) setDraft({ ...draft, validTo: "" }); }} /><Label htmlFor={`agreement-edit-unlimited-${selected.latest.id}`} className="text-xs">{t.datePicker.noTimeLimit}</Label></div></div>
              </div>
              <div className="mt-3 flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => { setEditingId(null); setDraft(null); }}>{tx.cancel}</Button><Button type="submit" size="sm" disabled={busy || !draft.title.trim()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}{tx.save}</Button></div>
            </form>}
            <div className="my-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
              <span className={`rounded-full px-2 py-1 ${selected.archived ? "bg-muted" : selected.latest.active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-muted"}`}>{selected.archived ? wx.archived : latestState(selected.latest)}</span>
              <span>{tx.validFrom}: {displayDate(selected.latest.validFrom, locale)} — {tx.validTo}: {displayDate(selected.latest.validTo, locale)}</span>
              {!selected.latest.validTo && <span className="rounded-full bg-muted px-2 py-1">{t.datePicker.noTimeLimit}</span>}
              {canManage && !selected.archived && <span className="ml-auto flex items-center gap-2 border-l pl-3"><Switch checked={selected.latest.active} disabled={busy} onCheckedChange={active => void patch(selected.latest, { active })} aria-label={selected.latest.active ? tx.endValidity : tx.reactivate} />{selected.latest.active ? tx.endValidity : tx.reactivate}</span>}
            </div>
            <div className="mb-2 flex items-center justify-between border-b pb-2"><div><span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{wx.timeline}</span><p className="text-xs text-muted-foreground">{wx.latest}</p></div><span className="text-xs text-muted-foreground">{selected.versions.length}</span></div>
            <ol className="ml-2 border-l pl-4">
              {selected.versions.map((row, index) => {
                const expanded = expandedVersions.includes(row.id) || index === 0;
                const state = effectiveState(row, today);
                return <li key={row.id} className="relative pb-3 last:pb-0">
                  <span className={`absolute -left-[21px] top-3 h-2 w-2 rounded-full border ${index === 0 ? "border-primary bg-primary ring-4 ring-primary/10" : "border-muted-foreground/50 bg-background"}`} />
                  <div className="rounded-lg border bg-background">
                    <button type="button" className="flex w-full items-center gap-2 p-2.5 text-left hover:bg-muted/25" aria-expanded={expanded} onClick={() => setExpandedVersions(values => expanded ? values.filter(id => id !== row.id) : [...values, row.id])}>
                      <span className="grid h-6 min-w-8 place-items-center rounded border text-[10px] font-semibold">v{row.version}</span>
                      <span className="min-w-0 flex-1"><b className="block truncate text-xs">{row.fileName}</b><small className="text-[10px] text-muted-foreground">{displayDate(row.validFrom, locale)} — {row.validTo ? displayDate(row.validTo, locale) : t.datePicker.noTimeLimit}</small></span>
                      <span className={`hidden rounded-full px-2 py-1 text-[10px] sm:inline-flex ${row.archivedAt ? "bg-muted text-muted-foreground" : row.active && state === "current" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"}`}>{row.archivedAt ? wx.archived : row.active ? ({ future: wx.future, expired: wx.expired, current: wx.current }[state]) : wx.inactive}</span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </button>
                    {expanded && <div className="space-y-3 border-t bg-muted/10 p-3">
                      <dl className="grid gap-2 text-xs sm:grid-cols-3"><div><dt className="text-muted-foreground">{wx.createdBy}</dt><dd className="truncate font-medium">{row.createdByName || "—"}</dd></div><div><dt className="text-muted-foreground">{wx.createdAt}</dt><dd className="font-medium">{displayDateTime(row.createdAt, locale)}</dd></div><div><dt className="text-muted-foreground">{tx.contractNumber}</dt><dd className="truncate font-medium">{row.contractNumber || "—"}</dd></div></dl>
                      <div className="rounded-md border bg-background px-3 py-2"><b className="text-[10px] text-muted-foreground">{wx.reason}</b><p className="mt-1 whitespace-pre-wrap text-xs">{row.reason || wx.noReason}</p></div>
                      <div className={`flex flex-wrap items-center gap-3 rounded-md border p-2.5 ${row.fileDeletedAt ? "border-destructive/20 bg-destructive/5" : "bg-background"}`}>
                        <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/5 text-primary"><FileImage className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1"><b className="block break-all text-xs">{row.fileName}</b><small className="text-[10px] text-muted-foreground">{row.contentType || row.fileName.split(".").pop()?.toUpperCase()} · {fileSize(row.fileSize)}</small>{row.fileDeletedAt && <small className="mt-1 block text-[10px] text-destructive">{row.filePurgedAt ? wx.purgeConfirmed : wx.purgePending} · {row.fileDeletedBy || "—"} · {displayDateTime(row.fileDeletedAt, locale)} · {row.fileDeleteReason || ""}</small>}</span>
                        {!row.fileDeletedAt ? <div className="flex flex-wrap gap-1.5">
                          <Button type="button" variant="outline" size="sm" onClick={() => { setPreviewTarget(row); setPreviewScale(1); }}><Eye className="mr-1.5 h-3.5 w-3.5" />{wx.preview}</Button>
                          <a className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm hover:bg-muted" href={downloadHref(row)} download><Download className="h-3.5 w-3.5" />{tx.download}</a>
                          {canDelete && <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { setConfirmTarget({ kind: "file", row }); setConfirmReason(""); setFormError(""); }}><Trash2 className="mr-1.5 h-3.5 w-3.5" />{wx.fileDelete}</Button>}
                        </div> : <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">{wx.unavailable}</span>{canDelete && !row.filePurgedAt && <Button type="button" variant="outline" size="sm" onClick={() => { setConfirmTarget({ kind: "file", row }); setConfirmReason(""); setFormError(""); }}><Trash2 className="mr-1.5 h-3.5 w-3.5" />{wx.purgeRetry}</Button>}</div>}
                      </div>
                    </div>}
                  </div>
                </li>;
              })}
            </ol>
          </>}
        </div>
      </div>}
    </>}

    <Dialog open={formOpen} onOpenChange={open => { if (!busy) { setFormOpen(open); if (!open) setFormError(""); } }}>
      <DialogContent hideCloseButton overlayClassName="z-[10050]" className="z-[10051] max-h-[min(92dvh,820px)] w-[min(680px,calc(100vw-20px))] max-w-none overflow-y-auto p-0">
        <DialogHeader className="relative border-b bg-primary/[.035] px-5 py-4 pr-12">
          <DialogClose asChild><Button type="button" variant="ghost" size="icon" className="absolute right-3 top-3" disabled={busy} aria-label={wx.close}><X className="h-4 w-4" /></Button></DialogClose>
          <DialogTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" />{formMode === "version" ? wx.versionTitle : wx.newAgreement}</DialogTitle>
          <DialogDescription>{formMode === "version" ? wx.versionDescription : wx.newDescription}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submitForm}>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {formMode === "version" && <div className="sm:col-span-2 rounded-md border border-primary/15 bg-primary/[.035] px-3 py-2 text-xs text-muted-foreground">{wx.reasonRequired}</div>}
            <div className="sm:col-span-2"><Label htmlFor="agreement-title">{tx.agreementTitle} *</Label><Input id="agreement-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={200} required disabled={busy} /></div>
            <div><Label htmlFor="agreement-number">{tx.contractNumber}</Label><Input id="agreement-number" value={number} onChange={event => setNumber(event.target.value)} disabled={busy} /></div>
            <div><Label>{tx.validFrom}</Label><DateTimePicker disabled={busy} includeTime={false} countryCode={countryCode} placeholder={tx.validFrom} value={validFrom} onChange={setValidFrom} /></div>
            <div><Label>{tx.validTo}</Label><DateTimePicker disabled={busy || unlimited} includeTime={false} countryCode={countryCode} placeholder={tx.validTo} value={validTo} onChange={setValidTo} /></div>
            <div className="flex items-end gap-2 pb-2"><Checkbox id="agreement-unlimited" checked={unlimited} disabled={busy} onCheckedChange={checked => { setUnlimited(checked === true); if (checked) setValidTo(""); }} /><Label htmlFor="agreement-unlimited" className="text-xs">{t.datePicker.noTimeLimit}</Label></div>
            {formMode === "version" && <div className="sm:col-span-2"><Label htmlFor="agreement-reason">{wx.reason} *</Label><Textarea id="agreement-reason" value={changeReason} onChange={event => setChangeReason(event.target.value)} placeholder={wx.reasonPlaceholder} maxLength={1000} required disabled={busy} className="min-h-20" /></div>}
            <div className="sm:col-span-2">
              <Label htmlFor="agreement-upload">{tx.file} *</Label>
              <div onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => !busy && fileInput.current?.click()} className={`mt-1 flex min-h-[105px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-4 text-center transition-colors ${dragging ? "border-primary bg-primary/5" : "bg-muted/15 hover:bg-muted/30"}`} role="button" tabIndex={busy ? -1 : 0} onKeyDown={event => { if ((event.key === "Enter" || event.key === " ") && !busy) { event.preventDefault(); fileInput.current?.click(); } }}>
                {file ? <><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><FileText className="h-5 w-5" /></span><b className="max-w-full break-all text-xs">{file.name}</b><span className="text-[10px] text-muted-foreground">{fileSize(file.size)}</span></> : <><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><UploadCloud className="h-5 w-5" /></span><span className="text-sm">{wx.uploadDrop} <u className="text-primary">{wx.uploadChoose}</u></span><span className="text-xs text-muted-foreground">{wx.uploadRules}</span></>}
              </div>
              <Input ref={fileInput} id="agreement-upload" type="file" className="sr-only" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png" disabled={busy} onChange={event => receiveFile(event.target.files?.[0])} />
              <p className="mt-1 text-xs text-muted-foreground">{tx.fileRules}</p>
            </div>
            {formError && <div role="alert" className="sm:col-span-2 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{formError}</div>}
          </div>
          <DialogFooter className="border-t bg-muted/15 px-5 py-3">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setFormOpen(false)}>{wx.cancel}</Button>
            <Button type="submit" disabled={busy || !file || !title.trim() || (!unlimited && !validTo) || (formMode === "version" && !changeReason.trim())}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{formMode === "version" ? wx.saveVersion : wx.saveNew}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={!!confirmTarget} onOpenChange={open => { if (!busy && !open) { setConfirmTarget(null); setConfirmReason(""); setFormError(""); } }}>
      <DialogContent hideCloseButton overlayClassName="z-[10050]" className="z-[10051] max-w-lg">
        <DialogHeader className="relative pr-8"><DialogClose asChild><Button type="button" variant="ghost" size="icon" className="absolute -right-2 -top-2" aria-label={wx.close} onClick={() => { setConfirmTarget(null); setConfirmReason(""); setFormError(""); }}><X className="h-4 w-4" /></Button></DialogClose><DialogTitle className="flex items-center gap-2 text-base text-destructive"><AlertTriangle className="h-5 w-5" />{confirmTarget?.kind === "file" ? (confirmTarget.row.fileDeletedAt ? wx.purgeRetry : wx.fileDeleteTitle) : wx.archiveTitle}</DialogTitle><DialogDescription>{confirmTarget?.kind === "file" ? wx.fileDeleteDescription : wx.archiveDescription}</DialogDescription></DialogHeader>
        {confirmTarget?.kind === "archive" && <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm"><b>{confirmTarget.row.title}</b><span className="ml-2 text-muted-foreground">{confirmTarget.row.contractNumber || "—"}</span></div>}
        {confirmTarget?.kind === "file" && <div className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm"><b>{confirmTarget.row.fileName}</b><span className="ml-2 text-muted-foreground">v{confirmTarget.row.version}</span><p className="mt-1 text-xs text-destructive">{wx.irreversible}</p></div>}
        <div><Label htmlFor="agreement-confirm-reason">{confirmTarget?.kind === "file" ? wx.fileDeleteReason : wx.archiveReason} *</Label><Textarea id="agreement-confirm-reason" value={confirmReason} onChange={event => setConfirmReason(event.target.value)} maxLength={1000} required className="mt-1 min-h-20" /></div>
        {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
        <DialogFooter><Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirmTarget(null)}>{wx.cancel}</Button><Button type="button" variant="destructive" disabled={busy || !confirmReason.trim()} onClick={() => void commitConfirm()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{confirmTarget?.kind === "file" ? wx.fileDeleteConfirm : wx.archiveConfirm}</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={!!previewTarget} onOpenChange={open => { if (!open) { previewRequest.current?.abort(); setPreviewTarget(null); setPreviewScale(1); } }}>
      <DialogContent hideCloseButton className="z-[10051] flex h-[min(91dvh,870px)] w-[min(1060px,calc(100vw-20px))] max-w-none flex-col gap-0 overflow-hidden p-0" overlayClassName="z-[10050]">
        <DialogHeader className="flex shrink-0 flex-row items-center gap-3 border-b bg-background px-4 py-3 pr-12">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border bg-primary/5 text-primary"><FileText className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><DialogTitle className="truncate text-sm">{wx.previewTitle}</DialogTitle><DialogDescription className="truncate text-xs">{previewTarget?.fileName} · v{previewTarget?.version} · {previewTarget ? fileSize(previewTarget.fileSize) : ""}</DialogDescription></div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" aria-label={wx.zoomOut} disabled={previewScale <= 0.6} onClick={() => setPreviewScale(scale => Math.max(0.6, scale - 0.1))}><ZoomOut className="h-4 w-4" /></Button><span className="w-10 text-center text-xs tabular-nums">{Math.round(previewScale * 100)}%</span><Button type="button" variant="ghost" size="icon" aria-label={wx.zoomIn} disabled={previewScale >= 1.8} onClick={() => setPreviewScale(scale => Math.min(1.8, scale + 0.1))}><ZoomIn className="h-4 w-4" /></Button>
            {previewTarget && <a className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs hover:bg-muted" href={downloadHref(previewTarget)} download><Download className="h-3.5 w-3.5" />{tx.download}</a>}
            <DialogClose asChild><Button type="button" variant="ghost" size="icon" aria-label={wx.close}><X className="h-4 w-4" /></Button></DialogClose>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto bg-muted/50 p-4 sm:p-6" aria-live="polite">
          {previewLoading && <div className="flex h-full min-h-40 items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />{wx.loadingPreview}</div>}
          {previewError && <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center"><AlertTriangle className="h-8 w-8 text-destructive" /><b>{wx.previewFailed}</b><p className="text-sm text-muted-foreground">{wx.unsupportedPreview} {wx.downloadFallback}</p><div className="mt-2 flex gap-2"><Button type="button" variant="outline" onClick={() => setPreviewAttempt(attempt => attempt + 1)}>{wx.previewRetry}</Button>{previewTarget && <a className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm" href={downloadHref(previewTarget)} download><Download className="h-4 w-4" />{tx.download}</a>}</div></div>}
          {!previewLoading && !previewError && previewUrl && previewType.startsWith("image/") && <div className="flex min-h-full min-w-full items-start justify-center"><img src={previewUrl} alt={previewTarget?.fileName || wx.previewTitle} className="max-h-full max-w-full origin-top object-contain shadow-md" style={{ transform: `scale(${previewScale})` }} /></div>}
          {!previewLoading && !previewError && previewUrl && (previewType === "application/pdf" || previewType.endsWith("+pdf")) && <iframe title={`${wx.previewTitle}: ${previewTarget?.fileName || ""}`} src={`${previewUrl}#zoom=${Math.round(previewScale * 100)}`} className="mx-auto h-full min-h-[300px] w-full max-w-[900px] border-0 bg-background shadow-md" />}
          {!previewLoading && !previewError && previewUrl && !previewType.startsWith("image/") && previewType !== "application/pdf" && !previewType.endsWith("+pdf") && <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center"><AlertTriangle className="h-8 w-8 text-amber-600" /><b>{wx.unsupportedPreview}</b><p className="text-sm text-muted-foreground">{wx.downloadFallback}</p>{previewTarget && <a className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm" href={downloadHref(previewTarget)} download><Download className="h-4 w-4" />{tx.download}</a>}</div>}
        </div>
      </DialogContent>
    </Dialog>
  </section>;
}

export default ClinicAgreementsPanel;
