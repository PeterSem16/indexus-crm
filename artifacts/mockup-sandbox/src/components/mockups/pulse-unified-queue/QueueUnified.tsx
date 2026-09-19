import { useMemo, useState } from "react";
import {
  ArrowDownUp,
  Bell,
  Check,
  ChevronDown,
  Clock3,
  Headphones,
  PhoneCall,
  PhoneIncoming,
  Search,
  SlidersHorizontal,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

type Priority = "Urgent" | "High" | "Standard";
type Channel = "call" | "callback";
type QueueItem = {
  id: number;
  name: string;
  initials: string;
  phone: string;
  queue: string;
  mission: string;
  priority: Priority;
  wait: number;
  entered: string;
  reason: string;
  channel: Channel;
  assigned?: string;
};

const initialItems: QueueItem[] = [
  { id: 1, name: "Martin Kováč", initials: "MK", phone: "+421 905 481 220", queue: "Bratislava · inbound", mission: "Appointment desk", priority: "Urgent", wait: 8, entered: "09:46", reason: "Referral appointment · Slovak", channel: "call" },
  { id: 2, name: "Ambulancia Medifem", initials: "AM", phone: "+421 948 519 438", queue: "Medical partners", mission: "Partner support", priority: "High", wait: 5, entered: "09:49", reason: "Provider availability question", channel: "call" },
  { id: 3, name: "Zuzana Šimková", initials: "ZŠ", phone: "+421 903 177 604", queue: "Bratislava · inbound", mission: "Appointment desk", priority: "Standard", wait: 3, entered: "09:51", reason: "Reschedule existing visit", channel: "call" },
  { id: 4, name: "Peter Novotný", initials: "PN", phone: "+421 910 663 804", queue: "Košice · inbound", mission: "General enquiries", priority: "Standard", wait: 2, entered: "09:52", reason: "New patient registration", channel: "call" },
  { id: 5, name: "Klinika ProVita", initials: "KP", phone: "+421 2 555 018 42", queue: "Medical partners", mission: "Partner support", priority: "High", wait: 1, entered: "09:53", reason: "Callback requested by reception", channel: "callback", assigned: "M. Hruška" },
];

const queueLabels = ["All queues", "Bratislava · inbound", "Košice · inbound", "Medical partners"];

export function QueueUnified() {
  const [items, setItems] = useState(initialItems);
  const [queue, setQueue] = useState("All queues");
  const [priority, setPriority] = useState<Priority | "All">("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"wait" | "newest">("wait");
  const [selected, setSelected] = useState<number | null>(1);
  const [feedback, setFeedback] = useState("Live queue · updated just now");

  const visibleItems = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return items
      .filter(item => queue === "All queues" || item.queue === queue)
      .filter(item => priority === "All" || item.priority === priority)
      .filter(item => !q || `${item.name} ${item.phone} ${item.queue} ${item.reason}`.toLocaleLowerCase().includes(q))
      .sort((a, b) => sort === "wait" ? b.wait - a.wait : a.entered.localeCompare(b.entered));
  }, [items, priority, query, queue, sort]);

  const selectedItem = items.find(item => item.id === selected) ?? visibleItems[0];
  const counts = {
    all: items.length,
    urgent: items.filter(item => item.priority === "Urgent").length,
    high: items.filter(item => item.priority === "High").length,
  };

  function takeNext() {
    const next = [...items].sort((a, b) => b.wait - a.wait)[0];
    if (next) {
      setSelected(next.id);
      setFeedback(`${next.name} is ready · contact card opened`);
    }
  }

  function complete(id: number) {
    const item = items.find(entry => entry.id === id);
    setItems(current => current.filter(entry => entry.id !== id));
    setSelected(null);
    setFeedback(item ? `${item.name} connected · removed from waiting queue` : "Contact removed from queue");
  }

  function snooze(id: number) {
    const item = items.find(entry => entry.id === id);
    setItems(current => current.filter(entry => entry.id !== id));
    setFeedback(item ? `${item.name} snoozed for 10 minutes` : "Contact snoozed");
    setSelected(null);
  }

  return (
    <main className="uq-stage">
      <style>{`
        .uq-stage{--ink:#18314d;--muted:#69809a;--soft:#edf5fb;--line:#dce8f2;--blue:#2d6fba;--blueDark:#1c568f;--alert:#bf5c4f;--alertSoft:#fff1ed;--green:#3f826e;--greenSoft:#eaf6f1;min-height:100dvh;padding:34px;display:grid;place-items:center;color:var(--ink);background:#eaf2f8;font-family:"Plus Jakarta Sans","Avenir Next",system-ui,sans-serif}.uq-stage *{box-sizing:border-box}.uq-shell{width:min(1100px,100%);min-height:min(760px,calc(100dvh - 68px));display:flex;flex-direction:column;overflow:hidden;background:#fbfdff;border:1px solid #caddeb;border-radius:18px;box-shadow:0 26px 70px rgba(28,67,103,.16)}.uq-header{display:flex;align-items:center;gap:13px;padding:21px 25px 19px;background:#f8fbfe;border-bottom:1px solid var(--line)}.uq-icon{width:42px;height:42px;display:grid;place-items:center;color:var(--blue);background:#e5f0fa;border:1px solid #c9deef;border-radius:13px}.uq-copy{min-width:0;flex:1}.uq-kicker{margin:0 0 3px;color:var(--blue);font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.uq-copy h1{margin:0;color:#173452;font-size:20px;line-height:1.15;letter-spacing:-.025em}.uq-copy p{margin:5px 0 0;color:var(--muted);font-size:11px}.uq-live{display:flex;align-items:center;gap:7px;margin-right:10px;color:var(--green);font-size:11px;font-weight:800}.uq-live i{width:7px;height:7px;background:var(--green);border-radius:50%}.uq-close{width:30px;height:30px;display:grid;place-items:center;color:#7690a6;background:transparent;border:0;border-radius:8px;cursor:pointer}.uq-close:hover{background:var(--soft);color:var(--ink)}.uq-context{display:flex;align-items:center;gap:10px;padding:13px 25px;background:#fff;border-bottom:1px solid var(--line)}.uq-context-label{color:#8ca0b3;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.uq-select{height:34px;display:flex;align-items:center;gap:7px;padding:0 10px;color:#345b7b;background:#f5f9fc;border:1px solid #c7d8e7;border-radius:9px;font-size:11px;font-weight:800}.uq-select select{max-width:180px;color:inherit;background:transparent;border:0;outline:0;font:inherit;cursor:pointer}.uq-context-note{margin-left:auto;color:#7e97aa;font-size:10px}.uq-metrics{display:grid;grid-template-columns:repeat(4,1fr);padding:13px 25px;background:#fff;border-bottom:1px solid var(--line)}.uq-metric{padding:0 15px;border-left:1px solid var(--line)}.uq-metric:first-child{padding-left:0;border-left:0}.uq-metric strong,.uq-metric span{display:block}.uq-metric strong{color:#294964;font-size:18px;letter-spacing:-.03em}.uq-metric span{margin-top:3px;color:#8096a8;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em}.uq-metric.alert strong{color:var(--alert)}.uq-metric.green strong{color:var(--green)}.uq-toolbar{display:flex;align-items:center;gap:8px;padding:16px 25px 11px;background:#fff}.uq-search{min-width:190px;height:39px;display:flex;align-items:center;gap:8px;flex:1;padding:0 11px;color:#88a0b6;border:1px solid #c7d8e7;border-radius:11px}.uq-search:focus-within{border-color:#5a94ca;box-shadow:0 0 0 3px rgba(45,111,186,.12)}.uq-search input{width:100%;min-width:0;color:var(--ink);background:transparent;border:0;outline:0;font-size:12px}.uq-search input::placeholder{color:#8ba0b3}.uq-tool-select{height:39px;display:flex;align-items:center;gap:7px;padding:0 11px;color:#506b84;background:#fff;border:1px solid #c7d8e7;border-radius:11px;font-size:11px;font-weight:700}.uq-tool-select select{max-width:120px;color:inherit;background:transparent;border:0;outline:0;font:inherit;cursor:pointer}.uq-filters{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:0 25px 14px;background:#fff;border-bottom:1px solid var(--line)}.uq-label{margin-right:2px;color:#8ca0b3;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.uq-chip{height:27px;display:inline-flex;align-items:center;gap:5px;padding:0 9px;color:#637e96;background:#f0f5f9;border:1px solid transparent;border-radius:8px;font-size:10px;font-weight:800;cursor:pointer}.uq-chip.active{color:#fff;background:var(--blue);box-shadow:0 3px 8px rgba(45,111,186,.2)}.uq-chip.alert.active{background:var(--alert)}.uq-count{min-width:17px;padding:2px 4px;color:#6f8da5;background:#dfeaf3;border-radius:5px;font-size:9px;text-align:center}.uq-chip.active .uq-count{color:#e9f4ff;background:rgba(255,255,255,.2)}.uq-body{display:grid;grid-template-columns:minmax(0,1fr) 270px;min-height:0;flex:1;background:#f7fbfe}.uq-list{min-width:0;padding:15px 25px 21px;overflow:auto}.uq-list-head{display:flex;align-items:center;justify-content:space-between;margin:0 1px 9px}.uq-result{color:#294964;font-size:12px;font-weight:800}.uq-result span{color:#86a0b5;font-weight:600}.uq-feedback{color:var(--green);font-size:10px;font-weight:800}.uq-row{display:flex;align-items:center;gap:11px;margin:7px 0;padding:12px;background:#fff;border:1px solid #dce8f1;border-radius:13px;box-shadow:0 2px 7px rgba(25,66,103,.045);transition:transform .15s,border-color .15s;cursor:pointer}.uq-row:hover,.uq-row.selected{border-color:#a9c7df;transform:translateY(-1px)}.uq-row.selected{box-shadow:0 0 0 2px rgba(45,111,186,.1)}.uq-avatar{width:38px;height:38px;display:grid;place-items:center;flex:none;color:#2d6fba;background:#eaf3fb;border-radius:11px;font-size:10px;font-weight:800}.uq-avatar.urgent{color:var(--alert);background:#fff0ec}.uq-main{min-width:0;flex:1}.uq-top{display:flex;align-items:center;gap:7px;min-width:0}.uq-top strong{overflow:hidden;color:#1d3d5a;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.uq-identity,.uq-contextline{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.uq-identity{margin-top:3px;color:#7089a0;font-size:10px}.uq-contextline{margin-top:5px;color:#57728a;font-size:10px}.uq-contextline b{color:#345b7b}.uq-badge{display:inline-flex;align-items:center;gap:4px;flex:none;padding:3px 6px;border-radius:6px;font-size:9px;font-weight:800}.uq-badge.urgent,.uq-badge.high{color:#ae5549;background:var(--alertSoft)}.uq-badge.standard{color:#567188;background:#eef4f8}.uq-wait{display:flex;align-items:center;gap:4px;min-width:65px;color:#527aa0;font-size:10px}.uq-wait.urgent{color:var(--alert);font-weight:800}.uq-actions{display:flex;gap:5px;opacity:0;transition:opacity .15s}.uq-row:hover .uq-actions,.uq-row.selected .uq-actions{opacity:1}.uq-button{min-height:29px;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:0 9px;border-radius:8px;font-size:10px;font-weight:800;white-space:nowrap;cursor:pointer}.uq-primary{color:#fff;background:var(--blue);border:1px solid var(--blue)}.uq-primary:hover{background:var(--blueDark)}.uq-secondary{color:#567188;background:#fff;border:1px solid #cddde9}.uq-secondary:hover{color:var(--blueDark);background:#f3f8fc}.uq-detail{padding:18px 17px;background:#f8fbfe;border-left:1px solid var(--line)}.uq-detail h2{margin:0;color:#294964;font-size:12px}.uq-detail-sub{margin:4px 0 16px;color:#8098ab;font-size:10px}.uq-person{display:flex;align-items:center;gap:9px;padding-bottom:15px;border-bottom:1px solid var(--line)}.uq-person-avatar{width:37px;height:37px;display:grid;place-items:center;color:var(--blue);background:#e5f0fa;border-radius:11px;font-size:10px;font-weight:800}.uq-person strong{display:block;color:#1d3d5a;font-size:12px}.uq-person span{display:block;margin-top:3px;color:#7089a0;font-size:10px}.uq-detail-block{padding:14px 0;border-bottom:1px solid var(--line)}.uq-detail-label{color:#8ca0b3;font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.uq-detail-value{margin-top:6px;color:#345b7b;font-size:11px;font-weight:700;line-height:1.4}.uq-next{display:flex;gap:7px;margin-top:13px;padding:10px;color:#3f826e;background:var(--greenSoft);border:1px solid #cce4d9;border-radius:9px;font-size:10px;line-height:1.4}.uq-detail-actions{display:flex;gap:6px;margin-top:16px}.uq-detail-actions .uq-button{flex:1}.uq-empty{min-height:300px;display:grid;place-items:center;align-content:center;gap:8px;color:#83a98f;text-align:center}.uq-empty strong{color:#34546c;font-size:13px}.uq-empty span{color:#8098ab;font-size:11px}.uq-footer{display:flex;align-items:center;gap:12px;padding:11px 25px;color:#8399ab;background:#fff;border-top:1px solid var(--line);font-size:10px}.uq-footer button{margin-left:auto;color:var(--blue);background:#e8f3fb;border:0;border-radius:8px;padding:7px 10px;font-size:10px;font-weight:800;cursor:pointer}.uq-footer button:hover{background:#dcecf8}@media(max-width:820px){.uq-stage{padding:9px;align-items:start}.uq-shell{min-height:calc(100dvh - 18px);border-radius:13px}.uq-header,.uq-context,.uq-toolbar,.uq-list,.uq-footer{padding-left:14px;padding-right:14px}.uq-metrics,.uq-filters{padding-left:14px;padding-right:14px}.uq-live,.uq-context-note{display:none}.uq-metrics{grid-template-columns:repeat(2,1fr);gap:12px 0}.uq-metric:nth-child(3){padding-left:0;border-left:0}.uq-toolbar{flex-wrap:wrap}.uq-search{flex-basis:100%}.uq-tool-select{flex:1;justify-content:space-between}.uq-body{display:block}.uq-detail{display:none}.uq-row{align-items:flex-start;flex-wrap:wrap}.uq-main{min-width:calc(100% - 55px)}.uq-wait{margin-left:49px}.uq-actions{margin-left:49px;opacity:1}.uq-footer{flex-wrap:wrap}.uq-footer button{margin-left:0}}
      `}</style>
      <section className="uq-shell" aria-label="Agent Workspace Queue">
        <header className="uq-header">
          <div className="uq-icon"><Headphones size={20} /></div>
          <div className="uq-copy"><p className="uq-kicker">NEXUS Pulse · agent workspace</p><h1>Queue</h1><p>Today, 04 Mar 2025 · active contact workload</p></div>
          <div className="uq-live"><i />{items.length ? "Queue live" : "Queue clear"}</div>
          <button className="uq-close" type="button" aria-label="Close queue proposal" onClick={() => setFeedback("Queue panel remains available from Agent Workspace")}><X size={17} /></button>
        </header>
        <div className="uq-context">
          <span className="uq-context-label">Mission / queue</span>
          <label className="uq-select"><SlidersHorizontal size={13} /><select value={queue} onChange={event => setQueue(event.target.value)} aria-label="Select mission or queue">{queueLabels.map(label => <option key={label}>{label}</option>)}</select><ChevronDown size={13} /></label>
          <span className="uq-context-note">Your workspace · Bratislava team · 3 agents available</span>
        </div>
        <section className="uq-metrics" aria-label="Queue summary">
          <div className="uq-metric"><strong>{counts.all}</strong><span>Waiting now</span></div>
          <div className="uq-metric alert"><strong>{counts.urgent}</strong><span>Urgent</span></div>
          <div className="uq-metric"><strong>04:12</strong><span>Average wait</span></div>
          <div className="uq-metric green"><strong>82%</strong><span>Within target</span></div>
        </section>
        <section className="uq-toolbar" aria-label="Queue search and sort">
          <label className="uq-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, phone, reason…" aria-label="Search queue" />{query && <button className="uq-close" type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={13} /></button>}</label>
          <label className="uq-tool-select"><ArrowDownUp size={14} /><select value={sort} onChange={event => setSort(event.target.value as "wait" | "newest")} aria-label="Sort queue"><option value="wait">Longest waiting</option><option value="newest">Newest first</option></select><ChevronDown size={13} /></label>
        </section>
        <div className="uq-filters" role="group" aria-label="Filter by priority">
          <span className="uq-label">Priority</span>
          {(["All", "Urgent", "High", "Standard"] as const).map(value => <button key={value} type="button" className={`uq-chip ${value === "Urgent" ? "alert" : ""} ${priority === value ? "active" : ""}`} onClick={() => setPriority(value)} aria-pressed={priority === value}>{value}<span className="uq-count">{value === "All" ? counts.all : items.filter(item => item.priority === value).length}</span></button>)}
        </div>
        <div className="uq-body">
          <section className="uq-list" aria-label="Waiting contacts">
            <div className="uq-list-head"><div className="uq-result">{visibleItems.length} waiting <span>· {sort === "wait" ? "longest waiting first" : "newest first"}</span></div><span className="uq-feedback" role="status">{feedback}</span></div>
            {visibleItems.length ? visibleItems.map(item => <article key={item.id} className={`uq-row ${selected === item.id ? "selected" : ""}`} onClick={() => setSelected(item.id)}>
              <div className={`uq-avatar ${item.priority === "Urgent" ? "urgent" : ""}`}>{item.channel === "call" ? <PhoneIncoming size={17} /> : item.initials}</div>
              <div className="uq-main"><div className="uq-top"><strong>{item.name}</strong><span className={`uq-badge ${item.priority.toLowerCase()}`}>{item.priority}</span></div><span className="uq-identity">{item.phone} · {item.queue}</span><span className="uq-contextline"><b>{item.mission}</b> · {item.reason}</span></div>
              <div className={`uq-wait ${item.priority === "Urgent" ? "urgent" : ""}`}><Clock3 size={12} />{item.wait} min</div>
              <div className="uq-actions"><button className="uq-button uq-primary" type="button" onClick={event => { event.stopPropagation(); complete(item.id); }}><PhoneCall size={12} />Take</button><button className="uq-button uq-secondary" type="button" onClick={event => { event.stopPropagation(); snooze(item.id); }}>Snooze</button></div>
            </article>) : <div className="uq-empty"><Check size={31} /><strong>No contacts match this view</strong><span>Try another queue, priority, or search term.</span></div>}
          </section>
          <aside className="uq-detail" aria-label="Selected contact details">
            <h2>Selected contact</h2><p className="uq-detail-sub">Next action at a glance</p>
            {selectedItem ? <><div className="uq-person"><div className="uq-person-avatar">{selectedItem.initials}</div><div><strong>{selectedItem.name}</strong><span>{selectedItem.phone}</span></div></div><div className="uq-detail-block"><div className="uq-detail-label">Mission</div><div className="uq-detail-value">{selectedItem.mission}<br />{selectedItem.queue}</div></div><div className="uq-detail-block"><div className="uq-detail-label">Contact reason</div><div className="uq-detail-value">{selectedItem.reason}</div></div><div className="uq-next"><Bell size={14} />Suggested next step: greet caller and confirm identity before opening the appointment record.</div><div className="uq-detail-actions"><button className="uq-button uq-primary" type="button" onClick={() => complete(selectedItem.id)}><PhoneCall size={12} />Take next</button><button className="uq-button uq-secondary" type="button" onClick={() => snooze(selectedItem.id)}>Snooze</button></div></> : <div className="uq-empty"><UsersRound size={26} /><span>Select a waiting contact</span></div>}
          </aside>
        </div>
        <footer className="uq-footer"><span><Clock3 size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />Target response time · 05:00</span><button type="button" onClick={takeNext}><UserRound size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />Take longest waiting</button><span>{feedback}</span></footer>
      </section>
    </main>
  );
}

export default QueueUnified;