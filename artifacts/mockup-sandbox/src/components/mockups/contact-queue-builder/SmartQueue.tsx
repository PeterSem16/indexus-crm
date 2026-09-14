import { useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Clock3, Copy,
  GripVertical, ListFilter, Pencil, Plus, RotateCcw,
  Save, Search, Sparkles, Trash2, UserRound, Users, X,
} from "lucide-react";
import "./_group.css";

type Segment = {
  id: string;
  label: string;
  detail: string;
  count: number;
  sort: string;
  color: string;
  icon: "referral" | "clock" | "spark" | "user" | "team";
};

const sourceSegments: Segment[] = [
  { id: "referral", label: "Referral", detail: "marked as referral", count: 18, sort: "Priority first", color: "#7f5aa8", icon: "referral" },
  { id: "today", label: "Scheduled today", detail: "callback is due today", count: 24, sort: "Next callback · soonest", color: "#b5622e", icon: "clock" },
  { id: "new", label: "New contacts", detail: "never contacted", count: 31, sort: "Created · newest", color: "#347c78", icon: "spark" },
  { id: "mine", label: "My scheduled", detail: "assigned to me", count: 16, sort: "Next callback · soonest", color: "#55719b", icon: "user" },
  { id: "team", label: "Team scheduled", detail: "unassigned callbacks", count: 27, sort: "Next callback · soonest", color: "#8a725b", icon: "team" },
];

const contacts = [
  ["Melichar SRO — MUDr. Peter Seman", "Referral", "09:00", "18x"],
  ["AmbuMed Partner — MUDr. Martin Kabát", "Scheduled today", "09:30", "1x"],
  ["Klinika Medifem X — MUDr. Martin Kabát", "Scheduled today", "10:15", "—"],
  ["Zdravotné centrum Iris — MUDr. Martin Kabát", "New contacts", "new", "—"],
];

const iconFor = (kind: Segment["icon"]) => {
  if (kind === "clock") return Clock3;
  if (kind === "spark") return Sparkles;
  if (kind === "user") return UserRound;
  if (kind === "team") return Users;
  return Sparkles;
};

