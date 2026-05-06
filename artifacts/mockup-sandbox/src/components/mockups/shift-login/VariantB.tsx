import { useState } from "react";

const PRIMARY = "#C4121E";
const PRIMARY_DARK = "#8B0E1A";
const PRIMARY_DEEP = "#1A0507";
const PRIMARY_TINT = "#FFF0F1";
const PRIMARY_BORDER = "#F0A0A6";

const CAMPAIGNS = [
  { id: "1", name: "SK Tehotenstvo Q2", channel: "phone", countries: ["🇸🇰", "🇨🇿"], date: "01.04 – 30.06.25" },
  { id: "2", name: "HU Noviny – Email", channel: "email", countries: ["🇭🇺"], date: "15.03 – 15.06.25" },
  { id: "3", name: "PL Retencia SMS", channel: "sms", countries: ["🇵🇱"], date: "01.05 – 31.05.25" },
  { id: "4", name: "RO Aquisitie – Telefon", channel: "phone", countries: ["🇷🇴"], date: "10.04 – 10.07.25" },
];

const QUEUES = [
  { id: "q1", name: "SK Inbound Support", country: "SK", hours: "08:00–18:00", did: "+421 2 333 4400", waiting: 3, online: 2 },
  { id: "q2", name: "CZ Priority Line", country: "CZ", hours: "09:00–17:00", did: "+420 2 666 1100", waiting: 0, online: 5 },
];

const CHANNEL = {
  phone: { label: "Telefón", color: "#C4121E", bg: PRIMARY_TINT, icon: "📞" },
  email: { label: "Email",   color: "#5B4FCF", bg: "#F3F1FD", icon: "✉️" },
  sms:   { label: "SMS",     color: "#2E75B6", bg: "#EFF5FB", icon: "💬" },
};

function HeadphonesIcon({ size = 28, color = "white" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
      <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  );
}

