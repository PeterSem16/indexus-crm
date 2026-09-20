import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, CalendarClock, ChevronDown,
  ChevronLeft, ChevronRight, Clock3, Mail, MessageSquare, Phone, PhoneCall,
   Search, Trash2, X, Zap,
} from "lucide-react";

type Channel = "Calls" | "Emails" | "SMS";
type QueueContact = {
  id: number; name: string; organization: string; city: string; phone: string;
  email: string; scheduled: string; time: string; date: string; step: string;
  note?: string; rescheduled?: boolean;
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
  const [rescheduleId, setRescheduleId] = useState<number | null>(null);
  const [draftDate, setDraftDate] = useState("");
  const [draftTime, setDraftTime] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  const today = new Date().toISOString().slice(0, 10);
  const formatScheduledDate = (date: string) => {
    const [year, month, day] = date.split("-");
    return `${Number(day)}.${Number(month)}.${year}`;
  };
  const openReschedule = (contact: QueueContact) => {
    setRescheduleId(contact.id);
    setDraftDate(contact.date >= today ? contact.date : today);
    setDraftTime(contact.time);
    setDraftNote(contact.note || "");
    setNotice(`Reschedule opened: ${contact.name}`);
  };
  const closeReschedule = () => {
    setRescheduleId(null);
    setDraftDate("");
    setDraftTime("");
    setDraftNote("");
  };
  const confirmReschedule = (contact: QueueContact) => {
    if (!draftDate || !draftTime) return;
    setContacts((items) => items.map((item) => item.id === contact.id
      ? {
          ...item,
          date: draftDate,
          time: draftTime,
          scheduled: formatScheduledDate(draftDate),
          note: draftNote.trim() || "Follow up at the newly scheduled time.",
          rescheduled: true,
        }
      : item));
    setNotice(`Rescheduled: ${contact.name}`);
    closeReschedule();
  };

  useEffect(() => {
    if (rescheduleId === null) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) closeReschedule();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeReschedule();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [rescheduleId]);

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
      <style>{`.pulse-focus:focus-visible{outline:2px solid ${colors.teal};outline-offset:2px;}`}</style>
      <section style={{ maxWidth: 1440, margin: "0 auto", background: "#fbfdff", border: `1px solid #caddeb`, borderRadius: 14, boxShadow: "0 20px 52px rgba(28,67,103,.14)", overflow: "hidden" }}>
        <header style={{ minHeight: 58, display: "flex", alignItems: "center", gap: 12, padding: "0 18px", borderBottom: `1px solid ${colors.line}`, background: "#f8fbfe" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", color: colors.teal, background: colors.mint }}><CalendarClock size={16} /></div>
           <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 230 }}><h1 style={{ fontSize: 15, margin: 0, letterSpacing: "-.02em" }}>Scheduled queue</h1><b style={{ minWidth: 20, textAlign: "center", padding: "3px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600, color: "#647d91", background: "#edf2f6" }}>2</b></div>
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
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, color: colors.muted, fontSize: 10 }}><span>Sort</span>{(["Date", "Name", "Campaign"] as const).map((item) => <button key={item} type="button" onClick={() => activateSort(item)} style={{ display: "flex", alignItems: "center", gap: 3, border: 0, borderRadius: 4, background: sort === item ? colors.mint : "transparent", color: sort === item ? colors.teal : colors.muted, padding: "5px 6px", fontSize: 10, cursor: "pointer", fontWeight: sort === item ? 700 : 500 }}>{item}{sort === item ? direction === "up" ? <ArrowUp size={10} /> : <ArrowDown size={10} /> : <ArrowUpDown size={10} />}</button>)}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1.8fr) 125px 185px minmax(160px, 1fr) 105px", gap: 10, alignItems: "center", minHeight: 31, padding: "0 16px", borderBottom: `1px solid ${colors.line}`, background: colors.pale, color: colors.muted, fontSize: 9, letterSpacing: ".1em", fontWeight: 800 }}><span>CONTACT</span><span>SCHEDULED</span><span>STEP</span><span>CAMPAIGN</span><span>ACTIONS</span></div>
            {visible.length > 0 ? <div>{visible.map((contact) => <article key={contact.id} style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1.8fr) 125px 185px minmax(160px, 1fr) 105px", gap: 10, alignItems: "center", minHeight: 92, padding: "10px 16px", borderBottom: `1px solid ${colors.line}`, fontSize: 11 }}>
               <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}><div style={{ flex: "0 0 27px", width: 27, height: 27, display: "grid", placeItems: "center", borderRadius: "50%", background: colors.mint, color: colors.teal }}><PhoneCall size={13} /></div><div style={{ minWidth: 0 }}><strong style={{ display: "block", fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{contact.name} <small style={{ fontWeight: 500, color: colors.ink }}>({contact.organization})</small></strong><div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}><span style={{ color: colors.ink, fontSize: 9 }}>{contact.channel === "Calls" ? "Callback" : contact.channel}</span><span style={{ padding: "2px 6px", borderRadius: 5, color: "#6e6fb0", background: "#efeffb", fontSize: 8, fontWeight: 600 }}>Referral</span></div><small style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, padding: "2px 6px", borderRadius: 5, color: colors.green, background: colors.greenSoft, fontSize: 8 }}><span style={{ fontSize: 9 }}>⌖</span>{contact.city}</small><small style={{ display: "block", color: colors.muted, marginTop: 2, whiteSpace: "nowrap", fontSize: 8 }}>{contact.phone} <span style={{ color: colors.line }}>·</span> {contact.email}</small></div></div>
               <div>
                 <strong style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}><CalendarDays size={12} color={colors.teal} />{contact.scheduled}</strong>
                 <span style={{ display: "flex", alignItems: "center", gap: 5, color: colors.muted, marginTop: 5, fontSize: 10 }}><Clock3 size={11} />{contact.time}</span>
                 {contact.rescheduled && contact.note && <span title={contact.note} style={{ display: "flex", alignItems: "center", gap: 4, maxWidth: 116, marginTop: 6, padding: "3px 5px", border: `1px solid #f0c8bc`, borderRadius: 4, background: colors.coralSoft, color: colors.coral, fontSize: 8, lineHeight: 1.25, fontWeight: 700 }}><span style={{ flex: "0 0 auto", letterSpacing: ".06em" }}>NOTE</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{contact.note}</span></span>}
               </div>
                <div><span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 7px", borderRadius: 4, background: contact.step.startsWith("Not") ? "#eef4f8" : colors.greenSoft, color: contact.step.startsWith("Not") ? "#567188" : colors.green, fontSize: 9, fontWeight: 650 }}>{contact.step}</span><small style={{ display: "grid", placeItems: "center", width: 15, height: 13, marginTop: 6, border: "1px solid #cbdcf2", borderRadius: 3, color: "#6a99d0", background: "#edf4ff" }}><Mail size={9} /></small></div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, color: colors.ink, fontSize: 10 }}><Zap size={12} color={colors.orange} />{contact.campaign}<ChevronDown size={12} color={colors.muted} /></div>
                <div style={{ position: "relative", display: "flex", gap: 5 }}>
                  <button type="button" aria-label={`Call ${contact.name}`} title="Call" onClick={() => action("Calling", contact)} style={{ width: 28, height: 27, display: "grid", placeItems: "center", border: `1px solid #cddde9`, borderRadius: 6, background: "#fff", color: colors.teal, cursor: "pointer" }}><Phone size={13} /></button>
                  <button className="pulse-focus" type="button" aria-label={`Reschedule ${contact.name}`} title="Reschedule" onClick={() => openReschedule(contact)} style={{ width: 28, height: 27, display: "grid", placeItems: "center", border: `1px solid ${rescheduleId === contact.id ? colors.teal : "#cddde9"}`, borderRadius: 6, background: rescheduleId === contact.id ? colors.mint : "#fff", color: "#567188", cursor: "pointer", outline: "none" }}><CalendarClock size={13} /></button>
                  <button type="button" aria-label={`Delete ${contact.name}`} title="Delete" onClick={() => { setContacts((items) => items.filter((item) => item.id !== contact.id)); setNotice(`${contact.name} removed from queue`); }} style={{ width: 28, height: 27, display: "grid", placeItems: "center", border: `1px solid #f3d4ce`, borderRadius: 6, background: colors.coralSoft, color: colors.coral, cursor: "pointer" }}><Trash2 size={13} /></button>
                  {rescheduleId === contact.id && <div ref={popoverRef} role="dialog" aria-label={`Reschedule ${contact.name}`} style={{ position: "absolute", zIndex: 10, right: 0, top: 35, width: 244, padding: 12, border: `1px solid #c9dce9`, borderRadius: 9, background: "#ffffff", boxShadow: "0 14px 28px rgba(28,67,103,.18)" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                      <div><strong style={{ display: "block", fontSize: 11, color: colors.ink }}>Reschedule call</strong><span style={{ display: "block", maxWidth: 190, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: colors.muted, fontSize: 9 }}>{contact.name}</span></div>
                      <button className="pulse-focus" type="button" aria-label="Close reschedule" onClick={closeReschedule} style={{ display: "grid", placeItems: "center", width: 22, height: 22, margin: -3, border: 0, borderRadius: 5, background: "transparent", color: colors.muted, cursor: "pointer" }}><X size={13} /></button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1.15fr .85fr", gap: 7 }}>
                      <label style={{ display: "grid", gap: 4, color: colors.muted, fontSize: 8, fontWeight: 700 }}>DATE<input className="pulse-focus" aria-label="Reschedule date" type="date" min={today} value={draftDate} onChange={(event) => setDraftDate(event.target.value)} style={{ width: "100%", height: 29, padding: "0 6px", border: `1px solid ${colors.line}`, borderRadius: 5, color: colors.ink, background: colors.pale, fontSize: 10, outlineColor: colors.teal }} /></label>
                      <label style={{ display: "grid", gap: 4, color: colors.muted, fontSize: 8, fontWeight: 700 }}>TIME<input className="pulse-focus" aria-label="Reschedule time" type="time" value={draftTime} onChange={(event) => setDraftTime(event.target.value)} style={{ width: "100%", height: 29, padding: "0 5px", border: `1px solid ${colors.line}`, borderRadius: 5, color: colors.ink, background: colors.pale, fontSize: 10, outlineColor: colors.teal }} /></label>
                    </div>
                     <label style={{ display: "grid", gap: 4, marginTop: 9, color: colors.muted, fontSize: 8, fontWeight: 700 }}>NOTE <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>Optional handoff context</span><input className="pulse-focus" aria-label="Reschedule note" value={draftNote} onChange={(event) => setDraftNote(event.target.value)} placeholder="Why is this being moved?" maxLength={90} style={{ width: "100%", height: 29, padding: "0 7px", border: `1px solid ${colors.line}`, borderRadius: 5, color: colors.ink, background: colors.pale, fontSize: 10, outlineColor: colors.teal }} /></label>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 11, paddingTop: 9, borderTop: `1px solid ${colors.line}` }}>
                      <button className="pulse-focus" type="button" onClick={closeReschedule} style={{ height: 27, padding: "0 9px", border: 0, borderRadius: 5, background: "transparent", color: colors.muted, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                      <button className="pulse-focus" type="button" onClick={() => confirmReschedule(contact)} disabled={!draftDate || !draftTime} style={{ height: 27, padding: "0 11px", border: 0, borderRadius: 5, background: colors.teal, color: "#fff", fontSize: 10, fontWeight: 800, cursor: "pointer", opacity: !draftDate || !draftTime ? .5 : 1 }}>OK</button>
                    </div>
                  </div>}
                </div>
            </article>)}</div> : <div style={{ display: "grid", placeItems: "center", minHeight: 190, color: colors.muted, gap: 6 }}><Search size={20} /><strong style={{ color: colors.ink, fontSize: 12 }}>{query || timeFilter !== "All" || typeFilter !== "All" ? "No scheduled contacts match" : "Your scheduled queue is empty"}</strong><span style={{ fontSize: 11 }}>Try changing the filters or search term.</span></div>}
          </div>
        </div>
        <footer style={{ minHeight: 38, display: "flex", alignItems: "center", padding: "0 16px", borderTop: `1px solid ${colors.line}`, color: colors.muted, fontSize: 10 }}><span><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: colors.teal, marginRight: 7 }} />{notice}</span><span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>1–{visible.length} of {visible.length}<button type="button" aria-label="Previous page" onClick={() => setNotice("Already on the first page")} style={{ border: 0, background: "transparent", color: colors.muted, cursor: "pointer" }}><ChevronLeft size={13} /></button><button type="button" aria-label="Next page" onClick={() => setNotice("All scheduled contacts are visible")} style={{ border: 0, background: "transparent", color: colors.muted, cursor: "pointer" }}><ChevronRight size={13} /></button></span></footer>
      </section>
    </main>
  );
}

export default PulseMaximumDensity;