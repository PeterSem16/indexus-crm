import { useMemo, useState } from "react";
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Calendar, CalendarClock, Check,
  ChevronDown, ChevronLeft, ChevronRight, Clock, Mail, MailPlus, MapPin, Megaphone, MessageSquare,
  MessageSquarePlus, Phone, PhoneCall, PhoneForwarded, Search, Send, Trash2, X
} from "lucide-react";

type QueueType = "callback" | "email" | "sms";
type Item = {
  id: string; campaignContactId: string; type: QueueType; contactId: string; contactName: string;
  contactPhone: string; contactEmail: string; campaignId: string; campaignName: string;
  scheduledAt: string; notes: string; status: string; stepName?: string; stepIndex?: number;
  contactType?: string; hasReferral?: boolean; priorityCity?: string; priorityCountryCode?: string;
  dispositionName?: string; callbackStatusListLabel?: string; isOutsideMission?: boolean;
  calledBack?: boolean; workflowMode?: "status_list" | "disposition";
  dispositionChecklistNames?: string[];
};
const plus = (days: number, hour: number) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, days < 0 ? 15 : 0, 0, 0); return d.toISOString(); };
const fixtures: Item[] = [
  { id: "sq-101", campaignContactId: "cc-101", type: "callback", contactId: "c-101", contactName: "Mária Kováčová", contactPhone: "+421 903 441 286", contactEmail: "maria.kovacova@example.sk", campaignId: "cmp-ortho", campaignName: "Q2 Orthopedic Referrals", scheduledAt: plus(-1, 16), notes: "Asked to call after her clinic closes.", status: "callback_scheduled", stepName: "Follow-up call", stepIndex: 2, contactType: "clinic", hasReferral: true, priorityCity: "Bratislava", priorityCountryCode: "SK", workflowMode: "status_list", callbackStatusListLabel: "Callback requested", dispositionName: "Interested" },
  { id: "sq-102", campaignContactId: "cc-102", type: "email", contactId: "c-102", contactName: "Dr. Peter Novák", contactPhone: "+421 911 208 674", contactEmail: "peter.novak@medcentrum.sk", campaignId: "cmp-hosp", campaignName: "Hospital Partners 2024", scheduledAt: plus(0, 11), notes: "Send the updated partnership deck.", status: "callback_scheduled", stepName: "Send introduction", stepIndex: 1, contactType: "hospital", priorityCity: "Košice", priorityCountryCode: "SK", workflowMode: "disposition", dispositionName: "Materials requested", dispositionChecklistNames: ["Pricing attached", "Deck approved"] },
  { id: "sq-103", campaignContactId: "cc-103", contactId: "c-103", type: "sms", contactName: "Lucia Horváthová", contactPhone: "+421 905 733 902", contactEmail: "lucia.horvathova@example.com", campaignId: "cmp-patients", campaignName: "Patient Care Check-in", scheduledAt: plus(2, 9), notes: "Confirm preferred appointment window.", status: "callback_scheduled", stepName: "Appointment reminder", stepIndex: 3, contactType: "customer", priorityCity: "Žilina", priorityCountryCode: "SK" },
  { id: "sq-104", campaignContactId: "cc-104", type: "callback", contactId: "c-104", contactName: "Ambulancia Nové Mesto", contactPhone: "+421 2 4444 2201", contactEmail: "recepcia@ambulancia.sk", campaignId: "cmp-ortho", campaignName: "Q2 Orthopedic Referrals", scheduledAt: plus(6, 14), notes: "", status: "callback_scheduled", stepName: "Decision maker", stepIndex: 4, contactType: "clinic", priorityCity: "Nitra", priorityCountryCode: "SK", calledBack: true },
  { id: "sq-105", campaignContactId: "cc-105", type: "email", contactId: "c-105", contactName: "Martin Benko", contactPhone: "+421 948 551 007", contactEmail: "martin.benko@partner.eu", campaignId: "cmp-eu", campaignName: "EU Partner Outreach", scheduledAt: plus(10, 10), notes: "", status: "callback_scheduled", contactType: "collaborator", isOutsideMission: true },
  { id: "sq-106", campaignContactId: "cc-106", type: "sms", contactId: "c-106", contactName: "Ján Šimek", contactPhone: "+421 907 882 133", contactEmail: "jan.simek@example.sk", campaignId: "cmp-patients", campaignName: "Patient Care Check-in", scheduledAt: plus(1, 15), notes: "", status: "callback_scheduled", stepName: "Check-in", stepIndex: 2, contactType: "customer", priorityCity: "Prešov", priorityCountryCode: "SK" }
];
const fmtDate = (s: string) => new Intl.DateTimeFormat("sk-SK", { day: "numeric", month: "short" }).format(new Date(s));
const fmtLong = (s: string) => new Intl.DateTimeFormat("sk-SK", { weekday: "long", day: "numeric", month: "long" }).format(new Date(s));
const fmtTime = (s: string) => new Intl.DateTimeFormat("sk-SK", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(s));
const localISO = (d: Date) => { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; };
const isWeekday = (iso: string) => { const day = new Date(`${iso}T12:00:00`).getDay(); return day > 0 && day < 6; };
const typeLabel = (t: QueueType) => t === "callback" ? "Callback" : t === "email" ? "Email" : "SMS";
const TypeIcon = ({ type }: { type: QueueType }) => type === "callback" ? <PhoneForwarded /> : type === "email" ? <MailPlus /> : <MessageSquarePlus />;

