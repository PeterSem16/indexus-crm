import { useState } from "react";

const PRIMARY     = "#C4121E";
const CREAM_DEEP  = "#F5EDE8";   // header bottom
const CREAM_BASE  = "#FAF6F1";   // header top
const CREAM_BODY  = "#FAFAF8";   // body bg
const CREAM_SEL   = "#FDF7F4";   // selected card bg
const ROSE_BORDER = "#E8C8C8";   // selected card border
const TEXT_DARK   = "#1E1014";
const TEXT_MID    = "#6B5B5E";
const TEXT_MUTED  = "#A89898";

const CAMPAIGNS = [
  { id: "1", name: "SK Tehotenstvo Q2",  channel: "phone", countries: ["🇸🇰","🇨🇿"], date: "01.04 – 30.06.25" },
  { id: "2", name: "HU Noviny – Email",  channel: "email", countries: ["🇭🇺"],        date: "15.03 – 15.06.25" },
  { id: "3", name: "PL Retencia SMS",    channel: "sms",   countries: ["🇵🇱"],        date: "01.05 – 31.05.25" },
  { id: "4", name: "RO Aquisitie – Tel", channel: "phone", countries: ["🇷🇴"],        date: "10.04 – 10.07.25" },
];

const QUEUES = [
  { id: "q1", name: "SK Inbound Support", hours: "08:00–18:00", did: "+421 2 333 4400", waiting: 3, online: 2 },
  { id: "q2", name: "CZ Priority Line",   hours: "09:00–17:00", did: "+420 2 666 1100", waiting: 0, online: 5 },
];

const CHANNEL = {
  phone: { label: "Telefón", color: PRIMARY,    bg: "#FDF4F4", icon: "📞" },
  email: { label: "Email",   color: "#5B4FCF",  bg: "#F3F1FD", icon: "✉️" },
  sms:   { label: "SMS",     color: "#2E75B6",  bg: "#EFF5FB", icon: "💬" },
};

function HeadphonesIcon({ size = 24, color = PRIMARY }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
    </svg>
  );
}

