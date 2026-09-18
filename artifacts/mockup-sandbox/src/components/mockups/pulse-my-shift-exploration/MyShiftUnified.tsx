import { useMemo, useState } from "react";
import {
  ArrowDownUp,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Coffee,
  History,
  Mail,
  MessageSquare,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";

type ActivityType = "all" | "call" | "email" | "sms" | "missed" | "break" | "session";
type SearchField = "all" | "name" | "phone" | "queue" | "subject";
type SortKey = "newest" | "oldest" | "name" | "missed";

type Activity = {
  id: number;
  type: Exclude<ActivityType, "all">;
  name: string;
  identity: string;
  queue?: string;
  time: string;
  minutesAgo: number;
  direction?: "inbound" | "outbound";
  status?: string;
  detail: string;
  secondary?: string;
  duration?: string;
  ring?: string;
  action?: "card" | "review";
  initials?: string;
};

const initialActivities: Activity[] = [
  {
    id: 1,
    type: "call",
    name: "Martin Kováč",
    identity: "+421 905 481 220",
    queue: "Bratislava · inbound",
    time: "09:42",
    minutesAgo: 12,
    direction: "outbound",
    status: "Connected",
    detail: "Outbound call completed",
    secondary: "Disposition: Callback scheduled",
    duration: "08:36",
    ring: "00:18",
    action: "card",
    initials: "MK",
  },
  {
    id: 2,
    type: "missed",
    name: "Ambulancia Medifem",
    identity: "+421 948 519 438",
    queue: "Medical partners",
    time: "09:18",
    minutesAgo: 36,
    direction: "inbound",
    status: "Missed",
    detail: "Missed communication needs follow-up",
    secondary: "Queue timeout · 2 contacts found",
    duration: "4m 02s wait",
    action: "review",
    initials: "AM",
  },
  {
    id: 3,
    type: "email",
    name: "Zdravotné centrum Iris",
    identity: "recepcia@centrum-iris.sk",
    queue: "Partner enquiries",
    time: "08:31",
    minutesAgo: 83,
    status: "Received",
    detail: "Potvrdenie termínu spolupráce",
    secondary: "Unread email",
    action: "card",
    initials: "ZI",
  },
  {
    id: 4,
    type: "call",
    name: "Lucia Horváthová",
    identity: "+421 911 204 773",
    queue: "Bratislava · inbound",
    time: "08:54",
    minutesAgo: 60,
    direction: "inbound",
    status: "Connected",
    detail: "Inbound call completed",
    secondary: "Disposition: Completed",
    duration: "05:14",
    ring: "00:42",
    action: "card",
    initials: "LH",
  },
  {
    id: 5,
    type: "sms",
    name: "Jana Bieliková",
    identity: "+421 903 884 112",
    queue: "SMS",
    time: "08:08",
    minutesAgo: 106,
    status: "Sent",
    detail: "Follow-up SMS sent",
    secondary: "Prosím zavolajte mi späť po 14:00.",
    initials: "JB",
  },
  {
    id: 6,
    type: "break",
    name: "Lunch break",
    identity: "Today",
    queue: "Personal time",
    time: "12:00",
    minutesAgo: -50,
    status: "Scheduled",
    detail: "Planned break",
    secondary: "12:00–12:30",
  },
  {
    id: 7,
    type: "session",
    name: "Shift started",
    identity: "NEXUS Pulse",
    queue: "Morning shift",
    time: "07:56",
    minutesAgo: 118,
    status: "Active",
    detail: "Session opened",
    secondary: "Bratislava team · 2h 06m active",
  },
];

const typeLabels: Record<ActivityType, string> = {
  all: "All activity",
  call: "Calls",
  email: "Email",
  sms: "SMS",
  missed: "Missed communications",
  break: "Breaks",
  session: "Sessions",
};

const searchLabels: Record<SearchField, string> = {
  all: "All fields",
  name: "Name",
  phone: "Phone",
  queue: "Queue",
  subject: "Subject",
};

const sortLabels: Record<SortKey, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  name: "Name A–Z",
  missed: "Missed first",
};

