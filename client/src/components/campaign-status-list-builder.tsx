import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CLA_TEMPLATE, CLB_TEMPLATE, ROLE_BADGE_MAP, getStepLabel, getAutoLabel, getStepDescription, getAutoTaskDescription } from "@/data/cla-template";
import { useI18n } from "@/i18n";
import {
  Plus, Trash2, ChevronDown, ChevronRight, GripVertical, Zap,
  ClipboardList, Mail, MessageSquare, Tag, Webhook, Bell,
  CheckSquare, Radio, Info, Loader2, Pencil, X, Check, Download,
  BookTemplate, ChevronUp, Eye, EyeOff, ListChecks,
} from "lucide-react";

type StatusListAutomation = {
  id: string;
  statusListItemId: string;
  sortOrder: number;
  actionType: string;
  targetRole: string | null;
  emailTemplateId: string | null;
  smsTemplateId: string | null;
  taskDescription: string | null;
  taskDeadlineOffset: string | null;
  taskPriority: string;
  conditionField: string | null;
  conditionOperator: string | null;
  conditionValue: string | null;
  dispositionId: string | null;
};

type StatusListItem = {
  id: string;
  campaignId: string;
  stepId: string;
  label: string;
  description: string | null;
  sortOrder: number;
  required: boolean;
  parentId: string | null;
  confirmationType: string;
  nextStepId: string | null;
  restrictions: string | null;
  automations: StatusListAutomation[];
};

