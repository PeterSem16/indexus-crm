import {
  ArrowUpRight,
  Building2,
  Check,
  Clock3,
  Hospital,
  Info,
  PhoneIncoming,
  PhoneMissed,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import "./Redesign.css";

const phone = "+421 918 751 470";

type Match = {
  id: string;
  type: string;
  name: string;
  context: string;
  detail: string;
  tone: "clinic" | "customer" | "hospital";
  icon: typeof Building2;
};

const matches: Match[] = [
  {
    id: "clinic",
    type: "Clinic",
    name: "Tes Klinika Viva",
    context: "MUDr. Peter Seman",
    detail: "Bratislava · Partner clinic",
    tone: "clinic",
    icon: Building2,
  },
  {
    id: "customer",
    type: "Customer",
    name: "Drahoslava Drastíková",
    context: "Private customer record",
    detail: "Slovakia · Active case",
    tone: "customer",
    icon: UserRound,
  },
  {
    id: "hospital",
    type: "Hospital",
    name: "Univerzitná nemocnica Martin",
    context: "Central maternity unit",
    detail: "Martin · Referral partner",
    tone: "hospital",
    icon: Hospital,
  },
];

export function Redesign() {
  const [selected, setSelected] = useState("clinic");
  const [associated, setAssociated] = useState(false);
  const [openedMissed, setOpenedMissed] = useState(false);

  const selectedMatch = matches.find((match) => match.id === selected) ?? matches[0];

  const chooseMatch = (id: string) => {
    setSelected(id);
    setAssociated(false);
  };

  return (
    <main className="caller-redesign">
      <header className="caller-redesign__masthead">
        <div>
          <p className="eyebrow">INDEXUS · Call handling</p>
          <h1>Recognise before you open.</h1>
          <p className="lede">
            A quieter way to resolve shared phone numbers, with the last-used relationship in view
            and every alternative one click away.
          </p>
        </div>
        <div className="queue-status" aria-label="Queue status">
          <span className="queue-status__dot" />
          <span><strong>Live queue</strong><small>12 calls waiting</small></span>
        </div>
      </header>

      <div className="caller-redesign__grid">
        <section className="call-surface" aria-labelledby="incoming-title">
          <div className="surface-topline">
            <span className="surface-kicker"><PhoneIncoming size={15} /> Incoming call</span>
            <span className="surface-time">Just now</span>
          </div>
          <div className="call-identity">
            <div className="call-identity__icon"><PhoneIncoming size={20} /></div>
            <div>
              <p className="call-label">Who is calling?</p>
              <h2 id="incoming-title">{phone}</h2>
            </div>
          </div>
          <div className="decision-note">
            <Info size={16} />
            <span>This number matches <strong>3 cards</strong>. Choose the record that owns this conversation.</span>
          </div>

          <div className="match-list" aria-label="Matching cards">
            {matches.map((match) => {
              const Icon = match.icon;
              const isSelected = selected === match.id;
              return (
                <button
                  type="button"
                  className={`match-card ${isSelected ? "is-selected" : ""} ${match.id === "clinic" ? "is-recommended" : ""}`}
                  key={match.id}
                  onClick={() => chooseMatch(match.id)}
                  aria-pressed={isSelected}
                >
                  {match.id === "clinic" && (
                    <span className="match-card__recommendation"><Sparkles size={13} /> Last used for this number</span>
                  )}
                  <span className={`match-card__avatar ${match.tone}`}><Icon size={20} /></span>
                  <span className="match-card__body">
                    <span className="match-card__type">{match.type}</span>
                    <span className="match-card__name">{match.name}</span>
                    <span className="match-card__context">{match.context}</span>
                    <span className="match-card__detail">{match.detail}</span>
                  </span>
                  <span className="match-card__action">
                    {isSelected ? <Check size={17} /> : <ArrowUpRight size={17} />}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="association-bar">
            <div>
              <span className="association-bar__label">Selected card</span>
              <strong>{selectedMatch.name}</strong>
              <small>{selectedMatch.type} · Opens and associates this call</small>
            </div>
            <button type="button" className="primary-action" onClick={() => setAssociated(true)}>
              {associated ? <><Check size={16} /> Associated</> : <>Open card <ArrowUpRight size={16} /></>}
            </button>
          </div>
          {associated && (
            <p className="feedback" role="status"><Check size={15} /> Call associated with {selectedMatch.name}.</p>
          )}
        </section>

        <section className="call-surface missed-surface" aria-labelledby="missed-title">
          <div className="surface-topline">
            <span className="surface-kicker surface-kicker--missed"><PhoneMissed size={15} /> Missed communication</span>
            <span className="surface-time">Today · 09:42</span>
          </div>
          <div className="missed-heading">
            <div className="missed-heading__icon"><PhoneMissed size={20} /></div>
            <div>
              <p className="call-label">Missed call</p>
              <h2 id="missed-title">{phone}</h2>
            </div>
          </div>
          <div className="remembered-card">
            <div className="remembered-card__topline">
              <span className="remembered-card__tag"><ShieldCheck size={13} /> Recognised card</span>
              <span className="remembered-card__time"><Clock3 size={13} /> Last used</span>
            </div>
            <div className="remembered-card__identity">
              <span className="match-card__avatar clinic"><Building2 size={20} /></span>
              <div>
                <span className="match-card__type">Clinic</span>
                <strong>Tes Klinika Viva</strong>
                <span>MUDr. Peter Seman · Bratislava</span>
              </div>
            </div>
            <p className="remembered-card__explain">
              This is the card you last opened for this number. Open it to return the call in the right context.
            </p>
            <button type="button" className="secondary-action" onClick={() => setOpenedMissed(true)}>
              {openedMissed ? <><Check size={16} /> Card opened</> : <>Open card <ArrowUpRight size={16} /></>}
            </button>
            {openedMissed && <p className="feedback feedback--dark" role="status"><Check size={15} /> Tes Klinika Viva is ready.</p>}
          </div>
          <p className="missed-footnote"><Info size={15} /> You can review the recognised card before taking any action.</p>
        </section>
      </div>
    </main>
  );
}