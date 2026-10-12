import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, CalendarDays, PhoneCall, Star, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { callQualityPraise, callSummaryQuality } from "@/lib/call-period-summary";
import { callPeriodOrbitAnimation } from "./call-period-summary-animation";
import type { LottieAnimation } from "@/vendor/lottie-light";
import "./call-period-summary.css";

interface Props {
  scopeKey: string; ready: boolean; period: string;
  total: number; withAlerts: number; avgQ: string | null;
}

function OrbitAnimation() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let player: LottieAnimation | undefined;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const play = () => {
      if (!player) return;
      if (preference.matches) player.goToAndStop(Math.max(0, player.totalFrames - 1), true);
      else player.play();
    };
    void import("@/vendor/lottie-light.js").then(({ default: lottie }) => {
      if (cancelled || !host.current) return;
      // Lottie mutates animation data; each instance owns its own copy.
      player = lottie.loadAnimation({
        container: host.current, renderer: "svg", loop: false, autoplay: false,
        animationData: structuredClone(callPeriodOrbitAnimation),
        rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
      });
      player.addEventListener("DOMLoaded", play);
      if (player.isLoaded) play();
    }).catch(() => { console.error("[CallPeriodSummary] Unable to load local animation"); });
    preference.addEventListener("change", play);
    return () => {
      cancelled = true;
      preference.removeEventListener("change", play);
      player?.removeEventListener("DOMLoaded", play);
      player?.destroy();
    };
  }, []);
  return <div ref={host} className="cps-lottie-mark" aria-hidden="true" data-testid="call-summary-lottie" />;
}

function FloatingSummary({ period, total, withAlerts, avgQ, dismiss }: Props & { dismiss: () => void }) {
  const { t } = useI18n();
  const ca = t.callAnalysis;
  const copy = ca.periodSummary;
  const hintId = useId();
  const [count, setCount] = useState(total);
  const [paused, setPaused] = useState(false);
  const [closing, setClosing] = useState(false);
  const quality = callSummaryQuality(total, avgQ);
  const praise = callQualityPraise(quality, copy);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let timer = 0;
    const stop = () => { window.clearTimeout(timer); cancelAnimationFrame(frame); setCount(total); };
    if (preference.matches) { stop(); return; }
    setCount(0);
    timer = window.setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / 950);
        setCount(Math.round(total * (1 - (1 - progress) ** 3)));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, 520);
    preference.addEventListener("change", stop);
    return () => { clearTimeout(timer); cancelAnimationFrame(frame); preference.removeEventListener("change", stop); };
  }, [total]);
  useEffect(() => {
    if (paused || closing) return;
    const timer = window.setTimeout(() => setClosing(true), 5_500);
    return () => clearTimeout(timer);
  }, [paused, closing]);
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(dismiss, 190);
    return () => clearTimeout(timer);
  }, [closing, dismiss]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setClosing(true); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);

  return <div className={`cps-float-layer${closing ? " is-closing" : ""}`} data-testid="call-period-summary">
    <section className="cps-summary-toast" role="region" aria-label={`${copy.title}: ${period}`} aria-describedby={hintId}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)} onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}>
      <div className="cps-toast-header">
        <div className="cps-toast-period"><CalendarDays size={13} aria-hidden="true" /><span>{period}</span></div>
        <button type="button" className="cps-dismiss" aria-label={copy.close} onClick={() => setClosing(true)}><X size={16} /></button>
      </div>
      <div className="cps-toast-layout">
        <div className={`cps-center${total === 0 ? " is-empty" : ""}`}>
          <div className="cps-track cps-track-one" aria-hidden="true" />
          <div className="cps-track cps-track-two" aria-hidden="true" />
          <div className="cps-track cps-track-three" aria-hidden="true" />
          <span className="cps-satellite" aria-hidden="true"><PhoneCall size={16} /></span>
          <OrbitAnimation />
          <span className="cps-spark cps-spark-one" aria-hidden="true" />
          <span className="cps-spark cps-spark-two" aria-hidden="true" />
          <div className="cps-count-wrap">
            <span className="cps-count" aria-hidden="true">{count}</span>
            <span className="sr-only">{total}</span>
            <span className="cps-count-label">{ca.calls}</span>
          </div>
        </div>
        <div className="cps-feedback" data-praise-level={praise.band} role="status" aria-live="polite" aria-atomic="true">
          <span className="cps-quality-label">{copy.quality}</span>
          {quality !== null && <span className="cps-quality-value"><Star size={17} fill="currentColor" aria-hidden="true" />{avgQ}<small> / 10</small></span>}
          <span className={`cps-feedback-title${quality === null ? " cps-feedback-title--gentle" : ""}`}>{praise.title}</span>
          <p className="cps-feedback-copy">{praise.message}</p>
        </div>
      </div>
      {withAlerts > 0 && <div className="cps-toast-alert"><AlertTriangle size={12} aria-hidden="true" />{withAlerts} {copy.alerts}</div>}
      <p className="cps-dismiss-note" id={hintId}>{copy.dismissHint}</p>
    </section>
  </div>;
}

/** One reveal per explicitly selected period, only after the complete query succeeds. */
export function CallPeriodSummary(props: Props) {
  const lastScope = useRef<string | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!props.ready) { setVisible(false); return; }
    if (lastScope.current !== props.scopeKey) {
      lastScope.current = props.scopeKey;
      setVisible(true);
    }
  }, [props.ready, props.scopeKey]);
  if (!props.ready || !visible) return null;
  return <FloatingSummary key={props.scopeKey} {...props} dismiss={() => setVisible(false)} />;
}
