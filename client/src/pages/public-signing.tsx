import { useState, useEffect, useMemo } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, AlertCircle, FileSignature, ShieldCheck, PenLine } from "lucide-react";

type SigningStep = "loading" | "error" | "otp" | "sign" | "success" | "already_signed";
type SigningLocale = "sk" | "cs" | "hu" | "ro" | "it" | "de" | "en";

interface SigningInfo {
  contractNumber: string;
  signerName: string;
  status: string;
  verificationMethod: string;
  otpVerified: boolean;
  signatureRequestId: string;
  locale?: SigningLocale;
  brandName?: string;
}

const signingPageI18n: Record<SigningLocale, {
  portalTitle: string;
  loading: string;
  invalidLink: string;
  serverError: string;
  submitFailed: string;
  alreadySignedTitle: string;
  alreadySignedDesc: string;
  verifyTitle: string;
  contract: string;
  signingAs: string;
  otpInstructionEmail: string;
  otpInstructionSms: string;
  verifyButton: string;
  enterCode: string;
  connectionError: string;
  signTitle: string;
  identityVerified: string;
  typeNameLabel: string;
  signaturePreview: string;
  legalText: (name: string, cn: string) => string;
  signButton: string;
  successTitle: string;
  successDesc: string;
  securedBy: string;
}> = {
  sk: {
    portalTitle: "Podpisovanie zmluvy",
    loading: "Načítavam informácie o podpise...",
    invalidLink: "Tento odkaz na podpis nie je platný",
    serverError: "Nepodarilo sa pripojiť k serveru. Skúste to neskôr.",
    submitFailed: "Odoslanie podpisu zlyhalo",
    alreadySignedTitle: "Zmluva je už podpísaná",
    alreadySignedDesc: "Táto zmluva bola už podpísaná. Nie je potrebná žiadna ďalšia akcia.",
    verifyTitle: "Overte svoju totožnosť",
    contract: "Zmluva",
    signingAs: "Podpisujete ako",
    otpInstructionEmail: "Zadajte 6-miestny overovací kód, ktorý sme vám zaslali na e-mail.",
    otpInstructionSms: "Zadajte 6-miestny overovací kód, ktorý sme vám zaslali v SMS.",
    verifyButton: "Overiť kód",
    enterCode: "Zadajte overovací kód",
    connectionError: "Chyba pripojenia. Skúste to znova.",
    signTitle: "Podpísať zmluvu",
    identityVerified: "Vaša totožnosť bola overená",
    typeNameLabel: "Napíšte svoje celé meno pre podpis",
    signaturePreview: "Náhľad podpisu",
    legalText: (name, cn) => `Kliknutím na "Podpísať zmluvu" potvrdzujem, že som ${name} a súhlasím s podmienkami zmluvy ${cn}. Tento elektronický podpis má rovnakú právnu platnosť ako vlastnoručný podpis.`,
    signButton: "Podpísať zmluvu",
    successTitle: "Zmluva bola úspešne podpísaná",
    successDesc: "Váš podpis bol zaznamenaný. Môžete zatvoriť toto okno.",
    securedBy: "Zabezpečené systémom INDEXUS CRM",
  },
  cs: {
    portalTitle: "Podpis smlouvy",
    loading: "Načítám informace o podpisu...",
    invalidLink: "Tento odkaz pro podpis není platný",
    serverError: "Nelze se připojit k serveru. Zkuste to později.",
    submitFailed: "Odeslání podpisu selhalo",
    alreadySignedTitle: "Smlouva je již podepsána",
    alreadySignedDesc: "Tato smlouva již byla podepsána. Není vyžadována žádná další akce.",
    verifyTitle: "Ověřte svou totožnost",
    contract: "Smlouva",
    signingAs: "Podepisujete jako",
    otpInstructionEmail: "Zadejte 6místný ověřovací kód, který jsme vám zaslali na e-mail.",
    otpInstructionSms: "Zadejte 6místný ověřovací kód, který jsme vám zaslali v SMS.",
    verifyButton: "Ověřit kód",
    enterCode: "Zadejte ověřovací kód",
    connectionError: "Chyba připojení. Zkuste to znovu.",
    signTitle: "Podepsat smlouvu",
    identityVerified: "Vaše totožnost byla ověřena",
    typeNameLabel: "Napište své celé jméno pro podpis",
    signaturePreview: "Náhled podpisu",
    legalText: (name, cn) => `Kliknutím na "Podepsat smlouvu" potvrzuji, že jsem ${name} a souhlasím s podmínkami smlouvy ${cn}. Tento elektronický podpis má stejnou právní platnost jako vlastnoruční podpis.`,
    signButton: "Podepsat smlouvu",
    successTitle: "Smlouva byla úspěšně podepsána",
    successDesc: "Váš podpis byl zaznamenán. Můžete zavřít toto okno.",
    securedBy: "Zabezpečeno systémem INDEXUS CRM",
  },
  hu: {
    portalTitle: "Szerződés aláírása",
    loading: "Az aláírási adatok betöltése...",
    invalidLink: "Ez az aláírási link nem érvényes",
    serverError: "Nem sikerült csatlakozni a szerverhez. Próbálja újra később.",
    submitFailed: "Az aláírás elküldése sikertelen",
    alreadySignedTitle: "A szerződés már alá van írva",
    alreadySignedDesc: "Ez a szerződés már aláírásra került. Nincs szükség további teendőre.",
    verifyTitle: "Igazolja személyazonosságát",
    contract: "Szerződés",
    signingAs: "Aláíró",
    otpInstructionEmail: "Adja meg a 6 jegyű hitelesítő kódot, amelyet e-mailben küldtünk.",
    otpInstructionSms: "Adja meg a 6 jegyű hitelesítő kódot, amelyet SMS-ben küldtünk.",
    verifyButton: "Kód ellenőrzése",
    enterCode: "Adja meg a hitelesítő kódot",
    connectionError: "Kapcsolódási hiba. Kérjük, próbálja újra.",
    signTitle: "Szerződés aláírása",
    identityVerified: "Személyazonossága igazolva",
    typeNameLabel: "Írja be teljes nevét az aláíráshoz",
    signaturePreview: "Aláírás előnézete",
    legalText: (name, cn) => `Az "Aláírás" gombra kattintva megerősítem, hogy ${name} vagyok, és elfogadom a(z) ${cn} szerződés feltételeit. Ez az elektronikus aláírás ugyanolyan jogi érvénnyel bír, mint a kézzel írt aláírás.`,
    signButton: "Szerződés aláírása",
    successTitle: "A szerződés sikeresen aláírva",
    successDesc: "Aláírása rögzítésre került. Bezárhatja ezt az ablakot.",
    securedBy: "Az INDEXUS CRM rendszer biztosítja",
  },
  ro: {
    portalTitle: "Semnarea contractului",
    loading: "Se încarcă informațiile de semnare...",
    invalidLink: "Acest link de semnare nu este valid",
    serverError: "Nu s-a putut conecta la server. Încercați din nou mai târziu.",
    submitFailed: "Trimiterea semnăturii a eșuat",
    alreadySignedTitle: "Contractul este deja semnat",
    alreadySignedDesc: "Acest contract a fost deja semnat. Nu este necesară nicio acțiune suplimentară.",
    verifyTitle: "Verificați-vă identitatea",
    contract: "Contract",
    signingAs: "Semnați ca",
    otpInstructionEmail: "Introduceți codul de verificare din 6 cifre trimis pe e-mail.",
    otpInstructionSms: "Introduceți codul de verificare din 6 cifre trimis prin SMS.",
    verifyButton: "Verifică codul",
    enterCode: "Introduceți codul de verificare",
    connectionError: "Eroare de conexiune. Vă rugăm să încercați din nou.",
    signTitle: "Semnează contractul",
    identityVerified: "Identitatea dvs. a fost verificată",
    typeNameLabel: "Scrieți-vă numele complet pentru semnătură",
    signaturePreview: "Previzualizare semnătură",
    legalText: (name, cn) => `Apăsând „Semnează contractul", confirm că sunt ${name} și sunt de acord cu termenii contractului ${cn}. Această semnătură electronică are aceeași valoare juridică ca o semnătură olografă.`,
    signButton: "Semnează contractul",
    successTitle: "Contractul a fost semnat cu succes",
    successDesc: "Semnătura dvs. a fost înregistrată. Puteți închide această fereastră.",
    securedBy: "Securizat de INDEXUS CRM",
  },
  it: {
    portalTitle: "Firma del contratto",
    loading: "Caricamento delle informazioni...",
    invalidLink: "Questo link di firma non è valido",
    serverError: "Impossibile connettersi al server. Riprova più tardi.",
    submitFailed: "Invio della firma non riuscito",
    alreadySignedTitle: "Il contratto è già firmato",
    alreadySignedDesc: "Questo contratto è già stato firmato. Non è necessaria alcuna azione aggiuntiva.",
    verifyTitle: "Verifica la tua identità",
    contract: "Contratto",
    signingAs: "Firmi come",
    otpInstructionEmail: "Inserisci il codice di verifica a 6 cifre inviato alla tua e-mail.",
    otpInstructionSms: "Inserisci il codice di verifica a 6 cifre inviato via SMS.",
    verifyButton: "Verifica codice",
    enterCode: "Inserisci il codice di verifica",
    connectionError: "Errore di connessione. Riprova.",
    signTitle: "Firma il contratto",
    identityVerified: "La tua identità è stata verificata",
    typeNameLabel: "Scrivi il tuo nome completo per la firma",
    signaturePreview: "Anteprima firma",
    legalText: (name, cn) => `Cliccando su "Firma il contratto", confermo di essere ${name} e di accettare i termini del contratto ${cn}. Questa firma elettronica ha la stessa validità legale di una firma autografa.`,
    signButton: "Firma il contratto",
    successTitle: "Contratto firmato con successo",
    successDesc: "La tua firma è stata registrata. Puoi chiudere questa finestra.",
    securedBy: "Protetto da INDEXUS CRM",
  },
  de: {
    portalTitle: "Vertragsunterzeichnung",
    loading: "Signaturinformationen werden geladen...",
    invalidLink: "Dieser Signaturlink ist nicht gültig",
    serverError: "Verbindung zum Server fehlgeschlagen. Bitte versuchen Sie es später erneut.",
    submitFailed: "Die Unterschrift konnte nicht gesendet werden",
    alreadySignedTitle: "Vertrag bereits unterschrieben",
    alreadySignedDesc: "Dieser Vertrag wurde bereits unterschrieben. Keine weitere Aktion erforderlich.",
    verifyTitle: "Identität bestätigen",
    contract: "Vertrag",
    signingAs: "Sie unterschreiben als",
    otpInstructionEmail: "Geben Sie den 6-stelligen Verifizierungscode ein, der an Ihre E-Mail gesendet wurde.",
    otpInstructionSms: "Geben Sie den 6-stelligen Verifizierungscode ein, der per SMS gesendet wurde.",
    verifyButton: "Code überprüfen",
    enterCode: "Verifizierungscode eingeben",
    connectionError: "Verbindungsfehler. Bitte versuchen Sie es erneut.",
    signTitle: "Vertrag unterschreiben",
    identityVerified: "Ihre Identität wurde bestätigt",
    typeNameLabel: "Geben Sie Ihren vollständigen Namen zur Unterschrift ein",
    signaturePreview: "Unterschriftsvorschau",
    legalText: (name, cn) => `Durch Klicken auf "Vertrag unterschreiben" bestätige ich, dass ich ${name} bin und den Bedingungen des Vertrags ${cn} zustimme. Diese elektronische Unterschrift hat dieselbe Rechtsgültigkeit wie eine handschriftliche Unterschrift.`,
    signButton: "Vertrag unterschreiben",
    successTitle: "Vertrag erfolgreich unterschrieben",
    successDesc: "Ihre Unterschrift wurde erfasst. Sie können dieses Fenster schließen.",
    securedBy: "Gesichert durch INDEXUS CRM",
  },
  en: {
    portalTitle: "Contract Signing Portal",
    loading: "Loading signing information...",
    invalidLink: "This signing link is not valid",
    serverError: "Unable to connect to the server. Please try again later.",
    submitFailed: "Failed to submit signature",
    alreadySignedTitle: "Contract Already Signed",
    alreadySignedDesc: "This contract has already been signed. No further action is needed.",
    verifyTitle: "Verify Your Identity",
    contract: "Contract",
    signingAs: "Signing as",
    otpInstructionEmail: "Enter the 6-digit verification code sent to your email.",
    otpInstructionSms: "Enter the 6-digit verification code sent to your phone.",
    verifyButton: "Verify Code",
    enterCode: "Enter the verification code",
    connectionError: "Connection error. Please try again.",
    signTitle: "Sign Contract",
    identityVerified: "Your identity has been verified",
    typeNameLabel: "Type your full name to sign",
    signaturePreview: "Signature Preview",
    legalText: (name, cn) => `By clicking "Sign Contract" below, I confirm that I am ${name} and I agree to the terms of contract ${cn}. This electronic signature has the same legal validity as a handwritten signature.`,
    signButton: "Sign Contract",
    successTitle: "Contract Signed Successfully",
    successDesc: "Your signature has been recorded. You may close this window.",
    securedBy: "Secured by INDEXUS CRM",
  },
};

