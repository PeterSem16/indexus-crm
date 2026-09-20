import { useMemo, useState } from "react";
import {
  ArrowRight, CalendarClock, Check, ChevronDown, Clock3, Mail,
  MessageSquare, MoreHorizontal, Phone, Search, SlidersHorizontal,
  Sparkles, UserRound, X, Zap,
} from "lucide-react";

type Channel = "Call" | "Email" | "SMS";
type QueueItem = {
  id: number; name: string; company: string; location: string; channel: Channel;
  time: string; date: string; step: string; campaign: string; note: string;
};

const seed: QueueItem[] = [
  { id: 1, name: "Zoltán Pataky", company: "MED-EZOP s.r.o.", location: "Kráľovský Chlmec, SK", channel: "Call", time: "10:25", date: "Today", step: "Offer accepted", campaign: "Medical Partner Cooperation", note: "Asked to reconnect after reviewing the partner terms." },
  { id: 2, name: "Melinda Baloghová", company: "GYN-BMEL s.r.o.", location: "Kráľovský Chlmec, SK", channel: "Call", time: "10:40", date: "Today", step: "First touch", campaign: "Medical Partner Cooperation", note: "No prior conversation. Lead came through referral." },
  { id: 3, name: "Dr. Andrej Kováč", company: "Kováč Clinic", location: "Košice, SK", channel: "Email", time: "11:15", date: "Today", step: "Follow-up #2", campaign: "Eastern Region Outreach", note: "Send the short case study and ask for a 15-minute slot." },
  { id: 4, name: "Lucia Benková", company: "MediNova", location: "Prešov, SK", channel: "SMS", time: "14:00", date: "Tomorrow", step: "Reminder", campaign: "Medical Partner Cooperation", note: "Reminder before the scheduled demo." },
];

const ink = "#253237";
const muted = "#6d7d7c";
const teal = "#0c756b";
const mint = "#d9eee4";
const line = "#d8e5df";

