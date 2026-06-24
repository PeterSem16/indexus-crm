import { useState } from "react";
import { Search, X, Phone, Clock, AlertCircle, Calendar, Filter, ChevronDown, UserSearch, SlidersHorizontal } from "lucide-react";

const CONTACTS = [
  { id: 1, name: "MUDr. Peter Seman", entity: "Klinika Viva", phone: "+421948519438", email: "seman@klinikaviva.sk", city: "Bratislava", contract: "SK-2024-001", status: "callback_scheduled", callbackDate: "22.06.2026 09:00", overdue: true, attempts: 10 },
  { id: 2, name: "MUDr. Martin Kabát", entity: "Zdravotné centrum Iris", phone: "+421 915 796 900", email: "kabat@iris.sk", city: "Košice", contract: "SK-2024-002", status: "callback_scheduled", callbackDate: "25.06.2026 10:00", overdue: false, attempts: 9 },
  { id: 3, name: "MUDr. Eva Novotná", entity: "Med Centrum Bella", phone: "+421948519438", email: "novotna@bella.sk", city: "Nitra", contract: "SK-2024-003", status: "pending", attempts: 0 },
  { id: 4, name: "MUDr. Jana Kováčová", entity: "Klinika Medifem", phone: "+421905773403", email: "kovacova@medifem.sk", city: "Žilina", contract: "SK-2024-004", status: "pending", attempts: 0 },
  { id: 5, name: "MUDr. Tomáš Horváth", entity: "Gynekologická ambulancia Horváth", phone: "+421911234567", email: "horvath@gyn.sk", city: "Prešov", contract: "SK-2024-005", status: "no_answer", attempts: 4 },
  { id: 6, name: "MUDr. Lucia Blaho", entity: "Centrum zdravia Blaho", phone: "+421902345678", email: "blaho@centrumzdravie.sk", city: "Banská Bystrica", contract: "SK-2024-006", status: "interested", attempts: 2 },
  { id: 7, name: "MUDr. Roman Mináč", entity: "Klinika Mináč", phone: "+421903456789", email: "minac@klinika.sk", city: "Trnava", contract: "SK-2024-007", status: "not_interested", attempts: 3 },
];

