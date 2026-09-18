import { useMemo, useState } from "react";
import {
  ArrowUpDown, Check, CheckCircle, ChevronDown, Clock, Mail, MessageSquare,
  PhoneIncoming, PhoneOff, Search, SlidersHorizontal, User, X,
} from "lucide-react";
import "./_group.css";

type Channel = "calls" | "email" | "sms";
type Filter = "all" | "pending" | "handled";

const calls = [
  { id: 1, name: "Martin Kováč", phone: "+421 905 481 220", queue: "Bratislava — inbound", reason: "Caller ended the call", time: "09:42", ago: "12 min", wait: "1m 18s", handled: false },
  { id: 2, name: "Ambulancia Medifem", phone: "+421 948 519 438", queue: "Medical partners", reason: "Queue timeout", time: "09:18", ago: "36 min", wait: "4m 02s", handled: false },
  { id: 3, name: "Lucia Horváthová", phone: "+421 911 204 773", queue: "Bratislava — inbound", reason: "Called back by Peter", time: "08:54", ago: "1 h", wait: "42s", handled: true },
];

const messages = [
  { id: 4, kind: "email" as const, name: "Zdravotné centrum Iris", address: "recepcia@centrum-iris.sk", subject: "Potvrdenie termínu spolupráce", preview: "Dobrý deň, radi by sme potvrdili náš zajtrajší termín…", time: "08:31", handled: false },
  { id: 5, kind: "sms" as const, name: "Jana Bieliková", address: "+421 903 884 112", subject: "", preview: "Prosím zavolajte mi späť po 14:00.", time: "Včera", handled: true },
];

export function Current() {
  const [channel, setChannel] = useState<Channel>("calls");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const items = useMemo(() => {
    const source = channel === "calls" ? calls : messages.filter(item => item.kind === channel);
    const q = query.toLowerCase().trim();
    return [...source]
      .filter(item => filter === "all" || (filter === "handled" ? item.handled : !item.handled))
      .filter(item => !q || `${item.name} ${item.phone ?? item.address} ${item.subject ?? ""} ${item.preview ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name, "sk") : 0);
  }, [channel, filter, query, sort]);

  return (
    <main className="pm-stage">
      <section className="pm-dialog" aria-label="Missed communications">
        <header className="pm-header">
          <div className="pm-title-icon"><PhoneOff size={20} /></div>
          <div className="pm-title-copy">
            <h1>Missed communications</h1>
            <p>7 unhandled items · Review, find a contact, and continue</p>
          </div>
          <button className="pm-icon-button" aria-label="Close"><X size={18} /></button>
        </header>

        <nav className="pm-channel-tabs" aria-label="Communication channel">
          {([
            ["calls", "Calls", PhoneIncoming, 3],
            ["email", "Email", Mail, 2],
            ["sms", "SMS", MessageSquare, 1],
          ] as const).map(([key, label, Icon, count]) => (
            <button key={key} className={channel === key ? "pm-channel active" : "pm-channel"} onClick={() => { setChannel(key); setFilter("all"); }}>
              <Icon size={15} /> {label}<span className="pm-count">{count}</span>
            </button>
          ))}
        </nav>

        <div className="pm-toolbar">
          <label className="pm-search">
            <Search size={15} aria-hidden="true" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, phone, email…" aria-label="Search missed communications" />
            {query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={13} /></button>}
          </label>
          <button className="pm-tool-button"><SlidersHorizontal size={14} /> All fields <ChevronDown size={13} /></button>
          <label className="pm-sort">
            <ArrowUpDown size={14} />
            <select value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort missed communications">
              <option value="newest">Newest first</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
        </div>

        <div className="pm-filters" role="tablist" aria-label="Missed communication status">
          {([
            ["all", "All", channel === "calls" ? calls.length : messages.filter(item => item.kind === channel).length],
            ["pending", "Unhandled", channel === "calls" ? calls.filter(item => !item.handled).length : messages.filter(item => item.kind === channel && !item.handled).length],
            ["handled", "Handled", channel === "calls" ? calls.filter(item => item.handled).length : messages.filter(item => item.kind === channel && item.handled).length],
          ] as const).map(([key, label, count]) => (
            <button key={key} role="tab" aria-selected={filter === key} className={filter === key ? "pm-filter active" : "pm-filter"} onClick={() => setFilter(key)}>{label} <b>{count}</b></button>
          ))}
        </div>

        <div className="pm-list">
          <div className="pm-list-head"><strong>{items.length} results</strong><span>Sorted by {sort === "name" ? "name" : "newest"}</span></div>
          {items.length === 0 ? (
            <div className="pm-empty"><CheckCircle size={38} /><strong>No matching items</strong><span>Try another search or filter.</span></div>
          ) : items.map(item => channel === "calls" ? (
            <article className="pm-row" key={item.id}>
              <div className={`pm-avatar ${item.handled ? "done" : "missed"}`}><PhoneOff size={16} /></div>
              <div className="pm-row-main"><strong>{item.name}</strong><span>{item.phone} <i>·</i> {item.queue}</span><small>{item.reason}</small></div>
              <div className="pm-row-meta"><strong>{item.time}</strong><span>{item.ago}</span><em>{item.wait}</em></div>
              <div className="pm-row-actions">{item.handled ? <span className="pm-handled"><Check size={13} /> Handled</span> : <><button className="pm-primary"><User size={13} /> Open contact</button><button className="pm-secondary">Mark handled</button></>}</div>
            </article>
          ) : (
            <article className="pm-row" key={item.id}>
              <div className={`pm-avatar ${item.handled ? "done" : "missed"}`}>{item.kind === "email" ? <Mail size={16} /> : <MessageSquare size={16} />}</div>
              <div className="pm-row-main"><strong>{item.name}</strong><span>{item.address}</span>{item.subject && <small className="pm-subject">{item.subject}</small>}<small>{item.preview}</small></div>
              <div className="pm-row-meta"><strong>{item.time}</strong></div>
              <div className="pm-row-actions">{item.handled ? <span className="pm-handled"><Check size={13} /> Handled</span> : <><button className="pm-primary">{item.kind === "email" ? "Reply" : "Open contact"}</button><button className="pm-secondary">Mark handled</button></>}</div>
            </article>
          ))}
        </div>
        <footer className="pm-footer"><span><Search size={13} /> Same search and sorting pattern as Contacts</span><button className="pm-help">Need help?</button></footer>
      </section>
    </main>
  );
}

export default Current;