function Scheduler({ item, onSave, onClose }: { item: Item; onSave: (id: string, value: string) => void; onClose: () => void }) {
  const [day, setDay] = useState(item.scheduledAt.slice(0, 10));
  const [time, setTime] = useState(item.scheduledAt.slice(11, 16));
  const weekdayChoices = (() => { const choices: Date[] = []; const d = new Date(); while (choices.length < 3) { if (d.getDay() > 0 && d.getDay() < 6) choices.push(new Date(d)); d.setDate(d.getDate() + 1); } return choices; })();
  const selectedDate = new Date(`${day}T12:00:00`);
  const moveDay = (amount: number) => { const next = new Date(selectedDate); do { next.setDate(next.getDate() + amount); } while (next.getDay() === 0 || next.getDay() === 6); setDay(localISO(next)); };
  const save = () => { const next = new Date(`${day}T${time}`); onSave(item.id, next.toISOString()); onClose(); };
  return <div className="schedule-pop compact-scheduler" role="dialog" aria-label={`Reschedule ${item.contactName}`}>
    <div className="pop-head"><div><span className="eyebrow">RESCHEDULE</span><h3>{item.contactName}</h3></div><button className="close-pop" onClick={onClose} aria-label="Close"><X /></button></div>
    <div className="current-time"><CalendarClock /><span>Currently <strong>{fmtLong(item.scheduledAt)}</strong><br /><strong>{fmtTime(item.scheduledAt)}</strong></span></div>
    <div className="schedule-section"><div className="pop-label">New date</div><div className="date-control"><button onClick={() => moveDay(-1)} aria-label="Previous weekday"><ChevronLeft /></button><label className="selected-date"><span>{selectedDate.toLocaleDateString("en", { weekday: "short" })}</span><strong>{selectedDate.getDate()} {selectedDate.toLocaleDateString("en", { month: "short" })}</strong><input type="date" value={day} onChange={e => { if (isWeekday(e.target.value)) setDay(e.target.value); }} aria-label="Choose a weekday" /></label><button onClick={() => moveDay(1)} aria-label="Next weekday"><ChevronRight /></button></div><div className="weekday-shortcuts">{weekdayChoices.map(d => { const iso = localISO(d); return <button key={iso} className={iso === day ? "selected" : ""} onClick={() => setDay(iso)}>{d.toLocaleDateString("en", { weekday: "short" })} {d.getDate()}</button>; })}<label className="date-input-link"><Calendar /><input type="date" value={day} onChange={e => { if (isWeekday(e.target.value)) setDay(e.target.value); }} aria-label="Choose another weekday" />Other weekday</label></div></div>
    <div className="schedule-section"><div className="pop-label">Time</div><div className="time-field" aria-label="Choose any time"><Clock /><div className="time-select-wrap"><select className="time-select" value={time.slice(0, 2)} onChange={e => setTime(`${e.target.value}:${time.slice(3)}`)} aria-label="Hour">{Array.from({ length: 24 }, (_, h) => <option key={h} value={String(h).padStart(2, "0")}>{String(h).padStart(2, "0")}</option>)}</select><span className="time-colon">:</span><select className="time-select" value={time.slice(3, 5)} onChange={e => setTime(`${time.slice(0, 2)}:${e.target.value}`)} aria-label="Minute">{Array.from({ length: 60 }, (_, m) => <option key={m} value={String(m).padStart(2, "0")}>{String(m).padStart(2, "0")}</option>)}</select></div><span className="time-zone">24-hour time</span></div><div className="time-presets">{["09:00", "10:30", "13:00", "14:30", "16:00"].map(t => <button key={t} className={time === t ? "selected" : ""} onClick={() => setTime(t)}>{t}</button>)}</div></div>
    {item.notes && <div className="pop-note"><MessageSquare />{item.notes}</div>}
    <div className="new-time-summary"><span>New appointment</span><strong>{fmtLong(`${day}T${time}`)} · {time}</strong></div>
    <div className="pop-actions"><button onClick={onClose}>Cancel</button><button className="save" onClick={save}><Check /> Save change</button></div>
  </div>;
}

