import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Send, Bell, ArrowLeft, Check, X, Users, Mail } from "lucide-react";
import { format } from "date-fns";

const COUNTRY_OPTIONS = ["SK", "CZ", "HU", "RO", "IT", "DE", "AT", "CH", "US"];
const FORM_LANGS = ["sk", "cs", "hu", "ro", "it", "de", "en"];

// Sample email templates per language (light text + variables)
const SAMPLE_TEMPLATES: Record<string, { subject: string; body: string }> = {
  sk: {
    subject: "Aktualizácia Vašich údajov – {{fullName}}",
    body: `<p>Dobrý deň {{fullName}},</p>
<p>radi by sme Vás poprosili o kontrolu a aktualizáciu Vašich osobných údajov, ktoré evidujeme v našom systéme.</p>
<p>Kliknite prosím na tento odkaz a skontrolujte svoje údaje:</p>
<p><a href="{{link}}">{{link}}</a></p>
<p>Vyplnenie trvá len pár minút. Ak sú všetky údaje správne, stačí ich len potvrdiť.</p>
<p>Ďakujeme,<br/>Cord Blood Center</p>`,
  },
  cs: {
    subject: "Aktualizace Vašich údajů – {{fullName}}",
    body: `<p>Dobrý den {{fullName}},</p>
<p>rádi bychom Vás požádali o kontrolu a aktualizaci Vašich osobních údajů, které evidujeme v našem systému.</p>
<p>Klikněte prosím na tento odkaz a zkontrolujte své údaje:</p>
<p><a href="{{link}}">{{link}}</a></p>
<p>Vyplnění zabere jen pár minut. Pokud jsou všechny údaje správné, stačí je pouze potvrdit.</p>
<p>Děkujeme,<br/>Cord Blood Center</p>`,
  },
  hu: {
    subject: "Adatainak frissítése – {{fullName}}",
    body: `<p>Tisztelt {{fullName}}!</p>
<p>Kérjük, ellenőrizze és frissítse a rendszerünkben nyilvántartott személyes adatait.</p>
<p>Kattintson erre a linkre az adatai ellenőrzéséhez:</p>
<p><a href="{{link}}">{{link}}</a></p>
<p>A kitöltés csak néhány percet vesz igénybe. Ha minden adat helyes, elegendő megerősíteni.</p>
<p>Köszönettel,<br/>Cord Blood Center</p>`,
  },
  ro: {
    subject: "Actualizarea datelor dumneavoastră – {{fullName}}",
    body: `<p>Bună ziua {{fullName}},</p>
<p>Vă rugăm să verificați și să actualizați datele personale pe care le avem înregistrate în sistemul nostru.</p>
<p>Faceți clic pe acest link pentru a vă verifica datele:</p>
<p><a href="{{link}}">{{link}}</a></p>
<p>Completarea durează doar câteva minute. Dacă toate datele sunt corecte, este suficient să le confirmați.</p>
<p>Vă mulțumim,<br/>Cord Blood Center</p>`,
  },
  it: {
    subject: "Aggiornamento dei Suoi dati – {{fullName}}",
    body: `<p>Gentile {{fullName}},</p>
<p>La preghiamo di verificare e aggiornare i Suoi dati personali registrati nel nostro sistema.</p>
<p>Clicchi su questo link per controllare i Suoi dati:</p>
<p><a href="{{link}}">{{link}}</a></p>
<p>La compilazione richiede solo pochi minuti. Se tutti i dati sono corretti, è sufficiente confermarli.</p>
<p>Grazie,<br/>Cord Blood Center</p>`,
  },
  de: {
    subject: "Aktualisierung Ihrer Daten – {{fullName}}",
    body: `<p>Guten Tag {{fullName}},</p>
<p>wir möchten Sie bitten, Ihre in unserem System gespeicherten persönlichen Daten zu überprüfen und zu aktualisieren.</p>
<p>Bitte klicken Sie auf diesen Link, um Ihre Daten zu überprüfen:</p>
<p><a href="{{link}}">{{link}}</a></p>
<p>Das Ausfüllen dauert nur wenige Minuten. Wenn alle Daten korrekt sind, genügt eine Bestätigung.</p>
<p>Vielen Dank,<br/>Cord Blood Center</p>`,
  },
  en: {
    subject: "Update of your details – {{fullName}}",
    body: `<p>Dear {{fullName}},</p>
<p>We kindly ask you to review and update the personal details we have on file in our system.</p>
<p>Please click this link to check your details:</p>
<p><a href="{{link}}">{{link}}</a></p>
<p>It only takes a few minutes. If everything is correct, simply confirm it.</p>
<p>Thank you,<br/>Cord Blood Center</p>`,
  },
};

