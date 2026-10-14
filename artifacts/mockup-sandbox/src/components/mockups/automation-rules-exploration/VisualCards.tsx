import { useState } from "react";
import {
  Activity, ArrowDown, ArrowRight, ArrowUpRight, Bell, CalendarClock, Check,
  ChevronDown, CircleAlert, Clock3, FileText, Filter, Globe2, History, Layers3,
  Plus, RotateCcw, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles,
  Tag, Trash2, Workflow, X,
} from "lucide-react";
import {
  actionLabels, conditionLabel, countryLabel, countries, elseLabel, hasErrors, isReviewLocked,
  moduleLabels, whenLabel, type PrototypeRule,
} from "./_fixtures";
import { PrototypeDialog, PrototypeLegacyReview, usePrototypeRules } from "./_prototype";
import "./_group.css";
import "./visual-cards.css";

const statusText = (rule: PrototypeRule) => rule.disabledReason ? "Pozastavené po chybe" : hasErrors(rule) && rule.enabled ? "Chyby · stále aktívne" : rule.enabled ? "Aktívne" : isReviewLocked(rule) ? "Čaká na kontrolu" : "Vypnuté";

export function VisualCards() {
  const model = usePrototypeRules();
  const [expanded, setExpanded] = useState<string[]>([]);
  const resetFilters = () => { model.setQuery(""); model.setCountry("all"); model.setStatus("all"); };
  const toggleExpanded = (id: string) => setExpanded(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  return (
    <main className="vc-shell">
      <header className="vc-topbar">
        <div className="vc-brand"><span className="vc-brand-mark">i</span><span>INDEXUS</span><i>OPERATIONS</i></div>
        <div className="vc-top-right"><span className="vc-env-dot" /> Ukážkové prostredie <span className="vc-avatar">BO</span></div>
      </header>
      <section className="vc-page">
        <div className="vc-heading">
          <div>
            <div className="vc-eyebrow"><Settings2 size={14}/> AUTOMATIZÁCIE <span>/</span> PRAVIDLÁ</div>
            <h1>Pravidlá, ktoré<br className="vc-title-break"/> pracujú za vás.</h1>
            <p className="vc-subtitle">Prehľad automatizácií pre komunikáciu, úlohy a hovory.</p>
          </div>
          <div className="vc-heading-actions">
            <button className="vc-btn vc-btn-outline" onClick={() => model.dispatch("tags")}><Tag size={15}/> Štítky záznamov</button>
            <button className="vc-btn vc-btn-primary" onClick={() => model.dispatch("create")}><Plus size={16}/> Nové pravidlo</button>
          </div>
        </div>

        <div className="vc-nav" role="navigation" aria-label="Sekcie automatizácií">
          <button className="vc-nav-item" onClick={() => model.dispatch("create")}><Layers3 size={15}/> Služby</button>
          <button className="vc-nav-item" onClick={() => model.dispatch("create")}><Sparkles size={15}/> AI návrh</button>
          <button className="vc-nav-item active"><Workflow size={15}/> Pravidlá <span>08</span></button>
          <button className="vc-nav-item" onClick={() => model.dispatch("history")}><History size={15}/> História behov</button>
        </div>

        <div className="vc-summary">
          <div className="vc-summary-copy"><div className="vc-summary-icon"><Activity size={18}/></div><div><strong>Automatizácie v tíme</strong><span>Pravidlá vykonávajú ďalší krok, keď nastane udalosť.</span></div></div>
          <div className="vc-summary-count"><strong>{model.rules.length.toString().padStart(2, "0")}</strong><span>pravidiel v prehľade</span></div>
          <div className="vc-summary-line" />
          <span className="vc-sample-note"><span className="vc-sample-dot"/> ILLUSTRATIVE DATA · iba návrh</span>
        </div>

        <div className="vc-toolbar">
          <label className="vc-search"><Search size={17}/><input value={model.query} onChange={event => model.setQuery(event.target.value)} placeholder="Hľadať podľa názvu, spúšťača…" aria-label="Hľadať pravidlá"/>{model.query && <button aria-label="Vymazať hľadanie" onClick={() => model.setQuery("")}><X size={14}/></button>}</label>
          <div className="vc-filters">
            <label className="vc-select-wrap"><Globe2 size={15}/><select aria-label="Filtrovať podľa krajiny" value={model.country} onChange={event => model.setCountry(event.target.value)}><option value="all">Všetky krajiny</option>{countries.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronDown size={14}/></label>
            <label className="vc-select-wrap"><Filter size={15}/><select aria-label="Filtrovať podľa stavu" value={model.status} onChange={event => model.setStatus(event.target.value)}><option value="all">Všetky stavy</option><option value="enabled">Aktívne</option><option value="disabled">Vypnuté</option><option value="issues">Vyžaduje pozornosť</option><option value="review">Čaká na kontrolu</option></select><ChevronDown size={14}/></label>
            <span className="vc-results">{model.filteredRules.length} pravidiel</span>
          </div>
        </div>

        {model.notice && <div className="vc-notice" role="status"><Check size={15}/>{model.notice}</div>}
        {model.filteredRules.length ? <div className="vc-grid">
          {model.filteredRules.map((rule, index) => {
            const open = expanded.includes(rule.id);
            const locked = isReviewLocked(rule);
            const problem = hasErrors(rule);
            const eventName = rule.trigger.type === "schedule" ? "Každý deň · podľa plánu" : whenLabel(rule);
            const actions = rule.actions.map(item => actionLabels[item.type] || item.type);
            return <article className={`vc-card ${problem ? "has-problem" : ""} ${!rule.enabled ? "is-paused" : ""}`} key={rule.id} data-rule-id={rule.id} style={{ animationDelay: `${index * 45}ms` }}>
              <div className="vc-card-top">
                <div className="vc-module"><span className={`vc-module-icon module-${rule.module}`}><ModuleIcon module={rule.module}/></span><span>{moduleLabels[rule.module] || rule.module}</span></div>
                <div className={`vc-status ${problem ? "status-error" : rule.enabled ? "status-on" : locked ? "status-review" : "status-off"}`}>
                  <i/>{statusText(rule)}
                </div>
              </div>
              <div className="vc-rule-title-row">
                <div><h2>{rule.name}</h2><p className="vc-description">{rule.description}</p></div>
                <button type="button" className={`vc-toggle ${rule.enabled ? "checked" : ""}`} role="switch" aria-checked={rule.enabled} aria-label={`${rule.enabled ? "Vypnúť" : "Zapnúť"} pravidlo: ${rule.name}`} disabled={locked} onClick={() => model.dispatch("toggle", rule)}><span/></button>
              </div>
              {problem && <div className={`vc-issue ${rule.disabledReason ? "critical" : ""}`}><CircleAlert size={15}/><div><strong>{rule.disabledReason || `${rule.consecutiveErrorCount} chyb${rule.consecutiveErrorCount === 1 ? "a" : "y"} za sebou`}</strong>{rule.lastErrorMessage && <span>{rule.lastErrorMessage}</span>}</div>{(rule.disabledReason || rule.consecutiveErrorCount) && <button className="vc-reset" onClick={() => model.dispatch("reset", rule)}><RotateCcw size={13}/> Resetovať</button>}</div>}
              {locked && <div className="vc-review-callout"><ShieldCheck size={16}/><span>Návrh náhrady čaká na kontrolu. Aktivácia je možná až po schválení.</span><button onClick={() => model.dispatch("review", rule)}>Skontrolovať <ArrowRight size={14}/></button></div>}

              <div className="vc-flow">
                <div className="vc-flow-step when"><span className="vc-step-label"><CalendarClock size={13}/> KEĎ</span><strong>{eventName}</strong><small>{countryLabel(rule)}</small></div>
                <span className="vc-flow-connector"><ArrowRight size={15}/></span>
                <div className="vc-flow-step then"><span className="vc-step-label"><ArrowDown size={13}/> POTOM</span><strong>{actions.length ? actions.join(" · ") : "Bez akcie"}</strong><small>{rule.actions.length} {rule.actions.length === 1 ? "krok" : "kroky"}</small></div>
              </div>
              <button className={`vc-detail-trigger ${open ? "opened" : ""}`} aria-expanded={open} onClick={() => toggleExpanded(rule.id)}>
                <span>{open ? "Skryť podrobnosti" : "Zobraziť AK / INAK a ďalšie údaje"}</span><ChevronDown size={16}/>
              </button>
              {open && <div className="vc-details">
                <div className="vc-condition"><span>AK</span><p>{conditionLabel(rule)}</p></div>
                <div className="vc-condition"><span>INAK</span><p>{elseLabel(rule)}</p></div>
                {(rule.trigger.analysis || rule.trigger.metric || rule.trigger.type === "schedule" || rule.rateLimitPerHour) && <div className="vc-condition"><span>SPÚŠŤAČ</span><p>{rule.trigger.analysis ? `Analýza ${rule.trigger.analysis.channels?.join(", ") || "obsahu"}${rule.trigger.analysis.analyzeAttachments ? " aj príloh" : ""}` : rule.trigger.metric ? `Hranica: ${rule.trigger.metric.threshold} · čakajúce laboratórne výsledky` : rule.trigger.type === "schedule" ? `Plán: ${rule.trigger.interval === "daily" ? "každý deň" : rule.trigger.interval || "naplánované"}` : ""}{rule.rateLimitPerHour ? ` · limit ${rule.rateLimitPerHour} za hodinu` : ""}</p></div>}
                <div className="vc-meta"><span><Globe2 size={13}/>{countryLabel(rule)}</span>{rule.isSystem && <span><ShieldCheck size={13}/>Systémové pravidlo</span>}{rule.trigger.legacySource && <span><FileText size={13}/>Pôvodné pravidlo</span>}<span><Clock3 size={13}/>Upravené {new Date(rule.updatedAt).toLocaleDateString("sk-SK")}</span></div>
                <div className="vc-card-actions">
                  <button onClick={() => model.dispatch("edit", rule)}><SlidersHorizontal size={14}/> Upraviť</button>
                  <button onClick={() => model.dispatch("flow", rule)}><Workflow size={14}/> Priebeh</button>
                  <button onClick={() => model.dispatch("history", rule)}><History size={14}/> História</button>
                  {!rule.isSystem && <button className="delete" aria-label={`Odstrániť pravidlo ${rule.name}`} onClick={() => model.dispatch("delete", rule)}><Trash2 size={14}/> Odstrániť</button>}
                </div>
              </div>}
            </article>;
          })}
        </div> : <div className="vc-empty"><div className="vc-empty-mark"><Search size={22}/></div><h2>Nič sme nenašli</h2><p>Skúste upraviť hľadanie alebo filtre a zobrazte všetky pravidlá.</p><button onClick={resetFilters}>Vymazať filtre</button></div>}
        <PrototypeLegacyReview compact/>
        <footer className="vc-footer"><span>INDEXUS <b>·</b> Automatizácie</span><span>Údaje na tejto obrazovke sú ilustračné a nič nespúšťajú.</span><button onClick={() => model.dispatch("history")}>História behov <ArrowUpRight size={13}/></button></footer>
      </section>
      <PrototypeDialog model={model}/>
    </main>
  );
}

function ModuleIcon({ module }: { module: string }) {
  if (module === "communication") return <Bell size={16}/>;
  if (module === "task") return <Check size={16}/>;
  if (module === "clinic") return <Layers3 size={16}/>;
  return <Activity size={16}/>;
}