const SL: Record<string, Record<string, string>> = {
  nextStep:       { sk: "Nasledujúci krok", en: "Next step", cs: "Další krok", hu: "Következő lépés", ro: "Pasul următor", it: "Passo successivo", de: "Nächster Schritt" },
  nextStepPh:     { sk: "napr. CLA-04 alebo —", en: "e.g. CLA-04 or —", cs: "např. CLA-04 nebo —", hu: "pl. CLA-04 vagy —", ro: "ex. CLA-04 sau —", it: "es. CLA-04 o —", de: "z.B. CLA-04 oder —" },
  restrictions:   { sk: "Obmedzenia / FC pravidlá", en: "Restrictions / FC rules", cs: "Omezení / FC pravidla", hu: "Korlátozások / FC szabályok", ro: "Restricții / Reguli FC", it: "Restrizioni / Regole FC", de: "Einschränkungen / FC-Regeln" },
  restrictionsPh: { sk: "FC podmienky, pravidlá, výnimky...", en: "FC conditions, rules, exceptions...", cs: "FC podmínky, pravidla, výjimky...", hu: "FC feltételek, szabályok, kivételek...", ro: "Condiții FC, reguli, excepții...", it: "Condizioni FC, regole, eccezioni...", de: "FC-Bedingungen, Regeln, Ausnahmen..." },
  disposition:    { sk: "Dispozícia / Status kontaktu", en: "Disposition / Contact status", cs: "Dispozice / Stav kontaktu", hu: "Diszpozíció / Kontakt állapota", ro: "Dispoziție / Status contact", it: "Disposizione / Stato contatto", de: "Disposition / Kontaktstatus" },
  selectDisp:     { sk: "Vybrať dispozíciu...", en: "Select disposition...", cs: "Vybrat dispozici...", hu: "Diszpozíció kiválasztása...", ro: "Selectați dispoziția...", it: "Seleziona disposizione...", de: "Disposition auswählen..." },
  emailTemplate:  { sk: "Šablóna emailu", en: "Email template", cs: "E-mailová šablona", hu: "E-mail sablon", ro: "Șablon email", it: "Modello email", de: "E-Mail-Vorlage" },
  selectEmail:    { sk: "Vybrať šablónu...", en: "Select template...", cs: "Vybrat šablonu...", hu: "Sablon kiválasztása...", ro: "Selectați șablonul...", it: "Seleziona modello...", de: "Vorlage auswählen..." },
  restrictionsFC: { sk: "Obmedzenia (FC)", en: "Restrictions (FC)", cs: "Omezení (FC)", hu: "Korlátozások (FC)", ro: "Restricții (FC)", it: "Restrizioni (FC)", de: "Einschränkungen (FC)" },

  at_assign_task:        { sk: "Priradiť úlohu", en: "Assign task", cs: "Přiřadit úkol", hu: "Feladat hozzárendelése", ro: "Atribuire sarcină", it: "Assegna compito", de: "Aufgabe zuweisen" },
  at_send_email_group:   { sk: "Email skupne", en: "Group email", cs: "Skupinový e-mail", hu: "Csoportos e-mail", ro: "Email de grup", it: "Email di gruppo", de: "Gruppen-E-Mail" },
  at_send_sms:           { sk: "SMS zákazníkovi", en: "SMS to contact", cs: "SMS zákazníkovi", hu: "SMS ügyfélnek", ro: "SMS clientului", it: "SMS al contatto", de: "SMS an Kontakt" },
  at_set_contact_status: { sk: "Nastaviť status", en: "Set contact status", cs: "Nastavit stav", hu: "Kontakt státusz beállítása", ro: "Setare status contact", it: "Imposta stato contatto", de: "Kontaktstatus setzen" },
  at_notify_role:        { sk: "Notifikovať rolu", en: "Notify role", cs: "Upozornit roli", hu: "Szerepkör értesítése", ro: "Notifică rolul", it: "Notifica ruolo", de: "Rolle benachrichtigen" },
  at_sys_webhook:        { sk: "Systémový webhook", en: "System webhook", cs: "Systémový webhook", hu: "Rendszer webhook", ro: "Webhook sistem", it: "Webhook di sistema", de: "System-Webhook" },

  rl_back_office:  { sk: "Back Office", en: "Back Office", cs: "Back Office", hu: "Back Office", ro: "Back Office", it: "Back Office", de: "Back Office" },
  rl_coordinator:  { sk: "Koordinátor (KO)", en: "Coordinator (KO)", cs: "Koordinátor (KO)", hu: "Koordinátor (KO)", ro: "Coordonator (KO)", it: "Coordinatore (KO)", de: "Koordinator (KO)" },
  rl_admin:        { sk: "Administrator (DB Admin)", en: "Administrator (DB Admin)", cs: "Administrátor (DB Admin)", hu: "Adminisztrátor (DB Admin)", ro: "Administrator (DB Admin)", it: "Amministratore (DB Admin)", de: "Administrator (DB Admin)" },
  rl_manager:      { sk: "Manager", en: "Manager", cs: "Manager", hu: "Menedzser", ro: "Manager", it: "Manager", de: "Manager" },
  rl_sys:          { sk: "Systém (SYS)", en: "System (SYS)", cs: "Systém (SYS)", hu: "Rendszer (SYS)", ro: "Sistem (SYS)", it: "Sistema (SYS)", de: "System (SYS)" },

  dl_1h:   { sk: "+1 hodina", en: "+1 hour", cs: "+1 hodina", hu: "+1 óra", ro: "+1 oră", it: "+1 ora", de: "+1 Stunde" },
  dl_4h:   { sk: "+4 hodiny", en: "+4 hours", cs: "+4 hodiny", hu: "+4 óra", ro: "+4 ore", it: "+4 ore", de: "+4 Stunden" },
  dl_24h:  { sk: "+24 hodín (1 deň)", en: "+24 hours (1 day)", cs: "+24 hodin (1 den)", hu: "+24 óra (1 nap)", ro: "+24 ore (1 zi)", it: "+24 ore (1 giorno)", de: "+24 Stunden (1 Tag)" },
  dl_2d:   { sk: "+2 dni", en: "+2 days", cs: "+2 dny", hu: "+2 nap", ro: "+2 zile", it: "+2 giorni", de: "+2 Tage" },
  dl_3d:   { sk: "+3 dni", en: "+3 days", cs: "+3 dny", hu: "+3 nap", ro: "+3 zile", it: "+3 giorni", de: "+3 Tage" },
  dl_7d:   { sk: "+7 dní", en: "+7 days", cs: "+7 dní", hu: "+7 nap", ro: "+7 zile", it: "+7 giorni", de: "+7 Tage" },
  dl_14d:  { sk: "+14 dní", en: "+14 days", cs: "+14 dní", hu: "+14 nap", ro: "+14 zile", it: "+14 giorni", de: "+14 Tage" },

  pr_low:    { sk: "Nízka", en: "Low", cs: "Nízká", hu: "Alacsony", ro: "Scăzut", it: "Bassa", de: "Niedrig" },
  pr_medium: { sk: "Stredná", en: "Medium", cs: "Střední", hu: "Közepes", ro: "Mediu", it: "Media", de: "Mittel" },
  pr_high:   { sk: "Vysoká", en: "High", cs: "Vysoká", hu: "Magas", ro: "Ridicat", it: "Alta", de: "Hoch" },
  pr_urgent: { sk: "Urgentná", en: "Urgent", cs: "Urgentní", hu: "Sürgős", ro: "Urgent", it: "Urgente", de: "Dringend" },

  ct_checkbox: { sk: "Zaškrtávacie políčko", en: "Checkbox", cs: "Zaškrtávací políčko", hu: "Jelölőnégyzet", ro: "Casetă de bifare", it: "Casella di spunta", de: "Kontrollkästchen" },
  ct_radio:    { sk: "Výber (Radio)", en: "Radio selection", cs: "Výběr (Radio)", hu: "Rádiógomb", ro: "Selecție (Radio)", it: "Selezione (Radio)", de: "Auswahl (Radio)" },
  ct_info:     { sk: "Informácia (len čítanie)", en: "Information (read-only)", cs: "Informace (jen čtení)", hu: "Tájékoztató (csak olvasható)", ro: "Informație (doar citire)", it: "Informazione (sola lettura)", de: "Information (nur lesen)" },

  ctr_SK: { sk: "Slovensko (SK)", en: "Slovakia (SK)", cs: "Slovensko (SK)", hu: "Szlovákia (SK)", ro: "Slovacia (SK)", it: "Slovacchia (SK)", de: "Slowakei (SK)" },
  ctr_CZ: { sk: "Česko (CZ)", en: "Czech Republic (CZ)", cs: "Česko (CZ)", hu: "Csehország (CZ)", ro: "Cehia (CZ)", it: "Repubblica Ceca (CZ)", de: "Tschechien (CZ)" },
  ctr_HU: { sk: "Maďarsko (HU)", en: "Hungary (HU)", cs: "Maďarsko (HU)", hu: "Magyarország (HU)", ro: "Ungaria (HU)", it: "Ungheria (HU)", de: "Ungarn (HU)" },
  ctr_RO: { sk: "Rumunsko (RO)", en: "Romania (RO)", cs: "Rumunsko (RO)", hu: "Románia (RO)", ro: "România (RO)", it: "Romania (RO)", de: "Rumänien (RO)" },
  ctr_AT: { sk: "Rakúsko (AT)", en: "Austria (AT)", cs: "Rakousko (AT)", hu: "Ausztria (AT)", ro: "Austria (AT)", it: "Austria (AT)", de: "Österreich (AT)" },
  ctr_DE: { sk: "Nemecko (DE)", en: "Germany (DE)", cs: "Německo (DE)", hu: "Németország (DE)", ro: "Germania (DE)", it: "Germania (DE)", de: "Deutschland (DE)" },
  ctr_IT: { sk: "Taliansko (IT)", en: "Italy (IT)", cs: "Itálie (IT)", hu: "Olaszország (IT)", ro: "Italia (IT)", it: "Italia (IT)", de: "Italien (IT)" },
  ctr_US: { sk: "USA (US)", en: "USA (US)", cs: "USA (US)", hu: "USA (US)", ro: "SUA (US)", it: "USA (US)", de: "USA (US)" },

  editAction:    { sk: "Upraviť akciu", en: "Edit action", cs: "Upravit akci", hu: "Akció szerkesztése", ro: "Editare acțiune", it: "Modifica azione", de: "Aktion bearbeiten" },
  newAction:     { sk: "Nová akcia", en: "New action", cs: "Nová akce", hu: "Új akció", ro: "Acțiune nouă", it: "Nuova azione", de: "Neue Aktion" },
  thenLabel:     { sk: "POTOM", en: "THEN", cs: "PAK", hu: "EKKOR", ro: "ATUNCI", it: "POI", de: "DANN" },
  thenSub:       { sk: "Akcia ktorá sa vykoná", en: "Action to be executed", cs: "Akce, která se provede", hu: "Végrehajtandó akció", ro: "Acțiunea care se va executa", it: "Azione da eseguire", de: "Auszuführende Aktion" },
  actionTypeLbl: { sk: "Typ akcie", en: "Action type", cs: "Typ akce", hu: "Akció típusa", ro: "Tip acțiune", it: "Tipo di azione", de: "Aktionstyp" },
  targetRoleLbl: { sk: "Cieľová rola", en: "Target role", cs: "Cílová role", hu: "Célszerepkör", ro: "Rol țintă", it: "Ruolo destinatario", de: "Zielrolle" },
  taskDescLbl:   { sk: "Popis úlohy", en: "Task description", cs: "Popis úkolu", hu: "Feladat leírása", ro: "Descrierea sarcinii", it: "Descrizione compito", de: "Aufgabenbeschreibung" },
  taskDescPh:    { sk: "Popis úlohy pre Back Office / Koordinátora...", en: "Task description for Back Office / Coordinator...", cs: "Popis úkolu pro Back Office / Koordinátora...", hu: "Feladat leírása Back Office / Koordinátor számára...", ro: "Descrierea sarcinii pentru Back Office / Coordonator...", it: "Descrizione compito per Back Office / Coordinatore...", de: "Aufgabenbeschreibung für Back Office / Koordinator..." },
  deadlineLbl:   { sk: "Termín", en: "Deadline", cs: "Termín", hu: "Határidő", ro: "Termen", it: "Scadenza", de: "Frist" },
  priorityLbl:   { sk: "Priorita", en: "Priority", cs: "Priorita", hu: "Prioritás", ro: "Prioritate", it: "Priorità", de: "Priorität" },
  ifLabel:       { sk: "AK", en: "IF", cs: "KDYŽ", hu: "HA", ro: "DACĂ", it: "SE", de: "WENN" },
  condSubLbl:    { sk: "Podmienka (voliteľné)", en: "Condition (optional)", cs: "Podmínka (volitelné)", hu: "Feltétel (opcionális)", ro: "Condiție (opțional)", it: "Condizione (opzionale)", de: "Bedingung (optional)" },
  condAlways:    { sk: "Vždy — pri každom potvrdení kroku", en: "Always — on every step confirmation", cs: "Vždy — při každém potvrzení kroku", hu: "Mindig — minden lépés megerősítésekor", ro: "Întotdeauna — la fiecare confirmare a pasului", it: "Sempre — ad ogni conferma del passo", de: "Immer — bei jeder Schrittbestätigung" },
  condCountry:   { sk: "Krajina zákazníka je...", en: "Customer country is...", cs: "Země zákazníka je...", hu: "Az ügyfél országa...", ro: "Țara clientului este...", it: "Il paese del cliente è...", de: "Land des Kunden ist..." },
  condAnswer:    { sk: "Odpoveď zákazníka je...", en: "Customer answer is...", cs: "Odpověď zákazníka je...", hu: "Az ügyfél válasza...", ro: "Răspunsul clientului este...", it: "La risposta del cliente è...", de: "Antwort des Kunden ist..." },
  condAnswerPh:  { sk: "Hodnota odpovede (napr. áno, nie, záujem...)", en: "Answer value (e.g. yes, no, interest...)", cs: "Hodnota odpovědi (např. ano, ne, zájem...)", hu: "Válasz értéke (pl. igen, nem, érdeklődés...)", ro: "Valoarea răspunsului (ex. da, nu, interes...)", it: "Valore risposta (es. sì, no, interesse...)", de: "Antwortwert (z.B. ja, nein, Interesse...)" },
  cancelBtn:     { sk: "Zrušiť", en: "Cancel", cs: "Zrušit", hu: "Mégse", ro: "Anulare", it: "Annulla", de: "Abbrechen" },
  saveActionBtn: { sk: "Uložiť akciu", en: "Save action", cs: "Uložit akci", hu: "Akció mentése", ro: "Salvare acțiune", it: "Salva azione", de: "Aktion speichern" },
  autoSaved:     { sk: "Automatizácia uložená", en: "Automation saved", cs: "Automatizace uložena", hu: "Automatizáció mentve", ro: "Automatizare salvată", it: "Automazione salvata", de: "Automatisierung gespeichert" },
  autoAdded:     { sk: "Automatizácia pridaná", en: "Automation added", cs: "Automatizace přidána", hu: "Automatizáció hozzáadva", ro: "Automatizare adăugată", it: "Automazione aggiunta", de: "Automatisierung hinzugefügt" },
  saveErr:       { sk: "Chyba pri ukladaní", en: "Save error", cs: "Chyba při ukládání", hu: "Mentési hiba", ro: "Eroare la salvare", it: "Errore di salvataggio", de: "Speicherfehler" },
  deleteErr:     { sk: "Chyba pri mazaní", en: "Delete error", cs: "Chyba při mazání", hu: "Törlési hiba", ro: "Eroare la ștergere", it: "Errore di eliminazione", de: "Löschfehler" },
  noEmailTpls:   { sk: "Žiadne email šablóny", en: "No email templates", cs: "Žádné e-mailové šablony", hu: "Nincs e-mail sablon", ro: "Niciun șablon email", it: "Nessun modello email", de: "Keine E-Mail-Vorlagen" },
  noDisps:       { sk: "Žiadne dispozície v tejto kampani", en: "No dispositions in this campaign", cs: "Žádné dispozice v této kampani", hu: "Nincs diszpozíció ebben a kampányban", ro: "Nicio dispoziție în această campanie", it: "Nessuna disposizione in questa campagna", de: "Keine Dispositionen in dieser Kampagne" },

  requiredBadge:   { sk: "Povinný", en: "Required", cs: "Povinný", hu: "Kötelező", ro: "Obligatoriu", it: "Obbligatorio", de: "Pflicht" },
  stepIdLbl:       { sk: "Krok ID", en: "Step ID", cs: "Krok ID", hu: "Lépés ID", ro: "ID pas", it: "ID passo", de: "Schritt-ID" },
  stepLabelLbl:    { sk: "Názov kroku", en: "Step name", cs: "Název kroku", hu: "Lépés neve", ro: "Nume pas", it: "Nome passo", de: "Schrittname" },
  stepLabelReq:    { sk: "Názov kroku *", en: "Step name *", cs: "Název kroku *", hu: "Lépés neve *", ro: "Nume pas *", it: "Nome passo *", de: "Schrittname *" },
  descLbl:         { sk: "Popis (voliteľný)", en: "Description (optional)", cs: "Popis (volitelný)", hu: "Leírás (opcionális)", ro: "Descriere (opțional)", it: "Descrizione (opzionale)", de: "Beschreibung (optional)" },
  descPh:          { sk: "Detailný popis pre agenta...", en: "Detailed description for agent...", cs: "Podrobný popis pro agenta...", hu: "Részletes leírás az ügynök számára...", ro: "Descriere detaliată pentru agent...", it: "Descrizione dettagliata per l'agente...", de: "Detaillierte Beschreibung für Agent..." },
  descPh2:         { sk: "Detailný popis alebo inštrukcie...", en: "Detailed description or instructions...", cs: "Podrobný popis nebo instrukce...", hu: "Részletes leírás vagy utasítások...", ro: "Descriere detaliată sau instrucțiuni...", it: "Descrizione dettagliata o istruzioni...", de: "Detaillierte Beschreibung oder Anweisungen..." },
  stepLabelPh:     { sk: "Popis kroku pre agenta...", en: "Step description for agent...", cs: "Popis kroku pro agenta...", hu: "Lépés leírása az ügynök számára...", ro: "Descrierea pasului pentru agent...", it: "Descrizione passo per l'agente...", de: "Schrittbeschreibung für Agent..." },
  confirmTypeLbl:  { sk: "Typ potvrdenia", en: "Confirmation type", cs: "Typ potvrzení", hu: "Megerősítés típusa", ro: "Tip confirmare", it: "Tipo di conferma", de: "Bestätigungstyp" },
  requiredSwitch:  { sk: "Povinný krok", en: "Required step", cs: "Povinný krok", hu: "Kötelező lépés", ro: "Pas obligatoriu", it: "Passo obbligatorio", de: "Pflichtschritt" },
  saveBtn:         { sk: "Uložiť zmeny", en: "Save changes", cs: "Uložit změny", hu: "Változtatások mentése", ro: "Salvare modificări", it: "Salva modifiche", de: "Änderungen speichern" },
  stepSaved:       { sk: "Krok uložený", en: "Step saved", cs: "Krok uložen", hu: "Lépés mentve", ro: "Pas salvat", it: "Passo salvato", de: "Schritt gespeichert" },
  stepDeleted:     { sk: "Krok zmazaný", en: "Step deleted", cs: "Krok smazán", hu: "Lépés törölve", ro: "Pas șters", it: "Passo eliminato", de: "Schritt gelöscht" },
  autoDeleted:     { sk: "Automatizácia zmazaná", en: "Automation deleted", cs: "Automatizace smazána", hu: "Automatizáció törölve", ro: "Automatizare ștearsă", it: "Automazione eliminata", de: "Automatisierung gelöscht" },
  automationsTitle:{ sk: "Automatizácie pri potvrdení", en: "Automations on confirmation", cs: "Automatizace při potvrzení", hu: "Automatizációk megerősítéskor", ro: "Automatizări la confirmare", it: "Automatizzazioni alla conferma", de: "Automatisierungen bei Bestätigung" },
  addActionBtn:    { sk: "Pridať akciu", en: "Add action", cs: "Přidat akci", hu: "Akció hozzáadása", ro: "Adăugare acțiune", it: "Aggiungi azione", de: "Aktion hinzufügen" },
  autoSectionTpl:  { sk: "Automatizácie tohto kroku (voliteľné)", en: "Automations for this step (optional)", cs: "Automatizace tohoto kroku (volitelné)", hu: "A lépés automatizációi (opcionális)", ro: "Automatizările acestui pas (opțional)", it: "Automatizzazioni per questo passo (opzionale)", de: "Automatisierungen dieses Schritts (optional)" },
  addStepBtn:      { sk: "Pridať krok", en: "Add step", cs: "Přidat krok", hu: "Lépés hozzáadása", ro: "Adăugare pas", it: "Aggiungi passo", de: "Schritt hinzufügen" },
  stepAdded:       { sk: "Krok pridaný", en: "Step added", cs: "Krok přidán", hu: "Lépés hozzáadva", ro: "Pas adăugat", it: "Passo aggiunto", de: "Schritt hinzugefügt" },

  tplSubtitle:     { sk: "Vyber kroky na vloženie do misie", en: "Select steps to add to the mission", cs: "Vyberte kroky pro vložení do mise", hu: "Válassza ki a lépéseket a misszióhoz", ro: "Selectați pașii pentru a adăuga la misiune", it: "Seleziona i passi da aggiungere alla missione", de: "Schritte auswählen, die zur Mission hinzugefügt werden sollen" },
  tplActionsCount: { sk: "akcií", en: "actions", cs: "akcí", hu: "akció", ro: "acțiuni", it: "azioni", de: "Aktionen" },
  tplSteps:        { sk: "krokov", en: "steps", cs: "kroků", hu: "lépés", ro: "pași", it: "passi", de: "Schritte" },
  tplAutomations:  { sk: "automatizácií", en: "automations", cs: "automatizací", hu: "automatizáció", ro: "automatizări", it: "automazioni", de: "Automatisierungen" },
  applyTplBtn:     { sk: "Aplikovať template", en: "Apply template", cs: "Použít šablonu", hu: "Sablon alkalmazása", ro: "Aplicare șablon", it: "Applica template", de: "Vorlage anwenden" },

  importTitle:     { sk: "Import zo Dispozície", en: "Import from Disposition", cs: "Import z dispozice", hu: "Importálás diszpozícióból", ro: "Import din Dispoziție", it: "Importa da Disposizione", de: "Import aus Disposition" },
  loadingMsg:      { sk: "Načítavam...", en: "Loading...", cs: "Načítám...", hu: "Betöltés...", ro: "Se încarcă...", it: "Caricamento...", de: "Wird geladen..." },
  noDispsMsg:      { sk: "Táto misia nemá žiadne dispozície.", en: "This mission has no dispositions.", cs: "Tato mise nemá žádné dispozice.", hu: "Ennek a missziónak nincs diszpozíciója.", ro: "Această misiune nu are dispoziții.", it: "Questa missione non ha disposizioni.", de: "Diese Mission hat keine Dispositionen." },
  selectedCount:   { sk: "vybraných", en: "selected", cs: "vybraných", hu: "kiválasztva", ro: "selectate", it: "selezionati", de: "ausgewählt" },
  importBtn:       { sk: "Importovať", en: "Import", cs: "Importovat", hu: "Importálás", ro: "Importare", it: "Importa", de: "Importieren" },

  tplTabCLA:       { sk: "CL A — Akvizícia", en: "CL A — Acquisition", cs: "CL A — Akvizice", hu: "CL A — Akkvizíció", ro: "CL A — Achiziție", it: "CL A — Acquisizione", de: "CL A — Akquisition" },
  tplTabCLB:       { sk: "CL B — Retencia", en: "CL B — Retention", cs: "CL B — Retence", hu: "CL B — Megtartás", ro: "CL B — Retenție", it: "CL B — Fidelizzazione", de: "CL B — Kundenbindung" },
};

