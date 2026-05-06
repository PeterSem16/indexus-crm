import { useState } from "react";
import {
  Phone, ChevronDown, ChevronUp, ChevronRight, CircleDot,
  PhoneForwarded, PhoneMissed, PhoneOff, Clock, CalendarCheck,
  Check, X, Star, AlertCircle, User, Target
} from "lucide-react";

const TERRACOTTA = "#B5622E";
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
    name: "Spätné volanie",
    color: "#B5622E",
    statuses: [
      { id: "s1", name: "Callback — zajtra", icon: PhoneForwarded, action: "callback", days: "1d" },
      { id: "s2", name: "Callback — 2 dni", icon: PhoneForwarded, action: "callback", days: "2d" },
      { id: "s3", name: "Callback — týždeň", icon: PhoneForwarded, action: "callback", days: "1t" },
    ],
  },
  {
    id: "cat2",
    name: "Termíny",
    color: "#5B7A4E",
    statuses: [
      { id: "s4", name: "Termín dohodnutý", icon: CalendarCheck, action: "complete", days: null },
      { id: "s5", name: "Záujem potvrdený", icon: Star, action: "convert", days: null },
    ],
  },
  {
    id: "cat3",
    name: "Nedostupný",
    color: "#2E75B6",
    statuses: [
      { id: "s6", name: "Nedvíha — SMS odoslaná", icon: PhoneMissed, action: "send_sms", days: null },
      { id: "s7", name: "Nedvíha — voicemail", icon: PhoneMissed, action: "none", days: null },
      { id: "s8", name: "Neexistujúce číslo", icon: PhoneOff, action: "dnd", days: null },
    ],
  },
  {
    id: "cat4",
    name: "Odmietnutie",
    color: "#A0493A",
    statuses: [
      { id: "s9", name: "Nezáujem — definitívny", icon: X, action: "dnd", sub: 3 },
      { id: "s10", name: "Volajte neskôr", icon: Clock, action: "callback", days: "3d" },
    ],
  },
];

const ACTION_LABELS: Record<string, string> = {
  callback: "Spätné vol.",
  complete: "Uzavretie",
  convert: "Konverzia",
  send_sms: "SMS",
  dnd: "DND",
};

export function CallResult() {
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
      <div style={{ background: WHITE, borderBottom: `1px solid ${TERRACOTTA}30`, padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: TERRACOTTA, display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 2px 8px ${TERRACOTTA}40`
          }}>
            <Target style={{ width: 16, height: 16, color: WHITE }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY }}>Výsledok hovoru</div>
            <div style={{ fontSize: 11, color: TEXT_MUTED }}>Vyberte výsledok pred pokračovaním</div>
          </div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: `${TERRACOTTA}10`, borderRadius: 8, padding: "6px 10px",
          border: `1px solid ${TERRACOTTA}25`
        }}>
          <User style={{ width: 12, height: 12, color: TERRACOTTA }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY }}>MUDr. Novák Peter</span>
          <span style={{ fontSize: 11, color: TEXT_MUTED }}>· +421 905 123 456</span>
          <span style={{ marginLeft: "auto", fontSize: 10, padding: "2px 8px", borderRadius: 99, background: BADGE_BG, color: BADGE_TEXT, fontWeight: 600 }}>My CB</span>
        </div>
      </div>

      {/* Label */}
      <div style={{ padding: "10px 16px 4px", display: "flex", alignItems: "center", gap: 6 }}>
        <Phone style={{ width: 12, height: 12, color: TERRACOTTA }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TEXT_MUTED }}>
          Volanie — Stone &amp; Terracotta
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
                  <Phone style={{ width: 15, height: 15, color: WHITE }} />
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
                          {st.action && st.action !== "none" && (
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
      <div style={{ padding: "8px 12px 16px", borderTop: `1px solid ${TERRACOTTA}20`, background: WHITE, marginTop: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_MUTED, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Poznámka k hovoru (voliteľné)
        </div>
        <div style={{
          borderRadius: 10, border: `1px solid ${TERRACOTTA}25`, background: CARD_BG,
          padding: "8px 12px", fontSize: 12, color: TEXT_MUTED, minHeight: 48
        }}>
          Doplňte krátku poznámku...
        </div>
      </div>
    </div>
  );
}
