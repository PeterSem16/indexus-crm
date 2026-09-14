import { useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, Check, Copy, Search, Save, ShieldCheck, X,
} from "lucide-react";
import "./_group.css";

type SortKey = "priority" | "name_asc" | "attempts_desc" | "callback_asc" | "created_desc";
type Segment = {
  id: string; name: string; detail: string; count: number; sort: SortKey;
};

const presets: Record<string, { label: string; segments: Segment[] }> = {
  referral: {
    label: "Referral first",
    segments: [
      { id: "referral", name: "Referral", detail: "First matching group wins", count: 12, sort: "priority" },
      { id: "today", name: "Scheduled today", detail: "First matching group wins", count: 1, sort: "callback_asc" },
      { id: "new", name: "New contacts", detail: "First matching group wins", count: 5, sort: "created_desc" },
    ],
  },
  callbacks: {
    label: "Today's callbacks",
    segments: [
      { id: "today", name: "Scheduled today", detail: "First matching group wins", count: 1, sort: "callback_asc" },
      { id: "referral", name: "Referral", detail: "First matching group wins", count: 12, sort: "priority" },
      { id: "new", name: "New contacts", detail: "First matching group wins", count: 5, sort: "created_desc" },
    ],
  },
  fresh: {
    label: "Fresh opportunities",
    segments: [
      { id: "new", name: "New contacts", detail: "First matching group wins", count: 5, sort: "created_desc" },
      { id: "referral", name: "Referral", detail: "First matching group wins", count: 12, sort: "priority" },
      { id: "today", name: "Scheduled today", detail: "First matching group wins", count: 1, sort: "callback_asc" },
    ],
  },
  recovery: {
    label: "Recovery desk",
    segments: [
      { id: "today", name: "Scheduled today", detail: "First matching group wins", count: 1, sort: "callback_asc" },
      { id: "new", name: "New contacts", detail: "First matching group wins", count: 5, sort: "created_desc" },
      { id: "referral", name: "Referral", detail: "First matching group wins", count: 12, sort: "priority" },
    ],
  },
};

const contacts = [
  ["Melichar SRO", "Referral", "09:00", "#1"],
  ["Tes AmbuMed Partner", "Referral", "09:20", "#1"],
  ["Tes Klinika Medifem X", "Referral", "09:40", "#1"],
  ["Tes Zdravotné centrum Iris", "Referral", "10:10", "#1"],
  ["Tes Centrum CarePoint", "Scheduled today", "11:00", "#2"],
  ["Tes Ambulancia Femina", "New contacts", "—", "#3"],
  ["Tes Ambulancia Medis", "New contacts", "—", "#3"],
  ["Tes Ambulancia Aurora", "New contacts", "—", "#3"],
];

const sortLabels: Record<SortKey, string> = {
  priority: "Priority",
  name_asc: "Name A–Z",
  attempts_desc: "Attempts high → low",
  callback_asc: "Callback soonest",
  created_desc: "Created newest",
};

