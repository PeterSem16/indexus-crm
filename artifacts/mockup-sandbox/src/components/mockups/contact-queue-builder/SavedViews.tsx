import { useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Copy, Edit3,
  GripVertical, ListFilter, MoreHorizontal, Phone,
  Plus, RotateCcw, Save, Search, Settings2, ShieldCheck, Star, Trash2,
  Users, X,
} from "lucide-react";
import "./_group.css";

type Segment = { id: string; label: string; detail: string; count: number; color: string; sort: string };
type View = { id: string; name: string; count: number; meta: string; system?: boolean; favorite?: boolean; segments: Segment[] };

const contacts = [
  ["Melichar SRO — MUDr. Peter Seman", "09:00 today", "Referral", "18x"],
  ["Tes AmbuMed Partner — MUDr. Martin Kabát", "09:00 today", "Referral", "1x"],
  ["Zdravotné centrum Iris — MUDr. Martin Kabát", "10:30 today", "Scheduled today", "9x"],
];

const presets: View[] = [
  { id: "pulse", name: "Pulse · Referral first", count: 64, meta: "System preset · recommended", system: true, favorite: true, segments: [
    { id: "ref", label: "Referral", detail: "Contacts with referral source", count: 12, color: "#8056b8", sort: "Priority" },
    { id: "today", label: "Scheduled today", detail: "My callbacks, then team", count: 18, color: "#b5622e", sort: "Next callback · soonest" },
    { id: "new", label: "New contacts", detail: "Never contacted", count: 34, color: "#4a7b73", sort: "Created · newest" },
  ] },
  { id: "today", name: "Today’s callbacks", count: 29, meta: "System preset", system: true, segments: [
    { id: "due", label: "Due now & overdue", detail: "Callback due before now", count: 11, color: "#b5622e", sort: "Next callback · soonest" },
    { id: "today", label: "Scheduled today", detail: "All assigned callbacks", count: 18, color: "#4a7b73", sort: "Next callback · soonest" },
  ] },
  { id: "fresh", name: "Fresh opportunities", count: 47, meta: "System preset", system: true, segments: [
    { id: "new", label: "New contacts", detail: "Never contacted", count: 34, color: "#4a7b73", sort: "Created · newest" },
    { id: "missed", label: "Unhandled / missed", detail: "No successful outcome", count: 13, color: "#a45b52", sort: "Unanswered streak · high" },
  ] },
  { id: "recovery", name: "Recovery desk", count: 38, meta: "System preset", system: true, segments: [
    { id: "stale", label: "Stale contacts", detail: "No contact in 14+ days", count: 21, color: "#9a7352", sort: "Last contact · oldest" },
    { id: "unanswered", label: "Unanswered / missed", detail: "Three or more attempts", count: 17, color: "#a45b52", sort: "Attempts · high" },
  ] },
];

const personalSeed: View = { id: "my-followups", name: "My follow-ups", count: 22, meta: "Personal · saved yesterday", segments: [
  { id: "mine", label: "My scheduled", detail: "Assigned to me", count: 14, color: "#35738a", sort: "Next callback · soonest" },
  { id: "unanswered", label: "Unanswered / missed", detail: "Assigned to me", count: 8, color: "#a45b52", sort: "Unanswered streak · high" },
] };

const allPresets = [...presets, personalSeed];