export function SmartQueue() {
  const [segments, setSegments] = useState(sourceSegments);
  const [selected, setSelected] = useState("today");
  const [activeView, setActiveView] = useState("Morning clinic run");
  const [savedViews, setSavedViews] = useState(["Morning clinic run", "Referral follow-up", "End-of-day recovery"]);
  const [viewMenu, setViewMenu] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");

  const total = useMemo(() => segments.reduce((sum, item) => sum + item.count, 0), [segments]);
  const move = (direction: -1 | 1) => {
    const index = segments.findIndex((item) => item.id === selected);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= segments.length) return;
    const next = [...segments];
    [next[index], next[target]] = [next[target], next[index]];
    setSegments(next);
  };
  const addSegment = () => {
    const extra: Segment = { id: `extra-${Date.now()}`, label: "Overdue contacts", detail: "callback has passed", count: 12, sort: "Last contact · oldest", color: "#a85a4c", icon: "clock" };
    setSegments((items) => [...items, extra]);
    setSelected(extra.id);
  };
  const selectView = (name: string) => { setActiveView(name); setViewMenu(false); };

  return (
    <main className="contact-queue-preview">
      <style>{`
        .smart-shell{max-width:1000px;min-height:680px;background:#fbfaf8;border-color:#ded8d1;font-family:"Open Sans",sans-serif;color:#302b27}
        .smart-header{height:72px;padding:0 22px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e5dfd8;background:#fff}
        .smart-brand,.header-actions,.view-button,.smart-footer,.footer-left,.footer-right,.preview-status,.preview-foot,.queue-toolbar,.preview-group-head,.contact-line{display:flex;align-items:center}
        .smart-brand{gap:11px}.smart-mark{display:grid;place-items:center;width:35px;height:35px;border-radius:10px;background:#b5622e;color:#fff}
        .eyebrow{margin:0;color:#9b8f85;font-size:9px;font-weight:700;letter-spacing:.13em}.eyebrow.warm{color:#b5622e}.eyebrow.teal{color:#347c78}
        h1,h2,p{margin:0}.smart-brand h1{font-size:17px;line-height:1.2}.header-actions{gap:10px}.view-picker{position:relative}.view-button{gap:8px;border:1px solid #ddd5cd;border-radius:9px;background:#fff;padding:8px 11px;font:inherit;font-size:11px;font-weight:700;color:#54483e;cursor:pointer}
        .live-dot{width:6px;height:6px;background:#347c78;border-radius:50%;box-shadow:0 0 0 3px #347c7820}.icon-button{display:grid;place-items:center;border:0;background:transparent;color:#8c8178;cursor:pointer;padding:7px}
        .view-menu{position:absolute;right:0;top:39px;width:205px;padding:7px;background:#fff;border:1px solid #e2dbd4;border-radius:11px;box-shadow:0 12px 30px #45352a24;z-index:3}.view-menu button{width:100%;display:flex;align-items:center;justify-content:space-between;padding:8px;border:0;background:transparent;text-align:left;font:inherit;font-size:11px;color:#51473f;border-radius:6px;cursor:pointer}.view-menu button:hover{background:#f3efeb}.menu-label{display:block;padding:4px 8px 7px;color:#a09388;font-size:9px;text-transform:uppercase;letter-spacing:.09em}.view-menu .menu-new{border-top:1px solid #eee8e2;margin-top:4px;padding-top:11px;color:#b5622e}
        .smart-body{display:grid;grid-template-columns:1.03fr .97fr;min-height:548px}.builder-panel{padding:24px 22px 18px;border-right:1px solid #e3ddd6}.preview-panel{padding:24px 22px;background:#f4f1ed}
        .panel-intro,.preview-head{display:flex;justify-content:space-between;gap:16px}.panel-intro h2,.preview-head h2{font-size:18px;margin-top:5px;letter-spacing:-.02em}.panel-intro p:not(.eyebrow){margin-top:6px;color:#897d73;font-size:11px}.step-count{font-family:monospace;font-size:14px;color:#b5622e}.step-count span{color:#cfc5bd}
        .intent-card{display:flex;align-items:center;gap:10px;margin:18px 0 20px;padding:11px 12px;border:1px solid #d8e5df;border-radius:12px;background:#eff6f3}.intent-icon{display:grid;place-items:center;width:29px;height:29px;border-radius:8px;background:#347c78;color:#fff}.intent-card div:nth-child(2){flex:1}.intent-card strong{display:block;font-size:11px}.intent-card span{display:block;margin-top:2px;color:#72867f;font-size:10px}.text-button{border:0;background:transparent;color:#347c78;font:inherit;font-size:10px;font-weight:700;white-space:nowrap;cursor:pointer}
        .queue-toolbar{justify-content:space-between;margin-bottom:8px}.queue-toolbar strong{font-size:12px}.small-muted{color:#9b9087;font-size:10px}.add-button{display:flex;align-items:center;gap:5px;border:0;background:transparent;color:#b5622e;font:inherit;font-size:10px;font-weight:700;cursor:pointer}
        .segment-list{display:grid;gap:6px}.segment-row{min-height:47px;display:flex;align-items:center;gap:7px;padding:5px 7px 5px 5px;border:1px solid #e5ded7;border-radius:10px;background:#fff;cursor:pointer;transition:transform .15s,box-shadow .15s,border-color .15s}.segment-row:hover,.segment-row:focus{border-color:#c6b2a4;box-shadow:0 3px 12px #47362a10;outline:0}.segment-row.selected{border-color:#b5622e;box-shadow:0 3px 12px #b5622e18}.grip{color:#c1b6ad}.segment-number{width:19px;color:#aea29a;font-family:monospace;font-size:9px}.segment-icon{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;flex:none}.segment-copy{flex:1;min-width:0}.segment-copy strong{display:block;font-size:11px;line-height:1.1}.segment-copy span{display:block;margin-top:3px;color:#9b8e84;font-size:9px}.segment-copy i{font-style:normal;color:#cec3ba}.sort-pill{padding:4px 7px;border-radius:6px;background:#f4f1ee;color:#7e7168;font-size:9px;white-space:nowrap}.row-actions{display:flex;gap:1px}.row-actions button{display:grid;place-items:center;width:21px;height:23px;border:0;background:transparent;color:#a39890;border-radius:5px;cursor:pointer}.row-actions button:hover{background:#f3eeea;color:#b5622e}.row-actions button:disabled{opacity:.25;cursor:not-allowed}
        .advanced-toggle{display:flex;align-items:center;gap:5px;width:100%;margin-top:12px;padding:8px 3px;border:0;background:transparent;color:#746960;font:inherit;text-align:left;font-size:10px;font-weight:700;cursor:pointer}.advanced-toggle span{margin-left:auto;color:#a39890;font-weight:400}.rotated{transform:rotate(90deg)}.advanced-box{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px;border-radius:9px;background:#f3efeb;font-size:10px}.advanced-box label{display:flex;flex-direction:column;gap:4px;color:#7c7066}.advanced-box select{border:1px solid #ddd4cc;border-radius:6px;padding:6px;background:#fff;color:#51483f;font:inherit}
        .preview-head{align-items:start}.preview-status{gap:7px;color:#71918b;font-size:9px}.preview-summary{margin-top:22px;padding-bottom:15px;border-bottom:1px solid #ded7d0}.preview-summary strong{font-size:24px;letter-spacing:-.04em}.preview-summary span{margin-left:7px;color:#988c83;font-size:10px}.summary-bar{display:flex;gap:2px;height:5px;margin-top:13px;overflow:hidden;border-radius:9px}.summary-bar span{min-width:4px}
        .preview-list{display:grid;gap:9px;margin-top:14px}.preview-group{padding:9px 10px;border:1px solid #e0d9d2;border-radius:10px;background:#fff}.preview-group-head{gap:7px}.preview-group-head strong{flex:1;font-size:11px}.preview-index{color:#b5622e;font-family:monospace;font-size:10px;font-weight:700}.count-badge{min-width:21px;padding:3px 6px;border-radius:10px;background:#f1e8e1;color:#a2572b;text-align:center;font-size:9px;font-weight:700}.contact-line{width:100%;gap:7px;margin-top:7px;padding:6px 5px;border:0;border-top:1px solid #f0ebe6;background:transparent;text-align:left;cursor:pointer}.contact-avatar{display:grid;place-items:center;width:23px;height:23px;border-radius:7px;background:#e7f0ed;color:#347c78;font-size:10px;font-weight:700}.contact-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#544940;font-size:10px}.contact-time{color:#b5622e;font-size:9px}.attempts{padding:3px 5px;border-radius:5px;background:#f5f0ec;color:#93857a;font:9px monospace}.collapsed-note{margin:9px 0 1px;color:#9c9188;font-size:9px}.preview-foot{gap:7px;margin-top:16px;padding:8px 9px;border:1px solid #ded6ce;border-radius:8px;background:#fff;color:#9d9086}.preview-foot input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:#554a42;font:inherit;font-size:10px}.preview-foot span{font-size:8px;white-space:nowrap}
        .smart-footer{justify-content:space-between;padding:12px 22px;border-top:1px solid #e3ddd6;background:#fff}.footer-left,.footer-right{gap:13px}.quiet-button{display:flex;align-items:center;gap:5px;border:0;background:transparent;color:#8a7e75;font:inherit;font-size:10px;cursor:pointer}.quiet-button:hover{color:#b5622e}.persist-note{display:flex;align-items:center;gap:5px;color:#988d84;font-size:9px}.cq-button.primary{display:flex;align-items:center;gap:7px;border-radius:8px;height:34px;padding:0 13px;border:0;background:#b5622e;color:#fff;font:inherit;font-size:11px;font-weight:700;cursor:pointer}
        @media(max-width:760px){.contact-queue-preview{padding:8px}.smart-body{grid-template-columns:1fr}.builder-panel{border-right:0}.preview-panel{border-top:1px solid #e3ddd6}.smart-shell{min-height:0}.sort-pill{display:none}.smart-footer{align-items:flex-start;gap:10px;flex-direction:column}.footer-right{width:100%;justify-content:space-between}}
      `}</style>
      <section className="cq-shell smart-shell" aria-label="Smart contact queue builder">
        <header className="smart-header">
          <div className="smart-brand">
            <div className="smart-mark"><ListFilter size={18} /></div>
            <div><p className="eyebrow">INDEXUS / MISSION</p><h1>Contact queue</h1></div>
          </div>
          <div className="header-actions">
            <div className="view-picker">
              <button className="view-button" onClick={() => setViewMenu(!viewMenu)} aria-expanded={viewMenu}>
                <span className="live-dot" /> {activeView} <ChevronDown size={14} />
              </button>
              {viewMenu && <div className="view-menu">
                <span className="menu-label">Saved views</span>
                {savedViews.map((view) => <button key={view} onClick={() => selectView(view)}>{view}{view === activeView && <Check size={14} />}</button>)}
                <button className="menu-new" onClick={() => { setSavedViews((v) => [...v, "Untitled queue"]); setActiveView("Untitled queue"); setViewMenu(false); }}><Plus size={14} /> New personal view</button>
              </div>}
            </div>
            <button className="icon-button" aria-label="Close"><X size={17} /></button>
          </div>
        </header>

        <div className="smart-body">
          <section className="builder-panel">
            <div className="panel-intro">
              <div><p className="eyebrow warm">DAILY WORKFLOW</p><h2>Build your call order</h2><p>Auto and Next will move through these groups from top to bottom.</p></div>
              <span className="step-count">1 <span>/</span> 2</span>
            </div>

            <div className="intent-card">
              <div className="intent-icon"><Sparkles size={16} /></div>
              <div><strong>Start with the most important work</strong><span>Referral first, then callbacks that are due today.</span></div>
              <button className="text-button" onClick={() => setSegments(sourceSegments)}>Use this order</button>
            </div>

            <div className="queue-toolbar">
              <div><strong>Queue groups</strong><span className="small-muted"> {segments.length} groups · {total} contacts</span></div>
              <button className="add-button" onClick={addSegment}><Plus size={14} /> Add group</button>
            </div>
            <div className="segment-list">
              {segments.map((segment, index) => {
                const Icon = iconFor(segment.icon);
                const isSelected = selected === segment.id;
                return <div key={segment.id} className={`segment-row ${isSelected ? "selected" : ""}`} onClick={() => setSelected(segment.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setSelected(segment.id)}>
                  <GripVertical size={15} className="grip" />
                  <span className="segment-number">{String(index + 1).padStart(2, "0")}</span>
                  <div className="segment-icon" style={{ background: `${segment.color}18`, color: segment.color }}><Icon size={15} /></div>
                  <div className="segment-copy"><strong>{segment.label}</strong><span>{segment.detail} <i>·</i> {segment.count} matches</span></div>
                  <span className="sort-pill">{segment.sort}</span>
                  <div className="row-actions">
                    <button onClick={(e) => { e.stopPropagation(); move(-1); }} disabled={index === 0} aria-label="Move group up"><ArrowUp size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); move(1); }} disabled={index === segments.length - 1} aria-label="Move group down"><ArrowDown size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); setSegments(segments.filter((item) => item.id !== segment.id)); }} aria-label={`Remove ${segment.label}`}><Trash2 size={14} /></button>
                  </div>
                </div>;
              })}
            </div>
            <button className="advanced-toggle" onClick={() => setAdvanced(!advanced)}><ChevronRight size={15} className={advanced ? "rotated" : ""} /> Advanced criteria <span>assignment, location, status, entity type</span></button>
            {advanced && <div className="advanced-box"><label>Include contacts matching <select><option>all groups above</option><option>any group above</option></select></label><label>Exclude disposition <select><option>Do not exclude</option><option>Completed</option><option>Not interested</option></select></label></div>}
          </section>

          <section className="preview-panel">
            <div className="preview-head"><div><p className="eyebrow teal">LIVE PREVIEW</p><h2>What Auto will do</h2></div><span className="preview-status"><span className="live-dot" /> updates instantly</span></div>
            <div className="preview-summary"><strong>{total} contacts</strong><span>across {segments.length} ordered groups</span><div className="summary-bar">{segments.map((s) => <span key={s.id} style={{ width: `${Math.max(7, (s.count / total) * 100)}%`, background: s.color }} />)}</div></div>
            <div className="preview-list">
              {segments.slice(0, 4).map((segment, i) => <div key={segment.id} className="preview-group">
                <div className="preview-group-head"><span className="preview-index">{i + 1}</span><strong>{segment.label}</strong><span className="count-badge">{segment.count}</span><ChevronDown size={14} /></div>
                {i < 2 && contacts.filter((contact) => contact[1] === segment.label || (i === 0 && contact[1] === "Referral")).filter((contact) => !search || contact[0].toLowerCase().includes(search.toLowerCase())).slice(0, 2).map((contact) => <button className="contact-line" key={contact[0]}><span className="contact-avatar">{contact[0].slice(0, 1)}</span><span className="contact-name">{contact[0]}</span><span className="contact-time">{contact[2]}</span><span className="attempts">{contact[3]}</span></button>)}
                {i === 2 && <p className="collapsed-note">29 more contacts · sorted by {segment.sort.toLowerCase()}</p>}
              </div>)}
            </div>
            <div className="preview-foot"><Search size={14} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Test the preview by searching…" /><span>search never changes saved order</span></div>
          </section>
        </div>

        <footer className="smart-footer">
          <div className="footer-left"><button className="quiet-button" onClick={() => { setSegments(sourceSegments); setSaved(false); }}><RotateCcw size={14} /> Reset order</button><button className="quiet-button" onClick={() => { setSavedViews((views) => views.includes(`${activeView} copy`) ? views : [...views, `${activeView} copy`]); setSaved(true); }}><Copy size={14} /> Duplicate view</button><button className="quiet-button" onClick={() => setActiveView(`${activeView} · edited`)}><Pencil size={14} /> Rename</button></div>
          <div className="footer-right"><span className="persist-note"><Save size={13} /> Saved per agent</span><button className="cq-button primary" onClick={() => setSaved(true)}>{saved ? <Check size={15} /> : <Save size={15} />} {saved ? "Saved to Contacts" : "Save view"}</button></div>
        </footer>
      </section>
    </main>
  );
}