import { useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, ArrowUpRight, Plus, Minus } from 'lucide-react';
import { motion } from 'framer-motion';

const GRAY = '#8C8C8C';
const BLACK = '#0E0E0E';
const WHITE = '#F7F6F3';

const features = [
  {
    n: '01',
    title: 'One-tap lockdown',
    body: 'Something feels off? Hit one button. Every session, every device, every key — paused until you say otherwise. No support ticket. No waiting on hold.',
    tag: 'NEW IN 2.0',
  },
  {
    n: '02',
    title: 'Plain-English alerts',
    body: '“Someone in Lagos tried your password 14 times” beats “Anomalous auth event detected (code 4625).” We rewrote every alert like we were texting a friend.',
    tag: 'REWRITTEN',
  },
  {
    n: '03',
    title: 'Family seats, free',
    body: 'Your mom’s inbox is part of your attack surface. Latch 2.0 includes five free seats for the people you’d drop everything to help anyway.',
    tag: 'INCLUDED',
  },
  {
    n: '04',
    title: 'The 9pm report',
    body: 'One short note, once a day, after dinner. What we blocked, what we’re watching, what you can ignore. Most nights it just says: nothing happened. Good.',
    tag: 'DAILY',
  },
  {
    n: '05',
    title: 'No dark patterns',
    body: 'Cancel in two clicks. Export everything. We don’t hide the off switch — companies that do are telling you something about themselves.',
    tag: 'PROMISE',
  },
];

const voices = [
  {
    quote: 'I run a bakery, not a SOC. Latch is the first security tool that didn’t make me feel stupid for asking questions.',
    name: 'Marisol Vega',
    role: 'Owner, Knead & Co. — Tucson, AZ',
  },
  {
    quote: 'The 9pm report became a small ritual. Most nights it says “all quiet.” Turns out that’s what peace of mind actually looks like.',
    name: 'Devon Okafor',
    role: 'Freelance photographer — Portland, OR',
  },
  {
    quote: 'My dad clicked a fake invoice link in March. Latch caught it, explained it, and didn’t lecture either of us. That’s the whole review.',
    name: 'Priya Raman',
    role: 'Operations lead, 11-person startup',
  },
  {
    quote: 'Other vendors quoted me fear. Latch quoted me a price and a phone number that a human answers.',
    name: 'Tom Brzezinski',
    role: 'IT manager, Lakeshore Plumbing Supply',
  },
  {
    quote: 'I’ve been in the beta since week one. They shipped the unsexy fixes first. That told me everything.',
    name: 'Ana Lucia Ferreira',
    role: 'Community moderator, r/personalsecurity',
  },
];

const faqs = [
  {
    q: 'Is this another fear-based pitch?',
    a: 'No. We won’t show you a hooded hacker stock photo or a countdown timer. The internet has real risks; you deserve real answers, calmly delivered.',
  },
  {
    q: 'What does it cost?',
    a: '$9 a month, flat. Five family seats included. Existing members keep their current price forever — that’s the deal we made and we’re keeping it.',
  },
  {
    q: 'Do I need to be technical?',
    a: 'If you can install an app and read a text message, you can run Latch. The hard parts are our job, not yours.',
  },
];