export function QueueFocusWorkspace() {
  const [items, setItems] = useState(seed);
  const [selected, setSelected] = useState(seed[0].id);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | "Today" | "Tomorrow">("All");
  const [notice, setNotice] = useState("Ready for your next conversation");
  const current = items.find((item) => item.id === selected) ?? items[0];
  const visible = useMemo(() => items.filter((item) => {
    const q = query.toLowerCase();
    return (!q || `${item.name} ${item.company} ${item.campaign}`.toLowerCase().includes(q))
      && (filter === "All" || item.date === filter);
  }), [filter, items, query]);

  const complete = () => {
    if (!current) return;
    const next = items.find((item) => item.id !== current.id);
    setItems((all) => all.filter((item) => item.id !== current.id));
    setSelected(next?.id ?? 0);
    setNotice(`${current.name} marked complete`);
  };

  return (
    <main style={{ minHeight: "100vh", background: "#e8f0eb", color: ink, fontFamily: "ui-sans-serif, system-ui, sans-serif", padding: "20px 18px" }}>
      <section style={{ maxWidth: 1220, minHeight: 620, margin: "0 auto", background: "#fbfcf9", border: `1px solid ${line}`, borderRadius: 14, boxShadow: "0 18px 45px rgba(39,63,55,.11)", overflow: "hidden" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 66, padding: "0 24px", borderBottom: `1px solid ${line}`, background: "#f7faf7" }}>
          <div style={{ width: 34, height: 34, display: "grid", placeItems: "center", background: "#dcefe6", color: teal, borderRadius: 9 }}><Sparkles size={17} /></div>
          <div><div style={{ fontSize: 16, fontWeight: 750, letterSpacing: "-.02em" }}>Focus queue</div><div style={{ fontSize: 10, color: muted, marginTop: 2 }}>One conversation at a time, no tabs required</div></div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: teal, background: mint, padding: "6px 9px", borderRadius: 99, fontWeight: 700 }}>{items.length} remaining</span>
            <button type="button" onClick={() => setNotice("Queue settings opened")} aria-label="Queue settings" style={{ border: `1px solid ${line}`, background: "#fff", color: muted, width: 31, height: 31, borderRadius: 7, display: "grid", placeItems: "center", cursor: "pointer" }}><SlidersHorizontal size={14} /></button>
          </div>
        </header>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(250px, .75fr) minmax(0, 1.55fr)", minHeight: 500 }}>
          <aside style={{ borderRight: `1px solid ${line}`, background: "#f5f9f5", padding: 18 }}>
            <div style={{ display: "flex", gap: 5, padding: 3, border: `1px solid ${line}`, background: "#fff", borderRadius: 8, marginBottom: 13 }}>
              <Search size={14} color={muted} style={{ margin: "7px 0 0 6px" }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a contact" aria-label="Find a contact" style={{ width: "100%", border: 0, outline: 0, background: "transparent", fontSize: 11, padding: "7px 4px", color: ink }} />
              {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search" style={{ border: 0, background: "none", color: muted, cursor: "pointer" }}><X size={13} /></button>}
            </div>
            <div style={{ display: "flex", gap: 5, marginBottom: 18 }}>
              {(["All", "Today", "Tomorrow"] as const).map((f) => <button key={f} type="button" onClick={() => setFilter(f)} style={{ flex: 1, border: 0, borderRadius: 6, padding: "7px 3px", background: filter === f ? mint : "transparent", color: filter === f ? teal : muted, fontSize: 10, fontWeight: filter === f ? 750 : 500, cursor: "pointer" }}>{f}</button>)}
            </div>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".14em", color: muted, fontWeight: 800, margin: "0 4px 9px" }}>Up next</div>
            <div style={{ display: "grid", gap: 5 }}>
              {visible.map((item, i) => <button key={item.id} type="button" onClick={() => setSelected(item.id)} style={{ display: "grid", gridTemplateColumns: "30px 1fr auto", textAlign: "left", gap: 9, alignItems: "center", padding: "10px 8px", border: 0, borderRadius: 8, background: selected === item.id ? "#e1f1e8" : "transparent", color: ink, cursor: "pointer" }}>
                <span style={{ width: 27, height: 27, borderRadius: 7, display: "grid", placeItems: "center", background: selected === item.id ? "#b9ddcc" : "#e4ece7", color: teal, fontSize: 10, fontWeight: 800 }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ minWidth: 0 }}><strong style={{ display: "block", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</strong><small style={{ display: "block", color: muted, fontSize: 10, marginTop: 2 }}>{item.channel} · {item.time}</small></span>
                {selected === item.id && <ArrowRight size={13} color={teal} />}
              </button>)}
              {visible.length === 0 && <div style={{ color: muted, fontSize: 11, padding: 20, textAlign: "center" }}>Nothing in this slice.</div>}
            </div>
          </aside>
          <section style={{ padding: "27px clamp(20px, 5vw, 66px) 24px", maxWidth: 720 }}>
            {current ? <><div style={{ display: "flex", alignItems: "center", gap: 9, color: muted, fontSize: 10, marginBottom: 20 }}><span style={{ color: teal, fontWeight: 750 }}>{current.date}</span><span>·</span><Clock3 size={13} /> {current.time}<span style={{ marginLeft: "auto" }}><MoreHorizontal size={16} /></span></div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}><div style={{ width: 49, height: 49, flex: "0 0 auto", display: "grid", placeItems: "center", borderRadius: 13, background: mint, color: teal }}><UserRound size={22} /></div><div><h2 style={{ margin: 0, fontSize: 25, letterSpacing: "-.035em", lineHeight: 1.1 }}>{current.name}</h2><div style={{ marginTop: 6, color: muted, fontSize: 12 }}>{current.company} <span style={{ color: line, padding: "0 5px" }}>·</span> {current.location}</div></div></div>
              <div style={{ display: "flex", gap: 7, margin: "25px 0 21px", flexWrap: "wrap" }}><span style={{ display: "inline-flex", gap: 5, alignItems: "center", borderRadius: 5, padding: "6px 8px", background: "#eef3ef", color: muted, fontSize: 10 }}><Zap size={12} color="#b77328" /> {current.step}</span><span style={{ display: "inline-flex", gap: 5, alignItems: "center", borderRadius: 5, padding: "6px 8px", background: "#eef3ef", color: muted, fontSize: 10 }}>{current.campaign}</span></div>
              <div style={{ border: `1px solid ${line}`, borderRadius: 10, padding: "16px 17px", background: "#fff" }}><div style={{ fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: muted, fontWeight: 800, marginBottom: 8 }}>Context for this touch</div><p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: ink }}>{current.note}</p></div>
              <div style={{ display: "flex", gap: 8, marginTop: 25, flexWrap: "wrap" }}><button type="button" onClick={() => setNotice(`Calling ${current.name}`)} style={{ display: "inline-flex", gap: 7, alignItems: "center", border: 0, borderRadius: 7, padding: "10px 15px", background: teal, color: "#f7fbf8", fontSize: 11, fontWeight: 750, cursor: "pointer" }}><Phone size={14} /> Start call</button><button type="button" onClick={() => setNotice(`Message composer opened for ${current.name}`)} style={{ display: "inline-flex", gap: 7, alignItems: "center", border: `1px solid ${line}`, borderRadius: 7, padding: "9px 13px", background: "#fff", color: ink, fontSize: 11, fontWeight: 650, cursor: "pointer" }}>{current.channel === "Email" ? <Mail size={14} /> : current.channel === "SMS" ? <MessageSquare size={14} /> : <CalendarClock size={14} />} {current.channel === "Call" ? "Reschedule" : "Open message"}</button><button type="button" onClick={complete} style={{ marginLeft: "auto", display: "inline-flex", gap: 7, alignItems: "center", border: `1px solid #b9ddcc`, borderRadius: 7, padding: "9px 13px", background: "#edf8f1", color: teal, fontSize: 11, fontWeight: 700, cursor: "pointer" }}><Check size={14} /> Complete</button></div>
              <div style={{ marginTop: 28, paddingTop: 15, borderTop: `1px solid ${line}`, display: "flex", justifyContent: "space-between", color: muted, fontSize: 10 }}><span>Keyboard: <b style={{ color: ink }}>C</b> call · <b style={{ color: ink }}>N</b> next</span><button type="button" onClick={() => setNotice("Contact details opened")} style={{ border: 0, background: "none", color: teal, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>View full contact <ChevronDown size={12} style={{ verticalAlign: "middle", transform: "rotate(-90deg)" }} /></button></div>
            </> : <div style={{ display: "grid", placeItems: "center", minHeight: 400, color: muted }}><Check size={25} color={teal} /><strong style={{ color: ink, marginTop: 10 }}>Queue cleared</strong><span style={{ fontSize: 11, marginTop: 5 }}>Nice work. Nothing else is waiting.</span></div>}
          </section>
        </div>
        <footer style={{ display: "flex", alignItems: "center", gap: 7, minHeight: 38, padding: "0 20px", borderTop: `1px solid ${line}`, color: muted, fontSize: 10 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: teal }} /> {notice}<span style={{ marginLeft: "auto" }}>Synced just now</span></footer>
      </section>
    </main>
  );
}

export default QueueFocusWorkspace;