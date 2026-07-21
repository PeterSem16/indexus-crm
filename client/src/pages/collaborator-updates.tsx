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
import { Loader2, Plus, Send, Bell, ArrowLeft, Check, X, Users, Mail, Trash2, Filter, Pause, RefreshCw, ChevronLeft, ChevronRight, Pencil, Search } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

// JMHZ email template (Czech only — CZ zákon č. 323/2025 Sb.), per document
// "01_Email_dohodari_JMHZ". Placeholders [DOPLNIT ...] are left for the admin to fill in.
const JMHZ_EMAIL_TEMPLATE: { subject: string; body: string } = {
  subject: "Nová zákonná povinnost — jednotné měsíční hlášení zaměstnavatele (JMHZ) — potřebujeme doplnit Vaše údaje",
  body: `<p>Vážená paní doktorko / Vážený pane doktore,</p>
<p>od 1. ledna 2026 je účinný zákon č. 323/2025 Sb., kterým se zavádí jednotné měsíční hlášení zaměstnavatele (JMHZ) vůči České správě sociálního zabezpečení; řádné měsíční hlášení se podává od dubna 2026 (do 20. dne následujícího měsíce). Povinnost se vztahuje na všechny zaměstnavatele bez výjimky a dopadá i na spolupracovníky na dohodu o provedení práce / o pracovní činnosti — tedy i na Vás jako našeho smluvního partnera.</p>
<p>Abychom mohli hlášení řádně a včas podávat, potřebujeme od Vás doplnit následující údaje, které v naší evidenci doposud chybí:</p>
<ul>
<li>nejvyšší dosažené vzdělání,</li>
<li>místo a stát (země) narození,</li>
<li>rodné příjmení (pokud se liší od současného),</li>
<li>vykonávaná profese / pozice,</li>
<li>vzdělání vyžadované pro výkon této profese,</li>
<li>místo výkonu práce / činnosti,</li>
<li>informace, zda se jedná o tzv. vedoucího zaměstnance (ano/ne).</li>
</ul>
<p>Z důvodu ochrany osobních údajů Vás prosíme o vyplnění výhradně přes zabezpečený šifrovaný webový formulář, nikoli odpovědí na tento e-mail:</p>
<p><a href="{{link}}">{{link}}</a></p>
<p>Údaje, prosíme, vyplňte nejpozději do [DOPLNIT TERMÍN]. Bez těchto údajů nejsme schopni splnit zákonnou ohlašovací povinnost za Vaši osobu, což může vystavit obě strany riziku sankce ze strany ČSSZ.</p>
<p>Vámi poskytnuté údaje budou použity výhradně pro účely tohoto zákonného hlášení a budou zpracovány v souladu s GDPR (viz informace o zpracování osobních údajů v rámci formuláře).</p>
<p>V případě dotazů se obraťte na [JMÉNO / KONTAKT — DOPLNIT].</p>
<p>Děkujeme za spolupráci a omlouváme se za případné komplikace způsobené touto novou legislativní povinností.</p>
<p>S pozdravem,</p>
<p>[JMÉNO, POZICE — DOPLNIT]<br/>Cord Blood Center</p>`,
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
    isManagerL: "Manager", monthRewardsL: "Monthly rewards", anyOpt: "Any", yesOpt: "Yes", noOpt: "No", agreementActiveL: "Agreement active on date",
    testSend: "Test email", testEmailLabel: "Send a test to this address", testSent: "Test email sent", testLinkLabel: "Test form link", testDesc: "The email and the form use only fictional test data — no real collaborator data is shown. The link works fully — you can fill in the form, submit it, and then approve or reject it in the approval queue.",
    emailsSending: "Emails are being sent in the background", noCampaigns: "No campaigns yet. Create one to get started.",
    noApprovals: "No submissions waiting for review.", createdFmt: "Created", campaignCreated: "Campaign created", errorTitle: "Error",
    draft: "Draft", statSending: "Sending", statSent: "Sent",
    formTypeL: "Form type", formTypeUpdate: "Personal data update", formTypeJmhz: "JMHZ (CZ act 323/2025 Coll.)",
    insertJmhzSample: "Insert JMHZ template (CZ)",
    deleteCampaign: "Delete campaign", deleteConfirmT: "Delete this campaign?", deleteConfirmD: "The campaign and all its links will be permanently deleted. Links already sent will stop working.",
    deleted: "Campaign deleted", cancel: "Cancel", confirmDelete: "Delete",
    editFilter: "Edit filter", editFilterD: "Available only for drafts before sending. The recipient list will be regenerated from the new filter.",
    filterSaved: "Filter saved, recipients regenerated", save: "Save",
    statPaused: "Paused", resume: "Resume sending", pause: "Pause sending", pausedToast: "Sending paused",
    sendConfirmT: "Start sending emails?", sendConfirmD: "Emails with the form link will be sent to all pending recipients. This cannot be undone for emails already sent.",
    remindConfirmT: "Send reminders?", remindConfirmD: "A reminder email will be sent to everyone who received the link but has not submitted the form yet.",
    confirmSend: "Yes, send",
    refresh: "Refresh", removeReq: "Remove from queue", removeConfirmT: "Remove this recipient?",
    removeConfirmD: "The recipient will be removed from the sending queue and their link will stop working. This cannot be undone.",
    removedToast: "Recipient removed",
    queueStarted: "Queue started", queuePaused: "Queue paused", queueFinished: "Queue finished",
    statsTitle: "Statistics", statTotal: "Recipients with email", statNoEmail: "Matched without email",
    settings: "Campaign settings", settingsD: "Edit the campaign name, email subject and body. Changes only apply to emails that have not been sent yet (available for drafts and paused campaigns).",
    settingsSaved: "Settings saved", searchPh: "Search by name, email or status…", noResults: "Nothing matches the search.",
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
    isManagerL: "Manažér", monthRewardsL: "Mesačné odmeny", anyOpt: "Všetci", yesOpt: "Áno", noOpt: "Nie", agreementActiveL: "Zmluva aktívna k dátumu",
    testSend: "Testovací e-mail", testEmailLabel: "Poslať test na túto adresu", testSent: "Testovací e-mail odoslaný", testLinkLabel: "Testovací odkaz na formulár", testDesc: "E-mail aj formulár používajú iba fiktívne testovacie údaje — údaje skutočného spolupracovníka sa nikde nezobrazia. Odkaz je plne funkčný — formulár môžeš vyplniť, odoslať a potom v schvaľovacom rade schváliť alebo zamietnuť.",
    emailsSending: "E-maily sa odosielajú na pozadí", noCampaigns: "Zatiaľ žiadne kampane. Vytvor prvú.",
    noApprovals: "Žiadne vyplnenia nečakajú na kontrolu.", createdFmt: "Vytvorené", campaignCreated: "Kampaň vytvorená", errorTitle: "Chyba",
    draft: "Koncept", statSending: "Odosiela sa", statSent: "Odoslaná",
    formTypeL: "Typ formulára", formTypeUpdate: "Aktualizácia osobných údajov", formTypeJmhz: "JMHZ (CZ zákon 323/2025 Sb.)",
    insertJmhzSample: "Vložiť JMHZ šablónu (CZ)",
    deleteCampaign: "Vymazať kampaň", deleteConfirmT: "Vymazať túto kampaň?", deleteConfirmD: "Kampaň a všetky jej odkazy budú natrvalo vymazané. Už odoslané odkazy prestanú fungovať.",
    deleted: "Kampaň vymazaná", cancel: "Zrušiť", confirmDelete: "Vymazať",
    editFilter: "Upraviť filter", editFilterD: "Dostupné len pre koncepty pred odoslaním. Zoznam príjemcov sa znovu vytvorí podľa nového filtra.",
    filterSaved: "Filter uložený, príjemcovia znovu vytvorení", save: "Uložiť",
    statPaused: "Pozastavená", resume: "Pokračovať v posielaní", pause: "Pozastaviť posielanie", pausedToast: "Posielanie pozastavené",
    sendConfirmT: "Spustiť posielanie e-mailov?", sendConfirmD: "E-maily s odkazom na formulár sa odošlú všetkým čakajúcim príjemcom. Už odoslané e-maily sa nedajú vziať späť.",
    remindConfirmT: "Poslať pripomienky?", remindConfirmD: "Pripomienka sa pošle všetkým, ktorí odkaz dostali, ale formulár ešte nevyplnili.",
    confirmSend: "Áno, odoslať",
    refresh: "Obnoviť", removeReq: "Vyradiť z posielania", removeConfirmT: "Vyradiť tohto príjemcu?",
    removeConfirmD: "Príjemca bude vyradený z frontu posielania a jeho odkaz prestane fungovať. Táto akcia sa nedá vrátiť.",
    removedToast: "Príjemca vyradený",
    queueStarted: "Front spustený", queuePaused: "Front pozastavený", queueFinished: "Front dokončený",
    statsTitle: "Štatistika", statTotal: "Príjemcovia s e-mailom", statNoEmail: "Vo filtri bez e-mailu",
    settings: "Nastavenia kampane", settingsD: "Upravte názov kampane, predmet a text e-mailu. Zmeny sa použijú len pri e-mailoch, ktoré ešte neboli odoslané (dostupné pre koncepty a pozastavené kampane).",
    settingsSaved: "Nastavenia uložené", searchPh: "Hľadať podľa mena, e-mailu alebo stavu…", noResults: "Vyhľadávaniu nič nezodpovedá.",
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
    isManagerL: "Manažer", monthRewardsL: "Měsíční odměny", anyOpt: "Všichni", yesOpt: "Ano", noOpt: "Ne", agreementActiveL: "Smlouva aktivní k datu",
    testSend: "Testovací e-mail", testEmailLabel: "Poslat test na tuto adresu", testSent: "Testovací e-mail odeslán", testLinkLabel: "Testovací odkaz na formulář", testDesc: "E-mail i formulář používají pouze fiktivní testovací údaje — údaje skutečného spolupracovníka se nikde nezobrazí. Odkaz je plně funkční — formulář lze vyplnit, odeslat a poté ve schvalovací frontě schválit nebo zamítnout.",
    emailsSending: "E-maily se odesílají na pozadí", noCampaigns: "Zatím žádné kampaně. Vytvořte první.",
    noApprovals: "Žádná vyplnění nečekají na kontrolu.", createdFmt: "Vytvořeno", campaignCreated: "Kampaň vytvořena", errorTitle: "Chyba",
    draft: "Koncept", statSending: "Odesílá se", statSent: "Odeslána",
    formTypeL: "Typ formuláře", formTypeUpdate: "Aktualizace osobních údajů", formTypeJmhz: "JMHZ (zákon č. 323/2025 Sb.)",
    insertJmhzSample: "Vložit JMHZ šablonu (CZ)",
    deleteCampaign: "Smazat kampaň", deleteConfirmT: "Smazat tuto kampaň?", deleteConfirmD: "Kampaň a všechny její odkazy budou trvale smazány. Již odeslané odkazy přestanou fungovat.",
    deleted: "Kampaň smazána", cancel: "Zrušit", confirmDelete: "Smazat",
    editFilter: "Upravit filtr", editFilterD: "Dostupné pouze pro koncepty před odesláním. Seznam příjemců se znovu vytvoří podle nového filtru.",
    filterSaved: "Filtr uložen, příjemci znovu vytvořeni", save: "Uložit",
    statPaused: "Pozastavena", resume: "Pokračovat v odesílání", pause: "Pozastavit odesílání", pausedToast: "Odesílání pozastaveno",
    sendConfirmT: "Spustit odesílání e-mailů?", sendConfirmD: "E-maily s odkazem na formulář se odešlou všem čekajícím příjemcům. Již odeslané e-maily nelze vzít zpět.",
    remindConfirmT: "Odeslat připomínky?", remindConfirmD: "Připomínka se odešle všem, kteří odkaz dostali, ale formulář ještě nevyplnili.",
    confirmSend: "Ano, odeslat",
    refresh: "Obnovit", removeReq: "Vyřadit z odesílání", removeConfirmT: "Vyřadit tohoto příjemce?",
    removeConfirmD: "Příjemce bude vyřazen z fronty odesílání a jeho odkaz přestane fungovat. Tuto akci nelze vrátit.",
    removedToast: "Příjemce vyřazen",
    queueStarted: "Fronta spuštěna", queuePaused: "Fronta pozastavena", queueFinished: "Fronta dokončena",
    statsTitle: "Statistika", statTotal: "Příjemci s e-mailem", statNoEmail: "Ve filtru bez e-mailu",
    settings: "Nastavení kampaně", settingsD: "Upravte název kampaně, předmět a text e-mailu. Změny se použijí jen u e-mailů, které ještě nebyly odeslány (dostupné pro koncepty a pozastavené kampaně).",
    settingsSaved: "Nastavení uloženo", searchPh: "Hledat podle jména, e-mailu nebo stavu…", noResults: "Vyhledávání nic neodpovídá.",
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
    isManagerL: "Menedzser", monthRewardsL: "Havi jutalmak", anyOpt: "Mind", yesOpt: "Igen", noOpt: "Nem", agreementActiveL: "Szerződés érvényes ekkor",
    testSend: "Teszt e-mail", testEmailLabel: "Teszt küldése erre a címre", testSent: "Teszt e-mail elküldve", testLinkLabel: "Teszt űrlap link", testDesc: "Az e-mail és az űrlap csak fiktív tesztadatokat használ — valódi partneradatok sehol nem jelennek meg. A link teljesen működőképes — az űrlap kitölthető, beküldhető, majd a jóváhagyási sorban jóváhagyható vagy elutasítható.",
    emailsSending: "Az e-mailek küldése a háttérben folyik", noCampaigns: "Még nincs kampány. Hozza létre az elsőt.",
    noApprovals: "Nincs ellenőrzésre váró beküldés.", createdFmt: "Létrehozva", campaignCreated: "Kampány létrehozva", errorTitle: "Hiba",
    draft: "Piszkozat", statSending: "Küldés folyamatban", statSent: "Elküldve",
    formTypeL: "Űrlap típusa", formTypeUpdate: "Személyes adatok frissítése", formTypeJmhz: "JMHZ (CZ 323/2025. sz. törvény)",
    insertJmhzSample: "JMHZ sablon beszúrása (CZ)",
    deleteCampaign: "Kampány törlése", deleteConfirmT: "Törli ezt a kampányt?", deleteConfirmD: "A kampány és minden linkje véglegesen törlődik. A már kiküldött linkek nem fognak működni.",
    deleted: "Kampány törölve", cancel: "Mégse", confirmDelete: "Törlés",
    editFilter: "Szűrő szerkesztése", editFilterD: "Csak piszkozatoknál érhető el a küldés előtt. A címzettlista az új szűrő alapján újra létrejön.",
    filterSaved: "Szűrő mentve, címzettek újragenerálva", save: "Mentés",
    statPaused: "Szüneteltetve", resume: "Küldés folytatása", pause: "Küldés szüneteltetése", pausedToast: "Küldés szüneteltetve",
    sendConfirmT: "Elindítja az e-mailek küldését?", sendConfirmD: "Az űrlap linkjét tartalmazó e-mailek minden várakozó címzettnek kimennek. A már elküldött e-mailek nem vonhatók vissza.",
    remindConfirmT: "Emlékeztetők küldése?", remindConfirmD: "Emlékeztető megy mindenkinek, aki megkapta a linket, de még nem töltötte ki az űrlapot.",
    confirmSend: "Igen, küldés",
    refresh: "Frissítés", removeReq: "Eltávolítás a küldésből", removeConfirmT: "Eltávolítja ezt a címzettet?",
    removeConfirmD: "A címzett kikerül a küldési sorból, és a linkje nem fog működni. Ez a művelet nem vonható vissza.",
    removedToast: "Címzett eltávolítva",
    queueStarted: "Sor elindítva", queuePaused: "Sor szüneteltetve", queueFinished: "Sor befejezve",
    statsTitle: "Statisztika", statTotal: "Címzettek e-maillel", statNoEmail: "Szűrt, e-mail nélkül",
    settings: "Kampánybeállítások", settingsD: "Szerkessze a kampány nevét, az e-mail tárgyát és szövegét. A módosítások csak a még el nem küldött e-mailekre érvényesek (piszkozatok és szüneteltetett kampányok esetén elérhető).",
    settingsSaved: "Beállítások mentve", searchPh: "Keresés név, e-mail vagy állapot szerint…", noResults: "Nincs találat a keresésre.",
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
    isManagerL: "Manager", monthRewardsL: "Recompense lunare", anyOpt: "Toți", yesOpt: "Da", noOpt: "Nu", agreementActiveL: "Contract activ la data",
    testSend: "E-mail de test", testEmailLabel: "Trimite un test la această adresă", testSent: "E-mail de test trimis", testLinkLabel: "Link de test al formularului", testDesc: "E-mailul și formularul folosesc doar date de test fictive — datele reale ale colaboratorului nu apar nicăieri. Linkul este complet funcțional — formularul poate fi completat, trimis și apoi aprobat sau respins în coada de aprobare.",
    emailsSending: "E-mailurile se trimit în fundal", noCampaigns: "Nicio campanie încă. Creați prima.",
    noApprovals: "Nicio completare în așteptarea verificării.", createdFmt: "Creat", campaignCreated: "Campanie creată", errorTitle: "Eroare",
    draft: "Ciornă", statSending: "Se trimite", statSent: "Trimisă",
    formTypeL: "Tip formular", formTypeUpdate: "Actualizarea datelor personale", formTypeJmhz: "JMHZ (legea CZ 323/2025)",
    insertJmhzSample: "Inserează șablonul JMHZ (CZ)",
    deleteCampaign: "Șterge campania", deleteConfirmT: "Ștergeți această campanie?", deleteConfirmD: "Campania și toate linkurile ei vor fi șterse definitiv. Linkurile deja trimise nu vor mai funcționa.",
    deleted: "Campanie ștearsă", cancel: "Anulează", confirmDelete: "Șterge",
    editFilter: "Editează filtrul", editFilterD: "Disponibil doar pentru ciorne, înainte de trimitere. Lista destinatarilor va fi regenerată după noul filtru.",
    filterSaved: "Filtru salvat, destinatarii regenerați", save: "Salvează",
    statPaused: "Întreruptă", resume: "Reia trimiterea", pause: "Întrerupe trimiterea", pausedToast: "Trimitere întreruptă",
    sendConfirmT: "Porniți trimiterea e-mailurilor?", sendConfirmD: "E-mailurile cu linkul formularului vor fi trimise tuturor destinatarilor în așteptare. E-mailurile deja trimise nu pot fi anulate.",
    remindConfirmT: "Trimiteți mementouri?", remindConfirmD: "Un memento va fi trimis tuturor celor care au primit linkul, dar nu au completat încă formularul.",
    confirmSend: "Da, trimite",
    refresh: "Reîmprospătează", removeReq: "Elimină din trimitere", removeConfirmT: "Eliminați acest destinatar?",
    removeConfirmD: "Destinatarul va fi eliminat din coada de trimitere, iar linkul lui nu va mai funcționa. Acțiunea nu poate fi anulată.",
    removedToast: "Destinatar eliminat",
    queueStarted: "Coadă pornită", queuePaused: "Coadă întreruptă", queueFinished: "Coadă finalizată",
    statsTitle: "Statistici", statTotal: "Destinatari cu e-mail", statNoEmail: "În filtru fără e-mail",
    settings: "Setările campaniei", settingsD: "Editați numele campaniei, subiectul și textul e-mailului. Modificările se aplică doar e-mailurilor netrimise încă (disponibil pentru ciorne și campanii întrerupte).",
    settingsSaved: "Setări salvate", searchPh: "Căutați după nume, e-mail sau stare…", noResults: "Nimic nu corespunde căutării.",
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
    isManagerL: "Manager", monthRewardsL: "Ricompense mensili", anyOpt: "Tutti", yesOpt: "Sì", noOpt: "No", agreementActiveL: "Contratto attivo alla data",
    testSend: "E-mail di prova", testEmailLabel: "Invia una prova a questo indirizzo", testSent: "E-mail di prova inviata", testLinkLabel: "Link di prova del modulo", testDesc: "L'e-mail e il modulo usano solo dati di prova fittizi — i dati reali del collaboratore non vengono mai mostrati. Il link è pienamente funzionante — il modulo può essere compilato, inviato e poi approvato o respinto nella coda di approvazione.",
    emailsSending: "Le e-mail vengono inviate in background", noCampaigns: "Nessuna campagna. Creane una.",
    noApprovals: "Nessuna compilazione in attesa di verifica.", createdFmt: "Creato", campaignCreated: "Campagna creata", errorTitle: "Errore",
    draft: "Bozza", statSending: "Invio in corso", statSent: "Inviata",
    formTypeL: "Tipo di modulo", formTypeUpdate: "Aggiornamento dei dati personali", formTypeJmhz: "JMHZ (legge CZ 323/2025)",
    insertJmhzSample: "Inserisci modello JMHZ (CZ)",
    deleteCampaign: "Elimina campagna", deleteConfirmT: "Eliminare questa campagna?", deleteConfirmD: "La campagna e tutti i suoi link verranno eliminati definitivamente. I link già inviati smetteranno di funzionare.",
    deleted: "Campagna eliminata", cancel: "Annulla", confirmDelete: "Elimina",
    editFilter: "Modifica filtro", editFilterD: "Disponibile solo per le bozze prima dell'invio. L'elenco dei destinatari verrà rigenerato con il nuovo filtro.",
    filterSaved: "Filtro salvato, destinatari rigenerati", save: "Salva",
    statPaused: "In pausa", resume: "Riprendi l'invio", pause: "Metti in pausa l'invio", pausedToast: "Invio messo in pausa",
    sendConfirmT: "Avviare l'invio delle e-mail?", sendConfirmD: "Le e-mail con il link al modulo saranno inviate a tutti i destinatari in attesa. Le e-mail già inviate non possono essere annullate.",
    remindConfirmT: "Inviare i promemoria?", remindConfirmD: "Un promemoria sarà inviato a tutti coloro che hanno ricevuto il link ma non hanno ancora compilato il modulo.",
    confirmSend: "Sì, invia",
    refresh: "Aggiorna", removeReq: "Rimuovi dall'invio", removeConfirmT: "Rimuovere questo destinatario?",
    removeConfirmD: "Il destinatario sarà rimosso dalla coda di invio e il suo link smetterà di funzionare. L'azione non può essere annullata.",
    removedToast: "Destinatario rimosso",
    queueStarted: "Coda avviata", queuePaused: "Coda in pausa", queueFinished: "Coda completata",
    statsTitle: "Statistiche", statTotal: "Destinatari con e-mail", statNoEmail: "Nel filtro senza e-mail",
    settings: "Impostazioni campagna", settingsD: "Modifica il nome della campagna, l'oggetto e il testo dell'e-mail. Le modifiche si applicano solo alle e-mail non ancora inviate (disponibile per bozze e campagne in pausa).",
    settingsSaved: "Impostazioni salvate", searchPh: "Cerca per nome, e-mail o stato…", noResults: "Nessun risultato per la ricerca.",
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
    isManagerL: "Manager", monthRewardsL: "Monatliche Vergütungen", anyOpt: "Alle", yesOpt: "Ja", noOpt: "Nein", agreementActiveL: "Vertrag aktiv am Datum",
    testSend: "Test-E-Mail", testEmailLabel: "Test an diese Adresse senden", testSent: "Test-E-Mail gesendet", testLinkLabel: "Test-Link zum Formular", testDesc: "E-Mail und Formular verwenden nur fiktive Testdaten — echte Partnerdaten werden nirgends angezeigt. Der Link ist voll funktionsfähig — das Formular kann ausgefüllt, abgesendet und dann in der Genehmigungswarteschlange genehmigt oder abgelehnt werden.",
    emailsSending: "E-Mails werden im Hintergrund gesendet", noCampaigns: "Noch keine Kampagnen. Erstellen Sie die erste.",
    noApprovals: "Keine Einreichungen zur Prüfung.", createdFmt: "Erstellt", campaignCreated: "Kampagne erstellt", errorTitle: "Fehler",
    draft: "Entwurf", statSending: "Wird gesendet", statSent: "Gesendet",
    formTypeL: "Formulartyp", formTypeUpdate: "Aktualisierung der persönlichen Daten", formTypeJmhz: "JMHZ (CZ Gesetz 323/2025 Slg.)",
    insertJmhzSample: "JMHZ-Vorlage einfügen (CZ)",
    deleteCampaign: "Kampagne löschen", deleteConfirmT: "Diese Kampagne löschen?", deleteConfirmD: "Die Kampagne und alle ihre Links werden dauerhaft gelöscht. Bereits versendete Links funktionieren dann nicht mehr.",
    deleted: "Kampagne gelöscht", cancel: "Abbrechen", confirmDelete: "Löschen",
    editFilter: "Filter bearbeiten", editFilterD: "Nur für Entwürfe vor dem Versand verfügbar. Die Empfängerliste wird nach dem neuen Filter neu erstellt.",
    filterSaved: "Filter gespeichert, Empfänger neu erstellt", save: "Speichern",
    statPaused: "Pausiert", resume: "Versand fortsetzen", pause: "Versand pausieren", pausedToast: "Versand pausiert",
    sendConfirmT: "E-Mail-Versand starten?", sendConfirmD: "E-Mails mit dem Formular-Link werden an alle wartenden Empfänger gesendet. Bereits gesendete E-Mails können nicht zurückgenommen werden.",
    remindConfirmT: "Erinnerungen senden?", remindConfirmD: "Eine Erinnerung wird an alle gesendet, die den Link erhalten, das Formular aber noch nicht ausgefüllt haben.",
    confirmSend: "Ja, senden",
    refresh: "Aktualisieren", removeReq: "Aus dem Versand entfernen", removeConfirmT: "Diesen Empfänger entfernen?",
    removeConfirmD: "Der Empfänger wird aus der Versandwarteschlange entfernt und sein Link funktioniert nicht mehr. Dies kann nicht rückgängig gemacht werden.",
    removedToast: "Empfänger entfernt",
    queueStarted: "Warteschlange gestartet", queuePaused: "Warteschlange pausiert", queueFinished: "Warteschlange abgeschlossen",
    statsTitle: "Statistik", statTotal: "Empfänger mit E-Mail", statNoEmail: "Im Filter ohne E-Mail",
    settings: "Kampagneneinstellungen", settingsD: "Bearbeiten Sie Kampagnenname, E-Mail-Betreff und -Text. Änderungen gelten nur für noch nicht gesendete E-Mails (verfügbar für Entwürfe und pausierte Kampagnen).",
    settingsSaved: "Einstellungen gespeichert", searchPh: "Suche nach Name, E-Mail oder Status…", noResults: "Nichts entspricht der Suche.",
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
                          {c.status === "draft" ? l.draft : c.status === "sending" ? l.statSending : c.status === "paused" ? l.statPaused : l.statSent}
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
  const [formType, setFormType] = useState("update");
  const [countries, setCountries] = useState<string[]>([]);
  const [collabType, setCollabType] = useState("");
  const [agreementType, setAgreementType] = useState("");
  const [partnerCategory, setPartnerCategory] = useState("");
  const [rewardType, setRewardType] = useState("");
  const [isManager, setIsManager] = useState("");
  const [monthRewards, setMonthRewards] = useState("");
  const [agreementActiveOn, setAgreementActiveOn] = useState("");
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
    const tpl = formType === "jmhz"
      ? JMHZ_EMAIL_TEMPLATE
      : SAMPLE_TEMPLATES[language !== "auto" ? language : "sk"] || SAMPLE_TEMPLATES.sk;
    setEmailSubject(tpl.subject);
    setEmailBody(tpl.body);
  };

  // Auto-fill the JMHZ email template as soon as the JMHZ form type is selected
  const handleFormTypeChange = (v: string) => {
    setFormType(v);
    if (v === "jmhz") {
      if (!emailSubject.trim() || emailSubject === JMHZ_EMAIL_TEMPLATE.subject || Object.values(SAMPLE_TEMPLATES).some(t => t.subject === emailSubject)) {
        setEmailSubject(JMHZ_EMAIL_TEMPLATE.subject);
        setEmailBody(JMHZ_EMAIL_TEMPLATE.body);
      }
    } else if (emailSubject === JMHZ_EMAIL_TEMPLATE.subject) {
      setEmailSubject("");
      setEmailBody("");
    }
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
    agreementActiveOn: agreementActiveOn || undefined,
  }), [countries, collabType, agreementType, partnerCategory, rewardType, isManager, monthRewards, onlyActive, dataSource, legacyIds, agreementActiveOn]);

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
        name, senderCountryCode, emailSubject, emailBody, language, formType, tokenValidDays, filterCriteria,
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
          <div className="grid grid-cols-2 gap-4">
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
              <Label>{l.formTypeL}</Label>
              <Select value={formType} onValueChange={handleFormTypeChange}>
                <SelectTrigger data-testid="select-form-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="update">{l.formTypeUpdate}</SelectItem>
                  <SelectItem value="jmhz">{l.formTypeJmhz}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label>{l.subject}</Label>
              <Button type="button" variant="outline" size="sm" onClick={insertSample} data-testid="button-insert-sample">
                <Mail className="h-4 w-4 mr-2" />{formType === "jmhz" ? l.insertJmhzSample : l.insertSample}
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
              <div className="space-y-1.5">
                <Label>{l.agreementActiveL}</Label>
                <Input type="date" value={agreementActiveOn} onChange={e => setAgreementActiveOn(e.target.value)} data-testid="input-agreement-active-on" />
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

