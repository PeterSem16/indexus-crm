import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Mic, Smartphone, Star, UserCircle, Megaphone, Tag, Phone } from "lucide-react";

export type CallRecord = {
  id: string; name: string; phone: string; time: string; duration: string;
  direction: "inbound" | "outbound"; status?: string; sentiment: "positive" | "neutral" | "negative";
  summary: string; campaign: string; agent: string; queue?: string; important?: boolean;
};

export const calls: CallRecord[] = [
  { id: "1", name: "MUDr. Jana Nováková", phone: "+421 905 441 228", time: "10:42", duration: "04:18", direction: "outbound", sentiment: "positive", summary: "Záujem o rozšírenie objednávky a ďalší termín prezentácie.", campaign: "Q2 Clinic Expansion", agent: "Lucia Kováčová", important: true },
  { id: "2", name: "PharmDr. Martin Horváth", phone: "+421 903 120 887", time: "10:18", duration: "08:52", direction: "inbound", sentiment: "neutral", summary: "Klient sa informoval o dostupnosti produktov a cenovej ponuke.", campaign: "Inbound Leads", agent: "Peter Bielik", queue: "SK — Všeobecná linka" },
  { id: "3", name: "Nemocnica Bory", phone: "+421 2 321 654 90", time: "09:57", duration: "02:06", direction: "outbound", sentiment: "negative", summary: "Požiadavka na spätné zavolanie po konzultácii s vedením.", campaign: "Hospital Partnerships", agent: "Marek Šimun" },
  { id: "4", name: "MUDr. Tomáš Benko", phone: "+421 907 883 110", time: "09:31", duration: "00:00", direction: "inbound", status: "no answer", sentiment: "neutral", summary: "Hovor nebol prijatý.", campaign: "Q2 Clinic Expansion", agent: "—" },
  { id: "5", name: "Klinika Vitalis", phone: "+421 911 334 207", time: "Včera 16:44", duration: "06:27", direction: "outbound", sentiment: "positive", summary: "Dohodnutá návšteva obchodného zástupcu na budúci týždeň.", campaign: "Retention 2025", agent: "Lucia Kováčová" },
];

export function Direction({ call }: { call: CallRecord }) {
  if (call.status) return <PhoneMissed className="h-4 w-4 text-destructive" />;
  return call.direction === "inbound"
    ? <PhoneIncoming className="h-4 w-4 text-emerald-600" />
    : <PhoneOutgoing className="h-4 w-4 text-sky-600" />;
}

export function Chip({ children, tone = "muted" }: { children: React.ReactNode; tone?: string }) {
  const styles: Record<string, string> = { muted: "bg-muted text-muted-foreground", red: "bg-primary/10 text-primary border-primary/20", blue: "bg-sky-50 text-sky-700 border-sky-200", green: "bg-emerald-50 text-emerald-700 border-emerald-200", orange: "bg-orange-50 text-orange-700 border-orange-200" };
  return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-medium ${styles[tone] || styles.muted}`}>{children}</span>;
}