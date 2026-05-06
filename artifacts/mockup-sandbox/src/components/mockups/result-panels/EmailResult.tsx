import { useState } from "react";
import {
  Mail, ChevronDown, ChevronUp, ChevronRight, CircleDot,
  Send, Clock, MailCheck, MailX, Star, User, Target,
  CalendarPlus, RefreshCw
} from "lucide-react";

const EMAIL_AC = "#5B4FCF";
const STONE_BG = "#EEEBE4";
const CARD_BG = "#F8F4EE";
const WHITE = "#FFFFFF";
const TEXT_PRIMARY = "#2E2118";
const TEXT_MUTED = "#9A8878";
const BADGE_BG = "#EDE8E0";
const BADGE_TEXT = "#7A6858";

const categories = [
  {
    id: "cat1",
    name: "Odoslaný email",
    color: "#5B4FCF",
    statuses: [
      { id: "s1", name: "Email odoslaný — čakáme na odpoveď", icon: Send, action: "send_email", days: null },
      { id: "s2", name: "Email prečítaný — follow-up zajtra", icon: MailCheck, action: "schedule_email", days: "1d" },
      { id: "s3", name: "Opakovaný email — 3 dni", icon: RefreshCw, action: "schedule_email", days: "3d" },
    ],
  },
  {
    id: "cat2",
    name: "Odpoveď zákazníka",
    color: "#5B7A4E",
    statuses: [
      { id: "s4", name: "Záujem potvrdený emailom", icon: Star, action: "convert", days: null },
      { id: "s5", name: "Termín dohodnutý emailom", icon: CalendarPlus, action: "complete", days: null },
    ],
  },
  {
    id: "cat3",
    name: "Nereaguje",
    color: "#2E75B6",
    statuses: [
      { id: "s6", name: "Email nedoručiteľný", icon: MailX, action: "dnd", days: null },
      { id: "s7", name: "Žiadna odpoveď — 1 týždeň", icon: Clock, action: "schedule_email", days: "1t" },
      { id: "s8", name: "Žiadna odpoveď — 2 týždne", icon: Clock, action: "schedule_email", days: "2t" },
    ],
  },
  {
    id: "cat4",
    name: "Odmietnutie",
    color: "#A0493A",
    statuses: [
      { id: "s9", name: "Odhlásiť z emailov (unsubscribe)", icon: MailX, action: "dnd", sub: 2 },
    ],
  },
];

const ACTION_LABELS: Record<string, string> = {
  send_email: "Odoslať",
  schedule_email: "Plán email",
  complete: "Uzavretie",
  convert: "Konverzia",
  dnd: "DND",
};

export function EmailResult() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["cat1", "cat2"]));
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <div className="min-h-screen flex flex-col" style={{ background: STONE_BG, fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: WHITE, borderBottom: `1px solid ${EMAIL_AC}30`, padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: EMAIL_AC, display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 2px 8px ${EMAIL_AC}40`
          }}>
            <Target style={{ width: 16, height: 16, color: WHITE }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY }}>Výsledok emailu</div>
            <div style={{ fontSize: 11, color: TEXT_MUTED }}>Vyberte výsledok pred pokračovaním</div>
          </div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: `${EMAIL_AC}10`, borderRadius: 8, padding: "6px 10px",
          border: `1px solid ${EMAIL_AC}25`
        }}>
          <User style={{ width: 12, height: 12, color: EMAIL_AC }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY }}>MUDr. Novák Peter</span>
          <span style={{ fontSize: 11, color: TEXT_MUTED }}>· novak@klinika.sk</span>
          <span style={{ marginLeft: "auto", fontSize: 10, padding: "2px 8px", borderRadius: 99, background: BADGE_BG, color: BADGE_TEXT, fontWeight: 600 }}>My CB</span>
        </div>
      </div>

      {/* Label */}
      <div style={{ padding: "10px 16px 4px", display: "flex", alignItems: "center", gap: 6 }}>
        <Mail style={{ width: 12, height: 12, color: EMAIL_AC }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TEXT_MUTED }}>
          Email — Stone &amp; Violet
        </span>
      </div>

      {/* Categories */}
      <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        {categories.map((cat) => {
          const isOpen = expanded.has(cat.id);
          const ac = cat.color;
          return (
            <div key={cat.id} style={{
              borderRadius: 16, overflow: "hidden",
              background: CARD_BG,
              border: `1.5px solid ${ac}35`,
              boxShadow: `0 2px 10px ${ac}15`
            }}>
              <button
                type="button"
                onClick={() => toggle(cat.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", textAlign: "left", cursor: "pointer", border: "none",
                  background: isOpen ? `${ac}12` : `${ac}06`,
                  borderBottom: isOpen ? `1px solid ${ac}25` : "none",
                  transition: "all 0.15s"
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: ac, display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 2px 6px ${ac}45`, flexShrink: 0
                }}>
                  <Mail style={{ width: 15, height: 15, color: WHITE }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>{cat.name}</div>
                  <div style={{ fontSize: 11, color: TEXT_MUTED }}>{cat.statuses.length} výsledkov</div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, minWidth: 24, height: 24,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: 99, padding: "0 8px",
                  background: ac, color: WHITE, flexShrink: 0
                }}>{cat.statuses.length}</span>
                {isOpen
                  ? <ChevronUp style={{ width: 14, height: 14, color: ac, flexShrink: 0 }} />
                  : <ChevronDown style={{ width: 14, height: 14, color: ac, flexShrink: 0 }} />
                }
              </button>

              {isOpen && (
                <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {cat.statuses.map((st) => {
                    const Icon = st.icon || CircleDot;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 12px", borderRadius: 12, cursor: "pointer",
                          background: WHITE, border: `1px solid ${ac}20`,
                          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                          transition: "all 0.15s", textAlign: "left"
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor = `${ac}55`;
                          (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 12px ${ac}18`;
                          (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor = `${ac}20`;
                          (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)";
                          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                        }}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: `${ac}12`, border: `1.5px solid ${ac}25`,
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                        }}>
                          <Icon style={{ width: 14, height: 14, color: ac }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, flex: 1 }}>{st.name}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          {st.action && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                              background: `${ac}15`, color: ac
                            }}>
                              {ACTION_LABELS[st.action] || st.action}
                            </span>
                          )}
                          {(st as any).days && (
                            <span style={{ fontSize: 10, color: TEXT_MUTED }}>{(st as any).days}</span>
                          )}
                          {(st as any).sub ? (
                            <span style={{
                              fontSize: 10, fontWeight: 700, width: 22, height: 22,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              borderRadius: 99, background: `${ac}15`, color: ac
                            }}>{(st as any).sub}↳</span>
                          ) : null}
                          <ChevronRight style={{ width: 13, height: 13, color: TEXT_MUTED }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Notes area */}
      <div style={{ padding: "8px 12px 16px", borderTop: `1px solid ${EMAIL_AC}20`, background: WHITE, marginTop: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_MUTED, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Poznámka k emailu (voliteľné)
        </div>
        <div style={{
          borderRadius: 10, border: `1px solid ${EMAIL_AC}25`, background: CARD_BG,
          padding: "8px 12px", fontSize: 12, color: TEXT_MUTED, minHeight: 48
        }}>
          Doplňte krátku poznámku...
        </div>
      </div>
    </div>
  );
}
