import { useEffect, useState } from "react";

/**
 * Back Office new-task sound alert.
 *
 * A distinct, pleasant Web-Audio chime played when a new Back Office task arrives.
 * Deliberately different from the inbound-call ringtone (client/src/lib/inbound-ringtones.ts):
 * this is a short, bright "sparkle" notification, not a repeating ring.
 *
 * Everything here is best-effort: if the browser blocks autoplay before a user
 * gesture, we silently skip the sound (the on-screen toast still appears).
 */

const MUTE_STORAGE_KEY = "indexus:bo-sound-muted";
const MUTE_EVENT = "indexus:bo-sound-muted-changed";

// Single lazily-created AudioContext shared across chimes (mirrors the inbound popup pattern).
let __boChimeCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!__boChimeCtx) {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    try {
      __boChimeCtx = new Ctx();
    } catch {
      return null;
    }
  }
  return __boChimeCtx;
}

export function isBackOfficeSoundMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setBackOfficeSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore storage failures (private mode, etc.) */
  }
  try {
    window.dispatchEvent(new CustomEvent(MUTE_EVENT, { detail: muted }));
  } catch {
    /* ignore */
  }
}

/**
 * Resume the AudioContext from inside a user gesture so later chimes are audible.
 * Safe to call repeatedly; a no-op when already running or unsupported.
 */
export function primeBackOfficeAudio(): void {
  try {
    const ctx = getCtx();
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  } catch {
    /* best-effort */
  }
}

let __unlockInstalled = false;
/**
 * Install one-time listeners that unlock audio on the first user gesture. Because a
 * Back Office task can arrive while the page is idle (no recent interaction), browsers
 * may keep the AudioContext suspended; priming it on an earlier gesture makes the chime
 * reliably audible. Idempotent — only the first call installs the listeners.
 */
export function installBackOfficeAudioUnlock(): void {
  if (__unlockInstalled || typeof window === "undefined") return;
  __unlockInstalled = true;
  const unlock = () => {
    primeBackOfficeAudio();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });
}

function scheduleTone(
  ctx: AudioContext,
  baseTime: number,
  startOffset: number,
  durationSec: number,
  frequency: number,
  type: OscillatorType,
  peakGain: number,
  attack = 0.015,
  release = 0.18,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, baseTime + startOffset);
  gain.gain.setValueAtTime(0.0001, baseTime + startOffset);
  gain.gain.exponentialRampToValueAtTime(peakGain, baseTime + startOffset + attack);
  gain.gain.setValueAtTime(peakGain, baseTime + startOffset + Math.max(attack, durationSec - release));
  gain.gain.exponentialRampToValueAtTime(0.0001, baseTime + startOffset + durationSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(baseTime + startOffset);
  osc.stop(baseTime + startOffset + durationSec + 0.03);
}

/**
 * Play the Back Office new-task chime once. Respects the persisted mute setting
 * and never throws (audio is best-effort).
 */
export function playBackOfficeChime(): void {
  try {
    if (isBackOfficeSoundMuted()) return;
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const t = ctx.currentTime + 0.02;

    // A bright, rising two-step motif (D5 → A5) capped with a soft high shimmer (D6).
    // Sine/triangle bells at low gain keep it pleasant and clearly distinct from the
    // call ringtone's repeating arpeggio.
    scheduleTone(ctx, t, 0.0, 0.34, 587.33, "sine", 0.16, 0.012, 0.22); // D5
    scheduleTone(ctx, t, 0.0, 0.34, 880.0, "sine", 0.07, 0.012, 0.22); // A5 (harmony)
    scheduleTone(ctx, t, 0.14, 0.40, 880.0, "triangle", 0.15, 0.012, 0.26); // A5 lead
    scheduleTone(ctx, t, 0.30, 0.70, 1174.66, "sine", 0.11, 0.015, 0.5); // D6 shimmer
  } catch {
    /* best-effort: never break callers if audio is blocked */
  }
}

/**
 * React hook for the persisted Back Office mute toggle. Stays in sync across
 * components/tabs via the custom event and the storage event.
 */
export function useBackOfficeSoundMuted(): [boolean, (muted: boolean) => void] {
  const [muted, setMutedState] = useState<boolean>(() => isBackOfficeSoundMuted());

  useEffect(() => {
    const sync = () => setMutedState(isBackOfficeSoundMuted());
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "boolean") setMutedState(detail);
      else sync();
    };
    window.addEventListener(MUTE_EVENT, onCustom as EventListener);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(MUTE_EVENT, onCustom as EventListener);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setMuted = (next: boolean) => {
    setMutedState(next);
    setBackOfficeSoundMuted(next);
  };

  return [muted, setMuted];
}
