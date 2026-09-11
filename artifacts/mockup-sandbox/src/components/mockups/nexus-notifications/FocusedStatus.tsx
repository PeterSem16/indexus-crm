import { useState } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Check,
  ClipboardList,
  Copy,
  FileText,
  LayoutGrid,
  Mail,
  MoreHorizontal,
  Phone,
  PhoneCall,
  PhoneForwarded,
  PhoneOff,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

type RailState = "ended" | "acw" | "next" | "connected" | "warning";

const railStates: Array<{
  id: RailState;
  label: string;
  detail: string;
  icon: typeof PhoneOff;
}> = [
  { id: "ended", label: "Call ended", detail: "Ring limit reached", icon: PhoneOff },
  { id: "acw", label: "ACW", detail: "Ready for notes", icon: ClipboardList },
  { id: "next", label: "Next call", detail: "Preparing next dial", icon: PhoneForwarded },
  { id: "connected", label: "Connected", detail: "Live call", icon: PhoneCall },
  { id: "warning", label: "Warning", detail: "Needs attention", icon: AlertTriangle },
];

function StateRail({
  active,
  onChange,
}: {
  active: RailState;
  onChange: (state: RailState) => void;
}) {
  return (
    <div className="np-rail" aria-label="Call state examples">
      {railStates.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={`np-rail-item ${active === id ? "is-active" : ""} state-${id}`}
          onClick={() => onChange(id)}
          aria-label={`Show ${label} state`}
          aria-pressed={active === id}
        >
          <span className="np-rail-icon">
            <Icon size={15} strokeWidth={1.8} />
          </span>
          <span className="np-rail-label">{label}</span>
        </button>
      ))}
    </div>
  );
}

