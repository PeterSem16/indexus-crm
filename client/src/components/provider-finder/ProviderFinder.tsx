import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, ChevronUp, Crosshair, Hospital, Loader2, MapPin, Navigation, Search, SlidersHorizontal, Stethoscope, X } from "lucide-react";
import type { FinderCriterion } from "@shared/provider-finder";
import type { Locale } from "@/i18n";
import { providerFinderTranslations } from "@/i18n/provider-finder-translations";
import { ProviderMap } from "./ProviderMap";
import { providerKey, useProviderFinder, type ProviderFinderProps } from "./use-provider-finder";
import "./provider-finder.css";
import "./provider-finder-atlas.css";

export function ProviderFinder(props: ProviderFinderProps) {
  const { context, customerName, locale, prefix, publicView = false, onClose } = props;
  const c = providerFinderTranslations[locale as Locale] || providerFinderTranslations.en;
  const f = useProviderFinder(props, c);
  const [details, setDetails] = useState<string[]>([]);
  const [mobilePane, setMobilePane] = useState<"map" | "results">("map");
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 761px)").matches);
  const cards = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => {
    const media = window.matchMedia("(min-width: 761px)");
    const update = () => setDesktop(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => { setDetails([]); setMobilePane("map"); }, [prefix, props.initialAddress]);
  function pick(key: string) {
    f.pick(key);
    if (desktop || mobilePane === "results") cards.current[key]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  const criterionLabel = (key: FinderCriterion) => c[key];
  const initials = customerName?.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join("");

  return <div className={`pf-root atlas-stage pf-live-finder${publicView ? " pf-public" : ""}`} data-testid="provider-finder">
    <section className="atlas-modal" aria-label={c.title} aria-busy={f.busy}>
      <header className="atlas-header">
        <div className="atlas-brand"><span className="atlas-mark" aria-hidden="true">I</span><div>
          <div className="atlas-overline">INDEXUS <span>/</span> {context.country}</div><h1>{c.title}</h1>
        </div></div>
        {customerName && <div className="atlas-header-context"><div className="atlas-customer-icon">{initials}</div>
          <div><strong>{customerName}</strong><span>{context.companyName} · {c.customer}</span></div></div>}
        {onClose && <button className="atlas-close" type="button" aria-label={c.close} onClick={onClose}><X size={18} /></button>}
      </header>
      <section className={`atlas-searchbar${f.editing ? " is-editing" : ""}`}>
        <div className="atlas-origin-block"><span className="atlas-origin-symbol"><MapPin size={16} /></span>
          <div className="atlas-origin-copy"><span className="atlas-eyebrow">{c.origin}</span>
            <strong>{f.originLabel || f.filters.address || c.addressMissing}</strong></div></div>
        <div className="atlas-search-summary"><span><Crosshair size={14} /> {f.filters.radius} km</span>
          <span>{f.filters.types.map(type => c[type]).join(" + ")}</span>
          {f.filters.peopleOnly && <span>{c.people}{f.filters.personQuery ? ` · ${f.filters.personQuery}` : ""}</span>}</div>
        <button type="button" className="atlas-edit-button" disabled={f.saving} aria-expanded={f.editing}
          aria-controls="provider-search-editor" onClick={() => f.editing ? f.setEditing(false) : f.openEditor()}>
          <SlidersHorizontal size={15} />{f.editing ? c.closeEdits : c.editSearch}</button>
        {f.editing && <div className="atlas-edit-panel" id="provider-search-editor" role="region" aria-label={c.editCriteria}>
          <div className="atlas-edit-heading"><div><span className="atlas-eyebrow">{c.searchScope}</span><h2>{c.editCriteria}</h2></div>
            <span className="atlas-notice">{c.addressHint}</span></div>
          <form onSubmit={event => { event.preventDefault(); f.apply(); }}>
            <label className="atlas-field-label" htmlFor="pf-address">{c.address}</label>
            <div className="atlas-address-edit"><MapPin size={16} /><input id="pf-address" value={f.draft.address} maxLength={300} autoFocus
              onChange={event => f.setDraft(previous => ({ ...previous, address: event.target.value }))} placeholder={c.address} disabled={f.saving} /></div>
            <div className="atlas-edit-controls">
              <div className="atlas-radius-edit"><label htmlFor="pf-radius">{c.radius}</label><div>
                <input id="pf-radius" type="range" min={1} max={context.policy.maxRadiusKm} value={f.draft.radius} disabled={f.saving}
                  onChange={event => f.setDraft(previous => ({ ...previous, radius: Number(event.target.value) }))} /><strong>{f.draft.radius} km</strong></div></div>
              <div className="atlas-edit-types"><span className="atlas-field-label">{c.facilityType}</span><div className="atlas-type-options">
                {(["clinic", "hospital"] as const).map(type => <button type="button" key={type}
                  className={f.draft.types.includes(type) ? "active" : ""} aria-pressed={f.draft.types.includes(type)} disabled={f.saving}
                  onClick={() => f.setDraft(previous => ({ ...previous, types: previous.types.includes(type) ? previous.types.filter(item => item !== type) : [...previous.types, type] }))}>
                  {type === "clinic" ? <Stethoscope size={15} /> : <Hospital size={15} />}{c[type]}</button>)}</div></div>
              <div className="atlas-person-edit"><label className="atlas-person-toggle"><input type="checkbox" checked={f.draft.peopleOnly} disabled={f.saving}
                onChange={event => f.setDraft(previous => ({ ...previous, peopleOnly: event.target.checked }))} /><span>{c.peopleOnly}</span></label>
                {f.draft.peopleOnly && <input aria-label={c.personSearch} value={f.draft.personQuery} maxLength={100} disabled={f.saving}
                  onChange={event => f.setDraft(previous => ({ ...previous, personQuery: event.target.value }))} placeholder={c.personSearch} />}</div>
            </div>
            {f.error && <p className="atlas-inline-error" role="alert">{f.error}</p>}
            <div className="atlas-edit-actions"><button type="button" className="atlas-quiet-button" onClick={f.gps} disabled={f.saving}>
              <Navigation size={14} />{c.gps}</button>
              <button type="button" className="atlas-quiet-button" onClick={() => f.setEditing(false)}>{c.cancel}</button>
              <button type="submit" className="atlas-primary-button" disabled={f.saving}>{f.busy ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}{c.applySearch}</button></div>
          </form>
        </div>}
      </section>
      {f.error && !f.editing && <p className="atlas-live-error" role="alert">{f.error}</p>}
      {!context.mapsReady && !f.error && <p className="atlas-live-notice" role="status">{c.mapsMissing}</p>}
      {f.candidates.length ? <section className="atlas-address-confirmation" aria-label={c.confirmAddress}>
        <MapPin size={25} /><h2>{c.confirmAddress}</h2><p>{c.candidateHint}</p>
        <div>{f.candidates.map((candidate, index) => <button type="button" className="atlas-candidate" key={`${candidate.point.lat}:${candidate.point.lng}:${index}`}
          onClick={() => f.confirmCandidate(candidate)} disabled={f.saving}><MapPin size={17} /><span>{candidate.label}
            {candidate.approximate && <small>{c.approximate}</small>}</span><ArrowRight size={16} /></button>)}</div>
        <small className="pf-google-attribution" translate="no">{c.googleAttribution}</small>
      </section> : <>
        <div className="atlas-main">
          <section className={`atlas-map-section${mobilePane === "results" ? " atlas-mobile-hide" : ""}`} aria-label={c.map}>
            <div className="atlas-map-topline"><div><span className="atlas-eyebrow">{c.map}</span><strong>{f.originLabel || f.filters.address || c.addressMissing}</strong></div>
              {f.point && <span className="atlas-map-key"><i />{c.origin}</span>}</div>
            <div className="atlas-map-wrap">
              {f.point && (desktop || mobilePane === "map") ? <ProviderMap prefix={prefix} point={f.point} results={f.results}
                selected={f.selected} onSelect={pick} c={c} locale={locale} showRecommendations={!publicView} />
                : <div className="atlas-map-placeholder" role="status">{f.busy ? <><Loader2 size={24} className="animate-spin" /><span>{c.loading}</span></> : <><MapPin size={26} /><span>{f.error || c.addressRequired}</span>
                  <button type="button" className="atlas-quiet-button" onClick={f.openEditor}>{c.editSearch}</button></>}</div>}
              {f.point && !publicView && <div className="atlas-map-legend"><span><b className="atlas-legend-dot atlas-dot-recommended" />{c.recommended}</span>
                <span><b className="atlas-legend-dot atlas-dot-other" />{c.other}</span></div>}
            </div>
            <div className="atlas-map-bottom"><span><MapPin size={12} />{c.distance} · {f.filters.radius} km</span></div>
          </section>
          <aside className={`atlas-results${mobilePane === "map" ? " atlas-mobile-hide" : ""}`} aria-label={c.results}>
            <div className="atlas-results-head"><div><span className="atlas-eyebrow">{publicView ? c.origin : c.priorityScore}</span><h2>{c.results}</h2></div>
              <span className="atlas-count">{f.busy ? "—" : f.results.length}<small> {c.found}</small></span></div>
            {!publicView && <p className="atlas-score-note" title={c.qualitySafety}><i />{c.rankingSafetyShort}</p>}
            <div className="atlas-result-list" aria-live="polite">
              {f.busy ? <div className="atlas-list-skeleton" role="status" aria-label={c.loading}>
                {[0, 1, 2].map(index => <div className="atlas-card-skeleton" key={index}><span /><span /><span /></div>)}
              </div> : f.results.length ? f.results.map((row, index) => {
                const key = providerKey(row), quality = !publicView ? row.quality : undefined;
                const active = f.selected === key, expanded = details.includes(key);
                return <article key={key} ref={node => { cards.current[key] = node; }}
                  className={`atlas-result-card${active ? " is-selected" : ""}${quality?.tier === "recommended" ? " is-recommended" : ""}`} data-provider-key={key}>
                  <button type="button" className="atlas-card-main" aria-pressed={active} disabled={f.busy || f.saving} onClick={() => pick(key)}>
                    <span className={`atlas-rank${quality?.tier === "recommended" ? " rank-recommended" : ""}`}>{String(index + 1).padStart(2, "0")}</span>
                    <div className="atlas-card-copy"><strong>{row.name}</strong><span>{row.address}, {row.city}</span>
                      <div className="atlas-card-meta">{row.type === "clinic" ? <Stethoscope size={12} /> : <Hospital size={12} />}<span>{c[row.type]}</span>
                        {row.people.length > 0 && <span>{row.people.map(person => person.name).join(" · ")}</span>}</div></div>
                    <span className="atlas-distance">{row.distanceKm.toLocaleString(locale, { maximumFractionDigits: 1 })}<small> km</small></span>
                  </button>
                  {quality && <div className="atlas-evidence-summary">
                    <div className="atlas-tier-score"><span className={`atlas-tier atlas-tier-${quality.tier}`}>{c[quality.tier]}</span>
                      <span className="atlas-score">{quality.score}<small> / 100</small></span><span className="atlas-score-label">{c.score}</span></div>
                    <p className="atlas-evidence-overview">{quality.matched.slice(0, 2).map(criterionLabel).join(" · ") || c.unknown}
                      {quality.matched.length > 2 && <span> · +{quality.matched.length - 2}</span>}</p>
                    <button type="button" className="atlas-evidence-toggle" aria-expanded={expanded}
                      onClick={() => setDetails(previous => previous.includes(key) ? previous.filter(item => item !== key) : [...previous, key])}>
                      {c.qualityDetails}{expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>
                    {expanded && <div className="atlas-evidence-details">
                      <p>{quality.personName ? <><strong>{c.evidenceForPerson}:</strong> {quality.personName}</> : <strong>{c.evidenceAtFacility}</strong>}</p>
                      <div className="atlas-evidence-columns">{(["matched", "missing", "unknown"] as const).map(kind => quality[kind].length ? <div key={kind}>
                        <strong>{c[kind]}</strong><ul>{quality[kind].map(criterion => <li key={criterion}>{criterionLabel(criterion)}</li>)}</ul></div> : null)}</div>
                      <div className="atlas-breakdown"><strong>{c.score}</strong>{quality.breakdown.map((item, itemIndex) => <span key={`${item.criterion}-${itemIndex}`}>
                        {item.criterion === "distance" ? c.distance : c[item.criterion]} · {item.points.toLocaleString(locale, { maximumFractionDigits: 1 })} {c.points}</span>)}</div>
                      {quality.notNearest && <p className="atlas-not-nearest">{c.notNearest}</p>}
                    </div>}
                  </div>}
                  {!publicView && !quality && <div className="atlas-facility-facts">
                    {typeof row.cooperating === "boolean" && <span>{c.cooperation}: {row.cooperating ? c.yes : c.no}</span>}
                    {typeof row.uploadedContract === "boolean" && <span>{c.uploadedContract}: {row.uploadedContract ? c.yes : c.no}</span>}
                    {typeof row.hasRepresentative === "boolean" && <span>{c.representative}: {row.hasRepresentative ? c.yes : c.no}</span>}
                  </div>}
                </article>;
              }) : <div className="atlas-empty"><MapPin size={24} /><strong>{f.searched ? c.empty : f.error || c.confirmAddress}</strong>
                <button type="button" onClick={f.openEditor}>{c.editSearch}</button>
                {f.searched && f.filters.radius < context.policy.maxRadiusKm && <button type="button" onClick={f.expand}>{c.expand} · {Math.min(context.policy.maxRadiusKm, f.filters.radius + 25)} km</button>}</div>}
            </div>
            {!publicView && f.missing > 0 && <p className="atlas-ranking-footnote">{c.missingLocations}: {f.missing}</p>}
            <p className="atlas-ranking-footnote">{publicView ? c.publicHint : c.orderHint}</p>
          </aside>
        </div>
        <nav className="atlas-mobile-nav" aria-label={`${c.map} / ${c.list}`}>
          <button type="button" className={mobilePane === "map" ? "active" : ""} aria-pressed={mobilePane === "map"} onClick={() => setMobilePane("map")}><MapPin size={15} />{c.map}</button>
          <button type="button" className={mobilePane === "results" ? "active" : ""} aria-pressed={mobilePane === "results"} onClick={() => setMobilePane("results")}><Hospital size={15} />{c.results} · {f.results.length}</button>
        </nav>
      </>}
      <footer className={`atlas-footer pf-modal-foot${f.current ? " has-selection" : ""}`}>
        <div className="atlas-selection"><span className="atlas-selection-mark">{f.current ? <Check size={17} /> : <MapPin size={17} />}</span>
          <div className="atlas-selection-copy"><span className="atlas-eyebrow">{f.current ? c.pendingSelection : c.selected}</span>
            <strong>{f.current?.name || c.pickProvider}</strong>
            {f.current && <span>{f.current.address}, {f.current.city} · {f.current.distanceKm.toLocaleString(locale, { maximumFractionDigits: 1 })} km</span>}
            {publicView && f.current && (f.current.publicPhone || f.current.publicEmail) && <span>{[f.current.publicPhone, f.current.publicEmail].filter(Boolean).join(" · ")}</span>}
          </div></div>
        {!!f.current?.people.length && <div className="atlas-doctor-picker"><label htmlFor="pf-selected-person">{c.doctor}</label>
          <select id="pf-selected-person" value={f.selectedPerson} disabled={f.saving} onChange={event => f.setSelectedPerson(event.target.value)}>
            {!f.requiredPerson && <option value="">{c.noPerson}</option>}{f.current.people.map(person => <option value={person.id} key={person.id}>{person.name}</option>)}</select>
          {f.missingPerson && <span>{c.suggestedPersonRequired}</span>}</div>}
        <button type="button" className="atlas-confirm" disabled={!f.canConfirm} onClick={() => void f.confirm()}>
          {f.saving ? <Loader2 size={16} className="animate-spin" /> : null}{c.select}{!f.saving && <ArrowRight size={16} />}</button>
      </footer>
    </section>
  </div>;
}
