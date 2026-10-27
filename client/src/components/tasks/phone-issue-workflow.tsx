import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Phone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";

export type PhoneIssueReason = "wrong_person" | "not_working" | "verify";
export type PhoneIssueField = "phone" | "phone2" | "phone3";
export type PhoneIssueContext = {
  phones: { field: PhoneIssueField; number: string }[];
  pendingVerification: { issueId: string; phone: string; callId: string | null } | null;
  sourceAvailable?: boolean;
};

const COPY: Record<string, Record<string, string>> = {
  title: { sk:"Údaj o telefónnom čísle",en:"Phone number details",cs:"Údaj o telefonním čísle",hu:"Telefonszám adatai",ro:"Detalii număr de telefon",it:"Dettagli numero di telefono",de:"Angaben zur Telefonnummer" },
  reason: { sk:"Dôvod",en:"Reason",cs:"Důvod",hu:"Indok",ro:"Motiv",it:"Motivo",de:"Grund" },
  wrongPerson: { sk:"Nesprávna osoba / pracovisko",en:"Wrong person or facility",cs:"Nesprávná osoba / pracoviště",hu:"Rossz személy / intézmény",ro:"Persoană / unitate greșită",it:"Persona o struttura errata",de:"Falsche Person oder Einrichtung" },
  notWorking: { sk:"Číslo nefunguje",en:"Number is not working",cs:"Číslo nefunguje",hu:"A szám nem működik",ro:"Numărul nu funcționează",it:"Il numero non funziona",de:"Nummer ist nicht erreichbar" },
  verify: { sk:"Požiadať o overenie",en:"Request verification",cs:"Požádat o ověření",hu:"Ellenőrzés kérése",ro:"Solicită verificarea",it:"Richiedere verificarea",de:"Überprüfung anfordern" },
  phone: { sk:"Telefónne číslo",en:"Phone number",cs:"Telefonní číslo",hu:"Telefonszám",ro:"Număr de telefon",it:"Numero di telefono",de:"Telefonnummer" },
  reportedNumber: { sk:"Nahlásené číslo",en:"Reported number",cs:"Nahlášené číslo",hu:"Bejelentett szám",ro:"Număr raportat",it:"Numero segnalato",de:"Gemeldete Nummer" },
  reportReason: { sk:"Dôvod",en:"Reason",cs:"Důvod",hu:"Indok",ro:"Motiv",it:"Motivo",de:"Grund" },
  phone1: { sk:"Hlavné číslo",en:"Main phone",cs:"Hlavní číslo",hu:"Elsődleges szám",ro:"Număr principal",it:"Numero principale",de:"Hauptnummer" },
  phone2: { sk:"Alternatívne číslo 2",en:"Alternative number 2",cs:"Alternativní číslo 2",hu:"Alternatív szám 2",ro:"Număr alternativ 2",it:"Numero alternativo 2",de:"Alternative Nummer 2" },
  phone3: { sk:"Alternatívne číslo 3",en:"Alternative number 3",cs:"Alternativní číslo 3",hu:"Alternatív szám 3",ro:"Număr alternativ 3",it:"Numero alternativo 3",de:"Alternative Nummer 3" },
  loading: { sk:"Načítavam dostupné čísla…",en:"Loading available numbers…",cs:"Načítám dostupná čísla…",hu:"Elérhető számok betöltése…",ro:"Se încarcă numerele disponibile…",it:"Caricamento dei numeri disponibili…",de:"Verfügbare Nummern werden geladen…" },
  retry: { sk:"Obnoviť",en:"Retry",cs:"Obnovit",hu:"Újrapróbálás",ro:"Reîncearcă",it:"Riprova",de:"Erneut versuchen" },
  noNumbers: { sk:"Pre tento kontakt nie je dostupné telefónne číslo.",en:"No phone number is available for this contact.",cs:"Pro tento kontakt není dostupné telefonní číslo.",hu:"Ehhez a kapcsolathoz nem érhető el telefonszám.",ro:"Nu există un număr disponibil pentru acest contact.",it:"Nessun numero disponibile per questo contatto.",de:"Für diesen Kontakt ist keine Telefonnummer verfügbar." },
  noSource: { sk:"Pre tento kontakt nie je dostupný zdroj zdravotníckeho telefónneho čísla. Vyberte „Požiadať o overenie“ alebo inú kategóriu.",en:"No healthcare phone source is available for this contact. Choose “Request verification” or another category.",cs:"Pro tento kontakt není dostupný zdroj zdravotnického telefonního čísla. Zvolte „Požádat o ověření“ nebo jinou kategorii.",hu:"Ehhez a kapcsolathoz nem érhető el egészségügyi telefonszám-forrás. Válassza az „Ellenőrzés kérése” lehetőséget vagy másik kategóriát.",ro:"Nu este disponibilă o sursă medicală de telefon pentru acest contact. Alegeți „Solicită verificarea” sau altă categorie.",it:"Per questo contatto non è disponibile una fonte sanitaria del numero. Scegli “Richiedere verifiche” o un'altra categoria.",de:"Für diesen Kontakt ist keine medizinische Telefonnummernquelle verfügbar. Wählen Sie „Überprüfung anfordern“ oder eine andere Kategorie." },
  loadError: { sk:"Údaje o telefóne sa nepodarilo načítať.",en:"Phone details could not be loaded.",cs:"Údaje o telefonu se nepodařilo načíst.",hu:"A telefonadatok betöltése nem sikerült.",ro:"Detaliile telefonului nu au putut fi încărcate.",it:"Impossibile caricare i dettagli del telefono.",de:"Telefonangaben konnten nicht geladen werden." },
  verifyTitle: { sk:"Overenie telefónneho čísla",en:"Verify phone number",cs:"Ověření telefonního čísla",hu:"Telefonszám ellenőrzése",ro:"Verificarea numărului",it:"Verifica numero di telefono",de:"Telefonnummer überprüfen" },
  verifyHint: { sk:"Potvrďte, že ste sa dovolali správnemu poskytovateľovi alebo zdravotníckemu personálu.",en:"Confirm that you reached the correct provider or healthcare personnel.",cs:"Potvrďte, že jste se dovolali správnému poskytovateli nebo zdravotnickému personálu.",hu:"Erősítse meg, hogy a megfelelő szolgáltatót vagy egészségügyi személyzetet érte el.",ro:"Confirmați că ați contactat furnizorul sau personalul medical corect.",it:"Conferma di aver raggiunto il fornitore o il personale sanitario corretto.",de:"Bestätigen Sie, dass Sie den richtigen Anbieter oder das richtige medizinische Personal erreicht haben." },
  waiting: { sk:"Overenie bude možné po priradení hovoru k tejto požiadavke.",en:"Verification will be available once a call is linked to this request.",cs:"Ověření bude možné po přiřazení hovoru k této žádosti.",hu:"Az ellenőrzés akkor válik elérhetővé, ha hívás kapcsolódik a kéréshez.",ro:"Verificarea va fi disponibilă după asocierea unui apel cu această solicitare.",it:"La verifica sarà disponibile quando una chiamata sarà collegata alla richiesta.",de:"Die Überprüfung ist möglich, sobald dieser Anfrage ein Anruf zugeordnet wurde." },
  confirm: { sk:"Potvrdiť správny kontakt",en:"Confirm correct contact",cs:"Potvrdit správný kontakt",hu:"Megfelelő kapcsolat megerősítése",ro:"Confirmă contactul corect",it:"Conferma contatto corretto",de:"Richtigen Kontakt bestätigen" },
  success: { sk:"Telefónne číslo bolo overené.",en:"Phone number verified.",cs:"Telefonní číslo bylo ověřeno.",hu:"A telefonszám ellenőrizve.",ro:"Numărul de telefon a fost verificat.",it:"Numero di telefono verificato.",de:"Telefonnummer bestätigt." },
  errorReported: { sk:"Táto požiadavka už bola nahlásená. Obnovili sme aktuálny stav.",en:"This issue has already been reported. The latest status has been refreshed.",cs:"Tento problém již byl nahlášen. Obnovili jsme aktuální stav.",hu:"Ezt a problémát már jelentették. Frissítettük az aktuális állapotot.",ro:"Această problemă a fost deja raportată. Am actualizat starea.",it:"Il problema è già stato segnalato. Abbiamo aggiornato lo stato.",de:"Dieses Problem wurde bereits gemeldet. Der aktuelle Status wurde aktualisiert." },
  errorStale: { sk:"Táto požiadavka už nie je aktuálna. Obnovili sme údaje.",en:"This request is no longer current. The details have been refreshed.",cs:"Tato žádost již není aktuální. Obnovili jsme údaje.",hu:"Ez a kérés már nem aktuális. Frissítettük az adatokat.",ro:"Această solicitare nu mai este actuală. Am actualizat detaliile.",it:"Questa richiesta non è più attuale. I dettagli sono stati aggiornati.",de:"Diese Anfrage ist nicht mehr aktuell. Die Angaben wurden aktualisiert." },
  errorInvalid: { sk:"Overenie sa nepodarilo potvrdiť. Skontrolujte aktuálny kontakt a skúste znova.",en:"Verification could not be confirmed. Check the current contact and try again.",cs:"Ověření se nepodařilo potvrdit. Zkontrolujte aktuální kontakt a zkuste to znovu.",hu:"Az ellenőrzést nem sikerült megerősíteni. Ellenőrizze a kapcsolatot, majd próbálja újra.",ro:"Verificarea nu a putut fi confirmată. Verificați contactul și încercați din nou.",it:"Non è stato possibile confermare la verifica. Controlla il contatto e riprova.",de:"Die Überprüfung konnte nicht bestätigt werden. Prüfen Sie den Kontakt und versuchen Sie es erneut." },
  errorNoSource: { sk:"Pre tento kontakt nie je nakonfigurovaný zdroj telefónneho čísla.",en:"No phone-number source is configured for this contact.",cs:"Pro tento kontakt není nakonfigurován zdroj telefonního čísla.",hu:"Ehhez a kapcsolathoz nincs telefonszámforrás beállítva.",ro:"Nu este configurată o sursă de număr pentru acest contact.",it:"Non è configurata alcuna fonte del numero per questo contatto.",de:"Für diesen Kontakt ist keine Telefonnummernquelle eingerichtet." },
  genericError: { sk:"Akciu sa nepodarilo dokončiť. Obnovte údaje a skúste znova.",en:"The action could not be completed. Refresh and try again.",cs:"Akci se nepodařilo dokončit. Obnovte údaje a zkuste to znovu.",hu:"A művelet nem sikerült. Frissítsen, majd próbálja újra.",ro:"Acțiunea nu a putut fi finalizată. Actualizați și încercați din nou.",it:"Impossibile completare l'azione. Aggiorna e riprova.",de:"Die Aktion konnte nicht abgeschlossen werden. Aktualisieren Sie und versuchen Sie es erneut." },
};

