import { useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Copy, GripVertical,
  ListFilter, MoreHorizontal, Pencil, PhoneCall, Plus, RotateCcw, Save,
  Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles,
  Users, X,
} from "lucide-react";
import "./_group.css";

type SortKey = "priority" | "name_asc" | "attempts_desc" | "callback_asc" | "created_desc" | "streak_desc";
type Segment = { id: string; name: string; detail: string; icon: string; color: string; count: number; sort: SortKey; };

const initialSegments: Segment[] = [
  { id: "referral", name: "Referral", detail: "Has referral source", icon: "R", color: "#7860b8", count: 12, sort: "priority" },
  { id: "today", name: "Scheduled today", detail: "Callback due 19 Sep", icon: "T", color: "#b5622e", count: 18, sort: "callback_asc" },
  { id: "new", name: "New contacts", detail: "Never contacted", icon: "N", color: "#337e7b", count: 24, sort: "created_desc" },
  { id: "mine", name: "My scheduled", detail: "Assigned to me", icon: "M", color: "#4c6d96", count: 9, sort: "callback_asc" },
  { id: "unhandled", name: "Unhandled / missed", detail: "No outcome recorded", icon: "U", color: "#a16e47", count: 15, sort: "streak_desc" },
];

const pool = [
  ["Melichar SRO — MUDr. Peter Seman", "Referral", "09:00", "3 attempts"],
  ["Tes AmbuMed Partner — MUDr. Martin Kabát", "Scheduled today", "09:20", "1 attempt"],
  ["Kardiologické centrum Nitra — MUDr. Eva Horváthová", "Scheduled today", "09:40", "4 attempts"],
  ["Zdravotné centrum Iris — MUDr. Martin Kabát", "New contacts", "—", "never called"],
];

const sortLabels: Record<SortKey, string> = {
  priority: "Priority",
  name_asc: "Name A–Z",
  attempts_desc: "Attempts high → low",
  callback_asc: "Callback soonest",
  created_desc: "Created newest",
  streak_desc: "Unanswered streak",
};

