import { useState } from "react";
import { Search, X, AlertCircle, Calendar, PhoneCall, ChevronRight, SlidersHorizontal, Phone } from "lucide-react";

/* ── Palette ── */
const C = {
  bg:         "#EEEBE4",
  card:       "#F8F4EE",
  white:      "#FFFFFF",
  textDark:   "#3D2E20",
  textMid:    "#6B5847",
  textMuted:  "#9A8878",
  border:     "#D8CFC4",
  chip:       "#EDE8E0",
  chipText:   "#7A6858",
  terra:      "#B5622E",   /* overdue / primary accent */
  sage:       "#5E7A5A",   /* upcoming */
  sand:       "#A0946A",   /* pending neutral */
  violet:     "#7A5E8A",   /* others */
};

const CONTACTS = [
  { id: 1, name: "Klinika Viva — MUDr. Peter Seman",              initials: "KV", phone: "+421948519438",    email: "seman@klinikaviva.sk",       city: "Bratislava",     contract: "SK-2024-001", status: "callback_scheduled", callbackDate: "2026-06-22T09:00:00", overdue: true,  attempts: 10 },
  { id: 2, name: "Zdravotné centrum Iris — MUDr. Martin Kabát",   initials: "ZI", phone: "+421 915 796 900", email: "kabat@iris.sk",               city: "Košice",         contract: "SK-2024-002", status: "callback_scheduled", callbackDate: "2026-06-25T10:00:00", overdue: false, attempts: 9  },
  { id: 3, name: "Med Centrum Bella — MUDr. Peter Seman",         initials: "MB", phone: "+421948519438",    email: "novotna@bella.sk",            city: "Nitra",          contract: "SK-2024-003", status: "pending",            callbackDate: null,                overdue: false, attempts: 0  },
  { id: 4, name: "Klinika Medifem — MUDr. Martin Kabát",         initials: "KM", phone: "+421905773403",    email: "kovacova@medifem.sk",          city: "Žilina",         contract: "SK-2024-004", status: "pending",            callbackDate: null,                overdue: false, attempts: 0  },
  { id: 5, name: "Gynekol. amb. Horváth — MUDr. Tomáš Horváth",  initials: "GH", phone: "+421911234567",    email: "horvath@gyn.sk",               city: "Prešov",         contract: "SK-2024-005", status: "no_answer",           callbackDate: null,                overdue: false, attempts: 4  },
  { id: 6, name: "Centrum zdravia Blaho — MUDr. Lucia Blaho",    initials: "CB", phone: "+421902345678",    email: "blaho@centrumzdravie.sk",      city: "Banská Bystrica",contract: "SK-2024-006", status: "interested",          callbackDate: null,                overdue: false, attempts: 2  },
  { id: 7, name: "Klinika Mináč — MUDr. Roman Mináč",           initials: "KN", phone: "+421903456789",    email: "minac@klinika.sk",             city: "Trnava",         contract: "SK-2024-007", status: "not_interested",      callbackDate: null,                overdue: false, attempts: 3  },
];