export function phoneIssueText(key: string, locale: string) {
  const lang = locale.toLowerCase().slice(0, 2);
  return COPY[key]?.[lang] || COPY[key]?.en || key;
}

export function phoneIssueErrorText(code: string | undefined, locale: string) {
  const key = code === "phone_issue_already_reported" ? "errorReported"
    : code === "phone_issue_stale" ? "errorStale"
    : code === "phone_issue_invalid" ? "errorInvalid"
    : code === "phone_issue_no_source" ? "errorNoSource" : "genericError";
  return phoneIssueText(key, locale);
}

export function composePhoneIssueDetails(
  agentBody: string,
  reason: PhoneIssueReason,
  expectedNumber: string,
  locale: string,
) {
  const reasonLabel = phoneIssueText(reason === "wrong_person" ? "wrongPerson" : reason === "not_working" ? "notWorking" : "verify", locale);
  return [
    agentBody.trim(),
    `${phoneIssueText("reportReason", locale)}: ${reasonLabel}`,
    `${phoneIssueText("reportedNumber", locale)}: ${expectedNumber}`,
  ].filter(Boolean).join("\n\n");
}

export function phoneIssueTaskCanSubmit(args: {
  eligible: boolean;
  loading: boolean;
  fetching: boolean;
  error: boolean;
  data?: PhoneIssueContext;
  reason: PhoneIssueReason | "";
  phoneField: PhoneIssueField | "";
}) {
  if (!args.eligible || args.loading || args.fetching || args.error || !args.data || !args.reason) return false;
  const phone = args.data.phones.find(item => item.field === args.phoneField);
  return !!phone && (args.data.sourceAvailable !== false || args.reason === "verify");
}

