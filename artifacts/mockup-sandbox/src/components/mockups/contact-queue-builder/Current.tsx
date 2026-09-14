import { useState } from "react";
import {
  ArrowUpDown, Calendar, ChevronDown, ChevronUp, Clock, PhoneCall,
  Search, SlidersHorizontal, Stethoscope, Users, X,
} from "lucide-react";
import "./_group.css";

const contacts = [
  { name: "Melichar SRO — MUDr. Peter Seman", phone: "+421 948 519 438", date: "18.09.2026 09:00", attempts: "18x" },
  { name: "Tes AmbuMed Partner — MUDr. Martin Kabát", phone: "+421 915 796 900", date: "16.09.2026 09:00", attempts: "1x" },
  { name: "Tes Klinika Medifem X — MUDr. Martin Kabát", phone: "+421 905 773 403", date: "07.09.2026 09:00", attempts: "" },
  { name: "Tes Zdravotné centrum Iris — MUDr. Martin Kabát", phone: "+421 915 796 900", date: "10.10.2026 09:00", attempts: "9x" },
];

export function Current() {
  const [active, setActive] = useState("Referral");
  const [expanded, setExpanded] = useState(true);
  return (
    <main className="contact-queue-preview">
      <section className="cq-shell" aria-label="Current Mission contacts">
        <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 24px", borderBottom: "1px solid #ece8e4" }}>
          <div style={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 12, color: "#b5622e", background: "#b5622e18" }}><Users size={21} /></div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 17, lineHeight: 1.25 }}>Mission contacts</h1>
            <p style={{ margin: "4px 0 0", color: "#9a8878", fontSize: 12, fontWeight: 600 }}>Medical Partner Cooperation</p>
          </div>
          <button aria-label="Close" style={{ border: 0, background: "transparent", color: "#7d7772" }}><X size={18} /></button>
        </header>

        <div style={{ padding: "14px 24px 12px", borderBottom: "1px solid #ece8e4" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <label style={{ position: "relative", flex: 1 }}>
              <Search size={16} style={{ position: "absolute", left: 13, top: 10, color: "#8c8782" }} />
              <input placeholder="Hľadať meno, telefón, email, mesto…" style={{ width: "100%", height: 38, boxSizing: "border-box", border: "1px solid #ded9d4", borderRadius: 12, padding: "0 12px 0 38px", font: "inherit", fontSize: 13 }} />
            </label>
            <button className="cq-button"><SlidersHorizontal size={15} /> Field</button>
            <button className="cq-button"><ArrowUpDown size={14} /> Name (A–Z) <ChevronDown size={14} /></button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
            {["All", "Due now", "My scheduled", "Team scheduled", "Unhandled", "Referral"].map(label => (
              <button key={label} onClick={() => setActive(label)} style={{ border: 0, borderRadius: 9, padding: "7px 13px", color: active === label ? "#fff" : "#665f5a", background: active === label ? "#b5622e" : "#f0eeec", font: "inherit", fontSize: 11, fontWeight: 700 }}>{label}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: "16px 24px 22px" }}>
          <button onClick={() => setExpanded(!expanded)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: 13, border: "1px solid #8b5cf640", borderRadius: 15, background: "#8b5cf60d", textAlign: "left" }}>
            <div style={{ width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: 13, color: "#fff", background: "#8b5cf6" }}><Stethoscope size={18} /></div>
            <div style={{ flex: 1 }}><strong style={{ display: "block", fontSize: 13 }}>Referral</strong><span style={{ color: "#77716c", fontSize: 11 }}>4 contacts</span></div>
            <span style={{ minWidth: 28, height: 28, display: "grid", placeItems: "center", borderRadius: 999, color: "#fff", background: "#8b5cf6", fontSize: 12, fontWeight: 700 }}>4</span>
            {expanded ? <ChevronUp size={16} color="#8b5cf6" /> : <ChevronDown size={16} color="#8b5cf6" />}
          </button>
          {expanded && <div style={{ display: "grid", gap: 8, marginTop: 9 }}>
            {contacts.map(contact => (
              <div key={contact.name} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", border: "1px solid #8b5cf62b", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
                <div style={{ width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: 999, color: "#8b5cf6", background: "#8b5cf615" }}><PhoneCall size={15} /></div>
                <div style={{ flex: 1, minWidth: 0 }}><strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>{contact.name}</strong><span style={{ color: "#77716c", fontSize: 11 }}>{contact.phone}</span></div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#8b5cf6", fontSize: 10 }}><Calendar size={12} />{contact.date}</span>
                {contact.attempts && <span style={{ padding: "3px 6px", borderRadius: 999, color: "#8b5cf6", background: "#8b5cf615", fontSize: 10, fontWeight: 700 }}>{contact.attempts}</span>}
              </div>
            ))}
          </div>}
        </div>
      </section>
    </main>
  );
}