const STATUS_LABEL: Record<string, string> = {
  callback_scheduled: "Callback",
  pending:            "Nový",
  no_answer:          "Nedvíhal",
  interested:         "Záujem",
  not_interested:     "Nezáujem",
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
  return `${d.getDate()}. ${d.getMonth() + 1}. ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function matchContact(c: typeof CONTACTS[0], q: string, field: string): boolean {
  if (!q.trim()) return true;
  const ql = q.toLowerCase().replace(/\s/g,"");
  const checks: Record<string, boolean> = {
    name:     c.name.toLowerCase().includes(q.toLowerCase()),
    phone:    c.phone.replace(/\s/g,"").includes(ql),
    email:    c.email.toLowerCase().includes(q.toLowerCase()),
    city:     c.city.toLowerCase().includes(q.toLowerCase()),
    contract: c.contract.toLowerCase().includes(q.toLowerCase()),
  };
  return field === "all" ? Object.values(checks).some(Boolean) : (checks[field] ?? false);
}

function getHint(c: typeof CONTACTS[0], q: string): string | null {
  if (!q.trim()) return null;
  const ql = q.toLowerCase();
  const nameMatch = c.name.toLowerCase().includes(ql);
  const phoneMatch = c.phone.replace(/\s/g,"").includes(ql.replace(/\s/g,""));
  if (nameMatch || phoneMatch) return null;
  if (c.email.toLowerCase().includes(ql))    return `email: ${c.email}`;
  if (c.city.toLowerCase().includes(ql))     return `mesto: ${c.city}`;
  if (c.contract.toLowerCase().includes(ql)) return `zmluva: ${c.contract}`;
  return null;
}

function hl(text: string, q: string) {
  if (!q.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return <>{text.slice(0,idx)}<mark style={{ background: "#F5DEB3", color: C.textDark, borderRadius: 2, padding: "0 2px" }}>{text.slice(idx, idx+q.length)}</mark>{text.slice(idx+q.length)}</>;
}

export default function SearchVariantB() {
  const [q, setQ] = useState("");
  const [filterTab, setFilterTab] = useState("callable");
  const [searchField, setSearchField] = useState("all");
  const [showFieldPicker, setShowFieldPicker] = useState(false);

  const tabCount = (tab: string) => CONTACTS.filter(c => {
    if (tab === "callable")  return ["callback_scheduled","pending"].includes(c.status);
    if (tab === "callbacks") return c.status === "callback_scheduled";
    if (tab === "pending")   return c.status === "pending";
    return true;
  }).length;

  const byTab = CONTACTS.filter(c => {
    if (filterTab === "callable")  return ["callback_scheduled","pending"].includes(c.status);
    if (filterTab === "callbacks") return c.status === "callback_scheduled";
    if (filterTab === "pending")   return c.status === "pending";
    return true;
  });

  const filtered = byTab.filter(c => matchContact(c, q, searchField));
  const overdue  = filtered.filter(c => c.status === "callback_scheduled" && c.overdue);
  const upcoming = filtered.filter(c => c.status === "callback_scheduled" && !c.overdue);
  const pending  = filtered.filter(c => c.status === "pending");
  const others   = filtered.filter(c => !["callback_scheduled","pending"].includes(c.status));

  return (
    <div className="flex flex-col h-screen font-sans" style={{ background: C.bg, maxWidth: 420 }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}` }} className="px-4 pt-4 pb-3 space-y-3 shadow-sm">

        {/* Campaign badge + count */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
            style={{ background: `${C.terra}15`, color: C.terra, border: `1px solid ${C.terra}30` }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: C.terra }} />
            Medical Partner Cooperation
          </div>
          <span className="text-xs" style={{ color: C.textMuted }}>{filtered.length} kontaktov</span>
        </div>

        {/* Search bar + field picker */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: C.textMuted }} />
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={searchField === "all" ? "Hľadať meno, tel., email, mesto…" : `Hľadať: ${SEARCH_FIELDS.find(f=>f.value===searchField)?.label}`}
              className="w-full h-10 pl-9 pr-8 rounded-xl text-sm focus:outline-none"
              style={{
                background: C.white,
                border: `1.5px solid ${C.border}`,
                color: C.textDark,
              }}
              onFocus={e => (e.target.style.borderColor = C.terra)}
              onBlur={e  => (e.target.style.borderColor = C.border)}
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: C.textMuted }}>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Field picker */}
          <div className="relative">
            <button
              onClick={() => setShowFieldPicker(v => !v)}
              className="h-10 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              style={searchField !== "all"
                ? { background: C.terra, color: "#fff", border: `1.5px solid ${C.terra}` }
                : { background: C.white, color: C.textMid, border: `1.5px solid ${C.border}` }
              }
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {searchField === "all" ? "Pole" : SEARCH_FIELDS.find(f=>f.value===searchField)?.label?.split(" ")[0]}
            </button>
            {showFieldPicker && (
              <div className="absolute right-0 top-11 z-50 rounded-xl shadow-xl py-1 w-48"
                style={{ background: C.white, border: `1.5px solid ${C.border}` }}>
                {SEARCH_FIELDS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => { setSearchField(f.value); setShowFieldPicker(false); }}
                    className="w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:opacity-80"
                    style={searchField === f.value
                      ? { color: C.terra, fontWeight: 700 }
                      : { color: C.textMid }
                    }
                  >
                    {f.label}
                    {searchField === f.value && <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.terra }} />}
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
              className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
              style={filterTab === tab.value
                ? { background: C.terra, color: "#fff" }
                : { background: C.chip, color: C.chipText }
              }
            >
              {tab.label}
              <span className="ml-1 text-[10px] opacity-70">({tabCount(tab.value)})</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Contact list ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2" style={{ color: C.textMuted }}>
            <Search className="h-8 w-8 opacity-30" />
            <p className="text-sm font-bold">{q ? "Žiadne výsledky" : "Žiadne kontakty"}</p>
            <p className="text-xs opacity-70">{q ? "Skúste iný výraz." : "Vyberte kampaň."}</p>
          </div>
        ) : (
          <>
            {overdue.length > 0 && (
              <Group label="Premeškané callbacky" icon={<AlertCircle className="h-3 w-3"/>} accent={C.terra}>
                {overdue.map(c => <Row key={c.id} c={c} q={q} accent={C.terra} isOverdue />)}
              </Group>
            )}
            {upcoming.length > 0 && (
              <Group label="Naplánované callbacky" icon={<Calendar className="h-3 w-3"/>} accent={C.sage}>
                {upcoming.map(c => <Row key={c.id} c={c} q={q} accent={C.sage} isUpcoming />)}
              </Group>
            )}
            {pending.length > 0 && (
              (overdue.length > 0 || upcoming.length > 0)
                ? <Group label="Nové kontakty" accent={C.sand}>
                    {pending.map(c => <Row key={c.id} c={c} q={q} accent={C.sand} />)}
                  </Group>
                : <>{pending.map(c => <Row key={c.id} c={c} q={q} accent={C.sand} />)}</>
            )}
            {others.length > 0 && (
              <Group label="Ostatné kontakty" accent={C.violet}>
                {others.map(c => <Row key={c.id} c={c} q={q} accent={C.violet} isOther />)}
              </Group>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Group({ label, icon, accent, children }: any) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 rounded" style={{ background: `${accent}40` }} />
        <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: accent }}>
          {icon}{label}
        </span>
        <div className="h-px flex-1 rounded" style={{ background: `${accent}40` }} />
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ c, q, accent, isOverdue, isUpcoming, isOther }: any) {
  const isCallback = isOverdue || isUpcoming;
  const hint = getHint(c, q);

  return (
    <div
      className="w-full flex items-center gap-3 p-3 rounded-2xl text-left cursor-pointer transition-all"
      style={{
        background: C.white,
        border: `1.5px solid ${accent}30`,
        boxShadow: `0 1px 6px ${accent}12`,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = `${accent}60`;
        (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 14px ${accent}22`;
        (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = `${accent}30`;
        (e.currentTarget as HTMLElement).style.boxShadow = `0 1px 6px ${accent}12`;
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
    >
      {/* Avatar */}
      <div
        className="h-11 w-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
        style={{ background: accent, boxShadow: `0 2px 8px ${accent}40` }}
      >
        {c.initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate" style={{ color: C.textDark }}>{hl(c.name, q)}</p>
        {c.phone && <p className="text-xs truncate" style={{ color: C.textMuted }}>{hl(c.phone, q)}</p>}
        {c.callbackDate && (
          <div className="flex items-center gap-1 mt-0.5">
            <Calendar className="h-3 w-3 shrink-0" style={{ color: accent }} />
            <p className="text-xs font-semibold" style={{ color: accent }}>
              {isOverdue ? "Oneskorený · " : ""}{fmtDate(c.callbackDate)}
            </p>
          </div>
        )}
        {hint && (
          <p className="text-[10px] mt-0.5">
            <span className="px-1.5 py-0.5 rounded font-medium" style={{ background: C.chip, color: C.chipText }}>✦ {hint}</span>
          </p>
        )}
        {isOther && (
          <span className="inline-flex mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{ background: `${accent}15`, color: accent }}>
            {STATUS_LABEL[c.status]}
          </span>
        )}
      </div>

      {/* Right */}
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        {c.attempts > 0 && (
          <span className="text-xs font-bold min-w-[28px] h-7 flex items-center justify-center rounded-full px-2"
            style={{ background: `${accent}18`, color: accent }}>
            {c.attempts}×
          </span>
        )}
        {isCallback
          ? <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: accent, boxShadow: `0 2px 6px ${accent}40` }}>
              <Phone className="h-3.5 w-3.5 text-white" />
            </div>
          : <ChevronRight className="h-4 w-4" style={{ color: C.textMuted }} />
        }
      </div>
    </div>
  );
}
