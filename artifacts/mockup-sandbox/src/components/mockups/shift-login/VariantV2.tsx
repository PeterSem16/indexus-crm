import { useState } from "react";

/* ─── Farby ─── */
const PRIMARY    = "#C4121E";
const CREAM_TOP  = "#FAF6F1";
const CREAM_BOT  = "#F5EDE8";
const CREAM_BODY = "#FAFAF8";
const CREAM_SEL  = "#FDF7F4";
const ROSE_BRD   = "#E8C8C8";
const TXT_DARK   = "#1E1014";
const TXT_MID    = "#6B5B5E";
const TXT_MUTED  = "#A89898";

/* ─── Mock i18n (v skutočnosti t.agentSession.xxx) ─── */
const t = {
  shiftLogin:         "Prihlásenie na zmenu",
  shiftLoginDesc:     "Vyberte kampane a fronty pre túto zmenu",
  startShift:         "Začať zmenu",
  selectAtLeastOne:   "Vyberte aspoň jednu kampaň alebo frontu",
  campaigns:          "Kampane",
  inboundQueues:      "Inbound fronty",
  selected:           "vybrané",
  selectedOne:        "vybraná",
  schedule:           "Rozvrh",
  callerId:           "Caller ID",
  dailyQuota:         "Denná kvóta",
  dailyTarget:        "Denný cieľ",
  dailyTargetReached: "Dnešný pokrok",
  breakTimeUsed:      "Čas prestávok dnes",
  calls:              "hovorov",
  emails:             "e-mailov",
  sms:                "SMS",
  waiting:            "čaká",
  online:             "online",
  administrator:      "Administrátor",
  operator:           "Operátor",
  noCampaigns:        "Žiadne kampane",
  min:                "min",
  of:                 "z",
};

/* ─── Mock dáta ─── */
const CAMPAIGNS = [
  {
    id: "1", name: "SK Tehotenstvo Q2", channel: "phone",
    countries: ["🇸🇰","🇨🇿"], date: "01.04 – 30.06.25",
    workingHoursStart: "08:00", workingHoursEnd: "18:00",
    outboundCallerId: "+421 2 333 4400",
    dailyCallQuota: 50,
  },
  {
    id: "2", name: "HU Noviny – Email", channel: "email",
    countries: ["🇭🇺"], date: "15.03 – 15.06.25",
    workingHoursStart: "09:00", workingHoursEnd: "17:00",
    outboundCallerId: null,
    dailyEmailQuota: 80,
  },
  {
    id: "3", name: "PL Retencia SMS", channel: "sms",
    countries: ["🇵🇱"], date: "01.05 – 31.05.25",
    workingHoursStart: "09:00", workingHoursEnd: "16:00",
    outboundCallerId: "+48 22 500 1234",
    dailySmsQuota: 120,
  },
  {
    id: "4", name: "RO Aquisitie – Telefon", channel: "phone",
    countries: ["🇷🇴"], date: "10.04 – 10.07.25",
    workingHoursStart: "10:00", workingHoursEnd: "19:00",
    outboundCallerId: "+40 21 000 9900",
    dailyCallQuota: 40,
  },
];

const QUEUES = [
  { id: "q1", name: "SK Inbound Support", hours: "08:00–18:00", did: "+421 2 333 4400", waiting: 3, online: 2 },
  { id: "q2", name: "CZ Priority Line",   hours: "09:00–17:00", did: "+420 2 666 1100", waiting: 0, online: 5 },
];

/* Dnešné štatistiky agenta (z agent-session) */
const TODAY = {
  callsDone:    23,
  callsQuota:   50,
  emailsDone:    8,
  emailsQuota:  null as number | null,
  breakUsedMin: 35,
  breakLimitMin: 60,
  contactsHandled: 31,
};

const CHANNEL_HEX: Record<string, string> = {
  phone: "#3B82F6", email: "#22C55E", sms: "#F97316", mixed: "#A855F7",
};
const CHANNEL_LABEL: Record<string, string> = {
  phone: "Telefón", email: "Email", sms: "SMS", mixed: "Mix",
};
const CHANNEL_ICON: Record<string, string> = {
  phone: "📞", email: "✉️", sms: "💬", mixed: "🔀",
};

