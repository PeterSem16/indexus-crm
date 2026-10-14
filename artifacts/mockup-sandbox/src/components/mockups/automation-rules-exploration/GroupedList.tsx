import { useMemo, useState } from "react";
import {
  ArrowDown, ArrowRightLeft, Building2, Check, ChevronDown, CircleAlert,
  Clock3, History, ListFilter, Mail, Phone, Plus, Search,
  ShieldCheck, SlidersHorizontal, Tag, Trash2, Wrench,
} from "lucide-react";
import {
  actionLabels, conditionLabel, countryLabel, hasErrors,
  isReviewLocked, whenLabel, type PrototypeRule,
} from "./_fixtures";
import { PrototypeDialog, PrototypeLegacyReview, usePrototypeRules } from "./_prototype";
import "./_group.css";
import "./grouped-list.css";

const GROUPS = [
  { key: "communication", label: "Komunikácia", hint: "Správy a nálada klientov", icon: Mail },
  { key: "task", label: "Úlohy", hint: "Priradenie, termíny a prehľady", icon: ListFilter },
  { key: "clinic", label: "Kliniky", hint: "Udalosti v klinickej sieti", icon: Building2 },
  { key: "call", label: "Hovory", hint: "Nadväzujúci kontakt", icon: Phone },
];

