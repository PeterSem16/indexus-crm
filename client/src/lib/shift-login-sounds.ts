type ShiftLoginSound =
  | "welcome"
  | "mission"
  | "inbound"
  | "backOffice"
  | "setApply"
  | "setCreate"
  | "start";

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextConstructor) return null;
  audioContext ||= new AudioContextConstructor();
  return audioContext;
}

function tone(
  context: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine",
  endFrequency?: number,
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.025, duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function chime(
  context: AudioContext,
  frequencies: number[],
  start: number,
  step: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine",
) {
  frequencies.forEach((frequency, index) => {
    tone(context, frequency, start + index * step, duration, volume, type);
    tone(context, frequency * 2, start + index * step + 0.008, duration * 0.72, volume * 0.14, "sine");
  });
}

export async function playShiftLoginSound(sound: ShiftLoginSound, selected = true): Promise<void> {
  try {
    const context = getAudioContext();
    if (!context) return;
    if (context.state === "suspended") await context.resume();
    const now = context.currentTime + 0.012;

    if (sound === "welcome") {
      chime(context, [392, 493.88, 587.33, 783.99], now, 0.085, 0.34, 0.026);
      tone(context, 196, now, 0.62, 0.012, "sine", 293.66);
      tone(context, 392, now + 0.08, 0.52, 0.008, "triangle", 587.33);
      return;
    }

    if (sound === "mission") {
      chime(context, selected ? [523.25, 659.25, 783.99] : [659.25, 523.25], now, 0.055, 0.22, selected ? 0.026 : 0.018);
      return;
    }

    if (sound === "inbound") {
      chime(context, selected ? [392, 587.33] : [587.33, 392], now, 0.07, 0.25, selected ? 0.027 : 0.018, "triangle");
      if (selected) tone(context, 783.99, now + 0.13, 0.14, 0.012, "sine");
      return;
    }

    if (sound === "backOffice") {
      chime(context, selected ? [329.63, 415.3, 493.88] : [493.88, 415.3, 329.63], now, 0.065, 0.26, selected ? 0.025 : 0.017, "triangle");
      tone(context, selected ? 164.81 : 246.94, now, 0.34, 0.009, "sine");
      return;
    }

    if (sound === "setApply") {
      chime(context, [440, 554.37, 659.25], now, 0.045, 0.2, 0.022);
      tone(context, 220, now, 0.3, 0.008, "triangle", 329.63);
      return;
    }

    if (sound === "setCreate") {
      chime(context, [659.25, 783.99, 987.77], now, 0.07, 0.32, 0.025);
      tone(context, 329.63, now, 0.46, 0.009, "sine", 493.88);
      return;
    }

    chime(context, [392, 523.25, 659.25, 783.99], now, 0.07, 0.34, 0.029);
    tone(context, 196, now, 0.58, 0.014, "triangle", 392);
    tone(context, 987.77, now + 0.28, 0.3, 0.016, "sine");
  } catch {
    // Audio feedback is progressive enhancement; shift login must always remain usable.
  }
}