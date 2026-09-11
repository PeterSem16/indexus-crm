import { useState } from "react";
import {
  AlertTriangle,
  Clock3,
  Minimize2,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  X,
} from "lucide-react";
import "./_group.css";

/**
 * Hypothesis: a low-height control strip for agents who need to scan left to
 * right, decide quickly, and keep the rest of the workspace visible.
 */
export function CompactStrip() {
  const [status, setStatus] = useState<"ringing" | "accepted" | "rejected" | "dismissed">("ringing");
  const [minimized, setMinimized] = useState(false);

  if (status !== "ringing") {
    return (
      <main className="inbound-preview">
        <section className="inbound-shell" aria-label="Call action result" style={{ width: "min(100%, 700px)" }}>
          <div style={{ padding: 24, textAlign: "center", color: "#334155", fontSize: 13 }}>
            {status === "accepted" ? "Call accepted — connecting Drahoslava Drastíková." : status === "rejected" ? "Call rejected." : "Incoming call dismissed."}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="inbound-preview">
      <section
        className="inbound-shell"
        aria-label="Incoming call compact strip"
        style={{
          width: "min(100%, 700px)",
          border: "1px solid #cbd5e1",
          borderTop: "3px solid #0f766e",
          borderRadius: 10,
          background: "#fffdfa",
          boxShadow: "0 18px 45px rgba(30, 41, 59, .15)",
        }}
      >
        <header
          className="inbound-titlebar"
          style={{
            minHeight: 42,
            padding: "8px 13px",
            color: "#155e75",
            background: "#ecfeff",
            borderBottom: "1px solid #cffafe",
          }}
        >
          <span style={{ gap: 7 }}>
            <span style={{ display: "grid", placeItems: "center", width: 23, height: 23, borderRadius: 7, color: "#0f766e", background: "#ccfbf1" }}>
              <PhoneIncoming size={15} strokeWidth={2.4} />
            </span>
            <span>Incoming Calls</span>
            <small style={{ color: "#155e75", background: "#cffafe" }}>1 call</small>
          </span>
          <button
            type="button"
            aria-label="Minimize incoming call"
            onClick={() => setMinimized(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, border: 0, color: "#64748b", background: "transparent", cursor: "pointer", fontSize: 11 }}
          >
            <Minimize2 size={14} /> Minimize
          </button>
        </header>

        {minimized ? (
          <button
            type="button"
            onClick={() => setMinimized(false)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "11px 14px", border: 0, color: "#155e75", background: "#f0fdfa", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><PhoneIncoming size={15} /> Drahoslava Drastíková · 1 incoming call</span>
            <span style={{ color: "#0f766e", fontSize: 11 }}>Expand</span>
          </button>
        ) : (
          <article
            style={{
              display: "grid",
              gridTemplateColumns: "38px minmax(0, 1fr) auto",
              alignItems: "center",
              gap: 11,
              minHeight: 96,
              padding: "11px 13px",
              borderBottom: "1px solid #e2e8f0",
              background: "#fffdfa",
            }}
          >
            <div
              aria-hidden="true"
              style={{ display: "grid", placeItems: "center", width: 38, height: 38, border: "1px solid #99f6e4", borderRadius: 10, color: "#115e59", background: "#ccfbf1", fontSize: 13, fontWeight: 800 }}
            >
              DD
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, color: "#172033", fontSize: 14, fontWeight: 750, lineHeight: 1.15 }}>
                <span title="Drahoslava Drastíková">Drahoslava Drastíková</span>
                <span style={{ padding: "3px 7px", borderRadius: 5, color: "#0e7490", background: "#cffafe", fontSize: 9, fontWeight: 800, letterSpacing: ".03em", textTransform: "uppercase" }}>Customer</span>
                <span style={{ padding: "3px 6px", borderRadius: 5, color: "#475569", background: "#f1f5f9", fontSize: 9, fontWeight: 800 }}>+2 cards</span>
                <span style={{ padding: "3px 7px", borderRadius: 5, color: "#475569", background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 9, fontWeight: 700 }}>Mission</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "3px 13px", marginTop: 5, color: "#64748b", fontSize: 10.5 }}>
                <span style={{ fontWeight: 650 }}>Inbound Medical Partner Cooperation</span>
                <span>+421 918 751 470</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#0f766e", fontVariantNumeric: "tabular-nums", fontWeight: 750 }}><Clock3 size={12} /> 00:08</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 7, marginTop: 7, fontSize: 10 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 7px", borderRadius: 999, color: "#475569", background: "#f8fafc", border: "1px solid #e2e8f0" }}><PhoneIncoming size={11} /> Today: 10 calls</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 7px", borderRadius: 999, color: "#b42318", background: "#fff1f2", border: "1px solid #fecdd3", fontWeight: 750 }}><PhoneMissed size={11} /> 4 missed</span>
              </div>
            </div>

            <div className="current-actions" style={{ alignItems: "center", gap: 5 }}>
              <button type="button" onClick={() => setStatus("accepted")} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 13px", border: 0, borderRadius: 7, color: "#fff", background: "#0f766e", boxShadow: "0 2px 5px rgba(15,118,110,.25)", cursor: "pointer", fontSize: 12, fontWeight: 800 }}>
                <Phone size={14} /> Accept
              </button>
              <button type="button" aria-label="Reject call" onClick={() => setStatus("rejected")} style={{ display: "grid", placeItems: "center", width: 34, height: 34, padding: 0, border: "1px solid #fecaca", borderRadius: 7, color: "#b42318", background: "#fff7f7", cursor: "pointer" }}>
                <PhoneOff size={14} />
              </button>
              <button type="button" aria-label="Dismiss call" onClick={() => setStatus("dismissed")} style={{ display: "grid", placeItems: "center", width: 28, height: 34, padding: 0, border: 0, borderRadius: 7, color: "#64748b", background: "transparent", cursor: "pointer" }}>
                <X size={15} />
              </button>
            </div>
          </article>
        )}

        {!minimized && (
          <div
            role="alert"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 13px", color: "#9f1239", background: "#fff1f2", borderTop: "1px solid #ffe4e6", fontSize: 10.5, lineHeight: 1.3 }}
          >
            <span style={{ display: "grid", placeItems: "center", flex: "0 0 auto", width: 22, height: 22, borderRadius: 6, color: "#be123c", background: "#fecdd3" }}><AlertTriangle size={14} /></span>
            <strong style={{ whiteSpace: "nowrap", letterSpacing: ".015em" }}>URGENT · repeated caller</strong>
            <span style={{ color: "#881337" }}>Called 11 times today; last call was not handled. Answer as a priority.</span>
          </div>
        )}
      </section>
    </main>
  );
}