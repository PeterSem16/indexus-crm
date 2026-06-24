import { useState } from "react";
import { Search, X, AlertCircle, Calendar, PhoneCall, ChevronRight, SlidersHorizontal } from "lucide-react";

const CONTACTS = [
  { id: 1, name: "Klinika Viva — MUDr. Peter Seman",    initials: "KV", phone: "+421948519438",    email: "seman@klinikaviva.sk",       city: "Bratislava",     contract: "SK-2024-001", status: "callback_scheduled", callbackDate: "2026-06-22T09:00:00", overdue: true,  attempts: 10 },
  { id: 2, name: "Zdravotné centrum Iris — MUDr. Martin Kabát", initials: "ZI", phone: "+421 915 796 900", email: "kabat@iris.sk",   city: "Košice",         contract: "SK-2024-002", status: "callback_scheduled", callbackDate: "2026-06-25T10:00:00", overdue: false, attempts: 9  },
  { id: 3, name: "Med Centrum Bella — MUDr. Peter Seman", initials: "MB", phone: "+421948519438",   email: "novotna@bella.sk",           city: "Nitra",          contract: "SK-2024-003", status: "pending",            callbackDate: null,                overdue: false, attempts: 0  },
  { id: 4, name: "Klinika Medifem — MUDr. Martin Kabát", initials: "KM", phone: "+421905773403",   email: "kovacova@medifem.sk",         city: "Žilina",         contract: "SK-2024-004", status: "pending",            callbackDate: null,                overdue: false, attempts: 0  },
  { id: 5, name: "Gynekol. amb. Horváth — MUDr. Tomáš Horváth", initials: "GH", phone: "+421911234567", email: "horvath@gyn.sk",     city: "Prešov",         contract: "SK-2024-005", status: "no_answer",           callbackDate: null,                overdue: false, attempts: 4  },
  { id: 6, name: "Centrum zdravia Blaho — MUDr. Lucia Blaho", initials: "CB", phone: "+421902345678", email: "blaho@centrumzdravie.sk", city: "Banská Bystrica", contract: "SK-2024-006", status: "interested",          callbackDate: null,                overdue: false, attempts: 2  },
  { id: 7, name: "Klinika Mináč — MUDr. Roman Mináč",   initials: "KN", phone: "+421903456789",   email: "minac@klinika.sk",           city: "Trnava",         contract: "SK-2024-007", status: "not_interested",      callbackDate: null,                overdue: false, attempts: 3  },
];

const STATUS_LABEL: Record<string, string> = {
  callback_scheduled: "Callback",
  pending:            "Nový",
  no_answer:          "Nedvíhal",
  interested:         "Záujem",
  not_interested:     "Nezáujem",
};

const STATUS_COLORS: Record<string, string> = {
  no_answer:      "text-amber-600 bg-amber-50 border-amber-200",
  interested:     "text-emerald-700 bg-emerald-50 border-emerald-200",
  not_interested: "text-red-600 bg-red-50 border-red-200",
};

const SEARCH_FIELDS = [
  { value: "all",      label: "Všetky polia" },
  { value: "name",     label: "Meno / zariadenie" },
  { value: "phone",    label: "Telefón" },
  { value: "email",    label: "Email" },
  { value: "city",     label: "Mesto" },
  { value: "contract", label: "Č. zmluvy" },
];

const FILTER_TABS = [
  { value: "callable",  label: "Na volanie" },
  { value: "callbacks", label: "Callbacky" },
  { value: "pending",   label: "Nové" },
  { value: "all",       label: "Všetky" },
];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function matchContact(c: typeof CONTACTS[0], q: string, field: string): boolean {
  if (!q.trim()) return true;
  const ql = q.toLowerCase().replace(/\s/g, "");
  const checks: Record<string, boolean> = {
    name:     c.name.toLowerCase().includes(q.toLowerCase()),
    phone:    c.phone.replace(/\s/g, "").includes(ql),
    email:    c.email.toLowerCase().includes(q.toLowerCase()),
    city:     c.city.toLowerCase().includes(q.toLowerCase()),
    contract: c.contract.toLowerCase().includes(q.toLowerCase()),
  };
  if (field === "all") return Object.values(checks).some(Boolean);
  return checks[field] ?? false;
}

