import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Phone, Mail, Play, CheckCircle, ArrowRight, Trash2,
  Clock, Users, BarChart3, Pencil, Eye, ChevronRight, Layers, Target, Percent, RotateCcw, RefreshCw,
  Hand, Zap, BrainCircuit, Settings2, CalendarDays
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { CampaignPhase, CampaignContactPhase, CampaignDisposition } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";

const phasesT: Record<string, Record<string, string>> = {
  sk: {
    title: "Fázy kampane",
    addPhase: "Pridať fázu",
    noPhases: "Žiadne fázy. Vytvorte prvú fázu kampane.",
    phaseName: "Názov fázy",
    phaseType: "Typ",
    phone: "Telefón",
    email: "Email",
    draft: "Koncept",
    active: "Aktívna",
    completed: "Dokončená",
    evaluating: "Vyhodnocovanie",
    activate: "Aktivovať",
    evaluate: "Vyhodnotiť",
    transition: "Presunúť kontakty",
    delete: "Zmazať",
    edit: "Upraviť",
    contacts: "Kontakty",
    total: "Celkom",
    pending: "Čakajúce",
    inProgress: "Prebiehajúce",
    completedCount: "Dokončené",
    skipped: "Preskočené",
    results: "Výsledky",
    noContacts: "Žiadne kontakty v tejto fáze",
    createPhase: "Vytvoriť fázu",
    editPhase: "Upraviť fázu",
    tabGeneral: "Všeobecné",
    tabTargets: "Ciele",
    tabTransition: "Prechod",
    save: "Uložiť",
    cancel: "Zrušiť",
    phaseNumber: "Poradie",
    evaluationDate: "Dátum vyhodnotenia",
    transitionTitle: "Prechod kontaktov do ďalšej fázy",
    targetPhase: "Cieľová fáza",
    includeStatuses: "Zahrnúť statusy",
    excludeStatuses: "Vylúčiť statusy",
    clickToInclude: "Kliknite na status pre zahrnutie",
    clickToExclude: "Kliknite na status pre vylúčenie",
    loadingDispositions: "Načítavam statusy...",
    noDispositions: "Žiadne dispozície pre túto kampaň",
    transitioned: "presunutých",
    of: "z",
    phaseTimeline: "Timeline kontaktu",
    viewContacts: "Zobraziť kontakty",
    customer: "Zákazník",
    hospital: "Nemocnica",
    clinic: "Klinika",
    contactName: "Meno",
    contactResult: "Výsledok",
    contactStatus: "Stav",
    phase: "Fáza",
    enteredAt: "Vstup do fázy",
    completedAt: "Dokončené",
    targets: "Ciele",
    targetCalls: "Cieľ hovorov",
    targetEmails: "Cieľ emailov",
    targetConversions: "Cieľ konverzií",
    targetResponseRate: "Cieľ odozvy (%)",
    achieved: "Dosiahnuté",
    noTargets: "Žiadne ciele",
    resetPhase: "Resetovať fázu",
    resetPhaseConfirm: "Naozaj chcete resetovať túto fázu? Všetky kontakty budú vrátené do stavu čakajúce.",
    resetPhaseSuccess: "Fáza bola resetovaná",
    resetContact: "Resetovať kontakt",
    resetContactConfirm: "Naozaj chcete resetovať tento kontakt do stavu čakajúce?",
    resetContactSuccess: "Kontakt bol resetovaný",
    confirm: "Potvrdiť",
    syncContacts: "Synchronizovať kontakty",
    syncContactsDesc: "Odstráni neplatné a pridá nové kontakty z kampane",
    syncSuccess: "Synchronizácia dokončená",
    transitionRulesTitle: "Pravidlá prechodu",
    transitionRulesDesc: "Nastavte, ako sa kontakty presúvajú do ďalšej fázy.",
    transitionMode: "Režim",
    manual: "Manuálny",
    manualDesc: "Kontakty presúvate do ďalšej fázy ručne cez dialóg prechodu.",
    automatic: "Automatický",
    automaticDesc: "Kontakty sa presúvajú automaticky podľa pravidiel: max pokusov, dni od posledného pokusu a filtre dispozícií.",
    aiAssisted: "AI asistovaný",
    aiAssistedDesc: "AI analyzuje históriu kontaktu (hovory, emaily, dispozície, poznámky) a odporučí, či kontakt presunúť alebo ponechať. Návrhy AI skontrolujete a potvrdíte pred presunom.",
    selectTargetPhase: "Vyberte cieľovú fázu...",
    autoSchedule: "Plán spúšťania",
    selectSchedule: "Vyberte...",
    hourly: "Každú hodinu",
    daily: "Denne",
    weekly: "Týždenne",
    maxAttempts: "Max pokusov",
    maxAttemptsHint: "Presunúť po N pokusoch",
    daysSinceAttempt: "Dní od posledného pokusu",
    daysSinceHint: "Presunúť ak neaktívny N dní",
    moveDispositions: "Presunúť tieto dispozície →",
    keepDispositions: "Ponechať v aktuálnej fáze ✋",
    runAutoTransition: "Spustiť auto-prechod",
    autoTransitionRun: "Auto-prechod",
    evaluated: "vyhodnotených",
  },
  en: {
    title: "Campaign Phases",
    addPhase: "Add Phase",
    noPhases: "No phases. Create the first campaign phase.",
    phaseName: "Phase Name",
    phaseType: "Type",
    phone: "Phone",
    email: "Email",
    draft: "Draft",
    active: "Active",
    completed: "Completed",
    evaluating: "Evaluating",
    activate: "Activate",
    evaluate: "Evaluate",
    transition: "Transition Contacts",
    delete: "Delete",
    edit: "Edit",
    contacts: "Contacts",
    total: "Total",
    pending: "Pending",
    inProgress: "In Progress",
    completedCount: "Completed",
    skipped: "Skipped",
    results: "Results",
    noContacts: "No contacts in this phase",
    createPhase: "Create Phase",
    editPhase: "Edit Phase",
    tabGeneral: "General",
    tabTargets: "Targets",
    tabTransition: "Transition",
    save: "Save",
    cancel: "Cancel",
    phaseNumber: "Order",
    evaluationDate: "Evaluation Date",
    transitionTitle: "Transition contacts to next phase",
    targetPhase: "Target Phase",
    includeStatuses: "Include statuses",
    excludeStatuses: "Exclude statuses",
    clickToInclude: "Click a status to include",
    clickToExclude: "Click a status to exclude",
    loadingDispositions: "Loading statuses...",
    noDispositions: "No dispositions for this campaign",
    transitioned: "transitioned",
    of: "of",
    phaseTimeline: "Contact Timeline",
    viewContacts: "View Contacts",
    customer: "Customer",
    hospital: "Hospital",
    clinic: "Clinic",
    contactName: "Name",
    contactResult: "Result",
    contactStatus: "Status",
    phase: "Phase",
    enteredAt: "Entered Phase",
    completedAt: "Completed",
    targets: "Targets",
    targetCalls: "Target Calls",
    targetEmails: "Target Emails",
    targetConversions: "Target Conversions",
    targetResponseRate: "Target Response Rate (%)",
    achieved: "Achieved",
    noTargets: "No targets",
    resetPhase: "Reset Phase",
    resetPhaseConfirm: "Are you sure you want to reset this phase? All contacts will be set back to pending.",
    resetPhaseSuccess: "Phase has been reset",
    resetContact: "Reset Contact",
    resetContactConfirm: "Are you sure you want to reset this contact back to pending?",
    resetContactSuccess: "Contact has been reset",
    confirm: "Confirm",
    syncContacts: "Sync Contacts",
    syncContactsDesc: "Removes orphaned and adds new contacts from campaign",
    syncSuccess: "Sync completed",
    transitionRulesTitle: "Transition Rules",
    transitionRulesDesc: "Configure how contacts move to the next phase.",
    transitionMode: "Mode",
    manual: "Manual",
    manualDesc: "Contacts are moved to the next phase manually by the operator using the transition dialog.",
    automatic: "Automatic",
    automaticDesc: "Contacts are moved automatically based on rules: max attempts, days since last attempt, and disposition filters.",
    aiAssisted: "AI Assisted",
    aiAssistedDesc: "AI analyzes each contact's history (calls, emails, dispositions, notes) and recommends whether to move or keep them. You review and confirm the AI's suggestions before transition.",
    selectTargetPhase: "Select target phase...",
    autoSchedule: "Run Schedule",
    selectSchedule: "Select...",
    hourly: "Hourly",
    daily: "Daily",
    weekly: "Weekly",
    maxAttempts: "Max Attempts",
    maxAttemptsHint: "Move after N attempts",
    daysSinceAttempt: "Days Since Last Attempt",
    daysSinceHint: "Move if inactive for N days",
    moveDispositions: "Move these dispositions →",
    keepDispositions: "Keep in current phase ✋",
    runAutoTransition: "Run Auto-Transition",
    autoTransitionRun: "Auto-Transition",
    evaluated: "evaluated",
  },
  cs: {
    title: "Fáze kampaně",
    addPhase: "Přidat fázi",
    noPhases: "Žádné fáze. Vytvořte první fázi kampaně.",
    phaseName: "Název fáze",
    phaseType: "Typ",
    phone: "Telefon",
    email: "Email",
    draft: "Koncept",
    active: "Aktivní",
    completed: "Dokončená",
    evaluating: "Vyhodnocování",
    activate: "Aktivovat",
    evaluate: "Vyhodnotit",
    transition: "Přesunout kontakty",
    delete: "Smazat",
    edit: "Upravit",
    contacts: "Kontakty",
    total: "Celkem",
    pending: "Čekající",
    inProgress: "Probíhající",
    completedCount: "Dokončené",
    skipped: "Přeskočené",
    results: "Výsledky",
    noContacts: "Žádné kontakty v této fázi",
    createPhase: "Vytvořit fázi",
    editPhase: "Upravit fázi",
    tabGeneral: "Obecné",
    tabTargets: "Cíle",
    tabTransition: "Přechod",
    save: "Uložit",
    cancel: "Zrušit",
    phaseNumber: "Pořadí",
    evaluationDate: "Datum vyhodnocení",
    transitionTitle: "Přechod kontaktů do další fáze",
    targetPhase: "Cílová fáze",
    includeStatuses: "Zahrnout statusy",
    excludeStatuses: "Vyloučit statusy",
    clickToInclude: "Klikněte na status pro zahrnutí",
    clickToExclude: "Klikněte na status pro vyloučení",
    loadingDispositions: "Načítám statusy...",
    noDispositions: "Žádné dispozice pro tuto kampaň",
    transitioned: "přesunutých",
    of: "z",
    phaseTimeline: "Timeline kontaktu",
    viewContacts: "Zobrazit kontakty",
    customer: "Zákazník",
    hospital: "Nemocnice",
    clinic: "Klinika",
    contactName: "Jméno",
    contactResult: "Výsledek",
    contactStatus: "Stav",
    phase: "Fáze",
    enteredAt: "Vstup do fáze",
    completedAt: "Dokončeno",
    targets: "Cíle",
    targetCalls: "Cíl hovorů",
    targetEmails: "Cíl emailů",
    targetConversions: "Cíl konverzí",
    targetResponseRate: "Cíl odezvy (%)",
    achieved: "Dosaženo",
    noTargets: "Žádné cíle",
    resetPhase: "Resetovat fázi",
    resetPhaseConfirm: "Opravdu chcete resetovat tuto fázi? Všechny kontakty budou vráceny do stavu čekající.",
    resetPhaseSuccess: "Fáze byla resetována",
    resetContact: "Resetovat kontakt",
    resetContactConfirm: "Opravdu chcete resetovat tento kontakt do stavu čekající?",
    resetContactSuccess: "Kontakt byl resetován",
    confirm: "Potvrdit",
    syncContacts: "Synchronizovat kontakty",
    syncContactsDesc: "Odstraní neplatné a přidá nové kontakty z kampaně",
    syncSuccess: "Synchronizace dokončena",
    transitionRulesTitle: "Pravidla přechodu",
    transitionRulesDesc: "Nastavte, jak se kontakty přesouvají do další fáze.",
    transitionMode: "Režim",
    manual: "Manuální",
    manualDesc: "Kontakty přesouváte do další fáze ručně přes dialog přechodu.",
    automatic: "Automatický",
    automaticDesc: "Kontakty se přesouvají automaticky podle pravidel: max pokusů, dny od posledního pokusu a filtry dispozic.",
    aiAssisted: "AI asistovaný",
    aiAssistedDesc: "AI analyzuje historii kontaktu (hovory, emaily, dispozice, poznámky) a doporučí, zda kontakt přesunout nebo ponechat. Návrhy AI zkontrolujete a potvrdíte před přesunem.",
    selectTargetPhase: "Vyberte cílovou fázi...",
    autoSchedule: "Plán spouštění",
    selectSchedule: "Vyberte...",
    hourly: "Každou hodinu",
    daily: "Denně",
    weekly: "Týdně",
    maxAttempts: "Max pokusů",
    maxAttemptsHint: "Přesunout po N pokusech",
    daysSinceAttempt: "Dní od posledního pokusu",
    daysSinceHint: "Přesunout pokud neaktivní N dní",
    moveDispositions: "Přesunout tyto dispozice →",
    keepDispositions: "Ponechat v aktuální fázi ✋",
    runAutoTransition: "Spustit auto-přechod",
    autoTransitionRun: "Auto-přechod",
    evaluated: "vyhodnocených",
  },
  hu: {
    title: "Kampányfázisok",
    addPhase: "Fázis hozzáadása",
    noPhases: "Nincsenek fázisok. Hozza létre az első kampányfázist.",
    phaseName: "Fázis neve",
    phaseType: "Típus",
    phone: "Telefon",
    email: "Email",
    draft: "Vázlat",
    active: "Aktív",
    completed: "Befejezett",
    evaluating: "Kiértékelés",
    activate: "Aktiválás",
    evaluate: "Kiértékelés",
    transition: "Kapcsolatok áthelyezése",
    delete: "Törlés",
    edit: "Szerkesztés",
    contacts: "Kapcsolatok",
    total: "Összesen",
    pending: "Függőben",
    inProgress: "Folyamatban",
    completedCount: "Befejezett",
    skipped: "Kihagyott",
    results: "Eredmények",
    noContacts: "Nincsenek kapcsolatok ebben a fázisban",
    createPhase: "Fázis létrehozása",
    editPhase: "Fázis szerkesztése",
    tabGeneral: "Általános",
    tabTargets: "Célok",
    tabTransition: "Átmenet",
    save: "Mentés",
    cancel: "Mégse",
    phaseNumber: "Sorrend",
    evaluationDate: "Kiértékelés dátuma",
    transitionTitle: "Kapcsolatok áthelyezése a következő fázisba",
    targetPhase: "Célfázis",
    includeStatuses: "Státuszok beépítése",
    excludeStatuses: "Státuszok kizárása",
    clickToInclude: "Kattintson a státuszra a beépítéshez",
    clickToExclude: "Kattintson a státuszra a kizáráshoz",
    loadingDispositions: "Státuszok betöltése...",
    noDispositions: "Nincsenek diszpozíciók ehhez a kampányhoz",
    transitioned: "áthelyezve",
    of: "/",
    phaseTimeline: "Kapcsolat idővonala",
    viewContacts: "Kapcsolatok megtekintése",
    customer: "Ügyfél",
    hospital: "Kórház",
    clinic: "Klinika",
    contactName: "Név",
    contactResult: "Eredmény",
    contactStatus: "Állapot",
    phase: "Fázis",
    enteredAt: "Belépés a fázisba",
    completedAt: "Befejezve",
    targets: "Célok",
    targetCalls: "Hívás cél",
    targetEmails: "Email cél",
    targetConversions: "Konverzió cél",
    targetResponseRate: "Válaszarány cél (%)",
    achieved: "Elért",
    noTargets: "Nincsenek célok",
    resetPhase: "Fázis visszaállítása",
    resetPhaseConfirm: "Biztosan vissza akarja állítani ezt a fázist? Minden kapcsolat visszakerül függőben állapotba.",
    resetPhaseSuccess: "A fázis visszaállítva",
    resetContact: "Kapcsolat visszaállítása",
    resetContactConfirm: "Biztosan vissza akarja állítani ezt a kapcsolatot függőben állapotba?",
    resetContactSuccess: "A kapcsolat visszaállítva",
    confirm: "Megerősítés",
    syncContacts: "Kapcsolatok szinkronizálása",
    syncContactsDesc: "Eltávolítja az érvénytelen és hozzáadja az új kapcsolatokat",
    syncSuccess: "Szinkronizálás kész",
    transitionRulesTitle: "Átmeneti szabályok",
    transitionRulesDesc: "Állítsa be, hogyan kerüljenek a kapcsolatok a következő fázisba.",
    transitionMode: "Mód",
    manual: "Manuális",
    manualDesc: "A kapcsolatokat manuálisan helyezi át a következő fázisba az átmenet dialóguson keresztül.",
    automatic: "Automatikus",
    automaticDesc: "A kapcsolatok automatikusan kerülnek át a szabályok alapján: max kísérletek, napok az utolsó kísérlet óta és diszpozíciós szűrők.",
    aiAssisted: "AI asszisztált",
    aiAssistedDesc: "Az AI elemzi a kapcsolat történetét (hívások, e-mailek, diszpozíciók, jegyzetek) és javaslatot tesz az áthelyezésre vagy megtartásra. Az AI javaslatait Ön ellenőrzi és hagyja jóvá.",
    selectTargetPhase: "Válassza ki a cél fázist...",
    autoSchedule: "Futtatási ütemezés",
    selectSchedule: "Válasszon...",
    hourly: "Óránként",
    daily: "Naponta",
    weekly: "Hetente",
    maxAttempts: "Max kísérletek",
    maxAttemptsHint: "Áthelyezés N kísérlet után",
    daysSinceAttempt: "Napok az utolsó kísérlet óta",
    daysSinceHint: "Áthelyezés ha N napja inaktív",
    moveDispositions: "Ezek áthelyezése →",
    keepDispositions: "Maradjon a jelenlegi fázisban ✋",
    runAutoTransition: "Auto-átmenet futtatása",
    autoTransitionRun: "Auto-átmenet",
    evaluated: "kiértékelve",
  },
  ro: {
    title: "Fazele campaniei",
    addPhase: "Adaugă fază",
    noPhases: "Nu există faze. Creați prima fază a campaniei.",
    phaseName: "Numele fazei",
    phaseType: "Tip",
    phone: "Telefon",
    email: "Email",
    draft: "Ciornă",
    active: "Activă",
    completed: "Finalizată",
    evaluating: "Evaluare",
    activate: "Activare",
    evaluate: "Evaluare",
    transition: "Mută contacte",
    delete: "Șterge",
    edit: "Editare",
    contacts: "Contacte",
    total: "Total",
    pending: "În așteptare",
    inProgress: "În curs",
    completedCount: "Finalizate",
    skipped: "Sărite",
    results: "Rezultate",
    noContacts: "Nu există contacte în această fază",
    createPhase: "Creează fază",
    editPhase: "Editează fază",
    tabGeneral: "General",
    tabTargets: "Obiective",
    tabTransition: "Tranziție",
    save: "Salvează",
    cancel: "Anulare",
    phaseNumber: "Ordine",
    evaluationDate: "Data evaluării",
    transitionTitle: "Tranziția contactelor în faza următoare",
    targetPhase: "Faza țintă",
    includeStatuses: "Include statusuri",
    excludeStatuses: "Exclude statusuri",
    clickToInclude: "Click pe status pentru includere",
    clickToExclude: "Click pe status pentru excludere",
    loadingDispositions: "Se încarcă statusurile...",
    noDispositions: "Nu există dispoziții pentru această campanie",
    transitioned: "mutate",
    of: "din",
    phaseTimeline: "Cronologia contactului",
    viewContacts: "Vezi contacte",
    customer: "Client",
    hospital: "Spital",
    clinic: "Clinică",
    contactName: "Nume",
    contactResult: "Rezultat",
    contactStatus: "Status",
    phase: "Fază",
    enteredAt: "Intrare în fază",
    completedAt: "Finalizat",
    targets: "Obiective",
    targetCalls: "Obiectiv apeluri",
    targetEmails: "Obiectiv emailuri",
    targetConversions: "Obiectiv conversii",
    targetResponseRate: "Obiectiv rată răspuns (%)",
    achieved: "Realizat",
    noTargets: "Nu există obiective",
    resetPhase: "Resetare fază",
    resetPhaseConfirm: "Sigur doriți să resetați această fază? Toate contactele vor fi readuse la starea în așteptare.",
    resetPhaseSuccess: "Faza a fost resetată",
    resetContact: "Resetare contact",
    resetContactConfirm: "Sigur doriți să resetați acest contact la starea în așteptare?",
    resetContactSuccess: "Contactul a fost resetat",
    confirm: "Confirmă",
    syncContacts: "Sincronizare contacte",
    syncContactsDesc: "Elimină contactele invalide și adaugă altele noi din campanie",
    syncSuccess: "Sincronizare completă",
    transitionRulesTitle: "Reguli de tranziție",
    transitionRulesDesc: "Configurați cum se mută contactele în faza următoare.",
    transitionMode: "Mod",
    manual: "Manual",
    manualDesc: "Contactele sunt mutate manual în faza următoare de operator prin dialogul de tranziție.",
    automatic: "Automat",
    automaticDesc: "Contactele sunt mutate automat pe baza regulilor: încercări maxime, zile de la ultima încercare și filtre de dispoziții.",
    aiAssisted: "AI asistat",
    aiAssistedDesc: "AI analizează istoricul contactului (apeluri, e-mailuri, dispoziții, note) și recomandă dacă să-l mute sau să-l păstreze. Verificați și confirmați sugestiile AI înainte de tranziție.",
    selectTargetPhase: "Selectați faza țintă...",
    autoSchedule: "Program de rulare",
    selectSchedule: "Selectați...",
    hourly: "La fiecare oră",
    daily: "Zilnic",
    weekly: "Săptămânal",
    maxAttempts: "Încercări maxime",
    maxAttemptsHint: "Mutare după N încercări",
    daysSinceAttempt: "Zile de la ultima încercare",
    daysSinceHint: "Mutare dacă inactiv N zile",
    moveDispositions: "Mută aceste dispoziții →",
    keepDispositions: "Păstrează în faza curentă ✋",
    runAutoTransition: "Rulează auto-tranziție",
    autoTransitionRun: "Auto-tranziție",
    evaluated: "evaluate",
  },
  it: {
    title: "Fasi della campagna",
    addPhase: "Aggiungi fase",
    noPhases: "Nessuna fase. Crea la prima fase della campagna.",
    phaseName: "Nome fase",
    phaseType: "Tipo",
    phone: "Telefono",
    email: "Email",
    draft: "Bozza",
    active: "Attiva",
    completed: "Completata",
    evaluating: "Valutazione",
    activate: "Attiva",
    evaluate: "Valuta",
    transition: "Sposta contatti",
    delete: "Elimina",
    edit: "Modifica",
    contacts: "Contatti",
    total: "Totale",
    pending: "In attesa",
    inProgress: "In corso",
    completedCount: "Completati",
    skipped: "Saltati",
    results: "Risultati",
    noContacts: "Nessun contatto in questa fase",
    createPhase: "Crea fase",
    editPhase: "Modifica fase",
    tabGeneral: "Generale",
    tabTargets: "Obiettivi",
    tabTransition: "Transizione",
    save: "Salva",
    cancel: "Annulla",
    phaseNumber: "Ordine",
    evaluationDate: "Data di valutazione",
    transitionTitle: "Transizione contatti alla fase successiva",
    targetPhase: "Fase obiettivo",
    includeStatuses: "Includi stati",
    excludeStatuses: "Escludi stati",
    clickToInclude: "Clicca su uno stato per includerlo",
    clickToExclude: "Clicca su uno stato per escluderlo",
    loadingDispositions: "Caricamento stati...",
    noDispositions: "Nessuna disposizione per questa campagna",
    transitioned: "trasferiti",
    of: "di",
    phaseTimeline: "Cronologia contatto",
    viewContacts: "Visualizza contatti",
    customer: "Cliente",
    hospital: "Ospedale",
    clinic: "Clinica",
    contactName: "Nome",
    contactResult: "Risultato",
    contactStatus: "Stato",
    phase: "Fase",
    enteredAt: "Entrata nella fase",
    completedAt: "Completato",
    targets: "Obiettivi",
    targetCalls: "Obiettivo chiamate",
    targetEmails: "Obiettivo email",
    targetConversions: "Obiettivo conversioni",
    targetResponseRate: "Obiettivo tasso risposta (%)",
    achieved: "Raggiunto",
    noTargets: "Nessun obiettivo",
    resetPhase: "Reimposta fase",
    resetPhaseConfirm: "Sei sicuro di voler reimpostare questa fase? Tutti i contatti torneranno in stato di attesa.",
    resetPhaseSuccess: "La fase è stata reimpostata",
    resetContact: "Reimposta contatto",
    resetContactConfirm: "Sei sicuro di voler reimpostare questo contatto allo stato di attesa?",
    resetContactSuccess: "Il contatto è stato reimpostato",
    confirm: "Conferma",
    syncContacts: "Sincronizza contatti",
    syncContactsDesc: "Rimuove i contatti non validi e aggiunge quelli nuovi dalla campagna",
    syncSuccess: "Sincronizzazione completata",
    transitionRulesTitle: "Regole di transizione",
    transitionRulesDesc: "Configura come i contatti passano alla fase successiva.",
    transitionMode: "Modalità",
    manual: "Manuale",
    manualDesc: "I contatti vengono spostati manualmente nella fase successiva dall'operatore tramite il dialogo di transizione.",
    automatic: "Automatico",
    automaticDesc: "I contatti vengono spostati automaticamente in base alle regole: tentativi massimi, giorni dall'ultimo tentativo e filtri delle disposizioni.",
    aiAssisted: "AI assistito",
    aiAssistedDesc: "L'AI analizza la storia del contatto (chiamate, email, disposizioni, note) e raccomanda se spostarlo o mantenerlo. Verifichi e confermi i suggerimenti dell'AI prima della transizione.",
    selectTargetPhase: "Seleziona la fase target...",
    autoSchedule: "Programma di esecuzione",
    selectSchedule: "Seleziona...",
    hourly: "Ogni ora",
    daily: "Giornaliero",
    weekly: "Settimanale",
    maxAttempts: "Tentativi massimi",
    maxAttemptsHint: "Sposta dopo N tentativi",
    daysSinceAttempt: "Giorni dall'ultimo tentativo",
    daysSinceHint: "Sposta se inattivo per N giorni",
    moveDispositions: "Sposta queste disposizioni →",
    keepDispositions: "Mantieni nella fase attuale ✋",
    runAutoTransition: "Esegui auto-transizione",
    autoTransitionRun: "Auto-transizione",
    evaluated: "valutati",
  },
  de: {
    title: "Kampagnenphasen",
    addPhase: "Phase hinzufügen",
    noPhases: "Keine Phasen. Erstellen Sie die erste Kampagnenphase.",
    phaseName: "Phasenname",
    phaseType: "Typ",
    phone: "Telefon",
    email: "E-Mail",
    draft: "Entwurf",
    active: "Aktiv",
    completed: "Abgeschlossen",
    evaluating: "Auswertung",
    activate: "Aktivieren",
    evaluate: "Auswerten",
    transition: "Kontakte verschieben",
    delete: "Löschen",
    edit: "Bearbeiten",
    contacts: "Kontakte",
    total: "Gesamt",
    pending: "Ausstehend",
    inProgress: "In Bearbeitung",
    completedCount: "Abgeschlossen",
    skipped: "Übersprungen",
    results: "Ergebnisse",
    noContacts: "Keine Kontakte in dieser Phase",
    createPhase: "Phase erstellen",
    editPhase: "Phase bearbeiten",
    tabGeneral: "Allgemein",
    tabTargets: "Ziele",
    tabTransition: "Übergang",
    save: "Speichern",
    cancel: "Abbrechen",
    phaseNumber: "Reihenfolge",
    evaluationDate: "Auswertungsdatum",
    transitionTitle: "Kontakte in die nächste Phase verschieben",
    targetPhase: "Zielphase",
    includeStatuses: "Status einschließen",
    excludeStatuses: "Status ausschließen",
    clickToInclude: "Status zum Einschließen anklicken",
    clickToExclude: "Status zum Ausschließen anklicken",
    loadingDispositions: "Lade Status...",
    noDispositions: "Keine Dispositionen für diese Kampagne",
    transitioned: "verschoben",
    of: "von",
    phaseTimeline: "Kontakt-Zeitstrahl",
    viewContacts: "Kontakte anzeigen",
    customer: "Kunde",
    hospital: "Krankenhaus",
    clinic: "Klinik",
    contactName: "Name",
    contactResult: "Ergebnis",
    contactStatus: "Status",
    phase: "Phase",
    enteredAt: "Eintritt in Phase",
    completedAt: "Abgeschlossen",
    targets: "Ziele",
    targetCalls: "Anrufziel",
    targetEmails: "E-Mail-Ziel",
    targetConversions: "Konversionsziel",
    targetResponseRate: "Antwortrate-Ziel (%)",
    achieved: "Erreicht",
    noTargets: "Keine Ziele",
    resetPhase: "Phase zurücksetzen",
    resetPhaseConfirm: "Sind Sie sicher, dass Sie diese Phase zurücksetzen möchten? Alle Kontakte werden auf den Status ausstehend zurückgesetzt.",
    resetPhaseSuccess: "Phase wurde zurückgesetzt",
    resetContact: "Kontakt zurücksetzen",
    resetContactConfirm: "Sind Sie sicher, dass Sie diesen Kontakt auf den Status ausstehend zurücksetzen möchten?",
    resetContactSuccess: "Kontakt wurde zurückgesetzt",
    confirm: "Bestätigen",
    syncContacts: "Kontakte synchronisieren",
    syncContactsDesc: "Entfernt ungültige und fügt neue Kontakte aus der Kampagne hinzu",
    syncSuccess: "Synchronisierung abgeschlossen",
    transitionRulesTitle: "Übergangsregeln",
    transitionRulesDesc: "Konfigurieren Sie, wie Kontakte in die nächste Phase übergehen.",
    transitionMode: "Modus",
    manual: "Manuell",
    manualDesc: "Kontakte werden manuell vom Operator über den Übergangsdialog in die nächste Phase verschoben.",
    automatic: "Automatisch",
    automaticDesc: "Kontakte werden automatisch basierend auf Regeln verschoben: Max. Versuche, Tage seit letztem Versuch und Dispositionsfilter.",
    aiAssisted: "KI-unterstützt",
    aiAssistedDesc: "Die KI analysiert die Kontakthistorie (Anrufe, E-Mails, Dispositionen, Notizen) und empfiehlt ob der Kontakt verschoben oder behalten werden soll. Sie prüfen und bestätigen die KI-Vorschläge vor dem Übergang.",
    selectTargetPhase: "Zielphase auswählen...",
    autoSchedule: "Ausführungsplan",
    selectSchedule: "Auswählen...",
    hourly: "Stündlich",
    daily: "Täglich",
    weekly: "Wöchentlich",
    maxAttempts: "Max Versuche",
    maxAttemptsHint: "Verschieben nach N Versuchen",
    daysSinceAttempt: "Tage seit letztem Versuch",
    daysSinceHint: "Verschieben wenn N Tage inaktiv",
    moveDispositions: "Diese Dispositionen verschieben →",
    keepDispositions: "In aktueller Phase behalten ✋",
    runAutoTransition: "Auto-Übergang ausführen",
    autoTransitionRun: "Auto-Übergang",
    evaluated: "ausgewertet",
  },
};

