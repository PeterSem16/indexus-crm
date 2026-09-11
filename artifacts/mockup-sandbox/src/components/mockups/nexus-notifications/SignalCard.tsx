import { useState } from "react";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Clock3,
  Mail,
  Menu,
  Phone,
  PhoneCall,
  PhoneOff,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";

type SignalKey = "ended" | "acw" | "next" | "connected" | "warning";

const signalItems: Array<{
  key: SignalKey;
  label: string;
  shortLabel: string;
}> = [
  { key: "ended", label: "Call ended", shortLabel: "Ended" },
  { key: "acw", label: "After-call work", shortLabel: "ACW" },
  { key: "next", label: "Preparing next call", shortLabel: "Next" },
  { key: "connected", label: "Connected", shortLabel: "Live" },
  { key: "warning", label: "Needs attention", shortLabel: "Warn" },
];

function SignalIcon({
  signal,
  size = 18,
}: {
  signal: SignalKey;
  size?: number;
}) {
  if (signal === "ended") return <PhoneOff size={size} strokeWidth={2.1} />;
  if (signal === "acw") return <ClipboardCheck size={size} strokeWidth={2.1} />;
  if (signal === "next") return <PhoneCall size={size} strokeWidth={2.1} />;
  if (signal === "connected") return <Phone size={size} strokeWidth={2.1} />;
  return <TriangleAlert size={size} strokeWidth={2.1} />;
}

