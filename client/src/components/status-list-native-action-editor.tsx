import React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Mail, MessageSquareText } from "lucide-react";
import { AutomationRecipientTargetSelect } from "@/components/automation-recipient-target-select";
import { AutomationCreateTaskAction } from "@/components/automation-create-task-action";
import { AutomationNotifyUserAction } from "@/components/automation-notify-user-action";
import { AutomationSendEmailAction } from "@/components/automation-send-email-action";
import { AutomationSendSmsAction } from "@/components/automation-send-sms-action";
import type { StatusListActionDraft } from "@/lib/status-list-action-draft";
import { STATUS_LIST_ACTIVITY_FIELDS } from "@shared/status-list-template-context";
import { templateFieldLabel } from "./automation-template-field-label";

type User = { id: string; fullName?: string; email?: string; label?: string };
type Group = { id: string; name: string; displayAlias?: string | null; members?: Array<{ userId: string }> };
type Role = { id: string; name: string; description?: string | null; isActive?: boolean };
const text: Record<string, Record<string, string>> = {
  en: { conversion: "Convert this saved action to the modern editor", legacy: "This saved action still uses its legacy behavior. It will remain unchanged until you explicitly convert it.", loading: "Loading recipients…", error: "Could not load automation recipients.", retry: "Retry", inherited: "Gateway inherited from the campaign mission", conflict: "This saved gateway conflicts with the mission gateway. Choose the inherited gateway before saving.", choose: "Choose a recipient", user: "User", group: "Group", role: "Role", selected: "Selected recipients", remove: "Remove", toContact: "Contact email is provided by the status-list event.", owner: "Personal sender uses the manager who saves this configuration.", noTargets: "Choose at least one user, group, or role.", event: "Status-list event", legacyTemplate: "Legacy template {id} is preserved separately. Select it in the modern editor to save a new snapshot." },
  sk: { conversion: "Previesť túto uloženú akciu na moderný editor", legacy: "Táto uložená akcia stále používa pôvodné správanie. Zostane nezmenená, kým ju výslovne neprevediete.", loading: "Načítavajú sa príjemcovia…", error: "Príjemcov automatizácie sa nepodarilo načítať.", retry: "Skúsiť znova", inherited: "Brána sa preberá z kampane", conflict: "Uložená brána nezodpovedá kampani. Pred uložením vyberte zdedenú bránu.", choose: "Vybrať príjemcu", user: "Používateľ", group: "Skupina", role: "Rola", selected: "Vybraní príjemcovia", remove: "Odstrániť", toContact: "E-mail kontaktu poskytuje udalosť stavového zoznamu.", owner: "Osobný odosielateľ používa manažéra, ktorý konfiguráciu uloží.", noTargets: "Vyberte aspoň jedného používateľa, skupinu alebo rolu.", event: "Udalosť stavového zoznamu", legacyTemplate: "Pôvodná šablóna {id} zostáva uložená samostatne. Vyberte ju v modernom editore a uložte novú snímku." },
  cs: { conversion: "Převést tuto uloženou akci do moderního editoru", legacy: "Tato uložená akce stále používá původní chování. Zůstane beze změny, dokud ji výslovně nepřevedete.", loading: "Načítají se příjemci…", error: "Příjemce automatizace se nepodařilo načíst.", retry: "Zkusit znovu", inherited: "Brána je převzata z kampaně", conflict: "Uložená brána je v rozporu s kampaní. Před uložením vyberte zděděnou bránu.", choose: "Vybrat příjemce", user: "Uživatel", group: "Skupina", role: "Role", selected: "Vybraní příjemci", remove: "Odebrat", toContact: "E-mail kontaktu poskytuje událost stavového seznamu.", owner: "Osobní odesílatel používá manažera, který konfiguraci uloží.", noTargets: "Vyberte alespoň jednoho uživatele, skupinu nebo roli.", event: "Událost stavového seznamu", legacyTemplate: "Původní šablona {id} zůstává uložena samostatně. Vyberte ji v moderním editoru a uložte nový snímek." },
  hu: { conversion: "Mentett művelet átalakítása a modern szerkesztőre", legacy: "Ez a mentett művelet még a régi működést használja. Változatlan marad, amíg kifejezetten át nem alakítja.", loading: "Címzettek betöltése…", error: "Nem sikerült betölteni az automatizálás címzettjeit.", retry: "Újra", inherited: "Az átjáró a kampányból öröklődik", conflict: "A mentett átjáró eltér a kampányétól. Mentés előtt válassza az örökölt átjárót.", choose: "Címzett kiválasztása", user: "Felhasználó", group: "Csoport", role: "Szerepkör", selected: "Kiválasztott címzettek", remove: "Eltávolítás", toContact: "A kapcsolati e-mailt az állapotlista eseménye adja.", owner: "A személyes feladó a konfigurációt mentő vezetőt használja.", noTargets: "Válasszon legalább egy felhasználót, csoportot vagy szerepkört.", event: "Állapotlista-esemény", legacyTemplate: "A régi {id} sablon külön megmarad. Válassza ki a modern szerkesztőben, ha új pillanatképet szeretne menteni." },
  ro: { conversion: "Convertește acțiunea salvată în editorul modern", legacy: "Această acțiune salvată folosește încă comportamentul vechi. Nu se schimbă până când nu o convertiți explicit.", loading: "Se încarcă destinatarii…", error: "Destinatarii automatizării nu au putut fi încărcați.", retry: "Reîncearcă", inherited: "Gateway-ul este preluat din campanie", conflict: "Gateway-ul salvat nu corespunde campaniei. Alegeți gateway-ul moștenit înainte de salvare.", choose: "Alegeți un destinatar", user: "Utilizator", group: "Grup", role: "Rol", selected: "Destinatari selectați", remove: "Elimină", toContact: "E-mailul contactului este furnizat de evenimentul listei de status.", owner: "Expeditorul personal folosește managerul care salvează configurația.", noTargets: "Alegeți cel puțin un utilizator, grup sau rol.", event: "Evenimentul listei de status", legacyTemplate: "Șablonul vechi {id} este păstrat separat. Selectați-l în editorul modern pentru a salva o nouă copie." },
  it: { conversion: "Converti questa azione salvata nell’editor moderno", legacy: "Questa azione salvata usa ancora il comportamento precedente. Rimarrà invariata finché non la converti esplicitamente.", loading: "Caricamento destinatari…", error: "Impossibile caricare i destinatari dell’automazione.", retry: "Riprova", inherited: "Gateway ereditato dalla campagna", conflict: "Il gateway salvato è in conflitto con quello della campagna. Scegli il gateway ereditato prima di salvare.", choose: "Scegli un destinatario", user: "Utente", group: "Gruppo", role: "Ruolo", selected: "Destinatari selezionati", remove: "Rimuovi", toContact: "L’e-mail del contatto è fornita dall’evento della lista di stato.", owner: "Il mittente personale usa il manager che salva la configurazione.", noTargets: "Scegli almeno un utente, gruppo o ruolo.", event: "Evento della lista di stato", legacyTemplate: "Il modello precedente {id} è conservato separatamente. Selezionalo nell’editor moderno per salvare una nuova copia." },
  de: { conversion: "Gespeicherte Aktion in den modernen Editor umwandeln", legacy: "Diese gespeicherte Aktion verwendet noch das bisherige Verhalten. Sie bleibt unverändert, bis Sie sie ausdrücklich umwandeln.", loading: "Empfänger werden geladen…", error: "Automatisierungsempfänger konnten nicht geladen werden.", retry: "Erneut versuchen", inherited: "Gateway wird aus der Kampagne übernommen", conflict: "Das gespeicherte Gateway widerspricht der Kampagne. Wählen Sie vor dem Speichern das übernommene Gateway.", choose: "Empfänger auswählen", user: "Benutzer", group: "Gruppe", role: "Rolle", selected: "Ausgewählte Empfänger", remove: "Entfernen", toContact: "Die Kontakt-E-Mail wird vom Statuslistenereignis bereitgestellt.", owner: "Als persönlicher Absender gilt der Manager, der diese Konfiguration speichert.", noTargets: "Wählen Sie mindestens einen Benutzer, eine Gruppe oder Rolle.", event: "Statuslistenereignis", legacyTemplate: "Die alte Vorlage {id} bleibt separat erhalten. Wählen Sie sie im modernen Editor aus, um einen neuen Snapshot zu speichern." },
};
const localCopy = (locale: string) => text[locale.split("-")[0]] || text.en;
async function queryJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}
export function filterStatusListActionVariables(values: { token: string; label: string }[], locale = "en") {
  const contactFields = ["id", "type", "name", "firstName", "lastName", "email", "phone", "country", "countryCode"];
  const allowed = new Set(["event.country", "event.entity", "event.actor", "campaign.id", "campaign.name", "user.id"]);
  for (const field of contactFields) {
    allowed.add(`contact.${field}`);
    allowed.add(`newValues.${field}`);
  }
  allowed.add("newValues.campaignId");
  allowed.add("newValues.campaignContactId");
  for (const field of STATUS_LIST_ACTIVITY_FIELDS) allowed.add(field.value);
  const seen = new Set<string>();
  return [...values, ...STATUS_LIST_ACTIVITY_FIELDS.map(field => ({
    token: `{{${field.value}}}`, label: templateFieldLabel(field.value, locale, []),
  }))].filter(variable => {
    const token = variable.token.replace(/^{{\s*|\s*}}$/g, "").trim();
    if (!allowed.has(token) || seen.has(token)) return false;
    seen.add(token);
    return true;
  });
}

