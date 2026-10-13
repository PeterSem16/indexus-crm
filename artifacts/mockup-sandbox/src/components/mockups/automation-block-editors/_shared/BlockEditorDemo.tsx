import { useEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Activity, ArrowDown, ArrowUp, Bell, Check, CircleHelp, Copy, FileText, Forward, GripVertical, ListFilter, Mail, MoreHorizontal, Plus, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, SquareCheckBig, Trash2, UserRound, X } from "lucide-react";
import { AutomationRuleBasics } from "../_RuleBasics";
import "../_group.css";
import "./block-editor.css";

type Block = "when" | "if" | "then" | "else";
type Action = { id: number; kind: string; title: string; summary: string; config: Record<string, string> };
type Condition = { id: number; field: string; op: string; value: string };
type Group = { join: "AND" | "OR"; rows: Condition[]; nested?: Group };
const initialActions: Action[] = [
  { id: 1, kind: "forward", title: "Preposlať do Back Office", summary: "Skupina Back Office · pôvodný odosielateľ · prílohy", config: { recipient: "Back Office", sender: "Pôvodný odosielateľ", attachment: "Pôvodné súbory", matchSender: "true" } },
  { id: 2, kind: "notify_user", title: "Upozorniť finančný tím", summary: "Skupina Financie · upozornenie v aplikácii", config: { recipient: "Financie", message: "Nová rozpoznaná faktúra" } },
];
const actionTypes = [
  { kind: "forward", title: "Preposlať správu", desc: "Zvoliť cieľovú skupinu", icon: Forward },
  { kind: "create_task", title: "Vytvoriť úlohu", desc: "Prideliť prácu skupine", icon: SquareCheckBig },
  { kind: "send_email", title: "Odoslať e-mail", desc: "Napísať správu príjemcovi", icon: Mail },
  { kind: "notify_user", title: "Upozorniť používateľa", desc: "Upozornenie v aplikácii alebo e-mailom", icon: Bell },
  { kind: "update_record", title: "Upraviť údaje kontaktu", desc: "Doplniť alebo zmeniť informácie", icon: FileText },
  { kind: "webhook", title: "Odoslať webhook", desc: "Odovzdať údaje nadväzujúcemu systému", icon: Activity },
  { kind: "add_tag", title: "Pridať štítok", desc: "Označiť kontakt alebo záznam", icon: SlidersHorizontal },
  { kind: "assign_owner", title: "Priradiť zodpovednú osobu", desc: "Zmeniť vlastníka záznamu", icon: UserRound },
];
const exampleRules = [
  { id: "payment-follow-up", name: "PLATBA · chýbajúca úhrada", detail: "Analýza faktúry · 3 podmienky · 2 akcie" },
  { id: "invoice-review", name: "FAKTÚRA · manuálna kontrola", detail: "Analýza príloh · 2 podmienky · 1 akcia" },
  { id: "clinic-intake", name: "KLINIKA · nový dopyt", detail: "Prichádzajúci e-mail · 4 podmienky · 2 akcie" },
  { id: "records-refresh", name: "ZÁZNAMY · doplnenie údajov", detail: "Zmena kontaktu · 1 podmienka · 1 akcia" },
];
const fields = ["Rozpoznaná faktúra", "Skóre istoty", "Jazyk e-mailu", "Predmet e-mailu", "Má prílohu", "Krajina kontaktu"];
const newCondition = (id: number): Condition => ({ id, field: "Skóre istoty", op: "≥", value: "85" });
const cloneActions = (items: Action[]) => items.map((a) => ({ ...a, config: { ...a.config } }));
const iconFor = (kind: string) => actionTypes.find((a) => a.kind === kind)?.icon ?? Sparkles;
const actionKindLabel = (kind: string) => ({
  forward: "Preposlanie",
  create_task: "Úloha",
  send_email: "E-mail",
  notify_user: "Upozornenie",
  update_record: "Úprava záznamu",
  webhook: "Prepojenie",
  add_tag: "Štítok",
  assign_owner: "Zodpovedná osoba",
}[kind] ?? "Akcia");
const countryOptions = [
  { value: "SK", label: "Slovensko" },
  { value: "CZ", label: "Česko" },
  { value: "AT", label: "Rakúsko" },
  { value: "HU", label: "Maďarsko" },
  { value: "PL", label: "Poľsko" },
];