interface PhaseWithStats extends CampaignPhase {
  stats: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    skipped: number;
    results: Record<string, number>;
  };
}

interface EnrichedContactPhase extends CampaignContactPhase {
  contactType: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  dispositionCode?: string;
}

export default function CampaignPhasesTab({ campaignId }: { campaignId: string }) {
  const { locale } = useI18n();
  const pt = phasesT[locale] || phasesT.sk;
  const { toast } = useToast();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPhase, setEditingPhase] = useState<PhaseWithStats | null>(null);
  const [showTransitionDialog, setShowTransitionDialog] = useState<string | null>(null);
  const [viewContactsPhaseId, setViewContactsPhaseId] = useState<string | null>(null);
  const [viewTimelineContactId, setViewTimelineContactId] = useState<string | null>(null);
  const [newPhaseName, setNewPhaseName] = useState("");
  const [newPhaseType, setNewPhaseType] = useState<"phone" | "email">("phone");
  const [newPhaseEvalDate, setNewPhaseEvalDate] = useState("");
  const [newTargetCalls, setNewTargetCalls] = useState<string>("");
  const [newTargetEmails, setNewTargetEmails] = useState<string>("");
  const [newTargetConversions, setNewTargetConversions] = useState<string>("");
  const [newTargetResponseRate, setNewTargetResponseRate] = useState<string>("");
  const [newTransitionMode, setNewTransitionMode] = useState<"manual" | "automatic" | "ai_assisted">("manual");
  const [newAutoSchedule, setNewAutoSchedule] = useState<string>("");
  const [newMaxAttempts, setNewMaxAttempts] = useState<string>("");
  const [newDaysSinceLastAttempt, setNewDaysSinceLastAttempt] = useState<string>("");
  const [newMoveDispositions, setNewMoveDispositions] = useState<string[]>([]);
  const [newKeepDispositions, setNewKeepDispositions] = useState<string[]>([]);
  const [newAutoTargetPhaseId, setNewAutoTargetPhaseId] = useState<string>("");
  const [transitionTargetId, setTransitionTargetId] = useState("");
  const [transitionInclude, setTransitionInclude] = useState<string[]>([]);
  const [transitionExclude, setTransitionExclude] = useState<string[]>([]);

  const { data: phases = [], isLoading } = useQuery<PhaseWithStats[]>({
    queryKey: ["/api/campaigns", campaignId, "phases"],
    queryFn: () => fetch(`/api/campaigns/${campaignId}/phases`, { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: phaseContacts = [] } = useQuery<EnrichedContactPhase[]>({
    queryKey: ["/api/campaigns", campaignId, "phases", viewContactsPhaseId, "contacts"],
    queryFn: () => fetch(`/api/campaigns/${campaignId}/phases/${viewContactsPhaseId}/contacts`, { credentials: "include" }).then(r => r.json()),
    enabled: !!viewContactsPhaseId,
  });

  const { data: contactTimeline = [] } = useQuery<any[]>({
    queryKey: ["/api/campaigns", campaignId, "contacts", viewTimelineContactId, "timeline"],
    queryFn: () => fetch(`/api/campaigns/${campaignId}/contacts/${viewTimelineContactId}/timeline`, { credentials: "include" }).then(r => r.json()),
    enabled: !!viewTimelineContactId,
  });

  const { data: dispositions = [], isLoading: dispositionsLoading } = useQuery<CampaignDisposition[]>({
    queryKey: ["/api/campaigns", campaignId, "dispositions"],
    queryFn: () => fetch(`/api/campaigns/${campaignId}/dispositions`, { credentials: "include" }).then(r => r.json()),
    enabled: !!showTransitionDialog || !!editingPhase || showCreateDialog,
  });

  const createPhaseMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/campaigns/${campaignId}/phases`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "phases"] });
      setShowCreateDialog(false);
      setNewPhaseName("");
      setNewPhaseType("phone");
      setNewPhaseEvalDate("");
      setNewTargetCalls("");
      setNewTargetEmails("");
      setNewTargetConversions("");
      setNewTargetResponseRate("");
      toast({ title: pt.createPhase, description: "OK" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message || "Nepodarilo sa vytvoriť fázu", variant: "destructive" });
    },
  });

  const updatePhaseMutation = useMutation({
    mutationFn: ({ phaseId, data }: { phaseId: string; data: any }) =>
      apiRequest("PATCH", `/api/campaigns/${campaignId}/phases/${phaseId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "phases"] });
      setEditingPhase(null);
      toast({ title: pt.save, description: "OK" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message || "Nepodarilo sa uložiť fázu", variant: "destructive" });
    },
  });

  const deletePhaseMutation = useMutation({
    mutationFn: (phaseId: string) => apiRequest("DELETE", `/api/campaigns/${campaignId}/phases/${phaseId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "phases"] });
      toast({ title: pt.delete, description: "OK" });
    },
  });

  const activatePhaseMutation = useMutation({
    mutationFn: (phaseId: string) => apiRequest("POST", `/api/campaigns/${campaignId}/phases/${phaseId}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "phases"] });
      toast({ title: pt.activate, description: "OK" });
    },
  });

  const evaluatePhaseMutation = useMutation({
    mutationFn: (phaseId: string) => apiRequest("POST", `/api/campaigns/${campaignId}/phases/${phaseId}/evaluate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "phases"] });
      toast({ title: pt.evaluate, description: "OK" });
    },
  });

  const transitionMutation = useMutation({
    mutationFn: ({ phaseId, data }: { phaseId: string; data: any }) =>
      apiRequest("POST", `/api/campaigns/${campaignId}/phases/${phaseId}/transition`, data),
    onSuccess: async (res) => {
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "phases"] });
      setShowTransitionDialog(null);
      toast({ title: pt.transition, description: `${result.transitioned} ${pt.transitioned} ${pt.of} ${result.total}` });
    },
  });

  const autoTransitionMutation = useMutation({
    mutationFn: (phaseId: string) => apiRequest("POST", `/api/campaigns/${campaignId}/phases/${phaseId}/auto-transition`),
    onSuccess: async (res) => {
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "phases"] });
      toast({ title: pt.autoTransitionRun || "Auto-Transition", description: `${result.transitioned} ${pt.transitioned || "contacts transitioned"} / ${result.evaluated} ${pt.evaluated || "evaluated"}` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const syncPhaseMutation = useMutation({
    mutationFn: (phaseId: string) => apiRequest("POST", `/api/campaigns/${campaignId}/phases/${phaseId}/sync`),
    onSuccess: async (res) => {
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "phases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "phases", viewContactsPhaseId, "contacts"] });
      toast({ title: pt.syncContacts, description: `${pt.syncSuccess}: -${result.removed} / +${result.added}` });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message || "Sync failed", variant: "destructive" });
    },
  });

  const resetPhaseMutation = useMutation({
    mutationFn: (phaseId: string) => apiRequest("POST", `/api/campaigns/${campaignId}/phases/${phaseId}/reset`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "phases"] });
      toast({ title: pt.resetPhase, description: pt.resetPhaseSuccess });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message || "Reset failed", variant: "destructive" });
    },
  });

  const resetContactMutation = useMutation({
    mutationFn: ({ phaseId, contactPhaseId }: { phaseId: string; contactPhaseId: string }) =>
      apiRequest("POST", `/api/campaigns/${campaignId}/phases/${phaseId}/contacts/${contactPhaseId}/reset`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "phases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "phases", viewContactsPhaseId, "contacts"] });
      toast({ title: pt.resetContact, description: pt.resetContactSuccess });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message || "Reset failed", variant: "destructive" });
    },
  });

  const statusColor = (status: string) => {
    switch (status) {
      case "draft": return "secondary";
      case "active": return "default";
      case "completed": return "outline";
      case "evaluating": return "destructive";
      default: return "secondary";
    }
  };

  const statusLabel = (status: string) => {
    return (pt as any)[status] || status;
  };

  const typeIcon = (type: string) => {
    return type === "email" ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />;
  };

  const formatDate = (d: string | Date | null | undefined) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString(locale === "sk" ? "sk-SK" : locale === "cs" ? "cs-CZ" : locale === "hu" ? "hu-HU" : locale === "ro" ? "ro-RO" : locale === "it" ? "it-IT" : locale === "de" ? "de-DE" : "en-US", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Clock className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">{pt.title}</h3>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} size="sm" data-testid="button-add-phase">
          <Plus className="w-4 h-4 mr-2" />
          {pt.addPhase}
        </Button>
      </div>

      {phases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Layers className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>{pt.noPhases}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {phases.map((phase, idx) => (
              <div key={phase.id} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 min-w-[120px] cursor-pointer transition-colors ${
                    phase.status === "active" ? "border-primary bg-primary/5" :
                    phase.status === "completed" ? "border-green-500 bg-green-50 dark:bg-green-950" :
                    phase.status === "evaluating" ? "border-orange-500 bg-orange-50 dark:bg-orange-950" :
                    "border-border"
                  }`}
                  onClick={() => setViewContactsPhaseId(phase.id)}
                  data-testid={`phase-card-${phase.id}`}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-muted-foreground">#{phase.phaseNumber}</span>
                    {typeIcon(phase.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{phase.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Badge variant={statusColor(phase.status)} className="text-[10px] px-1.5 py-0">
                        {statusLabel(phase.status)}
                      </Badge>
                      {((phase as any).transitionMode === "automatic" || (phase as any).transitionMode === "ai_assisted") && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-400 text-purple-600 dark:text-purple-400 flex items-center gap-0.5">
                          {(phase as any).transitionMode === "automatic"
                            ? <><Zap className="w-3 h-3" /> Auto</>
                            : <><BrainCircuit className="w-3 h-3" /> AI</>}
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">{phase.stats.total} {pt.contacts.toLowerCase()}</span>
                    </div>
                  </div>
                </div>
                {idx < phases.length - 1 && (
                  <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {phases.map((phase) => (
              <Card key={phase.id} className={phase.status === "active" ? "ring-2 ring-primary" : ""} data-testid={`phase-detail-${phase.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-muted-foreground">#{phase.phaseNumber}</span>
                      {typeIcon(phase.type)}
                      <CardTitle className="text-base">{phase.name}</CardTitle>
                    </div>
                    <Badge variant={statusColor(phase.status)}>{statusLabel(phase.status)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">{pt.total}:</span>
                      <span className="font-medium">{phase.stats.total}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-yellow-500" />
                      <span className="text-muted-foreground">{pt.pending}:</span>
                      <span className="font-medium">{phase.stats.pending}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Play className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-muted-foreground">{pt.inProgress}:</span>
                      <span className="font-medium">{phase.stats.inProgress}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-muted-foreground">{pt.completedCount}:</span>
                      <span className="font-medium">{phase.stats.completed}</span>
                    </div>
                  </div>

                  {Object.keys(phase.stats.results).length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">{pt.results}:</span>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(phase.stats.results).map(([result, count]) => (
                          <Badge key={result} variant="outline" className="text-[10px]">
                            {result}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {phase.evaluationAt && (
                    <div className="text-xs text-muted-foreground">
                      {pt.evaluationDate}: {formatDate(phase.evaluationAt)}
                    </div>
                  )}

                  {phase.stats.total > 0 && (
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all"
                        style={{ width: `${Math.round((phase.stats.completed / Math.max(phase.stats.total, 1)) * 100)}%` }}
                      />
                    </div>
                  )}

                  {(phase.targetCalls || phase.targetEmails || phase.targetConversions || phase.targetResponseRate) ? (
                    <div className="space-y-2 border-t pt-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Target className="w-3.5 h-3.5" />
                        {pt.targets}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {phase.targetCalls != null && phase.targetCalls > 0 && (
                          <div className="space-y-1" data-testid={`target-calls-${phase.id}`}>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{pt.targetCalls}</span>
                              <span className="font-medium">{phase.stats.completed}/{phase.targetCalls}</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div
                                className={`rounded-full h-1.5 transition-all ${phase.stats.completed >= phase.targetCalls ? 'bg-green-500' : 'bg-blue-500'}`}
                                style={{ width: `${Math.min(100, Math.round((phase.stats.completed / phase.targetCalls) * 100))}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {phase.targetEmails != null && phase.targetEmails > 0 && (
                          <div className="space-y-1" data-testid={`target-emails-${phase.id}`}>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{pt.targetEmails}</span>
                              <span className="font-medium">{phase.stats.total}/{phase.targetEmails}</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div
                                className={`rounded-full h-1.5 transition-all ${phase.stats.total >= phase.targetEmails ? 'bg-green-500' : 'bg-blue-500'}`}
                                style={{ width: `${Math.min(100, Math.round((phase.stats.total / phase.targetEmails) * 100))}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {phase.targetConversions != null && phase.targetConversions > 0 && (
                          <div className="space-y-1" data-testid={`target-conversions-${phase.id}`}>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{pt.targetConversions}</span>
                              <span className="font-medium">{phase.stats.completed}/{phase.targetConversions}</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div
                                className={`rounded-full h-1.5 transition-all ${phase.stats.completed >= phase.targetConversions ? 'bg-green-500' : 'bg-blue-500'}`}
                                style={{ width: `${Math.min(100, Math.round((phase.stats.completed / phase.targetConversions) * 100))}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {phase.targetResponseRate != null && phase.targetResponseRate > 0 && (
                          <div className="space-y-1" data-testid={`target-response-rate-${phase.id}`}>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{pt.targetResponseRate}</span>
                              <span className="font-medium">
                                {phase.stats.total > 0 ? Math.round((phase.stats.completed / phase.stats.total) * 100) : 0}% / {phase.targetResponseRate}%
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div
                                className={`rounded-full h-1.5 transition-all ${
                                  (phase.stats.total > 0 ? (phase.stats.completed / phase.stats.total) * 100 : 0) >= phase.targetResponseRate ? 'bg-green-500' : 'bg-orange-500'
                                }`}
                                style={{ width: `${Math.min(100, phase.stats.total > 0 ? Math.round(((phase.stats.completed / phase.stats.total) * 100 / phase.targetResponseRate) * 100) : 0)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {phase.status === "draft" && (
                      <Button size="sm" variant="default" onClick={() => activatePhaseMutation.mutate(phase.id)} data-testid={`button-activate-${phase.id}`}>
                        <Play className="w-3.5 h-3.5 mr-1" />
                        {pt.activate}
                      </Button>
                    )}
                    {phase.status === "active" && (
                      <Button size="sm" variant="default" onClick={() => evaluatePhaseMutation.mutate(phase.id)} data-testid={`button-evaluate-${phase.id}`}>
                        <BarChart3 className="w-3.5 h-3.5 mr-1" />
                        {pt.evaluate}
                      </Button>
                    )}
                    {(phase.status === "evaluating" || phase.status === "completed") && phases.length > 1 && (
                      <Button size="sm" variant="outline" onClick={() => {
                        setShowTransitionDialog(phase.id);
                        setTransitionTargetId("");
                        setTransitionInclude([]);
                        setTransitionExclude([]);
                      }} data-testid={`button-transition-${phase.id}`}>
                        <ArrowRight className="w-3.5 h-3.5 mr-1" />
                        {pt.transition}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setViewContactsPhaseId(phase.id)} data-testid={`button-view-contacts-${phase.id}`}>
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      {pt.viewContacts}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      setEditingPhase(phase);
                      setNewPhaseName(phase.name);
                      setNewPhaseType(phase.type as "phone" | "email");
                      setNewPhaseEvalDate(phase.evaluationAt ? new Date(phase.evaluationAt).toISOString().slice(0, 16) : "");
                      setNewTargetCalls(phase.targetCalls != null ? String(phase.targetCalls) : "");
                      setNewTargetEmails(phase.targetEmails != null ? String(phase.targetEmails) : "");
                      setNewTargetConversions(phase.targetConversions != null ? String(phase.targetConversions) : "");
                      setNewTargetResponseRate(phase.targetResponseRate != null ? String(phase.targetResponseRate) : "");
                      setNewTransitionMode(((phase as any).transitionMode as any) || "manual");
                      setNewAutoSchedule(((phase as any).autoTransitionSchedule as any) || "");
                      const rules: any = phase.transitionRules || {};
                      setNewMaxAttempts(rules.maxAttempts != null ? String(rules.maxAttempts) : "");
                      setNewDaysSinceLastAttempt(rules.daysSinceLastAttempt != null ? String(rules.daysSinceLastAttempt) : "");
                      setNewMoveDispositions(rules.moveDispositions || []);
                      setNewKeepDispositions(rules.keepDispositions || []);
                      setNewAutoTargetPhaseId(rules.targetPhaseId || "");
                    }} data-testid={`button-edit-${phase.id}`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-blue-600"
                      onClick={() => syncPhaseMutation.mutate(phase.id)}
                      disabled={syncPhaseMutation.isPending}
                      data-testid={`button-sync-phase-${phase.id}`}
                      title={pt.syncContactsDesc}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1 ${syncPhaseMutation.isPending ? "animate-spin" : ""}`} />
                      {pt.syncContacts}
                    </Button>
                    {((phase as any).transitionMode === "automatic" || (phase as any).transitionMode === "ai_assisted") && phase.status === "active" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-purple-600"
                        onClick={() => autoTransitionMutation.mutate(phase.id)}
                        disabled={autoTransitionMutation.isPending}
                        data-testid={`button-auto-transition-${phase.id}`}
                      >
                        <Layers className={`w-3.5 h-3.5 mr-1 ${autoTransitionMutation.isPending ? "animate-spin" : ""}`} />
                        {pt.runAutoTransition || "Run Auto-Transition"}
                      </Button>
                    )}
                    {phase.status !== "draft" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-orange-600" data-testid={`button-reset-phase-${phase.id}`}>
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            {pt.resetPhase}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{pt.resetPhase}</AlertDialogTitle>
                            <AlertDialogDescription>{pt.resetPhaseConfirm}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{pt.cancel}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => resetPhaseMutation.mutate(phase.id)} data-testid={`button-confirm-reset-phase-${phase.id}`}>
                              {pt.confirm}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    {phase.status === "draft" && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deletePhaseMutation.mutate(phase.id)} data-testid={`button-delete-${phase.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Sheet open={showCreateDialog || !!editingPhase} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setEditingPhase(null);
          setNewTargetCalls("");
          setNewTargetEmails("");
          setNewTargetConversions("");
          setNewTargetResponseRate("");
          setNewTransitionMode("manual");
          setNewAutoSchedule("");
          setNewMaxAttempts("");
          setNewDaysSinceLastAttempt("");
          setNewMoveDispositions([]);
          setNewKeepDispositions([]);
          setNewAutoTargetPhaseId("");
        }
      }}>
        <SheetContent className="w-[560px] sm:max-w-[560px] p-0 flex flex-col" data-testid="sheet-edit-phase">
          <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
            <SheetTitle>{editingPhase ? pt.editPhase : pt.createPhase}</SheetTitle>
            <SheetDescription className="sr-only">{editingPhase ? pt.editPhase : pt.createPhase}</SheetDescription>
          </SheetHeader>
          <Tabs defaultValue="general" className="flex-1 flex flex-col min-h-0">
            <div className="px-6 border-b flex-shrink-0">
              <TabsList className="w-full h-10 bg-transparent p-0 gap-0">
                <TabsTrigger value="general" className="flex-1 gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none" data-testid="tab-phase-general">
                  <Settings2 className="w-3.5 h-3.5" />
                  {pt.tabGeneral || "General"}
                </TabsTrigger>
                <TabsTrigger value="targets" className="flex-1 gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none" data-testid="tab-phase-targets">
                  <Target className="w-3.5 h-3.5" />
                  {pt.tabTargets || "Targets"}
                </TabsTrigger>
                <TabsTrigger value="transition" className="flex-1 gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none" data-testid="tab-phase-transition">
                  <ArrowRight className="w-3.5 h-3.5" />
                  {pt.tabTransition || "Transition"}
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <TabsContent value="general" className="mt-0 px-6 py-4">
                <div className="space-y-4">
                  <div>
                    <Label>{pt.phaseName}</Label>
                    <Input
                      value={newPhaseName}
                      onChange={(e) => setNewPhaseName(e.target.value)}
                      placeholder={pt.phaseName}
                      data-testid="input-phase-name"
                    />
                  </div>
                  <div>
                    <Label>{pt.phaseType}</Label>
                    <Select value={newPhaseType} onValueChange={(v) => setNewPhaseType(v as "phone" | "email")}>
                      <SelectTrigger data-testid="select-phase-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="phone"><div className="flex items-center gap-2"><Phone className="w-4 h-4" />{pt.phone}</div></SelectItem>
                        <SelectItem value="email"><div className="flex items-center gap-2"><Mail className="w-4 h-4" />{pt.email}</div></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />{pt.evaluationDate}</Label>
                    <Input
                      type="datetime-local"
                      value={newPhaseEvalDate}
                      onChange={(e) => setNewPhaseEvalDate(e.target.value)}
                      className="mt-1"
                      data-testid="input-phase-eval-date"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="targets" className="mt-0 px-6 py-4">
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">{pt.targets}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{pt.targetCalls}</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newTargetCalls}
                        onChange={(e) => setNewTargetCalls(e.target.value)}
                        placeholder="0"
                        className="mt-1"
                        data-testid="input-target-calls"
                      />
                    </div>
                    <div>
                      <Label className="text-xs flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{pt.targetEmails}</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newTargetEmails}
                        onChange={(e) => setNewTargetEmails(e.target.value)}
                        placeholder="0"
                        className="mt-1"
                        data-testid="input-target-emails"
                      />
                    </div>
                    <div>
                      <Label className="text-xs flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" />{pt.targetConversions}</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newTargetConversions}
                        onChange={(e) => setNewTargetConversions(e.target.value)}
                        placeholder="0"
                        className="mt-1"
                        data-testid="input-target-conversions"
                      />
                    </div>
                    <div>
                      <Label className="text-xs flex items-center gap-1"><Percent className="w-3.5 h-3.5" />{pt.targetResponseRate}</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={newTargetResponseRate}
                        onChange={(e) => setNewTargetResponseRate(e.target.value)}
                        placeholder="0"
                        className="mt-1"
                        data-testid="input-target-response-rate"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="transition" className="mt-0 px-6 py-4">
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">{pt.transitionRulesDesc || "Configure how contacts move to the next phase."}</p>

                  <div className="space-y-2">
                    <Label className="text-xs">{pt.transitionMode || "Mode"}</Label>
                    <div className="grid grid-cols-1 gap-2">
                      {(["manual", "automatic", "ai_assisted"] as const).map(mode => {
                        const modeLabels: Record<string, string> = {
                          manual: pt.manual || "Manual",
                          automatic: pt.automatic || "Automatic",
                          ai_assisted: pt.aiAssisted || "AI Assisted",
                        };
                        const modeDescs: Record<string, string> = {
                          manual: pt.manualDesc || "Contacts are moved to the next phase manually by the operator using the transition dialog.",
                          automatic: pt.automaticDesc || "Contacts are moved automatically based on rules: max attempts, days since last attempt, and disposition filters.",
                          ai_assisted: pt.aiAssistedDesc || "AI analyzes each contact's history (calls, emails, dispositions, notes) and recommends whether to move or keep them. You review and confirm the AI's suggestions before transition.",
                        };
                        const ModeIcon = mode === "manual" ? Hand : mode === "automatic" ? Zap : BrainCircuit;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setNewTransitionMode(mode)}
                            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                              newTransitionMode === mode
                                ? "bg-primary/5 border-primary ring-1 ring-primary/30"
                                : "bg-muted/30 border-border hover:bg-accent/50"
                            }`}
                            data-testid={`btn-transition-mode-${mode}`}
                          >
                            <ModeIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${newTransitionMode === mode ? "text-primary" : "text-muted-foreground"}`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-semibold ${newTransitionMode === mode ? "text-primary" : ""}`}>{modeLabels[mode]}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{modeDescs[mode]}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {newTransitionMode !== "manual" && (
                    <div className="space-y-3 pl-3 border-l-2 border-primary/20">
                      <div>
                        <Label className="text-xs">{pt.targetPhase || "Target Phase"}</Label>
                        <Select value={newAutoTargetPhaseId} onValueChange={setNewAutoTargetPhaseId}>
                          <SelectTrigger className="h-8 mt-1" data-testid="select-auto-target-phase">
                            <SelectValue placeholder={pt.selectTargetPhase || "Select target phase..."} />
                          </SelectTrigger>
                          <SelectContent>
                            {phases.filter(p => !editingPhase || p.id !== editingPhase.id).map(p => (
                              <SelectItem key={p.id} value={p.id}>#{p.phaseNumber} {p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs">{pt.autoSchedule || "Run Schedule"}</Label>
                        <Select value={newAutoSchedule} onValueChange={setNewAutoSchedule}>
                          <SelectTrigger className="h-8 mt-1" data-testid="select-auto-schedule">
                            <SelectValue placeholder={pt.selectSchedule || "Select..."} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hourly">{pt.hourly || "Hourly"}</SelectItem>
                            <SelectItem value="daily">{pt.daily || "Daily"}</SelectItem>
                            <SelectItem value="weekly">{pt.weekly || "Weekly"}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">{pt.maxAttempts || "Max Attempts"}</Label>
                          <Input type="number" min={1} className="h-8 mt-1" value={newMaxAttempts} onChange={(e) => setNewMaxAttempts(e.target.value)} placeholder="∞" data-testid="input-max-attempts" />
                          <p className="text-[10px] text-muted-foreground mt-0.5">{pt.maxAttemptsHint || "Move after N attempts"}</p>
                        </div>
                        <div>
                          <Label className="text-xs">{pt.daysSinceAttempt || "Days Since Last Attempt"}</Label>
                          <Input type="number" min={1} className="h-8 mt-1" value={newDaysSinceLastAttempt} onChange={(e) => setNewDaysSinceLastAttempt(e.target.value)} placeholder="∞" data-testid="input-days-since" />
                          <p className="text-[10px] text-muted-foreground mt-0.5">{pt.daysSinceHint || "Move if inactive for N days"}</p>
                        </div>
                      </div>

                      {dispositions.filter(d => d.isActive).length > 0 && (
                        <>
                          <div>
                            <Label className="text-xs mb-1.5 block">{pt.moveDispositions || "Move these dispositions →"}</Label>
                            <div className="flex flex-wrap gap-1.5">
                              {dispositions.filter(d => d.isActive).map(d => {
                                const selected = newMoveDispositions.includes(d.code);
                                return (
                                  <button key={d.id} type="button"
                                    className={`px-2 py-1 rounded text-[11px] font-medium border transition-all ${
                                      selected ? "bg-orange-100 border-orange-400 text-orange-800 dark:bg-orange-900/40 dark:border-orange-600 dark:text-orange-300"
                                        : "border-border bg-background hover:bg-accent"
                                    }`}
                                    onClick={() => setNewMoveDispositions(prev => prev.includes(d.code) ? prev.filter(c => c !== d.code) : [...prev, d.code])}
                                    data-testid={`btn-move-disposition-${d.code}`}
                                  >
                                    {d.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs mb-1.5 block">{pt.keepDispositions || "Keep in current phase (don't move)"}</Label>
                            <div className="flex flex-wrap gap-1.5">
                              {dispositions.filter(d => d.isActive).map(d => {
                                const selected = newKeepDispositions.includes(d.code);
                                return (
                                  <button key={d.id} type="button"
                                    className={`px-2 py-1 rounded text-[11px] font-medium border transition-all ${
                                      selected ? "bg-green-100 border-green-400 text-green-800 dark:bg-green-900/40 dark:border-green-600 dark:text-green-300"
                                        : "border-border bg-background hover:bg-accent"
                                    }`}
                                    onClick={() => setNewKeepDispositions(prev => prev.includes(d.code) ? prev.filter(c => c !== d.code) : [...prev, d.code])}
                                    data-testid={`btn-keep-disposition-${d.code}`}
                                  >
                                    {d.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t flex-shrink-0">
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setEditingPhase(null); }}>{pt.cancel}</Button>
            <Button
              onClick={() => {
                if (!newPhaseName.trim()) return;
                const targetData = {
                  targetCalls: newTargetCalls ? parseInt(newTargetCalls) : null,
                  targetEmails: newTargetEmails ? parseInt(newTargetEmails) : null,
                  targetConversions: newTargetConversions ? parseInt(newTargetConversions) : null,
                  targetResponseRate: newTargetResponseRate ? parseInt(newTargetResponseRate) : null,
                };
                const transitionData = {
                  transitionMode: newTransitionMode,
                  autoTransitionSchedule: newAutoSchedule || null,
                  transitionRules: newTransitionMode !== "manual" ? {
                    maxAttempts: newMaxAttempts ? parseInt(newMaxAttempts) : null,
                    daysSinceLastAttempt: newDaysSinceLastAttempt ? parseInt(newDaysSinceLastAttempt) : null,
                    moveDispositions: newMoveDispositions,
                    keepDispositions: newKeepDispositions,
                    targetPhaseId: newAutoTargetPhaseId || null,
                  } : null,
                };
                if (editingPhase) {
                  updatePhaseMutation.mutate({
                    phaseId: editingPhase.id,
                    data: {
                      name: newPhaseName,
                      type: newPhaseType,
                      evaluationAt: newPhaseEvalDate || null,
                      ...targetData,
                      ...transitionData,
                    }
                  });
                } else {
                  createPhaseMutation.mutate({
                    name: newPhaseName,
                    type: newPhaseType,
                    evaluationAt: newPhaseEvalDate || null,
                    ...targetData,
                    ...transitionData,
                  });
                }
              }}
              disabled={!newPhaseName.trim()}
              data-testid="button-save-phase"
            >
              {pt.save}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!showTransitionDialog} onOpenChange={(open) => {
        if (!open) {
          setShowTransitionDialog(null);
          setTransitionInclude([]);
          setTransitionExclude([]);
          setTransitionTargetId("");
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{pt.transitionTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{pt.targetPhase}</Label>
              <Select value={transitionTargetId} onValueChange={setTransitionTargetId}>
                <SelectTrigger data-testid="select-target-phase">
                  <SelectValue placeholder={pt.targetPhase} />
                </SelectTrigger>
                <SelectContent>
                  {phases.filter(p => p.id !== showTransitionDialog).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      #{p.phaseNumber} {p.name} ({pt[p.type]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {dispositionsLoading ? (
              <p className="text-sm text-muted-foreground">{pt.loadingDispositions}</p>
            ) : dispositions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{pt.noDispositions}</p>
            ) : (
              <>
                <div>
                  <Label className="mb-2 block">{pt.includeStatuses}</Label>
                  <p className="text-xs text-muted-foreground mb-2">{pt.clickToInclude}</p>
                  <ScrollArea className="max-h-[140px]">
                    <div className="flex flex-wrap gap-1.5">
                      {dispositions.filter(d => d.isActive).map(d => {
                        const selected = transitionInclude.includes(d.code);
                        const excluded = transitionExclude.includes(d.code);
                        return (
                          <button
                            key={d.id}
                            type="button"
                            disabled={excluded}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                              selected
                                ? "bg-green-100 border-green-400 text-green-800 dark:bg-green-900/40 dark:border-green-600 dark:text-green-300"
                                : excluded
                                  ? "opacity-30 cursor-not-allowed border-muted bg-muted text-muted-foreground"
                                  : "border-border bg-background text-foreground hover:bg-accent hover:border-accent-foreground/20"
                            }`}
                            onClick={() => {
                              setTransitionInclude(prev =>
                                prev.includes(d.code) ? prev.filter(c => c !== d.code) : [...prev, d.code]
                              );
                            }}
                            data-testid={`badge-include-${d.code}`}
                          >
                            {d.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />}
                            {d.name}
                            {selected && <CheckCircle className="h-3 w-3 ml-0.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>

                <div>
                  <Label className="mb-2 block">{pt.excludeStatuses}</Label>
                  <p className="text-xs text-muted-foreground mb-2">{pt.clickToExclude}</p>
                  <ScrollArea className="max-h-[140px]">
                    <div className="flex flex-wrap gap-1.5">
                      {dispositions.filter(d => d.isActive).map(d => {
                        const selected = transitionExclude.includes(d.code);
                        const included = transitionInclude.includes(d.code);
                        return (
                          <button
                            key={d.id}
                            type="button"
                            disabled={included}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                              selected
                                ? "bg-red-100 border-red-400 text-red-800 dark:bg-red-900/40 dark:border-red-600 dark:text-red-300"
                                : included
                                  ? "opacity-30 cursor-not-allowed border-muted bg-muted text-muted-foreground"
                                  : "border-border bg-background text-foreground hover:bg-accent hover:border-accent-foreground/20"
                            }`}
                            onClick={() => {
                              setTransitionExclude(prev =>
                                prev.includes(d.code) ? prev.filter(c => c !== d.code) : [...prev, d.code]
                              );
                            }}
                            data-testid={`badge-exclude-${d.code}`}
                          >
                            {d.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />}
                            {d.name}
                            {selected && <Trash2 className="h-3 w-3 ml-0.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransitionDialog(null)}>{pt.cancel}</Button>
            <Button
              onClick={() => {
                if (!showTransitionDialog || !transitionTargetId) return;
                const includeArr = transitionInclude.length > 0 ? transitionInclude : undefined;
                const excludeArr = transitionExclude.length > 0 ? transitionExclude : undefined;
                transitionMutation.mutate({
                  phaseId: showTransitionDialog,
                  data: {
                    targetPhaseId: transitionTargetId,
                    includeStatuses: includeArr,
                    excludeStatuses: excludeArr,
                  }
                });
              }}
              disabled={!transitionTargetId || transitionMutation.isPending}
              data-testid="button-execute-transition"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              {pt.transition}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewContactsPhaseId} onOpenChange={(open) => { if (!open) setViewContactsPhaseId(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {phases.find(p => p.id === viewContactsPhaseId)?.name} — {pt.contacts}
            </DialogTitle>
          </DialogHeader>
          {phaseContacts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{pt.noContacts}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">{pt.contactName}</th>
                    <th className="text-left py-2 px-2">{pt.phaseType}</th>
                    <th className="text-left py-2 px-2">{pt.contactStatus}</th>
                    <th className="text-left py-2 px-2">{pt.contactResult}</th>
                    <th className="text-left py-2 px-2">{pt.enteredAt}</th>
                    <th className="text-right py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {phaseContacts.map((cp) => (
                    <tr key={cp.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{cp.contactName || "-"}</span>
                          <Badge variant="outline" className="text-[10px] ml-1">
                            {(pt as any)[cp.contactType] || cp.contactType}
                          </Badge>
                        </div>
                        {cp.contactEmail && <div className="text-xs text-muted-foreground">{cp.contactEmail}</div>}
                      </td>
                      <td className="py-2 px-2">
                        {typeIcon(phases.find(p => p.id === viewContactsPhaseId)?.type || "phone")}
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant={cp.status === "completed" ? "default" : "secondary"} className="text-xs">
                          {statusLabel(cp.status)}
                        </Badge>
                      </td>
                      <td className="py-2 px-2">
                        {cp.result ? (
                          <Badge variant="outline" className="text-xs">{cp.result}</Badge>
                        ) : "-"}
                      </td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">
                        {formatDate(cp.enteredAt)}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {cp.status !== "pending" && viewContactsPhaseId && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="text-orange-600 h-7 w-7 p-0" data-testid={`button-reset-contact-${cp.id}`}>
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{pt.resetContact}</AlertDialogTitle>
                                  <AlertDialogDescription>{pt.resetContactConfirm}</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{pt.cancel}</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => resetContactMutation.mutate({ phaseId: viewContactsPhaseId, contactPhaseId: cp.id })} data-testid={`button-confirm-reset-contact-${cp.id}`}>
                                    {pt.confirm}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setViewTimelineContactId(cp.contactId)} data-testid={`button-timeline-${cp.contactId}`}>
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewTimelineContactId} onOpenChange={(open) => { if (!open) setViewTimelineContactId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{pt.phaseTimeline}</DialogTitle>
          </DialogHeader>
          <div className="space-y-0">
            {contactTimeline.map((entry: any, idx: number) => (
              <div key={entry.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    entry.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                    entry.status === "in_progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {entry.phaseNumber || idx + 1}
                  </div>
                  {idx < contactTimeline.length - 1 && (
                    <div className="w-0.5 h-12 bg-border" />
                  )}
                </div>
                <div className="pb-6">
                  <div className="font-medium text-sm">{entry.phaseName || `${pt.phase} ${entry.phaseNumber}`}</div>
                  <div className="flex items-center gap-2 mt-1">
                    {entry.phaseType && typeIcon(entry.phaseType)}
                    <Badge variant={entry.status === "completed" ? "default" : "secondary"} className="text-[10px]">
                      {statusLabel(entry.status)}
                    </Badge>
                    {entry.result && (
                      <Badge variant="outline" className="text-[10px]">{entry.result}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {pt.enteredAt}: {formatDate(entry.enteredAt)}
                    {entry.completedAt && <span className="ml-2">| {pt.completedAt}: {formatDate(entry.completedAt)}</span>}
                  </div>
                </div>
              </div>
            ))}
            {contactTimeline.length === 0 && (
              <p className="text-center text-muted-foreground py-4">{pt.noContacts}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}