function ActivityIcon({ type, direction, size = 17 }: { type: Activity["type"]; direction?: Activity["direction"]; size?: number }) {
  if (type === "missed") return <PhoneMissed size={size} aria-hidden="true" />;
  if (type === "call") return direction === "inbound"
    ? <PhoneIncoming size={size} aria-hidden="true" />
    : <PhoneOutgoing size={size} aria-hidden="true" />;
  if (type === "email") return <Mail size={size} aria-hidden="true" />;
  if (type === "sms") return <MessageSquare size={size} aria-hidden="true" />;
  if (type === "break") return <Coffee size={size} aria-hidden="true" />;
  return <History size={size} aria-hidden="true" />;
}

function typeClass(type: Activity["type"]) {
  if (type === "missed") return "msu-avatar missed";
  if (type === "call") return "msu-avatar call";
  if (type === "email") return "msu-avatar email";
  if (type === "sms") return "msu-avatar sms";
  if (type === "break") return "msu-avatar break";
  return "msu-avatar session";
}

export function MyShiftUnified() {
  const [activities, setActivities] = useState(initialActivities);
  const [activityType, setActivityType] = useState<ActivityType>("all");
  const [searchField, setSearchField] = useState<SearchField>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [searchFocused, setSearchFocused] = useState(false);
  const [feedback, setFeedback] = useState("");

  const counts = useMemo(() => ({
    all: activities.length,
    call: activities.filter(item => item.type === "call").length,
    email: activities.filter(item => item.type === "email").length,
    sms: activities.filter(item => item.type === "sms").length,
    missed: activities.filter(item => item.type === "missed").length,
    break: activities.filter(item => item.type === "break").length,
    session: activities.filter(item => item.type === "session").length,
  }), [activities]);

  const visibleActivities = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const filtered = activities.filter(item => {
      if (activityType === "call" && !["call", "missed"].includes(item.type)) return false;
      if (activityType !== "all" && activityType !== "call" && item.type !== activityType) return false;
      if (!normalized) return true;

      const values: Record<SearchField, string> = {
        all: `${item.name} ${item.identity} ${item.queue ?? ""} ${item.detail} ${item.secondary ?? ""}`,
        name: item.name,
        phone: item.identity,
        queue: item.queue ?? "",
        subject: item.detail,
      };
      return values[searchField].toLocaleLowerCase().includes(normalized);
    });

    return filtered.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "sk");
      if (sort === "oldest") return b.minutesAgo - a.minutesAgo;
      if (sort === "missed") return Number(b.type !== "missed") - Number(a.type !== "missed") || a.minutesAgo - b.minutesAgo;
      return a.minutesAgo - b.minutesAgo;
    });
  }, [activityType, activities, query, searchField, sort]);

  const hasFilters = activityType !== "all" || query.trim().length > 0 || sort !== "newest";

  function resetView() {
    setActivityType("all");
    setSearchField("all");
    setQuery("");
    setSort("newest");
    setFeedback("Filters reset");
  }

  function handleAction(item: Activity) {
    setFeedback(item.action === "review"
      ? `Missed communications opened for ${item.name}`
      : `Contact card opened for ${item.name}`);
  }

  function closeActivity(id: number) {
    setActivities(current => current.filter(item => item.id !== id));
    setFeedback("Activity removed from this preview");
  }

  const searchHint = searchField === "all"
    ? "Search name, phone, queue, subject…"
    : `Search by ${searchLabels[searchField].toLowerCase()}…`;

  return (
    <main className="msu-stage">
      <style>{`
        .msu-stage {
          --msu-ink: #18314d;
          --msu-muted: #69809a;
          --msu-soft: #edf5fb;
          --msu-line: #dce8f2;
          --msu-blue: #2d6fba;
          --msu-blue-dark: #1c568f;
          --msu-alert: #bf5c4f;
          --msu-alert-soft: #fff1ed;
          --msu-green: #3f826e;
          --msu-green-soft: #eaf6f1;
          min-height: 100dvh;
          padding: 34px;
          display: grid;
          place-items: center;
          color: var(--msu-ink);
          background: #eaf2f8;
          font-family: "Plus Jakarta Sans", "Avenir Next", system-ui, sans-serif;
        }
        .msu-stage *, .msu-stage *::before, .msu-stage *::after { box-sizing: border-box; }
        .msu-dialog {
          width: min(1040px, 100%);
          min-height: min(760px, calc(100dvh - 68px));
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #fbfdff;
          border: 1px solid #caddeb;
          border-radius: 18px;
          box-shadow: 0 26px 70px rgba(28, 67, 103, .16);
        }
        .msu-header {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 21px 25px 19px;
          background: #f8fbfe;
          border-bottom: 1px solid var(--msu-line);
        }
        .msu-title-icon {
          width: 42px; height: 42px; flex: none;
          display: grid; place-items: center;
          color: var(--msu-blue); background: #e5f0fa;
          border: 1px solid #c9deef; border-radius: 13px;
        }
        .msu-title-copy { min-width: 0; flex: 1; }
        .msu-kicker {
          margin: 0 0 3px; color: var(--msu-blue);
          font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
        }
        .msu-title-copy h1 { margin: 0; color: #173452; font-size: 20px; line-height: 1.15; letter-spacing: -.025em; }
        .msu-title-copy p { margin: 5px 0 0; color: var(--msu-muted); font-size: 11px; }
        .msu-summary {
          display: flex; align-items: center; gap: 7px; margin-right: 12px;
          color: #365b77; font-size: 11px; font-weight: 800; white-space: nowrap;
        }
        .msu-summary-dot { width: 7px; height: 7px; background: var(--msu-blue); border-radius: 50%; }
        .msu-close {
          width: 30px; height: 30px; display: grid; place-items: center; flex: none;
          color: #7690a6; background: transparent; border: 0; border-radius: 8px; cursor: pointer;
        }
        .msu-close:hover { color: var(--msu-ink); background: var(--msu-soft); }
        .msu-metrics {
          display: grid; grid-template-columns: repeat(4, 1fr);
          padding: 13px 25px; background: #fff; border-bottom: 1px solid var(--msu-line);
        }
        .msu-metric { padding: 0 15px; border-left: 1px solid var(--msu-line); }
        .msu-metric:first-child { padding-left: 0; border-left: 0; }
        .msu-metric strong, .msu-metric span { display: block; }
        .msu-metric strong { color: #294964; font-size: 18px; letter-spacing: -.03em; }
        .msu-metric span { margin-top: 3px; color: #8096a8; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .07em; }
        .msu-metric.alert strong { color: var(--msu-alert); }
        .msu-metric.green strong { color: var(--msu-green); }
        .msu-search-area { padding: 16px 25px 11px; background: #fff; }
        .msu-toolbar { display: flex; align-items: center; gap: 8px; position: relative; }
        .msu-search {
          min-width: 190px; height: 39px; display: flex; align-items: center; gap: 8px; flex: 1;
          padding: 0 11px; color: #88a0b6; background: #fff;
          border: 1px solid #c7d8e7; border-radius: 11px;
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        .msu-search:focus-within { border-color: #5a94ca; box-shadow: 0 0 0 3px rgba(45,111,186,.12); }
        .msu-search input { width: 100%; min-width: 0; color: var(--msu-ink); background: transparent; border: 0; outline: 0; font-size: 12px; }
        .msu-search input::placeholder { color: #8ba0b3; }
        .msu-clear-search { display: grid; padding: 3px; color: #7891a6; background: transparent; border: 0; border-radius: 5px; cursor: pointer; }
        .msu-clear-search:hover { background: var(--msu-soft); color: var(--msu-blue); }
        .msu-picker, .msu-sort {
          height: 39px; display: inline-flex; align-items: center; gap: 7px; flex: none;
          padding: 0 11px; color: #506b84; background: #fff;
          border: 1px solid #c7d8e7; border-radius: 11px; font-size: 11px; font-weight: 700;
        }
        .msu-picker select, .msu-sort select { max-width: 122px; color: inherit; background: transparent; border: 0; outline: 0; font-size: 11px; font-weight: 700; cursor: pointer; }
        .msu-suggestions {
          position: absolute; z-index: 4; top: 46px; left: 0; width: min(430px, calc(100% - 250px));
          padding: 5px; background: #fff; border: 1px solid #c8dbea; border-radius: 11px;
          box-shadow: 0 12px 26px rgba(31, 75, 111, .14);
        }
        .msu-suggestion {
          width: 100%; display: flex; align-items: center; gap: 8px; padding: 8px;
          color: var(--msu-ink); text-align: left; background: transparent; border: 0; border-radius: 7px;
          cursor: pointer;
        }
        .msu-suggestion:hover, .msu-suggestion:focus-visible { background: var(--msu-soft); outline: 0; }
        .msu-suggestion-avatar { width: 24px; height: 24px; display: grid; place-items: center; color: var(--msu-blue); background: #e5f0fa; border-radius: 7px; font-size: 9px; font-weight: 800; }
        .msu-suggestion-copy { min-width: 0; flex: 1; }
        .msu-suggestion-copy strong, .msu-suggestion-copy span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .msu-suggestion-copy strong { font-size: 11px; }
        .msu-suggestion-copy span { margin-top: 2px; color: var(--msu-muted); font-size: 10px; }
        .msu-suggestion-hint { color: #88a0b6; font-size: 9px; white-space: nowrap; }
        .msu-filters {
          display: flex; align-items: center; flex-wrap: wrap; gap: 7px;
          padding: 0 25px 14px; border-bottom: 1px solid var(--msu-line); background: #fff;
        }
        .msu-filter-label { margin-right: 2px; color: #8ca0b3; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
        .msu-chip {
          height: 27px; display: inline-flex; align-items: center; gap: 5px; padding: 0 9px;
          color: #637e96; background: #f0f5f9; border: 1px solid transparent; border-radius: 8px;
          font-size: 10px; font-weight: 800; cursor: pointer; white-space: nowrap;
        }
        .msu-chip:hover { border-color: #b7cee1; color: var(--msu-blue-dark); }
        .msu-chip.active { color: #fff; background: var(--msu-blue); box-shadow: 0 3px 8px rgba(45,111,186,.2); }
        .msu-chip.missed.active { background: var(--msu-alert); box-shadow: 0 3px 8px rgba(191,92,79,.18); }
        .msu-chip-count { min-width: 17px; padding: 2px 4px; border-radius: 5px; color: #6f8da5; background: #dfeaf3; font-size: 9px; text-align: center; }
        .msu-chip.active .msu-chip-count { color: #e9f4ff; background: rgba(255,255,255,.2); }
        .msu-filter-divider { width: 1px; height: 18px; margin: 0 3px; background: var(--msu-line); }
        .msu-list { min-height: 0; flex: 1; overflow: auto; padding: 15px 25px 21px; background: #f7fbfe; }
        .msu-list-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 1px 9px; }
        .msu-result-count { color: #294964; font-size: 12px; font-weight: 800; }
        .msu-result-count span { color: #86a0b5; font-weight: 600; }
        .msu-list-tools { display: flex; align-items: center; gap: 8px; }
        .msu-list-tools span { color: #87a0b5; font-size: 10px; }
        .msu-reset {
          display: inline-flex; align-items: center; gap: 4px; padding: 4px 7px;
          color: var(--msu-blue); background: transparent; border: 0; border-radius: 6px;
          font-size: 10px; font-weight: 800; cursor: pointer;
        }
        .msu-reset:hover { background: #e6f1fa; }
        .msu-row {
          display: flex; align-items: center; gap: 11px; margin: 7px 0; padding: 12px;
          background: #fff; border: 1px solid #dce8f1; border-radius: 13px;
          box-shadow: 0 2px 7px rgba(25, 66, 103, .045);
          transition: border-color .15s ease, transform .15s ease;
        }
        .msu-row:hover { border-color: #a9c7df; transform: translateY(-1px); }
        .msu-avatar { width: 38px; height: 38px; display: grid; place-items: center; flex: none; border-radius: 11px; font-size: 10px; font-weight: 800; }
        .msu-avatar.call { color: #2d6fba; background: #eaf3fb; }
        .msu-avatar.missed { color: #ad5549; background: #fff0ec; }
        .msu-avatar.email { color: #4c73b3; background: #eef3ff; }
        .msu-avatar.sms { color: #5d7e70; background: #edf6f1; }
        .msu-avatar.break { color: #b77741; background: #fff4e8; }
        .msu-avatar.session { color: #5d76a0; background: #edf1fa; }
        .msu-row-main { min-width: 0; flex: 1; }
        .msu-row-top { display: flex; align-items: center; gap: 7px; min-width: 0; }
        .msu-row-main strong { overflow: hidden; color: #1d3d5a; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
        .msu-identity, .msu-context { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .msu-identity { margin-top: 3px; color: #7089a0; font-size: 10px; }
        .msu-context { margin-top: 5px; color: #57728a; font-size: 10px; }
        .msu-context b { color: #345b7b; font-weight: 800; }
        .msu-badge { display: inline-flex; align-items: center; gap: 4px; flex: none; padding: 3px 6px; border-radius: 6px; font-size: 9px; font-weight: 800; }
        .msu-badge.missed { color: #ae5549; background: var(--msu-alert-soft); }
        .msu-badge.positive { color: var(--msu-green); background: var(--msu-green-soft); }
        .msu-badge.neutral { color: #567188; background: #eef4f8; }
        .msu-row-meta { min-width: 84px; text-align: right; }
        .msu-row-meta strong, .msu-row-meta span { display: block; }
        .msu-row-meta strong { color: #36556e; font-size: 11px; }
        .msu-row-meta span { margin-top: 3px; color: #89a0b3; font-size: 9px; }
        .msu-meta-pill { display: inline-flex; align-items: center; gap: 4px; margin-top: 5px; padding: 3px 5px; color: #527aa0; background: #edf5fb; border-radius: 5px; font-size: 9px; white-space: nowrap; }
        .msu-row-actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; min-width: 124px; }
        .msu-primary, .msu-secondary {
          min-height: 29px; display: inline-flex; align-items: center; justify-content: center; gap: 5px;
          padding: 0 9px; border-radius: 8px; font-size: 10px; font-weight: 800; white-space: nowrap; cursor: pointer;
        }
        .msu-primary { color: #fff; background: var(--msu-blue); border: 1px solid var(--msu-blue); }
        .msu-primary:hover { background: var(--msu-blue-dark); border-color: var(--msu-blue-dark); }
        .msu-primary.alert { background: var(--msu-alert); border-color: var(--msu-alert); }
        .msu-secondary { color: #567188; background: #fff; border: 1px solid #cddde9; }
        .msu-secondary:hover { color: var(--msu-blue-dark); border-color: #9dbcd4; background: #f3f8fc; }
        .msu-remove { width: 29px; height: 29px; display: grid; place-items: center; padding: 0; color: #7991a5; background: transparent; border: 1px solid transparent; border-radius: 8px; cursor: pointer; }
        .msu-remove:hover { color: var(--msu-alert); background: var(--msu-alert-soft); border-color: #f3d4ce; }
        .msu-empty { min-height: 265px; display: grid; place-items: center; align-content: center; gap: 8px; color: #83a98f; text-align: center; }
        .msu-empty strong { color: #34546c; font-size: 13px; }
        .msu-empty span { max-width: 300px; color: #8098ab; font-size: 11px; line-height: 1.5; }
        .msu-empty-reset { margin-top: 4px; color: var(--msu-blue); background: #e8f3fb; border: 0; border-radius: 8px; padding: 8px 11px; font-size: 10px; font-weight: 800; cursor: pointer; }
        .msu-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 25px; color: #8399ab; background: #fff; border-top: 1px solid var(--msu-line); font-size: 10px; }
        .msu-footer-note { display: inline-flex; align-items: center; gap: 6px; }
        .msu-footer-note svg { color: var(--msu-blue); }
        .msu-feedback { color: var(--msu-green); font-weight: 800; }
        @media (max-width: 760px) {
          .msu-stage { padding: 9px; align-items: start; }
          .msu-dialog { min-height: calc(100dvh - 18px); border-radius: 13px; }
          .msu-header, .msu-search-area, .msu-list, .msu-footer { padding-left: 14px; padding-right: 14px; }
          .msu-filters, .msu-metrics { padding-left: 14px; padding-right: 14px; }
          .msu-summary { display: none; }
          .msu-metrics { grid-template-columns: repeat(2, 1fr); gap: 12px 0; }
          .msu-metric:nth-child(3) { padding-left: 0; border-left: 0; }
          .msu-toolbar { flex-wrap: wrap; }
          .msu-search { flex-basis: 100%; }
          .msu-picker, .msu-sort { flex: 1; min-width: 0; justify-content: space-between; }
          .msu-picker select, .msu-sort select { max-width: calc(100% - 25px); }
          .msu-suggestions { width: 100%; }
          .msu-filter-divider { display: none; }
          .msu-filter-group { width: 100%; overflow-x: auto; padding-bottom: 2px; }
          .msu-row { align-items: flex-start; flex-wrap: wrap; }
          .msu-row-main { min-width: calc(100% - 55px); }
          .msu-row-meta { margin-left: 49px; text-align: left; min-width: 74px; }
          .msu-row-actions { min-width: 0; margin-left: 49px; justify-content: flex-start; flex-wrap: wrap; }
          .msu-footer { align-items: flex-start; flex-direction: column; }
          .msu-list-head { align-items: flex-start; flex-direction: column; gap: 5px; }
        }
      `}</style>

      <section className="msu-dialog" aria-label="My shift activity">
        <header className="msu-header">
          <div className="msu-title-icon"><History size={20} aria-hidden="true" /></div>
          <div className="msu-title-copy">
            <p className="msu-kicker">NEXUS Pulse · activity desk</p>
            <h1>My shift</h1>
            <p>Today, 04 Mar 2025 · morning shift · all queues</p>
          </div>
          <div className="msu-summary" aria-live="polite"><span className="msu-summary-dot" />Session active · 2h 06m</div>
          <button className="msu-close" type="button" aria-label="Close My shift preview"><X size={17} /></button>
        </header>

        <section className="msu-metrics" aria-label="Shift summary">
          <div className="msu-metric"><strong>{counts.call}</strong><span>Calls</span></div>
          <div className="msu-metric alert"><strong>{counts.missed}</strong><span>Missed communications</span></div>
          <div className="msu-metric"><strong>{counts.email + counts.sms}</strong><span>Messages</span></div>
          <div className="msu-metric green"><strong>14:32</strong><span>Talk time</span></div>
        </section>

        <section className="msu-search-area" aria-label="Search and sort shift activity">
          <div className="msu-toolbar">
            <label className="msu-search">
              <Search size={16} aria-hidden="true" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder={searchHint}
                aria-label="Search My shift activity"
              />
              {query && <button className="msu-clear-search" type="button" onMouseDown={event => event.preventDefault()} onClick={() => setQuery("")} aria-label="Clear search"><X size={13} /></button>}
            </label>
            <label className="msu-picker" title="Choose which activity field to search">
              <SlidersHorizontal size={14} aria-hidden="true" />
              <select value={searchField} onChange={event => setSearchField(event.target.value as SearchField)} aria-label="Search field">
                {Object.entries(searchLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <ChevronDown size={13} aria-hidden="true" />
            </label>
            <label className="msu-sort">
              <ArrowDownUp size={14} aria-hidden="true" />
              <select value={sort} onChange={event => setSort(event.target.value as SortKey)} aria-label="Sort My shift activity">
                {Object.entries(sortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <ChevronDown size={13} aria-hidden="true" />
            </label>
            {searchFocused && !query && (
              <div className="msu-suggestions" aria-label="Search suggestions">
                <button className="msu-suggestion" type="button" onMouseDown={event => event.preventDefault()} onClick={() => { setQuery("Martin"); setSearchFocused(false); }}>
                  <span className="msu-suggestion-avatar">MK</span>
                  <span className="msu-suggestion-copy"><strong>Martin Kováč</strong><span>+421 905 481 220 · Bratislava · inbound</span></span>
                  <span className="msu-suggestion-hint">contact</span>
                </button>
                <button className="msu-suggestion" type="button" onMouseDown={event => event.preventDefault()} onClick={() => { setQuery("Medical"); setSearchFocused(false); }}>
                  <span className="msu-suggestion-avatar">AM</span>
                  <span className="msu-suggestion-copy"><strong>Ambulancia Medifem</strong><span>Missed communications · Medical partners</span></span>
                  <span className="msu-suggestion-hint">missed</span>
                </button>
              </div>
            )}
          </div>
        </section>

        <div className="msu-filters">
          <span className="msu-filter-label">Activity</span>
          {(["all", "call", "email", "sms", "missed", "break", "session"] as ActivityType[]).map(key => (
            <button
              key={key}
              type="button"
              className={`msu-chip ${key === "missed" ? "missed" : ""} ${activityType === key ? "active" : ""}`}
              onClick={() => setActivityType(key)}
              aria-pressed={activityType === key}
            >
              {key === "missed" && <PhoneMissed size={12} aria-hidden="true" />}
              {typeLabels[key]}
              <span className="msu-chip-count">{counts[key]}</span>
            </button>
          ))}
        </div>

        <section className="msu-list" aria-label="My shift activity results">
          <div className="msu-list-head">
            <div className="msu-result-count">{visibleActivities.length} activities <span>· {sortLabels[sort]}</span></div>
            <div className="msu-list-tools">
              {hasFilters && <button className="msu-reset" type="button" onClick={resetView}><RefreshCcw size={12} /> Reset view</button>}
              <span aria-live="polite">{feedback}</span>
            </div>
          </div>

          {visibleActivities.length > 0 ? visibleActivities.map(item => (
            <article className="msu-row" key={item.id}>
              <div className={typeClass(item.type)} aria-hidden="true">
                {item.initials ? <span>{item.initials}</span> : <ActivityIcon type={item.type} direction={item.direction} />}
              </div>
              <div className="msu-row-main">
                <div className="msu-row-top">
                  <strong>{item.name}</strong>
                  <span className={`msu-badge ${item.type === "missed" ? "missed" : item.status === "Connected" || item.status === "Sent" || item.status === "Active" ? "positive" : "neutral"}`}>
                    {item.type === "missed" ? <PhoneMissed size={10} /> : <ActivityIcon type={item.type} direction={item.direction} size={10} />}
                    {item.status}
                  </span>
                </div>
                <span className="msu-identity">{item.identity}{item.queue && <> <i>·</i> {item.queue}</>}</span>
                <span className="msu-context"><b>{item.detail}</b>{item.secondary && <> · {item.secondary}</>}</span>
                {item.type === "call" && (
                  <span className="msu-meta-pill">
                    {item.direction === "inbound" ? <PhoneIncoming size={10} /> : <PhoneOutgoing size={10} />}
                    Ring {item.ring} · Talk {item.duration}
                  </span>
                )}
                {item.type === "missed" && (
                  <span className="msu-meta-pill"><CalendarClock size={10} /> Follow-up required</span>
                )}
              </div>
              <div className="msu-row-meta">
                <strong>{item.time}</strong>
                <span>{item.minutesAgo < 0 ? "upcoming" : `${item.minutesAgo} min ago`}</span>
              </div>
              <div className="msu-row-actions">
                {item.action && (
                  <button className={`msu-primary ${item.type === "missed" ? "alert" : ""}`} type="button" onClick={() => handleAction(item)}>
                    {item.type === "missed" ? <PhoneMissed size={13} /> : <UserRound size={13} />}
                    {item.action === "review" ? "Review missed" : "Open card"}
                  </button>
                )}
                {(item.type === "email" || item.type === "sms") && (
                  <button className="msu-secondary" type="button" onClick={() => handleAction(item)}>Open</button>
                )}
                {(item.type === "break" || item.type === "session") && (
                  <button className="msu-secondary" type="button" onClick={() => setFeedback(`${item.name} details opened`)}>Details</button>
                )}
                <button className="msu-remove" type="button" onClick={() => closeActivity(item.id)} aria-label={`Remove ${item.name} from preview`}><X size={13} /></button>
              </div>
            </article>
          )) : (
            <div className="msu-empty">
              <Search size={34} aria-hidden="true" />
              <strong>No activity matches this view</strong>
              <span>Try another name, field, activity type, or sort order. Your full shift history is still available.</span>
              <button className="msu-empty-reset" type="button" onClick={resetView}>Reset view</button>
            </div>
          )}
        </section>

        <footer className="msu-footer">
          <span className="msu-footer-note"><Search size={13} /> Same search, field picker, sorting, and card rhythm as Missed communications</span>
          {feedback && <span className="msu-feedback" role="status">{feedback}</span>}
          <span>Scope: today · all queues</span>
        </footer>
      </section>
    </main>
  );
}

export default MyShiftUnified;