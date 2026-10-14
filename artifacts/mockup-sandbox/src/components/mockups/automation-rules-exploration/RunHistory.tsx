import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowUpRight, CalendarDays, Check, ChevronRight, CircleAlert, CircleCheck,
  Clock3, Filter, History, Inbox, Search, SlidersHorizontal, Sparkles,
} from "lucide-react";
import {
  actionLabels, demoRules, eventLabels, moduleLabels, whenLabel,
  type PrototypeRule,
} from "./_fixtures";
import "./_group.css";
import "./run-history.css";

type RunStatus = "completed" | "skipped" | "failed";
type SampleRun = {
  id: string;
  ruleId: string;
  time: string;
  day: "Dnes · 14. októbra" | "Včera · 13. októbra";
  status: RunStatus;
  note: string;
  detail: string;
};

// Explicitly illustrative data for the design proposal—not live production history.
const sampleRuns: SampleRun[] = [
  { id: "sample-741", ruleId: "invoice-inbox", time: "09:41", day: "Dnes · 14. októbra", status: "completed", note: "Podmienka splnená",
    detail: "Správa vyhovela podmienke pravidla. Vo vzorovom priebehu sa vytvorila úloha a správa sa odovzdala tímu." },
  { id: "sample-740", ruleId: "negative-mail", time: "09:35", day: "Dnes · 14. októbra", status: "skipped", note: "Podmienka nebola splnená",
    detail: "Ukážková správa nevyhovela podmienke. Pravidlo preto nevykonalo ďalšiu akciu." },
  { id: "sample-739", ruleId: "task-owner", time: "09:22", day: "Dnes · 14. októbra", status: "completed", note: "Upozornenie pripravené",
    detail: "Vzorový priebeh dospel k akcii „Upozorniť kolegu“. Žiadne skutočné upozornenie sa neodosiela." },
  { id: "sample-738", ruleId: "overdue", time: "09:08", day: "Dnes · 14. októbra", status: "failed", note: "Spojenie so schránkou zlyhalo",
    detail: "Systémová schránka potrebuje opätovné pripojenie. Záznam slúži iba na ukážku spracovania chyby." },
  { id: "sample-737", ruleId: "daily-summary", time: "08:30", day: "Dnes · 14. októbra", status: "completed", note: "Plánovaný priebeh",
    detail: "V ukážke sa spustí naplánované pravidlo a pripraví upozornenie tímu." },
  { id: "sample-736", ruleId: "metric-review", time: "16:18", day: "Včera · 13. októbra", status: "skipped", note: "Čaká na kontrolu",
    detail: "Pôvodný metrický zdroj čaká na výslovné preskúmanie. Návrh ho bezpečne nespúšťa." },
  { id: "sample-735", ruleId: "clinic-welcome", time: "15:47", day: "Včera · 13. októbra", status: "skipped", note: "Pravidlo je vypnuté",
    detail: "Ukážka zaznamenáva vypnuté pravidlo bez odoslania e-mailu." },
];

const statusLabel: Record<RunStatus, string> = {
  completed: "Dokončené",
  skipped: "Preskočené",
  failed: "Chyba",
};
const statusIcon = {
  completed: CircleCheck,
  skipped: Clock3,
  failed: CircleAlert,
};
const actionFor = (rule?: PrototypeRule) => rule?.actions
  .map(action => actionLabels[action.type] || action.type).join(" · ") || "Bez akcie";

