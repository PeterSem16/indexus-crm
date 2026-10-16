import { useEffect, useRef, useState } from "react";
import { Check, MapPin, Search, X, Navigation, Building2, Stethoscope, Loader2 } from "lucide-react";
import type { FinderContext, FinderPoint, FinderResult, FinderSelection } from "@shared/provider-finder";
import type { Locale } from "@/i18n";
import { providerFinderTranslations } from "@/i18n/provider-finder-translations";
import { ProviderMap } from "./ProviderMap";
import { finderApi } from "./api";
import "./provider-finder.css";

type Candidate = { label: string; point: FinderPoint; approximate: boolean };
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
  const [service, setService] = useState("");
  const [radius, setRadius] = useState(context.policy.defaultRadiusKm);
  const [types, setTypes] = useState<("clinic" | "hospital")[]>(["clinic", "hospital"]);
  const [peopleOnly, setPeopleOnly] = useState(false);
  const [personQuery, setPersonQuery] = useState("");
  const [results, setResults] = useState<FinderResult[]>([]);
  const [missing, setMissing] = useState(0);
  const [selected, setSelected] = useState("");
  const [selectedPerson, setSelectedPerson] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const generation = useRef(0);
  const onInvalidateRef = useRef(onInvalidate); onInvalidateRef.current = onInvalidate;
  const invalidate = () => {
    generation.current++; setSelected(""); setSelectedPerson(""); setResults([]);
    setSearched(false); setError(""); setBusy(false); onInvalidateRef.current?.();
  };
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => {
    setAddress(initialAddress); setPoint(null); setOriginLabel(""); setCandidates([]);
    setRadius(context.policy.defaultRadiusKm); setService(""); invalidate(); setBusy(false);
  }, [context.billingCompanyId, context.country, initialAddress]);
  const errorMessage = (e: { code?: string }) => e.code === "maps_not_configured" ? c.mapsMissing : c.error;
  async function searchAt(origin: FinderPoint) {
    const request = ++generation.current; setBusy(true); setError(""); setSelected(""); setSelectedPerson("");
    onInvalidateRef.current?.();
    try {
      const response = await finderApi<{ results: FinderResult[]; missingLocations?: number }>(`${prefix}/search`, "POST",
        { point: origin, radiusKm: radius, service, types, peopleOnly, personQuery });
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
  }, [point, radius, service, types, peopleOnly, personQuery]);
  async function geocode() {
    invalidate(); setPoint(null); setCandidates([]); setOriginLabel("");
    const request = ++generation.current; setBusy(true);
    try {
      const response = await finderApi<{ candidates: Candidate[] }>(`${prefix}/geocode`, "POST", { address, language: locale });
      if (request !== generation.current) return;
      setCandidates(response.candidates);
      if (!response.candidates.length) setError(c.empty);
      // Even one match requires explicit confirmation; never guess an ambiguous or approximate address.
    } catch (e) { if (request === generation.current) setError(errorMessage(e as any)); }
    finally { if (request === generation.current) setBusy(false); }
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
  const current = results.find(r => `${r.type}:${r.id}` === selected);
  function pick(key: string) { setSelected(key); setSelectedPerson(""); setError(""); }
  async function confirm() {
    if (!current || busy || saving) return;
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
    <div className="pf-modal-body">
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
        {candidates.length > 0 && <div className="pf-stack" aria-label={c.confirmAddress}>
          <strong>{c.confirmAddress}</strong>
          {candidates.map((candidate, index) => <button type="button" className="pf-result" key={index} onClick={() => {
            invalidate(); setPoint(candidate.point); setOriginLabel(address); setCandidates([]);
          }}><MapPin size={14} /> {candidate.label}{candidate.approximate && <p className="pf-note">{c.approximate}</p>}</button>)}
        </div>}
        <div className="pf-fields">
          <div className="pf-control"><label htmlFor="pf-service">{c.service}</label><select id="pf-service" value={service} disabled={saving} onChange={e => {
            invalidate(); setService(e.target.value);
          }}><option value="">{c.all}</option>{context.policy.services.map(s => <option key={s}>{s}</option>)}</select></div>
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
        {busy && <p role="status">{c.loading}</p>}
        {searched && !busy && <><div className="pf-row pf-space"><strong>{c.results}: {results.length}</strong><span className="pf-note">{radius} km</span></div>
          {!publicView && missing > 0 && <p className="pf-note">{c.missingLocations}: {missing}</p>}
          {results.length ? <div className="pf-result-list">{results.map((row, index) => <div key={`${row.type}:${row.id}`}>
            <button type="button" className={`pf-result${selected === `${row.type}:${row.id}` ? " selected" : ""}`}
              onClick={() => pick(`${row.type}:${row.id}`)} aria-pressed={selected === `${row.type}:${row.id}`}>
              <div className="pf-result-top"><span className="pf-number">{index + 1}</span><div className="pf-result-copy">
                <strong>{row.name}</strong><p className="pf-note">{c[row.type]} · {row.address}, {row.city}</p></div>
                <span className="pf-result-distance">{row.distanceKm.toLocaleString(locale)} km</span></div>
              <div className="pf-row" style={{ marginTop: 8 }}>
                {row.contracted && <span className="pf-tag">{c.contracted}</span>}{row.recentContact && <span className="pf-tag">{c.recent}</span>}
                {row.services.map(s => <span className="pf-tag" key={s}>{s}</span>)}</div>
              {row.people.length > 0 && <p className="pf-note" style={{ marginTop: 5 }}>{row.people.map(p => p.name).join(" · ")}</p>}
            </button>
          </div>)}</div> : <div className="pf-empty"><MapPin size={24} /><strong>{c.empty}</strong>
            {radius < context.policy.maxRadiusKm && <button type="button" className="pf-button" onClick={() => {
              invalidate(); setRadius(Math.min(context.policy.maxRadiusKm, radius + 25));
            }}>{c.expand} · {Math.min(context.policy.maxRadiusKm, radius + 25)} km</button>}</div>}
        </>}
      </section>
      <section className={`pf-panel${view === "list" ? " pf-hide-mobile" : ""}`} aria-label={c.map}>
        <div className="pf-row pf-space"><div><div className="pf-kicker">{c.origin}</div><strong>{originLabel || c.confirmAddress}</strong></div>
          <button type="button" className="pf-button pf-view-switch" onClick={() => setView("list")}>{c.list}</button></div>
        {point ? <ProviderMap point={point} results={results} prefix={prefix} selected={selected} onSelect={pick} c={c} />
          : <div className="pf-empty" style={{ flex: 1 }}><MapPin size={28} /><p>{c.confirmAddress}</p></div>}
        <p className="pf-note">{c.radius}</p>
      </section>
    </div>
    <footer className="pf-modal-foot"><div className="pf-stack" style={{ gap: 4 }}>
      <strong>{current?.name || c.select}</strong><span className="pf-note">{c.publicHint}</span>
      {current && (current.publicPhone || current.publicEmail) && <p className="pf-note">{[current.publicPhone, current.publicEmail].filter(Boolean).join(" · ")}</p>}
      {current && current.people.length > 0 && <div className="pf-control"><label htmlFor="pf-selected-person">{c.people}</label>
        <select id="pf-selected-person" value={selectedPerson} disabled={saving} onChange={e => setSelectedPerson(e.target.value)}>
          <option value="">{c.all}</option>{current.people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
    </div><button type="button" className="pf-button primary" disabled={!current || busy || saving} onClick={() => void confirm()}>
      {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}{c.select}</button></footer>
  </section>;
}
