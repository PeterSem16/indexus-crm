import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

type Lang = "sk" | "cs" | "hu" | "ro" | "it" | "de" | "en";

const T: Record<Lang, Record<string, string>> = {
  sk: {
    title: "Aktualizácia osobných údajov",
    intro: "Skontrolujte prosím svoje údaje a opravte tie, ktoré už nie sú aktuálne. Zmeny budú po odoslaní skontrolované našim tímom.",
    personal: "Osobné údaje", contact: "Kontaktné údaje", bank: "Bankové údaje", company: "Firemné údaje",
    addrPermanent: "Trvalá adresa", addrCorrespondence: "Korešpondenčná adresa",
    titleBefore: "Titul pred menom", firstName: "Meno", lastName: "Priezvisko", titleAfter: "Titul za menom",
    maidenName: "Rodné priezvisko", birthNumber: "Rodné číslo",
    email: "E-mail", mobile: "Mobil", phone: "Telefón",
    bankAccountIban: "IBAN", swiftCode: "SWIFT",
    companyName: "Názov firmy", ico: "IČO", dic: "DIČ", icDph: "IČ DPH",
    streetNumber: "Ulica a číslo", city: "Mesto", postalCode: "PSČ",
    submit: "Odoslať aktualizáciu", submitting: "Odosielam…",
    thanksTitle: "Ďakujeme!", thanksText: "Vaše údaje boli odoslané. Po kontrole ich zapracujeme do našej evidencie.",
    alreadyTitle: "Formulár už bol odoslaný", alreadyText: "Tento odkaz už bol použitý. Ak potrebujete ďalšiu zmenu, kontaktujte nás prosím.",
    expiredTitle: "Platnosť odkazu vypršala", expiredText: "Tento odkaz už nie je platný. Kontaktujte nás prosím pre nový odkaz.",
    notFoundTitle: "Odkaz nebol nájdený", notFoundText: "Skontrolujte prosím, či ste odkaz skopírovali celý.",
    errorSubmit: "Odoslanie zlyhalo, skúste to prosím znova.",
    requiredName: "Meno a priezvisko nemôžu byť prázdne.",
    privacy: "Vaše údaje spracúvame v súlade s GDPR výlučne na účely vedenia evidencie spolupracovníkov.",
    birthNumberNote: "Z bezpečnostných dôvodov zobrazujeme len časť. Ak je nesprávne, kontaktujte nás.",
  },
  cs: {
    title: "Aktualizace osobních údajů",
    intro: "Zkontrolujte prosím své údaje a opravte ty, které již nejsou aktuální. Změny budou po odeslání zkontrolovány naším týmem.",
    personal: "Osobní údaje", contact: "Kontaktní údaje", bank: "Bankovní údaje", company: "Firemní údaje",
    addrPermanent: "Trvalá adresa", addrCorrespondence: "Korespondenční adresa",
    titleBefore: "Titul před jménem", firstName: "Jméno", lastName: "Příjmení", titleAfter: "Titul za jménem",
    maidenName: "Rodné příjmení", birthNumber: "Rodné číslo",
    email: "E-mail", mobile: "Mobil", phone: "Telefon",
    bankAccountIban: "IBAN", swiftCode: "SWIFT",
    companyName: "Název firmy", ico: "IČO", dic: "DIČ", icDph: "DIČ (DPH)",
    streetNumber: "Ulice a číslo", city: "Město", postalCode: "PSČ",
    submit: "Odeslat aktualizaci", submitting: "Odesílám…",
    thanksTitle: "Děkujeme!", thanksText: "Vaše údaje byly odeslány. Po kontrole je zapracujeme do naší evidence.",
    alreadyTitle: "Formulář již byl odeslán", alreadyText: "Tento odkaz již byl použit. Pokud potřebujete další změnu, kontaktujte nás prosím.",
    expiredTitle: "Platnost odkazu vypršela", expiredText: "Tento odkaz již není platný. Kontaktujte nás prosím pro nový odkaz.",
    notFoundTitle: "Odkaz nebyl nalezen", notFoundText: "Zkontrolujte prosím, zda jste odkaz zkopírovali celý.",
    errorSubmit: "Odeslání selhalo, zkuste to prosím znovu.",
    requiredName: "Jméno a příjmení nemohou být prázdné.",
    privacy: "Vaše údaje zpracováváme v souladu s GDPR výhradně pro účely vedení evidence spolupracovníků.",
    birthNumberNote: "Z bezpečnostních důvodů zobrazujeme jen část. Pokud je nesprávné, kontaktujte nás.",
  },
  hu: {
    title: "Személyes adatok frissítése",
    intro: "Kérjük, ellenőrizze adatait, és javítsa azokat, amelyek már nem aktuálisak. A módosításokat beküldés után csapatunk ellenőrzi.",
    personal: "Személyes adatok", contact: "Elérhetőségek", bank: "Banki adatok", company: "Céges adatok",
    addrPermanent: "Állandó lakcím", addrCorrespondence: "Levelezési cím",
    titleBefore: "Titulus (név előtt)", firstName: "Keresztnév", lastName: "Vezetéknév", titleAfter: "Titulus (név után)",
    maidenName: "Leánykori név", birthNumber: "Személyi szám",
    email: "E-mail", mobile: "Mobil", phone: "Telefon",
    bankAccountIban: "IBAN", swiftCode: "SWIFT",
    companyName: "Cégnév", ico: "Cégjegyzékszám", dic: "Adószám", icDph: "Közösségi adószám",
    streetNumber: "Utca, házszám", city: "Város", postalCode: "Irányítószám",
    submit: "Frissítés beküldése", submitting: "Küldés…",
    thanksTitle: "Köszönjük!", thanksText: "Adatait megkaptuk. Ellenőrzés után rögzítjük nyilvántartásunkban.",
    alreadyTitle: "Az űrlap már be lett küldve", alreadyText: "Ezt a linket már felhasználták. További módosításhoz kérjük, lépjen kapcsolatba velünk.",
    expiredTitle: "A link érvényessége lejárt", expiredText: "Ez a link már nem érvényes. Kérjük, lépjen kapcsolatba velünk új linkért.",
    notFoundTitle: "A link nem található", notFoundText: "Kérjük, ellenőrizze, hogy a teljes linket másolta-e ki.",
    errorSubmit: "A beküldés nem sikerült, kérjük, próbálja újra.",
    requiredName: "A név mezők nem lehetnek üresek.",
    privacy: "Adatait a GDPR-nak megfelelően, kizárólag a partnernyilvántartás céljából kezeljük.",
    birthNumberNote: "Biztonsági okokból csak egy részét jelenítjük meg. Ha hibás, kérjük, jelezze felénk.",
  },
  ro: {
    title: "Actualizarea datelor personale",
    intro: "Vă rugăm să verificați datele dumneavoastră și să corectați cele care nu mai sunt actuale. Modificările vor fi verificate de echipa noastră.",
    personal: "Date personale", contact: "Date de contact", bank: "Date bancare", company: "Date firmă",
    addrPermanent: "Adresă de domiciliu", addrCorrespondence: "Adresă de corespondență",
    titleBefore: "Titlu (înainte de nume)", firstName: "Prenume", lastName: "Nume", titleAfter: "Titlu (după nume)",
    maidenName: "Nume anterior", birthNumber: "CNP",
    email: "E-mail", mobile: "Mobil", phone: "Telefon",
    bankAccountIban: "IBAN", swiftCode: "SWIFT",
    companyName: "Denumirea firmei", ico: "CUI", dic: "Cod fiscal", icDph: "Cod TVA",
    streetNumber: "Strada și numărul", city: "Oraș", postalCode: "Cod poștal",
    submit: "Trimite actualizarea", submitting: "Se trimite…",
    thanksTitle: "Vă mulțumim!", thanksText: "Datele dumneavoastră au fost trimise. După verificare le vom înregistra.",
    alreadyTitle: "Formularul a fost deja trimis", alreadyText: "Acest link a fost deja folosit. Pentru alte modificări, vă rugăm să ne contactați.",
    expiredTitle: "Linkul a expirat", expiredText: "Acest link nu mai este valabil. Vă rugăm să ne contactați pentru un link nou.",
    notFoundTitle: "Linkul nu a fost găsit", notFoundText: "Vă rugăm să verificați dacă ați copiat linkul complet.",
    errorSubmit: "Trimiterea a eșuat, vă rugăm să încercați din nou.",
    requiredName: "Numele și prenumele nu pot fi goale.",
    privacy: "Prelucrăm datele dumneavoastră în conformitate cu GDPR, exclusiv pentru evidența colaboratorilor.",
    birthNumberNote: "Din motive de securitate afișăm doar o parte. Dacă este greșit, vă rugăm să ne contactați.",
  },
  it: {
    title: "Aggiornamento dei dati personali",
    intro: "Verifichi i suoi dati e corregga quelli non più attuali. Le modifiche saranno controllate dal nostro team.",
    personal: "Dati personali", contact: "Contatti", bank: "Dati bancari", company: "Dati aziendali",
    addrPermanent: "Indirizzo di residenza", addrCorrespondence: "Indirizzo di corrispondenza",
    titleBefore: "Titolo (prima del nome)", firstName: "Nome", lastName: "Cognome", titleAfter: "Titolo (dopo il nome)",
    maidenName: "Cognome da nubile", birthNumber: "Codice fiscale",
    email: "E-mail", mobile: "Cellulare", phone: "Telefono",
    bankAccountIban: "IBAN", swiftCode: "SWIFT",
    companyName: "Ragione sociale", ico: "Partita IVA", dic: "Codice fiscale azienda", icDph: "P. IVA UE",
    streetNumber: "Via e numero", city: "Città", postalCode: "CAP",
    submit: "Invia aggiornamento", submitting: "Invio…",
    thanksTitle: "Grazie!", thanksText: "I suoi dati sono stati inviati. Dopo la verifica saranno registrati.",
    alreadyTitle: "Il modulo è già stato inviato", alreadyText: "Questo link è già stato utilizzato. Per ulteriori modifiche ci contatti.",
    expiredTitle: "Il link è scaduto", expiredText: "Questo link non è più valido. Ci contatti per riceverne uno nuovo.",
    notFoundTitle: "Link non trovato", notFoundText: "Verifichi di aver copiato il link completo.",
    errorSubmit: "Invio non riuscito, riprovi per favore.",
    requiredName: "Nome e cognome non possono essere vuoti.",
    privacy: "Trattiamo i suoi dati in conformità al GDPR, esclusivamente per la gestione dei collaboratori.",
    birthNumberNote: "Per motivi di sicurezza ne mostriamo solo una parte. Se errato, ci contatti.",
  },
  de: {
    title: "Aktualisierung der persönlichen Daten",
    intro: "Bitte überprüfen Sie Ihre Daten und korrigieren Sie diejenigen, die nicht mehr aktuell sind. Die Änderungen werden von unserem Team geprüft.",
    personal: "Persönliche Daten", contact: "Kontaktdaten", bank: "Bankdaten", company: "Firmendaten",
    addrPermanent: "Wohnadresse", addrCorrespondence: "Korrespondenzadresse",
    titleBefore: "Titel (vor dem Namen)", firstName: "Vorname", lastName: "Nachname", titleAfter: "Titel (nach dem Namen)",
    maidenName: "Geburtsname", birthNumber: "Geburtsnummer",
    email: "E-Mail", mobile: "Mobil", phone: "Telefon",
    bankAccountIban: "IBAN", swiftCode: "SWIFT",
    companyName: "Firmenname", ico: "Firmen-ID", dic: "Steuernummer", icDph: "USt-IdNr.",
    streetNumber: "Straße und Hausnummer", city: "Stadt", postalCode: "PLZ",
    submit: "Aktualisierung senden", submitting: "Wird gesendet…",
    thanksTitle: "Vielen Dank!", thanksText: "Ihre Daten wurden übermittelt. Nach der Prüfung werden sie erfasst.",
    alreadyTitle: "Das Formular wurde bereits gesendet", alreadyText: "Dieser Link wurde bereits verwendet. Für weitere Änderungen kontaktieren Sie uns bitte.",
    expiredTitle: "Der Link ist abgelaufen", expiredText: "Dieser Link ist nicht mehr gültig. Bitte kontaktieren Sie uns für einen neuen Link.",
    notFoundTitle: "Link nicht gefunden", notFoundText: "Bitte prüfen Sie, ob Sie den vollständigen Link kopiert haben.",
    errorSubmit: "Senden fehlgeschlagen, bitte versuchen Sie es erneut.",
    requiredName: "Vor- und Nachname dürfen nicht leer sein.",
    privacy: "Wir verarbeiten Ihre Daten gemäß DSGVO ausschließlich zur Verwaltung unserer Partner.",
    birthNumberNote: "Aus Sicherheitsgründen zeigen wir nur einen Teil an. Falls falsch, kontaktieren Sie uns bitte.",
  },
  en: {
    title: "Personal Data Update",
    intro: "Please review your details and correct anything that is no longer up to date. Changes will be reviewed by our team.",
    personal: "Personal details", contact: "Contact details", bank: "Bank details", company: "Company details",
    addrPermanent: "Permanent address", addrCorrespondence: "Correspondence address",
    titleBefore: "Title (before name)", firstName: "First name", lastName: "Last name", titleAfter: "Title (after name)",
    maidenName: "Maiden name", birthNumber: "Birth number",
    email: "Email", mobile: "Mobile", phone: "Phone",
    bankAccountIban: "IBAN", swiftCode: "SWIFT",
    companyName: "Company name", ico: "Company ID", dic: "Tax ID", icDph: "VAT ID",
    streetNumber: "Street and number", city: "City", postalCode: "Postal code",
    submit: "Submit update", submitting: "Submitting…",
    thanksTitle: "Thank you!", thanksText: "Your details have been submitted. After review, they will be recorded.",
    alreadyTitle: "Form already submitted", alreadyText: "This link has already been used. Please contact us if you need another change.",
    expiredTitle: "Link expired", expiredText: "This link is no longer valid. Please contact us for a new one.",
    notFoundTitle: "Link not found", notFoundText: "Please check that you copied the whole link.",
    errorSubmit: "Submission failed, please try again.",
    requiredName: "First and last name cannot be empty.",
    privacy: "We process your data in accordance with GDPR, solely for maintaining our collaborator records.",
    birthNumberNote: "For security reasons only a part is shown. If it is incorrect, please contact us.",
  },
};