function sl(key: string, locale: string): string {
  return SL[key]?.[locale] ?? SL[key]?.["sk"] ?? key;
}

const ACTION_TYPE_OPTIONS = [
  { value: "assign_task",        slKey: "at_assign_task",        icon: ClipboardList, color: "text-blue-500" },
  { value: "send_email_group",   slKey: "at_send_email_group",   icon: Mail,          color: "text-green-500" },
  { value: "send_sms",           slKey: "at_send_sms",           icon: MessageSquare, color: "text-yellow-500" },
  { value: "set_contact_status", slKey: "at_set_contact_status", icon: Tag,           color: "text-purple-500" },
  { value: "notify_role",        slKey: "at_notify_role",        icon: Bell,          color: "text-orange-500" },
  { value: "sys_webhook",        slKey: "at_sys_webhook",        icon: Webhook,       color: "text-rose-500" },
];

const ROLE_OPTIONS = [
  { value: "role:back_office", slKey: "rl_back_office" },
  { value: "role:coordinator", slKey: "rl_coordinator" },
  { value: "role:admin",       slKey: "rl_admin" },
  { value: "role:manager",     slKey: "rl_manager" },
  { value: "sys",              slKey: "rl_sys" },
];

const DEADLINE_OPTIONS = [
  { value: "+1h",  slKey: "dl_1h" },
  { value: "+4h",  slKey: "dl_4h" },
  { value: "+24h", slKey: "dl_24h" },
  { value: "+2d",  slKey: "dl_2d" },
  { value: "+3d",  slKey: "dl_3d" },
  { value: "+7d",  slKey: "dl_7d" },
  { value: "+14d", slKey: "dl_14d" },
];

