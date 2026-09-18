import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Mail,
  MessageSquare,
  PhoneMissed,
  RotateCcw,
  Search,
  SlidersHorizontal,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

type Channel = "all" | "calls" | "email" | "sms";
type Status = "all" | "unhandled" | "handled";
type SearchField = "all" | "name" | "phone" | "email" | "queue";
type SortKey = "newest" | "oldest" | "name" | "unhandled";

type MissedItem = {
  id: number;
  channel: Exclude<Channel, "all">;
  name: string;
  identity: string;
  queue?: string;
  reason?: string;
  preview: string;
  time: string;
  minutesAgo: number;
  wait?: string;
  handled: boolean;
  ambiguous?: string;
  initials: string;
};

const initialItems: MissedItem[] = [
  {
    id: 1,
    channel: "calls",
    name: "Martin Kováč",
    identity: "+421 905 481 220",
    queue: "Bratislava · inbound",
    reason: "Caller ended the call",
    preview: "Missed call waiting for a follow-up",
    time: "09:42",
    minutesAgo: 12,
    wait: "1m 18s wait",
    handled: false,
    initials: "MK",
  },
  {
    id: 2,
    channel: "email",
    name: "Zdravotné centrum Iris",
    identity: "recepcia@centrum-iris.sk",
    queue: "Partner enquiries",
    preview: "Potvrdenie termínu spolupráce · Dobrý deň, radi by sme potvrdili náš zajtrajší termín…",
    time: "08:31",
    minutesAgo: 83,
    handled: false,
    initials: "ZI",
  },
  {
    id: 3,
    channel: "calls",
    name: "Ambulancia Medifem",
    identity: "+421 948 519 438",
    queue: "Medical partners",
    reason: "Queue timeout · no agents available",
    preview: "Missed call from the Medical partners queue",
    time: "09:18",
    minutesAgo: 36,
    wait: "4m 02s wait",
    ambiguous: "2 contacts found",
    handled: false,
    initials: "AM",
  },
  {
    id: 4,
    channel: "sms",
    name: "Jana Bieliková",
    identity: "+421 903 884 112",
    queue: "SMS",
    preview: "Prosím zavolajte mi späť po 14:00.",
    time: "Včera",
    minutesAgo: 1440,
    handled: true,
    initials: "JB",
  },
  {
    id: 5,
    channel: "calls",
    name: "Lucia Horváthová",
    identity: "+421 911 204 773",
    queue: "Bratislava · inbound",
    reason: "Called back by Peter",
    preview: "Callback completed and outcome recorded",
    time: "08:54",
    minutesAgo: 60,
    wait: "42s wait",
    handled: true,
    initials: "LH",
  },
];

const channelLabels: Record<Channel, string> = {
  all: "All",
  calls: "Calls",
  email: "Email",
  sms: "SMS",
};

const searchLabels: Record<SearchField, string> = {
  all: "All fields",
  name: "Name",
  phone: "Phone",
  email: "Email",
  queue: "Queue",
};

const sortLabels: Record<SortKey, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  name: "Name A–Z",
  unhandled: "Unhandled first",
};

function ChannelIcon({ channel, size = 15 }: { channel: MissedItem["channel"]; size?: number }) {
  if (channel === "calls") return <PhoneMissed size={size} aria-hidden="true" />;
  if (channel === "email") return <Mail size={size} aria-hidden="true" />;
  return <MessageSquare size={size} aria-hidden="true" />;
}

