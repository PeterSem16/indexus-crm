import { useEffect, useState, type CSSProperties } from "react";
import {
  AlertTriangle,
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

export function CalmHierarchy() {
  const [elapsed, setElapsed] = useState(8);
  const [state, setState] = useState<"ringing" | "accepted" | "rejected" | "dismissed">("ringing");
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (state !== "ringing") return;
    const interval = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [state]);

  const time = `00:${String(elapsed).padStart(2, "0")}`;

  if (minimized && state === "ringing") {
    return (
      <main className="inbound-preview">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          aria-label="Expand incoming call"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: "1px solid #b7dfc6",
            borderRadius: 999,
            padding: "11px 16px",
            color: "#17633a",
            background: "#f7fff9",
            boxShadow: "0 12px 28px rgba(44, 74, 58, .14)",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          <PhoneIncoming size={16} />
          Incoming call · 1
          <span style={{ color: "#7a8b80", fontWeight: 500 }}>Expand</span>
        </button>
      </main>
    );
  }

  return (
    <main className="inbound-preview" data-testid="calm-hierarchy-preview">
      <section
        className="inbound-shell"
        aria-label="Incoming call from Drahoslava Drastíková"
        style={{
          width: "min(100%, 700px)",
          border: "1px solid #cddbd4",
          borderRadius: 16,
          background: "#fcfdfc",
          boxShadow: "0 22px 55px rgba(39, 64, 51, .16)",
        }}
      >
        <header
          className="inbound-titlebar"
          style={{
            padding: "13px 18px",
            borderBottom: "1px solid #dce9df",
            color: "#245d3a",
            background: "#f1f8f3",
          }}
        >
          <span>
            <span style={{ display: "inline-flex", position: "relative" }}>
              <PhoneIncoming size={17} />
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  width: 6,
                  height: 6,
                  right: -3,
                  top: -2,
                  borderRadius: "50%",
                  background: "#3caa68",
                  boxShadow: "0 0 0 3px #f1f8f3",
                }}
              />
            </span>
            Incoming Calls
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <small style={{ color: "#4f6658", background: "#fff", border: "1px solid #dce9df" }}>
              <Users size={12} style={{ verticalAlign: "middle", marginRight: 5 }} />
              1 call
            </small>
            <button
              type="button"
              onClick={() => setMinimized(true)}
              aria-label="Minimize incoming call"
              style={{
                display: "grid",
                placeItems: "center",
                width: 26,
                height: 26,
                border: 0,
                borderRadius: 6,
                color: "#557262",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              <Minimize2 size={15} />
            </button>
          </div>
        </header>

        <article
          style={{
            margin: 12,
            padding: 16,
            border: "1px solid #d9e4dc",
            borderRadius: 12,
            background: "#fff",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "46px minmax(0, 1fr) auto",
              gap: 13,
              alignItems: "start",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                display: "grid",
                placeItems: "center",
                width: 46,
                height: 46,
                borderRadius: "50%",
                border: "2px solid #b9dfc7",
                color: "#21653d",
                background: "#eaf7ee",
                fontSize: 14,
                fontWeight: 800,
              }}
            >
              DD
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 7 }}>
                <strong
                  style={{
                    maxWidth: 360,
                    color: "#23352b",
                    fontSize: 15,
                    lineHeight: 1.25,
                    overflowWrap: "anywhere",
                  }}
                >
                  Drahoslava Drastíková
                </strong>
                <span style={badgeStyle("#e7f0ff", "#315a91")}>Customer</span>
                <span style={badgeStyle("#f0f3f1", "#56665c")}>+2 cards</span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "5px 14px",
                  marginTop: 7,
                  color: "#617267",
                  fontSize: 11,
                  lineHeight: 1.4,
                }}
              >
                <span style={{ fontWeight: 650, color: "#425a4a" }}>Inbound Medical Partner Cooperation</span>
                <span>+421 918 751 470</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Clock3 size={12} /> {time}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 7,
                  marginTop: 11,
                }}
              >
                <span style={statStyle}>
                  <PhoneIncoming size={12} /> Today: 10 calls
                </span>
                <span style={{ ...statStyle, color: "#a1463e", borderColor: "#e8bbb4", background: "#fff9f8" }}>
                  <PhoneMissed size={12} /> 4 missed
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setState("accepted")}
                disabled={state !== "ringing"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  height: 34,
                  border: "1px solid #21834b",
                  borderRadius: 7,
                  padding: "0 13px",
                  color: "#fff",
                  background: state === "accepted" ? "#6e9a7c" : "#268b50",
                  cursor: state === "ringing" ? "pointer" : "default",
                  fontSize: 12,
                  fontWeight: 750,
                  whiteSpace: "nowrap",
                }}
              >
                <Phone size={14} />
                {state === "accepted" ? "Accepted" : "Accept"}
              </button>
              <button
                type="button"
                onClick={() => setState("rejected")}
                disabled={state !== "ringing"}
                aria-label="Reject call"
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 34,
                  height: 34,
                  border: "1px solid #dcb7b2",
                  borderRadius: 7,
                  color: "#a1463e",
                  background: "#fff9f8",
                  cursor: state === "ringing" ? "pointer" : "default",
                }}
              >
                <PhoneOff size={14} />
              </button>
              <button
                type="button"
                onClick={() => setState("dismissed")}
                disabled={state !== "ringing"}
                aria-label="Dismiss call"
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 30,
                  height: 30,
                  border: 0,
                  borderRadius: 6,
                  color: "#718078",
                  background: "transparent",
                  cursor: state === "ringing" ? "pointer" : "default",
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div
            role="note"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 9,
              marginTop: 15,
              padding: "10px 12px",
              border: "1px solid #e7c99c",
              borderLeft: "4px solid #c78332",
              borderRadius: 8,
              color: "#6f4a20",
              background: "#fffaf0",
              fontSize: 11,
              lineHeight: 1.42,
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1, color: "#b36b20" }} />
            <div>
              <strong style={{ display: "block", marginBottom: 2, color: "#6a4319", letterSpacing: ".02em" }}>
                Urgent — repeated caller
              </strong>
              This caller has called 11 times today and the last call was not handled. Answer this call as a priority.
            </div>
          </div>
        </article>

        {state !== "ringing" && (
          <div style={{ margin: "-3px 13px 13px", color: "#66766c", fontSize: 11, textAlign: "center" }}>
            {state === "accepted" ? "Call accepted — connecting…" : state === "rejected" ? "Call rejected." : "Call dismissed."}
          </div>
        )}
      </section>
    </main>
  );
}

const badgeStyle = (background: string, color: string): CSSProperties => ({
  padding: "3px 7px",
  borderRadius: 999,
  color,
  background,
  fontSize: 10,
  fontWeight: 700,
});

const statStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "4px 8px",
  border: "1px solid #dce5df",
  borderRadius: 999,
  color: "#5b6d61",
  background: "#f8fbf9",
  fontSize: 10,
  fontWeight: 650,
};