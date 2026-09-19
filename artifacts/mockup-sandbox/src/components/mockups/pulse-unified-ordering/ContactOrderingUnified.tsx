import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  CircleHelp,
  GripVertical,
  ListFilter,
  LockKeyhole,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";

type SortKey = "callback" | "priority" | "attempts" | "created";
type Group = { id: string; name: string; detail: string; count: number; color: "red" | "blue" | "green"; sort: SortKey };
type Contact = { id: number; name: string; initials: string; group: string; reason: string; time: string; meta: string; priority: "Urgent" | "High" | "Normal" };

const initialGroups: Group[] = [
  { id: "urgent", name: "Urgent follow-up", detail: "Missed communication · no outcome", count: 4, color: "red", sort: "callback" },
  { id: "today", name: "Scheduled today", detail: "Callback window is due today", count: 7, color: "blue", sort: "callback" },
  { id: "partner", name: "Medical partners", detail: "Partner queue · assigned to team", count: 12, color: "blue", sort: "priority" },
  { id: "new", name: "New contacts", detail: "Created in the last 24 hours", count: 9, color: "green", sort: "created" },
];

const contacts: Contact[] = [
  { id: 1, name: "Ambulancia Medifem", initials: "AM", group: "Urgent follow-up", reason: "Missed call · queue timeout", time: "09:18", meta: "waiting 36 min", priority: "Urgent" },
  { id: 2, name: "Martin Kováč", initials: "MK", group: "Urgent follow-up", reason: "Callback requested after consultation", time: "09:42", meta: "due now", priority: "Urgent" },
  { id: 3, name: "Zdravotné centrum Iris", initials: "ZI", group: "Scheduled today", reason: "Confirm partnership appointment", time: "10:10", meta: "in 28 min", priority: "High" },
  { id: 4, name: "Tes Klinika Medifem X", initials: "KM", group: "Medical partners", reason: "Referral · 2nd attempt", time: "10:35", meta: "attempt 2 of 3", priority: "High" },
  { id: 5, name: "Lucia Horváthová", initials: "LH", group: "Scheduled today", reason: "Follow-up on results", time: "11:00", meta: "in 78 min", priority: "High" },
  { id: 6, name: "Centrum CarePoint", initials: "CC", group: "New contacts", reason: "New partner enquiry", time: "—", meta: "created 08:47", priority: "Normal" },
  { id: 7, name: "Ambulancia Aurora", initials: "AA", group: "New contacts", reason: "Inbound contact · Bratislava", time: "—", meta: "created 08:31", priority: "Normal" },
];

const sortLabels: Record<SortKey, string> = {
  callback: "Callback soonest",
  priority: "Priority high → low",
  attempts: "Attempts high → low",
  created: "Created newest",
};

