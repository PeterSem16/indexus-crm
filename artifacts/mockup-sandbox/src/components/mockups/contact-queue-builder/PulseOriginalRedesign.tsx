import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  PhoneCall,
  Search,
  SlidersHorizontal,
  Stethoscope,
  Users,
  X,
} from "lucide-react";

type Contact = {
  name: string;
  phone: string;
  date: string;
  attempts?: string;
};

const contacts: Contact[] = [
  { name: "Melichar SRO — MUDr. Peter Seman", phone: "+421 948 519 438", date: "18.09.2026 09:00", attempts: "18×" },
  { name: "Tes AmbuMed Partner — MUDr. Martin Kabát", phone: "+421 915 796 900", date: "16.09.2026 09:00", attempts: "1×" },
  { name: "Tes Klinika Medifem X — MUDr. Martin Kabát", phone: "+421 905 773 403", date: "07.09.2026 09:00" },
  { name: "Tes Zdravotné centrum Iris — MUDr. Martin Kabát", phone: "+421 915 796 900", date: "10.10.2026 09:00", attempts: "9×" },
];

const filters = ["All", "Due now", "My scheduled", "Team scheduled", "Unhandled", "Referral"];
const fieldOptions = ["All fields", "Name", "Phone", "Email", "City", "Address", "ZIP", "Region", "District", "Country", "IČO"];
const sortOptions = ["Name (A–Z)", "Callback soonest", "Attempts high → low"];