export function PriorityBuilder() {
  const [segments, setSegments] = useState(initialSegments);
  const [selected, setSelected] = useState("referral");
  const [viewName, setViewName] = useState("Morning pulse");
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activePreset, setActivePreset] = useState("Morning pulse");

  const total = useMemo(() => segments.reduce((sum, s) => sum + s.count, 0), [segments]);
  const visibleContacts = pool.filter(([name]) => name.toLowerCase().includes(query.toLowerCase()));

  function move(id: string, direction: -1 | 1) {
    setSegments(current => {
      const index = current.findIndex(s => s.id === id);
      const next = index + direction;
      if (next < 0 || next >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return copy;
    });
  }
  function updateSort(id: string, sort: SortKey) {
    setSegments(current => current.map(s => s.id === id ? { ...s, sort } : s));
  }
  function saveView() {
    setSaved(true);
    setActivePreset(viewName || "Morning pulse");
    window.localStorage.setItem("indexus-contact-view", viewName || "Morning pulse");
  }

  return (
    <main className="contact-queue-preview">
      <style>{`
        .pb-app{width:min(100%,1080px);height:min(680px,calc(100dvh - 32px));min-height:590px;background:#fbfaf8;border:1px solid #ded8d1;border-radius:20px;box-shadow:0 25px 75px rgba(65,47,35,.18);display:flex;overflow:hidden;color:#28231f;font-family:"Open Sans",sans-serif}
        .pb-main{flex:1;min-width:0;display:flex;flex-direction:column}.pb-top{padding:16px 21px 13px;border-bottom:1px solid #e6e0da;background:#fff;display:flex;align-items:center;gap:12px}.pb-kicker{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#9b897b;font-weight:700}.pb-title{font-size:18px;margin:2px 0 0;font-weight:700;letter-spacing:-.02em}.pb-muted{color:#897b70}.pb-toolbar{padding:12px 21px;background:#fff;border-bottom:1px solid #e6e0da;display:flex;gap:8px;align-items:center}.pb-search{height:34px;border:1px solid #dcd5ce;border-radius:9px;display:flex;align-items:center;gap:8px;padding:0 10px;flex:1;min-width:90px;color:#9a8e85}.pb-search input{border:0;outline:0;background:transparent;width:100%;font:inherit;font-size:12px;color:#342e29}.pb-btn{height:34px;border:1px solid #d9d1ca;border-radius:9px;background:#fff;padding:0 10px;display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:11px;font-weight:700;color:#594e46;cursor:pointer;white-space:nowrap}.pb-btn:hover{background:#f7f2ee}.pb-btn.primary{background:#b5622e;color:#fff;border-color:#b5622e}.pb-body{display:grid;grid-template-columns:minmax(360px,1.15fr) minmax(290px,.85fr);gap:0;min-height:0;flex:1}.pb-builder{padding:16px 20px;overflow:auto}.pb-preview{border-left:1px solid #e5ded7;background:#f5f1ed;padding:15px 17px;overflow:auto}.pb-sectionhead{display:flex;justify-content:space-between;align-items:end;margin-bottom:9px}.pb-sectionhead h2{font-size:13px;margin:0}.pb-sectionhead p{font-size:11px;margin:3px 0 0;color:#988b81}.pb-total{font-size:11px;color:#74675e;background:#eee7e1;border-radius:20px;padding:5px 8px;font-weight:700}.pb-row{border:1px solid #ddd5ce;border-radius:12px;background:#fff;margin:8px 0;display:grid;grid-template-columns:25px 27px minmax(110px,1fr) auto;align-items:center;gap:8px;padding:9px 10px;box-shadow:0 1px 2px rgba(56,40,30,.03);cursor:pointer}.pb-row.is-selected{border-color:#b5622e;box-shadow:0 0 0 2px #b5622e1c}.pb-row:hover{border-color:#c4a48e}.pb-drag{color:#b2a69d;cursor:grab}.pb-number{width:25px;height:25px;border-radius:8px;background:#f0eae4;display:grid;place-items:center;font-size:11px;font-weight:800;color:#765d4b}.pb-dot{width:27px;height:27px;color:#fff;border-radius:8px;display:grid;place-items:center;font-size:11px;font-weight:800}.pb-rowname{font-size:12px;font-weight:800;display:flex;align-items:center;gap:5px}.pb-detail{font-size:10px;color:#9a8c82;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pb-count{font-size:11px;font-weight:800;color:#765d4b;background:#f5eee9;border-radius:14px;padding:5px 7px}.pb-actions{grid-column:3 / -1;display:flex;align-items:center;gap:6px;border-top:1px solid #eee9e5;padding-top:8px;margin-top:2px}.pb-actions select{border:1px solid #dfd8d1;border-radius:7px;background:#fbfaf8;color:#5b5048;font:inherit;font-size:10px;padding:5px 7px;outline-color:#b5622e}.pb-mini{border:0;background:transparent;color:#96887d;padding:4px;cursor:pointer;border-radius:5px}.pb-mini:hover{background:#f2ebe5;color:#b5622e}.pb-add{width:100%;height:34px;border:1px dashed #c9b5a6;color:#9b694a;background:#fffaf7;border-radius:10px;font:inherit;font-size:11px;font-weight:700;cursor:pointer}.pb-rule{padding:11px 12px;border:1px solid #e3dbd4;border-radius:11px;background:#fff;margin-bottom:11px}.pb-ruletop{display:flex;align-items:center;gap:8px}.pb-ruletop strong{font-size:12px}.pb-rulecopy{font-size:10px;color:#8b7e74;line-height:1.45;margin:5px 0 0 25px}.pb-previewhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.pb-preview h2{font-size:13px;margin:0}.pb-impact{padding:10px 11px;border-radius:11px;background:#e5f0ee;border:1px solid #bbd7d3;color:#326965;font-size:11px;margin-bottom:12px;display:flex;gap:8px;align-items:flex-start}.pb-card{background:#fff;border:1px solid #e4ddd6;border-radius:10px;padding:9px 10px;margin:7px 0}.pb-cardrow{display:flex;align-items:center;gap:8px}.pb-avatar{width:25px;height:25px;border-radius:8px;background:#efe4d9;color:#9b5f35;display:grid;place-items:center;font-size:10px;font-weight:800}.pb-card strong{font-size:11px;display:block;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.pb-card small{font-size:10px;color:#958980}.pb-tag{margin-left:auto;font-size:9px;color:#7860b8;background:#f0ebf8;padding:3px 5px;border-radius:5px}.pb-sidebar{width:188px;background:#312b27;color:#e9e2dc;display:flex;flex-direction:column;padding:16px 11px}.pb-brand{font-weight:800;letter-spacing:.18em;font-size:12px;color:#e9c8aa;padding:2px 8px 20px}.pb-side-label{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#998b81;padding:7px 8px}.pb-side-item{padding:8px;border-radius:8px;display:flex;align-items:center;gap:7px;font-size:11px;color:#cfc5bd}.pb-side-item.active{background:#514139;color:#fff}.pb-side-count{margin-left:auto;font-size:10px;color:#d5a57f}.pb-sidegroup{border-left:1px solid #5b4a3f;margin:0 0 4px 12px;padding-left:8px}.pb-sidegroup .pb-side-item{padding:6px 5px;font-size:10px}.pb-save{border-top:1px solid #e5ded7;background:#fff;padding:11px 20px;display:flex;align-items:center;gap:9px}.pb-save input{height:33px;border:1px solid #d9d0c8;border-radius:8px;padding:0 9px;font:inherit;font-size:11px;width:180px;outline-color:#b5622e}.pb-status{font-size:10px;color:#36756e;font-weight:700}.pb-help{font-size:10px;color:#93867c;display:flex;align-items:center;gap:5px;margin:12px 2px}.pb-toast{position:absolute;right:20px;bottom:20px;background:#302a26;color:#fff;padding:9px 12px;border-radius:9px;font-size:11px;box-shadow:0 8px 25px #34271f35}@media(max-width:800px){.pb-sidebar{display:none}.pb-body{grid-template-columns:1fr}.pb-preview{display:none}}@media(max-width:540px){.contact-queue-preview{padding:8px}.pb-app{height:calc(100dvh - 16px);min-height:600px;border-radius:14px}.pb-toolbar{flex-wrap:wrap}.pb-toolbar .pb-btn{flex:1}.pb-save input{flex:1;width:auto}.pb-row{grid-template-columns:22px 25px minmax(80px,1fr) auto}}
      `}</style>
      <section className="pb-app" aria-label="INDEXUS priority contact view builder">
        <aside className="pb-sidebar">
          <div className="pb-brand">INDEXUS</div>
          <div className="pb-side-label">Mission</div>
          <div className="pb-side-item active"><Users size={14} /> Contacts <span className="pb-side-count">{total}</span></div>
          {sidebarOpen && <div className="pb-sidegroup">
            <div className="pb-side-item active"><ListFilter size={12} /> {activePreset}</div>
            <div className="pb-side-item"><PhoneCall size={12} /> Auto <span className="pb-side-count">on</span></div>
            <div className="pb-side-item"><ChevronRight size={12} /> Next contact</div>
          </div>}
          <button className="pb-side-item" onClick={() => setSidebarOpen(v => !v)} style={{border:0, background:"transparent", width:"100%", textAlign:"left", cursor:"pointer"}}><ChevronDown size={13} /> Saved views</button>
          <div className="pb-sidegroup">
            <div className="pb-side-item"><ShieldCheck size={12} /> Referral first</div>
            <div className="pb-side-item"><Sparkles size={12} /> Afternoon follow-up</div>
          </div>
          <div style={{marginTop:"auto", padding:"10px 8px", color:"#96877d", fontSize:9, lineHeight:1.5}}>View is personal to<br/>Mária Kováčová</div>
        </aside>
        <div className="pb-main">
          <header className="pb-top">
            <div style={{width:37,height:37,borderRadius:11,background:"#b5622e18",color:"#b5622e",display:"grid",placeItems:"center"}}><SlidersHorizontal size={18}/></div>
            <div style={{flex:1}}><div className="pb-kicker">Contacts / saved view</div><h1 className="pb-title">Priority builder</h1></div>
            <button className="pb-btn" aria-label="Close"><X size={15}/></button>
          </header>
          <div className="pb-toolbar">
            <label className="pb-search"><Search size={14}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search contacts without changing the order" aria-label="Search contacts"/></label>
            <button className="pb-btn"><Settings2 size={14}/> Field: all <ChevronDown size={13}/></button>
            <button className="pb-btn" onClick={() => setSegments(initialSegments)}><RotateCcw size={14}/> Reset</button>
          </div>
          <div className="pb-body">
            <section className="pb-builder">
              <div className="pb-sectionhead"><div><h2>Evaluation order</h2><p>First matching segment wins. Contacts are never repeated.</p></div><span className="pb-total">{total} unique contacts</span></div>
              {segments.map((segment, index) => (
                <div key={segment.id} className={`pb-row ${selected === segment.id ? "is-selected" : ""}`} onClick={() => setSelected(segment.id)} tabIndex={0} role="button" aria-label={`${segment.name}, priority ${index + 1}`}>
                  <GripVertical size={15} className="pb-drag"/>
                  <span className="pb-number">{index + 1}</span>
                  <span className="pb-dot" style={{background:segment.color}}>{segment.icon}</span>
                  <div style={{minWidth:0}}><div className="pb-rowname">{segment.name}{index === 0 && <span title="Highest priority"><ShieldCheck size={12} color="#b5622e"/></span>}</div><div className="pb-detail">{segment.detail}</div></div>
                  <span className="pb-count">{segment.count}</span>
                  <div className="pb-actions" onClick={e => e.stopPropagation()}>
                    <span style={{fontSize:10,color:"#998b81"}}>Sort inside by</span>
                    <select value={segment.sort} onChange={e => updateSort(segment.id, e.target.value as SortKey)} aria-label={`Sort ${segment.name}`}><option value="priority">Priority</option>{Object.entries(sortLabels).filter(([key]) => key !== "priority").map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select>
                    <span style={{marginLeft:"auto",display:"flex"}}><button className="pb-mini" onClick={() => move(segment.id,-1)} disabled={index===0} aria-label="Move segment up"><ArrowUp size={14}/></button><button className="pb-mini" onClick={() => move(segment.id,1)} disabled={index===segments.length-1} aria-label="Move segment down"><ArrowDown size={14}/></button><button className="pb-mini" aria-label="More segment actions"><MoreHorizontal size={14}/></button></span>
                  </div>
                </div>
              ))}
              <button className="pb-add" onClick={() => setSegments(s => [...s, {id:`custom-${s.length}`,name:"Custom segment",detail:"Choose a condition",icon:"+",color:"#74846b",count:0,sort:"name_asc"}])}><Plus size={14} style={{verticalAlign:"-3px",marginRight:5}}/> Add segment</button>
              <div className="pb-help"><GripVertical size={13}/> Drag or use arrows to make priority tangible. Deduplication happens top to bottom.</div>
            </section>
            <aside className="pb-preview">
              <div className="pb-previewhead"><div><h2>Live result</h2><p style={{fontSize:10,margin:"3px 0",color:"#968980"}}>What Mária will work next</p></div><strong style={{fontSize:16,color:"#b5622e"}}>{total}</strong></div>
              <div className="pb-impact"><Check size={15}/><span><strong>Deduplication active.</strong><br/>6 contacts match 2+ rules and appear only in their highest segment.</span></div>
              {visibleContacts.map(([name, group, time, attempts]) => <div className="pb-card" key={name}><div className="pb-cardrow"><span className="pb-avatar">{name.slice(0,1)}</span><div style={{minWidth:0,flex:1}}><strong>{name}</strong><small>{group} · {time} · {attempts}</small></div><span className="pb-tag">#{segments.findIndex(s => s.name === group) + 1 || "—"}</span></div></div>)}
              <div className="pb-rule"><div className="pb-ruletop"><Check size={14} color="#337e7b"/><strong>Why this order?</strong></div><div className="pb-rulecopy">Referral is evaluated before scheduled callbacks, so partner-introduced clinics always reach the front of the queue.</div></div>
            </aside>
          </div>
          <footer className="pb-save">
            <input value={viewName} onChange={e => {setViewName(e.target.value);setSaved(false)}} aria-label="Saved view name"/>
            <button className="pb-btn primary" onClick={saveView}><Save size={14}/> Save view</button>
            <button className="pb-btn" onClick={() => setViewName(`${viewName} copy`)}><Copy size={14}/> Duplicate</button>
            <button className="pb-btn" aria-label="Rename view"><Pencil size={14}/></button>
            <span className="pb-status">{saved ? <><Check size={12} style={{verticalAlign:"-2px"}}/> Saved to your Contacts sidebar</> : "Unsaved changes"}</span>
          </footer>
        </div>
      </section>
      {saved && <div className="pb-toast" role="status">“{activePreset}” is now your active Contacts view.</div>}
    </main>
  );
}

export default PriorityBuilder;