import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  CircleHelp,
  GripVertical,
  ListFilter,
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

const defaultGroups: Group[] = [
  { id: "today", name: "Scheduled today", detail: "Callback window is due today", count: 7, color: "blue", sort: "callback" },
  { id: "urgent", name: "Urgent follow-up", detail: "Missed communication · no outcome", count: 4, color: "red", sort: "callback" },
  { id: "partner", name: "Medical partners", detail: "Partner queue · assigned to team", count: 12, color: "blue", sort: "priority" },
  { id: "new", name: "New contacts", detail: "Created in the last 24 hours", count: 9, color: "green", sort: "created" },
];

const contacts: Contact[] = [
  { id: 3, name: "Zdravotné centrum Iris", initials: "ZI", group: "Scheduled today", reason: "Confirm partnership appointment", time: "10:10", meta: "in 28 min", priority: "High" },
  { id: 5, name: "Lucia Horváthová", initials: "LH", group: "Scheduled today", reason: "Follow-up on results", time: "11:00", meta: "in 78 min", priority: "High" },
  { id: 1, name: "Ambulancia Medifem", initials: "AM", group: "Urgent follow-up", reason: "Missed call · queue timeout", time: "09:18", meta: "waiting 36 min", priority: "Urgent" },
  { id: 2, name: "Martin Kováč", initials: "MK", group: "Urgent follow-up", reason: "Callback requested after consultation", time: "09:42", meta: "due now", priority: "Urgent" },
  { id: 4, name: "Tes Klinika Medifem X", initials: "KM", group: "Medical partners", reason: "Referral · 2nd attempt", time: "10:35", meta: "attempt 2 of 3", priority: "High" },
  { id: 6, name: "Centrum CarePoint", initials: "CC", group: "New contacts", reason: "New partner enquiry", time: "—", meta: "created 08:47", priority: "Normal" },
  { id: 7, name: "Ambulancia Aurora", initials: "AA", group: "New contacts", reason: "Inbound contact · Bratislava", time: "—", meta: "created 08:31", priority: "Normal" },
];

const sortLabels: Record<SortKey, string> = {
  callback: "Callback soonest",
  priority: "Priority high → low",
  attempts: "Attempts high → low",
  created: "Created newest",
};

