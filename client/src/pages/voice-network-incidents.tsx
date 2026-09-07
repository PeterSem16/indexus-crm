import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/i18n";

type Incident = { id: string; callLogId?: string | null; kind: string; severity: string; connectionState?: string | null; iceState?: string | null; rttMs?: number | null; jitterMs?: number | null; packetLossPermille?: number | null; createdAt: string; userName: string };
type Result = { items: Incident[]; total: number; page: number; pageSize: number };
const kinds = ["browser_offline", "sip_transport_disconnected", "sip_registration_disconnected", "ice_failed", "ice_disconnected_sustained", "audio_no_flow", "audio_one_way", "network_quality_degraded"];
const incidentLabels: Record<string, string[]> = {
  en: ["Browser offline", "SIP transport disconnected", "SIP registration disconnected", "ICE failed", "ICE disconnected (sustained)", "No audio flow", "One-way audio", "Network quality degraded", "Warning", "Error"],
  sk: ["Prehliadač je offline", "SIP transport odpojený", "SIP registrácia odpojená", "ICE zlyhalo", "ICE odpojené (trvalo)", "Žiadny tok zvuku", "Jednosmerný zvuk", "Zhoršená kvalita siete", "Upozornenie", "Chyba"],
  cs: ["Prohlížeč je offline", "SIP transport odpojen", "SIP registrace odpojena", "ICE selhalo", "ICE odpojeno (trvale)", "Žádný tok zvuku", "Jednosměrný zvuk", "Zhoršená kvalita sítě", "Upozornění", "Chyba"],
  hu: ["A böngésző offline", "SIP szállítás megszakadt", "SIP-regisztráció megszakadt", "ICE hiba", "ICE megszakadt (tartósan)", "Nincs hangforgalom", "Egyirányú hang", "Romló hálózati minőség", "Figyelmeztetés", "Hiba"],
  ro: ["Browser offline", "Transport SIP deconectat", "Înregistrare SIP deconectată", "ICE eșuat", "ICE deconectat (persistent)", "Fără flux audio", "Audio unidirecțional", "Calitate degradată a rețelei", "Avertisment", "Eroare"],
  it: ["Browser non in linea", "Trasporto SIP disconnesso", "Registrazione SIP disconnessa", "ICE non riuscito", "ICE disconnesso (prolungato)", "Nessun flusso audio", "Audio unidirezionale", "Qualità rete degradata", "Avviso", "Errore"],
  de: ["Browser offline", "SIP-Transport getrennt", "SIP-Registrierung getrennt", "ICE fehlgeschlagen", "ICE getrennt (anhaltend)", "Kein Audiofluss", "Einseitiges Audio", "Netzwerkqualität beeinträchtigt", "Warnung", "Fehler"],
};

