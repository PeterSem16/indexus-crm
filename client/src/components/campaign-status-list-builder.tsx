import React, { useState } from "react";
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
  SquareCheck, CircleDot, Info, Loader2, PenLine, X, Check, Download,
  LayoutTemplate, ChevronUp, Eye, EyeOff, ListChecks,
  CircleHelp, ArrowDownRight, Copy,
  Star, Heart, Phone, Calendar, User, FileText, MessageCircle, MapPin,
  Clock, DollarSign, Shield, Activity, Home, Building2, Flag, Lightbulb,
  Lock, Award, CircleAlert, CircleCheck, Smile, Stethoscope, Baby, Dna, ClipboardCheck,
  Settings, Hash, ToggleLeft, Type,
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
  taskGroupId: string | null;
};

type StatusListQuestion = {
  id: string;
  itemId: string;
  groupName: string | null;
  questionText: string;
  sortOrder: number;
  logicOperator: string;
  gotoQuestionId: string | null;
  required: boolean;
  icon?: string | null;
  color?: string | null;
  description?: string | null;
  isHidden?: boolean;
  fieldType?: string | null;
  automations: StatusListAutomation[];
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
  questions: StatusListQuestion[];
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

  atHelp_assign_task:        { sk: "Systém vytvorí úlohu v module Tasks a pridelí ju zvolenej role (napr. Back Office). Úloha bude viditeľná v zozname úloh a agent dostane notifikáciu. Nastavte popis, prioritu a termín.", en: "System creates a task in the Tasks module and assigns it to the chosen role (e.g. Back Office). The task appears in the task list and the agent gets a notification. Set description, priority and deadline.", cs: "Systém vytvoří úkol v modulu Úkoly a přidělí ho zvolené roli. Agent dostane notifikaci.", hu: "A rendszer feladatot hoz létre a Feladatok modulban a kiválasztott szerepkör számára.", ro: "Sistemul creează o sarcină în modulul Sarcini și o atribuie rolului ales.", it: "Il sistema crea un compito nel modulo Attività e lo assegna al ruolo scelto.", de: "Das System erstellt eine Aufgabe im Aufgaben-Modul und weist sie der gewählten Rolle zu." },
  atHelp_send_email_group:   { sk: "Odošle skupinový e-mail podľa zvolenej šablóny. Šablóna môže obsahovať premenné kontaktu. Vhodné pre automatické uvítacie e-maily, pripomienky alebo follow-up správy.", en: "Sends a group email using the chosen template. Template can contain contact variables. Good for automated welcome emails, reminders or follow-up messages.", cs: "Odešle skupinový e-mail dle vybrané šablony. Vhodné pro uvítací e-maily a připomínky.", hu: "Csoportos e-mailt küld a kiválasztott sablon alapján. Üdvözlő e-mailekhez, emlékeztetőkhöz alkalmas.", ro: "Trimite un email de grup folosind șablonul ales. Potrivit pentru e-mailuri de bun venit și memento-uri.", it: "Invia un'email di gruppo usando il modello scelto. Adatto per e-mail di benvenuto e promemoria.", de: "Sendet eine Gruppen-E-Mail mit der gewählten Vorlage. Geeignet für Willkommens-E-Mails und Erinnerungen." },
  atHelp_send_sms:           { sk: "Odošle SMS správu priamo zákazníkovi. Vyžaduje platné telefónne číslo kontaktu. Správa je odoslaná cez SMS gateway a zalogovaná v komunikačnej histórii.", en: "Sends an SMS message directly to the contact. Requires a valid phone number on the contact. Message is sent via SMS gateway and logged in communication history.", cs: "Odešle SMS zprávu zákazníkovi. Vyžaduje platné telefonní číslo.", hu: "SMS üzenetet küld közvetlenül az ügyfélnek. Érvényes telefonszám szükséges.", ro: "Trimite un SMS direct clientului. Necesită număr de telefon valid.", it: "Invia un SMS direttamente al contatto. Richiede un numero di telefono valido.", de: "Sendet eine SMS-Nachricht direkt an den Kontakt. Erfordert eine gültige Telefonnummer." },
  atHelp_set_contact_status: { sk: "Automaticky zmení dispozíciu (status) kontaktu v kampani. Vhodné napr. pre automatickú zmenu stavu po podpise zmluvy alebo po vypršaní lehoty.", en: "Automatically changes the contact's disposition (status) in the campaign. Useful e.g. for auto-changing status after contract signing or deadline expiry.", cs: "Automaticky změní dispozici kontaktu v kampani. Vhodné pro automatickou změnu stavu po podpisu smlouvy.", hu: "Automatikusan megváltoztatja a kontakt diszpozícióját (státuszát) a kampányban.", ro: "Schimbă automat dispoziția (statusul) contactului în campanie.", it: "Cambia automaticamente la disposizione (stato) del contatto nella campagna.", de: "Ändert automatisch die Disposition (Status) des Kontakts in der Kampagne." },
  atHelp_notify_role:        { sk: "Odošle systémovú notifikáciu všetkým používateľom s danou rolou. Notifikácia sa zobrazí v reálnom čase cez WebSocket a je uložená v histórii notifikácií.", en: "Sends a system notification to all users with the chosen role. Notification appears in real-time via WebSocket and is saved in notification history.", cs: "Odešle systémovou notifikaci všem uživatelům s danou rolí.", hu: "Rendszerértesítést küld az összes, a kiválasztott szerepkörrel rendelkező felhasználónak.", ro: "Trimite o notificare de sistem tuturor utilizatorilor cu rolul ales.", it: "Invia una notifica di sistema a tutti gli utenti con il ruolo scelto.", de: "Sendet eine Systembenachrichtigung an alle Benutzer mit der gewählten Rolle." },
  atHelp_sys_webhook:        { sk: "Odošle HTTP POST požiadavku na zadanú URL adresu s JSON payloadom obsahujúcim dáta kontaktu a kampane. Vhodné pre integrácie s externými systémami (Zapier, Make, vlastné API).", en: "Sends an HTTP POST request to the specified URL with a JSON payload containing contact and campaign data. Suitable for integrations with external systems (Zapier, Make, custom API).", cs: "Odešle HTTP POST požadavek na zadanou URL s JSON payloadem. Vhodné pro integrace s externími systémy.", hu: "HTTP POST kérést küld a megadott URL-re JSON payloaddal. Külső rendszerekkel való integrációkhoz alkalmas.", ro: "Trimite o cerere HTTP POST la URL-ul specificat cu payload JSON. Potrivit pentru integrări cu sisteme externe.", it: "Invia una richiesta HTTP POST all'URL specificato con un payload JSON. Adatto per integrazioni con sistemi esterni.", de: "Sendet eine HTTP POST-Anfrage an die angegebene URL mit JSON-Payload. Geeignet für externe System-Integrationen." },

  ifWebhookUrl: { sk: "URL cieľového webhookového endpointu", en: "Webhook target URL", cs: "URL cílového webhookového endpointu", hu: "Webhook cél URL", ro: "URL-ul webhookului destinație", it: "URL webhook destinazione", de: "Webhook-Ziel-URL" },
  ifWebhookPh:  { sk: "https://hooks.zapier.com/...", en: "https://hooks.zapier.com/...", cs: "https://hooks.zapier.com/...", hu: "https://hooks.zapier.com/...", ro: "https://hooks.zapier.com/...", it: "https://hooks.zapier.com/...", de: "https://hooks.zapier.com/..." },

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
  ct_radio:    { sk: "Výber (CircleDot)", en: "CircleDot selection", cs: "Výběr (CircleDot)", hu: "Rádiógomb", ro: "Selecție (CircleDot)", it: "Selezione (CircleDot)", de: "Auswahl (CircleDot)" },
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
  tgSelectLbl:   { sk: "Priradiť skupinu alebo rolu", en: "Assign to group or role", cs: "Přiřadit skupině nebo roli", hu: "Csoport vagy szerepkör hozzárendelése", ro: "Atribuire grup sau rol", it: "Assegna a gruppo o ruolo", de: "Gruppe oder Rolle zuweisen" },
  tgGroupsHeader:{ sk: "Skupiny úloh", en: "Task Groups", cs: "Skupiny úkolů", hu: "Feladat csoportok", ro: "Grupuri sarcini", it: "Gruppi di lavoro", de: "Aufgabengruppen" },
  tgRolesHeader: { sk: "Roly (legacy)", en: "Roles (legacy)", cs: "Role (legacy)", hu: "Szerepkörök (legacy)", ro: "Roluri (legacy)", it: "Ruoli (legacy)", de: "Rollen (legacy)" },
  tgNoGroups:    { sk: "Žiadne skupiny", en: "No groups", cs: "Žádné skupiny", hu: "Nincs csoport", ro: "Niciun grup", it: "Nessun gruppo", de: "Keine Gruppen" },
  varPickerLbl:  { sk: "Vložiť premennú", en: "Insert variable", cs: "Vložit proměnnou", hu: "Változó beszúrása", ro: "Inserare variabilă", it: "Inserisci variabile", de: "Variable einfügen" },
  condExtended:  { sk: "Rozšírené", en: "Extended", cs: "Rozšířené", hu: "Bővített", ro: "Extins", it: "Esteso", de: "Erweitert" },
  condAlways:    { sk: "Vždy — pri každom potvrdení kroku", en: "Always — on every step confirmation", cs: "Vždy — při každém potvrzení kroku", hu: "Mindig — minden lépés megerősítésekor", ro: "Întotdeauna — la fiecare confirmare a pasului", it: "Sempre — ad ogni conferma del passo", de: "Immer — bei jeder Schrittbestätigung" },
  condCountry:   { sk: "Krajina zákazníka je...", en: "Customer country is...", cs: "Země zákazníka je...", hu: "Az ügyfél országa...", ro: "Țara clientului este...", it: "Il paese del cliente è...", de: "Land des Kunden ist..." },
  condAnswer:    { sk: "Odpoveď zákazníka je...", en: "Customer answer is...", cs: "Odpověď zákazníka je...", hu: "Az ügyfél válasza...", ro: "Răspunsul clientului este...", it: "La risposta del cliente è...", de: "Antwort des Kunden ist..." },
  condAnswerPh:  { sk: "Hodnota odpovede (napr. áno, nie, záujem...)", en: "Answer value (e.g. yes, no, interest...)", cs: "Hodnota odpovědi (např. ano, ne, zájem...)", hu: "Válasz értéke (pl. igen, nem, érdeklődés...)", ro: "Valoarea răspunsului (ex. da, nu, interes...)", it: "Valore risposta (es. sì, no, interesse...)", de: "Antwortwert (z.B. ja, nein, Interesse...)" },
  ifCompound:    { sk: "Zložená podmienka (IF builder)", en: "Compound condition (IF builder)", cs: "Složená podmínka (IF builder)", hu: "Összetett feltétel (IF builder)", ro: "Condiție compusă (IF builder)", it: "Condizione composta (IF builder)", de: "Zusammengesetzte Bedingung (IF builder)" },
  ifLogicAnd:    { sk: "Všetky podmienky musia platiť súčasne", en: "All conditions must be true simultaneously", cs: "Všechny podmínky musí platit současně", hu: "Minden feltételnek egyszerre kell teljesülnie", ro: "Toate condițiile trebuie să fie adevărate simultan", it: "Tutte le condizioni devono essere vere simultaneamente", de: "Alle Bedingungen müssen gleichzeitig erfüllt sein" },
  ifLogicOr:     { sk: "Aspoň jedna podmienka musí platiť", en: "At least one condition must be true", cs: "Alespoň jedna podmínka musí platit", hu: "Legalább egy feltételnek teljesülnie kell", ro: "Cel puțin o condiție trebuie să fie adevărată", it: "Almeno una condizione deve essere vera", de: "Mindestens eine Bedingung muss erfüllt sein" },
  ifValPh:       { sk: "Hodnota...", en: "Value...", cs: "Hodnota...", hu: "Érték...", ro: "Valoare...", it: "Valore...", de: "Wert..." },
  ifAddRule:     { sk: "+ Pridať podmienku", en: "+ Add condition", cs: "+ Přidat podmínku", hu: "+ Feltétel hozzáadása", ro: "+ Adaugă condiție", it: "+ Aggiungi condizione", de: "+ Bedingung hinzufügen" },
  calls:         { sk: "Hovory", en: "Calls", cs: "Hovory", hu: "Hívások", ro: "Apeluri", it: "Chiamate", de: "Anrufe" },
  contact:       { sk: "Kontakt", en: "Contact", cs: "Kontakt", hu: "Kontakt", ro: "Contact", it: "Contatto", de: "Kontakt" },
  answer:        { sk: "Odpovede", en: "Answers", cs: "Odpovědi", hu: "Válaszok", ro: "Răspunsuri", it: "Risposte", de: "Antworten" },
  time:          { sk: "Čas", en: "Time", cs: "Čas", hu: "Idő", ro: "Timp", it: "Tempo", de: "Zeit" },
  campaign:      { sk: "Kampaň", en: "Campaign", cs: "Kampaň", hu: "Kampány", ro: "Campanie", it: "Campagna", de: "Kampagne" },
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

  previewBtn:      { sk: "Náhľad agenta", en: "Agent preview", cs: "Náhled agenta", hu: "Ügynök előnézet", ro: "Previzualizare agent", it: "Anteprima agente", de: "Agenten-Vorschau" },
  previewClose:    { sk: "Zatvoriť náhľad", en: "Close preview", cs: "Zavřít náhled", hu: "Előnézet bezárása", ro: "Închide previzualizarea", it: "Chiudi anteprima", de: "Vorschau schließen" },
  previewTitle:    { sk: "Náhľad — pohľad agenta", en: "Preview — agent view", cs: "Náhled — pohled agenta", hu: "Előnézet — ügynök nézet", ro: "Previzualizare — vedere agent", it: "Anteprima — vista agente", de: "Vorschau — Agentensicht" },
  previewEmpty:    { sk: "Zoznam je prázdny", en: "List is empty", cs: "Seznam je prázdný", hu: "A lista üres", ro: "Lista este goală", it: "L'elenco è vuoto", de: "Liste ist leer" },
  previewSteps:    { sk: "krokov", en: "steps", cs: "kroků", hu: "lépés", ro: "pași", it: "passi", de: "Schritte" },
  previewAutomations: { sk: "automatizácií", en: "automations", cs: "automatizací", hu: "automatizáció", ro: "automatizări", it: "automazioni", de: "Automatisierungen" },

  questionsTitle:  { sk: "Otázky", en: "Questions", cs: "Otázky", hu: "Kérdések", ro: "Întrebări", it: "Domande", de: "Fragen" },
  addQuestionBtn:  { sk: "Pridať otázku", en: "Add question", cs: "Přidat otázku", hu: "Kérdés hozzáadása", ro: "Adăugare întrebare", it: "Aggiungi domanda", de: "Frage hinzufügen" },
  qGroupNameLbl:   { sk: "Skupina otázok", en: "Question group", cs: "Skupina otázek", hu: "Kérdéscsoport", ro: "Grup de întrebări", it: "Gruppo di domande", de: "Fragengruppe" },
  qGroupNamePh:    { sk: "napr. Záujem klienta...", en: "e.g. Client interest...", cs: "např. Zájem klienta...", hu: "pl. Ügyfél érdeklődése...", ro: "ex. Interesul clientului...", it: "es. Interesse cliente...", de: "z.B. Kundeninteresse..." },
  questionTextLbl: { sk: "Text otázky", en: "Question text", cs: "Text otázky", hu: "Kérdés szövege", ro: "Textul întrebării", it: "Testo della domanda", de: "Fragetext" },
  questionTextPh:  { sk: "Otázka pre agenta...", en: "Question for agent...", cs: "Otázka pro agenta...", hu: "Kérdés az ügynöknek...", ro: "Întrebare pentru agent...", it: "Domanda per l'agente...", de: "Frage für den Agenten..." },
  qLogicLbl:       { sk: "Logika skupiny", en: "Group logic", cs: "Logika skupiny", hu: "Csoport logikája", ro: "Logica grupului", it: "Logica del gruppo", de: "Gruppenlogik" },
  qGotoLbl:        { sk: "Pri zaškrtnutí → skočiť na", en: "On check → jump to", cs: "Po zaškrtnutí → přejít na", hu: "Bejelöléskor → ugrás ide", ro: "La bifat → salt la", it: "Al check → vai a", de: "Bei Haken → springe zu" },
  qGotoNone:       { sk: "— žiadne —", en: "— none —", cs: "— žádné —", hu: "— nincs —", ro: "— niciunul —", it: "— nessuno —", de: "— keines —" },
  qGotoStepsGrp:   { sk: "Kroky statusového zoznamu", en: "Status list steps", cs: "Kroky stavového seznamu", hu: "Állapotlista lépései", ro: "Pași din lista de stare", it: "Passi della lista stati", de: "Status-Liste-Schritte" },
  qGotoQsGrp:      { sk: "Otázky", en: "Questions", cs: "Otázky", hu: "Kérdések", ro: "Întrebări", it: "Domande", de: "Fragen" },
  qGotoNoOptions:  { sk: "Pridajte ďalšie otázky pre vetvenie", en: "Add more questions to enable branching", cs: "Přidejte další otázky pro větvení", hu: "Adjon hozzá több kérdést az elágazáshoz", ro: "Adăugați mai multe întrebări pentru ramificare", it: "Aggiungi domande per abilitare la ramificazione", de: "Weitere Fragen für Verzweigungen hinzufügen" },
  qSaved:          { sk: "Otázka uložená", en: "Question saved", cs: "Otázka uložena", hu: "Kérdés mentve", ro: "Întrebare salvată", it: "Domanda salvata", de: "Frage gespeichert" },
  qAdded:          { sk: "Otázka pridaná", en: "Question added", cs: "Otázka přidána", hu: "Kérdés hozzáadva", ro: "Întrebare adăugată", it: "Domanda aggiunta", de: "Frage hinzugefügt" },
  qDeleted:        { sk: "Otázka zmazaná", en: "Question deleted", cs: "Otázka smazána", hu: "Kérdés törölve", ro: "Întrebare ștearsă", it: "Domanda eliminata", de: "Frage gelöscht" },
  qCopied:         { sk: "Otázka skopírovaná", en: "Question copied", cs: "Otázka zkopírována", hu: "Kérdés másolva", ro: "Întrebare copiată", it: "Domanda copiata", de: "Frage kopiert" },
  qActionsTitle:   { sk: "Akcie otázky", en: "Question actions", cs: "Akce otázky", hu: "Kérdés akciói", ro: "Acțiuni întrebare", it: "Azioni domanda", de: "Frageaktionen" },
  addQActionBtn:   { sk: "Pridať akciu", en: "Add action", cs: "Přidat akci", hu: "Akció hozzáadása", ro: "Adăugare acțiune", it: "Aggiungi azione", de: "Aktion hinzufügen" },
  qRequired:       { sk: "Povinná otázka", en: "Required question", cs: "Povinná otázka", hu: "Kötelező kérdés", ro: "Întrebare obligatorie", it: "Domanda obbligatoria", de: "Pflichtfrage" },
  noQuestions:     { sk: "Žiadne otázky", en: "No questions", cs: "Žádné otázky", hu: "Nincs kérdés", ro: "Fără întrebări", it: "Nessuna domanda", de: "Keine Fragen" },
  qCountLabel:     { sk: "otázok", en: "questions", cs: "otázek", hu: "kérdés", ro: "întrebări", it: "domande", de: "Fragen" },
  qIconLbl:        { sk: "Ikona", en: "Icon", cs: "Ikona", hu: "Ikon", ro: "Iconă", it: "Icona", de: "Symbol" },
  qColorLbl:       { sk: "Farba", en: "Color", cs: "Barva", hu: "Szín", ro: "Culoare", it: "Colore", de: "Farbe" },
  qNoIcon:         { sk: "Bez ikony", en: "No icon", cs: "Bez ikony", hu: "Nincs ikon", ro: "Fără iconă", it: "Nessuna icona", de: "Kein Symbol" },
  qDescLbl:        { sk: "Popis otázky", en: "Question description", cs: "Popis otázky", hu: "Kérdés leírása", ro: "Descriere întrebare", it: "Descrizione domanda", de: "Fragenbeschreibung" },
  qDescPh:         { sk: "Krátky popis, nápoveda pre agenta...", en: "Short description, hint for agent...", cs: "Krátký popis, nápověda pro agenta...", hu: "Rövid leírás, súgó az ügynöknek...", ro: "Descriere scurtă, indiciu pentru agent...", it: "Breve descrizione, suggerimento per l'agente...", de: "Kurzbeschreibung, Hinweis für den Agenten..." },
  qFieldTypeLbl:   { sk: "Typ poľa", en: "Field type", cs: "Typ pole", hu: "Mező típusa", ro: "Tip câmp", it: "Tipo di campo", de: "Feldtyp" },
  qHiddenLbl:      { sk: "Skrytá (systémová)", en: "Hidden (system)", cs: "Skrytá (systémová)", hu: "Rejtett (rendszer)", ro: "Ascuns (sistem)", it: "Nascosto (sistema)", de: "Versteckt (System)" },
  qSystemAuto:     { sk: "systémová automatizácia", en: "system automation", cs: "systémová automatizace", hu: "rendszerautomatizálás", ro: "automatizare sistem", it: "automazione di sistema", de: "Systemautomatisierung" },
  qGroupDone:      { sk: "Hotovo", en: "Done", cs: "Hotovo", hu: "Kész", ro: "Gata", it: "Fatto", de: "Fertig" },
  ftCheckbox:      { sk: "Zaškrtávacie pole", en: "Checkbox", cs: "Zaškrtávací pole", hu: "Jelölőnégyzet", ro: "Bifă", it: "Casella di controllo", de: "Kontrollkästchen" },
  ftRadio:         { sk: "Výberové tlačidlo", en: "Radio button", cs: "Přepínač", hu: "Választógomb", ro: "Buton radio", it: "Pulsante radio", de: "Optionsfeld" },
  ftYesno:         { sk: "Áno / Nie", en: "Yes / No", cs: "Ano / Ne", hu: "Igen / Nem", ro: "Da / Nu", it: "Sì / No", de: "Ja / Nein" },
  ftText:          { sk: "Textové pole", en: "Text input", cs: "Textové pole", hu: "Szövegmező", ro: "Câmp text", it: "Campo testo", de: "Texteingabe" },
  ftNumber:        { sk: "Číslo", en: "Number", cs: "Číslo", hu: "Szám", ro: "Număr", it: "Numero", de: "Zahl" },
  ftDate:          { sk: "Dátum", en: "Date", cs: "Datum", hu: "Dátum", ro: "Dată", it: "Data", de: "Datum" },
};

