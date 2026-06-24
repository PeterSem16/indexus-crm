import { useState } from "react";
import { Search, X, Phone, Clock, AlertCircle, Calendar, ChevronDown, ChevronUp, UserSearch } from "lucide-react";

const CONTACTS = [
  { id: 1, name: "MUDr. Peter Seman", entity: "Klinika Viva", phone: "+421948519438", email: "seman@klinikaviva.sk", city: "Bratislava", status: "callback_scheduled", callbackDate: "22.06.2026 09:00", overdue: true, attempts: 10 },
  { id: 2, name: "MUDr. Martin Kabát", entity: "Zdravotné centrum Iris", phone: "+421 915 796 900", email: "kabat@iris.sk", city: "Košice", status: "callback_scheduled", callbackDate: "25.06.2026 10:00", overdue: false, attempts: 9 },
  { id: 3, name: "MUDr. Eva Novotná", entity: "Med Centrum Bella", phone: "+421948519438", email: "novotna@bella.sk", city: "Nitra", status: "pending", attempts: 0 },
  { id: 4, name: "MUDr. Jana Kováčová", entity: "Klinika Medifem", phone: "+421905773403", email: "kovacova@medifem.sk", city: "Žilina", status: "pending", attempts: 0 },
  { id: 5, name: "MUDr. Tomáš Horváth", entity: "Gynekologická ambulancia Horváth", phone: "+421911234567", email: "horvath@gyn.sk", city: "Prešov", status: "no_answer", attempts: 4 },
  { id: 6, name: "MUDr. Lucia Blaho", entity: "Centrum zdravia Blaho", phone: "+421902345678", email: "blaho@centrumzdravie.sk", city: "Banská Bystrica", status: "interested", attempts: 2 },
  { id: 7, name: "MUDr. Roman Mináč", entity: "Klinika Mináč", phone: "+421903456789", email: "minac@klinika.sk", city: "Trnava", status: "not_interested", attempts: 3 },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  callback_scheduled: { label: "Callback", color: "#3b82f6", bg: "#eff6ff" },
  pending: { label: "Nový", color: "#6b7280", bg: "#f9fafb" },
  no_answer: { label: "Nedvíhal", color: "#f59e0b", bg: "#fffbeb" },
  interested: { label: "Záujem", color: "#10b981", bg: "#f0fdf4" },
  not_interested: { label: "Nezáujem", color: "#ef4444", bg: "#fef2f2" },
};

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return <span>{text}</span>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </span>
  );
}

function matchContact(c: typeof CONTACTS[0], q: string): boolean {
  if (!q.trim()) return true;
  const lower = q.toLowerCase();
  return (
    c.name.toLowerCase().includes(lower) ||
    c.entity.toLowerCase().includes(lower) ||
    c.phone.replace(/\s/g, "").includes(lower.replace(/\s/g, "")) ||
    c.email.toLowerCase().includes(lower) ||
    c.city.toLowerCase().includes(lower)
  );
}

