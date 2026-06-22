import React, { useState, useRef } from "react";
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
import { CLA_TEMPLATE, CLB_TEMPLATE, MPN_TEMPLATE, ROLE_BADGE_MAP, getStepLabel, getAutoLabel, getStepDescription, getAutoTaskDescription } from "@/data/cla-template";
import { useI18n } from "@/i18n";
import {
  Plus, Trash2, ChevronDown, ChevronRight, GripVertical, Zap,
  ClipboardList, Mail, MailPlus, MessageSquare, Tag, Webhook, Bell,
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
  emailRecipients?: string[] | null;
  callbackOffsetDays?: number | null;
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
  isHidden?: boolean;
  itemType?: string;
  color?: string | null;
  autoConfirmOnSubQuestion?: boolean;
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
  at_send_email_group:   { sk: "Skupinový email (rola)", en: "Group email (role)", cs: "Skupinový e-mail (role)", hu: "Csoportos e-mail (szerepkör)", ro: "Email de grup (rol)", it: "Email di gruppo (ruolo)", de: "Gruppen-E-Mail (Rolle)" },
  at_notify_email:       { sk: "Email – externá notifikácia", en: "Email – external notification", cs: "E-mail – externí notifikace", hu: "E-mail – külső értesítés", ro: "Email – notificare externă", it: "Email – notifica esterna", de: "E-Mail – externe Benachrichtigung" },
  at_send_sms:           { sk: "SMS zákazníkovi", en: "SMS to contact", cs: "SMS zákazníkovi", hu: "SMS ügyfélnek", ro: "SMS clientului", it: "SMS al contatto", de: "SMS an Kontakt" },
  at_set_contact_status: { sk: "Nastaviť status", en: "Set contact status", cs: "Nastavit stav", hu: "Kontakt státusz beállítása", ro: "Setare status contact", it: "Imposta stato contatto", de: "Kontaktstatus setzen" },
  at_set_callback:       { sk: "Naplánovať callback", en: "Schedule callback", cs: "Naplánovat callback", hu: "Visszahívás ütemezése", ro: "Programare callback", it: "Pianifica richiamo", de: "Rückruf planen" },
  at_notify_role:        { sk: "Notifikovať rolu", en: "Notify role", cs: "Upozornit roli", hu: "Szerepkör értesítése", ro: "Notifică rolul", it: "Notifica ruolo", de: "Rolle benachrichtigen" },
  at_sys_webhook:        { sk: "Systémový webhook", en: "System webhook", cs: "Systémový webhook", hu: "Rendszer webhook", ro: "Webhook sistem", it: "Webhook di sistema", de: "System-Webhook" },

  atHelp_assign_task:        { sk: "Systém vytvorí úlohu v module Tasks a pridelí ju zvolenej role (napr. Back Office). Úloha bude viditeľná v zozname úloh a agent dostane notifikáciu. Nastavte popis, prioritu a termín.", en: "System creates a task in the Tasks module and assigns it to the chosen role (e.g. Back Office). The task appears in the task list and the agent gets a notification. Set description, priority and deadline.", cs: "Systém vytvoří úkol v modulu Úkoly a přidělí ho zvolené roli. Agent dostane notifikaci.", hu: "A rendszer feladatot hoz létre a Feladatok modulban a kiválasztott szerepkör számára.", ro: "Sistemul creează o sarcină în modulul Sarcini și o atribuie rolului ales.", it: "Il sistema crea un compito nel modulo Attività e lo assegna al ruolo scelto.", de: "Das System erstellt eine Aufgabe im Aufgaben-Modul und weist sie der gewählten Rolle zu." },
  atHelp_send_email_group:   { sk: "Odošle e-mail všetkým používateľom zvolenej roly + voliteľným pevným adresám. Šablóna môže obsahovať premenné kontaktu. Vhodné pre uvítacie, follow-up alebo interné notifikačné e-maily.", en: "Sends an email to all users of the selected role + optional fixed addresses. Template can contain contact variables. Good for welcome, follow-up or internal notification emails.", cs: "Odešle e-mail všem uživatelům zvolené role + volitelným pevným adresám.", hu: "E-mailt küld a kiválasztott szerepkör összes felhasználójának + opcionális fix címekre.", ro: "Trimite un email tuturor utilizatorilor rolului ales + adreselor fixe opționale.", it: "Invia un'email a tutti gli utenti del ruolo selezionato + indirizzi fissi opzionali.", de: "Sendet eine E-Mail an alle Benutzer der gewählten Rolle + optionalen festen Adressen." },
  atHelp_notify_email:       { sk: "Odošle e-mail na zadané externé e-mailové adresy. Adresy nemusia byť registrované v INDEXUS. Vhodné pre notifikácie partnerov, externých pracovníkov alebo iných príjemcov. Šablóna môže obsahovať premenné kontaktu.", en: "Sends an email to the specified external email addresses. Addresses do not need to be registered in INDEXUS. Good for notifying partners, external staff or other recipients. Template can contain contact variables.", cs: "Odešle e-mail na zadané externí e-mailové adresy. Adresy nemusí být registrovány v INDEXUS.", hu: "E-mailt küld a megadott külső e-mail címekre. A címeknek nem kell INDEXUS-ban regisztráltnak lenniük.", ro: "Trimite un email la adresele de email externe specificate. Adresele nu trebuie să fie înregistrate în INDEXUS.", it: "Invia un'email agli indirizzi e-mail esterni specificati. Gli indirizzi non devono essere registrati in INDEXUS.", de: "Sendet eine E-Mail an die angegebenen externen E-Mail-Adressen. Adressen müssen nicht in INDEXUS registriert sein." },
  atHelp_send_sms:           { sk: "Odošle SMS správu priamo zákazníkovi. Vyžaduje platné telefónne číslo kontaktu. Správa je odoslaná cez SMS gateway a zalogovaná v komunikačnej histórii.", en: "Sends an SMS message directly to the contact. Requires a valid phone number on the contact. Message is sent via SMS gateway and logged in communication history.", cs: "Odešle SMS zprávu zákazníkovi. Vyžaduje platné telefonní číslo.", hu: "SMS üzenetet küld közvetlenül az ügyfélnek. Érvényes telefonszám szükséges.", ro: "Trimite un SMS direct clientului. Necesită număr de telefon valid.", it: "Invia un SMS direttamente al contatto. Richiede un numero di telefono valido.", de: "Sendet eine SMS-Nachricht direkt an den Kontakt. Erfordert eine gültige Telefonnummer." },
  atHelp_set_contact_status: { sk: "Automaticky zmení dispozíciu (status) kontaktu v kampani. Vhodné napr. pre automatickú zmenu stavu po podpise zmluvy alebo po vypršaní lehoty.", en: "Automatically changes the contact's disposition (status) in the campaign. Useful e.g. for auto-changing status after contract signing or deadline expiry.", cs: "Automaticky změní dispozici kontaktu v kampani. Vhodné pro automatickou změnu stavu po podpisu smlouvy.", hu: "Automatikusan megváltoztatja a kontakt diszpozícióját (státuszát) a kampányban.", ro: "Schimbă automat dispoziția (statusul) contactului în campanie.", it: "Cambia automaticamente la disposizione (stato) del contatto nella campagna.", de: "Ändert automatisch die Disposition (Status) des Kontakts in der Kampagne." },
  atHelp_set_callback:       { sk: "Naplánuje spätné volanie (callback) kontaktu o zadaný počet pracovných dní na 09:00. Kontakt sa znova objaví vo fronte agenta v daný deň. Pri manuálnom spustení si agent môže vybrať vlastný dátum.", en: "Schedules a callback for the contact after the given number of business days at 09:00. The contact re-appears in the agent's queue on that day. On manual run the agent can pick a custom date.", cs: "Naplánuje zpětné volání kontaktu o zadaný počet pracovních dnů na 09:00. Kontakt se znovu objeví ve frontě agenta.", hu: "Visszahívást ütemez a kontakthoz a megadott munkanapok után 09:00-kor. A kontakt újra megjelenik az ügynök sorában.", ro: "Programează un callback pentru contact după numărul dat de zile lucrătoare la 09:00. Contactul reapare în coada agentului.", it: "Pianifica un richiamo per il contatto dopo il numero indicato di giorni lavorativi alle 09:00. Il contatto riappare nella coda dell'agente.", de: "Plant einen Rückruf für den Kontakt nach der angegebenen Anzahl von Werktagen um 09:00 Uhr. Der Kontakt erscheint erneut in der Warteschlange des Agenten." },
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
  ct_auto:     { sk: "Automaticky (pri načítaní)", en: "Auto-run (on load)", cs: "Automaticky (při načtení)", hu: "Automatikus (betöltéskor)", ro: "Automat (la încărcare)", it: "Automatico (al caricamento)", de: "Automatisch (beim Laden)" },
  qLogicOne:   { sk: "Iba jeden (exkluzívny)", en: "One (exclusive)", cs: "Pouze jeden (exkluzivní)", hu: "Csak egy (kizárólagos)", ro: "Unul singur (exclusiv)", it: "Uno solo (esclusivo)", de: "Nur einer (exklusiv)" },
  autoConfirmSubLbl:  { sk: "Auto-potvrdiť pri podotázke", en: "Auto-confirm on sub-answer", cs: "Auto-potvrdit při podotázce", hu: "Automatikus megerősítés al-válasz esetén", ro: "Confirmare auto la sub-răspuns", it: "Conferma auto al sotto-risposta", de: "Auto-Bestätigung bei Unterantwort" },
  autoConfirmSubHint: { sk: "Hlavný krok sa automaticky potvrdí a jeho akcie sa spustia hneď ako agent odpovie na akúkoľvek podotázku.", en: "The parent step is auto-confirmed and its actions run as soon as the agent answers any sub-question.", cs: "Hlavní krok se automaticky potvrdí a jeho akce se spustí, jakmile agent odpoví na jakoukoli podotázku.", hu: "A fő lépés automatikusan megerősítésre kerül és műveletek futnak, amint az ügynök bármely alkérdésre válaszol.", ro: "Pasul principal este auto-confirmat și acțiunile sale rulează imediat ce agentul răspunde la orice sub-întrebare.", it: "Il passo principale viene auto-confermato e le sue azioni vengono eseguite non appena l'agente risponde a qualsiasi sotto-domanda.", de: "Der Hauptschritt wird automatisch bestätigt und seine Aktionen werden ausgeführt, sobald der Agent eine Unterfrage beantwortet." },

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
  notifyAssignLbl: { sk: "Upozorniť priradenú skupinu/rolu", en: "Notify assigned group/role", cs: "Upozornit přiřazenou skupinu/roli", hu: "Hozzárendelt csoport/szerepkör értesítése", ro: "Notifică grupul/rolul atribuit", it: "Notifica al gruppo/ruolo assegnato", de: "Zugewiesene Gruppe/Rolle benachrichtigen" },
  notifyAssignHint: { sk: "Každý člen dostane upozornenie cez zvolené kanály.", en: "Each member is notified via the selected channels.", cs: "Každý člen dostane upozornění přes zvolené kanály.", hu: "Minden tag értesítést kap a kiválasztott csatornákon.", ro: "Fiecare membru este notificat prin canalele selectate.", it: "Ogni membro viene notificato tramite i canali selezionati.", de: "Jedes Mitglied wird über die gewählten Kanäle benachrichtigt." },
  channelsLbl: { sk: "Kanály upozornenia", en: "Notification channels", cs: "Kanály upozornění", hu: "Értesítési csatornák", ro: "Canale de notificare", it: "Canali di notifica", de: "Benachrichtigungskanäle" },
  channelPush: { sk: "Push (v aplikácii)", en: "Push (in-app)", cs: "Push (v aplikaci)", hu: "Push (alkalmazásban)", ro: "Push (în aplicație)", it: "Push (in-app)", de: "Push (In-App)" },
  channelEmail: { sk: "Email", en: "Email", cs: "E-mail", hu: "E-mail", ro: "Email", it: "Email", de: "E-Mail" },
  channelSms: { sk: "SMS", en: "SMS", cs: "SMS", hu: "SMS", ro: "SMS", it: "SMS", de: "SMS" },
  taskDescLbl:   { sk: "Popis úlohy", en: "Task description", cs: "Popis úkolu", hu: "Feladat leírása", ro: "Descrierea sarcinii", it: "Descrizione compito", de: "Aufgabenbeschreibung" },
  taskDescPh:    { sk: "Popis úlohy pre Back Office / Koordinátora...", en: "Task description for Back Office / Coordinator...", cs: "Popis úkolu pro Back Office / Koordinátora...", hu: "Feladat leírása Back Office / Koordinátor számára...", ro: "Descrierea sarcinii pentru Back Office / Coordonator...", it: "Descrizione compito per Back Office / Coordinatore...", de: "Aufgabenbeschreibung für Back Office / Koordinator..." },
  deadlineLbl:   { sk: "Termín", en: "Deadline", cs: "Termín", hu: "Határidő", ro: "Termen", it: "Scadenza", de: "Frist" },
  priorityLbl:   { sk: "Priorita", en: "Priority", cs: "Priorita", hu: "Prioritás", ro: "Prioritate", it: "Priorità", de: "Priorität" },
  ifLabel:       { sk: "AK", en: "IF", cs: "KDYŽ", hu: "HA", ro: "DACĂ", it: "SE", de: "WENN" },
  condSubLbl:    { sk: "Podmienka (voliteľné)", en: "Condition (optional)", cs: "Podmínka (volitelné)", hu: "Feltétel (opcionális)", ro: "Condiție (opțional)", it: "Condizione (opzionale)", de: "Bedingung (optional)" },
  tgSelectLbl:   { sk: "Priradiť skupinu alebo rolu", en: "Assign to group or role", cs: "Přiřadit skupině nebo roli", hu: "Csoport vagy szerepkör hozzárendelése", ro: "Atribuire grup sau rol", it: "Assegna a gruppo o ruolo", de: "Gruppe oder Rolle zuweisen" },
  tgGroupsHeader:{ sk: "Skupiny úloh", en: "Task Groups", cs: "Skupiny úkolů", hu: "Feladat csoportok", ro: "Grupuri sarcini", it: "Gruppi di lavoro", de: "Aufgabengruppen" },
  tgRolesHeader: { sk: "Roly", en: "Roles", cs: "Role", hu: "Szerepkörök", ro: "Roluri", it: "Ruoli", de: "Rollen" },
  tgNoGroups:    { sk: "Žiadne skupiny", en: "No groups", cs: "Žádné skupiny", hu: "Nincs csoport", ro: "Niciun grup", it: "Nessun gruppo", de: "Keine Gruppen" },
  varPickerLbl:  { sk: "Vložiť premennú", en: "Insert variable", cs: "Vložit proměnnou", hu: "Változó beszúrása", ro: "Inserare variabilă", it: "Inserisci variabile", de: "Variable einfügen" },
  condExtended:  { sk: "Rozšírené", en: "Extended", cs: "Rozšířené", hu: "Bővített", ro: "Extins", it: "Esteso", de: "Erweitert" },
  condFieldChanged: { sk: "Pole sa zmenilo na", en: "Field changed to", cs: "Pole se změnilo na", hu: "Mező megváltozott erre", ro: "Câmpul s-a schimbat la", it: "Il campo è cambiato a", de: "Feld hat sich geändert zu" },
  fctFieldLbl: { sk: "Pole kontaktu", en: "Contact field", cs: "Pole kontaktu", hu: "Kontakt mező", ro: "Câmp contact", it: "Campo contatto", de: "Kontaktfeld" },
  fctValueLbl: { sk: "Cieľová hodnota", en: "Target value", cs: "Cílová hodnota", hu: "Célérték", ro: "Valoare țintă", it: "Valore destinazione", de: "Zielwert" },
  fctValuePh: { sk: "Zadajte hodnotu...", en: "Enter value...", cs: "Zadejte hodnotu...", hu: "Adja meg az értéket...", ro: "Introduceți valoarea...", it: "Inserisci valore...", de: "Wert eingeben..." },
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
  emailRecipientsLbl:  { sk: "Ďalší pevní príjemcovia (voliteľné)", en: "Extra fixed recipients (optional)", cs: "Další pevní příjemci (volitelné)", hu: "További fix címzettek (opcionális)", ro: "Destinatari fix suplimentari (opțional)", it: "Destinatari fissi aggiuntivi (opzionale)", de: "Zusätzliche feste Empfänger (optional)" },
  emailRecipientsPh:   { sk: "jeden e-mail na riadok alebo oddelené čiarkou", en: "one email per line or comma-separated", cs: "jeden e-mail na řádek nebo oddělené čárkou", hu: "soronként egy e-mail vagy vesszővel elválasztva", ro: "un email pe rând sau separate prin virgulă", it: "una email per riga o separate da virgola", de: "eine E-Mail pro Zeile oder durch Komma getrennt" },
  emailRecipientsHelp: { sk: "Príjemcovia = používatelia zvolenej role + tieto adresy (ak sú vyplnené).", en: "Recipients = users of the selected role + these addresses (if filled).", cs: "Příjemci = uživatelé zvolené role + tyto adresy (jsou-li vyplněny).", hu: "Címzettek = a kiválasztott szerepkör felhasználói + ezek a címek (ha ki vannak töltve).", ro: "Destinatari = utilizatorii rolului selectat + aceste adrese (dacă sunt completate).", it: "Destinatari = utenti del ruolo selezionato + questi indirizzi (se compilati).", de: "Empfänger = Benutzer der gewählten Rolle + diese Adressen (falls ausgefüllt)." },
  extEmailRecipientsLbl:  { sk: "Emailové adresy príjemcov", en: "Recipient email addresses", cs: "E-mailové adresy příjemců", hu: "Címzett e-mail címek", ro: "Adrese email destinatari", it: "Indirizzi email destinatari", de: "E-Mail-Adressen der Empfänger" },
  extEmailRecipientsPh:   { sk: "jeden e-mail na riadok alebo oddelené čiarkou", en: "one email per line or comma-separated", cs: "jeden e-mail na řádek nebo oddělené čárkou", hu: "soronként egy e-mail vagy vesszővel elválasztva", ro: "un email pe rând sau separate prin virgulă", it: "una email per riga o separate da virgola", de: "eine E-Mail pro Zeile oder durch Komma getrennt" },
  extEmailRecipientsHelp: { sk: "Email bude odoslaný na tieto adresy. Nemusia byť registrované v INDEXUS.", en: "Email will be sent to these addresses. They do not need to be registered in INDEXUS.", cs: "E-mail bude odeslán na tyto adresy. Nemusí být registrovány v INDEXUS.", hu: "Az e-mail ezekre a címekre lesz elküldve. Nem szükséges INDEXUS-ban regisztrálva lenniük.", ro: "Email-ul va fi trimis la aceste adrese. Nu trebuie să fie înregistrate în INDEXUS.", it: "L'email verrà inviata a questi indirizzi. Non devono essere registrati in INDEXUS.", de: "Die E-Mail wird an diese Adressen gesendet. Sie müssen nicht in INDEXUS registriert sein." },
  emailCategoryLbl:    { sk: "Kategória šablóny", en: "Template category", cs: "Kategorie šablony", hu: "Sablon kategória", ro: "Categorie șablon", it: "Categoria modello", de: "Vorlagenkategorie" },
  selectCategory:      { sk: "— Všetky kategórie —", en: "— All categories —", cs: "— Všechny kategorie —", hu: "— Minden kategória —", ro: "— Toate categoriile —", it: "— Tutte le categorie —", de: "— Alle Kategorien —" },
  callbackOffsetLbl:   { sk: "Odklad (pracovné dni)", en: "Offset (business days)", cs: "Odklad (pracovní dny)", hu: "Eltolás (munkanapok)", ro: "Decalaj (zile lucrătoare)", it: "Ritardo (giorni lavorativi)", de: "Versatz (Werktage)" },
  callbackOffsetHelp:  { sk: "Za koľko pracovných dní sa kontakt znova objaví vo fronte (o 09:00).", en: "After how many business days the contact re-appears in the queue (at 09:00).", cs: "Za kolik pracovních dnů se kontakt znovu objeví ve frontě (v 09:00).", hu: "Hány munkanap múlva jelenik meg újra a kontakt a sorban (09:00-kor).", ro: "După câte zile lucrătoare reapare contactul în coadă (la 09:00).", it: "Dopo quanti giorni lavorativi il contatto riappare nella coda (alle 09:00).", de: "Nach wie vielen Werktagen erscheint der Kontakt erneut in der Warteschlange (um 09:00 Uhr)." },
  callbackTimeLbl:     { sk: "Čas (hodina)", en: "Time (hour)", cs: "Čas (hodina)", hu: "Idő (óra)", ro: "Oră", it: "Orario", de: "Uhrzeit" },
  statusCallbackHelp:  { sk: "Kedy sa kontakt znova objaví vo fronte agenta — počet pracovných dní a presný čas.", en: "When the contact re-appears in the agent's queue — number of business days and the exact time.", cs: "Kdy se kontakt znovu objeví ve frontě agenta — počet pracovních dnů a přesný čas.", hu: "Mikor jelenik meg újra a kontakt az ügynök sorában — munkanapok száma és a pontos idő.", ro: "Când reapare contactul în coada agentului — numărul de zile lucrătoare și ora exactă.", it: "Quando il contatto riappare nella coda dell'agente — numero di giorni lavorativi e l'orario esatto.", de: "Wann der Kontakt erneut in der Warteschlange des Agenten erscheint — Anzahl der Werktage und die genaue Uhrzeit." },
  notifyPulseLbl:      { sk: "Upozorniť agenta v Nexus Pulse", en: "Notify agent in Nexus Pulse", cs: "Upozornit agenta v Nexus Pulse", hu: "Értesítés az ügynöknek a Nexus Pulse-ban", ro: "Notifică agentul în Nexus Pulse", it: "Avvisa l'agente in Nexus Pulse", de: "Agent in Nexus Pulse benachrichtigen" },
  notifyPulseHint:     { sk: "Callback sa agentovi automaticky objaví vo fronte spätných volaní v nastavenom čase (bez zvuku).", en: "The callback will automatically appear in the agent's callback queue at the set time (no sound).", cs: "Callback se agentovi automaticky objeví ve frontě zpětných volání v nastaveném čase (bez zvuku).", hu: "A visszahívás a beállított időpontban automatikusan megjelenik az ügynök visszahívási sorában (hang nélkül).", ro: "Apelul invers va apărea automat în coada de apeluri a agentului la ora setată (fără sunet).", it: "La richiamata apparirà automaticamente nella coda di richiamate dell'agente all'orario impostato (senza suono).", de: "Der Rückruf erscheint zur eingestellten Zeit automatisch in der Rückrufliste des Agenten (ohne Ton)." },
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
  tplSelectAll:    { sk: "Vybrať všetko", en: "Select all" },
  tplDeselectAll:  { sk: "Zrušiť výber", en: "Deselect all" },
  deleteSelectedBtn: { sk: "Zmazať vybrané", en: "Delete selected" },

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
  itemHiddenLbl:   { sk: "Skryť krok agentovi", en: "Hide step from agent" },
  itemHiddenHint:  { sk: "Krok sa nezobrazí v zozname agenta, automatizácie však naďalej fungujú.", en: "The step is hidden from the agent's list, but automations still run." },
  itemHiddenBadge: { sk: "Skryté", en: "Hidden" },
  tplLabel:        { sk: "Šablóny", en: "Templates" },
  tplHint:         { sk: "Kliknutím vložíte šablónu — text môžete ďalej upraviť.", en: "Click to apply a template — you can still edit the text." },
  tplTabMPN:       { sk: "MPN — Sieť partnerov", en: "MPN — Partner Network", cs: "MPN — Síť partnerů", hu: "MPN — Partnerhálózat", ro: "MPN — Rețea Parteneri", it: "MPN — Rete Partner", de: "MPN — Partnernetzwerk" },
  boTag:           { sk: "Back Office", en: "Back Office", cs: "Back Office", hu: "Back Office", ro: "Back Office", it: "Back Office", de: "Back Office" },
  boRouteHint:     { sk: "Táto úloha sa zobrazí v agende Back Office.", en: "This task will appear in the Back Office agenda.", cs: "Tento úkol se zobrazí v agendě Back Office.", hu: "Ez a feladat megjelenik a Back Office listában.", ro: "Această sarcină va apărea în agenda Back Office.", it: "Questo compito apparirà nell'agenda Back Office.", de: "Diese Aufgabe erscheint in der Back-Office-Agenda." },
  prDescLbl:       { sk: "Popis priority", en: "Priority description" },
  fctHospitalPh:   { sk: "Vyberte nemocnicu", en: "Select hospital" },
  fctClinicPh:     { sk: "Vyberte kliniku", en: "Select clinic" },
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
      {(() => {
        const previewRoots = items.filter(i => !i.parentId);
        const previewChildrenOf = (pid: string) => items.filter(i => i.parentId === pid);
        return previewRoots.map((item, idx) => {
        const ConfirmIcon = CONFIRM_TYPE_OPTIONS.find(o => o.value === item.confirmationType)?.icon || SquareCheck;
        const isChecked = checked.has(item.id);
        const autoCount = item.automations?.length ?? 0;
        const previewChildren = previewChildrenOf(item.id);
        return (
          <div key={item.id}>
          <div
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
          {previewChildren.length > 0 && (
            <div className="ml-5 mt-1 space-y-1.5 pl-3 border-l-2 border-dashed border-border">
              {previewChildren.map((child) => {
                const ChildIcon = CONFIRM_TYPE_OPTIONS.find(o => o.value === child.confirmationType)?.icon || SquareCheck;
                const childChecked = checked.has(child.id);
                return (
                  <div key={child.id} className={`rounded-lg border p-2.5 transition-colors ${childChecked ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setChecked(prev => { const next = new Set(prev); if (next.has(child.id)) next.delete(child.id); else next.add(child.id); return next; })} className="shrink-0">
                        <ChildIcon className={`h-3.5 w-3.5 ${childChecked ? "text-primary" : "text-muted-foreground/50"}`} />
                      </button>
                      <span className={`text-xs font-medium ${childChecked ? "line-through text-muted-foreground" : ""}`}>{localizeText(child.label, locale)}</span>
                    </div>
                    {child.description && <p className="text-[11px] text-muted-foreground mt-1 whitespace-pre-line">{localizeText(child.description, locale)}</p>}
                  </div>
                );
              })}
            </div>
          )}
          </div>
        );
      });
      })()}
    </div>
  );
}

const ACTION_TYPE_OPTIONS = [
  { value: "assign_task",        slKey: "at_assign_task",        icon: ClipboardList, color: "text-blue-500" },
  { value: "send_email_group",   slKey: "at_send_email_group",   icon: Mail,          color: "text-green-500" },
  { value: "notify_email",       slKey: "at_notify_email",       icon: MailPlus,      color: "text-violet-500" },
  { value: "send_sms",           slKey: "at_send_sms",           icon: MessageSquare, color: "text-yellow-500" },
  { value: "set_contact_status", slKey: "at_set_contact_status", icon: Tag,           color: "text-purple-500" },
  { value: "set_callback",       slKey: "at_set_callback",       icon: Phone,         color: "text-cyan-500" },
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
  { value: "low",    slKey: "pr_low",    descSk: "Bez časového tlaku — vybaviť, keď bude priestor.", descEn: "No time pressure — handle when there's capacity." },
  { value: "medium", slKey: "pr_medium", descSk: "Štandardná priorita — vybaviť v bežnom poradí.", descEn: "Standard priority — handle in normal order." },
  { value: "high",   slKey: "pr_high",   descSk: "Dôležité — vybaviť prednostne ešte dnes.", descEn: "Important — handle with priority today." },
  { value: "urgent", slKey: "pr_urgent", descSk: "Kritické — vyžaduje okamžitú pozornosť.", descEn: "Critical — requires immediate attention." },
];

type TplLocale = "sk" | "en" | "cs" | "hu" | "ro" | "it" | "de";
const TPL_LOCALES: TplLocale[] = ["sk", "en", "cs", "hu", "ro", "it", "de"];
function tplLocale(locale: string): TplLocale {
  return (TPL_LOCALES.includes(locale as TplLocale) ? locale : "sk") as TplLocale;
}

// Localized field labels used to compose template bodies (and the variable-token row).
const TPL_FIELD_LABELS: Record<string, Record<TplLocale, string>> = {
  customerName: { sk: "Klient", en: "Client", cs: "Klient", hu: "Ügyfél", ro: "Client", it: "Cliente", de: "Kunde" },
  customerId:   { sk: "ID klienta", en: "Client ID", cs: "ID klienta", hu: "Ügyfél-azonosító", ro: "ID client", it: "ID cliente", de: "Kunden-ID" },
  phone:        { sk: "Telefón", en: "Phone", cs: "Telefon", hu: "Telefon", ro: "Telefon", it: "Telefono", de: "Telefon" },
  email:        { sk: "E-mail", en: "Email", cs: "E-mail", hu: "E-mail", ro: "E-mail", it: "Email", de: "E-Mail" },
  hospital:     { sk: "Nemocnica", en: "Hospital", cs: "Nemocnice", hu: "Kórház", ro: "Spital", it: "Ospedale", de: "Krankenhaus" },
  clinic:       { sk: "Klinika", en: "Clinic", cs: "Klinika", hu: "Klinika", ro: "Clinică", it: "Clinica", de: "Klinik" },
  collaborator: { sk: "Spolupracovník", en: "Collaborator", cs: "Spolupracovník", hu: "Munkatárs", ro: "Colaborator", it: "Collaboratore", de: "Mitarbeiter" },
  campaign:     { sk: "Kampaň", en: "Campaign", cs: "Kampaň", hu: "Kampány", ro: "Campanie", it: "Campagna", de: "Kampagne" },
  agent:        { sk: "Agent", en: "Agent", cs: "Agent", hu: "Ügynök", ro: "Agent", it: "Agente", de: "Agent" },
};

// Maps a field key to the runtime token resolved server-side on task creation.
const TPL_FIELD_TOKEN: Record<string, string> = {
  customerName: "{{customer.name}}",
  customerId: "{{customer.id}}",
  phone: "{{customer.phone}}",
  email: "{{customer.email}}",
  hospital: "{{hospital.name}}",
  clinic: "{{clinic.name}}",
  collaborator: "{{customer.name}}",
  campaign: "{{campaign.name}}",
  agent: "{{agent.name}}",
};

// Trailing instruction line for each template.
const TPL_PROMPTS: Record<string, Record<TplLocale, string>> = {
  fix:     { sk: "Čo treba opraviť:", en: "What to fix:", cs: "Co opravit:", hu: "Mit kell javítani:", ro: "Ce trebuie corectat:", it: "Cosa correggere:", de: "Was korrigieren:" },
  reason:  { sk: "Dôvod:", en: "Reason:", cs: "Důvod:", hu: "Indok:", ro: "Motiv:", it: "Motivo:", de: "Grund:" },
  note:    { sk: "Poznámka:", en: "Note:", cs: "Poznámka:", hu: "Megjegyzés:", ro: "Notă:", it: "Nota:", de: "Notiz:" },
  task:    { sk: "Úloha:", en: "Task:", cs: "Úkol:", hu: "Feladat:", ro: "Sarcină:", it: "Compito:", de: "Aufgabe:" },
  update:  { sk: "Čo aktualizovať:", en: "What to update:", cs: "Co aktualizovat:", hu: "Mit kell frissíteni:", ro: "Ce trebuie actualizat:", it: "Cosa aggiornare:", de: "Was aktualisieren:" },
  contact: { sk: "Dôvod kontaktu:", en: "Reason for contact:", cs: "Důvod kontaktu:", hu: "Kapcsolatfelvétel oka:", ro: "Motivul contactării:", it: "Motivo del contatto:", de: "Kontaktgrund:" },
};

type TplEntity = "customer" | "hospital" | "clinic" | "collaborator" | "general";
const TPL_ENTITY_ORDER: TplEntity[] = ["customer", "hospital", "clinic", "collaborator", "general"];
const TPL_ENTITY_LABELS: Record<TplEntity, Record<TplLocale, string>> = {
  customer:     { sk: "Klient", en: "Customer", cs: "Klient", hu: "Ügyfél", ro: "Client", it: "Cliente", de: "Kunde" },
  hospital:     { sk: "Nemocnica", en: "Hospital", cs: "Nemocnice", hu: "Kórház", ro: "Spital", it: "Ospedale", de: "Krankenhaus" },
  clinic:       { sk: "Klinika", en: "Clinic", cs: "Klinika", hu: "Klinika", ro: "Clinică", it: "Clinica", de: "Klinik" },
  collaborator: { sk: "Spolupracovník", en: "Collaborator", cs: "Spolupracovník", hu: "Munkatárs", ro: "Colaborator", it: "Collaboratore", de: "Mitarbeiter" },
  general:      { sk: "Všeobecné", en: "General", cs: "Obecné", hu: "Általános", ro: "General", it: "Generale", de: "Allgemein" },
};

type TaskTemplateDef = {
  id: string;
  entity: TplEntity;
  label: Record<TplLocale, string>;
  fields: string[];
  prompt: keyof typeof TPL_PROMPTS;
};

const TASK_TEMPLATES: TaskTemplateDef[] = [
  // CUSTOMER
  { id: "cust_data_fix", entity: "customer", fields: ["customerName", "customerId", "phone"], prompt: "fix",
    label: { sk: "Oprava dát klienta", en: "Fix client data", cs: "Oprava dat klienta", hu: "Ügyféladatok javítása", ro: "Corectare date client", it: "Correzione dati cliente", de: "Kundendaten korrigieren" } },
  { id: "cust_callback", entity: "customer", fields: ["customerName", "phone"], prompt: "reason",
    label: { sk: "Spätné volanie", en: "Call back", cs: "Zpětné volání", hu: "Visszahívás", ro: "Apel invers", it: "Richiamare", de: "Rückruf" } },
  { id: "cust_doc_check", entity: "customer", fields: ["customerName", "customerId", "hospital", "clinic"], prompt: "note",
    label: { sk: "Kontrola dokumentov", en: "Document check", cs: "Kontrola dokumentů", hu: "Dokumentumok ellenőrzése", ro: "Verificare documente", it: "Controllo documenti", de: "Dokumentenprüfung" } },
  // HOSPITAL
  { id: "hosp_contact", entity: "hospital", fields: ["hospital", "customerName", "phone"], prompt: "contact",
    label: { sk: "Kontaktovať nemocnicu", en: "Contact hospital", cs: "Kontaktovat nemocnici", hu: "Kórház megkeresése", ro: "Contactare spital", it: "Contattare ospedale", de: "Krankenhaus kontaktieren" } },
  { id: "hosp_update", entity: "hospital", fields: ["hospital"], prompt: "update",
    label: { sk: "Aktualizovať údaje nemocnice", en: "Update hospital info", cs: "Aktualizovat údaje nemocnice", hu: "Kórház adatainak frissítése", ro: "Actualizare date spital", it: "Aggiornare dati ospedale", de: "Krankenhausdaten aktualisieren" } },
  // CLINIC
  { id: "clinic_contact", entity: "clinic", fields: ["clinic", "customerName", "phone"], prompt: "contact",
    label: { sk: "Kontaktovať kliniku", en: "Contact clinic", cs: "Kontaktovat kliniku", hu: "Klinika megkeresése", ro: "Contactare clinică", it: "Contattare clinica", de: "Klinik kontaktieren" } },
  { id: "clinic_update", entity: "clinic", fields: ["clinic"], prompt: "update",
    label: { sk: "Aktualizovať údaje kliniky", en: "Update clinic info", cs: "Aktualizovat údaje kliniky", hu: "Klinika adatainak frissítése", ro: "Actualizare date clinică", it: "Aggiornare dati clinica", de: "Klinikdaten aktualisieren" } },
  // COLLABORATOR
  { id: "collab_contact", entity: "collaborator", fields: ["collaborator", "phone"], prompt: "contact",
    label: { sk: "Kontaktovať spolupracovníka", en: "Contact collaborator", cs: "Kontaktovat spolupracovníka", hu: "Munkatárs megkeresése", ro: "Contactare colaborator", it: "Contattare collaboratore", de: "Mitarbeiter kontaktieren" } },
  { id: "collab_followup", entity: "collaborator", fields: ["collaborator", "campaign"], prompt: "note",
    label: { sk: "Follow-up spolupráce", en: "Collaboration follow-up", cs: "Follow-up spolupráce", hu: "Együttműködés utánkövetése", ro: "Urmărire colaborare", it: "Follow-up collaborazione", de: "Zusammenarbeit-Follow-up" } },
  // GENERAL
  { id: "general", entity: "general", fields: ["customerName", "customerId", "phone", "hospital", "clinic", "campaign", "agent"], prompt: "task",
    label: { sk: "Všeobecná úloha (všetky údaje)", en: "General task (all data)", cs: "Obecný úkol (všechna data)", hu: "Általános feladat (összes adat)", ro: "Sarcină generală (toate datele)", it: "Compito generale (tutti i dati)", de: "Allgemeine Aufgabe (alle Daten)" } },
];

function getTemplateLabel(tpl: TaskTemplateDef, locale: string): string {
  const l = tplLocale(locale);
  return tpl.label[l] ?? tpl.label.en;
}

function buildTemplateBody(tpl: TaskTemplateDef, locale: string): string {
  const l = tplLocale(locale);
  const lines = tpl.fields.map(fk => `${TPL_FIELD_LABELS[fk][l]}: ${TPL_FIELD_TOKEN[fk]}`);
  const prompt = TPL_PROMPTS[tpl.prompt][l] ?? TPL_PROMPTS[tpl.prompt].en;
  return `${lines.join("\n")}\n\n${prompt} `;
}

const CONFIRM_TYPE_OPTIONS = [
  { value: "checkbox", slKey: "ct_checkbox", icon: SquareCheck },
  { value: "radio",    slKey: "ct_radio",    icon: CircleDot },
  { value: "info",     slKey: "ct_info",     icon: Info },
  { value: "auto",     slKey: "ct_auto",     icon: Zap },
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
    key: "contact.status_code", category: "contact",
    labelSk: "Kód stavu kontaktu (CRM)", labelEn: "Contact status code (CRM)",
    descSk: "Aktuálny kód stavu kontaktu v CRM systéme (napr. potential, in_process, client, inactive). Porovnáva voči aktuálnej hodnote poľa client_status.",
    descEn: "Current status code of the contact in the CRM system (e.g. potential, in_process, client, inactive). Compared against the current client_status field value.",
    ops: OPS_STR, valueType: "select",
    options: [
      { value: "potential",   labelSk: "Potenciálny",  labelEn: "Potential" },
      { value: "in_process",  labelSk: "V procese",    labelEn: "In process" },
      { value: "client",      labelSk: "Klient",       labelEn: "Client" },
      { value: "inactive",    labelSk: "Neaktívny",    labelEn: "Inactive" },
    ],
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
  if (opt) return sl(opt.slKey, locale);
  if (role === "sys") return sl("rl_sys", locale);
  if (role.startsWith("role:")) return role.slice(5);
  return role;
}

function AutomationBadge({ automation, groups }: { automation: StatusListAutomation; groups?: any[] }) {
  const { locale } = useI18n();
  const groupRecord = automation.taskGroupId
    ? (groups?.find((g: any) => g.id === automation.taskGroupId) || null)
    : null;
  const groupDisplayName = groupRecord
    ? (groupRecord.displayAlias || groupRecord.name || `Skupina #${automation.taskGroupId!.slice(0, 6)}`)
    : null;
  const groupFullName = groupRecord?.name || null;
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
      {groupDisplayName && (
        <span
          title={groupFullName && groupFullName !== groupDisplayName ? groupFullName : undefined}
          className="font-medium text-blue-600 dark:text-blue-400 cursor-default">→ 👥 {groupDisplayName}</span>
      )}
      {!groupDisplayName && automation.targetRole && (
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
    emailCategoryId: "",
    smsTemplateId: automation?.smsTemplateId || "",
    conditionType: automation?.conditionJson
      ? ((() => { try { const p = JSON.parse(automation.conditionJson ?? "{}"); return p.__type === "field_changed_to" ? "field_changed_to" : "compound"; } catch { return "compound"; } })())
      : automation?.conditionField === "country" ? "country" : "always",
    conditionCountry: automation?.conditionField === "country" ? (automation?.conditionValue || "SK") : "SK",
    conditionAnswer: automation?.conditionField === "answer" ? (automation?.conditionValue || "") : "",
    conditionLogic: (() => { try { const p = JSON.parse(automation?.conditionJson ?? "{}"); return p.__type === "field_changed_to" ? "AND" : (p.logic ?? "AND"); } catch { return "AND"; } })() as "AND" | "OR",
    conditionRules: (() => { try { const p = JSON.parse(automation?.conditionJson ?? "{}"); return p.__type === "field_changed_to" ? [] : (p.rules ?? []); } catch { return []; } })() as { field: string; op: string; value: string }[],
    fieldChangedKey: (() => { try { const p = JSON.parse(automation?.conditionJson ?? "{}"); return p.__type === "field_changed_to" ? (p.field ?? "contact.status_code") : "contact.status_code"; } catch { return "contact.status_code"; } })(),
    fieldChangedValue: (() => { try { const p = JSON.parse(automation?.conditionJson ?? "{}"); return p.__type === "field_changed_to" ? (p.value ?? "") : ""; } catch { return ""; } })(),
    dispositionId: automation?.dispositionId || "",
    emailRecipients: (automation?.emailRecipients ?? []).join("\n"),
    callbackOffsetDays: automation?.callbackOffsetDays != null ? String(automation.callbackOffsetDays) : "1",
    callbackTime: (automation as any)?.callbackTime || "09:00",
    notifyAgentPulse: (automation as any)?.notifyAgentPulse ?? false,
    webhookTarget: automation?.webhookTarget || "",
    taskGroupId: automation?.taskGroupId || "",
    assignNotify: (automation as any)?.assignNotify ?? false,
    assignNotifyChannels: ((automation as any)?.assignNotifyChannels ?? []) as string[],
  });
  const [showActionHelp, setShowActionHelp] = useState(false);
  const taskDescRef = useRef<HTMLTextAreaElement>(null);

  const isEdit = !!automation?.id;

  const { data: emailTemplates = [] } = useQuery<any[]>({
    queryKey: ["/api/message-templates", "email"],
    queryFn: () => fetch(`/api/message-templates?type=email`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error(`Request failed: ${r.status}`); return r.json(); }),
    enabled: ["send_email_group", "notify_email"].includes(form.actionType),
  });
  const { data: emailCategories = [] } = useQuery<any[]>({
    queryKey: ["/api/template-categories"],
    queryFn: () => fetch("/api/template-categories", { credentials: "include" }).then(r => { if (!r.ok) throw new Error(`Request failed: ${r.status}`); return r.json(); }),
    enabled: ["send_email_group", "notify_email"].includes(form.actionType),
  });

  const { data: campaignDispositions = [] } = useQuery<any[]>({
    queryKey: ["/api/campaigns", campaignId, "dispositions-auto"],
    queryFn: () => fetch(`/api/campaigns/${campaignId}/dispositions`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error(`Request failed: ${r.status}`); return r.json(); }),
    enabled: form.actionType === "set_contact_status",
  });

  const { data: taskGroupsList = [] } = useQuery<any[]>({
    queryKey: ["/api/task-groups"],
    enabled: form.actionType === "assign_task",
  });

  // A disposition is a "callback" type when its actionType schedules a follow-up;
  // these mirror SL_DISP_STATUS_MAP server-side (callback/schedule_email/schedule_sms).
  const selectedSlDisp = (campaignDispositions as any[]).find((d: any) => String(d.id) === String(form.dispositionId));
  const isCallbackDisp = !!selectedSlDisp && ["callback", "schedule_email", "schedule_sms"].includes(selectedSlDisp.actionType);

  const { data: rolesList = [] } = useQuery<any[]>({
    queryKey: ["/api/roles"],
    enabled: ["assign_task", "send_email_group", "notify_role"].includes(form.actionType),
  });

  const { data: hospitalsList = [] } = useQuery<any[]>({
    queryKey: ["/api/hospitals"],
    enabled: form.conditionType === "field_changed_to" && form.fieldChangedKey === "contact.hospital_id",
  });

  const { data: clinicsList = [] } = useQuery<any[]>({
    queryKey: ["/api/clinics"],
    enabled: form.conditionType === "field_changed_to" && form.fieldChangedKey === "contact.clinic_id",
  });

  const activeRoles = (rolesList as any[]).filter((r: any) => r?.isActive !== false && r?.name);
  const roleChoices: { value: string; label: string }[] = (() => {
    const list = activeRoles.length > 0
      ? activeRoles.map((r: any) => ({ value: `role:${r.name}`, label: r.description ? `${r.name} — ${r.description}` : r.name }))
      : ROLE_OPTIONS.map(o => ({ value: o.value, label: sl(o.slKey, locale) }));
    // Keep the currently-saved role selectable even if it's not in the active roles list (legacy automations)
    if (form.targetRole && !list.some(o => o.value === form.targetRole)) {
      list.push({ value: form.targetRole, label: getRoleLabel(form.targetRole, locale) });
    }
    return list;
  })();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        actionType: form.actionType,
        targetRole: form.actionType === "notify_email" ? null : (form.targetRole || null),
        taskDescription: form.taskDescription || null,
        taskDeadlineOffset: form.taskDeadlineOffset || null,
        taskPriority: form.taskPriority,
        emailTemplateId: form.emailTemplateId || null,
        smsTemplateId: form.smsTemplateId || null,
        dispositionId: form.dispositionId || null,
        emailRecipients: ["send_email_group", "notify_email"].includes(form.actionType)
          ? form.emailRecipients.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean)
          : [],
        callbackOffsetDays: (form.actionType === "set_callback" || (form.actionType === "set_contact_status" && isCallbackDisp))
          ? (Number.isFinite(parseInt(form.callbackOffsetDays, 10)) ? parseInt(form.callbackOffsetDays, 10) : 1)
          : null,
        callbackTime: form.actionType === "set_contact_status" && isCallbackDisp ? (form.callbackTime || "09:00") : null,
        notifyAgentPulse: form.actionType === "set_contact_status" && isCallbackDisp ? form.notifyAgentPulse : false,
        conditionField: (form.conditionType === "compound" || form.conditionType === "always" || form.conditionType === "field_changed_to") ? null : form.conditionType,
        conditionOperator: (form.conditionType === "always" || form.conditionType === "compound" || form.conditionType === "field_changed_to") ? null : "eq",
        conditionValue: (form.conditionType === "always" || form.conditionType === "compound" || form.conditionType === "field_changed_to") ? null : (form.conditionType === "country" ? form.conditionCountry : null),
        conditionJson: form.conditionType === "compound" && form.conditionRules.length > 0
          ? JSON.stringify({ logic: form.conditionLogic, rules: form.conditionRules })
          : form.conditionType === "field_changed_to" && form.fieldChangedKey
          ? JSON.stringify({ __type: "field_changed_to", field: form.fieldChangedKey, op: "eq", value: form.fieldChangedValue })
          : null,
        webhookTarget: form.webhookTarget || null,
        taskGroupId: form.taskGroupId || null,
        assignNotify: form.assignNotify,
        assignNotifyChannels: form.assignNotify ? form.assignNotifyChannels : [],
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
  const needsEmail = ["send_email_group", "notify_email"].includes(form.actionType);
  const needsNotifyEmail = form.actionType === "notify_email";

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
                            {g.isBackOffice && <span className="ml-1 text-[8px] font-bold px-1 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 uppercase tracking-wide shrink-0">{sl("boTag", locale)}</span>}
                          </div>
                        </SelectItem>
                      ))}
                      <div className="px-2 py-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider border-t mt-0.5">{sl("tgRolesHeader", locale)}</div>
                    </>
                  )}
                  {taskGroupsList.length === 0 && (
                    <div className="px-2 py-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{sl("tgRolesHeader", locale)}</div>
                  )}
                  {roleChoices.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={form.targetRole} onValueChange={v => setForm(f => ({ ...f, targetRole: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roleChoices.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {form.actionType === "assign_task" && (() => {
              const selG = taskGroupsList.find((g: any) => g.id === form.taskGroupId);
              return selG?.isBackOffice ? (
                <p className="mt-1 text-[10px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <Info className="h-3 w-3 shrink-0" />{sl("boRouteHint", locale)}
                </p>
              ) : null;
            })()}
          </div>
        )}

        {needsTask && (
          <>
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">{sl("taskDescLbl", locale)}</Label>
              <div className="space-y-1 mb-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{sl("tplLabel", locale)}:</span>
                {TPL_ENTITY_ORDER.map(entity => {
                  const tpls = TASK_TEMPLATES.filter(t => t.entity === entity);
                  if (tpls.length === 0) return null;
                  return (
                    <div key={entity} className="flex flex-wrap items-center gap-1">
                      <span className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-wider min-w-[68px] mr-0.5">{TPL_ENTITY_LABELS[entity][tplLocale(locale)]}</span>
                      {tpls.map(tpl => (
                        <button
                          key={tpl.id}
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 cursor-pointer transition-colors"
                          onClick={() => {
                            setForm(f => ({ ...f, taskDescription: buildTemplateBody(tpl, locale) }));
                            requestAnimationFrame(() => taskDescRef.current?.focus());
                          }}
                          title={sl("tplHint", locale)}
                          data-testid={`btn-task-template-${tpl.id}`}
                        >
                          <FileText className="h-3 w-3" />
                          {getTemplateLabel(tpl, locale)}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-stretch">
                <Textarea
                  id="automation-task-desc"
                  ref={taskDescRef}
                  className="flex-1 min-w-0 text-xs min-h-[150px] resize-y"
                  value={form.taskDescription}
                  onChange={e => setForm(f => ({ ...f, taskDescription: e.target.value }))}
                  placeholder={sl("taskDescPh", locale)}
                />
                <div className="w-full sm:w-44 shrink-0 flex flex-col rounded-md border bg-muted/20 p-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 px-0.5">{sl("varPickerLbl", locale)}</span>
                  <div className="flex flex-col gap-1 overflow-y-auto">
                    {[
                      { token: "{{customer.name}}", fk: "customerName" },
                      { token: "{{customer.phone}}", fk: "phone" },
                      { token: "{{customer.id}}", fk: "customerId" },
                      { token: "{{campaign.name}}", fk: "campaign" },
                      { token: "{{agent.name}}", fk: "agent" },
                      { token: "{{hospital.name}}", fk: "hospital" },
                      { token: "{{clinic.name}}", fk: "clinic" },
                    ].map(({ token, fk }) => (
                      <button
                        key={token}
                        type="button"
                        className="inline-flex items-center gap-0.5 rounded border border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/40 px-1.5 py-0.5 text-[10px] text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 font-mono cursor-pointer justify-start text-left"
                        onClick={() => {
                          const el = taskDescRef.current;
                          if (el) {
                            const start = el.selectionStart ?? el.value.length;
                            const end = el.selectionEnd ?? el.value.length;
                            const before = el.value.slice(0, start);
                            const after = el.value.slice(end);
                            const newVal = before + token + after;
                            setForm(f => ({ ...f, taskDescription: newVal }));
                            requestAnimationFrame(() => {
                              el.selectionStart = el.selectionEnd = start + token.length;
                              el.focus();
                            });
                          } else {
                            setForm(f => ({ ...f, taskDescription: f.taskDescription + token }));
                          }
                        }}
                        title={token}
                      >
                        {TPL_FIELD_LABELS[fk][tplLocale(locale)]}
                      </button>
                    ))}
                  </div>
                </div>
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
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex flex-col">
                        <span>{sl(opt.slKey, locale)}</span>
                        <span className="text-[10px] text-muted-foreground">{locale === "sk" ? opt.descSk : opt.descEn}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(() => {
                const p = PRIORITY_OPTIONS.find(o => o.value === form.taskPriority);
                return p ? <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{locale === "sk" ? p.descSk : p.descEn}</p> : null;
              })()}
            </div>
            <div className="col-span-2 rounded-md border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input accent-amber-600 cursor-pointer"
                  checked={form.assignNotify}
                  onChange={e => setForm(f => ({ ...f, assignNotify: e.target.checked }))}
                  data-testid="checkbox-assign-notify"
                />
                <span className="text-xs font-medium flex items-center gap-1.5">
                  <Bell className="h-3.5 w-3.5 text-amber-600" />
                  {sl("notifyAssignLbl", locale)}
                </span>
              </label>
              {form.assignNotify && (
                <div className="mt-2 pl-6">
                  <p className="text-[10px] text-muted-foreground mb-1.5">{sl("notifyAssignHint", locale)}</p>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{sl("channelsLbl", locale)}</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {([
                      { key: "push", icon: Bell, label: sl("channelPush", locale) },
                      { key: "email", icon: Mail, label: sl("channelEmail", locale) },
                      { key: "sms", icon: MessageSquare, label: sl("channelSms", locale) },
                    ] as const).map(({ key, icon: Icon, label }) => {
                      const active = form.assignNotifyChannels.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setForm(f => ({
                            ...f,
                            assignNotifyChannels: active
                              ? f.assignNotifyChannels.filter(c => c !== key)
                              : [...f.assignNotifyChannels, key],
                          }))}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            active
                              ? "border-amber-400 bg-amber-100 text-amber-800 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-200"
                              : "border-input bg-background text-muted-foreground hover:bg-muted"
                          }`}
                          data-testid={`chip-channel-${key}`}
                        >
                          <Icon className="h-3 w-3" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {needsEmail && (
          <div className="col-span-2 space-y-2">
            {/* notify_email: recipient addresses come FIRST */}
            {needsNotifyEmail && (
              <div>
                <Label className="text-xs mb-1 block">{sl("extEmailRecipientsLbl", locale)}</Label>
                <Textarea
                  value={form.emailRecipients}
                  onChange={e => setForm(f => ({ ...f, emailRecipients: e.target.value }))}
                  placeholder={sl("extEmailRecipientsPh", locale)}
                  className="text-xs min-h-[60px] font-mono"
                  data-testid="textarea-email-recipients"
                />
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{sl("extEmailRecipientsHelp", locale)}</p>
              </div>
            )}

            {/* Category picker (shows only when categories are available) */}
            {(emailCategories as any[]).filter((c: any) => c.isActive !== false).length > 0 && (
              <div>
                <Label className="text-xs mb-1 block">{sl("emailCategoryLbl", locale)}</Label>
                <Select
                  value={form.emailCategoryId || "__all__"}
                  onValueChange={v => setForm(f => ({ ...f, emailCategoryId: v === "__all__" ? "" : v, emailTemplateId: "" }))}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid="select-email-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{sl("selectCategory", locale)}</SelectItem>
                    {(emailCategories as any[]).filter((c: any) => c.isActive !== false).map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Template picker (filtered by category if selected) */}
            <div>
              <Label className="text-xs mb-1 block">{sl("emailTemplate", locale)}</Label>
              <Select value={form.emailTemplateId} onValueChange={v => setForm(f => ({ ...f, emailTemplateId: v }))}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-email-template">
                  <SelectValue placeholder={sl("selectEmail", locale)} />
                </SelectTrigger>
                <SelectContent>
                  {(form.emailCategoryId
                    ? (emailTemplates as any[]).filter((t: any) => String(t.categoryId) === form.emailCategoryId)
                    : (emailTemplates as any[])
                  ).map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name || t.subject || String(t.id)}</SelectItem>
                  ))}
                  {emailTemplates.length === 0 && (
                    <SelectItem value="__none__" disabled>{sl("noEmailTpls", locale)}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* send_email_group: optional extra fixed recipients after template */}
            {!needsNotifyEmail && (
              <div>
                <Label className="text-xs mb-1 block">{sl("emailRecipientsLbl", locale)}</Label>
                <Textarea
                  value={form.emailRecipients}
                  onChange={e => setForm(f => ({ ...f, emailRecipients: e.target.value }))}
                  placeholder={sl("emailRecipientsPh", locale)}
                  className="text-xs min-h-[60px] font-mono"
                  data-testid="textarea-email-recipients"
                />
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{sl("emailRecipientsHelp", locale)}</p>
              </div>
            )}
          </div>
        )}

        {form.actionType === "set_callback" && (
          <div className="col-span-2">
            <Label className="text-xs mb-1 block">{sl("callbackOffsetLbl", locale)}</Label>
            <Input
              type="number"
              min={0}
              value={form.callbackOffsetDays}
              onChange={e => setForm(f => ({ ...f, callbackOffsetDays: e.target.value }))}
              className="h-8 text-xs w-32"
              data-testid="input-callback-offset"
            />
            <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{sl("callbackOffsetHelp", locale)}</p>
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

            {isCallbackDisp && (
              <div className="mt-3 space-y-3 rounded-md border border-violet-200 dark:border-violet-800/50 bg-violet-50/50 dark:bg-violet-950/20 p-2.5">
                <div className="flex flex-wrap gap-3">
                  <div>
                    <Label className="text-xs mb-1 block">{sl("callbackOffsetLbl", locale)}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.callbackOffsetDays}
                      onChange={e => setForm(f => ({ ...f, callbackOffsetDays: e.target.value }))}
                      className="h-8 text-xs w-28"
                      data-testid="input-status-callback-offset"
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">{sl("callbackTimeLbl", locale)}</Label>
                    <Input
                      type="time"
                      value={form.callbackTime}
                      onChange={e => setForm(f => ({ ...f, callbackTime: e.target.value }))}
                      className="h-8 text-xs w-28"
                      data-testid="input-status-callback-time"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">{sl("statusCallbackHelp", locale)}</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input accent-violet-600 cursor-pointer"
                    checked={form.notifyAgentPulse}
                    onChange={e => setForm(f => ({ ...f, notifyAgentPulse: e.target.checked }))}
                    data-testid="checkbox-notify-pulse"
                  />
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    <Bell className="h-3.5 w-3.5 text-violet-600" />
                    {sl("notifyPulseLbl", locale)}
                  </span>
                </label>
                {form.notifyAgentPulse && (
                  <p className="text-[10px] text-muted-foreground pl-6 leading-snug">{sl("notifyPulseHint", locale)}</p>
                )}
              </div>
            )}
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
            <SelectItem value="field_changed_to">{sl("condFieldChanged", locale)}</SelectItem>
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

        {/* Field Changed To condition */}
        {form.conditionType === "field_changed_to" && (
          <div className="space-y-2 rounded-md border border-blue-200/60 dark:border-blue-800/40 bg-blue-50/30 dark:bg-blue-950/10 p-2">
            <p className="text-[10px] text-blue-700 dark:text-blue-400 font-medium">{sl("condFieldChanged", locale)} — {locale === "sk" ? "Podmienka je splnená ak má kontakt aktuálne nastavenú túto hodnotu poľa." : "Condition is met when the contact currently has this field value set."}</p>
            <div className="grid grid-cols-2 gap-1">
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">{sl("fctFieldLbl", locale)}</Label>
                <Select value={form.fieldChangedKey} onValueChange={v => setForm(f => ({ ...f, fieldChangedKey: v, fieldChangedValue: "" }))}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONDITION_FIELDS.filter(fd => ["contact", "campaign"].includes(fd.category)).map(fd => (
                      <SelectItem key={fd.key} value={fd.key}>{locale === "sk" ? fd.labelSk : fd.labelEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">{sl("fctValueLbl", locale)}</Label>
                {(() => {
                  const def = CONDITION_FIELDS.find(f => f.key === form.fieldChangedKey);
                  if (form.fieldChangedKey === "contact.hospital_id") {
                    return (
                      <Select value={form.fieldChangedValue} onValueChange={v => setForm(f => ({ ...f, fieldChangedValue: v }))}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={sl("fctHospitalPh", locale)} /></SelectTrigger>
                        <SelectContent>
                          {(hospitalsList as any[]).map((h: any) => (
                            <SelectItem key={h.id} value={String(h.id)} className="text-xs">{h.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  }
                  if (form.fieldChangedKey === "contact.clinic_id") {
                    return (
                      <Select value={form.fieldChangedValue} onValueChange={v => setForm(f => ({ ...f, fieldChangedValue: v }))}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={sl("fctClinicPh", locale)} /></SelectTrigger>
                        <SelectContent>
                          {(clinicsList as any[]).map((c: any) => (
                            <SelectItem key={c.id} value={String(c.id)} className="text-xs">{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  }
                  if (def?.valueType === "select" && def.options) {
                    return (
                      <Select value={form.fieldChangedValue} onValueChange={v => setForm(f => ({ ...f, fieldChangedValue: v }))}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {def.options.map(o => (
                            <SelectItem key={o.value} value={o.value}>{locale === "sk" ? o.labelSk : o.labelEn}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  }
                  if (def?.valueType === "bool") {
                    return (
                      <Select value={form.fieldChangedValue} onValueChange={v => setForm(f => ({ ...f, fieldChangedValue: v }))}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">{locale === "sk" ? "Áno" : "Yes"}</SelectItem>
                          <SelectItem value="false">{locale === "sk" ? "Nie" : "No"}</SelectItem>
                        </SelectContent>
                      </Select>
                    );
                  }
                  return (
                    <Input
                      className="h-7 text-xs"
                      value={form.fieldChangedValue}
                      onChange={e => setForm(f => ({ ...f, fieldChangedValue: e.target.value }))}
                      placeholder={sl("fctValuePh", locale)}
                    />
                  );
                })()}
              </div>
            </div>
          </div>
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
            {(["OR", "AND", "ONE"] as const).map(op => (
              <button
                key={op}
                type="button"
                onClick={() => setForm(f => ({ ...f, logicOperator: op }))}
                className={`flex-1 text-xs font-bold rounded border transition-colors ${
                  form.logicOperator === op
                    ? op === "OR"
                      ? "bg-blue-500 text-white border-blue-500"
                      : op === "AND"
                        ? "bg-purple-500 text-white border-purple-500"
                        : "bg-orange-500 text-white border-orange-500"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                }`}
                title={op === "ONE" ? sl("qLogicOne", locale) : op}
              >
                {op === "ONE" ? "1×" : op}
              </button>
            ))}
          </div>
          {form.logicOperator === "ONE" && (
            <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-1">{sl("qLogicOne", locale)}</p>
          )}
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
  item, campaignId, allItems, onDeleted, isSelected, onToggleSelect,
}: {
  item: StatusListItem;
  campaignId: string;
  allItems: StatusListItem[];
  onDeleted: () => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
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

  const { data: taskGroupsList = [] } = useQuery<any[]>({
    queryKey: ["/api/task-groups"],
  });

  const [form, setForm] = useState({
    stepId: item.stepId,
    label: item.label,
    description: item.description || "",
    confirmationType: item.confirmationType,
    required: item.required,
    nextStepId: item.nextStepId || "",
    restrictions: item.restrictions || "",
    isHidden: item.isHidden ?? false,
    autoConfirmOnSubQuestion: item.autoConfirmOnSubQuestion ?? false,
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

  const quickHideMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/campaigns/${campaignId}/status-list/${item.id}`, { isHidden: !item.isHidden }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] }),
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
        {onToggleSelect && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onToggleSelect(); }}
            className={`shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${isSelected ? "bg-primary border-primary" : "border-border opacity-0 group-hover:opacity-100"}`}
            data-testid={`chk-select-item-${item.id}`}
          >
            {isSelected && <Check className="h-2 w-2 text-primary-foreground" />}
          </button>
        )}
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 cursor-grab" />
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">{item.stepId}</span>
          <ConfirmIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className={`text-sm font-medium truncate ${item.isHidden ? "text-muted-foreground/60 italic" : ""}`}>{item.label}</span>
          {item.required && <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 shrink-0">{sl("requiredBadge", locale)}</Badge>}
          {item.isHidden && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0 gap-0.5"><EyeOff className="h-2.5 w-2.5" />{sl("itemHiddenBadge", locale)}</Badge>}
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`h-6 w-6 p-0 transition-opacity ${item.isHidden ? "opacity-100 text-muted-foreground" : "opacity-0 group-hover:opacity-100"}`}
            onClick={() => quickHideMutation.mutate()}
            title={item.isHidden ? "Zobraziť pre agenta" : "Skryť pre agenta"}
            data-testid={`btn-toggle-hide-${item.id}`}
          >
            {quickHideMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : item.isHidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </Button>
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
                  <Select value={form.nextStepId || "__none__"} onValueChange={v => setForm(f => ({ ...f, nextStepId: v === "__none__" ? "" : v }))}>
                    <SelectTrigger className="h-8 text-xs font-mono"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {allItems.filter(i => i.id !== item.id && i.itemType !== "option" && !i.isHidden).map(i => (
                        <SelectItem key={i.id} value={i.stepId || i.id}>
                          <span className="font-mono text-muted-foreground mr-1.5">{i.stepId}</span>
                          <span className="truncate">{i.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <div className="flex items-center gap-2 pt-4">
                  <Switch checked={!!form.isHidden} onCheckedChange={v => setForm(f => ({ ...f, isHidden: v }))} data-testid="switch-item-hidden" />
                  <Label className="text-xs" title={sl("itemHiddenHint", locale)}>{sl("itemHiddenLbl", locale)}</Label>
                </div>
                <div className="flex items-center gap-2 pt-4" title={sl("autoConfirmSubHint", locale)}>
                  <Switch checked={!!form.autoConfirmOnSubQuestion} onCheckedChange={v => setForm(f => ({ ...f, autoConfirmOnSubQuestion: v }))} data-testid="switch-auto-confirm-sub" />
                  <Label className="text-xs">{sl("autoConfirmSubLbl", locale)}</Label>
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
                        {(auto as any).taskGroupId ? (() => { const g = taskGroupsList.find((g: any) => g.id === (auto as any).taskGroupId); const alias = g?.displayAlias || g?.name || "Skupina"; const full = g?.name; return (<span title={full && full !== alias ? full : undefined} className="text-muted-foreground font-medium text-blue-600 dark:text-blue-400 cursor-default">→ 👥 {alias}</span>); })() : auto.targetRole ? (
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
                              : gqs[0].logicOperator === "ONE"
                                ? "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300"
                                : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                          }`}>{gqs[0].logicOperator === "ONE" ? "1×" : gqs[0].logicOperator}</span>
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
                                          {(auto as any).taskGroupId ? (() => { const g = taskGroupsList.find((g: any) => g.id === (auto as any).taskGroupId); const alias = g?.displayAlias || g?.name || "Skupina"; const full = g?.name; return (<span title={full && full !== alias ? full : undefined} className="text-[10px] font-medium text-blue-600 dark:text-blue-400 cursor-default">→ 👥 {alias}</span>); })() : auto.targetRole ? (
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
  campaignId, existingCount, allItems, onSaved, onCancel,
}: {
  campaignId: string;
  existingCount: number;
  allItems: StatusListItem[];
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
    autoConfirmOnSubQuestion: false,
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
          <Select value={form.nextStepId || "__none__"} onValueChange={v => setForm(f => ({ ...f, nextStepId: v === "__none__" ? "" : v }))}>
            <SelectTrigger className="h-8 text-xs font-mono"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {allItems.filter(i => i.itemType !== "option" && !i.isHidden).map(i => (
                <SelectItem key={i.id} value={i.stepId || i.id}>
                  <span className="font-mono text-muted-foreground mr-1.5">{i.stepId}</span>
                  <span className="truncate">{i.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        <div className="flex items-center gap-2 pt-4" title={sl("autoConfirmSubHint", locale)}>
          <Switch checked={form.autoConfirmOnSubQuestion} onCheckedChange={v => setForm(f => ({ ...f, autoConfirmOnSubQuestion: v }))} data-testid="switch-add-auto-confirm-sub" />
          <Label className="text-xs">{sl("autoConfirmSubLbl", locale)}</Label>
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

const OPTION_COLORS = [
  { value: "#ef4444" }, { value: "#f97316" }, { value: "#eab308" }, { value: "#22c55e" },
  { value: "#3b82f6" }, { value: "#8b5cf6" }, { value: "#ec4899" }, { value: "#6b7280" },
];

function AddOptionForm({ campaignId, existingCount, onSaved, onCancel }: {
  campaignId: string;
  existingCount: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const { locale } = useI18n();
  const [form, setForm] = useState({ label: "", color: "#3b82f6", description: "" });

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/campaigns/${campaignId}/status-list`, {
      stepId: `OPT-${String(existingCount + 1).padStart(2, "0")}`,
      label: form.label,
      description: form.description || null,
      confirmationType: "checkbox",
      required: false,
      sortOrder: 1000 + existingCount,
      itemType: "option",
      color: form.color,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      toast({ title: "Možnosť pridaná" });
      onSaved();
    },
    onError: () => toast({ title: sl("saveErr", locale), variant: "destructive" }),
  });

  return (
    <div className="border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-lg p-3 space-y-2 bg-amber-50/50 dark:bg-amber-950/20 mb-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label className="text-xs mb-1 block">Názov možnosti *</Label>
          <Input
            className="h-8 text-xs"
            value={form.label}
            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            placeholder="napr. Nezáujem, Callback, Záujem..."
            autoFocus
            data-testid="input-option-label"
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Popis (voliteľné)</Label>
          <Input
            className="h-8 text-xs"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Krátky popis..."
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Farba tlačidla</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {OPTION_COLORS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, color: c.value }))}
                className={`w-5 h-5 rounded-full border-2 transition-all ${form.color === c.value ? "border-foreground scale-110" : "border-transparent hover:border-muted-foreground/40"}`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>Náhľad:</span>
          <span className="px-2 py-0.5 rounded text-white text-[11px] font-semibold" style={{ backgroundColor: form.color }}>
            {form.label || "Možnosť"}
          </span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
            <X className="h-3 w-3 mr-1" /> Zrušiť
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs text-white"
            style={{ backgroundColor: form.color }}
            onClick={() => addMutation.mutate()}
            disabled={addMutation.isPending || !form.label.trim()}
            data-testid="btn-confirm-add-option"
          >
            {addMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
            Pridať možnosť
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CampaignStatusListBuilder({ campaignId }: { campaignId: string }) {
  const { toast } = useToast();
  const { locale } = useI18n();
  const [addingItem, setAddingItem] = useState(false);
  const [addingOption, setAddingOption] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateTab, setTemplateTab] = useState<"CLA" | "CLB" | "MPN">("CLA");
  const [importOpen, setImportOpen] = useState(false);
  const [selectedSteps, setSelectedSteps] = useState<Set<string>>(new Set());
  const [selectedAutos, setSelectedAutos] = useState<Map<string, Set<string>>>(new Map());
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [templateProgress, setTemplateProgress] = useState<string | null>(null);
  const [selectedDisps, setSelectedDisps] = useState<Set<string>>(new Set());
  const [previewMode, setPreviewMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());

  const { data: items = [], isLoading } = useQuery<StatusListItem[]>({
    queryKey: ["/api/campaigns", campaignId, "status-list"],
    queryFn: () => fetch(`/api/campaigns/${campaignId}/status-list`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error(`Request failed: ${r.status}`); return r.json(); }),
  });

  const { data: dispositions = [], isLoading: dispsLoading } = useQuery<any[]>({
    queryKey: ["/api/campaigns", campaignId, "dispositions"],
    queryFn: () => fetch(`/api/campaigns/${campaignId}/dispositions`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error(`Request failed: ${r.status}`); return r.json(); }),
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

  const activeTemplate = templateTab === "CLA" ? CLA_TEMPLATE : templateTab === "CLB" ? CLB_TEMPLATE : MPN_TEMPLATE;

  const selectedStepCount = selectedSteps.size;
  const selectedAutoCount = Array.from(selectedAutos.entries())
    .filter(([sid]) => selectedSteps.has(sid))
    .reduce((sum, [, aset]) => sum + aset.size, 0);

  const templateMutation = useMutation({
    mutationFn: async () => {
      const stepsToCreate = activeTemplate.filter(s => selectedSteps.has(s.stepId));
      // Sort: parents before children so parentId lookup works
      const sorted = [...stepsToCreate].sort((a, b) => {
        if (!a.parentStepId && b.parentStepId) return -1;
        if (a.parentStepId && !b.parentStepId) return 1;
        return 0;
      });
      const base = items.length;
      const createdIdMap = new Map<string, string>(); // stepId → DB id
      setTemplateProgress(null);
      for (let i = 0; i < sorted.length; i++) {
        const step = sorted[i];
        setTemplateProgress(`${sl("applyTplBtn", locale)} ${i + 1}/${sorted.length}: ${step.stepId}…`);
        const stepDesc = getStepDescription(step, locale);
        const condPart = step.conditionIf && step.conditionIf !== "—" ? `IF: ${step.conditionIf}` : "";
        const thenPart = step.actionThen && step.actionThen !== "—" ? `THEN: ${step.actionThen}` : "";
        const timePart = step.callbackTiming && step.callbackTiming !== "—" ? `⏱ ${step.callbackTiming}` : "";
        const parentId = step.parentStepId ? (createdIdMap.get(step.parentStepId) ?? null) : null;
        const res = await apiRequest("POST", `/api/campaigns/${campaignId}/status-list`, {
          stepId: step.stepId,
          label: getStepLabel(step, locale),
          description: [stepDesc, condPart, thenPart, timePart].filter(Boolean).join("\n"),
          confirmationType: step.confirmationType,
          required: false,
          sortOrder: base + i,
          nextStepId: step.nextStepId && step.nextStepId !== "—" ? step.nextStepId : null,
          restrictions: step.restrictions || null,
          isHidden: step.isHidden ?? false,
          parentId: parentId || null,
        });
        const created = await res.json();
        const itemId = created.id;
        if (!itemId) continue;
        createdIdMap.set(step.stepId, String(itemId));

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

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(bulkSelectedIds);
      for (const id of ids) {
        await apiRequest("DELETE", `/api/campaigns/${campaignId}/status-list/${id}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      const count = bulkSelectedIds.size;
      setBulkSelectedIds(new Set());
      toast({ title: `🗑 ${sl("deleteSelectedBtn", locale)} (${count})` });
    },
    onError: () => toast({ title: sl("saveErr", locale), variant: "destructive" }),
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
        <div className="ml-auto flex items-center gap-2">
          {bulkSelectedIds.size > 0 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={bulkDeleteMutation.isPending}
              onClick={() => {
                if (window.confirm(`${sl("deleteSelectedBtn", locale)} (${bulkSelectedIds.size})?`)) bulkDeleteMutation.mutate();
              }}
              data-testid="btn-delete-selected-items"
            >
              {bulkDeleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              {sl("deleteSelectedBtn", locale)} ({bulkSelectedIds.size})
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setAddingItem(true)} disabled={addingItem} data-testid="btn-add-status-list-item">
            <Plus className="h-3 w-3" /> {sl("addStepBtn", locale)}
          </Button>
        </div>
      </div>

      {addingItem && (
        <AddItemForm
          campaignId={campaignId}
          existingCount={items.length}
          allItems={items}
          onSaved={() => setAddingItem(false)}
          onCancel={() => setAddingItem(false)}
        />
      )}

      {previewMode ? (
        <StatusListPreview items={items} locale={locale} />
      ) : (
        <>
          <div className="space-y-1.5">
            {(() => {
              const nonOptions = items.filter(i => i.itemType !== "option");
              const roots = nonOptions.filter(i => !i.parentId);
              const childrenOf = (parentId: string) => nonOptions.filter(i => i.parentId === parentId);
              return roots.map(item => (
                <div key={item.id}>
                  <StatusListItemRow
                    item={item}
                    campaignId={campaignId}
                    allItems={items}
                    onDeleted={() => {}}
                    isSelected={bulkSelectedIds.has(String(item.id))}
                    onToggleSelect={() => setBulkSelectedIds(prev => {
                      const next = new Set(prev);
                      if (next.has(String(item.id))) next.delete(String(item.id)); else next.add(String(item.id));
                      return next;
                    })}
                  />
                  {childrenOf(item.id).length > 0 && (
                    <div className="ml-6 mt-1 space-y-1 pl-3 border-l-2 border-dashed border-border">
                      {childrenOf(item.id).map(child => (
                        <StatusListItemRow
                          key={child.id}
                          item={child}
                          campaignId={campaignId}
                          allItems={items}
                          onDeleted={() => {}}
                          isSelected={bulkSelectedIds.has(String(child.id))}
                          onToggleSelect={() => setBulkSelectedIds(prev => {
                            const next = new Set(prev);
                            if (next.has(String(child.id))) next.delete(String(child.id)); else next.add(String(child.id));
                            return next;
                          })}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ));
            })()}
          </div>

          <div className="mt-5 pt-4 border-t border-dashed border-amber-300 dark:border-amber-700">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-foreground">Quick Options</span>
                <span className="text-[10px] text-muted-foreground ml-1">(náhrada dispozícií v Status List móde agenta)</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                onClick={() => setAddingOption(true)}
                disabled={addingOption}
                data-testid="btn-add-status-list-option"
              >
                <Plus className="h-3 w-3" /> Pridať možnosť
              </Button>
            </div>
            {addingOption && (
              <AddOptionForm
                campaignId={campaignId}
                existingCount={items.filter(i => i.itemType === "option").length}
                onSaved={() => setAddingOption(false)}
                onCancel={() => setAddingOption(false)}
              />
            )}
            <div className="space-y-1.5">
              {items.filter(i => i.itemType === "option").map(item => (
                <StatusListItemRow
                  key={item.id}
                  item={item}
                  campaignId={campaignId}
                  allItems={items}
                  onDeleted={() => {}}
                  isSelected={bulkSelectedIds.has(String(item.id))}
                  onToggleSelect={() => setBulkSelectedIds(prev => {
                    const next = new Set(prev);
                    if (next.has(String(item.id))) next.delete(String(item.id)); else next.add(String(item.id));
                    return next;
                  })}
                />
              ))}
              {items.filter(i => i.itemType === "option").length === 0 && !addingOption && (
                <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg border-amber-200 dark:border-amber-800">
                  Žiadne možnosti. Pridajte aspoň jednu pre agentov v NexusPulse.
                </p>
              )}
            </div>
          </div>
        </>
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
            <button
              type="button"
              onClick={() => { setTemplateTab("MPN"); setSelectedSteps(new Set()); setSelectedAutos(new Map()); }}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${templateTab === "MPN" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              {sl("tplTabMPN", locale)}
            </button>
            <button
              type="button"
              onClick={() => {
                const allIds = activeTemplate.map(s => s.stepId);
                const allSelected = allIds.every(id => selectedSteps.has(id));
                if (allSelected) {
                  setSelectedSteps(new Set());
                  setSelectedAutos(new Map());
                } else {
                  setSelectedSteps(new Set(allIds));
                }
              }}
              className="ml-auto text-xs px-2.5 py-1.5 rounded-md font-medium text-primary hover:bg-primary/10 transition-colors"
              data-testid="btn-tpl-select-all"
            >
              {activeTemplate.every(s => selectedSteps.has(s.stepId)) ? sl("tplDeselectAll", locale) : sl("tplSelectAll", locale)}
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
              const isChild = !!step.parentStepId;
              const isRadio = step.confirmationType === "radio";

              return (
                <div key={step.stepId} className={`rounded-lg border transition-colors ${isChild ? "ml-6 border-dashed" : ""} ${isSelected ? "border-primary/30 bg-primary/5" : "border-border bg-background"}`}>
                  <div className="flex items-start gap-2 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleStep(step.stepId)}
                      className={`mt-0.5 w-4 h-4 rounded${isRadio ? "-full" : ""} border flex items-center justify-center shrink-0 transition-colors ${isSelected ? "bg-primary border-primary" : "border-border"}`}
                      data-testid={`tpl-step-${step.stepId}`}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-muted-foreground">{step.stepId}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${roleBadge.color}`}>{roleBadge.label}</span>
                        {isSys && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">AUTO</span>}
                        {step.isHidden && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-medium flex items-center gap-0.5"><EyeOff className="h-2.5 w-2.5" />HIDDEN</span>}
                        {isRadio && <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 font-medium">option</span>}
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
