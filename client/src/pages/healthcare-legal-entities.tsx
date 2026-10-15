import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Activity, Building2, Clock3, Download, FileJson2, History, Plus, RefreshCw, ShieldCheck, Stethoscope, UserRound } from "lucide-react";
import type { Facility, FacilityLink, FacilityType, LegalEntityDetail, LegalEntitySummary, RegistryPerson, SnapshotSummary, VerificationPreview } from "@shared/healthcare-legal-entity";
import type { HealthcareLegalEntityCopy } from "@/i18n/healthcare-legal-entity-translations";
import { useI18n } from "@/i18n";
import { usePermissions } from "@/contexts/permissions-context";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LegalEntityTable } from "@/components/healthcare-legal-entities/LegalEntityTable";
import { LegalEntityCompanyForm } from "@/components/healthcare-legal-entities/LegalEntityCompanyForm";
import { cn } from "@/lib/utils";

const base = "/api/healthcare-legal-entities";
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, { credentials: "include", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload?.error || "request_failed"), { code: payload?.error || "request_failed", status: response.status });
  return payload as T;
}
function dateLabel(value?: string | null) { return value ? new Date(value).toLocaleString() : "—"; }
function siteLabel(type: FacilityType, c: HealthcareLegalEntityCopy) { return type === "clinic" ? c.clinic : c.hospital; }