function BackgroundShell({
  activeSignal,
  onSelectSignal,
}: {
  activeSignal: SignalKey;
  onSelectSignal: (signal: SignalKey) => void;
}) {
  return (
    <div className="signal-shell">
      <header className="shell-topbar">
        <div className="brand-mark">
          <span className="brand-pulse">
            <span />
            <span />
            <span />
          </span>
          <span>NEXUS <b>PULSE</b></span>
        </div>
        <div className="topbar-divider" />
        <div className="topbar-context">
          <span className="context-dot" />
          <span>Medical Partner Cooperation</span>
          <span className="pending-chip">Pending</span>
        </div>
        <div className="topbar-spacer" />
        <button className="quiet-top-button" type="button" aria-label="Search">
          <Search size={14} />
        </button>
        <button className="end-call-button" type="button">
          <PhoneOff size={13} />
          End call
        </button>
      </header>

      <div className="shell-toolbar">
        <div className="toolbar-tabs">
          <span className="toolbar-tab is-active">CONTACT CARD</span>
          <span className="toolbar-tab">
            <Mail size={12} /> EMAIL
          </span>
          <span className="toolbar-tab">
            <Menu size={12} /> STATUS LIST
          </span>
        </div>
        <span className="close-workspace">
          <X size={13} /> Close
        </span>
      </div>

      <div className="readonly-banner">
        <ShieldAlert size={13} />
        <span>Read-only mode — editing data is disabled in this campaign.</span>
        <u>Create task</u>
      </div>

      <div className="shell-main">
        <nav className="left-rail" aria-label="Contact sections">
          {["Basic Info", "Address", "Referral", "Personnel", "Missions", "Representative"].map(
            (item, index) => (
              <span className={index === 0 ? "rail-item active" : "rail-item"} key={item}>
                {item}
              </span>
            ),
          )}
        </nav>

        <main className="contact-workspace">
          <div className="workflow-steps">
            {["Contact", "Referral", "Cooperation", "Contract", "Partner"].map((step, index) => (
              <div className="workflow-step" key={step}>
                <span className={index === 0 ? "step-icon current" : "step-icon"}>
                  {index === 0 ? <UserRound size={12} /> : <Check size={12} />}
                </span>
                <span>{step}</span>
                {index < 4 && <span className="step-line" />}
              </div>
            ))}
          </div>

          <section className="clinic-section">
            <div className="section-heading">
              <span className="section-icon clinic">
                <ShieldAlert size={15} />
              </span>
              <h2>Clinic</h2>
              <span className="saved-note">Saved just now</span>
            </div>
            <div className="field-grid">
              <div className="fake-field">
                <label>Name *</label>
                <span>Tes Klinika Viva</span>
              </div>
              <div className="fake-field">
                <label>Country *</label>
                <span><span className="flag-dot" /> Slovakia</span>
              </div>
            </div>
            <div className="expand-row">
              <span><span className="help-dot">?</span> Additional identifiers</span>
              <span>⌄</span>
            </div>
          </section>

          <section className="contact-section">
            <div className="section-heading">
              <span className="section-icon contact">
                <Phone size={15} />
              </span>
              <h2>Contact</h2>
            </div>
            <div className="field-grid">
              <div className="fake-field">
                <label>Phone</label>
                <span>+421&nbsp;&nbsp;948 519 438</span>
              </div>
              <div className="fake-field">
                <label>Email</label>
                <span>seman@dialcom.sk</span>
              </div>
            </div>
            <div className="field-grid lower-fields">
              <div className="fake-field">
                <label>Phone 2</label>
                <span>+421&nbsp;&nbsp;918 751 470</span>
              </div>
              <div className="fake-field">
                <label>Email 2</label>
                <span>dialcom@dialcom.sk</span>
              </div>
            </div>
          </section>
        </main>

        <aside className="contact-panel">
          <div className="profile-head">
            <div className="profile-avatar">PS</div>
            <div>
              <strong>Peter Seman</strong>
              <span className="profile-tag">Nový</span>
            </div>
          </div>
          <div className="panel-state acw-state">
            <span className="state-mark orange"><Clock3 size={12} /></span>
            <div><b>ACW — After Call Work</b><small>00:03</small></div>
            <button type="button">Close task</button>
          </div>
          <div className="panel-state ended-state">
            <span className="state-mark red" />
            <b>Call ended</b>
          </div>
          <div className="panel-tabs">
            <span className="active">ACTIONS</span><span>PROFILE</span><span>HISTORY</span><span>FAQ</span>
          </div>
          <div className="panel-actions">
            <small>QUICK ACTIONS</small>
            <div className="action-grid">
              <button type="button"><Phone size={13} /> Call</button>
              <button type="button"><Mail size={13} /> Email</button>
              <button type="button"><Menu size={13} /> SMS</button>
              <button type="button"><ClipboardCheck size={13} /> Task</button>
            </div>
            <button className="add-note" type="button">＋ &nbsp;Add note</button>
          </div>
          <div className="panel-note">
            <small>NOTES</small>
            <div className="note-card">
              <b><UserRound size={11} /> admin <span>26.6. 10:22</span></b>
              <em>Important</em>
              <p>preco je zivot tak kruty, prečo som na svete sám</p>
            </div>
          </div>
        </aside>
      </div>

      <div className="signal-vocabulary">
        <div className="vocabulary-label">
          <span>CALL SIGNALS</span>
          <small>Choose a state to preview</small>
        </div>
        <div className="signal-items">
          {signalItems.map((item) => (
            <button
              className={`signal-item ${item.key} ${activeSignal === item.key ? "selected" : ""}`}
              key={item.key}
              type="button"
              onClick={() => onSelectSignal(item.key)}
              aria-label={`Preview ${item.label}`}
            >
              <span className="signal-glyph"><SignalIcon signal={item.key} size={16} /></span>
              <span>{item.shortLabel}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SignalCard() {
  const [activeSignal, setActiveSignal] = useState<SignalKey>("ended");
  const [isVisible, setIsVisible] = useState(true);
  const activeLabel = signalItems.find((item) => item.key === activeSignal)?.label ?? "Call ended";
  const isPreparing = activeSignal === "next";

  return (
    <div className="signal-card-preview">
      <style>{`
        .signal-card-preview {
          --cream: #f6f2ec;
          --surface: #fffdfa;
          --line: #e7e0d9;
          --ink: #25323a;
          --muted: #7a8587;
          --coral: #d94e48;
          --orange: #d9842d;
          --teal: #317a72;
          min-height: 760px;
          width: 100%;
          overflow: hidden;
          position: relative;
          background: var(--cream);
          color: var(--ink);
          font-family: "Plus Jakarta Sans", "Avenir Next", sans-serif;
          letter-spacing: -0.01em;
        }
        .signal-card-preview *, .signal-card-preview *::before, .signal-card-preview *::after { box-sizing: border-box; }
        .signal-card-preview button { font: inherit; }
        .signal-shell { min-height: 760px; position: relative; overflow: hidden; background: #faf7f2; }
        .shell-topbar { height: 47px; display: flex; align-items: center; gap: 13px; padding: 0 15px; background: #fffdfa; border-bottom: 1px solid #e6e1dc; font-size: 10px; color: #5c676c; }
        .brand-mark { display: flex; align-items: center; gap: 7px; color: #26343d; font-size: 10px; font-weight: 800; letter-spacing: .08em; white-space: nowrap; }
        .brand-mark b { color: #cf524b; font-weight: 800; }
        .brand-pulse { height: 20px; width: 20px; border: 1px solid #d9cec8; border-radius: 6px; display: flex; align-items: center; justify-content: center; gap: 2px; }
        .brand-pulse span { width: 2px; background: #d95c50; border-radius: 4px; }
        .brand-pulse span:nth-child(1) { height: 6px; opacity: .7; }.brand-pulse span:nth-child(2) { height: 11px; }.brand-pulse span:nth-child(3) { height: 8px; opacity: .75; }
        .topbar-divider { width: 1px; height: 17px; background: #e5ded8; }
        .topbar-context { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
        .context-dot { width: 6px; height: 6px; background: #efb753; border-radius: 50%; }
        .pending-chip { background: #fff2ce; color: #a76b18; padding: 4px 8px; border-radius: 9px; font-size: 9px; }
        .topbar-spacer { flex: 1; }
        .quiet-top-button { width: 26px; height: 26px; border: 0; color: #8e9697; background: transparent; display: grid; place-items: center; }
        .end-call-button { border: 0; border-radius: 5px; display: flex; align-items: center; gap: 6px; color: white; background: #dd6a31; font-size: 10px; padding: 8px 10px; }
        .shell-toolbar { height: 39px; display: flex; align-items: center; justify-content: space-between; padding: 0 15px; background: #fffdfa; border-bottom: 1px solid #e5e0db; }
        .toolbar-tabs { height: 100%; display: flex; align-items: center; gap: 17px; }
        .toolbar-tab { height: 100%; display: flex; align-items: center; gap: 5px; color: #92989a; font-size: 9px; font-weight: 700; letter-spacing: .04em; }
        .toolbar-tab.is-active { color: #c74f4b; border-bottom: 2px solid #d75a53; }
        .close-workspace { display: flex; align-items: center; gap: 4px; color: #606d70; font-size: 10px; }
        .readonly-banner { height: 28px; padding: 0 15px; display: flex; align-items: center; gap: 6px; color: #97664b; background: #fff7d9; border-bottom: 1px solid #e8dab9; font-size: 9px; white-space: nowrap; }
        .readonly-banner u { font-weight: 700; color: #9a6041; margin-left: 2px; }
        .shell-main { height: 487px; display: grid; grid-template-columns: 112px 1fr 188px; }
        .left-rail { padding: 26px 7px; border-right: 1px solid #e6e0db; background: #f8f5f1; }
        .rail-item { display: block; padding: 8px 7px; color: #6d7778; font-size: 10px; border-radius: 5px; margin-bottom: 2px; }
        .rail-item.active { color: #c94f4b; background: #f9dedd; font-weight: 700; }
        .contact-workspace { padding: 0 18px; overflow: hidden; background: #fbfaf8; }
        .workflow-steps { height: 61px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e9e4df; }
        .workflow-step { position: relative; display: flex; flex-direction: column; align-items: center; gap: 5px; color: #a0a5a4; font-size: 8px; white-space: nowrap; }
        .step-icon { display: grid; place-items: center; width: 23px; height: 23px; border: 1px solid #ddd8d3; border-radius: 50%; background: #fffdfa; color: #a5abad; }
        .step-icon.current { color: #c9524b; border-color: #e1aaa5; background: #fff0ee; }
        .step-line { position: absolute; width: 40px; height: 1px; background: #e1dcd6; right: -43px; top: 11px; }
        .clinic-section, .contact-section { padding: 17px 0 16px; border-bottom: 1px solid #e6e0db; }
        .section-heading { display: flex; align-items: center; gap: 7px; margin-bottom: 13px; }
        .section-heading h2 { font-size: 14px; margin: 0; font-weight: 700; }
        .saved-note { margin-left: auto; color: #a4aaa9; font-size: 8px; }
        .section-icon { width: 23px; height: 23px; display: grid; place-items: center; border-radius: 5px; }
        .section-icon.clinic { color: #5579bb; background: #e5ecfa; }.section-icon.contact { color: #4a90b3; background: #e2f1f4; }
        .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .fake-field { min-width: 0; }
        .fake-field label { display: block; color: #637074; font-size: 9px; margin-bottom: 5px; }
        .fake-field > span { height: 33px; display: flex; align-items: center; padding: 0 10px; border: 1px solid #e1ddd9; border-radius: 6px; background: #fff; color: #7b8586; font-size: 10px; }
        .flag-dot { width: 12px; height: 8px; background: linear-gradient(#fff 0 33%, #244d9b 33% 66%, #ed4b4b 66%); border: 1px solid #d5d1ce; margin-right: 5px; display: inline-block; }
        .expand-row { display: flex; justify-content: space-between; align-items: center; padding-top: 13px; color: #788284; font-size: 9px; }
        .help-dot { display: inline-grid; place-items: center; height: 13px; width: 13px; border: 1px solid #a9b0af; border-radius: 50%; font-size: 8px; margin-right: 4px; }
        .lower-fields { margin-top: 14px; }
        .contact-panel { border-left: 1px solid #e1dbd6; background: #fffdfa; overflow: hidden; }
        .profile-head { height: 55px; display: flex; align-items: center; gap: 8px; padding: 0 10px; border-bottom: 1px solid #e9e1dc; }
        .profile-avatar { display: grid; place-items: center; width: 38px; height: 38px; color: white; background: #b96f3c; border-radius: 50%; font-size: 11px; font-weight: 700; }
        .profile-head strong { display: block; font-size: 11px; }.profile-tag { display: inline-block; margin-top: 3px; padding: 3px 7px; border-radius: 8px; color: #818786; background: #efeeeb; font-size: 8px; }
        .panel-state { display: flex; align-items: center; gap: 7px; padding: 9px 10px; border-bottom: 1px solid #eae2de; font-size: 10px; }
        .state-mark { display: grid; place-items: center; width: 9px; height: 9px; border-radius: 50%; color: white; }.state-mark.orange { background: #e58d30; width: 14px; height: 14px; }.state-mark.red { background: #df4e4b; }
        .panel-state b { font-size: 10px; }.panel-state small { display: block; color: #a17865; font-size: 8px; margin-top: 2px; }
        .acw-state button { margin-left: auto; border: 1px solid #e3a262; color: #a86225; background: #fff4e8; border-radius: 4px; padding: 6px 7px; font-size: 8px; }
        .panel-tabs { height: 39px; padding: 0 9px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #ece6e1; color: #9a9e9d; font-size: 8px; font-weight: 700; }
        .panel-tabs .active { color: #c4524b; border-bottom: 2px solid #d86058; height: 100%; display: flex; align-items: center; }
        .panel-actions { padding: 14px 10px 12px; border-bottom: 1px solid #eae3dd; }.panel-actions > small, .panel-note > small { color: #9b9b96; font-size: 8px; letter-spacing: .06em; font-weight: 700; }
        .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 9px; }.action-grid button { display: flex; align-items: center; gap: 6px; border: 1px solid #e2ded9; border-left: 3px solid #ca6f47; border-radius: 12px; background: #fffdfa; color: #586468; padding: 8px 6px; font-size: 9px; }.action-grid button:nth-child(2) { border-left-color: #8382bc; }.action-grid button:nth-child(3) { border-left-color: #548aac; }.action-grid button:nth-child(4) { border-left-color: #999384; }
        .add-note { width: 100%; height: 31px; margin-top: 10px; border: 1px solid #eadfd8; border-radius: 12px; background: #f7f0eb; color: #b27455; font-size: 9px; }
        .panel-note { padding: 12px 10px; }.note-card { margin-top: 8px; padding: 8px; border-left: 2px solid #da615c; border-radius: 4px 7px 7px 4px; background: #fce5e1; color: #68504d; font-size: 9px; }.note-card b { display: flex; align-items: center; gap: 3px; font-size: 9px; }.note-card b span { margin-left: auto; color: #aa8881; font-weight: 400; font-size: 8px; }.note-card em { display: inline-block; margin-top: 6px; padding: 3px 6px; border-radius: 7px; color: #fff; background: #d9433e; font-size: 8px; font-style: normal; }.note-card p { margin: 7px 0 0; line-height: 1.4; }
        .signal-vocabulary { height: 82px; position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 18px; padding: 0 17px; border-top: 1px solid #e4ddd7; background: rgba(255,253,250,.96); }
        .vocabulary-label { min-width: 92px; }.vocabulary-label span { display: block; color: #4c5b60; font-size: 8px; font-weight: 800; letter-spacing: .08em; }.vocabulary-label small { display: block; color: #a0a4a2; font-size: 8px; line-height: 1.35; margin-top: 4px; }
        .signal-items { display: flex; flex: 1; justify-content: space-between; gap: 5px; }
        .signal-item { display: flex; min-width: 48px; flex-direction: column; align-items: center; gap: 5px; border: 0; background: transparent; color: #90999a; font-size: 8px; padding: 0; cursor: pointer; }.signal-item:hover { color: #4e6368; }.signal-glyph { display: grid; place-items: center; height: 29px; width: 29px; border: 1px solid #dcdedb; border-radius: 9px; background: #fafaf7; transition: transform .18s ease, color .18s ease, background .18s ease; }.signal-item.selected .signal-glyph { transform: translateY(-2px); color: white; border-color: transparent; }.signal-item.selected { color: #4b5e63; font-weight: 700; }.signal-item.ended.selected .signal-glyph { background: #d94e48; }.signal-item.acw.selected .signal-glyph { background: #d9842d; }.signal-item.next.selected .signal-glyph { background: #317a72; }.signal-item.connected.selected .signal-glyph { background: #3d8a68; }.signal-item.warning.selected .signal-glyph { background: #bd7c2f; }
        .notification-card { position: absolute; right: 16px; bottom: 96px; width: min(360px, calc(100% - 32px)); padding: 15px 16px 14px; border: 1px solid rgba(140, 35, 31, .26); border-radius: 14px; color: #fff; background: #c9322f; box-shadow: 0 13px 29px rgba(91, 44, 37, .19); animation: signal-enter .35s ease-out both; }
        .notification-card.preparing { background: #2e716d; border-color: rgba(24, 74, 70, .35); }.notification-card.warning { background: #b9752b; border-color: rgba(127, 77, 21, .3); }.notification-card.connected { background: #3b8265; border-color: rgba(31, 91, 64, .3); }
        .notification-head { display: flex; align-items: flex-start; gap: 11px; }.strong-signal { display: grid; place-items: center; flex: 0 0 auto; width: 42px; height: 42px; border: 1px solid rgba(255,255,255,.38); border-radius: 12px; background: rgba(255,255,255,.16); }.notification-copy { min-width: 0; padding-top: 1px; }.notification-copy h2 { margin: 0; color: #fff; font-size: 15px; line-height: 1.2; letter-spacing: -.03em; }.notification-copy p { margin: 5px 0 0; color: rgba(255,255,255,.82); font-size: 10px; line-height: 1.42; }.notification-copy p b { color: #fff; font-weight: 700; }
        .notification-divider { height: 1px; background: rgba(255,255,255,.2); margin: 13px 0 11px; }.handoff-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }.handoff-copy { display: flex; align-items: center; gap: 7px; }.handoff-copy > svg { color: rgba(255,255,255,.76); }.handoff-copy small { display: block; color: rgba(255,255,255,.72); font-size: 8px; }.handoff-copy strong { display: block; color: #fff; font-size: 10px; margin-top: 2px; }.next-number { font-family: "Space Mono", monospace; font-size: 9px; letter-spacing: -.04em; color: #fff; }
        .handoff-action { display: flex; align-items: center; gap: 6px; width: 100%; border: 0; border-radius: 8px; margin-top: 12px; padding: 9px 10px; color: #a92d2a; background: #fff; font-size: 10px; font-weight: 800; cursor: pointer; }.preparing .handoff-action { color: #27635f; }.warning .handoff-action { color: #855519; }.connected .handoff-action { color: #2c684f; }.handoff-action svg { margin-left: auto; }.dismiss-action { position: absolute; top: 11px; right: 12px; border: 0; color: rgba(255,255,255,.75); background: transparent; cursor: pointer; font-size: 11px; padding: 2px; }
        .reopen-notification { position: absolute; right: 17px; bottom: 98px; display: flex; align-items: center; gap: 6px; border: 1px solid #df8c87; border-radius: 10px; padding: 9px 11px; color: #bd3c38; background: #fffdfa; box-shadow: 0 7px 18px rgba(94, 47, 41, .11); font-size: 9px; cursor: pointer; }
        @keyframes signal-enter { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 540px) { .shell-main { grid-template-columns: 84px 1fr 168px; }.left-rail { padding-left: 4px; padding-right: 4px; }.contact-workspace { padding: 0 11px; }.signal-vocabulary { gap: 6px; padding-left: 10px; padding-right: 10px; }.vocabulary-label { min-width: 77px; }.signal-item { min-width: 38px; }.notification-card { right: 10px; width: calc(100% - 20px); } }
      `}</style>

      <BackgroundShell activeSignal={activeSignal} onSelectSignal={setActiveSignal} />

      {isVisible ? (
        <section className={`notification-card ${isPreparing ? "preparing" : ""} ${activeSignal === "warning" ? "warning" : ""} ${activeSignal === "connected" ? "connected" : ""}`} aria-live="polite">
          <button className="dismiss-action" type="button" aria-label="Dismiss notification" onClick={() => setIsVisible(false)}>
            <X size={14} />
          </button>
          <div className="notification-head">
            <div className="strong-signal"><SignalIcon signal={activeSignal} size={22} /></div>
            <div className="notification-copy">
              <h2>{activeSignal === "ended" ? "Call not connected" : activeLabel}</h2>
              <p>
                {activeSignal === "ended" && <>The call was automatically ended after <b>30 s</b> without being answered.</>}
                {activeSignal === "next" && <>The next contact is queued and ready for a focused handoff.</>}
                {activeSignal === "acw" && <>Capture the outcome while the call context is still fresh.</>}
                {activeSignal === "connected" && <>The partner answered. Keep the contact context in view.</>}
                {activeSignal === "warning" && <>Review the call status before moving to the next contact.</>}
              </p>
            </div>
          </div>
          <div className="notification-divider" />
          <div className="handoff-row">
            <div className="handoff-copy">
              <PhoneCall size={15} />
              <div><small>{activeSignal === "ended" ? "Next step" : "Current step"}</small><strong>{activeSignal === "ended" ? "After-call work" : activeLabel}</strong></div>
            </div>
            <span className="next-number">+421 948 519 438</span>
          </div>
          <button className="handoff-action" type="button" onClick={() => setActiveSignal("next")}>
            {isPreparing ? "Ready to dial" : "Prepare next call"}
            <ArrowRight size={14} />
          </button>
        </section>
      ) : (
        <button className="reopen-notification" type="button" onClick={() => setIsVisible(true)}>
          <TriangleAlert size={13} /> Show call status
        </button>
      )}
    </div>
  );
}