export function Unified() {
  const [items, setItems] = useState(initialItems);
  const [channel, setChannel] = useState<Channel>("all");
  const [status, setStatus] = useState<Status>("all");
  const [query, setQuery] = useState("");
  const [searchField, setSearchField] = useState<SearchField>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [searchFocused, setSearchFocused] = useState(false);
  const [feedback, setFeedback] = useState("");

  const unhandledCount = items.filter(item => !item.handled).length;

  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const filtered = items.filter(item => {
      if (channel !== "all" && item.channel !== channel) return false;
      if (status === "handled" && !item.handled) return false;
      if (status === "unhandled" && item.handled) return false;
      if (!normalized) return true;

      const values: Record<SearchField, string> = {
        all: `${item.name} ${item.identity} ${item.queue ?? ""} ${item.preview} ${item.reason ?? ""}`,
        name: item.name,
        phone: item.identity,
        email: item.identity,
        queue: item.queue ?? "",
      };
      return values[searchField].toLocaleLowerCase().includes(normalized);
    });

    return filtered.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "sk");
      if (sort === "oldest") return b.minutesAgo - a.minutesAgo;
      if (sort === "unhandled") return Number(a.handled) - Number(b.handled) || a.minutesAgo - b.minutesAgo;
      return a.minutesAgo - b.minutesAgo;
    });
  }, [channel, items, query, searchField, sort, status]);

  const counts = useMemo(() => {
    const inChannel = items.filter(item => channel === "all" || item.channel === channel);
    return {
      all: inChannel.length,
      unhandled: inChannel.filter(item => !item.handled).length,
      handled: inChannel.filter(item => item.handled).length,
    };
  }, [channel, items]);

  const hasFilters = channel !== "all" || status !== "all" || query.trim().length > 0 || sort !== "newest";

  function resetView() {
    setChannel("all");
    setStatus("all");
    setQuery("");
    setSearchField("all");
    setSort("newest");
    setFeedback("Filters reset");
  }

  function handlePrimary(item: MissedItem) {
    setFeedback(item.channel === "email" ? `Reply opened for ${item.name}` : `Contact card opened for ${item.name}`);
  }

  function markHandled(id: number) {
    setItems(current => current.map(item => item.id === id ? { ...item, handled: true } : item));
    const item = items.find(entry => entry.id === id);
    setFeedback(item ? `${item.name} marked handled` : "Item marked handled");
  }

  function reopen(id: number) {
    setItems(current => current.map(item => item.id === id ? { ...item, handled: false } : item));
    const item = items.find(entry => entry.id === id);
    setFeedback(item ? `${item.name} moved back to unhandled` : "Item reopened");
  }

  const searchHint = searchField === "all"
    ? "Search name, phone, email, queue…"
    : `Search by ${searchLabels[searchField].toLowerCase()}…`;

  return (
    <main className="um-stage">
      <style>{`
        .um-stage {
          --um-ink: #18314d;
          --um-muted: #69809a;
          --um-soft: #edf5fb;
          --um-line: #dce8f2;
          --um-blue: #2d6fba;
          --um-blue-dark: #1c568f;
          --um-alert: #bf5c4f;
          --um-alert-soft: #fff1ed;
          --um-green: #3f826e;
          --um-green-soft: #eaf6f1;
          min-height: 100dvh;
          padding: 34px;
          display: grid;
          place-items: center;
          color: var(--um-ink);
          background: #eaf2f8;
          font-family: "Open Sans", "Segoe UI", sans-serif;
        }
        .um-stage *, .um-stage *::before, .um-stage *::after { box-sizing: border-box; }
        .um-dialog {
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
        .um-header {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 21px 25px 19px;
          background: #f8fbfe;
          border-bottom: 1px solid var(--um-line);
        }
        .um-title-icon {
          width: 42px; height: 42px; flex: none;
          display: grid; place-items: center;
          color: var(--um-alert); background: var(--um-alert-soft);
          border: 1px solid #f7d8d0; border-radius: 13px;
        }
        .um-title-copy { min-width: 0; flex: 1; }
        .um-kicker {
          margin: 0 0 3px; color: var(--um-blue);
          font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
        }
        .um-title-copy h1 { margin: 0; color: #173452; font-size: 20px; line-height: 1.15; letter-spacing: -.025em; }
        .um-title-copy p { margin: 5px 0 0; color: var(--um-muted); font-size: 11px; }
        .um-summary {
          display: flex; align-items: center; gap: 7px; margin-right: 12px;
          color: var(--um-alert); font-size: 11px; font-weight: 800; white-space: nowrap;
        }
        .um-summary-dot { width: 7px; height: 7px; background: var(--um-alert); border-radius: 50%; }
        .um-close {
          width: 30px; height: 30px; display: grid; place-items: center; flex: none;
          color: #7690a6; background: transparent; border: 0; border-radius: 8px;
        }
        .um-close:hover { color: var(--um-ink); background: var(--um-soft); }
        .um-search-area { padding: 16px 25px 11px; background: #fff; }
        .um-toolbar { display: flex; align-items: center; gap: 8px; position: relative; }
        .um-search {
          min-width: 190px; height: 39px; display: flex; align-items: center; gap: 8px; flex: 1;
          padding: 0 11px; color: #88a0b6; background: #fff;
          border: 1px solid #c7d8e7; border-radius: 11px;
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        .um-search:focus-within { border-color: #5a94ca; box-shadow: 0 0 0 3px rgba(45,111,186,.12); }
        .um-search input { width: 100%; min-width: 0; color: var(--um-ink); background: transparent; border: 0; outline: 0; font-size: 12px; }
        .um-search input::placeholder { color: #8ba0b3; }
        .um-search-clear { display: grid; padding: 3px; color: #7891a6; background: transparent; border: 0; border-radius: 5px; }
        .um-search-clear:hover { background: var(--um-soft); color: var(--um-blue); }
        .um-picker, .um-sort {
          height: 39px; display: inline-flex; align-items: center; gap: 7px; flex: none;
          padding: 0 11px; color: #506b84; background: #fff;
          border: 1px solid #c7d8e7; border-radius: 11px; font-size: 11px; font-weight: 700;
        }
        .um-picker select, .um-sort select { max-width: 113px; color: inherit; background: transparent; border: 0; outline: 0; font-size: 11px; font-weight: 700; cursor: pointer; }
        .um-suggestions {
          position: absolute; z-index: 4; top: 46px; left: 0; width: min(430px, calc(100% - 250px));
          padding: 5px; background: #fff; border: 1px solid #c8dbea; border-radius: 11px;
          box-shadow: 0 12px 26px rgba(31, 75, 111, .14);
        }
        .um-suggestion {
          width: 100%; display: flex; align-items: center; gap: 8px; padding: 8px;
          color: var(--um-ink); text-align: left; background: transparent; border: 0; border-radius: 7px;
          cursor: pointer;
        }
        .um-suggestion:hover, .um-suggestion:focus-visible { background: var(--um-soft); outline: 0; }
        .um-suggestion-avatar { width: 24px; height: 24px; display: grid; place-items: center; color: var(--um-blue); background: #e5f0fa; border-radius: 7px; font-size: 9px; font-weight: 800; }
        .um-suggestion-copy { min-width: 0; flex: 1; }
        .um-suggestion-copy strong, .um-suggestion-copy span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .um-suggestion-copy strong { font-size: 11px; }
        .um-suggestion-copy span { margin-top: 2px; color: var(--um-muted); font-size: 10px; }
        .um-suggestion-hint { color: #88a0b6; font-size: 9px; white-space: nowrap; }
        .um-filters { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; padding: 0 25px 14px; border-bottom: 1px solid var(--um-line); background: #fff; }
        .um-filter-group { display: flex; align-items: center; gap: 5px; }
        .um-filter-label { margin-right: 2px; color: #8ca0b3; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
        .um-chip {
          height: 27px; display: inline-flex; align-items: center; gap: 5px; padding: 0 9px;
          color: #637e96; background: #f0f5f9; border: 1px solid transparent; border-radius: 8px;
          font-size: 10px; font-weight: 800; cursor: pointer;
        }
        .um-chip:hover { border-color: #b7cee1; color: var(--um-blue-dark); }
        .um-chip.active { color: #fff; background: var(--um-blue); box-shadow: 0 3px 8px rgba(45,111,186,.2); }
        .um-chip-count { min-width: 17px; padding: 2px 4px; border-radius: 5px; color: #6f8da5; background: #dfeaf3; font-size: 9px; text-align: center; }
        .um-chip.active .um-chip-count { color: #e9f4ff; background: rgba(255,255,255,.2); }
        .um-filter-divider { width: 1px; height: 18px; margin: 0 3px; background: var(--um-line); }
        .um-list { min-height: 0; flex: 1; overflow: auto; padding: 15px 25px 21px; background: #f7fbfe; }
        .um-list-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 1px 9px; }
        .um-result-count { color: #294964; font-size: 12px; font-weight: 800; }
        .um-result-count span { color: #86a0b5; font-weight: 600; }
        .um-list-tools { display: flex; align-items: center; gap: 8px; }
        .um-list-tools span { color: #87a0b5; font-size: 10px; }
        .um-clear {
          display: inline-flex; align-items: center; gap: 4px; padding: 4px 7px;
          color: var(--um-blue); background: transparent; border: 0; border-radius: 6px;
          font-size: 10px; font-weight: 800; cursor: pointer;
        }
        .um-clear:hover { background: #e6f1fa; }
        .um-row {
          display: flex; align-items: center; gap: 11px; margin: 7px 0; padding: 12px;
          background: #fff; border: 1px solid #dce8f1; border-radius: 13px;
          box-shadow: 0 2px 7px rgba(25, 66, 103, .045);
          transition: border-color .15s ease, transform .15s ease;
        }
        .um-row:hover { border-color: #a9c7df; transform: translateY(-1px); }
        .um-avatar { width: 38px; height: 38px; display: grid; place-items: center; flex: none; border-radius: 11px; font-size: 10px; font-weight: 800; }
        .um-avatar.call { color: #ad5549; background: #fff0ec; }
        .um-avatar.email { color: #2b6fae; background: #eaf3fb; }
        .um-avatar.sms { color: #5d7e70; background: #edf6f1; }
        .um-row-main { min-width: 0; flex: 1; }
        .um-row-top { display: flex; align-items: center; gap: 7px; min-width: 0; }
        .um-row-main strong { overflow: hidden; color: #1d3d5a; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
        .um-identity, .um-context { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .um-identity { margin-top: 3px; color: #7089a0; font-size: 10px; }
        .um-context { margin-top: 5px; color: #57728a; font-size: 10px; }
        .um-context b { color: #345b7b; font-weight: 800; }
        .um-badge { display: inline-flex; align-items: center; gap: 4px; flex: none; padding: 3px 6px; border-radius: 6px; font-size: 9px; font-weight: 800; }
        .um-badge.unhandled { color: #ae5549; background: var(--um-alert-soft); }
        .um-badge.handled { color: var(--um-green); background: var(--um-green-soft); }
        .um-row-meta { min-width: 77px; text-align: right; }
        .um-row-meta strong, .um-row-meta span { display: block; }
        .um-row-meta strong { color: #36556e; font-size: 11px; }
        .um-row-meta span { margin-top: 3px; color: #89a0b3; font-size: 9px; }
        .um-wait { display: inline-flex; align-items: center; gap: 4px; margin-top: 5px; padding: 3px 5px; color: #527aa0; background: #edf5fb; border-radius: 5px; font-size: 9px; }
        .um-row-actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; min-width: 151px; }
        .um-primary, .um-secondary {
          min-height: 29px; display: inline-flex; align-items: center; justify-content: center; gap: 5px;
          padding: 0 9px; border-radius: 8px; font-size: 10px; font-weight: 800; white-space: nowrap; cursor: pointer;
        }
        .um-primary { color: #fff; background: var(--um-blue); border: 1px solid var(--um-blue); }
        .um-primary:hover { background: var(--um-blue-dark); border-color: var(--um-blue-dark); }
        .um-secondary { color: #567188; background: #fff; border: 1px solid #cddde9; }
        .um-secondary:hover { color: var(--um-blue-dark); border-color: #9dbcd4; background: #f3f8fc; }
        .um-secondary.reopen { color: var(--um-green); border-color: #c4e1d6; }
        .um-empty { min-height: 265px; display: grid; place-items: center; align-content: center; gap: 8px; color: #83a98f; text-align: center; }
        .um-empty strong { color: #34546c; font-size: 13px; }
        .um-empty span { max-width: 300px; color: #8098ab; font-size: 11px; line-height: 1.5; }
        .um-empty-reset { margin-top: 4px; color: var(--um-blue); background: #e8f3fb; border: 0; border-radius: 8px; padding: 8px 11px; font-size: 10px; font-weight: 800; cursor: pointer; }
        .um-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 25px; color: #8399ab; background: #fff; border-top: 1px solid var(--um-line); font-size: 10px; }
        .um-footer-note { display: inline-flex; align-items: center; gap: 6px; }
        .um-footer-note svg { color: var(--um-blue); }
        .um-feedback { color: var(--um-green); font-weight: 800; }
        .um-focus { outline: 2px solid #6aa4d8; outline-offset: 2px; }
        @media (max-width: 760px) {
          .um-stage { padding: 9px; align-items: start; }
          .um-dialog { min-height: calc(100dvh - 18px); border-radius: 13px; }
          .um-header, .um-search-area, .um-list, .um-footer { padding-left: 14px; padding-right: 14px; }
          .um-filters { padding-left: 14px; padding-right: 14px; }
          .um-summary { display: none; }
          .um-toolbar { flex-wrap: wrap; }
          .um-search { flex-basis: 100%; }
          .um-picker, .um-sort { flex: 1; min-width: 0; justify-content: space-between; }
          .um-picker select, .um-sort select { max-width: calc(100% - 25px); }
          .um-suggestions { width: calc(100% - 0px); }
          .um-filter-divider { display: none; }
          .um-filter-group { width: 100%; overflow-x: auto; padding-bottom: 2px; }
          .um-row { align-items: flex-start; flex-wrap: wrap; }
          .um-row-main { min-width: calc(100% - 55px); }
          .um-row-meta { margin-left: 49px; text-align: left; min-width: 74px; }
          .um-row-actions { min-width: 0; margin-left: 49px; justify-content: flex-start; flex-wrap: wrap; }
          .um-footer { align-items: flex-start; flex-direction: column; }
          .um-list-head { align-items: flex-start; flex-direction: column; gap: 5px; }
        }
      `}</style>

      <section className="um-dialog" aria-label="Missed communications">
        <header className="um-header">
          <div className="um-title-icon"><PhoneMissed size={20} aria-hidden="true" /></div>
          <div className="um-title-copy">
            <p className="um-kicker">NEXUS Pulse · follow-up desk</p>
            <h1>Missed communications</h1>
            <p>Today, 04 Mar 2025 · all queues and channels</p>
          </div>
          <div className="um-summary" aria-live="polite"><span className="um-summary-dot" />{unhandledCount} unhandled</div>
          <button className="um-close" type="button" aria-label="Close missed communications"><X size={17} /></button>
        </header>

        <section className="um-search-area" aria-label="Search and sort missed communications">
          <div className="um-toolbar">
            <label className="um-search">
              <Search size={16} aria-hidden="true" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder={searchHint}
                aria-label="Search missed communications"
              />
              {query && <button className="um-search-clear" type="button" onMouseDown={event => event.preventDefault()} onClick={() => setQuery("")} aria-label="Clear search"><X size={13} /></button>}
            </label>
            <label className="um-picker" title="Choose which contact field to search">
              <SlidersHorizontal size={14} aria-hidden="true" />
              <select value={searchField} onChange={event => setSearchField(event.target.value as SearchField)} aria-label="Search field">
                {Object.entries(searchLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <ChevronDown size={13} aria-hidden="true" />
            </label>
            <label className="um-sort">
              <ArrowUpDown size={14} aria-hidden="true" />
              <select value={sort} onChange={event => setSort(event.target.value as SortKey)} aria-label="Sort missed communications">
                {Object.entries(sortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <ChevronDown size={13} aria-hidden="true" />
            </label>
            {searchFocused && !query && (
              <div className="um-suggestions" aria-label="Search suggestions">
                <button className="um-suggestion" type="button" onMouseDown={event => event.preventDefault()} onClick={() => { setQuery("Martin"); setSearchFocused(false); }}>
                  <span className="um-suggestion-avatar">MK</span>
                  <span className="um-suggestion-copy"><strong>Martin Kováč</strong><span>+421 905 481 220 · Bratislava · inbound</span></span>
                  <span className="um-suggestion-hint">contact</span>
                </button>
                <button className="um-suggestion" type="button" onMouseDown={event => event.preventDefault()} onClick={() => { setQuery("Medical"); setSearchFocused(false); }}>
                  <span className="um-suggestion-avatar">AM</span>
                  <span className="um-suggestion-copy"><strong>Ambulancia Medifem</strong><span>+421 948 519 438 · Medical partners</span></span>
                  <span className="um-suggestion-hint">queue</span>
                </button>
              </div>
            )}
          </div>
        </section>

        <div className="um-filters">
          <div className="um-filter-group" role="group" aria-label="Filter by channel">
            <span className="um-filter-label">Channel</span>
            {(["all", "calls", "email", "sms"] as Channel[]).map(key => (
              <button key={key} type="button" className={`um-chip ${channel === key ? "active" : ""}`} onClick={() => setChannel(key)} aria-pressed={channel === key}>
                {key !== "all" && <ChannelIcon channel={key} size={12} />}{channelLabels[key]} <span className="um-chip-count">{key === "all" ? items.length : items.filter(item => item.channel === key).length}</span>
              </button>
            ))}
          </div>
          <span className="um-filter-divider" aria-hidden="true" />
          <div className="um-filter-group" role="group" aria-label="Filter by status">
            <span className="um-filter-label">Status</span>
            {(["all", "unhandled", "handled"] as Status[]).map(key => (
              <button key={key} type="button" className={`um-chip ${status === key ? "active" : ""}`} onClick={() => setStatus(key)} aria-pressed={status === key}>
                {key === "unhandled" ? "Unhandled" : key[0].toUpperCase() + key.slice(1)} <span className="um-chip-count">{counts[key]}</span>
              </button>
            ))}
          </div>
        </div>

        <section className="um-list" aria-label="Missed communication results">
          <div className="um-list-head">
            <div className="um-result-count">{visibleItems.length} results <span>· {sortLabels[sort]}</span></div>
            <div className="um-list-tools">
              {hasFilters && <button className="um-clear" type="button" onClick={resetView}><RotateCcw size={12} /> Clear filters</button>}
              <span aria-live="polite">{feedback}</span>
            </div>
          </div>

          {visibleItems.length > 0 ? visibleItems.map(item => (
            <article className="um-row" key={item.id}>
              <div className={`um-avatar ${item.channel}`} aria-hidden="true">
                {item.channel === "calls" ? <PhoneMissed size={17} /> : item.channel === "email" ? <Mail size={17} /> : <MessageSquare size={17} />}
              </div>
              <div className="um-row-main">
                <div className="um-row-top">
                  <strong>{item.name}</strong>
                  <span className={`um-badge ${item.handled ? "handled" : "unhandled"}`}>
                    {item.handled ? <Check size={11} /> : <ChannelIcon channel={item.channel} size={10} />}
                    {item.handled ? "Handled" : `${channelLabels[item.channel]} · Unhandled`}
                  </span>
                </div>
                <span className="um-identity">{item.identity}{item.queue && <> <i>·</i> {item.queue}</>}</span>
                <span className="um-context"><b>{item.reason ?? (item.channel === "email" ? "Subject" : "Message")}</b> · {item.preview}</span>
                {item.ambiguous && <span className="um-context"><UsersRound size={11} style={{ verticalAlign: "-2px", marginRight: 3 }} />{item.ambiguous} · choose the right contact before calling back</span>}
              </div>
              <div className="um-row-meta">
                <strong>{item.time}</strong>
                <span>{item.minutesAgo >= 1440 ? "Yesterday" : `${item.minutesAgo} min ago`}</span>
                {item.wait && <span className="um-wait"><Clock3 size={10} />{item.wait}</span>}
              </div>
              <div className="um-row-actions">
                {item.handled ? (
                  <button className="um-secondary reopen" type="button" onClick={() => reopen(item.id)} aria-label={`Reopen ${item.name}`}>Reopen</button>
                ) : (
                  <>
                    <button className="um-primary" type="button" onClick={() => handlePrimary(item)}>{item.channel === "email" ? <Mail size={13} /> : <UserRound size={13} />}{item.channel === "email" ? "Reply" : "Open card"}</button>
                    <button className="um-secondary" type="button" onClick={() => markHandled(item.id)} aria-label={`Mark ${item.name} handled`}>Mark handled</button>
                  </>
                )}
              </div>
            </article>
          )) : items.length > 0 ? (
            <div className="um-empty">
              <Search size={34} aria-hidden="true" />
              <strong>No missed items match these filters</strong>
              <span>Try another name, field, channel, or status. Your full missed list is still available.</span>
              <button className="um-empty-reset" type="button" onClick={resetView}>Reset filters</button>
            </div>
          ) : (
            <div className="um-empty">
              <CheckCircle2 size={34} aria-hidden="true" />
              <strong>No missed communications</strong>
              <span>There is no follow-up work in this scope right now.</span>
            </div>
          )}
        </section>

        <footer className="um-footer">
          <span className="um-footer-note"><Search size={13} /> Same search, field picker, and sorting pattern as Contacts</span>
          {feedback && <span className="um-feedback" role="status">{feedback}</span>}
          <span>Scope: all queues · 04 Mar 2025</span>
        </footer>
      </section>
    </main>
  );
}

export default Unified;