function Check() {
  return (
    <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
      <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full h-1.5 rounded-full" style={{ background: "#EDE5DF" }}>
      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function StatPill({ label, value, max, color }: { label: string; value: number; max: number | null; color: string }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium" style={{ color: TXT_MUTED }}>{label}</span>
        <span className="text-[10px] font-semibold" style={{ color: TXT_DARK }}>
          {value}{max !== null ? <span style={{ color: TXT_MUTED }}>/{max}</span> : ""}
        </span>
      </div>
      {max !== null && <ProgressBar value={value} max={max} color={color} />}
    </div>
  );
}

export function VariantV2() {
  const [selC, setSelC] = useState<string[]>(["1"]);
  const [selQ, setSelQ] = useState<string[]>([]);
  const toggleC = (id: string) => setSelC(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleQ = (id: string) => setSelQ(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const canStart = selC.length > 0 || selQ.length > 0;

  const breakPct = Math.min(100, Math.round((TODAY.breakUsedMin / TODAY.breakLimitMin) * 100));
  const breakOver = TODAY.breakUsedMin >= TODAY.breakLimitMin;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#EDE9E4" }}>
      <div className="w-[500px] rounded-2xl overflow-hidden shadow-xl" style={{ border: "1px solid #DDD5CE" }}>

        {/* ── Krémová hlavička ── */}
        <div className="relative px-6 pt-5 pb-5 overflow-hidden"
             style={{ background: `linear-gradient(160deg, ${CREAM_TOP} 0%, ${CREAM_BOT} 100%)` }}>
          <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full pointer-events-none"
               style={{ background: `radial-gradient(circle, ${PRIMARY}10 0%, transparent 70%)` }}/>
          <div className="absolute bottom-0 left-0 w-36 h-20 pointer-events-none"
               style={{ background: `radial-gradient(ellipse, ${PRIMARY}06 0%, transparent 70%)` }}/>

          {/* Ikona + nadpis */}
          <div className="relative z-10 flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0"
                 style={{ background: "#FFFFFF", border: `1px solid ${ROSE_BRD}` }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
                <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight" style={{ color: TXT_DARK }}>{t.shiftLogin}</h2>
              <p className="text-xs mt-0.5" style={{ color: TXT_MUTED }}>{t.shiftLoginDesc}</p>
            </div>
          </div>

          {/* Agent karta */}
          <div className="relative z-10 rounded-xl overflow-hidden"
               style={{ background: "#FFFFFF", border: "1px solid #E8E0DA", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            {/* Horný riadok: avatar + meno + status */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                     style={{ background: `${PRIMARY}18`, color: PRIMARY, border: `1.5px solid ${ROSE_BRD}` }}>
                  MN
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-green-500"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: TXT_DARK }}>Mária Nováková</p>
                <p className="text-xs" style={{ color: TXT_MUTED }}>{t.operator} · Bratislava</p>
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0" }}>Online</span>
            </div>

            {/* Štatistiky agenta: kvóta + prestávka */}
            <div className="px-4 pb-3 border-t" style={{ borderColor: "#F0EAE5" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mt-2.5 mb-2" style={{ color: TXT_MUTED }}>
                {t.dailyTargetReached}
              </p>
              <div className="flex gap-4">
                <StatPill label={t.calls}  value={TODAY.callsDone}  max={TODAY.callsQuota}  color={PRIMARY} />
                <StatPill label={t.emails} value={TODAY.emailsDone} max={TODAY.emailsQuota} color="#5B4FCF" />
              </div>

              {/* Čas prestávok */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium" style={{ color: TXT_MUTED }}>{t.breakTimeUsed}</span>
                  <span className="text-[10px] font-semibold" style={{ color: breakOver ? "#DC2626" : TXT_DARK }}>
                    {TODAY.breakUsedMin} {t.min}
                    <span style={{ color: TXT_MUTED }}> {t.of} {TODAY.breakLimitMin} {t.min}</span>
                  </span>
                </div>
                <ProgressBar value={TODAY.breakUsedMin} max={TODAY.breakLimitMin} color={breakOver ? "#DC2626" : "#F97316"} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Telo ── */}
        <div className="px-5 py-4 space-y-4" style={{ background: CREAM_BODY }}>

          {/* Kampane */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: TXT_MUTED }}>
                {t.campaigns}
              </span>
              {selC.length > 0 && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: `${PRIMARY}12`, color: PRIMARY }}>
                  {selC.length} {selC.length === 1 ? t.selectedOne : t.selected}
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {CAMPAIGNS.map(c => {
                const bar   = CHANNEL_HEX[c.channel] || PRIMARY;
                const sel   = selC.includes(c.id);
                const quota = c.channel === "phone" ? c.dailyCallQuota
                            : c.channel === "email" ? (c as any).dailyEmailQuota
                            : (c as any).dailySmsQuota;
                return (
                  <button key={c.id} onClick={() => toggleC(c.id)}
                    className="w-full text-left rounded-xl transition-all duration-150"
                    style={{
                      background: sel ? CREAM_SEL : "#FFFFFF",
                      border: `1px solid ${sel ? ROSE_BRD : "#EDE5DF"}`,
                    }}>
                    <div className="flex items-start gap-3 px-3 py-2.5">
                      {/* Farebný pruh */}
                      <div className="w-1 rounded-full shrink-0 mt-0.5"
                           style={{ background: sel ? PRIMARY : bar, minHeight: 42 }}/>
                      {/* Ikona */}
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm mt-0.5"
                           style={{ background: sel ? `${PRIMARY}10` : `${bar}15` }}>
                        {CHANNEL_ICON[c.channel]}
                      </div>
                      {/* Obsah */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-tight" style={{ color: TXT_DARK }}>{c.name}</p>
                          {/* Checkbox */}
                          <div className="rounded flex items-center justify-center shrink-0 mt-0.5"
                               style={{ width: 16, height: 16, background: sel ? PRIMARY : "transparent",
                                        border: `2px solid ${sel ? PRIMARY : "#CBBFBA"}` }}>
                            {sel && <Check />}
                          </div>
                        </div>

                        {/* Metainfo riadok 1: vlajky + dátumy + kanál */}
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px]">{c.countries.join(" ")}</span>
                          <span className="text-[10px]" style={{ color: TXT_MUTED }}>{c.date}</span>
                          <span className="text-[10px] font-medium px-1.5 py-0 rounded-full"
                                style={{ background: sel ? `${PRIMARY}12` : `${bar}12`,
                                         color: sel ? PRIMARY : bar }}>
                            {CHANNEL_LABEL[c.channel]}
                          </span>
                        </div>

                        {/* Metainfo riadok 2: rozvrh + caller ID + kvóta */}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {/* Scheduling */}
                          <div className="flex items-center gap-1">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={TXT_MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                            </svg>
                            <span className="text-[10px] font-medium" style={{ color: TXT_MID }}>
                              {c.workingHoursStart} – {c.workingHoursEnd}
                            </span>
                          </div>
                          {/* Caller ID */}
                          {c.outboundCallerId && (
                            <div className="flex items-center gap-1">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={TXT_MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.39 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.9a16 16 0 0 0 6.07 6.07l.96-.96a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
                              </svg>
                              <span className="text-[10px] font-medium" style={{ color: TXT_MID }}>
                                {c.outboundCallerId}
                              </span>
                            </div>
                          )}
                          {/* Kvóta */}
                          {quota && (
                            <div className="flex items-center gap-1">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={TXT_MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                              </svg>
                              <span className="text-[10px] font-medium" style={{ color: TXT_MID }}>
                                {quota} {t.calls}/deň
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inbound fronty */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: TXT_MUTED }}>
                {t.inboundQueues}
              </span>
              {selQ.length > 0 && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: "#F0FDF4", color: "#16A34A" }}>
                  {selQ.length} {selQ.length === 1 ? t.selectedOne : t.selected}
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {QUEUES.map(q => {
                const sel = selQ.includes(q.id);
                return (
                  <button key={q.id} onClick={() => toggleQ(q.id)}
                    className="w-full text-left rounded-xl transition-all duration-150"
                    style={{ background: sel ? "#F6FEF9" : "#FFFFFF", border: `1px solid ${sel ? "#86EFAC" : "#EDE5DF"}` }}>
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: "#16A34A", minHeight: 28 }}/>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                           style={{ background: sel ? "#DCFCE7" : "#F0FDF4" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: TXT_DARK }}>{q.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex items-center gap-1">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={TXT_MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                            </svg>
                            <span className="text-[10px]" style={{ color: TXT_MUTED }}>{q.hours}</span>
                          </div>
                          <span style={{ color: "#CBBFBA" }} className="text-[10px]">·</span>
                          <span className="text-[10px]" style={{ color: TXT_MUTED }}>{q.did}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {q.waiting > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: "#FEF2F2", color: "#DC2626" }}>
                            {q.waiting} {t.waiting}
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{ background: "#F0FDF4", color: "#16A34A" }}>
                          {q.online} {t.online}
                        </span>
                        <div className="rounded flex items-center justify-center ml-0.5"
                             style={{ width: 16, height: 16, background: sel ? "#16A34A" : "transparent",
                                      border: `2px solid ${sel ? "#16A34A" : "#CBBFBA"}` }}>
                          {sel && <Check />}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Päta ── */}
        <div className="px-5 pb-5 pt-1" style={{ background: CREAM_BODY }}>
          <button
            disabled={!canStart}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all duration-200"
            style={{
              background: canStart ? PRIMARY : "#E8E0DA",
              color: canStart ? "#FFFFFF" : "#A89898",
              boxShadow: canStart ? `0 3px 12px ${PRIMARY}30` : "none",
              cursor: canStart ? "pointer" : "not-allowed",
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
              <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
            </svg>
            {t.startShift}
            {canStart && (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            )}
          </button>
          {!canStart && (
            <p className="text-center text-[11px] mt-1.5" style={{ color: TXT_MUTED }}>
              {t.selectAtLeastOne}
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