const SEARCH_FIELDS = [
  { value: "all", label: "Všetky polia" },
  { value: "name", label: "Meno" },
  { value: "entity", label: "Názov zariadenia" },
  { value: "phone", label: "Telefón" },
  { value: "email", label: "Email" },
  { value: "city", label: "Mesto" },
  { value: "contract", label: "Č. zmluvy" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  callback_scheduled: { label: "Callback", color: "#2563eb", bg: "#eff6ff", dot: "#3b82f6" },
  pending: { label: "Nový", color: "#4b5563", bg: "#f3f4f6", dot: "#9ca3af" },
  no_answer: { label: "Nedvíhal", color: "#b45309", bg: "#fffbeb", dot: "#f59e0b" },
  interested: { label: "Záujem", color: "#065f46", bg: "#f0fdf4", dot: "#10b981" },
  not_interested: { label: "Nezáujem", color: "#991b1b", bg: "#fef2f2", dot: "#ef4444" },
};

const FILTER_TABS = [
  { value: "callable", label: "Na volanie" },
  { value: "callbacks", label: "Callbacky" },
  { value: "pending", label: "Nové" },
  { value: "all", label: "Všetky" },
];

function matchContact(c: typeof CONTACTS[0], q: string, field: string): boolean {
  if (!q.trim()) return true;
  const lower = q.toLowerCase().replace(/\s/g, "");
  const checks: Record<string, boolean> = {
    name: c.name.toLowerCase().includes(q.toLowerCase()),
    entity: c.entity.toLowerCase().includes(q.toLowerCase()),
    phone: c.phone.replace(/\s/g, "").includes(lower),
    email: c.email.toLowerCase().includes(q.toLowerCase()),
    city: c.city.toLowerCase().includes(q.toLowerCase()),
    contract: c.contract.toLowerCase().includes(q.toLowerCase()),
  };
  if (field === "all") return Object.values(checks).some(Boolean);
  return checks[field] ?? false;
}

function getMatchedField(c: typeof CONTACTS[0], q: string): string | null {
  if (!q.trim()) return null;
  const lower = q.toLowerCase().replace(/\s/g, "");
  if (c.email.toLowerCase().includes(q.toLowerCase())) return "email";
  if (c.city.toLowerCase().includes(q.toLowerCase())) return "mesto: " + c.city;
  if (c.contract.toLowerCase().includes(q.toLowerCase())) return "zmluva: " + c.contract;
  return null;
}

function highlight(text: string, q: string) {
  if (!q.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return <>{text.slice(0, idx)}<mark className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5 not-italic">{text.slice(idx, idx + q.length)}</mark>{text.slice(idx + q.length)}</>;
}

export default function SearchVariantB() {
  const [q, setQ] = useState("");
  const [filterTab, setFilterTab] = useState("callable");
  const [searchField, setSearchField] = useState("all");
  const [showFieldPicker, setShowFieldPicker] = useState(false);

  const byTab = CONTACTS.filter(c => {
    if (filterTab === "callable") return ["callback_scheduled", "pending"].includes(c.status);
    if (filterTab === "callbacks") return c.status === "callback_scheduled";
    if (filterTab === "pending") return c.status === "pending";
    return true;
  });

  const filtered = byTab.filter(c => matchContact(c, q, searchField));

  const overdue = filtered.filter(c => c.status === "callback_scheduled" && c.overdue);
  const rest = filtered.filter(c => !(c.status === "callback_scheduled" && c.overdue));

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans" style={{ maxWidth: 420 }}>
      {/* Header */}
      <div className="bg-white border-b px-4 pt-4 pb-3 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-100">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            Medical Partner Cooperation
          </div>
          <span className="text-xs text-gray-400">{filtered.length} z {CONTACTS.length}</span>
        </div>

        {/* Search bar + field picker */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={searchField === "all" ? "Hľadať vo všetkých poliach…" : `Hľadať podľa: ${SEARCH_FIELDS.find(f => f.value === searchField)?.label}`}
              className="w-full h-10 pl-9 pr-8 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Field selector button */}
          <div className="relative">
            <button
              onClick={() => setShowFieldPicker(v => !v)}
              className={`h-10 px-3 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${searchField !== "all" ? "bg-red-500 text-white border-red-500" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {searchField !== "all" ? SEARCH_FIELDS.find(f => f.value === searchField)?.label?.slice(0, 6) : "Pole"}
            </button>
            {showFieldPicker && (
              <div className="absolute right-0 top-11 z-50 bg-white border border-gray-200 rounded-xl shadow-xl py-1 w-44">
                {SEARCH_FIELDS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => { setSearchField(f.value); setShowFieldPicker(false); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center justify-between ${searchField === f.value ? "text-red-600 font-semibold" : "text-gray-700"}`}
                  >
                    {f.label}
                    {searchField === f.value && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5">
          {FILTER_TABS.map(tab => {
            const count = CONTACTS.filter(c => {
              if (tab.value === "callable") return ["callback_scheduled", "pending"].includes(c.status);
              if (tab.value === "callbacks") return c.status === "callback_scheduled";
              if (tab.value === "pending") return c.status === "pending";
              return true;
            }).length;
            return (
              <button
                key={tab.value}
                onClick={() => setFilterTab(tab.value)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${filterTab === tab.value ? "bg-red-500 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
              >
                {tab.label}
                <span className={`ml-1 text-[10px] ${filterTab === tab.value ? "opacity-80" : "opacity-60"}`}>({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto py-2 px-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <Search className="h-8 w-8 opacity-30" />
            <p className="text-sm font-medium">{q ? "Žiadne výsledky" : "Žiadne kontakty"}</p>
            <p className="text-xs opacity-60 text-center px-4">{q ? `Nič nevyhovuje „${q}"` : "Vyberte kampaň"}</p>
          </div>
        ) : (
          <>
            {/* Overdue banner */}
            {overdue.length > 0 && (
              <div className="rounded-xl bg-red-50 border border-red-100 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-red-100">
                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-[11px] font-bold text-red-600 uppercase tracking-wide">Premeškané callbacky</span>
                  <span className="ml-auto text-[11px] font-bold text-white bg-red-500 w-5 h-5 rounded-full flex items-center justify-center">{overdue.length}</span>
                </div>
                {overdue.map(c => <Row key={c.id} c={c} q={q} searchField={searchField} />)}
              </div>
            )}

            {/* Normal rows */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm divide-y divide-gray-50">
              {rest.map(c => <Row key={c.id} c={c} q={q} searchField={searchField} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ c, q, searchField }: any) {
  const sc = STATUS_CONFIG[c.status];
  const extraMatch = getMatchedField(c, q);
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors">
      <div className="relative flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
          <Phone className="h-3.5 w-3.5 text-red-400" />
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white" style={{ backgroundColor: sc?.dot }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate leading-snug">
          {highlight(c.entity, q)} — {highlight(c.name, q)}
        </p>
        <p className="text-xs text-gray-400 truncate">{highlight(c.phone, q)}</p>
        {extraMatch && (
          <p className="text-[10px] text-blue-500 mt-0.5 flex gap-1 items-center">
            <span className="bg-blue-50 px-1.5 py-0.5 rounded font-medium">✦ {extraMatch}</span>
          </p>
        )}
      </div>
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        {c.callbackDate && (
          <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
            <Calendar className="h-2.5 w-2.5" />{c.callbackDate}
          </span>
        )}
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ color: sc?.color, backgroundColor: sc?.bg }}>
          {sc?.label}
        </span>
        {c.attempts > 0 && <span className="text-[10px] text-gray-400">{c.attempts}×</span>}
      </div>
    </div>
  );
}
