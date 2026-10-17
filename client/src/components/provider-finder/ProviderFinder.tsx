import { useEffect, useRef, useState } from "react";
import { Check, MapPin, Search, X, Navigation, Building2, Stethoscope, Loader2 } from "lucide-react";
import { finderCriteria } from "@shared/provider-finder";
import type { FinderContext, FinderCriterion, FinderPoint, FinderResult, FinderSelection } from "@shared/provider-finder";
import type { Locale } from "@/i18n";
import { providerFinderTranslations } from "@/i18n/provider-finder-translations";
import { ProviderMap } from "./ProviderMap";
import { finderApi } from "./api";
import "./provider-finder.css";

type Candidate = { label: string; point: FinderPoint; approximate: boolean };
const qualityCriterionLabel = (criterion: FinderCriterion) => criterion;
type RankedFinderResult = FinderResult & {
  cooperating?: boolean;
  uploadedContract?: boolean;
  hasRepresentative?: boolean;
  priorityScore?: number;
};
export function ProviderFinder({ context, prefix, initialAddress = "", customerName, locale, publicView = false, onSelect, onClose, onInvalidate }: {
  context: FinderContext; prefix: string; initialAddress?: string; customerName?: string; locale: Locale;
  publicView?: boolean; onSelect: (selection: FinderSelection, result: FinderResult) => Promise<void> | void;
  onClose?: () => void; onInvalidate?: () => void;
}) {
  const c = providerFinderTranslations[locale] || providerFinderTranslations.en;
  const [address, setAddress] = useState(initialAddress);
  const [point, setPoint] = useState<FinderPoint | null>(null);
  const [originLabel, setOriginLabel] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [radius, setRadius] = useState(context.policy.defaultRadiusKm);
  const [types, setTypes] = useState<("clinic" | "hospital")[]>(["clinic", "hospital"]);
  const [peopleOnly, setPeopleOnly] = useState(false);
  const [personQuery, setPersonQuery] = useState("");
  const [results, setResults] = useState<RankedFinderResult[]>([]);
  const [missing, setMissing] = useState(0);
  const [selected, setSelected] = useState("");
  const [selectedPerson, setSelectedPerson] = useState("");
  const [busy, setBusy] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 761px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 761px)");
    const update = () => setDesktop(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const generation = useRef(0);
  const onInvalidateRef = useRef(onInvalidate); onInvalidateRef.current = onInvalidate;
  const invalidate = () => {
    generation.current++; setSelected(""); setSelectedPerson(""); setResults([]);
    setSearched(false); setError(""); setBusy(false); setGeoBusy(false); onInvalidateRef.current?.();
  };
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => {
    setAddress(initialAddress); setPoint(null); setOriginLabel(""); setCandidates([]);
    setView("list");
    setRadius(context.policy.defaultRadiusKm); invalidate(); setBusy(false);
  }, [context.billingCompanyId, context.country, initialAddress]);
  const errorMessage = (e: { code?: string }) => {
    const code = e.code || "";
    if (code === "maps_not_configured") return c.mapsMissing;
    if (["maps_authorization", "maps_auth", "maps_unauthorized", "maps_forbidden"].includes(code)) return c.mapsAuthorization;
    if (["maps_billing_or_quota", "maps_over_query_limit"].includes(code)) return c.mapsBillingOrQuota;
    if (["maps_quota", "rate_limited"].includes(code)) return c.mapsQuota;
    if (["maps_unavailable", "maps_timeout"].includes(code)) return c.mapUnavailable;
    if (["queue_full", "geocode_queue_full", "geocode_wait_timeout"].includes(code)) return c.geocodeRetry;
    return c.error;
  };
  async function searchAt(origin: FinderPoint) {
    const request = ++generation.current; setBusy(true); setError(""); setSelected(""); setSelectedPerson("");
    onInvalidateRef.current?.();
    try {
      const response = await finderApi<{ results: RankedFinderResult[]; missingLocations?: number }>(`${prefix}/search`, "POST",
        { point: origin, radiusKm: radius, service: "", types, peopleOnly, personQuery });
      if (request !== generation.current) return;
      setResults(response.results); setMissing(response.missingLocations || 0); setSearched(true);
    } catch (e) {
      if (request === generation.current) { setResults([]); setError(errorMessage(e as any)); setSearched(false); }
    } finally { if (request === generation.current) setBusy(false); }
  }
  useEffect(() => {
    if (!point) return;
    const timer = window.setTimeout(() => { void searchAt(point); }, 250);
    return () => window.clearTimeout(timer);
  }, [point, radius, types, peopleOnly, personQuery]);
  async function geocode() {
    invalidate(); setPoint(null); setCandidates([]); setOriginLabel("");
    const request = ++generation.current; setBusy(true); setGeoBusy(true); setError("");
    try {
      const response = await finderApi<{ candidates: Candidate[] }>(`${prefix}/geocode`, "POST", { address, language: locale });
      if (request !== generation.current) return;
      setCandidates(response.candidates);
      if (!response.candidates.length) setError(c.empty);
      // Even one match requires explicit confirmation; never guess an ambiguous or approximate address.
    } catch (e) { if (request === generation.current) setError(errorMessage(e as any)); }
    finally { if (request === generation.current) { setBusy(false); setGeoBusy(false); } }
  }
  function gps() {
    invalidate(); setPoint(null); setOriginLabel(""); setCandidates([]);
    const request = ++generation.current; setBusy(true);
    if (!navigator.geolocation) { setError(c.error); setBusy(false); return; }
    navigator.geolocation.getCurrentPosition(position => {
      if (generation.current !== request) return;
      setPoint({ lat: position.coords.latitude, lng: position.coords.longitude }); setOriginLabel(c.gps); setBusy(false);
    }, () => { if (generation.current === request) { setError(c.error); setBusy(false); } }, { timeout: 10000, maximumAge: 0 });
  }
  function confirmCandidate(candidate: Candidate) {
    invalidate();
    setError("");
    setCandidates([]);
    // Keep the user's own input as the map caption; Google formatted addresses
    // must not be displayed alongside a map in the EEA.
    setOriginLabel(address.trim());
    setPoint(candidate.point);
  }
  const current = results.find(r => `${r.type}:${r.id}` === selected);
  function pick(key: string, suggestedPersonId?: string) {
    setSelected(key);
    setSelectedPerson(suggestedPersonId || "");
    setError("");
  }
  const suggestedPersonId = current?.suggestedPersonId || (!publicView ? current?.quality?.personId : undefined);
  const missingRequiredPerson = !!suggestedPersonId && !selectedPerson;
  async function confirm() {
    if (!current || busy || saving || missingRequiredPerson) return;
    setSaving(true); setError("");
    try {
      await onSelect({ id: current.id, type: current.type, billingCompanyId: context.billingCompanyId, country: context.country,
        ...(selectedPerson ? { personId: selectedPerson } : {}) }, current);
    } catch { setError(c.error); }
    finally { setSaving(false); }
  }
  return <section className={`pf-root pf-content${publicView ? " pf-public" : ""}`} aria-label={c.title} data-testid="provider-finder">
    <header className="pf-modal-head">
      <div><div className="pf-kicker">INDEXUS · {context.country}</div><h2 className="pf-title">{c.title}</h2></div>
      {onClose && <button type="button" className="pf-button" onClick={onClose} aria-label={c.close}><X size={16} /></button>}
    </header>
    <div className={`pf-modal-body${candidates.length ? " pf-candidates-visible" : ""}`}>
      <section className={`pf-panel${view === "map" ? " pf-hide-mobile" : ""}`}>
        <div className="pf-origin"><div className="pf-kicker">{customerName || c.origin}</div>
          <strong>{initialAddress || c.address}</strong><p className="pf-note">{context.companyName} · {context.country}</p></div>
        <div className="pf-control"><label htmlFor="pf-address">{c.address}</label>
          <div className="pf-row" style={{ flexWrap: "nowrap" }}>
            <input id="pf-address" value={address} maxLength={300} onChange={e => {
              setAddress(e.target.value); invalidate(); setPoint(null); setOriginLabel(""); setCandidates([]); setBusy(false);
            }} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (!busy && address.trim().length >= 4) void geocode(); } }} />
            <button type="button" className="pf-button" onClick={() => void geocode()} disabled={busy || saving || address.trim().length < 4}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}<span>{c.search}</span></button>
          </div>
          <p className="pf-note">{c.addressHint}</p>
        </div>
        <div className="pf-row"><button type="button" className="pf-button" onClick={gps} disabled={busy || saving}><Navigation size={13} />{c.gps}</button></div>
        <p className="pf-note">{c.privacy}</p>
        {!context.mapsReady && <div className="pf-message" role="status">{c.mapsMissing}</div>}
        {candidates.length > 0 && <div className="pf-candidate-confirmation" aria-label={c.confirmAddress}>
          <strong>{c.confirmAddress}</strong>
          <p className="pf-note">{c.candidateHint}</p>
          <div className="pf-stack">{candidates.map((candidate, index) => <button type="button" className="pf-result" key={`${candidate.point.lat}:${candidate.point.lng}:${index}`}
            onClick={() => confirmCandidate(candidate)}>
            <MapPin size={14} /> <span>{candidate.label}{candidate.approximate && <span className="pf-note pf-candidate-approximate">{c.approximate}</span>}</span>
          </button>)}</div>
          <div className="pf-google-attribution" translate="no">{c.googleAttribution}</div>
        </div>}
        <div className="pf-fields">
          <div className="pf-control"><label htmlFor="pf-radius">{c.radius}</label><div className="pf-row" style={{ flexWrap: "nowrap" }}>
            <input id="pf-radius" type="range" min={1} max={context.policy.maxRadiusKm} value={radius} disabled={saving} onChange={e => { invalidate(); setRadius(Number(e.target.value)); }} />
            <strong style={{ whiteSpace: "nowrap" }}>{radius} km</strong></div></div>
        </div>
        <div className="pf-row">{(["clinic", "hospital"] as const).map(type => <button key={type} type="button"
          className={`pf-pill${types.includes(type) ? " active" : ""}`} aria-pressed={types.includes(type)} disabled={saving}
          onClick={() => { invalidate(); setTypes(previous => previous.includes(type) ? previous.filter(t => t !== type) : [...previous, type]); }}>
          {type === "clinic" ? <Stethoscope size={13} /> : <Building2 size={13} />}{c[type]}</button>)}
          <button type="button" className={`pf-pill${peopleOnly ? " active" : ""}`} aria-pressed={peopleOnly} disabled={saving}
            onClick={() => { invalidate(); setPeopleOnly(!peopleOnly); }}>{c.people}</button>
        </div>
        {peopleOnly && <div className="pf-control"><label htmlFor="pf-person">{c.personSearch}</label><input id="pf-person" value={personQuery}
          onChange={e => { invalidate(); setPersonQuery(e.target.value); }} maxLength={100} /></div>}
        <div className="pf-view-switch pf-row"><button type="button" className="pf-button" onClick={() => setView("map")}>{c.map}</button></div>
        <p className="pf-note">{publicView ? c.publicHint : c.orderHint}</p>
        {error && <div className="pf-message pf-error" role="alert">{error}</div>}
        {busy && <p role="status">{geoBusy ? c.geocodeWaiting : c.loading}</p>}
        {searched && !busy && <><div className="pf-row pf-space"><strong>{c.results}: {results.length}</strong><span className="pf-note">{radius} km</span></div>
          {!publicView && missing > 0 && <p className="pf-note">{c.missingLocations}: {missing}</p>}
          {results.length ? <div className="pf-result-list">{results.map((row, index) => <div key={`${row.type}:${row.id}`}
            className={`pf-result${selected === `${row.type}:${row.id}` ? " selected" : ""}`}>
            <button type="button" className="pf-result-select"
              onClick={() => pick(`${row.type}:${row.id}`, row.suggestedPersonId || (!publicView ? row.quality?.personId : undefined))} aria-pressed={selected === `${row.type}:${row.id}`}>
              <div className="pf-result-top"><span className="pf-number">{index + 1}</span><div className="pf-result-copy">
                <strong>{row.name}</strong><p className="pf-note">{c[row.type]} · {row.address}, {row.city}</p></div>
                <span className="pf-result-distance">{row.distanceKm.toLocaleString(locale)} km</span></div>
              <div className="pf-row" style={{ marginTop: 8 }}>
                {!publicView && typeof row.cooperating === "boolean" && <span className="pf-tag">{c.cooperation}: {row.cooperating ? c.yes : c.no}</span>}
                {!publicView && typeof row.uploadedContract === "boolean" && <span className="pf-tag">{c.uploadedContract}: {row.uploadedContract ? c.yes : c.no}</span>}
                {!publicView && typeof row.hasRepresentative === "boolean" && <span className="pf-tag">{c.representative}: {row.hasRepresentative ? c.yes : c.no}</span>}
                {!publicView && !row.quality && typeof row.priorityScore === "number" && <span className="pf-tag">{c.priorityScore}: {row.priorityScore}</span>}
                {!publicView && row.recentContact && <span className="pf-tag">{c.recent}</span>}</div>
              {row.people.length > 0 && <p className="pf-note" style={{ marginTop: 5 }}>{row.people.map(p => p.name).join(" · ")}</p>}
            </button>
            {!publicView && row.quality && <div className="pf-quality-result">
                <div className="pf-row pf-quality-result-head">
                  <span className={`pf-tier pf-tier-${row.quality.tier}`}>{c[row.quality.tier]}</span>
                  <span className="pf-quality-score">{row.quality.score}<small>/100</small> · {c.score}</span>
                </div>
                {row.quality.tier === "recommended" && row.quality.notNearest && <p className="pf-not-nearest">{c.notNearest}</p>}
                <details className="pf-quality-details">
                  <summary>{c.qualityDetails}</summary>
                  <div className="pf-quality-source">{row.quality.personName
                    ? <><strong>{c.evidenceForPerson}</strong> {row.quality.personName}</>
                    : <strong>{c.evidenceAtFacility}</strong>}</div>
                  <div className="pf-evidence-grid">
                    {finderCriteria.filter(key => row.quality?.matched.includes(key)).length > 0 && <div>
                      <strong>{c.matched}</strong><ul>{row.quality.matched.map(key => <li key={key}>{c[qualityCriterionLabel(key)]}</li>)}</ul>
                    </div>}
                    {finderCriteria.filter(key => row.quality?.missing.includes(key)).length > 0 && <div>
                      <strong>{c.missing}</strong><ul>{row.quality.missing.map(key => <li key={key}>{c[qualityCriterionLabel(key)]}</li>)}</ul>
                    </div>}
                    {finderCriteria.filter(key => row.quality?.unknown.includes(key)).length > 0 && <div>
                      <strong>{c.unknown}</strong><ul>{row.quality.unknown.map(key => <li key={key}>{c[qualityCriterionLabel(key)]}</li>)}</ul>
                    </div>}
                  </div>
                  <div className="pf-breakdown"><strong>{c.score}</strong>
                    {row.quality.breakdown.map((item, itemIndex) => <span key={`${item.criterion}-${itemIndex}`}>
                      {item.criterion === "distance" ? c.distance : c[item.criterion]} · {item.points.toLocaleString(locale, { maximumFractionDigits: 1 })} {c.points}
                    </span>)}
                  </div>
                </details>
              </div>}
          </div>)}</div> : <div className="pf-empty"><MapPin size={24} /><strong>{c.empty}</strong>
            {radius < context.policy.maxRadiusKm && <button type="button" className="pf-button" onClick={() => {
              invalidate(); setRadius(Math.min(context.policy.maxRadiusKm, radius + 25));
            }}>{c.expand} · {Math.min(context.policy.maxRadiusKm, radius + 25)} km</button>}</div>}
        </>}
      </section>
      {candidates.length === 0 && <section className={`pf-panel${view === "list" ? " pf-hide-mobile" : ""}`} aria-label={c.map}>
        <div className="pf-row pf-space"><div><div className="pf-kicker">{c.origin}</div><strong>{originLabel || c.confirmAddress}</strong></div>
          <button type="button" className="pf-button pf-view-switch" onClick={() => setView("list")}>{c.list}</button></div>
        {point && (desktop || view === "map") ? <ProviderMap point={point} results={results} prefix={prefix} selected={selected} onSelect={pick} c={c} />
          : <div className="pf-empty" style={{ flex: 1 }}><MapPin size={28} /><p>{c.confirmAddress}</p></div>}
        <p className="pf-note">{c.radius}</p>
      </section>}
    </div>
    <footer className="pf-modal-foot"><div className="pf-stack" style={{ gap: 4 }}>
       <strong>{current?.name || c.select}</strong><span className="pf-note">{missingRequiredPerson ? c.suggestedPersonRequired : c.publicHint}</span>
      {current && (current.publicPhone || current.publicEmail) && <p className="pf-note">{[current.publicPhone, current.publicEmail].filter(Boolean).join(" · ")}</p>}
      {current && current.people.length > 0 && <div className="pf-control"><label htmlFor="pf-selected-person">{c.people}</label>
        <select id="pf-selected-person" value={selectedPerson} disabled={saving} onChange={e => setSelectedPerson(e.target.value)}>
          <option value="">{c.all}</option>{current.people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
    </div><button type="button" className="pf-button primary" disabled={!current || busy || saving || missingRequiredPerson} onClick={() => void confirm()}>
      {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}{c.select}</button></footer>
  </section>;
}