const QUESTION_ICONS: { name: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { name: "SquareCheck", icon: SquareCheck },
  { name: "CircleHelp",  icon: CircleHelp },
  { name: "Info",        icon: Info },
  { name: "CircleAlert", icon: CircleAlert },
  { name: "CircleCheck", icon: CircleCheck },
  { name: "Star",        icon: Star },
  { name: "Heart",       icon: Heart },
  { name: "Phone",       icon: Phone },
  { name: "Mail",        icon: Mail },
  { name: "Calendar",    icon: Calendar },
  { name: "User",        icon: User },
  { name: "FileText",    icon: FileText },
  { name: "MessageCircle", icon: MessageCircle },
  { name: "MapPin",      icon: MapPin },
  { name: "Clock",       icon: Clock },
  { name: "DollarSign",  icon: DollarSign },
  { name: "Shield",      icon: Shield },
  { name: "Activity",    icon: Activity },
  { name: "Home",        icon: Home },
  { name: "Building2",   icon: Building2 },
  { name: "Flag",        icon: Flag },
  { name: "Lightbulb",   icon: Lightbulb },
  { name: "Lock",        icon: Lock },
  { name: "Award",       icon: Award },
  { name: "Smile",       icon: Smile },
  { name: "Stethoscope", icon: Stethoscope },
  { name: "Baby",        icon: Baby },
  { name: "Dna",         icon: Dna },
  { name: "ClipboardCheck", icon: ClipboardCheck },
  { name: "Zap",         icon: Zap },
];

