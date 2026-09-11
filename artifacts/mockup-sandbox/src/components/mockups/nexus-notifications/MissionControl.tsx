import { useState } from "react";
import {
  Activity,
  CalendarClock,
  Check,
  ChevronDown,
  Clock3,
  FileText,
  Headphones,
  MessageSquare,
  Phone,
  PhoneCall,
  PhoneForwarded,
  ShieldAlert,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";

type WorkflowStage = "ended" | "acw" | "next";

const stages = [
  {
    key: "ended" as const,
    label: "Call ended",
    detail: "Ring limit reached",
    Icon: PhoneForwarded,
    tone: "red",
  },
  {
    key: "acw" as const,
    label: "After-call work",
    detail: "Review outcome",
    Icon: FileText,
    tone: "orange",
  },
  {
    key: "next" as const,
    label: "Next call",
    detail: "Number selected",
    Icon: PhoneCall,
    tone: "blue",
  },
  {
    key: "connected" as const,
    label: "Connected",
    detail: "Conversation live",
    Icon: Headphones,
    tone: "green",
  },
  {
    key: "warning" as const,
    label: "Warning",
    detail: "Needs attention",
    Icon: ShieldAlert,
    tone: "amber",
  },
];

export function MissionControl() {
  const [stage, setStage] = useState<WorkflowStage>("ended");
  const [isVisible, setIsVisible] = useState(true);

  const advance = () => {
    setStage((current) => (current === "ended" ? "acw" : "next"));
  };

  return (
    <main className="mission-frame">
      <style>{`
        :root {
          color-scheme: light;
          font-family: "Plus Jakarta Sans", "Segoe UI", sans-serif;
        }
        * { box-sizing: border-box; }
        body { margin: 0; min-width: 620px; background: #e8e9e7; }
        button { font: inherit; }
        .mission-frame {
          position: relative;
          width: 620px;
          min-height: 760px;
          overflow: hidden;
          color: #28322f;
          background: #f4f3ef;
          letter-spacing: -0.01em;
        }
        .workspace-top {
          height: 76px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 18px 0 22px;
          background: #fbfaf7;
          border-bottom: 1px solid #deded9;
        }
        .brand-mark {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #27332f;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: .01em;
        }
        .brand-icon {
          width: 29px;
          height: 29px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          color: #fffaf5;
          background: #d16d36;
          box-shadow: 0 3px 8px rgba(169, 75, 29, .22);
        }
        .workspace-meta {
          display: flex;
          align-items: center;
          gap: 15px;
          color: #8a918e;
          font-size: 10px;
        }
        .availability {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 10px;
          border: 1px solid #e7e0d6;
          border-radius: 8px;
          color: #6e6f66;
          background: #fffdf9;
          font-weight: 700;
        }
        .availability i {
          display: block;
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #71a46b;
          box-shadow: 0 0 0 3px #e9f1e5;
        }
        .workspace-body {
          display: grid;
          grid-template-columns: 1fr 183px;
          min-height: 684px;
        }
        .left-workspace {
          padding: 17px 15px 30px 21px;
          background: #f7f6f2;
        }
        .crumbs {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #9a9b96;
          font-size: 10px;
        }
        .crumbs strong { color: #596560; font-weight: 700; }
        .patient-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid #e4e3de;
        }
        .patient-title {
          display: flex;
          align-items: center;
          gap: 11px;
        }
        .patient-avatar {
          width: 35px;
          height: 35px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          color: #8f4b2d;
          background: #f1dfd2;
          font-size: 12px;
          font-weight: 800;
        }
        .patient-name { color: #34413d; font-size: 13px; font-weight: 800; }
        .patient-role { margin-top: 3px; color: #929993; font-size: 9px; }
        .tabs {
          display: flex;
          align-items: center;
          gap: 18px;
          margin-top: 15px;
          color: #929993;
          font-size: 9px;
          font-weight: 700;
        }
        .tabs .selected { color: #b25b36; }
        .section-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 23px 0 10px;
          color: #717a76;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .1em;
        }
        .section-title span { color: #abb0ac; font-size: 9px; font-weight: 600; letter-spacing: 0; text-transform: none; }
        .record-card {
          padding: 15px;
          border: 1px solid #e7e5df;
          border-radius: 11px;
          background: #fffefa;
        }
        .record-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #efeee9;
        }
        .record-row:last-child { padding-bottom: 0; border-bottom: 0; }
        .record-label { color: #a1a7a3; font-size: 9px; }
        .record-value { color: #4f5b56; font-size: 10px; font-weight: 700; }
        .record-value.muted { color: #c2c2bd; font-weight: 600; }
        .activity-card {
          display: flex;
          gap: 11px;
          padding: 13px;
          border: 1px solid #ebe9e3;
          border-radius: 10px;
          background: #fcfbf7;
        }
        .activity-icon {
          width: 27px;
          height: 27px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 8px;
          color: #bd6638;
          background: #f8e8db;
        }
        .activity-line { margin: 2px 0 5px; color: #5e6965; font-size: 10px; font-weight: 700; }
        .activity-sub { color: #a1a6a2; font-size: 9px; line-height: 1.35; }
        .right-panel {
          padding: 17px 13px;
          border-left: 1px solid #dfdfda;
          background: #fbfaf7;
        }
        .contact-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #4c5954;
          font-size: 11px;
          font-weight: 800;
        }
        .contact-sub { margin-top: 4px; color: #a0a6a2; font-size: 9px; }
        .panel-rule { height: 1px; margin: 16px 0; background: #eae8e1; }
        .mini-label { color: #a0a5a0; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; }
        .contact-phone {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 9px;
          color: #4f5c56;
          font-size: 10px;
          font-weight: 700;
        }
        .phone-dot {
          width: 23px;
          height: 23px;
          display: grid;
          place-items: center;
          border-radius: 7px;
          color: #a85a35;
          background: #f4e7dd;
        }
        .action-stack { display: grid; gap: 7px; margin-top: 14px; }
        .ghost-action {
          display: flex;
          align-items: center;
          gap: 7px;
          width: 100%;
          padding: 9px;
          border: 1px solid #e9e5de;
          border-radius: 8px;
          color: #6c7772;
          background: #fffefa;
          font-size: 9px;
          font-weight: 700;
          text-align: left;
        }
        .note-lines { display: grid; gap: 7px; margin-top: 11px; }
        .note-lines i { display: block; height: 5px; border-radius: 3px; background: #eeece6; }
        .note-lines i:nth-child(2) { width: 80%; }
        .note-lines i:nth-child(3) { width: 58%; }
        .scrim {
          position: absolute;
          inset: 76px 0 0;
          pointer-events: none;
          background: rgba(247, 246, 241, .17);
        }
        .toast {
          position: absolute;
          z-index: 3;
          right: 17px;
          bottom: 17px;
          width: 437px;
          padding: 16px 17px 15px;
          border: 1px solid #f0ae80;
          border-radius: 14px;
          background: #fffaf3;
          box-shadow: 0 18px 40px rgba(85, 60, 40, .19), 0 3px 8px rgba(85, 60, 40, .08);
        }
        .toast.is-hidden { display: none; }
        .toast-topline {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }
        .toast-kicker {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #bd582c;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .11em;
        }
        .toast-kicker .pulse {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #d66d35;
          box-shadow: 0 0 0 4px #f9e1d1;
        }
        .close-toast {
          display: grid;
          place-items: center;
          width: 24px;
          height: 24px;
          margin-top: -4px;
          border: 0;
          border-radius: 7px;
          color: #9ba09b;
          background: transparent;
          cursor: pointer;
        }
        .close-toast:hover { background: #f6ede3; color: #59635e; }
        .toast-title { margin: 9px 0 3px; color: #283730; font-size: 16px; font-weight: 800; letter-spacing: -.025em; }
        .toast-copy { max-width: 375px; color: #6f7973; font-size: 10px; line-height: 1.45; }
        .progress-track {
          position: relative;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin: 17px 1px 14px;
        }
        .progress-track:before {
          content: "";
          position: absolute;
          top: 11px;
          left: 8%;
          right: 8%;
          height: 2px;
          background: #eadbd1;
        }
        .progress-track:after {
          content: "";
          position: absolute;
          top: 11px;
          left: 8%;
          width: 43%;
          height: 2px;
          background: #ce6d39;
          transition: width .25s ease;
        }
        .progress-track[data-stage="acw"]:after { width: 73%; }
        .progress-track[data-stage="next"]:after { width: 84%; }
        .progress-step {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 7px;
          color: #aaa9a2;
          font-size: 9px;
          font-weight: 700;
        }
        .progress-step.active { color: #a7502e; }
        .progress-step.done { color: #6f8276; }
        .progress-number {
          width: 23px;
          height: 23px;
          display: grid;
          place-items: center;
          border: 2px solid #e8d8cf;
          border-radius: 50%;
          color: #acaaa3;
          background: #fffaf3;
          font-family: "IBM Plex Mono", monospace;
          font-size: 9px;
          font-weight: 700;
        }
        .progress-step.active .progress-number { border-color: #ce6d39; color: #a7502e; background: #fff1e5; }
        .progress-step.done .progress-number { border-color: #a8c0b0; color: #577260; background: #edf5ee; }
        .next-call {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 11px 12px;
          border: 1px solid #eadfd5;
          border-radius: 10px;
          background: #fffdf9;
        }
        .next-call-label { display: flex; align-items: center; gap: 9px; }
        .next-call-icon {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          color: #4c7e8b;
          background: #e6f0f0;
        }
        .next-call small { display: block; margin-bottom: 3px; color: #a3a8a1; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
        .next-call strong { color: #465650; font-family: "IBM Plex Mono", monospace; font-size: 11px; font-weight: 700; }
        .next-call-time { color: #7f8982; font-family: "IBM Plex Mono", monospace; font-size: 9px; }
        .toast-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 13px; }
        .action-note { display: flex; align-items: center; gap: 6px; color: #9ba09a; font-size: 9px; }
        .action-note svg { color: #cf783d; }
        .primary-action {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 12px;
          border: 0;
          border-radius: 8px;
          color: #fffaf5;
          background: #bd6034;
          box-shadow: 0 3px 7px rgba(178, 84, 41, .19);
          cursor: pointer;
          font-size: 9px;
          font-weight: 800;
        }
        .primary-action:hover { background: #a84e28; }
        .states {
          position: absolute;
          z-index: 2;
          left: 21px;
          bottom: 19px;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 8px;
          border: 1px solid #e7e0d7;
          border-radius: 10px;
          background: rgba(255, 252, 246, .92);
          box-shadow: 0 5px 17px rgba(74, 63, 51, .07);
        }
        .state-cell {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 3px 4px;
          color: #8f9791;
          font-size: 8px;
          font-weight: 700;
          white-space: nowrap;
        }
        .state-cell svg { stroke-width: 1.8; }
        .state-cell.red { color: #bf5a51; }
        .state-cell.orange { color: #c77b39; }
        .state-cell.blue { color: #598596; }
        .state-cell.green { color: #65906e; }
        .state-cell.amber { color: #ae8a48; }
        .state-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
        .state-divider { width: 1px; height: 13px; background: #e7e1d9; }
      `}</style>

      <header className="workspace-top">
        <div className="brand-mark">
          <span className="brand-icon"><Activity size={16} strokeWidth={2.2} /></span>
          Nexus Pulse
        </div>
        <div className="workspace-meta">
          <span>Medical Partner Cooperation</span>
          <span className="availability"><i /> Available</span>
          <UserRound size={15} />
        </div>
      </header>

      <section className="workspace-body" aria-label="Cropped Nexus Pulse clinic workspace">
        <div className="left-workspace">
          <div className="crumbs"><span>Campaigns</span><span>/</span><strong>Viva Clinic</strong></div>
          <div className="patient-strip">
            <div className="patient-title">
              <div className="patient-avatar">VV</div>
              <div><div className="patient-name">Tes Klinika Viva</div><div className="patient-role">Medical partner · Bratislava</div></div>
            </div>
            <SlidersHorizontal size={15} color="#a3aaa5" />
          </div>
          <nav className="tabs"><span className="selected">Overview</span><span>Contact data</span><span>Activity</span></nav>

          <div className="section-title">Clinic details <span>Read-only view</span></div>
          <div className="record-card">
            <div className="record-row"><span className="record-label">Clinic name</span><span className="record-value">Tes Klinika Viva</span></div>
            <div className="record-row"><span className="record-label">Country</span><span className="record-value">Slovakia</span></div>
            <div className="record-row"><span className="record-label">Representative</span><span className="record-value muted">Not assigned</span></div>
            <div className="record-row"><span className="record-label">Last contacted</span><span className="record-value">Today, 10:21</span></div>
          </div>

          <div className="section-title">Recent activity <span>View all</span></div>
          <div className="activity-card">
            <div className="activity-icon"><Phone size={13} /></div>
            <div><div className="activity-line">Outbound call attempted</div><div className="activity-sub">No answer after 30 seconds · Just now</div></div>
          </div>
          <div className="activity-card" style={{ marginTop: 8, opacity: .62 }}>
            <div className="activity-icon"><MessageSquare size={13} /></div>
            <div><div className="activity-line">Previous note added</div><div className="activity-sub">Partner requested a follow-up</div></div>
          </div>
        </div>

        <aside className="right-panel">
          <div className="contact-heading">Peter Seman <ChevronDown size={14} /></div>
          <div className="contact-sub">Primary contact · New lead</div>
          <div className="panel-rule" />
          <div className="mini-label">Contact details</div>
          <div className="contact-phone"><span className="phone-dot"><Phone size={12} /></span>+421 948 519 438</div>
          <div className="contact-phone"><span className="phone-dot"><MessageSquare size={12} /></span>seman@dialcom.sk</div>
          <div className="panel-rule" />
          <div className="mini-label">Quick actions</div>
          <div className="action-stack">
            <div className="ghost-action"><PhoneCall size={13} /> Call contact</div>
            <div className="ghost-action"><MessageSquare size={13} /> Send message</div>
            <div className="ghost-action"><CalendarClock size={13} /> Schedule task</div>
          </div>
          <div className="panel-rule" />
          <div className="mini-label">Latest note</div>
          <div className="note-lines"><i /><i /><i /></div>
        </aside>
      </section>

      <div className="scrim" />

      <section className="states" aria-label="Call state icon set">
        {stages.map((item, index) => {
          const StageIcon = item.Icon;
          return (
            <span className={`state-cell ${item.tone}`} key={item.key} title={`${item.label}: ${item.detail}`}>
              {index === 0 ? <span className="state-dot" /> : <StageIcon size={13} />}
              <span>{item.key === "acw" ? "ACW" : item.key === "next" ? "Next" : item.label}</span>
            </span>
          );
        })}
      </section>

      <div className={`toast ${!isVisible ? "is-hidden" : ""}`} role="status" aria-live="polite">
        <div className="toast-topline">
          <div className="toast-kicker"><span className="pulse" /> Mission control · handoff</div>
          <button className="close-toast" aria-label="Dismiss notification" onClick={() => setIsVisible(false)}><X size={14} /></button>
        </div>
        <h1 className="toast-title">Call not connected</h1>
        <div className="toast-copy">Ring limit reached. The call was ended automatically after 30 seconds without an answer.</div>

        <div className="progress-track" data-stage={stage}>
          <div className={`progress-step ${stage === "ended" ? "active" : "done"}`}>
            <span className="progress-number">{stage === "ended" ? "1" : <Check size={12} />}</span>
            <span>Ended</span>
          </div>
          <div className={`progress-step ${stage === "acw" ? "active" : stage === "next" ? "done" : ""}`}>
            <span className="progress-number">{stage === "next" ? <Check size={12} /> : "2"}</span>
            <span>ACW</span>
          </div>
          <div className={`progress-step ${stage === "next" ? "active" : ""}`}>
            <span className="progress-number">3</span>
            <span>Next call</span>
          </div>
        </div>

        <div className="next-call">
          <div className="next-call-label">
            <span className="next-call-icon"><PhoneForwarded size={15} /></span>
            <div><small>{stage === "ended" ? "Up next" : stage === "acw" ? "After-call work" : "Ready to dial"}</small><strong>{stage === "ended" ? "After-call work" : "+421 948 519 438"}</strong></div>
          </div>
          <span className="next-call-time">{stage === "ended" ? "00:03" : stage === "acw" ? "Review" : "Now"}</span>
        </div>

        <div className="toast-actions">
          <span className="action-note"><Clock3 size={13} /> No data was lost</span>
          <button className="primary-action" onClick={advance}>
            {stage === "ended" ? "Open ACW" : stage === "acw" ? "Prepare next call" : "Dial next number"}
            <ChevronDown size={13} style={{ transform: "rotate(-90deg)" }} />
          </button>
        </div>
      </div>
    </main>
  );
}