export default function VoiceNetworkIncidentsPage() {
  const { user } = useAuth();
  const { locale } = useI18n();
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const copy = {
    en: ["Voice & network incidents", "Operational events recorded without call content or connection details.", "From", "To", "Kind", "Severity", "All", "User", "Time", "No incidents found.", "Previous", "Next"],
    sk: ["Hlasové a sieťové incidenty", "Prevádzkové udalosti bez obsahu hovoru alebo podrobností pripojenia.", "Od", "Do", "Typ", "Závažnosť", "Všetko", "Používateľ", "Čas", "Nenašli sa žiadne incidenty.", "Predchádzajúca", "Ďalšia"],
    cs: ["Hlasové a síťové incidenty", "Provozní události bez obsahu hovoru nebo podrobností připojení.", "Od", "Do", "Typ", "Závažnost", "Vše", "Uživatel", "Čas", "Nebyly nalezeny žádné incidenty.", "Předchozí", "Další"],
    hu: ["Hang- és hálózati incidensek", "Üzemeltetési események hívástartalom és kapcsolati részletek nélkül.", "Kezdő", "Vég", "Típus", "Súlyosság", "Összes", "Felhasználó", "Idő", "Nincs incidens.", "Előző", "Következő"],
    ro: ["Incidente voce și rețea", "Evenimente operaționale fără conținutul apelului sau detalii de conexiune.", "De la", "Până la", "Tip", "Severitate", "Toate", "Utilizator", "Ora", "Nu s-au găsit incidente.", "Înapoi", "Înainte"],
    it: ["Incidenti voce e rete", "Eventi operativi senza contenuto delle chiamate o dettagli di connessione.", "Da", "A", "Tipo", "Gravità", "Tutti", "Utente", "Ora", "Nessun incidente trovato.", "Precedente", "Successivo"],
    de: ["Sprach- und Netzwerkvorfälle", "Betriebsereignisse ohne Gesprächsinhalte oder Verbindungsdetails.", "Von", "Bis", "Art", "Schweregrad", "Alle", "Benutzer", "Zeit", "Keine Vorfälle gefunden.", "Zurück", "Weiter"],
  }[locale] || [];
  const labels = incidentLabels[locale] || incidentLabels.en;
  const warningLabel = labels[kinds.length];
  const errorLabel = labels[kinds.length + 1];
  const metricHeaders = {
    en: ["Call", "Connection / ICE", "RTT", "Jitter", "Loss"],
    sk: ["Hovor", "Pripojenie / ICE", "RTT", "Jitter", "Strata"],
    cs: ["Hovor", "Připojení / ICE", "RTT", "Jitter", "Ztráta"],
    hu: ["Hívás", "Kapcsolat / ICE", "RTT", "Jitter", "Veszteség"],
    ro: ["Apel", "Conexiune / ICE", "RTT", "Jitter", "Pierderi"],
    it: ["Chiamata", "Connessione / ICE", "RTT", "Jitter", "Perdita"],
    de: ["Anruf", "Verbindung / ICE", "RTT", "Jitter", "Verlust"],
  }[locale] || ["Call", "Connection / ICE", "RTT", "Jitter", "Loss"];
  const url = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (kind !== "all") p.set("kind", kind);
    if (severity !== "all") p.set("severity", severity);
    if (from) p.set("from", new Date(`${from}T00:00:00`).toISOString());
    if (to) p.set("to", new Date(`${to}T23:59:59`).toISOString());
    return `/api/admin/voice-network-incidents?${p}`;
  }, [page, kind, severity, from, to]);
  const { data, isLoading } = useQuery<Result>({ queryKey: [url], queryFn: async () => {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) throw new Error("Unable to load incidents");
    return response.json();
  }, enabled: user?.role === "admin" });
  if (user?.role !== "admin") return null;
  return <div className="space-y-4">
    <PageHeader title={copy[0]} description={copy[1]} />
    <Card><CardContent className="pt-6 flex flex-wrap gap-3 items-end">
      <div><Label>{copy[2]}</Label><Input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} /></div>
      <div><Label>{copy[3]}</Label><Input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} /></div>
      <div><Label>{copy[4]}</Label><Select value={kind} onValueChange={v => { setKind(v); setPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{copy[6]}</SelectItem>{kinds.map((v, index) => <SelectItem key={v} value={v}>{labels[index]}</SelectItem>)}</SelectContent></Select></div>
       <div><Label>{copy[5]}</Label><Select value={severity} onValueChange={v => { setSeverity(v); setPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{copy[6]}</SelectItem><SelectItem value="warning">{warningLabel}</SelectItem><SelectItem value="error">{errorLabel}</SelectItem></SelectContent></Select></div>
    </CardContent></Card>
    <Card><CardContent className="pt-6 overflow-x-auto"><Table><TableHeader><TableRow><TableHead>{copy[9]}</TableHead><TableHead>{copy[7]}</TableHead><TableHead>{copy[4]}</TableHead><TableHead>{copy[5]}</TableHead><TableHead>{metricHeaders[0]}</TableHead><TableHead>{metricHeaders[1]}</TableHead><TableHead>{metricHeaders[2]}</TableHead><TableHead>{metricHeaders[3]}</TableHead><TableHead>{metricHeaders[4]}</TableHead></TableRow></TableHeader><TableBody>
      {!isLoading && data?.items.map(item => <TableRow key={item.id}><TableCell className="whitespace-nowrap">{new Date(item.createdAt).toLocaleString(locale)}</TableCell><TableCell>{item.userName}</TableCell><TableCell>{labels[kinds.indexOf(item.kind)] || item.kind}</TableCell><TableCell><Badge variant={item.severity === "error" ? "destructive" : "secondary"}>{item.severity === "error" ? errorLabel : warningLabel}</Badge></TableCell><TableCell className="font-mono text-xs">{item.callLogId ? item.callLogId.slice(0, 8) : "—"}</TableCell><TableCell className="text-xs">{[item.connectionState, item.iceState].filter(Boolean).join(" / ") || "—"}</TableCell><TableCell>{item.rttMs != null ? `${item.rttMs} ms` : "—"}</TableCell><TableCell>{item.jitterMs != null ? `${item.jitterMs} ms` : "—"}</TableCell><TableCell>{item.packetLossPermille != null ? `${(item.packetLossPermille / 10).toFixed(1)}%` : "—"}</TableCell></TableRow>)}
      {!isLoading && !data?.items.length && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">{copy[10]}</TableCell></TableRow>}
    </TableBody></Table><div className="mt-4 flex justify-end gap-2"><Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>{copy[11]}</Button><Button variant="outline" disabled={!data || page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>{copy[12]}</Button></div></CardContent></Card>
  </div>;
}