export function ContactOrderingScheduledFirst() {
  const [groups, setGroups] = useState(defaultGroups);
  const [selected, setSelected] = useState("today");
  const [query, setQuery] = useState("");
  const [preset, setPreset] = useState("Scheduled first");
  const [saved, setSaved] = useState(false);
  const [help, setHelp] = useState(false);
  const [feedback, setFeedback] = useState("");

  const orderedContacts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const visible = contacts.filter(item => !normalized || `${item.name} ${item.reason} ${item.group}`.toLocaleLowerCase().includes(normalized));
    return visible.sort((a, b) => groups.findIndex(group => group.name === a.group) - groups.findIndex(group => group.name === b.group));
  }, [groups, query]);

  function move(id: string, direction: -1 | 1) {
    setGroups(current => {
      const index = current.findIndex(group => group.id === id);
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSaved(false);
  }

  function loadPreset(name: string) {
    const ids = name === "Urgent first" ? ["urgent", "today", "partner", "new"] : name === "Fresh opportunities" ? ["new", "today", "urgent", "partner"] : ["today", "urgent", "partner", "new"];
    setGroups(ids.map(id => defaultGroups.find(group => group.id === id)!));
    setPreset(name);
    setSaved(false);
    setFeedback(`${name} loaded`);
  }

  return (
    <main className="scheduled-first">
      <style>{`
        .scheduled-first{--ink:#18314d;--muted:#69809a;--line:#dce8f2;--blue:#2d6fba;--soft:#edf5fb;--red:#bf5c4f;--red-soft:#fff1ed;--green:#3f826e;min-height:100dvh;padding:28px;display:grid;place-items:center;background:#eaf2f8;color:var(--ink);font-family:"Plus Jakarta Sans","Avenir Next",system-ui,sans-serif}
        .scheduled-first *{box-sizing:border-box}.sf-dialog{width:min(1160px,100%);min-height:min(780px,calc(100dvh - 56px));display:flex;flex-direction:column;overflow:hidden;background:#fbfdff;border:1px solid #caddeb;border-radius:18px;box-shadow:0 26px 70px rgba(28,67,103,.16)}
        .sf-header{display:flex;align-items:center;gap:13px;padding:20px 25px 18px;background:#f8fbfe;border-bottom:1px solid var(--line)}.sf-icon{width:42px;height:42px;display:grid;place-items:center;color:var(--blue);background:#e5f0fa;border:1px solid #c9deef;border-radius:13px}.sf-copy{min-width:0;flex:1}.sf-kicker{margin:0 0 3px;color:var(--blue);font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.sf-copy h1{margin:0;color:#173452;font-size:20px;letter-spacing:-.025em}.sf-copy p{margin:5px 0 0;color:var(--muted);font-size:11px}.sf-summary{display:flex;align-items:center;gap:7px;color:#365b77;font-size:11px;font-weight:800;white-space:nowrap}.sf-dot{width:7px;height:7px;background:var(--green);border-radius:50%}.sf-close{width:30px;height:30px;display:grid;place-items:center;color:#7690a6;background:transparent;border:0;border-radius:8px}.sf-metrics{display:grid;grid-template-columns:repeat(4,1fr);padding:13px 25px;background:#fff;border-bottom:1px solid var(--line)}.sf-metric{padding:0 15px;border-left:1px solid var(--line)}.sf-metric:first-child{padding-left:0;border-left:0}.sf-metric strong,.sf-metric span{display:block}.sf-metric strong{color:#294964;font-size:18px;letter-spacing:-.03em}.sf-metric:first-child strong{color:var(--blue)}.sf-metric.alert strong{color:var(--red)}.sf-metric.green strong{color:var(--green)}.sf-metric span{margin-top:3px;color:#8096a8;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em}
        .sf-toolbar{display:flex;align-items:center;gap:8px;padding:16px 25px 12px;background:#fff}.sf-search{min-width:190px;height:39px;display:flex;align-items:center;gap:8px;flex:1;padding:0 11px;color:#88a0b6;background:#fff;border:1px solid #c7d8e7;border-radius:11px}.sf-search:focus-within{border-color:#5a94ca;box-shadow:0 0 0 3px rgba(45,111,186,.12)}.sf-search input{width:100%;border:0;outline:0;color:var(--ink);font-size:12px}.sf-select,.sf-help{height:39px;display:inline-flex;align-items:center;gap:7px;padding:0 11px;color:#506b84;background:#fff;border:1px solid #c7d8e7;border-radius:11px;font-size:11px;font-weight:700}.sf-select select{max-width:150px;border:0;outline:0;color:inherit;background:transparent;font:inherit}.sf-help{cursor:pointer}.sf-help-copy{position:absolute;right:25px;top:92px;z-index:3;width:245px;padding:12px;background:#fff;border:1px solid #c8dbea;border-radius:10px;box-shadow:0 12px 26px rgba(31,75,111,.14);font-size:10px;line-height:1.5;color:#587188}.sf-help-copy strong{display:block;color:#294964;margin-bottom:4px}
        .sf-body{display:grid;grid-template-columns:minmax(390px,1.02fr) minmax(430px,1.28fr);min-height:0;flex:1}.sf-builder{padding:13px 18px 19px 25px;background:#fff;border-top:1px solid var(--line);overflow:auto}.sf-results{padding:13px 25px 19px 18px;background:#f7fbfe;border-top:1px solid var(--line);border-left:1px solid var(--line);overflow:auto}.sf-section-head,.sf-result-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:0 0 10px}.sf-section-head h2,.sf-result-head h2{margin:0;color:#294964;font-size:14px}.sf-section-head p,.sf-result-head p{margin:4px 0 0;color:#8299ac;font-size:10px}.sf-group{padding:12px;margin:8px 0;background:#fff;border:1px solid #dbe7f0;border-radius:11px;cursor:pointer}.sf-group.selected{border-color:#75a9d5;box-shadow:0 0 0 3px rgba(45,111,186,.09)}.sf-group-top{display:flex;align-items:center;gap:8px}.sf-rank{width:23px;height:23px;display:grid;place-items:center;border-radius:7px;background:#e4f0fa;color:var(--blue);font-size:11px;font-weight:800}.sf-rank.red{background:var(--red-soft);color:var(--red)}.sf-rank.green{background:#eaf6f1;color:var(--green)}.sf-group-copy{min-width:0;flex:1}.sf-group-copy strong,.sf-group-copy span{display:block}.sf-group-copy strong{color:#294964;font-size:12px}.sf-group-copy span{margin-top:3px;color:#8499aa;font-size:10px}.sf-count{padding:4px 7px;border-radius:6px;color:#567188;background:#f0f6fa;font-size:10px;font-weight:800}.sf-actions{display:flex;gap:3px}.sf-mini{width:24px;height:24px;display:grid;place-items:center;color:#7890a4;background:#f7fbfe;border:1px solid #d7e4ed;border-radius:6px;cursor:pointer}.sf-mini:disabled{opacity:.3;cursor:not-allowed}.sf-sort{display:flex;align-items:center;gap:8px;margin:10px 0 0 31px;color:#8b9dad;font-size:9px}.sf-sort select{flex:1;height:25px;padding:0 6px;color:#526d83;background:#f8fbfd;border:1px solid #dce8f1;border-radius:5px;font-size:9px}.sf-rule{display:flex;align-items:center;gap:6px;margin-top:13px;color:var(--green);font-size:10px}
        .sf-live{display:inline-flex;align-items:center;gap:6px;color:var(--green);font-size:10px;font-weight:800}.sf-live i{width:7px;height:7px;background:var(--green);border-radius:50%}.sf-result-tools{display:flex;align-items:center;gap:6px;margin:13px 0 8px;color:#8399aa;font-size:10px}.sf-result-tools span{margin-right:auto}.sf-result-tools button{padding:5px 8px;color:#6b8297;background:transparent;border:1px solid #d6e4ed;border-radius:6px;font-size:9px;cursor:pointer}.sf-result-tools button.active{color:var(--blue);background:#e9f3fb;border-color:#bdd7eb}.sf-contact{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid #e2edf4}.sf-avatar{width:31px;height:31px;display:grid;place-items:center;flex:none;border-radius:9px;color:#2d6fba;background:#e1effa;font-size:10px;font-weight:800}.sf-avatar.red{color:var(--red);background:var(--red-soft)}.sf-contact-copy{min-width:0;flex:1}.sf-contact-copy strong,.sf-contact-copy>span{display:block}.sf-contact-copy strong{color:#294964;font-size:11px}.sf-contact-copy strong em{font-style:normal;color:#93a7b6;margin-right:6px;font-size:10px}.sf-contact-copy>span{margin-top:3px;color:#8197a9;font-size:9px}.sf-badge{display:inline-block!important;width:max-content;margin-top:5px!important;padding:3px 5px;border-radius:5px;font-size:9px;font-weight:800}.sf-badge.red{color:var(--red);background:var(--red-soft)}.sf-badge.blue{color:var(--blue);background:var(--soft)}.sf-contact-meta{text-align:right}.sf-contact-meta strong,.sf-contact-meta span{display:block}.sf-contact-meta strong{color:#365b77;font-size:11px}.sf-contact-meta span{margin-top:3px;color:#8aa0b0;font-size:9px}.sf-footer{display:flex;align-items:center;gap:8px;padding:11px 25px;background:#fff;border-top:1px solid var(--line)}.sf-footer select,.sf-name{height:32px;padding:0 9px;border:1px solid #c7d8e7;border-radius:7px;color:#567188;background:#fff;font:inherit;font-size:10px}.sf-name{flex:1;min-width:120px}.sf-save,.sf-secondary{height:32px;display:inline-flex;align-items:center;gap:5px;padding:0 10px;border-radius:7px;font-size:10px;font-weight:800;cursor:pointer}.sf-save{color:#fff;background:var(--blue);border:1px solid var(--blue)}.sf-secondary{color:#567188;background:#fff;border:1px solid #cddde9}.sf-status{color:var(--green);font-size:10px;font-weight:800}.sf-status.unsaved{color:#9aa9b5;font-weight:600}
        @media(max-width:820px){.scheduled-first{padding:9px}.sf-dialog{min-height:calc(100dvh - 18px);border-radius:13px}.sf-header,.sf-toolbar,.sf-footer{padding-left:14px;padding-right:14px}.sf-metrics{padding-left:14px;padding-right:14px;grid-template-columns:repeat(2,1fr);gap:12px 0}.sf-metric:nth-child(3){padding-left:0;border-left:0}.sf-summary{display:none}.sf-toolbar{flex-wrap:wrap}.sf-search{flex-basis:100%}.sf-select{flex:1;justify-content:space-between}.sf-body{grid-template-columns:1fr}.sf-results{border-left:0;padding:13px 14px 19px}.sf-builder{padding:13px 14px 19px}.sf-footer{flex-wrap:wrap}.sf-footer select{flex:1}.sf-name{flex-basis:100%;order:5}.sf-status{width:100%}}
      `}</style>
      <section className="sf-dialog" aria-label="Contact ordering with scheduled contacts first">
        <header className="sf-header"><div className="sf-icon"><ListFilter size={20} /></div><div className="sf-copy"><p className="sf-kicker">NEXUS Pulse · queue controls</p><h1>Contact ordering</h1><p>Scheduled callbacks now lead the live queue · Bratislava team · 04 Mar 2025</p></div><div className="sf-summary"><span className="sf-dot" />Queue live · 32 contacts</div><button className="sf-close" type="button" aria-label="Close ordering preview"><X size={17} /></button></header>
        <section className="sf-metrics" aria-label="Ordering summary"><div className="sf-metric"><strong>7</strong><span>Scheduled today</span></div><div className="sf-metric alert"><strong>4</strong><span>Urgent follow-up</span></div><div className="sf-metric"><strong>32</strong><span>Contacts in queue</span></div><div className="sf-metric green"><strong>1.8m</strong><span>Last refreshed</span></div></section>
        <div className="sf-toolbar"><label className="sf-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search contacts, queues, reasons…" aria-label="Search live queue" /></label><label className="sf-select"><SlidersHorizontal size={14} /><select aria-label="Scope"><option>All queues</option><option>My queues</option><option>Medical partners</option></select><ChevronDown size={13} /></label><button className="sf-help" type="button" onClick={() => setHelp(value => !value)}><CircleHelp size={15} />How ordering works</button>{help && <div className="sf-help-copy"><strong>First match wins</strong>Scheduled today is now the first matching group. Urgent follow-up runs immediately after it; every contact appears once.</div>}</div>
        <div className="sf-body"><section className="sf-builder" aria-label="Priority groups"><div className="sf-section-head"><div><h2>Priority groups</h2><p>Live order · scheduled today comes first</p></div><ShieldCheck size={17} color="#3f826e" /></div>{groups.map((group, index) => <article key={group.id} className={`sf-group ${selected === group.id ? "selected" : ""}`} onClick={() => setSelected(group.id)}><div className="sf-group-top"><GripVertical size={14} color="#a1b4c2" /><span className={`sf-rank ${group.color}`}>{index + 1}</span><div className="sf-group-copy"><strong>{group.name}</strong><span>{group.detail}</span></div><span className="sf-count">{group.count}</span><div className="sf-actions"><button className="sf-mini" type="button" disabled={index === 0} onClick={event => { event.stopPropagation(); move(group.id, -1); }} aria-label={`Move ${group.name} up`}><ArrowUp size={14} /></button><button className="sf-mini" type="button" disabled={index === groups.length - 1} onClick={event => { event.stopPropagation(); move(group.id, 1); }} aria-label={`Move ${group.name} down`}><ArrowDown size={14} /></button></div></div><div className="sf-sort"><span>Sort inside by</span><select value={group.sort} onChange={event => { event.stopPropagation(); setGroups(current => current.map(item => item.id === group.id ? { ...item, sort: event.target.value as SortKey } : item)); setSaved(false); }} aria-label={`Sort ${group.name}`} >{Object.entries(sortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></article>)}<div className="sf-rule"><Check size={14} /> No duplicate contacts · first matching group always wins.</div></section>
          <section className="sf-results" aria-label="Live resulting queue"><div className="sf-result-head"><div><h2>Live resulting queue</h2><p>Preview of what agents will contact next</p></div><span className="sf-live"><i />Updating live</span></div><div className="sf-result-tools"><span>{orderedContacts.length} shown · ordered by group</span><button type="button" className={!query ? "active" : ""} onClick={() => setQuery("")}>All contacts</button><button type="button" className={query === "Urgent" ? "active" : ""} onClick={() => setQuery("Urgent")}>Urgent only</button></div>{orderedContacts.map((contact, index) => <article className="sf-contact" key={contact.id}><span className={`sf-avatar ${contact.priority === "Urgent" ? "red" : ""}`}>{contact.initials}</span><div className="sf-contact-copy"><strong><em>#{index + 1}</em>{contact.name}</strong><span>{contact.reason} · {contact.group}</span><span className={`sf-badge ${contact.priority === "Urgent" ? "red" : "blue"}`}>{contact.priority} priority</span></div><div className="sf-contact-meta"><strong>{contact.time}</strong><span>{contact.meta}</span></div></article>)}</section></div>
        <footer className="sf-footer"><select value={preset} onChange={event => loadPreset(event.target.value)} aria-label="Saved ordering preset"><option>Scheduled first</option><option>Urgent first</option><option>Fresh opportunities</option></select><input className="sf-name" defaultValue="Bratislava morning queue" aria-label="Ordering view name" onChange={() => setSaved(false)} /><button className="sf-save" type="button" onClick={() => { setSaved(true); setFeedback("Ordering saved for Contacts"); }}><Save size={13} />Save ordering</button><button className="sf-secondary" type="button" onClick={() => { setGroups(defaultGroups); setPreset("Scheduled first"); setSaved(false); setFeedback("Scheduled-first default restored"); }}><Sparkles size={13} />Restore default</button><span className={`sf-status ${saved ? "" : "unsaved"}`} role="status">{saved ? <><Check size={12} /> {feedback}</> : "Unsaved changes"}</span></footer>
      </section>
    </main>
  );
}

export default ContactOrderingScheduledFirst;