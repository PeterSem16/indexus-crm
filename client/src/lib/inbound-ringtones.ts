export type InboundRingtoneId =
  | "classic"
  | "soft-chime"
  | "gentle-pulse"
  | "smart-arpeggio"
  | "urgent";

export interface InboundRingtonePreset {
  id: InboundRingtoneId;
  labelKey:
    | "ringtoneLabelClassic"
    | "ringtoneLabelSoftChime"
    | "ringtoneLabelGentlePulse"
    | "ringtoneLabelSmartArpeggio"
    | "ringtoneLabelUrgent";
  descriptionKey:
    | "ringtoneDescClassic"
    | "ringtoneDescSoftChime"
    | "ringtoneDescGentlePulse"
    | "ringtoneDescSmartArpeggio"
    | "ringtoneDescUrgent";
  burstDurationSec: number;
  intervalMs: number;
  play: (ctx: AudioContext, baseTime: number) => void;
}

const scheduleTone = (
  ctx: AudioContext,
  startOffset: number,
  durationSec: number,
  frequency: number,
  type: OscillatorType,
  peakGain: number,
  baseTime: number,
  attack = 0.02,
  release = 0.05,
) => {
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
  osc.stop(baseTime + startOffset + durationSec + 0.02);
};

const playClassic = (ctx: AudioContext, baseTime: number) => {
  scheduleTone(ctx, 0, 0.4, 425, "sine", 0.25, baseTime);
  scheduleTone(ctx, 0.55, 0.4, 425, "sine", 0.25, baseTime);
};

const playSoftChime = (ctx: AudioContext, baseTime: number) => {
  scheduleTone(ctx, 0, 0.65, 880, "sine", 0.16, baseTime, 0.04, 0.45);
  scheduleTone(ctx, 0, 0.65, 1320, "sine", 0.08, baseTime, 0.04, 0.45);
  scheduleTone(ctx, 0.45, 0.85, 1760, "sine", 0.06, baseTime, 0.04, 0.6);
};

const playGentlePulse = (ctx: AudioContext, baseTime: number) => {
  scheduleTone(ctx, 0, 0.18, 660, "sine", 0.18, baseTime);
  scheduleTone(ctx, 0.28, 0.18, 660, "sine", 0.18, baseTime);
  scheduleTone(ctx, 0.56, 0.18, 660, "sine", 0.18, baseTime);
};

const playSmartArpeggio = (ctx: AudioContext, baseTime: number) => {
  scheduleTone(ctx, 0.0, 0.18, 523.25, "triangle", 0.18, baseTime);
  scheduleTone(ctx, 0.18, 0.18, 659.25, "triangle", 0.18, baseTime);
  scheduleTone(ctx, 0.36, 0.18, 783.99, "triangle", 0.18, baseTime);
  scheduleTone(ctx, 0.54, 0.36, 1046.5, "triangle", 0.2, baseTime, 0.02, 0.18);
};

const playUrgent = (ctx: AudioContext, baseTime: number) => {
  scheduleTone(ctx, 0, 0.12, 880, "square", 0.18, baseTime, 0.005, 0.02);
  scheduleTone(ctx, 0.18, 0.12, 880, "square", 0.18, baseTime, 0.005, 0.02);
  scheduleTone(ctx, 0.36, 0.12, 880, "square", 0.18, baseTime, 0.005, 0.02);
  scheduleTone(ctx, 0.54, 0.18, 1320, "square", 0.2, baseTime, 0.005, 0.04);
};

export const INBOUND_RINGTONE_PRESETS: InboundRingtonePreset[] = [
  {
    id: "classic",
    labelKey: "ringtoneLabelClassic",
    descriptionKey: "ringtoneDescClassic",
    burstDurationSec: 1.0,
    intervalMs: 3000,
    play: playClassic,
  },
  {
    id: "soft-chime",
    labelKey: "ringtoneLabelSoftChime",
    descriptionKey: "ringtoneDescSoftChime",
    burstDurationSec: 1.4,
    intervalMs: 3500,
    play: playSoftChime,
  },
  {
    id: "gentle-pulse",
    labelKey: "ringtoneLabelGentlePulse",
    descriptionKey: "ringtoneDescGentlePulse",
    burstDurationSec: 0.85,
    intervalMs: 2500,
    play: playGentlePulse,
  },
  {
    id: "smart-arpeggio",
    labelKey: "ringtoneLabelSmartArpeggio",
    descriptionKey: "ringtoneDescSmartArpeggio",
    burstDurationSec: 1.0,
    intervalMs: 3000,
    play: playSmartArpeggio,
  },
  {
    id: "urgent",
    labelKey: "ringtoneLabelUrgent",
    descriptionKey: "ringtoneDescUrgent",
    burstDurationSec: 0.85,
    intervalMs: 2200,
    play: playUrgent,
  },
];

export const DEFAULT_INBOUND_RINGTONE_ID: InboundRingtoneId = "classic";

export function getInboundRingtonePreset(id?: string | null): InboundRingtonePreset {
  const found = INBOUND_RINGTONE_PRESETS.find(p => p.id === id);
  return found ?? INBOUND_RINGTONE_PRESETS[0];
}