function EditFilterDialog({ campaign, l, toast, open, onOpenChange }: any) {
  const fc = campaign.filterCriteria || {};
  const [countries, setCountries] = useState<string[]>(fc.countryCodes || []);
  const [collabType, setCollabType] = useState(fc.collaboratorType || "");
  const [agreementType, setAgreementType] = useState(fc.agreementType || "");
  const [partnerCategory, setPartnerCategory] = useState(fc.partnerCategory || "");
  const [rewardType, setRewardType] = useState(fc.rewardType || "");
  const [isManager, setIsManager] = useState(fc.isManager === undefined || fc.isManager === null ? "" : fc.isManager ? "yes" : "no");
  const [monthRewards, setMonthRewards] = useState(fc.monthRewards === undefined || fc.monthRewards === null ? "" : fc.monthRewards ? "yes" : "no");
  const [agreementActiveOn, setAgreementActiveOn] = useState(fc.agreementActiveOn || "");
  const [onlyActive, setOnlyActive] = useState(fc.isActive === true);
  const [dataSource, setDataSource] = useState(fc.dataSource || "");
  const [legacyIds, setLegacyIds] = useState(fc.legacyIds || "");
  const [preview, setPreview] = useState<{ count: number } | null>(null);

  const { data: filterOptions } = useQuery<any>({
    queryKey: ["/api/collaborator-update-campaigns/filter-options"],
    enabled: open,
  });

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
    agreementActiveOn: agreementActiveOn || undefined,
  }), [countries, collabType, agreementType, partnerCategory, rewardType, isManager, monthRewards, onlyActive, dataSource, legacyIds, agreementActiveOn]);

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/collaborator-update-campaigns/preview", { filterCriteria });
      return res.json();
    },
    onSuccess: (data) => setPreview(data),
    onError: (e: any) => toast({ title: l.errorTitle, description: e?.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/collaborator-update-campaigns/${campaign.id}/filter`, { filterCriteria });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborator-update-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collaborator-update-campaigns", campaign.id, "requests"] });
      toast({ title: l.filterSaved });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: l.errorTitle, description: e?.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{l.editFilter}</DialogTitle>
          <DialogDescription>{l.editFilterD}</DialogDescription>
        </DialogHeader>
        <div className="border rounded-md p-4 space-y-3">
          <div className="space-y-1.5">
            <Label>{l.countries}</Label>
            <div className="flex flex-wrap gap-3">
              {COUNTRY_OPTIONS.map(cc => (
                <label key={cc} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={countries.includes(cc)}
                    onCheckedChange={(v) => setCountries(prev => v ? [...prev, cc] : prev.filter(x => x !== cc))}
                    data-testid={`checkbox-edit-country-${cc}`}
                  />
                  {cc}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <OptionSelect label={l.collabType} value={collabType} onChange={setCollabType}
              options={filterOptions?.collaboratorTypes || []} anyLabel={l.anyOpt} testId="select-edit-collab-type" />
            <OptionSelect label={l.agreementTypeL} value={agreementType} onChange={setAgreementType}
              options={filterOptions?.agreementTypes || []} anyLabel={l.anyOpt} testId="select-edit-agreement-type" />
            <OptionSelect label={l.partnerCategoryL} value={partnerCategory} onChange={setPartnerCategory}
              options={filterOptions?.partnerCategories || []} anyLabel={l.anyOpt} testId="select-edit-partner-category" />
            <OptionSelect label={l.rewardTypeL} value={rewardType} onChange={setRewardType}
              options={filterOptions?.rewardTypes || []} anyLabel={l.anyOpt} testId="select-edit-reward-type" />
            <OptionSelect label={l.dataSource} value={dataSource} onChange={setDataSource}
              options={filterOptions?.dataSources || []} anyLabel={l.anyOpt} testId="select-edit-data-source" />
            <div className="grid grid-cols-2 gap-4">
              <YesNoSelect label={l.isManagerL} value={isManager} onChange={setIsManager} l={l} testId="select-edit-is-manager" />
              <YesNoSelect label={l.monthRewardsL} value={monthRewards} onChange={setMonthRewards} l={l} testId="select-edit-month-rewards" />
            </div>
            <div className="space-y-1.5">
              <Label>{l.agreementActiveL}</Label>
              <Input type="date" value={agreementActiveOn} onChange={e => setAgreementActiveOn(e.target.value)} data-testid="input-edit-agreement-active-on" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={onlyActive} onCheckedChange={v => setOnlyActive(!!v)} data-testid="checkbox-edit-only-active" />
            {l.onlyActive}
          </label>
          <div className="space-y-1.5">
            <Label>{l.legacyIds}</Label>
            <Textarea rows={3} value={legacyIds} onChange={e => setLegacyIds(e.target.value)} data-testid="input-edit-legacy-ids" />
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending} data-testid="button-edit-preview">
              {previewMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
              {l.preview}
            </Button>
            {preview && <span className="text-sm font-medium" data-testid="text-edit-preview-count">{preview.count} {l.recipients}</span>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-edit-filter-cancel">{l.cancel}</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-edit-filter-save">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {l.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingsDialog({ campaign, l, toast, open, onOpenChange }: any) {
  const [name, setName] = useState(campaign.name || "");
  const [subject, setSubject] = useState(campaign.emailSubject || "");
  const [body, setBody] = useState(campaign.emailBody || "");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/collaborator-update-campaigns/${campaign.id}/settings`, { name, subject, body });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborator-update-campaigns"] });
      toast({ title: l.settingsSaved });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: l.errorTitle, description: e?.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{l.settings}</DialogTitle>
          <DialogDescription>{l.settingsD}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{l.name}</Label>
            <Input value={name} onChange={e => setName(e.target.value)} data-testid="input-settings-name" />
          </div>
          <div className="space-y-1.5">
            <Label>{l.subject}</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} data-testid="input-settings-subject" />
          </div>
          <div className="space-y-1.5">
            <Label>{l.body}</Label>
            <Textarea rows={12} value={body} onChange={e => setBody(e.target.value)} data-testid="input-settings-body" />
            <p className="text-xs text-muted-foreground">{l.bodyHint}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-settings-cancel">{l.cancel}</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !name.trim() || !subject.trim() || !body.trim()}
            data-testid="button-settings-save"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {l.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PAGE_SIZE = 20;

function CampaignDetail({ campaign, l, toast, onBack }: any) {
  const [testOpen, setTestOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<null | "send" | "remind">(null);
  const [editFilterOpen, setEditFilterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [removeId, setRemoveId] = useState<string | null>(null);
  const { data: requests = [], isLoading, isFetching } = useQuery<any[]>({
    queryKey: ["/api/collaborator-update-campaigns", campaign.id, "requests"],
    queryFn: async () => {
      const res = await fetch(`/api/collaborator-update-campaigns/${campaign.id}/requests`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load requests");
      return res.json();
    },
    refetchInterval: campaign.status === "sending" ? 5000 : false,
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/collaborator-update-campaigns", campaign.id, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/collaborator-update-campaigns/${campaign.id}/stats`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
    refetchInterval: (q) => ((q.state.data as any)?.status === "sending" || campaign.status === "sending" ? 5000 : false),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/collaborator-update-campaigns"] });
    queryClient.invalidateQueries({ queryKey: ["/api/collaborator-update-campaigns", campaign.id, "requests"] });
    queryClient.invalidateQueries({ queryKey: ["/api/collaborator-update-campaigns", campaign.id, "stats"] });
  };

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/collaborator-update-requests/${id}`);
    },
    onSuccess: () => { toast({ title: l.removedToast }); invalidate(); },
    onError: (e: any) => toast({ title: l.errorTitle, description: e?.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: async (kind: "send" | "remind") => {
      const res = await apiRequest("POST", `/api/collaborator-update-campaigns/${campaign.id}/${kind}`);
      return res.json();
    },
    onSuccess: () => { toast({ title: l.emailsSending }); invalidate(); },
    onError: (e: any) => toast({ title: l.errorTitle, description: e?.message, variant: "destructive" }),
  });

  const pauseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/collaborator-update-campaigns/${campaign.id}/pause`);
      return res.json();
    },
    onSuccess: () => { toast({ title: l.pausedToast }); invalidate(); },
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

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/collaborator-update-campaigns/${campaign.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborator-update-campaigns"] });
      toast({ title: l.deleted });
      onBack();
    },
    onError: (e: any) => toast({ title: l.errorTitle, description: e?.message, variant: "destructive" }),
  });

  const statusLabel = (st: string) => (l as any)[`status${st === "send_failed" ? "Failed" : st.charAt(0).toUpperCase() + st.slice(1)}`] || st;
  const submitted = requests.filter(r => r.status === "submitted");

  const q = search.trim().toLowerCase();
  const filtered = q
    ? requests.filter(r =>
        (r.collaboratorName || "").toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q) ||
        (r.status || "").toLowerCase().includes(q) ||
        statusLabel(r.status).toLowerCase().includes(q))
    : requests;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const canRemove = (st: string) => ["pending", "sent", "send_failed", "opened"].includes(st);
  const fmtTs = (v: any) => (v ? format(new Date(v), "dd.MM.yyyy HH:mm") : "—");

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
          <Button variant="outline" onClick={invalidate} disabled={isFetching} data-testid="button-refresh">
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />{l.refresh}
          </Button>
          {(campaign.status === "draft" || campaign.status === "paused") && (
            <Button variant="outline" onClick={() => setSettingsOpen(true)} data-testid="button-settings">
              <Pencil className="h-4 w-4 mr-2" />{l.settings}
            </Button>
          )}
          {campaign.status === "draft" && (
            <Button variant="outline" onClick={() => setEditFilterOpen(true)} data-testid="button-edit-filter">
              <Filter className="h-4 w-4 mr-2" />{l.editFilter}
            </Button>
          )}
          <Button variant="outline" onClick={() => setDeleteOpen(true)} disabled={campaign.status === "sending"} data-testid="button-delete-campaign">
            <Trash2 className="h-4 w-4 mr-2 text-red-500" />{l.deleteCampaign}
          </Button>
          <Button variant="outline" onClick={() => setTestOpen(true)} data-testid="button-test">
            {l.testSend}
          </Button>
          {campaign.status === "sending" ? (
            <Button variant="outline" onClick={() => pauseMutation.mutate()} disabled={pauseMutation.isPending} data-testid="button-pause">
              <Pause className="h-4 w-4 mr-2" />{l.pause}
            </Button>
          ) : (
            <Button onClick={() => setConfirmKind("send")} disabled={sendMutation.isPending} data-testid="button-send">
              <Send className="h-4 w-4 mr-2" />
              {campaign.status === "paused" ? l.resume : l.sendEmails}
            </Button>
          )}
          <Button variant="outline" onClick={() => setConfirmKind("remind")} disabled={sendMutation.isPending || campaign.status === "sending"} data-testid="button-remind">
            <Bell className="h-4 w-4 mr-2" />{l.remind}
          </Button>
        </div>
      </div>

      {stats && (
        <Card data-testid="card-stats">
          <CardContent className="py-4 space-y-3">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span data-testid="text-queue-started">{l.queueStarted}: <span className="text-foreground font-medium">{fmtTs(stats.sendStartedAt)}</span></span>
              <span data-testid="text-queue-paused">{l.queuePaused}: <span className="text-foreground font-medium">{fmtTs(stats.sendPausedAt)}</span></span>
              <span data-testid="text-queue-finished">{l.queueFinished}: <span className="text-foreground font-medium">{fmtTs(stats.sendFinishedAt)}</span></span>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant="secondary" data-testid="stat-total">
                <Mail className="h-3 w-3 mr-1" />{l.statTotal}: {stats.total}
              </Badge>
              {stats.noEmailCount > 0 && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" data-testid="stat-no-email">
                  {l.statNoEmail}: {stats.noEmailCount}
                </Badge>
              )}
              {Object.entries(stats.byStatus || {}).map(([st, n]) => (
                <Badge key={st} variant="secondary" className={STATUS_COLORS[st] || ""} data-testid={`stat-${st}`}>
                  {statusLabel(st)}: {n as number}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
              <div className="p-3 border-b">
                <div className="relative max-w-sm">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={search}
                    placeholder={l.searchPh}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    data-testid="input-search-requests"
                  />
                </div>
              </div>
              {filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground" data-testid="text-no-results">{l.noResults}</div>
              ) : (
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{l.collaborator}</TableHead>
                    <TableHead>{l.email}</TableHead>
                    <TableHead>{l.status}</TableHead>
                    <TableHead>{l.sentAt}</TableHead>
                    <TableHead>{l.submittedAt}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map(r => (
                    <TableRow key={r.id} data-testid={`row-request-${r.id}`}>
                      <TableCell>{r.collaboratorName} <span className="text-xs text-muted-foreground">({r.countryCode})</span></TableCell>
                      <TableCell className="text-sm">{r.email}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[r.status] || ""} variant="secondary">{statusLabel(r.status)}</Badge>
                        {r.sendError && <p className="text-xs text-red-500 mt-0.5">{r.sendError}</p>}
                      </TableCell>
                      <TableCell className="text-sm">{r.sentAt ? format(new Date(r.sentAt), "dd.MM. HH:mm") : "—"}</TableCell>
                      <TableCell className="text-sm">{r.submittedAt ? format(new Date(r.submittedAt), "dd.MM. HH:mm") : "—"}</TableCell>
                      <TableCell>
                        {canRemove(r.status) && (
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            title={l.removeReq}
                            onClick={() => setRemoveId(r.id)}
                            disabled={removeMutation.isPending}
                            data-testid={`button-remove-request-${r.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {pageCount > 1 && (
                <div className="flex items-center justify-end gap-2 p-3 border-t">
                  <span className="text-sm text-muted-foreground" data-testid="text-page-info">
                    {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} / {filtered.length}
                  </span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} data-testid="button-prev-page">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm tabular-nums" data-testid="text-page-number">{safePage}/{pageCount}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={safePage >= pageCount} data-testid="button-next-page">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
              </>
              )}
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

      <AlertDialog open={removeId !== null} onOpenChange={(o) => { if (!o) setRemoveId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{l.removeConfirmT}</AlertDialogTitle>
            <AlertDialogDescription>{l.removeConfirmD}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-remove-cancel">{l.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { if (removeId) removeMutation.mutate(removeId); setRemoveId(null); }}
              data-testid="button-remove-confirm"
            >
              {l.confirmDelete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{l.deleteConfirmT}</AlertDialogTitle>
            <AlertDialogDescription>{l.deleteConfirmD}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">{l.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="button-delete-confirm"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {l.confirmDelete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {settingsOpen && (
        <SettingsDialog campaign={campaign} l={l} toast={toast} open={settingsOpen} onOpenChange={setSettingsOpen} />
      )}
      {editFilterOpen && (
        <EditFilterDialog campaign={campaign} l={l} toast={toast} open={editFilterOpen} onOpenChange={setEditFilterOpen} />
      )}

      <AlertDialog open={confirmKind !== null} onOpenChange={(o) => { if (!o) setConfirmKind(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmKind === "remind" ? l.remindConfirmT : l.sendConfirmT}</AlertDialogTitle>
            <AlertDialogDescription>{confirmKind === "remind" ? l.remindConfirmD : l.sendConfirmD}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-send-cancel">{l.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (confirmKind) sendMutation.mutate(confirmKind); setConfirmKind(null); }}
              disabled={sendMutation.isPending}
              data-testid="button-send-confirm"
            >
              {l.confirmSend}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