export function SavedViews() {
  const [activeId, setActiveId] = useState("pulse");
  const [views, setViews] = useState<View[]>(allPresets);
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [openSegment, setOpenSegment] = useState("ref");
  const active = views.find(v => v.id === activeId) || views[0];

  const visibleContacts = useMemo(() => contacts.filter(c => !search || c[0].toLowerCase().includes(search.toLowerCase())), [search]);
  const setActive = (id: string) => setActiveId(id);
  const duplicate = (view: View) => {
    const copyView = { ...view, id: `${view.id}-${Date.now()}`, name: `${view.name} copy`, system: false, meta: "Personal · just now" };
    setViews(v => [...v, copyView]); setActiveId(copyView.id); setEditing(true);
  };
  const rename = () => setViews(v => v.map(x => x.id === active.id ? { ...x, name: x.name === "Pulse · Referral first" ? "Morning Pulse" : `${x.name} · edited` } : x));
  const deleteView = () => {
    if (active.system) return;
    setViews(v => v.filter(x => x.id !== active.id)); setActiveId("pulse");
  };

  return (
    <main className="contact-queue-preview" style={{ padding: 16, alignItems: "center" }}>
      <section className="cq-shell" aria-label="Saved contact views" style={{ minHeight: 650, maxWidth: 980, display: "flex", flexDirection: "column", background: "#fbfaf9" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: "1px solid #e8e1db", background: "#fff" }}>
          <div style={{ width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: 11, color: "#fff", background: "#b5622e" }}><ListFilter size={19} /></div>
          <div style={{ flex: 1, minWidth: 0 }}><h1 style={{ margin: 0, fontSize: 16, letterSpacing: "-.02em" }}>Contact views</h1><p style={{ margin: "3px 0 0", color: "#927e70", fontSize: 11 }}>Mission · Medical Partner Cooperation</p></div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#63726e", fontSize: 11, fontWeight: 700 }}><ShieldCheck size={15} /> Saved to your agent profile</div>
          <button className="cq-button" aria-label="Close"><X size={16} /></button>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "238px minmax(0, 1fr)", flex: 1, minHeight: 0 }}>
          <aside style={{ borderRight: "1px solid #e8e1db", background: "#f7f3ef", padding: "15px 12px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 6px 9px" }}>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em", color: "#887668" }}>Saved views</span>
              <button className="cq-button" onClick={() => { const v = { id: `new-${Date.now()}`, name: "Untitled view", count: 0, meta: "Personal · unsaved", segments: [] }; setViews(x => [...x, v]); setActiveId(v.id); setEditing(true); }} style={{ width: 27, height: 27, padding: 0, borderRadius: 8 }} aria-label="Create view"><Plus size={15} /></button>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              {views.map(v => <button key={v.id} onClick={() => { setActive(v.id); setEditing(false); }} style={{ display: "flex", textAlign: "left", alignItems: "center", gap: 8, padding: "9px 8px", border: 0, borderRadius: 10, background: active.id === v.id ? "#fff" : "transparent", boxShadow: active.id === v.id ? "0 1px 4px #3f2b2014" : "none", color: "#312a26", cursor: "pointer" }}>
                <div style={{ width: 26, height: 26, display: "grid", placeItems: "center", borderRadius: 8, background: active.id === v.id ? "#b5622e18" : "#ebe4de", color: active.id === v.id ? "#b5622e" : "#85766b" }}>{v.system ? <Star size={13} fill={active.id === v.id ? "#b5622e" : "none"} /> : <Users size={13} />}</div>
                <span style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: active.id === v.id ? 800 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</span>
                <span style={{ fontSize: 10, color: "#9a8878", fontWeight: 700 }}>{v.count}</span>
              </button>)}
            </div>
            <div style={{ margin: "17px 6px 0", padding: "12px 11px", borderRadius: 11, background: "#e7f0ee", color: "#426e67", fontSize: 10, lineHeight: 1.45 }}>
              <strong style={{ display: "block", marginBottom: 3 }}>Personal & persistent</strong>
              Your active view follows you between sign-ins and across Mission sessions.
            </div>
          </aside>

          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", background: "#fff" }}>
            <div style={{ padding: "15px 19px 11px", borderBottom: "1px solid #ece7e2" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><h2 style={{ margin: 0, fontSize: 19, letterSpacing: "-.03em" }}>{active.name}</h2>{active.system && <span style={{ borderRadius: 99, padding: "3px 7px", background: "#f1e9f7", color: "#8056b8", fontSize: 9, fontWeight: 800 }}>SYSTEM PRESET</span>}</div><p style={{ margin: "5px 0 0", color: "#8d7b6f", fontSize: 11 }}>{active.system ? "The fastest starting order for a focused first call." : "A personal order built for your follow-up rhythm."}</p></div>
                <div style={{ display: "flex", gap: 5 }}>
                  <button className="cq-button" onClick={() => setEditing(!editing)} aria-label="Edit active view"><Edit3 size={14} /> {editing ? "Done" : "Edit"}</button>
                  <button className="cq-button" onClick={() => duplicate(active)} aria-label="Duplicate view"><Copy size={14} /></button>
                  <button className="cq-button" onClick={deleteView} disabled={active.system} aria-label="Delete view" style={{ color: active.system ? "#c8beb7" : "#a45b52" }}><Trash2 size={14} /></button>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 13, padding: "9px 11px", borderRadius: 10, background: "#f8f1ec", color: "#77533d", fontSize: 11 }}>
                <Check size={15} strokeWidth={3} /><strong>{active.count} contacts</strong><span>will appear in this order</span><span style={{ marginLeft: "auto", color: "#a1775d", fontSize: 10 }}>Updated just now</span>
              </div>
            </div>

            <div style={{ padding: "12px 19px 10px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #f0ece8" }}>
              <button className="cq-button" style={{ height: 31, color: "#b5622e", borderColor: "#e3cbbb" }} onClick={() => setEditing(true)}><Plus size={14} /> Add segment</button>
              <span style={{ fontSize: 10, color: "#a28d80" }}>Contacts appear once, in the first segment they match.</span>
              <button className="cq-button" style={{ marginLeft: "auto", height: 31 }} onClick={rename}><MoreHorizontal size={15} /> More</button>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: "11px 19px 15px" }}>
              <div style={{ display: "grid", gap: 7 }}>
                {active.segments.length === 0 ? <div style={{ padding: 25, textAlign: "center", border: "1px dashed #d8ccc3", borderRadius: 12, color: "#9d8b7e", fontSize: 12 }}>Add a segment to start your personal view.</div> : active.segments.map((s, i) => <div key={s.id} style={{ border: `1px solid ${s.color}35`, borderRadius: 12, background: "#fff", overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px" }}>
                    {editing && <GripVertical size={15} color="#c2b3a8" aria-label="Drag segment" />}
                    <span style={{ width: 23, height: 23, display: "grid", placeItems: "center", borderRadius: 7, color: "#fff", background: s.color, fontSize: 10, fontWeight: 800 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}><strong style={{ display: "block", fontSize: 12 }}>{s.label}</strong><span style={{ color: "#9a8878", fontSize: 10 }}>{s.detail}</span></div>
                    <span style={{ padding: "4px 8px", borderRadius: 99, background: `${s.color}12`, color: s.color, fontSize: 10, fontWeight: 800 }}>{s.count}</span>
                    {editing && <button className="cq-button" style={{ width: 27, height: 27, padding: 0, border: 0 }} onClick={() => setOpenSegment(openSegment === s.id ? "" : s.id)} aria-label={`Edit ${s.label}`}><Settings2 size={14} /></button>}
                    <button onClick={() => setOpenSegment(openSegment === s.id ? "" : s.id)} aria-expanded={openSegment === s.id} style={{ border: 0, background: "transparent", color: s.color, padding: 3, cursor: "pointer" }}>{openSegment === s.id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
                  </div>
                  {openSegment === s.id && <div style={{ padding: "8px 12px 10px 51px", borderTop: `1px solid ${s.color}20`, background: `${s.color}06`, display: "flex", alignItems: "center", gap: 8, fontSize: 10 }}>
                    <span style={{ color: "#88766b", fontWeight: 700 }}>Internal sort</span><span style={{ border: "1px solid #dfd4cb", borderRadius: 7, background: "#fff", padding: "6px 9px", color: "#4d423b", fontWeight: 700 }}>{s.sort}</span><span style={{ color: "#9c8a7d" }}>then name A–Z</span>
                    {editing && <><button className="cq-button" style={{ marginLeft: "auto", width: 26, height: 26, padding: 0 }} aria-label="Move segment up"><ArrowUp size={13} /></button><button className="cq-button" style={{ width: 26, height: 26, padding: 0 }} aria-label="Move segment down"><ArrowDown size={13} /></button></>}
                  </div>}
                </div>)}
              </div>
              <div style={{ marginTop: 14, border: "1px solid #dfe8e5", borderRadius: 12, background: "#f7fbfa", padding: "11px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9, color: "#3e746c" }}><Phone size={14} /><strong style={{ fontSize: 11 }}>Live preview in Contacts sidebar</strong><span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 800 }}>impact: {active.count} contacts</span></div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{active.segments.map(s => <span key={s.id} style={{ display: "inline-flex", gap: 5, alignItems: "center", padding: "5px 8px", borderRadius: 7, background: "#fff", border: "1px solid #d9e5e1", color: "#4a625e", fontSize: 10, fontWeight: 700 }}><span style={{ width: 6, height: 6, borderRadius: 99, background: s.color }} />{s.label} <b style={{ color: "#8ea59f" }}>{s.count}</b></span>)}</div>
              </div>
              <div style={{ marginTop: 13, borderTop: "1px solid #eee9e5", paddingTop: 11 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}><span style={{ fontSize: 10, color: "#8c7b70", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>Sidebar result</span><span style={{ color: "#b5622e", fontSize: 10, fontWeight: 800 }}>Contacts · {active.name}</span><span style={{ marginLeft: "auto", color: "#9d8b7e", fontSize: 10 }}>Auto and Next use this order</span></div>
                <div style={{ display: "grid", gap: 5 }}>{visibleContacts.slice(0, 2).map(c => <div key={c[0]} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", border: "1px solid #ece6e1", borderRadius: 8, background: "#fff" }}><span style={{ width: 22, height: 22, display: "grid", placeItems: "center", borderRadius: 6, background: "#b5622e12", color: "#b5622e" }}><Phone size={11} /></span><span style={{ flex: 1, minWidth: 0, fontSize: 10, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c[0]}</span><span style={{ color: "#8b786b", fontSize: 9 }}>{c[1]}</span><span style={{ color: "#a45b52", fontSize: 9, fontWeight: 800 }}>{c[3]}</span></div>)}</div>
              </div>
            </div>
          </div>
        </div>
        <footer style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 19px", borderTop: "1px solid #e8e1db", background: "#fbfaf9" }}>
          <Search size={14} color="#a38e80" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts in preview…" style={{ flex: 1, border: 0, outline: 0, background: "transparent", font: "inherit", fontSize: 11, color: "#403630" }} />
          <button className="cq-button" onClick={() => setActiveId("pulse")}><RotateCcw size={13} /> Reset preview</button>
          <button className="cq-button primary" onClick={() => setEditing(false)}><Save size={14} /> Save view</button>
        </footer>
      </section>
    </main>
  );
}

export default SavedViews;