export default function PublicSigningPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [step, setStep] = useState<SigningStep>("loading");
  const [signingInfo, setSigningInfo] = useState<SigningInfo | null>(null);
  const [locale, setLocale] = useState<SigningLocale>("en");
  const [errorMessage, setErrorMessage] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [typedName, setTypedName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpError, setOtpError] = useState("");

  const t = useMemo(() => signingPageI18n[locale], [locale]);

  useEffect(() => {
    if (!token) return;
    fetchSigningInfo();
  }, [token]);

  async function fetchSigningInfo() {
    try {
      const res = await fetch(`/api/public/sign/${token}`);
      const data = await res.json();

      if (data.locale && signingPageI18n[data.locale as SigningLocale]) {
        setLocale(data.locale as SigningLocale);
      }

      if (!res.ok) {
        if (data.alreadySigned) {
          setStep("already_signed");
        } else {
          const detectedLocale = (data.locale && signingPageI18n[data.locale as SigningLocale]) ? data.locale as SigningLocale : locale;
          setErrorMessage(data.error || signingPageI18n[detectedLocale].invalidLink);
          setStep("error");
        }
        return;
      }

      setSigningInfo(data);
      if (data.otpVerified) {
        setStep("sign");
      } else {
        setStep("otp");
      }
    } catch {
      setErrorMessage(signingPageI18n[locale].serverError);
      setStep("error");
    }
  }

  async function handleVerifyOtp() {
    if (!otpCode || otpCode.length < 4) {
      setOtpError(t.enterCode);
      return;
    }

    setIsSubmitting(true);
    setOtpError("");

    try {
      const res = await fetch(`/api/public/sign/${token}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otpCode })
      });
      const data = await res.json();

      if (!res.ok) {
        setOtpError(data.error || t.connectionError);
        setIsSubmitting(false);
        return;
      }

      setStep("sign");
    } catch {
      setOtpError(t.connectionError);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitSignature() {
    if (!typedName || typedName.trim().length < 2) {
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/public/sign/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typedName: typedName.trim() })
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || t.submitFailed);
        setStep("error");
        return;
      }

      setStep("success");
    } catch {
      setErrorMessage(t.connectionError);
      setStep("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #6B1C3B 0%, #4a1329 50%, #2d0b19 100%)" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white" data-testid="text-signing-title">{signingInfo?.brandName || "INDEXUS"}</h1>
          <p className="text-white/70 text-sm mt-1">{t.portalTitle}</p>
        </div>

        {step === "loading" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mb-4" />
              <p className="text-muted-foreground" data-testid="text-loading">{t.loading}</p>
            </CardContent>
          </Card>
        )}

        {step === "error" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <p className="text-center text-muted-foreground" data-testid="text-error">{errorMessage}</p>
            </CardContent>
          </Card>
        )}

        {step === "already_signed" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <h2 className="text-lg font-semibold" data-testid="text-already-signed">{t.alreadySignedTitle}</h2>
              <p className="text-center text-muted-foreground text-sm">{t.alreadySignedDesc}</p>
            </CardContent>
          </Card>
        )}

        {step === "otp" && signingInfo && (
          <Card>
            <CardHeader className="text-center gap-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(107, 28, 59, 0.1)" }}>
                <ShieldCheck className="h-6 w-6" style={{ color: "#6B1C3B" }} />
              </div>
              <CardTitle className="text-lg" data-testid="text-verify-title">{t.verifyTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">{t.contract} <span className="font-medium text-foreground">{signingInfo.contractNumber}</span></p>
                <p className="text-sm text-muted-foreground">{t.signingAs} <span className="font-medium text-foreground">{signingInfo.signerName}</span></p>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                {signingInfo.verificationMethod === "sms_otp" ? t.otpInstructionSms : t.otpInstructionEmail}
              </p>
              <Input
                data-testid="input-otp-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otpCode}
                onChange={(e) => {
                  setOtpCode(e.target.value.replace(/\D/g, ""));
                  setOtpError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                className="text-center text-2xl tracking-[0.5em] font-mono"
              />
              {otpError && (
                <p className="text-sm text-destructive text-center" data-testid="text-otp-error">{otpError}</p>
              )}
              <Button
                data-testid="button-verify-otp"
                className="w-full"
                onClick={handleVerifyOtp}
                disabled={isSubmitting || otpCode.length < 4}
                style={{ backgroundColor: "#6B1C3B" }}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t.verifyButton}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "sign" && signingInfo && (
          <Card>
            <CardHeader className="text-center gap-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(107, 28, 59, 0.1)" }}>
                <PenLine className="h-6 w-6" style={{ color: "#6B1C3B" }} />
              </div>
              <CardTitle className="text-lg" data-testid="text-sign-title">{t.signTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">{t.contract} <span className="font-medium text-foreground">{signingInfo.contractNumber}</span></p>
                <p className="text-sm text-muted-foreground">{t.identityVerified}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t.typeNameLabel}</label>
                <Input
                  data-testid="input-typed-name"
                  type="text"
                  placeholder={signingInfo.signerName}
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitSignature()}
                  className="text-base"
                />
              </div>

              {typedName.trim().length >= 2 && (
                <div className="rounded-md border p-6 text-center" style={{ backgroundColor: "rgba(107, 28, 59, 0.03)" }}>
                  <p className="text-xs text-muted-foreground mb-2">{t.signaturePreview}</p>
                  <p
                    data-testid="text-signature-preview"
                    className="text-3xl"
                    style={{
                      fontFamily: "'Dancing Script', 'Brush Script MT', 'Segoe Script', cursive",
                      color: "#1a1a2e"
                    }}
                  >
                    {typedName.trim()}
                  </p>
                </div>
              )}

              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t.legalText(signingInfo.signerName, signingInfo.contractNumber)}
                </p>
              </div>

              <Button
                data-testid="button-submit-signature"
                className="w-full"
                onClick={handleSubmitSignature}
                disabled={isSubmitting || typedName.trim().length < 2}
                style={{ backgroundColor: "#6B1C3B" }}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSignature className="h-4 w-4 mr-2" />}
                {t.signButton}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "success" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold" data-testid="text-success-title">{t.successTitle}</h2>
              <p className="text-center text-muted-foreground text-sm">
                {t.successDesc}
              </p>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-white/40 text-xs mt-6">
          {signingInfo?.brandName 
            ? t.securedBy.replace(/INDEXUS CRM/g, signingInfo.brandName).replace(/INDEXUS/g, signingInfo.brandName)
            : t.securedBy}
        </p>
      </div>
    </div>
  );
}
