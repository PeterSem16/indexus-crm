import { useState } from "react";
import {
  Activity, ArrowRight, ChevronDown, ChevronRight, CircleAlert, Clock3, Globe2,
  History, Plus, RotateCcw, Search, Settings2, ShieldCheck, SlidersHorizontal,
  Tag, Trash2, Workflow, X,
} from "lucide-react";
import {
  actionLabels, conditionLabel, countryLabel, eventLabels, hasErrors, isReviewLocked,
  moduleLabels, whenLabel, type PrototypeRule,
} from "./_fixtures";
import { PrototypeDialog, PrototypeLegacyReview, usePrototypeRules } from "./_prototype";
import "./_group.css";
import "./_elegant-list.css";

const actionNames = (rule: PrototypeRule) =>
  rule.actions.map(action => actionLabels[action.type] || action.type).join(" · ") || "Bez akcií";

export function ElegantList() {
  const model = usePrototypeRules();
  const [expanded, setExpanded] = useState<string[]>([]);
  const flipExpanded = (id: string) => setExpanded(current =>
    current.includes(id) ? current.filter(item => item !== id) : [...current, id],
  );
  const resetFilters = () => {
    model.setQuery("");
    model.setCountry("all");
    model.setStatus("all");
  };

  return (
    <main className="elegant-rules">
      <header className="el-topbar">
        <div className="el-brand">
          <span className="el-mark" aria-hidden="true">i</span>
          <span>INDEXUS <i>/</i> Automatizácie</span>
        </div>
        <div className="el-top-note"><span className="el-live-dot" /> Prevádzkový prehľad</div>
      </header>

      <div className="el-shell">
        <div className="el-heading">
          <div>
            <div className="el-eyebrow"><Settings2 size={14} /> PRAVIDLÁ AUTOMATIZÁCIÍ</div>
            <h1>Pravidlá, ktoré pracujú<br className="el-mobile-break" /> za váš tím.</h1>
            <p>Jasný prehľad spúšťačov a ich dosahu naprieč klinikami.</p>
          </div>
          <div className="el-header-actions">
            <button className="el-button el-button-secondary" onClick={() => model.dispatch("tags")} aria-label="Otvoriť prehľad štítkov záznamov">
              <Tag size={15} /> Prehľad štítkov
            </button>
            <button className="el-button el-button-primary" onClick={() => model.dispatch("create")}>
              <Plus size={16} /> Pridať pravidlo
            </button>
          </div>
        </div>

        <nav className="el-tabs" aria-label="Sekcie automatizácií">
          <span>Služby</span>
          <span>AI návrh</span>
          <button type="button" className="is-current" aria-current="page">Pravidlá <span>{model.rules.length}</span></button>
          <button type="button" onClick={() => model.dispatch("history")}>História spustení <ArrowRight size={13} /></button>
        </nav>

        <section className="el-summary" aria-label="Súhrn pravidiel">
          <div className="el-summary-lead">
            <span className="el-summary-icon"><Activity size={18} /></span>
            <div><b>Vaše automatizácie</b><small>Na jednom mieste, bez technických skratiek.</small></div>
          </div>
          <div className="el-summary-stat"><strong>{model.rules.filter(rule => rule.enabled).length}</strong><span>zapnuté</span></div>
          <div className="el-summary-stat el-stat-alert"><strong>{model.rules.filter(hasErrors).length}</strong><span>vyžadujú pozornosť</span></div>
          <div className="el-summary-stat"><strong>{model.rules.filter(isReviewLocked).length}</strong><span>čaká na kontrolu</span></div>
        </section>

        <section className="el-workspace" aria-label="Zoznam pravidiel">
          <div className="el-list-heading">
            <div>
              <h2>Všetky pravidlá <span>{model.filteredRules.length}</span></h2>
              <p>Rozbaľte riadok pre úplný priebeh a bezpečné akcie.</p>
            </div>
            <div className="el-view-label"><SlidersHorizontal size={14} /> PREHĽAD</div>
          </div>

          <div className="el-filters">
            <label className="el-search">
              <Search size={16} aria-hidden="true" />
              <input value={model.query} onChange={event => model.setQuery(event.target.value)} placeholder="Hľadať pravidlo, spúšťač…" aria-label="Hľadať pravidlá" />
              {model.query && <button type="button" onClick={() => model.setQuery("")} aria-label="Vymazať vyhľadávanie"><X size={14} /></button>}
            </label>
            <label className="el-select-wrap">
              <Globe2 size={15} aria-hidden="true" />
              <select value={model.country} onChange={event => model.setCountry(event.target.value)} aria-label="Filtrovať podľa krajiny">
                <option value="all">Všetky krajiny</option>
                <option value="SK">Slovensko</option><option value="CZ">Česko</option><option value="HU">Maďarsko</option>
              </select>
            </label>
            <label className="el-select-wrap el-status-select">
              <select value={model.status} onChange={event => model.setStatus(event.target.value)} aria-label="Filtrovať podľa stavu">
                <option value="all">Všetky stavy</option>
                <option value="enabled">Zapnuté</option><option value="disabled">Vypnuté</option>
                <option value="issues">S chybou</option><option value="review">Čaká na kontrolu</option>
              </select>
            </label>
            {(model.query || model.country !== "all" || model.status !== "all") && (
              <button className="el-clear-filters" onClick={resetFilters}>Vymazať filtre</button>
            )}
          </div>

          <div className="el-column-head" aria-hidden="true">
            <span>PRAVIDLO</span><span>ROZSAH</span><span>SPUSTÍ SA PRI</span><span>STAV</span><span />
          </div>

          <div className="el-rows">
            {model.filteredRules.map(rule => {
              const isOpen = expanded.includes(rule.id);
              const locked = isReviewLocked(rule);
              const errored = hasErrors(rule);
              const trigger = whenLabel(rule);
              return (
                <article className={`el-rule ${isOpen ? "is-expanded" : ""} ${errored ? "has-error" : ""}`} key={rule.id} data-rule-id={rule.id}>
                  <div className="el-row">
                    <div className="el-rule-identity">
                      <button className="el-expand" onClick={() => flipExpanded(rule.id)} aria-label={`${isOpen ? "Zbaliť" : "Rozbaliť"} pravidlo ${rule.name}`} aria-expanded={isOpen}>
                        {isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                      </button>
                      <div className="el-rule-copy">
                        <div className="el-name-line">
                          <h3>{rule.name}</h3>
                          {rule.isSystem && <span className="el-system"><ShieldCheck size={11} /> Systémové</span>}
                        </div>
                        <p>{rule.description || moduleLabels[rule.module] || rule.module}</p>
                        <span className="el-module">{moduleLabels[rule.module] || rule.module}</span>
                      </div>
                    </div>
                    <div className="el-country" title={countryLabel(rule)}>
                      <Globe2 size={14} /><span>{countryLabel(rule)}</span>
                    </div>
                    <div className="el-trigger">
                      <span className="el-trigger-dot" />
                      <span>{trigger}</span>
                    </div>
                    <div className="el-status">
                      {errored ? (
                        <span className="el-status-pill status-error"><CircleAlert size={13} />{rule.disabledReason ? "Pozastavené" : `${rule.consecutiveErrorCount} chyby`}</span>
                      ) : locked ? (
                        <span className="el-status-pill status-review"><Clock3 size={13} />Kontrola</span>
                      ) : (
                        <button className={`el-status-pill ${rule.enabled ? "status-on" : "status-off"}`} onClick={() => model.dispatch("toggle", rule)} aria-label={`${rule.enabled ? "Vypnúť" : "Zapnúť"} pravidlo ${rule.name}`} aria-pressed={rule.enabled}>
                          <span className="el-status-led" />{rule.enabled ? "Zapnuté" : "Vypnuté"}
                        </button>
                      )}
                    </div>
                    <button className="el-row-open" onClick={() => flipExpanded(rule.id)} aria-label={`${isOpen ? "Zbaliť" : "Zobraziť podrobnosti"} pravidla ${rule.name}`}>
                      <span>{isOpen ? "Zbaliť" : "Podrobnosti"}</span>{isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                  </div>

                  {rule.disabledReason && <div className="el-alert-line"><CircleAlert size={14} /><span><b>Automaticky pozastavené:</b> {rule.disabledReason}</span></div>}
                  {!rule.disabledReason && rule.lastErrorMessage && <div className="el-alert-line el-alert-soft"><CircleAlert size={14} /><span><b>{rule.consecutiveErrorCount} po sebe idúce chyby</b> · {rule.lastErrorMessage}</span></div>}

                  {isOpen && (
                    <div className="el-details">
                      <div className="el-flow-preview">
                        <div className="el-flow-step"><span className="el-step-key">KEDY</span><b>{trigger}</b><small>{rule.trigger?.eventType ? eventLabels[rule.trigger.eventType] || rule.trigger.eventType : "Plánované spustenie"}</small></div>
                        <div className="el-flow-connector" />
                        <div className="el-flow-step"><span className="el-step-key">AK</span><b>{conditionLabel(rule)}</b><small>{rule.conditions ? "Podmienky musia platiť" : "Bez ďalšieho filtrovania"}</small></div>
                        <div className="el-flow-connector" />
                        <div className="el-flow-step el-step-then"><span className="el-step-key">POTOM</span><b>{actionNames(rule)}</b><small>{rule.actions.length} {rule.actions.length === 1 ? "akcia" : "akcie"}</small></div>
                        <div className="el-flow-connector el-else-connector" />
                        <div className="el-flow-step el-step-else"><span className="el-step-key">INAK</span><b>{rule.trigger?.noMatchActions?.length ? actionNames({ ...rule, actions: rule.trigger.noMatchActions }) : "Zastaviť"}</b><small>Ak podmienka neplatí</small></div>
                      </div>
                      <div className="el-detail-meta">
                        <span><Globe2 size={13} /> {countryLabel(rule)}</span>
                        <span><Settings2 size={13} /> {moduleLabels[rule.module] || rule.module}</span>
                        {rule.rateLimitPerHour && <span><Clock3 size={13} /> Limit {rule.rateLimitPerHour}/h</span>}
                        <span>Upravené {new Date(rule.updatedAt).toLocaleDateString("sk-SK", { day: "numeric", month: "short", year: "numeric" })}</span>
                      </div>
                      <div className="el-detail-footer">
                        {locked && <button className="el-button el-button-review" onClick={() => model.dispatch("review", rule)}>Skontrolovať a aktivovať <ArrowRight size={14} /></button>}
                        <div className="el-row-actions">
                          {errored && <button className="el-action-button" onClick={() => model.dispatch("reset", rule)}><RotateCcw size={14} /> Resetovať chyby</button>}
                          <button className="el-action-button" onClick={() => model.dispatch("flow", rule)}><Workflow size={14} /> Priebeh</button>
                          <button className="el-action-button" onClick={() => model.dispatch("history", rule)}><History size={14} /> Spustenia</button>
                          <button className="el-action-button" onClick={() => model.dispatch("edit", rule)}>Upraviť</button>
                          {!rule.isSystem && <button className="el-action-button el-action-danger" onClick={() => model.dispatch("delete", rule)} aria-label={`Odstrániť pravidlo ${rule.name}`}><Trash2 size={14} /> Odstrániť</button>}
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
            {model.filteredRules.length === 0 && (
              <div className="el-empty">
                <span><Search size={19} /></span>
                <h3>{model.rules.length ? "Nenašli sa žiadne pravidlá" : "Zatiaľ tu nie sú žiadne pravidlá"}</h3>
                <p>{model.rules.length ? "Skúste zmeniť vyhľadávanie alebo odstrániť niektorý filter." : "Pridajte prvé pravidlo a zautomatizujte opakujúce sa kroky tímu."}</p>
                {model.rules.length ? <button onClick={resetFilters}>Vymazať filtre</button> : <button onClick={() => model.dispatch("create")}><Plus size={14} /> Pridať pravidlo</button>}
              </div>
            )}
          </div>
          <div className="el-list-foot"><span>Zobrazených {model.filteredRules.length} z {model.rules.length} pravidiel</span><span>Údaje v tomto návrhu sú ilustračné.</span></div>
        </section>

        <PrototypeLegacyReview compact />
        {model.notice && <div className="el-toast" role="status">{model.notice}</div>}
        <PrototypeDialog model={model} />
      </div>
    </main>
  );
}