const PRIORITY_OPTIONS = [
  { value: "low",    slKey: "pr_low" },
  { value: "medium", slKey: "pr_medium" },
  { value: "high",   slKey: "pr_high" },
  { value: "urgent", slKey: "pr_urgent" },
];

const CONFIRM_TYPE_OPTIONS = [
  { value: "checkbox", slKey: "ct_checkbox", icon: CheckSquare },
  { value: "radio",    slKey: "ct_radio",    icon: Radio },
  { value: "info",     slKey: "ct_info",     icon: Info },
];

const COUNTRY_OPTIONS = [
  { value: "SK", slKey: "ctr_SK" }, { value: "CZ", slKey: "ctr_CZ" },
  { value: "HU", slKey: "ctr_HU" }, { value: "RO", slKey: "ctr_RO" },
  { value: "AT", slKey: "ctr_AT" }, { value: "DE", slKey: "ctr_DE" },
  { value: "IT", slKey: "ctr_IT" }, { value: "US", slKey: "ctr_US" },
];

function getActionIcon(actionType: string) {
  const opt = ACTION_TYPE_OPTIONS.find(o => o.value === actionType);
  if (!opt) return <Zap className="h-3 w-3" />;
  const Icon = opt.icon;
  return <Icon className={`h-3 w-3 ${opt.color}`} />;
}

function getActionLabel(actionType: string, locale: string): string {
  const opt = ACTION_TYPE_OPTIONS.find(o => o.value === actionType);
  return opt ? sl(opt.slKey, locale) : actionType;
}

function getRoleLabel(role: string | null, locale: string): string {
  if (!role) return "—";
  const opt = ROLE_OPTIONS.find(o => o.value === role);
  return opt ? sl(opt.slKey, locale) : role;
}

function AutomationBadge({ automation }: { automation: StatusListAutomation }) {
  const { locale } = useI18n();
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border/50">
      {getActionIcon(automation.actionType)}
      <span className="text-muted-foreground">{getActionLabel(automation.actionType, locale)}</span>
      {automation.targetRole && (
        <span className="font-medium">→ {getRoleLabel(automation.targetRole, locale)}</span>
      )}
    </span>
  );
}

