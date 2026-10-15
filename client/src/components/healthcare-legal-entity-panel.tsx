import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Building2, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import type { Facility, FacilityType, FacilityLink, NormalizedCompany, VerificationPreview } from "@shared/healthcare-legal-entity";
import { RegistryCompanySiteComparison } from "@/components/healthcare-legal-entities/RegistryCompanySiteComparison";
import type { HealthcareLegalEntityCopy } from "@/i18n/healthcare-legal-entity-translations";
import { useI18n } from "@/i18n";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const api = "/api/healthcare-legal-entities";
type Props = { facilityType: FacilityType; facilityId: string; ico: string; siteName?: string; address?: string; city?: string; postalCode?: string };
export function HealthcareLegalEntityPanel({ facilityType, facilityId, ico, siteName, address, city, postalCode }: Props) {
  const c = useI18n().t.healthcareLegalEntity as HealthcareLegalEntityCopy;
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<VerificationPreview | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [replace, setReplace] = useState(false);
  const [error, setError] = useState("");
  const [savedEntityId, setSavedEntityId] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useQuery<{ facility: Facility; registryCompany?: NormalizedCompany | null; links: FacilityLink[]; canManage: boolean }>({
    queryKey: [api, "facilities", facilityType, facilityId],
    queryFn: async () => {
      const response = await fetch(`${api}/facilities/${facilityType}/${facilityId}`, { credentials: "include" });
      if (!response.ok) throw new Error("request_failed");
      return response.json();
    },
    enabled: !!facilityId,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const verify = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${api}/verify`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ico, facilityType, facilityId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(body.error || "request_failed"), { code: body.error });
      return body as VerificationPreview;
    },
    onSuccess: (value) => { setPreview(value); setError(""); setConfirm(false); setReplace(false); },
    onError: (e: any) => setError(e.code || "request_failed"),
  });
  const save = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${api}/save`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ verificationId: preview!.verificationId, facilityType, facilityId, confirmOperator: true, ...(replace ? { replaceExisting: true } : {}) }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(body.error || "request_failed"), { code: body.error });
      return body;
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [api, "facilities", facilityType, facilityId] }),
        queryClient.invalidateQueries({ queryKey: [api] }),
        queryClient.invalidateQueries({ queryKey: ["/api/clinics"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/hospitals"] }),
      ]);
       setOpen(false); setPreview(null);
       if (result.entityId) setSavedEntityId(result.entityId);
       await Promise.all([
         refetch(),
         queryClient.invalidateQueries({ queryKey: ["/api/healthcare-legal-entities/persons"] }),
       ]);
    },
    onError: (e: any) => setError(e.code || "request_failed"),
  });
  return <>
    <section className="rounded-xl border border-primary/20 bg-primary/[0.025] p-4" data-testid={`healthcare-legal-entity-panel-${facilityType}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-4 w-4" /></span><div><h3 className="font-semibold">{c.title}</h3><p className="mt-1 max-w-xl text-xs text-muted-foreground">{c.subtitle}</p></div></div>
        <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => { setOpen(true); setError(""); setSavedEntityId(null); }} disabled={!data?.canManage || !ico}><RefreshCw className="mr-2 h-3.5 w-3.5" />{c.verify}</Button><Button type="button" size="sm" variant="ghost" onClick={() => setLocation("/healthcare-legal-entities")}><ExternalLink className="mr-2 h-3.5 w-3.5" />{c.title}</Button></div>
      </div>
      <div className="mt-4 border-t pt-3">
        {isLoading ? <div className="h-8 animate-pulse rounded bg-muted" /> : isError ? <div className="flex items-center justify-between gap-3 text-sm text-destructive"><span>{c.siteLoadError}</span><Button type="button" size="sm" variant="outline" onClick={() => refetch()}>{c.retry}</Button></div> : data?.links?.length ? <div className="space-y-2">{data.links.map((link) => <div key={link.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="flex min-w-0 items-center gap-2"><Building2 className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{(link as FacilityLink & { legalEntityName?: string }).legalEntityName || "—"}</span></span><div className="flex items-center gap-2"><Badge variant={link.validTo ? "outline" : "secondary"}>{link.validTo ? c.ended : c.relationship}</Badge><Button type="button" size="sm" variant="ghost" onClick={() => setLocation(`/healthcare-legal-entities?id=${link.legalEntityId}`)}>{c.openEntity}</Button></div></div>)}</div> : <div className="text-sm text-muted-foreground">{c.noFacilities}</div>}
        {(siteName || ico) && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"><span>{siteName}</span><span>{ico}</span><span>{address}</span><span>{city}</span><span>{postalCode}</span></div>}
        {data?.facility && <div className="mt-4"><RegistryCompanySiteComparison site={data.facility} registryCompany={data.registryCompany} c={c} /></div>}
      </div>
    </section>
    {savedEntityId && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm"><span>{c.saved}</span><Button type="button" size="sm" variant="outline" onClick={() => setLocation(`/healthcare-legal-entities?id=${savedEntityId}`)}>{c.openEntity}</Button></div>}
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setPreview(null); }}>
      <DialogContent overlayClassName="z-[9995]" className="z-[9997] w-[calc(100%-2rem)] max-h-[min(90dvh,850px)] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{c.verifyTitle}</DialogTitle></DialogHeader>
        {!preview ? <div className="space-y-4"><p className="text-sm text-muted-foreground">{c.recordSource}</p><div><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.ico}</div><Input value={ico} readOnly inputMode="numeric" /></div>{error && <p role="alert" className="rounded bg-destructive/10 p-3 text-sm text-destructive">{error === "operator_conflict" ? c.conflict : error === "forbidden" ? c.forbidden : c.errors}</p>}<Button type="button" disabled={!ico.trim() || verify.isPending} onClick={() => verify.mutate()}>{verify.isPending ? c.loading : c.verify}</Button></div> :
          <div className="space-y-4">
            <div className="rounded-xl bg-primary/[0.05] p-4"><div className="font-semibold">{preview.company.name}</div><div className="mt-1 font-mono text-sm">{preview.company.ico}</div><div className="mt-2 text-sm text-muted-foreground">{preview.company.registeredAddress || "—"} · {preview.company.city || "—"} · {preview.company.postalCode || "—"}</div><div className="mt-2 text-xs text-muted-foreground">{c.expires}: {new Date(preview.expiresAt).toLocaleString()}</div></div>
            <RegistryCompanySiteComparison site={data?.facility} registryCompany={preview.company} c={c} loading={isLoading && !data?.facility} />
            <label className="flex cursor-pointer items-start gap-2 text-sm"><Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(!!v)} /><span>{c.confirmOperator}</span></label>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-destructive"><Checkbox checked={replace} onCheckedChange={(v) => setReplace(!!v)} /><span>{c.replaceOperator}</span></label>
            {isError && <div className="flex items-center justify-between gap-2 text-sm text-destructive"><span>{c.siteLoadError}</span><Button type="button" size="sm" variant="outline" onClick={() => refetch()}>{c.retry}</Button></div>}
            {error && <p role="alert" className="rounded bg-destructive/10 p-3 text-sm text-destructive">{error === "operator_conflict" ? c.conflict : c.errors}</p>}
            <Button type="button" className="w-full" disabled={!confirm || save.isPending} onClick={() => save.mutate()}>{save.isPending ? c.loading : c.saveLink}</Button>
          </div>}
      </DialogContent>
    </Dialog>
  </>;
}