export function GroupedList() {
  const model = usePrototypeRules();
  const [folded, setFolded] = useState<string[]>([]);
  const [details, setDetails] = useState<string[]>([]);
  const counts = useMemo(() => Object.fromEntries(GROUPS.map(group => [
    group.key, model.rules.filter(rule => rule.module === group.key).length,
  ])), [model.rules]);
  const filteredGroups = GROUPS.map(group => ({
    ...group,
    rules: model.filteredRules.filter(rule => rule.module === group.key),
  }));
  const total = model.filteredRules.length;

  const toggleFold = (key: string) =>
    setFolded(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key]);
  const toggleDetail = (id: string) =>
    setDetails(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const jumpToGroup = (key: string) => {
    const node = document.getElementById(`grl-group-${key}`);
    node?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFolded(current => current.filter(item => item !== key));
  };
  const deleteRule = (rule: PrototypeRule) => {
    if (!rule.isSystem) model.dispatch("delete", rule);
  };

  return <main className="grl">
    <div className="grl-topline" />
    <div className="grl-wrap">
      <header className="grl-header">
        <div>
          <div className="grl-brand"><span className="grl-mark">IX</span> INDEXUS <span style={{ color: "#b6a9ad", fontWeight: 500, letterSpacing: ".08em" }}>· BACK OFFICE</span></div>
          <p className="grl-eyebrow">Prevádzka komunikácie</p>
          <h1 className="grl-display">Pravidlá automatizácie</h1>
          <p className="grl-subtitle">Pravidlá sú usporiadané podľa oblasti, v ktorej pracujú. Rýchlejšie nájdete správu, úlohu aj kliniku — bez straty kontextu spúšťača.</p>
        </div>
        <div className="grl-head-actions">
          <button className="grl-btn" onClick={() => model.dispatch("tags")} data-testid="button-record-tag-overview">
            <Tag size={14} /> Štítky záznamov
          </button>
          <button className="grl-btn grl-btn-primary" onClick={() => model.dispatch("create")} data-testid="button-create-rule">
            <Plus size={15} /> Vybrať automatizáciu
          </button>
        </div>
      </header>

      <nav className="grl-tabs" aria-label="Sekcie automatizácie">
        <button className="grl-tab" onClick={() => model.dispatch("create")}>Služby</button>
        <button className="grl-tab" onClick={() => model.dispatch("create")}>AI návrh</button>
        <button className="grl-tab active" aria-current="page">Pravidlá <span aria-label={`${model.rules.length} pravidiel`}>· {model.rules.length}</span></button>
        <button className="grl-tab" onClick={() => model.dispatch("history")}><History size={13} style={{ verticalAlign: "-2px" }} /> História behov</button>
      </nav>

      <section className="grl-toolbar" aria-label="Hľadať a filtrovať pravidlá">
        <div className="grl-countline">
          <span className="grl-count">{total} {total === 1 ? "pravidlo" : "pravidiel"}</span>
          <span>z {model.rules.length} celkom</span>
          {model.status !== "all" && <span>· {model.status === "issues" ? "s chybami" : model.status === "review" ? "čaká na kontrolu" : model.status === "enabled" ? "aktívne" : "pozastavené"}</span>}
        </div>
        <div className="grl-filters">
          <label className="grl-search">
            <Search size={14} aria-hidden="true" />
            <input className="grl-input" aria-label="Hľadať pravidlá" placeholder="Hľadať podľa názvu alebo spúšťača" value={model.query} onChange={event => model.setQuery(event.target.value)} />
          </label>
          <select className="grl-select" aria-label="Filtrovať podľa krajiny" value={model.country} onChange={event => model.setCountry(event.target.value)}>
            <option value="all">Všetky krajiny</option>
            <option value="SK">Slovensko</option><option value="CZ">Česko</option><option value="HU">Maďarsko</option>
          </select>
          <select className="grl-select" aria-label="Filtrovať podľa stavu" value={model.status} onChange={event => model.setStatus(event.target.value)}>
            <option value="all">Všetky stavy</option><option value="enabled">Aktívne</option><option value="disabled">Pozastavené</option><option value="issues">Problémy</option><option value="review">Čaká na kontrolu</option>
          </select>
        </div>
      </section>

      <div className="grl-layout">
        <aside className="grl-aside" aria-label="Skupiny pravidiel">
          <div className="grl-aside-title">Oblasti pravidiel</div>
          {GROUPS.map(group => {
            const Icon = group.icon;
            return <button key={group.key} className="grl-group-nav" onClick={() => jumpToGroup(group.key)} aria-label={`Prejsť na ${group.label}, ${counts[group.key]} pravidiel`}>
              <span className="grl-nav-dot" /><Icon size={14} /><span>{group.label}</span><span className="grl-nav-count">{counts[group.key]}</span>
            </button>;
          })}
          <div className="grl-aside-note">Skupiny vychádzajú z modulu pravidla. Nejde o vlastné priečinky.</div>
        </aside>

        <section className="grl-groups" aria-label="Pravidlá podľa oblasti">
          {filteredGroups.filter(group => group.rules.length > 0).map(group => {
            const Icon = group.icon;
            const isOpen = !folded.includes(group.key);
            return <section key={group.key} id={`grl-group-${group.key}`} className="grl-group" aria-expanded={isOpen}>
              <button className="grl-group-head" onClick={() => toggleFold(group.key)} aria-expanded={isOpen} aria-controls={`grl-list-${group.key}`}>
                <span className="grl-group-icon"><Icon size={16} /></span>
                <span className="grl-group-heading"><span className="grl-group-name">{group.label}</span><span className="grl-group-caption">{group.hint}</span></span>
                <span className="grl-group-total">{group.rules.length} {group.rules.length === 1 ? "pravidlo" : "pravidiel"}</span>
                <ChevronDown className="grl-caret" size={16} />
              </button>
              {isOpen && <div className="grl-rule-list" id={`grl-list-${group.key}`}>
                {group.rules.map(rule => {
                  const locked = isReviewLocked(rule);
                  const issue = hasErrors(rule);
                  const expanded = details.includes(rule.id);
                  const countriesText = countryLabel(rule);
                  const thenText = rule.actions.map(action => actionLabels[action.type] || action.type).join(" · ") || "Bez akcií";
                  return <article key={rule.id} className="grl-rule" data-rule-id={rule.id} data-testid={`card-rule-${rule.id}`}>
                    <div className="grl-rule-top">
                      <div className="grl-rule-main">
                        <div className="grl-rule-title-row">
                          <h2 className="grl-rule-title">{rule.name}</h2>
                          {rule.isSystem && <span className="grl-chip"><ShieldCheck size={11} /> Systémové</span>}
                          {rule.trigger?.legacySource && <span className="grl-chip amber">Pôvodný zdroj</span>}
                          {issue && <span className="grl-status alert"><CircleAlert size={11} /> {rule.disabledReason ? "Vypnuté po chybách" : `${rule.consecutiveErrorCount} chyby`}</span>}
                          {!issue && <span className={`grl-status ${rule.enabled ? "" : "off"}`}><span aria-hidden="true">{rule.enabled ? "●" : "○"}</span>{rule.enabled ? "Aktívne" : "Pozastavené"}</span>}
                        </div>
                        {rule.description && <p className="grl-purpose">{rule.description}</p>}
                        {rule.disabledReason && <div className="grl-error"><CircleAlert size={13} /> <span>{rule.disabledReason}{rule.lastErrorMessage ? ` · ${rule.lastErrorMessage}` : ""}</span></div>}
                        {!rule.disabledReason && rule.lastErrorMessage && <div className="grl-error"><CircleAlert size={13} /> <span>Posledná chyba: {rule.lastErrorMessage}</span></div>}
                        <div className="grl-chips">
                          <span className="grl-chip"><Clock3 size={11} /> {whenLabel(rule)}</span>
                          <span className="grl-chip">{countriesText}</span>
                          {rule.isSystem && <span className="grl-chip">Spravované systémom</span>}
                        </div>
                        <div className="grl-actions">
                          <button className="grl-action" onClick={() => toggleDetail(rule.id)} aria-expanded={expanded} aria-label={`${expanded ? "Skryť" : "Zobraziť"} podrobnosti pravidla ${rule.name}`}>
                            <SlidersHorizontal size={12} /> {expanded ? "Skryť podrobnosti" : "KEDY · AK · POTOM"}
                          </button>
                          <button className="grl-action" onClick={() => model.dispatch("edit", rule)} aria-label={`Upraviť pravidlo ${rule.name}`} data-testid={`button-edit-${rule.id}`}><Wrench size={12} /> Upraviť</button>
                          <button className="grl-action" onClick={() => model.dispatch("flow", rule)} aria-label={`Zobraziť priebeh pravidla ${rule.name}`} data-testid={`button-flowchart-${rule.id}`}><ArrowRightLeft size={12} /> Priebeh</button>
                          <button className="grl-action" onClick={() => model.dispatch("history", rule)} aria-label={`Zobraziť históriu pravidla ${rule.name}`} data-testid={`button-history-${rule.id}`}><History size={12} /> Behy</button>
                          {locked && <button className="grl-action" onClick={() => model.dispatch("review", rule)} aria-label={`Skontrolovať a aktivovať ${rule.name}`} data-testid={`button-activate-reviewed-${rule.id}`}><Check size={12} /> Skontrolovať a aktivovať</button>}
                          {issue && <button className="grl-action" onClick={() => model.dispatch("reset", rule)} aria-label={`Resetovať chyby pravidla ${rule.name}`} data-testid={`button-reset-errors-${rule.id}`}><ArrowDown size={12} /> Resetovať chyby</button>}
                          {!rule.isSystem && <button className="grl-action danger" onClick={() => deleteRule(rule)} aria-label={`Odstrániť pravidlo ${rule.name}`} data-testid={`button-delete-${rule.id}`}><Trash2 size={12} /> Odstrániť</button>}
                        </div>
                        {expanded && <div className="grl-detail" aria-label={`Logika pravidla ${rule.name}`}>
                          <div className="grl-detail-cell"><span className="grl-detail-label">KEDY</span><span className="grl-detail-value">{whenLabel(rule)}</span></div>
                          <div className="grl-detail-cell"><span className="grl-detail-label">AK</span><span className="grl-detail-value">{conditionLabel(rule)}</span></div>
                          <div className="grl-detail-cell"><span className="grl-detail-label">POTOM</span><span className="grl-detail-value">{thenText}</span></div>
                          <div className="grl-detail-cell"><span className="grl-detail-label">INAK</span><span className="grl-detail-value">{rule.trigger.noMatchActions?.length ? rule.trigger.noMatchActions.map((action: {type:string}) => actionLabels[action.type] || action.type).join(" · ") : rule.trigger.noMatchRuleId ? "Pokračovať iným pravidlom" : "Zastaviť"}</span></div>
                        </div>}
                      </div>
                      <button className="grl-switch" role="switch" aria-checked={rule.enabled} aria-label={`${rule.enabled ? "Pozastaviť" : "Aktivovať"} pravidlo ${rule.name}`} disabled={locked} title={locked ? "Najprv skontrolujte a aktivujte pôvodné pravidlo" : undefined} onClick={() => model.dispatch("toggle", rule)} data-testid={`switch-enabled-${rule.id}`}><span /></button>
                    </div>
                  </article>;
                })}
              </div>}
            </section>;
          })}
          {total === 0 && <div className="grl-empty">
            <Search size={19} />
            <strong>Nič sme nenašli</strong>
            <span>Skúste zmeniť hľadaný výraz alebo filtre.</span><br />
            <button className="grl-btn" style={{ marginTop: 14 }} onClick={() => { model.setQuery(""); model.setCountry("all"); model.setStatus("all"); }}>Vymazať filtre</button>
          </div>}
        </section>
      </div>

      <div className="grl-review"><PrototypeLegacyReview compact /></div>
      <footer className="grl-foot"><span>Ukážkové údaje · zmeny sa prejavia iba v tomto návrhu</span><span>INDEXUS · Automatizácia</span></footer>
      {model.notice && <div className="grl-notice" role="status">{model.notice}</div>}
      <PrototypeDialog model={model} />
    </div>
  </main>;
}