export default function HealthcareLegalEntitiesPage() {
  const { t, locale } = useI18n();
  const c = t.healthcareLegalEntity as HealthcareLegalEntityCopy;
  const { canAccessModule, canAdd, canEdit } = usePermissions();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const selectedId = new URLSearchParams(searchString).get("id");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [ico, setIco] = useState("");
  const [preview, setPreview] = useState<VerificationPreview | null>(null);
  const [errorCode, setErrorCode] = useState("");
  const list = useQuery<{ items: LegalEntitySummary[]; canManage: boolean }>({
    queryKey: [base],
    queryFn: () => request("/"),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const detail = useQuery<LegalEntityDetail>({
    queryKey: [base, selectedId],
    queryFn: () => request(`/${selectedId}`),
    enabled: !!selectedId,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const createVerify = useMutation({
    mutationFn: (value: string) => request<VerificationPreview>("/verify", { method: "POST", body: JSON.stringify({ ico: value }) }),
    onSuccess: (data) => { setPreview(data); setErrorCode(""); },
    onError: (error: any) => setErrorCode(error.code || "request_failed"),
  });
  const savePreview = useMutation({
    mutationFn: (data: any) => request<{ entityId: string; linkId: string }>("/save", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: [base] });
      setVerifyOpen(false); setPreview(null); setIco("");
      setLocation(`/healthcare-legal-entities?id=${result.entityId}`);
    },
    onError: (error: any) => setErrorCode(error.code || "request_failed"),
  });
  const allowed = canAccessModule("healthcare_legal_entities");
  const canManage = canAdd("healthcare_legal_entities") || canEdit("healthcare_legal_entities");
  const canEditEntity = canEdit("healthcare_legal_entities");
  const canCreate = !!list.data?.canManage && canAccessModule("healthcare_legal_entities") && canAdd("healthcare_legal_entities");
  const openEntity = (id: string) => setLocation(`/healthcare-legal-entities?id=${encodeURIComponent(id)}`);
  const closeEntity = () => setLocation("/healthcare-legal-entities");

  if (!allowed) return <div className="p-8 text-center text-muted-foreground">{c.forbidden}</div>;
  return (
    <div className="min-h-[calc(100dvh-6rem)] text-foreground" data-testid="healthcare-legal-entities-page">
      <div className="mb-5 flex flex-col justify-between gap-4 rounded-xl border bg-card px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:px-5">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-primary"><ShieldCheck className="h-3.5 w-3.5" /> {t.nav.medicalPartnerNetwork}</div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">{c.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{c.subtitle}</p>
        </div>
        {canCreate && <Button onClick={() => { setVerifyOpen(true); setErrorCode(""); }} data-testid="button-new-legal-entity"><Plus className="mr-2 h-4 w-4" />{c.newEntity}</Button>}
      </div>
      <LegalEntityTable items={list.data?.items || []} c={c} locale={locale} loading={list.isLoading} failed={list.isError} onRetry={() => list.refetch()} onOpen={(entity) => openEntity(entity.id)} />
      <Sheet open={!!selectedId} onOpenChange={(open) => { if (!open) closeEntity(); }}>
        <SheetContent side="right" drawerWidth="wide" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          {selectedId && (detail.isLoading ? <div className="space-y-4 p-6"><Skeleton className="h-12" /><Skeleton className="h-20" /><Skeleton className="h-48" /></div>
            : detail.isError || !detail.data ? <div className="p-8"><p>{c.loadError}</p><Button className="mt-3" variant="outline" onClick={() => detail.refetch()}>{c.retry}</Button></div>
            : <EntityDetail key={selectedId} detail={detail.data} c={c} canManage={canManage} canEditEntity={canEditEntity} onClose={closeEntity} />)}
        </SheetContent>
      </Sheet>
      <VerifyDialog open={verifyOpen} onOpenChange={setVerifyOpen} c={c} ico={ico} setIco={setIco} preview={preview} setPreview={setPreview} errorCode={errorCode} onVerify={() => createVerify.mutate(ico)} verifying={createVerify.isPending} saving={savePreview.isPending} onSave={(payload: unknown) => savePreview.mutate(payload)} />
    </div>
  );
}

function EntityDetail({ detail, c, canManage, canEditEntity, onClose }: { detail: LegalEntityDetail; c: HealthcareLegalEntityCopy; canManage: boolean; canEditEntity: boolean; onClose: () => void }) {
  const entity = detail.entity;
  const mayManage = canManage && detail.canManage;
  const mayEdit = canEditEntity && detail.canManage;
  const [activeTab, setActiveTab] = useState("overview");
  const [notes, setNotes] = useState(entity.notes || "");
  const [snapshot, setSnapshot] = useState<{ snapshot: SnapshotSummary; rawData?: object; audit?: Array<Record<string, any>> } | null>(null);
  const [raw, setRaw] = useState<Record<string, unknown> | undefined>(detail.rawData);
  const [linkOpen, setLinkOpen] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);
  const [verifyPreview, setVerifyPreview] = useState<VerificationPreview | null>(null);
  const [verifySavePending, setVerifySavePending] = useState(false);
  const verifySavePendingRef = useRef(false);
  const [verifySaveError, setVerifySaveError] = useState("");
  const [pendingEnd, setPendingEnd] = useState<{ type: "facility" | "person"; id: string } | null>(null);
  const [statusError, setStatusError] = useState("");
  const [downloadPending, setDownloadPending] = useState(false);
  const [companySaveVersion, setCompanySaveVersion] = useState(0);
  const notesInitializedForId = useRef<string | null>(null);
  const invalidateRelated = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: [base] }),
    queryClient.invalidateQueries({ queryKey: ["/api/clinics"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/hospitals"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/collaborators"] }),
    queryClient.invalidateQueries({ queryKey: [`${base}/persons`] }),
  ]);
  const notesMutation = useMutation({ mutationFn: (payload: { details?: Record<string, string | null>; notes?: string }) => request(`/${entity.id}`, { method: "PATCH", body: JSON.stringify(payload) }), onSuccess: async () => { setCompanySaveVersion((v) => v + 1); await queryClient.invalidateQueries({ queryKey: [base, entity.id] }); await invalidateRelated(); }, onError: (e: any) => setStatusError(e.code || "request_failed") });
  const verifyMutation = useMutation({ mutationFn: () => request<VerificationPreview>(`/${entity.id}/verify`, { method: "POST" }), onSuccess: setVerifyPreview, onError: (e: any) => setStatusError(e.code || "request_failed") });
  const endFacility = useMutation({ mutationFn: (linkId: string) => request(`/${entity.id}/facilities/${linkId}/end`, { method: "POST" }), onSuccess: async () => { setPendingEnd(null); setStatusError(""); await invalidateRelated(); }, onError: (e: any) => setStatusError(e.code || "request_failed") });
  const endPerson = useMutation({ mutationFn: (linkId: string) => request(`/${entity.id}/person-links/${linkId}/end`, { method: "POST" }), onSuccess: async () => { setPendingEnd(null); setStatusError(""); await invalidateRelated(); }, onError: (e: any) => setStatusError(e.code || "request_failed") });
  useEffect(() => {
    if (notesInitializedForId.current !== entity.id) {
      notesInitializedForId.current = entity.id;
      setNotes(entity.notes || "");
    }
    setRaw(detail.rawData);
  }, [entity.id, entity.notes, detail.rawData]);
  const tabs = [["overview", c.overview], ["facilities", c.facilities], ["people", c.people], ["history", c.history]] as const;
  const reload = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: [base, entity.id] }),
    queryClient.invalidateQueries({ queryKey: [base] }),
  ]);
  const saveReverification = async (payload: any) => {
    if (verifySavePendingRef.current) return;
    verifySavePendingRef.current = true;
    setVerifySavePending(true);
    setVerifySaveError("");
    try {
      await request("/save", { method: "POST", body: JSON.stringify(payload) });
      setVerifyPreview(null);
      await reload();
      await invalidateRelated();
    } catch (error: any) {
      setVerifySaveError(error?.code || "request_failed");
    } finally {
      verifySavePendingRef.current = false;
      setVerifySavePending(false);
    }
  };
  const eligibleRegistryPeople = detail.registryPeople.filter((person) => (person as RegistryPerson & { isNaturalPerson?: boolean }).isNaturalPerson !== false);
  const downloadExport = async () => {
    if (!detail.canViewSensitive || downloadPending) return;
    setDownloadPending(true); setStatusError("");
    try {
      const response = await fetch(`${base}/${entity.id}/export`, { credentials: "include" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw Object.assign(new Error(body?.error || "request_failed"), { code: body?.error || (response.status === 403 ? "forbidden" : "request_failed") });
      }
      const blob = await response.blob();
      if (!blob.size) throw Object.assign(new Error("request_failed"), { code: "request_failed" });
      const disposition = response.headers.get("Content-Disposition") || "";
      const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
      const filename = (encoded ? decodeURIComponent(encoded) : plain) || `legal-entity-${entity.ico}.json`;
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error: any) {
      setStatusError(error?.code || "request_failed");
    } finally { setDownloadPending(false); }
  };
  const rawObject = raw as Record<string, any> | undefined;
  const sourceDocuments: Array<Record<string, unknown>> = Array.isArray(rawObject?.documents)
    ? rawObject.documents
    : Array.isArray(rawObject?.data?.documents) ? rawObject.data.documents : [];
  return <div className="flex min-h-0 flex-1 flex-col" data-testid="legal-entity-detail">
    <SheetHeader className="shrink-0 border-b px-5 py-4 pr-14 sm:px-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><div className="mb-1 flex items-center gap-2"><Badge variant="outline">{entity.countryCode}</Badge><Badge variant={entity.status === "active" ? "secondary" : "outline"}>{entity.status === "active" ? c.active : c.terminated}</Badge><span className="font-mono text-xs text-muted-foreground">{entity.ico}</span></div><SheetTitle className="truncate text-xl">{entity.name}</SheetTitle><SheetDescription>{[entity.registeredAddress, entity.city, entity.postalCode].filter(Boolean).join(", ") || c.recordSource}</SheetDescription></div>
        <div className="flex flex-wrap gap-2">
          {mayManage && <Button variant="outline" size="sm" onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending}><RefreshCw className={cn("mr-2 h-4 w-4", verifyMutation.isPending && "animate-spin")} />{c.fetchCompleteData}</Button>}
          {detail.canViewSensitive && <Button variant="outline" size="sm" onClick={downloadExport} disabled={downloadPending} data-testid="button-download-legal-entity"><Download className="mr-2 h-4 w-4" />{downloadPending ? c.downloading : c.downloadSourceData}</Button>}
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-legal-entity">{c.close}</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-5">
        <Metric icon={Building2} label={c.facilities} value={String(detail.facilities.length)} />
        <Metric icon={UserRound} label={c.people} value={String(detail.registryPeople.length)} />
        <Metric icon={Clock3} label={c.checkedAt} value={dateLabel(entity.checkedAt)} />
        <Metric icon={Activity} label={c.sourceUpdatedAt} value={entity.sourceUpdatedAt ? dateLabel(entity.sourceUpdatedAt) : "—"} />
        <Metric icon={ShieldCheck} label={c.providerSource} value={c.recordSource} />
      </div>
    </SheetHeader>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 sm:px-7">
    <div className="sticky top-0 z-10 -mx-4 flex gap-1 overflow-x-auto border-b bg-background/95 px-4 backdrop-blur sm:-mx-7 sm:px-7">
      {tabs.map(([id, label]) => <button type="button" key={id} data-testid={`legal-entity-tab-${id}`} aria-current={activeTab === id ? "page" : undefined} onClick={() => setActiveTab(id)} className={cn("whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors", activeTab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{label}</button>)}
    </div>
    {statusError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{statusError === "operator_conflict" ? c.conflict : statusError === "forbidden" ? c.forbidden : c.errors}</p>}
    <div className={cn("mx-auto w-full max-w-3xl space-y-4 py-4", activeTab !== "overview" && "hidden")} aria-hidden={activeTab !== "overview"}>
      <LegalEntityCompanyForm entity={entity as any} c={c} canEdit={mayEdit} pending={notesMutation.isPending} saveVersion={companySaveVersion} notes={notes} setNotes={setNotes} onSave={(payload) => notesMutation.mutate(payload)} />
      <details className="group rounded-xl border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4"><span className="flex items-center gap-2 font-medium"><FileJson2 className="h-4 w-4 text-primary" />{c.rawData}</span><span className="text-xs text-muted-foreground">{detail.canViewSensitive ? c.expandTechnicalData : c.sensitiveDenied}</span></summary>
        {detail.canViewSensitive && raw && <div className="space-y-4 border-t p-4">
          <div className="rounded-lg bg-primary/[0.045] p-3"><p className="text-sm font-medium text-foreground">{c.completeDataSaved}</p><p className="mt-1 text-xs text-muted-foreground">{c.checkedAt}: {dateLabel(entity.checkedAt)}{entity.sourceUpdatedAt ? ` · ${c.sourceUpdatedAt}: ${dateLabel(entity.sourceUpdatedAt)}` : ""}</p></div>
          <section className="space-y-2"><h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.sourceDocuments}</h4>{sourceDocuments.length ? <div className="grid gap-2 sm:grid-cols-2">{sourceDocuments.map((document, index) => <div key={String(document.id || document.number || index)} className="rounded-lg border p-3"><p className="break-words text-sm font-medium">{String(document.title || document.name || document.documentType || c.sourceDocuments)}</p><p className="mt-1 break-words text-xs text-muted-foreground">{[document.number, document.type, document.date || document.createdAt, document.url || document.fileName].filter(Boolean).map(String).join(" · ") || c.documentMetadataUnavailable}</p></div>)}</div> : <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">{c.documentMetadataUnavailable}</p>}</section>
          <pre className="max-h-80 overflow-auto rounded-lg bg-muted/70 p-3 text-xs leading-relaxed">{JSON.stringify(raw, null, 2)}</pre>
        </div>}
      </details>
    </div>
    {activeTab === "facilities" && <Card><CardContent className="p-5"><div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">{c.facilities}</h3>{mayManage && <Button size="sm" onClick={() => setLinkOpen(true)}><Plus className="mr-2 h-4 w-4" />{c.addFacility}</Button>}</div>{detail.facilities.length ? <div className="divide-y">{detail.facilities.map((link) => <FacilityRow key={link.id} link={link} c={c} canManage={mayManage} onEnd={() => setPendingEnd({ type: "facility", id: link.id })} ending={endFacility.isPending} />)}</div> : <EmptyInline icon={Stethoscope} text={c.noFacilities} />}</CardContent></Card>}
    {activeTab === "people" && <div className="space-y-4">
      <Card><CardContent className="p-5"><div className="mb-2 flex items-center justify-between gap-3"><h3 className="font-semibold">{c.people}</h3>{mayManage && <Button size="sm" variant="outline" onClick={() => setPersonOpen(true)}><Plus className="mr-2 h-4 w-4" />{c.addPerson}</Button>}</div><p className="mb-4 text-xs text-muted-foreground">{c.registryNote}</p>{detail.registryPeople.length ? <div className="grid gap-2 md:grid-cols-2">{detail.registryPeople.map((person: RegistryPerson) => <div key={person.key} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-2"><div className="font-medium">{person.name}</div><Badge variant={person.current ? "secondary" : "outline"}>{person.current ? c.current : c.ended}</Badge></div><div className="mt-1 text-sm text-muted-foreground">{person.role}</div><div className="mt-2 font-mono text-[11px] text-muted-foreground">{dateLabel(person.validFrom)} — {dateLabel(person.validTo)}</div></div>)}</div> : <EmptyInline icon={UserRound} text={c.noRegistryPeople} />}</CardContent></Card>
      <Card><CardContent className="p-5"><h3 className="mb-4 font-semibold">{c.addPerson}</h3>{detail.personLinks.length ? <div className="divide-y">{detail.personLinks.map((link) => <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><div className="font-medium">{link.personName}</div><div className="text-sm text-muted-foreground">{link.role}</div></div><div className="flex items-center gap-2"><Badge variant={link.validTo ? "outline" : "secondary"}>{link.validTo ? c.ended : c.current}</Badge>{mayManage && !link.validTo && <Button variant="ghost" size="sm" onClick={() => setPendingEnd({ type: "person", id: link.id })}>{c.endPersonLink}</Button>}</div></div>)}</div> : <EmptyInline icon={UserRound} text={c.noPeople} />}</CardContent></Card>
      <Card><CardContent className="p-5"><h3 className="mb-1 font-semibold">{c.indirectPeople}</h3><p className="mb-3 text-xs text-muted-foreground">{c.registryNote}</p>{detail.people.length ? <div className="divide-y">{detail.people.map((person, i) => <div key={`${person.personId}-${person.facilityId}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><div className="font-medium">{person.personName}</div><div className="text-sm text-muted-foreground">{person.facilityName} · {siteLabel(person.facilityType, c)}</div></div><Badge variant="outline">{person.role || "—"}</Badge></div>)}</div> : <EmptyInline icon={UserRound} text={c.noIndirectPeople} />}</CardContent></Card>
    </div>}
    {activeTab === "history" && <Card><CardContent className="p-5"><h3 className="mb-4 flex items-center gap-2 font-semibold"><History className="h-4 w-4 text-primary" />{c.history}</h3>{detail.history.length ? <div className="relative space-y-3 before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-px before:bg-border">{detail.history.map((item) => <div key={item.id} className="relative flex flex-wrap items-center justify-between gap-3 pl-8"><span className="absolute left-1.5 top-2 h-3 w-3 rounded-full border-2 border-primary bg-background" /><div><div className="font-medium">{dateLabel(item.checkedAt)}</div><div className="text-xs text-muted-foreground">{item.createdByName || c.recordSource}</div></div><Button size="sm" variant="outline" onClick={async () => { try { const res = await request<{ snapshot: SnapshotSummary; rawData?: object; audit?: Array<Record<string, any>> }>(`/${entity.id}/snapshots/${item.id}`); setSnapshot(res); setStatusError(""); } catch { setStatusError("request_failed"); } }}>{c.snapshot}</Button></div>)}</div> : <EmptyInline icon={History} text={c.empty} />}</CardContent></Card>}
    {linkOpen && mayManage && <FacilityLinkDialog entityId={entity.id} c={c} onClose={() => setLinkOpen(false)} onSaved={reload} />}
    {personOpen && mayManage && <PersonLinkDialog entityId={entity.id} registryPeople={eligibleRegistryPeople} c={c} onClose={() => setPersonOpen(false)} onSaved={reload} />}
    <Dialog open={!!snapshot} onOpenChange={(open) => { if (!open) setSnapshot(null); }}><DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{c.snapshot} · {dateLabel(snapshot?.snapshot.checkedAt)}</DialogTitle></DialogHeader><div className="space-y-4">{snapshot?.audit?.length ? <section className="space-y-2"><h3 className="text-sm font-semibold">{c.auditEvent}</h3>{snapshot.audit.map((event, index) => { const change = event.details ?? event.description ?? event.note ?? event.changes ?? event.metadata ?? event.beforeAfter ?? event.before ?? event.after; const kind = event.kind || event.action || event.type; const eventLabel = kind === "entity_details_updated" ? c.entityDetailsUpdated : event.summary || event.label || event.actionLabel || c.auditEvent; return <div key={`${event.id || event.createdAt || index}`} className="rounded-lg border p-3"><div className="flex flex-wrap justify-between gap-2 text-sm font-medium"><span>{eventLabel}</span><span className="text-xs text-muted-foreground">{dateLabel(event.createdAt || event.occurredAt || event.at)}</span></div>{change != null && <div className="mt-2"><div className="mb-1 text-xs font-semibold text-muted-foreground">{c.auditDetails}</div><pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs">{typeof change === "string" ? change : JSON.stringify(change, null, 2)}</pre></div>}</div>; })}</section> : null}{detail.canViewSensitive && snapshot?.rawData && <section><h3 className="mb-2 text-sm font-semibold">{c.rawData}</h3><pre className="max-h-[55dvh] overflow-auto rounded-lg bg-muted p-4 text-xs">{JSON.stringify(snapshot.rawData, null, 2)}</pre></section>}{!snapshot?.audit?.length && !(detail.canViewSensitive && snapshot?.rawData) && <pre className="max-h-[65dvh] overflow-auto rounded-lg bg-muted p-4 text-xs">{JSON.stringify(snapshot?.snapshot, null, 2)}</pre>}</div></DialogContent></Dialog>
      <Dialog open={!!verifyPreview} onOpenChange={(open) => { if (!open) { setVerifyPreview(null); setVerifySaveError(""); } }}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{c.verifyTitle}</DialogTitle></DialogHeader>{verifyPreview && <PreviewBody preview={verifyPreview} c={c} onSave={saveReverification} saving={verifySavePending} errorCode={verifySaveError} />}</DialogContent></Dialog>
    <AlertDialog open={!!pendingEnd} onOpenChange={(open) => { if (!open) setPendingEnd(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{c.confirmEnd}</AlertDialogTitle><AlertDialogDescription>{c.confirmEndDescription}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{c.cancel}</AlertDialogCancel><AlertDialogAction disabled={endFacility.isPending || endPerson.isPending} onClick={(event) => { event.preventDefault(); if (!pendingEnd) return; if (pendingEnd.type === "facility") endFacility.mutate(pendingEnd.id); else endPerson.mutate(pendingEnd.id); }}>{c.confirm}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  </div>;
}

function VerifyDialog({ open, onOpenChange, c, ico, setIco, preview, setPreview, errorCode, onVerify, verifying, saving, onSave }: any) {
  return <Dialog open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) setPreview(null); }}><DialogContent className="w-[calc(100%-2rem)] max-h-[min(92dvh,850px)] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle className="text-2xl">{preview ? c.verifyTitle : c.newEntity}</DialogTitle></DialogHeader>{!preview ? <div className="space-y-4"><p className="text-sm text-muted-foreground">{c.recordSource}</p><div><LabelText label={c.ico} /><Input className="mt-2 font-mono" inputMode="numeric" autoFocus value={ico} onChange={(e) => setIco(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onVerify(); }} data-testid="input-verify-ico" /></div>{errorCode && <ErrorLine code={errorCode} c={c} />}<div className="flex justify-end"><Button onClick={onVerify} disabled={verifying || !ico.trim()} data-testid="button-verify-ico">{verifying ? c.loading : c.verify}</Button></div></div> : <PreviewBody preview={preview} c={c} onSave={onSave} saving={saving} errorCode={errorCode} onBack={() => setPreview(null)} />}</DialogContent></Dialog>;
}
function PreviewBody({ preview, c, onSave, saving, errorCode, onBack }: any) {
  const [confirmOperator, setConfirmOperator] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [facilityType, setFacilityType] = useState<FacilityType>(preview.facility?.type || "clinic");
  const [facilityId, setFacilityId] = useState(preview.facility?.id || "");
  const [apply, setApply] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [option, setOption] = useState<Facility | null>(preview.facility || null);
  const options = useQuery<{ items: Array<{ id: string; type: FacilityType; name: string; ico: string | null; countryCode: string | null }> }>({
    queryKey: [base, "facility-options", search],
    queryFn: () => request(`/facility-options?search=${encodeURIComponent(search)}`),
    enabled: !!search && !preview.facility,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const facilityQuery = useQuery<{ facility: Facility; links: FacilityLink[]; canManage: boolean }>({
    queryKey: [base, "facilities", facilityType, facilityId],
    queryFn: () => request(`/facilities/${facilityType}/${facilityId}`),
    enabled: !!facilityId,
    staleTime: 0,
    refetchOnMount: "always",
  });
  useEffect(() => { if (preview.facility) { setOption(preview.facility); setFacilityId(preview.facility.id); setFacilityType(preview.facility.type); } }, [preview.verificationId, preview.facility]);
  const fields = [["name", c.companyName, preview.company.name], ["address", c.address, preview.company.registeredAddress], ["city", c.city, preview.company.city], ["postalCode", c.postalCode, preview.company.postalCode], ["ico", c.ico, preview.company.ico]] as const;
  const currentValues: Record<string, string | null | undefined> = {
    name: facilityQuery.data?.facility.name,
    address: facilityQuery.data?.facility.address,
    city: facilityQuery.data?.facility.city,
    postalCode: facilityQuery.data?.facility.postalCode,
    ico: facilityQuery.data?.facility.ico,
  };
  const boundFacility = !!preview.facility;
  return <div className="space-y-4">
    <div className="rounded-xl bg-primary/[0.045] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{preview.company.name}</h3><p className="mt-1 font-mono text-sm">{preview.company.ico}</p></div><Badge variant={preview.company.status === "active" ? "secondary" : "outline"}>{preview.company.status === "active" ? c.active : c.terminated}</Badge></div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{fields.slice(1).map(([key, label, value]) => <div key={key}><span className="text-muted-foreground">{label}: </span>{value || "—"}</div>)}<div>{c.legalForm}: {preview.company.legalForm || "—"}</div></div><div className="mt-3 text-xs text-muted-foreground">{c.expires}: {dateLabel(preview.expiresAt)}</div></div>
    {errorCode && <ErrorLine code={errorCode} c={c} />}
    <div className="space-y-2"><LabelText label={c.addFacility} /><div className="grid gap-2 sm:grid-cols-[150px_1fr]"><Select value={facilityType} disabled={boundFacility} onValueChange={(v) => { setFacilityType(v as FacilityType); setFacilityId(""); setOption(null); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="clinic">{c.clinic}</SelectItem><SelectItem value="hospital">{c.hospital}</SelectItem></SelectContent></Select><div className="relative"><Input placeholder={c.facilitySearch} value={option?.name || search} disabled={boundFacility} onChange={(e) => { setOption(null); setFacilityId(""); setSearch(e.target.value); }} />{options.data?.items?.length && !boundFacility ? <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border bg-popover shadow-lg">{options.data.items.filter((item) => item.type === facilityType).map((item) => <button type="button" key={item.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => { setOption(item as Facility); setFacilityId(item.id); setSearch(""); }}>{item.name} <span className="text-xs text-muted-foreground">{item.ico || ""}</span></button>)}</div> : null}</div></div>{options.isError && <p role="alert" className="text-sm text-destructive">{c.loadError}</p>}</div>
    {facilityId && <div className="space-y-3 rounded-lg border p-3"><label className="flex cursor-pointer items-start gap-2 text-sm"><Checkbox checked={confirmOperator} onCheckedChange={(value) => setConfirmOperator(!!value)} /><span>{c.confirmOperator}</span></label><div className="grid grid-cols-[minmax(80px,.6fr)_1fr_1fr] gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><span>{c.applySelected}</span><span>{c.existingValue}</span><span>{c.verifiedValue}</span></div>{fields.map(([key, label, value]) => { const current = currentValues[key]; return <label key={key} className="grid cursor-pointer grid-cols-[minmax(80px,.6fr)_1fr_1fr] items-center gap-2 border-t py-2 text-xs"><span className="flex items-center gap-2"><Checkbox checked={apply.includes(key)} disabled={!value || facilityQuery.isError} onCheckedChange={(checked) => setApply(checked ? [...apply, key] : apply.filter((item) => item !== key))} /><span>{label}</span></span><span className="break-words text-muted-foreground">{facilityQuery.isLoading ? c.loading : current || "—"}</span><span className="break-words">{value || "—"}</span></label>; })}{facilityQuery.isError && <div className="flex items-center justify-between gap-2 text-sm text-destructive"><span>{c.siteLoadError}</span><Button type="button" size="sm" variant="outline" onClick={() => facilityQuery.refetch()}>{c.retry}</Button></div>}<label className="flex cursor-pointer items-start gap-2 text-sm text-destructive"><Checkbox checked={replaceExisting} onCheckedChange={(value) => setReplaceExisting(!!value)} /><span>{c.replaceOperator}</span></label><p className="text-xs text-muted-foreground">{c.noChange}</p></div>}
    <div className="flex flex-wrap justify-between gap-2 border-t pt-4">{onBack && <Button variant="outline" onClick={onBack}>{c.cancel}</Button>}<Button className="ml-auto" disabled={saving || (!!facilityId && !confirmOperator)} onClick={() => onSave({ verificationId: preview.verificationId, ...(facilityId ? { facilityType, facilityId, confirmOperator: true, ...(replaceExisting ? { replaceExisting: true } : {}) } : {}), ...(apply.length ? { applyFields: apply } : {}) })} data-testid="button-save-verified-entity">{saving ? c.loading : facilityId ? c.saveLink : c.saveToEntity}</Button></div>
  </div>;
}
function FacilityLinkDialog({ entityId, c, onClose, onSaved }: any) {
  const [type, setType] = useState<FacilityType>("clinic"); const [search, setSearch] = useState(""); const [facilityId, setFacilityId] = useState(""); const [confirm, setConfirm] = useState(false); const [replace, setReplace] = useState(false); const [error, setError] = useState("");
  const options = useQuery<{ items: Array<{ id: string; type: FacilityType; name: string; ico: string | null }> }>({ queryKey: [base, "facility-options", search], queryFn: () => request(`/facility-options?search=${encodeURIComponent(search)}`), enabled: !!search });
  const mutation = useMutation({ mutationFn: () => request(`/${entityId}/facilities`, { method: "POST", body: JSON.stringify({ facilityType: type, facilityId, confirmOperator: true, ...(replace ? { replaceExisting: true } : {}) }) }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: [base, entityId] }); await queryClient.invalidateQueries({ queryKey: [base] }); onSaved(); onClose(); }, onError: (e: any) => setError(e.code || "request_failed") });
  return <Dialog open onOpenChange={(v) => !v && onClose()}><DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto"><DialogHeader><DialogTitle>{c.addFacility}</DialogTitle></DialogHeader><div className="space-y-4"><Select value={type} onValueChange={(v) => { setType(v as FacilityType); setFacilityId(""); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="clinic">{c.clinic}</SelectItem><SelectItem value="hospital">{c.hospital}</SelectItem></SelectContent></Select><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={c.facilitySearch} /><div className="max-h-44 overflow-auto rounded-md border">{(options.data?.items || []).filter((o) => o.type === type).map((o) => <button type="button" key={o.id} onClick={() => setFacilityId(o.id)} className={cn("block w-full px-3 py-2 text-left text-sm hover:bg-accent", facilityId === o.id && "bg-primary/10")}>{o.name} · {o.ico || "—"}</button>)}</div><label className="flex items-start gap-2 text-sm"><Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(!!v)} /><span>{c.confirmOperator}</span></label><label className="flex items-start gap-2 text-sm text-destructive"><Checkbox checked={replace} onCheckedChange={(v) => setReplace(!!v)} /><span>{c.replaceOperator}</span></label>{error && <ErrorLine code={error} c={c} />}<Button className="w-full" disabled={!facilityId || !confirm || mutation.isPending} onClick={() => mutation.mutate()}>{c.save}</Button></div></DialogContent></Dialog>;
}
function PersonLinkDialog({ entityId, registryPeople, c, onClose, onSaved }: any) {
  const [key, setKey] = useState(""); const [personId, setPersonId] = useState(""); const [create, setCreate] = useState(false); const [confirm, setConfirm] = useState(false); const [search, setSearch] = useState(""); const [error, setError] = useState("");
  const options = useQuery<{ items: Array<{ id: string; name: string }> }>({ queryKey: [base, "person-options", search], queryFn: () => request(`/person-options?search=${encodeURIComponent(search)}`), enabled: !create && !!search });
  const mutation = useMutation({ mutationFn: () => request(`/${entityId}/person-links`, { method: "POST", body: JSON.stringify({ registryPersonKey: key, ...(create ? { createPerson: true } : { personId }), confirm: true }) }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: [base, entityId] }); onSaved(); onClose(); }, onError: (e: any) => setError(e.code || "request_failed") });
  return <Dialog open onOpenChange={(v) => !v && onClose()}><DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto"><DialogHeader><DialogTitle>{c.addPerson}</DialogTitle></DialogHeader><div className="space-y-4">{registryPeople.length ? <Select value={key} onValueChange={setKey}><SelectTrigger><SelectValue placeholder={c.chooseRole} /></SelectTrigger><SelectContent>{registryPeople.map((p: RegistryPerson) => <SelectItem key={p.key} value={p.key}>{p.name} · {p.role}</SelectItem>)}</SelectContent></Select> : <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{c.noPersonEligible}</p>}<div className="flex gap-2"><Button variant={!create ? "default" : "outline"} onClick={() => setCreate(false)}>{c.existingPerson}</Button><Button variant={create ? "default" : "outline"} onClick={() => setCreate(true)}>{c.createPerson}</Button></div>{!create && <><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={c.searchPerson} /><Select value={personId} onValueChange={setPersonId}><SelectTrigger><SelectValue placeholder={c.searchPerson} /></SelectTrigger><SelectContent>{(options.data?.items || []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>{options.isError && <p role="alert" className="text-sm text-destructive">{c.loadError}</p>}</>}<label className="flex items-start gap-2 text-sm"><Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(!!v)} /><span>{c.confirmRole}</span></label>{error && <ErrorLine code={error} c={c} />}<Button className="w-full" disabled={!key || !confirm || (!create && !personId) || mutation.isPending} onClick={() => mutation.mutate()}>{c.linkPerson}</Button></div></DialogContent></Dialog>;
}
function FacilityRow({ link, c, canManage, onEnd, ending }: { link: FacilityLink; c: HealthcareLegalEntityCopy; canManage: boolean; onEnd: () => void; ending: boolean }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{link.facilityType === "clinic" ? <Stethoscope className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}</div><div className="min-w-0"><div className="truncate font-medium">{link.facilityName}</div><div className="text-xs text-muted-foreground">{siteLabel(link.facilityType, c)} · {c.relationship} · {dateLabel(link.validFrom)}{link.validTo ? ` — ${dateLabel(link.validTo)}` : ""}</div></div></div><div className="flex items-center gap-2"><Badge variant={link.validTo ? "outline" : "secondary"}>{link.validTo ? c.ended : c.current}</Badge>{canManage && !link.validTo && <Button size="sm" variant="ghost" disabled={ending} onClick={onEnd}>{c.endLink}</Button>}</div></div>;
}
function Metric({ icon: Icon, label, value }: any) { return <div className="min-w-0"><div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"><Icon className="h-3 w-3" />{label}</div><div className="mt-1 truncate text-sm font-medium">{value}</div></div>; }
function LabelText({ label }: { label: string }) { return <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>; }
function EmptyInline({ icon: Icon, text }: any) { return <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground"><Icon className="mx-auto mb-2 h-6 w-6 opacity-50" />{text}</div>; }
function ErrorLine({ code, c }: { code: string; c: HealthcareLegalEntityCopy }) { return <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{code === "operator_conflict" ? c.conflict : code === "forbidden" ? c.forbidden : c.errors}</p>; }