export function BlockEditorDemo({ startAt = "overview" }: { startAt?: "overview" | "conditions" | "else" }) {
  const [ruleName, setRuleName] = useState("FAKTÚRA · rozpoznanie faktúry");
  const [description, setDescription] = useState("Presmerovať rozpoznané faktúry na spracovanie a upozorniť finančný tím.");
  const [countryCodes, setCountryCodes] = useState<string[] | null>(["SK"]);
  const [active, setActive] = useState<Block | "settings" | null>(startAt === "conditions" ? "if" : startAt === "else" ? "else" : null);
  const [actions, setActions] = useState<Action[]>(initialActions);
  const [elseMode, setElseMode] = useState<"actions" | "stop" | "link">(startAt === "else" ? "link" : "actions");
  const [elseActions, setElseActions] = useState<Action[]>([{ id: 8, kind: "create_task", title: "Vytvoriť úlohu – manuálna kontrola", summary: "Back Office · priorita: vysoká", config: { recipient: "Back Office", title: "Skontrolovať faktúru", priority: "Vysoká" } }]);
  const [linkedRule, setLinkedRule] = useState(startAt === "else" ? "invoice-review" : "");
  const [ruleSearch, setRuleSearch] = useState("");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [quota, setQuota] = useState("120");
  const [whenSource, setWhenSource] = useState("Príde e-mail");
  const [channel, setChannel] = useState("E-mail");
  const [analysis, setAnalysis] = useState("Rozpoznanie faktúry");
  const [selectedMailboxes, setSelectedMailboxes] = useState<string[]>(["Faktúry SK"]);
  const [senderFilter, setSenderFilter] = useState("");
  const [senderMatch, setSenderMatch] = useState("Obsahuje (bez rozlíšenia veľkosti písmen)");
  const [conditions, setConditions] = useState<Group>({
    join: "AND",
    rows: [{ id: 1, field: "Rozpoznaná faktúra", op: "je", value: "Áno" }, { id: 2, field: "Skóre istoty", op: "≥", value: "85" }],
  });
  const [draftActions, setDraftActions] = useState<Action[]>([]);
  const [draftElseMode, setDraftElseMode] = useState(elseMode);
  const [draftElseActions, setDraftElseActions] = useState<Action[]>([]);
  const [draftLinkedRule, setDraftLinkedRule] = useState(linkedRule);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [conditionDraft, setConditionDraft] = useState<Group>(conditions);
  const [whenDraft, setWhenDraft] = useState({ whenSource, channel, analysis, selectedMailboxes: [...selectedMailboxes], senderFilter, senderMatch });
  const [enabledDraft, setEnabledDraft] = useState(enabled);
  const [quotaDraft, setQuotaDraft] = useState(quota);
  const [actionDraft, setActionDraft] = useState<Action | null>(null);
  const [catalogForElse, setCatalogForElse] = useState(false);
  const [testOpen, setTestOpen] = useState(false);

  useEffect(() => {
    if (!catalogOpen && !actionDraft) return;
    const frame = requestAnimationFrame(() => {
      const target = document.querySelector(
        catalogOpen ? ".ix-catalog" : ".ix-editor-body .ix-control-card",
      );
      target?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [catalogOpen, actionDraft?.id]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") cancel(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active]);

  const notice = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3200); };
  const begin = (block: Block) => {
    setActive(block);
    setActionDraft(null);
    setCatalogOpen(false);
    setQuery("");
    if (block === "if") setConditionDraft(JSON.parse(JSON.stringify(conditions)) as Group);
    if (block === "when") setWhenDraft({ whenSource, channel, analysis, selectedMailboxes: [...selectedMailboxes], senderFilter, senderMatch });
    if (block === "then") setDraftActions(cloneActions(actions));
    if (block === "else") {
      setDraftElseMode(elseMode);
      setDraftElseActions(cloneActions(elseActions));
      setDraftLinkedRule(linkedRule);
    }
  };
  const apply = () => {
    if (active === "if") setConditions(conditionDraft);
    if (active === "when") { setWhenSource(whenDraft.whenSource); setChannel(whenDraft.channel); setAnalysis(whenDraft.analysis); setSelectedMailboxes(whenDraft.selectedMailboxes); setSenderFilter(whenDraft.senderFilter); setSenderMatch(whenDraft.senderMatch); }
    if (active === "then") setActions(draftActions);
    if (active === "else") { setElseMode(draftElseMode); setElseActions(draftElseActions); setLinkedRule(draftLinkedRule); }
    if (active === "settings") { setEnabled(enabledDraft); setQuota(quotaDraft); }
    setActive(null);
  };
  const cancel = () => { setActive(null); setActionDraft(null); setCatalogOpen(false); };
  const actionState = active === "then" ? draftActions : draftElseActions;
  const setActionState = active === "then" ? setDraftActions : setDraftElseActions;
  const addAction = (kind: string, targetElse = active === "else") => {
    const a = actionTypes.find((item) => item.kind === kind) ?? actionTypes[0];
    const newAction: Action = { id: Date.now(), kind, title: a.title, summary: "Nastavte príjemcu a správanie", config: {} };
    if (targetElse) setDraftElseActions((old) => [...old, newAction]); else setDraftActions((old) => [...old, newAction]);
    setActionDraft(newAction); setCatalogOpen(false);
  };
  const editAction = (action: Action) => { setActionDraft({ ...action, config: { ...action.config } }); };
  const saveAction = () => {
    if (!actionDraft) return;
    const set = active === "else" ? setDraftElseActions : setDraftActions;
    set((old) => old.map((a) => a.id === actionDraft.id ? actionDraft : a));
    setActionDraft(null);
  };
  const duplicate = (id: number) => setActionState((old) => { const index = old.findIndex((a) => a.id === id); if (index < 0) return old; const copy = { ...old[index], id: Date.now(), title: `${old[index].title} – kópia`, config: { ...old[index].config } }; const next = [...old]; next.splice(index + 1, 0, copy); return next; });
  const moveAction = (id: number, offset: number) => setActionState((old) => { const index = old.findIndex((a) => a.id === id); const nextIndex = index + offset; if (index < 0 || nextIndex < 0 || nextIndex >= old.length) return old; const next = [...old]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; return next; });
  const removeAction = (id: number) => setActionState((old) => old.filter((a) => a.id !== id));
  const toggleMailbox = (name: string) => setWhenDraft((old) => ({ ...old, selectedMailboxes: old.selectedMailboxes.includes(name) ? old.selectedMailboxes.filter((item) => item !== name) : [...old.selectedMailboxes, name] }));
  const filteredRules = useMemo(() => exampleRules.filter((r) => r.name.toLowerCase().includes(ruleSearch.toLowerCase())), [ruleSearch]);
  const filteredTypes = useMemo(() => actionTypes.filter((a) => `${a.title} ${a.desc}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const conditionLabel = `${conditions.rows.length + (conditions.nested?.rows.length ?? 0)} pravidlá · ${conditions.join}`;
  const thenSummary = actions.map((a) => a.title).join(" → ");
  const elseSummary = elseMode === "stop" ? "Ukončiť pravidlo" : elseMode === "link" ? `Prepojenie: ${exampleRules.find((r) => r.id === linkedRule)?.name ?? "Vyberte pravidlo"}` : elseActions.map((a) => a.title).join(" → ");
  const updateRow = (id: number, key: keyof Condition, value: string, nested = false) => setConditionDraft((old) => nested ? { ...old, nested: old.nested ? { ...old.nested, rows: old.nested.rows.map((r) => r.id === id ? { ...r, [key]: value } : r) } : undefined } : { ...old, rows: old.rows.map((r) => r.id === id ? { ...r, [key]: value } : r) });
  const removeRow = (id: number, nested = false) => setConditionDraft((old) => nested ? { ...old, nested: old.nested ? { ...old.nested, rows: old.nested.rows.filter((r) => r.id !== id) } : undefined } : { ...old, rows: old.rows.filter((r) => r.id !== id) });
  const addRow = (nested = false) => setConditionDraft((old) => nested ? { ...old, nested: { join: old.nested?.join ?? "OR", rows: [...(old.nested?.rows ?? []), newCondition(Date.now())] } } : { ...old, rows: [...old.rows, newCondition(Date.now())] });
  const renderActions = (items: Action[], onEdit: (item: Action) => void) => <div className="ix-action-list">{items.map((action, index) => {
    const Icon = iconFor(action.kind);
    return <div className="ix-action" key={action.id}><GripVertical size={15} className="ix-grip"/><div><div className="ix-action-title"><Icon size={13}/>{action.title}<em>{actionKindLabel(action.kind)}</em></div><p>{action.summary}</p></div><div className="ix-action-controls"><button className="ix-icon-button" title="Upraviť" aria-label="Upraviť" onClick={() => onEdit(action)}><Settings2 size={13}/></button><button className="ix-icon-button" title="Posunúť vyššie" aria-label="Posunúť vyššie" onClick={() => moveAction(action.id, -1)} disabled={index === 0}><ArrowUp size={13}/></button><button className="ix-icon-button" title="Posunúť nižšie" aria-label="Posunúť nižšie" onClick={() => moveAction(action.id, 1)} disabled={index === items.length - 1}><ArrowDown size={13}/></button><button className="ix-icon-button" title="Duplikovať" aria-label="Duplikovať" onClick={() => duplicate(action.id)}><Copy size={13}/></button><button className="ix-icon-button" title="Odstrániť" aria-label="Odstrániť" onClick={() => removeAction(action.id)}><Trash2 size={13}/></button></div></div>;
  })}</div>;
  const openCatalog = (forElse = false) => { setCatalogForElse(forElse); setCatalogOpen(true); setQuery(""); };
  const fieldTitle = (b: Block | "settings") => ({ when: "Kedy sa pravidlo spustí", if: "Podmienky pravidla", then: "Ak podmienky platia · THEN", else: "Ak podmienky neplatia · ELSE", settings: "Nastavenia vykonania" }[b]);

  return <div className="ix-prototype"><div className="ix-window">
    <div className="ix-topbar"><div className="ix-brand"><div className="ix-mark">IX</div><div><p className="ix-eyebrow">INDEXUS · AUTOMATIZÁCIE</p><h1>Editor pravidla</h1></div></div><div className="ix-top-actions"><span className="ix-prototype-badge"><CircleHelp size={12}/> Návrh · bez produkčných zmien</span><div className="ix-user">MK</div></div></div>
    <div className="ix-content"><main className="ix-main">
      <div className="ix-title-row"><div><h2>Upraviť pravidlo</h2><p className="ix-subtitle">Prehľad toku. Otvorte blok, ktorý chcete upraviť.</p></div><span className="ix-live"><i/>{enabled ? "Aktívne" : "Pozastavené"}</span></div>
      <AutomationRuleBasics name={ruleName} description={description} countryCodes={countryCodes}
        countries={countryOptions} onNameChange={setRuleName} onDescriptionChange={setDescription}
        onCountriesChange={setCountryCodes}/>
      <div className="ix-flow" aria-label="Prehľad pravidla">
        <BlockCard number="01" kind="when" icon={<Bell size={15}/>} title="WHEN · KEDY" summary={`${whenSource} · ${channel} · ${analysis}`} onClick={() => begin("when")} action="Upraviť"/>
        <BlockCard number="02" kind="if" icon={<ListFilter size={15}/>} title="IF · AK" summary={conditionLabel} onClick={() => begin("if")} action="Upraviť"/>
        <div className="ix-branch" aria-label="Vetvenie podľa podmienok">
          <div className="ix-branch-grid">
            <div className="ix-branch-lane yes"><div className="ix-branch-label"><Check size={11}/>ÁNO <small>podmienky platia</small></div><BlockCard number="03" kind="then" icon={<Sparkles size={15}/>} title="THEN · POTOM" summary={thenSummary || "Bez akcií"} onClick={() => begin("then")} action="Upraviť"/></div>
            <div className="ix-branch-lane no"><div className="ix-branch-label"><X size={11}/>NIE <small>podmienky neplatia</small></div><BlockCard number="04" kind="else" icon={<MoreHorizontal size={15}/>} title="ELSE · INAK" summary={elseSummary} onClick={() => begin("else")} action="Upraviť"/></div>
          </div>
        </div>
      </div>
      <section className="ix-settings"><div className="ix-settings-head"><strong>Nastavenia vykonania</strong><button className="ix-button" onClick={() => { setEnabledDraft(enabled); setQuotaDraft(quota); setActive("settings"); }}>Upraviť <Settings2 size={12}/></button></div><div className="ix-setting-grid"><div className="ix-toggle-row"><span className={`ix-tag`}>{enabled ? "Zapnuté" : "Pozastavené"}</span><span>Stav pravidla</span></div><div className="ix-field"><label>Limit vykonaní za hodinu</label><span className="ix-tag">{quota}</span></div></div></section>
    </main>
      <aside className="ix-rail">
        <section className="ix-preview-card"><h3><Activity size={11} style={{verticalAlign:"-2px"}}/> Náhľad toku</h3><div className="ix-preview-flow"><FlowLine n="01" label="WHEN · KEDY" text={`${channel} · ${analysis}`}/><div className="ix-spine"/><FlowLine n="02" label="IF · AK" text="Faktúra rozpoznaná a istota ≥ 85 %"/><div className="ix-mini-branch"><div className="ix-mini-lane yes"><strong>ÁNO</strong><FlowLine n="03" label="THEN · POTOM" text={`${actions.length} akcie · ${actions.map(a=>a.kind === "forward" ? "Back Office" : "Financie").join(" + ")}`}/></div><div className="ix-mini-lane no"><strong>NIE</strong><FlowLine n="04" label="ELSE · INAK" text={elseMode === "actions" ? "Manuálna kontrola" : elseMode === "stop" ? "Ukončiť pravidlo" : "Prepojené pravidlo"}/></div></div></div></section>
        <section className="ix-rail-card"><h3 className="ix-rail-title">Kontext <small>FAKTÚRA / SK</small></h3><div className="ix-event-note"><strong>Analýza príloh e-mailu</strong>Prichádzajúci e-mail · schránka Faktúry SK<br/>Odosielateľ: {senderFilter || "bez filtra"}</div><p className="ix-status-note">Náhľad ukazuje nastavené kroky. Splnenie podmienky nezaručuje doručenie akcie.</p></section>
        <section className="ix-rail-card"><h3 className="ix-rail-title">Overenie <small>SIMULÁCIA</small></h3><button className="ix-button" style={{width:"100%"}} onClick={() => setTestOpen(!testOpen)}><Activity size={13}/>{testOpen ? "Skryť testovacie údaje" : "Otvoriť simuláciu"}</button>{testOpen && <div className="ix-event-note" style={{marginTop:8}}><strong>Iba návrh</strong>Testovacie údaje sú ukážkové. Pravidlo sa nespustí a nič sa neodošle.<button className="ix-button" style={{marginTop:8}} onClick={() => notice("Iba ukážka: pravidlo sa nespustilo.")}>Zobraziť výsledok ukážky</button></div>}<p className="ix-status-note">Bez odosielania e-mailov, SMS, webhookov či úprav produkčných údajov.</p></section>
      </aside>
    </div>
    <div className="ix-footer"><button className="ix-button" onClick={() => {setTestOpen(true);notice("Iba ukážka: pravidlo sa nespustilo.");}}><Activity size={13}/> Spustiť simuláciu</button><p className="ix-notice">Simulácia aj uloženie sú iba ukážkové. Zmeny sa neuložia do produkcie.</p><button className="ix-button" onClick={() => notice("Návrh bol zahodený. Produkčné pravidlo zostalo nezmenené.")}>Zrušiť</button><button className="ix-button primary" onClick={() => notice("Iba návrh: pravidlo sa neuložilo do produkcie.")}>Uložiť pravidlo</button></div>
    {toast && <div className="ix-toast" role="status">{toast}</div>}
    {active && <div className="ix-editor-shade" onMouseDown={(e) => { if (e.target === e.currentTarget) cancel(); }}><section className="ix-editor" role="dialog" aria-modal="true" aria-labelledby="ix-editor-title">
      <div className="ix-editor-head"><div><p className="ix-eyebrow">EDITOR BLOKU · {active === "settings" ? "NASTAVENIA" : ({when:"KEDY",if:"AK",then:"POTOM",else:"INAK"} as Record<Block,string>)[active]}</p><h2 id="ix-editor-title">{fieldTitle(active)}</h2><p>Upravte tento blok bez rozbalenia celého pravidla.</p></div><button className="ix-close" aria-label="Zavrieť" onClick={cancel}><X size={15}/></button></div>
      <div className="ix-editor-body">
      {active === "when" && <WhenEditor state={whenDraft} setState={setWhenDraft} toggleMailbox={toggleMailbox}/>}
      {active === "if" && <ConditionEditor group={conditionDraft} setGroup={setConditionDraft} updateRow={updateRow} removeRow={removeRow} addRow={addRow}/>}
      {(active === "then" || active === "else" && draftElseMode === "actions") && <>
        {active === "else" && <div className="ix-section"><div className="ix-section-title"><h3>Keď podmienky neplatia</h3></div><ElseOptions mode={draftElseMode} setMode={setDraftElseMode} linkedRule={draftLinkedRule} setLinkedRule={setDraftLinkedRule} search={ruleSearch} setSearch={setRuleSearch} rules={filteredRules}/></div>}
        <div className="ix-section"><div className="ix-section-title"><h3>Poradie akcií</h3><span className="ix-tag">{active === "then" ? draftActions.length : draftElseActions.length} akcie</span></div>{renderActions(active === "then" ? draftActions : draftElseActions, editAction)}</div>
        <div className="ix-add-bar"><span className="ix-status-note" style={{margin:0}}>Akcie sa zobrazujú v poradí vykonania.</span><button className="ix-button primary" onClick={() => openCatalog(active === "else")}><Plus size={13}/>Pridať akciu</button></div>
      </>}
      {active === "else" && draftElseMode !== "actions" && <div className="ix-section"><ElseOptions mode={draftElseMode} setMode={setDraftElseMode} linkedRule={draftLinkedRule} setLinkedRule={setDraftLinkedRule} search={ruleSearch} setSearch={setRuleSearch} rules={filteredRules}/></div>}
      {active === "settings" && <div className="ix-grid2"><div className="ix-control-card"><div className="ix-field"><label>Stav pravidla</label><div className="ix-toggle-row" style={{marginTop:8}}><button className={`ix-toggle ${enabledDraft ? "on" : ""}`} aria-pressed={enabledDraft} aria-label="Zapnúť pravidlo" onClick={() => setEnabledDraft(!enabledDraft)}/>{enabledDraft ? "Zapnuté" : "Pozastavené"}</div></div></div><div className="ix-control-card"><div className="ix-field"><label htmlFor="ix-quota-editor">Max. vykonaní za hodinu</label><input className="ix-input" id="ix-quota-editor" type="number" min="1" value={quotaDraft} onChange={(e)=>setQuotaDraft(e.target.value)}/></div></div></div>}
      {catalogOpen && <div className="ix-section" style={{marginTop:16}}><div className="ix-section-title"><h3>Výber akcie</h3><button className="ix-icon-button" aria-label="Zavrieť výber akcie" onClick={() => setCatalogOpen(false)}><X size={13}/></button></div><div className="ix-search"><Search size={13}/><input className="ix-input" placeholder="Hľadať akciu" value={query} onChange={(e)=>setQuery(e.target.value)}/></div><div className="ix-catalog">{filteredTypes.map((item)=>{const Icon=item.icon;return <button key={item.kind} className="ix-catalog-item" onClick={()=>addAction(item.kind,catalogForElse)}><Icon size={15}/><span><strong>{item.title}</strong><small>{item.desc}</small></span><Plus size={13}/></button>})}</div><p className="ix-status-note">Ďalšie typy akcií sú zobrazené na porovnanie možností. V tejto ukážke sa nevykonajú.</p></div>}
      {active === "then" && actionDraft && <ActionForm action={actionDraft} set={setActionDraft} onSave={saveAction}/>}
      {active === "else" && actionDraft && <ActionForm action={actionDraft} set={setActionDraft} onSave={saveAction}/>}
      </div>
      <div className="ix-editor-footer"><p className="ix-prototype-only">{actionDraft ? "Najprv potvrďte úpravu akcie tlačidlom Hotovo." : "Použiť zmeny aktualizuje iba tento prototypový blok."}</p><button className="ix-button" onClick={cancel}>Zrušiť</button><button className="ix-button primary" disabled={!!actionDraft} onClick={apply}><Check size={13}/>Použiť zmeny</button></div>
    </section></div>}
  </div></div>;
}

function BlockCard({ number, kind, icon, title, summary, onClick, action }: { number:string;kind:string;icon:ReactNode;title:string;summary:string;onClick:()=>void;action:string }) {
  return <div className={`ix-block ${kind}`}><div className="ix-step-icon">{icon}</div><div><div className="ix-meta"><h3>{title}</h3><span className="ix-tag">{number}</span></div><p title={summary}>{summary}</p></div><button onClick={onClick}>{action}<Settings2 size={12}/></button></div>;
}
function FlowLine({n,label,text}:{n:string;label:string;text:string}) { return <div className="ix-flow-line"><b>{n}</b><div><strong>{label}</strong><small>{text}</small></div></div>; }
function WhenEditor({state,setState,toggleMailbox}:{state:{whenSource:string;channel:string;analysis:string;selectedMailboxes:string[];senderFilter:string;senderMatch:string};setState:Dispatch<SetStateAction<{whenSource:string;channel:string;analysis:string;selectedMailboxes:string[];senderFilter:string;senderMatch:string}>>;toggleMailbox:(name:string)=>void}) {
   return <><div className="ix-section"><div className="ix-section-title"><h3>Zdroj udalosti</h3></div><div className="ix-grid2"><div className="ix-field"><label>Spúšťač</label><select className="ix-select" value={state.whenSource} onChange={(e)=>setState(o=>({...o,whenSource:e.target.value}))}><option>Príde e-mail</option><option>Analýza e-mailu dokončená</option><option>Kontakt sa zmenil</option><option>Podľa plánu</option></select></div><div className="ix-field"><label>Kanál</label><select className="ix-select" value={state.channel} onChange={(e)=>setState(o=>({...o,channel:e.target.value}))}><option>E-mail</option><option>SMS</option><option>E-mail + SMS</option></select></div><div className="ix-field"><label>Typ analýzy</label><select className="ix-select" value={state.analysis} onChange={(e)=>setState(o=>({...o,analysis:e.target.value}))}><option>Rozpoznanie faktúry</option><option>Extrakcia príloh</option><option>Jazyk a kategória</option></select></div><div className="ix-field"><label>Analýza</label><span className="ix-event-note">Po dokončení analýzy e-mailovej prílohy</span></div></div></div>
  <div className="ix-section"><div className="ix-section-title"><h3>Schránky</h3><span className="ix-tag">Vlastníci zdroja</span></div><div className="ix-check-list">{["Faktúry SK","Recepcia","Back Office"].map((name)=><label className="ix-check" key={name}><input type="checkbox" checked={state.selectedMailboxes.includes(name)} onChange={()=>toggleMailbox(name)}/>{name}</label>)}</div></div>
   <div className="ix-section"><div className="ix-section-title"><h3>Filtre odosielateľa</h3></div><div className="ix-grid2"><div className="ix-field"><label htmlFor="ix-sender">Adresa odosielateľa obsahuje</label><input className="ix-input" id="ix-sender" placeholder="napr. faktury@dodavatel.sk" value={state.senderFilter} onChange={(e)=>setState(o=>({...o,senderFilter:e.target.value}))}/></div><div className="ix-field"><label htmlFor="ix-sender-match">Zhoda</label><select id="ix-sender-match" className="ix-select" value={state.senderMatch} onChange={(e)=>setState(o=>({...o,senderMatch:e.target.value}))}><option>Obsahuje (bez rozlíšenia veľkosti písmen)</option><option>Presná zhoda</option><option>Doména končí na</option></select></div></div><p className="ix-status-note">Odosielateľ sa porovná pri príchode e-mailu; filtre závisia od vybraného zdroja.</p></div>
  </>;
}
function ConditionEditor({group,setGroup,updateRow,removeRow,addRow}:{group:Group;setGroup:Dispatch<SetStateAction<Group>>;updateRow:(id:number,key:keyof Condition,value:string,nested?:boolean)=>void;removeRow:(id:number,nested?:boolean)=>void;addRow:(nested?:boolean)=>void}) {
  const rows = (items:Condition[], nested=false) => items.map((row)=><div className="ix-condition-row" key={row.id}><select className="ix-select" value={row.field} onChange={(e)=>updateRow(row.id,"field",e.target.value,nested)}>{fields.map((field)=><option key={field}>{field}</option>)}</select><select className="ix-select" value={row.op} onChange={(e)=>updateRow(row.id,"op",e.target.value,nested)}><option>je</option><option>nie je</option><option>≥</option><option>obsahuje</option><option>je prázdne</option></select><input className="ix-input" value={row.value} onChange={(e)=>updateRow(row.id,"value",e.target.value,nested)} aria-label="Hodnota podmienky"/><button className="ix-icon-button" title="Odstrániť podmienku" aria-label="Odstrániť podmienku" onClick={()=>removeRow(row.id,nested)}><X size={13}/></button></div>);
  return <><div className="ix-section"><div className="ix-section-title"><h3>Logika podmienok</h3><span className="ix-tag">Všetky skupiny sa vyhodnocujú v poradí</span></div><div className="ix-pills"><button className={group.join==="AND"?"selected":""} onClick={()=>setGroup(o=>({...o,join:"AND"}))}>Všetky (AND)</button><button className={group.join==="OR"?"selected":""} onClick={()=>setGroup(o=>({...o,join:"OR"}))}>Aspoň jedna (OR)</button></div><p className="ix-status-note">Nadskupina určuje, či musia platiť všetky alebo aspoň jedna podmienka.</p></div>
  <div className="ix-condition-group"><div className="ix-group-head"><strong>Hlavná skupina <span className="ix-tag">{group.join}</span></strong><button className="ix-button" onClick={()=>addRow(false)}><Plus size={12}/>Pridať podmienku</button></div>{rows(group.rows)}{group.nested && <div className="ix-condition-group nested"><div className="ix-group-head"><strong>Vnorená skupina <span className="ix-tag">{group.nested.join}</span></strong><div style={{display:"flex",gap:5}}><select className="ix-select" style={{width:104}} value={group.nested.join} onChange={(e)=>setGroup(o=>({...o,nested:o.nested?{...o.nested,join:e.target.value as "AND"|"OR"}:undefined}))}><option>OR</option><option>AND</option></select><button className="ix-icon-button" aria-label="Odstrániť skupinu" onClick={()=>setGroup(o=>({...o,nested:undefined}))}><Trash2 size={13}/></button></div></div>{rows(group.nested.rows,true)}<button className="ix-button" onClick={()=>addRow(true)}><Plus size={12}/>Pridať do skupiny</button></div>}
    {!group.nested && <button className="ix-button" style={{marginTop:8}} onClick={()=>setGroup(o=>({...o,nested:{join:"OR",rows:[newCondition(Date.now())]}}))}><Plus size={12}/>Pridať vnorenú skupinu</button>}
    <div className="ix-unknown-note" style={{marginTop:10}}>Neznámy alebo chybový výsledok analýzy nie je „nepravda“. Spracovanie tejto vetvy treba nakonfigurovať samostatne.</div>
  </div></>;
}
function ElseOptions({mode,setMode,linkedRule,setLinkedRule,search,setSearch,rules}:{mode:"actions"|"stop"|"link";setMode:(m:"actions"|"stop"|"link")=>void;linkedRule:string;setLinkedRule:(id:string)=>void;search:string;setSearch:(s:string)=>void;rules:{id:string;name:string;detail:string}[]}) {
  return <><div className="ix-radio-row"><label className={`ix-radio-card ${mode==="stop"?"active":""}`}><input type="radio" checked={mode==="stop"} onChange={()=>setMode("stop")}/><span><strong>Zastaviť tu</strong><small>Ak sa podmienky nezhodujú, ďalšie akcie sa nevykonajú.</small></span></label><label className={`ix-radio-card ${mode==="actions"?"active":""}`}><input type="radio" checked={mode==="actions"} onChange={()=>setMode("actions")}/><span><strong>Vlastné akcie pre vetvu INAK</strong><small>Napríklad úloha na manuálnu kontrolu.</small></span></label><label className={`ix-radio-card ${mode==="link"?"active":""}`}><input type="radio" checked={mode==="link"} onChange={()=>setMode("link")}/><span><strong>Prepojiť existujúce pravidlo</strong><small>Vybrané pravidlo vyhodnotí svoje podmienky samostatne.</small></span></label></div>
  {mode==="link" && <div style={{marginTop:12}}><div className="ix-search"><Search size={13}/><input className="ix-input" placeholder="Hľadať pravidlo" value={search} onChange={(e)=>setSearch(e.target.value)}/></div><div style={{display:"grid",gap:6}}>{rules.map((r)=><button key={r.id} className={`ix-rule-choice ${linkedRule===r.id?"selected":""}`} onClick={()=>setLinkedRule(r.id)}><span><strong>{r.name}</strong><small>{r.detail}</small></span>{linkedRule===r.id&&<Check size={14}/>}</button>)}{rules.length===0&&<p className="ix-status-note">Nenašli sa žiadne pravidlá.</p>}</div>{linkedRule&&<div className="ix-target-checks"><div><Check size={12}/>Podmienky cieľového pravidla sa vyhodnotia samostatne.</div><div><Check size={12}/>Zachová sa pôvodný zdroj a kontext správy.</div><div><ShieldCheck size={12}/>Pravidlo nemožno prepojiť samo na seba ani vytvoriť cyklus.</div></div>}<p className="ix-status-note">Zobrazené pravidlá sú vzorové; žiadne sa nespustí.</p></div>}
  {mode==="stop"&&<p className="ix-status-note">Zastavenie je predvolená vetva, ak nevyberiete inú možnosť.</p>}</>;
}
function ActionForm({action,set,onSave}:{action:Action;set:(a:Action|null)=>void;onSave:()=>void}) {
  const put=(key:string,value:string)=>set({...action,config:{...action.config,[key]:value},summary:value || "Nastavenie upravené"});
  return <div className="ix-control-card" style={{marginTop:14}}><div className="ix-section-title"><h3>Upraviť akciu</h3><span className="ix-tag">{actionKindLabel(action.kind)}</span></div><div className="ix-grid2"><div className="ix-field"><label>Názov v prehľade</label><input className="ix-input" value={action.title} onChange={(e)=>set({...action,title:e.target.value})}/></div>{action.kind==="forward"&&<><div className="ix-field"><label>Cieľová skupina</label><select className="ix-select" value={action.config.recipient ?? "Back Office"} onChange={(e)=>put("recipient",e.target.value)}><option>Back Office</option><option>Financie</option><option>Recepcia</option></select></div><div className="ix-field"><label>Odosielateľ pri preposlaní</label><select className="ix-select" value={action.config.sender ?? "Pôvodný odosielateľ"} onChange={(e)=>put("sender",e.target.value)}><option>Pôvodný odosielateľ</option><option>Vlastník schránky pravidla</option><option>Nastavený odosielateľ</option></select></div><div className="ix-field"><label>Prílohy</label><select className="ix-select" value={action.config.attachment ?? "Pôvodné súbory"} onChange={(e)=>put("attachment",e.target.value)}><option>Pôvodné súbory</option><option>Priložiť analyzované súbory</option><option>Bez príloh</option></select></div><label className="ix-check ix-match-sender"><input type="checkbox" checked={action.config.matchSender !== "false"} onChange={(e)=>set({...action,config:{...action.config,matchSender:e.target.checked?"true":"false"}})}/>Vyhľadať zákazníka podľa odosielateľa</label></>}
  {action.kind==="create_task"&&<><div className="ix-field"><label>Priradiť skupine</label><select className="ix-select" value={action.config.recipient ?? "Back Office"} onChange={(e)=>put("recipient",e.target.value)}><option>Back Office</option><option>Financie</option><option>Recepcia</option></select></div><div className="ix-field"><label>Názov úlohy</label><input className="ix-input" value={action.config.title ?? "Skontrolovať faktúru"} onChange={(e)=>put("title",e.target.value)}/></div><div className="ix-field"><label>Priorita</label><select className="ix-select" value={action.config.priority ?? "Vysoká"} onChange={(e)=>put("priority",e.target.value)}><option>Bežná</option><option>Vysoká</option><option>Naliehavá</option></select></div></>}
   {(action.kind==="send_email"||action.kind==="notify_user")&&<><div className="ix-field"><label>Príjemca</label><select className="ix-select" value={action.config.recipient ?? "Financie"} onChange={(e)=>put("recipient",e.target.value)}><option>Financie</option><option>Zodpovedná osoba za záznam</option><option>Back Office</option></select></div><div className="ix-field"><label>Predmet / správa</label><input className="ix-input" value={action.config.message ?? "Nová rozpoznaná faktúra"} onChange={(e)=>put("message",e.target.value)}/></div>{action.kind==="send_email"&&<div className="ix-field ix-description"><label>Text e-mailu</label><textarea className="ix-textarea" placeholder="Ukážkový text; nič sa neodošle."/></div>}</>}
  {!["forward","create_task","send_email","notify_user"].includes(action.kind)&&<div className="ix-event-note">Táto akcia je ukážková; žiadna externá služba sa nevolá.</div>}</div><div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}><button className="ix-button primary" onClick={onSave}><Check size={12}/>Hotovo</button></div></div>;
}