export function RunHistory({ onBack }: { onBack?: () => void } = {}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RunStatus | "all">("all");
  const [module, setModule] = useState("all");
  const [selectedId, setSelectedId] = useState(sampleRuns[0].id);
  const [showAll, setShowAll] = useState(false);

  const visibleRuns = useMemo(() => sampleRuns.filter(run => {
    const rule = demoRules.find(item => item.id === run.ruleId);
    const haystack = [rule?.name, rule?.description, run.note, run.detail, rule?.trigger?.eventType]
      .join(" ").toLocaleLowerCase();
    return haystack.includes(search.trim().toLocaleLowerCase())
      && (status === "all" || run.status === status)
      && (module === "all" || rule?.module === module);
  }), [search, status, module]);
  const selected = visibleRuns.find(run => run.id === selectedId) || visibleRuns[0];
  const selectedRule = selected && demoRules.find(rule => rule.id === selected.ruleId);
  const counts = sampleRuns.reduce((result, run) => {
    result[run.status] += 1;
    return result;
  }, { completed: 0, skipped: 0, failed: 0 });
  const days = [...new Set(visibleRuns.map(run => run.day))];
  const resetFilters = () => { setSearch(""); setStatus("all"); setModule("all"); };
  const goBack = onBack || (() => {
    window.location.assign("/__mockup/preview/automation-rules-exploration/ElegantList");
  });

  return (
    <main className="rules-history">
      <header className="rh-topbar">
        <div className="rh-brand">
          <span className="rh-mark" aria-hidden="true">i</span>
          <span>INDEXUS <i>/</i> Automatizácie</span>
        </div>
        <span className="rh-mode"><span className="rh-mode-dot" /> Ukážkový režim</span>
      </header>

      <div className="rh-shell">
        <button className="rh-back" onClick={goBack} aria-label="Späť na pravidlá">
          <ArrowLeft size={15} /> Pravidlá
        </button>
        <section className="rh-heading">
          <div>
            <div className="rh-eyebrow"><History size={14} /> AUTOMATIZÁCIE / PREVÁDZKOVÝ PREHĽAD</div>
            <h1>História, ktorá <span>rozpráva.</span></h1>
            <p>Každý krok aj dôvod — pokojne, prehľadne, bez technických skratiek.</p>
          </div>
          <div className="rh-demo-seal"><Sparkles size={15} /> Iba ukážka</div>
        </section>

        <section className="rh-summary" aria-label="Súhrn ukážkových behov">
          <div className="rh-summary-lead">
            <span className="rh-summary-icon"><CalendarDays size={18} /></span>
            <div><b>Dnešné ukážky</b><small>14. október · názorné, nie živé údaje</small></div>
          </div>
          <div className="rh-stat"><strong>{sampleRuns.length}</strong><span>ukážkových behov</span></div>
          <div className="rh-stat rh-stat-good"><strong>{counts.completed}</strong><span>dokončené</span></div>
          <div className="rh-stat rh-stat-alert"><strong>{counts.failed}</strong><span>na kontrolu</span></div>
        </section>

        <section className="rh-workspace">
          <div className="rh-work-heading">
            <div><h2>Priebeh pravidiel</h2><p>Vyberte riadok pre pokojné zobrazenie detailu.</p></div>
            <span className="rh-count"><History size={13} /> {visibleRuns.length} ukážok</span>
          </div>

          <div className="rh-filters">
            <label className="rh-search">
              <Search size={15} aria-hidden="true" />
              <input value={search} onChange={event => setSearch(event.target.value)}
                placeholder="Hľadať pravidlo alebo priebeh…" aria-label="Hľadať v histórii" />
            </label>
            <label className="rh-select">
              <Filter size={14} aria-hidden="true" />
              <select aria-label="Filtrovať podľa oblasti" value={module} onChange={event => setModule(event.target.value)}>
                <option value="all">Všetky oblasti</option>
                {Object.entries(moduleLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
          </div>

          <div className="rh-status-filters" aria-label="Filtrovať výsledok">
            {(["all", "completed", "skipped", "failed"] as const).map(value => (
              <button key={value} className={status === value ? "is-selected" : ""}
                onClick={() => setStatus(value)} aria-pressed={status === value}>
                {value === "all" ? "Všetky" : statusLabel[value]}
                {value !== "all" && <span>{counts[value]}</span>}
              </button>
            ))}
          </div>

          <div className="rh-content">
            <div className="rh-timeline">
              {days.length > 0 ? days.map(day => (
                <section className="rh-day" key={day}>
                  <h3><span className="rh-day-dot" />{day}</h3>
                  <div className="rh-run-list">
                    {visibleRuns.filter(run => run.day === day).map(run => {
                      const rule = demoRules.find(item => item.id === run.ruleId);
                      const StatusIcon = statusIcon[run.status];
                      const isSelected = selected?.id === run.id;
                      return (
                        <button key={run.id} className={`rh-run ${isSelected ? "is-active" : ""}`}
                          onClick={() => setSelectedId(run.id)} aria-pressed={isSelected} data-run-id={run.id}>
                          <span className={`rh-run-icon ${run.status}`}><StatusIcon size={15} /></span>
                          <span className="rh-run-copy">
                            <b>{rule?.name}</b>
                            <span>{run.note}</span>
                            <small>{rule?.trigger?.eventType ? eventLabels[rule.trigger.eventType] || whenLabel(rule) : whenLabel(rule!)}</small>
                          </span>
                          <span className="rh-run-time">{run.time}<ChevronRight size={14} /></span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )) : (
                <div className="rh-empty">
                  <span><Inbox size={21} /></span>
                  <b>Nič sme nenašli</b>
                  <p>Skúste upraviť hľadanie alebo stav ukážkového behu.</p>
                  <button onClick={resetFilters}>Zobraziť všetky ukážky</button>
                </div>
              )}
            </div>

            <aside className="rh-inspector" aria-label="Detail vybraného behu">
              {selected && selectedRule ? (
                <>
                  <div className="rh-inspector-top"><span><SlidersHorizontal size={15} /></span><small>UKÁŽKOVÝ ZÁZNAM</small></div>
                  <span className={`rh-large-state ${selected.status}`}><span />{statusLabel[selected.status]}</span>
                  <h3>{selectedRule.name}</h3>
                  <p className="rh-inspector-description">{selected.detail}</p>
                  <div className="rh-detail-time"><Clock3 size={14} /> {selected.day} · {selected.time}</div>
                  <div className="rh-detail-steps">
                    <span className={`rh-step-marker ${selected.status}`}><Check size={13} /></span>
                    <div><small>SPÚŠŤAČ</small><b>{whenLabel(selectedRule)}</b></div>
                    <ArrowUpRight size={14} />
                    <div><small>VÝSLEDOK</small><b>{actionFor(selectedRule)}</b></div>
                  </div>
                  {selected.status === "failed" && <div className="rh-recovery"><CircleAlert size={15} /><span>Ďalší krok: skontrolovať pripojenie schránky.</span></div>}
                  <button className="rh-rule-button" onClick={goBack}>
                    Zobraziť pravidlo <ArrowUpRight size={14} />
                  </button>
                </>
              ) : (
                <div className="rh-inspector-empty"><Search size={20} /><b>Vyberte priebeh</b><span>Detail sa zobrazí tu.</span></div>
              )}
              <div className="rh-disclaimer"><Sparkles size={13} /> Všetky priebehy sú názorné ukážky, nie história aplikácie.</div>
            </aside>
          </div>

          <footer className="rh-footer">
            <span><span className="rh-footer-dot" /> Lokálny interaktívny návrh</span>
            <button onClick={() => setShowAll(current => !current)}>
              {showAll ? "Zbaliť filtre" : "Viac možností"} <ChevronRight size={14} />
            </button>
          </footer>
          {showAll && (
            <div className="rh-extra">
              <span>Pravidlo</span>
              {demoRules.map(rule => (
                <button key={rule.id} onClick={() => { setSearch(rule.name); setStatus("all"); setModule("all"); }}>
                  {rule.name}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