export default function SearchVariantA() {
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [expandOverdue, setExpandOverdue] = useState(true);
  const [expandUpcoming, setExpandUpcoming] = useState(true);
  const [expandPending, setExpandPending] = useState(true);
  const [expandOthers, setExpandOthers] = useState(true);

  const callableStatuses = ["callback_scheduled", "pending"];
  const basePool = showAll ? CONTACTS : CONTACTS.filter(c => callableStatuses.includes(c.status));
  const filtered = basePool.filter(c => matchContact(c, q));

  const overdue = filtered.filter(c => c.status === "callback_scheduled" && c.overdue);
  const upcoming = filtered.filter(c => c.status === "callback_scheduled" && !c.overdue);
  const pending = filtered.filter(c => c.status === "pending");
  const others = filtered.filter(c => !["callback_scheduled", "pending"].includes(c.status));

  const matchedFields = (c: typeof CONTACTS[0]) => {
    if (!q.trim()) return null;
    const lower = q.toLowerCase();
    const fields = [];
    if (c.email.toLowerCase().includes(lower)) fields.push("email");
    if (c.city.toLowerCase().includes(lower)) fields.push("mesto");
    return fields.length > 0 ? fields : null;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans" style={{ maxWidth: 420 }}>
      {/* Header */}
      <div className="bg-white border-b px-4 pt-4 pb-3 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-primary/10 text-red-600 border border-red-100">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
            Medical Partner Cooperation
          </div>
          <span className="text-xs text-gray-400">{filtered.length} kontaktov</span>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Hľadať meno, telefón, email, mesto…"
            className="w-full h-10 pl-9 pr-9 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400"
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Toggle: All contacts */}
        <div className="flex items-center justify-between mt-2.5 px-1">
          <div className="flex items-center gap-1.5">
            <UserSearch className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">Vyhľadávať vo všetkých kontaktoch kampane</span>
          </div>
          <button
            onClick={() => setShowAll(!showAll)}
            className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${showAll ? "bg-red-500" : "bg-gray-200"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showAll ? "translate-x-5" : ""}`} />
          </button>
        </div>
        {showAll && (
          <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 mt-1.5 flex items-center gap-1">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            Zobrazujú sa aj kontakty s iným statusom (vybavené, nedvíhal…)
          </p>
        )}
      </div>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <Search className="h-8 w-8 opacity-30" />
            <p className="text-sm font-medium">{q ? "Žiadne výsledky" : "Žiadne kontakty"}</p>
            <p className="text-xs opacity-70">{q ? "Skúste iný výraz" : "Vyberte kampaň"}</p>
          </div>
        ) : (
          <>
            {/* Overdue */}
            {overdue.length > 0 && (
              <Section title="Premeškané callbacky" count={overdue.length} color="#ef4444" icon={<AlertCircle className="h-3 w-3" />} expanded={expandOverdue} onToggle={() => setExpandOverdue(v => !v)}>
                {overdue.map(c => <ContactRow key={c.id} c={c} q={q} matchedFields={matchedFields(c)} badge={{ label: c.callbackDate!, color: "#ef4444" }} attempts={c.attempts} />)}
              </Section>
            )}
            {/* Upcoming */}
            {upcoming.length > 0 && (
              <Section title="Naplánované callbacky" count={upcoming.length} color="#3b82f6" icon={<Calendar className="h-3 w-3" />} expanded={expandUpcoming} onToggle={() => setExpandUpcoming(v => !v)}>
                {upcoming.map(c => <ContactRow key={c.id} c={c} q={q} matchedFields={matchedFields(c)} badge={{ label: c.callbackDate!, color: "#3b82f6" }} attempts={c.attempts} />)}
              </Section>
            )}
            {/* Pending */}
            {pending.length > 0 && (
              <Section title="Nové kontakty" count={pending.length} color="#6b7280" icon={<Clock className="h-3 w-3" />} expanded={expandPending} onToggle={() => setExpandPending(v => !v)}>
                {pending.map(c => <ContactRow key={c.id} c={c} q={q} matchedFields={matchedFields(c)} />)}
              </Section>
            )}
            {/* Others (only visible when showAll) */}
            {others.length > 0 && (
              <Section title="Ostatné kontakty" count={others.length} color="#9333ea" icon={<UserSearch className="h-3 w-3" />} expanded={expandOthers} onToggle={() => setExpandOthers(v => !v)}>
                {others.map(c => <ContactRow key={c.id} c={c} q={q} matchedFields={matchedFields(c)} statusBadge={STATUS_CONFIG[c.status]} attempts={c.attempts} />)}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, count, color, icon, expanded, onToggle, children }: any) {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-100 bg-white shadow-sm">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          <span style={{ color }} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
            {icon}{title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: color }}>{count}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
        </div>
      </button>
      {expanded && <div className="divide-y divide-gray-50">{children}</div>}
    </div>
  );
}

function ContactRow({ c, q, badge, statusBadge, matchedFields, attempts }: any) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors">
      <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
        <Phone className="h-3.5 w-3.5 text-red-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-semibold text-gray-900 truncate">{highlightMatch(c.entity, q)} — {highlightMatch(c.name, q)}</p>
        </div>
        <p className="text-xs text-gray-400 truncate">{highlightMatch(c.phone, q)}</p>
        {matchedFields && (
          <p className="text-[10px] text-blue-500 mt-0.5 flex gap-1">
            {matchedFields.map((f: string) => <span key={f} className="bg-blue-50 px-1.5 py-0.5 rounded">↑ {f}</span>)}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {badge && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ color: badge.color, backgroundColor: badge.color + "15" }}>
            {badge.label}
          </span>
        )}
        {statusBadge && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ color: statusBadge.color, backgroundColor: statusBadge.bg }}>
            {statusBadge.label}
          </span>
        )}
        {attempts > 0 && (
          <span className="text-[10px] text-gray-400">{attempts}×</span>
        )}
      </div>
    </div>
  );
}
