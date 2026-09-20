import { useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, CalendarClock, ChevronDown,
  ChevronLeft, ChevronRight, Clock3, Mail, MessageSquare, Phone, PhoneCall,
  Search, SlidersHorizontal, Trash2, X, Zap,
} from "lucide-react";

type Channel = "Calls" | "Emails" | "SMS";
type QueueContact = {
  id: number; name: string; organization: string; city: string; phone: string;
  email: string; scheduled: string; time: string; date: string; step: string;
  channel: Channel; campaign: string; overdue?: boolean; assigned?: boolean;
};

const seed: QueueContact[] = [
  { id: 1, name: "Zoltán Pataky", organization: "MED-EZOP s.r.o.", city: "Kráľovský Chlmec, SK", phone: "+421 940 100 604", email: "zoltan.pataky@med-ezop.sk", scheduled: "24.9.2026", date: "2026-09-24", time: "10:25", step: "Offered — offer accepted", channel: "Calls", campaign: "Medical Partner Cooperation", assigned: true },
  { id: 2, name: "Melinda Baloghová", organization: "GYN-BMEL s.r.o.", city: "Kráľovský Chlmec, SK", phone: "+421 905 871 477", email: "melinda.baloghova@gmail.com", scheduled: "25.9.2026", date: "2026-09-25", time: "10:40", step: "Not offered yet", channel: "Calls", campaign: "Medical Partner Cooperation", assigned: true },
];

const timeFilters = ["All", "overdue", "today", "This week", "Next week", "Later"];
const typeFilters: Array<"All" | Channel> = ["All", "Calls", "Emails", "SMS"];
// Shared Pulse language from My shift + Missed communications:
// cool workspace blues, calm green completion states, and a deliberate coral
// interruption signal for missed/urgent communication.
const colors = {
  ink: "#1d3d5a",
  muted: "#7089a0",
  line: "#dce8f1",
  pale: "#f7fbfe",
  mint: "#eaf3fb",
  teal: "#2d6fba",
  tealDark: "#1c568f",
  coral: "#bf5c4f",
  coralSoft: "#fff1ed",
  green: "#3f826e",
  greenSoft: "#eaf6f1",
  orange: "#b77741",
};