export function ContactOrderingUnified() {
  const [groups, setGroups] = useState(initialGroups);
  const [selected, setSelected] = useState("urgent");
  const [preset, setPreset] = useState("Referral first");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  const visibleContacts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return contacts.filter(item => !normalized || `${item.name} ${item.reason} ${item.group}`.toLocaleLowerCase().includes(normalized));
  }, [query]);

  function move(id: string, direction: -1 | 1) {
    setGroups(current => {
      const index = current.findIndex(group => group.id === id);
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
    setSaved(false);
  }

  function updateSort(id: string, sort: SortKey) {
    setGroups(current => current.map(group => group.id === id ? { ...group, sort } : group));
    setSaved(false);
  }

  function loadPreset(name: string) {
    const order = name === "Callbacks first" ? ["today", "urgent", "partner", "new"] : name === "Fresh opportunities" ? ["new", "urgent", "today", "partner"] : ["urgent", "today", "partner", "new"];
    setGroups(order.map(id => initialGroups.find(group => group.id === id)!));
    setPreset(name);
    setSaved(false);
    setFeedback(`${name} loaded`);
  }

  return (
    <main className="pulse-order-stage">
      <style>{`
        .pulse-order-stage{--ink:#18314d;--muted:#69809a;--line:#dce8f2;--blue:#2d6fba;--blue-dark:#1c568f;--soft:#edf5fb;--red:#bf5c4f;--red-soft:#fff1ed;--green:#3f826e;--green-soft:#eaf6f1;min-height:100dvh;padding:28px;display:grid;place-items:center;background:#eaf2f8;color:var(--ink);font-family:"Plus Jakarta Sans","Avenir Next",system-ui,sans-serif}
        .pulse-order-stage *{box-sizing:border-box}.pulse-order-dialog{width:min(1160px,100%);min-height:min(780px,calc(100dvh - 56px));display:flex;flex-direction:column;overflow:hidden;background:#fbfdff;border:1px solid #caddeb;border-radius:18px;box-shadow:0 26px 70px rgba(28,67,103,.16)}
        .po-header{display:flex;align-items:center;gap:13px;padding:20px 25px 18px;background:#f8fbfe;border-bottom:1px solid var(--line)}.po-title-icon{width:42px;height:42px;display:grid;place-items:center;flex:none;color:var(--blue);background:#e5f0fa;border:1px solid #c9deef;border-radius:13px}.po-copy{min-width:0;flex:1}.po-kicker{margin:0 0 3px;color:var(--blue);font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.po-copy h1{margin:0;color:#173452;font-size:20px;letter-spacing:-.025em}.po-copy p{margin:5px 0 0;color:var(--muted);font-size:11px}.po-summary{display:flex;align-items:center;gap:7px;margin-right:12px;color:#365b77;font-size:11px;font-weight:800;white-space:nowrap}.po-dot{width:7px;height:7px;background:var(--green);border-radius:50%}.po-close{width:30px;height:30px;display:grid;place-items:center;color:#7690a6;background:transparent;border:0;border-radius:8px;cursor:pointer}.po-close:hover{background:var(--soft);color:var(--ink)}
        .po-metrics{display:grid;grid-template-columns:repeat(4,1fr);padding:13px 25px;background:#fff;border-bottom:1px solid var(--line)}.po-metric{padding:0 15px;border-left:1px solid var(--line)}.po-metric:first-child{padding-left:0;border-left:0}.po-metric strong,.po-metric span{display:block}.po-metric strong{color:#294964;font-size:18px;letter-spacing:-.03em}.po-metric span{margin-top:3px;color:#8096a8;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em}.po-metric.alert strong{color:var(--red)}.po-metric.green strong{color:var(--green)}
        .po-toolbar{display:flex;align-items:center;gap:8px;padding:16px 25px 12px;background:#fff}.po-search{min-width:190px;height:39px;display:flex;align-items:center;gap:8px;flex:1;padding:0 11px;color:#88a0b6;background:#fff;border:1px solid #c7d8e7;border-radius:11px}.po-search:focus-within{border-color:#5a94ca;box-shadow:0 0 0 3px rgba(45,111,186,.12)}.po-search input{width:100%;border:0;outline:0;color:var(--ink);font-size:12px}.po-select,.po-help{height:39px;display:inline-flex;align-items:center;gap:7px;padding:0 11px;color:#506b84;background:#fff;border:1px solid #c7d8e7;border-radius:11px;font-size:11px;font-weight:700}.po-select select{max-width:150px;border:0;outline:0;color:inherit;background:transparent;font:inherit;cursor:pointer}.po-help{cursor:pointer}.po-help:hover{background:var(--soft);color:var(--blue)}
        .po-body{display:grid;grid-template-columns:minmax(390px,1.02fr) minmax(430px,1.28fr);min-height:0;flex:1}.po-builder{padding:13px 18px 19px 25px;background:#fff;border-top:1px solid var(--line);overflow:auto}.po-results{padding:13px 25px 19px 18px;background:#f7fbfe;border-top:1px solid var(--line);border-left:1px solid var(--line);overflow:auto}.po-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:0 0 10px}.po-section-head h2{margin:0;color:#294964;font-size:14px}.po-section-head p{margin:4px 0 0;color:#8299ac;font-size:10px}.po-help-copy{position:absolute;right:25px;top:92px;z-index:5;width:240px;padding:12px;background:#fff;border:1px solid #c8dbea;border-radius:10px;box-shadow:0 12px 26px rgba(31,75,111,.14);font-size:10px;line-height:1.5;color:#587188}.po-help-copy strong{display:block;color:#294964;margin-bottom:4px}
        .po-group{margin:7px 0;padding:11px;border:1px solid #dce8f1;border-radius:12px;background:#fff;cursor:pointer;transition:border-color .15s,transform .15s}.po-group:hover{border-color:#a9c7df;transform:translateY(-1px)}.po-group.selected{border-color:#5a94ca;box-shadow:0 0 0 2px rgba(45,111,186,.1);background:#fbfdff}.po-group-top{display:flex;align-items:center;gap:9px}.po-rank{width:28px;height:28px;display:grid;place-items:center;flex:none;border-radius:9px;color:#2d6fba;background:#e8f3fb;font-size:11px;font-weight:800}.po-rank.red{color:var(--red);background:var(--red-soft)}.po-rank.green{color:var(--green);background:var(--green-soft)}.po-group-copy{min-width:0;flex:1}.po-group-copy strong{display:block;color:#23445f;font-size:12px}.po-group-copy span{display:block;margin-top:3px;color:#8298aa;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.po-count{color:#5b7890;font-size:10px;font-weight:800}.po-actions{display:flex;gap:2px}.po-mini{width:25px;height:25px;display:grid;place-items:center;border:0;border-radius:6px;color:#7b92a6;background:transparent;cursor:pointer}.po-mini:hover:not(:disabled){color:var(--blue);background:var(--soft)}.po-mini:disabled{opacity:.25;cursor:default}.po-sort{display:flex;align-items:center;gap:8px;margin:9px 0 0 37px;color:#8296a8;font-size:10px}.po-sort select{height:27px;flex:1;padding:0 8px;border:1px solid #d8e4ed;border-radius:7px;color:#567188;background:#fff;font:inherit;outline:0}.po-rule{display:flex;align-items:center;gap:7px;margin:12px 0 0;padding:9px;color:#57728a;background:#f4f8fb;border-radius:8px;font-size:10px}.po-rule svg{color:var(--green);flex:none}
        .po-result-head{display:flex;align-items:center;justify-content:space-between;margin:0 0 9px}.po-result-head h2{margin:0;color:#294964;font-size:14px}.po-live{display:flex;align-items:center;gap:5px;color:var(--green);font-size:10px;font-weight:800}.po-live i{width:6px;height:6px;background:var(--green);border-radius:50%}.po-result-tools{display:flex;align-items:center;gap:7px;margin-bottom:10px}.po-result-tools span{color:#8399ab;font-size:10px}.po-result-tools button{height:27px;padding:0 8px;color:#567188;background:#fff;border:1px solid #cddde9;border-radius:7px;font-size:10px;font-weight:700;cursor:pointer}.po-result-tools button.active{color:var(--blue);background:#edf5fb;border-color:#afd0e8}.po-contact{display:flex;align-items:center;gap:9px;margin:7px 0;padding:11px;background:#fff;border:1px solid #dce8f1;border-radius:12px;box-shadow:0 2px 7px rgba(25,66,103,.045)}.po-avatar{width:34px;height:34px;display:grid;place-items:center;flex:none;border-radius:10px;color:#2d6fba;background:#eaf3fb;font-size:10px;font-weight:800}.po-avatar.red{color:var(--red);background:var(--red-soft)}.po-contact-copy{min-width:0;flex:1}.po-contact-copy strong{display:block;color:#1d3d5a;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.po-contact-copy span{display:block;margin-top:4px;color:#7089a0;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.po-contact-meta{text-align:right;min-width:77px}.po-contact-meta strong,.po-contact-meta span{display:block}.po-contact-meta strong{color:#36556e;font-size:10px}.po-contact-meta span{margin-top:3px;color:#89a0b3;font-size:9px}.po-badge{display:inline-flex;margin-top:5px;padding:3px 5px;border-radius:5px;font-size:9px;font-weight:800}.po-badge.red{color:var(--red);background:var(--red-soft)}.po-badge.blue{color:var(--blue);background:var(--soft)}.po-empty{padding:40px;text-align:center;color:#8199ac;font-size:11px}
        .po-footer{display:flex;align-items:center;gap:8px;padding:11px 25px;background:#fff;border-top:1px solid var(--line)}.po-footer select,.po-name{height:32px;padding:0 9px;border:1px solid #c7d8e7;border-radius:7px;color:#567188;background:#fff;font:inherit;font-size:10px}.po-name{flex:1;min-width:120px}.po-save,.po-secondary{height:32px;display:inline-flex;align-items:center;gap:5px;padding:0 10px;border-radius:7px;font-size:10px;font-weight:800;cursor:pointer}.po-save{color:#fff;background:var(--blue);border:1px solid var(--blue)}.po-save:hover{background:var(--blue-dark)}.po-secondary{color:#567188;background:#fff;border:1px solid #cddde9}.po-status{color:var(--green);font-size:10px;font-weight:800}.po-status.unsaved{color:#9aa9b5;font-weight:600}
        @media(max-width:820px){.pulse-order-stage{padding:9px}.pulse-order-dialog{min-height:calc(100dvh - 18px);border-radius:13px}.po-header,.po-toolbar,.po-footer{padding-left:14px;padding-right:14px}.po-metrics{padding-left:14px;padding-right:14px;grid-template-columns:repeat(2,1fr);gap:12px 0}.po-metric:nth-child(3){padding-left:0;border-left:0}.po-summary{display:none}.po-toolbar{flex-wrap:wrap}.po-search{flex-basis:100%}.po-select{flex:1;justify-content:space-between}.po-body{grid-template-columns:1fr}.po-results{border-left:0;padding:13px 14px 19px}.po-builder{padding:13px 14px 19px}.po-footer{flex-wrap:wrap}.po-footer select{flex:1}.po-name{flex-basis:100%;order:5}.po-status{width:100%}}
      `}</style>
      <section className="pulse-order-dialog" aria-label="Contact ordering and priority management">
        <header className="po-header">
          <div className="po-title-icon"><ListFilter size={20} /></div>
          <div className="po-copy"><p className="po-kicker">NEXUS Pulse · queue controls</p><h1>Contact ordering</h1><p>Make the next best contact obvious · Bratislava team · 04 Mar 2025</p></div>
          <div className="po-summary"><span className="po-dot" />Queue live · 32 contacts</div>
          <button className="po-close" type="button" aria-label="Close ordering preview"><X size={17} /></button>
        </header>
        <section className="po-metrics" aria-label="Ordering summary">
          <div className="po-metric alert"><strong>4</strong><span>Urgent follow-up</span></div><div className="po-metric"><strong>7</strong><span>Due today</span></div><div className="po-metric"><strong>32</strong><span>Contacts in queue</span></div><div className="po-metric green"><strong>1.8m</strong><span>Last refreshed</span></div>
        </section>
        <div className="po-toolbar">
          <label className="po-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search contacts, queues, reasons…" aria-label="Search live queue" /></label>
          <label className="po-select"><SlidersHorizontal size={14} /><select aria-label="Scope"><option>All queues</option><option>My queues</option><option>Medical partners</option></select><ChevronDown size={13} /></label>
          <button className="po-help" type="button" onClick={() => setShowHelp(value => !value)} aria-label="Explain ordering"><CircleHelp size={15} />How ordering works</button>
          {showHelp && <div className="po-help-copy"><strong>First match wins</strong>Each contact appears once, in the highest-priority group it matches. Inside a group, the selected sort rule decides the order.</div>}
        </div>
        <div className="po-body">
          <section className="po-builder" aria-label="Priority groups">
            <div className="po-section-head"><div><h2>Priority groups</h2><p>Drag-free ordering for a high-trust queue</p></div><ShieldCheck size={17} color="#3f826e" /></div>
            {groups.map((group, index) => <article key={group.id} className={`po-group ${selected === group.id ? "selected" : ""}`} onClick={() => setSelected(group.id)} tabIndex={0} role="button">
              <div className="po-group-top"><GripVertical size={14} color="#a1b4c2" /><span className={`po-rank ${group.color}`}>{index + 1}</span><div className="po-group-copy"><strong>{group.name}</strong><span>{group.detail}</span></div><span className="po-count">{group.count}</span><div className="po-actions"><button className="po-mini" type="button" disabled={index === 0} onClick={event => { event.stopPropagation(); move(group.id, -1); }} aria-label={`Move ${group.name} up`}><ArrowUp size={14} /></button><button className="po-mini" type="button" disabled={index === groups.length - 1} onClick={event => { event.stopPropagation(); move(group.id, 1); }} aria-label={`Move ${group.name} down`}><ArrowDown size={14} /></button></div></div>
              <div className="po-sort"><span>Sort inside by</span><select value={group.sort} onChange={event => updateSort(group.id, event.target.value as SortKey)} onClick={event => event.stopPropagation()} aria-label={`Sort ${group.name}`}>{Object.entries(sortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
            </article>)}
            <div className="po-rule"><Check size={14} /> No duplicate contacts · the first matching group always wins.</div>
          </section>
          <section className="po-results" aria-label="Live resulting queue">
            <div className="po-result-head"><div><h2>Live resulting queue</h2><p style={{ margin: "4px 0 0", color: "#8299ac", fontSize: 10 }}>Preview of what agents will contact next</p></div><span className="po-live"><i />Updating live</span></div>
            <div className="po-result-tools"><span>{visibleContacts.length} shown · ordered by group</span><button type="button" className="active">All contacts</button><button type="button" onClick={() => setQuery("Urgent")}>Urgent only</button></div>
            {visibleContacts.length ? visibleContacts.map((contact, index) => <article className="po-contact" key={contact.id}><span className={`po-avatar ${contact.priority === "Urgent" ? "red" : ""}`}>{contact.initials}</span><div className="po-contact-copy"><strong><span style={{ display: "inline", color: "#93a7b6", margin: "0 6px 0 0", fontSize: 10 }}>#{index + 1}</span>{contact.name}</strong><span>{contact.reason} · {contact.group}</span><span className={`po-badge ${contact.priority === "Urgent" ? "red" : "blue"}`}>{contact.priority} priority</span></div><div className="po-contact-meta"><strong>{contact.time}</strong><span>{contact.meta}</span></div></article>) : <div className="po-empty"><Search size={28} /><div>No contacts match this search.</div></div>}
          </section>
        </div>
        <footer className="po-footer"><select value={preset} onChange={event => loadPreset(event.target.value)} aria-label="Saved ordering preset"><option>Referral first</option><option>Callbacks first</option><option>Fresh opportunities</option></select><input className="po-name" value="Bratislava morning queue" onChange={() => setSaved(false)} aria-label="Ordering view name" /><button className="po-save" type="button" onClick={() => { setSaved(true); setFeedback("Ordering saved for Contacts"); }}><Save size={13} />Save ordering</button><button className="po-secondary" type="button" onClick={() => { setGroups(initialGroups); setPreset("Referral first"); setSaved(false); setFeedback("Default ordering restored"); }}><Sparkles size={13} />Restore default</button><span className={`po-status ${saved ? "" : "unsaved"}`} role="status">{saved ? <><Check size={12} /> {feedback}</> : "Unsaved changes"}</span></footer>
      </section>
    </main>
  );
}

export default ContactOrderingUnified;