function AutomationForm({
  automation, itemId, campaignId, onSaved, onCancel,
}: {
  automation?: StatusListAutomation;
  itemId: string;
  campaignId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const { locale } = useI18n();
  const [form, setForm] = useState({
    actionType: automation?.actionType || "assign_task",
    targetRole: automation?.targetRole || "role:back_office",
    taskDescription: automation?.taskDescription || "",
    taskDeadlineOffset: automation?.taskDeadlineOffset || "+24h",
    taskPriority: automation?.taskPriority || "medium",
    emailTemplateId: automation?.emailTemplateId || "",
    smsTemplateId: automation?.smsTemplateId || "",
    conditionType: automation?.conditionField === "country" ? "country" : automation?.conditionField === "answer" ? "answer" : "always",
    conditionCountry: automation?.conditionField === "country" ? (automation?.conditionValue || "SK") : "SK",
    conditionAnswer: automation?.conditionField === "answer" ? (automation?.conditionValue || "") : "",
    dispositionId: automation?.dispositionId || "",
  });

  const isEdit = !!automation?.id;

  const { data: emailTemplates = [] } = useQuery<any[]>({
    queryKey: ["/api/message-templates", "email"],
    queryFn: () => fetch(`/api/message-templates?type=email`, { credentials: "include" }).then(r => r.json()),
    enabled: form.actionType === "send_email_group",
  });

  const { data: campaignDispositions = [] } = useQuery<any[]>({
    queryKey: ["/api/campaigns", campaignId, "dispositions-auto"],
    queryFn: () => fetch(`/api/campaigns/${campaignId}/dispositions`, { credentials: "include" }).then(r => r.json()),
    enabled: form.actionType === "set_contact_status",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        actionType: form.actionType,
        targetRole: form.targetRole || null,
        taskDescription: form.taskDescription || null,
        taskDeadlineOffset: form.taskDeadlineOffset || null,
        taskPriority: form.taskPriority,
        emailTemplateId: form.emailTemplateId || null,
        smsTemplateId: form.smsTemplateId || null,
        dispositionId: form.dispositionId || null,
        conditionField: form.conditionType === "always" ? null : form.conditionType,
        conditionOperator: form.conditionType === "always" ? null : "eq",
        conditionValue: form.conditionType === "always" ? null : (form.conditionType === "country" ? form.conditionCountry : (form.conditionAnswer || null)),
      };
      if (isEdit) {
        return apiRequest("PUT", `/api/campaigns/${campaignId}/status-list/${itemId}/automations/${automation.id}`, payload);
      }
      return apiRequest("POST", `/api/campaigns/${campaignId}/status-list/${itemId}/automations`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      toast({ title: isEdit ? sl("autoSaved", locale) : sl("autoAdded", locale) });
      onSaved();
    },
    onError: () => toast({ title: sl("saveErr", locale), variant: "destructive" }),
  });

  const needsRole = ["assign_task", "send_email_group", "notify_role"].includes(form.actionType);
  const needsTask = form.actionType === "assign_task";
  const needsEmail = form.actionType === "send_email_group";

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {isEdit ? sl("editAction", locale) : sl("newAction", locale)}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-bold tracking-wide">{sl("thenLabel", locale)}</span>
        <span className="text-xs font-medium text-muted-foreground">{sl("thenSub", locale)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label className="text-xs mb-1 block">{sl("actionTypeLbl", locale)}</Label>
          <Select value={form.actionType} onValueChange={v => setForm(f => ({ ...f, actionType: v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTION_TYPE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex items-center gap-2">
                    <opt.icon className={`h-3.5 w-3.5 ${opt.color}`} />
                    {sl(opt.slKey, locale)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {needsRole && (
          <div className="col-span-2">
            <Label className="text-xs mb-1 block">{sl("targetRoleLbl", locale)}</Label>
            <Select value={form.targetRole} onValueChange={v => setForm(f => ({ ...f, targetRole: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{sl(opt.slKey, locale)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {needsTask && (
          <>
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">{sl("taskDescLbl", locale)}</Label>
              <Textarea
                className="text-xs min-h-[60px] resize-none"
                value={form.taskDescription}
                onChange={e => setForm(f => ({ ...f, taskDescription: e.target.value }))}
                placeholder={sl("taskDescPh", locale)}
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">{sl("deadlineLbl", locale)}</Label>
              <Select value={form.taskDeadlineOffset} onValueChange={v => setForm(f => ({ ...f, taskDeadlineOffset: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEADLINE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{sl(opt.slKey, locale)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">{sl("priorityLbl", locale)}</Label>
              <Select value={form.taskPriority} onValueChange={v => setForm(f => ({ ...f, taskPriority: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{sl(opt.slKey, locale)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {needsEmail && (
          <div className="col-span-2">
            <Label className="text-xs mb-1 block">{sl("emailTemplate", locale)}</Label>
            <Select value={form.emailTemplateId} onValueChange={v => setForm(f => ({ ...f, emailTemplateId: v }))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={sl("selectEmail", locale)} />
              </SelectTrigger>
              <SelectContent>
                {emailTemplates.map((t: any) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name || t.subject || String(t.id)}</SelectItem>
                ))}
                {emailTemplates.length === 0 && (
                  <SelectItem value="__none__" disabled>{sl("noEmailTpls", locale)}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {form.actionType === "set_contact_status" && (
          <div className="col-span-2">
            <Label className="text-xs mb-1 block">{sl("disposition", locale)}</Label>
            <Select value={form.dispositionId} onValueChange={v => setForm(f => ({ ...f, dispositionId: v }))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={sl("selectDisp", locale)} />
              </SelectTrigger>
              <SelectContent>
                {campaignDispositions.map((d: any) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    <span className="flex items-center gap-2">
                      {d.code && <span className="font-mono text-[10px] text-muted-foreground">{d.code}</span>}
                      {d.name}
                    </span>
                  </SelectItem>
                ))}
                {campaignDispositions.length === 0 && (
                  <SelectItem value="__none__" disabled>{sl("noDisps", locale)}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="border-t pt-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-bold tracking-wide">{sl("ifLabel", locale)}</span>
          <span className="text-xs font-medium text-muted-foreground">{sl("condSubLbl", locale)}</span>
        </div>
        <Select value={form.conditionType} onValueChange={v => setForm(f => ({ ...f, conditionType: v }))}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="always">{sl("condAlways", locale)}</SelectItem>
            <SelectItem value="country">{sl("condCountry", locale)}</SelectItem>
            <SelectItem value="answer">{sl("condAnswer", locale)}</SelectItem>
          </SelectContent>
        </Select>
        {form.conditionType === "country" && (
          <Select value={form.conditionCountry} onValueChange={v => setForm(f => ({ ...f, conditionCountry: v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COUNTRY_OPTIONS.map(c => (
                <SelectItem key={c.value} value={c.value}>{sl(c.slKey, locale)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {form.conditionType === "answer" && (
          <Input
            className="h-8 text-xs"
            value={form.conditionAnswer}
            onChange={e => setForm(f => ({ ...f, conditionAnswer: e.target.value }))}
            placeholder={sl("condAnswerPh", locale)}
          />
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-7 text-xs">
          <X className="h-3 w-3 mr-1" /> {sl("cancelBtn", locale)}
        </Button>
        <Button type="button" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="h-7 text-xs">
          {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
          {sl("saveActionBtn", locale)}
        </Button>
      </div>
    </div>
  );
}

function StatusListItemRow({
  item, campaignId, onDeleted,
}: {
  item: StatusListItem;
  campaignId: string;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const { locale } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [addingAutomation, setAddingAutomation] = useState(false);
  const [editingAutoId, setEditingAutoId] = useState<string | null>(null);
  const [form, setForm] = useState({
    stepId: item.stepId,
    label: item.label,
    description: item.description || "",
    confirmationType: item.confirmationType,
    required: item.required,
    nextStepId: item.nextStepId || "",
    restrictions: item.restrictions || "",
  });

  const updateMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/campaigns/${campaignId}/status-list/${item.id}`, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      toast({ title: sl("stepSaved", locale) });
      setEditMode(false);
    },
    onError: () => toast({ title: sl("saveErr", locale), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/campaigns/${campaignId}/status-list/${item.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      toast({ title: sl("stepDeleted", locale) });
      onDeleted();
    },
    onError: () => toast({ title: sl("deleteErr", locale), variant: "destructive" }),
  });

  const deleteAutoMutation = useMutation({
    mutationFn: (autoId: string) => apiRequest("DELETE", `/api/campaigns/${campaignId}/status-list/${item.id}/automations/${autoId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      toast({ title: sl("autoDeleted", locale) });
    },
    onError: () => toast({ title: sl("deleteErr", locale), variant: "destructive" }),
  });

  const ConfirmIcon = CONFIRM_TYPE_OPTIONS.find(o => o.value === item.confirmationType)?.icon || CheckSquare;

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 group">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 cursor-grab" />
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">{item.stepId}</span>
          <ConfirmIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{item.label}</span>
          {item.required && <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 shrink-0">{sl("requiredBadge", locale)}</Badge>}
        </button>
        <div className="flex items-center gap-1 shrink-0">
          {item.automations.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Zap className="h-3 w-3 text-amber-500" />
              {item.automations.length}
            </span>
          )}
          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={() => { setEditMode(e => !e); setExpanded(true); }}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate()}>
            {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-muted/10 px-3 py-3 space-y-3">
          {editMode ? (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs mb-1 block">{sl("stepIdLbl", locale)}</Label>
                  <Input className="h-8 text-xs font-mono" value={form.stepId} onChange={e => setForm(f => ({ ...f, stepId: e.target.value }))} placeholder="CLA-01" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs mb-1 block">{sl("stepLabelLbl", locale)}</Label>
                  <Input className="h-8 text-xs" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder={sl("stepLabelPh", locale)} />
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">{sl("descLbl", locale)}</Label>
                <Textarea className="text-xs min-h-[50px] resize-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={sl("descPh", locale)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs mb-1 block">{sl("nextStep", locale)}</Label>
                  <Input className="h-8 text-xs font-mono" value={form.nextStepId} onChange={e => setForm(f => ({ ...f, nextStepId: e.target.value }))} placeholder={sl("nextStepPh", locale)} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs mb-1 block">{sl("restrictions", locale)}</Label>
                  <Input className="h-8 text-xs" value={form.restrictions} onChange={e => setForm(f => ({ ...f, restrictions: e.target.value }))} placeholder={sl("restrictionsPh", locale)} />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="text-xs mb-1 block">{sl("confirmTypeLbl", locale)}</Label>
                  <Select value={form.confirmationType} onValueChange={v => setForm(f => ({ ...f, confirmationType: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONFIRM_TYPE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="flex items-center gap-2">
                            <opt.icon className="h-3.5 w-3.5" />
                            {sl(opt.slKey, locale)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <Switch checked={form.required} onCheckedChange={v => setForm(f => ({ ...f, required: v }))} />
                  <Label className="text-xs">{sl("requiredSwitch", locale)}</Label>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditMode(false)}>
                  <X className="h-3 w-3 mr-1" /> {sl("cancelBtn", locale)}
                </Button>
                <Button type="button" size="sm" className="h-7 text-xs" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                  {sl("saveBtn", locale)}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
              {(item.nextStepId || item.restrictions) && (
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  {item.nextStepId && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <span className="font-semibold">→</span>
                      <span className="font-mono">{item.nextStepId}</span>
                    </span>
                  )}
                  {item.restrictions && (
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 flex items-start gap-1">
                      <span className="font-semibold shrink-0">FC:</span>
                      <span className="truncate max-w-[400px]">{item.restrictions}</span>
                    </span>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                {item.automations.map(auto => (
                  <AutomationBadge key={auto.id} automation={auto} />
                ))}
              </div>
            </>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Zap className="h-3 w-3 text-amber-500" />
                {sl("automationsTitle", locale)}
              </span>
              <Button type="button" variant="outline" size="sm" className="h-6 text-xs gap-1 px-2" onClick={() => { setAddingAutomation(true); setEditingAutoId(null); }}>
                <Plus className="h-3 w-3" /> {sl("addActionBtn", locale)}
              </Button>
            </div>

            {item.automations.map(auto => (
              <div key={auto.id}>
                {editingAutoId === auto.id ? (
                  <AutomationForm
                    automation={auto}
                    itemId={item.id}
                    campaignId={campaignId}
                    onSaved={() => setEditingAutoId(null)}
                    onCancel={() => setEditingAutoId(null)}
                  />
                ) : (
                  <div className="flex items-start gap-2 p-2 rounded-md border bg-background group/auto text-xs">
                    <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                      {getActionIcon(auto.actionType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium">{getActionLabel(auto.actionType, locale)}</span>
                        {auto.targetRole && (
                          <span className="text-muted-foreground">→ {getRoleLabel(auto.targetRole, locale)}</span>
                        )}
                        {auto.taskDeadlineOffset && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">⏱ {auto.taskDeadlineOffset}</span>
                        )}
                      </div>
                      {auto.taskDescription && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">📋 {auto.taskDescription}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/auto:opacity-100">
                      <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => { setEditingAutoId(auto.id); setAddingAutomation(false); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive hover:text-destructive" onClick={() => deleteAutoMutation.mutate(auto.id)}>
                        {deleteAutoMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {addingAutomation && (
              <AutomationForm
                itemId={item.id}
                campaignId={campaignId}
                onSaved={() => setAddingAutomation(false)}
                onCancel={() => setAddingAutomation(false)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AddItemForm({
  campaignId, existingCount, onSaved, onCancel,
}: {
  campaignId: string;
  existingCount: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const { locale } = useI18n();
  const [form, setForm] = useState({
    stepId: `STEP-${String(existingCount + 1).padStart(2, "0")}`,
    label: "",
    description: "",
    confirmationType: "checkbox",
    required: false,
    sortOrder: existingCount,
    nextStepId: "",
    restrictions: "",
  });

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/campaigns/${campaignId}/status-list`, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      toast({ title: sl("stepAdded", locale) });
      onSaved();
    },
    onError: () => toast({ title: sl("saveErr", locale), variant: "destructive" }),
  });

  return (
    <div className="border-2 border-dashed border-primary/30 rounded-lg p-3 space-y-2 bg-primary/5">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs mb-1 block">{sl("stepIdLbl", locale)}</Label>
          <Input className="h-8 text-xs font-mono" value={form.stepId} onChange={e => setForm(f => ({ ...f, stepId: e.target.value }))} placeholder="STEP-01" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs mb-1 block">{sl("stepLabelReq", locale)}</Label>
          <Input className="h-8 text-xs" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder={sl("stepLabelPh", locale)} autoFocus />
        </div>
      </div>
      <div>
        <Label className="text-xs mb-1 block">{sl("descLbl", locale)}</Label>
        <Textarea className="text-xs min-h-[50px] resize-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={sl("descPh2", locale)} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs mb-1 block">{sl("nextStep", locale)}</Label>
          <Input className="h-8 text-xs font-mono" value={form.nextStepId} onChange={e => setForm(f => ({ ...f, nextStepId: e.target.value }))} placeholder={sl("nextStepPh", locale)} />
        </div>
        <div className="col-span-2">
          <Label className="text-xs mb-1 block">{sl("restrictions", locale)}</Label>
          <Input className="h-8 text-xs" value={form.restrictions} onChange={e => setForm(f => ({ ...f, restrictions: e.target.value }))} placeholder={sl("restrictionsPh", locale)} />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Label className="text-xs mb-1 block">{sl("confirmTypeLbl", locale)}</Label>
          <Select value={form.confirmationType} onValueChange={v => setForm(f => ({ ...f, confirmationType: v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONFIRM_TYPE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex items-center gap-2">
                    <opt.icon className="h-3.5 w-3.5" />
                    {sl(opt.slKey, locale)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pt-4">
          <Switch checked={form.required} onCheckedChange={v => setForm(f => ({ ...f, required: v }))} />
          <Label className="text-xs">{sl("requiredSwitch", locale)}</Label>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
          <X className="h-3 w-3 mr-1" /> {sl("cancelBtn", locale)}
        </Button>
        <Button type="button" size="sm" className="h-7 text-xs" onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !form.label.trim()}>
          {addMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
          {sl("addStepBtn", locale)}
        </Button>
      </div>
    </div>
  );
}

export function CampaignStatusListBuilder({ campaignId }: { campaignId: string }) {
  const { toast } = useToast();
  const { locale } = useI18n();
  const [addingItem, setAddingItem] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateTab, setTemplateTab] = useState<"CLA" | "CLB">("CLA");
  const [importOpen, setImportOpen] = useState(false);
  const [selectedSteps, setSelectedSteps] = useState<Set<string>>(new Set());
  const [selectedAutos, setSelectedAutos] = useState<Map<string, Set<string>>>(new Map());
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [templateProgress, setTemplateProgress] = useState<string | null>(null);
  const [selectedDisps, setSelectedDisps] = useState<Set<string>>(new Set());

  const { data: items = [], isLoading } = useQuery<StatusListItem[]>({
    queryKey: ["/api/campaigns", campaignId, "status-list"],
    queryFn: () => fetch(`/api/campaigns/${campaignId}/status-list`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: dispositions = [], isLoading: dispsLoading } = useQuery<any[]>({
    queryKey: ["/api/campaigns", campaignId, "dispositions"],
    queryFn: () => fetch(`/api/campaigns/${campaignId}/dispositions`, { credentials: "include" }).then(r => r.json()),
    enabled: importOpen,
  });

  const parentDisps = dispositions.filter((d: any) => !d.parentId);
  const childDisps = (parentId: string) => dispositions.filter((d: any) => d.parentId === parentId);

  function toggleStep(stepId: string) {
    setSelectedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) { next.delete(stepId); }
      else { next.add(stepId); }
      return next;
    });
  }

  function toggleAuto(stepId: string, autoId: string) {
    setSelectedAutos(prev => {
      const next = new Map(prev);
      const set = new Set(next.get(stepId) ?? []);
      if (set.has(autoId)) { set.delete(autoId); } else { set.add(autoId); }
      next.set(stepId, set);
      return next;
    });
  }

  function toggleExpand(stepId: string) {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) { next.delete(stepId); } else { next.add(stepId); }
      return next;
    });
  }

  function toggleDisp(id: string) {
    setSelectedDisps(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  const activeTemplate = templateTab === "CLA" ? CLA_TEMPLATE : CLB_TEMPLATE;

  const selectedStepCount = selectedSteps.size;
  const selectedAutoCount = Array.from(selectedAutos.entries())
    .filter(([sid]) => selectedSteps.has(sid))
    .reduce((sum, [, aset]) => sum + aset.size, 0);

  const templateMutation = useMutation({
    mutationFn: async () => {
      const stepsToCreate = activeTemplate.filter(s => selectedSteps.has(s.stepId));
      const base = items.length;
      setTemplateProgress(null);
      for (let i = 0; i < stepsToCreate.length; i++) {
        const step = stepsToCreate[i];
        setTemplateProgress(`${sl("applyTplBtn", locale)} ${i + 1}/${stepsToCreate.length}: ${step.stepId}…`);
        const res = await apiRequest("POST", `/api/campaigns/${campaignId}/status-list`, {
          stepId: step.stepId,
          label: getStepLabel(step, locale),
          description: [
            step.description,
            step.conditionIf ? `IF: ${step.conditionIf}` : "",
            step.actionThen ? `THEN: ${step.actionThen}` : "",
            step.callbackTiming && step.callbackTiming !== "—" ? `⏱ ${step.callbackTiming}` : "",
          ].filter(Boolean).join("\n"),
          confirmationType: step.confirmationType,
          required: false,
          sortOrder: base + i,
          nextStepId: step.nextStepId || null,
          restrictions: step.restrictions || null,
        });
        const created = await res.json();
        const itemId = created.id;
        if (!itemId) continue;

        const autoSet = selectedAutos.get(step.stepId) ?? new Set();
        const autosToCreate = step.automations.filter(a => autoSet.has(a.triggerId));
        for (const auto of autosToCreate) {
          await apiRequest("POST", `/api/campaigns/${campaignId}/status-list/${itemId}/automations`, {
            actionType: auto.actionType,
            targetRole: auto.targetRole,
            taskDescription: auto.taskDescription,
            taskDeadlineOffset: auto.taskDeadlineOffset,
            taskPriority: auto.taskPriority,
            sortOrder: 0,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      setTemplateProgress(null);
      setTemplateOpen(false);
      toast({ title: `✅ ${sl("applyTplBtn", locale)}: ${selectedStepCount} ${sl("tplSteps", locale)}, ${selectedAutoCount} ${sl("tplAutomations", locale)}` });
    },
    onError: () => { setTemplateProgress(null); toast({ title: sl("saveErr", locale), variant: "destructive" }); },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const base = items.length;
      let i = 0;
      for (const dispId of Array.from(selectedDisps)) {
        const disp = dispositions.find((d: any) => String(d.id) === String(dispId));
        if (!disp) continue;
        await apiRequest("POST", `/api/campaigns/${campaignId}/status-list`, {
          stepId: disp.code || `DISP-${String(i + 1).padStart(2, "0")}`,
          label: disp.name,
          description: disp.description || null,
          confirmationType: "radio",
          required: false,
          sortOrder: base + i,
        });
        i++;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      setImportOpen(false);
      setSelectedDisps(new Set());
      toast({ title: `✅ ${sl("importBtn", locale)}: ${selectedDisps.size} ${sl("selectedCount", locale)}` });
    },
    onError: () => toast({ title: sl("saveErr", locale), variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">{sl("loadingMsg", locale)}</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setTemplateOpen(true)} data-testid="btn-open-cla-template">
          <BookTemplate className="h-3.5 w-3.5 text-primary" />
          CLA / CLB Template
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setImportOpen(true)} data-testid="btn-open-import-dispositions">
          <Download className="h-3.5 w-3.5 text-emerald-500" />
          {sl("importTitle", locale)}
        </Button>
        <div className="ml-auto">
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setAddingItem(true)} disabled={addingItem} data-testid="btn-add-status-list-item">
            <Plus className="h-3 w-3" /> {sl("addStepBtn", locale)}
          </Button>
        </div>
      </div>

      {addingItem && (
        <AddItemForm
          campaignId={campaignId}
          existingCount={items.length}
          onSaved={() => setAddingItem(false)}
          onCancel={() => setAddingItem(false)}
        />
      )}

      <div className="space-y-1.5">
        {items.map(item => (
          <StatusListItemRow
            key={item.id}
            item={item}
            campaignId={campaignId}
            onDeleted={() => {}}
          />
        ))}
      </div>

      {/* ── Template Dialog ─────────────────────────────────── */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <BookTemplate className="h-4 w-4 text-primary" />
              Medical Partner Network — Template
            </DialogTitle>
            <p className="text-xs text-muted-foreground">{sl("tplSubtitle", locale)}</p>
          </DialogHeader>

          {/* Tab switcher */}
          <div className="flex gap-1 shrink-0 border-b pb-2">
            <button
              type="button"
              onClick={() => { setTemplateTab("CLA"); setSelectedSteps(new Set()); setSelectedAutos(new Map()); }}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${templateTab === "CLA" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              {sl("tplTabCLA", locale)}
            </button>
            <button
              type="button"
              onClick={() => { setTemplateTab("CLB"); setSelectedSteps(new Set()); setSelectedAutos(new Map()); }}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${templateTab === "CLB" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              {sl("tplTabCLB", locale)}
            </button>
          </div>

          {/* Step list */}
          <div className="flex-1 overflow-y-auto space-y-1 py-1 min-h-0">
            {activeTemplate.map((step) => {
              const isSelected = selectedSteps.has(step.stepId);
              const isExpanded = expandedSteps.has(step.stepId);
              const autoSet = selectedAutos.get(step.stepId) ?? new Set();
              const roleBadge = ROLE_BADGE_MAP[step.role] ?? { label: step.role, color: "bg-muted text-muted-foreground" };
              const isSys = step.confirmationType === "info";

              return (
                <div key={step.stepId} className={`rounded-lg border transition-colors ${isSelected ? "border-primary/30 bg-primary/5" : "border-border bg-background"}`}>
                  <div className="flex items-start gap-2 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleStep(step.stepId)}
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected ? "bg-primary border-primary" : "border-border"}`}
                      data-testid={`tpl-step-${step.stepId}`}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-muted-foreground">{step.stepId}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${roleBadge.color}`}>{roleBadge.label}</span>
                        {isSys && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">AUTO</span>}
                        <span className={`text-sm font-medium ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>{getStepLabel(step, locale)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{step.description}</p>
                      {step.conditionIf && step.conditionIf !== "—" && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          <span className="font-semibold">IF:</span> {step.conditionIf}
                        </p>
                      )}
                      {step.nextStepId && (
                        <p className="text-[10px] text-muted-foreground/70">
                          <span className="font-semibold">→</span> {step.nextStepId}
                          {step.callbackTiming && step.callbackTiming !== "—" && ` · ${step.callbackTiming}`}
                        </p>
                      )}
                      {step.restrictions && (
                        <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5 flex items-start gap-1">
                          <span className="font-semibold shrink-0">FC:</span>
                          <span className="line-clamp-2">{step.restrictions}</span>
                        </p>
                      )}
                    </div>
                    {step.automations.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(step.stepId)}
                        className="shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded hover:bg-muted"
                        data-testid={`tpl-expand-${step.stepId}`}
                      >
                        <Zap className="h-3 w-3 text-amber-500" />
                        <span>{autoSet.size}/{step.automations.length} {sl("tplActionsCount", locale)}</span>
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    )}
                  </div>

                  {isExpanded && step.automations.length > 0 && (
                    <div className="border-t border-border/50 px-3 py-2 space-y-1.5 bg-muted/30">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-1">
                        <Zap className="h-3 w-3 text-amber-500" />
                        {sl("autoSectionTpl", locale)}
                      </div>
                      {step.automations.map((auto) => {
                        const autoSelected = autoSet.has(auto.triggerId);
                        return (
                          <div
                            key={auto.triggerId}
                            className={`flex items-start gap-2 p-2 rounded-md border transition-colors ${autoSelected ? "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20" : "border-border/50 bg-background"}`}
                          >
                            <button
                              type="button"
                              onClick={() => { if (isSelected) toggleAuto(step.stepId, auto.triggerId); }}
                              disabled={!isSelected}
                              className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${autoSelected && isSelected ? "bg-amber-500 border-amber-500" : "border-border"} ${!isSelected ? "opacity-30 cursor-not-allowed" : ""}`}
                              data-testid={`tpl-auto-${step.stepId}-${auto.triggerId}`}
                            >
                              {autoSelected && isSelected && <Check className="h-2 w-2 text-white" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-mono text-muted-foreground">{auto.triggerId}</span>
                                <span className="text-xs font-medium">{getAutoLabel(auto, locale)}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{auto.description}</p>
                              {auto.taskDescription && (
                                <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
                                  📋 {auto.taskDescription}
                                </p>
                              )}
                              {auto.taskDeadlineOffset && (
                                <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground mt-0.5">
                                  ⏱ {auto.taskDeadlineOffset}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {templateProgress && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 border-t shrink-0">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              {templateProgress}
            </div>
          )}

          <DialogFooter className="flex items-center justify-between gap-2 border-t pt-3 shrink-0">
            <span className="text-xs text-muted-foreground">
              {selectedStepCount} {sl("tplSteps", locale)} · {selectedAutoCount} {sl("tplAutomations", locale)}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setTemplateOpen(false)} disabled={templateMutation.isPending}>
                {sl("cancelBtn", locale)}
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                disabled={selectedStepCount === 0 || templateMutation.isPending}
                onClick={() => templateMutation.mutate()}
                data-testid="btn-apply-cla-template"
              >
                {templateMutation.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <BookTemplate className="h-3.5 w-3.5" />
                }
                {sl("applyTplBtn", locale)} ({selectedStepCount} {sl("tplSteps", locale)})
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import z Disposition Dialog ─────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-4 w-4 text-emerald-500" />
              {sl("importTitle", locale)}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-1 max-h-80 overflow-y-auto">
            {dispsLoading && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> {sl("loadingMsg", locale)}
              </div>
            )}
            {!dispsLoading && parentDisps.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {sl("noDispsMsg", locale)}
              </p>
            )}
            {parentDisps.map((d: any) => {
              const children = childDisps(d.id);
              return (
                <div key={d.id}>
                  <button
                    type="button"
                    onClick={() => toggleDisp(d.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors text-sm ${selectedDisps.has(d.id) ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                    data-testid={`import-disp-${d.id}`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedDisps.has(d.id) ? "bg-primary border-primary" : "border-border"}`}>
                      {selectedDisps.has(d.id) && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                    </div>
                    <span className="font-medium flex-1">{d.name}</span>
                    {d.code && <span className="text-xs text-muted-foreground font-mono">{d.code}</span>}
                  </button>
                  {children.map((c: any) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleDisp(c.id)}
                      className={`w-full flex items-center gap-2.5 pl-8 pr-3 py-1.5 rounded-md text-left transition-colors text-sm ${selectedDisps.has(c.id) ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                      data-testid={`import-disp-${c.id}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedDisps.has(c.id) ? "bg-primary border-primary" : "border-border"}`}>
                        {selectedDisps.has(c.id) && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                      <span className="flex-1">{c.name}</span>
                      {c.code && <span className="text-xs text-muted-foreground font-mono">{c.code}</span>}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
          <DialogFooter className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{selectedDisps.size} {sl("selectedCount", locale)}</span>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setImportOpen(false)}>{sl("cancelBtn", locale)}</Button>
              <Button
                type="button"
                size="sm"
                disabled={selectedDisps.size === 0 || importMutation.isPending}
                onClick={() => importMutation.mutate()}
                data-testid="btn-confirm-import-dispositions"
              >
                {importMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                {sl("importBtn", locale)} ({selectedDisps.size})
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