function Scroller({ children, label }) {
  const ref = useRef(null);
  const scroll = (dir) => {
    if (ref.current) ref.current.scrollBy({ left: dir * 480, behavior: 'smooth' });
  };
  return (
    <div className="relative">
      <div className="flex items-center justify-between px-6 md:px-12 mb-6">
        <span className="font-mono text-[11px] tracking-[0.25em] uppercase" style={{ color: GRAY }}>
          {label}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => scroll(-1)}
            className="w-11 h-11 border border-[#0E0E0E] flex items-center justify-center hover:bg-[#0E0E0E] hover:text-[#F7F6F3] transition-colors duration-200"
            aria-label="Scroll left"
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => scroll(1)}
            className="w-11 h-11 border border-[#0E0E0E] flex items-center justify-center hover:bg-[#0E0E0E] hover:text-[#F7F6F3] transition-colors duration-200"
            aria-label="Scroll right"
          >
            <ArrowRight size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="latch-scroller flex gap-px overflow-x-auto snap-x snap-mandatory pb-8 px-6 md:px-12"
      >
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div style={{ backgroundColor: WHITE, color: BLACK }} className="min-h-screen antialiased">
      <link
        href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .font-display { font-family: 'Archivo', sans-serif; font-stretch: 110%; }
        .font-serif-ed { font-family: 'Newsreader', serif; }
        .font-mono { font-family: 'IBM Plex Mono', monospace; }
        .latch-scroller { scrollbar-width: thin; scrollbar-color: ${BLACK} transparent; }
        .latch-scroller::-webkit-scrollbar { height: 4px; }
        .latch-scroller::-webkit-scrollbar-track { background: transparent; border-top: 1px solid ${GRAY}; }
        .latch-scroller::-webkit-scrollbar-thumb { background: ${BLACK}; }
        @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .ticker-track { animation: ticker 28s linear infinite; }
        .feature-card:hover .feature-num { -webkit-text-stroke: 0px; color: ${WHITE}; }
        ::selection { background: ${BLACK}; color: ${WHITE}; }
      `,
        }}
      />

      {/* ===== Email chrome ===== */}
      <header className="border-b border-[#0E0E0E]">
        <div className="grid grid-cols-2 md:grid-cols-4 font-mono text-[11px] tracking-[0.15em] uppercase">
          <div className="px-6 py-4 border-r border-[#0E0E0E]">
            <span style={{ color: GRAY }}>FROM</span>
            <div className="mt-1 normal-case tracking-normal">team@latch.security</div>
          </div>
          <div className="px-6 py-4 md:border-r border-[#0E0E0E]">
            <span style={{ color: GRAY }}>TO</span>
            <div className="mt-1 normal-case tracking-normal">you (member #4,182)</div>
          </div>
          <div className="px-6 py-4 border-r border-t md:border-t-0 border-[#0E0E0E]">
            <span style={{ color: GRAY }}>SUBJECT</span>
            <div className="mt-1 normal-case tracking-normal">We finished the thing.</div>
          </div>
          <div className="px-6 py-4 border-t md:border-t-0 border-[#0E0E0E]">
            <span style={{ color: GRAY }}>DATE</span>
            <div className="mt-1 normal-case tracking-normal">Tue, Mar 12 · 9:02 AM</div>
          </div>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative border-b border-[#0E0E0E] overflow-hidden">
        <div className="px-6 md:px-12 pt-16 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1
              className="font-display font-black uppercase select-none"
              style={{ fontSize: '16vw', lineHeight: 0.8, letterSpacing: '-0.04em' }}
            >
              Latch
              <span className="block" style={{ color: GRAY }}>
                Two.
              </span>
            </h1>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mt-12 items-end">
            <div className="md:col-span-3 font-mono text-[11px] tracking-[0.2em] uppercase" style={{ color: GRAY }}>
              Issue № 14 — The Launch Letter
              <br />
              Read time: 4 minutes, honestly
            </div>
            <p className="md:col-span-6 font-serif-ed text-2xl md:text-[28px] leading-snug font-light">
              Hey — it’s the team at Latch. After eleven months and 4,182 of you poking holes in the beta,{' '}
              <em>Latch 2.0 is out today.</em> No countdown clocks, no scare tactics. Just the security tool we’d want
              our own families using.
            </p>
            <div className="md:col-span-3 md:text-right">
              <a
                href="#join"
                className="inline-flex items-center gap-2 bg-[#0E0E0E] text-[#F7F6F3] px-6 py-4 font-mono text-xs tracking-[0.2em] uppercase hover:bg-transparent hover:text-[#0E0E0E] border border-[#0E0E0E] transition-colors duration-200"
              >
                Get 2.0 <ArrowUpRight size={14} />
              </a>
            </div>
          </div>
        </div>

        {/* ticker */}
        <div className="border-t border-[#0E0E0E] py-3 overflow-hidden whitespace-nowrap">
          <div className="ticker-track inline-block font-mono text-[11px] tracking-[0.3em] uppercase">
            {[...Array(2)].map((_, i) => (
              <span key={i}>
                {['Built with the community', 'No fear-based marketing', '5 family seats free', 'Cancel in two clicks', 'A human answers the phone', 'Shipped March 12'].map(
                  (t, j) => (
                    <span key={j} className="mx-6">
                      {t} <span style={{ color: GRAY }}>·</span>
                    </span>
                  )
                )}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Letter ===== */}
      <section className="border-b border-[#0E0E0E]">
        <div className="grid grid-cols-1 md:grid-cols-12">
          <div className="md:col-span-4 p-6 md:p-12 border-b md:border-b-0 md:border-r border-[#0E0E0E]">
            <span className="font-mono text-[11px] tracking-[0.25em] uppercase" style={{ color: GRAY }}>
              ¶ A short, honest preamble
            </span>
            <h2
              className="font-display font-black uppercase mt-6"
              style={{ fontSize: 'clamp(40px, 5vw, 72px)', lineHeight: 0.85, letterSpacing: '-0.03em' }}
            >
              We’re not going to scare you into clicking.
            </h2>
          </div>
          <div className="md:col-span-8 p-6 md:p-12 font-serif-ed text-lg md:text-xl leading-relaxed font-light max-w-3xl">
            <p>
              Most security emails open with a breach statistic and a picture of a guy in a hoodie. We think that’s
              lazy, and worse, it doesn’t help you make a decision.
            </p>
            <p className="mt-6">
              Here’s the truth: most days, nothing bad will happen to you online. Latch exists for the days when
              something does — and for the quiet confidence of knowing someone’s watching the door so you don’t have
              to think about it at all.
            </p>
            <p className="mt-6">
              Version 2.0 isn’t a reinvention. It’s 312 small fixes, five new things you actually asked for, and a
              promise to keep talking to you like a neighbor, not a lead.
            </p>
            <p className="mt-8 font-mono text-xs tracking-[0.2em] uppercase not-italic" style={{ color: GRAY }}>
              — Sam, Ade, Rosa & the other nine of us
            </p>
          </div>
        </div>
      </section>

      {/* ===== Horizontal scroll: features ===== */}
      <section className="py-16 border-b border-[#0E0E0E]" style={{ backgroundColor: BLACK, color: WHITE }}>
        <div className="px-6 md:px-12 mb-10">
          <h2
            className="font-display font-black uppercase"
            style={{ fontSize: '14vw', lineHeight: 0.8, letterSpacing: '-0.04em' }}
          >
            What’s
            <span style={{ color: GRAY }}> new</span>
          </h2>
          <p className="font-serif-ed text-xl font-light mt-6 max-w-xl" style={{ color: GRAY }}>
            Five things, plainly described. Scroll sideways — like flipping through a magazine spread.
          </p>
        </div>

        <div className="latch-dark">
          <Scroller label="Drag or use the arrows · 01 — 05">
            {features.map((f) => (
              <article
                key={f.n}
                className="feature-card snap-start shrink-0 w-[85vw] sm:w-[440px] border border-[#8C8C8C] bg-[#0E0E0E] p-8 md:p-10 flex flex-col justify-between min-h-[440px] hover:bg-[#F7F6F3] hover:text-[#0E0E0E] transition-colors duration-300 group"
              >
                <div className="flex items-start justify-between">
                  <span
                    className="feature-num font-display font-black transition-all duration-300"
                    style={{
                      fontSize: '96px',
                      lineHeight: 0.8,
                      color: 'transparent',
                      WebkitTextStroke: `1px ${GRAY}`,
                    }}
                  >
                    {f.n}
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.25em] border border-[#8C8C8C] px-3 py-1.5">
                    {f.tag}
                  </span>
                </div>
                <div>
                  <h3
                    className="font-display font-bold uppercase"
                    style={{ fontSize: '32px', lineHeight: 0.9, letterSpacing: '-0.02em' }}
                  >
                    {f.title}
                  </h3>
                  <p className="font-serif-ed text-base leading-relaxed mt-5 font-light" style={{ color: GRAY }}>
                    {f.body}
                  </p>
                </div>
              </article>
            ))}
            <div className="snap-start shrink-0 w-[60vw] sm:w-[320px] flex items-center justify-center border border-[#8C8C8C]">
              <a href="#join" className="font-mono text-xs tracking-[0.25em] uppercase flex items-center gap-3 hover:gap-5 transition-all">
                Full changelog <ArrowRight size={16} />
              </a>
            </div>
          </Scroller>
        </div>
      </section>

      {/* ===== Big statement ===== */}
      <section className="border-b border-[#0E0E0E] py-20 px-6 md:px-12">
        <h2
          className="font-display font-black uppercase"
          style={{ fontSize: '14vw', lineHeight: 0.8, letterSpacing: '-0.045em' }}
        >
          No fear.
          <br />
          <span style={{ color: GRAY }}>Just fixes.</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-12 mt-12 gap-8">
          <div className="md:col-span-4 md:col-start-7 font-serif-ed text-lg leading-relaxed font-light">
            That’s been the whole pitch since 2021, and 2.0 doesn’t change it. We block the bad thing, tell you in
            plain English, and get out of your way.
          </div>
          <div className="md:col-span-2 font-mono text-[11px] tracking-[0.2em] uppercase leading-loose" style={{ color: GRAY }}>
            312 fixes shipped
            <br />
            0 scary stock photos
            <br />
            1 flat price
          </div>
        </div>
      </section>

      {/* ===== Horizontal scroll: community ===== */}
      <section className="py-16 border-b border-[#0E0E0E]">
        <div className="px-6 md:px-12 mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <h2
            className="font-display font-black uppercase"
            style={{ fontSize: 'clamp(48px, 7vw, 110px)', lineHeight: 0.8, letterSpacing: '-0.03em' }}
          >
            From the beta crowd
          </h2>
          <p className="font-mono text-[11px] tracking-[0.25em] uppercase max-w-[260px]" style={{ color: GRAY }}>
            4,182 members tested 2.0. These are their words, lightly trimmed, never paid for.
          </p>
        </div>

        <Scroller label="Member voices · Scroll →">
          {voices.map((v, i) => (
            <figure
              key={i}
              className="snap-start shrink-0 w-[85vw] sm:w-[420px] border border-[#0E0E0E] p-8 md:p-10 flex flex-col justify-between min-h-[380px] bg-[#F7F6F3] hover:bg-[#0E0E0E] hover:text-[#F7F6F3] transition-colors duration-300"
            >
              <blockquote className="font-serif-ed text-xl md:text-2xl leading-snug font-light">
                “{v.quote}”
              </blockquote>
              <figcaption className="mt-8 pt-6 border-t border-[#8C8C8C]">
                <div className="font-display font-bold uppercase text-sm tracking-wide">{v.name}</div>
                <div className="font-mono text-[11px] mt-1" style={{ color: GRAY }}>
                  {v.role}
                </div>
              </figcaption>
            </figure>
          ))}
        </Scroller>
      </section>

      {/* ===== FAQ ===== */}
      <section className="border-b border-[#0E0E0E] grid grid-cols-1 md:grid-cols-12">
        <div className="md:col-span-5 p-6 md:p-12 border-b md:border-b-0 md:border-r border-[#0E0E0E]">
          <span className="font-mono text-[11px] tracking-[0.25em] uppercase" style={{ color: GRAY }}>
            The questions you’d actually ask
          </span>
          <h2
            className="font-display font-black uppercase mt-6"
            style={{ fontSize: 'clamp(40px, 5vw, 80px)', lineHeight: 0.85, letterSpacing: '-0.03em' }}
          >
            Straight answers
          </h2>
        </div>
        <div className="md:col-span-7">
          {faqs.map((f, i) => (
            <div key={i} className={i !== faqs.length - 1 ? 'border-b border-[#0E0E0E]' : ''}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                className="w-full flex items-center justify-between text-left p-6 md:px-12 md:py-8 hover:bg-[#0E0E0E] hover:text-[#F7F6F3] transition-colors duration-200 group"
              >
                <span className="font-display font-bold uppercase text-lg md:text-xl tracking-tight">{f.q}</span>
                {openFaq === i ? <Minus size={18} strokeWidth={1.5} /> : <Plus size={18} strokeWidth={1.5} />}
              </button>
              {openFaq === i && (
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="px-6 md:px-12 pb-8 font-serif-ed text-lg leading-relaxed font-light max-w-2xl"
                  style={{ color: GRAY }}
                >
                  {f.a}
                </motion.p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section id="join" className="border-b border-[#0E0E0E] px-6 md:px-12 py-20" style={{ backgroundColor: BLACK, color: WHITE }}>
        <span className="font-mono text-[11px] tracking-[0.25em] uppercase" style={{ color: GRAY }}>
          Launch week, with the people who built it with us
        </span>
        <h2
          className="font-display font-black uppercase mt-8"
          style={{ fontSize: '14vw', lineHeight: 0.8, letterSpacing: '-0.045em' }}
        >
          Come say hi.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mt-12 items-end">
          <p className="md:col-span-5 font-serif-ed text-xl leading-relaxed font-light" style={{ color: GRAY }}>
            Thursday, 6 PM ET — a 40-minute community call. We’ll demo 2.0, answer everything live (yes, the awkward
            pricing questions too), and the first 200 RSVPs get a year of family seats on us.
          </p>
          <div className="md:col-span-7 flex flex-col sm:flex-row gap-3 md:justify-end">
            <a
              href="#"
              className="inline-flex items-center justify-center gap-3 bg-[#F7F6F3] text-[#0E0E0E] px-8 py-5 font-mono text-xs tracking-[0.2em] uppercase border border-[#F7F6F3] hover:bg-transparent hover:text-[#F7F6F3] transition-colors duration-200"
            >
              RSVP for Thursday <ArrowUpRight size={14} />
            </a>
            <a
              href="#"
              className="inline-flex items-center justify-center gap-3 px-8 py-5 font-mono text-xs tracking-[0.2em] uppercase border border-[#8C8C8C] hover:border-[#F7F6F3] transition-colors duration-200"
            >
              Just install 2.0
            </a>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="px-6 md:px-12 py-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 font-mono text-[11px] tracking-[0.15em] uppercase">
          <div className="md:col-span-4">
            Latch Security Co. — 14 Mercer St, Floor 2, NYC
            <br />
            <span style={{ color: GRAY }}>Twelve people. One phone number. (212) 555-0148.</span>
          </div>
          <div className="md:col-span-5 normal-case tracking-normal font-serif-ed text-base font-light" style={{ color: GRAY }}>
            You’re getting this because you joined the Latch community. If your inbox is full and this isn’t for you
            anymore — no hard feelings.{' '}
            <a href="#" className="underline underline-offset-4 decoration-[#8C8C8C] hover:text-[#0E0E0E]">
              Unsubscribe in one click.
            </a>
          </div>
          <div className="md:col-span-3 md:text-right" style={{ color: GRAY }}>
            № 14 / The Launch Letter
            <br />
            Set in Archivo & Newsreader
          </div>
        </div>
      </footer>
    </div>
  );
}