async function refreshPhoneIssueQueries(missionId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["/api/campaigns", missionId, "status-list"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/campaigns", missionId, "contacts"] }),
    queryClient.invalidateQueries({
      predicate: query => query.queryKey.some(part =>
        typeof part === "string"
        && part.includes(`/api/campaigns/${missionId}/contacts/`)
        && (part.includes("status-list-workflows/healthcare") || part.includes("status-list-workflows")),
      ),
    }),
  ]);
}

export function usePhoneIssueContext(args: {
  missionId?: string | null;
  sessionId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  enabled: boolean;
  poll?: boolean;
}) {
  const eligible = (args.entityType === "clinic" || args.entityType === "hospital")
    && !!args.missionId && !!args.sessionId && !!args.entityId;
  const query = useQuery<PhoneIssueContext>({
    queryKey: ["phone-issue-context", args.missionId, args.sessionId, args.entityType, args.entityId],
    enabled: args.enabled && eligible,
    queryFn: async () => {
      const url = `/api/campaigns/${encodeURIComponent(args.missionId!)}/phone-issues/context?sessionId=${encodeURIComponent(args.sessionId!)}&entityType=${args.entityType}&entityId=${encodeURIComponent(args.entityId!)}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("context_unavailable");
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: args.enabled && args.poll ? 3000 : false,
  });
  return { ...query, eligible };
}

export function PhoneIssueTaskFields(props: {
  locale: string;
  loading: boolean;
  error: boolean;
  data?: PhoneIssueContext;
  retryable?: boolean;
  reason: PhoneIssueReason | "";
  phoneField: PhoneIssueField | "";
  onReasonChange: (value: PhoneIssueReason | "") => void;
  onPhoneFieldChange: (value: PhoneIssueField | "") => void;
  onRetry: () => void;
}) {
  const { locale, loading, error, data, reason, phoneField, onReasonChange, onPhoneFieldChange, onRetry } = props;
  const phone = data?.phones.find(item => item.field === phoneField);
  return <section className="md:col-span-2 rounded-xl border border-[#c7d8e7] bg-white/70 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70" data-testid="phone-issue-task-fields">
    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><Phone className="h-4 w-4 text-[#2d6fba]"/>{phoneIssueText("title", locale)}</div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">{phoneIssueText("reason", locale)}
        <select required value={reason} data-testid="phone-issue-reason" onChange={event => onReasonChange(event.target.value as PhoneIssueReason | "")}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground">
          <option value="">—</option>
          {(["wrong_person","not_working","verify"] as PhoneIssueReason[]).map(item => <option key={item} value={item}>
            {phoneIssueText(item === "wrong_person" ? "wrongPerson" : item === "not_working" ? "notWorking" : "verify", locale)}
          </option>)}
        </select>
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">{phoneIssueText("phone", locale)}
        <select required value={phoneField} data-testid="phone-issue-field" onChange={event => onPhoneFieldChange(event.target.value as PhoneIssueField | "")}
          disabled={loading || error || !data?.phones.length}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground disabled:opacity-60">
          <option value="">{loading ? phoneIssueText("loading", locale) : "—"}</option>
          {(data?.phones || []).map(item => <option key={item.field} value={item.field}>
            {phoneIssueText(item.field === "phone" ? "phone1" : item.field, locale)} · {item.number}
          </option>)}
        </select>
      </label>
    </div>
    {loading && <p className="mt-2 text-xs text-muted-foreground">{phoneIssueText("loading", locale)}</p>}
    {error && <div className="mt-2 flex items-center justify-between gap-2 text-xs text-destructive" role="alert">
      <span>{phoneIssueText("loadError", locale)}</span>{props.retryable !== false && <Button type="button" variant="ghost" size="sm" onClick={onRetry}><RefreshCw className="mr-1 h-3 w-3"/>{phoneIssueText("retry", locale)}</Button>}
    </div>}
    {!loading && !error && data && !data.phones.length && <p className="mt-2 text-xs text-muted-foreground">{phoneIssueText("noNumbers", locale)}</p>}
    {!loading && !error && reason && reason !== "verify" && data?.sourceAvailable === false &&
      <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0"/>{phoneIssueText("noSource", locale)}</p>}
    {phone && <p className="mt-2 text-xs text-muted-foreground">{phoneIssueText("phone", locale)}: <span className="font-medium text-foreground">{phone.number}</span></p>}
  </section>;
}

export function PhoneIssueVerificationControl(props: {
  open: boolean;
  missionId?: string | null;
  sessionId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  locale: string;
}) {
  const context = usePhoneIssueContext({ ...props, enabled: props.open, poll: true });
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [verifiedNumber, setVerifiedNumber] = useState("");
  useEffect(() => { setConfirmed(false); setMessage(""); setVerifiedNumber(""); }, [props.missionId, props.entityType, props.entityId, props.sessionId, props.open]);
  const pending = context.data?.pendingVerification;
  useEffect(() => { setConfirmed(false); }, [pending?.issueId, pending?.callId, pending?.phone]);
  const verify = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(props.missionId!)}/phone-issues/verify`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: props.sessionId,
          entityType: props.entityType,
          entityId: props.entityId,
          issueId: pending!.issueId,
          callId: pending!.callId,
          expectedNumber: pending!.phone,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.code || "phone_issue_invalid");
      }
      return response.json().catch(() => ({}));
    },
    onSuccess: async () => {
      setMessage(phoneIssueText("success", props.locale));
      setVerifiedNumber(pending!.phone);
      setConfirmed(false);
      await Promise.all([context.refetch(), refreshPhoneIssueQueries(props.missionId!)]);
    },
    onError: async error => {
      setMessage(phoneIssueErrorText(error instanceof Error ? error.message : undefined, props.locale));
      await Promise.all([context.refetch(), refreshPhoneIssueQueries(props.missionId!)]);
    },
  });
  // Polling happens every few seconds to learn when a finalized call log has
  // been linked. Keep the last trusted context visible through that fetch.
  if (!props.open || !context.eligible || (!context.data && (context.isLoading || context.isFetching || context.isError)) || (!pending && !verifiedNumber)) return null;
  return <div className="mb-3 rounded-xl border border-[#c7d8e7] bg-white/75 p-3 dark:border-slate-700 dark:bg-slate-900/70" data-testid="phone-issue-verification">
    <div className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2d6fba]"/>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{phoneIssueText("verifyTitle", props.locale)}</p>
        {verifiedNumber ? <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">{message} <span className="font-medium">{verifiedNumber}</span></p> : <>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{phoneIssueText("verifyHint", props.locale)} <span className="font-medium text-foreground">{pending?.phone}</span></p>
        {pending?.callId ? <label className="mt-2 flex items-start gap-2 text-xs leading-relaxed">
          <input type="checkbox" data-testid="phone-issue-confirm-checkbox" className="mt-0.5 accent-[#2d6fba]" checked={confirmed} disabled={context.isFetching || context.isError} onChange={event => setConfirmed(event.target.checked)}/>
          <span>{phoneIssueText("verifyHint", props.locale)}</span>
        </label> : <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{phoneIssueText("waiting", props.locale)}</p>}
        {message && <p className={`mt-2 text-xs ${verify.isError ? "text-destructive" : "text-emerald-700 dark:text-emerald-300"}`} role={verify.isError ? "alert" : "status"}>{message}</p>}
        <Button type="button" size="sm" className="mt-3 h-8" disabled={!pending?.callId || !confirmed || context.isFetching || context.isError || verify.isPending}
          onClick={() => { setMessage(""); verify.mutate(); }} data-testid="btn-confirm-phone-issue">
          {verify.isPending ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5"/>}
          {phoneIssueText("confirm", props.locale)}
        </Button>
        </>}
      </div>
    </div>
  </div>;
}