export function PulseMaximumDensity() {
  const [contacts, setContacts] = useState(seed);
  const [timeFilter, setTimeFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState<"All" | Channel>("All");
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"Date" | "Name" | "Campaign">("Date");
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [notice, setNotice] = useState("Queue synced just now");

  const counts = useMemo(() => ({
    overdue: 0, today: 0, week: 2, next: 0, later: 0,
    All: contacts.length, Calls: contacts.filter((c) => c.channel === "Calls").length,
    Emails: contacts.filter((c) => c.channel === "Emails").length,
    SMS: contacts.filter((c) => c.channel === "SMS").length,
  }), [contacts]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      const text = `${c.name} ${c.organization} ${c.city} ${c.phone} ${c.email} ${c.campaign}`.toLowerCase();
      return (!q || text.includes(q)) && (typeFilter === "All" || c.channel === typeFilter) &&
        (!assignedOnly || c.assigned) && (timeFilter === "All" || (timeFilter === "This week" && counts.week > 0));
    }).sort((a, b) => {
      const av = sort === "Name" ? a.name : sort === "Campaign" ? a.campaign : a.date;
      const bv = sort === "Name" ? b.name : sort === "Campaign" ? b.campaign : b.date;
      return av.localeCompare(bv) * (direction === "up" ? 1 : -1);
    });
  }, [assignedOnly, contacts, counts.week, direction, query, sort, timeFilter, typeFilter]);

  const countForTime = (filter: string) => filter === "All" ? counts.All : filter === "This week" ? counts.week : filter === "Next week" ? counts.next : filter === "Later" ? counts.later : 0;
  const activateSort = (value: "Date" | "Name" | "Campaign") => {
    if (sort === value) setDirection((d) => d === "up" ? "down" : "up");
    else { setSort(value); setDirection("up"); }
  };
  const action = (label: string, contact: QueueContact) => setNotice(`${label}: ${contact.name}`);

  return (
    <main style={{ minHeight: "100vh", background: "#eaf2f8", color: colors.ink, fontFamily: "Plus Jakarta Sans, Avenir Next, ui-sans-serif, system-ui, sans-serif", padding: 18 }}>
      <section style={{ maxWidth: 1440, margin: "0 auto", background: "#fbfdff", border: `1px solid #caddeb`, borderRadius: 14, boxShadow: "0 20px 52px rgba(28,67,103,.14)", overflow: "hidden" }}>
        <header style={{ minHeight: 58, display: "flex", alignItems: "center", gap: 12, padding: "0 18px", borderBottom: `1px solid ${colors.line}`, background: "#f8fbfe" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", color: colors.teal, background: colors.mint }}><CalendarClock size={16} /></div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 230 }}><h1 style={{ fontSize: 17, margin: 0, letterSpacing: "-.02em" }}>Scheduled queue</h1><b style={{ fontSize: 12, color: colors.teal }}>2 ready</b></div>
          <div style={{ height: 22, width: 1, background: colors.line }} />
          <span style={{ fontSize: 11, color: colors.muted }}>Callbacks and follow-ups ready for your shift</span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 15 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: colors.muted, cursor: "pointer" }}><input type="checkbox" checked={assignedOnly} onChange={(e) => setAssignedOnly(e.target.checked)} style={{ accentColor: colors.teal }} /> Only assigned</label>
            <button type="button" aria-label="Close queue" onClick={() => setNotice("Queue remains available from Agent Workspace")} style={{ border: 0, background: "transparent", color: colors.muted, cursor: "pointer" }}><X size={16} /></button>
          </div>
        </header>
        <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", minHeight: 440 }}>
           <aside style={{ padding: "17px 10px", borderRight: `1px solid ${colors.line}`, background: "#f7fbfe" }}>
            <div style={{ fontSize: 9, letterSpacing: ".13em", color: colors.muted, fontWeight: 800, padding: "0 9px 8px" }}>TIME</div>
            {timeFilters.map((filter) => <button key={filter} type="button" onClick={() => setTimeFilter(filter)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, height: 29, padding: "0 9px", border: 0, borderRadius: 5, background: timeFilter === filter ? colors.mint : "transparent", color: timeFilter === filter ? colors.teal : colors.ink, fontSize: 11, fontWeight: timeFilter === filter ? 700 : 500, cursor: "pointer", textAlign: "left" }}><span style={{ width: 15, textAlign: "center", color: filter === "overdue" ? colors.coral : colors.muted }}>{filter === "All" ? "▦" : filter === "overdue" ? "!" : filter === "today" ? "◷" : "□"}</span>{filter}<em style={{ marginLeft: "auto", fontStyle: "normal", fontSize: 10, color: colors.muted }}>{countForTime(filter)}</em></button>)}
            <div style={{ fontSize: 9, letterSpacing: ".13em", color: colors.muted, fontWeight: 800, padding: "20px 9px 8px" }}>TYPE</div>
            {typeFilters.map((filter) => <button key={filter} type="button" onClick={() => setTypeFilter(filter)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, height: 29, padding: "0 9px", border: 0, borderRadius: 5, background: typeFilter === filter ? colors.mint : "transparent", color: typeFilter === filter ? colors.teal : colors.ink, fontSize: 11, fontWeight: typeFilter === filter ? 700 : 500, cursor: "pointer", textAlign: "left" }}><span style={{ width: 15, textAlign: "center", color: colors.muted }}>{filter === "Calls" ? <Phone size={12} /> : filter === "Emails" ? <Mail size={12} /> : filter === "SMS" ? <MessageSquare size={12} /> : "◉"}</span>{filter}<em style={{ marginLeft: "auto", fontStyle: "normal", fontSize: 10, color: colors.muted }}>{counts[filter]}</em></button>)}
          </aside>
          <div style={{ minWidth: 0 }}>
            <div style={{ height: 54, display: "flex", alignItems: "center", gap: 12, padding: "0 16px", borderBottom: `1px solid ${colors.line}` }}>
              <label style={{ display: "flex", alignItems: "center", gap: 7, width: 260, height: 29, padding: "0 9px", border: `1px solid ${colors.line}`, borderRadius: 5, background: "#fff", color: colors.muted }}><Search size={13} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone, email..." aria-label="Search scheduled queue" style={{ border: 0, outline: 0, width: "100%", fontSize: 11, background: "transparent", color: colors.ink }} />{query && <button type="button" onClick={() => setQuery("")} style={{ border: 0, background: "transparent", color: colors.muted, cursor: "pointer" }}><X size={12} /></button>}</label>
              <button type="button" onClick={() => setNotice("Advanced filters opened")} style={{ display: "flex", alignItems: "center", gap: 5, border: `1px solid ${colors.line}`, borderRadius: 5, background: "#fff", color: colors.muted, height: 29, padding: "0 9px", fontSize: 11, cursor: "pointer" }}><SlidersHorizontal size={12} /> Filters</button>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, color: colors.muted, fontSize: 10 }}><span>Sort</span>{(["Date", "Name", "Campaign"] as const).map((item) => <button key={item} type="button" onClick={() => activateSort(item)} style={{ display: "flex", alignItems: "center", gap: 3, border: 0, borderRadius: 4, background: sort === item ? colors.mint : "transparent", color: sort === item ? colors.teal : colors.muted, padding: "5px 6px", fontSize: 10, cursor: "pointer", fontWeight: sort === item ? 700 : 500 }}>{item}{sort === item ? direction === "up" ? <ArrowUp size={10} /> : <ArrowDown size={10} /> : <ArrowUpDown size={10} />}</button>)}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1.8fr) 125px 185px minmax(160px, 1fr) 105px", gap: 10, alignItems: "center", minHeight: 31, padding: "0 16px", borderBottom: `1px solid ${colors.line}`, background: colors.pale, color: colors.muted, fontSize: 9, letterSpacing: ".1em", fontWeight: 800 }}><span>CONTACT</span><span>SCHEDULED</span><span>STEP</span><span>CAMPAIGN</span><span>ACTIONS</span></div>
            {visible.length > 0 ? <div>{visible.map((contact) => <article key={contact.id} style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1.8fr) 125px 185px minmax(160px, 1fr) 105px", gap: 10, alignItems: "center", minHeight: 92, padding: "10px 16px", borderBottom: `1px solid ${colors.line}`, fontSize: 11 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}><div style={{ flex: "0 0 27px", width: 27, height: 27, display: "grid", placeItems: "center", borderRadius: 6, background: colors.mint, color: colors.teal }}><PhoneCall size={13} /></div><div style={{ minWidth: 0 }}><strong style={{ display: "block", fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{contact.name} <small style={{ fontWeight: 500, color: colors.muted }}>({contact.organization})</small></strong><div style={{ display: "flex", gap: 6, marginTop: 3 }}><span style={{ color: colors.teal, fontSize: 10 }}>{contact.channel === "Calls" ? "Callback" : contact.channel}</span><span style={{ color: colors.orange, fontSize: 10 }}>Referral</span></div><small style={{ display: "block", color: colors.muted, marginTop: 4 }}>⌖ {contact.city}</small><small style={{ display: "block", color: colors.muted, marginTop: 2, whiteSpace: "nowrap" }}>{contact.phone} <span style={{ color: colors.line }}>·</span> {contact.email}</small></div></div>
              <div><strong style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}><CalendarDays size={12} color={colors.teal} />{contact.scheduled}</strong><span style={{ display: "flex", alignItems: "center", gap: 5, color: colors.muted, marginTop: 5, fontSize: 10 }}><Clock3 size={11} />{contact.time}</span></div>
               <div><span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 7px", borderRadius: 5, background: contact.step.startsWith("Not") ? "#eef4f8" : colors.greenSoft, color: contact.step.startsWith("Not") ? "#567188" : colors.green, fontSize: 10, fontWeight: 650 }}>{contact.step}</span><small style={{ display: "block", marginTop: 7, color: colors.muted }}><Mail size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />Email step</small></div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, color: colors.ink, fontSize: 10 }}><Zap size={12} color={colors.orange} />{contact.campaign}<ChevronDown size={12} color={colors.muted} /></div>
               <div style={{ display: "flex", gap: 5 }}><button type="button" title="Call" onClick={() => action("Calling", contact)} style={{ width: 28, height: 27, display: "grid", placeItems: "center", border: `1px solid #cddde9`, borderRadius: 6, background: "#fff", color: colors.teal, cursor: "pointer" }}><Phone size={13} /></button><button type="button" title="Reschedule" onClick={() => action("Reschedule opened", contact)} style={{ width: 28, height: 27, display: "grid", placeItems: "center", border: `1px solid #cddde9`, borderRadius: 6, background: "#fff", color: "#567188", cursor: "pointer" }}><CalendarClock size={13} /></button><button type="button" title="Delete" onClick={() => { setContacts((items) => items.filter((item) => item.id !== contact.id)); setNotice(`${contact.name} removed from queue`); }} style={{ width: 28, height: 27, display: "grid", placeItems: "center", border: `1px solid #f3d4ce`, borderRadius: 6, background: colors.coralSoft, color: colors.coral, cursor: "pointer" }}><Trash2 size={13} /></button></div>
            </article>)}</div> : <div style={{ display: "grid", placeItems: "center", minHeight: 190, color: colors.muted, gap: 6 }}><Search size={20} /><strong style={{ color: colors.ink, fontSize: 12 }}>{query || timeFilter !== "All" || typeFilter !== "All" ? "No scheduled contacts match" : "Your scheduled queue is empty"}</strong><span style={{ fontSize: 11 }}>Try changing the filters or search term.</span></div>}
          </div>
        </div>
        <footer style={{ minHeight: 38, display: "flex", alignItems: "center", padding: "0 16px", borderTop: `1px solid ${colors.line}`, color: colors.muted, fontSize: 10 }}><span><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: colors.teal, marginRight: 7 }} />{notice}</span><span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>1–{visible.length} of {visible.length}<button type="button" aria-label="Previous page" onClick={() => setNotice("Already on the first page")} style={{ border: 0, background: "transparent", color: colors.muted, cursor: "pointer" }}><ChevronLeft size={13} /></button><button type="button" aria-label="Next page" onClick={() => setNotice("All scheduled contacts are visible")} style={{ border: 0, background: "transparent", color: colors.muted, cursor: "pointer" }}><ChevronRight size={13} /></button></span></footer>
      </section>
    </main>
  );
}

export default PulseMaximumDensity;