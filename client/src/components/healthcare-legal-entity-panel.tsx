import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowUpRight, BadgeCheck, Building2, Check, ChevronDown, Clock3, Database, LoaderCircle, RefreshCw, Scale, ShieldCheck, Sparkles } from "lucide-react";
import type { Facility, FacilityType, FacilityLink, NormalizedCompany, VerificationPreview } from "@shared/healthcare-legal-entity";
import { RegistryCompanySiteComparison } from "@/components/healthcare-legal-entities/RegistryCompanySiteComparison";
import type { HealthcareLegalEntityCopy } from "@/i18n/healthcare-legal-entity-translations";
import { useI18n } from "@/i18n";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import "./healthcare-legal-entity.css";

const api = "/api/healthcare-legal-entities";
type Props = { facilityType: FacilityType; facilityId: string; ico: string; siteName?: string; address?: string; city?: string; postalCode?: string };
type FacilityLegalData = { facility: Facility; registryCompany?: NormalizedCompany | null; links: FacilityLink[]; canManage: boolean };

async function postVerification<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${api}/${path}`, {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || "request_failed"), { code: body.error });
  return body as T;
}

export function HealthcareLegalEntityPanel({ facilityType, facilityId, ico, siteName, address, city, postalCode }: Props) {
  const { t, locale } = useI18n();
  const c = t.healthcareLegalEntity as HealthcareLegalEntityCopy;
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [preview, setPreview] = useState<VerificationPreview | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [replace, setReplace] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setOpen(false); setComparisonOpen(false); setPreview(null); setConfirm(false);
    setReplace(false); setAdvanced(false); setError(""); setSaved(false);
  }, [facilityType, facilityId, ico]);

  const { data, isLoading, isError, refetch } = useQuery<FacilityLegalData>({
    queryKey: [api, "facilities", facilityType, facilityId],
    queryFn: async () => {
      const response = await fetch(`${api}/facilities/${facilityType}/${facilityId}`, { credentials: "include" });
      if (!response.ok) throw new Error("request_failed");
      return response.json();
    },
    enabled: !!facilityId, staleTime: 0, refetchOnMount: "always",
  });
  const activeLinks = (data?.links || []).filter(link => !link.validTo);
  const activeLink = activeLinks[0];
  // A fetched preview alone is never evidence of a saved, confirmed relationship.
  const verifiedSavedLink = !!activeLink && !!data?.registryCompany;
  const historicalLinks = (data?.links || []).filter(link => !!link.validTo);
  // Compare canonical entity IDs, not similar company names.
  const requiresReplacement = !!preview && activeLinks.some(link => link.legalEntityId !== preview.existingEntityId);
  const canManage = !!data?.canManage;
  const errorText = error === "operator_conflict" ? c.conflict : error === "forbidden" ? c.forbidden : c.errors;
  const date = (raw?: string | null) => raw ? new Date(raw).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "—";

  const verify = useMutation({
    mutationFn: () => postVerification<VerificationPreview>("verify", { ico, facilityType, facilityId }),
    onSuccess: value => {
      setPreview(value); setError(""); setConfirm(false); setReplace(false);
      setAdvanced(activeLinks.some(link => link.legalEntityId !== value.existingEntityId));
    },
    onError: (e: { code?: string }) => setError(e.code || "request_failed"),
  });
  const save = useMutation({
    mutationFn: () => {
      if (!preview || !confirm || !canManage || (requiresReplacement && !replace)) {
        throw Object.assign(new Error("confirmation_required"), { code: "confirmation_required" });
      }
      return postVerification<{ entityId: string; linkId: string }>("save", {
        verificationId: preview.verificationId, facilityType, facilityId, confirmOperator: true,
        ...(replace ? { replaceExisting: true } : {}),
      });
    },
    onSuccess: async () => {
      setSaved(true); setOpen(false); setPreview(null);
      // Refresh registry-owned data only. Never reload or rewrite the facility form.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [api, "facilities", facilityType, facilityId] }),
        queryClient.invalidateQueries({ queryKey: [api] }),
        queryClient.invalidateQueries({ queryKey: ["/api/healthcare-legal-entities/persons"] }),
      ]);
      await refetch();
    },
    onError: (e: { code?: string }) => setError(e.code || "request_failed"),
  });
  const startVerification = () => {
    setPreview(null); setConfirm(false); setReplace(false); setAdvanced(false);
    setError(""); setSaved(false); setOpen(true);
  };
  const retry = <Button type="button" size="sm" variant="outline" onClick={() => refetch()}>{c.retry}</Button>;

  return <>
    <section className="ler-panel" data-testid={`healthcare-legal-entity-panel-${facilityType}`}>
      <div className="ler-panel-top">
        <span className="ler-shield" aria-hidden="true"><ShieldCheck size={17} /></span>
        <div className="ler-heading">
          <div className="ler-title-line"><h3>{c.operatorTitle}</h3>
            {!isLoading && !isError && (verifiedSavedLink
              ? <span className="ler-chip is-verified"><BadgeCheck size={13} aria-hidden="true" />{c.verifiedLink}</span>
              : <span className="ler-chip is-pending"><Clock3 size={12} aria-hidden="true" />{c.noSavedVerification}</span>)}
          </div>
          <p>{c.operatorSubtitle}</p>
        </div>
        <Button type="button" size="sm" className="ler-verify-button" onClick={startVerification}
          disabled={!canManage || !ico.trim() || verify.isPending || save.isPending}>
          <RefreshCw size={14} aria-hidden="true" />{c.verify}
        </Button>
      </div>
      <div className="ler-panel-body">
        {isLoading ? <div className="ler-skeleton" aria-label={c.loading} aria-busy="true"><i /><i /></div>
          : isError ? <div className="ler-error" role="alert"><span>{c.siteLoadError}</span>{retry}</div>
          : verifiedSavedLink ? <div className="ler-entity-row">
            <span className="ler-building" aria-hidden="true"><Building2 size={17} /></span>
            <div className="ler-entity-copy"><strong>{activeLink.legalEntityName || data?.registryCompany?.name || "—"}</strong>
              <span>{c.ico} <b>{data?.registryCompany?.ico || "—"}</b><i aria-hidden="true" />{c.relationship}</span></div>
            <Button type="button" size="sm" variant="outline" className="ler-open"
              onClick={() => setLocation(`/healthcare-legal-entities?id=${activeLink.legalEntityId}`)}>
              {c.openEntity}<ArrowUpRight size={14} aria-hidden="true" />
            </Button>
          </div> : <div className="ler-unverified">
            <span className="ler-unverified-icon" aria-hidden="true"><Database size={16} /></span>
            <div><strong>{ico.trim() ? c.icoReady : c.noSavedVerification}</strong><span>{c.previewNotSaved}</span></div>
          </div>}
        {saved && <div className="ler-success-confirmation" role="status">
          <span className="ler-success-stamp" aria-hidden="true"><Check size={18} /></span>
          <span><strong>{c.confirmationSaved}</strong><small>{c.confirmationSavedHint}</small></span>
          <Check className="ler-success-spark" size={19} aria-hidden="true" />
        </div>}
        <div className="ler-site-meta">{siteName || data?.facility?.name}
          <span>{address ?? data?.facility?.address}</span><span>{city ?? data?.facility?.city} {postalCode ?? data?.facility?.postalCode}</span></div>
        <div className="ler-panel-actions">
          <Button type="button" size="sm" variant="ghost" onClick={() => setComparisonOpen(true)}>
            <Scale size={14} aria-hidden="true" />{c.siteComparisonOpen}
          </Button>
          {verifiedSavedLink && !saved && <span className="ler-saved-inline"><Check size={13} aria-hidden="true" />{c.savedShort}</span>}
        </div>
      </div>
    </section>
    <Dialog open={comparisonOpen} onOpenChange={setComparisonOpen}>
      <DialogContent overlayClassName="z-[10040]" className="ler-dialog ler-diff-dialog z-[10050]">
        <DialogHeader className="ler-dialog-head"><span className="ler-kicker">{c.comparisonKicker}</span>
          <DialogTitle>{c.siteComparisonTitle}</DialogTitle><DialogDescription>{c.siteComparisonNotice}</DialogDescription></DialogHeader>
        <div className="ler-dialog-scroll">
          <RegistryCompanySiteComparison site={data?.facility} registryCompany={data?.registryCompany} c={c} loading={isLoading} embedded={false} />
          {isError && <div className="ler-error" role="alert"><span>{c.siteLoadError}</span>{retry}</div>}
          {historicalLinks.length > 0 && <details className="ler-link-history"><summary>{c.history}</summary>
            {historicalLinks.map(link => <div key={link.id}><span>{link.legalEntityName || "—"} · {c.ended}</span>
              <Button type="button" size="sm" variant="outline" onClick={() => setLocation(`/healthcare-legal-entities?id=${link.legalEntityId}`)}>{c.openEntity}<ArrowUpRight size={14} aria-hidden="true" /></Button></div>)}
          </details>}
        </div>
        <DialogFooter className="ler-dialog-footer"><Button type="button" variant="outline" onClick={() => setComparisonOpen(false)}>{c.close}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) { setPreview(null); setError(""); } }}>
      <DialogContent overlayClassName="z-[10040]" className={`ler-dialog ler-verify-dialog z-[10050] ${preview ? "has-preview" : ""}`}>
        <DialogHeader className="ler-dialog-head">
          <span className="ler-kicker">{c.verificationKicker}<span aria-hidden="true">{preview ? "02" : "01"} — 02</span></span>
          <DialogTitle>{preview ? c.reviewFoundRecord : c.verifyTitle}</DialogTitle>
          <DialogDescription>{preview ? c.reviewFoundRecordHint : c.verificationHint}</DialogDescription>
        </DialogHeader>
        {!preview ? <div className="ler-verify-content">
          <div className="ler-ico-card"><span className="ler-ico-icon" aria-hidden="true"><Building2 size={17} /></span>
            <div><small>{c.recordSource}</small><strong>{c.ico} <b>{ico}</b></strong><span>{c.icoFromCardHint}</span></div>
            <span className="ler-readonly">{c.fromCard}</span></div>
          {error && <p role="alert" className="ler-alert">{errorText}</p>}
          <div className="ler-dialog-footer solo">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{c.cancel}</Button>
            <Button type="button" className="ler-verify-button" disabled={!canManage || !ico.trim() || verify.isPending} onClick={() => verify.mutate()}>
              {verify.isPending ? <><LoaderCircle className="ler-spin" size={15} aria-hidden="true" />{c.loading}</> : <><RefreshCw size={14} aria-hidden="true" />{c.verify}</>}
            </Button>
          </div>
        </div> : <div className="ler-verify-content ler-preview-content">
          <div className="ler-time-row">
            <span><Clock3 size={13} aria-hidden="true" />{c.checkedAt}<b>{date(preview.checkedAt)}</b></span>
            <span><Database size={13} aria-hidden="true" />{c.orsrSyncAt}<b>{date(preview.sourceUpdatedAt)}</b></span>
          </div>
          <article className="ler-company-preview">
            <div className="ler-preview-top"><span className="ler-company-seal" aria-hidden="true"><Building2 size={17} /></span>
              <span className="ler-chip is-verified"><Check size={12} aria-hidden="true" />{c.recordFound}</span></div>
            <h3>{preview.company.name}</h3><div className="ler-company-ico">{c.ico} <b>{preview.company.ico}</b></div>
            <p>{preview.company.registeredAddress || "—"}, {preview.company.city || "—"} {preview.company.postalCode || ""}</p>
            <small>{c.legalForm}: {preview.company.legalForm || "—"}</small>
          </article>
          <div className="ler-expiry">{c.expires}: {date(preview.expiresAt)}</div>
          <RegistryCompanySiteComparison site={data?.facility} registryCompany={preview.company} c={c} loading={isLoading} />
          <label className="ler-confirm"><Checkbox checked={confirm} onCheckedChange={value => setConfirm(value === true)} />
            <span><strong>{c.confirmOperatorTitle}</strong><small>{c.confirmOperator}</small></span></label>
          {requiresReplacement && <div className="ler-advanced">
            <button type="button" className="ler-advanced-toggle" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>
              <ChevronDown size={14} className={advanced ? "turned" : ""} aria-hidden="true" />{c.advancedOptions}
            </button>
            <p className="ler-alert">{c.conflict}</p>
            {advanced && <label className="ler-replace"><Checkbox checked={replace} onCheckedChange={value => setReplace(value === true)} />
              <span><strong>{c.replaceOperator}</strong><small>{c.replaceOperatorHint}</small></span></label>}
          </div>}
          {isError && <div className="ler-error" role="alert"><span>{c.siteLoadError}</span>{retry}</div>}
          {error && <p role="alert" className="ler-alert">{errorText}</p>}
          <div className="ler-dialog-footer solo">
            <Button type="button" variant="outline" onClick={() => { setPreview(null); setError(""); }}>{c.cancel}</Button>
            <Button type="button" className="ler-save-button" disabled={!confirm || !canManage || save.isPending || (requiresReplacement && !replace)} onClick={() => save.mutate()}>
              {save.isPending ? <><LoaderCircle className="ler-spin" size={15} aria-hidden="true" />{c.loading}</> : <><Sparkles size={15} aria-hidden="true" />{c.saveLink}</>}
            </Button>
          </div>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
