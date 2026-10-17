import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Save, SlidersHorizontal } from "lucide-react";
import { useI18n } from "@/i18n";
import { providerFinderTranslations } from "@/i18n/provider-finder-translations";
import { DEFAULT_FINDER_POLICY, finderCriteria, finderPolicySchema } from "@shared/provider-finder";
import type { FinderContext, FinderCriterion, FinderPolicy } from "@shared/provider-finder";
import { finderApi } from "./api";
import "./provider-finder.css";

type PriorityKey = "distance" | "cooperation" | "uploadedContract" | "representative" | "recentContact";
type Config = Omit<FinderContext, "policy"> & { policy: FinderPolicy; forms: { id: string; name: string }[]; formIds: string[] };
type PreviewRow = {
  id: string; type: "clinic" | "hospital"; name: string; missingLocation: boolean;
  quality: { score: number; tier: "recommended" | "previous" | "other"; matched: FinderCriterion[];
    missing: FinderCriterion[]; unknown: FinderCriterion[]; personId?: string; personName?: string;
    notNearest: false; breakdown: { criterion: FinderCriterion | "distance"; points: number }[] };
};
type PreviewResponse = { counts: { recommended: number; previous: number; other: number; excluded: number; missingLocations: number };
  total: number; visible: number; results: PreviewRow[]; distanceIncluded: false };
const priorities: PriorityKey[] = ["distance", "cooperation", "uploadedContract", "representative", "recentContact"];
const criterionLabels: Record<FinderCriterion, FinderCriterion> = {
  currentAgreement: "currentAgreement", previousAgreement: "previousAgreement", cooperation: "cooperation",
  uploadedContract: "uploadedContract", representative: "representative", referralReceived: "referralReceived",
  referralGiven: "referralGiven", recentContact: "recentContact",
};