function getExtraHint(c: typeof CONTACTS[0], q: string): string | null {
  if (!q.trim()) return null;
  const ql = q.toLowerCase();
  if (!c.name.toLowerCase().includes(ql) && !c.phone.replace(/\s/g, "").includes(ql.replace(/\s/g, ""))) {
    if (c.email.toLowerCase().includes(ql))    return `email: ${c.email}`;
    if (c.city.toLowerCase().includes(ql))     return `mesto: ${c.city}`;
    if (c.contract.toLowerCase().includes(ql)) return `zmluva: ${c.contract}`;
  }
  return null;
}

function hl(text: string, q: string) {
  if (!q.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return <>{text.slice(0, idx)}<mark className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">{text.slice(idx, idx + q.length)}</mark>{text.slice(idx + q.length)}</>;
}

export default function SearchVariantB() {
  const [q, setQ] = useState("");
  const [filterTab, setFilterTab] = useState("callable");
  const [searchField, setSearchField] = useState("all");
  const [showFieldPicker, setShowFieldPicker] = useState(false);

  const tabCount = (tab: string) => CONTACTS.filter(c => {
    if (tab === "callable")  return ["callback_scheduled", "pending"].includes(c.status);
    if (tab === "callbacks") return c.status === "callback_scheduled";
    if (tab === "pending")   return c.status === "pending";
    return true;
  }).length;

  const byTab = CONTACTS.filter(c => {
    if (filterTab === "callable")  return ["callback_scheduled", "pending"].includes(c.status);
    if (filterTab === "callbacks") return c.status === "callback_scheduled";
    if (filterTab === "pending")   return c.status === "pending";
    return true;
  });

  const filtered = byTab.filter(c => matchContact(c, q, searchField));

  const overdue   = filtered.filter(c => c.status === "callback_scheduled" && c.overdue);
  const upcoming  = filtered.filter(c => c.status === "callback_scheduled" && !c.overdue);
  const pending   = filtered.filter(c => c.status === "pending");
  const others    = filtered.filter(c => !["callback_scheduled", "pending"].includes(c.status));

  return (
    <div className="flex flex-col h-screen bg-[#f5f4f2] font-sans" style={{ maxWidth: 420 }}>

      {/* ── Header ── */}
      <div className="bg-white border-b px-4 pt-4 pb-3 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-100">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            Medical Partner Cooperation
          </div>
          <span className="text-xs text-gray-400">{filtered.length} kontaktov</span>
        </div>

        {/* Search + field picker */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={
                searchField === "all"
                  ? "Hľadať meno, tel., email, mesto…"
                  : `Hľadať: ${SEARCH_FIELDS.find(f => f.value === searchField)?.label}`
              }
              className="w-full h-10 pl-9 pr-8 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Field picker */}
          <div className="relative">
            <button
              onClick={() => setShowFieldPicker(v => !v)}
              className={`h-10 px-3 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                searchField !== "all"
                  ? "bg-red-500 text-white border-red-500"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {searchField === "all" ? "Pole" : SEARCH_FIELDS.find(f => f.value === searchField)?.label?.split(" ")[0]}
            </button>
            {showFieldPicker && (
              <div className="absolute right-0 top-11 z-50 bg-white border border-gray-200 rounded-xl shadow-xl py-1 w-48">
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
          {FILTER_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilterTab(tab.value)}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                filterTab === tab.value
                  ? "bg-red-500 text-white shadow-sm"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {tab.label}
              <span className={`ml-1 text-[10px] ${filterTab === tab.value ? "opacity-80" : "opacity-50"}`}>
                ({tabCount(tab.value)})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Contact list ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <Search className="h-8 w-8 opacity-30" />
            <p className="text-sm font-bold">{q ? "Žiadne výsledky" : "Žiadne kontakty"}</p>
            <p className="text-xs opacity-70">{q ? "Skúste iný výraz." : "Vyberte kampaň."}</p>
          </div>
        ) : (
          <>
            {/* Overdue */}
            {overdue.length > 0 && (
              <GroupSection label="Premeškané callbacky" icon={<AlertCircle className="h-3 w-3" />} color="text-red-500" divColor="bg-red-200">
                {overdue.map(c => <ContactRow key={c.id} c={c} q={q} isOverdue />)}
              </GroupSection>
            )}

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <GroupSection label="Naplánované callbacky" icon={<Calendar className="h-3 w-3" />} color="text-blue-500" divColor="bg-blue-200">
                {upcoming.map(c => <ContactRow key={c.id} c={c} q={q} isUpcoming />)}
              </GroupSection>
            )}

            {/* Pending */}
            {pending.length > 0 && (
              (overdue.length > 0 || upcoming.length > 0)
                ? <GroupSection label="Nové kontakty" color="text-muted-foreground" divColor="bg-border">
                    {pending.map(c => <ContactRow key={c.id} c={c} q={q} />)}
                  </GroupSection>
                : <>{pending.map(c => <ContactRow key={c.id} c={c} q={q} />)}</>
            )}

            {/* Others (only in "all" tab) */}
            {others.length > 0 && (
              <GroupSection label="Ostatné kontakty" color="text-violet-500" divColor="bg-violet-200">
                {others.map(c => <ContactRow key={c.id} c={c} q={q} isOther />)}
              </GroupSection>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function GroupSection({ label, icon, color, divColor, children }: any) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className={`h-px flex-1 ${divColor} opacity-60`} />
        <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${color}`}>
          {icon}{label}
        </span>
        <div className={`h-px flex-1 ${divColor} opacity-60`} />
      </div>
      {children}
    </div>
  );
}

function ContactRow({ c, q, isOverdue, isUpcoming, isOther }: any) {
  const isCallback = isOverdue || isUpcoming;
  const hint = getExtraHint(c, q);

  const avatarBg = isOther
    ? "bg-violet-400"
    : isOverdue
    ? "bg-red-400"
    : isUpcoming
    ? "bg-blue-500"
    : "bg-gradient-to-br from-red-400 to-red-600";

  const cardBg = isOverdue
    ? "border-red-200 bg-red-50/50"
    : isUpcoming
    ? "border-blue-200 bg-blue-50/50"
    : isOther
    ? "border-violet-100 bg-violet-50/30"
    : "bg-card border-border";

  return (
    <div className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer hover:shadow-sm active:scale-[0.98] ${cardBg}`}>
      {/* Avatar */}
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 ${avatarBg}`}>
        {c.initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">{hl(c.name, q)}</p>
        {c.phone && <p className="text-xs text-muted-foreground truncate">{hl(c.phone, q)}</p>}
        {c.callbackDate && (
          <div className="flex items-center gap-1 mt-0.5">
            <Calendar className={`h-3 w-3 ${isOverdue ? "text-red-500" : "text-blue-500"}`} />
            <p className={`text-xs font-semibold ${isOverdue ? "text-red-500" : "text-blue-500"}`}>
              {isOverdue ? "Oneskorený · " : ""}{fmtDate(c.callbackDate)}
            </p>
          </div>
        )}
        {hint && (
          <p className="text-[10px] text-blue-500 mt-0.5">
            <span className="bg-blue-50 px-1.5 py-0.5 rounded font-medium">✦ {hint}</span>
          </p>
        )}
        {isOther && (
          <span className={`inline-flex mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded border ${STATUS_COLORS[c.status] ?? "text-gray-600 bg-gray-50 border-gray-200"}`}>
            {STATUS_LABEL[c.status]}
          </span>
        )}
      </div>

      {/* Right */}
      <div className="shrink-0 flex flex-col items-end gap-1">
        {c.attempts > 0 && (
          <span className="text-[11px] font-bold text-white bg-orange-400 rounded-full px-2 py-0.5 min-w-[26px] text-center">
            {c.attempts}×
          </span>
        )}
        {isCallback
          ? <PhoneCall className={`h-4 w-4 ${isOverdue ? "text-red-400" : "text-blue-400"}`} />
          : <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
        }
      </div>
    </div>
  );
}