export function AgendaCards() {
  const [items, setItems] = useState(fixtures); const [q, setQ] = useState(""); const [type, setType] = useState<"all" | QueueType>("all"); const [bucket, setBucket] = useState("all"); const [sort, setSort] = useState<"date" | "name" | "campaign">("date"); const [desc, setDesc] = useState(false); const [mine, setMine] = useState(false); const [editing, setEditing] = useState<string | null>(null);
  const now = Date.now(), day = 86400000;
  const getBucket = (s: string) => { const t = new Date(s).getTime(); if (t < now) return "overdue"; const n = Math.floor((t - now) / day); return n === 0 ? "today" : n < 7 ? "thisWeek" : n < 14 ? "nextWeek" : "later"; };
  const counts = useMemo(() => { const x: Record<string, number> = { overdue: 0, today: 0, thisWeek: 0, nextWeek: 0, later: 0, callback: 0, email: 0, sms: 0 }; items.forEach(i => { x[getBucket(i.scheduledAt)]++; x[i.type]++; }); return x; }, [items]);
  const visible = useMemo(() => items.filter(i => (type === "all" || i.type === type) && (bucket === "all" || getBucket(i.scheduledAt) === bucket) && (!mine || i.id !== "sq-105") && (!q || [i.contactName, i.contactPhone, i.contactEmail, i.campaignName, i.notes].join(" ").toLowerCase().includes(q.toLowerCase()))).sort((a, b) => { const av = sort === "date" ? +new Date(a.scheduledAt) : sort === "name" ? a.contactName.localeCompare(b.contactName) : a.campaignName.localeCompare(b.campaignName); const bv = sort === "date" ? +new Date(b.scheduledAt) : sort === "name" ? b.contactName.localeCompare(a.contactName) : b.campaignName.localeCompare(a.campaignName); return av - bv; }), [items, q, type, bucket, sort, mine]);
  const sorted = desc ? [...visible].reverse() : visible;
  const groups = useMemo(() => sorted.reduce<Record<string, Item[]>>((acc, i) => { const k = getBucket(i.scheduledAt); (acc[k] ||= []).push(i); return acc; }, {}), [sorted]);
  const toggleSort = (s: "date" | "name" | "campaign") => sort === s ? setDesc(!desc) : (setSort(s), setDesc(false));
  const action = (i: Item, channel: string) => window.alert(`${channel === "phone" ? "Opening call" : "Opening " + channel} for ${i.contactName}`);
  const groupMeta: Record<string, [string, string]> = { overdue: ["Needs attention", "Past due"], today: ["Today", "On your radar"], thisWeek: ["This week", "Next up"], nextWeek: ["Next week", "Plan ahead"], later: ["Later", "Scheduled ahead"] };
  return <><style>{CSS + BLUE_OVERRIDES}</style><main className="agenda-shell">
    <header className="agenda-header"><div className="brand-mark"><CalendarClock /></div><div><div className="title-row"><h1>Scheduled queue</h1><span className="count">{items.length}</span></div><p>{counts.overdue ? <b>{counts.overdue} overdue</b> : "All caught up"} <i>•</i> {counts.today} today</p></div><label className="mine"><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} /> Only assigned to me</label><button className="header-x" aria-label="Close queue"><X /></button></header>
    <section className="control-strip"><div className="search"><Search /><input placeholder="Search people, campaigns, notes..." value={q} onChange={e => setQ(e.target.value)} data-testid="input-scheduled-search" /></div><div className="sorts"><span>Sort</span>{(["date", "name", "campaign"] as const).map(s => <button className={sort === s ? "sort active" : "sort"} key={s} onClick={() => toggleSort(s)}>{s === "date" ? "Date" : s === "name" ? "Name" : "Campaign"}{sort === s ? (desc ? <ArrowDown /> : <ArrowUp />) : <ArrowUpDown />}</button>)}</div></section>
    <nav className="filter-rail"><div className="rail-label">SHOWING</div>{([["all", "Everything", items.length], ["overdue", "Overdue", counts.overdue], ["today", "Today", counts.today], ["thisWeek", "This week", counts.thisWeek], ["later", "Later", counts.later]] as const).map(([k, label, n]) => <button key={k} className={bucket === k ? "rail-filter active" : "rail-filter"} onClick={() => setBucket(k)}><span className={`dot ${k}`} />{label}<em>{n}</em></button>)}<div className="rail-divider" /><div className="rail-label">CHANNEL</div>{(["all", "callback", "email", "sms"] as const).map(k => <button key={k} className={type === k ? "channel-filter active" : "channel-filter"} onClick={() => setType(k)}>{k === "all" ? <CalendarClock /> : <TypeIcon type={k} />} {k === "all" ? "All channels" : typeLabel(k)} <em>{k === "all" ? items.length : counts[k]}</em></button>)}</nav>
    <section className="agenda-content"><div className="content-meta"><span><strong>{sorted.length}</strong> appointments in view</span><span className="live"><i /> Queue is live</span></div>{sorted.length === 0 ? <div className="empty"><CalendarClock /><h2>No appointments here</h2><p>Try clearing a filter or searching a different name.</p><button onClick={() => { setQ(""); setType("all"); setBucket("all"); }}>Show everything</button></div> : Object.entries(groups).map(([key, group]) => <section className={`agenda-group ${key}`} key={key}><div className="group-heading"><div className="group-title"><span className="group-dot" /><div><h2>{groupMeta[key][0]}</h2><p>{groupMeta[key][1]}</p></div></div><span className="group-count">{group.length} {group.length === 1 ? "item" : "items"}</span></div><div className="cards">{group.map(i => { const overdue = key === "overdue"; return <article className={`agenda-card ${overdue ? "urgent" : ""}`} key={i.id} data-testid={`scheduled-item-${i.id}`}><div className="card-top"><div className={`channel-mark ${i.type}`}><TypeIcon type={i.type} /></div><div className="identity"><div className="name-line"><button className="name" onClick={() => action(i, i.type === "callback" ? "phone" : i.type)}>{i.contactName}</button><span className={`type-tag ${i.type}`}>{typeLabel(i.type)}</span>{overdue && <span className="urgent-tag"><AlertTriangle /> Overdue</span>}</div><div className="contact-line"><span><Phone />{i.contactPhone}</span><span><Mail />{i.contactEmail}</span></div></div><div className="card-time"><span><Calendar />{fmtDate(i.scheduledAt)}</span><b><Clock />{fmtTime(i.scheduledAt)}</b></div></div><div className="card-mid"><div className="context-tags">{i.hasReferral && <span className="badge referral">Referral</span>}{i.priorityCity && <span className="badge city"><MapPin />{i.priorityCity}, {i.priorityCountryCode}</span>}{i.isOutsideMission && <span className="badge outside">Outside mission</span>}</div><div className="step-block"><span className="micro-label">WORKFLOW</span>{i.callbackStatusListLabel ? <><span className="status blue">{i.callbackStatusListLabel}</span><span className="sub-status">↳ {i.dispositionName || typeLabel(i.type)}</span></> : i.dispositionName ? <><span className="status purple">{i.dispositionName}</span>{i.dispositionChecklistNames?.map(n => <span className="sub-status" key={n}>↳ {n}</span>)}</> : i.calledBack ? <span className="done"><Check /> Callback done</span> : <span className="step-label">{i.stepIndex}. {i.stepName || "Scheduled"}</span>}</div></div><div className="card-bottom"><span className="campaign"><Megaphone />{i.campaignName}</span><div className="actions">{i.type === "callback" ? <button className="action primary" onClick={() => action(i, "phone")}><PhoneCall /> Call now</button> : <button className="action send" onClick={() => action(i, i.type)}><Send /> Send now</button>}<button className="action resched" onClick={() => setEditing(editing === i.id ? null : i.id)}><CalendarClock /> Reschedule</button><button className="trash" onClick={() => setItems(v => v.filter(x => x.id !== i.id))} aria-label="Cancel appointment"><Trash2 /></button></div></div>{editing === i.id && <Scheduler item={i} onSave={(id, value) => setItems(v => v.map(x => x.id === id ? { ...x, scheduledAt: value } : x))} onClose={() => setEditing(null)} />}</article>; })}</div></section>)}</section><footer>{sorted.length} / {items.length} total {bucket !== "all" && ` · ${groupMeta[bucket]?.[0]}`}{type !== "all" && ` · ${typeLabel(type)}`}</footer>
  </main></>;
}