function Check() {
  return (
    <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
      <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function VariantB() {
  const [selC, setSelC] = useState<string[]>(["1"]);
  const [selQ, setSelQ] = useState<string[]>([]);
  const toggleC = (id: string) => setSelC(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleQ = (id: string) => setSelQ(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const canStart = selC.length > 0 || selQ.length > 0;

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#EDE9E4" }}>
      <div className="w-[480px] rounded-2xl overflow-hidden shadow-xl" style={{ border: "1px solid #DDD5CE" }}>

        {/* ── Krémová hlavička ── */}
        <div
          className="relative px-8 pt-7 pb-6 overflow-hidden"
          style={{ background: `linear-gradient(160deg, ${CREAM_BASE} 0%, ${CREAM_DEEP} 100%)` }}
        >
          {/* Jemná dekoratívna kružnica */}
          <div className="absolute -top-12 -right-12 w-52 h-52 rounded-full pointer-events-none"
               style={{ background: `radial-gradient(circle, ${PRIMARY}12 0%, transparent 70%)` }} />
          <div className="absolute bottom-0 left-0 w-40 h-24 pointer-events-none"
               style={{ background: `radial-gradient(ellipse, ${PRIMARY}08 0%, transparent 70%)` }} />

          {/* Horný riadok: ikona + nadpis */}
          <div className="relative z-10 flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
                 style={{ background: "#FFFFFF", border: `1px solid ${ROSE_BORDER}` }}>
              <HeadphonesIcon size={22} color={PRIMARY} />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight" style={{ color: TEXT_DARK }}>
                Prihlásenie na zmenu
              </h2>
              <p className="text-xs mt-0.5" style={{ color: TEXT_MUTED }}>
                Vyberte kampane a fronty pre túto zmenu
              </p>
            </div>
          </div>

          {/* Agent karta */}
          <div className="relative z-10 flex items-center gap-3 px-4 py-3 rounded-xl"
               style={{ background: "#FFFFFF", border: "1px solid #E8E0DA", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                   style={{ background: `${PRIMARY}18`, color: PRIMARY, border: `1.5px solid ${ROSE_BORDER}` }}>
                MN
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                   style={{ background: "#22C55E" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: TEXT_DARK }}>Mária Nováková</p>
              <p className="text-xs" style={{ color: TEXT_MUTED }}>Operátor · Bratislava</p>
            </div>
            <div className="text-xs px-2.5 py-1 rounded-full font-medium"
                 style={{ background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0" }}>
              Online
            </div>
          </div>
        </div>

        {/* ── Telo ── */}
        <div className="px-6 py-5 space-y-5" style={{ background: CREAM_BODY }}>

          {/* Kampane */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: TEXT_MUTED }}>
                Kampane
              </span>
              {selC.length > 0 && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: `${PRIMARY}12`, color: PRIMARY }}>
                  {selC.length} vybrané
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {CAMPAIGNS.map(c => {
                const cfg = CHANNEL[c.channel as keyof typeof CHANNEL];
                const sel = selC.includes(c.id);
                return (
                  <button key={c.id} onClick={() => toggleC(c.id)}
                    className="w-full text-left rounded-xl transition-all duration-150"
                    style={{
                      background: sel ? CREAM_SEL : "#FFFFFF",
                      border: `1px solid ${sel ? ROSE_BORDER : "#EDE5DF"}`,
                      boxShadow: sel ? `inset 0 0 0 1px ${ROSE_BORDER}40` : "none",
                    }}>
                    <div className="flex items-center gap-3 px-3.5 py-2.5">
                      {/* Farebný pruh */}
                      <div className="w-1 self-stretch rounded-full flex-shrink-0"
                           style={{ background: sel ? PRIMARY : cfg.color, minHeight: 30 }} />
                      {/* Kanálová ikona */}
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                           style={{ background: sel ? `${PRIMARY}10` : cfg.bg }}>
                        {cfg.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: TEXT_DARK }}>{c.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px]">{c.countries.join(" ")}</span>
                          <span className="text-[10px]" style={{ color: TEXT_MUTED }}>{c.date}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                              style={{ background: sel ? `${PRIMARY}12` : `${cfg.color}12`, color: sel ? PRIMARY : cfg.color }}>
                          {cfg.label}
                        </span>
                        <div className="w-5 h-5 rounded-md flex items-center justify-center"
                             style={{ background: sel ? PRIMARY : "transparent", border: `2px solid ${sel ? PRIMARY : "#CBBFBA"}` }}>
                          {sel && <Check />}
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
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: TEXT_MUTED }}>
                Inbound fronty
              </span>
              {selQ.length > 0 && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: "#F0FDF4", color: "#16A34A" }}>
                  {selQ.length} vybrané
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {QUEUES.map(q => {
                const sel = selQ.includes(q.id);
                return (
                  <button key={q.id} onClick={() => toggleQ(q.id)}
                    className="w-full text-left rounded-xl transition-all duration-150"
                    style={{
                      background: sel ? "#F6FEF9" : "#FFFFFF",
                      border: `1px solid ${sel ? "#86EFAC" : "#EDE5DF"}`,
                    }}>
                    <div className="flex items-center gap-3 px-3.5 py-2.5">
                      <div className="w-1 self-stretch rounded-full flex-shrink-0"
                           style={{ background: "#16A34A", minHeight: 30 }} />
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                           style={{ background: sel ? "#DCFCE7" : "#F0FDF4" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: TEXT_DARK }}>{q.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px]" style={{ color: TEXT_MUTED }}>{q.hours}</span>
                          <span className="text-[10px]" style={{ color: "#CBBFBA" }}>·</span>
                          <span className="text-[10px]" style={{ color: TEXT_MUTED }}>{q.did}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {q.waiting > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: "#FEF2F2", color: "#DC2626" }}>
                            {q.waiting} čaká
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{ background: "#F0FDF4", color: "#16A34A" }}>
                          {q.online} online
                        </span>
                        <div className="w-5 h-5 rounded-md flex items-center justify-center"
                             style={{ background: sel ? "#16A34A" : "transparent", border: `2px solid ${sel ? "#16A34A" : "#CBBFBA"}` }}>
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
        <div className="px-6 pb-6 pt-1" style={{ background: CREAM_BODY }}>
          <button
            disabled={!canStart}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200"
            style={{
              background: canStart ? PRIMARY : "#E8E0DA",
              color: canStart ? "#FFFFFF" : "#A89898",
              boxShadow: canStart ? `0 3px 12px ${PRIMARY}30` : "none",
              cursor: canStart ? "pointer" : "not-allowed",
            }}>
            <HeadphonesIcon size={16} color="currentColor" />
            Začať zmenu
            {canStart && (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            )}
          </button>
          {!canStart && (
            <p className="text-center text-[11px] mt-2" style={{ color: TEXT_MUTED }}>
              Vyberte aspoň jednu kampaň alebo frontu
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