export function VariantB() {
  const [selCampaigns, setSelCampaigns] = useState<string[]>(["1"]);
  const [selQueues, setSelQueues] = useState<string[]>([]);

  const toggleC = (id: string) =>
    setSelCampaigns(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleQ = (id: string) =>
    setSelQueues(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const canStart = selCampaigns.length > 0 || selQueues.length > 0;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-100">
      <div className="w-[480px] rounded-2xl overflow-hidden shadow-2xl bg-white">

        {/* ── Hero band ── */}
        <div
          className="relative px-8 pt-8 pb-6 flex flex-col items-center gap-3 overflow-hidden"
          style={{ background: `linear-gradient(140deg, ${PRIMARY_DEEP} 0%, ${PRIMARY_DARK} 55%, ${PRIMARY} 100%)` }}
        >
          {/* Decorative circles */}
          <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full opacity-10"
               style={{ background: PRIMARY }} />
          <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full opacity-10"
               style={{ background: "#FF8090" }} />
          {/* Subtle grid texture */}
          <div className="absolute inset-0 opacity-5"
               style={{
                 backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
                 backgroundSize: "20px 20px"
               }} />

          {/* Icon */}
          <div className="relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
               style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)" }}>
            <HeadphonesIcon size={26} color="white" />
          </div>

          <div className="relative z-10 text-center">
            <h2 className="text-white font-bold text-xl tracking-tight">Prihlásenie na zmenu</h2>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>
              Vyberte kampane a fronty pre túto zmenu
            </p>
          </div>

          {/* Agent strip */}
          <div className="relative z-10 w-full flex items-center gap-3 mt-2 px-4 py-3 rounded-xl"
               style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <div className="relative">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                   style={{ background: "rgba(255,255,255,0.20)", color: "#fff", border: "2px solid rgba(255,255,255,0.30)" }}>
                MN
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                   style={{ background: "#4ADE80", borderColor: PRIMARY_DEEP }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold">Mária Nováková</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>Operátor · Bratislava</p>
            </div>
            <div className="text-xs px-2.5 py-1 rounded-full font-medium"
                 style={{ background: "rgba(74,222,128,0.18)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.30)" }}>
              Online
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-5" style={{ background: "#F7F7F8" }}>

          {/* Campaigns */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Kampane
              </span>
              {selCampaigns.length > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: PRIMARY_TINT, color: PRIMARY }}>
                  {selCampaigns.length} vybrané
                </span>
              )}
            </div>
            <div className="space-y-2">
              {CAMPAIGNS.map(c => {
                const cfg = CHANNEL[c.channel as keyof typeof CHANNEL];
                const sel = selCampaigns.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleC(c.id)}
                    className="w-full text-left rounded-xl transition-all duration-150 overflow-hidden"
                    style={{
                      background: sel ? PRIMARY_TINT : "#FFFFFF",
                      border: `1px solid ${sel ? PRIMARY_BORDER : "#E5E7EB"}`,
                      boxShadow: sel ? `0 0 0 1px ${PRIMARY_BORDER}` : "none",
                    }}
                  >
                    <div className="flex items-center gap-3 px-3.5 py-2.5">
                      {/* Left color bar — always brand crimson when selected, channel color otherwise */}
                      <div className="w-1 self-stretch rounded-full shrink-0"
                           style={{ background: sel ? PRIMARY : cfg.color, minHeight: 32 }} />

                      {/* Channel icon */}
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm"
                           style={{ background: sel ? `${PRIMARY}18` : `${cfg.color}15` }}>
                        {cfg.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate text-gray-800">
                          {c.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px]">{c.countries.join(" ")}</span>
                          <span className="text-[10px] text-gray-400">{c.date}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                              style={{
                                background: sel ? `${PRIMARY}15` : `${cfg.color}15`,
                                color: sel ? PRIMARY : cfg.color
                              }}>
                          {cfg.label}
                        </span>
                        <div className="w-5 h-5 rounded-md flex items-center justify-center transition-colors"
                             style={{
                               background: sel ? PRIMARY : "transparent",
                               border: `2px solid ${sel ? PRIMARY : "#D1D5DB"}`,
                             }}>
                          {sel && <CheckIcon />}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inbound Queues */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Inbound fronty
              </span>
              {selQueues.length > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: "#F0FDF4", color: "#16A34A" }}>
                  {selQueues.length} vybrané
                </span>
              )}
            </div>
            <div className="space-y-2">
              {QUEUES.map(q => {
                const sel = selQueues.includes(q.id);
                return (
                  <button
                    key={q.id}
                    onClick={() => toggleQ(q.id)}
                    className="w-full text-left rounded-xl transition-all duration-150 overflow-hidden"
                    style={{
                      background: sel ? "#F0FDF4" : "#FFFFFF",
                      border: `1px solid ${sel ? "#86EFAC" : "#E5E7EB"}`,
                    }}
                  >
                    <div className="flex items-center gap-3 px-3.5 py-2.5">
                      <div className="w-1 self-stretch rounded-full shrink-0"
                           style={{ background: "#16A34A", minHeight: 32 }} />
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                           style={{ background: sel ? "#DCFCE7" : "#F0FDF4" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate text-gray-800">{q.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-400">{q.hours}</span>
                          <span className="text-[10px] text-gray-300">·</span>
                          <span className="text-[10px] text-gray-400">{q.did}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {q.waiting > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">
                            {q.waiting} čaká
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700">
                          {q.online} online
                        </span>
                        <div className="w-5 h-5 rounded-md flex items-center justify-center ml-1"
                             style={{
                               background: sel ? "#16A34A" : "transparent",
                               border: `2px solid ${sel ? "#16A34A" : "#D1D5DB"}`,
                             }}>
                          {sel && <CheckIcon />}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 pb-6" style={{ background: "#F7F7F8" }}>
          <button
            disabled={!canStart}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200"
            style={{
              background: canStart
                ? `linear-gradient(135deg, ${PRIMARY_DARK} 0%, ${PRIMARY} 100%)`
                : "#E5E7EB",
              color: canStart ? "#FFFFFF" : "#9CA3AF",
              boxShadow: canStart ? `0 4px 16px ${PRIMARY}40` : "none",
              cursor: canStart ? "pointer" : "not-allowed",
            }}
          >
            <HeadphonesIcon size={17} color="currentColor" />
            Začať zmenu
            {canStart && <ArrowIcon />}
          </button>
          {!canStart && (
            <p className="text-center text-xs mt-2 text-gray-400">
              Vyberte aspoň jednu kampaň alebo frontu
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