export function PulseOriginalRedesign() {
  const [activeFilter, setActiveFilter] = useState("Referral");
  const [query, setQuery] = useState("");
  const [field, setField] = useState("All fields");
  const [sort, setSort] = useState("Name (A–Z)");
  const [fieldOpen, setFieldOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [notice, setNotice] = useState("");

  const visibleContacts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return contacts
      .filter((contact) => !normalized || `${contact.name} ${contact.phone}`.toLocaleLowerCase().includes(normalized))
      .sort((a, b) => {
        if (sort === "Attempts high → low") return Number(b.attempts?.replace("×", "") || 0) - Number(a.attempts?.replace("×", "") || 0);
        if (sort === "Callback soonest") return a.date.localeCompare(b.date);
        return a.name.localeCompare(b.name);
      });
  }, [query, sort]);

  function chooseFilter(value: string) {
    setActiveFilter(value);
    setNotice(`${value} contacts selected`);
  }

  return (
    <main className="porq-stage">
      <style>{`
        .porq-stage{--ink:#18314d;--muted:#71879b;--line:#d7e5ee;--surface:#fbfdff;--soft:#eef5f8;--teal:#197f84;--teal-dark:#12676d;--teal-soft:#e3f3f1;--violet:#6872c9;--violet-soft:#eff0ff;min-height:100dvh;padding:28px;display:grid;place-items:center;background:#eaf2f7;color:var(--ink);font-family:"Plus Jakarta Sans","Avenir Next",system-ui,sans-serif}.porq-stage *{box-sizing:border-box}.porq-window{width:min(980px,100%);min-height:min(650px,calc(100dvh - 56px));display:flex;flex-direction:column;overflow:hidden;background:var(--surface);border:1px solid #c7dbe7;border-radius:18px;box-shadow:0 24px 65px rgba(28,67,103,.16)}.porq-top{display:flex;align-items:center;gap:13px;padding:19px 24px;background:#f8fbfd;border-bottom:1px solid var(--line)}.porq-mark{width:42px;height:42px;display:grid;place-items:center;flex:none;color:var(--teal);background:var(--teal-soft);border:1px solid #c8e5e2;border-radius:13px}.porq-top h1{margin:0;color:#173452;font-size:19px;line-height:1.2;letter-spacing:-.025em}.porq-top p{margin:5px 0 0;color:var(--muted);font-size:10px}.porq-close{width:30px;height:30px;display:grid;place-items:center;margin-left:auto;color:#7890a4;background:transparent;border:0;border-radius:8px;cursor:pointer}.porq-close:hover{color:var(--ink);background:var(--soft)}.porq-tools{padding:14px 24px 12px;background:#fff;border-bottom:1px solid var(--line)}.porq-searchrow{display:flex;gap:8px}.porq-search{height:38px;display:flex;align-items:center;gap:8px;min-width:0;flex:1;padding:0 11px;color:#8aa0b1;border:1px solid #c7d9e5;border-radius:10px;background:#fff}.porq-search:focus-within{border-color:#55a5a2;box-shadow:0 0 0 3px rgba(25,127,132,.11)}.porq-search input{width:100%;min-width:0;color:var(--ink);background:transparent;border:0;outline:0;font-size:11px}.porq-search input::placeholder{color:#8ba0b1}.porq-icon{width:30px;height:30px;display:grid;place-items:center;color:#658197;background:transparent;border:0;border-radius:8px;cursor:pointer}.porq-icon:hover{color:var(--teal);background:var(--teal-soft)}.porq-relative{position:relative}.porq-btn{height:38px;display:inline-flex;align-items:center;gap:7px;padding:0 11px;color:#48677f;background:#fff;border:1px solid #c7d9e5;border-radius:10px;font-size:10px;font-weight:800;white-space:nowrap;cursor:pointer}.porq-btn:hover,.porq-btn.active{color:var(--teal-dark);border-color:#8bc6c4;background:#f1fbfa}.porq-popover{position:absolute;z-index:5;top:44px;right:0;width:174px;padding:6px;background:#fff;border:1px solid #c7dce7;border-radius:10px;box-shadow:0 12px 28px rgba(28,67,103,.16)}.porq-popover label{display:flex;align-items:center;gap:8px;padding:8px 9px;color:#496980;border-radius:7px;font-size:10px;cursor:pointer}.porq-popover label:hover{background:var(--soft)}.porq-popover input{accent-color:var(--teal)}.porq-tabs{display:flex;flex-wrap:wrap;gap:7px;margin-top:11px}.porq-tab{height:28px;display:inline-flex;align-items:center;gap:6px;padding:0 10px;color:#5e7890;background:#eef4f7;border:1px solid transparent;border-radius:8px;font-size:10px;font-weight:800;cursor:pointer}.porq-tab:hover{border-color:#afd4d3;color:var(--teal-dark)}.porq-tab.active{color:#fff;background:var(--teal);box-shadow:0 4px 10px rgba(25,127,132,.2)}.porq-tab em{min-width:16px;padding:2px 4px;color:#6a8499;background:#dce9ee;border-radius:5px;font-size:9px;font-style:normal;text-align:center}.porq-tab.active em{color:#eaffff;background:rgba(255,255,255,.2)}.porq-body{flex:1;min-height:0;padding:17px 24px 21px;background:#f7fbfd;overflow:auto}.porq-summary{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.porq-summary h2{margin:0;color:#2b526a;font-size:12px}.porq-summary span{color:#8aa0b0;font-size:9px;font-weight:800;letter-spacing:.08em}.porq-group{margin:8px 0;border:1px solid #c7dce6;border-radius:13px;background:#fff;overflow:hidden}.porq-grouphead{width:100%;display:flex;align-items:center;gap:10px;padding:11px 13px;color:var(--ink);background:#f8fcfd;border:0;text-align:left;cursor:pointer}.porq-grouphead:hover{background:#eef8f8}.porq-groupicon{width:35px;height:35px;display:grid;place-items:center;flex:none;color:#fff;background:var(--violet);border-radius:10px}.porq-grouphead>span:nth-child(2){min-width:0;flex:1}.porq-grouphead strong,.porq-grouphead small{display:block}.porq-grouphead strong{font-size:11px}.porq-grouphead small{margin-top:3px;color:#8198a9;font-size:9px}.porq-count{min-width:27px;padding:7px 6px;color:#fff;background:var(--violet);border-radius:999px;font-size:10px;text-align:center}.porq-grouphead>svg{color:var(--violet)}.porq-list{display:grid;gap:7px;padding:8px;border-top:1px solid #e0ebf0}.porq-card{display:flex;align-items:center;gap:10px;padding:10px 11px;border:1px solid #dfebf0;border-radius:10px;background:#fff;transition:transform .15s,border-color .15s;cursor:pointer}.porq-card:hover{border-color:#9bc8c8;transform:translateY(-1px)}.porq-avatar{width:31px;height:31px;display:grid;place-items:center;flex:none;color:var(--teal);background:var(--teal-soft);border-radius:9px;font-size:9px;font-weight:800}.porq-card>div:nth-child(2){min-width:0;flex:1}.porq-card strong,.porq-card span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.porq-card strong{color:#294b63;font-size:10px}.porq-card div:nth-child(2) span{margin-top:3px;color:#7d94a5;font-size:9px}.porq-meta{display:flex;align-items:center;gap:5px;min-width:128px;color:#617e98;font-size:9px}.porq-meta svg{color:var(--teal)}.porq-city{min-width:75px;color:#7d94a5;font-size:9px}.porq-chip{display:inline-block!important;width:max-content;margin-top:4px!important;padding:3px 6px;color:var(--violet)!important;background:var(--violet-soft);border-radius:5px;font-size:8px!important;font-weight:800}.porq-footer{display:flex;justify-content:flex-end;padding:10px 24px;color:#8097a8;border-top:1px solid var(--line);background:#fff;font-size:9px}@media(max-width:700px){.porq-stage{padding:8px;align-items:start}.porq-window{min-height:calc(100dvh - 16px);border-radius:13px}.porq-top,.porq-tools,.porq-body{padding-left:13px;padding-right:13px}.porq-searchrow{flex-wrap:wrap}.porq-search{flex-basis:100%}.porq-btn{flex:1;justify-content:center}.porq-card{align-items:flex-start;flex-wrap:wrap}.porq-card>div:nth-child(2){min-width:calc(100% - 50px)}.porq-meta{margin-left:41px}.porq-city{margin-left:auto}.porq-footer{padding-left:13px;padding-right:13px}}
      `}</style>
      <section className="porq-window" aria-label="Mission contacts">
        <header className="porq-top">
          <div className="porq-mark"><Users size={20} /></div>
          <div><h1>Mission contacts</h1><p>Medical Partner Cooperation</p></div>
          <button className="porq-close" type="button" aria-label="Close queue" onClick={() => setNotice("Queue remains available from Agent Workspace")}><X size={17} /></button>
        </header>
        <div className="porq-tools">
          <div className="porq-searchrow">
            <label className="porq-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hľadať meno, telefón, email, mesto…" aria-label="Search contacts" />{query && <button className="porq-icon" type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={13} /></button>}</label>
            <div className="porq-relative"><button className={`porq-btn ${fieldOpen ? "active" : ""}`} type="button" onClick={() => { setFieldOpen((value) => !value); setSortOpen(false); }}><SlidersHorizontal size={14} />{field}<ChevronDown size={13} /></button>{fieldOpen && <div className="porq-popover" role="menu">{fieldOptions.map((option) => <label key={option}><input type="radio" checked={field === option} onChange={() => { setField(option); setFieldOpen(false); }} />{option}</label>)}</div>}</div>
            <div className="porq-relative"><button className={`porq-btn ${sortOpen ? "active" : ""}`} type="button" onClick={() => { setSortOpen((value) => !value); setFieldOpen(false); }}><ArrowUpDown size={14} />{sort}<ChevronDown size={13} /></button>{sortOpen && <div className="porq-popover" role="menu">{sortOptions.map((option) => <label key={option}><input type="radio" checked={sort === option} onChange={() => { setSort(option); setSortOpen(false); }} />{option}</label>)}</div>}</div>
          </div>
          <nav className="porq-tabs" aria-label="Queue filters">{filters.map((filter) => <button className={`porq-tab ${activeFilter === filter ? "active" : ""}`} type="button" key={filter} onClick={() => chooseFilter(filter)}>{filter}<em>{filter === "All" ? contacts.length : filter === "Referral" ? contacts.length : 0}</em></button>)}</nav>
        </div>
        <div className="porq-body">
          <div className="porq-summary"><h2>{query ? `Výsledky pre „${query}“` : "Referral contacts"}</h2><span>{visibleContacts.length} MATCHED</span></div>
          {visibleContacts.length ? <section className="porq-group">
            <button className="porq-grouphead" type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}><span className="porq-groupicon"><Stethoscope size={16} /></span><span><strong>Referral</strong><small>{visibleContacts.length} contacts</small></span><b className="porq-count">{visibleContacts.length}</b>{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
            {expanded && <div className="porq-list">{visibleContacts.map((contact) => <article className="porq-card" key={contact.name} onClick={() => setNotice(`${contact.name} selected`)}>
              <div className="porq-avatar">{contact.name.split(" ").slice(0, 2).map((part) => part[0]).join("")}</div>
              <div><strong>{contact.name}</strong><span>{contact.phone}</span></div>
              <div className="porq-meta"><CalendarClock size={12} />{contact.date}</div>
              <div className="porq-city">{contact.attempts && <span className="porq-chip">{contact.attempts} attempts</span>}</div>
              <button className="porq-icon" type="button" aria-label={`Call ${contact.name}`} onClick={(event) => { event.stopPropagation(); setNotice(`Calling ${contact.name}`); }}><PhoneCall size={15} /></button>
            </article>)}</div>}
          </section> : <div className="porq-group" style={{ padding: 36, textAlign: "center", color: "#7890a4", fontSize: 11 }}><Search size={23} /><strong style={{ display: "block", marginTop: 8, color: "#31556c" }}>No contacts found</strong><span>Try another search term.</span></div>}
        </div>
        <footer className="porq-footer" role="status">{notice || "Queue synced just now"}</footer>
      </section>
    </main>
  );
}

export default PulseOriginalRedesign;