const CSS = `
*{box-sizing:border-box}body{margin:0;background:#17252a;color:#20343a;font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif}.agenda-shell{width:100%;min-height:100vh;background:#f8f7f2;display:grid;grid-template-columns:214px 1fr;grid-template-rows:72px 66px 1fr 34px}.agenda-header{grid-column:1/-1;display:flex;align-items:center;gap:13px;padding:0 28px;background:#fffdf8;border-bottom:1px solid #e3e6dc}.brand-mark{display:grid;place-items:center;width:36px;height:36px;border-radius:11px;background:#d9f36a;color:#27444a}.brand-mark svg{width:19px}.title-row{display:flex;align-items:center;gap:8px}.title-row h1{margin:0;font-size:18px;letter-spacing:-.04em}.count{display:grid;place-items:center;min-width:25px;height:20px;padding:0 7px;border-radius:99px;background:#e7ece2;color:#587168;font-size:11px;font-weight:800}.agenda-header p{margin:4px 0 0;color:#71827e;font-size:11px}.agenda-header p b{color:#d45b43}.agenda-header p i{font-style:normal;padding:0 5px;color:#b6c0b9}.mine{margin-left:auto;display:flex;align-items:center;gap:8px;color:#567069;font-size:11px;cursor:pointer}.mine input{accent-color:#324f4b}.header-x{margin-left:17px;border:0;background:none;color:#8b9990;cursor:pointer}.header-x svg{width:17px}.control-strip{grid-column:2;display:flex;align-items:center;gap:18px;padding:0 28px;border-bottom:1px solid #e3e6dc;background:#fffdf8}.search{position:relative;flex:1;max-width:560px}.search svg{position:absolute;left:13px;top:11px;width:15px;color:#8a9a91}.search input{width:100%;height:38px;padding:0 13px 0 38px;border:1px solid #dce3d8;border-radius:10px;background:#f6f7f1;color:#263d40;font-size:12px;outline:0}.search input:focus{border-color:#90ad48;box-shadow:0 0 0 3px #dff09a66}.sorts{display:flex;align-items:center;gap:6px;color:#84928b;font-size:10px}.sort{display:flex;align-items:center;gap:5px;height:32px;padding:0 9px;border:1px solid #dce3d8;border-radius:8px;background:#fffdf8;color:#61756d;font-size:10px;cursor:pointer}.sort svg{width:12px}.sort.active{background:#e9f6b5;border-color:#c8df77;color:#324d42;font-weight:800}.filter-rail{grid-column:1;grid-row:2/4;padding:23px 14px 12px;border-right:1px solid #e3e6dc;background:#f0f3ea}.rail-label{padding:0 10px 9px;color:#94a199;font-size:9px;font-weight:800;letter-spacing:.12em}.rail-filter,.channel-filter{display:flex;align-items:center;gap:8px;width:100%;height:35px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:#687a72;font-size:11px;text-align:left;cursor:pointer}.rail-filter:hover,.channel-filter:hover{background:#e7ece1}.rail-filter.active,.channel-filter.active{background:#dfeeb3;color:#304b42;font-weight:800}.rail-filter em,.channel-filter em{margin-left:auto;font-style:normal;color:#9aa69e;font-size:10px}.rail-filter.active em,.channel-filter.active em{color:#65833d}.dot{width:7px;height:7px;border-radius:50%;background:#b9c3bc}.dot.overdue{background:#e06c51}.dot.today{background:#9fbe4d}.dot.thisWeek{background:#6bb5a6}.dot.later{background:#a6afb0}.rail-divider{height:1px;margin:17px 9px;background:#dce2d8}.channel-filter svg{width:14px;height:14px;color:#738c82}.agenda-content{grid-column:2;grid-row:3;overflow:auto;padding:20px 28px 40px}.content-meta{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;color:#84928b;font-size:11px}.content-meta strong{color:#2d4845}.live{display:flex;align-items:center;gap:6px}.live i{width:6px;height:6px;border-radius:50%;background:#75af48}.agenda-group{margin-bottom:28px}.group-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.group-title{display:flex;align-items:center;gap:10px}.group-dot{width:9px;height:9px;border-radius:50%;background:#9fbe4d}.overdue .group-dot{background:#df6a4f}.group-title h2{margin:0;color:#304b4a;font-size:14px;letter-spacing:-.02em}.group-title p{margin:2px 0 0;color:#98a39b;font-size:10px}.group-count{padding:4px 8px;border-radius:99px;background:#edf0e8;color:#8a9990;font-size:10px}.cards{display:flex;flex-direction:column;gap:9px}.agenda-card{position:relative;padding:14px 16px 12px;border:1px solid #e0e5dc;border-radius:13px;background:#fffefa;box-shadow:0 2px 0 #e6eadf;transition:transform .16s,box-shadow .16s,border-color .16s}.agenda-card:hover{transform:translateY(-1px);border-color:#cbd7b8;box-shadow:0 6px 18px #445a3b14}.agenda-card.urgent{border-left:4px solid #df6a4f;background:#fffaf6}.card-top{display:flex;align-items:flex-start;gap:11px}.channel-mark{display:grid;place-items:center;flex:none;width:34px;height:34px;border-radius:10px}.channel-mark svg,.action svg,.card-mid svg,.card-bottom svg{width:14px;height:14px}.channel-mark.callback{background:#dff1ef;color:#2d857c}.channel-mark.email{background:#f4e5d6;color:#b66d37}.channel-mark.sms{background:#e6e5f5;color:#6462a2}.identity{min-width:0;flex:1}.name-line{display:flex;align-items:center;flex-wrap:wrap;gap:7px}.name{padding:0;border:0;background:none;color:#243b3e;font-size:13px;font-weight:800;cursor:pointer}.name:hover{color:#78963d;text-decoration:underline}.type-tag,.urgent-tag{padding:3px 6px;border-radius:5px;font-size:9px;font-weight:800}.type-tag.callback{background:#e1f3ef;color:#257c73}.type-tag.email{background:#f8e8d9;color:#a96131}.type-tag.sms{background:#eae9f7;color:#5a5b98}.urgent-tag{display:flex;align-items:center;gap:3px;background:#fee4dc;color:#c7553e}.urgent-tag svg{width:11px}.contact-line{display:flex;gap:12px;margin-top:5px;color:#8a9991;font-size:10px}.contact-line span{display:flex;align-items:center;gap:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.contact-line svg{width:11px}.card-time{display:flex;flex-direction:column;align-items:flex-end;gap:4px;min-width:86px;color:#82938a;font-size:10px}.card-time span,.card-time b{display:flex;align-items:center;gap:5px}.card-time b{color:#304e4a;font-size:12px}.card-time svg{width:12px}.card-mid{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:11px 0 10px 45px}.context-tags{display:flex;flex-wrap:wrap;gap:5px}.badge{display:flex;align-items:center;gap:4px;padding:4px 7px;border-radius:99px;font-size:9px;font-weight:800}.badge svg{width:11px}.referral{background:#eee8fb;color:#765b9b}.city{background:#e0f4e9;color:#3f8060}.outside{background:#ffe8cf;color:#bb6b26}.step-block{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}.micro-label{color:#a0aaa1;font-size:8px;font-weight:800;letter-spacing:.1em}.status,.step-label,.done{padding:4px 7px;border-radius:5px;font-size:9px;font-weight:800}.status.blue{background:#dcebf5;color:#3b6b87}.status.purple{background:#eee4f7;color:#795394}.sub-status{color:#89988f;font-size:9px}.step-label{background:#e6efee;color:#44716c}.done{display:flex;align-items:center;gap:4px;background:#dff2e3;color:#39764a}.done svg{width:11px}.card-bottom{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-left:45px;border-top:1px solid #edf0e9;padding-top:9px}.campaign{display:flex;align-items:center;gap:6px;min-width:0;overflow:hidden;color:#73857d;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.campaign svg{color:#bd8752}.actions{display:flex;align-items:center;gap:5px}.action{display:flex;align-items:center;gap:5px;height:28px;padding:0 9px;border:1px solid #dbe3d8;border-radius:7px;background:#fffefa;color:#5d776d;font-size:10px;font-weight:700;cursor:pointer}.action:hover{border-color:#9cb75b;background:#f1f7d8}.action.primary{background:#e1f3ef;border-color:#c0e2db;color:#287a70}.action.send{background:#f9eddd;border-color:#efdbc5;color:#a66431}.trash{display:grid;place-items:center;width:28px;height:28px;border:1px solid #ecd8d2;border-radius:7px;background:#fff8f5;color:#c57868;cursor:pointer}.trash:hover{background:#fee4dc;color:#b54e3e}.schedule-pop{position:absolute;z-index:4;right:15px;bottom:52px;width:min(420px,calc(100% - 30px));padding:17px;border:1px solid #cbdab0;border-radius:15px;background:#fffffb;box-shadow:0 18px 45px #334d3b2e}.pop-head{display:flex;justify-content:space-between;align-items:flex-start}.eyebrow,.pop-label{color:#8c9b91;font-size:9px;font-weight:800;letter-spacing:.11em}.pop-head h3{margin:4px 0 0;color:#29413f;font-size:14px}.close-pop{border:0;background:none;color:#8e9c94;cursor:pointer}.close-pop svg{width:16px}.current-time{display:flex;align-items:center;gap:7px;margin:13px 0;padding:9px 10px;border-radius:8px;background:#f0f4e9;color:#7d8e84;font-size:10px}.current-time svg{width:14px;color:#91a950}.current-time strong{color:#496158}.day-choices{display:flex;gap:5px;margin-top:8px}.day-choice{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:61px;height:68px;border:1px solid #dde5d8;border-radius:9px;background:#fffefa;color:#84928b;cursor:pointer}.day-choice small{font-size:9px}.day-choice b{font-size:18px;color:#38514c}.day-choice span{font-size:9px}.day-choice.selected{border-color:#a8c35b;background:#eaf5bd;box-shadow:inset 0 0 0 1px #cfe17e}.day-choice.selected b{color:#355139}.custom-day{display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;gap:4px;width:64px;height:68px;border:1px dashed #c9d4c6;border-radius:9px;color:#87968e;font-size:9px;cursor:pointer}.custom-day svg{width:15px}.custom-day input{position:absolute;inset:0;opacity:0;cursor:pointer}.time-label{display:flex;justify-content:space-between;margin-top:16px}.time-label span{font-weight:500;letter-spacing:0;text-transform:none}.time-choices{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.time-chip{height:29px;padding:0 10px;border:1px solid #dce4da;border-radius:7px;background:#fffefa;color:#61776e;font-size:10px;cursor:pointer}.time-chip.selected{border-color:#a8c35b;background:#eaf5bd;color:#3b583e;font-weight:800}.custom-time{display:flex;align-items:center;gap:4px;height:29px;padding:0 7px;border:1px dashed #c9d4c6;border-radius:7px;color:#788b81}.custom-time svg{width:12px}.custom-time input{width:68px;border:0;background:transparent;color:#506860;font-size:10px;outline:0}.pop-note{display:flex;gap:6px;margin-top:14px;padding:8px;border-radius:7px;background:#fff3e8;color:#a66943;font-size:10px;line-height:1.35}.pop-note svg{flex:none;width:13px}.pop-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:15px;padding-top:12px;border-top:1px solid #edf0e8}.pop-actions button{height:31px;padding:0 12px;border:0;border-radius:7px;background:#f2f4ee;color:#718078;font-size:10px;font-weight:700;cursor:pointer}.pop-actions .save{display:flex;align-items:center;gap:5px;background:#36534e;color:#fff}.pop-actions .save svg{width:13px}.empty{text-align:center;padding:75px 20px;color:#84938b}.empty svg{width:38px;height:38px;margin-bottom:8px;color:#afbf96}.empty h2{margin:0;color:#405751;font-size:15px}.empty p{font-size:11px}.empty button{padding:8px 12px;border:1px solid #cddbbd;border-radius:7px;background:#eaf5bd;color:#4f693f;font-size:10px;cursor:pointer}footer{grid-column:2;padding:9px 28px;border-top:1px solid #e3e6dc;background:#fffdf8;color:#89968f;font-size:10px}@media(max-width:850px){.agenda-shell{display:flex;flex-direction:column;min-height:100vh}.agenda-header{padding:14px 16px}.mine{display:none}.control-strip{padding:10px 16px;flex-wrap:wrap;gap:8px}.sorts{overflow:auto}.filter-rail{display:flex;gap:4px;overflow:auto;padding:9px 12px;border-right:0;border-bottom:1px solid #e3e6dc}.rail-label,.rail-divider{display:none}.rail-filter,.channel-filter{width:auto;flex:none;padding:0 9px}.agenda-content{padding:16px}.card-mid{padding-left:0;align-items:flex-start;flex-direction:column}.step-block{justify-content:flex-start}.card-bottom{padding-left:0;align-items:flex-start;flex-direction:column}.actions{width:100%;flex-wrap:wrap}.agenda-card{padding:12px}.card-time{min-width:68px}.contact-line{flex-direction:column;gap:3px}.schedule-pop{position:fixed;left:12px;right:12px;bottom:12px;width:auto}.agenda-shell footer{display:none}}
`;

