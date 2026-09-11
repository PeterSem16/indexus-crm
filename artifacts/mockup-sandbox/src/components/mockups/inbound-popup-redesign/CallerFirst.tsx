import { useState } from "react";
import {
  AlertTriangle,
  Building2,
  Clock3,
  Minimize2,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  Users,
  X,
} from "lucide-react";
import "./_group.css";

export function CallerFirst() {
  const [visible, setVisible] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [minimized, setMinimized] = useState(false);

  if (!visible) {
    return (
      <main className="inbound-preview">
        <button
          type="button"
          onClick={() => setVisible(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 9,
            border: "1px solid #b9d3cc",
            borderRadius: 999,
            padding: "11px 16px",
            color: "#17443e",
            background: "#f7fbf9",
            boxShadow: "0 12px 30px rgba(31, 67, 61, .13)",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <PhoneIncoming size={16} />
          Return to incoming call
        </button>
      </main>
    );
  }

  if (minimized) {
    return (
      <main className="inbound-preview">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            minWidth: 230,
            border: "1px solid #b9d3cc",
            borderRadius: 14,
            padding: "12px 14px",
            color: "#17443e",
            background: "#f7fbf9",
            boxShadow: "0 16px 35px rgba(31, 67, 61, .16)",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <span style={{ display: "grid", placeItems: "center", width: 31, height: 31, borderRadius: 10, color: "#fff", background: "#267568" }}>
            <PhoneIncoming size={15} />
          </span>
          <span style={{ display: "grid", gap: 2 }}>
            <strong style={{ fontSize: 12 }}>Incoming call</strong>
            <span style={{ color: "#6a7e79", fontSize: 11 }}>Drahoslava Drastíková · 00:08</span>
          </span>
          <span style={{ marginLeft: "auto", color: "#74918b", fontSize: 11 }}>Expand</span>
        </button>
      </main>
    );
  }

  const callEnded = accepted || rejected;

  return (
    <main className="inbound-preview">
      <section
        className="inbound-shell"
        aria-label="Incoming call from Drahoslava Drastíková"
        style={{
          width: "min(100%, 728px)",
          border: "1px solid #c5d9d4",
          borderRadius: 18,
          background: "#fbfdfc",
          boxShadow: "0 24px 65px rgba(27, 64, 57, .19)",
          overflow: "hidden",
        }}
      >
        <header
          className="inbound-titlebar"
          style={{
            minHeight: 48,
            padding: "12px 18px",
            color: "#17443e",
            background: "#edf7f3",
            borderBottom: "1px solid #d6e7e2",
          }}
        >
          <span><PhoneIncoming size={17} /> Incoming Calls</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <small style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#42645e", background: "#fff", border: "1px solid #d5e5e0" }}>
              <Users size={12} /> 1 call
            </small>
            <button
              type="button"
              aria-label="Minimize incoming call"
              onClick={() => setMinimized(true)}
              style={{ display: "grid", placeItems: "center", width: 25, height: 25, padding: 0, border: 0, borderRadius: 7, color: "#5d7b75", background: "transparent", cursor: "pointer" }}
            >
              <Minimize2 size={15} />
            </button>
          </div>
        </header>

        <article
          className="current-card"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 258px",
            gap: 18,
            margin: 14,
            padding: 0,
            border: 0,
            borderRadius: 0,
            background: "transparent",
            boxShadow: "none",
          }}
        >
          <div style={{ minWidth: 0, padding: "5px 0 2px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 13 }}>
              <div
                className="current-avatar"
                style={{ flex: "0 0 auto", width: 56, height: 56, border: "1px solid #b8d8cf", borderRadius: 16, color: "#21695d", background: "#dcefe9", fontSize: 18, letterSpacing: ".02em" }}
              >
                DD
              </div>
              <div style={{ minWidth: 0, paddingTop: 1 }}>
                <div className="current-name" style={{ gap: 7, fontSize: 19, lineHeight: 1.18, color: "#173e39" }}>
                  <span style={{ overflowWrap: "anywhere" }}>Drahoslava Drastíková</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 7 }}>
                  <span className="current-badge" style={{ color: "#27665d", background: "#dff0eb", fontSize: 10 }}>Customer</span>
                  <span className="current-badge" style={{ color: "#617672", background: "#edf2f0", fontSize: 10 }}>+2 duplicate cards</span>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 18, paddingTop: 13, borderTop: "1px solid #e1ebe8" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 9, color: "#46635e", fontSize: 11 }}>
                <Building2 size={14} style={{ flex: "0 0 auto", color: "#6f958d" }} />
                <span><strong style={{ display: "block", marginBottom: 2, color: "#284e48", fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em" }}>Mission / queue</strong>Inbound Medical Partner Cooperation</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 9, color: "#46635e", fontSize: 12 }}>
                <PhoneIncoming size={14} style={{ color: "#6f958d" }} />
                <span><strong style={{ marginRight: 10, color: "#284e48", fontWeight: 700 }}>+421 918 751 470</strong><span style={{ color: "#81938f" }}>· direct line</span></span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 9, color: "#46635e", fontSize: 12 }}>
                <Clock3 size={14} style={{ color: "#6f958d" }} />
                <span>Ringing for <strong style={{ color: "#284e48" }}>00:08</strong></span>
              </div>
            </div>

            <div className="current-stats" style={{ gap: 7, marginTop: 16 }}>
              <span style={{ color: "#46635e", background: "#f3f8f6", borderColor: "#d9e6e2" }}><PhoneIncoming size={12} /> Today: 10 calls</span>
              <span className="missed" style={{ color: "#a7443c", background: "#fff8f6", borderColor: "#e7bbb5" }}><PhoneMissed size={12} /> 4 missed</span>
            </div>
          </div>

          <aside style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 228, padding: 14, border: "1px solid #ead8d3", borderRadius: 14, background: "#fffaf8" }}>
            <div style={{ display: "flex", gap: 9, color: "#92433d" }}>
              <AlertTriangle size={17} style={{ flex: "0 0 auto", marginTop: 1 }} />
              <div style={{ fontSize: 11, lineHeight: 1.45 }}>
                <strong style={{ display: "block", marginBottom: 5, color: "#813b36", fontSize: 11, letterSpacing: ".04em" }}>Urgent — repeated caller</strong>
                This caller has called 11 times today and the last call was not handled. Answer this call as a priority.
              </div>
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
              <button
                type="button"
                onClick={() => setAccepted(true)}
                disabled={callEnded}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, height: 39, border: 0, borderRadius: 9, color: "#fff", background: callEnded ? "#9ab9b2" : "#267568", fontSize: 12, fontWeight: 700, cursor: callEnded ? "default" : "pointer" }}
              >
                <Phone size={15} /> {accepted ? "Accepted" : "Accept call"}
              </button>
              <button
                type="button"
                onClick={() => setRejected(true)}
                disabled={callEnded}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, height: 34, border: "1px solid #dda19a", borderRadius: 9, color: "#a7443c", background: "transparent", fontSize: 11, fontWeight: 700, cursor: callEnded ? "default" : "pointer", opacity: callEnded ? .55 : 1 }}
              >
                <PhoneOff size={14} /> {rejected ? "Rejected" : "Reject"}
              </button>
            </div>
          </aside>
        </article>

        <footer style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 18px 12px", color: "#82938f", fontSize: 10 }}>
          <span>{callEnded ? (accepted ? "Call accepted" : "Call rejected") : "Caller context matched from 3 cards"}</span>
          <button type="button" onClick={() => setVisible(false)} aria-label="Dismiss incoming call" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: 4, border: 0, color: "#718580", background: "transparent", fontSize: 10, cursor: "pointer" }}>
            <X size={14} /> Dismiss
          </button>
        </footer>
      </section>
    </main>
  );
}