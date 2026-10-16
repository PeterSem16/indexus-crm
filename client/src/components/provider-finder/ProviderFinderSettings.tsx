import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Save, MapPin, Search } from "lucide-react";
import { useI18n } from "@/i18n";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { DEFAULT_FINDER_POLICY, finderPolicySchema, type FinderContext, type FinderPolicy, type FinderProfile, type FinderProvider } from "@shared/provider-finder";
import { finderApi } from "./api";
import "./provider-finder.css";

type Config = FinderContext & { forms: { id: string; name: string; boundCompanyId?: string | null }[]; formIds: string[] };
export function ProviderFinderSettings({ companyId, countries }: { companyId: string; countries: string[] }) {
  const { t } = useI18n(); const c = t.providerFinder;
  const [country, setCountry] = useState(countries[0] || "");
  useEffect(() => { if (!countries.includes(country)) setCountry(countries[0] || ""); }, [countries.join(","), country]);
  return <section className="pf-root pf-config pf-stack">
    <h2 className="pf-title">{c.config}</h2>
    <div className="pf-control"><label htmlFor="pf-config-country">{c.country}</label>
      <select id="pf-config-country" value={country} onChange={e => setCountry(e.target.value)}>
        {countries.map(x => <option key={x}>{x}</option>)}</select></div>
    {country && <CountrySettings key={`${companyId}:${country}`} companyId={companyId} country={country} />}
  </section>;
}
function CountrySettings({ companyId, country }: { companyId: string; country: string }) {
  const { t } = useI18n(); const c = t.providerFinder;
  const prefix = `/api/provider-finder/config/${companyId}/${country}`;
  const config = useQuery<Config>({ queryKey: [prefix], queryFn: () => finderApi(prefix), staleTime: 0 });
  const [policy, setPolicy] = useState<FinderPolicy>({ ...DEFAULT_FINDER_POLICY });
  const [servicesText, setServicesText] = useState("");
  const [formIds, setFormIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [saved, setSaved] = useState(false);
  const [q, setQ] = useState(""); const [search, setSearch] = useState("");
  const [directoryEnabled, setDirectoryEnabled] = useState(false);
  useEffect(() => {
    if (config.data) { setPolicy(config.data.policy); setServicesText(config.data.policy.services.join("\n")); setFormIds(config.data.formIds); }
  }, [config.data]);
  const directoryUrl = `/api/provider-finder/directory/${companyId}/${country}?q=${encodeURIComponent(search)}`;
  const directory = useQuery<{ total: number; providers: FinderProvider[] }>({
    queryKey: [directoryUrl], queryFn: () => finderApi(directoryUrl), enabled: directoryEnabled, staleTime: 0,
  });
  const change = <K extends keyof FinderPolicy>(key: K, value: FinderPolicy[K]) => {
    setSaved(false); setPolicy(previous => ({ ...previous, [key]: value }));
  };
  async function save() {
    setBusy(true); setError(""); setSaved(false);
    try {
      const validated = finderPolicySchema.parse({ ...policy, services: [...new Set(servicesText.split("\n").map(s => s.trim()).filter(Boolean))] });
      await finderApi(prefix, "PUT", { policy: validated, formIds });
      await config.refetch(); setDirectoryEnabled(true); setSaved(true);
    } catch { setError(c.error); }
    finally { setBusy(false); }
  }
  if (config.isLoading) return <p role="status">{c.loading}</p>;
  if (config.isError) return <div role="alert">{c.error}<button type="button" className="pf-button" onClick={() => void config.refetch()}>{c.search}</button></div>;
  const toggles: [keyof FinderPolicy, string][] = [
    ["enabled", c.enabled], ["publicEnabled", c.publicEnabled], ["requireContract", c.requireContract],
    ["preferContract", c.preferContract], ["preferRecentContact", c.preferRecent],
  ];
  return <>
    <p className="pf-message">{c.policyHint}</p>
    {!config.data?.mapsReady && <p className="pf-message">{c.mapsMissing}</p>}
    <div className="pf-config-grid">
      <div className="pf-config-card pf-stack">
        {toggles.map(([key, label]) => <label className="pf-config-check" key={key}><input type="checkbox"
          checked={policy[key] === true} disabled={busy} onChange={e => change(key, e.target.checked as never)} />{label}</label>)}
        <div className="pf-fields">
          <div className="pf-control"><label htmlFor="pf-default-radius">{c.radius} · km</label><input id="pf-default-radius" type="number" min={1} max={200}
            value={policy.defaultRadiusKm} onChange={e => change("defaultRadiusKm", Number(e.target.value))} /></div>
          <div className="pf-control"><label htmlFor="pf-max-radius">{c.maxRadius}</label><input id="pf-max-radius" type="number" min={1} max={200}
            value={policy.maxRadiusKm} onChange={e => change("maxRadiusKm", Number(e.target.value))} /></div>
          <div className="pf-control"><label htmlFor="pf-recent-days">{c.recentDays}</label><input id="pf-recent-days" type="number" min={1} max={365}
            value={policy.recentContactDays} onChange={e => change("recentContactDays", Number(e.target.value))} /></div>
        </div>
      </div>
      <div className="pf-config-card pf-stack">
        <div className="pf-control"><label htmlFor="pf-services">{c.services}</label><textarea id="pf-services" value={servicesText}
          onChange={e => { setServicesText(e.target.value); setSaved(false); }} /></div>
        <strong>{c.forms}</strong>
        {config.data?.forms.map(form => <label className="pf-config-check" key={form.id}>
          <input type="checkbox" checked={formIds.includes(form.id)} disabled={!!form.boundCompanyId && form.boundCompanyId !== companyId}
            onChange={e => { setSaved(false); setFormIds(old => e.target.checked ? [...old, form.id] : old.filter(id => id !== form.id)); }} />{form.name}
        </label>)}
      </div>
    </div>
    <div className="pf-row pf-space"><span role="status">{saved ? c.saved : ""}</span>
      <button type="button" className="pf-button primary" onClick={() => void save()} disabled={busy}><Save size={14} />{busy ? c.loading : c.save}</button></div>
    {error && <p role="alert" className="pf-message pf-error">{error}</p>}
    <div className="pf-config-card pf-stack">
      <h3 style={{ fontWeight: 700 }}>{c.profiles}</h3><p className="pf-note">{c.saveFirst}</p>
      <div className="pf-row"><div className="pf-control" style={{ flex: 1 }}><label htmlFor="pf-directory-query">{c.search}</label>
        <input id="pf-directory-query" maxLength={100} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); setSearch(q); setDirectoryEnabled(true); }
        }} /></div><button type="button" className="pf-button" onClick={() => {
          setSearch(q); setDirectoryEnabled(true); if (q === search) void directory.refetch();
        }}><Search size={14} />{c.search}</button></div>
      {directory.isFetching && <p role="status">{c.loading}</p>}
      {directory.isError && <p role="alert">{c.error}</p>}
      {directory.data && <p className="pf-note">{c.total}: {directory.data.total}</p>}
      <div className="pf-directory">{directory.data?.providers.map(provider => <SiteSettings key={`${provider.type}:${provider.id}`}
        provider={provider} services={config.data?.policy.services || []} companyId={companyId} country={country} />)}</div>
    </div>
  </>;
}
function SiteSettings({ provider, services, companyId, country }: { provider: FinderProvider; services: string[]; companyId: string; country: string }) {
  const { t } = useI18n(); const c = t.providerFinder;
  const [profile, setProfile] = useState<FinderProfile>({
    type: provider.type, id: provider.id, enabled: provider.enabled, publicVisible: provider.publicVisible,
    paused: provider.paused, services: provider.services, publicPhone: provider.publicPhone, publicEmail: provider.publicEmail,
    publicPersonIds: provider.publicPersonIds || [],
    useClinicContractEvidence: provider.contractProfile?.useClinicContractEvidence || false,
    contractReference: provider.contractProfile?.contractReference || "",
    contractValidFrom: provider.contractProfile?.contractValidFrom || "",
    contractValidTo: provider.contractProfile?.contractValidTo || "",
  });
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function save() {
    setBusy(true); setMessage("");
    try { await finderApi(`/api/provider-finder/profile/${companyId}/${country}`, "PUT", profile); setMessage(c.saved); }
    catch { setMessage(c.error); }
    finally { setBusy(false); }
  }
  return <details><summary>{provider.name} · {provider.city} <span className="pf-tag">{c[provider.type]}</span></summary>
    <div className="pf-stack" style={{ marginTop: 12 }}>
      <p className="pf-note">{provider.address}, {provider.city}</p>
      {provider.lat === null || provider.lng === null ? <p className="pf-message"><MapPin size={13} />{c.missingLocations}</p>
        : <p className="pf-note">{provider.lat}, {provider.lng}</p>}
      {provider.contracted && <span className="pf-tag">{c.contracted}</span>}
      {provider.type === "clinic" && <label className="pf-config-check"><input type="checkbox" checked={profile.useClinicContractEvidence}
        onChange={e => setProfile(p => ({ ...p, useClinicContractEvidence: e.target.checked }))} />{c.contractScope}</label>}
      <div className="pf-control"><label htmlFor={`pf-contract-${provider.type}-${provider.id}`}>{c.contractReference}</label>
        <input id={`pf-contract-${provider.type}-${provider.id}`} maxLength={150} value={profile.contractReference}
          onChange={e => setProfile(p => ({ ...p, contractReference: e.target.value }))} /></div>
      <div className="pf-fields">
        <div className="pf-control"><label htmlFor={`pf-from-${provider.type}-${provider.id}`}>{c.validFrom}</label>
          <DateTimePicker id={`pf-from-${provider.type}-${provider.id}`} includeTime={false} countryCode={country} value={profile.contractValidFrom}
            onChange={value => setProfile(p => ({ ...p, contractValidFrom: value.slice(0, 10) }))} /></div>
        <div className="pf-control"><label htmlFor={`pf-to-${provider.type}-${provider.id}`}>{c.validTo}</label>
          <DateTimePicker id={`pf-to-${provider.type}-${provider.id}`} includeTime={false} countryCode={country} value={profile.contractValidTo}
            onChange={value => setProfile(p => ({ ...p, contractValidTo: value.slice(0, 10) }))} /></div>
      </div>
      {(["enabled", "publicVisible", "paused"] as const).map(key => <label className="pf-config-check" key={key}>
        <input type="checkbox" checked={profile[key]} onChange={e => { setMessage(""); setProfile(p => ({ ...p, [key]: e.target.checked })); }} />
        {key === "enabled" ? c.siteEnabled : c[key]}</label>)}
      <div className="pf-control"><label>{c.service}</label>{services.map(s => <label className="pf-config-check" key={s}>
        <input type="checkbox" checked={profile.services.includes(s)} onChange={e => setProfile(p => ({
          ...p, services: e.target.checked ? [...p.services, s] : p.services.filter(x => x !== s),
        }))} />{s}</label>)}</div>
      <div className="pf-fields">
        <div className="pf-control"><label htmlFor={`pf-phone-${provider.type}-${provider.id}`}>{c.publicContacts} · tel.</label>
          <input id={`pf-phone-${provider.type}-${provider.id}`} maxLength={50} value={profile.publicPhone}
            onChange={e => setProfile(p => ({ ...p, publicPhone: e.target.value }))} /></div>
        <div className="pf-control"><label htmlFor={`pf-email-${provider.type}-${provider.id}`}>{c.publicContacts} · email</label>
          <input id={`pf-email-${provider.type}-${provider.id}`} type="email" maxLength={200} value={profile.publicEmail}
            onChange={e => setProfile(p => ({ ...p, publicEmail: e.target.value }))} /></div>
      </div>
      {provider.people.length > 0 && <div><strong>{c.publicPeople}</strong>{provider.people.map(person => <label className="pf-config-check" key={person.id}>
        <input type="checkbox" checked={profile.publicPersonIds.includes(person.id)} onChange={e => setProfile(p => ({
          ...p, publicPersonIds: e.target.checked ? [...p.publicPersonIds, person.id] : p.publicPersonIds.filter(x => x !== person.id),
        }))} />{person.name}</label>)}</div>}
      <div className="pf-row pf-space"><span role="status">{message}</span><button type="button" className="pf-button"
        disabled={busy} onClick={() => void save()}>{busy ? c.loading : c.save}</button></div>
    </div>
  </details>;
}