const L: Record<string, Record<string, string>> = {
  en: {
    pageTitle: "Collaborator Data Updates", pageDesc: "Email campaigns asking collaborators to update their personal data via a secure link.",
    newCampaign: "New campaign", name: "Campaign name", senderMailbox: "Sender mailbox", subject: "Email subject", body: "Email body (HTML)",
    bodyHint: "Available variables: {{firstName}}, {{lastName}}, {{fullName}}, {{titleBefore}}, {{link}}. If {{link}} is missing, the link is appended automatically.",
    validDays: "Link validity (days)", filter: "Recipient filter", countries: "Countries", collabType: "Collaborator type (optional)",
    onlyActive: "Only active", dataSource: "Data source (optional, e.g. iscbc)", legacyIds: "Legacy IDs (optional, paste list)",
    preview: "Preview recipients", recipients: "recipients", create: "Create campaign", creating: "Creating…",
    back: "Back", sendEmails: "Send emails", remind: "Send reminder", sending: "Sending…",
    statusPending: "Pending", statusSent: "Sent", statusFailed: "Failed", statusOpened: "Opened", statusSubmitted: "Submitted", statusApproved: "Approved", statusRejected: "Rejected",
    tabRecipients: "Recipients", tabApprovals: "Approval queue", collaborator: "Collaborator", email: "Email", status: "Status", sentAt: "Sent", submittedAt: "Submitted",
    changes: "changes", noChanges: "Confirmed without changes", fieldCol: "Field", oldVal: "Original", newVal: "New",
    approve: "Approve", reject: "Reject", approved: "Changes approved and applied", rejected: "Submission rejected",
    language: "Email & form language", langAuto: "Automatic (by collaborator country)", insertSample: "Insert sample text",
    agreementTypeL: "Agreement type", partnerCategoryL: "Partner category", rewardTypeL: "Reward type",
    isManagerL: "Manager", monthRewardsL: "Monthly rewards", anyOpt: "Any", yesOpt: "Yes", noOpt: "No",
    testSend: "Test email", testEmailLabel: "Send a test to this address", testSent: "Test email sent", testLinkLabel: "Test form link", testDesc: "The email is sent with sample data of the first recipient. The link works fully — you can fill in the form, submit it, and then approve or reject it in the approval queue.",
    emailsSending: "Emails are being sent in the background", noCampaigns: "No campaigns yet. Create one to get started.",
    noApprovals: "No submissions waiting for review.", createdFmt: "Created", campaignCreated: "Campaign created", errorTitle: "Error",
    draft: "Draft", statSending: "Sending", statSent: "Sent",
  },
  sk: {
    pageTitle: "Aktualizácie údajov spolupracovníkov", pageDesc: "E-mailové kampane so žiadosťou o aktualizáciu osobných údajov cez bezpečný odkaz.",
    newCampaign: "Nová kampaň", name: "Názov kampane", senderMailbox: "Odosielacia schránka", subject: "Predmet e-mailu", body: "Text e-mailu (HTML)",
    bodyHint: "Dostupné premenné: {{firstName}}, {{lastName}}, {{fullName}}, {{titleBefore}}, {{link}}. Ak {{link}} chýba, odkaz sa pridá automaticky na koniec.",
    validDays: "Platnosť odkazu (dni)", filter: "Filter príjemcov", countries: "Krajiny", collabType: "Typ spolupracovníka (voliteľné)",
    onlyActive: "Len aktívni", dataSource: "Zdroj dát (voliteľné, napr. iscbc)", legacyIds: "Legacy ID (voliteľné, vlož zoznam)",
    preview: "Náhľad príjemcov", recipients: "príjemcov", create: "Vytvoriť kampaň", creating: "Vytváram…",
    back: "Späť", sendEmails: "Odoslať e-maily", remind: "Poslať pripomienku", sending: "Odosielam…",
    statusPending: "Čaká", statusSent: "Odoslané", statusFailed: "Zlyhalo", statusOpened: "Otvorené", statusSubmitted: "Vyplnené", statusApproved: "Schválené", statusRejected: "Zamietnuté",
    tabRecipients: "Príjemcovia", tabApprovals: "Schvaľovací rad", collaborator: "Spolupracovník", email: "E-mail", status: "Stav", sentAt: "Odoslané", submittedAt: "Vyplnené",
    changes: "zmien", noChanges: "Potvrdené bez zmien", fieldCol: "Pole", oldVal: "Pôvodné", newVal: "Nové",
    approve: "Schváliť", reject: "Zamietnuť", approved: "Zmeny schválené a zapísané", rejected: "Odoslanie zamietnuté",
    language: "Jazyk e-mailu a formulára", langAuto: "Automaticky (podľa krajiny spolupracovníka)", insertSample: "Vložiť vzorový text",
    agreementTypeL: "Typ zmluvy/dohody", partnerCategoryL: "Kategória partnera", rewardTypeL: "Typ odmeny",
    isManagerL: "Manažér", monthRewardsL: "Mesačné odmeny", anyOpt: "Všetci", yesOpt: "Áno", noOpt: "Nie",
    testSend: "Testovací e-mail", testEmailLabel: "Poslať test na túto adresu", testSent: "Testovací e-mail odoslaný", testLinkLabel: "Testovací odkaz na formulár", testDesc: "E-mail sa pošle s ukážkovými údajmi prvého príjemcu. Odkaz je plne funkčný — formulár môžeš vyplniť, odoslať a potom v schvaľovacom rade schváliť alebo zamietnuť.",
    emailsSending: "E-maily sa odosielajú na pozadí", noCampaigns: "Zatiaľ žiadne kampane. Vytvor prvú.",
    noApprovals: "Žiadne vyplnenia nečakajú na kontrolu.", createdFmt: "Vytvorené", campaignCreated: "Kampaň vytvorená", errorTitle: "Chyba",
    draft: "Koncept", statSending: "Odosiela sa", statSent: "Odoslaná",
  },
  cs: {
    pageTitle: "Aktualizace údajů spolupracovníků", pageDesc: "E-mailové kampaně se žádostí o aktualizaci osobních údajů přes bezpečný odkaz.",
    newCampaign: "Nová kampaň", name: "Název kampaně", senderMailbox: "Odesílací schránka", subject: "Předmět e-mailu", body: "Text e-mailu (HTML)",
    bodyHint: "Dostupné proměnné: {{firstName}}, {{lastName}}, {{fullName}}, {{titleBefore}}, {{link}}. Pokud {{link}} chybí, odkaz se přidá automaticky.",
    validDays: "Platnost odkazu (dny)", filter: "Filtr příjemců", countries: "Země", collabType: "Typ spolupracovníka (volitelné)",
    onlyActive: "Jen aktivní", dataSource: "Zdroj dat (volitelné, např. iscbc)", legacyIds: "Legacy ID (volitelné, vlož seznam)",
    preview: "Náhled příjemců", recipients: "příjemců", create: "Vytvořit kampaň", creating: "Vytvářím…",
    back: "Zpět", sendEmails: "Odeslat e-maily", remind: "Poslat připomínku", sending: "Odesílám…",
    statusPending: "Čeká", statusSent: "Odesláno", statusFailed: "Selhalo", statusOpened: "Otevřeno", statusSubmitted: "Vyplněno", statusApproved: "Schváleno", statusRejected: "Zamítnuto",
    tabRecipients: "Příjemci", tabApprovals: "Schvalovací fronta", collaborator: "Spolupracovník", email: "E-mail", status: "Stav", sentAt: "Odesláno", submittedAt: "Vyplněno",
    changes: "změn", noChanges: "Potvrzeno beze změn", fieldCol: "Pole", oldVal: "Původní", newVal: "Nové",
    approve: "Schválit", reject: "Zamítnout", approved: "Změny schváleny a zapsány", rejected: "Odeslání zamítnuto",
    language: "Jazyk e-mailu a formuláře", langAuto: "Automaticky (podle země spolupracovníka)", insertSample: "Vložit vzorový text",
    agreementTypeL: "Typ smlouvy/dohody", partnerCategoryL: "Kategorie partnera", rewardTypeL: "Typ odměny",
    isManagerL: "Manažer", monthRewardsL: "Měsíční odměny", anyOpt: "Všichni", yesOpt: "Ano", noOpt: "Ne",
    testSend: "Testovací e-mail", testEmailLabel: "Poslat test na tuto adresu", testSent: "Testovací e-mail odeslán", testLinkLabel: "Testovací odkaz na formulář", testDesc: "E-mail se pošle s ukázkovými údaji prvního příjemce. Odkaz je plně funkční — formulář lze vyplnit, odeslat a poté ve schvalovací frontě schválit nebo zamítnout.",
    emailsSending: "E-maily se odesílají na pozadí", noCampaigns: "Zatím žádné kampaně. Vytvořte první.",
    noApprovals: "Žádná vyplnění nečekají na kontrolu.", createdFmt: "Vytvořeno", campaignCreated: "Kampaň vytvořena", errorTitle: "Chyba",
    draft: "Koncept", statSending: "Odesílá se", statSent: "Odeslána",
  },
  hu: {
    pageTitle: "Partneradatok frissítése", pageDesc: "E-mail kampányok, amelyekben biztonságos linken keresztül kérjük a partnerek adatainak frissítését.",
    newCampaign: "Új kampány", name: "Kampány neve", senderMailbox: "Küldő postafiók", subject: "E-mail tárgya", body: "E-mail szövege (HTML)",
    bodyHint: "Elérhető változók: {{firstName}}, {{lastName}}, {{fullName}}, {{titleBefore}}, {{link}}. Ha a {{link}} hiányzik, a link automatikusan hozzáadódik.",
    validDays: "Link érvényessége (nap)", filter: "Címzett szűrő", countries: "Országok", collabType: "Partner típusa (opcionális)",
    onlyActive: "Csak aktívak", dataSource: "Adatforrás (opcionális, pl. iscbc)", legacyIds: "Legacy ID-k (opcionális, lista beillesztése)",
    preview: "Címzettek előnézete", recipients: "címzett", create: "Kampány létrehozása", creating: "Létrehozás…",
    back: "Vissza", sendEmails: "E-mailek küldése", remind: "Emlékeztető küldése", sending: "Küldés…",
    statusPending: "Függőben", statusSent: "Elküldve", statusFailed: "Sikertelen", statusOpened: "Megnyitva", statusSubmitted: "Kitöltve", statusApproved: "Jóváhagyva", statusRejected: "Elutasítva",
    tabRecipients: "Címzettek", tabApprovals: "Jóváhagyási sor", collaborator: "Partner", email: "E-mail", status: "Állapot", sentAt: "Elküldve", submittedAt: "Kitöltve",
    changes: "módosítás", noChanges: "Megerősítve módosítás nélkül", fieldCol: "Mező", oldVal: "Eredeti", newVal: "Új",
    approve: "Jóváhagyás", reject: "Elutasítás", approved: "Módosítások jóváhagyva és rögzítve", rejected: "Beküldés elutasítva",
    language: "E-mail és űrlap nyelve", langAuto: "Automatikus (a partner országa szerint)", insertSample: "Mintaszöveg beszúrása",
    agreementTypeL: "Szerződés/megállapodás típusa", partnerCategoryL: "Partner kategória", rewardTypeL: "Jutalom típusa",
    isManagerL: "Menedzser", monthRewardsL: "Havi jutalmak", anyOpt: "Mind", yesOpt: "Igen", noOpt: "Nem",
    testSend: "Teszt e-mail", testEmailLabel: "Teszt küldése erre a címre", testSent: "Teszt e-mail elküldve", testLinkLabel: "Teszt űrlap link", testDesc: "Az e-mail az első címzett mintaadataival kerül kiküldésre. A link teljesen működőképes — az űrlap kitölthető, beküldhető, majd a jóváhagyási sorban jóváhagyható vagy elutasítható.",
    emailsSending: "Az e-mailek küldése a háttérben folyik", noCampaigns: "Még nincs kampány. Hozza létre az elsőt.",
    noApprovals: "Nincs ellenőrzésre váró beküldés.", createdFmt: "Létrehozva", campaignCreated: "Kampány létrehozva", errorTitle: "Hiba",
    draft: "Piszkozat", statSending: "Küldés folyamatban", statSent: "Elküldve",
  },
  ro: {
    pageTitle: "Actualizarea datelor colaboratorilor", pageDesc: "Campanii de e-mail prin care colaboratorii își actualizează datele printr-un link securizat.",
    newCampaign: "Campanie nouă", name: "Numele campaniei", senderMailbox: "Căsuța expeditoare", subject: "Subiectul e-mailului", body: "Corpul e-mailului (HTML)",
    bodyHint: "Variabile disponibile: {{firstName}}, {{lastName}}, {{fullName}}, {{titleBefore}}, {{link}}. Dacă {{link}} lipsește, linkul se adaugă automat.",
    validDays: "Valabilitatea linkului (zile)", filter: "Filtru destinatari", countries: "Țări", collabType: "Tip colaborator (opțional)",
    onlyActive: "Doar activi", dataSource: "Sursa datelor (opțional, ex. iscbc)", legacyIds: "ID-uri legacy (opțional, lipiți lista)",
    preview: "Previzualizare destinatari", recipients: "destinatari", create: "Creează campania", creating: "Se creează…",
    back: "Înapoi", sendEmails: "Trimite e-mailurile", remind: "Trimite memento", sending: "Se trimite…",
    statusPending: "În așteptare", statusSent: "Trimis", statusFailed: "Eșuat", statusOpened: "Deschis", statusSubmitted: "Completat", statusApproved: "Aprobat", statusRejected: "Respins",
    tabRecipients: "Destinatari", tabApprovals: "Coada de aprobare", collaborator: "Colaborator", email: "E-mail", status: "Stare", sentAt: "Trimis", submittedAt: "Completat",
    changes: "modificări", noChanges: "Confirmat fără modificări", fieldCol: "Câmp", oldVal: "Original", newVal: "Nou",
    approve: "Aprobă", reject: "Respinge", approved: "Modificări aprobate și aplicate", rejected: "Trimitere respinsă",
    language: "Limba e-mailului și formularului", langAuto: "Automat (după țara colaboratorului)", insertSample: "Inserează text model",
    agreementTypeL: "Tip contract/acord", partnerCategoryL: "Categorie partener", rewardTypeL: "Tip recompensă",
    isManagerL: "Manager", monthRewardsL: "Recompense lunare", anyOpt: "Toți", yesOpt: "Da", noOpt: "Nu",
    testSend: "E-mail de test", testEmailLabel: "Trimite un test la această adresă", testSent: "E-mail de test trimis", testLinkLabel: "Link de test al formularului", testDesc: "E-mailul se trimite cu datele exemplu ale primului destinatar. Linkul este complet funcțional — formularul poate fi completat, trimis și apoi aprobat sau respins în coada de aprobare.",
    emailsSending: "E-mailurile se trimit în fundal", noCampaigns: "Nicio campanie încă. Creați prima.",
    noApprovals: "Nicio completare în așteptarea verificării.", createdFmt: "Creat", campaignCreated: "Campanie creată", errorTitle: "Eroare",
    draft: "Ciornă", statSending: "Se trimite", statSent: "Trimisă",
  },
  it: {
    pageTitle: "Aggiornamento dati collaboratori", pageDesc: "Campagne e-mail per chiedere ai collaboratori di aggiornare i propri dati tramite link sicuro.",
    newCampaign: "Nuova campagna", name: "Nome campagna", senderMailbox: "Casella mittente", subject: "Oggetto e-mail", body: "Corpo e-mail (HTML)",
    bodyHint: "Variabili disponibili: {{firstName}}, {{lastName}}, {{fullName}}, {{titleBefore}}, {{link}}. Se manca {{link}}, il link viene aggiunto automaticamente.",
    validDays: "Validità del link (giorni)", filter: "Filtro destinatari", countries: "Paesi", collabType: "Tipo collaboratore (opzionale)",
    onlyActive: "Solo attivi", dataSource: "Origine dati (opzionale, es. iscbc)", legacyIds: "ID legacy (opzionale, incolla elenco)",
    preview: "Anteprima destinatari", recipients: "destinatari", create: "Crea campagna", creating: "Creazione…",
    back: "Indietro", sendEmails: "Invia e-mail", remind: "Invia promemoria", sending: "Invio…",
    statusPending: "In attesa", statusSent: "Inviato", statusFailed: "Fallito", statusOpened: "Aperto", statusSubmitted: "Compilato", statusApproved: "Approvato", statusRejected: "Respinto",
    tabRecipients: "Destinatari", tabApprovals: "Coda di approvazione", collaborator: "Collaboratore", email: "E-mail", status: "Stato", sentAt: "Inviato", submittedAt: "Compilato",
    changes: "modifiche", noChanges: "Confermato senza modifiche", fieldCol: "Campo", oldVal: "Originale", newVal: "Nuovo",
    approve: "Approva", reject: "Respingi", approved: "Modifiche approvate e applicate", rejected: "Invio respinto",
    language: "Lingua di e-mail e modulo", langAuto: "Automatica (per paese del collaboratore)", insertSample: "Inserisci testo di esempio",
    agreementTypeL: "Tipo di contratto/accordo", partnerCategoryL: "Categoria partner", rewardTypeL: "Tipo di ricompensa",
    isManagerL: "Manager", monthRewardsL: "Ricompense mensili", anyOpt: "Tutti", yesOpt: "Sì", noOpt: "No",
    testSend: "E-mail di prova", testEmailLabel: "Invia una prova a questo indirizzo", testSent: "E-mail di prova inviata", testLinkLabel: "Link di prova del modulo", testDesc: "L'e-mail viene inviata con i dati di esempio del primo destinatario. Il link è pienamente funzionante — il modulo può essere compilato, inviato e poi approvato o respinto nella coda di approvazione.",
    emailsSending: "Le e-mail vengono inviate in background", noCampaigns: "Nessuna campagna. Creane una.",
    noApprovals: "Nessuna compilazione in attesa di verifica.", createdFmt: "Creato", campaignCreated: "Campagna creata", errorTitle: "Errore",
    draft: "Bozza", statSending: "Invio in corso", statSent: "Inviata",
  },
  de: {
    pageTitle: "Aktualisierung der Partnerdaten", pageDesc: "E-Mail-Kampagnen, mit denen Partner über einen sicheren Link ihre Daten aktualisieren.",
    newCampaign: "Neue Kampagne", name: "Kampagnenname", senderMailbox: "Absender-Postfach", subject: "E-Mail-Betreff", body: "E-Mail-Text (HTML)",
    bodyHint: "Verfügbare Variablen: {{firstName}}, {{lastName}}, {{fullName}}, {{titleBefore}}, {{link}}. Fehlt {{link}}, wird der Link automatisch angehängt.",
    validDays: "Gültigkeit des Links (Tage)", filter: "Empfängerfilter", countries: "Länder", collabType: "Partnertyp (optional)",
    onlyActive: "Nur aktive", dataSource: "Datenquelle (optional, z. B. iscbc)", legacyIds: "Legacy-IDs (optional, Liste einfügen)",
    preview: "Empfängervorschau", recipients: "Empfänger", create: "Kampagne erstellen", creating: "Wird erstellt…",
    back: "Zurück", sendEmails: "E-Mails senden", remind: "Erinnerung senden", sending: "Wird gesendet…",
    statusPending: "Ausstehend", statusSent: "Gesendet", statusFailed: "Fehlgeschlagen", statusOpened: "Geöffnet", statusSubmitted: "Ausgefüllt", statusApproved: "Genehmigt", statusRejected: "Abgelehnt",
    tabRecipients: "Empfänger", tabApprovals: "Genehmigungswarteschlange", collaborator: "Partner", email: "E-Mail", status: "Status", sentAt: "Gesendet", submittedAt: "Ausgefüllt",
    changes: "Änderungen", noChanges: "Ohne Änderungen bestätigt", fieldCol: "Feld", oldVal: "Original", newVal: "Neu",
    approve: "Genehmigen", reject: "Ablehnen", approved: "Änderungen genehmigt und übernommen", rejected: "Einreichung abgelehnt",
    language: "Sprache von E-Mail und Formular", langAuto: "Automatisch (nach Land des Partners)", insertSample: "Mustertext einfügen",
    agreementTypeL: "Vertrags-/Vereinbarungstyp", partnerCategoryL: "Partnerkategorie", rewardTypeL: "Vergütungstyp",
    isManagerL: "Manager", monthRewardsL: "Monatliche Vergütungen", anyOpt: "Alle", yesOpt: "Ja", noOpt: "Nein",
    testSend: "Test-E-Mail", testEmailLabel: "Test an diese Adresse senden", testSent: "Test-E-Mail gesendet", testLinkLabel: "Test-Link zum Formular", testDesc: "Die E-Mail wird mit Beispieldaten des ersten Empfängers gesendet. Der Link ist voll funktionsfähig — das Formular kann ausgefüllt, abgesendet und dann in der Genehmigungswarteschlange genehmigt oder abgelehnt werden.",
    emailsSending: "E-Mails werden im Hintergrund gesendet", noCampaigns: "Noch keine Kampagnen. Erstellen Sie die erste.",
    noApprovals: "Keine Einreichungen zur Prüfung.", createdFmt: "Erstellt", campaignCreated: "Kampagne erstellt", errorTitle: "Fehler",
    draft: "Entwurf", statSending: "Wird gesendet", statSent: "Gesendet",
  },
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  send_failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  opened: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  submitted: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export default function CollaboratorUpdatesPage() {
  const { locale } = useI18n();
  const l = L[locale] || L.en;
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: campaigns = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/collaborator-update-campaigns"],
  });

  const selected = campaigns.find(c => c.id === selectedId);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {!selected ? (
        <>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">{l.pageTitle}</h1>
              <p className="text-muted-foreground text-sm">{l.pageDesc}</p>
            </div>
            <Button onClick={() => setCreateOpen(true)} data-testid="button-new-campaign">
              <Plus className="h-4 w-4 mr-2" />{l.newCampaign}
            </Button>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : campaigns.length === 0 ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground">{l.noCampaigns}</CardContent></Card>
          ) : (
            <div className="grid gap-4">
              {campaigns.map(c => {
                const total = Object.values(c.stats || {}).reduce((a: number, b: any) => a + b, 0);
                return (
                  <Card key={c.id} className="cursor-pointer hover-elevate" onClick={() => setSelectedId(c.id)} data-testid={`card-campaign-${c.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <CardTitle className="text-lg">{c.name}</CardTitle>
                        <Badge variant="outline">
                          {c.status === "draft" ? l.draft : c.status === "sending" ? l.statSending : l.statSent}
                        </Badge>
                      </div>
                      <CardDescription>
                        {l.createdFmt}: {format(new Date(c.createdAt), "dd.MM.yyyy HH:mm")} · <Users className="h-3 w-3 inline" /> {total} · <Mail className="h-3 w-3 inline" /> {c.senderCountryCode}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex gap-2 flex-wrap pt-0">
                      {Object.entries(c.stats || {}).map(([st, n]) => (
                        <Badge key={st} className={STATUS_COLORS[st] || ""} variant="secondary">
                          {(l as any)[`status${st === "send_failed" ? "Failed" : st.charAt(0).toUpperCase() + st.slice(1)}`] || st}: {n as number}
                        </Badge>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          <CreateCampaignDialog open={createOpen} onOpenChange={setCreateOpen} l={l} toast={toast} />
        </>
      ) : (
        <CampaignDetail campaign={selected} l={l} toast={toast} onBack={() => setSelectedId(null)} />
      )}
    </div>
  );
}

function OptionSelect({ label, value, onChange, options, anyLabel, testId }: any) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value || "__any"} onValueChange={(v) => onChange(v === "__any" ? "" : v)}>
        <SelectTrigger data-testid={testId}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__any">{anyLabel}</SelectItem>
          {options.map((o: string) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function YesNoSelect({ label, value, onChange, l, testId }: any) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value || "__any"} onValueChange={(v) => onChange(v === "__any" ? "" : v)}>
        <SelectTrigger data-testid={testId}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__any">{l.anyOpt}</SelectItem>
          <SelectItem value="yes">{l.yesOpt}</SelectItem>
          <SelectItem value="no">{l.noOpt}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function CreateCampaignDialog({ open, onOpenChange, l, toast }: any) {
  const [name, setName] = useState("");
  const [senderCountryCode, setSenderCountryCode] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [tokenValidDays, setTokenValidDays] = useState(30);
  const [language, setLanguage] = useState("auto");
  const [countries, setCountries] = useState<string[]>([]);
  const [collabType, setCollabType] = useState("");
  const [agreementType, setAgreementType] = useState("");
  const [partnerCategory, setPartnerCategory] = useState("");
  const [rewardType, setRewardType] = useState("");
  const [isManager, setIsManager] = useState("");
  const [monthRewards, setMonthRewards] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [dataSource, setDataSource] = useState("");
  const [legacyIds, setLegacyIds] = useState("");
  const [preview, setPreview] = useState<{ count: number; recipients: any[] } | null>(null);

  const { data: connections = [] } = useQuery<any[]>({
    queryKey: ["/api/config/system-ms365-connections"],
    enabled: open,
  });
  const { data: filterOptions } = useQuery<any>({
    queryKey: ["/api/collaborator-update-campaigns/filter-options"],
    enabled: open,
  });

  const insertSample = () => {
    const tpl = SAMPLE_TEMPLATES[language !== "auto" ? language : "sk"] || SAMPLE_TEMPLATES.sk;
    setEmailSubject(tpl.subject);
    setEmailBody(tpl.body);
  };

  const filterCriteria = useMemo(() => ({
    countryCodes: countries.length > 0 ? countries : undefined,
    collaboratorType: collabType || undefined,
    agreementType: agreementType || undefined,
    partnerCategory: partnerCategory || undefined,
    rewardType: rewardType || undefined,
    isManager: isManager === "" ? undefined : isManager === "yes",
    monthRewards: monthRewards === "" ? undefined : monthRewards === "yes",
    isActive: onlyActive ? true : undefined,
    dataSource: dataSource || undefined,
    legacyIds: legacyIds || undefined,
  }), [countries, collabType, agreementType, partnerCategory, rewardType, isManager, monthRewards, onlyActive, dataSource, legacyIds]);

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/collaborator-update-campaigns/preview", { filterCriteria });
      return res.json();
    },
    onSuccess: (data) => setPreview(data),
    onError: (e: any) => toast({ title: l.errorTitle, description: e?.message, variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/collaborator-update-campaigns", {
        name, senderCountryCode, emailSubject, emailBody, language, tokenValidDays, filterCriteria,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborator-update-campaigns"] });
      toast({ title: l.campaignCreated });
      onOpenChange(false);
      setName(""); setEmailSubject(""); setEmailBody(""); setPreview(null);
    },
    onError: (e: any) => toast({ title: l.errorTitle, description: e?.message, variant: "destructive" }),
  });

  const canCreate = name.trim() && senderCountryCode && emailSubject.trim() && emailBody.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{l.newCampaign}</DialogTitle>
          <DialogDescription>{l.pageDesc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{l.name}</Label>
            <Input value={name} onChange={e => setName(e.target.value)} data-testid="input-campaign-name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{l.senderMailbox}</Label>
              <Select value={senderCountryCode} onValueChange={setSenderCountryCode}>
                <SelectTrigger data-testid="select-sender"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {connections.filter((c: any) => c.isConnected).map((c: any) => (
                    <SelectItem key={c.countryCode} value={c.countryCode}>
                      {c.email} ({c.countryCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{l.validDays}</Label>
              <Input type="number" min={1} max={365} value={tokenValidDays}
                onChange={e => setTokenValidDays(parseInt(e.target.value) || 30)} data-testid="input-valid-days" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{l.language}</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger data-testid="select-language"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{l.langAuto}</SelectItem>
                {FORM_LANGS.map(lang => (
                  <SelectItem key={lang} value={lang}>{lang.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label>{l.subject}</Label>
              <Button type="button" variant="outline" size="sm" onClick={insertSample} data-testid="button-insert-sample">
                <Mail className="h-4 w-4 mr-2" />{l.insertSample}
              </Button>
            </div>
            <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} data-testid="input-subject" />
          </div>
          <div className="space-y-1.5">
            <Label>{l.body}</Label>
            <Textarea rows={8} value={emailBody} onChange={e => setEmailBody(e.target.value)} data-testid="input-body" />
            <p className="text-xs text-muted-foreground">{l.bodyHint}</p>
          </div>

          <div className="border rounded-md p-4 space-y-3">
            <h4 className="font-semibold text-sm">{l.filter}</h4>
            <div className="space-y-1.5">
              <Label>{l.countries}</Label>
              <div className="flex flex-wrap gap-3">
                {COUNTRY_OPTIONS.map(cc => (
                  <label key={cc} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={countries.includes(cc)}
                      onCheckedChange={(v) => setCountries(prev => v ? [...prev, cc] : prev.filter(x => x !== cc))}
                      data-testid={`checkbox-country-${cc}`}
                    />
                    {cc}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <OptionSelect label={l.collabType} value={collabType} onChange={setCollabType}
                options={filterOptions?.collaboratorTypes || []} anyLabel={l.anyOpt} testId="select-collab-type" />
              <OptionSelect label={l.agreementTypeL} value={agreementType} onChange={setAgreementType}
                options={filterOptions?.agreementTypes || []} anyLabel={l.anyOpt} testId="select-agreement-type" />
              <OptionSelect label={l.partnerCategoryL} value={partnerCategory} onChange={setPartnerCategory}
                options={filterOptions?.partnerCategories || []} anyLabel={l.anyOpt} testId="select-partner-category" />
              <OptionSelect label={l.rewardTypeL} value={rewardType} onChange={setRewardType}
                options={filterOptions?.rewardTypes || []} anyLabel={l.anyOpt} testId="select-reward-type" />
              <OptionSelect label={l.dataSource} value={dataSource} onChange={setDataSource}
                options={filterOptions?.dataSources || []} anyLabel={l.anyOpt} testId="select-data-source" />
              <div className="grid grid-cols-2 gap-4">
                <YesNoSelect label={l.isManagerL} value={isManager} onChange={setIsManager} l={l} testId="select-is-manager" />
                <YesNoSelect label={l.monthRewardsL} value={monthRewards} onChange={setMonthRewards} l={l} testId="select-month-rewards" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={onlyActive} onCheckedChange={v => setOnlyActive(!!v)} data-testid="checkbox-only-active" />
              {l.onlyActive}
            </label>
            <div className="space-y-1.5">
              <Label>{l.legacyIds}</Label>
              <Textarea rows={3} value={legacyIds} onChange={e => setLegacyIds(e.target.value)} data-testid="input-legacy-ids" />
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending} data-testid="button-preview">
                {previewMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
                {l.preview}
              </Button>
              {preview && <span className="text-sm font-medium" data-testid="text-preview-count">{preview.count} {l.recipients}</span>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => createMutation.mutate()} disabled={!canCreate || createMutation.isPending} data-testid="button-create-campaign">
            {createMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{l.creating}</> : l.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TestSendDialog({ campaignId, l, toast, open, onOpenChange }: any) {
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/collaborator-update-campaigns/${campaignId}/test`, { email });
      return res.json();
    },
    onSuccess: (data) => {
      setLink(data.link || null);
      if (data.ok) {
        toast({ title: l.testSent });
      } else {
        toast({ title: l.errorTitle, description: data.message, variant: "destructive" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/collaborator-update-campaigns", campaignId, "requests"] });
    },
    onError: (e: any) => toast({ title: l.errorTitle, description: e?.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setLink(null); setEmail(""); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{l.testSend}</DialogTitle>
          <DialogDescription>{l.testDesc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{l.testEmailLabel}</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} data-testid="input-test-email" />
          </div>
          {link && (
            <div className="space-y-1.5">
              <Label>{l.testLinkLabel}</Label>
              <a href={link} target="_blank" rel="noreferrer" className="block text-sm text-sky-600 dark:text-sky-400 underline break-all" data-testid="link-test-form">{link}</a>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => testMutation.mutate()} disabled={!email.includes("@") || testMutation.isPending} data-testid="button-send-test">
            {testMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {l.testSend}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CampaignDetail({ campaign, l, toast, onBack }: any) {
  const [testOpen, setTestOpen] = useState(false);
  const { data: requests = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/collaborator-update-campaigns", campaign.id, "requests"],
    queryFn: async () => {
      const res = await fetch(`/api/collaborator-update-campaigns/${campaign.id}/requests`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load requests");
      return res.json();
    },
    refetchInterval: campaign.status === "sending" ? 5000 : false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/collaborator-update-campaigns"] });
    queryClient.invalidateQueries({ queryKey: ["/api/collaborator-update-campaigns", campaign.id, "requests"] });
  };

  const sendMutation = useMutation({
    mutationFn: async (kind: "send" | "remind") => {
      const res = await apiRequest("POST", `/api/collaborator-update-campaigns/${campaign.id}/${kind}`);
      return res.json();
    },
    onSuccess: () => { toast({ title: l.emailsSending }); invalidate(); },
    onError: (e: any) => toast({ title: l.errorTitle, description: e?.message, variant: "destructive" }),
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" }) => {
      const res = await apiRequest("POST", `/api/collaborator-update-requests/${id}/${action}`);
      return res.json();
    },
    onSuccess: (_d, vars) => {
      toast({ title: vars.action === "approve" ? l.approved : l.rejected });
      invalidate();
    },
    onError: (e: any) => toast({ title: l.errorTitle, description: e?.message, variant: "destructive" }),
  });

  const statusLabel = (st: string) => (l as any)[`status${st === "send_failed" ? "Failed" : st.charAt(0).toUpperCase() + st.slice(1)}`] || st;
  const submitted = requests.filter(r => r.status === "submitted");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back"><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-campaign-name">{campaign.name}</h1>
            <p className="text-sm text-muted-foreground">{campaign.senderCountryCode} · {format(new Date(campaign.createdAt), "dd.MM.yyyy HH:mm")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTestOpen(true)} data-testid="button-test">
            {l.testSend}
          </Button>
          <Button onClick={() => sendMutation.mutate("send")} disabled={sendMutation.isPending || campaign.status === "sending"} data-testid="button-send">
            {campaign.status === "sending" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {campaign.status === "sending" ? l.sending : l.sendEmails}
          </Button>
          <Button variant="outline" onClick={() => sendMutation.mutate("remind")} disabled={sendMutation.isPending || campaign.status === "sending"} data-testid="button-remind">
            <Bell className="h-4 w-4 mr-2" />{l.remind}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="recipients">
        <TabsList>
          <TabsTrigger value="recipients" data-testid="tab-recipients">{l.tabRecipients} ({requests.length})</TabsTrigger>
          <TabsTrigger value="approvals" data-testid="tab-approvals">{l.tabApprovals} ({submitted.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="recipients">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{l.collaborator}</TableHead>
                    <TableHead>{l.email}</TableHead>
                    <TableHead>{l.status}</TableHead>
                    <TableHead>{l.sentAt}</TableHead>
                    <TableHead>{l.submittedAt}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map(r => (
                    <TableRow key={r.id} data-testid={`row-request-${r.id}`}>
                      <TableCell>{r.collaboratorName} <span className="text-xs text-muted-foreground">({r.countryCode})</span></TableCell>
                      <TableCell className="text-sm">{r.email}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[r.status] || ""} variant="secondary">{statusLabel(r.status)}</Badge>
                        {r.sendError && <p className="text-xs text-red-500 mt-0.5">{r.sendError}</p>}
                      </TableCell>
                      <TableCell className="text-sm">{r.sentAt ? format(new Date(r.sentAt), "dd.MM. HH:mm") : "—"}</TableCell>
                      <TableCell className="text-sm">{r.submittedAt ? format(new Date(r.submittedAt), "dd.MM. HH:mm") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="approvals">
          {submitted.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">{l.noApprovals}</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {submitted.map(r => (
                <Card key={r.id} data-testid={`card-approval-${r.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <CardTitle className="text-base">{r.collaboratorName} <span className="text-sm font-normal text-muted-foreground">({r.email})</span></CardTitle>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => reviewMutation.mutate({ id: r.id, action: "approve" })} disabled={reviewMutation.isPending} data-testid={`button-approve-${r.id}`}>
                          <Check className="h-4 w-4 mr-1" />{l.approve}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => reviewMutation.mutate({ id: r.id, action: "reject" })} disabled={reviewMutation.isPending} data-testid={`button-reject-${r.id}`}>
                          <X className="h-4 w-4 mr-1" />{l.reject}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {(r.changes || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">{l.noChanges}</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{l.fieldCol}</TableHead>
                            <TableHead>{l.oldVal}</TableHead>
                            <TableHead>{l.newVal}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(r.changes || []).map((ch: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-xs">{ch.field}</TableCell>
                              <TableCell className="text-sm text-red-600 dark:text-red-400">{ch.oldValue || "—"}</TableCell>
                              <TableCell className="text-sm text-green-600 dark:text-green-400 font-medium">{ch.newValue || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <TestSendDialog campaignId={campaign.id} l={l} toast={toast} open={testOpen} onOpenChange={setTestOpen} />
    </div>
  );
}