const QUESTION_COLORS = [
  { name: "gray",    dot: "bg-gray-400",    text: "text-gray-500 dark:text-gray-400" },
  { name: "blue",    dot: "bg-blue-500",    text: "text-blue-500 dark:text-blue-400" },
  { name: "green",   dot: "bg-green-500",   text: "text-green-600 dark:text-green-400" },
  { name: "amber",   dot: "bg-amber-400",   text: "text-amber-500 dark:text-amber-400" },
  { name: "red",     dot: "bg-red-500",     text: "text-red-500 dark:text-red-400" },
  { name: "purple",  dot: "bg-purple-500",  text: "text-purple-500 dark:text-purple-400" },
  { name: "pink",    dot: "bg-pink-400",    text: "text-pink-500 dark:text-pink-400" },
  { name: "cyan",    dot: "bg-cyan-400",    text: "text-cyan-500 dark:text-cyan-400" },
  { name: "orange",  dot: "bg-orange-400",  text: "text-orange-500 dark:text-orange-400" },
  { name: "emerald", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  { name: "indigo",  dot: "bg-indigo-500",  text: "text-indigo-500 dark:text-indigo-400" },
  { name: "rose",    dot: "bg-rose-500",    text: "text-rose-500 dark:text-rose-400" },
];

const FIELD_TYPES: { value: string; labelKey: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "checkbox", labelKey: "ftCheckbox", icon: SquareCheck },
  { value: "radio",    labelKey: "ftRadio",    icon: CircleDot },
  { value: "yesno",   labelKey: "ftYesno",    icon: ToggleLeft },
  { value: "text",    labelKey: "ftText",     icon: Type },
  { value: "number",  labelKey: "ftNumber",   icon: Hash },
  { value: "date",    labelKey: "ftDate",     icon: Calendar },
];

function getQFieldTypeIcon(ft?: string | null): React.ComponentType<{ className?: string }> {
  return FIELD_TYPES.find(f => f.value === ft)?.icon ?? SquareCheck;
}

function getQIconColorClass(color?: string | null) {
  return QUESTION_COLORS.find(c => c.name === color)?.text ?? "text-muted-foreground/40";
}

function QuestionIcon({ iconName, color, className }: { iconName?: string | null; color?: string | null; className?: string }) {
  const found = QUESTION_ICONS.find(i => i.name === iconName);
  const Icon = found?.icon ?? SquareCheck;
  return <Icon className={`${className ?? "h-3 w-3"} ${getQIconColorClass(color)} shrink-0`} />;
}

function sl(key: string, locale: string): string {
  return SL[key]?.[locale] ?? SL[key]?.["sk"] ?? key;
}

const ROLE_TERMS: Record<string, Record<string, string>> = {
  KO: { sk: "Koordinátor", en: "Coordinator", cs: "Koordinátor", hu: "Koordinátor", ro: "Coordonator", it: "Coordinatore", de: "Koordinator" },
};

function localizeText(text: string | null | undefined, locale: string): string {
  if (!text) return "";
  const term = ROLE_TERMS.KO[locale] ?? "Koordinátor";
  return text
    .replace(/\bKO\b/g, term)
    .replace(/\bKoordinátor\w*/g, term);
}