export function StatusListNativeActionEditor({ draft, setDraft, locale, countryCodes, missionGateway, sourceLabel, variables: suppliedVariables, actionId, onDraftValidityChange, legacyTemplateId }:
  { draft: StatusListActionDraft; setDraft: React.Dispatch<React.SetStateAction<StatusListActionDraft>>; locale: string; countryCodes: string[]; missionGateway: string | null; sourceLabel: string; variables: { token: string; label: string }[]; actionId?: string; onDraftValidityChange: (invalid: boolean) => void; legacyTemplateId?: string | null }) {
  const copy = localCopy(locale);
  const usersQ = useQuery<User[]>({ queryKey: ["/api/automation/users"], queryFn: () => queryJson("/api/automation/users") });
  const groupsQ = useQuery<Group[]>({ queryKey: ["/api/task-groups"], queryFn: () => queryJson("/api/task-groups") });
  const rolesQ = useQuery<Role[]>({ queryKey: ["/api/roles"], queryFn: () => queryJson("/api/roles") });
  const config = draft.serviceActionConfig || {};
  const setConfig = (next: Record<string, any>) => setDraft(previous => ({ ...previous, serviceActionConfig: next }));
  const users = (usersQ.data || []).map(user => ({ id: String(user.id), label: user.label || `${user.fullName || user.id}${user.email ? ` (${user.email})` : ""}` }));
  const groups = groupsQ.data || [];
  const roles = rolesQ.data || [];
  const loading = usersQ.isLoading || groupsQ.isLoading || rolesQ.isLoading;
  const failed = [usersQ, groupsQ, rolesQ].some(query => query.isError);
  const retry = () => [usersQ, groupsQ, rolesQ].filter(query => query.isError).forEach(query => { void query.refetch(); });
  const variables = filterStatusListActionVariables(suppliedVariables, locale).map(variable => ({ value: variable.token.replace(/^{{|}}$/g, ""), label: variable.label }));

  return <section className="slsae-native-action" data-testid="status-list-native-action">
    {legacyTemplateId && <p className="slsae-callout wide">{copy.legacyTemplate.replace("{id}", legacyTemplateId)}</p>}
    {(loading || failed) && <div className="slsae-callout wide" role={failed ? "alert" : "status"}>
      {failed ? <>{copy.error} <button type="button" onClick={retry}>{copy.retry}</button></> : copy.loading}
    </div>}
    {draft.actionType === "assign_task" && <div className="wide"><AutomationCreateTaskAction config={config} onChange={setConfig} users={users} groups={groups} roles={roles}
      availableVariables={variables} sourceModule="status_list" testId="status-list-task-action" /></div>}
    {draft.actionType === "notify_role" && <div className="wide">
      <AutomationRecipientTargetSelect mode="notify" config={config} userOptions={users} groups={groups} roles={roles} onChange={setConfig} index={0} />
      <AutomationNotifyUserAction config={config} onChange={setConfig} availableVariables={variables} index={0} sourceModule="status_list"
        recipientSelector={<span className="sr-only">{copy.selected}</span>} />
    </div>}
    {draft.actionType === "send_email_group" || draft.actionType === "notify_email" || draft.actionType === "send_contact_email"
      ? <div className="wide">
        {draft.actionType === "send_contact_email" && <p className="slsae-callout"><Mail size={16} /> {copy.toContact}</p>}
        <AutomationSendEmailAction config={config} onChange={setConfig} users={(usersQ.data || []).map(user => ({ id: String(user.id), fullName: user.fullName || user.label || String(user.id), email: user.email || "" }))}
          groups={groups} roles={roles} countryCodes={countryCodes} availableVariables={variables}
          recipientTemplates={variables.map(variable => variable.value).filter(value => /email$/i.test(value))} sourceModule="status_list" ruleId={actionId} testId="status-list-email-action"
          onDraftValidityChange={onDraftValidityChange} />
        <p className="slsae-callout"><Check size={16} /> {copy.owner}</p>
      </div>
      : null}
    {draft.actionType === "send_sms" && <div className="wide">
      {missionGateway && <p className="slsae-callout"><MessageSquareText size={16} /> {copy.inherited}: {missionGateway}</p>}
      {missionGateway && config.provider && config.provider !== "default" && config.provider !== missionGateway && <p className="slsae-error" role="alert"><AlertTriangle size={16} /> {copy.conflict}</p>}
      <AutomationSendSmsAction config={config} onChange={next => setConfig(next)} availableVariables={variables} countryCodes={countryCodes}
        sourceModule="status_list" testId="status-list-sms-action" onDraftValidityChange={onDraftValidityChange} />
    </div>}
    <small className="slsae-callout wide">{copy.event} · {sourceLabel}</small>
  </section>;
}