export function CountryProviderFinderSettings({ country }: { country: string }) {
  const { t, locale } = useI18n(); const c = { ...t.providerFinder, ...providerFinderTranslations[locale] };
  const prefix = `/api/provider-finder/country-config/${encodeURIComponent(country)}`;
  const config = useQuery<Config>({ queryKey: [prefix], queryFn: () => finderApi(prefix), staleTime: 0 });
  const [policy, setPolicy] = useState<FinderPolicy | null>(null);
  const [formIds, setFormIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const previewRequest = useRef(0);
  const activeCountry = useRef(country);
  activeCountry.current = country;

  const invalidatePreview = () => {
    previewRequest.current++;
    setPreview(null);
    setPreviewError("");
    setPreviewBusy(false);
  };

  useEffect(() => {
    previewRequest.current++;
    setPreview(null);
    setPreviewError("");
    setPreviewBusy(false);
    if (!config.data) return;
    const parsed = finderPolicySchema.safeParse({ ...DEFAULT_FINDER_POLICY, ...config.data.policy,
      quality: { ...DEFAULT_FINDER_POLICY.quality, ...config.data.policy.quality,
        rules: { ...DEFAULT_FINDER_POLICY.quality.rules, ...config.data.policy.quality?.rules } },
      priorityWeights: { ...DEFAULT_FINDER_POLICY.priorityWeights, ...config.data.policy.priorityWeights },
    });
    if (parsed.success) setPolicy({ ...parsed.data, services: [] });
    setFormIds(config.data.formIds || []);
  }, [config.data]);

  const change = <K extends keyof FinderPolicy>(key: K, value: FinderPolicy[K]) => {
    invalidatePreview();
    setSaved(false); setError("");
    setPolicy(previous => previous ? { ...previous, [key]: value } : previous);
  };
  const changePriority = (key: PriorityKey, value: number) => {
    invalidatePreview();
    setSaved(false);
    setPolicy(previous => previous ? { ...previous, priorityWeights: { ...previous.priorityWeights, [key]: value } } : previous);
  };
  const changeQuality = <K extends keyof FinderPolicy["quality"]>(key: K, value: FinderPolicy["quality"][K]) => {
    invalidatePreview();
    setSaved(false);
    setPolicy(previous => previous ? { ...previous, quality: { ...previous.quality, [key]: value } } : previous);
  };
  const changeRule = (criterion: FinderCriterion, field: "mode" | "weight", value: string | number) => {
    invalidatePreview();
    setSaved(false);
    setPolicy(previous => previous ? { ...previous, quality: { ...previous.quality,
      rules: { ...previous.quality.rules, [criterion]: field === "mode"
        ? { ...previous.quality.rules[criterion], mode: value as "ignore" | "prefer" | "require" }
        : { ...previous.quality.rules[criterion], weight: value as number } },
    } } : previous);
  };
  const enableQuality = (enabled: boolean) => {
    invalidatePreview();
    setSaved(false); setError("");
    setPolicy(previous => previous ? { ...previous, quality: { ...previous.quality, enabled },
      ...(enabled ? { requireContract: false, requireCooperation: false, requireUploadedContract: false, requireRepresentative: false } : {}),
    } : previous);
  };

  async function runPreview() {
    if (!policy || previewBusy) return;
    invalidatePreview();
    const request = previewRequest.current;
    setPreviewBusy(true);
    setPreviewError("");
    const parsed = finderPolicySchema.safeParse({ ...policy, services: [] });
    if (!parsed.success) {
      setPreviewError(c.validationError);
      setPreviewBusy(false);
      return;
    }
    try {
      const data = await finderApi<PreviewResponse>(`${prefix}/preview`, "POST", { policy: parsed.data });
      if (request === previewRequest.current && activeCountry.current === country) setPreview(data);
    } catch {
      if (request === previewRequest.current && activeCountry.current === country) setPreviewError(c.previewError);
    } finally {
      if (request === previewRequest.current && activeCountry.current === country) setPreviewBusy(false);
    }
  }

  async function save() {
    if (!policy) return;
    invalidatePreview();
    setBusy(true); setError(""); setSaved(false);
    const parsed = finderPolicySchema.safeParse({ ...policy, services: [] });
    if (!parsed.success) {
      setError(c.validationError);
      setBusy(false);
      return;
    }
    try {
      await finderApi(prefix, "PUT", { policy: parsed.data, formIds });
      await config.refetch();
      setSaved(true);
    } catch { setError(c.error); }
    finally { setBusy(false); }
  }

  if (config.isError) return <section className="pf-root pf-config pf-stack" data-testid="country-provider-finder-settings" data-country={country}>
    <h2 className="pf-title">{c.config}</h2><div role="alert">{c.error}
      <button type="button" className="pf-button" onClick={() => void config.refetch()}>{c.search}</button></div>
  </section>;
  if (config.isLoading || !policy || config.data?.country !== country) return <section className="pf-root pf-config pf-stack" data-testid="country-provider-finder-settings" data-country={country}>
    <h2 className="pf-title">{c.config}</h2><p role="status">{c.loading}</p>
  </section>;

  return <section className="pf-root pf-config pf-stack" data-testid="country-provider-finder-settings" data-country={country}>
    <header className="pf-settings-heading">
      <div><div className="pf-kicker">INDEXUS · {config.data.country}</div><h2 className="pf-title">{c.config}</h2></div>
      <SlidersHorizontal size={20} aria-hidden="true" />
    </header>
    <p className="pf-message">{c.policyHint}</p>
    {!config.data.mapsReady && <p className="pf-message">{c.mapsMissing}</p>}
    <div className="pf-config-grid">
      <div className="pf-config-card pf-stack">
        <label className="pf-config-check"><input type="checkbox" checked={policy.enabled} disabled={busy}
          onChange={e => change("enabled", e.target.checked)} />{c.enabled}</label>
        <label className="pf-config-check"><input type="checkbox" checked={policy.publicEnabled} disabled={busy}
          onChange={e => change("publicEnabled", e.target.checked)} />{c.publicEnabled}</label>
        <div className="pf-fields">
          <div className="pf-control"><label htmlFor="pf-default-radius">{c.radius} · km</label>
            <input id="pf-default-radius" type="number" min={1} max={200} disabled={busy} value={policy.defaultRadiusKm}
              onChange={e => change("defaultRadiusKm", Number(e.target.value))} /></div>
          <div className="pf-control"><label htmlFor="pf-max-radius">{c.maxRadius}</label>
            <input id="pf-max-radius" type="number" min={1} max={200} disabled={busy} value={policy.maxRadiusKm}
              onChange={e => change("maxRadiusKm", Number(e.target.value))} /></div>
          <div className="pf-control"><label htmlFor="pf-recent-days">{c.recentDays}</label>
            <input id="pf-recent-days" type="number" min={1} max={365} disabled={busy} value={policy.recentContactDays}
              onChange={e => change("recentContactDays", Number(e.target.value))} /></div>
        </div>
        <p className="pf-note">{c.formsHint}</p>
      </div>

      <section className="pf-config-card pf-stack pf-quality-card" aria-labelledby="pf-quality-heading">
        <div className="pf-row pf-space pf-quality-heading">
          <div><div className="pf-kicker">INDEXUS</div><h3 id="pf-quality-heading">{c.qualityTitle}</h3></div>
          <label className="pf-switch"><span>{c.qualityEnabled}</span><input type="checkbox" checked={policy.quality.enabled}
            disabled={busy} onChange={e => enableQuality(e.target.checked)} aria-label={c.qualityEnabled} /></label>
        </div>
        <p className="pf-note">{c.qualityHint}</p>
        <p className="pf-message pf-quality-safety">{c.qualitySafety}</p>
        <p className="pf-note">{c.evidenceDefinitions}</p>
        <div className="pf-preview-control">
          <button type="button" className="pf-button" onClick={() => void runPreview()} disabled={busy || previewBusy}>
            <SlidersHorizontal size={14} />{previewBusy ? c.previewPending : c.previewButton}
          </button>
          <p className="pf-note">{c.previewNote}</p>
        </div>
        {previewError && <div className="pf-message pf-error pf-row pf-space" role="alert">
          <span>{previewError}</span><button type="button" className="pf-button" onClick={() => void runPreview()} disabled={previewBusy}>{c.previewRetry}</button>
        </div>}
        {preview && <section className="pf-preview" aria-label={c.previewTitle} aria-live="polite">
          <header className="pf-row pf-space"><div><div className="pf-kicker">{c.previewTitle}</div>
            <strong>{c.previewTotal}: {preview.total}</strong></div><span className="pf-note">{c.previewVisible}: {preview.visible}</span></header>
          <div className="pf-preview-counts">
            <div><strong>{preview.counts.recommended}</strong><span>{c.recommended}</span></div>
            <div><strong>{preview.counts.previous}</strong><span>{c.previous}</span></div>
            <div><strong>{preview.counts.other}</strong><span>{c.other}</span></div>
            <div><strong>{preview.counts.excluded}</strong><span>{c.previewExcluded}</span></div>
            <div><strong>{preview.counts.missingLocations}</strong><span>{c.missingLocations}</span></div>
          </div>
          {preview.results.length > 0 ? <div className="pf-preview-results">
            {preview.results.slice(0, 12).map(row => <article className="pf-preview-row" key={`${row.type}:${row.id}`}>
              <div className="pf-row pf-space"><strong>{row.name}</strong>
                <span className={`pf-tier pf-tier-${row.quality.tier}`}>{c[row.quality.tier]}</span></div>
              <div className="pf-row pf-preview-meta"><span>{c[row.type]} · {row.quality.score}/100</span>
                {row.quality.personName && <span>{c.evidenceForPerson} {row.quality.personName}</span>}
                {row.missingLocation && <span className="pf-preview-missing">{c.previewMissingLocation}</span>}</div>
              <div className="pf-preview-evidence">
                {row.quality.matched.length > 0 && <span><b>{c.matched}:</b> {row.quality.matched.map(key => c[criterionLabels[key]]).join(", ")}</span>}
                {row.quality.missing.length > 0 && <span><b>{c.missing}:</b> {row.quality.missing.map(key => c[criterionLabels[key]]).join(", ")}</span>}
                {row.quality.unknown.length > 0 && <span><b>{c.unknown}:</b> {row.quality.unknown.map(key => c[criterionLabels[key]]).join(", ")}</span>}
              </div>
              <div className="pf-breakdown">{row.quality.breakdown.map((part, index) => <span key={`${part.criterion}-${index}`}>
                {part.criterion === "distance" ? c.distance : c[criterionLabels[part.criterion]]} · {part.points.toLocaleString(locale, { maximumFractionDigits: 1 })} {c.points}
              </span>)}</div>
            </article>)}
          </div> : <p className="pf-note">{c.previewNoResults}</p>}
        </section>}
        {policy.quality.enabled && <>
          <div className="pf-fields">
            <div className="pf-control"><label htmlFor="pf-quality-min">{c.qualityMinimum} · {policy.quality.minimumScore}</label>
              <div className="pf-row pf-slider-line"><input id="pf-quality-min" type="range" min={0} max={100}
                value={policy.quality.minimumScore} disabled={busy}
                onChange={e => changeQuality("minimumScore", Number(e.target.value))} />
                <input aria-label={c.qualityMinimum} type="number" min={0} max={100} value={policy.quality.minimumScore}
                  disabled={busy} onChange={e => changeQuality("minimumScore", Number(e.target.value))} /></div></div>
            <div className="pf-control"><label htmlFor="pf-distance-weight">{c.distanceWeight} · {policy.quality.distanceWeight}</label>
              <div className="pf-row pf-slider-line"><input id="pf-distance-weight" type="range" min={0} max={100}
                value={policy.quality.distanceWeight} disabled={busy}
                onChange={e => changeQuality("distanceWeight", Number(e.target.value))} />
                <input aria-label={c.distanceWeight} type="number" min={0} max={100} value={policy.quality.distanceWeight}
                  disabled={busy} onChange={e => changeQuality("distanceWeight", Number(e.target.value))} /></div></div>
          </div>
          <label className="pf-config-check"><input type="checkbox" checked={policy.quality.agreementPriority} disabled={busy}
            onChange={e => changeQuality("agreementPriority", e.target.checked)} />{c.agreementPriority}</label>
          <div className="pf-control"><label htmlFor="pf-quality-fallback">{c.fallback}</label>
            <select id="pf-quality-fallback" value={policy.quality.fallback} disabled={busy}
              onChange={e => changeQuality("fallback", e.target.value as FinderPolicy["quality"]["fallback"])}>
              <option value="append">{c.fallbackAppend}</option><option value="when_empty">{c.fallbackWhenEmpty}</option>
              <option value="never">{c.fallbackNever}</option>
            </select></div>
          <div className="pf-criteria-table">
            <div className="pf-criteria-header"><span>{c.qualityTitle}</span><span>{c.qualityModes}</span><span>{c.weight}</span></div>
            {finderCriteria.map(criterion => <div className="pf-criterion-row" key={criterion}>
              <label htmlFor={`pf-mode-${criterion}`}>{c[criterionLabels[criterion]]}</label>
              <select id={`pf-mode-${criterion}`} value={policy.quality.rules[criterion].mode} disabled={busy}
                onChange={e => changeRule(criterion, "mode", e.target.value)}>
                <option value="ignore">{c.ignore}</option><option value="prefer">{c.prefer}</option>
                <option value="require">{c.require}</option>
              </select>
              <div className="pf-row pf-criterion-weight">
                <input aria-label={`${c[criterionLabels[criterion]]} · ${c.weight}`} type="range" min={0} max={100}
                  value={policy.quality.rules[criterion].weight} disabled={busy}
                  onChange={e => changeRule(criterion, "weight", Number(e.target.value))} />
                <input aria-label={`${c[criterionLabels[criterion]]} · ${c.weight}`} type="number" min={0} max={100}
                  value={policy.quality.rules[criterion].weight} disabled={busy}
                  onChange={e => changeRule(criterion, "weight", Number(e.target.value))} />
              </div>
            </div>)}
          </div>
        </>}
      </section>

      {!policy.quality.enabled && <div className="pf-config-card pf-stack">
        <strong>{c.legacyFilters}</strong>
        <p className="pf-note">{c.requiredCriteriaHint}</p>
        {(["requireContract", "requireCooperation", "requireUploadedContract", "requireRepresentative"] as const).map(key =>
          <label className="pf-config-check" key={key}><input type="checkbox" checked={policy[key]} disabled={busy}
            onChange={e => change(key, e.target.checked)} />{key === "requireContract" ? c.requireContract :
              key === "requireCooperation" ? c.requireCooperation : key === "requireUploadedContract" ? c.requireUploadedContract : c.requireRepresentative}
          </label>)}
        <label className="pf-config-check"><input type="checkbox" checked={policy.preferContract} disabled={busy}
          onChange={e => change("preferContract", e.target.checked)} />{c.preferContract}</label>
        <label className="pf-config-check"><input type="checkbox" checked={policy.preferRecentContact} disabled={busy}
          onChange={e => change("preferRecentContact", e.target.checked)} />{c.preferRecent}</label>
        <strong>{c.priorityWeights}</strong><p className="pf-note">{c.weightHint}</p>
        {priorities.map(key => <div className="pf-control" key={key}>
          <label htmlFor={`pf-weight-${key}`}>{c[key]} · {policy.priorityWeights[key]}</label>
          <div className="pf-row pf-slider-line"><input aria-label={`${c[key]} · ${c.priorityWeights}`} id={`pf-weight-${key}`} type="range" min={0} max={100} step={1}
            value={policy.priorityWeights[key]} disabled={busy} onChange={e => changePriority(key, Number(e.target.value))} />
            <input aria-label={`${c[key]} · ${c.priorityWeights}`} type="number" min={0} max={100} step={1}
              value={policy.priorityWeights[key]} disabled={busy}
              onChange={e => changePriority(key, Math.max(0, Math.min(100, Number(e.target.value))))} /></div>
        </div>)}
      </div>}

      <div className="pf-config-card pf-stack">
        <strong>{c.forms}</strong><p className="pf-note">{c.formsHint}</p>
        {(config.data.forms || []).map(form => <label className="pf-config-check" key={form.id}>
          <input type="checkbox" checked={formIds.includes(form.id)} disabled={busy}
            onChange={e => { setSaved(false); setFormIds(old => e.target.checked ? [...old, form.id] : old.filter(id => id !== form.id)); }} />
          {form.name}
        </label>)}
        {!config.data.forms.length && <p className="pf-note">{c.noForms}</p>}
      </div>
    </div>
    <div className="pf-row pf-space"><span role="status">{saved ? c.saved : ""}</span>
      <button type="button" className="pf-button primary" onClick={() => void save()} disabled={busy}>
        <Save size={14} />{busy ? c.loading : c.save}</button></div>
    {error && <p role="alert" className="pf-message pf-error">{error}</p>}
  </section>;
}