function PreviewQuestions({
  questions, locale, allItems,
}: {
  questions: StatusListQuestion[];
  locale: string;
  allItems: StatusListItem[];
}) {
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const questionRefs = new Map<string, HTMLDivElement | null>();

  function isAnswered(q: StatusListQuestion): boolean {
    const v = answers[q.id];
    return v !== undefined && v !== null && v !== "" && v !== false;
  }

  function triggerGoto(q: StatusListQuestion) {
    if (q.gotoQuestionId) {
      setHighlightedId(q.gotoQuestionId);
      if (!q.gotoQuestionId.startsWith("step:")) {
        setTimeout(() => {
          const el = questionRefs.get(q.gotoQuestionId!);
          el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 50);
      }
    }
  }

  function handleAnswer(q: StatusListQuestion, value: string | boolean, groupQs: StatusListQuestion[]) {
    const ft = q.fieldType || "checkbox";
    if (ft === "checkbox") {
      setAnswers(prev => {
        const next = { ...prev };
        if (next[q.id]) { delete next[q.id]; setHighlightedId(null); }
        else { next[q.id] = true; triggerGoto(q); }
        return next;
      });
    } else if (ft === "radio") {
      setAnswers(prev => {
        const next = { ...prev };
        groupQs.forEach(gq => { if ((gq.fieldType || "checkbox") === "radio") delete next[gq.id]; });
        if (prev[q.id]) { delete next[q.id]; }
        else { next[q.id] = true; triggerGoto(q); }
        return next;
      });
    } else if (ft === "yesno") {
      setAnswers(prev => {
        const next = { ...prev };
        if (next[q.id] === value) { delete next[q.id]; }
        else { next[q.id] = value; triggerGoto(q); }
        return next;
      });
    } else {
      setAnswers(prev => ({ ...prev, [q.id]: value }));
      if (value) triggerGoto(q);
    }
  }

  function findGotoText(gotoId: string): string {
    if (gotoId.startsWith("step:")) {
      const stepId = gotoId.slice(5);
      const step = allItems.find(it => it.stepId === stepId);
      return step ? `→ ${step.stepId}: ${step.label}` : `→ ${stepId}`;
    }
    for (const item of allItems) {
      const target = (item.questions ?? []).find(q => q.id === gotoId);
      if (target) return target.questionText;
    }
    return "";
  }

  function isGroupComplete(gqs: StatusListQuestion[]): boolean {
    const visible = gqs.filter(q => !q.isHidden);
    if (visible.length === 0) return true;
    const required = visible.filter(q => q.required);
    const op = gqs[0]?.logicOperator ?? "AND";
    if (required.length > 0) {
      return op === "OR" ? required.some(q => isAnswered(q)) : required.every(q => isAnswered(q));
    }
    return visible.some(q => isAnswered(q));
  }

  const grouped: Record<string, StatusListQuestion[]> = {};
  questions.forEach(q => {
    const k = q.groupName || "__";
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(q);
  });

  return (
    <div className="mt-2 space-y-1.5">
      {Object.entries(grouped).map(([gk, gqs]) => {
        const visibleQs = gqs.filter(q => !q.isHidden);
        const allSystem = visibleQs.length === 0 && gqs.length > 0;
        const complete = !allSystem && isGroupComplete(gqs);
        const borderClass = allSystem
          ? "border-amber-200/60 dark:border-amber-800/40"
          : complete
            ? "border-green-300 dark:border-green-700/50"
            : "border-blue-100 dark:border-blue-900/30";
        return (
          <div key={gk} className={`border rounded-md overflow-hidden transition-colors ${borderClass}`}>
            {/* Group header */}
            {gk !== "__" && (
              <div className={`flex items-center gap-2 px-2.5 py-1.5 border-b ${
                allSystem
                  ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-800/30"
                  : complete
                    ? "bg-green-50 dark:bg-green-950/20 border-green-200/50 dark:border-green-800/30"
                    : "bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30"
              }`}>
                {allSystem
                  ? <Settings className="h-3 w-3 text-amber-500 shrink-0" />
                  : complete
                    ? <CircleCheck className="h-3 w-3 text-green-500 shrink-0" />
                    : <CircleHelp className="h-3 w-3 text-blue-500 shrink-0" />}
                <span className={`text-xs font-semibold ${
                  allSystem ? "text-amber-700 dark:text-amber-300"
                  : complete ? "text-green-700 dark:text-green-300"
                  : "text-blue-700 dark:text-blue-300"
                }`}>{gk}</span>
                {allSystem && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">SYSTEM</span>}
                {complete && !allSystem && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">✓</span>}
                {!allSystem && (
                  <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    gqs[0].logicOperator === "AND"
                      ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                      : "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                  }`}>{gqs[0].logicOperator}</span>
                )}
              </div>
            )}
            {/* System group body */}
            {allSystem && (
              <div className="px-3 py-2 flex items-center gap-2">
                <Zap className="h-3 w-3 text-amber-500 shrink-0" />
                <span className="text-xs text-amber-700 dark:text-amber-400 italic">
                  {gqs.length}× {sl("qSystemAuto", locale)}
                </span>
              </div>
            )}
            {/* Visible questions */}
            {visibleQs.map(q => {
              const qDone = isAnswered(q);
              const isHighlighted = highlightedId === q.id;
              const gotoText = q.gotoQuestionId && qDone ? findGotoText(q.gotoQuestionId) : "";
              const ft = q.fieldType || "checkbox";
              return (
                <div
                  key={q.id}
                  ref={(el: HTMLDivElement | null) => { questionRefs.set(q.id, el); }}
                  className={`border-b border-blue-100/50 dark:border-blue-900/20 last:border-b-0 transition-all duration-200 ${
                    isHighlighted ? "ring-2 ring-inset ring-blue-400 bg-blue-50 dark:bg-blue-950/30" : ""
                  }`}
                >
                  {/* CHECKBOX */}
                  {(ft === "checkbox") && (
                    <button type="button" onClick={() => handleAnswer(q, true, gqs)}
                      className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors ${qDone ? "bg-green-50 dark:bg-green-950/20" : "hover:bg-muted/30"}`}>
                      <div className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-colors ${qDone ? "bg-green-500 border-green-500" : "border-muted-foreground/40 bg-background"}`}>
                        {qDone && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <div className="mt-0.5 shrink-0"><QuestionIcon iconName={q.icon} color={q.color} className="h-3.5 w-3.5" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-1.5 flex-wrap">
                          <span className={`text-sm leading-snug ${qDone ? "text-green-700 dark:text-green-400 font-medium" : "text-foreground"}`}>{q.questionText}</span>
                          {q.required && !qDone && <span className="text-[9px] px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold shrink-0 mt-0.5">!</span>}
                        </div>
                        {q.description && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{q.description}</p>}
                        {gotoText && <span className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-0.5 mt-0.5"><ArrowDownRight className="h-3 w-3 shrink-0" /><span className="truncate">{gotoText}</span></span>}
                      </div>
                    </button>
                  )}
                  {/* RADIO */}
                  {ft === "radio" && (
                    <button type="button" onClick={() => handleAnswer(q, true, gqs)}
                      className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors ${qDone ? "bg-blue-50 dark:bg-blue-950/20" : "hover:bg-muted/30"}`}>
                      <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${qDone ? "border-blue-500" : "border-muted-foreground/40"}`}>
                        {qDone && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                      </div>
                      <div className="mt-0.5 shrink-0"><QuestionIcon iconName={q.icon} color={q.color} className="h-3.5 w-3.5" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-1.5 flex-wrap">
                          <span className={`text-sm leading-snug ${qDone ? "text-blue-700 dark:text-blue-300 font-medium" : "text-foreground"}`}>{q.questionText}</span>
                          {q.required && !qDone && <span className="text-[9px] px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold shrink-0 mt-0.5">!</span>}
                        </div>
                        {q.description && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{q.description}</p>}
                        {gotoText && <span className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-0.5 mt-0.5"><ArrowDownRight className="h-3 w-3 shrink-0" /><span className="truncate">{gotoText}</span></span>}
                      </div>
                    </button>
                  )}
                  {/* TEXT / NUMBER / DATE */}
                  {(ft === "text" || ft === "number" || ft === "date") && (
                    <div className="flex items-start gap-2.5 px-3 py-2">
                      <div className="mt-1 shrink-0"><QuestionIcon iconName={q.icon} color={q.color} className="h-3.5 w-3.5" /></div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-foreground leading-snug">{q.questionText}</span>
                          {q.required && !qDone && <span className="text-[9px] px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold">!</span>}
                        </div>
                        {q.description && <p className="text-xs text-muted-foreground leading-snug">{q.description}</p>}
                        <input
                          type={ft === "date" ? "date" : ft === "number" ? "number" : "text"}
                          className="h-7 w-full rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""}
                          onChange={e => handleAnswer(q, e.target.value, gqs)}
                          placeholder={ft !== "date" ? "..." : undefined}
                        />
                        {gotoText && <span className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-0.5"><ArrowDownRight className="h-3 w-3 shrink-0" /><span className="truncate">{gotoText}</span></span>}
                      </div>
                    </div>
                  )}
                  {/* YESNO */}
                  {ft === "yesno" && (
                    <div className="flex items-start gap-2.5 px-3 py-2">
                      <div className="mt-0.5 shrink-0"><QuestionIcon iconName={q.icon} color={q.color} className="h-3.5 w-3.5" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm text-foreground leading-snug">{q.questionText}</span>
                              {q.required && !qDone && <span className="text-[9px] px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold">!</span>}
                            </div>
                            {q.description && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{q.description}</p>}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button type="button" onClick={() => handleAnswer(q, "yes", gqs)}
                              className={`px-2.5 py-1 text-xs rounded border font-semibold transition-colors ${answers[q.id] === "yes" ? "bg-green-500 border-green-500 text-white" : "border-border hover:bg-green-50 dark:hover:bg-green-950/20 text-foreground"}`}>
                              Áno
                            </button>
                            <button type="button" onClick={() => handleAnswer(q, "no", gqs)}
                              className={`px-2.5 py-1 text-xs rounded border font-semibold transition-colors ${answers[q.id] === "no" ? "bg-red-500 border-red-500 text-white" : "border-border hover:bg-red-50 dark:hover:bg-red-950/20 text-foreground"}`}>
                              Nie
                            </button>
                          </div>
                        </div>
                        {gotoText && <span className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-0.5 mt-1"><ArrowDownRight className="h-3 w-3 shrink-0" /><span className="truncate">{gotoText}</span></span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {/* Completion footer for ungrouped when done */}
            {gk === "__" && complete && visibleQs.length > 0 && (
              <div className="px-3 py-1 bg-green-50 dark:bg-green-950/10 border-t border-green-200/50 dark:border-green-800/30 flex items-center gap-1.5">
                <CircleCheck className="h-3 w-3 text-green-500 shrink-0" />
                <span className="text-xs text-green-700 dark:text-green-400 font-medium">{sl("qGroupDone", locale)}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusListPreview({ items, locale }: { items: StatusListItem[]; locale: string }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
        <ListChecks className="h-8 w-8 opacity-30" />
        <p className="text-sm">{sl("previewEmpty", locale)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b">
        <ListChecks className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">{sl("previewTitle", locale)}</span>
        <span className="ml-auto text-xs text-muted-foreground">{items.length} {sl("previewSteps", locale)}</span>
      </div>
      {items.map((item, idx) => {
        const ConfirmIcon = CONFIRM_TYPE_OPTIONS.find(o => o.value === item.confirmationType)?.icon || SquareCheck;
        const isChecked = checked.has(item.id);
        const autoCount = item.automations?.length ?? 0;
        return (
          <div
            key={item.id}
            className={`rounded-lg border p-3 transition-colors ${isChecked ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xs font-mono text-muted-foreground/60 w-5 shrink-0 pt-0.5">{idx + 1}.</span>
              <button
                type="button"
                onClick={() => setChecked(prev => {
                  const next = new Set(prev);
                  if (next.has(item.id)) { next.delete(item.id); } else { next.add(item.id); }
                  return next;
                })}
                className={`mt-0.5 shrink-0 transition-colors ${item.confirmationType === "info" ? "cursor-default" : "cursor-pointer"}`}
                title={item.confirmationType}
              >
                <ConfirmIcon className={`h-4 w-4 ${isChecked ? "text-primary" : "text-muted-foreground/50"}`} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-medium ${isChecked ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {localizeText(item.label, locale)}
                  </span>
                  {item.required && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium">
                      {sl("requiredBadge", locale)}
                    </span>
                  )}
                  {autoCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                      <Zap className="h-2.5 w-2.5" />
                      {autoCount} {sl("previewAutomations", locale)}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3 leading-relaxed whitespace-pre-line">
                    {localizeText(item.description, locale)}
                  </p>
                )}
                {(item.questions?.length ?? 0) > 0 && (
                  <PreviewQuestions questions={item.questions} locale={locale} allItems={items} />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
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
  { value: "checkbox", slKey: "ct_checkbox", icon: SquareCheck },
  { value: "radio",    slKey: "ct_radio",    icon: CircleDot },
  { value: "info",     slKey: "ct_info",     icon: Info },
];

const COUNTRY_OPTIONS = [
  { value: "SK", slKey: "ctr_SK" }, { value: "CZ", slKey: "ctr_CZ" },
  { value: "HU", slKey: "ctr_HU" }, { value: "RO", slKey: "ctr_RO" },
  { value: "AT", slKey: "ctr_AT" }, { value: "DE", slKey: "ctr_DE" },
  { value: "IT", slKey: "ctr_IT" }, { value: "US", slKey: "ctr_US" },
];

type ConditionFieldDef = {
  key: string;
  category: string;
  labelSk: string; labelEn: string;
  descSk: string;  descEn: string;
  ops: { value: string; labelSk: string; labelEn: string }[];
  valueType: "text" | "number" | "select" | "bool" | "disp_count";
  options?: { value: string; labelSk: string; labelEn: string }[];
};

const OPS_NUM = [
  { value: "gt",  labelSk: "je väčší ako",    labelEn: "is greater than" },
  { value: "lt",  labelSk: "je menší ako",     labelEn: "is less than" },
  { value: "gte", labelSk: "je väčší/rovný",   labelEn: "is ≥" },
  { value: "lte", labelSk: "je menší/rovný",   labelEn: "is ≤" },
  { value: "eq",  labelSk: "sa rovná",         labelEn: "equals" },
];
const OPS_STR = [
  { value: "eq",       labelSk: "je",             labelEn: "is" },
  { value: "neq",      labelSk: "nie je",          labelEn: "is not" },
  { value: "contains", labelSk: "obsahuje",        labelEn: "contains" },
];
const OPS_BOOL = [
  { value: "eq", labelSk: "je", labelEn: "is" },
];

const CONDITION_FIELDS: ConditionFieldDef[] = [
  {
    key: "call_count", category: "calls",
    labelSk: "Počet hovorov", labelEn: "Call count",
    descSk: "Celkový počet pokusov o hovor s týmto kontaktom v kampani. Použite napr. > 3 pre kontakty, kde sa nedarí dovolať.",
    descEn: "Total number of call attempts for this contact in the campaign. E.g. > 3 for contacts with repeated no-answer.",
    ops: OPS_NUM, valueType: "number",
  },
  {
    key: "days_in_status", category: "calls",
    labelSk: "Dní v tomto stave", labelEn: "Days in this status",
    descSk: "Koľko dní uplynulo od poslednej zmeny stavu kontaktu. Napr. >= 7 = kontakt je v stave dlhšie ako týždeň.",
    descEn: "How many days since the contact's status last changed. E.g. >= 7 means stuck in status for over a week.",
    ops: OPS_NUM, valueType: "number",
  },
  {
    key: "last_call_outcome", category: "calls",
    labelSk: "Výsledok posledného hovoru", labelEn: "Last call outcome",
    descSk: "Dispozícia (výsledok) posledného zaznamenaného hovoru. Napr. no_answer = kontakt nepribral.",
    descEn: "Disposition (outcome) of the most recent recorded call. E.g. no_answer = contact didn't pick up.",
    ops: OPS_STR, valueType: "select",
    options: [
      { value: "no_answer",    labelSk: "Nezobral",        labelEn: "No answer" },
      { value: "callback",     labelSk: "Zavolať neskôr",  labelEn: "Callback" },
      { value: "interested",   labelSk: "Záujem",          labelEn: "Interested" },
      { value: "not_interested", labelSk: "Nemá záujem",   labelEn: "Not interested" },
      { value: "completed",    labelSk: "Hotový",          labelEn: "Completed" },
    ],
  },
  {
    key: "country", category: "contact",
    labelSk: "Krajina kontaktu", labelEn: "Contact country",
    descSk: "ISO kód krajiny kontaktu (SK, CZ, HU, RO, AT, DE, IT). Podmienka je splnená ak sa zhoduje.",
    descEn: "ISO country code of the contact (SK, CZ, HU, RO, AT, DE, IT). Condition is met when it matches.",
    ops: OPS_STR, valueType: "select",
    options: COUNTRY_OPTIONS.map(c => ({ value: c.value, labelSk: c.value, labelEn: c.value })),
  },
  {
    key: "has_email", category: "contact",
    labelSk: "Má e-mail", labelEn: "Has email",
    descSk: "Kontakt má vyplnenú e-mailovú adresu. true = áno, false = nie.",
    descEn: "Contact has an email address on file. true = yes, false = no.",
    ops: OPS_BOOL, valueType: "bool",
  },
  {
    key: "has_phone", category: "contact",
    labelSk: "Má telefón", labelEn: "Has phone",
    descSk: "Kontakt má vyplnené telefónne číslo. true = áno, false = nie.",
    descEn: "Contact has a phone number on file. true = yes, false = no.",
    ops: OPS_BOOL, valueType: "bool",
  },
  {
    key: "is_pregnant", category: "contact",
    labelSk: "Je tehotná", labelEn: "Is pregnant",
    descSk: "Kontakt je aktuálne tehotná (podľa záznamu). Relevantné pre cord blood kampane.",
    descEn: "Contact is currently pregnant (per record). Relevant for cord blood campaigns.",
    ops: OPS_BOOL, valueType: "bool",
  },
  {
    key: "due_date_weeks", category: "contact",
    labelSk: "Týždňov do pôrodu", labelEn: "Weeks until due date",
    descSk: "Počet týždňov zostávajúcich do termínu pôrodu. Napr. <= 12 = posledný trimester.",
    descEn: "Weeks remaining until due date. E.g. <= 12 = last trimester.",
    ops: OPS_NUM, valueType: "number",
  },
  {
    key: "segment", category: "contact",
    labelSk: "Segment kontaktu", labelEn: "Contact segment",
    descSk: "CRM segment kontaktu (hot, warm, cold, new). Slúži na prioritizáciu spracovania.",
    descEn: "CRM segment of the contact (hot, warm, cold, new). Used for prioritization.",
    ops: OPS_STR, valueType: "select",
    options: [
      { value: "hot",  labelSk: "Hot",  labelEn: "Hot" },
      { value: "warm", labelSk: "Warm", labelEn: "Warm" },
      { value: "cold", labelSk: "Cold", labelEn: "Cold" },
      { value: "new",  labelSk: "New",  labelEn: "New" },
    ],
  },
  {
    key: "answer_is_yes", category: "answer",
    labelSk: "Odpoveď na posled. otázku je ÁNO", labelEn: "Last answer is YES",
    descSk: "Posledná zachytená odpoveď kontaktu na otázku v zozname je kladná (yes/true). Platí pre Yes/No a Checkbox otázky.",
    descEn: "The last captured answer from the contact in this checklist is positive (yes/true). Applies to Yes/No and Checkbox questions.",
    ops: OPS_BOOL, valueType: "bool",
  },
  {
    key: "answer_for_question", category: "answer",
    labelSk: "Odpoveď na konkrétnu otázku", labelEn: "Answer for specific question",
    descSk: "Textová odpoveď kontaktu na zvolenú otázku. Zadajte ID otázky | hodnota, napr. q_123|yes.",
    descEn: "Text answer from the contact for a selected question. Enter question ID|value, e.g. q_123|yes.",
    ops: OPS_STR, valueType: "text",
  },
  {
    key: "hour_of_day", category: "time",
    labelSk: "Hodina dňa (0–23)", labelEn: "Hour of day (0–23)",
    descSk: "Aktuálna hodina dňa v čase vyhodnotenia (0 = polnoc, 12 = poludnie, 17 = 17:00). Vhodné pre časové podmienky kontaktovania.",
    descEn: "Current hour of day at evaluation time (0 = midnight, 12 = noon, 17 = 5 PM). Useful for time-of-day contact restrictions.",
    ops: OPS_NUM, valueType: "number",
  },
  {
    key: "day_of_week", category: "time",
    labelSk: "Deň týždňa", labelEn: "Day of week",
    descSk: "Deň v týždni pri vyhodnotení (1=Pondelok … 7=Nedeľa). Napr. lte 5 = len pracovné dni.",
    descEn: "Day of the week at evaluation time (1=Monday … 7=Sunday). E.g. lte 5 = weekdays only.",
    ops: OPS_NUM, valueType: "number",
  },
  {
    key: "dispositions_count", category: "campaign",
    labelSk: "Počet dispozícií v kampani", labelEn: "Dispositions count in campaign",
    descSk: "Celkový počet záznamu výsledkov (dispozícií) tohto kontaktu v kampani. Napr. >= 3 = kontaktovaný viackrát.",
    descEn: "Total number of disposition entries for this contact in the campaign. E.g. >= 3 = contacted multiple times.",
    ops: OPS_NUM, valueType: "number",
  },
  {
    key: "assigned_status_code", category: "campaign",
    labelSk: "Kód priradeného stavu", labelEn: "Assigned status code",
    descSk: "Interný kód aktuálneho stavu kontaktu v kampani (napr. INTERESTED, NO_ANSWER). Citlivé na veľké/malé písmená.",
    descEn: "Internal code of the contact's current campaign status (e.g. INTERESTED, NO_ANSWER). Case-sensitive.",
    ops: OPS_STR, valueType: "text",
  },
  {
    key: "contact.segment", category: "contact",
    labelSk: "CRM segment kontaktu", labelEn: "Contact CRM segment",
    descSk: "CRM stav/segment kontaktu (napr. potential, in_process, client). Podmienka sa vyhodnocuje voči aktuálnej hodnote.",
    descEn: "CRM status/segment of the contact (e.g. potential, in_process, client). Evaluated against the current value.",
    ops: OPS_STR, valueType: "select",
    options: [
      { value: "potential",   labelSk: "Potenciálny",  labelEn: "Potential" },
      { value: "in_process",  labelSk: "V procese",    labelEn: "In process" },
      { value: "client",      labelSk: "Klient",       labelEn: "Client" },
      { value: "inactive",    labelSk: "Neaktívny",    labelEn: "Inactive" },
    ],
  },
  {
    key: "contact.contract_signed", category: "contact",
    labelSk: "Zmluva podpísaná", labelEn: "Contract signed",
    descSk: "Kontakt má aspoň jeden prípad v stave 'signed' (podpísaná zmluva).",
    descEn: "The contact has at least one case in 'signed' status (contract signed).",
    ops: OPS_BOOL, valueType: "bool",
  },
  {
    key: "contact.hospital_id", category: "contact",
    labelSk: "ID priradenej nemocnice", labelEn: "Assigned hospital ID",
    descSk: "Kontakt má priradený prípad s konkrétnou nemocnicou. Zadajte ID nemocnice.",
    descEn: "The contact has a case assigned to a specific hospital. Enter the hospital ID.",
    ops: OPS_STR, valueType: "text",
  },
  {
    key: "contact.clinic_id", category: "contact",
    labelSk: "ID priradenej kliniky", labelEn: "Assigned clinic ID",
    descSk: "Kontakt má priradený prípad s konkrétnou klinikou. Zadajte ID kliniky.",
    descEn: "The contact has a case assigned to a specific clinic. Enter the clinic ID.",
    ops: OPS_STR, valueType: "text",
  },
  {
    key: "contact.days_since_last_change", category: "contact",
    labelSk: "Dní od poslednej zmeny záznamu", labelEn: "Days since last record change",
    descSk: "Koľko dní uplynulo od poslednej zmeny záznamu kontaktu v activity_logs. Napr. > 30 = neaktívny kontakt.",
    descEn: "How many days since the last recorded change to the contact in activity_logs. E.g. > 30 = inactive contact.",
    ops: OPS_NUM, valueType: "number",
  },
];

const CONDITION_CATEGORIES = ["calls", "contact", "answer", "time", "campaign"] as const;

function getCondFieldDef(key: string): ConditionFieldDef | undefined {
  return CONDITION_FIELDS.find(f => f.key === key);
}

function getCondFieldLabel(key: string, locale: string): string {
  const f = getCondFieldDef(key);
  if (!f) return key;
  return locale === "sk" ? f.labelSk : f.labelEn;
}

function getConditionSummary(
  conditionJson: string | null | undefined,
  conditionField: string | null | undefined,
  conditionValue: string | null | undefined,
  locale: string
): string {
  if (conditionJson) {
    try {
      const parsed = JSON.parse(conditionJson);
      const rules: { field: string; op: string; value: string }[] = parsed.rules ?? [];
      const logic: string = parsed.logic ?? "AND";
      const parts = rules.map(r => {
        const lbl = getCondFieldLabel(r.field, locale);
        return `${lbl} ${r.op} ${r.value}`;
      });
      return parts.join(` ${logic} `);
    } catch { return "IF (compound)"; }
  }
  if (conditionField && conditionField !== "always") {
    return `IF ${conditionField} = ${conditionValue ?? "?"}`;
  }
  return "";
}

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

function AutomationBadge({ automation, groups }: { automation: StatusListAutomation; groups?: any[] }) {
  const { locale } = useI18n();
  const groupName = automation.taskGroupId
    ? (groups?.find((g: any) => g.id === automation.taskGroupId)?.name || `Skupina #${automation.taskGroupId.slice(0, 6)}`)
    : null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border/50">
      {getActionIcon(automation.actionType)}
      <span className="text-muted-foreground">{getActionLabel(automation.actionType, locale)}</span>
      {(automation.conditionJson || (automation.conditionField && automation.conditionField !== "always")) && (
        <span
          title={getConditionSummary(automation.conditionJson, automation.conditionField, automation.conditionValue, locale)}
          className="text-[9px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-mono truncate max-w-[110px]">
          IF…
        </span>
      )}
      {groupName && (
        <span className="font-medium text-blue-600 dark:text-blue-400">→ 👥 {groupName}</span>
      )}
      {!groupName && automation.targetRole && (
        <span className="font-medium">→ {getRoleLabel(automation.targetRole, locale)}</span>
      )}
    </span>
  );
}

function AutomationForm({
  automation, itemId, campaignId, questionId, onSaved, onCancel,
}: {
  automation?: StatusListAutomation;
  itemId: string;
  campaignId: string;
  questionId?: string;
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
    conditionType: automation?.conditionJson ? "compound" : automation?.conditionField === "country" ? "country" : "always",
    conditionCountry: automation?.conditionField === "country" ? (automation?.conditionValue || "SK") : "SK",
    conditionAnswer: automation?.conditionField === "answer" ? (automation?.conditionValue || "") : "",
    conditionLogic: (() => { try { return JSON.parse(automation?.conditionJson ?? "{}").logic ?? "AND"; } catch { return "AND"; } })() as "AND" | "OR",
    conditionRules: (() => { try { return JSON.parse(automation?.conditionJson ?? "{}").rules ?? []; } catch { return []; } })() as { field: string; op: string; value: string }[],
    dispositionId: automation?.dispositionId || "",
    webhookTarget: automation?.webhookTarget || "",
    taskGroupId: automation?.taskGroupId || "",
  });
  const [showActionHelp, setShowActionHelp] = useState(false);

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

  const { data: taskGroupsList = [] } = useQuery<any[]>({
    queryKey: ["/api/task-groups"],
    enabled: form.actionType === "assign_task",
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
        conditionField: form.conditionType === "compound" || form.conditionType === "always" ? null : form.conditionType,
        conditionOperator: form.conditionType === "always" || form.conditionType === "compound" ? null : "eq",
        conditionValue: form.conditionType === "always" || form.conditionType === "compound" ? null : (form.conditionType === "country" ? form.conditionCountry : null),
        conditionJson: form.conditionType === "compound" && form.conditionRules.length > 0 ? JSON.stringify({ logic: form.conditionLogic, rules: form.conditionRules }) : null,
        webhookTarget: form.webhookTarget || null,
        taskGroupId: form.taskGroupId || null,
      };
      if (isEdit) {
        return apiRequest("PUT", `/api/campaigns/${campaignId}/status-list/${itemId}/automations/${automation.id}`, payload);
      }
      if (questionId) {
        return apiRequest("POST", `/api/campaigns/${campaignId}/status-list/${itemId}/questions/${questionId}/automations`, payload);
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
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs">{sl("actionTypeLbl", locale)}</Label>
            <button type="button" onClick={() => setShowActionHelp(h => !h)}
              className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded transition-colors ${showActionHelp ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400" : "text-muted-foreground hover:text-amber-600"}`}>
              <Info className="h-3 w-3" />{showActionHelp ? "×" : "?"}
            </button>
          </div>
          <Select value={form.actionType} onValueChange={v => { setForm(f => ({ ...f, actionType: v })); setShowActionHelp(true); }}>
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
            <Label className="text-xs mb-1 block">{sl(form.actionType === "assign_task" ? "tgSelectLbl" : "targetRoleLbl", locale)}</Label>
            {form.actionType === "assign_task" ? (
              <Select
                value={form.taskGroupId ? `group:${form.taskGroupId}` : form.targetRole}
                onValueChange={v => {
                  if (v.startsWith("group:")) {
                    setForm(f => ({ ...f, taskGroupId: v.replace("group:", ""), targetRole: "" }));
                  } else {
                    setForm(f => ({ ...f, taskGroupId: "", targetRole: v }));
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {taskGroupsList.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{sl("tgGroupsHeader", locale)}</div>
                      {taskGroupsList.map((g: any) => (
                        <SelectItem key={g.id} value={`group:${g.id}`} className="text-xs">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: g.color || '#3b82f6' }} />
                            {g.name}
                            {g.members?.length > 0 && <span className="text-muted-foreground text-[10px]">({g.members.length})</span>}
                          </div>
                        </SelectItem>
                      ))}
                      <div className="px-2 py-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider border-t mt-0.5">{sl("tgRolesHeader", locale)}</div>
                    </>
                  )}
                  {taskGroupsList.length === 0 && (
                    <div className="px-2 py-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{sl("tgRolesHeader", locale)}</div>
                  )}
                  {ROLE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">{sl(opt.slKey, locale)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={form.targetRole} onValueChange={v => setForm(f => ({ ...f, targetRole: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{sl(opt.slKey, locale)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {needsTask && (
          <>
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">{sl("taskDescLbl", locale)}</Label>
              <Textarea
                id="automation-task-desc"
                className="text-xs min-h-[60px] resize-none"
                value={form.taskDescription}
                onChange={e => setForm(f => ({ ...f, taskDescription: e.target.value }))}
                placeholder={sl("taskDescPh", locale)}
              />
              <div className="flex flex-wrap gap-1 mt-1">
                {[
                  { token: "{{customer.name}}", label: "Meno zákazníka" },
                  { token: "{{customer.phone}}", label: "Telefón" },
                  { token: "{{customer.id}}", label: "ID zákazníka" },
                  { token: "{{campaign.name}}", label: "Kampaň" },
                  { token: "{{agent.name}}", label: "Agent" },
                  { token: "{{hospital.name}}", label: "Nemocnica" },
                  { token: "{{clinic.name}}", label: "Klinika" },
                ].map(({ token, label }) => (
                  <button
                    key={token}
                    type="button"
                    className="inline-flex items-center gap-0.5 rounded border border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/40 px-1.5 py-0.5 text-[10px] text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 font-mono cursor-pointer"
                    onClick={() => setForm(f => ({ ...f, taskDescription: f.taskDescription + token }))}
                    title={token}
                  >
                    {label}
                  </button>
                ))}
              </div>
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

        {/* Action help panel */}
        {showActionHelp && (() => {
          const helpKey = `atHelp_${form.actionType}`;
          const helpText = sl(helpKey, locale);
          const actionOpt = ACTION_TYPE_OPTIONS.find(o => o.value === form.actionType);
          const HelpIcon = actionOpt?.icon ?? Info;
          return (
            <div className="col-span-2 rounded-md border border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/20 p-2.5 space-y-1">
              <div className="flex items-center gap-1.5">
                <HelpIcon className={`h-3.5 w-3.5 shrink-0 ${actionOpt?.color ?? "text-amber-600"}`} />
                <span className={`text-xs font-semibold ${actionOpt?.color ?? "text-amber-600"}`}>{sl(actionOpt?.slKey ?? "actionTypeLbl", locale)}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{helpText}</p>
            </div>
          );
        })()}

        {/* Webhook target URL for sys_webhook */}
        {form.actionType === "sys_webhook" && (
          <div className="col-span-2">
            <Label className="text-xs mb-1 block">{sl("ifWebhookUrl", locale)}</Label>
            <Input
              className="h-8 text-xs font-mono"
              value={form.webhookTarget}
              onChange={e => setForm(f => ({ ...f, webhookTarget: e.target.value }))}
              placeholder={sl("ifWebhookPh", locale)}
            />
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

        {/* Mode selector */}
        <Select value={form.conditionType} onValueChange={v => setForm(f => ({
          ...f, conditionType: v,
          conditionRules: v === "compound" && f.conditionRules.length === 0
            ? [{ field: "call_count", op: "gt", value: "0" }]
            : f.conditionRules
        }))}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="always">{sl("condAlways", locale)}</SelectItem>
            <SelectItem value="country">{sl("condCountry", locale)}</SelectItem>
            <SelectItem value="compound">{sl("ifCompound", locale)}</SelectItem>
          </SelectContent>
        </Select>

        {/* Legacy: country */}
        {form.conditionType === "country" && (
          <Select value={form.conditionCountry} onValueChange={v => setForm(f => ({ ...f, conditionCountry: v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COUNTRY_OPTIONS.map(co => (
                <SelectItem key={co.value} value={co.value}>{sl(co.slKey, locale)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Compound condition builder */}
        {form.conditionType === "compound" && (
          <div className="space-y-2 rounded-md border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-950/10 p-2">
            {/* AND/OR logic toggle */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-medium">{locale === "sk" ? "Logika:" : "Logic:"}</span>
              <button type="button"
                className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${form.conditionLogic === "AND" ? "bg-purple-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
                onClick={() => setForm(f => ({ ...f, conditionLogic: "AND" }))}>
                AND
              </button>
              <button type="button"
                className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${form.conditionLogic === "OR" ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
                onClick={() => setForm(f => ({ ...f, conditionLogic: "OR" }))}>
                OR
              </button>
              <span className="ml-auto text-[10px] text-muted-foreground italic">
                {form.conditionLogic === "AND" ? sl("ifLogicAnd", locale) : sl("ifLogicOr", locale)}
              </span>
            </div>

            {/* Rules list */}
            {form.conditionRules.map((rule, idx) => {
              const fieldDef = getCondFieldDef(rule.field);
              const byCategory: Record<string, ConditionFieldDef[]> = {};
              CONDITION_FIELDS.forEach(fd => {
                if (!byCategory[fd.category]) byCategory[fd.category] = [];
                byCategory[fd.category].push(fd);
              });
              return (
                <React.Fragment key={idx}>
                <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-1 items-center">
                  {/* Field selector */}
                  <Select value={rule.field} onValueChange={v => {
                    const def = getCondFieldDef(v);
                    setForm(f => ({ ...f, conditionRules: f.conditionRules.map((r, i) => i === idx ? { field: v, op: def?.ops[0]?.value ?? "eq", value: "" } : r) }));
                  }}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONDITION_CATEGORIES.map(cat => (
                        <React.Fragment key={cat}>
                          <div className="px-2 py-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider border-t mt-0.5">{sl(cat, locale)}</div>
                          {(byCategory[cat] ?? []).map(fd => (
                            <SelectItem key={fd.key} value={fd.key} className="text-xs">
                              {locale === "sk" || locale === "cs" ? fd.labelSk : fd.labelEn}
                            </SelectItem>
                          ))}
                        </React.Fragment>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Operator */}
                  <Select value={rule.op} onValueChange={v => setForm(f => ({ ...f, conditionRules: f.conditionRules.map((r, i) => i === idx ? { ...r, op: v } : r) }))}>
                    <SelectTrigger className="h-7 text-xs w-14"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(fieldDef?.ops ?? OPS_STR).map(op => (
                        <SelectItem key={op.value} value={op.value} className="text-xs">{locale === "sk" || locale === "cs" ? op.labelSk : op.labelEn}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Value input */}
                  {fieldDef?.valueType === "select" ? (
                    <Select value={rule.value} onValueChange={v => setForm(f => ({ ...f, conditionRules: f.conditionRules.map((r, i) => i === idx ? { ...r, value: v } : r) }))}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(fieldDef.options ?? []).map(o => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">{locale === "sk" || locale === "cs" ? o.labelSk : o.labelEn}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : fieldDef?.valueType === "bool" ? (
                    <Select value={rule.value || "true"} onValueChange={v => setForm(f => ({ ...f, conditionRules: f.conditionRules.map((r, i) => i === idx ? { ...r, value: v } : r) }))}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true" className="text-xs">Áno</SelectItem>
                        <SelectItem value="false" className="text-xs">Nie</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : fieldDef?.valueType === "disp_count" ? (
                    <div className="flex gap-1">
                      <Input className="h-7 text-xs" placeholder="status..." value={rule.value.split("|")[0] ?? ""} onChange={e => {
                        const parts = rule.value.split("|");
                        parts[0] = e.target.value;
                        setForm(f => ({ ...f, conditionRules: f.conditionRules.map((r, i) => i === idx ? { ...r, value: parts.join("|") } : r) }));
                      }} />
                      <Input className="h-7 text-xs w-10" type="number" min="1" placeholder="N" value={rule.value.split("|")[1] ?? ""} onChange={e => {
                        const parts = rule.value.split("|");
                        parts[1] = e.target.value;
                        setForm(f => ({ ...f, conditionRules: f.conditionRules.map((r, i) => i === idx ? { ...r, value: parts.join("|") } : r) }));
                      }} />
                    </div>
                  ) : (
                    <Input
                      className="h-7 text-xs"
                      type={fieldDef?.valueType === "number" ? "number" : "text"}
                      value={rule.value}
                      onChange={e => setForm(f => ({ ...f, conditionRules: f.conditionRules.map((r, i) => i === idx ? { ...r, value: e.target.value } : r) }))}
                      placeholder={sl("ifValPh", locale)}
                    />
                  )}

                  {/* Remove rule */}
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, conditionRules: f.conditionRules.filter((_, i) => i !== idx) }))}
                    className="h-7 w-7 flex items-center justify-center rounded hover:bg-red-50 dark:hover:bg-red-950/20 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                {fieldDef && (
                  <div className="flex items-start gap-1.5 mt-0.5 mb-1 px-1">
                    <Info className="h-3 w-3 shrink-0 mt-0.5 text-amber-500/70" />
                    <span className="text-[10px] text-muted-foreground leading-snug">
                      {locale === "sk" || locale === "cs" ? fieldDef.descSk : fieldDef.descEn}
                    </span>
                  </div>
                )}
                </React.Fragment>
              );
            })}

            {/* Add rule button */}
            <button type="button"
              onClick={() => setForm(f => ({ ...f, conditionRules: [...f.conditionRules, { field: "call_count", op: "gt", value: "0" }] }))}
              className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors pt-0.5">
              <Plus className="h-3 w-3" />
              {sl("ifAddRule", locale)}
            </button>
          </div>
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


function QuestionEditor({
  question, itemId, campaignId, existingQuestions, allItems, onSaved, onCancel,
}: {
  question?: StatusListQuestion;
  itemId: string;
  campaignId: string;
  existingQuestions: StatusListQuestion[];
  allItems?: StatusListItem[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const { locale } = useI18n();
  const isEdit = !!question?.id;

  const [form, setForm] = useState({
    groupName: question?.groupName ?? "",
    questionText: question?.questionText ?? "",
    logicOperator: question?.logicOperator ?? "OR",
    gotoQuestionId: question?.gotoQuestionId ?? "",
    required: question?.required ?? false,
    icon: question?.icon ?? "",
    color: question?.color ?? "",
    description: question?.description ?? "",
    isHidden: question?.isHidden ?? false,
    fieldType: question?.fieldType ?? "checkbox",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        groupName: form.groupName.trim() || null,
        questionText: form.questionText.trim(),
        logicOperator: form.logicOperator,
        gotoQuestionId: form.gotoQuestionId || null,
        required: form.required,
        icon: form.icon || null,
        color: form.color || null,
        description: form.description.trim() || null,
        isHidden: form.isHidden,
        fieldType: form.fieldType || "checkbox",
        sortOrder: question?.sortOrder ?? existingQuestions.length,
      };
      if (isEdit) {
        return apiRequest("PUT", `/api/campaigns/${campaignId}/status-list/${itemId}/questions/${question!.id}`, payload);
      }
      return apiRequest("POST", `/api/campaigns/${campaignId}/status-list/${itemId}/questions`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      toast({ title: isEdit ? sl("qSaved", locale) : sl("qAdded", locale) });
      onSaved();
    },
    onError: () => toast({ title: sl("saveErr", locale), variant: "destructive" }),
  });

  const groupNames = [...new Set(existingQuestions.map(q => q.groupName).filter(Boolean))] as string[];
  // Build cross-item question list with step labels for goto selector
  const allQuestions = allItems
    ? allItems.flatMap(it => (it.questions ?? []).map(q => ({ ...q, _stepId: it.stepId, _stepLabel: it.label })))
    : existingQuestions.map(q => ({ ...q, _stepId: "", _stepLabel: "" }));
  const otherQuestions = allQuestions.filter(q => q.id !== question?.id);

  return (
    <div className="border rounded-lg p-3 space-y-2.5 bg-blue-50/30 dark:bg-blue-950/10 border-blue-200/50 dark:border-blue-800/30">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs mb-1 block">{sl("qGroupNameLbl", locale)}</Label>
          <Input
            className="h-8 text-xs"
            value={form.groupName}
            onChange={e => setForm(f => ({ ...f, groupName: e.target.value }))}
            placeholder={sl("qGroupNamePh", locale)}
            list={`grp-${itemId}`}
          />
          <datalist id={`grp-${itemId}`}>
            {groupNames.map(g => <option key={g} value={g} />)}
          </datalist>
        </div>
        <div>
          <Label className="text-xs mb-1 block">{sl("qLogicLbl", locale)}</Label>
          <div className="flex gap-1 h-8">
            {(["OR", "AND"] as const).map(op => (
              <button
                key={op}
                type="button"
                onClick={() => setForm(f => ({ ...f, logicOperator: op }))}
                className={`flex-1 text-xs font-bold rounded border transition-colors ${
                  form.logicOperator === op
                    ? op === "OR"
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-purple-500 text-white border-purple-500"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {op}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <Label className="text-xs mb-1 block">{sl("questionTextLbl", locale)} *</Label>
        <Input
          className="h-8 text-xs"
          value={form.questionText}
          onChange={e => setForm(f => ({ ...f, questionText: e.target.value }))}
          placeholder={sl("questionTextPh", locale)}
        />
      </div>

      <div>
        <Label className="text-xs mb-1 block">{sl("qDescLbl", locale)}</Label>
        <Textarea
          className="h-14 text-xs resize-none"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder={sl("qDescPh", locale)}
        />
      </div>

      {/* Icon + Color row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1.5 block">{sl("qIconLbl", locale)}</Label>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, icon: "" }))}
              className={`h-6 w-6 rounded flex items-center justify-center border transition-all ${
                !form.icon ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border hover:bg-muted"
              }`}
              title={sl("qNoIcon", locale)}
            >
              <span className="text-[9px] text-muted-foreground font-bold">—</span>
            </button>
            {QUESTION_ICONS.map(({ name, icon: Icon }) => (
              <button
                key={name}
                type="button"
                onClick={() => setForm(f => ({ ...f, icon: name }))}
                className={`h-6 w-6 rounded flex items-center justify-center border transition-all ${
                  form.icon === name
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border hover:bg-muted"
                }`}
                title={name}
              >
                <Icon className={`h-3.5 w-3.5 ${getQIconColorClass(form.color)}`} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs mb-1.5 block">{sl("qColorLbl", locale)}</Label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, color: "" }))}
              className={`h-5 w-5 rounded-full border-2 transition-all ${
                !form.color ? "border-foreground scale-110" : "border-transparent hover:border-muted-foreground/40"
              } bg-muted`}
              title={sl("qNoIcon", locale)}
            />
            {QUESTION_COLORS.map(col => (
              <button
                key={col.name}
                type="button"
                onClick={() => setForm(f => ({ ...f, color: col.name }))}
                className={`h-5 w-5 rounded-full border-2 transition-all ${col.dot} ${
                  form.color === col.name ? "border-foreground scale-110" : "border-transparent hover:border-muted-foreground/40"
                }`}
                title={col.name}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Field type + hidden */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs mb-1 block">{sl("qFieldTypeLbl", locale)}</Label>
          <Select value={form.fieldType || "checkbox"} onValueChange={v => setForm(f => ({ ...f, fieldType: v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map(ft => {
                const FtIcon = ft.icon;
                return (
                  <SelectItem key={ft.value} value={ft.value}>
                    <span className="flex items-center gap-1.5 text-xs">
                      <FtIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      {sl(ft.labelKey, locale)}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pt-4">
          <Switch checked={!!form.isHidden} onCheckedChange={v => setForm(f => ({ ...f, isHidden: v }))} />
          <Label className="text-xs text-muted-foreground">{sl("qHiddenLbl", locale)}</Label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 items-end">
        <div>
          <Label className="text-xs mb-1 block">{sl("qGotoLbl", locale)}</Label>
          <Select
            value={form.gotoQuestionId || "__none__"}
            onValueChange={v => setForm(f => ({ ...f, gotoQuestionId: v === "__none__" ? "" : v }))}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={sl("qGotoNone", locale)} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{sl("qGotoNone", locale)}</SelectItem>

              {/* ── Status-list steps ── */}
              {(allItems ?? []).length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-t mt-1">
                    {sl("qGotoStepsGrp", locale)}
                  </div>
                  {(allItems ?? []).map(it => (
                    <SelectItem key={`step-${it.id}`} value={`step:${it.stepId}`}>
                      <span className="flex items-center gap-1.5 text-xs">
                        <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 shrink-0">
                          {it.stepId}
                        </span>
                        <span className="truncate">{it.label.length > 32 ? it.label.slice(0, 32) + "…" : it.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </>
              )}

              {/* ── Questions from all items ── */}
              {otherQuestions.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-t mt-1">
                    {sl("qGotoQsGrp", locale)}
                  </div>
                  {otherQuestions.map(q => (
                    <SelectItem key={q.id} value={q.id}>
                      <span className="flex items-center gap-1.5 text-xs">
                        {(q as any)._stepId && (
                          <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                            {(q as any)._stepId}
                          </span>
                        )}
                        {q.groupName && (
                          <span className="text-muted-foreground shrink-0">{q.groupName} /</span>
                        )}
                        <span className="truncate">{q.questionText.length > 32 ? q.questionText.slice(0, 32) + "…" : q.questionText}</span>
                      </span>
                    </SelectItem>
                  ))}
                </>
              )}

              {/* Empty state when no other questions yet */}
              {otherQuestions.length === 0 && (allItems ?? []).length === 0 && (
                <div className="px-2 py-2 text-xs text-muted-foreground italic">
                  {sl("qGotoNoOptions", locale)}
                </div>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-0.5">
          <Switch checked={form.required} onCheckedChange={v => setForm(f => ({ ...f, required: v }))} />
          <Label className="text-xs">{sl("qRequired", locale)}</Label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-7 text-xs">
          <X className="h-3 w-3 mr-1" /> {sl("cancelBtn", locale)}
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !form.questionText.trim()}
        >
          {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
          {isEdit ? sl("qSaved", locale) : sl("qAdded", locale)}
        </Button>
      </div>
    </div>
  );
}

function StatusListItemRow({
  item, campaignId, allItems, onDeleted,
}: {
  item: StatusListItem;
  campaignId: string;
  allItems: StatusListItem[];
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const { locale } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [addingAutomation, setAddingAutomation] = useState(false);
  const [editingAutoId, setEditingAutoId] = useState<string | null>(null);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [addingQActionFor, setAddingQActionFor] = useState<string | null>(null);
  const [editingQAutoId, setEditingQAutoId] = useState<string | null>(null);
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

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: string) => apiRequest("DELETE", `/api/campaigns/${campaignId}/status-list/${item.id}/questions/${questionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      toast({ title: sl("qDeleted", locale) });
    },
    onError: () => toast({ title: sl("deleteErr", locale), variant: "destructive" }),
  });

  const copyQuestionMutation = useMutation({
    mutationFn: (questionId: string) => apiRequest("POST", `/api/campaigns/${campaignId}/status-list/${item.id}/questions/${questionId}/copy`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      toast({ title: sl("qCopied", locale) });
    },
    onError: () => toast({ title: sl("saveErr", locale), variant: "destructive" }),
  });

  const deleteQAutoMutation = useMutation({
    mutationFn: (autoId: string) => apiRequest("DELETE", `/api/campaigns/${campaignId}/status-list/${item.id}/automations/${autoId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      toast({ title: sl("autoDeleted", locale) });
    },
    onError: () => toast({ title: sl("deleteErr", locale), variant: "destructive" }),
  });

  const ConfirmIcon = CONFIRM_TYPE_OPTIONS.find(o => o.value === item.confirmationType)?.icon || SquareCheck;

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
          {(item.questions?.length ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <CircleHelp className="h-3 w-3 text-blue-500" />
              {item.questions.length}
            </span>
          )}
          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={() => { setEditMode(e => !e); setExpanded(true); }}>
            <PenLine className="h-3 w-3" />
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
                  <AutomationBadge key={auto.id} automation={auto} groups={taskGroupsList} />
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
                        {(auto as any).taskGroupId ? (
                          <span className="text-muted-foreground font-medium text-blue-600 dark:text-blue-400">→ 👥 {taskGroupsList.find((g: any) => g.id === (auto as any).taskGroupId)?.name || "Skupina"}</span>
                        ) : auto.targetRole ? (
                          <span className="text-muted-foreground">→ {getRoleLabel(auto.targetRole, locale)}</span>
                        ) : null}
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
                        <PenLine className="h-3 w-3" />
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

          {/* ── Questions section ────────────────────────── */}
          <div className="space-y-2 pt-1 border-t">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <CircleHelp className="h-3 w-3 text-blue-500" />
                {sl("questionsTitle", locale)}
                {(item.questions?.length ?? 0) > 0 && (
                  <span className="ml-1 text-[10px] font-normal normal-case text-blue-600 dark:text-blue-400">
                    ({item.questions.length} {sl("qCountLabel", locale)})
                  </span>
                )}
              </span>
              <Button
                type="button" variant="outline" size="sm"
                className="h-6 text-xs gap-1 px-2 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                onClick={() => { setAddingQuestion(true); setEditingQuestionId(null); }}
              >
                <Plus className="h-3 w-3" /> {sl("addQuestionBtn", locale)}
              </Button>
            </div>

            {/* Grouped questions display */}
            {(() => {
              const qs = item.questions ?? [];
              if (qs.length === 0 && !addingQuestion) return null;
              const grouped: Record<string, StatusListQuestion[]> = {};
              qs.forEach(q => {
                const k = q.groupName || "__";
                if (!grouped[k]) grouped[k] = [];
                grouped[k].push(q);
              });
              return (
                <div className="space-y-1.5">
                  {Object.entries(grouped).map(([gk, gqs]) => (
                    <div key={gk} className="border border-blue-100 dark:border-blue-900/40 rounded-md overflow-hidden">
                      {gk !== "__" && (
                        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-blue-50/50 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/40">
                          <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{gk}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            gqs[0].logicOperator === "AND"
                              ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                              : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                          }`}>{gqs[0].logicOperator}</span>
                        </div>
                      )}
                      {gqs.map(q => (
                        <div key={q.id} className="border-b border-blue-100/50 dark:border-blue-900/20 last:border-b-0">
                          {/* Question edit form */}
                          {editingQuestionId === q.id ? (
                            <div className="p-2">
                              <QuestionEditor
                                question={q}
                                itemId={item.id}
                                campaignId={campaignId}
                                existingQuestions={item.questions ?? []}
                                allItems={allItems}
                                onSaved={() => setEditingQuestionId(null)}
                                onCancel={() => setEditingQuestionId(null)}
                              />
                            </div>
                          ) : (
                            <>
                              {/* Question row */}
                              <div className="flex items-center gap-2 px-2.5 py-1.5 group/q hover:bg-muted/30">
                                <QuestionIcon iconName={q.icon} color={q.color} />
                                <span className="flex-1 text-xs text-foreground min-w-0">
                                  <span className="block">{q.questionText}</span>
                                  {q.description && (
                                    <span className="block text-[10px] text-muted-foreground leading-snug mt-0.5 truncate">{q.description}</span>
                                  )}
                                </span>
                                {q.required && (
                                  <span className="text-[9px] px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold shrink-0">!</span>
                                )}
                                {q.gotoQuestionId && (
                                  <span title="Má goto cieľ" className="text-[10px] text-muted-foreground/60 shrink-0">
                                    <ArrowDownRight className="h-3 w-3" />
                                  </span>
                                )}
                                {/* Field type badge */}
                                {q.fieldType && q.fieldType !== "checkbox" && (() => {
                                  const FTIcon = getQFieldTypeIcon(q.fieldType);
                                  return <FTIcon className="h-3 w-3 text-muted-foreground/50 shrink-0" />;
                                })()}
                                {/* Hidden badge */}
                                {q.isHidden && (
                                  <EyeOff className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                )}
                                {/* Automation count badge */}
                                {(q.automations?.length ?? 0) > 0 && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400 shrink-0">
                                    <Zap className="h-2.5 w-2.5" />
                                    {q.automations.length}
                                  </span>
                                )}
                                {/* Hover actions */}
                                <div className="flex items-center gap-0.5 opacity-0 group-hover/q:opacity-100 transition-opacity shrink-0">
                                  <Button
                                    type="button" variant="ghost" size="sm"
                                    className="h-5 w-5 p-0 text-amber-600 dark:text-amber-400"
                                    title={sl("addQActionBtn", locale)}
                                    onClick={() => { setAddingQActionFor(q.id); setEditingQAutoId(null); setEditingQuestionId(null); }}
                                  >
                                    <Zap className="h-2.5 w-2.5" />
                                  </Button>
                                  <Button
                                    type="button" variant="ghost" size="sm" className="h-5 w-5 p-0 text-blue-600 dark:text-blue-400"
                                    title={sl("qCopied", locale)}
                                    onClick={() => copyQuestionMutation.mutate(q.id)}
                                  >
                                    {copyQuestionMutation.isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Copy className="h-2.5 w-2.5" />}
                                  </Button>
                                  <Button
                                    type="button" variant="ghost" size="sm" className="h-5 w-5 p-0"
                                    onClick={() => { setEditingQuestionId(q.id); setAddingQuestion(false); setAddingQActionFor(null); }}
                                  >
                                    <PenLine className="h-2.5 w-2.5" />
                                  </Button>
                                  <Button
                                    type="button" variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                                    onClick={() => deleteQuestionMutation.mutate(q.id)}
                                  >
                                    {deleteQuestionMutation.isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Trash2 className="h-2.5 w-2.5" />}
                                  </Button>
                                </div>
                              </div>

                              {/* Existing question automations */}
                              {(q.automations?.length ?? 0) > 0 && (
                                <div className="px-3 pb-1.5 space-y-1">
                                  {q.automations.map(auto => (
                                    <div key={auto.id}>
                                      {editingQAutoId === auto.id ? (
                                        <AutomationForm
                                          automation={auto}
                                          itemId={item.id}
                                          campaignId={campaignId}
                                          questionId={q.id}
                                          onSaved={() => setEditingQAutoId(null)}
                                          onCancel={() => setEditingQAutoId(null)}
                                        />
                                      ) : (
                                        <div className="flex items-center gap-2 p-1.5 rounded border bg-amber-50/40 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-800/30 group/qa text-xs">
                                          <span className="flex items-center gap-1 shrink-0">
                                            {getActionIcon(auto.actionType)}
                                          </span>
                                          <span className="flex-1 text-muted-foreground">{getActionLabel(auto.actionType, locale)}</span>
                                          {(auto as any).taskGroupId ? (
                                            <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">→ 👥 {taskGroupsList.find((g: any) => g.id === (auto as any).taskGroupId)?.name || "Skupina"}</span>
                                          ) : auto.targetRole ? (
                                            <span className="text-[10px] text-foreground">→ {getRoleLabel(auto.targetRole, locale)}</span>
                                          ) : null}
                                          <div className="flex items-center gap-0.5 opacity-0 group-hover/qa:opacity-100 transition-opacity shrink-0">
                                            <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0"
                                              onClick={() => { setEditingQAutoId(auto.id); setAddingQActionFor(null); }}>
                                              <PenLine className="h-2.5 w-2.5" />
                                            </Button>
                                            <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                                              onClick={() => deleteQAutoMutation.mutate(auto.id)}>
                                              {deleteQAutoMutation.isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Trash2 className="h-2.5 w-2.5" />}
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Add question action form */}
                              {addingQActionFor === q.id && (
                                <div className="px-3 pb-2">
                                  <AutomationForm
                                    itemId={item.id}
                                    campaignId={campaignId}
                                    questionId={q.id}
                                    onSaved={() => setAddingQActionFor(null)}
                                    onCancel={() => setAddingQActionFor(null)}
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })()}

            {addingQuestion && (
              <QuestionEditor
                itemId={item.id}
                campaignId={campaignId}
                existingQuestions={item.questions ?? []}
                allItems={allItems}
                onSaved={() => setAddingQuestion(false)}
                onCancel={() => setAddingQuestion(false)}
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
  const [previewMode, setPreviewMode] = useState(false);

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
        const stepDesc = getStepDescription(step, locale);
        const condPart = step.conditionIf && step.conditionIf !== "—" ? `IF: ${step.conditionIf}` : "";
        const thenPart = step.actionThen ? `THEN: ${step.actionThen}` : "";
        const timePart = step.callbackTiming && step.callbackTiming !== "—" ? `⏱ ${step.callbackTiming}` : "";
        const res = await apiRequest("POST", `/api/campaigns/${campaignId}/status-list`, {
          stepId: step.stepId,
          label: getStepLabel(step, locale),
          description: [stepDesc, condPart, thenPart, timePart].filter(Boolean).join("\n"),
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
            taskDescription: getAutoTaskDescription(auto, locale),
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
          <LayoutTemplate className="h-3.5 w-3.5 text-primary" />
          CLA / CLB Template
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setImportOpen(true)} data-testid="btn-open-import-dispositions">
          <Download className="h-3.5 w-3.5 text-emerald-500" />
          {sl("importTitle", locale)}
        </Button>
        <Button
          type="button"
          variant={previewMode ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setPreviewMode(m => !m)}
          data-testid="btn-toggle-preview"
        >
          {previewMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {previewMode ? sl("previewClose", locale) : sl("previewBtn", locale)}
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

      {previewMode ? (
        <StatusListPreview items={items} locale={locale} />
      ) : (
        <div className="space-y-1.5">
          {items.map(item => (
            <StatusListItemRow
              key={item.id}
              item={item}
              campaignId={campaignId}
              allItems={items}
              onDeleted={() => {}}
            />
          ))}
        </div>
      )}

      {/* ── Template Dialog ─────────────────────────────────── */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4 text-primary" />
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
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{localizeText(getStepDescription(step, locale), locale)}</p>
                      {step.conditionIf && step.conditionIf !== "—" && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          <span className="font-semibold">IF:</span> {localizeText(step.conditionIf, locale)}
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
                          <span className="line-clamp-2">{localizeText(step.restrictions, locale)}</span>
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
                              <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{localizeText(getAutoTaskDescription(auto, locale) || auto.description, locale)}</p>
                              {(auto.taskDescription || auto.taskDescriptionL10n) && (
                                <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
                                  📋 {localizeText(getAutoTaskDescription(auto, locale), locale)}
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
                  : <LayoutTemplate className="h-3.5 w-3.5" />
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
