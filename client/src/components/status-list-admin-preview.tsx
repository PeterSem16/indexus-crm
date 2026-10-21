import { useQuery } from "@tanstack/react-query";
import { Activity, Bell, ClipboardList, Mail, MessageSquare, Phone, Send, Tag, Webhook, Zap } from "lucide-react";
import type { SavedStatusListWorkflow } from "@shared/status-list-workflow";
import { getStatusWorkflowActionCopy } from "./status-list-workflow-action-copy";
import { getStatusListWorkflowCopy } from "./status-list-workflow-copy";
import { statusListActionLabel } from "./status-list-action-labels";
import { actionCopy, catalogFieldLabel, catalogOperatorLabel } from "./status-list-service-action-copy";
import { StatusListServiceHistory } from "./status-list-service-history";
import { getStatusListQuestionStudioCopy } from "./status-list-question-studio-copy";

type Automation = {
  id: string; actionType: string; targetRole?: string | null; taskDescription?: string | null;
  conditionField?: string | null; conditionOperator?: string | null; conditionValue?: string | null; conditionJson?: string | null;
  taskDeadlineOffset?: string | null; taskPriority?: string | null; emailTemplateId?: string | null; smsTemplateId?: string | null;
  emailRecipients?: string[] | null; webhookTarget?: string | null; dispositionId?: string | null; taskGroupId?: string | null; smsProvider?: string | null; callbackOffsetDays?: number | null;
  callbackTime?: string | null; callbackBusinessDaysOnly?: boolean; callbackExistingPolicy?: "replace" | "keep_existing";
};
type Question = { id: string; questionText: string; description?: string | null; required?: boolean; isHidden?: boolean; logicOperator?: string; groupName?: string | null; fieldType?: string | null; gotoQuestionId?: string | null; automations: Automation[] };
type Item = {
  id: string; campaignId: string; stepId: string; label: string; description?: string | null;
  parentId: string | null; sortOrder: number; required: boolean; isHidden?: boolean; restrictions?: string | null;
  nextStepId?: string | null; questionSelectionMode?: "multiple" | "single"; autoConfirmOnSubQuestion?: boolean;
  automations: Automation[]; questions: Question[];
};
type Copy = { admin: string; disclaimer: string; structure: string; questions: string; actions: string; workflows: string; emptyActions: string; emptyWorkflows: string; when: string; if: string; then: string; otherwise: string; required: string; hidden: string; loading: string; unavailable: string; and: string; notAvailable: string; fieldType: string; group: string; logic: string; recovered: string; actionValues: string; unknownDisposition: string; mode: string; history: string; emailTemplate: string; smsTemplate: string };
const copy: Record<string, Copy> = {
  en: { admin: "Administrator preview · not the agent screen", disclaimer: "A read-only view of configured behavior. Nothing executes here.", structure: "Checklist structure", questions: "Questions", actions: "Service actions", workflows: "Workflow rules", emptyActions: "No service actions configured", emptyWorkflows: "No workflow rules configured", when: "When", if: "If", then: "Then", otherwise: "Otherwise", required: "Required", hidden: "Hidden", loading: "Loading workflow rules", unavailable: "Could not load. Retry", and: "and", notAvailable: "Not available", fieldType: "Answer type", group: "Group", logic: "Question flow", recovered: "Unlinked or cyclic item", actionValues: "Configured values", unknownDisposition: "Disposition not found", mode: "Mode", history: "Action execution history", emailTemplate: "Email template ID", smsTemplate: "SMS template ID" },
  sk: { admin: "Ukážka správcu · nie obrazovka agenta", disclaimer: "Iba na čítanie – zobrazuje nastavené správanie. Nič sa tu nespúšťa.", structure: "Štruktúra zoznamu", questions: "Otázky", actions: "Servisné akcie", workflows: "Pravidlá pracovného postupu", emptyActions: "Nie sú nastavené servisné akcie", emptyWorkflows: "Nie sú nastavené pravidlá pracovného postupu", when: "Kedy", if: "Ak", then: "Potom", otherwise: "Inak", required: "Povinné", hidden: "Skryté", loading: "Načítavajú sa pravidlá", unavailable: "Pravidlá sa nepodarilo načítať. Skúsiť znova", and: "a", notAvailable: "Nedostupné", fieldType: "Typ odpovede", group: "Skupina", logic: "Nadväznosť otázky", recovered: "Nepripojená položka alebo cyklus", actionValues: "Nastavené hodnoty", unknownDisposition: "Dispozícia sa nenašla", mode: "Režim", history: "História vykonania akcie", emailTemplate: "ID e-mailovej šablóny", smsTemplate: "ID SMS šablóny" },
  cs: { admin: "Náhled správce · ne obrazovka agenta", disclaimer: "Pouze ke čtení – zobrazuje nastavené chování. Nic se zde nespouští.", structure: "Struktura seznamu", questions: "Otázky", actions: "Servisní akce", workflows: "Pravidla pracovního postupu", emptyActions: "Nejsou nastaveny servisní akce", emptyWorkflows: "Nejsou nastavena pravidla pracovního postupu", when: "Kdy", if: "Pokud", then: "Potom", otherwise: "Jinak", required: "Povinné", hidden: "Skryté", loading: "Načítají se pravidla", unavailable: "Pravidla se nepodařilo načíst. Zkusit znovu", and: "a", notAvailable: "Nedostupné", fieldType: "Typ odpovědi", group: "Skupina", logic: "Návaznost otázky", recovered: "Nepřipojená položka nebo cyklus", actionValues: "Nastavené hodnoty", unknownDisposition: "Dispozice nebyla nalezena", mode: "Režim", history: "Historie provedení akce", emailTemplate: "ID e-mailové šablony", smsTemplate: "ID SMS šablony" },
  hu: { admin: "Admin előnézet · nem az ügynök képernyője", disclaimer: "Csak olvasható nézet a beállított működésről. Itt semmi nem fut le.", structure: "Ellenőrzőlista szerkezete", questions: "Kérdések", actions: "Szolgáltatási műveletek", workflows: "Munkafolyamat-szabályok", emptyActions: "Nincsenek beállított szolgáltatási műveletek", emptyWorkflows: "Nincsenek munkafolyamat-szabályok", when: "Mikor", if: "Ha", then: "Akkor", otherwise: "Egyébként", required: "Kötelező", hidden: "Rejtett", loading: "Szabályok betöltése", unavailable: "A szabályok nem tölthetők be. Újrapróbálás", and: "és", notAvailable: "Nem érhető el", fieldType: "Választípus", group: "Csoport", logic: "Kérdéssorrend", recovered: "Nem kapcsolódó vagy ciklikus elem", actionValues: "Beállított értékek", unknownDisposition: "A diszpozíció nem található", mode: "Mód", history: "Műveletvégrehajtási előzmények", emailTemplate: "E-mail-sablonazonosító", smsTemplate: "SMS-sablonazonosító" },
  ro: { admin: "Previzualizare admin · nu ecranul agentului", disclaimer: "Vizualizare doar în citire a comportamentului configurat. Aici nu se execută nimic.", structure: "Structura listei", questions: "Întrebări", actions: "Acțiuni de serviciu", workflows: "Reguli de flux", emptyActions: "Nu există acțiuni de serviciu configurate", emptyWorkflows: "Nu există reguli de flux configurate", when: "Când", if: "Dacă", then: "Atunci", otherwise: "Altfel", required: "Obligatoriu", hidden: "Ascuns", loading: "Se încarcă regulile", unavailable: "Regulile nu au putut fi încărcate. Reîncearcă", and: "și", notAvailable: "Indisponibil", fieldType: "Tip de răspuns", group: "Grup", logic: "Ordinea întrebărilor", recovered: "Element neconectat sau ciclic", actionValues: "Valori configurate", unknownDisposition: "Dispoziția nu a fost găsită", mode: "Mod", history: "Istoricul executării acțiunilor", emailTemplate: "ID șablon e-mail", smsTemplate: "ID șablon SMS" },
  it: { admin: "Anteprima admin · non è la schermata dell’agente", disclaimer: "Vista di sola lettura del comportamento configurato. Qui non viene eseguito nulla.", structure: "Struttura della lista", questions: "Domande", actions: "Azioni di servizio", workflows: "Regole del flusso", emptyActions: "Nessuna azione di servizio configurata", emptyWorkflows: "Nessuna regola del flusso configurata", when: "Quando", if: "Se", then: "Allora", otherwise: "Altrimenti", required: "Obbligatorio", hidden: "Nascosto", loading: "Caricamento regole", unavailable: "Impossibile caricare le regole. Riprova", and: "e", notAvailable: "Non disponibile", fieldType: "Tipo di risposta", group: "Gruppo", logic: "Sequenza delle domande", recovered: "Elemento non collegato o ciclico", actionValues: "Valori configurati", unknownDisposition: "Disposizione non trovata", mode: "Modalità", history: "Cronologia esecuzione azioni", emailTemplate: "ID modello e-mail", smsTemplate: "ID modello SMS" },
  de: { admin: "Admin-Vorschau · nicht die Agentenansicht", disclaimer: "Schreibgeschützte Ansicht des konfigurierten Verhaltens. Hier wird nichts ausgeführt.", structure: "Checklistenstruktur", questions: "Fragen", actions: "Serviceaktionen", workflows: "Workflow-Regeln", emptyActions: "Keine Serviceaktionen konfiguriert", emptyWorkflows: "Keine Workflow-Regeln konfiguriert", when: "Wann", if: "Wenn", then: "Dann", otherwise: "Sonst", required: "Pflicht", hidden: "Ausgeblendet", loading: "Workflow-Regeln werden geladen", unavailable: "Regeln konnten nicht geladen werden. Erneut versuchen", and: "und", notAvailable: "Nicht verfügbar", fieldType: "Antworttyp", group: "Gruppe", logic: "Fragenreihenfolge", recovered: "Nicht verknüpfter oder zyklischer Eintrag", actionValues: "Konfigurierte Werte", unknownDisposition: "Disposition nicht gefunden", mode: "Modus", history: "Aktionsausführungsverlauf", emailTemplate: "E-Mail-Vorlagen-ID", smsTemplate: "SMS-Vorlagen-ID" },
};
const actionNames: Record<string, string[]> = {
  assign_task: ["Assign a task", "Priradiť úlohu", "Přiřadit úkol", "Feladat kiosztása", "Atribuie o sarcină", "Assegna un’attività", "Aufgabe zuweisen"],
  send_email_group: ["Email a group", "Poslať e-mail skupine", "Poslat e-mail skupině", "E-mail küldése csoportnak", "Trimite e-mail grupului", "Invia e-mail al gruppo", "E-Mail an Gruppe"],
  notify_email: ["Email notification", "E-mailové upozornenie", "E-mailové upozornění", "E-mail-értesítés", "Notificare prin e-mail", "Notifica e-mail", "E-Mail-Benachrichtigung"],
  send_sms: ["Send an SMS", "Poslať SMS", "Poslat SMS", "SMS küldése", "Trimite SMS", "Invia SMS", "SMS senden"],
  send_contact_email: ["Email the contact", "Poslať e-mail kontaktu", "Poslat e-mail kontaktu", "E-mail a kapcsolatnak", "Trimite e-mail contactului", "Invia e-mail al contatto", "E-Mail an Kontakt"],
  set_contact_status: ["Update contact status", "Zmeniť stav kontaktu", "Změnit stav kontaktu", "Kapcsolati állapot módosítása", "Actualizează starea contactului", "Aggiorna lo stato del contatto", "Kontaktstatus ändern"],
  set_callback: ["Schedule a callback", "Naplánovať spätné volanie", "Naplánovat zpětné volání", "Visszahívás ütemezése", "Programează un apel", "Pianifica una richiamata", "Rückruf planen"],
  notify_role: ["Notify a role", "Upozorniť rolu", "Upozornit roli", "Szerepkör értesítése", "Notifică un rol", "Notifica un ruolo", "Rolle benachrichtigen"],
  sys_webhook: ["Send a system update", "Odoslať systémovú aktualizáciu", "Odeslat systémovou aktualizaci", "Rendszerfrissítés küldése", "Trimite o actualizare de sistem", "Invia un aggiornamento di sistema", "Systemaktualisierung senden"],
};
const actionIcons = [ClipboardList, Mail, Bell, MessageSquare, Send, Tag, Phone, Activity, Webhook];
const actionKeys = Object.keys(actionNames);
const workflowMeta: Record<string, { enabled: string; paused: string; agent: string; background: string; all: string; any: string; cascade: string }> = {
  en: { enabled: "Enabled", paused: "Paused", agent: "Agent confirms", background: "Background status changes", all: "Match every condition", any: "Match any condition", cascade: "also runs target actions" },
  sk: { enabled: "Zapnuté", paused: "Pozastavené", agent: "Potvrdenie agentom", background: "Zmena stavu na pozadí", all: "Musia platiť všetky podmienky", any: "Stačí jedna podmienka", cascade: "spustí aj akcie cieľa" },
  cs: { enabled: "Zapnuto", paused: "Pozastaveno", agent: "Potvrzení agentem", background: "Změna stavu na pozadí", all: "Musí platit všechny podmínky", any: "Stačí jedna podmínka", cascade: "spustí také akce cíle" },
  hu: { enabled: "Bekapcsolva", paused: "Szüneteltetve", agent: "Ügynöki megerősítés", background: "Háttérbeli állapotváltozás", all: "Minden feltétel teljesüljön", any: "Bármely feltétel elegendő", cascade: "a célműveleteket is futtatja" },
  ro: { enabled: "Activată", paused: "În pauză", agent: "Confirmare de către agent", background: "Modificare de stare în fundal", all: "Toate condițiile trebuie îndeplinite", any: "Este suficientă orice condiție", cascade: "rulează și acțiunile țintă" },
  it: { enabled: "Attiva", paused: "In pausa", agent: "Conferma dell’agente", background: "Modifica dello stato in background", all: "Devono corrispondere tutte le condizioni", any: "È sufficiente una condizione", cascade: "esegue anche le azioni di destinazione" },
  de: { enabled: "Aktiviert", paused: "Pausiert", agent: "Bestätigung durch Agenten", background: "Statusänderung im Hintergrund", all: "Alle Bedingungen müssen zutreffen", any: "Eine beliebige Bedingung genügt", cascade: "führt auch Zielaktionen aus" },
};
const selectionLabels: Record<string, { single: string; multiple: string; autoConfirm: string }> = {
  en: { single: "Single choice", multiple: "Multiple choices", autoConfirm: "Parent confirms when a sub-question is answered" },
  sk: { single: "Jedna možnosť", multiple: "Viac možností", autoConfirm: "Nadradený krok sa potvrdí po odpovedi na podotázku" },
  cs: { single: "Jedna možnost", multiple: "Více možností", autoConfirm: "Nadřazený krok se potvrdí po odpovědi na podotázku" },
  hu: { single: "Egy választás", multiple: "Több választás", autoConfirm: "A szülőlépés megerősödik az alkérdés megválaszolásakor" },
  ro: { single: "O singură opțiune", multiple: "Opțiuni multiple", autoConfirm: "Pasul părinte se confirmă după răspunsul la subîntrebare" },
  it: { single: "Scelta singola", multiple: "Scelte multiple", autoConfirm: "Il passaggio padre si conferma rispondendo alla sotto-domanda" },
  de: { single: "Einzelauswahl", multiple: "Mehrfachauswahl", autoConfirm: "Übergeordneter Schritt bestätigt sich bei Antwort auf Unterfrage" },
};
const priorities: Record<string, Record<string, string>> = {
  en: { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" },
  sk: { low: "Nízka", medium: "Stredná", high: "Vysoká", urgent: "Urgentná" },
  cs: { low: "Nízká", medium: "Střední", high: "Vysoká", urgent: "Urgentní" },
  hu: { low: "Alacsony", medium: "Közepes", high: "Magas", urgent: "Sürgős" },
  ro: { low: "Scăzută", medium: "Medie", high: "Ridicată", urgent: "Urgentă" },
  it: { low: "Bassa", medium: "Media", high: "Alta", urgent: "Urgente" },
  de: { low: "Niedrig", medium: "Mittel", high: "Hoch", urgent: "Dringend" },
};
const localizedText = (value: string | null | undefined, locale: string) => {
  if (!value) return "";
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const selected = parsed[locale] ?? parsed.sk ?? parsed.en;
      if (typeof selected === "string") return selected;
    }
  } catch { /* Plain-text content is expected for most records. */ }
  return value;
};
const targetName = (items: Item[], id: string, locale: string) => {
  const item = items.find(row => row.id === id);
  return (item ? localizedText(item.label, locale) : "") || localizedText(items.flatMap(row => row.questions).find(row => row.id === id)?.questionText, locale) || id;
};
export function StatusListAdminPreview({ items, locale }: { items: Item[]; locale: string }) {
  const lang = ["en", "sk", "cs", "hu", "ro", "it", "de"].includes(locale) ? locale : "en";
  const t = copy[lang];
  const selectionCopy = selectionLabels[lang];
  const workflowActionCopy = getStatusWorkflowActionCopy(locale);
  const workflowCopy = getStatusListWorkflowCopy(locale);
  const studioCopy = getStatusListQuestionStudioCopy(locale);
  const meta = workflowMeta[lang];
  const campaignId = items[0]?.campaignId || "";
  const dispositions = useQuery<Array<{ id: string | number; label?: string | null; name?: string | null }>>({
    queryKey: ["/api/campaigns", campaignId, "dispositions"],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/dispositions`, { credentials: "include" });
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    },
    enabled: items.some(item => item.automations.some(action => !!action.dispositionId) || item.questions.some(question => question.automations.some(action => !!action.dispositionId))),
  });
  const dispositionName = (id: string) => {
    const found = dispositions.data?.find(value => String(value.id) === String(id));
    if (found) return found.label || found.name || id;
    return dispositions.isError ? `${t.notAvailable} · ${id}` : `${t.unknownDisposition} · ${id}`;
  };
  const fieldLabels: Record<string, string> = {
    answer: workflowCopy.answer, hospital_id: workflowCopy.hospital, clinic_id: workflowCopy.clinic,
    status: workflowCopy.status, contact_type: workflowCopy.contactType,
  };
  const operatorLabels: Record<string, string> = {
    equals: workflowCopy.equals, not_equals: workflowCopy.notEquals,
    empty: workflowCopy.opEmpty, not_empty: workflowCopy.opNotEmpty,
  };
  const fieldName = (field: string) => fieldLabels[field] || field;
  const operatorName = (op: string) => operatorLabels[op] || op;
  const formatWorkflowValue = (value: unknown) => typeof value === "boolean" ? (value ? workflowCopy.booleanTrue : workflowCopy.booleanFalse) : String(value);
  const joinerName = (logic?: string) => String(logic || "AND").toUpperCase() === "ONE" ? studioCopy.logicOne : String(logic || "AND").toUpperCase() === "OR" ? studioCopy.logicOr : studioCopy.logicAnd;
  const root = `/api/campaigns/${campaignId}/status-list-workflows`;
  const workflows = useQuery<{ rules: SavedStatusListWorkflow[] }>({
    queryKey: ["/api/campaigns", items[0]?.campaignId, "status-list-workflows"],
    queryFn: async () => { const response = await fetch(root, { credentials: "include" }); if (!response.ok) throw new Error(String(response.status)); return response.json(); },
    enabled: items.length > 0,
  });
  const formatServiceCondition = (automation: Automation) => {
    if (automation.conditionJson) {
      try {
        const parsed = JSON.parse(automation.conditionJson);
        if (parsed?.__type === "field_changed_to") {
          return `${catalogFieldLabel(locale, parsed.field, parsed.field)} ${catalogOperatorLabel(locale, parsed.op || "eq", parsed.op || "=")} ${parsed.value ?? ""}`;
        }
        if (Array.isArray(parsed?.rules)) {
          const logic = String(parsed.logic || "AND").toUpperCase() === "OR" ? actionCopy(locale, "or") : actionCopy(locale, "and");
          return parsed.rules.map((rule: { field?: string; op?: string; value?: unknown }) =>
            `${catalogFieldLabel(locale, rule.field || "", rule.field || "")} ${catalogOperatorLabel(locale, rule.op || "", rule.op || "")} ${rule.value ?? ""}`
          ).join(` · ${logic} · `);
        }
        return actionCopy(locale, "savedUnknown");
      } catch {
        return actionCopy(locale, "savedUnknown");
      }
    }
    if (automation.conditionField && automation.conditionField !== "always") {
      return `${catalogFieldLabel(locale, automation.conditionField, automation.conditionField)} ${catalogOperatorLabel(locale, automation.conditionOperator || "eq", automation.conditionOperator || "=")} ${automation.conditionValue ?? ""}`;
    }
    return "";
  };
  const visitedItems = new Set<string>();
  const roots = items.filter(item => !item.parentId || !items.some(parent => parent.id === item.parentId)).sort((a, b) => a.sortOrder - b.sortOrder);
  const children = (id: string) => items.filter(item => item.parentId === id).sort((a, b) => a.sortOrder - b.sortOrder);
  const renderActions = (actions: Automation[]) => actions.length ? actions.map(action => {
    const indexOfAction = actionKeys.indexOf(action.actionType);
    const Icon = actionIcons[indexOfAction] || Zap;
    const name = statusListActionLabel(action.actionType, locale);
    const when = formatServiceCondition(action);
    return <div className="sl-preview-action" key={action.id}><Icon size={14}/><div><strong>{name}</strong>
      {action.targetRole && <small>{action.targetRole}</small>}
      {action.taskDescription && <small>{action.taskDescription}</small>}
      {when && <small><b>{t.if}:</b> {when}</small>}
      {action.taskDeadlineOffset && <small>{actionCopy(locale, "deadline")}: {action.taskDeadlineOffset}</small>}
      {action.taskPriority && <small>{actionCopy(locale, "priority")}: {priorities[lang][action.taskPriority] || action.taskPriority}</small>}
      {action.taskGroupId && <small>{actionCopy(locale, "taskGroup")}: {action.taskGroupId}</small>}
      {action.emailRecipients?.length ? <small>{actionCopy(locale, "emailRecipients")}: {action.emailRecipients.join(", ")}</small> : null}
      {action.emailTemplateId && <small>{t.emailTemplate}: {action.emailTemplateId}</small>}
      {action.smsTemplateId && <small>{t.smsTemplate}: {action.smsTemplateId}</small>}
      {action.smsProvider && <small>{actionCopy(locale, "smsGateway")}: {action.smsProvider}</small>}
      {action.webhookTarget && <small>{action.webhookTarget}</small>}
      {action.dispositionId && <small>{actionCopy(locale, "dispCode")}: {dispositionName(action.dispositionId)}</small>}
      {(action.actionType === "set_callback" || action.callbackOffsetDays != null) && <>
        {action.callbackOffsetDays != null && <small>{actionCopy(locale, "callbackDays")}: {action.callbackOffsetDays}</small>}
        {action.callbackTime && <small>{actionCopy(locale, "callbackTime")}: {action.callbackTime}</small>}
        {<small>{actionCopy(locale, action.callbackBusinessDaysOnly !== false ? "callbackBusinessDaysOn" : "callbackBusinessDaysOff")}</small>}
        {action.callbackExistingPolicy && <small>{actionCopy(locale, "callbackExistingPolicy")}: {actionCopy(locale, action.callbackExistingPolicy === "keep_existing" ? "callbackPolicyKeep" : "callbackPolicyReplace")}</small>}
      </>}
      <StatusListServiceHistory campaignId={campaignId} locale={locale} automationId={action.id}/>
    </div></div>;
  }) : <p className="sl-preview-muted">{t.emptyActions}</p>;
  const renderItem = (item: Item, depth: number, seen: Set<string>, recovered = false) => {
    if (seen.has(item.id) || visitedItems.has(item.id)) return null;
    visitedItems.add(item.id);
    const nextSeen = new Set(seen).add(item.id);
    return <article key={item.id} className="sl-preview-item" style={{ marginInlineStart: Math.min(depth, 5) * 14 }}>
      <header><code>{item.stepId}</code><strong>{localizedText(item.label, locale)}</strong>{item.required && <span>{t.required}</span>}{item.isHidden && <span>{t.hidden}</span>}{recovered && <span>{t.recovered}</span>}</header>
      {item.description && <p>{localizedText(item.description, locale)}</p>}
      {item.restrictions && <p><b>{studioCopy.restrictions}:</b> {item.restrictions}</p>}
      {item.nextStepId && <p><b>{t.then}:</b> {items.find(row => row.stepId === item.nextStepId) ? localizedText(items.find(row => row.stepId === item.nextStepId)?.label, locale) : item.nextStepId}</p>}
      {(item.questionSelectionMode || item.autoConfirmOnSubQuestion) && <p><b>{t.logic}:</b> {item.questionSelectionMode ? selectionCopy[item.questionSelectionMode] : ""}{item.autoConfirmOnSubQuestion ? ` · ${selectionCopy.autoConfirm}` : ""}</p>}
      <section><h5>{t.actions}</h5>{renderActions(item.automations)}</section>
      {!!item.questions.length && <section><h5>{t.questions}</h5>{item.questions.map(question => <div className="sl-preview-question" key={question.id}>
        <strong>{localizedText(question.questionText, locale)}{question.required ? " *" : ""}{question.isHidden && <span> · {t.hidden}</span>}</strong>{question.description && <p>{localizedText(question.description, locale)}</p>}
        {question.fieldType && <small>{t.fieldType}: {studioCopy.fieldTypeOptions[question.fieldType] || question.fieldType}</small>}
        {question.groupName && <small>{t.group}: {localizedText(question.groupName, locale)}</small>}
        {question.logicOperator && <small>{t.logic}: {joinerName(question.logicOperator)}</small>}
        {question.gotoQuestionId && <small>{joinerName(question.logicOperator)} → {targetName(items, question.gotoQuestionId, locale)}</small>}
        {renderActions(question.automations)}
      </div>)}</section>}
      {children(item.id).map(child => renderItem(child, depth + 1, nextSeen, false))}
    </article>;
  };
  return <section className="sl-admin-preview" aria-label={t.admin}>
    <header><div><strong>{t.admin}</strong><p>{t.disclaimer}</p></div><Activity size={18}/></header>
    <h4>{t.structure}</h4>
    {dispositions.isError && <button type="button" onClick={() => void dispositions.refetch()}>{t.unavailable}</button>}
    {roots.map(item => renderItem(item, 0, new Set(), !!item.parentId && !items.some(parent => parent.id === item.parentId)))}
    {items.length === 0 && <p className="sl-preview-muted">{t.notAvailable}</p>}
    {items.some(item => !visitedItems.has(item.id)) && <div className="sl-preview-recovered"><strong>{t.recovered}</strong>{items.filter(item => !visitedItems.has(item.id)).map(item => renderItem(item, 0, new Set(), true))}</div>}
    <section className="sl-preview-rules"><h4>{t.workflows}</h4>
      {workflows.isLoading && <p className="sl-preview-muted">{t.loading}</p>}
      {workflows.isError && <button type="button" onClick={() => void workflows.refetch()}>{t.unavailable}</button>}
      {workflows.data?.rules.length === 0 && <p className="sl-preview-muted">{t.emptyWorkflows}</p>}
    {workflows.data?.rules.map(rule => <article key={rule.id}>
        <strong>{rule.name}</strong><span className="sl-preview-rule-status">{rule.enabled ? meta.enabled : meta.paused}</span>
        <small>{rule.trigger === "agent_confirmation" ? meta.agent : meta.background} · {rule.logic === "and" ? meta.all : meta.any}{rule.runTargetAutomations ? ` · ${meta.cascade}` : ""}</small>
        <p><b>{t.when}:</b> {targetName(items, rule.source.id, locale)} {rule.sourceValue !== undefined ? `= ${formatWorkflowValue(rule.sourceValue)}` : ""}</p>
        {rule.conditions.map((condition, index) => <p key={index}><b>{t.if}:</b> {condition.ref ? targetName(items, condition.ref.id, locale) : fieldName(condition.field)} {operatorName(condition.op)} {condition.value === undefined ? "" : formatWorkflowValue(condition.value)}</p>)}
        {rule.thenActions.map((action, index) => <p key={`then-${index}`}><b>{t.then}:</b> {workflowActionCopy.labels[action.type]} → {targetName(items, action.target.id, locale)}
          {"value" in action && <> · {t.actionValues}: {formatWorkflowValue(action.value)}</>}
          {"text" in action && <> · {t.actionValues}: {action.text}</>}
          {"mode" in action && <> · {t.mode}: {action.mode === "if_empty" ? workflowCopy.ifEmpty : workflowCopy.replace}</>}
        </p>)}
        {rule.elseActions.map((action, index) => <p key={`else-${index}`}><b>{t.otherwise}:</b> {workflowActionCopy.labels[action.type]} → {targetName(items, action.target.id, locale)}
          {"value" in action && <> · {t.actionValues}: {formatWorkflowValue(action.value)}</>}
          {"text" in action && <> · {t.actionValues}: {action.text}</>}
          {"mode" in action && <> · {t.mode}: {action.mode === "if_empty" ? workflowCopy.ifEmpty : workflowCopy.replace}</>}
        </p>)}
      </article>)}
    </section>
  </section>;
}