const BLUE_OVERRIDES = `
  :root{color-scheme:light}
  .micro-label{font-size:0}
  .micro-label::after{content:"STEP / STATUS";font-size:8px}
  body{background:#102b43;color:#1d3d5a}
  .agenda-shell{background:#f3f8fc;grid-template-rows:64px 58px 1fr 32px}
  .agenda-header,.control-strip,footer{background:#fbfdff;border-color:#dce8f1}
  .brand-mark{background:#eaf3fb;color:#2d6fba}
  .title-row h1,.name,.group-title h2,.pop-head h3{color:#1d3d5a}
  .count,.group-count{background:#eaf3fb;color:#567188}
  .agenda-header p,.sorts,.mine,.content-meta,.group-title p,.contact-line,.campaign{color:#7089a0}
  .agenda-header p b{color:#bf5c4f}
  .control-strip{padding:0 22px}
  .search input{height:34px;border-color:#c7dbe9;background:#f7fbfe;color:#1d3d5a}
  .search input:focus{border-color:#7fb0d2;box-shadow:0 0 0 3px #eaf3fb}
  .sort{height:30px;border-color:#c7dbe9;background:#fff;color:#567188}
  .sort.active{border-color:#9fc4dc;background:#eaf3fb;color:#1c568f}
  .filter-rail{padding:18px 12px 10px;border-color:#dce8f1;background:#e8f2f8}
  .rail-label{color:#7891a5}
  .rail-filter,.channel-filter{height:32px;color:#567188}
  .rail-filter:hover,.channel-filter:hover{background:#dcecf7}
  .rail-filter.active,.channel-filter.active{background:#d3e8f6;color:#1c568f}
  .rail-filter.active em,.channel-filter.active em{color:#2d6fba}
  .rail-divider{background:#c7dbe9}
  .agenda-content{padding:16px 22px 28px}
  .group-title h2{font-size:13px}
  .group-dot{background:#6ba7c8}
  .overdue .group-dot{background:#bf5c4f}
  .group-count{padding:3px 7px}
  .agenda-group{margin-bottom:20px}
  .cards{gap:7px}
  .agenda-card{padding:11px 13px 10px;border-color:#dce8f1;border-radius:11px;background:#fff;box-shadow:0 2px 8px #1c43670b}
  .agenda-card:hover{border-color:#9fc4dc;box-shadow:0 6px 18px #1c436714}
  .agenda-card.urgent{border-left-color:#bf5c4f;background:#fff8f6}
  .channel-mark.callback{background:#eaf3fb;color:#2d6fba}
  .channel-mark.email{background:#f1effb;color:#665da0}
  .channel-mark.sms{background:#eaf6f1;color:#3f826e}
  .name:hover{color:#2d6fba}
  .type-tag.callback{background:#eaf3fb;color:#1c568f}
  .type-tag.email{background:#f1effb;color:#665da0}
  .type-tag.sms{background:#eaf6f1;color:#3f826e}
  .urgent-tag{background:#fff1ed;color:#bf5c4f}
  .card-time{color:#7089a0}
  .card-time b{color:#1d3d5a}
  .badge.referral{background:#f1f0fb;color:#625b9a}
  .badge.city{background:#eaf6f1;color:#3f826e}
  .badge.outside{background:#fff4e8;color:#9b5b2d}
  .status.blue{background:#eaf3fb;color:#2d6fba}
  .status.purple{background:#f1f0fb;color:#665da0}
  .step-label{background:#eaf3fb;color:#2d6fba}
  .done{background:#eaf6f1;color:#3f826e}
  .card-bottom{border-color:#edf3f7}
  .campaign svg{color:#2d6fba}
  .action{border-color:#c7dbe9;background:#fbfdff;color:#45667f}
  .action:hover{border-color:#7fb0d2;background:#eaf3fb}
  .action.primary{border-color:#b9dbe5;background:#eaf6f1;color:#3f826e}
  .action.send{border-color:#c8c4e7;background:#f1f0fb;color:#665da0}
  .trash{border-color:#f0c8bc;background:#fff1ed;color:#bf5c4f}
  .trash:hover{background:#ffe4de;color:#a64e43}
  .schedule-pop{border-color:#c7dbe9;background:#fbfdff;box-shadow:0 18px 45px #1c43672e}
  .eyebrow,.pop-label{color:#7089a0}
  .current-time{background:#eaf3fb;color:#7089a0}
  .current-time svg{color:#2d6fba}
  .current-time strong{color:#1d3d5a}
  .day-choice{border-color:#c7dbe9;background:#fff;color:#7089a0}
  .day-choice b{color:#1d3d5a}
  .day-choice.selected{border-color:#7fb0d2;background:#eaf3fb;box-shadow:inset 0 0 0 1px #b9d8ed}
  .day-choice.selected b{color:#1c568f}
  .custom-day,.custom-time{border-color:#9fc4dc;color:#567188}
  .time-chip{border-color:#c7dbe9;background:#fff;color:#567188}
  .time-chip.selected{border-color:#7fb0d2;background:#eaf3fb;color:#1c568f}
  .custom-time input{color:#1d3d5a}
  .pop-note{background:#fff4e8;color:#9b5b2d}
  .pop-actions{border-color:#e7eff5}
  .pop-actions button{background:#edf3f7;color:#567188}
  .pop-actions .save{background:#2d6fba;color:#fff}
  .empty{color:#7089a0}.empty svg{color:#7fb0d2}.empty h2{color:#1d3d5a}
   .empty button{border-color:#9fc4dc;background:#eaf3fb;color:#1c568f}
   .compact-scheduler{width:min(352px,calc(100% - 24px));padding:15px;border-radius:12px}
   .compact-scheduler .current-time{margin:11px 0 14px;padding:8px 9px;line-height:1.4}
   .schedule-section{padding-top:12px;border-top:1px solid #e6eef4}
   .schedule-section+.schedule-section{margin-top:13px}
   .date-control{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:7px}
   .date-control>button{display:grid;place-items:center;width:27px;height:32px;border:1px solid #c7dbe9;border-radius:7px;background:#fff;color:#567188;cursor:pointer}
   .date-control>button:hover{border-color:#7fb0d2;background:#eaf3fb;color:#1c568f}
   .date-control>button svg{width:15px}
   .selected-date{position:relative;display:flex;flex:1;align-items:center;justify-content:center;gap:7px;height:38px;border:1px solid #9fc4dc;border-radius:8px;background:#eaf3fb;color:#1c568f;cursor:pointer}
   .selected-date span{font-size:10px;text-transform:uppercase;letter-spacing:.04em}
   .selected-date strong{font-size:13px}
   .selected-date input{position:absolute;inset:0;width:100%;opacity:0;cursor:pointer}
   .weekday-shortcuts{display:flex;align-items:center;gap:5px;margin-top:7px;overflow:hidden}
   .weekday-shortcuts button,.date-input-link{display:flex;align-items:center;justify-content:center;gap:3px;height:25px;padding:0 7px;border:1px solid #d3e2ec;border-radius:6px;background:#fff;color:#648098;font-size:9px;white-space:nowrap;cursor:pointer}
   .weekday-shortcuts button:hover,.weekday-shortcuts button.selected{border-color:#7fb0d2;background:#eaf3fb;color:#1c568f;font-weight:700}
   .date-input-link{position:relative;border-style:dashed}
   .date-input-link svg{width:11px}
   .date-input-link input{position:absolute;inset:0;width:100%;opacity:0;cursor:pointer}
    .time-field{display:flex;align-items:center;gap:8px;height:48px;margin-top:7px;padding:0 10px;border:1px solid #9fc4dc;border-radius:8px;background:#f7fbfe;color:#2d6fba}
    .time-field:focus-within{border-color:#2d6fba;box-shadow:0 0 0 3px #eaf3fb}
    .time-field>svg{width:15px;flex:none}
    .time-select-wrap{display:flex;align-items:center;height:32px;padding:0 3px;border:1px solid #c7dbe9;border-radius:6px;background:#fff}
    .time-select{width:36px;height:30px;padding:0 2px;border:0;background:#fff;color:#1d3d5a;font-size:16px;font-weight:800;text-align:center;outline:0;cursor:pointer;appearance:none}
    .time-colon{margin:0 1px;color:#7f9ab0;font-size:16px;font-weight:800}
    .time-zone{margin-left:auto;color:#7891a5;font-size:9px;white-space:nowrap}
   .compact-scheduler .time-presets{display:flex;gap:5px;margin-top:7px}
   .compact-scheduler .time-presets button{height:24px;padding:0 7px;border:1px solid #d3e2ec;border-radius:6px;background:#fff;color:#648098;font-size:9px;cursor:pointer}
   .compact-scheduler .time-presets button:hover,.compact-scheduler .time-presets button.selected{border-color:#7fb0d2;background:#eaf3fb;color:#1c568f;font-weight:700}
   .new-time-summary{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px;padding:8px 9px;border-radius:7px;background:#f1f6fa;color:#7891a5;font-size:9px}
   .new-time-summary strong{color:#1d568f;font-size:10px;text-align:right}
   .compact-scheduler .pop-actions{margin-top:12px;padding-top:10px}
  @media(max-width:850px){.agenda-content{padding:13px}.filter-rail{background:#e8f2f8;border-color:#dce8f1}.agenda-card{border-radius:10px}}
`;