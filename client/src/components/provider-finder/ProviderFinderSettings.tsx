import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useI18n } from "@/i18n";
import { providerFinderTranslations } from "@/i18n/provider-finder-translations";
import type { FinderContext, FinderPolicy } from "@shared/provider-finder";
import { finderApi } from "./api";
import "./provider-finder.css";

type PriorityKey = "distance" | "cooperation" | "uploadedContract" | "representative" | "recentContact";
type SettingsPolicy = FinderPolicy & {
  requireCooperation: boolean;
  requireUploadedContract: boolean;
  requireRepresentative: boolean;
  priorityWeights: Record<PriorityKey, number>;
};
type Config = Omit<FinderContext, "policy"> & { policy: SettingsPolicy; forms: { id: string; name: string }[]; formIds: string[] };
const defaultWeights: Record<PriorityKey, number> = {
  distance: 20, cooperation: 30, uploadedContract: 30, representative: 20, recentContact: 0,
};
const priorities: PriorityKey[] = ["distance", "cooperation", "uploadedContract", "representative", "recentContact"];

export function CountryProviderFinderSettings({ country }: { country: string }) {
  const { t, locale } = useI18n(); const c = { ...t.providerFinder, ...providerFinderTranslations[locale] };
  const prefix = `/api/provider-finder/country-config/${encodeURIComponent(country)}`;
  const config = useQuery<Config>({ queryKey: [prefix], queryFn: () => finderApi(prefix), staleTime: 0 });
  const [policy, setPolicy] = useState<SettingsPolicy | null>(null);
  const [formIds, setFormIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!config.data) return;
    setPolicy({
      ...config.data.policy,
      services: [],
      requireCooperation: config.data.policy.requireCooperation ?? false,
      requireUploadedContract: config.data.policy.requireUploadedContract ?? false,
      requireRepresentative: config.data.policy.requireRepresentative ?? false,
      priorityWeights: { ...defaultWeights, ...config.data.policy.priorityWeights },
    } as SettingsPolicy);
    setFormIds(config.data.formIds || []);
  }, [config.data]);

  const change = <K extends keyof SettingsPolicy>(key: K, value: SettingsPolicy[K]) => {
    setSaved(false);
    setPolicy(previous => previous ? { ...previous, [key]: value } : previous);
  };
  const changeWeight = (key: PriorityKey, value: number) => {
    setSaved(false);
    setPolicy(previous => previous ? { ...previous, priorityWeights: { ...previous.priorityWeights, [key]: value } } : previous);
  };

  async function save() {
    if (!policy) return;
    setBusy(true); setError(""); setSaved(false);
    try {
      await finderApi(prefix, "PUT", { policy: { ...policy, services: [] }, formIds });
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

  const required: [keyof SettingsPolicy, string][] = [
    ["requireCooperation", c.requireCooperation],
    ["requireUploadedContract", c.requireUploadedContract],
    ["requireRepresentative", c.requireRepresentative],
  ];
  return <section className="pf-root pf-config pf-stack" data-testid="country-provider-finder-settings" data-country={country}>
    <h2 className="pf-title">{c.config} · {config.data?.country || country}</h2>
    <p className="pf-message">{c.policyHint}</p>
    {!config.data?.mapsReady && <p className="pf-message">{c.mapsMissing}</p>}
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
        <strong>{c.requiredCriteria}</strong>
        <p className="pf-note">{c.requiredCriteriaHint}</p>
        <p className="pf-note">{c.evidenceHint}</p>
        <p className="pf-note">{c.personLocationHint}</p>
        {required.map(([key, label]) => <label className="pf-config-check" key={key}>
          <input type="checkbox" checked={policy[key] === true} disabled={busy}
            onChange={e => change(key, e.target.checked as never)} />{label}</label>)}
      </div>
      <div className="pf-config-card pf-stack">
        <strong>{c.priorityWeights}</strong>
        <p className="pf-note">{c.weightHint}</p>
        {priorities.map(key => <div className="pf-control" key={key}>
          <label htmlFor={`pf-weight-${key}`}>{c[key]} · {policy.priorityWeights[key]}</label>
          <div className="pf-row" style={{ flexWrap: "nowrap" }}>
            <input aria-label={`${c[key]} · ${c.priorityWeights}`} id={`pf-weight-${key}`} type="range" min={0} max={100} step={1}
              value={policy.priorityWeights[key]} disabled={busy} onChange={e => changeWeight(key, Number(e.target.value))} />
            <input aria-label={`${c[key]} · ${c.priorityWeights}`} type="number" min={0} max={100} step={1}
              value={policy.priorityWeights[key]} disabled={busy}
              onChange={e => changeWeight(key, Math.max(0, Math.min(100, Number(e.target.value))))} style={{ width: 76 }} />
          </div>
        </div>)}
      </div>
      <div className="pf-config-card pf-stack">
        <strong>{c.forms}</strong>
        <p className="pf-note">{c.formsHint}</p>
        {(config.data?.forms || []).map(form => <label className="pf-config-check" key={form.id}>
          <input type="checkbox" checked={formIds.includes(form.id)} disabled={busy}
            onChange={e => { setSaved(false); setFormIds(old => e.target.checked ? [...old, form.id] : old.filter(id => id !== form.id)); }} />
          {form.name}
        </label>)}
        {!config.data?.forms.length && <p className="pf-note">{c.noForms}</p>}
      </div>
    </div>
    <div className="pf-row pf-space"><span role="status">{saved ? c.saved : ""}</span>
      <button type="button" className="pf-button primary" onClick={() => void save()} disabled={busy}>
        <Save size={14} />{busy ? c.loading : c.save}</button></div>
    {error && <p role="alert" className="pf-message pf-error">{error}</p>}
  </section>;
}