function Workspace() {
  return (
    <div className="np-workspace">
      <header className="np-topbar">
        <div className="np-brand-lockup">
          <div className="np-brand-mark">N</div>
          <span>Nexus <b>Pulse</b></span>
        </div>
        <div className="np-breadcrumb">
          <span>Medical Partner Cooperation</span>
          <span className="np-dot" />
          <span className="np-pending">Pending</span>
        </div>
        <div className="np-top-actions">
          <span className="np-top-icon"><Search size={15} /></span>
          <span className="np-top-icon"><Bell size={15} /></span>
          <span className="np-avatar">PS</span>
        </div>
      </header>

      <div className="np-toolbar">
        <div className="np-tabs">
          <span className="is-selected">Contact card</span>
          <span>Activity</span>
          <span>Campaign</span>
        </div>
        <span className="np-close-workspace">Close <X size={13} /></span>
      </div>

      <div className="np-body">
        <aside className="np-nav">
          <span className="np-nav-caption">Contact</span>
          {["Basic info", "Address", "Referral", "Personnel", "Missions", "Cooperation"].map((item, index) => (
            <div key={item} className={`np-nav-item ${index === 0 ? "is-selected" : ""}`}>
              {item}
            </div>
          ))}
          <div className="np-nav-footer">
            <ShieldCheck size={14} />
            <span>Read-only mode</span>
          </div>
        </aside>

        <main className="np-content">
          <div className="np-content-heading">
            <div className="np-section-icon blue"><LayoutGrid size={15} /></div>
            <div>
              <span className="np-eyebrow">CLINIC</span>
              <h2>Basic information</h2>
            </div>
            <MoreHorizontal size={18} className="np-more" />
          </div>

          <div className="np-fields two-col">
            <div className="np-field">
              <label>Name <b>*</b></label>
              <div className="np-input">Tes Klinika Viva</div>
            </div>
            <div className="np-field">
              <label>Country <b>*</b></label>
              <div className="np-input">Slovakia <span>⌄</span></div>
            </div>
          </div>

          <div className="np-rule" />
          <div className="np-content-heading compact">
            <div className="np-section-icon peach"><UserRound size={15} /></div>
            <div>
              <span className="np-eyebrow">CONTACT</span>
              <h2>Peter Seman</h2>
            </div>
          </div>
          <div className="np-fields two-col">
            <div className="np-field">
              <label>Phone</label>
              <div className="np-input phone-input"><span className="np-flag">SK</span> +421 948 519 438 <Phone size={13} /></div>
            </div>
            <div className="np-field">
              <label>Email</label>
              <div className="np-input">seman@dialcom.sk <Mail size={13} /></div>
            </div>
          </div>
          <div className="np-note-line"><FileText size={13} /> Last note added by admin <span>26.06 · 10:22</span></div>
        </main>

        <aside className="np-contact-panel">
          <div className="np-contact-head">
            <div className="np-large-avatar">PS</div>
            <div>
              <strong>Peter Seman</strong>
              <span>New contact</span>
            </div>
          </div>
          <div className="np-contact-status">
            <div className="np-status-line"><span className="status-orange" /> ACW — After Call Work</div>
            <small>00:03</small>
            <button type="button">Close task</button>
          </div>
          <div className="np-panel-tabs"><span className="active">Actions</span><span>Profile</span><span>History</span><span>FAQ</span></div>
          <div className="np-quick-label">Quick actions</div>
          <div className="np-quick-grid">
            <span><Phone size={14} /> Call</span>
            <span><Mail size={14} /> Email</span>
            <span><PhoneForwarded size={14} /> SMS</span>
            <span><CalendarClock size={14} /> Task</span>
          </div>
          <button type="button" className="np-add-note"><FileText size={14} /> Add note</button>
          <div className="np-panel-rule" />
          <div className="np-quick-label">Notes</div>
          <div className="np-mini-note">
            <div><span className="mini-avatar">a</span><b>admin</b><span>26.6. · 10:22</span></div>
            <em>Important</em>
            <p>preco je zivot tak kru ty, preco som na svete sám</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function FocusedStatus() {
  const [active, setActive] = useState<RailState>("ended");
  const [isDismissed, setIsDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  const current = railStates.find((state) => state.id === active) ?? railStates[0];
  const CurrentIcon = current.icon;

  const copyNumber = () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="np-shell">
      <style>{`
        :root {
          color-scheme: light;
          font-family: "Plus Jakarta Sans", "Avenir Next", "Segoe UI", sans-serif;
        }
        * { box-sizing: border-box; }
        button { font: inherit; }
        .np-shell {
          width: min(620px, 100vw);
          min-height: 760px;
          overflow: hidden;
          position: relative;
          color: #334047;
          background: #f5f3ef;
          font-size: 11px;
          letter-spacing: -0.01em;
        }
        .np-workspace {
          min-height: 760px;
          background: #fbfaf8;
        }
        .np-topbar {
          height: 52px;
          display: flex;
          align-items: center;
          padding: 0 17px;
          gap: 18px;
          background: #fffdfa;
          border-bottom: 1px solid #e4e2dd;
        }
        .np-brand-lockup { display: flex; align-items: center; gap: 8px; color: #273b42; font-size: 13px; white-space: nowrap; }
        .np-brand-lockup b { color: #197b78; font-weight: 700; }
        .np-brand-mark { width: 23px; height: 23px; border-radius: 7px; display: grid; place-items: center; color: #fff; font-size: 12px; font-weight: 700; background: #197b78; }
        .np-breadcrumb { display: flex; align-items: center; gap: 8px; color: #687276; font-size: 10px; }
        .np-dot { width: 4px; height: 4px; border-radius: 99px; background: #d4a44c; }
        .np-pending { color: #8b681c; background: #fbefc9; border-radius: 99px; padding: 4px 8px; }
        .np-top-actions { margin-left: auto; display: flex; align-items: center; gap: 12px; color: #7f8b8e; }
        .np-top-icon { display: grid; place-items: center; }
        .np-avatar, .np-large-avatar { display: grid; place-items: center; color: #fff; background: #bf7744; border-radius: 50%; font-weight: 700; }
        .np-avatar { width: 25px; height: 25px; font-size: 9px; }
        .np-toolbar { height: 37px; padding: 0 17px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #ebe9e5; color: #788286; }
        .np-tabs { display: flex; align-items: stretch; gap: 20px; height: 100%; text-transform: uppercase; font-size: 9px; letter-spacing: .06em; font-weight: 700; }
        .np-tabs span { display: grid; place-items: center; position: relative; }
        .np-tabs .is-selected { color: #287c7b; }
        .np-tabs .is-selected:after { content: ""; height: 2px; position: absolute; bottom: 0; left: 0; right: 0; background: #287c7b; }
        .np-close-workspace { display: flex; align-items: center; gap: 5px; font-size: 10px; }
        .np-body { display: grid; grid-template-columns: 105px 1fr 196px; min-height: 671px; }
        .np-nav { padding: 22px 9px; border-right: 1px solid #e8e5e1; background: #f7f6f3; color: #7a8284; position: relative; }
        .np-nav-caption, .np-quick-label { display: block; color: #9b9c97; font-size: 8px; font-weight: 800; letter-spacing: .11em; text-transform: uppercase; }
        .np-nav-caption { padding: 0 9px 9px; }
        .np-nav-item { padding: 9px; border-radius: 6px; font-size: 10px; }
        .np-nav-item.is-selected { color: #b34e4c; background: #f6dddd; font-weight: 700; }
        .np-nav-footer { position: absolute; bottom: 18px; left: 14px; right: 10px; color: #9ca2a1; display: flex; flex-direction: column; gap: 6px; font-size: 8px; }
        .np-content { padding: 26px 22px; background: #fff; }
        .np-content-heading { display: flex; align-items: center; gap: 9px; margin-bottom: 23px; }
        .np-content-heading.compact { margin-top: 23px; margin-bottom: 18px; }
        .np-section-icon { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 7px; }
        .np-section-icon.blue { color: #477ca3; background: #e7f0f5; }
        .np-section-icon.peach { color: #af7554; background: #faeee6; }
        .np-eyebrow { display: block; color: #a0a6a6; font-size: 8px; font-weight: 800; letter-spacing: .1em; }
        .np-content h2 { color: #334047; font-size: 13px; margin: 3px 0 0; font-weight: 700; }
        .np-more { color: #9ca6a8; margin-left: auto; }
        .np-fields { display: grid; gap: 12px; }
        .two-col { grid-template-columns: 1fr 1fr; }
        .np-field label { display: block; color: #6f797c; font-size: 9px; font-weight: 600; margin: 0 0 6px; }
        .np-field label b { color: #c86a68; }
        .np-input { min-height: 33px; display: flex; align-items: center; justify-content: space-between; border: 1px solid #dddeda; border-radius: 7px; padding: 0 10px; color: #8a9294; background: #fdfdfc; }
        .np-input.phone-input { color: #5f6c70; gap: 6px; padding-left: 8px; }
        .np-input svg { color: #288b76; margin-left: auto; }
        .np-flag { color: #9a7963; font-size: 8px; font-weight: 800; padding: 3px 4px; border-radius: 3px; background: #f2e7dc; }
        .np-rule { height: 1px; background: #eeece8; margin: 30px 0 0; }
        .np-note-line { display: flex; align-items: center; gap: 6px; margin-top: 33px; color: #8d9697; font-size: 9px; }
        .np-note-line svg { color: #c08b5e; }
        .np-note-line span { margin-left: auto; color: #acb0ae; }
        .np-contact-panel { background: #fffdfa; border-left: 1px solid #e8e5e1; position: relative; }
        .np-contact-head { display: flex; gap: 10px; align-items: center; padding: 15px 13px 12px; border-bottom: 1px solid #eeeae3; }
        .np-large-avatar { width: 36px; height: 36px; font-size: 10px; }
        .np-contact-head strong { display: block; color: #3c484d; font-size: 11px; }
        .np-contact-head span { display: block; color: #989f9f; font-size: 8px; margin-top: 4px; }
        .np-contact-status { position: relative; padding: 11px 10px 12px; background: #fff7e7; border-bottom: 1px solid #f1e4ca; }
        .np-status-line { display: flex; align-items: center; gap: 6px; color: #755f32; font-weight: 700; font-size: 9px; }
        .status-orange { width: 7px; height: 7px; border-radius: 50%; background: #e6a22f; }
        .np-contact-status small { color: #ad9566; display: block; margin: 5px 0 0 13px; font-size: 8px; }
        .np-contact-status button { position: absolute; top: 10px; right: 9px; color: #88651e; background: #f8e6b9; border: 0; padding: 5px 6px; border-radius: 4px; font-size: 8px; font-weight: 700; }
        .np-panel-tabs { display: flex; justify-content: space-around; border-bottom: 1px solid #eeeae5; height: 31px; }
        .np-panel-tabs span { display: grid; place-items: center; color: #a2a5a2; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; position: relative; }
        .np-panel-tabs .active { color: #b46952; }
        .np-panel-tabs .active:after { content: ""; position: absolute; height: 2px; bottom: 0; left: 4px; right: 4px; background: #b46952; }
        .np-quick-label { margin: 17px 12px 9px; }
        .np-quick-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; padding: 0 10px; }
        .np-quick-grid span { height: 30px; display: flex; align-items: center; gap: 7px; border: 1px solid #e8e5e0; border-left: 2px solid #c8845e; border-radius: 14px; padding: 0 9px; color: #707b7d; font-size: 9px; }
        .np-quick-grid svg { color: #9e6c51; }
        .np-quick-grid span:nth-child(2) { border-left-color: #8c7aae; }
        .np-quick-grid span:nth-child(3) { border-left-color: #5d90ae; }
        .np-add-note { height: 33px; width: calc(100% - 20px); display: flex; align-items: center; justify-content: center; gap: 7px; margin: 13px 10px 0; border: 1px solid #eadbd1; border-radius: 15px; color: #b4775a; background: #faf4f0; font-size: 9px; }
        .np-panel-rule { height: 1px; background: #eeeae5; margin: 15px 10px 0; }
        .np-mini-note { margin: 0 10px; border: 1px solid #edb8b5; border-left: 3px solid #c65050; border-radius: 8px; padding: 10px; background: #fbe3e1; color: #6d5557; }
        .np-mini-note > div { display: flex; align-items: center; gap: 5px; font-size: 8px; }
        .np-mini-note > div span:last-child { color: #a77c7e; margin-left: auto; }
        .mini-avatar { display: grid; place-items: center; width: 14px; height: 14px; border-radius: 50%; color: #fff; background: #c36e63; font-size: 8px; }
        .np-mini-note em { display: inline-block; margin-top: 9px; color: #fff; background: #cc4d49; border-radius: 9px; padding: 3px 6px; font-size: 7px; font-style: normal; font-weight: 700; }
        .np-mini-note p { line-height: 1.45; margin: 8px 0 0; font-size: 9px; }
        .np-toast-wrap { position: absolute; z-index: 5; right: 17px; bottom: 17px; width: 328px; }
        .np-toast { border: 1px solid #e2c4b8; border-left: 4px solid #b95446; border-radius: 11px; padding: 14px 14px 12px; background: #fffaf6; box-shadow: 0 12px 26px rgba(71, 53, 44, .16); }
        .np-toast-top { display: flex; align-items: flex-start; gap: 10px; }
        .np-toast-icon { width: 30px; height: 30px; display: grid; place-items: center; flex: none; border-radius: 8px; color: #b65046; background: #f7e3dc; }
        .np-toast-copy { min-width: 0; flex: 1; }
        .np-toast-title { color: #4a3e3d; font-size: 12px; font-weight: 800; line-height: 1.2; }
        .np-toast-reason { display: flex; align-items: center; gap: 5px; color: #ac6b5c; margin-top: 5px; font-size: 9px; font-weight: 700; }
        .np-toast-description { color: #697174; line-height: 1.45; margin: 9px 0 0; font-size: 10px; }
        .np-toast-close { width: 21px; height: 21px; display: grid; place-items: center; margin: -3px -3px 0 0; border: 0; border-radius: 5px; color: #9caaa9; background: transparent; cursor: pointer; }
        .np-toast-close:hover { background: #f2e7e1; color: #6e7777; }
        .np-toast-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding-top: 10px; border-top: 1px solid #efe1da; }
        .np-next-copy { color: #788284; font-size: 9px; }
        .np-next-copy strong { display: block; color: #4f5c5f; font-size: 9px; margin-top: 2px; }
        .np-toast-actions { display: flex; align-items: center; gap: 6px; }
        .np-copy-number, .np-restore { display: flex; align-items: center; gap: 5px; border: 1px solid #e7d7d0; border-radius: 6px; padding: 6px 8px; color: #a15e51; background: #fff; font-size: 8px; cursor: pointer; }
        .np-copy-number:hover, .np-restore:hover { background: #fff3ed; }
        .np-rail { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin-top: 9px; padding: 6px 5px 5px; border: 1px solid #e7e1dc; border-radius: 9px; background: #faf7f4; }
        .np-rail-item { min-width: 0; display: flex; align-items: center; justify-content: center; gap: 4px; border: 0; border-radius: 6px; padding: 5px 2px; color: #9aa2a0; background: transparent; cursor: pointer; }
        .np-rail-item:hover { background: #f1ebe6; }
        .np-rail-item.is-active { color: #a85147; background: #f6e8e2; }
        .np-rail-item.state-acw.is-active { color: #a2732f; background: #f9edce; }
        .np-rail-item.state-next.is-active { color: #477f91; background: #e5f0f2; }
        .np-rail-item.state-connected.is-active { color: #40826b; background: #e3f0e9; }
        .np-rail-item.state-warning.is-active { color: #aa7330; background: #f7edd7; }
        .np-rail-icon { display: grid; place-items: center; flex: none; }
        .np-rail-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 8px; font-weight: 700; }
        .np-toast-dismissed { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border: 1px solid #e2d8d1; border-radius: 9px; color: #718080; background: rgba(255, 250, 246, .96); box-shadow: 0 8px 18px rgba(71, 53, 44, .1); }
        .np-toast-dismissed span { font-size: 9px; }
        @media (max-width: 560px) {
          .np-body { grid-template-columns: 88px 1fr; }
          .np-contact-panel { display: none; }
          .np-toast-wrap { right: 12px; left: 12px; width: auto; }
          .np-breadcrumb { display: none; }
        }
      `}</style>

      <Workspace />
      <div className="np-toast-wrap" aria-live="polite">
        {isDismissed ? (
          <div className="np-toast-dismissed">
            <span>Notification dismissed</span>
            <button type="button" className="np-restore" onClick={() => setIsDismissed(false)}>Show notice</button>
          </div>
        ) : (
          <div className="np-toast">
            <div className="np-toast-top">
              <div className="np-toast-icon"><CurrentIcon size={17} strokeWidth={1.8} /></div>
              <div className="np-toast-copy">
                <div className="np-toast-title">{active === "ended" ? "Call not connected" : current.label}</div>
                <div className="np-toast-reason"><span className={`status-${active}`} /> {current.detail}</div>
              </div>
              <button type="button" className="np-toast-close" onClick={() => setIsDismissed(true)} aria-label="Dismiss notification"><X size={14} /></button>
            </div>
            <p className="np-toast-description">
              {active === "ended"
                ? "The call ended automatically after 30 s without being answered."
                : active === "acw"
                  ? "Add a brief outcome note before you continue to the next dial."
                  : active === "next"
                    ? "The next contact is ready when you are."
                    : active === "connected"
                      ? "You are connected with Peter Seman."
                      : "Review the call details before starting another dial."}
            </p>
            <div className="np-toast-footer">
              <div className="np-next-copy">Next <strong>{active === "ended" ? "After-call work" : current.label}</strong></div>
              <div className="np-toast-actions">
                <button type="button" className="np-copy-number" onClick={copyNumber}>
                  {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? "Copied" : "+421 948 519 438"}
                </button>
              </div>
            </div>
            <StateRail active={active} onChange={setActive} />
          </div>
        )}
      </div>
    </div>
  );
}