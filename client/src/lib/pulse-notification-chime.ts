let pulseChimeContext: AudioContext | null = null;
let unlockInstalled = false;

function getPulseChimeContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (pulseChimeContext) return pulseChimeContext;
  const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  try {
    pulseChimeContext = new AudioContextClass();
  } catch {
    return null;
  }
  return pulseChimeContext;
}

function schedulePulseTone(
  context: AudioContext,
  startTime: number,
  offset: number,
  duration: number,
  frequency: number,
  type: OscillatorType,
  volume: number,
): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startsAt = startTime + offset;
  const endsAt = startsAt + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startsAt);
  gain.gain.setValueAtTime(0.0001, startsAt);
  const attackEndsAt = Math.min(startsAt + 0.055, startsAt + duration * 0.35);
  gain.gain.exponentialRampToValueAtTime(volume, attackEndsAt);
  gain.gain.setValueAtTime(volume, Math.max(attackEndsAt, endsAt - 0.14));
  gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startsAt);
  oscillator.stop(endsAt + 0.03);
}

export function primePulseNotificationAudio(): void {
  try {
    const context = getPulseChimeContext();
    if (context?.state === "suspended") void context.resume();
  } catch {
    // Notification audio is best-effort and must never block the Pulse workflow.
  }
}

export function installPulseNotificationAudioUnlock(): void {
  if (unlockInstalled || typeof window === "undefined") return;
  unlockInstalled = true;
  const unlock = () => {
    primePulseNotificationAudio();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });
}

export function playPulseNotificationChime(): void {
  try {
    const context = getPulseChimeContext();
    if (!context) return;
    if (context.state === "suspended") void context.resume();
    const startsAt = context.currentTime + 0.02;

    // A near-whisper warm pad: low notes, a slow attack, and no sharp peak.
    schedulePulseTone(context, startsAt, 0, 0.28, 261.63, "sine", 0.016);
    schedulePulseTone(context, startsAt, 0.055, 0.27, 329.63, "sine", 0.006);
  } catch {
    // Keep the visual notification working when autoplay or Web Audio is unavailable.
  }
}