export function PriorityBuilder() {
  const [preset, setPreset] = useState("referral");
  const [segments, setSegments] = useState(presets.referral.segments);
  const [selected, setSelected] = useState("referral");
  const [viewName, setViewName] = useState("Referral first");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(false);

  const total = useMemo(() => segments.reduce((sum, segment) => sum + segment.count, 0), [segments]);
  const visibleContacts = contacts.filter(([name]) => name.toLowerCase().includes(query.toLowerCase()));

  function choosePreset(id: string) {
    setPreset(id);
    setSegments(presets[id].segments.map(segment => ({ ...segment })));
    setViewName(presets[id].label);
    setSelected(presets[id].segments[0].id);
    setSaved(false);
  }
  function move(id: string, direction: -1 | 1) {
    setSegments(current => {
      const index = current.findIndex(segment => segment.id === id);
      const next = index + direction;
      if (next < 0 || next >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return copy;
    });
    setSaved(false);
  }
  function updateSort(id: string, sort: SortKey) {
    setSegments(current => current.map(segment => segment.id === id ? { ...segment, sort } : segment));
    setSaved(false);
  }
  function addSegment(kind: "mine" | "missed") {
    const segment = kind === "mine"
      ? { id: "mine", name: "My scheduled", detail: "Assigned to me", count: 9, sort: "callback_asc" as SortKey }
      : { id: "missed", name: "Unhandled / missed", detail: "No outcome recorded", count: 15, sort: "attempts_desc" as SortKey };
    if (segments.some(item => item.id === segment.id)) return;
    setSegments(current => [...current, segment]);
    setSaved(false);
  }

  return (
    <main className="contact-queue-preview">
      <style>{`
        .filter-stage{width:100%;height:100%;min-height:560px;display:grid;place-items:center;background:rgba(29,25,23,.74);font-family:"Open Sans",sans-serif;color:#292522;padding:26px}
        .filter-modal{width:min(880px,100%);height:min(532px,calc(100dvh - 36px));min-height:500px;background:#fff;border-radius:9px;box-shadow:0 22px 70px rgba(27,22,19,.35);display:flex;flex-direction:column;overflow:hidden}
        .filter-head{height:58px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid #e8e4e0}
        .filter-title{font-size:13px;font-weight:800;letter-spacing:-.01em}.filter-close{border:0;background:transparent;color:#827a74;cursor:pointer;padding:4px}.filter-close:hover{color:#292522}
        .filter-head-actions{display:flex;align-items:center;gap:12px}.filter-add{height:30px;min-width:130px;border:1px solid #e1ddd8;border-radius:6px;background:#fbfaf9;color:#7c746e;font:inherit;font-size:11px;padding:0 9px;outline-color:#bd4f58}
        .filter-content{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(270px,.8fr);min-height:0;flex:1}
        .filter-groups{padding:12px 14px 8px;overflow:auto}.filter-results{border-left:1px solid #ece8e4;background:#fbfaf9;padding:12px 11px;overflow:auto}
        .filter-group{border:1px solid #e6e2de;border-radius:8px;background:#fff;margin-bottom:7px;padding:10px 11px 8px;cursor:pointer}
        .filter-group:hover{border-color:#d6b3b4}.filter-group.selected{border-color:#d56269;box-shadow:0 0 0 1px #d5626940;background:#fffafa}
        .filter-row{display:flex;align-items:center;gap:8px}.filter-number{width:27px;height:27px;border-radius:50%;background:#fae4e4;color:#bf4e57;display:grid;place-items:center;font-size:11px;font-weight:800;flex:none}
        .filter-group-title{font-size:12px;font-weight:800;flex:1}.filter-group-detail{font-size:10px;color:#99908a;margin-top:2px}.filter-group-actions{display:flex;align-items:center;gap:4px;color:#a69c95}
        .filter-mini{border:0;background:transparent;border-radius:4px;padding:3px;color:inherit;cursor:pointer}.filter-mini:hover:not(:disabled){background:#f5eeee;color:#bd4f58}.filter-mini:disabled{opacity:.28;cursor:default}
        .filter-sort{display:flex;align-items:center;gap:8px;margin:8px 0 0 35px;font-size:10px;color:#958b84}.filter-sort select{height:25px;border:1px solid #e1dcd7;border-radius:5px;background:#fff;color:#766d66;font:inherit;font-size:10px;padding:0 8px;min-width:144px}
        .filter-note{height:27px;background:#f6f5f4;color:#8b837d;border-radius:5px;font-size:10px;display:flex;align-items:center;gap:6px;padding:0 9px;margin:9px 0}.filter-note svg{color:#c4545d}
        .filter-results-head{display:flex;align-items:center;justify-content:space-between;margin:0 1px 8px}.filter-results-head h2{font-size:13px;margin:0}.filter-total{font-size:12px;color:#c4535b;font-weight:800}.filter-results-tools{display:flex;gap:5px;margin-bottom:7px}.filter-results-tools select,.filter-search{height:29px;border:1px solid #e4ded8;border-radius:5px;background:#fff;color:#706963;font:inherit;font-size:10px;padding:0 7px}.filter-search{flex:1;display:flex;align-items:center;gap:5px}.filter-search input{border:0;outline:0;width:100%;font:inherit;color:#4e4742}.filter-contact{height:37px;display:flex;align-items:center;gap:8px;border:1px solid #ebe5e0;background:#fff;border-radius:5px;padding:0 8px;margin:5px 0}.filter-avatar{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#f8e3e4;color:#c1545c;font-size:10px;font-weight:800}.filter-contact-name{font-size:10px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}.filter-contact-meta{font-size:9px;color:#9a918b}.filter-contact-index{font-size:10px;color:#766b65}
        .filter-footer{height:53px;display:flex;align-items:center;gap:7px;border-top:1px solid #e8e3de;padding:0 14px}.filter-footer input{height:32px;border:1px solid #447bd0;border-radius:5px;padding:0 8px;font:inherit;font-size:11px;flex:1;outline:0;box-shadow:0 0 0 1px #c6daf7}.filter-footer button{height:32px;border:1px solid #e3ddd8;border-radius:5px;background:#fff;color:#716963;padding:0 10px;display:inline-flex;align-items:center;gap:5px;font:inherit;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap}.filter-footer button:hover{background:#faf5f3}.filter-footer .filter-save{background:#dd858b;border-color:#dd858b;color:#fff}.filter-footer .filter-save:hover{background:#ce6e76}.filter-status{font-size:10px;color:#958b84;white-space:nowrap}.filter-status.saved{color:#478c82}
        .filter-menu{position:absolute;top:41px;right:0;width:150px;background:#fff;border:1px solid #e1dbd6;border-radius:6px;box-shadow:0 8px 20px #3a2c2530;padding:4px;z-index:2}.filter-menu button{display:block;width:100%;text-align:left;border:0;background:#fff;padding:8px;border-radius:4px;font:inherit;font-size:10px;color:#625a55;cursor:pointer}.filter-menu button:hover{background:#f7eeee;color:#b74f57}
        @media(max-width:680px){.filter-stage{padding:8px}.filter-modal{height:calc(100dvh - 16px);min-height:0}.filter-content{grid-template-columns:1fr}.filter-results{display:none}.filter-footer{flex-wrap:wrap;height:auto;padding:9px}.filter-footer input{min-width:150px}.filter-status{width:100%}}
      `}</style>
      <section className="filter-stage">
        <section className="filter-modal" aria-label="Priority groups">
          <header className="filter-head">
            <strong className="filter-title">Priority groups</strong>
            <div className="filter-head-actions">
              <div style={{ position: "relative" }}>
                <select className="filter-add" value="" onChange={event => event.target.value && addSegment(event.target.value as "mine" | "missed")} aria-label="Add group">
                  <option value="">Add group</option>
                  <option value="mine">My scheduled</option>
                  <option value="missed">Unhandled / missed</option>
                </select>
              </div>
              <button className="filter-close" aria-label="Close"><X size={16} /></button>
            </div>
          </header>
          <div className="filter-content">
            <section className="filter-groups">
              {segments.map((segment, index) => (
                <article key={segment.id} className={`filter-group ${selected === segment.id ? "selected" : ""}`} onClick={() => setSelected(segment.id)} tabIndex={0} role="button">
                  <div className="filter-row">
                    <span className="filter-number">{index + 1}</span>
                    <div style={{ minWidth: 0, flex: 1 }}><div className="filter-group-title">{segment.name}{index === 0 && <ShieldCheck size={13} color="#c4525b" style={{ verticalAlign: "-2px", marginLeft: 5 }} />}</div><div className="filter-group-detail">{segment.detail}</div></div>
                    <div className="filter-group-actions">
                      <button className="filter-mini" onClick={event => { event.stopPropagation(); move(segment.id, -1); }} disabled={index === 0} aria-label="Move group up"><ArrowUp size={14} /></button>
                      <button className="filter-mini" onClick={event => { event.stopPropagation(); move(segment.id, 1); }} disabled={index === segments.length - 1} aria-label="Move group down"><ArrowDown size={14} /></button>
                    </div>
                  </div>
                  <div className="filter-sort"><span>Sort inside by</span><select value={segment.sort} onChange={event => updateSort(segment.id, event.target.value as SortKey)} onClick={event => event.stopPropagation()} aria-label={`Sort ${segment.name}`}>{Object.entries(sortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
                </article>
              ))}
              <div className="filter-note"><Check size={13} /> Contacts appear once, in their highest matching group.</div>
            </section>
            <aside className="filter-results">
              <div className="filter-results-head"><h2>Live results</h2><span className="filter-total">{total}</span></div>
              <div className="filter-results-tools"><select aria-label="Search field"><option>All fields</option><option>Name</option><option>Phone</option></select><label className="filter-search"><Search size={12} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search contacts" aria-label="Search contacts" /></label></div>
              {visibleContacts.map(([name, group, time, index]) => <div className="filter-contact" key={name}><span className="filter-avatar">{name.slice(0, 1)}</span><span className="filter-contact-name">{name}</span><span className="filter-contact-meta">{group} · {time}</span><span className="filter-contact-index">{index}</span></div>)}
            </aside>
          </div>
          <footer className="filter-footer">
            <select className="filter-add" style={{ minWidth: 145 }} value={preset} onChange={event => choosePreset(event.target.value)} aria-label="Saved view"><option value="referral">Referral first</option><option value="callbacks">Today's callbacks</option><option value="fresh">Fresh opportunities</option><option value="recovery">Recovery desk</option></select>
            <input value={viewName} onChange={event => { setViewName(event.target.value); setSaved(false); }} aria-label="Saved view name" />
            <button className="filter-save" onClick={() => setSaved(true)}><Save size={13} /> Save view</button>
            <button onClick={() => { setViewName(`${viewName} copy`); setSaved(false); }}><Copy size={13} /> Duplicate</button>
            <span className={`filter-status ${saved ? "saved" : ""}`}>{saved ? <><Check size={12} style={{ verticalAlign: "-2px" }} /> Saved to Contacts</> : "Unsaved changes"}</span>
          </footer>
        </section>
      </section>
    </main>
  );
}

export default PriorityBuilder;