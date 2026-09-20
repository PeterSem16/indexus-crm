import { useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, CalendarClock,
  ChevronLeft, ChevronRight, Clock3, Mail, Phone, PhoneCall, Search,
  MessageSquare, Trash2, X,
} from "lucide-react";
import "./PulseOriginalRedesign.css";

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

export function PulseOriginalRedesign() {
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
    const result = contacts.filter((c) => {
      const matchesText = !q || `${c.name} ${c.organization} ${c.city} ${c.phone} ${c.email} ${c.campaign}`.toLowerCase().includes(q);
      const matchesType = typeFilter === "All" || c.channel === typeFilter;
      const matchesAssigned = !assignedOnly || c.assigned;
      const matchesTime = timeFilter === "All" || (timeFilter === "This week" && counts.week > 0);
      return matchesText && matchesType && matchesAssigned && matchesTime;
    });
    return result.sort((a, b) => {
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
    <main className="porq-stage">
      <section className="porq-window" aria-label="Scheduled queue">
        <header className="porq-top">
          <div className="porq-mark"><CalendarClock size={18} /></div>
          <div><h1>Scheduled queue <b>2</b></h1><p>Callbacks and follow-ups ready for your shift</p></div>
          <label className="porq-assigned"><input type="checkbox" checked={assignedOnly} onChange={(e) => setAssignedOnly(e.target.checked)} /><span>Only assigned</span></label>
          <button className="porq-close" type="button" aria-label="Close queue" onClick={() => setNotice("Queue remains available from Agent Workspace")}><X size={15} /></button>
        </header>
        <div className="porq-layout">
          <aside className="porq-sidebar">
            <div className="porq-side-label">TIME</div>
            {timeFilters.map((filter) => <button key={filter} className={`porq-side-item ${timeFilter === filter ? "active" : ""}`} onClick={() => setTimeFilter(filter)}><span className={`porq-time-dot dot-${filter.replace(" ", "-")}`}>{filter === "All" ? "▦" : filter === "overdue" ? "!" : filter === "today" ? "◷" : "□"}</span>{filter}<em>{countForTime(filter)}</em></button>)}
            <div className="porq-side-label type-label">TYPE</div>
            {typeFilters.map((filter) => <button key={filter} className={`porq-side-item ${typeFilter === filter ? "active" : ""}`} onClick={() => setTypeFilter(filter)}><span className="porq-type-icon">{filter === "Calls" ? <Phone size={12} /> : filter === "Emails" ? <Mail size={12} /> : filter === "SMS" ? <MessageSquare size={12} /> : "◉"}</span>{filter}<em>{counts[filter]}</em></button>)}
          </aside>
          <div className="porq-main">
            <div className="porq-toolbar">
              <label className="porq-search"><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search scheduled queue" />{query && <button type="button" onClick={() => setQuery("")}><X size={13} /></button>}</label>
              <div className="porq-sorters"><span>Sort</span>{(["Date", "Name", "Campaign"] as const).map((item) => <button key={item} className={sort === item ? "selected" : ""} onClick={() => activateSort(item)}>{item}{sort === item ? direction === "up" ? <ArrowUp size={11} /> : <ArrowDown size={11} /> : <ArrowUpDown size={11} />}</button>)}</div>
            </div>
            <div className="porq-table-head"><span>CONTACT</span><span>SCHEDULED</span><span>STEP</span><span>CAMPAIGN</span><span>ACTIONS</span></div>
            {visible.length > 0 ? <div className="porq-rows">{visible.map((contact) => <article className="porq-row" key={contact.id}>
              <div className="porq-contact"><div className="porq-avatar"><PhoneCall size={14} /></div><div><strong>{contact.name} <small>({contact.organization})</small></strong><span><i>{contact.channel === "Calls" ? "Callback" : contact.channel}</i><b>Referral</b></span><small className="porq-city"><span>⌖</span> {contact.city}</small><small className="porq-details">{contact.phone} <span>·</span> {contact.email}</small></div></div>
              <div className="porq-scheduled"><strong><CalendarDays size={12} />{contact.scheduled}</strong><span><Clock3 size={11} />{contact.time}</span></div>
              <div className="porq-step"><span className={contact.step.startsWith("Not") ? "neutral" : "positive"}>{contact.step}</span><small><Mail size={11} /></small></div>
              <div className="porq-campaign"><span>{contact.campaign}</span></div>
              <div className="porq-actions"><button title="Call" onClick={() => action("Calling", contact)}><Phone size={14} /></button><button title="Reschedule" onClick={() => action("Reschedule opened", contact)}><CalendarClock size={14} /></button><button title="Delete" className="danger" onClick={() => { setContacts((items) => items.filter((item) => item.id !== contact.id)); setNotice(`${contact.name} removed from queue`); }}><Trash2 size={14} /></button></div>
            </article>)}</div> : <div className="porq-empty"><Search size={22} /><strong>{query || timeFilter !== "All" || typeFilter !== "All" ? "No scheduled contacts match" : "Your scheduled queue is empty"}</strong><span>Try changing the filters or search term.</span></div>}
          </div>
        </div>
        <footer className="porq-footer"><span>{notice}</span><span className="porq-footer-page">1–{visible.length} of {visible.length} <button aria-label="Previous page"><ChevronLeft size={13} /></button><button aria-label="Next page"><ChevronRight size={13} /></button></span></footer>
      </section>
    </main>
  );
}

export default PulseOriginalRedesign;