type FormResponse = {
  language: Lang;
  birthNumberMasked: string | null;
  collaboratorName: string;
  data: Record<string, string>;
};

export default function CollaboratorUpdatePage() {
  const [, params] = useRoute("/update/:token");
  const token = params?.token || "";
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [done, setDone] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const query = useQuery<FormResponse>({
    queryKey: ["/api/public/collaborator-update", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/collaborator-update/${token}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "error");
      }
      return res.json();
    },
    retry: false,
    staleTime: Infinity,
  });

  const lang: Lang = (query.data?.language as Lang) || "sk";
  const t = T[lang] || T.sk;

  const mutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await fetch(`/api/public/collaborator-update/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "error");
      }
      return res.json();
    },
    onSuccess: () => setDone(true),
  });

  if (query.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const errMsg = (query.error as any)?.message;
  if (query.isError) {
    const known = errMsg === "expired" ? { title: t.expiredTitle, text: t.expiredText }
      : errMsg === "already_submitted" ? { title: t.alreadyTitle, text: t.alreadyText }
      : { title: T.sk.notFoundTitle, text: T.sk.notFoundText };
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-2" />
            <CardTitle data-testid="text-error-title">{known.title}</CardTitle>
            <CardDescription>{known.text}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
            <CardTitle data-testid="text-thanks-title">{t.thanksTitle}</CardTitle>
            <CardDescription>{t.thanksText}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const data = form ?? query.data!.data;
  const setField = (k: string, v: string) => {
    setForm(prev => ({ ...(prev ?? query.data!.data), [k]: v }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (!data.firstName?.trim() || !data.lastName?.trim()) {
      setValidationError(t.requiredName);
      return;
    }
    mutation.mutate(data);
  };

  const field = (key: string, label: string, type: string = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type={type}
        value={data[key] ?? ""}
        onChange={e => setField(key, e.target.value)}
        data-testid={`input-${key}`}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 mb-1">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-sm font-semibold tracking-wide">INDEXUS</span>
            </div>
            <CardTitle data-testid="text-form-title">{t.title}</CardTitle>
            <CardDescription>{t.intro}</CardDescription>
          </CardHeader>
        </Card>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div>
                <h3 className="font-semibold mb-3">{t.personal}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {field("titleBefore", t.titleBefore)}
                  {field("titleAfter", t.titleAfter)}
                  {field("firstName", t.firstName)}
                  {field("lastName", t.lastName)}
                  {field("maidenName", t.maidenName)}
                  <div className="space-y-1.5">
                    <Label>{t.birthNumber}</Label>
                    <Input value={query.data!.birthNumberMasked ?? ""} disabled data-testid="input-birthNumber-masked" />
                    <p className="text-xs text-muted-foreground">{t.birthNumberNote}</p>
                  </div>
                </div>
              </div>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3">{t.contact}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {field("email", t.email, "email")}
                  {field("mobile", t.mobile)}
                  {field("phone", t.phone)}
                </div>
              </div>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3">{t.addrPermanent}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {field("addr_permanent_streetNumber", t.streetNumber)}
                  {field("addr_permanent_city", t.city)}
                  {field("addr_permanent_postalCode", t.postalCode)}
                </div>
              </div>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3">{t.addrCorrespondence}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {field("addr_correspondence_streetNumber", t.streetNumber)}
                  {field("addr_correspondence_city", t.city)}
                  {field("addr_correspondence_postalCode", t.postalCode)}
                </div>
              </div>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3">{t.bank}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {field("bankAccountIban", t.bankAccountIban)}
                  {field("swiftCode", t.swiftCode)}
                </div>
              </div>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3">{t.company}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {field("companyName", t.companyName)}
                  {field("ico", t.ico)}
                  {field("dic", t.dic)}
                  {field("icDph", t.icDph)}
                </div>
              </div>

              {validationError && (
                <p className="text-sm text-red-600" data-testid="text-validation-error">{validationError}</p>
              )}
              {mutation.isError && (
                <p className="text-sm text-red-600" data-testid="text-submit-error">{t.errorSubmit}</p>
              )}

              <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-update">
                {mutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t.submitting}</>
                ) : t.submit}
              </Button>
              <p className="text-xs text-muted-foreground text-center">{t.privacy}</p>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}
