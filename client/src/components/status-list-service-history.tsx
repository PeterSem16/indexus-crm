import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Clock3, FileClock, History, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { statusListActionLabel } from "./status-list-action-labels";

const messages = {
  title: ["Action history", "História akcií", "Historie akcí", "Műveleti előzmények", "Istoricul acțiunilor", "Cronologia azioni", "Aktionsverlauf"],
  hint: ["Last 100 recorded events. Older service logs confirm an audit entry, not delivery; missing entries do not prove an action never ran.", "Posledných 100 zaznamenaných udalostí. Staršie servisné záznamy potvrdzujú zápis do histórie, nie doručenie; chýbajúci záznam neznamená, že akcia neprebehla.", "Posledních 100 zaznamenaných událostí. Starší servisní záznamy potvrzují zápis do historie, ne doručení; chybějící záznam neznamená, že akce neproběhla.", "Az utolsó 100 rögzített esemény. A régi naplóbejegyzés nem igazolja a kézbesítést; a hiányzó bejegyzés nem bizonyítja, hogy a művelet nem futott le.", "Ultimele 100 de evenimente înregistrate. Jurnalele vechi nu confirmă livrarea; lipsa unei înregistrări nu dovedește că acțiunea nu a rulat.", "Ultimi 100 eventi registrati. I vecchi log non confermano la consegna; un evento assente non prova che l'azione non sia stata eseguita.", "Letzte 100 erfasste Ereignisse. Alte Protokolle bestätigen keine Zustellung; ein fehlender Eintrag beweist nicht, dass die Aktion nie ausgeführt wurde."],
  empty: ["No recorded events.", "Zatiaľ bez zaznamenaných udalostí.", "Zatím bez zaznamenaných událostí.", "Még nincs rögzített esemény.", "Nu există evenimente înregistrate.", "Nessun evento registrato.", "Noch keine Ereignisse erfasst."],
  error: ["History could not be loaded.", "Históriu sa nepodarilo načítať.", "Historii se nepodařilo načíst.", "Az előzmények nem tölthetők be.", "Istoricul nu a putut fi încărcat.", "Impossibile caricare la cronologia.", "Verlauf konnte nicht geladen werden."],
  refresh: ["Refresh", "Obnoviť", "Obnovit", "Frissítés", "Actualizează", "Aggiorna", "Aktualisieren"],
  recorded: ["Recorded · delivery not verified", "Zaznamenané · doručenie neoverené", "Zaznamenáno · doručení neověřeno", "Rögzítve · kézbesítés nem ellenőrzött", "Înregistrat · livrare neverificată", "Registrato · consegna non verificata", "Erfasst · Zustellung ungeprüft"],
  pending: ["Waiting for processing", "Čaká na spracovanie", "Čeká na zpracování", "Feldolgozásra vár", "În așteptarea procesării", "In attesa di elaborazione", "Wartet auf Verarbeitung"],
  done: ["Processed", "Spracované", "Zpracováno", "Feldolgozva", "Procesat", "Elaborato", "Verarbeitet"],
  failed: ["Needs attention", "Vyžaduje kontrolu", "Vyžaduje kontrolu", "Ellenőrzést igényel", "Necesită verificare", "Richiede verifica", "Prüfung erforderlich"],
  callback: ["Callback scheduled", "Naplánované spätné volanie", "Naplánované zpětné volání", "Visszahívás ütemezve", "Reapelare programată", "Richiamata programmata", "Rückruf geplant"],
  kept_existing: ["Existing callback kept", "Ponechaný pôvodný termín", "Ponechán původní termín", "Korábbi visszahívás megtartva", "Reapelarea existentă păstrată", "Richiamata esistente mantenuta", "Bestehender Rückruf beibehalten"],
  condition_false: ["Condition not met · no change", "Podmienka nesplnená · bez zmeny", "Podmínka nesplněna · beze změny", "Feltétel nem teljesült · nincs változás", "Condiție neîndeplinită · fără modificări", "Condizione non soddisfatta · nessuna modifica", "Bedingung nicht erfüllt · keine Änderung"],
  system: ["System", "Systém", "Systém", "Rendszer", "Sistem", "Sistema", "System"],
} as const;
type Event = { id: string; at: string; automationId: string; actionType: string; state: string; outcome: string | null; callbackDate: string | null; actorName: string | null; itemLabel: string | null; questionLabel: string | null };
export function StatusListServiceHistory({ campaignId, locale, automationId }: { campaignId: string; locale: string; automationId?: string }) {
  const [expanded, setExpanded] = useState(false);
  const index = Math.max(0, ["en", "sk", "cs", "hu", "ro", "it", "de"].indexOf(locale));
  const text = (key: keyof typeof messages) => messages[key][index];
  const endpoint = `/api/campaigns/${campaignId}/status-list-workflows/service-history`;
  const query = useQuery<{ events: Event[] }>({
    queryKey: [endpoint, automationId || "all"],
    enabled: expanded,
    staleTime: 0,
    queryFn: async () => {
      const response = await fetch(`${endpoint}${automationId ? `?automationId=${encodeURIComponent(automationId)}` : ""}`, { credentials: "include" });
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    },
  });
  const date = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "—" : new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Bratislava" }).format(parsed);
  };
  return <details className="mt-4 rounded-xl border border-border bg-card" data-testid="status-list-service-history" onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary className="flex cursor-pointer items-center gap-2 p-4 text-sm font-semibold"><History size={17} className="text-primary"/>{text("title")}</summary>
    <div className="space-y-3 border-t p-4">
      <div className="flex items-start justify-between gap-3"><p className="max-w-prose text-xs leading-relaxed text-muted-foreground">{text("hint")}</p><Button type="button" variant="outline" size="icon" disabled={query.isFetching} aria-label={text("refresh")} onClick={() => void query.refetch()}><RefreshCw size={15}/></Button></div>
      {query.isLoading && <div className="h-16 animate-pulse rounded bg-muted"/>}
      {query.isError && <p role="alert" className="text-sm text-destructive">{text("error")}</p>}
      {query.data?.events.length === 0 && <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">{text("empty")}</p>}
      {query.data?.events.map(event => {
        const Icon = event.state === "pending" ? Clock3 : event.state === "failed" ? TriangleAlert : event.outcome === "callback" ? CalendarClock : event.state === "done" ? CheckCircle2 : FileClock;
        const label = event.state === "done" && event.outcome && event.outcome in messages ? text(event.outcome as keyof typeof messages) : text(event.state in messages ? event.state as keyof typeof messages : "recorded");
        return <article key={event.id} className="flex gap-3 rounded-xl border bg-background p-3">
          <span className={`mt-0.5 shrink-0 rounded-lg p-2 ${event.state === "failed" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}><Icon size={17}/></span>
          <div className="min-w-0 space-y-1 text-xs"><strong className="block text-sm">{event.questionLabel || event.itemLabel || statusListActionLabel(event.actionType, locale)}</strong><p>{statusListActionLabel(event.actionType, locale)} · {label}</p><p className="text-muted-foreground">{date(event.at)} · {event.actorName || text("system")}</p>{event.callbackDate && <p className="flex items-center gap-1 text-primary"><CalendarClock size={13}/>{date(event.callbackDate)}</p>}</div>
        </article>;
      })}
    </div>
  </details>;
}
